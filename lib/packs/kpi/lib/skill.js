// The "numbers skill": a folder with SKILL.md that the member adds to their own Claude, so their
// daily numbers report runs the same way every time. Agent Skills format (claude.com/docs/skills):
// a folder named like the skill, SKILL.md with a name and description up top, reference files next
// to it. No skill export existed in the library before this one; this is the shape to copy.

const EXPORTS = require('../data/exports.json');
const ACTIONS = require('../data/actions.json');
const M = require('./metrics');

const NAME_MAX = 64;
const DESC_MAX = 200;

function skillName(business) {
  const base = String(business || 'my')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_MAX - 14)
    .replace(/-+$/g, '');
  return `${base || 'my'}-daily-numbers`;
}

function description(business) {
  const d = `Daily numbers report for ${business || 'my business'}: yesterday against the 7-day average, what moved and why, one next step. Use when I ask for my numbers or add sales, ads or post exports.`;
  return d.length <= DESC_MAX ? d : `Daily numbers report: yesterday against the 7-day average, what moved and why, one next step. Use when I ask for my numbers or add sales, ads or post exports.`;
}

const HOW = {
  sales: 'Add up what customers paid (sales rows only; skip failed, pending and voided payments).',
  orders: 'Count the paid sales (one per order; a Shopify order spans several rows).',
  aov: 'Sales divided by orders, for the same days.',
  refunds: 'Add up money refunded.',
  refund_rate: 'Refunds divided by sales, for the same days.',
  chargebacks: 'Count chargebacks (disputes) opened.',
  fees: 'Add up payment fees.',
  cash_in: 'Sales minus fees, refunds and chargebacks.',
  ad_spend: 'Add up ad spend.',
  ad_results: 'Add up the results the ad platforms counted.',
  cost_per_result: 'Ad spend divided by ad results, for the same days.',
  click_rate: 'Clicks divided by impressions, for the same days.',
  ad_return: 'Purchase value the ad platforms counted, divided by ad spend.',
  posts: 'Count posts published that day.',
  post_views: 'Add up views of posts published that day.',
  engagement: 'Likes, comments, shares and saves, for every 100 views, on posts published that day.',
  follows: 'Add up follows from posts published that day.',
};

function scorecardTable(metrics, targets) {
  const rows = metrics.map((m) => {
    const t = targets[m.id];
    const how = HOW[m.id] || `Add up "${m.label}" rows from my numbers sheet${m.kind === 'level' ? ' (it is a running total: take the newest value)' : ''}.`;
    return `| ${m.label} | ${how} | ${m.better === 'down' ? 'Lower' : m.better === 'up' ? 'Higher' : 'Neither'} | ${t ? M.targetText(m, t) : 'none set'} |`;
  });
  return ['| Number | How to work it out | Better | My target |', '|---|---|---|---|', ...rows].join('\n');
}

function build({ business, firstName, timezone, metrics, targets, kinds, time }) {
  const name = skillName(business);
  const who = firstName || 'the owner';
  const used = EXPORTS.exports.filter((e) => !kinds.length || kinds.includes(e.kind));
  const md = `---
name: ${name}
description: ${description(business)}
---

# Daily numbers for ${business || 'my business'}

Run this the same way every time ${who} asks for the daily numbers${time ? ` (usually around ${time})` : ''}, or adds exports from ${used.map((e) => e.label).join(', ')}.

## If the 127 connector is on in this chat

When ${who}'s Stripe or Shopify is connected in 127 and no files were added here, use the 127 tool start_workflow with the workflow kpi.daily_report, then show its result with get_run. Stop there: 127 does the same steps below. When ${who} added files here, do it here.

## Otherwise, do it here

1. Read every CSV ${who} added. Tell which export each one is from its header row, using reference/exports.md. If a file matches none, say which columns it has and skip it.
2. Never read or repeat customer names, emails, phone numbers or addresses. Use only dates, amounts, product names, campaign names and post captions.
3. The report day is yesterday in ${timezone || 'my time zone'}. If the newest date in the files is older, use that day and say how many days old it is.
4. For each number on the scorecard below, work out the report day's value and the average of the 7 days before it. Work out ratios (average order, refund rate, cost per result, click rate) from the totals of those days, never by averaging daily ratios.
5. If both Stripe files are there, take sales, refunds and chargebacks from the payments file and only payouts from the balance file. If a Shopify orders file and a Stripe or PayPal file are both there, say that store sales may count twice if the store takes payment through Stripe or PayPal.
6. Ads without day-by-day rows stay out of the daily report. Say how to export them by day.
7. What moved: up to 3 numbers that changed 20% or more (and by 2 or more for counts, $5 or more for money), earlier scorecard numbers first. For each, one sentence with the reason from the same files: more orders or bigger orders, the product that sold most against its usual, which payment source jumped, or a post from the 2 days before with 3 times the usual views.
8. One next step, in this order: an open chargeback (answer it before its due date); else the number that moved the wrong way most (see reference/next-steps.md); else repeat what went best; else "Keep going."

## The scorecard

${scorecardTable(metrics, targets)}

## How to answer

- First line: the first scorecard number for the day, its 7-day average and the change, like "Sales Sun, Oct 18: $898, up 25% on the 7-day average ($721)."
- Then the next step and why, in two sentences.
- Then "What moved" with up to 3 lines, then the scorecard as a table: number, day, 7-day average, change, target.
- Plain words. Only ${who}'s own numbers: never forecast, never say what ${who} will make, never compare with other businesses.
- Advice only: never change an ad, send a message or post anything.
`;
  const exportsMd = `# How to tell each export apart

Read the header row (Google Ads puts a title line and a date range above it). Only the columns listed under "Uses" are needed.

${used.map((e) => `## ${e.label}\n\n- How ${who} exports it: ${e.how}\n- Looks like: ${e.identify}\n- Uses: ${e.uses}\n`).join('\n')}`;
  const stepsMd = `# Next steps by number

When a number moved the wrong way, suggest the line for it. Fill {product} with the best seller of the last 14 days, {post} with the post with the most views, {ad} with the ad that cost the most per result (or the best one, when things went well).

## Went down (higher is better)

${Object.entries(ACTIONS.down).map(([k, v]) => `- ${(M.METRICS[k] || { label: 'A number from my sheet' }).label}: ${v}`).join('\n')}

## Went up (lower is better)

${Object.entries(ACTIONS.up_bad).map(([k, v]) => `- ${(M.METRICS[k] || { label: 'A number from my sheet' }).label}: ${v}`).join('\n')}

## Went well

${Object.entries(ACTIONS.up).filter(([k]) => k !== 'default').map(([k, v]) => `- ${M.METRICS[k].label}: ${v}`).join('\n')}

Chargebacks: Stripe says the card industry treats dispute activity above 0.75% of payments as excessive, and cardholders can dispute up to 120 days after a payment (docs.stripe.com/disputes/measuring).
`;
  const csv = ['Number,My target', ...metrics.map((m) => `"${m.label.replace(/"/g, '""')}","${targets[m.id] ? M.targetText(m, targets[m.id]) : ''}"`)].join('\r\n');
  return { name, description: description(business), files: [{ name: `${name}/SKILL.md`, data: md }, { name: `${name}/reference/exports.md`, data: exportsMd }, { name: `${name}/reference/next-steps.md`, data: stepsMd }, { name: `${name}/reference/scorecard.csv`, data: `${csv}\r\n` }], md };
}

module.exports = { build, skillName, description, NAME_MAX, DESC_MAX };
