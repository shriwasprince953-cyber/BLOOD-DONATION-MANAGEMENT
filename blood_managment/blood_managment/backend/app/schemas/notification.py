from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4

from app.models.notification import NotificationChannel, NotificationStatus


class NotificationCreate(BaseModel):
    donor_id: UUID4
    requirement_id: UUID4
    channel: NotificationChannel = NotificationChannel.IN_APP


class NotificationResponse(BaseModel):
    id: UUID4
    donor_id: UUID4
    requirement_id: UUID4
    channel: NotificationChannel
    status: NotificationStatus
    message: str
    provider_message_id: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotifyMatchedDonorsResponse(BaseModel):
    requirement_id: UUID4
    matched_donors: int
    queued_notifications: int
    skipped_existing_notifications: int
    notifications: list[NotificationResponse]
