// Returns and shipping policy draft from the member's own choices, as plain text to paste and a
// printable page. It says to check it against Shopify's or Etsy's rules and the member's state's laws,
// and that it isn't legal advice. The ship-time lines follow the FTC Mail Order Rule (data/policy.json).

const { views, save, text } = require('../../_kit');
const U = require('../lib/util');
const S = require('../lib/store');
const P = require('../data/policy.json');

const { plain } = text;

function draft(f) {
  const returns = [
    `Returns and refunds at ${f.shop}`,
    f.days > 0
      ? `You can return ${f.condition === 'any' ? 'any item' : 'unused items in their original condition'} within ${f.days} days of delivery.`
      : 'All sales are final, except for items that arrive damaged or wrong.',
    f.days > 0 ? `To start a return, email ${f.email || '[your support email]'} with your order number. ${f.return_ship === 'seller' ? "We'll send you a prepaid return label." : 'Return shipping is paid by the buyer, and we suggest a tracked service.'}` : '',
    f.days > 0 ? `Once the item arrives back, we refund ${f.refund_to === 'credit_or_refund' ? 'to your original payment, or as store credit if you ask for it' : 'to your original payment method'} within ${f.refund_days} days.` : '',
    f.exchanges ? 'Need a different size or color? Ask for an exchange the same way, and we will ship the new one when the return is on its way.' : '',
    f.final ? `These can't be returned: ${f.final}.` : '',
    `If your order arrives damaged or wrong, email a photo within ${f.damage_days} days of delivery and we'll replace it or refund it in full, including shipping.`,
  ].filter(Boolean);
  const shipping = [
    `Shipping at ${f.shop}`,
    `Orders ship within ${f.process} business days of payment${f.carriers ? `, by ${f.carriers}` : ''}.`,
    `We ship to ${f.regions}. ${f.ship_price}`,
    'You get a tracking link by email as soon as your order ships.',
    "If we can't ship your order in that time, we'll email you right away and you can choose to wait or cancel for a full refund.",
    f.international ? 'Orders outside the United States may owe import duties or taxes when they arrive. Those are set by the destination country and paid by the buyer.' : '',
  ].filter(Boolean);
  return { returns, shipping };
}

function html(f, d) {
  const e = U.esc;
  const sec = (lines) => `<div class="card"><h2>${e(lines[0])}</h2>${lines.slice(1).map((l) => `<p>${e(l)}</p>`).join('')}</div>`;
  const body = `<div class="band"><h1>${e(f.shop)}: returns and shipping</h1><p>${e(P.not_advice)}</p></div>
${sec(d.returns)}${sec(d.shipping)}
<h2>Before you publish</h2><ul class="checks">${U.li(P.checks)}</ul>
<h2>Sources (checked ${e(P.checked)})</h2><ul>${P.sources.map((s) => `<li><a href="${e(s.url)}">${e(s.label)}</a>: ${e(s.says)}</li>`).join('')}</ul>`;
  return U.page({ title: `${f.shop} returns and shipping`, seed: f.color, body });
}

module.exports = {
  name: 'ecom.policy_draft',
  title: 'Draft your store policies',
  description: "A returns and refunds policy and a shipping policy from your own choices, ready to paste into Shopify or Etsy, with what to check against the platform's rules first. A starting draft, not legal advice.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      shop: { type: 'string', maxLength: 80, title: 'Shop name' },
      email: { type: 'string', maxLength: 120, title: 'Support email' },
      days: { type: 'integer', minimum: 0, maximum: 365, default: 30, title: 'Days to return (0 for final sale)' },
      condition: { type: 'string', enum: ['unused', 'any'], default: 'unused', title: 'What can come back' },
      return_ship: { type: 'string', enum: ['buyer', 'seller'], default: 'buyer', title: 'Who pays return shipping' },
      refund_to: { type: 'string', enum: ['original', 'credit_or_refund'], default: 'original', title: 'Refund to' },
      refund_days: { type: 'integer', minimum: 1, maximum: 30, default: 5, title: 'Days to refund once it is back' },
      exchanges: { type: 'boolean', default: true, title: 'Offer exchanges' },
      final: { type: 'string', maxLength: 200, title: 'Items that are final sale (optional)', description: 'Like "personalized items and gift cards"' },
      damage_days: { type: 'integer', minimum: 1, maximum: 60, default: 7, title: 'Days to report damage' },
      process: { type: 'string', maxLength: 10, default: '1 to 3', title: 'Business days to ship', description: 'One you can keep on a busy week' },
      carriers: { type: 'string', maxLength: 80, title: 'Carriers (optional)', description: 'Like "USPS Ground Advantage"' },
      regions: { type: 'string', maxLength: 120, default: 'all 50 US states', title: 'Where you ship' },
      ship_price: { type: 'string', maxLength: 160, title: 'Shipping price, in one line (optional)', description: 'Like "Shipping is a flat $6, free on orders over $50."' },
      international: { type: 'boolean', default: false, title: 'You ship outside the US' },
      color: { type: 'string', maxLength: 7, title: 'Brand color (optional)' },
    },
  },
  output: { type: 'object', required: ['returns', 'shipping', 'checks'], properties: { returns: { type: 'string' }, shipping: { type: 'string' }, checks: { type: 'array' }, sources: { type: 'array' }, file: { type: 'object' }, note: { type: 'string' } } },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    const f = {
      shop: m.shop || 'our shop',
      email: plain(input.email || ''),
      days: Number.isInteger(input.days) ? input.days : 30,
      condition: input.condition || 'unused',
      return_ship: input.return_ship || 'buyer',
      refund_to: input.refund_to || 'original',
      refund_days: input.refund_days || 5,
      exchanges: input.exchanges !== false,
      final: plain(input.final || ''),
      damage_days: input.damage_days || 7,
      process: plain(input.process || '1 to 3'),
      carriers: plain(input.carriers || ''),
      regions: plain(input.regions || 'all 50 US states'),
      ship_price: input.ship_price ? U.scrub(plain(input.ship_price), '') || plain(input.ship_price) : 'Shipping is shown at checkout.',
      international: !!input.international,
      color: input.color,
    };
    const d = draft(f);
    const file = await save.saveFile(ctx, save.fileName(f.shop, 'returns and shipping', '.html'), html(f, d));
    return { returns: d.returns.join('\n\n'), shipping: d.shipping.join('\n\n'), checks: P.checks, sources: P.sources.map((s) => ({ label: s.label, url: s.url })), file, note: P.not_advice };
  },
  view(out) {
    return views.blocks(
      views.text(out.note),
      views.copy('Returns and refunds policy', out.returns),
      views.copy('Shipping policy', out.shipping),
      views.text(`Before you publish: ${out.checks.join(' ')}`),
      ...out.sources.map((s) => views.link(s.label, s.url)),
      views.file(out.file, 'Both policies, printable (HTML)'),
    );
  },
};
