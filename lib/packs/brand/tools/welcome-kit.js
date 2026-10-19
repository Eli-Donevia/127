// The welcome kit itself: a printable welcome guide in the brand colors (how it works, how to get
// ready, the member's policies, how to reach them) and the four messages a new customer gets: the
// welcome email, a booking text, a reminder the day before and a thank-you after. Policies and
// contact details are only what the member typed; nothing is guessed.

const { views, save, text } = require('../../_kit');
const { specFrom } = require('../lib/kit');
const W = require('../lib/welcome');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = {
  name: 'brand.welcome_kit',
  title: 'Welcome kit',
  description: 'Builds a printable welcome guide for new customers in your colors, with how it works, how to get ready, your policies and how to reach you, plus the welcome email and three texts to send.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      steps: { title: 'The steps you kept' },
      prep: { title: 'How customers get ready' },
      group: { type: 'string', title: 'How the business works' },
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      service: { type: 'string', title: 'What they booked (optional)', maxLength: 80 },
      customer: { type: 'string', title: "Customer's first name (optional)", maxLength: 40 },
      when: { type: 'string', title: 'When (optional)', maxLength: 60 },
      policies: { type: 'string', format: 'textarea', title: 'Your policies (optional)', maxLength: 1500 },
      phone: { type: 'string', title: 'Phone for customers (optional)', maxLength: 30 },
      email: { type: 'string', title: 'Email for customers (optional)', maxLength: 80 },
      hours: { type: 'string', title: 'Hours (optional)', maxLength: 80 },
      palette: { title: 'Colors (optional)' },
    },
  },
  output: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      guide: { type: 'object' },
      messages: { type: 'object' },
      email: { type: 'object' },
      texts: { type: 'object' },
      steps: { type: 'array' },
      prep: { type: 'array' },
      policies: { type: 'array' },
      missing: { type: 'array' },
    },
    required: ['guide', 'messages', 'email', 'texts'],
  },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    const name = spec.name || '';
    const base = W.draft(spec.niche.id, {});
    const picked = (Array.isArray(input.steps) ? input.steps : []).filter((s) => s && s.title).map((s) => ({ title: text.oneLine(s.title), detail: text.oneLine(s.detail || '') }));
    const steps = picked.length ? picked : base.steps;
    const prep = (Array.isArray(input.prep) ? input.prep : []).map((p) => text.oneLine(p)).filter(Boolean).slice(0, 6);
    const tips = prep.length ? prep : base.prep;
    const group = W.STEPS[input.group] ? input.group : base.group;
    const policies = W.linesOf(input.policies, 8);
    const phone = text.oneLine(input.phone || '');
    const email = EMAIL.test(text.oneLine(input.email || '')) ? text.oneLine(input.email) : '';
    const hours = text.oneLine(input.hours || '');
    const service = text.oneLine(input.service || '') || (spec.known ? spec.descriptor.toLowerCase() : '');
    const contact = { phone, email, hours, website: spec.brain.website || '' };
    const m = W.messages({ business: name, firstName: spec.firstName, customer: text.oneLine(input.customer || ''), service, when: text.oneLine(input.when || ''), steps, prep: tips, policies, phone, email, group });
    const guide = await save.saveFile(ctx, save.fileName(...[name, 'welcome guide'].filter(Boolean), '.html'), W.guideHtml({ spec, group, service, steps, prep: tips, policies, contact }));
    const messages = await save.saveFile(ctx, save.fileName(...[name, 'welcome messages'].filter(Boolean), '.txt'), W.messagesTxt(m));
    const missing = [
      name ? null : 'Your business name, so the guide and the messages carry it.',
      policies.length ? null : 'Your policies (cancelling, moving a booking, how to pay). We left them out rather than guess.',
      phone || email ? null : 'A phone or email for customers. Until then the guide says to reply to the message it came with.',
      input.email && !email ? `"${text.clip(input.email, 40)}" doesn't look like an email address, so it was left out.` : null,
    ].filter(Boolean);
    ctx.log(`Welcome kit: ${text.plural(steps.length, 'step')}, ${text.plural(tips.length, 'tip')}, ${text.plural(policies.length, 'policy', 'policies')}.`);
    return {
      name,
      guide,
      messages,
      email: { subject: m.subject, body: m.email },
      texts: { booked: m.booked, reminder: m.reminder, after: m.after },
      steps,
      prep: tips,
      policies,
      missing,
    };
  },
  view(out) {
    return views.blocks(
      out.missing.length ? views.cards(out.missing.map((x) => ({ title: 'Add this and run it again', body: x }))) : null,
      views.file(out.guide, 'Welcome guide to print or attach (one page)'),
      views.copy('Welcome email', out.email.body, { subject: out.email.subject }),
      views.copy('Booking text', out.texts.booked),
      views.copy('Reminder text, the day before', out.texts.reminder),
      views.copy('After the visit', out.texts.after),
      views.file(out.messages, 'All four messages in one text file')
    );
  },
};
