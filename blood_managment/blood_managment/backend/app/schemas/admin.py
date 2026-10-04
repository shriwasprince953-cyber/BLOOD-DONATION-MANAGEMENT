from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.donor import BloodGroup
from app.models.profile import UserRole


class AdminUserResponse(BaseModel):
    id: UUID
    full_name: str | None
    email: str | None
    phone_number: str | None
    role: UserRole | None
    account_status: Literal["CONFIRMED", "EMAIL_PENDING", "AUTH_MISSING"]
    profile_status: Literal["DONOR_REGISTERED", "PROFILE_ONLY", "SETUP_PENDING"]
    blood_group: BloodGroup | None
    city: str | None
    is_available: bool | None
    created_at: datetime | None


class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int
