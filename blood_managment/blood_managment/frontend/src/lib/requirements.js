export function mapRequirement(item) {
  return {
    id: item.id,
    bloodGroup: item.blood_group,
    title: `Blood Requirement for ${item.patient_name}`,
    patientName: item.patient_name,
    hospital: item.hospital_name,
    location: item.location,
    units: item.units_required,
    urgency: item.urgency_level,
    status: item.status,
    notes: item.notes || "No special instructions provided.",
    posted: new Date(item.created_at).toLocaleString(),
    distance: "Distance unavailable",
  };
}
