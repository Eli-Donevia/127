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

function view() {
  const price = parseInt(process.env.FOUNDING_PRICE || '', 10);
  const launchAt = date('LAUNCH_AT');
  const closesAt = date('FOUNDING_CLOSES_AT');
  const fmt = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' }) : null);
  return {
    prelaunch: prelaunch(),
    foundingOpen: foundingOpen(),
    foundingPrice: Number.isFinite(price) ? price : null,
    launchAt,
    closesAt,
    launchDate: fmt(launchAt),
    // A close of midnight ET reads as the day before ("until November 24").
    closesDate: fmt(closesAt && closesAt - 60 * 1000),
    referralsForReward: referralsForReward(),
  };
}

module.exports = { claimFoundingNumber, foundingSubscribers, prelaunch, foundingOpen, isFoundingMember, onWaitlist, referralsForReward, view, date };
