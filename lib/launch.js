// Launch settings: pre-launch mode, the founding-member window and its price.
// Every value comes from env so Eli's final decisions drop in without code changes.
//
// PRELAUNCH=true            homepage and pricing point to /founding; /start is invite-only
// PRELAUNCH_INVITE=code     /start?invite=code lets testers in during pre-launch
// LAUNCH_AT                 ISO datetime doors open (countdown target)
// FOUNDING_CLOSES_AT        ISO datetime the founding price ends
// FOUNDING_CAP              max founding subscriptions (default 100)
// FOUNDING_PRICE            founding Builder price shown on pages, e.g. 19 (blank = say "a lower price")
// STRIPE_PRICE_BUILDER_FOUNDING, STRIPE_COUPON_FOUNDING_REFERRAL   Stripe ids
// REFERRALS_FOR_REWARD      confirmed friends needed for the reward (default 3)
// FOUNDING_CALL_AT          ISO datetime of the founding-members call with Eli (blank = not mentioned)

const db = require('./db');

function date(name) {
  const v = process.env[name];
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
}

function prelaunch() {
  if (process.env.PRELAUNCH !== 'true') return false;
  const launch = date('LAUNCH_AT');
  return !launch || Date.now() < launch;
}

// "The first 100 ever": every founding membership that starts takes a number (1, 2, 3...) for good.
// A refund, cancel or deleted account never reopens a spot, so the counter lives outside the users.
function foundingSubscribers() {
  const c = db.get('counters', 'founding');
  const legacy = db.filter('users', (u) => !u.foundingNumber && u.foundingPrice && u.tier !== 'free').length;
  return ((c && c.count) || 0) + legacy;
}

async function claimFoundingNumber(user) {
  if (user.foundingNumber) return user.foundingNumber;
  const c = db.get('counters', 'founding') || { id: 'founding', count: 0 };
  c.count += 1;
  user.foundingNumber = c.count; // set before awaiting so a duplicate webhook can't take a second number
  await db.save('counters', c);
  return c.count;
}

// The founding price is available until the close date or the cap, whichever comes first.
function foundingOpen() {
  const closes = date('FOUNDING_CLOSES_AT');
  if (!closes || Date.now() >= closes) return false;
  return foundingSubscribers() < parseInt(process.env.FOUNDING_CAP || '100', 10);
}

function onWaitlist(email) {
  return db.find('waitlist', (w) => w.email === String(email || '').toLowerCase()) || null;
}

// Founding member: on the waitlist, or signed up before the founding window closed.
function isFoundingMember(user) {
  if (!user) return false;
  if (onWaitlist(user.email)) return true;
  const closes = date('FOUNDING_CLOSES_AT');
  return !!closes && Date.parse(user.createdAt) < closes;
}

function referralsForReward() {
  return parseInt(process.env.REFERRALS_FOR_REWARD || '3', 10);
}

function cap() {
  return parseInt(process.env.FOUNDING_CAP || '100', 10);
}

// Date and time labels for page copy, all in Eastern time.
const ET = 'America/New_York';
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: ET }) : null);
const fmtDay = (t) => (t ? new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: ET }) : null);
const fmtShort = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: ET }).toUpperCase() : null);
// "10am ET", "11:59pm ET"
function fmtTime(t) {
  if (!t) return null;
  const s = new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET });
  return s.replace(':00', '').replace(/\s?([AP])M$/i, (m, x) => x.toLowerCase() + 'm') + ' ET';
}
// "Tue, Nov 17" (homepage bars and lines)
const fmtAbbr = (t) => (t ? new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: ET }) : null);
const etDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: ET });
// "N spots left" is only ever shown at this many or fewer (offer.md section 5).
const SHOW_SPOTS_AT = 25;
const dayOf = (t) => (t ? new Date(t).toLocaleDateString('en-US', { day: 'numeric', timeZone: ET }) : null);

// The Day One Challenge cross-promo shows while challenge registration is open
// (CHALLENGE_START_AT blank is the challenge's kill switch, so the card hides too).
function challenge() {
  const start = date('CHALLENGE_START_AT');
  const regCloses = date('CHALLENGE_REG_CLOSES_AT');
  const early = date('EARLY_ACCESS_AT');
  if (!start) return { on: false, open: false };
  const end = start + 4 * 864e5;
  const noComma = (t) => fmtAbbr(t).replace(',', '');
  return {
    on: true,
    open: !!regCloses && Date.now() < regCloses,
    regClosesAt: regCloses,
    // "Mon Nov 9", "Fri Nov 13", "Fri Nov 13, 12pm ET"
    startAbbr: noComma(start),
    endAbbr: noComma(end),
    regClosesLabel: regCloses ? `${noComma(regCloses)}, ${fmtTime(regCloses)}` : null,
    // "NOV 9 TO 13" and "November 9 to 13"
    datesShort: `${fmtShort(start)} TO ${dayOf(end)}`,
    dates: `${fmtDate(start)} to ${dayOf(end)}`,
    earlyTime: early ? fmtTime(early).replace(/[ap]m ET$/, '') : null, // "9"
  };
}

function view() {
  const price = parseInt(process.env.FOUNDING_PRICE || '', 10);
  const launchAt = date('LAUNCH_AT');
  const closesAt = date('FOUNDING_CLOSES_AT');
  // A close of midnight ET reads as the day before ("until November 24", "11:59pm ET").
  const closesLabelAt = closesAt && closesAt - 60 * 1000;
  const open = foundingOpen();
  const spotsLeft = Math.max(0, cap() - foundingSubscribers());
  const callAt = date('FOUNDING_CALL_AT');
  return {
    prelaunch: prelaunch(),
    foundingOpen: open,
    foundingPrice: Number.isFinite(price) ? price : null,
    launchAt,
    closesAt,
    launchDate: fmtDate(launchAt),
    closesDate: fmtDate(closesLabelAt),
    launchDay: fmtDay(launchAt), // "Tuesday, November 17"
    closesDay: fmtDay(closesLabelAt),
    launchShort: fmtShort(launchAt), // "NOV 17"
    closesShort: fmtShort(closesLabelAt),
    launchTime: fmtTime(launchAt), // "10am ET"
    closesTime: fmtTime(closesLabelAt), // "11:59pm ET"
    launchAbbr: fmtAbbr(launchAt), // "Tue, Nov 17"
    closesAbbr: fmtAbbr(closesLabelAt),
    cap: cap(),
    spotsLeft,
    showSpots: open && spotsLeft <= SHOW_SPOTS_AT,
    // On the close date (Eastern), the founding bar switches to its last-day copy and can't be hidden.
    lastDay: !!(open && closesLabelAt && etDay(Date.now()) === etDay(closesLabelAt)),
    foundingCallAt: callAt,
    foundingCall: callAt ? `${fmtDay(callAt)} at ${fmtTime(callAt)}` : null, // "Tuesday, December 1 at 8pm ET"
    challenge: challenge(),
    referralsForReward: referralsForReward(),
  };
}

// Homepage state (conversion/pages/homepage.md section 1). prelaunch comes first because foundingOpen
// is also true before doors open. A1 while Day One Challenge sign-ups are open, then A2.
function homeState(v = view()) {
  if (v.prelaunch) return v.challenge && v.challenge.open ? 'A1' : 'A2';
  return v.foundingOpen ? 'B' : 'C';
}

module.exports = { homeState, claimFoundingNumber, foundingSubscribers, prelaunch, foundingOpen, isFoundingMember, onWaitlist, referralsForReward, view, date };
