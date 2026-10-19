// UGC pack logic: brand lists from public Shopify data, what each brand's content is missing,
// honest spec scripts, pitches, the rate card and the usage terms. Facts about real brands come only
// from their own store files (/meta.json, /products.json, /products/<handle>.js), dated.

const { text, money, web, time } = require('../../_kit');
const NICHE = require('../data/niche.json');
const RATES = require('../data/rates.json');
const RULES = require('../data/rules.json');

const CATS = NICHE.categories;
const CAT_IDS = Object.keys(CATS);
let BRANDS = null;
const brandsData = () => BRANDS || (BRANDS = require('../data/brands.json'));

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2122}\u{00AE}\u{00A9}]/gu;

// A product or brand name we can repeat safely: dashes made plain, emoji dropped, and skipped when
// the real name trips the copy rules (we never rename a real product).
function safeName(s, max = 70) {
  let t = String(s || '').replace(EMOJI, '').replace(/[—–]/g, '-').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  if (!t || t.length > max || /[<>{}\\]/.test(t) || text.copyProblems(t).length) return null;
  return t;
}

// "SALT & STONE" -> "Salt & Stone"; names in normal case stay as the brand writes them. A country
// tag on the store name goes ("Vitruvi US" -> "Vitruvi"), so a greeting reads "Hi Vitruvi team".
function brandName(s) {
  const t0 = safeName(s, 40);
  if (!t0) return null;
  const t = t0.replace(/\s+[-|(]?\s*(US|USA|UK|CA|AU|EU|NA)\)?$/, '').trim().length >= 3 ? t0.replace(/\s+[-|(]?\s*(US|USA|UK|CA|AU|EU|NA)\)?$/, '').trim() : t0;
  return /[a-z]/.test(t) || t.replace(/[^A-Z]/g, '').length <= 4 ? t : text.titleCase(t.toLowerCase());
}

// "the Glow Serum", but "The Lost Coast" keeps its own "The".
function the(name) {
  const t = String(name || '');
  return /^the\s/i.test(t) ? t : `the ${t}`;
}

function catOf(id) {
  return CATS[id] ? { id, ...CATS[id] } : { id: 'skincare', ...CATS.skincare };
}

// "https://www.Glow.com/products/x, glow2.com" -> ['glow.com', 'glow2.com']
function parseStores(input, max = 10) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
  const out = [];
  for (const r of raw) {
    const s = String(r || '').trim();
    if (!s || !/[a-z0-9-]+\.[a-z]{2,}/i.test(s)) continue;
    const d = web.domainOf(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

function snapshot(category) {
  const all = brandsData().stores;
  const list = [...(all[category] || [])];
  const extra = NICHE.fill_from[category];
  if (list.length < 25 && extra) for (const b of all[extra] || []) if (!list.some((x) => x.domain === b.domain)) list.push({ ...b, filled: extra });
  return list;
}

function findSnapshot(domain) {
  for (const [cat, list] of Object.entries(brandsData().stores)) {
    const b = list.find((x) => x.domain === domain || `www.${x.domain}` === domain || x.domain === `www.${domain}`);
    if (b) return { ...b, category: cat };
  }
  return null;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}

// Picks the product to make a video for: listed most recently, priced like an impulse buy.
const NOT_FILMABLE = /\b(members?(hip)?|free|bundles?|sets?|duo|trio|kits?|collection|gift|cards?|book|paperback|tee|t-shirt|hoodie|sweatshirt|hat|tote|samples?|subscription|shipping|insurance|warranty|protection|donation|deposit|class|workshop)\b/i;

// Does the brand sell what the category films? From its own product types and titles.
function fits(b, cat) {
  if (!cat || !cat.match) return true;
  const re = new RegExp(`\\b(${cat.match})`, 'i');
  return re.test(`${(b.types || []).join(' ')} ${(b.picks || []).map((p) => p.title).join(' ')}`);
}

function pickProduct(b, cat) {
  const all = (b.picks || []).filter((p) => p.title && p.price > 0);
  const single = all.filter((p) => !NOT_FILMABLE.test(p.title));
  let picks = single.length ? single : all;
  const re = cat && cat.match ? new RegExp(`\\b(${cat.match})`, 'i') : null;
  if (re && picks.some((p) => re.test(p.title))) picks = picks.filter((p) => re.test(p.title));
  if (!picks.length) return null;
  const inBand = picks.filter((p) => p.price >= 12 && p.price <= 150);
  return (inBand.length ? inBand : picks)[0];
}

// What the brand's content is missing, from facts we read. Each gap has a plain sentence that quotes
// the store, never a guess.
function gapsOf(b, today, cat) {
  const gaps = [];
  const p = pickProduct(b, cat);
  const n = Math.max(1, Math.round(b.avg_images || 0));
  if (p && p.video === false) gaps.push({ id: 'no_video', text: `No video on ${the(p.title)} product page`, pitch: `I saw ${the(p.title)} page has photos but no video yet.` });
  if (p && p.listed && today && daysBetween(p.listed, today) <= 75 && daysBetween(p.listed, today) >= 0) gaps.push({ id: 'new_launch', text: `New on the store: ${p.title}, listed ${time.shortDate(p.listed)}`, pitch: `I saw you listed ${p.title} on ${time.shortDate(p.listed).replace(/^[A-Z][a-z]{2}, /, '')}.` });
  if (b.avg_images != null && b.avg_images < 4) gaps.push({ id: 'few_photos', text: `Product pages show about ${n} photo${n === 1 ? '' : 's'} each`, pitch: `I saw your product pages show about ${n} photo${n === 1 ? '' : 's'} each.` });
  if (b.products && b.products <= 40) gaps.push({ id: 'small_catalog', text: `A small catalog of ${b.products} products`, pitch: `I saw you keep a focused catalog of ${b.products} products.` });
  if (!gaps.length && p) gaps.push({ id: 'one_clip', text: `One short clip for ${p.title} could sit on the product page and run as an ad`, pitch: `I think one short clip for ${p.title} could work on its product page and as an ad.` });
  return gaps;
}

// Fit for a first pitch: small stores answer, new launches need content, few photos and no video
// mean a clip changes the page. 0 to 100.
function scoreBrand(b, today, cat) {
  let s = 40;
  const n = b.products || 0;
  if (cat && !fits(b, cat)) s -= 25;
  if (n >= 5 && n <= 60) s += 18;
  else if (n > 60 && n <= 150) s += 8;
  else if (n > 250) s -= 10;
  const p = pickProduct(b, cat);
  if (p && NOT_FILMABLE.test(p.title)) s -= 15;
  if (p && p.price >= 15 && p.price <= 120) s += 10;
  if (p && p.video === false) s += 12;
  if (b.avg_images != null && b.avg_images < 4) s += 8;
  if (b.newest && today) {
    const d = daysBetween(b.newest, today);
    if (d >= 0 && d <= 75) s += 12;
    else if (d > 365) s -= 8;
  }
  if (!b.country || b.country === 'US') s += 4;
  if (b.filled) s -= 6;
  return Math.max(0, Math.min(100, s));
}

function brandRow(b, rank, today, cat) {
  const p = pickProduct(b, cat);
  const gaps = gapsOf(b, today, cat);
  return {
    rank,
    name: brandName(b.name) || b.domain,
    domain: b.domain,
    url: `https://${b.domain}`,
    country: b.country || '',
    products: b.products || null,
    price_range: b.price_low && b.price_high ? `${money.usd(b.price_low)} to ${money.usd(b.price_high)}` : '',
    newest: b.newest || '',
    product: p ? { title: p.title, price: p.price, url: `https://${b.domain}/products/${p.handle}`, handle: p.handle, image: p.image || null, video: p.video == null ? null : p.video, listed: p.listed || '' } : null,
    gaps,
    gap: gaps.length ? gaps[0].text : '',
    score: scoreBrand(b, today, cat),
    read: b.read || 'snapshot',
    checked: b.checked || brandsData().checked,
    category: b.category || '',
  };
}

// ---------- live reads (public store files only, robots respected) ----------

async function readStore(ctx, domain) {
  const base = `https://${domain}`;
  if (!(await web.allowed(ctx, `${base}/products.json`))) return null;
  const data = (r) => (r && r.data) || null;
  const [meta, pj] = await Promise.all([web.getJson(ctx, `${base}/meta.json`, { timeoutMs: 10000 }).then(data).catch(() => null), web.getJson(ctx, `${base}/products.json?limit=250`, { timeoutMs: 15000, maxBytes: 8e6 }).then(data).catch(() => null)]);
  if (!pj || !Array.isArray(pj.products) || !pj.products.length) return null;
  const prods = pj.products;
  const prices = [];
  let newest = '';
  let imgs = 0;
  for (const x of prods) {
    for (const v of x.variants || []) if (Number(v.price) > 0) prices.push(Number(v.price));
    if (x.published_at && x.published_at > newest) newest = x.published_at;
    imgs += (x.images || []).length;
  }
  prices.sort((a, b) => a - b);
  const picks = prods
    .slice()
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    .map((x) => ({ title: safeName(x.title), handle: x.handle, price: Number((x.variants && x.variants[0] && x.variants[0].price) || 0), images: (x.images || []).length, listed: String(x.published_at || '').slice(0, 10), image: (x.images && x.images[0] && x.images[0].src) || null }))
    .filter((p) => p.title && p.handle && p.price > 0)
    .slice(0, 4);
  const name = safeName(meta && meta.name, 40) || (findSnapshot(domain) || {}).name || domain;
  return {
    domain,
    name,
    country: (meta && meta.country) || '',
    products: (meta && meta.published_products_count) || prods.length,
    price_low: prices[0] || null,
    price_high: prices[prices.length - 1] || null,
    newest: newest.slice(0, 10),
    avg_images: Math.round((imgs / prods.length) * 10) / 10,
    picks,
    read: 'live',
    checked: time.today(ctx),
  };
}

// Does the product page carry a video? Shopify's /products/<handle>.js lists media types.
async function hasVideo(ctx, domain, handle) {
  const j = await web.getJson(ctx, `https://${domain}/products/${handle}.js`, { timeoutMs: 10000, maxBytes: 3e6 }).then((r) => (r && r.data) || null).catch(() => null);
  if (!j || !Array.isArray(j.media)) return null;
  return { video: j.media.some((m) => /video/.test(m.media_type || '')), photos: j.media.filter((m) => m.media_type === 'image').length, image: j.featured_image ? (String(j.featured_image).startsWith('//') ? `https:${j.featured_image}` : j.featured_image) : null };
}

// ---------- script ----------

function hookFor(brandName, product, cat) {
  const price = product && product.price ? money.usd(product.price) : '';
  const options = [
    `${product.title}. Here is a first look.`,
    `${product.title} from ${brandName}${price ? `, ${price}` : ''}. Here is what you get.`,
    `If you are into ${cat.label.toLowerCase()}, watch this before you scroll.`,
  ];
  return text.pickBy(`${brandName}${product.title}`, options);
}

// A 15-second script to film once the member has the product. Bracketed lines are filled with their
// own honest words on first use. Every fact is from the store page.
function scriptFor(brand, cat) {
  const p = brand.product || { title: brand.name, price: 0 };
  const short = text.clip(String(p.title).split(/ [-,|] /)[0], 40);
  const shots = cat.shots.map((s) => text.fill(s, { product: the(short) }).replace(/^the /, 'The '));
  const lines = [
    { at: 0, end: 3, say: hookFor(brand.name, p, cat), caption: hookFor(brand.name, p, cat), shot: shots[0] },
    { at: 3, end: 7, say: `This is ${p.title} from ${brand.name}.`, caption: `${p.title}`, shot: shots[1] },
    { at: 7, end: 11, say: '[Your honest first reaction, filmed on first use.]', caption: 'Real first-use reaction goes here', shot: shots[2] },
    { at: 11, end: 15, say: `It's ${p.price ? money.usd(p.price) : 'on their site'}${p.price ? ' on their site' : ''}, ${brand.domain}.`, caption: `${brand.domain}`, shot: shots[3] },
  ];
  return {
    title: `15-second concept for ${p.title}`,
    angle: cat.angle,
    length: 15,
    aspect: '9:16',
    lines,
    notes: ['Film in daylight by a window, phone at eye level, 9:16.', 'Two or three takes of each line. Keep the label facing camera.', 'Only say what you saw and felt. Never say you have used it for weeks if you haven\'t.', `If you post it on your own account, say "${text.fill(RULES.disclosure.spoken, { brand: brand.name })}" and add "${text.fill(RULES.disclosure.caption, { brand: brand.name })}".`],
  };
}

function scriptMd(brand, script) {
  const p = brand.product || {};
  const rows = script.lines.map((l, i) => `| ${l.at}-${l.end}s | ${l.say} | ${l.shot} | ${l.caption} |`).join('\n');
  return [
    `# ${script.title}`,
    '',
    `Brand: ${brand.name} (${brand.url})`,
    p.url ? `Product: ${p.title}, ${money.usd(p.price)} (${p.url})` : '',
    `Angle: ${script.angle}. Length: ${script.length} seconds, ${script.aspect}.`,
    `Facts read from the store on ${brand.checked}.`,
    '',
    '| Time | Say | Shot | On-screen caption |',
    '| --- | --- | --- | --- |',
    rows,
    '',
    '## Notes',
    ...script.notes.map((n) => `- ${n}`),
    '',
  ]
    .filter((x) => x !== '')
    .join('\n');
}

// ---------- pitches ----------

// The first message, the email and both follow-ups for one brand, in DM and email form. concept: a
// 15-second concept preview was made for this brand (it goes with the message); without one, the
// message offers to make it, so no brand is told about a video that doesn't exist. opener: an AI first
// line that replaces the store fact. Emails end like every first email: name, business, mailing
// address and the opt-out line (D28). No price, no claims about views or sales.
// "Odor-Blocking Dog Poop Bags Refill Rolls With 3X Protect Technology" -> "Odor-Blocking Dog Poop Bags
// Refill Rolls": the name to repeat after the first full mention.
function shortTitle(t, max = 40) {
  const s = text.plain(String(t || '')).split(/ [-|,] | \(/)[0];
  if (s.length <= max) return s;
  const head = s.split(/\s+(?:with|for|in|and|by|from|plus)\s+/i)[0];
  if (head.length <= max && head.split(' ').length >= 2) return head;
  // No natural break: the end of the name, where the product noun usually is ("...Vitamin C Serum").
  const words = head.split(' ');
  let out = '';
  for (let i = words.length - 1; i >= 0; i--) {
    const next = out ? `${words[i]} ${out}` : words[i];
    if (next.length > max) break;
    out = next;
  }
  return out || text.clip(s, max);
}

function pitchFor(brand, sender = {}, { concept = false, opener = '' } = {}) {
  const { outreach } = require('../../_kit');
  const p = brand.product || { title: brand.name };
  const short = shortTitle(p.title);
  const me = text.plain(sender.name || '') || '[your name]';
  const g = brand.gaps && brand.gaps[0];
  const factLine = text.plain(opener || (g ? g.pitch || `${g.text}.` : `I saw ${p.title} on your site.`));
  const team = `${brand.name} team`;
  const sign = [me, text.plain(sender.business || ''), text.plain(sender.address || '') || outreach.ADDRESS_HOLD].filter((x, i, a) => x && a.indexOf(x) === i).join('\n');
  const asEmail = (...paras) => [`Hi ${team},`, '', ...paras.filter(Boolean).flatMap((x) => [x, '']), sign, '', outreach.OPT_OUT].join('\n');
  const work = sender.site ? `You can see my work here: ${sender.site}` : '';
  const dm = concept
    ? `Hi ${team}! I make short product videos for small brands. ${factLine} I made a 15-second concept for ${short} to show what a video could look like, only for you and never posted. Want me to send it here?`
    : `Hi ${team}! I make short product videos for small brands. ${factLine} Could I make you a free 15-second concept for ${short}? It's made from your product page, only for you, and never posted.`;
  const subject = text.clip(concept ? `A 15-second video idea for ${short}` : `A free video idea for ${short}`, 90);
  const email = asEmail(
    `I'm ${me}, and I make short vertical product videos that brands post and run as ads. ${factLine}`,
    concept ? `I put together a 15-second concept for ${p.title} from the details on your product page. It's attached, made only for you, and not posted anywhere.` : `I'd like to make you a free 15-second concept for ${p.title} from the details on your product page, made only for you and never posted.`,
    concept ? 'If you like the direction, I can film the real one once I have the product. Want me to send my rates?' : 'Want me to send it over?',
    work,
  );
  const follow1 = concept ? `Hi again, just checking you saw ${the(short)} concept. Happy to change the angle if you have a different product in mind.` : `Hi again! Still happy to make the free 15-second concept for ${short}, or for whichever product matters most to you right now.`;
  const follow2 = `Last note from me on this. If short videos are on your list later this year, I'd love to make one for ${brand.name}. Thanks either way.`;
  const follow1Email = asEmail(concept ? `Just checking ${the(short)} concept came through. Happy to change the angle if you have a different product in mind.` : `Floating this back up: I'm still happy to make a free 15-second concept for ${short}, or for whichever product matters most to you right now.`);
  const follow2Email = asEmail(follow2);
  return { brand: brand.name, domain: brand.domain, product: p.title, short, subject, dm, email, follow1, follow2, follow1Email, follow2Email, concept: !!concept };
}

// ---------- contacts, one brand, the Pipeline row ----------

// Where to reach a brand, from its own homepage (and its contact page when the homepage shows no
// email): an email, Instagram and TikTok handles, the contact page. Public pages, robots respected.
// Only a successful read is cached, so a network blip doesn't hide a brand's email for a week.
async function contactOf(ctx, domain) {
  if (!domain) return null;
  const kit = require('../../_kit');
  return web.cached(ctx, `ugc:contact:v1:${domain}`, 24 * 7, async () => {
    const home = await web.fetchPage(ctx, `https://${domain}/`, { timeoutMs: 10000, maxBytes: 1.5e6 }).catch(() => null);
    if (!home || !home.html) return null;
    const pg = kit.scan.parsePage(home.html, home.url);
    let emails = (pg.contacts && pg.contacts.emails) || [];
    const own = (u) => {
      try {
        return web.domainOf(u) === web.domainOf(home.url);
      } catch {
        return false;
      }
    };
    let contactPage = pg.links && pg.links.contact && own(pg.links.contact) ? pg.links.contact : '';
    if (!emails.length) {
      const url = contactPage || `${new URL(home.url).origin}/pages/contact`;
      const p = await web.fetchPage(ctx, url, { timeoutMs: 10000, maxBytes: 1.5e6 }).catch(() => null);
      if (p && p.html) {
        const cp = kit.scan.parsePage(p.html, p.url);
        emails = (cp.contacts && cp.contacts.emails) || [];
        contactPage = p.url;
      }
    }
    const so = pg.socials || {};
    return { reachable: true, email: emails[0] || '', instagram: so.instagram || '', tiktok: so.tiktok || '', facebook: so.facebook || '', contactPage, checked: time.today(ctx) };
  });
}

// Brands to add when the member's own category runs short (they film close to the same way).
const NEAR = { skincare: ['makeup', 'haircare'], haircare: ['skincare', 'makeup'], makeup: ['skincare', 'haircare'], pet: ['baby-kids', 'home-kitchen'], 'coffee-tea': ['snacks-drinks'], 'snacks-drinks': ['coffee-tea'], 'home-kitchen': ['cleaning', 'candles'], candles: ['home-kitchen'], jewelry: ['activewear'], activewear: ['jewelry'], 'baby-kids': ['pet', 'home-kitchen'], cleaning: ['home-kitchen'] };

const sameDomain = (a, b) => !!a && !!b && (a === b || a === `www.${b}` || b === `www.${a}`);

// One brand as a brand row, freshest first: shop.read_store's live read of its store (when it read
// this brand, not a sample), then the dated snapshot, then what its Pipeline row kept.
// lead: from kit talk (or { website, name }); read: shop.read_store output; category: an id.
function brandFor({ lead = {}, read = null, category = '', today = '' } = {}) {
  const domain = web.domainOf(lead.website || '') || lead.domain || '';
  const snap = domain ? findSnapshot(domain) : null;
  const data = (lead && lead.data) || {};
  const catId = CATS[category] ? category : CATS[data.category] ? data.category : snap && CATS[snap.category] ? snap.category : 'skincare';
  const cat = catOf(catId);
  const fresh = read && read.ok && !read.sample && sameDomain(read.domain, domain) ? read : null;
  let raw = snap;
  if (fresh) {
    const picks = (fresh.picks || [])
      .map((p) => {
        const title = safeName(p.title);
        if (!title || !p.handle || !(Number(p.price) > 0)) return null;
        const old = snap && (snap.picks || []).find((x) => x.handle === p.handle);
        return { title, handle: p.handle, price: Number(p.price), images: p.images, listed: p.listed || '', image: p.image || (old && old.image) || null, ...(old && old.video != null ? { video: old.video } : {}) };
      })
      .filter(Boolean);
    raw = {
      ...(snap || {}),
      domain,
      name: safeName(fresh.name, 40) || (snap && snap.name) || lead.name || domain,
      country: fresh.country || (snap && snap.country) || '',
      products: fresh.products,
      price_low: fresh.price_low,
      price_high: fresh.price_high,
      newest: fresh.newest,
      avg_images: fresh.avg_images,
      types: (fresh.types || []).map((t) => (t && typeof t === 'object' ? t.type : t)).filter(Boolean),
      picks: picks.length ? picks : (snap && snap.picks) || [],
      read: 'live',
      checked: fresh.checked || today,
    };
  }
  if (raw && (raw.picks || []).length) {
    const row = brandRow(raw, 1, today, cat);
    return { ...row, name: lead.inPipeline && lead.name ? lead.name : row.name, category: catId, fresh: !!fresh };
  }
  const p = data.product && data.product.title ? data.product : null;
  return { rank: 1, name: lead.name || domain || 'This brand', domain, url: domain ? `https://${domain}` : '', country: '', products: null, price_range: '', newest: '', product: p ? { title: p.title, price: p.price || 0, url: p.url || '', handle: '', image: null, video: null, listed: '' } : null, gaps: [], gap: '', score: Number.isFinite(lead.score) ? lead.score : null, read: data.read || 'pipeline', checked: data.checked || '', category: catId, fresh: false };
}

// The Pipeline row for one brand (contract 7 and 13), built with kit leads.pipelineLead from the store
// facts and the messages. Channel: an email from their site first (the concept can go with it), then
// an Instagram DM, then the contact form on their store; follow-ups come in the same form.
function pipelineRow(row, msgs, contact, { stage = 'found' } = {}) {
  const kit = require('../../_kit');
  const c = contact && contact.reachable ? contact : null;
  const site = c ? { url: row.url, socials: { instagram: c.instagram || null, facebook: c.facebook || null, tiktok: c.tiktok || null, youtube: null }, contacts: { emails: c.email ? [c.email] : [], phones: [] }, links: { contact: c.contactPage || null } } : null;
  const day = row.checked ? time.longDate(row.checked) : '';
  const facts = (row.gaps || []).map((g) => `${g.text}${day ? ` (read from their store on ${day})` : ''}`);
  const lead = {
    key: `site:${row.domain}`,
    name: row.name,
    siteName: row.name,
    source: 'store',
    website: row.url,
    siteStatus: 'ok',
    site,
    score: row.score,
    rank: row.rank,
    category: { id: row.category },
    gaps: (row.gaps || []).map((g, i) => ({ id: g.id, why: facts[i], chip: g.text, source: 'website' })),
    checked: row.checked,
    sample: false,
  };
  const draft = { dm: msgs.dm, email: { subject: msgs.subject, body: msgs.email }, walkIn: '', followUp1: msgs.follow1, followUp2: msgs.follow2, followUp1Email: msgs.follow1Email, followUp2Email: msgs.follow2Email, facts };
  const out = kit.leads.pipelineLead(lead, { service: NICHE.service, draft, stage });
  const channel = c && c.email ? 'email' : c && c.instagram ? 'ig' : 'site';
  out.channel = channel;
  out.msg.follow1 = channel === 'ig' ? msgs.follow1 : msgs.follow1Email;
  out.msg.follow2 = channel === 'ig' ? msgs.follow2 : msgs.follow2Email;
  out.data = {
    ...out.data,
    category: row.category,
    product: row.product ? { title: row.product.title, url: row.product.url, price: row.product.price } : null,
    read: row.read,
    store: { products: row.products, prices: row.price_range, newest: row.newest },
    ...(c && c.contactPage ? { contactPage: c.contactPage } : {}),
    ...(msgs.concept ? { conceptMade: row.conceptMade || '' } : {}),
  };
  return out;
}

// ---------- rate card ----------

function rateCard(level = 'new', { base } = {}) {
  const lv = RATES.levels[level] || RATES.levels.new;
  const video = money.num(base, null) && money.num(base) >= 30 ? Math.round(money.num(base)) : lv.video;
  const addons = RATES.addons.map((a) => ({ id: a.id, label: a.label, unit: a.unit, price: a.kind === 'pct' ? money.nicePrice(video * a.value) : a.value, note: a.note }));
  const b = RATES.bundle;
  const each = money.nicePrice(video * (1 - b.discount));
  const bundle = { label: b.label, videos: b.videos, each, total: each * b.videos, note: b.note };
  const fees = RATES.fees.map((f) => ({ platform: f.platform, fee: money.round(video * f.rate + f.fixed, 2), keep: money.round(video - (video * f.rate + f.fixed), 2) }));
  return { level, levelLabel: lv.label, video, note: lv.note, addons, bundle, fees, turnaround: RATES.defaults.turnaround_days, revisions: RATES.defaults.revisions };
}

// The use in plain words. "the brand" is capitalized only where a sentence starts.
function terms(brandName = 'the brand') {
  const name = text.oneLine(String(brandName || '')) || 'the brand';
  const generic = /^the brand$/i.test(name);
  const at = (start) => (generic ? (start ? 'The brand' : 'the brand') : name);
  return RULES.usage_terms.map((t) => ({ id: t.id, title: t.title, text: t.text.replace(/\{brand\}/g, (m, i, all) => at(!all.slice(0, i).trim() || /[.!?]\s+$/.test(all.slice(0, i)))) }));
}

module.exports = { the, shortTitle, fits, NICHE, RATES, RULES, CATS, CAT_IDS, NEAR, safeName, brandName, catOf, parseStores, snapshot, findSnapshot, pickProduct, gapsOf, scoreBrand, brandRow, brandFor, readStore, hasVideo, contactOf, pipelineRow, scriptFor, scriptMd, pitchFor, rateCard, terms, brandsData };
