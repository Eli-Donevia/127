// The mock homepage for one business, built only from what its own website (or an OpenStreetMap or
// sample listing) says, dated. Facts in, then a phone-first HTML page (no scripts) and a phone-size
// SVG drawing of the same page for the PNG. Where their site says nothing, the page says so plainly
// ("Sample text") instead of inventing a fact.

const { text, color, files, svg, time } = require('../../_kit');

const GENERIC = /^(home|about|about us|contact|contact us|hours|our hours|location|locations|find us|follow us|testimonials?|reviews?|gallery|blog|news|faq|faqs|menu|our menu|services|our services|welcome|get in touch|connect|social|newsletter|join our list|what our customers say|what we do|pricing|careers|privacy policy|terms)$/i;

// Common services by kind of business, used only when their site lists none (marked "Sample text").
const DEFAULT_SERVICES = {
  food: ['Dine in', 'Takeout', 'Catering'],
  home: ['Repairs', 'Installs', 'Free estimates'],
  beauty: ['Cuts and styling', 'Color', 'Treatments'],
  health: ['New patient visits', 'Checkups', 'Same-week appointments'],
  auto: ['Repairs', 'Maintenance', 'Inspections'],
  fitness: ['Group classes', 'Personal training', 'Intro session'],
  retail: ['New arrivals', 'Gift sets', 'Local pickup'],
  pro: ['Consultations', 'Planning', 'Ongoing support'],
  other: ['Services', 'Packages', 'Support'],
};
const FAMILY = [
  [/restaurant|cafe|bakery|bar|food|coffee|pizza|taco|grill|kitchen|diner/i, 'food'],
  [/plumb|hvac|electric|roof|landscap|clean|contract|lawn|paint|handyman|home/i, 'home'],
  [/salon|barber|nail|spa|beauty|groom|lash|skin/i, 'beauty'],
  [/dent|chiro|clinic|vet|health|therapy|medical/i, 'health'],
  [/auto|car|tire|detail|mechanic/i, 'auto'],
  [/gym|fitness|yoga|pilates|studio/i, 'fitness'],
  [/boutique|shop|store|florist|gift/i, 'retail'],
  [/law|attorney|account|insurance|realt|tax|cpa/i, 'pro'],
];
function familyOf(words) {
  const w = String(words || '');
  for (const [re, fam] of FAMILY) if (re.test(w)) return fam;
  return 'other';
}

const TRADE = /(roofing|plumbing|electric(?:al)?|heating(?: (?:&|and) air)?|hvac|builders|construction|restoration|home services|landscaping|lawn care|cleaning|painting|remodeling|salon|barbershop|barber|dental|dentistry|chiropractic|auto repair|auto|bakery|cafe|coffee|pizza|taqueria|grill|kitchen|tacos|bbq|law|insurance|realty|fitness|yoga|spa|nails)/i;
// "Roofing in Des Moines" from the name; never a claim about quality.
function headlineOf(name, what, town) {
  const m = String(name || '').match(TRADE);
  const trade = m ? m[1].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ And /, ' and ') : '';
  const where = town ? ` in ${town}` : '';
  if (trade) return `${trade}${where}`;
  if (what && !/^(company|business|work)$/i.test(what)) return `${what.replace(/^\w/, (c) => c.toUpperCase())}${where}`;
  return `${name || 'Your business'}${where}`;
}

// "Service call $85" -> "Service call"; null when the words around the price aren't a clean label.
function priceLabel(p) {
  const ctx = text.oneLine(p.context || '');
  const at = ctx.search(new RegExp(`\\$\\s?${String(p.amount).replace('.', '\\.')}(?![\\d])`));
  if (at < 0) return null;
  const before = ctx.slice(0, at).split(/[.!?:;|]/).pop().trim().split(/\s+/).slice(-4);
  while (before.length && /^(pricing|prices|our|and|or|the|\$?\d+)$/i.test(before[0])) before.shift();
  const joined = before.join(' ');
  const from = /\sfrom$/i.test(joined);
  const label = joined.replace(/\s+from$/i, '').trim();
  return label.length >= 3 && label.length <= 32 && /^[A-Za-z]/.test(label) ? `${label.replace(/^\w/, (c) => c.toUpperCase())}${from ? ': from' : ':'}` : null;
}

function telOf(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  return d.length >= 10 ? (d.startsWith('+') ? d : `+1${d.slice(-10)}`) : '';
}

// Everything the mock can say, each fact with where it came from.
function factsFrom({ lead = {}, scan = null, name = '', city = '', today = '2026-10-19' } = {}) {
  const s = scan && scan.reachable && !scan.parked ? scan : null;
  const L = require('../../_kit').leads;
  const google = lead.source === 'google';
  const cat = lead.category || {};
  const bizName = text.oneLine(name || L.exportName(lead) || (s && L.siteName(s)) || '');
  const what = text.oneLine(cat.one || cat.what || '');
  const fam = familyOf(`${cat.id || ''} ${what} ${(s && s.title) || ''} ${bizName}`);
  const found = [];
  const services = [];
  for (const h of (s && s.headings) || []) {
    const t = text.oneLine(h).replace(/[:.!]+$/, '');
    if (t.length < 3 || t.length > 40 || GENERIC.test(t) || /\d{3}|©|cookie|copyright|@/i.test(t)) continue;
    if (bizName && t.toLowerCase() === bizName.toLowerCase()) continue;
    if (!services.some((x) => x.toLowerCase() === t.toLowerCase())) services.push(t);
    if (services.length >= 4) break;
  }
  if (services.length) found.push(`Services from the headings on their site: ${services.join(', ')}.`);
  const sampleServices = services.length < 2;
  const phone = (s && s.contacts && s.contacts.phones && s.contacts.phones[0]) || (!google && lead.phone) || '';
  if (phone) found.push(`Phone: ${phone}.`);
  const rawHours = s && s.hours ? text.oneLine(s.hours).replace(/^(our )?hours:?\s*/i, '') : '';
  // Only hours that read as a range ("Monday to Friday 7am to 6pm"); a fragment like "THURSDAY 9PM" is left out.
  const hours = /\d/.test(rawHours) && /(\bto\b|-|until|till)/i.test(rawHours) && /(mon|tue|wed|thu|fri|sat|sun|daily|every day)/i.test(rawHours) ? text.clip(rawHours, 90) : '';
  if (hours) found.push(`Hours: ${hours}.`);
  const description = s && s.description ? text.clip(text.oneLine(s.description), 150) : '';
  if (description) found.push(`Their Google description: "${description}"`);
  const offer = s && s.offer && s.offer.kind !== 'none' && s.offer.text ? text.clip(text.oneLine(s.offer.text), 80) : '';
  if (offer) found.push(`Offer on their site: "${offer}"`);
  const prices = [];
  for (const p of (s && s.prices) || []) {
    const label = priceLabel(p);
    if (label && !prices.some((x) => x.label === label)) prices.push({ amount: p.amount, per: p.per || '', label });
    if (prices.length >= 3) break;
  }
  const primary = (s && s.colors && s.colors.primary) || null;
  const accent = (s && s.colors && s.colors.accent) || null;
  if (primary) found.push(`Brand color from their site: ${primary}.`);
  const booking = s && s.booking && s.booking.length ? (s.booking[0].name || s.booking[0]) : '';
  const bookUrl = (s && s.links && s.links.book) || '';
  const real = (u) => /^https:\/\//.test(u || '') && !L.isSampleUrl(u);
  const logo = real(s && s.images && s.images.logo) ? s.images.logo : '';
  const photos = ((s && s.images && s.images.photos) || []).filter(real).slice(0, 3);
  const ig = (s && s.socials && s.socials.instagram) || '';
  const place = text.oneLine(city || lead.city || '');
  const town = place.split(',')[0].trim();
  return {
    name: bizName,
    nameKnown: !!bizName,
    what,
    family: fam,
    city: place,
    town,
    headline: headlineOf(bizName, what, town),
    description,
    services: sampleServices ? DEFAULT_SERVICES[fam] : services,
    sampleServices,
    phone,
    tel: telOf(phone),
    hours,
    offer,
    prices,
    booking,
    bookUrl: /^https:\/\//.test(bookUrl) ? bookUrl : '',
    logo,
    photos,
    instagram: ig,
    website: (s && s.url) || lead.website || '',
    siteStatus: lead.siteStatus || (s ? 'ok' : lead.website ? 'unchecked' : 'none'),
    primary,
    accent,
    foundOn: time.longDate(today),
    found,
    sample: !!(lead.sample || (scan && scan.sample)),
  };
}

function paletteOf(f) {
  const p = color.palette(f.primary && color.isHex(f.primary) ? f.primary : f.family === 'food' ? 'warm' : f.family === 'home' ? 'clean' : f.family === 'beauty' ? 'playful' : 'calm');
  return { ...p, from: f.primary ? 'their website' : 'a starter palette (no brand color found on their site)' };
}

const esc = (s) => files.esc(String(s == null ? '' : s));

// The mock homepage as one self-contained HTML file. No scripts (JSON-LD only).
function html(f, { by = '', p = paletteOf(f), year = new Date().getUTCFullYear() } = {}) {
  const name = f.name || 'Your business';
  const call = f.tel ? `<a class="btn" href="tel:${esc(f.tel)}">Call ${esc(f.phone)}</a>` : '<span class="btn ghost">Call button goes here</span>';
  const book = f.bookUrl ? `<a class="btn alt" href="${esc(f.bookUrl)}">Book online</a>` : `<span class="btn alt">${f.family === 'food' ? 'Order or reserve' : 'Get a free quote'}</span>`;
  const tag = '<span class="tag">Sample text</span>';
  const services = f.services.map((s) => `<div class="card"><h3>${esc(s)}</h3>${f.sampleServices ? tag : ''}</div>`).join('');
  const photo = f.photos[0] ? `<img class="hero-img" src="${esc(f.photos[0])}" alt="${esc(name)}">` : '';
  const prices = f.prices.length ? `<section><h2>Prices</h2>${f.prices.map((x) => `<p class="price">${esc(x.label)} <b>$${esc(x.amount)}${x.per ? ` a ${esc(x.per)}` : ''}</b></p>`).join('')}<p class="note">As listed on their site on ${esc(f.foundOn)}.</p></section>` : '';
  const ld = { '@context': 'https://schema.org', '@type': f.family === 'food' ? 'Restaurant' : 'LocalBusiness', name, ...(f.phone ? { telephone: f.phone } : {}), ...(f.city ? { address: { '@type': 'PostalAddress', addressLocality: f.town } } : {}) };
  const css = `
:root{--p:${p.primary};--on:${p.onPrimary};--a:${p.accent};--ink:${p.ink};--paper:${p.paper};--surface:${p.surface};--muted:${p.muted};--line:${p.line}}
*{box-sizing:border-box}body{margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:var(--ink);background:var(--paper);line-height:1.5}
.banner{background:#111;color:#fff;font-size:13px;padding:8px 16px;text-align:center}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px}.brand img{height:36px;width:auto}
.mark{width:36px;height:36px;border-radius:10px;background:var(--p);color:var(--on);display:grid;place-items:center;font-weight:800}
.hero{background:var(--p);color:var(--on);padding:40px 20px 32px}.hero h1{font-size:34px;line-height:1.1;margin:0 0 12px;max-width:640px}
.hero p{margin:0 0 20px;font-size:17px;opacity:.95;max-width:560px}.hero-img{width:100%;max-height:320px;object-fit:cover;display:block}
.btn{display:inline-block;background:#fff;color:var(--p);font-weight:700;text-decoration:none;padding:13px 18px;border-radius:12px;margin:0 8px 8px 0}
.btn.alt{background:var(--a);color:${p.onAccent}}.btn.ghost{opacity:.85}
section{padding:28px 20px;max-width:880px;margin:0 auto}h2{font-size:24px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}.card h3{margin:0;font-size:17px}
.tag{display:inline-block;font-size:11px;background:var(--surface);color:var(--muted);border-radius:6px;padding:2px 6px;margin-top:8px}
.info{background:var(--surface);border-radius:14px;padding:16px}.price{margin:6px 0}.note{font-size:13px;color:var(--muted)}
footer{padding:24px 20px;text-align:center;font-size:13px;color:var(--muted);border-top:1px solid var(--line)}
@page{size:Letter;margin:0.5in}@media print{header{position:static}.banner{background:#fff;color:#111;border-bottom:1px solid #ccc}}`;
  const body = `
<div class="banner">Mock homepage for ${esc(name)}, made by ${esc(by || 'a local web designer')} on ${esc(f.foundOn)} from what ${f.siteStatus === 'ok' ? 'your current website' : 'your listing'} says. Not live, not posted anywhere.</div>
<header><div class="brand">${f.logo ? `<img src="${esc(f.logo)}" alt="${esc(name)} logo">` : `<span class="mark">${esc(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 1) || 'B')}</span>`}<span>${esc(name)}</span></div>${f.tel ? `<a class="btn" style="background:var(--p);color:var(--on);margin:0" href="tel:${esc(f.tel)}">Call</a>` : ''}</header>
${photo}
<div class="hero"><h1>${esc(f.headline)}</h1><p>${esc(f.description || (f.offer ? f.offer : `Call or book in a minute${f.town ? `, right here in ${f.town}` : ''}.`))}</p>${call}${book}</div>
<section><h2>What we do</h2><div class="grid">${services}</div>${f.sampleServices ? '<p class="note">Their site did not list services we could read, so these are placeholders to swap.</p>' : ''}</section>
${f.offer && f.description ? `<section><div class="info"><b>${esc(f.offer)}</b><p class="note">As found on their site on ${esc(f.foundOn)}.</p></div></section>` : ''}
${prices}
<section><h2>Visit or call</h2><div class="info">${f.hours ? `<p><b>Hours:</b> ${esc(f.hours)}</p>` : '<p><b>Hours:</b> add your hours here (we could not find them on your site).</p>'}${f.phone ? `<p><b>Phone:</b> <a href="tel:${esc(f.tel)}">${esc(f.phone)}</a></p>` : ''}${f.town ? `<p><b>Area:</b> ${esc(f.city)}</p>` : ''}${f.instagram ? `<p><b>Instagram:</b> @${esc(f.instagram)}</p>` : ''}</div></section>
<footer>&copy; ${year} ${esc(name)}</footer>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  return files.htmlDoc({ title: `${name}: mock homepage`, css, body });
}

// A phone-size drawing of the same page (390 x 844 points), for the PNG.
function phoneSvg(f, { p = paletteOf(f), by = '' } = {}) {
  const W = 390;
  const H = 844;
  const name = f.name || 'Your business';
  const parts = [];
  parts.push(svg.rect({ x: 0, y: 0, w: W, h: H, fill: p.paper }));
  parts.push(svg.rect({ x: 0, y: 0, w: W, h: 44, fill: '#111111' }));
  parts.push(svg.text({ x: W / 2, y: 28, lines: [text.clip(`Mock for ${name}${by ? ` by ${by}` : ''}`, 46)], size: 13, weight: 600, fill: '#ffffff', anchor: 'middle' }));
  // header
  parts.push(svg.rect({ x: 0, y: 44, w: W, h: 64, fill: '#ffffff' }));
  parts.push(svg.rect({ x: 16, y: 58, w: 36, h: 36, r: 10, fill: p.primary }));
  parts.push(svg.text({ x: 34, y: 82, lines: [name.replace(/[^A-Za-z0-9]/g, '').slice(0, 1) || 'B'], size: 18, weight: 800, fill: p.onPrimary, anchor: 'middle' }));
  const nm = svg.fit(name, { width: f.tel ? 220 : 300, height: 40, maxSize: 18, minSize: 12, maxLines: 2, weight: 800 });
  parts.push(svg.text({ x: 62, y: nm.lines.length > 1 ? 72 : 82, lines: nm.lines, size: nm.size, weight: 800, fill: p.ink }));
  if (f.tel) {
    parts.push(svg.rect({ x: W - 82, y: 60, w: 66, h: 32, r: 10, fill: p.primary }));
    parts.push(svg.text({ x: W - 49, y: 81, lines: ['Call'], size: 14, weight: 700, fill: p.onPrimary, anchor: 'middle' }));
  }
  parts.push(svg.line({ x1: 0, y1: 108, x2: W, y2: 108, stroke: p.line, strokeWidth: 1 }));
  // hero
  const hl = svg.fit(f.headline, { width: W - 40, height: 130, maxSize: 34, minSize: 20, maxLines: 3, weight: 800 });
  const sub = svg.wrap(text.clip(f.description || f.offer || `Call or book in a minute${f.town ? `, right here in ${f.town}` : ''}.`, 120), { width: W - 64, size: 15 }).slice(0, 3);
  const subY = 150 + hl.lines.length * Math.round(hl.size * 1.1) + 8;
  const by1 = subY + sub.length * 20 + 18;
  const heroH = by1 + 48 + 28 - 108;
  parts.push(svg.rect({ x: 0, y: 108, w: W, h: heroH, fill: p.primary }));
  parts.push(svg.text({ x: 20, y: 150, lines: hl.lines, size: hl.size, weight: 800, fill: p.onPrimary, lineHeight: 1.1 }));
  parts.push(svg.text({ x: 20, y: subY, lines: sub, size: 15, weight: 400, fill: p.onPrimary, lineHeight: 1.35 }));
  parts.push(svg.rect({ x: 20, y: by1, w: 168, h: 48, r: 12, fill: '#ffffff' }));
  parts.push(svg.text({ x: 104, y: by1 + 30, lines: [f.phone ? text.clip(`Call ${f.phone}`, 22) : 'Call us'], size: 14, weight: 700, fill: p.primary, anchor: 'middle' }));
  parts.push(svg.rect({ x: 200, y: by1, w: 170, h: 48, r: 12, fill: p.accent }));
  parts.push(svg.text({ x: 285, y: by1 + 30, lines: [f.bookUrl ? 'Book online' : f.family === 'food' ? 'Order or reserve' : 'Get a free quote'], size: 14, weight: 700, fill: p.onAccent, anchor: 'middle' }));
  // services
  let y = 108 + heroH + 36;
  parts.push(svg.text({ x: 20, y, lines: ['What we do'], size: 21, weight: 800, fill: p.ink }));
  y += 16;
  for (const s of f.services.slice(0, 4)) {
    parts.push(svg.rect({ x: 20, y, w: W - 40, h: 52, r: 12, fill: '#ffffff', stroke: p.line, strokeWidth: 1 }));
    parts.push(svg.rect({ x: 32, y: y + 18, w: 16, h: 16, r: 4, fill: p.accent }));
    parts.push(svg.text({ x: 58, y: y + 32, lines: [text.clip(s, 30)], size: 16, weight: 600, fill: p.ink }));
    if (f.sampleServices) parts.push(svg.text({ x: W - 32, y: y + 31, lines: ['Sample text'], size: 11, weight: 500, fill: p.muted, anchor: 'end' }));
    y += 62;
  }
  // visit card
  y += 8;
  parts.push(svg.rect({ x: 20, y, w: W - 40, h: 96, r: 14, fill: p.surface }));
  parts.push(svg.text({ x: 36, y: y + 30, lines: ['Visit or call'], size: 17, weight: 800, fill: p.ink }));
  const hrs = f.hours ? svg.wrap(`Hours: ${f.hours}`, { width: W - 76, size: 13 }).slice(0, 2) : ['Hours: add your hours here'];
  parts.push(svg.text({ x: 36, y: y + 54, lines: hrs, size: 13, weight: 400, fill: p.muted, lineHeight: 1.3 }));
  if (f.city) parts.push(svg.text({ x: 36, y: y + 86, lines: [text.clip(`Area: ${f.city}`, 44)], size: 13, weight: 400, fill: p.muted }));
  parts.push(svg.text({ x: W / 2, y: H - 14, lines: [`Made ${f.foundOn}. Not live.`], size: 11, weight: 400, fill: p.muted, anchor: 'middle' }));
  return svg.doc({ width: W, height: H, body: parts.join(''), title: `${name} mock homepage` });
}

// What to fix on their current site, best first, from the gaps the scan proved.
const FIX = {
  no_site: 'Give Google a real website to link: one page with your phone, hours and services.',
  site_down: "Get the website back up. It didn't load when I checked.",
  parked: 'Replace the placeholder page with a real homepage.',
  broken_link: 'Fix the website link on your map listing. It goes to a missing page.',
  no_https: 'Turn on https so Chrome stops showing "Not secure".',
  no_mobile: 'Make it phone-ready. Right now it shows up tiny on a phone.',
  stale_footer: 'Update the footer year ({chip}).',
  no_tap_to_call: 'Make the phone number tap-to-call.',
  no_hours: 'Put your hours on the homepage.',
  no_booking: 'Add a way to book or ask for a quote online.',
  no_form: 'Add a short contact form.',
  no_description: 'Write a short description for Google to show under your name.',
  no_schema: 'Give Google your business details as LocalBusiness schema.',
  no_h1: 'Add one clear headline (H1) that says what you do and where.',
  missing_alt: 'Add alt text to your photos.',
  thin_site: 'Add a few lines about what you do, where and for whom.',
  no_email: 'Show an email address or a contact form.',
  no_prices: 'Show a starting price so people can decide faster.',
};
const ORDER = ['no_site', 'site_down', 'parked', 'broken_link', 'no_https', 'no_mobile', 'stale_footer', 'no_tap_to_call', 'no_hours', 'no_booking', 'no_form', 'no_description', 'no_h1', 'no_schema', 'missing_alt', 'thin_site', 'no_email', 'no_prices'];

function fixList(lead) {
  const L = require('../../_kit').leads;
  const gaps = L.shareableGaps(lead || {});
  return ORDER.map((id) => gaps.find((g) => g.id === id))
    .filter(Boolean)
    .slice(0, 5)
    .map((g) => ({ id: g.id, fix: text.plain(FIX[g.id].replace('{chip}', g.chip)), why: text.plain(g.why) }));
}

module.exports = { factsFrom, paletteOf, html, phoneSvg, fixList, familyOf, DEFAULT_SERVICES, FIX };
