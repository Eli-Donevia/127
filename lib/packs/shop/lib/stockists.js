// Shops that might stock a maker's product (data/stockists.json), how well each fits from public facts
// only, and the messages and line sheet for asking them. Fit is a guess from what a shop's map entry
// and homepage show, never a promise that it will buy. Wholesale prices start from keystone
// (data/wholesale.json): half the member's own retail price unless they set another share.

const { text, money, outreach } = require('../../_kit');
const ST = require('../data/stockists.json');
const WS = require('../data/wholesale.json');
const { sentence, lowerFirst } = require('./brand');

const CATS = ST.categories;
const GIFTS = CATS.find((c) => c.id === 'gifts') || CATS[CATS.length - 1];

// The category whose words appear most in what the member makes.
function categoryOf(...texts) {
  const s = texts.filter(Boolean).join(' ');
  let best = null;
  let hits = 0;
  for (const c of CATS) {
    if (c === GIFTS) continue; // its words match anything: it's the fallback
    const n = (s.match(new RegExp(`\\b(${c.match})`, 'gi')) || []).length;
    if (n > hits) {
      best = c;
      hits = n;
    }
  }
  return best || GIFTS;
}

const fitRx = (cat) => new RegExp(cat.fit, 'i');

// 0 to 100 from public facts. Returns { score, facts, why }.
function scoreShop(p, probe, cat, { price } = {}) {
  let score = 0;
  const facts = [];
  const primary = cat.primary.includes(p.kind);
  score += primary ? 25 : cat.secondary.includes(p.kind) ? 10 : 3;
  const where = p.miles != null ? `${p.miles} ${p.miles === 1 ? 'mile' : 'miles'} away` : '';
  facts.push(`${p.kindLabel || 'Shop'}${where ? `, ${where}` : ''}.`);
  if (p.miles != null) score += p.miles <= 2 ? 12 : p.miles <= 5 ? 8 : p.miles <= 10 ? 4 : 0;
  const local = (probe && probe.local) || [];
  if (local.length) {
    score += 20;
    facts.push(`Their homepage mentions ${text.list(local.slice(0, 2).map((w) => `"${w}"`))}.`);
  }
  const cata = probe && probe.catalog;
  if (cata && cata.matches) {
    score += 20;
    facts.push(`Their online shop already sells ${cat.many} (${text.plural(cata.matches, 'product')}${cata.priceMin != null ? `, ${cata.priceMin === cata.priceMax ? money.usd(cata.priceMin) : `${money.usd(cata.priceMin)} to ${money.usd(cata.priceMax)}`}` : ''}).`);
    if (price && cata.priceMin != null && price >= cata.priceMin * 0.8 && price <= cata.priceMax * 1.25) score += 5;
  } else if (probe && probe.fitHits) {
    score += 12;
    facts.push(`Their homepage mentions ${cat.many}.`);
  }
  const email = p.email || (probe && probe.emails && probe.emails[0]) || null;
  const ig = p.instagram || (probe && probe.socials && probe.socials.instagram) || null;
  if (email) score += 8;
  if (ig) score += 4;
  if (p.website) score += 3;
  if (!p.website) facts.push('No website on the map, so walk in or call.');
  score = Math.max(0, Math.min(100, score));
  const why = [primary ? `${p.kindLabel || 'Shop'}` : `${p.kindLabel || 'Shop'} (gifts on the side)`, local.length ? 'features local makers' : '', cata && cata.matches ? `sells ${cat.many}` : probe && probe.fitHits ? `mentions ${cat.many}` : '', where].filter(Boolean).join(', ');
  return { score, facts: facts.slice(0, 5), why: text.clip(why, 120), email, instagram: ig };
}

// The best first channel (contract 13).
function channelOf(s) {
  if (s.email) return 'email';
  if (s.instagram) return 'ig';
  if (s.website) return 'site';
  if (s.phone) return 'call';
  return null;
}

// Wholesale lines from "Name | retail | note" products.
function lineItems(products, share = WS.defaultWholesaleShare) {
  const k = Number(share) > 0 && Number(share) < 1 ? Number(share) : WS.defaultWholesaleShare;
  return products.map((p) => ({ name: p.name, note: p.note || '', retail: p.price, wholesale: p.price ? money.round(p.price * k, 2) : null }));
}

const TERM_WORDS = [
  [/wholesale price/i, /./],
  [/minimum first order/i, /minimum|min\.? order|opening order|first order/i],
  [/case pack/i, /case|pack of|packs? of|units? per|sold in (sets|packs)/i],
  [/reorder/i, /reorder|re-order/i],
  [/payment/i, /pay|net \d+|upfront|invoice|card/i],
  [/shipping/i, /ship(ping)? (is|paid|free|cost)|free shipping|pays? shipping|shipping (paid|included)|freight/i],
  [/lead time/i, /lead time|ships? (in|within)|days? to ship|business days/i],
  [/damaged/i, /damage|broken|breakage/i],
];

// Which of data/wholesale.json termsToSet the member's terms already cover.
function missingTerms(terms) {
  const s = String(terms || '');
  return WS.termsToSet.filter((t) => {
    const pair = TERM_WORDS.find(([label]) => label.test(t));
    if (!pair) return true;
    if (/wholesale price/i.test(t)) return false; // the line sheet prints it
    return !pair[1].test(s);
  });
}

// The member's offer in one line: "12 products, $9 to $34 wholesale (retail $18 to $68)".
function rangeLine(items) {
  const w = items.map((i) => i.wholesale).filter((v) => v != null);
  const r = items.map((i) => i.retail).filter((v) => v != null);
  if (!w.length) return '';
  const span = (a) => (Math.min(...a) === Math.max(...a) ? money.usd(Math.min(...a)) : `${money.usd(Math.min(...a))} to ${money.usd(Math.max(...a))}`);
  return `${text.plural(items.length, 'product')}, ${span(w)} wholesale, with a suggested retail of ${span(r)}`;
}

// The no-thanks line for a maker's product pitch: the kit's line (D28), about stocking products.
const OPT_OUT = outreach.optOut('stocking my products');

// "Hi Wren House team" for "The Wren House".
const teamOf = (name) => `${String(name || '').replace(/^the\s+/i, '')} team`;

// Messages for one shop. me: { first, business, what, city, address, minimum }.
function messagesFor(s, cat, me, items) {
  const seed = `${s.key || s.name}`;
  const what = lowerFirst(text.oneLine(me.what || cat.many)).replace(/\.$/, '');
  const here = me.city ? ` here in ${me.city}` : '';
  const local = s.local && s.local.length;
  const sells = s.sells;
  let reason;
  if (local && sells) reason = `I saw that you carry local makers and already stock ${cat.many}, so I thought my line might fit your shelves.`;
  else if (local) reason = `I saw that ${s.name} features ${s.local[0]} goods, so I thought my ${cat.many} might fit.`;
  else if (sells) reason = `I saw that you already carry ${cat.many}, and I make mine${here || ' locally'}.`;
  else if (s.miles != null && s.miles <= 5) reason = `You're ${s.miles} ${s.miles === 1 ? 'mile' : 'miles'} from me, and I'm looking for a few nearby shops to carry my ${cat.many}.`;
  else reason = `I'm looking for a few local shops to carry my ${cat.many}.`;
  const offer = rangeLine(items);
  const subject = text.pickBy(`${seed}:s`, [`${text.sentenceCase(cat.many)}${me.city ? ` from ${me.city}` : ''} for ${s.name}`, `Wholesale ${cat.many} for ${s.name}`, `Local ${cat.many} for ${s.name}?`]);
  const sign = [me.first || '[your name]', me.business].filter(Boolean).join('\n');
  const footer = `${sign}\n${me.address || outreach.ADDRESS_HOLD}\n\n${OPT_OUT}`;
  const email = [
    `Hi ${teamOf(s.name)},`,
    '',
    `I'm ${me.first || '[your name]'}, and I make ${what}${here}${me.business ? ` (${me.business})` : ''}. ${reason}`,
    '',
    `My line sheet is attached${offer ? `: ${offer}` : ''}.${me.minimum ? ` ${sentence(me.minimum)}` : ''}`,
    '',
    'Could I drop off a sample one weekday? It takes five minutes.',
    '',
    footer,
  ].join('\n');
  const dm = `Hi! I'm ${me.first || '[your name]'}, I make ${what}${here}. ${reason} Would you be open to seeing my wholesale line sheet? Happy to drop off a sample too.`;
  const walkin = `Hi, I'm ${me.first || '[your name]'}. I make ${what}${here}. Is the owner or the buyer in today? I'd love to leave a sample and my line sheet.`;
  const f1 = `Hi ${teamOf(s.name)}, a quick follow-up on my note about my ${cat.many}. I'm happy to drop off a sample whenever suits you, or send more photos.`;
  const f2 = `Hi ${teamOf(s.name)}, one last note from me. If now isn't the right time for ${s.name} to add ${cat.many}, no problem at all. If that changes, just reply and I'll bring a sample by.`;
  return { subject, email, dm, walkin, follow1Email: `${f1}\n\n${footer}`, follow2Email: `${f2}\n\n${footer}`, follow1: f1, follow2: f2 };
}

module.exports = { categoryOf, fitRx, scoreShop, channelOf, lineItems, missingTerms, rangeLine, messagesFor, OPT_OUT, CATS, ST, WS };
