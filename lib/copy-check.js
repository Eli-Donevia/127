// Copy check: the claims 127's own copy never makes, as rules a test and a script can run.
// Sources: legal/05-earnings-disclaimer.md (rules 1 to 7, 6a for First 25, S23), conversion/offer.md (no "$X value",
// "Last chance" only on Nov 24, never "guarantee"), brand/voice-and-messaging.md (no em dashes, the avoid list),
// and the v2 playbook's kill list. The full list with the words to use instead: v2/design/copy-check.md.
//
// Severity: "block" fails the test and the script. "hold" is a First 25 claim Legal holds (times, S23; a bare "Free",
// S22): it's listed, not failed, until the evidence is on file or the wording says what's free.
//
// Scope: 127's marketing and member-facing copy (pages, emails) and what First 25 writes (the messages people send).
// Legal pages are out (they must say "no guarantee"), and so are the member library and the tools' prompts, which teach
// members to write their own offers. check() takes any text, so generated output can be run through it too.
//
//   node scripts/copy-check.js [files or folders...] [--date 2026-11-24]   (no files: the site's own copy)

// A negation just before the match ("no guarantee", "doesn't include done-for-you work") makes it fine.
const NEGATED = /(\bno|\bnot|\bnever|\bwithout|n't|\bnor|\bzero)\b[^.!?\n]{0,40}$/i;

const RULES = [
  { id: 'income', severity: 'block', negatable: true, why: 'Income target or promise (Legal 05 rules 1 and 2). Promise the plan and the tools, never money.',
    re: /\b(?:you(?:'ll| will| can| could)?|members?|they(?:'ll)?)\s+(?:earn|make|bring in|clear|net)\s+(?:up to |over |more than )?\$\d|\$\s?\d[\d,.]*\s?[kKmM]\+?\s*(?:\/|a |per )\s*(?:mo|month|week|wk|year|yr)\b|\b(?:six|seven)[- ]figures?\b|\bquit your (?:day )?job\b|\bpassive income\b|\bfinancial freedom\b|\bget rich\b|\bmillion[- ]dollar (?:business|company)\b/gi },
  { id: 'guarantee', severity: 'block', negatable: true, why: 'Never "guarantee". Say "14 days to change your mind" (offer.md section 4).',
    re: /\bguarantee(?:s|d)?\b/gi },
  { id: 'value-total', severity: 'block', why: 'No dollar value totals or "save $X" math (offer.md section 6).',
    re: /\$[\d,]+(?:\.\d\d)?\+?\s+(?:in\s+)?(?:total\s+)?value\b|\bvalued? at\s+\$|\bworth\s+(?:over\s+|more than\s+)?\$\d|\bsave\s+(?:over\s+)?\$\d/gi },
  { id: 'done-for-you', severity: 'block', negatable: true, why: 'Never "done-for-you" (v2 playbook 1.3). Say "The busywork, done. The decisions stay yours."',
    re: /\bdone[- ]for[- ]you\b/gi },
  { id: 'em-dash', severity: 'block', why: 'No em dashes in copy (voice section 4, rule 7). Use a period or a comma.',
    re: /—|[A-Za-z][,.]?\s–\s\w|\w\s–\s[A-Za-z]/g },
  { id: 'last-chance', severity: 'block', why: '"Last chance" only on the founding close day, Nov 24 (offer.md section 5).', lastChance: true,
    re: /\blast chance\b/gi },
  { id: 'hormozi', severity: 'block', why: "Hormozi's name and book titles stay out of anything 127 publishes (v2 playbook kill list).",
    re: /\bhormozi\b|\$100M\s+(?:offers|leads|money models?)\b/gi },
  { id: 'hype', severity: 'block', negatable: true, why: 'On the voice avoid list (voice section 4).',
    re: /\bunlock your (?:full )?potential\b|\blevel up your life\b|\bin today's fast[- ]paced world\b|\bcrush it\b|\bboss (?:babe|up)\b|\bovernight (?:success|results)\b|\bsix[- ]figure secrets\b|\bgame[- ]changer\b/gi },
  { id: 'outcome-promise', severity: 'block', why: 'Promises a result (v2 playbook 1.3, Legal L54). Promise the list and the words, never clients, replies or a date.',
    re: /\bready to sell in\b|\bland (?:\d+|your first|three|five|ten) (?:clients?|customers?)\b|\byour first (?:client|customer)s?\b(?= (?:this|in|by|tonight|today))|\bfirst 25 clients\b|\bbusinesses that need (?:it|what you sell)\b|\bwhat's broken in their marketing\b/gi },
  { id: 'first25-time', severity: 'hold', why: 'First 25 time claims wait for timed runs on file (Legal S23).', first25: true,
    re: /\b(?:in|about|under|within)\s+(?:about\s+)?(?:a|one|\d+)\s+(?:minutes?|seconds?)\b|\b\d+\s+seconds\b|\btonight\b/gi },
  { id: 'first25-free', severity: 'hold', why: '"Free" on First 25 says what is free: the top 3 with no signup, all 25 with your email (Legal S22).', first25: true, saysWhatsFree: true,
    re: /(?<!\bstart )\bfree\b/gi },
];

// Eli's money figures need the earnings line in the same email or page (Legal 05 Part B, L37, L46).
const ELI_MONEY = /\$1M\+?\s+(?:fintech\s+)?(?:startup\s+)?valuation|valued at over \$1M|\$50K\s+in\s+gross\s+sales/i;
const EARNINGS_LINE = /aren't typical or a promise of what you'll earn|not a promise of income|earnings[- ]disclaimer|earnings-note/i;

// Drop what a reader never sees: EJS comments and scriptlet comments, HTML comments, CSS, and JS comments in .js files.
function visible(text, file = '') {
  let t = String(text);
  if (/\.(ejs|html?)$/i.test(file)) {
    t = t.replace(/<%#[\s\S]*?%>/g, (m) => m.replace(/[^\n]/g, ' '));
    t = t.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    t = t.replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '));
    t = t.replace(/<%(?![=-])[\s\S]*?%>/g, (m) => m.replace(/(^|[^:'"])\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, ' ')));
    // HTML tags become a space, so words split across spans read as one line ("first</span> <span>25"). Text a reader
    // still sees in attributes (share titles, alt text, placeholders) stays.
    t = t.replace(/<\/?[a-zA-Z][^>]*>/g, (m) => {
      const said = [...m.matchAll(/\b(?:content|alt|title|placeholder|aria-label)\s*=\s*"([^"]*)"/gi)].map((a) => a[1]).join(' . ');
      return ' ' + said + (said ? ' . ' : '') + m.replace(/[^\n]/g, '');
    });
  } else if (/\.(js|cjs|mjs)$/i.test(file)) {
    t = t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    t = t.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));
  }
  return t;
}

const isCloseDay = (date) => /^2026-11-24/.test(String(date || ''));

// Findings for one piece of copy: [{ rule, severity, line, col, match, why }].
function check(text, opts = {}) {
  const t = visible(text, opts.file);
  const out = [];
  const lineOf = (i) => t.slice(0, i).split('\n').length;
  // First 25 claims count only near the tool's name or its 25 businesses ("Your first 25. Found tonight."), and "Free"
  // passes when the words around it say what's free ("free with your email", "top 3 free, no signup").
  const nearFirst25 = (i, before = 100, after = 40) => /\bfirst\s+25\b|\b25\s+(?:local\s+)?businesses\b|\ball\s+25\b/i.test(t.slice(Math.max(0, i - before), i + after));
  const saysWhatsFree = (i) => /e-?mail|\btop (?:3|three)\b|\bno sign ?-?up\b|without signing/i.test(t.slice(Math.max(0, i - 160), i + 160));
  for (const r of RULES) {
    if (r.lastChance && isCloseDay(opts.date)) continue;
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(t))) {
      const i = m.index;
      if (r.negatable && NEGATED.test(t.slice(Math.max(0, i - 60), i).split(/[.!?\n]/).pop())) continue;
      if (r.first25 && !(r.saysWhatsFree ? nearFirst25(i, 160, 60) : nearFirst25(i))) continue;
      if (r.saysWhatsFree && saysWhatsFree(i)) continue;
      const ln = lineOf(i);
      out.push({ rule: r.id, severity: r.severity, line: ln, col: i - t.lastIndexOf('\n', i - 1), match: m[0].trim(), why: r.why });
    }
  }
  if (ELI_MONEY.test(t) && !EARNINGS_LINE.test(t) && !opts.footerHasEarnings) {
    const i = t.search(ELI_MONEY);
    out.push({ rule: 'earnings-line', severity: 'block', line: lineOf(i), col: 1, match: t.match(ELI_MONEY)[0], why: "An Eli money figure needs the earnings line with it: \"Eli's results aren't typical or a promise of what you'll earn.\"" });
  }
  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}

module.exports = { RULES, check, visible };
