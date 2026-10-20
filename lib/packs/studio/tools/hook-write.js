// Hook lines for a video: the first words on screen and the first thing said, written for the
// member's topic. AI writes them from the topic and the business facts; a set of proven hook shapes
// filled with the topic is the fallback.

const { ai, text, views, brain } = require('../../_kit');

// Hook shapes: [angle, title, first line]. {t} is the topic, {a} the audience.
const SHAPES = [
  ['curiosity', 'The one thing nobody tells you about {t}', 'Here is what I learned doing this every week.'],
  ['mistakes', '3 mistakes people make with {t}', 'Number two is the one I see the most.'],
  ['speed', 'The 30 second guide to {t}', 'Save this so you have it later.'],
  ['honest', 'Is {t} worth it? My honest answer', 'Here is who it is for, and who it is not for.'],
  ['behind', 'How we do {t}, start to finish', 'This is the part most people never see.'],
  ['wish', 'What I wish I knew sooner about {t}', 'It would have saved me a lot of time.'],
  ['callout', '{a}, this one is for you', 'If {t} is on your list, watch this first.'],
  ['before', 'Watch this before you spend money on {t}', 'Three questions to ask first.'],
  ['myth', 'You do not need to overthink {t}', 'Here is the simple version.'],
  ['steps', '{t} in 3 simple steps', 'Step one takes less than a minute.'],
  ['question', 'What is the hardest part of {t}?', 'For most people it is this.'],
  ['contrast', '{t}: the hard way vs the easy way', 'Most people start with the hard way.'],
];

const SCHEMA = {
  type: 'object',
  properties: { hooks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', maxLength: 90 }, line: { type: 'string', maxLength: 110 }, angle: { type: 'string' } }, required: ['text', 'line'] } } },
  required: ['hooks'],
};

function fallbackHooks(topic, audience, count, seed) {
  const start = text.hash(seed) % SHAPES.length;
  const out = [];
  for (let k = 0; k < SHAPES.length && out.length < count; k++) {
    const [angle, t, l] = SHAPES[(start + k) % SHAPES.length];
    if (/\{a\}/.test(t + l) && !audience) continue;
    const fill = (s) => s.replace(/\{t\}/g, topic).replace(/\{a\}/g, audience);
    let title = fill(t);
    title = title.charAt(0).toUpperCase() + title.slice(1);
    out.push({ text: title, line: fill(l), angle });
  }
  return out;
}

module.exports = {
  name: 'studio.write_hooks',
  title: 'Write hook lines',
  description: 'Writes hook lines for your video: the title that shows on the first seconds and the first line to say or caption, each a different angle (a question, a mistake, a quick guide, behind the scenes...). Pick the ones to test.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      topic: { type: 'string', title: 'What the video is about (optional, we use your profile)', maxLength: 160 },
      audience: { type: 'string', title: 'Who it is for (optional)', maxLength: 120 },
      count: { type: 'integer', title: 'How many hooks', minimum: 3, maximum: 10, default: 8 },
    },
  },
  output: {
    type: 'object',
    properties: { hooks: { type: 'array' }, topic: { type: 'string' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['hooks'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const topic = text.clip(text.oneLine(input.topic || b.offer || b.what || b.niche || 'what you do'), 120).replace(/[.!?]+$/, '');
    const audience = text.clip(text.oneLine(input.audience || b.audience || ''), 80);
    const count = Math.max(3, Math.min(10, input.count || 8));
    const fb = () => ({ hooks: fallbackHooks(topic.charAt(0).toLowerCase() + topic.slice(1), audience, count, `${b.name}|${topic}`) });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write hooks for short vertical videos (Reels, TikTok, Shorts) for a small business. A hook is a title on screen for the first 3 seconds (under 60 characters) plus the first spoken line (under 90 characters). Each hook takes a different angle. Plain words, specific to the topic, no hype, no emoji, no hashtags, no promised results or numbers that were not given.',
      prompt: `Video topic: ${topic}.${audience ? ` Audience: ${audience}.` : ''}\nBusiness: ${brain.describe(b)}\nWrite ${count} hooks. Angles to spread across: question, common mistake, quick guide, honest take, behind the scenes, call out the viewer, myth, steps, contrast.`,
      schema: SCHEMA,
      fallback: fb,
      accept: (d) => ai.cleanCopy(d) && Array.isArray(d.hooks) && d.hooks.length >= Math.min(3, count) && d.hooks.every((h) => h.text && h.text.length <= 70),
    });
    const seen = new Set();
    const hooks = [];
    for (const h of [...(data.hooks || []), ...fb().hooks]) {
      const t = text.clip(text.oneLine(h.text || ''), 70);
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      hooks.push({ n: hooks.length + 1, text: t, line: text.clip(text.oneLine(h.line || ''), 100), angle: text.oneLine(h.angle || '') || 'hook' });
      if (hooks.length >= count) break;
    }
    ctx.log(`${hooks.length} hooks for "${text.clip(topic, 60)}"`);
    return { hooks, topic, ai: usedAi, sample: !usedAi };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'text', label: 'Hook title' }, { key: 'line', label: 'First line' }, { key: 'angle', label: 'Angle' }], out.hooks, 10),
      views.copy('All hooks', out.hooks.map((h) => `${h.n}. ${h.text}\n   ${h.line}`).join('\n')),
    );
  },
};

module.exports.fallbackHooks = fallbackHooks;
