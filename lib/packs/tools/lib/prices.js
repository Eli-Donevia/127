// Reads a member's price list in whatever shape they paste it: "Full detail, $180, inside and out",
// "Deep clean - $220", "Window cleaning $8 per window", "Hourly: $45/hr", or CSV rows with a name and
// a price column. Returns [{ name, price, unit, detail }] in their order.

const { text } = require('../../_kit');

const MONEY = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:dollars|usd)\b|(?:^|[\s,:|;=])(\d[\d,]*(?:\.\d{1,2})?)\s*(?=$|[\s,|;/])/i;
const UNIT = /^\s*(?:\/|per\s+|an?\s+|each\b)\s*([a-z][a-z ]{0,20}?)(?=$|[,.;|(]|\s{2}|\s+(?:for|with|inside|includes?)\b)/i;

const clean = (s) => text.oneLine(String(s || '').replace(/^[\s\-*\u2022\d.)]+(?=[A-Za-z])/, '').replace(/[\s,:;|=\-\u2013\u2014]+$/, '').replace(/^[\s,:;|=\-\u2013\u2014]+/, ''));

function parseLine(line) {
  const raw = String(line || '').trim();
  if (!raw || /^#/.test(raw)) return null;
  const m = raw.match(MONEY);
  if (!m) return null;
  const amount = Number(String(m[1] || m[2] || m[3]).replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e6) return null;
  const at = raw.indexOf(m[0]);
  const name = clean(raw.slice(0, at));
  if (!name || name.length < 2) return null;
  let rest = raw.slice(at + m[0].length);
  let unit = '';
  const u = rest.match(UNIT);
  if (u) {
    unit = u[1].trim().toLowerCase().replace(/^(hr|hrs)$/, 'hour').replace(/^each$/, '');
    rest = rest.slice(u[0].length);
  } else if (/^\s*each\b/i.test(rest)) rest = rest.replace(/^\s*each\b/i, '');
  if (/^(job|visit|service|flat)$/.test(unit)) unit = '';
  const detail = clean(rest);
  return { name: text.clip(name, 60), price: Math.round(amount * 100) / 100, unit: text.clip(unit, 20), detail: text.clip(detail, 120) };
}

function parsePrices(input, { max = 40 } = {}) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\r?\n|;(?=\s*[A-Za-z])/);
  const out = [];
  const seen = new Set();
  for (const l of lines) {
    const p = typeof l === 'object' && l ? (l.name && l.price != null ? { name: String(l.name), price: Number(l.price), unit: l.unit || '', detail: l.detail || '' } : null) : parseLine(l);
    if (!p || seen.has(p.name.toLowerCase())) continue;
    seen.add(p.name.toLowerCase());
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

// "Add-on" or "Extra" items in a list become add-ons in calculators.
const isAddon = (p) => /\b(add[- ]?on|extra|upgrade|plus)\b/i.test(`${p.name} ${p.detail}`);

module.exports = { parsePrices, parseLine, isAddon };
