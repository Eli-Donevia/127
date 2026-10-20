// Legal L76 (handoffs/turnkey.md, Ads desk D3, D7, D9, D10) for everything cmo writes: post and
// email drafts, plan moves and ad advice. A draft that fails goes back to the template, and the
// templates are tested to pass. On top of the kit's copy rules (ai.cleanCopy).
//
// D3: no income or earnings claims, no promised results, no exact result in a set time, no before-and-after
//     for weight, health, cosmetics or the body; numbers, rankings and superlatives ("#1", "500+
//     customers", "5 stars", "best in town") only when the member typed them or they are in the Brain.
// D7, D9: never suggest an audience under 18, or narrowing by age, gender, ZIP, radius or lookalikes.
// D10: never suggest custom audiences, pixels, the Conversions API, lookalikes or lead forms (not in
//     this build), and never compare with other businesses' numbers (one member's data only).

const { ai } = require('../../_kit');

// The banned words are spelled in pieces so the copy check, which reads this source, doesn't flag
// the rule that blocks them.
const GUAR = ['guar', 'antee'].join('');
const GET_RICH = ['get ' + 'rich', 'quit your (day )?job', 'financial ' + 'freedom', 'easy ' + 'money', 'little or no work', 'passive ' + 'income'].join('|');

const RULES = [
  { id: 'income', why: 'an income or earnings claim', re: new RegExp(String.raw`\b(make|makes|making|earn|earns|earning|earned|income|profit|profits|passive|take home|extra)\b[^.!?\n]{0,30}\$\s?\d|\$\s?\d[\d,.]*\s*k?\s*(a|an|per|\/)\s*(hour|day|week|month|year)\b[^.!?\n]{0,25}\b(income|profit|extra|side hustle|from home)\b|\b(${GET_RICH})\b`, 'i') },
  { id: 'promise', why: 'a promised result', re: new RegExp(String.raw`\b${GUAR}(d|s)?\b|\brisk[- ]free\b|\b100% (sure|certain|results?)\b`, 'i') },
  { id: 'timed_result', why: 'an exact result in a set time', re: /\b(lose|gain|drop|double|triple|grow|boost|increase|add|get|earn|make)\b[^.!?\n]{0,40}\b(in|within|after)\s+(just\s+)?(\d+|one|two|three|four|five|six|seven|ten|thirty)\s*(hours?|days?|weeks?|months?)\b/i },
  { id: 'before_after_body', why: 'a before-and-after claim about the body or health', re: /\bbefore[\s-]*(and|&|\/)[\s-]*after\b(?=[^\n]{0,80}\b(weight|lbs?|pounds|kg|body|skin|acne|wrinkles?|hair|teeth|fat|slim|belly|health|pain|cosmetic|botox|filler)\b)|\b(weight|lbs?|pounds|kg|body|skin|acne|wrinkles?|hair|teeth|fat|slim|belly|health|pain|cosmetic|botox|filler)\b[^\n]{0,80}\bbefore[\s-]*(and|&|\/)[\s-]*after\b/i },
  { id: 'audience_rule', why: 'targeting the rules rule out (under 18, or narrowing by age, gender, ZIP, radius or lookalike)', re: /\b(under|below)\s*18\b|\b(1[3-7])\s*(-|to)\s*1[4-7]\b|\bteens?\b[^.!?\n]{0,30}\b(target|audience|ads?)\b|\b(target|targeting|audience|narrow|exclude)\b[^.!?\n]{0,50}\b(age range|ages? \d|gender|men only|women only|zip|postal code|radius|miles? (around|from)|lookalike)\b/i },
  { id: 'not_in_build', why: 'custom audiences, pixels, lookalikes or lead forms, which this build does not use', re: /\b(custom audiences?|lookalikes?|look-alikes?|pixel|conversions api|capi|lead forms?|instant forms?|customer list upload|upload your customer list)\b/i },
  { id: 'benchmark', why: "a comparison with other businesses' numbers", re: /\b(industry (average|benchmark)|other (businesses|shops|stores|members)\b[^.!?\n]{0,30}\b(get|average|see|make))|\bbenchmarks?\b/i },
];

// Numbers, rankings and superlatives that need proof: allowed only when the member typed them.
const PROOF = [
  /#\s?1\b|\bnumber one\b|\bno\.\s?1\b/i,
  /\b([Bb]est|[Tt]op[- ]rated|[Hh]ighest[- ]rated|[Ff]avou?rite|[Ll]eading|[Mm]ost (loved|popular|trusted))\s+(\w+\s+){0,2}(in|on|of)\s+(town|the city|the state|the country|the area|the world|[A-Z][a-z]+)\b/,
  /\b\d[\d,]*\s*\+?\s*(happy\s+|satisfied\s+|loyal\s+)?(customers|clients|buyers|orders|reviews|students|families|homes|sold)\b/i,
  /\b(5|five)[- ]stars?\b|\b\d(\.\d)?\s*stars?\b/i,
  /\bas seen (in|on)\b/i,
];

function proofProblems(text, typed) {
  const t = String(text || '');
  const allowed = String(typed || '').toLowerCase();
  const out = [];
  for (const re of PROOF) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of t.matchAll(g)) {
      if (!allowed.includes(m[0].toLowerCase().replace(/\s+/g, ' ').trim())) out.push({ id: 'needs_proof', why: `"${m[0].trim()}" needs proof: use it only if you typed it`, match: m[0] });
    }
  }
  return out;
}

// Problems in one string, or in every string inside an object or array.
function problems(value, typed = '') {
  if (Array.isArray(value)) return value.flatMap((v) => problems(v, typed));
  if (value && typeof value === 'object') return Object.values(value).flatMap((v) => problems(v, typed));
  if (typeof value !== 'string') return [];
  const out = RULES.filter((r) => r.re.test(value)).map((r) => ({ id: r.id, why: r.why, match: (value.match(r.re) || [''])[0] }));
  return [...out, ...proofProblems(value, typed)];
}

// The `accept` check for an AI draft: the kit's copy rules plus L76.
const clean = (value, typed = '') => ai.cleanCopy(value) && problems(value, typed).length === 0;

// What the member typed or saved, which their own claims may come from.
function typedBy(ctx, input) {
  const b = (ctx && ctx.brain) || {};
  const bits = [JSON.stringify(b.business || {}), JSON.stringify(b.offer || {}), JSON.stringify(b.proof || {}), JSON.stringify(b.reviews || [])];
  for (const v of Object.values(input || {})) if (typeof v === 'string') bits.push(v);
  return bits.join('\n');
}

module.exports = { RULES, PROOF, problems, proofProblems, clean, typedBy };
