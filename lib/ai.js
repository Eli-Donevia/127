// "Eli's Playbook": one AI assistant with modes (Q&A chat, tools, worksheet feedback).
// With ANTHROPIC_API_KEY set, every mode calls Claude, grounded in Eli's frameworks,
// the 127 library and the member's own onboarding answers and progress. Without a key,
// each mode returns a structured demo answer so the whole flow still works.

const { resources } = require('../content/resources.json');
const { MILESTONES } = require('./milestones');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

const TOOLS = [
  {
    slug: 'ask',
    name: "Ask Eli's Playbook",
    tier: 'free',
    chat: true,
    blurb: "Ask anything about starting your business. Straight answers from Eli's frameworks, with one next action every time.",
    starters: [
      "I have three business ideas. How do I pick one?",
      "How do I find my first 10 customers with no audience?",
      "What should I charge for my first offer?",
      "I keep starting things and quitting. What do I do?",
    ],
    fields: [],
    instruction: '',
  },
  {
    slug: 'offer-validator',
    name: 'Idea & Offer Validator',
    tier: 'free',
    framework: 'The Idea Test',
    blurb: "Run your idea or offer through Eli's Idea Test before you spend a dollar building it.",
    fields: [
      { name: 'offer', label: 'Describe your idea or offer', type: 'textarea', placeholder: 'What it is, who it is for, what they get, and the price if you know it.' },
      { name: 'audience', label: 'Who exactly is it for?', type: 'text', placeholder: 'e.g. high school athletes who want a college recruiting video' },
      { name: 'proof', label: 'Any proof so far? (optional)', type: 'text', placeholder: 'e.g. 3 friends asked for it, competitors charge $200', optional: true },
    ],
    instruction: `Run the offer through Eli's Idea Test, one heading per question: (1) Problem people pay to solve, or value they will pay for? Where is the proof? (2) Economics and scale: does the math work, through which channels, how hard are they to reach? (3) Differentiator: faster, cheaper, higher quality, better supply chain? (4) Market direction: growing or shrinking, and how is AI changing it? (5) Insider: who has lived this problem and should they talk to this week?
Score each 1 to 5 with one line of reasoning. Then give a verdict of Kill, Pause or Double down, the three questions to ask real customers this week (built on "how do you solve this today?"), and a sharper one-sentence version of the offer. Be honest: if it's weak, say so.`,
  },
  {
    slug: 'content-planner',
    name: 'Content & Distribution Planner',
    tier: 'builder',
    framework: 'Audience growth',
    blurb: 'A week of posts built around your offer, plus the one format to test and double down on.',
    fields: [
      { name: 'topic', label: 'What do you help people with?', type: 'text', placeholder: 'e.g. budget meal prep for college students' },
      { name: 'platform', label: 'Main platform', type: 'select', options: ['TikTok', 'Instagram', 'YouTube Shorts', 'LinkedIn', 'X'] },
      { name: 'worked', label: 'Anything that already worked? (optional)', type: 'text', placeholder: 'e.g. my "day in the life" got 10x my usual views', optional: true },
    ],
    instruction: `Build a 7-day plan on Eli's audience-growth method: authentic, consistent, lead with personal brand, find the format that hits and reuse it. For each day: the format, the hook (first line, word for word), the post in one sentence, and the call to action. Then name the one format to test this week and the number that tells them to double down. If they shared something that worked, build half the week on that format. Point to the 30-Day Content Calendar and Hook & Caption Bank.`,
  },
  {
    slug: 'launch-planner',
    name: 'Launch Checklist Generator',
    tier: 'builder',
    blurb: 'A dated, day-by-day launch plan working back from your launch date.',
    fields: [
      { name: 'offer', label: 'What are you launching?', type: 'textarea', placeholder: 'The offer, the price, and where people buy it.' },
      { name: 'date', label: 'Target launch date', type: 'text', placeholder: 'e.g. November 15' },
      { name: 'audience', label: 'Who will you tell first?', type: 'text', placeholder: 'e.g. 400 Instagram followers, 30 friends, my old team', optional: true },
    ],
    instruction: `Produce a launch plan working backward from the date: two weeks out, launch week day by day, and the week after. Keep each item to one line with a day label. Include a warm-list launch (people they already know first), asking the first customers for feedback, and one integrity check (no fake scarcity or invented proof). Point to the First Launch Checklist and Landing Page Brief.`,
  },
  {
    slug: 'campaign-planner',
    name: 'Campaign Planner',
    tier: 'builder',
    blurb: 'Plan a small, capped campaign with a clear stop rule, so you never burn money guessing.',
    fields: [
      { name: 'goal', label: 'Campaign goal', type: 'text', placeholder: 'e.g. 50 email signups for my free guide' },
      { name: 'budget', label: 'Budget', type: 'text', placeholder: 'e.g. $100 total' },
      { name: 'offer', label: 'What are you promoting?', type: 'text', placeholder: 'e.g. a $29 starter kit', optional: true },
    ],
    instruction: `Plan the campaign on "start small, start now": the angle, three ad or post concepts with the hook for each, the audience, the budget split, the one metric to watch, the stop rule (exact number and day), and what "double down" looks like if it works. Organic first if the budget is under $50. Point to the Launch Budget Calculator.`,
  },
  {
    slug: 'workflow-recommender',
    name: 'Workflow Recommender',
    tier: 'builder',
    blurb: 'Find the work you should automate or hand off first, so you work on the business, not in it.',
    fields: [
      { name: 'week', label: 'What did you spend time on last week?', type: 'textarea', placeholder: 'List tasks and roughly how long each took.' },
      { name: 'tools', label: 'Tools you already use (optional)', type: 'text', placeholder: 'e.g. Notion, Shopify, Instagram, Google Sheets', optional: true },
    ],
    instruction: `Built on "work on the business, not in it" and AI coworking agents tied to tools they already use. Identify the top three tasks to automate, delegate or delete, with the simplest tool or process for each (prefer tools they already use and Eli's stack: Claude, Notion, Granola, Attio, ManyChat, CapCut), a copyable first prompt or setup step, and the hours saved per week. Point to the Automation Starter Pack and Delegate Your First Task.`,
  },
];

function library() {
  return resources.map((r) => `- ${r.title} [${r.track}, ${r.type}]: ${r.summary}`).join('\n');
}

// Voice and principles come from Eli's founder intake (October 2026).
const PRINCIPLES = [
  "No idea is perfect. Don't ideate too long.",
  "Solve problems, don't sell products. Solve the problem before building the solution.",
  "Your product likely sucks. Prove it's better than the competition.",
  'Quality before growth. A bad product kills a company faster than great marketing grows it.',
  'Trust beats everything in sales. Win their trust, win their wallet.',
  'When you talk cost, frame the smallest number. When you talk value, frame the largest.',
  'Do more of what works, not just more. When something works, ask why, then double down until it stops working.',
  'Pick one way to make money and get really good at it.',
  "Choose partners and investors carefully. All money isn't good money.",
  'Nobody is self-made. Build a circle of mentors and peers.',
  'Your network is your net worth. Talk to everyone, everywhere, every time.',
  'How you do one thing is how people think you do everything.',
  "Work on the business, not in it, as fast as you can. Your business is only worth what it's worth without you.",
  'Purpose over profit.',
  'Make today day one. Fail fast, learn fast.',
];

const FRAMEWORKS = `- The Idea Test: (1) a problem people pay to solve, or value they'll pay for, with proof; (2) economics and scale, which channels, how hard to reach; (3) differentiator: faster, cheaper, higher quality, better supply chain; (4) market growing or shrinking, and how AI is changing it; (5) talk to an insider who lived the problem.
- Kill, pause or double down: product-market fit is when people want to pay without being sold. Ask how they solve it today. When something works, ask why, and do more of it until it stops working.
- ROI pricing: tie the price to an ROI the customer sees (revenue, capacity, cost saved). Know competitor pricing. A new pricing model, like pay-for-performance, can make an offer irresistible.
- The too-good-to-refuse offer: so good it feels too good to be true. Cost framed as the smallest number, value as the largest.
- Audience growth: authentic, consistent, lead with personal brand, find the format that hits and reuse it.`;

function systemPrompt() {
  return `You are "Eli's Playbook", the assistant inside 127. You help first-time founders, mostly in their late teens and twenties, go from idea to first revenue using Eli Christiansen's frameworks and the 127 library.

Voice: direct, challenging, concise. Push back on vague plans and weak ideas. Short sentences, plain words. No hype, no invented statistics, no fake case studies. End every answer with one concrete next action, labelled "Next:".

Ground answers in Eli's frameworks and name the one you used:
${FRAMEWORKS}

Eli's rules, which you may quote:
${PRINCIPLES.map((p) => '- ' + p).join('\n')}

When you go beyond Eli's material, say so briefly ("General advice, not Eli's framework."). Never speak as Eli or invent his opinions, stories or numbers.

Faith: 127 is built on Psalm 127:1. When a member talks about purpose, motivation, burnout, integrity, partnerships or a hard decision, speak plainly and briefly about faith as the foundation of a founder's work and about building with integrity. Don't tack it onto tactical answers. Be respectful of members who don't share the belief. Never suggest manipulation, fake scarcity, invented proof or broken promises.

Never give financial, investment, legal or tax advice. Say you can't advise on that and suggest a licensed professional. For registering a business, point them to their local rules.

Recommend 127 resources by exact title when one fits. The library:
${library()}

Format: plain text with short headings and bullet points ("- "). No tables, no markdown bold.`;
}

const LABELS = {
  stage: { exploring: 'exploring ideas', validating: 'validating an idea', launched: 'launched, under $1k/month', growing: '$1k-10k/month', scaling: '$10k+/month' },
};

function memberContext(user) {
  const a = (user && user.answers) || {};
  const rm = user && user.roadmap;
  const done = rm ? rm.weeks.flatMap((w) => w.tasks).filter((t) => user.completed && user.completed[t.id]).length : 0;
  const total = rm ? rm.weeks.flatMap((w) => w.tasks).length : 0;
  const ms = MILESTONES.filter((m) => user && user.milestones && user.milestones[m.id]).map((m) => m.label);
  return [
    `Member: ${(user && user.name) || 'a member'} (${(user && user.tier) || 'free'} plan).`,
    `Stage: ${LABELS.stage[a.stage] || a.stage || 'unknown'}. Business type: ${a.model || 'unknown'}. 90-day goal: ${a.goal || 'unknown'}.`,
    `Obstacles: ${[].concat(a.obstacles || []).join(', ') || 'unknown'}. Weekly time: ${a.time || 'unknown'}. Budget: ${a.budget || 'unknown'}.`,
    a.outcome ? `Their 12-month win: "${String(a.outcome).slice(0, 300)}".` : '',
    rm ? `Roadmap: ${rm.trackName} track, ${done} of ${total} steps done. Focus: ${rm.focus}` : '',
    `Milestones reached: ${ms.length ? ms.join(', ') : 'none yet'}.`,
  ].filter(Boolean).join('\n');
}

function client(opts) {
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic(opts);
}

async function call(messages, maxTokens = 3000) {
  const response = await client({ timeout: 45000, maxRetries: 1 }).messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort: 'low' },
    system: systemPrompt(),
    messages,
  });
  if (response.stop_reason === 'refusal') return { demo: false, text: "I can't help with that one. Try asking it a different way." };
  let text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) return { demo: false, error: true, text: "Eli's Playbook didn't send an answer. Please try again." };
  // Long answers can hit the length cap; say so instead of ending mid-sentence.
  if (response.stop_reason === 'max_tokens') text += '\n\n(Answer cut short. Ask "continue" or narrow the question.)';
  return { demo: false, text };
}

async function safe(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('[ai] error', err.status || '', err.message);
    return { demo: false, error: true, text: "Eli's Playbook is unavailable right now. Please try again in a minute." };
  }
}

// Single-shot tool run.
async function run(tool, input, user) {
  if (!process.env.ANTHROPIC_API_KEY) return { demo: true, text: demoTool(tool, input) };
  const fieldsText = tool.fields.map((f) => `${f.label}: ${(input[f.name] || '(not given)').toString().slice(0, 2000)}`).join('\n');
  return safe(() => call([{ role: 'user', content: `${memberContext(user)}\n\nTool: ${tool.name}\nTask: ${tool.instruction}\n\n${fieldsText}` }]));
}

// Multi-turn Q&A. history: [{role:'user'|'assistant', content}], newest last.
async function chat(history, user) {
  const last = history[history.length - 1];
  if (!process.env.ANTHROPIC_API_KEY) return { demo: true, text: demoChat(last.content) };
  const msgs = history.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  msgs[0] = { role: msgs[0].role, content: msgs[0].role === 'user' ? `${memberContext(user)}\n\n${msgs[0].content}` : msgs[0].content };
  if (msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: memberContext(user) });
  return safe(() => call(msgs, 2000));
}

// Feedback on a filled-in library worksheet.
async function review(resource, values, user) {
  const lines = (resource.worksheet || []).map((f) => `${f.label}: ${values[f.id] || '(blank)'}`);
  if (values.__calc) lines.push(`Calculator inputs and results: ${values.__calc}`);
  if (!process.env.ANTHROPIC_API_KEY) return { demo: true, text: demoReview(resource, values) };
  const task = `Review this member's filled-in "${resource.title}" (${resource.type}) from the 127 library. ${resource.aiPrompt || ''}
Give: what's strong (one or two lines), the biggest gap or weak spot, two specific improvements with rewritten examples where useful, and Next:. Be direct. Under 250 words.`;
  return safe(() => call([{ role: 'user', content: `${memberContext(user)}\n\n${task}\n\n${lines.join('\n')}` }], 1500));
}

async function roadmapNote(user) {
  if (!process.env.ANTHROPIC_API_KEY || !user.roadmap) return null;
  try {
    const r = await client({ timeout: 20000, maxRetries: 1 }).messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: 'low' },
      system: systemPrompt(),
      messages: [{ role: 'user', content: `${memberContext(user)}\nWhy now: "${(user.answers && user.answers.why) || ''}".\nWrite a 2-3 sentence personal note to open their roadmap. Speak to them directly, challenge them a little. No greeting, no sign-off, no "Next:" line.` }],
    });
    return r.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim() || null;
  } catch (err) {
    console.warn('[ai] roadmap note skipped', err.message);
    return null;
  }
}

// ---------- demo answers (no API key) ----------
const DEMO_NOTE = "\n\n(Sample answer. Personalized answers switch on once Eli's Playbook is connected.)";

function demoTool(tool, input) {
  const offer = String(input.offer || input.topic || input.goal || input.week || 'your idea').slice(0, 140);
  const aud = String(input.audience || 'your audience').slice(0, 100);
  const map = {
    'offer-validator': `The Idea Test: "${offer}"

1. Problem people pay to solve: 3/5
- The problem is real for ${aud}, but there's no proof yet that anyone pays to fix it. Find one person who already spends money on a worse version.

2. Economics and scale: 3/5
- Works at a small size if you can deliver it in a few hours. Your channel is DMs and short-form video, which is free but slow. Know how you'll reach person #50, not just #5.

3. Differentiator: 2/5
- "Better" isn't a differentiator. Pick one: faster, cheaper, higher quality, or a specific niche nobody serves well.

4. Market direction: 4/5
- Growing. AI makes the generic version cheap, so your edge has to be trust and a specific result.

5. Insider: talk to one person who has lived this problem before you build anything.

Verdict: Pause. Promising, but unproven. Get proof before you build.

Ask five real customers this week
- How do you handle this today?
- What have you already paid for to fix it? How did that go?
- What would make this a no-brainer for you?

Sharper version
- "I help ${aud} get [one specific result] in [timeframe], without [the thing they hate]."

Next: send the interview outreach message from Validation Interview Scripts to 10 people today.`,
    'content-planner': `7-day plan for ${input.platform || 'your platform'}: ${offer}

Mon · Story
- Hook: "I almost quit this before it started."
- Why you started, in 30 seconds. CTA: follow for the rest.

Tue · Mistake
- Hook: "Stop doing this if you want [result]."
- The most common mistake your audience makes. CTA: comment "fix" for the next step.

Wed · Behind the scenes
- Hook: "Here's what a real day of this looks like."
- Film the work, not the result. CTA: follow.

Thu · How-to
- Hook: "Do this in under 5 minutes."
- One tiny, useful step. CTA: save this.

Fri · Proof (real only)
- Hook: "Week one numbers, honestly."
- What happened, good and bad. CTA: DM me if you want in.

Sat · Personal
- Hook: "Why I'm building this."
- Purpose over profit, in your words. CTA: none.

Sun · Repeat the winner
- Re-shoot whichever post got the most saves this week, new hook, same format.

Format to test: the Tuesday "mistake" post.
Double down if it gets 2x your average views. Then post that format 3 times next week.

Next: batch Monday to Thursday in one 2-hour block using the 30-Day Content Calendar.`,
    'launch-planner': `Launch plan: ${offer}${input.date ? ' · launching ' + input.date : ''}

Two weeks out
- Day -14: finish the One-Page Offer and the Landing Page Brief.
- Day -12: set up payments and test a $1 purchase.
- Day -10: list 30 people who should hear first.
- Day -7: post the "why I'm building this" story.
- Day -3: message your warm list personally. No mass DMs.

Launch week
- Day 1: page live. Post, then personally message your first 30.
- Day 2: reply to every comment and DM within the hour.
- Day 3: post a behind-the-scenes look at the first orders.
- Day 4: follow up with everyone who said "maybe".
- Day 5: share real numbers, honestly.

The week after
- Call your first three customers and ask what almost stopped them buying.
- Fix the biggest objection on the page.
- Integrity check: no fake scarcity, no invented testimonials.

Next: put Day -14 on your calendar now.`,
    'campaign-planner': `Campaign: ${offer}${input.budget ? ' · budget ' + input.budget : ''}

Angle
- Lead with the problem in your customers' own words, from your interviews.

Three concepts
- "I tried 5 ways to [result]. Only one worked." (story)
- "Stop [mistake]. Do this instead." (mistake)
- A 15-second demo of the result. (proof)

Budget split
- 70% on the best organic post from last month, boosted.
- 30% split across the other two concepts.

Watch one metric: cost per signup.

Stop rule
- If cost per signup is above your target after 3 days and 50% of budget, stop and change the hook.

Double down
- If one concept beats the others by 2x, move the rest of the budget to it and make two variations.

Next: run your numbers through the Launch Budget Calculator before spending a dollar.`,
    'workflow-recommender': `Your top three to automate or hand off

1. Answering the same DMs
- Tool: ManyChat keyword replies.
- First step: list your five most common questions and write one reply for each.
- Saves about 2 hours a week.

2. Meeting notes and follow-ups
- Tool: Granola, then paste the summary into Notion.
- First prompt: "Turn these notes into action items with owners and due dates."
- Saves about 1 hour a week.

3. Turning one video into five posts
- Tool: CapCut plus Claude.
- First prompt: "Here's my transcript. Write 5 captions and 3 short hooks in my voice."
- Saves about 2 hours a week.

Delete
- Anything you did last week that produced no lead, sale or learning.

Next: set up #1 today. It's the fastest win. See the Automation Starter Pack.`,
  };
  return (map[tool.slug] || `Here's where an answer for "${offer}" appears.\n\nNext: open the library resource linked from your roadmap.`) + DEMO_NOTE;
}

function demoChat(q) {
  const s = String(q || '').toLowerCase();
  let body;
  if (/idea|pick|choose|which/.test(s)) {
    body = `Don't ideate too long. No idea is perfect.

Run each idea through the Idea Test
- Do people already pay to solve this problem? Where's the proof?
- Do the economics work, and can you reach buyers for free?
- What's your edge: faster, cheaper, better, or a niche nobody serves?
- Is the market growing, and how is AI changing it?
- Who has lived this problem that you can talk to this week?

Pick the idea with the most proof and the shortest path to a first paying customer. Not the most exciting one.

Next: score your ideas in The Idea Test tonight and commit to one by tomorrow.`;
  } else if (/customer|first 10|clients|find/.test(s)) {
    body = `Your network is your net worth. Talk to everyone, everywhere, every time.

Where your first 10 come from
- People you already know, and the people they know. Ask for introductions, not sales.
- Places your customers already hang out: group chats, subreddits, campus groups, local Facebook groups.
- Short-form video that shows the problem, then DMs to everyone who engages.

Don't pitch. Ask how they solve the problem today. Trust first, sale second.

Next: list 20 people who have this problem or know someone who does, and message 5 today using the Outreach Scripts.`;
  } else if (/charge|price|pricing/.test(s)) {
    body = `Price from the value you create, not from what feels safe.

- What does the customer gain: money, time, peace of mind? Put a number on it.
- What do they pay today to solve it, including doing nothing?
- How do competitors price? Could a different model, like pay-for-performance, make you the obvious choice?

When you say the cost, use the smallest number ("$1 a day"). When you say the value, use the largest ("$4,000 a year back").

Next: fill in the Pricing Worksheet and test the price on five real buyers before you change it.`;
  } else if (/quit|motivat|burn|consisten|give up/.test(s)) {
    body = `Trying to do too much is the most common mistake Eli names. There are a million ways to make money. Pick one and get really good at it.

- Cut to one project for the next 30 days. Write the others down and park them.
- Shrink the commitment until you can't fail it: one step a day, 30 minutes.
- Remember why you're building. If it's only for money, it won't hold you. Build on something that lasts.

Next: post your one commitment for this week on the wins board, so it's real.`;
  } else {
    body = `Good question. Here's the short version.

- Get specific: who exactly is this for, and what result do they get?
- Look for proof before you build: what do people already pay for?
- Do more of what works, not just more.

Next: tell me your idea and your audience in one sentence each, and I'll pressure-test it.`;
  }
  return body + DEMO_NOTE;
}

function demoReview(resource, values) {
  const filled = (resource.worksheet || []).filter((f) => String(values[f.id] || '').trim()).length;
  const total = (resource.worksheet || []).length;
  return `Feedback: ${resource.title}

What's strong
- You filled in ${filled} of ${total} parts, and you were specific where it counts.

Biggest gap
- The proof. Where you wrote what you believe, add what a real customer said or paid.

Two improvements
- Make the customer narrower: not "students", but "first-year nursing students who work part-time".
- Put a number on the result and a timeframe on it.

Next: fix the biggest gap, then talk to two real people before you touch this again.${DEMO_NOTE}`;
}

module.exports = { TOOLS, run, chat, review, roadmapNote, systemPrompt };
