import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint, func, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.blood_requirement import BloodRequirement
    from app.models.donor import Donor


class ResponseStatus(str, PyEnum):
    """Lifecycle of a donor's commitment to a specific requirement."""
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"    # Admin accepted the donor
    REJECTED = "REJECTED"    # Admin rejected or found enough donors
    COMPLETED = "COMPLETED"  # Donor successfully donated
    NO_SHOW = "NO_SHOW"      # Donor committed but didn't show up


class DonationResponse(Base):
    """
    Pivot model representing a Donor's active response to a BloodRequirement.
    """
    __tablename__ = "donation_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("donors.profile_id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("blood_requirements.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    
    status: Mapped[ResponseStatus] = mapped_column(
        SQLEnum(ResponseStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ResponseStatus.PENDING, 
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

    # Constraints
    __table_args__ = (
        # Crucial constraint: A donor can only respond to a specific requirement once.
        UniqueConstraint("donor_id", "requirement_id", name="uq_donor_requirement_response"),
    )

    donor: Mapped["Donor"] = relationship(back_populates="responses")
    requirement: Mapped["BloodRequirement"] = relationship(back_populates="responses")

    def __repr__(self) -> str:
        return f"<DonationResponse(id={self.id}, donor_id={self.donor_id}, req_id={self.requirement_id}, status='{self.status}')>"
