// Reads what members type into the money desk: amounts ("$1,200", "1.2k"), costs with how often
// they're paid ("Insurance 55 a month", "Vacuum, have it"), and price lines ("Deep clean, 250,
// 180 min, 20"). Pure functions, no I/O. Anything we can't read is skipped and reported, never guessed.

const { text, money } = require('../../_kit');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// "$1,200.50" -> 1200.5, "1.2k" -> 1200, "" -> null
function amount(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).match(/-?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k)?\b/i);
  if (!m) return money.num(v, null);
  const n = Number(`${m[1].replace(/,/g, '')}${m[2] || ''}`) * (m[3] ? 1000 : 1);
  return Number.isFinite(n) ? n : null;
}

// A number the member typed into a form field, or null. Negative numbers become null.
function positive(v) {
  const n = amount(v);
  return n != null && n >= 0 ? n : null;
}

// Percent from "27%", "27", 0.27 -> 0.27. Values above 1 are read as percents.
function percent(v, fallback = null) {
  if (v == null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n > 1 ? n / 100 : n;
}

const FREQ = [
  ['week', /\b(a|per|each|every)\s+(week|wk)\b|\bweekly\b|\/\s*(week|wk)\b/i],
  ['month', /\b(a|per|each|every)\s+(month|mo)\b|\bmonthly\b|\/\s*(month|mo)\b|\bmo\b\.?$|\bper mo\b/i],
  ['year', /\b(a|per|each|every)\s+(year|yr)\b|\b(yearly|annual|annually)\b|\/\s*(year|yr)\b/i],
];
const FREQ_WORDS = /\b(a|per|each|every)\s+(week|wk|month|mo|year|yr)\b|\b(weekly|monthly|yearly|annual|annually)\b|\/\s*(week|wk|month|mo|year|yr)\b|\bmo\b\.?$/gi;
const OWNED = /\b(have it|have one|have them|already (have|own|got)|own it|own one|owned|got it|got one)\b/i;
const FREE = /\b(free|no cost)\b/i;

function cleanName(s, fallback) {
  const t = text
    .oneLine(String(s || ''))
    .replace(/^[=+@\-*•\s]+/, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*[:=,;\-]+\s*$/g, '')
    .replace(/^\s*[:=,;]+\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t ? text.sentenceCase(t).slice(0, 80) : fallback;
}

// One cost line. Returns { name, amount, freq: 'once' | 'month' | 'year', explicit, owned, weekly } or
// null. `explicit` is false when the line never said how often ("Insurance 55").
function costLine(line) {
  let s = String(line || '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
  if (!s) return null;
  let freq = 'once';
  let explicit = /\b(one[- ]time|once)\b/i.test(s);
  for (const [f, re] of FREQ) {
    if (re.test(s)) {
      freq = f;
      explicit = true;
      break;
    }
  }
  const owned = OWNED.test(s);
  const isFree = FREE.test(s);
  const m = s.match(/-?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k)?\b/i);
  let value = m ? amount(m[0]) : null;
  if (m) s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`;
  if (value == null && (owned || isFree)) value = 0;
  s = s.replace(FREQ_WORDS, ' ').replace(OWNED, ' ').replace(/\b(one[- ]time|once)\b/gi, ' ').replace(/\b(already|it's|its|is)\b/gi, ' ');
  if (isFree) s = s.replace(FREE, ' ');
  const name = cleanName(s.replace(/\(\s*(have|own|free)?\s*\)/gi, ''), null);
  if (!name && value == null) return null;
  let weekly = false;
  if (freq === 'week') {
    weekly = true;
    freq = 'month';
    if (value != null) value = round2((value * 52) / 12);
  }
  return { name: name || 'Item', amount: value == null ? null : round2(value), freq, explicit, owned: owned || false, weekly };
}

function lines(textOrList) {
  if (Array.isArray(textOrList)) return textOrList;
  return String(textOrList || '')
    .split(/\r?\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Costs typed one per line, or [{ name, amount, freq }]. Returns { items, skipped }.
function costs(input) {
  const items = [];
  const skipped = [];
  for (const raw of lines(input)) {
    if (raw && typeof raw === 'object') {
      const name = cleanName(raw.name || raw.item || raw.label, 'Item');
      const value = amount(raw.amount != null ? raw.amount : raw.cost != null ? raw.cost : raw.price);
      const f = String(raw.freq || raw.every || 'once').toLowerCase();
      const freq = /month/.test(f) ? 'month' : /year|annual/.test(f) ? 'year' : 'once';
      items.push({ name, amount: value == null ? null : round2(value), freq, explicit: !!(raw.freq || raw.every), owned: !!raw.owned, weekly: false });
      continue;
    }
    const c = costLine(raw);
    if (c) items.push(c);
    else skipped.push(String(raw));
  }
  return { items: items.slice(0, 60), skipped };
}

const UNIT = /^(hours?|hrs?|h|minutes?|mins?|min|m|miles?|mi)$/i;

// One price line: "Deep clean, 250, 180 min, 20" or "Basic detail $120 90min $15 supplies 12 miles".
// The first money amount is the price, the second the cost per job. Returns { label, price, minutes,
// cost, miles } or null when there is no price.
function priceLine(line, n = 1) {
  const s = String(line || '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
  if (!s) return null;
  let label = '';
  let rest = s;
  const sep = s.match(/^([^,:;|]+?)\s*(?:[,:;|]|\s-\s)\s*(.+)$/);
  if (sep && /\d/.test(sep[2])) {
    label = sep[1];
    rest = sep[2];
  } else {
    const first = s.search(/\$|\d/);
    label = first > 0 ? s.slice(0, first) : '';
    rest = first >= 0 ? s.slice(first) : '';
  }
  const moneys = [];
  let minutes = 0;
  let miles = null;
  // "Walk 30 min, 25": a time or distance inside the name belongs to the job, not the name.
  label = label.replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|miles?|mi)\b/gi, (all, num, unit) => {
    const v = Number(num);
    if (/^h/i.test(unit)) minutes += v * 60;
    else if (/^mi(?!n)/i.test(unit)) miles = v;
    else minutes += v;
    return ' ';
  });
  const re = /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k\b)?\s*([a-z]+)?/gi;
  let m;
  while ((m = re.exec(rest))) {
    const n2 = Number(m[2].replace(/,/g, '')) * (m[3] ? 1000 : 1);
    const unit = (m[4] || '').toLowerCase();
    if (UNIT.test(unit)) {
      if (/^h/.test(unit)) minutes += n2 * 60;
      else if (/^mi(?!n)/.test(unit)) miles = n2;
      else minutes += n2;
    } else moneys.push(n2);
  }
  if (!moneys.length) return null;
  return {
    label: cleanName(label, `Service ${n}`),
    price: round2(moneys[0]),
    cost: moneys.length > 1 ? round2(moneys[1]) : null,
    minutes: minutes || null,
    miles,
  };
}

// Price lines typed one per line, or [{ label|name, price, cost, minutes, miles }] (a kit quote
// menu's packages work as they are). Returns { items, skipped }.
function prices(input) {
  const items = [];
  const skipped = [];
  lines(input).forEach((raw, i) => {
    if (raw && typeof raw === 'object') {
      const price = amount(raw.price);
      if (price == null || price <= 0) {
        skipped.push(String(raw.label || raw.name || `Item ${i + 1}`));
        return;
      }
      items.push({
        label: cleanName(raw.label || raw.name || raw.service, `Service ${i + 1}`),
        price: round2(price),
        cost: amount(raw.cost != null ? raw.cost : raw.costPerJob != null ? raw.costPerJob : raw.supplies),
        minutes: amount(raw.minutes),
        miles: amount(raw.miles),
      });
      return;
    }
    const p = priceLine(raw, i + 1);
    if (p && p.price > 0) items.push(p);
    else skipped.push(String(raw));
  });
  return { items: items.slice(0, 40), skipped };
}

module.exports = { amount, positive, percent, costLine, costs, priceLine, prices, lines, cleanName, round2 };
