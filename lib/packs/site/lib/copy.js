// The words on the site. Without AI (or when AI says something we can't back up) these templates
// write every line from the member's own facts, varied per business with text.pickBy so two
// detailers in one city don't get the same page. Nothing here claims a fact the member didn't give:
// no reviews, ratings, years in business, guarantees or results.

const { text } = require('../../_kit');
const seo = require('./seo');

const cap = (s) => text.sentenceCase(String(s || '').trim());
const lower = (s) => {
  const t = String(s || '').trim();
  // Keep acronyms and names: only lowercase the first letter when the second is lowercase.
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};
const article = text.aOrAn;
const pick = (seed, key, list) => text.pickBy(`${seed}:${key}`, list.filter(Boolean));
const stripDot = (s) => String(s || '').trim().replace(/[.!]+$/, '');

function minPrice(services) {
  const priced = (services || []).filter((s) => typeof s.price === 'number' && s.price > 0);
  if (!priced.length) return null;
  return priced.reduce((a, b) => (b.price < a.price ? b : a));
}

// The member's "what" as a short phrase for headings: "Mobile car detailing".
function whatOf(f) {
  const w = stripDot(f.what || f.offer || f.niche || '');
  return text.clip(w, 60);
}

function areaLine(f) {
  if (!f.area) return '';
  return f.area;
}

function heroTitle(f, tpl, seed) {
  const what = cap(whatOf(f));
  const city = f.city;
  const res = cap(f.profile.result);
  const aud = f.audience ? lower(f.audience) : '';
  if (tpl === 'local-service') {
    if (!what) return f.name;
    if (city && !f.online) return pick(seed, 'h', [`${what} in ${city}`, f.mobile ? `${what} that comes to you in ${city}` : `${what} for ${f.profile.people} in ${city}`, `${what} in ${city}`]);
    return what;
  }
  if (tpl === 'studio') return res ? `${res}.` : `${what || f.name}.`;
  if (tpl === 'restaurant') return f.name;
  if (tpl === 'coach') {
    if (what && aud) return `${what} for ${aud}`;
    return res ? `${res}.` : what || f.name;
  }
  if (tpl === 'product') return cap(f.productName || f.offer || whatOf(f) || f.name);
  if (tpl === 'agency') {
    if (what && aud) return `${what} for ${aud}`;
    if (what) return pick(seed, 'h', [`${what}, without the runaround`, `${what} for ${f.profile.people}`, `${what} that fits your business`]);
    return f.name;
  }
  if (tpl === 'portfolio') return what || f.name;
  return f.name;
}

function actionSentence(f, tpl) {
  if (tpl === 'restaurant') {
    const parts = [];
    if (f.orderLinks && f.orderLinks.length) parts.push('order online');
    if (f.booking && f.booking.kind === 'reserve') parts.push('book a table');
    if (!parts.length && f.phone) parts.push(`call ${f.phone.display}`);
    return parts.length ? `${cap(parts.join(' or '))}.` : '';
  }
  if (f.booking) return `${f.booking.label} online.`;
  if (f.buy) return '';
  if (tpl === 'local-service' && f.phone) return `Call ${f.phone.display} or send a message for a quote.`;
  if (f.phone) return `Call ${f.phone.display} or send a message.`;
  return f.email ? `Write to ${f.email}.` : 'Send the form on this page.';
}

function heroSub(f, tpl, seed) {
  const what = whatOf(f);
  const mp = minPrice(f.services);
  const bits = [];
  if (tpl === 'local-service') {
    if (f.mobile && f.area) bits.push(`${f.name} comes to you in ${areaLine(f)}.`);
    else if (f.area && !f.online) bits.push(`${f.name} works with ${f.profile.people} in ${areaLine(f)}.`);
    else bits.push(`${f.name} offers ${lower(what) || 'local service'}.`);
    if (mp) bits.push(pick(seed, 'p', [`Prices start at ${mp.priceText.replace(/^From /, '')}.`, `Every price is on this page, from ${mp.priceText.replace(/^From /, '')}.`]));
    bits.push(actionSentence(f, tpl));
  } else if (tpl === 'studio') {
    bits.push(`${cap(what)}${f.city ? ` in ${f.area || f.city}` : ''}.`);
    if (f.services.length) bits.push(pick(seed, 'p', ['See the menu, pick a time and book.', 'Browse the menu and book a time that suits you.']));
    else bits.push(actionSentence(f, tpl));
  } else if (tpl === 'restaurant') {
    bits.push(f.tagline ? `${stripDot(f.tagline)}.` : `${cap(what)}${f.city ? ` in ${f.city}` : ''}.`);
    if (f.hoursLine) bits.push(`Open ${f.hoursLine.replace(/^Mon to Sun, /, 'every day, ')}.`);
    bits.push(actionSentence(f, tpl));
  } else if (tpl === 'coach') {
    if (f.owner) bits.push(`I'm ${f.owner}. I offer ${lower(f.offer || what)}${f.online ? ' online' : f.city ? ` in ${f.city}` : ''}.`);
    else bits.push(`${f.name} offers ${lower(f.offer || what)}${f.online ? ' online' : f.city ? ` in ${f.city}` : ''}.`);
    if (f.profile.result) bits.push(`${cap(f.profile.result)}.`);
    bits.push(actionSentence(f, tpl));
  } else if (tpl === 'product') {
    bits.push(f.tagline ? `${stripDot(f.tagline)}.` : `${cap(what)}${f.name && f.productName && f.productName !== f.name ? ` by ${f.name}` : ''}.`);
    if (f.shipping) bits.push(`${stripDot(f.shipping)}.`);
    if (!f.buy && f.deadline) bits.push(`Launching ${f.deadline}.`);
  } else if (tpl === 'agency') {
    // "Brand and website design agency" names the business, so it reads "X is a ..."; "Branding" is the work it does.
    const who = f.audience ? lower(f.audience) : f.profile.people;
    if (/\b(agency|studio|firm|consultancy|collective|shop|partners?)$/i.test(stripDot(what))) bits.push(`${f.name} is ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${lower(stripDot(what))}${f.city && !f.online ? ` in ${f.city}` : ''}, working with ${who}.`);
    else bits.push(`${f.name} helps ${who} with ${lower(what)}.`);
    if (mp) bits.push(`Projects start at ${mp.priceText.replace(/^From /, '')}.`);
    bits.push(f.booking ? 'Book a call and get a clear plan.' : 'Tell us about your project and get a clear plan.');
  } else if (tpl === 'portfolio') {
    // Without an audience, no "for clients" filler.
    const forWho = /\bfor\b/i.test(what) || !f.audience ? '' : ` for ${lower(f.audience)}`;
    if (f.owner && f.owner !== f.name) bits.push(`I'm ${f.owner}.`);
    bits.push(`${cap(what || f.name)}${forWho}${f.city && !f.online ? `, based in ${f.city}` : ''}.`);
    if (f.booking) bits.push('Book a call to talk about your project.');
  } else if (tpl === 'creator') {
    bits.push(f.tagline || `${cap(what)}.`);
  }
  return bits.filter(Boolean).join(' ');
}

function about(f, tpl, seed) {
  if (f.about) return f.about;
  const what = lower(whatOf(f));
  const run = f.owner && f.owner !== f.name ? `, run by ${f.owner}` : '';
  const where = f.city && !f.online ? ` in ${f.city}` : f.online ? ' that works online' : '';
  const noun = /\b(salon|studio|shop|truck|bakery|cafe|caf\u00e9|restaurant|company|agency|services?|bar|kitchen|gym|spa|business|practice|parlor|boutique|brand|store|barbershop|pub|brewery|tutoring|coaching|consulting)\s*$/i.test(what) ? '' : ' business';
  const first = `${f.name} is ${article(what || 'small')} ${what || 'small'}${noun}${where}${run}.`;
  const lines = [first];
  if (tpl === 'portfolio') {
    const role = { photo: 'photographer', video: 'editor', design: 'designer', ugc: 'creator' }[f.profile.id] || 'person';
    const forWho = /\bfor\b/i.test(what) ? '' : f.audience ? ` for ${lower(f.audience)}` : '';
    if (f.owner && f.owner !== f.name) {
      lines[0] = `I'm ${f.owner}, the ${role} behind ${f.name}.`;
      if (what) lines.push(`${cap(what)}${forWho}${where}.`);
    } else lines[0] = what ? `${cap(what)}${forWho}${where}, by ${f.name}.` : `${f.name}${where}.`;
    lines.push(pick(seed, 'a', ['Every project starts with a short conversation about what you need and where it will be used.', 'We start with a short call so I know what you need, where it will be used and when.']));
    if (f.email) lines.push(`You can reach me directly at ${f.email}.`);
    return lines.filter(Boolean).join(' ');
  }
  // A product or a creator isn't "a ... business that works online": say what it is, plainly.
  if (tpl === 'product' || tpl === 'creator') {
    lines[0] = tpl === 'creator'
      ? (what ? `${f.name} is ${article(what)} ${what}${f.online ? '' : where}.` : '')
      : (what ? (/ing$/i.test(what) ? `${f.name} does ${what}${f.online ? '' : where}.` : `${f.name} is ${article(what)} ${what}${f.online ? '' : where}.`) : '');
    if (f.shipping && tpl === 'product') lines.push(`${cap(stripDot(f.shipping))}.`);
    return lines.filter(Boolean).join(' ');
  }
  if (tpl === 'coach' && f.owner) {
    lines[0] = `I'm ${f.owner}, and ${f.name === f.owner ? 'I' : `${f.name}`} ${f.name === f.owner ? 'offer' : 'offers'} ${what}${f.online ? ' online' : f.city ? ` in ${f.city}` : ''}.`;
    if (f.audience) lines.push(`I work with ${lower(f.audience)}.`);
    lines.push(pick(seed, 'a', ['Every plan starts with a conversation about where you are now.', 'We start with a short call so I understand what you need.']));
  } else if (tpl === 'restaurant') {
    lines.push(f.hoursLine ? `We're open ${f.hoursLine}.` : '');
  } else {
    if (f.phone && f.owner) lines.push(`You can reach ${f.owner} directly at ${f.phone.display}.`);
    else if (f.email && f.owner) lines.push(`You can reach ${f.owner} directly at ${f.email}.`);
  }
  return lines.filter(Boolean).join(' ');
}

// Short one-line descriptions for services that don't have one, from the service name only.
function serviceBlurb(s) {
  return s.description || '';
}

function steps(f, tpl) {
  const book = f.booking;
  if (tpl === 'local-service') {
    return [
      { title: 'Pick a service', body: f.services.length ? 'Choose from the prices below. Not sure which one? Send a message.' : 'Tell us what you need in the form below.' },
      book ? { title: 'Book a time', body: 'Choose a day and time online that works for you.' } : { title: 'Get your quote', body: f.phone ? `Send the form or call ${f.phone.display} to set a time.` : 'Send the form and we will set a time together.' },
      f.mobile ? { title: 'We come to you', body: `We show up at your place${f.city ? ` in ${f.city}` : ''} at the time you picked.` } : { title: 'We get to work', body: 'We take care of the job at the time you picked.' },
    ];
  }
  if (tpl === 'coach') {
    return [
      { title: book ? 'Book a call' : 'Send a message', body: book ? 'Pick a time that suits you.' : 'Tell me a little about what you need.' },
      { title: 'Make a plan', body: 'We talk through where you are now and what you want help with.' },
      { title: 'Get started', body: `Start your ${f.profile.noun}s${f.online ? ' online' : f.city ? ` in ${f.city}` : ''}.` },
    ];
  }
  if (tpl === 'portfolio') {
    const noun = f.profile.noun || 'project';
    return [
      { title: book ? 'Book a call' : 'Send a few details', body: 'Tell me what you need, where you will use it and your date.' },
      { title: 'Get a plan and a price', body: `You see what the ${noun} includes and the price in writing before anything is booked.` },
      noun === 'shoot' ? { title: 'Shoot day', body: 'We plan the shots together first, then I guide you through every one on the day.' } : { title: 'I make it', body: 'You see a first version and tell me what to change before anything is final.' },
      { title: 'Your files', body: 'Edited files on the date we agree, with what you may use them for in writing.' },
    ];
  }
  if (tpl === 'agency') {
    return [
      { title: 'Tell us about it', body: book ? 'Book a call or send the form with what you need.' : 'Send the form with what you need and when.' },
      { title: 'Get a plan and a price', body: 'You see the scope, the price and the timeline before work starts.' },
      { title: 'We do the work', body: 'You get updates along the way and a say before anything goes live.' },
      { title: 'Launch', body: 'Everything is handed over to you, ready to use.' },
    ];
  }
  return [];
}

// The draft FAQ only asks what the rest of the page doesn't already answer (prices, booking, what's included and
// hours each have their own section), and only from facts. Fewer than two real questions: no FAQ at all, rather than
// filler. The words step (write-copy) or the member's own questions replace it.
function faq(f, tpl) {
  const out = [];
  if (f.mobile && f.area) out.push({ q: 'Do you come to me?', a: `Yes. We come to you in ${f.area}.` });
  if (f.shipping && tpl === 'product') out.push({ q: 'How does shipping work?', a: `${stripDot(f.shipping)}.` });
  if (f.returns && tpl === 'product') out.push({ q: 'Can I send it back?', a: `${stripDot(f.returns)}.` });
  if (f.capacity) out.push({ q: 'How many places are there?', a: `${stripDot(f.capacity)}.` });
  if (tpl === 'restaurant' && f.orderLinks.length) out.push({ q: 'Can I order online?', a: `Yes. Order through ${f.orderLinks.map((l) => l.label.replace(/^Order (on|online)\s*/i, '') || 'our online menu').join(' or ')}.`.replace('through .', 'online.') });
  if (tpl === 'restaurant' && f.booking && f.booking.kind === 'reserve') out.push({ q: 'Do you take reservations?', a: `Yes. Tap ${f.booking.label} to book.` });
  return out.length >= 2 ? out.slice(0, 6) : [];
}

// The closing band says the next step plainly, from the facts. No "Ready when you are?" or "Let's make something".
function cta(f, tpl, seed) {
  const call = f.phone ? `Call ${f.phone.display}, or send the form.` : '';
  if (tpl === 'restaurant') return { title: pick(seed, 'c', ['See you at the table.', 'Come hungry.', 'Tables are waiting.']), sub: f.orderLinks && f.orderLinks.length ? 'Order ahead online, or come by and say hello.' : 'Come by and say hello.' };
  if (tpl === 'product') return { title: f.buy ? `Order ${f.productName || f.name}.` : 'Hear first on launch day.', sub: f.buy ? (f.shipping ? `${cap(stripDot(f.shipping))}.` : '') : 'Join the list for one email on launch day.' };
  if (tpl === 'agency' || tpl === 'portfolio') return { title: 'Tell us about the project.'.replace('us', tpl === 'portfolio' && f.owner ? 'me' : 'us'), sub: f.booking ? 'Book a call, or send a few lines about it.' : f.email ? `Send a few lines about it, or write to ${f.email}.` : 'Send a few lines about it.' };
  if (tpl === 'coach') return { title: f.booking ? 'Start with one call.' : 'Start with one message.', sub: f.booking ? 'Book a call at a time that suits you.' : 'Send a message and I will get back to you.' };
  return { title: f.booking ? 'Pick a time that suits you.' : f.phone ? `Call ${f.phone.display}.` : 'Send a message.', sub: f.booking ? actionSentence(f, tpl) : call || actionSentence(f, tpl) };
}

// Everything a design needs, written from facts. seed varies the wording per business.
function draftCopy(f, tpl) {
  const seed = `${f.name}:${tpl}`;
  const c = cta(f, tpl, seed);
  const t = {
    template: tpl,
    heroTitle: heroTitle(f, tpl, seed),
    heroSub: heroSub(f, tpl, seed),
    about: about(f, tpl, seed),
    services: f.services.map((s) => ({ name: s.name, blurb: serviceBlurb(s) })),
    steps: steps(f, tpl),
    faq: faq(f, tpl),
    ctaTitle: c.title,
    ctaSub: c.sub,
  };
  const draft = { ...f, template: tpl, whatShort: whatOf(f), areaLine: areaLine(f), primary: f.booking || f.buy || null };
  t.seoTitle = seo.titleFor(draft);
  t.seoDescription = seo.descriptionFor(draft);
  return t;
}

// ---------- approval items ----------
// The member reads and edits these in the Inbox. Multi-part items use one line per entry.

function toItems(copy) {
  const items = [
    { key: 'heroTitle', label: 'Headline', text: copy.heroTitle },
    { key: 'heroSub', label: 'Under the headline', text: copy.heroSub },
    { key: 'about', label: 'About you (add a line on why you started)', text: copy.about },
  ];
  const blurbs = (copy.services || []).filter((s) => s.name);
  if (blurbs.length) items.push({ key: 'services', label: 'Service descriptions (Name: description, one per line)', text: blurbs.map((s) => `${s.name}: ${s.blurb || ''}`.trim()).join('\n') });
  if ((copy.steps || []).length) items.push({ key: 'steps', label: 'How it works (Title: what happens, one per line)', text: copy.steps.map((s) => `${s.title}: ${s.body}`).join('\n') });
  if ((copy.faq || []).length) items.push({ key: 'faq', label: 'Questions and answers (Q: and A: lines)', text: copy.faq.map((q) => `Q: ${q.q}\nA: ${q.a}`).join('\n') });
  items.push({ key: 'ctaTitle', label: 'Closing headline', text: copy.ctaTitle });
  items.push({ key: 'ctaSub', label: 'Closing line', text: copy.ctaSub });
  items.push({ key: 'seoTitle', label: 'Google title (60 characters or less)', text: copy.seoTitle });
  items.push({ key: 'seoDescription', label: 'Google description (155 characters or less)', text: copy.seoDescription });
  return items.map((i) => ({ ...i, text: String(i.text || '') }));
}

function pairs(textBlock) {
  return String(textBlock || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^:]{1,80}):\s*(.*)$/);
      return m ? { a: m[1].trim(), b: m[2].trim() } : { a: l, b: '' };
    });
}

function parseFaq(textBlock) {
  const out = [];
  let cur = null;
  for (const line of String(textBlock || '').split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const q = l.match(/^q[:.]\s*(.+)$/i);
    const a = l.match(/^a[:.]\s*(.+)$/i);
    if (q) {
      if (cur && cur.a) out.push(cur);
      cur = { q: q[1], a: '' };
    } else if (a && cur) cur.a = cur.a ? `${cur.a} ${a[1]}` : a[1];
    else if (cur) cur.a = cur.a ? `${cur.a} ${l}` : l;
  }
  if (cur && cur.a) out.push(cur);
  return out.slice(0, 10);
}

// Applies the member's edited items back onto the copy. Unknown keys are ignored; an emptied item
// removes that part (an empty FAQ means no FAQ section).
function fromItems(items, base) {
  const out = { ...base };
  for (const it of [].concat(items || [])) {
    if (!it || typeof it !== 'object' || !it.key) continue;
    const val = text.plain(it.text == null ? '' : String(it.text));
    if (it.key === 'services') {
      const map = new Map(pairs(val).map((p) => [p.a.toLowerCase(), p.b]));
      out.services = (base.services || []).map((s) => ({ ...s, blurb: map.has(s.name.toLowerCase()) ? map.get(s.name.toLowerCase()) : s.blurb }));
    } else if (it.key === 'steps') out.steps = pairs(val).map((p) => ({ title: p.a, body: p.b })).slice(0, 6);
    else if (it.key === 'faq') out.faq = parseFaq(val);
    else if (['heroTitle', 'heroSub', 'about', 'ctaTitle', 'ctaSub', 'seoTitle', 'seoDescription'].includes(it.key)) {
      out[it.key] = it.key === 'about' ? val : text.oneLine(val);
    }
  }
  if (out.seoTitle) out.seoTitle = text.clip(out.seoTitle, 60);
  if (out.seoDescription) out.seoDescription = text.clip(out.seoDescription, 160);
  return out;
}

// ---------- AI guard ----------
// AI copy is kept only when every number in it is one the member gave us (prices, hours, phone)
// and it makes no claim we can't back up: reviews, ratings, awards, years, guarantees, results.

const CLAIMS = /\b(reviews?|rated|ratings?|stars?|5-star|five.star|award|winning|#\s?1|number one|best in|top.rated|trusted by|years? of experience|since (19|20)\d\d|certified|licensed|insured|bonded|guarantee|money.back|satisfaction|hundreds of|thousands of|clients love|customers love|happy (clients|customers)|results|leads|sales|views|followers|grow your|double your|more customers)\b/i;

function numbersIn(s) {
  return (String(s || '').match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, '').replace(/,/g, ''));
}

function factNumbers(f) {
  const hay = JSON.stringify({ services: f.services, hours: f.hours && f.hours.text, phone: f.phone, capacity: f.capacity, deadline: f.deadline, included: f.included, shipping: f.shipping, area: f.area, address: f.address, price: f.priceText, offer: f.offer, what: f.what, name: f.name, about: f.about, tagline: f.tagline, year: f.year });
  return new Set(numbersIn(hay));
}

function factText(f) {
  return JSON.stringify([f.services, f.offer, f.what, f.about, f.tagline, f.included, f.promise, f.capacity, f.shipping]).toLowerCase();
}

function guardProblems(copy, f) {
  const known = factNumbers(f);
  const probs = [];
  const strings = [];
  const walk = (v) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(copy);
  for (const s of strings) {
    for (const n of numbersIn(s)) if (!known.has(n) && Number(n) > 10) probs.push(`number ${n} isn't one of the member's facts`);
    const m = s.match(CLAIMS);
    if (m && !factText(f).includes(m[0].toLowerCase())) probs.push(`claim "${m[0]}"`);
    for (const p of text.copyProblems(s)) probs.push(p);
  }
  return probs;
}

module.exports = { draftCopy, toItems, fromItems, parseFaq, pairs, guardProblems, whatOf, minPrice, CLAIMS };
