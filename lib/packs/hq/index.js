// HQ's own tools for Today's queue ("Do my day"): write the messages for a lead that has none,
// draft the answer when someone replies, and prep a booked call. Each runs as a one-step hidden
// workflow (not on Start), so credits, costs and sample marking work like every other run. They read
// the lead from the member's Pipeline by id and write what they drafted back onto it.
//
// Monday's card (hq.week): by 9am local every Monday an active Builder finds this week's sends
// written and waiting in their Inbox to check. Approving pins them to the top of Do my day.
//
// Outreach rules (Funnels F9 and F10, Legal): one-to-one, in the member's own name, one fact we found,
// a free sample or a next step, no claims about past clients or results, no money talk in a first
// message, and an email ends with who it's from, a mailing address and a way to say no (Legal L55;
// todayLib.withFooter). The member sends every message themselves.

const { plain } = require('../../harness/text');
const pipeline = require('../../harness/pipeline');
const todayLib = require('../../harness/today');

const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const str = (extra = {}) => ({ type: 'string', ...extra });
const LEAD_INPUT = { lead: str({ title: 'Lead', description: 'The lead id from your Pipeline.', maxLength: 40 }) };

// Who an email is from. The footer keeps the address placeholder on the lead, so a member who saves
// or changes their address later gets it in every email they haven't sent yet.
function whoFor(ctx) {
  const b = (ctx.brain && ctx.brain.business) || {};
  return { first: (ctx.member && ctx.member.firstName) || '[your name]', business: b.name || '', address: b.address || '' };
}
const unaddressed = (who) => ({ ...who, address: '' });

const RULES = [
  'You write outreach that a real person sends by hand, one business at a time.',
  'Write as the member, in first person, under their first name. Short sentences. Friendly and plain, never salesy.',
  'Cite exactly one specific fact about the business from the facts given. Never invent facts, numbers, clients, results or reviews.',
  'Offer one free, specific thing (a sample, a mockup, a short idea) or one easy next step. No price, no income or results claims, no pressure, no urgency.',
  'No em dashes, no exclamation marks in a row, no emojis, no hashtags, no links unless one is given.',
].join('\n');

function leadFacts(l) {
  const L = l.links || {};
  return [
    `Business: ${l.name || l.company || l.key}`,
    l.company && l.name ? `Company: ${l.company}` : '',
    l.facts && l.facts.length ? `Facts we found:\n${l.facts.map((f) => `- ${f}`).join('\n')}` : 'Facts we found: none yet.',
    L.website ? `Website: ${L.website}` : '',
    L.instagram ? `Instagram: ${L.instagram}` : '',
    l.note ? `The member's note: ${l.note}` : '',
    l.reply ? `What they said last: ${l.reply}` : '',
    `Stage: ${l.stage}${l.touches ? `, ${l.touches} message${l.touches === 1 ? '' : 's'} sent so far` : ''}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function memberFacts(ctx) {
  const b = (ctx.brain && ctx.brain.business) || {};
  const links = (ctx.brain && ctx.brain.links) || {};
  return [
    `Member's first name: ${ctx.member.firstName || 'the member'}`,
    b.what ? `What they sell: ${b.what}` : '',
    b.offer ? `Their offer: ${b.offer}` : '',
    b.price ? `Their price: ${b.price}` : '',
    b.audience ? `Who it's for: ${b.audience}` : '',
    b.city ? `Where they are: ${[b.city, b.region].filter(Boolean).join(', ')}` : '',
    links.booking ? `Their booking link: ${links.booking}` : '',
    ctx.brain && ctx.brain.voice && ctx.brain.voice.tone ? `Their tone: ${ctx.brain.voice.tone}` : '',
    ctx.brain && ctx.brain.voice && ctx.brain.voice.avoid ? `Never say: ${ctx.brain.voice.avoid}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function leadOf(ctx, id) {
  const l = await ctx.leads.get(id);
  if (!l) throw new Error("That lead isn't in your Pipeline anymore.");
  return l;
}

const lowerFirst = (s) => s.replace(/^(\w)(?![A-Z])/, (c) => c.toLowerCase());
const yours = (s) => String(s || '').replace(/\btheir\b/g, 'your').replace(/\bthey\b/g, 'you').replace(/\bThey\b/g, 'You').replace(/\bTheir\b/g, 'Your');

// No AI key: a plain, honest template from the facts, marked sample.
function templateMessages(l, ctx) {
  const me = ctx.member.firstName || '[your name]';
  const biz = l.name || l.company || 'there';
  const what = (ctx.brain.business || {}).what;
  const fact = (l.facts || [])[0];
  const noticed = fact ? `I noticed ${lowerFirst(yours(fact)).replace(/\.$/, '')}.` : 'I had an idea for you.';
  const intro = what ? `I'm ${me}, and I do ${lowerFirst(what).replace(/\.$/, '')}.` : `I'm ${me}.`;
  return {
    dm: `Hi ${biz} team. ${intro} ${noticed} I'd like to make you a free sample to show what I mean. No cost, no catch. Want me to send it over?`,
    subject: `An idea for ${biz}`,
    email: `Hi ${biz} team,\n\n${noticed} ${intro}\n\nI'd like to make you a free sample to show what I mean. If you like it, we can talk. If not, it's yours to keep.\n\nWant me to send it?\n\n${me}`,
    walkin: `Hi, I'm ${me}. ${noticed} Could I make you a free sample this week and drop it off?`,
    follow1: `Hi ${biz} team, it's ${me} again. Just checking you saw my note. Happy to make that free sample whenever suits you.`,
    follow2: `Last note from me, ${biz} team. If the timing's wrong, no worries at all. The offer of a free sample stands if you ever want it.`,
  };
}

const MESSAGES = obj({
  dm: str({ description: 'Instagram or Facebook DM, under 60 words, ends with a yes or no question.' }),
  subject: str({ description: 'Email subject, under 8 words, no clickbait.' }),
  email: str({ description: 'Email body, under 120 words, signed with the first name. The mailing address and opt-out lines are added after it.' }),
  walkin: str({ description: 'What to say in person or on the phone, two or three sentences.' }),
  follow1: str({ description: 'First follow-up, 3 days later, under 40 words, adds one new small detail.' }),
  follow2: str({ description: 'Last follow-up, 4 days after that, under 35 words, gracious, leaves the door open.' }),
});

const ANSWER = obj({
  answer: str({ description: 'The reply to send, under 90 words.' }),
  next: str({ description: 'One short line for the member: what to do after sending it.' }),
  call: { type: 'boolean', description: 'True when the answer suggests a short call.' },
});

const PREP = obj({
  brief: str({ description: 'Who they are and what they likely need, 3 to 5 sentences, only from the facts given.' }),
  questions: { type: 'array', items: str(), description: 'Exactly 3 questions to ask, about their goals and what has not worked.' },
  options: {
    type: 'array',
    description: '3 options to offer, the biggest first. Use the member\'s own price if given; otherwise leave price empty.',
    items: obj({ name: str(), price: str(), includes: str() }),
  },
  objections: { type: 'array', description: '3 likely objections with a calm, honest answer each.', items: obj({ they: str(), you: str() }) },
  close: str({ description: 'How to ask for the yes at the end, one or two sentences.' }),
});

const tools = [
  {
    name: 'hq.write_message',
    title: 'Write the messages',
    description: 'Writes the first message (DM, email, walk-in) and two follow-ups for one lead, from the facts on it.',
    kind: 'ai',
    risk: 'draft',
    credits: 6,
    tasks: ['write'],
    timeoutSec: 120,
    input: obj(LEAD_INPUT),
    output: obj({ name: str(), dm: str(), subject: str(), email: str(), walkin: str(), follow1: str(), follow2: str(), sample: { type: 'boolean' } }, ['name', 'dm', 'subject', 'email', 'walkin', 'follow1', 'follow2']),
    async run({ lead }, ctx) {
      const l = await leadOf(ctx, lead);
      let msg = null;
      let sample = false;
      if (!ctx.sample) {
        const r = await ctx.ai({ task: 'write', system: RULES, prompt: `${memberFacts(ctx)}\n\n${leadFacts(l)}\n\nWrite the first message in three forms (DM, email with subject, in person) and two follow-ups. Sign the email with the first name only: the mailing address and a "no thanks" opt-out line are added after it.`, schema: MESSAGES, maxTokens: 1400 });
        if (!r.sample) msg = r.data;
        sample = !!r.sample;
      }
      if (!msg) {
        msg = templateMessages(l, ctx);
        sample = true;
      }
      for (const k of Object.keys(msg)) msg[k] = plain(msg[k]);
      const who = whoFor(ctx);
      msg.email = todayLib.withFooter(msg.email, unaddressed(who));
      await ctx.leads.update(lead, { msg });
      return { name: l.name || l.key, ...msg, email: todayLib.withFooter(msg.email, who), ...(sample ? { sample: true } : {}) };
    },
    view: (o) => [
      { type: 'copy', label: 'DM', text: o.dm },
      { type: 'copy', label: `Email: ${o.subject}`, text: o.email },
      { type: 'copy', label: 'In person or on the phone', text: o.walkin },
      { type: 'copy', label: 'Follow-up after 3 days', text: o.follow1 },
      { type: 'copy', label: 'Last follow-up', text: o.follow2 },
    ],
  },
  {
    name: 'hq.answer_reply',
    title: 'Draft your answer',
    description: 'Drafts the best answer to what a lead said and the next step, usually a short call.',
    kind: 'ai',
    risk: 'draft',
    credits: 6,
    tasks: ['write'],
    timeoutSec: 120,
    input: obj({ ...LEAD_INPUT, reply: str({ title: 'What they said', format: 'textarea', maxLength: 3000 }) }, ['lead']),
    output: obj({ name: str(), answer: str(), next: str(), call: { type: 'boolean' }, sample: { type: 'boolean' } }, ['name', 'answer', 'next', 'call']),
    async run({ lead, reply }, ctx) {
      const l = await leadOf(ctx, lead);
      const said = String(reply || l.reply || '').trim();
      if (said) await ctx.leads.update(lead, { reply: said });
      const booking = ((ctx.brain && ctx.brain.links) || {}).booking;
      let out = null;
      if (!ctx.sample && said) {
        const r = await ctx.ai({
          task: 'write',
          system: `${RULES}\nNow they replied. Answer what they actually asked, in their words' spirit. If they asked the price, give the member's starting price plainly if it is given and suggest a 10-minute call to pick the right option; never invent a price. If they said no, thank them and leave the door open. Suggest a short call when it helps${booking ? ` and include this booking link: ${booking}` : ''}.`,
          prompt: `${memberFacts(ctx)}\n\n${leadFacts({ ...l, reply: said })}`,
          schema: ANSWER,
          maxTokens: 800,
        });
        if (!r.sample) out = r.data;
      }
      if (!out) {
        const me = ctx.member.firstName || '[your name]';
        out = {
          answer: `Thanks for getting back to me. Happy to answer that. The easiest way is a quick 10-minute call so I can show you the options and you can pick what fits.${booking ? ` Grab any time here: ${booking}` : ' What time works for you this week?'}\n\n${me}`,
          next: 'Send it, then mark it sent. If they book, move them to Call booked.',
          call: true,
          sample: true,
        };
      }
      out.answer = plain(out.answer);
      out.next = plain(out.next);
      await ctx.leads.update(lead, { msg: { answer: out.answer } });
      return { name: l.name || l.key, ...out };
    },
    view: (o) => [{ type: 'copy', label: `Your answer to ${o.name}`, text: o.answer }, { type: 'text', text: `Next: ${o.next}` }],
  },
  {
    name: 'hq.call_prep',
    title: 'Prep the call',
    description: 'One page before a call: who they are, three questions, three options biggest first, objections and the close.',
    kind: 'ai',
    risk: 'draft',
    credits: 12,
    tasks: ['plan'],
    timeoutSec: 180,
    input: obj(LEAD_INPUT),
    output: obj({ name: str(), brief: str(), questions: { type: 'array', items: str() }, options: { type: 'array', items: { type: 'object' } }, objections: { type: 'array', items: { type: 'object' } }, close: str(), file: { type: 'object' }, sample: { type: 'boolean' } }, ['name', 'brief', 'questions', 'options', 'objections', 'close']),
    async run({ lead }, ctx) {
      const l = await leadOf(ctx, lead);
      let p = null;
      if (!ctx.sample) {
        const r = await ctx.ai({ task: 'plan', system: `${RULES}\nNow prep the member for a sales call with this business. Use only the facts given. The member asks questions first and listens, then offers options, biggest first.`, prompt: `${memberFacts(ctx)}\n\n${leadFacts(l)}`, schema: PREP, maxTokens: 2000 });
        if (!r.sample) p = r.data;
      }
      let sample = false;
      if (!p) {
        sample = true;
        const price = ((ctx.brain && ctx.brain.business) || {}).price || '';
        p = {
          brief: `${l.name || 'This business'} is on your list because ${lowerFirst(yours((l.facts || [])[0] || 'they fit who you help')).replace(/\.$/, '')}. Go in curious: find out what they want more of and what's in the way.`,
          questions: ['What would you want more of in the next 3 months?', "What have you tried so far, and what didn't work?", 'If we fixed this, what would that change for you?'],
          options: [
            { name: 'Every month, handled', price, includes: 'You handle it every month.' },
            { name: 'A one-time setup', price: '', includes: 'You set it up once and hand it over.' },
            { name: 'A first small job', price: '', includes: 'One piece of work so they can see the quality.' },
          ],
          objections: [
            { they: "It's too expensive.", you: 'Fair. Which part matters most to you? We can start smaller with just that.' },
            { they: 'We already have someone.', you: 'Makes sense. Want a free second opinion on one thing anyway?' },
            { they: 'Not right now.', you: 'No problem. When would be a better time to check back?' },
          ],
          close: 'Which of these feels right for you? I can start this week.',
        };
      }
      const md = [
        `# Call prep: ${l.name || l.key}`,
        '',
        plain(p.brief),
        '',
        '## Ask',
        ...p.questions.map((q, i) => `${i + 1}. ${plain(q)}`),
        '',
        '## Options, biggest first',
        ...p.options.map((o) => `- ${plain(o.name)}${o.price ? ` (${plain(o.price)})` : ''}: ${plain(o.includes)}`),
        '',
        '## If they say',
        ...p.objections.map((o) => `- "${plain(o.they)}" ${plain(o.you)}`),
        '',
        '## The close',
        plain(p.close),
        '',
      ].join('\n');
      const file = await ctx.save(`Call prep - ${l.name || 'lead'}.md`, md, { type: 'text/markdown' });
      return { name: l.name || l.key, ...p, file, ...(sample ? { sample: true } : {}) };
    },
    view: (o) => [
      { type: 'text', text: o.brief },
      { type: 'copy', label: 'Ask these', text: o.questions.map((q, i) => `${i + 1}. ${q}`).join('\n') },
      { type: 'cards', title: 'Options, biggest first', items: o.options.map((x) => ({ title: x.name, badge: x.price || undefined, body: x.includes })) },
      { type: 'cards', title: 'If they say', items: o.objections.map((x) => ({ title: x.they, body: x.you })) },
      { type: 'copy', label: 'The close', text: o.close },
      ...(o.file ? [{ type: 'file', asset: o.file, caption: 'The whole page' }] : []),
    ],
  },
];

// ---------- Monday's card ----------

const WEEK_MAX = 10;
const DAY_MS = 864e5;
const LEAD_REF = obj({ id: str(), name: str(), kind: str() });

// The message key a Do my day item shows for a lead (todayLib.waysFor picks the text the same way).
function keyFor(l, kind, way) {
  const m = l.msg || {};
  if (kind === 'follow') return (l.touches || 0) >= 2 ? 'follow2' : 'follow1';
  if (way && way.id === 'call') return m.walkin ? 'walkin' : 'dm';
  if (way && (way.id === 'email' || way.id === 'site')) return m.email || !m.dm ? 'email' : 'dm';
  return m.dm || !m.email ? 'dm' : 'email';
}

tools.push(
  {
    name: 'hq.pick_week',
    title: "Pick this week's sends",
    description: 'Picks up to 10 leads for the week: follow-ups coming due, then the best new ones you can reach.',
    kind: 'code',
    risk: 'read',
    credits: 0,
    input: obj({ week: str({ maxLength: 10 }) }),
    output: obj({ leads: { type: 'array', items: LEAD_REF }, missing: { type: 'array', items: obj({ id: str() }) } }),
    async run(input, ctx) {
      const end = ctx.now() + 7 * DAY_MS;
      const all = pipeline.list(ctx.member.id, { limit: 2000 });
      const follows = all.filter((l) => l.stage === 'contacted' && l.nextAt && Date.parse(l.nextAt) <= end && (l.touches || 1) <= 2).sort((a, b) => String(a.nextAt).localeCompare(String(b.nextAt)));
      // Made-up businesses are never a send on a member's real week, only on a sample run.
      const fresh = all.filter((l) => l.stage === 'found' && (ctx.sample || !pipeline.madeUp(l))).sort((a, b) => (b.score || 0) - (a.score || 0));
      const picked = [];
      for (const l of follows.map((x) => [x, 'follow']).concat(fresh.map((x) => [x, 'new']))) {
        if (picked.length >= WEEK_MAX) break;
        const ways = todayLib.waysFor(l[0], l[1], whoFor(ctx));
        if (ways.length) picked.push({ l: l[0], kind: l[1], text: ways[0].text });
      }
      return {
        leads: picked.map((p) => ({ id: p.l.id, name: p.l.name || p.l.company || p.l.key, kind: p.kind })),
        missing: picked.filter((p) => !p.text).map((p) => ({ id: p.l.id })),
      };
    },
    view: (o) => [{ type: 'text', text: `${o.leads.length} picked for this week${o.missing.length ? `, ${o.missing.length} to write` : ''}.` }],
  },
  {
    name: 'hq.week_items',
    title: "Lay out the week's sends",
    description: "Puts each picked lead's message in one list to check.",
    kind: 'code',
    risk: 'read',
    credits: 0,
    input: obj({ leads: { type: 'array', items: LEAD_REF } }),
    output: obj({ items: { type: 'array', items: obj({ id: str(), name: str(), kind: str(), key: str(), text: str() }) } }),
    async run({ leads }, ctx) {
      const items = [];
      for (const x of leads) {
        const l = await ctx.leads.get(x.id);
        if (!l) continue;
        const ways = todayLib.waysFor(l, x.kind, whoFor(ctx));
        const text = ways.length ? ways[0].text : '';
        if (!text) continue;
        items.push({ id: l.id, name: `${l.name || l.company || l.key}${x.kind === 'follow' ? ', follow-up' : ''}`, kind: x.kind, key: keyFor(l, x.kind, ways[0]), text });
      }
      return { items };
    },
    view: (o) => [{ type: 'cards', title: "This week's sends", items: o.items.map((i) => ({ title: i.name, body: i.text })) }],
  },
  {
    name: 'hq.save_week',
    title: 'Save your edits',
    description: 'Keeps your edits on each lead and puts them first in Do my day this week.',
    kind: 'code',
    risk: 'draft',
    credits: 0,
    input: obj({ id: str(), key: str({ enum: pipeline.MSG_KEYS }), text: str({ maxLength: 4000 }), week: str({ maxLength: 10 }) }),
    output: obj({ id: str(), saved: { type: 'boolean' } }),
    async run({ id, key, text, week }, ctx) {
      // The lead keeps the address placeholder; Do my day fills in the member's current address.
      const { address } = whoFor(ctx);
      const kept = address ? plain(text).split(address).join(todayLib.ADDRESS_LINE) : plain(text);
      const l = await ctx.leads.update(id, { msg: { [key]: kept }, week });
      return { id, saved: !!l };
    },
    viewMany: (outs) => [
      { type: 'text', text: `${outs.filter((o) => o.saved).length} sends are ready and first in Do my day this week. You send each one yourself.` },
      { type: 'link', label: 'Open Do my day', href: '/app/hq#day' },
    ],
  },
);

const one = (id, title, promise, tool, job, savesMinutes, inputs) => ({
  id,
  title,
  promise,
  minutes: 1,
  tier: 'free',
  hidden: true,
  job,
  savesMinutes,
  inputs,
  steps: [{ id: 'go', tool, input: Object.fromEntries(Object.keys(inputs.properties).map((k) => [k, `$inputs.${k}`])) }],
  result: ['go'],
});

module.exports = {
  id: 'hq',
  title: 'HQ',
  version: '1.0.0',
  summary: "Today's queue: messages, answers to replies and call prep for your leads.",
  niches: ['any'],
  tools,
  workflows: [
    one('hq.message', 'Write the messages', 'The first message and two follow-ups for one lead.', 'hq.write_message', 'leads', 10, obj(LEAD_INPUT)),
    one('hq.reply', 'Answer a reply', 'The best answer to what they said, and the next step.', 'hq.answer_reply', 'sales', 10, obj({ ...LEAD_INPUT, reply: str({ title: 'What they said', format: 'textarea', maxLength: 3000 }) }, ['lead'])),
    one('hq.call_prep', 'Prep the call', 'One page before a call: questions, options, objections and the close.', 'hq.call_prep', 'sales', 30, obj(LEAD_INPUT)),
    {
      id: 'hq.week',
      title: "This week's sends",
      promise: "Your week's sends, written, waiting for you on Monday morning.",
      minutes: 5,
      tier: 'builder',
      hidden: true,
      job: 'leads',
      savesMinutes: 30,
      inputs: obj({ week: str({ title: 'Week of', maxLength: 10 }) }),
      steps: [
        { id: 'pick', tool: 'hq.pick_week', input: { week: '$inputs.week' } },
        { id: 'write', tool: 'hq.write_message', each: '$pick.missing', input: { lead: '$item.id' }, concurrency: 3, estimate: 4 },
        { id: 'lay', tool: 'hq.week_items', input: { leads: '$pick.leads' } },
        {
          id: 'check',
          approve: {
            title: "This week's sends are written. Check them.",
            note: "Change anything that doesn't sound like you. Approving puts them first in Do my day. Nothing is sent: you send each one yourself.",
            items: '$lay.items',
            edit: 'text',
            label: 'name',
            field: 'text',
          },
        },
        { id: 'save', tool: 'hq.save_week', each: '$check.items', input: { id: '$item.id', key: '$item.key', text: '$item.text', week: '$inputs.week' } },
      ],
      result: ['save'],
    },
  ],
};
