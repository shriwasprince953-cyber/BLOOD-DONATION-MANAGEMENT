from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, UUID4, field_validator

from app.models.blood_requirement import RequirementStatus, UrgencyLevel
from app.models.donor import BloodGroup


class BloodRequirementBase(BaseModel):
    """Base fields shared across multiple BloodRequirement schemas."""
    model_config = ConfigDict(str_strip_whitespace=True)
    blood_group: BloodGroup
    units_required: int = Field(..., gt=0, le=50, description="Number of units required (must be > 0)")
    urgency_level: UrgencyLevel
    patient_name: str = Field(..., min_length=2, max_length=255)
    hospital_name: str = Field(..., min_length=2, max_length=255)
    location: str = Field(..., min_length=2, max_length=255)
    notes: Optional[str] = Field(None, max_length=1000)


class BloodRequirementCreate(BloodRequirementBase):
    """
    Schema for creating a new Blood Requirement.
    `admin_id` and `status` (OPEN) are handled by the service layer.
    """
    pass


class BloodRequirementUpdate(BaseModel):
    """Schema for updating an existing Blood Requirement. All fields optional."""
    model_config = ConfigDict(str_strip_whitespace=True)
    blood_group: Optional[BloodGroup] = None
    units_required: Optional[int] = Field(None, gt=0, le=50)
    urgency_level: Optional[UrgencyLevel] = None
    patient_name: Optional[str] = Field(None, min_length=2, max_length=255)
    hospital_name: Optional[str] = Field(None, min_length=2, max_length=255)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[RequirementStatus] = None

    @field_validator("blood_group", "units_required", "urgency_level", "patient_name", "hospital_name", "location", "status")
    @classmethod
    def reject_null_required_fields(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class BloodRequirementResponse(BloodRequirementBase):
    """Schema for returning Blood Requirement data in API responses."""
    id: UUID4
    admin_id: UUID4
    status: RequirementStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BloodRequirementListResponse(BaseModel):
    items: list[BloodRequirementResponse]
    total: int
    limit: int
    offset: int
