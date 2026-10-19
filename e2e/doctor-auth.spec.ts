import { test, expect } from '@playwright/test';
import { demoDoctorCredentials, signInAsDoctor } from './helpers/auth';

test.describe('doctor sign-in', () => {
  test.skip(!demoDoctorCredentials(), 'Set E2E_PATIENT_PASSWORD to run (see e2e/env.example)');

  test('demo doctor reaches the practice dashboard', async ({ page }) => {
    await signInAsDoctor(page);
    await expect(page.getByRole('heading', { name: 'Your practice' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consultation setup' })).toBeVisible();
    await expect(page.getByText('Home visits ·')).toBeVisible();
  });

  test('published demo doctor sees directory links', async ({ page }) => {
    await signInAsDoctor(page);
    const publicProfile = page.getByRole('link', { name: 'View your public profile' });
    const directory = page.getByRole('link', { name: 'See the public doctor directory' });
    if (await publicProfile.isVisible()) {
      await expect(directory).toBeVisible();
      await expect(page.getByText('Next bookable day ·')).toBeVisible();
    }
  });
});
