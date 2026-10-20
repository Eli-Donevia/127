// Small helpers this pack shares with creator and idea (each pack keeps its own copy, since a pack
// never requires another pack's files). Kit ask in the README: move claims() into the kit.
//
//   claims(text, typed)     Legal L76 D3 and D4: what a draft may not say, and the numbers, rankings
//                           and superlatives it may say only when the member typed them
//   scrub(text, typed)      drops every sentence claims() finds a problem in
//   acceptOf(typed)         an `accept` for kit ai calls: copy rules plus claims, on every string
//   parseCsv(text)          RFC 4180 rows (quotes, commas and line breaks inside quotes)
//   readUpload(ctx, id)     a Library file as text (UTF-8 or UTF-16), never a spreadsheet or ZIP
//   page({...})             one printable, phone-friendly HTML page in the member's colors, no scripts
//   fit(text, max)          cut on a word boundary to fit a counted limit

const fs = require('fs');
const { text, files, color, ai } = require('../../_kit');

const { plain } = text;

// ---------- claims (Legal L76, D3 and D4) ----------
// Blocked outright: earnings claims, results promised for sure, exact results in a set time, and
// before-and-after for the body, health or looks. Asked about ("Can you back this up?"): numbers,
// rankings, superlatives, star ratings, counts of buyers and "as seen in" lines the member didn't type.
// A testimonial, review, rating or buyer count is never written by us (D4): only pasted, word for word.
const SURE = 'guarante' + '(?:e|ed|es|eing)';
const BLOCK = [
  [new RegExp(`\\b(?:make|making|earn|earning|bring in|take home|pull in|profit of)\\b[^.!?\\n]{0,30}\\$\\s?\\d`, 'i'), 'an earnings claim'],
  [/\$\s?\d[\d,.]*\s?k?\s*(?:a|per|\/)\s*(?:day|week|month|year)\b[^.!?\n]{0,30}\b(?:income|earnings|profit|side money)\b/i, 'an earnings claim'],
  [new RegExp(`\\b${SURE}\\b`, 'i'), 'a promise of results'],
  [/\brisk[- ]free\b|\b100% (?:results|success|effective)\b|\bproven to\b|\bworks every time\b|\bnever fails\b/i, 'a promise of results'],
  [/\b(?:lose|drop|gain|get|reach|hit|double|triple|grow|boost|increase|clear|shrink)\b[^.!?\n]{0,40}\b(?:in|within|after)\s+(?:just\s+)?\d+\s+(?:days?|weeks?|months?|hours?|minutes?)\b/i, 'an exact result in a set time'],
  [/\bbefore[- ](?:and|&)[- ]after\b[^.!?\n]{0,60}\b(?:weight|skin|acne|wrinkles?|body|fat|teeth|face|hair loss|scars?)\b|\b(?:weight|skin|acne|wrinkles?|body|fat|teeth|face|hair loss|scars?)\b[^.!?\n]{0,60}\bbefore[- ](?:and|&)[- ]after\b/i, 'a before-and-after for the body or looks'],
  [/\bge[t] rich\b|\bquit your (?:day )?job\b|\bfinancial fr[e]edom\b/i, 'an earnings claim'],
];
const ASK = [
  /#\s?1\b|\bnumber one\b|\bno\.\s?1\b/i,
  /\b(?:the )?best(?:[- ]selling| in (?:town|the (?:city|state|country|world)))?\b/i,
  /\bbestsell(?:er|ing)\b|\btop[- ]rated\b|\baward[- ]winning\b|\bworld'?s (?:best|first|finest|most)\b|\bmost popular\b|\bleading\b|\bfan[- ]favou?rite\b/i,
  /\b\d[\d,.]*\s*[km]?\+?\s+(?:happy |satisfied |loyal |repeat )?(?:customers|buyers|clients|shoppers|orders|sales|units sold|reviews|followers|subscribers|fans|students|members|downloads|views|likes|plays)\b/i,
  /\b(?:5|five)[- ]stars?\b|\b\d(?:\.\d)?\s*(?:stars?|out of 5|\/\s*5)\b/i,
  /\b\d+(?:\.\d+)?\s?%/,
  /\bas seen (?:in|on)\b|\bfeatured (?:in|on)\b|\btestimonials?\b|\b(?:customers|buyers|people|everyone|shoppers|readers|viewers) (?:say|love|rave|agree|swear)\b|\bloved by\b|\btrusted by\b/i,
];

const lower = (s) => String(s == null ? '' : s).toLowerCase();

// Problems in one string: { blocked: ['an earnings claim'], ask: ['#1'] }. `typed`: everything the
// member typed or keeps in their Brain, as one string; an ASK phrase found there is theirs to use.
function claims(s, typed = '') {
  const t = String(s == null ? '' : s);
  const mine = lower(typed);
  const blocked = [];
  for (const [re, label] of BLOCK) if (re.test(t) && !blocked.includes(label)) blocked.push(label);
  const ask = [];
  for (const re of ASK) {
    const g = new RegExp(re.source, 'gi');
    let m;
    while ((m = g.exec(t))) {
      const phrase = m[0].trim();
      if (phrase && !mine.includes(lower(phrase)) && !ask.includes(phrase)) ask.push(phrase);
      if (g.lastIndex === m.index) g.lastIndex++;
    }
  }
  return { blocked, ask };
}

const hasProblem = (s, typed) => {
  const c = claims(s, typed);
  return c.blocked.length > 0 || c.ask.length > 0;
};

// Keeps the sentences (and lines) with no problem. Line breaks stay.
function scrub(s, typed = '') {
  return String(s == null ? '' : s)
    .split('\n')
    .map((line) => {
      const parts = line.match(/[^.!?]+[.!?]*\s*/g) || [line];
      return parts.filter((p) => !hasProblem(p, typed)).join('').trim();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function everyString(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => everyString(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => everyString(x, out));
  return out;
}

// For ai.aiJson / ai.aiText: an AI draft with a copy problem or a claim the member didn't type goes
// back to our template.
const acceptOf = (typed = '') => (value) => ai.cleanCopy(value) && everyString(value).every((s) => !hasProblem(s, typed));

// The member's own words for the claims check: their inputs and their Brain's business facts.
function typedOf(input = {}, ctx) {
  const b = (ctx && ctx.brain && ctx.brain.business) || {};
  return [...everyString(input), ...everyString(b)].join('\n');
}

// ---------- CSV ----------

function parseCsv(src) {
  const s = String(src || '').replace(/^﻿/, '');
  const first = s.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

// Rows as objects keyed by a normalized header ("Lineitem quantity" -> "lineitem quantity").
function csvObjects(src) {
  const rows = parseCsv(src);
  if (!rows.length) return { head: [], rows: [] };
  const head = rows[0].map((h) => lower(h).replace(/\s+/g, ' ').trim());
  return { head, rows: rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] == null ? '' : String(r[i])).trim()]))) };
}

function decode(buf) {
  if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error('That looks like an Excel or ZIP file. Open it, save it as CSV, and add the CSV instead.');
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const sw = Buffer.from(buf.slice(2));
    sw.swap16();
    return sw.toString('utf16le');
  }
  return buf.toString('utf8');
}

async function readUpload(ctx, id, { maxMb = 5 } = {}) {
  const a = await ctx.asset(id);
  if (!a || !a.path) throw new Error("We couldn't open that file. Add it again, or paste the rows instead.");
  if (a.bytes > maxMb * 1024 * 1024) throw new Error(`That file is over ${maxMb} MB. Export a shorter date range and add that instead.`);
  return { text: decode(fs.readFileSync(a.path)), name: a.name || 'your file' };
}

// ---------- counted limits ----------

function fit(s, max) {
  const t = plain(s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : t.slice(0, max)).replace(/[\s,;:|.\-]+$/, '').replace(/\s+(and|or|with|for|of|the|a|an|in|to)$/i, '');
}

// ---------- printable HTML ----------

const esc = files.esc;

function page({ title, seed, body, css = '', size = 'Letter', description = '' }) {
  const p = color.palette(color.isHex(seed) ? seed : 'clean');
  const base = `:root{--p:${p.primary};--onp:${p.onPrimary};--ink:${p.ink};--paper:${p.paper};--surface:${p.surface};--muted:${p.muted};--line:${p.line}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Inter,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 18px 48px}h1{font-size:28px;line-height:1.2;margin:0 0 6px}h2{font-size:20px;margin:28px 0 10px}h3{font-size:17px;margin:16px 0 6px}
.lede{color:var(--muted);margin:0 0 18px}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:12px 0}
.band{background:var(--p);color:var(--onp);border-radius:16px;padding:22px 20px;margin:0 0 18px}.band h1{color:var(--onp)}.band p{margin:4px 0 0}
table{width:100%;border-collapse:collapse;font-size:14px;background:#fff}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{background:var(--surface);font-weight:700}
td.n,th.n{text-align:right;white-space:nowrap}.muted{color:var(--muted)}.small{font-size:13px}.tag{display:inline-block;background:var(--surface);border-radius:99px;padding:2px 10px;font-size:12px;margin:0 6px 6px 0}
ul.checks{list-style:none;padding:0}ul.checks li{padding:6px 0 6px 30px;position:relative;border-bottom:1px solid var(--line)}ul.checks li:before{content:"";position:absolute;left:0;top:9px;width:16px;height:16px;border:2px solid var(--p);border-radius:4px}
.blank{display:inline-block;min-width:120px;border-bottom:1px solid var(--muted)}a{color:var(--p)}
.wrap{overflow-x:auto}@media (max-width:600px){h1{font-size:23px}main{padding:18px 12px 36px}th,td{padding:6px}}
@page{size:${size};margin:14mm}@media print{body{background:#fff}.card,tr{break-inside:avoid}a{color:inherit}}`;
  return files.htmlDoc({ title: plain(title), description: plain(description), css: base + css, body: `<main>${body}</main>` });
}

const li = (items) => (items || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');

module.exports = { claims, scrub, acceptOf, typedOf, hasProblem, everyString, parseCsv, csvObjects, readUpload, decode, fit, page, esc, li };
