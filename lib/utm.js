// Ad attribution: first-touch UTM capture and the site-admin joins export for the ad desk
// (ops/growth/ads/intake.md section 4). Meta undercounts joins because the pixel waits for cookie consent,
// so the desk counts joins from the site's own UTM data.
//
// Capture: server.js keeps the first UTM set a visitor arrives with in the session (30-day cookie), and the
// funnel pages keep theirs in localStorage (public/funnels/funnel-kit.js). Waitlist joins store it on the entry.
// Click ids are stored only as a flag ("1"), never the id itself.
//
// Export: GET /admin/joins.csv, counts only (no emails, names or other personal data), one row per date, ad and page:
//   date (Chicago time), utm_source, utm_medium, utm_campaign, utm_content, page, joins, quiz_starts, builders

const db = require('./db');

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const CLICK_KEYS = ['fbclid', 'ttclid'];
const COLUMNS = ['date', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'page', 'joins', 'quiz_starts', 'builders'];
const TZ = 'America/Chicago';

// Where a waitlist join happened, from the entry's source (lib/waitlist.js SOURCES, plus the challenge's).
const PAGE_BY_SOURCE = { founding: '/founding', quiz: '/score', stack: '/stack', 'idea-test': '/idea-test', challenge: '/challenge', home: '/', other: 'other' };
// Funnel ids used by /api/lead and /api/quiz-start.
const PAGE_BY_FUNNEL = { 'founder-score': '/score', 'day-one-stack': '/stack', 'idea-test': '/idea-test' };

// Keeps the known keys from any object (query, form body, client JSON), trimmed. Missing keys become null.
function cleanUtm(o) {
  const src = o && typeof o === 'object' ? o : {};
  const out = {};
  for (const k of UTM_KEYS) {
    const v = src[k] == null ? '' : String(src[k]).trim().slice(0, 100);
    out[k] = v || null;
  }
  for (const k of CLICK_KEYS) out[k] = src[k] ? '1' : null;
  return out;
}

// Only the keys that have a value (what the session keeps).
function present(o) {
  return Object.fromEntries(Object.entries(cleanUtm(o)).filter(([, v]) => v));
}
function hasAny(o) {
  return !!o && UTM_KEYS.some((k) => o[k]);
}

// First touch wins: earlier values are kept, later sources only fill keys that are still empty.
function firstTouch(...sets) {
  const out = cleanUtm({});
  for (const s of sets) {
    const c = cleanUtm(s);
    for (const k of Object.keys(out)) if (!out[k] && c[k]) out[k] = c[k];
  }
  return out;
}

// "2026-11-05" in Chicago time.
function chicagoDay(t) {
  const ms = typeof t === 'number' ? t : Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ }) : null;
}

const keyOf = (day, u, page) => JSON.stringify([day, u.utm_source || '', u.utm_medium || '', u.utm_campaign || '', u.utm_content || '', page || '']);

// One counter doc per Chicago day ("quizstarts:2026-11-05"), counts keyed by ad and page.
async function countQuizStart(quiz, utm, now = Date.now()) {
  const day = chicagoDay(now);
  const id = `quizstarts:${day}`;
  const doc = db.get('counters', id) || { id, day, counts: {} };
  const u = cleanUtm(utm);
  const k = keyOf(day, u, PAGE_BY_FUNNEL[quiz] || quiz);
  doc.counts[k] = (doc.counts[k] || 0) + 1;
  return db.save('counters', doc);
}

// Pure: builds the rows from plain arrays so it can be tested without the store.
//   data: { waitlist, users, billingRecords, leads, quizStarts: [{ counts }] }
//   opts: { from, to } as YYYY-MM-DD (Chicago), both optional and inclusive
function rows(data, opts = {}) {
  const { waitlist = [], users = [], billingRecords = [], leads = [], quizStarts = [] } = data;
  const agg = new Map();
  const add = (day, u, page, col, n = 1) => {
    if (!day) return;
    if (opts.from && day < opts.from) return;
    if (opts.to && day > opts.to) return;
    const k = keyOf(day, u || {}, page);
    const r = agg.get(k) || { key: JSON.parse(k), joins: 0, quiz_starts: 0, builders: 0 };
    r[col] += n;
    agg.set(k, r);
  };

  const wlByEmail = new Map(waitlist.map((w) => [w.email, w]));
  for (const w of waitlist) add(chicagoDay(w.createdAt), w.utm, PAGE_BY_SOURCE[w.source] || `/${w.source || 'founding'}`, 'joins');

  for (const doc of quizStarts) {
    for (const [k, n] of Object.entries((doc && doc.counts) || {})) {
      const [day, s, m, c, ct, page] = JSON.parse(k);
      add(day, { utm_source: s, utm_medium: m, utm_campaign: c, utm_content: ct }, page, 'quiz_starts', n);
    }
  }

  // Builders: each member's first paid Builder start (billing records), credited to the ad that brought them in.
  // Demo-billing and seeded demo accounts never count.
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
    const w = wlByEmail.get(u.email);
    const lead = leads.filter((l) => l.email === u.email).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
    const utm = hasAny(u.utm) ? u.utm : w && hasAny(w.utm) ? w.utm : lead && hasAny(lead.utm) ? lead.utm : {};
    const page = w ? PAGE_BY_SOURCE[w.source] || `/${w.source}` : lead ? PAGE_BY_FUNNEL[lead.source] || lead.source : '/start';
    add(chicagoDay(r.at), utm, page, 'builders');
  }

  return [...agg.values()]
    .sort((a, b) => a.key.join('\u0000').localeCompare(b.key.join('\u0000')))
    .map((r) => ({ date: r.key[0], utm_source: r.key[1], utm_medium: r.key[2], utm_campaign: r.key[3], utm_content: r.key[4], page: r.key[5], joins: r.joins, quiz_starts: r.quiz_starts, builders: r.builders }));
}

function fromStore(opts) {
  let leads = [];
  try { leads = db.all('leads'); } catch (e) { leads = []; }
  return rows({
    waitlist: db.all('waitlist'),
    users: db.all('users'),
    billingRecords: db.all('billingRecords'),
    leads,
    quizStarts: db.filter('counters', (c) => String(c.id).startsWith('quizstarts:')),
  }, opts);
}

// Stops spreadsheets from running a cell as a formula (same rule as the other admin exports).
function esc(v) {
  let t = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n]/.test(t) || t !== String(v == null ? '' : v) ? `"${t.replace(/"/g, '""')}"` : t;
}
function csv(list) {
  return [COLUMNS.join(','), ...list.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

module.exports = { UTM_KEYS, CLICK_KEYS, COLUMNS, cleanUtm, present, firstTouch, hasAny, chicagoDay, countQuizStart, rows, fromStore, csv };
