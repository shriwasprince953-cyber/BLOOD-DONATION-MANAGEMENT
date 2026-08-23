from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, get_current_user
from app.models.donor import Donor
from app.models.profile import Profile, UserRole

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[TokenData, Depends(get_current_user)]


async def get_current_profile(
    db: DbSession,
    user: CurrentUser,
) -> Profile:
    result = await db.execute(select(Profile).where(Profile.id == user.sub))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile is not registered. Complete profile setup first.",
        )
    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


async def require_admin(profile: CurrentProfile) -> Profile:
    if profile.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return profile


AdminProfile = Annotated[Profile, Depends(require_admin)]


async def get_current_donor(
    db: DbSession,
    profile: CurrentProfile,
) -> Donor:
    result = await db.execute(select(Donor).where(Donor.profile_id == profile.id))
    donor = result.scalar_one_or_none()
    if donor is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Donor profile is not registered.",
        )
    return donor


CurrentDonor = Annotated[Donor, Depends(get_current_donor)]
