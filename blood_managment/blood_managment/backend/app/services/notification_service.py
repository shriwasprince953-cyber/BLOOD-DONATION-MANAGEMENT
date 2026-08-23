from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.blood_requirement import BloodRequirement
from app.models.donor import Donor
from app.models.notification import Notification, NotificationChannel, NotificationStatus


def build_requirement_message(requirement: BloodRequirement) -> str:
    return (
        f"Urgent blood requirement: {requirement.blood_group.value}, "
        f"{requirement.units_required} unit(s), urgency {requirement.urgency_level.value}, "
        f"hospital {requirement.hospital_name}, location {requirement.location}."
    )


async def queue_notifications_for_donors(
    db: AsyncSession,
    requirement: BloodRequirement,
    donors: list[Donor],
    channel: NotificationChannel = NotificationChannel.IN_APP,
) -> tuple[list[Notification], int]:
    existing_result = await db.execute(
        select(Notification.donor_id).where(
            Notification.requirement_id == requirement.id,
            Notification.channel == channel,
        )
    )
    existing_ids = set(existing_result.scalars().all())
    message = build_requirement_message(requirement)
    notifications: list[Notification] = []
    skipped = 0

    for donor in donors:
        if donor.profile_id in existing_ids:
            skipped += 1
            continue
        notification = Notification(
            donor_id=donor.profile_id,
            requirement_id=requirement.id,
            channel=channel,
            status=NotificationStatus.QUEUED,
            message=message,
        )
        db.add(notification)
        notifications.append(notification)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return [], len(donors)

    for notification in notifications:
        await db.refresh(notification)
    return notifications, skipped
