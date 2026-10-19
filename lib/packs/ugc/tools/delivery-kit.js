// Everything to deliver a paid job cleanly: the checklist, file names, the usage letter in plain
// words, the disclosure lines and the due date and edit window on a calendar. It hands sales.invoice
// the line items at the member's prices (a typed price, else "Your offer", else the new-creator
// price), what was paid up front and the delivery day, and marks the brand won in the Pipeline. The
// invoice step runs with pipeline: false, so HQ keeps one row for the brand.

const { views, save, files, money, time, text, brain } = require('../../_kit');
const U = require('../lib/ugc');
const offer = require('../lib/offer');
const talk = require('../../_kit/talk');

const USAGE = { organic: 'Organic use only', ads30: 'Organic use plus paid ad use for 30 days', ads90: 'Organic use plus paid ad use for 90 days' };

// The invoice lines: the videos, then what they added, each at the member's price.
function lineItems(input, n) {
  const qty = Math.max(1, Math.min(20, Number(input.videos) || 1));
  const hooks = Math.max(0, Math.min(10, Number(input.hooks) || 0));
  const out = [{ label: 'UGC video, 15 to 60 seconds', detail: 'Captions, clean version, organic use, one round of edits', qty, unit: 'video', price: n.video, taxable: false }];
  if (input.usage === 'ads30' || input.usage === 'ads90') out.push({ label: input.usage === 'ads30' ? 'Paid ad use, 30 days' : 'Paid ad use, 90 days', detail: 'From the first day you spend on the ad', qty, unit: 'video', price: n[input.usage], taxable: false });
  if (input.raw) out.push({ label: 'Raw footage (all takes)', detail: 'For your own edits', qty, unit: 'video', price: n.raw, taxable: false });
  if (hooks) out.push({ label: 'Extra hook (new first 3 seconds)', detail: 'To test in ads', qty: hooks, unit: 'hook', price: n.hook, taxable: false });
  if (input.whitelist) out.push({ label: 'Whitelisting or Spark Ads, 30 days', detail: 'Ads run from my account, on one platform', qty: 1, unit: 'item', price: n.whitelist, taxable: false });
  return out;
}

module.exports = {
  name: 'ugc.delivery_kit',
  title: 'Make the delivery kit',
  description: 'Builds the delivery checklist, file names, a usage letter in plain words, the disclosure lines and a calendar with the due date and the edit window for one paid job, and the invoice lines at your prices.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      lead: { type: 'object' },
      brand: { type: 'string', title: 'Brand name' },
      product: { type: 'string', title: 'Product' },
      videos: { type: 'integer', title: 'How many videos?', minimum: 1, maximum: 20, default: 1 },
      price: { type: 'number', title: 'Price per video', minimum: 30, maximum: 2000 },
      usage: { type: 'string', title: 'What did they buy?', enum: ['organic', 'ads30', 'ads90'], default: 'organic' },
      raw: { type: 'boolean', title: 'Raw footage included?', default: false },
      hooks: { type: 'integer', title: 'Extra hooks', minimum: 0, maximum: 10, default: 0 },
      whitelist: { type: 'boolean', title: 'Whitelisting or Spark Ads (30 days)?', default: false },
      due: { type: 'string', title: 'Due date (YYYY-MM-DD, optional)' },
      paid: { type: 'number', title: 'Paid up front', minimum: 0 },
      contact: { type: 'string', title: 'Their name', maxLength: 80 },
      email: { type: 'string', title: 'Their email', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['checklist', 'items'], properties: { total: { type: 'number' }, checklist: { type: 'array' }, names: { type: 'array' }, letter: { type: 'string' }, items: { type: 'array' }, customer: { type: 'object' }, paid: { type: 'number' }, due: { type: 'string' }, doc: { type: 'object' }, calendar: { type: 'object' } } },
  async run(input, ctx) {
    const lead = input.lead && typeof input.lead === 'object' ? input.lead : {};
    const brand = text.clip(text.oneLine(lead.inPipeline ? lead.name : input.brand || lead.name || 'Brand'), 50);
    const product = text.clip(text.oneLine(input.product || 'the product'), 60);
    const n = offer.offerNumbers({ price: input.price }, ctx);
    const items = lineItems(input, n);
    const total = items.reduce((s, x) => s + x.qty * x.price, 0);
    // Half up front unless they typed what was paid.
    const typedPaid = money.num(input.paid, null);
    const paid = typedPaid != null ? Math.max(0, Math.min(total, typedPaid)) : Math.round((total / 2) * 100) / 100;
    const today = time.today(ctx);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due || '') ? input.due : time.addDays(today, U.RATES.defaults.turnaround_days);
    const qty = items[0].qty;
    const hooks = Math.max(0, Math.min(10, Number(input.hooks) || 0));
    const slug = text.slug(brand, 24);
    const names = [];
    for (let i = 1; i <= qty; i++) names.push(`${slug}_video${i}_captions_9x16.mp4`, `${slug}_video${i}_clean_9x16.mp4`);
    for (let h = 1; h <= hooks; h++) names.push(`${slug}_video${((h - 1) % qty) + 1}_hook${Math.floor((h - 1) / qty) + 2}_9x16.mp4`);
    if (input.raw) names.push(`${slug}_raw_footage.zip`);
    const bought = `${USAGE[input.usage] || USAGE.organic}${input.whitelist ? ', with 30 days of whitelisting or Spark Ads' : ''}${input.raw ? ', with raw footage' : ''}`;
    const checklist = [
      `Brief in writing from ${brand}: product, angle, length, due ${time.shortDate(due)}, and what they bought (${bought.charAt(0).toLowerCase()}${bought.slice(1)}).`,
      paid > 0 ? `${money.usd(paid)} up front received before filming.` : 'Agree when they pay before you film: half up front is the usual.',
      'Film in daylight, 9:16, 1080p or 4K, two or three takes of each line.',
      `Hook in the first 3 seconds, ${product} on screen in the first 2.`,
      "Only say what you saw and felt using it. No claims the brand can't back up.",
      'Export two versions of each video: with captions and clean.',
      'Name files as listed below and send one shared folder link.',
      `One round of edits if asked within 5 days. Window closes ${time.shortDate(time.addDays(due, 5))}.`,
      'Send the invoice with the files.',
      `If you post it on your own account: say "${text.fill(U.RULES.disclosure.spoken, { brand })}" and add "${text.fill(U.RULES.disclosure.caption, { brand })}" to the caption.`,
    ];
    // Only the terms for what they bought: ad use, whitelisting and raw footage when they're part of the job.
    const terms = U.terms(brand).filter((t) => (t.id !== 'ads' || input.usage === 'ads30' || input.usage === 'ads90') && (t.id !== 'whitelist' || input.whitelist) && (t.id !== 'raw' || input.raw));
    const letter = [`Usage terms for ${brand}`, `What you bought: ${bought}.`, ...terms.map((t) => `${t.title}: ${t.text}`)].join('\n');
    const doc = await save.saveFile(ctx, save.fileName(brand, `delivery-kit ${today}`, '.txt'), [`Delivery kit: ${brand}, ${product}`, '', 'Checklist', ...checklist.map((c, i) => `${i + 1}. ${c}`), '', 'File names', ...names, '', letter, '', `Total ${money.usd(total)}, ${money.usd(paid)} paid up front, ${money.usd(total - paid)} due on delivery`].join('\n'));
    const calendar = await save.saveFile(ctx, save.fileName(brand, 'delivery-dates', '.ics'), files.ics([{ title: `Deliver ${brand} videos and the invoice`, date: due, allDay: true }, { title: `${brand} edit window closes`, date: time.addDays(due, 5), allDay: true }], { name: `${brand} delivery`, now: time.nowMs(ctx) }));
    // Logged for the month-end report: this brand's jobs, by due date (re-running the same job replaces it).
    try {
      const mem = brain.packMemory(ctx, 'ugc') || {};
      const jobs = (Array.isArray(mem.jobs) ? mem.jobs : []).filter((j) => j && !(j.brand === brand && j.due === due && j.product === product));
      await brain.remember(ctx, 'jobs', [...jobs, { brand, product, videos: qty, hooks, usage: input.usage || 'organic', raw: !!input.raw, due, made: today }].slice(-50));
    } catch {
      // The kit still works without the log.
    }
    // A paid job: the brand is won.
    const email = text.oneLine(input.email || lead.email || '');
    const dom = talk.domainOf(lead.website || '') || talk.domainOf(input.brand || '');
    const line = await talk.moveLead(ctx, { ...lead, key: lead.key || (dom ? `site:${dom}` : `lead:${text.slug(brand, 40)}`) }, {
      pack: 'ugc',
      stage: 'won',
      name: brand,
      source: 'Paid job',
      links: { ...(dom ? { website: `https://${dom}` } : {}), ...(/@/.test(email) ? { email } : {}) },
      data: { service: 'ugc', job: { product, videos: qty, due } },
    });
    const contact = text.clip(text.oneLine(input.contact || ''), 80);
    ctx.log(`Delivery kit for ${brand}: ${qty} video${qty === 1 ? '' : 's'}, total ${money.usd(total)}`);
    return {
      brand,
      product,
      total,
      paid,
      items,
      due,
      checklist,
      names,
      letter,
      doc,
      calendar,
      line,
      customer: { name: contact || brand, company: brand, email },
      title: `${qty} UGC video${qty === 1 ? '' : 's'}${product !== 'the product' ? ` for ${product}` : ''}`,
      notes: `What you bought: ${bought}. The usage terms are in the letter that comes with the files.`,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Job total', money.usd(out.total), `${money.usd(out.paid)} up front, ${money.usd(out.total - out.paid)} due ${time.shortDate(out.due)}`),
      views.table([{ key: 'item', label: 'Item' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'total', label: 'Total' }], out.items.map((x) => ({ item: x.label, qty: x.qty, total: money.usd(x.qty * x.price) }))),
      views.cards(out.checklist.map((c, i) => ({ title: `Step ${i + 1}`, body: c }))),
      views.copy('File names', out.names.join('\n')),
      views.copy('Usage letter', out.letter),
      views.file(out.doc, 'Delivery kit (.txt)'),
      views.file(out.calendar, 'Due date and edit window (calendar)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
