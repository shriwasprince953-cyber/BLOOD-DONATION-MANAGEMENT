import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.blood_requirement import BloodRequirement, RequirementStatus
from app.models.donation_response import DonationResponse
from app.models.donor import Donor
from app.schemas.donation_response import DonationResponseUpdate


async def create_donation_response(
    db: AsyncSession,
    donor: Donor,
    requirement: BloodRequirement,
) -> DonationResponse:
    if not donor.is_available:
        raise HTTPException(409, "Enable donation availability in My Profile before responding.")
    if requirement.status not in {RequirementStatus.OPEN, RequirementStatus.IN_PROGRESS}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This requirement is not accepting donor responses.",
        )
    if donor.blood_group != requirement.blood_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This requirement is not visible for the donor's blood group.",
        )

    response = DonationResponse(donor_id=donor.profile_id, requirement_id=requirement.id)
    db.add(response)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Donor has already responded to this requirement.",
        ) from None

    await db.refresh(response)
    return response


async def list_responses(
    db: AsyncSession,
    requirement_id: uuid.UUID | None = None,
    donor_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[DonationResponse], int]:
    filters = []
    if requirement_id is not None:
        filters.append(DonationResponse.requirement_id == requirement_id)
    if donor_id is not None:
        filters.append(DonationResponse.donor_id == donor_id)

    count_stmt = select(func.count()).select_from(DonationResponse)
    list_stmt = select(DonationResponse)
    for condition in filters:
        count_stmt = count_stmt.where(condition)
        list_stmt = list_stmt.where(condition)

    total = int((await db.execute(count_stmt)).scalar_one())
    result = await db.execute(
        list_stmt.order_by(DonationResponse.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all()), total


async def get_response_or_404(
    db: AsyncSession,
    response_id: uuid.UUID,
) -> DonationResponse:
    response = await db.get(DonationResponse, response_id)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation response not found.",
        )
    return response


async def update_response(
    db: AsyncSession,
    response: DonationResponse,
    payload: DonationResponseUpdate,
) -> DonationResponse:
    response.status = payload.status
    await db.commit()
    await db.refresh(response)
    return response
