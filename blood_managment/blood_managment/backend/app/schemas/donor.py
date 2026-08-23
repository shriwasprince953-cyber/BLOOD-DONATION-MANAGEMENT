from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, UUID4

from app.models.donor import BloodGroup


class DonorBase(BaseModel):
    """Base fields shared across multiple Donor schemas."""
    blood_group: BloodGroup
    is_available: bool = Field(default=True, description="Whether the donor is currently available to donate")
    city: Optional[str] = Field(None, max_length=100, description="Donor's primary city/location")
    last_donation_date: Optional[date] = Field(None, description="Date of the donor's last blood donation")


class DonorCreate(DonorBase):
    """
    Schema for creating a new Donor profile.
    The `profile_id` will be injected by the service layer using the authenticated user's ID.
    """
    pass


class DonorUpdate(BaseModel):
    """Schema for updating an existing Donor. Blood group is intentionally omitted to prevent accidental changes."""
    is_available: Optional[bool] = None
    city: Optional[str] = Field(None, max_length=100)
    last_donation_date: Optional[date] = None


class DonorResponse(DonorBase):
    """Schema for returning Donor data in API responses."""
    profile_id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DonorWithProfileResponse(DonorResponse):
    """Extended response schema that includes the joined Profile information (if eager loaded)."""
    # Assuming standard dict representation of the joined profile model
    full_name: str
    email: str
    phone_number: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class MatchedDonorResponse(DonorWithProfileResponse):
    already_notified: bool = False
    response_status: Optional[str] = None
