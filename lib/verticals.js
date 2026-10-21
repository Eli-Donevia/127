// Verticals: one platform, sold in niche slices ("127 for dog breeders"). Eli, Oct 21: build the most comprehensive
// platform, sell very niche parts of it into hundreds of verticals, find what converts and double down on it.
//
// A vertical is one file, content/verticals/<slug>.json (the README there lists the fields). Every vertical gets the
// same five things, all made from parts that already exist:
//   a page          /for/<slug>: their week in their words, their site already drafted, their pack, one free start
//   a site design   one of the site pack's designs, with a made-up sample business built on it (scripts/build-verticals.js)
//   a niche pack    Store items + 3 niche prompts, sold once through lib/shop.js as pack "v-<slug>" (unlisted on /packs)
//   a launch kit    hooks, ad angles, a ManyChat keyword and tagged links (admin only, /admin/verticals/<slug>)
//   a free start    one of the front doors (site, store audit, brand list), or the free plan while the doors are off
//
// Measuring: a visitor's vertical is first touch, like the UTM set (lib/utm.js): the first /for/<slug> page they open, or
// an ad link whose utm_campaign is "v-<slug>". It rides on the session and lands on the account, the waitlist entry and
// a pack purchase. Visits and free starts are counted per Chicago day, once per session, with no personal data. The
// board (/admin/verticals) runs visit -> free signup -> pack -> Builder per vertical and gives each one a verdict from
// content/verticals/_rules.json; the weekly readout says what to double down on and what to kill.
//
// VERTICALS: "on" shows the pages whose status is test or double; "admins" shows every vertical to ADMIN_EMAILS only;
// off or unset: /for 404s. The board is admins-only whatever the switch says. A vertical's status starts in its file and
// can be changed on the board (verticalState), so a kill doesn't wait for a deploy.

const fs = require('fs');
const path = require('path');
const db = require('./db');
const store = require('./store');
const flags = require('./harness/flags');
const utm = require('./utm');
const { check } = require('./copy-check');

const DIR = path.join(__dirname, '..', 'content', 'verticals');
const RULES_FILE = path.join(DIR, '_rules.json');
const KITS_DIR = path.join(__dirname, '..', 'content', 'shop', 'files');
// The sample sites (HTML, served at /for/<slug>/sample) and their phone posters (public, /verticals/<slug>.jpg).
const SAMPLES_DIR = path.join(DIR, '_samples');
const POSTERS_DIR = path.join(__dirname, '..', 'public', 'verticals');
const SLUG = /^[a-z][a-z0-9-]{1,40}$/;
const STATUSES = ['draft', 'ready', 'test', 'double', 'paused', 'killed'];
const PUBLIC = ['test', 'double'];
const DOORS = ['site', 'store', 'creator', 'offer'];
const DOOR_PATH = { site: '/site-tonight', store: '/store-audit', creator: '/brand-list', offer: '/offer-score' };
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse|headless|curl|wget|python|node-fetch/i;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- the switch ---------------------------------------------------------------------------------------------------

function setting() {
  const v = String(process.env.VERTICALS || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}

// ---- loading ------------------------------------------------------------------------------------------------------

let cache = null;
function siteDesigns() {
  // The site pack's designs, the animated ones included (live on the site with SITE_MOTION=on), so a vertical can name any.
  try {
    const { TEMPLATES } = require('./packs/site/lib/templates');
    const motion = require('./packs/site/lib/templates/motion');
    return new Set([...Object.keys(TEMPLATES), ...motion.map((m) => m.id)]);
  } catch (e) {
    return null;
  }
}
function hqPacks() {
  const dir = path.join(__dirname, 'packs');
  const out = new Map();
  for (const id of fs.readdirSync(dir)) {
    if (id.startsWith('_') || !fs.existsSync(path.join(dir, id, 'index.js'))) continue;
    try {
      const p = require(path.join(dir, id));
      out.set(id, { id, title: p.title || id, held: !!p.held });
    } catch (e) {
      out.set(id, { id, title: id, held: true });
    }
  }
  return out;
}

const text = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// One vertical file, checked. Problems are listed (test/verticals.test.js keeps them empty) and a vertical with any is
// held back from the public pages.
function normalize(raw, file, ctx) {
  const problems = [];
  const say = (m) => problems.push(`${file}: ${m}`);
  const v = { ...raw };
  if (!SLUG.test(v.slug || '')) say(`bad slug "${v.slug}"`);
  if (`${v.slug}.json` !== file) say('the file name must be the slug');
  if (!STATUSES.includes(v.status)) say(`status must be one of ${STATUSES.join(', ')}`);
  for (const k of ['name', 'one', 'group', 'h1', 'lede', 'description', 'keyword']) if (!text(v[k], 400)) say(`missing ${k}`);
  if (v.mark && !String(v.h1 || '').includes(v.mark)) say(`mark "${v.mark}" isn't in the h1`);
  // "an eyewear brand", "a UGC business": the pages slot the noun after an article.
  v.aOne = `${/^[aeio]/i.test(v.one || '') ? 'an' : 'a'} ${v.one}`;
  if (!Array.isArray(v.week) || v.week.length < 3 || v.week.length > 5) say('week needs 3 to 5 rows');
  v.week = (v.week || []).map((w) => ({ when: text(w.when, 3), job: text(w.job, 80), hand: text(w.hand, 140) }));
  v.site = v.site || {};
  if (ctx.designs && !ctx.designs.has(v.site.design)) say(`site design "${v.site.design}" isn't one of the site pack's designs`);
  if (!v.site.sample || !text(v.site.sample.business, 80) || !text(v.site.sample.what, 140)) say('site.sample needs a business and what it does');
  v.entry = { door: 'site', ...(v.entry || {}) };
  if (!DOORS.includes(v.entry.door)) say(`entry.door must be one of ${DOORS.join(', ')}`);
  if (!text(v.entry.label, 40)) say('entry.label is missing');
  const p = v.pack || {};
  const price = Number(p.price);
  if (!text(p.name, 40) || !Number.isFinite(price) || price < 9 || price > 99) say('pack needs a name and a price from $9 to $99');
  for (const id of p.items || []) {
    const item = ctx.lib.byId[id];
    if (!item || item.status !== 'ready') say(`pack item ${id} isn't a ready Store item`);
  }
  if (!Array.isArray(p.prompts) || p.prompts.length < 2) say('pack needs at least 2 niche prompts');
  for (const pr of p.prompts || []) if (!/^\d\d-[a-z0-9-]+$/.test(pr.id || '') || !pr.title || !pr.prompt) say(`prompt ${pr.id} needs an id like 01-name, a title and the prompt`);
  for (const id of v.hq || []) {
    const h = ctx.hq.get(id);
    if (!h) say(`hq pack ${id} doesn't exist`);
    else if (h.held) say(`hq pack ${id} is held, so members can't see it yet`);
  }
  if (!Array.isArray(v.hooks) || v.hooks.length < 4) say('needs at least 4 hooks');
  if (!Array.isArray(v.ads) || v.ads.length < 2) say('needs at least 2 ad angles');
  if (!/^[A-Z]{3,12}$/.test(v.keyword || '')) say('keyword: 3 to 12 capital letters');

  // The copy rules (lib/copy-check.js). The page and the ads run as paid-plan copy, since every page sells Builder too.
  // Prompts are the member's own tools, so only their summaries are checked.
  const words = [v.h1, v.lede, v.description, v.site.caption, p.line, ...(v.week || []).flatMap((w) => [w.job, w.hand]), ...(p.prompts || []).map((x) => x.summary), ...(v.hooks || []), ...(v.ads || []).flatMap((a) => [a.hook, a.body, a.headline])].filter(Boolean).join('\n');
  for (const hit of check(words, { paid: true }).filter((h) => h.severity === 'block')) say(`copy: "${hit.match}" (${hit.id}) ${hit.why}`);
  if (/—/.test(words)) say('copy: no em dashes');
  if (/\bTODO\b/.test(JSON.stringify(raw))) say('still has TODO lines from the scaffold');

  v.packSlug = `v-${v.slug}`;
  v.kit = `v-${v.slug}`;
  v.problems = problems;
  return v;
}

function load() {
  const ctx = { designs: siteDesigns(), hq: hqPacks(), lib: store.current() };
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  const list = [];
  const problems = [];
  const seenKeys = new Map();
  for (const f of files) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    } catch (e) {
      problems.push(`${f}: ${e.message}`);
      continue;
    }
    const v = normalize(raw, f, ctx);
    if (seenKeys.has(v.keyword)) v.problems.push(`${f}: keyword ${v.keyword} is also ${seenKeys.get(v.keyword)}'s`);
    seenKeys.set(v.keyword, v.slug);
    problems.push(...v.problems);
    list.push(v);
  }
  const bySlug = new Map(list.map((v) => [v.slug, v]));
  return { list, bySlug, problems, hq: ctx.hq };
}
function all() {
  if (!cache) cache = load();
  return cache;
}
function _reset() {
  cache = null;
  rulesCache = null;
}
let rulesCache = null;
function rules() {
  if (!rulesCache) rulesCache = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
  return rulesCache;
}

function get(slug) {
  return all().bySlug.get(String(slug || '')) || null;
}
function statusOf(v) {
  const s = v && db.get('verticalState', v.slug);
  return s && STATUSES.includes(s.status) ? s.status : v.status;
}
function isPublic(v) {
  return !!v && !v.problems.length && PUBLIC.includes(statusOf(v));
}
// Who sees /for/<slug>: everyone while VERTICALS=on and the vertical is testing or doubled; admins see every vertical
// while the switch is admins or on, so a ready one can be checked before it starts.
function visibleTo(user, v) {
  const s = setting();
  if (!v || s === 'off') return false;
  if (flags.admin(user)) return true;
  return s === 'on' && isPublic(v);
}
function publicList() {
  return all().list.filter(isPublic);
}

// ---- the parts each vertical is made of ---------------------------------------------------------------------------

// The pack, in lib/shop.js's catalog format. Unlisted: it sells on its vertical's page (and /packs/v-<slug> works for
// the receipt and files), but /packs, the homepage row and the bundle page don't list 24 niche packs.
function shopPacks() {
  return all().list.filter((v) => !v.problems.length && v.status !== 'draft').map((v) => ({
    slug: v.packSlug,
    name: v.pack.name,
    price: Number(v.pack.price),
    lookupKey: `pack_${v.packSlug}`,
    art: 'vertical',
    line: v.pack.line,
    pitch: v.lede,
    uses: v.week.slice(0, 3).map((w) => w.job),
    items: v.pack.items || [],
    kit: v.kit,
    kitFiles: kitFiles(v),
    unlisted: true,
    vertical: v.slug,
  }));
}
// The kit's files: the niche prompts (written by scripts/build-verticals.js), then any files copied from another kit.
function kitFiles(v) {
  const own = (v.pack.prompts || []).map((p) => p.id);
  const borrowed = v.pack.kitFrom ? (v.pack.kitFrom.files || []).map((f) => `${v.pack.kitFrom.kit}-${f}`) : [];
  return [...own, ...borrowed];
}
function promptFile(v, p) {
  return [
    `# ${p.title}`,
    '',
    p.summary,
    '',
    '## The prompt',
    '',
    'Copy everything in the box into Claude, ChatGPT or Gemini. Fill in the [brackets] first.',
    '',
    '```',
    p.prompt,
    '```',
    '',
    '## How to use it',
    '',
    p.use || '',
    '',
    `From the ${v.pack.name} by 127. Use it in your own business and for your clients; please don't resell the pack.`,
    '',
  ].join('\n');
}

// Where the free start goes. While the front doors are off, the free plan (or the founding list before launch).
function entryUrl(v, { doorsLive, prelaunch } = {}) {
  const q = new URLSearchParams({ ...(v.entry.query || {}), utm_campaign: `v-${v.slug}` });
  if (doorsLive) return `${DOOR_PATH[v.entry.door]}?${q}`;
  return prelaunch ? `/founding?${q}` : `/start?from=v-${v.slug}&${q}`;
}
function samplePath(v) {
  return `/for/${v.slug}/sample`;
}
function sampleFile(v) {
  const f = path.join(SAMPLES_DIR, `${v.slug}.html`);
  return fs.existsSync(f) ? f : null;
}
function posterPath(v) {
  const f = path.join(POSTERS_DIR, `${v.slug}.jpg`);
  return fs.existsSync(f) ? `/verticals/${v.slug}.jpg` : null;
}
function hqFor(v) {
  const hq = all().hq;
  return (v.hq || []).map((id) => hq.get(id)).filter((h) => h && !h.held);
}
function related(v, n = 4) {
  return publicList().filter((x) => x.slug !== v.slug && x.group === v.group).slice(0, n);
}

// The tagged links for the launch kit. utm_campaign "v-<slug>" ties every one of them back to the vertical.
function links(v, base) {
  const u = (source, medium, content) => {
    const q = new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: `v-${v.slug}` });
    if (content) q.set('utm_content', content);
    return `${base}/for/${v.slug}?${q}`;
  };
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    { label: 'Instagram bio', url: u('instagram', 'bio') },
    { label: 'Instagram story', url: u('instagram', 'story') },
    { label: 'TikTok bio', url: u('tiktok', 'bio') },
    { label: `ManyChat (keyword ${v.keyword})`, url: u('manychat', 'dm', v.keyword.toLowerCase()) },
    ...v.ads.map((a) => ({ label: `Meta ad: ${a.angle}`, url: u('meta', 'paid', slugify(a.angle)) })),
    { label: 'Ambassador (add their name after amb-)', url: u('amb-NAME', 'referral') },
  ];
}

// ---- attribution --------------------------------------------------------------------------------------------------

function fromCampaign(c) {
  const m = /^v-([a-z0-9-]+)$/.exec(String(c || '').trim().toLowerCase());
  return m && get(m[1]) ? m[1] : null;
}
// server.js runs this on every request: an ad link straight to a door ("utm_campaign=v-dog-breeders") counts too.
function middleware(req, res, next) {
  if (req.session && !req.session.vertical && req.query && req.query.utm_campaign) {
    const slug = fromCampaign(req.query.utm_campaign);
    if (slug) req.session.vertical = slug;
  }
  next();
}
function tag(req, slug) {
  if (req.session && !req.session.vertical && get(slug)) req.session.vertical = slug;
}
function current(req) {
  const s = req && req.session && req.session.vertical;
  return s && get(s) ? s : null;
}

// ---- counting -----------------------------------------------------------------------------------------------------

// Where the visitor came from: this link's utm_source, else the session's first one, else what their first vertical
// page saw, so a free start on the same visit counts under the same source as the visit.
function sourceOf(req) {
  const q = (req.session && req.session.utm) || {};
  const s = text(req.query.utm_source || q.utm_source || req.session.vSource || (req.get('referer') ? 'referral' : 'direct'), 40).toLowerCase();
  if (!req.session.vSource) req.session.vSource = s;
  return s;
}
// Once per session, vertical, kind and Chicago day. Bots and link previews don't count.
async function count(req, slug, kind, now = Date.now()) {
  if (!get(slug) || BOTS.test(req.get('user-agent') || '')) return false;
  const day = utm.chicagoDay(now);
  const seen = (req.session.vSeen = req.session.vSeen || {});
  const key = `${slug}|${kind}`;
  if (seen[key] === day) return false;
  seen[key] = day;
  // Keep the session cookie small: only today's marks.
  for (const k of Object.keys(seen)) if (seen[k] !== day) delete seen[k];
  const id = `verticals:${day}`;
  const doc = db.get('counters', id) || { id, day, counts: {} };
  const k = `${slug}|${kind}|${sourceOf(req)}`;
  doc.counts[k] = (doc.counts[k] || 0) + 1;
  await db.save('counters', doc);
  return true;
}

// ---- the board ----------------------------------------------------------------------------------------------------

const inRange = (day, o) => !!day && (!o.from || day >= o.from) && (!o.to || day <= o.to);
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Pure, so it can be tested without the store.
//   data: { list (verticals), counters, users, waitlist, purchases, billingRecords, spend }
//   opts: { from, to } YYYY-MM-DD (Chicago), inclusive; rules from _rules.json
function board(data, opts = {}, R = rules()) {
  const { list = [], counters = [], users = [], waitlist = [], purchases = [], billingRecords = [], spend = [] } = data;
  const rows = new Map(list.map((v) => [v.slug, { slug: v.slug, name: v.name, group: v.group, status: v.statusNow || v.status, wave: v.wave || null, price: Number(v.pack && v.pack.price) || 0, visits: 0, starts: 0, signups: 0, packs: 0, packRevenue: 0, builders: 0, spend: 0, sources: {} }]));
  const row = (slug) => rows.get(slug);

  for (const doc of counters) {
    if (!inRange(doc.day, opts)) continue;
    for (const [k, n] of Object.entries(doc.counts || {})) {
      const [slug, kind, source] = k.split('|');
      const r = row(slug);
      if (!r) continue;
      if (kind === 'visit') {
        r.visits += n;
        r.sources[source] = (r.sources[source] || 0) + n;
      } else if (kind === 'go') r.starts += n;
    }
  }

  // A free signup is a person, counted once: a new account or a founding list join, whichever came first.
  const signed = new Map();
  const mark = (slug, email, at) => {
    if (!slug || !email || !row(slug)) return;
    const day = utm.chicagoDay(at);
    const prev = signed.get(email);
    if (!prev || String(at) < String(prev.at)) signed.set(email, { slug, day, at });
  };
  const slugOfPerson = (p) => p.vertical || fromCampaignIn(p.utm, list);
  for (const u of users) if (!u.demoAccount && !u.demoBilling) mark(slugOfPerson(u), u.email, u.createdAt);
  for (const w of waitlist) mark(slugOfPerson(w), w.email, w.createdAt);
  for (const s of signed.values()) if (inRange(s.day, opts)) row(s.slug).signups += 1;

  // Packs: the vertical's own pack wherever it was bought, and any pack bought by someone who came in on the vertical.
  for (const p of purchases) {
    if (p.refundedAt || p.demo) continue;
    const slug = String(p.pack || '').startsWith('v-') && row(p.pack.slice(2)) ? p.pack.slice(2) : p.vertical;
    if (!row(slug) || !inRange(utm.chicagoDay(p.paidAt), opts)) continue;
    row(slug).packs += 1;
    row(slug).packRevenue += Number(p.amount) || 0;
  }

  const usersById = new Map(users.map((u) => [u.id, u]));
  const firstStart = new Map();
  for (const r of billingRecords) {
    if (!['start', 'upgrade'].includes(r.kind) || r.plan !== 'builder') continue;
    const prev = firstStart.get(r.userId);
    if (!prev || String(r.at) < String(prev.at)) firstStart.set(r.userId, r);
  }
  for (const [userId, r] of firstStart) {
    const u = usersById.get(userId);
    if (!u || u.demoBilling || u.demoAccount) continue;
    const slug = slugOfPerson(u);
    if (row(slug) && inRange(utm.chicagoDay(r.at), opts)) row(slug).builders += 1;
  }

  for (const s of spend) if (row(s.slug) && inRange(s.week, opts)) row(s.slug).spend += Number(s.usd) || 0;

  const out = [...rows.values()].map((r) => {
    const paid = r.packs + r.builders;
    return {
      ...r,
      paid,
      signupRate: r.visits ? r.signups / r.visits : 0,
      startRate: r.visits ? r.starts / r.visits : 0,
      paidRate: r.signups ? paid / r.signups : 0,
      paidPer100: r.visits ? (paid / r.visits) * 100 : 0,
      revenue: r.packRevenue + r.builders * (Number(R.builderValue) || 0),
      costPerSignup: r.spend && r.signups ? r.spend / r.signups : null,
      costPerPaid: r.spend && paid ? r.spend / paid : null,
    };
  });
  const judged = out.filter((r) => r.visits >= R.minVisits);
  const med = median(judged.map((r) => r.paidPer100));
  for (const r of out) Object.assign(r, verdict(r, R, med));
  const order = { double: 0, keep: 1, early: 2, kill: 3, off: 4 };
  return out.sort((a, b) => order[a.verdict] - order[b.verdict] || b.paidPer100 - a.paidPer100 || b.visits - a.visits);
}
function fromCampaignIn(u, list) {
  const m = u && /^v-([a-z0-9-]+)$/.exec(String(u.utm_campaign || '').toLowerCase());
  return m && list.some((v) => v.slug === m[1]) ? m[1] : null;
}

// The verdict and the one-line reason the board shows next to it.
function verdict(r, R, med) {
  if (!PUBLIC.includes(r.status) && !r.visits) return { verdict: 'off', why: r.status === 'killed' ? 'Killed.' : 'Not testing yet.' };
  if (r.spend >= R.killSpendNoPaid && r.paid === 0) return { verdict: 'kill', why: `$${Math.round(r.spend)} spent and nobody paid.` };
  if (r.visits < R.minVisits) return { verdict: 'early', why: `${r.visits} of ${R.minVisits} visits needed to judge.` };
  if (r.signupRate < R.killSignupRate) return { verdict: 'kill', why: `${pct(r.signupRate)} of visitors signed up (kill line ${pct(R.killSignupRate)}).` };
  if (r.signups >= R.killSignupsNoPaid && r.paid === 0) return { verdict: 'kill', why: `${r.signups} free signups and nobody paid.` };
  if (r.paid >= R.doubleMinPaid && r.signupRate >= R.doubleSignupRate && r.paidPer100 >= med * R.doubleVsMedian) {
    return { verdict: 'double', why: `${r.paidPer100.toFixed(1)} paid per 100 visits, ${med ? `${(r.paidPer100 / med).toFixed(1)}x the median` : 'ahead of the field'}.` };
  }
  return { verdict: 'keep', why: r.paid ? `${r.paid} paid so far; not yet ${R.doubleVsMedian}x the median.` : `${pct(r.signupRate)} sign up; waiting on the first sale.` };
}
const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

function fromStore(opts) {
  const list = all().list.map((v) => ({ ...v, statusNow: statusOf(v) }));
  return board({
    list,
    counters: db.filter('counters', (c) => String(c.id).startsWith('verticals:')),
    users: db.all('users'),
    waitlist: db.all('waitlist'),
    purchases: db.all('packPurchases'),
    billingRecords: db.all('billingRecords'),
    spend: db.all('verticalSpend'),
  }, opts);
}

// The weekly readout: the last full Monday-to-Sunday week (Chicago) next to all time, and what to do about each.
function lastWeek(now = Date.now()) {
  const today = utm.chicagoDay(now);
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday 0
  const end = new Date(d.getTime() - (dow + 1) * DAY_MS);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  const f = (x) => x.toISOString().slice(0, 10);
  return { from: f(start), to: f(end) };
}
function readout(weekRows, allRows, range) {
  const byAll = new Map(allRows.map((r) => [r.slug, r]));
  const pick = (v) => allRows.filter((r) => r.verdict === v);
  const lines = [];
  const doubles = pick('double');
  const kills = pick('kill');
  const keeps = pick('keep');
  const early = pick('early');
  const v = (slug) => get(slug);
  lines.push(`# Verticals, week of ${range.from} to ${range.to}`, '');
  const wk = weekRows.reduce((a, r) => ({ visits: a.visits + r.visits, signups: a.signups + r.signups, paid: a.paid + r.paid, revenue: a.revenue + r.revenue }), { visits: 0, signups: 0, paid: 0, revenue: 0 });
  lines.push(`This week: ${wk.visits} visits, ${wk.signups} free signups, ${wk.paid} paid (packs and Builder starts), about $${Math.round(wk.revenue)} in first payments.`, '');
  lines.push('## Double down', '');
  if (!doubles.length) lines.push('Nothing has earned it yet.', '');
  for (const r of doubles) {
    const x = v(r.slug);
    lines.push(`- **${r.name}**: ${r.why} Next: three new hooks from the one that brought the most visits, the pack page in the bio for a week, and test ${x && x.next && x.next.length ? x.next.join(', ') : 'two adjacent verticals'}. Any ad budget change is Eli's call.`);
  }
  lines.push('', '## Kill', '');
  if (!kills.length) lines.push('Nothing to kill.', '');
  for (const r of kills) lines.push(`- **${r.name}**: ${r.why} Set it to killed on the board; its page stops showing.`);
  lines.push('', '## Keep testing', '');
  for (const r of keeps) {
    const w = weekRows.find((x) => x.slug === r.slug) || {};
    lines.push(`- ${r.name}: ${r.why} This week ${w.visits || 0} visits, ${w.signups || 0} signups.`);
  }
  if (!keeps.length) lines.push('None.');
  lines.push('', '## Too early', '');
  lines.push(early.length ? early.map((r) => `${r.name} (${r.visits})`).join(', ') : 'None.');
  lines.push('', `Rules: content/verticals/_rules.json. A vertical needs ${rules().minVisits} visits before it gets a verdict.`, '');
  return { range, week: weekRows, all: [...byAll.values()], doubles, kills, keeps, early, markdown: lines.join('\n') };
}
function weekly(now = Date.now()) {
  const range = lastWeek(now);
  return readout(fromStore(range), fromStore({}), range);
}

async function setStatus(slug, status, by) {
  if (!get(slug) || !STATUSES.includes(status)) return null;
  return db.save('verticalState', { id: slug, status, by: by || null, at: new Date().toISOString() });
}
// Spend is entered by hand per vertical and week (Monday's date), from the ad desk or Meta's screen.
async function addSpend(slug, week, usd, note, by) {
  if (!get(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(String(week)) || !(Number(usd) >= 0)) return null;
  const id = `${slug}:${week}`;
  return db.save('verticalSpend', { id, slug, week, usd: Math.round(Number(usd) * 100) / 100, note: text(note, 120), by: by || null, at: new Date().toISOString() });
}

module.exports = {
  DIR, KITS_DIR, SAMPLES_DIR, POSTERS_DIR, STATUSES, PUBLIC, DOOR_PATH,
  setting, all, get, rules, statusOf, isPublic, visibleTo, publicList,
  shopPacks, kitFiles, promptFile, entryUrl, samplePath, sampleFile, posterPath, hqFor, related, links,
  fromCampaign, middleware, tag, current, count,
  board, verdict, fromStore, lastWeek, readout, weekly, setStatus, addSpend,
  _reset,
};
