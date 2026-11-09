import { expect, test } from '@playwright/test';

test('the console shell loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/?paused=1');

  await expect(page).toHaveTitle(/Air Defense Simulator/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Air Defense Simulator' }),
  ).toBeVisible();

  const stages = page
    .getByRole('navigation', { name: 'Defense loop stages' })
    .getByRole('listitem');
  await expect(stages).toHaveCount(7);

  const cards = page.getByRole('list', { name: 'Air traffic you can add' }).getByRole('listitem');
  await expect(cards).toHaveCount(6);

  await expect(page.getByTestId('now-line')).toContainText('Ready. Press Play');
  await expect(page.getByRole('contentinfo')).toContainText('© 2026 Mohammad Alyounes');
  expect(errors).toEqual([]);
});

test('the header always credits the author', async ({ page }) => {
  for (const viewport of [
    { width: 1600, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const credit = page.getByRole('banner').getByTestId('author-credit');
    await expect(credit).toBeVisible();
    await expect(credit).toHaveText('Created by Mohammad Alyounes');
    await expect(credit.getByRole('link', { name: 'Mohammad Alyounes' })).toHaveAttribute(
      'href',
      'https://github.com/MohammadAlyounes',
    );
  }
});

test('the console is the finished version, with no placeholders for later steps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/?paused=1');
  const version = page.getByTestId('version-pill');
  await expect(version).toHaveText('v1.0.0 · Complete');
  await version.hover();
  await expect(page.getByRole('tooltip')).toContainText('Version 1.0.0, complete');
  await expect(page.getByText(/Arrives in|Step \d+\/\d+|Building in public/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Telemetry|Timeline/ })).toHaveCount(0);
});

test('stage chips explain themselves on hover', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-stage="track"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('filter smooths the noise');
});

test('phones get the compact header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?paused=1');
  await expect(page.getByText('Interceptors', { exact: true })).toBeHidden();
  await expect(page.getByTestId('now-line')).toBeVisible();
});
