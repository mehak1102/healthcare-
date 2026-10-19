import type { Page } from '@playwright/test';

/** Picks the first day with slots, first time, and submits the booking form. */
export async function bookFirstClinicSlot(page: Page, slug: string): Promise<void> {
  await page.goto(`/doctors/${slug}`);
  await page.getByRole('group', { name: 'Days' }).waitFor({ state: 'visible', timeout: 15_000 });

  const dayWithSlots = page
    .getByRole('group', { name: 'Days' })
    .getByRole('button')
    .filter({ hasText: /slot/ })
    .first();
  await dayWithSlots.click();

  const timeButton = page.getByRole('group', { name: 'Times' }).getByRole('button').first();
  await timeButton.click();

  const bookButton = page.getByRole('button', { name: /Book (free consultation|and pay)/ });
  await bookButton.click();
  await page.waitForURL(/\/appointments\/[^/]+$/);
}

/** Books the first available **video** slot (demo doctor must offer online hours). */
export async function bookFirstVideoSlot(page: Page, slug: string): Promise<void> {
  await page.goto(`/doctors/${slug}`);
  await page.getByRole('group', { name: 'Days' }).waitFor({ state: 'visible', timeout: 15_000 });

  const videoFilter = page.getByRole('button', { name: 'Video consultation', exact: false });
  if (await videoFilter.isVisible().catch(() => false)) {
    await videoFilter.click();
  }

  const dayWithSlots = page
    .getByRole('group', { name: 'Days' })
    .getByRole('button')
    .filter({ hasText: /slot/ })
    .first();
  await dayWithSlots.click();

  const timeButton = page.getByRole('group', { name: 'Times' }).getByRole('button').first();
  await timeButton.click();

  const bookButton = page.getByRole('button', { name: /Book (free consultation|and pay)/ });
  await bookButton.click();
  await page.waitForURL(/\/appointments\/[^/]+$/);
}

export function appointmentIdFromUrl(url: string): string {
  const match = url.match(/\/appointments\/([^/?#]+)/);
  if (!match) throw new Error(`Not on an appointment page: ${url}`);
  return match[1];
}
