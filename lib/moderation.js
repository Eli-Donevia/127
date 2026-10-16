// Pre-screen for member posts (the wins board today; any future community space).
//
// Pure and deterministic, so the app can run it on every post before it goes live.
// It decides one of three things:
//   allow - the post goes up now
//   hold  - the post waits in /admin/ops until a person (or the daily moderation
//           review, which only recommends) looks at it
//   block - the post is refused with a kind message (slurs, sexual content, exact repeats)
// Anything that might mean someone is in danger also sets `urgent` (Eli hears the
// same hour) and `crisis` (the poster is shown 988 / crisis resources right away).
//
// The rules follow ops/members/policies/moderation-policy.md. They are tuned to let
// real wins through: "First sale, $40!" or "quit my 9-5" are wins, not hype.
// Words are matched case-insensitively on whole words; tests live in test/moderation.test.js.

const TERMS = require('./moderation-terms.json');

const RE = {
  url: /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9][a-z0-9-]*\.(?:com|io|co|net|org|app|ai|xyz|shop|store|link|me|gg|ly|biz|info|us|tv|site|online|club)(?:\/[^\s]*)?\b/gi,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  phone: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
  handleWithAsk: /\b(?:dm|message|text|call|add|hmu|hit me up|follow|snap|sc)\b[^.!?\n]{0,25}@[a-z0-9_.]{2,}|@[a-z0-9_.]{2,}[^.!?\n]{0,25}\b(?:dm|message me|text me|hmu|hit me up)\b/i,
  offPlatform: /\b(?:whats\s?app|telegram|signal app|kik|snapchat|discord\.gg|t\.me|wa\.me|cash\s?app|venmo|zelle|paypal\.me)\b/i,
  // Crypto wallet addresses and Cash App $cashtags: someone asking to be paid.
  wallet: /\b(?:0x[a-f0-9]{40}|bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b|(?:^|\s)\$[a-z][a-z0-9_]{2,19}\b/i,
  // The poster says they are under 18 (every member must be 18+, Legal L1).
  underAge: /\b(?:i'?m|i\s+am|im)\s+(?:only\s+|just\s+)?(?:1[0-7])(?:\s*(?:yo|y\/o|years?[\s-]+old|yrs?[\s-]+old))?(?=\s*(?:[.,!?;:)]|$|and\b|but\b|so\b|&|yo\b|y\/o|years?\b|yrs?\b))|\bas\s+a\s+1[0-7][\s-]*(?:yo|y\/o|years?[\s-]+old)\b|\b(?:i'?m|i\s+am|im)\s+(?:a\s+)?(?:in\s+high\s+school|high\s+school(?:er|\s+(?:freshman|sophomore|junior|senior|student)))\b/i,
  moneyRate: /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|K)?\s*(?:\/|per|a|an|every)\s*(day|week|wk|month|mo|year|yr)\b/g,
  bigMoney: /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|K|m|M)?\b/g,
};

const PERIOD_TO_MONTH = { day: 30, week: 4.33, wk: 4.33, month: 1, mo: 1, year: 1 / 12, yr: 1 / 12 };

function words(list) {
  return new RegExp(`\\b(?:${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');
}

const LISTS = {
  crisis: new RegExp(TERMS.crisis.join('|'), 'i'),
  crisisMention: new RegExp(TERMS.crisis_mention.join('|'), 'i'),
  threat: new RegExp(TERMS.threat.join('|'), 'i'),
  slur: words(TERMS.slur),
  sexual: words(TERMS.sexual),
  strongProfanity: words(TERMS.strong_profanity),
  scam: words(TERMS.scam),
  hype: words(TERMS.hype),
  cta: words(TERMS.cta),
  shortener: words(TERMS.shortener_domains),
  minor: words(TERMS.minor),
};

function amount(num, suffix) {
  const n = parseFloat(String(num).replace(/,/g, ''));
  if (!Number.isFinite(n)) return 0;
  const s = (suffix || '').toLowerCase();
  return s === 'k' ? n * 1000 : s === 'm' ? n * 1000000 : n;
}

// Largest money-per-month claim in the text ("$10k/month", "$500 a day").
function monthlyClaim(text) {
  let max = 0;
  for (const m of text.matchAll(RE.moneyRate)) {
    const perMonth = amount(m[1], m[2]) * (PERIOD_TO_MONTH[m[3].toLowerCase()] || 1);
    max = Math.max(max, perMonth);
  }
  return Math.round(max);
}

function largestAmount(text) {
  let max = 0;
  for (const m of text.matchAll(RE.bigMoney)) max = Math.max(max, amount(m[1], m[2]));
  return max;
}

function links(text) {
  return [...String(text).matchAll(RE.url)].map((m) => m[0]);
}

function normalize(text) {
  return String(text || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text  the post
 * @param {object} ctx   { accountAgeDays, postsToday, recentTexts: [string], tier }
 * @param {object} cfg   moderation config (ops/members/config.json "moderation")
 */
function screen(text, ctx = {}, cfg = {}) {
  const t = normalize(text);
  const reasons = [];
  let action = 'allow';
  let urgent = false;
  let crisis = false;
  const raise = (to) => {
    const order = { allow: 0, hold: 1, block: 2 };
    if (order[to] > order[action]) action = to;
  };
  const why = (code, label, to) => {
    reasons.push({ code, label });
    raise(to);
  };

  if (!t) return { action: 'block', reasons: [{ code: 'empty', label: 'Empty post' }], urgent, crisis, tags: [] };

  // Safety first: a person may be at risk. Never auto-publish, always tell Eli.
  if (LISTS.crisis.test(t)) {
    crisis = true;
    urgent = true;
    why('crisis', 'Possible self-harm or crisis language', 'hold');
  } else if (LISTS.crisisMention.test(t)) {
    // "Ran a suicide-prevention fundraiser" is a win; a person checks before it goes up.
    urgent = true;
    why('crisis_mention', 'Mentions suicide or self-harm', 'hold');
  }
  if (LISTS.threat.test(t)) {
    urgent = true;
    why('threat', 'Possible threat of violence', 'hold');
  }

  if (LISTS.slur.test(t)) why('slur', 'Slur or hate speech', 'block');
  if (LISTS.sexual.test(t)) {
    // Sexual content that mentions a minor is kept (hidden) for Eli to preserve and report, never just refused.
    if (LISTS.minor.test(t)) {
      urgent = true;
      why('minor_sexual', 'Sexual content that mentions a minor (keep it, Eli reports it)', 'hold');
    } else why('sexual', 'Sexual content', 'block');
  }
  if (LISTS.strongProfanity.test(t)) why('profanity', 'Strong profanity', 'hold');

  const recent = (ctx.recentTexts || []).map(normalize);
  if (recent.some((r) => r && r.toLowerCase() === t.toLowerCase())) why('duplicate', 'Same text posted again', 'block');
  const maxPosts = cfg.max_posts_per_day || 5;
  if ((ctx.postsToday || 0) >= maxPosts) why('rate', `More than ${maxPosts} posts today`, 'hold');

  // Privacy and scams: no contact details, payment handles or invitations to move the
  // conversation somewhere private, from anyone.
  if (RE.email.test(t) || RE.phone.test(t)) why('contact_info', 'Shares an email address or phone number', 'hold');
  if (RE.handleWithAsk.test(t) || RE.offPlatform.test(t)) why('off_platform', 'Invites people to message or pay off the platform', 'hold');
  if (RE.wallet.test(t)) why('payment_handle', 'Crypto wallet or payment handle', 'hold');
  // Every member must be 18+. The post waits and Eli reviews the account.
  if (RE.underAge.test(t)) why('under_18', 'Poster says they are under 18 (review the account)', 'hold');

  const found = links(t);
  if (found.length) {
    const newAccount = (ctx.accountAgeDays == null ? 0 : ctx.accountAgeDays) < (cfg.new_account_link_hold_days || 14);
    if (found.some((l) => LISTS.shortener.test(l))) why('short_link', 'Shortened or messaging link', 'hold');
    else if (newAccount) why('new_member_link', 'Link from a member in their first two weeks', 'hold');
    else if (found.length > 1) why('many_links', 'More than one link', 'hold');
    if (LISTS.cta.test(t)) why('promo', 'Link with a sales pitch (the wins board is not for ads)', 'hold');
  }

  if (LISTS.scam.test(t)) why('scam', 'Crypto, forex, MLM or "investment" pitch', 'hold');

  const threshold = cfg.income_claim_monthly_threshold || 5000;
  const perMonth = monthlyClaim(t);
  const hype = LISTS.hype.test(t);
  const cta = LISTS.cta.test(t) || found.length > 0;
  if (perMonth >= threshold && (hype || cta)) why('income_claim', `Income claim of about $${perMonth.toLocaleString('en-US')}/month with a pitch`, 'hold');
  else if (hype && cta) why('hype_pitch', 'Get-rich language with a call to action', 'hold');
  else if (largestAmount(t) >= 100000 && hype) why('big_claim', 'Very large money claim with get-rich language', 'hold');

  // Dollar figures don't hold a post, but they are tagged so nobody reuses the post in
  // marketing without the member's written OK and a typical-results line (Legal L12).
  const tags = [];
  if (largestAmount(t) > 0 || perMonth > 0) tags.push('money');

  return { action, reasons, urgent, crisis, tags };
}

// Reports from members: hide once enough different people report it, or at once
// for a safety report. A hidden post waits for a person in /admin/ops.
function afterReports(reports = [], cfg = {}) {
  const need = cfg.hide_after_reports || 2;
  const reporters = new Set(reports.map((r) => r.userId || r.by).filter(Boolean));
  const safety = reports.some((r) => r.reason === 'safety');
  return { hide: safety || reporters.size >= need, urgent: safety, reporters: reporters.size };
}

const CRISIS_MESSAGE =
  "It sounds like things might be really heavy right now. You don't have to carry this alone. In the US you can call or text 988, or chat at 988lifeline.org, any time. If you're in danger right now, call 911. Eli will read your post himself, but this space isn't watched around the clock.";

module.exports = { screen, afterReports, monthlyClaim, links, CRISIS_MESSAGE };
