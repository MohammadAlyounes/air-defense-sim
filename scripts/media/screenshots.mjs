// Captures screenshots of the production build with Playwright, for the README build log.
//
//   npm run build && npm run media:screenshots -- --name step-00-launchpad
//
// Output: docs/media/<name>.png (desktop) and docs/media/<name>-mobile.png (phone).
import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'console' },
    out: { type: 'string', default: 'docs/media' },
    port: { type: 'string', default: '4174' },
  },
});

const SHOTS = [
  { suffix: '', viewport: { width: 1600, height: 1000 }, scale: 1, fullPage: false },
  { suffix: '-mobile', viewport: { width: 390, height: 844 }, scale: 2, fullPage: false },
];

const server = await preview({
  preview: { port: Number(values.port), strictPort: true },
  logLevel: 'warn',
});
const url = server.resolvedUrls?.local[0] ?? `http://localhost:${values.port}/`;
const browser = await chromium.launch();

try {
  await mkdir(values.out, { recursive: true });
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      // Freezes CSS animations (e.g. the radar sweep) so screenshots are repeatable.
      reducedMotion: 'reduce',
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const path = `${values.out}/${values.name}${shot.suffix}.png`;
    await page.screenshot({ path, fullPage: shot.fullPage });
    console.log(`saved ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
