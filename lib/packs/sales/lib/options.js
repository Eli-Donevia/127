// Three options, the most complete first (good, better, best shown best first). From the member's
// own options when they give them; otherwise built from their main price and the niche's
// included / better / best lists, clearly labeled so they check the prices before sending.

const { text, money } = require('../../_kit');
const items = require('./items');

const MONTHLY = new Set(['social', 'video', 'reviews', 'bookkeeping']);
const NAMES = { best: 'Complete', better: 'Standard', good: 'Starter' };

function unitFor(profile) {
  if (MONTHLY.has(profile.id)) return 'month';
  if (profile.arch === 'b2b') return 'project';
  return profile.job || 'job';
}

function perText(unit) {
  if (!unit) return '';
  if (unit === 'project' || unit === 'one time') return 'one time';
  return `per ${unit}`;
}

// "Complete, 1500, everything in Standard; monthly care plan; priority changes"
// "Starter | 600 | one-page site; contact button"
function parseOptionLines(raw) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const parts = line.includes('|') ? line.split('|').map((x) => x.trim()) : line.split(/\s*,\s*(?![0-9]{3}\b)/);
    const at = parts.findIndex((p, i) => i > 0 && items.priceToken(p));
    if (at < 1) continue;
    const t = items.priceToken(parts[at]);
    const name = text.clip(parts.slice(0, at).join(', '), 40);
    const rest = parts.slice(at + 1).join(', ');
    const includes = rest
      .split(/\s*;\s*|\s+\+\s+/)
      .map((x) => text.sentenceCase(text.oneLine(x)))
      .filter(Boolean)
      .slice(0, 10);
    if (name && t.price > 0) out.push({ name, price: t.price, unit: t.unit || '', includes });
  }
  return out.slice(0, 3);
}

function cleanGiven(list) {
  return (Array.isArray(list) ? list : [])
    .filter((o) => o && (o.name || o.label) && money.num(o.price, null) > 0)
    .map((o) => ({
      name: text.clip(o.name || o.label, 40),
      price: money.num(o.price, 0),
      unit: items.normUnit(o.unit) || (o.unit ? text.clip(o.unit, 20) : ''),
      summary: text.clip(o.summary || o.detail || '', 160),
      includes: (Array.isArray(o.includes) ? o.includes : String(o.includes || '').split(/\s*;\s*/)).map((x) => text.sentenceCase(text.oneLine(x))).filter(Boolean).slice(0, 10),
    }))
    .slice(0, 3);
}

// Returns { options: [best, better, good], built: true when prices came from the main price }.
function threeOptions({ given, typed, price, profile, currency = 'USD' }) {
  let list = cleanGiven(given);
  if (!list.length) list = cleanGiven(parseOptionLines(typed));
  const unit = unitFor(profile);
  let built = false;
  if (!list.length) {
    if (!(price > 0)) return { options: [], built: false };
    built = true;
    const inc = profile.included || [];
    const better = profile.better || [];
    const best = profile.best || [];
    list = [
      { name: NAMES.good, price, unit, includes: inc.slice(0, 4) },
      { name: NAMES.better, price: money.nicePrice(price * 1.6), unit, includes: [...inc.slice(0, 4), ...better.slice(0, 3)] },
      { name: NAMES.best, price: money.nicePrice(price * 2.5), unit, includes: [...inc.slice(0, 4), ...better.slice(0, 3), ...best.slice(0, 3)] },
    ];
  }
  // Most complete first: by price, highest first, when they're paid the same way. Ties keep their order,
  // and so does a mix (a price per month isn't smaller than one paid once because its number is).
  const same = new Set(list.map((o) => perText(o.unit || unit))).size <= 1;
  const sorted = list.map((o, i) => ({ ...o, i })).sort((a, b) => (same ? b.price - a.price : 0) || a.i - b.i);
  const n = sorted.length;
  const keys = n === 3 ? ['best', 'better', 'good'] : n === 2 ? ['best', 'good'] : ['best'];
  const options = sorted.map((o, idx) => {
    const u = o.unit || unit;
    const cents = Math.round(o.price * 100);
    return {
      key: keys[idx],
      name: o.name,
      price: o.price,
      unit: u,
      per: perText(u),
      priceText: items.money(cents, currency, { short: true }),
      summary: o.summary || '',
      includes: o.includes || [],
      recommended: n === 3 ? idx === 1 : idx === 0,
    };
  });
  // Lists after the first say "Everything in X, plus" instead of repeating lines.
  for (let k = options.length - 2; k >= 0; k--) {
    const lower = options[k + 1];
    const cur = options[k];
    const extra = cur.includes.filter((x) => !lower.includes.some((y) => y.toLowerCase() === x.toLowerCase()));
    cur.plus = extra.length && extra.length < cur.includes.length ? { of: lower.name, extra } : null;
  }
  options[options.length - 1].plus = null;
  return { options, built };
}

// Options paid different ways (one time, per month) can't be ranked or added up by their numbers.
const mixed = (opts) => new Set((opts || []).map((o) => o.per)).size > 1;

module.exports = { threeOptions, parseOptionLines, unitFor, perText, mixed, NAMES, MONTHLY };
