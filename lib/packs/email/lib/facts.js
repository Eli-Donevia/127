// The member's facts for email copy: brain first, then what they typed. Unknowns stay empty so
// the copy can leave a [bracket] instead of making something up.

const { brain, text, time } = require('../../_kit');

const lower1 = (s) => (s && !/^[A-Z]{2,}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s || '');

// "Free scent guide for every room" -> "scent guide for every room"
function thingName(s) {
  const t = text.oneLine(s || '').replace(/\([^)]*\)/g, '').replace(/^(a|an|the|my|our|free)\s+/i, '').replace(/^(free)\s+/i, '').trim();
  return (t.match(/\b[A-Z][a-z]+/g) || []).length >= 2 ? t : lower1(t);
}

function dateText(d) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${time.WEEKDAYS[time.weekdayOf(d)]}, ${time.longDate(d).replace(/,\s*\d{4}$/, '')}` : '';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const linesOf = (s, max) =>
  String(s || '')
    .split(/\n+/)
    .map((x) => text.oneLine(x))
    .filter(Boolean)
    .slice(0, max);

// The next weekday after today: when a dated email series starts if the member gives no date.
function nextWorkday(d) {
  let x = time.addDays(d, 1);
  while ([0, 6].includes(time.weekdayOf(x))) x = time.addDays(x, 1);
  return x;
}

// The newsletter's issue is the month it's made in (a repeat runs on the 1st).
function issueMonth(d) {
  return MONTHS[Number(String(d).slice(5, 7)) - 1] || '';
}

function factsFor(ctx, input = {}) {
  const b = brain.brainOf(ctx, {});
  const today = time.today(ctx);
  const sells = /(service|clean|lawn|tutor|coach|detail|photo|lesson|class|session|repair|install|wash|groom|walk|care)/i.test(`${b.what} ${b.niche} ${b.offer}`) ? 'book' : 'order';
  return {
    business: b.name || 'my business',
    hasName: Boolean(b.name),
    first: b.firstName || '',
    what: b.what,
    niche: b.niche,
    offer: lower1(b.offer),
    priceText: b.priceText || '',
    audience: b.audience,
    city: b.city,
    place: b.place,
    website: b.website,
    site: (b.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    instagram: b.instagram,
    timezone: b.timezone || 'America/Chicago',
    verb: sells,
    thing: thingName(input.offer || ''),
    link: String(input.link || '').trim(),
    launch: thingName(input.launch || ''),
    launchTitle: text.oneLine(input.launch || ''),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : '',
    dateText: dateText(input.date),
    closeDate: /^\d{4}-\d{2}-\d{2}$/.test(input.closeDate || '') ? input.closeDate : '',
    closeText: dateText(input.closeDate),
    shipping: text.oneLine(input.shipping || '').replace(/[.]+$/, ''),
    returns: text.oneLine(input.returns || '').replace(/[.]+$/, ''),
    discount: text.oneLine(input.discount || '').replace(/[.]+$/, ''),
    topic: text.oneLine(input.topic || '').replace(/[.!?]+$/, ''),
    tips: linesOf(input.tips, 8),
    news: text.oneLine(input.news || '').replace(/[.!]+$/, ''),
    newsLines: linesOf(input.news, 6),
    tip: text.oneLine(input.tip || ''),
    coming: text.oneLine(input.coming || ''),
    start: /^\d{4}-\d{2}-\d{2}$/.test(input.start || '') ? input.start : nextWorkday(today),
    month: issueMonth(today),
    today,
    seed: `${b.name}|${input.offer || input.launch || ''}`,
  };
}

module.exports = { factsFor, thingName, dateText, lower1, nextWorkday, issueMonth };
