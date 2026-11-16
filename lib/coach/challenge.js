// Coach challenges (prototype). Two layers, on purpose:
//
// 1. The challenge itself, a daily-rules checklist any coach can configure (the 50-day "every rule, every day"
//    format): a name, a length in days, a list of daily rules, each optionally needing proof (a photo or a note),
//    and a mode:
//      restart  miss any rule on any day and you go back to day 1 (the hard-mode original), or
//      points   every rule ticked earns points, a full day earns a bonus, nothing resets.
//    A client starts it on their own (free, or at the challenge's price) and sees: the checklist with a completion
//    ring, day X of N, their streak, a calendar of the days done, a share card and a journal export.
//
// 2. The cohort layer, optional per challenge (the founders'-circle style): an application with the coach's
//    questions, coach approval, a capped number of seats, its own price and a fixed start date, and a leaderboard
//    for the cohort.
//
// Adapted from lib/challenge.js (127's own Day One Challenge): there the days, check-in fields and finish rule come
// from content files and one challenge runs for everyone; here each coach has their own, stored as documents.
// Levels on the leaderboard reuse lib/gamify.js's level names from points.
//
// Money: nothing real moves in the prototype. A paid join records a demo payment with 127's fee and the coach's
// share (lib/coach split(), the same shape as the marketplace's). Production: a Stripe Connect destination charge
// on the coach's Express account with application_fee_amount, exactly as lib/market.js checkoutUrl() does.
//
//   coachChallenges        a coach's challenges
//   coachChallengeEntries  one per person per challenge: track (open|cohort), status, answers, startedOn, days{}

const crypto = require('crypto');
const db = require('../db');
const coachLib = require('./index');
const gamify = require('../gamify');

const CHALLENGES = 'coachChallenges';
const ENTRIES = 'coachChallengeEntries';
const PROOF = ['none', 'photo', 'note'];
const { text, block, num, list, dateKey, addDays, daysBetween, shortDate } = coachLib;

// A sensible default to start from: the 7-rule, 50-day format. Coaches rename, add, remove and reorder.
const TEMPLATE_RULES = [
  { label: 'Wake up before 8am', proof: 'none' },
  { label: '1 hour morning routine, no phone', proof: 'none' },
  { label: '1 hour of exercise', proof: 'photo' },
  { label: 'Read 10 pages', proof: 'note' },
  { label: '1 hour on a new skill', proof: 'none' },
  { label: 'Clean eating: no alcohol or soda, drink your water', proof: 'none' },
  { label: 'Write in your journal', proof: 'none' },
];

const ruleId = () => crypto.randomBytes(4).toString('hex');

function cleanRules(raw, existing = []) {
  return list(raw).map((r) => ({
    id: (r && /^[a-f0-9]{8}$/.test(String(r.id || '')) && existing.some((e) => e.id === r.id)) ? r.id : ruleId(),
    label: text(r && r.label, 90),
    proof: PROOF.includes(r && r.proof) ? r.proof : 'none',
  })).filter((r) => r.label).slice(0, 12);
}

const challengesOf = (coach) => db.filter(CHALLENGES, (c) => c.coachId === coach.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
const get = (id) => db.get(CHALLENGES, String(id || ''));
const mine = (coach, id) => {
  const c = get(id);
  return c && c.coachId === coach.id ? c : null;
};
const forSlug = (coach, slug) => db.find(CHALLENGES, (c) => c.coachId === coach.id && c.slug === String(slug || ''));
const live = (coach) => challengesOf(coach).filter((c) => c.status === 'live');

async function save(coach, id, body) {
  const existing = id ? mine(coach, id) : null;
  if (id && !existing) return { error: 'Challenge not found.' };
  const name = text(body.name, 80);
  if (name.length < 3) return { error: 'Name the challenge.' };
  const days = num(body.days, 3, 365);
  if (!days) return { error: 'Set a length between 3 and 365 days.' };
  const rules = cleanRules(body.rules, existing ? existing.rules : []);
  if (!rules.length) return { error: 'Add at least one daily rule.' };
  const mode = body.mode === 'points' ? 'points' : 'restart';
  const cohortOn = body.cohortOn === 'on';
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.cohortStart || '')) ? String(body.cohortStart) : null;
  if (cohortOn && !startDate) return { error: 'Set the cohort start date.' };
  const questions = block(body.questions, 1200).split('\n').map((q) => text(q, 160)).filter(Boolean).slice(0, 6);
  const slug = (existing && existing.slug) || `${coachLib.slugify(name).slice(0, 30)}-${crypto.randomBytes(2).toString('hex')}`;
  const c = await db.save(CHALLENGES, {
    ...(existing || { coachId: coach.id, status: 'live' }),
    slug, name,
    tagline: text(body.tagline, 140),
    days, rules, mode,
    pointsPerRule: num(body.pointsPerRule, 1, 100) || 10,
    fullDayBonus: num(body.fullDayBonus, 0, 500) != null ? num(body.fullDayBonus, 0, 500) : 20,
    price: num(body.price, 0, 5000) || 0,
    cohort: {
      on: cohortOn,
      name: text(body.cohortName, 60) || 'The Founding Cohort',
      startDate,
      capacity: num(body.capacity, 1, 10000) || 25,
      price: num(body.cohortPrice, 0, 20000) || 0,
      questions: questions.length ? questions : ['Why do you want in?', 'What will you have changed by the end?'],
      perks: block(body.perks, 600).split('\n').map((p) => text(p, 90)).filter(Boolean).slice(0, 6),
    },
  });
  return { challenge: c };
}

async function setStatus(coach, id, status) {
  const c = mine(coach, id);
  if (!c || !['live', 'closed'].includes(status)) return { error: 'Challenge not found.' };
  c.status = status;
  return { challenge: await db.save(CHALLENGES, c) };
}

// ---- entries ---------------------------------------------------------------------------------------------------
const entriesOf = (ch) => db.filter(ENTRIES, (e) => e.challengeId === ch.id);
const entryFor = (ch, user) => (user ? db.find(ENTRIES, (e) => e.challengeId === ch.id && e.userId === user.id) : null);
const entry = (id) => db.get(ENTRIES, String(id || ''));
const SEATED = ['approved', 'active', 'finished'];
const seatsTaken = (ch) => entriesOf(ch).filter((e) => e.track === 'cohort' && SEATED.includes(e.status)).length;
const seatsLeft = (ch) => Math.max(0, ch.cohort.capacity - seatsTaken(ch));
const applications = (ch) => entriesOf(ch).filter((e) => e.track === 'cohort' && e.status === 'applied').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

// Stub checkout: records what a Connect destination charge would (see the top of this file). Never calls Stripe.
function demoPayment(price) {
  return price > 0 ? { demo: true, ...coachLib.split(price), at: new Date(coachLib.now()).toISOString() } : null;
}

// Start the open challenge today. One entry per person per challenge.
async function start(ch, user) {
  if (ch.status !== 'live') return { error: 'This challenge is closed.' };
  const existing = entryFor(ch, user);
  if (existing) return { entry: existing };
  const e = await db.save(ENTRIES, { challengeId: ch.id, coachId: ch.coachId, userId: user.id, name: user.name || 'Member', track: 'open', status: 'active', startedOn: dateKey(), days: {}, payment: demoPayment(ch.price) });
  return { entry: e };
}

async function apply(ch, user, body) {
  if (!ch.cohort.on || ch.status !== 'live') return { error: 'Applications are closed.' };
  const existing = entryFor(ch, user);
  if (existing && existing.track === 'cohort') return { entry: existing };
  const answers = ch.cohort.questions.map((q, i) => ({ q, a: block(body[`q${i}`], 1000) }));
  if (answers.some((x) => x.a.length < 2)) return { error: 'Answer every question.' };
  const base = existing || { challengeId: ch.id, coachId: ch.coachId, userId: user.id, days: {} };
  const e = await db.save(ENTRIES, { ...base, name: user.name || 'Member', track: 'cohort', status: 'applied', answers, appliedAt: new Date(coachLib.now()).toISOString() });
  return { entry: e };
}

// Coach decision. Approve holds a seat (capped); the applicant then confirms (and pays, demo) to go active.
async function decide(coach, entryId, action) {
  const e = entry(entryId);
  const ch = e && mine(coach, e.challengeId);
  if (!ch || e.track !== 'cohort' || e.status !== 'applied') return { error: 'Application not found.' };
  if (action === 'approve') {
    if (seatsLeft(ch) <= 0) return { error: 'The cohort is full.' };
    e.status = 'approved';
    e.approvedAt = new Date(coachLib.now()).toISOString();
  } else {
    e.status = 'declined';
  }
  return { entry: await db.save(ENTRIES, e) };
}

async function confirmSeat(ch, user) {
  const e = entryFor(ch, user);
  if (!e || e.track !== 'cohort' || e.status !== 'approved') return { error: 'There is no seat waiting for you.' };
  e.status = 'active';
  e.payment = demoPayment(ch.cohort.price);
  const today = dateKey();
  e.startedOn = ch.cohort.startDate > today ? ch.cohort.startDate : today;
  e.days = e.days || {};
  return { entry: await db.save(ENTRIES, e) };
}

// ---- the daily checklist ----------------------------------------------------------------------------------------
function ruleDone(ch, d, r) {
  if (!d || !d.done || !d.done[r.id]) return false;
  if (r.proof === 'none') return true;
  const p = d.proof && d.proof[r.id];
  return r.proof === 'photo' ? !!(p && p.photo) : !!(p && p.note && p.note.length >= 3);
}
const dayDone = (ch, d) => ch.rules.every((r) => ruleDone(ch, d, r));
const doneCount = (ch, d) => ch.rules.filter((r) => ruleDone(ch, d, r)).length;

// Tick today's rules. body: r_<ruleId>=on, note_<ruleId>, photo_<ruleId> (a blob id the person owns), journal.
async function checkIn(ch, e, user, body, key = dateKey()) {
  if (e.status !== 'active') return { error: 'This challenge isn’t active for you.' };
  if (key < e.startedOn) return { error: `Your challenge starts ${shortDate(e.startedOn)}.` };
  const s = state(ch, e, key);
  if (s.finished) return { error: 'You finished. Nice work.' };
  const prev = e.days[key] || { done: {}, proof: {} };
  const d = { done: {}, proof: {}, journal: block(body.journal, 4000), at: new Date(coachLib.now()).toISOString() };
  for (const r of ch.rules) {
    if (body[`r_${r.id}`] === 'on') d.done[r.id] = true;
    const note = block(body[`note_${r.id}`], 600);
    const photo = String(body[`photo_${r.id}`] || '') || (prev.proof[r.id] && prev.proof[r.id].photo) || null;
    const okPhoto = photo && user.coachPhotos && user.coachPhotos[photo] ? photo : null;
    if (note || okPhoto) d.proof[r.id] = { note: note || null, photo: okPhoto };
  }
  e.days = { ...e.days, [key]: d };
  await db.save(ENTRIES, e);
  return { entry: e, day: d };
}

// Everything the daily view, the calendar, the share card and the leaderboard need, worked out from the days kept.
function state(ch, e, key = dateKey()) {
  const days = e.days || {};
  const ppr = ch.pointsPerRule || 10;
  const bonus = ch.fullDayBonus || 0;
  let points = 0;
  for (const [k, d] of Object.entries(days)) {
    if (k > key) continue;
    points += doneCount(ch, d) * ppr + (dayDone(ch, d) ? bonus : 0);
  }
  const started = !!e.startedOn && e.startedOn <= key;
  const base = { points, level: gamify.level(points).name, started, startsOn: e.startedOn, attempts: [], restarts: 0 };
  if (!started) return { ...base, dayNumber: 0, of: ch.days, streak: 0, best: 0, finished: false, todayDone: 0, todayComplete: false, attemptStart: e.startedOn, calendar: [] };

  let attemptStart = e.startedOn;
  let finished = false;
  let finishedOn = null;
  if (ch.mode === 'restart') {
    // Walk every past day: a day with a rule missed ends the attempt; the next day is day 1 again.
    for (let k = e.startedOn; k < key; k = addDays(k, 1)) {
      if (!dayDone(ch, days[k])) {
        base.attempts.push({ start: attemptStart, missed: k, reached: daysBetween(attemptStart, k) });
        attemptStart = addDays(k, 1);
      } else if (daysBetween(attemptStart, k) + 1 >= ch.days) {
        finished = true;
        finishedOn = k;
        break;
      }
    }
  } else if (daysBetween(e.startedOn, key) >= ch.days) {
    finished = true;
    finishedOn = addDays(e.startedOn, ch.days - 1);
  }
  base.restarts = base.attempts.length;
  const today = finished ? finishedOn : key;
  const todayD = days[today];
  const todayComplete = dayDone(ch, todayD);
  if (!finished && ch.mode === 'restart' && todayComplete && daysBetween(attemptStart, today) + 1 >= ch.days) {
    finished = true;
    finishedOn = today;
  }
  const dayNumber = Math.min(ch.days, daysBetween(attemptStart, today) + 1);

  // Streak: full days in a row up to today (today counts once it's complete).
  let streak = 0;
  for (let k = todayComplete ? today : addDays(today, -1); k >= e.startedOn && dayDone(ch, days[k]); k = addDays(k, -1)) streak += 1;
  let best = 0, run = 0;
  for (let k = e.startedOn; k <= today; k = addDays(k, 1)) {
    run = dayDone(ch, days[k]) ? run + 1 : 0;
    best = Math.max(best, run);
  }

  // The calendar: every day of this attempt, plus the days of earlier attempts (marked as such).
  const calendar = [];
  const calStart = e.startedOn;
  const calEnd = addDays(attemptStart, ch.days - 1);
  for (let k = calStart; k <= calEnd && calendar.length < 400; k = addDays(k, 1)) {
    const d = days[k];
    const done = dayDone(ch, d);
    const st = k > key ? 'future' : done ? 'done' : k === key ? (d ? 'partial' : 'today') : 'missed';
    calendar.push({ date: k, label: shortDate(k), state: st, day: k >= attemptStart ? daysBetween(attemptStart, k) + 1 : null, earlier: k < attemptStart });
  }
  return {
    ...base, dayNumber, of: ch.days, attemptStart, finished, finishedOn, streak, best,
    todayKey: today, todayDone: doneCount(ch, todayD), todayComplete,
    pct: Math.round((dayNumber - (todayComplete ? 0 : 1)) / ch.days * 100),
    calendar,
  };
}

// Leaderboard (the cohort layer, or every active entry when a challenge has no cohort). Restart mode ranks by how far
// into the current run someone is, then points; points mode by points. Finishers first either way.
function leaderboard(ch, key = dateKey(), { track } = {}) {
  const t = track || (ch.cohort.on ? 'cohort' : null);
  return entriesOf(ch)
    .filter((e) => ['active', 'finished'].includes(e.status) && (!t || e.track === t))
    .map((e) => ({ entry: e, s: state(ch, e, key) }))
    .filter((x) => x.s.started)
    .sort((a, b) => (b.s.finished - a.s.finished) || (ch.mode === 'restart' ? b.s.dayNumber - a.s.dayNumber : 0) || b.s.points - a.s.points || b.s.streak - a.s.streak)
    .map((x, i) => ({ rank: i + 1, id: x.entry.id, userId: x.entry.userId, name: firstNameLast(x.entry.name), ...x.s }));
}
// "Maya R." on a shared board: first name and last initial only.
function firstNameLast(name) {
  const p = text(name, 60).split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || 'Member';
}

// The share card: an SVG in the coach's colors. No names unless the person adds theirs.
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shareCard(ch, coach, s, { name } = {}) {
  const a = coach.brand.accent;
  const pct = Math.max(0, Math.min(1, (s.finished ? ch.days : s.dayNumber) / ch.days));
  const R = 200, C = 2 * Math.PI * R;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<rect width="1080" height="1080" fill="#0b0b0e"/>
<rect x="40" y="40" width="1000" height="1000" rx="48" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-width="3"/>
<text x="540" y="170" fill="#ededf2" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" letter-spacing="6">${esc(ch.name.toUpperCase())}</text>
<text x="540" y="225" fill="#8b8b96" font-family="Helvetica, Arial, sans-serif" font-size="28" text-anchor="middle">${esc(coach.brand.name)}</text>
<circle cx="540" cy="540" r="${R}" fill="none" stroke="#1b1b20" stroke-width="28"/>
<circle cx="540" cy="540" r="${R}" fill="none" stroke="${a}" stroke-width="28" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 540 540)"/>
<text x="540" y="530" fill="#ededf2" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="800" text-anchor="middle">${s.finished ? ch.days : s.dayNumber}</text>
<text x="540" y="595" fill="#b3b3bd" font-family="Helvetica, Arial, sans-serif" font-size="36" text-anchor="middle">${s.finished ? 'DAYS. DONE.' : `DAY ${s.dayNumber} OF ${ch.days}`}</text>
<text x="300" y="900" fill="${a}" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="800" text-anchor="middle">${s.streak}</text>
<text x="300" y="945" fill="#8b8b96" font-family="Helvetica, Arial, sans-serif" font-size="26" text-anchor="middle" letter-spacing="3">DAY STREAK</text>
<text x="780" y="900" fill="${a}" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="800" text-anchor="middle">${s.points}</text>
<text x="780" y="945" fill="#8b8b96" font-family="Helvetica, Arial, sans-serif" font-size="26" text-anchor="middle" letter-spacing="3">POINTS</text>
${name ? `<text x="540" y="1000" fill="#8b8b96" font-family="Helvetica, Arial, sans-serif" font-size="26" text-anchor="middle">${esc(name)}</text>` : ''}
</svg>`;
}

// The journal export: every day kept, oldest first, as Markdown the person owns.
function journal(ch, coach, e, name) {
  const s = state(ch, e);
  const lines = [`# ${ch.name} journal`, '', `${coach.brand.name} · ${name || ''}`.trim(), `Started ${e.startedOn} · ${s.finished ? `finished ${s.finishedOn}` : `day ${s.dayNumber} of ${ch.days}`} · best streak ${s.best} · ${s.points} points`, ''];
  for (const k of Object.keys(e.days || {}).sort()) {
    const d = e.days[k];
    lines.push(`## ${k}: ${doneCount(ch, d)}/${ch.rules.length} rules${dayDone(ch, d) ? ' ✓' : ''}`, '');
    for (const r of ch.rules) {
      const p = d.proof && d.proof[r.id];
      lines.push(`- [${ruleDone(ch, d, r) ? 'x' : ' '}] ${r.label}${p && p.note ? `: ${p.note}` : ''}${p && p.photo ? ' (photo)' : ''}`);
    }
    if (d.journal) lines.push('', d.journal);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  CHALLENGES, ENTRIES, PROOF, TEMPLATE_RULES,
  cleanRules, challengesOf, get, mine, forSlug, live, save, setStatus,
  entriesOf, entryFor, entry, seatsTaken, seatsLeft, applications, start, apply, decide, confirmSeat,
  ruleDone, dayDone, doneCount, checkIn, state, leaderboard, firstNameLast, shareCard, journal,
};
