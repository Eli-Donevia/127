// Writes every message in the funnel: 5 public comment replies, the opening DM with its button
// (Instagram allows one message to a commenter until they respond, and a button tap counts), the
// link message, a follow-up inside the 24 hour window, an optional email ask, and the tags.
// AI drafts when it's on; otherwise templates built from the member's facts. Either way every
// line is checked against ManyChat's limits before it reaches the member.

const { ai, views, text, brain } = require('../../_kit');
const { GOALS, goalOf, tagsFor, trackedLink, FOLLOW_UP_HOURS } = require('../lib/goals');
const { flowFallback } = require('../lib/copy');
const { toItems, messagesFrom, problemsOf } = require('../lib/flow');
const { LIMITS, checkMessage, checkPublicReply, fitButton } = require('../lib/limits');
const { clean } = require('../lib/keywords');

const msg = (max) => ({ type: 'object', properties: { text: { type: 'string', maxLength: max }, button: { type: 'string', maxLength: LIMITS.button } }, required: ['text', 'button'] });

function schemaFor(goal, emailCapture) {
  const props = {
    linkMessage: goal === 'waitlist' && emailCapture ? { type: 'object', properties: { text: { type: 'string', maxLength: 600 } }, required: ['text'] } : msg(600),
  };
  const required = ['linkMessage'];
  if (goal !== 'story') {
    props.publicReplies = { type: 'array', items: { type: 'string', maxLength: LIMITS.publicReply }, minItems: 5, maxItems: 5 };
    props.opening = msg(600);
    required.push('publicReplies', 'opening');
  }
  if (!(goal === 'waitlist' && emailCapture)) {
    props.followUp = msg(600);
    required.push('followUp');
  }
  if (goal === 'booking') {
    props.qualifier = { type: 'object', properties: { text: { type: 'string', maxLength: 400 }, options: { type: 'array', items: { type: 'string', maxLength: LIMITS.button }, minItems: 3, maxItems: 3 } }, required: ['text', 'options'] };
    required.push('qualifier');
  }
  if (emailCapture) {
    props.emailAsk = { type: 'object', properties: { text: { type: 'string', maxLength: 600 } }, required: ['text'] };
    required.push('emailAsk');
  }
  return { type: 'object', properties: props, required };
}

// An AI draft passes only if every line fits ManyChat and the copy rules, and no link sits in text.
function fits(copy) {
  if (!ai.cleanCopy(copy)) return false;
  const all = [copy.opening, copy.linkMessage, copy.followUp, copy.emailAsk, copy.qualifier].filter(Boolean);
  for (const m of all) {
    if (/https?:\/\/|www\./i.test(m.text || '')) return false;
    const buttons = [m.button, ...(m.options || [])].filter(Boolean);
    if (!checkMessage({ text: m.text, buttons }).ok) return false;
  }
  return (copy.publicReplies || []).every((r) => checkPublicReply(r).ok);
}

const BRIEF = {
  freebie: 'They commented to get a free resource. Deliver it fast and warmly.',
  booking: 'They commented because they might want to book a call. Make booking feel easy and low pressure. Ask one short question with 3 answer buttons before sending the calendar.',
  product: 'They commented about a product. Send the product link with its name and price. Friendly, not pushy.',
  story: 'They replied to a story with the keyword, so the conversation is already open. Send the link right away in one message.',
  waitlist: 'They commented to join a waitlist for something launching. Make joining easy and say when they will hear from the member.',
};

module.exports = {
  name: 'dm.write_flow',
  title: 'Write your DM messages',
  description: 'Writes the public comment replies, opening DM with button, link message, follow-up inside the 24 hour window, optional email ask and tags for a ManyChat funnel, checked against ManyChat limits.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      plan: { type: 'object', title: 'Funnel plan' },
      keyword: { type: 'string', title: 'Keyword', maxLength: 20 },
      link: { type: 'string', title: 'Link', maxLength: 500 },
    },
    required: ['plan'],
  },
  output: {
    type: 'object',
    properties: { goal: { type: 'string' }, keyword: { type: 'string' }, url: { type: 'string' }, items: { type: 'array' }, tags: { type: 'array' }, problems: { type: 'array' } },
    required: ['goal', 'keyword', 'items', 'tags'],
  },
  async run(input, ctx) {
    const plan = input.plan || {};
    const goal = goalOf(plan.goal);
    const keyword = clean(input.keyword) || clean(plan.keywords && plan.keywords[0] && plan.keywords[0].keyword) || 'SEND';
    const emailCapture = !!plan.emailCapture;
    const rawLink = input.link || (plan.link && (plan.link.final || plan.link.url)) || '';
    const url = trackedLink(rawLink, keyword);
    const facts = { ...(plan.facts || {}), seed: `${(plan.facts || {}).business}|${(plan.facts || {}).thing}|${keyword}` };
    const b = brain.brainOf(ctx, {});
    ctx.log(`Writing the ${GOALS[goal].label.toLowerCase()} messages for ${keyword}`);

    const fallback = () => flowFallback(goal, facts, { keyword, emailCapture });
    const prompt = [
      `Write the messages for an Instagram DM funnel in ManyChat for this business:`,
      brain.describe(b),
      '',
      `Goal: ${GOALS[goal].label}. ${BRIEF[goal]}`,
      `What people get: ${facts.thing}${facts.inside && facts.inside.length ? ` (inside: ${facts.inside.join(', ')})` : ''}.`,
      facts.productName ? `Product: ${facts.productName}${facts.price ? `, ${facts.price}` : ''}. ${facts.productDetail || ''}` : '',
      facts.launch ? `Launching: ${facts.launch}${facts.dateText ? `, on ${facts.dateText}` : ''}.` : '',
      `Keyword: ${keyword}. People ${goal === 'story' ? 'reply to a story' : 'comment on a post'} with it.`,
      emailCapture ? 'Include an email ask that says what they will get by email and that they can unsubscribe anytime.' : '',
      '',
      'Rules:',
      '- The member sends these as themselves: first person, warm, short. One ask per message.',
      `- Button labels: ${LIMITS.button} characters or fewer. Messages with buttons: under 300 characters (ManyChat allows ${LIMITS.withButtons}).`,
      '- No links or URLs in message text: ManyChat puts the link on the button.',
      '- Public replies: under 80 characters each, all different, no links, no keyword.',
      `- The follow-up goes out about ${FOLLOW_UP_HOURS} hours later, only to people who did not open the link. A gentle nudge, never guilt.`,
      '- Never promise results (sales, followers, views). Never invent discounts, deadlines or limited spots. No merge fields like {{first_name}}.',
    ]
      .filter((l) => l !== '')
      .join('\n');

    const { data: copy, ai: usedAi } = await ai.aiJson(ctx, { task: 'write', prompt, schema: schemaFor(goal, emailCapture), fallback, accept: fits, maxTokens: 1500 });
    // Belt and braces: button names always fit, even from a template.
    for (const m of [copy.opening, copy.linkMessage, copy.followUp].filter(Boolean)) if (m.button) m.button = fitButton(m.button);
    if (copy.qualifier) copy.qualifier.options = (copy.qualifier.options || []).map((o) => fitButton(o)).slice(0, 3);

    const items = toItems(goal, copy);
    const problems = problemsOf(messagesFrom(goal, items, { url, keyword }));
    return { goal, keyword, url, items, tags: tagsFor(goal, keyword, { emailCapture }), problems, ai: usedAi };
  },
  view(out) {
    const show = (out.items || []).filter((i) => !/^reply[2-5]$/.test(i.key)).slice(0, 12);
    return views.blocks(
      views.metric('Messages written', out.items.length, out.problems.length ? `${out.problems.length} to fix before you publish` : `Every line fits ManyChat's limits`),
      ...show.map((i) => views.copy(i.label, i.text)),
      views.text(`Tags: ${out.tags.map((t) => t.tag).join(', ')}`)
    );
  },
};
