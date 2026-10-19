import type { Page } from '@playwright/test';

export function demoStaffCredentials(): { email: string; password: string } | null {
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PATIENT_PASSWORD;
  if (!password) return null;
  return {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin.demo@sukoon.test',
    password,
  };
}

export function demoDoctorCredentials(): { email: string; password: string } | null {
  const password = process.env.E2E_DOCTOR_PASSWORD ?? process.env.E2E_PATIENT_PASSWORD;
  if (!password) return null;
  return {
    email: process.env.E2E_DOCTOR_EMAIL ?? 'doctor.demo@sukoon.test',
    password,
  };
}

export function demoPatientCredentials(): { email: string; password: string } | null {
  const password = process.env.E2E_PATIENT_PASSWORD;
  if (!password) return null;
  return {
    email: process.env.E2E_PATIENT_EMAIL ?? 'patient.demo@sukoon.test',
    password,
  };
}

/** Signs in through the patient portal. Requires E2E_PATIENT_PASSWORD (see e2e/env.example). */
export async function signInAsPatient(page: Page): Promise<void> {
  const creds = demoPatientCredentials();
  if (!creds) {
    throw new Error('Set E2E_PATIENT_PASSWORD (see e2e/env.example) to run signed-in browser tests.');
  }
  await page.goto('/login');
  await page.getByLabel('Patient').click();
  await page.getByLabel('Email address').fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/patient');
}

/** Signs in through the doctor portal. Uses E2E_DOCTOR_PASSWORD or E2E_PATIENT_PASSWORD. */
/** Doctor portal sign-in (separate browser context from patient). */
/** Staff / admin portal (platform_admin uses the staff login tab). */
export async function signInAsStaff(page: Page): Promise<void> {
  const creds = demoStaffCredentials();
  if (!creds) {
    throw new Error('Set E2E_PATIENT_PASSWORD (see e2e/env.example) to run staff browser tests.');
  }
  await page.goto('/login');
  await page.getByLabel('Staff / Admin').click();
  await page.getByLabel('Email address').fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/account');
}

export async function signInAsDoctor(page: Page): Promise<void> {
  const creds = demoDoctorCredentials();
  if (!creds) {
    throw new Error('Set E2E_PATIENT_PASSWORD (see e2e/env.example) to run doctor browser tests.');
  }
  await page.goto('/login');
  await page.getByLabel('Doctor').click();
  await page.getByLabel('Email address').fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/doctor');
}
