// 127 HQ, the harness (product/hub/harness-spec.md). Eli, Oct 16: a non-technical member should get
// real value in 10 minutes, and 127 should come to them instead of being one more platform to open.
// Three ways HQ fills itself without keys, webhooks or typing:
//
//   1. Screenshot drop-in. The member drags in screenshots of whatever they have (Stripe, Shopify,
//      Instagram insights, a bank app, a spreadsheet). Eli's Playbook reads the totals, HQ fills the
//      week's form and the member checks it before saving. 1 AI message per read. The images are read
//      in memory and never stored or logged.
//   2. Monday check-in. An email each Monday (only for members who turn it on) with last week's North
//      Number and a link that logs the week with no login.
//   3. Your AI link. 127 inside Claude and ChatGPT: a private MCP server URL (POST /hq/ai/<token>)
//      the member adds as a custom connector. Their own AI can read their roadmap, numbers and 127's
//      playbooks, and log numbers they tell it. It never sends, posts or changes anything elsewhere.
//
// HQ_HARNESS=true turns these on, together with HQ_LIVE. Off: their routes 404 and HQ is v1.
// Check-in links and the AI link need HQ_SECRET (lib/hq.js), like the other connections.

const crypto = require('crypto');
const hq = require('./hq');
const security = require('./security');
const ageCheck = require('./age-check');
const { canAccess } = require('./plans');
const { MILESTONES } = require('./milestones');
const { resources } = require('../content/resources.json');

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  read: (images, metrics, user) => require('./ai').readScreenshots(images, metrics, user),
  profile: (user) => require('./ai').memberProfile(user),
  sendEmail: (mail) => require('./integrations').sendEmail(mail),
  emit: (type, payload) => require('./integrations').emit(type, payload),
};
function _setDeps(over) {
  Object.assign(deps, over);
}

const DAY = 864e5;
const HOUR = 36e5;
const SNAP_MAX = 4;
const IMAGE_BYTES = 5 * 1024 * 1024;
const SNAP_KEEP = DAY;
const AI_PER_HOUR = 300;
const CHECKIN_PER_TICK = 50;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function on() {
  return hq.live() && process.env.HQ_HARNESS === 'true';
}
function iso(t = deps.now()) {
  return new Date(t).toISOString();
}
function base() {
  return String(process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
}
function emit(type, payload) {
  try {
    const r = deps.emit(type, payload);
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* analytics only */
  }
}
function firstName(user) {
  return String((user && user.name) || '').trim().split(/\s+/)[0] || '';
}
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
// "YYYY-MM-DD" to noon UTC that day, or null.
function dayMs(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const t = Date.parse(`${s}T12:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

// ---------- 1. screenshot drop-in ----------

// data URLs from the browser (public/js/hq.js shrinks each to 1568px JPEG first) to [{ type, data }].
function parseImages(list) {
  const arr = [].concat(list || []).filter((x) => typeof x === 'string');
  if (!arr.length) return { error: 'Add a screenshot first.' };
  if (arr.length > SNAP_MAX) return { error: `Up to ${SNAP_MAX} screenshots at a time.` };
  const out = [];
  for (const s of arr) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(s);
    if (!m || !IMAGE_TYPES.includes(m[1])) return { error: 'Use a screenshot or photo (JPG, PNG, WebP or GIF).' };
    if (Buffer.byteLength(m[2], 'base64') > IMAGE_BYTES) return { error: 'One of those is too big. Try a smaller screenshot.' };
    out.push({ type: m[1], data: m[2] });
  }
  return { images: out };
}

// Reads the screenshots and keeps what it found as the week's pending numbers (user.hq.snap), for
// the member to check on the HQ page. Nothing counts until they press Save week.
async function snap(user, images, pageKey) {
  const shown = hq.metrics(user);
  const out = await deps.read(images, shown.map((m) => ({ id: m.id, label: m.long || m.label, money: !!m.money, total: !!m.total })), user);
  if (!out || out.error) return { error: (out && out.text) || "Couldn't read numbers from that. Try a clearer screenshot." };
  const now = deps.now();
  const cur = hq.weekKey(now);
  let key = hq.okWeek(pageKey) ? pageKey : hq.defaultWeek(now);
  const notes = [];
  const from = dayMs(out.from);
  const to = dayMs(out.to);
  // The week the screenshot shows wins over the week on screen, when it's one HQ keeps.
  if (to && to <= now + DAY) {
    const k = hq.weekKey(to);
    if (k <= cur && k >= hq.addWeeks(cur, -(hq.SERIES_WEEKS - 1))) key = k;
  }
  if (from && to && to - from > 7 * DAY) notes.push(`These numbers cover ${fmtDay(from)} to ${fmtDay(to)}, not one week. Change them to the week's numbers before you save.`);
  const values = {};
  const seenTwice = new Set();
  for (const n of out.numbers || []) {
    const def = shown.find((m) => m.id === (n && n.metric));
    if (!def) continue;
    const v = hq.cleanValue(n.value, def.money);
    if (v === null) continue;
    if (values[def.id] !== undefined) {
      seenTwice.add(def.long || def.label);
      // A running total (an email list) is one number; anything else from two places adds up.
      values[def.id] = def.total ? v : Math.round((values[def.id] + v) * 100) / 100;
    } else values[def.id] = v;
  }
  if (seenTwice.size) notes.push(`${[...seenTwice].join(' and ')} showed up more than once, so ${seenTwice.size > 1 ? 'they were' : 'it was'} added together. Check ${seenTwice.size > 1 ? 'them' : 'it'}.`);
  // Numbers a connection already counts that week would be counted twice.
  const skipped = [];
  for (const id of Object.keys(values)) {
    const def = hq.metricDef(user, id);
    const parts = hq.autoParts(user, key, id);
    if (!def.total && parts.length) {
      skipped.push(`${def.label} (${parts.map((p) => p.source).join(' and ')} counts it)`);
      delete values[id];
    }
  }
  if (skipped.length) notes.push(`Left out so nothing counts twice: ${skipped.join(', ')}.`);
  const h = hq.ensure(user);
  const cy = String(out.currency || '').toUpperCase();
  if (values.revenue !== undefined && /^[A-Z]{3}$/.test(cy) && h.currency && cy !== String(h.currency).toUpperCase()) {
    notes.push(`Revenue on screen is in ${cy}, and HQ counts in ${String(h.currency).toUpperCase()}. Change it before you save.`);
  }
  if (out.note) notes.push(String(out.note).replace(/\s+/g, ' ').trim().slice(0, 200));
  const source = String(out.source || '').replace(/[^\w .,&'()-]/g, '').trim().slice(0, 40);
  h.snap = { week: key, values, source, notes, demo: !!out.demo, at: iso(now) };
  emit('hq.snap', { userId: user.id, week: key, found: Object.keys(values).length });
  return { week: key, found: Object.keys(values).length };
}

// The pending screenshot numbers for this week, if they're fresh. The HQ page puts them in the form.
function snapFor(user, key) {
  const s = user && user.hq && user.hq.snap;
  if (!s || s.week !== key || deps.now() - Date.parse(s.at) > SNAP_KEEP) return null;
  return s;
}
function clearSnap(user, key) {
  const h = user && user.hq;
  if (!h || !h.snap || (key && h.snap.week !== key)) return false;
  delete h.snap;
  return true;
}

// Unsaved screenshot numbers are deleted once they're 24 hours old (H25, Legal L50), not just hidden.
async function purgeSnaps(now = deps.now()) {
  const old = deps.db.filter('users', (u) => !!(u.hq && u.hq.snap) && !(now - Date.parse(u.hq.snap.at) <= SNAP_KEEP));
  for (const u of old) {
    delete u.hq.snap;
    await deps.db.save('users', u);
  }
  return old.length;
}

// ---------- 2. Monday check-in ----------

function secret(purpose) {
  return crypto.createHash('sha256').update(`${purpose}:${process.env.HQ_SECRET}`).digest();
}
function sign(s) {
  return crypto.createHmac('sha256', secret('checkin')).update(s).digest('base64url').slice(0, 32);
}
// A check-in link logs one member's numbers for one week, until 15 days after that week began
// (the Monday email goes out 7 days in).
function checkinToken(user, week) {
  const id = Buffer.from(String(user.id)).toString('base64url');
  return `${id}.${week}.${sign(`${user.id}:${week}`)}`;
}
function checkinUrl(user, week) {
  return `${base()}/hq/week/${checkinToken(user, week)}`;
}
function fromCheckin(token) {
  if (!hq.secretReady()) return null;
  const m = /^([A-Za-z0-9_-]{1,200})\.(\d{4}-\d{2}-\d{2})\.([A-Za-z0-9_-]{32})$/.exec(String(token || ''));
  if (!m || !hq.isWeekKey(m[2])) return null;
  const id = Buffer.from(m[1], 'base64url').toString('utf8');
  const want = Buffer.from(sign(`${id}:${m[2]}`));
  const got = Buffer.from(m[3]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  if (deps.now() > Date.parse(`${m[2]}T12:00:00Z`) + 15 * DAY) return { expired: true };
  const user = deps.db.get('users', id);
  if (!user || !hq.canUse(user)) return null;
  return { user, week: m[2] };
}

const ETP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
function etNow(ms) {
  const p = Object.fromEntries(ETP.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { dow: p.weekday, hour: Number(p.hour) };
}

// A service email (Legal L50): the member's numbers, the leak, the log link, the AI tip, why they get it
// and the stop link. Never offers, upgrades, Circle or challenge pitches, news, referral asks or tool
// links: any of those makes it marketing, which needs consent, an unsubscribe link and the postal address.
function checkinEmail(user, week) {
  const p = hq.page(user, week, base());
  const name = firstName(user);
  const lines = [];
  lines.push(name ? `Hi ${name},` : 'Hi,');
  lines.push(`Here's your week of ${p.range} in 127 HQ so far.`);
  const nums = [`${p.north.label}: ${p.north.value}${p.north.change.text !== '–' && p.north.change.text !== 'new' ? ` (${p.north.change.text} vs the week before)` : ''}`];
  for (const t of p.tiles) if (t.id !== p.northId && t.value !== '–' && nums.length < 4) nums.push(`${t.label}: ${t.value}`);
  lines.push(nums.join('\n'));
  if (!p.analysis.empty) lines.push(p.analysis.weakLine.replace(/\s*See [^.]+\.$/, ''));
  lines.push(`Log the rest in 30 seconds, no login needed:\n${checkinUrl(user, week)}`);
  lines.push("The link opens your week without a login, so don't forward this email.");
  if (p.connections.ai) lines.push('Or tell your AI: "Log 3 sales for last week in 127."');
  lines.push(`You get this because you turned on Monday check-ins in HQ. Turn them off: ${checkinUrl(user, week)}#stop`);
  lines.push('127 Group LLC · hello@127group.io');
  return { to: user.email, subject: `Your week of ${p.label} in 127`, text: lines.join('\n\n') };
}

// From hq.tick(): Mondays 9am to Tuesday night, Eastern, last week's check-in for each member who
// turned it on. At most 50 a run; each member gets one per week (user.hq.checkinSent).
let sending = false;
async function mondayTick(now = deps.now()) {
  if (sending || !on() || !hq.secretReady()) return 0;
  const et = etNow(now);
  if (!((et.dow === 'Mon' && et.hour >= 9) || et.dow === 'Tue')) return 0;
  sending = true;
  try {
    const week = hq.addWeeks(hq.weekKey(now), -1);
    const due = deps.db
      .filter('users', (u) => !!u.hq && u.hq.checkin === true && u.hq.checkinSent !== week && !!u.email && hq.canUse(u) && !ageCheck.underReview(u))
      .slice(0, CHECKIN_PER_TICK);
    for (const u of due) {
      u.hq.checkinSent = week;
      await deps.db.save('users', u);
      await deps.sendEmail(checkinEmail(u, week));
      emit('hq.checkin_sent', { userId: u.id, week });
    }
    return due.length;
  } finally {
    sending = false;
  }
}

// From server.js's 5-minute interval: the 24-hour screenshot purge (always), then the Monday check-in.
async function tick(now = deps.now()) {
  await purgeSnaps(now);
  return mondayTick(now);
}

function setCheckin(user, onOff) {
  hq.ensure(user).checkin = !!onOff;
}

// ---------- 3. your AI link (MCP) ----------

async function makeAiLink(user) {
  const c = hq.connOf(user.id);
  const token = crypto.randomBytes(32).toString('base64url');
  const rotated = !!c.ai;
  c.ai = { token, hash: hq.linkHash(token), createdAt: iso(), lastAt: null, calls: 0, client: null };
  await hq.saveConn(c);
  emit('hq.connected', { userId: user.id, provider: 'ai', rotated });
  return token;
}
function aiByToken(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return null;
  const h = hq.linkHash(token);
  return deps.db.find('hqConnections', (c) => !!c.ai && c.ai.hash === h);
}

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = `127 (127group.io) is this member's founder workspace: their 30-day roadmap, their weekly numbers in 127 HQ, and 127's playbooks by Eli Christiansen.
Use get_my_business first. Use get_numbers before advising on what's working, find_playbook for 127's method on a topic, and log_numbers when the member tells you a number to record (confirm the number and the week with them first).
127 is read-only toward the member's other tools: it never sends, posts or moves money. You are not Eli: don't speak as Eli or say he recommends something beyond what a playbook says. Its playbooks are education, not financial, legal or tax advice, and nothing here promises income or results.`;

const ro = { readOnlyHint: true, openWorldHint: false };
const TOOLS = [
  {
    name: 'get_my_business',
    title: 'My 127 business',
    description: "The member's 127 profile: plan, stage, goal, roadmap progress and next step, milestones, and this week's North Number.",
    inputSchema: { type: 'object', properties: {} },
    annotations: ro,
  },
  {
    name: 'get_numbers',
    title: 'My weekly numbers',
    description: "The member's weekly numbers from 127 HQ (posts, outreach, reach, visits, leads, replies, sales, revenue and their own numbers), their weekly call, and where the funnel leaks. Weeks run Monday to Sunday, Eastern time.",
    inputSchema: { type: 'object', properties: { weeks: { type: 'integer', minimum: 1, maximum: 12, description: 'How many weeks back, 1 to 12. Default 4.' } } },
    annotations: ro,
  },
  {
    name: 'find_playbook',
    title: 'Find a 127 playbook',
    description: "127's playbook on a topic (pricing, validation interviews, content, outreach, the KPI dashboard and more), with its steps and worksheet. Without a topic, lists every playbook.",
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'What the member wants help with, in a few words.' } } },
    annotations: ro,
  },
  {
    name: 'log_numbers',
    title: 'Log numbers in 127 HQ',
    description: 'Record numbers the member tells you in their 127 HQ week. Confirm the numbers and the week with them first. Adds to what is there unless mode is "set".',
    inputSchema: {
      type: 'object',
      properties: {
        numbers: { type: 'object', additionalProperties: { type: 'number' }, description: 'Metric name to value, like {"sales": 2, "revenue": 98}. Names: posts, outreach, reach, visits, leads, replies, sales, revenue, or one of their own numbers.' },
        date: { type: 'string', description: 'Any day in the week, YYYY-MM-DD, up to 12 weeks back. Default: this week.' },
        mode: { type: 'string', enum: ['add', 'set'], description: 'add (default) adds to the week; set replaces it.' },
      },
      required: ['numbers'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

function text(s, isError) {
  return { content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) };
}

function getMyBusiness(user) {
  const key = hq.weekKey();
  const p = hq.page(user, key, base());
  const strip = MILESTONES.map((m) => ((m.auto ? !!user.roadmap : !!(user.milestones || {})[m.id]) ? 1 : 0));
  const conns = [p.connections.stripe && 'Stripe', p.connections.shopify && 'Shopify', p.connections.link && '127 link'].filter(Boolean);
  return [
    deps.profile(user),
    `127 HQ
- North Number: ${p.north.label}, ${p.north.value} this week so far (week of ${p.range}).
- Progress map: ${strip.reduce((a, b) => a + b, 0)} of ${MILESTONES.length} milestones.
- Connected: ${conns.length ? conns.join(', ') : 'nothing yet'}. Monday check-in email: ${(user.hq || {}).checkin ? 'on' : 'off'}.
- HQ: ${base()}/app/hq`,
  ].join('\n\n');
}

function getNumbers(user, weeks) {
  const n = Math.max(1, Math.min(12, parseInt(weeks, 10) || 4));
  const cur = hq.weekKey();
  const shown = hq.metrics(user);
  const cy = (user.hq || {}).currency;
  const out = [];
  for (let i = 0; i < n; i++) {
    const key = hq.addWeeks(cur, -i);
    const vals = shown.map((m) => [m, hq.valueOf(user, key, m.id)]).filter(([, v]) => v !== null);
    const w = ((user.hq || {}).weeks || {})[key] || {};
    let line = `Week of ${hq.weekRange(key)}${i === 0 ? ' (this week, in progress)' : ''}: `;
    line += vals.length ? vals.map(([m, v]) => `${m.long || m.label} ${hq.fmtValue(m, v, cy)}`).join(', ') : 'nothing logged';
    if (w.call) line += `. Their call: ${hq.CALLS[w.call]}${w.note ? ` (${w.note})` : ''}`;
    else if (w.note) line += `. Note: ${w.note}`;
    out.push(line + '.');
  }
  // The read is for the latest week with numbers: this week once it has some, else last week.
  const read = (k) => hq.analyze(hq.weekInput(user, k), hq.weekInput(user, hq.addWeeks(k, -1)), hq.targets(user));
  let last = cur;
  let a = read(cur);
  if (a.empty) {
    last = hq.addWeeks(cur, -1);
    a = read(last);
  }
  const t = hq.targets(user);
  if (t.posts || t.outreach) out.push(`Weekly targets: posts ${t.posts || 'not set'}, outreach ${t.outreach || 'not set'}.`);
  out.push(a.empty ? `Where it leaks: not enough logged for the week of ${hq.shortDate(last)}.` : `Where it leaks, week of ${hq.shortDate(last)}: ${a.weakLine}${a.verdict ? ` ${a.verdict}` : ''}`);
  out.push("Floors in 127's read are rules of thumb for a first business, not benchmarks.");
  return out.join('\n');
}

const STOP = new Set('a an and are can do for from get have how i in is it me my of on or the to what with you your'.split(' '));
function words(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
}
function findPlaybook(user, topic) {
  const open = resources.filter((r) => canAccess(user, r.tier));
  const q = words(topic);
  if (!q.length) return `127's playbooks (ask for one by name):\n${open.map((r) => `- ${r.title} (${r.type}): ${r.summary}`).join('\n')}`;
  const score = (r) => {
    const title = words(`${r.title} ${r.framework || ''} ${r.slug}`);
    const body = words(`${r.summary} ${r.output} ${(r.sections || []).map((s) => s.heading).join(' ')}`);
    return q.reduce((a, w) => a + (title.some((t) => t.startsWith(w) || w.startsWith(t)) ? 3 : 0) + (body.some((t) => t.startsWith(w)) ? 1 : 0), 0);
  };
  const ranked = open.map((r) => [r, score(r)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return `No 127 playbook matches "${String(topic).slice(0, 60)}". Call find_playbook with no topic to see them all.`;
  const r = ranked[0][0];
  const parts = [`${r.title} (${r.type}, about ${r.minutes} minutes). ${r.summary}`, `You end with: ${r.output}`];
  for (const s of r.sections || []) parts.push(`## ${s.heading}\n${s.body}`);
  if ((r.worksheet || []).length) parts.push(`Worksheet fields: ${r.worksheet.map((f) => f.label).join('; ')}.`);
  parts.push(`Open it in 127: ${base()}/app/library/${r.slug}`);
  if (ranked.length > 1) parts.push(`Also related: ${ranked.slice(1, 3).map(([x]) => x.title).join(', ')}.`);
  let out = parts.join('\n\n');
  if (out.length > 14000) out = out.slice(0, 14000).trimEnd() + '…';
  return out;
}

function logNumbers(user, args) {
  const nums = args && args.numbers;
  if (!nums || typeof nums !== 'object' || Array.isArray(nums) || !Object.keys(nums).length) return text('Send numbers like {"sales": 2, "revenue": 98}.', true);
  const now = deps.now();
  const cur = hq.weekKey(now);
  let key = cur;
  if (args.date) {
    const t = dayMs(args.date);
    if (!t) return text('date must look like 2026-12-09.', true);
    key = hq.weekKey(t);
    if (key > cur) return text("date can't be in the future.", true);
    if (key < hq.addWeeks(cur, -(hq.SERIES_WEEKS - 1))) return text('date can be up to 12 weeks back.', true);
  }
  const set = args.mode === 'set';
  const resolved = [];
  for (const [name, value] of Object.entries(nums).slice(0, 20)) {
    const def = hq.resolveMetric(user, name);
    if (!def) return text(`Unknown number "${String(name).slice(0, 40)}". Use: ${hq.metrics(user).map((m) => m.label.toLowerCase()).join(', ')}.`, true);
    const v = hq.cleanValue(value, def.money);
    if (v === null) return text(`${def.label} must be a number from 0 to 1000000000.`, true);
    resolved.push([def, v]);
  }
  const h = hq.ensure(user);
  const w = (h.weeks[key] = h.weeks[key] || { v: {}, call: '', note: '', at: iso(now) });
  w.v = w.v || {};
  const done = [];
  for (const [def, v] of resolved) {
    const before = hq.typedOf(user, key, def.id);
    w.v[def.id] = set || def.total || before === null ? v : Math.round((before + v) * 100) / 100;
    done.push(`${def.label} ${hq.fmtValue(def, hq.valueOf(user, key, def.id), h.currency)}`);
  }
  w.at = iso(now);
  hq.trim(h);
  return text(`Logged in 127 HQ for the week of ${hq.weekRange(key)}. The week now shows: ${done.join(', ')}.`);
}

// HQ v2 (lib/harness): its workflow tools join these while HARNESS_V2 is on for the member.
const v2 = (user) => {
  const h = require('./harness');
  return h.enabledFor(user) ? require('./harness/mcp') : null;
};

async function callTool(user, name, args) {
  if (ageCheck.underReview(user)) return text(ageCheck.PAUSE_MESSAGE, true);
  switch (name) {
    case 'get_my_business': return text(getMyBusiness(user));
    case 'get_numbers': return text(getNumbers(user, args && args.weeks));
    case 'find_playbook': return text(findPlaybook(user, args && args.topic));
    case 'log_numbers': {
      const r = logNumbers(user, args || {});
      if (!r.isError) {
        await deps.db.save('users', user);
        emit('hq.week_saved', { userId: user.id, via: 'ai' });
      }
      return r;
    }
    default: {
      const more = v2(user);
      return more ? more.call(user, name, args, { base: base() }) : null;
    }
  }
}

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });

async function handle(user, c, m) {
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m && m.id, -32600, 'Invalid request');
  const isNote = !('id' in m);
  if (isNote) return null;
  const params = m.params || {};
  switch (m.method) {
    case 'initialize': {
      const asked = String(params.protocolVersion || '');
      const who = params.clientInfo && typeof params.clientInfo.name === 'string' ? params.clientInfo.name.replace(/[^\w .()-]/g, '').slice(0, 40) : '';
      if (who) c.ai.client = who;
      return { jsonrpc: '2.0', id: m.id, result: {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: '127', title: '127', version: '1.0.0' },
        instructions: v2(user) ? `${INSTRUCTIONS}\n${v2(user).instructionsFor(user)}` : INSTRUCTIONS,
      } };
    }
    case 'ping': return { jsonrpc: '2.0', id: m.id, result: {} };
    case 'tools/list': {
      const more = v2(user);
      return { jsonrpc: '2.0', id: m.id, result: { tools: more ? TOOLS.concat(more.toolsFor(user)) : TOOLS } };
    }
    case 'tools/call': {
      const r = await callTool(user, String(params.name || ''), params.arguments);
      if (!r) return rpcError(m.id, -32602, `Unknown tool: ${String(params.name || '').slice(0, 40)}`);
      c.ai.calls = (c.ai.calls || 0) + 1;
      c.ai.lastAt = iso();
      emit('hq.ai_call', { userId: user.id, tool: params.name });
      return { jsonrpc: '2.0', id: m.id, result: r };
    }
    default: return rpcError(m.id, -32601, `Method not found: ${m.method.slice(0, 40)}`);
  }
}

// One POST to /hq/ai/<token>: a JSON-RPC message or a batch. Returns [status, body]; body null = no body.
async function mcp(token, body) {
  if (!on()) return [404, null];
  const c = aiByToken(token);
  const user = c && deps.db.get('users', c.id);
  if (!user || !hq.canUse(user)) return [404, rpcError(null, -32001, 'This 127 AI link is off. Make a new one in 127 HQ, Connections.')];
  if (!security.allow(`hq-ai:${c.id}`, AI_PER_HOUR, HOUR)) return [429, rpcError(null, -32002, `Too many calls this hour. The limit is ${AI_PER_HOUR}.`)];
  const batch = Array.isArray(body);
  const msgs = batch ? body.slice(0, 20) : [body];
  if (batch && !msgs.length) return [400, rpcError(null, -32600, 'Invalid request')];
  const out = [];
  for (const m of msgs) {
    const r = await handle(user, c, m);
    if (r) out.push(r);
  }
  await hq.saveConn(c);
  if (!out.length) return [202, null];
  return [200, batch ? out : out[0]];
}

// The Connections page's AI card.
function aiSteps() {
  return {
    claude: ['In Claude, open Settings, then Connectors.', 'Choose Add custom connector.', 'Name it 127, paste your AI link and choose Add.', 'In a chat, ask: "What should I do this week in 127?"'],
    chatgpt: ['In ChatGPT, open Settings, then Apps and Connectors, then Advanced, and turn on Developer mode.', 'Back in Apps and Connectors, choose Create.', 'Name it 127, paste your AI link, choose No authentication and save.', 'In a chat, turn on 127 and ask: "How did my week go?"'],
  };
}

module.exports = {
  on, parseImages, snap, snapFor, clearSnap,
  checkinToken, checkinUrl, fromCheckin, checkinEmail, mondayTick, setCheckin, purgeSnaps, tick,
  makeAiLink, aiByToken, mcp, TOOLS, PROTOCOLS, aiSteps,
  SNAP_MAX,
  _setDeps,
};
