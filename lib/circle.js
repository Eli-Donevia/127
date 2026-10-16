// Founder's Circle: applications, seat offers, the waiting line, membership (seat numbers,
// Founding Seats, alumni), the call schedule, Scorecards, recaps and the Klaviyo properties.
// Specs: the Founder's Circle experience team's circle/handoffs/website.md and circle/run/*.
//
// Rules this file enforces
// - Decisions: Approve, Fit call, Not yet, Decline. Each sends its email (lib/circle-emails.js).
// - An approved applicant with a seat open gets a 72-hour claim window (an "offer"), reminded
//   24 hours before it ends. Unclaimed, it passes to the next approved applicant in line.
// - Approved applicants wait in approval order when the table is full. Approvals last 6 months.
// - Former members who left in good standing in the last 6 months skip the application.
// - Seats in use = members + 30-minute checkout holds + live offers (server.js circleSeatsLeft).
//
// Application status values stored in the db: pending, fit_call, not_yet, declined, approved,
// left (was a member), lapsed (approval older than 6 months). Records written before this
// file existed are migrated when read (normalizeApplication); nothing is rewritten in bulk.
//
// Every function takes a ctx ({ store, now, send, ... }) so tests can run without the db file,
// email or the network. ctx() builds the real one.

const emails = require('./circle-emails');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CLAIM_HOURS = 72;
const REMIND_BEFORE_END_HOURS = 24;
const APPROVAL_MONTHS = 6;
const RETURN_MONTHS = 6;
const FOUNDING_SEATS = 4;
const FIT_CALLS_PER_WEEK = 4;
const HANDBOOK_PATH = '/app/circle/handbook';
const TZ = 'America/New_York';
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ---------- context ----------

function capacity(env = process.env) {
  return parseInt(env.CIRCLE_CAPACITY || '4', 10);
}
function baseUrl(env = process.env) {
  return env.BASE_URL || 'https://127group.io';
}
function adminEmail(env = process.env) {
  return (env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)[0] || null;
}

function ctx(o = {}) {
  return {
    store: o.store || require('./db'),
    now: o.now != null ? o.now : Date.now(),
    capacity: o.capacity != null ? o.capacity : capacity(),
    base: o.base || baseUrl(),
    env: o.env || process.env,
    admin: o.admin !== undefined ? o.admin : adminEmail(),
    notify: o.notify !== undefined ? o.notify : true,
    // integrations is required lazily: it may require this file for circleProfile().
    send: o.send || ((m) => require('./integrations').sendEmail(m)),
    emit: o.emit || ((type, payload) => require('./integrations').emit(type, payload)),
    post: o.post || postToDiscord,
  };
}

function ms(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
function iso(t) {
  return new Date(t).toISOString();
}
function addMonths(t, n) {
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}
function firstName(name, fallback = 'A member') {
  return String(name || '').trim().split(/\s+/)[0] || fallback;
}
function seatLabel(n) {
  return emails.seat(n);
}
async function save(c, collection, doc) {
  try {
    await c.store.save(collection, doc);
  } catch (err) {
    console.warn('[circle] save failed', collection, err.message);
  }
}
function mail(c, to, msg) {
  if (!to) return;
  try {
    const r = c.send({ to, ...msg });
    if (r && r.catch) r.catch((e) => console.warn('[circle] email failed', e.message));
  } catch (err) {
    console.warn('[circle] email failed', err.message);
  }
}
function event(c, type, payload) {
  try {
    const r = c.emit(type, payload);
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* analytics only */
  }
}

// ---------- Eastern time ----------

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
function etParts(t) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WEEKDAYS.indexOf(p.weekday.toLowerCase()) };
}
// Wall-clock time in New York -> epoch ms (handles daylight saving).
function etTime(y, m, d, h = 0, min = 0) {
  const want = Date.UTC(y, m - 1, d, h, min);
  let guess = want + 5 * HOUR;
  for (let i = 0; i < 3; i++) {
    const p = etParts(guess);
    const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    if (!diff) break;
    guess += diff;
  }
  return guess;
}
function pad(n) {
  return String(n).padStart(2, '0');
}
function etKey(t) {
  const p = etParts(t);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
function keyParts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}
function fmt(t, opts) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(new Date(t));
}
function fmtClock(t) {
  const p = etParts(t);
  const h12 = p.h % 12 || 12;
  return `${h12}${p.min ? ':' + pad(p.min) : ''}${p.h < 12 ? 'am' : 'pm'}`;
}
// "Thu Dec 10"
function fmtShort(t) {
  return fmt(t, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}
// "Fri 8pm ET"
function fmtDayTime(t) {
  return `${fmt(t, { weekday: 'short' })} ${fmtClock(t)} ET`;
}
// "Thursday, December 10 at 8pm ET"
function fmtLong(t) {
  return `${fmt(t, { weekday: 'long', month: 'long', day: 'numeric' })} at ${fmtClock(t)} ET`;
}
// "Apr 16, 2027"
function fmtDate(t) {
  return fmt(t, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- the call schedule ----------
// CIRCLE_CALL_TIME           "Thursdays, 8pm ET (holiday weeks move to Tuesday)": weekday and time are read from it
// CIRCLE_KICKOFF_AT          ISO time of the kickoff (the first call); the regular call that week is skipped
// CIRCLE_KICKOFF_CLAIM_BY    ISO time; seats claimed by then start at the kickoff (default: 2 hours before it)
// CIRCLE_CALL_MOVES          "2026-12-24>2026-12-22,2026-12-31>2026-12-29": regular date (ET) > moved date
// CIRCLE_CALL_SKIPS          "2027-04-22,2027-10-21": regular dates with no call

function callConfig(env = process.env) {
  const s = String(env.CIRCLE_CALL_TIME || 'Thursdays, 8pm ET');
  const dm = s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*/i);
  const tm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  let hour = 20;
  let minute = 0;
  if (tm) {
    hour = (parseInt(tm[1], 10) % 12) + (tm[3].toLowerCase() === 'pm' ? 12 : 0);
    minute = parseInt(tm[2] || '0', 10);
  }
  const kickoff = ms(env.CIRCLE_KICKOFF_AT);
  const claimBy = ms(env.CIRCLE_KICKOFF_CLAIM_BY) || (kickoff ? kickoff - 2 * HOUR : null);
  const moves = {};
  for (const pair of String(env.CIRCLE_CALL_MOVES || '').split(',')) {
    const m = pair.trim().match(/^(\d{4}-\d{2}-\d{2})\s*>\s*(\d{4}-\d{2}-\d{2})$/);
    if (m) moves[m[1]] = m[2];
  }
  const skips = new Set(String(env.CIRCLE_CALL_SKIPS || '').split(',').map((x) => x.trim()).filter(Boolean));
  return { weekday: dm ? WEEKDAYS.indexOf(dm[1].toLowerCase()) : 4, hour, minute, kickoff, claimBy, moves, skips };
}

function callAt(t, kickoff) {
  return { at: t, key: iso(t), kickoff: !!kickoff, minutes: kickoff ? 60 : 45 };
}

// Every call that starts within [from, to].
function callsBetween(from, to, env = process.env) {
  const c = callConfig(env);
  const out = [];
  if (c.kickoff && c.kickoff >= from && c.kickoff <= to) out.push(callAt(c.kickoff, true));
  const start = etParts(from - 7 * DAY);
  const end = to + 2 * DAY;
  for (let day = Date.UTC(start.y, start.m - 1, start.d); ; day += DAY) {
    const d = new Date(day);
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const wall = etTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), c.hour, c.minute);
    if (wall > end) break;
    if (d.getUTCDay() !== c.weekday || c.skips.has(key)) continue;
    const k = keyParts(c.moves[key] || key);
    const t = etTime(k.y, k.m, k.d, c.hour, c.minute);
    // No regular calls before the kickoff, and the kickoff takes its week's slot.
    if (c.kickoff && t < c.kickoff + 6 * DAY) continue;
    if (t >= from && t <= to) out.push(callAt(t, false));
  }
  return out.sort((a, b) => a.at - b.at);
}
function nextCall(after, env = process.env) {
  return callsBetween(after + 1, after + 70 * DAY, env)[0] || null;
}
function lastCall(before, env = process.env) {
  const list = callsBetween(before - 70 * DAY, before, env);
  return list[list.length - 1] || null;
}
// The first call for someone who claims a seat at time t.
function firstCallFor(t, env = process.env) {
  const c = callConfig(env);
  if (c.kickoff && c.claimBy && t <= c.claimBy) return callAt(c.kickoff, true);
  return nextCall(t, env);
}
function callLabel(call) {
  return call ? `${fmtLong(call.at)}${call.kickoff ? ' (the kickoff)' : ''}` : null;
}
// Week number since the kickoff (Monday-based ET weeks) and the 13-week Build Block.
function blockWeek(t, env = process.env) {
  const c = callConfig(env);
  if (!c.kickoff) return null;
  const monday = (x) => {
    const p = etParts(x);
    return Date.UTC(p.y, p.m - 1, p.d) - ((p.wd + 6) % 7) * DAY;
  };
  const week = Math.floor((monday(t) - monday(c.kickoff)) / (7 * DAY)) + 1;
  if (week < 1) return null;
  return { week: ((week - 1) % 13) + 1, block: Math.floor((week - 1) / 13) + 1 };
}
// Scorecard timing for a call (scorecard.md): opens 48 hours before, reminder 9am ET the day
// before, due midnight ET the night before, late saves until the call starts.
function scorecardWindow(call) {
  const p = etParts(call.at);
  const dueAt = etTime(p.y, p.m, p.d, 0, 0);
  const before = etParts(dueAt - 12 * HOUR);
  return { opensAt: call.at - 48 * HOUR, remindAt: etTime(before.y, before.m, before.d, 9, 0), dueAt, closesAt: call.at };
}

// ---------- applications ----------

const DECISIONS = ['approve', 'fit_call', 'not_yet', 'decline'];
const TIME_ANSWERS = { yes: 'Yes', mostly: 'Mostly', more: 'Tell us more' };

function guessTime(text) {
  const t = String(text || '').trim();
  if (/^y(es)?\b/i.test(t)) return 'yes';
  if (/mostly/i.test(t)) return 'mostly';
  return 'more';
}

// Migrate-on-read for records saved by the old five-question form.
function normalizeApplication(a) {
  if (!a || a.v === 2) return a;
  // The old "declined" screen said "Not this round... you can apply again later", so it reads as Not yet.
  if (a.status === 'declined') {
    a.status = 'not_yet';
    a.legacyDecline = true;
  }
  if (a.status === 'approved' && !a.approvedAt) a.approvedAt = a.updatedAt || a.createdAt;
  if (!a.time && a.commitment) {
    a.time = guessTime(a.commitment);
    a.timeNote = a.commitment;
  }
  if (a.result13 === undefined) a.result13 = '';
  a.v = 2;
  return a;
}

function appFor(c, userId) {
  return normalizeApplication(c.store.find('applications', (a) => a.userId === userId));
}
function approvalExpiresAt(a) {
  const t = ms(a && a.approvedAt);
  return t ? addMonths(t, APPROVAL_MONTHS) : null;
}
function approvalValid(a, now) {
  const exp = approvalExpiresAt(a);
  return !!exp && now < exp;
}
function offerActive(a, now) {
  const o = a && a.offer;
  return !!(o && !o.claimedAt && !o.expiredAt && ms(o.expiresAt) > now);
}

// What an application means right now: pending, fit_call, not_yet, declined, offered,
// waiting, passed (let a claim window run out), lapsed, former, member.
function appState(a, user, now) {
  normalizeApplication(a);
  if (user && user.tier === 'circle') return 'member';
  if (!a) return null;
  if (a.status === 'left') return 'former';
  if (a.status !== 'approved') return a.status;
  if (offerActive(a, now)) return 'offered';
  if (!approvalValid(a, now)) return 'lapsed';
  if (a.passedAt) return 'passed';
  return 'waiting';
}

// Approved applicants waiting for a seat, first in line first.
function queue(c) {
  const users = c.store.all('users');
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return c.store
    .all('applications')
    .map(normalizeApplication)
    .filter((a) => appState(a, byId[a.userId], c.now) === 'waiting')
    .sort((x, y) => (ms(x.approvedAt) - ms(y.approvedAt)) || String(x.createdAt).localeCompare(String(y.createdAt)));
}
function queuePosition(c, app) {
  const i = queue(c).findIndex((a) => a.id === app.id);
  return i < 0 ? null : i + 1;
}

// Users holding a seat: members, 30-minute checkout holds and live 72-hour offers.
function seatHolders(c, exceptUserId) {
  const ids = new Set();
  for (const u of c.store.all('users')) {
    if (u.tier === 'circle' || (u.id !== exceptUserId && u.circleHoldUntil && u.circleHoldUntil > c.now)) ids.add(u.id);
  }
  for (const a of c.store.all('applications')) {
    if (a.userId !== exceptUserId && a.status === 'approved' && offerActive(a, c.now)) ids.add(a.userId);
  }
  return ids;
}
function seatsLeft(c, exceptUserId) {
  return Math.max(0, c.capacity - seatHolders(c, exceptUserId).size);
}
function takenSeatNumbers(c, exceptUserId) {
  const taken = new Set();
  for (const u of c.store.all('users')) if (u.id !== exceptUserId && u.tier === 'circle' && u.circle && u.circle.seat) taken.add(u.circle.seat);
  for (const a of c.store.all('applications')) if (a.userId !== exceptUserId && a.status === 'approved' && offerActive(a, c.now)) taken.add(a.offer.seat);
  return taken;
}
function lowestFreeSeat(c, exceptUserId) {
  const taken = takenSeatNumbers(c, exceptUserId);
  for (let n = 1; n <= Math.max(c.capacity, taken.size + 1); n++) if (!taken.has(n)) return n;
  return taken.size + 1;
}

function links(c) {
  return {
    claimUrl: `${c.base}/app/circle`,
    profileUrl: `${c.base}/app/circle#profile`,
    handbookUrl: `${c.base}${HANDBOOK_PATH}`,
    scorecardUrl: `${c.base}/app/circle/scorecard`,
  };
}

// Offers open seats to the approved applicants in line, in order. Returns the applications offered.
async function allocate(c) {
  const offered = [];
  const line = queue(c);
  while (line.length && seatsLeft(c) > 0) {
    const a = line.shift();
    const seat = lowestFreeSeat(c, a.userId);
    a.offer = { seat, offeredAt: iso(c.now), expiresAt: iso(c.now + CLAIM_HOURS * HOUR) };
    a.offers = (a.offers || 0) + 1;
    offered.push(a);
    await save(c, 'applications', a);
    const user = c.store.get('users', a.userId);
    const name = (user && user.name) || a.name;
    const l = links(c);
    mail(c, a.email, a.waitingSince
      ? emails.seatOpened({ seatNo: seat, claimUrl: l.claimUrl })
      : emails.approvedSeatOpen({ name, seatNo: seat, claimUrl: l.claimUrl, firstCall: callLabel(firstCallFor(c.now, c.env)) || 'on the next Thursday at 8pm ET', handbookUrl: l.handbookUrl, profileUrl: l.profileUrl }));
    event(c, 'circle.seat_offered', { userId: a.userId, applicationId: a.id, seat, expires_at: a.offer.expiresAt });
  }
  return offered;
}

// Claim windows: reminder 24 hours before the end, then pass the seat on.
async function runOffers(c) {
  for (const a of c.store.all('applications').map(normalizeApplication)) {
    const o = a.offer;
    if (a.status !== 'approved' || !o || o.claimedAt || o.expiredAt) continue;
    const user = c.store.get('users', a.userId);
    if (user && user.tier === 'circle') continue; // syncMembers marks it claimed
    const end = ms(o.expiresAt);
    if (c.now >= end) {
      // Mid-payment when the window ends: the 30-minute checkout hold finishes first.
      if (user && user.circleHoldUntil && user.circleHoldUntil > c.now) continue;
      o.expiredAt = iso(c.now);
      a.passedAt = iso(c.now);
      await save(c, 'applications', a);
      mail(c, a.email, emails.claimEnded());
      event(c, 'circle.offer_expired', { userId: a.userId, applicationId: a.id, seat: o.seat });
    } else if (c.now >= end - REMIND_BEFORE_END_HOURS * HOUR && !o.remindedAt) {
      o.remindedAt = iso(c.now);
      await save(c, 'applications', a);
      mail(c, a.email, emails.claimReminder({ seatNo: o.seat, until: fmtDayTime(end), claimUrl: links(c).claimUrl }));
    }
  }
}

// Approvals older than 6 months lapse (never for someone holding a live offer).
async function lapseApprovals(c) {
  for (const a of c.store.all('applications').map(normalizeApplication)) {
    if (a.status !== 'approved' || offerActive(a, c.now) || approvalValid(a, c.now)) continue;
    const user = c.store.get('users', a.userId);
    if (user && user.tier === 'circle') continue;
    a.status = 'lapsed';
    a.lapsedAt = iso(c.now);
    await save(c, 'applications', a);
  }
}

// ---------- membership: seats, Founding Seats, alumni ----------

function membership(user) {
  return (user && user.circle) || null;
}
function isFormer(user) {
  const m = membership(user);
  return !!(user && user.tier !== 'circle' && m && m.leftAt);
}
function returningEligible(user, now) {
  const m = membership(user);
  if (!isFormer(user) || m.goodStanding === false) return false;
  return now < addMonths(ms(m.leftAt), RETURN_MONTHS);
}

async function join(c, user) {
  const m = user.circle || (user.circle = {});
  const app = appFor(c, user.id);
  const taken = takenSeatNumbers(c, user.id);
  const offerSeat = app && app.offer && !app.offer.expiredAt ? app.offer.seat : null;
  let seat = null;
  if (offerSeat && !taken.has(offerSeat)) seat = offerSeat;
  else if (m.seat && !taken.has(m.seat)) seat = m.seat;
  else seat = lowestFreeSeat(c, user.id);
  if (m.leftAt) m.stints = (m.stints || []).concat({ seat: m.seat, joinedAt: m.joinedAt, leftAt: m.leftAt, goodStanding: m.goodStanding }).slice(-10);
  if (!m.order) {
    const maxOrder = Math.max(0, ...c.store.all('users').map((u) => (u.circle && u.circle.order) || 0));
    m.order = maxOrder + 1;
  }
  m.founding = m.order <= FOUNDING_SEATS;
  m.seat = seat;
  m.joinedAt = iso(c.now);
  m.firstJoinedAt = m.firstJoinedAt || m.joinedAt;
  m.leftAt = null;
  m.goodStanding = null;
  m.unpaid = !!user.paymentIssue;
  if (!m.profile && app && app.result13) m.profile = { buildTarget: app.result13 };
  await save(c, 'users', user);
  if (app) {
    app.claimedAt = iso(c.now);
    if (app.offer && !app.offer.claimedAt) app.offer.claimedAt = iso(c.now);
    if (app.status !== 'approved') app.status = 'approved';
    await save(c, 'applications', app);
  }
  if (c.notify) {
    mail(c, c.admin, { subject: `${firstName(user.name, user.email)} took Seat ${seatLabel(seat)}`, text: `${user.name || user.email} took Seat ${seatLabel(seat)}. Give them the Member role in Discord.` });
    event(c, 'circle.joined', { userId: user.id, seat, founding_seat: m.founding });
  }
}

async function leave(c, user) {
  const m = user.circle;
  m.leftAt = iso(c.now);
  m.goodStanding = !m.unpaid && !m.removed;
  await save(c, 'users', user);
  const app = appFor(c, user.id);
  if (app && app.status === 'approved') {
    app.status = 'left';
    app.leftAt = m.leftAt;
    await save(c, 'applications', app);
  }
  if (c.notify) {
    mail(c, c.admin, { subject: `${firstName(user.name, user.email)} left the Circle`, text: `${user.name || user.email} left the Circle (Seat ${seatLabel(m.seat)}). Remove ${firstName(user.name, user.email)}'s Member role in Discord.` });
    event(c, 'circle.left', { userId: user.id, seat: m.seat, good_standing: m.goodStanding });
  }
}

// Notices tier changes made by billing (checkout, cancel, Stripe webhooks) without touching it.
async function syncMembers(c) {
  const users = c.store.all('users').slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const u of users) {
    const m = u.circle;
    if (u.tier === 'circle') {
      if (!m || !m.joinedAt || m.leftAt) await join(c, u);
      else if (!!u.paymentIssue !== !!m.unpaid) {
        // A member whose card is failing when Stripe cancels didn't leave in good standing.
        m.unpaid = !!u.paymentIssue;
        await save(c, 'users', u);
      }
    } else if (m && m.joinedAt && !m.leftAt) {
      await leave(c, u);
    }
  }
}

// ---------- decisions and actions ----------

function fitCallsThisWeek(c) {
  return c.store.all('applications').filter((a) => a.fitCall && c.now - ms(a.fitCall.at) < 7 * DAY).length;
}

async function decide(c, app, decision, opts = {}) {
  normalizeApplication(app);
  if (!DECISIONS.includes(decision)) return { error: 'Unknown decision.' };
  const user = c.store.get('users', app.userId);
  const state = appState(app, user, c.now);
  if (state === 'member') return { error: 'Already a member.' };
  const name = (user && user.name) || app.name;
  const record = () => {
    app.decidedAt = iso(c.now);
    app.decisions = (app.decisions || []).concat({ decision, at: app.decidedAt, by: opts.by || null }).slice(-20);
  };

  if (decision === 'approve') {
    if (['offered', 'waiting', 'passed'].includes(state)) return { error: 'Already approved.' };
    Object.assign(app, { status: 'approved', approvedAt: iso(c.now), offer: null, passedAt: null, claimedAt: null, waitingSince: null });
    record();
    await save(c, 'applications', app);
    event(c, 'circle.approved', { applicationId: app.id, userId: app.userId, email: app.email });
    await allocate(c);
    if (offerActive(app, c.now)) return { ok: true, offered: true, seat: app.offer.seat };
    app.waitingSince = iso(c.now);
    await save(c, 'applications', app);
    const position = queuePosition(c, app) || 1;
    mail(c, app.email, emails.approvedWaiting({ name, position }));
    return { ok: true, offered: false, position };
  }

  if (decision === 'fit_call') {
    const url = String(opts.bookingUrl || c.env.CIRCLE_FIT_CALL_URL || '').trim();
    if (!/^https:\/\//i.test(url)) return { error: 'Add a booking link (https://) or set CIRCLE_FIT_CALL_URL.' };
    if (fitCallsThisWeek(c) >= FIT_CALLS_PER_WEEK) return { error: `That's ${FIT_CALLS_PER_WEEK} fit calls in the last 7 days. Decide this one from the form.` };
    app.status = 'fit_call';
    app.fitCall = { at: iso(c.now), url };
    record();
    await save(c, 'applications', app);
    mail(c, app.email, emails.fitCall({ name, bookingUrl: url }));
    return { ok: true };
  }

  if (decision === 'not_yet') {
    const reason = String(opts.reason || '').trim().slice(0, 500);
    const change = String(opts.change || '').trim().slice(0, 500);
    if (!reason || !change) return { error: 'Not yet needs one specific reason and one thing that would change your answer.' };
    app.status = 'not_yet';
    app.notYet = { reason, change, at: iso(c.now) };
    app.legacyDecline = false;
    record();
    await save(c, 'applications', app);
    mail(c, app.email, emails.notYet({ name, reason, change, nextStep: user && user.tier === 'free' ? 'Builder' : 'your roadmap' }));
    return { ok: true };
  }

  // decline: red flags only
  app.status = 'declined';
  app.offer = null;
  record();
  await save(c, 'applications', app);
  mail(c, app.email, emails.decline({ name }));
  return { ok: true };
}

// "Reply when you're ready": someone whose claim window ran out goes back in line (approval order).
async function backInLine(c, app) {
  const user = c.store.get('users', app.userId);
  if (appState(app, user, c.now) !== 'passed') return { error: 'Not waiting to come back.' };
  app.passedAt = null;
  app.waitingSince = app.waitingSince || iso(c.now);
  await save(c, 'applications', app);
  await allocate(c);
  return { ok: true, offered: offerActive(app, c.now) };
}

// Former members in good standing (left in the last 6 months) take a seat without re-applying.
// Anyone approved and already waiting stays ahead of them.
async function rejoin(c, user) {
  if (!returningEligible(user, c.now)) return { error: 'Not eligible to come back without applying.' };
  let app = appFor(c, user.id);
  if (!app) app = { userId: user.id, email: user.email, name: user.name, v: 2 };
  Object.assign(app, {
    status: 'approved', approvedAt: iso(c.now), returning: true, offer: null, passedAt: null, claimedAt: null, waitingSince: null,
  });
  app.decisions = (app.decisions || []).concat({ decision: 'returning', at: iso(c.now) }).slice(-20);
  await save(c, 'applications', app);
  await allocate(c);
  if (offerActive(app, c.now)) return { ok: true, offered: true };
  app.waitingSince = iso(c.now);
  await save(c, 'applications', app);
  return { ok: true, offered: false, position: queuePosition(c, app) };
}

// Who may send (or re-send) the application form.
function canApply(app, user, now) {
  if (user && user.tier === 'circle') return false;
  const s = appState(app, user, now);
  if (!s) return true;
  if (s === 'not_yet' || s === 'lapsed') return true;
  if (s === 'former') return !returningEligible(user, now);
  return false;
}

const APPLY_FIELDS = ['business', 'revenue', 'challenge', 'result13', 'time', 'timeNote', 'link'];

// Validates and saves the six-question form. Returns { app } or { errors, values }.
async function apply(c, user, body, isHttpUrl = (u) => /^https?:\/\/\S+$/i.test(u)) {
  const f = (k, n = 1500) => String((body && body[k]) || '').trim().slice(0, n);
  const values = Object.fromEntries(APPLY_FIELDS.map((k) => [k, f(k)]));
  values.agree = body && (body.agree === 'on' || body.agree === true);
  const errors = [];
  if (!values.business) errors.push('Tell us what you are building, and for whom.');
  if (!values.revenue) errors.push('Tell us where it is today.');
  if (!values.challenge) errors.push('Tell us what you need help with in the next 90 days.');
  if (!values.result13) errors.push('Tell us what will be true 13 weeks from now.');
  if (!TIME_ANSWERS[values.time]) errors.push('Answer the time question.');
  if (values.time === 'more' && !values.timeNote) errors.push('Tell us more about your time.');
  if (!values.agree) errors.push("Confirm you've read how the Circle works and you're 18 or older.");
  if (errors.length) return { errors, values };
  let app = appFor(c, user.id);
  if (app && !canApply(app, user, c.now)) return { errors: ['You already have an application in.'], values };
  if (app) {
    const prev = Object.fromEntries(['business', 'revenue', 'challenge', 'result13', 'time', 'timeNote', 'commitment', 'link', 'status', 'createdAt', 'notYet'].map((k) => [k, app[k]]));
    app.previous = (app.previous || []).concat(prev).slice(-3);
    for (const k of ['commitment', 'notYet', 'fitCall', 'offer', 'passedAt', 'claimedAt', 'waitingSince', 'approvedAt', 'decidedAt', 'lapsedAt', 'legacyDecline', 'returning', 'leftAt']) delete app[k];
  } else {
    app = { userId: user.id };
  }
  Object.assign(app, {
    v: 2,
    email: user.email,
    name: user.name,
    business: values.business,
    revenue: values.revenue,
    challenge: values.challenge,
    result13: values.result13,
    time: values.time,
    timeNote: values.timeNote,
    link: isHttpUrl(values.link) ? values.link.slice(0, 300) : '',
    agreedAt: iso(c.now),
    status: 'pending',
    appliedAt: iso(c.now),
  });
  await save(c, 'applications', app);
  mail(c, user.email, emails.received({ name: user.name }));
  return { app };
}

// ---------- Founder Profile (onboarding.md) ----------

const STAGES = { start: 'Not selling yet', build: 'First sales', grow: 'Growing' };
const TIMEZONES = ['Eastern (ET)', 'Central (CT)', 'Mountain (MT)', 'Pacific (PT)', 'Alaska (AKT)', 'Hawaii (HT)', 'Outside the US'];
const PROFILE_FIELDS = [
  { id: 'building', label: "What you're building, in one sentence", required: true, max: 300 },
  { id: 'forWho', label: "Who it's for", required: true, max: 200 },
  { id: 'stage', label: 'Where you are', required: true, options: STAGES },
  { id: 'northLabel', label: 'Your North Number: what it counts', required: true, max: 80 },
  { id: 'northToday', label: 'Where it is today', required: true, max: 40 },
  { id: 'buildTarget', label: 'Your Build Target for this block (13 weeks)', required: true, max: 300 },
  { id: 'greatAt', label: "What you're great at", required: true, max: 200 },
  { id: 'wantMost', label: 'What you want most from this room', required: true, max: 200 },
  { id: 'timezone', label: 'Time zone', required: true, options: Object.fromEntries(TIMEZONES.map((z) => [z, z])) },
  { id: 'shareBells', label: 'Share my Bells on the 127 wins board?', required: false, options: { no: 'No', yes: 'Yes' } },
];

function profileOf(user, app) {
  const p = { ...((membership(user) || {}).profile || {}) };
  if (!p.buildTarget && app && app.result13) p.buildTarget = app.result13;
  if (!p.shareBells) p.shareBells = 'no';
  return p;
}
function profileMissing(p) {
  return PROFILE_FIELDS.filter((f) => f.required && !String(p[f.id] || '').trim()).map((f) => f.label);
}
async function saveProfile(c, user, body) {
  const m = user.circle || (user.circle = {});
  const p = {};
  for (const f of PROFILE_FIELDS) {
    let v = String((body && body[f.id]) || '').trim();
    if (f.options) v = Object.prototype.hasOwnProperty.call(f.options, v) ? v : '';
    else v = v.slice(0, f.max);
    p[f.id] = v;
  }
  if (!p.shareBells) p.shareBells = 'no';
  p.updatedAt = iso(c.now);
  m.profile = p;
  await save(c, 'users', user);
  return { profile: p, missing: profileMissing(p) };
}

// ---------- Scorecards (scorecard.md) ----------

const COMMITMENT = { done: 'Done', partly: 'Partly', not_done: 'Not done' };
const HOT_SEAT = { need: 'I need it', room: "If there's room", no: 'Not this week' };
const ATTENDANCE = { yes: 'Yes', late: "I'll be late", no: "I can't make it" };
const BELLS = { first_sale: 'First sale', first_1k: 'First $1k month', first_hire: 'First hire or contractor', registered: 'Business registered', launched: 'Launched', other: 'Other' };

function recaps(c) {
  return c.store.all('circleRecaps').slice().sort((a, b) => ms(b.callAt) - ms(a.callAt));
}
function lastRecapBefore(c, t) {
  return recaps(c).find((r) => ms(r.callAt) < t) || null;
}
function commitmentsFor(c, userId, call) {
  const r = call && lastRecapBefore(c, call.at);
  return (r && r.members && r.members[userId] && r.members[userId].commitments) || [];
}
function scorecardFor(c, userId, callKey) {
  return c.store.find('scorecards', (s) => s.userId === userId && s.callKey === callKey);
}
function numberHistory(c, userId, beforeKey, n = 4) {
  return c.store
    .filter('scorecards', (s) => s.userId === userId && s.callKey !== beforeKey && ms(s.callAt) < ms(beforeKey || iso(c.now + 365 * DAY)))
    .sort((a, b) => ms(b.callAt) - ms(a.callAt))
    .slice(0, n)
    .reverse()
    .map((s) => ({ call: fmtShort(ms(s.callAt)), value: s.number }));
}

// The call a member's Scorecard is for right now, and where its window stands.
function scorecardStatus(c, userId) {
  const call = nextCall(c.now, c.env);
  if (!call) return null;
  const w = scorecardWindow(call);
  const existing = scorecardFor(c, userId, call.key);
  let state = 'open';
  if (c.now < w.opensAt) state = 'not_open';
  else if (c.now >= w.dueAt) state = 'late';
  return { call, window: w, state, existing, label: fmtShort(call.at) };
}

async function saveScorecard(c, user, body) {
  const st = scorecardStatus(c, user.id);
  if (!st || st.state === 'not_open') return { errors: ["This week's Scorecard isn't open yet."] };
  const s = (k, n = 500) => String((body && body[k]) || '').trim().slice(0, n);
  const pick = (k, map) => (Object.prototype.hasOwnProperty.call(map, s(k)) ? s(k) : '');
  const errors = [];
  const rows = commitmentsFor(c, user.id, st.call).map((text, i) => ({ text, status: pick(`c${i}_status`, COMMITMENT), learned: s(`c${i}_learned`, 300) }));
  if (rows.some((r) => !r.status)) errors.push('Mark each commitment Done, Partly or Not done.');
  const numRaw = s('number', 40).replace(/[$,\s]/g, '');
  const number = numRaw === '' ? null : Number(numRaw);
  if (number === null || !Number.isFinite(number)) errors.push('Add your number. Zero counts.');
  const doc = {
    commitments: rows,
    number: Number.isFinite(number) ? number : null,
    numberNote: s('numberNote', 200),
    numberShare: s('numberShare') === 'eli' ? 'eli' : 'group',
    win: s('win', 200),
    bell: body && body.bell === 'on',
    bellType: pick('bellType', BELLS),
    bellOther: s('bellOther', 120),
    inTheWay: s('inTheWay', 300),
    hotSeat: pick('hotSeat', HOT_SEAT),
    hsSituation: s('hsSituation', 800),
    hsTried: s('hsTried', 500),
    hsDecide: s('hsDecide', 500),
    hsUrgent: body && body.hsUrgent === 'on',
    quickQuestion: s('quickQuestion', 300),
    attendance: pick('attendance', ATTENDANCE),
    privateNote: s('privateNote', 500),
  };
  if (doc.bell && !doc.bellType) errors.push('Pick which milestone rang the Bell.');
  if (doc.bell && doc.bellType === 'other' && !doc.bellOther) errors.push('Say what the milestone was.');
  if (!doc.inTheWay) errors.push("Say what's in the way.");
  if (!doc.hotSeat) errors.push('Say whether you need a hot seat this week.');
  if (doc.hotSeat && doc.hotSeat !== 'no' && !doc.hsSituation) errors.push('Give the situation for your hot seat in 2-3 sentences.');
  if (!doc.attendance) errors.push('Say whether you will be on the call.');
  if (errors.length) return { errors, values: doc };
  const existing = st.existing;
  const card = Object.assign(existing || { userId: user.id, callKey: st.call.key, callAt: st.call.key, firstSubmittedAt: iso(c.now), late: st.state === 'late' }, doc, {
    seat: (membership(user) || {}).seat || null,
    northLabel: profileOf(user).northLabel || '',
    submittedAt: iso(c.now),
  });
  await save(c, 'scorecards', card);
  if (card.bell && !(existing && existing.bell)) event(c, 'circle.bell', { userId: user.id, milestone: card.bellType === 'other' ? card.bellOther : BELLS[card.bellType] });
  return { card, call: st.call };
}

// Scorecard open notice and the 9am ET reminder the day before, once per member per call.
async function scorecardNotices(c) {
  const call = nextCall(c.now, c.env);
  if (!call) return;
  const w = scorecardWindow(call);
  if (c.now < w.opensAt || c.now >= w.dueAt) return;
  const day = fmt(call.at, { weekday: 'long' });
  for (const u of c.store.all('users').filter((x) => x.tier === 'circle' && x.circle)) {
    const n = u.circle.notices || (u.circle.notices = {});
    const url = links(c).scorecardUrl;
    if (n.open !== call.key) {
      n.open = call.key;
      await save(c, 'users', u);
      mail(c, u.email, emails.scorecardOpen({ day, label: fmtShort(call.at), url }));
    }
    if (c.now >= w.remindAt && n.remind !== call.key && !scorecardFor(c, u.id, call.key)) {
      n.remind = call.key;
      await save(c, 'users', u);
      mail(c, u.email, emails.scorecardReminder({ day, url }));
    }
  }
}

// ---------- recaps (recap.md) ----------

const COMMITMENTS_TOKEN = '[commitments: filled from the boxes below when you send]';

function members(c) {
  return c.store.all('users').filter((u) => u.tier === 'circle').sort((a, b) => ((a.circle && a.circle.seat) || 99) - ((b.circle && b.circle.seat) || 99));
}

// A starting draft from the Scorecards. Eli (or the members heartbeat's draft) replaces the [placeholders].
function recapDraft(c, call) {
  if (!call) return '';
  const next = nextCall(call.at, c.env);
  const bw = blockWeek(call.at, c.env);
  const list = members(c);
  const cards = Object.fromEntries(list.map((u) => [u.id, scorecardFor(c, u.id, call.key)]));
  const name = (u) => firstName(u.name, u.email);
  const out = [];
  out.push(`**Circle recap · ${fmtShort(call.at)}${bw ? ` · Week ${bw.week} of Block ${bw.block}` : ''}**`);
  out.push(`[${list.length} of ${list.length} at the table: check]`, '');
  for (const u of list) {
    const s = cards[u.id];
    if (s && s.bell) out.push(`**Bell:** ${name(u)}, ${s.bellType === 'other' ? s.bellOther : (BELLS[s.bellType] || 'a milestone').toLowerCase()}.`);
  }
  if (out[out.length - 1] !== '') out.push('');
  out.push('**Scoreboard**');
  for (const u of list) {
    const s = cards[u.id];
    const seat = `Seat ${seatLabel(u.circle && u.circle.seat)}`;
    if (!s) out.push(`${name(u)} (${seat}): no Scorecard`);
    else if (s.numberShare === 'eli') out.push(`${name(u)} (${seat}): shared with Eli`);
    else {
      const prev = numberHistory(c, u.id, call.key, 1)[0];
      out.push(`${name(u)} (${seat}): ${(s.northLabel || 'number').toLowerCase()} ${s.number}${prev ? ` (${prev.value})` : ''}`);
    }
  }
  const hot = list.filter((u) => cards[u.id] && cards[u.id].hotSeat && cards[u.id].hotSeat !== 'no');
  for (const u of hot.slice(0, 2)) {
    out.push('', `**Hot seat: ${name(u)}**`, '[Question: one line]', "[Eli's call: decision and why, 1-2 sentences]", '[The move: what they are doing this week]');
  }
  const quick = list.filter((u) => cards[u.id] && cards[u.id].quickQuestion);
  if (quick.length) {
    out.push('', '**Rapid round**');
    for (const u of quick) out.push(`${name(u)}${cards[u.id].attendance === 'no' ? ' (absent)' : ''}: ${cards[u.id].quickQuestion} → [Eli to answer]`);
  }
  out.push('', `**Commitments for ${next ? fmtShort(next.at) : '[next call]'}**`, COMMITMENTS_TOKEN);
  if (next) {
    const w = scorecardWindow(next);
    out.push('', `**Next call:** ${fmtShort(next.at)}, ${fmtClock(next.at)} ET in The Room. Hot seats: [A] and [B].`);
    out.push(`Scorecard opens ${fmtShort(w.opensAt)} ${fmtClock(w.opensAt)} ET, due midnight ET ${fmt(w.dueAt - HOUR, { weekday: 'long' })} night.`);
  }
  out.push('', '**From the library:** [title], [title]');
  return out.join('\n');
}

// Unfilled [placeholders] (a markdown link's [text](url) is fine).
function placeholders(text) {
  return (String(text || '').match(/\[[^\]\n]*\](?!\()/g) || []).filter((p) => p !== '[ ]' && p !== '[x]');
}

function parseRecapMembers(c, body) {
  const out = {};
  for (const u of members(c)) {
    const lines = String((body && body[`commit_${u.id}`]) || '').split('\n').map((l) => l.replace(/^[-*•\s]+/, '').trim().slice(0, 300)).filter(Boolean).slice(0, 5);
    const att = String((body && body[`attend_${u.id}`]) || 'unknown');
    out[u.id] = {
      name: firstName(u.name, u.email),
      seat: (u.circle && u.circle.seat) || null,
      commitments: lines,
      attendance: ['attended', 'missed', 'unknown'].includes(att) ? att : 'unknown',
      hotSeat: !!(body && body[`hot_${u.id}`] === 'on'),
    };
  }
  return out;
}

async function sendRecap(c, { callKey, post, body, by }) {
  const call = callKey ? { at: ms(callKey), key: callKey } : lastCall(c.now, c.env);
  if (!call || !call.at) return { error: 'No call to recap yet.' };
  if (c.store.find('circleRecaps', (r) => r.callKey === call.key)) return { error: `The recap for ${fmtShort(call.at)} was already sent.` };
  const memberMap = parseRecapMembers(c, body);
  const commitmentLines = Object.values(memberMap).filter((m) => m.commitments.length).map((m) => `${m.name}: ${m.commitments.join('; ')}`);
  let text = String(post || '').replace(/\r/g, '').trim();
  text = text.replace(COMMITMENTS_TOKEN, commitmentLines.join('\n') || 'None this week.');
  const left = placeholders(text);
  if (left.length) return { error: `Fill every placeholder before sending: ${left.slice(0, 4).join(', ')}${left.length > 4 ? '...' : ''}`, post: text };
  if (text.length < 40) return { error: 'The recap is empty.' };
  if (text.length > 6000) return { error: 'The recap is too long (keep it under 400 words).' };
  const recap = await saveDoc(c, 'circleRecaps', { callKey: call.key, callAt: call.key, post: text, members: memberMap, sentAt: iso(c.now), sentBy: by || null });
  const circleUrl = `${c.base}/app/circle`;
  let sent = 0;
  for (const u of members(c)) {
    const m = memberMap[u.id] || { commitments: [] };
    mail(c, u.email, emails.recap({ callLabel: fmtShort(call.at), commitments: m.commitments, seatNo: u.circle && u.circle.seat, post: text, circleUrl }));
    sent += 1;
  }
  const webhook = c.env.CIRCLE_CALL_NOTES_WEBHOOK_URL;
  let posted = false;
  if (webhook) posted = await c.post(webhook, text);
  recap.recipients = sent;
  recap.postedToDiscord = posted;
  await save(c, 'circleRecaps', recap);
  event(c, 'circle.recap_sent', { call_at: call.key, recipients: sent });
  return { ok: true, recap, sent, posted };
}
async function saveDoc(c, collection, doc) {
  const saved = await c.store.save(collection, doc);
  return saved || doc;
}

// Discord caps a message at 2000 characters, so a long recap goes in a few parts.
async function postToDiscord(url, text) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > 1900) {
      chunks.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) chunks.push(cur);
  try {
    for (const content of chunks) {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }
    return true;
  } catch (err) {
    console.warn('[circle] #call-notes webhook failed', err.message);
    return false;
  }
}

// Attendance and hot seats from approved recaps, newest first (prep brief and circle_missed).
function historyFor(c, userId, n = 8) {
  return recaps(c)
    .filter((r) => r.members && r.members[userId])
    .slice(0, n)
    .map((r) => ({ call: r.callKey, label: fmtShort(ms(r.callAt)), attendance: r.members[userId].attendance, hotSeat: r.members[userId].hotSeat }));
}

// ---------- the scheduled pass ----------

// Runs every few minutes from server.js and before Circle pages render. Safe to run twice:
// every email is guarded by a flag saved on the record first.
let running = null;
async function tick(o = {}) {
  if (running) return running;
  const c = o.store ? o : ctx(o);
  running = (async () => {
    await syncMembers(c);
    await runOffers(c);
    await lapseApprovals(c);
    await allocate(c);
    await scorecardNotices(c);
  })().finally(() => {
    running = null;
  });
  return running;
}

// ---------- Klaviyo profile properties ----------
// circle_first_call: "Tuesday, November 24 at 8pm ET (the kickoff)" when the seat was claimed by
// CIRCLE_KICKOFF_CLAIM_BY, otherwise the next weekly call after joining. Only for members and
// approved applicants; an empty object for everyone else.
function circleProfile(user, o = {}) {
  if (!user) return {};
  const c = o.store || o.now != null || o.env ? ctx(o) : null;
  const store = (c && c.store) || require('./db');
  const now = c ? c.now : Date.now();
  const env = (c && c.env) || process.env;
  const base = baseUrl(env);
  const member = user.tier === 'circle';
  const app = normalizeApplication(store.find('applications', (a) => a.userId === user.id));
  if (!member && !(app && app.status === 'approved')) return {};
  const claimed = member ? ms(user.circle && user.circle.joinedAt) || now : now;
  const first = firstCallFor(claimed, env);
  return {
    circle_first_call: first ? callLabel(first) : undefined,
    circle_discord_url: env.CIRCLE_COMMUNITY_URL || undefined,
    circle_profile_url: `${base}/app/circle#profile`,
    circle_handbook_url: `${base}${HANDBOOK_PATH}`,
  };
}

module.exports = {
  // constants
  CLAIM_HOURS, APPROVAL_MONTHS, RETURN_MONTHS, FOUNDING_SEATS, HANDBOOK_PATH, DECISIONS, TIME_ANSWERS,
  STAGES, TIMEZONES, PROFILE_FIELDS, COMMITMENT, HOT_SEAT, ATTENDANCE, BELLS, COMMITMENTS_TOKEN,
  // context and time
  ctx, ms, addMonths, etTime, etParts, etKey, fmtShort, fmtLong, fmtDayTime, fmtDate, fmtClock, seatLabel, firstName,
  // schedule
  callConfig, callsBetween, nextCall, lastCall, firstCallFor, callLabel, blockWeek, scorecardWindow,
  // applications and seats
  normalizeApplication, appFor, appState, approvalExpiresAt, approvalValid, offerActive, queue, queuePosition,
  seatHolders, seatsLeft, lowestFreeSeat, allocate, runOffers, lapseApprovals, decide, backInLine, rejoin, canApply, apply, fitCallsThisWeek,
  // membership
  membership, isFormer, returningEligible, syncMembers,
  // profile, scorecards, recaps
  profileOf, profileMissing, saveProfile, scorecardStatus, scorecardFor, saveScorecard, numberHistory, commitmentsFor, scorecardNotices,
  members, recaps, recapDraft, placeholders, sendRecap, historyFor, postToDiscord,
  tick, circleProfile,
};
