// The first messages for each ranked business, every one opening on a fact read off its own site:
// Instagram DM, email (with the sender's address and an opt-out line), call opener, voicemail,
// walk-in line and two follow-ups. AI rewrites the first lines of the top 5 only; the rest use
// templates. Drafts only: the member sends from their own accounts.

const { views, outreach, text } = require('../../_kit');
const { serviceOf, senderOf } = require('../lib/services');
const RULES = require('../data/rules.json');

module.exports = {
  name: 'leads.write_outreach',
  title: 'Write the messages',
  description: 'Writes a DM, an email, a call opener, a walk-in line and 2 follow-ups for each ranked business, each opening on a fact from its own website. AI polishes the top 5.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      leads: { type: 'array', title: 'Ranked businesses', description: 'leads from leads.score_fit (or leads.scan_business outputs)' },
      service: { type: 'string', title: 'What you sell' },
      top: { type: 'integer', minimum: 1, maximum: 60, default: 25 },
      your_name: { type: 'string', title: 'Your first name (optional, else from your profile)' },
      address: { type: 'string', title: 'Your mailing address for emails (optional)' },
    },
    required: ['leads', 'service'],
  },
  output: { type: 'object', properties: { messages: { type: 'array' }, review: { type: 'array' }, replies: { type: 'array' }, rules: { type: 'array' }, ai: { type: 'boolean' } }, required: ['messages', 'review', 'replies', 'rules', 'ai'] },
  async run(input, ctx) {
    const service = serviceOf(input.service);
    const sender = senderOf(ctx, input);
    const list = (input.leads || []).filter((l) => l && l.key && !l.error).slice(0, input.top);
    if (!list.length) throw new Error('No businesses to write to yet.');
    const items = list.map((lead) => ({ lead, draft: outreach.draft({ lead, service, sender }) }));
    const { drafts, ai } = await outreach.aiOpeners(ctx, items.slice(0, 5), { service, sender });
    const all = drafts.concat(items.slice(5).map((x) => x.draft));
    const messages = all.map((d, i) => ({ ...d, rank: list[i].rank || i + 1, channels: outreach.channels(list[i], service).slice(0, 3).map((c) => ({ label: c.label, to: c.to, href: c.href, use: c.use })) }));
    // What the member reads and edits before sending: the message for each of the top 5, in its best channel.
    const review = messages.slice(0, 5).map((m) => {
      const ch = m.channels[0] || { use: 'email' };
      const use = ch.use === 'dm' ? 'dm' : ch.use === 'call' ? 'call' : ch.use === 'walkIn' ? 'walkIn' : 'email';
      return { key: m.key, name: `#${m.rank} ${m.name}`, channel: ch.label || 'Email', text: use === 'email' ? m.email.body : m[use] };
    });
    ctx.log(`Wrote messages for ${messages.length} businesses${ai ? ' (AI first lines for the top 5)' : ''}`);
    return { service: { id: service.id, label: service.label }, messages, review, replies: outreach.replies({ lead: list[0], service, sender }), rules: RULES.send_rules, ai, sample: list.some((l) => l.sample) };
  },
  view(out) {
    const top = out.messages.slice(0, 3);
    return views.blocks(
      views.metric('Messages ready', out.messages.length, out.ai ? 'AI wrote the first lines of the top 5' : 'Each opens on a fact from their website'),
      ...top.map((m) => [
        views.copy(`#${m.rank} ${m.name}: Instagram DM`, m.dm),
        views.copy(`#${m.rank} ${m.name}: email`, m.email.body, { to: m.email.to || '', subject: m.email.subject }),
      ]),
      views.table([{ key: 'rank', label: '#', format: 'number' }, { key: 'name', label: 'Business' }, { key: 'opener', label: 'Opens with' }, { key: 'where', label: 'Send by' }], out.messages.map((m) => ({ rank: m.rank, name: m.name, opener: text.clip(m.opener, 110), where: (m.channels[0] && m.channels[0].label) || 'Email' })), 10),
      views.text(`Before you send: ${out.rules.join(' ')}`)
    );
  },
};
