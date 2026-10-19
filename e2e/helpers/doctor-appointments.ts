import type { Page } from '@playwright/test';

export async function acceptFirstPendingBooking(doctor: Page): Promise<void> {
  await doctor.goto('/doctor/appointments');
  const accept = doctor.getByRole('button', { name: 'Accept booking' }).first();
  await accept.waitFor({ state: 'visible', timeout: 15_000 });
  await accept.click();
  await doctor.getByText('Accepted').first().waitFor({ state: 'visible', timeout: 15_000 });
}
