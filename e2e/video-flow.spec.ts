import { test, expect } from '@playwright/test';
import { demoPatientCredentials, signInAsDoctor, signInAsPatient } from './helpers/auth';
import { appointmentIdFromUrl, bookFirstVideoSlot } from './helpers/booking';
import { demoSeedMeta } from './helpers/demo-seed';
import { acceptFirstPendingBooking } from './helpers/doctor-appointments';
import { demoDoctorSlug } from './helpers/doctor-slug';
import { apiIntegrations } from './helpers/integrations';
import { joinVideoFromCallPage } from './helpers/video-call';

const canRun =
  Boolean(demoPatientCredentials()) &&
  Boolean(demoDoctorSlug()) &&
  demoSeedMeta()?.video === true;

test.describe('video consultation (demo doctor)', () => {
  test.skip(!canRun, 'npm run db:seed:demo-doctor:video -w backend + E2E_PATIENT_PASSWORD');

  test('patient and doctor join the same LiveKit room', async ({ browser }) => {
    const integrations = await apiIntegrations();
    test.skip(!integrations?.videoCalls, 'Set VIDEO_PROVIDER=livekit in backend/.env and restart API');

    const slug = demoDoctorSlug()!;
    const patientContext = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const doctorContext = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const patient = await patientContext.newPage();
    const doctor = await doctorContext.newPage();

    await signInAsPatient(patient);
    await bookFirstVideoSlot(patient, slug);
    await expect(patient.getByText(/waiting for the doctor|Pending/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await signInAsDoctor(doctor);
    await acceptFirstPendingBooking(doctor);

    const id = appointmentIdFromUrl(patient.url());
    await patient.goto(`/appointments/${id}`);
    await expect(patient.getByRole('link', { name: 'Open video room' })).toBeVisible({
      timeout: 15_000,
    });

    await joinVideoFromCallPage(patient, `/appointments/${id}/call`);
    await joinVideoFromCallPage(doctor, `/doctor/appointments/${id}/call`);

    await patientContext.close();
    await doctorContext.close();
  });
});
