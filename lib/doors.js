// Front doors (Funnels v2, W8 in v2/turnkey/BUILD-PLAN.md): the "What are you building?" picker on / and /start, and
// four free tools a visitor runs before they have an account. Each one is one of 127 HQ's own free workflows:
//
//   /store-audit    Online store                 shop.audit, then shop.mock_page (the product page rebuilt)
//   /brand-list     Creator or UGC               ugc.find_brands from the dated store snapshot, then ugc.write_script
//   /site-tonight   Own idea or website          site.pick_template, then site.build (the ZIP)
//   /offer-score    Coaching or digital product  offer.score_offer, then offer.pick_magnet and offer.build_magnet
//
// First 25 (lib/first25.js) is the local service door and keeps its own page. The tools run on a guest ctx: no member,
// no Pipeline, no keys, files kept with the result (blobs) for DOORS_KEEP_DAYS, web reads only for the Store audit
// (the visitor's own store, through the harness's guarded fetch), and AI only with FRONT_DOORS_AI (otherwise each
// tool's own template, which is how every tool already runs without AI). Results end with Free next to Builder's HQ
// workflows, unlock in full with an email (lib/funnels.js /api/lead), and come into 127 HQ at signup
// (/start/door/:id, then lib/harness/imports.js importDoor). First 25's list takes the same account step
// (/start/first25/:id), then HQ's own First 25 confirm screen.
//
// Env:
//   FRONT_DOORS=true          the picker and the four pages. They show while 127 HQ is on for every member (HARNESS_V2=on
//                             with the Terms and Privacy pages live), since each result ends in HQ; members HQ v2 is on
//                             for (admins, early access) see them before that.
//   FRONT_DOORS_AI=true       let the tools polish their words with AI: what the visitor typed goes to Anthropic, the
//                             one outside service Legal G7 allows. Each run costs money, so it's Eli's call.
//   DOORS_PER_IP (6)          runs per visitor per day, all doors together
//   DOORS_LIVE_CAP (300)      live store reads a day (Store audit); past it, a labeled sample store
//   DOORS_AI_CAP (300)        runs a day that may use AI; past it, the templates
//   DOORS_KEEP_DAYS (30)      how long a result and its files are kept (Legal G1)
//   DOORS_AT_ONCE (4)         runs at the same time; the rest wait their turn
//   DOORS_TIMEOUT_SEC (150)   a run that takes longer stops
//
// Legal cleared the doors with G1 to G7 (legal/handoffs/turnkey.md, row 11): the owner box and the 50-request,
// public-pages-only store read (G3), sources and the paid-post line for the Brand list (G4), the offer score's line
// (G6), and only Anthropic and 127's own code (G7). Their words live in public/funnels/doors-data.js.

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const db = require('./db');
const D = require('../public/funnels/doors-data.js');

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const int = (k, d) => {
  const n = parseInt(env(k, String(d)), 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const BASE = () => (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
// The harness loads 44 packs; required on first use so the static pages and tests that don't need it stay light.
const H = () => require('./harness');
const hctx = () => require('./harness/ctx');

const IDS = ['store', 'creator', 'site', 'offer'];
const fill = (s, v = {}) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m));
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const line = (v, n) => clip(v, n).replace(/\s+/g, ' ');
function bad(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

// ---------- on or off ----------
function on() {
  return process.env.FRONT_DOORS === 'true';
}
function aiOn() {
  return process.env.FRONT_DOORS_AI === 'true';
}
// The doors show while HQ is on for every member, or for a signed-in member HQ v2 is on for (admins, early access).
function liveFor(user) {
  if (!on()) return false;
  const h = H();
  return h.mode() === 'on' || (!!user && h.enabledFor(user));
}

// The picker's doors, for views/partials/doors.ejs (null when the doors are off for this visitor).
function picker(user) {
  if (!liveFor(user)) return null;
  return D.picker;
}

// ---------- signing (a result's link, like First 25's) ----------
function sign(id) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`door:${id}`).digest('hex').slice(0, 32);
}
function signed(id, k) {
  const a = Buffer.from(String(k || ''));
  const b = Buffer.from(sign(String(id || '')));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const keepDays = () => int('DOORS_KEEP_DAYS', 30) || 30;
const keepUntil = (doc) => new Date(new Date(doc.createdAt).getTime() + keepDays() * 864e5).toISOString();
const resultUrl = (doc) => `${BASE()}/door/r/${doc.id}?k=${sign(doc.id)}`;
const fileUrl = (doc, n, extra = '') => `/door/r/${doc.id}/file/${n}?k=${sign(doc.id)}${extra}`;

// ---------- the four doors ----------
// clean(body) -> the tool inputs (400 on bad input); run(input, t) -> the tools' outputs; shape(out) -> what the page
// draws; summary(out) -> the few facts the email and stats need (kept on the doc); files(out) -> which file is which;
// brain(input) -> the guest's business facts; hq(doc, out) -> what comes into 127 HQ at signup.
const fileId = (f) => (f && /^f\d+$/.test(String(f.id)) ? Number(String(f.id).slice(1)) : null);

const RUNS = {
  store: {
    pack: 'shop',
    // The visitor's own store is read live, the way a shopper sees it. .example stores are the pack's samples.
    web: true,
    clean(b) {
      const store = line(b.store, 300);
      if (store.length < 4 || !/[a-z0-9-]\.[a-z]{2,}/i.test(store)) throw bad('Paste your store address, like yourstore.com.');
      // Legal G3: the visitor ticks "I own or run this store" before 127 reads it. A sample store needs no tick.
      const S = require('./packs/shop/lib/store');
      const parsed = S.parseStoreInput(store);
      const owner = b.owner === true || b.owner === 'on' || b.owner === 'true';
      if (!owner && !(parsed && S.isSampleHost(parsed.host))) throw bad(D.doors.store.ownerError);
      return { store, owner };
    },
    // Only a real store is read live, so only it counts toward DOORS_LIVE_CAP.
    live(input) {
      const S = require('./packs/shop/lib/store');
      const parsed = S.parseStoreInput(input.store);
      return !(parsed && S.isSampleHost(parsed.host));
    },
    brain: () => ({}),
    async run(input, t) {
      t.step(0);
      const audit = await t.tool('shop.audit', { store: input.store, depth: 'full', files: true });
      t.step(1);
      let mock = null;
      if (audit.ok && audit.pitch) {
        t.step(2);
        mock = await t.tool('shop.mock_page', { pitch: audit.pitch }).catch((e) => {
          t.log(`mock page skipped: ${e.message}`);
          return null;
        });
      }
      t.step(3);
      return { audit, mock };
    },
    ok: (out) => !!(out.audit && (out.audit.ok || out.audit.status === 'feed_off')),
    sample: (out) => !!(out.audit && out.audit.sample),
    shape(out) {
      const a = out.audit;
      const n = a.numbers || {};
      return {
        ok: !!(a.ok || a.status === 'feed_off'),
        status: a.status,
        reason: a.reason || '',
        store: { name: a.store.name, url: a.store.url, domain: a.store.domain, products: n.products == null ? a.store.products : n.products, theme: a.store.theme, note: a.store.note },
        score: a.score,
        grade: a.grade,
        fixes: (a.fixes || []).map((f) => ({ title: f.title, evidence: f.evidence, why: f.why, how: f.how, impact: f.impact, minutes: f.minutes })),
        strengths: (a.strengths || []).map((s) => (typeof s === 'string' ? s : s.title || '')).filter(Boolean),
        numbers: { photos: n.photosPerProduct, oneImage: n.oneImage, words: n.wordsMedian, thin: n.thin, soldOut: n.soldOut, altMissing: n.altMissing, altChecked: n.altChecked, priceMin: n.priceMin, priceMax: n.priceMax },
        mock: out.mock && out.mock.ok ? { product: out.mock.product, notes: out.mock.notes || [] } : null,
      };
    },
    summary(out) {
      const a = out.audit;
      return { name: a.store.name, domain: a.store.domain, score: a.score, grade: a.grade, fixes: (a.fixes || []).slice(0, 5).map((f) => f.title), count: (a.fixes || []).length, mock: out.mock && out.mock.ok ? out.mock.product.title : null };
    },
    files: (out) => ({ report: fileId(out.audit.report), mock: fileId(out.mock && out.mock.page), issues: fileId(out.audit.issues) }),
    hq(doc, out) {
      const a = out.audit;
      return {
        business: { name: a.store.name || '' },
        links: { website: a.sample ? '' : a.store.url || '' },
        remember: [{ pack: 'shop', key: 'audit', value: { store: a.store.domain, score: a.score, at: doc.createdAt.slice(0, 10), fixes: (a.fixes || []).slice(0, 5).map((f) => f.title) } }],
      };
    },
  },

  creator: {
    pack: 'ugc',
    // Brands come from the pack's dated snapshot of their public stores (no live reads for a free run).
    web: false,
    clean(b) {
      const U = require('./packs/ugc/lib/ugc');
      const category = U.CAT_IDS.includes(String(b.category)) ? String(b.category) : null;
      if (!category) throw bad('Pick what you want to film.');
      return { category, name: line(b.name, 40), site: line(b.site, 300) };
    },
    brain: (input) => ({ links: { website: input.site } }),
    firstName: (input) => input.name,
    async run(input, t) {
      const U = require('./packs/ugc/lib/ugc');
      t.step(0);
      const find = await t.tool('ugc.find_brands', { category: input.category, count: 25, check: 0, save: false, name: input.name, site: input.site });
      t.step(1);
      // The tool keeps the first 5 messages; the page and the import get every brand's.
      const sender = { name: input.name || '', business: '', site: input.site || '', address: '' };
      t.step(2);
      const msgs = find.brands.map((r) => U.pitchFor(r, sender));
      t.step(3);
      const script = find.first ? await t.tool('ugc.write_script', { brand: find.first, category: input.category }) : null;
      // Legal G4: the sample brief ends with the line on saying when a post is paid.
      if (script && script.doc) t.append(script.doc, `\n\n${D.doors.creator.result.disclose}\n`);
      return { find, msgs, script };
    },
    ok: (out) => !!(out.find && out.find.brands && out.find.brands.length),
    sample: () => false,
    shape(out) {
      const U = require('./packs/ugc/lib/ugc');
      const f = out.find;
      return {
        category: f.category,
        label: f.label,
        checked: f.checked,
        live: f.live || 0,
        // The category ran short, so the closest ones fill the list, each marked.
        widened: f.widened || [],
        brands: f.brands.map((b, i) => {
          const m = out.msgs[i] || {};
          return {
            rank: b.rank,
            name: b.name,
            url: b.url,
            domain: b.domain,
            country: b.country,
            products: b.products,
            prices: b.price_range,
            product: b.product ? { title: b.product.title, price: b.product.price, url: b.product.url } : null,
            gap: b.gap,
            gaps: (b.gaps || []).map((g) => g.text),
            other: b.category !== f.category ? U.catOf(b.category).label : null,
            // Follow-ups by email carry the sign-off, mailing address and opt-out, like the first email.
            msg: { dm: m.dm, subject: m.subject, email: m.email, follow1: m.follow1, follow2: m.follow2, follow1Email: m.follow1Email, follow2Email: m.follow2Email },
          };
        }),
        brief: out.script ? { brand: out.script.brand, title: out.script.script.title, angle: out.script.script.angle, lines: out.script.script.lines, notes: out.script.script.notes } : null,
      };
    },
    summary(out) {
      const f = out.find;
      return { category: f.label, count: f.brands.length, checked: f.checked, top: f.brands.slice(0, 10).map((b) => ({ name: b.name, url: b.url, product: b.product ? b.product.title : '' })), brief: out.script ? out.script.brand : null };
    },
    files: (out) => ({ csv: fileId(out.find.csv), brief: fileId(out.script && out.script.doc) }),
    hq(doc, out, input) {
      const U = require('./packs/ugc/lib/ugc');
      const f = out.find;
      const leads = f.brands.map((r, i) => U.pipelineRow(r, out.msgs[i] || U.pitchFor(r, { name: input.name || '' }), null));
      return {
        niche: 'ugc',
        business: { what: `UGC videos for ${String(f.label).toLowerCase()} brands` },
        links: { website: input.site || '' },
        leads: { pack: 'ugc', rows: leads },
      };
    },
  },

  site: {
    pack: 'site',
    web: false,
    clean(b) {
      const business = line(b.business, 80);
      const what = line(b.what, 120);
      if (business.length < 2) throw bad('Type the name of your business or idea.');
      if (what.length < 3) throw bad('Say what it does, in a few words.');
      const email = line(b.email, 120);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad('That email for your page looks off. Check it, or leave it empty.');
      return { business, what, services: clip(b.services, 1200), city: line(b.city, 80), email };
    },
    brain: (input) => ({ business: { name: input.business, what: input.what, city: input.city } }),
    async run(input, t) {
      const facts = { business: input.business, what: input.what, services: input.services, city: input.city, email: input.email };
      t.step(0);
      const pick = await t.tool('site.pick_template', { facts });
      t.step(1);
      t.step(2);
      const build = await t.tool('site.build', { facts, design: pick.best });
      t.step(3);
      return { pick, build };
    },
    ok: (out) => !!(out.build && out.build.zip),
    sample: () => false,
    shape(out) {
      const b = out.build;
      // What the site needs before it goes online (Legal L76 W1, W3); while there's any, it isn't called ready (D49).
      return { business: b.business, design: b.design, designName: b.designName, why: out.pick.best && out.pick.best.why, siteUrl: b.siteUrl, photos: b.photos || [], share: b.share || [], files: b.files.length, kb: Math.round(((b.stats && b.stats.htmlBytes) || 0) / 1024), ready: b.ready !== false, blockers: b.blockers || [] };
    },
    summary: (out) => ({ business: out.build.business, design: out.build.designName, files: out.build.files.length, blockers: out.build.blockers || [] }),
    files: (out) => ({ zip: fileId(out.build.zip), preview: fileId(out.build.preview), share: fileId(out.build.shareImage) }),
    hq: (doc, out, input) => ({ business: { name: input.business, what: input.what, city: input.city } }),
  },

  offer: {
    pack: 'offer',
    web: false,
    clean(b) {
      const kind = b.kind === 'digital' ? 'digital' : 'coaching';
      const what = line(b.what, 200);
      if (what.length < 3) throw bad('Say what you sell, in a few words.');
      const price = b.price === '' || b.price == null ? null : Number(String(b.price).replace(/[$,\s]/g, ''));
      if (price != null && !(Number.isFinite(price) && price >= 0 && price <= 100000)) throw bad('Type your price as a number, like 149.');
      return { kind, what, who: line(b.who, 200), outcome: line(b.outcome, 200), price, offer: clip(b.offer, 2000) };
    },
    brain: (input) => ({ business: { what: input.what, audience: input.who, price: input.price == null ? undefined : input.price } }),
    async run(input, t) {
      const facts = { what: input.what, who: input.who || undefined, outcome: input.outcome || undefined, price: input.price == null ? undefined : input.price };
      t.step(0);
      const score = await t.tool('offer.score_offer', { offer: input.offer || undefined, ...facts });
      t.step(1);
      t.step(2);
      const ideas = await t.tool('offer.pick_magnet', { what: input.what, who: input.who || undefined });
      t.step(3);
      const magnet = ideas.ideas && ideas.ideas[0] ? await t.tool('offer.build_magnet', { idea: ideas.ideas[0], what: input.what }) : null;
      return { score, ideas, magnet };
    },
    ok: (out) => !!(out.score && Number.isFinite(out.score.score)),
    sample: () => false,
    shape(out) {
      const s = out.score;
      const m = out.magnet;
      return {
        score: s.score,
        after: s.after,
        rows: (s.rows || []).map((r) => ({ label: r.label, score: r.score, why: r.why })),
        // The score's "after" is with its top 3 fixes, so the page shows those 3.
        fixes: (s.fixes || []).slice(0, 3).map((f) => ({ title: f.title, line: f.line, why: f.why, points: f.points })),
        rewrite: s.rewrite,
        source: s.source,
        magnet: m ? { title: m.title, kind: m.kind, keyword: m.promo.keyword, post: m.promo.post, deliver: m.promo.deliver, follow: m.promo.follow, story: (m.promo.story || []).map((x) => x.text || x) } : null,
      };
    },
    summary: (out) => ({ score: out.score.score, after: out.score.after, fixes: (out.score.fixes || []).slice(0, 3).map((f) => f.title), rewrite: out.score.rewrite, magnet: out.magnet ? out.magnet.title : null, keyword: out.magnet ? out.magnet.promo.keyword : null }),
    files: (out) => ({ report: fileId(out.score.file), magnet: fileId(out.magnet && out.magnet.files && out.magnet.files[0]), sheet: fileId(out.magnet && out.magnet.files && out.magnet.files[1]) }),
    hq: (doc, out, input) => ({
      niche: input.kind === 'digital' ? 'templates' : 'coaching',
      business: { what: input.what, audience: input.who, price: input.price == null ? undefined : input.price },
      remember: [{ pack: 'offer', key: 'score', value: { score: out.score.score, after: out.score.after, at: doc.createdAt.slice(0, 10) } }],
    }),
  },
};

// ---------- the guest ctx ----------
// The harness contract's ctx (lib/harness/ctx.js) for someone with no account: same guard rails on web reads and
// spending, nothing kept on a member, files held in memory until the result is saved.
const offline = async () => {
  throw new Error('Network is off in this run.');
};

// Legal G3: a store audit reads public pages only, at most 50 requests a run, and never a cart, checkout or account
// page, not even through a redirect. Each hop goes through the harness's guarded fetch (public hosts only).
const STORE_FETCHES = 50;
const PRIVATE_PAGE = /^\/(?:[^/]+\/)?(?:cart|checkouts?|account|accounts)(?:[/.]|$)/i;
function storeFetch(inner, meter) {
  return async function doorFetch(url, options = {}) {
    const mode = options.redirect || 'follow';
    let current = String(url);
    let opts = { ...options, redirect: 'manual' };
    for (let hop = 0; hop <= 5; hop++) {
      let u = null;
      try {
        u = new URL(current);
      } catch {
        return inner(current, opts); // the guarded fetch says why it isn't a web address
      }
      if (PRIVATE_PAGE.test(u.pathname)) throw new Error("The audit doesn't open cart, checkout or account pages.");
      meter.storeFetches = (meter.storeFetches || 0) + 1;
      if (meter.storeFetches > STORE_FETCHES) throw new Error(`The audit stops at ${STORE_FETCHES} requests.`);
      const res = await inner(current, opts);
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc || mode !== 'follow') return res;
      try {
        if (res.body && typeof res.body.cancel === 'function') await res.body.cancel();
      } catch {
        /* ignore */
      }
      current = new URL(loc, u).toString();
      const method = String(opts.method || 'GET').toUpperCase();
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== 'GET' && method !== 'HEAD')) opts = { ...opts, method: 'GET', body: undefined };
    }
    throw new Error('Too many redirects.');
  };
}

function guestCtx(run, { def, input, signal }) {
  const ctxLib = hctx();
  const cache = require('./harness/cache');
  const os = require('os');
  const fs = require('fs');
  const dirs = [];
  const raw = def.brain(input) || {};
  const brain = { business: { country: 'US', ...(raw.business || {}) }, voice: {}, links: { ...(raw.links || {}) }, goal: {}, numbers: [], packs: {} };
  const ctx = {
    member: { id: `guest:${run.id}`, firstName: def.firstName ? def.firstName(input) || '' : '', tier: 'free', timezone: 'America/Chicago' },
    inputs: input,
    brain,
    sample: !!run.sample,
    signal,
    now: () => Date.now(),
    fetch: def.web && !run.sample ? storeFetch(ctxLib.makeFetch({ memberId: `door:${run.who}`, run: run.meter, signal }), run.meter) : offline,
    secret: () => null,
    async spend(usd) {
      const n = Number(usd);
      if (!Number.isFinite(n) || n < 0) return;
      ctxLib.addDay(n);
      run.meter.usd += n;
      ctxLib.checkBudget(run.meter);
    },
    async save(name, data, o = {}) {
      const buf = Buffer.isBuffer(data) ? data : data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(String(data == null ? '' : data), 'utf8');
      if (run.files.length >= 12 || buf.length > 8 * 1024 * 1024) throw new Error('Too many files for a free run.');
      const n = run.files.length + 1;
      const f = { n, name: path.basename(String(name || 'file')).replace(/[^\w.\- ()]+/g, '').slice(0, 100) || 'file', type: String(o.type || 'application/octet-stream'), data: buf };
      run.files.push(f);
      return { id: `f${n}`, url: '', name: f.name, type: f.type, bytes: buf.length };
    },
    async asset() {
      throw new Error("That file isn't here.");
    },
    tmpdir() {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), '127-door-'));
      dirs.push(d);
      return d;
    },
    leads: { upsert: async (l) => ({ ...l, id: null }), list: async () => [], get: async () => null, update: async () => null },
    remember: async (key, value) => {
      run.remembered.push({ pack: def.pack, key: String(key).slice(0, 60), value });
    },
    cache: cache.forPack(def.pack),
    log(text) {
      if (run.logs.length < 40) run.logs.push(clip(text, 200));
    },
    progress: () => {},
  };
  if (run.ai) {
    const llm = require('./harness/llm');
    ctx.ai = async (opts = {}) => {
      ctxLib.checkBudget(run.meter);
      return llm.call({
        ...opts,
        tier: 'free',
        spentUsd: 0,
        brain,
        signal,
        timeoutMs: 45000,
        onCost: async (m) => {
          ctxLib.addDay(m.usd || 0);
          run.meter.usd += m.usd || 0;
        },
      });
    };
  }
  Object.defineProperty(ctx, '_cleanup', {
    enumerable: false,
    value: () => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })),
  });
  return ctx;
}

// One tool call, checked against its schemas the way the engine checks it.
async function callTool(name, input, ctx) {
  const schema = require('./harness/schema');
  const tool = H().packs.tool(name);
  if (!tool) throw new Error(`${name} isn't installed.`);
  const v = schema.validate(tool.input, input, { coerce: true, clip: true });
  if (!v.ok) throw new Error(`${name} input: ${v.text}`);
  const out = await tool.run(v.value, ctx);
  const json = JSON.parse(JSON.stringify(out === undefined ? null : out));
  const check = schema.validate(tool.output, json);
  if (!check.ok) throw new Error(`${name} answered in the wrong shape: ${check.text}`);
  return json;
}

// At most a few runs at once, so a burst of ad clicks can't starve the site; the rest wait their turn.
const slots = { active: 0, queue: [] };
async function slot() {
  const max = Math.max(1, int('DOORS_AT_ONCE', 4));
  if (slots.active >= max) {
    if (slots.queue.length >= 30) throw Object.assign(new Error('busy'), { status: 503 });
    await new Promise((r) => slots.queue.push(r));
  }
  slots.active += 1;
  return () => {
    slots.active -= 1;
    const next = slots.queue.shift();
    if (next) next();
  };
}

// ---------- run, save, view ----------
// opts: { who (hashed visitor), sample, ai, utm, progress(step) }. Returns the saved doc, or { failed } when the
// tools ran but there's nothing to keep (a store we can't read).
async function run(doorId, body, opts = {}) {
  const def = RUNS[doorId];
  if (!def) throw bad('Unknown door.');
  const input = def.clean(body || {});
  H().init();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('timeout')), int('DOORS_TIMEOUT_SEC', 150) * 1000);
  const r = { id: db.id(), who: opts.who || 'anon', sample: !!opts.sample, ai: !!opts.ai, files: [], remembered: [], logs: [], meter: { usd: 0, fetches: 0 } };
  const ctx = guestCtx(r, { def, input, signal: ac.signal });
  const release = await slot();
  let out;
  try {
    out = await def.run(input, {
      tool: (name, i) => callTool(name, i, ctx),
      // Adds text to the end of a file a tool saved in this run.
      append: (ref, text) => {
        const f = r.files.find((x) => x.n === fileId(ref));
        if (f) f.data = Buffer.concat([f.data, Buffer.from(String(text), 'utf8')]);
      },
      step: (i) => (opts.progress ? opts.progress(i) : null),
      log: (t) => ctx.log(t),
    });
  } finally {
    release();
    clearTimeout(timer);
    ctx._cleanup();
  }
  if (!def.ok(out)) return { failed: true, door: doorId, view: def.shape(out) };
  const files = [];
  for (const f of r.files) {
    await db.putBlob(`door_${r.id}_${f.n}`, f.data);
    files.push({ n: f.n, name: f.name, type: f.type, bytes: f.data.length });
  }
  await db.putBlob(`door_${r.id}_out`, Buffer.from(JSON.stringify(out)));
  const doc = await db.save('doorRuns', {
    id: r.id,
    door: doorId,
    input,
    summary: def.summary(out, input),
    files,
    which: def.files(out),
    sample: !!(r.sample || def.sample(out)),
    capped: !!opts.capped,
    ai: !!r.ai,
    usd: Math.round(r.meter.usd * 10000) / 10000,
    utm: opts.utm || {},
    remembered: r.remembered.slice(0, 10),
    email: null,
  });
  return { doc, out };
}

async function outOf(doc) {
  const buf = await db.getBlob(`door_${doc.id}_out`);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

// What a door's page gets: the shaped result, its files by role and the Builder workflows next to it.
function view(doc, out) {
  const def = RUNS[doc.door];
  const C = D.doors[doc.door];
  const which = doc.which || {};
  const files = Object.entries(which)
    .filter(([, n]) => n && doc.files.some((f) => f.n === n))
    .map(([key, n]) => {
      const f = doc.files.find((x) => x.n === n);
      return { key, label: (C.files || {})[key] || f.name, name: f.name, type: f.type, bytes: f.bytes, url: fileUrl(doc, n), open: /^text\/html|^image\//.test(f.type) ? fileUrl(doc, n, '&preview=1') : null };
    });
  return {
    id: doc.id,
    k: sign(doc.id),
    door: doc.door,
    createdAt: doc.createdAt,
    keepUntil: keepUntil(doc),
    sample: !!doc.sample,
    capped: !!doc.capped,
    input: publicInput(doc),
    result: def.shape(out),
    files,
    builder: builderList(doc.door),
    hq: hqState(),
  };
}

// What the visitor typed, back on their own page (never the honeypot or anything not in the form).
function publicInput(doc) {
  const keep = (D.doors[doc.door].fields || []).map((f) => f.name);
  return Object.fromEntries(Object.entries(doc.input || {}).filter(([k]) => keep.includes(k)));
}

// Builder's side: the door's HQ workflows that exist and are Builder's, by their own titles.
function builderList(doorId) {
  let packs;
  try {
    packs = H().packs;
  } catch {
    return [];
  }
  return (D.doors[doorId].builder || [])
    .map((id) => packs.workflow(id))
    .filter((wf) => wf && wf.tier === 'builder' && !wf.hidden)
    .map((wf) => ({ id: wf.id, title: wf.title, promise: wf.promise || '' }));
}

// HQ is where a result goes at signup; the page offers it while HQ v2 is on for members.
function hqState() {
  try {
    return H().mode() === 'on';
  } catch {
    return false;
  }
}

// The door copy and the fields' options for the page (window.DOOR), before any run.
function pageConfig(doorId) {
  const C = D.doors[doorId];
  const fields = C.fields.map((f) => {
    if (f.options !== 'categories') return f;
    const U = require('./packs/ugc/lib/ugc');
    return { ...f, options: U.CAT_IDS.map((id) => [id, U.catOf(id).label]) };
  });
  return { id: doorId, ...C, fields, copy: D.copy, lines: D.lines, builderList: builderList(doorId), hq: hqState(), keepDays: keepDays() };
}

// ---------- the email (lib/funnels.js deliveryEmail, source store-audit, brand-list, site-tonight, offer-score) ----------
const SOURCES = Object.fromEntries(IDS.map((id) => [D.doors[id].source, id]));
function doorOfSource(source) {
  return SOURCES[source] || null;
}

// The day a snapshot was read, as the page shows it ("October 19, 2026").
const dayOf = (ymd) => {
  const t = new Date(`${String(ymd || '').slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};
// Where "Start free" goes: the result's own signup into 127 HQ while HQ is on for members, the roadmap otherwise.
const startUrl = (doc) => (hqState() ? `${BASE()}/start/door/${doc.id}?k=${sign(doc.id)}` : `${BASE()}/start?from=${D.doors[doc.door].source}`);

// stateBlock(state, startUrl): lib/funnels.js stateText for this lead, the same launch block as the other results.
function emailText(lead, stateBlock) {
  const d = lead.data || {};
  const doc = d.run_id && signed(d.run_id, d.k) ? db.get('doorRuns', String(d.run_id)) : null;
  const hi = `Hi ${lead.name || 'there'},`;
  const door = doorOfSource(lead.source);
  const C = door ? D.doors[door] : null;
  if (!doc || !C || doc.door !== door) {
    return { subject: 'Your result from 127', text: `${hi}\n\nYour result didn't save on our side, sorry about that. Run it again here: ${BASE()}${C ? C.path : '/'}\n\n${stateBlock('C')}` };
  }
  const s = doc.summary || {};
  const open = `${C.email.open}: ${resultUrl(doc)}`;
  const keep = fill(D.copy.saved, { days: keepDays() });
  const sample = doc.sample ? `\n\n${D.copy.sample}` : '';
  const free = `${D.copy.freeLabel}: ${C.free.join('; ')}.`;
  const builder = builderList(door).map((w) => w.title);
  const adds = builder.length ? `\n${D.copy.builderLabel}: ${builder.join('; ')}.` : '';
  let body = '';
  if (door === 'store') {
    body = `${fill(C.result.heading, { score: s.score })} ${s.grade || ''}\n\n${C.result.fixes}:\n${(s.fixes || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}${s.mock ? `\n\n${fill(C.result.mockLine, { product: s.mock })}` : ''}`;
  } else if (door === 'creator') {
    body = `${fill(C.result.heading, { n: s.count, category: String(s.category || '').toLowerCase().replace(/ products$/, '') })}\n\n${(s.top || []).map((b, i) => `${i + 1}. ${b.name}${b.product ? `: ${b.product}` : ''} ${b.url || ''}`).join('\n')}${s.brief ? `\n\n${fill(C.result.brief, { brand: s.brief })} is on your result page.` : ''}\n\n${fill(C.result.read, { date: dayOf(s.checked) })}`;
  } else if (door === 'site') {
    const steps = C.result.deploySteps.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const missing = s.blockers || [];
    // Legal D49: what to add comes first, like README.txt, and nothing calls the site ready until it's in.
    const almost = `${C.result.almost}:\n${missing.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n${C.result.almostAgain}${doc.input && doc.input.email ? '' : ` ${C.result.almostEmail}`}\n\n${C.result.then}`;
    body = `${C.result.heading} ${fill(C.result.design, { design: s.design, business: s.business })}\n\n${missing.length ? almost : `${C.result.deploy}:`}\n${steps}`;
  } else {
    body = `${fill(C.result.heading, { score: s.score })} ${C.result.reads} ${fill(C.result.after, { after: s.after })}\n\n${C.result.fixes}:\n${(s.fixes || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n${C.result.rewrite}:\n${s.rewrite || ''}${s.magnet ? `\n\n${fill(C.result.magnet, { title: s.magnet })}. ${fill(C.result.keyword, { keyword: s.keyword })}.` : ''}`;
  }
  const subject = fill(C.email.subject, { score: s.score, category: String(s.category || '').toLowerCase(), business: s.business || 'your business' });
  return { subject, text: `${hi}\n\n${body}${sample}\n\n${open}\n${keep}\n\n${free}${adds}\n\n${stateBlock(null, startUrl(doc))}` };
}

// The email gate passed: the result belongs to that email, so it can come into HQ when they sign up with it.
async function claim(id, k, email) {
  if (!id || !signed(id, k)) return null;
  const doc = db.get('doorRuns', String(id));
  if (!doc) return null;
  doc.email = String(email || '').trim().toLowerCase().slice(0, 200) || doc.email;
  await db.save('doorRuns', doc);
  return doc;
}

// ---------- into 127 HQ (lib/harness/imports.js importDoor) ----------
// What the confirm screen shows before anything is saved.
function preview(id, k) {
  if (!signed(id, k)) return null;
  const doc = db.get('doorRuns', String(id));
  if (!doc) return null;
  const C = D.doors[doc.door];
  return { id: doc.id, k: sign(doc.id), door: doc.door, label: D.picker.doors.find((x) => x.id === doc.door).label, title: C.title.replace(/ · 127$/, ''), summary: doc.summary || {}, files: doc.files.length, sample: !!doc.sample, leads: doc.door === 'creator' ? (doc.summary || {}).count || 0 : 0 };
}

// { doc, files [{ name, type, buf }], leads { pack, rows }, business, links, niche, remember } for importDoor.
async function importPlan(id, k) {
  if (!signed(id, k)) return null;
  const doc = db.get('doorRuns', String(id));
  if (!doc) return null;
  const out = await outOf(doc);
  if (!out) return null;
  const plan = RUNS[doc.door].hq(doc, out, doc.input || {});
  const files = [];
  for (const f of doc.files) {
    const buf = await db.getBlob(`door_${doc.id}_${f.n}`);
    if (buf) files.push({ name: f.name, type: f.type, buf });
  }
  // A sample run (the Store audit's sample store) brings its files only: none of it is the member's business.
  if (doc.sample) return { doc, files, leads: null, business: {}, links: {}, niche: null, remember: [] };
  const remember = [...(plan.remember || []), ...(doc.remembered || [])];
  return { doc, files, leads: plan.leads || null, business: plan.business || {}, links: plan.links || {}, niche: plan.niche || null, remember };
}

async function markImported(doc, userId) {
  doc.imported = { ...(doc.imported || {}), [userId]: new Date().toISOString() };
  await db.save('doorRuns', doc);
}

// The newest result an email unlocked, not yet brought into this member's HQ (for HQ's Today offer).
function latestFor(email, userId) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const docs = db.filter('doorRuns', (d) => d.email === e && !d.sample && !(d.imported && d.imported[userId])).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return docs[0] ? preview(docs[0].id, sign(docs[0].id)) : null;
}

// ---------- clean-up ----------
async function removeDoc(d) {
  for (const f of d.files || []) await db.removeBlob(`door_${d.id}_${f.n}`).catch(() => {});
  await db.removeBlob(`door_${d.id}_out`).catch(() => {});
  await db.remove('doorRuns', d.id);
}
// Results and their files go after DOORS_KEEP_DAYS.
async function prune() {
  const keep = keepDays() * 864e5;
  let all = [];
  try {
    all = db.all('doorRuns');
  } catch {
    return 0;
  }
  const old = all.filter((d) => Date.now() - new Date(d.createdAt).getTime() > keep);
  for (const d of old) await removeDoc(d);
  return old.length;
}
// Account deletion (server.js deleteAccount): every result this email unlocked, with its files.
async function forget(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return 0;
  const mine = db.filter('doorRuns', (d) => d.email === e);
  for (const d of mine) await removeDoc(d);
  return mine.length;
}
setTimeout(() => prune().catch(() => {}), 90e3).unref();
setInterval(() => prune().catch(() => {}), 12 * 3600e3).unref();

// ---------- routes (mounted by lib/funnels.js) ----------
// deps: { json, limited, page, createMember, prelaunchGate } (page is lib/funnels.js's static page server).
function router({ json, limited, page, createMember, prelaunchGate } = {}) {
  const r = express.Router();
  const ipKey = (req) => crypto.createHash('sha256').update(`${process.env.SESSION_SECRET || 'dev'}:door:${req.ip}`).digest('hex').slice(0, 16);
  // Off for this visitor: the URL falls through to the site's 404.
  const gate = (req, res, next) => (liveFor(req.user) ? next() : next('route'));

  // The four pages: the same shell (public/funnels/door.html), told which door it is.
  const js = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  for (const id of IDS) {
    const C = D.doors[id];
    const og = () => ({ title: C.title, description: C.description, image: '/funnels/og/first-25.png', url: `${BASE()}${C.path}` });
    r.get(C.path, gate, page('door.html', og, { consentPage: () => C.source, inject: () => `<script>window.DOOR=${js(pageConfig(id))};</script>\n` }));
  }

  // A saved result (the email's link), on its own door's page.
  r.get('/door/r/:id([A-Za-z0-9_-]+)', gate, async (req, res, next) => {
    const doc = signed(req.params.id, req.query.k) ? db.get('doorRuns', req.params.id) : null;
    const out = doc ? await outOf(doc).catch(() => null) : null;
    if (!out) return next('route');
    const C = D.doors[doc.door];
    const og = () => ({ title: C.title, description: C.description, image: '/funnels/og/first-25.png', url: `${BASE()}${C.path}` });
    page('door.html', og, { noindex: true, consentPage: () => C.source, inject: () => `<script>window.DOOR=${js(pageConfig(doc.door))};window.DOOR_RUN=${js(view(doc, out))};</script>\n` })(req, res, next);
  });

  // A result's file. HTML and SVG only render when asked for a preview, inside a sandbox with no scripts
  // (like HQ's Library), so nothing a store or a visitor wrote can run on 127group.io.
  r.get('/door/r/:id([A-Za-z0-9_-]+)/file/:n(\\d+)', gate, async (req, res) => {
    const doc = signed(req.params.id, req.query.k) ? db.get('doorRuns', req.params.id) : null;
    const f = doc && (doc.files || []).find((x) => x.n === Number(req.params.n));
    if (!f) return res.status(404).type('text').send(D.copy.expired);
    if (limited('doorf:' + ipKey(req), 400)) return res.status(429).type('text').send(D.copy.limit);
    const buf = await db.getBlob(`door_${doc.id}_${f.n}`);
    if (!buf) return res.status(404).type('text').send(D.copy.expired);
    const html = f.type === 'text/html';
    const preview = (html || f.type === 'image/svg+xml') && !!req.query.preview && !req.query.download;
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data: https:; media-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; form-action 'none'; frame-ancestors 'self'; sandbox allow-top-navigation-to-custom-protocols");
    res.set('Content-Type', html ? (preview ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8') : f.type);
    // A preview shows inside its own result page (the site and the page mock-up), never on another site.
    if (preview) res.set('X-Frame-Options', 'SAMEORIGIN');
    const inline = preview || /^image\//.test(f.type);
    res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/["\\\r\n]/g, '')}"`);
    res.send(buf);
  });

  // Run a door. Streamed like First 25, so the page ticks each step off as it happens.
  r.post('/api/door/:door/run', json, async (req, res) => {
    const id = req.params.door;
    if (!liveFor(req.user) || !RUNS[id]) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    if (b.website) return res.status(400).json({ error: 'Something went wrong.' }); // honeypot
    let input;
    try {
      input = RUNS[id].clean(b);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    const who = ipKey(req);
    if (limited('door:' + who, int('DOORS_PER_IP', 6))) return res.status(429).json({ error: D.copy.limit });
    // Past the day's caps a run still finishes: the Store audit on a labeled sample store, AI on the templates.
    // A run on the sample store reads nothing live, so it neither counts toward the cap nor hears it's at the limit.
    const capped = !!RUNS[id].web && (!RUNS[id].live || RUNS[id].live(input)) && limited('door:live', int('DOORS_LIVE_CAP', 300));
    const ai = aiOn() && !limited('door:ai', int('DOORS_AI_CAP', 300));
    res.status(200).set({ 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
    if (res.flushHeaders) res.flushHeaders();
    const send = (o) => {
      res.write(JSON.stringify(o) + '\n');
      if (res.flush) res.flush();
    };
    const utm = b.utm && typeof b.utm === 'object' ? Object.fromEntries(Object.entries(b.utm).slice(0, 12).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 120)])) : {};
    try {
      const got = await run(id, input, { who, sample: capped, capped, ai, utm, progress: (step) => send({ type: 'progress', step }) });
      if (got.failed) {
        send({ type: 'failed', result: got.view });
      } else {
        require('./integrations').emit('door.run', { door: id, id: got.doc.id, sample: got.doc.sample, capped: got.doc.capped, ai: got.doc.ai, cost_usd: got.doc.usd });
        send({ type: 'result', run: view(got.doc, got.out) });
      }
    } catch (e) {
      console.warn(`[doors] ${id} run failed`, e.status || '', String(e.message || e).slice(0, 200));
      send({ type: 'error', error: e.status === 400 ? e.message : D.copy.failed });
    }
    res.end();
  });

  // ---------- into 127 HQ at signup ----------
  // A short account step (like /circle/apply): name, email, password, then the result's confirm screen in HQ.
  // First 25's list takes the same step (/start/first25/:id), into HQ's First 25 confirm screen
  // (lib/harness/routes.js /app/hq/import/first25/:id).
  const F25 = () => require('./first25');
  const JOIN = {
    door: {
      get: (id, k) => (signed(id, k) ? db.get('doorRuns', id) : null),
      p: (doc) => preview(doc.id, sign(doc.id)),
      next: (doc) => `/app/hq/import/door/${doc.id}?k=${sign(doc.id)}`,
      email: (doc) => doc.email || '',
      source: (doc) => `door:${doc.door}`,
    },
    first25: {
      get: (id, k) => (F25().signed(id, k) ? db.get('prospectRuns', id) : null),
      p: (doc) => ({ id: doc.id, k: F25().sign(doc.id), title: 'First 25 list' }),
      next: (doc) => `/app/hq/import/first25/${doc.id}?k=${F25().sign(doc.id)}`,
      // The email they unlocked the list with (lib/funnels.js /api/lead keeps the run's id on the lead).
      email: (doc) => (db.find('leads', (l) => l.source === 'first-25' && l.data && l.data.run_id === doc.id) || {}).email || '',
      source: () => 'funnel:first-25',
    },
  };
  const joinView = (res, kind, doc, { error = null, form = {} } = {}) =>
    res.status(error ? 400 : 200).render('door-join', { title: 'Start free', layout: 'bare', error, form, kind, p: JOIN[kind].p(doc), next: JOIN[kind].next(doc) });
  const joinable = (req) => {
    const doc = JOIN[req.params.kind].get(req.params.id, (req.body && req.body.k) || req.query.k);
    return doc && hqState() ? doc : null;
  };
  r.get('/start/:kind(door|first25)/:id([A-Za-z0-9_-]+)', (req, res) => {
    const kind = req.params.kind, doc = joinable(req);
    if (!doc) return res.redirect('/start');
    const next = JOIN[kind].next(doc);
    if (req.user) return res.redirect(next);
    if (prelaunchGate && prelaunchGate(req)) return res.redirect('/founding');
    joinView(res, kind, doc, { form: { email: JOIN[kind].email(doc) } });
  });
  r.post('/start/:kind(door|first25)/:id([A-Za-z0-9_-]+)', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res, next) => {
    try {
      const kind = req.params.kind, doc = joinable(req);
      if (!doc) return res.redirect('/start');
      const go = JOIN[kind].next(doc);
      if (req.user) return res.redirect(go);
      if (prelaunchGate && prelaunchGate(req)) return res.redirect('/founding');
      if (!createMember) return res.redirect('/start');
      const security = require('./security');
      if (!security.allow(`signup:${security.ip(req)}`, 5, 60 * 60 * 1000)) return joinView(res, kind, doc, { error: 'Too many tries in a short time. Wait a few minutes and try again.' });
      const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
      const name = String(req.body.name || '').trim().slice(0, 80);
      const password = String(req.body.password || '');
      const form = { name, email, optin: req.body.optin === 'on' };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return joinView(res, kind, doc, { error: 'Please enter a valid email.', form });
      if (password.length < 8) return joinView(res, kind, doc, { error: 'Use a password with at least 8 characters.', form });
      if (db.find('users', (u) => u.email === email)) return joinView(res, kind, doc, { error: kind === 'first25' ? 'That email already has an account. Sign in instead, and your list comes with you.' : 'That email already has an account. Sign in instead, and your result comes with you.', form });
      const ageCheck = require('./age-check');
      if (ageCheck.blocked(email)) return joinView(res, kind, doc, { error: ageCheck.SIGNUP_REFUSED, form });
      await createMember(req, { email, name, password, optIn: form.optin, fallbackSource: JOIN[kind].source(doc) });
      res.redirect(go);
    } catch (e) {
      next(e);
    }
  });

  return r;
}

module.exports = { on, aiOn, liveFor, picker, sign, signed, run, view, outOf, emailText, claim, doorOfSource, preview, importPlan, markImported, latestFor, prune, forget, router, builderList, pageConfig, storeFetch, hqState, RUNS, IDS, SOURCES };
