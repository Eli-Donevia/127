// 127 HQ (product/hub/v1-spec.md): one screen where Builders run the business once it's real.
// Weekly numbers with 12 weeks of history, where it leaks and the week's call (the KPI Dashboard
// calculator's rules, moved to the server so the two never disagree), up to 6 numbers of their own,
// and sales that count themselves from Stripe, Shopify or the member's 127 link.
//
// HQ_LIVE=true   shows HQ. Off: no nav item, and /app/hq* and /hq/in/* fall through to the 404.
// HQ_SECRET      32+ characters. Encrypts Stripe keys and Shopify signing keys (AES-256-GCM).
//                Unset: Stripe and Shopify can't be connected; typed numbers and the 127 link still work.
//
// Read-only: nothing here writes to a member's Stripe or Shopify. Totals, not customers (H8): only
// weekly counts and sums are kept; names, emails and addresses in their data are never stored.
// Keys and the 127 link live in the hqConnections collection (doc id = user id), never on the user
// doc, so exports and the ops feed can't carry them.

const crypto = require('crypto');
const security = require('./security');
const { plan, canAccess } = require('./plans');

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  stripe: (key) => new (require('stripe'))(key, { maxNetworkRetries: 1, timeout: 20000, appInfo: { name: '127 HQ', url: 'https://127group.io' } }),
  emit: (type, payload) => require('./integrations').emit(type, payload),
};
function _setDeps(over) {
  Object.assign(deps, over);
}

const DAY = 864e5;
const WEEK = 7 * DAY;
const KEEP_WEEKS = 104;
const SERIES_WEEKS = 12;
const MAX_CUSTOM = 6;
const MAX_VALUE = 1e9;
const STRIPE_CAP = 3000;
const SEEN_MAX = 1000;
const LINK_PER_HOUR = 120;

function live() {
  return process.env.HQ_LIVE === 'true';
}
function secretReady() {
  return String(process.env.HQ_SECRET || '').length >= 32;
}
// Builders and Circle members, and members on a pause (their numbers are theirs).
function canUse(user) {
  return !!user && (canAccess(user, 'builder') || (!!user.pausedTier && plan(user.pausedTier).rank >= plan('builder').rank));
}
function iso(t = deps.now()) {
  return new Date(t).toISOString();
}

// ---------- weeks ----------
// A week runs Monday to Sunday in Eastern Time, keyed by Monday's date (H9). Worked out on the ET
// calendar date, so a DST change never moves a week.
const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekKey(ms = deps.now()) {
  const p = Object.fromEntries(ET.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - DOW[p.weekday])).toISOString().slice(0, 10);
}
function addWeeks(key, n) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * WEEK).toISOString().slice(0, 10);
}
// HQ opens on the week that just ended on Mondays and Tuesdays (the Monday review), else on this week.
function defaultWeek(ms = deps.now()) {
  const day = ET.formatToParts(new Date(ms)).find((x) => x.type === 'weekday').value;
  return DOW[day] <= 1 ? addWeeks(weekKey(ms), -1) : weekKey(ms);
}
// A week a member can open: a Monday from 103 weeks ago up to this week.
function okWeek(s) {
  const cur = weekKey();
  return isWeekKey(s) && s <= cur && s >= addWeeks(cur, -(KEEP_WEEKS - 1));
}
function isWeekKey(s) {
  const t = Date.parse(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && Number.isFinite(t) && new Date(t).getUTCDay() === 1 && new Date(t).toISOString().slice(0, 10) === s;
}
function shortDate(key) {
  const d = new Date(`${key}T00:00:00Z`);
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
// "Feb 22 to 28", or "Mar 29 to Apr 4" across a month.
function weekRange(key) {
  const s = new Date(`${key}T00:00:00Z`);
  const e = new Date(s.getTime() + 6 * DAY);
  return `${shortDate(key)} to ${s.getUTCMonth() === e.getUTCMonth() ? '' : MON[e.getUTCMonth()] + ' '}${e.getUTCDate()}`;
}

// ---------- numbers ----------
// The KPI Dashboard's 8 weekly numbers (public/js/worksheet.js `kpi`), in its order.
const METRICS = [
  { id: 'posts', label: 'Posts', input: true },
  { id: 'outreach', label: 'Outreach', input: true },
  { id: 'reach', label: 'Reach' },
  { id: 'visits', label: 'Visits' },
  { id: 'leads', label: 'Leads' },
  { id: 'replies', label: 'Replies', long: 'Replies to outreach' },
  { id: 'sales', label: 'Sales' },
  { id: 'revenue', label: 'Revenue', money: true },
];
const BASE_IDS = METRICS.map((m) => m.id);
const SOURCES = { stripe: 'Stripe', shopify: 'Shopify', link: '127 link' };
const CALLS = { double: 'Double down', pause: 'Pause', kill: 'Kill' };

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function hqOf(user) {
  return (user && user.hq) || {};
}
function ensure(user) {
  const h = (user.hq = user.hq || {});
  h.startedAt = h.startedAt || iso();
  h.weeks = h.weeks || {};
  h.auto = h.auto || {};
  h.targets = h.targets || {};
  h.custom = h.custom || [];
  h.hidden = h.hidden || [];
  return h;
}
function customDef(user, id) {
  return (hqOf(user).custom || []).find((c) => c.id === id) || null;
}
function metricDef(user, id) {
  const m = METRICS.find((x) => x.id === id);
  if (m) return { ...m };
  const c = customDef(user, id);
  return c ? { id: c.id, label: c.label, money: c.kind === 'money', custom: true, total: c.mode === 'total' } : null;
}
// The numbers a member sees: the 8 (minus any they hid), then their own.
function metrics(user) {
  const h = hqOf(user);
  const hidden = new Set(h.hidden || []);
  return METRICS.filter((m) => !hidden.has(m.id)).map((m) => ({ ...m })).concat((h.custom || []).map((c) => metricDef(user, c.id)));
}
function northId(user) {
  const n = hqOf(user).north;
  return n && metricDef(user, n) ? n : 'revenue';
}
function targets(user) {
  const t = hqOf(user).targets || {};
  return { posts: num(t.posts) || 0, outreach: num(t.outreach) || 0 };
}

// One week's number: what the member typed plus every connection's count for that week. A running
// total (an email list) takes the 127 link's value over a typed one instead of adding. null: nothing.
function valueOf(user, key, id) {
  const h = hqOf(user);
  const w = (h.weeks || {})[key];
  const typed = num(w && w.v && w.v[id]);
  const auto = h.auto || {};
  if ((customDef(user, id) || {}).mode === 'total') {
    const fromLink = num(((auto.link || {})[key] || {})[id]);
    return fromLink !== null ? fromLink : typed;
  }
  let total = typed;
  for (const s of Object.keys(SOURCES)) {
    const a = num(((auto[s] || {})[key] || {})[id]);
    if (a !== null) total = (total || 0) + a;
  }
  return total;
}
// What connections counted for one number in one week: [{ source: 'Shopify', value }].
function autoParts(user, key, id) {
  const auto = hqOf(user).auto || {};
  return Object.keys(SOURCES)
    .map((s) => ({ source: SOURCES[s], value: num(((auto[s] || {})[key] || {})[id]) }))
    .filter((p) => p.value !== null && p.value !== 0);
}
function typedOf(user, key, id) {
  const w = (hqOf(user).weeks || {})[key];
  return num(w && w.v && w.v[id]);
}
// The last n weeks of one number, oldest first. A running total carries its last value through quiet weeks.
function series(user, id, endKey, n = SERIES_WEEKS) {
  const total = (customDef(user, id) || {}).mode === 'total';
  const out = [];
  let carry = null;
  for (let i = n - 1; i >= 0; i--) {
    const key = addWeeks(endKey, -i);
    let v = valueOf(user, key, id);
    if (total) {
      if (v === null) v = carry;
      else carry = v;
    }
    out.push({ key, v });
  }
  return out;
}
// The calculator's inputs for one week: the 8 numbers, null where nothing was logged.
function weekInput(user, key) {
  return Object.fromEntries(BASE_IDS.map((id) => [id, valueOf(user, key, id)]));
}
function hasData(user, endKey, n = SERIES_WEEKS) {
  const ids = BASE_IDS.concat((hqOf(user).custom || []).map((c) => c.id));
  for (let i = 0; i < n; i++) {
    const key = addWeeks(endKey, -i);
    if (ids.some((id) => valueOf(user, key, id) !== null)) return true;
  }
  return false;
}

// ---------- the calculator, server side ----------
// Same floors, sample-size minimums, weakest-step rule, verdicts and summary line as the KPI
// Dashboard calculator in public/js/worksheet.js (test/hq.test.js runs both on the same numbers).
// Starting floors and sample-size minimums are 127 rules of thumb, not public benchmarks.
const STEPS = {
  r1: { label: 'Reach → visits', floor: 0.01, close: 1, hint: 'People see you but don’t look closer. Test new hooks and fix your bio and pinned posts. See the Hook & Caption Bank.', parts: ['visits', 'reach'], slug: 'hooks-library' },
  r2: { label: 'Visits → leads', floor: 0.03, close: 3, hint: 'People look but don’t raise a hand. Make the offer and the next step obvious. See The One-Page Offer.', parts: ['inbound', 'visits'], slug: 'offer-builder' },
  r6: { label: 'Reply rate', floor: 0.10, close: 2, hint: 'Outreach isn’t getting replies. Make messages shorter and more personal, and send them to warmer people. See Outreach Scripts.', parts: ['replies', 'outreach'], slug: 'dm-outreach-scripts' },
  r3: { label: 'Leads → sales', floor: 0.10, close: 4, hint: 'Conversations aren’t closing. That’s usually trust, price framing or offer clarity, not traffic. See Outreach Scripts.', parts: ['sales', 'leads'], slug: 'dm-outreach-scripts' },
};

function money(n) {
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + (Math.round(a * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: a < 10 ? 2 : 0 });
}
function pct(n) {
  return Math.round(n * 10) / 10 + '%';
}

// Counts and rates for one week. Negatives count as 0; a blank replies box means every lead was inbound.
function rates(v) {
  const g = (k) => Math.max(0, num(v && v[k]) || 0);
  const x = { posts: g('posts'), outreach: g('outreach'), reach: g('reach'), visits: g('visits'), leads: g('leads'), replies: g('replies'), sales: g('sales'), revenue: g('revenue') };
  x.repliesBlank = num(v && v.replies) === null;
  x.inbound = x.repliesBlank ? x.leads : Math.max(x.leads - x.replies, 0);
  const q = (a, b, ok) => (b > 0 ? { v: a / b, ok } : null);
  x.r1 = q(x.visits, x.reach, x.reach >= 500);
  x.r2 = q(x.inbound, x.visits, x.visits >= 100);
  x.r3 = q(x.sales, x.leads, x.leads >= 10);
  x.r4 = q(x.revenue, x.sales, true);
  x.r5 = q(x.revenue, x.leads, x.leads >= 10);
  x.r6 = x.outreach > 0 && x.replies > 0 ? q(x.replies, x.outreach, x.outreach >= 20) : null;
  x.r7 = q(x.reach, x.posts, true);
  // Selling straight from a store (sales but no leads): visits to sales replaces visits to leads.
  x.r8 = !x.leads && x.sales > 0 ? q(x.sales, x.visits, x.visits >= 100) : null;
  if (x.r8) x.r2 = null;
  return x;
}

function analyze(thisWeek, lastWeek, goals = {}) {
  const T = rates(thisWeek);
  const L = rates(lastWeek);
  const keys = BASE_IDS;
  if (!keys.some((k) => T[k] > 0)) return { empty: true, rows: [], notes: [], extra: [], weakest: null, weakLine: '', verdict: '', summary: '' };
  const hasLast = keys.some((k) => L[k] > 0);
  const pts = (k) => (L[k] ? ' (' + (T[k].v - L[k].v >= 0 ? '+' : '') + ((T[k].v - L[k].v) * 100).toFixed(1) + ' pts)' : '');
  const chg = (k) => (L[k] && L[k].v ? ' (' + (T[k].v >= L[k].v ? '+' : '') + Math.round(((T[k].v - L[k].v) / L[k].v) * 100) + '%)' : '');
  const few = ' (too few to judge)';
  const rateRow = (k, label) => {
    const t = T[k];
    return t ? [label, (t.v * 100).toFixed(1) + '%' + pts(k) + (t.ok ? '' : few), !t.ok] : null;
  };
  const rows = [
    rateRow('r1', 'Reach → visits'), rateRow('r2', 'Visits → leads'), rateRow('r8', 'Visits → sales'), rateRow('r3', 'Leads → sales'),
    T.r4 ? ['Average sale', money(T.r4.v) + chg('r4')] : null,
    T.r5 ? ['Revenue per lead', money(T.r5.v) + chg('r5') + (T.r5.ok ? '' : few), !T.r5.ok] : null,
    rateRow('r6', 'Reply rate'),
    T.r7 ? ['Reach per post', Math.round(T.r7.v).toLocaleString() + chg('r7')] : null,
  ].filter(Boolean);
  const notes = [];
  if (T.r3 && T.r3.v > 1) notes.push('More sales than leads: count every buyer as a lead so the chain stays honest.');
  if (!T.repliesBlank && T.replies > T.leads) notes.push('Replies are part of leads. Check your counts.');
  // Weakest step: a big drop from last week first, else the step furthest below its starting floor.
  let weakest = null;
  let reason = '';
  let floorNote = false;
  const judged = Object.keys(STEPS).filter((k) => T[k] && T[k].ok);
  const drops = judged
    .filter((k) => L[k] && L[k].ok && L[k].v > 0)
    .map((k) => ({ k, d: (T[k].v - L[k].v) / L[k].v }))
    .filter((x) => x.d <= -0.2)
    .sort((a, b) => a.d - b.d);
  if (drops.length) {
    weakest = drops[0].k;
    reason = 'dropped ' + Math.round(-drops[0].d * 100) + '% from last week';
  } else {
    const below = judged
      .map((k) => ({ k, ratio: T[k].v / STEPS[k].floor }))
      .filter((x) => x.ratio < 1)
      .sort((a, b) => a.ratio - b.ratio);
    if (below.length) {
      // Within 0.1 of the lowest, fix the step closest to the sale first.
      const pick = below.filter((x) => x.ratio - below[0].ratio <= 0.1).sort((a, b) => STEPS[b.k].close - STEPS[a.k].close)[0];
      weakest = pick.k;
      reason = 'below the starting floor of ' + pct(STEPS[pick.k].floor * 100);
      floorNote = true;
    }
  }
  const weakLine = weakest ? 'Weakest step: ' + STEPS[weakest].label + ', ' + reason + '. ' + STEPS[weakest].hint : 'No clear leak this week. Keep inputs on target and run one test.';
  const extra = [];
  if (floorNote) extra.push('Starting floors are rough. After 4 weeks, beat your own average instead.');
  if (T.r4 && L.r4 && L.r4.v > 0 && (T.r4.v - L.r4.v) / L.r4.v <= -0.2) extra.push('Each sale is worth less than last week. Check discounts and add-ons. See the Pricing Worksheet.');
  // Input vs result: check the lead measures before changing the strategy.
  let verdict = '';
  const gP = num(goals.posts) || 0;
  const gO = num(goals.outreach) || 0;
  if (hasLast) {
    const inputsDown = gP > 0 || gO > 0 ? (gP > 0 && T.posts < gP) || (gO > 0 && T.outreach < gO) : T.posts + T.outreach < 0.8 * (L.posts + L.outreach);
    const resultsDown = T.leads < 0.8 * L.leads || T.sales < L.sales;
    const resultsUp = T.leads > 1.2 * L.leads || T.sales > L.sales;
    verdict = inputsDown && resultsDown ? 'You did less this week. Get back to your input targets before you change the strategy.'
      : !inputsDown && resultsDown ? 'Inputs held and results fell. Change one thing in the message, hook or offer, not the volume.'
      : !inputsDown && resultsUp ? 'Inputs on target and results up. Double down: same format, same channel, same message.'
      : inputsDown && resultsUp ? 'Results rose on less effort. Find the post, message or referral that did it and write down why.'
      : 'Steady week. Keep inputs on target and test one change on your weakest step.';
  }
  const target = (k, g) => T[k] + (g > 0 ? '/' + g : '');
  const counts = 'This week: posts ' + target('posts', gP) + ', outreach ' + target('outreach', gO) + ', reach ' + T.reach + ', visits ' + T.visits + ', leads ' + T.leads + (T.repliesBlank ? '' : ' (replies ' + T.replies + ')') + ', sales ' + T.sales + ', revenue ' + money(T.revenue) + '.';
  const plain = rows.map((r) => r[0] + ': ' + r[1]).join('; ');
  const summary = counts + (rows.length ? ' ' + plain + '.' : '') + ' ' + (weakest ? 'Weakest step: ' + STEPS[weakest].label + ', ' + reason + '.' : 'No clear leak.') + (verdict ? ' ' + verdict : '') + (notes.length ? ' ' + notes.join(' ') : '');
  return { empty: false, rows, notes, extra, weakest: weakest ? { key: weakest, ...STEPS[weakest], reason, rate: T[weakest].v } : null, weakLine, verdict, summary, T, L };
}

// The member's own rate for a step over the last 4 weeks that pass the sample-size minimum
// (counts summed, so a big week weighs more). null until 2 such weeks exist.
function stepAverage(user, k, endKey) {
  const s = STEPS[k];
  if (!s) return null;
  let a = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < 4; i++) {
    const R = rates(weekInput(user, addWeeks(endKey, -i)));
    if (R[k] && R[k].ok) {
      a += R[s.parts[0]];
      b += R[s.parts[1]];
      n += 1;
    }
  }
  return n >= 2 && b > 0 ? a / b : null;
}

// ---------- what the member saves ----------
function cleanValue(raw, isMoney) {
  const n = num(raw);
  if (n === null || n < 0 || n > MAX_VALUE) return null;
  return isMoney ? Math.round(n * 100) / 100 : Math.round(n);
}
function trim(h) {
  const oldest = addWeeks(weekKey(), -(KEEP_WEEKS - 1));
  for (const k of Object.keys(h.weeks || {})) if (k < oldest) delete h.weeks[k];
  for (const s of Object.keys(h.auto || {})) for (const k of Object.keys(h.auto[s] || {})) if (k < oldest) delete h.auto[s][k];
}

// One week's typed numbers, call and note. Blank boxes stay blank. Returns { bad: [labels] }.
function saveWeek(user, key, body) {
  const h = ensure(user);
  const old = (h.weeks[key] && h.weeks[key].v) || {};
  const shown = metrics(user);
  const v = {};
  const bad = [];
  for (const m of shown) {
    const raw = body['v_' + m.id];
    if (raw === undefined) {
      if (old[m.id] !== undefined) v[m.id] = old[m.id];
      continue;
    }
    if (String(raw).trim() === '') continue;
    const n = cleanValue(raw, m.money);
    if (n === null) {
      bad.push(m.label);
      if (old[m.id] !== undefined) v[m.id] = old[m.id];
    } else v[m.id] = n;
  }
  // Hidden numbers keep what they had.
  for (const [k, val] of Object.entries(old)) if (!(k in v) && !shown.some((m) => m.id === k) && metricDef(user, k)) v[k] = val;
  h.weeks[key] = { v, call: Object.prototype.hasOwnProperty.call(CALLS, body.call) ? body.call : '', note: String(body.note || '').trim().slice(0, 200), at: iso() };
  trim(h);
  return { bad };
}

function saveSettings(user, body) {
  const h = ensure(user);
  if (body.north && metricDef(user, String(body.north))) h.north = String(body.north);
  for (const k of ['posts', 'outreach']) {
    const n = cleanValue(body['target_' + k], false);
    if (n !== null && n <= 10000) h.targets[k] = n;
    else delete h.targets[k];
  }
  if (body.tiles === '1') {
    const show = [].concat(body.show || []).map(String);
    h.hidden = BASE_IDS.filter((id) => !show.includes(id) && id !== northId(user));
  }
}

function addCustom(user, body) {
  const h = ensure(user);
  const label = String(body.label || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!label) return { error: 'Give your number a name.' };
  if (h.custom.length >= MAX_CUSTOM) return { error: `You can add up to ${MAX_CUSTOM} numbers of your own.` };
  const lower = label.toLowerCase();
  const taken = METRICS.some((m) => m.id === lower || m.label.toLowerCase() === lower || (m.long || '').toLowerCase() === lower) || h.custom.some((c) => c.label.toLowerCase() === lower);
  if (taken) return { error: `You already have a number called ${label}.` };
  const c = { id: 'c_' + crypto.randomBytes(4).toString('hex'), label, kind: body.kind === 'money' ? 'money' : 'count', mode: body.mode === 'total' ? 'total' : 'weekly' };
  h.custom.push(c);
  return { custom: c };
}
function removeCustom(user, id) {
  const h = ensure(user);
  if (!h.custom.some((c) => c.id === id)) return false;
  h.custom = h.custom.filter((c) => c.id !== id);
  for (const w of Object.values(h.weeks)) if (w.v) delete w.v[id];
  for (const cell of Object.values((h.auto && h.auto.link) || {})) delete cell[id];
  if (h.north === id) delete h.north;
  return true;
}

// ---------- secrets ----------
function aesKey() {
  return crypto.createHash('sha256').update(String(process.env.HQ_SECRET)).digest();
}
// "v1:" + base64(iv | tag | ciphertext). The version lets HQ_SECRET be rotated later.
function enc(plain) {
  if (!secretReady()) throw new Error('HQ_SECRET is not set');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function dec(s) {
  if (!secretReady() || typeof s !== 'string' || !s.startsWith('v1:')) return null;
  try {
    const b = Buffer.from(s.slice(3), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', aesKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ---------- connections ----------
function connOf(userId) {
  return deps.db.get('hqConnections', userId) || { id: userId };
}
async function saveConn(c) {
  return deps.db.save('hqConnections', c);
}
function emit(type, payload) {
  try {
    const r = deps.emit(type, payload);
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* analytics only */
  }
}
function linkHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
function linkUrl(base, token) {
  return `${String(base || '').replace(/\/$/, '')}/hq/in/${token}`;
}
// A new 127 link (or a new one in place of the old, which stops at once). The token is kept so the
// member can copy the link again; lookups go by its hash.
async function makeLink(user) {
  const c = connOf(user.id);
  const token = crypto.randomBytes(32).toString('base64url');
  const rotated = !!c.link;
  c.link = { token, hash: linkHash(token), createdAt: iso(), lastAt: null, calls: 0, sources: [] };
  await saveConn(c);
  emit('hq.connected', { userId: user.id, provider: 'link', rotated });
  return token;
}
function byToken(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return null;
  const h = linkHash(token);
  return deps.db.find('hqConnections', (c) => !!c.link && c.link.hash === h);
}

async function disconnect(user, provider) {
  const c = deps.db.get('hqConnections', user.id);
  if (!c || !['stripe', 'shopify', 'link', 'ai'].includes(provider) || !c[provider]) return false;
  delete c[provider];
  // Shopify sends to the 127 link, so it goes too.
  if (provider === 'link') delete c.shopify;
  await saveConn(c);
  emit('hq.disconnected', { userId: user.id, provider });
  return true;
}

function bump(h, source, key, add) {
  const cell = ((h.auto[source] = h.auto[source] || {})[key] = h.auto[source][key] || {});
  for (const [k, v] of Object.entries(add)) cell[k] = Math.round(((num(cell[k]) || 0) + v) * 100) / 100;
}

// Stripe: a read-only restricted key (H5). Secret keys are refused; the key is never shown again.
const RK = /^rk_(live|test)_[A-Za-z0-9]{20,}$/;
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
function stripeAuthFailed(err) {
  return !!err && (err.statusCode === 401 || err.type === 'StripeAuthenticationError');
}
function stripeError(err) {
  if (stripeAuthFailed(err)) return "That key didn't work. Check you copied all of it.";
  if (err && (err.statusCode === 403 || err.type === 'StripePermissionError')) return "That key can't read charges. Edit it in Stripe and set Charges to Read.";
  return "Stripe didn't answer. Try again in a minute.";
}
async function connectStripe(user, raw) {
  const key = String(raw || '').trim();
  if (/^sk_/.test(key)) return { error: "That's a secret key, which can do anything in your Stripe account. Make a restricted key with Charges set to Read instead." };
  if (/^pk_/.test(key)) return { error: "That's a publishable key. Make a restricted key with Charges set to Read and paste that." };
  if (!RK.test(key)) return { error: "That doesn't look like a restricted key. It starts with rk_live_ or rk_test_." };
  if (!secretReady()) return { error: "Stripe can't be connected yet." };
  try {
    await deps.stripe(key).charges.list({ limit: 1 });
  } catch (err) {
    return { error: stripeError(err) };
  }
  const c = connOf(user.id);
  c.stripe = { key: enc(key), last4: key.slice(-4), mode: key.startsWith('rk_live_') ? 'live' : 'test', status: 'ok', connectedAt: iso(), syncedAt: null, error: null };
  await saveConn(c);
  emit('hq.connected', { userId: user.id, provider: 'stripe' });
  return syncStripe(user, c);
}
// Re-counts the last 12 weeks from scratch each time, so refunds land in the right week. A sale is a
// succeeded charge with money kept after refunds; only the most common currency is summed.
async function syncStripe(user, c = deps.db.get('hqConnections', user.id)) {
  if (!c || !c.stripe) return { error: 'Stripe isn’t connected.' };
  const key = dec(c.stripe.key);
  const now = deps.now();
  if (!key) {
    c.stripe.status = 'broken';
    c.stripe.error = 'Reconnect Stripe.';
    await saveConn(c);
    return { error: 'Reconnect Stripe.' };
  }
  const cur = weekKey(now);
  const first = addWeeks(cur, -(SERIES_WEEKS - 1));
  // A day early: midnight ET on that Monday is after midnight UTC.
  const since = Math.floor((Date.parse(`${first}T00:00:00Z`) - DAY) / 1000);
  const byCur = {};
  let seen = 0;
  try {
    for await (const ch of deps.stripe(key).charges.list({ created: { gte: since }, limit: 100 })) {
      if (++seen > STRIPE_CAP) break;
      if (ch.status !== 'succeeded') continue;
      const net = (ch.amount_captured || 0) - (ch.amount_refunded || 0);
      const k = weekKey(ch.created * 1000);
      if (net <= 0 || k < first) continue;
      const cu = String(ch.currency || 'usd').toLowerCase();
      const b = (byCur[cu] = byCur[cu] || { count: 0, weeks: {} });
      const w = (b.weeks[k] = b.weeks[k] || { sales: 0, revenue: 0 });
      b.count += 1;
      w.sales += 1;
      w.revenue += ZERO_DECIMAL.has(cu) ? net : net / 100;
    }
  } catch (err) {
    if (stripeAuthFailed(err)) c.stripe.status = 'broken';
    c.stripe.error = stripeAuthFailed(err) ? 'Reconnect Stripe.' : stripeError(err);
    c.stripe.triedAt = iso(now);
    await saveConn(c);
    return { error: c.stripe.error };
  }
  const h = ensure(user);
  // The member's currency is set by their first connection; until then, the most common one here.
  const order = Object.keys(byCur).sort((a, b) => byCur[b].count - byCur[a].count);
  const pick = h.currency || order[0] || 'usd';
  if (!h.currency && order.length) h.currency = pick;
  const weeks = (byCur[pick] || { weeks: {} }).weeks;
  const auto = (h.auto.stripe = h.auto.stripe || {});
  let sales = 0;
  for (let i = 0; i < SERIES_WEEKS; i++) {
    const k = addWeeks(first, i);
    if (weeks[k]) {
      auto[k] = { sales: weeks[k].sales, revenue: Math.round(weeks[k].revenue * 100) / 100 };
      sales += weeks[k].sales;
    } else delete auto[k];
  }
  Object.assign(c.stripe, { status: 'ok', error: null, syncedAt: iso(now), triedAt: iso(now), otherCurrency: order.filter((x) => x !== pick).reduce((a, x) => a + byCur[x].count, 0) });
  trim(h);
  await deps.db.save('users', user);
  await saveConn(c);
  return { ok: true, sales };
}

// Shopify: an Order creation webhook the member adds in Shopify admin, pointed at their 127 link and
// checked with the signing key Shopify shows there (H6). New orders only, from the day they connect.
async function connectShopify(user, raw) {
  const secret = String(raw || '').trim();
  if (!secretReady()) return { error: "Shopify can't be connected yet." };
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(secret)) return { error: "That doesn't look like Shopify's signing key. Copy the key under the webhooks list in Shopify (Settings, Notifications, Webhooks)." };
  const c = connOf(user.id);
  if (!c.link) return { error: 'Make your 127 link first. Shopify sends orders to it.' };
  c.shopify = { secret: enc(secret), status: 'waiting', connectedAt: iso(), shop: null, lastOrderAt: null, seen: [], otherCurrency: 0 };
  await saveConn(c);
  emit('hq.connected', { userId: user.id, provider: 'shopify' });
  return { ok: true };
}

function header(headers, name) {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
}
function remember(s, id) {
  s.seen = (s.seen || []).concat(id).slice(-SEEN_MAX);
}
async function shopifyIn(user, c, topic, headers, raw) {
  const s = c.shopify;
  const secret = s && dec(s.secret);
  if (!secret) return [401, 'Not connected'];
  const want = crypto.createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(String(header(headers, 'x-shopify-hmac-sha256') || ''), 'base64');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return [401, 'Bad signature'];
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return [400, 'Bad JSON'];
  }
  const shop = String(header(headers, 'x-shopify-shop-domain') || '').toLowerCase();
  if (/^[a-z0-9][a-z0-9.-]{0,120}$/.test(shop)) s.shop = shop;
  const first = s.status !== 'ok';
  s.status = 'ok';
  const h = ensure(user);
  const skip = async (text) => {
    if (first) await saveConn(c);
    return [200, text];
  };
  // Shopify's numeric ids can outgrow a JavaScript number, so the GraphQL id (a string) comes first.
  const idOf = (prefix) => prefix + String(body.admin_graphql_api_id || body.id);
  if (topic === 'orders/create') {
    const id = idOf('o');
    if (body.test === true || header(headers, 'x-shopify-test') === 'true') return skip('Test order skipped');
    if ((s.seen || []).includes(id)) return skip('Already counted');
    remember(s, id);
    const at = Date.parse(body.created_at) || deps.now();
    const cu = String(body.currency || '').toLowerCase();
    if (cu && !h.currency) h.currency = cu;
    if (cu && cu !== h.currency) s.otherCurrency = (s.otherCurrency || 0) + 1;
    else bump(h, 'shopify', weekKey(at), { sales: 1, revenue: Math.max(0, num(body.total_price) || 0) });
    s.lastOrderAt = iso(at);
  } else if (topic === 'refunds/create') {
    const id = idOf('r');
    if ((s.seen || []).includes(id)) return skip('Already counted');
    remember(s, id);
    const ours = (t) => !t.currency || !h.currency || String(t.currency).toLowerCase() === h.currency;
    const refunded = (body.transactions || []).filter((t) => t && t.kind === 'refund' && t.status === 'success' && ours(t)).reduce((a, t) => a + Math.max(0, num(t.amount) || 0), 0);
    if (refunded > 0) bump(h, 'shopify', weekKey(Date.parse(body.created_at) || deps.now()), { revenue: -refunded });
  } else {
    await saveConn(c);
    return [200, 'Ignored'];
  }
  trim(h);
  await deps.db.save('users', user);
  await saveConn(c);
  return [200, 'OK'];
}

// The 127 link: JSON (or a form post) from Zapier, Make, n8n, a Google Sheets script or anything else.
//   { "metric": "leads", "value": 1 }                         adds 1
//   { "leads": 1, "sales": 1, "revenue": 49 }                  adds each
//   { "metric": "Email list", "value": 412, "mode": "set" }    sets this week's value
//   optional "date": "2026-12-03" (up to 12 weeks back) and "source": "ManyChat"
function names(user) {
  return BASE_IDS.concat((hqOf(user).custom || []).map((c) => c.label));
}
function resolveMetric(user, name) {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return null;
  const m = METRICS.find((x) => x.id === s || x.label.toLowerCase() === s || (x.long || '').toLowerCase() === s);
  if (m) return metricDef(user, m.id);
  const c = (hqOf(user).custom || []).find((x) => x.id === String(name).trim() || x.label.toLowerCase() === s);
  return c ? { ...metricDef(user, c.id), mode: c.mode } : null;
}
function parseBody(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : '';
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!/=/.test(text)) return null;
    return Object.fromEntries(new URLSearchParams(text));
  }
}
const SENDERS = [[/zapier/i, 'Zapier'], [/integromat|make\.com|^make\//i, 'Make'], [/n8n/i, 'n8n'], [/google-apps-script/i, 'Google Sheets'], [/manychat/i, 'ManyChat']];
function senderOf(body, headers) {
  const named = typeof body.source === 'string' ? body.source.replace(/[^\w .&-]/g, '').trim().slice(0, 30) : '';
  if (named) return named;
  const ua = String(header(headers, 'user-agent') || '');
  const hit = SENDERS.find(([re]) => re.test(ua));
  return hit ? hit[1] : null;
}
function lastKnown(user, id, key) {
  for (let i = 1; i <= 52; i++) {
    const v = valueOf(user, addWeeks(key, -i), id);
    if (v !== null) return v;
  }
  return null;
}
async function linkIn(user, c, raw, headers) {
  if (!security.allow(`hq-link:${c.id}`, LINK_PER_HOUR, 60 * 60 * 1000)) return [429, { error: `Too many calls this hour. The limit is ${LINK_PER_HOUR}.` }];
  const body = parseBody(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [400, { error: 'Send JSON like {"metric": "leads", "value": 1}.' }];
  const now = deps.now();
  const cur = weekKey(now);
  let key = cur;
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const d = String(body.date);
    const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
    if (!Number.isFinite(t)) return [400, { error: `date must look like ${dateExample()}.` }];
    key = weekKey(t);
    if (key > cur || t > now + DAY) return [400, { error: "date can't be in the future." }];
    if (key < addWeeks(cur, -(SERIES_WEEKS - 1))) return [400, { error: 'date can be up to 12 weeks back.' }];
  }
  const items = 'metric' in body ? [[body.metric, body.value]] : Object.entries(body).filter(([k]) => !['date', 'mode', 'source'].includes(k));
  if (!items.length) return [400, { error: 'Send a metric and a value, like {"metric": "leads", "value": 1}.' }];
  const resolved = [];
  for (const [name, value] of items) {
    const def = resolveMetric(user, name);
    if (!def) return [400, { error: `Unknown metric "${String(name).slice(0, 40)}". Use one of: ${names(user).join(', ')}.` }];
    const n = num(value);
    if (n === null || n < 0 || n > MAX_VALUE) return [400, { error: `The value for ${def.label} must be a number from 0 to 1000000000.` }];
    resolved.push([def, n]);
  }
  const h = ensure(user);
  const set = String(body.mode || '').toLowerCase() === 'set';
  const cell = ((h.auto.link = h.auto.link || {})[key] = h.auto.link[key] || {});
  for (const [def, n] of resolved) {
    const before = num(cell[def.id]);
    if (set) cell[def.id] = n;
    else if (def.mode === 'total') cell[def.id] = (before !== null ? before : lastKnown(user, def.id, key) || 0) + n;
    else cell[def.id] = Math.round(((before || 0) + n) * 100) / 100;
  }
  const from = senderOf(body, headers);
  c.link.lastAt = iso(now);
  c.link.calls = (c.link.calls || 0) + 1;
  if (from) c.link.sources = [from].concat((c.link.sources || []).filter((x) => x !== from)).slice(0, 5);
  trim(h);
  await deps.db.save('users', user);
  await saveConn(c);
  return [200, { ok: true, week: key, counted: resolved.map(([d, n]) => ({ metric: d.label, value: n })) }];
}

// POST /hq/in/:token. Signed Shopify webhooks and the 127 link share one URL. Returns [status, body].
async function inbound(token, headers, raw) {
  if (!live()) return [404, 'Not found'];
  const c = byToken(token);
  const user = c && deps.db.get('users', c.id);
  if (!user || !canUse(user)) return [404, 'Not found'];
  const topic = header(headers, 'x-shopify-topic');
  return topic ? shopifyIn(user, c, String(topic), headers, raw) : linkIn(user, c, raw, headers);
}

// Former Builders (moved to Free, not a pause): their Stripe key and Shopify signing key are deleted
// 30 days after the plan ended. Their numbers stay on the account in case they come back.
async function forgetFormer(now = deps.now()) {
  for (const c of deps.db.filter('hqConnections', (x) => !!(x.stripe || x.shopify))) {
    const u = deps.db.get('users', c.id);
    if (!u) {
      await deps.db.remove('hqConnections', c.id);
      continue;
    }
    const ended = !canUse(u) && Date.parse(u.canceledAt || '');
    if (!(ended && now - ended > 30 * DAY)) continue;
    delete c.stripe;
    delete c.shopify;
    await saveConn(c);
  }
}

// Daily Stripe refresh, from the server's 5-minute interval: at most 20 connections per run, one
// run at a time. A failed refresh waits 6 hours before the next try.
let ticking = false;
async function tick() {
  if (ticking) return 0;
  ticking = true;
  try {
    await forgetFormer();
    if (!live() || !secretReady()) return 0;
    const now = deps.now();
    const old = (t, ms) => !t || now - Date.parse(t) > ms;
    const due = deps.db.filter('hqConnections', (c) => !!c.stripe && c.stripe.status === 'ok' && old(c.stripe.syncedAt, DAY) && old(c.stripe.triedAt, 6 * 60 * 60 * 1000)).slice(0, 20);
    let n = 0;
    for (const c of due) {
      const u = deps.db.get('users', c.id);
      if (!u || !canUse(u)) continue;
      await syncStripe(u, c).catch((err) => console.warn('[hq] stripe sync', err.message));
      n += 1;
    }
    return n;
  } finally {
    ticking = false;
  }
}

// ---------- the page ----------
function fmtMoney(n, currency) {
  const a = Math.abs(n);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase(), maximumFractionDigits: a < 10 ? 2 : 0, minimumFractionDigits: 0 }).format(n);
  } catch {
    return money(n);
  }
}
function fmtValue(m, v, currency) {
  if (v === null || v === undefined) return '–';
  return m.money ? fmtMoney(v, currency) : Math.round(v).toLocaleString('en-US');
}
// Percent change from last week, for the 8 numbers. Nothing logged yet is no change, not -100%.
function change(v, l) {
  if (v === null || v === undefined) return { text: '–', dir: '' };
  if (!(l > 0)) return v > 0 ? { text: 'new', dir: 'up' } : { text: '–', dir: '' };
  const p = Math.round(((v || 0) - l) / l * 100);
  return { text: (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%', dir: p > 0 ? 'up' : p < 0 ? 'down' : '' };
}
// Plain difference from last week, for a member's own numbers (an email list: +23).
function delta(m, v, l, currency) {
  if (v === null || l === null) return { text: '', dir: '' };
  const d = Math.round((v - l) * 100) / 100;
  if (!d) return { text: 'no change', dir: '' };
  return { text: (d > 0 ? '+' : '−') + fmtValue(m, Math.abs(d), currency), dir: d > 0 ? 'up' : 'down' };
}
// SVG points for a small line chart, its filled area and its last point. A week with nothing logged is
// left out, not drawn as zero; with nothing logged at all there is no line (empty: true).
function line(values, w, h, padX, padT, padB) {
  const step = (w - padX * 2) / Math.max(1, values.length - 1);
  const known = values.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined);
  if (!known.length) return { points: '', area: '', x: 0, y: 0, empty: true };
  const top = Math.max(0, ...known.map(([, v]) => v)) || 1;
  const pts = known.map(([i, v]) => [Math.round((padX + i * step) * 10) / 10, Math.round((h - padB - (Math.max(0, v) / top) * (h - padT - padB)) * 10) / 10]);
  const last = pts[pts.length - 1];
  return { points: pts.map((p) => p.join(',')).join(' '), area: `M${pts[0][0]},${h - padB} L${pts.map((p) => p.join(',')).join(' L')} L${last[0]},${h - padB} Z`, x: last[0], y: last[1], empty: false };
}
function ago(t, now = deps.now()) {
  if (!t) return null;
  const m = Math.max(0, Math.round((now - Date.parse(t)) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'an hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}
function day(t) {
  return t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : null;
}

// A date to show in the 127 link's examples and errors: Wednesday of last week.
function dateExample() {
  return new Date(Date.parse(`${addWeeks(weekKey(deps.now()), -1)}T12:00:00Z`) + 2 * DAY).toISOString().slice(0, 10);
}
// What the Connections card and page show. Never the keys; the 127 link only to its owner.
function connections(user, base) {
  const c = deps.db.get('hqConnections', user.id) || {};
  const host = String(base || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    ready: secretReady(),
    dateExample: dateExample(),
    stripe: c.stripe ? { status: c.stripe.status, mode: c.stripe.mode, last4: c.stripe.last4, synced: ago(c.stripe.syncedAt), since: day(c.stripe.connectedAt), error: c.stripe.error, otherCurrency: c.stripe.otherCurrency || 0 } : null,
    shopify: c.shopify ? { status: c.shopify.status, shop: c.shopify.shop, since: day(c.shopify.connectedAt), lastOrder: ago(c.shopify.lastOrderAt), otherCurrency: c.shopify.otherCurrency || 0 } : null,
    link: c.link ? { url: linkUrl(base, c.link.token), masked: `${host}/hq/in/••••${c.link.token.slice(-4)}`, last: ago(c.link.lastAt), calls: c.link.calls || 0, sources: c.link.sources || [] } : null,
    // Your AI link (lib/hq-harness.js): 127 inside Claude and ChatGPT.
    ai: c.ai ? { url: `${String(base || '').replace(/\/$/, '')}/hq/ai/${c.ai.token}`, last: ago(c.ai.lastAt), calls: c.ai.calls || 0, client: c.ai.client || null } : null,
  };
}

// Everything hq.ejs shows for one week.
function page(user, key, base) {
  const h = hqOf(user);
  const cur = weekKey();
  const cy = h.currency;
  const goals = targets(user);
  const shown = metrics(user);
  const last = addWeeks(key, -1);
  const auto = h.auto || {};
  const tiles = shown.filter((m) => !m.custom).map((m) => {
    const s = series(user, m.id, key);
    const v = s[s.length - 1].v;
    const ch = change(v, s[s.length - 2].v);
    const goal = m.input ? goals[m.id] : 0;
    let sub = ch.text === '–' ? '' : ch.text;
    let dir = ch.dir;
    if (goal) {
      sub = v === null ? `Target ${goal}` : `${Math.round(v)} of ${goal} · ${v >= goal ? 'on target' : 'below target'}`;
      dir = v === null ? '' : v >= goal ? 'up' : 'down';
    }
    const sources = Object.keys(SOURCES).filter((src) => num(((auto[src] || {})[key] || {})[m.id]) !== null).map((src) => SOURCES[src]);
    return { id: m.id, label: m.label, value: fmtValue(m, v, cy), sub, dir, sources, spark: line(s.map((x) => x.v), 144, 28, 3, 3, 3) };
  });
  const nId = northId(user);
  const nDef = metricDef(user, nId);
  const ns = series(user, nId, key);
  const nv = ns[ns.length - 1].v;
  const analysis = analyze(weekInput(user, key), weekInput(user, last), goals);
  let leak = null;
  if (analysis.weakest) {
    const w = analysis.weakest;
    const avg = stepAverage(user, w.key, key);
    leak = {
      title: w.label.replace(' → ', ' to '),
      reason: w.reason.charAt(0).toUpperCase() + w.reason.slice(1) + '.',
      rate: pct(w.rate * 100),
      avg: avg === null ? null : pct(avg * 100),
      floor: pct(w.floor * 100),
      hint: w.hint.replace(/\s*See [^.]+\.$/, ''),
      slug: w.slug,
    };
  }
  const week = (h.weeks || {})[key] || {};
  const fields = shown.map((m) => {
    const t = typedOf(user, key, m.id);
    return {
      id: m.id, label: m.long || m.label, money: !!m.money, total: !!m.total,
      value: t === null ? '' : String(t),
      // A running total from the 127 link is the total itself, so it gets no plus sign.
      auto: autoParts(user, key, m.id).map((p) => ({ source: p.source, text: m.total ? fmtValue(m, p.value, cy) : (p.value > 0 ? '+' : '−') + fmtValue(m, Math.abs(p.value), cy) })),
    };
  });
  const custom = (h.custom || []).map((c) => {
    const def = metricDef(user, c.id);
    const s = series(user, c.id, key);
    const v = s[s.length - 1].v;
    const fromLink = num(((auto.link || {})[key] || {})[c.id]) !== null;
    const typed = typedOf(user, key, c.id) !== null;
    const how = fromLink ? 'from your 127 link' : typed ? 'typed' : v === null ? 'not logged' : 'carried over';
    return { id: c.id, label: c.label, kind: c.kind, mode: c.mode, value: fmtValue(def, v, cy), delta: delta(def, v, s[s.length - 2].v, cy), desc: `${c.mode === 'total' ? 'Total' : key === cur ? 'This week' : 'That week'} · ${how}` };
  });
  return {
    key, range: weekRange(key), label: shortDate(key), isCurrent: key === cur,
    prev: addWeeks(key, -1) >= addWeeks(cur, -(KEEP_WEEKS - 1)) ? addWeeks(key, -1) : null,
    next: key < cur ? addWeeks(key, 1) : null,
    current: cur,
    hasData: hasData(user, key),
    currency: String(cy || 'usd').toUpperCase(),
    north: { id: nId, label: nDef.label, value: fmtValue(nDef, nv, cy), change: change(nv, ns[ns.length - 2].v), chart: line(ns.map((x) => x.v), 316, 110, 6, 8, 6), from: shortDate(ns[0].key), to: shortDate(key) },
    tiles, analysis, leak,
    call: week.call || '', note: week.note || '', savedAt: week.at || null,
    fields, custom,
    canAddCustom: (h.custom || []).length < MAX_CUSTOM,
    goals, northId: nId,
    all: METRICS.map((m) => ({ id: m.id, label: m.label, shown: !(h.hidden || []).includes(m.id) })).concat((h.custom || []).map((c) => ({ id: c.id, label: c.label, custom: true, shown: true }))),
    connections: connections(user, base),
    read: h.read || null,
    readWeek: h.read && h.read.week ? shortDate(h.read.week) : null,
    CALLS, MAX_CUSTOM,
  };
}

// The Free preview's dimmed sample. Activity counts only, never money (Legal L12: no revenue claims
// about members), and labelled as a sample.
const SAMPLE_NORTH = [1, 2, 2, 4, 3, 5, 6, 5, 7, 9, 11, 15];
const SAMPLE_TILES = [
  ['Posts', '4', '4 of 4 · on target', [2, 3, 3, 4, 2, 4, 4, 3, 4, 4, 4, 4]],
  ['Outreach', '22', '22 of 20 · on target', [5, 8, 10, 12, 9, 14, 15, 12, 16, 18, 18, 22]],
  ['Visits', '420', '+20%', [40, 70, 85, 120, 95, 160, 190, 170, 240, 300, 350, 420]],
  ['Replies', '6', '+50%', [0, 1, 1, 2, 1, 2, 3, 2, 3, 4, 4, 6]],
];
function sample() {
  return {
    north: { label: 'Leads', value: '15', change: '+36%', chart: line(SAMPLE_NORTH, 316, 110, 6, 8, 6) },
    tiles: SAMPLE_TILES.map(([label, value, sub, s]) => ({ label, value, sub, spark: line(s, 144, 28, 3, 3, 3) })),
  };
}

// The Dashboard's HQ card (Builder and up): the North Number for the last full week.
function dashCard(user) {
  const key = addWeeks(weekKey(), -1);
  const nId = northId(user);
  const def = metricDef(user, nId);
  const s = series(user, nId, key, 2);
  return { label: def.label, value: fmtValue(def, s[1].v, hqOf(user).currency), change: change(s[1].v, s[0].v), logged: hasData(user, key, 1), week: key, weekLabel: shortDate(key) };
}

// Read my week (H10): the KPI Dashboard's worksheet feedback, fed from HQ. The worksheet boxes are
// filled from the member's numbers and call, the calculator inputs are this week and last, and the
// 12-week history rides in the calculator summary (lib/ai.js keeps its first 1,200 characters).
const SUMMARY_MAX = 1200;
function readValues(user, key) {
  const h = hqOf(user);
  const last = addWeeks(key, -1);
  const goals = targets(user);
  const a = analyze(weekInput(user, key), weekInput(user, last), goals);
  const T = rates(weekInput(user, key));
  const nId = northId(user);
  const nDef = metricDef(user, nId);
  const nv = valueOf(user, key, nId);
  const inputs = {};
  for (const id of BASE_IDS) {
    const t = valueOf(user, key, id);
    const l = valueOf(user, last, id);
    if (l !== null) inputs['l_' + id] = String(l);
    if (t !== null) inputs['t_' + id] = String(t);
  }
  if (goals.posts) inputs.g_posts = String(goals.posts);
  if (goals.outreach) inputs.g_outreach = String(goals.outreach);
  const first = addWeeks(key, -(SERIES_WEEKS - 1));
  const hist = (id) => series(user, id, key).map((x) => (x.v === null ? '-' : Math.round(x.v))).join(',');
  const parts = [a.empty ? 'Nothing logged this week yet.' : a.summary, `Last 12 weeks, oldest first (weeks of ${shortDate(first)} to ${shortDate(key)}, "-" = not logged):`];
  for (const id of ['revenue', 'sales', 'leads', 'visits', 'reach', 'outreach', 'posts']) parts.push(`${metricDef(user, id).label.toLowerCase()} ${hist(id)};`);
  for (const c of h.custom || []) parts.push(`${c.label}${c.mode === 'total' ? ' (running total)' : ''} ${hist(c.id)};`);
  const calls = Array.from({ length: SERIES_WEEKS }, (_, i) => addWeeks(first, i))
    .filter((k) => ((h.weeks || {})[k] || {}).call)
    .map((k) => `${shortDate(k)} ${CALLS[h.weeks[k].call].toLowerCase()}`);
  if (calls.length) parts.push(`Their weekly calls: ${calls.join(', ')}.`);
  let summary = '';
  for (const part of parts) {
    if ((summary + ' ' + part).trim().length > SUMMARY_MAX) break;
    summary = (summary + ' ' + part).trim();
  }
  const week = (h.weeks || {})[key] || {};
  return {
    omtm: nv === null ? `${nDef.label}: not logged this week.` : `${nDef.label}: ${fmtValue(nDef, nv, h.currency)} this week (${change(nv, valueOf(user, last, nId)).text} vs last week).`,
    lead_measures: `Posts: target ${goals.posts || 'not set'} a week, did ${T.posts}. Outreach: target ${goals.outreach || 'not set'} a week, did ${T.outreach}.`,
    biggest_leak: a.empty ? '' : a.weakLine,
    weekly_decision: week.call ? `${CALLS[week.call]}${week.note ? ': ' + week.note : ''}` : week.note || '',
    next_test: '',
    __calc: JSON.stringify({ inputs, summary }),
    __updated: iso(),
  };
}

// One line for /admin: who uses HQ, and the Phase 2 gate (3 weeks in a row, H12).
function stats() {
  const now = deps.now();
  const cur = weekKey(now);
  const users = deps.db.filter('users', (u) => canUse(u));
  const logged = (u, k) => BASE_IDS.some((id) => valueOf(u, k, id) !== null);
  const conns = deps.db.all('hqConnections');
  return {
    members: users.length,
    saved14: users.filter((u) => Object.values(hqOf(u).weeks || {}).some((w) => w.at && now - Date.parse(w.at) < 14 * DAY)).length,
    streak3: users.filter((u) => [1, 2, 3].every((i) => logged(u, addWeeks(cur, -i)))).length,
    stripe: conns.filter((c) => c.stripe).length,
    shopify: conns.filter((c) => c.shopify).length,
    link: conns.filter((c) => c.link).length,
    ai: conns.filter((c) => c.ai).length,
    checkin: users.filter((u) => hqOf(u).checkin === true).length,
  };
}

module.exports = {
  live, secretReady, canUse, weekKey, addWeeks, isWeekKey, okWeek, defaultWeek, weekRange, shortDate,
  METRICS, STEPS, CALLS, SERIES_WEEKS, KEEP_WEEKS, MAX_CUSTOM,
  metrics, metricDef, valueOf, series, weekInput, rates, analyze, stepAverage,
  saveWeek, saveSettings, addCustom, removeCustom, ensure,
  enc, dec, makeLink, linkUrl, byToken, disconnect, connectStripe, syncStripe, connectShopify, inbound, tick,
  page, dashCard, readValues, stats, connections, sample,
  targets, northId, resolveMetric, fmtValue, change, cleanValue, typedOf, autoParts, linkHash, connOf, saveConn, ago, trim,
  _setDeps,
};
