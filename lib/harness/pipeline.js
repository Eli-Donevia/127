// The member's Pipeline: the people and businesses they're working on, from every pack.
// Tools add leads with ctx.leads.upsert({ key, ... }); the same key updates the same lead, and an
// upsert never moves a lead backwards (a gym they've already contacted stays contacted).
// A lead can carry its messages already written (msg) and the facts they cite (facts), so Today's
// queue ("Do my day") can hand the member the next 25 sends ready to go. touch() records a send and
// dates the follow-up: 3 days after the first message, 4 after the second, none after the third.

const crypto = require('crypto');
// onStage(memberId, lead, from, to): a lead changed stage (Today counts first messages toward the daily number).
const deps = { db: require('../db'), now: () => Date.now(), onStage: async () => {} };
const { clip, clipLines, scrubKeys } = require('./text');
const places = require('./places');

const STAGES = ['found', 'contacted', 'replied', 'call', 'won', 'lost'];
const LABELS = { found: 'Found', contacted: 'Contacted', replied: 'Replied', call: 'Call booked', won: 'Won', lost: 'Lost' };
const MAX_PER_MEMBER = 2000;
const MAX_DATA_BYTES = 8000;
const LINK_KEYS = ['website', 'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'maps', 'email', 'phone'];
const MSG_KEYS = ['dm', 'subject', 'email', 'walkin', 'follow1', 'follow2', 'answer'];
const CHANNELS = ['ig', 'email', 'fb', 'site', 'call', 'sms'];
const FOLLOW_DAYS = [3, 4];
const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();

// Where a tool may move a lead (upsert or update): forward only, with won last, so a tool never moves a
// lead back or out of won, and a booking beats an old no (lost to won). The member's own move() goes anywhere.
const RANK = { found: 0, contacted: 1, replied: 2, call: 3, lost: 4, won: 5 };
const ahead = (from, to) => STAGES.includes(to) && RANK[to] > RANK[from];

const idFor = (memberId, pack, key) => crypto.createHash('sha256').update(`${memberId}|${pack}|${key}`).digest('base64url').slice(0, 22);

function cleanLinks(links) {
  const out = {};
  for (const k of LINK_KEYS) {
    const v = links && links[k];
    if (!v) continue;
    const s = String(v).trim().slice(0, 300);
    if (k === 'email' || k === 'phone') out[k] = s;
    else if (/^https?:\/\//i.test(s)) out[k] = s;
  }
  return out;
}

function cleanMsg(msg) {
  const out = {};
  // Messages keep their line breaks: an email's paragraphs, and the name, address and opt-out lines.
  for (const k of MSG_KEYS) if (typeof msg[k] === 'string' && msg[k].trim()) out[k] = k === 'subject' ? clip(msg[k], 160) : clipLines(msg[k], 2000);
  return out;
}

// A date a pack gives (sentAt, repliedAt, answeredAt), never later than now.
const dateOf = (v) => {
  const at = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(at) ? Math.min(at, deps.now()) : null;
};

// A pack that logged the member's answer to a reply (its own "I sent it" step) marks the reply
// answered, so Do my day stops asking for it: { answered: true } for now, or { answeredAt }.
function answered(doc, lead) {
  if (doc.stage !== 'replied' || (lead.answered !== true && !dateOf(lead.answeredAt))) return;
  const at = dateOf(lead.answeredAt) || deps.now();
  doc.answeredAt = iso(Math.max(at, Date.parse(doc.repliedAt) || 0));
}

// Fields a tool or an import may set on top of the basics.
function extras(doc, lead) {
  if (lead.msg && typeof lead.msg === 'object') doc.msg = { ...(doc.msg || {}), ...cleanMsg(lead.msg) };
  if (Array.isArray(lead.facts)) doc.facts = lead.facts.map((f) => clip(f, 200)).filter(Boolean).slice(0, 5);
  if (lead.score !== undefined && Number.isFinite(Number(lead.score))) doc.score = Math.max(0, Math.min(100, Math.round(Number(lead.score))));
  if (CHANNELS.includes(lead.channel)) doc.channel = lead.channel;
  if (typeof lead.reply === 'string') doc.reply = clipLines(lead.reply, 2000);
  // Monday's card pins approved leads to the top of Do my day for that week (the Monday's date).
  if (typeof lead.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lead.week)) doc.week = lead.week;
}

async function upsert(memberId, pack, lead, { runId } = {}) {
  if (!lead || !lead.key) throw new Error('A lead needs a key.');
  const key = String(lead.key).slice(0, 200);
  const id = idFor(memberId, pack, key);
  const existing = deps.db.get('pipeline', id);
  if (!existing && deps.db.filter('pipeline', (l) => l.memberId === memberId).length >= MAX_PER_MEMBER) {
    throw new Error(`Your pipeline is full (${MAX_PER_MEMBER} leads). Archive some lost ones first.`);
  }
  const doc = existing || { id, memberId, pack, key, stage: 'found', history: [] };
  if (lead.name !== undefined) doc.name = clip(lead.name, 120);
  if (lead.company !== undefined) doc.company = clip(lead.company, 120);
  if (lead.source !== undefined) doc.source = clip(lead.source, 60);
  if (lead.note !== undefined) doc.note = clip(lead.note, 1000);
  if (lead.warm !== undefined) doc.warm = !!lead.warm;
  if (lead.links) doc.links = { ...(doc.links || {}), ...cleanLinks(lead.links) };
  if (lead.data !== undefined) {
    const json = JSON.stringify(lead.data);
    if (json && json.length <= MAX_DATA_BYTES) doc.data = lead.data;
  }
  extras(doc, lead);
  const from = existing ? doc.stage : null;
  const want = STAGES.includes(lead.stage) ? lead.stage : null;
  if (want && (!existing || ahead(doc.stage, want))) {
    if (doc.stage !== want || !existing) doc.history.push({ at: new Date(deps.now()).toISOString(), stage: want });
    doc.stage = want;
  } else if (!existing) doc.history.push({ at: new Date(deps.now()).toISOString(), stage: doc.stage });
  settle(doc, from, lead);
  answered(doc, lead);
  if (runId) doc.runId = runId;
  places.scrub(doc, lead); // a Google business keeps its place ID and 127's own work only (Legal L53)
  await deps.db.save('pipeline', doc);
  if (from !== doc.stage) await changed(memberId, doc, from);
  return view(doc);
}

// What a tool's stage brings with it (upsert or update).
function settle(doc, from, lead) {
  if (doc.stage === 'contacted' && !doc.touches) {
    // Arrived already contacted (an import, or a pack that logs a send): date the first follow-up.
    const at = dateOf(lead.sentAt) || deps.now();
    doc.touches = 1;
    doc.lastTouchAt = iso(at);
    doc.nextAt = iso(at + FOLLOW_DAYS[0] * DAY);
  }
  if (from !== doc.stage && doc.stage !== 'found' && doc.stage !== 'contacted') {
    // Moved on past follow-ups, like move(): a reply is dated (a pack may give repliedAt) so Do my
    // day can say how long it's waited.
    doc.nextAt = null;
    if (doc.stage === 'replied') doc.repliedAt = iso(dateOf(lead.repliedAt) || deps.now());
  }
}

async function changed(memberId, doc, from) {
  try {
    await deps.onStage(memberId, view(doc), from, doc.stage);
  } catch (err) {
    console.warn('[harness] pipeline hook failed:', scrubKeys(err.message));
  }
}

// What tools and screens see: no member id.
function view(doc) {
  if (!doc) return null;
  const { memberId, ...rest } = doc;
  return rest;
}

function list(memberId, { stage, pack, limit = 500 } = {}) {
  return deps.db
    .filter('pipeline', (l) => l.memberId === memberId && (!stage || l.stage === stage) && (!pack || l.pack === pack))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, limit)
    .map(view);
}

function get(memberId, id) {
  const l = deps.db.get('pipeline', id);
  return l && l.memberId === memberId ? l : null;
}

async function move(memberId, id, stage) {
  const l = get(memberId, id);
  if (!l) return null;
  if (!STAGES.includes(stage)) throw new Error('Unknown stage.');
  if (l.stage !== stage) {
    const from = l.stage;
    l.stage = stage;
    l.history = (l.history || []).concat({ at: iso(deps.now()), stage }).slice(-30);
    if (stage === 'replied') l.repliedAt = iso(deps.now());
    if (stage === 'contacted' && from === 'found') {
      // Sent outside the queue: count it as the first message and date the follow-up.
      l.touches = Math.max(1, l.touches || 0);
      l.lastTouchAt = iso(deps.now());
      l.nextAt = iso(deps.now() + FOLLOW_DAYS[0] * DAY);
    } else if (stage !== 'contacted') l.nextAt = null;
    await deps.db.save('pipeline', l);
    await changed(memberId, l, from);
  }
  return view(l);
}

// The member sent this lead a message. A first message moves it to contacted (which counts toward
// today's number through the stage hook); a follow-up or an answer to a reply doesn't move it, so
// the caller counts it. Returns { lead, moved }.
async function touch(memberId, id) {
  const l = get(memberId, id);
  if (!l) return null;
  const now = deps.now();
  const from = l.stage;
  const prev = { stage: l.stage, touches: l.touches || 0, lastTouchAt: l.lastTouchAt || null, nextAt: l.nextAt || null, answeredAt: l.answeredAt || null, snoozeUntil: l.snoozeUntil || null, history: (l.history || []).length };
  l.touches = (l.touches || 0) + 1;
  l.lastTouchAt = iso(now);
  l.snoozeUntil = null;
  if (l.stage === 'found') {
    l.stage = 'contacted';
    l.history = (l.history || []).concat({ at: iso(now), stage: 'contacted' }).slice(-30);
  }
  if (l.stage === 'contacted') l.nextAt = FOLLOW_DAYS[l.touches - 1] ? iso(now + FOLLOW_DAYS[l.touches - 1] * DAY) : null;
  if (l.stage === 'replied') l.answeredAt = iso(now);
  await deps.db.save('pipeline', l);
  if (from !== l.stage) await changed(memberId, l, from);
  return { lead: view(l), moved: from !== l.stage, prev };
}

// Undo a touch (Sent tapped by mistake): put back what touch() changed. prev is touch()'s.
async function untouch(memberId, id, prev) {
  const l = get(memberId, id);
  if (!l || !prev || typeof prev !== 'object') return null;
  for (const k of ['touches', 'lastTouchAt', 'nextAt', 'answeredAt', 'snoozeUntil']) l[k] = prev[k] === undefined ? null : prev[k];
  if (STAGES.includes(prev.stage)) l.stage = prev.stage;
  if (Number.isInteger(prev.history) && prev.history >= 0) l.history = (l.history || []).slice(0, prev.history);
  await deps.db.save('pipeline', l);
  return view(l);
}

// Not today: the lead leaves the queue until tomorrow (or n days).
async function snooze(memberId, id, days = 1) {
  const l = get(memberId, id);
  if (!l) return null;
  l.snoozeUntil = iso(deps.now() + Math.max(1, Math.min(30, days)) * DAY);
  await deps.db.save('pipeline', l);
  return view(l);
}

// A tool fills in what it wrote for a lead the member already has (any pack's lead), and can move it
// forward like upsert: a business pack books someone another pack found, so they stay one row.
async function update(memberId, id, patch = {}) {
  const l = get(memberId, id);
  if (!l) return null;
  extras(l, patch);
  const from = l.stage;
  if (ahead(from, patch.stage)) {
    l.stage = patch.stage;
    l.history = (l.history || []).concat({ at: iso(deps.now()), stage: l.stage }).slice(-30);
    settle(l, from, patch);
  }
  answered(l, patch);
  if (patch.note !== undefined) l.note = clip(patch.note, 1000);
  places.scrub(l, patch);
  await deps.db.save('pipeline', l);
  if (from !== l.stage) await changed(memberId, l, from);
  return view(l);
}

async function note(memberId, id, text) {
  const l = get(memberId, id);
  if (!l) return null;
  l.note = clip(text, 1000);
  // A note can quote a Google name seen on screen (Legal L53), so it goes through the same scrub as update().
  places.scrub(l, {});
  await deps.db.save('pipeline', l);
  return view(l);
}

function counts(memberId) {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === memberId)) out[l.stage] = (out[l.stage] || 0) + 1;
  return out;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { STAGES, LABELS, MSG_KEYS, CHANNELS, upsert, list, get, move, touch, untouch, snooze, update, note, counts, view, _setDeps };
