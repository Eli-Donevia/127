// What ad copy must never say: income claims, promised results, pressure that may not be true,
// call-outs of a personal trait (Meta's ad rules reject "Are you struggling with...") and claims
// a small business can't back up ("best in Austin"). Every line the ad tools write goes through
// problems() before it reaches a file; a line with a problem is dropped or replaced.

const { text } = require('../../_kit');

const RULES = [
  {
    id: 'income',
    why: 'An income claim',
    rx: /\b(earn|make|making|made)\s+(\$|up to\b|over\b|six\b|seven\b|\d)|\$\s?\d[\d,.]*k?\s*(\/|a|per)\s*(month|week|day|year|mo|wk|hr|hour)\b|\b(six|seven)[- ]figures?\b|\bpassive income\b|\bfinancial freedom\b|\bquit your (day )?job\b|\bget rich\b|\bside income\b|\bextra income\b/i,
  },
  {
    id: 'promise',
    why: 'A promised result',
    rx: /\bguarantee(d|s)?\b|\b100% (results|satisfaction|success|effective)\b|\bresults in \d+ (days?|weeks?)\b|\b(lose|drop) \d+ ?(lbs|pounds|kg)\b|\bnever fails\b|\bwill (get|see|have|land) (results|clients|customers|leads)\b|\brisk[- ]free\b|\bcures?\b|\bproven to\b/i,
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

// [{ id, why, match }] for one line of copy, house copy rules included (dashes, emoji, banned words).
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

const ok = (line) => problems(line).length === 0;

// The first candidate with no problem, or '' when none passes.
function firstOk(cands) {
  for (const c of cands) if (c && ok(c)) return c;
  return '';
}

// Every problem across labeled lines: [{ where, text, why, match }].
function scan(rows) {
  return rows.flatMap((r) => problems(r.text).map((p) => ({ where: r.where, text: r.text, why: p.why, match: p.match })));
}

module.exports = { RULES, problems, ok, firstOk, scan };
