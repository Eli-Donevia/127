// local.neighborhood_posts: posts for Nextdoor, local Facebook groups and community boards, plus the
// reply for "anyone know a good ...?" threads. Each comes with the house rules to check first. The
// member posts them; nothing is posted for them.

const { text, ai, views } = require('../../_kit');
const F = require('../lib/facts');
const { BIZ } = require('../lib/common');
const NICHES = require('../data/niches.json');

const SPOTS = {
  nextdoor: {
    where: 'Nextdoor',
    rules: ['Post from your free Nextdoor Business Page. Nextdoor allows only occasional informal offers from personal accounts.', 'Keep it to your own neighborhood and nearby ones.', 'Answer every comment the same day.'],
  },
  facebook: {
    where: 'Local Facebook groups',
    rules: ['Read the group rules (About tab) before you post. Many groups allow business posts only on one day or in a weekly thread.', 'If the rules are unclear, message an admin and ask first.', 'Post in a few groups, not all of them on the same day.'],
  },
  board: {
    where: 'Community boards',
    rules: ['Ask at the front desk first; many boards want a date stamp and take posts down after 2 to 4 weeks.', 'Index card size or half a page. Add tear-off tabs with your phone.', 'Come back to replace it when the tabs are gone.'],
  },
  reply: {
    where: 'Recommendation threads',
    rules: ['Only reply where someone asked for this kind of help.', 'Say plainly that it is your own business.', 'One reply per thread. Let neighbors who hired you speak for you.'],
  },
};

function fallback(f) {
  const where = f.area || f.city || 'the neighborhood';
  const what = String(f.what || f.group.label).toLowerCase();
  const seed = f.name + where;
  const me = f.firstName ? `I'm ${f.firstName}` : `We're ${f.name}`;
  const contact = f.booking || f.website || (f.phone && f.phone.display) || 'a message';
  const services = (f.services || []).filter((s) => s.name).slice(0, 3);
  const list = services.length ? services.map((s) => `${s.name}${s.price != null ? ` (${s.from ? 'from ' : ''}$${s.price}${s.unit ? ` ${s.unit}` : ''})` : ''}`).join(', ') : (f.group.services || []).slice(0, 3).join(', ').toLowerCase();
  return {
    nextdoor: text.fill(
      text.pickBy(seed, [
        'Hi neighbors! {me}, and I just started {what} here in {where}. {mobile}I do {list}. If you ever need a hand, reach me at {contact}. Happy to answer questions in the comments too.',
        'Hello {where}! {me}, a local {what} business. {mobile}Services: {list}. Questions are welcome below, or reach me at {contact}.',
      ]),
      { me, what, where, list, contact, mobile: f.mobile ? `I come to you, ${String(f.group.mobile_line || 'at your place').toLowerCase()}. ` : '' }
    ),
    facebook: text.fill(
      text.pickBy(seed + 'f', [
        'Hi everyone, {me} and I live and work here in {where}. I started {name} for {what}: {list}. If this kind of post is allowed today, I would love to help a few neighbors. Message me or go to {contact}.',
        'Hello {where} neighbors! {me}, owner of {name}. I do {what}: {list}. Thank you to the admins for allowing business posts. Questions welcome, or reach me at {contact}.',
      ]),
      { me, what, where, list, contact, name: f.name }
    ),
    board: [f.name.toUpperCase(), `${text.clip(f.what || f.group.label, 50)}${f.mobile ? ', we come to you' : ''}`, list, `Serving ${where}`, `Call or text ${(f.phone && f.phone.display) || contact}`].filter(Boolean).join('\n'),
    reply: text.fill(text.pickBy(seed + 'r', ['Hi! {me}, and this is what I do ({name}, local to {where}). Full disclosure, it is my own business. Happy to give you a price: {contact}', '{me}, owner of {name} here in {where}. This is my line of work, so I am biased, but I would be glad to help. You can reach me at {contact}.']), { me, name: f.name, where, contact }),
  };
}

const SCHEMA = {
  type: 'object',
  required: ['nextdoor', 'facebook', 'reply'],
  properties: { nextdoor: { type: 'string', maxLength: 700 }, facebook: { type: 'string', maxLength: 700 }, reply: { type: 'string', maxLength: 300 } },
};

module.exports = {
  name: 'local.neighborhood_posts',
  title: 'Write neighborhood posts',
  description: 'Writes your posts for Nextdoor, local Facebook groups and community boards, and the reply for "anyone know a good..." threads, each with the rules to check before you post. You post them yourself.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      area: { type: 'string', title: 'Your neighborhood (optional)', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    required: ['posts'],
    properties: {
      posts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, where: { type: 'string' }, text: { type: 'string' }, rules: { type: 'array', items: { type: 'string' } } } } },
      boards: { type: 'array', items: { type: 'object' } },
      sample: { type: 'boolean' },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, { ...input, area: input.area || undefined });
    const fb = fallback(f);
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write friendly, plain neighborhood posts for a small local business owner, from the facts given only. First person. No hype, no claims you cannot check, no urgency, no hashtags. Nextdoor and Facebook posts under 600 characters; the reply under 250 and it must say it is the owner\'s own business.',
      prompt: `Owner: ${f.firstName || 'not given'}. Business: ${f.name}. What: ${f.what || f.group.label}. Area: ${f.area || f.city || 'not given'}. Mobile: ${f.mobile ? 'yes' : 'no'}. Services: ${(f.services || []).map((s) => s.name).join(', ') || f.group.services.join(', ')}. Contact: ${f.booking || f.website || (f.phone && f.phone.display) || 'not given'}.\nWrite nextdoor, facebook and reply.`,
      schema: SCHEMA,
      fallback: () => ({ nextdoor: fb.nextdoor, facebook: fb.facebook, reply: fb.reply }),
      accept: (d) => ai.cleanCopy(d) && !/#\w/.test(JSON.stringify(d)),
    });
    const d = res.data || fb;
    const posts = [
      { id: 'nextdoor', label: 'Nextdoor post', where: SPOTS.nextdoor.where, text: d.nextdoor, rules: SPOTS.nextdoor.rules },
      { id: 'facebook', label: 'Facebook group post', where: SPOTS.facebook.where, text: d.facebook, rules: SPOTS.facebook.rules },
      { id: 'board', label: 'Community board card', where: SPOTS.board.where, text: fb.board, rules: SPOTS.board.rules },
      { id: 'reply', label: 'Reply to a recommendation thread', where: SPOTS.reply.where, text: d.reply, rules: SPOTS.reply.rules },
    ];
    const boards = NICHES.board_spots.map((b) => ({ label: b.label, tip: b.tip }));
    return { posts, boards, sample: !f.hasName, ai: !!res.ai };
  },
  view(out) {
    return views.blocks(
      out.posts.map((p) => views.copy(p.label, p.text)),
      views.table([{ key: 'where', label: 'Where' }, { key: 'rules', label: 'Check first' }], out.posts.map((p) => ({ where: p.where, rules: p.rules.join(' ') }))),
      views.table([{ key: 'label', label: 'Boards to try' }, { key: 'tip', label: 'Tip' }], out.boards)
    );
  },
};
