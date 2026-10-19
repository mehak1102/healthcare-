import { test, expect } from '@playwright/test';
import { demoPatientCredentials, signInAsPatient } from './helpers/auth';

test.describe('patient sign-in', () => {
  test.skip(!demoPatientCredentials(), 'Set E2E_PATIENT_PASSWORD to run (see e2e/env.example)');

  test('demo patient reaches the dashboard', async ({ page }) => {
    await signInAsPatient(page);
    await expect(page.getByRole('heading', { name: 'Your care' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a doctor' })).toBeVisible();
  });

  test('signed-in patient can open appointments list', async ({ page }) => {
    await signInAsPatient(page);
    await page.getByRole('link', { name: 'All appointments' }).click();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.getByRole('heading', { name: 'Your appointments' })).toBeVisible();
  });
});
