// Kit talk (frontdesk, reviews and ugc use it): find a
// business in the member's Pipeline by name, website or key (a typed name that isn't there still
// works), what a reply means beyond kit outreach.answer (auto-replies, the wrong person, "send me
// info", "let me think"), the signer's first name, real dates to offer, and saving a reply and its
// answer back on the lead (contract 13: msg.answer is what Do my day hands out).

const kit = require('.');
const { text, web, time } = kit;

const DAY = 864e5;

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/\b(llc|inc|co|corp|company|ltd|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// "brightwater.example", "https://www.brightwater.example/about" -> "brightwater.example"; a name -> ''.
function domainOf(s) {
  const t = String(s || '').trim();
  if (!t || /\s/.test(t) || !/[a-z0-9-]+\.[a-z]{2,}/i.test(t)) return '';
  try {
    return web.domainOf(/^https?:\/\//i.test(t) ? t : `https://${t}`) || '';
  } catch {
    return '';
  }
}

function siteUrl(s) {
  const d = domainOf(s);
  if (!d) return '';
  try {
    return web.normalizeUrl(String(s).trim()) || `https://${d}/`;
  } catch {
    return `https://${d}/`;
  }
}

// The whole Pipeline (every pack), or [] where there is none (local runs).
async function pipelineRows(ctx) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return [];
  try {
    const rows = await ctx.leads.list({ all: true, limit: 2000 });
    return Array.isArray(rows) ? rows.filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Exact name first, then the website's domain, then the key or id, then one unique partial name.
function findIn(rows, { name, website } = {}) {
  const n = norm(name);
  const dom = domainOf(website) || domainOf(name);
  const site = (r) => domainOf((r.links && r.links.website) || '');
  let hit = null;
  if (n) hit = rows.find((r) => (r.name && norm(r.name) === n) || (r.company && norm(r.company) === n)) || null;
  if (!hit && dom) hit = rows.find((r) => site(r) === dom || String(r.key || '') === `site:${dom}`) || null;
  if (!hit && name) {
    const raw = String(name).trim();
    hit = rows.find((r) => String(r.key || '') === raw || String(r.id || '') === raw) || null;
  }
  if (!hit && n.length >= 4) {
    const part = rows.filter((r) => {
      const x = norm(r.name);
      return x && x.length >= 4 && (x.includes(n) || n.includes(x));
    });
    if (part.length === 1) hit = part[0];
  }
  return hit;
}

// One lead the way the flagship tools read it. typed: { name, website } from the form.
function leadOf(row, typed = {}) {
  const typedName = text.oneLine(String(typed.name || '')).slice(0, 120);
  const typedSite = siteUrl(typed.website) || siteUrl(typedName);
  if (!row) {
    const dom = domainOf(typedSite);
    const name = (domainOf(typedName) ? '' : typedName) || dom || 'This business';
    return { inPipeline: false, id: null, key: dom ? `site:${dom}` : `lead:${text.slug(name, 40) || 'business'}`, pack: '', stage: '', name, website: typedSite, email: '', phone: '', instagram: '', maps: '', placeId: '', facts: [], score: null, channel: '', msg: {}, reply: '', note: '', data: {}, city: '', sample: false, source: '' };
  }
  const L = row.links || {};
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const fromData = Array.isArray(data.facts) ? data.facts.map((f) => (f && typeof f === 'object' ? f.fact : f)) : [];
  const facts = (Array.isArray(row.facts) && row.facts.length ? row.facts : fromData).map((f) => text.oneLine(String(f || ''))).filter(Boolean).slice(0, 6);
  return {
    inPipeline: true,
    id: row.id || null,
    key: row.key || '',
    pack: row.pack || '',
    stage: row.stage || 'found',
    name: text.oneLine(row.name || row.company || typedName || 'This business'),
    website: L.website || typedSite || '',
    email: L.email || '',
    phone: L.phone || '',
    instagram: L.instagram || '',
    maps: L.maps || '',
    placeId: row.placeId || data.placeId || data.place_id || '',
    facts,
    score: Number.isFinite(row.score) ? row.score : null,
    channel: row.channel || '',
    msg: row.msg && typeof row.msg === 'object' ? row.msg : {},
    reply: row.reply || '',
    note: row.note || '',
    data,
    city: data.city || '',
    sample: !!data.sample,
    source: row.source || '',
  };
}

async function findLead(ctx, typed = {}) {
  const rows = await pipelineRows(ctx);
  return { lead: leadOf(findIn(rows, typed), typed), rows };
}

// A typed name that isn't found: Google Maps businesses are kept in the Pipeline without their names
// (Legal L53), so only their website can match one.
function missHint(rows, typed = {}) {
  if (domainOf(typed.website) || domainOf(typed.name)) return '';
  return (rows || []).some((r) => r && r.placeId) ? 'Businesses from Google Maps are kept in your Pipeline without their names. Add the website to match one.' : '';
}

const STAGES = { found: 'Found', contacted: 'Contacted', replied: 'Replied', call: 'Call booked', won: 'Won', lost: 'Lost' };
const stageLabel = (stage) => STAGES[stage] || 'Found';

// This pack's customers so far (the first-clients ladder: founding price for the first few).
function wonCount(rows, pack) {
  return (rows || []).filter((r) => r && r.stage === 'won' && (!r.pack || r.pack === pack)).length;
}

// ---------- what a reply means, beyond kit outreach.answer ----------

const AWAY = /\b(out of (the )?office|on (vacation|holiday|leave|pto)|away (until|from|through)|auto(matic)?[- ]?reply|currently (away|out)|limited access to (e-?mail|my e-?mail)|i('m| am) (away|out) (until|through|till))\b/i;
const WRONG = /\b(not the (right )?(person|one|owner|manager|decision ?maker)|wrong (person|email|number|address)|you('d| would| will|'ll)? (need|have|want) to (talk|speak) (to|with)|(talk|speak|reach out) (to|with) (the|our) (owner|manager|boss|office manager)|(he|she|they)('s| is| are) the (owner|one (who|you)|person|manager|decision ?maker)|i('ll| will) (pass|forward|send) (this|it|your (note|email|message)) (on|along|to)|(passed|forwarded) (this|it|your (note|email|message)))\b/i;
const INFO = /\b(send (me |us )?(some |more )?(info|information|details)|more (info|information|details)|(email|send) (me|us) (something|a summary|what you have|the details)|do you have (a )?(website|brochure))\b/i;
const THINK = /\b(think (about it|it over|on it)|let me (think|check|talk|ask|run)|(i|we)('ll| will| need to| have to|'d have to) (talk|check|discuss) (it )?(over )?(with|to)|talk (it over )?(with|to) my (wife|husband|partner|business partner|team|manager|boss)|run it by|sleep on it)\b/i;

function extraIntent(reply) {
  const t = String(reply || '');
  if (AWAY.test(t)) return 'away';
  // "You'd want to talk to Mike" points somewhere else; "let me talk to Mike" is thinking it over.
  if (WRONG.test(t) || (pointedName(t) && !/\blet me\b/i.test(t))) return 'wrong';
  if (INFO.test(t)) return 'info';
  if (THINK.test(t)) return 'think';
  return '';
}

// Their first name from the sign-off ("Thanks, Dana" or a last line "Mike"), else ''.
const NOT_NAMES = /^(thanks|thank|best|cheers|regards|sincerely|sent|hello|hi|hey|yes|no|ok|okay|sure|team|owner|office|manager|the|we|i)$/i;
function signerOf(reply) {
  const lines = String(reply || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 1) return '';
  const tail = lines.slice(-2).join(' ').replace(/^[\s\-–—~]+/, '');
  const m = tail.match(/(?:thanks|thank you|best|cheers|regards|sincerely)[,!.]*\s+[\-–—~]?\s*([A-Z][a-z]{1,15})(?:\s+[A-Z][a-z]+)?\.?\s*$/);
  if (m && !NOT_NAMES.test(m[1])) return m[1];
  const last = lines[lines.length - 1].replace(/^[\-–—~]+\s*/, '');
  const one = last.match(/^([A-Z][a-z]{1,15})(?:\s+[A-Z][a-z]+)?\.?$/);
  if (lines.length > 1 && one && !NOT_NAMES.test(one[1])) return one[1];
  return '';
}

// "talk to Mike", "Mike is the owner": the name they pointed to.
function pointedName(reply) {
  const m = String(reply || '').match(/\b(?:talk|speak|reach out|write) (?:to|with) ([A-Z][a-z]{1,15})\b|\b([A-Z][a-z]{1,15})(?:'s| is) the (?:owner|one|person|manager)\b/);
  const n = m && (m[1] || m[2]);
  return n && !NOT_NAMES.test(n) ? n : '';
}

// The first question they asked, for the view ("They asked: ...").
function questionIn(reply) {
  const m = String(reply || '').replace(/\s+/g, ' ').match(/[^.!?]*\?/);
  return m ? text.clip(m[0].trim(), 140) : '';
}

// ---------- dates (the member's timezone) ----------

// "2026-10-19" -> "October 19, 2026"; anything else comes back as it was.
function longDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(s || '');
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)));
}

const fmt = (ms, tz, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(ms));

// The next n weekdays as "Tuesday, October 20".
function callDays(ctx, n = 2) {
  const tz = time.tzOf(ctx);
  const now = time.nowMs(ctx);
  const out = [];
  for (let i = 1; out.length < n && i < 12; i++) {
    const t = now + i * DAY;
    const w = time.partsIn(t, tz).weekday;
    if (w > 0 && w < 6) out.push(fmt(t, tz, { weekday: 'long', month: 'long', day: 'numeric' }));
  }
  return out;
}

// A weekday at least `days` out, as { date: 'YYYY-MM-DD', label: 'Thursday, October 22' }.
function onDay(ctx, days) {
  const tz = time.tzOf(ctx);
  let t = time.nowMs(ctx) + Math.max(0, days) * DAY;
  for (let i = 0; i < 3; i++) {
    const w = time.partsIn(t, tz).weekday;
    if (w > 0 && w < 6) break;
    t += DAY;
  }
  const p = time.partsIn(t, tz);
  return { date: time.ymd(p.y, p.m, p.d), label: fmt(t, tz, { weekday: 'long', month: 'long', day: 'numeric' }) };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Days until a calendar date this year or next, at least `min`.
function daysUntil(ctx, month, day, min = 7) {
  const today = time.today(ctx);
  const [y] = today.split('-').map(Number);
  const base = Date.parse(`${today}T12:00:00Z`);
  let t = Date.UTC(y, month, day, 12);
  if (t - base < min * DAY) t = Date.UTC(y + 1, month, day, 12);
  return Math.round((t - base) / DAY);
}

// "Not now" in their words -> days until a sensible check-back.
function laterDays(reply, ctx) {
  const t = String(reply || '').toLowerCase();
  if (/\bnext week\b/.test(t)) return 7;
  if (/\b(couple|few|two|2) weeks\b/.test(t)) return 14;
  if (/\bnext month\b|\bin a month\b/.test(t)) return 30;
  if (/\b(after the holidays|new year|january)\b/.test(t)) return daysUntil(ctx, 0, 6);
  if (/\bspring\b/.test(t)) return daysUntil(ctx, 2, 2);
  if (/\bsummer\b/.test(t)) return daysUntil(ctx, 5, 1);
  if (/\b(fall|autumn)\b/.test(t)) return daysUntil(ctx, 8, 8);
  if (/\bwinter\b/.test(t)) return daysUntil(ctx, 11, 1);
  if (/\bnext year\b/.test(t)) return daysUntil(ctx, 0, 12);
  if (/\b(quarter|three months|3 months)\b/.test(t)) return 90;
  if (/\b(slow (season|time|down)|things (calm|slow) down)\b/.test(t)) return 45;
  return 60;
}

// An auto-reply: days until the day after they're back ("back on Monday", "until October 26").
function backDays(reply, ctx) {
  const t = String(reply || '').toLowerCase();
  const tz = time.tzOf(ctx);
  const today = time.partsIn(time.nowMs(ctx), tz);
  const wd = t.match(/\b(?:back|return(?:ing)?|until|till|through)\b[^.]{0,20}?\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (wd) {
    const d = (WEEKDAYS.indexOf(wd[1]) - today.weekday + 7) % 7 || 7;
    return d + 1;
  }
  const md = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/);
  if (md) return daysUntil(ctx, MONTHS.indexOf(md[1]), Number(md[2]), 1) + 1;
  return 3;
}

// ---------- saving back to the Pipeline ----------

// Saves their reply and your answer on the lead. This pack's own lead also moves to Replied (dated
// now), so Do my day hands the answer out first; a stop moves it to Lost. Another pack's lead (an
// upsert only reaches this pack's leads) gets the reply and answer by id, and the member moves it.
// An auto-reply (away) saves only what they wrote. Returns { saved, lost, moved, line }.
async function saveReply(ctx, lead, { pack, reply, answer, stop = false, away = false }) {
  const name = (lead && lead.name) || 'This business';
  if (!lead || !lead.inPipeline) return { saved: false, lost: false, moved: false, line: `${name} isn't in your Pipeline, so nothing was saved there.` };
  const leads = (ctx && ctx.leads) || {};
  const own = !lead.pack || lead.pack === pack;
  const said = String(reply || '').trim().slice(0, 2000);
  const patch = stop || away || !answer ? { reply: said } : { reply: said, msg: { ...(lead.msg || {}), answer } };
  const early = ['found', 'contacted'].includes(lead.stage);
  let saved = false;
  let lost = false;
  let moved = false;
  try {
    if (own && lead.key && typeof leads.upsert === 'function' && !away) {
      await leads.upsert({ key: lead.key, ...patch, stage: stop ? 'lost' : 'replied' });
      saved = true;
      lost = stop;
      moved = !stop && early;
    } else if (typeof leads.update === 'function' && lead.id) {
      await leads.update(lead.id, stop || away || !answer ? { reply: said } : { reply: said, msg: { answer } });
      saved = true;
    }
  } catch {
    return { saved: false, lost: false, moved: false, line: "Couldn't save to your Pipeline this time. Copy the answer from here." };
  }
  let line;
  if (stop) line = lost ? `Marked ${name} lost in your Pipeline, so nothing else goes to them.` : `Mark ${name} lost in your Pipeline so nothing else goes to them.`;
  else if (!saved) line = "Couldn't save to your Pipeline this time. Copy the answer from here.";
  else if (away) line = `Saved the auto-reply on ${name} in your Pipeline.`;
  else if (moved) line = `Moved ${name} to Replied in your Pipeline with your answer, so Do my day hands it to you first.`;
  else if (!own && early) line = `Saved your answer on ${name}. Move it to Replied in your Pipeline so Do my day hands it to you.`;
  else line = `Saved their reply and your answer on ${name} in your Pipeline.`;
  return { saved, lost, moved, line };
}

// Moves one lead forward to `stage` (never back) and says what happened, for the view. This pack's
// lead moves; another pack's lead is the member's to move; a business not in the Pipeline is added
// here (a quote, invoice or proposal step then runs with pipeline: false, so HQ shows one row).
// Best effort: '' when nothing changed or there is no Pipeline.
async function moveLead(ctx, lead, { pack, stage, name, source, links = {}, data = {} } = {}) {
  const leads = (ctx && ctx.leads) || {};
  if (!lead || !STAGES[stage] || typeof leads.upsert !== 'function') return '';
  const order = Object.keys(STAGES);
  const who = name || lead.name || 'This business';
  const won = stage === 'won';
  const label = stageLabel(stage);
  try {
    if (lead.inPipeline) {
      if (lead.stage === 'lost' || order.indexOf(lead.stage) >= order.indexOf(stage)) return '';
      if (lead.pack && lead.pack !== pack) return won ? `Mark ${who} won in your Pipeline.` : `Move ${who} to ${label} in your Pipeline.`;
      if (!lead.key) return '';
      await leads.upsert({ key: lead.key, stage });
      return won ? `Marked ${who} won in your Pipeline.` : `Moved ${who} to ${label} in your Pipeline.`;
    }
    if (!lead.key) return '';
    await leads.upsert({ key: lead.key, name: who, company: who, source, stage, links, data });
    return won ? `Added ${who} to your Pipeline as won.` : `Added ${who} to your Pipeline at ${label}.`;
  } catch {
    return '';
  }
}

module.exports = { norm, domainOf, siteUrl, pipelineRows, findIn, leadOf, findLead, missHint, stageLabel, wonCount, extraIntent, signerOf, pointedName, questionIn, callDays, onDay, longDate, laterDays, backDays, daysUntil, saveReply, moveLead, DAY };
