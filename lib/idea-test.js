// The free Idea Test: scores one business idea on Eli's six validation questions
// (from his founder intake) and returns a structured report.
// With ANTHROPIC_API_KEY set it calls Claude; without it, it returns a clearly
// labeled demo report so the page still works end to end.

const MODEL = process.env.IDEA_TEST_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

const CRITERIA = [
  { key: 'pain', name: 'Real pain', ask: 'Does it solve a problem people already spend money or real effort on? Is there market proof (existing spend, competitors, workarounds)?' },
  { key: 'value', name: 'Clear value', ask: 'Does it create value people pay for: saving time or money, making money, peace of mind, education, status?' },
  { key: 'economics', name: 'Economics', ask: 'Can the numbers work? Price vs. cost to deliver vs. cost to win a customer. Is it scalable, and is profit plausible at this stage?' },
  { key: 'reach', name: 'Reachable buyers', ask: 'Through which channels can this founder reach buyers, and how hard is it to get access to those channels? Is the buyer specific enough to find?' },
  { key: 'edge', name: 'Edge', ask: 'What is the differentiator: faster, cheaper, higher quality, better model, unique access or story? Would a buyer notice it?' },
  { key: 'future', name: 'Market direction', ask: 'Is this market growing or shrinking, and is AI making this problem bigger, smaller or easier for anyone to solve?' },
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict_label', 'verdict_line', 'criteria', 'biggest_risk', 'sharper_pitch', 'seven_day_test', 'questions_to_ask', 'insider'],
  properties: {
    verdict_label: { type: 'string', enum: ['Build it', 'Promising', 'Rework it'] },
    verdict_line: { type: 'string', description: 'One blunt sentence summing up the idea, max 25 words.' },
    criteria: {
      type: 'array',
      description: 'Exactly six items, one per criterion, in the given order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'score', 'why'],
        properties: {
          key: { type: 'string', enum: CRITERIA.map((c) => c.key) },
          score: { type: 'integer', description: '0 to 10' },
          why: { type: 'string', description: 'One or two short sentences, specific to this idea, max 40 words.' },
        },
      },
    },
    biggest_risk: { type: 'string', description: 'The single thing most likely to kill it, one or two sentences.' },
    sharper_pitch: { type: 'string', description: 'A sharper one-sentence version: who it is for, the result, and why this beats the alternative.' },
    seven_day_test: { type: 'array', description: 'Exactly seven items, one cheap action per day that tests demand before building. Each max 25 words.', items: { type: 'string' } },
    questions_to_ask: { type: 'array', description: 'Exactly three questions to ask real potential customers. About their past behavior, never a pitch.', items: { type: 'string' } },
    insider: { type: 'string', description: 'Who specifically to talk to who lives inside this problem or industry, and what to ask them. One or two sentences.' },
  },
};

const SYSTEM = `You are "Eli's Playbook", the AI behind 127's free Idea Test. 127 helps first-time founders, mostly late teens and early twenties, start and grow real businesses. It was built by Eli Christiansen, a 2x founder.
Voice: direct, challenging, concise. Like an older brother who has built companies and believes in the person, not a guru. No hype, no flattery, no invented statistics, no fake examples of other companies' numbers. If you are unsure about a market fact, say what to check instead of stating a number.
Eli's test for any idea, in order: does it solve a problem people pay to solve (market proof), or add value people pay for (saves time, peace of mind, education)? What are the economics, is it scalable, through what channels, and what is the barrier to entry to those channels? What is the differentiator: faster, cheaper, higher quality, better supply chain? What is the future of the market: growing or shrinking, and how is AI changing it? Then seek industry expertise: if you did not live the problem, talk to someone on the inside.
Eli's principles: no idea is perfect, don't ideate too long. Solve problems, don't sell products. Focus on the problem before building the solution. Trust beats everything in sales. Your product probably isn't better yet, so prove it. Pick one way to make money and get really good at it. Do more of what works.
Take local and service businesses (tutoring, lawn care, cleaning, editing videos for local gyms) as seriously as online, product or tech ideas, and don't push them online or toward an app. Measure progress in first conversation, first customer, first dollar: never set income targets, promise earnings or talk about getting rich. Write for anyone: no gendered assumptions about the founder or their customers.
Score honestly. Most first ideas land between 35 and 70. Reserve 9-10 for criteria with clear evidence in what the founder wrote. Penalize vague buyers. A low score is useful, not cruel: always show the path to a better version.
Never give financial, investment, legal or tax advice. Never encourage anything deceptive or manipulative. If the idea is illegal or harmful, score it 0 across the board and say plainly why in verdict_line.
Return only the JSON object described by the schema.`;

function userPrompt(input) {
  return `Score this idea on the six criteria (0-10 each):
${CRITERIA.map((c, i) => `${i + 1}. ${c.key} (${c.name}): ${c.ask}`).join('\n')}

Verdict: "Build it" if the total would be 75%+, "Promising" for 50-74%, "Rework it" below 50%.

The founder's idea: ${input.idea}
Who it's for: ${input.customer || '(not given)'}
How it makes money: ${input.money || '(not given)'}
Their edge: ${input.edge || '(not given)'}`;
}

function finish(raw) {
  const byKey = Object.fromEntries((raw.criteria || []).map((c) => [c.key, c]));
  const criteria = CRITERIA.map((c) => {
    const got = byKey[c.key] || { score: 0, why: '' };
    return { key: c.key, name: c.name, score: Math.max(0, Math.min(10, Math.round(Number(got.score) || 0))), why: String(got.why || '') };
  });
  const score = Math.round((criteria.reduce((s, c) => s + c.score, 0) / (CRITERIA.length * 10)) * 100);
  const verdict_label = score >= 75 ? 'Build it' : score >= 50 ? 'Promising' : 'Rework it';
  return {
    score,
    verdict_label,
    verdict_line: String(raw.verdict_line || ''),
    criteria,
    biggest_risk: String(raw.biggest_risk || ''),
    sharper_pitch: String(raw.sharper_pitch || ''),
    seven_day_test: (raw.seven_day_test || []).slice(0, 7).map(String),
    questions_to_ask: (raw.questions_to_ask || []).slice(0, 3).map(String),
    insider: String(raw.insider || ''),
  };
}

async function run(input) {
  if (!process.env.ANTHROPIC_API_KEY) return { demo: true, report: demo(input) };

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ timeout: 60000, maxRetries: 1 });
  const base = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userPrompt(input) }],
  };
  try {
    let response;
    try {
      // On a safety decline, the API re-runs the request on a fallback model.
      response = await client.beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      response = await client.messages.create(base);
    }
    if (response.stop_reason === 'refusal') return { error: "We couldn't score that idea. Try describing it differently." };
    if (response.stop_reason === 'max_tokens') return { error: 'That one took too long. Try a shorter description.' };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { demo: false, report: finish(JSON.parse(text)) };
  } catch (err) {
    console.error('[idea-test] error', err.status || '', err.message);
    return { error: 'The Idea Test is busy right now. Try again in a minute.' };
  }
}

// Deterministic placeholder so the flow works without an API key. Labeled as a demo on the page.
function demo(input) {
  const has = (s) => (s || '').trim().length > 8;
  const specific = has(input.customer) && input.customer.split(' ').length >= 3;
  const raw = {
    verdict_line: 'Demo result. Connect the AI key to get a real, idea-specific score.',
    criteria: [
      { key: 'pain', score: 5, why: 'No proof yet that people already pay to fix this. Find out what they use today.' },
      { key: 'value', score: 6, why: 'The value is plausible. Say it as one measurable result.' },
      { key: 'economics', score: has(input.money) ? 6 : 4, why: has(input.money) ? 'There is a pricing idea. Check the cost to win one customer.' : 'No pricing yet. Decide who pays, how much and how often.' },
      { key: 'reach', score: specific ? 6 : 4, why: specific ? 'The buyer is specific enough to find.' : 'The buyer is too broad to reach cheaply. Narrow it.' },
      { key: 'edge', score: has(input.edge) ? 6 : 3, why: has(input.edge) ? 'You named an edge. Make sure a buyer would notice it.' : 'No clear edge yet. Why you, why this, why now?' },
      { key: 'future', score: 6, why: 'Check whether this market is growing and how AI changes it.' },
    ],
    biggest_risk: 'Building before proving that a specific group of people will pay.',
    sharper_pitch: 'For [specific buyer], [your idea] delivers [one measurable result] in [timeframe], without [the pain of the current option].',
    seven_day_test: [
      'Write the problem in one sentence, in words a customer would use.',
      'List 10 named people who have this problem.',
      'Message all 10 and ask for a 15-minute conversation.',
      'Run your first conversations. Ask about the past, never pitch.',
      'Write down the exact phrases that came up more than once.',
      'Draft a one-page offer with a price, using their words.',
      'Ask three of them to pre-order or pay a deposit.',
    ],
    questions_to_ask: [
      'Tell me about the last time this problem came up. What did you do?',
      'What have you already tried or paid for to fix it?',
      'If this disappeared tomorrow, what would it cost you?',
    ],
    insider: 'Find someone who has worked inside this industry for years and ask what everyone outside gets wrong about it.',
  };
  return finish(raw);
}

module.exports = { run, CRITERIA, SCHEMA };
