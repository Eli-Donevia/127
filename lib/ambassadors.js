// Ambassador pay counts for Growth (ops/growth/ambassadors, BOS: $10 per paying member after 30 days; Legal L90).
//
// Counts only, never names or emails: per month and ambassador link (utm_content on a utm_source=ambassador link),
// the paid joins still paying 30 days after their first paid charge.
//
// Who counts (Legal L90): the ambassador's link was the first tracked 127 link the person opened on the device they
// joined from, within the 30 days before joining. server.js keeps that first link in the session (firstLink: an
// ambassador link, any other tagged link, or a referral link) and createMember copies it onto the account. A join that
// counts here never also earns a referral month (lib/referrals.js voids utm_source=ambassador).
//
// Still paying at day 30: planHistory says Builder or the Circle at firstPaidAt + 30 days, and no refund by then.
// A month's row is the month (Chicago time) that 30th day falls in, so a payout counts each member once.
//
// Export: GET /admin/ambassadors.csv?month=YYYY-MM (admin or the export token): month, ambassador, paid_joins.

const DAY = 24 * 60 * 60 * 1000;
const TZ = 'America/Chicago';
const PAID = ['builder', 'circle'];

function ms(v) {
  const t = typeof v === 'number' ? v : Date.parse(v || '');
  return Number.isFinite(t) ? t : null;
}
function monthOf(t) {
  return new Date(t).toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
}

// What the session keeps the first time a tracked link arrives (server.js), or null for an untracked visit.
function firstLinkFrom(utm, refCode, now = Date.now()) {
  if (utm && utm.utm_source) {
    const amb = utm.utm_source === 'ambassador' && utm.utm_content ? String(utm.utm_content).trim().toLowerCase().slice(0, 60) : null;
    return { kind: amb ? 'ambassador' : 'utm', ambassador: amb, at: new Date(now).toISOString() };
  }
  if (refCode) return { kind: 'ref', ambassador: null, at: new Date(now).toISOString() };
  return null;
}

// The ambassador a member's join counts for, or null (L90).
function creditedTo(user) {
  const f = user && user.firstLink;
  if (!f || f.kind !== 'ambassador' || !f.ambassador) return null;
  const joined = ms(user.createdAt);
  const opened = ms(f.at);
  if (!joined || !opened || opened > joined || joined - opened > 30 * DAY) return null;
  return f.ambassador;
}

function tierAt(user, t) {
  let tier = null;
  for (const h of user.planHistory || []) if (ms(h.at) <= t) tier = h.to;
  return tier;
}

// When the member reached 30 paid days still paying, or null.
function day30(user) {
  const first = ms(user.firstPaidAt);
  if (!first) return null;
  const t = first + 30 * DAY;
  const refunded = ms(user.refundedAt);
  if (refunded && refunded <= t) return null;
  return PAID.includes(tierAt(user, t)) ? t : null;
}

// [{ month, ambassador, paid_joins }] for one month ("2026-12"), or every month when month is omitted.
function counts(users, { month, now = Date.now() } = {}) {
  const rows = {};
  for (const u of users) {
    const amb = creditedTo(u);
    if (!amb) continue;
    const t = day30(u);
    if (!t || t > now) continue;
    const m = monthOf(t);
    if (month && m !== month) continue;
    const key = `${m}\t${amb}`;
    rows[key] = (rows[key] || 0) + 1;
  }
  return Object.entries(rows)
    .map(([k, n]) => {
      const [m, a] = k.split('\t');
      return { month: m, ambassador: a, paid_joins: n };
    })
    .sort((x, y) => x.month.localeCompare(y.month) || x.ambassador.localeCompare(y.ambassador));
}

function csv(rows) {
  const esc = (v) => {
    const t = String(v == null ? '' : v);
    return /^[=+\-@\t\r]/.test(t) ? `'${t}` : /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return ['month,ambassador,paid_joins', ...rows.map((r) => [r.month, r.ambassador, r.paid_joins].map(esc).join(','))].join('\n') + '\n';
}

// The roster (Agreement 11): a member is an ambassador from user.ambassador.since until .until, set by an admin on
// /admin/market. While they are one, their pay replaces referral months, whichever link a friend used (Membership
// Terms 5A; Legal L101 RF9), and their Invite page discloses the commission instead of the free month.
function isAmbassador(user, t = Date.now()) {
  if (!user) return false;
  return [user.ambassador].concat(user.ambassadorHistory || []).some((a) => {
    const since = a && ms(a.since);
    const until = a && ms(a.until);
    return since != null && since <= t && (until == null || t < until);
  });
}
const roster = (users, now = Date.now()) => users.filter((u) => isAmbassador(u, now)).map((u) => ({ id: u.id, email: u.email, handle: (u.ambassador && u.ambassador.handle) || null, since: u.ambassador ? u.ambassador.since : null }));

module.exports = { firstLinkFrom, creditedTo, day30, counts, csv, monthOf, isAmbassador, roster };
