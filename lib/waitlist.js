// Founding-member waitlist with referral codes. Shared by /founding, the
// lead-magnet endpoint (/api/waitlist) and signup.

const crypto = require('crypto');
const db = require('./db');
const security = require('./security');
const integrations = require('./integrations');
const launch = require('./launch');
const consent = require('./consent');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L look-alikes
const SOURCES = ['founding', 'quiz', 'stack', 'idea-test', 'home', 'other'];

let fallbackBase = 'https://127group.io';
function baseUrl() {
  return process.env.BASE_URL || fallbackBase;
}
// Without BASE_URL (local dev), links use the host the request came in on.
function useHost(base) {
  if (!process.env.BASE_URL && base) fallbackBase = base;
}
function newCode() {
  for (;;) {
    let c = '';
    const bytes = crypto.randomBytes(6);
    for (const b of bytes) c += ALPHABET[b % ALPHABET.length];
    if (!byCode(c)) return c;
  }
}
function byCode(code) {
  const c = String(code || '').toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? db.find('waitlist', (w) => w.referralCode === c) : null;
}
function ipHash(ip) {
  return security.hash(`${process.env.SESSION_SECRET || 'dev'}:${ip}`).slice(0, 24);
}
// The consent wording a joiner saw depends on the form they used.
const PAGE = { quiz: 'founder-score', stack: 'day-one-stack', 'idea-test': 'idea-test' };
const consentPage = (source) => PAGE[source] || 'founding';

function link(entry) {
  return `${baseUrl()}/f/${entry.referralCode}`;
}

// Returns { entry, existing, confirmUrl }. confirmUrl is only returned for new or unconfirmed entries.
async function join({ email, firstName, optIn, source, ref, utm = {}, ip }) {
  email = String(email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email.' };
  const existing = launch.onWaitlist(email);
  if (existing) {
    // Re-submitting a known email shows their link; a newly ticked box still counts as consent.
    if (optIn && !existing.marketingOptIn) {
      existing.marketingOptIn = true;
      existing.consentHistory = [...(existing.consentHistory || []), existing.consent].filter(Boolean);
      existing.consent = consent.record(consentPage(source), true, ipHash(ip));
      await db.save('waitlist', existing);
      integrations.syncConsent(email, true, 'KLAVIYO_WAITLIST_LIST_ID');
      integrations.emit('waitlist.profile', { email, profile: profileFor(existing) });
    }
    return { entry: existing, existing: true, confirmUrl: existing.confirmedAt ? null : await refreshConfirm(existing) };
  }
  const referrer = byCode(ref);
  const t = security.token();
  const entry = await db.save('waitlist', {
    email,
    firstName: String(firstName || '').trim().slice(0, 60),
    referralCode: newCode(),
    referredBy: referrer ? referrer.referralCode : null,
    referralCount: 0,
    confirmedAt: null,
    confirmHash: security.hash(t),
    marketingOptIn: !!optIn,
    consent: consent.record(consentPage(source), optIn, ipHash(ip)),
    source: SOURCES.includes(source) ? source : 'founding',
    utm: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => [k, utm[k] ? String(utm[k]).slice(0, 100) : null])),
    ipHash: ipHash(ip),
  });
  const confirmUrl = `${baseUrl()}/founding/confirm?token=${t}`;
  integrations.emit('waitlist.joined', {
    email,
    source: entry.source,
    referred_by: entry.referredBy,
    utm_source: entry.utm.utm_source,
    utm_campaign: entry.utm.utm_campaign,
    profile: profileFor(entry, confirmUrl),
  });
  // Off (default): only a ticked box joins the launch list. On: joining is launch consent until the close.
  if (consent.optins(entry.marketingOptIn).launch_optin) integrations.syncConsent(email, true, 'KLAVIYO_WAITLIST_LIST_ID');
  sendConfirm(entry, confirmUrl);
  return { entry, existing: false, confirmUrl };
}

function profileFor(entry, confirmUrl) {
  return {
    first_name: entry.firstName || undefined,
    founding_member: true,
    ...consent.optins(entry.marketingOptIn),
    consent_version: entry.consent ? entry.consent.version : undefined,
    founding_price_available: launch.foundingOpen(),
    referral_code: entry.referralCode,
    referral_link: link(entry),
    referral_count: entry.referralCount || 0,
    referred_by: entry.referredBy || undefined,
    signup_source: entry.source,
    source_keyword: (entry.utm && entry.utm.utm_content) || undefined,
    waitlist_confirm_url: confirmUrl || undefined,
  };
}

// Klaviyo flow A1 sends the confirm email from waitlist_confirm_url. Without Klaviyo, Resend sends it.
function sendConfirm(entry, confirmUrl) {
  if (process.env.KLAVIYO_PRIVATE_KEY) return;
  integrations.sendEmail({
    to: entry.email,
    subject: 'Confirm your founding spot',
    text: `${entry.firstName ? entry.firstName + ', tap' : 'Tap'} to confirm your spot on the 127 founding list:\n\n${confirmUrl}\n\nConfirm so your invite link counts and we can reach you on open day.\n\nYour invite link: ${link(entry)}\n\n127`,
  });
}

async function refreshConfirm(entry) {
  const t = security.token();
  entry.confirmHash = security.hash(t);
  await db.save('waitlist', entry);
  const url = `${baseUrl()}/founding/confirm?token=${t}`;
  integrations.emit('waitlist.profile', { email: entry.email, profile: profileFor(entry, url) });
  return url;
}

async function confirm(token) {
  const h = security.hash(String(token || ''));
  const entry = db.find('waitlist', (w) => w.confirmHash && security.sameHash(w.confirmHash, h));
  if (!entry) return null;
  const firstTime = !entry.confirmedAt;
  if (firstTime) {
    entry.confirmedAt = new Date().toISOString();
    integrations.emit('waitlist.confirmed', { email: entry.email, referred_by: entry.referredBy, profile: profileFor(entry) });
    const referrer = entry.referredBy && byCode(entry.referredBy);
    if (referrer && !entry.counted && referrer.email !== entry.email) {
      entry.counted = true;
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      // Same network within 24 hours: still counts, flagged for a look in /admin.
      if (referrer.ipHash === entry.ipHash && Date.parse(entry.createdAt) - Date.parse(referrer.createdAt) < 24 * 60 * 60 * 1000) entry.flagged = true;
      await db.save('waitlist', referrer);
      integrations.emit('referral.counted', {
        email: referrer.email,
        referral_count: referrer.referralCount,
        friend_first_name: entry.firstName || null,
        profile: profileFor(referrer),
      });
    }
  }
  await db.save('waitlist', entry);
  return { entry, firstTime };
}

function stats() {
  const all = db.all('waitlist');
  const bySource = {};
  for (const w of all) bySource[w.source] = (bySource[w.source] || 0) + 1;
  return {
    total: all.length,
    confirmed: all.filter((w) => w.confirmedAt).length,
    optedIn: all.filter((w) => w.marketingOptIn).length,
    bySource,
    topReferrers: all.filter((w) => w.referralCount > 0).sort((a, b) => b.referralCount - a.referralCount).slice(0, 10),
    flagged: all.filter((w) => w.flagged),
    reward: all.filter((w) => w.referralCount >= launch.referralsForReward()).length,
  };
}

module.exports = { join, confirm, byCode, link, stats, useHost, SOURCES };
