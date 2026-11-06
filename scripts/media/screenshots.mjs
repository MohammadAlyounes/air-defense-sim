// Captures screenshots of the production build with Playwright, for the README build log.
//
//   npm run build && npm run media:screenshots -- --name step-01-sim-core --query "seed=2026&t=75&paused=1"
//
// Output: docs/media/<name>.png (desktop) and docs/media/<name>-mobile.png (phone).
// `--query` is passed to the app (see src/app/sim/params.ts): pausing at a fixed simulated
// time with a fixed seed makes the screenshots repeatable.
import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { waitForApp } from './wait-for-app.mjs';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'console' },
    out: { type: 'string', default: 'docs/media' },
    port: { type: 'string', default: '4174' },
    query: { type: 'string', default: '' },
  },
});

const SHOTS = [
  { suffix: '', viewport: { width: 1600, height: 1000 }, scale: 1 },
  { suffix: '-mobile', viewport: { width: 390, height: 844 }, scale: 2 },
];

const server = await preview({
  preview: { port: Number(values.port), strictPort: true },
  logLevel: 'warn',
});
const base = server.resolvedUrls?.local[0] ?? `http://localhost:${values.port}/`;
const url = values.query ? `${base}?${values.query}` : base;
const browser = await chromium.launch();

try {
  await mkdir(values.out, { recursive: true });
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      // Freezes CSS animations so screenshots are repeatable.
      reducedMotion: 'reduce',
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await waitForApp(page);
    await page.waitForTimeout(300); // let the scope and the 3D view draw a few frames
    const path = `${values.out}/${values.name}${shot.suffix}.png`;
    await page.screenshot({ path });
    console.log(`saved ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
