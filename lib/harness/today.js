// Today in HQ v2: "Do my day" (the next sends, already written, from the Pipeline), the member's
// daily number (25 by default, up to 100), a scoreboard of this week against last, where their
// touches came from, the one move when the queue is empty, and receipts for what 127 did this month.
// Plain names only on screen (v2/hormozi-playbook.md: no borrowed framework names). Days and weeks
// are Eastern time, like HQ's weekly numbers.

const deps = { db: require('../db'), now: () => Date.now() };
const packs = require('./packs');
const inbox = require('./inbox');
const pipeline = require('./pipeline');
const { clip } = require('./text');

const KINDS = ['warm', 'cold', 'content', 'ads'];
const LABELS = { warm: 'People you know', cold: 'New people', content: 'Posts', ads: 'Ads' };
const HINTS = {
  warm: 'Friends, past clients, people who follow you.',
  cold: "Businesses and people who don't know you yet.",
  content: 'Posts, Reels and videos you put out.',
  ads: 'Ads you ran. Only once something already sells.',
};
const TZ = 'America/New_York';
const MAX_PER_KIND = 5000;
const DEFAULT_TARGET = 25;
const MAX_TARGET = 100;
const MINUTES_PER_SEND = 0.8;
const MAX_FOLLOW_UPS = 2;

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
function dayKey(ms = deps.now()) {
  return fmtDay.format(new Date(ms));
}
function addDays(key, n) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekStart(key) {
  const d = new Date(`${key}T12:00:00Z`);
  return addDays(key, -((d.getUTCDay() + 6) % 7));
}

const blank = (memberId, day) => ({ id: `${memberId}:${day}`, memberId, day, counts: { warm: 0, cold: 0, content: 0, ads: 0 }, total: 0 });
const docOf = (memberId, day) => deps.db.get('actions', `${memberId}:${day}`) || blank(memberId, day);

// The member's daily number (Your business): 25 unless they set another, at most 100.
function target(user) {
  const b = deps.db.get('brains', user.id);
  const n = Number(b && b.goal && b.goal.daily);
  return Number.isInteger(n) && n >= 1 && n <= MAX_TARGET ? n : DEFAULT_TARGET;
}

// n can be negative (an undo). Counts never go below zero.
async function log(memberId, kind, n = 1) {
  if (!KINDS.includes(kind)) throw new Error('Unknown kind of action.');
  const d = docOf(memberId, dayKey());
  d.counts[kind] = Math.max(0, Math.min(MAX_PER_KIND, (d.counts[kind] || 0) + Math.round(Number(n) || 0)));
  d.total = KINDS.reduce((a, k) => a + (d.counts[k] || 0), 0);
  await deps.db.save('actions', d);
  return d;
}

// Today against the daily number, and the streak of days that hit it.
function hundred(user) {
  const t = target(user);
  const today = dayKey();
  const d = docOf(user.id, today);
  let streak = 0;
  for (let k = d.total >= t ? today : addDays(today, -1), i = 0; i < 400; i++, k = addDays(k, -1)) {
    const x = deps.db.get('actions', `${user.id}:${k}`);
    if (!x || x.total < t) break;
    streak += 1;
  }
  const daysAt = deps.db.filter('actions', (a) => a.memberId === user.id && a.total >= t).length;
  return { target: t, today: d.total, counts: d.counts, done: d.total >= t, left: Math.max(0, t - d.total), pct: Math.min(100, Math.round((d.total / t) * 100)), streak, daysAt };
}

function week(user) {
  const start = weekStart(dayKey());
  const counts = { warm: 0, cold: 0, content: 0, ads: 0 };
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = deps.db.get('actions', `${user.id}:${addDays(start, i)}`);
    days.push(d ? d.total : 0);
    if (d) for (const k of KINDS) counts[k] += d.counts[k] || 0;
  }
  return { start, days, four: KINDS.map((k) => ({ kind: k, label: LABELS[k], hint: HINTS[k], value: counts[k] })) };
}

// This week against last: touches in (sends the member logged) and what came back (replies, calls,
// yeses, from each lead's stage history), plus how fast they answered a reply (speed to lead).
function scoreboard(user) {
  const start = weekStart(dayKey());
  const last = addDays(start, -7);
  const end = addDays(start, 7);
  const blankWeek = () => ({ touches: 0, replies: 0, calls: 0, yeses: 0, answerHours: null });
  const out = { this: blankWeek(), last: blankWeek() };
  for (let i = 0; i < 14; i++) {
    const k = addDays(last, i);
    const d = deps.db.get('actions', `${user.id}:${k}`);
    if (d) out[k < start ? 'last' : 'this'].touches += (d.counts.warm || 0) + (d.counts.cold || 0);
  }
  const map = { replied: 'replies', call: 'calls', won: 'yeses' };
  const waits = { this: [], last: [] };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === user.id)) {
    for (const h of l.history || []) {
      if (!map[h.stage]) continue;
      const k = dayKey(Date.parse(h.at));
      if (k >= last && k < end) out[k < start ? 'last' : 'this'][map[h.stage]] += 1;
    }
    if (l.repliedAt && l.answeredAt && Date.parse(l.answeredAt) >= Date.parse(l.repliedAt)) {
      const k = dayKey(Date.parse(l.repliedAt));
      if (k >= last && k < end) waits[k < start ? 'last' : 'this'].push((Date.parse(l.answeredAt) - Date.parse(l.repliedAt)) / 36e5);
    }
  }
  for (const w of ['this', 'last']) {
    const xs = waits[w].sort((a, b) => a - b);
    if (xs.length) out[w].answerHours = Math.round(xs[Math.floor((xs.length - 1) / 2)] * 10) / 10;
  }
  return out;
}

// ---------- Do my day ----------

const DAY = 864e5;
const parseMs = (iso) => (iso ? Date.parse(iso) : NaN);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function handleOf(url, host) {
  const m = String(url || '').match(new RegExp(`^https?://(?:www\\.|m\\.)?${host.replace('.', '\\.')}/(?:pg/)?([A-Za-z0-9_.-]{1,80})/?`, 'i'));
  return m && !/^(p|reel|reels|share|sharer|profile\.php|pages|groups|events|watch|explore)$/i.test(m[1]) ? m[1] : null;
}
function ago(iso) {
  const h = Math.max(0, Math.round((deps.now() - parseMs(iso)) / 36e5));
  if (h < 1) return 'just now';
  if (h < 24) return `${plural(h, 'hour', 'hours')} ago`;
  return `${plural(Math.round(h / 24), 'day', 'days')} ago`;
}

// The ways to reach a lead, best first, each with the message that fits it. A first message to
// someone new never offers a text (no cold texts to cell numbers); a call gets the walk-in script.
function waysFor(l, kind) {
  const L = l.links || {};
  const m = l.msg || {};
  const pick = (k) => (kind === 'new' ? m[k] || m.dm || m.email || '' : kind === 'follow' ? ((l.touches || 0) >= 2 ? m.follow2 : m.follow1) || '' : kind === 'reply' ? m.answer || '' : '');
  const out = [];
  const ig = handleOf(L.instagram, 'instagram.com');
  if (ig) out.push({ id: 'ig', label: 'Instagram', href: `https://ig.me/m/${encodeURIComponent(ig)}`, text: pick('dm'), copy: true });
  if (L.email) {
    const body = pick('email');
    const subject = kind === 'new' ? m.subject || '' : kind === 'follow' || kind === 'reply' ? `Re: ${m.subject || 'my note'}` : '';
    out.push({ id: 'email', label: 'Email', href: `mailto:${encodeURIComponent(L.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`, text: body, subject, copy: false });
  }
  const fb = handleOf(L.facebook, 'facebook.com');
  if (fb) out.push({ id: 'fb', label: 'Facebook', href: `https://m.me/${encodeURIComponent(fb)}`, text: pick('dm'), copy: true });
  if (L.website && !L.email && kind === 'new') out.push({ id: 'site', label: 'Their website', href: L.website, text: pick('email'), copy: true });
  if (L.phone) out.push({ id: 'call', label: kind === 'new' ? 'Call or walk in' : 'Call', href: `tel:${String(L.phone).replace(/[^\d+]/g, '')}`, text: kind === 'new' ? m.walkin || pick('dm') : pick('dm'), copy: false });
  const first = out.findIndex((w) => w.id === l.channel);
  if (first > 0) out.unshift(out.splice(first, 1)[0]);
  return out;
}

// A draft that still holds a [placeholder] can't be copied or opened until it's filled in
// (v2/hormozi-playbook.md 2.3 item 16).
const HOLE = /\[[^\]\n]{2,40}\]/;

function item(l, kind, extra = {}) {
  const ways = waysFor(l, kind);
  const text = ways.length ? ways[0].text : '';
  const hole = (String(text).match(HOLE) || [])[0] || '';
  return {
    id: l.id,
    kind,
    // A Google business has no stored name (Legal L53); the page fetches it (lib/harness/places.js).
    name: l.name || l.company || (l.placeId ? 'A business on Google Maps' : l.key),
    placeId: l.placeId || '',
    company: l.name && l.company ? l.company : '',
    fact: (l.facts || [])[0] || '',
    note: l.note || '',
    warm: !!l.warm,
    sample: !!(l.data && l.data.sample),
    ways,
    text,
    needsDraft: (kind === 'new' || kind === 'follow') && !text,
    reply: kind === 'reply' ? l.reply || '' : '',
    hole,
    ...extra,
  };
}

// Built fresh on every look from the Pipeline: replies to answer, calls to prep, follow-ups due,
// then new leads (best score first). Each item has its message written when the pack or the free
// tool wrote one; "Write it for me" fills the rest.
function queue(user, { limit = MAX_TARGET } = {}) {
  const now = deps.now();
  const h = hundred(user);
  const leads = deps.db.filter('pipeline', (x) => x.memberId === user.id);
  const awake = (l) => !l.snoozeUntil || parseMs(l.snoozeUntil) <= now;
  // Leads the member approved on Monday's card come first this week.
  const wk = weekStart(dayKey(now));
  const pinned = (a, b) => Number(b.week === wk) - Number(a.week === wk);
  const preps = new Map();
  for (const r of deps.db.filter('runs', (x) => x.memberId === user.id && x.workflowId === 'hq.call_prep' && x.status === 'done')) preps.set(r.inputs && r.inputs.lead, r.id);

  const replies = leads
    .filter((l) => l.stage === 'replied' && awake(l) && !(l.answeredAt && parseMs(l.answeredAt) >= parseMs(l.repliedAt)))
    .sort((a, b) => String(a.repliedAt).localeCompare(String(b.repliedAt)))
    .map((l) => item(l, 'reply', { why: `Replied ${ago(l.repliedAt)}. Answer while it's warm.` }));
  const calls = leads
    .filter((l) => l.stage === 'call' && awake(l))
    .map((l) => item(l, 'call', { why: 'Call booked. Walk in knowing what to ask.', prepRun: preps.get(l.id) || null }));
  const follows = leads
    .filter((l) => l.stage === 'contacted' && awake(l) && l.nextAt && parseMs(l.nextAt) <= now && (l.touches || 1) <= MAX_FOLLOW_UPS)
    .sort((a, b) => pinned(a, b) || String(a.nextAt).localeCompare(String(b.nextAt)))
    .map((l) => item(l, 'follow', { why: `Follow-up ${Math.min(l.touches || 1, MAX_FOLLOW_UPS)} of ${MAX_FOLLOW_UPS}. You wrote ${ago(l.lastTouchAt)}.` }));
  const fresh = leads
    .filter((l) => l.stage === 'found' && awake(l))
    .sort((a, b) => pinned(a, b) || (b.score || 0) - (a.score || 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((l) => item(l, 'new', { why: (l.facts || [])[0] || 'New. Not contacted yet.' }));

  const items = replies.concat(calls, follows, fresh).slice(0, limit);
  const sends = items.filter((i) => i.kind !== 'call').length;
  return {
    target: h.target,
    done: h.today,
    left: h.left,
    streak: h.streak,
    minutes: Math.max(1, Math.ceil(Math.min(h.left || 5, sends) * MINUTES_PER_SEND)),
    counts: { reply: replies.length, call: calls.length, follow: follows.length, new: fresh.length },
    items,
    written: items.filter((i) => i.text).length,
  };
}

// A lead marked contacted is one touch: warm if the pack said so, new (cold) otherwise. A lead that
// arrives already contacted (from === null: an import) was sent before today, so it doesn't count.
async function onStage(memberId, lead, from, to) {
  if (from === null || from === undefined) return;
  if (to === 'contacted' && pipeline.STAGES.indexOf(from) < pipeline.STAGES.indexOf('contacted')) await log(memberId, lead.warm ? 'warm' : 'cold', 1);
}

// The one move, for when the queue is empty or someone asks "what now?". Order: what's waiting on
// them, then replies (closest to money), then the day's sends, then finding leads if there are
// none, then a broken run, then the best workflow to start.
function nextMove(user, { catalog = () => [] } = {}) {
  const open = inbox.list(user.id, { status: 'open', limit: 20 });
  if (open.length) {
    const first = open[open.length - 1];
    return { kind: 'inbox', title: open.length === 1 ? `${first.title}` : `${plural(open.length, 'thing is', 'things are')} waiting on you`, detail: open.length === 1 ? `${first.workflow} is paused until you do.` : `Start with: ${first.title} (${first.workflow}).`, href: `/app/hq/runs/${first.runId}`, cta: 'Open it' };
  }
  const q = queue(user, { limit: 100 });
  if (q.counts.reply) return { kind: 'replied', title: `${plural(q.counts.reply, 'person', 'people')} replied. Answer first.`, detail: 'Replies go cold in a day. 127 drafts the answer.', href: '/app/hq#day', cta: 'Answer' };
  if (q.items.length && q.left) return { kind: 'day', title: `Your ${q.target} for today`, detail: `${plural(Math.min(q.left, q.items.length), 'send is', 'sends are')} lined up${q.written ? ', already written' : ''}. About ${plural(q.minutes, 'minute', 'minutes')}.`, href: '/app/hq#day', cta: 'Start' };
  const c = pipeline.counts(user.id);
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const list = catalog(user);
  if (!total) {
    const find = list.find((w) => !w.locked && w.job === 'leads');
    if (find) return { kind: 'leads', title: 'Find your first 25', detail: `${find.title}: ${find.promise}`, href: `/app/hq/w/${find.id}`, cta: 'Find them', minutes: find.minutes };
  }
  const failed = deps.db.filter('runs', (r) => r.memberId === user.id && r.status === 'failed' && String(r.endedAt) > new Date(deps.now() - 3 * DAY).toISOString())[0];
  if (failed) return { kind: 'failed', title: `${failed.title} stopped on an error`, detail: clip(failed.error || '', 140), href: `/app/hq/runs/${failed.id}`, cta: 'Try again' };
  const pick = list.find((w) => !w.locked);
  if (pick) return { kind: 'start', title: pick.title, detail: pick.promise, href: `/app/hq/w/${pick.id}`, cta: 'Start', minutes: pick.minutes };
  return { kind: 'none', title: 'Tell 127 about your business', detail: 'It picks your first workflow from what you sell and who for.', href: '/app/hq/brain', cta: 'Set it up' };
}

// What 127 did for the member this month, as counts of work (never results, money or hours saved,
// v2/hormozi-playbook.md 1.8): lists built, messages drafted, samples made.
function receipts(user) {
  const month = new Date(deps.now()).toISOString().slice(0, 7);
  const inMonth = (iso) => String(iso || '').slice(0, 7) === month;
  const runs = deps.db.filter('runs', (r) => r.memberId === user.id && r.status === 'done' && inMonth(r.endedAt));
  const leads = deps.db.filter('pipeline', (l) => l.memberId === user.id && inMonth(l.createdAt));
  const lists = new Set(leads.map((l) => l.runId || (l.data && l.data.list && `list:${l.data.list}`)).filter(Boolean));
  let drafts = 0;
  for (const l of leads) {
    const m = l.msg || {};
    drafts += (m.dm || m.email || m.walkin ? 1 : 0) + (m.follow1 ? 1 : 0) + (m.follow2 ? 1 : 0) + (m.answer ? 1 : 0);
  }
  for (const r of runs) {
    const wf = packs.workflow(r.workflowId);
    for (const s of (wf && wf.steps) || []) {
      const t = s.tool && packs.tool(s.tool);
      const st = r.steps && r.steps[s.id];
      if (!t || t.kind !== 'ai' || t.risk !== 'draft' || /^hq\./.test(t.name) || !st || st.status !== 'done') continue;
      drafts += Array.isArray(st.output) ? st.output.filter((o) => o && !o.error).length : 1;
    }
  }
  const assets = deps.db.filter('assets', (a) => a.memberId === user.id && inMonth(a.createdAt));
  return {
    month,
    runs: runs.length,
    lists: lists.size,
    leads: leads.length,
    drafts,
    samples: assets.filter((a) => /^(video|image)\//.test(a.type) || a.type === 'text/html').length,
    files: assets.length,
    approvals: deps.db.filter('inbox', (i) => i.memberId === user.id && i.status === 'answered' && inMonth(i.closedAt)).length,
  };
}

// ---------- the price ladder ----------
// After each won client, the next price (v2/hormozi-playbook.md 2.4): the first 3 clients free as
// case studies, then 3 at half price, 3 at three quarters, then full price. Always a price per
// client from the member's own price, never a total across clients.

const LADDER = [
  { upTo: 3, pct: 0, name: 'Free, as a case study' },
  { upTo: 6, pct: 50, name: 'Half your price' },
  { upTo: 9, pct: 75, name: 'Three quarters of your price' },
];

// "$250/mo", "$1,500 per site", "500" -> { cur, n, unit }; null when there's no number.
function parsePrice(s) {
  const m = String(s || '').match(/([$£€])?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?\s*(.{0,40})/i);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, '')) * (m[3] ? 1000 : 1);
  if (!(n > 0 && n < 1e7)) return null;
  const unit = m[4].replace(/^[\s,.;:-]+/, '').replace(/[\s,.;:-]+$/, '').slice(0, 24);
  return { cur: m[1] || '$', n, unit };
}

function fmtPrice(p, pct) {
  const v = Math.round((p.n * pct) / 100);
  const num = v >= 1000 ? v.toLocaleString('en-US') : String(v);
  return `${p.cur}${num}${p.unit ? (/^\//.test(p.unit) ? p.unit : ` ${p.unit}`) : ''}`;
}

function ladder(user) {
  const won = pipeline.counts(user.id).won || 0;
  const b = deps.db.get('brains', user.id);
  const biz = (b && b.business) || {};
  const p = parsePrice(biz.price);
  const at = (pct) => (pct === 0 ? 'Free' : p ? fmtPrice(p, pct) : `${pct}% of your price`);
  const i = LADDER.findIndex((x) => won < x.upTo);
  const step = i >= 0 ? LADDER[i] : { pct: 100, name: 'Your full price' };
  const after = i >= 0 ? LADDER[i + 1] || { pct: 100, name: 'Your full price' } : null;
  const who = biz.audience && biz.audience.length <= 30 ? biz.audience : 'clients';
  const full = p ? fmtPrice(p, 100) : 'my full price';
  const script =
    step.pct === 0
      ? `I'm taking on 3 ${who} this month for free, as case studies, because that's all I can handle. In return, you use what I make, tell me honestly what works and, if you like it, leave a short review.`
      : step.pct === 50
        ? `My first case studies are done, so I'm taking 3 more ${who} at half my usual price${p ? ` (${at(50)} instead of ${full})` : ''} before it goes up.`
        : step.pct === 75
          ? `I'm taking 3 more ${who} at ${at(75)} before my price goes to ${full}.`
          : p
            ? `My price is ${full}.`
            : '';
  return {
    won,
    pct: step.pct,
    name: step.name,
    price: at(step.pct),
    hasPrice: !!p,
    left: i >= 0 ? step.upTo - won : null,
    then: after ? { pct: after.pct, name: after.name, price: at(after.pct) } : null,
    steps: LADDER.map((x, k) => ({ label: `Clients ${k * 3 + 1} to ${x.upTo}`, price: at(x.pct), here: k === i })).concat({ label: 'Client 10 on', price: at(100), here: i < 0 }),
    script,
  };
}

// One or two spoken sentences for Talk to 127 ("how am I doing?").
function say(user, { catalog } = {}) {
  const h = hundred(user);
  const move = nextMove(user, { catalog });
  const parts = [h.done ? `You did your ${h.target} today${h.streak > 1 ? `, ${h.streak} days in a row` : ''}.` : `You're at ${h.today} of ${h.target} today.`];
  if (move.kind !== 'none') parts.push(`Next: ${move.title.replace(/\.$/, '')}.`);
  return parts.join(' ');
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { KINDS, LABELS, HINTS, HOLE, DEFAULT_TARGET, MAX_TARGET, dayKey, addDays, weekStart, target, log, hundred, week, scoreboard, queue, waysFor, onStage, nextMove, receipts, ladder, parsePrice, say, _setDeps };
