// The facts for a UGC portfolio page, for the site pack's portfolio design: the member's packages and
// prices from "Your offer", what every video includes, their work (only pieces they list, and never a
// concept preview made for a brand that hasn't hired them: that video uses the brand's product and
// would look like a client they don't have), the brands they may name, real quotes only, and how to
// reach them. site.write_copy writes the words from these facts; site.build makes the page.

const kit = require('../../_kit');
const { text, views, brain, money } = kit;
const talk = require('../../_kit/talk');
const offer = require('../lib/offer');

const usd = (n) => money.usd(n);

// One "Title | what it was | link" line per piece; a piece that names a brand in the Pipeline that
// isn't a client is a concept made to pitch them, so it stays off the page.
function checkWork(lines, rows) {
  const keep = [];
  const dropped = [];
  const notClients = (rows || []).filter((r) => r && r.name && !['won', 'done'].includes(r.stage) && (!r.pack || r.pack === 'ugc'));
  for (const raw of String(lines || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 9)) {
    const l = talk.norm(raw);
    const hit = notClients.find((r) => {
      const n = talk.norm(r.name);
      const dom = talk.domainOf((r.links && r.links.website) || '');
      return (n.length >= 4 && l.includes(n)) || (dom && raw.toLowerCase().includes(dom));
    });
    if (hit) dropped.push({ line: raw, brand: hit.name });
    else keep.push(raw);
  }
  return { keep, dropped };
}

module.exports = {
  name: 'ugc.portfolio_facts',
  title: 'Gather your portfolio facts',
  description: 'Puts together the facts for your portfolio page: your packages and prices from your offer, what every video includes, your work, the brands you may name, real quotes and how to reach you. Leaves off concept videos made to pitch brands that have not hired you.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 80 },
      owner: { type: 'string', maxLength: 40 },
      email: { type: 'string', maxLength: 160 },
      instagram: { type: 'string', maxLength: 120 },
      tiktok: { type: 'string', maxLength: 120 },
      city: { type: 'string', maxLength: 120 },
      niche: { type: 'string', maxLength: 120 },
      about: { type: 'string', maxLength: 1200 },
      work: { type: 'string', maxLength: 3000 },
      clients: { type: 'string', maxLength: 1000 },
      reviews: { type: 'string', maxLength: 2000 },
      booking: { type: 'string', maxLength: 300 },
      prices: { type: 'boolean' },
      color: { type: 'string', maxLength: 30 },
      domain: { type: 'string', maxLength: 120 },
    },
  },
  output: { type: 'object', required: ['facts'], properties: { facts: { type: 'object' }, dropped: { type: 'array' }, warnings: { type: 'array' } } },
  timeoutSec: 20,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const n = offer.offerNumbers({}, ctx);
    const rows = await talk.pipelineRows(ctx);
    const showPrices = input.prices !== false;
    // Short enough that the site's bio, hero and photo text keep it whole (it clips at 60).
    const niche = text.oneLine(input.niche || '').replace(/\s+brands?$/i, '');
    const what = niche && `UGC creator for ${niche} brands`.length <= 60 ? `UGC creator for ${niche} brands` : 'UGC creator for online brands';
    const services = n.packages
      .map((p) => {
        const price = showPrices ? `, ${usd(p.price)}${p.per ? ` ${p.per}` : ''}` : '';
        const what1 = p.id === 'test' ? 'one video for one product, 15 to 60 seconds, with captions, a clean version and organic use' : p.id === 'starter' ? '3 videos with an extra hook on each and 30 days of paid ad use' : `${p.videos} new videos every month and a short report, stop any month`;
        return `${p.name}${price}, ${what1}`;
      })
      .join('\n');
    const included = ['Vertical 9:16 videos, 15 to 60 seconds', 'Captions and a clean version of every video', 'The use in writing before filming', 'One round of edits', 'Files named and sent in one folder'].join('\n');
    const { keep, dropped } = checkWork(input.work, rows);
    const won = rows.filter((r) => r && ['won', 'done'].includes(r.stage) && (!r.pack || r.pack === 'ugc')).map((r) => r.name);
    const reviews = String(input.reviews || '')
      .split('\n')
      .map((l) => text.oneLine(l))
      .filter((l) => l.length > 8)
      .slice(0, 6)
      .join('\n');
    const facts = {
      business: text.clip(text.oneLine(input.name || br.name || ''), 80),
      what,
      city: text.oneLine(input.city || ''),
      owner: text.oneLine(input.owner || br.firstName || ''),
      email: text.oneLine(input.email || br.email || ''),
      instagram: text.oneLine(input.instagram || ''),
      tiktok: text.oneLine(input.tiktok || ''),
      services,
      included,
      about: text.oneLine(input.about || ''),
      work: keep.join('\n'),
      clients: String(input.clients || '').trim(),
      reviews,
      booking: text.oneLine(input.booking || ''),
      color: text.oneLine(input.color || ''),
      domain: text.oneLine(input.domain || ''),
      tagline: `Short product videos for ${niche ? `${niche} brands` : 'small brands'}: hooks, captions and the use in writing.`,
      design: 'portfolio',
    };
    for (const k of Object.keys(facts)) if (facts[k] === '') delete facts[k];
    const warnings = [];
    if (!facts.business) warnings.push('Add your creator or business name for the top of the page.');
    if (!keep.length) warnings.push("No work listed yet, so the page shows 6 frames to fill. Film 3 short videos of products you bought yourself, list them as \"Personal project\", and run this again.");
    if (dropped.length) warnings.push(`Left off ${dropped.length} piece${dropped.length === 1 ? '' : 's'} made for ${[...new Set(dropped.map((d) => d.brand))].join(', ')}: a concept made to pitch a brand stays private until they hire you and say yes to showing it.`);
    if (won.length && !facts.clients) warnings.push(`You have ${won.length === 1 ? 'a paying brand' : 'paying brands'} in your Pipeline (${won.join(', ')}). Add ${won.length === 1 ? 'it' : 'them'} under brands you may name only if they said yes.`);
    if (!facts.email && !facts.booking) warnings.push('Add your email or a booking link so brands can reach you.');
    ctx.log(`Portfolio facts: ${n.packages.length} packages, ${keep.length} pieces of work`);
    return { facts, dropped, warnings, work: keep.length, prices: showPrices, packages: n.packages.map((p) => ({ name: p.name, price: `${usd(p.price)}${p.per ? ` ${p.per}` : ''}` })) };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Package on your page' }, { key: 'price', label: out.prices ? 'Price' : 'Price (hidden on the page)' }], out.packages),
      ...out.warnings.map((w) => views.text(w)),
    );
  },
};
