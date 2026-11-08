import { expect, test, type Page } from '@playwright/test';

/** Two airliners in their corridors, a friendly, a hostile drone and a suspect cruise target. */
const BUSY = '/?seed=2027&t=150&paused=1&welcome=0';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

test('the console shows suspect tracks and the civil corridors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, BUSY);

  const legend = page.locator('[data-panel="scope"] ul');
  for (const item of ['hostile', 'suspect', 'unknown', 'friend', 'civil', 'civil corridor']) {
    await expect(legend.getByText(item, { exact: true })).toBeVisible();
  }
  const table = page.getByTestId('track-table');
  await expect(table.getByText('suspect', { exact: true })).toBeVisible();
  await expect(page.getByTestId('event-log')).toContainText(
    'is suspect: no answer to identification check 1, and it flies like a cruise missile.',
  );
  // The corridors are named in the 3D view too.
  await expect(page.getByText('North corridor · 8–13 km')).toBeAttached();
  expect(errors).toEqual([]);
});

test('the inspector says what a track flies like and why that matters', async ({ page }) => {
  // Aircraft 6 is the cruise-missile-like target, aircraft 4 an airliner in the north corridor.
  await open(page, `${BUSY}&select=6`);
  const inspector = page.getByTestId('inspector');
  await expect(inspector.locator('[data-fact="Classifier"]')).toContainText(
    'Flies like a cruise missile',
  );
  await expect(page.getByTestId('why')).toContainText(
    'Suspect: no answer to 1 identification check, and it flies like a cruise missile',
  );

  await open(page, `${BUSY}&select=4`);
  await expect(inspector.locator('[data-fact="Classifier"]')).toContainText(
    'Flies like an airliner · North corridor',
  );

  await page.getByRole('button', { name: 'How the battery tells friend from foe' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Identification friend-or-foe');
});

test('an airliner placed by hand joins the nearest civil corridor', async ({ page }) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  await page.locator('[data-traffic="airliner"]').click();
  const scope = page.getByTestId('radar-scope');
  const box = await scope.boundingBox();
  if (!box) throw new Error('no scope');
  // 11 km north-east of the battery, 8 km south of the north corridor.
  const r = box.width / 2 - 4;
  const k = (8 / 40) * r;
  await page.mouse.move(box.x + box.width / 2 + k, box.y + box.height / 2 - k);
  const readout = page.getByTestId('placement-readout');
  await expect(readout).toContainText(/Joins the North corridor in \d+ s and flies it out/);
  await expect(readout).toContainText('the radar sees it at once');
  await expect(page.getByTestId('placement-masked')).toHaveCount(0);
});
