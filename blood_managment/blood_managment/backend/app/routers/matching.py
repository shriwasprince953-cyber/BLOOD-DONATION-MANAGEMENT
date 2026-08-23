import uuid

from fastapi import APIRouter

from app.dependencies import AdminProfile, DbSession
from app.schemas.donor import MatchedDonorResponse
from app.schemas.notification import NotifyMatchedDonorsResponse
from app.services import matching_service, notification_service, requirement_service

router = APIRouter(prefix="/matching", tags=["matching"])


def _matched_donor_response(donor, already_notified: bool, response_status: str | None) -> MatchedDonorResponse:
    profile = donor.profile
    return MatchedDonorResponse(
        profile_id=donor.profile_id,
        blood_group=donor.blood_group,
        is_available=donor.is_available,
        city=donor.city,
        last_donation_date=donor.last_donation_date,
        created_at=donor.created_at,
        updated_at=donor.updated_at,
        full_name=profile.full_name,
        email=profile.email,
        phone_number=profile.phone_number,
        already_notified=already_notified,
        response_status=response_status,
    )


@router.get("/requirements/{requirement_id}/donors", response_model=list[MatchedDonorResponse])
async def get_matching_donors(
    requirement_id: uuid.UUID,
    db: DbSession,
    admin: AdminProfile,
    exact_match_only: bool = True,
) -> list[MatchedDonorResponse]:
    requirement = await requirement_service.get_requirement_or_404(db, requirement_id)
    donors = await matching_service.find_matching_donors(db, requirement, exact_match_only)
    notified_ids = await matching_service.notified_donor_ids(db, requirement_id)
    responses = await matching_service.response_status_map(db, requirement_id)
    return [
        _matched_donor_response(
            donor,
            donor.profile_id in notified_ids,
            responses.get(donor.profile_id),
        )
        for donor in donors
    ]


@router.post("/requirements/{requirement_id}/notify", response_model=NotifyMatchedDonorsResponse)
async def notify_matching_donors(
    requirement_id: uuid.UUID,
    db: DbSession,
    admin: AdminProfile,
    exact_match_only: bool = True,
) -> NotifyMatchedDonorsResponse:
    requirement = await requirement_service.get_requirement_or_404(db, requirement_id)
    donors = await matching_service.find_matching_donors(db, requirement, exact_match_only)
    notifications, skipped = await notification_service.queue_notifications_for_donors(
        db,
        requirement,
        donors,
    )
    return NotifyMatchedDonorsResponse(
        requirement_id=requirement.id,
        matched_donors=len(donors),
        queued_notifications=len(notifications),
        skipped_existing_notifications=skipped,
        notifications=notifications,
    )
