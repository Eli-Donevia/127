// Prices competitors show on their own sites (and Shopify store prices), as a range with sources:
// a chart (SVG and PNG), a CSV with where each price came from, and where the member could sit.

const { views, save, files, svg, media, color, text, places } = require('../../_kit');
const { median } = require('../lib/compete');

const PER = (p) => String(p || '').toLowerCase().replace(/^(per |a |an )/, '').trim() || 'each';

module.exports = {
  name: 'intel.price_range',
  title: 'Price range',
  description: 'Collects the prices competitors show on their own sites into a range with sources: a chart, a CSV and where you could sit.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { competitors: { type: 'array', title: 'Competitors', description: 'Outputs of intel.scan_competitor' } }, required: ['competitors'] },
  output: { type: 'object', properties: { groups: { type: 'array' }, prices: { type: 'array' }, csv: { type: 'object' } }, required: ['groups', 'prices', 'csv'] },
  async run(input, ctx) {
    const comps = (input.competitors || []).filter((c) => c && c.key && !c.error);
    const prices = [];
    for (const c of comps) {
      for (const p of c.prices || []) if (Number(p.amount) > 0 && Number(p.amount) < 100000) prices.push({ who: c.name, amount: Number(p.amount), per: PER(p.per), context: text.clip(text.plain(p.context || ''), 90), source: c.website || '' });
      if (c.shop && c.shop.median) prices.push({ who: c.name, amount: c.shop.median, per: 'product (store median)', context: `${c.shop.products} products, $${c.shop.low} to $${c.shop.high}`, source: c.website || '' });
    }
    const by = {};
    for (const p of prices) (by[p.per] = by[p.per] || []).push(p);
    const groups = Object.entries(by)
      .map(([per, list]) => ({ per, n: list.length, sellers: new Set(list.map((x) => x.who)).size, low: Math.min(...list.map((x) => x.amount)), median: (() => { const m = median(list.map((x) => x.amount)); return m > 20 ? Math.round(m) : m; })(), high: Math.max(...list.map((x) => x.amount)) }))
      .sort((a, b) => b.sellers - a.sellers || b.n - a.n);
    // Businesses found on OpenStreetMap carry the ODbL credit as the spreadsheet's last row (D27).
    const credit = places.creditLine(comps);
    const csv = await save.saveFile(ctx, save.fileName('competitor prices', '.csv'), files.csv(credit ? prices.concat([{ who: credit }]) : prices, [{ key: 'who', label: 'Competitor' }, { key: 'amount', label: 'Price ($)' }, { key: 'per', label: 'Per' }, { key: 'context', label: 'Where it says it' }, { key: 'source', label: 'Website' }], { bom: true }));
    let chart = null;
    let png = null;
    const g = groups[0];
    if (g) {
      const p = color.palette('clean');
      const list = by[g.per];
      const W = 1200;
      const H = 260 + 70 * new Set(list.map((x) => x.who)).size + (credit ? 40 : 0);
      const x0 = 400;
      const x1 = W - 80;
      const lo = Math.min(...list.map((x) => x.amount)) * 0.9;
      const hi = Math.max(...list.map((x) => x.amount)) * 1.1 || 1;
      const X = (v) => x0 + ((v - lo) / (hi - lo || 1)) * (x1 - x0);
      let body = svg.text({ x: 60, y: 80, lines: [text.clip(`Prices per ${g.per}`, 50)], size: 44, weight: 800, fill: p.ink });
      body += svg.text({ x: 60, y: 125, lines: [`Low $${g.low}  |  middle $${g.median}  |  high $${g.high}  (from ${g.sellers} ${g.sellers === 1 ? 'business' : 'businesses'})`], size: 26, weight: 500, fill: p.muted });
      const who = [...new Set(list.map((x) => x.who))];
      const foot = credit ? 40 : 0;
      body += svg.line({ x1: X(g.median), y1: 160, x2: X(g.median), y2: H - 60 - foot, stroke: p.accent, strokeWidth: 3, opacity: 0.8 });
      body += svg.text({ x: X(g.median), y: H - 25 - foot, lines: [`middle $${g.median}`], size: 22, weight: 600, fill: p.accent, anchor: 'middle' });
      if (credit) body += svg.text({ x: 60, y: H - 22, lines: ['Business data: OpenStreetMap contributors (ODbL), openstreetmap.org/copyright'], size: 18, weight: 500, fill: p.muted });
      who.forEach((name, i) => {
        const y = 200 + i * 70;
        body += svg.text({ x: 60, y: y + 9, lines: [text.clip(name, 24)], size: 24, weight: 600, fill: p.ink });
        body += svg.line({ x1: x0, y1: y, x2: x1, y2: y, stroke: p.line, strokeWidth: 2 });
        for (const pr of list.filter((x) => x.who === name)) {
          body += svg.circle({ cx: X(pr.amount), cy: y, r: 13, fill: p.primary });
          body += svg.text({ x: X(pr.amount), y: y - 22, lines: [`$${pr.amount}`], size: 20, weight: 600, fill: p.ink, anchor: 'middle' });
        }
      });
      const svgText = svg.doc({ width: W, height: H, background: p.paper, body, title: `Prices per ${g.per}` });
      chart = await save.saveFile(ctx, save.fileName('competitor prices', '.svg'), svgText);
      if (media.canRender(ctx)) {
        try {
          png = await save.saveFile(ctx, save.fileName('competitor prices', '.png'), await media.svgToPng(ctx, svgText));
        } catch {
          png = null;
        }
      }
    }
    const span = g && g.low === g.high ? `charge $${g.low} per ${g.per}` : g ? `charge $${g.low} to $${g.high} per ${g.per}, with the middle at $${g.median}` : '';
    const where = g ? `The competitors who show a price ${span}. A clear price near the middle, plus a first-visit offer and a promise you control (like a free redo), gives buyers a reason to try you.` : 'None of these sites show prices. Showing yours, even as a starting price, already sets you apart.';
    ctx.log(`Found ${prices.length} prices on ${comps.length} sites`);
    return { groups, prices, where, csv, chart, png, sample: comps.some((c) => c.sample), credit: comps.filter((c) => c.source === 'osm').slice(0, 1).map((c) => ({ source: 'osm', ...(c.searchBy ? { searchBy: c.searchBy } : {}) })) };
  },
  view(out) {
    return views.blocks(
      views.text(out.where),
      out.png ? views.image(out.png, 'Competitor prices') : out.chart ? views.file(out.chart, 'Price chart') : null,
      out.groups.length ? views.table([{ key: 'per', label: 'Per' }, { key: 'low', label: 'Low', format: 'money' }, { key: 'median', label: 'Middle', format: 'money' }, { key: 'high', label: 'High', format: 'money' }, { key: 'sellers', label: 'Businesses', format: 'number' }], out.groups, 6) : null,
      views.file(out.csv, 'Every price with where it came from (CSV)'),
      ...places.creditBlocks(out.credit || [])
    );
  },
};
