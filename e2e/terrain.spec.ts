import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

test('blind zones switch on and off, and a link can open them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await open(page, '/?seed=2026&t=10&paused=1&welcome=0');
  const scope = page.getByTestId('radar-scope');
  await expect(scope).toHaveAttribute('data-coverage', '');

  await page.locator('[data-coverage-option="50"]').click();
  await expect(scope).toHaveAttribute('data-coverage', '50');
  await expect(page.getByText('blind below 50 m')).toBeVisible();
  await page.locator('[data-coverage-option="off"]').click();
  await expect(scope).toHaveAttribute('data-coverage', '');

  await open(page, '/?seed=2026&t=10&paused=1&welcome=0&coverage=300');
  await expect(scope).toHaveAttribute('data-coverage', '300');
  await expect(page.locator('[data-coverage-option="300"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(errors).toEqual([]);
});

test('the inspector says whether the radar can see the selected aircraft', async ({ page }) => {
  await open(page, '/?seed=2026&t=20&paused=1&welcome=0');
  await page.locator('[data-aircraft-label] button').first().click();
  const radarView = page.locator('[data-fact="Radar view"]');
  await expect(radarView).toBeVisible();
  await expect(radarView).toContainText(/In view|Hidden by terrain|Below the horizon|Out of range/);
});

test('placing a low flyer behind the hills warns that the terrain hides it', async ({ page }) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  // Pick up the cruise-missile-like card, then hover the scope over the masked south-west.
  await page.locator('[data-traffic="cruise"]').click();
  const scope = page.getByTestId('radar-scope');
  const box = await scope.boundingBox();
  if (!box) throw new Error('no scope');
  const r = box.width / 2 - 4;
  // 30 km out at bearing 225°: the ridges there hide it until about 7 km out.
  const k = (30 / 40) * r * Math.SQRT1_2;
  await page.mouse.move(box.x + box.width / 2 - k, box.y + box.height / 2 + k);
  await expect(page.getByTestId('placement-readout')).toBeVisible();
  await expect(page.getByTestId('placement-masked')).toContainText('Terrain hides it');
});
