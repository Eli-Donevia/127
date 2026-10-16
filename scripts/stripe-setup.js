#!/usr/bin/env node
// One-command Stripe setup for 127. Safe to run again: it finds what exists and
// only creates what's missing.
//
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup -- --webhook-url https://127group.io/billing/webhook
//
// Creates: the Builder and Founder's Circle products, the $29, $19 founding and
// $299 monthly prices (found by lookup key, so no price IDs go in Secrets), the
// founding referral coupon (first month free), and a customer portal setup.
// Reports Stripe Tax status. It never changes tax registrations.
//
// Flags:
//   --live                 required to run against a live key
//   --webhook-url URL      also create the webhook endpoint and print its signing secret
//   --tax-code txcd_...    product tax code (pick one from https://docs.stripe.com/tax/tax-codes)
//   --tax-behavior B       exclusive (tax added on top, the US norm; default) or inclusive

const Stripe = require('stripe');
const { PLANS } = require('../lib/plans');

const LOOKUP = { builder: 'builder_monthly', founding: 'builder_founding_monthly', circle: 'circle_monthly' };
const REFERRAL_COUPON = 'founding-referral';
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}
const flag = (name) => process.argv.includes(`--${name}`);

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Set STRIPE_SECRET_KEY first.');
  const live = /^[sr]k_live_/.test(key);
  if (live && !flag('live')) throw new Error('That is a live key. Re-run with --live once test mode works.');
  const taxBehavior = arg('tax-behavior') || 'exclusive';
  if (!['exclusive', 'inclusive'].includes(taxBehavior)) throw new Error('--tax-behavior must be exclusive or inclusive');
  const taxCode = arg('tax-code');
  if (taxCode && !/^txcd_\d{8}$/.test(taxCode)) throw new Error('--tax-code looks wrong (expected txcd_ and 8 digits)');
  const foundingPrice = Number(process.env.FOUNDING_PRICE || 19);

  const s = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: '127 setup' } });
  const acct = await s.accounts.retrieve();
  console.log(`Stripe account ${acct.id} (${acct.business_profile && acct.business_profile.name || 'no name'}), ${live ? 'LIVE' : 'test'} mode\n`);

  // Products: one per plan, so checkout and invoices show the plan name.
  const products = {};
  for (const [k, p] of [['builder', PLANS.builder], ['circle', PLANS.circle]]) {
    const id = `127_${k}`;
    let prod = await s.products.retrieve(id).catch((e) => (e.code === 'resource_missing' ? null : Promise.reject(e)));
    const fields = { name: p.name, description: p.tagline, metadata: { app: '127', tier: k }, ...(taxCode ? { tax_code: taxCode } : {}) };
    if (!prod) {
      prod = await s.products.create({ id, ...fields });
      console.log(`+ product ${p.name} (${id})`);
    } else {
      prod = await s.products.update(id, { ...fields, active: true });
      console.log(`= product ${p.name} (${id})`);
    }
    products[k] = prod;
  }

  // Prices, found by lookup key. Prices can't change amount, so a mismatch
  // gets a new price and the lookup key moves to it.
  const wanted = [
    ['builder', products.builder.id, PLANS.builder.price, 'Builder'],
    ['founding', products.builder.id, foundingPrice, 'Builder (founding, locked)'],
    ['circle', products.circle.id, PLANS.circle.price, "Founder's Circle"],
  ];
  const priceIds = {};
  for (const [k, product, dollars, nickname] of wanted) {
    const amount = Math.round(dollars * 100);
    const { data } = await s.prices.list({ lookup_keys: [LOOKUP[k]], active: true, limit: 1 });
    const cur = data[0];
    if (cur && cur.unit_amount === amount && cur.product === product && cur.recurring && cur.recurring.interval === 'month' && cur.tax_behavior === taxBehavior) {
      priceIds[k] = cur.id;
      console.log(`= price ${nickname} $${dollars}/mo (${cur.id})`);
      continue;
    }
    const price = await s.prices.create({
      product,
      currency: 'usd',
      unit_amount: amount,
      recurring: { interval: 'month' },
      lookup_key: LOOKUP[k],
      transfer_lookup_key: true,
      tax_behavior: taxBehavior,
      nickname,
      metadata: { app: '127', tier: k === 'founding' ? 'builder' : k, founding: k === 'founding' ? '1' : '' },
    });
    if (cur) await s.prices.update(cur.id, { active: false });
    priceIds[k] = price.id;
    console.log(`+ price ${nickname} $${dollars}/mo (${price.id})${cur ? ` replaces ${cur.id}` : ''}`);
  }

  // Founding referral reward: first month free, founding Builder price only.
  let coupon = await s.coupons.retrieve(REFERRAL_COUPON).catch((e) => (e.code === 'resource_missing' ? null : Promise.reject(e)));
  if (!coupon) {
    coupon = await s.coupons.create({
      id: REFERRAL_COUPON,
      name: 'Founding referral: first month free',
      percent_off: 100,
      duration: 'once',
      applies_to: { products: [products.builder.id] },
      metadata: { app: '127' },
    });
    console.log(`+ coupon ${coupon.name} (${coupon.id})`);
  } else console.log(`= coupon ${coupon.name} (${coupon.id})`);

  // Customer portal: card, invoices, cancel at period end. Plan switches stay in
  // the app, because Circle needs an approved application and a free seat.
  const portalFeatures = {
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
    subscription_update: { enabled: false },
  };
  const base = process.env.BASE_URL || 'https://127group.io';
  const portalBody = {
    business_profile: { headline: '127: manage your membership', privacy_policy_url: `${base}/privacy`, terms_of_service_url: `${base}/terms` },
    features: portalFeatures,
    default_return_url: `${base}/app/billing`,
    metadata: { app: '127' },
  };
  const configs = await s.billingPortal.configurations.list({ active: true, limit: 20 });
  let portal = configs.data.find((c) => c.metadata && c.metadata.app === '127');
  if (portal) {
    portal = await s.billingPortal.configurations.update(portal.id, portalBody);
    console.log(`= customer portal (${portal.id}${portal.is_default ? ', default' : ''})`);
  } else {
    portal = await s.billingPortal.configurations.create(portalBody);
    console.log(`+ customer portal (${portal.id}${portal.is_default ? ', default' : ''})`);
  }

  // Webhook endpoint (optional): the signing secret is only shown once.
  let webhookSecret = null;
  const url = arg('webhook-url');
  if (url) {
    if (!/^https:\/\//.test(url)) throw new Error('--webhook-url must be https');
    const { data } = await s.webhookEndpoints.list({ limit: 100 });
    const hook = data.find((w) => w.url === url);
    if (hook) {
      await s.webhookEndpoints.update(hook.id, { enabled_events: EVENTS, disabled: false });
      console.log(`= webhook ${url} (${hook.id}). Its signing secret was shown when it was created; roll it in the Dashboard if you lost it.`);
    } else {
      const created = await s.webhookEndpoints.create({ url, enabled_events: EVENTS, description: '127 membership billing', metadata: { app: '127' } });
      webhookSecret = created.secret;
      console.log(`+ webhook ${url} (${created.id})`);
    }
  }

  // Stripe Tax: report only.
  console.log('\nStripe Tax');
  try {
    const t = await s.tax.settings.retrieve();
    console.log(`  settings: ${t.status}${t.status !== 'active' ? ' (add a head office address in Dashboard > Tax > Settings)' : ''}`);
    const regs = await s.tax.registrations.list({ status: 'active', limit: 100 });
    if (!regs.data.length) console.log('  registrations: none active, so no tax is collected yet even with STRIPE_AUTOMATIC_TAX=true');
    for (const r of regs.data) console.log(`  registration: ${r.country}${r.country_options && r.country_options.us ? ' ' + (r.country_options.us.state || '') : ''} (${r.status})`);
    if (!taxCode) console.log('  product tax code: not set (account default applies). Pass --tax-code once you pick one.');
  } catch (e) {
    console.log(`  could not read tax settings: ${e.message}`);
  }

  console.log('\nAdd to Replit Secrets:');
  console.log(`  STRIPE_SECRET_KEY=${live ? 'sk_live_...' : 'sk_test_...'}   (your key; never paste it into code)`);
  console.log(`  STRIPE_WEBHOOK_SECRET=${webhookSecret || 'whsec_...  (from the webhook endpoint)'}`);
  if (!portal.is_default) console.log(`  STRIPE_PORTAL_CONFIGURATION=${portal.id}`);
  console.log('\nOptional (the app finds prices by lookup key without these):');
  console.log(`  STRIPE_PRICE_BUILDER=${priceIds.builder}\n  STRIPE_PRICE_BUILDER_FOUNDING=${priceIds.founding}\n  STRIPE_PRICE_CIRCLE=${priceIds.circle}`);
}

main().catch((e) => {
  console.error(`\nStripe setup failed: ${e.message}`);
  process.exit(1);
});
