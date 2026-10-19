// Your next product: 25 template ideas ranked by demand signals you can check yourself (how many
// listings Gumroad shows for the search and how many buyers rated the most-rated matching
// products), leaving out what you already made and favoring what fits your shop. Each idea links
// to the same search on Gumroad, Etsy, Pinterest and Google Trends. No sales numbers: Gumroad and
// Etsy don't publish them, so none are shown or guessed.

const { views, save, files, brain, time } = require('../../_kit');
const T = require('../lib/tpl');
const FD = require('./find-demand');

// Which themes fit this shop: from the templates already made, else from what the brain says it sells.
const THEME_WORDS = {
  money: /\b(budget|money|bill|debt|saving|finance|financial|paycheck|expense)/i,
  home: /\b(home|house|clean|meal|chore|family|mom|parent|kitchen)/i,
  health: /\b(habit|fitness|workout|gym|health|wellness|reading|self care)/i,
  business: /\b(small business|bookkeep|inventory|etsy seller|shop owner|content|mileage)/i,
  school: /\b(student|school|teacher|homeschool|lesson|study|college)/i,
  life: /\b(wedding|travel|trip|year|goal|holiday|christmas)/i,
};

function shopThemes(ctx, made) {
  const fromMade = new Set(made.map((k) => T.themeOf(k)));
  if (fromMade.size) return fromMade;
  const b = brain.brainOf(ctx);
  const words = [b.what, b.niche, b.offer, b.audience].filter(Boolean).join(' ');
  return new Set(Object.keys(THEME_WORDS).filter((t) => THEME_WORDS[t].test(words)));
}

function csvOf(rows) {
  return files.csv(
    rows.map((r) => {
      const l = T.checkLinks(r.search);
      return { rank: r.rank, search: r.search, listings: r.listings, top: r.top_ratings, price: r.price, fits: r.fits ? 'yes' : '', make: r.makeable ? T.specOf(r.kind).title : 'Needs design tools', gumroad: l.gumroad, etsy: l.etsy, pinterest: l.pinterest, trends: l.trends, checked: r.checked };
    }),
    [
      { key: 'rank', label: 'Rank' },
      { key: 'search', label: 'Buyers search for' },
      { key: 'listings', label: 'Gumroad listings' },
      { key: 'top', label: 'Ratings on the top match' },
      { key: 'price', label: 'Starting price ($)' },
      { key: 'fits', label: 'Fits your shop' },
      { key: 'make', label: 'We make it as' },
      { key: 'gumroad', label: 'Check on Gumroad' },
      { key: 'etsy', label: 'Check on Etsy' },
      { key: 'pinterest', label: 'Check on Pinterest' },
      { key: 'trends', label: 'Check on Google Trends' },
      { key: 'checked', label: 'Read on' },
    ],
    { bom: true },
  );
}

module.exports = {
  name: 'templates.rank_ideas',
  title: 'Rank your next 25 ideas',
  description: 'Ranks 25 template ideas by public demand on Gumroad (listings and buyer ratings on matching products), leaves out what you already made, favors ideas that fit your shop, and links each to Gumroad, Etsy, Pinterest and Google Trends so you can check it.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 240,
  input: { type: 'object', properties: { count: { type: 'integer', minimum: 10, maximum: 50, default: 25 }, live: { type: 'boolean', default: true } } },
  output: { type: 'object', properties: { ideas: { type: 'array' }, makeable: { type: 'array' }, best: { type: ['object', 'null'] }, made: { type: 'array' }, themes: { type: 'array' }, csv: { type: 'object' }, live: { type: 'integer' }, total: { type: 'integer' }, checked: { type: 'string' }, repeats: { type: 'integer' }, lastRun: { type: ['string', 'null'] } }, required: ['ideas', 'makeable'] },
  async run(input, ctx) {
    const count = Math.max(10, Math.min(50, Number(input.count) || 25));
    const mem = brain.packMemory(ctx, 'templates');
    const made = (Array.isArray(mem.made) ? mem.made : []).filter((k) => T.SPECS[k]);
    const themes = shopThemes(ctx, made);
    const seen = new Set();
    const all = [...T.DEMAND.searches, ...T.IDEAS.searches].filter((s) => (seen.has(s.search) ? false : seen.add(s.search)));
    // Safe to repeat every month: the ideas shown last time go to the back of the list, so a
    // repeat brings new ones first (they come back once the fresh ones run out).
    const shown = mem.shown && typeof mem.shown === 'object' ? mem.shown : {};
    const lastSearches = new Set(Array.isArray(shown.searches) ? shown.searches : []);
    const lastKinds = new Set(Array.isArray(shown.kinds) ? shown.kinds : []);
    // Ideas not made yet, new ones first. Re-read the strongest live, then rank again.
    const fresh = all.filter((s) => !(s.kind && made.includes(s.kind)));
    const first = T.rankSearches(fresh)
      .sort((a, b) => lastSearches.has(a.search) - lastSearches.has(b.search))
      .slice(0, Math.min(fresh.length, count + 15));
    const pick = first.map((r) => fresh.find((s) => s.search === r.search));
    const got = await FD.refresh(ctx, pick, { live: input.live !== false });
    const ranked = T.rankSearches(got.list)
      .map((r) => {
        const fits = !!r.kind && themes.has(T.themeOf(r.kind));
        // Same theme as what the shop sells: same buyers, and it can join a bundle.
        return { ...r, fits, again: lastSearches.has(r.search), evidence: fits ? `${r.evidence}. Fits your shop` : r.evidence, order: r.score + (fits ? 15 : 0) };
      })
      .sort((a, b) => a.again - b.again || b.order - a.order);
    const rows = ranked
      .slice(0, count)
      .map((r, i) => ({ ...r, rank: i + 1, detail: r.makeable ? `${r.fits ? 'Fits your shop. ' : ''}We can make this one: ${T.specOf(r.kind).title}` : 'Needs design tools (Canva or similar), so not made here' }));
    // Five different templates to choose from: the best idea for each, ones not offered last time first.
    const byKind = rows.filter((r, i) => r.makeable && rows.findIndex((x) => x.kind === r.kind) === i);
    const makeable = [...byKind.filter((r) => !lastKinds.has(r.kind)), ...byKind.filter((r) => lastKinds.has(r.kind))].slice(0, 5);
    const today = time.today(ctx);
    const csv = await save.saveFile(ctx, save.fileName('next-25-template-ideas', today, '.csv'), csvOf(rows));
    await brain.remember(ctx, 'shown', { date: today, searches: rows.map((r) => r.search), kinds: makeable.map((r) => r.kind) });
    const repeats = rows.filter((r) => r.again).length;
    ctx.log(`${rows.length} ideas ranked (${made.length} made already left out${lastSearches.size ? `, ${lastSearches.size - repeats} from last time moved out` : ''}), ${got.live} read live from Gumroad`);
    return { ideas: rows, makeable, best: makeable[0] || null, made, themes: [...themes], csv, live: got.live, total: pick.length, checked: got.live ? today : T.DEMAND.checked, repeats, lastRun: shown.date || null };
  },
  view(out) {
    return views.blocks(
      views.metric('Ideas ranked', out.ideas.length, [out.made.length ? `${out.made.length} you already made are left out` : '', out.lastRun ? `new since your list of ${time.shortDate(out.lastRun)}${out.repeats ? ` (${out.repeats} repeat at the end)` : ''}` : ''].filter(Boolean).join('; ') || null),
      out.live ? views.metric('Read live from Gumroad today', `${out.live} of ${out.total || out.live} searches`) : views.metric('Gumroad numbers', `As read on ${out.checked}`, 'Gumroad did not answer just now, so this uses the last reading'),
      views.table(
        [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'search', label: 'Buyers search for' },
          { key: 'listings', label: 'Listings', format: 'number' },
          { key: 'top', label: 'Ratings on the top match', format: 'number' },
          { key: 'make', label: 'We make it as' },
        ],
        out.ideas.map((r) => ({ rank: r.rank, search: r.search, listings: r.listings, top: r.top_ratings, make: r.makeable ? `${T.specOf(r.kind).title}${r.fits ? ' (fits your shop)' : ''}` : 'Needs design tools' })),
      ),
      views.text(`No sales numbers: Gumroad and Etsy do not publish them. Ratings come from buyers, so they show what people paid for.${out.themes.length ? ' Ideas that fit your shop (the same kind of template you already sell) rank a little higher: same buyers, and they can join a bundle.' : ''} Before you make one, open its Etsy and Google Trends links in the file and look for yourself.`),
      views.file(out.csv, 'All ideas with links to check each one (.csv)'),
    );
  },
};
