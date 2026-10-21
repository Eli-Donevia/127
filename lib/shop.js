// Packs: bundles of Store items (and the Motion Pack's own files) sold one time, behind SHOP_PACKS (default off).
// Eli, Oct 21 ("do both"): Builder keeps every Store item, and each pack is also sold on its own page with a one-tap
// Stripe Checkout for people not ready to subscribe. The catalog is content/shop/packs.json; Store items stay in
// content/templates (lib/store.js) and are only listed here by id, so a pack never copies a file.
//
// SHOP_PACKS: "on" shows /packs, the pack pages and the homepage row to everyone; "admins" to ADMIN_EMAILS only (to
// try it on the live site before Legal clears it); off or unset: every /packs page 404s and the homepage row is gone.
//
// Who owns a pack: anyone signed in owns a free one (the Starter Pack); Builder and Circle own every pack while
// packs.json's builderGets is "all"; a buyer owns what they paid for (packPurchases, by user id, by verified email,
// or with the private link from the receipt, so a guest needs no account). A refunded purchase stops counting.
//
// Payments: Checkout in payment mode, prices found by lookup key (pack_<slug>, made by npm run stripe:setup). The
// success page confirms the session at once; the webhook (lib/billing.js) is the backstop. No Stripe key: in dev with
// DEMO_BILLING=true a purchase is recorded straight away; otherwise checkout says payments aren't on yet.

const fs = require('fs');
const path = require('path');
const db = require('./db');
const security = require('./security');
const { canAccess } = require('./plans');
const { emit, sendEmail } = require('./integrations');
const store = require('./store');
const flags = require('./harness/flags');

const DIR = path.join(__dirname, '..', 'content', 'shop');
const CATALOG_FILE = path.join(DIR, 'packs.json');
const KITS_DIR = path.join(DIR, 'files');
const COLLECTION = 'packPurchases';
const SLUG = /^[a-z][a-z0-9-]{1,30}$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
// Checkout and receipt wording, as Legal wrote it (L86, legal/handoffs/packs.md P1, P2 and P4).
const CHECKOUT_SUBMIT = 'One payment, no subscription. Keep the files and use them in your own business and for your clients. 14 days to change your mind.';
const CHECKOUT_TERMS = "I agree to 127's [Terms of Service](https://127group.io/terms), including the pack license (Section 11) and refunds (Section 5A).";
const LICENSE_LINE = "Use them in your own business and for your clients. Please don't resell or share the files themselves.";
const INTEGRATION_ID = 'pack-checkout';
// The receipt link's purchase key: 64 hex characters (security.token()).
const KEY = /^[a-f0-9]{64}$/;

class ShopUnavailable extends Error {}

function setting() {
  const v = String(process.env.SHOP_PACKS || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}
function visibleTo(user) {
  const v = setting();
  return v === 'on' || (v === 'admins' && flags.admin(user));
}

// ---- catalog ------------------------------------------------------------------------------------------------------

let cache = null;
// A kit is a pack's own files (content/shop/files/<kit>/, listed in its manifest.json): the Motion Pack's moves, the
// AI Pack's prompt library, the Creator Kit's templates. Built by scripts/build-motion-pack.js and build-ai-pack.js.
const KIT = /^[a-z][a-z0-9-]{1,30}$/;
// A hand-written kit (Markdown files and no manifest.json) is listed from its files: the id is the file name, the
// title its first "# " line, the summary its first paragraph.
function kitManifest(kit) {
  if (!KIT.test(kit)) return [];
  const dir = path.join(KITS_DIR, kit);
  const f = path.join(dir, 'manifest.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /\.md$/.test(n) && n !== 'README.md').sort().map((n) => {
    const text = fs.readFileSync(path.join(dir, n), 'utf8');
    const title = (text.match(/^# (.+)$/m) || [null, n])[1].trim();
    const para = text.split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#')) || '';
    // The paragraph's first sentence, so a summary never stops mid-word; a very short one ("Work backwards from
    // Friday.") takes the next sentence along.
    const flat = para.replace(/\s+/g, ' ');
    const sentences = (flat.match(/\S.*?[.!?]["'”’)]*(?=\s+[A-Z0-9"“(]|\s*$)/g) || []).map((x) => x.trim());
    const summary = !sentences.length ? flat : sentences[0].length < 40 && sentences[1] ? `${sentences[0]} ${sentences[1]}` : sentences[0];
    return { id: n.replace(/\.md$/, ''), title, summary, file: n };
  });
}

// A course's HQ workflows (packs.json `hq`), by id from the harness registry: shown on its page as what runs in 127 HQ.
function workflow(id) {
  const harness = require('./harness');
  harness.init();
  const w = harness.packs.workflow(id);
  return w ? { id: w.id, title: w.title, tier: w.tier, minutes: w.minutes || null } : null;
}

// packs.json with each pack's contents resolved: Store items that are ready, and kit files that exist.
// `problems` lists ids that didn't resolve (test/shop.test.js keeps it empty).
function load() {
  const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  const lib = store.current();
  const problems = [];
  // Each vertical's niche pack (lib/verticals.js) joins the catalog unlisted: sold on its /for/<slug> page only.
  const packs = raw.packs.concat(require('./verticals').shopPacks()).map((p, i) => {
    if (!SLUG.test(p.slug)) problems.push(`bad slug ${p.slug}`);
    const items = (p.items || []).map((id) => {
      const item = lib.byId[id];
      if (!item || item.status !== 'ready') problems.push(`${p.slug}: ${id} isn't a ready Store item`);
      return item && item.status === 'ready' ? item : null;
    }).filter(Boolean);
    const kit = new Map(p.kit ? kitManifest(p.kit).map((m) => [m.id, m]) : []);
    const moves = (p.kitFiles || []).map((id) => {
      if (!kit.has(id)) problems.push(`${p.slug}: ${p.kit} file ${id} isn't built`);
      return kit.get(id) || null;
    }).filter(Boolean);
    const hq = (p.hq || []).map((id) => {
      const w = workflow(id);
      if (!w) problems.push(`${p.slug}: HQ workflow ${id} doesn't exist`);
      return w;
    }).filter(Boolean);
    const price = Number(p.price) || 0;
    return { ...p, price, free: !!p.free || price === 0, order: i, items, moves, hq };
  });
  const bundle = raw.bundle ? { ...raw.bundle, price: Number(raw.bundle.price) || 0, free: false, items: [], moves: [], bundle: true } : null;
  return { packs, bundle, builderGets: raw.builderGets === 'starter' ? 'starter' : 'all', memberCoupon: raw.memberCoupon || null, currency: raw.currency || 'usd', problems };
}
function catalog() {
  if (!cache) cache = load();
  return cache;
}
function _reset() {
  cache = null;
  priceCache.clear();
}

// A pack with only what's visible right now (an item behind its own flag, like SITE_MOTION, drops out while off).
function get(slug) {
  const c = catalog();
  if (c.bundle && slug === c.bundle.slug) return c.bundle;
  const p = c.packs.find((x) => x.slug === slug);
  if (!p) return null;
  const items = p.items.filter((i) => store.get(i.id));
  return { ...p, items, count: items.length + p.moves.length };
}
// The listed packs (/packs, the homepage row, the bundle page). Vertical packs are unlisted.
function list() {
  return catalog().packs.filter((p) => !p.unlisted).map((p) => get(p.slug));
}
const paid = () => list().filter((p) => !p.free);

// What the "every pack" bundle holds, for its page and its downloads.
function bundleContents() {
  return paid();
}
// Distinct files across packs: a Store item in two packs (the Hook Bank, say) counts once.
function fileCount(packs) {
  const seen = new Set();
  for (const p of packs) {
    for (const i of p.items) seen.add(`item:${i.id}`);
    for (const m of p.moves) seen.add(`${p.kit}:${m.id}`);
  }
  return seen.size;
}

// ---- ownership ----------------------------------------------------------------------------------------------------

function purchasesFor(user) {
  if (!user) return [];
  const email = user.emailVerified && user.email ? String(user.email).toLowerCase() : null;
  return db.filter(COLLECTION, (p) => !p.refundedAt && (p.userId === user.id || (email && p.email === email)));
}
function byKey(key) {
  if (!KEY.test(String(key || ''))) return null;
  const h = security.hash(key);
  const hit = db.find(COLLECTION, (p) => (p.keyHashes || []).some((k) => security.sameHash(k, h)));
  return hit && !hit.refundedAt ? hit : null;
}
const covers = (purchase, slug) => purchase.pack === slug || purchase.pack === 'all';
function memberGetsAll(user) {
  return catalog().builderGets === 'all' && !!user && canAccess(user, 'builder');
}

// opts.keys: purchase keys from the receipt link or this browser's session, for a buyer without an account.
function owns(user, slug, opts = {}) {
  const pack = get(slug);
  if (!pack) return false;
  if (pack.free && user) return true;
  if (memberGetsAll(user)) return true;
  if (purchasesFor(user).some((p) => covers(p, slug))) return true;
  return (opts.keys || []).some((key) => {
    const k = byKey(key);
    return !!(k && covers(k, slug));
  });
}
function ownedSlugs(user, opts = {}) {
  return list().filter((p) => owns(user, p.slug, opts)).map((p) => p.slug);
}

// ---- purchases ----------------------------------------------------------------------------------------------------

function baseUrl() {
  return (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
}
function packName(slug) {
  const p = get(slug);
  return p ? p.name : 'Your pack';
}

// A new private key for a purchase (stored hashed). The receipt email gets one; the thanks page gets its own, so a
// buyer whose webhook landed first still gets in.
async function addKey(purchase) {
  const key = security.token();
  purchase.keyHashes = (purchase.keyHashes || []).concat(security.hash(key)).slice(-5);
  await db.save(COLLECTION, purchase);
  return key;
}

// Records a paid purchase once (by Checkout Session id) and emails the private link. Returns { purchase, key, fresh }.
async function record({ sessionId, email, userId, pack, amount, currency, paymentIntent, demo, termsVersion = null, checkoutText = null, vertical }) {
  const existing = db.get(COLLECTION, sessionId);
  if (existing) return { purchase: existing, key: null, fresh: false };
  const key = security.token();
  const purchase = {
    id: sessionId,
    pack,
    email: email ? String(email).toLowerCase() : null,
    userId: userId && db.get('users', userId) ? userId : null,
    amount: Number(amount) || 0,
    currency: currency || 'usd',
    paymentIntent: paymentIntent || null,
    keyHashes: [security.hash(key)],
    paidAt: new Date().toISOString(),
    demo: !!demo,
    // What the buyer agreed to at checkout (Legal P4): the Terms version and the words shown by the button.
    termsVersion,
    checkoutText,
    // The vertical the buyer came in on (first touch, lib/verticals.js), for the verticals board.
    vertical: vertical || null,
  };
  await db.save(COLLECTION, purchase);
  const link = `${baseUrl()}/packs/${pack}/get?k=${key}`;
  if (purchase.email) {
    sendEmail({
      to: purchase.email,
      subject: `Your ${packName(pack)} is ready`,
      text: `Thanks for buying the ${packName(pack)}.\n\nYour files: ${link}\n\nKeep this email. The link is private and it's how you get back to your files. If you make a free 127 account with this email, the pack shows up there too.\n\n${LICENSE_LINE} You have 14 days to change your mind: reply to this email for a full refund.\n\n127`,
    });
  }
  // No email on the event: a guest buyer's address goes to no marketing tool without their opt-in (Legal P3).
  emit('pack.purchased', { userId: purchase.userId, pack, amount: purchase.amount, currency: purchase.currency, demo: purchase.demo });
  return { purchase, key, fresh: true, link };
}

function fromSession(cs) {
  const md = cs.metadata || {};
  return {
    sessionId: cs.id,
    email: (cs.customer_details && cs.customer_details.email) || cs.customer_email || null,
    userId: cs.client_reference_id || md.userId || null,
    pack: md.pack,
    vertical: md.vertical || null,
    amount: (cs.amount_total || 0) / 100,
    currency: cs.currency || 'usd',
    paymentIntent: typeof cs.payment_intent === 'string' ? cs.payment_intent : (cs.payment_intent && cs.payment_intent.id) || null,
    termsVersion: md.terms_version || null,
    checkoutText: md.consent === '1' ? `${CHECKOUT_TERMS}\n${CHECKOUT_SUBMIT}` : CHECKOUT_SUBMIT,
  };
}
const isPackSession = (cs) => !!cs && cs.mode === 'payment' && !!cs.metadata && cs.metadata.kind === 'pack' && (!!get(cs.metadata.pack));

// From the webhook (checkout.session.completed / async_payment_succeeded). Returns true when it was a pack session.
async function handleSession(cs) {
  if (!isPackSession(cs)) return false;
  if (['paid', 'no_payment_required'].includes(cs.payment_status)) await record(fromSession(cs));
  return true;
}

// From the webhook (charge.refunded): a full refund of a pack charge ends that purchase. Returns true when it matched.
async function handleRefund(charge) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent && charge.payment_intent.id;
  const purchase = pi ? db.find(COLLECTION, (p) => p.paymentIntent === pi) : null;
  if (!purchase) return false;
  if (charge.refunded && !purchase.refundedAt) {
    purchase.refundedAt = new Date().toISOString();
    await db.save(COLLECTION, purchase);
    emit('pack.refunded', { userId: purchase.userId, email: purchase.email, pack: purchase.pack, amount: (charge.amount_refunded || 0) / 100 });
  }
  return true;
}

// ---- checkout -----------------------------------------------------------------------------------------------------

const priceCache = new Map();
async function priceFor(s, pack) {
  const envKey = `STRIPE_PRICE_PACK_${pack.slug.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey]) return process.env[envKey];
  if (priceCache.has(pack.lookupKey)) return priceCache.get(pack.lookupKey);
  const res = await s.prices.list({ lookup_keys: [pack.lookupKey], active: true, limit: 1 });
  const id = res.data[0] ? res.data[0].id : null;
  if (id) priceCache.set(pack.lookupKey, id);
  return id;
}

// Returns the URL to send the buyer to: Stripe Checkout, or straight to their files when they already own the pack.
async function checkoutUrl(req, user, slug, opts = {}) {
  const billing = require('./billing');
  const pack = get(slug);
  if (!pack || pack.free) throw new ShopUnavailable('That pack is not for sale.');
  if (owns(user, slug)) return `/packs/${slug}/get`;
  const base = baseUrl();
  if (!billing.isLive()) {
    if (!billing.isDemo()) throw new ShopUnavailable('Payments are not switched on yet.');
    const r = await record({ sessionId: `demo_${security.token().slice(0, 24)}`, email: user ? user.email : opts.email || null, userId: user ? user.id : null, pack: slug, amount: pack.price, currency: catalog().currency, demo: true, vertical: opts.vertical });
    return `/packs/${slug}/get?k=${r.key}&bought=1`;
  }
  const s = billing.stripeClient();
  const price = await priceFor(s, pack);
  if (!price) throw new ShopUnavailable(`No Stripe price for ${pack.lookupKey}. Run npm run stripe:setup.`);
  const coupon = catalog().memberCoupon && user && canAccess(user, 'builder') ? catalog().memberCoupon : null;
  const from = opts.from || `/packs/${slug}`;
  const consent = billing.termsConsentOn();
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price, quantity: 1 }],
    ...(user && user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_creation: 'always', ...(user ? { customer_email: user.email } : {}) }),
    ...(user ? { client_reference_id: user.id } : {}),
    metadata: { kind: 'pack', pack: slug, userId: user ? user.id : '', terms_version: billing.TERMS_VERSION, consent: consent ? '1' : '', ...(opts.vertical ? { vertical: opts.vertical } : {}) },
    payment_intent_data: { metadata: { kind: 'pack', pack: slug } },
    invoice_creation: { enabled: true },
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: false }),
    ...(consent ? { consent_collection: { terms_of_service: 'required' } } : {}),
    custom_text: { submit: { message: CHECKOUT_SUBMIT }, ...(consent ? { terms_of_service_acceptance: { message: CHECKOUT_TERMS } } : {}) },
    ...(billing.taxOn() ? { automatic_tax: { enabled: true }, billing_address_collection: 'required', ...(user && user.stripeCustomerId ? { customer_update: { address: 'auto', name: 'auto' } } : {}) } : {}),
    integration_identifier: INTEGRATION_ID,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${base}/packs/${slug}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${from}${from.includes('?') ? '&' : '?'}checkout=cancelled`,
  });
  emit('pack.checkout_started', { userId: user ? user.id : null, pack: slug, price: pack.price, ipHash: opts.ipHash || null });
  return session.url;
}

// The success page: confirms the session with Stripe straight away and returns { purchase, key } for this browser,
// or null when the session isn't a paid pack session.
async function confirm(sessionId) {
  const billing = require('./billing');
  const s = billing.stripeClient();
  if (!s || !/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) return null;
  const cs = await s.checkout.sessions.retrieve(sessionId);
  if (!isPackSession(cs) || !['paid', 'no_payment_required'].includes(cs.payment_status)) return null;
  const r = await record(fromSession(cs));
  if (r.purchase.refundedAt) return null;
  return { purchase: r.purchase, key: r.key || (await addKey(r.purchase)) };
}

// ---- files --------------------------------------------------------------------------------------------------------

// A download inside a pack: a Store item's file (never its .tpl source) or one of a kit's files.
// ref is the Store item id, or "kit-<kit>" (kit-motion, kit-ai, kit-creator).
function resolveFile(slug, ref, name) {
  if (!SAFE_FILE.test(String(name))) return null;
  const packs = slug === 'all' ? bundleContents() : [get(slug)].filter(Boolean);
  if (String(ref).startsWith('kit-')) {
    const kit = String(ref).slice(4);
    const mine = packs.filter((p) => p.kit === kit && p.moves.length);
    if (!mine.length || !KIT.test(kit)) return null;
    const ok = name === 'README.md' || name === 'CREDITS.md' || mine.some((p) => p.moves.some((m) => m.file === name));
    const root = path.join(KITS_DIR, kit);
    const abs = path.join(root, name);
    if (!ok || path.dirname(abs) !== root || !TYPES[path.extname(name)] || !fs.existsSync(abs)) return null;
    return { name, abs, root, contentType: TYPES[path.extname(name)] };
  }
  if (!packs.some((p) => p.items.some((i) => i.id === ref))) return null;
  const hit = store.resolveFile(ref, name);
  if (!hit || hit.isPreview) return null;
  return hit;
}

// The public picture of an item on a pack page (its Store preview image), only for items in a pack.
function resolvePeek(slug, ref) {
  const pack = get(slug);
  const item = pack && pack.items.find((i) => i.id === ref);
  if (!item || !item.previewFile) return null;
  return store.resolveFile(item.id, item.previewFile);
}

module.exports = {
  setting, visibleTo, catalog, get, list, paid, bundleContents, fileCount, owns, ownedSlugs, purchasesFor, byKey, record, handleSession, handleRefund,
  checkoutUrl, confirm, resolveFile, resolvePeek, fromSession, ShopUnavailable, COLLECTION, LICENSE_LINE, _reset,
};
