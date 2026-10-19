// Three reel scripts and three story frames that send people to the keyword. Each reel has a hook
// (said and shown), beats with shots, the call to action and a caption. AI drafts when it's on;
// otherwise three proven formats filled with the member's facts.

const { ai, views, text, brain } = require('../../_kit');
const { GOALS, goalOf } = require('../lib/goals');
const { promoFallback } = require('../lib/promo');
const { clean } = require('../lib/keywords');

const LINE = { type: 'object', properties: { say: { type: 'string', maxLength: 220 }, text: { type: 'string', maxLength: 60 } }, required: ['say', 'text'] };
const SCHEMA = {
  type: 'object',
  properties: {
    reels: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 40 },
          length: { type: 'string', maxLength: 30 },
          hook: LINE,
          beats: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', properties: { shot: { type: 'string', maxLength: 120 }, say: { type: 'string', maxLength: 220 }, text: { type: 'string', maxLength: 60 } }, required: ['shot', 'say'] } },
          cta: LINE,
          caption: { type: 'string', maxLength: 300 },
        },
        required: ['title', 'hook', 'beats', 'cta', 'caption'],
      },
    },
    stories: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'object', properties: { kicker: { type: 'string', maxLength: 30 }, title: { type: 'string', maxLength: 48 }, lines: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 60 } }, sticker: { type: 'string', maxLength: 90 } }, required: ['kicker', 'title', 'lines'] },
    },
  },
  required: ['reels', 'stories'],
};

function mentionsKeyword(data, K) {
  const re = new RegExp(`\\b${K}\\b`);
  return data.reels.every((r) => re.test(`${r.cta.say} ${r.cta.text} ${r.caption}`)) && re.test(data.stories[2].title + data.stories[2].lines.join(' '));
}

module.exports = {
  name: 'dm.promo_scripts',
  title: 'Write reels and stories',
  description: 'Writes 3 reel scripts (hook, shots, lines, on-screen text, caption) and 3 story frames that get people to comment or reply with your keyword.',
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
    },
    required: ['plan'],
  },
  output: {
    type: 'object',
    properties: { keyword: { type: 'string' }, reels: { type: 'array' }, stories: { type: 'array' }, pinned: { type: 'string' } },
    required: ['keyword', 'reels', 'stories'],
  },
  async run(input, ctx) {
    const plan = input.plan || {};
    const goal = goalOf(plan.goal);
    const K = clean(input.keyword) || clean(plan.keywords && plan.keywords[0] && plan.keywords[0].keyword) || 'SEND';
    const f = { ...(plan.facts || {}), today: plan.today, seed: `${(plan.facts || {}).business}|${(plan.facts || {}).thing}|${K}` };
    const fb = promoFallback(goal, K, f);
    ctx.log(`Writing 3 reels and 3 story frames for ${K}`);
    const prompt = [
      `Write 3 Instagram reel scripts and 3 story frames for this business. Each one ends by asking people to ${goal === 'story' ? `send ${K} in a DM` : `comment ${K}`} (stories: reply ${K}).`,
      brain.describe(brain.brainOf(ctx, {})),
      `Funnel: ${GOALS[goal].label}. What people get: ${f.thing}.${f.productName ? ` Product: ${f.productName}${f.price ? `, ${f.price}` : ''}.` : ''}${f.launch ? ` Launching: ${f.launch}${f.dateText ? ` on ${f.dateText}` : ''}.` : ''}`,
      'Use three different formats: show the thing, a question or mistake people relate to, and behind the scenes.',
      'Hooks: one spoken line under 15 words plus on-screen text under 6 words. Beats: what to film and what to say.',
      'Put [square brackets] around any detail only the owner knows instead of inventing it. Never invent numbers, reviews, customers or results.',
      'Story frames: a kicker (2 to 4 words), a big title (under 8 words), up to 3 short lines. Frame 3 title is exactly "Reply ' + K + '".',
      'No hashtags, no emoji, no promises of results, no fake urgency.',
    ].join('\n');
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      prompt,
      schema: SCHEMA,
      fallback: () => fb,
      accept: (d) => ai.cleanCopy(d) && mentionsKeyword(d, K),
      maxTokens: 2500,
    });
    // The story CTA frame always carries the keyword exactly, and keeps the sticker tips.
    const stories = data.stories.map((s, i) => ({ ...s, sticker: s.sticker || (fb.stories[i] && fb.stories[i].sticker) || '', cta: i === 2 }));
    stories[2].title = `Reply ${K}`;
    return { keyword: K, goal, reels: data.reels.map((r) => ({ length: '15 to 30 seconds', ...r })), stories, pinned: fb.pinned, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      ...out.reels.map((r, i) =>
        views.copy(
          `Reel ${i + 1}: ${r.title}`,
          [`Hook: ${r.hook.say}`, r.hook.text ? `On screen: ${r.hook.text}` : '', ...r.beats.map((b, j) => `${j + 1}. ${b.shot}${b.say ? `. Say: ${b.say}` : ''}${b.text ? ` (on screen: ${b.text})` : ''}`), `End: ${r.cta.say}`, `Caption: ${r.caption}`].filter(Boolean).join('\n')
        )
      ),
      views.copy('Pin this comment under each reel', out.pinned),
      views.text(out.stories.map((s, i) => `Story ${i + 1}: ${s.title}${s.lines && s.lines.length ? ` (${s.lines.join(', ')})` : ''}`).join('\n'))
    );
  },
};
