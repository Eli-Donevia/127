// Read my week (HQ_PREMIUM, Legal L79, legal/handoffs/hq-premium.md): one page with this week against last,
// from what HQ already keeps, plus one optional line written by AI.
//
// The page (report) is counted here and sends nothing anywhere. The AI line (stoodOut) is written only when the
// member opens the page (RW2), costs no credits (RW3), and sends Anthropic only this week's and last week's activity
// counts (sent, replies, calls booked, yeses) split by type of business and time of day: never a row per lead,
// sales or revenue, names, contacts, message text or notes (RW1). A line that mentions money, a promise or a
// prediction is dropped and the page shows without it (RW4).

const deps = { db: require('../db'), now: () => Date.now() };
const today = require('./today');
const packs = require('./packs');
const llm = require('./llm');
const ledger = require('./ledger');

const TZ = 'America/New_York';
const hourOf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' });
const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const label = (key) => fmt.format(new Date(`${key}T12:00:00Z`));
const WHEN = (h) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');
const MAP = { contacted: 'sent', replied: 'replies', call: 'calls', won: 'yeses' };

function range(now = deps.now()) {
  const start = today.weekStart(today.dayKey(now));
  return { start, last: today.addDays(start, -7), end: today.addDays(start, 7) };
}

// The page: the member's own activity this week and last, the jobs 127 finished and the credits they used, and
// the daily target they set (an activity count, never money: RW6).
function report(user) {
  const r = range();
  const s = today.scoreboard(user);
  let jobs = 0, credits = 0;
  for (const run of deps.db.filter('runs', (x) => x.memberId === user.id && x.endedAt)) {
    const k = today.dayKey(Date.parse(run.endedAt));
    if (k < r.start || k >= r.end) continue;
    if (run.status === 'done') jobs += 1;
    credits += Number(run.credits && run.credits.used) || 0;
  }
  return {
    from: label(r.start),
    to: label(today.addDays(r.start, 6)),
    this: s.this,
    last: s.last,
    jobs,
    credits: Math.round(credits),
    target: today.target(user),
    quiet: !s.this.touches && !s.this.replies && !s.this.calls && !s.this.yeses && !s.last.touches && !s.last.replies,
  };
}

// What the AI line may see (RW1): counts only, this week and last, by type of business (the pack that found the
// lead, or people the member knows) and the time of day the member first wrote to them.
function counts(user) {
  const r = range();
  const out = { thisWeek: {}, lastWeek: {} };
  const add = (week, type, when, what) => {
    const row = (out[week][`${type}, ${when}`] = out[week][`${type}, ${when}`] || { sent: 0, replies: 0, calls: 0, yeses: 0 });
    row[what] += 1;
  };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) {
    const p = packs.pack(l.pack);
    const type = l.warm ? 'people they know' : String((p && p.title) || 'other').toLowerCase().slice(0, 40);
    const first = (l.history || []).find((h) => h.stage === 'contacted');
    const when = first ? WHEN(Number(hourOf.format(new Date(first.at)))) : 'unknown time';
    for (const h of l.history || []) {
      if (!MAP[h.stage]) continue;
      const k = today.dayKey(Date.parse(h.at));
      if (k >= r.last && k < r.end) add(k < r.start ? 'lastWeek' : 'thisWeek', type, when, MAP[h.stage]);
    }
  }
  return out;
}

// RW4: one sentence, nothing about money, no promise or prediction.
const BANNED = /\$|\b(revenue|sales|sale|income|earn\w*|profit\w*|money|paid|guarantee\w*|will)\b/i;
function clean(text) {
  const one = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] || '';
  if (!one || one.length > 220 || BANNED.test(one) || /\beli\b/i.test(one)) return null;
  return /[.!?]$/.test(one) ? one : `${one}.`;
}

const SYSTEM = `You read one founder's outreach activity counts for this week and last week and write ONE short sentence about a pattern in their own activity (for example which type of business or time of day got more replies). Rules: one sentence, under 25 words. Never mention money, sales or revenue. Never predict, promise or say what will happen. Never compare them with other people or averages. Never give tax, legal or money advice. Don't speak as anyone. If there is no clear pattern, say which kind of activity they did most this week.`;

// Kept in memory for a few hours so reloading the page doesn't ask again; a new week asks again.
const memo = new Map();
const HOURS = 6 * 36e5;

async function stoodOut(user) {
  if (!llm.live()) return null;
  const c = counts(user);
  const total = (w) => Object.values(c[w]).reduce((a, x) => a + x.sent + x.replies + x.calls + x.yeses, 0);
  if (!total('thisWeek')) return null;
  const key = `${user.id}:${range().start}`;
  const hit = memo.get(key);
  if (hit && deps.now() - hit.at < HOURS) return hit.line;
  try {
    const r = await llm.call({
      task: 'classify',
      tier: ledger.tierOf(user),
      system: SYSTEM,
      prompt: JSON.stringify(c),
      maxTokens: 200,
      onCost: async (meta) => ledger.cost(user, meta.usd, { tool: 'week' }),
    });
    const line = clean(r && r.text);
    memo.set(key, { at: deps.now(), line });
    return line;
  } catch (err) {
    return null;
  }
}

function _setDeps(d) {
  Object.assign(deps, d);
  memo.clear();
}

module.exports = { report, counts, stoodOut, clean, _setDeps };
