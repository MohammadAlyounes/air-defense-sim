import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

test("the scope shows the run's wind, and the inspector what it does to a drone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Seed 2026, 75 s in: aircraft 1 is a drone flying south-east into a south wind.
  await open(page, '/?seed=2026&t=75&paused=1&welcome=0&select=1');
  const wind = page.getByTestId('wind');
  await expect(wind).toContainText('8 m/s');
  await expect(wind).toHaveAttribute('data-wind-toward', '2');

  const inspector = page.getByTestId('inspector');
  await expect(inspector.locator('[data-fact="Wind"]')).toContainText('Headwind');
  await expect(inspector.locator('[data-fact="Wind"]')).toContainText('airspeed 40 m/s');
  await expect(inspector.locator('[data-fact="Heading"]')).toContainText('track 147°');
  await expect(inspector.locator('[data-fact="Flight"]')).toContainText('Turns on 233 m');
  await expect(inspector.locator('[data-fact="Doppler"]')).toContainText(/Closing \d+ m\/s/);
  await expect(inspector.locator('[data-fact="Doppler"]')).toContainText('clear of the notch');
  expect(errors).toEqual([]);
});

test('the clutter overlay shades the ground the radar lights', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, '/?seed=2026&t=10&paused=1&welcome=0');
  const scope = page.getByTestId('radar-scope');
  await page.locator('[data-coverage-option="clutter"]').click();
  await expect(scope).toHaveAttribute('data-coverage', 'clutter');
  await expect(page.getByText('lit ground (clutter)')).toBeVisible();
  // Its concept card replaces the terrain masking one while it is on.
  const card = page.getByRole('button', {
    name: 'Why slow and crossing targets vanish over lit ground',
  });
  await card.click();
  await expect(page.getByRole('dialog')).toContainText('Clutter and Doppler');

  await open(page, '/?seed=2026&t=10&paused=1&welcome=0&coverage=clutter');
  await expect(scope).toHaveAttribute('data-coverage', 'clutter');
  expect(errors).toEqual([]);
});

test('placing a cruise-missile-like target far out shows its dog-leg', async ({ page }) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  await page.locator('[data-traffic="cruise"]').click();
  const scope = page.getByTestId('radar-scope');
  const box = await scope.boundingBox();
  if (!box) throw new Error('no scope');
  // 30 km due north: long enough for a dog-leg (three 5.9 km turn radii).
  const r = box.width / 2 - 4;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - (30 / 40) * r);
  await expect(page.getByTestId('placement-readout')).toContainText(
    'Flies a dog-leg and reaches the battery',
  );
  // A drone flies straight in.
  await page.keyboard.press('Escape');
  await page.locator('[data-traffic="drone"]').click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - (20 / 40) * r);
  await expect(page.getByTestId('placement-readout')).toContainText('Reaches the battery');
});
