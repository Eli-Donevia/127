// The member's Pipeline from a household pack (contract 13, Legal D28 and D29): find the lead the
// member picked or typed, and save people and businesses with what Do my day hands out each morning
// (msg, facts, score, channel). People the member knows are saved warm with their personal texts;
// businesses get a DM, a walk-in or call line, an email that ends with the name, business, address
// line and opt-out (D28), and two follow-ups in the form that fits the best channel.
// Nothing is saved on a sample run, and sample businesses are never saved. Shared household spine.

const { text, outreach } = require('..');

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const clip = (s, n) => text.clip(text.plain(String(s || '')), n);

// Words that say a typed name is a business, not a person.
const BUSINESS_WORDS = /\b(llc|inc|co|corp|company|group|realty|realtors?|real estate|properties|property|management|managers?|services|motors|auto|autos|homes|rentals?|cafe|coffee|restaurant|bar|grill|kitchen|bakery|shop|store|agency|associates|partners|plumbing|electric|hvac|heating|cooling|landscaping|lawn|painting|painters|moving|movers|storage|dealership|sales|hotel|inn|apartments|hoa|association|garden|hardware|nursery|tires?|repair|salon|studio|market|church|school|office|dental|clinic|fleet|logistics)\b/i;

function canSave(ctx) {
  return !!(ctx && !ctx.sample && ctx.leads && typeof ctx.leads.upsert === 'function');
}

// Every lead the member has, from every pack ([] without a Pipeline).
async function everyone(ctx) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return [];
  try {
    return ((await ctx.leads.list({ all: true, limit: 2000 })) || []).filter(Boolean);
  } catch {
    return [];
  }
}

const isOwn = (lead, packId) => !!lead && (!lead.pack || lead.pack === packId);

// The lead the member picked (options: 'pipeline' passes the name) or typed: an exact name first,
// this pack's own leads before other packs', and open leads before lost ones.
async function findLead(ctx, packId, name) {
  const want = norm(name);
  if (want.length < 2) return null;
  let best = null;
  let bestScore = 0;
  for (const l of await everyone(ctx)) {
    const n = norm(l.name);
    const c = norm(l.company);
    let s = 0;
    if (n === want || c === want) s = 6;
    else if ((n && n.startsWith(want)) || (c && c.startsWith(want))) s = 3;
    else if (want.length >= 4 && ((n && n.includes(want)) || (c && c.includes(want)))) s = 2;
    if (!s) continue;
    if (isOwn(l, packId)) s += 1;
    if (l.stage !== 'lost') s += 0.5;
    if (s > bestScore) {
      best = l;
      bestScore = s;
    }
  }
  return best;
}

function isBusiness(lead, typed) {
  if (lead) {
    if (lead.warm) return false;
    if (/^person:/.test(String(lead.key || ''))) return false;
    if (lead.company || /^(osm|biz|gplaces|sample|street):/.test(String(lead.key || '')) || lead.placeId) return true;
  }
  return BUSINESS_WORDS.test(String(typed || (lead && lead.name) || ''));
}

// A key for a name the member typed that isn't in the Pipeline yet.
const keyFor = (name, business) => `${business ? 'biz' : 'person'}:${norm(name).slice(0, 80)}`;

// Merge into a lead's own data (upsert replaces data whole; keep what other runs saved).
function mergeData(lead, extra) {
  const prev = lead && lead.data && typeof lead.data === 'object' ? lead.data : {};
  const out = { ...prev, ...extra };
  return JSON.stringify(out).length > 7500 ? extra : out;
}

// Saves what a run wrote for one lead. patch: { stage, msg, facts, score, channel, reply, note, data, name, links, warm, source }.
// This pack's own lead (or a new one): upsert by key, so the stage moves forward. Another pack's lead:
// update by id, with messages, facts, reply, note and the stage, which HQ moves forward too (contract
// v1.5). HQ before v1.5 leaves the stage where it was, so moved says whether it really moved.
async function save(ctx, packId, lead, patch, { name, business, source } = {}) {
  if (!canSave(ctx)) return { saved: false, moved: false };
  try {
    if (lead && !isOwn(lead, packId)) {
      if (lead.id && typeof ctx.leads.update === 'function') {
        const { data, name: n, links, warm, source: s, ...rest } = patch; // eslint-disable-line no-unused-vars
        const after = await ctx.leads.update(lead.id, rest);
        return { saved: true, moved: !!patch.stage && !!after && after.stage === patch.stage, other: true };
      }
      return { saved: false, moved: false, other: true };
    }
    const key = lead ? lead.key : keyFor(name, business);
    if (!key || key.length < 4) return { saved: false, moved: false };
    const row = { key, ...patch };
    if (!lead) {
      row.name = clip(name, 120);
      if (business) row.company = clip(name, 120);
      row.source = clip(source || 'Typed in', 60);
    }
    if (patch.data) row.data = mergeData(lead, patch.data);
    await ctx.leads.upsert(row);
    return { saved: true, moved: !!patch.stage, created: !lead };
  } catch {
    return { saved: false, moved: false };
  }
}

// ---------------------------------------------------------------- businesses

// The email footer every email Do my day hands out ends with (D28, contract 13).
function signed(body, { first, business }) {
  return [String(body || '').trim(), [first, business, outreach.ADDRESS_HOLD].filter(Boolean).join('\n'), outreach.OPT_OUT].join('\n\n');
}

// Do my day's first channel for a local business: call or walk in when there's a phone (local
// partners answer a person faster than an inbox), then Instagram, email, their website's form.
function channelOf(links = {}) {
  if (links.phone) return 'call';
  if (links.instagram) return 'ig';
  if (links.email) return 'email';
  if (links.website) return 'site';
  return null;
}

// 0 to 100: closer, a heavier partner type and more ways to reach them rank first.
function scoreOf({ weight = 1, km = null, phone, website, instagram, email } = {}) {
  let s = 46 + Math.min(3, Math.max(1, Number(weight) || 1)) * 6;
  if (phone) s += 10;
  if (email) s += 6;
  if (instagram) s += 4;
  if (website) s += 4;
  if (Number.isFinite(km)) s -= Math.min(30, Math.round(km * 2));
  return Math.max(5, Math.min(95, Math.round(s)));
}

// Every message for one business. m: { biz, first, business, what, area, phone, their, why, ask, give,
// dm, walkin, subject } (dm and walkin from kit first25.partnerMessage when the caller has them).
function businessMsg(m, channel) {
  const biz = m.biz || 'there';
  const hi = /^there$/i.test(biz) ? 'Hi there,' : `Hi ${biz} team,`;
  const me = m.first ? `I'm ${m.first}, and I` : 'I';
  const dm = text.plain(m.dm || `${hi} ${me} just started ${m.what} in ${m.area}. A lot of your ${m.their} ${m.why}. Would you be open to letting me ${m.ask}? In return I'd be glad to ${m.give}. I can stop by any day this week.`);
  const walkin = text.plain(m.walkin || `Hi, is the owner or manager around? ${m.first ? `I'm ${m.first}. ` : ''}I do ${m.what} nearby, and a lot of your ${m.their} ${m.why}. Could I ${m.ask}? I'd be glad to ${m.give}.`);
  const reach = m.phone ? `I'm at ${m.phone}.` : 'Just reply here.';
  const f1 = text.plain(`${hi} following up on my note about your ${m.their}. Happy to drop off a few cards, or ${m.give}. Would that help?`);
  const f2 = text.plain(`${hi} last note from me. If a ${m.what} partner ever helps your ${m.their}, ${reach} Thanks for reading!`);
  const byEmail = channel === 'email' || channel === 'site';
  const who = { first: m.first, business: m.business };
  return {
    dm,
    subject: clip(m.subject || `${text.sentenceCase(m.what)} for your ${m.their} in ${m.area}`, 120),
    email: signed(dm.replace(/^Hi ([^,]+),\s*/, 'Hi $1,\n\n'), who),
    walkin,
    follow1: byEmail ? signed(f1, who) : f1,
    follow2: byEmail ? signed(f2, who) : f2,
  };
}

// A Pipeline row for one business found on OpenStreetMap (or typed by the member). b: { key, name,
// address, phone, website, instagram, email, maps, km, type (partner type object), source, sample }.
function businessRow(b, { msg, facts, score, source, stage, data } = {}) {
  const links = {};
  if (b.website) links.website = b.website;
  if (b.phone) links.phone = b.phone;
  if (b.email) links.email = b.email;
  if (b.instagram) links.instagram = /^https?:/.test(b.instagram) ? b.instagram : `https://www.instagram.com/${String(b.instagram).replace(/^@/, '')}/`;
  if (b.maps && /^https:\/\//.test(b.maps)) links.maps = b.maps;
  const channel = channelOf(links);
  const row = {
    key: b.key || `biz:${norm(b.name).slice(0, 80)}`,
    name: clip(b.name, 120),
    company: clip(b.name, 120),
    source: clip(source || (b.source === 'osm' ? 'OpenStreetMap' : 'Typed in'), 60),
    note: clip(b.address || '', 1000),
    links,
    warm: false,
    msg,
    facts: (facts || []).filter(Boolean).slice(0, 5).map((f) => clip(f, 160)),
    score: Number.isFinite(score) ? score : scoreOf({ weight: b.type && b.type.weight, km: b.km, phone: b.phone, website: b.website, instagram: b.instagram, email: b.email }),
    data: { type: b.type ? b.type.id : null, km: Number.isFinite(b.km) ? b.km : null, ...(data || {}) },
  };
  if (channel) row.channel = channel;
  if (stage) row.stage = stage;
  return row;
}

// A Pipeline row for someone the member knows: warm, with the personal text and two follow-ups.
// Texts to people they know carry no address or opt-out lines (D28).
function personRow(p, { source = 'Your first 25', score = 80 } = {}) {
  const links = {};
  if (p.phone) links.phone = p.phone;
  if (p.email) links.email = p.email;
  const row = {
    key: `person:${norm(p.name).slice(0, 80)}`,
    name: clip(p.name, 120),
    source,
    note: clip(p.note || '', 1000),
    warm: true,
    links,
    msg: { dm: p.message, follow1: p.follow_up || '', follow2: p.follow_up_2 || '' },
    facts: p.note ? [clip(text.sentenceCase(p.note), 160)] : [],
    score,
  };
  if (p.phone) row.channel = 'call';
  else if (p.email) row.channel = 'email';
  return row;
}

// Upserts rows one by one (a bad row never stops the rest). Returns how many were saved.
async function saveRows(ctx, rows) {
  if (!canSave(ctx)) return 0;
  let n = 0;
  for (const r of rows) {
    try {
      await ctx.leads.upsert(r);
      n += 1;
    } catch {
      /* the list still works without this row */
    }
  }
  return n;
}

module.exports = { norm, canSave, everyone, findLead, isOwn, isBusiness, keyFor, save, signed, channelOf, scoreOf, businessMsg, businessRow, personRow, saveRows, mergeData, BUSINESS_WORDS };
