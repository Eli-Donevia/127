// Store emails: three abandoned-cart reminders and three after-purchase emails (thank you, how to use
// or care for it, and a check-in that asks for an honest review with nothing offered for it), from the
// member's shipping and returns facts. A discount appears only if they typed one. Drafts to paste into
// their store's email tool; nothing is sent.

const { views, save, text, ai } = require('../../_kit');
const U = require('../lib/util');
const S = require('../lib/store');

const { plain } = text;

const SCHEMA = {
  type: 'object',
  required: ['cart', 'after'],
  properties: {
    cart: { type: 'array', items: { type: 'object', required: ['subject', 'body'], properties: { subject: { type: 'string' }, body: { type: 'string' } } } },
    after: { type: 'array', items: { type: 'object', required: ['subject', 'body'], properties: { subject: { type: 'string' }, body: { type: 'string' } } } },
  },
};

const CART_WHEN = ['About 1 hour after they leave checkout', 'The next day', '3 days after'];
const AFTER_WHEN = ['Right after the order', 'The day it is delivered', '10 days after delivery'];

function template(f) {
  const sign = f.first || f.shop || 'Thanks';
  const help = f.support ? `Questions? Reply here or write to ${f.support}.` : 'Questions? Just reply to this email.';
  const cart = [
    { subject: 'You left something in your cart', body: `Hi {first name},\n\nYou were looking at {product} at ${f.shop || 'my shop'}. Your cart is saved, so you can pick up where you left off.\n\n{cart link}\n\n${help}\n\n${sign}` },
    { subject: 'A quick answer before you decide', body: `Hi {first name},\n\nA few things people ask before they order:\n- Shipping: ${f.shipping}\n- Returns: ${f.returns}\n${f.what ? `- What it is: ${f.what}\n` : ''}\nYour cart is still here: {cart link}\n\n${sign}` },
    { subject: 'Still thinking it over?', body: `Hi {first name},\n\nNo rush at all. If something stopped you, a question about size, shipping or price, I'd really like to know. Just reply.${f.offer ? `\n\n${f.offer}` : ''}\n\n{cart link}\n\n${sign}` },
  ];
  const after = [
    { subject: 'Thank you for your order', body: `Hi {first name},\n\nThank you for ordering from ${f.shop || 'my shop'}. It means a lot to a small shop like mine. ${f.shipping}\n\nI'll send tracking as soon as it ships. ${help}\n\n${sign}` },
    { subject: 'Your order arrived: a quick tip', body: `Hi {first name},\n\nYour order should be with you now. ${f.care || 'If anything arrived damaged, reply with a photo and I will make it right.'}\n\nReturns: ${f.returns}\n\n${sign}` },
    { subject: 'How is it working out?', body: `Hi {first name},\n\nYou've had your order for a little while now. How is it? If anything isn't right, reply and I'll help.\n\nIf you'd like to, an honest review helps other shoppers decide${f.review_link ? `: ${f.review_link}` : ' (you can leave one on the product page)'}. Good or bad, it's your call, and there's nothing attached to it.\n\n${sign}` },
  ];
  return { cart, after };
}

module.exports = {
  name: 'ecom.store_emails',
  title: 'Write cart and order emails',
  description: 'Three abandoned-cart reminders and three after-purchase emails (thank you, a care tip on delivery and an honest-review check-in with nothing offered for it), from your shipping and returns facts.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      shop: { type: 'string', maxLength: 80, title: 'Shop name' },
      what: { type: 'string', maxLength: 160, title: 'What you sell, in a few words' },
      shipping: { type: 'string', maxLength: 200, title: 'Shipping, in one line', default: 'Orders ship within 3 business days.' },
      returns: { type: 'string', maxLength: 200, title: 'Returns, in one line', default: 'Unused items can come back within 30 days.' },
      care: { type: 'string', maxLength: 300, title: 'A care or use tip (optional)' },
      support: { type: 'string', maxLength: 120, title: 'Your support email (optional)' },
      offer: { type: 'string', maxLength: 160, title: 'A cart offer (optional)', description: 'Only one you will honor, like "Code COMEBACK takes 10% off". Leave empty for none.' },
      review_link: { type: 'string', maxLength: 200, title: 'Where to leave a review (optional)' },
    },
  },
  output: { type: 'object', required: ['cart', 'after'], properties: { cart: { type: 'array' }, after: { type: 'array' }, notes: { type: 'array' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    const f = {
      shop: m.shop,
      first: m.first,
      what: plain(input.what || ''),
      shipping: plain(input.shipping || 'Orders ship within 3 business days.'),
      returns: plain(input.returns || 'Unused items can come back within 30 days.'),
      care: plain(input.care || ''),
      support: plain(input.support || ''),
      offer: plain(input.offer || ''),
      review_link: /^https:\/\//.test(String(input.review_link || '')) ? String(input.review_link) : '',
    };
    const typed = U.typedOf(input, ctx);
    const base = template(f);
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write store emails for a small online shop, in the owner\'s voice: warm, plain, short. Use only the facts given. No made-up urgency or scarcity, no ratings, reviews, buyer counts, "best" or percentages, and no discount unless one is given. A review ask offers nothing in return. Use {first name}, {product} and {cart link} as merge fields.',
      prompt: `Shop: ${f.shop || '(not given)'}\nSells: ${f.what || '(not given)'}\nShipping: ${f.shipping}\nReturns: ${f.returns}\nCare tip: ${f.care || '(none)'}\nSupport email: ${f.support || '(none)'}\nCart offer: ${f.offer || '(none: do not add one)'}\nReview link: ${f.review_link || '(none)'}\nSigned: ${f.first || f.shop || '(none)'}\n\nWrite cart: 3 abandoned-cart emails (1 hour, next day, 3 days) and after: 3 emails (right after the order, on delivery, 10 days later with an honest review ask). Each under 110 words with a subject under 50 characters.`,
      schema: SCHEMA,
      maxTokens: 1800,
      accept: (d) => U.acceptOf(typed)(d) && d.cart.length >= 3 && d.after.length >= 3,
      fallback: () => base,
    });
    const fix = (list, b, when) => list.slice(0, 3).map((e, i) => ({ when: when[i], subject: U.fit(U.scrub(e.subject, typed) || b[i].subject, 60), body: U.scrub(e.body, typed) || b[i].body }));
    const cart = fix(r.data.cart, base.cart, CART_WHEN);
    const after = fix(r.data.after, base.after, AFTER_WHEN);
    const notes = [
      'Shopify: paste the cart emails into Marketing, Automations (abandoned checkout) and set the timing there. Your email tool adds the unsubscribe link and your address.',
      'Etsy: keep messages to buyers about their order, inside Etsy Messages, and read Etsy\'s seller policy before you add anyone to an email list.',
      'Never offer anything for a review, and never ask only happy buyers.',
    ];
    const all = [...cart.map((e) => ['Cart', e]), ...after.map((e) => ['After purchase', e])].map(([k, e]) => `${k}: ${e.when}\nSubject: ${e.subject}\n\n${e.body}`).join('\n\n----\n\n');
    const file = await save.saveFile(ctx, save.fileName(f.shop || 'store', 'cart and order emails', '.txt'), all);
    return { cart, after, notes, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Store emails', '6 drafts', '3 abandoned cart, 3 after purchase'),
      ...out.cart.map((e, i) => views.copy(`Cart ${i + 1}: ${e.when}`, `Subject: ${e.subject}\n\n${e.body}`)),
      ...out.after.map((e, i) => views.copy(`After purchase ${i + 1}: ${e.when}`, `Subject: ${e.subject}\n\n${e.body}`)),
      views.text(out.notes.join(' ')),
      views.file(out.file, 'All six emails (text file)'),
    );
  },
};
