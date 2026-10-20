// Reads what the member wants built and picks the closest ready-made app as the safe fallback,
// plus a short title and any questions or items they listed.

const { ai, text, views } = require('../../_kit');
const S = require('../lib/starters');

// A list of names in the description ("Maya, Jordan, Lee and Priya") for a tip splitter's team.
const namesIn = (d) => {
  const m = String(d).match(/\b[A-Z][a-z]+(?:(?:,\s*|,?\s+and\s+)[A-Z][a-z]+){1,}/);
  return m ? m[0].split(/,\s*|,?\s+and\s+/).filter(Boolean).slice(0, 20) : [];
};

const IDS = S.STARTERS.map((s) => s.id);
const SCHEMA = {
  type: 'object',
  properties: {
    starter: { type: 'string', enum: IDS },
    title: { type: 'string', maxLength: 60 },
    summary: { type: 'string', maxLength: 300 },
    questions: { type: 'array', items: { type: 'string', maxLength: 120 } },
  },
  required: ['starter', 'title', 'summary', 'questions'],
};

module.exports = {
  name: 'tools.plan_app',
  title: 'Plan your app',
  description: 'Reads the description of the app you want, names it, lists what it will do, and picks the closest ready-made app to fall back on.',
  kind: 'ai',
  risk: 'read',
  needs: [],
  tasks: ['extract'],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      description: { type: 'string', title: 'What should the app do?', maxLength: 3000 },
    },
    required: ['description'],
  },
  output: {
    type: 'object',
    properties: { starter: { type: 'string' }, starterName: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } }, ai: { type: 'boolean' } },
    required: ['starter', 'starterName', 'title', 'summary', 'questions'],
  },
  async run(input, ctx) {
    const d = text.clip(input.description, 3000);
    const guess = S.nearest(d);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'extract',
      system: 'You read a small business owner\'s description of a simple internal app and classify it. Pick the closest starter id. The title is 2 to 5 words. The summary says in one or two plain sentences what the app will do. questions: the form questions, checklist steps or items the owner listed, in their words (empty if none).',
      prompt: `Starters:\n${S.STARTERS.map((s) => `${s.id}: ${s.title}. ${s.blurb}`).join('\n')}\n\nDescription:\n${d}`,
      schema: SCHEMA,
      maxTokens: 600,
      fallback: () => ({ starter: guess, title: (S.byId(guess) || {}).title || 'Your app', summary: text.clip(d, 300), questions: guess === 'tips' ? namesIn(d) : [] }),
    });
    const s = S.byId(data.starter) || S.byId(guess);
    ctx.log(`Planned "${data.title}"; closest ready-made app: ${s.title}`);
    return { starter: s.id, starterName: s.title, title: text.clip(data.title, 60), summary: text.clip(data.summary, 300), questions: (data.questions || []).slice(0, 30).map((q) => text.clip(q, 120)), ai: usedAi };
  },
  view(out) {
    return views.blocks(views.metric('App', out.title, `Falls back to: ${out.starterName}`), views.text(out.summary));
  },
};
