#!/usr/bin/env node
// Builds a self-contained preview of the coach pages (homepage + kit, client app, coach dashboard) for a claude.ai
// Artifact: fonts and lib/coach-kit.js inlined, site links pointed at the page itself.
// Usage: node scripts/build-coach-preview.js <out-dir>  ->  coaches.html, coach-app.html, dashboard.html
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('Usage: node scripts/build-coach-preview.js <out-dir>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const font = (name) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'public/fonts', `Geist-${name}.woff2`)).toString('base64')})`;
const inlineFonts = (s) => s.replace(/url\(\/fonts\/Geist-(\w+)\.woff2\)/g, (_, n) => font(n));
const strip = (s) => s
  .replace(/<!doctype html>\s*<html lang="en">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '')
  .replace('</head>\n<body>', '')
  .replace('</body>\n</html>', '');

let home = inlineFonts(read('public/coaches/index.html'));
home = home.replace('<script src="/js/coach-kit.js"></script>',
  `<script>window.COACH_APP_URL = "coach-app.html"; window.COACH_DASH_URL = "dashboard.html";\n${read('lib/coach-kit.js')}\n</script>`);
home = strip(home)
  .replace('<title>127 for coaches</title>', '<title>127 for coaches</title>\n<meta name="claude:viewport-fit-sides" content="cover">')
  .replace(/href="\/(start|circle)"/g, 'href="#pricing"')
  .replace('class="mark" href="/"', 'class="mark" href="#"');
fs.writeFileSync(path.join(out, 'coaches.html'), home);
fs.writeFileSync(path.join(out, 'coach-app.html'), read('public/coach-app/index.html'));
fs.writeFileSync(path.join(out, 'dashboard.html'), inlineFonts(read('public/coaches/dashboard.html')));
console.log('Wrote', ['coaches.html', 'coach-app.html', 'dashboard.html'].map((f) => path.join(out, f)).join(', '));
