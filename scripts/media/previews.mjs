// Renders the social preview card (scripts/media/preview-card.html) to PNG.
//
//   npm run media:previews
//
// - public/og-image.png         1200x627, used in <meta property="og:image"> (link previews)
// - docs/media/social-preview.png 1280x640, upload in GitHub: Settings -> General -> Social preview
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const TEMPLATE = new URL('./preview-card.html', import.meta.url).href;
const TARGETS = [
  { path: 'public/og-image.png', width: 1200, height: 627 },
  { path: 'docs/media/social-preview.png', width: 1280, height: 640 },
];

const browser = await chromium.launch();
try {
  for (const target of TARGETS) {
    await mkdir(dirname(target.path), { recursive: true });
    const page = await browser.newPage({
      viewport: { width: target.width, height: target.height },
    });
    await page.goto(TEMPLATE, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: target.path });
    console.log(`saved ${target.path} (${target.width}x${target.height})`);
    await page.close();
  }
} finally {
  await browser.close();
}
