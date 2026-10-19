// Line items, money and totals for quotes and invoices. Math runs in whole cents so a quote never
// shows $0.01 drift: line = qty x price (rounded to the cent), tax on the taxable subtotal (rounded
// half up), deposit as a share of the total (or a fixed amount), balance = total - deposit - paid.
// Pure functions: tests import these directly.

const { text } = require('../../_kit');

const UNITS = {
  hour: 'hour', hours: 'hour', hr: 'hour', hrs: 'hour', h: 'hour',
  visit: 'visit', visits: 'visit',
  month: 'month', months: 'month', mo: 'month', mos: 'month',
  week: 'week', weeks: 'week', wk: 'week', wks: 'week',
  day: 'day', days: 'day',
  session: 'session', sessions: 'session', lesson: 'session', lessons: 'session', class: 'session', classes: 'session',
  item: 'item', items: 'item', each: 'item', ea: 'item', pc: 'item', pcs: 'item', piece: 'item', pieces: 'item', unit: 'item', units: 'item',
  job: 'job', jobs: 'job',
  project: 'project', projects: 'project',
  room: 'room', rooms: 'room',
  window: 'window', windows: 'window',
  car: 'car', cars: 'car', vehicle: 'vehicle', vehicles: 'vehicle',
  page: 'page', pages: 'page',
  video: 'video', videos: 'video',
  post: 'post', posts: 'post',
  photo: 'photo', photos: 'photo',
  'sq ft': 'sq ft', sqft: 'sq ft', 'sq. ft.': 'sq ft', 'square feet': 'sq ft', 'square foot': 'sq ft', ft: 'ft', feet: 'ft',
  guest: 'guest', guests: 'guest', person: 'person', people: 'person',
};
// Units that read fine without a word after the quantity ("1" job, "2" items).
const QUIET_UNITS = new Set(['job', 'item', 'each', '']);

function normUnit(u) {
  const k = String(u || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!k) return '';
  return UNITS[k] || UNITS[k.replace(/\.$/, '')] || (k.length <= 14 && /^[a-z ]+$/.test(k) ? k.replace(/s$/, '') : '');
}

function unitWord(unit, qty) {
  const u = normUnit(unit);
  if (!u || QUIET_UNITS.has(u)) return '';
  if (qty === 1) return u;
  if (u === 'sq ft' || u === 'ft') return u;
  if (u === 'person') return 'people';
  return `${u}s`;
}

// ---------- rates ----------

// Tax: 0.0825 and 8.25 and "8.25%" all mean 8.25%. Values of 1 or more are read as a percent.
function parseTax(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^(no|none|n\/a|0)$/i.test(s)) return 0;
  const n = Number(s.replace(/[%\s,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  const r = /%/.test(s) || n >= 1 ? n / 100 : n;
  return r > 0.5 ? null : Math.round(r * 1e6) / 1e6;
}

// Deposit: 0.5, 50, "50%" mean half; "$100" or { amount } means a fixed amount. 1 means pay in full.
function parseDeposit(v, amount) {
  const fixed = amount != null && amount !== '' ? Number(String(amount).replace(/[$,\s]/g, '')) : NaN;
  if (Number.isFinite(fixed) && fixed > 0) return { rate: null, amountCents: Math.round(fixed * 100) };
  if (v == null || v === '') return { rate: null, amountCents: 0 };
  const s = String(v).trim();
  if (/^(no|none|n\/a|0)$/i.test(s)) return { rate: null, amountCents: 0 };
  if (/\$/.test(s)) {
    const n = Number(s.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) && n > 0 ? { rate: null, amountCents: Math.round(n * 100) } : { rate: null, amountCents: 0 };
  }
  const n = Number(s.replace(/[%\s,]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return { rate: null, amountCents: 0 };
  const r = /%/.test(s) || n > 1 ? n / 100 : n;
  return { rate: r > 1 ? null : Math.round(r * 1e4) / 1e4, amountCents: 0 };
}

function pctText(rate) {
  if (rate == null) return '';
  const p = Math.round(rate * 100 * 1000) / 1000;
  return `${p}%`;
}

// ---------- money ----------

const LOCALE = { USD: 'en-US', CAD: 'en-CA', GBP: 'en-GB', EUR: 'en-IE', AUD: 'en-AU', NZD: 'en-NZ' };

function money(cents, currency = 'USD', { short = false } = {}) {
  const n = Math.round(Number(cents) || 0) / 100;
  const whole = Math.round(n * 100) % 100 === 0;
  const digits = short && whole ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALE[currency] || 'en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  } catch {
    return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(digits)}`;
  }
}

const toCents = (dollars) => Math.round((Number(dollars) || 0) * 100);

// ---------- parsing typed lines ----------

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
const PER = String.raw`(?:\s*(?:\/|per\s+|an?\s+)\s*(hour|hr|visit|month|mo|week|wk|day|session|lesson|class|item|job|room|car|window|page|video|post|photo|guest|person|sq\.?\s?ft|square\s+foot|ft|each)\b|\s+(each|ea\.?))?`;
// "$45", "-$20", "45.50/hour", "$60 per visit", "1,200"
const PRICE_RE = new RegExp(String.raw`^(-)?\s*\$?\s*(-)?(${NUM})${PER}$`, 'i');
// "2 x $45", "24 windows x $6 each", "3 hours @ $60/hour", "x2 at $45"
const QTY_PRICE_RE = new RegExp(String.raw`^(?:x\s*)?(\d+(?:\.\d+)?)\s*([a-z][a-z .]{0,12}?)?\s*(?:x|×|@|at)\s*(-)?\s*\$?\s*(${NUM})${PER}$`, 'i');

// "$35 each x 2", "45 x 3"
const PRICE_QTY_RE = new RegExp(String.raw`^(-)?\s*\$?\s*(${NUM})(?:\s*(?:each|ea\.?|\/\s*[a-z]+))?\s*(?:x|×)\s*(\d+(?:\.\d+)?)$`, 'i');

function priceToken(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  let m = t.match(PRICE_QTY_RE);
  if (m && /\$/.test(t)) return { qty: Number(m[3]), price: Number(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1), unit: '' };
  m = t.match(QTY_PRICE_RE);
  if (m) {
    const qty = Number(m[1]);
    const price = Number(m[4].replace(/,/g, '')) * (m[3] ? -1 : 1);
    const unit = normUnit(m[5] || m[6] || m[2] || '');
    if (qty > 0) return { qty, price, unit };
  }
  m = t.match(PRICE_RE);
  if (m) {
    const price = Number(m[3].replace(/,/g, '')) * (m[1] || m[2] ? -1 : 1);
    return { qty: null, price, unit: normUnit(m[4] || m[5] || '') };
  }
  return null;
}

// "2 x Window cleaning ..." or "3 hours design work ..." at the start of a line.
const LEAD_QTY_RE = /^(\d+(?:\.\d+)?)\s*(?:x|×)\s+(.+)$/i;
const LEAD_QTY_UNIT_RE = /^(\d+(?:\.\d+)?)\s+(hours?|hrs?|visits?|sessions?|lessons?|classes|months?|weeks?|days?|rooms?|windows?|cars?|vehicles?|pages?|videos?|posts?|photos?|items?|pieces?|guests?|people)\s+(?:of\s+)?(.+)$/i;

function cleanLabel(s) {
  return text
    .oneLine(String(s || '').replace(/^[\s\-*•·]+/, '').replace(/[\s,:;=\-]+$/, ''))
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s+(?:at|@|for|x|×)$/i, '')
    .trim();
}

// One typed line to an item, or null when there's no price in it.
function parseLine(raw) {
  let s = String(raw || '').replace(/\t/g, ' | ').replace(/[–—]/g, ' - ').trim();
  s = s.replace(/^[\-*•·]\s+/, '').replace(/^\d+[.)]\s+(?=\D)/, '').trim();
  if (!s) return null;

  // Pipes: "label | price" or "label | price | detail" or "label | qty | unit | price | detail".
  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim());
    if (parts.length >= 4) {
      const qty = Number(parts[1]);
      const price = priceToken(parts[3]);
      if (parts[0] && qty > 0 && price) return { label: cleanLabel(parts[0]), detail: text.oneLine(parts.slice(4).join(' ')), qty, unit: normUnit(parts[2]) || price.unit, price: price.price };
    }
    const at = parts.findIndex((p, i) => i > 0 && priceToken(p));
    if (at > 0) {
      const t = priceToken(parts[at]);
      return { label: cleanLabel(parts.slice(0, at).join(' ')), detail: text.oneLine(parts.slice(at + 1).join(', ')), qty: t.qty || 1, unit: t.unit, price: t.price };
    }
    s = parts.join(', ');
  }

  // Detail in parentheses: "Full detail (SUV, heavy pet hair) 180".
  let detail = '';
  const paren = s.match(/\(([^)]{1,200})\)/);
  if (paren && !/^\s*\$?\s*\d/.test(paren[1])) {
    detail = paren[1].trim();
    s = `${s.slice(0, paren.index)} ${s.slice(paren.index + paren[0].length)}`.replace(/\s+/g, ' ').trim();
  }

  // Leading quantity: "2 x Window cleaning @ 45", "3 hours design work at $60/hour".
  let leadQty = null;
  let leadUnit = '';
  let m = s.match(LEAD_QTY_RE);
  if (m && !priceToken(s)) {
    leadQty = Number(m[1]);
    s = m[2];
  } else {
    m = s.match(LEAD_QTY_UNIT_RE);
    if (m) {
      leadQty = Number(m[1]);
      leadUnit = normUnit(m[2]);
      s = m[3];
    }
  }

  // Comma parts: "Full detail, 180, SUV with pet hair" or "Window cleaning, 24 x $6, inside and out".
  const parts = s.replace(/(\d),(?=\d{3}\b)/g, "$1").split(/\s*,\s*/);
  if (parts.length > 1) {
    const at = parts.findIndex((p, i) => i > 0 && priceToken(p));
    if (at > 0) {
      const t = priceToken(parts[at]);
      const after = parts.slice(at + 1).join(', ');
      return finish(parts.slice(0, at).join(', '), [detail, after].filter(Boolean).join('. '), t.qty || leadQty || 1, t.unit || leadUnit, t.price);
    }
  }

  // Price at the end: "Full detail $180", "Window cleaning x2 at $45 each", "Discount -20".
  const words = s.split(' ');
  for (let k = Math.max(1, words.length - 6); k < words.length; k++) {
    const tail = words.slice(k).join(' ').replace(/^[:=]\s*|^-\s+/, '');
    const head = words.slice(0, k).join(' ');
    const t = priceToken(tail);
    if (t && cleanLabel(head)) {
      const bare = !/\$/.test(tail) && !/\d\.\d{2}/.test(tail) && !t.qty && !t.unit;
      // "Gutter cleaning 2 story" never gets here; "Room 2" alone would: a bare 1 or 2 digit number
      // right after a word like "room" or "level" is a label, not a price.
      if (bare && /\$\s?\d/.test(head)) continue;
      if (bare && /\b(room|level|story|stories|floor|bed|bath|step|phase|part|size|grade|car|year|week|month|day|hour|chapter|page|package|tier|option|plan|zone|area|lot|unit)$/i.test(head) && Number(tail) < 100) continue;
      return finish(head, detail, t.qty || leadQty || 1, t.unit || leadUnit, t.price);
    }
  }

  // No charge: "Consultation free", "Travel included".
  m = s.match(/^(.+?)[\s:,\-]+(free|included|no charge|n\/c|\$0(?:\.00)?)$/i);
  if (m && cleanLabel(m[1])) return finish(m[1], detail, leadQty || 1, leadUnit, 0);

  // Price at the start: "$180 Full detail".
  m = s.match(/^(-)?\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s+(.+)$/);
  if (m) return finish(m[3], detail, leadQty || 1, leadUnit, Number(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1));
  return null;
}

function finish(label, detail, qty, unit, price) {
  let l = cleanLabel(label);
  if (!l || /^(x|×|@|at)$/i.test(l)) l = unit ? text.titleCase(unitWord(unit, 2) || unit) : 'Item';
  // "Window cleaning x2" left in the label after "at $45".
  const x = l.match(/^(.*?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i);
  if (x && x[1] && qty === 1) {
    l = cleanLabel(x[1]);
    qty = Number(x[2]);
  }
  return { label: text.sentenceCase(l), detail: text.oneLine(detail), qty, unit: unit || '', price };
}

// Many lines (or a pasted CSV with a header row) to items. Returns { items, skipped }.
function parseLines(input) {
  const raw = Array.isArray(input) ? input.join('\n') : String(input || '');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  const skipped = [];
  let header = null;
  if (lines.length > 1 && /\b(item|description|label|service)\b/i.test(lines[0]) && /\b(price|rate|amount|cost)\b/i.test(lines[0]) && /[,\t]/.test(lines[0])) {
    header = splitCsv(lines[0]).map((h) => h.toLowerCase());
  }
  for (const line of header ? lines.slice(1) : lines) {
    if (header) {
      const cells = splitCsv(line);
      const get = (re) => {
        const i = header.findIndex((h) => re.test(h));
        return i >= 0 ? cells[i] : '';
      };
      const price = priceToken(get(/price|rate|amount|cost/));
      const label = get(/item|description|label|service|name/);
      if (label && price) {
        items.push({ label: text.sentenceCase(cleanLabel(label)), detail: text.oneLine(get(/detail|note/)), qty: Number(get(/qty|quantity/)) || 1, unit: normUnit(get(/unit/)) || price.unit, price: price.price });
        continue;
      }
      skipped.push(line);
      continue;
    }
    const it = parseLine(line);
    if (it && it.label) items.push(it);
    else skipped.push(line);
  }
  return { items, skipped };
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t') {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

// ---------- normalizing and totals ----------

// Items from any source (the form, kit quote, another pack's step) to one clean shape.
function cleanItems(list) {
  const out = [];
  for (const it of Array.isArray(list) ? list : []) {
    if (!it || typeof it !== 'object') continue;
    const label = text.clip(it.label || it.name || it.title || '', 120);
    const price = Number(typeof it.price === 'string' ? it.price.replace(/[$,\s]/g, '') : it.price);
    if (!label || !Number.isFinite(price)) continue;
    let qty = Number(it.qty != null ? it.qty : it.quantity != null ? it.quantity : 1);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;
    qty = Math.round(qty * 100) / 100;
    out.push({ label, detail: text.clip(it.detail || it.description || '', 300), qty, unit: normUnit(it.unit), price: Math.round(price * 100) / 100, taxable: it.taxable !== false });
  }
  return out.slice(0, 60);
}

// { lines, subtotalCents, taxableCents, taxCents, totalCents, depositCents, paidCents, dueNowCents, balanceCents }
function totals(items, { taxRate = 0, deposit = null, depositCents = 0, paid = 0 } = {}) {
  const lines = cleanItems(items).map((it) => ({ ...it, priceCents: toCents(it.price), amountCents: Math.round(it.qty * toCents(it.price)) }));
  const subtotalCents = lines.reduce((n, l) => n + l.amountCents, 0);
  const taxableCents = Math.max(0, lines.filter((l) => l.taxable).reduce((n, l) => n + l.amountCents, 0));
  const rate = Number(taxRate) > 0 ? Number(taxRate) : 0;
  const taxCents = rate ? Math.round(taxableCents * rate + 1e-9) : 0;
  const totalCents = subtotalCents + taxCents;
  let dep = 0;
  if (depositCents > 0) dep = Math.min(depositCents, totalCents);
  else if (deposit != null && deposit > 0) dep = Math.min(totalCents, Math.round(totalCents * deposit + 1e-9));
  const paidCents = Math.max(0, Math.min(totalCents, toCents(paid)));
  // Once what they paid covers the deposit, this asks for the balance: the deposit is done.
  if (dep > 0 && paidCents >= dep) dep = 0;
  const dueNowCents = dep > 0 ? Math.max(0, dep - paidCents) : Math.max(0, totalCents - paidCents);
  const balanceCents = Math.max(0, totalCents - paidCents);
  const discountCents = lines.filter((l) => l.amountCents < 0).reduce((n, l) => n + l.amountCents, 0);
  return { lines, subtotalCents, discountCents, taxableCents, taxRate: rate, taxCents, totalCents, depositCents: dep, depositRate: dep > 0 && !(depositCents > 0) ? deposit : null, paidCents, dueNowCents, balanceCents };
}

// The qty cell: "1", "3 hours", "4 visits", "1.5 hours".
function qtyText(l) {
  const q = Number.isInteger(l.qty) ? String(l.qty) : String(l.qty);
  const w = unitWord(l.unit, l.qty);
  return w ? `${q} ${w}` : q;
}

// The unit price cell: "$60.00", "$60.00 / hour".
function unitPriceText(l, currency) {
  const u = normUnit(l.unit);
  return `${money(l.priceCents != null ? l.priceCents : toCents(l.price), currency)}${u && !QUIET_UNITS.has(u) ? ` / ${u}` : ''}`;
}

module.exports = { UNITS, normUnit, unitWord, parseTax, parseDeposit, pctText, money, toCents, priceToken, parseLine, parseLines, splitCsv, cleanItems, totals, qtyText, unitPriceText };
