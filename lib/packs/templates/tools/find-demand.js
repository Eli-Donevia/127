// 25 buyer searches for digital templates, ranked by public demand: how many listings Gumroad shows
// and how many buyers rated the most-rated products that match the search. Live from Gumroad
// Discover when it answers, otherwise the dated snapshot in data/demand.json. Opens with the crowd
// card: templates are a crowded, slow market, and the member should know that first.

const { views, save, files, web, crowd, time } = require('../../_kit');
const NICHE = require('../data/niche.json');
const T = require('../lib/tpl');

function dec(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// One search re-read from Gumroad Discover (sorted by most reviewed), counted the same way as the
// snapshot (T.summarize). Cached 24 hours for everyone; robots.txt respected.
async function liveSearch(ctx, s) {
  const url = s.url || T.checkLinks(s.search).gumroad;
  if (!(await web.allowed(ctx, url))) return null;
  return web.cached(ctx, `templates:gumroad2:${s.search}`, 24, async () => {
    const r = await web.getText(ctx, url, { timeoutMs: 12000, maxBytes: 4e6, headers: { Accept: 'text/html' } });
    const m = r && r.text && r.text.match(/data-page="([^"]+)"/);
    if (!m) return null;
    const sr = (JSON.parse(dec(m[1])).props || {}).search_results;
    if (!sr || !Array.isArray(sr.products)) return null;
    return { ...s, ...T.summarize(s.search, sr.products, sr.total), url, checked: time.today(ctx), live: true };
  });
}

// Re-reads a list of searches live (2 at a time). Returns { list, live }.
async function refresh(ctx, list, { live = true } = {}) {
  if (!live) return { list, live: 0 };
  let n = 0;
  const fresh = await web.mapLimit(list, 2, async (s) => liveSearch(ctx, s).catch(() => null), ctx);
  return { list: list.map((s, i) => (fresh[i] ? (n++, fresh[i]) : s)), live: n };
}

function csvOf(rows) {
  return files.csv(
    rows.map((r) => {
      const l = T.checkLinks(r.search);
      return { rank: r.rank, search: r.search, listings: r.listings, top_ratings: r.top_ratings, start_price: r.price, makeable: r.makeable ? T.specOf(r.kind).title : 'no', gumroad: l.gumroad, etsy: l.etsy, pinterest: l.pinterest, checked: r.checked };
    }),
    [
      { key: 'rank', label: 'Rank' },
      { key: 'search', label: 'Buyers search for' },
      { key: 'listings', label: 'Gumroad listings' },
      { key: 'top_ratings', label: 'Ratings on the top match' },
      { key: 'start_price', label: 'Starting price ($)' },
      { key: 'makeable', label: 'We make it as' },
      { key: 'gumroad', label: 'Check on Gumroad' },
      { key: 'etsy', label: 'Check on Etsy' },
      { key: 'pinterest', label: 'Check on Pinterest' },
      { key: 'checked', label: 'Read on' },
    ],
    { bom: true },
  );
}

module.exports = {
  name: 'templates.find_demand',
  title: 'Find 25 buyer searches',
  description: 'Ranks 25 searches buyers make for digital templates by public demand on Gumroad (listings and buyer ratings on matching products), marks the ones this pack can make, suggests a starting price from what matching products charge, and opens with an honest crowd check.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 180,
  input: { type: 'object', properties: { idea: { type: 'string', title: 'A template idea of your own (optional)', maxLength: 80 }, live: { type: 'boolean', default: true } } },
  output: { type: 'object', properties: { card: { type: 'object' }, searches: { type: 'array' }, makeable: { type: 'array' }, best: { type: ['object', 'null'] }, idea: { type: ['object', 'null'] }, csv: { type: 'object' }, live: { type: 'integer' }, total: { type: 'integer' }, checked: { type: 'string' } }, required: ['searches'] },
  async run(input, ctx) {
    const month = time.partsIn(time.nowMs(ctx), time.tzOf(ctx)).m;
    const card = crowd.card(NICHE.crowd, { month, title: 'Digital templates: is this a good crowd?' });
    let list = T.DEMAND.searches.map((s) => ({ ...s }));
    // The member's own idea is checked the same way, when it reads like a search.
    const own = String(input.idea || '').trim().toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (own && !list.some((s) => s.search === own)) {
      const kind = Object.keys(T.SPECS).find((k) => T.keywords(T.SPECS[k].title).some((w) => T.keywords(own).includes(w))) || null;
      list.push({ search: own, kind, listings: 0, top_ratings: [], paid_prices: [], url: T.checkLinks(own).gumroad, own: true });
    }
    const got = await refresh(ctx, list, { live: input.live !== false });
    list = got.list;
    let rows = T.rankSearches(list);
    const idea = own ? rows.find((r) => r.search === own) || null : null;
    rows = rows.slice(0, 25);
    if (idea && !rows.includes(idea)) rows = [...rows.slice(0, 24), idea];
    // Five different templates to choose from: the best search for each.
    const makeable = rows.filter((r, i) => r.makeable && rows.findIndex((x) => x.kind === r.kind) === i).slice(0, 5);
    const csv = await save.saveFile(ctx, 'first-25-template-searches.csv', csvOf(rows));
    ctx.log(`${rows.length} searches ranked, ${got.live} read live from Gumroad`);
    return { card, searches: rows, makeable, best: makeable[0] || null, idea, csv, live: got.live, total: list.length, checked: got.live ? time.today(ctx) : T.DEMAND.checked };
  },
  view(out) {
    return views.blocks(
      out.card ? crowd.blocks(out.card) : null,
      views.metric('Searches ranked', out.searches.length),
      out.live ? views.metric('Read live from Gumroad today', `${out.live} of ${out.total || out.live} searches`) : views.metric('Gumroad numbers', `As read on ${out.checked}`, 'Gumroad did not answer just now, so this uses the last reading'),
      out.idea ? views.text(`Your idea, "${out.idea.search}": ${out.idea.evidence}. ${out.idea.makeable ? out.idea.detail : 'This pack can not build it yet, so pick one of the five below or make it in your own tool.'}`) : null,
      views.table(
        [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'search', label: 'Buyers search for' },
          { key: 'listings', label: 'Listings', format: 'number' },
          { key: 'top_ratings', label: 'Ratings on the top match', format: 'number' },
          { key: 'make', label: 'We make it as' },
        ],
        out.searches.map((s) => ({ rank: s.rank, search: s.search, listings: s.listings, top_ratings: s.top_ratings, make: s.makeable ? T.specOf(s.kind).title : 'No' })),
      ),
      views.text('Ratings come from buyers, so they show what people paid for and used. The file has Etsy and Pinterest links for each search: look there too before you choose.'),
      views.file(out.csv, 'All 25 searches with links to check them (.csv)'),
    );
  },
  refresh,
  csvOf,
};
