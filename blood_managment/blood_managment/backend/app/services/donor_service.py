import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.donor import Donor
from app.models.profile import Profile
from app.schemas.donor import DonorCreate, DonorUpdate
from app.schemas.profile import ProfileRegister, ProfileUpdate, ProfileSave


async def get_profile(db: AsyncSession, profile_id: uuid.UUID) -> Profile | None:
    result = await db.execute(
        select(Profile)
        .options(selectinload(Profile.donor))
        .where(Profile.id == profile_id)
    )
    return result.scalar_one_or_none()


async def register_profile(
    db: AsyncSession,
    profile_id: uuid.UUID,
    email_from_token: str | None,
    payload: ProfileRegister,
) -> Profile:
    existing = await get_profile(db, profile_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile is already registered.",
        )

    if not email_from_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The authenticated Supabase user does not include an email address.",
        )

    if email_from_token.lower() != payload.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email must match the authenticated Supabase user.",
        )

    profile = Profile(
        id=profile_id,
        full_name=payload.full_name,
        email=payload.email.lower(),
        phone_number=payload.phone_number,
    )
    db.add(profile)

    if payload.donor is not None:
        db.add(Donor(profile_id=profile_id, **payload.donor.model_dump()))

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Profile is already registered.") from None
    return await get_profile(db, profile_id)  # type: ignore[return-value]


async def update_profile(
    db: AsyncSession,
    profile: Profile,
    payload: ProfileUpdate,
) -> Profile:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


async def create_donor(
    db: AsyncSession,
    profile: Profile,
    payload: DonorCreate,
) -> Donor:
    existing = await db.get(Donor, profile.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Donor profile already exists.",
        )

    donor = Donor(profile_id=profile.id, **payload.model_dump())
    db.add(donor)
    await db.commit()
    await db.refresh(donor)
    return donor


async def update_donor(
    db: AsyncSession,
    donor: Donor,
    payload: DonorUpdate,
) -> Donor:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(donor, field, value)

    await db.commit()
    await db.refresh(donor)
    return donor


async def get_donor_with_profile(db: AsyncSession, donor_id: uuid.UUID) -> Donor | None:
    result = await db.execute(
        select(Donor)
        .options(selectinload(Donor.profile))
        .where(Donor.profile_id == donor_id)
    )
    return result.scalar_one_or_none()


async def save_profile(db: AsyncSession, profile: Profile, payload: ProfileSave) -> Profile:
    donor = await db.get(Donor, profile.id)
    if donor is not None and payload.donor is not None and donor.blood_group != payload.donor.blood_group:
        raise HTTPException(409, "Blood group cannot be changed after donor registration.")
    profile.full_name = payload.full_name
    profile.phone_number = payload.phone_number
    if payload.donor is not None:
        if donor is None:
            donor = Donor(profile_id=profile.id, **payload.donor.model_dump())
            db.add(donor)
        else:
            for field, value in payload.donor.model_dump().items():
                setattr(donor, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Profile changed in another session. Reload and try again.") from None
    # Refresh the relationship as well as fields after creating a donor.
    await db.refresh(profile, attribute_names=["full_name", "phone_number", "updated_at", "donor"])
    return profile
