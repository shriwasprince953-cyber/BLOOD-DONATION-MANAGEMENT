import uuid

from fastapi import APIRouter

from app.dependencies import AdminProfile, DbSession
from app.models.blood_requirement import RequirementStatus
from app.schemas.blood_requirement import (
    BloodRequirementCreate,
    BloodRequirementListResponse,
    BloodRequirementResponse,
    BloodRequirementUpdate,
)
from app.services import requirement_service

router = APIRouter(prefix="/requirements", tags=["requirements"])


@router.get("", response_model=BloodRequirementListResponse)
async def list_requirements(
    db: DbSession,
    status: RequirementStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> BloodRequirementListResponse:
    items, total = await requirement_service.list_requirements(db, status, limit, offset)
    return BloodRequirementListResponse(
        items=[BloodRequirementResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{requirement_id}", response_model=BloodRequirementResponse)
async def get_requirement(
    requirement_id: uuid.UUID,
    db: DbSession,
) -> BloodRequirementResponse:
    requirement = await requirement_service.get_requirement_or_404(db, requirement_id)
    return BloodRequirementResponse.model_validate(requirement)


@router.post("", response_model=BloodRequirementResponse, status_code=201)
async def create_requirement(
    payload: BloodRequirementCreate,
    db: DbSession,
    admin: AdminProfile,
) -> BloodRequirementResponse:
    requirement = await requirement_service.create_requirement(db, admin, payload)
    return BloodRequirementResponse.model_validate(requirement)


@router.patch("/{requirement_id}", response_model=BloodRequirementResponse)
async def update_requirement(
    requirement_id: uuid.UUID,
    payload: BloodRequirementUpdate,
    db: DbSession,
    admin: AdminProfile,
) -> BloodRequirementResponse:
    requirement = await requirement_service.get_requirement_or_404(db, requirement_id)
    updated = await requirement_service.update_requirement(db, requirement, payload)
    return BloodRequirementResponse.model_validate(updated)
