#!/usr/bin/env node
// Downloads the site pack's fonts from Google Fonts into lib/packs/site/fonts/, so member sites carry their own font
// files in the ZIP instead of loading them from Google: faster first paint, and no visitor IP goes to Google.
// Latin subset only (it covers accented Western European letters). Run after adding or changing a design's fonts:
//   node scripts/site-fonts.js
// Writes the woff2 files, each family's license (licenses/, from github.com/google/fonts: SIL OFL and Apache 2.0 ask
// for it to travel with the font) and manifest.json ({ [q]: { css, files, licenses } }); css uses url(fonts/<file>).
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../lib/packs/site/fonts');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function specs() {
  const { FONTS } = require('../lib/packs/site/lib/theme');
  const motion = require('../lib/packs/site/lib/templates/motion');
  const all = [...Object.values(FONTS), ...motion.map((m) => m.fonts).filter(Boolean)];
  return [...new Set(all.map((f) => f.q))];
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// google/fonts keeps each family under ofl/, apache/ or ufl/ by its name without spaces.
async function license(family) {
  const dir = family.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [kind, file] of [['ofl', 'OFL.txt'], ['apache', 'LICENSE.txt'], ['ufl', 'UFL.txt']]) {
    const r = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${kind}/${dir}/${file}`);
    if (r.ok) return `${family} (Google Fonts, ${kind === 'ofl' ? 'SIL Open Font License 1.1' : kind === 'apache' ? 'Apache License 2.0' : 'Ubuntu Font Licence 1.0'})\n\n${await r.text()}`;
  }
  throw new Error(`No license found for ${family}`);
}

async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'licenses'), { recursive: true });
  const lic = new Map();
  const manifest = {};
  const byUrl = new Map();
  for (const q of specs()) {
    const css = await get(`https://fonts.googleapis.com/css2?${q}&display=swap`);
    const faces = [];
    const files = [];
    const licenses = [];
    for (const m of css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      if (m[1] !== 'latin') continue;
      const body = m[2];
      const family = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
      const style = (body.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
      const weight = ((body.match(/font-weight:\s*([\d ]+);/) || [])[1] || '400').trim().replace(/\s+/g, '-');
      const url = (body.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
      if (!family || !url) continue;
      if (!byUrl.has(url)) {
        // The same family can come back as different files (other axes asked for), so a taken name gets a number.
        const taken = new Set(byUrl.values());
        let name = `${slug(family)}-${style}-${weight}.woff2`;
        for (let i = 2; taken.has(name); i++) name = `${slug(family)}-${style}-${weight}-${i}.woff2`;
        fs.writeFileSync(path.join(OUT, name), await get(url, 'buffer'));
        byUrl.set(url, name);
      }
      const name = byUrl.get(url);
      if (!files.includes(name)) files.push(name);
      const lname = `${slug(family)}.txt`;
      if (!lic.has(lname)) {
        fs.writeFileSync(path.join(OUT, 'licenses', lname), await license(family));
        lic.set(lname, true);
      }
      if (!licenses.includes(lname)) licenses.push(lname);
      faces.push(`@font-face{${body.replace(url, `fonts/${name}`).replace(/\s*\n\s*/g, '').replace(/:\s+/g, ':').replace(/;\s*$/, '')}}`);
    }
    if (!faces.length) throw new Error(`No latin faces for ${q}`);
    manifest[q] = { css: [...new Set(faces)].join(''), files, licenses };
    console.log(q.slice(0, 70), files.length);
  }
  const used = new Set(Object.values(manifest).flatMap((m) => m.files));
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.woff2') && !used.has(f)) fs.unlinkSync(path.join(OUT, f));
  for (const f of fs.readdirSync(path.join(OUT, 'licenses'))) if (!lic.has(f)) fs.unlinkSync(path.join(OUT, 'licenses', f));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const bytes = [...used].reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`${used.size} files, ${Math.round(bytes / 1024)} KB`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
