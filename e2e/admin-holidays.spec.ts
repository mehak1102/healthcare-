import { test, expect } from '@playwright/test';
import { demoStaffCredentials, signInAsStaff } from './helpers/auth';

test.describe('admin public holidays', () => {
  test.skip(!demoStaffCredentials(), 'Set E2E_PATIENT_PASSWORD and run db:seed (see e2e/env.example)');

  test('platform admin can open the holidays page', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/admin/public-holidays');
    await expect(page.getByRole('heading', { name: 'India public holidays' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a holiday' })).toBeVisible();
    await expect(page.getByLabel('Region')).toBeVisible();
  });
});
