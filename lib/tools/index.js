// Native HQ tools (flag HQ_TOOLS, lib/harness/flags.js): the Store's spreadsheets rebuilt as live tools in HQ.
// Each tool is a page with its own script (public/js/tools/<id>.js) over one saved document per member and tool, in
// the `tools` collection (doc id `<memberId>.<toolId>`). The page saves as the member types; nothing here calls AI,
// and nothing leaves HQ except the member's own CSV export.
//
// A tool's `clean` takes whatever the page posted and keeps only its own fields, clipped and clamped, so a tool
// document is always the shape its page expects. `replaces` lists the Store items the tool takes over (the triage,
// /mnt/project-files/v2/tools/triage.json): the Store item page points to the tool once it's on.

const deps = { db: require('../db'), now: () => Date.now() };

const MAX_BYTES = 48000;
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const num = (v, lo = 0, hi = 1e9) => {
  const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x * 100) / 100)) : 0;
};
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) && Number.isFinite(Date.parse(v)) ? String(v) : null);
const key = (v) => str(v, 24).replace(/[^A-Za-z0-9_-]/g, '') || null;

// ---------- the tools ----------

// Conversion tracker: the member's funnel steps and one row of counts a week.
function cleanConversion(d) {
  const steps = arr(d.steps, 7).map((s) => ({ id: key(s && s.id), name: str(s && s.name, 40) })).filter((s) => s.id && s.name);
  const ids = new Set(steps.map((s) => s.id));
  const weeks = arr(d.weeks, 104).map((w) => {
    const start = day(w && w.start);
    if (!start) return null;
    const counts = {};
    for (const id of ids) counts[id] = num(w.counts && w.counts[id], 0, 1e8);
    return { start, counts, revenue: num(w.revenue, 0, 1e9) };
  }).filter(Boolean);
  // One row per week, newest first.
  const seen = new Set();
  return { steps, weeks: weeks.filter((w) => !seen.has(w.start) && seen.add(w.start)).sort((a, b) => (a.start < b.start ? 1 : -1)) };
}

// Profit and break-even: one offer's price and costs, and how long a customer stays.
const PROFIT_KEYS = { price: [0, 1e6], unitCost: [0, 1e6], feePct: [0, 50], feeFlat: [0, 100], hours: [0, 1000], fixed: [0, 1e7], cac: [0, 1e6], repeats: [1, 120], salesNow: [0, 1e6] };
function cleanProfit(d) {
  const out = { name: str(d.name, 60) };
  for (const [k, [lo, hi]] of Object.entries(PROFIT_KEYS)) out[k] = num(d[k], lo, hi);
  return out;
}

// Cash runway: cash today, what repeats, and one-offs on a given week.
const EVERY = ['week', 'two', 'month'];
function cleanCash(d) {
  const line = (l) => ({ name: str(l && l.name, 50), amount: num(l && l.amount, 0, 1e8), every: EVERY.includes(l && l.every) ? l.every : 'month' });
  return {
    start: day(d.start),
    cash: num(d.cash, -1e9, 1e9),
    ins: arr(d.ins, 30).map(line).filter((l) => l.name || l.amount),
    outs: arr(d.outs, 40).map(line).filter((l) => l.name || l.amount),
    once: arr(d.once, 60).map((o) => ({ name: str(o && o.name, 50), amount: num(o && o.amount, -1e8, 1e8), week: Math.round(num(o && o.week, 1, 13)) })).filter((o) => o.name || o.amount),
  };
}

const TOOLS = [
  { id: 'conversion', tier: 'builder', title: 'Conversion tracker', short: 'Conversion', line: 'Every step of your funnel, the rate between them and where you lose people, week over week.', replaces: ['weekly-scorecard'], clean: cleanConversion },
  { id: 'profit', tier: 'free', title: 'Profit and break-even', short: 'Profit', line: 'What one sale really leaves you, how many sales cover your month and what a customer is worth.', replaces: ['break-even', 'first-sale-math', 'unit-economics'], clean: cleanProfit },
  { id: 'cash', tier: 'builder', title: 'Cash runway', short: 'Cash', line: 'Thirteen weeks of cash ahead, with the tightest week called out while you can still move it.', replaces: ['cash-flow-13-week', 'business-budget'], clean: cleanCash },
];
const BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// ---------- the member's documents ----------

const docId = (memberId, toolId) => `${memberId}.${toolId}`;
const get = (toolId) => BY_ID[toolId] || null;
const list = () => TOOLS;

function load(memberId, toolId) {
  const d = deps.db.get('tools', docId(memberId, toolId));
  return d ? d.data : null;
}

// What the member's other tools say that this one reads: the Ad test planner and Conversion tracker read Profit's
// numbers. Only ever the member's own documents.
function linked(memberId) {
  return { profit: load(memberId, 'profit') };
}

async function save(memberId, toolId, body) {
  const t = get(toolId);
  if (!t) throw new Error('unknown tool');
  const data = t.clean(body && typeof body === 'object' ? body : {});
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) { const e = new Error('too big'); e.status = 413; throw e; }
  const id = docId(memberId, toolId), was = deps.db.get('tools', id), now = new Date(deps.now()).toISOString();
  await deps.db.save('tools', { id, memberId, tool: toolId, data, createdAt: was ? was.createdAt : now, updatedAt: now });
  return data;
}

async function clear(memberId, toolId) {
  if (deps.db.get('tools', docId(memberId, toolId))) await deps.db.remove('tools', docId(memberId, toolId));
}

// Account deletion (lib/harness/index.js forget).
async function forget(memberId) {
  for (const d of deps.db.filter('tools', (x) => x.memberId === memberId)) await deps.db.remove('tools', d.id);
}

// The member's own export: rows as CSV, one table per tool.
const cell = (v) => {
  const s = String(v == null ? '' : v);
  // A leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
function csv(toolId, data) {
  const rows = [];
  if (!data) return '';
  if (toolId === 'conversion') {
    rows.push(['Week of', ...data.steps.map((s) => s.name), 'Revenue']);
    for (const w of data.weeks) rows.push([w.start, ...data.steps.map((s) => w.counts[s.id]), w.revenue]);
  } else if (toolId === 'profit') {
    for (const k of ['name', ...Object.keys(PROFIT_KEYS)]) rows.push([k, data[k]]);
  } else if (toolId === 'cash') {
    rows.push(['Kind', 'Name', 'Amount', 'Every or week']);
    rows.push(['cash today', '', data.cash, data.start || '']);
    for (const l of data.ins) rows.push(['in', l.name, l.amount, l.every]);
    for (const l of data.outs) rows.push(['out', l.name, l.amount, l.every]);
    for (const o of data.once) rows.push(['one-off', o.name, o.amount, `week ${o.week}`]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { list, get, load, save, clear, forget, linked, csv, docId, MAX_BYTES, _deps: deps, _clean: { cleanConversion, cleanProfit, cleanCash } };
