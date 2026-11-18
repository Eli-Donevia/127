// Coach site hosting: the coach's website and challenge page, served by 127 at /c/<slug> and /c/<slug>/challenge.
// Part of the paid coach plan ($149), behind COACH_HOSTING = off | admins | on (default off).
//
//   off     nothing here answers; /c/<slug> stays the kit's plain challenge page (lib/coach-routes.js, COACH_CLIENTS).
//   admins  admins can publish and see hosted sites (noindex, no-store), for a private run.
//   on      coaches on the coach plan (user.coachPlan === 'active', set by the coach plan's checkout once it is built)
//           and admins can publish; published sites are public and indexed.
//
// Publishing ("Put it live" in the kit studio): the kit saves (POST /coaches/kit), then POST /coaches/site/publish
// sends the logo and photo from the phone. 127 keeps a published copy (the kit's text, edits, look and the two images)
// so later kit saves don't change the live site until the coach presses "Put it live" again. Each publish is a new
// version: the page's ETag changes and image URLs carry the file's hash, so a re-publish shows within a minute.
//
// Fast and phone-first: one HTML response with the styles and the small motion script inline (no render-blocking
// requests), the look's two fonts preloaded, the hero photo at high priority and the rest lazy, images cached for a
// year (content-hashed names), pages cached 60 s with stale-while-revalidate and answered 304 on a matching ETag.
// Text is server-rendered and visible without JavaScript. SEO: title, description, canonical, Open Graph, and
// schema.org JSON-LD (the business, the coach, the challenge as an online Event with its price); /sitemap.xml lists
// published sites while COACH_HOSTING=on. CSP: only 127's own files, the two inline scripts by hash, no trackers.
//
// Custom domains (designed, not built): a coach's doc keeps `domains: []` ({ host, token, verifiedAt }). The plan:
// the coach adds a TXT record `_127-verify.<host>` = token and a CNAME to 127; 127 checks the TXT, adds the host to
// the hosting provider (Replit custom domains by hand at first; Cloudflare for SaaS custom hostnames when there are
// many, free for the first 100), then a middleware ahead of the routes maps req.hostname -> site and calls
// page(site, kind, { base: '' , origin: 'https://<host>' }). The renderer already takes base/origin, so the same
// pages serve at '/' and '/challenge' there, the canonical moves to the custom domain, and /c/<slug> 301s to it.
//
// Collection coachSites (doc id = coach's user id): { slug, version, input, edits, look, assets: { logo, photo },
// keep: [older asset hashes still served for one version], domains, firstPublishedAt, publishedAt }.
// Image bytes are blobs coachsite_<hash>.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const security = require('./security');
const coachKit = require('./coach-kit');
const coachSite = require('./coach-site');

const KIT_PAGE = path.join(__dirname, '..', 'public', 'coaches', 'index.html');
const FONT_DIR = path.join(__dirname, '..', 'public', 'fonts', 'coach');
const IMG = {
  logo: { max: 400 * 1024 },
  photo: { max: 2 * 1024 * 1024 },
};
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const EXT_TYPE = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

function mode() {
  const v = String(process.env.COACH_HOSTING || 'off').toLowerCase();
  return v === 'on' || v === 'admins' ? v : 'off';
}
// Who can publish: admins while it's admins-only; admins and coach-plan coaches once it's on.
function canHost(user, isAdmin) {
  if (!user || mode() === 'off') return false;
  if (isAdmin && isAdmin(user)) return true;
  return mode() === 'on' && user.coachPlan === 'active';
}
function siteFor(userId) { return db.get('coachSites', userId); }
function bySlug(slug) { return db.find('coachSites', (s) => s.slug === slug); }

// ---- styles and scripts, read once -------------------------------------------------------------------------------
let cssCache = null;
// The site styles are the kit page's <style id="siteCss"> block, so the preview and the hosted site can't drift.
function siteCss() {
  if (cssCache) return cssCache;
  const html = fs.readFileSync(KIT_PAGE, 'utf8');
  const m = html.match(/<style id="siteCss">([\s\S]*?)<\/style>/);
  if (!m) throw new Error('coach-hosting: no <style id="siteCss"> in public/coaches/index.html');
  cssCache = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, '\n').trim() + '\n' + EXTRA_CSS;
  return cssCache;
}
// Hosted-page additions: the page is the whole window here (sticky nav needs overflow clip, not hidden), the logo is a
// link home, text shows without JavaScript, and the join form in the coach's look.
const EXTRA_CSS = `html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;background:#0a0a0b}
.cs{overflow:visible;overflow-x:clip;min-height:100vh}.cs a.cs-logo{text-decoration:none}
html:not(.js) .cs .rv{opacity:1;transform:none}
.cs-join{display:grid;gap:10px;max-width:440px;margin:0 auto;text-align:left}
.cs-join input[type=text],.cs-join input[type=email]{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;min-height:52px;width:100%}
.cs-join input::placeholder{color:var(--ink2)}
.cs-join label{display:flex;gap:10px;align-items:flex-start;font-size:15px;color:var(--ink)}
.cs-join label input{width:22px;height:22px;margin:1px 0 0;flex:none;accent-color:var(--ac)}
.cs-join .cs-btn{width:100%;margin-top:4px;cursor:pointer;font-family:inherit}
.cs-note{margin:18px auto 0;max-width:44ch;color:var(--ink)}
.cs-foot a{color:var(--ink)}`;
const BOOT_JS = "document.documentElement.classList.add('js')";
// Reveal on scroll and the countdown, as in the downloaded file.
const MOTION_JS = "(function(){var cs=document.querySelector('.cs');if(!cs)return;cs.classList.add('on');var r=[].slice.call(document.querySelectorAll('.rv'));" +
  "if(!('IntersectionObserver'in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){r.forEach(function(e){e.classList.add('on')})}else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});r.forEach(function(e){io.observe(e)})}" +
  "function t(){[].forEach.call(document.querySelectorAll('.cs-count'),function(el){var ms=Math.max(0,Date.parse(el.dataset.start+'T09:00:00')-Date.now()),c=[Math.floor(ms/864e5),Math.floor(ms/36e5)%24,Math.floor(ms/6e4)%60,Math.floor(ms/1e3)%60];[].forEach.call(el.querySelectorAll('b'),function(b,i){b.textContent=String(c[i]).padStart(2,'0')})})}t();setInterval(t,1000)})();";
const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`;
const CSP = `default-src 'none'; script-src ${sha(BOOT_JS)} ${sha(MOTION_JS)}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'`;
// Fonts that actually exist, so a renamed file never turns into a broken preload.
const fontOk = (f) => { try { return fs.statSync(path.join(FONT_DIR, f)).isFile(); } catch (_) { return false; } };

// ---- images --------------------------------------------------------------------------------------------------------
// A data: URL from the phone (already shrunk there) -> { buf, type, ext } after checking the bytes are really that image.
function decodeImage(v, kind) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ''));
  if (!m) return { error: `The ${kind} has to be a PNG, JPEG or WebP image.` };
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return { error: `The ${kind} is empty.` };
  if (buf.length > IMG[kind].max) return { error: `The ${kind} is too large. Pick a smaller image.` };
  const type = m[1];
  const magic = type === 'image/png' ? buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : type === 'image/jpeg' ? buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
      : buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  if (!magic) return { error: `The ${kind} doesn't look like a ${TYPES[type].toUpperCase()} file.` };
  return { buf, type, ext: TYPES[type] };
}
const assetName = (a) => `${a.hash}.${a.ext}`;
const blobId = (hash) => `coachsite_${hash}`;
// Small in-memory cache in front of the blob store (images are also cached a year by browsers).
const memo = new Map(); let memoBytes = 0; const MEMO_MAX = 24 * 1024 * 1024;
function remember(k, buf) {
  if (buf.length > MEMO_MAX / 4) return;
  memo.set(k, buf); memoBytes += buf.length;
  for (const [key, b] of memo) { if (memoBytes <= MEMO_MAX) break; memo.delete(key); memoBytes -= b.length; }
}

// ---- rendering -----------------------------------------------------------------------------------------------------
function kitOf(site) { const kit = coachKit.build(site.input); coachKit.applyEdits(kit, site.edits || {}); return kit; }
function brandOf(site, base) {
  const a = site.assets || {};
  return { look: site.look, logo: a.logo ? `${base}/i/${assetName(a.logo)}` : null, photo: a.photo ? `${base}/i/${assetName(a.photo)}` : null };
}
const esc = coachSite.esc;
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

// The join block on the challenge page: the form when client sign-ups are open (COACH_CLIENTS, lib/coach-routes.js),
// else the coach's Instagram, else a plain line. Built per request since that switch can change after a publish.
function joinBlock(kit, base, clientsOpen) {
  const f = kit.facts; const c = kit.challenge;
  if (clientsOpen) {
    return `<form class="cs-join rv d1" method="post" action="${esc(base)}/join"><input type="text" name="name" placeholder="First name" required maxlength="40" autocomplete="given-name" aria-label="First name">` +
      `<input type="email" name="email" placeholder="Email" required maxlength="200" autocomplete="email" aria-label="Email">` +
      `<label><input type="checkbox" name="ok" value="1" required><span>${esc(f.coach)} can see my name and which days I check in. My workouts stay on my phone.</span></label>` +
      `<button class="cs-btn" type="submit">Join for ${esc(c.price)}${f.price ? `, paid to ${esc(f.first)}` : ''} &rarr;</button></form>`;
  }
  const h = f.handle && f.handle !== 'reyesstrength' ? f.handle : '';
  if (h) return `<a class="cs-btn rv d1" href="https://instagram.com/${esc(h)}">Message ${esc(f.first)} to join &rarr;</a>`;
  return `<p class="cs-note rv d1">Sign-ups open soon. Check back before ${esc(coachSite.dateShort(f.start))}.</p>`;
}

function jsonLd(kit, url, brand, origin) {
  const f = kit.facts; const c = kit.challenge;
  const end = new Date(Date.parse(`${f.start}T12:00:00Z`) + (f.days - 1) * 864e5).toISOString().slice(0, 10);
  const org = { '@type': 'Organization', '@id': `${url}#org`, name: f.business, url, description: kit.site.heroSub, founder: { '@type': 'Person', name: f.coach, jobTitle: 'Online fitness coach' } };
  if (brand.logo) org.logo = origin + brand.logo;
  if (brand.photo) org.image = origin + brand.photo;
  const h = f.handle && f.handle !== 'reyesstrength' ? f.handle : '';
  if (h) org.sameAs = [`https://instagram.com/${h}`];
  const event = {
    '@type': 'Event', name: c.title, description: c.line, startDate: f.start, endDate: end,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: `${url}/challenge` }, organizer: { '@id': `${url}#org` },
    offers: { '@type': 'Offer', price: String(f.price), priceCurrency: 'USD', url: `${url}/challenge`, availability: 'https://schema.org/InStock' },
  };
  if (brand.photo) event.image = [origin + brand.photo];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, event] }).replace(/</g, '\\u003c');
}

// One full page. kind: 'site' | 'challenge'. o: { base, origin, index, clientsOpen }.
function page(site, kind, o) {
  const kit = kitOf(site);
  const f = kit.facts;
  const base = o.base;
  const brand = brandOf(site, base);
  const look = coachSite.look(brand);
  const home = o.origin + (base || '/');
  const url = (o.origin + base).replace(/\/$/, '') || o.origin;
  const canonical = kind === 'site' ? home : `${url}/challenge`;
  const title = kind === 'site' ? `${f.business}: online coaching for ${f.who}` : `${kit.challenge.title} with ${f.coach}`;
  const desc = clip(kind === 'site' ? kit.site.heroSub : `${kit.challenge.line} ${kit.challenge.dates}. ${kit.challenge.price} to join.`, 158);
  const foot = `<span><a href="mailto:hello@127group.io?subject=${encodeURIComponent(`Report a site: /c/${site.slug}`)}">Report this site</a></span>`;
  const body = kind === 'site'
    ? coachSite.site(kit, brand, { base, foot })
    : coachSite.challenge(kit, brand, { base, foot, join: joinBlock(kit, base, o.clientsOpen) });
  const ogImg = brand.photo || brand.logo;
  const fonts = (coachSite.FONTS[look] || []).filter(fontOk);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">` +
    (o.index ? '' : '<meta name="robots" content="noindex">') +
    `<meta name="theme-color" content="${esc(look === 'editorial' ? '#f5f1ea' : '#0a0a0b')}">` +
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(f.business)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">` +
    (ogImg ? `<meta property="og:image" content="${esc(o.origin + ogImg)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">') +
    (brand.logo ? `<link rel="icon" href="${esc(brand.logo)}">` : '') +
    fonts.map((x) => `<link rel="preload" href="/fonts/coach/${x}" as="font" type="font/woff2" crossorigin>`).join('') +
    (brand.photo ? `<link rel="preload" href="${esc(brand.photo)}" as="image" fetchpriority="high">` : '') +
    `<script>${BOOT_JS}</script><style>${siteCss()}</style>` +
    `<script type="application/ld+json">${jsonLd(kit, url, brand, o.origin)}</script>` +
    `</head><body>${body}<script>${MOTION_JS}</script></body></html>`;
}

// ---- routes --------------------------------------------------------------------------------------------------------
module.exports = function mount(app, { requireAuth, isAdmin, clientsOpen = () => false, baseUrl }) {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const json = express.json({ limit: '4mb' });
  const origin = (req) => (baseUrl ? baseUrl(req) : (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`)).replace(/\/$/, '');
  const owner = (site) => db.get('users', site.id);
  // Who sees a published site: everyone once it's on (while the coach can still host), admins while admins-only.
  const visible = (req, site) => {
    if (mode() === 'off') return false;
    if (isAdmin(req.user)) return true;
    return mode() === 'on' && canHost(owner(site), isAdmin);
  };

  app.get('/js/coach-site.js', (req, res) => res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').sendFile(path.join(__dirname, 'coach-site.js')));

  // The coach's hosting state, for the kit studio.
  app.get('/coaches/site', requireAuth, (req, res) => {
    const s = siteFor(req.user.id);
    res.set('Cache-Control', 'no-store').json({ allowed: canHost(req.user, isAdmin), published: !!s, url: s ? `/c/${s.slug}` : null, version: s ? s.version : 0, publishedAt: s ? s.publishedAt : null });
  });

  app.post('/coaches/site/publish', json, wrap(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'signin' });
    if (!canHost(req.user, isAdmin)) return res.status(mode() === 'off' ? 404 : 403).json({ error: 'Hosting comes with the coach plan.' });
    if (!security.allow(`coachsite:${req.user.id}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'That is a lot of publishes this hour. Try again in a bit.' });
    const kitDoc = db.get('coachKits', req.user.id);
    if (!kitDoc) return res.status(409).json({ error: 'Save your kit first.' });
    const kit = coachKit.build(kitDoc.input); coachKit.applyEdits(kit, kitDoc.edits || {});
    if (kit.problems.length) return res.status(422).json({ error: 'claim', text: kit.problems[0].text });

    const prev = siteFor(req.user.id);
    const assets = { ...((prev && prev.assets) || {}) };
    const body = req.body || {};
    const fresh = [];
    for (const kind of ['logo', 'photo']) {
      if (body[kind] === null) { delete assets[kind]; continue; }
      if (body[kind] === undefined || body[kind] === '') continue; // not sent: keep the published one
      const img = decodeImage(body[kind], kind);
      if (img.error) return res.status(400).json({ error: img.error });
      const hash = crypto.createHash('sha256').update(img.buf).digest('hex').slice(0, 24);
      if (!(assets[kind] && assets[kind].hash === hash)) { await db.putBlob(blobId(hash), img.buf); fresh.push(hash); }
      assets[kind] = { hash, ext: img.ext, bytes: img.buf.length };
    }
    const now = new Date().toISOString();
    const current = Object.values(assets).map((a) => a.hash);
    // Images of the version before stay served for one more version, so a page cached a minute ago never breaks.
    const lastHashes = prev ? Object.values(prev.assets || {}).map((a) => a.hash) : [];
    const keep = lastHashes.filter((h) => !current.includes(h));
    const doc = {
      id: req.user.id, slug: kitDoc.slug, version: (prev ? prev.version : 0) + 1,
      input: kitDoc.input, edits: kitDoc.edits || {}, look: coachSite.look({ look: kitDoc.look }), assets, keep,
      domains: (prev && prev.domains) || [], firstPublishedAt: prev ? prev.firstPublishedAt : now, publishedAt: now,
    };
    await db.save('coachSites', doc);
    for (const h of (prev && prev.keep) || []) if (!current.includes(h) && !keep.includes(h)) { await db.removeBlob(blobId(h)).catch(() => {}); memo.delete(h); }
    res.json({ ok: true, url: `/c/${doc.slug}`, challengeUrl: `/c/${doc.slug}/challenge`, version: doc.version, publishedAt: now, public: mode() === 'on', uploaded: fresh.length });
  }));

  // Take the site down: the kit stays, /c/<slug> goes back to the plain challenge page.
  app.post('/coaches/site/unpublish', json, wrap(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'signin' });
    const s = siteFor(req.user.id);
    if (!s) return res.json({ ok: true });
    await db.remove('coachSites', s.id);
    for (const h of [...Object.values(s.assets || {}).map((a) => a.hash), ...(s.keep || [])]) { await db.removeBlob(blobId(h)).catch(() => {}); memo.delete(h); }
    res.json({ ok: true });
  }));

  // Public pages. Anything not published (or not visible) falls through to the kit's challenge page / the 404.
  const served = (req, res, next) => {
    if (mode() === 'off') return next('route');
    const site = bySlug(req.params.slug);
    if (!site || !visible(req, site)) return next('route');
    req.coachSite = site;
    next();
  };
  const send = (kind) => (req, res) => {
    const site = req.coachSite;
    const pub = mode() === 'on' && !isAdmin(req.user);
    const open = !!clientsOpen(req);
    const o = { base: `/c/${site.slug}`, origin: origin(req), index: mode() === 'on', clientsOpen: open };
    const etag = `W/"cs-${site.id.slice(0, 8)}-${site.version}-${kind}-${open ? 1 : 0}-${mode()}"`;
    res.set({ 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ETag: etag, Vary: 'Cookie' });
    res.set('Cache-Control', pub ? 'public, max-age=60, stale-while-revalidate=600' : 'private, no-store');
    if (pub && req.headers['if-none-match'] === etag) return res.status(304).end();
    res.type('html').send(page(site, kind, o));
  };
  app.get('/c/:slug', served, send('site'));
  app.get('/c/:slug/challenge', served, send('challenge'));

  // Published images: content-hashed names, cached a year. Only the site's own current (or just-replaced) files.
  app.get('/c/:slug/i/:file', served, wrap(async (req, res, next) => {
    const m = /^([a-f0-9]{24})\.(png|jpg|webp)$/.exec(req.params.file);
    const site = req.coachSite;
    const owned = m && (Object.values(site.assets || {}).some((a) => a.hash === m[1] && a.ext === m[2]) || (site.keep || []).includes(m[1]));
    if (!owned) return res.status(404).end();
    let buf = memo.get(m[1]);
    if (!buf) { buf = await db.getBlob(blobId(m[1])); if (!buf) return res.status(404).end(); remember(m[1], buf); }
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", ETag: `"${m[1]}"` });
    if (req.headers['if-none-match'] === `"${m[1]}"`) return res.status(304).end();
    res.type(EXT_TYPE[m[2]]).send(buf);
  }));
};

// Published sites for /sitemap.xml (only while hosting is public, and only coaches who can still host).
module.exports.sitemapPaths = (isAdmin) => (mode() === 'on'
  ? db.filter('coachSites', () => true).filter((s) => canHost(db.get('users', s.id), isAdmin)).flatMap((s) => [`/c/${s.slug}`, `/c/${s.slug}/challenge`])
  : []);
module.exports.mode = mode;
module.exports.canHost = canHost;
module.exports.page = page;
module.exports.decodeImage = decodeImage;
module.exports.CSP = CSP;
