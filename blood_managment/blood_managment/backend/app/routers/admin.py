from fastapi import APIRouter

from sqlalchemy import func, select
from app.dependencies import AdminProfile, DbSession
from app.models.blood_requirement import BloodRequirement, RequirementStatus
from app.models.donor import Donor
from app.schemas.profile import ProfileResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(db: DbSession, admin: AdminProfile) -> dict[str, int]:
    result = await db.execute(select(
        select(func.count()).select_from(BloodRequirement).scalar_subquery(),
        select(func.count()).select_from(BloodRequirement).where(
            BloodRequirement.status.in_([RequirementStatus.OPEN, RequirementStatus.IN_PROGRESS])
        ).scalar_subquery(),
        select(func.count()).select_from(Donor).scalar_subquery(),
    ))
    total, active, donors = result.one()
    return {"totalRequests": total, "activeRequests": active, "totalDonors": donors}


@router.get("/me", response_model=ProfileResponse)
async def get_admin_me(admin: AdminProfile) -> ProfileResponse:
    return ProfileResponse.model_validate(admin)
