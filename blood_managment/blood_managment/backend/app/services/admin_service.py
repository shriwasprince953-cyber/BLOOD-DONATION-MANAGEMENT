"""Read-only account directory. Auth metadata is never used for authorization."""
from sqlalchemy import DateTime, JSON, String, column, func, select, table, union
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.models.donor import Donor

# Supabase owns this table; deliberately excluded from application migrations.
auth_users = table(
    "users",
    column("id", UUID(as_uuid=True)),
    column("email", String),
    column("raw_user_meta_data", JSON),
    column("email_confirmed_at", DateTime(timezone=True)),
    column("created_at", DateTime(timezone=True)),
    schema="auth",
)


def directory_ids():
    # Preserve legacy application profiles too, without counting an account twice.
    return union(select(auth_users.c.id), select(Profile.id)).subquery()


async def list_users(db: AsyncSession, limit: int, offset: int) -> dict:
    ids = directory_ids()
    total = int(await db.scalar(select(func.count()).select_from(ids)))
    result = await db.execute(
        select(
            ids.c.id, auth_users.c.email.label("auth_email"),
            auth_users.c.id.label("auth_id"), auth_users.c.email_confirmed_at,
            auth_users.c.raw_user_meta_data, Profile.full_name, Profile.email,
            Profile.phone_number, Profile.role, Profile.id.label("profile_id"),
            func.coalesce(auth_users.c.created_at, Profile.created_at).label("created_at"),
            Donor.profile_id.label("donor_id"), Donor.blood_group,
            Donor.city, Donor.is_available,
        )
        .select_from(ids)
        .outerjoin(auth_users, auth_users.c.id == ids.c.id)
        .outerjoin(Profile, Profile.id == ids.c.id)
        .outerjoin(Donor, Donor.profile_id == ids.c.id)
        .order_by(func.coalesce(auth_users.c.created_at, Profile.created_at).desc(), ids.c.id)
        .limit(limit).offset(offset)
    )
    items = []
    for row in result.mappings():
        metadata = row["raw_user_meta_data"]
        name = metadata.get("full_name") if isinstance(metadata, dict) else None
        items.append({
            "id": row["id"],
            "full_name": row["full_name"] or (name if isinstance(name, str) else None),
            "email": row["auth_email"] or row["email"],
            "phone_number": row["phone_number"], "role": row["role"],
            "account_status": "AUTH_MISSING" if row["auth_id"] is None else (
                "CONFIRMED" if row["email_confirmed_at"] else "EMAIL_PENDING"
            ),
            "profile_status": "DONOR_REGISTERED" if row["donor_id"] else (
                "PROFILE_ONLY" if row["profile_id"] else "SETUP_PENDING"
            ),
            "blood_group": row["blood_group"], "city": row["city"],
            "is_available": row["is_available"], "created_at": row["created_at"],
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}
