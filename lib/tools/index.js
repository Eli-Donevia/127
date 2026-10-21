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
// Like str, but keeps line breaks (a quote's terms).
const para = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
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

// Ad test planner: one capped test, its line (most to pay for one result; 0 reads Profit's), and a row a day.
const PLATFORMS = ['meta', 'tiktok', 'google', 'youtube', 'other'];
function cleanAdtest(d) {
  const log = arr(d.log, 60).map((r) => {
    const dayOf = day(r && r.day);
    return dayOf ? { day: dayOf, spend: num(r.spend, 0, 1e6), clicks: num(r.clicks, 0, 1e7), results: num(r.results, 0, 1e6) } : null;
  }).filter(Boolean);
  const seen = new Set();
  return {
    name: str(d.name, 60), platform: PLATFORMS.includes(d.platform) ? d.platform : 'meta', goal: d.goal === 'leads' ? 'leads' : 'sales',
    budget: num(d.budget, 0, 1e6), days: Math.round(num(d.days, 1, 60)) || 7, line: num(d.line, 0, 1e6),
    log: log.filter((r) => !seen.has(r.day) && seen.add(r.day)).sort((a, b) => (a.day < b.day ? -1 : 1)),
  };
}

// Hook bank: the 60 hooks (content/tools/hooks.json) are 127's; the member keeps stars, their own written version
// of a hook and the views a used hook got.
const HOOKS = (() => { try { return require('../../content/tools/hooks.json'); } catch (e) { return { hooks: [], captions: [], ctas: [] }; } })();
const HOOK_IDS = new Set(HOOKS.hooks.map((h) => String(h.id)));
function cleanHooks(d) {
  const mine = {}, wins = {};
  for (const [k, v] of Object.entries((d && d.mine) || {}).slice(0, 80)) if (HOOK_IDS.has(k) && str(v, 300)) mine[k] = str(v, 300);
  for (const [k, v] of Object.entries((d && d.wins) || {}).slice(0, 80)) if (HOOK_IDS.has(k)) wins[k] = num(v, 0, 1e9);
  return { stars: [...new Set(arr(d && d.stars, 80).map(String).filter((k) => HOOK_IDS.has(k)))], mine, wins };
}

// Idea scorecard: up to eight ideas, each scored 0 to 10 on the Idea Test's five questions (lib/idea-test.js).
const IDEA_KEYS = ['pain', 'economics', 'edge', 'future', 'inside'];
function cleanIdeas(d) {
  return {
    ideas: arr(d && d.ideas, 8).map((x) => {
      const scores = {};
      for (const k of IDEA_KEYS) scores[k] = Math.round(num(x && x.scores && x.scores[k], 0, 10));
      return { id: key(x && x.id), name: str(x && x.name, 80), note: str(x && x.note, 280), scores };
    }).filter((x) => x.id && (x.name || x.note)),
  };
}

// Checklists: which items are done (by the manifest's stable ids, content/tools/checklists.json) and when, plus
// a launch date for the dated list.
const LISTS = (() => { try { return require('../../content/tools/checklists.json'); } catch (e) { return { lists: [] }; } })();
const ITEM_IDS = new Set(LISTS.lists.flatMap((l) => l.groups.flatMap((g) => g.items.map((i) => i.id))));
function cleanChecklists(d) {
  const done = {};
  for (const [k, v] of Object.entries((d && d.done) || {}).slice(0, 400)) if (ITEM_IDS.has(k)) done[k] = day(v) || new Date(deps.now()).toISOString().slice(0, 10);
  return { done, launch: day(d && d.launch) };
}

// Stock and reorder: each product's stock, how fast it sells and how long a reorder takes.
function cleanStock(d) {
  return {
    items: arr(d && d.items, 80).map((x) => ({ id: key(x && x.id), name: str(x && x.name, 60), onHand: num(x && x.onHand, 0, 1e7), perWeek: num(x && x.perWeek, 0, 1e6), leadWeeks: num(x && x.leadWeeks, 0, 52), order: num(x && x.order, 0, 1e7), cost: num(x && x.cost, 0, 1e6) })).filter((x) => x.id && (x.name || x.onHand)),
  };
}

// Hours and tools audit: last week's tasks tagged, and every tool paid for with its one job.
const TAGS = ['me', 'repeat', 'waste'];
function cleanHours(d) {
  return {
    tasks: arr(d && d.tasks, 60).map((x) => ({ id: key(x && x.id), name: str(x && x.name, 60), hours: num(x && x.hours, 0, 168), tag: TAGS.includes(x && x.tag) ? x.tag : 'me' })).filter((x) => x.id && (x.name || x.hours)),
    tools: arr(d && d.tools, 40).map((x) => ({ id: key(x && x.id), name: str(x && x.name, 50), cost: num(x && x.cost, 0, 1e5), job: str(x && x.job, 60), used: !!(x && x.used) })).filter((x) => x.id && (x.name || x.cost)),
  };
}

// Content calendar: three pillars, a rhythm, and a post per planned day (keyed by date).
const POST_STATES = ['idea', 'ready', 'posted'];
function cleanContent(d) {
  const posts = {};
  for (const [k, v] of Object.entries((d && d.posts) || {}).slice(0, 120)) {
    if (!day(k)) continue;
    posts[k] = { pillar: Math.round(num(v && v.pillar, 0, 2)), hook: str(v && v.hook, 200), state: POST_STATES.includes(v && v.state) ? v.state : 'idea', views: num(v && v.views, 0, 1e9) };
  }
  const days = arr(d && d.days, 7).map((n) => Math.round(num(n, 0, 6)));
  return { pillars: [0, 1, 2].map((i) => str(d && d.pillars && d.pillars[i], 40)), platform: str(d && d.platform, 30), days: [...new Set(days)].sort(), start: day(d && d.start), posts };
}

// Week builder: the member's goals, the days and hours they work, how many hours a week each kind of block gets,
// and the week of blocks. Device only (Legal L92 HT8): the page keeps all of it in the member's browser, so there is
// no save, clear or export route for it and this cleaner only documents the shape the page keeps.
const BLOCK_KINDS = ['deep', 'sales', 'content', 'admin', 'faith', 'health', 'family', 'other'];
const hhmm = (v, dflt) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : dflt);
const quarter = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(num(v, lo, hi) / 15) * 15));
function cleanWeek(d) {
  const want = {};
  for (const k of BLOCK_KINDS) want[k] = num(d && d.want && d.want[k], 0, 80);
  const days = arr(d && d.days, 7).map((n) => Math.round(num(n, 0, 6)));
  const blocks = arr(d && d.blocks, 140).map((b) => {
    const from = quarter(b && b.from, 0, 1425);
    return { id: key(b && b.id), kind: BLOCK_KINDS.includes(b && b.kind) ? b.kind : 'other', day: Math.round(num(b && b.day, 0, 6)), from, len: quarter(b && b.len, 15, Math.min(480, 1440 - from)), label: str(b && b.label, 40) };
  }).filter((b) => b.id);
  return { goals: [0, 1, 2].map((i) => str(d && d.goals && d.goals[i], 80)), days: [...new Set(days)].sort(), start: hhmm(d && d.start, '09:00'), end: hhmm(d && d.end, '17:00'), want, blocks };
}

// Money overview: the member's own month totals (typed, or added up in their browser from a bank CSV; only the
// totals are kept here, never the transactions, and the category rules stay in the browser, L92 MO2), cash at each
// month end, and bills and invoices with a due date. Costs are an array in the order of `cats`.
const month = (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? String(v) : null);
function cleanMoney(d) {
  const cats = arr(d && d.cats, 12).map((c) => str(c, 30)).filter(Boolean);
  const seen = new Set();
  const months = arr(d && d.months, 36).map((m) => {
    const at = month(m && m.month);
    if (!at || seen.has(at)) return null;
    seen.add(at);
    const costs = cats.map((_, i) => num(m.costs && m.costs[i], 0, 1e9));
    return { month: at, revenue: num(m.revenue, 0, 1e9), costs, cash: m.cash === '' || m.cash == null ? null : num(m.cash, -1e9, 1e9) };
  }).filter(Boolean).sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 24);
  const due = (x) => ({ id: key(x && x.id), name: str(x && x.name, 40), amount: num(x && x.amount, 0, 1e9), due: day(x && x.due), paid: !!(x && x.paid) });
  return { cats, months, bills: arr(d && d.bills, 40).map(due).filter((x) => x.id && (x.name || x.amount)), invoices: arr(d && d.invoices, 60).map(due).filter((x) => x.id && (x.name || x.amount)) };
}

// Clients and sessions (Legal L92): a first name or nickname, one optional way to reach them, the package, sessions
// bought, a short note and each session. HQ never sends to, looks up or enriches the way to reach them, and it isn't
// copied to Pipeline; the page only turns it into a mailto: or tel: link. Each client deletes on its own.
const CLIENT_STATES = ['active', 'paused', 'done'];
const SESSION_STATES = ['planned', 'done', 'noshow'];
function cleanClients(d) {
  let room = 250; // sessions in all, newest kept, so the fullest document still fits
  const clients = arr(d && d.clients, 40).map((c) => {
    const sessions = arr(c && c.sessions, 120).map((x) => {
      const at = day(x && x.day);
      return at ? { id: key(x.id), day: at, len: quarter(x.len, 15, 480), state: SESSION_STATES.includes(x.state) ? x.state : 'planned' } : null;
    }).filter((x) => x && x.id).sort((a, b) => (a.day < b.day ? 1 : -1));
    return { id: key(c && c.id), name: str(c && c.name, 40), reach: str(c && c.reach, 80), pkg: str(c && c.pkg, 40), bought: Math.round(num(c && c.bought, 0, 500)), status: CLIENT_STATES.includes(c && c.status) ? c.status : 'active', note: str(c && c.note, 280), sessions };
  }).filter((c) => c.id && (c.name || c.pkg || c.sessions.length));
  for (const c of clients) { c.sessions = c.sessions.slice(0, Math.max(0, room)); room -= c.sessions.length; }
  return { clients };
}

// Interview board (Legal L92): who they are in a few words, the day, what they said to three questions, how much the
// problem hurts them from what they said (0 to 3), and what they said they'd pay, kept as typed. Nothing adds the
// amounts up or projects from them.
function cleanInterviews(d) {
  return {
    idea: str(d && d.idea, 80),
    people: arr(d && d.people, 40).map((x) => ({ id: key(x && x.id), who: str(x && x.who, 40), day: day(x && x.day), done: !!(x && x.done), pain: Math.round(num(x && x.pain, 0, 3)), last: str(x && x.last, 240), tried: str(x && x.tried, 240), stop: str(x && x.stop, 240), pay: str(x && x.pay, 40) }))
      .filter((x) => x.id && (x.who || x.last || x.tried || x.stop || x.pay)),
  };
}

// Quote builder (Legal L92): the member's business name, and quotes with line items, their own tax rate (127 doesn't
// work out sales tax), a valid-until date and their own terms (empty to start). A quote's share link (QL1-QL4) is
// made on the server only, so the page can't post one: `keep` carries it over from the saved document.
const QUOTE_STATES = ['draft', 'sent', 'accepted', 'declined'];
function cleanQuote(d) {
  return {
    from: str(d && d.from, 60),
    quotes: arr(d && d.quotes, 10).map((q) => ({
      id: key(q && q.id), number: str(q && q.number, 20), client: str(q && q.client, 60), title: str(q && q.title, 80),
      items: arr(q && q.items, 20).map((i) => ({ name: str(i && i.name, 80), qty: num(i && i.qty, 0, 1e5), price: num(i && i.price, 0, 1e7) })).filter((i) => i.name || i.price),
      tax: num(q && q.tax, 0, 30), made: day(q && q.made), until: day(q && q.until), terms: para(q && q.terms, 600), state: QUOTE_STATES.includes(q && q.state) ? q.state : 'draft',
    })).filter((q) => q.id),
  };
}
function keepQuote(was, data) {
  const share = {};
  for (const q of (was && was.quotes) || []) if (q.share) share[q.id] = q.share;
  for (const q of data.quotes) if (share[q.id]) q.share = share[q.id];
  return data;
}
const quoteTotals = (q) => {
  const sub = q.items.reduce((n, i) => n + i.qty * i.price, 0), tax = Math.round(sub * q.tax) / 100;
  return { sub, tax, total: sub + tax };
};
// A share link stops at the end of its valid-until day or 90 days after it was made, whichever comes first (QL3).
const SHARE_DAYS = 90;
const shareEnds = (q) => {
  const made = Date.parse(q.share.at) + SHARE_DAYS * 864e5, until = q.until ? Date.parse(`${q.until}T23:59:59`) : Infinity;
  return Math.min(made, until);
};

const TOOLS = [
  { id: 'conversion', tier: 'builder', title: 'Conversion tracker', short: 'Conversion', line: 'Every step of your funnel, the rate between them and where you lose people, week over week.', replaces: ['weekly-scorecard'], clean: cleanConversion },
  { id: 'profit', tier: 'free', title: 'Profit and break-even', short: 'Profit', line: 'What one sale really leaves you, how many sales cover your month and what a customer is worth.', replaces: ['break-even', 'first-sale-math', 'unit-economics'], clean: cleanProfit },
  { id: 'money', tier: 'builder', title: 'Money overview', short: 'Money', line: 'Revenue, costs, profit and cash by month, where the money goes, and the bills and invoices that are due.', replaces: [], clean: cleanMoney, quiet: true, deviceKeys: true },
  { id: 'cash', tier: 'builder', title: 'Cash runway', short: 'Cash', line: 'Thirteen weeks of cash ahead, with the tightest week called out while you can still move it.', replaces: ['cash-flow-13-week', 'business-budget'], clean: cleanCash },
  { id: 'adtest', tier: 'builder', title: 'Ad test planner', short: 'Ad test', line: 'A capped test with its stop line set from your own numbers, logged day by day, with a straight verdict.', replaces: ['ad-test-planner'], clean: cleanAdtest },
  { id: 'hooks', tier: 'builder', title: 'Hook bank', short: 'Hooks', line: 'Sixty hooks to write in your own words, copy in one tap and keep score on the ones that worked.', replaces: ['hook-bank'], clean: cleanHooks, content: () => HOOKS },
  { id: 'ideas', tier: 'free', title: 'Idea scorecard', short: 'Ideas', line: 'Score your ideas on the five questions side by side and see which one to test first.', replaces: ['idea-scorecard'], clean: cleanIdeas },
  { id: 'content', tier: 'free', title: 'Content calendar', short: 'Content', line: 'Three pillars, a rhythm you can keep and four weeks of dated posts, from idea to posted.', replaces: ['content-planner', 'notion-content-os'], clean: cleanContent },
  { id: 'stock', tier: 'builder', title: 'Stock and reorder', short: 'Stock', line: 'Weeks of stock left for every product and the day to reorder before you run out.', replaces: ['inventory-reorder'], clean: cleanStock },
  { id: 'hours', tier: 'builder', title: 'Hours and tools audit', short: 'Hours', line: 'Where last week went and what you pay for, sorted into keep, hand off and cut.', replaces: ['hours-audit', 'stack-audit'], clean: cleanHours },
  { id: 'week', tier: 'free', title: 'Week builder', short: 'Week', line: 'Your goals and the hours you have in, a week of time blocks out. Move any block, then add the week to your calendar.', replaces: [], clean: cleanWeek, device: true },
  { id: 'clients', tier: 'builder', title: 'Clients and sessions', short: 'Clients', line: 'Who you work with, what they bought, the sessions used and left, and who is running low.', replaces: ['client-sessions'], clean: cleanClients },
  { id: 'interviews', tier: 'free', title: 'Interview board', short: 'Interviews', line: 'Every customer conversation on one board: what hurts, what they tried, what stops them, in their words.', replaces: ['interview-synthesis', 'objection-log'], clean: cleanInterviews },
  { id: 'quote', tier: 'builder', title: 'Quote builder', short: 'Quote', line: 'Line items, your tax rate and your terms, laid out clean, with a private link to send.', replaces: ['quote'], clean: cleanQuote, keep: keepQuote },
  { id: 'checklists', tier: 'builder', title: 'Checklists', short: 'Checklists', line: 'Launch countdown, before you take money, page leak audit and batch day, with progress and dates.', replaces: ['launch-countdown', 'money-setup-checklist', 'page-leak-audit', 'batch-day'], clean: cleanChecklists, content: () => LISTS },
];
const BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// Legal clears each tool by id before members see it (L82: conversion, profit, cash). A tool not listed here is held:
// only admins see it, so it can be reviewed in production. Clearing one is adding its id after Legal's line.
// L92 (Oct 21) cleared the rest, with its wording changes, and Clients, Interviews and Quote with their field rules.
const CLEARED = new Set(['money', 'conversion', 'profit', 'cash', 'adtest', 'hooks', 'ideas', 'content', 'stock', 'hours', 'week', 'clients', 'interviews', 'quote', 'checklists']);
for (const t of TOOLS) Object.defineProperty(t, 'held', { get: () => !CLEARED.has(t.id), enumerable: true });

// ---------- the member's documents ----------

const docId = (memberId, toolId) => `${memberId}.${toolId}`;
const get = (toolId, { all = false } = {}) => { const t = BY_ID[toolId]; return t && (all || !t.held) ? t : null; };
const list = ({ all = false } = {}) => TOOLS.filter((t) => all || !t.held);

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
  const t = get(toolId, { all: true });
  if (!t) throw new Error('unknown tool');
  const id = docId(memberId, toolId), was = deps.db.get('tools', id), now = new Date(deps.now()).toISOString();
  let data = t.clean(body && typeof body === 'object' ? body : {});
  if (t.keep) data = t.keep(was && was.data, data);
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) { const e = new Error('too big'); e.status = 413; throw e; }
  await deps.db.save('tools', { id, memberId, tool: toolId, data, createdAt: was ? was.createdAt : now, updatedAt: now });
  return data;
}

async function clear(memberId, toolId) {
  if (deps.db.get('tools', docId(memberId, toolId))) await deps.db.remove('tools', docId(memberId, toolId));
}

// A quote's share link (Legal L92 QL1-QL4): a random 144-bit token, never the quote's or member's id. Turning it off
// deletes the token, so the old link is dead for good; turning it on again makes a new one.
async function share(memberId, quoteId, on) {
  const id = docId(memberId, 'quote'), doc = deps.db.get('tools', id);
  const q = doc && doc.data.quotes.find((x) => x.id === quoteId);
  if (!q) return null;
  if (on) q.share = { token: require('crypto').randomBytes(18).toString('base64url'), at: new Date(deps.now()).toISOString() };
  else delete q.share;
  await deps.db.save('tools', { ...doc, updatedAt: new Date(deps.now()).toISOString() });
  return q.share ? { token: q.share.token, at: q.share.at, ends: new Date(shareEnds(q)).toISOString() } : { token: null };
}
// The quote behind a share link, or why there isn't one: 'gone' (no such link, or turned off) or 'expired'.
function shared(token) {
  if (!/^[A-Za-z0-9_-]{24}$/.test(String(token))) return { gone: true };
  for (const doc of deps.db.filter('tools', (x) => x.tool === 'quote')) {
    const q = ((doc.data && doc.data.quotes) || []).find((x) => x.share && x.share.token === token);
    if (!q) continue;
    if (deps.now() > shareEnds(q)) return { expired: true };
    return { from: doc.data.from, quote: q, totals: quoteTotals(q) };
  }
  return { gone: true };
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
  } else if (toolId === 'adtest') {
    rows.push(['Day', 'Spend', 'Clicks', 'Results']);
    for (const r of data.log) rows.push([r.day, r.spend, r.clicks, r.results]);
  } else if (toolId === 'hooks') {
    rows.push(['Hook', 'Starred', 'My version', 'Views']);
    for (const h of HOOKS.hooks) { const k = String(h.id); if (data.stars.includes(k) || data.mine[k] || data.wins[k]) rows.push([h.text, data.stars.includes(k) ? 'yes' : '', data.mine[k] || '', data.wins[k] || '']); }
  } else if (toolId === 'ideas') {
    rows.push(['Idea', ...IDEA_KEYS, 'Total', 'Note']);
    for (const x of data.ideas) rows.push([x.name, ...IDEA_KEYS.map((k) => x.scores[k]), IDEA_KEYS.reduce((n, k) => n + x.scores[k], 0), x.note]);
  } else if (toolId === 'stock') {
    rows.push(['Product', 'On hand', 'Sold a week', 'Lead time (weeks)', 'Reorder quantity', 'Unit cost']);
    for (const x of data.items) rows.push([x.name, x.onHand, x.perWeek, x.leadWeeks, x.order, x.cost]);
  } else if (toolId === 'hours') {
    rows.push(['Kind', 'Name', 'Hours or $ a month', 'Tag or job', 'Used in 30 days']);
    for (const x of data.tasks) rows.push(['task', x.name, x.hours, x.tag, '']);
    for (const x of data.tools) rows.push(['tool', x.name, x.cost, x.job, x.used ? 'yes' : 'no']);
  } else if (toolId === 'content') {
    rows.push(['Date', 'Pillar', 'Hook', 'State', 'Views']);
    for (const k of Object.keys(data.posts).sort()) { const p = data.posts[k]; rows.push([k, data.pillars[p.pillar] || '', p.hook, p.state, p.views || '']); }
  } else if (toolId === 'money') {
    rows.push(['Month', 'Revenue', ...data.cats, 'Cash at month end']);
    for (const m of data.months) rows.push([m.month, m.revenue, ...m.costs, m.cash == null ? '' : m.cash]);
    rows.push([]);
    rows.push(['Kind', 'Name', 'Amount', 'Due', 'Paid']);
    for (const x of data.bills) rows.push(['bill', x.name, x.amount, x.due || '', x.paid ? 'yes' : 'no']);
    for (const x of data.invoices) rows.push(['invoice', x.name, x.amount, x.due || '', x.paid ? 'yes' : 'no']);
  } else if (toolId === 'clients') {
    rows.push(['Client', 'How to reach them', 'Package', 'Sessions bought', 'Status', 'Note', 'Session day', 'Minutes', 'Session']);
    for (const c of data.clients) {
      const base = [c.name, c.reach, c.pkg, c.bought, c.status, c.note];
      if (!c.sessions.length) rows.push(base);
      for (const x of c.sessions) rows.push([...base, x.day, x.len, x.state]);
    }
  } else if (toolId === 'interviews') {
    rows.push(['Who', 'Day', 'Talked', 'How much it hurts (0-3)', 'Last time it came up', 'What they tried', 'What would stop them', 'What they said they\'d pay']);
    for (const x of data.people) rows.push([x.who, x.day || '', x.done ? 'yes' : 'no', x.pain, x.last, x.tried, x.stop, x.pay]);
  } else if (toolId === 'quote') {
    rows.push(['Quote', 'Client', 'Title', 'Status', 'Made', 'Valid until', 'Item', 'Qty', 'Price', 'Line total', 'Tax %']);
    for (const q of data.quotes) for (const i of q.items) rows.push([q.number, q.client, q.title, q.state, q.made || '', q.until || '', i.name, i.qty, i.price, Math.round(i.qty * i.price * 100) / 100, q.tax]);
  } else if (toolId === 'checklists') {
    rows.push(['List', 'Step', 'Done on']);
    for (const l of LISTS.lists) for (const g of l.groups) for (const i of g.items) rows.push([l.title, i.text, data.done[i.id] || '']);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { CLEARED, list, get, load, save, clear, share, shared, quoteTotals, SHARE_DAYS, forget, linked, csv, docId, MAX_BYTES, _deps: deps, _clean: { cleanClients, cleanInterviews, cleanQuote, cleanMoney, cleanWeek, cleanConversion, cleanProfit, cleanCash, cleanAdtest, cleanHooks, cleanIdeas, cleanChecklists, cleanStock, cleanHours, cleanContent } };
