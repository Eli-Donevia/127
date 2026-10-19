// Turns the approved messages into what the member builds from: a printable setup guide (HTML, no
// scripts) with every message as a copy block, a JSON spec of the whole flow, and a phone preview
// of the conversation. Re-checks every edited line against ManyChat's limits.

const { views, save, media, time, text } = require('../../_kit');
const platform = require('../data/platform.json');
const { goalOf, tagsFor, FOLLOW_UP_HOURS } = require('../lib/goals');
const { messagesFrom, problemsOf } = require('../lib/flow');
const { phoneSvg } = require('../lib/phone');
const { storyFrames } = require('../lib/frames');
const { buildGuide } = require('../lib/guide');
const { paletteFor } = require('../lib/palette');
const { clean } = require('../lib/keywords');
const { LIMITS } = require('../lib/limits');

function spec({ plan, K, url, msgs, tags, promo, today }) {
  const goal = plan.goal;
  const f = plan.facts || {};
  return {
    spec: 'DM funnel for ManyChat, version 1',
    made: today,
    business: f.business,
    goal,
    keyword: K,
    trigger:
      goal === 'story'
        ? { type: 'instagram_story_reply', keywords: [K, K.toLowerCase()], also: [{ type: 'instagram_dm_keyword', match: 'whole word', keywords: [K] }] }
        : {
            type: 'instagram_comment',
            posts: 'all posts and reels, or the ones you pick',
            keywords: [K, K.toLowerCase()],
            firstCommentOnly: true,
            also: [
              { type: 'instagram_story_reply', keywords: [K] },
              { type: 'instagram_dm_keyword', match: 'whole word', keywords: [K] },
            ],
          },
    publicReplies: (msgs.find((m) => m.type === 'public_reply') || { texts: [] }).texts,
    messages: msgs
      .filter((m) => m.type !== 'public_reply')
      .map((m) => ({ id: m.id, type: m.type, text: m.text, buttons: m.buttons, when: m.when || '', delayHours: m.delayHours || 0, characters: m.text.length, limit: m.check ? m.check.limit : null })),
    followUpHours: FOLLOW_UP_HOURS,
    link: url || '',
    tags,
    numbers: plan.numbers || [],
    manychatPlan: plan.manychat ? { plan: plan.manychat.plan.name, why: plan.manychat.why } : null,
    limits: { buttonTitle: LIMITS.button, buttonsPerMessage: LIMITS.buttons, textWithButtons: LIMITS.withButtons, textWithoutButtons: LIMITS.withoutButtons, checked: platform.manychat.limits.checked, sources: platform.manychat.limits.sources },
    rules: { standardWindowHours: platform.meta.standardWindowHours, humanAgentDays: platform.meta.humanAgentDays, privateReplyDays: platform.meta.privateReplyDays, checked: platform.meta.checked, sources: platform.meta.sources },
    promo: promo ? { reels: promo.reels, stories: promo.stories, pinned: promo.pinned } : null,
  };
}

module.exports = {
  name: 'dm.setup_guide',
  title: 'Build your setup guide',
  description: 'Makes a printable step-by-step ManyChat setup guide with every message as a copy block, a JSON spec of the flow, and a phone preview of the conversation.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      plan: { type: 'object', title: 'Funnel plan' },
      keyword: { type: 'string', title: 'Keyword', maxLength: 20 },
      url: { type: 'string', title: 'Link', maxLength: 600 },
      items: { type: 'array', title: 'Approved messages', items: { type: 'object' } },
      promo: { type: 'object', title: 'Reels and stories' },
      posts: { type: 'object', title: 'Post ranking' },
      color: { type: 'string', title: 'Brand color (optional)', maxLength: 9 },
    },
    required: ['plan', 'items'],
  },
  output: {
    type: 'object',
    properties: { guide: { type: 'object' }, spec: { type: 'object' }, problems: { type: 'array' }, messages: { type: 'array' } },
    required: ['guide', 'spec', 'problems'],
  },
  async run(input, ctx) {
    const plan = input.plan || {};
    const goal = goalOf(plan.goal);
    const f = plan.facts || {};
    const K = clean(input.keyword) || 'SEND';
    const items = (input.items || []).filter((x) => x && typeof x === 'object');
    const msgs = messagesFrom(goal, items, { url: input.url, keyword: K });
    const problems = problemsOf(msgs);
    const tags = tagsFor(goal, K, { emailCapture: !!plan.emailCapture });
    const p = paletteFor(ctx, { color: input.color });
    const today = time.today(ctx);
    ctx.log('Building your setup guide');

    const phone = phoneSvg(msgs, p, f, K);
    const frames = input.promo && input.promo.stories ? storyFrames(input.promo.stories, p, f, K) : [];
    const html = buildGuide({ plan: { ...plan, goal }, keyword: K, url: input.url, messages: msgs, tags, promo: input.promo, frames, phone, posts: input.posts, palette: p, today });
    const base = save.fileName(f.business || 'my', 'dm', K.toLowerCase());
    const guide = await save.saveFile(ctx, `${base}-setup-guide.html`, html, 'text/html');
    const specFile = await save.saveFile(ctx, `${base}-flow.json`, JSON.stringify(spec({ plan: { ...plan, goal }, K, url: input.url, msgs, tags, promo: input.promo, today }), null, 2), 'application/json');
    let preview = null;
    if (media.canRender(ctx)) {
      try {
        const png = await media.svgToPng(ctx, phone);
        preview = await save.saveFile(ctx, `${base}-preview.png`, png, 'image/png');
      } catch {
        preview = null;
      }
    }
    // What the member pastes into ManyChat, in order (for the copy blocks in HQ).
    const paste = msgs
      .filter((m) => m.type !== 'public_reply')
      .map((m) => ({ id: m.id, title: m.title, text: m.text, buttons: (m.buttons || []).map((b) => b.title) }));
    const replies = (msgs.find((m) => m.type === 'public_reply') || { texts: [] }).texts;
    return { keyword: K, goal, guide, spec: specFile, preview, problems, messages: paste, publicReplies: replies, tags: tags.map((t) => t.tag), url: input.url || '' };
  },
  view(out) {
    const blocks = [
      views.metric('Keyword', out.keyword, out.problems.length ? `${out.problems.length} line${out.problems.length === 1 ? '' : 's'} to fix first: ${text.clip(out.problems[0], 100)}` : "Every message fits ManyChat's limits"),
      views.image(out.preview, 'What people see'),
      views.file(out.guide, 'Setup guide (print it or keep it open while you build)'),
      views.file(out.spec, 'Flow spec (JSON)'),
    ];
    if (out.publicReplies && out.publicReplies.length) blocks.push(views.copy('Public replies (paste 3, keep 2 for next week)', out.publicReplies.join('\n')));
    for (const m of out.messages || []) {
      blocks.push(views.copy(m.title, m.text));
      if (m.buttons && m.buttons.length) blocks.push(views.copy(`${m.title} button${m.buttons.length > 1 ? 's' : ''}`, m.buttons.join('\n')));
    }
    if (out.url) blocks.push(views.copy('Link for the button', out.url));
    return views.blocks(blocks).slice(0, 30);
  },
};
