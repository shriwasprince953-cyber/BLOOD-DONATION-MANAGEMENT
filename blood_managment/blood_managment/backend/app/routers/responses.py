import uuid

from fastapi import APIRouter, Query

from app.dependencies import AdminProfile, CurrentDonor, DbSession
from app.schemas.donation_response import (
    DonationResponseCreate,
    DonationResponseListResponse,
    DonationResponseResponse,
    DonationResponseUpdate,
)
from app.services import requirement_service, response_service

router = APIRouter(prefix="/responses", tags=["responses"])


@router.post("", response_model=DonationResponseResponse, status_code=201)
async def create_response(
    payload: DonationResponseCreate,
    db: DbSession,
    donor: CurrentDonor,
) -> DonationResponseResponse:
    requirement = await requirement_service.get_requirement_or_404(db, payload.requirement_id)
    response = await response_service.create_donation_response(db, donor, requirement)
    return DonationResponseResponse.model_validate(response)


@router.get("/me", response_model=DonationResponseListResponse)
async def list_my_responses(
    db: DbSession,
    donor: CurrentDonor,
    requirement_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> DonationResponseListResponse:
    items, total = await response_service.list_responses(db, donor_id=donor.profile_id, requirement_id=requirement_id, limit=limit, offset=offset)
    return DonationResponseListResponse(
        items=[DonationResponseResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("", response_model=DonationResponseListResponse)
async def list_all_responses(
    db: DbSession,
    admin: AdminProfile,
    requirement_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> DonationResponseListResponse:
    items, total = await response_service.list_responses(
        db,
        requirement_id=requirement_id,
        limit=limit,
        offset=offset,
    )
    return DonationResponseListResponse(
        items=[DonationResponseResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/{response_id}", response_model=DonationResponseResponse)
async def update_response(
    response_id: uuid.UUID,
    payload: DonationResponseUpdate,
    db: DbSession,
    admin: AdminProfile,
) -> DonationResponseResponse:
    response = await response_service.get_response_or_404(db, response_id)
    updated = await response_service.update_response(db, response, payload)
    return DonationResponseResponse.model_validate(updated)
