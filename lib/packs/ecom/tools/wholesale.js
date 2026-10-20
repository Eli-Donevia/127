// Wholesale pitch kit for local shops: a printable line sheet (products, retail and wholesale price,
// case pack, your terms), an order form CSV, and a pitch email for each shop the member names or found
// with Your first 25 (their Pipeline), ending with their name, shop, address line and a "no thanks"
// opt-out. Wholesale defaults to half of retail, the common keystone habit; the member can set their own.

const { views, save, files, money, text, time } = require('../../_kit');
const O = require('../../_kit/outreach');
const C = require('../../_kit/common');
const U = require('../lib/util');
const S = require('../lib/store');

const { usd, num } = money;
const { plain } = text;

// "Lavender candle | LAV-8 | 28 | 6 | 8 oz amber jar" -> { name, sku, retail, pack, note }
function productsOf(s) {
  const isNum = (x) => /^\$?\d+(?:\.\d+)?$/.test(x);
  const isSku = (x) => /^[A-Z0-9][A-Z0-9-]{2,}$/i.test(x) && /[A-Z]/i.test(x) && /[\d-]/.test(x) && !/\s/.test(x);
  return String(s || '')
    .split(/\r?\n/)
    .map((l) => (/[|\t]/.test(l) ? l.split(/\s*[|\t]\s*/) : l.split(/\s*,\s*/)).map((x) => plain(x)).filter(Boolean))
    .filter((p) => p[0])
    .slice(0, 40)
    .map((p, i) => {
      const rest = p.slice(1);
      const sku = rest.find(isSku) || `SKU-${i + 1}`;
      const n = rest.filter(isNum).map((x) => num(x));
      const note = rest.filter((x) => x !== sku && !isNum(x)).join(', ');
      return { name: p[0], sku, retail: n[0] != null ? n[0] : null, pack: n[1] != null ? Math.max(1, Math.round(n[1])) : 6, note };
    });
}

function lineSheet(f, items) {
  const e = U.esc;
  const rows = items.map((it) => `<tr><td><b>${e(it.name)}</b>${it.note ? `<br><span class="small muted">${e(it.note)}</span>` : ''}</td><td>${e(it.sku)}</td><td class="n">${usd(it.wholesale, { cents: true })}</td><td class="n">${usd(it.retail, { cents: true })}</td><td class="n">${it.pack}</td><td class="n"><span class="blank" style="min-width:50px"></span></td></tr>`).join('');
  const body = `<div class="band"><h1>${e(f.shop)}</h1><p>Wholesale line sheet${f.what ? `: ${e(f.what)}` : ''}. ${e(time.longDate(f.today))}.</p></div>
<div class="wrap"><table><tr><th>Product</th><th>SKU</th><th class="n">Wholesale</th><th class="n">Suggested retail</th><th class="n">Case pack</th><th class="n">Cases</th></tr>${rows}</table></div>
<h2>Terms</h2><ul>${U.li([`First order minimum: ${f.min}`, `Reorders: ${f.reorder}`, `Payment: ${f.payment}`, `Ships within ${f.lead} business days of the order`, f.consign ? `Consignment welcome: ${f.consign}` : ''])}</ul>
<h2>Order</h2><div class="card"><p>Shop name <span class="blank" style="min-width:220px"></span></p><p>Contact and email <span class="blank" style="min-width:220px"></span></p><p>Ship to <span class="blank" style="min-width:260px"></span></p></div>
<p>${e([f.first, f.email, f.phone, f.link].filter(Boolean).join(' . '))}</p>`;
  return U.page({ title: `${f.shop} line sheet`, seed: f.color, body });
}

function pitch(f, shopName, items) {
  const two = items.slice(0, 2).map((i) => i.name.toLowerCase());
  const hi = shopName ? `Hi ${shopName} team,` : 'Hi [Shop name] team,';
  const body = [
    hi,
    '',
    `I'm ${f.first || '[your name]'}, and I make ${f.what || 'small-batch goods'}${f.area ? ` here in ${f.area}` : ''}. I think ${two.length ? text.list(two) : 'my pieces'} would sit well on your shelves, and I've attached my line sheet with wholesale prices.`,
    '',
    `Wholesale runs at about half of retail, with a ${f.min} first order. ${f.consign ? 'I also work on consignment if you would rather start that way. ' : ''}I'm happy to drop off samples so you can see them in person.`,
    '',
    'Would a short visit next week work?',
    '',
    [f.first, f.shop, O.ADDRESS_HOLD].filter(Boolean).join('\n'),
    '',
    O.optOut('carrying my products in your shop'),
  ].join('\n');
  return { to: shopName || '[Shop name]', subject: `${f.shop}: wholesale line sheet${f.area ? ` from a ${f.area} maker` : ''}`, email: body };
}

module.exports = {
  name: 'ecom.wholesale_kit',
  title: 'Make your wholesale kit',
  description: 'A printable wholesale line sheet with your prices and terms, an order form CSV, and a pitch email for each local shop you name or found with Your first 25, ending with your address line and an opt-out.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    required: ['products'],
    properties: {
      products: { type: 'string', format: 'textarea', maxLength: 4000, title: 'Your products, one per line', description: 'Name | SKU | retail price | case pack | note, like "Lavender candle | LAV-8 | 28 | 6 | 8 oz amber jar"' },
      share: { type: 'number', minimum: 30, maximum: 70, default: 50, title: 'Wholesale as a percent of retail', description: 'Many shops expect about 50' },
      min: { type: 'string', maxLength: 60, default: '$150', title: 'First order minimum' },
      reorder: { type: 'string', maxLength: 60, default: '$100, any mix', title: 'Reorder minimum' },
      payment: { type: 'string', maxLength: 80, default: 'Paid in full before shipping', title: 'Payment terms' },
      lead: { type: 'integer', minimum: 1, maximum: 60, default: 7, title: 'Business days to ship an order' },
      consign: { type: 'string', maxLength: 120, title: 'Consignment terms (optional)', description: 'Like "60/40 split, paid monthly"' },
      shops: { type: 'string', format: 'textarea', maxLength: 1500, title: 'Shops to pitch (optional)', description: 'One per line. Leave empty to use the shops in your Pipeline from Your first 25.' },
      shop: { type: 'string', maxLength: 80, title: 'Your shop name' },
      what: { type: 'string', maxLength: 80, title: 'What you make' },
      email: { type: 'string', maxLength: 120, title: 'Your email (optional)' },
      phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      link: { type: 'string', maxLength: 200, title: 'Your shop link (optional)' },
      color: { type: 'string', maxLength: 7, title: 'Brand color (optional)' },
    },
  },
  output: { type: 'object', required: ['items', 'pitches'], properties: { items: { type: 'array' }, pitches: { type: 'array' }, sheet: { type: 'object' }, form: { type: 'object' }, notes: { type: 'array' } } },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    const share = Math.min(0.7, Math.max(0.3, num(input.share, 50) / 100));
    const items = productsOf(input.products).map((it) => ({ ...it, wholesale: it.retail != null ? Math.round(it.retail * share * 2) / 2 : null }));
    const skipped = items.filter((i) => i.retail == null).map((i) => i.name);
    const good = items.filter((i) => i.retail != null);
    if (!good.length) throw new Error('Add at least one product with a retail price, like "Lavender candle | LAV-8 | 28 | 6".');
    const f = { ...m, shop: m.shop || 'My shop', min: plain(input.min || '$150'), reorder: plain(input.reorder || '$100, any mix'), payment: plain(input.payment || 'Paid in full before shipping'), lead: input.lead || 7, consign: plain(input.consign || ''), phone: plain(input.phone || ''), color: input.color, today: time.today(ctx) };
    let names = C.linesOf(input.shops, 10);
    let fromPipeline = false;
    if (!names.length) {
      const leads = await C.everyone(ctx);
      names = leads.filter((l) => l.pack === 'ecom' && l.company && !(l.data && l.data.sample) && l.stage !== 'lost').map((l) => plain(l.company)).slice(0, 10);
      fromPipeline = names.length > 0;
    }
    const pitches = (names.length ? names : ['']).map((n) => pitch(f, n, good));
    const sheet = await save.saveFile(ctx, save.fileName(f.shop, 'line sheet', '.html'), lineSheet(f, good));
    const form = await save.saveFile(ctx, save.fileName(f.shop, 'wholesale order form', '.csv'), files.csv(good.map((i) => ({ ...i, cases: '', total: '' })), [
      { key: 'name', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'wholesale', label: 'Wholesale price' },
      { key: 'retail', label: 'Suggested retail' },
      { key: 'pack', label: 'Case pack' },
      { key: 'cases', label: 'Cases' },
      { key: 'total', label: 'Line total' },
    ]));
    const notes = [
      `Wholesale at ${Math.round(share * 100)}% of retail. Shops often double what they pay to set their price, which is why many ask for about half. Ask each shop what they need before you print.`,
      fromPipeline ? `Pitches for the ${names.length} shops in your Pipeline from Your first 25.` : names.length ? '' : 'No shops named, so the email has [Shop name] to fill in. Run Your first 25 to list shops near you.',
      skipped.length ? `Left off (no retail price): ${skipped.join(', ')}.` : '',
      'Each email ends with your address line and an opt-out, as marketing email must.',
    ].filter(Boolean);
    return { items: good, pitches, sheet, form, notes };
  },
  view(out) {
    return views.blocks(
      views.metric('Wholesale kit', `${out.items.length} products`, `${out.pitches.length} pitch email${out.pitches.length === 1 ? '' : 's'}`),
      views.table([{ key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'wholesale', label: 'Wholesale', format: 'money' }, { key: 'retail', label: 'Retail', format: 'money' }, { key: 'pack', label: 'Case pack', format: 'number' }], out.items),
      ...out.pitches.map((p) => views.copy(`Email to ${p.to}`, `Subject: ${p.subject}\n\n${p.email}`)),
      views.text(out.notes.join(' ')),
      views.file(out.sheet, 'Line sheet (HTML, prints on one page)'),
      views.file(out.form, 'Order form (CSV)'),
    );
  },
};
