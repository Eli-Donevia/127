// The starter tool stack: one tool per job, picked for how the member sells, with the free plan
// and the first paid plan as read on each tool's own pricing page (data/tools.json, with the
// checked date and source on every line).

const DATA = require('../data/tools.json');

const MODELS = {
  local: { label: 'Local service', about: 'you go to the customer or they come to you' },
  service: { label: 'Online service', about: 'you do the work on a call or on a screen' },
  products: { label: 'Physical products', about: 'you make or source things and ship or hand them over' },
  digital: { label: 'Digital products', about: 'people buy and download something you made once' },
};

const MATCH = [
  ['digital', /\b(template|templates|e-?book|course|preset|presets|printable|printables|notion|digital|download|downloads|planner|lightroom|stock photo)\b/i],
  ['products', /\b(candle|candles|soap|soaps|bak(e|ed|ery|ing)|cookies|cakes|jewelry|jewellery|apparel|shirts?|t-shirts?|merch|crochet|knit|prints|plants|coffee|sauce|hot sauce|handmade|resale|thrift|vintage|depop|etsy|skincare|stickers)\b/i],
  ['local', /\b(clean|cleaning|maid|detail|detailing|car wash|pressure|power washing|washing|lawn|mow|mowing|yard|landscap\w*|pet|dog|grooming|walker|walking|sitter|sitting|handyman|junk|moving|movers|painting|painter|window|gutter|pool|mobile|in-home|tutor|tutoring|lessons|photo booth|bounce)\b/i],
  ['service', /\b(design|designer|web|website|social media|marketing|coach|coaching|consult\w*|editing|editor|video|photo|photography|bookkeeping|assistant|va|copywriting|writer|writing|ugc|freelance)\b/i],
];

function modelFor(what) {
  const s = String(what || '');
  for (const [id, re] of MATCH) if (re.test(s)) return id;
  return 'service';
}

function tool(key) {
  const t = DATA.tools[key];
  if (!t) throw new Error(`Unknown tool ${key}`);
  return { key, ...t };
}

// budget: 'free' keeps the free or no-monthly-fee pick; 'some' swaps in the paid upgrade where
// the row names one (Jobber, Shopify, Google Workspace).
function stackFor(model, { budget = 'free' } = {}) {
  const rows = DATA.stacks[model] || DATA.stacks.service;
  return rows.map(([job, a, b]) => {
    let pick = tool(a);
    let alt = b ? tool(b) : null;
    if (budget === 'some' && alt && !alt.free) [pick, alt] = [alt, pick];
    if (budget === 'free' && !pick.free && alt && alt.free) [pick, alt] = [alt, pick];
    return {
      job,
      tool: pick.name,
      start: pick.free || pick.paid || 'check current pricing',
      upgrade: pick.free ? pick.paid || 'Stays free' : 'No free plan',
      freeStart: /\bfree\b|\$0|no monthly fee/i.test(pick.free || ''),
      alt: alt ? alt.name : '',
      url: pick.url,
      source: pick.source,
      checked: pick.checked,
    };
  });
}

module.exports = { MODELS, modelFor, stackFor, DATA };
