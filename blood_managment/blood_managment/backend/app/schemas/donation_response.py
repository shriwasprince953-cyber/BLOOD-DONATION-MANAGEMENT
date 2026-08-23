from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, UUID4

from app.models.donation_response import ResponseStatus


class DonationResponseCreate(BaseModel):
    """
    Schema for a donor responding to a blood requirement.
    The donor's ID will be securely injected from the authenticated session.
    """
    requirement_id: UUID4


class DonationResponseUpdate(BaseModel):
    """
    Schema for updating the status of a donation response.
    Typically used by admins (to ACCEPT/REJECT) or the system (to mark COMPLETED/NO_SHOW).
    """
    status: ResponseStatus


class DonationResponseResponse(BaseModel):
    """Schema for returning a donation response in API responses."""
    id: UUID4
    donor_id: UUID4
    requirement_id: UUID4
    status: ResponseStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DonationResponseListResponse(BaseModel):
    items: list[DonationResponseResponse]
    total: int
    limit: int
    offset: int
