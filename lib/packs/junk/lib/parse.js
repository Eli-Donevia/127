// Reads a typed or pasted list of junk ("sofa", "2 recliners", "10 bags of trash", "1 cubic yard of
// drywall", "washer and dryer") into parts matched against the volume table in data/items.json:
// how many, an amount when one is typed (cubic yards, cubic feet, pickup loads) and the item or
// material it matches. The longest matching word wins, so "chest freezer" is a freezer, and words
// that would match the wrong thing ("pressure washer") are listed as not in the table. An item beats
// a material ("metal desk" is a desk) unless an amount or a container is typed ("2 yards of dirt",
// "3 boxes of tile").

const TABLE = require('../data/items.json');

const MAX_PARTS = 100;
const MAX_CHARS = 4000;

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
// "a couple of chairs" and "a few boxes" are read as 2 and 3; "several" as 4 (judgment calls).
const VAGUE = { couple: 2, pair: 2, few: 3, several: 4, dozen: 12 };
// A number that is a size, not a count: "55 inch TV", "3 seat sofa", "4 drawer dresser".
const SIZE_WORD = /^\s*-?\s*(?:inch|inches|in|ft|foot|feet|seat|seats|seater|cushion|cushions|drawer|drawers|door|doors|piece|pieces|pc|burner|burners|person|tier|shelf|shelves|panel|panels|gallon|gallons|year|years|month|months|sq|square)\b/;

const UNIT_FEET = { yd3: 27, ft3: 1, pickup: (TABLE.pickup.cubic_yards || 3.5) * 27 };
const UNIT_POUNDS = { lb: 1, ton: 2000 };
const CONTAINERS = { bag: 4, box: 3.5, bin: 4, tote: 4 };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Every word in the table, longest first, each with a pattern that also takes a plural.
const ENTRIES = (() => {
  const out = [];
  const add = (word, kind, entry) => {
    const w = String(word).toLowerCase().trim();
    if (!w) return;
    out.push({ word: w, len: w.length, kind, entry, re: new RegExp(`(?:^|[^a-z0-9])${escapeRe(w)}(?:s|es)?(?=$|[^a-z0-9])`) });
  };
  for (const it of TABLE.items) {
    const kind = it.keep_out ? 'keep_out' : it.package ? 'package' : it.onsite ? 'onsite' : 'item';
    for (const w of it.words) add(w, kind, it);
  }
  for (const m of TABLE.materials) for (const w of m.words) add(w, 'material', m);
  for (const w of TABLE.not_in_table) add(w, 'unknown', null);
  return out.sort((a, b) => b.len - a.len);
})();

// Table words with "and" in them ("carpet and pad", "odds and ends") are kept whole when the list is split.
const AND_WORDS = ENTRIES.filter((e) => / and /.test(e.word)).map((e) => new RegExp(`(?<![a-z0-9])${escapeRe(e.word).replace(/ and /g, '\\s+and\\s+')}(?:s|es)?(?![a-z0-9])`, 'gi'));
const JOIN = '\u0001';

// All table words in the text, longest first.
function matches(text) {
  const t = ` ${text} `;
  return ENTRIES.filter((e) => e.re.test(t));
}

// The longest table word in the text, or null.
function match(text) {
  return matches(text)[0] || null;
}

// "1/2" -> 0.5, "1.5" -> 1.5
function num(s) {
  const m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
  return Number(String(s).replace(/,/g, ''));
}

// How many, from the front or the end of a part. Returns { qty, rest }.
function quantity(text) {
  let s = text;
  let qty = null;
  let m;
  if (/^\d+\s*[x×*]\s*\d/.test(s)) {
    // "10x10 rug", "2x4s": a size, not a count.
  } else if ((m = /^(\d+\/\d+|\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:\.\d+)?)(?:\s*[x×](?=\s|$))?\s*/.exec(s)) && !SIZE_WORD.test(s.slice(m[0].length))) {
    qty = num(m[1]);
    s = s.slice(m[0].length);
  } else if (m) {
    // "55 inch tv": leave the size in the words.
  } else if ((m = /^(?:a\s+|an\s+)?(couple|pair|few|several|dozen)(?:\s+of)?\s+/.exec(s))) {
    qty = VAGUE[m[1]];
    s = s.slice(m[0].length);
  } else if ((m = /^half\s+(?:of\s+)?(?:a\s+|an\s+)?/.exec(s))) {
    qty = 0.5;
    s = s.slice(m[0].length);
  } else if ((m = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+/.exec(s)) && !SIZE_WORD.test(s.slice(m[0].length))) {
    qty = NUMBER_WORDS[m[1]];
    s = s.slice(m[0].length);
  } else if ((m = /^(?:a|an)\s+/.exec(s))) {
    qty = 1;
    s = s.slice(m[0].length);
  }
  if (qty == null) {
    const end = /\s*(?:[x×]\s*(\d+)|\((\d+)\)|(\d+)\s*[x×]|(?:qty|quantity)[:\s]*(\d+))$/.exec(s);
    if (end && end.index > 0) {
      qty = Number(end[1] || end[2] || end[3] || end[4]);
      s = s.slice(0, end.index);
    }
  }
  return { qty: Number.isFinite(qty) && qty > 0 ? qty : 1, rest: s.trim() };
}

// An amount at the front: cubic yards, cubic feet, pickup loads, pounds or tons. Returns { unit, rest }.
const UNITS = [
  ['lb', /^(?:lbs?|pounds?)(?![a-z0-9])\.?(?:\s+of)?\s*/],
  ['ton', /^(?:tons?)(?![a-z0-9])(?:\s+of)?\s*/],
  ['yd3', /^(?:cubic\s+yards?|cu\.?\s*yds?\.?|yds?3|yards?|yds?|cy)(?![a-z0-9])\.?(?:\s+of)?\s*/],
  ['ft3', /^(?:cubic\s+f(?:ee|oo)t|cu\.?\s*ft\.?|ft3|cf)(?![a-z0-9])\.?(?:\s+of)?\s*/],
  ['pickup', /^(?:pick\s*-?\s*up\s+truck\s*loads?|pick\s*-?\s*up\s+loads?|truck\s*loads?|pick\s*-?\s*up\s+trucks?(?:\s+full)?|pick\s*-?\s*ups?(?:\s+full)?|trucks?(?:\s+full)?|loads?)(?![a-z0-9])(?:\s+(?:full\s+)?of)?\s*/],
];
function amount(text) {
  for (const [unit, re] of UNITS) {
    const m = re.exec(text);
    if (m && text.slice(m[0].length).trim()) return { unit, rest: text.slice(m[0].length).trim() };
  }
  return { unit: null, rest: text };
}

// "bag of drywall" -> { container: 'bag', cubic_feet: 4 }
function container(text) {
  const m = /^(bag|box|bin|tote) of\s+\S/.exec(text);
  return m ? { container: m[1], cubic_feet: CONTAINERS[m[1]] } : null;
}

function normalize(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/(\d)\s*(?:["“”]|''|’’)/g, '$1 inch ')
    .replace(/(\d)\s*['‘’](?![a-z])/g, '$1 ft ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”"]/g, '')
    .replace(/'s\b/g, 's')
    .replace(/\b(bags|boxes|bins|totes|cans|gallons|loads) of\b/g, (m, w) => `${{ bags: 'bag', boxes: 'box', bins: 'bin', totes: 'tote', cans: 'can', gallons: 'gallon', loads: 'load' }[w]} of`)
    .replace(/\s+/g, ' ')
    .trim();
}

// The list split into parts: lines, semicolons, commas (not in 1,000), "and", "plus", "&", "+", " / ".
function split(input) {
  let s = String(input || '').slice(0, MAX_CHARS);
  for (const re of AND_WORDS) s = s.replace(re, (m) => m.replace(/\s+and\s+/gi, JOIN));
  return s
    .split(/\r?\n|;|,(?!\d{3}(?!\d))|\s+(?:and|plus|&|\+)\s+|\s\/\s/i)
    .map((l) =>
      l
        .split(JOIN)
        .join(' and ')
        .replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '')
        .replace(/^[a-z][a-z ]{0,24}:\s*/i, '')
        .replace(/[.!?]+\s*$/, '')
        .trim(),
    )
    .filter((l) => l && /[a-z]/i.test(l))
    .slice(0, MAX_PARTS);
}

// Which table word the part means, given an amount or a container.
function pick(hits, { unit, box }) {
  if (!hits.length) return null;
  const mat = hits.find((h) => h.kind === 'material');
  const other = hits.find((h) => h.kind !== 'material');
  if (mat && (unit || box)) {
    // "bag of trash" and "box of books" are table words of their own and win over the material in them.
    if (box && other && other.len > mat.len && other.word.includes(`${box.container} of`)) return other;
    return mat;
  }
  return other || mat;
}

// One part of the list: { text, qty, unit, container, kind, entry, word }. unit: yd3, ft3, pickup, lb, ton or null.
// kind: item, material, amount (an amount of something not in the table), unknown, keep_out,
// package (a piano or hot tub, priced as its own job) or onsite (priced on site).
function parsePart(raw) {
  const text = normalize(raw);
  const q = quantity(text);
  const a = amount(q.rest);
  const box = a.unit ? null : container(a.rest);
  const hit = pick(matches(a.rest), { unit: a.unit, box });
  const out = { text: String(raw).replace(/\s+/g, ' ').trim().slice(0, 80), qty: q.qty, unit: a.unit, container: null, kind: 'unknown', entry: null, word: hit ? hit.word : '' };
  if (!hit || hit.kind === 'unknown') {
    if (a.unit) out.kind = 'amount';
    return out;
  }
  out.entry = hit.entry;
  if (hit.kind === 'material') {
    out.kind = 'material';
    if (box && !a.unit) out.container = box;
    return out;
  }
  // "1 pickup load of tires" or "200 lbs of scrap": the amount counts, the table says what it is.
  out.kind = a.unit && hit.kind === 'item' ? 'amount' : hit.kind;
  return out;
}

// "grill with propane tank": the grill goes in the truck and the tank stays out, so a part whose
// table word stays out is read as two when what comes before "with" is in the table too.
function parse(input) {
  const out = [];
  for (const raw of split(input)) {
    const p = parsePart(raw);
    const m = p.kind === 'keep_out' ? /^(.+?)\s+with\s+(.+)$/i.exec(raw) : null;
    const head = m ? parsePart(m[1]) : null;
    if (head && head.kind !== 'unknown' && head.kind !== 'keep_out') out.push(head, parsePart(m[2]));
    else out.push(p);
  }
  return out;
}

module.exports = { parse, parsePart, split, quantity, amount, normalize, match, matches, UNIT_FEET, UNIT_POUNDS, MAX_PARTS, MAX_CHARS };
