import type { AvailabilityStatus } from './doctor-profile.schema';
import type { DoctorVerificationStatus } from '../users/doctor-verification';

export type ProfileCompletion = 'incomplete' | 'complete';

export function profileCompletionOf(missing: readonly string[]): ProfileCompletion {
  return missing.length === 0 ? 'complete' : 'incomplete';
}

export interface DoctorNextStepInput {
  verification: DoctorVerificationStatus;
  availability: AvailabilityStatus | null;
  profileCompletion: ProfileCompletion;
  published: boolean;
  hasApplication: boolean;
  hasHours: boolean;
  hasOnlineHours: boolean;
  videoPlatformReady: boolean;
  offersVideoOnProfile: boolean;
  rejectionReason: string | null;
  pendingBookingApprovals: number;
}

/** Plain-language guidance. Verification is never something the doctor can grant themselves. */
export function doctorNextSteps(input: DoctorNextStepInput): string[] {
  const steps: string[] = [];
  if (input.pendingBookingApprovals > 0) {
    const n = input.pendingBookingApprovals;
    steps.push(
      n === 1
        ? 'One paid booking is waiting for you to accept or decline under Patient appointments.'
        : `${n} paid bookings are waiting for you to accept or decline under Patient appointments.`,
    );
  }
  if (!input.hasApplication) {
    steps.push('Add your medical council, registration number, qualification and specialty.');
  }
  if (input.verification === 'pending') {
    steps.push(
      'Your verification is pending. Only an administrator can verify, reject or suspend a doctor.',
    );
  }
  if (input.verification === 'rejected') {
    steps.push(
      input.rejectionReason
        ? `Verification was rejected: ${input.rejectionReason} You can submit corrected details.`
        : 'Verification was rejected. Submit corrected registration details for another review.',
    );
  }
  if (input.verification === 'suspended') {
    steps.push(
      'Your doctor account is suspended, so you cannot accept new bookings. Contact an administrator if you think this is a mistake.',
    );
  }
  if (input.hasApplication && input.profileCompletion === 'incomplete') {
    steps.push('Finish your about section, languages, consultation types and fee.');
  }
  if (
    input.verification === 'verified' &&
    input.profileCompletion === 'complete' &&
    !input.published
  ) {
    steps.push('Publish your profile when you want patients to find you.');
  }
  if (input.verification === 'verified' && input.availability !== 'available') {
    steps.push(
      'Turn availability on when you are ready for new bookings. Your hours, existing appointments and consultation types still decide which times open.',
    );
  }
  if (input.verification === 'verified' && input.availability === 'available' && !input.hasHours) {
    steps.push('Add working hours so patients have times they can book.');
  }
  if (
    input.verification === 'verified' &&
    input.offersVideoOnProfile &&
    input.hasOnlineHours &&
    !input.videoPlatformReady
  ) {
    steps.push(
      'Video is on your profile and timetable, but the site has not finished LiveKit setup yet. Patients only see in-clinic times until LIVEKIT_API_SECRET is set in backend/.env and the backend is restarted.',
    );
  }
  if (input.verification !== 'verified') {
    steps.push('Pending, rejected and suspended doctors are not offered for new bookings.');
  }
  return steps;
}
