// Template sites carry their own fonts (QA P1, Legal W7): the woff2 files and each family's license ride in the ZIP, the
// @font-face rules sit in the page's own stylesheet, and nothing loads from Google. The one-file preview inlines them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '../lib/packs/site/lib');
const manifest = require('../lib/packs/site/fonts/manifest.json');
const fresh = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(SITE)) delete require.cache[k]; };

test('every design has its fonts and their licenses in lib/packs/site/fonts (run scripts/site-fonts.js after changing one)', () => {
  const { FONTS } = require(path.join(SITE, 'theme'));
  const motion = require(path.join(SITE, 'templates/motion'));
  for (const f of [...Object.values(FONTS), ...motion.map((m) => m.fonts).filter(Boolean)]) {
    const m = manifest[f.q];
    assert.ok(m, f.q);
    for (const file of m.files) assert.ok(fs.existsSync(path.join(SITE, '../fonts', file)), file);
    assert.ok(m.licenses.length, f.q);
    for (const l of m.licenses) assert.match(fs.readFileSync(path.join(SITE, '../fonts/licenses', l), 'utf8'), /Open Font License|Apache License|Ubuntu Font Licence/, l);
    assert.ok(!/https?:/.test(m.css), f.q);
  }
});

test('each design builds with its own fonts: nothing from Google, licenses in the ZIP, fonts inside the preview', async () => {
  process.env.SITE_MOTION = 'on';
  fresh();
  try {
    const { TEMPLATES } = require(path.join(SITE, 'templates'));
    const { factsFrom } = require(path.join(SITE, 'facts'));
    const { buildSite } = require(path.join(SITE, 'site'));
    const ex = require('../lib/packs/site/sample/examples.json');
    for (const t of TEMPLATES) {
      const r = await buildSite(null, { facts: factsFrom(null, ex['site.build_tonight'], { own: false }), template: t.id, render: false });
      const pages = r.files.filter((f) => /\.html$/.test(f.name)).map((f) => String(f.data));
      for (const html of [...pages, r.preview]) assert.ok(!/googleapis|gstatic/.test(html), `${t.id}: a Google font call`);
      const woff = r.files.filter((f) => /^fonts\/.+\.woff2$/.test(f.name));
      assert.ok(woff.length, t.id);
      assert.ok(r.files.some((f) => /^fonts\/.+-LICENSE\.txt$/.test(f.name)), `${t.id}: font license`);
      for (const f of woff) assert.ok(pages[0].includes(`url(${f.name})`), `${t.id}: ${f.name}`);
      assert.match(r.preview, /url\(data:font\/woff2;base64,/, t.id);
      assert.ok(!r.preview.includes('rel="preload" href="fonts/'), `${t.id}: preview preloads a file it doesn't have`);
      assert.ok(!r.privacy.blocks.includes('embeds'), `${t.id}: nothing loads from another service`);
    }
  } finally {
    delete process.env.SITE_MOTION;
    fresh();
  }
});

test('text on the brand color uses the button pair, which is nudged to 4.5:1', () => {
  const files = [path.join(SITE, 'page.js'), path.join(SITE, 'base-css.js'), ...['templates', 'templates/motion'].flatMap((d) => fs.readdirSync(path.join(SITE, d)).filter((f) => f.endsWith('.js')).map((f) => path.join(SITE, d, f)))];
  for (const f of files) assert.ok(!/background:var\(--primary\)[^}]*color:var\(--on-primary\)/.test(fs.readFileSync(f, 'utf8')), path.basename(f));
});

test('a page that loads something from another service gets the embeds block (Legal W7)', () => {
  const privacy = require(path.join(SITE, 'privacy'));
  const c = { name: 'X', email: 'x@y.example', siteUrl: 'https://x.example/', today: '2026-10-20' };
  assert.ok(privacy.featuresOf(c, '<img src="https://cdn.example/a.jpg">').embeds);
  assert.ok(privacy.featuresOf(c, '', { outside: true }).embeds);
  assert.ok(!privacy.featuresOf(c, '<img src="images/a.jpg"><script src="https://127group.io/js/site-chat-embed.js" data-chat="' + 'a'.repeat(32) + '" async></script>').embeds);
});
