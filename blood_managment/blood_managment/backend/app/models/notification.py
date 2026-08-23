import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.blood_requirement import BloodRequirement
    from app.models.donor import Donor


class NotificationChannel(str, PyEnum):
    IN_APP = "IN_APP"
    SMS = "SMS"
    EMAIL = "EMAIL"


class NotificationStatus(str, PyEnum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donors.profile_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blood_requirements.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        SQLEnum(NotificationChannel, values_callable=lambda obj: [e.value for e in obj]),
        default=NotificationChannel.IN_APP,
        nullable=False,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        SQLEnum(NotificationStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=NotificationStatus.QUEUED,
        index=True,
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    donor: Mapped["Donor"] = relationship(back_populates="notifications")
    requirement: Mapped["BloodRequirement"] = relationship(back_populates="notifications")

    __table_args__ = (
        UniqueConstraint(
            "donor_id",
            "requirement_id",
            "channel",
            name="uq_notification_donor_requirement_channel",
        ),
    )
