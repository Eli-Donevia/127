// HQ that notices (HQ_NUDGES, v2/hq-nudges/preview.html): one line a day on Today about the thing that matters most
// today, a Monday read of last week with one challenge for this one, and a page under Progress (/app/hq/you) with the
// month, the member's run, level, marks and ship log. Everything is counted from what HQ already keeps (actions,
// Pipeline history, firsts a1 to a5, finished runs, wins) plus the few things a member tells it here: how HQ talks to
// them, what to mute, a posting goal and up to 3 accounts to keep pace with.
//
// Rules (Legal asks N1 to N5 in v2/hq-nudges/LEGAL-ASKS.md):
// - Every line is written here by hand, never by AI, and passes the copy check: nothing about money, no promise of
//   clients, leads or results (L62), no predictions. Pace is compared with the member's own past and with accounts
//   they named, never with other members.
// - Rival accounts keep a handle, a platform and one post count per week the member typed in. Nothing else about the
//   account is kept, it's shown only to that member, and removing it deletes its counts. Counts read from Instagram or
//   a screenshot wait on Legal N1 (RIVAL_SOURCES below stays member-only until then).
// - Nothing here sends anything outside HQ. Email and phone alerts wait on N3.
// Days and weeks are Eastern time, like Today's numbers; the hour a line is judged by is the member's own time zone.

const deps = { db: require('../db'), now: () => Date.now() };
const today = require('./today');

const COL = 'nudges';
const DEFAULT_TZ = 'America/Chicago';
const MAX_REST = 2;
const EARN_EVERY = 7;
const LOOKBACK = 400;
const MAX_RIVALS = 3;
const MAX_WEEKS_KEPT = 12;
const DEFAULT_POST_GOAL = 3;
const KINDS = { replies: 'Replies waiting', run: 'Your run', posting: 'Posting', rivals: 'Accounts you keep pace with', quiet: 'Quiet days', bests: 'Bests and marks', firsts: 'Next first' };
// Lines that push. In quiet hours they wait; lines that only tell (replies waiting, a rest day used, a new mark) don't.
const PUSHY = new Set(['run', 'posting', 'rivals', 'quiet']);
const TONES = ['straight', 'easy'];
const PLATFORMS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', other: 'Other' };
// Where a rival's count may come from. 'member' only until Legal N1 clears Instagram's Business Discovery and screenshots.
const RIVAL_SOURCES = ['member'];
const COUNT_CHOICES = [0, 1, 2, 3, 5, 7, 10];
const PLAN_POSTS = '/app/hq/w/content.plan_week';

const iso = (ms = deps.now()) => new Date(ms).toISOString();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

// ---------- what the member set ----------

function blank(memberId) {
  return { id: memberId, memberId, tone: 'straight', mute: {}, quiet: { from: 21, to: 8 }, postGoal: null, rivals: [], marks: {}, seen: {}, challenge: null };
}
function docOf(memberId) {
  const d = deps.db.get(COL, memberId);
  return d ? { ...blank(memberId), ...d } : blank(memberId);
}

function prefs(user) {
  const d = docOf(user.id);
  return { tone: TONES.includes(d.tone) ? d.tone : 'straight', mute: d.mute || {}, quiet: d.quiet || { from: 21, to: 8 }, postGoal: d.postGoal, rivals: d.rivals || [] };
}

const hourOk = (h) => Number.isInteger(h) && h >= 0 && h <= 23;
async function setPrefs(user, body = {}) {
  const d = docOf(user.id);
  if (TONES.includes(body.tone)) d.tone = body.tone;
  if (body.mute && typeof body.mute === 'object') d.mute = Object.fromEntries(Object.keys(KINDS).filter((k) => body.mute[k]).map((k) => [k, true]));
  const from = parseInt(body.quietFrom, 10), to = parseInt(body.quietTo, 10);
  if (hourOk(from) && hourOk(to)) d.quiet = { from, to };
  if (body.postGoal !== undefined) {
    const g = parseInt(body.postGoal, 10);
    d.postGoal = Number.isInteger(g) && g >= 0 && g <= 21 ? g : null;
  }
  await deps.db.save(COL, d);
  return d;
}

function cleanHandle(h) {
  const s = String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.|m\.)?[a-z.]+\.[a-z]+\/(@)?/i, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._-]{1,40}$/.test(s) ? s.toLowerCase() : '';
}

async function addRival(user, { handle, platform } = {}) {
  const d = docOf(user.id);
  const h = cleanHandle(handle);
  if (!h) throw Object.assign(new Error('Type the account handle, like @northside.fit.'), { status: 400 });
  const p = PLATFORMS[platform] ? platform : 'instagram';
  d.rivals = d.rivals || [];
  if (d.rivals.some((r) => r.handle === h && r.platform === p)) return d;
  if (d.rivals.length >= MAX_RIVALS) throw Object.assign(new Error(`You can keep pace with ${MAX_RIVALS} accounts. Remove one first.`), { status: 400 });
  d.rivals.push({ id: `${p}:${h}`, handle: h, platform: p, counts: {}, addedAt: iso() });
  await deps.db.save(COL, d);
  return d;
}

// Removing an account deletes everything kept about it (its weekly counts go with it).
async function removeRival(user, id) {
  const d = docOf(user.id);
  d.rivals = (d.rivals || []).filter((r) => r.id !== id);
  await deps.db.save(COL, d);
  return d;
}

// One post count for one week, typed by the member. week is a Monday (YYYY-MM-DD), this week or up to 4 back.
async function countRival(user, id, { week, n } = {}) {
  const d = docOf(user.id);
  const r = (d.rivals || []).find((x) => x.id === id);
  if (!r) return null;
  const thisWeek = today.weekStart(today.dayKey(deps.now()));
  const w = /^\d{4}-\d{2}-\d{2}$/.test(String(week)) && today.weekStart(week) === week && week <= thisWeek && week >= today.addDays(thisWeek, -28) ? week : today.addDays(thisWeek, -7);
  const c = parseInt(n, 10);
  if (!Number.isInteger(c) || c < 0 || c > 200) throw Object.assign(new Error('Pick how many times they posted.'), { status: 400 });
  r.counts = { ...(r.counts || {}), [w]: { n: c, source: 'member', at: iso() } };
  const keep = Object.keys(r.counts).sort().slice(-MAX_WEEKS_KEPT);
  r.counts = Object.fromEntries(keep.map((k) => [k, r.counts[k]]));
  await deps.db.save(COL, d);
  return r;
}

// ---------- the numbers ----------

function localHour(user, ms = deps.now()) {
  const b = deps.db.get('brains', user.id);
  const tz = (b && b.business && b.business.timezone) || DEFAULT_TZ;
  let f;
  try {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', weekday: 'short', hourCycle: 'h23' });
  } catch {
    f = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TZ, hour: 'numeric', weekday: 'short', hourCycle: 'h23' });
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour) % 24, weekday: p.weekday };
}
const inQuiet = (q, h) => (q.from === q.to ? false : q.from < q.to ? h >= q.from && h < q.to : h >= q.from || h < q.to);

function actionsByDay(memberId) {
  const out = {};
  for (const a of deps.db.filter('actions', (x) => x.memberId === memberId)) out[a.day] = a;
  return out;
}
const sends = (a) => (a ? (a.counts.warm || 0) + (a.counts.cold || 0) : 0);
const posts = (a) => (a ? a.counts.content || 0 : 0);

// The run: days in a row at the member's daily number. Every 7 days at it earns a rest day (up to 2 held), and a
// missed day spends one on its own, so the run carries on. A miss with none held ends the run and its rest days.
// Today counts once it's hit; until then it's still open. Judged by today's daily number for every day.
function runOf(byDay, target, todayKey) {
  const out = { days: 0, rest: 0, longest: 0, todayHit: false, status: {} };
  const keys = Object.keys(byDay).filter((k) => k <= todayKey).sort();
  if (!keys.length) {
    out.status[todayKey] = 'now';
    return out;
  }
  const floor = today.addDays(todayKey, -LOOKBACK);
  let since = 0;
  const hitDay = (k) => {
    out.days += 1;
    since += 1;
    if (since === EARN_EVERY) {
      out.rest = Math.min(MAX_REST, out.rest + 1);
      since = 0;
    }
    out.longest = Math.max(out.longest, out.days);
    out.status[k] = 'hit';
  };
  for (let k = keys[0] < floor ? floor : keys[0]; k < todayKey; k = today.addDays(k, 1)) {
    const a = byDay[k];
    if (a && a.total >= target) hitDay(k);
    else if (out.days > 0 && out.rest > 0) {
      out.rest -= 1;
      out.status[k] = 'rest';
    } else {
      out.days = 0;
      out.rest = 0;
      since = 0;
      out.status[k] = 'miss';
    }
  }
  const t = byDay[todayKey];
  if (t && t.total >= target) {
    out.todayHit = true;
    hitDay(todayKey);
  } else out.status[todayKey] = 'now';
  return out;
}

// Mon..Sun of the week holding `key`: hit, rest, miss, now (today, still open) or later.
function weekStrip(run, key) {
  const start = today.weekStart(key);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
    const k = today.addDays(start, i);
    return { day: d, key: k, status: k > key ? 'later' : run.status[k] || 'miss' };
  });
}

// Per week (Monday key): sends, posts, days at the number; replies, calls and yeses from Pipeline history.
function weeks(user, byDay, target) {
  const out = {};
  const row = (w) => (out[w] = out[w] || { sends: 0, posts: 0, days: 0, replies: 0, calls: 0, yeses: 0 });
  for (const [k, a] of Object.entries(byDay)) {
    const r = row(today.weekStart(k));
    r.sends += sends(a);
    r.posts += posts(a);
    if (a.total >= target) r.days += 1;
  }
  const map = { replied: 'replies', call: 'calls', won: 'yeses' };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) {
    for (const h of l.history || []) {
      if (!map[h.stage]) continue;
      const t = Date.parse(h.at);
      if (Number.isFinite(t)) row(today.weekStart(today.dayKey(t)))[map[h.stage]] += 1;
    }
  }
  return out;
}

// Replies the member hasn't answered yet, and how fast they answered the ones they did.
function replies(user) {
  const now = deps.now();
  const waiting = [];
  let fast = 0;
  const answered = [];
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) {
    const r = Date.parse(l.repliedAt);
    if (!Number.isFinite(r)) continue;
    const a = Date.parse(l.answeredAt);
    if (Number.isFinite(a) && a >= r) {
      if (a - r <= 36e5) fast += 1;
      answered.push({ at: r, hours: (a - r) / 36e5 });
    } else if (l.stage === 'replied' && now - r >= 36e5) waiting.push({ at: r });
  }
  waiting.sort((x, y) => x.at - y.at);
  return { waiting, fast, answered };
}

function bestOf(wk, field, exceptWeek) {
  let best = 0, week = null;
  for (const [w, r] of Object.entries(wk)) if (w !== exceptWeek && r[field] > best) (best = r[field]), (week = w);
  return { best, week };
}

// Everything the lines, the levels and the marks read, counted once.
function summary(user) {
  const now = deps.now();
  const key = today.dayKey(now);
  const target = today.target(user);
  const byDay = actionsByDay(user.id);
  const run = runOf(byDay, target, key);
  const wk = weeks(user, byDay, target);
  const thisWeek = today.weekStart(key);
  const lastWeek = today.addDays(thisWeek, -7);
  const b = deps.db.get('brains', user.id) || {};
  const p = prefs(user);
  const everPosted = Object.values(byDay).some((a) => posts(a) > 0);
  const lifetime = Object.values(byDay).reduce((n, a) => n + sends(a), 0);
  const days = Object.keys(byDay).sort();
  let quietDays = 0;
  if (days.length && !(byDay[key] && byDay[key].total)) {
    const last = [...days].reverse().find((k) => byDay[k].total > 0 && k < key);
    if (last) for (let k = today.addDays(last, 1); k < key; k = today.addDays(k, 1)) quietDays += 1;
  }
  const runs = deps.db.filter('runs', (r) => r.memberId === user.id && r.status === 'done' && r.endedAt);
  return {
    key, thisWeek, lastWeek, target, byDay, run, wk, act: b.act || {}, prefs: p,
    postGoal: Number.isInteger(p.postGoal) ? p.postGoal : DEFAULT_POST_GOAL, postGoalSet: Number.isInteger(p.postGoal), everPosted,
    lifetime, quietDays, daysAt: Object.values(byDay).filter((a) => a.total >= target).length,
    replies: replies(user), runs, wins: deps.db.filter('proof', (w) => w.memberId === user.id),
  };
}

// ---------- levels and marks ----------

const LEVELS = [
  { n: 1, name: 'Business set', next: 'Tell 127 what you sell and who it\'s for.', href: '/app/hq/brain', done: (s) => !!s.act.a1 },
  { n: 2, name: 'First send', next: 'Send your first message from Do my day. 127 writes it.', href: '/app/hq#day', done: (s) => !!s.act.a3 },
  { n: 3, name: 'First reply', next: 'Keep your daily number going. Follow-ups come back to Do my day on their own.', href: '/app/hq#day', done: (s) => !!s.act.a4 },
  { n: 4, name: 'Seven days running', next: 'Hit your daily number 7 days in a row. Rest days count.', href: '/app/hq#day', done: (s) => s.run.longest >= 7 },
  { n: 5, name: 'First yes', next: 'When someone says yes, mark it in Pipeline.', href: '/app/hq/pipeline', done: (s) => !!s.act.a5 },
  { n: 6, name: 'Thirty days at your number', next: 'Thirty days at your daily number, in a row or not.', href: '/app/hq#day', done: (s) => s.daysAt >= 30 },
  { n: 7, name: 'A hundred days at your number', next: 'A hundred days at your daily number.', href: '/app/hq#day', done: (s) => s.daysAt >= 100 },
];

function level(s) {
  let n = 0;
  while (n < LEVELS.length && LEVELS[n].done(s)) n += 1;
  const next = LEVELS[n] || null;
  return { n, name: n ? LEVELS[n - 1].name : 'Getting started', next: next ? { n: next.n, name: next.name, hint: next.next, href: next.href } : null, of: LEVELS.length, pct: Math.round((n / LEVELS.length) * 100) };
}

const anyWeek = (s, test) => Object.entries(s.wk).some(([w, r]) => test(r, w));
function postedStreak(s) {
  const ws = Object.keys(s.wk).sort();
  let best = 0, cur = 0, prev = null;
  for (const w of ws) {
    const ok = s.wk[w].posts >= Math.max(1, s.postGoal);
    cur = ok && prev && today.addDays(prev, 7) === w ? cur + 1 : ok ? 1 : 0;
    best = Math.max(best, cur);
    prev = w;
  }
  return best;
}
function cameBack(s) {
  const ks = Object.keys(s.byDay).filter((k) => s.byDay[k].total > 0).sort();
  for (let i = 1; i < ks.length; i++) {
    const gap = (Date.parse(`${ks[i]}T12:00:00Z`) - Date.parse(`${ks[i - 1]}T12:00:00Z`)) / 864e5;
    if (gap > 7 && s.byDay[ks[i]].total >= s.target) return true;
  }
  return false;
}

// Twelve marks, each for a habit. icon is a key into views/partials/hq-nudge-icons.ejs.
const MARKS = [
  { id: 'first_send', name: 'First send', says: 'Your first message went out.', icon: 'send', test: (s) => !!s.act.a3 },
  { id: 'first_reply', name: 'First reply', says: 'Someone wrote back.', icon: 'reply', test: (s) => !!s.act.a4 },
  { id: 'first_yes', name: 'First yes', says: 'Someone said yes.', icon: 'check', test: (s) => !!s.act.a5 },
  { id: 'run7', name: 'Seven days running', says: 'Seven days in a row at your number.', icon: 'bars', test: (s) => s.run.longest >= 7 },
  { id: 'run30', name: 'Thirty days running', says: 'Thirty days in a row at your number.', icon: 'flame', test: (s) => s.run.longest >= 30 },
  { id: 'full_week', name: 'Full week', says: 'Every day of one week at your number.', icon: 'rings', test: (s) => anyWeek(s, (r) => r.days >= 7) },
  { id: 'fast_hands', name: 'Fast hands', says: 'Five replies answered inside an hour.', icon: 'clock', test: (s) => s.replies.fast >= 5 },
  { id: 'poster', name: 'On the feed', says: 'A month of weeks at your posting goal.', icon: 'post', test: (s) => postedStreak(s) >= 4 },
  { id: 'hundred_day', name: 'Hundred day', says: 'A hundred sends in one day.', icon: 'bolt', test: (s) => Object.values(s.byDay).some((a) => sends(a) >= 100) },
  { id: 'five_hundred', name: 'Five hundred', says: 'Five hundred sends all told.', icon: 'stack', test: (s) => s.lifetime >= 500 },
  { id: 'shipped10', name: 'Ten shipped', says: 'Ten jobs 127 finished for you.', icon: 'box', test: (s) => s.runs.length >= 10 },
  { id: 'comeback', name: 'Back at it', says: 'A full day at your number after a week away.', icon: 'return', test: (s) => cameBack(s) },
];

function marks(s, d) {
  return MARKS.map((m) => ({ id: m.id, name: m.name, says: m.says, icon: m.icon, earned: (d.marks && d.marks[m.id]) || null, early: !!(d.early && d.early[m.id]), fresh: !!(d.marks && d.marks[m.id] && !(d.seen && d.seen[m.id])) }));
}

// Keeps the date each mark was first earned. Called when Today or Progress opens; writes only when something's new.
async function sync(user, s = summary(user)) {
  const d = docOf(user.id);
  d.marks = d.marks || {};
  // The first time HQ looks, marks already earned before the switch went on count as earned "before", with no date
  // and no glow, so a member doesn't get a pile of new marks all dated today.
  const first = !d.syncedAt;
  let changed = first;
  if (first) d.syncedAt = iso();
  d.early = d.early || {};
  d.seen = d.seen || {};
  for (const m of MARKS) {
    if (!d.marks[m.id] && m.test(s)) {
      d.marks[m.id] = iso();
      if (first) (d.early[m.id] = true), (d.seen[m.id] = true);
      changed = true;
    }
  }
  if (changed) await deps.db.save(COL, d);
  return d;
}

async function markSeen(user) {
  const d = docOf(user.id);
  d.seen = { ...(d.seen || {}), ...Object.fromEntries(Object.keys(d.marks || {}).map((k) => [k, true])) };
  await deps.db.save(COL, d);
}

// ---------- the daily line ----------

// Rival pace for a week: the latest week the member counted (this one, else last), against their own posts that week.
function rivalPace(s) {
  const out = [];
  for (const r of s.prefs.rivals) {
    const c = r.counts || {};
    const w = c[s.thisWeek] ? s.thisWeek : c[s.lastWeek] ? s.lastWeek : null;
    if (!w) continue;
    out.push({ id: r.id, handle: r.handle, platform: r.platform, week: w, when: w === s.thisWeek ? 'this week' : 'last week', them: c[w].n, you: (s.wk[w] && s.wk[w].posts) || 0 });
  }
  return out;
}

const L = (kind, id, o) => ({ kind, id, ...o });

// Each line has a straight and an easy version; hl is the part of `say` lit in Pop.
function candidates(user, s, d, hour) {
  const out = [];
  const left = Math.max(0, s.target - ((s.byDay[s.key] && s.byDay[s.key].total) || 0));
  const minutes = Math.max(1, Math.round(left * 0.8));

  const w = s.replies.waiting.length;
  if (w) {
    const who = w === 1 ? 'Someone' : `${w} people`;
    out.push(L('replies', 'replies_waiting', {
      say: { straight: `${who} wrote back and ${w === 1 ? 'is' : 'are'} waiting on you.`, easy: `${who} wrote back. A quick answer keeps them talking.` },
      hl: who, sub: `Oldest waiting since ${new Date(s.replies.waiting[0].at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
      cta: 'Answer them', href: '/app/hq/pipeline',
    }));
  }

  if (s.run.days >= 2 && !s.run.todayHit && hour >= 16) {
    const d0 = s.run.days;
    if (s.run.rest > 0) {
      out.push(L('run', 'run_keep', {
        say: { straight: `${plural(left, 'send', 'sends')} keeps your ${d0}-day run without a rest day.`, easy: `You're ${d0} days in. ${plural(left, 'send', 'sends')} saves your rest day for later.` },
        hl: `${d0}-day run`, sub: `About ${plural(minutes, 'minute', 'minutes')}. You hold ${plural(s.run.rest, 'rest day', 'rest days')}.`, cta: 'Do my day', href: '/app/hq#day',
      }));
    } else {
      out.push(L('run', 'run_risk', {
        say: { straight: `Your ${d0}-day run ends at midnight. ${plural(left, 'send', 'sends')} to go.`, easy: `You're ${d0} days in. ${plural(left, 'send', 'sends')} keeps it going tonight.` },
        hl: `${d0}-day run`, sub: `About ${plural(minutes, 'minute', 'minutes')} from your phone.`, cta: 'Do my day', href: '/app/hq#day',
      }));
    }
  }

  const fresh = MARKS.find((m) => d.marks && d.marks[m.id] && !(d.seen && d.seen[m.id]));
  if (fresh) {
    out.push(L('bests', 'mark_new', { say: { straight: `New mark: ${fresh.name}.`, easy: `You earned a new mark: ${fresh.name}.` }, hl: fresh.name, sub: fresh.says, cta: 'See your marks', href: '/app/hq/you#marks', win: true }));
  }

  for (const r of rivalPace(s)) {
    if (r.them >= 2 && r.them >= 2 * Math.max(1, r.you) && r.them > r.you) {
      out.push(L('rivals', 'rival_ahead', {
        say: { straight: `@${r.handle} posted ${times(r.them)} ${r.when}. ${r.you ? `You posted ${times(r.you)}.` : "You haven't posted."}`, easy: `@${r.handle} is at ${plural(r.them, 'post', 'posts')} ${r.when}. You're at ${r.you}. Room for a couple more?` },
        hl: `@${r.handle}`, sub: r.week === s.thisWeek ? 'Your posts count from what you log, or Instagram once it\'s connected.' : 'From the count you gave on Monday.', cta: 'Plan your posts', href: PLAN_POSTS, pace: { them: r.them, you: r.you, handle: r.handle },
      }));
      break;
    }
  }

  const { weekday } = localHour(user);
  const late = ['Thu', 'Fri', 'Sat', 'Sun'].includes(weekday);
  const postsNow = (s.wk[s.thisWeek] && s.wk[s.thisWeek].posts) || 0;
  if ((s.postGoalSet || s.everPosted) && s.postGoal > 0 && late && postsNow < s.postGoal) {
    out.push(L('posting', 'posting_behind', {
      say: { straight: postsNow ? `You've posted ${times(postsNow)} this week. Your goal is ${s.postGoal}.` : `No posts yet this week. Your goal is ${s.postGoal}.`, easy: `${plural(postsNow, 'post', 'posts')} so far this week, goal ${s.postGoal}. One today?` },
      hl: `goal is ${s.postGoal}`, sub: 'Log a post on Today when you put one out.', cta: 'Plan your posts', href: PLAN_POSTS,
    }));
  }

  const thisSends = (s.wk[s.thisWeek] && s.wk[s.thisWeek].sends) || 0;
  const best = bestOf(s.wk, 'sends', s.thisWeek);
  const gap = best.best + 1 - thisSends;
  if (best.best >= 20 && thisSends >= best.best * 0.7 && gap > 0 && gap <= Math.max(5, Math.round(best.best * 0.15))) {
    out.push(L('bests', 'best_close', { say: { straight: `${plural(gap, 'more send', 'more sends')} and this is your best week yet.`, easy: `You're ${plural(gap, 'send', 'sends')} from your best week.` }, hl: 'best week', sub: `Your best so far: ${best.best} in a week.`, cta: 'Do my day', href: '/app/hq#day' }));
  }

  if (s.quietDays >= 3) {
    out.push(L('quiet', 'quiet_days', { say: { straight: `${s.quietDays} quiet days. One send starts a new run.`, easy: `It's been ${s.quietDays} days. One message today gets you moving again.` }, hl: `${s.quietDays} quiet days`, sub: 'Do my day has them written.', cta: 'Do my day', href: '/app/hq#day' }));
  }

  if (s.run.status[today.addDays(s.key, -1)] === 'rest') {
    out.push(L('run', 'rest_used', { say: { straight: `A rest day covered yesterday. Your run is still ${s.run.days}.`, easy: `Yesterday was covered by a rest day. Still ${plural(s.run.days, 'day', 'days')}.` }, hl: 'rest day', sub: 'You earn one for every 7 days at your number.', cta: 'See your run', href: '/app/hq/you', info: true }));
  }

  const lv = level(s);
  if (lv.next && lv.n < 3) {
    out.push(L('firsts', `level_${lv.next.n}`, { say: { straight: `Level ${lv.next.n}: ${lv.next.name}.`, easy: `Next up, level ${lv.next.n}: ${lv.next.name}.` }, hl: `Level ${lv.next.n}`, sub: lv.next.hint, cta: lv.next.n === 1 ? 'Open your Brain' : 'Do my day', href: lv.next.href }));
  }
  return out;
}

// The one line for Today, or null. A muted kind never shows; in quiet hours the lines that push wait.
function daily(user, s = summary(user), d = docOf(user.id)) {
  const { hour } = localHour(user);
  const quiet = inQuiet(s.prefs.quiet, hour);
  const tone = s.prefs.tone;
  const pick = candidates(user, s, d, hour).find((c) => !s.prefs.mute[c.kind] && !(quiet && PUSHY.has(c.kind)));
  if (!pick) return null;
  return { id: pick.id, kind: pick.kind, tag: KINDS[pick.kind], say: pick.say[tone], hl: pick.hl, sub: pick.sub, cta: pick.cta, href: pick.href, pace: pick.pace || null, win: !!pick.win };
}

// ---------- the week ----------

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const label = (key) => fmt.format(new Date(`${key}T12:00:00Z`));

// This week's challenge: from last week's thinnest number. Taken with one tap, filled from real data.
function challengeFor(s) {
  const last = s.wk[s.lastWeek] || { sends: 0, posts: 0, days: 0 };
  if ((s.postGoalSet || s.everPosted) && s.postGoal > 0 && last.posts < s.postGoal) return { id: 'post', title: `Post ${times(s.postGoal)} by Sunday.`, why: 'Picked because posting was your thinnest number last week.', target: s.postGoal, field: 'posts' };
  if (last.days < 5) return { id: 'days', title: 'Hit your number 5 days this week.', why: `Last week you hit it ${plural(last.days, 'day', 'days')}.`, target: 5, field: 'days' };
  const t = Math.max(s.target * 5, Math.round(last.sends * 1.15));
  return { id: 'sends', title: `Send ${t} this week.`, why: `About 15% past last week's ${last.sends}.`, target: t, field: 'sends' };
}

function challenge(s, d) {
  const c = challengeFor(s);
  const taken = d.challenge && d.challenge.week === s.thisWeek ? d.challenge : null;
  const use = taken ? { ...c, ...taken.def } : c;
  const progress = (s.wk[s.thisWeek] && s.wk[s.thisWeek][use.field]) || 0;
  return { ...use, week: s.thisWeek, taken: !!taken, progress, done: progress >= use.target, pct: Math.min(100, Math.round((progress / Math.max(1, use.target)) * 100)) };
}

async function takeChallenge(user, take = true) {
  const s = summary(user);
  const d = docOf(user.id);
  d.challenge = take ? { week: s.thisWeek, takenAt: iso(), def: challengeFor(s) } : null;
  await deps.db.save(COL, d);
  return d.challenge;
}

// Monday's read of last week (on Today on Mondays, and on Read my week all week).
function weekly(user, s = summary(user), d = docOf(user.id)) {
  const lw = s.wk[s.lastWeek] || { sends: 0, posts: 0, days: 0, replies: 0, calls: 0, yeses: 0 };
  const pw = s.wk[today.addDays(s.lastWeek, -7)] || { sends: 0, posts: 0, days: 0, replies: 0, calls: 0, yeses: 0 };
  const older = Object.keys(s.wk).filter((w) => w < s.lastWeek);
  const best = (f) => older.length >= 2 && lw[f] > 0 && lw[f] > Math.max(...older.map((w) => s.wk[w][f]));
  const stats = [['sends', 'Sent'], ['replies', 'Replies'], ['calls', 'Calls booked'], ['posts', 'Posts']].map(([f, name]) => ({ f, name, v: lw[f], before: pw[f], best: best(f) }));
  const bestOne = stats.find((x) => x.best);
  const tone = s.prefs.tone;
  let head;
  if (bestOne) head = tone === 'easy' ? `Nice week. ${bestOne.name} hit a new high.` : `Your best week yet for ${bestOne.name.toLowerCase()}.`;
  else if (!lw.sends && !lw.replies && !lw.posts) head = tone === 'easy' ? 'A quiet week. One small goal for this one.' : 'A quiet week. Here\'s one goal for this one.';
  else if (lw.sends > pw.sends) head = `${plural(lw.sends - pw.sends, 'more send', 'more sends')} than the week before.`;
  else head = tone === 'easy' ? 'Here\'s how your week went.' : 'Your week, against the one before.';
  // Where it leaks: replies from last week that waited more than a day.
  const inLast = (x) => today.weekStart(today.dayKey(x.at)) === s.lastWeek;
  const inWeek = s.replies.answered.filter(inLast);
  const stillWaiting = s.replies.waiting.filter((x) => inLast(x) && deps.now() - x.at > 864e5).length;
  const slow = inWeek.filter((a) => a.hours > 24).length + stillWaiting;
  const total = inWeek.length + s.replies.waiting.filter(inLast).length;
  const leak = slow ? { say: `${slow} of your ${plural(total, 'reply', 'replies')} waited over a day for an answer.` } : null;
  const ask = s.prefs.rivals.filter((r) => !(r.counts || {})[s.lastWeek]).map((r) => ({ id: r.id, handle: r.handle, platform: PLATFORMS[r.platform] || r.platform }));
  return { from: label(s.lastWeek), to: label(today.addDays(s.lastWeek, 6)), week: s.lastWeek, head, stats, leak, challenge: challenge(s, d), pace: rivalPace(s).filter((r) => r.week === s.lastWeek), ask, choices: COUNT_CHOICES };
}

// The Monday card shows on Today on Monday (Eastern), until the member closes it.
function mondayCard(user, s, d) {
  const dow = new Date(`${s.key}T12:00:00Z`).getUTCDay();
  if (dow !== 1 || (d.closedWeek && d.closedWeek === s.thisWeek)) return null;
  if (!Object.keys(s.byDay).length) return null;
  return weekly(user, s, d);
}
// "New in 127 this week" on Today, until the member closes it for the week.
function dropClosed(user, week) {
  return docOf(user.id).closedDrop === week;
}
async function closeDrop(user) {
  const d = docOf(user.id);
  d.closedDrop = today.weekStart(today.dayKey(deps.now()));
  await deps.db.save(COL, d);
}

async function closeMonday(user) {
  const s = summary(user);
  const d = docOf(user.id);
  d.closedWeek = s.thisWeek;
  await deps.db.save(COL, d);
}

// ---------- the month and the ship log ----------

const monthKey = (key) => key.slice(0, 7);
const monthName = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const STEP_LINES = { a1: 'Business set.', a2: 'First result in.', a3: 'First send.', a4: 'First reply.', a5: 'First yes.' };

function shipLog(user, s = summary(user), d = docOf(user.id), limit = 60) {
  const out = [];
  for (const [k, at] of Object.entries(s.act)) if (STEP_LINES[k] && at) out.push({ at, what: STEP_LINES[k], win: k === 'a4' || k === 'a5' });
  // The firsts already have their own line above, so their marks don't repeat them.
  for (const m of MARKS) if (d.marks && d.marks[m.id] && !(d.early && d.early[m.id]) && !/^first_/.test(m.id)) out.push({ at: d.marks[m.id], what: `${m.name}. ${m.says}`, strong: m.name, win: true });
  // One line per job per day, so a busy day doesn't flood the log.
  const seen = new Set();
  for (const r of s.runs) {
    const k = `${r.workflowId}:${String(r.endedAt).slice(0, 10)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ at: r.endedAt, what: `${r.title || 'A job'} finished.` });
  }
  const WIN = { talk: 'Logged a real conversation.', yes: 'Logged a yes.', paid: 'Logged a paying client.' };
  for (const w of s.wins) if (WIN[w.kind]) out.push({ at: w.createdAt, what: WIN[w.kind], win: true });
  return out.filter((x) => x.at && Number.isFinite(Date.parse(x.at))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit).map((x) => ({ ...x, day: label(today.dayKey(Date.parse(x.at))) }));
}

function month(user, m, s = summary(user), d = docOf(user.id)) {
  const mk = /^\d{4}-\d{2}$/.test(String(m || '')) && m <= monthKey(s.key) ? m : monthKey(s.key);
  const r = { days: 0, sends: 0, posts: 0, replies: 0, calls: 0, yeses: 0, longest: 0, jobs: 0 };
  let cur = 0;
  for (let k = `${mk}-01`; monthKey(k) === mk && k <= s.key; k = today.addDays(k, 1)) {
    const a = s.byDay[k];
    r.sends += sends(a);
    r.posts += posts(a);
    const st = s.run.status[k];
    if (a && a.total >= s.target) r.days += 1;
    cur = st === 'hit' ? cur + 1 : st === 'rest' ? cur : 0;
    r.longest = Math.max(r.longest, cur);
  }
  const map = { replied: 'replies', call: 'calls', won: 'yeses' };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) for (const h of l.history || []) if (map[h.stage] && monthKey(today.dayKey(Date.parse(h.at))) === mk) r[map[h.stage]] += 1;
  r.jobs = s.runs.filter((x) => monthKey(today.dayKey(Date.parse(x.endedAt))) === mk).length;
  const months = [];
  for (let i = 0, k = monthKey(s.key); i < 6; i++) {
    months.push({ key: k, name: monthName(k) });
    const dt = new Date(`${k}-15T12:00:00Z`);
    dt.setUTCMonth(dt.getUTCMonth() - 1);
    k = dt.toISOString().slice(0, 7);
  }
  // The month as a calendar, Monday first: each day hit, rest, miss, now (today, still open), later, or blank padding.
  const first = `${mk}-01`;
  const cal = Array.from({ length: (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 }, () => null);
  const started = Object.keys(s.byDay).sort()[0] || s.key;
  for (let k = first; monthKey(k) === mk; k = today.addDays(k, 1)) cal.push({ key: k, d: Number(k.slice(8)), status: k > s.key ? 'later' : k < started ? 'before' : s.run.status[k] || 'miss' });
  return { key: mk, name: monthName(mk), short: monthName(mk).split(' ')[0], current: mk === monthKey(s.key), cal, ...r, log: shipLog(user, s, d).filter((x) => monthKey(today.dayKey(Date.parse(x.at))) === mk), months };
}

// Everything the Progress page shows.
function progress(user, m) {
  const s = summary(user);
  const d = docOf(user.id);
  return { run: { days: s.run.days, rest: s.run.rest, longest: s.run.longest, todayHit: s.run.todayHit, week: weekStrip(s.run, s.key), maxRest: MAX_REST, every: EARN_EVERY }, level: level(s), levels: LEVELS.map((l) => ({ n: l.n, name: l.name })), marks: marks(s, d), month: month(user, m, s, d), log: shipLog(user, s, d), prefs: s.prefs, postGoal: s.postGoal, kinds: KINDS, platforms: PLATFORMS, rivals: s.prefs.rivals.map((r) => ({ ...r, platformName: PLATFORMS[r.platform] || r.platform, last: (r.counts || {})[s.lastWeek] ? r.counts[s.lastWeek].n : null })), lastWeek: s.lastWeek, choices: COUNT_CHOICES, maxRivals: MAX_RIVALS };
}

// What Today shows: the line, the run strip and, on Mondays, the week card.
function forToday(user) {
  const s = summary(user);
  const d = docOf(user.id);
  return { line: daily(user, s, d), run: { days: s.run.days, rest: s.run.rest, todayHit: s.run.todayHit, week: weekStrip(s.run, s.key) }, level: level(s), monday: mondayCard(user, s, d) };
}

// ---------- the morning pulse ----------

// Yesterday in a few lines, plus the one move for today, for anything that posts it where the member already is (the
// Monday email, Hub's Slack and Teams app). Text only, the member's own numbers, never sent to AI. Money lines come only
// from `money(user, day)` when the caller passes one (Harness reads Stripe, Shopify and ads connections read-only) and
// are shown as the member's own figures, never a forecast. Skipped (null) when nothing happened and there's no move.
// Sending it anywhere outside HQ waits on Legal N3 (opt-in, unsubscribe).
// pulse(user, { money }) -> Promise<null | { day, lines: [{ id, label, value, text }], nextStep: { text, href } | null }>
async function pulse(user, { money = null, posted = null } = {}) {
  const s = summary(user);
  const d = docOf(user.id);
  const y = today.addDays(s.key, -1);
  const a = s.byDay[y];
  const lines = [];
  const add = (id, label, value, text) => lines.push({ id, label, value, text });
  if (sends(a)) add('sent', 'Sent', sends(a), `${plural(sends(a), 'message', 'messages')} sent${a.total >= s.target ? ', your number hit' : ''}.`);
  // posted (Hub's composer): (user, day) => ({ out, waiting }). Its count wins over what the member logged by hand,
  // since a post made in the composer is the real one; no answer falls back to the logged count.
  let out = posts(a);
  let waiting = 0;
  if (typeof posted === 'function') {
    try {
      const p = (await posted(user, y)) || {};
      if (Number.isFinite(Number(p.out)) && p.out !== null) out = Math.max(0, Math.round(Number(p.out)));
      waiting = Number.isFinite(Number(p.waiting)) ? Math.max(0, Math.round(Number(p.waiting))) : 0;
    } catch {
      /* keep the logged count */
    }
  }
  if (out || waiting) add('posts', 'Posts', out, `${out ? `${plural(out, 'post', 'posts')} out` : 'No posts out'}${waiting ? `, ${waiting} waiting to go` : ''}.`);
  const map = { replied: 'replies', call: 'calls', won: 'yeses' };
  const got = { replies: 0, calls: 0, yeses: 0 };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) for (const h of l.history || []) if (map[h.stage] && today.dayKey(Date.parse(h.at)) === y) got[map[h.stage]] += 1;
  if (got.replies) add('replies', 'Replies', got.replies, `${plural(got.replies, 'reply', 'replies')} came in.`);
  if (got.calls) add('calls', 'Calls booked', got.calls, `${plural(got.calls, 'call', 'calls')} booked.`);
  if (got.yeses) add('yeses', 'Yeses', got.yeses, `${plural(got.yeses, 'yes', 'yeses')}.`);
  if (typeof money === 'function') {
    try {
      const m = (await money(user, y)) || {};
      const usd = (n) => `$${Math.round(Number(n)).toLocaleString('en-US')}`;
      if (Number.isFinite(Number(m.sales)) && m.sales !== null) add('sales', 'Sales', Number(m.sales), `${usd(m.sales)} in sales${m.salesFrom ? ` (${m.salesFrom})` : ''}.`);
      if (Number.isFinite(Number(m.adSpend)) && m.adSpend !== null) add('adSpend', 'Ad spend', Number(m.adSpend), `${usd(m.adSpend)} spent on ads${m.adsFrom ? ` (${m.adsFrom})` : ''}.`);
    } catch {
      /* a connection that doesn't answer leaves its line out */
    }
  }
  if (s.run.days) add('run', 'Run', s.run.days, `${plural(s.run.days, 'day', 'days')} running${s.run.rest ? `, ${plural(s.run.rest, 'rest day', 'rest days')} held` : ''}.`);
  const line = daily(user, s, d);
  const nextStep = line ? { text: line.say, href: line.href } : null;
  if (!lines.some((l) => l.id !== 'run') && !nextStep) return null;
  return { day: y, label: label(y), lines, nextStep };
}

async function forget(memberId) {
  if (deps.db.get(COL, memberId)) await deps.db.remove(COL, memberId);
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = {
  KINDS, LEVELS, MARKS, PLATFORMS, RIVAL_SOURCES, COUNT_CHOICES, MAX_RIVALS,
  prefs, setPrefs, addRival, removeRival, countRival, cleanHandle,
  summary, runOf, weekStrip, level, marks, sync, markSeen, candidates, daily, weekly, challenge, takeChallenge, mondayCard, closeMonday, dropClosed, closeDrop,
  shipLog, month, progress, forToday, pulse, forget, inQuiet, _setDeps,
};
