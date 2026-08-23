from app.models.donor import BloodGroup


COMPATIBLE_DONORS_FOR_RECIPIENT: dict[BloodGroup, set[BloodGroup]] = {
    BloodGroup.O_NEG: {BloodGroup.O_NEG},
    BloodGroup.O_POS: {BloodGroup.O_NEG, BloodGroup.O_POS},
    BloodGroup.A_NEG: {BloodGroup.O_NEG, BloodGroup.A_NEG},
    BloodGroup.A_POS: {BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS},
    BloodGroup.B_NEG: {BloodGroup.O_NEG, BloodGroup.B_NEG},
    BloodGroup.B_POS: {BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.B_NEG, BloodGroup.B_POS},
    BloodGroup.AB_NEG: {BloodGroup.O_NEG, BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG},
    BloodGroup.AB_POS: {
        BloodGroup.O_NEG,
        BloodGroup.O_POS,
        BloodGroup.A_NEG,
        BloodGroup.A_POS,
        BloodGroup.B_NEG,
        BloodGroup.B_POS,
        BloodGroup.AB_NEG,
        BloodGroup.AB_POS,
    },
}


def compatible_donor_groups(recipient_group: BloodGroup, exact_match_only: bool = True) -> set[BloodGroup]:
    if exact_match_only:
        return {recipient_group}
    return COMPATIBLE_DONORS_FOR_RECIPIENT[recipient_group]


def can_donate_to(donor_group: BloodGroup, recipient_group: BloodGroup) -> bool:
    return donor_group in COMPATIBLE_DONORS_FOR_RECIPIENT[recipient_group]
