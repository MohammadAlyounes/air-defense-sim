import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html[data-app-ready]')).toBeAttached();
  await expect(
    page.locator('[data-panel="battlespace"] canvas[data-rendered="true"]'),
  ).toBeVisible();
}

test('truth vs. perception: the button, the T key and a link all switch it', async ({ page }) => {
  await open(page, '/?seed=2026&t=60&paused=1&welcome=0');
  const scope = page.getByTestId('radar-scope');
  await expect(scope).toHaveAttribute('data-truth', 'off');
  await page.locator('[data-truth-toggle]').click();
  await expect(scope).toHaveAttribute('data-truth', 'on');
  await expect(page.getByText('Truth + tracks')).toBeVisible();
  await expect(page.getByText('true position')).toBeVisible();
  await page.locator('body').press('t');
  await expect(scope).toHaveAttribute('data-truth', 'off');

  await open(page, '/?seed=2026&t=60&paused=1&welcome=0&truth=1');
  await expect(scope).toHaveAttribute('data-truth', 'on');
});

test('the track table shows how sure the tracker is, and the inspector its real error', async ({
  page,
}) => {
  await open(page, '/?seed=2026&paused=1&welcome=0');
  // An airliner 25 km north, crossing: tracked for a while, never engaged.
  await page.locator('[data-traffic="airliner"]').click();
  const scope = page.getByTestId('radar-scope');
  const box = await scope.boundingBox();
  if (!box) throw new Error('no scope');
  const r = box.width / 2 - 4;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - (25 / 40) * r);
  // Run 30 simulated seconds.
  for (let i = 0; i < 30; i++) await page.keyboard.press('Shift+.');
  const table = page.getByTestId('track-table');
  await expect(table.getByText('±1σ')).toBeVisible();
  const sigma = table.locator('[data-sigma]').first();
  await expect(sigma).toContainText(/±\d+ m/);
  await table.locator('tbody tr').first().click();
  await expect(page.locator('[data-fact="Track vs truth"]')).toContainText(/m off/);
});
