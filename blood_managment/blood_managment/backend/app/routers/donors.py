from fastapi import APIRouter, Query

from app.dependencies import CurrentDonor, CurrentProfile, DbSession
from app.schemas.blood_requirement import BloodRequirementResponse
from app.schemas.donor import DonorCreate, DonorResponse, DonorUpdate
from app.services import donor_service, matching_service

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("/me", response_model=DonorResponse)
async def get_my_donor_profile(donor: CurrentDonor) -> DonorResponse:
    return DonorResponse.model_validate(donor)


@router.post("/me", response_model=DonorResponse, status_code=201)
async def create_my_donor_profile(
    payload: DonorCreate,
    db: DbSession,
    profile: CurrentProfile,
) -> DonorResponse:
    donor = await donor_service.create_donor(db, profile, payload)
    return DonorResponse.model_validate(donor)


@router.patch("/me", response_model=DonorResponse)
async def update_my_donor_profile(
    payload: DonorUpdate,
    db: DbSession,
    donor: CurrentDonor,
) -> DonorResponse:
    updated = await donor_service.update_donor(db, donor, payload)
    return DonorResponse.model_validate(updated)


@router.get("/me/requirements", response_model=list[BloodRequirementResponse])
async def list_matching_requirements_for_me(
    db: DbSession,
    donor: CurrentDonor,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[BloodRequirementResponse]:
    requirements = await matching_service.visible_requirements_for_donor(db, donor, limit, offset)
    return [BloodRequirementResponse.model_validate(item) for item in requirements]
