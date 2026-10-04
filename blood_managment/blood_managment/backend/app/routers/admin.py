from fastapi import APIRouter, HTTPException, Query

from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from app.dependencies import AdminProfile, DbSession
from app.models.blood_requirement import BloodRequirement, RequirementStatus
from app.models.donor import Donor
from app.schemas.profile import ProfileResponse
from app.schemas.admin import AdminUserListResponse
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(db: DbSession, admin: AdminProfile) -> dict[str, int]:
    try:
        users = int(await db.scalar(select(func.count()).select_from(admin_service.directory_ids())))
    except DBAPIError:
        await db.rollback()
        raise HTTPException(503, "Account data could not be loaded. Please retry or contact the administrator.") from None
    result = await db.execute(select(
        select(func.count()).select_from(BloodRequirement).scalar_subquery(),
        select(func.count()).select_from(BloodRequirement).where(
            BloodRequirement.status.in_([RequirementStatus.OPEN, RequirementStatus.IN_PROGRESS])
        ).scalar_subquery(),
        select(func.count()).select_from(Donor).scalar_subquery(),
        select(func.count()).select_from(Donor).where(Donor.is_available.is_(True)).scalar_subquery(),
    ))
    total, active, donors, available = result.one()
    return {"totalRequests": total, "activeRequests": active, "totalUsers": users,
            "totalDonors": donors, "availableDonors": available}


@router.get("/users", response_model=AdminUserListResponse)
async def get_users(
    db: DbSession, admin: AdminProfile,
    limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
) -> dict:
    try:
        return await admin_service.list_users(db, limit, offset)
    except DBAPIError:
        await db.rollback()
        raise HTTPException(503, "Account data could not be loaded. Please retry or contact the administrator.") from None


@router.get("/me", response_model=ProfileResponse)
async def get_admin_me(admin: AdminProfile) -> ProfileResponse:
    return ProfileResponse.model_validate(admin)
