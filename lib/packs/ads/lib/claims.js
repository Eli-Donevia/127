// What ad copy must never say, and what it may say only with proof. Every headline, text, description,
// script and on-image line the ad desk writes goes through here before it reaches a file; a line with
// a problem is dropped or replaced. Legal row 12 (handoffs/turnkey.md), on top of the house copy rules:
//
// D3, blocked (problems): income or earnings claims and the get-rich-quick, little-or-no-work and
//     sure-return claims every network bans; promised results and exact results in a set time ("lose
//     10 lbs in 7 days"); before-and-after claims about weight, health, cosmetics or the body. Plus
//     pressure that may not be true, call-outs of a personal trait (Meta rejects "Are you struggling
//     with...") and "best in town" claims. The landing page check (D12) flags the same lines on a page.
// D3, "Can you back this up?" (proofProblems): numbers, rankings and superlatives ("#1", "500+
//     customers", "5 stars", "best in town") and comparisons with a named business, unless the member
//     typed them or they are in the Brain.
// D4, made-up proof (madeUp): the desk never writes a testimonial, review, rating, customer count, "as
//     seen in" line or customer persona. A real review is one the member pastes, word for word.
// D8 (restricted): products a network limits get Legal's line for each network.
//
// Banned words are spelled in pieces where they'd otherwise sit in plain text, so the copy check that
// reads this source doesn't flag the rule that blocks them.

const { text } = require('../../_kit');
const RESTRICTED = require('../data/restricted.json');
const LINES = require('../data/screen-lines.json');

const GUAR = ['guar', 'antee'].join('');
const GET_RICH = ['get ' + 'rich', 'easy ' + 'money', 'fast cash', 'quick cash', 'little (or|to) no (work|effort)', 'while you sleep', 'double your money', 'make money (from home|online|fast)', 'work from home and (earn|make)', 'passive ' + 'income', 'financial ' + 'freedom', 'quit your (day )?job', 'side income', 'extra income'].join('|');

const RULES = [
  {
    id: 'income',
    why: 'An income claim',
    rx: /\b(earn|earns|earning|make|making|made)\s+(\$|up to\b|over\b|six\b|seven\b|\d)|\$\s?\d[\d,.]*k?\s*(\/|a|per)\s*(month|week|day|year|mo|wk|hr|hour)\b|\b(six|seven)[- ]figures?\b|\b(income|earnings|profits?)\s+of\s+\$?\d/i,
  },
  {
    id: 'get_rich',
    why: 'A get-rich-quick or little-work claim',
    rx: new RegExp(String.raw`\b(${GET_RICH})\b|\b${GUAR}d? (return|returns|profit|profits|income)\b|\b\d+% (return|returns|roi)\b|\breturns? of \d+%`, 'i'),
  },
  {
    id: 'promise',
    why: 'A promised result',
    rx: new RegExp(String.raw`\b${GUAR}(d|s)?\b|\b100% (results|satisfaction|success|effective)\b|\bnever fails\b|\bwill (get|see|have|land) (results|clients|customers|leads)\b|\brisk[- ]free\b|\bcures?\b|\bproven to\b|\bsure (results|thing|win)\b`, 'i'),
  },
  {
    id: 'timed_result',
    why: 'An exact result in a set time',
    rx: /\bresults in \d+ (days?|weeks?)\b|\b(lose|drop|gain|double|triple|grow|boost|increase|add|earn|make)\b[^.!?\n]{0,40}\b(in|within|after)\s+(just\s+)?(\d+|one|two|three|four|five|six|seven|ten|thirty)\s*(hours?|days?|weeks?|months?)\b|\b(lose|drop) \d+ ?(lbs|pounds|kg)\b|\b(clear|clearer|smooth|smoother|whiter|younger|slimmer|thinner|toned|pain[- ]free|debt[- ]free|acne[- ]free)\b[^.!?\n]{0,40}\b(in|within|after)\s+(just\s+)?(\d+|one|two|three|four|five|six|seven|ten|thirty)\s*(hours?|days?|weeks?|months?)\b/i,
  },
  {
    id: 'before_after_body',
    why: 'A before-and-after claim about the body or health',
    rx: /\bbefore[\s-]*(and|&|\/)[\s-]*after\b(?=[^\n]{0,80}\b(weight|lbs?|pounds|kg|body|skin|acne|wrinkles?|hair loss|teeth|fat|slim|belly|health|pain|cosmetic|botox|filler|face|figure|waist)\b)|\b(weight|lbs?|pounds|kg|body|skin|acne|wrinkles?|hair loss|teeth|fat|slim|belly|health|pain|cosmetic|botox|filler|face|figure|waist)\b[^\n]{0,80}\bbefore[\s-]*(and|&|\/)[\s-]*after\b/i,
  },
  {
    id: 'pressure',
    why: 'Pressure that may not be true',
    rx: /\blast chance\b|\bact now\b|\bonly \d+ (left|spots?|slots?)\b|\bends (tonight|today|soon)\b|\bhurry\b|\blimited time\b|\bdon'?t miss out\b/i,
  },
  {
    id: 'personal',
    why: "Calls out a personal trait (Meta's ad rules don't allow it)",
    rx: /\bare you (struggling|broke|in debt|overweight|depressed|anxious|single|divorced|sick|lonely|unemployed)\b|\b(your|you're) (overweight|in debt|depressed|broke)\b/i,
  },
  {
    id: 'unproven',
    why: "A claim you can't back up",
    rx: /\b(the )?(best|cheapest|#1|number one|top[- ]rated|highest[- ]rated) (\w+ )?(in|of|near)\b|\bvoted (the )?best\b/i,
  },
];

// D3: numbers, rankings and superlatives that need proof, and comparisons with a named business.
const PROOF = [
  /#\s?1\b|\bnumber one\b|\bno\.\s?1\b/i,
  /\b(best|top[- ]rated|highest[- ]rated|favou?rite|leading|most (loved|popular|trusted)|cheapest|fastest|lowest[- ]priced)\b/i,
  /\b\d[\d,]*\s*\+?\s*(happy\s+|satisfied\s+|loyal\s+)?(customers|clients|buyers|orders|reviews|students|families|homes|cars|jobs done|projects)\b/i,
  /\b(5|five)[- ]stars?\b|\b\d(\.\d)?\s*stars?\b/i,
  /\b(better|cheaper|faster|nicer) than (?!before\b|ever\b|you\b)[A-Z][\w'&]+|\bunlike [A-Z][\w'&]+|\bvs\.? [A-Z][\w'&]+/,
  /\b\d+(\.\d+)?\s*%/,
];

// D4: made-up proof. The desk never writes these; a member's real review is pasted word for word.
const MADE_UP = [
  { id: 'testimonial', rx: /["“][^"”]{6,}["”]\s*(-|,|by)\s*[A-Z][a-z]+|\btestimonials?\b|\b(customers|clients|people|everyone|neighbors) (say|says|said|love|rave)\b|\bone (customer|client) (said|wrote)\b/i },
  { id: 'review', rx: /\breviews?\b|\breviewed\b|\brated\b|\bratings?\b|\b\d(\.\d)?\s*stars?\b|\b(5|five)[- ]star\b/i },
  { id: 'count', rx: /\b\d[\d,]*\s*\+?\s*(happy\s+|satisfied\s+|loyal\s+)?(customers|clients|buyers|students|families|homes|members|users)\b|\b(hundreds|thousands|millions) of (happy\s+)?(customers|clients|families|people)\b/i },
  { id: 'as_seen', rx: /\bas (seen|featured) (in|on)\b|\bfeatured (in|on) [A-Z]/i },
  { id: 'persona', rx: /\b[Mm]eet [A-Z][a-z]+\b|\b(I'?m|my name is) [A-Z][a-z]+,? (a|an|the) \w+|\b[Aa]s a (busy |working |single )?(mom|dad|mother|father|parent|homeowner|nurse|teacher)\b(?=[^.!?\n]{0,30}\b(I|myself)\b)/ },
];

// [{ id, why, match }] for one line of copy: what's blocked, house copy rules included (dashes,
// emoji, banned words). The landing page check uses this too.
function problems(line) {
  const s = String(line == null ? '' : line);
  const out = [];
  for (const r of RULES) {
    const m = s.match(r.rx);
    if (m) out.push({ id: r.id, why: r.why, match: m[0] });
  }
  for (const p of text.copyProblems(s)) out.push({ id: 'house', why: 'House copy rules', match: String(p) });
  return out;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// D3: claims that need proof, unless the same words are in what the member typed or saved.
function proofProblems(line, typed = '') {
  const s = String(line == null ? '' : line);
  const have = norm(typed);
  const out = [];
  for (const re of PROOF) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of s.matchAll(g)) {
      const k = norm(m[0]);
      if (k && !have.includes(k)) out.push({ id: 'needs_proof', why: LINES.backup, match: m[0].trim() });
    }
  }
  return out;
}

// D4: made-up proof the desk never writes.
function madeUp(line) {
  const s = String(line == null ? '' : line);
  return MADE_UP.filter((r) => r.rx.test(s)).map((r) => ({ id: `made_up_${r.id}`, why: 'Made-up proof: the desk never writes reviews, ratings, customer counts, "as seen in" lines or customer personas', match: (s.match(r.rx) || [''])[0] }));
}

// Everything at once for a line the desk writes: blocked (D3, D4) and needs proof (D3). A line the
// member typed passes the proof check (they gave it); a line the desk wrote never carries made-up
// proof. "Best in town" counts as needing proof here, not as blocked.
function check(line, { typed = '', written = true } = {}) {
  const all = problems(line);
  const blocked = all.filter((p) => p.id !== 'unproven');
  if (written) blocked.push(...madeUp(line));
  const proof = proofProblems(line, typed);
  for (const p of all.filter((x) => x.id === 'unproven' && !norm(typed).includes(norm(x.match)))) {
    if (!proof.some((x) => norm(x.match) === norm(p.match))) proof.push({ id: 'needs_proof', why: LINES.backup, match: p.match });
  }
  return { ok: !blocked.length && !proof.length, blocked, proof };
}

const ok = (line, opts) => (opts ? check(line, opts).ok : problems(line).length === 0);

// The first candidate with no problem, or '' when none passes.
function firstOk(cands, opts) {
  for (const c of cands) if (c && ok(c, opts)) return c;
  return '';
}

// Every problem across labeled lines: [{ where, text, why, match }].
function scan(rows) {
  return rows.flatMap((r) => problems(r.text).map((p) => ({ where: r.where, text: r.text, why: p.why, match: p.match })));
}

// Every line the desk wrote, sorted into what passes, what's blocked and what needs proof. Lines that
// fail are listed by where they were and what tripped them.
function review(rows, { typed = '' } = {}) {
  const out = { passed: [], blocked: [], proof: [] };
  for (const r of rows) {
    if (!r || !r.text) continue;
    const c = check(r.text, { typed, written: r.written !== false });
    if (c.blocked.length) out.blocked.push({ where: r.where, why: c.blocked[0].why, match: c.blocked[0].match });
    else if (c.proof.length) out.proof.push({ where: r.where, why: LINES.backup, match: c.proof[0].match });
    else out.passed.push(r);
  }
  return out;
}

// What the member typed or saved, which their own claims may come from (D3: the Brain or the form).
function typedBy(ctx, input) {
  const b = (ctx && ctx.brain) || {};
  const bits = [JSON.stringify(b.business || {}), JSON.stringify(b.offer || {}), JSON.stringify(b.proof || {})];
  for (const v of Object.values(input || {})) if (typeof v === 'string') bits.push(v);
  return bits.join('\n');
}

// D8: categories a network limits, from what the member sells. [{ key, name, lines: [{ network, line, href }] }]
function restricted(...texts) {
  const hay = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  const out = [];
  for (const c of RESTRICTED.categories) {
    const hit = c.words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${w.length >= 6 ? '' : 's?\\b'}`, 'i').test(hay));
    if (!hit) continue;
    out.push({ key: c.key, name: c.name, lines: Object.entries(RESTRICTED.networks).map(([network, href]) => ({ network, line: RESTRICTED.line.replace('{Network}', network).replace('{category}', c.name), href })) });
  }
  return out;
}

module.exports = { RULES, PROOF, MADE_UP, LINES, problems, proofProblems, madeUp, check, ok, firstOk, scan, review, typedBy, restricted };
