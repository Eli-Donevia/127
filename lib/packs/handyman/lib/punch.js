// The punch list math: each part of the pasted list (lib/parse.js) gets its sourced time range
// (data/punch.json), the order to do the jobs in, and a price from the middle of its time at the
// member's hourly rate, the way Housecall Pro prices a full punch list, with the trip minimum. The
// typical price of each job alone, where two or more guides give one, is kept for the member to
// compare (a list priced job by job would pay the trip many times; Thumbtack says to group them).
// Work a licensed trade does, and the jobs a state lists as licensed work, come out of the price
// with the rule and its source. The state's dollar limit for work without a license, the EPA lead
// rule for homes built before 1978 and the OSHA ladder and CPSC anchoring lines are added where they
// apply. Pure functions: tests import these.

const { money, text } = require('../../_kit');
const { parse, DATA } = require('./parse');

const PRICES = require('../data/prices.json');
const DAY_MINUTES = 8 * 60; // visits of up to 8 hours each, a judgment call (data estimate.visits_note)
const LIMIT_WARN = 0.8; // warn at 80 percent of a state's limit: the estimate is labor only

const STEPS = DATA.steps;
const priced = (id) => [...PRICES.packages, ...PRICES.addons].find((x) => x.id === id) || null;
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
const hours = (m) => Math.round((m / 60) * 10) / 10;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

// "45 minutes", "1.5 hours", "1 to 2 hours", "30 minutes to 1 hour"
function timeText(lo, hi) {
  // Two hours and up are rounded to the half hour: "7 to 16 hours", not "7.2 to 15.8".
  const h = (m) => (m >= 120 ? Math.round((m / 60) * 2) / 2 : hours(m));
  const one = (m) => (m < 60 ? `${Math.round(m)} minutes` : `${h(m)} ${h(m) === 1 ? 'hour' : 'hours'}`);
  if (lo === hi) return one(lo);
  if (lo >= 60) return `${h(lo)} to ${one(hi)}`;
  if (hi < 60) return `${Math.round(lo)} to ${one(hi)}`;
  return `${one(lo)} to ${one(hi)}`;
}

// The time for a job and how many: the first one's range, plus "more" for each after it.
function minutesFor(job, qty) {
  const [lo, hi] = job.minutes;
  const [mlo, mhi] = job.more || job.minutes;
  return [lo + (qty - 1) * mlo, hi + (qty - 1) * mhi];
}

// The typical price of the job alone from the guides: { low, high, sources, per } or a note.
function typicalFor(job, qty) {
  const p = job.price || {};
  if (p.from) {
    const src = priced(p.from);
    if (!src) return { note: 'No typical price' };
    const per = p.per || (src.unit === 'job' || src.unit === 'visit' ? 'job' : 'unit');
    const n = per === 'job' ? 1 : qty;
    return { low: src.range[0] * n, high: src.range[1] * n, sources: src.sources, per };
  }
  if (p.range && (p.sources || []).length >= 2) {
    const n = p.per === 'unit' ? qty : 1;
    return { low: p.range[0] * n, high: p.range[1] * n, sources: p.sources, per: p.per };
  }
  return { note: p.note || 'No typical price from two or more guides: priced by the time it takes.' };
}

// A state's entry on a date: a dated change in data (Utah's move to 58-55-110 on 2027-01-01) replaces
// the fields it lists from its "from" day on, so the switch needs no new release.
function stateOf(code, today = '') {
  const base = DATA.states[code];
  if (!base) return null;
  const day = String(today || '').slice(0, 10);
  let out = base;
  for (const ch of base.changes || []) {
    if (day && day >= ch.from) {
      const { from, ...fields } = ch;
      out = { ...out, ...fields };
    }
  }
  return out;
}

// What the member's state says about a check: 'refer' (licensed work there) or 'check'.
function statusFor(state, check) {
  if (!check) return null;
  return state && state.status && state.status[check] === 'refer' ? 'refer' : 'check';
}

// input: { items, built, rate }; state: two-letter code or ''. rate: the member's hourly rate. today:
// YYYY-MM-DD, for dated state changes.
// Returns { error } or { parts, lines, items, subtotal, minutes, visits, order, refer, checks, unknown,
// state, lead, safety, compare, sources }.
function estimate(input, { rate, state: code = '', minimum = PRICES.minimum, today = '' } = {}) {
  const raw = String(input.items || '').trim();
  if (!raw) return { error: 'Paste the list of jobs, one per line, like "fix sticky bedroom door" or "mount 2 TVs".' };
  const R = Number(rate) > 0 ? Number(rate) : null;
  if (!R) return { error: 'Type your hourly rate, like 75.' };
  const state = stateOf(code, today);
  const parts = parse(raw);

  const lines = [];
  const refer = [];
  const unknown = [];
  const checks = new Map();
  for (const p of parts) {
    if (p.kind === 'refer') {
      refer.push({ text: p.text, label: p.refer.label, trade: p.refer.trade, why: p.refer.why, sources: p.refer.sources, state: '' });
      continue;
    }
    if (p.kind === 'unknown') {
      unknown.push(p.text);
      continue;
    }
    const job = p.job;
    const status = statusFor(state, p.check);
    const chk = p.check ? DATA.checks[p.check] : null;
    if (status === 'refer') {
      refer.push({ text: p.text, label: job.label, trade: chk.trade, why: `In ${state.name} this goes to ${chk.trade}. ${state.rule}`, sources: state.sources, state: state.code });
      continue;
    }
    if (chk) {
      const c = checks.get(p.check) || { id: p.check, label: chk.label, items: [], text: chk.say, sources: DATA.check_sources };
      c.items.push(p.text);
      checks.set(p.check, c);
    }
    const [lo, hi] = minutesFor(job, p.qty);
    const mid = (lo + hi) / 2;
    const price = round5((R * mid) / 60);
    lines.push({ text: p.text, job, qty: p.qty, low: lo, high: hi, mid, price, typical: typicalFor(job, p.qty), timeSourced: (job.time_sources || []).length > 0, timeNote: job.time_note || '' });
  }
  if (!lines.length && !refer.length && !unknown.length) return { error: 'Paste the list of jobs, one per line, like "fix sticky bedroom door" or "mount 2 TVs".' };

  // The order: the steps in data order, with the return visit when a patch has to dry.
  const order = [];
  for (const st of STEPS) {
    if (st.id === 'return') continue;
    const here = lines.filter((l) => l.job.step === st.id);
    if (here.length) order.push({ step: st.id, label: st.label, why: st.why || '', jobs: here.map((l) => l.text) });
  }
  const second = lines.filter((l) => (l.job.visits || 1) > 1);
  const ret = STEPS.find((s) => s.id === 'return');
  if (second.length && ret) order.push({ step: ret.id, label: ret.label, why: ret.why, jobs: second.map((l) => l.text) });
  // Order the lines the same way, so the quote, the text and the sheet read in work order.
  const rank = (l) => STEPS.findIndex((s) => s.id === l.job.step);
  lines.sort((a, b) => rank(a) - rank(b));

  const low = lines.reduce((n, l) => n + l.low, 0);
  const high = lines.reduce((n, l) => n + l.high, 0);
  const visitCount = lines.length ? Math.max(1, Math.ceil(high / DAY_MINUTES)) + (second.length ? 1 : 0) : 0;

  const items = lines.map((l) => ({
    label: text.clip(l.qty > 1 ? `${l.job.label} (${plural(l.qty, String(l.job.unit).toLowerCase())})` : l.job.label, 80),
    detail: text.clip(`${cap(l.text)}. About ${timeText(l.low, l.high)}.`, 290),
    qty: 1,
    unit: 'job',
    price: l.price,
  }));
  let subtotal = items.reduce((n, it) => n + it.price, 0);
  if (lines.length && minimum && subtotal < minimum) {
    items.push({ label: 'Trip minimum', detail: `Visits start at ${money.usd(minimum)}`, qty: 1, unit: 'each', price: minimum - subtotal });
    subtotal = minimum;
  }

  // Each job alone, by the guides: only lines with a typical range from two or more guides.
  const withRange = lines.filter((l) => l.typical.low != null);
  const compare = withRange.length
    ? {
        jobs: withRange.length,
        low: withRange.reduce((n, l) => n + l.typical.low, 0),
        high: withRange.reduce((n, l) => n + l.typical.high, 0),
        yours: withRange.reduce((n, l) => n + l.price, 0),
      }
    : null;

  // The state: its rule, the dollar limit and the advertising banner, or "check your state".
  const st = state
    ? { code: state.code, name: state.name, rule: state.rule, link: state.href, limit: state.limit || 0, banner: state.banner || '', sources: state.sources, warning: '' }
    : { code: code || '', name: '', rule: DATA.default_state.rule, link: '', limit: 0, banner: '', sources: DATA.default_state.sources, warning: '' };
  if (state && state.limit) {
    const over = state.at_or_above === false ? subtotal > state.limit : subtotal >= state.limit;
    const close = subtotal >= state.limit * LIMIT_WARN;
    const splitNote = state.split ? ' Splitting one job into smaller ones to stay under the limit is not allowed there either.' : '';
    if (over) st.warning = `This estimate is ${money.usd(subtotal)}, ${state.at_or_above === false ? 'over' : 'at or over'} ${state.name}'s ${money.usd(state.limit)} limit for work without a contractor license, before parts. Check the rule before you take it, or take only part of the list.${splitNote}`;
    else if (close) st.warning = `This estimate is ${money.usd(subtotal)} in labor, close to ${state.name}'s ${money.usd(state.limit)} limit, which counts labor and materials together. Add the parts before you say yes.${splitNote}`;
    // Utah's insurance step counts labor and materials, so it fires at 80 percent, like the limit.
    if (state.over && state.over_at && subtotal >= state.over_at * LIMIT_WARN) st.warning = `${st.warning} ${state.over}`.trim();
  }
  const notes = [...((state && state.notes) || [])];

  // Lead: homes built before 1978 and work that disturbs paint (or any window replacement).
  const built = Number(String(input.built || '').replace(/[^\d]/g, '')) || 0;
  const paintLines = lines.filter((l) => l.job.paint);
  let lead = { applies: false, text: '' };
  if (paintLines.length && !(built >= 1978)) {
    const always = paintLines.filter((l) => l.job.paint === 'always').map((l) => l.text);
    const parts2 = [built ? `Built in ${built}, before 1978.` : DATA.lead.ask, DATA.lead.area, always.length ? DATA.lead.always : '', state && state.lead ? state.lead : ''];
    lead = { applies: true, built: built || 0, items: paintLines.map((l) => l.text), text: parts2.filter(Boolean).join(' '), sources: DATA.lead.sources };
  }

  // Safety lines for ladder work and things that can tip over.
  const safety = [];
  for (const key of [...new Set(lines.map((l) => l.job.safety).filter(Boolean))]) {
    const sf = DATA.safety[key];
    if (sf) safety.push({ id: key, label: sf.label, text: sf.say, items: lines.filter((l) => l.job.safety === key).map((l) => l.text), sources: sf.sources });
  }

  // Every source behind this estimate, once.
  const used = new Map();
  const add = (list) => (list || []).forEach((s) => s && s.url && !used.has(s.url) && used.set(s.url, s.publisher));
  for (const l of lines) {
    add(l.job.time_sources);
    add(l.typical.sources);
  }
  refer.forEach((r) => add(r.sources));
  if (checks.size) add(DATA.check_sources);
  add(st.sources);
  if (lead.applies) add(lead.sources);
  safety.forEach((x) => add(x.sources));
  add(DATA.estimate.sources);
  add(DATA.materials.sources);

  return {
    parts,
    lines,
    items,
    subtotal,
    minutes: { low, high, mid: (low + high) / 2 },
    visits: visitCount,
    order,
    refer,
    checks: [...checks.values()],
    unknown,
    state: st,
    notes,
    lead,
    safety,
    compare,
    rate: R,
    sources: [...used].map(([url, publisher]) => ({ publisher, url })),
  };
}

const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

module.exports = { stateOf, estimate, minutesFor, typicalFor, timeText, statusFor, DAY_MINUTES, LIMIT_WARN };
