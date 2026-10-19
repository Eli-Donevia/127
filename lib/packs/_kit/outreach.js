// First messages to a business, built from facts read off its own website (kit leads/scan):
// an Instagram DM, an email, a call opener, a voicemail, a walk-in line, two follow-ups and answers
// to the 7 usual replies. Drafts only: the member reads, edits and sends them from their own accounts.
//
//   const m = draft({ lead, service, sender })      templates, no AI, always works
//   const better = await aiOpeners(ctx, [{ lead, draft: m }], { service, sender })   AI first lines (top 5 only)
//
// Rules baked in (sources in the leads pack's data/rules.json):
// - Every draft opens on a fact we read on their site (or that they have no site). Never a rating,
//   review count, phone or name from a Google listing (Places terms), never an invented fact.
// - One specific free thing (the service's `offer` line), no prices, results or claims in a first message.
// - Email carries the sender's mailing address and an opt-out line, and says it's about the sender's
//   services (US CAN-SPAM, no exception for business-to-business email). Each follow-up email is its
//   own message under the law, so it ends the same way (followUp1Email, followUp2Email). Stop at "no".
// - Calls and walk-ins, no cold texts to cell numbers (FCC: autodialed texts need consent).
// - The member is the sender. Nothing here claims past clients or results.
// Message wording adapted from the Funnels First 25 engine (v2/funnels/code/public/funnels/first25-data.js).

const { plain, clip, fill, pickBy, copyProblems } = require('./text');
const { aiJson, cleanCopy } = require('./ai');
const { shareableGaps, ownerOf, GAPS } = require('./leads');

// The two lines every marketing email needs (US CAN-SPAM). The bracketed address keeps HQ's Copy
// button off until the member fills it in (same words as the gym pack, G50).
const ADDRESS_HOLD = '[Your business address, required in marketing email]';
// `about` says what the note is about: "my services", "a paid video", "sponsoring my channel".
const optOut = (about = 'my services') => `P.S. This is a note about ${about}. Not interested? Reply "no thanks" and I won't email again.`;
const OPT_OUT = optOut();

// Words that show a sentence is about a given gap (used to check AI openers stay on the facts).
const ANCHORS = {
  site_down: ['load', 'down', 'error'], broken_link: ['link', 'page'], no_site: ['website', 'site'], parked: ['placeholder', 'coming soon', 'construction'],
  no_video: ['video'], no_tiktok: ['tiktok'], no_youtube: ['youtube'], no_instagram: ['instagram'], no_facebook: ['facebook'], no_pixel: ['pixel', 'ads', 'visited'],
  no_booking: ['book'], no_chat: ['chat', 'question', 'after hours'], no_form: ['form'], no_signup: ['email list', 'newsletter', 'sign up', 'signup', 'join'],
  stale_footer: ['footer', '©', 'copyright'], no_https: ['secure', 'https'], no_mobile: ['phone', 'mobile'], no_description: ['description', 'google'], few_images: ['photo', 'picture'],
  no_reviews_shown: ['review', 'testimonial'], no_tap_to_call: ['tap', 'call'], no_prices: ['price'], no_offer: ['offer', 'first-time', 'first time', 'first visit'],
  no_hours: ['hours'], no_map: ['map'], no_schema: ['schema', 'google'], missing_alt: ['alt'], no_h1: ['headline', 'h1'], thin_site: ['words'], no_email: ['email', 'form'],
  no_analytics: ['analytics'], no_social: ['social'],
};

// Positive facts, for a business whose site has no gap this service fixes. service.positives can
// put the ones that matter to it first (cleaning: their hours, so you can offer after-hours work).
function positives(lead, service) {
  const s = lead.site;
  if (!s) return [];
  const out = [];
  if (s.hours) out.push({ id: 'has_hours', say: `I saw on your website that you're open ${clip(s.hours.replace(/^(our )?hours:?\s*/i, ''), 60).replace(/\.$/, '')}.` });
  if (s.booking && s.booking.length) out.push({ id: 'has_booking', say: `I saw you take bookings through ${s.booking[0]}.` });
  if (s.offer && s.offer.text) out.push({ id: 'has_offer', say: `I saw the "${clip(s.offer.text, 50)}" on your website.` });
  if (s.socials && s.socials.instagram) out.push({ id: 'has_instagram', say: `I found your Instagram, @${s.socials.instagram}, through your website.` });
  if (s.video && s.video.onSite) out.push({ id: 'has_video', say: 'I saw the video on your homepage.' });
  if (s.platform) out.push({ id: 'has_platform', say: `I noticed your website runs on ${s.platform}.` });
  const pref = (service && service.positives) || [];
  return out.sort((a, b) => (pref.includes(b.id) ? 1 : 0) - (pref.includes(a.id) ? 1 : 0));
}

// The gaps a message may cite for this service, best first: [{ id, say, why }]. Only gaps the
// service fixes (a bookkeeper never opens on a missing TikTok).
function citable(lead, service) {
  const weights = (service && service.gaps) || {};
  return shareableGaps(lead)
    .filter((g) => g.say && (weights[g.id] || 0) > 0)
    .sort((a, b) => (weights[b.id] || 0) - (weights[a.id] || 0))
    .map((g) => ({ id: g.id, say: g.say, why: g.why }));
}

function lowerFirst(s) {
  const t = String(s || '');
  return /^I\b|^I'/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

function bizOf(lead) {
  return lead.siteName || (lead.source === 'google' ? '' : lead.name) || '';
}

// " for restaurants" after the service ("I build websites for restaurants in Des Moines"), or nothing
// when the service already says who ("work with local businesses"). local: "for local restaurants".
function forMany(v, local = false) {
  if (/\bbusiness(es)?\b/i.test(v.verb)) return '';
  return ` for ${local && !/^local\b/i.test(v.many) ? `local ${v.many}` : v.many}`;
}

// sender: { first, business, city, address, phone }. service: from the leads pack's data/services.json.
function draft({ lead, service, sender = {}, cityName } = {}) {
  const svc = service || {};
  const biz = bizOf(lead);
  const owner = ownerOf(lead.site);
  const cat = lead.category || {};
  const v = {
    biz: biz || 'your business',
    city: cityName || lead.city || sender.city || 'town',
    what: cat.what || 'work',
    film: cat.film || 'a day at work',
    thing: cat.thing || 'visit',
    one: cat.one || 'business',
    many: cat.many || 'local businesses',
    me: sender.first || '[your name]',
    sell: svc.sell || 'my service',
    verb: svc.verb || 'help local businesses',
  };
  v.forMany = forMany(v);
  const facts = citable(lead, svc);
  const used = facts.length ? facts.slice(0, 2) : positives(lead, svc).slice(0, 1);
  const say1 = used[0] ? fill(used[0].say, v) : fill('I came across {biz} while looking at {many} in {city}.', v);
  const say2 = facts[1] ? `Also, ${lowerFirst(fill(facts[1].say, v))}` : '';
  const hi = owner ? owner.first : biz ? `${biz} team` : 'there';
  const offer = fill(svc.offer || "I'd like to show you what I do with one free sample, made for you.", v);
  const intro = fill("I'm {me}, and I {verb}{forMany} in {city}.", v);
  const sign = [sender.first || '[your name]', sender.business || '', sender.address || ADDRESS_HOLD].filter(Boolean).join('\n');
  const optOut = OPT_OUT;

  const ask = svc.ask || 'Want me to send it over?';
  const dm = plain(`Hi ${hi}! ${intro} ${say1} ${offer} No cost, no catch. ${ask}`);
  const subject = clip(fill(svc.subject || 'An idea for {biz}', v), 70);
  const body = [`Hi ${hi},`, '', [say1, say2].filter(Boolean).join(' '), '', `${intro} ${offer}`, '', "If you like it, we can talk. If not, it's yours to keep.", '', svc.ask ? svc.ask : 'Want me to send it?', '', sign, '', optOut].join('\n');
  const call = plain(`Hi, this is ${v.me}. Is this the owner or the manager? ... Thanks, I'll be quick. I ${v.verb} for ${v.many} here in ${v.city}. ${say1} ${offer} Who's the best person to send it to?`);
  const voicemail = plain(`Hi, this is ${v.me}. I ${v.verb} for ${v.many} in ${v.city}. ${say1} ${offer} I'll send it by email so you can look when you have a minute. My number is [your number]. Thanks!`);
  const walkIn = plain(`Hi, I'm ${v.me}. I ${v.verb}${forMany(v, true)}. ${fill(svc.walkin || 'Could I show you one free sample of my work, made for {biz}?', v)}`);
  const nudge1 = fill(svc.follow1 || 'Just floating this back up. The free sample is still yours if you want it.', v);
  const nudge2 = fill("Last note from me. If {sell} isn't a priority right now, no problem at all. If it is, the first one is still free.", v);
  const followUp1 = plain(`Hi ${hi}, it's ${v.me} again. ${nudge1}`);
  const followUp2 = plain(nudge2);
  // Email follow-ups end like the first email: name, business, mailing address and the opt-out.
  const asEmail = (line) => [`Hi ${hi},`, '', plain(line), '', sign, '', optOut].join('\n');
  return {
    key: lead.key,
    name: biz || lead.name || 'This business',
    hi,
    opener: [say1, say2].filter(Boolean).join(' '),
    cites: used.map((f) => fill(f.say, v)),
    citeIds: used.map((f) => f.id),
    facts: facts.slice(0, 6).map((f) => fill(f.why, v)),
    freeThing: offer,
    dm,
    email: { to: (lead.site && lead.site.contacts.emails[0]) || '', subject, body },
    call,
    voicemail,
    walkIn,
    followUp1,
    followUp2,
    followUp1Email: asEmail(`It's ${v.me} again. ${nudge1}`),
    followUp2Email: asEmail(nudge2),
    ai: false,
  };
}

// Rebuild the drafts around a new opener (from AI), keeping every compliance line.
function withOpener(d, opener) {
  if (!opener) return d;
  const swap = (t) => String(t || '').split(d.opener).join(opener);
  return { ...d, opener, dm: swap(d.dm), email: { ...d.email, body: swap(d.email.body) }, call: swap(d.call), voicemail: swap(d.voicemail), ai: true };
}

// The 7 replies (Funnels First 25), for one business. [brackets] are for the sender to fill in.
function replies({ lead, service, sender = {} } = {}) {
  const svc = service || {};
  const cat = (lead && lead.category) || {};
  const v = { biz: (lead && bizOf(lead)) || 'your business', me: sender.first || '[your name]', verb: svc.verb || 'help local businesses', many: cat.many || 'local businesses', city: (lead && lead.city) || sender.city || 'town' };
  v.forMany = forMany(v);
  return [
    { id: 'yes', label: '"Sure, send it"', text: "Great, I'll have it to you by [day]. Is there anything you'd love me to show, or anything to avoid?" },
    { id: 'sent', label: 'Sending the sample', text: fill("Here it is: [paste your link]. If you like it, I can do this for {biz} going forward. It's easier to show you than type it out. Do you have 10 minutes this week?", v) },
    { id: 'price', label: '"How much?"', text: fill("For {biz} I'd start simple: [what you'll do] for [your price]. No contract. If you'd like to see it first, the first one is free.", v) },
    { id: 'who', label: '"Who are you?"', text: fill("I'm {me}. I {verb}{forMany} in {city}. I'm starting with a few local businesses, so the first one is free. No catch.", v) },
    { id: 'covered', label: '"We already have someone"', text: "Good to hear you're covered. If you ever want a second set of hands or a fresh idea, I'm around. Mind if I check back in a couple of months?" },
    { id: 'later', label: '"Not right now"', text: 'No problem at all. Can I check back in a couple of months? The free one is still yours whenever you want it.' },
    { id: 'quiet', label: 'Quiet after the sample', text: fill("Hi {biz} team, did the sample come through okay? Happy to change anything. If now's not the time, no worries at all.", v) },
  ].map((r) => ({ ...r, text: plain(r.text) }));
}

// What a reply means, by its words (no AI): one of the replies() ids, or 'stop' (they asked you to
// stop: no answer, never contact them again), 'question' or 'other'. Order matters: a stop wins.
// A decline counts as a stop (no answer, marked lost): the first email promised "no thanks" ends it.
const INTENTS = [
  ['stop', /\b(stop|unsubscribe|remove me|take me off|do not (contact|email|message|text|call)|don['’]?t (contact|email|message|text|call)|leave (us|me) alone|not interested|no,? thanks?\b|no,? thank you|thanks,? but no|(i|we)(['’]?ll| will) pass(?=\s*([.,!;:)]|$|for now\b|this time\b|on (it|this|that|this one)\b(?!\s+to\b)))|not for (us|me)|no more (emails|messages|texts))/i],
  ['price', /\b(how much|price|pricing|cost|rates?|charge|quote|budget|fee|\$\d)/i],
  ['covered', /\b(already (have|use|got|work with)|we have (someone|a guy|a person|an agency|a team)|in[- ]house|handled|covered|all set|we['’]?re (good|set)|we are (good|set))\b/i],
  ['later', /\b(not (right )?now|not at (the|this) (moment|time)|not this (week|month|year|season)|later|next (week|month|year|quarter|season|spring|summer|fall|winter)|in the (spring|summer|fall|winter)|busy|after the holidays|maybe in|circle back|check back|reach out (again )?in)\b/i],
  ['who', /\b(who (is|are) (this|you)|how did you (find|get)|what company|is this (a )?(scam|spam)|never heard)\b/i],
  ['yes', /\b(yes|yeah|yep|sure|sounds good|send it|go ahead|interested|let'?s (do|talk|chat)|i'?d love|please do|tell me more)\b/i],
];
function intentOf(reply) {
  const t = String(reply || '').trim();
  if (!t) return 'other';
  for (const [id, re] of INTENTS) if (re.test(t)) return id;
  return /\?\s*$/.test(t) ? 'question' : 'other';
}

// The answer to one reply: { intent, meaning, answer, next, stop }. Built on replies(), so every answer
// keeps one next step and no claims. 'question' and 'other' get a short holding answer the member
// finishes (AI tools may rewrite it with the facts they have).
function answer({ lead, service, sender = {}, reply } = {}) {
  const intent = intentOf(reply);
  const r = Object.fromEntries(replies({ lead, service, sender }).map((x) => [x.id, x.text]));
  const MEANS = {
    stop: ['They asked you to stop.', '', "Don't send anything else. Mark them lost so they stay off your lists."],
    price: ['They want a price before anything else.', r.price, 'Say the price once, then offer the free sample again.'],
    covered: ['They have someone already.', r.covered, 'Check back in a couple of months, then let it go.'],
    later: ['Not now, maybe later.', r.later, 'Set a reminder for 2 months out.'],
    who: ['They want to know who you are first.', r.who, 'Answer plainly and offer the free sample.'],
    yes: ['They want the sample.', r.yes, 'Make it and send it within 2 days.'],
    question: ['They asked a question.', plain(`Good question. [Answer it in one or two lines.] ${r.yes ? 'Happy to show you with one free sample, made for you.' : ''}`), 'Answer it, then make one clear offer.'],
    other: ['Not sure what they meant.', 'Thanks for getting back to me! [Answer what they said in one line.] Would a free sample help you decide?', 'Keep it short and end with one question.'],
  };
  const [meaning, text, next] = MEANS[intent];
  return { intent, meaning, answer: plain(text || ''), next, stop: intent === 'stop' };
}

// Where to send it, best first: visual services lead with Instagram, the rest with email.
function channels(lead, service) {
  const s = lead.site || null;
  const visual = ['video', 'social', 'photo', 'brand'].includes(service && service.id);
  const out = [];
  const ig = (s && s.socials.instagram) || (lead.source !== 'google' && lead.instagram) || null;
  const email = s && s.contacts.emails[0];
  const fb = s && s.socials.facebook;
  const phone = (s && s.contacts.phones[0]) || (lead.source !== 'google' && lead.phone) || null;
  if (ig) out.push({ id: 'ig', label: 'Instagram DM', to: `@${ig}`, href: `https://ig.me/m/${encodeURIComponent(ig)}`, use: 'dm', rank: visual ? 0 : 2 });
  if (email) out.push({ id: 'email', label: 'Email', to: email, href: `mailto:${email}`, use: 'email', rank: visual ? 1 : 0 });
  if (fb) out.push({ id: 'fb', label: 'Facebook message', to: fb.replace(/^https:\/\/www\./, ''), href: fb, use: 'dm', rank: visual ? 2 : 3 });
  if (s && s.links.contact && !email) out.push({ id: 'form', label: 'The form on their website', to: s.links.contact.replace(/^https?:\/\/(www\.)?/, ''), href: s.links.contact, use: 'email', rank: visual ? 3 : 1 });
  if (phone) out.push({ id: 'call', label: 'Call', to: phone, href: `tel:${String(phone).replace(/[^\d+]/g, '')}`, use: 'call', rank: 4 });
  out.push({ id: 'walk', label: 'Walk in', to: lead.source === 'google' ? 'Use the map link' : lead.address || 'Their front desk', href: lead.mapsUrl || null, use: 'walkIn', rank: 5 });
  return out.sort((a, b) => a.rank - b.rank);
}

// Send checklist shown with every set of drafts.
const RULES = [
  'Before you send, open their website and check every line is still true.',
  'Send each one yourself, one at a time. No bulk DMs or auto-senders: Instagram bans automated access.',
  'Email: keep your mailing address and the opt-out line (US CAN-SPAM). If they say no, stop. The law gives you 10 business days at most.',
  "Don't cold-text a cell number (FCC rules on texts without consent). Call, email, DM or walk in.",
  'Follow up on day 3 and day 7, then stop. Mark replies in your Pipeline.',
];

// ---------- AI first lines (top 5 only; templates for the rest) ----------

const OPENERS_SCHEMA = {
  type: 'object',
  properties: {
    openers: {
      type: 'array',
      items: { type: 'object', properties: { i: { type: 'integer' }, opener: { type: 'string', maxLength: 320 }, subject: { type: 'string', maxLength: 70 } }, required: ['i', 'opener'] },
    },
  },
  required: ['openers'],
};

function anchorsOk(text, citeIds, year) {
  const t = String(text || '').toLowerCase();
  return citeIds.some((id) => (ANCHORS[id] || []).concat(id === 'stale_footer' && year ? [String(year)] : []).some((a) => t.includes(String(a).toLowerCase())));
}

// items: [{ lead, draft }] (max 5 are sent to AI). Returns drafts with better openers where AI answered
// cleanly and stayed on the facts; the rest keep their template openers.
async function aiOpeners(ctx, items, { service, sender = {} } = {}) {
  const top = (items || []).slice(0, 5).filter((x) => x && x.draft && x.draft.citeIds && x.draft.citeIds.length);
  if (!top.length || !ctx || typeof ctx.ai !== 'function') return { drafts: (items || []).map((x) => x.draft), ai: false };
  const lines = top.map((x, i) => {
    const l = x.lead;
    const facts = x.draft.cites.map((c) => `- ${c}`).join('\n');
    return `Business ${i}: ${bizOf(l) || 'name unknown, write "your business"'}${l.category ? ` (${l.category.one})` : ''}\nFacts from their website:\n${facts}\nCurrent opener: ${x.draft.opener}`;
  });
  const prompt = [
    `The sender is ${sender.first || 'the member'}, who ${service && service.verb ? service.verb : 'helps local businesses'} for local businesses${sender.city ? ` in ${sender.city}` : ''}.`,
    'For each business, write the opening one or two sentences of a cold message: friendly, specific, under 300 characters, and based only on the facts listed for that business.',
    'Name what you noticed on their website. Do not add facts, numbers, praise of things not listed, results, prices or promises. No greeting (it is added later). Optionally a short email subject line under 60 characters.',
    '',
    lines.join('\n\n'),
  ].join('\n');
  const year = (it) => (it.lead.site && it.lead.site.copyrightYear) || null;
  const accept = (data) => cleanCopy(data) && Array.isArray(data.openers) && data.openers.some((o) => o && top[o.i] && anchorsOk(o.opener, top[o.i].draft.citeIds, year(top[o.i])));
  const { data, ai } = await aiJson(ctx, {
    task: 'write',
    system: 'You write short, honest first lines for cold outreach from a new local service business. Plain text.',
    prompt,
    schema: OPENERS_SCHEMA,
    maxTokens: 900,
    accept,
    fallback: () => ({ openers: [] }),
  });
  const better = new Map();
  if (ai && data && Array.isArray(data.openers)) {
    for (const o of data.openers) {
      const it = o && top[o.i];
      if (!it || better.has(o.i)) continue;
      const op = plain(o.opener || '');
      if (op.length < 20 || op.length > 320 || copyProblems(op).length || !anchorsOk(op, it.draft.citeIds, year(it))) continue;
      const subject = o.subject && !copyProblems(o.subject).length ? clip(plain(o.subject), 70) : null;
      better.set(o.i, { opener: op, subject });
    }
  }
  const drafts = (items || []).map((x) => {
    const idx = top.indexOf(x);
    const b = idx >= 0 ? better.get(idx) : null;
    if (!b) return x.draft;
    const d = withOpener(x.draft, b.opener);
    return b.subject ? { ...d, email: { ...d.email, subject: b.subject } } : d;
  });
  return { drafts, ai: better.size > 0 };
}

// Variety for template lines, stable per business.
function pick(seed, options) {
  return pickBy(seed, options);
}

module.exports = { draft, withOpener, replies, intentOf, answer, channels, citable, positives, aiOpeners, RULES, ANCHORS, GAPS, pick, bizOf, ADDRESS_HOLD, OPT_OUT, optOut };
