import { expect, test } from '@playwright/test';
import { signInAsStaff } from './helpers/auth';

test.describe('operations dashboard', () => {
  test('loads summary for staff with operations access', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/ops');
    await expect(page.getByRole('heading', { name: 'Today at a glance' })).toBeVisible();
    await expect(page.getByText('Awaiting doctor response')).toBeVisible();
    await expect(page.getByText('Home visits: pilot only')).toBeVisible();
  });
});
