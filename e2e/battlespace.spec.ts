import { expect, test, type Page } from '@playwright/test';
import { Simulation, TICK_S } from '../src/sim';

/** The run the page shows for `?seed=2026&t=20`, computed here with the same simulation core. */
function runAt(seconds: number) {
  const sim = new Simulation({ seed: 2026 });
  sim.run(Math.round(seconds / TICK_S));
  return sim.snapshot();
}

const QUIET = '/?seed=2026&t=20&paused=1&welcome=0';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

/** Aircraft name tags: mouse conveniences, hidden from assistive technology (hence CSS). */
const tagButton = (page: Page) => page.locator('[data-aircraft-label] button').first();

const camera = (page: Page, id: string) => page.locator(`[data-camera="${id}"]`);

test('the 3D view renders and greets first-time visitors once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await open(page, '/?paused=1');
  const welcome = page.getByTestId('welcome-card');
  await expect(welcome).toContainText('See how an air-defense system thinks.');
  await welcome.getByRole('button', { name: 'Start exploring' }).click();
  await expect(welcome).toBeHidden();

  await open(page, '/?paused=1');
  await expect(page.getByTestId('welcome-card')).toBeHidden();
  expect(errors).toEqual([]);
});

test('selecting an aircraft in 3D selects it on the scope and in the inspector', async ({
  page,
}) => {
  await open(page, QUIET);
  const id = await page
    .locator('[data-aircraft-label]')
    .first()
    .getAttribute('data-aircraft-label');
  expect(id).toBeTruthy();
  await tagButton(page).click();

  await expect(page.getByTestId('inspector')).toHaveAttribute('data-aircraft', id ?? '');
  await expect(page.getByTestId('radar-scope')).toHaveAttribute('data-selected', id ?? '');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inspector')).toBeHidden();
  await expect(page.getByTestId('radar-scope')).toHaveAttribute('data-selected', '');
});

test('clicking an echo on the radar scope selects the aircraft behind it', async ({ page }) => {
  const snapshot = runAt(20);
  const echo = snapshot.plots.at(-1); // the newest, brightest echo
  if (!echo) throw new Error('expected the radar to have painted something by t = 20 s');

  await open(page, QUIET);
  const scope = page.getByTestId('radar-scope');
  const box = await scope.boundingBox();
  if (!box) throw new Error('scope not visible');
  // Same geometry as the scope: centre, 4 px margin, north up.
  const scale = (box.width / 2 - 4) / snapshot.radar.rangeM;
  await scope.click({
    position: {
      x: box.width / 2 + echo.position.x * scale,
      y: box.height / 2 - echo.position.y * scale,
    },
  });

  await expect(page.getByTestId('inspector')).toHaveAttribute(
    'data-aircraft',
    String(echo.truthId),
  );
  await expect(scope).toHaveAttribute('data-selected', String(echo.truthId));
});

test('event log lines select their aircraft', async ({ page }) => {
  await open(page, QUIET);
  const line = page.getByTestId('event-log').getByRole('button').first();
  await line.click();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(line).toHaveAttribute('aria-current', 'true');
});

test('camera presets switch, and following needs a selected aircraft', async ({ page }) => {
  await open(page, QUIET);
  await expect(camera(page, 'orbit')).toHaveAttribute('aria-pressed', 'true');
  await expect(camera(page, 'follow')).toHaveAttribute('aria-disabled', 'true');

  await page.keyboard.press('2');
  await expect(camera(page, 'top')).toHaveAttribute('aria-pressed', 'true');

  await tagButton(page).click();
  await camera(page, 'follow').click();
  await expect(camera(page, 'follow')).toHaveAttribute('aria-pressed', 'true');

  // Clearing the selection leaves nothing to follow: back to the orbit camera.
  await page.getByRole('button', { name: 'Clear the selection' }).click();
  await expect(camera(page, 'orbit')).toHaveAttribute('aria-pressed', 'true');
});

test('heights stretch on demand and labels toggle', async ({ page }) => {
  await open(page, QUIET);
  const heights4 = page.getByRole('button', { name: 'Heights ×4' });
  await heights4.click();
  await expect(heights4).toHaveAttribute('aria-pressed', 'true');

  await expect(page.locator('[data-aircraft-label]').first()).toBeAttached();
  await page.keyboard.press('l');
  await expect(page.locator('[data-aircraft-label]')).toHaveCount(0);
  await page.keyboard.press('l');
  await expect(page.locator('[data-aircraft-label]').first()).toBeAttached();
});

test('a link can open a particular view', async ({ page }) => {
  const id = runAt(20).aircraft[0]?.id;
  await open(page, `${QUIET}&select=${id}&camera=follow&heights=4`);
  await expect(page.getByTestId('inspector')).toHaveAttribute('data-aircraft', String(id));
  await expect(camera(page, 'follow')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Heights ×4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
