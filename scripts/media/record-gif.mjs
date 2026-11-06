// Records a short GIF of one part of the running app (Playwright video + ffmpeg).
//
//   npm run build && npm run media:gif -- --name step-01-sim-core \
//     --query "seed=2026&t=30&speed=4" --selector '[data-panel="scope"]' --seconds 8
//
// Output: docs/media/<name>.gif. Needs ffmpeg on the PATH.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'clip' },
    out: { type: 'string', default: 'docs/media' },
    query: { type: 'string', default: '' },
    selector: { type: 'string', default: 'body' },
    seconds: { type: 'string', default: '8' },
    fps: { type: 'string', default: '15' },
    width: { type: 'string', default: '' },
    port: { type: 'string', default: '4175' },
  },
});

const viewport = { width: 1600, height: 1000 };
const seconds = Number(values.seconds);
const videoDir = await mkdtemp(join(tmpdir(), 'adsim-gif-'));

const server = await preview({
  preview: { port: Number(values.port), strictPort: true },
  logLevel: 'warn',
});
const base = server.resolvedUrls?.local[0] ?? `http://localhost:${values.port}/`;
const url = values.query ? `${base}?${values.query}` : base;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videoDir, size: viewport },
  });
  const page = await context.newPage();
  const openedAt = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const box = await page.locator(values.selector).boundingBox();
  if (!box) throw new Error(`Nothing matches ${values.selector}`);
  const leadInS = (Date.now() - openedAt) / 1000 + 0.5; // skip the page load
  await page.waitForTimeout(seconds * 1000 + 700);
  const video = page.video();
  await context.close();
  const videoPath = await video.path();

  const even = (n) => Math.floor(n / 2) * 2;
  const crop = `crop=${even(box.width)}:${even(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  const scale = values.width ? `,scale=${values.width}:-1:flags=lanczos` : '';
  const filters = `${crop},fps=${values.fps}${scale},split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  const output = `${values.out}/${values.name}.gif`;
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    leadInS.toFixed(2),
    '-t',
    String(seconds),
    '-i',
    videoPath,
    '-vf',
    filters,
    '-loop',
    '0',
    output,
  ]);
  console.log(`saved ${output}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
  await rm(videoDir, { recursive: true, force: true });
}
