// Builds the whole site folder: index.html, thanks and 404 pages, placeholder photos, share image,
// icons, robots.txt, sitemap.xml, _headers and README.txt, zipped for Netlify Drop, plus a one-file
// preview (photos inlined) that opens anywhere.

const fs = require('fs');
const path = require('path');
const { files, media, text, time } = require('../../_kit');
const theme = require('./theme');
const art = require('./art');
const seo = require('./seo');
const { pageDoc, simplePage, docPage } = require('./page');
const privacy = require('./privacy');
const { buildContent } = require('./content');
const { getTemplate } = require('./templates');
const { readme } = require('./readme');
const { resolveChoreo, choreoAssets } = require('./motion');

function canRender(ctx) {
  try {
    return media.canRender(ctx);
  } catch {
    return false;
  }
}

async function svgTo(ctx, svg, ext, { width, height, quality = 3 } = {}) {
  const dir = media.scratch(ctx, 'site');
  const src = path.join(dir, 'in.svg');
  const out = path.join(dir, `out.${ext}`);
  fs.writeFileSync(src, svg);
  const size = [];
  if (width) size.push('-width', String(width));
  if (height) size.push('-height', String(height));
  const enc = ext === 'jpg' ? ['-q:v', String(quality)] : [];
  await media.ffmpeg([...size, '-i', src, '-frames:v', '1', ...enc, out], { timeoutSec: 60, signal: ctx && ctx.signal });
  const buf = fs.readFileSync(out);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* scratch is cleaned by the harness too */
  }
  return buf;
}

// A .ico holding PNG images (every current browser reads PNG inside ICO).
function icoFrom(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  const dir = [];
  let offset = 6 + 16 * pngs.length;
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(p.size >= 256 ? 0 : p.size, 0);
    e.writeUInt8(p.size >= 256 ? 0 : p.size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.data.length;
    dir.push(e);
  }
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.data)]);
}

function shareLine(c) {
  if (c.template === 'creator') return c.tagline || c.whatShort || '';
  if (c.template === 'product') return c.tagline || c.whatShort || '';
  const what = text.sentenceCase(c.whatShort || c.what || '');
  return [what, !c.online && c.area ? c.area : ''].filter(Boolean).join(' in ');
}

// A sample made for a prospect says so at the top of the page, in plain words.
const SAMPLE_CSS = `
.sample-bar{margin:0;padding:.65rem 1rem;background:var(--ink);color:var(--bg);font-size:.875rem;line-height:1.45;text-align:center}
`;

function sampleLine(c, { maker = '', note = '' } = {}) {
  if (note) return text.oneLine(note);
  return `Sample homepage for ${c.name}${maker ? `, made by ${maker}` : ''} on ${time.longDate(c.today)}. It is not their live website.`;
}

// Everything for one design. Returns { c, t, files: [{ name, data, text? }], zip, preview, rendered, stats }.
// mode: 'me' (the member's own site, the default), 'prospect' (a free sample for a business the member
// pitches: a note at the top, kept out of search, README for showing it) or 'client' (a paying
// client's site, README for setting it up on their accounts). maker and sampleNote word the note.
// motion: a site brief's choreography override ({ intro, alive, scroll, pace, look }, lib/choreo.md), applied field by
// field over the design's own `choreo`; designs without choreo ignore it.
// madeWith { href, text }: a "Made with 127" link next to the footer's Privacy link (the free website builder's sites).
async function buildSite(ctx, { facts, template, copy, render, mode = 'me', maker = '', sampleNote = '', motion, madeWith = null } = {}) {
  const T = getTemplate(template);
  const c = buildContent(facts, template, copy);
  c.mode = mode;
  if (madeWith && madeWith.href && mode !== 'prospect') c.madeWith = madeWith;
  if (typeof c.ships !== 'boolean') c.ships = privacy.shipsByDefault(template, c.profile);
  const rendered = render === undefined ? canRender(ctx) : !!render;
  if (!rendered) {
    for (const im of Object.values(c.images)) {
      im.file = im.file.replace(/\.jpg$/, '.svg');
      im.src = im.src.replace(/\.jpg$/, '.svg');
    }
  }
  const kind = T.kind || template;
  const p = theme.paletteFor(kind, facts.color, facts.name);
  // A design with two modes (T.modes, its own first) gets tokens for each; the member picks the start (facts.theme).
  const modes = Array.isArray(T.modes) && T.modes.length === 2 ? T.modes : null;
  if (modes) c.modes = { native: modes[0], other: modes[1], start: modes.includes(facts.theme) ? facts.theme : modes[0], auto: facts.theme === 'auto' };
  const neon = theme.readColor(facts.neon).primary;
  const t = theme.tokens(p, { ...(T.tokens ? T.tokens(p, modes ? modes[0] : undefined) : {}), neon });
  const t2 = modes ? theme.tokens(p, { ...(T.tokens ? T.tokens(p, modes[1]) : {}), neon }) : null;
  const fonts = theme.fontsFor(T.fonts || kind, facts.fonts);
  const artP = { primary: t.primary, accent: t.accent, paper: t.bg, ink: t.ink, neon: t.neon };
  const out = [];
  const add = (name, data) => out.push({ name, data, text: typeof data === 'string' ? data : undefined });

  // Placeholder photos: abstract art in the member's palette, never stock photos of people.
  const svgs = {};
  const photos = {};
  const slots = Object.values(c.images);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    // A design can draw its own object for a slot (T.art: its bottle, ticket or print in line, over art.wall's light);
    // anything it leaves out (null) gets the window-light placeholder.
    const own = typeof T.art === 'function' ? T.art(s, { p: artP, c, seed: facts.name, index: i, art }) : null;
    // A finished photo (art.photo: a rendered scene shipped with the pack) goes in as the JPG it is, in both builds.
    if (own && Buffer.isBuffer(own.jpg)) {
      s.file = s.file.replace(/\.svg$/, '.jpg');
      s.src = s.src.replace(/\.svg$/, '.jpg');
      photos[s.src] = own.jpg;
      add(s.src, own.jpg);
      continue;
    }
    const svg = own || art.placeholder({ style: s.style, w: s.w, h: s.h, p: artP, seed: facts.name, index: i });
    svgs[s.src] = svg;
    add(s.src, rendered ? await svgTo(ctx, svg, 'jpg', { quality: 4 }) : svg);
  }

  // Share image (Open Graph) and icons.
  const og = art.ogImage({ name: c.name, line: shareLine(c), url: c.siteUrl, p: artP });
  const fav = art.favicon({ name: c.name, p: { primary: t.primary } });
  let ogPng = null;
  if (rendered) {
    ogPng = await svgTo(ctx, og, 'png');
    const touch = await svgTo(ctx, art.favicon({ name: c.name, p: { primary: t.primary }, size: 180, rounded: false }), 'png');
    const sizes = [16, 32, 48];
    const pngs = [];
    for (const size of sizes) pngs.push({ size, data: await svgTo(ctx, art.favicon({ name: c.name, p: { primary: t.primary }, size }), 'png') });
    add('og-image.png', ogPng);
    add('apple-touch-icon.png', touch);
    add('favicon.ico', icoFrom(pngs));
  }
  // The design's own font files (theme.fontsFor), next to the pages that use them.
  for (const f of [...(fonts.files || []), ...(fonts.licenses || [])]) add(f.name, require('fs').readFileSync(f.path));
  add('og-image.svg', og);
  add('favicon.svg', fav);
  const assets = { hasPng: rendered, hasIco: rendered, hasTouch: rendered };

  const design = T.render(c, { t, p });
  // A design that declares its motion as data (choreo) gets the runtime inline and the Motion bundle beside the page.
  const choreo = T.choreo ? resolveChoreo(T.choreo, motion) : null;
  let bundle = '';
  if (choreo) {
    const ca = choreoAssets(choreo);
    design.css = `${design.css}\n${ca.css}`;
    design.script = `${design.script || ''}\n${ca.script}`;
    design.head = ca.head;
    bundle = ca.bundle;
    add('motion.js', bundle);
    add('motion-LICENSE.txt', ca.license);
  }
  // Every page links the privacy notice (and a store its shipping and returns page) in its footer (Legal L76 W1, W3).
  design.body = privacy.withLegalLinks(design.body, c);
  design.css = `${design.css}\n${privacy.LEGAL_CSS}`;
  const prospect = mode === 'prospect';
  // 127's site chat, when the member pasted its code. Never on a sample made for someone else.
  if (c.chat && !prospect) {
    design.body = `${design.body}\n${privacy.chatSnippet(c.chat)}`;
    design.css = `${design.css}\n${privacy.CHAT_CSS}`;
  }
  if (prospect) {
    design.body = `<p class="sample-bar" role="note">${files.esc(sampleLine(c, { maker, note: sampleNote }))}</p>\n${design.body}`;
    design.css = `${design.css}${SAMPLE_CSS}`;
  }
  const index = pageDoc({ c, t, t2, fonts, design, assets, noindex: prospect, jsonld: prospect ? 'always' : true });
  add('index.html', index);
  add(
    'thanks.html',
    simplePage({ c, t, fonts, title: `Thanks | ${c.name}`, heading: 'Thanks, your message is in.', body: `${c.owner && c.owner !== c.name ? c.owner : c.name} will get back to you at the email or phone number you gave.`, cta: { label: 'Back to the home page', href: './' } })
  );
  add('404.html', simplePage({ c, t, fonts, title: `Page not found | ${c.name}`, heading: "That page isn't here.", body: 'The address may have a typo, or the page moved.', cta: { label: 'Go to the home page', href: '/' } }));
  const notice = privacy.privacyNotice(c, design.body, { outside: !!fonts.outside });
  add('privacy.html', docPage({ c, t, fonts, title: `Privacy notice | ${c.name}`, heading: 'Privacy notice', html: notice.html }));
  const policies = privacy.policiesPage(c);
  if (policies) add('policies.html', docPage({ c, t, fonts, title: `${privacy.policiesLabel(c)} | ${c.name}`, heading: privacy.policiesLabel(c), html: policies }));
  add('robots.txt', seo.robots(c, { block: prospect }));
  add('sitemap.xml', seo.sitemap(c));
  add('_headers', seo.headersFile({ motion: !!choreo }));
  // What has to be filled in before the site goes online; a prospect's sample is never put online by 127's member.
  const blockers = prospect ? [] : privacy.blockers(c);
  add('README.txt', readme(c, { files: out, rendered, today: c.today, longDate: time.longDate(c.today), mode, maker, blockers }));

  const order = (n) => (n === 'index.html' ? 0 : n === 'README.txt' ? 1 : n.startsWith('images/') ? 3 : 2);
  out.sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name));
  const zip = files.zip(out.map((f) => ({ name: f.name, data: f.data })), { mtime: ctx && typeof ctx.now === 'function' ? ctx.now() : Date.UTC(2026, 0, 1) });

  // One-file preview: the same page with the photos inlined (vector art, so it stays small).
  let preview = index;
  for (const [src, svg] of Object.entries(svgs)) preview = preview.split(`src="${src}"`).join(`src="${art.dataUri(svg)}"`);
  for (const [src, jpg] of Object.entries(photos)) preview = preview.split(`src="${src}"`).join(`src="data:image/jpeg;base64,${jpg.toString('base64')}"`);
  // The preview is one file, so its fonts go inside it too, once each: weights that share a (variable) file become one
  // @font-face with a weight range, so the file isn't inlined three times.
  const faces = new Map();
  preview = preview.replace(/@font-face\{([^}]*)\}\n?/g, (all, body) => {
    const src = (body.match(/src:([^;]*)/) || [])[1];
    const w = Number((body.match(/font-weight:(\d+)(?:;|$)/) || [])[1]);
    if (!src || !w) return all;
    const key = body.replace(/font-weight:\d+;?/, '');
    const seen = faces.get(key);
    if (seen) { seen.lo = Math.min(seen.lo, w); seen.hi = Math.max(seen.hi, w); return ''; }
    faces.set(key, { lo: w, hi: w });
    return `@@face${faces.size - 1}@@`;
  });
  [...faces.entries()].forEach(([key, r], i) => {
    preview = preview.replace(`@@face${i}@@`, `@font-face{${key.replace('font-style:', `font-weight:${r.lo === r.hi ? r.lo : `${r.lo} ${r.hi}`};font-style:`)}}\n`);
  });
  for (const f of fonts.files || []) {
    const data = `data:font/woff2;base64,${out.find((x) => x.name === f.name).data.toString('base64')}`;
    preview = preview.split(`url(${f.name})`).join(`url(${data})`).replace(`<link rel="preload" href="${f.name}" as="font" type="font/woff2" crossorigin>\n`, '');
  }
  // ...and the Motion bundle.
  if (bundle) preview = preview.split('<script defer src="motion.js"></script>').join(`<script>\n${bundle}\n</script>`);
  preview = preview.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', `<link rel="icon" href="${art.dataUri(fav)}" type="image/svg+xml">`);

  const styleBytes = Buffer.byteLength((index.match(/<style>[\s\S]*?<\/style>/) || [''])[0], 'utf8');
  const stats = { htmlBytes: Buffer.byteLength(index, 'utf8'), cssBytes: styleBytes, zipBytes: zip.length, files: out.length, images: slots.length };
  return { c, t, p, fonts, files: out, zip, preview, ogPng, ogSvg: og, rendered, stats, choreo, privacy: { blocks: notice.blocks, label: privacy.STARTER_LABEL }, blockers };
}

module.exports = { buildSite, canRender, svgTo, icoFrom, shareLine, sampleLine };
