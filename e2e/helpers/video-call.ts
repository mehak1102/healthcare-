import { expect, type Page } from '@playwright/test';

export async function joinVideoFromCallPage(page: Page, callPath: string): Promise<void> {
  await page.goto(callPath);
  await page.getByRole('button', { name: /Join call|Rejoin call/ }).click();
  await expect(page.getByText(/Connecting|Connected|Reconnecting/i).first()).toBeVisible({
    timeout: 30_000,
  });
}
