// "Your first 25" for household businesses (detailing, cleaning, lawn, washing, tutoring, pet care):
// up to 15 people the member already knows, each with a personal text and a follow-up, plus up to 10
// local businesses that serve the same customers, each with a partner ask and a walk-in line.
// Nothing is pulled from a phone: the member types or pastes names. Owner: library thread.
//
// A pack's data/niche.json lists its partner types:
//   "partners": [ { "id": "dealers", "label": "Car dealerships",
//                   "search": { "category": "car_dealer", "words": "car dealerships" },
//                   "their_customers": "buyers",
//                   "why": "want the new car to stay looking new",
//                   "ask": "hand my card to buyers who ask about keeping the car clean",
//                   "give": "detail your lot cars at my founding price" } ]
// `search.category` is a kit places category; `search.words` is for Google text search.

const { plain, clip } = require('./text');
const { usd } = require('./money');
const { csv } = require('./files');
const { addDays } = require('./time');

const MAX_PEOPLE = 15;
const MAX_PARTNERS = 10;
const RELATION = /^(aunt|auntie|uncle|cousin|grandma|grandpa|nana|papa|coach|pastor|mr|mrs|ms|miss|dr|mom|dad)\.?$/i;

// "Lisa Moreno - neighbor, big yard" / "Aunt Lisa: 2 dogs" / "Jordan, 555-0101" / "Sam <sam@x.com>"
function parsePeople(input, { max = MAX_PEOPLE } = {}) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/\r?\n|;/);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    let name = '';
    let note = '';
    let phone = '';
    let email = '';
    if (item && typeof item === 'object') {
      name = plain(item.name || '');
      note = plain(item.note || item.notes || '');
      phone = String(item.phone || '').trim();
      email = String(item.email || '').trim();
    } else {
      let line = String(item || '').trim();
      if (!line || /^name\s*,/i.test(line)) continue;
      const em = line.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (em) {
        email = em[0];
        line = line.replace(em[0], ' ').replace(/[<>]/g, ' ');
      }
      const ph = line.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      if (ph) {
        phone = ph[0].trim();
        line = line.replace(ph[0], ' ');
      }
      const m = line.match(/^([^,:\-–—(]+)(?:[,:\-–—(]+(.*))?$/);
      name = plain((m ? m[1] : line).trim());
      note = plain(((m && m[2]) || '').replace(/[)\s,]+$/, '').trim());
    }
    name = name.replace(/\s+/g, ' ').trim();
    if (!name || name.length > 60 || !/[a-z]/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const words = name.split(' ');
    const greet = RELATION.test(words[0]) && words[1] ? `${words[0]} ${words[1]}` : words[0];
    out.push({ name, greet, note: clip(note, 120), phone, email });
    if (out.length >= max) break;
  }
  return out;
}

// The member's offer in a few words for messages: "$60 instead of $120", or a plain fallback.
function foundingLine({ founding, price, foundingPrice } = {}) {
  if (founding) return plain(founding);
  if (price && foundingPrice && foundingPrice < price) return `${usd(foundingPrice)} instead of ${usd(price)}`;
  if (foundingPrice) return usd(foundingPrice);
  return 'a founding price';
}

// No review asks here: Google bans any discount or gift for a review, and the FTC bans buying reviews.
// The founding price is for being early. Reviews get asked for after the job, with nothing attached.
const PEOPLE_TEXTS = [
  'Hey {greet}! Random question: I just started {what} around {area}. My first 3 customers get {founding} while I get going. Would you want one, or know someone who might?',
  'Hi {greet}, hope you\'re doing well! I\'m starting {what} here in {area} and looking for my first few customers. The first 3 get {founding}. Any chance you\'d want a spot?',
  'Hey {greet}! I\'m launching {what} in {area}. Before I open it up properly, my first 3 people get {founding}. Interested, or know someone who\'d like it?',
];
const PEOPLE_FOLLOW_UP = 'Hey {greet}, no pressure on my {what} message. If it\'s not for you, would you mind passing my number to one person who might want it? It would mean a lot.';

function fillIn(t, v) {
  return plain(String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '' : String(v[k]))).replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' '));
}

function personMessage(person, offer, index = 0) {
  const v = { greet: person.greet, what: offer.what, area: offer.area, founding: offer.foundingText };
  const t = PEOPLE_TEXTS[(index + (person.name.length % PEOPLE_TEXTS.length)) % PEOPLE_TEXTS.length];
  return { message: fillIn(t, v), follow_up: fillIn(PEOPLE_FOLLOW_UP, v) };
}

function partnerMessage(biz, type, offer) {
  const v = {
    biz: biz.name,
    me: offer.me || 'I',
    what: offer.what,
    area: offer.area,
    their: type.their_customers || 'customers',
    why: type.why || 'could use this',
    ask: type.ask || 'pass my card to customers who ask',
    give: type.give || 'point my customers your way',
  };
  const intro = offer.me ? `I'm ${offer.me}, and I just started {what} in {area}.` : 'I just started {what} in {area}.';
  const message = fillIn(`Hi {biz} team, ${intro} A lot of your {their} {why}. Would you be open to letting me {ask}? In return I'd be glad to {give}. I can stop by with cards any day this week.`, v);
  const walk_in = fillIn(`Hi, is the owner or manager around? ${offer.me ? `I'm ${offer.me}. ` : ''}I do {what} nearby, and a lot of your {their} {why}. Could I {ask}? I'd be glad to {give}.`, v);
  return { message, walk_in };
}

// Sample partners when no business list is available (no Places key, map data unreachable).
function samplePartners(types, city, limit) {
  const streets = ['Main St', 'Oak Ave', 'Park Rd', '2nd St', 'Lake Dr', 'Elm St', 'Market St', 'Hill Rd', 'River Rd', 'Pine St'];
  const prefixes = ['Northside', 'Corner', 'Hometown', 'Lakeside', 'Summit', 'Riverside', 'Maple', 'Union', 'Westgate', 'Eastview'];
  const out = [];
  let i = 0;
  while (out.length < limit && types.length) {
    const t = types[i % types.length];
    const noun = String(t.label || 'Business').replace(/s$/, '').replace(/ies$/, 'y');
    out.push({
      name: `${prefixes[i % prefixes.length]} ${noun} (sample)`,
      type: t.id,
      address: `${100 + i * 37} ${streets[i % streets.length]}${city ? `, ${city}` : ''}`,
      phone: `555-01${String(10 + i).padStart(2, '0')}`,
      website: null,
      rating: null,
      reviews: null,
      source: 'sample',
    });
    i++;
  }
  return out;
}

// Spread picks across partner types so the 10 aren't all one kind of business.
function roundRobin(lists, limit) {
  const out = [];
  const seen = new Set();
  let added = true;
  for (let r = 0; added && out.length < limit; r++) {
    added = false;
    for (const l of lists) {
      const b = l[r];
      if (!b) continue;
      added = true;
      const key = String(b.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(b);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// Lists local partners for each type. `find(type, {city, limit})` returns businesses
// { name, address, phone, website, rating, reviews, source, place_id }; packs pass the kit places
// search (or a leads tool's output). Without one, or when it finds nothing, sample partners.
async function partnerSearch(ctx, { city, types = [], limit = MAX_PARTNERS, find } = {}) {
  const per = Math.max(2, Math.ceil(limit / Math.max(1, types.length)) + 1);
  const lists = [];
  const notes = [];
  let real = false;
  if (typeof find === 'function' && city) {
    for (const t of types) {
      try {
        const found = (await find(t, { city, limit: per })) || [];
        const list = found.filter((b) => b && b.name).map((b) => ({ ...b, type: t.id }));
        if (list.length && !list.every((b) => b.source === 'sample')) real = true;
        lists.push(list);
      } catch (err) {
        notes.push(`Couldn't list ${String(t.label || t.id).toLowerCase()} near ${city} right now.`);
        lists.push([]);
      }
    }
  }
  let partners = roundRobin(lists, limit);
  let sample = false;
  if (!partners.length) {
    partners = samplePartners(types, city, Math.min(limit, Math.max(types.length * 2, 4)));
    sample = true;
  }
  return { partners, sample: sample || !real, notes };
}

// The whole first 25 for a household pack. offer: { what, area, me, founding | price + foundingPrice }.
// Returns plain data a tool can return as its output (well under the 256 KB step limit).
async function household(ctx, { people, partners, types = [], city, offer = {}, start, find, maxPeople = MAX_PEOPLE, maxPartners = MAX_PARTNERS } = {}) {
  const o = {
    what: plain(offer.what || 'my new business'),
    area: plain(offer.area || city || 'town'),
    me: offer.me ? plain(offer.me) : '',
    foundingText: foundingLine(offer),
  };
  const ppl = parsePeople(people, { max: maxPeople }).map((p, i) => ({ ...p, ...personMessage(p, o, i) }));
  let list = Array.isArray(partners) ? partners.slice(0, maxPartners) : null;
  let sample = false;
  const notes = [];
  if (!list) {
    // Default: the kit places finder (OpenStreetMap, sample when it can't answer). Only when the run
    // has the harness's guarded fetch, so a bare call never reaches the network.
    let finder = find;
    if (!finder && ctx && typeof ctx.fetch === 'function') {
      try {
        finder = require('./places').finder(ctx);
      } catch {
        finder = null;
      }
    }
    const r = await partnerSearch(ctx, { city, types, limit: maxPartners, find: finder });
    list = r.partners;
    sample = r.sample;
    notes.push(...r.notes);
  }
  const byId = Object.fromEntries(types.map((t) => [t.id, t]));
  const part = list.map((b) => {
    const t = byId[b.type] || types[0] || {};
    return {
      name: plain(b.name),
      type: t.label || b.type || '',
      address: b.address || '',
      phone: b.phone || '',
      website: b.website || '',
      rating: b.rating == null ? null : b.rating,
      reviews: b.reviews == null ? null : b.reviews,
      source: b.source || '',
      place_id: b.place_id || undefined,
      ...(b.searchBy ? { searchBy: b.searchBy } : {}),
      ...(b.hours ? { hours: plain(b.hours) } : {}),
      why: plain(t.why || ''),
      ...partnerMessage(b, t, o),
    };
  });
  const day0 = start || null;
  const followOn = day0 ? addDays(day0, 3) : null;
  const firstBatch = Math.min(5, part.length);
  const rest = Math.max(0, part.length - firstBatch);
  const plan = [
    ppl.length ? `Tonight: send the ${ppl.length} texts. Short and personal beats polished.` : 'Tonight: write down 15 people you know and send each one a text.',
    firstBatch ? `Tomorrow: walk into ${firstBatch} of the businesses with a few cards, or send the message if you can't go in person.` : 'Tomorrow: write down 10 local businesses that serve the same customers you do.',
    `Day 3: ${rest ? `the other ${rest} businesses, and ` : ''}follow up with anyone who hasn't answered${followOn ? ` (${followOn})` : ''}.`,
    'Every yes: book it, do great work, then ask for an honest review the same day. Never attach a discount or gift to a review.',
  ];
  if (!ppl.length) notes.push('Add the names of people you know (one per line) to get a personal text for each.');
  if (sample) notes.push(city ? `The businesses are samples until a business list source is connected for ${city}.` : 'Add your city to search real businesses near you.');
  const sources = new Set(part.map((b) => b.source));
  const attribution = sources.has('osm') ? '© OpenStreetMap contributors' : sources.has('google') ? 'Google Maps' : null;
  return { people: ppl, partners: part, total: ppl.length + part.length, plan, offer: o, sample, notes, attribution };
}

// One CSV for the member's pipeline: people and partners together, with follow-up dates.
function toCsv(result, { start } = {}) {
  const follow = start ? addDays(start, 3) : '';
  const rows = [
    ...(result.people || []).map((p) => ({ kind: 'Person you know', name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow_up: p.follow_up, follow_up_on: follow, status: 'To send' })),
    ...(result.partners || []).map((b) => ({ kind: `Partner: ${b.type}`, name: b.name, contact: [b.phone, b.website].filter(Boolean).join(' '), note: b.address, message: b.message, follow_up: b.walk_in, follow_up_on: follow, status: 'To send' })),
  ];
  return csv(rows, [
    { key: 'kind', label: 'Who' },
    { key: 'name', label: 'Name' },
    { key: 'contact', label: 'Contact' },
    { key: 'note', label: 'Note' },
    { key: 'message', label: 'Message' },
    { key: 'follow_up', label: 'Follow-up or walk-in line' },
    { key: 'follow_up_on', label: 'Follow up on' },
    { key: 'status', label: 'Status' },
  ]);
}

module.exports = { MAX_PEOPLE, MAX_PARTNERS, parsePeople, foundingLine, personMessage, partnerMessage, partnerSearch, samplePartners, household, toCsv };
