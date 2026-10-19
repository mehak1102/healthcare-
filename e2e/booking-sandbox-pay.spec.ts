import { test, expect } from '@playwright/test';
import { demoPatientCredentials, signInAsPatient } from './helpers/auth';
import { bookFirstClinicSlot } from './helpers/booking';
import { demoSeedMeta } from './helpers/demo-seed';
import { demoDoctorSlug } from './helpers/doctor-slug';

const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000';

async function paymentsSandbox(): Promise<boolean> {
  try {
    const res = await fetch(`${apiURL}/api/v1/health/ready`);
    if (!res.ok) return false;
    const body = (await res.json()) as { integrations?: { payments?: string } };
    return body.integrations?.payments === 'sandbox';
  } catch {
    return false;
  }
}

const canRun =
  Boolean(demoPatientCredentials()) &&
  Boolean(demoDoctorSlug()) &&
  demoSeedMeta()?.paid === true;

test.describe('sandbox payment booking', () => {
  test.skip(!canRun, 'SEED_DEMO_PAID=true db:seed:demo-doctor + E2E_PATIENT_PASSWORD');

  test('patient pays via sandbox gateway and booking is confirmed', async ({ page }) => {
    test.skip(!(await paymentsSandbox()), 'Set PAYMENT_PROVIDER=sandbox in backend/.env and restart API');

    const meta = demoSeedMeta();
    test.skip(meta?.instantConfirm !== true, 'Paid demo seed uses instant confirm (db:seed:demo-doctor:paid)');

    const slug = demoDoctorSlug()!;
    await signInAsPatient(page);
    await bookFirstClinicSlot(page, slug);

    await expect(page.getByText(/Paid|Accepted|confirmed/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
