// What customers say: reviews the member pastes (their own or a competitor's) plus the testimonials a
// business shows on its own website, read for what people praise, complain about and ask for, by
// theme, in their own words, with what to do about each. Counts and quotes come from the text itself
// (code); AI only writes the summary and the moves from them, and its answer is dropped if it quotes
// words or numbers that aren't there. Saves a one-page report and a spreadsheet. Nothing goes in the
// Pipeline, reviewer names are never kept, and no review site is ever read (intel.read_testimonials).

const { views, ai, save, files, text, time } = require('../../_kit');
const { splitReviews, mine, THEME, GENERAL } = require('../lib/reviews');
const { page, bar, esc } = require('../lib/page');

// Your own reviews: the fix for each kind of complaint ([title, how]).
const FIX = {
  people: ['Make the welcome warmer', 'Greet every customer by name in the first minute and tell them what happens next. Pick one person to own this for a week.'],
  speed: ['Fix the wait', 'Give a time window you can keep, and text people the moment you run late. Write down how late you are every day for a week.'],
  price: ['Explain your prices', 'Show starting prices on your site and say what each one includes, so nobody is surprised at the end.'],
  quality: ['Check the work before they see it', 'Write a 5-point finish checklist and run it on every job before you call it done.'],
  clean: ['Clean before every opening', 'Add a 10-minute walk-through before the first customer: floors, restroom and the things people touch.'],
  talk: ['Answer faster', 'Reply to every call and message the same day. Set a voicemail and an auto-reply that say when you will get back.'],
  booking: ['Make booking easy', 'One booking link everywhere, a text to confirm, and a short waitlist for last-minute openings.'],
  place: ['Help people find you', 'Put parking and entrance directions in your confirmation text and on your Google profile.'],
  hours: ['Look at your hours', 'Try one evening or one weekend slot for a month and see who books it.'],
  skill: ['Explain as you go', 'Tell people what you are doing and why, in plain words, and what to do at home after.'],
  feel: ['Fix the feel of the place', 'Walk in the way a customer does: noise, music, smell, seating. Change the one thing that bothers you most.'],
  choice: ['Add the choice people want', 'Add the option people ask for most as a trial for one month.'],
  trust: ['Say the price before you start', 'Give the price before any work, in writing, and never add anything without asking first.'],
  kids: ['Make families welcome', 'Say plainly what you do for kids and parents, and fix the one thing families mention.'],
  pets: ['Take extra care with pets', 'Say how you handle pets, and fix the one thing pet owners mention.'],
  crowd: ['Cap the crowd', 'Set a limit per class or time slot you can keep, show the spots left when people book, and add a slot at your busiest hour.'],
  general: ['Read the unhappy reviews closely', 'Call or message each unhappy customer you can reach, ask what went wrong and fix the most common answer first.'],
};
// A competitor's complaints: a promise the member could make instead, only if they can keep it.
const OPEN = {
  people: "You'll deal with the owner, by name, every visit.",
  speed: "On time, or you get a text before you're left waiting.",
  price: 'The price you are quoted is the price you pay.',
  quality: "If something isn't right, I'll redo it free within 48 hours.",
  clean: 'A clean place, checked before every appointment.',
  talk: "You'll hear back the same day.",
  booking: 'Book online in a minute, with a text to confirm.',
  place: 'Easy parking, and directions in your confirmation text.',
  hours: 'Evening and weekend times for people who work all day.',
  skill: 'We explain every step in plain words.',
  feel: 'A calm, comfortable place to wait.',
  choice: 'More choices, including [the option people ask for].',
  trust: 'No surprise add-ons. We ask before we add anything.',
  kids: 'Kids welcome, and we plan for them.',
  pets: 'Gentle with pets, and we tell you how it went.',
  crowd: 'Small groups, so there is always room for you.',
  general: "If something isn't right, tell me and I'll make it right.",
};
// Reply drafts to your own unhappy reviews: [what you're sorry about, what you're doing about it].
// Price, hours and choice get no promise to change: the member fills in what they can offer.
const REPLY = {
  people: ["I'm sorry about how you were treated", "I'm talking with the team about how we welcome people."],
  speed: ["I'm sorry you had to wait", "I'm changing how we schedule, so we run on time."],
  price: ['I hear you on the price', '[Say what you can offer, like a package or an off-peak time, or why the price changed.]'],
  quality: ["I'm sorry the work wasn't right", "I'm changing how we check the work before we finish, so it doesn't happen again."],
  clean: ["I'm sorry it wasn't clean", "I'm adding a check before we open, so it doesn't happen again."],
  talk: ["I'm sorry nobody let you know", "I'm changing how we keep people posted, so it doesn't happen again."],
  booking: ["I'm sorry booking was a hassle", "I'm fixing how booking works, so it doesn't happen again."],
  place: ["I'm sorry getting here was hard", "I'm adding parking and directions to the message we send before each visit."],
  hours: ["I'm sorry our hours didn't work for you", "I'm looking at our hours, and your note helps."],
  skill: ["I'm sorry we didn't explain things well", "I'm changing how we explain the work as we go."],
  feel: ["I'm sorry the place didn't feel right", "I'm looking at what we can change in the space, and your note helps."],
  choice: ["I'm sorry we didn't have what you wanted", "I'm looking at what we offer, and your note helps."],
  trust: ["I'm sorry about the surprise on your bill", "I'm changing how we quote, so the price is clear before we start."],
  kids: ["I'm sorry about how your family was looked after", "I'm changing how we look after families, so it doesn't happen again."],
  pets: ["I'm sorry about how your pet was looked after", "I'm changing how we handle pets, so it doesn't happen again."],
  crowd: ["I'm sorry it was so crowded", "I'm changing how many people we book at once, so there is room for everyone."],
  general: ["I'm sorry your visit wasn't what you hoped", "I'm looking at what went wrong, so it doesn't happen again."],
};
const NO_PROMISE = new Set(['price', 'hours', 'choice']);
// Which complaint a reply answers when a review has more than one.
const REPLY_ORDER = ['talk', 'crowd', 'booking', 'speed', 'quality', 'clean', 'price', 'trust', 'people', 'pets', 'kids', 'place', 'feel', 'hours', 'choice', 'skill', 'general'];
// Your own reviews: how to show what customers love ([title, how]).
const SHOW = {
  people: ['Put your people up front', 'Add a photo of the team with first names to your homepage and Google profile.'],
  speed: ['Say how fast you are', 'Put your usual wait or turnaround time on your homepage, in plain words.'],
  price: ['Say what you charge', 'Show your prices on your site, so people who love value find you.'],
  quality: ['Show the work', 'Post before-and-after photos or a short video of real work, with the customer\'s permission.'],
  clean: ['Show how clean it is', 'Post a photo of the room as customers see it, and say how often you clean.'],
  talk: ['Say how fast you answer', 'Put "We answer the same day" on your site, and keep it.'],
  booking: ['Show how easy booking is', 'Put your booking link at the top of your homepage and in your bio.'],
  place: ['Say where to park', 'Add parking and directions to your homepage and confirmation texts.'],
  hours: ['Put your hours up front', 'Show your hours at the top of your homepage and your Google profile.'],
  skill: ['Show what you know', 'Post one short tip a week from what you do every day.'],
  feel: ['Show the space', 'Post photos of the space as it looks on a normal day.'],
  choice: ['Show the choices', 'Put your full list of options on one page, with prices.'],
  trust: ['Say how you price', 'Explain how you quote, so people trust you before they call.'],
  kids: ['Show you welcome families', 'Say what you do for kids and parents on your homepage.'],
  pets: ['Show how you treat pets', 'Post photos of happy pets, with their owners\' permission.'],
  crowd: ['Say you keep groups small', 'Put your group size on your homepage and booking page.'],
  general: ['Say what people love', 'Use their words on your homepage and Google profile.'],
};

const themeOf = (id) => THEME[id] || GENERAL;
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const named = (list) => list.filter((x) => x.id !== 'general');

function movesFor(r, { whose, siteOnly }) {
  const N = r.total;
  const out = [];
  const [p1, p2] = named(r.praise);
  const [c1, c2] = named(r.complaints).length ? named(r.complaints) : r.complaints;
  const words = r.words.slice(0, 3).map((w) => w.word);
  const ask = r.asks[0];
  const askWhy = `${r.counts.asks === 1 ? 'One review asks' : `${r.counts.asks} reviews ask`} for something`;
  if (whose === 'competitor') {
    if (c1) out.push({ title: `Your opening: ${c1.label.toLowerCase()}`, why: `${c1.n} of their ${N} reviews complain about ${c1.about}.`, how: `Promise the opposite, only if you can keep it: "${OPEN[c1.id] || OPEN.general}"` });
    if (p1) out.push({ title: `Match them on ${p1.about}`, why: `${p1.n} of their ${N} reviews praise ${p1.about}, so buyers here expect it.`, how: 'Make it part of your offer and say it plainly on your homepage and your Google profile.' });
    if (ask) out.push({ title: 'Offer what their customers ask for', why: `${askWhy} they don't offer.`, how: `"${text.clip(ask.text, 140)}" If it fits what you do, offer it and say so.` });
    if (c2) out.push({ title: `Another opening: ${c2.label.toLowerCase()}`, why: `${c2.n} of their ${N} reviews complain about ${c2.about}.`, how: `Only if it's true for you: "${OPEN[c2.id] || OPEN.general}"` });
    if (words.length >= 2) out.push({ title: "Use their customers' words", why: 'This is how buyers here describe a good visit.', how: `Put ${text.list(words.map((w) => `"${w}"`))} in your headline, your bio and your ads.` });
    if (siteOnly) out.push({ title: 'Show your reviews like they do', why: `${siteOnly} shows ${N} ${N === 1 ? 'testimonial' : 'testimonials'} on its own website.`, how: "Put 3 real reviews on your homepage, with each customer's permission, and link to your Google reviews." });
  } else {
    if (c1) out.push({ title: (FIX[c1.id] || FIX.general)[0], why: `${c1.n} of ${N} reviews complain about ${c1.about}.`, how: (FIX[c1.id] || FIX.general)[1] });
    if (p1) out.push({ title: `Say what they love: ${p1.label.toLowerCase()}`, why: `${p1.n} of ${N} reviews praise ${p1.about}.`, how: words.length ? `Use their words, ${text.list(words.map((w) => `"${w}"`))}, in your homepage headline, your bio and your Google profile.` : 'Put it in your homepage headline and your bio, in plain words.' });
    if (ask) out.push({ title: 'Offer what they ask for', why: `${askWhy} you don't offer yet.`, how: `"${text.clip(ask.text, 140)}" If you can do it, try it for a month and tell the people who asked.` });
    if (c2) out.push({ title: (FIX[c2.id] || FIX.general)[0], why: `${c2.n} of ${N} reviews complain about ${c2.about}.`, how: (FIX[c2.id] || FIX.general)[1] });
    if (p2) out.push({ title: (SHOW[p2.id] || SHOW.general)[0], why: `${p2.n} of ${N} reviews praise ${p2.about}.`, how: (SHOW[p2.id] || SHOW.general)[1] });
    if (N < 10) out.push({ title: 'Ask every customer for a review', why: `${N} ${N === 1 ? 'review is' : 'reviews is'} a small sample, and more reviews help people choose you.`, how: 'After each job, send your review link the same day with one line of thanks. Ask everyone, with nothing attached.' });
  }
  return out.slice(0, 5);
}

function summaryFor(r, { whose, who }) {
  const N = r.total;
  const p = named(r.praise)[0];
  const c = named(r.complaints)[0] || r.complaints[0];
  const subject = whose === 'competitor' ? `${who || 'their'} customers` : 'your customers';
  const parts = [`We read ${N} ${N === 1 ? 'review' : 'reviews'}.`];
  if (p) parts.push(`${cap(subject)} praise ${p.about} most (${p.n} of ${N}).`);
  if (c) parts.push(`The most common complaint is about ${c.about} (${c.n} of ${N}).`);
  else parts.push('Nobody complains about anything in particular.');
  if (r.counts.asks) parts.push(`${r.counts.asks === 1 ? 'One review asks' : `${r.counts.asks} reviews ask`} for something new.`);
  return parts.join(' ');
}

// Lines the member can copy: their customers' words (own reviews) or a promise against a competitor's
// complaint (a competitor's reviews). Only words found in the reviews.
function linesFor(r, { whose }) {
  const words = r.words.slice(0, 3).map((w) => w.word);
  if (whose === 'competitor') return named(r.complaints).slice(0, 2).map((c) => ({ label: `Against their ${c.label.toLowerCase()} complaints (only if it's true for you)`, text: OPEN[c.id] })).filter((x) => x.text);
  const out = [];
  if (words.length >= 2) out.push({ label: 'For your homepage or bio', text: `${cap(text.list(words))}. That's how our customers describe us.` });
  const best = (named(r.praise)[0] || {}).quotes || [];
  if (best[0]) out.push({ label: "A customer's words for your site (ask them first)", text: `"${best[0].replace(/^\.\.\./, '')}" (a customer)` });
  return out;
}

function repliesFor(r) {
  const unhappy = r.rows.filter((x) => x.complaints.length).sort((a, b) => (a.stars == null ? 3 : a.stars) - (b.stars == null ? 3 : b.stars));
  return unhappy.slice(0, 3).map((x) => {
    const id = REPLY_ORDER.find((k) => x.complaints.includes(k)) || 'general';
    const [sorry, doing] = REPLY[id] || REPLY.general;
    const soft = NO_PROMISE.has(id);
    return {
      review: x.n,
      quote: text.clip(x.text, 160),
      text: `Thank you for telling us. ${sorry}.${soft ? '' : " That isn't the visit we want for anyone."} ${doing} If you're open to it, call me at [your number] and ${soft ? "we'll find what works for you" : "I'll make it right"}. [your name]`,
    };
  });
}

// AI may only quote words that are in the reviews and use numbers that are in the counts.
function grounded(data, r, allowedNums) {
  const hay = r.rows.map((x) => x.text.toLowerCase()).join('\n') + '\n' + r.words.map((w) => w.word).join('\n');
  const all = [data.summary, ...(data.moves || []).flatMap((m) => [m.title, m.why, m.how])].join('\n');
  for (const m of all.matchAll(/"([^"]{4,})"/g)) if (!hay.includes(m[1].toLowerCase().replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim())) return false;
  for (const m of all.matchAll(/\d+(\.\d+)?/g)) if (!allowedNums.has(m[0]) && !hay.includes(m[0])) return false;
  return true;
}

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 500 },
    moves: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', properties: { title: { type: 'string', maxLength: 70 }, why: { type: 'string', maxLength: 200 }, how: { type: 'string', maxLength: 280 } }, required: ['title', 'why', 'how'] } },
  },
  required: ['summary', 'moves'],
};

function reportHtml(out, r) {
  const N = r.total;
  const who = out.whose === 'competitor' ? out.business || 'this competitor' : out.business || 'your business';
  const col = (cls, title, list, empty) => {
    // A quote shows once per column, unless a theme has no other.
    const shown = new Set();
    const quotes = (t) => {
      const fresh = t.quotes.filter((q) => !shown.has(q));
      const pick = (fresh.length ? fresh : t.quotes).slice(0, 2);
      for (const q of pick) shown.add(q);
      return pick.map((q) => `<p class="q">"${esc(q)}"</p>`).join('');
    };
    return `<div class="card col ${cls}"><h3>${esc(title)}</h3>${
      list.length ? list.slice(0, 4).map((t) => `<div class="theme"><b>${esc(t.label)}</b> <span class="muted small">${t.n} of ${N}</span>${bar(t.n, N)}${quotes(t)}</div>`).join('') : `<p class="muted small">${esc(empty)}</p>`
    }</div>`;
  };
  const asks = r.asks.length ? r.asks.slice(0, 5).map((a) => `<p class="q">"${esc(a.text)}"</p>`).join('') : '<p class="muted small">Nobody asks for anything new in these reviews.</p>';
  const body = [
    `<h2>What to do this week</h2>${out.moves.map((m, i) => `<div class="card"><div class="top"><span class="n">${i + 1}</span><div class="grow"><h3>${esc(m.title)}</h3><p class="muted small">${esc(m.why)}</p><p>${esc(m.how)}</p></div></div></div>`).join('')}`,
    `<h2>What the reviews say</h2><div class="grid">${col('love', 'What they love', named(r.praise).length ? named(r.praise) : r.praise, 'No clear praise in these reviews.')}${col('gripe', 'What they complain about', r.complaints, 'No complaints in these reviews.')}<div class="card col ask"><h3>What they ask for</h3>${asks}</div></div>`,
    r.words.length ? `<h2>Their words</h2><p class="muted small" style="margin-bottom:8px">The words customers use when they are happy, and how many reviews use each.</p><div class="chips">${r.words.map((w) => `<span class="chip">${esc(w.word)} <b>${w.n}</b></span>`).join('')}</div>` : '',
    out.lines.length ? `<h2>Lines you could use</h2>${out.lines.map((l) => `<div class="say"><b>${esc(l.label)}</b>${esc(l.text)}</div>`).join('')}` : '',
    out.replies.length ? `<h2>Replies to the unhappy reviews</h2><p class="muted small" style="margin-bottom:8px">Post one under each review. Fill in the [brackets] first. Never offer anything for changing a review.</p>${out.replies.map((x) => `<div class="card"><p class="q">"${esc(x.quote)}"</p><div class="say"><b>Your reply</b>${esc(x.text)}</div></div>`).join('')}` : '',
    r.stars ? `<h2>Stars</h2><div class="stars">${r.stars.counts.map((s) => `<span class="small">${s.stars} ${s.stars === 1 ? 'star' : 'stars'}</span>${bar(s.n, r.stars.rated)}<b>${s.n}</b>`).join('')}</div><p class="muted small" style="margin-top:8px">${r.stars.rated} of the ${N} reviews had stars we could read, averaging ${r.stars.average.toFixed(1)}.</p>` : '',
  ].join('');
  const from = [out.fromPaste ? `${out.fromPaste} ${out.fromPaste === 1 ? 'review' : 'reviews'} you pasted` : '', out.fromSite ? `${out.fromSite} ${out.fromSite === 1 ? 'testimonial' : 'testimonials'} on ${out.site}` : ''].filter(Boolean);
  const footer = [
    `<p>From ${esc(text.list(from))}, read ${esc(out.date)}. We never read review sites, and reviewer names are left out.</p>`,
    ...out.notes.map((n) => `<p>${esc(n)}</p>`),
    '<p>Each sentence is sorted by the words in it, so read the quotes before you act on a count.</p>',
    out.whose === 'competitor' ? '' : "<p>Before you put a customer's words on your website or a flyer, ask them first.</p>",
    out.sample ? '<p>Sample business: the website and these reviews are made up to show how it works.</p>' : '',
  ].join('');
  return page({
    title: out.whose === 'competitor' ? `What customers say about ${who}` : 'What your customers say',
    eyebrow: out.whose === 'competitor' ? 'Their reviews' : 'Your reviews',
    h1: out.whose === 'competitor' ? `What customers say about ${who}` : out.business ? `What customers say about ${out.business}` : 'What your customers say',
    sub: out.summary,
    pills: [`${N} ${N === 1 ? 'review' : 'reviews'}`, `${r.counts.praise} praise`, `${r.counts.complaints} complain`, `${r.counts.asks} ask`],
    body,
    footer,
  });
}

module.exports = {
  name: 'intel.mine_reviews',
  title: 'Read what customers say',
  description: 'Reads pasted reviews (yours or a competitor\'s) and a business\'s own testimonials: what customers praise, complain about and ask for, in their words, with what to do. Saves a one-page report and a spreadsheet.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      reviews: { type: 'string', format: 'textarea', maxLength: 40000, title: 'Reviews', description: 'Paste them as you copied them; names, dates and stars are left out.' },
      testimonials: { type: 'array', title: 'Testimonials from their website', description: 'testimonials from intel.read_testimonials' },
      whose: { type: 'string', title: 'Whose reviews', description: '"My business" (or "mine") or "A competitor" (or "competitor")' },
      business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
      site: { type: ['string', 'null'], title: 'Their website, as read (optional)' },
      refused: { type: ['string', 'null'], title: 'A review site we refused to read (from intel.read_testimonials)' },
      sample: { type: 'boolean', title: 'Sample business' },
    },
  },
  output: {
    type: 'object',
    properties: { total: { type: 'integer' }, praise: { type: 'array' }, complaints: { type: 'array' }, asks: { type: 'array' }, moves: { type: 'array' }, summary: { type: 'string' }, report: { type: 'object' }, csv: { type: 'object' }, ai: { type: 'boolean' } },
    required: ['total', 'praise', 'complaints', 'asks', 'moves', 'summary', 'report', 'csv', 'ai'],
  },
  async run(input, ctx) {
    const whose = /competitor/i.test(String(input.whose || '')) ? 'competitor' : 'mine';
    const business = text.clip(text.plain(input.business || ''), 80);
    const pasted = splitReviews(input.reviews || '').map((x) => ({ ...x, from: 'pasted' }));
    const fromSite = (Array.isArray(input.testimonials) ? input.testimonials : []).filter((t) => t && t.text).map((t) => ({ text: text.clip(text.plain(t.text), 1500), stars: null, from: 'website' }));
    const reviews = pasted.concat(fromSite.filter((t) => !pasted.some((p) => p.text.slice(0, 80) === t.text.slice(0, 80))));
    if (!reviews.length) {
      if (input.refused && !String(input.reviews || '').trim()) throw new Error(`We don't read review sites (${input.refused}). Copy the reviews from that page by hand, paste them in and run it again.`);
      if (input.site && !String(input.reviews || '').trim()) throw new Error(`We found no testimonials on ${input.site}'s own pages. Paste reviews (copy them from the page by hand) and run it again.`);
      throw new Error(String(input.reviews || '').trim() ? "We couldn't find a review in what you pasted. Put each review on its own line or paragraph." : 'Paste at least one review, or add the business\'s own website.');
    }
    const r = mine(reviews);
    const N = r.total;
    const notes = [];
    if (N < 5) notes.push(`Only ${N} ${N === 1 ? 'review' : 'reviews'}: treat these as hints, not a pattern.`);
    if (!pasted.length) notes.push(`These are the testimonials ${input.site || 'the business'} chose to show, so they lean happy. To see complaints too, copy reviews from Google or Yelp by hand and paste them in.`);
    const today = time.today(ctx);
    const base = { whose, business, site: input.refused ? '' : input.site || '', fromPaste: pasted.length, fromSite: reviews.length - pasted.length, date: time.longDate(today) };
    const fallback = () => ({ summary: summaryFor(r, { whose, who: business }), moves: movesFor(r, { whose, siteOnly: !pasted.length && input.site }) });
    const allowed = new Set([N, r.counts.praise, r.counts.complaints, r.counts.asks, ...r.praise.map((x) => x.n), ...r.complaints.map((x) => x.n), ...r.words.map((w) => w.n), ...(r.stars ? [r.stars.rated, r.stars.average, ...r.stars.counts.map((s) => s.n)] : []), 1, 2, 3, 4, 5, 30, 48].map(String));
    const facts = {
      whose: whose === 'competitor' ? `a competitor${business ? ` (${business})` : ''}` : `the member's own business${business ? ` (${business})` : ''}`,
      reviews: N,
      praise: named(r.praise).slice(0, 5).map((x) => ({ theme: x.label, reviews: x.n, quotes: x.quotes.slice(0, 2) })),
      complaints: r.complaints.slice(0, 5).map((x) => ({ theme: x.label, reviews: x.n, quotes: x.quotes.slice(0, 2) })),
      asks: r.asks.slice(0, 5).map((a) => a.text),
      words: r.words.slice(0, 6).map((w) => w.word),
    };
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You turn customer reviews into a short action plan for a small business owner. Plain text, second person, short sentences.',
      prompt: `These reviews are about ${facts.whose}. Counts and exact quotes, read from ${N} reviews (JSON):\n${JSON.stringify(facts)}\nWrite a 2 to 3 sentence summary, then 3 to 5 moves for this week (title, why, how). ${whose === 'competitor' ? 'The member competes with this business: what to match, which complaints are their opening (a promise they can keep), and what customers ask for that nobody offers.' : 'Fix the top complaint first, then say what customers love in their own words, then add what they ask for.'} Use only these counts and these quotes, word for word. Never name or describe a reviewer. Never promise results or income, and never suggest giving anything in exchange for a review.`,
      schema: SCHEMA,
      maxTokens: 1100,
      accept: (d) => ai.cleanCopy(d) && grounded(d, r, allowed),
      fallback,
    });
    const out = {
      ...base,
      total: N,
      counts: r.counts,
      stars: r.stars,
      praise: r.praise.slice(0, 8),
      complaints: r.complaints.slice(0, 8),
      asks: r.asks,
      words: r.words,
      themes: [...new Set([...r.praise, ...r.complaints].map((t) => t.id))].map((id) => ({ label: themeOf(id).label, praise: (r.praise.find((x) => x.id === id) || {}).n || 0, complaints: (r.complaints.find((x) => x.id === id) || {}).n || 0 })).sort((a, b) => b.praise + b.complaints - (a.praise + a.complaints)),
      summary: text.plain(data.summary),
      moves: (data.moves || []).slice(0, 5),
      lines: linesFor(r, { whose }),
      replies: whose === 'mine' ? repliesFor(r) : [],
      notes,
      ai: usedAi,
      sample: !!input.sample,
    };
    const label = business || input.site || (whose === 'competitor' ? 'competitor' : 'your business');
    out.report = await save.saveFile(ctx, save.fileName('what customers say', label, today, '.html'), reportHtml(out, r));
    const names = (ids) => ids.map((id) => themeOf(id).label).join('; ');
    out.csv = await save.saveFile(
      ctx,
      save.fileName('reviews sorted', label, today, '.csv'),
      files.csv(
        r.rows.map((x) => ({ n: x.n, from: x.from === 'website' ? `Their website (${input.site || 'own site'})` : 'Pasted', stars: x.stars == null ? '' : x.stars, praise: names(x.praise), complaints: names(x.complaints), asks: x.asks.join(' | '), text: text.clip(x.text, 600) })),
        [{ key: 'n', label: '#' }, { key: 'from', label: 'From' }, { key: 'stars', label: 'Stars' }, { key: 'praise', label: 'Praises' }, { key: 'complaints', label: 'Complains about' }, { key: 'asks', label: 'Asks for' }, { key: 'text', label: 'Review (reviewer names left out)' }],
        { bom: true }
      )
    );
    ctx.log(`Read ${N} reviews: ${r.counts.praise} praise, ${r.counts.complaints} complain, ${r.counts.asks} ask`);
    return out;
  },
  view(out) {
    return views.blocks(
      views.metric('Reviews read', out.total, `${out.counts.praise} praise, ${out.counts.complaints} complain, ${out.counts.asks} ask for something`),
      views.text(out.summary),
      views.cards(out.moves.map((m, i) => ({ title: `${i + 1}. ${m.title}`, subtitle: m.why, body: m.how }))),
      out.themes.length ? views.table([{ key: 'label', label: 'What they write about' }, { key: 'praise', label: 'Praise', format: 'number' }, { key: 'complaints', label: 'Complaints', format: 'number' }], out.themes, 8) : null,
      out.asks.length ? views.cards(out.asks.slice(0, 3).map((a) => ({ title: `"${text.clip(a.text, 150)}"`, subtitle: 'Asked for in a review' }))) : null,
      out.lines.map((l) => views.copy(l.label, l.text)),
      out.replies.map((x) => views.copy(`Reply to: "${text.clip(x.quote, 60)}"`, x.text)),
      views.file(out.report, 'What customers say (one page)'),
      views.file(out.csv, 'Every review, sorted (spreadsheet)'),
      out.notes.map((n) => views.text(n)),
      out.sample ? views.text('Sample business: the website and these reviews are made up to show how it works.') : null
    );
  },
};
