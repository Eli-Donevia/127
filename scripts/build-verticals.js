#!/usr/bin/env node
// Builds what each vertical (content/verticals/<slug>.json, lib/verticals.js) needs besides its page:
//   - its pack's niche prompts as Markdown in content/shop/files/v-<slug>/ (lib/shop.js serves them as a kit), plus any
//     files it borrows from another kit (pack.kitFrom)
//   - its sample site: the site pack builds the made-up sample business on the vertical's design, marked as a sample and
//     kept out of search, as content/verticals/_samples/<slug>.html (served at /for/<slug>/sample)
//   - with --shots, the phone poster for its page (public/verticals/<slug>.jpg, 390 wide), taken with Playwright
//
//   node scripts/build-verticals.js                 every vertical (prompts and sample sites)
//   node scripts/build-verticals.js dog-breeders    one or more by slug
//   node scripts/build-verticals.js --shots         also take the posters (needs Playwright and Chromium)
//   node scripts/build-verticals.js --check         list problems only (the same checks as test/verticals.test.js)
//   node scripts/build-verticals.js new <slug> --like <slug> --name "Cat breeders"
//                                                   a draft copied from a close vertical, every line to rewrite marked TODO
//
// The pages themselves are never built by hand: /for/<slug> renders from the file (views/verticals/page.ejs).

process.env.SITE_MOTION = 'on';
const fs = require('fs');
const path = require('path');
const V = require('../lib/verticals');

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => {
  const i = args.indexOf(k);
  return i > -1 ? args[i + 1] : null;
};

function scaffold() {
  const slug = args[1];
  const like = V.get(opt('--like'));
  const name = opt('--name');
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug || '') || !like || !name) {
    console.error('Usage: node scripts/build-verticals.js new <slug> --like <existing slug> --name "Cat breeders"');
    process.exit(1);
  }
  const file = path.join(V.DIR, `${slug}.json`);
  if (fs.existsSync(file)) {
    console.error(`${slug}.json already exists.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(path.join(V.DIR, `${like.slug}.json`), 'utf8'));
  const todo = (s) => `TODO (from ${like.slug}): ${s}`;
  const out = {
    ...raw,
    slug,
    status: 'draft',
    wave: null,
    name,
    one: todo(raw.one),
    description: todo(raw.description),
    h1: todo(raw.h1),
    mark: '',
    lede: todo(raw.lede),
    week: raw.week.map((w) => ({ ...w, job: todo(w.job), hand: todo(w.hand) })),
    site: { ...raw.site, sample: { business: todo('a made-up business name'), what: todo(raw.site.sample.what), services: '', city: '' }, caption: todo(raw.site.caption) },
    pack: { ...raw.pack, name: todo(raw.pack.name), line: todo(raw.pack.line), prompts: raw.pack.prompts.map((p) => ({ ...p, title: todo(p.title), summary: todo(p.summary), prompt: todo(p.prompt), use: todo(p.use) })) },
    hooks: raw.hooks.map(todo),
    ads: raw.ads.map((a) => ({ angle: a.angle, hook: todo(a.hook), body: todo(a.body), headline: todo(a.headline) })),
    keyword: 'TODO',
    next: [],
    legal: todo('anything regulated about this kind of business, or null'),
  };
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote content/verticals/${slug}.json as a draft. Rewrite every TODO line (content/verticals/_brief.md), then run --check.`);
}

function writeKit(v) {
  const dir = path.join(V.KITS_DIR, v.kit);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const names = [];
  for (const p of v.pack.prompts) {
    fs.writeFileSync(path.join(dir, `${p.id}.md`), V.promptFile(v, p));
    names.push(p.title);
  }
  if (v.pack.kitFrom) {
    const src = path.join(V.KITS_DIR, v.pack.kitFrom.kit);
    for (const f of v.pack.kitFrom.files || []) fs.copyFileSync(path.join(src, `${f}.md`), path.join(dir, `${v.pack.kitFrom.kit}-${f}.md`));
  }
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${v.pack.name}\n\nMade by scripts/build-verticals.js from content/verticals/${v.slug}.json. Don't edit these files; edit the vertical and build again.\n\n${names.map((n) => `- ${n}`).join('\n')}\n`);
}

async function writeSample(v) {
  const { makeCtx } = require('../lib/harness/testing');
  const site = require('../lib/packs/site');
  const build = site.tools.find((t) => t.name === 'site.build');
  const s = v.site.sample;
  const facts = { business: s.business, what: s.what, services: s.services || '', city: s.city || '', email: 'hello@example.com' };
  const ctx = makeCtx({ sample: false, brain: { business: {} }, member: { firstName: '' } });
  const out = await build.run({ facts, design: v.site.design, for: 'prospect', maker: '127', note: `${s.business} is a made-up business. This sample was built by 127's free site builder.` }, ctx);
  const prev = ctx.saved.find((f) => /-preview\.html$/.test(f.name));
  if (!prev) throw new Error(`${v.slug}: the site build saved no preview`);
  fs.mkdirSync(V.SAMPLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(V.SAMPLES_DIR, `${v.slug}.html`), prev.data);
  return { design: out.design, kb: Math.round(prev.data.length / 1024) };
}

async function shots(list) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
  }
  fs.mkdirSync(V.POSTERS_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  for (const v of list) {
    await page.goto(`file://${path.join(V.SAMPLES_DIR, `${v.slug}.html`)}`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    // A full-page shot pins fixed bars (the phone call-to-action bar, a sticky nav) mid-page: take them out. The
    // made-up-business note goes too: the phone's corners clip it, and the caption under the phone says it instead.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.sample-bar')) el.style.setProperty('display', 'none', 'important');
      for (const el of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || (pos === 'sticky' && el.getBoundingClientRect().top > 200)) el.style.setProperty('display', 'none', 'important');
      }
    });
    // The phone frame on the page scrolls through the top of the site: about two screens tall.
    await page.screenshot({ path: path.join(V.POSTERS_DIR, `${v.slug}.jpg`), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 390, height: 1560 }, fullPage: true });
    console.log(`  poster ${v.slug}.jpg`);
  }
  await browser.close();
}

async function main() {
  if (args[0] === 'new') return scaffold();
  const all = V.all();
  if (flag('--check')) {
    if (all.problems.length) {
      console.log(all.problems.join('\n'));
      process.exit(1);
    }
    console.log(`${all.list.length} verticals, no problems.`);
    return;
  }
  const only = args.filter((a) => !a.startsWith('--'));
  const list = all.list.filter((v) => !only.length || only.includes(v.slug));
  const bad = list.filter((v) => v.problems.length);
  for (const v of bad) console.log(`skip ${v.slug}:\n  ${v.problems.join('\n  ')}`);
  const good = list.filter((v) => !v.problems.length);
  for (const v of good) {
    writeKit(v);
    const s = await writeSample(v);
    console.log(`${v.slug}: ${v.pack.prompts.length} prompts, sample on ${s.design} (${s.kb} KB)`);
  }
  if (flag('--shots')) await shots(good);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
