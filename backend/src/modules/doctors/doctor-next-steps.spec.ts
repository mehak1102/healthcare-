import { doctorNextSteps } from './doctor-next-steps';

describe('doctorNextSteps', () => {
  it('tells a new doctor that an administrator must verify them', () => {
    const steps = doctorNextSteps({
      verification: 'pending',
      availability: null,
      profileCompletion: 'incomplete',
      published: false,
      hasApplication: false,
      hasHours: false,
      hasOnlineHours: false,
      videoPlatformReady: false,
      offersVideoOnProfile: false,
      rejectionReason: null,
      pendingBookingApprovals: 0,
    });
    expect(steps.join(' ')).toMatch(/administrator/i);
    expect(steps.join(' ')).toMatch(/registration number/i);
    expect(steps.join(' ')).not.toMatch(/approve yourself/i);
  });

  it('asks a verified doctor to turn availability on separately from verification', () => {
    const steps = doctorNextSteps({
      verification: 'verified',
      availability: 'unavailable',
      profileCompletion: 'complete',
      published: true,
      hasApplication: true,
      hasHours: true,
      hasOnlineHours: false,
      videoPlatformReady: false,
      offersVideoOnProfile: false,
      rejectionReason: null,
      pendingBookingApprovals: 0,
    });
    expect(steps.join(' ')).toMatch(/availability/i);
    expect(steps.join(' ')).not.toMatch(/waiting for you to accept/i);
  });

  it('reminds verified doctors when paid bookings need approval', () => {
    const steps = doctorNextSteps({
      verification: 'verified',
      availability: 'available',
      profileCompletion: 'complete',
      published: true,
      hasApplication: true,
      hasHours: true,
      hasOnlineHours: true,
      videoPlatformReady: true,
      offersVideoOnProfile: true,
      rejectionReason: null,
      pendingBookingApprovals: 2,
    });
    expect(steps[0]).toMatch(/2 paid bookings/);
  });
});
