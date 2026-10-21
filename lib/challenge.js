// Day One Challenge: a free 5-day challenge (Mon Nov 9 to Fri Nov 13, 2026; v2 is 14 days, Tue Nov 3 to Mon Nov 16) that runs
// in front of doors opening. Every sign-up also joins the founding waitlist (source
// "challenge"). Routes live in lib/challenge-routes.js; copy for the five days lives in
// content/challenge.json so it can be edited without touching code.
//
// Env (the other times default to the Nov 2026 dates):
//   CHALLENGE_START_AT         Day 1 unlocks (Mon 8am ET). Day n unlocks 24h after day n-1.
//                              Required: blank or "off" switches every challenge route off (404),
//                              the same switch lib/launch.js challenge() reads.
//   CHALLENGE_REG_CLOSES_AT    registration closes (Fri noon ET)
//   CHALLENGE_CLOSES_AT        check-ins close (Sun 11:59pm ET)
//   CHALLENGE_LIVE_1_AT        kickoff live (Mon Nov 9, 8pm ET), CHALLENGE_LIVE_2_AT debrief live (Mon Nov 16, 8pm ET)
//   CHALLENGE_PROMO_AT         cross-promo blocks start showing (Mon Oct 26)
//   CHALLENGE_REPLAY_1_URL, CHALLENGE_REPLAY_2_URL, CHALLENGE_VIDEO_<n>_URL
//                              also settable in /admin/challenge (the admin value wins)
//   EARLY_ACCESS_AT            finishers' door (default: LAUNCH_AT minus 1 hour)
//   JOIN_IS_LAUNCH_CONSENT     "true": joining also counts as consent to launch emails
//                              through Nov 24. Default off: only the ticked box does.
//   KLAVIYO_CHALLENGE_LIST_ID  "127 Day One Challenge" list; every joiner is subscribed
//   CHALLENGE_IDEA_TEST_CAP    daily Idea Test cap for the first 3 challenge days (default 600)
//   TERMS_VERSION              stored with each sign-up's age and terms agreement
//   COMPANY_ADDRESS            postal address in the footer of every challenge email
//   ANTHROPIC_API_KEY          optional: writes the debrief hot-seat shortlist in /admin/challenge

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const security = require('./security');
const integrations = require('./integrations');
const kl = require('./klaviyo');
const launch = require('./launch');
const consent = require('./consent');
const waitlist = require('./waitlist');
const gamify = require('./gamify');
const roadmap = require('./roadmap');
const { MILESTONES } = require('./milestones');

const PROD = process.env.NODE_ENV === 'production';
const DAY = 864e5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULTS = {
  CHALLENGE_START_AT: '2026-11-09T13:00:00Z',
  CHALLENGE_REG_CLOSES_AT: '2026-11-13T17:00:00Z',
  CHALLENGE_CLOSES_AT: '2026-11-16T04:59:59Z',
  CHALLENGE_LIVE_1_AT: '2026-11-10T01:00:00Z',
  CHALLENGE_LIVE_2_AT: '2026-11-17T01:00:00Z',
  CHALLENGE_PROMO_AT: '2026-10-26T04:00:00Z',
};
// v2 runs 14 days on its own dates (lib/launch.js CHALLENGE_V2_DEFAULTS); env still overrides each one.
function defaultTime(name) {
  return (process.env.CHALLENGE_DAYS === 'v2' && launch.CHALLENGE_V2_DEFAULTS[name]) || DEFAULTS[name];
}
const DEFAULT_LAUNCH_AT = '2026-11-17T15:00:00Z';
const METRICS = { joined: 'Joined Challenge', day: 'Completed Challenge Day', finished: 'Finished Challenge' };
const INSTAGRAM = 'https://instagram.com/elichristiansen_';
// Where a sign-up came from. "from" values are set by our own links (?from=...).
const FROM = ['founding', 'founder-score', 'day-one-stack', 'idea-test', 'home', 'waitlist', 'manychat', 'email'];
const SOURCES = ['direct', 'waitlist', 'founder-score', 'day-one-stack', 'idea-test', 'manychat', 'ad', 'email', 'social', 'referral', 'founding', 'home'];

// Form wording lives in lib/consent.js (page 'challenge'), from Legal's handoff
// (legal/handoffs/launch-email-consent-and-challenge.md §1), switched by JOIN_IS_LAUNCH_CONSENT.
const ONE_TAP_VERSION = 'challenge-onetap-v1';

// ---------- clock and dates ----------
let clock = null;
function now() {
  if (clock) return clock();
  // Local previews only: CHALLENGE_FAKE_NOW=2026-11-11T15:00:00Z shows the site as it will look then.
  if (!PROD && process.env.CHALLENGE_FAKE_NOW) {
    const t = Date.parse(process.env.CHALLENGE_FAKE_NOW);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}
function envTime(name) {
  const v = process.env[name];
  const raw = v === undefined || v === '' ? defaultTime(name) : v;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : null;
}
// Same switch as lib/launch.js challenge(): blank CHALLENGE_START_AT turns the whole challenge off.
function enabled() {
  return launch.date('CHALLENGE_START_AT') != null;
}
function times() {
  const launchAt = launch.date('LAUNCH_AT') || Date.parse(DEFAULT_LAUNCH_AT);
  const startAt = envTime('CHALLENGE_START_AT');
  const early = launch.date('EARLY_ACCESS_AT') || NaN;
  return {
    startAt,
    regClosesAt: envTime('CHALLENGE_REG_CLOSES_AT'),
    closesAt: envTime('CHALLENGE_CLOSES_AT'),
    live1At: envTime('CHALLENGE_LIVE_1_AT'),
    live2At: envTime('CHALLENGE_LIVE_2_AT'),
    promoAt: envTime('CHALLENGE_PROMO_AT'),
    launchAt,
    earlyAt: Number.isFinite(early) ? early : launchAt - 36e5,
  };
}
// open: before Day 1 · live: Day 1 to registration close · closed: until doors open · after: doors are open
function phase(t = now()) {
  const T = times();
  if (t < T.startAt) return 'open';
  if (t < T.regClosesAt) return 'live';
  if (t < T.launchAt) return 'closed';
  return 'after';
}
function unlockAt(n) {
  return times().startAt + (n - 1) * DAY;
}
// The latest unlocked day (0 before the start).
function liveDay(t = now()) {
  const T = times();
  if (t < T.startAt) return 0;
  return Math.min(totalDays(), Math.floor((t - T.startAt) / DAY) + 1);
}
// Check-ins for day n: from its unlock until the close, inclusive.
function canCheckIn(n, t = now()) {
  return t >= unlockAt(n) && t <= times().closesAt;
}
function promoVisible(t = now()) {
  if (!enabled()) return false;
  const T = times();
  return t >= T.promoAt && t < T.regClosesAt;
}

const TZ = 'America/New_York';
function et(t, opts) {
  return new Date(t).toLocaleString('en-US', { timeZone: TZ, ...opts });
}
// "8pm", "9:30am"
function etClock(t) {
  return et(t, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', '').replace(/\s/g, '').toLowerCase();
}
// "Mon Nov 9"
function etDay(t) {
  return et(t, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}
// "Monday, November 9"
function etLong(t) {
  return et(t, { weekday: 'long', month: 'long', day: 'numeric' });
}
function etWeekday(t) {
  return et(t, { weekday: 'long' });
}

// ---------- content ----------
// CHALLENGE_DAYS=v2 runs the 14-day "Two weeks. Built in public." (content/challenge-v2.json, challenge-v2/SPEC.md);
// anything else keeps the original five moves. The engine reads the day-specific fields from the content's
// slots, summary and start_ticks, so both versions share every route, email and admin view.
function contentFile() {
  return path.join(__dirname, '..', 'content', process.env.CHALLENGE_DAYS === 'v2' ? 'challenge-v2.json' : 'challenge.json');
}
let contentCache = null;
let contentCacheFile = null;
function content() {
  const file = contentFile();
  if (!contentCache || !PROD || contentCacheFile !== file) {
    contentCache = JSON.parse(fs.readFileSync(file, 'utf8'));
    contentCacheFile = file;
  }
  return contentCache;
}
function day(n) {
  return content().days.find((d) => d.n === n) || null;
}
// v1 is 5 days, all 5 to finish. v2 is 14 days, and any 12 count as finishing (content.finish_min).
function totalDays() {
  return content().days.length;
}
function finishMin() {
  return content().finish_min || totalDays();
}
function dayNumbers() {
  return Array.from({ length: totalDays() }, (_, i) => i + 1);
}
const MOVES = ['Pick one', 'Find 10 people', 'Have the conversation', 'Write the offer', 'Ask for a yes'];
function moves() {
  return content().moves || MOVES;
}
// The two answers a card, the feature boxes and the hot seats can show: v1 the idea (Day 1) and the offer (Day 4).
const V1_SLOTS = { idea: { day: 1, field: 'idea', toggle: 'Add my idea to my card' }, offer: { day: 4, field: 'offer', toggle: 'Add my offer to my card' } };
function slot(name) {
  return (content().slots && content().slots[name]) || V1_SLOTS[name];
}
// Lines in emails and pages that name the day's length or the prep (v2 overrides them in content.email).
const V1_EMAIL = {
  move_time: 'About 20 minutes.',
  each: 'about 20 minutes each',
  prep: "**Before Monday:** write down 3 problems you've noticed this week. Things people complain about, pay someone to fix, or do badly themselves. That's the whole prep.",
  welcome_preview: 'Confirm your spot, then do the 1-minute prep.',
};
function emailCopy(key) {
  const e = content().email;
  return (e && e[key]) || V1_EMAIL[key];
}

// ---------- settings editable in /admin/challenge ----------
const MAX_DAYS = 14;
const VIDEO_KEYS = Array.from({ length: MAX_DAYS }, (_, i) => `video${i + 1}`);
const SETTING_KEYS = ['replay1', 'replay2', ...VIDEO_KEYS];
function settings() {
  let s = null;
  try { s = db.get('challengeSettings', 'main'); } catch { s = null; }
  const env = { replay1: process.env.CHALLENGE_REPLAY_1_URL, replay2: process.env.CHALLENGE_REPLAY_2_URL };
  VIDEO_KEYS.forEach((k, i) => { env[k] = process.env[`CHALLENGE_VIDEO_${i + 1}_URL`]; });
  const out = {};
  for (const k of SETTING_KEYS) out[k] = (s && s[k]) || env[k] || '';
  return out;
}
function cleanUrl(v) {
  const s = String(v || '').trim().slice(0, 500);
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\')) return s;
  return security.isHttpUrl(s) && /^https:/i.test(s) ? s : null;
}
async function saveSettings(body) {
  const doc = db.get('challengeSettings', 'main') || { id: 'main' };
  const bad = [];
  for (const k of SETTING_KEYS) {
    if (!(k in body)) continue;
    const v = cleanUrl(body[k]);
    if (v === null) bad.push(k);
    else doc[k] = v;
  }
  await db.save('challengeSettings', doc);
  return bad;
}
// Eli's video for a day: an mp4 (or same-origin file) plays inline; any other link opens in a new tab.
const VIDEO_DIR = path.join(__dirname, '..', 'public', 'video', 'challenge');
function video(n) {
  let src = settings()[`video${n}`];
  if (!src && fs.existsSync(path.join(VIDEO_DIR, `day-${n}.mp4`))) src = `/video/challenge/day-${n}.mp4`;
  if (!src) return null;
  const inline = src.startsWith('/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
  const poster = fs.existsSync(path.join(VIDEO_DIR, `day-${n}.jpg`)) ? `/video/challenge/day-${n}.jpg` : null;
  const captions = fs.existsSync(path.join(VIDEO_DIR, `day-${n}.vtt`)) ? `/video/challenge/day-${n}.vtt` : null;
  return { src, inline, poster, captions };
}
// The two lives' names: v2 calls the second one demo night (content.lives).
function liveTitle(id) {
  const L = content().lives;
  return (L && L[id]) || (id === 'debrief' ? 'Debrief' : 'Kickoff');
}
function lives(t = now()) {
  const T = times();
  const s = settings();
  return [
    { id: 'kickoff', title: liveTitle('kickoff'), at: T.live1At, label: `${etDay(T.live1At)} · ${etClock(T.live1At)} ET`, replay: s.replay1 || null, aired: t >= T.live1At + 30 * 60e3, ics: '/challenge/cal/kickoff.ics' },
    { id: 'debrief', title: liveTitle('debrief'), at: T.live2At, label: `${etDay(T.live2At)} · ${etClock(T.live2At)} ET`, replay: s.replay2 || null, aired: t >= T.live2At + 45 * 60e3, ics: '/challenge/cal/debrief.ics' },
  ];
}

// ---------- tokens, signed links ----------
function baseUrl() {
  return (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
}
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}
function secret() {
  return process.env.SESSION_SECRET || 'dev-only-not-for-production';
}
function sign(email) {
  return crypto.createHmac('sha256', secret()).update(`challenge-join:${String(email || '').trim().toLowerCase()}`).digest('base64url');
}
function verify(email, sig) {
  return security.sameHash(sign(email), String(sig || ''));
}
// One-tap join link for waitlist emails (Klaviyo profile property challenge_join_url).
function joinUrl(email) {
  if (!enabled() || !email) return undefined;
  const e = String(email).trim().toLowerCase();
  return `${baseUrl()}/challenge/join?e=${encodeURIComponent(e)}&s=${sign(e)}`;
}
function pageUrl(entry, base = baseUrl()) {
  return `${base}/challenge/me?t=${entry.token}`;
}
function dayUrl(entry, n, base = baseUrl()) {
  return `${base}/challenge/day/${n}?t=${entry.token}`;
}
function ipHash(ip) {
  return security.hash(`${secret()}:${ip || ''}`).slice(0, 24);
}

// ---------- entries ----------
function byEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e ? db.find('challenge', (x) => x.email === e) : null;
}
function byToken(token) {
  const t = String(token || '');
  if (!/^[a-f0-9]{32}$/.test(t)) return null;
  return db.find('challenge', (x) => security.sameHash(x.token, t));
}
function done(entry, n) {
  return !!(entry && entry.days && entry.days[n] && entry.days[n].at);
}
function daysDone(entry) {
  let c = 0;
  for (const n of dayNumbers()) if (done(entry, n)) c += 1;
  return c;
}
function status(entry) {
  return entry.finishedAt ? 'finished' : daysDone(entry) ? 'active' : 'joined';
}
function answer(entry, n, field) {
  const d = entry && entry.days && entry.days[n];
  return d && d.answers ? d.answers[field] : undefined;
}
function launchConsentFlag() {
  return consent.on();
}
function consentCopy() {
  return consent.copy('challenge');
}
function cleanName(v) {
  return String(v || '').replace(/[<>]/g, '').trim().slice(0, 60);
}
function cleanUtm(utm) {
  return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => [k, utm && utm[k] ? String(utm[k]).slice(0, 100) : null]));
}
function sourceFrom({ from, utm = {}, ref, oneTap }) {
  if (oneTap) return 'waitlist';
  const f = String(from || '').toLowerCase();
  if (FROM.includes(f)) return f;
  const s = String(utm.utm_source || '').toLowerCase();
  const m = String(utm.utm_medium || '').toLowerCase();
  const c = String(utm.utm_content || '').toLowerCase();
  if (m === 'dm' || c === 'dayone' || s === 'manychat') return 'manychat';
  if (['paid', 'cpc', 'cpm', 'ppc', 'paid_social', 'paid-social', 'paidsocial', 'ad', 'ads'].includes(m)) return 'ad';
  if (s === 'klaviyo' || m === 'email') return 'email';
  if (['instagram', 'ig', 'tiktok', 'youtube', 'facebook', 'fb', 'x', 'twitter', 'threads', 'linkedin', 'bio', 'linkinbio'].includes(s)) return 'social';
  if (ref) return 'referral';
  return 'direct';
}

// Klaviyo profile properties for daily emails (site-spec §3). False opt-ins are left out
// so a challenge sign-up never overwrites consent given on another form.
function profile(entry) {
  const wl = launch.onWaitlist(entry.email);
  return {
    first_name: entry.firstName || undefined,
    challenge_status: status(entry),
    challenge_days_done: daysDone(entry),
    challenge_token: entry.token,
    challenge_url: pageUrl(entry),
    challenge_finisher: !!entry.finishedAt,
    challenge_feature_ok: !!entry.featureOk,
    challenge_source: entry.source,
    challenge_path: entry.path || undefined,
    challenge_late: !!entry.late,
    challenge_joined_at: entry.createdAt,
    challenge_join_url: joinUrl(entry.email),
    launch_optin: entry.launchOptIn ? true : undefined,
    ongoing_optin: entry.ongoingOptIn ? true : undefined,
    referral_code: wl ? wl.referralCode : undefined,
    referral_link: wl ? waitlist.link(wl) : undefined,
    referral_count: wl ? wl.referralCount || 0 : undefined,
    signup_source: wl ? wl.source : undefined,
  };
}

// ---------- join ----------
// Returns { entry, existing, onList, confirmUrl } or { error } or { closed: true }.
// v2 paths (content.paths): service, products, creator, none. Anything else is left blank.
function cleanPath(v) {
  const id = String(v || '').toLowerCase();
  return (content().paths || []).some((p) => p.id === id) ? id : null;
}
async function join({ email, firstName, optIn, ref, utm = {}, from, ip, oneTap = false, page = '/challenge', path: pathIn }) {
  if (!enabled()) return { error: 'The challenge is not running right now.', off: true };
  const t = now();
  const T = times();
  if (t >= T.regClosesAt) return { closed: true };
  email = String(email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email.' };
  firstName = cleanName(firstName);
  optIn = !!optIn;
  const pathId = cleanPath(pathIn);
  const optins = consent.optins(optIn);
  const onList = launch.onWaitlist(email);
  // CH0 carries the confirm button, so the waitlist's own confirm email is skipped (one email, not two).
  const wl = await waitlist.join({ email, firstName, optIn, source: 'challenge', ref, utm, ip, confirmEmail: false });
  if (wl.error) return { error: wl.error };
  const iso = new Date(t).toISOString();
  const record = { ...consent.record('challenge', optIn, ipHash(ip)), at: iso, page };
  if (oneTap) record.version = ONE_TAP_VERSION;

  let entry = byEmail(email);
  if (entry) {
    let changed = false;
    if (!entry.firstName && (firstName || wl.entry.firstName)) { entry.firstName = firstName || wl.entry.firstName; changed = true; }
    if (pathId && !entry.path) { entry.path = pathId; changed = true; }
    if (optIn && !entry.ongoingOptIn) {
      entry.ongoingOptIn = true;
      entry.launchOptIn = true;
      entry.consents = (entry.consents || []).concat(record).slice(-10);
      changed = true;
    }
    if (changed) {
      await db.save('challenge', entry);
      kl.upsertProfile(email, profile(entry));
    }
    return { entry, existing: true, onList: !!onList, confirmUrl: wl.confirmUrl || null };
  }

  const referrer = ref ? waitlist.byCode(ref) : null;
  entry = await db.save('challenge', {
    email,
    firstName: firstName || (wl.entry && wl.entry.firstName) || '',
    path: pathId,
    token: newToken(),
    // The founding status page links here with the person's own code: that's a waitlister, not a referral.
    source: sourceFrom({ from: referrer && referrer.email === email ? from || 'waitlist' : from, utm, ref: referrer && referrer.email !== email ? referrer : null, oneTap }),
    ref: referrer && referrer.email !== email ? referrer.referralCode : null,
    utm: cleanUtm(utm),
    ipHash: ipHash(ip),
    late: t >= T.startAt,
    fromWaitlist: !!onList,
    waitlistCode: wl.entry ? wl.entry.referralCode : null,
    ongoingOptIn: optins.ongoing_optin,
    launchOptIn: optins.launch_optin,
    consents: [record],
    termsAcceptedAt: iso,
    termsVersion: process.env.TERMS_VERSION || '2026-10-16',
    days: {},
    finishedAt: null,
    showIdea: false,
    showOffer: false,
    featureOk: false,
    featureIdea: false,
    featureOffer: false,
    featureWalk: false,
    guestOk: false,
    friendNameOk: false,
    linkedUserId: null,
  });

  if (kl.on()) {
    kl.track(METRICS.joined, email, {
      source: entry.source,
      late: entry.late,
      from_waitlist: entry.fromWaitlist,
      utm_source: entry.utm.utm_source,
      utm_campaign: entry.utm.utm_campaign,
    }, profile(entry));
    if (process.env.KLAVIYO_CHALLENGE_LIST_ID) kl.subscribe(process.env.KLAVIYO_CHALLENGE_LIST_ID, email);
  }
  integrations.emit('challenge.joined', { email, source: entry.source, late: entry.late, from_waitlist: entry.fromWaitlist });
  sendWelcome(entry, wl.confirmUrl || null);
  return { entry, existing: false, onList: !!onList, confirmUrl: wl.confirmUrl || null };
}

// ---------- check-ins ----------
const TEXT_MAX = 500;
const FEATURE_FIELDS = ['feature_ok', 'feature_idea', 'feature_offer', 'feature_walk', 'guest_ok'];
function ticked(v) {
  return v === 'on' || v === 'true' || v === true || v === '1';
}
// Validates one day's form against content/challenge.json. Returns { answers, flags, errors }.
function validate(n, body = {}) {
  const d = day(n);
  const answers = {};
  const errors = {};
  for (const f of d.checkin.fields) {
    const raw = body[f.id];
    if (f.type === 'checkbox') {
      answers[f.id] = ticked(raw);
      continue;
    }
    let v = raw == null ? '' : String(Array.isArray(raw) ? raw[0] : raw).trim();
    const req = f.required || (f.required_if && String(body[f.required_if.field] || '') === f.required_if.equals);
    if (v === '') {
      if (req) errors[f.id] = f.type === 'choice' || f.type === 'select' ? 'Pick one.' : 'This one is needed to check in.';
      continue;
    }
    if (f.type === 'number') {
      const num = Number(v);
      const min = f.min != null ? f.min : 0;
      const max = f.max != null ? f.max : 100000;
      if (!Number.isInteger(num) || num < min || num > max) errors[f.id] = `Enter a whole number from ${min} to ${max}.`;
      else answers[f.id] = num;
    } else if (f.type === 'select' || f.type === 'choice') {
      if ((f.options || []).some((o) => o.value === v)) answers[f.id] = v;
      else errors[f.id] = 'Pick one.';
    } else {
      answers[f.id] = v.slice(0, TEXT_MAX);
    }
  }
  const flags = {};
  if ('show_idea' in answers) flags.showIdea = !!answers.show_idea;
  if ('show_offer' in answers) flags.showOffer = !!answers.show_offer;
  if (d.checkin.feature) {
    flags.featureOk = ticked(body.feature_ok);
    flags.featureIdea = flags.featureOk && ticked(body.feature_idea);
    flags.featureOffer = flags.featureOk && ticked(body.feature_offer);
    // v2's third box (Legal CH1): Eli plays a walkthrough only when this is ticked.
    if (content().feature && content().feature.feature_walk) flags.featureWalk = flags.featureOk && ticked(body.feature_walk);
    flags.guestOk = ticked(body.guest_ok);
    const byField = { feature_ok: 'featureOk', feature_idea: 'featureIdea', feature_offer: 'featureOffer', feature_walk: 'featureWalk', guest_ok: 'guestOk' };
    for (const k of FEATURE_FIELDS) if (byField[k] in flags) answers[k] = flags[byField[k]];
  }
  return { answers, flags, errors };
}

// Which words each feature tick saw (Legal CH5): one row per change, with the content version on the page.
const FEATURE_FLAGS = ['featureOk', 'featureIdea', 'featureOffer', 'featureWalk', 'guestOk'];
function logFeature(entry, flags, n, iso) {
  const log = entry.featureLog || [];
  const last = log[log.length - 1];
  const ticks = {};
  for (const k of FEATURE_FLAGS) if (k in flags) ticks[k] = !!flags[k];
  const same = last ? FEATURE_FLAGS.every((k) => !!last.ticks[k] === !!ticks[k]) : !FEATURE_FLAGS.some((k) => ticks[k]);
  if (same) return;
  log.push({ at: iso, day: n, version: content().version || null, ticks });
  entry.featureLog = log;
}

// Saves a check-in. The first save for a day fires the events; edits only update.
// Returns { errors } | { locked } | { closed } | { first, finishedNow, done }.
async function checkIn(entry, n, body, t = now()) {
  if (!day(n)) return { notFound: true };
  if (t < unlockAt(n)) return { locked: true };
  if (t > times().closesAt) return { closed: true };
  const { answers, flags, errors } = validate(n, body);
  if (Object.keys(errors).length) return { errors, answers };
  entry.days = entry.days || {};
  const first = !done(entry, n);
  const iso = new Date(t).toISOString();
  entry.days[n] = { at: first ? iso : entry.days[n].at, updatedAt: iso, answers };
  if (day(n).checkin.feature) logFeature(entry, flags, n, iso);
  Object.assign(entry, flags);
  const count = daysDone(entry);
  let finishedNow = false;
  if (count >= finishMin() && !entry.finishedAt) {
    entry.finishedAt = iso;
    entry.finishedDay = n;
    finishedNow = true;
  }
  await db.save('challenge', entry);
  if (kl.on()) {
    if (first) kl.track(METRICS.day, entry.email, { day: n, days_done: count }, profile(entry));
    else kl.upsertProfile(entry.email, profile(entry));
    if (finishedNow) kl.track(METRICS.finished, entry.email, { days_done: count }, profile(entry));
  }
  if (first) integrations.emit('challenge.checked_in', { email: entry.email, day: n, days_done: count });
  if (finishedNow) integrations.emit('challenge.finished', { email: entry.email });
  return { first, finishedNow, done: count };
}

// Real count of people who checked in on day n (shown only from 25 up).
function dayCount(n) {
  return db.filter('challenge', (e) => done(e, n)).length;
}
// Real counts for the v2 landing page. Each one shows only once it reaches PUBLIC_COUNT_MIN,
// so the page never shows a small number as proof (null = hide it).
const PUBLIC_COUNT_MIN = 50;
function publicCounts() {
  const all = db.all('challenge');
  const codes = new Set(all.map((e) => e.waitlistCode).filter(Boolean));
  const show = (v) => (v >= PUBLIC_COUNT_MIN ? v : null);
  return {
    joined: show(all.length),
    // v2 (Legal CH23): Day 2 check-ins with a site link, labelled "sites built". A preview link isn't live.
    sitesLive: content().slots ? null : show(all.filter((e) => done(e, 1)).length),
    sitesBuilt: content().slots ? show(all.filter((e) => answer(e, slot('idea').day, slot('idea').field)).length) : null,
    withFriend: show(all.filter((e) => e.ref && codes.has(e.ref)).length),
  };
}

// ---------- emails (Resend; copy from conversion/challenge/emails.md) ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function utmLink(url, id) {
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=site&utm_medium=email&utm_campaign=dayone&utm_content=${id}`;
}
// Builds a text and an HTML version from simple parts: { p }, { button: [label, url] }, { list: [...] }, { sign }.
function render(parts, preview) {
  const text = [];
  const html = [];
  const P = 'margin:0 0 18px;font-size:16px;line-height:1.65;color:#B3B3BD;';
  for (const part of parts) {
    if (part.p) {
      text.push(part.p.replace(/\*\*/g, ''));
      html.push(`<p style="${P}">${esc(part.p).replace(/\*\*(.+?)\*\*/g, '<b style="color:#EDEDF2;font-weight:600">$1</b>')}</p>`);
    } else if (part.button) {
      text.push(`${part.button[0]}: ${part.button[1]}`);
      html.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px"><tr><td bgcolor="#E3E6F1" style="border-radius:999px;"><a href="${esc(part.button[1])}" style="display:inline-block;padding:14px 26px;font-family:Geist,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#0A0A0C;text-decoration:none;border-radius:999px;">${esc(part.button[0])} &rarr;</a></td></tr></table>`);
    } else if (part.list) {
      text.push(part.list.map((l) => `- ${(l.text || l).replace(/\*\*/g, '')}${l.url ? ': ' + l.url : ''}`).join('\n'));
      html.push(`<ul style="margin:0 0 18px;padding-left:20px;font-size:16px;line-height:1.65;color:#B3B3BD;">${part.list.map((l) => `<li style="margin:0 0 6px">${l.url ? `<a href="${esc(l.url)}" style="color:#EDEDF2">${esc(l.text)}</a>` : esc(l.text || l)}</li>`).join('')}</ul>`);
    } else if (part.sign) {
      text.push(part.sign);
      html.push(`<p style="margin:28px 0 0;font-size:16px;line-height:1.6;color:#EDEDF2;">${esc(part.sign).replace(/\n/g, '<br>')}</p>`);
    }
  }
  const footer = `127 Group LLC · 127group.io${process.env.COMPANY_ADDRESS ? '\n' + process.env.COMPANY_ADDRESS : ''}\nYou're getting this because you joined the Day One Challenge.`;
  text.push('--\n' + footer);
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:#060607;"><div style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060607" style="background:#060607;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:8px 4px 18px;font-family:Geist,'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#7B7B86;font-weight:600;">The Day One Challenge</td></tr>
<tr><td bgcolor="#0E0E11" style="background:#0E0E11;border:1px solid #1F1F24;border-radius:16px;padding:40px 40px;font-family:Geist,'Helvetica Neue',Helvetica,Arial,sans-serif;">${html.join('\n')}</td></tr>
<tr><td style="padding:24px 4px 8px;font-family:Geist,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.7;color:#7B7B86;">${esc(footer).replace(/\n/g, '<br>')}</td></tr>
</table></td></tr></table></body></html>`;
  return { text: text.join('\n\n'), html: doc };
}

function welcomeParts(entry, confirmUrl, t = now()) {
  const T = times();
  const hi = entry.firstName || 'Hey';
  const page = utmLink(pageUrl(entry), 'ch0');
  const confirm = confirmUrl ? [{ button: ['Confirm my spot', confirmUrl] }] : [];
  const wl = launch.onWaitlist(entry.email);
  if (t < T.startAt) {
    return {
      subject: `You're in. ${etWeekday(T.startAt)} is day one.`,
      preview: emailCopy('welcome_preview'),
      parts: [
        { p: `${hi}, you're in the Day One Challenge.` },
        ...(confirmUrl ? [{ p: 'First, tap to confirm this is your email. It also saves your founding spot for when 127 opens.' }] : []),
        ...confirm,
        { p: 'How the week works:' },
        { list: [
          `Every morning at ${etClock(T.startAt)} ET, ${etLong(T.startAt)} to ${etLong(unlockAt(totalDays()))}, you get one move. ${emailCopy('move_time')}`,
          `When it's done, you check in on your own page. Miss a day? Catch up by ${etWeekday(T.closesAt)} night.${finishMin() < totalDays() ? ` Any ${finishMin()} of the ${totalDays()} days count as finishing.` : ''}`,
          `I'm live on Instagram twice: ${etLong(T.live1At)} to kick off, and ${etLong(T.live2At)} for the ${liveTitle('debrief').toLowerCase()}, the night before doors open. Both at ${etClock(T.live1At)} ET. @elichristiansen_`,
        ] },
        { p: emailCopy('prep') },
        { p: "Your challenge page (bookmark it, it's yours):" },
        { button: ['Open my page', page] },
        { sign: 'Make today day one.\nEli' },
        ...(wl ? [{ p: `P.S. Do it with a friend. When ${launch.referralsForReward()} friends confirm with your link by November 24, you get a free month of Builder: ${waitlist.link(wl)}` }] : []),
      ],
    };
  }
  const open = [];
  for (let n = 1; n <= liveDay(t); n++) open.push({ text: `Day ${n}: ${moves()[n - 1]}`, url: utmLink(dayUrl(entry, n), 'ch0-late') });
  return {
    subject: "You're in. Here's how to catch up.",
    preview: `Every day stays open until ${etWeekday(T.closesAt)} night.`,
    parts: [
      { p: `${hi}, you're in. The challenge started ${etWeekday(T.startAt)}, and you can still finish it: every day stays open until ${etLong(T.closesAt)} at ${etClock(T.closesAt)} ET.` },
      { p: `Start here, ${emailCopy('each')}:` },
      { list: open },
      ...confirm,
      ...(t < T.live2At ? [{ p: `${etLong(T.live2At)} at ${etClock(T.live2At)} ET I'm live on Instagram for the ${liveTitle('debrief').toLowerCase()}. @elichristiansen_` }] : []),
      { sign: 'Eli' },
    ],
  };
}
function sendWelcome(entry, confirmUrl) {
  const w = welcomeParts(entry, confirmUrl);
  const { text, html } = render(w.parts, w.preview);
  integrations.sendEmail({ to: entry.email, subject: w.subject, text, html });
}
function sendLink(entry) {
  const { text, html } = render([
    { p: "Here's your challenge page:" },
    { button: ['Open my page', utmLink(pageUrl(entry), 'ch-link')] },
    { p: "It's personal to you, so keep it to yourself." },
    { sign: 'Eli' },
  ], 'Your page, with every day you have done.');
  integrations.sendEmail({ to: entry.email, subject: 'Your Day One Challenge link', text, html });
}

// ---------- early access (finishers, 9am to 10am ET on launch day) ----------
// 'early': let them in now · 'wait-early': finisher, before their door · 'wait-launch': not a finisher · 'open': doors are open
function earlyState(entry, t = now()) {
  const T = times();
  if (t >= T.launchAt) return 'open';
  if (!entry || !entry.finishedAt) return 'wait-launch';
  if (t < T.earlyAt) return 'wait-early';
  return 'early';
}
const EA_HOURS = 2;
function grantEarly(req, t = now()) {
  req.session.ea = t + EA_HOURS * 36e5;
}
// True while a finisher's signed early-access session is valid (pre-launch gating treats them as launched).
function earlyAccess(req) {
  if (!enabled() || !req || !req.session || !req.session.ea) return false;
  const t = now();
  const T = times();
  return req.session.ea > t && t >= T.earlyAt && t < T.launchAt;
}

// ---------- carry-over into the member app (site-spec §11) ----------
function summary(entry) {
  const map = content().summary;
  if (map) {
    const out = {};
    for (const [k, [n, field]] of Object.entries(map)) {
      const v = answer(entry, n, field);
      out[k] = v === undefined || v === '' ? null : v;
    }
    return { ...out, path: entry.path || null, days_done: daysDone(entry), finisher: !!entry.finishedAt };
  }
  return {
    idea: answer(entry, 1, 'idea') || null,
    problem: answer(entry, 1, 'problem') || null,
    score: answer(entry, 1, 'score') != null ? answer(entry, 1, 'score') : null,
    conversation_quote: answer(entry, 3, 'quote') || null,
    offer: answer(entry, 4, 'offer') || null,
    asks: answer(entry, 5, 'asks') != null ? answer(entry, 5, 'asks') : null,
    yeses: answer(entry, 5, 'yeses') != null ? answer(entry, 5, 'yeses') : null,
    lesson: answer(entry, 5, 'lesson') || null,
    days_done: daysDone(entry),
    finisher: !!entry.finishedAt,
  };
}
// Start-track week-one steps the challenge already covers, and the matching milestones.
const V1_START_TICKS = [
  { day: 1, tasks: ['start-w1-t1', 'start-w1-t2'], milestones: ['idea_test'] },
  { day: 2, tasks: ['start-w1-t3'], milestones: [] },
  { day: 4, tasks: [], milestones: ['offer'] },
];
// Links a member to their challenge entry by email and carries the week over. Idempotent:
// it only does work when the entry or the roadmap changed since the last sync.
// Returns null (no entry) or { entry, changed, linkedNow, newBadges, ticked }.
async function syncUser(user, t = now()) {
  if (!enabled() || !user || !user.email) return null;
  const entry = byEmail(user.email);
  if (!entry) return null;
  const cur = user.challenge || null;
  const rmAt = (user.roadmap && user.roadmap.generatedAt) || null;
  if (cur && cur.syncedAt && entry.updatedAt && cur.syncedAt >= entry.updatedAt && cur.roadmapAt === rmAt) {
    return { entry, changed: false, linkedNow: false, newBadges: [], ticked: [] };
  }
  const iso = new Date(t).toISOString();
  const badgesBefore = (user.badges || []).length;
  const xpPaid = { ...((cur && cur.xpPaid) || {}) };
  const tickedNow = [];
  user.badges = user.badges || [];
  if (entry.finishedAt) gamify.award(user, 'day_one');
  if (user.roadmap && user.roadmap.track === 'start') {
    const tasks = roadmap.allTasks(user.roadmap);
    user.completed = user.completed || {};
    user.milestones = user.milestones || {};
    for (const rule of content().start_ticks || V1_START_TICKS) {
      if (!done(entry, rule.day)) continue;
      for (const id of rule.tasks) {
        const task = tasks.find((x) => x.id === id);
        if (!task || user.completed[id]) continue;
        user.completed[id] = iso;
        tickedNow.push(id);
        if (!xpPaid[id]) {
          user.xp = (user.xp || 0) + task.xp;
          xpPaid[id] = true;
        }
      }
      for (const id of rule.milestones) {
        const m = MILESTONES.find((x) => x.id === id);
        if (!m || user.milestones[id]) continue;
        user.milestones[id] = iso;
        if (!xpPaid[`m:${id}`]) {
          user.xp = (user.xp || 0) + m.xp;
          xpPaid[`m:${id}`] = true;
        }
      }
    }
  }
  gamify.refreshBadges(user);
  const newBadges = user.badges.slice(badgesBefore);
  if (!entry.linkedUserId) {
    entry.linkedUserId = user.id;
    entry.linkedAt = iso;
    await db.save('challenge', entry);
  }
  const carried = Object.keys(xpPaid).length;
  user.challenge = { ...summary(entry), finished_at: entry.finishedAt || null, carried, entryId: entry.id, linkedAt: (cur && cur.linkedAt) || iso, syncedAt: entry.updatedAt, roadmapAt: rmAt, xpPaid };
  await db.save('users', user);
  for (const b of newBadges) integrations.emit('badge.earned', { userId: user.id, badge: b, level: gamify.level(user.xp || 0).name });
  return { entry, changed: true, linkedNow: !cur, newBadges, ticked: tickedNow };
}
// ---------- Idea Test capacity (lib/funnels.js) ----------
// Day 1 links to /idea-test, so the daily cap goes up for the first three challenge days.
function ideaTestCap(base, t = now()) {
  if (!enabled()) return base;
  const T = times();
  if (t < T.startAt || t >= T.startAt + 3 * DAY) return base;
  return Math.max(base, parseInt(process.env.CHALLENGE_IDEA_TEST_CAP || '600', 10));
}

// ---------- Meta Lead (only with ad consent: Legal call L7) ----------
function adConsent(req) {
  if (!req || req.user) return false;
  if (req.get && (req.get('sec-gpc') === '1' || req.get('dnt') === '1')) return false;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)127_consent=([^;]*)/);
  return !!m && /^v1\.ads1(\.|$)/.test(decodeURIComponent(m[1]));
}
async function metaLead(req, entry, eventId) {
  const pixel = require('./ad-consent').metaPixelId(); // empty until /privacy and /cookies are live (Legal L43)
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token || !adConsent(req)) return;
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: `${baseUrl()}/challenge`,
          user_data: {
            em: [sha(entry.email)],
            ...(entry.firstName ? { fn: [sha(entry.firstName)] } : {}),
            client_ip_address: req.ip,
            client_user_agent: String(req.headers['user-agent'] || '').slice(0, 400),
            ...(cookies._fbp ? { fbp: cookies._fbp } : {}),
            ...(cookies._fbc ? { fbc: cookies._fbc } : {}),
          },
          custom_data: { content_name: 'day-one-challenge' },
        }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) console.warn('[challenge capi]', r.status, (await r.text()).slice(0, 300));
  } catch (err) {
    console.warn('[challenge capi] failed', err.message);
  }
}

// ---------- calendar files ----------
function ics(which) {
  const T = times();
  const live = which === 'debrief'
    ? { at: T.live2At, mins: 45, title: `Day One Challenge: ${liveTitle('debrief')} live with Eli` }
    : { at: T.live1At, mins: 30, title: 'Day One Challenge: Kickoff live with Eli' };
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Day One Challenge//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${which}-${f(live.at)}@127group.io`,
    `DTSTAMP:${f(Date.now())}`,
    `DTSTART:${f(live.at)}`,
    `DTEND:${f(live.at + live.mins * 60e3)}`,
    `SUMMARY:${live.title}`,
    `DESCRIPTION:Live on Instagram @elichristiansen_. Your day pages: ${baseUrl()}/challenge/me`,
    `LOCATION:${INSTAGRAM}`,
    `URL:${INSTAGRAM}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${live.title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// ---------- admin ----------
function stats() {
  const all = db.all('challenge');
  const bySource = {};
  for (const e of all) bySource[e.source] = (bySource[e.source] || 0) + 1;
  const confirmed = all.filter((e) => { const w = launch.onWaitlist(e.email); return w && w.confirmedAt; }).length;
  const checkins = dayNumbers().map((n) => all.filter((e) => done(e, n)).length);
  const hot = all
    .filter((e) => e.featureOk)
    .sort((a, b) => daysDone(b) - daysDone(a) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((e) => ({ entry: e, s: summary(e), daysDone: daysDone(e), conversation: answer(e, 3, 'conversation') || null }));
  return {
    total: all.length,
    late: all.filter((e) => e.late).length,
    fromWaitlist: all.filter((e) => e.fromWaitlist).length,
    bySource,
    confirmed,
    confirmedPct: all.length ? Math.round((confirmed / all.length) * 100) : 0,
    launchOptIn: all.filter((e) => e.launchOptIn).length,
    ongoingOptIn: all.filter((e) => e.ongoingOptIn).length,
    checkins,
    started: all.filter((e) => daysDone(e) > 0).length,
    finishers: all.filter((e) => e.finishedAt).length,
    linked: all.filter((e) => e.linkedUserId).length,
    hot,
    latest: all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 25),
  };
}
function csvCell(v) {
  let t = String(v == null ? '' : v);
  // Stop spreadsheets from running typed text as a formula.
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}
function csv() {
  if (content().summary) return csvV2(content().summary);
  const cols = ['email', 'first_name', 'joined', 'late', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'from_waitlist', 'waitlist_confirmed', 'launch_optin', 'ongoing_optin', 'consent_version', 'terms_version',
    'days_done', 'day1_at', 'day2_at', 'day3_at', 'day4_at', 'day5_at', 'finished_at', 'feature_ok', 'feature_idea', 'feature_offer', 'guest_ok',
    'idea', 'problem', 'score', 'people', 'messages', 'where', 'conversation', 'quote', 'offer', 'read_to', 'asks', 'yeses', 'lesson', 'member_linked'];
  const rows = [cols.map(csvCell).join(',')];
  for (const e of db.all('challenge').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const w = launch.onWaitlist(e.email);
    const a = (n, k) => answer(e, n, k);
    const at = (n) => (done(e, n) ? e.days[n].at : '');
    const last = (e.consents || [])[(e.consents || []).length - 1] || {};
    rows.push([e.email, e.firstName, e.createdAt, e.late ? 'yes' : '', e.source, e.utm && e.utm.utm_source, e.utm && e.utm.utm_medium, e.utm && e.utm.utm_campaign, e.utm && e.utm.utm_content, e.ref || '',
      e.fromWaitlist ? 'yes' : '', w && w.confirmedAt ? 'yes' : '', e.launchOptIn ? 'yes' : 'no', e.ongoingOptIn ? 'yes' : 'no', last.version || '', e.termsVersion || '',
      daysDone(e), at(1), at(2), at(3), at(4), at(5), e.finishedAt || '', e.featureOk ? 'yes' : '', e.featureIdea ? 'yes' : '', e.featureOffer ? 'yes' : '', e.guestOk ? 'yes' : '',
      a(1, 'idea'), a(1, 'problem'), a(1, 'score'), a(2, 'people'), a(2, 'messages'), a(2, 'where'), a(3, 'conversation'), a(3, 'quote'), a(4, 'offer'), a(4, 'read_to'), a(5, 'asks'), a(5, 'yeses'), a(5, 'lesson'), e.linkedUserId ? 'yes' : ''].map(csvCell).join(','));
  }
  return rows.join('\n');
}
// v2: the same people columns, then one column per summary answer (content/challenge-v2.json).
function csvV2(map) {
  const keys = Object.keys(map);
  const cols = ['email', 'first_name', 'joined', 'late', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'from_waitlist', 'waitlist_confirmed', 'launch_optin', 'ongoing_optin', 'consent_version', 'terms_version',
    'path', 'days_done', ...dayNumbers().map((n) => `day${n}_at`), 'finished_at', 'feature_ok', 'feature_site', 'feature_offer', 'feature_walk', 'guest_ok', 'feature_version', 'friend_name_ok', ...keys, 'member_linked'];
  const rows = [cols.map(csvCell).join(',')];
  for (const e of db.all('challenge').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const w = launch.onWaitlist(e.email);
    const at = (n) => (done(e, n) ? e.days[n].at : '');
    const last = (e.consents || [])[(e.consents || []).length - 1] || {};
    rows.push([e.email, e.firstName, e.createdAt, e.late ? 'yes' : '', e.source, e.utm && e.utm.utm_source, e.utm && e.utm.utm_medium, e.utm && e.utm.utm_campaign, e.utm && e.utm.utm_content, e.ref || '',
      e.fromWaitlist ? 'yes' : '', w && w.confirmedAt ? 'yes' : '', e.launchOptIn ? 'yes' : 'no', e.ongoingOptIn ? 'yes' : 'no', last.version || '', e.termsVersion || '',
      e.path || '', daysDone(e), ...dayNumbers().map(at), e.finishedAt || '', e.featureOk ? 'yes' : '', e.featureIdea ? 'yes' : '', e.featureOffer ? 'yes' : '', e.featureWalk ? 'yes' : '', e.guestOk ? 'yes' : '',
      ((e.featureLog || [])[(e.featureLog || []).length - 1] || {}).version || '', e.friendNameOk ? 'yes' : '',
      ...keys.map((k) => answer(e, map[k][0], map[k][1])), e.linkedUserId ? 'yes' : ''].map(csvCell).join(','));
  }
  return rows.join('\n');
}
// Sets challenge_join_url on every waitlist profile that isn't in the challenge yet (one-tap join links in R1 to R3).
async function backfillJoinLinks() {
  if (!kl.on() || !enabled()) return 0;
  const list = db.all('waitlist').filter((w) => !byEmail(w.email));
  for (const w of list) {
    await kl.upsertProfile(w.email, { challenge_join_url: joinUrl(w.email) });
    await new Promise((r) => setTimeout(r, 120));
  }
  return list.length;
}
// ---------- debrief hot seats (scripts.md: 3 picks plus 2 backups from opted-in finishers) ----------
// Only check-ins with "Eli can feature my check-in" ticked (Legal 3.3 and 3.6). The idea and the offer
// appear only when their own boxes were ticked. No emails or last names leave the site.
function hotSeatCandidates() {
  return db.filter('challenge', (e) => e.featureOk)
    .sort((a, b) => (b.finishedAt ? 1 : 0) - (a.finishedAt ? 1 : 0) || daysDone(b) - daysDone(a))
    .map((e) => ({
      id: e.id,
      firstName: e.firstName || '',
      finisher: !!e.finishedAt,
      daysDone: daysDone(e),
      guestOk: !!e.guestOk,
      idea: e.featureIdea ? answer(e, slot('idea').day, slot('idea').field) || null : null,
      offer: e.featureOffer ? answer(e, slot('offer').day, slot('offer').field) || null : null,
      walkthrough: e.featureWalk ? walkthroughUrl(e) : null,
      ...(content().summary ? v2Numbers(e) : {
        conversation: answer(e, 3, 'conversation') || null,
        quote: answer(e, 3, 'quote') || null,
        asks: answer(e, 5, 'asks'),
        yeses: answer(e, 5, 'yeses'),
        lesson: answer(e, 5, 'lesson') || null,
      }),
    }));
}
// v2: the walkthrough link from the summary map ("walkthrough_url"), or the day that asks for it.
function walkthroughUrl(e) {
  const d = (content().days || []).find((x) => x.checkin && (x.checkin.fields || []).some((f) => f.id === 'walkthrough_url'));
  return (d && answer(e, d.n, 'walkthrough_url')) || null;
}
// v2: the list, asks and replies from the summary map, whole-challenge totals first when given.
function v2Numbers(e) {
  const s = summary(e);
  const pickN = (...keys) => { for (const k of keys) if (s[k] != null) return s[k]; return undefined; };
  return { listCount: pickN('list_count'), asks: pickN('asks_total', 'asks'), replies: pickN('replies_total', 'replies_week', 'replies'), lesson: s.lesson || null };
}
function daysLine(c) {
  const n = totalDays();
  if (!c.finisher) return `, ${c.daysDone} of ${n} days`;
  return finishMin() < n ? `, finisher (${c.daysDone} of ${n} days)` : `, finished all ${n} days`;
}
function ideaWord() {
  return content().slots ? 'Site' : 'Idea';
}
function hotSeatPrompt(list) {
  const rows = list.map((c, i) => [
    `#${i + 1} ${c.firstName || '(no first name)'}${daysLine(c)}${c.guestOk ? ', open to joining on camera' : ''}`,
    c.idea ? `${ideaWord()} (may be shown): ${c.idea}` : `${ideaWord()}: not cleared to show`,
    c.offer ? `Offer (may be shown): ${c.offer}` : 'Offer: not cleared to show',
    content().feature && content().feature.feature_walk ? (c.walkthrough ? `Walkthrough (may be played): ${c.walkthrough}` : 'Walkthrough: not cleared to play') : null,
    c.conversation ? `Day 3 conversation: ${c.conversation}${c.quote ? `. What they heard: "${c.quote}"` : ''}` : null,
    c.listCount != null ? `List: ${c.listCount} people` : null,
    c.asks != null ? (c.yeses !== undefined ? `Day 5: asked ${c.asks}, yes ${c.yeses != null ? c.yeses : '?'}` : `Asks: sent ${c.asks}, ${c.replies != null ? c.replies : '?'} replies so far`) : null,
    c.lesson ? `Lesson: ${c.lesson}` : null,
  ].filter(Boolean).join('\n')).join('\n\n');
  return `These are check-ins from people who ticked "Eli can feature my check-in" in the free ${totalDays()}-day Day One Challenge (${moves().map((m) => m.toLowerCase()).join(', ')}). Eli takes 3 hot seats on ${etWeekday(times().live2At)}'s Instagram Live ${liveTitle('debrief').toLowerCase()}, about 6 minutes each, plus 2 backups.

Pick 3 hot seats and 2 backups. Prefer finishers, a mix of businesses, and stories other people can learn from (${content().slots ? 'a site worth reviewing live, a clear offer, an honest "no" that taught something' : 'a real conversation, a clear offer, an honest "no" that taught something'}). For each: first name, why them in one line, the one question Eli should ask, and the lesson for everyone in one line. Then list anyone who is open to joining on camera.

Rules: first names only. Only mention ${content().slots ? 'a site' : 'an idea'} or offer marked "may be shown"${content().feature && content().feature.feature_walk ? ', and only play a walkthrough marked "may be played"' : ''}. Never mention money amounts, revenue or income. Plain text, short lines, no tables.

${rows}`;
}
// Writes the shortlist with Claude (ANTHROPIC_API_KEY) or, without a key, a plain ranked list.
async function hotSeatSummary() {
  const list = hotSeatCandidates();
  let text;
  let ai = false;
  if (!list.length) text = 'Nobody has ticked "Eli can feature my check-in" yet.';
  else if (!process.env.ANTHROPIC_API_KEY) {
    text = list.slice(0, 5).map((c, i) => `${i < 3 ? 'Hot seat' : 'Backup'}: ${c.firstName || '(no name)'}, ${c.finisher ? 'finisher' : `${c.daysDone} of ${totalDays()} days`}${c.guestOk ? ', open to camera' : ''}${c.idea ? `. ${ideaWord()}: ${c.idea}` : ''}`).join('\n')
      + '\n\n(Plain list: add ANTHROPIC_API_KEY for the written summary.)';
  } else {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const model = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
      const r = await new Anthropic({ timeout: 45000, maxRetries: 1 }).messages.create({
        model,
        max_tokens: 2000,
        // Same check as supportsEffort in lib/ai.js: older models reject the effort setting.
        ...(/^claude-(opus-4-[5-9]|opus-5|fable|mythos|sonnet-4-6|sonnet-5|haiku-5)/.test(model) ? { output_config: { effort: 'low' } } : {}),
        messages: [{ role: 'user', content: hotSeatPrompt(list.slice(0, 60)) }],
      });
      text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || 'No summary came back. Try again.';
      ai = true;
    } catch (err) {
      console.warn('[challenge] hot-seat summary', err.status || '', err.message);
      text = "The summary didn't come back. Try again in a minute.";
    }
  }
  const doc = db.get('challengeSettings', 'hotseat') || { id: 'hotseat' };
  Object.assign(doc, { text, ai, count: list.length, at: new Date(now()).toISOString() });
  await db.save('challengeSettings', doc);
  return doc;
}
function lastHotSeatSummary() {
  return db.get('challengeSettings', 'hotseat') || null;
}
// Someone emailed to withdraw (Legal 3.3 small print): stop featuring them.
async function unfeature(id) {
  const e = db.get('challenge', id);
  if (!e) return false;
  const at = new Date(now()).toISOString();
  Object.assign(e, { featureOk: false, featureIdea: false, featureOffer: false, featureWalk: false, guestOk: false, unfeaturedAt: at });
  if (e.featureLog) e.featureLog.push({ at, day: null, version: 'withdrawn', ticks: { featureOk: false, featureIdea: false, featureOffer: false, featureWalk: false, guestOk: false } });
  await db.save('challenge', e);
  if (kl.on()) kl.upsertProfile(e.email, profile(e));
  return true;
}
// "Show my first name on my friend's card" (Legal CH21): off until the person ticks it, logged with the words they saw.
async function setFriendName(entry, on) {
  const at = new Date(now()).toISOString();
  entry.friendNameOk = !!on;
  entry.friendNameLog = (entry.friendNameLog || []).concat({ at, on: !!on, label: (content().friend_name && content().friend_name.label) || null });
  await db.save('challenge', entry);
  return entry;
}
// Account deletion (Legal L14): remove the challenge record with the account.
async function forget(email) {
  const e = byEmail(email);
  if (e) await db.remove('challenge', e.id);
}

module.exports = {
  METRICS, MOVES, SOURCES, DAY, moves, slot, emailCopy, contentFile, totalDays, finishMin, dayNumbers, liveTitle,
  now, enabled, times, phase, unlockAt, liveDay, canCheckIn, promoVisible,
  etClock, etDay, etLong, etWeekday,
  content, day, settings, saveSettings, video, lives,
  joinUrl, sign, verify, pageUrl, dayUrl, baseUrl,
  byEmail, byToken, done, daysDone, status, answer, profile, consentCopy, launchConsentFlag, sourceFrom,
  join, cleanPath, validate, checkIn, dayCount, publicCounts,
  sendWelcome, sendLink, welcomeParts, render,
  earlyState, grantEarly, earlyAccess,
  summary, syncUser,
  ideaTestCap, adConsent, metaLead, ics,
  stats, csv, backfillJoinLinks, forget,
  hotSeatCandidates, hotSeatPrompt, hotSeatSummary, lastHotSeatSummary, unfeature, setFriendName,
  _setNow(fn) { clock = fn; },
};
