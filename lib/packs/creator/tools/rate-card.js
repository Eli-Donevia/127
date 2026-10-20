// Rate card from the member's own numbers: what an hour of their time is worth to them, the hours
// each deliverable takes them, and their costs. Price = hours x hourly + costs, rounded up to $5.
// Add-ons (usage rights, exclusivity, rush) are their percentages; the starting points are labeled as
// ours to change. No market rates, no "creators your size charge", no promise of what a brand pays.

const { views, save, files, time, text } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;
const { esc } = U;

const DEFAULT_ITEMS = 'Instagram Reel | 4 | 0\nInstagram Stories (3) | 1.5 | 0\nTikTok video | 4 | 0\nYouTube mention (60 seconds) | 5 | 0\nNewsletter mention | 1 | 0\nVideo for the brand to post (no posting by me) | 3 | 0';
const up5 = (n) => Math.ceil(n / 5) * 5;
const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function itemsOf(v) {
  return K.C.linesOf(v || DEFAULT_ITEMS, 12).map((l) => {
    const [what, hours, cost] = l.split(/\s*\|\s*/);
    return { what: plain(what), hours: num(hours), cost: num(cost) || 0 };
  }).filter((x) => x.what && x.hours);
}

module.exports = {
  name: 'creator.rate_card',
  title: 'Build your rate card',
  description: 'Prices for each thing you make, from your own hourly number, the hours it takes you and your costs, with add-ons for usage rights, exclusivity and rush. A printable card and a CSV.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['hourly'],
    properties: {
      hourly: { type: 'number', minimum: 5, maximum: 1000, title: 'What an hour of your time is worth to you ($)', description: 'Your number. Think of what you earn per hour at your day job, or would want to.' },
      items: { type: 'string', format: 'textarea', maxLength: 1500, title: 'What you make, hours, costs', description: 'One per line: name | hours it takes you (idea, filming, editing, back-and-forth) | costs in $ (props, travel). Leave empty for a starting list.', default: DEFAULT_ITEMS },
      usage_pct: { type: 'number', minimum: 0, maximum: 300, default: 30, title: 'Usage rights add-on, % per 30 days', description: 'When the brand runs your video as an ad or on its own pages' },
      exclusive_pct: { type: 'number', minimum: 0, maximum: 300, default: 20, title: 'Exclusivity add-on, % per 30 days', description: 'When you agree not to work with their competitors' },
      rush_pct: { type: 'number', minimum: 0, maximum: 300, default: 25, title: 'Rush add-on, %', description: 'Live in under 5 days' },
      bundle_pct: { type: 'number', minimum: 0, maximum: 50, default: 0, title: 'Bundle discount, % (optional)', description: 'Off when a brand books 3 or more' },
      name: { type: 'string', maxLength: 80, title: 'Your name (optional)' },
      color: { type: 'string', maxLength: 7, title: 'Your color (optional)' },
    },
  },
  output: { type: 'object', required: ['rows', 'addons'], properties: { hourly: { type: 'number' }, rows: { type: 'array' }, addons: { type: 'array' }, bundle_pct: { type: 'number' }, files: { type: 'array' }, notes: { type: 'array' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const hourly = num(input.hourly);
    if (!hourly) throw new Error('Add what an hour of your time is worth to you, in dollars.');
    const items = itemsOf(input.items);
    if (!items.length) throw new Error('Add at least one thing you make, like "Instagram Reel | 4 | 0".');
    const rows = items.map((x) => {
      const labor = x.hours * hourly;
      return { what: x.what, hours: x.hours, cost: Math.round(x.cost * 100) / 100, labor: Math.round(labor * 100) / 100, price: up5(labor + x.cost) };
    });
    const pct = (k, d) => {
      const n = num(input[k]);
      return n == null ? d : n;
    };
    const addons = [
      { what: 'Usage rights (per 30 days)', pct: pct('usage_pct', 30), note: 'The brand runs your content as an ad or on its own pages' },
      { what: 'Exclusivity (per 30 days)', pct: pct('exclusive_pct', 20), note: 'You skip their competitors for that time' },
      { what: 'Rush (live in under 5 days)', pct: pct('rush_pct', 25), note: 'Less time to plan and film' },
    ].filter((a) => a.pct > 0).map((a) => ({ ...a, example: up5((rows[0].price * a.pct) / 100), on: rows[0].what }));
    const bundle = pct('bundle_pct', 0);
    const notes = [];
    if (addons.some((a) => a.pct === { 'Usage rights (per 30 days)': 30, 'Exclusivity (per 30 days)': 20, 'Rush (live in under 5 days)': 25 }[a.what])) notes.push('Add-on percentages of 30, 20 and 25 are our starting points, not a market rate. Change them to yours.');
    notes.push('These are your prices from your own hours and costs. No one can say what a given brand will pay: ask what budget they have, then say what fits it.');
    const name = m.name || 'Rate card';
    const fmt = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const body = [
      `<div class="band"><h1>${esc(name)}</h1><p>Rates as of ${esc(time.longDate(time.today(ctx)))}</p></div>`,
      `<h2>Rates</h2><div class="wrap"><table><tr><th>What I make</th><th class="n">Price</th></tr>${rows.map((r) => `<tr><td>${esc(r.what)}</td><td class="n">${fmt(r.price)}</td></tr>`).join('')}</table></div>`,
      addons.length ? `<h2>Add-ons</h2><div class="wrap"><table><tr><th>Add-on</th><th class="n">Added</th></tr>${addons.map((a) => `<tr><td>${esc(a.what)}<br><span class="muted small">${esc(a.note)}</span></td><td class="n">+${a.pct}%</td></tr>`).join('')}</table></div>` : '',
      bundle > 0 ? `<p>Book 3 or more: ${bundle}% off the total.</p>` : '',
      '<p class="muted small">Prices are per piece and include one round of changes. Paid partnerships are marked as ads.</p>',
    ].join('\n');
    const html = U.page({ title: `${name} rates`, seed: input.color, body, description: 'Rate card' });
    const today = time.today(ctx);
    const card = await save.saveFile(ctx, save.fileName(name, 'rate card', today, '.html'), html);
    const csv = await save.saveFile(ctx, save.fileName(name, 'rate card math', today, '.csv'), files.csv(rows, [
      { key: 'what', label: 'What you make' },
      { key: 'hours', label: 'Your hours' },
      { key: 'labor', label: 'Hours x your hourly' },
      { key: 'cost', label: 'Your costs' },
      { key: 'price', label: 'Price (rounded up to $5)' },
    ]));
    return { hourly, rows, addons, bundle_pct: bundle, files: [card, csv], notes };
  },
  view(out) {
    return views.blocks(
      views.metric('Your rate card', `${out.rows.length} prices`, `From your $${out.hourly} an hour and the hours each takes you`),
      views.table([{ key: 'what', label: 'What you make' }, { key: 'hours', label: 'Hours' }, { key: 'cost', label: 'Costs' }, { key: 'price', label: 'Price' }], out.rows),
      out.addons.length ? views.table([{ key: 'what', label: 'Add-on' }, { key: 'pct', label: '%' }, { key: 'example', label: 'On the first item' }], out.addons) : null,
      views.text(out.notes.join(' ')),
      views.file(out.files[0], 'Rate card (printable page)'),
      views.file(out.files[1], 'How each price was worked out (CSV)'),
    );
  },
};
