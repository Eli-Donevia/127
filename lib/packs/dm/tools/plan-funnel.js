// Plans one DM funnel: the goal, three keyword options to pick from, the path a person takes, the
// ManyChat plan it needs (with today's price from data/platform.json), and a live check that the
// member's link opens. Pure code plus one polite request to the member's own link.

const { views, web, text, time, brain } = require('../../_kit');
const platform = require('../data/platform.json');
const { GOALS, goalOf, pathFor, numbersFor, planFor } = require('../lib/goals');
const { keywordOptions } = require('../lib/keywords');
const { factsFor } = require('../lib/facts');
const { cleanHandle } = require('../lib/instagram');

const GOAL_IDS = Object.keys(GOALS);

async function checkLink(ctx, link) {
  const url = web.normalizeUrl(link);
  if (!url) return { status: 'missing', note: 'Add the link people should get. You can paste it into ManyChat later too.' };
  try {
    if (!(await web.allowed(ctx, url))) return { status: 'not_checked', url, note: "That site asks bots not to visit, so open the link yourself once to make sure it works." };
    const r = await web.getText(ctx, url, { timeoutMs: 10000, maxBytes: 60000 });
    if (r.ok) return { status: 'works', url, final: r.url || url, note: 'Your link opens.' };
    if (r.status === 401 || r.status === 403) return { status: 'private', url, note: `The link answered ${r.status}: it may need a login. Open it in a private window to be sure strangers can see it.` };
    if (r.status === 404 || r.status === 410) return { status: 'broken', url, note: `The link answered ${r.status} (not found). Fix it before you go live.` };
    return { status: 'not_checked', url, note: `The link answered ${r.status}. Open it yourself once before you go live.` };
  } catch {
    return { status: 'not_checked', url, note: "We couldn't reach the link from here. Open it yourself once before you go live." };
  }
}

// "2026-11-20" -> "Friday, November 20"; free text stays as typed.
function dateText(d) {
  const s = String(d || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return text.oneLine(s);
  return `${time.WEEKDAYS[time.weekdayOf(s)]}, ${time.longDate(s).replace(/, \d{4}$/, '')}`;
}

module.exports = {
  name: 'dm.plan_funnel',
  title: 'Plan your DM funnel',
  description: 'Plans an Instagram comment or story reply funnel for ManyChat: three keyword options, the path people take, the ManyChat plan it needs, and a check that your link opens.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      goal: { type: 'string', title: 'Goal', enum: GOAL_IDS, default: 'freebie' },
      offer: { type: 'string', title: 'What people get', description: 'Your freebie, call, product or launch, in a few words', maxLength: 160 },
      link: { type: 'string', title: 'Link', description: 'Where the DM sends people', maxLength: 500 },
      keyword: { type: 'string', title: 'Keyword (optional)', maxLength: 20 },
      inside: { type: 'string', title: "What's in it (optional)", maxLength: 400 },
      launch: { type: 'string', title: 'What is launching', maxLength: 120 },
      date: { type: 'string', title: 'Launch date', maxLength: 40 },
      price: { type: 'string', title: 'Price', maxLength: 40 },
      emailCapture: { type: 'boolean', title: 'Ask for their email in the DM', default: false },
      instagram: { type: 'string', title: 'Instagram handle', maxLength: 60 },
      product: { type: 'object', title: 'Product facts' },
    },
  },
  output: {
    type: 'object',
    properties: {
      goal: { type: 'string' },
      keywords: { type: 'array' },
      path: { type: 'array' },
      link: { type: 'object' },
      manychat: { type: 'object' },
      facts: { type: 'object' },
    },
    required: ['goal', 'keywords', 'path', 'facts'],
  },
  async run(input, ctx) {
    const goal = goalOf(input.goal);
    const g = GOALS[goal];
    const product = input.product && typeof input.product === 'object' && input.product.name ? input.product : null;
    const f = factsFor(ctx, { ...input, goal, product });
    const b = brain.brainOf(ctx, input);
    const handle = cleanHandle(input.instagram || b.instagram);
    const emailCapture = !!input.emailCapture;
    ctx.log(`Planning a ${g.label.toLowerCase()} funnel for ${f.business}`);

    const keywords = keywordOptions({ goal, offer: goal === 'waitlist' ? input.launch || f.thing : f.thing, product: product ? product.name : '', keyword: input.keyword });
    const link = product && product.url && !input.link ? await checkLink(ctx, product.url) : await checkLink(ctx, input.link);
    const plan = planFor({ emailCapture, wantTags: true });
    const plans = platform.manychat.plans.list.map((p) => ({ id: p.id, name: p.name, monthly: p.monthly, activeContacts: p.activeContacts, liveAutomations: p.liveAutomations }));
    const pick = plans.find((p) => p.id === plan.plan) || plans[0];

    return {
      goal,
      label: g.label,
      summary: g.summary,
      trigger: g.trigger,
      keywords,
      path: pathFor(goal, { keyword: keywords[0].keyword, emailCapture }),
      numbers: numbersFor(goal),
      link,
      emailCapture,
      manychat: { plan: pick, why: plan.why, plans, checked: platform.manychat.plans.checked, caveat: platform.manychat.plans.caveat, source: platform.manychat.plans.list.find((p) => p.id === pick.id).source },
      instagram: handle,
      igme: handle ? `https://ig.me/m/${handle}` : '',
      facts: {
        business: f.business,
        hasName: f.hasName,
        thing: f.thing,
        kind: f.kind,
        topic: f.topic,
        inside: f.inside,
        audience: f.audience,
        audienceShort: f.audienceShort,
        what: f.what,
        city: f.city,
        price: f.price,
        productName: f.productName,
        productDetail: f.productDetail,
        productImage: product && product.image ? product.image : '',
        launch: f.launch,
        date: input.date || '',
        dateText: dateText(input.date),
        first: f.first,
        instagram: handle,
        website: f.website,
      },
      today: time.today(ctx),
    };
  },
  view(out) {
    const k = out.keywords || [];
    return views.blocks(
      views.text(`${out.label}: ${out.summary}`),
      views.cards(k.map((o, i) => ({ title: o.keyword, subtitle: i === 0 ? 'Top pick' : 'Option', body: `${o.why} ${o.note}`.trim() }))),
      out.link && views.metric('Your link', out.link.status === 'works' ? 'Opens' : out.link.status === 'missing' ? 'Not added yet' : out.link.status === 'broken' ? 'Broken' : 'Check it yourself', out.link.note),
      out.manychat && views.metric('ManyChat plan', out.manychat.plan.name, text.clip(out.manychat.why, 150))
    );
  },
};
