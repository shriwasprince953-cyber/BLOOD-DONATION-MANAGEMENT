from fastapi import APIRouter

from app.dependencies import CurrentProfile, CurrentUser, DbSession
from app.schemas.profile import ProfileRegister, ProfileResponse, ProfileUpdate, ProfileWithDonorResponse, ProfileSave
from app.services import donor_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=ProfileWithDonorResponse)
async def get_me(profile: CurrentProfile) -> ProfileWithDonorResponse:
    return ProfileWithDonorResponse.model_validate(profile)


@router.post("/register", response_model=ProfileWithDonorResponse, status_code=201)
async def register_profile(
    payload: ProfileRegister,
    db: DbSession,
    user: CurrentUser,
) -> ProfileWithDonorResponse:
    profile = await donor_service.register_profile(
        db=db,
        profile_id=user.sub,
        email_from_token=user.email,
        payload=payload,
    )
    return ProfileWithDonorResponse.model_validate(profile)


@router.patch("/me", response_model=ProfileResponse)
async def update_me(
    payload: ProfileUpdate,
    db: DbSession,
    profile: CurrentProfile,
) -> ProfileResponse:
    updated = await donor_service.update_profile(db, profile, payload)
    return ProfileResponse.model_validate(updated)


@router.put("/me", response_model=ProfileWithDonorResponse)
async def save_me(payload: ProfileSave, db: DbSession, profile: CurrentProfile) -> ProfileWithDonorResponse:
    saved = await donor_service.save_profile(db, profile, payload)
    return ProfileWithDonorResponse.model_validate(saved)
