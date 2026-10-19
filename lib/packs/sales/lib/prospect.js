// What we know about one prospect before a call or a proposal: what the member pasted (their notes,
// what the buyer said) and, for a business with a website, the facts on its own public pages (kit
// scan, robots respected). Gaps are phrased as "couldn't find", because a scan can miss things.
// Never a fact that isn't on their site or in the member's notes.

const { text, time } = require('../../_kit');

// Gaps worth raising, by the member's kind of business (niche id), most useful first.
const RELEVANT = {
  webdesign: ['booking', 'mobile', 'tapToCall', 'prices', 'old', 'https', 'reviews', 'hours'],
  frontdesk: ['booking', 'chat', 'tapToCall', 'hours', 'prices'],
  reviews: ['reviews', 'booking'],
  social: ['socials', 'video', 'reviews'],
  video: ['video', 'socials'],
  ugc: ['video', 'socials'],
  photo: ['photos', 'socials'],
  bookkeeping: [],
  b2b: ['booking', 'reviews', 'mobile', 'tapToCall'],
};

function gapsFrom(scan, { year } = {}) {
  if (!scan || !scan.reachable) return [];
  const out = [];
  const add = (key, label) => out.push({ key, label });
  if (!scan.booking || !scan.booking.length) add('booking', "I couldn't find a way to book or request a quote online.");
  if (scan.mobileReady === false) add('mobile', "The site isn't set up to fit phone screens.");
  if (scan.tapToCall === false && scan.contacts && scan.contacts.phones && !scan.contacts.phones.length) add('tapToCall', "I couldn't find a tap-to-call phone number.");
  if (scan.https === false) add('https', "The site doesn't load over a secure (https) connection.");
  if (scan.copyrightYear && year && scan.copyrightYear < year - 1) add('old', `The footer still says ${scan.copyrightYear}, which can make the site look out of date.`);
  if (!scan.testimonials && !(scan.reviewWidgets && scan.reviewWidgets.length)) add('reviews', "I couldn't find reviews or testimonials on the site.");
  if (scan.socials && !scan.socials.instagram && !scan.socials.facebook && !scan.socials.tiktok) add('socials', "I couldn't find Instagram, Facebook or TikTok linked from the site.");
  if (scan.video && !scan.video.onSite && !scan.video.unknown) add('video', "I couldn't find any video on the site.");
  if (!scan.prices || !scan.prices.length) add('prices', "I couldn't find prices or starting prices on the site.");
  if (!scan.chat || !scan.chat.length) add('chat', "I couldn't find a chat or text option for questions after hours.");
  if (!scan.hours) add('hours', "I couldn't find opening hours on the site.");
  if (scan.imageCount != null && scan.imageCount < 4) add('photos', 'There are only a few photos on the site.');
  return out;
}

function relevantGaps(gaps, nicheId, arch) {
  const want = RELEVANT[nicheId] || (arch === 'b2b' ? RELEVANT.b2b : ['booking', 'reviews', 'mobile']);
  const rank = (g) => {
    const i = want.indexOf(g.key);
    return i < 0 ? 99 : i;
  };
  return gaps.filter((g) => want.includes(g.key)).sort((a, b) => rank(a) - rank(b));
}

// The member's pasted notes, as short lines: "They want online booking. Budget around $2k."
function noteLines(notes) {
  return String(notes || '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"])/)
    .map((l) => text.oneLine(l.replace(/^[\s\-*•·]+/, '')))
    .filter((l) => l.length > 2)
    .slice(0, 12);
}

// The facts block: plain, dated, sourced.
function factsFrom(scan, readOn) {
  if (!scan || !scan.reachable) return [];
  const out = [];
  const when = time.shortDate(readOn);
  const what = scan.description || scan.h1 || scan.title;
  if (what) out.push(`Their site says: "${text.clip(what, 160)}"`);
  const services = (scan.headings || []).filter((h) => h && h.length > 3 && h.length < 60 && !/^(home|about|contact|menu|services|our services|welcome|faq|reviews|testimonials|gallery|blog|news|follow us|get in touch|hours|location)$/i.test(h)).slice(0, 6);
  if (services.length) out.push(`Headings on their site: ${services.join(', ')}.`);
  if (scan.prices && scan.prices.length) out.push(`Prices on their site: ${scan.prices.slice(0, 3).map((p) => text.clip(p.context, 60)).join('; ')}.`);
  if (scan.hours) out.push(`Hours listed: ${text.clip(scan.hours, 80)}.`);
  if (scan.booking && scan.booking.length) out.push(`Booking: ${scan.booking.map((b) => b.name).join(', ')}.`);
  if (scan.people && scan.people.length) out.push(`Named on the site: ${scan.people.map((p) => `${p.name} (${p.role})`).join(', ')}.`);
  if (scan.platform) out.push(`Built on ${scan.platform}.`);
  out.push(`Read from ${scan.domain} on ${when}.`);
  return out;
}

module.exports = { RELEVANT, gapsFrom, relevantGaps, noteLines, factsFrom };
