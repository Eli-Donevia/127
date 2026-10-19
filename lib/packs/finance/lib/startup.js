// A startup budget: the member's own items, then checked startup costs for their type of business
// (research/niches, sourced and dated), then the basics every US business has. The cheapest working
// option comes first: the plan uses the low end of each range until the member types their own
// number. Items the sources mark as "later" or "only if" are listed apart and never counted.

const TYPES = require('../data/types.json');
const BASICS = require('../data/basics.json');
const niches = require('./niches');
const parse = require('./parse');

const RULES = TYPES.stages.rules.map((r) => ({ re: new RegExp(r.match, 'i'), stage: r.stage, why: r.why }));
const AGGREGATE = new RegExp(TYPES.stages.aggregate, 'i');
const STAGES = ['now', 'later', 'when'];
const STAGE_LABEL = TYPES.stages.labels;
const FREQ_LABEL = { once: 'One time', month: 'Monthly', year: 'Yearly' };
const FREQ_ORDER = { once: 0, month: 1, year: 2 };

function stageOf(name, note = '') {
  const s = `${name} ${note}`;
  for (const r of RULES) if (r.re.test(s)) return { stage: r.stage, why: r.why };
  return { stage: 'now', why: '' };
}

const STOP = new Set(
  'and the for with your you from starter stock total each set kit small initial only once if of or to a an per cost costs business general new first month monthly year yearly have own plus more less basic simple some other start starting'.split(' ')
);

function words(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.replace(/ies$/, 'y').replace(/(?<!s)s$/, ''));
}

const round2 = (n) => Math.round(n * 100) / 100;

// The amount the plan uses: the member's number, else the cheapest that works.
const planOf = (i) => (i.mine != null ? i.mine : i.low);
const highOf = (i) => (i.mine != null ? i.mine : i.high != null ? i.high : i.low);

function fromResearch(n, kind) {
  const items = [];
  const reference = [];
  for (const it of n.items) {
    if (it.freq === 'payment') continue; // card fees come out of each payment: see your numbers
    if (AGGREGATE.test(it.item)) {
      reference.push({ name: it.item, low: it.low, high: it.high, sources: it.sources.map((s) => s.url) });
      continue;
    }
    const st = stageOf(it.item, it.note);
    items.push({
      name: it.item,
      freq: it.freq === 'year' ? 'year' : it.freq === 'month' ? 'month' : 'once',
      low: it.low,
      high: it.high,
      mine: null,
      owned: false,
      stage: st.stage,
      why: st.why,
      note: it.note || '',
      from: 'research',
      sources: [...new Set(it.sources.map((s) => s.url))].slice(0, 3),
      kind,
    });
  }
  return { items, reference };
}

function basicsFor(kind, has) {
  return BASICS.items
    .filter((b) => b.kinds.includes(kind))
    .filter((b) => !(b.id === 'license' && has(/licen|registration|permit/i)))
    .map((b) => ({
      name: b.name,
      freq: b.freq,
      low: b.low,
      high: b.high,
      mine: null,
      owned: false,
      stage: b.stage || 'now',
      why: '',
      note: b.note,
      from: 'basic',
      sources: [b.source],
    }));
}

function toPriceFor(type) {
  const list = (type && type.toPrice) || TYPES.generic.toPrice;
  return list.map(([name, freq]) => {
    const st = stageOf(name);
    return { name, freq, low: null, high: null, mine: null, owned: false, stage: st.stage, why: st.why, note: 'Price this before you buy.', from: 'to price', sources: [] };
  });
}

// The member's item replaces the closest listed item (shared words, same "how often" first).
function bestMatch(list, mine) {
  const w = new Set(words(mine.name));
  if (!w.size) return -1;
  let best = -1;
  let score = 0;
  list.forEach((it, i) => {
    if (it.from === 'you') return;
    const shared = words(it.name).filter((x) => w.has(x)).length;
    if (!shared) return;
    const s = shared + (it.freq === mine.freq ? 0.5 : 0) + (it.stage === 'now' ? 0.25 : 0);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

// type: from niches.matchType (or null); mine: the member's items as text lines or a list.
// Returns { items, reference, research, missing, notYet, totals, skipped, typeName, checked }.
function build({ type, mine }) {
  const kind = type ? type.kind : 'local';
  const research = type ? niches.load(type.id) : null;
  let items = [];
  let reference = [];
  if (research) ({ items, reference } = fromResearch(research, kind));
  else items = toPriceFor(type);
  const has = (re) => items.some((i) => re.test(i.name));
  items = [...items, ...basicsFor(kind, has)];

  const parsed = parse.costs(mine || '');
  const added = [];
  for (const m of parsed.items) {
    const own = {
      name: m.name,
      freq: m.freq,
      low: m.amount,
      high: m.amount,
      mine: m.amount,
      owned: m.owned,
      stage: 'now',
      why: '',
      note: m.owned ? 'You have it.' : m.weekly ? 'You gave this by the week; shown as a monthly cost.' : '',
      from: 'you',
      sources: [],
    };
    const i = bestMatch(items, own);
    if (i >= 0) {
      const was = items[i];
      own.replaced = was.name;
      own.low = was.low;
      own.high = was.high;
      own.sources = was.sources;
      // "Insurance 55" never said how often: it is paid as often as the item it replaces.
      if (!m.explicit || m.owned) own.freq = was.freq;
      own.stage = was.stage === 'when' ? 'now' : was.stage === 'later' && !m.owned ? 'now' : was.stage;
      items[i] = own;
    } else added.push(own);
  }
  items = [...items, ...added];

  // Group by stage, then one-time before monthly before yearly, keeping the sources' order.
  items = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => STAGES.indexOf(a.it.stage) - STAGES.indexOf(b.it.stage) || FREQ_ORDER[a.it.freq] - FREQ_ORDER[b.it.freq] || a.i - b.i)
    .map((x) => x.it);

  const missing = [];
  if (!research) missing.push(type ? `127 has no checked startup costs for ${type.name} yet, so the list shows what to price.` : 'Tell us what you sell to get checked startup costs for your type of business.');
  const unknown = items.filter((i) => i.stage === 'now' && planOf(i) == null);
  if (unknown.length) missing.push(`Price these yourself: ${unknown.map((i) => i.name).join('; ')}.`);

  return {
    items,
    reference,
    research,
    missing,
    notYet: research ? research.notYet : [],
    totals: totals(items),
    skipped: parsed.skipped,
    typeName: research ? research.name : type ? type.name : '',
    checked: research ? research.checked : BASICS.checked,
  };
}

function totals(items) {
  const sum = (stage, freq, f) => round2(items.filter((i) => i.stage === stage && i.freq === freq).reduce((n, i) => n + (f(i) || 0), 0));
  const t = {
    oneTime: sum('now', 'once', planOf),
    oneTimeHigh: sum('now', 'once', highOf),
    monthly: sum('now', 'month', planOf),
    monthlyHigh: sum('now', 'month', highOf),
    yearly: sum('now', 'year', planOf),
    yearlyHigh: sum('now', 'year', highOf),
    laterOneTime: sum('later', 'once', planOf),
    laterMonthly: sum('later', 'month', planOf),
    counted: items.filter((i) => i.stage === 'now').length,
    free: items.filter((i) => i.stage === 'now' && planOf(i) === 0).length,
    unknown: items.filter((i) => i.stage === 'now' && planOf(i) == null).length,
    later: items.filter((i) => i.stage === 'later').length,
    when: items.filter((i) => i.stage === 'when').length,
  };
  // Cash to open: one-time costs, the first month of monthly bills and the first year of yearly ones.
  t.cashToOpen = round2(t.oneTime + t.monthly + t.yearly);
  t.cashToOpenHigh = round2(t.oneTimeHigh + t.monthlyHigh + t.yearlyHigh);
  // Fixed costs a month for break-even: monthly bills plus yearly ones spread over 12 months.
  t.fixedMonthly = round2(t.monthly + t.yearly / 12);
  return t;
}

module.exports = { build, totals, stageOf, words, planOf, highOf, STAGE_LABEL, FREQ_LABEL, STAGES };
