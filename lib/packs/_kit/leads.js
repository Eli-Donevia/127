// Leads from websites: what each business is missing (facts read off its own site, kit scan), how
// well it fits what the member sells (explained points, facts only), the ranked list, and the rows
// that go into the member's Pipeline and CSVs.
//
//   const lead = makeLead(place, scan, { now, category, city })   one business + its site facts
//   const scored = scoreLead(lead, service)                       { score, gaps, fits, reasons }
//   const { leads, stats } = rankLeads(leadsList, service, { top: 25 })
//   ctx.leads.upsert(pipelineLead(lead, { service }))             Places-safe Pipeline row
//
// `service` is { id, label, gaps: { gapId: points }, fit: { fitId: points } } (leads pack
// data/services.json has 17 of them). Gap ids, detection rules and the wording members read come from
// the Funnels First 25 engine (v2/funnels/first25-mapping.md and code/public/funnels/first25-data.js,
// read only); gaps after `no_facebook` in the second group are new here.
//
// Honesty rules baked in: a gap is only claimed when the page proves it (a bot wall, a script-built
// page or an unreachable site is "unchecked", never a gap); facts from a Google listing (rating, review
// count, name, phone) are used in the run only and never in messages, CSVs or the Pipeline.

const { plain, clip, slug, hash, list: listText, fill, titleCase } = require('./text');
const web = require('./web');

// ---------- the gaps ----------
// say: the line a message can open with (about what we saw). null: used for scoring only.
// source: 'website' (read off their site) or 'listing' (the map listing: Google, OpenStreetMap, sample).
const GAPS = {
  site_down: { chip: 'Site down', why: "Their website didn't load when we checked.", say: "I tried your website this week and it didn't load for me.", source: 'website' },
  broken_link: { chip: 'Broken link', why: 'The website link on their map listing goes to a missing page.', say: "The website link on your map listing goes to a page that doesn't exist anymore.", source: 'website' },
  no_site: { chip: 'No website', why: 'No website on their listing. The map listing is their whole storefront.', say: "I couldn't find a website for {biz}, just the map listing.", source: 'listing' },
  parked: { chip: 'Placeholder site', why: 'Their website is a placeholder page, not a working site.', say: 'Your website shows a placeholder page right now, not your business.', source: 'website' },
  no_video: { chip: 'No video', why: 'No video anywhere on their homepage.', say: "I was on your website and couldn't find any video of your {what}.", source: 'website' },
  no_tiktok: { chip: 'No TikTok', why: 'No TikTok linked from their site.', say: "I couldn't find {biz} on TikTok from your website.", source: 'website' },
  no_youtube: { chip: 'No YouTube', why: 'No YouTube linked from their site.', say: "I didn't see a YouTube channel linked on your website.", source: 'website' },
  no_instagram: { chip: 'No Instagram link', why: "Their site doesn't link to an Instagram.", say: "Your website doesn't link to an Instagram.", source: 'website' },
  no_facebook: { chip: 'No Facebook link', why: "Their site doesn't link to a Facebook page.", say: "Your website doesn't link to a Facebook page.", source: 'website' },
  no_pixel: { chip: 'No ad pixel', why: "No Meta pixel or tag manager, so they can't show ads to people who visited.", say: "Your website isn't set up to show ads to people who've already visited.", source: 'website' },
  no_booking: { chip: 'No online booking', why: 'No way to book or order online. Every booking is a phone call.', say: "I couldn't find a way to book online on your website.", source: 'website' },
  no_chat: { chip: 'No chat', why: 'No chat on their site. Questions after hours go nowhere.', say: "There's no way to ask a quick question on your website after hours.", source: 'website' },
  no_form: { chip: 'No contact form', why: 'No contact form on their homepage.', say: "Your homepage doesn't have a contact form.", source: 'website' },
  no_signup: { chip: 'No email list', why: 'No email signup anywhere on their homepage.', say: "I couldn't find a way to join your email list on your website.", source: 'website' },
  stale_footer: { chip: '© {year}', why: 'Their footer still says © {year}.', say: 'The footer on your website still says © {year}.', source: 'website' },
  no_https: { chip: 'Not secure', why: 'Their site has no https, so Chrome marks it "Not secure".', say: 'Your website shows as "Not secure" in Chrome.', source: 'website' },
  no_mobile: { chip: 'Not phone-ready', why: "Their site isn't set up for phones (no viewport tag).", say: "Your website isn't set up for phones, so it shows up tiny on mine.", source: 'website' },
  no_description: { chip: 'No Google blurb', why: 'No description for Google to show under their name.', say: "Your website doesn't give Google a description to show under your name.", source: 'website' },
  few_images: { chip: 'Few photos', why: 'Only {images} photos on their homepage.', say: 'Your website only has a few photos of your {what}.', source: 'website' },
  few_reviews: { chip: '{reviews} reviews', why: 'Only {reviews} reviews on their map listing.', say: null, source: 'listing' },
  // New in the library (not in the Funnels engine):
  low_rating: { chip: '{rating} stars', why: '{rating} stars on their map listing.', say: null, source: 'listing' },
  no_reviews_shown: { chip: 'No reviews on site', why: 'No reviews or testimonials anywhere on their website.', say: "I couldn't find any reviews or testimonials on your website.", source: 'website' },
  no_tap_to_call: { chip: 'No tap-to-call', why: "Their phone number isn't a tap-to-call link, so phone visitors have to copy it.", say: "On my phone, the number on your website isn't tap-to-call.", source: 'website' },
  no_prices: { chip: 'No prices', why: 'No prices anywhere on their website, so every price is a question.', say: "I couldn't find any prices on your website.", source: 'website' },
  no_offer: { chip: 'No first-visit offer', why: 'No first-visit offer on their website.', say: "I didn't see an offer for first-time customers on your website.", source: 'website' },
  no_hours: { chip: 'No hours', why: "Their hours aren't on their website.", say: "I couldn't find your hours on your website.", source: 'website' },
  no_map: { chip: 'No map', why: 'No map on their website.', say: "Your website doesn't have a map showing where to find you.", source: 'website' },
  no_schema: { chip: 'No business schema', why: "Their site doesn't give Google its business details as structured data (schema).", say: "Your website doesn't give Google your business details in the format it reads (schema).", source: 'website' },
  missing_alt: { chip: 'Photos without alt text', why: '{noalt} of {images} photos on their homepage have no alt text.', say: "Most photos on your homepage have no alt text, so Google can't tell what's in them.", source: 'website' },
  no_h1: { chip: 'No H1 headline', why: 'Their homepage has no H1 headline.', say: "Your homepage has no H1 headline, which Google uses to understand the page.", source: 'website' },
  thin_site: { chip: 'Thin homepage', why: 'Their homepage has about {words} words.', say: 'Your homepage has only about {words} words, so Google has little to go on.', source: 'website' },
  no_email: { chip: 'No email or form', why: 'No email address or contact form on their website.', say: "I couldn't find an email address or a contact form on your website.", source: 'website' },
  no_analytics: { chip: 'No analytics', why: "No analytics tag on their website, so they can't see where visitors come from.", say: "I couldn't find analytics on your website, so you can't see where visitors come from.", source: 'website' },
  no_social: { chip: 'No social links', why: 'No social media linked from their website.', say: "Your website doesn't link to any social media.", source: 'website' },
};

// Signs a business is a better first client. why: one line the member reads.
const FITS = {
  ads: { why: 'Already runs ads, so they pay for marketing.' },
  booking: { why: 'Takes bookings online ({tool}), so more views can turn into bookings.' },
  busy: { why: 'Busy: {reviews} reviews on their map listing.' },
  rated: { why: '{rating} stars. They care how they look.' },
  independent: { why: 'Independent, not a chain. The owner decides.' },
  owner_named: { why: 'The owner is named on their site ({owner}), so you can write to a person.' },
  has_email: { why: 'Their email is on the site, so you can reach them today.' },
  on_instagram: { why: 'On Instagram as @{ig}, so a DM reaches them.' },
  sells_online: { why: 'Sells online, so they already think about website visitors.' },
};

const BUSINESS_SCHEMA = /LocalBusiness|Organization|Restaurant|Store|Dentist|Physician|MedicalBusiness|MedicalClinic|HealthAndBeautyBusiness|BeautySalon|HairSalon|DaySpa|NailSalon|ExerciseGym|HealthClub|SportsActivityLocation|AutoRepair|AutomotiveBusiness|HomeAndConstructionBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor|GeneralContractor|HousePainter|Locksmith|LegalService|Attorney|AccountingService|FinancialService|InsuranceAgency|RealEstateAgent|FoodEstablishment|CafeOrCoffeeShop|Bakery|BarOrPub|Brewery|LodgingBusiness|Hotel|ChildCare|School|EducationalOrganization|Church|PlaceOfWorship|ProfessionalService|VeterinaryCare|Florist|ClothingStore|EventVenue/i;

// ---------- site status ----------

// What we can honestly say about a site: ok, none (no website listed), down (it answered with an
// error), parked, blocked (bot wall or robots.txt), unchecked (couldn't reach it from here).
function siteStatus(scan, website) {
  if (!website) return { status: 'none', reason: 'No website listed.' };
  if (!scan) return { status: 'unchecked', reason: 'Not checked yet.' };
  if (scan.reachable) return scan.parked ? { status: 'parked', reason: `The site looks ${scan.parkedReason || 'parked'}.` } : { status: 'ok', reason: '' };
  const reason = plain(scan.reason || '');
  const code = Number((reason.match(/answered (\d{3})/) || [])[1]);
  if (code && [401, 403, 405, 406, 429, 503].includes(code)) return { status: 'blocked', reason: "The site has a bot wall, so we couldn't read it." };
  if (code === 404 || code === 410 || (code >= 500 && code !== 503)) return { status: 'down', reason: `The site answered with an error (${code}).` };
  if (/asks bots/i.test(reason)) return { status: 'blocked', reason: 'The site asks bots not to read it, so we skipped it.' };
  if (/too long/i.test(reason)) return { status: 'unchecked', reason: "The site took too long to answer, so we couldn't check it." };
  return { status: 'unchecked', reason: reason || "We couldn't reach the site from here." };
}

// ---------- names ----------

const GENERIC_TITLE = /^(home|homepage|home page|welcome|index|official site|official website|website|about|about us|main|untitled|contact|contact us)$/i;

// The business's name as its own website says it (title, then H1), or '' when unsure.
function siteName(scan) {
  if (!scan || !scan.reachable || scan.parked) return '';
  const dom = String(scan.domain || '').replace(/\.[a-z.]+$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const parts = String(scan.title || '')
    .split(/\s+[|\u2022\u00b7:~\-\u2013\u2014]+\s+|\s*[|\u2022\u00b7]\s*/)
    .map((p) => plain(p).replace(/^(welcome to|home of)\s+/i, '').trim())
    .filter((p) => p && !GENERIC_TITLE.test(p) && p.length >= 2 && p.length <= 60);
  const domainScore = (p) => {
    const words = p.toLowerCase().replace(/&/g, 'and').split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    if (!words.length) return 0;
    return words.filter((w) => dom.includes(w)).length / words.length;
  };
  const ranked = parts.map((p, i) => ({ p, s: domainScore(p) - i * 0.01 })).sort((a, b) => b.s - a.s);
  if (ranked.length && ranked[0].s >= 0.5) return ranked[0].p;
  const h1 = plain(scan.h1 || '');
  if (h1 && h1.length <= 50 && domainScore(h1) >= 0.5) return h1;
  if (ranked.length && ranked[0].p.split(/\s+/).length <= 4 && parts.length > 1) return parts[0];
  return '';
}

function ownerOf(scan) {
  // Only a person the site names as owner or founder: a credit line ("Site by ...") is not who to greet.
  // Greet by name only when the site names exactly one owner or founder; otherwise greet the team.
  const heads = scan && Array.isArray(scan.people) ? scan.people.filter((x) => /\b(owner|founder|co-founder|proprietor)\b/i.test(x.role || '')) : [];
  const p = heads.length === 1 ? heads[0] : null;
  return p ? { name: plain(p.name), first: plain(String(p.name).split(/\s+/)[0]), role: plain(p.role || 'owner') } : null;
}

// ---------- the trimmed scan a lead carries ----------

function trimScan(scan) {
  if (!scan || !scan.reachable) return null;
  return {
    url: scan.url,
    domain: scan.domain,
    https: !!scan.https,
    platform: scan.platform || null,
    title: clip(scan.title || '', 120),
    description: clip(scan.description || '', 200),
    h1: clip(scan.h1 || '', 120),
    h1Count: scan.h1Count || 0,
    mobileReady: !!scan.mobileReady,
    copyrightYear: scan.copyrightYear || null,
    socials: scan.socials || {},
    video: { onSite: !!(scan.video && scan.video.onSite), kinds: (scan.video && scan.video.kinds) || [], unknown: !!(scan.video && scan.video.unknown) },
    booking: (scan.booking || []).map((b) => b.name).slice(0, 4),
    chat: (scan.chat || []).slice(0, 3),
    reviewWidgets: (scan.reviewWidgets || []).slice(0, 3),
    testimonials: !!scan.testimonials,
    emailCapture: !!scan.emailCapture,
    emailTools: (scan.emailTools || []).slice(0, 3),
    forms: scan.forms || 0,
    tracking: scan.tracking || {},
    offer: scan.offer && scan.offer.kind !== 'none' ? { kind: scan.offer.kind, text: clip(scan.offer.text || '', 80) } : null,
    prices: (scan.prices || []).slice(0, 6).map((p) => ({ amount: p.amount, per: p.per || null, context: clip(p.context || '', 70) })),
    monthlyPrice: scan.monthlyPrice || null,
    colors: scan.colors ? { primary: scan.colors.primary || null, accent: scan.colors.accent || null } : {},
    logo: (scan.images && scan.images.logo) || null,
    ogImage: (scan.images && scan.images.ogImage) || null,
    imageCount: scan.imageCount || 0,
    imagesWithoutAlt: scan.imagesWithoutAlt || 0,
    contacts: { emails: ((scan.contacts && scan.contacts.emails) || []).slice(0, 2), phones: ((scan.contacts && scan.contacts.phones) || []).slice(0, 2) },
    tapToCall: !!scan.tapToCall,
    mapEmbed: !!scan.mapEmbed,
    hours: scan.hours ? clip(scan.hours, 80) : null,
    people: (scan.people || []).slice(0, 4),
    links: { book: (scan.links && scan.links.book) || null, contact: (scan.links && scan.links.contact) || null, pricing: (scan.links && scan.links.pricing) || null, shop: (scan.links && scan.links.shop) || null, menu: (scan.links && scan.links.menu) || null },
    schemaTypes: (scan.schemaTypes || []).slice(0, 6),
    words: scan.words || 0,
    pagesRead: scan.pagesRead || 1,
    parked: !!scan.parked,
  };
}

// ---------- gaps and fits ----------

// A page with almost no words was built in the browser by scripts: absence there proves nothing.
const thin = (s) => !s || (s.words || 0) < 120;

const TESTS = {
  site_down: (s, b) => b.siteStatus === 'down',
  broken_link: (s, b) => !!b.brokenLink,
  no_site: (s, b) => !b.website,
  parked: (s, b) => b.siteStatus === 'parked',
  no_video: (s) => !!s && !s.video.onSite && !s.video.unknown && !thin(s),
  no_tiktok: (s) => !!s && !s.socials.tiktok,
  no_youtube: (s) => !!s && !s.socials.youtube,
  no_instagram: (s, b) => !!s && !s.socials.instagram && !b.instagram,
  no_facebook: (s) => !!s && !s.socials.facebook,
  // With a tag manager or analytics tag, a pixel can load later: unknown, not a gap.
  no_pixel: (s) => !!s && !s.tracking.metaPixel && !s.tracking.analytics && !thin(s),
  no_booking: (s) => !!s && !s.booking.length && !s.links.book && !thin(s),
  no_chat: (s) => !!s && !s.chat.length,
  no_form: (s) => !!s && !s.forms && !thin(s),
  no_signup: (s) => !!s && !s.emailCapture && !s.emailTools.length && !thin(s),
  stale_footer: (s, b, now) => !!s && !!s.copyrightYear && s.copyrightYear <= now.getUTCFullYear() - 2,
  no_https: (s) => !!s && !s.https,
  no_mobile: (s) => !!s && !s.mobileReady,
  no_description: (s) => !!s && !s.description,
  few_images: (s) => !!s && !thin(s) && s.imageCount < 6,
  few_reviews: (s, b) => Number.isFinite(b.reviews) && b.reviews < 40,
  low_rating: (s, b) => Number.isFinite(b.rating) && Number.isFinite(b.reviews) && b.reviews >= 5 && b.rating < 4.3,
  no_reviews_shown: (s) => !!s && !thin(s) && !s.reviewWidgets.length && !s.testimonials,
  no_tap_to_call: (s) => !!s && !thin(s) && !s.tapToCall,
  no_prices: (s) => !!s && !thin(s) && !s.prices.length,
  no_offer: (s) => !!s && !thin(s) && !s.offer,
  no_hours: (s) => !!s && !thin(s) && !s.hours,
  no_map: (s) => !!s && !thin(s) && !s.mapEmbed,
  no_schema: (s) => !!s && !s.schemaTypes.some((t) => BUSINESS_SCHEMA.test(t)),
  missing_alt: (s) => !!s && s.imageCount >= 4 && s.imagesWithoutAlt >= Math.ceil(s.imageCount / 2),
  no_h1: (s) => !!s && !thin(s) && !s.h1Count,
  thin_site: (s) => !!s && s.words >= 120 && s.words < 250,
  no_email: (s) => !!s && !thin(s) && !s.contacts.emails.length && !s.forms,
  no_analytics: (s) => !!s && !thin(s) && !s.tracking.analytics && !s.tracking.metaPixel,
  no_social: (s, b) => !!s && !s.socials.instagram && !s.socials.facebook && !s.socials.tiktok && !b.instagram,
};

const FIT_TESTS = {
  ads: (s) => !!s && !!(s.tracking.metaPixel || s.tracking.googleAds),
  booking: (s) => !!s && s.booking.length > 0,
  busy: (s, b) => Number.isFinite(b.reviews) && b.reviews >= 50,
  rated: (s, b) => Number.isFinite(b.rating) && b.rating >= 4.6 && Number.isFinite(b.reviews) && b.reviews >= 20,
  independent: () => true,
  owner_named: (s) => !!s && s.people.length > 0,
  has_email: (s) => !!s && s.contacts.emails.length > 0,
  on_instagram: (s, b) => !!((s && s.socials.instagram) || b.instagram),
  sells_online: (s) => !!s && (s.platform === 'Shopify' || !!s.links.shop),
};

function varsOf(lead) {
  const s = lead.site || null;
  const owner = ownerOf(s);
  return {
    biz: lead.siteName || (lead.source === 'google' ? '' : lead.name) || 'your business',
    city: lead.city || '',
    what: (lead.category && lead.category.what) || 'work',
    thing: (lead.category && lead.category.thing) || 'visit',
    film: (lead.category && lead.category.film) || 'a day at work',
    one: (lead.category && lead.category.one) || 'business',
    many: (lead.category && lead.category.many) || 'local businesses',
    year: s && s.copyrightYear,
    images: s ? s.imageCount : '',
    noalt: s ? s.imagesWithoutAlt : '',
    words: s ? Math.round((s.words || 0) / 10) * 10 : '',
    reviews: lead.reviews,
    rating: lead.rating,
    tool: s && s.booking.length ? s.booking[0] : 'online booking',
    owner: owner ? owner.name : '',
    ig: (s && s.socials.instagram) || lead.instagram || '',
  };
}

// Every gap and fit the facts prove, whatever the service. Each: { id, chip, why, say, source }.
function detect(lead, now = new Date()) {
  const s = lead.site || null;
  const v = varsOf(lead);
  const gaps = [];
  for (const [id, test] of Object.entries(TESTS)) {
    let hit = false;
    try {
      hit = !!test(s, lead, now);
    } catch {
      hit = false;
    }
    if (!hit) continue;
    const g = GAPS[id];
    gaps.push({ id, chip: fill(g.chip, v), why: fill(g.why, v), say: g.say ? fill(g.say, v) : null, source: g.source });
  }
  const fits = [];
  for (const [id, test] of Object.entries(FIT_TESTS)) {
    let hit = false;
    try {
      hit = !!test(s, lead, now);
    } catch {
      hit = false;
    }
    if (hit) fits.push({ id, why: fill(FITS[id].why, v) });
  }
  return { gaps, fits };
}

// One business + its scan -> a lead. place: from kit places (or { website } typed by the member).
function makeLead(place, scan, { now = new Date(), category, city, brokenLink = false } = {}) {
  const p = place || {};
  const st = siteStatus(scan, p.website);
  // Website gaps need a working page: a parked, dead or unread site only gets its own status gap.
  const site = st.status === 'ok' ? trimScan(scan) : null;
  const lead = {
    key: p.key || (p.website ? `site:${web.domainOf(p.website)}` : `lead:${slug(p.name || 'business', 40)}`),
    source: p.source || 'web',
    sample: !!(p.sample || (scan && scan.sample)),
    attribution: p.attribution || '',
    name: plain(p.name || ''),
    siteName: siteName(scan),
    placeId: p.placeId || null,
    mapsUrl: p.mapsUrl || null,
    website: p.website || null,
    address: plain(p.address || ''),
    phone: p.phone || null,
    rating: Number.isFinite(p.rating) ? p.rating : null,
    reviews: Number.isFinite(p.reviews) ? p.reviews : null,
    lat: Number.isFinite(p.lat) ? p.lat : null,
    lng: Number.isFinite(p.lng) ? p.lng : null,
    instagram: p.instagram || null,
    hours: p.hours ? plain(p.hours) : null,
    ...(p.searchBy ? { searchBy: p.searchBy } : {}),
    category: category ? { id: category.id, one: category.one, many: category.many, what: category.what, thing: category.thing, film: category.film } : null,
    city: plain(city || ''),
    siteStatus: st.status,
    siteNote: st.reason,
    brokenLink: !!brokenLink,
    site,
    checked: new Date(now).toISOString().slice(0, 10),
  };
  if (!lead.name) lead.name = lead.siteName || (lead.website ? web.shortSite(lead.website) : 'Business');
  const { gaps, fits } = detect(lead, new Date(now));
  lead.gaps = gaps;
  lead.fits = fits;
  return lead;
}

// Points for one service, with reasons in plain words. Never moves facts, only weighs them.
function scoreLead(lead, service) {
  const svc = service || { gaps: {}, fit: {} };
  const gaps = [];
  const fits = [];
  let raw = 0;
  for (const g of lead.gaps || []) {
    const pts = (svc.gaps || {})[g.id];
    if (pts) {
      gaps.push({ ...g, points: pts });
      raw += pts;
    }
  }
  for (const f of lead.fits || []) {
    const pts = (svc.fit || {})[f.id];
    if (pts) {
      fits.push({ ...f, points: pts });
      raw += pts;
    }
  }
  gaps.sort((a, b) => b.points - a.points);
  fits.sort((a, b) => b.points - a.points);
  const score = Math.max(1, Math.min(99, Math.round(raw)));
  const reasons = gaps.map((g) => g.why).concat(fits.map((f) => f.why));
  return { score, gaps, fits, reasons, unchecked: lead.siteStatus === 'unchecked' || lead.siteStatus === 'blocked' };
}

// Sort, rank and count. leads: makeLead outputs (any order). Returns the top N with score and rank.
function rankLeads(leads, service, { top = 25 } = {}) {
  const valid = (leads || []).filter((l) => l && l.key && !l.error);
  const scored = valid.map((l) => ({ ...l, ...scoreLead(l, service) }));
  scored.sort((a, b) => b.score - a.score || (b.reviews || 0) - (a.reviews || 0) || String(a.name).localeCompare(String(b.name)));
  const ranked = scored.slice(0, top).map((l, i) => ({ ...l, rank: i + 1 }));
  const stats = { found: valid.length, ranked: ranked.length, checked: valid.filter((l) => l.siteStatus === 'ok').length, noSite: valid.filter((l) => l.siteStatus === 'none').length, unchecked: valid.filter((l) => l.siteStatus === 'unchecked' || l.siteStatus === 'blocked').length, gaps: {} };
  for (const l of scored) for (const g of l.gaps) stats.gaps[g.id] = (stats.gaps[g.id] || 0) + 1;
  return { leads: ranked, stats };
}

// "9 of 22 checked sites have no online booking": the 3 gaps worth the most to this service.
const LINES = {
  site_down: "had a website that didn't load", broken_link: 'have a broken website link on their listing', no_site: 'have no website', parked: 'have a placeholder website', no_video: 'show no video on their homepage', no_tiktok: "don't link a TikTok", no_youtube: "don't link a YouTube", no_instagram: "don't link an Instagram", no_facebook: "don't link a Facebook page", no_pixel: 'have no ad pixel', no_booking: 'have no online booking', no_chat: 'have no chat', no_form: 'have no contact form', no_signup: 'have no email signup', stale_footer: 'have a footer at least 2 years old', no_https: "aren't secure (no https)", no_mobile: "aren't set up for phones", no_description: 'have no description for Google', few_images: 'have under 6 photos on their homepage', few_reviews: 'have under 40 reviews', low_rating: 'are rated under 4.3 stars', no_reviews_shown: 'show no reviews on their site', no_tap_to_call: 'have no tap-to-call number', no_prices: 'show no prices', no_offer: 'have no first-visit offer', no_hours: "don't list their hours", no_map: 'have no map on their site', no_schema: 'have no business schema for Google', missing_alt: 'have photos without alt text', no_h1: 'have no H1 headline', thin_site: 'have under 250 words on their homepage', no_email: 'have no email or contact form', no_analytics: 'have no analytics', no_social: 'link no social media',
};
function headline(stats, service) {
  const weights = (service && service.gaps) || {};
  return Object.keys(weights)
    .filter((id) => (stats.gaps[id] || 0) > 0 && weights[id] >= 8 && !!GAPS[id] && (GAPS[id].source === 'website' || id === 'no_site'))
    .sort((a, b) => weights[b] * (stats.gaps[b] || 0) - weights[a] * (stats.gaps[a] || 0))
    .slice(0, 3)
    .map((id) => {
      const of = id === 'no_site' ? stats.found : Math.max(stats.checked, stats.gaps[id] || 0);
      return { id, n: stats.gaps[id], of, line: `${stats.gaps[id]} of ${of} ${LINES[id] || GAPS[id].chip.toLowerCase()}` };
    });
}

// ---------- what may leave the run (Google Places terms) ----------

// Facts a message, CSV or Pipeline row may carry: website facts always; listing facts only when the
// listing isn't Google's. Ratings and review counts never go into messages.
function shareableGaps(lead) {
  return (lead.gaps || []).filter((g) => g.source === 'website' || (g.source === 'listing' && g.id === 'no_site') || (lead.source !== 'google' && g.source === 'listing'));
}

function exportName(lead) {
  return lead.siteName || (lead.source === 'google' ? '' : lead.name) || '';
}

// Everyone already in the member's Pipeline, for "Your next 25" and other refills: { keys, names, sites }
// (lower-case names and website domains). Empty when the harness has no Pipeline (local runs).
async function known(ctx) {
  const out = { keys: new Set(), names: new Set(), sites: new Set() };
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return out;
  let rows = [];
  try {
    rows = await ctx.leads.list({ all: true, limit: 2000 });
  } catch {
    rows = [];
  }
  for (const r of rows || []) {
    if (!r) continue;
    if (r.key) out.keys.add(String(r.key));
    if (r.name) out.names.add(String(r.name).toLowerCase().trim());
    const site = r.links && r.links.website;
    if (site) out.sites.add(web.domainOf(site));
  }
  return out;
}

// Contract channels for Do my day, from outreach.channels ids (a contact form counts as 'site').
const CHANNEL = { ig: 'ig', email: 'email', fb: 'fb', form: 'site', call: 'call' };

const bestChannel = (lead, service) => require('./outreach').channels(lead, service).map((c) => CHANNEL[c.id]).find(Boolean) || null;

// A Pipeline row (harness pipeline.upsert): place_id and website facts only for Google listings.
// draft (from outreach.draft, optional) fills what Do my day reads (contract section 13): msg with the
// first message and follow-ups in the form that fits the best channel (email follow-ups end like the
// first email, with the address and opt-out lines), up to 5 facts, the score and the channel.
function pipelineLead(lead, { service, message, draft, stage = 'found' } = {}) {
  const s = lead.site || null;
  const google = lead.source === 'google';
  const ig = (s && s.socials.instagram) || (!google && lead.instagram) || null;
  const links = {};
  if (lead.website && lead.siteStatus !== 'none') links.website = (s && s.url) || lead.website;
  if (ig) links.instagram = `https://www.instagram.com/${ig}/`;
  if (s && s.socials.facebook) links.facebook = s.socials.facebook;
  if (s && s.socials.tiktok) links.tiktok = `https://www.tiktok.com/@${s.socials.tiktok}`;
  if (s && s.socials.youtube) links.youtube = s.socials.youtube;
  if (lead.mapsUrl) links.maps = lead.mapsUrl;
  const email = s && s.contacts.emails[0];
  if (email) links.email = email;
  const phone = (s && s.contacts.phones[0]) || (!google && lead.phone) || null;
  if (phone) links.phone = phone;
  const name = exportName(lead) || (google ? 'Google Maps listing' : 'Business');
  const facts = shareableGaps(lead).slice(0, 6).map((g) => ({ id: g.id, fact: g.why }));
  const data = {
    service: service ? service.id : null,
    score: lead.score != null ? lead.score : null,
    rank: lead.rank || null,
    category: lead.category ? lead.category.id : null,
    city: lead.city || null,
    placeId: lead.placeId || null,
    facts,
    checked: lead.checked,
    sample: !!lead.sample,
    // Where the listing came from, so a later step shows the right map credit (OSM, LocationIQ).
    placeSource: lead.source || null,
    ...(lead.searchBy ? { searchBy: lead.searchBy } : {}),
  };
  if (message) data.message = clip(message, 900);
  const row = {
    key: lead.key,
    name: clip(name, 120),
    company: clip(name, 120),
    source: clip(`${service ? service.label : 'Business finder'}${lead.sample ? ' (sample)' : ''}`, 60),
    stage,
    note: clip(facts.map((f) => f.fact).join(' '), 1000),
    links,
    data,
  };
  if (lead.score != null) row.score = Math.max(0, Math.min(100, Math.round(lead.score)));
  if (draft) {
    const best = bestChannel(lead, service);
    const byEmail = best === 'email' || best === 'site';
    const em = draft.email || {};
    row.msg = {
      dm: draft.dm || '',
      subject: em.subject || '',
      email: em.body || '',
      walkin: draft.walkIn || '',
      follow1: (byEmail ? draft.followUp1Email : draft.followUp1) || '',
      follow2: (byEmail ? draft.followUp2Email : draft.followUp2) || '',
    };
    if (best) row.channel = best;
    const why = (draft.facts && draft.facts.length ? draft.facts : facts.map((f) => f.fact)).filter(Boolean);
    row.facts = (why.length ? why : draft.cites || []).slice(0, 5).map((f) => clip(plain(f), 160));
  }
  return row;
}

// CSV columns and one row per lead (same rules as the Pipeline).
const CSV_COLUMNS = [
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Business (from their website)' },
  { key: 'score', label: 'Fit score' },
  { key: 'missing', label: 'What is missing' },
  { key: 'website', label: 'Website' },
  { key: 'email', label: 'Email (from their website)' },
  { key: 'phone', label: 'Phone (from their website)' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'maps', label: 'Map link' },
  { key: 'placeId', label: 'Google place ID' },
  { key: 'address', label: 'Address (OpenStreetMap or sample only)' },
  { key: 'dm', label: 'Instagram DM' },
  { key: 'subject', label: 'Email subject' },
  { key: 'email_body', label: 'Email' },
  { key: 'call', label: 'Call opener' },
  { key: 'walk_in', label: 'Walk-in line' },
  { key: 'follow_up_1', label: 'Follow-up day 3' },
  { key: 'follow_up_2', label: 'Follow-up day 7' },
  { key: 'send_on', label: 'Send on' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
];

// Follow-ups fit the lead's best channel, as in the Pipeline: by email they end like the first email,
// with the address and opt-out lines.
function csvRow(lead, msg = {}, { sendOn = '', status = 'Not contacted', service = null } = {}) {
  const best = bestChannel(lead, service);
  const byEmail = best === 'email' || best === 'site';
  const s = lead.site || null;
  const google = lead.source === 'google';
  const ig = (s && s.socials.instagram) || (!google && lead.instagram) || '';
  return {
    rank: lead.rank || '',
    name: exportName(lead) || (google ? 'Open the map link' : ''),
    score: lead.score != null ? lead.score : '',
    missing: shareableGaps(lead).map((g) => g.chip).join('; '),
    website: lead.website && lead.siteStatus !== 'none' ? (s && s.url) || lead.website : '',
    email: (s && s.contacts.emails[0]) || '',
    phone: (s && s.contacts.phones[0]) || (!google && lead.phone) || '',
    instagram: ig ? `@${ig}` : '',
    maps: lead.mapsUrl || '',
    placeId: lead.placeId || '',
    address: google ? '' : lead.address || '',
    dm: msg.dm || '',
    subject: (msg.email && msg.email.subject) || '',
    email_body: (msg.email && msg.email.body) || '',
    call: msg.call || '',
    walk_in: msg.walkIn || '',
    follow_up_1: (byEmail && msg.followUp1Email) || msg.followUp1 || '',
    follow_up_2: (byEmail && msg.followUp2Email) || msg.followUp2 || '',
    send_on: sendOn,
    status,
    source: lead.source === 'google' ? 'Google Maps (place ID only) + their website' : lead.source === 'osm' ? 'OpenStreetMap contributors + their website' : lead.source === 'sample' ? 'Sample (made up)' : 'Their website',
  };
}

// ---------- sample websites (.example), so sample runs show real-looking facts ----------

const isSampleUrl = (u) => /\.example(\/|:|$)/i.test(String(u || '').replace(/^https?:\/\//, '').split(/[/?#]/)[0] + '/');

const SAMPLE_CONTENT = {
  fitness: { booking: [['Mindbody', 'https://clients.mindbodyonline.com/classic/ws?studioid=1'], ['PushPress', 'https://app.pushpress.com/p/demo']], offer: 'Your first class is free.', prices: ['Unlimited classes $149 / month', 'Drop-in class $20 / class'], services: ['Group classes', 'Personal training', 'Open gym'], copy: 'Small group classes for every level, coached by people who know your name. Strength, conditioning and mobility, with a plan that fits your week.' },
  food: { booking: [['OpenTable', 'https://www.opentable.com/r/demo'], ['Toast', 'https://order.toasttab.com/online/demo']], offer: 'Free dessert on your first visit.', prices: ['Lunch specials from $12', 'Family meal $45'], services: ['Dine in', 'Takeout', 'Catering'], copy: 'Made from scratch every morning with ingredients from local farms. Come hungry, bring friends, and save room for something sweet.' },
  beauty: { booking: [['Vagaro', 'https://www.vagaro.com/demo'], ['GlossGenius', 'https://demo.glossgenius.com']], offer: 'New client special: 20% off your first visit.', prices: ['Cut and style $65', 'Color from $120'], services: ['Cuts', 'Color', 'Treatments'], copy: 'A calm chair, a stylist who listens, and a look you can keep up at home. Book a consult and we will plan it together.' },
  health: { booking: [['NexHealth', 'https://app.nexhealth.com/appt/demo'], ['Zocdoc', 'https://www.zocdoc.com/practice/demo']], offer: 'Free consultation for new patients.', prices: ['New patient exam $89'], services: ['Exams', 'Cleanings', 'Same-week visits'], copy: 'Gentle care for the whole family, with clear prices and visits that start on time. New patients are welcome this month.' },
  home: { booking: [['Housecall Pro', 'https://book.housecallpro.com/book/demo'], ['Jobber', 'https://clienthub.getjobber.com/booking/demo']], offer: 'Free estimate on every job.', prices: ['Service call $89', 'Drain cleaning from $149'], services: ['Repairs', 'Installs', 'Emergency service'], copy: 'Licensed and insured, with upfront pricing before any work starts. We clean up after ourselves and answer the phone.' },
  auto: { booking: [['Square Appointments', 'https://book.squareup.com/appointments/demo']], offer: 'Free brake inspection.', prices: ['Oil change $49', 'Full detail from $180'], services: ['Repairs', 'Maintenance', 'Detailing'], copy: 'Honest repairs, clear quotes and a ride back to work when you need one. We show you the old part before we replace it.' },
  retail: { booking: [], offer: 'Free shipping on orders over $50.', prices: ['Candles from $18', 'Gift sets $42'], services: ['New arrivals', 'Gift sets', 'Local pickup'], copy: 'Small-batch goods picked by hand for people who like a thoughtful gift. New pieces arrive every Friday.' },
  pro: { booking: [['Calendly', 'https://calendly.com/demo']], offer: 'Free 15-minute consultation.', prices: ['Flat fee from $350'], services: ['Consultations', 'Planning', 'Ongoing support'], copy: 'Straight answers in plain language, and a clear quote before we start. Most clients hear back the same day.' },
  community: { booking: [['Calendly', 'https://calendly.com/demo-tour']], offer: 'Book a free tour.', prices: ['Full day $65 / day'], services: ['Programs', 'Tours', 'Enrollment'], copy: 'A warm, safe place to learn and grow, with teachers who send photos home every week. Tours run every weekday.' },
  hospitality: { booking: [['Square Appointments', 'https://book.squareup.com/appointments/demo-venue']], offer: 'Free tour of the space.', prices: ['Rooms from $129 / night'], services: ['Rooms', 'Events', 'Packages'], copy: 'A restored building with room for your people, a kitchen that cooks for crowds, and a team that runs the day so you can enjoy it.' },
  other: { booking: [['Calendly', 'https://calendly.com/demo']], offer: 'Free quote.', prices: ['From $95'], services: ['Services', 'Packages', 'Support'], copy: 'Local, reliable and easy to reach. Tell us what you need and we will get back to you with a clear quote.' },
};
const FAMILY_BY_WORD = [
  [/fit|gym|barbell|yoga|pilates|strength|crossfit|boxing|athletic|cycle|barre|movement/, 'fitness'],
  [/kitchen|taqueria|noodle|diner|bistro|smoke|pho|pizza|bake|coffee|cafe|espresso|cantina|tap|brew|grill|dumpling|donut|pastry|bread|tea|roaster|tavern|wine|food/, 'food'],
  [/salon|hair|barber|nail|skin|spa|lash|aesthetic|groom|blowout|massage|beauty|pup/, 'beauty'],
  [/dental|smile|chiro|therapy|clinic|animal|pet|vet|wellness|spine|rehab|health/, 'health'],
  [/plumb|heat|air|roof|electric|lawn|landscape|clean|maid|home|build|restor|tree|hvac|pipe|wiring|exterior|janitor/, 'home'],
  [/auto|garage|detail|motor|tire|collision|car/, 'auto'],
  [/boutique|goods|mercantile|gift|flower|floral|bloom|supply|outfit|store|shop|candle|soap|apparel|jewel/, 'retail'],
  [/law|legal|attorney|realty|real-estate|insurance|tax|account|cpa|photo|portrait|advis|bookkeep|properties/, 'pro'],
  [/academy|learning|kids|montessori|church|chapel|fellowship|school|tutor|preschool|child/, 'community'],
  [/inn|hotel|guest|barn|loft|garden|ballroom|venue|lodge|event/, 'hospitality'],
];
function familyOf(domain) {
  const d = String(domain || '').toLowerCase();
  for (const [re, fam] of FAMILY_BY_WORD) if (re.test(d)) return fam;
  return 'other';
}

const PEOPLE = [['Maria', 'Lopez'], ['Dev', 'Patel'], ['Tasha', 'Brooks'], ['Luis', 'Reyes'], ['Priya', 'Shah'], ['Marcus', 'Okafor'], ['Elena', 'Novak'], ['Keisha', 'Mensah'], ['Omar', 'Haddad'], ['Hannah', 'Kim'], ['Jamal', 'Rivera'], ['Grace', 'Chen'], ['Mateo', 'Garcia'], ['Aisha', 'Walsh']];
const BRANDISH = ['#2f6f4e', '#b4532a', '#1f4e79', '#7a3e8e', '#c0392b', '#0f766e', '#a16207', '#be185d', '#3f6212', '#9a3412', '#155e75', '#6d28d9'];
const PLATFORM_MARK = [['Wix', '<img src="https://static.wixstatic.com/media/demo.jpg" alt="">'], ['Squarespace', '<link rel="stylesheet" href="https://static1.squarespace.com/static/demo.css">'], ['WordPress', '<link rel="stylesheet" href="/wp-content/themes/demo/style.css">'], ['GoDaddy', '<img src="https://img1.wsimg.com/demo.jpg" alt="">'], [null, '']];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The profile of a made-up site: same domain, same facts, every run.
function sampleProfile(domain, { year = 2026 } = {}) {
  const h = hash(`site:${domain}`);
  const bit = (shift, mod, below = 1) => ((h >>> shift) % mod) < below;
  return {
    down: h % 17 === 0,
    parked: h % 23 === 1,
    https: h % 7 !== 0,
    mobile: h % 6 !== 0,
    description: h % 5 !== 0,
    video: bit(3, 3),
    instagram: !bit(5, 3),
    facebook: !bit(7, 4),
    tiktok: bit(9, 4),
    youtube: bit(11, 5),
    booking: bit(13, 5, 2),
    chat: bit(15, 6),
    pixel: bit(17, 3),
    googleAds: bit(19, 5),
    analytics: !bit(21, 4),
    form: !bit(23, 3),
    signup: bit(25, 4),
    footerYear: year - ((h >>> 27) % 6),
    images: 2 + ((h >>> 2) % 13),
    reviewsShown: bit(4, 3),
    tapToCall: !bit(6, 3),
    prices: bit(8, 2),
    offer: bit(10, 3),
    hours: bit(12, 2),
    owner: bit(14, 2),
    schema: bit(16, 3),
    map: bit(18, 3),
    alt: !bit(20, 3),
    h1: !bit(22, 6),
    color: BRANDISH[(h >>> 24) % BRANDISH.length],
    accent: BRANDISH[(h >>> 20) % BRANDISH.length],
    platform: PLATFORM_MARK[(h >>> 26) % PLATFORM_MARK.length],
    person: PEOPLE[(h >>> 9) % PEOPLE.length],
  };
}

function nameFromDomain(domain) {
  return titleCase(String(domain || '').replace(/\.example$/i, '').replace(/-/g, ' ')).replace(/\bS\b/g, 's').replace(/ s /g, "'s ");
}

// HTML for a made-up site, then read with the real scan parser, so sample facts have the exact
// shape of real ones. Phone numbers are 555-01xx (fictional) and come back in contacts for sample runs.
function sampleSiteHtml(url, { year = 2026 } = {}) {
  const u = new URL(url);
  const domain = u.hostname.replace(/^www\./, '');
  const p = sampleProfile(domain, { year });
  const fam = familyOf(domain);
  const C = SAMPLE_CONTENT[fam] || SAMPLE_CONTENT.other;
  const name = nameFromDomain(domain);
  const base = `${p.https ? 'https' : 'http'}://${domain}`;
  const handle = domain.replace(/\.example$/, '').replace(/-/g, '');
  const phone = `55555501${String(hash(`tel:${domain.replace(/\.example$/, '')}`) % 100).padStart(2, '0')}`;
  const parts = [];
  parts.push('<!doctype html><html lang="en"><head><meta charset="utf-8">');
  parts.push(`<title>${esc(name)} | ${esc(C.services[0])}</title>`);
  if (p.description) parts.push(`<meta name="description" content="${esc(`${name}: ${C.copy.split('.')[0]}.`)}">`);
  if (p.mobile) parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push(`<meta name="theme-color" content="${p.color}">`);
  parts.push(`<style>.btn{background:${p.color};color:#fff}.accent{color:${p.accent}}.band{border-color:${p.accent}}</style>`);
  if (p.platform[1]) parts.push(p.platform[1]);
  if (p.pixel) parts.push('<script src="https://connect.facebook.net/en_US/fbevents.js"></script>');
  if (p.analytics) parts.push('<script src="https://www.googletagmanager.com/gtag/js?id=G-DEMO12345"></script>');
  if (p.googleAds) parts.push('<script src="https://www.googleadservices.com/pagead/conversion.js"></script>');
  if (p.chat) parts.push('<script src="https://code.tidio.co/demo.js"></script>');
  if (p.schema) parts.push(`<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"${esc(name)}","logo":"${base}/logo.png"}</script>`);
  parts.push('</head><body>');
  parts.push(`<header><img src="${base}/img/logo.png" alt="${esc(name)} logo"><nav><a href="${base}/about">About us</a> <a href="${base}/services">Services</a>${p.prices ? ` <a href="${base}/pricing">Pricing</a>` : ''} <a href="${base}/contact">Contact</a>${p.booking && C.booking.length ? ` <a href="${C.booking[0][1]}">Book now</a>` : ''}</nav></header>`);
  if (p.parked) {
    parts.push('<h1>Coming soon</h1><p>This site is under construction.</p></body></html>');
    return { html: parts.join('\n'), finalUrl: `${base}/`, profile: p };
  }
  parts.push(p.h1 ? `<h1>${esc(name)}</h1>` : `<div class="hero">${esc(name)}</div>`);
  parts.push(`<p>${esc(C.copy)} ${esc(C.copy)}</p>`);
  parts.push(`<h2>What we do</h2><ul>${C.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
  parts.push(`<p>We have served ${esc(nameFromDomain(domain).split(' ')[0])} neighbors with care and attention to detail. Every visit starts with a conversation about what you need, and ends with a clear next step. Ask us anything; we answer every message ourselves.</p>`);
  if (p.offer) parts.push(`<p class="accent"><strong>${esc(C.offer)}</strong></p>`);
  // Prices vary a little per sample business so price charts have a real spread.
  const vary = 0.75 + (hash(`price:${domain}`) % 11) / 20;
  if (p.prices) parts.push(`<h2>Pricing</h2>${C.prices.map((x) => `<p>${esc(x.replace(/\$(\d+)/g, (m, n) => `$${Math.round((Number(n) * vary) / 5) * 5}`))}</p>`).join('')}`);
  if (p.video) parts.push('<iframe src="https://www.youtube.com/embed/demo123" title="Video"></iframe>');
  for (let i = 0; i < p.images; i++) parts.push(`<img src="${base}/img/photo-${i + 1}.jpg" alt="${p.alt ? esc(`${C.services[i % C.services.length]} at ${name}`) : ''}">`);
  if (p.reviewsShown) parts.push('<h2>What our customers say</h2><p>Testimonials from people we have worked with.</p>');
  if (p.owner) parts.push(`<p>${esc(`${p.person[0]} ${p.person[1]}`)}, Owner</p>`);
  if (p.hours) parts.push('<p>Hours: Monday to Friday 7am to 6pm, Saturday 8am to 2pm</p>');
  if (p.form) parts.push(`<form action="${base}/contact"><input type="text" name="name"><input type="tel" name="phone"><button>Send</button></form>`);
  if (p.signup) parts.push('<form action="https://demo.us1.list-manage.com/subscribe/post"><input type="email" name="EMAIL"><button>Join our list</button></form>');
  if (p.map) parts.push('<iframe src="https://www.google.com/maps/embed?pb=demo" title="Map"></iframe>');
  const social = [];
  if (p.instagram) social.push(`<a href="https://www.instagram.com/${handle}/">Instagram</a>`);
  if (p.facebook) social.push(`<a href="https://www.facebook.com/${handle}">Facebook</a>`);
  if (p.tiktok) social.push(`<a href="https://www.tiktok.com/@${handle}">TikTok</a>`);
  if (p.youtube) social.push(`<a href="https://www.youtube.com/@${handle}">YouTube</a>`);
  parts.push(`<footer>${social.join(' ')} <a href="mailto:hello@${domain}">hello@${domain}</a> ${p.tapToCall ? `<a href="tel:+1${phone}">Call us</a>` : `<span>Call ${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}</span>`} <p>© ${p.footerYear} ${esc(name)}. All rights reserved.</p></footer>`);
  if (p.booking && C.booking.length) parts.push(`<a href="${C.booking[0][1]}">Book online</a>`);
  parts.push('</body></html>');
  return { html: parts.join('\n'), finalUrl: `${base}/`, profile: p, phone };
}

// A scan for a made-up .example site, the same shape as kit scan.scanSite, marked sample: true.
function sampleScan(url, { year = 2026 } = {}) {
  const norm = web.normalizeUrl(url);
  if (!norm) return { reachable: false, reason: 'No website listed.', sample: true };
  const domain = web.domainOf(norm);
  const p = sampleProfile(domain, { year });
  if (p.down) return { reachable: false, url: norm, reason: 'The site answered 500.', sample: true };
  const scanLib = require('./scan');
  const { html, finalUrl, phone } = sampleSiteHtml(norm, { year });
  const page = scanLib.parsePage(html, finalUrl);
  const merged = scanLib.tidy(scanLib.mergePages([page]));
  const parked = scanLib.parkedFrom(page);
  const out = { reachable: true, url: finalUrl, domain, redirectedFrom: null, parked: !!parked, parkedReason: parked, pagesRead: 1, https: /^https:/.test(finalUrl), ...merged, sample: true };
  if (phone && out.tapToCall) out.contacts = { ...out.contacts, phones: [`(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`] };
  return out;
}

// Scan a lead's website: the real kit scan, or a sample scan for .example sites.
async function scanFor(ctx, website, opts = {}) {
  if (!website) return null;
  if (isSampleUrl(website)) {
    const year = ctx && typeof ctx.now === 'function' ? new Date(ctx.now()).getUTCFullYear() : 2026;
    return sampleScan(website, { year });
  }
  try {
    return await require('./scan').scanSite(ctx, website, opts);
  } catch (e) {
    if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    return { reachable: false, url: website, reason: "Couldn't reach the site." };
  }
}

// The listing's link is a deep page that's gone while the homepage works (Funnels broken_link).
async function brokenLinkCheck(ctx, website, scan) {
  try {
    const u = new URL(web.normalizeUrl(website));
    if (!scan || !scan.reachable || u.pathname.replace(/\/+$/, '') === '' || isSampleUrl(website)) return false;
    const r = await web.getText(ctx, u.toString(), { timeoutMs: 8000, maxBytes: 20000 });
    return r.status === 404 || r.status === 410;
  } catch {
    return false;
  }
}

module.exports = {
  GAPS,
  FITS,
  LINES,
  siteStatus,
  siteName,
  ownerOf,
  trimScan,
  detect,
  makeLead,
  scoreLead,
  rankLeads,
  headline,
  shareableGaps,
  exportName,
  pipelineLead,
  known,
  CSV_COLUMNS,
  csvRow,
  isSampleUrl,
  sampleProfile,
  sampleSiteHtml,
  sampleScan,
  scanFor,
  brokenLinkCheck,
  familyOf,
  nameFromDomain,
  listText,
};
