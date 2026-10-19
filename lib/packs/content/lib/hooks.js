// Hooks in proven formats, built from the member's own facts (service, city, neighborhood, buyer,
// price, offer, keyword), the niche notes and real search questions. Each hook carries its format,
// its pillar, the on-screen text for the first frame and the topic it came from, so a script can
// be written from it without guessing. Ranked by a simple score: real searches, local words and
// the member's own price rank higher; fill-in-the-blank hooks rank lower.
//
// House rules for every template: no experience claims a first-timer can't make ("I see this every
// week"), no fake scarcity, no results promised to the buyer, never a real business's name.

const { text } = require('../../_kit');
const { lowerFirst, withA } = require('./niches');
const { answerFor } = require('./questions');

const lc = lowerFirst;
const sc = (s) => text.sentenceCase(String(s || '').trim());
const end = (s) => {
  const t = String(s || '').trim();
  return /[.?!"]$/.test(t) ? t : `${t}.`;
};
const firstSentence = (s) => String(s || '').split(/(?<=[.!?])\s+/)[0];
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');

// The five pillars every plan rotates through, with our suggested share of posts.
const PILLARS = [
  { key: 'teach', name: 'Teach', share: 0.35, what: 'Answer what buyers ask before they book: prices, how often, what to pick.' },
  { key: 'myths', name: 'Mistakes and myths', share: 0.2, what: 'The mistakes and myths that cost your buyers time or money, and the fix.' },
  { key: 'proof', name: 'Proof', share: 0.2, what: 'Your real work: before and after, the process, the finished result.' },
  { key: 'bts', name: 'Behind the scenes', share: 0.1, what: 'You, your setup and your day, so people know who they are booking.' },
  { key: 'offer', name: 'The offer', share: 0.15, what: 'One clear ask: what you sell, the price, and the keyword to comment.' },
];

const FORMATS = {
  question: { label: 'Real question', pillar: 'teach', base: 74, why: 'Answers a question people already type into Google.' },
  mistake: { label: 'Mistake', pillar: 'myths', base: 76, why: 'People stop for anything that might be costing them.' },
  myth: { label: 'Myth buster', pillar: 'myths', base: 72, why: 'Saying the opposite of what people believe earns the next 3 seconds.' },
  signs: { label: 'Signs list', pillar: 'teach', base: 70, why: 'Viewers check themselves against the list, and they save it.' },
  tip: { label: 'Quick tip', pillar: 'teach', base: 66, why: 'One useful thing in under 20 seconds gets saved and shared.' },
  compare: { label: 'This or that', pillar: 'teach', base: 68, why: 'Helps someone choose, and choosing is a buying moment.' },
  price: { label: 'Price talk', pillar: 'offer', base: 66, why: 'Price is the first question every buyer has. Answering it openly builds trust.' },
  process: { label: 'How it is done', pillar: 'proof', base: 66, why: 'Watching the process shows the care and the skill.' },
  local: { label: 'Local call-out', pillar: 'offer', base: 66, why: 'Naming the neighborhood makes the people near you stop.' },
  pov: { label: 'POV', pillar: 'proof', base: 64, why: 'Puts the viewer in the moment after they book you.' },
  bts: { label: 'Behind the scenes', pillar: 'bts', base: 60, why: 'People buy from people. Show yours.' },
  proof: { label: 'Before and after', pillar: 'proof', base: 70, why: 'The fastest proof there is. Use a real job of yours.' },
  objection: { label: 'Objection', pillar: 'offer', base: 64, why: 'Answers the reason people do not book, before they say it.' },
  checklist: { label: 'Save this', pillar: 'teach', base: 62, why: 'Checklists get saved, so people come back to them.' },
  offer: { label: 'The ask', pillar: 'offer', base: 58, why: 'One clear ask, so the people who are ready know what to do.' },
  seasonal: { label: 'Right now', pillar: 'teach', base: 66, why: 'Timely posts feel urgent without a fake deadline.' },
  intro: { label: 'Who I am', pillar: 'bts', base: 60, why: 'People need to know who you are before they book. Pin this one.' },
};

function hookId(s) {
  return `h${text.hash(s).toString(36).slice(0, 7)}`;
}

function mentionsPlace(h, f) {
  const t = h.toLowerCase();
  return !!((f.where && t.includes(f.where.toLowerCase())) || (f.city && t.includes(f.city.toLowerCase())));
}

// Every candidate hook for a member. questions: [{ q, a?, kind, source }] (live or starter).
function candidates(f, questions = []) {
  const n = f.niche;
  const S = f.service;
  const pre = f.vague ? '' : `${S} `; // "car detailing mistakes"; just "mistakes" when we don't know what they sell
  const out = [];
  const add = (format, hook, onScreen, topic, extra = {}) => {
    const h = text.oneLine(hook);
    if (!h || h.length > 150) return;
    out.push({ format, hook: h, onScreen: text.clip(onScreen || h, 56), topic, ...extra });
  };
  const where = f.where;
  const nounPlace = where ? `${where} ${f.buyerNoun}` : '';

  // Real questions (live search first, then the niche's own).
  const perKind = {};
  const varied = questions.filter((x) => {
    const k = x.kind || 'topic';
    perKind[k] = (perKind[k] || 0) + 1;
    return perKind[k] <= (k === 'cost' ? 2 : 3);
  });
  varied.slice(0, 14).forEach((x, i) => {
    const q = end(x.q);
    const a = x.a || answerFor(f, x.q);
    const topic = { type: 'question', q: x.q, a, kind: x.kind };
    const live = x.source === 'google' || x.source === 'youtube';
    if (x.kind === 'cost' && f.priceText && i < 6) add('question', `${q} Mine is ${f.priceText}, and here is what that includes.`, x.q, topic, { live });
    else if (a && i % 3 === 1) add('question', `${q} Short answer: ${lc(noEnd(firstSentence(a)))}.`, x.q, topic, { live });
    else add('question', /\?$/.test(q) ? q : `"${noEnd(q)}": here is what you need to know.`, x.q, topic, { live });
  });

  n.mistakes.forEach((m, i) => {
    const topic = { type: 'mistake', item: m, all: n.mistakes };
    add('mistake', [`Stop ${lc(noEnd(m.m))}.`, `${noEnd(m.m)}? ${m.why}`, `If you are ${lc(noEnd(m.m))}, watch this.`][i % 3], `Stop ${lc(noEnd(m.m))}`, topic);
  });
  add('mistake', `${n.mistakes.length} ${f.vague ? 'mistakes buyers make' : `${S} mistakes`}, and what to do instead.`, `${n.mistakes.length} ${pre}mistakes`, { type: 'mistakes', items: n.mistakes });

  n.myths.forEach((m, i) => {
    const topic = { type: 'myth', item: m, all: n.myths };
    add('myth', [`"${noEnd(m.myth)}." Not true.`, `Myth: ${lc(noEnd(m.myth))}. Here is the truth.`, `Everyone says ${lc(noEnd(m.myth))}. Here is what actually happens.`][i % 3], `Myth: ${lc(noEnd(m.myth))}`, topic);
  });

  add('signs', `${n.signs.length} ${n.signsTitle}.`, `${n.signs.length} ${n.signsTitle}`, { type: 'signs', items: n.signs, title: n.signsTitle });
  add('signs', `${end(n.signs[0]).replace(/\.$/, '?')} Here is what that means.`, n.signs[0], { type: 'signs', items: n.signs, title: n.signsTitle });

  n.tips.forEach((t, i) => {
    const topic = { type: 'tip', item: t, all: n.tips };
    add('tip', [`${end(t.tip)} Here is why.`, `One ${pre}tip worth saving: ${lc(noEnd(t.tip))}.`][i % 2], `Tip: ${lc(noEnd(t.tip))}`, topic);
  });

  n.compare.forEach((c, i) => {
    const topic = { type: 'compare', item: c };
    add('compare', [`${sc(c.a)} or ${c.b}? Here is how to pick.`, `${sc(c.a)} vs ${c.b}: what is the difference?`][i % 2], `${sc(c.a)} vs ${c.b}`, topic);
  });

  if (f.priceText) {
    const topic = { type: 'price' };
    add('price', `Why ${withA(f.short)} from me costs ${f.priceText}.`, `Why it costs ${f.priceText}`, topic);
    if (f.offer) add('price', `${f.priceText} for ${lc(noEnd(f.offer))}. Here is everything you get.`, `What ${f.priceText} gets you`, topic);
    if (where && !f.vague) add('price', `What ${S} costs in ${where}, and what you should get for it.`, `${sc(S)} prices in ${where}`, topic);
  } else {
    add('price', `How ${f.pro}s price ${withA(f.short)}, and what to look for.`, `How ${withA(f.short)} is priced`, { type: 'price' });
  }

  add('process', `What happens in ${withA(f.short)}${f.name ? ` with ${f.name}` : ''}, step by step.`, `${sc(withA(f.short))}, start to finish`, { type: 'process', items: n.process });
  add('process', `The ${n.process.length} steps of a proper ${f.short}.`, `The ${n.process.length} steps of a proper ${f.short}`, { type: 'process', items: n.process });

  if (where) {
    n.pains.forEach((p, i) => {
      const topic = { type: 'local', pain: p };
      if (i === 0) add('local', `${nounPlace}: if ${p}, this is for you.`, `${where} ${f.buyerNoun}, this is for you`, topic);
      if (i === 1) add('local', `If you live in ${where} and ${p}, watch this.`, `${where}: watch this`, topic);
    });
    if (f.mobile && !f.vague) add('local', `${S.charAt(0).toUpperCase() + S.slice(1)} that comes to you, anywhere in ${where}.`, `I come to you in ${where}`, { type: 'local', pain: n.pains[1] || n.pains[0] });
  }

  add('pov', n.pov, n.pov.replace(/^POV:\s*/i, 'POV: '), { type: 'pov' });

  n.bts.slice(0, 3).forEach((b) => add('bts', `Here is ${b}.`, sc(b), { type: 'bts', item: b }));

  add('proof', `This ${f.thing} in [neighborhood] had [the problem]. Watch.`, 'Before and after', { type: 'proof', items: n.proof }, { fill: true });
  add('proof', `${where ? `${where} ${f.thing}` : n.key === 'generic' ? `This ${f.thing}` : sc(f.thing)}, before and after. Wait for the last shot.`, 'Wait for the last shot', { type: 'proof', items: n.proof });

  n.objections.slice(0, 2).forEach((o, i) => {
    const topic = { type: 'objection', item: o };
    add('objection', [`"${noEnd(o.o)}." Fair. Here is my answer.`, `Thinking "${lc(noEnd(o.o))}"? Watch this first.`][i % 2], `"${noEnd(o.o)}"`, topic);
  });

  add('checklist', `Save this before your next ${f.short}.`, `Save this ${pre}checklist`, { type: 'checklist', items: n.tips.map((t) => t.tip) });
  add('checklist', `The ${pre}checklist I would give a friend.`, `The ${pre}checklist`, { type: 'checklist', items: n.tips.map((t) => t.tip) });

  add('offer', f.ctaLine, `Comment ${f.keyword}`, { type: 'offer' });
  if (where && !f.vague) add('offer', `I do ${S} in ${where}. ${f.ctaLine}`, `${sc(S)} in ${where}`, { type: 'offer' });
  if (f.mobile && f.offer) add('offer', `I come to you: ${lc(noEnd(f.offer))}. ${f.ctaLine}`, 'I come to you', { type: 'offer' });

  for (const s of n.seasonal || []) {
    const now = s.months.includes(f.month);
    const next = s.months.includes((f.month % 12) + 1);
    if (now || next) add('seasonal', s.hook, s.hook, { type: 'seasonal', item: s }, { inSeason: now });
  }

  if (f.intro) add('intro', `${f.intro} Here is what I do and who it is for.`, f.first ? `Hi, I'm ${f.first}` : f.name, { type: 'intro' });
  return out;
}

function score(h, f) {
  const fm = FORMATS[h.format] || { base: 50 };
  let s = fm.base;
  if (h.live) s += 10;
  if (mentionsPlace(h.hook, f)) s += 6;
  if (f.priceText && h.hook.includes(f.priceText)) s += 4;
  if (h.fill) s -= 6;
  if (h.inSeason) s += 6;
  if (h.hook.length > 110) s -= 4;
  s += (text.hash(h.hook) % 5) - 2; // stable tie-breaker so different businesses get different orders
  return Math.max(1, Math.min(99, s));
}

// The best `count` hooks with variety: at most `perFormat` of one format, every pillar present.
function rankHooks(f, questions, { count = 30, perFormat = 4 } = {}) {
  const all = candidates(f, questions).map((h) => {
    const fm = FORMATS[h.format];
    return { id: hookId(h.hook), ...h, formatLabel: fm.label, pillar: fm.pillar, why: fm.why, score: score(h, f) };
  });
  const seen = new Set();
  const uniq = all.filter((h) => {
    const k = h.hook.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  uniq.sort((a, b) => b.score - a.score);
  const live = uniq.filter((h) => h.live).length;
  const cap = (fmt) => (fmt === 'question' ? Math.max(perFormat, Math.min(8, live)) : perFormat);
  const picked = [];
  const per = {};
  // First pass: the best two from each pillar, so the mix is there even in a short list.
  for (const p of PILLARS) {
    for (const h of uniq.filter((x) => x.pillar === p.key).slice(0, 2)) {
      if (picked.length < count) {
        picked.push(h);
        per[h.format] = (per[h.format] || 0) + 1;
      }
    }
  }
  for (const h of uniq) {
    if (picked.length >= count) break;
    if (picked.includes(h)) continue;
    if ((per[h.format] || 0) >= cap(h.format)) continue;
    picked.push(h);
    per[h.format] = (per[h.format] || 0) + 1;
  }
  for (const h of uniq) {
    if (picked.length >= count) break;
    if (!picked.includes(h)) picked.push(h);
  }
  return picked.sort((a, b) => b.score - a.score).map((h, i) => ({ rank: i + 1, ...h }));
}

// Hooks the member wrote themselves ("one per line") join the list on top, as format "yours".
function ownHooks(lines) {
  return String(lines || '')
    .split(/\r?\n/)
    .map((l) => text.oneLine(l.replace(/^\s*[-*\d.)]+\s*/, '')))
    .filter((l) => l.length >= 8)
    .slice(0, 10)
    .map((h) => ({ id: hookId(h), format: 'yours', formatLabel: 'Yours', pillar: 'teach', hook: h, onScreen: text.clip(h, 48), why: 'Your own idea, scripted with your facts.', score: 90, topic: { type: 'own' } }));
}

// Does an AI hook list sound like this business? At least half name the service, thing or place.
function specificEnough(hooks, f) {
  const words = [f.service, f.thing, f.where, f.city, f.short, f.keyword].filter(Boolean).map((w) => w.toLowerCase());
  const hits = hooks.filter((h) => words.some((w) => String(h.hook || '').toLowerCase().includes(w))).length;
  return hits >= Math.ceil(hooks.length / 2);
}

module.exports = { PILLARS, FORMATS, candidates, rankHooks, ownHooks, specificEnough, hookId, mentionsPlace };
