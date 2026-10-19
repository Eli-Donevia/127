// The missed-call plan for one contractor, built only from facts read off their own website
// (lib/site.js). Texts stay under 320 characters, say who they're from, ask one question, and say
// how to stop. Anything we couldn't find is marked "Not on your website" with a suggested line the
// owner confirms. No AI needed; every line is a template filled with their facts.

const kit = require('../../_kit');
const { plain } = kit.text;
const NICHE = require('../data/niche.json');

const STOP = 'Reply STOP to opt out.';
const end = (s) => { const t = String(s || '').trim(); return /[.!?]$/.test(t) ? t : `${t}.`; };

function shortName(name) {
  return plain(String(name || 'our team').replace(/\s*(,?\s*(llc|inc\.?|co\.?|company|corp\.?))+$/i, '').trim()) || 'our team';
}

function serviceWords(facts, trade) {
  const t = NICHE.trades[trade] || NICHE.trades.contractors;
  const list = (facts.services || []).map((s) => s.text);
  return { list, example: list.find((s) => !/^(repairs?|installs?|emergency service)$/i.test(s)) || t.example_service, ask: t.example_ask };
}

function andList(items) {
  const a = (items || []).filter(Boolean);
  return a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] || '';
}

function areaLine(facts) {
  const a = facts.area;
  if (!a || !a.places.length) return '';
  return andList(a.places.slice(0, 4));
}

// The texts their number would send.
function texts(facts, { trade = 'contractors', city = '' } = {}) {
  const biz = shortName(facts.name);
  const link = facts.booking && facts.booking.link;
  const bookLine = link ? `Or book a time here: ${link}` : 'Reply with your address and a good time, and we\'ll call you back.';
  const missed = plain(`Hi, this is ${biz}. Sorry we missed your call! We're probably on a job. What can we help with? ${bookLine} ${STOP}`);
  const hours = facts.hours ? facts.hours.text : '';
  const emergency = !!facts.emergency;
  const afterHours = plain(
    `Thanks for calling ${biz}. We're closed right now${hours ? ` (our hours: ${hours})` : ''}. Text us what's going on and we'll get back to you first thing.${emergency ? ' If it\'s an emergency, reply URGENT and we\'ll call you back.' : ''} ${STOP}`,
  );
  const quote = plain(`Thanks for reaching out to ${biz}! To get you a price, can you send a photo of the problem and your zip code? We'll reply with next steps today. ${STOP}`);
  const how = facts.prices && facts.prices.length ? `Our website lists ${facts.prices[0].replace(/\.$/, '')}.` : 'It depends on what we find.';
  const howMuch = plain(`Good question. ${how} What's going on, and what's the address or zip? Then we can give you a clear price before any work starts.`);
  const confirm = plain(`You're booked with ${biz} for [day] between [time window]. We'll text when we're on the way. Reply here if anything changes.`);
  return [
    { id: 'missed', label: 'Missed call (during hours)', text: missed, chars: missed.length },
    { id: 'after', label: 'Missed call (after hours)', text: afterHours, chars: afterHours.length },
    { id: 'quote', label: 'Quote request', text: quote, chars: quote.length },
    { id: 'price', label: 'Reply to "How much?"', text: howMuch, chars: howMuch.length },
    { id: 'confirm', label: 'Booking confirmed', text: confirm, chars: confirm.length },
  ];
}

// What a caller can do today, from their own site.
function auditRows(facts, site) {
  const yes = (b) => (b ? 'Yes' : 'No');
  const page = (f) => (f && f.page ? f.page : site.url || '');
  const rows = [
    { item: 'Phone you can tap to call', miss: 'a phone number they can tap to call', found: facts.phone ? `${facts.phone}${facts.tapToCall ? ' (tap to call works)' : ' (shown as text, not tap to call)'}` : 'Not found', ok: !!facts.phone && facts.tapToCall, page: site.url },
    { item: 'Hours', miss: 'your hours', found: facts.hours ? `"${facts.hours.text}"` : 'Not on your website', ok: !!facts.hours, page: page(facts.hours) },
    { item: 'Services', miss: 'a list of your services', found: facts.services.length ? facts.services.slice(0, 5).map((s) => s.text).join(', ') : 'No list of services found', ok: facts.services.length >= 2, page: page(facts.services[0]) },
    { item: 'Service area', miss: 'your service area', found: facts.area ? `"${facts.area.quote}"` : 'Not on your website', ok: !!facts.area, page: page(facts.area) },
    { item: 'After hours or emergencies', miss: 'what to do after hours', found: facts.emergency ? `"${facts.emergency.text}"` : 'Not mentioned', ok: !!facts.emergency, page: page(facts.emergency) },
    { item: 'Book online', miss: 'a way to book online', found: facts.booking ? `Yes, through ${facts.booking.tools.join(' and ')}` : 'No booking link found', ok: !!facts.booking, page: site.url },
    { item: 'Chat or text from the website', miss: 'a chat or text option', found: facts.chat.length ? `Yes (${facts.chat.join(', ')})` : 'None found', ok: facts.chat.length > 0, page: site.url },
    { item: 'Contact form', miss: 'a contact form', found: yes(facts.forms > 0), ok: facts.forms > 0, page: site.url },
    { item: 'Answers to common questions (FAQ)', miss: 'answers to common questions', found: facts.faq.length ? `${facts.faq.length} found` : 'None found', ok: facts.faq.length > 0, page: page(facts.faq[0]) },
  ];
  return rows;
}

// FAQ answers drafted from their pages. Each answer says where it came from, or that it's a
// suggestion to confirm because the site doesn't say.
function faq(facts, { trade = 'contractors', city = '' } = {}) {
  const biz = shortName(facts.name);
  const sv = serviceWords(facts, trade);
  const area = areaLine(facts);
  const out = [];
  const add = (q, a, from) => out.push({ q, a: plain(a), from: from ? 'From your website' : 'Suggested: not on your website yet, confirm with the owner' });
  add('What are your hours?', facts.hours ? `We're open ${facts.hours.text}. Outside those hours, text this number and we'll reply first thing.` : 'Our hours are [add your hours]. Outside those hours, text this number and we\'ll reply first thing.', !!facts.hours);
  add('Do you serve my area?', area ? `Yes, we serve ${area}. Send your zip code and we'll confirm.` : `We work in and around ${city || '[your city]'}. Send your zip code and we'll confirm.`, !!area);
  add('What services do you offer?', sv.list.length ? `We handle ${andList(sv.list.slice(0, 5).map((x) => x.split(' ').map((w) => (/^[A-Z0-9&]{2,}$/.test(w) ? w : w.toLowerCase())).join(' ')))}. Tell us what's going on and we'll point you to the right visit.` : 'Tell us what\'s going on and we\'ll tell you if it\'s a job for us.', sv.list.length > 0);
  add('Do you handle emergencies?', facts.emergency ? `${end(facts.emergency.text)} Call or text this number and say it's urgent.` : 'Text this number with what\'s happening and say if it\'s urgent. [Add your emergency policy.]', !!facts.emergency);
  add('How much does it cost?', facts.prices.length ? `Our website lists: ${facts.prices.slice(0, 2).join('; ')}. We give you a clear price before any work starts.` : 'It depends on the job. We give you a clear price before any work starts. [Add your service call fee if you have one.]', facts.prices.length > 0);
  if (facts.offer) add('Do you give free estimates?', `${end(facts.offer)} Text a photo of the problem to get started.`, true);
  if (facts.licensed) add('Are you licensed and insured?', end(facts.licensed.text), true);
  add('How do I book?', facts.booking && facts.booking.link ? `Book online here: ${facts.booking.link}, or reply with a good time and we'll set it up.` : 'Reply with your address and a good time, and we\'ll call you to set it up.', !!(facts.booking && facts.booking.link));
  for (const f of (facts.faq || []).slice(0, 3)) if (!out.some((x) => x.q.toLowerCase() === f.q.toLowerCase())) out.push({ q: f.q, a: plain(f.a), from: 'From your website (your own FAQ)' });
  return out;
}

// The booking flow, step by step, using their own tools and facts.
function bookingFlow(facts, { trade = 'contractors' } = {}) {
  const tool = facts.booking ? facts.booking.tools[0] : '';
  const area = areaLine(facts);
  return [
    { step: 'Missed call', what: 'The caller gets the missed-call text within a minute, from the business number.' },
    { step: 'They reply', what: `They say what's wrong. The reply asks for their address or zip${area ? ` and checks it against ${area}` : ''}.` },
    { step: 'Pick a time', what: tool ? `They get the ${tool} booking link, or two time windows to choose from.` : 'They get two time windows to choose from. (No online booking on the website yet; a free booking page can be added.)' },
    { step: 'Confirmed', what: `A confirmation text with the day, the time window${facts.offer ? ` and "${facts.offer}"` : ''}.` },
    { step: 'Owner alert', what: 'The owner gets a text or app alert with the name, address, problem and time.' },
    { step: 'Day before', what: 'A reminder text the day before, with a reply-to-reschedule line.' },
  ];
}

// A sample conversation (clearly a sample) built from their facts.
function conversation(facts, { trade = 'contractors' } = {}) {
  const t = texts(facts, { trade });
  const sv = serviceWords(facts, trade);
  const area = facts.area && facts.area.places[0];
  const hasLink = !!(facts.booking && facts.booking.link);
  return [
    { from: 'business', text: t[0].text },
    { from: 'caller', text: `Hi, ${sv.ask}. Can someone come out this week?` },
    { from: 'business', text: "Sorry to hear that! We can help. What's the address or zip code?" },
    { from: 'caller', text: area ? `I'm in ${area}.` : "It's 50309." },
    { from: 'business', text: hasLink ? `Great. Pick any open time here: ${facts.booking.link}, or tell us what works and we'll book it for you.` : 'Great. We have Tuesday 8 to 10am or Wednesday 1 to 3pm. Which works?' },
    { from: 'caller', text: hasLink ? 'Booked Tuesday morning, thanks!' : 'Tuesday morning works.' },
    { from: 'business', text: t[4].text.replace('[day]', 'Tuesday').replace('[time window]', '8 and 10am') },
  ];
}

module.exports = { texts, auditRows, faq, bookingFlow, conversation, shortName, areaLine, andList, STOP };
