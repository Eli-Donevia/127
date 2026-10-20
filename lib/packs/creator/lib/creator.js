// The creator's facts and the pieces every creator tool shares: niche data, who they are, their
// content pillars (typed, else remembered from the pillars workflow, else five plain defaults).

const path = require('path');
const { text, brain } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;
const N = C.load(path.join(__dirname, '..'));
const RULES = require('../data/rules.json');

function me(ctx, input = {}) {
  const br = brain.brainOf(ctx, input);
  const mem = brain.packMemory(ctx, 'creator');
  const handle = plain(input.handle || (br.instagram ? `@${br.instagram}` : br.tiktok ? `@${br.tiktok}` : '')).replace(/^([^@])/, '@$1');
  const link = /^https:\/\//.test(String(input.link || '')) ? String(input.link) : /^https:\/\//.test(br.website) ? br.website : '';
  return {
    first: br.firstName || '',
    name: plain(input.name || br.name || br.firstName || ''),
    niche: plain(input.niche || mem.niche || br.niche || br.what || 'my topic'),
    audience: plain(input.audience || mem.audience || br.audience || ''),
    handle: handle === '@' ? '' : handle,
    link,
    city: plain(input.city || br.place || ''),
    email: plain(input.email || ''),
  };
}

// Five plain pillars anyone can post from. A pillar is a kind of post, named for the creator's topic.
const DEFAULT_PILLARS = [
  { name: 'Teach', what: 'one useful how-to about {niche}', formats: ['Reel', 'Carousel'] },
  { name: 'Show', what: 'your process, tools and setup behind the scenes', formats: ['Reel', 'Story'] },
  { name: 'Story', what: 'a moment, mistake or lesson from your own {niche} journey', formats: ['Reel', 'Post'] },
  { name: 'Answer', what: 'a question someone asked you about {niche}', formats: ['Reel', 'Carousel'] },
  { name: 'Share', what: 'something you use, read or recommend, and why', formats: ['Story', 'Post'] },
];

function pillarsOf(ctx, input, niche) {
  const typed = C.linesOf(input.pillars, 6).map((l) => {
    const [name, ...rest] = l.split(/\s*[:|-]\s*/);
    return { name: plain(name).slice(0, 40), what: plain(rest.join(' ') || name), formats: ['Reel', 'Carousel'] };
  });
  if (typed.length) return { pillars: typed, from: 'typed' };
  const mem = brain.packMemory(ctx, 'creator');
  if (Array.isArray(mem.pillars) && mem.pillars.length) return { pillars: mem.pillars.map((p) => ({ formats: ['Reel', 'Carousel'], ...p })), from: 'remembered' };
  return { pillars: DEFAULT_PILLARS.map((p) => ({ ...p, what: p.what.replace('{niche}', niche) })), from: 'default' };
}

module.exports = { N, RULES, me, pillarsOf, DEFAULT_PILLARS, C };
