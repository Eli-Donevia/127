// The member marketplace, behind MARKETPLACE (default off). Eli, Oct 21: "Marketplace is GENIUS. run it." Members
// sell their own site designs, templates, prompt packs, workflows, motion kits and short guides; 127 keeps a platform
// fee and Stripe pays the creator the rest. Plan: claude.ai/artifact/DiEwLvavwfM1wBVEdcVJhn. Legal's rules: L101
// (MK1 to MK20; Terms 5B and 13E).
//
// MARKET_SELLERS: "all" (default, Legal's MK1 recommendation: nobody pays to sell, which keeps the Market out of the
// FTC's Business Opportunity Rule) or "paid" (Builder and the Circle only; needs the lawyer first). Never pitch a plan
// or the Market as a way to earn (MK2).
//
// MARKETPLACE: "on" shows /market, listing and creator pages and the Sell page to everyone; "admins" to ADMIN_EMAILS
// only (to try it on the live site before Legal clears the seller and buyer terms); off or unset: every page 404s.
// MARKET_FEE_PCT (default 20), MARKET_FEE_PCT_CIRCLE (default 10) and MARKET_FEE_PCT_FREE (default MARKET_FEE_PCT):
// 127's share of each sale, by the seller's plan at the time of the sale. MARKET_PAYOUT_DELAY_DAYS (default 15, MK5):
// set on each creator's Stripe account, so payouts wait out the 14-day refund window and a refund comes back out of
// the maker's share before it's paid out. Each account carries losses: application, so a loss the maker's balance
// can't cover falls on 127, not Stripe.
//
// Money: Stripe Connect. Each creator has an Express account (Stripe holds their bank and tax details; 127 never
// sees them). A sale is a destination charge: 127 is the merchant of record (one receipt, 127's refund policy),
// application_fee_amount is 127's fee, the rest transfers to the creator. Stripe's card fee comes out of 127's share.
// Refunds are made in the Stripe Dashboard with "reverse transfer" and "refund application fee" ticked; the
// charge.refunded webhook ends the buyer's access. No Stripe key: with DEMO_BILLING=true a sale is recorded straight
// away and payouts show as set up, so the whole path can be tried locally.
//
// Files: text a person can read before it goes live (Markdown, plain text, HTML, CSV, JSON) plus a cover image. Bytes
// are blobs (lib/db.js), never loaded into memory with the documents. HTML downloads as a file and, if a browser opens
// it here anyway, runs sandboxed with no access to the site.
//
// Review: every listing passes the automatic checks (check()) before it can be sent, then a person approves it in
// /admin/market. Rejections carry a note saying what to change. A report from the listing page puts it back in front
// of an admin; a valid copyright notice takes it down and counts a strike (three in 12 months ends selling, Terms 13E).
// A listing taken down because it wasn't its maker's to sell stops delivering, and buyers who ask are refunded from the
// maker's share (MK8). Buyers need a US billing address (MK6): a sale from anywhere else is refunded straight away.

const crypto = require('crypto');
const db = require('./db');
const security = require('./security');
const flags = require('./harness/flags');
const copyCheck = require('./copy-check');
const { canAccess } = require('./plans');
const { emit, sendEmail } = require('./integrations');

const SELLERS = 'marketSellers';
const LISTINGS = 'marketListings';
const ORDERS = 'marketOrders';
const REPORTS = 'marketReports';
const INTEGRATION_ID = 'market-checkout';
const KEY = /^[a-f0-9]{64}$/;
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const RESERVED = new Set(['admin', 'market', 'makers', 'sell', 'new', 'edit', 'help', 'support', 'eli', '127', 'team', 'official', 'store', 'packs', 'shop']);
const AGREEMENT_VERSION = 'terms-13e-2026-10-21';
// The rights box (MK4), stored with each listing as sent.
const RIGHTS_TEXT = "I made this, or I have every right needed to sell it, including any fonts, images, code or AI output in it. It doesn't copy anyone else's work or 127's.";
const STRIKE_LIMIT = 3;
const TERMS = { seller: '/terms#13e-selling-on-the-market', buyer: '/terms#5b-buying-on-the-market', copyright: '/terms#12-copyright-complaints' };
const MB = 1024 * 1024;
const LIMITS = { files: 12, fileBytes: 2 * MB, coverBytes: 2 * MB, minPrice: 5, maxPrice: 199, tags: 5 };

// What can be listed. Each kind is a shelf on /market.
const KINDS = {
  site: 'Site design',
  template: 'Template',
  prompts: 'Prompt pack',
  workflow: 'Workflow',
  motion: 'Motion or code kit',
  guide: 'Guide',
};
// The niches the vertical pages start from (Vertical launch engine). Sellers can add their own, up to 5 per listing.
const NICHES = ['gyms', 'coaches', 'coffee', 'restaurants', 'salons', 'barbers', 'contractors', 'cleaners', 'trucking', 'real-estate', 'photographers', 'video-editors', 'creators', 'ecommerce', 'eyewear', 'breeders', 'bakers', 'boutiques', 'agencies', 'tutors', 'therapists', 'dentists', 'landscapers', 'auto'];
const FILE_TYPES = { '.md': 'text/markdown', '.txt': 'text/plain', '.html': 'text/html', '.csv': 'text/csv', '.json': 'application/json' };
const COVER_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const STATUS = { draft: 'Draft', review: 'In review', changes: 'Needs changes', live: 'Live', paused: 'Paused', removed: 'Removed' };

class MarketUnavailable extends Error {}

function setting() {
  const v = String(process.env.MARKETPLACE || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}
function visibleTo(user) {
  const v = setting();
  return v === 'on' || (v === 'admins' && flags.admin(user));
}
const pct = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : fallback;
};
function feePct(seller) {
  if (seller && seller.tier === 'circle') return pct('MARKET_FEE_PCT_CIRCLE', 10);
  if (seller && !canAccess(seller, 'builder')) return pct('MARKET_FEE_PCT_FREE', pct('MARKET_FEE_PCT', 20));
  return pct('MARKET_FEE_PCT', 20);
}
// Cents: 127's fee and the creator's share of one sale.
function split(priceDollars, sellerUser) {
  const cents = Math.round(Number(priceDollars) * 100);
  const fee = Math.round((cents * feePct(sellerUser)) / 100);
  return { cents, fee, net: cents - fee, pct: feePct(sellerUser) };
}
const payoutDelay = () => Math.max(2, Math.min(30, parseInt(process.env.MARKET_PAYOUT_DELAY_DAYS || '15', 10) || 15));
function baseUrl() {
  return (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
}
const billing = () => require('./billing');

// ---- sellers ------------------------------------------------------------------------------------------------------

const sellers = () => (String(process.env.MARKET_SELLERS || '').trim().toLowerCase() === 'paid' ? 'paid' : 'all');
const canSell = (user) => !!user && (sellers() === 'all' || canAccess(user, 'builder'));
const NOT_OPEN = 'Selling is open to paid plans for now.';
const sellerFor = (user) => (user ? db.get(SELLERS, user.id) : null);
const byHandle = (handle) => db.find(SELLERS, (s) => s.handle === String(handle || '').toLowerCase());
const userOf = (seller) => (seller ? db.get('users', seller.id) : null);

function cleanText(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanBlock(v, max) {
  return String(v || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

// Sets up or edits the creator page. Returns { seller } or { error }.
async function saveSeller(user, body) {
  if (!canSell(user)) return { error: NOT_OPEN };
  const existing = sellerFor(user);
  if (existing && existing.status === 'ended') return { error: 'Selling on the Market has ended for this account.' };
  const handle = cleanText(body.handle, 30).toLowerCase().replace(/^@/, '');
  if (!HANDLE.test(handle) || RESERVED.has(handle)) return { error: 'Pick a handle of 3 to 30 letters, numbers or dashes.' };
  const taken = byHandle(handle);
  if (taken && taken.id !== user.id) return { error: 'That handle is taken.' };
  const name = cleanText(body.name, 60);
  if (name.length < 2) return { error: 'Add the name buyers see.' };
  const line = cleanText(body.line, 120);
  const bio = cleanBlock(body.bio, 600);
  const words = `${name}. ${line}. ${bio}`;
  const bad = copyCheck.check(words).filter((f) => f.severity === 'block');
  if (bad.length) return { error: `Your page says "${bad[0].match}". ${bad[0].why}` };
  if (!existing && body.agree !== 'on') return { error: 'Tick the box to agree to the seller terms.' };
  const seller = await db.save(SELLERS, {
    ...(existing || { id: user.id, createdAt: new Date().toISOString(), status: 'active', stripeAccountId: null, payoutsReady: false }),
    id: user.id,
    handle,
    name,
    line,
    bio,
    ...(existing ? {} : { agreedAt: new Date().toISOString(), agreementVersion: AGREEMENT_VERSION }),
  });
  if (!existing) emit('market.seller_joined', { userId: user.id, handle });
  return { seller };
}

// Stripe Connect Express onboarding. Returns the URL to send the creator to.
async function payoutsLink(user) {
  const seller = sellerFor(user);
  if (!seller) throw new MarketUnavailable('Set up your creator page first.');
  if (!billing().isLive()) {
    if (!billing().isDemo()) throw new MarketUnavailable('Payouts are not switched on yet.');
    seller.stripeAccountId = seller.stripeAccountId || `acct_demo_${security.token().slice(0, 16)}`;
    seller.payoutsReady = true;
    await db.save(SELLERS, seller);
    return '/app/sell?payouts=ready';
  }
  const s = billing().stripeClient();
  if (!seller.stripeAccountId) {
    const acct = await s.accounts.create({
      controller: { stripe_dashboard: { type: 'express' }, fees: { payer: 'application' }, losses: { payments: 'application' } },
      capabilities: { transfers: { requested: true } },
      country: 'US',
      email: user.email,
      business_profile: { product_description: 'Digital templates and files sold on 127', url: `${baseUrl()}/makers/${seller.handle}` },
      settings: { payouts: { schedule: { interval: 'daily', delay_days: payoutDelay() } } },
      metadata: { userId: user.id, handle: seller.handle },
    }, { idempotencyKey: `market-acct-${user.id}` });
    seller.stripeAccountId = acct.id;
    await db.save(SELLERS, seller);
  }
  const link = await s.accountLinks.create({
    account: seller.stripeAccountId,
    refresh_url: `${baseUrl()}/app/sell/payouts`,
    return_url: `${baseUrl()}/app/sell/payouts/done`,
    type: 'account_onboarding',
  });
  return link.url;
}

// Re-reads the creator's Stripe account: payouts are ready once Stripe can send them money.
async function refreshPayouts(user) {
  const seller = sellerFor(user);
  if (!seller || !seller.stripeAccountId || !billing().isLive()) return seller;
  const acct = await billing().stripeClient().accounts.retrieve(seller.stripeAccountId);
  const ready = !!(acct.capabilities && acct.capabilities.transfers === 'active') && !!acct.details_submitted;
  if (ready !== seller.payoutsReady) {
    seller.payoutsReady = ready;
    await db.save(SELLERS, seller);
  }
  return seller;
}

async function dashboardLink(user) {
  const seller = sellerFor(user);
  if (!seller || !seller.stripeAccountId || !billing().isLive()) return null;
  const l = await billing().stripeClient().accounts.createLoginLink(seller.stripeAccountId);
  return l.url;
}

// ---- listings -----------------------------------------------------------------------------------------------------

function slugify(title) {
  const base = String(title || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'listing';
  let slug = base;
  for (let n = 2; db.find(LISTINGS, (l) => l.slug === slug); n++) slug = `${base}-${n}`;
  return slug;
}
const listingsOf = (sellerId) => db.filter(LISTINGS, (l) => l.sellerId === sellerId && l.status !== 'removed').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
const bySlug = (slug) => db.find(LISTINGS, (l) => l.slug === String(slug || ''));
function mine(user, id) {
  const l = db.get(LISTINGS, String(id || ''));
  return l && user && l.sellerId === user.id && l.status !== 'removed' ? l : null;
}
const editable = (l) => ['draft', 'changes', 'live', 'paused'].includes(l.status);

function tagsFrom(v) {
  const raw = Array.isArray(v) ? v : String(v || '').split(',');
  const out = [];
  for (const t of raw) {
    const tag = String(t).toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').slice(0, 24);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, LIMITS.tags);
}
function insideFrom(v) {
  return String(v || '').split('\n').map((x) => cleanText(x.replace(/^\s*(?:[-*•]\s*|\d{1,2}[.)]\s+)/, ''), 120)).filter(Boolean).slice(0, 8);
}

// Creates or edits a listing's words and price. Editing a live listing sends it back to review.
async function saveListing(user, id, body) {
  const seller = sellerFor(user);
  if (!seller || !canSell(user)) return { error: 'Set up your creator page first.' };
  if (seller.status !== 'active') return { error: 'Selling on the Market has ended for this account.' };
  const existing = id ? mine(user, id) : null;
  if (id && !existing) return { error: 'That listing is not yours.' };
  if (existing && !editable(existing)) return { error: 'This listing is in review. You can edit it once 127 has looked.' };
  const title = cleanText(body.title, 70);
  if (title.length < 4) return { error: 'Give it a title buyers can scan.' };
  const kind = KINDS[body.kind] ? body.kind : null;
  if (!kind) return { error: 'Pick what kind of file this is.' };
  const price = Math.round(Number(body.price));
  if (!(price >= LIMITS.minPrice && price <= LIMITS.maxPrice)) return { error: `Prices run from $${LIMITS.minPrice} to $${LIMITS.maxPrice}.` };
  const now = new Date().toISOString();
  const wasLive = existing && ['live', 'paused'].includes(existing.status);
  const listing = await db.save(LISTINGS, {
    ...(existing || { id: crypto.randomUUID(), sellerId: user.id, slug: slugify(title), files: [], cover: null, status: 'draft', sales: 0, createdAt: now }),
    title,
    kind,
    price,
    line: cleanText(body.line, 140),
    about: cleanBlock(body.about, 2000),
    inside: insideFrom(body.inside),
    tags: tagsFrom(body.tags),
    updatedAt: now,
    // A changed live listing comes off the shelf until it's checked again.
    ...(wasLive ? { status: 'draft', wasLive: true } : {}),
  });
  return { listing };
}

const extOf = (name) => (String(name).match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
function safeName(name) {
  const n = String(name || 'file').replace(/[\\/]/g, '-').replace(/[^A-Za-z0-9._ -]/g, '').replace(/\s+/g, '-').replace(/^[.-]+/, '').slice(0, 80);
  return n || 'file';
}

// Adds one file (raw bytes) to a listing. Returns { file } or { error }.
async function addFile(user, id, name, buf) {
  const l = mine(user, id);
  if (!l || !editable(l)) return { error: "You can't add files to this listing right now." };
  const clean = safeName(name);
  const type = FILE_TYPES[extOf(clean)];
  if (!type) return { error: 'Markdown, text, HTML, CSV or JSON files only, so 127 can read them before they go live.' };
  if (!Buffer.isBuffer(buf) || !buf.length) return { error: 'That file is empty.' };
  if (buf.length > LIMITS.fileBytes) return { error: 'Each file can be up to 2 MB.' };
  if (l.files.length >= LIMITS.files) return { error: `Up to ${LIMITS.files} files a listing.` };
  if (l.files.some((f) => f.name === clean)) return { error: 'A file with that name is already here.' };
  const fid = crypto.randomBytes(8).toString('hex');
  await db.putBlob(`mkt_${l.id.replace(/-/g, '')}_${fid}`, buf);
  const file = { id: fid, name: clean, type, size: buf.length, addedAt: new Date().toISOString() };
  l.files.push(file);
  if (['live', 'paused'].includes(l.status)) Object.assign(l, { status: 'draft', wasLive: true });
  l.updatedAt = file.addedAt;
  await db.save(LISTINGS, l);
  return { file };
}
async function removeFile(user, id, fid) {
  const l = mine(user, id);
  if (!l || !editable(l)) return false;
  const f = l.files.find((x) => x.id === fid);
  if (!f) return false;
  l.files = l.files.filter((x) => x.id !== fid);
  if (['live', 'paused'].includes(l.status)) Object.assign(l, { status: 'draft', wasLive: true });
  await db.save(LISTINGS, l);
  // Buyers who already paid keep the file.
  if (!db.find(ORDERS, (o) => o.listingId === l.id)) await db.removeBlob(`mkt_${l.id.replace(/-/g, '')}_${fid}`);
  return true;
}
async function setCover(user, id, type, buf) {
  const l = mine(user, id);
  if (!l || !editable(l)) return { error: "You can't change this listing right now." };
  if (!COVER_TYPES[type]) return { error: 'A PNG, JPG or WebP picture.' };
  if (!Buffer.isBuffer(buf) || !buf.length || buf.length > LIMITS.coverBytes) return { error: 'The picture can be up to 2 MB.' };
  const v = crypto.randomBytes(4).toString('hex');
  await db.putBlob(`mktc_${l.id.replace(/-/g, '')}_${v}`, buf);
  l.cover = { v, type, size: buf.length };
  if (['live', 'paused'].includes(l.status)) Object.assign(l, { status: 'draft', wasLive: true });
  await db.save(LISTINGS, l);
  return { cover: l.cover };
}
const fileBlob = (l, f) => db.getBlob(`mkt_${l.id.replace(/-/g, '')}_${f.id}`);
const coverBlob = (l) => (l.cover ? db.getBlob(`mktc_${l.id.replace(/-/g, '')}_${l.cover.v}`) : null);

// ---- the quality bar ----------------------------------------------------------------------------------------------

// Words that read as machine-written in a listing (brand/voice section 4 plus the premium pass's tells list). A warning
// for the seller and the reviewer, not a block: a person decides.
const AI_TELLS = /\b(?:unlock|unleash|elevate|supercharge|skyrocket|revolutioni[sz]e|seamless(?:ly)?|effortless(?:ly)?|leverage|harness the power|next[- ]level|cutting[- ]edge|empower(?:s|ing)?|game[- ]chang(?:er|ing)|dive (?:in|into)|delve|in today's|look no further|take your \w+ to the next|transform(?:s|ing)? your|whether you're a|tailored|journey|solutions|crafted)\b/gi;
// What never sells on 127 (plan, "What never sells"; Legal L53, L62, L65). Checked in the words and the file names.
const BANNED = [
  { id: 'lead-list', re: /\b(?:lead|leads|prospect|contact|email|phone)s?\s+(?:list|lists|database|spreadsheet|sheet)\b|\bscraped\b|\bscraper\b|\b(?:verified|targeted)\s+(?:emails|leads|contacts)\b/i, why: 'Lists of people or businesses, and scraped data, are not sold on 127.' },
  { id: 'google-data', re: /\bgoogle\s+(?:maps|places|business profile)\s+(?:data|export|listings|scrape)/i, why: "Data copied from Google Maps can't be sold (Google's terms)." },
  { id: 'services', warn: true, re: /\b(?:i will|i'll|we will|we'll)\s+(?:build|design|write|run|manage|do)\s+(?:it|this|your)\b|\b(?:coaching|consulting)\s+(?:call|session|package)s?\b|\b1[- :]?on[- :]?1\b/i, why: 'Services and coaching are not sold here yet. List files a buyer downloads.' },
  { id: 'advice', re: /\b(?:investment|trading|tax|legal|medical|financial)\s+advice\b|\btrading signals?\b|\bdiagnos(?:e|is|tic)\b|\bcure\b/i, why: 'Financial, medical and legal advice products are not sold on 127.' },
  { id: 'resale', re: /\b(?:plr|private label rights|resell rights|master resell)\b/i, why: 'Resale-rights bundles are not sold on 127. Sell work you made.' },
  // Legal L101 MK14.
  { id: 'business-pitch', re: /\b(?:start your own|make money with|sell (?:this|it|them) as your own|business[- ]in[- ]a[- ]box)\b/i, why: "Listings say what the file does. They can't pitch a business, resale or a way to make money." },
  { id: 'spam-tools', re: /\b(?:mass[- ]?dms?|auto[- ]?dms?|bots?|scrapers?|scraping|undetectable|bypass(?:es|ing)?|fake reviews?)\b/i, why: "Spam, scraping and tools that get around a platform's rules aren't sold on 127." },
  { id: 'health', re: /\b(?:weight[- ]loss|lose (?:\d+ )?(?:lbs|pounds|kilos|weight)|fat[- ]loss|burn (?:belly )?fat|detox|reverse (?:your )?(?:diabetes|aging))\b/i, why: "Weight-loss and other health results aren't sold on 127." },
];

// Money and results in a listing's words (MK14): any amount other than the price, value totals, and earnings or
// results words. "Profit" and "revenue" alone only warn, since a numbers template tracks them; the reviewer decides.
const RESULTS = /\b(?:incomes?|earn|earns|earning|earnings|passive|six[- ]figures?|seven[- ]figures?|quit your (?:job|9[- ]to[- ]5)|guarante(?:e[ds]?))\b|\b(?:more|new|extra|get|land|win|attract|gain|grow|double|triple|boost|increase|\d[\d,]*\+?)\s+(?:paying\s+)?(?:clients|leads|followers|customers|sales|profits?|revenue)\b/i;
const VALUE = /\bvalued? at\b|\b\d[\d,]*\s+value\b|\bvalue of \$|\bworth \$/i;
const MONEY_WORDS = /\b(?:profits?|revenue)\b/i;
// MK15: testimonials, quotes, stars and ratings in the listing; example money in files that isn't labeled.
const PRAISE = /[★⭐]|\b\d(?:\.\d)?\s*(?:\/\s*5\s*)?stars?\b|\b(?:testimonials?|rated|ratings?|reviews?)\b|[“"][^”"\n]{12,}[”"]/i;
const EXAMPLE_LABEL = /example:\s*made-up numbers/i;
function otherAmounts(text, price) {
  const out = [];
  for (const m of String(text).matchAll(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)\s*([kKmM])?\b/g)) {
    const n = Number(m[1].replace(/,/g, '')) * (m[2] ? (/k/i.test(m[2]) ? 1e3 : 1e6) : 1);
    if (n !== Number(price)) out.push(m[0].trim());
  }
  for (const m of String(text).matchAll(/\b\d[\d,]*\s*(?:dollars|usd)\b/gi)) out.push(m[0]);
  return out;
}

// In a buyer's files, the copy check's claim rules count (income, results, value totals); its house-style rules (dashes,
// 127's own voice list and launch dates) are the seller's business.
const STYLE_RULES = new Set(['em-dash', 'hype', 'last-chance', 'free-roadmap', 'paid-plan-customers', 'ai-employee-claims']);

function textOf(l) {
  return [l.title, l.line, l.about, (l.inside || []).join('\n')].filter(Boolean).join('\n');
}

// Runs the listing checks. Returns [{ id, label, ok, level: 'block'|'warn', detail }].
// opts.fileTexts: the files' text, read once by the caller (submit) so this stays synchronous.
function check(l, seller, opts = {}) {
  const out = [];
  const add = (id, label, ok, level, detail) => out.push({ id, label, ok: !!ok, level, detail: ok ? null : detail });
  const words = textOf(l);
  add('words', 'Title, a line and what it does', l.title && (l.line || '').length >= 10 && (l.about || '').length >= 80, 'block', 'Add a one-line description and at least a short paragraph on what the buyer gets and how to use it.');
  add('price', 'Price', l.price >= LIMITS.minPrice && l.price <= LIMITS.maxPrice, 'block', `Set a price from $${LIMITS.minPrice} to $${LIMITS.maxPrice}.`);
  add('files', 'At least one file', (l.files || []).length > 0, 'block', 'Add the files the buyer downloads.');
  add('cover', 'A cover picture', !!l.cover, 'block', 'Add a cover: a real screenshot or photo of the file works best.');
  const claims = copyCheck.check(words).filter((f) => f.severity === 'block');
  add('claims', 'No income or result promises', !claims.length, 'block', claims.length ? `"${claims[0].match}": ${claims[0].why}` : null);
  const fileClaims = [];
  for (const [name, text] of Object.entries(opts.fileTexts || {})) {
    const hit = copyCheck.check(text, { file: name }).find((f) => f.severity === 'block' && !STYLE_RULES.has(f.rule));
    if (hit) fileClaims.push(`${name}: "${hit.match}"`);
  }
  add('file-claims', 'Files make no income promises', !fileClaims.length, 'block', `Change these lines in your files: ${fileClaims.slice(0, 3).join('; ')}.`);
  const names = (l.files || []).map((f) => f.name).join('\n');
  const hit = (b) => b.re.test(words) || b.re.test(names);
  const banned = BANNED.find((b) => !b.warn && hit(b));
  add('allowed', 'Something 127 sells', !banned, 'block', banned ? banned.why : null);
  const amounts = otherAmounts(words, l.price);
  const results = words.match(RESULTS);
  const value = words.match(VALUE);
  add('money', 'No money or results talk', !amounts.length && !results && !value, 'block',
    amounts.length ? `Take out "${amounts[0]}". The only amount on a listing is its price.` : results ? `Take out "${results[0]}". Listings can't talk about earnings or results.` : value ? `Take out "${value[0]}". No value totals.` : null);
  const moneyWord = !results && words.match(MONEY_WORDS);
  add('money-words', 'Numbers words describe the file', !moneyWord, 'warn', moneyWord ? `"${moneyWord[0]}": fine if the file tracks it, not if it reads as a result the buyer will get.` : null);
  const praise = words.match(PRAISE);
  add('praise', 'No testimonials or ratings', !praise, 'warn', praise ? `Take out "${praise[0].slice(0, 40)}". Testimonials, quotes, stars and ratings stay off listings.` : null);
  const unlabeled = Object.entries(opts.fileTexts || {}).filter(([, t]) => /\$\s?\d/.test(t) && !EXAMPLE_LABEL.test(t)).map(([n]) => n);
  add('example-money', 'Example money is labeled', !unlabeled.length, 'warn', `Put "Example: made-up numbers" next to the money in ${unlabeled.slice(0, 3).join(', ')}.`);
  const service = BANNED.find((b) => b.warn && hit(b));
  add('files-not-service', 'Files, not a service', !service, 'warn', service ? service.why : null);
  const external = Object.entries(opts.fileTexts || {}).filter(([n, t]) => /\.html$/.test(n) && /<script[^>]+src\s*=\s*["']?https?:/i.test(t)).map(([n]) => n);
  add('html', 'HTML files carry their own code', !external.length, 'warn', `These load scripts from another site, which buyers can't check: ${external.join(', ')}.`);
  const tells = [...new Set((words.match(AI_TELLS) || []).map((x) => x.toLowerCase()))];
  add('voice', 'Reads like a person wrote it', !tells.length, 'warn', `Swap ${tells.slice(0, 4).map((t) => `"${t}"`).join(', ')} for plain words that say what the file does.`);
  add('payouts', 'Payouts set up', !!(seller && seller.payoutsReady), 'block', 'Set up payouts with Stripe so 127 can pay you.');
  return out;
}
const blocking = (checks) => checks.filter((c) => !c.ok && c.level === 'block');

async function fileTexts(l) {
  const out = {};
  for (const f of l.files || []) {
    const buf = await fileBlob(l, f);
    if (buf) out[f.name] = buf.toString('utf8').slice(0, 400000);
  }
  return out;
}

// Sends a listing for review: the rights promise, then every check. Returns { listing } or { error, checks }.
async function submit(user, id, body) {
  const l = mine(user, id);
  const seller = sellerFor(user);
  if (!l || !seller) return { error: 'That listing is not yours.' };
  if (!['draft', 'changes'].includes(l.status)) return { error: 'This listing is already with 127.' };
  if (!canSell(user)) return { error: NOT_OPEN };
  if (seller.status !== 'active') return { error: 'Selling on the Market has ended for this account.' };
  if (body.rights !== 'on') return { error: 'Tick the box to confirm you made this and have the right to sell it.' };
  const checks = check(l, seller, { fileTexts: await fileTexts(l) });
  const stop = blocking(checks);
  if (stop.length) return { error: stop[0].detail, checks };
  const now = new Date().toISOString();
  Object.assign(l, { status: 'review', checks, submittedAt: now, updatedAt: now, rights: { at: now, version: AGREEMENT_VERSION, text: RIGHTS_TEXT }, reviewNote: null });
  await db.save(LISTINGS, l);
  emit('market.listing_submitted', { userId: user.id, listing: l.id, kind: l.kind, price: l.price });
  const admin = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
  if (admin) sendEmail({ to: admin, subject: `Marketplace: ${l.title} is waiting for a look`, text: `${seller.name} (@${seller.handle}) sent "${l.title}" ($${l.price}) for review.\n\n${baseUrl()}/admin/market` });
  return { listing: l };
}

// What the reviewer looks for before approving (MK13), shown on /admin/market. Approving records who and when.
const REVIEW_LIST = [
  "No other brand's name or logo, and nothing \"inspired by\" a brand",
  'No stock-photo watermarks or paid font files',
  'No pieces from Envato, ThemeForest, Creative Market or Canva Pro',
  "Nothing that looks like 127's own packs, Store items, courses or prompts",
  'No testimonials, ratings or unlabeled example money in the listing, cover or files',
  'A person on the cover made by AI gets the "AI-generated person" label',
];

// Counts a valid copyright notice against the maker (Terms 13E): three in 12 months ends their selling.
async function strike(seller, listingId, now) {
  const year = Date.parse(now) - 365 * 24 * 60 * 60 * 1000;
  seller.strikes = (seller.strikes || []).filter((x) => Date.parse(x.at) > year).concat({ at: now, listingId });
  if (seller.strikes.length >= STRIKE_LIMIT) Object.assign(seller, { status: 'ended', endedAt: now, endedFor: 'copyright' });
  await db.save(SELLERS, seller);
  return seller.status === 'ended';
}
const strikesOf = (seller) => (seller && seller.strikes ? seller.strikes.filter((x) => Date.parse(x.at) > Date.now() - 365 * 24 * 60 * 60 * 1000).length : 0);

// Admin: approve, ask for changes, pause, remove, keep it up after a report, take it down as not the maker's to sell
// ("rights", MK8) or on a valid copyright notice ("copyright", MK12: also a strike), or label the cover's person as made
// by AI ("ai-person", MK16). Approving needs the reviewer's tick on the checklist. Returns the listing or null.
async function review(adminUser, id, action, note, body = {}) {
  const l = db.get(LISTINGS, String(id || ''));
  if (!l) return null;
  const now = new Date().toISOString();
  const seller = db.get(SELLERS, l.sellerId);
  const owner = userOf(seller);
  const text = cleanBlock(note, 800);
  let ended = false;
  if (action === 'approve') {
    if (body.looked !== 'on') return null;
    Object.assign(l, { status: 'live', approvedAt: now, approvedBy: adminUser.email, reviewChecklist: REVIEW_LIST.length, reviewNote: null, wasLive: false, reportOpen: false });
  } else if (action === 'ai-person') {
    l.aiPerson = !l.aiPerson;
    l.updatedAt = now;
    await db.save(LISTINGS, l);
    return l;
  } else if (action === 'rights' || action === 'copyright') {
    Object.assign(l, { status: 'removed', pulled: action, pulledAt: now, pulledBy: adminUser.email, reviewNote: text || null, removedAt: now, reportOpen: false });
    if (action === 'copyright' && seller) ended = await strike(seller, l.id, now);
  }
  else if (action === 'changes') Object.assign(l, { status: 'changes', reviewNote: text || 'Please look at the checks and send it again.', reviewedAt: now });
  else if (action === 'pause') Object.assign(l, { status: 'paused', reviewNote: text || null, reviewedAt: now, reportOpen: false });
  else if (action === 'remove') Object.assign(l, { status: 'removed', reviewNote: text || null, removedAt: now, reportOpen: false });
  else if (action === 'dismiss') Object.assign(l, { reportOpen: false });
  else return null;
  l.updatedAt = now;
  await db.save(LISTINGS, l);
  for (const r of db.filter(REPORTS, (x) => x.listingId === l.id && x.status === 'open')) await db.save(REPORTS, { ...r, status: 'closed', closedAt: now, outcome: action });
  if (l.pulled && ['rights', 'copyright'].includes(action)) await tellBuyers(l);
  if (owner && action !== 'dismiss') {
    const counter = `If you think this is a mistake, you can send a counter-notice to the copyright agent in Section 12 of the Terms: ${baseUrl()}${TERMS.copyright}`;
    const lines = {
      approve: `"${l.title}" is live: ${baseUrl()}/market/${l.slug}`,
      changes: `127 looked at "${l.title}" and asks for a change before it goes live:\n\n${l.reviewNote}\n\nEdit it here: ${baseUrl()}/app/sell/${l.id}`,
      pause: `"${l.title}" is paused while 127 looks at it.${l.reviewNote ? `\n\n${l.reviewNote}` : ''}`,
      remove: `"${l.title}" was taken down.${l.reviewNote ? `\n\n${l.reviewNote}` : ''} Reply to this email if you think that's wrong.`,
      rights: `"${l.title}" was taken down because it looks like it wasn't yours to sell.${l.reviewNote ? `\n\n${l.reviewNote}` : ''} Buyers who ask for a refund get one, and it comes out of your share (Terms 13E). Reply to this email if you think that's wrong.`,
      copyright: `"${l.title}" was taken down after a copyright notice.${l.reviewNote ? `\n\n${l.reviewNote}` : ''} Buyers who ask for a refund get one, from your share. This counts as ${strikesOf(seller)} of ${STRIKE_LIMIT} in 12 months; at ${STRIKE_LIMIT}, selling on the Market ends (Terms 13E).${ended ? ' That was the third, so your selling has ended.' : ''}\n\n${counter}`,
    };
    sendEmail({ to: owner.email, subject: action === 'approve' ? `${l.title} is live on 127` : `About ${l.title}`, text: `${lines[action]}\n\n127` });
  }
  emit('market.listing_reviewed', { listing: l.id, action });
  return l;
}

// A listing shows while it's live and its seller is still on Builder or the Circle with payouts set up.
function onShelf(l) {
  if (!l || l.status !== 'live') return false;
  const seller = db.get(SELLERS, l.sellerId);
  return !!(seller && seller.status === 'active' && seller.payoutsReady && canSell(userOf(seller)));
}
function shelf({ kind, niche } = {}) {
  return db.filter(LISTINGS, (l) => onShelf(l) && (!kind || l.kind === kind) && (!niche || (l.tags || []).includes(niche)))
    .sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)));
}
// For the vertical pages (Vertical launch engine): members' live listings for one niche (by tag). Public pages, so only when
// the switch is fully on.
// Each card carries MEMBER_LABEL, the only heading those pages use for them: never "recommended" (MK17).
const MEMBER_LABEL = 'Made by members';
const forNiche = (niche, limit = 6) => (setting() === 'on' ? shelf({ niche: String(niche || '').toLowerCase() }).slice(0, limit).map((l) => ({ ...card(l), label: MEMBER_LABEL })) : []);
function card(l) {
  const s = db.get(SELLERS, l.sellerId);
  return { slug: l.slug, title: l.title, line: l.line, kind: l.kind, kindName: KINDS[l.kind], price: l.price, tags: l.tags || [], cover: l.cover ? `/market/${l.slug}/cover?v=${l.cover.v}` : null, aiPerson: !!l.aiPerson, maker: s ? { handle: s.handle, name: s.name } : null, files: (l.files || []).length };
}

async function report(slug, body, ip) {
  const l = bySlug(slug);
  if (!l || l.status !== 'live') return null;
  const reasons = ['copied', 'misleading', 'broken', 'not-allowed', 'other'];
  const r = await db.save(REPORTS, {
    id: crypto.randomUUID(),
    listingId: l.id,
    reason: reasons.includes(body.reason) ? body.reason : 'other',
    text: cleanBlock(body.text, 1500),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '')) ? String(body.email).toLowerCase().slice(0, 200) : null,
    ipHash: security.hash(`${process.env.SESSION_SECRET || 'dev'}:${ip}`).slice(0, 24),
    status: 'open',
    at: new Date().toISOString(),
  });
  l.reportOpen = true;
  await db.save(LISTINGS, l);
  emit('market.reported', { listing: l.id, reason: r.reason });
  return r;
}

// ---- orders -------------------------------------------------------------------------------------------------------

function ordersFor(user) {
  if (!user) return [];
  const email = user.emailVerified && user.email ? String(user.email).toLowerCase() : null;
  return db.filter(ORDERS, (o) => !o.refundedAt && !o.refused && (o.userId === user.id || (email && o.email === email)));
}
function byKey(key) {
  if (!KEY.test(String(key || ''))) return null;
  const h = security.hash(key);
  const hit = db.find(ORDERS, (o) => (o.keyHashes || []).some((k) => security.sameHash(k, h)));
  return hit && !hit.refundedAt && !hit.refused ? hit : null;
}
// The seller owns their own listing; a buyer owns what they paid for (account, verified email, or the private link).
function owns(user, l, keys = []) {
  if (!l) return false;
  if (user && user.id === l.sellerId) return true;
  return bought(user, l, keys) && !l.pulled;
}
// Paid for it, whether or not the files still deliver: a pulled listing's buyers see the refund note instead.
function bought(user, l, keys = []) {
  if (!l) return false;
  if (ordersFor(user).some((o) => o.listingId === l.id)) return true;
  return keys.some((k) => {
    const o = byKey(k);
    return !!(o && o.listingId === l.id);
  });
}

async function addKey(order) {
  const key = security.token();
  order.keyHashes = (order.keyHashes || []).concat(security.hash(key)).slice(-5);
  await db.save(ORDERS, order);
  return key;
}

async function record({ sessionId, listingId, email, userId, amount, fee, currency, paymentIntent, demo, buyerFirst, country }) {
  const existing = db.get(ORDERS, sessionId);
  if (existing) return { order: existing, key: null, fresh: false };
  const l = db.get(LISTINGS, listingId);
  if (!l) return { order: null, key: null, fresh: false };
  if (country && country !== 'US') return refuseAbroad({ sessionId, listingId, email, userId, amount, fee, currency, paymentIntent, country, l });
  const key = security.token();
  const cents = Math.round(Number(amount) * 100);
  const order = await db.save(ORDERS, {
    id: sessionId,
    listingId,
    sellerId: l.sellerId,
    email: email ? String(email).toLowerCase() : null,
    userId: userId && db.get('users', userId) ? userId : null,
    amount: cents / 100,
    fee: (Number(fee) || 0) / 100,
    net: (cents - (Number(fee) || 0)) / 100,
    currency: currency || 'usd',
    paymentIntent: paymentIntent || null,
    // What the maker sees about a buyer (MK18): first name and country, never the email.
    buyerFirst: cleanText(buyerFirst, 40).split(' ')[0] || null,
    country: country || null,
    keyHashes: [security.hash(key)],
    paidAt: new Date().toISOString(),
    demo: !!demo,
  });
  l.sales = (l.sales || 0) + 1;
  await db.save(LISTINGS, l);
  const link = `${baseUrl()}/market/${l.slug}/get?k=${key}`;
  if (order.email) {
    const s = db.get(SELLERS, l.sellerId);
    sendEmail({
      to: order.email,
      subject: `Your files: ${l.title}`,
      text: `Thanks for buying ${l.title}${s ? ` by ${s.name}` : ''}.\n\nYour files: ${link}\n\nKeep this email. The link is private and it's how you get back to your files. If you make a free 127 account with this email, they show up there too.\n\nQuestions about the order: hello@127group.io\n\n127`,
    });
  }
  const seller = userOf(db.get(SELLERS, l.sellerId));
  if (seller) sendEmail({ to: seller.email, subject: `You sold ${l.title}`, text: `Someone bought "${l.title}". Your share is $${order.net.toFixed(2)}; Stripe pays it out about ${payoutDelay()} days from now.\n\n${baseUrl()}/app/sell\n\n127` });
  emit('market.sold', { listing: l.id, sellerId: l.sellerId, amount: order.amount, fee: order.fee, demo: order.demo });
  return { order, key, fresh: true, link };
}

// Refunds one order in full: the buyer's money back, the maker's share reversed and 127's fee returned (Stripe's
// reverse_transfer and refund_application_fee). Demo orders are just marked. Returns the order or null.
async function refund(order, reason) {
  if (!order || order.refundedAt) return order || null;
  if (order.paymentIntent && billing().isLive()) {
    await billing().stripeClient().refunds.create(
      { payment_intent: order.paymentIntent, reverse_transfer: true, refund_application_fee: true, metadata: { kind: 'market', reason } },
      { idempotencyKey: `market-refund-${order.id}` }
    );
  }
  Object.assign(order, { refundedAt: new Date().toISOString(), refundReason: reason });
  await db.save(ORDERS, order);
  emit('market.refunded', { listing: order.listingId, amount: order.amount, reason });
  return order;
}
// MK6: Market sales are to US billing addresses only. Anything else is refunded straight away and never delivered.
async function refuseAbroad({ sessionId, listingId, email, userId, amount, fee, currency, paymentIntent, country, l }) {
  const order = await db.save(ORDERS, { id: sessionId, listingId, sellerId: l.sellerId, email: email ? String(email).toLowerCase() : null, userId: userId && db.get('users', userId) ? userId : null, amount: Number(amount) || 0, fee: (Number(fee) || 0) / 100, net: 0, currency: currency || 'usd', paymentIntent: paymentIntent || null, country, paidAt: new Date().toISOString(), refused: 'non-us' });
  await refund(order, 'non-us').catch((e) => console.error('[market] refund abroad', e.message));
  if (order.email) sendEmail({ to: order.email, subject: `Refunded: ${l.title}`, text: `The 127 Market sells to US billing addresses for now, so we've refunded your payment for ${l.title} in full. It can take 5 to 10 days to show.\n\nQuestions: hello@127group.io\n\n127` });
  return { order, key: null, fresh: false };
}
// MK8: a listing taken down as not its maker's to sell. Buyers are told the files stopped and how to get a refund.
async function tellBuyers(l) {
  const orders = db.filter(ORDERS, (o) => o.listingId === l.id && !o.refundedAt && o.email && !o.toldPulledAt);
  for (const o of orders) {
    sendEmail({ to: o.email, subject: `About ${l.title}`, text: `We took ${l.title} off the 127 Market because it looks like it wasn't its maker's to sell, so its files no longer download. If you'd like your money back, reply to this email or write to hello@127group.io and we'll refund you in full.\n\n127` });
    o.toldPulledAt = new Date().toISOString();
    await db.save(ORDERS, o);
  }
  return orders.length;
}
// Admin: refund one order of a pulled listing when its buyer asks (or any order, for support).
async function refundOrder(adminUser, orderId) {
  const order = db.get(ORDERS, String(orderId || ''));
  if (!order || order.refundedAt) return null;
  const l = db.get(LISTINGS, order.listingId);
  return refund(order, l && l.pulled ? `pulled-${l.pulled}` : `admin:${adminUser.email}`);
}

const isMarketSession = (cs) => !!cs && cs.mode === 'payment' && !!cs.metadata && cs.metadata.kind === 'market' && !!db.get(LISTINGS, cs.metadata.listing);
function fromSession(cs) {
  const md = cs.metadata || {};
  const cd = cs.customer_details || {};
  return {
    sessionId: cs.id,
    listingId: md.listing,
    buyerFirst: cd.name || null,
    country: (cd.address && cd.address.country) || null,
    email: (cs.customer_details && cs.customer_details.email) || cs.customer_email || null,
    userId: cs.client_reference_id || md.userId || null,
    amount: (cs.amount_total || 0) / 100,
    fee: Number(md.fee_cents) || 0,
    currency: cs.currency || 'usd',
    paymentIntent: typeof cs.payment_intent === 'string' ? cs.payment_intent : (cs.payment_intent && cs.payment_intent.id) || null,
  };
}
// From the webhook (checkout.session.completed / async_payment_succeeded). True when it was a marketplace sale.
async function handleSession(cs) {
  if (!isMarketSession(cs)) return false;
  if (['paid', 'no_payment_required'].includes(cs.payment_status)) await record(fromSession(cs));
  return true;
}
// From the webhook (charge.refunded): a full refund ends the buyer's access. True when it matched.
async function handleRefund(charge) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent && charge.payment_intent.id;
  const order = pi ? db.find(ORDERS, (o) => o.paymentIntent === pi) : null;
  if (!order) return false;
  if (charge.refunded && !order.refundedAt) {
    order.refundedAt = new Date().toISOString();
    await db.save(ORDERS, order);
    emit('market.refunded', { listing: order.listingId, amount: (charge.amount_refunded || 0) / 100 });
  }
  return true;
}

// Returns where to send the buyer: Stripe Checkout, or their files when they already own it.
async function checkoutUrl(user, slug, opts = {}) {
  const l = bySlug(slug);
  if (!onShelf(l)) throw new MarketUnavailable('That listing is not for sale.');
  if (owns(user, l, opts.keys || [])) return `/market/${l.slug}/get`;
  const seller = db.get(SELLERS, l.sellerId);
  const sellerUser = userOf(seller);
  const money = split(l.price, sellerUser);
  if (!billing().isLive()) {
    if (!billing().isDemo()) throw new MarketUnavailable('Payments are not switched on yet.');
    const r = await record({ sessionId: `demo_${security.token().slice(0, 24)}`, listingId: l.id, email: user ? user.email : null, userId: user ? user.id : null, amount: l.price, fee: money.fee, demo: true });
    return `/market/${l.slug}/get?k=${r.key}&bought=1`;
  }
  const s = billing().stripeClient();
  const base = baseUrl();
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: money.cents, product_data: { name: l.title, description: `${KINDS[l.kind]} by ${seller.name}, sold on 127`, metadata: { listing: l.id } } } }],
    ...(user && user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_creation: 'always', ...(user ? { customer_email: user.email } : {}) }),
    ...(user ? { client_reference_id: user.id } : {}),
    metadata: { kind: 'market', listing: l.id, seller: l.sellerId, fee_cents: String(money.fee), fee_pct: String(money.pct), userId: user ? user.id : '' },
    payment_intent_data: { application_fee_amount: money.fee, transfer_data: { destination: seller.stripeAccountId }, metadata: { kind: 'market', listing: l.id } },
    invoice_creation: { enabled: true },
    allow_promotion_codes: false,
    ...(billing().termsConsentOn() ? { consent_collection: { terms_of_service: 'required' } } : {}),
    custom_text: { submit: { message: `One payment to 127. Made by ${seller.name}, a 127 member. Use the files in your business and your clients' work.` } },
    // US billing addresses only (MK6): asked every time, and anything else is refunded when the payment lands.
    billing_address_collection: 'required',
    ...(billing().taxOn() ? { automatic_tax: { enabled: true } } : {}),
    integration_identifier: INTEGRATION_ID,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${base}/market/${l.slug}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/market/${l.slug}?checkout=cancelled`,
  });
  emit('market.checkout_started', { listing: l.id, price: l.price, userId: user ? user.id : null });
  return session.url;
}

async function confirm(sessionId) {
  const s = billing().stripeClient();
  if (!s || !/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) return null;
  const cs = await s.checkout.sessions.retrieve(sessionId);
  if (!isMarketSession(cs) || !['paid', 'no_payment_required'].includes(cs.payment_status)) return null;
  const r = await record(fromSession(cs));
  if (!r.order || r.order.refundedAt || r.order.refused) return null;
  return { order: r.order, key: r.key || (await addKey(r.order)) };
}

// ---- the seller's numbers -----------------------------------------------------------------------------------------

function earnings(sellerId) {
  const orders = db.filter(ORDERS, (o) => o.sellerId === sellerId && !o.refused);
  const live = orders.filter((o) => !o.refundedAt);
  const sum = (k) => Math.round(live.reduce((n, o) => n + (o[k] || 0), 0) * 100) / 100;
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return { sales: live.length, refunds: orders.length - live.length, gross: sum('amount'), fees: sum('fee'), net: sum('net'), lastWeek: live.filter((o) => Date.parse(o.paidAt) > week).length, recent: live.sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 10) };
}

function queue() {
  const listings = db.all(LISTINGS);
  const withSeller = (l) => ({ ...l, seller: db.get(SELLERS, l.sellerId), strikes: strikesOf(db.get(SELLERS, l.sellerId)) });
  return {
    review: listings.filter((l) => l.status === 'review').sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt))).map(withSeller),
    reported: listings.filter((l) => l.reportOpen).map(withSeller).map((l) => ({ ...l, reports: db.filter(REPORTS, (r) => r.listingId === l.id && r.status === 'open') })),
    pulled: listings.filter((l) => l.pulled).map(withSeller).map((l) => ({ ...l, orders: db.filter(ORDERS, (o) => o.listingId === l.id && !o.refundedAt) })).filter((l) => l.orders.length),
    live: listings.filter((l) => l.status === 'live').length,
    sellers: db.all(SELLERS).length,
    orders: db.all(ORDERS).filter((o) => !o.refundedAt && !o.demo).length,
    fees: Math.round(db.all(ORDERS).filter((o) => !o.refundedAt && !o.demo).reduce((n, o) => n + (o.fee || 0), 0) * 100) / 100,
  };
}

module.exports = {
  setting, visibleTo, feePct, split, payoutDelay, canSell, sellerFor, byHandle, saveSeller, payoutsLink, refreshPayouts, dashboardLink,
  listingsOf, bySlug, mine, editable, saveListing, addFile, removeFile, setCover, fileBlob, coverBlob, check, blocking, submit, review,
  onShelf, shelf, forNiche, card, report, ordersFor, byKey, owns, bought, addKey, record, handleSession, handleRefund, checkoutUrl, confirm,
  refundOrder, strikesOf, earnings, queue, fileTexts, sellers,
  KINDS, NICHES, LIMITS, STATUS, FILE_TYPES, COVER_TYPES, AGREEMENT_VERSION, RIGHTS_TEXT, REVIEW_LIST, TERMS, MEMBER_LABEL, STRIKE_LIMIT,
  MarketUnavailable, SELLERS, LISTINGS, ORDERS, REPORTS,
};
