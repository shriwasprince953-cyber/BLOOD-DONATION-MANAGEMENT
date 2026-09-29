import uuid
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from app.core.database import Base, engine, AsyncSessionLocal, get_db
from app.core.security import TokenData, get_current_user
from app.main import app
from app.models.profile import Profile, UserRole


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    user = TokenData(sub=uuid.uuid4(), email="donor@example.com")
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
    assert counts.json() == {"totalRequests": 1, "activeRequests": 1, "totalDonors": 1}
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
