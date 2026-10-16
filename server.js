require('./lib/env').load();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');

const db = require('./lib/db');
const { PLANS, plan, canAccess } = require('./lib/plans');
const roadmap = require('./lib/roadmap');
const gamify = require('./lib/gamify');
const ai = require('./lib/ai');
const billing = require('./lib/billing');
const integrations = require('./lib/integrations');
const security = require('./lib/security');
const consent = require('./lib/consent');
const launch = require('./lib/launch');
const waitlist = require('./lib/waitlist');
const billingRecords = require('./lib/billing-records');
const { MILESTONES } = require('./lib/milestones');
const onboarding = require('./content/onboarding.json');
const { resources } = require('./content/resources.json');

const PROD = process.env.NODE_ENV === 'production';
// A guessable session secret would let anyone forge a login, so production refuses to start without a real one.
if (PROD && (process.env.SESSION_SECRET || '').length < 32) {
  console.error('[config] SESSION_SECRET must be set to a random string of at least 32 characters in production.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const CIRCLE_CAPACITY = parseInt(process.env.CIRCLE_CAPACITY || '4', 10);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Proxy hops in front of the app. Check /admin ("Your IP as the server sees it") on the first deploy:
// if a phone on cellular and a laptop on Wi-Fi show the same address, raise TRUST_PROXY.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));
app.disable('x-powered-by');
app.use(security.headers(PROD));
app.use(require('compression')());
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Stripe needs the raw body, so this route comes before the body parsers.
app.post('/billing/webhook', express.raw({ type: 'application/json' }), billing.webhook);

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(
  cookieSession({
    name: 'h127',
    secret: process.env.SESSION_SECRET || 'dev-only-not-for-production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    httpOnly: true,
    secure: PROD,
  })
);

// ---------- helpers ----------
const bySlug = Object.fromEntries(resources.map((r) => [r.slug, r]));
const TRACK_NAMES = { start: 'Start', build: 'Build', grow: 'Grow' };

function currentUser(req) {
  return req.session && req.session.uid ? db.get('users', req.session.uid) : null;
}
// Admin needs a verified email, so nobody can claim the admin address by signing up with it first.
function isAdmin(user) {
  return !!user && !!user.emailVerified && ADMIN_EMAILS.includes(user.email);
}
// Approved applicants who are mid-checkout hold a seat for 30 minutes so the Circle can't be overbooked.
function circleSeatsLeft(exceptUserId) {
  const now = Date.now();
  const taken = db.filter('users', (u) => u.tier === 'circle' || (u.id !== exceptUserId && u.circleHoldUntil && u.circleHoldUntil > now)).length;
  return Math.max(0, CIRCLE_CAPACITY - taken);
}
function monthKey() {
  return new Date().toISOString().slice(0, 7);
}
const UNVERIFIED_AI_RUNS = 3;
function aiRunsLeft(user) {
  const used = user.aiUsage && user.aiUsage.month === monthKey() ? user.aiUsage.count : 0;
  const cap = user.emailVerified ? plan(user.tier).aiRunsPerMonth : Math.min(UNVERIFIED_AI_RUNS, plan(user.tier).aiRunsPerMonth);
  return Math.max(0, cap - used);
}
function progress(user) {
  const tasks = roadmap.allTasks(user.roadmap);
  const done = tasks.filter((t) => user.completed && user.completed[t.id]).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}
function nextTask(user) {
  if (!user.roadmap) return null;
  for (const w of user.roadmap.weeks) {
    if (!w.freeVisible && !canAccess(user, 'builder')) return null;
    for (const t of w.tasks) if (!(user.completed && user.completed[t.id])) return { ...t, week: w.week, theme: w.theme };
  }
  return null;
}
// Free members can open every resource their own roadmap uses in weeks 1-2,
// so the first steps are never behind a paywall.
function roadmapUnlocks(user) {
  if (!user || !user.roadmap) return new Set();
  return new Set(user.roadmap.weeks.filter((w) => w.freeVisible).flatMap((w) => w.tasks.map((t) => t.resource)).filter(Boolean));
}
function canOpen(user, r) {
  return !!r && (canAccess(user, r.tier) || roadmapUnlocks(user).has(r.slug));
}
async function addXp(user, amount) {
  user.xp = (user.xp || 0) + amount;
}

app.use((req, res, next) => {
  const user = currentUser(req);
  req.user = user;
  res.locals.user = user;
  res.locals.userPlan = user ? plan(user.tier) : null;
  res.locals.canOpen = (r) => canOpen(user, r);
  res.locals.isAdmin = isAdmin(user);
  res.locals.path = req.path;
  res.locals.PLANS = PLANS;
  res.locals.plausible = process.env.PLAUSIBLE_DOMAIN || null;
  res.locals.stripeLive = billing.isLive();
  res.locals.demoBilling = billing.isDemo();
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  res.locals.circleSeatsLeft = circleSeatsLeft();
  res.locals.circleCapacity = CIRCLE_CAPACITY;
  // Draft labels are for Eli and the team, never for members, unless SHOW_DRAFT_FLAGS=true.
  res.locals.showDrafts = isAdmin(user) || process.env.SHOW_DRAFT_FLAGS === 'true';
  res.locals.devVerifyLink = !PROD && req.session.devVerifyLink ? req.session.devVerifyLink : null;
  res.locals.launch = launch.view();
  res.locals.consentCopy = consent.copy;
  res.locals.builderOffer = builderOffer(req, user, res.locals.launch);
  res.locals.fmtDate = fmtDate;
  // Back from Stripe Checkout without paying.
  res.locals.checkoutCancelled = req.query.checkout === 'cancelled';
  res.locals.baseUrl = baseUrl(req);
  res.locals.canonical = baseUrl(req) + req.path;
  res.locals.description = null;
  // Plausible goals queued by the server (signup, upgrade...) fire on the next page view.
  res.locals.trackEvents = req.session.track || [];
  req.session.track = null;
  if (res.locals.checkoutCancelled) res.locals.trackEvents.push({ name: 'Checkout Cancelled', props: null });
  // Keep ad and referral source for the signup record.
  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) if (req.query[k]) utm[k] = String(req.query[k]).slice(0, 100);
  if (Object.keys(utm).length && !req.session.utm) req.session.utm = utm;
  if (req.query.ref && waitlist.byCode(req.query.ref)) setRefCookie(res, String(req.query.ref).toUpperCase());
  next();
});

// What every upgrade card, paywall and the founding bar say (in-app-founding-offer.md).
// During the founding window, free founding-eligible members see the founding price from day one (checkout applies it too).
function builderOffer(req, user, L) {
  const founding = !!(user && user.tier === 'free' && L.foundingOpen && L.foundingPrice && launch.isFoundingMember(user));
  const offer = {
    founding,
    price: founding ? L.foundingPrice : PLANS.builder.price,
    regular: PLANS.builder.price,
    messages: PLANS.builder.aiRunsPerMonth,
    closesDate: L.closesDate,
    closesShort: L.closesShort,
    closesTime: L.closesTime,
    // Free first month from the referral reward changes the renewal line (Membership Terms, Appendix A1).
    freeMonth: !!(founding && billing.referralRewardDue(user)),
  };
  offer.firstCharge = offer.freeMonth ? billing.firstChargeDate() : null;
  if (founding) {
    offer.lastDay = L.lastDay;
    offer.spotsLeft = L.showSpots ? L.spotsLeft : null;
    // Day One Challenge finishers: set by the challenge module; inert until it exists.
    const finisher = !!(user.challengeFinisher || (user.challenge && user.challenge.finished_at));
    offer.variant = L.lastDay ? 'last_day' : finisher ? 'finisher' : req.path === '/app' && req.query.welcome ? 'welcome' : 'default';
    // "Hide for today" collapses the bar to one line for 24 hours, except on the last day.
    offer.hidden = !L.lastDay && cookie(req, 'fbhide') === '1';
  }
  return offer;
}
function fmtDate(isoOrMs) {
  if (!isoOrMs) return null;
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : null;
}

function cookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function setRefCookie(res, code) {
  res.cookie('ref', code, { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax', httpOnly: true, secure: PROD });
}
function track(req, name, props) {
  req.session.track = (req.session.track || []).concat({ name, props: props || null }).slice(-5);
}
// Sends one Klaviyo/webhook event per newly earned badge.
function emitNewBadges(user, before) {
  for (const b of (user.badges || []).slice(before)) integrations.emit('badge.earned', { userId: user.id, badge: b, level: gamify.level(user.xp || 0).name });
}

function flash(req, type, text) {
  req.session.flash = { type, text };
}
function requireAuth(req, res, next) {
  if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  next();
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(404).render('404');
  next();
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Returns false (and answers the request) when a rate limit is hit.
function limit(req, res, key, max, windowMs, message) {
  if (security.allow(key, max, windowMs)) return true;
  res.status(429);
  if (req.accepts(['html', 'json']) === 'json') res.json({ error: message });
  else res.render('404', { title: 'Slow down', error: true, message });
  return false;
}
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// One-time links for verifying an email and resetting a password. Only a hash is stored.
async function sendEmailLink(req, user, kind) {
  const t = security.token();
  user[`${kind}Hash`] = security.hash(t);
  user[`${kind}Expires`] = Date.now() + (kind === 'verify' ? 7 * 24 : 1) * 60 * 60 * 1000;
  await db.save('users', user);
  const link = `${baseUrl(req)}/${kind === 'verify' ? 'verify' : 'reset'}?u=${user.id}&t=${t}`;
  if (kind === 'verify') {
    integrations.sendEmail({ to: user.email, subject: 'Confirm your email for 127', text: `Tap to confirm your email and unlock your full Playbook messages:\n\n${link}\n\nThis link works for 7 days.\n\n127` });
    if (!PROD && !process.env.RESEND_API_KEY) req.session.devVerifyLink = link;
  } else {
    integrations.sendEmail({ to: user.email, subject: 'Reset your 127 password', text: `Someone asked to reset the password for this email. If it was you, choose a new one here:\n\n${link}\n\nThis link works for 1 hour. If it wasn't you, ignore this email.\n\n127` });
    if (!PROD && !process.env.RESEND_API_KEY) return link;
  }
  return null;
}
function checkLink(kind, q) {
  const user = db.get('users', String(q.u || ''));
  if (!user || !user[`${kind}Hash`] || !(user[`${kind}Expires`] > Date.now())) return null;
  return security.sameHash(user[`${kind}Hash`], security.hash(String(q.t || ''))) ? user : null;
}

// ---------- public site ----------
// Intro video on the homepage: HOME_VIDEO_URL, or drop a file at public/video/intro.mp4 (poster: intro.jpg).
function homeVideo() {
  if (process.env.HOME_VIDEO_URL) return { src: process.env.HOME_VIDEO_URL, poster: process.env.HOME_VIDEO_POSTER || '/img/eli-founder.jpg' };
  const f = path.join(__dirname, 'public', 'video', 'intro.mp4');
  if (!fs.existsSync(f)) return null;
  return { src: '/video/intro.mp4', poster: fs.existsSync(path.join(__dirname, 'public', 'video', 'intro.jpg')) ? '/video/intro.jpg' : '/img/eli-founder.jpg' };
}
// hState: A1, A2, B or C (conversion/pages/homepage.md section 1); joinFlag picks Legal's consent wording for the inline form;
// heroMobile (HERO_MOBILE=loop|3d, default loop) picks the phone hero: the pre-rendered loop or the live WebGL mark.
app.get('/', (req, res) => res.render('home', { title: null, resources, onboarding, tools: ai.TOOLS, video: homeVideo(), hState: launch.homeState(res.locals.launch), joinFlag: consent.on() ? 'on' : 'off', heroMobile: process.env.HERO_MOBILE === '3d' ? '3d' : 'loop' }));
// Pricing meta description by launch state (conversion/pages/pricing.md).
function pricingDescription() {
  const v = launch.view();
  if ((v.prelaunch || v.foundingOpen) && v.foundingPrice) return `Start free. Builder is $${v.foundingPrice} a month, locked while you stay, for the first ${v.cap} founding members until ${v.closesDate || 'the founding close'}. Then $29.`;
  return `Start free. Builder is $29 a month for the full library and every AI tool. The ${CIRCLE_CAPACITY}-seat Founder's Circle is by application.`;
}
app.get('/pricing', (req, res) => res.render('pricing', { title: 'Membership', description: pricingDescription(), resourceCount: resources.length }));
app.get('/circle', (req, res) => res.render('circle', { title: "Founder's Circle" }));
app.get('/media-kit', (req, res) => res.render('media-kit', { title: 'Media kit', description: 'Eli Christiansen media kit: 80K followers across Instagram, TikTok and YouTube, audience snapshot, past brand partnerships and ways to work together.' }));
app.get('/mediakit', (req, res) => res.redirect(301, '/media-kit'));
app.get('/privacy', (req, res) => res.render('legal', { title: 'Privacy', kind: 'privacy' }));
app.get('/terms', (req, res) => res.render('legal', { title: 'Terms', kind: 'terms' }));
app.get('/membership-terms', (req, res) => res.render('legal', { title: 'Membership terms', kind: 'membership' }));

// ---------- onboarding (the free assessment is the signup) ----------
// During pre-launch, new signups go to the founding waitlist unless they have the invite code.
function prelaunchGate(req) {
  if (req.query.invite && process.env.PRELAUNCH_INVITE && req.query.invite === process.env.PRELAUNCH_INVITE) req.session.invite = true;
  return launch.prelaunch() && !req.user && !req.session.invite;
}

app.get('/start', (req, res) => {
  if (prelaunchGate(req)) return res.redirect('/founding');
  if (req.user && req.user.roadmap && !req.query.retake) return res.redirect('/app');
  // The homepage hero asks the first question inline; carry that answer in and skip ahead.
  const first = onboarding.questions[0];
  const picked = first.options.find((o) => o.value === req.query[first.id]);
  const prefill = picked ? { [first.id]: picked.value } : null;
  res.render('start', { title: 'Your free roadmap', onboarding, retake: !!(req.user && req.user.roadmap), error: null, layout: 'bare', prefill, jump: picked ? 1 : null });
});
app.get('/signup', (req, res) => res.redirect(launch.prelaunch() ? '/founding' : '/start'));
app.get('/app/assessment', requireAuth, (req, res) => res.redirect('/start?retake=1'));

// Keep only known question ids and clamp lengths.
function cleanAnswers(answers) {
  const clean = {};
  for (const q of onboarding.questions) {
    const v = (answers || {})[q.id];
    if (v == null || v === '') continue;
    clean[q.id] = Array.isArray(v) ? v.slice(0, 10).map((x) => String(x).slice(0, 60)) : String(v).slice(0, 1000);
  }
  return clean;
}

// Week 1 of the roadmap before signup (no account, no AI call).
app.post('/start/preview', express.json({ limit: '20kb' }), (req, res) => {
  if (!limit(req, res, `preview:${security.ip(req)}`, 40, 10 * 60 * 1000, TOO_FAST)) return;
  const rm = roadmap.generate(cleanAnswers(req.body && req.body.answers));
  const w = rm.weeks[0];
  res.json({
    trackName: rm.trackName,
    headline: rm.headline,
    focus: rm.focus,
    weeks: rm.weeks.length,
    week: { theme: w.theme, tasks: w.tasks.map((t) => ({ title: t.title, detail: t.detail })) },
  });
});

app.post('/start', wrap(async (req, res) => {
  if (prelaunchGate(req)) return res.redirect('/founding');
  if (req.user ? !limit(req, res, `retake:${req.user.id}`, 10, 60 * 60 * 1000, TOO_FAST) : !limit(req, res, `signup:${security.ip(req)}`, 5, 60 * 60 * 1000, TOO_FAST)) return;
  let answers = {};
  try {
    answers = JSON.parse(req.body.answers || '{}');
  } catch {
    answers = {};
  }
  const clean = cleanAnswers(answers);

  let user = req.user;
  if (!user) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim().slice(0, 80);
    const password = String(req.body.password || '');
    const renderErr = (error) => res.status(400).render('start', { title: 'Your free roadmap', onboarding, retake: false, error, layout: 'bare', prefill: clean });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return renderErr('Please enter a valid email.');
    if (password.length < 8) return renderErr('Use a password with at least 8 characters.');
    if (db.find('users', (u) => u.email === email)) return renderErr('That email already has an account. Sign in instead.');
    user = await createMember(req, { email, name, password, optIn: req.body.optin === 'on', fallbackSource: clean.source });
    integrations.sendEmail({ to: email, subject: 'Your 127 roadmap is ready', text: `Hi ${name || 'there'},\n\nYour personalized 30-day roadmap is waiting: ${process.env.BASE_URL || 'https://127group.io'}/app\n\nBuild with purpose.\n127` });
  }

  const firstTime = !user.roadmap;
  user.answers = clean;
  user.answersHistory = [...(user.answersHistory || []), { at: new Date().toISOString(), answers: clean }].slice(-5);
  user.roadmap = roadmap.generate(clean);
  if (!firstTime) user.completed = {};
  // The personal note is an AI call, so it runs on the first roadmap and at most once a day on retakes.
  const lastNote = user.roadmapNoteAt ? Date.parse(user.roadmapNoteAt) : 0;
  if (firstTime || Date.now() - lastNote > 24 * 60 * 60 * 1000) {
    user.roadmapNote = await ai.roadmapNote(user);
    user.roadmapNoteAt = new Date().toISOString();
  } else {
    user.roadmapNote = null;
  }
  if (firstTime) {
    await addXp(user, 50);
    user.onboardedAt = new Date().toISOString();
    track(req, 'Onboarding Complete', { track: user.roadmap.trackName });
  }
  const badgesBefore = (user.badges || []).length;
  gamify.refreshBadges(user);
  await db.save('users', user);
  integrations.emit('onboarding.completed', { userId: user.id, answers: clean, track: user.roadmap.track, trackName: user.roadmap.trackName });
  emitNewBadges(user, badgesBefore);
  res.redirect(firstTime ? '/app?welcome=1' : '/app?retook=1');
}));

// New account, signed in. `source` overrides the usual source (utm, referral, waitlist, funnel).
async function createMember(req, { email, name, password, optIn, source, fallbackSource }) {
  const onList = launch.onWaitlist(email);
  const refCode = cookie(req, 'ref');
  const referrer = refCode && waitlist.byCode(refCode);
  const utm = req.session.utm || {};
  // Which funnel (quiz, stack, idea test) this member came from, if any.
  const lead = db.filter('leads', (l) => l.email === email).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] || null;
  const user = await db.save('users', {
    email,
    name,
    referredBy: (onList && onList.referredBy) || (referrer && referrer.email !== email ? referrer.referralCode : null),
    signupSource: source || utm.utm_source || (referrer ? 'referral' : null) || (onList ? `waitlist:${onList.source}` : null) || (lead ? `funnel:${lead.source}` : null) || fallbackSource || 'direct',
    leadSource: lead ? lead.source : null,
    utm: Object.keys(utm).length ? utm : null,
    passwordHash: await bcrypt.hash(password, 10),
    tier: 'free',
    xp: 0,
    completed: {},
    badges: [],
    marketingOptIn: !!optIn,
    emailVerified: false,
  });
  req.session.uid = user.id;
  req.user = user;
  integrations.emit('user.signed_up', {
    userId: user.id,
    source: user.signupSource,
    founding_member: launch.isFoundingMember(user),
    from_waitlist: !!onList,
    marketing_opt_in: user.marketingOptIn,
  });
  if (user.marketingOptIn) integrations.syncConsent(email, true);
  track(req, 'Signup', { source: user.signupSource });
  await sendEmailLink(req, user, 'verify');
  return user;
}

// ---------- founding members: waitlist and referrals ----------
function utmFrom(req, body = {}) {
  const out = { ...(req.session.utm || {}) };
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) if (body[k]) out[k] = String(body[k]).slice(0, 100);
  return out;
}

app.get('/f/:code', (req, res) => {
  const entry = waitlist.byCode(req.params.code);
  if (entry) setRefCookie(res, entry.referralCode);
  res.redirect(launch.prelaunch() ? '/founding' : '/start');
});

// /founding has three states (conversion/pages/founding.md): A waitlist, B founding window, C closed.
// It stays live after launch because old posts and DMs link to it.
function foundingPage() {
  const v = launch.view();
  const state = v.prelaunch ? 'A' : v.foundingOpen ? 'B' : 'C';
  const pm = v.foundingPrice ? `$${v.foundingPrice} a month` : 'a founding price';
  const base = { fState: state, resourceCount: resources.length };
  if (state === 'A') {
    const ch = v.challenge.open ? ` Free 5-day challenge with Eli, ${v.challenge.dates}.` : '';
    return { ...base, title: 'Founding members', description: `Join the 127 founding list. Builder for ${pm}, locked while you stay, when doors open${v.launchDate ? ` ${v.launchDate}` : ''}.${ch}` };
  }
  if (state === 'B') return { ...base, title: 'Founding price', description: `Builder for ${pm}, locked while you stay. Until ${v.closesDate || 'the founding close'} or the first ${v.cap} founding members.` };
  return { ...base, title: 'Founding members', description: 'The founding price has closed. Builder is $29 a month, and the free plan is still free.' };
}
app.get('/founding', (req, res) => res.render('founding', { ...foundingPage(), error: null, form: {} }));

async function joinFromRequest(req, body, source) {
  waitlist.useHost(baseUrl(req));
  return waitlist.join({
    email: body.email,
    firstName: body.first_name || body.name,
    optIn: body.optin === 'on' || body.optin === true || body.optin === 'true',
    source,
    ref: body.ref || cookie(req, 'ref'),
    utm: utmFrom(req, body),
    ip: security.ip(req),
  });
}

// Pop-ups, talks and campus Wi-Fi put many real people behind one address, so the per-IP cap is loose
// and a per-email cap stops one address being hammered.
function waitlistLimit(req, res) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
  if (!limit(req, res, `waitlist:${security.ip(req)}`, 100, 60 * 60 * 1000, TOO_FAST)) return false;
  return !email || limit(req, res, `waitlist-email:${email}`, 5, 60 * 60 * 1000, TOO_FAST);
}
app.post('/founding', wrap(async (req, res) => {
  if (!waitlistLimit(req, res)) return;
  const r = await joinFromRequest(req, req.body, 'founding');
  if (r.error) return res.status(400).render('founding', { ...foundingPage(), error: r.error, form: req.body });
  if (!r.existing) track(req, 'Waitlist Join', { source: 'founding' });
  if (!PROD && !process.env.KLAVIYO_PRIVATE_KEY && !process.env.RESEND_API_KEY && r.confirmUrl) req.session.devConfirm = r.confirmUrl;
  res.redirect(`/founding/status?code=${r.entry.referralCode}&${r.existing ? 'back' : 'new'}=1`);
}));

// Shared endpoint for the quiz and Day One Stack pages: same waitlist logic, JSON in and out.
// Body: { email, first_name, optin, source: "quiz" | "stack", ref?, utm_* }
app.post('/api/waitlist', express.json({ limit: '10kb' }), wrap(async (req, res) => {
  if (!waitlistLimit(req, res)) return;
  const body = req.body || {};
  const source = waitlist.SOURCES.includes(body.source) ? body.source : 'other';
  const r = await joinFromRequest(req, body, source);
  if (r.error) return res.status(400).json({ error: r.error });
  res.json({ ok: true, existing: r.existing, referral_code: r.entry.referralCode, referral_link: waitlist.link(r.entry), status_url: `${baseUrl(req)}/founding/status?code=${r.entry.referralCode}` });
}));

app.get('/founding/confirm', wrap(async (req, res) => {
  if (!limit(req, res, `confirm:${security.ip(req)}`, 30, 60 * 60 * 1000, TOO_FAST)) return;
  const confirmed = await waitlist.confirm(req.query.token);
  const entry = confirmed && confirmed.entry;
  if (!entry) return res.status(400).render('404', { title: 'Link expired', error: true, message: 'That confirm link has expired or was already replaced. Join again with the same email to get a fresh one.' });
  if (confirmed.firstTime) track(req, 'Waitlist Confirm');
  req.session.devConfirm = null;
  res.redirect(`/founding/status?code=${entry.referralCode}&confirmed=1`);
}));

// Calendar reminder for doors opening, so people who didn't tick the box still know when to come back.
app.get('/links', (req, res) => res.render('links', { title: 'Links', description: 'Eli Christiansen: the founding list, the Founder Score, the Day One Stack, the free Idea Test and the Founder\'s Circle.' }));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /api\nDisallow: /billing\nDisallow: /founding/status\nDisallow: /founding/confirm\nDisallow: /stack/guide\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const pages = ['/', '/founding', '/pricing', '/circle', '/score', '/stack', '/idea-test', '/media-kit', '/links', '/terms', '/privacy'];
  if (process.env.MEMBERSHIP_TERMS_LIVE === 'true') pages.push('/membership-terms');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${baseUrl(req)}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
});

// Calendar file for the founding members' call (FOUNDING_CALL_AT, link FOUNDING_CALL_URL).
app.get('/founding/call.ics', (req, res) => {
  const at = launch.date('FOUNDING_CALL_AT');
  if (!at) return res.redirect('/app');
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const url = process.env.FOUNDING_CALL_URL || `${baseUrl(req)}/app`;
  res.type('text/calendar').set('content-disposition', 'attachment; filename="127-founding-call.ics"').send([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Founding//EN', 'BEGIN:VEVENT',
    `UID:founding-call-${at}@127group.io`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(at)}`, `DTEND:${f(at + 60 * 60 * 1000)}`,
    'SUMMARY:127 founding members call with Eli', `DESCRIPTION:Join here: ${url}`, `LOCATION:${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:127 founding call in 30 minutes', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n'));
});

app.get('/founding/doors-open.ics', (req, res) => {
  const at = launch.date('LAUNCH_AT');
  if (!at) return res.redirect('/founding');
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const url = `${baseUrl(req)}/pricing`;
  res.type('text/calendar').set('content-disposition', 'attachment; filename="127-doors-open.ics"').send([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Founding//EN', 'BEGIN:VEVENT',
    `UID:doors-open-${at}@127group.io`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(at)}`, `DTEND:${f(at + 30 * 60 * 1000)}`,
    'SUMMARY:127 doors open', `DESCRIPTION:Doors are open. Lock the founding price: ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:127 doors open in 15 minutes', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n'));
});

app.get('/founding/status', (req, res) => {
  const entry = waitlist.byCode(req.query.code);
  if (!entry) return res.redirect('/founding');
  res.render('founding-status', {
    title: "You're on the list",
    entry: { code: entry.referralCode, link: waitlist.link(entry), count: entry.referralCount || 0, confirmed: !!entry.confirmedAt, firstName: entry.firstName },
    q: req.query,
    devConfirm: !PROD && req.session.devConfirm ? req.session.devConfirm : null,
  });
});

// ---------- fast founding checkout (checkout.md section 1) ----------
function lockOpen() {
  const L = launch.view();
  return !!(L.foundingOpen && !L.prelaunch && L.foundingPrice);
}
function renderLock(req, res, extra = {}) {
  res.status(extra.error || extra.exists ? 400 : 200).render('founding-lock', {
    title: 'Lock the founding price',
    description: 'Create your 127 account and lock the founding Builder price.',
    error: null, exists: false, form: {}, cancelled: req.query.checkout === 'cancelled', grace: null, graceUntil: null,
    ...extra,
  });
}
// A founding grace link (R14) keeps the lock page usable for one email after the close.
const graceFrom = (token) => (token ? `/founding/lock?grace=${encodeURIComponent(token)}` : '/founding/lock');
app.get('/founding/lock', wrap(async (req, res) => {
  const token = req.query.grace ? String(req.query.grace) : null;
  const grace = token && billing.verifyGrace(token);
  if (!lockOpen() && !grace) return res.redirect('/pricing');
  const g = grace ? { grace: token, graceUntil: grace.until, form: { email: grace.email } } : {};
  if (req.user && req.user.tier !== 'free') {
    flash(req, 'info', "You're already in.");
    return res.redirect('/app/billing');
  }
  if (req.user && grace && req.user.email !== grace.email) {
    return renderLock(req, res, { ...g, error: `This founding link is for ${grace.email}. Sign out and sign in with that email to use it.` });
  }
  // Signed in and free: straight to Stripe, unless they just came back from it.
  if (req.user && req.query.checkout !== 'cancelled') return startCheckout(req, res, 'builder', graceFrom(grace && token), { grace: grace ? token : null });
  renderLock(req, res, g);
}));
app.post('/founding/lock', wrap(async (req, res) => {
  const token = req.body.grace ? String(req.body.grace) : null;
  const grace = token && billing.verifyGrace(token);
  if (!lockOpen() && !grace) return res.redirect('/pricing');
  if (req.user) return res.redirect(graceFrom(grace && token));
  if (!limit(req, res, `signup:${security.ip(req)}`, 5, 60 * 60 * 1000, TOO_FAST)) return;
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const name = String(req.body.name || '').trim().slice(0, 80);
  const password = String(req.body.password || '');
  const form = { email, name };
  const g = grace ? { grace: token, graceUntil: grace.until } : {};
  if (!name) return renderLock(req, res, { ...g, error: 'Please add your first name.', form });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return renderLock(req, res, { ...g, error: 'Please enter a valid email.', form });
  if (password.length < 8) return renderLock(req, res, { ...g, error: 'Use a password with at least 8 characters.', form });
  if (!lockOpen() && email !== grace.email) return renderLock(req, res, { ...g, error: `This founding link works for ${grace.email}. Use that email to continue.`, form });
  if (db.find('users', (u) => u.email === email)) return renderLock(req, res, { ...g, exists: true, form });
  await createMember(req, { email, name, password, optIn: false, source: 'founding-lock' });
  await startCheckout(req, res, 'builder', graceFrom(grace && token), { grace: grace ? token : null });
}));

// ---------- auth ----------
app.get('/login', (req, res) => res.render('login', { title: 'Sign in', error: null, notice: req.query.reset ? 'Password updated. Sign in with your new one.' : null, email: '', next: security.safeNext(req.query.next), layout: 'bare' }));
app.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const next = security.safeNext(req.body.next);
  if (!limit(req, res, `login-ip:${security.ip(req)}`, 30, 15 * 60 * 1000, TOO_FAST)) return;
  if (!limit(req, res, `login:${email}`, 8, 15 * 60 * 1000, TOO_FAST)) return;
  const user = db.find('users', (u) => u.email === email);
  const ok = user && (await bcrypt.compare(String(req.body.password || ''), user.passwordHash));
  if (!ok) return res.status(401).render('login', { title: 'Sign in', error: 'That email and password did not match.', notice: null, email, next, layout: 'bare' });
  req.session.uid = user.id;
  res.redirect(next);
}));

// ---------- email verification and password reset ----------
app.get('/verify', wrap(async (req, res) => {
  if (!limit(req, res, `verify:${security.ip(req)}`, 20, 60 * 60 * 1000, TOO_FAST)) return;
  const user = checkLink('verify', req.query);
  if (!user) {
    if (req.user) flash(req, 'error', 'That confirmation link has expired or was already used. Send a new one from your dashboard.');
    return res.redirect(req.user ? '/app' : '/login');
  }
  user.emailVerified = true;
  user.verifyHash = null;
  await db.save('users', user);
  req.session.devVerifyLink = null;
  integrations.emit('user.verified', { userId: user.id });
  if (req.user && req.user.id === user.id) {
    flash(req, 'win', 'Email confirmed. Your full Playbook messages are unlocked.');
    return res.redirect('/app');
  }
  res.redirect('/login?next=/app');
}));
app.post('/app/verify/resend', requireAuth, wrap(async (req, res) => {
  if (!req.user.emailVerified && security.allow(`resend:${req.user.id}`, 3, 60 * 60 * 1000)) {
    await sendEmailLink(req, req.user, 'verify');
    flash(req, 'info', `New confirmation link sent to ${req.user.email}.`);
  } else if (!req.user.emailVerified) {
    flash(req, 'info', 'We just sent one. Check your inbox and spam folder.');
  }
  res.redirect('/app');
}));
app.get('/forgot', (req, res) => res.render('forgot', { title: 'Reset password', sent: false, devLink: null, layout: 'bare' }));
app.post('/forgot', wrap(async (req, res) => {
  if (!limit(req, res, `forgot:${security.ip(req)}`, 5, 60 * 60 * 1000, TOO_FAST)) return;
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const user = db.find('users', (u) => u.email === email);
  let devLink = null;
  if (user && security.allow(`forgot-user:${user.id}`, 3, 60 * 60 * 1000)) devLink = await sendEmailLink(req, user, 'reset');
  // Same answer whether or not the email has an account.
  res.render('forgot', { title: 'Reset password', sent: true, devLink, layout: 'bare' });
}));
app.get('/reset', (req, res) => {
  const user = checkLink('reset', req.query);
  res.render('reset', { title: 'Choose a new password', ok: !!user, u: req.query.u, t: req.query.t, error: null, layout: 'bare' });
});
app.post('/reset', wrap(async (req, res) => {
  if (!limit(req, res, `reset:${security.ip(req)}`, 10, 60 * 60 * 1000, TOO_FAST)) return;
  const user = checkLink('reset', req.body);
  if (!user) return res.render('reset', { title: 'Choose a new password', ok: false, u: '', t: '', error: null, layout: 'bare' });
  const password = String(req.body.password || '');
  if (password.length < 8) return res.render('reset', { title: 'Choose a new password', ok: true, u: req.body.u, t: req.body.t, error: 'Use a password with at least 8 characters.', layout: 'bare' });
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetHash = null;
  // Opening the link proves they own the inbox.
  user.emailVerified = true;
  await db.save('users', user);
  req.session = null;
  res.redirect('/login?reset=1');
}));
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// ---------- member app ----------
app.get('/app', requireAuth, wrap(async (req, res, next) => {
  if (!req.query.session_id) return next();
  try {
    await billing.confirmCheckout(req.user, req.query.session_id);
  } catch (err) {
    console.warn('[billing] confirm checkout', err.message);
  }
  res.redirect(`/app?upgraded=${encodeURIComponent(String(req.query.upgraded || ''))}`);
}));
app.get('/app', requireAuth, (req, res) => {
  const user = req.user;
  if (!user.roadmap) return res.redirect('/start');
  if (req.query.upgraded && req.query.upgraded === user.tier && !req.query.demo) res.locals.trackEvents.push({ name: 'Upgrade', props: { plan: user.tier, founding: !!user.foundingPrice } });
  // Members who saw the founding bar get one dismissible line for 24 hours after it closes.
  let closedNotice = false;
  if (res.locals.builderOffer.founding && !user.foundingBarSeenAt) {
    user.foundingBarSeenAt = new Date().toISOString();
    db.save('users', user);
  } else if (!res.locals.builderOffer.founding && user.tier === 'free' && user.foundingBarSeenAt) {
    if (!user.foundingClosedSeenAt) {
      user.foundingClosedSeenAt = new Date().toISOString();
      db.save('users', user);
    }
    closedNotice = Date.now() - Date.parse(user.foundingClosedSeenAt) < 24 * 60 * 60 * 1000 && cookie(req, 'fbclosed') !== '1';
  }
  // Day 7 and Day 14 upgrade screens, after the founding window only, once each (in-app-founding-offer.md section 7).
  let upgradeScreen = null;
  const closesAt = res.locals.launch.closesAt;
  if (user.tier === 'free' && closesAt && Date.now() >= closesAt) {
    const days = Math.floor((Date.now() - Date.parse(user.createdAt)) / 864e5);
    const day = days >= 14 && days < 21 ? 14 : days >= 7 && days < 14 ? 7 : null;
    user.upgradeScreens = user.upgradeScreens || {};
    if (day && !user.upgradeScreens[`day${day}`]) {
      user.upgradeScreens[`day${day}`] = new Date().toISOString();
      db.save('users', user);
      const early = roadmap.allTasks({ weeks: user.roadmap.weeks.filter((w) => w.freeVisible) });
      const earlyDone = early.filter((t) => user.completed && user.completed[t.id]).length;
      upgradeScreen = {
        day,
        steps: progress(user).done,
        wins: db.filter('wins', (w) => w.userId === user.id).length,
        weeks12Pct: early.length ? Math.round((earlyDone / early.length) * 100) : 0,
      };
    }
  }
  const recommended = user.roadmap.weeks
    .flatMap((w) => w.tasks)
    .map((t) => t.resource)
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 3)
    .map((s) => bySlug[s]);
  res.render('app/dashboard', {
    title: 'Dashboard',
    q: req.query,
    upgraded: req.query.upgraded && req.query.upgraded === user.tier && PLANS[user.tier] ? PLANS[user.tier].name : null,
    progress: progress(user),
    next: nextTask(user),
    level: gamify.level(user.xp),
    badges: gamify.BADGES,
    recommended,
    wins: db.all('wins').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    aiLeft: aiRunsLeft(user),
    canAccess,
    bySlug,
    MILESTONES,
    closedNotice,
    upgradeScreen,
    // Founding upgrade alert: right after paying, or after the assessment that follows a fast founding checkout.
    foundingAlert: !!(user.foundingPrice && user.foundingNumber && user.tier === 'builder' && ((req.query.upgraded === 'builder') || req.query.welcome)),
  });
});

// Welcome after a founding payment (checkout.md section 4).
app.get('/app/welcome', requireAuth, wrap(async (req, res) => {
  if (req.query.session_id) {
    try {
      await billing.confirmCheckout(req.user, req.query.session_id);
    } catch (err) {
      console.warn('[billing] confirm checkout', err.message);
    }
    return res.redirect('/app/welcome?founding=1');
  }
  const user = req.user;
  if (user.tier === 'circle') return res.redirect('/app?upgraded=circle');
  if (user.tier === 'builder' && !user.foundingNumber) return res.redirect('/app?upgraded=builder');
  if (user.tier === 'builder' && req.query.founding && !req.query.demo) res.locals.trackEvents.push({ name: 'Upgrade', props: { plan: 'builder', founding: true } });
  res.render('app/welcome', { title: 'Welcome, founding member', pending: user.tier === 'free', demo: !!req.query.demo });
}));

// Progress map: members check off real-world milestones themselves.
app.post('/app/milestone/:id', requireAuth, wrap(async (req, res) => {
  const m = MILESTONES.find((x) => x.id === req.params.id && !x.auto);
  const user = req.user;
  if (m) {
    user.milestones = user.milestones || {};
    if (user.milestones[m.id]) {
      delete user.milestones[m.id];
      user.xp = Math.max(0, (user.xp || 0) - m.xp);
    } else {
      user.milestones[m.id] = new Date().toISOString();
      await addXp(user, m.xp);
      integrations.emit('milestone.reached', { userId: user.id, milestone: m.id });
      flash(req, 'win', `${m.label}. +${m.xp} XP. Share it on the wins board so it counts twice.`);
    }
    await db.save('users', user);
  }
  res.redirect('/app#progress');
}));

app.post('/app/task/:id', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  const task = roadmap.allTasks(user.roadmap).find((t) => t.id === req.params.id);
  if (!task) return res.redirect('/app');
  const week = user.roadmap.weeks.find((w) => w.tasks.includes(task));
  if (!week.freeVisible && !canAccess(user, 'builder')) return res.redirect('/app/billing');
  user.completed = user.completed || {};
  let justDone = false;
  if (user.completed[task.id]) {
    delete user.completed[task.id];
    user.xp = Math.max(0, (user.xp || 0) - task.xp);
  } else {
    user.completed[task.id] = new Date().toISOString();
    await addXp(user, task.xp);
    justDone = true;
  }
  const before = (user.badges || []).length;
  gamify.refreshBadges(user);
  if ((user.badges || []).length > before) flash(req, 'win', `Badge earned: ${gamify.BADGES[user.badges[user.badges.length - 1]].label}`);
  // Activation = the first roadmap step a member ever finishes.
  const firstEver = justDone && !user.activatedAt;
  // One-time toast after the first finished step (onboarding.md section 4).
  if (firstEver) flash(req, 'win', 'Step 1, done. Do more of what works.');
  if (firstEver) user.activatedAt = new Date().toISOString();
  await db.save('users', user);
  if (justDone) {
    const p = progress(user);
    integrations.emit('roadmap.step_completed', { userId: user.id, step_id: task.id, week: week.week, steps_done: p.done, steps_total: p.total });
  }
  if (firstEver) {
    integrations.emit('member.activated', { userId: user.id });
    track(req, 'Activation');
    track(req, 'Task Done', { first: 1 });
  }
  emitNewBadges(user, before);
  res.redirect(req.get('referer') && req.get('referer').includes('/app') ? req.get('referer').split('#')[0] + '#roadmap' : '/app#roadmap');
}));

app.get('/app/library', requireAuth, (req, res) => {
  const track = TRACK_NAMES[req.query.track] ? req.query.track : null;
  res.render('app/library', { title: 'Library', items: resources.filter((r) => !track || r.track === track), track, TRACK_NAMES, canAccess });
});

app.get('/app/library/:slug', requireAuth, (req, res) => {
  const r = bySlug[req.params.slug];
  if (!r) return res.status(404).render('404');
  res.render('app/resource', resourceLocals(req.user, r));
});

function resourceLocals(user, r, extra = {}) {
  return {
    title: r.title, r, TRACK_NAMES,
    locked: !canOpen(user, r),
    viaRoadmap: !canAccess(user, r.tier) && canOpen(user, r),
    done: !!(user.resourcesDone || {})[r.slug],
    saved: (user.worksheets || {})[r.slug] || {},
    feedback: (user.feedback || {})[r.slug] || null,
    aiLeft: aiRunsLeft(user),
    ...extra,
  };
}

function readWorksheet(r, body) {
  const values = {};
  for (const f of r.worksheet || []) values[f.id] = String(body[f.id] || '').slice(0, 3000);
  if (r.calc && body.__calc) values.__calc = String(body.__calc).slice(0, 4000);
  values.__updated = new Date().toISOString();
  return values;
}

app.post('/app/library/:slug/worksheet', requireAuth, wrap(async (req, res) => {
  const r = bySlug[req.params.slug];
  const user = req.user;
  if (!canOpen(user, r)) return res.redirect('/app/library');
  user.worksheets = user.worksheets || {};
  user.worksheets[r.slug] = readWorksheet(r, req.body);
  await db.save('users', user);
  flash(req, 'win', 'Saved. Your answers stay here whenever you come back.');
  res.redirect(`/app/library/${r.slug}#worksheet`);
}));

app.post('/app/library/:slug/feedback', requireAuth, wrap(async (req, res) => {
  const r = bySlug[req.params.slug];
  const user = req.user;
  if (!canOpen(user, r)) return res.redirect('/app/library');
  user.worksheets = user.worksheets || {};
  user.worksheets[r.slug] = readWorksheet(r, req.body);
  await db.save('users', user);
  if (!reserveAi(req, res, user, `/app/library/${r.slug}#worksheet`)) return;
  const result = await ai.review(r, user.worksheets[r.slug], user);
  if (result.error) refundAi(user);
  else {
    user.feedback = user.feedback || {};
    user.feedback[r.slug] = { text: result.text, demo: !!result.demo, at: new Date().toISOString() };
  }
  await db.save('users', user);
  if (result.error) flash(req, 'error', result.text);
  res.redirect(`/app/library/${r.slug}#feedback`);
}));

app.post('/app/library/:slug/done', requireAuth, wrap(async (req, res) => {
  const r = bySlug[req.params.slug];
  const user = req.user;
  if (!canOpen(user, r)) return res.redirect('/app/library');
  user.resourcesDone = user.resourcesDone || {};
  if (!user.resourcesDone[r.slug]) {
    user.resourcesDone[r.slug] = new Date().toISOString();
    await addXp(user, 30);
    await db.save('users', user);
    flash(req, 'win', `+30 XP. Nice work finishing ${r.title}.`);
  }
  res.redirect(`/app/library/${r.slug}`);
}));

app.get('/app/tools', requireAuth, (req, res) => {
  res.render('app/tools', { title: 'AI tools', tools: ai.TOOLS, aiLeft: aiRunsLeft(req.user), canAccess, history: (req.user.aiHistory || []).slice(0, 8) });
});

app.get('/app/tools/:slug', requireAuth, (req, res) => {
  const tool = ai.TOOLS.find((t) => t.slug === req.params.slug);
  if (!tool) return res.status(404).render('404');
  const locked = !canAccess(req.user, tool.tier);
  if (tool.chat) return res.render('app/chat', { title: tool.name, tool, chat: req.user.chat || [], locked, aiLeft: aiRunsLeft(req.user) });
  const saved = req.query.h && (req.user.aiHistory || []).find((h) => h.id === req.query.h && h.tool === tool.slug);
  res.render('app/tool', { title: tool.name, tool, result: saved ? { text: saved.text, demo: saved.demo } : null, input: saved ? saved.input : {}, locked, aiLeft: aiRunsLeft(req.user), history: (req.user.aiHistory || []).filter((h) => h.tool === tool.slug).slice(0, 5) });
});

// The run is counted before the AI call, so parallel requests can't slip past the monthly limit.
// It is handed back if the call fails.
function reserveAi(req, res, user, back) {
  if (!security.allow(`ai:${user.id}`, 12, 5 * 60 * 1000)) {
    flash(req, 'info', 'That was a lot of messages in a few minutes. Give it a moment, then try again.');
    res.redirect(back);
    return false;
  }
  if (aiRunsLeft(user) <= 0) {
    // Klaviyo "Hit Free Limit": once per member per month, only for the real plan limit.
    if (user.emailVerified && user.tier === 'free' && user.limitHitMonth !== monthKey()) {
      user.limitHitMonth = monthKey();
      db.save('users', user);
      const d = new Date();
      const resets = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
      integrations.emit('ai.limit_hit', { userId: user.id, limit_type: 'messages', resets_on: resets });
    }
    // Free members see the upgrade panel on the page instead (partials/limit-offer).
    if (!(user.emailVerified && user.tier === 'free')) {
      flash(req, 'info', user.emailVerified
        ? "You've used this month's Playbook messages. Upgrade for more, or they reset on the 1st."
        : `Confirm your email to keep going. We sent a link to ${user.email}.`);
    }
    res.redirect(back);
    return false;
  }
  user.aiUsage = user.aiUsage && user.aiUsage.month === monthKey() ? user.aiUsage : { month: monthKey(), count: 0 };
  user.aiUsage.count += 1;
  return true;
}
function refundAi(user) {
  if (user.aiUsage && user.aiUsage.count > 0) user.aiUsage.count -= 1;
}

app.post('/app/tools/ask/clear', requireAuth, wrap(async (req, res) => {
  req.user.chat = [];
  await db.save('users', req.user);
  res.redirect('/app/tools/ask');
}));

app.post('/app/tools/:slug', requireAuth, wrap(async (req, res) => {
  const tool = ai.TOOLS.find((t) => t.slug === req.params.slug);
  const user = req.user;
  if (!tool) return res.status(404).render('404');
  if (!canAccess(user, tool.tier)) return res.redirect(`/app/tools/${tool.slug}`);
  if (tool.chat) {
    const text = String(req.body.message || '').trim().slice(0, 2000);
    if (!text) return res.redirect('/app/tools/ask');
    if (!reserveAi(req, res, user, '/app/tools/ask')) return;
    user.chat = (user.chat || []).concat({ role: 'user', content: text, at: new Date().toISOString() });
    const result = await ai.chat(user.chat, user);
    if (result.error) {
      user.chat.pop();
      refundAi(user);
      flash(req, 'error', result.text);
    } else {
      user.chat.push({ role: 'assistant', content: result.text, demo: !!result.demo, at: new Date().toISOString() });
      user.chat = user.chat.slice(-40);
    }
    await db.save('users', user);
    return res.redirect('/app/tools/ask#latest');
  }
  const input = Object.fromEntries(tool.fields.map((f) => [f.name, String(req.body[f.name] || '').slice(0, 2000)]));
  if (!reserveAi(req, res, user, `/app/tools/${tool.slug}`)) return;
  const result = await ai.run(tool, input, user);
  if (result.error) {
    refundAi(user);
    await db.save('users', user);
    flash(req, 'error', result.text);
    return res.render('app/tool', { title: tool.name, tool, result: null, input, locked: false, aiLeft: aiRunsLeft(user), history: (user.aiHistory || []).filter((h) => h.tool === tool.slug).slice(0, 5) });
  }
  const entry = { id: db.id(), tool: tool.slug, input, text: result.text, demo: !!result.demo, at: new Date().toISOString() };
  user.aiHistory = [entry].concat(user.aiHistory || []).slice(0, 30);
  await db.save('users', user);
  res.redirect(`/app/tools/${tool.slug}?h=${entry.id}#result`);
}));

app.get('/app/wins', requireAuth, (req, res) => {
  res.render('app/wins', { title: 'Wins', wins: db.all('wins').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50), canPost: true });
});

app.post('/app/wins', requireAuth, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (text.length < 3) return res.redirect('/app/wins');
  const user = req.user;
  const firstName = (user.name || 'A member').split(' ')[0];
  const win = await db.save('wins', { userId: user.id, name: firstName, text, tier: user.tier });
  await addXp(user, 15);
  const badgesBefore = (user.badges || []).length;
  const isNew = gamify.award(user, 'first_win');
  await db.save('users', user);
  integrations.emit('win.posted', { userId: user.id, win_id: win.id, text });
  emitNewBadges(user, badgesBefore);
  flash(req, 'win', isNew ? 'Badge earned: First win shared' : 'Posted. Keep building.');
  res.redirect('/app/wins');
}));

app.post('/app/wins/:id/delete', requireAuth, wrap(async (req, res) => {
  const win = db.get('wins', req.params.id);
  if (win && (win.userId === req.user.id || isAdmin(req.user))) await db.remove('wins', win.id);
  res.redirect('/app/wins');
}));

app.get('/app/circle', requireAuth, (req, res) => {
  const application = db.find('applications', (a) => a.userId === req.user.id);
  res.render('app/circle', {
    title: "Founder's Circle",
    application,
    callUrl: process.env.CIRCLE_CALL_URL || null,
    communityUrl: process.env.CIRCLE_COMMUNITY_URL || null,
    callTime: process.env.CIRCLE_CALL_TIME || 'Weekly, day and time shared on acceptance',
  });
});

app.post('/app/circle/apply', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  if (db.find('applications', (a) => a.userId === user.id)) return res.redirect('/app/circle');
  const f = (k) => String(req.body[k] || '').trim().slice(0, 1500);
  const app_ = await db.save('applications', {
    userId: user.id,
    email: user.email,
    name: user.name,
    business: f('business'),
    revenue: f('revenue'),
    challenge: f('challenge'),
    commitment: f('commitment'),
    link: security.isHttpUrl(f('link')) ? f('link').slice(0, 300) : '',
    status: 'pending',
  });
  integrations.emit('circle.applied', { applicationId: app_.id, email: user.email, name: user.name });
  if (ADMIN_EMAILS[0]) integrations.sendEmail({ to: ADMIN_EMAILS[0], subject: `New Founder's Circle application: ${user.name || user.email}`, text: `${user.name} <${user.email}>\n\nBusiness: ${app_.business}\nRevenue: ${app_.revenue}\nChallenge: ${app_.challenge}\n\nReview it at /admin` });
  flash(req, 'win', "Application received. You'll hear back by email.");
  res.redirect('/app/circle');
}));

app.get('/app/billing', requireAuth, (req, res) => {
  const application = db.find('applications', (a) => a.userId === req.user.id);
  const user = req.user;
  // 14 days to change your mind: Builder only, from the first paid charge (unknown = still show it).
  const refundAsk = user.tier === 'builder' && !user.demoBilling && (!user.firstPaidAt || Date.now() - Date.parse(user.firstPaidAt) < 14 * 864e5);
  if (req.query.cancelled) res.locals.trackEvents.push({ name: 'Cancel', props: { plan: (user.cancellations || []).slice(-1).map((c) => c.plan)[0] || user.tier } });
  const lastCancel = (user.cancellations || []).slice(-1)[0];
  res.render('app/billing', { title: 'Membership', application, refundAsk, justCancelled: !!req.query.cancelled, askReason: !!req.query.cancelled && !!lastCancel && !lastCancel.reason, CANCEL_REASONS });
});

// Where the member started a checkout from; Stripe's cancel link brings them back there.
function checkoutFrom(req) {
  let p = req.body && req.body.from;
  if (!p && req.get('referer')) {
    try {
      const u = new URL(req.get('referer'));
      if (u.host === req.get('host')) p = u.pathname;
    } catch {
      p = null;
    }
  }
  p = security.safeNext(p, '/app/billing').split(/[?#]/)[0];
  return /^\/app(\/|$)/.test(p) || p === '/founding/lock' ? p : '/app/billing';
}

app.post('/app/billing/checkout/:tier', requireAuth, wrap(async (req, res) => {
  const tier = req.params.tier;
  if (!['builder', 'circle'].includes(tier)) return res.redirect('/app/billing');
  if (tier === 'circle') {
    const application = db.find('applications', (a) => a.userId === req.user.id);
    if (!application || application.status !== 'approved') return res.redirect('/app/circle');
    if (req.user.tier !== 'circle' && circleSeatsLeft(req.user.id) <= 0) {
      flash(req, 'info', 'The Circle is full right now. You are first in line for the next seat.');
      return res.redirect('/app/circle');
    }
    // Builder members move up on their saved card without Stripe Checkout, so they confirm
    // and tick the box here first (Membership Terms, Appendix A3).
    if (req.user.tier === 'builder') {
      if (req.body.agree !== 'on') return res.redirect('/app/billing/confirm/circle');
      req.user.consents = [...(req.user.consents || []), {
        kind: 'upgrade', plan: 'circle', at: new Date().toISOString(), box: true,
        terms_version: billing.TERMS_VERSION, disclosure_version: 'circle-a3-2026-10-16', ip_hash: security.hash(security.ip(req)),
      }].slice(-50);
      // lib/billing-records.js keeps this field.
      req.user.checkoutConsent = {
        at: new Date().toISOString(), version: billing.TERMS_VERSION, plan: 'circle',
        text: `I agree to the Founder's Circle Member Agreement and the Membership Terms, and I understand the Circle renews automatically every month at $${PLANS.circle.price} plus tax until I cancel.`,
      };
      await db.save('users', req.user);
    }
  }
  if (req.user.tier === tier) return res.redirect('/app/billing');
  const grace = tier === 'builder' && req.body.grace ? String(req.body.grace) : null;
  await startCheckout(req, res, tier, grace ? graceFrom(grace) : checkoutFrom(req), { grace });
}));

// Win-back month: the signed one-time link from the J2 email (billing.winbackProfile).
app.get('/winback', requireAuth, wrap(async (req, res) => {
  if (String(req.query.u || '') !== req.user.id || !billing.verifyWinback(req.user.id, req.query.t)) {
    flash(req, 'info', "That link belongs to a different account. Sign in with the email it was sent to.");
    return res.redirect('/app/billing');
  }
  if (!billing.winbackEligible(req.user)) {
    flash(req, 'info', `This offer isn't available on your account. Builder is $${PLANS.builder.price} a month whenever you're ready.`);
    return res.redirect('/app/billing');
  }
  await startCheckout(req, res, 'builder', '/app/billing', { winback: true });
}));

app.get('/app/billing/confirm/circle', requireAuth, wrap(async (req, res) => {
  const application = db.find('applications', (a) => a.userId === req.user.id);
  if (req.user.tier !== 'builder' || !application || application.status !== 'approved') return res.redirect('/app/circle');
  let preview = null;
  try {
    preview = await billing.previewUpgrade(req.user, 'circle');
  } catch (err) {
    console.warn('[billing] upgrade preview', err.type || '', err.message);
  }
  res.render('app/confirm-circle', { title: "Confirm your Founder's Circle seat", preview, foundingKept: billing.foundingKept(req.user) });
}));

async function startCheckout(req, res, tier, from, opts = {}) {
  const price = tier === 'circle' ? PLANS.circle.price : billing.foundingKept(req.user) ? launch.view().foundingPrice || res.locals.builderOffer.price : res.locals.builderOffer.price;
  track(req, 'Checkout Start', { plan: tier, price, from });
  try {
    if (tier === 'circle') {
      req.user.circleHoldUntil = Date.now() + 30 * 60 * 1000;
      await db.save('users', req.user);
    }
    res.redirect(303, await billing.checkoutUrl(req, req.user, tier, { ...opts, from, ipHash: security.hash(security.ip(req)) }));
  } catch (err) {
    if (err instanceof billing.BillingUnavailable) {
      console.warn('[billing]', err.message);
      flash(req, 'info', "Payments aren't switched on yet. Check back soon.");
      return res.redirect('/app/billing');
    }
    // Stripe errors (network, declined upgrade setup, bad config): tell the member, log for us.
    if (!err.type || !String(err.type).startsWith('Stripe')) throw err;
    console.error('[billing] checkout failed', err.type, err.code || '', err.message);
    flash(req, 'error', "We couldn't reach our payment provider. Nothing was charged. Please try again in a minute.");
    res.redirect('/app/billing');
  }
}

// ---------- cancel (offer.md section 8, Membership Terms section 10 and Appendix C) ----------
// Reason first (research R18), always optional: a chip only changes which save option shows
// beside Cancel. Cancel is on the same screen whether or not a reason is picked.
const CANCEL_REASONS = [
  ['price', 'Too expensive right now'],
  ['unused', 'Not using it'],
  ['busy', 'Exams or a busy stretch'],
  ['job', 'Got a job'],
  ['done', 'Got what I needed'],
  ['other', 'Something else'],
];
// Pause needs the start deferred to the end of the paid month, which the current Stripe calls
// can't do safely, so it isn't offered yet (README, "Turn on payments").
const PAUSE_AVAILABLE = false;

app.get('/app/billing/cancel', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  if (user.tier === 'free') return res.redirect('/app/billing');
  try {
    await billing.refreshSubscription(user);
  } catch (err) {
    console.warn('[billing] refresh before cancel', err.message);
  }
  if (user.cancelAt) return res.redirect('/app/billing');
  const reason = CANCEL_REASONS.some((r) => r[0] === req.query.reason) ? req.query.reason : null;
  const entry = launch.onWaitlist(user.email);
  res.render('app/cancel', {
    title: 'Cancel', accessEnds: fmtDate(user.periodEnd), pauseAvailable: PAUSE_AVAILABLE, foundingKept: billing.foundingKept(user),
    CANCEL_REASONS, reason, referralLink: entry ? waitlist.link(entry) : null,
  });
}));

app.post('/app/billing/cancel', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  const was = user.tier;
  if (was === 'free') return res.redirect('/app/billing');
  const intent = req.body.intent === 'switch_free' ? 'switch_free' : 'cancel';
  const reason = CANCEL_REASONS.some((r) => r[0] === req.body.reason) ? req.body.reason : null;
  try {
    await billing.cancelAtPeriodEnd(user);
  } catch (err) {
    if (!(err instanceof billing.BillingUnavailable) && (!err.type || !String(err.type).startsWith('Stripe'))) throw err;
    console.error('[billing] cancel failed', err.type || '', err.message);
    flash(req, 'error', 'We couldn\'t cancel online just now. Try again in a minute, or email "Cancel" to hello@127group.io and we\'ll do it within 2 business days.');
    return res.redirect('/app/billing');
  }
  // Record of the cancellation (Membership Terms, Appendix D).
  user.cancellations = [...(user.cancellations || []), { at: new Date().toISOString(), plan: was, intent, reason, access_ends: user.cancelAt || null, ip_hash: security.hash(security.ip(req)) }].slice(-20);
  await db.save('users', user);
  res.redirect('/app/billing?cancelled=1');
}));

app.post('/app/billing/cancel/reason', requireAuth, wrap(async (req, res) => {
  const last = (req.user.cancellations || []).slice(-1)[0];
  const reason = CANCEL_REASONS.find((r) => r[0] === req.body.reason);
  if (last && reason) {
    last.reason = reason[0];
    await db.save('users', req.user);
    integrations.emit('subscription.cancel_reason', { userId: req.user.id, plan: last.plan, reason: reason[0] });
  }
  flash(req, 'info', 'Thanks for telling us.');
  res.redirect('/app/billing');
}));

app.post('/app/billing/resume', requireAuth, wrap(async (req, res) => {
  try {
    if (await billing.resumeSubscription(req.user)) {
      flash(req, 'win', `You're staying. Nothing changes and there's no new charge.${req.user.foundingPrice ? ' Your founding price stays too.' : ''}`);
    }
  } catch (err) {
    if (!err.type || !String(err.type).startsWith('Stripe')) throw err;
    console.error('[billing] resume failed', err.type, err.message);
    flash(req, 'error', "We couldn't reach our payment provider. Please try again in a minute.");
  }
  res.redirect('/app/billing');
}));

app.post('/app/billing/portal', requireAuth, wrap(async (req, res) => {
  let url = null;
  try {
    url = await billing.portalUrl(req, req.user);
  } catch (err) {
    if (!err.type || !String(err.type).startsWith('Stripe')) throw err;
    console.error('[billing] portal failed', err.type, err.message);
    flash(req, 'error', "We couldn't open billing right now. Please try again in a minute, or email hello@127group.io.");
    return res.redirect('/app/billing');
  }
  if (url) return res.redirect(303, url);
  // Demo billing only: let testers go back to Free.
  if (billing.isDemo() && req.user.tier !== 'free') {
    await billing.setTier(req.user, 'free');
    flash(req, 'info', 'Demo mode: plan set back to Free.');
  }
  res.redirect('/app/billing');
}));

app.get('/app/settings', requireAuth, wrap(async (req, res) => {
  // The delete screen offers "Cancel instead" with the date access would end (Appendix C6).
  if (req.user.tier !== 'free') {
    try {
      await billing.refreshSubscription(req.user);
    } catch (err) {
      console.warn('[billing] refresh for settings', err.message);
    }
  }
  res.render('app/settings', { title: 'Settings', saved: req.query.saved });
}));
app.post('/app/settings', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  user.name = String(req.body.name || '').trim().slice(0, 80);
  const optIn = req.body.optin === 'on';
  if (optIn !== !!user.marketingOptIn) integrations.syncConsent(user.email, optIn);
  user.marketingOptIn = optIn;
  await db.save('users', user);
  integrations.emit('profile.updated', { userId: user.id });
  res.redirect('/app/settings?saved=1');
}));
app.post('/app/settings/delete', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  try {
    await billing.cancelFor(user);
  } catch {
    flash(req, 'error', "We couldn't cancel your subscription automatically, so your account wasn't deleted. Email hello@127group.io and we'll sort it out today.");
    return res.redirect('/app/settings');
  }
  integrations.forget(user.email);
  await billingRecords.retainOnDelete(user);
  await db.purgeEvents(user.id, user.email);
  for (const w of db.filter('wins', (w) => w.userId === user.id)) await db.remove('wins', w.id);
  for (const a of db.filter('applications', (a) => a.userId === user.id)) await db.remove('applications', a.id);
  await db.remove('users', user.id);
  req.session = null;
  res.redirect('/?deleted=1');
}));

// ---------- admin ----------
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const users = db.all('users').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tierCounts = { free: 0, builder: 0, circle: 0 };
  users.forEach((u) => (tierCounts[u.tier] = (tierCounts[u.tier] || 0) + 1));
  const activated = users.filter((u) => u.completed && Object.keys(u.completed).length > 0).length;
  // Revenue only counts members on a real Stripe subscription, not demo upgrades.
  const mrr = users.filter((u) => !u.demoBilling && u.stripeSubscriptionId).reduce((sum, u) => sum + (PLANS[u.tier] ? PLANS[u.tier].price : 0), 0);
  const dist = {};
  for (const q of onboarding.questions.filter((q) => q.type !== 'text')) {
    dist[q.id] = { question: q.question, counts: {} };
    for (const o of q.options) dist[q.id].counts[o.label] = 0;
    for (const u of users) {
      const v = [].concat((u.answers || {})[q.id] || []);
      for (const val of v) {
        const opt = q.options.find((o) => o.value === val);
        if (opt) dist[q.id].counts[opt.label] += 1;
      }
    }
  }
  res.render('admin/index', {
    title: 'Admin',
    seenIp: security.ip(req),
    forwardedFor: req.get('x-forwarded-for') || null,
    users,
    tierCounts,
    activated,
    mrr,
    dist,
    applications: db.all('applications').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    integrations: integrations.status(),
    onboarding,
    wl: waitlist.stats(),
  });
});

app.post('/admin/applications/:id/:action', requireAuth, requireAdmin, wrap(async (req, res) => {
  const a = db.get('applications', req.params.id);
  if (a && ['approved', 'declined', 'pending'].includes(req.params.action)) {
    a.status = req.params.action;
    await db.save('applications', a);
    if (a.status === 'approved') {
      integrations.emit('circle.approved', { applicationId: a.id, email: a.email });
      integrations.sendEmail({ to: a.email, subject: "You're in: Founder's Circle", text: `Your application was accepted. Claim your seat here: ${process.env.BASE_URL || 'https://127group.io'}/app/circle` });
    }
  }
  res.redirect('/admin#applications');
}));

// Founding grace link (R14): support checks the member's checkout broke before the close, then sends this.
app.post('/admin/grace', requireAuth, requireAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const token = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && billing.graceToken(email);
  if (!token) flash(req, 'error', 'Enter a valid email. FOUNDING_CLOSES_AT must be set.');
  else flash(req, 'info', `Founding link for ${email} (works once, until ${fmtDate(billing.graceUntil() - 60000)}, 11:59pm ET): ${baseUrl(req)}/founding/lock?grace=${token}`);
  res.redirect('/admin#grace');
});

app.get('/admin/export.csv', requireAuth, requireAdmin, (req, res) => {
  const qs = onboarding.questions.map((q) => q.id);
  const esc = (v) => {
    let t = String(v == null ? '' : Array.isArray(v) ? v.join('; ') : v);
    // Stop spreadsheets from running member-typed text as a formula.
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const rows = [['email', 'name', 'tier', 'created', 'xp', 'steps_done', 'track', ...qs].map(esc).join(',')];
  for (const u of db.all('users')) {
    rows.push([u.email, u.name, u.tier, u.createdAt, u.xp || 0, Object.keys(u.completed || {}).length, u.roadmap && u.roadmap.track, ...qs.map((k) => (u.answers || {})[k])].map(esc).join(','));
  }
  res.set('content-type', 'text/csv').set('content-disposition', 'attachment; filename="127-members.csv"').send(rows.join('\n'));
});

// Founder Score (/score), Day One Stack (/stack) and the free Idea Test (/idea-test).
app.use(require('./lib/funnels')({ requireAuth, requireAdmin }));

app.get('/admin/waitlist.csv', requireAuth, requireAdmin, (req, res) => {
  const esc = (v) => {
    let t = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const rows = [['email', 'first_name', 'joined', 'confirmed', 'source', 'utm_source', 'utm_campaign', 'referral_code', 'referred_by', 'referral_count', 'email_opt_in', 'flagged'].map(esc).join(',')];
  for (const w of db.all('waitlist')) {
    rows.push([w.email, w.firstName, w.createdAt, w.confirmedAt || '', w.source, w.utm && w.utm.utm_source, w.utm && w.utm.utm_campaign, w.referralCode, w.referredBy || '', w.referralCount || 0, w.marketingOptIn ? 'yes' : 'no', w.flagged ? 'check' : ''].map(esc).join(','));
  }
  res.set('content-type', 'text/csv').set('content-disposition', 'attachment; filename="127-waitlist.csv"').send(rows.join('\n'));
});

// ---------- errors ----------
app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('404', { title: 'Something went wrong', error: true });
});

db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`127 running on http://localhost:${PORT}`));
  if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) require('./lib/reminders').start();
});
