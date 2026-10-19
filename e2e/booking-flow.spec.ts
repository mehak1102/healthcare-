import { test, expect } from '@playwright/test';
import { demoPatientCredentials, signInAsDoctor, signInAsPatient } from './helpers/auth';
import { appointmentIdFromUrl, bookFirstClinicSlot } from './helpers/booking';
import { demoSeedMeta } from './helpers/demo-seed';
import { acceptFirstPendingBooking } from './helpers/doctor-appointments';
import { demoDoctorSlug } from './helpers/doctor-slug';

const canBook =
  Boolean(demoPatientCredentials()) && Boolean(demoDoctorSlug());

test.describe('book a clinic slot (demo doctor)', () => {
  test.skip(!canBook, 'Run db:seed + db:seed:demo-doctor and set E2E_PATIENT_PASSWORD');

  test('patient books; doctor accepts when approval is required', async ({ browser }) => {
    const meta = demoSeedMeta();
    test.skip(meta?.instantConfirm === true, 'Re-seed with default db:seed:demo-doctor (approval flow)');
    test.skip(meta?.video === true, 'Use booking-flow for clinic; video uses video-flow.spec.ts');

    const slug = demoDoctorSlug()!;
    const patientContext = await browser.newContext();
    const doctorContext = await browser.newContext();
    const patient = await patientContext.newPage();
    const doctor = await doctorContext.newPage();

    await signInAsPatient(patient);
    await bookFirstClinicSlot(patient, slug);

    await expect(patient.getByText(/waiting for the doctor|Pending/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await signInAsDoctor(doctor);
    await acceptFirstPendingBooking(doctor);

    const id = appointmentIdFromUrl(patient.url());
    await patient.goto(`/appointments/${id}`);
    await expect(patient.getByText(/Doctor accepted your booking|Accepted/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await patientContext.close();
    await doctorContext.close();
  });

  test('instant confirm when demo doctor is seeded with instant flag', async ({ page }) => {
    const meta = demoSeedMeta();
    test.skip(!meta?.instantConfirm, 'Run npm run db:seed:demo-doctor:instant -w backend');

    const slug = demoDoctorSlug()!;
    await signInAsPatient(page);
    await bookFirstClinicSlot(page, slug);
    await expect(page.getByText(/Accepted|confirmed/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
