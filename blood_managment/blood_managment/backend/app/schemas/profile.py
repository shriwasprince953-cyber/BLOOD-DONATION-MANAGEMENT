from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, UUID4, field_validator

from app.models.profile import UserRole
from app.schemas.donor import DonorCreate, DonorResponse


class ProfileBase(BaseModel):
    """Base fields shared across multiple Profile schemas."""
    model_config = ConfigDict(str_strip_whitespace=True)
    full_name: str = Field(..., min_length=2, max_length=255, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    phone_number: Optional[str] = Field(None, max_length=20, description="Optional contact number")


class ProfileCreate(ProfileBase):
    """Schema for creating a new Profile after Supabase Auth signup."""
    # Defaults to DONOR. Admins should be elevated manually or via a secure internal endpoint.
    role: UserRole = UserRole.DONOR


class ProfileRegister(ProfileBase):
    """Payload used after Supabase signup to create the application profile."""
    donor: Optional[DonorCreate] = None


class ProfileUpdate(BaseModel):
    """Schema for updating an existing Profile. All fields are optional."""
    model_config = ConfigDict(str_strip_whitespace=True)
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=20)
    @field_validator("full_name")
    @classmethod
    def reject_null_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Full name cannot be null")
        return value
    # Note: Email updates are typically handled by Supabase Auth directly, 
    # so we exclude email from the standard application-level update schema.


class ProfileResponse(ProfileBase):
    """Schema for returning Profile data in API responses."""
    id: UUID4
    role: UserRole
    created_at: datetime
    updated_at: datetime

    # Enables Pydantic to read data directly from the SQLAlchemy ORM model attributes
    model_config = ConfigDict(from_attributes=True)


class ProfileWithDonorResponse(ProfileResponse):
    donor: Optional[DonorResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileSave(BaseModel):
    """Save personal and optional donor details in one transaction."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    full_name: str = Field(min_length=2, max_length=255)
    phone_number: str | None = Field(None, max_length=20)
    donor: DonorCreate | None = None
