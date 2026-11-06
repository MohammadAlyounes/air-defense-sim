// Records a short GIF of one part of the running app (Playwright video + ffmpeg).
//
//   npm run build && npm run media:gif -- --name step-01-sim-core \
//     --query "seed=2026&t=30&speed=4" --selector '[data-panel="scope"]' --seconds 8
//
// The clip is cropped to the element(s) matching `--selector` (the box around all of them).
//
// `--actions` scripts the clip: a JSON list of steps at given seconds into the recording,
// each pressing a key or clicking an element, e.g.
//   --actions '[{"at":2,"click":"[data-aircraft-label] button"},{"at":4,"key":"3"}]'
//
// Output: docs/media/<name>.gif, or <name>.webp with `--format webp`: an animated WebP is
// several times smaller than a GIF when most of the picture moves (a 3D camera, say), and
// browsers play it like a GIF. Needs ffmpeg on the PATH (built with libwebp for WebP).
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { waitForApp } from './wait-for-app.mjs';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'clip' },
    out: { type: 'string', default: 'docs/media' },
    query: { type: 'string', default: '' },
    selector: { type: 'string', default: 'body' },
    seconds: { type: 'string', default: '8' },
    fps: { type: 'string', default: '15' },
    colors: { type: 'string', default: '96' },
    // 'none' compresses much better when most of the frame moves (a 3D camera, for example).
    dither: { type: 'string', default: 'bayer:bayer_scale=5' },
    format: { type: 'string', default: 'gif' },
    quality: { type: 'string', default: '75' },
    width: { type: 'string', default: '' },
    port: { type: 'string', default: '4175' },
    actions: { type: 'string', default: '[]' },
  },
});

const viewport = { width: 1600, height: 1000 };
const seconds = Number(values.seconds);
const actions = JSON.parse(values.actions).sort((a, b) => a.at - b.at);
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
  await waitForApp(page);
  // A selector may match several elements (e.g. three panels): crop to the box around them all.
  const boxes = (
    await Promise.all((await page.locator(values.selector).all()).map((el) => el.boundingBox()))
  ).filter(Boolean);
  if (boxes.length === 0) throw new Error(`Nothing matches ${values.selector}`);
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const box = {
    x: left,
    y: top,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
  };
  await page.waitForTimeout(500);
  const leadInS = (Date.now() - openedAt) / 1000; // skip the page load
  const startedAt = Date.now();
  for (const action of actions) {
    await page.waitForTimeout(Math.max(0, action.at * 1000 - (Date.now() - startedAt)));
    if (action.key) await page.keyboard.press(action.key);
    // Forced: aircraft tags move every frame, so they never look "stable" to Playwright.
    if (action.click) await page.locator(action.click).first().click({ force: true });
  }
  await page.waitForTimeout(Math.max(0, seconds * 1000 + 700 - (Date.now() - startedAt)));
  const video = page.video();
  await context.close();
  const videoPath = await video.path();

  const even = (n) => Math.floor(n / 2) * 2;
  const crop = `crop=${even(box.width)}:${even(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  const scale = values.width ? `,scale=${values.width}:-1:flags=lanczos` : '';
  const frames = `${crop},fps=${values.fps}${scale}`;
  const encode =
    values.format === 'webp'
      ? ['-vf', frames, '-c:v', 'libwebp_anim', '-q:v', values.quality, '-an']
      : [
          '-vf',
          `${frames},split[a][b];[a]palettegen=max_colors=${values.colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${values.dither}:diff_mode=rectangle`,
        ];
  const output = `${values.out}/${values.name}.${values.format === 'webp' ? 'webp' : 'gif'}`;
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
    ...encode,
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
