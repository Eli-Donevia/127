// What a content plan needs to know about a kind of business: the mistakes buyers make, the myths
// they believe, the questions they ask, what a pro's process looks like and what to film. The facts
// live in data/niches.json (a new niche is config, not code). They're general know-how, never a claim
// about a real business or a statistic. Templates in hooks.js and scripts.js add the member's own
// name, city, offer and price.

const { brain, text } = require('../../_kit');
const NICHES = require('../data/niches.json').niches;

// An onboarding answer ("Local business") names no business: the kit's ownWords drops it.
const own = brain.ownWords;
const { aOrAn, withA } = text;

function lowerFirst(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  // Keep acronyms, "I" and names as written: "AI front desk", "UGC", "I'll send you".
  if (/^[A-Z]{2,}\b/.test(t) || /^I(\b|')/.test(t)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function cleanService(s) {
  return lowerFirst(String(s || '').replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim()).slice(0, 60).trim();
}

// The ask for one unit of what they sell: "Book a detail", "Place an order", "Shop the next drop".
function askFor(short) {
  const s = String(short || 'job').trim();
  if (s === 'order') return 'Place an order';
  if (s === 'drop') return 'Shop the next drop';
  if (s === 'template') return 'Get the template';
  if (s === 'project') return 'Start a project';
  return `Book ${withA(s)}`;
}

// Words that say the member sells things, not time: their orders are orders, not projects.
const SELLS = /\b(products?|goods|shop|store|e-?commerce|brand|handmade|merch|candles?|soaps?|jewelry|clothing|apparel|prints|bakery|baked|cookies|cakes|coffee|tea)\b/i;

// A plan for a business we have no data for: built from the member's own words, so it's still about
// them (their service, buyer and offer), with general advice that fits any service.
function generic(f = {}) {
  const service = cleanService(own(f.niche) || own(f.what) || own(f.offer) || 'your service');
  const sells = SELLS.test([f.category, f.niche, f.what, f.offer].filter(Boolean).join(' '));
  const vague = service === 'your service';
  return {
    key: 'generic',
    words: [],
    service,
    short: sells ? 'order' : 'project',
    thing: sells ? 'product' : 'project',
    pro: 'pro',
    buyers: f.buyers || 'customers',
    local: !!f.city,
    mood: 'clean',
    seeds: [service].filter(Boolean),
    cta: { keyword: 'INFO', promise: "I'll send you the details and the price" },
    outcome: f.offer ? lowerFirst(f.offer) : 'a result you are happy with',
    signsTitle: vague ? 'signs it is time to get help' : `signs it is time to get help with ${service}`,
    pov: vague ? `POV: you finally found someone${f.city ? ` in ${f.city}` : ''} you can trust.` : `POV: you finally found someone for ${service}${f.city ? ` in ${f.city}` : ''}.`,
    pains: ['you have put this off for months', 'you are not sure who to trust', 'the cheap option did not work last time'],
    mistakes: [
      { m: 'Choosing on price alone', why: 'The cheapest option often costs more when it has to be redone.', fix: 'Ask what is included and what happens if it is not right.' },
      { m: 'Waiting until it is urgent', why: 'Rushed work costs more and leaves fewer choices.', fix: 'Plan it before you need it.' },
      { m: 'Not asking to see past work', why: 'Past work is the best preview of your result.', fix: 'Ask for examples before you book.' },
      { m: 'Skipping the questions you think are silly', why: 'Small questions prevent big surprises.', fix: 'Write them down and ask all of them.' },
    ],
    myths: [
      { myth: 'Everyone in this field is the same', truth: 'Process, care and communication vary a lot.' },
      { myth: 'Doing it yourself is always cheaper', truth: 'Not when you count your time and the redo.' },
      { myth: 'Small businesses are slower', truth: 'Small often means faster answers and more care.' },
    ],
    tips: [
      { tip: 'Write down exactly what you want before you ask for a price', why: 'Clear asks get clear quotes.' },
      { tip: 'Ask what happens if something goes wrong', why: 'The answer tells you how they work.' },
      { tip: 'Book a time that is not rushed', why: 'Rushed jobs are where mistakes happen.' },
      { tip: 'Keep everything in one message thread', why: 'Nothing gets lost.' },
    ],
    signs: ['You keep putting it off', 'The last fix did not last', 'You are not sure what you need', 'It is starting to cost you time'],
    compare: [
      { a: 'doing it yourself', b: 'hiring a pro', point: 'One costs your time. The other costs money and gives the time back.' },
      { a: 'the cheapest quote', b: 'the clearest quote', point: 'Clear quotes have fewer surprises.' },
    ],
    questions: [
      { q: `How much does ${service} cost?`, a: 'It depends on what you need. Ask for a clear quote with what is included.' },
      { q: vague ? 'How do I choose who to hire?' : `How do I choose someone for ${service}?`, a: 'Look at their past work, ask how they handle problems and talk to them first.' },
      { q: `How long does ${service} take?`, a: 'Ask for a timeline up front so you can plan.' },
      { q: `What should I ask before I book ${service}?`, a: 'What is included, when it happens and what happens if something is not right.' },
      { q: `Is ${service} worth it?`, a: 'If it saves you time or gets you a better result, usually yes.' },
    ],
    process: ['A quick call to understand the job', 'A clear quote', 'Do the work', 'Check it together', 'Follow up after'],
    proof: ['the work in progress', 'the finished result', 'the tools and setup', 'the moment of handoff'],
    objections: [
      { o: 'I can do it myself', a: 'You can. The question is what your time is worth.' },
      { o: 'It costs too much', a: 'Start small and see if it is worth it.' },
      { o: 'I will do it later', a: 'Later is how it ended up on the list.' },
    ],
    bts: ['how I work, step by step', 'my setup', 'a day on the job'],
    tags: [],
  };
}

// The niche that best fits the member's words (niche, what, offer, name). What they do comes before
// who it's for ("UGC for skincare brands", "web design for contractors"), so a keyword in that first
// part wins; then the longest keyword, so "pressure washing" beats "washing".
// The niche whose longest word appears, and where that word starts.
function bestAt(hay) {
  let best = null;
  let bestLen = 0;
  let at = -1;
  for (const n of NICHES) {
    for (const w of n.words) {
      const i = hay.indexOf(w);
      if (i >= 0 && w.length > bestLen) {
        best = n;
        bestLen = w.length;
        at = i;
      }
    }
  }
  return { best, at };
}
const bestIn = (hay) => bestAt(hay).best;

function matchNiche(f = {}) {
  const parts = [f.niche, f.what, f.offer, f.name].filter(Boolean).map((s) => ` ${String(s).toLowerCase()} `);
  let best = null;
  for (const p of parts) {
    // "Bookkeeping for contractors": the member's trade comes before "for", and the words after it
    // are their buyer's, so the buyer never picks the niche (a bookkeeper gets no handyman hooks).
    // A word that starts in their own part still counts ("reels for gyms" is video).
    const mine = p.split(/\s(?:for|to help|serving)\s/)[0];
    const whole = bestAt(p);
    best = bestIn(` ${mine} `) || (whole.at >= 0 && whole.at < mine.length ? whole.best : null);
    if (best) break;
  }
  return best ? JSON.parse(JSON.stringify(best)) : generic(f);
}

function byKey(key) {
  const n = NICHES.find((x) => x.key === key);
  return n ? JSON.parse(JSON.stringify(n)) : null;
}

module.exports = { NICHES, matchNiche, byKey, generic, lowerFirst, cleanService, own, aOrAn, withA, askFor };
