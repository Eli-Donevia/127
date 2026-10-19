// Content pillars named for the member's own business: the five themes every plan in this pack
// rotates through (teach, mistakes and myths, proof, behind the scenes, the offer), what each one is
// for, how often it comes up at the member's posting pace, and ready ideas for each from real
// searches, the niche notes and the member's own topics. The rhythm is the same one
// content.plan_week uses (give, give, give, ask), so a plan made later matches this page.

const { text } = require('../../_kit');
const { PILLARS, rankHooks, hookId } = require('./hooks');
const { CYCLE, DAYS } = require('./plan');
const { lowerFirst, askFor } = require('./niches');

const lc = lowerFirst;
const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Why each pillar earns its place, in the member's terms.
const WHY = {
  teach: 'Buyers ask the same questions before they book. Answer one on video and it keeps working for months.',
  myths: 'Clearing up a mistake or a myth shows you know the work, without bragging.',
  proof: 'Real jobs say more than any claim. Use your own photos and videos, with the customer\'s OK.',
  bts: 'People book people. Your setup, your day and your care make you the obvious choice.',
  offer: 'One clear ask, so the people who are ready know exactly what to do.',
};

// The pillar names, in the member's words.
function namesFor(f) {
  const S = sc(f.service || 'your service');
  const short = f.short || 'job';
  return {
    teach: f.vague ? 'Questions buyers ask, answered' : `${S} questions, answered`,
    myths: f.vague ? 'Mistakes and myths' : `${S} mistakes and myths`,
    proof: f.local && f.where ? `Real jobs in ${f.where}` : 'Real work, start to finish',
    bts: f.name ? `Behind the scenes at ${f.name}` : f.vague ? 'A day on the job' : `A day doing ${lc(f.service || 'the work')}`,
    offer: `${askFor(short)}${f.priceText ? `, ${f.priceText}` : ''}`,
  };
}

// How many posts of each pillar in the first 4 weeks at this pace, from the plan's own rhythm.
function rhythm(perWeek) {
  const per = Math.max(1, Math.min(7, Math.round(perWeek) || 5));
  const total = per * 4;
  const count = Object.fromEntries(PILLARS.map((p) => [p.key, 0]));
  for (let i = 0; i < total; i++) count[CYCLE[i % CYCLE.length]] += 1;
  const days = DAYS[per].map((d) => WEEKDAYS[d]);
  const weeks = [0, 1].map((w) => days.map((day, j) => ({ day, pillar: CYCLE[(w * per + j) % CYCLE.length] })));
  return { per, total, count, days, weeks };
}

// "2 a week (8 in 4 weeks)", "about 1 a week (5 in 4 weeks)", "about 1 every 2 weeks (2 in 4 weeks)"
function howOften(n4) {
  const w = n4 / 4;
  const of4 = ` (${n4} in 4 weeks)`;
  if (n4 === 0) return 'not in the first 4 weeks';
  if (Number.isInteger(w)) return `${w} a week${of4}`;
  if (w >= 0.75) return `about ${Math.round(w)} a week${of4}`;
  if (w >= 0.4) return `about 1 every 2 weeks${of4}`;
  return `about 1 a month${of4}`;
}

// The member's own topics ("ceramic coating", "pet hair"), one idea for each pillar.
function topicIdeas(f, topics) {
  return topics.map((raw) => {
    const t = lc(noEnd(text.oneLine(raw)));
    const T = sc(t);
    return {
      topic: T,
      ideas: {
        teach: `Everything people ask about ${t}, answered in under a minute.`,
        myths: `${T}: the myth people believe, and what is true.`,
        proof: `${T}, before and after. Wait for the last shot.`,
        bts: `Behind the scenes: how I handle ${t}.`,
        offer: `Want help with ${t}? ${f.ctaLine}`,
      },
    };
  });
}

function cleanTopics(s) {
  const seen = new Set();
  return String(s || '')
    .split(/\r?\n|,/)
    .map((l) => text.oneLine(l.replace(/^\s*[-*\d.)]+\s*/, '')))
    .filter((l) => l.length >= 3 && l.length <= 60 && text.copyProblems(l).length === 0)
    .filter((l) => (seen.has(l.toLowerCase()) ? false : seen.add(l.toLowerCase())))
    .slice(0, 6);
}

// Everything the page and the CSV need.
function buildPillars(f, questions = [], { perWeek = 5, topics = '', perPillar = 6 } = {}) {
  const names = namesFor(f);
  const r = rhythm(perWeek);
  const hooks = rankHooks(f, questions, { count: 40 }).filter((h) => !h.fill);
  const pillars = PILLARS.map((p) => {
    const ideas = hooks
      .filter((h) => h.pillar === p.key)
      .slice(0, perPillar)
      .map((h) => ({ id: h.id, idea: h.hook, onScreen: h.onScreen, format: h.format === 'question' && !h.live ? 'Common question' : h.formatLabel, source: h.live ? 'Real search' : 'Idea for your kind of business' }));
    return { key: p.key, name: names[p.key], theme: p.name, what: p.what, why: p.key === 'offer' ? `${WHY.offer} ${f.ctaLine}` : WHY[p.key], posts4: r.count[p.key], often: howOften(r.count[p.key]), ideas };
  });
  const own = topicIdeas(f, cleanTopics(topics));
  for (const t of own) {
    for (const p of pillars) {
      const idea = t.ideas[p.key];
      if (idea && !p.ideas.some((x) => x.idea === idea)) p.ideas.push({ id: hookId(idea), idea, onScreen: text.clip(noEnd(idea), 48), format: 'Your topic', source: `Your topic: ${t.topic}`, topic: t.topic });
    }
  }
  return {
    pillars,
    rhythm: { perWeek: r.per, days: r.days, weeks: r.weeks.map((w) => w.map((x) => ({ day: x.day, pillar: x.pillar, name: names[x.pillar] }))) },
    topics: own.map((t) => t.topic),
    ideas: pillars.reduce((n, p) => n + p.ideas.length, 0),
    live: hooks.filter((h) => h.live).length,
  };
}

module.exports = { buildPillars, namesFor, rhythm, howOften, cleanTopics, WHY };
