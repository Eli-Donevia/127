// The member's facts in the shapes the DM copy needs: "your party board planner", "the planner",
// "people hosting at home". Built from the tool input first, then the business brain. Pure code.

const { brain, text, money } = require('../../_kit');

const LEAD = /^(a|an|the|my|our|your|free|a free|my free)\s+/i;
const KIND_WORDS = /\b(pdf|printable|download|downloadable|digital|template|templates|e-?book|guide|checklist|planner|worksheet|workbook|cheat ?sheet|list|kit|toolkit|tracker|calendar|swipe file|mini course|course|class|video|masterclass|webinar|call|consult|consultation|session|chat|audit|quote|estimate)\b/gi;

// "Free Party Board Planner (PDF)" -> "Party Board Planner"; "my free 15 minute call" -> "15 minute call"
function thingName(s) {
  let t = text.oneLine(s).replace(/\([^)]*\)/g, ' ').replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(LEAD, '');
  if (!t) return '';
  const words = t.split(' ');
  const titled = words.filter((w) => /^[A-Z0-9]/.test(w)).length >= Math.ceil(words.length * 0.75);
  // Keep Title Case names as the member wrote them; otherwise lowercase the first letter so it reads
  // inside a sentence ("your party board planner").
  if (titled && words.length > 1) return t;
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// The kind of thing, for short labels: "planner", "guide", "call". Falls back to the last word.
function kindOf(thing) {
  const m = String(thing || '').toLowerCase().match(KIND_WORDS);
  if (m && m.length) return m[m.length - 1].replace(/\s+/g, ' ');
  const w = String(thing || '').toLowerCase().split(/\s+/).filter(Boolean);
  return w[w.length - 1] || 'link';
}

// What the thing is about: "party board planner" -> "party boards". Calls, audits and quotes are
// about the business itself, so they fall back to what the member does.
const TALK_KINDS = /^(call|consult|consultation|session|chat|audit|quote|estimate|webinar|masterclass|class)$/;
function topicOf(thing, fallback = '') {
  const kind = kindOf(thing);
  const t = String(thing || '').replace(KIND_WORDS, ' ').replace(/\b(free|my|your|the|a|an|for|to|of|and|\d+[- ]?(minute|min|day|step|week)s?)\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t || TALK_KINDS.test(kind) || t.length < 4) return String(fallback || '').toLowerCase();
  const words = t.split(' ');
  const last = words[words.length - 1];
  if (!/s$/.test(last) && /^[a-z]+$/.test(last) && last.length > 2 && !/(ing|ion|ness|ice|ment|age|ware|wear)$/.test(last)) words[words.length - 1] = /(ch|sh|x)$/.test(last) ? `${last}es` : /[^aeiou]y$/.test(last) ? `${last.slice(0, -1)}ies` : `${last}s`;
  return words.join(' ');
}

// "Busy parents in Columbus who host at home" -> "busy parents" (for short lines on frames).
function audienceShort(audience) {
  const a = text.oneLine(audience).toLowerCase();
  if (!a) return '';
  const cut = a.split(/\b(who|that|which|in|near|around|looking|wanting|with)\b|[,.;:]/)[0].trim();
  return cut.split(' ').length <= 5 ? cut : cut.split(' ').slice(0, 4).join(' ');
}

function priceText(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return money.usd(v);
  const s = String(v).trim();
  const n = money.num(s, null);
  if (/^\$?\d[\d,]*(\.\d+)?$/.test(s) && n != null) return money.usd(n);
  return text.oneLine(s);
}

// All facts the templates use. `input` is the tool input; product is from dm.read_product.
// A product description cut to one clean sentence: the first sentence if it fits, else up to a
// natural break (a comma, "that", "with"), never mid-word with dots.
function shortDetail(desc, max = 140) {
  const t = text.oneLine(desc || '');
  if (!t) return '';
  const first = (t.match(/^.+?[.!?](?=\s|$)/) || [t])[0].replace(/[.!?]+$/, '');
  if (first.length <= max) return `${first}.`;
  const cut = first.slice(0, max);
  const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' that '), cut.lastIndexOf(' which '), cut.lastIndexOf(' with '), cut.lastIndexOf(' made '));
  return at > max * 0.4 ? `${cut.slice(0, at).trim()}.` : text.clip(first, max);
}

function factsFor(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const product = input.product && typeof input.product === 'object' ? input.product : null;
  const offerRaw = input.offer || (product && product.name) || b.offer || '';
  const thing = thingName(offerRaw) || (input.goal === 'booking' ? 'call' : 'freebie');
  const kind = kindOf(thing);
  const inside = String(input.inside || '')
    .split(/\n|;|,(?![^(]*\))/)
    .map((s) => text.oneLine(s).replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .slice(0, 4);
  return {
    business: b.name || 'your business',
    hasName: !!b.name,
    first: b.firstName,
    what: b.what,
    niche: b.niche,
    city: b.city,
    place: b.place,
    audience: b.audience,
    audienceShort: audienceShort(b.audience),
    instagram: b.instagram,
    website: b.website,
    thing,
    kind,
    topic: topicOf(thing, b.what || b.niche),
    inside,
    price: priceText(input.price != null && input.price !== '' ? input.price : product && product.price != null ? product.price : ''),
    productName: product ? text.oneLine(product.name) : '',
    productDetail: product ? shortDetail(product.description, 140) : '',
    launch: text.oneLine(input.launch || ''),
    date: input.date || '',
    seed: `${b.name}|${thing}|${input.keyword || ''}`,
  };
}

module.exports = { shortDetail, factsFor, thingName, kindOf, topicOf, audienceShort, priceText };
