// Window count estimate, the windows pack's signature tool and workflow. The member counts windows by
// type (standard, picture, French or divided panes, skylights) and floor, inside and out or one side,
// plus screens, tracks and hard water spots. Out come the minutes per pane and time on site, a price
// from their per-window and per-pane rates (the sourced ranges in data/prices.json at their position,
// or their own prices), the gear each floor needs, the checks to make before the job with their
// sources, a printable estimate sheet and a text to send. The workflow then makes the quote and, on a
// yes, the invoice. The math and the sheet are lib/estimate.js. Windows pack.

const { text, time, views, save } = require('../../_kit');
const offer = require('../../_kit/home/offer');
const print = require('../../_kit/home/print');
const T = require('../../_kit/home/tools');
const est = require('../lib/estimate');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const usd = est.usd;

// The count inputs, one per window type and floor plus the extras, from data/prices.json "estimate".
function countProps(cfg, num) {
  const out = {};
  for (const c of est.countFields(cfg)) out[c.key] = num(c.title);
  for (const x of est.extraFields(cfg)) out[x.key] = num(x.title);
  return out;
}

function countEstimateTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const E = cfg.prices.estimate;
  const num = (title) => ({ type: ['integer', 'string'], minimum: 0, maximum: 999, title });
  return {
    name: `${id}.count_estimate`,
    title: 'Window count estimate',
    description: 'Window counts by type and floor (standard, picture, French panes, skylights), inside and out or one side, plus screens, tracks and hard water spots, give the minutes per pane and time on site, a price from your per-window and per-pane rates, the gear each floor needs, the checks to make first and a printable estimate sheet.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      properties: {
        customer: { type: 'string', maxLength: 80, title: 'Customer name' },
        address: { type: 'string', maxLength: 200, title: 'Address (optional)' },
        ...countProps(cfg, num),
        sides: { type: 'string', enum: Object.keys(est.SIDES), default: 'Inside and out', title: 'Sides' },
        frequency: { type: 'string', enum: Object.keys(est.FREQUENCY), default: 'One time', title: 'How often' },
        city: { type: 'string', maxLength: 80, title: 'Your city and state' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['items', 'rows', 'files'],
      properties: {
        customer: { type: 'string' },
        title: { type: 'string' },
        rows: { type: 'array' },
        items: { type: 'array' },
        subtotal: { type: 'number' },
        windows: { type: 'integer' },
        panes: { type: 'integer' },
        minutes: { type: 'integer' },
        hours: { type: 'number' },
        perHour: { type: 'number' },
        gear: { type: 'array' },
        flags: { type: 'array' },
        plan: { type: 'object' },
        text: { type: 'string' },
        notes: { type: 'string', maxLength: 1000 },
        valid: { type: 'string' },
        sources: { type: 'string' },
        contactLine: { type: 'string' },
        files: { type: 'object', properties: { sheet: ASSET } },
        next: { type: 'array' },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const e = est.compute(cfg, menu, input);
      if (!e.items.length) throw new Error('Type at least one count, like 12 standard windows on the first floor.');
      const name = text.plain(input.customer || '');
      const who = name || 'your customer';
      const today = time.today(ctx);
      const valid = time.longDate(time.addDays(today, E.valid_days || 30));
      const frequency = (e.plan && Object.keys(est.FREQUENCY).find((k) => est.FREQUENCY[k] === e.plan.id)) || 'One time';
      const pal = print.paletteFor(cfg, input.color);
      const html = est.sheet(cfg, {
        ...e,
        customer: name || 'Your home',
        address: text.plain(input.address || ''),
        date: time.longDate(today),
        valid,
        frequency,
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: f.area !== 'town' ? `Window cleaning in ${f.area}` : '',
      }, pal);
      const sheet = await save.saveFile(ctx, save.fileName(f.business, name || 'customer', 'window estimate', '.html'), html);
      const msg = est.message(cfg, e, { customer: name.split(' ')[0] || 'there', first: f.first, business: f.business });
      const notes = [`${e.desc.charAt(0).toUpperCase()}${e.desc.slice(1)}.`, `About ${e.hours} hours on site.`, e.plan ? `Repeats every ${e.plan.every}. ${N.texts.plan_terms || ''}` : '', N.offer.promise];
      const publishers = [...new Set(['window', 'picture', 'small_pane', 'screens', 'tracks', 'hard_water', 'skylight'].flatMap((x) => (([...(cfg.prices.packages || []), ...(cfg.prices.addons || [])].find((p) => p.id === x) || {}).sources || []).map((s) => s.publisher)))];
      return {
        customer: who,
        title: e.title,
        rows: e.rows,
        items: e.items,
        subtotal: e.subtotal,
        windows: e.windows,
        panes: e.panes,
        minutes: e.minutes,
        hours: e.hours,
        ...(e.perHour != null ? { perHour: e.perHour } : {}),
        gear: e.gear,
        flags: e.flags,
        ...(e.plan ? { plan: e.plan } : {}),
        text: msg,
        notes: text.clip(notes.filter(Boolean).join(' '), 990),
        valid,
        sources: `Per-window and per-pane ranges from ${text.list(publishers)}, checked ${cfg.prices.checked}. Your position in Your offer picks a price inside each range, and your own prices win. Minutes per pane, the upper-floor prices and the one-side shares are estimates: time your first few jobs and adjust.`,
        // For the quote: your phone and booking link as they print (the Sales desk takes 200 characters).
        contactLine: ((line) => (line.length <= 200 ? line : f.phone || ''))([f.phone, f.link].filter(Boolean).join(', ')),
        files: { sheet },
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the estimate', invoice: false },
        ],
      };
    },
    view(out) {
      const links = [];
      const seen = new Set();
      for (const fl of out.flags || []) {
        for (const s of fl.sources || []) {
          if (seen.has(s.url)) continue;
          seen.add(s.url);
          links.push(views.link(`Source: ${s.publisher}`, s.url));
        }
      }
      return views.blocks(
        { ...views.metric(`Estimate for ${out.customer}`, out.subtotal, `${out.title}, about ${out.hours} hours on site`), format: 'money' },
        views.table(
          [
            { key: 'item', label: 'Item' },
            { key: 'count', label: 'Count', format: 'number' },
            { key: 'panes', label: 'Panes', format: 'number' },
            { key: 'perPane', label: 'Minutes per pane', format: 'number' },
            { key: 'minutes', label: 'Minutes', format: 'number' },
            { key: 'each', label: 'Each' },
            { key: 'total', label: 'Total' },
          ],
          // Dollars as they print on the sheet ("$14.40", not 14.4).
          (out.rows || []).map((r) => ({ ...r, each: usd(r.each), total: usd(r.total) })),
          20,
        ),
        views.text(`${out.minutes} minutes on site with setup, about ${out.hours} hours${out.perHour != null ? `: ${usd(out.perHour)} an hour at this price` : ''}. ${out.windows} windows and ${out.panes} panes in all.`),
        out.gear && out.gear.length ? views.table([{ key: 'floor', label: 'Floor' }, { key: 'gear', label: 'Gear to bring' }], out.gear) : null,
        (out.flags || []).map((x) => views.text(x.say)),
        views.file(out.files && out.files.sheet, 'Estimate sheet: open it, then Print or Save as PDF'),
        views.copy(`Text to ${out.customer}`, out.text),
        links,
        views.text(out.sources),
      );
    },
  };
}

// The workflow: count, price and print, then the quote and, on a yes, the invoice.
function estimateWorkflow(cfg, tool) {
  const id = cfg.id;
  const P = cfg.niche.promises || {};
  const n = (title) => ({ type: 'integer', minimum: 0, maximum: 500, title });
  const counts = Object.fromEntries(Object.entries(countProps(cfg, n)).map(([k, v]) => [k, { ...v, title: `${v.title} (optional)` }]));
  const pass = (keys) => Object.fromEntries(keys.map((k) => [k, `$inputs.${k}`]));
  return {
    id: `${id}.estimate`,
    title: 'Window count estimate',
    promise: P.estimate,
    minutes: 5,
    tier: 'builder',
    job: 'sales',
    inputs: {
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'string', maxLength: 80, title: 'Customer name' },
        customerContact: { type: 'string', maxLength: 160, title: 'Their email or phone (optional)' },
        address: { type: 'string', maxLength: 200, title: 'Address (optional)', description: 'Printed on the estimate sheet' },
        ...counts,
        sides: { type: 'string', enum: Object.keys(est.SIDES), default: 'Inside and out', title: 'Sides' },
        frequency: { type: 'string', enum: Object.keys(est.FREQUENCY), default: 'One time', title: 'How often', description: 'A plan takes its discount off every visit' },
        deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50"' },
        payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
        city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)', description: 'Printed on the estimate sheet' },
        link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
        color: { type: 'string', maxLength: 7, title: 'Brand color hex (optional)', description: 'Like #1F7A5C. We pick one if you leave it empty.' },
      },
    },
    steps: [
      { id: 'estimate', tool: tool.name, input: pass(['customer', 'address', ...Object.keys(counts), 'sides', 'frequency', 'city', 'business', 'phone', 'link', 'color']) },
      { id: 'quote', tool: 'sales.quote', input: { items: '$estimate.items', customer: { name: '$inputs.customer', contact: '$inputs.customerContact', address: '$inputs.address' }, title: '$estimate.title', notes: '$estimate.notes', validDays: cfg.prices.estimate.valid_days || 30, deposit: '$inputs.deposit', payLink: '$inputs.payLink', contact: '$estimate.contactLine', from: { name: '$inputs.business' } } },
      { id: 'won', approve: { title: 'Did they say yes?', note: 'Pick yes when they book, and the invoice is made from this quote.', choose: '$estimate.next', label: 'label', max: 1 } },
      { id: 'invoice', tool: 'sales.invoice', when: '$won.chosen.0.invoice', input: { quote: '$quote', payLink: '$inputs.payLink' } },
    ],
    result: ['estimate', 'quote', 'invoice'],
    next: [
      { id: `${id}.won`, why: 'They booked: the booking text, prep text and job sheet.' },
      { id: `${id}.keep`, why: 'After the job: thank-you, review ask and the spring and fall plan.' },
    ],
  };
}

module.exports = { countEstimateTool, estimateWorkflow };
