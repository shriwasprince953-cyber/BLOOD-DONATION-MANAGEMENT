import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text, insert

from app.core.database import Base, engine, AsyncSessionLocal, get_db
from app.core.security import TokenData, get_current_user
from app.main import app
from app.models.profile import Profile, UserRole
from app.models.donor import Donor, BloodGroup
from app.services.admin_service import auth_users


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.execute(text("ATTACH DATABASE ':memory:' AS auth"))
        await conn.execute(text("CREATE TABLE auth.users (id CHAR(32) PRIMARY KEY, email TEXT, raw_user_meta_data JSON, email_confirmed_at DATETIME, created_at DATETIME)"))
        await conn.run_sync(Base.metadata.create_all)
    user = TokenData(sub=uuid.uuid4(), email="donor@example.com")
    async with AsyncSessionLocal() as db:
        await db.execute(insert(auth_users).values(id=user.sub, email=user.email, raw_user_meta_data={"full_name": "Test Donor"},
                                                  email_confirmed_at=datetime.now(timezone.utc), created_at=datetime.now(timezone.utc)))
        await db.commit()
    async def db_session():
        async with AsyncSessionLocal() as session:
            yield session
    app.dependency_overrides[get_db] = db_session
    app.dependency_overrides[get_current_user] = lambda: user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as instance:
        yield instance, user
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def register(client):
    response = await client.post("/api/v1/auth/register", json={"full_name": "Test Donor", "email": "donor@example.com"})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_profile_login_with_and_without_donor(client):
    api, _ = client
    assert (await api.get("/api/v1/auth/me")).status_code == 403
    await register(api)
    profile = await api.get("/api/v1/auth/me")
    assert profile.status_code == 200, profile.text
    assert profile.json()["donor"] is None
    assert profile.json()["role"] == "DONOR"
    donor = await api.post("/api/v1/donors/me", json={"blood_group": "O+", "city": "Test City"})
    assert donor.status_code == 201, donor.text
    profile = await api.get("/api/v1/auth/me")
    assert profile.status_code == 200, profile.text
    assert profile.json()["donor"]["blood_group"] == "O+"
    saved = await api.patch("/api/v1/auth/me", json={"full_name": "Updated Donor"})
    assert saved.status_code == 200
    assert (await api.get("/api/v1/auth/me")).json()["full_name"] == "Updated Donor"


@pytest.mark.asyncio
async def test_donor_cannot_self_promote(client):
    api, _ = client
    response = await api.post("/api/v1/auth/register", json={"full_name": "Test Donor", "email": "donor@example.com", "role": "ADMIN"})
    assert response.json()["role"] == "DONOR"
    assert (await api.get("/api/v1/admin/stats")).status_code == 403
    assert (await api.get("/api/v1/admin/me")).status_code == 403
    await api.patch("/api/v1/auth/me", json={"role": "ADMIN"})
    assert (await api.get("/api/v1/auth/me")).json()["role"] == "DONOR"


@pytest.mark.asyncio
async def test_registration_conflicts_and_email_binding(client):
    api, _ = client
    wrong = await api.post("/api/v1/auth/register", json={"full_name": "Test Donor", "email": "someone@example.com"})
    assert wrong.status_code == 400
    await register(api)
    duplicate = await api.post("/api/v1/auth/register", json={"full_name": "Test Donor", "email": "donor@example.com"})
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_request_matching_response_and_stats(client):
    api, user = client
    await register(api)
    await api.post("/api/v1/donors/me", json={"blood_group": "O+"})
    async with AsyncSessionLocal() as db:
        profile = await db.get(Profile, user.sub)
        profile.role = UserRole.ADMIN
        await db.commit()
    payload = {"patient_name": "Test Patient", "blood_group": "O+", "units_required": 2,
               "urgency_level": "CRITICAL", "hospital_name": "Test Hospital", "location": "Test City"}
    created = await api.post("/api/v1/requirements", json=payload)
    assert created.status_code == 201, created.text
    request_id = created.json()["id"]
    counts = await api.get("/api/v1/admin/stats")
    assert counts.json() == {"totalRequests": 1, "activeRequests": 1, "totalDonors": 1, "totalUsers": 1, "availableDonors": 1}
    matches = await api.get("/api/v1/donors/me/requirements")
    assert [r["id"] for r in matches.json()] == [request_id]
    response = await api.post("/api/v1/responses", json={"requirement_id": request_id})
    assert response.status_code == 201, response.text
    assert (await api.post("/api/v1/responses", json={"requirement_id": request_id})).status_code == 409
    filtered = await api.get(f"/api/v1/responses/me?requirement_id={request_id}")
    assert filtered.json()["total"] == 1
    assert (await api.get(f"/api/v1/responses/me?requirement_id={uuid.uuid4()}")).json()["items"] == []
    first = await api.post(f"/api/v1/matching/requirements/{request_id}/notify")
    assert first.json()["queued_notifications"] == 1
    second = await api.post(f"/api/v1/matching/requirements/{request_id}/notify")
    assert second.json()["skipped_existing_notifications"] == 1
    await api.patch(f"/api/v1/requirements/{request_id}", json={"status": "FULFILLED"})
    assert (await api.get("/api/v1/admin/stats")).json()["activeRequests"] == 0
    assert (await api.get("/api/v1/donors/me/requirements")).json() == []
    assert (await api.post("/api/v1/responses", json={"requirement_id": request_id})).status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["limit=-1", "limit=0", "limit=101", "offset=-1"])
async def test_invalid_pagination(client, query):
    api, _ = client
    assert (await api.get(f"/api/v1/requirements?{query}")).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"full_name": None}, {"full_name": "   "}])
async def test_invalid_name_update(client, payload):
    api, _ = client
    await register(api)
    assert (await api.patch("/api/v1/auth/me", json=payload)).status_code == 422


def test_postgres_enum_types_match_migration():
    migration = (Path(__file__).parents[1] / "migrations/001_initial_schema.sql").read_text()
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if hasattr(column.type, "enums"):
                assert f"create type {column.type.name} as enum" in migration


async def promote(user):
    async with AsyncSessionLocal() as db:
        profile = await db.get(Profile, user.sub)
        profile.role = UserRole.ADMIN
        await db.commit()


@pytest.mark.asyncio
async def test_directory_includes_pending_non_donor_and_donors_without_duplicates(client):
    api, user = client
    await register(api)
    await promote(user)
    pending, incomplete, available, unavailable = [uuid.uuid4() for _ in range(4)]
    async with AsyncSessionLocal() as db:
        for account_id in [pending, incomplete, available, unavailable]:
            await db.execute(insert(auth_users).values(
                id=account_id, email=f"{account_id}@example.com",
                raw_user_meta_data={"full_name": "Signup Name", "role": "ADMIN", "private_field": "not returned"},
                email_confirmed_at=None if account_id == pending else datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
            ))
        for account_id in [available, unavailable]:
            db.add(Profile(id=account_id, full_name="Saved Name", email=f"{account_id}@example.com"))
        await db.flush()
        db.add_all([Donor(profile_id=available, blood_group=BloodGroup.O_POS, is_available=True),
                    Donor(profile_id=unavailable, blood_group=BloodGroup.O_POS, is_available=False)])
        await db.commit()
    response = await api.get("/api/v1/admin/users")
    assert response.status_code == 200, response.text
    directory = response.json()
    assert directory["total"] == 5
    users = {item["id"]: item for item in directory["items"]}
    assert users[str(pending)]["account_status"] == "EMAIL_PENDING"
    assert users[str(pending)]["profile_status"] == "SETUP_PENDING"
    assert users[str(pending)]["role"] is None  # Never trust user-controlled metadata.
    assert users[str(incomplete)]["account_status"] == "CONFIRMED"
    assert users[str(incomplete)]["is_available"] is None
    assert users[str(user.sub)]["profile_status"] == "PROFILE_ONLY"
    assert users[str(available)]["full_name"] == "Saved Name"
    assert users[str(available)]["is_available"] is True
    assert users[str(unavailable)]["is_available"] is False
    assert "private_field" not in response.text and "raw_user_meta_data" not in response.text
    counts = (await api.get("/api/v1/admin/stats")).json()
    assert counts["totalUsers"] == 5 and counts["totalDonors"] == 2 and counts["availableDonors"] == 1
    pages = [(await api.get(f"/api/v1/admin/users?limit=2&offset={offset}")).json() for offset in [0, 2, 4]]
    assert all(page["total"] == 5 for page in pages)
    assert len({item["id"] for page in pages for item in page["items"]}) == 5


@pytest.mark.asyncio
async def test_directory_and_counts_fail_explicitly_when_auth_table_unavailable(client):
    api, user = client
    await register(api)
    await promote(user)
    async with AsyncSessionLocal() as db:
        await db.execute(text("DROP TABLE auth.users"))
        await db.commit()
    for path in ["/api/v1/admin/users", "/api/v1/admin/stats"]:
        response = await api.get(path)
        assert response.status_code == 503
        assert "could not be loaded" in response.json()["detail"]


@pytest.mark.asyncio
async def test_directory_requires_admin_and_valid_pagination(client):
    api, user = client
    await register(api)
    assert (await api.get("/api/v1/admin/users")).status_code == 403
    app.dependency_overrides.pop(get_current_user)
    assert (await api.get("/api/v1/admin/users")).status_code == 401
    app.dependency_overrides[get_current_user] = lambda: user
    await promote(user)
    for query in ["limit=0", "limit=101", "offset=-1"]:
        assert (await api.get(f"/api/v1/admin/users?{query}")).status_code == 422


@pytest.mark.asyncio
async def test_atomic_profile_save_and_blood_group_protection(client):
    api, _ = client
    await register(api)
    basic = await api.put("/api/v1/auth/me", json={"full_name": "Basic User", "phone_number": "123"})
    assert basic.status_code == 200, basic.text
    assert basic.json()["donor"] is None
    invalid = await api.put("/api/v1/auth/me", json={"full_name": "Must Not Save", "donor": {"blood_group": "INVALID"}})
    assert invalid.status_code == 422
    assert (await api.get("/api/v1/auth/me")).json()["full_name"] == "Basic User"
    saved = await api.put("/api/v1/auth/me", json={"full_name": "Saved Donor", "donor": {"blood_group": "O+", "city": "City", "is_available": False}})
    assert saved.status_code == 200, saved.text
    assert saved.json()["donor"]["is_available"] is False
    changed = await api.put("/api/v1/auth/me", json={"full_name": "Must Not Save", "donor": {"blood_group": "A+"}})
    assert changed.status_code == 409
    profile = (await api.get("/api/v1/auth/me")).json()
    assert profile["full_name"] == "Saved Donor" and profile["donor"]["blood_group"] == "O+"
    forbidden = await api.put("/api/v1/auth/me", json={"full_name": "User", "role": "ADMIN"})
    assert forbidden.status_code == 422


@pytest.mark.asyncio
async def test_matching_filters_availability_and_request_pagination(client):
    api, user = client
    await register(api)
    await api.put("/api/v1/auth/me", json={"full_name": "Available Donor", "donor": {"blood_group": "O+", "city": "Different City"}})
    await promote(user)
    payload = {"patient_name": "Patient", "blood_group": "O+", "units_required": 1,
               "urgency_level": "HIGH", "hospital_name": "Hospital", "location": "Request City"}
    requests = []
    for changes in [{}, {}, {"blood_group": "A+"}, {"urgency_level": "LOW"}]:
        response = await api.post("/api/v1/requirements", json={**payload, **changes})
        assert response.status_code == 201
        requests.append(response.json()["id"])
    first = requests[0]
    matches = (await api.get(f"/api/v1/matching/requirements/{first}/donors")).json()
    assert [item["profile_id"] for item in matches] == [str(user.sub)]  # All cities, exact group.
    await api.patch("/api/v1/donors/me", json={"is_available": False})
    assert (await api.get(f"/api/v1/matching/requirements/{first}/donors")).json() == []
    assert (await api.post("/api/v1/responses", json={"requirement_id": first})).status_code == 409
    # Unavailable donors can still browse, but cannot respond until re-enabled.
    page = (await api.get("/api/v1/donors/me/requirements/page?limit=1&urgency=HIGH")).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    next_page = (await api.get("/api/v1/donors/me/requirements/page?limit=1&offset=1&urgency=HIGH")).json()
    assert page["items"][0]["id"] != next_page["items"][0]["id"]
    await api.patch(f"/api/v1/requirements/{first}", json={"status": "FULFILLED"})
    assert (await api.post(f"/api/v1/matching/requirements/{first}/notify")).status_code == 409
    active = (await api.get("/api/v1/requirements?active_only=true&blood_group=O%2B&urgency=HIGH")).json()
    assert active["total"] == 1 and active["items"][0]["id"] == requests[1]
