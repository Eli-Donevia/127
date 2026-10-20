// The daily ad check as a Claude skill: a folder with SKILL.md and reference files that the member adds
// to their own Claude, so the check runs the same way every day with their own numbers written in.
// Same shape as the kpi pack's numbers skill (Agent Skills format: name and description up top, at
// most 64 and 200 characters on Claude.ai).

const { money } = require('../../_kit');
const OPT = require('../data/optimizer.json');
const LINES = require('../data/screen-lines.json');

const NAME_MAX = 64;
const DESC_MAX = 200;

function skillName(business) {
  const base = String(business || 'my')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_MAX - 16)
    .replace(/-+$/g, '');
  return `${base || 'my'}-daily-ad-check`;
}

function description(business) {
  const d = `Daily ad check for ${business || 'my business'}: reads my Meta, Google or TikTok export and suggests what to stop, keep, raise or refresh, for my OK. Use when I add an ads export.`;
  return d.length <= DESC_MAX ? d : 'Daily ad check: reads my Meta, Google or TikTok export and suggests what to stop, keep, raise or refresh, for my OK. Use when I add an ads export.';
}

function build({ business, firstName, timezone, numbers: n, resultIs = 'lead' }) {
  const name = skillName(business);
  const who = firstName || 'the owner';
  const R = OPT.rules;
  const have = n && n.price && n.maxCpl > 0;
  const usd = (v) => money.usd(v);
  const nums = have
    ? [
        `- Price per job: ${usd(n.price)}. Profit per customer in 30 days (break-even cost per customer): ${usd(n.breakEven)}.`,
        `- Target cost per customer (half of that): ${usd(n.target)}.`,
        `- Close rate: ${n.closeRate}%. Max cost per lead: ${usd(n.maxCpl)}.`,
        `- A "result" in the export is a ${resultIs === 'sale' ? 'sale (cost per customer = cost per result)' : `lead (cost per customer = cost per result divided by ${n.closeRate / 100})`}.`,
      ].join('\n')
    : '- No price on file yet. Ask for the price per job, the cost per job and the close rate before judging any ad, and work out: profit per job = price minus cost minus card fees (2.9% plus 30 cents); target cost per customer = half the profit per customer in 30 days; max cost per lead = target times close rate.';
  const md = `---
name: ${name}
description: ${description(business)}
---

# Daily ad check for ${business || 'my business'}

Run this the same way every time ${who} adds an ads export or asks for the daily ad check. It suggests changes; it never makes them.

## ${who}'s numbers

${nums}

## Steps

1. Read every CSV ${who} added. Tell Meta, Google and TikTok exports apart by their header row (reference/exports.md). Google puts a title line and a date range above the header; skip those and any Total rows.
2. Use only campaign names, ad names, dates and the numbers: spend, impressions, reach, frequency, clicks, results, conversion value. These exports are totals; never look for or repeat anything about the people who saw the ads.
3. For each ad (or ad group, or campaign, as low as the file goes), add up the days, then work out cost per result and cost per customer with the numbers above.
4. Apply the rules in reference/rules.md, in that order, one suggestion per ad. Then the budget move: when an ad is being turned off and another on the same network is under target, suggest moving the first one's daily spend to the second.
5. Fatigue needs day-by-day rows: compare the first 3 days with the last 3. If there's only one row per ad, say how to export by day.

## How to answer

- One line per suggestion, in this pattern: "${OPT.line.replace('{change}', '{change}').replace('{campaign}', '{campaign, ad}').replace('{effect}', '{what it does to spend}').replace('{why}', '{the numbers}')} ${OPT.doneLine.replace('{network}', '{network}')}"
- Order: turn off, move budget, raise, new creative, watch, keep.
- Plain words. Only ${who}'s own numbers: never compare with other businesses, never forecast sales or income, never promise a result.
- Suggestions only. Never change an ad, a budget or a setting, never write automatic rules, and never offer to make every change at once: ${who} makes each change in the network.
- Never suggest changing who sees an ad: no narrower ages, no gender, ZIP codes, excluded places, smaller radius, lookalikes or customer lists. Every audience starts at 18. Housing, jobs and credit ads keep the network's special category limits.
- A new creative idea follows the ad rules: no income or earnings claims, no sure results or results in a set time, no before-and-after for the body or health, no reviews, ratings, customer counts or people presented as customers that ${who} didn't give. For any number or "best" claim ${who} hasn't given: "${LINES.backup}"
- Time zone for "today" and "yesterday": ${timezone || 'America/Chicago'}.
`;
  const rulesMd = `# Rules, in order

${[
    ['Too early', `Fewer than ${R.early.minImpressions.toLocaleString('en-US')} views and less than one max cost per lead spent. Keep it running. No change to spend.`],
    ['Turn it off (no results)', `${R.stopNoResults.why} Spend effect: saves about its average daily spend over the last 3 days.`],
    ['Turn it off (too dear)', `${R.stopTooDear.why} Spend effect: saves about its daily spend.`],
    ['Raise it', `${R.scale.why} Frequency under ${R.scale.maxFrequency} when the file has it. Raise the daily budget about ${Math.round(R.scale.raise * 100)}%, and again only after 3 more days under target. Spend effect: up to that much more a day.`],
    ['Keep it', `${R.keep.why} No change to spend.`],
    ['Watch it', `${R.watch.why} Keep it, and test a new first line, first frame or the page, one at a time. No change to spend.`],
    ['New creative (fatigue)', `${R.fatigue.why} At least ${R.fatigue.minDays} days. Same budget, a new ad for the same angle.`],
    ['Move budget', `${R.shift.why} No change to total spend.`],
  ].map(([t, d]) => `## ${t}\n\n${d}\n`).join('\n')}`;
  const exportsMd = `# How to tell each export apart

${OPT.exports.map((e) => `## ${e.network}\n\n- How to export it: ${e.how}\n- Looks like: ${e.identify}\n- Uses: ${e.uses}\n- Column names: ${e.verified}\n`).join('\n')}`;
  return {
    name,
    description: description(business),
    md,
    files: [
      { name: `${name}/SKILL.md`, data: md },
      { name: `${name}/reference/rules.md`, data: rulesMd },
      { name: `${name}/reference/exports.md`, data: exportsMd },
    ],
  };
}

module.exports = { build, skillName, description, NAME_MAX, DESC_MAX };
