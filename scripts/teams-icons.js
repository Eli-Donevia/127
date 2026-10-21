#!/usr/bin/env node
// Draws the Teams app's two icons (teams/color.png 192x192, teams/outline.png 32x32) from the 127 mark in
// public/favicon.svg: the steel 127 on near-black for color, and the same 127 in white on transparent for the
// outline Teams wants. Needs Playwright's Chromium, which isn't one of the app's packages:
//   NODE_PATH=/opt/node-tools/node_modules node scripts/teams-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const fav = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');
const d = /<path transform="[^"]*" fill="url\(#steel\)" d="([^"]+)"/.exec(fav)[1];
const defs = (fav.match(/<defs>[\s\S]*?<\/defs>/g) || []).join('');

// The glyph runs x 7.6 to 298.4 and y -145.2 to 0 in its own units.
const fit = (size, width) => {
  const s = width / (298.4 - 7.6);
  return `translate(${((size - width) / 2 - 7.6 * s).toFixed(3)} ${((size + 145.2 * s) / 2).toFixed(3)}) scale(${s.toFixed(5)})`;
};
const color = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">${defs}<rect width="192" height="192" fill="#060607"/><rect width="192" height="192" fill="url(#glow)"/><path transform="${fit(192, 142)}" fill="url(#steel)" d="${d}"/></svg>`;
const outline = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path transform="${fit(32, 28)}" fill="#FFFFFF" d="${d}"/></svg>`;

(async () => {
  const b = await chromium.launch();
  for (const [name, svg, size] of [['color.png', color, 192], ['outline.png', outline, 32]]) {
    const pg = await b.newPage({ viewport: { width: size, height: size } });
    await pg.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await pg.locator('svg').screenshot({ path: path.join(ROOT, 'teams', name), omitBackground: true });
    await pg.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
