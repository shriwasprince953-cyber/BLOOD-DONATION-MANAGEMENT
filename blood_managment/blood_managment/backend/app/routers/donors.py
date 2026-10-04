from fastapi import APIRouter, Query

from app.dependencies import CurrentDonor, CurrentProfile, DbSession
from app.schemas.blood_requirement import BloodRequirementResponse, BloodRequirementListResponse
from app.models.blood_requirement import UrgencyLevel
from app.schemas.donor import DonorCreate, DonorResponse, DonorUpdate
from app.services import donor_service, matching_service, requirement_service

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


@router.get("/me/requirements/page", response_model=BloodRequirementListResponse)
async def matching_requirements_page(
    db: DbSession, donor: CurrentDonor,
    limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
    urgency: UrgencyLevel | None = None,
) -> BloodRequirementListResponse:
    items, total = await requirement_service.list_requirements(
        db, limit=limit, offset=offset, active_only=True, blood_group=donor.blood_group, urgency=urgency,
    )
    return BloodRequirementListResponse(items=items, total=total, limit=limit, offset=offset)
