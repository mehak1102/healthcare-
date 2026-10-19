export const DOCTOR_VERIFICATION_STATUSES = [
  'pending',
  'verified',
  'rejected',
  'suspended',
] as const;
export type DoctorVerificationStatus = (typeof DOCTOR_VERIFICATION_STATUSES)[number];

/**
 * Doctors approved before `doctorVerification` existed have no stored value. They stay verified.
 * Anyone without the doctor role has no verification status.
 */
export function effectiveDoctorVerification(
  roles: readonly string[],
  stored: DoctorVerificationStatus | null | undefined,
): DoctorVerificationStatus | null {
  if (!roles.includes('doctor')) return null;
  return stored ?? 'verified';
}

/** Directory and public profiles: active doctor accounts that are verified, including legacy rows. */
export const LISTED_DOCTOR_MATCH = {
  roles: 'doctor',
  status: 'active',
  $or: [
    { doctorVerification: 'verified' },
    { doctorVerification: null },
    { doctorVerification: { $exists: false } },
  ],
};
