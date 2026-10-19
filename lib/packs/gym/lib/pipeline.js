// The member's gym pipeline: who they found, contacted, heard back from, called and won, and what is due
// today. Volume plus follow-up is what turns a one-off list into clients, so this is what turns the
// pack into a daily habit.
//
// Storage: each gym is a lead in the member's Pipeline (ctx.leads), and what this pack needs about it
// (touches, follow-up drafts, the gym's facts) rides in the lead's `data`, trimmed to the harness's
// 8 KB a lead. A ctx without ctx.leads.list (an older engine, a bare test ctx) keeps the whole
// pipeline in the pack's memory instead (ctx.remember('pipeline')).

const { kmBetween, kmToMiles, plain } = require('./util');
const { drafts, withEmailFooter, withoutEmailFooter } = require('./outreach');

const STAGES = ['found', 'contacted', 'replied', 'call', 'won', 'lost'];
const FOLLOW_UP_DAYS = [3, 7, 14];
const DAY = 24 * 3600 * 1000;
const MAX_LEADS = 400;
const MAX_DATA = 7800; // the harness keeps a lead's data only under 8,000 bytes

// Rough industry rates, kept for reference only. Nothing a member reads turns them into a client count:
// that reads as a promise. Until the member has their own numbers, they see the daily habit instead.
const ASSUMED = { replyRate: 0.15, callRate: 0.1, closeRate: 0.33 };
const OWN_CONTACTS = 20;

function empty(backend = 'memory') {
  const p = { v: 2, backend, leads: {} };
  // Keys changed since load, so save() writes only those leads. Not enumerable: p stays plain data.
  Object.defineProperty(p, 'changed', { value: new Set(), enumerable: false });
  return p;
}

const usesLeads = (ctx) => !!(ctx && ctx.leads && typeof ctx.leads.list === 'function' && typeof ctx.leads.upsert === 'function');

async function load(ctx) {
  if (usesLeads(ctx)) {
    const p = empty('leads');
    let list = [];
    try {
      list = (await ctx.leads.list({ limit: 2000 })) || [];
    } catch {
      list = [];
    }
    // Later entries win (a test ctx lists every upsert in order).
    for (const l of list) {
      if (!l || !l.key) continue;
      const d = l.data && typeof l.data === 'object' && !Array.isArray(l.data) ? l.data : {};
      if (d.pack && d.pack !== 'gym') continue;
      p.leads[l.key] = { ...d, key: l.key, name: d.name || l.company || l.name, stage: STAGES.includes(l.stage) ? l.stage : d.stage || 'found' };
    }
    return p;
  }
  const p = empty('memory');
  const saved = ctx && ctx.brain && ctx.brain.packs && ctx.brain.packs.gym && ctx.brain.packs.gym.pipeline;
  if (saved && saved.leads && typeof saved.leads === 'object') Object.assign(p.leads, saved.leads);
  return p;
}

const mark = (p, key) => {
  if (p.changed) p.changed.add(key);
};

async function save(ctx, p) {
  const who = writer(ctx);
  // HQ's copy of each changed lead. Their reply and its answer ride along once, then are dropped:
  // HQ keeps them, and our own copy stays small.
  const outgoing = [];
  for (const key of [...(p.changed || [])]) {
    const l = p.leads[key];
    if (!l) continue;
    outgoing.push(toLead(l, who));
    delete l.answer;
    delete l.reply;
  }
  if (p.backend === 'leads' && usesLeads(ctx)) {
    for (const lead of outgoing) await ctx.leads.upsert(lead);
    if (p.changed) p.changed.clear();
    return p;
  }
  // Memory: keep the newest leads if the list grows past what memory should hold.
  const keys = Object.keys(p.leads);
  if (keys.length > MAX_LEADS) {
    keys.sort((a, b) => (p.leads[b].updated || 0) - (p.leads[a].updated || 0));
    for (const k of keys.slice(MAX_LEADS)) if (!['won', 'call', 'replied'].includes(p.leads[k].stage)) delete p.leads[k];
  }
  if (ctx && typeof ctx.remember === 'function') await ctx.remember('pipeline', { v: p.v, leads: p.leads });
  // Later steps in the same run read it back from the brain (the engine shares one snapshot per run).
  try {
    if (ctx && ctx.brain) {
      ctx.brain.packs = ctx.brain.packs || {};
      ctx.brain.packs.gym = { ...(ctx.brain.packs.gym || {}), pipeline: { v: p.v, leads: p.leads } };
    }
  } catch {
    /* read-only brain: ctx.remember already saved it */
  }
  // The stages still go to the member's Pipeline, so HQ shows them.
  if (ctx && ctx.leads && typeof ctx.leads.upsert === 'function') {
    for (const lead of outgoing) if (p.leads[lead.key]) await ctx.leads.upsert({ ...lead, data: undefined });
  }
  if (p.changed) p.changed.clear();
  return p;
}

// Who the messages are from, for the drafts each lead carries into HQ's Do my day.
function writer(ctx) {
  const brain = (ctx && ctx.brain) || {};
  const typed = ctx && ctx.inputs && ctx.inputs.city;
  const city = (brain.business && brain.business.city) || (typed && !/^\s*\d/.test(typed) ? String(typed).split(',')[0].trim() : '');
  return { member: (ctx && ctx.member) || {}, business: brain.business || {}, city };
}

const HQ_CHANNEL = { Instagram: 'ig', Email: 'email', Phone: 'call' };
const firstSentence = (t) => (String(t || '').match(/^.*?[.!?](?=\s|$)/) || [String(t || '')])[0].trim().slice(0, 160);

// The messages HQ's Do my day hands out for this gym (contract 13): the first message offering a free
// sample, the day-3 and day-7 follow-ups (the ones written after a sample when there was one), and
// the answer to their reply when the member has one.
function msgFor(l, who = {}) {
  const row = l.row || {};
  const gym = { name: l.name, city: l.city, category: l.category, website: l.website, ...(row.gym || {}), name: l.name };
  const contact = row.contact || { instagram: l.instagram, email: l.email, phone: l.phone, owner: l.owner ? { name: l.owner } : null };
  const d = drafts({ gym, score: { contact }, report: { gaps: row.gaps || [], ideas: row.ideas || [], opener: row.opener }, member: who.member || {}, business: who.business || {}, city: who.city || '', offer: row.site && row.site.offer });
  // HQ hands out one text per follow-up, on the gym's best channel: with the address and opt-out
  // lines when that's email, as a plain DM otherwise.
  const byEmail = channelFor(l) === 'Email';
  const fu = (day, i) => {
    const t = ((l.followUps || []).find((f) => f.day === day) || d.followUps[i] || {}).text;
    return t ? (byEmail ? withEmailFooter(t, d.emailFooter) : withoutEmailFooter(t)) : null;
  };
  const msg = { dm: d.dm, subject: d.email.subject, email: d.email.body, walkin: d.walkIn, follow1: fu(3, 0), follow2: fu(7, 1) };
  if (l.answer) msg.answer = l.answer;
  return pickDefined(msg);
}

// One of our leads as a harness Pipeline lead. The lead is the gym: its name is the gym's (never the
// owner's, which would rename the row once the owner is known), as in HQ's own First 25 imports.
// Proper links for HQ, the messages, facts, score and channel Do my day uses, our facts in `data`.
function toLead(l, who) {
  const links = {};
  if (l.website) links.website = /^https?:\/\//i.test(l.website) ? l.website : `https://${l.website}`;
  if (l.instagram) links.instagram = `https://www.instagram.com/${String(l.instagram).replace(/^@/, '')}/`;
  if (l.maps) links.maps = l.maps;
  if (l.email) links.email = l.email;
  if (l.phone) links.phone = l.phone;
  const row = l.row || {};
  const facts = (row.gaps || []).map((g) => firstSentence(g.evidence)).filter(Boolean).slice(0, 5);
  if (!facts.length && l.topGap) facts.push(l.topGap);
  const score = Number.isFinite(row.opportunity) ? row.opportunity : Number.isFinite(l.score) ? l.score : null;
  const { answer, reply, ...keep } = l;
  return pickDefined({
    key: l.key,
    name: l.name,
    source: 'Gym pack',
    stage: l.stage,
    links,
    msg: msgFor(l, who),
    facts: facts.length ? facts : null,
    score: score == null ? null : Math.max(0, Math.min(100, Math.round(score))),
    channel: HQ_CHANNEL[channelFor(l)] || null,
    reply: reply || null,
    sentAt: l.firstTouch ? new Date(l.firstTouch).toISOString() : null,
    // HQ marks a lead "Sample" when data.sample is set: made-up gyms from a demo or a held search.
    data: fit({ ...keep, pack: 'gym', ...(row.sample || l.sample ? { sample: true } : {}) }),
  });
}

// Trim a lead's data until it fits the harness's limit: the least useful parts go first.
function fit(d) {
  const size = (x) => JSON.stringify(x).length;
  if (size(d) <= MAX_DATA) return d;
  const out = JSON.parse(JSON.stringify(d));
  const steps = [
    (o) => o.row && delete o.row.competitors,
    (o) => o.row && (o.row.ideas || []).forEach((i) => delete i.shots),
    (o) => o.row && (o.row.gaps || []).forEach((g) => delete g.check),
    (o) => o.row && o.row.site && delete o.row.site.images,
    (o) => o.row && delete o.row.site,
    (o) => (o.touches = (o.touches || []).slice(-6)),
    (o) => (o.followUps = (o.followUps || []).map((f) => ({ ...f, text: String(f.text || '').slice(0, 300) }))),
    (o) => o.row && (o.row.gaps = (o.row.gaps || []).slice(0, 2)),
    (o) => delete o.row,
  ];
  for (const step of steps) {
    step(out);
    if (size(out) <= MAX_DATA) return out;
  }
  return { pack: 'gym', key: d.key, name: d.name, stage: d.stage, category: d.category, rank: d.rank, tier: d.tier, firstTouch: d.firstTouch, updated: d.updated };
}

// A ranked row (gym.find_gaps) or an outreach output, down to what the pipeline keeps.
function leadFrom(x) {
  const g = (x && x.gym && typeof x.gym === 'object' ? x.gym : null) || {};
  const name = (typeof x.gym === 'string' ? x.gym : null) || x.name || g.name;
  return {
    key: x.key || g.key || (name ? `name:${String(name).toLowerCase()}` : null),
    name: g.name || name,
    category: g.category || x.category || null,
    lat: Number.isFinite(g.lat) ? g.lat : null,
    lon: Number.isFinite(g.lon) ? g.lon : null,
    website: g.website || null,
    maps: g.mapsUrl || null,
    city: g.city || null,
    instagram: (x.contact && x.contact.instagram) || g.instagram || null,
    email: (x.contact && x.contact.email) || g.email || null,
    phone: (x.contact && x.contact.phone) || g.phone || null,
    owner: (x.contact && x.contact.owner && x.contact.owner.name) || null,
    rank: x.rank || null,
    tier: x.tier || null,
    topGap: x.topGap || null,
    score: Number.isFinite(x.opportunity) ? x.opportunity : null,
    source: g.source || null,
  };
}

// The site's logo and up to 4 photo links (short ones only), so "Make a sample for a gym" can use
// them for a gym that wasn't picked on day one.
function imagesOf(im) {
  if (!im) return null;
  const ok = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 400 ? u : null);
  const out = pickDefined({ logo: ok(im.logo), icon: ok(im.icon) });
  const photos = (im.photos || []).map(ok).filter(Boolean).slice(0, 4);
  if (photos.length) out.photos = photos;
  return Object.keys(out).length ? out : null;
}

// The parts of a ranked row that later tools need (call script, content day, scorecard, sample Reel,
// reports), small enough to keep in memory for the top of the list.
function compactRow(r) {
  if (!r || !r.gym) return null;
  const g = r.gym;
  const s = r.site || {};
  const pick = (o, keys) => (o ? Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]])) : null);
  return {
    key: r.key,
    rank: r.rank,
    name: r.name,
    tier: r.tier,
    opportunity: r.opportunity,
    content: r.content,
    contact: r.contact,
    topGap: r.topGap,
    gaps: (r.gaps || []).map((x) => pick(x, ['id', 'title', 'evidence', 'say', 'fix', 'check'])),
    ideas: (r.ideas || []).map((x) => pick(x, ['id', 'title', 'hook', 'shots'])),
    opener: r.opener,
    competitors: (r.competitors || []).map((x) => pick(x, ['name', 'km', 'sameCategory', 'video', 'tiktok', 'lastPostDays'])),
    gym: pick(g, ['key', 'name', 'category', 'owner', 'brand', 'address', 'city', 'lat', 'lon', 'km', 'miles', 'website', 'phone', 'email', 'instagram', 'locations']),
    site: s.reachable === false ? { reachable: false } : { ...pick(s, ['reachable', 'url', 'domain', 'brandSite', 'offer', 'monthlyPrice', 'colors', 'socials', 'video', 'testimonials', 'people']), ...(imagesOf(s.images) ? { images: imagesOf(s.images) } : {}) },
    insta: r.insta ? pick(r.insta, ['source', 'handle', 'followers', 'sampled', 'daysSinceLastPost', 'postsPerWeek', 'reelsShare', 'medianEngagement', 'engagementRate']) : null,
    sample: !!r.sample,
  };
}

function upsertFound(p, rows, at, { keepRows = 40 } = {}) {
  for (const r of rows || []) {
    const l = leadFrom(r);
    if (!l.key) continue;
    const cur = p.leads[l.key];
    const row = (r.rank || 999) <= keepRows ? compactRow(r) : null;
    p.leads[l.key] = cur ? { ...cur, ...pickDefined(l), stage: cur.stage, updated: at, ...(row ? { row } : {}) } : { ...l, stage: 'found', touches: [], updated: at, foundAt: at, ...(row ? { row } : {}) };
    mark(p, l.key);
  }
  return p;
}

// Find a gym the member already has, by key or by name (case and punctuation don't matter).
function find(p, nameOrKey) {
  if (!nameOrKey) return null;
  if (p.leads[nameOrKey]) return p.leads[nameOrKey];
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(nameOrKey);
  const all = Object.values(p.leads);
  return all.find((l) => norm(l.name) === n) || all.find((l) => norm(l.name).includes(n) && n.length >= 4) || null;
}

function pickDefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
}

// what: 'sent' | 'walk_in' | 'follow_up' | 'no_answer' | 'replied' | 'call_booked' | 'won' | 'lost'
const STAGE_FOR = { sent: 'contacted', walk_in: 'contacted', follow_up: null, no_answer: null, replied: 'replied', call_booked: 'call', won: 'won', lost: 'lost' };

function touch(p, lead, { what, channel = null, note = null, at, followUps = null, callAt = null, day = null, deal = null, answered = false, nextDays = null, answer = null, reply = null }) {
  const l = leadFrom(lead);
  if (!l.key) throw new Error('Which gym? Add its name.');
  const cur = p.leads[l.key] || { ...l, stage: 'found', touches: [], foundAt: at };
  // A win logged twice (from "Log what happened", then "A gym said yes") counts once.
  if (what === 'won' && cur.stage === 'won') return cur;
  const next = STAGE_FOR[what] || null;
  // Stages only move forward, except "lost", which can come at any point.
  const stage = next && (next === 'lost' || STAGES.indexOf(next) > STAGES.indexOf(cur.stage)) ? next : cur.stage;
  const t = { at, what, channel, note: note ? String(note).slice(0, 280) : null };
  if (what === 'follow_up' && day) t.day = day;
  // Their reply, already answered with a draft: check in after nextDays if they go quiet.
  if (what === 'replied' && answered) {
    t.answered = true;
    if (Number.isFinite(nextDays) && nextDays > 0) t.next = at + Math.round(nextDays) * DAY;
  }
  const touches = [...(cur.touches || []), t].slice(-12);
  const updated = { ...cur, ...pickDefined(l), stage, touches, updated: at };
  if ((what === 'sent' || what === 'walk_in') && !cur.firstTouch) updated.firstTouch = at;
  if (followUps) updated.followUps = followUps.map((f) => ({ day: f.day, channel: f.channel, text: String(f.text || '').slice(0, 700) }));
  // Their reply and the answer written for it go to HQ's Do my day with the next save.
  if (what === 'replied' && answer) updated.answer = String(answer).slice(0, 2000);
  if (what === 'replied' && reply) updated.reply = String(reply).slice(0, 2000);
  if (what === 'call_booked' && callAt) updated.callAt = callAt;
  if (what === 'won') updated.wonAt = at;
  // The terms this gym was won on (its step on the ladder), kept for its first month's plan.
  if (what === 'won' && deal && !cur.deal) updated.deal = deal;
  p.leads[l.key] = updated;
  mark(p, l.key);
  return updated;
}

const dayStart = (ms, tzOffsetMin = 0) => Math.floor((ms - tzOffsetMin * 60000) / DAY);

const channelsOf = (l) => [l.instagram && 'Instagram', l.email && 'Email', l.phone && 'Phone', 'Walk-in'].filter(Boolean);
// Today's first touch for a new gym goes out on its best channel: Instagram, else email, else a call.
const channelFor = (l) => (l.instagram ? 'Instagram' : l.email ? 'Email' : l.phone ? 'Phone' : 'Walk-in');

// What the member should do today: replies and calls first, then every follow-up that's due, then new
// gyms in rank order until the day's number of touches is reached. now: ms. Returns plain data.
function today(p, now, { daily = 25, newPerDay = null, radiusMiles = 0 } = {}) {
  const leads = Object.values(p.leads);
  const todayN = dayStart(now);
  const followUps = [];
  for (const l of leads) {
    if (l.stage !== 'contacted' || !l.firstTouch) continue;
    const days = todayN - dayStart(l.firstTouch);
    const lastDone = Math.max(0, ...(l.touches || []).filter((t) => t.what === 'follow_up' && t.day).map((t) => t.day));
    // Only the latest step that's due: a day-14 note replaces a missed day-7 one.
    const dueDay = FOLLOW_UP_DAYS.filter((d) => d > lastDone && days >= d).pop();
    if (dueDay == null) continue;
    const draft = (l.followUps || []).find((f) => f.day === dueDay) || null;
    followUps.push({ key: l.key, name: l.name, day: dueDay, daysSince: days, channel: draft ? draft.channel : l.instagram ? 'Instagram DM' : l.email ? 'Email' : 'Phone', text: draft ? plain(draft.text) : null, last: dueDay === 14 });
  }
  followUps.sort((a, b) => b.day - a.day || b.daysSince - a.daysSince);
  const calls = leads.filter((l) => l.stage === 'call' && l.callAt && dayStart(Date.parse(l.callAt) || 0) === todayN).map((l) => ({ key: l.key, name: l.name, at: l.callAt }));
  // Replies: unanswered ones go first. Answered ones come back as a check-in when they go quiet:
  // on the day the answer set, then weekly, three at most.
  const replied = [];
  const checkIns = [];
  for (const l of leads) {
    if (l.stage !== 'replied') continue;
    const touches = l.touches || [];
    const r = [...touches].reverse().find((t) => t.what === 'replied');
    if (!r || !r.answered) {
      replied.push({ key: l.key, name: l.name, since: Math.max(0, todayN - dayStart((r && r.at) || l.updated || now)) });
      continue;
    }
    const after = touches.filter((t) => t.what === 'follow_up' && t.at > r.at);
    if (after.length >= 3) continue;
    const due = after.length ? after[after.length - 1].at + 7 * DAY : r.next || r.at + 3 * DAY;
    if (todayN < dayStart(due)) continue;
    checkIns.push({ key: l.key, name: l.name, day: null, checkIn: after.length + 1, daysSince: todayN - dayStart(r.at), channel: l.instagram ? 'Instagram DM' : l.email ? 'Email' : 'Phone', text: null, last: after.length === 2 });
  }
  // Warm gyms first: a check-in after their reply comes before a cold follow-up.
  followUps.unshift(...checkIns);
  const won = leads.filter((l) => l.stage === 'won');
  const open = leads
    .filter((l) => l.stage === 'found')
    .filter((l) => !conflictFor(l, won, radiusMiles))
    .sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const cap = Number.isFinite(newPerDay) && newPerDay > 0 ? newPerDay : Infinity;
  const fresh = [];
  let touches = followUps.length;
  for (const l of open) {
    if (touches >= daily || fresh.length >= cap) break;
    fresh.push({ key: l.key, name: l.name, rank: l.rank || null, tier: l.tier, topGap: l.topGap, channel: channelFor(l), channels: channelsOf(l) });
    touches += 1;
  }
  const blocked = leads.filter((l) => l.stage === 'found' && conflictFor(l, won, radiusMiles)).map((l) => ({ key: l.key, name: l.name, because: conflictFor(l, won, radiusMiles) }));
  return { followUps, calls, replied, fresh, blocked, touches, daily, left: open.length - fresh.length };
}

// Exclusivity the member promised: one gym of each kind within N miles of a client.
function conflictFor(lead, won, radiusMiles) {
  if (!radiusMiles || !lead.category) return null;
  for (const w of won) {
    if (w.key === lead.key || w.category !== lead.category) continue;
    if (![lead.lat, lead.lon, w.lat, w.lon].every(Number.isFinite)) continue;
    const miles = kmToMiles(kmBetween(lead.lat, lead.lon, w.lat, w.lon));
    if (miles <= radiusMiles) return `You work with ${w.name}, ${Math.round(miles * 10) / 10} miles away, and you promised one ${lead.category.replace('_', ' ')} gym per area.`;
  }
  return null;
}

// Funnel numbers: the member's own once there are enough, the planning assumptions before that.
function stats(p, { goalClients = 3, daily = 25 } = {}) {
  const leads = Object.values(p.leads);
  const n = (s) => leads.filter((l) => STAGES.indexOf(l.stage) >= STAGES.indexOf(s) && l.stage !== 'lost').length;
  const lost = leads.filter((l) => l.stage === 'lost');
  const reached = (s) => n(s) + lost.filter((l) => (l.touches || []).some((t) => STAGE_FOR[t.what] && STAGES.indexOf(STAGE_FOR[t.what]) >= STAGES.indexOf(s))).length;
  const contacted = reached('contacted');
  const replied = reached('replied');
  const calls = reached('call');
  const won = n('won');
  // "To goal" only from the member's own numbers: 20 contacts and a call, else the habit.
  const own = contacted >= OWN_CONTACTS && calls >= 1;
  const callRate = own ? calls / contacted : null;
  const closeRate = own && won > 0 ? won / calls : null;
  const perClient = own && won > 0 ? Math.max(1, Math.round(contacted / won)) : null;
  const perCall = own ? Math.max(1, Math.round(contacted / calls)) : null;
  const need = Math.max(0, goalClients - won);
  return {
    found: leads.length,
    contacted,
    replied,
    calls,
    won,
    lost: lost.length,
    replyRate: contacted ? replied / contacted : null,
    callRate,
    closeRate,
    own,
    perClient,
    perCall,
    toGoal: perClient && need ? need * perClient : null,
    goalClients,
    note: !own
      ? `The habit that gets you there: ${daily} reach-outs a day. Once you've contacted ${OWN_CONTACTS} gyms and had a call, this shows your own rate.`
      : perClient
        ? `At your current rate, about 1 in ${perClient} gyms you contact becomes a client. That's your rate so far, not a promise.`
        : `At your current rate, about 1 in ${perCall} gyms you contact books a call. That's your rate so far, not a promise.`,
  };
}

module.exports = { channelsOf, channelFor, STAGES, FOLLOW_UP_DAYS, ASSUMED, MAX_DATA, empty, load, save, toLead, msgFor, fit, leadFrom, compactRow, upsertFound, find, touch, today, conflictFor, stats, usesLeads };
