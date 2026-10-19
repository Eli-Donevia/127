// Everything we know about the member's business, in one clean object: the form's answers win, then
// the business brain, then what other packs remembered (brand colors). Nothing here is invented:
// a fact the member didn't give stays empty and the page leaves that part out.

const { text, brain, web, time } = require('../../_kit');
const parse = require('./parse');
const { parseHours, hoursLine } = require('./hours');
const { nicheFor, isMobile } = require('./niches');

function pickStr(...vals) {
  for (const v of vals) if (v != null && String(v).trim() !== '') return text.oneLine(String(v));
  return '';
}

// Netlify site names: lowercase letters, digits and dashes.
function siteSlug(name) {
  return text.slug(String(name || 'my-site').replace(/['\u2019]/g, ''), 40) || 'my-site';
}

// A brand color another pack saved (brand.palette, brand.colors...) if it looks like a hex.
function brandMemoryColor(ctx) {
  const m = brain.packMemory(ctx, 'brand');
  const cands = [m.primary, m.color, m.brandColor, m.palette && m.palette.primary, Array.isArray(m.colors) ? m.colors[0] : null, m.colors && m.colors.primary];
  return cands.find((c) => typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c.trim())) || '';
}

// The booking button says what happens: the niche's words ("Book a detail") for a booking page,
// "Reserve a table" for a reservation site.
function bookingLabel(plat, profile) {
  if (plat.kind === 'reserve' || plat.kind === 'order') return plat.label;
  if (plat.kind === 'booking' || plat.kind === 'link') return profile.book && /^(book|save|start|get|work)/i.test(profile.book) ? profile.book : plat.label || 'Book now';
  return plat.label || 'Book now';
}

// own: false builds for someone else (a prospect's sample or a client's site): only the facts given,
// never the member's own name, city, price, links or brand color from their brain.
function factsFrom(ctx, input = {}, { own = true } = {}) {
  const b = own ? brain.brainOf(ctx, input) : brain.brainOf(null, input);
  const name = pickStr(input.business, input.name, b.name);
  const what = pickStr(input.what, b.what, b.niche);
  const offer = pickStr(input.offer, b.offer);
  const audience = pickStr(input.audience, b.audience);
  const city = pickStr(input.city, b.city);
  const region = pickStr(input.region, b.region);
  const place = [city, region].filter(Boolean).join(', ');
  const area = pickStr(input.area, place);
  const address = pickStr(input.address);
  const online = /\b(online|worldwide|anywhere|remote|virtual|zoom|shipp?ing|ships|digital)\b/i.test(`${what} ${offer} ${input.area || ''}`) || (!city && !address && !input.area);
  // The niche profile without its matcher, so facts stay plain JSON between workflow steps.
  const niche = pickStr(input.what) ? '' : b.niche;
  const { re, ...profile } = nicheFor({ what, niche, offer, name, online }); // eslint-disable-line no-unused-vars

  // Services: the member's list, else their offer and price from the brain as one service.
  let services = parse.parseServices(input.services);
  if (!services.length && (offer || b.price != null)) {
    const s = parse.parseService(`${offer || what || 'Our main service'}${b.price != null ? `, $${b.price}` : ''}`);
    if (s.name) services = [{ ...s, name: text.clip(s.name, 60) }];
  }

  const booking = parse.cleanUrl(input.booking || input.bookingUrl || input.button || '');
  const buy = parse.cleanUrl(input.buyUrl || input.buy || '');
  const orderLinks = parse.parseLinks(input.order || input.orderLinks || '').filter((l) => l.href);
  const links = parse.parseLinks(input.links || '');
  const website = parse.cleanUrl(input.website || b.website || '');

  const socials = {
    instagram: parse.socialUrl('instagram', input.instagram || b.instagram),
    tiktok: parse.socialUrl('tiktok', input.tiktok || b.tiktok),
    youtube: parse.socialUrl('youtube', input.youtube || b.youtube),
    facebook: parse.socialUrl('facebook', input.facebook),
    linkedin: parse.socialUrl('linkedin', input.linkedin),
    x: parse.socialUrl('x', input.x || input.twitter),
  };
  for (const k of Object.keys(socials)) if (!socials[k]) delete socials[k];

  const hours = parseHours(input.hours || '');
  const phone = parse.parsePhone(input.phone);
  const email = parse.parseEmail(input.email);
  const siteUrlIn = web.normalizeUrl(input.siteUrl || input.domain || '');
  const slug = siteSlug(name || b.firstName);
  const siteUrl = (siteUrlIn || `https://${slug}.netlify.app/`).replace(/\/?$/, '/');

  const colorText = pickStr(input.color, input.colors, own ? brandMemoryColor(ctx) : '');
  const bookingPlat = booking ? parse.platformOf(booking) : null;

  return {
    name,
    productName: pickStr(input.product, input.productName),
    what,
    niche: niche || pickStr(input.what),
    offer,
    audience,
    city,
    region,
    place,
    area,
    address,
    online,
    mobile: isMobile(what, offer, input.area),
    profile,
    owner: pickStr(input.owner, b.firstName),
    about: pickStr(input.about),
    tagline: pickStr(input.tagline, input.bio),
    // The member's own promise, shown as written next to the contact form (kept to a short paragraph).
    promise: text.clip(pickStr(input.promise), 300),
    services,
    menu: parse.parseMenu(input.menu || ''),
    reviews: parse.parseReviews(input.reviews || ''),
    work: parse.parseWork(input.work || ''),
    clients: parse.parseClients(input.clients || ''),
    included: parse.lines(input.included || input.features || '').map((l) => text.clip(l, 140)).slice(0, 10),
    capacity: pickStr(input.capacity),
    deadline: pickStr(input.deadline, input.launch),
    priceText: pickStr(input.price != null && input.price !== '' ? (/^\$|^from/i.test(String(input.price)) ? input.price : `$${input.price}`) : '', b.priceText),
    shipping: pickStr(input.shipping),
    phone,
    email,
    booking: booking ? { href: booking, label: bookingLabel(bookingPlat, profile), kind: bookingPlat.kind === 'link' ? 'booking' : bookingPlat.kind } : null,
    reserve: !!(booking && bookingPlat.kind === 'reserve'),
    buy: buy ? { href: buy, label: parse.platformOf(buy).label || 'Buy now' } : null,
    orderLinks,
    links,
    website,
    socials,
    handle: pickStr(input.handle, b.instagram ? `@${b.instagram}` : '', b.tiktok ? `@${b.tiktok}` : '', socials.instagram ? parse.handleOf(socials.instagram) : '', socials.tiktok ? parse.handleOf(socials.tiktok) : ''),
    hours,
    hoursLine: hoursLine(hours),
    mapsUrl: address || area ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address || area].filter(Boolean).join(' '))}` : '',
    color: colorText,
    fonts: input.fonts === 'system' ? 'system' : 'google',
    formMode: input.form === 'email' && email ? 'email' : 'netlify',
    siteUrl,
    canonical: !!siteUrlIn,
    slug,
    year: time.year(ctx),
    today: time.today(ctx),
  };
}

module.exports = { factsFrom, siteSlug, pickStr };
