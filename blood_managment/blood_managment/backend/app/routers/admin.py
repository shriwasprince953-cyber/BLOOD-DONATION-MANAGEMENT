from fastapi import APIRouter

from app.dependencies import AdminProfile
from app.schemas.profile import ProfileResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/me", response_model=ProfileResponse)
async def get_admin_me(admin: AdminProfile) -> ProfileResponse:
    return ProfileResponse.model_validate(admin)
