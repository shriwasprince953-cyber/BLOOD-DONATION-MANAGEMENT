import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.blood_requirement import BloodRequirement
    from app.models.donor import Donor


class UserRole(str, PyEnum):
    """Defines authorization tiers within the application."""
    DONOR = "DONOR"
    ADMIN = "ADMIN"


class Profile(Base):
    """
    Application-level user profile.
    Designed to link 1-to-1 with the Supabase `auth.users` table via the `id` field.
    """
    __tablename__ = "profiles"

    # Uses the UUID from Supabase Auth as the primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True
    )
    
    # Personal Information
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    # Role-based access control
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, values_callable=lambda obj: [e.value for e in obj]),
        default=UserRole.DONOR,
        nullable=False,
    )
    
    # Audit Timestamps
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

    donor: Mapped["Donor | None"] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        uselist=False,
    )
    requirements: Mapped[list["BloodRequirement"]] = relationship(back_populates="admin")

    def __repr__(self) -> str:
        return f"<Profile(id={self.id}, full_name='{self.full_name}', role='{self.role}')>"
