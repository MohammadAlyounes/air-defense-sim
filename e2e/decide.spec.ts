import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

const log = (page: Page) => page.getByTestId('event-log');

/** Drops a fast jet 30 km north of the battery by tapping its card, then the scope. */
async function dropJetNorth(page: Page) {
  await page.locator('[data-traffic="jet"]').click();
  const box = await page.getByTestId('radar-scope').boundingBox();
  if (!box) throw new Error('scope not visible');
  await page.mouse.click(
    box.x + box.width / 2,
    box.y + box.height / 2 - (30 / 40) * (box.width / 2 - 4),
  );
}

test('the rule badges cycle and are logged', async ({ page }) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  const wcs = page.getByTestId('wcs');
  await expect(wcs).toHaveText('WCS TIGHT');
  await wcs.click();
  await expect(wcs).toHaveText('WCS FREE');
  await expect(log(page)).toContainText('Rules changed: weapons FREE');
  await wcs.click();
  await expect(wcs).toHaveText('WCS HOLD');
  const mode = page.getByTestId('operator-mode');
  await expect(mode).toHaveText('AUTO');
  await mode.click();
  await expect(mode).toHaveText('SEMI-AUTO');
});

test('in SEMI-AUTO the operator approves the shot', async ({ page }) => {
  await open(page, '/?seed=2026&t=40&paused=1&welcome=0');
  await page.getByTestId('operator-mode').click();
  await dropJetNorth(page);
  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  const card = page.getByTestId('approval-card');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/Fire at T\d+\?/);
  await expect(card).toContainText(/chance of a kill \d+%/);
  await page.getByTestId('approve').click();
  await expect(log(page)).toContainText(/Operator approved the shot at T\d+/);
  await expect(log(page)).toContainText(/I\d+ launched at T\d+/, { timeout: 10_000 });
});

test('the inspector explains why, and the envelope dome toggles', async ({ page }) => {
  await open(page, '/?seed=2026&t=40&paused=1&welcome=0');
  await dropJetNorth(page);
  // 20 simulated seconds: identified hostile and engaged.
  for (let i = 0; i < 20; i++) await page.keyboard.press('Shift+.');
  await page.getByTestId('track-table').locator('tbody tr').first().click();
  const why = page.getByTestId('why');
  await expect(why).toBeVisible();
  await expect(why).toContainText(/Hostile: no answer to 2 identification checks/);
  await expect(why).toContainText(/Threat to the battery/);

  const envelope = page.locator('[data-envelope-toggle]');
  await envelope.click();
  await expect(envelope).toHaveAttribute('aria-pressed', 'true');
});
