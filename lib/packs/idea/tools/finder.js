// Idea finder: matches the member's skills, hours, budget and area to the business packs in this
// library (data/packs.json, built from each pack's data/niche.json plus our fit facts), and says
// which pack to open next. A match on what they told us, never a forecast: it doesn't say any idea
// will work or what it could earn. Code only, no AI.

const { views, text, brain } = require('../../_kit');
const DATA = require('../data/packs.json');
const FIT = require('../data/fit.json');

const { plain } = text;
const SKILLS = Object.keys(FIT.skills);
const BUDGETS = { under_200: 'low', '200_1000': 'medium', over_1000: 'high' };
const RANK = { low: 0, medium: 1, high: 2 };
const SPEED = { fast: 2, 'fast in season': 1.5, medium: 1, slow: 0 };

// Words in "what you like" that point at a skill.
const WORDS = {
  hands: ['fix', 'build', 'repair', 'tools', 'hands'],
  outdoors: ['outside', 'outdoors', 'yard', 'garden'],
  driving: ['drive', 'driving', 'truck', 'car'],
  people: ['people', 'talk', 'help', 'neighbors'],
  teaching: ['teach', 'explain', 'tutor', 'coach'],
  writing: ['write', 'writing', 'words', 'blog'],
  camera: ['photo', 'video', 'film', 'camera', 'edit'],
  on_camera: ['on camera', 'tiktok', 'youtube', 'instagram'],
  design: ['design', 'canva', 'pretty', 'art'],
  tech: ['computer', 'tech', 'phones', 'apps', 'website'],
  selling: ['sell', 'sales', 'deal'],
  cooking: ['cook', 'bake', 'food', 'meal'],
  animals: ['dog', 'cat', 'pet', 'animal'],
  music: ['music', 'guitar', 'piano', 'sing'],
  organizing: ['organize', 'plan', 'tidy', 'events'],
  fitness: ['fitness', 'gym', 'workout', 'run'],
  making: ['make', 'craft', 'handmade', 'sew', 'candle'],
};

function skillsFrom(input) {
  const picked = new Set((Array.isArray(input.skills) ? input.skills : String(input.skills || '').split(/[,\n]/)).map((s) => String(s).trim()).filter((s) => SKILLS.includes(s)));
  const likes = String(input.likes || '').toLowerCase();
  for (const [k, ws] of Object.entries(WORDS)) if (ws.some((w) => new RegExp(`\\b${w}`).test(likes))) picked.add(k);
  return [...picked];
}

function score(p, want) {
  const f = p.fit;
  const why = [];
  const watch = [];
  let s = 0;
  const match = f.skills.filter((k) => want.skills.includes(k));
  s += match.length * 3;
  if (match.length) why.push(`Uses what you said you're good at: ${match.map((k) => FIT.skills[k].toLowerCase()).join(', ')}.`);
  if (RANK[f.start] <= RANK[want.budget]) {
    s += 2;
    why.push(`Fits your budget to start (${f.start === 'low' ? 'under $200' : f.start === 'medium' ? '$200 to $1,000' : 'over $1,000'}, our rough estimate).`);
  } else {
    s -= 4;
    watch.push(`Usually costs more to start than your budget (${f.start === 'medium' ? '$200 to $1,000' : 'over $1,000'}).`);
  }
  if (f.hours <= want.hours) s += 1;
  else {
    s -= 2;
    watch.push(`A first test takes about ${f.hours} hours a week; you said ${want.hours}.`);
  }
  if (f.vehicle && !want.vehicle) {
    s -= 4;
    watch.push('Needs a car to get to jobs.');
  }
  if (want.online && !f.online) {
    s -= 3;
    watch.push('This one is done in person, near you.');
  }
  const sc = p.crowd.scores || {};
  const crowdPts = ((sc.pain || 3) + (sc.can_pay || 3) + (sc.findable || 3)) / 3;
  s += crowdPts - 3;
  const speed = SPEED[String(p.crowd.first_dollar || '').toLowerCase()];
  if (speed != null) s += speed * 0.5;
  if (p.crowd.buyer) why.push(`Who buys: ${p.crowd.buyer}.`);
  if (p.crowd.first_dollar) why.push(`Time to a first paying customer, in our judgment: ${String(p.crowd.first_dollar).toLowerCase()}.`);
  return { s: Math.round(s * 10) / 10, why, watch, match: match.length };
}

module.exports = {
  name: 'idea.find_ideas',
  title: 'Find ideas that fit you',
  description: 'Matches your skills, hours, budget and area to the business types in 127 and says which one to open next. A match on what you told us, not a forecast.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      skills: { type: 'array', items: { type: 'string', enum: SKILLS }, title: 'What you are good at', description: SKILLS.map((k) => `${k}: ${FIT.skills[k]}`).join('; ') },
      likes: { type: 'string', maxLength: 300, title: 'What you like doing, in your words (optional)' },
      hours: { type: 'integer', minimum: 1, maximum: 60, default: 8, title: 'Hours a week you can give it' },
      budget: { type: 'string', enum: Object.keys(BUDGETS), default: 'under_200', title: 'Money you can put in to start', description: 'under_200, 200_1000 or over_1000 (dollars)' },
      area: { type: 'string', enum: ['local', 'online', 'either'], default: 'either', title: 'Near you, online, or either' },
      vehicle: { type: 'boolean', default: false, title: 'You have a car you can use for work' },
    },
  },
  output: { type: 'object', required: ['matches', 'next'], properties: { skills: { type: 'array' }, matches: { type: 'array' }, next: { type: ['object', 'null'] }, also: { type: 'array' }, note: { type: 'string' }, packs: { type: 'integer' } } },
  async run(input, ctx) {
    const want = {
      skills: skillsFrom(input),
      hours: Math.max(1, Number(input.hours) || 8),
      budget: BUDGETS[input.budget] || 'low',
      online: input.area === 'online',
      vehicle: input.vehicle === true,
    };
    const ranked = DATA.packs
      .map((p) => ({ p, r: score(p, want) }))
      .sort((a, b) => b.r.s - a.r.s || b.r.match - a.r.match || a.p.id.localeCompare(b.p.id));
    const matches = ranked.slice(0, 5).map(({ p, r }, i) => ({
      rank: i + 1,
      pack: p.id,
      title: p.title,
      open: p.first,
      opening_soon: p.held,
      why: r.why.join(' '),
      watch: r.watch.join(' ') || null,
      fit: r.s,
    }));
    const open = matches.find((x) => !x.opening_soon) || null;
    const next = open ? { pack: open.pack, title: open.title, workflow: open.open, line: `Open ${open.title} and run Your first 25 to test it with real people. Or, if you'd rather test your own idea, run Your first 25 conversations here.` } : null;
    if (input.likes) await brain.remember(ctx, 'likes', plain(input.likes).slice(0, 300));
    return {
      skills: want.skills,
      matches,
      next,
      also: ranked.slice(5, 10).map(({ p }) => p.title),
      note: 'A match on what you told us, not a forecast. No one can tell ahead of time whether people will buy: the first 25 conversations are how you find out.',
      packs: DATA.packs.length,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Ideas that fit you', out.next ? out.next.title : 'No match yet', out.next ? out.next.line : 'Pick a few skills and try again.'),
      views.table([{ key: 'rank', label: '#' }, { key: 'title', label: 'Business' }, { key: 'why', label: 'Why it fits' }, { key: 'watch', label: 'Watch for' }], out.matches.map((m) => ({ ...m, title: m.opening_soon ? `${m.title} (opening soon)` : m.title, watch: m.watch || '' }))),
      out.also.length ? views.text(`Also close: ${out.also.join(', ')}.`) : null,
      views.text(out.note),
    );
  },
};
