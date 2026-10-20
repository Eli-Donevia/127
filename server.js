require('./lib/env').load();
// Without SESSION_SECRET, sessions and every signed link (grace, win-back, challenge pages, member ops) use a
// random per-process secret instead of a fixed, guessable one. They stop working on restart; set the Secret.
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
  console.warn('[config] SESSION_SECRET is not set: using a random one, so sign-ins and signed links end on every restart.');
}

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
const adConsent = require('./lib/ad-consent');
const launch = require('./lib/launch');
const waitlist = require('./lib/waitlist');
const utmLib = require('./lib/utm');
const billingRecords = require('./lib/billing-records');
const legalDates = require('./lib/legal-date');
const circle = require('./lib/circle');
const markdown = require('./lib/markdown');
const challenge = require('./lib/challenge');
const memberOps = require('./lib/member-ops');
const ageCheck = require('./lib/age-check');
const { MILESTONES } = require('./lib/milestones');
const templates = require('./lib/templates');
const builderMap = require('./lib/builder-map');
const hq = require('./lib/hq');
const hqRoutes = require('./lib/hq-routes');
const hqHarness = require('./lib/hq-harness');
const harness = require('./lib/harness');
const harnessRoutes = require('./lib/harness/routes');
const foundingFive = require('./lib/founding-five');
const foundingFiveRoutes = require('./lib/founding-five-routes');
const onboarding = require('./content/onboarding.json');
const { resources } = require('./content/resources.json');

const PROD = process.env.NODE_ENV === 'production';
// A guessable session secret would let anyone forge a login, so production refuses to start without a real one.
if (PROD && (process.env.SESSION_SECRET || '').length < 32) {
  console.error('[config] SESSION_SECRET must be set to a random string of at least 32 characters in production.');
  process.exit(1);
}

// Links that normally go by email (verify, reset, waitlist confirm) are shown on screen only when a developer
// opts in with SHOW_DEV_LINKS=true on a non-production run. Never inferred from a missing NODE_ENV: on a deploy
// that lost its Secrets, an on-screen reset link would let anyone take over an account.
const DEV_LINKS = !PROD && process.env.SHOW_DEV_LINKS === 'true';

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
// 127 HQ inbound (lib/hq-routes.js): a member's 127 link and their Shopify order webhooks. Raw body for
// Shopify's signature, and ahead of the session so it never reads or sets a cookie. 404 while HQ_LIVE is off.
app.all('/hq/in/:token', hqRoutes.inbound);
// 127 inside Claude and ChatGPT (lib/hq-harness.js): the member's AI link. 404 unless HQ_HARNESS=true.
app.all('/hq/ai/:token', hqRoutes.ai);

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
// Members heartbeat API (lib/member-ops.js): GET /ops/feed, POST /ops/drafts, POST /ops/notes.
// Bearer OPS_FEED_TOKEN only (404 without it), mounted before the session so it never reads or sets cookies.
app.use('/ops', memberOps.api({ feedApp: () => opsFeedApp(), circleFeed: () => circleFeedData(), attendance: (u) => (u.tier === 'circle' || circle.isFormer(u) ? circle.historyFor(circleCtx(), u.id) : []) }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(
  cookieSession({
    name: 'h127',
    secret: process.env.SESSION_SECRET,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    httpOnly: true,
    secure: PROD,
  })
);

// ---------- helpers ----------
const bySlug = Object.fromEntries(resources.map((r) => [r.slug, r]));
const TRACK_NAMES = { start: 'Start', build: 'Build', grow: 'Grow' };

// The "Last updated" date on the legal pages: the day the site was published (LEGAL_EFFECTIVE_DATE, YYYY-MM-DD).
// HQ keeps the same date with a member's Terms OK (lib/legal-date.js).
const legalEffectiveDate = legalDates.legalDateText;

function currentUser(req) {
  return req.session && req.session.uid ? db.get('users', req.session.uid) : null;
}
// Admin needs a verified email, so nobody can claim the admin address by signing up with it first.
function isAdmin(user) {
  return !!user && !!user.emailVerified && ADMIN_EMAILS.includes(user.email);
}
// Approved applicants who are mid-checkout hold a seat for 30 minutes so the Circle can't be overbooked.
// A seat offered to an approved applicant (the 72-hour claim window, lib/circle.js) is held too.
function circleSeatsLeft(exceptUserId) {
  const taken = circle.seatHolders(circleCtx(), exceptUserId).size;
  return Math.max(0, CIRCLE_CAPACITY - taken);
}
function circleCtx(extra = {}) {
  return circle.ctx({ capacity: CIRCLE_CAPACITY, admin: ADMIN_EMAILS[0] || null, ...extra });
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
  // Age review (Legal L42): AI chats and posting paused, message in the app header.
  res.locals.ageReview = ageCheck.underReview(user);
  res.locals.agePauseMessage = ageCheck.PAUSE_MESSAGE;
  // Legal's exact AI disclosure (lib/ai.js), on the AI tools page and at the start of every chat.
  res.locals.aiDisclosure = ai.DISCLOSURE;
  // Pause (offer.md section 8): scheduled or in effect.
  res.locals.pauseInfo = user ? pauseInfo(user) : null;
  // For the members heartbeat: at most once an hour, fire and forget.
  if (user && (!user.lastSeenAt || Date.now() - Date.parse(user.lastSeenAt) > 60 * 60 * 1000)) {
    user.lastSeenAt = new Date().toISOString();
    Promise.resolve(db.save('users', user)).catch(() => {});
  }
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
  res.locals.devVerifyLink = DEV_LINKS && req.session.devVerifyLink ? req.session.devVerifyLink : null;
  res.locals.launch = launch.view();
  // First 25 on real business data (defined with the homepage route): the footer links it, the hero and bio page lead with it.
  res.locals.first25Live = first25Live();
  res.locals.consentCopy = consent.copy;
  res.locals.legalEffectiveDate = legalEffectiveDate();
  res.locals.adConsentScript = adConsent.configScript(req);
  res.locals.builderOffer = builderOffer(req, user, res.locals.launch);
  res.locals.fmtDate = fmtDate;
  // Templates for a roadmap step or a playbook (content/templates/manifest.json).
  res.locals.tplForTask = templates.forTask;
  res.locals.tplCanOpen = templates.canOpen;
  res.locals.tplForPlaybook = templates.forPlaybook;
  res.locals.tplKinds = templates.KINDS;
  res.locals.canAccess = canAccess;
  // 127 HQ (lib/hq.js): the nav item and the dashboard card show while HQ_LIVE=true (HQ_LIVE=admins: admins only),
  // and for the members HQ v2 is on for (lib/harness, HARNESS_V2).
  res.locals.hqLive = hq.liveFor(user) || harness.enabledFor(user);
  // Back from Stripe Checkout without paying.
  res.locals.checkoutCancelled = req.query.checkout === 'cancelled';
  res.locals.baseUrl = baseUrl(req);
  res.locals.canonical = baseUrl(req) + req.path;
  res.locals.description = null;
  // Plausible goals queued by the server (signup, upgrade...) fire on the next page view.
  res.locals.trackEvents = req.session.track || [];
  req.session.track = null;
  if (res.locals.checkoutCancelled) res.locals.trackEvents.push({ name: 'Checkout Cancelled', props: null });
  // Keep the first ad and referral source a visitor arrives with (30-day session) for the waitlist and signup records.
  // utm_source/medium/campaign/content/term; fbclid and ttclid only as a "1" flag (lib/utm.js).
  const utm = utmLib.present(req.query);
  if (Object.keys(utm).length && !req.session.utm) req.session.utm = utm;
  if (req.query.ref && waitlist.byCode(req.query.ref)) setRefCookie(res, String(req.query.ref).toUpperCase());
  next();
});

// What every upgrade card, paywall and the founding bar say (in-app-founding-offer.md).
// During the founding window, free founding-eligible members see the founding price from day one (checkout applies it too).
function builderOffer(req, user, L) {
  const founding = !!(user && user.tier === 'free' && !user.pausedTier && L.foundingOpen && L.foundingPrice && launch.isFoundingMember(user));
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
// A pause the member asked for that hasn't ended: { paused, startsAt, resumesAt } (ISO).
function pauseInfo(user) {
  const p = user.pause;
  if (!p || p.endedAt) return null;
  return { paused: !!user.pausedTier, startsAt: p.scheduledFor, resumesAt: p.resumesAt, tier: user.pausedTier || p.tier || 'builder' };
}
function fmtDate(isoOrMs) {
  if (!isoOrMs) return null;
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : null;
}

// Day One Challenge (lib/challenge-routes.js): /challenge, /dayone, /early, /admin/challenge,
// cross-promo locals, and carry-over on /app. Mounted here so it runs after req.user is set.
require('./lib/challenge-routes')(app, { requireAuth, requireAdmin });

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
    if (DEV_LINKS && !process.env.RESEND_API_KEY) req.session.devVerifyLink = link;
  } else {
    integrations.sendEmail({ to: user.email, subject: 'Reset your 127 password', text: `Someone asked to reset the password for this email. If it was you, choose a new one here:\n\n${link}\n\nThis link works for 1 hour. If it wasn't you, ignore this email.\n\n127` });
    if (DEV_LINKS && !process.env.RESEND_API_KEY) return link;
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
// intro.mp4 is Video's Finovate Fall highlight until Eli films "Why I built 127"; then set HOME_VIDEO_TITLE="Why I built 127."
function homeVideo() {
  const title = process.env.HOME_VIDEO_TITLE || 'On stage at Finovate Fall.';
  if (process.env.HOME_VIDEO_URL) return { title, src: process.env.HOME_VIDEO_URL, poster: process.env.HOME_VIDEO_POSTER || '/img/eli-founder.jpg' };
  const f = path.join(__dirname, 'public', 'video', 'intro.mp4');
  if (!fs.existsSync(f)) return null;
  return { title, src: '/video/intro.mp4', poster: fs.existsSync(path.join(__dirname, 'public', 'video', 'intro.jpg')) ? '/video/intro.jpg' : '/img/eli-founder.jpg' };
}
// hState: A1, A2, B or C (conversion/pages/homepage.md section 1); joinFlag picks Legal's consent wording for the inline form.
// The homepage hero runs First 25 once the Funnels tool is installed (public/funnels/first-25.html) and searches real
// businesses (FIRST25_SOURCE google or osm). On its made-up samples it can't say it finds anything (Legal 05 rule 6a),
// so the v2 brand hero stays.
const HOME_FIRST25 = fs.existsSync(path.join(__dirname, 'public', 'funnels', 'first-25.html'));
const first25Live = () => HOME_FIRST25 && require('./lib/first25').sourceName() !== 'sample';
app.get('/', (req, res) => res.render('home', { title: null, resources, onboarding, tools: ai.TOOLS, video: homeVideo(), hState: launch.homeState(res.locals.launch), joinFlag: consent.on() ? 'on' : 'off', first25: first25Live() }));
// Pricing meta description by launch state (conversion/pages/pricing.md).
function pricingDescription() {
  const v = launch.view();
  if ((v.prelaunch || v.foundingOpen) && v.foundingPrice) return `Start free. Builder is $${v.foundingPrice} a month, locked while you stay, for the first ${v.cap} founding members until ${v.closesDate || 'the founding close'}. Then $29.`;
  return `Start free. Builder is $29 a month for the full library and every AI tool. The ${CIRCLE_CAPACITY}-seat Founder's Circle is by application.`;
}
app.get('/pricing', (req, res) => res.render('pricing', { title: 'Membership', description: pricingDescription(), resourceCount: resources.length, builderMap: builderMap.forPage() }));
app.get('/circle', (req, res) => res.render('circle', { title: "Founder's Circle" }));
app.get('/media-kit', (req, res) => res.render('media-kit', { title: 'Media kit', description: 'Eli Christiansen media kit: 100K+ followers built, audience snapshot, past brand partnerships and ways to work together.' }));
app.get('/mediakit', (req, res) => res.redirect(301, '/media-kit'));
app.get('/privacy', (req, res) => res.render('legal', { title: 'Privacy', kind: 'privacy' }));
app.get('/terms', (req, res) => res.render('legal', { title: 'Terms', kind: 'terms' }));
app.get('/membership-terms', (req, res) => res.render('legal', { title: 'Membership terms', kind: 'membership' }));
// Drafts behind a banner until Eli approves (COOKIE_NOTICE_LIVE, EARNINGS_DISCLAIMER_LIVE), like /membership-terms.
app.get('/cookies', (req, res) => res.render('legal', { title: 'Cookie Notice', kind: 'cookies', description: 'The cookies and similar technologies 127 uses, and how to change your choice.' }));
app.get('/earnings-disclaimer', (req, res) => res.render('legal', { title: 'Earnings disclaimer', kind: 'earnings', description: "127 teaches people how to start and grow a business. We don't promise that you'll make money." }));
app.get('/circle-agreement', (req, res) => res.render('legal', { title: "Founder's Circle agreement", kind: 'circle' }));

// ---------- onboarding (the free assessment is the signup) ----------
// During pre-launch, new signups go to the founding waitlist unless they have the invite code.
function prelaunchGate(req) {
  if (req.query.invite && process.env.PRELAUNCH_INVITE && req.query.invite === process.env.PRELAUNCH_INVITE) req.session.invite = true;
  // Day One finishers get in an hour early (/early sets a 2-hour signed session flag).
  return launch.prelaunch() && !req.user && !req.session.invite && !challenge.earlyAccess(req);
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
app.get('/signup', (req, res) => res.redirect(prelaunchGate(req) ? '/founding' : '/start'));
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
    if (ageCheck.blocked(email)) return renderErr(ageCheck.SIGNUP_REFUSED);
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
  let note = null;
  if (firstTime || Date.now() - lastNote > 24 * 60 * 60 * 1000) {
    note = await ai.roadmapNote(user, { withFlags: true });
    user.roadmapNote = note && note.text ? note.text : null;
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
  if (note) await ageFromAi(req, user, note, [{ from: 'member', text: wordsOf(clean), at: new Date().toISOString() }]);
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

// ---------- Founder's Circle: short account step (R31) ----------
// "Apply for a seat" on /circle: name, email and password, then straight to the application
// at /app/circle. No assessment first; the roadmap can come later from the dashboard.
app.get('/circle/apply', (req, res) => {
  if (req.user) return res.redirect('/app/circle');
  if (prelaunchGate(req)) return res.redirect('/founding');
  res.render('circle-apply', { title: "Apply for the Founder's Circle", error: null, form: {}, layout: 'bare' });
});
app.post('/circle/apply', wrap(async (req, res) => {
  if (req.user) return res.redirect('/app/circle');
  if (prelaunchGate(req)) return res.redirect('/founding');
  if (!limit(req, res, `signup:${security.ip(req)}`, 5, 60 * 60 * 1000, TOO_FAST)) return;
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const name = String(req.body.name || '').trim().slice(0, 80);
  const password = String(req.body.password || '');
  const renderErr = (error) => res.status(400).render('circle-apply', { title: "Apply for the Founder's Circle", error, form: { name, email, optin: req.body.optin === 'on' }, layout: 'bare' });
  if (!name) return renderErr('Please add your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return renderErr('Please enter a valid email.');
  if (password.length < 8) return renderErr('Use a password with at least 8 characters.');
  if (db.find('users', (u) => u.email === email)) return renderErr('That email already has an account. Sign in instead, and you will land on the application.');
  if (ageCheck.blocked(email)) return renderErr(ageCheck.SIGNUP_REFUSED);
  await createMember(req, { email, name, password, optIn: req.body.optin === 'on', fallbackSource: 'circle' });
  res.redirect('/app/circle');
}));

// ---------- founding members: waitlist and referrals ----------
// First touch: what the session kept wins; form or JSON fields (utm_*) only fill what's missing.
function utmFrom(req, body = {}) {
  return utmLib.firstTouch(req.session.utm, body, body.utm);
}

// The status page is reached by referral code, which is in every public share link, so friends' first names show
// only in a browser that joined or confirmed with that code.
function ownCode(req, code) {
  req.session.wlCodes = [code].concat((req.session.wlCodes || []).filter((c) => c !== code)).slice(0, 5);
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
  if (DEV_LINKS && !process.env.KLAVIYO_PRIVATE_KEY && !process.env.RESEND_API_KEY && r.confirmUrl) req.session.devConfirm = r.confirmUrl;
  if (!r.existing) ownCode(req, r.entry.referralCode); // re-entering a known email never unlocks names
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
  if (!r.existing) ownCode(req, r.entry.referralCode);
  res.json({ ok: true, existing: r.existing, confirmed: !!r.entry.confirmedAt, confirm_sent: !!r.entry.confirmSentAt, referral_code: r.entry.referralCode, referral_link: waitlist.link(r.entry), status_url: `${baseUrl(req)}/founding/status?code=${r.entry.referralCode}` });
}));

app.get('/founding/confirm', wrap(async (req, res) => {
  if (!limit(req, res, `confirm:${security.ip(req)}`, 30, 60 * 60 * 1000, TOO_FAST)) return;
  const confirmed = await waitlist.confirm(req.query.token);
  const entry = confirmed && confirmed.entry;
  if (!entry) return res.status(400).render('404', { title: 'Link expired', error: true, message: 'That confirm link has expired or was already replaced. Join again with the same email to get a fresh one.' });
  if (confirmed.firstTime) track(req, 'Waitlist Confirm');
  req.session.devConfirm = null;
  ownCode(req, entry.referralCode); // the confirm link proves they own the inbox
  res.redirect(`/founding/status?code=${entry.referralCode}&confirmed=1`);
}));

// Calendar reminder for doors opening, so people who didn't tick the box still know when to come back.
app.get('/links', (req, res) => res.render('links', { title: 'Links', description: first25Live() ? 'Eli Christiansen: First 25, the founding list, the Founder Score, the Day One Stack, the free Idea Test and the Founder\'s Circle.' : 'Eli Christiansen: the founding list, the Founder Score, the Day One Stack, the free Idea Test and the Founder\'s Circle.', first25: first25Live() }));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /api\nDisallow: /billing\nDisallow: /founding/status\nDisallow: /founding/confirm\nDisallow: /stack/guide\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const pages = ['/', '/founding', '/pricing', '/circle', '/score', '/stack', '/idea-test', '/media-kit', '/links', '/terms', '/privacy'];
  if (process.env.MEMBERSHIP_TERMS_LIVE === 'true') pages.push('/membership-terms');
  if (process.env.CIRCLE_AGREEMENT_LIVE === 'true') pages.push('/circle-agreement');
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

// Day One Challenge live replays (conversion/challenge/site-spec.md): emails link here before a replay exists.
// 1 = Kickoff (Mon Nov 9), 2 = Debrief (Mon Nov 16). CHALLENGE_REPLAY_<n>_URL once set; /challenge/me until then
// (query string kept, so a ?t= token still opens the person's page). CHALLENGE_START_AT blank is the kill switch.
app.get('/challenge/replay/:n(1|2)', (req, res, next) => {
  if (!launch.date('CHALLENGE_START_AT')) return next();
  const url = launch.replayUrl(req.params.n);
  if (url) return res.redirect(302, url);
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `/challenge/me${qs}`);
});

app.get('/founding/status', (req, res) => {
  const entry = waitlist.byCode(req.query.code);
  if (!entry) return res.redirect('/founding');
  res.render('founding-status', {
    title: "You're on the list",
    entry: {
      code: entry.referralCode, link: waitlist.link(entry), count: entry.referralCount || 0, confirmed: !!entry.confirmedAt, firstName: entry.firstName,
      // "Check your email" only when a confirm email actually went out (unticked joiners may get none).
      confirmSent: !!entry.confirmSentAt,
      referredBy: !!entry.referredBy,
      confirmJustSent: !!entry.confirmSentAt && Date.now() - Date.parse(entry.confirmSentAt) < 5 * 60 * 1000,
      // Confirmed friends by first name, never email (billing terms section 5, decision O20).
      friends: (req.session.wlCodes || []).includes(entry.referralCode) ? waitlist.friends(entry) : null,
    },
    q: req.query,
    devConfirm: DEV_LINKS && req.session.devConfirm ? req.session.devConfirm : null,
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
  if (ageCheck.blocked(email)) return renderLock(req, res, { ...g, error: ageCheck.SIGNUP_REFUSED, form });
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
  // New Circle members land on their seat page (scorecard, profile, first call), not the dashboard.
  if (req.query.upgraded === 'circle' && user.tier === 'circle') return res.redirect(`/app/circle?upgraded=circle${req.query.demo ? '&demo=1' : ''}`);
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
    wins: memberOps.visibleWins(user, db.all('wins')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    aiLeft: aiRunsLeft(user),
    canAccess,
    bySlug,
    // Dashboard nudge (member-signals.analyzeMember), hidden for the day after "Not now".
    nudge: cookie(req, 'nudgehide') === new Date().toISOString().slice(0, 10) ? null : memberOps.nudgeFor(user),
    MILESTONES,
    closedNotice,
    upgradeScreen,
    // Founding upgrade alert: right after paying, or after the assessment that follows a fast founding checkout.
    foundingAlert: !!(user.foundingPrice && user.foundingNumber && user.tier === 'builder' && ((req.query.upgraded === 'builder') || req.query.welcome)),
    // 127 HQ card: last full week's North Number (Builder and up, while HQ_LIVE=true).
    hqCard: hq.liveFor(user) && hq.canUse(user) ? hq.dashCard(user) : null,
    // The Founding Five (lib/founding-five.js): apply, applied, or Eli's answer.
    ffCard: foundingFive.card(user),
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
  res.render('app/library', { title: 'Library', items: resources.filter((r) => !track || r.track === track), track, TRACK_NAMES, canAccess, tplCount: templates.list.length });
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
  else await ageFromAi(req, user, result, [{ from: 'member', text: wordsOf(user.worksheets[r.slug]), at: new Date().toISOString() }]);
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

// ---------- templates library ----------
// Sheets, docs, checklists and recipes from content/templates (manifest v1). Files are served only
// through the gated route; previews are open to every member so free members can see Builder cards.
const TEMPLATE_KINDS = templates.KINDS;
function roadmapTemplates(user) {
  return new Set(roadmap.allTasks(user && user.roadmap).flatMap((t) => templates.roadmapIndex[t.id] || []));
}

app.get('/app/templates', requireAuth, (req, res) => {
  const f = {
    track: templates.TRACKS[req.query.track] ? req.query.track : null,
    kind: TEMPLATE_KINDS[req.query.kind] ? req.query.kind : null,
    tier: ['free', 'builder'].includes(req.query.tier) ? req.query.tier : null,
  };
  const items = templates.list.filter((t) => (!f.track || t.track === f.track) && (!f.kind || t.kind === f.kind) && (!f.tier || t.tier === f.tier));
  res.render('app/templates', { title: 'Templates', items, f, all: templates.list, inRoadmap: roadmapTemplates(req.user), KINDS: TEMPLATE_KINDS, TRACKS: templates.TRACKS, canAccess, tpl: templates });
});

app.get('/app/templates/:slug', requireAuth, (req, res) => {
  const t = templates.get(req.params.slug);
  if (!t) return res.status(404).render('404', { title: 'Not found' });
  const user = req.user;
  res.render('app/template', {
    title: t.title, t, KINDS: TEMPLATE_KINDS, TRACKS: templates.TRACKS, tpl: templates,
    locked: !templates.canOpen(user, t),
    inRoadmap: roadmapTemplates(user).has(t.slug),
    checks: user.checklist || {},
    progress: templates.checklistProgress(t, user),
    review: (user.templateReviews || {})[t.slug] || null,
    aiLeft: aiRunsLeft(user),
    bySlug,
  });
});

app.get('/app/templates/:slug/:file', requireAuth, templates.serveFile());

// Checklist progress is stored on the member by stable item id (launch-countdown.t14.3).
app.post('/app/templates/:slug/check', requireAuth, wrap(async (req, res) => {
  const t = templates.get(req.params.slug);
  const id = String(req.body.item || '');
  const json = req.accepts(['html', 'json']) === 'json';
  if (!t || !t.checklistIds.has(id)) return json ? res.status(404).json({ error: 'Not found' }) : res.status(404).render('404', { title: 'Not found' });
  const user = req.user;
  if (!templates.canOpen(user, t)) return json ? res.status(403).json({ error: 'Builder' }) : res.redirect(`/app/templates/${t.slug}#unlock`);
  user.checklist = user.checklist || {};
  if (user.checklist[id]) delete user.checklist[id];
  else user.checklist[id] = new Date().toISOString();
  await db.save('users', user);
  if (json) return res.json({ id, done: !!user.checklist[id], progress: templates.checklistProgress(t, user) });
  res.redirect(`/app/templates/${t.slug}#${id}`);
}));

// "Get feedback" from Eli's Playbook (ai.reviewTemplate: the entry's aiPrompt is the rubric).
// Same AI-use cap and refund as a worksheet review; the user is saved afterwards so aiSpend sticks.
app.post('/app/templates/:slug/review', requireAuth, wrap(async (req, res) => {
  const t = templates.get(req.params.slug);
  if (!t) return res.status(404).render('404', { title: 'Not found' });
  const user = req.user;
  const back = `/app/templates/${t.slug}#review`;
  if (!templates.canOpen(user, t)) return res.redirect(`/app/templates/${t.slug}#unlock`);
  const input = String(req.body.filled || '').trim().slice(0, 12000);
  if (!input) {
    flash(req, 'info', 'Paste what you filled in first, then ask for a check.');
    return res.redirect(back);
  }
  user.templateReviews = user.templateReviews || {};
  user.templateReviews[t.slug] = { ...(user.templateReviews[t.slug] || {}), input };
  if (!reserveAi(req, res, user, back)) return db.save('users', user);
  // The manifest lists pairsWith as { slug, title }; reviewTemplate grounds on the playbook slugs.
  const entry = { ...t, pairsWith: (t.pairsWith || []).map((p) => (p && p.slug) || p) };
  const result = await ai.reviewTemplate(entry, input, user);
  if (result.error) {
    refundAi(user);
    flash(req, 'error', result.text);
  } else {
    user.templateReviews[t.slug] = { input, text: result.text, demo: !!result.demo, at: new Date().toISOString() };
  }
  await db.save('users', user);
  if (!result.error) await ageFromAi(req, user, result, [{ from: 'member', text: input, at: new Date().toISOString() }]);
  res.redirect(back);
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

// Under 18 (Legal L42): when the Playbook's marker is on an AI result (flags: ['under18']), AI chats
// and posting pause at once and Eli gets the review in /admin/ops. excerpt: the flagged member
// words last, with up to 2 messages before them. Only the model's marker counts here, never keywords.
async function ageFromAi(req, user, result, excerpt) {
  const f = ai.underAgeFlag(result);
  if (!f) return false;
  const last = excerpt.length ? excerpt[excerpt.length - 1].text : '';
  const flagged = await ageCheck.flag(user, { source: 'playbook', excerpt, statedAge: f.statedAge != null ? f.statedAge : ageCheck.statedAge(last) });
  if (flagged) flash(req, 'info', ageCheck.PAUSE_MESSAGE);
  return flagged;
}
// Plain text of what a member typed into a form (worksheets, tools, onboarding answers).
function wordsOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(wordsOf).filter(Boolean).join('\n');
  if (typeof v === 'object') return Object.values(v).map(wordsOf).filter(Boolean).join('\n');
  return '';
}

// The run is counted before the AI call, so parallel requests can't slip past the monthly limit.
// It is handed back if the call fails.
function reserveAi(req, res, user, back) {
  if (ageCheck.underReview(user)) {
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    res.redirect(back);
    return false;
  }
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
    // Under 18 (Legal L42): the flagged message and the 2 before it go to Eli.
    if (!result.error && ai.underAgeFlag(result)) {
      const upTo = user.chat.map((m) => m.content).lastIndexOf(text);
      const excerpt = (upTo >= 0 ? user.chat.slice(Math.max(0, upTo - 2), upTo + 1) : [{ role: 'user', content: text }]).map((m) => ({ from: m.role === 'user' ? 'member' : 'playbook', text: m.content, at: m.at }));
      await ageFromAi(req, user, result, excerpt);
    }
    return res.redirect('/app/tools/ask#latest');
  }
  // Per-field limit: 2,000 characters unless the tool sets max (the Interview Synthesizer's notes take 8,000).
  const input = Object.fromEntries(tool.fields.map((f) => [f.name, String(req.body[f.name] || '').slice(0, f.max || 2000)]));
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
  await ageFromAi(req, user, result, [{ from: 'member', text: wordsOf(input), at: entry.at }]);
  res.redirect(`/app/tools/${tool.slug}?h=${entry.id}#result`);
}));

// The board shows live posts, plus the viewer's own held ones ("waiting for a check").
app.get('/app/wins', requireAuth, (req, res) => {
  const user = req.user;
  const pausedNote = ageCheck.underReview(user) ? ageCheck.PAUSE_MESSAGE : memberOps.postingPaused(user) ? memberOps.pausedMessage(user) : null;
  res.render('app/wins', {
    title: 'Wins',
    wins: memberOps.visibleWins(user, db.all('wins')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50),
    canPost: !pausedNote,
    pausedNote,
    REPORT_REASONS: memberOps.REPORT_REASONS,
    winReplies: memberOps.winRepliesOn(),
    visibleReplies: memberOps.visibleReplies,
  });
});

// Pre-screen (lib/moderation.js): block (not saved), hold (saved, waits for Eli in /admin/ops) or live.
app.post('/app/wins', requireAuth, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (text.length < 3) return res.redirect('/app/wins');
  const user = req.user;
  if (ageCheck.underReview(user)) {
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    return res.redirect('/app/wins');
  }
  if (memberOps.postingPaused(user)) {
    flash(req, 'error', memberOps.pausedMessage(user));
    return res.redirect('/app/wins');
  }
  const screen = memberOps.screenPost(user, text);
  if (screen.action === 'block') {
    flash(req, 'error', memberOps.blockMessage(screen));
    return res.redirect('/app/wins');
  }
  const status = memberOps.statusFor(screen);
  const now = new Date().toISOString();
  const firstName = (user.name || 'A member').split(' ')[0];
  const win = await db.save('wins', {
    userId: user.id, name: firstName, text, tier: user.pausedTier || user.tier,
    status, flags: screen.reasons.map((r) => r.code), urgent: !!screen.urgent, heldAt: status === 'held' ? now : null,
  });
  memberOps.afterScreen(user, win, screen);
  await addXp(user, 15);
  const badgesBefore = (user.badges || []).length;
  const isNew = gamify.award(user, 'first_win');
  await db.save('users', user);
  if (status === 'live') integrations.emit('win.posted', { userId: user.id, win_id: win.id, text });
  else integrations.emit('win.held', { userId: user.id, win_id: win.id, reasons: win.flags });
  emitNewBadges(user, badgesBefore);
  // Under 18 (Legal L42): pause AI chats and posting; Eli sees this post and the 2 before it.
  const age = ageCheck.detect(text, null);
  if (age) {
    const mine = db.filter('wins', (w) => w.userId === user.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(-3);
    await ageCheck.flag(user, { source: 'post', excerpt: mine.map((w) => ({ from: 'member', text: w.text, at: w.createdAt })), statedAge: age.statedAge });
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
  } else if (status === 'held') {
    flash(req, 'info', screen.crisis ? `${memberOps.HOLD_MESSAGE} ${require('./lib/moderation').CRISIS_MESSAGE}` : memberOps.HOLD_MESSAGE);
  } else {
    flash(req, 'win', isNew ? 'Badge earned: First win shared' : 'Posted. Keep building.');
  }
  res.redirect('/app/wins');
}));

app.post('/app/wins/:id/delete', requireAuth, wrap(async (req, res) => {
  const win = db.get('wins', req.params.id);
  if (win && (win.userId === req.user.id || isAdmin(req.user))) await db.remove('wins', win.id);
  res.redirect('/app/wins');
}));

// ---------- Founder's Circle (lib/circle.js) ----------
const HANDBOOK_HTML = markdown.render(fs.readFileSync(path.join(__dirname, 'content', 'circle-handbook.md'), 'utf8'));

function upcomingFirstCall(call, now) {
  return call && call.at > now ? circle.callLabel(call) : null;
}

async function circleLocals(req, extra = {}) {
  const c = circleCtx();
  await circle.tick(c);
  const user = req.user;
  const application = circle.appFor(c, user.id);
  const state = circle.appState(application, user, c.now);
  const m = circle.membership(user);
  const isMember = user.tier === 'circle';
  const former = circle.isFormer(user);
  const next = circle.nextCall(c.now);
  const sc = isMember ? circle.scorecardStatus(c, user.id) : null;
  // Not yet, lapsed and former applicants apply again with their last answers filled in ("your answer here carries over").
  const values = extra.values || (application && ['not_yet', 'lapsed', 'former'].includes(state) ? application : {});
  return {
    title: "Founder's Circle",
    application,
    state,
    membership: m,
    isMember,
    former,
    returning: circle.returningEligible(user, c.now),
    canApply: circle.canApply(application, user, c.now),
    position: state === 'waiting' ? circle.queuePosition(c, application) : null,
    offer: state === 'offered' ? { seat: application.offer.seat, until: circle.fmtLong(circle.ms(application.offer.expiresAt)) } : null,
    approvalUntil: application && application.approvedAt ? circle.fmtDate(circle.approvalExpiresAt(application)) : null,
    nextCall: next ? circle.callLabel(next) : null,
    firstCall: isMember && m ? upcomingFirstCall(circle.firstCallFor(circle.ms(m.joinedAt) || c.now), c.now) : null,
    scorecard: sc ? { ...sc, opens: circle.fmtDayTime(sc.window.opensAt) } : null,
    profile: isMember ? circle.profileOf(user, application) : null,
    profileMissing: isMember ? circle.profileMissing(circle.profileOf(user, application)) : [],
    recaps: isMember ? circle.recaps(c).slice(0, 3) : [],
    circle,
    values,
    errors: extra.errors || null,
    callUrl: process.env.CIRCLE_CALL_URL || null,
    communityUrl: process.env.CIRCLE_COMMUNITY_URL || null,
    callTime: process.env.CIRCLE_CALL_TIME || 'Thursdays, 8pm ET',
    handbookPath: circle.HANDBOOK_PATH,
  };
}

app.get('/app/circle', requireAuth, wrap(async (req, res) => {
  const joined = req.query.upgraded === 'circle' && req.user.tier === 'circle';
  if (joined && !req.query.demo) res.locals.trackEvents.push({ name: 'Upgrade', props: { plan: 'circle', founding: !!req.user.foundingPrice } });
  if (joined) res.locals.flash = { type: 'win', text: "You're in the Founder's Circle. Your first call and next steps are below." };
  res.render('app/circle', await circleLocals(req));
}));

// The member handbook (content/circle-handbook.md). Signed-in members of any plan can read it,
// since applicants confirm they've read it.
app.get(circle.HANDBOOK_PATH, requireAuth, (req, res) => {
  res.render('app/handbook', { title: "Founder's Circle handbook", html: HANDBOOK_HTML });
});

app.post('/app/circle/apply', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  if (!limit(req, res, `circle-apply:${user.id}`, 10, 60 * 60 * 1000, TOO_FAST)) return;
  const r = await circle.apply(circleCtx(), user, req.body, security.isHttpUrl);
  if (r.errors) return res.status(400).render('app/circle', await circleLocals(req, { values: r.values, errors: r.errors }));
  const a = r.app;
  integrations.emit('circle.applied', { applicationId: a.id, email: user.email, name: user.name });
  if (ADMIN_EMAILS[0]) integrations.sendEmail({ to: ADMIN_EMAILS[0], subject: `New Founder's Circle application: ${user.name || user.email}`, text: `${user.name} <${user.email}>\n\nBuilding: ${a.business}\nToday: ${a.revenue}\nNeeds (90 days): ${a.challenge}\n13 weeks from now: ${a.result13}\nTime: ${circle.TIME_ANSWERS[a.time]}${a.timeNote ? ': ' + a.timeNote : ''}\n\nDecide at ${baseUrl(req)}/admin#applications` });
  flash(req, 'win', "Got it. Eli reads every application himself. You'll hear back within 2 weekdays.");
  res.redirect('/app/circle');
}));

// Former members in good standing (left in the last 6 months) skip the application.
app.post('/app/circle/rejoin', requireAuth, wrap(async (req, res) => {
  const r = await circle.rejoin(circleCtx(), req.user);
  if (r.error) flash(req, 'error', r.error);
  else flash(req, 'win', r.offered ? 'Welcome back. Your seat is held for you for 72 hours.' : `Welcome back. The table is full right now, and you're number ${r.position} in line.`);
  res.redirect('/app/circle');
}));

// "Reply when you're ready": back in line after a claim window ran out.
app.post('/app/circle/ready', requireAuth, wrap(async (req, res) => {
  const c = circleCtx();
  const a = circle.appFor(c, req.user.id);
  const r = a ? await circle.backInLine(c, a) : { error: 'No application found.' };
  if (r.error) flash(req, 'error', r.error);
  else flash(req, 'win', r.offered ? 'A seat is open. It is held for you for 72 hours.' : "You're back in line. We'll email you when a seat opens.");
  res.redirect('/app/circle');
}));

app.post('/app/circle/profile', requireAuth, wrap(async (req, res) => {
  if (req.user.tier !== 'circle') return res.redirect('/app/circle');
  const r = await circle.saveProfile(circleCtx(), req.user, req.body);
  flash(req, r.missing.length ? 'info' : 'win', r.missing.length ? `Saved. Still to fill in: ${r.missing.join(', ')}.` : 'Founder Profile saved.');
  res.redirect('/app/circle#profile');
}));

async function scorecardLocals(req, extra = {}) {
  const c = circleCtx();
  await circle.tick(c);
  const user = req.user;
  const st = circle.scorecardStatus(c, user.id);
  return {
    title: 'Scorecard',
    st,
    seat: (user.circle && user.circle.seat) || null,
    profile: circle.profileOf(user, circle.appFor(c, user.id)),
    commitments: st ? circle.commitmentsFor(c, user.id, st.call) : [],
    history: st ? circle.numberHistory(c, user.id, st.call.key) : [],
    values: extra.values || (st && st.existing) || {},
    errors: extra.errors || null,
    opens: st ? circle.fmtDayTime(st.window.opensAt) : null,
    dayName: st ? new Date(st.call.at).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' }) : null,
    clock: st ? circle.fmtClock(st.call.at) : null,
    circle,
  };
}
app.get('/app/circle/scorecard', requireAuth, wrap(async (req, res) => {
  if (req.user.tier !== 'circle') return res.redirect('/app/circle');
  res.render('app/scorecard', await scorecardLocals(req));
}));
app.post('/app/circle/scorecard', requireAuth, wrap(async (req, res) => {
  if (req.user.tier !== 'circle') return res.redirect('/app/circle');
  const r = await circle.saveScorecard(circleCtx(), req.user, req.body);
  if (r.errors) return res.status(400).render('app/scorecard', await scorecardLocals(req, { values: r.values || {}, errors: r.errors }));
  const day = new Date(r.call.at).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  flash(req, 'win', `Got it. See you ${day} at ${circle.fmtClock(r.call.at)} ET.`);
  res.redirect('/app/circle');
}));

app.get('/app/billing', requireAuth, (req, res) => {
  const application = db.find('applications', (a) => a.userId === req.user.id);
  const user = req.user;
  // 14 days to change your mind: Builder only, from the first paid charge (unknown = still show it).
  const refundAsk = user.tier === 'builder' && !user.demoBilling && (!user.firstPaidAt || Date.now() - Date.parse(user.firstPaidAt) < 14 * 864e5);
  if (req.query.cancelled) res.locals.trackEvents.push({ name: 'Cancel', props: { plan: (user.cancellations || []).slice(-1).map((c) => c.plan)[0] || user.tier } });
  const lastCancel = (user.cancellations || []).slice(-1)[0];
  res.render('app/billing', { title: 'Membership', application, refundAsk, justCancelled: !!req.query.cancelled, askReason: !!req.query.cancelled && !!lastCancel && !lastCancel.reason, CANCEL_REASONS, pausePrice: pausePrice(user) });
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
  // A paused Builder still has a subscription: "Resume now" on Billing brings it back, no new checkout.
  if (req.user.pause && !req.user.pause.endedAt) {
    flash(req, 'info', 'Your Builder plan is paused. Resume it here to get everything back.');
    return res.redirect('/app/billing#pause');
  }
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
// Pause for a month (offer.md section 8, Membership Terms section 8; lib/billing.js "pause").
// Builder only, once every 6 months; it starts when the paid month ends.
const PAUSE_AVAILABLE = true;

// The price a paused plan restarts at (founding price kept).
function pausePrice(user) {
  return user.foundingPrice ? launch.view().foundingPrice || 19 : PLANS.builder.price;
}

app.get('/app/billing/cancel', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  if (user.tier === 'free' && !user.pausedTier) return res.redirect('/app/billing');
  try {
    await billing.refreshSubscription(user);
  } catch (err) {
    console.warn('[billing] refresh before cancel', err.message);
  }
  if (user.cancelAt) return res.redirect('/app/billing');
  // Seen for the churn score (members heartbeat feed).
  user.cancelPageViewedAt = new Date().toISOString();
  await db.save('users', user);
  const reason = CANCEL_REASONS.some((r) => r[0] === req.query.reason) ? req.query.reason : null;
  const entry = launch.onWaitlist(user.email);
  const preview = billing.pausePreview(user);
  res.render('app/cancel', {
    title: 'Cancel', accessEnds: fmtDate(user.periodEnd), foundingKept: billing.foundingKept(user),
    pauseAvailable: PAUSE_AVAILABLE && billing.pauseEligible(user).ok && !!preview,
    pauseStarts: preview ? fmtDate(preview.pausesAt) : null, pauseRestarts: preview ? fmtDate(preview.restartAt) : null,
    paused: !!user.pausedTier,
    CANCEL_REASONS, reason, options: req.query.options === '1', referralLink: entry ? waitlist.link(entry) : null,
  });
}));

// "Pause for a month" on screen 2 of the cancel flow.
app.post('/app/billing/pause', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  if (!PAUSE_AVAILABLE) return res.redirect('/app/billing/cancel');
  const ok = billing.pauseEligible(user);
  if (!ok.ok) {
    flash(req, 'info', billing.PAUSE_REFUSALS[ok.reason] + (ok.nextAt ? ` You can pause again from ${fmtDate(ok.nextAt)}.` : ''));
    return res.redirect('/app/billing');
  }
  try {
    await billing.pauseAtPeriodEnd(user);
  } catch (err) {
    if (err instanceof billing.BillingUnavailable) {
      flash(req, 'info', err.message);
      return res.redirect('/app/billing');
    }
    if (!err.type || !String(err.type).startsWith('Stripe')) throw err;
    console.error('[billing] pause failed', err.type, err.code || '', err.message);
    flash(req, 'error', "We couldn't pause online just now. Nothing changed. Try again in a minute, or email hello@127group.io.");
    return res.redirect('/app/billing');
  }
  const reason = CANCEL_REASONS.some((r) => r[0] === req.body.reason) ? req.body.reason : null;
  // Record of the pause (Membership Terms, Appendix D).
  user.pauseRecords = [...(user.pauseRecords || []), { at: new Date().toISOString(), plan: 'builder', reason, starts: user.pause.scheduledFor, restarts: user.pause.resumesAt, subscription: user.pause.subscriptionId || null, terms_version: billing.TERMS_VERSION, ip_hash: security.hash(security.ip(req)) }].slice(-20);
  await db.save('users', user);
  if (reason) integrations.emit('subscription.cancel_reason', { userId: user.id, plan: 'builder', reason, saved_by: 'pause' });
  res.redirect('/app/billing?paused=1#pause');
}));

// "Resume now" on Billing: ends a scheduled or running pause.
app.post('/app/billing/pause/resume', requireAuth, wrap(async (req, res) => {
  try {
    if (await billing.resumePause(req.user)) {
      flash(req, 'win', `You're back on Builder. Next charge: ${fmtDate(req.user.periodEnd) || 'your next renewal date'}.`);
    }
  } catch (err) {
    if (!err.type || !String(err.type).startsWith('Stripe')) throw err;
    console.error('[billing] resume pause failed', err.type, err.message);
    flash(req, 'error', "We couldn't reach our payment provider. Please try again in a minute.");
  }
  res.redirect('/app/billing');
}));

app.post('/app/billing/cancel', requireAuth, wrap(async (req, res) => {
  const user = req.user;
  const was = user.pausedTier || user.tier;
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
  await deleteAccount(user);
  req.session = null;
  res.redirect('/?deleted=1');
}));

// Full account deletion (Legal L14, handoff item 14): the account, roadmap, AI conversations, posts
// and replies, Circle application, Scorecards and questions, tickets and drafts, waitlist, free-tool
// and Idea Test records, events and the Klaviyo profile. retainBilling: false for a close for age,
// which keeps only the ageClosures record (lib/age-check.js).
async function deleteAccount(user, { retainBilling = true } = {}) {
  integrations.forget(user.email);
  if (retainBilling) await billingRecords.retainOnDelete(user);
  await db.purgeEvents(user.id, user.email);
  const mine = (col, test) => db.filter(col, test);
  for (const w of mine('wins', (w) => w.userId === user.id)) await db.remove('wins', w.id);
  for (const w of mine('wins', (w) => (w.replies || []).some((r) => r.userId === user.id) || (w.cheers || []).includes(user.id))) {
    w.replies = (w.replies || []).filter((r) => r.userId !== user.id);
    w.cheers = (w.cheers || []).filter((id) => id !== user.id);
    await db.save('wins', w);
  }
  for (const a of mine('applications', (a) => a.userId === user.id)) await db.remove('applications', a.id);
  for (const sc of mine('scorecards', (sc) => sc.userId === user.id)) await db.remove('scorecards', sc.id);
  for (const col of ['tickets', 'reports', 'circleQuestions']) for (const x of mine(col, (x) => x.userId === user.id)) await db.remove(col, x.id);
  for (const d of mine('drafts', (d) => d.userId === user.id || d.email === user.email)) await db.remove('drafts', d.id);
  for (const n of mine('notes', (n) => n.targetType === 'member' && n.targetId === user.id)) await db.remove('notes', n.id);
  // Free tools: leads by email, and Idea Test results a lead points to.
  const leads = mine('leads', (l) => l.email === user.email);
  const leadRefs = new Set(leads.flatMap((l) => Object.values(l.data || {}).filter((v) => typeof v === 'string')));
  for (const t of mine('ideaTests', (t) => leadRefs.has(t.id))) await db.remove('ideaTests', t.id);
  for (const l of leads) await db.remove('leads', l.id);
  for (const w of mine('waitlist', (w) => w.email === user.email)) await db.remove('waitlist', w.id);
  await challenge.forget(user.email);
  // 127 HQ: saved Stripe and Shopify keys and the 127 link. The numbers themselves are on the user doc.
  await db.remove('hqConnections', user.id);
  // HQ v2: runs, Inbox, Pipeline, Library files, credits, wins and the business brain. Their OKs to HQ's
  // Terms lines stay 5 years with the email only (Legal L71), except on a close for age.
  await harness.forget(user.id, { email: user.email, keepAgreements: retainBilling });
  // The Founding Five: the application, its videos and the five's weeks.
  await foundingFive.forget(user.id);
  await db.remove('users', user.id);
}

// ---------- admin ----------
app.get('/admin', requireAuth, requireAdmin, wrap(async (req, res) => {
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
    applications: db.all('applications').map(circle.normalizeApplication).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    integrations: integrations.status(),
    onboarding,
    wl: waitlist.stats(),
    cv: await adminCircle(req),
    hqStats: hq.live() ? hq.stats() : null,
    // HQ v2 early access (lib/harness/access.js): the public build's founder, before HQ v2 opens to everyone.
    hq2: { mode: harness.mode(), list: harness.access.list(), until: harness.access.defaultUntil(), credits: harness.access.DEFAULT_CREDITS, allowances: harness.ledger.allowances(), held: harness.needs.heldList(), pages: harness.needs.pagesList() },
  });
}));

// The Circle panels in /admin: decisions, the line, the table, Scorecards and the recap.
async function adminCircle(req) {
  const c = circleCtx();
  await circle.tick(c);
  const users = Object.fromEntries(db.all('users').map((u) => [u.id, u]));
  const state = (a) => circle.appState(a, users[a.userId], c.now);
  const next = circle.nextCall(c.now);
  const last = circle.lastCall(c.now);
  const members = circle.members(c);
  const recapDone = last ? db.find('circleRecaps', (r) => r.callKey === last.key) : null;
  const savedDraft = req.session.recapDraft || null;
  req.session.recapDraft = null;
  return {
    now: c.now,
    users,
    state,
    queue: circle.queue(c),
    offers: db.all('applications').filter((a) => state(a) === 'offered'),
    members,
    formers: db.all('users').filter((u) => circle.isFormer(u)).sort((a, b) => b.circle.leftAt.localeCompare(a.circle.leftAt)),
    next,
    nextLabel: next ? circle.fmtShort(next.at) : null,
    scorecards: next ? members.map((u) => ({ u, s: circle.scorecardFor(c, u.id, next.key) })) : [],
    last,
    lastLabel: last ? circle.fmtShort(last.at) : null,
    recapDone,
    recapDraft: last && !recapDone ? savedDraft || circle.recapDraft(c, last) : '',
    history: (u) => circle.historyFor(c, u.id),
    fitCalls: circle.fitCallsThisWeek(c),
    fitCallUrl: process.env.CIRCLE_FIT_CALL_URL || '',
    circle,
  };
}


// Approve, Fit call, Not yet, Decline (each sends its email), and "back in line" after a claim window ran out.
const ADMIN_ACTIONS = { approve: 'approve', approved: 'approve', fit_call: 'fit_call', not_yet: 'not_yet', decline: 'decline', declined: 'decline' };
app.post('/admin/applications/:id/:action', requireAuth, requireAdmin, wrap(async (req, res) => {
  const c = circleCtx();
  const a = circle.normalizeApplication(db.get('applications', req.params.id));
  if (!a) return res.redirect('/admin#applications');
  const action = ADMIN_ACTIONS[req.params.action];
  let r;
  if (req.params.action === 'ready') r = await circle.backInLine(c, a);
  else if (action) r = await circle.decide(c, a, action, { bookingUrl: req.body.bookingUrl, reason: req.body.reason, change: req.body.change, by: req.user.email });
  else r = { error: 'Unknown action.' };
  if (r.error) flash(req, 'error', r.error);
  else {
    const who = a.name || a.email;
    const msg = {
      approve: r.offered ? `${who} approved. Seat ${circle.seatLabel(r.seat)} is held for 72 hours.` : `${who} approved and waiting: number ${r.position} in line.`,
      fit_call: `Fit call invite sent to ${who}.`,
      not_yet: `"Not yet" sent to ${who}.`,
      decline: `Decline sent to ${who}.`,
    }[action] || `${who} is back in line.`;
    flash(req, 'win', msg);
  }
  res.redirect('/admin#applications');
}));

// Former members: good standing decides whether they can come back without applying.
app.post('/admin/circle/members/:id/standing', requireAuth, requireAdmin, wrap(async (req, res) => {
  const u = db.get('users', req.params.id);
  if (u && circle.isFormer(u)) {
    u.circle.goodStanding = req.body.good === '1';
    await db.save('users', u);
  }
  res.redirect('/admin#circle-table');
}));

// Eli approves the recap: it emails every member (their commitments first) and posts to #call-notes.
app.post('/admin/circle/recap', requireAuth, requireAdmin, wrap(async (req, res) => {
  const r = await circle.sendRecap(circleCtx(), { callKey: req.body.callKey, post: req.body.post, body: req.body, by: req.user.email });
  if (r.error) {
    flash(req, 'error', r.error);
    req.session.recapDraft = String(r.post || req.body.post || '').slice(0, 8000);
  } else {
    flash(req, 'win', `Recap sent to ${r.sent} member${r.sent === 1 ? '' : 's'}${r.posted ? ' and posted to #call-notes' : ''}.`);
  }
  res.redirect('/admin#recap');
}));

// The `circle` section of the members heartbeat feed: profiles, the next call's Scorecards, the last
// recap, attendance and hot-seat history, and the line. Admin session, or CIRCLE_FEED_TOKEN as a bearer token.
app.get('/admin/circle/feed.json', wrap(async (req, res) => {
  const token = process.env.CIRCLE_FEED_TOKEN || '';
  const auth = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const byToken = token.length >= 32 && !!auth && security.sameHash(security.hash(auth), security.hash(token));
  if (!byToken && !isAdmin(req.user)) return res.status(404).json({ error: 'Not found' });
  const { generated_at, ...data } = await circleFeedData();
  res.set('cache-control', 'no-store').json({ generated_at, circle: data });
}));

// Shared by /admin/circle/feed.json and the `circle` section of GET /ops/feed.
async function circleFeedData() {
  const c = circleCtx();
  await circle.tick(c);
  const next = circle.nextCall(c.now);
  const last = circle.lastCall(c.now);
  const lastRecap = circle.recaps(c)[0] || null;
  const card = (s) => s && { ...s, id: undefined, userId: undefined };
  return {
    generated_at: new Date(c.now).toISOString(),
    capacity: CIRCLE_CAPACITY,
    seats_left: circleSeatsLeft(),
    next_call: next && { at: next.key, label: circle.callLabel(next), kickoff: next.kickoff, scorecard: circle.scorecardWindow(next) },
    members: circle.members(c).map((u) => ({
      user_id: u.id,
      name: u.name,
      seat: u.circle && u.circle.seat,
      founding_seat: !!(u.circle && u.circle.founding),
      joined_at: u.circle && u.circle.joinedAt,
      profile: circle.profileOf(u, circle.appFor(c, u.id)),
      scorecard: (next && card(circle.scorecardFor(c, u.id, next.key))) || null,
      history: circle.historyFor(c, u.id),
      payment_issue: !!u.paymentIssue,
    })),
    last_recap: lastRecap && { call_at: lastRecap.callKey, post: lastRecap.post, members: lastRecap.members },
    // Recap status for the last call: sent (and posted to #call-notes) or still due.
    recap_status: last ? { call_at: last.key, sent: !!(lastRecap && lastRecap.callKey === last.key), sent_at: lastRecap && lastRecap.callKey === last.key ? lastRecap.sentAt : null, posted: !!(lastRecap && lastRecap.callKey === last.key && lastRecap.postedToDiscord) } : null,
    waiting: circle.queue(c).map((a, i) => ({ position: i + 1, name: a.name, approved_at: a.approvedAt })),
  };
}
// The `app` section of GET /ops/feed.
function opsFeedApp() {
  const next = circle.nextCall(Date.now());
  const L = launch.view();
  return {
    baseUrl: process.env.BASE_URL || 'https://127group.io',
    circleCapacity: CIRCLE_CAPACITY,
    circleSeatsLeft: circleSeatsLeft(),
    circleCallTime: process.env.CIRCLE_CALL_TIME || 'Thursdays, 8pm ET',
    nextCircleCall: next ? next.key : null,
    launchAt: L.launchAt ? new Date(L.launchAt).toISOString() : null,
  };
}
// Circle recap approved from /admin/ops (a `circle_recap` draft): the same path as /admin/circle/recap.
async function opsRecap({ callKey, date, post, by }) {
  let key = callKey;
  if (!key && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    const call = circle.callsBetween(circle.etTime(y, m, d, 0, 0), circle.etTime(y, m, d, 23, 59))[0];
    key = call ? call.key : null;
  }
  return circle.sendRecap(circleCtx(), { callKey: key, post, body: {}, by });
}

// Founding grace link (R14, Legal L41): only for a founding checkout that started while spots were
// open and before the close and broke on our side, never for a card decline. One link per person.
app.post('/admin/grace', requireAuth, requireAdmin, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const graceBack = req.body.back === 'ops' ? '/admin/ops#grace' : '/admin#grace';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    flash(req, 'error', 'Enter a valid email.');
    return res.redirect(graceBack);
  }
  const r = await billing.issueGrace(email);
  if (!r.token) {
    flash(req, 'error', `${email} already had a founding link${r.issuedAt ? ` (sent ${fmtDate(r.issuedAt)})` : ''}${r.usedAt ? ', and used it' : ''}. It's one per person.`);
    return res.redirect(graceBack);
  }
  const record = r.startedAt ? `Founding checkout on record: ${fmtDate(r.startedAt)}.` : 'No founding checkout on record, issued on the benefit of the doubt.';
  flash(req, 'info', `Founding link for ${email}. It works once, for the next 3 days. ${record} ${baseUrl(req)}/founding/lock?grace=${r.token}`);
  res.redirect(graceBack);
}));

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

// HQ v2 (lib/harness): Today with Do my day, Start, the Inbox, Pipeline, Library and runs. Mounted before
// HQ v1, so /app/hq is v2 for the members HARNESS_V2 is on for; everyone else falls through to v1.
harness.hooks({
  // Activation steps, wins, Monday cards and the budget alarms, as events (lib/integrations.js).
  emit: (type, payload) => integrations.emit(type, payload),
  // Under review for age (Legal L42): no new runs, and running ones stop at their next step.
  guard: (user) => (ageCheck.underReview(user) ? ageCheck.PAUSE_MESSAGE : null),
  // An AI answer inside a run carried the under-18 marker: the same pause as the Playbook's.
  flag: async (user, run, stepId, out) => {
    const f = ai.underAgeFlag(out);
    if (!f) return;
    const said = wordsOf(run.inputs).slice(0, 2000);
    await ageCheck.flag(user, { source: 'hq', excerpt: said ? [{ from: 'member', text: said, at: run.createdAt || null }] : [], statedAge: f.statedAge != null ? f.statedAge : ageCheck.statedAge(said) });
  },
});
app.use(harnessRoutes({ requireAuth, flash, track, isAdmin }));

// 127 HQ (lib/hq-routes.js): /app/hq, its connections and Read my week. Falls through to the 404 while HQ_LIVE is off.
app.use(hqRoutes({ requireAuth, flash, track, reserveAi, refundAi, ageFromAi, aiRunsLeft }));

// Member operations (lib/member-ops.js): Help, /guidelines, unsubscribe, wins report/reply/cheer,
// Circle questions and call.ics, the dashboard nudge, and /admin/ops (Eli's approval outbox).
app.use(memberOps.routes({
  requireAuth, requireAdmin, flash, limit, TOO_FAST, circle,
  recap: opsRecap,
  ageClose: {
    refundAll: (u) => billing.refundAllAndCancel(u),
    deleteAccount: async (u) => {
      const discord = u.tier === 'circle' || circle.isFormer(u);
      await deleteAccount(u, { retainBilling: false });
      // Discord has no API here: Eli removes them from the server by hand.
      if (discord && ADMIN_EMAILS[0]) integrations.sendEmail({ to: ADMIN_EMAILS[0], subject: 'Remove a closed account from Discord', text: 'An account closed for age was in the Founder\'s Circle. Remove them from the 127 Discord server today.' });
    },
  },
}));

// The Founding Five (lib/founding-five-routes.js): the application and the five's page at /app/founding-five,
// its videos and sessions.ics, and Eli's pick sheet at /admin/founding-five.
app.use(foundingFiveRoutes({
  requireAuth, requireAdmin, isAdmin, flash, limit, TOO_FAST, track,
  stageDraft: memberOps.stageDraft,
  tell: ({ subject, text }) => (ADMIN_EMAILS[0] ? integrations.sendEmail({ to: ADMIN_EMAILS[0], subject, text }) : null),
}));

// Joins by ad for the ad desk (ops/growth/ads/intake.md section 4): counts only, no emails or names.
// One row per Chicago date, ad (utm_*) and page. Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD.
app.get('/admin/joins.csv', require('./lib/export-token').orAdmin(requireAuth, requireAdmin), (req, res) => {
  res.set('cache-control', 'no-store');
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : undefined);
  const csv = utmLib.csv(utmLib.fromStore({ from: day(req.query.from), to: day(req.query.to) }));
  res.set('content-type', 'text/csv').set('content-disposition', `attachment; filename="site-joins-${utmLib.chicagoDay(Date.now())}.csv"`).send(csv);
});

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
  // Body-parser errors carry the raw request in err.body (answers, emails): log only the type, never the body (Legal handoff item 24).
  if (err && typeof err.type === 'string' && /^(entity\.|request\.|charset\.|encoding\.)/.test(err.type)) {
    console.warn('[body]', req.method, req.path, err.type);
    const status = err.status && err.status < 500 ? err.status : 400;
    if (req.is('json') || req.accepts(['html', 'json']) === 'json') return res.status(status).json({ ok: false, error: 'Something went wrong. Try again.' });
    return res.status(status).render('404', { title: 'Something went wrong', error: true });
  }
  if (err && err.body !== undefined) delete err.body;
  console.error(err);
  res.status(500).render('404', { title: 'Something went wrong', error: true });
});

db.init().then(async () => {
  // Members who joined before this ran get their seat numbers quietly; later joins notify Eli.
  await circle.tick(circleCtx({ notify: false })).catch((err) => console.error('[circle] first pass', err));
  // Claim windows, reminders, the waiting line and Scorecard notices.
  setInterval(() => circle.tick(circleCtx()).catch((err) => console.error('[circle] tick', err)), 5 * 60 * 1000).unref();
  // Approved drafts that waited out quiet hours (10pm-8am Central), and age-closure records past 3 years.
  setInterval(() => {
    memberOps.flushQueued({ recap: opsRecap }).catch((err) => console.error('[member-ops] flush', err.message));
    ageCheck.purgeOld().catch((err) => console.error('[age-check] purge', err.message));
    // 127 HQ: each connected Stripe account's last 12 weeks, refreshed once a day.
    hq.tick().catch((err) => console.error('[hq] tick', err.message));
    hqHarness.tick().catch((err) => console.error('[hq] check-in', err.message));
  }, 5 * 60 * 1000).unref();
  // HQ v2 (lib/harness): load the packs; while HARNESS_V2 is on, resume waiting work every minute
  // (and Monday's cards every 10), and clear old runs and cache once a day.
  harness.init();
  setInterval(() => {
    harness.tick().catch((err) => console.error('[harness] tick', err.message));
    harness.daily().catch((err) => console.error('[harness] daily', err.message));
  }, 60 * 1000).unref();
  // The Founding Five: hello videos and applications go when Legal and Offer promised, and 127's copies of
  // the five's recaps on Apr 6, 2027. Hourly; each pass does only what's due.
  const ffSweep = () => {
    foundingFive.purge().catch((err) => console.error('[founding-five] purge', err.message));
    memberOps.forgetFfRecaps().catch((err) => console.error('[member-ops] recaps', err.message));
  };
  ffSweep();
  setInterval(ffSweep, 60 * 60 * 1000).unref();
  app.listen(PORT, '0.0.0.0', () => console.log(`127 running on http://localhost:${PORT}`));
  if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) require('./lib/reminders').start();
});
