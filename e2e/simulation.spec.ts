import { expect, test, type Page } from '@playwright/test';

const tick = async (page: Page) =>
  Number(await page.getByTestId('sim-clock').getAttribute('data-tick'));

/** Opens the app and waits until it listens to the keyboard. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
}

test('play, pause and step control the simulation clock', async ({ page }) => {
  await open(page, '/?paused=1');
  const clock = page.getByTestId('sim-clock');
  await expect(clock).toHaveAttribute('data-tick', '0');

  const step = page.getByRole('button', { name: 'Step forward' });
  for (let i = 0; i < 5; i++) await step.click();
  await expect(clock).toHaveAttribute('data-tick', '5'); // five 20 ms ticks
  await expect(clock).toHaveText('T+00:00.1');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => tick(page)).toBeGreaterThan(60);

  await page.getByRole('button', { name: 'Pause' }).click();
  const pausedAt = await tick(page);
  await page.waitForTimeout(400);
  expect(await tick(page)).toBe(pausedAt);
});

test('keyboard shortcuts drive playback', async ({ page }) => {
  await open(page, '/?paused=1');

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  await page.keyboard.press('+');
  await expect(page.getByTestId('sim-speed')).toHaveText('2×');
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await expect(page.getByTestId('sim-speed')).toHaveText('½×');

  const before = await tick(page);
  await page.keyboard.press('Shift+Period'); // one simulated second
  await expect.poll(() => tick(page)).toBe(before + 50);
});

test('the radar paints contacts and logs them', async ({ page }) => {
  await open(page, '/?t=20&paused=1');
  const detect = page.locator('[data-stage="detect"]');
  await expect.poll(async () => Number(await detect.getAttribute('data-count'))).toBeGreaterThan(0);
  await expect(page.getByTestId('event-log')).toContainText('RADAR');
  await expect(page.getByTestId('event-log')).toContainText(/New contact T\d+ at bearing/);
  await expect(page.getByTestId('now-line')).toContainText('Paused at T+00:20.0');
});

test('restarting with the same seed replays the run exactly', async ({ page }) => {
  await open(page, '/?paused=1');
  const log = page.getByTestId('event-log');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+Period');
  await expect.poll(() => tick(page)).toBe(400);
  const firstRun = await log.innerText();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByTestId('sim-clock')).toHaveAttribute('data-tick', '0');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+Period');
  await expect.poll(() => tick(page)).toBe(400);
  expect(firstRun).toMatch(/New contact T\d+ at bearing/);
  expect(await log.innerText()).toBe(firstRun);

  await page.getByRole('button', { name: 'New seed' }).click();
  await expect(page.getByTestId('sim-seed')).not.toHaveText('2026');
});

test('concept cards open next to the features they explain', async ({ page }) => {
  await open(page, '/?paused=1');
  await page.getByRole('button', { name: 'How the simulation clock works' }).click();
  await expect(page.getByRole('dialog')).toContainText('Fixed time step');
  await expect(page.getByRole('dialog')).toContainText('20 ms ticks');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Why radar blips jump instead of gliding' }).click();
  await expect(page.getByRole('dialog')).toContainText('Antenna rotation');
});
