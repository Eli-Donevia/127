// Coach platform (prototype), behind COACH_PLATFORM (default off): 127 for online fitness coaches.
//
//   coaches          one per coach, doc id = the coach's user id: slug, brand (name, initials, accent, logo), niche,
//                    offer, habits their clients tick each day, the invite token, open signups on/off.
//   users            existing collection. A client is a normal 127 account with role 'client' and coachId set;
//                    a coach is a normal account with role 'coach'. Same session, password and login as everyone.
//   coachPrograms    a coach's programs: weeks -> days -> exercises (name, sets, reps, rest, note).
//   coachAssignments one per client, doc id = client id: which program, the start date and training weekdays.
//   coachWorkoutLogs one per client and date, doc id = `${clientId}_${date}`: sets logged against the program day.
//   coachHabitLogs   one per client and date: the coach's daily habits ticked.
//   coachCheckins    weekly check-ins: weight, energy, adherence, notes, photo blob ids; reviewed by the coach.
//   (challenges: lib/coach/challenge.js)
//
// Prototype limits, on purpose: everything is in the document store (lib/db.js) like the rest of 127; high-volume
// collections (logs, check-ins, challenge days) belong in real Postgres tables before launch (PROTOTYPE.md).
// Health data (weight, photos, food) needs Legal's consent wording before any real client uses it.

const crypto = require('crypto');
const db = require('../db');
const flags = require('../harness/flags');
const { NICHES } = require('../packs/site/lib/niches');

const COACHES = 'coaches';
const PROGRAMS = 'coachPrograms';
const ASSIGN = 'coachAssignments';
const WLOGS = 'coachWorkoutLogs';
const HLOGS = 'coachHabitLogs';
const CHECKINS = 'coachCheckins';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['admin', 'app', 'coach', 'join', 'api', 'login', 'new', 'edit', '127', 'eli', 'support', 'help', 'official']);
const COLOR = /^#[0-9a-f]{6}$/i;
const NICHE_IDS = ['strength', 'fat-loss', 'hybrid', 'bodybuilding', 'mobility', 'endurance', 'lifestyle'];
const NICHE_NAMES = { strength: 'Strength', 'fat-loss': 'Fat loss', hybrid: 'Hybrid athlete', bodybuilding: 'Bodybuilding', mobility: 'Mobility & pain-free', endurance: 'Endurance', lifestyle: 'Busy professionals' };
const DEFAULT_HABITS = ['Hit your protein target', '8,000+ steps', '3 litres of water', '7+ hours of sleep'];
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = () => process.env.COACH_TZ || 'America/Chicago';

let clock = () => Date.now();
const now = () => clock();

function setting() {
  const v = String(process.env.COACH_PLATFORM || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}
function visibleTo(user) {
  const v = setting();
  return v === 'on' || (v === 'admins' && flags.admin(user));
}

// ---- dates: YYYY-MM-DD in the coach platform's time zone -------------------------------------------------------
function dateKey(t = now()) {
  return new Date(t).toLocaleDateString('en-CA', { timeZone: TZ() });
}
function addDays(key, n) {
  const d = new Date(`${key}T12:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);
}
function weekday(key) {
  return new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat
}
function shortDate(key) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ---- cleaning ------------------------------------------------------------------------------------------------
const text = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const block = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const list = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : v != null && v !== '' ? [v] : []);

// ---- coaches ---------------------------------------------------------------------------------------------------
const coachFor = (user) => (user ? db.get(COACHES, user.id) : null);
const bySlug = (slug) => db.find(COACHES, (c) => c.slug === String(slug || '').toLowerCase());
const isCoach = (user) => !!coachFor(user);
const clientsOf = (coach) => db.filter('users', (u) => u.role === 'client' && u.coachId === coach.id).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const coachOfClient = (user) => (user && user.role === 'client' ? db.get(COACHES, user.coachId) : null);

function initialsOf(name) {
  return text(name, 60).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'C';
}
function slugify(v) {
  return String(v || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// The site builder's own wording for fitness and coaching (lib/packs/site/lib/niches.js), so a coach page reads like
// the sites 127 already builds: the button words, who it's for and the result.
function nicheCopy() {
  const fit = NICHES.find((n) => n.id === 'fitness') || {};
  const coaching = NICHES.find((n) => n.id === 'coaching') || {};
  return { people: 'clients', result: fit.result || 'workouts that fit your week', book: coaching.book || 'Book a call', corner: coaching.result || 'clear next steps and someone in your corner' };
}

// Sets up or edits a coach. Returns { coach } or { error }.
async function saveCoach(user, body) {
  const existing = coachFor(user);
  const name = text(body.brandName, 60);
  if (name.length < 2) return { error: 'Add the brand name your clients see.' };
  const slug = slugify(body.slug || name);
  if (!SLUG.test(slug) || RESERVED.has(slug)) return { error: 'Pick a web address of 3 to 40 letters, numbers or dashes.' };
  const taken = bySlug(slug);
  if (taken && taken.id !== user.id) return { error: 'That web address is taken.' };
  // One /c/ namespace with the live launch kits (lib/coach-routes.js): a kit's challenge link belongs to that coach.
  const kit = db.find('coachKits', (k) => k.slug === slug);
  if (kit && kit.userId !== user.id) return { error: 'That web address is taken.' };
  const accent = COLOR.test(String(body.accent || '')) ? String(body.accent).toLowerCase() : (existing && existing.brand.accent) || '#ff5a36';
  const niche = NICHE_IDS.includes(body.niche) ? body.niche : 'hybrid';
  const habits = block(body.habits, 600).split('\n').map((h) => text(h, 60)).filter(Boolean).slice(0, 8);
  const coach = await db.save(COACHES, {
    ...(existing || { id: user.id, inviteToken: crypto.randomBytes(9).toString('base64url'), createdAt: new Date(now()).toISOString() }),
    id: user.id,
    slug,
    brand: { name, initials: text(body.initials, 3).toUpperCase() || initialsOf(name), accent, logo: existing && existing.brand.logo ? existing.brand.logo : null, look: LOOKS.includes(body.look) ? body.look : (existing && existing.brand.look) || 'athletic', photo: existing && existing.brand.photo ? existing.brand.photo : null, photoType: existing && existing.brand.photoType ? existing.brand.photoType : null },
    coachName: text(body.coachName, 60) || user.name || name,
    niche,
    headline: text(body.headline, 120) || `${NICHE_NAMES[niche]} coaching that fits your week.`,
    bio: block(body.bio, 800),
    offer: {
      title: text(body.offerTitle, 80) || '1:1 Online Coaching',
      price: num(body.offerPrice, 0, 5000) != null ? num(body.offerPrice, 0, 5000) : 199,
      bullets: block(body.offerBullets, 600).split('\n').map((b) => text(b, 90)).filter(Boolean).slice(0, 6),
    },
    habits: habits.length ? habits : (existing && existing.habits) || DEFAULT_HABITS,
    openSignup: body.openSignup === 'on',
  });
  if (user.role !== 'coach' && user.role !== 'client') {
    user.role = 'coach';
    await db.save('users', user);
  }
  return { coach };
}

async function rotateInvite(coach) {
  coach.inviteToken = crypto.randomBytes(9).toString('base64url');
  return db.save(COACHES, coach);
}
function inviteOk(coach, token) {
  if (coach.openSignup) return true;
  const a = Buffer.from(String(token || '')), b = Buffer.from(String(coach.inviteToken || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

// ---- programs --------------------------------------------------------------------------------------------------
const programsOf = (coach) => db.filter(PROGRAMS, (p) => p.coachId === coach.id).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
const program = (coach, id) => {
  const p = db.get(PROGRAMS, String(id || ''));
  return p && p.coachId === coach.id ? p : null;
};

// The builder posts weeks[i][days][j][exercises][k][name|sets|reps|rest|note] (express urlencoded, extended).
function cleanWeeks(raw) {
  const weeks = list(raw).slice(0, 16).map((w, wi) => ({
    days: list(w && w.days).slice(0, 7).map((d, di) => ({
      title: text(d && d.title, 60) || `Day ${di + 1}`,
      exercises: list(d && d.exercises).slice(0, 15).map((e) => ({
        name: text(e && e.name, 80),
        sets: num(e && e.sets, 1, 20) || 3,
        reps: text(e && e.reps, 20) || '8-10',
        rest: text(e && e.rest, 20),
        note: text(e && e.note, 140),
      })).filter((e) => e.name),
    })).filter((d) => d.exercises.length),
    note: text(w && w.note, 140) || (wi === 0 ? '' : ''),
  })).filter((w) => w.days.length);
  return weeks;
}

async function saveProgram(coach, id, body) {
  const existing = id ? program(coach, id) : null;
  if (id && !existing) return { error: 'Program not found.' };
  const name = text(body.name, 80);
  if (name.length < 2) return { error: 'Name the program.' };
  const weeks = cleanWeeks(body.weeks);
  if (!weeks.length) return { error: 'Add at least one day with one exercise.' };
  const p = await db.save(PROGRAMS, { ...(existing || { coachId: coach.id }), name, goal: text(body.goal, 120), weeks });
  return { program: p };
}

const assignmentOf = (client) => (client ? db.get(ASSIGN, client.id) : null);
// trainingDays: weekdays (0 Sun..6 Sat) the program's days land on, in order. Default Mon/Tue/Thu/Fri style by count.
const DEFAULT_SPLITS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
async function assign(coach, client, programId, startDate) {
  const p = program(coach, programId);
  if (!p || client.coachId !== coach.id) return { error: 'Pick one of your programs and clients.' };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || '')) ? String(startDate) : dateKey();
  const perWeek = Math.max(...p.weeks.map((w) => w.days.length));
  const a = await db.save(ASSIGN, { id: client.id, coachId: coach.id, clientId: client.id, programId: p.id, start, trainingDays: DEFAULT_SPLITS[perWeek] || DEFAULT_SPLITS[4] });
  return { assignment: a };
}

// Today's session for a client: { program, weekIndex, dayIndex, day } or { rest: true } or null (no program).
function sessionOn(client, key = dateKey()) {
  const a = assignmentOf(client);
  if (!a) return null;
  const p = db.get(PROGRAMS, a.programId);
  if (!p) return null;
  const since = daysBetween(a.start, key);
  if (since < 0) return { program: p, upcoming: true, start: a.start };
  const weekIndex = Math.floor(since / 7) % p.weeks.length;
  const week = p.weeks[weekIndex];
  const slot = (a.trainingDays || []).indexOf(weekday(key));
  if (slot < 0 || slot >= week.days.length) return { program: p, weekIndex, rest: true };
  return { program: p, weekIndex, dayIndex: slot, day: week.days[slot] };
}
function scheduledBetween(client, from, to) {
  let n = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const s = sessionOn(client, k);
    if (s && s.day) n += 1;
  }
  return n;
}

// ---- logs --------------------------------------------------------------------------------------------------
const logId = (clientId, key) => `${clientId}_${key}`;
const workoutLog = (client, key = dateKey()) => db.get(WLOGS, logId(client.id, key));
const habitLog = (client, key = dateKey()) => db.get(HLOGS, logId(client.id, key));

// body.sets[exerciseIndex][setIndex][weight|reps|done]
async function logWorkout(client, body, key = dateKey()) {
  const s = sessionOn(client, key);
  if (!s || !s.day) return { error: 'No session on the plan today.' };
  const exercises = s.day.exercises.map((e, i) => {
    const sets = list(body.sets && body.sets[i]).slice(0, 20).map((st) => ({ weight: num(st && st.weight, 0, 2000), reps: num(st && st.reps, 0, 500), done: !!(st && st.done) }));
    return { name: e.name, sets };
  });
  const doneSets = exercises.reduce((a, e) => a + e.sets.filter((x) => x.done || x.reps).length, 0);
  const log = await db.save(WLOGS, { id: logId(client.id, key), clientId: client.id, coachId: client.coachId, date: key, programId: s.program.id, week: s.weekIndex, day: s.dayIndex, title: s.day.title, exercises, complete: body.complete === 'on' || doneSets > 0, note: text(body.note, 280) });
  return { log };
}

async function logHabits(client, coach, body, key = dateKey()) {
  const ticked = coach.habits.filter((h, i) => body[`h${i}`] === 'on');
  const log = await db.save(HLOGS, { id: logId(client.id, key), clientId: client.id, coachId: coach.id, date: key, done: ticked, of: coach.habits.length });
  return { log };
}

// ---- check-ins ---------------------------------------------------------------------------------------------
const checkinsOf = (client) => db.filter(CHECKINS, (c) => c.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
const checkin = (id) => db.get(CHECKINS, String(id || ''));
const queue = (coach) => db.filter(CHECKINS, (c) => c.coachId === coach.id && !c.reviewedAt).sort((a, b) => a.date.localeCompare(b.date));
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTO = 5 * 1024 * 1024;

// The bytes go to blobs (lib/db.js: data/blobs/ locally, Postgres blobs in production). Returns the blob id.
async function savePhoto(client, type, buf) {
  if (!PHOTO_TYPES[type]) return { error: 'Photos must be JPG, PNG or WebP.' };
  if (!buf || !buf.length || buf.length > MAX_PHOTO) return { error: 'Photos must be under 5 MB.' };
  const sig = buf.slice(0, 4).toString('hex');
  const okSig = (type === 'image/png' && sig === '89504e47') || (type === 'image/jpeg' && sig.startsWith('ffd8')) || (type === 'image/webp' && buf.slice(8, 12).toString() === 'WEBP');
  if (!okSig) return { error: "That file isn't the image it says it is." };
  const id = `coachphoto_${client.id}_${crypto.randomBytes(6).toString('hex')}`;
  await db.putBlob(id, buf);
  const owned = client.coachPhotos || {};
  owned[id] = type;
  client.coachPhotos = owned;
  await db.save('users', client);
  return { id };
}
// The coach's own portrait or logo for their app and site (public: it is on their site). One per coach; a new one
// replaces the old blob.
const LOOKS = ['athletic', 'editorial', 'bold'];
async function saveBrandPhoto(c, type, buf) {
  const out = checkImage(type, buf);
  if (out.error) return out;
  const id = `coachbrand_${c.id}_${crypto.randomBytes(6).toString('hex')}`;
  await db.putBlob(id, buf);
  const old = c.brand.photo;
  c.brand = { ...c.brand, photo: id, photoType: type };
  await db.save(COACHES, c);
  if (old) await Promise.resolve(db.removeBlob(old)).catch(() => {});
  return { id };
}
function checkImage(type, buf) {
  if (!PHOTO_TYPES[type]) return { error: 'Photos must be JPG, PNG or WebP.' };
  if (!buf || !buf.length || buf.length > MAX_PHOTO) return { error: 'Photos must be under 5 MB.' };
  const sig = buf.slice(0, 4).toString('hex');
  const okSig = (type === 'image/png' && sig === '89504e47') || (type === 'image/jpeg' && sig.startsWith('ffd8')) || (type === 'image/webp' && buf.slice(8, 12).toString() === 'WEBP');
  return okSig ? {} : { error: "That file isn't the image it says it is." };
}
function photoOwner(id) {
  return db.find('users', (u) => u.coachPhotos && u.coachPhotos[id]);
}

async function submitCheckin(client, body, key = dateKey()) {
  const weight = num(body.weight, 50, 800);
  if (weight == null) return { error: 'Add this week’s weight.' };
  const photos = list(body.photos).map(String).filter((p) => client.coachPhotos && client.coachPhotos[p]).slice(0, 4);
  const c = await db.save(CHECKINS, {
    clientId: client.id, coachId: client.coachId, date: key, weight,
    waist: num(body.waist, 10, 100),
    energy: num(body.energy, 1, 10), sleep: num(body.sleep, 1, 10), adherence: num(body.adherence, 0, 100),
    wins: block(body.wins, 600), struggles: block(body.struggles, 600), photos,
    reviewedAt: null, reply: null,
  });
  return { checkin: c };
}
async function review(coach, id, reply) {
  const c = checkin(id);
  if (!c || c.coachId !== coach.id) return { error: 'Check-in not found.' };
  c.reply = block(reply, 1200) || null;
  c.reviewedAt = new Date(now()).toISOString();
  await db.save(CHECKINS, c);
  return { checkin: c };
}

// ---- adherence and the dashboard ------------------------------------------------------------------------------
// Last 7 days: sessions done / scheduled, habits ticked / possible, combined into one number (0-100).
function adherence(client, coach, key = dateKey()) {
  const from = addDays(key, -6);
  const scheduled = scheduledBetween(client, from, key);
  let done = 0, ticks = 0, possible = 0;
  for (let k = from; k <= key; k = addDays(k, 1)) {
    const w = workoutLog(client, k);
    if (w && w.complete) done += 1;
    const h = habitLog(client, k);
    if (h) ticks += h.done.length;
    possible += coach.habits.length;
  }
  const train = scheduled ? Math.min(1, done / scheduled) : null;
  const habits = possible ? ticks / possible : null;
  const parts = [train, habits].filter((x) => x != null);
  return { scheduled, done, ticks, possible, pct: parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null };
}
function clientRow(client, coach, key = dateKey()) {
  const cis = checkinsOf(client);
  const last = cis[0] || null;
  const a = assignmentOf(client);
  const p = a ? db.get(PROGRAMS, a.programId) : null;
  const ad = adherence(client, coach, key);
  const first = cis[cis.length - 1];
  return {
    id: client.id, name: client.name || client.email, email: client.email, joined: client.createdAt,
    program: p ? p.name : null, adherence: ad,
    lastCheckin: last ? last.date : null, daysSinceCheckin: last ? daysBetween(last.date, key) : null,
    weight: last ? last.weight : null, change: last && first && cis.length > 1 ? Math.round((last.weight - first.weight) * 10) / 10 : null,
    waiting: cis.filter((c) => !c.reviewedAt).length,
    flag: ad.pct != null && ad.pct < 50 ? 'low' : !last || daysBetween(last.date, key) > 8 ? 'late' : null,
  };
}
function feePct() {
  const n = Number(process.env.COACH_FEE_PCT);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : 10;
}
// 127's platform fee and the coach's share, in cents (the same shape as lib/market.js split()).
function split(priceDollars) {
  const cents = Math.round(Number(priceDollars || 0) * 100);
  const fee = Math.round((cents * feePct()) / 100);
  return { cents, fee, net: cents - fee, pct: feePct() };
}
// Revenue: challenge entries paid (demo or real) plus a placeholder MRR from active clients x the coach's offer price.
function revenue(coach) {
  const entries = db.filter('coachChallengeEntries', (e) => e.coachId === coach.id && e.payment);
  const challenge = entries.reduce((a, e) => ({ cents: a.cents + e.payment.cents, fee: a.fee + e.payment.fee, net: a.net + e.payment.net }), { cents: 0, fee: 0, net: 0 });
  const clients = clientsOf(coach).length;
  return { challenge, sales: entries.length, mrrPlaceholder: clients * (coach.offer.price || 0), clients, demo: entries.some((e) => e.payment.demo) || !entries.length };
}
function dashboard(coach, key = dateKey()) {
  const rows = clientsOf(coach).map((c) => clientRow(c, coach, key));
  const withPct = rows.filter((r) => r.adherence.pct != null);
  return {
    rows,
    queue: queue(coach),
    revenue: revenue(coach),
    avgAdherence: withPct.length ? Math.round(withPct.reduce((a, r) => a + r.adherence.pct, 0) / withPct.length) : null,
    checkinsThisWeek: db.filter(CHECKINS, (c) => c.coachId === coach.id && daysBetween(c.date, key) < 7).length,
  };
}

// Weight series for the progress chart: [{ date, weight }] oldest first.
function weightSeries(client) {
  return checkinsOf(client).slice().reverse().map((c) => ({ date: c.date, weight: c.weight }));
}
// A tiny inline SVG line chart (no scripts, CSP-safe).
function sparkSvg(points, { w = 320, h = 120, color = '#3ee6a0' } = {}) {
  if (points.length < 2) return '';
  const ys = points.map((p) => p.weight);
  const min = Math.min(...ys) - 1, max = Math.max(...ys) + 1;
  const xy = points.map((p, i) => [Math.round((i / (points.length - 1)) * (w - 16) + 8), Math.round(h - 12 - ((p.weight - min) / (max - min)) * (h - 24))]);
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const dots = xy.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color}"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Weight trend"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}

// Exercise names from Life's library (public/life/exercises.json) for the builder's suggestions.
let exNames = null;
function exerciseNames() {
  if (!exNames) {
    try {
      exNames = require('../../public/life/exercises.json').exercises.filter((e) => e.category === 'strength' || e.category === 'cardio').map((e) => e.name).slice(0, 600);
    } catch {
      exNames = [];
    }
  }
  return exNames;
}

// Account deletion (server.js): a client's logs, check-ins, challenge entries and photos; a coach's site, programs,
// assignments and challenges (with every entry in them). Client accounts under a deleted coach stay their own.
async function deleteFor(user) {
  const mine = (col, f) => db.filter(col, f).map((d) => d.id);
  const ids = {
    [WLOGS]: mine(WLOGS, (d) => d.clientId === user.id),
    [HLOGS]: mine(HLOGS, (d) => d.clientId === user.id),
    [CHECKINS]: mine(CHECKINS, (d) => d.clientId === user.id),
    [ASSIGN]: mine(ASSIGN, (d) => d.clientId === user.id || d.coachId === user.id),
    [PROGRAMS]: mine(PROGRAMS, (d) => d.coachId === user.id),
    coachChallenges: mine('coachChallenges', (d) => d.coachId === user.id),
    coachChallengeEntries: mine('coachChallengeEntries', (d) => d.userId === user.id || d.coachId === user.id),
  };
  for (const [col, list] of Object.entries(ids)) for (const id of list) await db.remove(col, id);
  for (const blobId of Object.keys(user.coachPhotos || {})) await db.removeBlob(blobId).catch(() => {});
  const own = db.get(COACHES, user.id);
  if (own && own.brand && own.brand.photo) await db.removeBlob(own.brand.photo).catch(() => {});
  if (own) await db.remove(COACHES, user.id);
}

module.exports = {
  deleteFor,
  COACHES, PROGRAMS, ASSIGN, WLOGS, HLOGS, CHECKINS, NICHE_IDS, NICHE_NAMES, DEFAULT_HABITS, PHOTO_TYPES, MAX_PHOTO,
  setting, visibleTo, now, dateKey, addDays, daysBetween, weekday, shortDate, text, block, num, list,
  coachFor, bySlug, isCoach, clientsOf, coachOfClient, initialsOf, slugify, nicheCopy, saveCoach, rotateInvite, inviteOk,
  programsOf, program, cleanWeeks, saveProgram, assignmentOf, assign, sessionOn, scheduledBetween,
  workoutLog, habitLog, logWorkout, logHabits,
  checkinsOf, checkin, queue, savePhoto, saveBrandPhoto, LOOKS, photoOwner, submitCheckin, review,
  adherence, clientRow, split, feePct, revenue, dashboard, weightSeries, sparkSvg, exerciseNames,
  _setNow(fn) { clock = fn || (() => Date.now()); },
};
