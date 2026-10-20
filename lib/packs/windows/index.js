// Window cleaning: a household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers by month, texts, checklist,
// objections, specials) and data/prices.json, from research/niches/windows.json with sources.
// On top of the spine:
//   - the signature workflow "Window count estimate" (tools/count-estimate.js, math and sheet in
//     lib/estimate.js), offered as a next step where a price comes up;
//   - "Quote this job" priced per window (lib/quote-plan.js): counts win over a flat house price,
//     a plan takes its discount off counted windows, and storefront visits carry no trip minimum.
// Windows pack.

const pack = require('../_kit/home').pack(__dirname);
const config = require('../_kit/home/config');
const { quoteTool } = require('./lib/quote-plan');
const { countEstimateTool, estimateWorkflow } = require('./tools/count-estimate');

const cfg = config.load(__dirname);
const quote = quoteTool(cfg);
const estimate = countEstimateTool(cfg);
pack.tools = pack.tools.map((t) => (t.name === quote.name ? quote : t));
pack.tools.push(estimate);

// After "Quote a job", the other way to price one.
const flow = estimateWorkflow(cfg, estimate);
const at = pack.workflows.findIndex((w) => w.id === `${cfg.id}.quote`);
pack.workflows.splice(at + 1, 0, flow);

// The signature as a next step wherever a price comes up.
const offer = (id, why, first = true) => {
  const w = pack.workflows.find((x) => x.id === `${cfg.id}.${id}`);
  if (!w) return;
  const step = { id: flow.id, why };
  w.next = first ? [step, ...(w.next || [])] : [...(w.next || []), step];
};
offer('reply', 'They asked how much: count their windows by floor and print an estimate.');
offer('quote', 'Count their windows by floor for a printed estimate.');
offer('offer', 'Try your prices on one house: count the windows by floor.');
offer('same_street', 'A neighbor asked for a price: count their windows and print the estimate.');
offer('sample_one', 'They liked the free window: count the rest and print an estimate.', false);

module.exports = pack;
