import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.blood_requirement import BloodRequirement, RequirementStatus
from app.models.donation_response import DonationResponse
from app.models.donor import Donor
from app.models.notification import Notification
from app.utils.blood_compatibility import compatible_donor_groups


async def find_matching_donors(
    db: AsyncSession,
    requirement: BloodRequirement,
    exact_match_only: bool = True,
) -> list[Donor]:
    allowed_groups = compatible_donor_groups(requirement.blood_group, exact_match_only=exact_match_only)
    result = await db.execute(
        select(Donor)
        .options(selectinload(Donor.profile))
        .where(
            Donor.is_available.is_(True),
            Donor.blood_group.in_(allowed_groups),
        )
        .order_by(Donor.updated_at.desc())
    )
    return list(result.scalars().all())


async def visible_requirements_for_donor(
    db: AsyncSession,
    donor: Donor,
    limit: int = 50,
    offset: int = 0,
) -> list[BloodRequirement]:
    result = await db.execute(
        select(BloodRequirement)
        .where(
            BloodRequirement.status.in_(
                [RequirementStatus.OPEN, RequirementStatus.IN_PROGRESS]
            ),
            BloodRequirement.blood_group == donor.blood_group,
        )
        .order_by(BloodRequirement.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def response_status_map(
    db: AsyncSession,
    requirement_id: uuid.UUID,
) -> dict[uuid.UUID, str]:
    result = await db.execute(
        select(DonationResponse).where(DonationResponse.requirement_id == requirement_id)
    )
    return {response.donor_id: response.status.value for response in result.scalars().all()}


async def notified_donor_ids(
    db: AsyncSession,
    requirement_id: uuid.UUID,
) -> set[uuid.UUID]:
    result = await db.execute(
        select(Notification.donor_id).where(Notification.requirement_id == requirement_id)
    )
    return set(result.scalars().all())
