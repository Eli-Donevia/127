// Find stock footage: free Pexels video clips for a few searches, in the shape of your video, with
// each creator's name for the credit. When stock footage isn't switched on, it says so and gives the
// same searches as Pexels links, so you can pick clips by hand. Nothing is downloaded here.

const { views, text } = require('../../_kit');
const { pexels } = require('../lib/providers');

const ORIENT = { vertical: 'portrait', square: 'square', wide: 'landscape' };

function searchLink(q, shape) {
  const o = ORIENT[shape] || 'portrait';
  return `https://www.pexels.com/search/videos/${encodeURIComponent(String(q).trim().toLowerCase())}/?orientation=${o}`;
}

// "Saturn's rings, Cassini" -> ['saturn rings', 'cassini']; up to 6 searches, 2 to 4 words each.
function searchesOf(input) {
  const raw = [].concat(input.queries || [], input.query || []).flatMap((q) => String(q).split(/[,;\n]/));
  const out = [];
  for (const q of raw) {
    const s = text.oneLine(q.replace(/['’]s\b/g, '').replace(/[^\p{L}\p{N}\s-]/gu, ' ')).toLowerCase().split(/\s+/).slice(0, 4).join(' ');
    if (s.length >= 3 && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 6);
}

module.exports = {
  name: 'video.stock',
  title: 'Find stock footage',
  description: 'Finds free Pexels video clips for your searches, in the shape of your video, with each creator named for the credit. When stock footage is off, it gives you the same searches as Pexels links to pick clips yourself.',
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['pexels'],
  credits: 1,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      query: { type: 'string', title: 'What to search for', description: 'A few words, or several searches separated by commas', maxLength: 160 },
      queries: { type: 'array', title: 'Searches', items: { type: 'string', maxLength: 60 }, maxItems: 6 },
      shape: { type: 'string', title: 'Shape', enum: ['vertical', 'square', 'wide'], default: 'vertical' },
      count: { type: 'integer', title: 'Clips to find', minimum: 1, maximum: 12, default: 6 },
    },
  },
  output: {
    type: 'object',
    properties: {
      clips: { type: 'array' },
      searches: { type: 'array' },
      links: { type: 'array' },
      live: { type: 'boolean' },
      note: { type: 'string' },
    },
    required: ['clips', 'searches', 'live'],
  },
  async run(input, ctx) {
    const searches = searchesOf(input);
    if (!searches.length) throw new Error('Add a few words to search for, like "night sky" or "coffee pouring".');
    const shape = input.shape || 'vertical';
    const count = Math.max(1, Math.min(12, Number(input.count) || 6));
    const links = searches.map((q) => ({ search: q, url: searchLink(q, shape) }));
    let key = null;
    try {
      key = ctx.secret('pexels');
    } catch {
      key = null;
    }
    if (!key) {
      ctx.log('Stock footage is off here, so these are searches to open on Pexels');
      return { clips: [], searches, links, live: false, note: 'Stock footage is not switched on here yet, so the video uses moving color backgrounds. To add footage yourself: open a search below, download clips you like (Pexels clips are free to use), and put them under the voice in your editor.' };
    }
    const clips = [];
    const seen = new Set();
    const per = Math.max(1, Math.ceil(count / searches.length));
    for (const q of searches) {
      try {
        const found = await pexels(ctx, key, q, { orientation: ORIENT[shape] || 'portrait', count: per + 1, minSeconds: 4 });
        for (const c of found) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          clips.push({ ...c, search: q });
          if (clips.filter((x) => x.search === q).length >= per) break;
        }
      } catch (e) {
        ctx.log(`Pexels search "${q}" skipped: ${String(e.message).slice(0, 80)}`);
      }
      if (clips.length >= count) break;
    }
    ctx.log(`${clips.length} clips found on Pexels for ${searches.length} searches`);
    return {
      clips: clips.slice(0, count),
      searches,
      links,
      live: true,
      note: clips.length ? 'Pexels clips are free to use. Credit each creator in your description, like "Video by Name on Pexels", with a link to pexels.com.' : 'Pexels found nothing usable for these searches. Try simpler words, like "ocean" or "city at night".',
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Stock clips', out.clips.length, out.live ? 'From Pexels, free to use' : 'Stock footage is off here'),
      out.note ? views.text(out.note) : null,
      out.clips.length
        ? views.table(
            [
              { key: 'search', label: 'Search' },
              { key: 'seconds', label: 'Seconds', format: 'number' },
              { key: 'by', label: 'Video by' },
              { key: 'page', label: 'On Pexels', format: 'link' },
            ],
            out.clips.map((c) => ({ search: c.search, seconds: Math.round(c.duration), by: c.by, page: c.page })),
          )
        : views.table([{ key: 'search', label: 'Search' }, { key: 'url', label: 'Open on Pexels', format: 'link' }], out.links),
    );
  },
};

module.exports.searchesOf = searchesOf;
module.exports.searchLink = searchLink;
