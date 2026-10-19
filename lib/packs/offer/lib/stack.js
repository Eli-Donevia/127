// Offer builder: trim and stack the fixes (keep what's worth a lot to the buyer and cheap to give,
// cut the rest), then assemble the offer: the core, the named parts, the promise, real limits only,
// the price and how to book. Then the offer in every length the member needs (bio, one line, DM,
// site, out loud) and the one-page offer as a designed HTML file. No "$X value" totals: each part
// says which worry it removes.

const { text, money, time } = require('../../_kit');
const { cap, ctaOf, whenLine, a } = require('./facts');
const { promiseName, promiseShort } = require('./library');
const { sayIt } = require('./names');
const value = require('./value');
const page = require('./page');

// Higher is better: worth to the buyer, minus what it costs the member, plus a push toward the
// part of the offer that's weakest right now.
function stackScore(item, drivers) {
  const weak = drivers ? (10 - (drivers[item.driver] || 5)) / 3 : 0;
  return item.value * 2 - item.cost + weak;
}

function verdictFor(item) {
  if (item.value >= 4 && item.cost <= 2) return { keep: true, reason: 'Worth a lot to them, cheap for you. Keep it.' };
  if (item.value - item.cost >= 2) return { keep: true, reason: 'Worth more to them than it costs you. Keep it.' };
  if (item.value >= 3 && item.cost <= 1) return { keep: true, reason: 'Small, but it costs you almost nothing. Keep it.' };
  if (item.cost > item.value) return { keep: false, reason: 'Costs you more than it\'s worth to them. Cut it.' };
  return { keep: false, reason: 'Fine, but it makes the offer longer without making it better. Cut it for now.' };
}

// problems: from library.problemsFor (or AI). drivers: the current offer score's drivers, if known.
function trimAndStack(problems, drivers) {
  const items = problems
    .filter((x) => x.id !== 'promise')
    .map((x) => {
      const v = verdictFor(x);
      return { ...x, keep: v.keep, verdict: v.keep ? 'Keep' : 'Cut', reason: v.reason, score: Math.round(stackScore(x, drivers) * 10) / 10 };
    });
  const keep = items.filter((x) => x.keep).sort((p, q) => q.score - p.score);
  const cut = items.filter((x) => !x.keep).sort((p, q) => q.score - p.score);
  // Every stage of the buyer's trip gets at least one kept fix near the top.
  const top = [];
  for (const stage of ['before', 'during', 'after']) {
    const first = keep.find((x) => x.stage === stage && !top.includes(x));
    if (first) top.push(first);
  }
  const ordered = [...top.sort((p, q) => q.score - p.score), ...keep.filter((x) => !top.includes(x)), ...cut];
  // Two fixes that say the same thing read like padding: keep the first, move the echo to the end.
  const STOP = new Set(['plan', 'minute', 'minutes', 'every', 'with', 'your', 'first', 'session', 'sessions', 'after', 'text', 'free', 'week', 'made', 'that', 'this', 'from', 'when', 'what', 'they', 'them', 'before', 'want', 'just', 'each', 'time']);
  const words = (t) => new Set((String(t).toLowerCase().match(/[a-z']{4,}/g) || []).filter((w) => !STOP.has(w)));
  const overlap = (x, y) => {
    const A = words(x);
    const B = words(y);
    let n = 0;
    for (const w of A) if (B.has(w)) n++;
    return n / Math.max(1, Math.min(A.size, B.size));
  };
  const ranked = [];
  const echoes = [];
  for (const x of ordered) (x.keep && ranked.some((y) => y.keep && overlap(x.fix, y.fix) >= 0.6) ? echoes.push({ ...x, keep: false, verdict: 'Cut', reason: 'Says the same as another part. Cut it to keep the offer tight.' }) : ranked.push(x));
  ranked.push(...echoes);
  return ranked.map((x, i) => ({ ...x, rank: i + 1, label: `${x.part}`, detail: `${x.verdict}: ${x.fix}` }));
}

function scarcityLine(f) {
  if (!f.capacity) return '';
  return `I take ${f.capacity} new ${f.capacity === 1 ? f.customer : f.customers} a ${f.capacityPer}, so every one gets my full attention.`;
}

function urgencyLine(f) {
  if (!f.startDate) return '';
  if (f.arch === 'teach' || f.arch === 'b2b_service') return `Next start date: ${time.longDate(f.startDate)}.`;
  return `Now booking from ${time.longDate(f.startDate)}.`;
}

function priceLine(f) {
  if (!f.price) return '';
  return f.unit === 'month' ? `From ${money.usd(f.price)} a month.` : `From ${money.usd(f.price)} per ${f.unit}.`;
}

// The whole offer as data: what every length and the page are built from.
function assemble(f, { parts = [], name = '', keyword = '' } = {}) {
  const p = f.profile;
  const offerName = text.oneLine(name) || `The ${(p.goal && p.goal[0]) || 'Starter'} ${(p.containers && p.containers[0]) || 'Plan'}`;
  const kw = (text.oneLine(keyword) || offerName.split(/[\s-]+/).pop() || 'INFO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'INFO';
  const effort = f.mobile ? p.mobileEffort : p.effort;
  const chosen = parts
    .filter((x) => x && x.part)
    .slice(0, 7)
    .map((x) => ({ name: text.oneLine(x.part), what: text.oneLine(x.fix), solves: text.oneLine(x.problem), q: text.oneLine(x.q || ''), stage: x.stage || 'before', vehicle: x.vehicle || '' }));
  const promise = { name: promiseName(p.promise), text: p.promise.text, short: promiseShort(p.promise), type: p.promise.type };
  return {
    name: offerName,
    keyword: kw,
    business: f.business,
    firstName: f.firstName,
    what: f.what,
    who: f.who,
    outcome: f.outcome,
    headline: `${cap(f.outcome)}, for ${f.who}.`,
    when: whenLine(f),
    effort: `${effort}.`,
    proof: `${cap(p.proof)}.`,
    parts: chosen,
    promise,
    price: f.price,
    priceLine: priceLine(f),
    scarcity: scarcityLine(f),
    urgency: urgencyLine(f),
    cta: ctaOf(f, kw),
    city: f.place || f.city,
    unit: f.unit,
    customers: f.customers,
    assumed: f.assumed,
  };
}

// Fit lines into a limit, dropping the optional ones (last first) until it fits.
// lines: [{ text, drop }]
function fit(lines, max, sep = '\n') {
  const keep = lines.filter((l) => l && l.text);
  const joined = () => keep.map((l) => l.text).join(sep);
  while (joined().length > max) {
    let idx = -1;
    for (let i = keep.length - 1; i >= 0; i--) {
      if (keep[i].drop) {
        idx = i;
        break;
      }
    }
    if (idx < 0) break;
    keep.splice(idx, 1);
  }
  const out = joined();
  return out.length <= max ? out : text.clip(out.replace(/\n/g, ' '), max);
}

const L = (s, drop = false) => ({ text: text.oneLine(s), drop });

function shortWhen(f) {
  return text.clip(f.profile.firstLine, 40);
}

// The offer in every length. limits: { bio } from data/limits.json.
function lengths(o, f, { bioMax = 150 } = {}) {
  const outcome = cap(o.outcome);
  const bio = fit([L(`${outcome}${f.mobile && !/\b(you|your place|driveway|door)\b/i.test(o.outcome) ? ', at your place' : ''}`), L(shortWhen(f), true), L(o.promise.short, true), L(`${o.cta}`)], bioMax);
  const oneLiner = text.clip(`${o.name}: ${o.outcome}.`, 110);
  const dm = text.plain([
    `Thanks for asking! I do ${text.oneLine(o.what).toLowerCase()}${/\bfor\b/i.test(o.what) ? '' : ` for ${o.who}`}.`,
    `${outcome}. ${o.when}`,
    o.effort,
    o.price ? `It's ${money.usd(o.price)}.` : '',
    o.promise.short,
    o.scarcity ? `I only take ${f.capacity} new ${f.customers} a ${f.capacityPer}.` : '',
    'Want me to save you a spot?',
  ].filter(Boolean).join(' '));
  const site = [
    o.name,
    o.headline,
    `${o.when} ${o.effort}`,
    '',
    'What you get:',
    `- ${cap(text.oneLine(o.what))}`,
    ...o.parts.map((x) => `- ${x.name}: ${x.what}`),
    '',
    `My promise: ${o.promise.text}`,
    o.scarcity,
    o.urgency,
    o.priceLine,
    `${o.cta}.`,
  ].filter((x, i, arr) => x !== '' || (arr[i - 1] !== '' && i > 0)).join('\n').trim();
  const spoken = text.plain(`${sayIt(o.name)} ${outcome}, for ${o.who}. ${o.when} ${o.effort} ${o.promise.text}`);
  return [
    { id: 'bio', label: `Instagram bio (${bio.length} of ${bioMax} characters)`, text: bio },
    { id: 'one_liner', label: 'One line (posts, email signature, link previews)', text: oneLiner },
    { id: 'dm', label: 'DM or text, when someone asks what you do', text: dm },
    { id: 'site', label: 'Website or flyer', text: site },
    { id: 'spoken', label: 'Say it out loud (about 20 seconds)', text: spoken },
  ];
}

function lowerFirst(s) {
  const t = String(s || '');
  return /^(I|I'm|I'll|I've)\b/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

function faqOf(o, f) {
  const out = [];
  for (const x of o.parts.filter((p) => p.q || /\?$/.test(p.solves)).slice(0, 4)) out.push({ q: x.q || x.solves, a: x.what });
  out.push({ q: 'What if I\'m not happy?', a: o.promise.text });
  if (o.price) out.push({ q: 'How much is it?', a: `${o.priceLine} You'll know the exact price before I start, and it doesn't change.` });
  out.push({ q: 'How do I book?', a: `${o.cta}. ${f.profile.firstLine}.` });
  const seen = new Set();
  return out.filter((x) => (seen.has(x.q) ? false : seen.add(x.q)));
}

const STAGE_TAG = { before: 'Before you buy', during: 'While I work', after: 'After it\'s done' };

// The one-page offer: designed, printable, works on a phone. No scripts.
function onePager(o, f, { score } = {}) {
  const pal = f.palette;
  const pills = [f.profile.firstLine, f.mobile ? 'I come to you' : '', o.price ? `From ${money.usd(o.price)}` : '', o.scarcity ? `${f.capacity} spots a ${f.capacityPer}` : ''].filter(Boolean);
  const core = page.card({ cls: 'brand', tag: 'The core', title: cap(text.oneLine(o.what)), body: `${cap(o.outcome)}. ${o.effort}` });
  const partCards = o.parts.map((x) => page.card({ tag: STAGE_TAG[x.stage] || 'Included', title: x.name, body: x.what, extra: `<p class="small muted" style="margin-top:8px">For when you think: "${page.esc(x.solves)}"</p>` }));
  const steps = [
    page.card({ tag: 'Step 1', title: 'Book', body: `${o.cta}. Takes a minute.` }),
    page.card({ tag: 'Step 2', title: text.clip(f.profile.firstLine, 48), body: o.effort }),
    page.card({ tag: 'Step 3', title: 'Enjoy it', body: o.promise.short }),
  ];
  const limits = [o.scarcity, o.urgency].filter(Boolean);
  const body = [
    page.hero({ eyebrow: o.business ? `${o.business}${o.city ? `, ${o.city}` : ''}` : (o.firstName ? `An offer from ${o.firstName}` : 'Your offer'), title: o.name, lede: o.headline, pills }),
    page.section('What you get', page.grid([core, ...partCards], 2), { eyebrow: `${o.parts.length + 1} parts` }),
    `<div class="section">${page.promise(o.promise.text, o.promise.name.toUpperCase().includes('PROMISE') ? 'MY PROMISE' : 'MY PROMISE')}</div>`,
    page.section('How it works', page.grid(steps, 3)),
    limits.length ? `<div class="section">${page.grid(limits.map((l) => page.card({ cls: 'soft', tag: 'Good to know', body: l })), limits.length)}</div>` : '',
    page.section('Questions people ask', page.faq(faqOf(o, f))),
    page.cta(o.price ? `${o.name}, ${o.priceLine.replace(/\.$/, '').toLowerCase()}` : o.name, `${o.cta}.`, o.keyword),
    page.foot(`${o.business || o.firstName || ''}${o.city ? ` · ${o.city}` : ''}`, o.price ? 'You know the exact price before any work starts.' : ''),
  ].join('\n');
  return page.doc({ title: `${o.name}${o.business ? ` | ${o.business}` : ''}`, description: o.headline, pal, body });
}

// Score the built offer (its website length) with the same rubric as the Offer score.
function scoreOffer(siteText) {
  const r = value.rubric(siteText, {});
  return { score: value.scoreOf(r.drivers), drivers: r.drivers, verdict: value.verdictOf(value.scoreOf(r.drivers)), rows: value.driverRows(r.drivers, r) };
}

module.exports = { trimAndStack, verdictFor, stackScore, assemble, lengths, onePager, faqOf, scarcityLine, urgencyLine, priceLine, scoreOffer, lowerFirst };
