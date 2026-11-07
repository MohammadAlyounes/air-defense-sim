import { expect, test, type Page } from '@playwright/test';

/** Opens the app and waits until it listens to input and the 3D view has drawn. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

const log = (page: Page) => page.getByTestId('event-log');
const stageCount = async (page: Page, stage: string) =>
  Number(await page.locator(`[data-stage="${stage}"]`).getAttribute('data-count'));

/** Where a ground point (metres east and north) appears on the scope, in page pixels. */
async function onScope(page: Page, eastM: number, northM: number) {
  const box = await page.getByTestId('radar-scope').boundingBox();
  if (!box) throw new Error('scope not visible');
  const scale = (box.width / 2 - 4) / 40_000;
  return {
    x: box.x + box.width / 2 + eastM * scale,
    y: box.y + box.height / 2 - northM * scale,
  };
}

test('a threat dragged onto the map is detected, engaged and destroyed', async ({ page }) => {
  // Seed 2026, 40 s in: the opening jet is already down and the sky is quiet.
  await open(page, '/?seed=2026&t=40&paused=1&welcome=0');
  const card = await page.locator('[data-traffic="cruise"]').boundingBox();
  if (!card) throw new Error('palette card not visible');
  const drop = await onScope(page, 14_000, 2_000);

  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 15 });
  await expect(page.getByTestId('placement-readout')).toContainText('Cruise-missile-like');
  await page.mouse.up();
  await expect(log(page)).toContainText('A cruise-missile-like target enters 14 km to the east.');

  // Let the loop run at 8×: first echo, track, identification, launch, intercept, assessment.
  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Faster' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(log(page)).toContainText(/I\d+ launched at T\d+/, { timeout: 20_000 });
  const card2 = page.getByTestId('result-card').filter({ hasText: 'cruise-missile-like target' });
  await expect(card2).toBeVisible({ timeout: 20_000 });
  await expect(card2).toContainText('Threat destroyed');
  await expect(log(page)).toContainText('Kill assessed');
});

test('the analysis bar counts each stage of the loop', async ({ page }) => {
  // The opening jet: assigned at 8.2 s, interceptor in flight from 9.7 s.
  await open(page, '/?seed=2026&t=15&paused=1&welcome=0');
  for (const stage of ['detect', 'track', 'identify', 'evaluate', 'assign', 'engage']) {
    expect(await stageCount(page, stage)).toBeGreaterThanOrEqual(1);
  }
  expect(await stageCount(page, 'assess')).toBe(0);
  await expect(page.getByTestId('now-line')).toContainText(
    /Engaging T\d+: interceptor I1 in flight/,
  );
});

test('keyboard placement: Enter picks a card up, Enter again places it 30 km out', async ({
  page,
}) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  const drone = page.locator('[data-traffic="drone"]');
  await drone.focus();
  await page.keyboard.press('Enter');
  await expect(drone).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(log(page)).toContainText('A small drone enters 30 km to the north-east.');
  await expect(drone).toHaveAttribute('aria-pressed', 'false');

  // Escape puts a picked-up card back.
  await page.locator('[data-traffic="jet"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-traffic="jet"]')).toHaveAttribute('aria-pressed', 'false');
});

test('tap a card, then tap the scope: the threat appears where you tapped', async ({ page }) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  await page.locator('[data-traffic="jet"]').click();
  await expect(page.getByText('Placing: Fast jet.')).toBeVisible();
  const spot = await onScope(page, 0, -25_000);
  await page.mouse.click(spot.x, spot.y);
  await expect(log(page)).toContainText('A fast jet enters 25 km to the south.');
  await expect(page.getByText('Placing: Fast jet.')).toBeHidden();
});
