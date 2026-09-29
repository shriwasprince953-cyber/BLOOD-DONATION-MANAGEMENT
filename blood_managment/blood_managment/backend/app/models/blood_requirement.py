import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Text, ForeignKey, func, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.donor import BloodGroup

if TYPE_CHECKING:
    from app.models.donation_response import DonationResponse
    from app.models.notification import Notification
    from app.models.profile import Profile


class UrgencyLevel(str, PyEnum):
    """Severity of the emergency."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RequirementStatus(str, PyEnum):
    """Lifecycle of the blood request."""
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class BloodRequirement(Base):
    """
    An emergency or scheduled request for blood, created by an administrator.
    """
    __tablename__ = "blood_requirements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    
    # Linked to the admin who verified and posted the requirement
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("profiles.id"), 
        index=True, 
        nullable=False
    )
    
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, name="blood_group", values_callable=lambda obj: [e.value for e in obj]),
        index=True, 
        nullable=False
    )
    units_required: Mapped[int] = mapped_column(Integer, nullable=False)
    urgency_level: Mapped[UrgencyLevel] = mapped_column(
        SQLEnum(UrgencyLevel, name="urgency_level", values_callable=lambda obj: [e.value for e in obj]),
        index=True, 
        nullable=False
    )
    
    # Request details
    patient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hospital_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    status: Mapped[RequirementStatus] = mapped_column(
        SQLEnum(RequirementStatus, name="requirement_status", values_callable=lambda obj: [e.value for e in obj]),
        default=RequirementStatus.OPEN, 
        index=True, 
        nullable=False
    )

    # Audit Timestamps
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

    admin: Mapped["Profile"] = relationship(back_populates="requirements")
    responses: Mapped[list["DonationResponse"]] = relationship(
        back_populates="requirement",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="requirement",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<BloodRequirement(id={self.id}, blood_group='{self.blood_group}', status='{self.status}')>"
