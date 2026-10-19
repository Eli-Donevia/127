// What the money desk knows about the member, and what it remembers between runs.
//
// Every number has one order: what the member typed in this run, then what this pack saved last
// time (brain.packs.finance), then what other packs saved (the offer pack's price, the brand pack's
// color), then the brain. Nothing is ever invented: a number nobody gave stays empty.
//
// Saved keys (each under the harness's 4 KB per key):
//   numbers  price, cost per job, how they get paid, fixed costs, startup, cash, pay rate...
//   history  the last 12 monthly check-ins (month, money in, jobs, costs, left)

const { brain, color, time, text } = require('../../_kit');
const niches = require('./niches');
const html = require('./html');

const PACK = 'finance';
const MAX_BYTES = 3800;

function mem(ctx) {
  return brain.packMemory(ctx, PACK);
}

function numbers(ctx) {
  const n = mem(ctx).numbers;
  return n && typeof n === 'object' ? n : {};
}

function history(ctx) {
  const h = mem(ctx).history;
  return Array.isArray(h) ? h.filter((x) => x && typeof x === 'object' && /^\d{4}-\d{2}$/.test(String(x.month || ''))) : [];
}

const NUMBER_KEYS = ['price', 'cost', 'method', 'share', 'fixed', 'bills', 'startup', 'cash', 'minutes', 'hourly', 'miles', 'jobsPerWeek', 'slow', 'best', 'bracket', 'stateRate', 'margin', 'service', 'color', 'type'];

function fit(obj) {
  let o = { ...obj };
  while (JSON.stringify(o).length > MAX_BYTES && Object.keys(o).length > 1) {
    const k = Object.keys(o).find((x) => typeof o[x] === 'string' && o[x].length > 40) || Object.keys(o)[Object.keys(o).length - 1];
    delete o[k];
  }
  return o;
}

// Saves the numbers this run was given, so the member types them once. Returns the keys that changed.
async function saveNumbers(ctx, patch = {}) {
  const cur = numbers(ctx);
  const next = { ...cur };
  const changed = [];
  for (const k of NUMBER_KEYS) {
    const v = patch[k];
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) continue;
    const val = typeof v === 'string' ? text.clip(v, 120) : v;
    if (JSON.stringify(cur[k]) !== JSON.stringify(val)) {
      next[k] = val;
      changed.push(k);
    }
  }
  if (changed.length) {
    next.updated = time.today(ctx);
    await brain.remember(ctx, 'numbers', fit(next));
  }
  return changed;
}

async function saveHistory(ctx, entry) {
  const list = history(ctx).filter((x) => x.month !== entry.month);
  const next = [entry, ...list].sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 12);
  let out = next;
  while (JSON.stringify(out).length > MAX_BYTES && out.length > 1) out = out.slice(0, -1);
  await brain.remember(ctx, 'history', out);
  return out;
}

const filled = (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');

// The first value someone actually gave.
function pick(...vals) {
  for (const v of vals) if (filled(v)) return v;
  return undefined;
}

function hexFrom(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^#?[0-9a-f]{6}$/i.test(s)) return s.startsWith('#') ? s : `#${s}`;
  return null;
}

// A brand color another pack saved (brand.palette.primary, brand.primary, sales settings...).
function brandColor(ctx) {
  const m = brain.packMemory(ctx, 'brand');
  const s = brain.packMemory(ctx, 'sales').settings || {};
  const cands = [m.palette && m.palette.primary, m.palette && m.palette.brand, m.primary, m.color, m.brandColor, Array.isArray(m.colors) ? m.colors[0] : null, m.colors && m.colors.primary, s.color];
  for (const c of cands) if (hexFrom(c)) return hexFrom(c);
  return null;
}

// The member's offer as the offer pack saved it: { what, price, ... }.
function offerMemory(ctx) {
  const m = brain.packMemory(ctx, 'offer');
  return m.offer && typeof m.offer === 'object' ? m.offer : {};
}

const PLURAL = { 'item sold': 'items sold' };

// The word for one unit of work: job, visit, session, project, sale, video, client.
function unitOf(type) {
  const u = type && type.unit;
  if (u === 'item sold') return { one: 'sale', many: 'sales' };
  if (u && /^[a-z]+$/.test(u)) return { one: u, many: PLURAL[u] || `${u}s` };
  return { one: 'job', many: 'jobs' };
}

// Who and what this run is about, plus the page theme. input wins over memory, memory over brain.
function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const n = numbers(ctx);
  const off = offerMemory(ctx);
  const what = text.oneLine(String(pick(input.what, b.what, b.niche, off.what, b.offer) || '')).slice(0, 120);
  const type = niches.typeById(String(input.type || '')) || niches.matchType(what, b.niche, b.offer, b.name) || niches.typeById(String(n.type || '')) || null;
  const seedHex = hexFrom(input.color) || brandColor(ctx) || hexFrom(n.color);
  const t = html.theme(seedHex || (type ? type.mood : 'clean'));
  const unit = unitOf(type);
  const today = time.today(ctx);
  return {
    b,
    n,
    off,
    name: b.name || '',
    display: b.name || (b.firstName ? `${b.firstName}'s business` : 'Your business'),
    what,
    type,
    unit,
    today,
    made: `Made ${time.longDate(today)}`,
    t,
    colorFrom: seedHex ? 'your color' : 'your type of business',
    place: b.place,
    firstName: b.firstName || ((ctx && ctx.member && ctx.member.firstName) || ''),
  };
}

module.exports = { PACK, numbers, history, saveNumbers, saveHistory, pick, filled, hexFrom, brandColor, offerMemory, unitOf, factsOf, color };
