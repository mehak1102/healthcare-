import { test, expect } from '@playwright/test';

test.describe('public site', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('trust');
    await expect(page.getByRole('link', { name: 'Create your free account' })).toBeVisible();
  });

  test('doctor directory loads', async ({ page }) => {
    await page.goto('/doctors');
    await expect(page.getByRole('heading', { name: 'Doctors you can trust' })).toBeVisible();
  });

  test('directory booking filters from URL', async ({ page }) => {
    await page.goto('/doctors?takingBookings=1&hasOpenSlots=1');
    await expect(page.getByRole('heading', { name: 'Doctors you can trust' })).toBeVisible();
    await expect(page.getByLabel('Taking new bookings')).toBeChecked();
    await expect(page.getByLabel('Has open slots (30 days)')).toBeChecked();
  });

  test('directory weekend filter from URL', async ({ page }) => {
    await page.goto('/doctors?availWhen=weekend&takingBookings=1');
    await expect(page.getByLabel('Available when')).toHaveValue('weekend');
  });

  test('directory today filter from URL', async ({ page }) => {
    await page.goto('/doctors?availWhen=today&takingBookings=1');
    await expect(page.getByLabel('Available when')).toHaveValue('today');
  });

  test('directory fee band and sort from URL', async ({ page }) => {
    await page.goto('/doctors?feeBand=free&sort=next_available');
    await expect(page.getByLabel('Consultation fee')).toHaveValue('free');
    await expect(page.getByLabel('Sort by')).toHaveValue('next_available');
  });

  test('home available-now link opens directory filters', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Available now' }).click();
    await expect(page).toHaveURL(/\/doctors\?/);
    await expect(page.getByLabel('Available when')).toHaveValue('today');
    await expect(page.getByLabel('Taking new bookings')).toBeChecked();
    await expect(page.getByLabel('Sort by')).toHaveValue('next_available');
  });

  test('public holidays calendar API is reachable from the web app', async ({ request }) => {
    const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000';
    const res = await request.get(`${apiURL}/api/v1/calendar/public-holidays?from=2026-10-01&days=10`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.some((row: { date: string }) => row.date === '2026-10-02')).toBe(true);
  });

  test('home visit status API reports not open', async ({ request }) => {
    const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000';
    const res = await request.get(`${apiURL}/api/v1/home-visits/status`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.pilot.pinCodeLookup).toBe(true);
  });

  test('doctor at home page is honest about booking', async ({ page }) => {
    await page.goto('/doctor-at-home');
    await expect(page.getByRole('heading', { name: 'Doctor at home' })).toBeVisible();
    await expect(page.getByText('Not open for booking')).toBeVisible();
  });

  test('home tonight link opens directory filters', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Tonight' }).click();
    await expect(page).toHaveURL(/availWhen=tonight/);
    await expect(page.getByLabel('Available when')).toHaveValue('tonight');
  });

  test('home public holiday link opens directory filters', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Public holiday' }).click();
    await expect(page).toHaveURL(/availWhen=public_holiday/);
    await expect(page.getByLabel('Available when')).toHaveValue('public_holiday');
  });

  test('home home visit link opens info page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Home visit' }).click();
    await expect(page).toHaveURL(/\/doctor-at-home/);
  });

  test('online consultation page loads', async ({ page }) => {
    await page.goto('/online-consultation');
    await expect(page.getByRole('heading', { name: 'Online consultation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Doctors offering video' })).toBeVisible();
  });

  test('sign-in form loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });
});
