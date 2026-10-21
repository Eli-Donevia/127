#!/usr/bin/env node
// Renders the Store's website templates into real thumbnails: each site item's sample page
// (content/templates/files/<id>/preview.html) shot at a desktop and a phone size, saved as
// content/store-thumbs/<id>/desk.jpg and phone.jpg, which the Store's cards and item pages show
// (lib/store-covers.js). Run it again after a site design or its sample page changes, and commit the
// images. content/store-thumbs/ sits outside content/templates/ because scripts/sync-templates.js
// clears templates/files on every sync.
//
//   node scripts/store-thumbs.js              every site item
//   node scripts/store-thumbs.js site-agency  just these
//
// Needs Playwright and a Chromium on the machine running it (not a site dependency): set
// PLAYWRIGHT_MODULE to its path and CHROMIUM_PATH to the browser if they aren't found.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'store-thumbs');
const SHOTS = [
  // The page laid out at a real desktop and phone width, saved smaller (scale) so a card loads fast:
  // desk.jpg 1080x675, phone.jpg 585x1266.
  { name: 'desk', width: 1440, height: 900, scale: 0.75 },
  { name: 'phone', width: 390, height: 844, scale: 1.5 },
];
// Long enough for every design's intro (mask, pour, type, draw) to land; reduced motion is not used,
// since some intros show their resting state only once played.
const SETTLE_MS = 4200;

function playwright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found. npm i -g playwright, or set PLAYWRIGHT_MODULE.');
}

async function main() {
  const store = require(path.join(ROOT, 'content', 'templates', 'store.json'));
  const want = process.argv.slice(2);
  const sites = store.items.filter((i) => i.kind === 'site' && (!want.length || want.includes(i.id)));
  const { chromium } = playwright();
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    for (const item of sites) {
      const html = item.formats.map((f) => f.file).find((f) => /preview\.html$/.test(f));
      const src = html && path.join(ROOT, 'content', 'templates', html);
      if (!src || !fs.existsSync(src)) {
        console.warn(`skip ${item.id}: no sample page`);
        continue;
      }
      fs.mkdirSync(path.join(OUT, item.id), { recursive: true });
      for (const s of SHOTS) {
        const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: s.name === 'phone', hasTouch: s.name === 'phone' });
        const page = await ctx.newPage();
        await page.goto(`file://${src}`, { waitUntil: 'load' });
        await page.waitForTimeout(SETTLE_MS);
        const out = path.join(OUT, item.id, `${s.name}.jpg`);
        await page.screenshot({ path: out, type: 'jpeg', quality: 78 });
        await ctx.close();
        console.log(`${path.relative(ROOT, out)} ${Math.round(fs.statSync(out).size / 1024)} KB`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
