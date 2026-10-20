// Next week's plan: 3 to 5 moves, each tied to one number from this week's findings. An AI drafts
// the moves from the findings (aggregated numbers, post captions, ad, campaign and product names, and
// a line about the business); a move whose number isn't one of the findings is thrown out, and the
// rules below write the plan when the AI is off or its draft fails a check. Advice only.

const { views, save, files, ai } = require('../../_kit');
const { C, R, P, ADVICE } = require('../lib/base');
const K = require('../lib/claims');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SCHEMA = {
  type: 'object',
  properties: {
    moves: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: { move: { type: 'string' }, why: { type: 'string' }, number: { type: 'string' }, day: { type: 'string', enum: DAYS } },
        required: ['move', 'why', 'number', 'day'],
      },
    },
  },
  required: ['moves'],
};

const SYSTEM = `You plan one week of marketing for a small business owner, from their own numbers.
Write 3 to 5 moves. Each move is one thing they can do themselves next week, in one sentence, starting with a verb.
Each move must rest on exactly one finding: copy that finding's "number" text exactly into "number", and say in "why" what the finding shows, in one plain sentence.
Never promise results, never predict sales, followers or revenue, never say "guaranteed". Never suggest buying followers or reviews.
Ads: suggest the owner pause, change or raise a budget in their own ads account; budget raises at most 20% at a time. Judge ads only against the owner's own numbers, never other businesses or averages.
Never suggest audience or targeting changes (no age ranges, gender, ZIP codes, radius, lookalikes, nothing for under 18), and never custom audiences, pixels, conversion tracking or lead forms.
Never use a number, ranking or superlative ("#1", "best in town", "500+ customers", "5 stars") that is not in the findings. No before-and-after claims about the body or health, no exact result in a set time.
Spread the moves over the week (the "day" field). Plain words, no dashes, no emoji.`;

module.exports = {
  name: 'cmo.plan_week',
  title: "Plan next week's moves",
  description: "Turns this week's findings (top and bottom posts, ads and products from the member's own exports) into 3 to 5 moves for next week, each tied to one of those numbers. Advice only: nothing is posted or changed.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['plan'],
  credits: 2,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      findings: { type: 'array', items: { type: 'object' }, title: "This week's findings" },
      week: { type: ['string', 'null'] },
      focus: { type: 'string', maxLength: 300, title: 'What matters most next week (optional)', description: 'Like "the holiday gift sets" or "more class sign-ups".' },
      sample: { type: ['boolean', 'null'] },
    },
    required: ['findings'],
  },
  output: {
    type: 'object',
    properties: { moves: { type: 'array' }, text: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['moves', 'text', 'html', 'csv', 'ai', 'sample'],
  },
  async run(input, ctx) {
    const findings = (Array.isArray(input.findings) ? input.findings : []).filter((f) => f && f.number && f.name).slice(0, 14);
    const sample = !!input.sample;
    if (!findings.length) throw new Error("There were no findings to plan from. Run What's working with your post, ad or order exports first.");
    const numbers = new Set(findings.map((f) => f.number));
    // Claims may only come from what the member typed, their Brain, or their own findings (L76 D3).
    const typed = `${K.typedBy(ctx, input)}\n${JSON.stringify(findings)}`;
    const biz = sample ? 'Juniper Lane Candles: small-batch soy candles, sold online, at Saturday markets and in candle making classes. Voice: warm and plain.' : bizLine(ctx);
    const prompt = `Business: ${biz}\n${input.focus ? `What matters most to the owner next week: ${String(input.focus).slice(0, 300)}\n` : ''}This week's findings (side "top" did better than their usual, "bottom" did worse):\n${JSON.stringify(findings.map((f) => ({ side: f.side, area: f.area, name: f.name, number: f.number, why: f.why })), null, 1)}`;
    const res = await ai.aiJson(ctx, {
      task: 'plan',
      system: SYSTEM,
      prompt,
      schema: SCHEMA,
      maxTokens: 1200,
      accept: (dta) => Array.isArray(dta.moves) && dta.moves.length >= 3 && dta.moves.length <= 5 && dta.moves.every((m) => numbers.has(m.number) && m.move.length <= 260 && m.why.length <= 300) && new Set(dta.moves.map((m) => m.number)).size === dta.moves.length && K.clean(dta, typed),
      fallback: () => ({ moves: rules(findings) }),
    });
    const order = (d) => DAYS.indexOf(d);
    const moves = res.data.moves.map((m) => ({ day: m.day, move: m.move, why: m.why, number: m.number, done: '' })).sort((a, b) => order(a.day) - order(b.day));
    const text = moves.map((m, i) => `${i + 1}. ${m.day}: ${m.move}\n   Why: ${m.why} (${m.number})`).join('\n');
    const name = sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const today = R.todayIn(ctx);
    const body = `${sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>Your moves</h2>${moves.map((m, i) => `<div class="card"><span class="tag p">${P.esc(m.day)}</span><h3>${i + 1}. ${P.esc(m.move)}</h3><p>${P.esc(m.why)}</p><p class="muted small">The number: ${P.esc(m.number)}</p></div>`).join('')}</section>
<section><div class="card small muted"><p>${res.ai ? 'Drafted by AI from your findings; every move is tied to one of your numbers.' : 'Written from your findings by fixed rules.'} ${P.esc(ADVICE)}</p></div></section>`;
    const html = P.page(ctx, { title: 'Next week, in moves', kicker: 'Marketing plan', sub: input.week ? `From your week of ${C.shortRange(...String(input.week).split(' to '))}.` : 'From your latest week.', stats: [{ value: String(moves.length), label: 'moves' }], body, foot: `${name}. Made ${R.longDay(today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'next week plan', today, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'next week plan', today, '.csv'), files.csv(moves, [{ key: 'day', label: 'Day' }, { key: 'move', label: 'Move' }, { key: 'why', label: 'Why' }, { key: 'number', label: 'The number' }, { key: 'done', label: 'Done?' }], { bom: true }));
    ctx.log(`${moves.length} moves for next week${res.ai ? '' : ' (rules)'}.`);
    return { moves, text, html: htmlFile, csv: csvFile, ai: res.ai, sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.cards(out.moves.map((m, i) => ({ title: `${i + 1}. ${m.move}`, subtitle: m.day, body: `${m.why} (${m.number})` }))),
      views.copy('The plan as text', out.text),
      views.file(out.html, 'Next week (printable)'),
      views.file(out.csv, 'Checklist (CSV)')
    );
  },
};

function bizLine(ctx) {
  const b = (ctx.brain && ctx.brain.business) || {};
  const v = (ctx.brain && ctx.brain.voice) || {};
  return `${[b.name, b.what || b.offer || b.niche, b.audience ? `for ${b.audience}` : ''].filter(Boolean).join(', ') || 'A small business'}.${v.tone ? ` Voice: ${v.tone}.` : ''}`.slice(0, 400);
}

// The plan without AI: one move per finding, best first, in a fixed order of what usually needs the
// member soonest (an ad spending with nothing back, then what worked, then what slipped).
function rules(findings) {
  const moves = [];
  const add = (f, move, why) => {
    if (moves.length < 5 && !moves.some((m) => m.number === f.number)) moves.push({ move, why, number: f.number });
  };
  const by = (side, re) => findings.filter((f) => f.side === side && re.test(f.area));
  for (const f of by('bottom', /ad$/)) {
    if (/no results/.test(f.number)) add(f, `Pause "${f.name}" in your ads account, or swap its picture and first line before it spends more.`, `It spent with nothing back this week.`);
    else add(f, `Change "${f.name}" in your ads account: a new picture or first line, or a clearer offer. If it is still dear in 3 days, pause it.`, `It cost well over your target per result.`);
  }
  for (const f of by('top', /ad$/).slice(0, 1)) add(f, `Raise the budget on "${f.name}" by up to 20% in your ads account, then leave it 3 days.`, `It got results for less than your target this week.`);
  for (const f of by('top', /post$/).slice(0, 2)) add(f, `Make one more post like ${f.name}: same format and kind, a new angle.`, `${f.why}`);
  for (const f of by('top', /^Product$/).slice(0, 1)) add(f, `Put ${f.name} first: in a post, at the top of your store and in your next email.`, `It sold above its usual this week.`);
  for (const f of by('bottom', /^Product$/).slice(0, 1)) add(f, `Post about ${f.name} and check its photos and price.`, `${f.why}`);
  for (const f of by('bottom', /post$/).slice(0, 1)) add(f, `Repost the idea behind ${f.name} with a new first line.`, `${f.why}`);
  if (moves.length < 3) for (const f of findings) add(f, `Look again at ${f.name} next week and compare.`, f.why);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return moves.slice(0, 5).map((m, i) => ({ ...m, why: String(m.why).replace(/\.?$/, '.'), day: days[Math.min(i, 4)] })).filter((m) => m.move);
}

module.exports.rules = rules;
