// What competitors say they offer, read off their own websites (homepage plus a services, pricing or
// FAQ page, robots.txt respected), for "Find the gap". Each claim is a plain thing a buyer looks for
// ("Free quotes", "Weekend hours", "Text us"), found by its words, with the sentence it came from as
// evidence. A match that is turned down ("closed Sundays", "we don't offer financing") doesn't count.
// Claims that only fit some businesses list their families (kit places categories: fitness, food,
// beauty, health, home, auto, retail, pro, community, hospitality, other); fam null fits all. cats
// narrows a claim to some kinds within those families (no 24/7 calls for house cleaners). A sentence
// that asks ("Do you offer packages?") or tells a customer's story ("I only had Saturday available")
// isn't the business saying it, so it doesn't count.
// "Nobody says it" always means "none of the websites we read mention it", never "nobody does it".

const { web, leads, scan, text } = require('../../_kit');

// line: what the member could put on their site, only if it's true for them. [brackets] are theirs to fill.
const CLAIMS = [
  { id: 'free_quote', label: 'Free quotes or estimates', w: 2, fam: ['home', 'auto', 'pro', 'hospitality', 'other'], line: 'Free written quote before any work starts.', lines: { hospitality: 'A free written quote for your [event].', pro: 'A free first consultation, and a written quote.' }, re: /\bfree (in[- ]home |on[- ]site |written |no[- ]obligation |no[- ]cost )?(quotes?|estimates?|consultations?|consults?|assessments?|inspections?)\b|\b(quotes?|estimates?) (are |is )?(always )?free\b/i },
  { id: 'same_day', label: 'Same-day or next-day service', w: 3, fam: ['home', 'auto', 'health', 'beauty', 'pro', 'other'], line: 'Call before noon and we can often come the same day.', lines: { beauty: 'Same-day appointments when you call before noon.', health: 'Same-day appointments when you call before noon.', auto: 'Bring it in before noon and we can often finish the same day.' }, re: /\bsame[- ]day\b|\bnext[- ]day (service|appointments?|visits?|delivery)\b|\bwithin 24 hours\b|\bwalk[- ]ins? (are )?welcome\b/i },
  { id: 'emergency', label: '24/7 or emergency calls', w: 2, fam: ['home', 'auto', 'health'], cats: ['plumbers', 'hvac', 'electricians', 'roofers', 'contractors', 'auto', 'dentists', 'vets'], line: 'Emergency calls answered 24/7.', re: /\b24\/7\b|\b24 hours a day\b|\bemergency (service|calls?|repairs?|appointments?|visits?)\b|\bafter[- ]hours (service|calls?|care)\b/i },
  { id: 'weekends', label: 'Weekend hours', w: 2, fam: ['home', 'auto', 'pro', 'health', 'beauty', 'fitness', 'other'], line: 'Saturday appointments, for people who work all week.', lines: { fitness: 'Classes on Saturday and Sunday mornings.' }, re: /\b(open|hours|appointments?|available|availability|classes|service)\b[^.\n]{0,40}\b(saturdays?|sundays?|weekends?)\b|\b(saturdays?|sundays?|weekends?)\b[^.\n]{0,25}\b(open|available|appointments?|hours|classes)\b|\b(sat|sun)(urday|day)?\.?\s*:?\s*\d{1,2}(:\d\d)?\s*(am|a\.m\.)/i },
  { id: 'evenings', label: 'Evening hours', w: 2, fam: ['home', 'auto', 'pro', 'health', 'beauty', 'fitness', 'other'], line: 'Evening appointments, for people who work all day.', lines: { fitness: 'Classes after work, until [8 pm].' }, re: /\b(evening|after[- ]work|late) (hours|appointments?|classes|availability|openings?|sessions?)\b|\bopen (late|until (7|8|9|10)\s*(pm|p\.m\.)?)\b|\b(until|till|to)\s*(7|8|9|10)(:\d\d)?\s*(pm|p\.m\.)/i },
  { id: 'promise', label: 'A satisfaction promise', w: 3, fam: null, line: "If you're not happy, I'll redo it free within 48 hours.", lines: { food: "Not happy with your order? Tell us and we'll make it right.", retail: 'Not happy with it? Bring it back within [30 days].', beauty: "Not happy with your [cut]? Come back within [7 days] and we'll fix it free.", health: "Not happy with your visit? Call me and we'll make it right.", fitness: "Not for you? Tell us within [30 days] and we'll refund you.", community: "Not for you? Tell us within [30 days] and we'll refund you.", hospitality: "If something isn't right with your [stay], tell us and we'll fix it that day." }, re: /\b(satisfaction|happiness|money[- ]back|100%)\b[^.\n]{0,20}\b(guarantee\w*|promise|policy)\b|\bwe('ll| will) (make it right|redo it|come back|re-?clean|fix it)\b|\bfree (redo|re-?clean|touch[- ]?ups?|adjustments?)\b|\bguarantee\b/i },
  { id: 'warranty', label: 'A written warranty', w: 2, fam: ['home', 'auto'], cats: ['plumbers', 'hvac', 'electricians', 'roofers', 'contractors', 'auto', 'dealers'], line: 'A written warranty on the work: [how long].', re: /\bwarrant(y|ies|ied)\b/i },
  { id: 'licensed', label: 'Licensed and insured', w: 2, fam: ['home', 'auto', 'beauty', 'health', 'pro'], line: 'Licensed and insured. Ask to see the paperwork.', re: /\blicensed\b|\binsured\b|\bbonded\b/i },
  { id: 'background', label: 'Background-checked staff', w: 2, fam: ['home', 'community', 'health'], line: 'Every person we send is background-checked.', re: /\bbackground[- ]check(ed|s)?\b|\bvetted (staff|team|cleaners|sitters|walkers)\b/i },
  { id: 'upfront', label: 'Prices before the work starts', w: 2, fam: ['home', 'auto', 'pro', 'health', 'beauty', 'fitness', 'other'], neg: false, line: 'You get the price before we start. No surprises on the bill.', lines: { fitness: 'One clear monthly price. No sign-up or hidden fees.', beauty: 'You know the price before we start. No surprises.', health: 'You know the price before your visit. No surprises.' }, re: /\bupfront (pricing|prices?|quotes?)\b|\bflat[- ]rate\b|\bno hidden (fees|costs|charges)\b|\bno surprises?\b|\bclear (prices?|pricing|quotes?)\b|\btransparent pricing\b|\bprice (before|up front)\b/i },
  { id: 'reply_time', label: 'A promised reply time', w: 3, fam: null, line: 'We answer every message within [2 hours] while we are open.', re: /\b(reply|replies|respond|responds|response|get back to you|call you back|answer)\w*\b[^.\n]{0,30}\b(within|in under|same[- ]day|one business day|24 hours|an hour|\d+ (minutes|hours))\b/i },
  { id: 'text', label: 'Text us', w: 2, fam: null, line: 'Text us at [your number]. We answer the same day.', re: /\btext (us|me)\b|\bsend us a text\b|\btext or call\b|\bcall or text\b/i },
  { id: 'eco', label: 'Eco-friendly or non-toxic products', w: 1, fam: ['home', 'beauty', 'auto', 'food', 'retail'], line: 'Products that are safe around kids and pets.', lines: { food: '[Organic or local] ingredients, named on the menu.', retail: '[Organic or sustainable] products, labeled on the shelf.' }, re: /\beco[- ]?friendly\b|\bnon[- ]?toxic\b|\bgreen (cleaning|products)\b|\borganic\b|\bnatural (products|ingredients)\b|\bpet[- ]safe\b|\bchemical[- ]free\b|\bsustainab\w+/i },
  { id: 'local', label: 'Locally or family owned', w: 1, fam: null, line: "Locally owned. You'll talk to the owner.", lines: { food: 'Locally owned, here in [your city] since [year].', retail: 'Locally owned, here in [your city] since [year].', hospitality: 'Locally owned, here in [your city] since [year].' }, re: /\b(locally|family)[- ](owned|operated|run)\b|\bowner[- ]operated\b|\bindependently owned\b/i },
  { id: 'years', label: 'Years in business', w: 1, fam: null, line: '[Number] years doing this in [your city].', re: /\bsince (19[5-9]\d|20[0-2]\d)\b|\b\d{1,3}\+? years (of experience|in business|serving|of service)\b|\bover \d{1,3} years\b/i },
  { id: 'mobile', label: 'At-home or on-site service', w: 2, fam: ['beauty', 'auto', 'health', 'fitness', 'community', 'pro'], line: 'We come to you, at home or at work.', lines: { auto: 'We come to you: home, office or driveway.' }, re: /\bwe come to you\b|\bmobile (service|detailing|grooming|unit|clinic|massage|vet|salon|spa)\b|\bat your (home|door|office|place|location)\b|\bhouse calls?\b|\bin[- ]home (service|visits?|sessions?|lessons?|care)\b/i },
  { id: 'pickup', label: 'Pickup, delivery or a ride', w: 2, fam: ['food', 'retail', 'auto', 'home', 'beauty'], line: 'We pick up and drop off.', lines: { food: 'Delivery to your door: [where and when].', retail: 'Delivery or curbside pickup.', auto: 'We pick up your car and bring it back.' }, re: /\bpick[- ]?up and (drop[- ]?off|delivery)\b|\bfree (local )?delivery\b|\bdelivery (available|options?)\b|\bwe (deliver|ship) (to|in|across|throughout|anywhere|nationwide|daily|locally|within|right|straight|fresh|same)\b|\bcurbside\b|\bshuttle\b|\bloaner (cars?|vehicles?)\b|\bride (back|home|to work)\b/i },
  { id: 'financing', label: 'Payment plans or financing', w: 1, fam: ['home', 'auto', 'health', 'beauty', 'retail', 'pro'], line: 'Pay over time: [your payment plan].', re: /\bfinancing\b|\bpayment plans?\b|\bpay (over time|monthly|in installments)\b|\b(afterpay|klarna|affirm|sezzle|carecredit|care credit)\b|\b0% (apr|interest)\b/i },
  { id: 'membership', label: 'A membership or monthly plan', w: 2, fam: null, line: "A monthly plan for regulars: [price and what's included].", re: /\bmemberships?\b|\bmonthly (plans?|membership|package|subscription)\b|\bsubscriptions?\b|\bmaintenance (plans?|agreements?|club)\b|\b(vip|loyalty|members?) (club|program|plan)\b|\bunlimited\b/i },
  { id: 'packages', label: 'Packages or bundles', w: 1, fam: null, line: 'Packages that cost less than paying one at a time.', re: /\bpackages?\b|\bbundles?\b|\b(class|session) (packs?|cards?)\b|\bpunch cards?\b/i },
  { id: 'gift', label: 'Gift cards', w: 1, fam: ['food', 'beauty', 'fitness', 'retail', 'hospitality', 'auto', 'health'], line: 'Gift cards, ready the same day.', re: /\bgift (cards?|certificates?|vouchers?)\b/i },
  { id: 'referral', label: 'A thank-you for referrals', w: 1, fam: null, line: 'Send a friend and you both get [your thank-you].', re: /\brefer a friend\b|\breferral (program|bonus|rewards?|discount|credit)\b|\brefer(ral)?s? (get|earn)\b/i },
  { id: 'discounts', label: 'Senior, military or student discounts', w: 1, fam: null, line: '[10%] off for seniors, military and students.', re: /\b(senior|military|veterans?|student|teacher|first responder|nurse)s?'?\s+(and [a-z ]{3,30})?discounts?\b|\bdiscounts? for (seniors|military|veterans|students|teachers|first responders)\b/i },
  { id: 'kids', label: 'Kids and families welcome', w: 1, fam: ['fitness', 'food', 'beauty', 'health', 'community', 'hospitality', 'retail'], line: 'Kids welcome, and we plan for them.', re: /\b(kids?|children'?s?) (menu|meals?|classes|class|programs?|camps?|club|corner|area|play ?area|room|parties|party|cuts?|haircuts?|eat free|night)\b|\b(kid|family)[- ]friendly\b|\b(kids|children|families) (are )?(always )?welcome\b|\bages \d/i },
  { id: 'pets', label: 'Pets welcome', w: 1, fam: ['food', 'retail', 'hospitality'], line: 'Dogs welcome.', re: /\bpet[- ]friendly\b|\bdogs? (are )?welcome\b|\bdog[- ]friendly\b|\bbring your (dog|pup)\b/i },
  { id: 'accessible', label: 'Wheelchair accessible', w: 1, fam: null, line: 'Step-free entrance and an accessible restroom.', re: /\bwheelchair\b|\bada[- ]accessible\b|\baccessible (entrance|parking|restroom|building)\b|\bstep[- ]free\b/i },
  { id: 'language', label: 'Service in Spanish or another language', w: 1, fam: null, line: 'Se habla espa\u00f1ol.', re: /\bse habla espa[ñn]ol\b|\bhablamos espa[ñn]ol\b|\bspanish[- ]speaking\b|\bbilingual\b|\bwe speak (spanish|vietnamese|chinese|mandarin|cantonese|arabic|french|portuguese|korean|hindi|somali|russian|tagalog)\b|\ben espa[ñn]ol\b/i },
  { id: 'parking', label: 'Free or easy parking', w: 1, fam: ['fitness', 'food', 'beauty', 'health', 'retail', 'community', 'hospitality', 'pro'], line: 'Free parking right outside.', re: /\bfree parking\b|\bparking (lot|available|in (the )?(back|rear|front))\b|\bplenty of parking\b|\bon[- ]site parking\b|\boff[- ]street parking\b/i },
  { id: 'online', label: 'An online or virtual option', w: 1, fam: ['fitness', 'health', 'pro', 'community', 'beauty'], line: "Online sessions when you can't make it in.", re: /\bvirtual (sessions?|classes|consultations?|visits?|appointments?|lessons?|tours?)\b|\bonline (classes|sessions?|lessons?|consultations?|coaching|courses?|appointments?)\b|\btele(health|medicine)\b|\b(via|on) zoom\b/i },
  { id: 'no_contract', label: 'No long contracts', w: 2, fam: ['fitness', 'home', 'pro', 'beauty', 'community'], neg: false, line: "No contracts. Stay because it's good.", re: /\bno (long[- ]term )?(contracts?|commitments?)\b|\bcancel any ?time\b|\bmonth[- ]to[- ]month\b|\bno sign[- ]?up fees?\b/i },
  { id: 'insurance', label: 'Takes insurance', w: 2, fam: ['health'], line: 'We take [the insurance plans you accept].', re: /\b(accept|take|bill) (most |all major )?(insurance|insurances)\b|\bin[- ]network\b|\binsurance (accepted|welcome)\b|\bmedicare\b|\bmedicaid\b|\b(hsa|fsa)\b/i },
  { id: 'cleanup', label: 'Clean-up after the job', w: 1, fam: ['home'], cats: ['plumbers', 'hvac', 'electricians', 'roofers', 'landscapers', 'contractors'], line: 'We clean up before we leave.', re: /\bclean up after\b|\bleave (it|your home|the job site|the site) (clean|cleaner|spotless)\b|\bshoe covers\b|\bdrop cloths?\b/i },
  { id: 'photos', label: 'Photos of the work', w: 1, fam: ['home', 'auto', 'beauty', 'community'], line: 'Photos of the finished job, sent to your phone.', re: /\bbefore (and|&) after\b|\bphoto (updates?|reports?)\b|\bsend (you )?(photos|pictures)\b|\bpictures (home|of the)\b/i },
  { id: 'same_staff', label: 'The same person every time', w: 1, fam: ['home', 'beauty', 'fitness', 'community', 'health'], line: 'The same [cleaner] every visit.', re: /\bsame (cleaner|groomer|stylist|tech|technician|teacher|trainer|coach|walker|sitter|team|crew|person|therapist)\b[^.\n]{0,20}\b(every|each)\b/i },
  { id: 'catering', label: 'Catering or private events', w: 1, fam: ['food', 'hospitality'], line: 'Catering and private events for [10 to 60] people.', re: /\bcatering\b|\bprivate (events?|parties|dining|rooms?)\b|\bevent space\b/i },
  { id: 'custom', label: 'Custom orders', w: 2, fam: ['food', 'retail'], line: 'Custom orders: [what you make to order], ready in [3 days].', re: /\bcustom (cakes?|orders?|designs?|pieces?|work|engraving|framing|arrangements?|bouquets?|cookies)\b|\bmade[- ]to[- ]order\b|\bspecial orders?\b|\bpersonali[sz](ed|ation)\b|\bcustom[- ]made\b/i },
  { id: 'dietary', label: 'Vegan or gluten-free options', w: 2, fam: ['food'], line: 'Vegan and gluten-free options every day.', re: /\bvegan\b|\bvegetarian\b|\bgluten[- ]free\b|\bdairy[- ]free\b|\bnut[- ]free\b|\ballergens?\b|\bplant[- ]based\b/i },
  { id: 'order_online', label: 'Order online', w: 1, fam: ['food', 'retail'], line: 'Order online and skip the line.', re: /\border online\b|\bonline ordering\b|\border ahead\b|\bpre[- ]?orders?\b/i },
  { id: 'shipping', label: 'Shipping or local pickup', w: 1, fam: ['retail'], line: 'Local pickup or shipping.', re: /\bfree shipping\b|\bwe ship\b|\blocal pickup\b|\bin[- ]store pickup\b|\bcurbside pickup\b/i },
  { id: 'beginners', label: 'Beginners welcome', w: 2, fam: ['fitness', 'community', 'beauty'], line: "Beginners welcome. We'll show you everything.", re: /\bbeginners?( are)? welcome\b|\ball (levels|ages|abilities)\b|\bevery level\b|\bnew to (yoga|lifting|fitness|climbing|pilates|the gym)\b|\bno experience (needed|necessary)\b|\bfirst[- ]timers?\b/i },
  { id: 'childcare', label: 'Childcare while you train', w: 1, fam: ['fitness'], line: 'Childcare while you train.', re: /\bchild ?care\b|\bkids'? (club|room|corner|area)\b|\bbabysitting\b/i },
  { id: 'gentle', label: 'Calm care for nervous people or pets', w: 1, fam: ['health', 'beauty', 'community'], line: 'Gentle, calm visits for nervous [patients].', re: /\bsensory[- ]friendly\b|\bquiet hours?\b|\banxious (patients|dogs|pets|clients|kids)\b|\bfear[- ]free\b|\bsedation\b|\bgentle (care|handling|approach)\b|\bnervous (patients|dogs|pets|clients)\b/i },
];

// Facts the kit scan already reads (intel.scan_competitor): booking, prices, offer, reviews, video.
const FEATURE_CLAIMS = [
  { id: 'f_book', label: 'Book or buy online', w: 2, fam: null, line: 'Book online in under a minute.', lines: { food: 'Order online in under a minute.', retail: 'Buy online, pick up in the store.' }, has: (c) => (c.booking || []).length > 0 || !!(c.shop && c.shop.products) },
  { id: 'f_prices', label: 'Prices on the website', w: 3, fam: null, line: 'Prices on the website, so you know before you call.', has: (c) => (c.prices || []).length > 0 || !!(c.shop && c.shop.median) },
  { id: 'f_offer', label: 'A new-customer offer', w: 2, fam: null, line: 'New here? [Your first-visit offer].', has: (c) => !!c.offer },
  { id: 'f_reviews', label: 'Reviews on the website', w: 1, fam: null, line: 'Put 3 real reviews (with permission) on your homepage.', has: (c) => !!c.proof },
  { id: 'f_video', label: 'A video on the website', w: 1, fam: null, line: 'A 30-second video of a real visit near the top of your homepage.', has: (c) => !!c.video },
];

const NEGATED = /\b(no|not|never|don'?t|doesn'?t|do not|does not|cannot|can'?t|won'?t|unable|without|closed|unavailable|except)\b[^.\n]{0,30}$/i;

// One sentence around a match, clipped, as evidence the member can check.
function snippet(t, at, len) {
  const before = t.lastIndexOf('\n', at);
  let start = Math.max(before + 1, ...['. ', '! ', '? '].map((p) => t.lastIndexOf(p, at) + 2).filter((x) => x > 1), at - 110, 0);
  let end = at + len;
  const stop = t.slice(end).search(/[.!?\n]/);
  end = stop < 0 ? Math.min(t.length, end + 110) : Math.min(end + stop + 1, end + 110);
  let s = t.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0 && !/^[A-Z0-9"'(]/.test(s)) s = `...${s}`;
  return text.clip(text.plain(s), 160);
}

// The sentence a match sits in, whole (for the question and customer-story checks).
function sentenceAt(t, at, len) {
  const start = Math.max(t.lastIndexOf('\n', at), ...['. ', '! ', '? '].map((p) => t.lastIndexOf(p, at) + 1)) + 1;
  const rest = t.slice(at + len).search(/[.!?\n]/);
  return t.slice(start, rest < 0 ? t.length : at + len + rest + 1).trim();
}
// A customer's story (a review or testimonial on their page): "I" or "my" with something that happened.
const STORY = /\b(I|I'm|I've|I'd)\b[^\n]*\b(was|were|had|did|came|went|got|needed|called|booked|hired|used|tried|recommend(ed)?|loved|showed|arrived|left|asked)\b|\bmy (house|home|kids?|dog|cat|car|wife|husband|family|mom|dad|apartment|order|cake|hair)\b[^\n]*\b(was|were|had|came|looked|got)\b/;

// Page text -> { found: [ids], evidence: { id: sentence } }.
function claimsFromText(t) {
  const src = String(t || '');
  const found = [];
  const evidence = {};
  for (const c of CLAIMS) {
    const re = new RegExp(c.re.source, 'gi');
    for (const m of src.matchAll(re)) {
      const before = src.slice(Math.max(0, m.index - 40), m.index);
      if (c.neg !== false && NEGATED.test(before.split(/[.!?\n]/).pop())) continue;
      const sentence = sentenceAt(src, m.index, m[0].length);
      if (/\?\s*$/.test(sentence) || STORY.test(sentence)) continue;
      found.push(c.id);
      evidence[c.id] = snippet(src, m.index, m[0].length);
      break;
    }
  }
  return { found, evidence };
}

// A same-site FAQ link from the homepage, if there is one.
function faqLink(html, base) {
  let site;
  try {
    site = new URL(base).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  for (const m of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') === site && /\b(faqs?|questions)\b/i.test(`${m[2].replace(/<[^>]+>/g, ' ')} ${u.pathname}`)) return u.toString();
  }
  return null;
}

// A competitor's claims from its own pages: the homepage, then its services or pricing page and its
// FAQ (at most 2 more), robots.txt respected. The page text is cached 7 days for every member (public
// pages only) and the claims are read from it each run, so a better pattern applies at once.
// Sample (.example) sites read their made-up pages. null when the site couldn't be read.
async function readClaims(ctx, website, { extra = 2 } = {}) {
  const url = web.normalizeUrl(website);
  if (!url) return null;
  if (leads.isSampleUrl(url)) {
    const year = ctx && typeof ctx.now === 'function' ? new Date(ctx.now()).getUTCFullYear() : 2026;
    const { html } = leads.sampleSiteHtml(url, { year });
    return { ...claimsFromText(scan.textOf(html)), pages: 1 };
  }
  const got = await pageTexts(ctx, url, extra);
  return got ? { ...claimsFromText(got.texts.join('\n')), pages: got.texts.length } : null;
}

function pageTexts(ctx, url, extra) {
  const u = new URL(url);
  return web.cached(ctx, `intel:claims:v2:${web.domainOf(url)}${u.pathname.replace(/\/$/, '')}`, 24 * 7, async () => {
    const home = await web.fetchPage(ctx, url);
    if (!home.html) return null;
    const links = scan.parsePage(home.html, home.url).links || {};
    const seen = new Set([home.url.replace(/\/$/, '')]);
    const more = [];
    for (const x of [links.services || links.pricing || links.menu, links.pricing, faqLink(home.html, home.url) || links.about]) {
      const k = x ? x.replace(/\/$/, '') : '';
      if (!k || seen.has(k) || more.length >= extra) continue;
      seen.add(k);
      more.push(x);
    }
    const texts = [scan.textOf(home.html).slice(0, 40000)];
    for (const m of more) {
      const p = await web.fetchPage(ctx, m);
      if (p.html) texts.push(scan.textOf(p.html).slice(0, 40000));
    }
    return { texts };
  });
}

// The line a member could use, worded for their kind of business.
function lineOf(claim, family) {
  return (claim.lines && claim.lines[family || 'other']) || claim.line;
}

// The claims that fit a kind of business (family and category id from kit places categories).
function claimsFor(family, catId) {
  const fam = family || 'other';
  return CLAIMS.filter((c) => (!c.fam || c.fam.includes(fam)) && (!c.cats || !catId || c.cats.includes(catId))).concat(FEATURE_CLAIMS);
}

// Does this competitor (an intel.scan_competitor output) make this claim?
function has(comp, claim) {
  if (claim.has) return claim.has(comp);
  return !!(comp.claims && (comp.claims.found || []).includes(claim.id));
}

// Competitors read -> per claim: who says it, how many of how many, and the gap score
// (weight times the share who don't say it). Only sites we could read count.
function tally(comps, family, catId) {
  const read = comps.filter((c) => c && c.siteStatus === 'ok' && c.claims);
  const N = read.length;
  return claimsFor(family, catId).map((c) => {
    const who = read.filter((x) => has(x, c));
    const share = N ? who.length / N : 0;
    return {
      id: c.id,
      label: c.label,
      line: lineOf(c, family),
      w: c.w,
      n: who.length,
      of: N,
      who: who.map((x) => x.name),
      evidence: who.map((x) => ({ name: x.name, text: (x.claims.evidence || {})[c.id] || '' })).filter((e) => e.text).slice(0, 3),
      score: Math.round(c.w * (1 - share) * 100) / 100,
    };
  });
}

module.exports = { CLAIMS, FEATURE_CLAIMS, claimsFromText, readClaims, claimsFor, lineOf, has, tally, snippet, faqLink };
