import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blood_requirement import BloodRequirement, RequirementStatus, UrgencyLevel
from app.models.donor import BloodGroup
from app.models.profile import Profile
from app.schemas.blood_requirement import BloodRequirementCreate, BloodRequirementUpdate


async def create_requirement(
    db: AsyncSession,
    admin: Profile,
    payload: BloodRequirementCreate,
) -> BloodRequirement:
    requirement = BloodRequirement(admin_id=admin.id, **payload.model_dump())
    db.add(requirement)
    await db.commit()
    await db.refresh(requirement)
    return requirement


async def list_requirements(
    db: AsyncSession,
    status_filter: RequirementStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    active_only: bool = False,
    blood_group: BloodGroup | None = None,
    urgency: UrgencyLevel | None = None,
) -> tuple[list[BloodRequirement], int]:
    base = select(BloodRequirement)
    total_stmt = select(func.count()).select_from(BloodRequirement)
    filters = []
    if status_filter is not None:
        filters.append(BloodRequirement.status == status_filter)
    if active_only:
        filters.append(BloodRequirement.status.in_([RequirementStatus.OPEN, RequirementStatus.IN_PROGRESS]))
    if blood_group is not None:
        filters.append(BloodRequirement.blood_group == blood_group)
    if urgency is not None:
        filters.append(BloodRequirement.urgency_level == urgency)
    base = base.where(*filters)
    total_stmt = total_stmt.where(*filters)

    total_result = await db.execute(total_stmt)
    result = await db.execute(
        base.order_by(BloodRequirement.created_at.desc(), BloodRequirement.id).limit(limit).offset(offset)
    )
    return list(result.scalars().all()), int(total_result.scalar_one())


async def get_requirement_or_404(
    db: AsyncSession,
    requirement_id: uuid.UUID,
) -> BloodRequirement:
    requirement = await db.get(BloodRequirement, requirement_id)
    if requirement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blood requirement not found.",
        )
    return requirement


async def update_requirement(
    db: AsyncSession,
    requirement: BloodRequirement,
    payload: BloodRequirementUpdate,
) -> BloodRequirement:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(requirement, field, value)

    await db.commit()
    await db.refresh(requirement)
    return requirement
