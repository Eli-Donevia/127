// Reads a typed or pasted punch list ("fix sticky bedroom door", "mount 2 TVs", "patch 3 holes in
// drywall", "replace the 100 amp panel") into parts matched against data/punch.json: how many, the
// job it matches with its sourced time and price, or the licensed trade it goes to.
// Work for a licensed trade ("refer") is checked first, so "move the outlet behind the TV" goes to an
// electrician even though it mentions a TV. Among the jobs, the longest match wins, so "leaky faucet"
// is a repair and "replace the faucet" is a swap. Bare nouns ("doors", "windows") count only when no
// job matches on its own words, and the generic small-fix words ("squeaky") only after that. Words are regular expression pieces matched whole
// word and case-insensitive.

const DATA = require('../data/punch.json');

const MAX_PARTS = 60;
const MAX_CHARS = 4000;
const MAX_QTY = 50;

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
// "a couple of pictures" and "a few holes" are read as 2 and 3; "several" as 4 (judgment calls).
const VAGUE = { couple: 2, pair: 2, few: 3, several: 4, dozen: 12 };
// A number that is a size, not a count: "65 inch TV", "100 amp panel", "6 ft shelf", "1978 house".
const SIZE_WORD = /^\s*-?\s*(?:inch|inches|in|"|ft|foot|feet|'|amp|amps|a\b|v\b|volt|volts|gallon|gallons|gal|sq|square|year|years|yr|lb|lbs|pound|pounds|drawer|drawers|panel|panels|light|lights|bulb|bulbs|piece|pieces|pc|tier|step|steps|seat|seater|x\d)/;

const compile = (w) => new RegExp(`(?<![a-z0-9])(?:${w})(?![a-z0-9])`, 'i');
const longest = (res, text) => {
  let best = 0;
  for (const re of res) {
    const m = re.exec(text);
    if (m && m[0].length > best) best = m[0].length;
  }
  return best;
};

const JOBS = DATA.jobs.map((j, i) => ({ ...j, order: i, res: j.words.map(compile), weak_res: (j.weak || []).map(compile), check_re: j.check_if ? compile(j.check_if.words) : null }));
const REFER = DATA.refer.map((r) => ({ ...r, res: r.words.map(compile), unless_res: (r.unless || []).map(compile) }));

function normalize(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/(\d)\s*"/g, '$1 inch ')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

// The list split into parts: lines, semicolons, bullets, and commas or "and" between two jobs.
// "and" stays inside a part when what follows it is not a job of its own ("hang and level the mirror").
function split(input) {
  const s = String(input || '').slice(0, MAX_CHARS);
  const out = [];
  for (const raw of s.split(/\r?\n|;|\s\/\s|•/)) {
    const line = raw
      .replace(/^\s*(?:[-*]+|\d+[.)]|\[\s?[x ]?\s?\])\s+/i, '')
      .replace(/[.!?]+\s*$/, '')
      .trim();
    if (!line || !/[a-z]/i.test(line)) continue;
    // Split on commas and "and"/"plus" only when both sides match something.
    const pieces = line.split(/,\s*|\s+(?:and|plus|also)\s+/i).map((p) => p.trim()).filter(Boolean);
    if (pieces.length > 1 && pieces.every((p) => classify(normalize(p)).kind !== 'unknown')) out.push(...pieces);
    else out.push(line);
  }
  return out.slice(0, MAX_PARTS);
}

// How many: a count at the front ("3 pictures", "two doors", "a few holes"), or anywhere in the part
// ("hang 4 shelves", "patch holes x3", "doors (2)"), never a size ("65 inch TV").
function quantity(text) {
  let m;
  if ((m = /(?:^|\s)(?:x\s*(\d{1,3})|\((\d{1,3})\)|(\d{1,3})\s*x|(?:qty|quantity)[:\s]*(\d{1,3}))\s*$/.exec(text))) return clampQty(Number(m[1] || m[2] || m[3] || m[4]));
  const re = /(?<![a-z0-9.$/-])(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?![a-z0-9.,/$-])/g;
  while ((m = re.exec(text))) {
    if (SIZE_WORD.test(text.slice(m.index + m[0].length))) continue;
    const n = /^\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
    if (n > 0) return clampQty(n);
  }
  if ((m = /\b(?:a\s+)?(couple|pair|few|several|dozen)\b/.exec(text))) return VAGUE[m[1]];
  return 1;
}
const clampQty = (n) => (Number.isFinite(n) && n > 0 ? Math.min(MAX_QTY, Math.round(n)) : 1);

// What one part is: { kind: 'refer', refer } or { kind: 'job', job } or { kind: 'unknown' }.
function classify(text) {
  let ref = null;
  let refLen = 0;
  for (const r of REFER) {
    const n = longest(r.res, text);
    if (n > refLen && !r.unless_res.some((re) => re.test(text) && longest(r.res, text.replace(re, ' ')) === 0)) {
      ref = r;
      refLen = n;
    }
  }
  if (ref) return { kind: 'refer', refer: ref };
  // Three passes: a job's own words; then bare nouns ("doors", "lights"); then the generic small-fix
  // words ("tighten", "squeaky").
  const passes = [(j) => (j.fallback ? [] : j.res), (j) => j.weak_res, (j) => (j.fallback ? j.res : [])];
  let job = null;
  for (const resOf of passes) {
    let jobLen = 0;
    for (const j of JOBS) {
      const n = longest(resOf(j), text);
      if (n > jobLen) {
        job = j;
        jobLen = n;
      }
    }
    if (job) break;
  }
  return job ? { kind: 'job', job } : { kind: 'unknown' };
}

// One part of the list: { text, qty, kind, job, refer, check }.
function parsePart(raw) {
  const text = normalize(raw);
  const c = classify(text);
  const out = { text: String(raw).replace(/\s+/g, ' ').trim().slice(0, 100), qty: quantity(text), kind: c.kind, job: c.job || null, refer: c.refer || null, check: null };
  if (c.job) out.check = c.job.check || (c.job.check_re && c.job.check_re.test(text) ? c.job.check_if.check : null);
  return out;
}

function parse(input) {
  return split(input).map(parsePart);
}

module.exports = { parse, parsePart, split, quantity, classify, normalize, MAX_PARTS, MAX_CHARS, DATA };
