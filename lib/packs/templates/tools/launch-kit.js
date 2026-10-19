// The launch kit for one template: the launch email for your list (it ends with your name, your
// business, your address and a way to opt out), the note to 5 people you know, an honest review
// ask for after each sale (nothing in exchange, the same ask to every buyer), a 14-day launch plan
// with dates, and everything from the listing and pins in one text file you can work from.

const { views, save, ai, money, text, brain, time, outreach } = require('../../_kit');
const T = require('../lib/tpl');

const LIST_OPT_OUT = 'Not interested in emails like this? Reply "unsubscribe" and I will take you off my list.';
const REVIEW_RULES = [
  'Send the same ask to every buyer, not only the ones you think are happy.',
  'Nothing in exchange for a review: no discount, free item, refund or entry tied to one, and never ask for a number of stars.',
  'Etsy treats rewarded or fake reviews as shilling (Anti-Shilling policy), and the FTC bans rewards for reviews that say something positive or negative (16 CFR 465.4).',
];

function emailOf({ p, spec, price, link, intro, subject, b }) {
  const sheet = spec.sheet && p.formulas ? ` with ${p.formulas} formulas already in it` : '';
  const sign = [b.firstName || '[your name]', b.name || '', outreach.ADDRESS_HOLD].filter(Boolean).join('\n');
  const body = [
    'Hi,',
    '',
    `I just finished something new: the ${p.title || spec.title}. ${text.oneLine(intro)}`,
    '',
    "What's inside:",
    `- A spreadsheet for Google Sheets, Excel or Numbers${sheet}`,
    '- A Notion page you can import',
    '- A printable page to print or save as a PDF',
    '',
    `It is ${money.usd(price, { cents: price % 1 !== 0 })} and you can download it right away: ${link || '[your listing link]'}`,
    '',
    'If you try it, reply and tell me what you would change. I read every answer.',
    '',
    sign,
    '',
    LIST_OPT_OUT,
  ].join('\n');
  return { subject, preview: spec.hook, body };
}

function reviewAsk(p, spec, b) {
  const name = p.title || spec.title;
  const first = b.firstName ? `\n\n${b.firstName}` : '';
  return {
    etsy: `Thank you for buying the ${name}! Your files are in one zip. Open the how-to-open file first: it shows how to open the spreadsheet, import the Notion page and print the printable page.\n\nStuck on anything? Send me a message on Etsy and I will help.\n\nOnce you have used it for a while, a review helps other buyers know what to expect. Good or bad, an honest one is what helps.${first}`,
    gumroad: `Thank you for getting the ${name}! Start with the how-to-open file. Stuck? Email me at [your email] and I will help.\n\nOnce you have used it for a while, a rating on Gumroad helps other people decide. Good or bad, an honest one is what helps.${first}`,
  };
}

module.exports = {
  name: 'templates.launch_kit',
  title: 'Write the launch kit',
  description: 'Writes the launch email (with your address and an opt-out line), the note to 5 people you know, an honest review ask for Etsy and Gumroad, and a dated 14-day launch plan, in one text file with the listing and pins.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      product: { type: 'object' },
      listing: { type: 'object' },
      note: { type: 'string' },
      pins: { type: 'array', items: { type: 'object' } },
      start: { type: 'string', format: 'date' },
      link: { type: 'string', format: 'uri' },
    },
    required: ['product', 'listing'],
  },
  output: {
    type: 'object',
    properties: { email: { type: 'object' }, note: { type: 'string' }, review: { type: 'object' }, rules: { type: 'array' }, plan: { type: 'array' }, days: { type: 'object' }, file: { type: 'object' }, ai: { type: 'boolean' } },
    required: ['email', 'review', 'plan'],
  },
  async run(input, ctx) {
    const p = input.product || {};
    const spec = T.specOf(p.kind);
    const l = input.listing || {};
    const name = p.title || spec.title;
    const price = Number(l.price) || Number(p.price) || T.priceFor(p.kind);
    const b = brain.brainOf(ctx);
    const link = /^https:\/\//.test(String(input.link || '')) ? input.link : '';
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? input.start : time.today(ctx);
    const hook = `${spec.hook.charAt(0).toLowerCase()}${spec.hook.slice(1)}`;
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write a short launch email for a new digital template, sent by a small shop owner to people who asked to hear from them. Return a subject line under 50 characters and an intro of 1 or 2 sentences that says what the template helps with. Plain and warm, no hype, no urgency, no discounts, no results promised.',
      prompt: `Template: ${name}. What it does: ${spec.hook}. How it works: ${spec.use} Shop: ${b.name || 'a small template shop'}.`,
      schema: { type: 'object', properties: { subject: { type: 'string', maxLength: 60 }, intro: { type: 'string', maxLength: 280 } }, required: ['subject', 'intro'] },
      maxTokens: 250,
      accept: (d) => ai.cleanCopy(d) && d.subject.length <= 60 && !/\b(hurry|limited|only today|act now|don't miss|best|ultimate)\b/i.test(`${d.subject} ${d.intro}`),
      fallback: () => ({ subject: `New: the ${name}`, intro: `It helps you ${hook}, and it works in Google Sheets, Excel, Notion or on paper.` }),
    });
    const email = emailOf({ p, spec, price, link, intro: data.intro, subject: data.subject, b });
    const note = input.note || '';
    const review = reviewAsk(p, spec, b);
    const plan = T.launchDays(start).map((d) => ({ ...d, when: time.shortDate(d.date) }));
    const dayOf = (re) => (plan.find((d) => re.test(d.task)) || plan[0]).day;
    const days = { note: dayOf(/5 people/), email: dayOf(/launch email/) };
    const pins = Array.isArray(input.pins) ? input.pins : [];
    const fees = T.feesAt(price);
    const lines = [
      `${name}: your launch kit`,
      '',
      'YOUR 14 DAYS',
      ...plan.map((d) => `Day ${d.day}, ${d.when}: ${d.task}`),
      '',
      'ETSY LISTING',
      `Title (${(l.title || '').length} of ${T.PLATFORMS.etsy.title_max} characters): ${l.title || ''}`,
      `Tags (${(l.tags || []).length} of ${T.PLATFORMS.etsy.tags_max}): ${(l.tags || []).join(', ')}`,
      '',
      'Description:',
      l.description || '',
      '',
      'GUMROAD DESCRIPTION',
      l.gumroad || '',
      '',
      `PRICE ${money.usd(price, { cents: true })}: what one sale leaves you`,
      ...fees.map((f) => `- ${f.platform}: fees ${money.usd(f.fee, { cents: true })}, you keep ${money.usd(f.keep, { cents: true })}`),
      ...T.FEE_NOTES.map((n) => `  ${n}`),
      '',
      ...(pins.length ? ['PINTEREST PINS', ...pins.flatMap((x, i) => [`Pin ${i + 1} title: ${x.title}`, `Pin ${i + 1} description: ${x.description}`, `Pin ${i + 1} alt text: ${x.alt}`, `Pin ${i + 1} board: ${x.board}`, '']), ''] : []),
      ...(note ? [`NOTE TO 5 PEOPLE YOU KNOW (day ${days.note})`, note, '', 'Ask what was confusing, not for a review, and keep the free copy separate from any review.', ''] : []),
      `LAUNCH EMAIL (day ${days.email}, to people who asked to hear from you)`,
      `Subject: ${email.subject}`,
      `Preview line: ${email.preview}`,
      '',
      email.body,
      '',
      `No list yet? Skip it for now: the free page from Your offer starts one. Gumroad's Emails tab can send to your customers once you have earned $${T.PLATFORMS.gumroad.email_unlock_usd} after fees and had a payout.`,
      '',
      'REVIEW ASK, ETSY (Shop settings, Message to buyers, the one for digital items)',
      review.etsy,
      '',
      "REVIEW ASK, GUMROAD (top of the product's Content page)",
      review.gumroad,
      '',
      'RULES FOR REVIEWS',
      ...REVIEW_RULES.map((r) => `- ${r}`),
      '',
    ];
    const file = await save.saveFile(ctx, `${text.slug(name, 40)}-launch-kit.txt`, lines.join('\n'));
    ctx.log(`Launch kit written: 14-day plan from ${plan[0].when}, email, note and review ask`);
    return { email, note, review, rules: REVIEW_RULES, plan, days, file, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.table(
        [
          { key: 'when', label: 'When' },
          { key: 'task', label: 'Do this' },
        ],
        out.plan.map((d) => ({ when: `Day ${d.day}, ${d.when}`, task: d.task })),
      ),
      views.copy(`Day ${out.days.email}: launch email to your list`, out.email.body, { subject: out.email.subject }),
      views.copy('Etsy: Message to buyers for digital items', out.review.etsy),
      views.copy("Gumroad: top of the product's Content page", out.review.gumroad),
      views.text(out.rules.join(' ')),
      views.file(out.file, 'Your launch kit: plan, listing, pins, email and review ask (.txt)'),
    );
  },
  LIST_OPT_OUT,
  REVIEW_RULES,
};
