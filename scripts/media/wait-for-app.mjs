// Waits until the app listens to input and, when the page has a 3D view, until it has drawn.
export async function waitForApp(page) {
  await page.locator('html[data-app-ready]').waitFor({ state: 'attached', timeout: 20_000 });
  if (await page.locator('[data-panel="battlespace"]').count()) {
    await page.locator('canvas[data-rendered="true"]').waitFor({ timeout: 30_000 });
  }
}
