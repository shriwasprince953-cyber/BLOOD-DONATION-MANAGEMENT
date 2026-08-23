import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, String, ForeignKey, func, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.donation_response import DonationResponse
    from app.models.notification import Notification
    from app.models.profile import Profile


class BloodGroup(str, PyEnum):
    """Standard blood groups."""
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class Donor(Base):
    """
    Donor-specific details. 
    Strictly mapped 1-to-1 with the central Profile model to avoid data duplication.
    """
    __tablename__ = "donors"

    # Using profile_id as both Primary Key and Foreign Key ensures a strict 1-to-1 relationship.
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("profiles.id", ondelete="CASCADE"), 
        primary_key=True
    )
    
    blood_group: Mapped[BloodGroup] = mapped_column(
        SQLEnum(BloodGroup, values_callable=lambda obj: [e.value for e in obj]),
        index=True, 
        nullable=False
    )
    
    # Simple availability toggle for donors to opt-in/out temporarily
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # Optional geography to help filter nearby requests
    city: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    
    # Tracked to enforce safe donation intervals (e.g., minimum 8 weeks between donations)
    last_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Audit Timestamps
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

    profile: Mapped["Profile"] = relationship(back_populates="donor")
    responses: Mapped[list["DonationResponse"]] = relationship(
        back_populates="donor",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="donor",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<Donor(profile_id={self.profile_id}, blood_group='{self.blood_group}')>"
