// Copy check: the claims 127's own copy never makes, as rules a test and a script can run.
// Sources: legal/05-earnings-disclaimer.md (rules 1 to 7, 6a for First 25, S23), conversion/offer.md (no "$X value",
// "Last chance" only on Nov 24, never "guarantee"), brand/voice-and-messaging.md (no em dashes, the avoid list),
// and the v2 playbook's kill list. The full list with the words to use instead: v2/design/copy-check.md.
//
// Severity: "block" fails the test and the script. "hold" is a claim Legal holds (First 25 times, S23; a bare "Free" or
// "No signup", S22; a paid plan's weekly list, L62): it's listed, not failed, until a lawyer or the evidence clears it.
//
// Scope: 127's marketing and member-facing copy (pages, emails) and what First 25 writes (the messages people send).
// Legal pages are out (they must say "no guarantee"), and so are the member library and the tools' prompts, which teach
// members to write their own offers. check() takes any text, so generated output can be run through it too.
//
//   node scripts/copy-check.js [files or folders...] [--date 2026-11-24]   (no files: the site's own copy)

// A negation just before the match ("no guarantee", "doesn't include done-for-you work") makes it fine.
const NEGATED = /(\bno|\bnot|\bnever|\bwithout|n't|\bnor|\bzero)\b[^.!?\n]{0,40}$/i;

// Legal L62: until a lawyer rules on the FTC Business Opportunity Rule (16 CFR 437), copy about a paid plan (Builder, the
// Circle, 127 HQ) never says it gets members clients, customers, leads or prospects, or finds them businesses. These rules
// count only in a sentence that names a paid plan, so First 25, which is free, can still say it finds businesses. Copy
// that is all about paid plans (the plan cards, the pricing page, HQ's own pages) passes { paid: true }, and every
// sentence counts.
const PAID_PLAN = /\b(?:builder|founder'?s circle|the circle|circle members?|127 hq|hq|membership|paid plans?|founding members?|members?|upgrad(?:e|es|ing))\b/i;
// Up to 3 words between the verb and who it gets ("get you more paying clients"), but not across "to", "with" or "for"
// ("send it to your best customers" is advice, not a promise).
const BETWEEN = String.raw`\s+(?:(?:you|members|them)\s+)?(?:(?!(?:and|or|to|with|for|from|of|about|like|by|on|at|in)\b)[\w'-]+\s+){0,3}?`;
const GETS = String.raw`get|gets|getting|find|finds|finding|land|lands|landing|brings?\s+in|bring|brings|win|wins|winning|deliver|delivers|delivering|send|sends|hand|hands|book|books|booking|generate|generates|generating|attract|attracts|attracting|source|sources|sourcing|supply|supplies|provide|provides|providing|give|gives|giving|turn(?:s|ing)?\b[^.!?\n]{0,40}?\binto|more|fresh|steady|weekly|qualified|warm`;
const FINDS = String.raw`get|gets|find|finds|finding|bring|brings|deliver|delivers|send|sends|hand|hands|give|gives|source|sources|supply|supplies|provide|provides|lists?|fresh`;
const PEOPLE = String.raw`clients?|customers?|leads?|prospects?`;
const PAID_PLAN_GETS = new RegExp(String.raw`\b(?:${GETS})${BETWEEN}(?:${PEOPLE})\b|\b(?:${FINDS})${BETWEEN}businesses\b|\b(?:${PEOPLE}|businesses)\s+(?:for you|on autopilot|delivered|to your inbox|(?:every|each)\s+(?:week|monday|month|day))\b`, 'gi');

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
  { id: 'paid-plan-customers', severity: 'block', negatable: true, paidPlan: true,
    why: 'A paid plan never says it gets members clients, customers, leads or prospects, or finds them businesses (Legal L62). Say what the plan has: the scripts, the worksheet, the tracking.',
    re: PAID_PLAN_GETS },
  { id: 'paid-plan-weekly-list', severity: 'hold', paidPlan: true, why: 'A paid plan that hands members a fresh list every week waits for a lawyer (Legal L62).',
    re: /\b(?:fresh|new)\s+(?:25|list)\b|\b(?:25|list|search)\b[^.!?\n]{0,40}\bevery\s+(?:week|monday)\b|\bevery\s+(?:week|monday)\b[^.!?\n]{0,40}\b(?:25|list|search)\b/gi },
  { id: 'first25-free', severity: 'hold', why: '"Free" or "No signup" on First 25 has "all 25 with your email" beside it (Legal S22).', first25: true, saysWhatsFree: true,
    re: /(?<!\bstart )\bfree\b|\bno sign ?-?up\b|\bwithout signing up\b/gi },
  // Free members get weeks 1 and 2 of the roadmap; weeks 3 and 4 come with Builder. A line that names 30 days and free
  // says which part is free in the same sentence (Legal L70, 05 Part C rule 6b).
  { id: 'free-roadmap', severity: 'block', saysWhichWeeks: true, why: 'Weeks 1 and 2 of the roadmap are free, weeks 3 and 4 come with Builder. Say "weeks 1 and 2 free" in the same line, never "free 30-day roadmap" (Legal L70).',
    re: /\bfree\b[^.!?\n]{0,40}\b30[- ]day|\b30[- ]day[^.!?\n]{0,40}\bfree\b|\bfull 30[- ]day/gi },
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
  // or "No signup" passes when the email it takes for all 25 is beside it ("free with your email", "Top 3 free, all 25
  // with your email"). "No signup" alone reads as if all 25 need none.
  const nearFirst25 = (i, before = 100, after = 40) => /\bfirst\s+25\b|\b25\s+(?:local\s+)?businesses\b|\ball\s+25\b/i.test(t.slice(Math.max(0, i - before), i + after));
  // The sentence a match sits in, for rules that count only next to a paid plan's name.
  const sentenceAt = (i, len) => {
    const start = Math.max(t.lastIndexOf('.', i - 1), t.lastIndexOf('!', i - 1), t.lastIndexOf('?', i - 1), t.lastIndexOf('\n', i - 1)) + 1;
    const rest = t.slice(i + len).search(/[.!?\n]/);
    return t.slice(start, rest < 0 ? t.length : i + len + rest);
  };
  const saysWhatsFree = (i) => /\bwith (?:your|an|a) e-?mail\b|\ball 25\b[^.!?\n]{0,30}\be-?mail\b|\be-?mail\b[^.!?\n]{0,30}\ball 25\b/i.test(t.slice(Math.max(0, i - 160), i + 160));
  for (const r of RULES) {
    if (r.lastChance && isCloseDay(opts.date)) continue;
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(t))) {
      const i = m.index;
      if (r.negatable && NEGATED.test(t.slice(Math.max(0, i - 60), i).split(/[.!?\n]/).pop())) continue;
      if (r.first25 && !(r.saysWhatsFree ? nearFirst25(i, 160, 60) : nearFirst25(i))) continue;
      if (r.saysWhatsFree && saysWhatsFree(i)) continue;
      if (r.saysWhichWeeks && /\bweeks? 1 and 2\b|\bfirst two weeks\b/i.test(sentenceAt(i, m[0].length))) continue;
      if (r.paidPlan && !opts.paid && !PAID_PLAN.test(sentenceAt(i, m[0].length))) continue;
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
