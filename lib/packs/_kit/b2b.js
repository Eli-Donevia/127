// The Pipeline side of a local B2B creative service, shared by webdesign, social and photo. Each pack
// passes its own config (lib/config.js): the service words, its objections, call questions, kickoff,
// keep plans and month-end numbers. Tools made here:
//   <pack>.pick_lead      find a business in the Pipeline (or take a typed name and website)
//   <pack>.log_lead       move it through the Pipeline, or note what happened when another pack owns it
//   <pack>.log_sample     note the free sample on the lead, or add a typed business with its messages
//   <pack>.answer_reply   what a reply meant and a short answer with one next step
//   <pack>.call_sheet     one printable page for a call, from the lead's own facts
//   <pack>.start_client   kickoff, prep, first-month plan, checklist, after-job message, deposit lines
//   <pack>.keep_plan      next month for one client: plan, messages, one upsell, the intro ask
//   <pack>.month_report   month-end report from numbers the member typed, with change on last month
//   <pack>.fresh_leads    drops everyone already in the Pipeline (any pack) from a search
//   <pack>.save_leads     saves ranked leads to this pack's Pipeline with msg, facts, score, channel
// Drafts only: the member reads and sends everything from their own accounts.

const kit = require('.');
const { text, views, save, files, time, money, brain, ai, color, web } = kit;

const PLACEHOLDER = /^\[business name\]$/i;
const STAGES = ['found', 'contacted', 'replied', 'call', 'won', 'lost'];
const STAGE_LABEL = { found: 'Found', contacted: 'Contacted', replied: 'Replied', call: 'Call booked', won: 'Won', lost: 'Lost' };

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const isUrl = (s) => {
  const t = String(s || '').trim();
  return !/\s/.test(t) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t);
};
const domainOf = (u) => {
  try {
    return u ? web.domainOf(u) : '';
  } catch {
    return '';
  }
};
const siteOf = (u) => (u ? web.normalizeUrl(String(u).trim()) : '');
const firstWord = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const esc = (s) => files.esc(String(s == null ? '' : s));
// Plain text that keeps its line breaks, with no space before punctuation.
const say = (s) => text.plain(String(s || '').replace(/[ \t]+([.,!?])/g, '$1'));
// A fact written for the member ("Their site doesn't link to an Instagram.") as said to the owner
// ("Your site doesn't link to an Instagram."), for lines the member says or sends.
const toYou = (fact) =>
  String(fact || '')
    .replace(/\bthey're\b/gi, (m) => (m[0] === 'T' ? "You're" : "you're"))
    .replace(/\btheir\b/gi, (m) => (m[0] === 'T' ? 'Your' : 'your'))
    .replace(/\bthey\b/gi, (m) => (m[0] === 'T' ? 'You' : 'you'))
    .replace(/\bthem\b/g, 'you')
    .replace(/\bwhen we checked\b/g, 'when I checked');

// The member: first name, business and city, for signatures and messages.
function senderOf(ctx) {
  const br = brain.brainOf(ctx, {});
  return { first: br.firstName || '', business: br.name || '', city: br.place || '', address: br.address || '' };
}

// The member's offer: what they saved with "Your offer", else the menu at the standard point.
function offerNow(cfg, ctx) {
  const saved = brain.packMemory(ctx, cfg.pack).offer;
  const position = saved && ['budget', 'standard', 'premium'].includes(saved.position) ? saved.position : 'standard';
  const o = cfg.offer.build({ position, spots: saved && saved.spots });
  return { ...o, saved: !!saved };
}

// "2026-10" for a month; the month that is ending by default (from the 20th on, this month).
function monthKey(input, ctx) {
  if (/^\d{4}-\d{2}$/.test(String(input || ''))) return input;
  const t = time.today(ctx);
  const [y, m, d] = t.split('-').map(Number);
  if (d >= 20) return `${y}-${String(m).padStart(2, '0')}`;
  const pm = m === 1 ? 12 : m - 1;
  return `${m === 1 ? y - 1 : y}-${String(pm).padStart(2, '0')}`;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "Nov 2" from "2026-11-02".
const monthDay = (iso) => `${MONTHS[Number(String(iso).slice(5, 7)) - 1].slice(0, 3)} ${Number(String(iso).slice(8, 10))}`;
const monthLabel = (k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const shiftMonth = (k, by) => {
  const y = Number(k.slice(0, 4));
  const m = Number(k.slice(5, 7)) - 1 + by;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
};

// A printable page in the member's colors (no scripts).
function pageHtml({ title, sub = '', sections = [], foot = '', p }) {
  const css = `*{box-sizing:border-box}body{margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:${p.ink};background:${p.paper};line-height:1.5}
main{max-width:780px;margin:0 auto;padding:28px 22px 40px}h1{font-size:26px;line-height:1.2;margin:0 0 6px;color:${p.primary}}
.sub{margin:0 0 18px;color:${p.muted}}h2{font-size:17px;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid ${p.line}}
ul,ol{margin:0;padding-left:20px}li{margin:4px 0}.box{background:#fff;border:1px solid ${p.line};border-radius:12px;padding:12px 14px;margin:8px 0}
.say{background:${p.surface};border-left:4px solid ${p.primary};border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-line}
.q{font-weight:700;margin:10px 0 2px}.tip{color:${p.muted};font-size:14px;margin:2px 0 8px}
table{width:100%;border-collapse:collapse;margin:6px 0}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid ${p.line};vertical-align:top}th{font-size:13px;color:${p.muted};font-weight:600}
td.n{text-align:right;font-weight:700;white-space:nowrap}th.n{text-align:right}.check li{list-style:none;margin-left:-20px;padding-left:26px;position:relative}
.check li:before{content:'';position:absolute;left:0;top:4px;width:14px;height:14px;border:2px solid ${p.primary};border-radius:3px}
.big{font-size:19px;font-weight:700;margin:4px 0 10px}.foot{margin-top:26px;font-size:12px;color:${p.muted}}
@page{size:Letter;margin:0.5in}@media print{main{padding:0}.box,.say{break-inside:avoid}}`;
  const body = `<main><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${sections
    .filter(Boolean)
    .map((s) => `<h2>${esc(s.h)}</h2>${s.html}`)
    .join('\n')}${foot ? `<p class="foot">${esc(foot)}</p>` : ''}</main>`;
  return files.htmlDoc({ title, css, body });
}
const ul = (items, cls = '') => (items && items.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
const ol = (items) => (items && items.length ? `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>` : '');
const sayBox = (t) => `<div class="say">${esc(t)}</div>`;

// "one-page website at $600 instead of $1,000" or "monthly posts at $385 a month instead of $550,
// for the first 3 months": the first founding price on the ladder, or every one with { all: true }.
function foundingText(o, { all = false } = {}) {
  const list = (o && o.ladder && o.ladder.prices) || [];
  if (!list.length) return '';
  const one = (f) => {
    const per = f.unit === 'month' ? ' a month' : f.unit && f.unit !== 'project' ? ` ${f.unit === 'person' ? 'a person' : `a ${f.unit}`}` : '';
    return `${f.label.toLowerCase()} at ${money.usd(f.founding)}${per} instead of ${money.usd(f.full)}`;
  };
  const parts = (all ? list : list.slice(0, 1)).map(one);
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `${said}${o.ladder.months ? `, for the first ${o.ladder.months} months` : ''}`;
}

// The one-page offer sheet (printable, no scripts). groups: [{ h, items: [{ label, price, per, includes }] }].
// asOf (YYYY-MM-DD) dates the prices at the foot, next to how to reach the member.
function offerSheet({ o, br, p, groups, how, asOf = '' }) {
  const card = (x) => `<div class="card"><h3>${esc(x.label)}</h3><p class="price">${esc(money.usd(x.price))}${x.per ? ` <span>${esc(x.per)}</span>` : ''}</p><ul>${(x.includes || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  const css = `*{box-sizing:border-box}body{margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:${p.ink};background:${p.paper};line-height:1.5}main{max-width:820px;margin:0 auto;padding:28px 20px}
h1{font-size:30px;line-height:1.15;margin:0 0 6px;color:${p.primary}}h2{font-size:20px;margin:26px 0 10px}.lead{font-size:17px;margin:0 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{background:#fff;border:1px solid ${p.line};border-radius:14px;padding:16px}
.card h3{margin:0 0 4px;font-size:17px}.price{font-size:22px;font-weight:800;color:${p.primary};margin:0 0 8px}.price span{font-size:14px;font-weight:600;color:${p.muted}}ul{margin:0;padding-left:18px}li{margin:3px 0}
.box{background:${p.surface};border-radius:14px;padding:14px 16px}.small{font-size:13px;color:${p.muted};margin-top:22px}@page{size:Letter;margin:0.5in}@media print{.card,.box{break-inside:avoid}}`;
  const f = foundingText(o, { all: true });
  const foot = [[br.firstName, br.name].filter(Boolean).join(', '), br.place, br.website ? web.shortSite(br.website) : '', br.instagram ? `@${br.instagram}` : '', asOf ? `Prices as of ${time.longDate(asOf)}` : ''].filter(Boolean).join('  |  ');
  const body = `<main><h1>${esc(o.name)}</h1><p class="lead">For ${esc(o.who.charAt(0).toLowerCase() + o.who.slice(1))}. ${esc(o.outcome)}.</p>
${groups.map((g) => `<h2>${esc(g.h)}</h2><div class="grid">${g.items.map(card).join('')}</div>`).join('\n')}
<h2>My promise</h2><div class="box">${esc(o.promise)}</div>
${f ? `<h2>Founding clients</h2><div class="box">I'm taking ${o.ladder.spots} founding clients: ${esc(f)}, in exchange for ${esc(o.ladder.ask)}. ${esc(o.ladder.step_up)}</div>` : ''}
${how ? `<h2>How it works</h2><div class="box">${esc(how)}</div>` : ''}
${foot ? `<p class="small">${esc(foot)}</p>` : ''}</main>`;
  return files.htmlDoc({ title: o.name, css, body });
}

function paletteOf(ctx) {
  const m = brain.packMemory(ctx, 'brand');
  const hex = [m.primary, m.color, m.palette && m.palette.primary].find((c) => typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c));
  return color.palette(hex ? (hex.startsWith('#') ? hex : `#${hex}`) : 'clean');
}

// ---------- the business: from the Pipeline or typed ----------

function rowFacts(row) {
  if (!row) return [];
  const a = Array.isArray(row.facts) ? row.facts : [];
  const b = row.data && Array.isArray(row.data.facts) ? row.data.facts.map((f) => (f && f.fact) || f) : [];
  const out = [];
  for (const f of a.concat(b)) {
    const t = text.oneLine(String(f || ''));
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(text.clip(t, 200));
  }
  return out.slice(0, 6);
}

// The business's own row first: this pack's, named for the business (not a person the sales desk
// logged with it as their company), and still open.
function bestOf(rows, pack, n = '') {
  const score = (r) => (r.pack === pack ? 8 : 0) + (n && norm(r.name) === n ? 4 : 0) + (/^person:/.test(r.key || '') ? 0 : 2) + (r.stage !== 'lost' ? 1 : 0);
  return rows.slice().sort((a, b) => score(b) - score(a))[0];
}

async function findRow(ctx, typed, site, pack) {
  if (!ctx.leads || typeof ctx.leads.list !== 'function') return null;
  let rows = [];
  try {
    rows = ((await ctx.leads.list({ all: true, limit: 2000 })) || []).filter(Boolean);
  } catch {
    rows = [];
  }
  const t = String(typed || '').trim();
  const n = norm(t);
  const dom = domainOf(site) || (isUrl(t) ? domainOf(t) : '');
  const byId = rows.find((r) => r.id === t || r.key === t);
  if (byId) return byId;
  if (n && !isUrl(t)) {
    const exact = rows.filter((r) => norm(r.name) === n || norm(r.company) === n);
    if (exact.length) return bestOf(exact, pack, n);
  }
  if (dom) {
    const same = rows.filter((r) => r.links && r.links.website && domainOf(r.links.website) === dom);
    if (same.length) return bestOf(same, pack);
  }
  if (n.length >= 4 && !isUrl(t)) {
    const part = rows.filter((r) => {
      const rn = norm(r.name);
      return rn && !PLACEHOLDER.test(r.name || '') && rn.length >= 4 && (rn.includes(n) || n.includes(rn));
    });
    if (part.length === 1) return part[0];
  }
  return null;
}

async function ownRow(ctx, row, pack) {
  if (!row) return false;
  if (row.pack) return row.pack === pack;
  try {
    const mine = (await ctx.leads.list({ limit: 2000 })) || [];
    return mine.some((r) => r && r.id === row.id);
  } catch {
    return true;
  }
}

// The lead the spec tools read: website, name, city and kind of business.
function leadFromRow(row, { typed, city }) {
  const d = (row && row.data) || {};
  const google = !!(row && (row.placeId || d.placeId || (row.key && /^gplaces:/.test(row.key))));
  const name = row && !PLACEHOLDER.test(row.name || '') ? row.name : '';
  return {
    key: row.key,
    name: name || '',
    siteName: name || '',
    website: (row.links && row.links.website) || null,
    city: d.city || city || '',
    category: d.category ? { id: d.category } : null,
    source: google ? 'google' : d.from || 'web',
    placeId: d.placeId || row.placeId || null,
    instagram: row.links && row.links.instagram ? String(row.links.instagram).replace(/^https:\/\/www\.instagram\.com\//, '').replace(/\/$/, '') : null,
    score: row.score != null ? row.score : null,
    sample: !!d.sample,
    typedName: google && typed && !isUrl(typed) ? typed : '',
  };
}

function pickTool(cfg) {
  return {
    name: `${cfg.pack}.pick_lead`,
    title: 'Find the business',
    description: "Finds one business in your Pipeline by name, website or id, with what you saved about it (stage, facts, messages, their reply). A name or website that isn't in your Pipeline yet still works.",
    kind: 'code',
    risk: 'read',
    needs: [],
    credits: 0,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Which business', maxLength: 200, description: 'A name from your Pipeline, or type one' },
        website: { type: 'string', title: 'Their website (optional)', maxLength: 300 },
        city: { type: 'string', title: 'Their city (optional)', maxLength: 80 },
        contact: { type: 'string', title: 'Who you talk to there (optional)', maxLength: 80 },
      },
    },
    output: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        own: { type: 'boolean' },
        id: { type: ['string', 'null'] },
        key: { type: 'string' },
        name: { type: 'string' },
        display: { type: 'string' },
        stage: { type: 'string' },
        website: { type: 'string' },
        city: { type: 'string' },
        contact: { type: 'string' },
        who: { type: 'string' },
        email: { type: 'string' },
        facts: { type: 'array', items: { type: 'string' } },
        reply: { type: 'string' },
        note: { type: 'string' },
        channel: { type: 'string' },
        lead: { type: 'object' },
        credit: { type: 'array' },
        sample: { type: 'boolean' },
      },
      required: ['found', 'own', 'key', 'name', 'display', 'stage', 'website', 'facts'],
    },
    async run(input, ctx) {
      const typed = text.oneLine(input.name || '');
      const site = text.oneLine(input.website || '');
      if (!typed && !site) throw new Error('Pick a business from your Pipeline, or type its name and website.');
      const row = await findRow(ctx, typed, site, cfg.pack);
      if (row) {
        const own = await ownRow(ctx, row, cfg.pack);
        const lead = leadFromRow(row, { typed, city: input.city });
        if (!lead.website && (site || isUrl(typed))) lead.website = siteOf(site || typed);
        const name = lead.name || '';
        const display = name || lead.typedName || (lead.website ? web.shortSite(lead.website) : 'This business');
        const d = row.data || {};
        const contact = text.oneLine(input.contact || (d.site && d.site.owner) || d.owner || clientOf(cfg, ctx, row.key).contact || '');
        ctx.log(`${display}: ${STAGE_LABEL[row.stage] || row.stage} in your Pipeline`);
        return {
          found: true,
          own,
          id: row.id || null,
          key: row.key,
          name,
          display,
          stage: STAGES.includes(row.stage) ? row.stage : 'found',
          website: lead.website || '',
          city: lead.city || '',
          contact,
          who: contact,
          email: (row.links && row.links.email) || '',
          facts: rowFacts(row),
          reply: text.clip(row.reply || '', 2000),
          note: text.clip(row.note || '', 1000),
          channel: row.channel || '',
          lead,
          credit: d.from === 'osm' ? [{ source: 'osm', searchBy: d.searchBy || null }] : [],
          sample: !!d.sample,
        };
      }
      const website = site ? siteOf(site) : isUrl(typed) ? siteOf(typed) : '';
      const name = isUrl(typed) ? '' : typed;
      const key = website ? `site:${domainOf(website)}` : `typed:${text.slug(name, 60)}`;
      const display = name || (website ? web.shortSite(website) : 'This business');
      const contact = text.oneLine(input.contact || clientOf(cfg, ctx, key).contact || '');
      ctx.log(`${display} isn't in your Pipeline yet, so it's worked from what you typed`);
      return {
        found: false,
        own: true,
        id: null,
        key,
        name,
        display,
        stage: 'found',
        website,
        city: text.oneLine(input.city || ''),
        contact,
        who: contact,
        email: '',
        facts: [],
        reply: '',
        note: '',
        channel: '',
        // No lead for a typed business: the spec tool reads the website itself (name, facts, colors).
        credit: [],
        sample: kit.leads.isSampleUrl(website),
      };
    },
    view(out) {
      return views.blocks(
        views.text(out.found ? `${out.display}: ${STAGE_LABEL[out.stage] || out.stage} in your Pipeline.${out.own ? '' : ' Saved by another workflow.'}` : `${out.display} isn't in your Pipeline yet.`),
        out.facts.length ? views.text(`What you saved about them: ${out.facts.slice(0, 3).join(' ')}`) : null,
        kit.places.creditBlocks(out.credit || [])
      );
    },
  };
}

// ---------- logging ----------

const LOG_WHAT = ['contacted', 'replied', 'call', 'won', 'lost'];

async function logLead(cfg, ctx, pick, { what, reply, answer, note } = {}) {
  const p = pick || {};
  const today = time.today(ctx);
  const was = p.stage || 'found';
  const msg = answer ? { answer: String(answer) } : null;
  let lead = null;
  let line = '';
  if (p.found && !p.own && p.id && ctx.leads && typeof ctx.leads.update === 'function') {
    const patch = {};
    if (reply) patch.reply = String(reply);
    if (msg) patch.msg = msg;
    if (note) patch.note = text.clip(`${note}${p.note ? ` ${p.note}` : ''}`, 1000);
    lead = await ctx.leads.update(p.id, patch);
    const move = what && STAGES.indexOf(what) > STAGES.indexOf(was);
    line = move ? `Another workflow saved ${p.display}, so move it to ${STAGE_LABEL[what]} in your Pipeline yourself. ${msg ? 'Your answer is on it for Do my day.' : ''}` : `${p.display} stays ${STAGE_LABEL[was]} in your Pipeline.`;
    return { lead, line: say(line), stage: was, moved: false };
  }
  if (!ctx.leads || typeof ctx.leads.upsert !== 'function') return { lead: null, line: 'Your Pipeline is not available in this run.', stage: was, moved: false };
  const row = { key: p.key };
  if (!p.found) {
    row.name = p.name || p.display;
    row.company = row.name;
    row.source = text.clip(`${cfg.service.label} (typed)`, 60);
    row.links = p.website ? { website: p.website } : {};
    row.data = { service: cfg.service.id, city: p.city || null, from: 'typed', sample: !!p.sample };
  }
  if (what && STAGES.includes(what)) row.stage = what;
  if (reply) row.reply = String(reply);
  if (msg) row.msg = msg;
  if (note) row.note = text.clip(`${note}${p.note ? ` ${p.note}` : ''}`, 1000);
  lead = await ctx.leads.upsert(row);
  const stage = (lead && lead.stage) || what || was;
  const moved = stage !== was || !p.found;
  line = !p.found ? `Added ${p.display} to your Pipeline as ${STAGE_LABEL[stage]}.` : moved ? `${p.display}: now ${STAGE_LABEL[stage]} in your Pipeline (was ${STAGE_LABEL[was]}).` : `${p.display} stays ${STAGE_LABEL[stage]} in your Pipeline.`;
  if (what === 'won') await rememberClient(cfg, ctx, p, today);
  return { lead, line: say(line), stage, moved };
}

// Clients the pack keeps for keep and month-end (key -> name and since when).
// A client you started with this pack (pack memory): { name, since, package, contact, ... } or {}.
function clientOf(cfg, ctx, key) {
  const clients = brain.packMemory(ctx, cfg.pack).clients;
  return (clients && typeof clients === 'object' && key && clients[key]) || {};
}

async function rememberClient(cfg, ctx, p, today, extra = {}) {
  const mem = brain.packMemory(ctx, cfg.pack);
  const clients = mem.clients && typeof mem.clients === 'object' ? { ...mem.clients } : {};
  const prev = clients[p.key] || {};
  clients[p.key] = { ...prev, name: p.display, since: prev.since || today, ...extra };
  const keys = Object.keys(clients);
  if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete clients[k];
  await brain.remember(ctx, 'clients', clients);
}

function logTool(cfg) {
  return {
    name: `${cfg.pack}.log_lead`,
    title: 'Log what happened',
    description: 'Moves a business through your Pipeline (contacted, replied, call booked, won or lost) and keeps their reply and your answer on it for Do my day. A business another workflow saved gets the note, and you move its stage yourself.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 0,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The business', description: `From ${cfg.pack}.pick_lead` },
        what: { type: 'string', enum: LOG_WHAT, title: 'What happened' },
        reply: { type: 'string', maxLength: 6000, title: 'What they wrote (optional)' },
        answer: { type: 'string', maxLength: 4000, title: 'Your answer (optional)' },
        note: { type: 'string', maxLength: 600, title: 'Note (optional)' },
      },
      required: ['pick', 'what'],
    },
    output: { type: 'object', properties: { name: { type: 'string' }, stage: { type: 'string' }, moved: { type: 'boolean' }, line: { type: 'string' } }, required: ['name', 'stage', 'moved', 'line'] },
    async run(input, ctx) {
      const r = await logLead(cfg, ctx, input.pick, input);
      return { name: (input.pick && input.pick.display) || 'This business', stage: r.stage, moved: r.moved, line: r.line };
    },
    view(out) {
      return [views.text(out.line)];
    },
  };
}

// After a free sample: the note on the lead, the sample line as the answer when they asked for it,
// or a new Pipeline row (with its first messages) for a business typed by name and website.
function logSampleTool(cfg) {
  return {
    name: `${cfg.pack}.log_sample`,
    title: 'Note the free sample',
    description: `Notes the free ${cfg.sampleNoun} on the business in your Pipeline, with the line to send it. A business you typed is added to your Pipeline with its first message and follow-ups, so Do my day hands it to you.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 60,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The business', description: `From ${cfg.pack}.pick_lead` },
        sample: { type: 'object', title: 'The sample', description: 'The spec tool output (its line and name)' },
      },
      required: ['pick', 'sample'],
    },
    output: { type: 'object', properties: { name: { type: 'string' }, line: { type: 'string' }, added: { type: 'boolean' }, stage: { type: 'string' }, send: { type: 'string' } }, required: ['name', 'line', 'added', 'stage', 'send'] },
    async run(input, ctx) {
      const p = input.pick || {};
      const s = input.sample || {};
      const today = time.today(ctx);
      const name = p.name || (s.nameKnown !== false && s.name && !/^This (business|restaurant)$/.test(s.name) ? s.name : '') || p.display;
      const sendLine = text.plain(s.line || '');
      const note = text.clip(`Free ${cfg.sampleNoun} made ${time.shortDate(today)}.`, 200);
      if (!ctx.leads || typeof ctx.leads.upsert !== 'function') return { name, line: 'Your Pipeline is not available in this run.', added: false, stage: p.stage || 'found', send: sendLine };
      if (p.found) {
        const replied = p.stage === 'replied' || p.stage === 'call';
        const patch = { note: text.clip(`${note}${p.note ? ` ${p.note}` : ''}`, 1000) };
        if (replied && sendLine) patch.msg = { answer: sendLine };
        if (p.own) await ctx.leads.upsert({ key: p.key, ...patch });
        else if (p.id && typeof ctx.leads.update === 'function') await ctx.leads.update(p.id, patch);
        const line = replied ? `Saved on ${p.display}: the line to send it is your answer in Do my day.` : `Noted on ${p.display} in your Pipeline. Send it with your first message or the day 3 follow-up.`;
        return { name, line, added: false, stage: p.stage, send: sendLine };
      }
      // Typed: read the site (cached, or the sample scan for .example sites) and save it with its messages.
      const website = p.website || '';
      const scan = website ? await kit.leads.scanFor(ctx, website) : null;
      // No kind of business is known for a typed one: the kit's walk-in reads "for local {many}", so give
      // it plain words ("local businesses", never "local local businesses").
      const base = kit.leads.makeLead({ website: website || null, name, source: 'web' }, scan, { now: new Date(ctx.now()), city: p.city || '', category: { id: null, one: 'business', many: 'businesses', what: 'work' } });
      const lead = kit.leads.rankLeads([{ ...base, key: p.key }], cfg.service, { top: 1 }).leads[0] || { ...base, key: p.key };
      const draft = kit.outreach.draft({ lead, service: cfg.service, sender: senderOf(ctx) });
      // The first follow-up delivers the sample they were offered.
      const withSample = { ...draft, followUp1: sendLine ? `Hi ${draft.hi}, it's ${senderOf(ctx).first || 'me'} again. ${sendLine}` : draft.followUp1 };
      if (sendLine) withSample.followUp1Email = draft.followUp1Email.replace(/^(Hi [^\n]*\n\n)[^\n]*/, `$1${sendLine}`);
      const row = kit.leads.pipelineLead(lead, { service: cfg.service, message: withSample.dm, draft: withSample });
      row.name = text.clip(name || row.name, 120);
      row.company = row.name;
      row.note = text.clip(`${note} ${row.note || ''}`, 1000);
      row.source = text.clip(`${cfg.service.label} (typed)`, 60);
      row.data = { ...row.data, from: 'typed' };
      const saved = await ctx.leads.upsert(row);
      return { name: row.name, line: `Added ${row.name} to your Pipeline with a first message, and the follow-up on day 3 sends the ${cfg.sampleNoun}.`, added: true, stage: (saved && saved.stage) || 'found', send: sendLine };
    },
    view(out) {
      // The spec tool's own view shows the line to send; this one only says what changed in the Pipeline.
      return views.blocks(views.text(out.line));
    },
  };
}

// ---------- replies ----------

const INTENT_LABEL = { stop: 'Asked you to stop', price: 'Wants the price', covered: 'Has someone already', later: 'Not right now', who: 'Wants to know who you are', yes: 'Interested', question: 'Asked a question', other: 'Not sure yet', objection: 'Has a worry' };

function numbersIn(s) {
  return (String(s || '').match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, '').replace(/,/g, ''));
}
function bracketsIn(s) {
  return String(s || '').match(/\[[^\]]+\]/g) || [];
}

// A draft from AI keeps every number and every [blank] of the template and adds none.
function keepsFacts(draft, template, extra) {
  const allowed = new Set(numbersIn(`${template} ${extra || ''}`));
  if (numbersIn(draft).some((n) => !allowed.has(n))) return false;
  const holes = new Set(bracketsIn(template));
  if (bracketsIn(draft).some((b) => !holes.has(b))) return false;
  return ai.cleanCopy(draft) && draft.length <= 700 && !/\b(as an ai|i cannot)\b/i.test(draft);
}

function answerTool(cfg) {
  return {
    name: `${cfg.pack}.answer_reply`,
    title: 'Answer their reply',
    description: `Reads what a business wrote back and says what they meant (interested, the price, a worry, not now, has someone, a question, or stop). Drafts a short answer with one next step, built on the usual worries in ${cfg.label}, and says where they go in your Pipeline. A stop gets no answer.`,
    kind: 'ai',
    tasks: ['write'],
    risk: 'draft',
    needs: [],
    credits: 3,
    timeoutSec: 60,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The business', description: `From ${cfg.pack}.pick_lead` },
        reply: { type: 'string', maxLength: 6000, title: 'What they wrote back' },
      },
      required: ['pick', 'reply'],
    },
    output: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        intent: { type: 'string' },
        label: { type: 'string' },
        meaning: { type: 'string' },
        answer: { type: 'string' },
        next: { type: 'string' },
        tip: { type: 'string' },
        stage: { type: 'string' },
        logAs: { type: ['string', 'null'] },
        followUpDays: { type: ['integer', 'null'] },
        priceNote: { type: 'string' },
        ai: { type: 'boolean' },
        sample: { type: 'boolean' },
      },
      required: ['name', 'intent', 'label', 'meaning', 'answer', 'next', 'stage', 'ai'],
    },
    async run(input, ctx) {
      const reply = String(input.reply || '').trim();
      if (!reply) throw new Error('Paste what they wrote back first.');
      const p = input.pick || {};
      const sender = senderOf(ctx);
      const lead = { ...(p.lead || {}), name: p.name || (p.lead && p.lead.name) || '', siteName: p.name || '' };
      const base = kit.outreach.answer({ lead, service: cfg.service, sender, reply });
      const name = p.display || 'They';
      if (base.stop) {
        return { name, intent: 'stop', label: INTENT_LABEL.stop, meaning: 'They asked you to stop.', answer: '', next: "Don't send anything else, not even a thank-you. They are marked lost so they stay off your lists.", tip: 'Email law (US CAN-SPAM) gives you 10 business days at most to stop; stopping now is the rule.', stage: 'lost', logAs: 'lost', followUpDays: null, priceNote: '', ai: false, sample: !!p.sample };
      }
      const o = offerNow(cfg, ctx);
      const v = { biz: p.name || 'your business', me: sender.first || '[your name]', fact: p.facts && p.facts[0] ? p.facts[0] : '', sample: cfg.sampleNoun, priceLine: cfg.priceLine(o), o };
      v.factYou = toYou(v.fact);
      v.facts = Array.isArray(p.facts) ? p.facts : [];
      v.you = toYou;
      const obj = cfg.objections.find((x) => x.match.test(reply));
      let intent = base.intent;
      let meaning = base.meaning;
      let draft = base.answer;
      let next = base.next;
      let tip = '';
      if (intent === 'price') {
        meaning = 'They want a price before anything else.';
        draft = `${cfg.priceLine(o)} ${cfg.priceFollow || `No long contract. If you'd like to see it first, the free ${cfg.sampleNoun} is still yours.`}`;
        next = 'Say the price once, then stop.';
      }
      if (obj && intent !== 'yes') {
        tip = obj.tip || '';
        if (intent === 'price' && obj.id !== 'cost') draft = obj.ack ? `${obj.ack(v)} ${draft}` : draft;
        else {
          intent = 'objection';
          meaning = obj.means || `They said: "${obj.says}"`;
          draft = obj.say(v);
          next = obj.next || 'Answer the worry in a line or two, then make one clear offer.';
        }
      }
      if (intent === 'yes') draft = say(cfg.yesLine ? cfg.yesLine(v) : base.answer);
      if (intent === 'covered') tip = tip || 'Leave the door open and check back in two months. One check-in, then let it go.';
      const priceNote = o.saved ? '' : 'Prices are the middle of the market range. Run "Your offer" to set your own, and the answers use them.';
      // AI tightens the answer to what they actually wrote, keeping every number and [blank].
      let usedAi = false;
      if (['price', 'objection', 'question', 'other', 'covered', 'who'].includes(intent) && !p.sample) {
        const factsLine = [cfg.offerFacts(o), ...(p.facts || []).slice(0, 3)].filter(Boolean).join('\n');
        const res = await ai.aiText(ctx, {
          task: 'write',
          system: `You help a ${cfg.label} freelancer answer a local business owner who replied to a cold message. Plain text, 2 to 4 short sentences, friendly and direct. End with one question or one next step. Use only the facts given. Keep every number exactly as written and every [bracketed blank] as it is; add no new numbers, results, reviews or promises. Never say "guaranteed".`,
          prompt: `They wrote:\n${text.clip(reply, 1500)}\n\nFacts you may use:\n${factsLine}\n\nDraft answer to improve (keep its numbers and [blanks]):\n${draft}\n\nWrite only the answer.`,
          maxTokens: 400,
          accept: (t) => keepsFacts(t, draft, `${factsLine} ${reply}`),
          fallback: () => draft,
        });
        draft = res.text;
        usedAi = res.ai;
      }
      const stage = 'replied';
      return {
        name,
        intent,
        label: INTENT_LABEL[intent] || INTENT_LABEL.other,
        meaning,
        answer: say(draft),
        next,
        tip,
        stage,
        logAs: 'replied',
        followUpDays: intent === 'later' || intent === 'covered' ? 60 : 3,
        priceNote,
        ai: usedAi,
        sample: !!p.sample,
      };
    },
    view(out) {
      if (out.intent === 'stop') return views.blocks(views.metric('What they meant', out.label), views.text(out.next), views.text(out.tip));
      return views.blocks(
        views.metric('What they meant', out.label, out.meaning),
        views.copy(`Your answer to ${out.name}`, out.answer),
        views.text(`Next: ${out.next}${out.followUpDays ? ` If they go quiet, check back in ${out.followUpDays} days.` : ''}`),
        out.tip ? views.text(`Good to know: ${out.tip}`) : null,
        out.priceNote ? views.text(out.priceNote) : null
      );
    },
  };
}

// ---------- the call ----------

function callSheetTool(cfg) {
  return {
    name: `${cfg.pack}.call_sheet`,
    title: 'Write your call sheet',
    description: `One printable page for a call with one business, from its own facts: what to check first, the questions to ask, your price said once, answers to the usual worries in ${cfg.label}, the close, and what to send after.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The business', description: `From ${cfg.pack}.pick_lead` },
        prospect: { type: ['object', 'null'], title: 'Facts from their website', description: 'From sales.read_prospect (optional)' },
        notes: { type: 'string', maxLength: 3000, title: 'What they told you (optional)' },
        when: { type: 'string', maxLength: 80, title: 'When the call is (optional)' },
      },
      required: ['pick'],
    },
    output: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        checks: { type: 'array', items: { type: 'string' } },
        questions: { type: 'array', items: { type: 'string' } },
        price: { type: 'string' },
        worries: { type: 'array', items: { type: 'object', properties: { says: { type: 'string' }, say: { type: 'string' } } } },
        close: { type: 'string' },
        after: { type: 'string' },
        page: { type: 'object' },
        prospect: { type: 'object', description: 'The website facts for sales.proposal, with the person you talk to as the name' },
        sample: { type: 'boolean' },
      },
      required: ['name', 'checks', 'questions', 'price', 'worries', 'close', 'after', 'page'],
    },
    async run(input, ctx) {
      const p = input.pick || {};
      const pr = input.prospect && typeof input.prospect === 'object' ? input.prospect : null;
      const o = offerNow(cfg, ctx);
      const sender = senderOf(ctx);
      const name = p.display || 'This business';
      const v = { biz: p.name || 'your business', me: sender.first || '[your name]', fact: (p.facts || [])[0] || '', sample: cfg.sampleNoun, o, pick: p, prospect: pr };
      const seen = [];
      const facts = [];
      let scanned = [];
      let read = pr;
      if ((!(pr && pr.reachable) || pr.sample) && p.website && kit.leads.isSampleUrl(p.website)) {
        // A sample (.example) site: the kit's sample scan gives the website facts ranked for this
        // service (the sales desk's own read of it is general), for this sheet and for the proposal.
        const scan = await kit.leads.scanFor(ctx, p.website);
        if (scan && scan.reachable) {
          const lead = kit.leads.makeLead({ website: p.website, name: p.name, source: 'web', sample: true }, scan, { now: new Date(ctx.now()) });
          const pts = (cfg.service && cfg.service.gaps) || {};
          const all = kit.leads.shareableGaps(lead);
          const mine = all.filter((g) => pts[g.id] > 0);
          const gaps = (mine.length ? mine : all).sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
          scanned = gaps.map((g) => g.why).filter(Boolean);
          read = { ...(pr || {}), website: p.website, domain: web.domainOf(p.website) || '', reachable: true, reason: '', readOn: time.today(ctx), relevant: gaps.slice(0, 4).map((g) => ({ key: g.id, label: g.why })), facts: scanned.slice(0, 6), notes: (pr && pr.notes) || [] };
        }
      }
      for (const f of [...(p.facts || []), ...scanned, ...((pr && pr.reachable && Array.isArray(pr.facts) && pr.facts) || [])]) {
        const t = text.oneLine(String(f || ''));
        const k = t.toLowerCase().slice(0, 60);
        if (t && !seen.includes(k)) {
          seen.push(k);
          facts.push(text.clip(t, 220));
        }
      }
      // The fact to name first: the best one we have, from the Pipeline or their own site.
      if (!v.fact && facts.length) v.fact = facts[0];
      v.factYou = toYou(v.fact);
      v.facts = facts;
      v.you = toYou;
      const checks = [
        ...cfg.call.checks(v),
        p.reply ? `Reread what they wrote: "${text.clip(text.oneLine(p.reply), 160)}"` : '',
        input.notes ? `Your notes: ${text.clip(text.oneLine(input.notes), 200)}` : '',
        pr && !pr.reachable && p.website && !p.sample && !scanned.length ? `Their website didn't load when we checked (${String(pr.reason || 'no answer').replace(/\.$/, '')}). Ask about it.` : '',
      ].filter(Boolean);
      const questions = cfg.call.questions(v).filter(Boolean);
      const price = say(cfg.priceLine(o));
      const worries = cfg.objections.filter((x) => x.onCall !== false).slice(0, 6).map((x) => ({ says: x.says, say: say(x.say(v)) }));
      const founding = o.ladder && o.ladder.spots && foundingText(o) ? say(`If they're one of your first ${o.ladder.spots} clients, offer the founding price: ${foundingText(o, { all: true })}, in exchange for ${o.ladder.ask}. Never tie it to a review.`) : '';
      const close = say(cfg.call.close(v));
      const after = say(cfg.call.after(v));
      const pal = paletteOf(ctx);
      const page = pageHtml({
        title: `Call with ${name}`,
        sub: [input.when ? `When: ${text.oneLine(input.when)}` : '', p.who ? `With: ${p.who}` : '', p.website ? `Website: ${web.shortSite(p.website)}` : ''].filter(Boolean).join('  |  '),
        p: pal,
        sections: [
          { h: '1. Before the call (2 minutes)', html: ul(checks, 'check') },
          facts.length ? { h: 'What you know about them', html: `${ul(facts.slice(0, 6))}<p class="tip">Facts from their own website and what you saved${read && read.reachable && read.readOn ? `, checked ${esc(time.shortDate(read.readOn))}` : ''}. Say only what you checked yourself.</p>` } : null,
          { h: '2. Questions to ask (then listen)', html: ol(questions) },
          { h: '3. Your price, said once', html: `${sayBox(price)}<p class="tip">Say it once, then stop talking and let them answer.${o.saved ? '' : ' These are the middle of the market range: run Your offer to set your own.'}</p>${founding ? `<p class="tip">${esc(founding)}</p>` : ''}` },
          { h: '4. If they say...', html: worries.map((w) => `<p class="q">"${esc(w.says)}"</p>${sayBox(w.say)}`).join('') },
          { h: '5. The close', html: sayBox(close) },
          { h: '6. After the call', html: `<p>${esc(after)}</p>` },
        ],
        foot: `Made ${time.longDate(time.today(ctx))}${sender.business ? ` for ${sender.business}` : ''}. Every fact about ${name} comes from their own website or your notes.`,
      });
      const pageAsset = await save.saveFile(ctx, save.fileName('call sheet', name, '.html'), page);
      // sales.proposal greets prospect.name when it has no name: give it the person, never the business.
      const prospect = read ? { ...read, name: p.who || '' } : undefined;
      return { name, checks, questions, price, worries, close, after, founding, facts, page: pageAsset, prospect, sample: !!p.sample };
    },
    view(out) {
      return views.blocks(
        views.file(out.page, `Call sheet for ${out.name} (print it or keep it open on the call)`),
        views.text(`Check first: ${out.checks.slice(0, 3).join(' ')}`),
        views.copy('Your price, said once', out.price),
        views.copy('The close', out.close),
        views.text(`After: ${out.after}`)
      );
    },
  };
}

// ---------- a customer said yes ----------

function startTool(cfg) {
  const ids = cfg.start.packages.map((x) => x.id);
  return {
    name: `${cfg.pack}.start_client`,
    title: 'Start a new client',
    description: `Everything for a new ${cfg.label} client: the kickoff message, what they get ready, the first month with dates, a printable checklist for the first job, the message for after you deliver, an honest feedback ask, and the lines for the deposit invoice.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The business', description: `From ${cfg.pack}.pick_lead` },
        package: { type: 'string', enum: ids, default: ids[0], title: 'What they bought' },
        start: { type: 'string', maxLength: 10, title: 'Start date (YYYY-MM-DD, optional)', description: 'Leave blank for next Monday' },
        founding: { type: 'boolean', default: false, title: 'Founding client price' },
        email: { type: 'string', maxLength: 120, title: 'Their email (optional)' },
        contact: { type: 'string', maxLength: 80, title: 'Who you work with there (optional)' },
      },
      required: ['pick'],
    },
    output: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        package: { type: 'string' },
        start: { type: 'string' },
        kickoff: { type: 'string' },
        prep: { type: 'string' },
        plan: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, what: { type: 'string' } } } },
        after: { type: 'string' },
        feedback: { type: 'string' },
        checklist: { type: 'object' },
        invoice: { type: 'object' },
        sample: { type: 'boolean' },
      },
      required: ['name', 'package', 'start', 'kickoff', 'prep', 'plan', 'after', 'feedback', 'checklist', 'invoice'],
    },
    async run(input, ctx) {
      const p = input.pick || {};
      const name = p.display || 'your client';
      const today = time.today(ctx);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? input.start : time.nextWeekday(today, 1, { after: true });
      const o = offerNow(cfg, ctx);
      const pkg = cfg.start.packages.find((x) => x.id === input.package) || cfg.start.packages[0];
      const sender = senderOf(ctx);
      const hi = input.contact ? firstWord(input.contact) : p.contact ? firstWord(p.contact) : `${p.name || name} team`;
      const v = { biz: p.name || name, hi, me: sender.first || '[your name]', start, startText: time.shortDate(start), pkg, o, founding: !!input.founding, date: (n) => time.shortDate(time.addDays(start, n)) };
      const plan = cfg.start.plan(v).map((x) => ({ date: time.shortDate(time.addDays(start, x.day)), what: say(x.what) }));
      const needs = cfg.start.needs(v);
      const prep = say(`Hi ${hi}, ${cfg.start.prepIntro || 'to get started, could you send me:'}\n${needs.map((n) => `- ${n}`).join('\n')}`);
      const kickoff = say(cfg.start.kickoff(v, plan));
      const ask = o.ladder || {};
      const feedback = say(
        input.founding
          ? `Hi ${hi}, now that it's done: would you write 2 or 3 honest sentences about working together that I can quote, with your name, as a founding client? And may I show ${cfg.start.showWhat} in my portfolio? Only if you're happy with it, and nothing changes either way.`
          : `Hi ${hi}, now that it's done: would you write 2 or 3 honest sentences about working together that I can quote? And may I show ${cfg.start.showWhat} in my portfolio? Only if you're happy with it, and nothing changes either way.`
      );
      const after = say(cfg.start.after(v));
      // The deposit invoice: the package at the member's price, the founding price as its own line.
      const menu = o.menu;
      const item = menu.packages.find((x) => x.id === pkg.id) || (o.care || []).find((x) => x.id === pkg.id);
      const items = [];
      if (item) items.push({ label: item.label, detail: text.clip((item.includes || []).join(', '), 300) || undefined, qty: 1, unit: item.unit || 'project', price: item.price });
      const fp = (ask.prices || []).find((x) => x.id === pkg.id);
      if (input.founding && item && fp && fp.founding < item.price) {
        items.push({ label: 'Founding client price', detail: text.clip(`${Math.round((1 - fp.founding / item.price) * 100)}% off${ask.months ? ` for the first ${ask.months} months` : ''}, in exchange for ${ask.ask}`, 300), qty: 1, unit: 'each', price: -money.round(item.price - fp.founding, 2) });
      }
      const invoice = {
        items,
        title: text.clip(cfg.start.title(v), 120),
        // No deposit (paid in full up front, like a month of a plan) stays out of the invoice input.
        deposit: (typeof cfg.start.deposit === 'function' ? cfg.start.deposit(v) : cfg.start.deposit) || undefined,
        customer: { name: text.clip(input.contact ? text.oneLine(input.contact) : p.name || name, 80), company: text.clip(p.name || '', 80), email: text.clip(text.oneLine(input.email || p.email || ''), 120) },
        terms: text.clip((typeof cfg.start.terms === 'function' ? cfg.start.terms(v) : cfg.start.terms) || '', 1200),
        // Due on the start day, so the deposit (or the first month) is paid before the first shoot or work day.
        due: start > today ? start : today,
      };
      const pal = paletteOf(ctx);
      const page = pageHtml({
        title: `${name}: first ${typeof cfg.start.jobWord === 'function' ? cfg.start.jobWord(v) : cfg.start.jobWord}`,
        sub: `${pkg.label}. Starts ${time.longDate(start)}.`,
        p: pal,
        sections: [
          { h: 'The plan', html: `<table><tr><th>When</th><th>What</th></tr>${plan.map((x) => `<tr><td>${esc(x.date)}</td><td>${esc(x.what)}</td></tr>`).join('')}</table>` },
          { h: `What you need from ${p.name || 'them'}`, html: ul(needs, 'check') },
          { h: 'Checklist for the job', html: ul(cfg.checklist, 'check') },
          { h: 'Good to know', html: ul(cfg.start.rules || []) },
        ],
        foot: `Your copy. ${sender.business || sender.first || ''}`.trim(),
      });
      const checklist = await save.saveFile(ctx, save.fileName(name, 'kickoff checklist', '.html'), page);
      await rememberClient(cfg, ctx, p, today, { package: pkg.id, start, founding: !!input.founding, price: item ? item.price : null, unit: item ? item.unit : null, contact: text.oneLine(input.contact || p.contact || '') });
      return { name, package: pkg.label, start, kickoff, prep, plan, after, feedback, checklist, invoice, sample: !!p.sample };
    },
    view(out) {
      return views.blocks(
        views.copy(`Kickoff message to ${out.name}`, out.kickoff),
        views.copy('What they get ready', out.prep),
        views.table([{ key: 'date', label: 'When' }, { key: 'what', label: 'What' }], out.plan),
        views.file(out.checklist, `First ${out.name} job: plan and checklist (print it)`),
        views.copy('After you deliver', out.after),
        views.copy('Ask for honest feedback (a few days later, on its own)', out.feedback),
        views.text('Feedback is for your website and pitch. Ask for Google reviews separately and never offer anything for one (Google and FTC rules).')
      );
    },
  };
}

// ---------- keep the customer ----------

function keepTool(cfg) {
  return {
    name: `${cfg.pack}.keep_plan`,
    title: 'Plan their next month',
    description: `Next month for one ${cfg.label} client: the plan with dates, a one-page plan to send them, the check-in message, the offer to keep going, one upsell that fits, and an intro ask. Never a promise of results.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The client', description: `From ${cfg.pack}.pick_lead` },
        month: { type: 'string', maxLength: 7, title: 'Which month (YYYY-MM, optional)', description: 'Leave blank for next month' },
        plan: { type: 'string', enum: cfg.keep.planIds, title: 'Plan to offer (optional)' },
        notes: { type: 'string', maxLength: 1500, title: "What's coming up for them (optional)", description: 'Like "New spring menu April 3" or "Hiring two techs"' },
      },
      required: ['pick'],
    },
    output: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        month: { type: 'string' },
        plan: { type: 'object' },
        weeks: { type: 'array', items: { type: 'object', properties: { when: { type: 'string' }, what: { type: 'string' } } } },
        checkin: { type: 'string' },
        offer: { type: 'string' },
        upsell: { type: 'string' },
        intro: { type: 'string' },
        page: { type: 'object' },
        sample: { type: 'boolean' },
      },
      required: ['name', 'month', 'plan', 'weeks', 'checkin', 'offer', 'upsell', 'intro', 'page'],
    },
    async run(input, ctx) {
      const p = input.pick || {};
      const name = p.display || 'your client';
      const today = time.today(ctx);
      const month = /^\d{4}-\d{2}$/.test(String(input.month || '')) ? input.month : shiftMonth(today.slice(0, 7), 1);
      const o = offerNow(cfg, ctx);
      const sender = senderOf(ctx);
      const mem = brain.packMemory(ctx, cfg.pack);
      const client = (mem.clients && mem.clients[p.key]) || {};
      const plans = cfg.keep.plans(o);
      const plan = plans.find((x) => x.id === input.plan) || plans.find((x) => x.id === client.plan) || plans[0];
      const notes = text.oneLine(input.notes || '');
      const hi = p.contact ? firstWord(p.contact) : `${p.name || name} team`;
      const first = `${month}-01`;
      const monday = time.nextWeekday(first, 1);
      const v = { biz: p.name || name, hi, me: sender.first || '[your name]', month, monthName: monthLabel(month).split(' ')[0], plan, plans, o, notes, client, mondays: [0, 7, 14, 21].map((d) => time.addDays(monday, d)) };
      const weeks = cfg.keep.weeks(v).map((w, i) => ({ when: `Week of ${monthDay(v.mondays[i] || v.mondays[3])}`, what: say(w) }));
      const checkin = say(cfg.keep.checkin(v));
      const offer = say(cfg.keep.offer(v));
      const upsell = say(cfg.keep.upsell(v));
      const intro = say(`Hi ${hi}, quick question. Who's one business owner you know who could use ${cfg.keep.introWhat}? An email or text with both of us on it is perfect. No pressure at all.`);
      const pal = paletteOf(ctx);
      const page = pageHtml({
        title: `${name}: plan for ${monthLabel(month)}`,
        sub: `${plan.label}${plan.price ? `, ${money.usd(plan.price)} ${plan.unit === 'month' ? 'a month' : `per ${plan.unit}`}` : ''}.`,
        p: pal,
        sections: [
          { h: 'Week by week', html: `<table><tr><th>When</th><th>What</th></tr>${weeks.map((w) => `<tr><td>${esc(w.when)}</td><td>${esc(w.what)}</td></tr>`).join('')}</table>` },
          { h: "What's included", html: ul(plan.includes || []) },
          notes ? { h: 'Coming up for you', html: `<p>${esc(notes)}</p>` } : null,
          { h: 'How we check it', html: `<p>${esc(cfg.keep.measure)}</p>` },
        ],
        foot: `From ${[sender.first, sender.business].filter(Boolean).join(', ') || 'your ' + cfg.label + ' partner'}. Month to month: change or stop any time before the next month.`,
      });
      const pageAsset = await save.saveFile(ctx, save.fileName(name, 'plan', month, '.html'), page);
      return { name, month, plan: { id: plan.id, label: plan.label, price: plan.price || null, unit: plan.unit || 'month', includes: plan.includes || [] }, weeks, checkin, offer, upsell, intro, page: pageAsset, sample: !!p.sample };
    },
    view(out) {
      return views.blocks(
        views.metric(`Plan for ${monthLabel(out.month)}`, out.plan.label, out.plan.price ? `${money.usd(out.plan.price)} ${out.plan.unit === 'month' ? 'a month' : `per ${out.plan.unit}`}` : undefined),
        views.table([{ key: 'when', label: 'When' }, { key: 'what', label: 'What' }], out.weeks),
        views.file(out.page, `${out.name}: the plan to send them`),
        views.copy('Check-in message', out.checkin),
        views.copy('Offer to keep going', out.offer),
        views.copy('One upsell that fits', out.upsell),
        views.copy('Ask for an intro (on its own, another day)', out.intro)
      );
    },
  };
}

// ---------- month-end report ----------

function monthTool(cfg) {
  const M = cfg.month.metrics;
  const numbersSchema = { type: 'object', properties: Object.fromEntries(M.map((m) => [m.key, { type: ['number', 'null'], minimum: 0, title: m.label }])) };
  return {
    name: `${cfg.pack}.month_report`,
    title: 'Write the month-end report',
    description: `One ${cfg.label} client's month in plain words: a one-page report with only the numbers you counted and the change from last month, the email to send with it, an honest feedback ask, an intro ask and next month in one line. Nothing estimated.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        pick: { type: 'object', title: 'The client', description: `From ${cfg.pack}.pick_lead` },
        numbers: numbersSchema,
        month: { type: 'string', maxLength: 7, title: 'Month (YYYY-MM, optional)' },
        goal: { type: 'string', maxLength: 80, title: 'What the owner counted (optional)', description: cfg.month.goalHint || 'Like "Tuesday covers"' },
        goalCount: { type: ['number', 'null'], minimum: 0, title: 'Their count (optional)' },
        done: { type: 'string', maxLength: 1500, title: 'What you did this month (optional)' },
        nextUp: { type: 'string', maxLength: 600, title: 'Next month in one line (optional)' },
        permission: { type: 'string', enum: ['named', 'anonymous'], default: 'anonymous', title: 'Can you name them in your case study?' },
      },
      required: ['pick'],
    },
    output: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        month: { type: 'string' },
        headline: { type: 'string' },
        rows: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, change: { type: 'string' } } } },
        email: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } } },
        feedback: { type: 'string' },
        intro: { type: 'string' },
        story: { type: 'string' },
        page: { type: 'object' },
        sample: { type: 'boolean' },
      },
      required: ['name', 'month', 'headline', 'rows', 'email', 'feedback', 'intro', 'story', 'page'],
    },
    async run(input, ctx) {
      const p = input.pick || {};
      const name = p.display || 'your client';
      const month = monthKey(input.month, ctx);
      const nums = {};
      for (const m of M) {
        const n = money.num(input.numbers && input.numbers[m.key]);
        if (n != null && n >= 0) nums[m.key] = n;
      }
      const goalLabel = text.oneLine(input.goal || '');
      if (goalLabel && money.num(input.goalCount) != null) nums.goal = money.num(input.goalCount);
      const mem = brain.packMemory(ctx, cfg.pack);
      const reports = (mem.reports && typeof mem.reports === 'object' ? mem.reports : {})[p.key] || {};
      const prevKey = shiftMonth(month, -1);
      const prev = reports[prevKey] || null;
      const fmt = (m, n) => (m.unit === '%' ? `${money.round(n, 1)}%` : m.unit === 'days' ? `${money.round(n, 1)} days` : money.int(n));
      const rows = [];
      const all = goalLabel && nums.goal != null ? [{ key: 'goal', label: goalLabel, kind: 'result' }, ...M] : M;
      for (const m of all) {
        if (nums[m.key] == null) continue;
        const was = prev && prev[m.key] != null ? prev[m.key] : null;
        let change = '';
        if (was != null) {
          const d = money.round(nums[m.key] - was, 1);
          change = d === 0 ? `Same as ${MONTHS[Number(prevKey.slice(5)) - 1]}` : `${d > 0 ? 'Up' : 'Down'} ${m.unit === '%' ? `${Math.abs(d)} points` : money.int(Math.abs(d))} from ${MONTHS[Number(prevKey.slice(5)) - 1]}`;
        }
        rows.push({ key: m.key, label: m.label, value: fmt(m, nums[m.key]), change, kind: m.kind || 'work', d: was != null ? nums[m.key] - was : null, better: m.better || 'up' });
      }
      const sender = senderOf(ctx);
      const hi = p.contact ? firstWord(p.contact) : `${p.name || name} team`;
      const mName = monthLabel(month);
      const results = rows.filter((r) => r.kind === 'result');
      const lead = results[0] || rows[0];
      const headline = lead ? `${lead.label} in ${mName}: ${lead.value}${lead.change ? ` (${lead.change.toLowerCase()})` : ''}.` : `${mName} report for ${name}.`;
      const changes = rows.some((r) => r.change);
      const done = text.plain(input.done || '');
      const nextUp = text.plain(input.nextUp || '') || cfg.month.nextDefault;
      const lines = rows.map((r) => `- ${r.label}: ${r.value}${r.change ? ` (${r.change.toLowerCase()})` : ''}`);
      const sign = [sender.first || '[your name]', sender.business].filter(Boolean).join('\n');
      const body = [
        `Hi ${hi},`,
        '',
        `Here's ${mName} for ${p.name || name}. The one-page report is attached.`,
        '',
        rows.length ? lines.join('\n') : '[Add the numbers you counted this month.]',
        done ? `\nWhat I did: ${done}` : '',
        '',
        `Next month: ${nextUp}`,
        '',
        'Anything you want changed? Reply here and I will fold it in.',
        '',
        sign,
      ]
        .filter((x, i, a) => !(x === '' && a[i - 1] === ''))
        .join('\n');
      const email = { subject: text.clip(`${p.name || name}: your ${mName} report`, 90), body };
      const wins = rows.filter((r) => r.d != null && ((r.better === 'up' && r.d > 0) || (r.better === 'down' && r.d < 0)));
      const feedback = say(`Hi ${hi}, a quick favor while ${mName} is fresh: would you write 2 or 3 honest sentences about working together that I could quote${input.permission === 'named' ? ' with your name' : ''}? What was it like before, and what's different now? Only if you're happy to, and nothing changes either way.`);
      const intro = say(`Hi ${hi}, who's one business owner you know who could use ${cfg.keep.introWhat}? An email or text with both of us on it is perfect.`);
      const who = input.permission === 'named' ? p.name || name : cfg.month.anonymous;
      const client = (mem.clients && mem.clients[p.key]) || {};
      const storyNums = rows.slice(0, 4).map((r) => `${r.label.charAt(0).toLowerCase()}${r.label.slice(1)}: ${r.value}`).join('; ');
      const story = say(`${cfg.month.storyLead(who)} ${storyNums ? `In ${mName}: ${storyNums}.` : ''} ${client.founding ? `${input.permission === 'named' ? 'They are' : 'This client is'} a founding client at a reduced price, so say that wherever you share this.` : ''} Numbers as counted by me and the owner; no estimates.`);
      const pal = paletteOf(ctx);
      const page = pageHtml({
        title: `${name}: ${mName}`,
        sub: headline,
        p: pal,
        sections: [
          { h: 'The numbers', html: rows.length ? `<table><tr><th>What</th><th class="n">${esc(mName)}</th>${changes ? '<th>Change</th>' : ''}</tr>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="n">${esc(r.value)}</td>${changes ? `<td>${esc(r.change)}</td>` : ''}</tr>`).join('')}</table><p class="tip">${esc(cfg.month.source)}</p>` : '<p>No numbers this month.</p>' },
          done ? { h: 'What I did', html: `<p>${esc(done)}</p>` } : null,
          { h: 'Next month', html: `<p>${esc(nextUp)}</p>` },
        ],
        foot: `Made by ${[sender.first, sender.business].filter(Boolean).join(', ') || 'your ' + cfg.label + ' partner'} on ${time.longDate(time.today(ctx))}.`,
      });
      const pageAsset = await save.saveFile(ctx, save.fileName(name, mName, 'report', '.html'), page);
      const keep = { ...reports, [month]: nums };
      const months = Object.keys(keep).sort();
      for (const k of months.slice(0, Math.max(0, months.length - 12))) delete keep[k];
      const allReports = { ...(mem.reports || {}), [p.key]: keep };
      const keys = Object.keys(allReports);
      if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete allReports[k];
      await brain.remember(ctx, 'reports', allReports);
      return { name, month, headline, rows: rows.map(({ label, value, change }) => ({ label, value, change })), wins: wins.length, email, feedback, intro, story, page: pageAsset, sample: !!p.sample };
    },
    view(out) {
      return views.blocks(
        views.text(out.headline),
        out.rows.length ? views.table([{ key: 'label', label: 'What' }, { key: 'value', label: 'Number' }, ...(out.rows.some((r) => r.change) ? [{ key: 'change', label: 'Change' }] : [])], out.rows) : views.text('No numbers yet. Add what you counted and run it again: anything left blank stays out of the report.'),
        views.file(out.page, `${out.name}, ${monthLabel(out.month)} report (attach it)`),
        views.copy(`Email to ${out.name}`, out.email.body, { subject: out.email.subject }),
        views.copy('Ask for honest feedback (on its own)', out.feedback),
        views.copy('Ask for an intro (on its own)', out.intro),
        views.copy('For your case study (once they say yes in writing)', out.story)
      );
    },
  };
}

// ---------- the next batch ----------

function freshTool(cfg) {
  return {
    name: `${cfg.pack}.fresh_leads`,
    title: 'Skip who you know',
    description: 'Takes the businesses a search found and drops everyone already in your Pipeline (from any workflow, by id, name or website), then keeps the number you asked for.',
    kind: 'code',
    risk: 'read',
    needs: [],
    credits: 0,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        found: { type: 'object', title: 'Search results', description: 'From leads.find_businesses' },
        more: { type: ['object', 'null'], title: 'More search results (optional)' },
        count: { type: 'integer', minimum: 1, maximum: 100, default: 25, title: 'How many' },
      },
      required: ['found'],
    },
    output: { type: 'object', properties: { places: { type: 'array' }, category: { type: 'object' }, city: { type: 'string' }, source: { type: 'string' }, known: { type: 'integer' }, short: { type: 'boolean' }, sample: { type: 'boolean' } }, required: ['places', 'category', 'city', 'source', 'known'] },
    async run(input, ctx) {
      const lists = [input.found, input.more].filter((x) => x && Array.isArray(x.places));
      const k = await kit.leads.known(ctx);
      const seen = new Set();
      const keep = [];
      let known = 0;
      for (const l of lists) {
        for (const pl of l.places) {
          if (!pl) continue;
          const dom = pl.website ? domainOf(pl.website) : '';
          const id = pl.key || (pl.placeId ? `gplaces:${pl.placeId}` : '') || (dom ? `site:${dom}` : '') || norm(pl.name);
          if (seen.has(id)) continue;
          seen.add(id);
          const isKnown = (pl.key && k.keys.has(pl.key)) || (pl.placeId && k.keys.has(`gplaces:${pl.placeId}`)) || (dom && k.sites.has(dom)) || (pl.name && k.names.has(String(pl.name).toLowerCase().trim()));
          if (isKnown) {
            known++;
            continue;
          }
          keep.push({ ...pl, category: pl.category || l.category });
        }
      }
      const want = input.count || 25;
      const places = keep.slice(0, want);
      if (!places.length) throw new Error(known ? 'Everyone this search found is already in your Pipeline. Try another kind of business, a second kind, or a bigger radius.' : 'The search found no businesses. Try another kind of business or a bigger radius.');
      const first = lists[0];
      ctx.log(`${places.length} new businesses${known ? `, ${known} skipped (already in your Pipeline)` : ''}`);
      return { places, category: first.category, city: first.city, source: first.source, known, short: places.length < want, sample: lists.some((l) => l.sample) };
    },
    view(out) {
      return views.blocks(
        views.metric('New businesses', out.places.length, out.known ? `${out.known} skipped: already in your Pipeline` : 'None of them are in your Pipeline yet'),
        out.short ? views.text('Fewer than you asked for near you. Add a second kind of business or a bigger radius next time.') : null,
        kit.places.creditBlocks(out.places)
      );
    },
  };
}

// Applies the member's edits from the approve step (same rules as leads.export).
function applyEdits(byKey, edits) {
  for (const e of edits || []) {
    const m = e && byKey.get(e.key);
    if (!m || !e.text) continue;
    const ch = String(e.channel || '');
    if (/instagram|facebook/i.test(ch)) m.dm = text.plain(e.text);
    else if (/call/i.test(ch)) m.call = text.plain(e.text);
    else if (/walk/i.test(ch)) m.walkIn = text.plain(e.text);
    else m.email = { ...m.email, body: String(e.text) };
  }
}

function saveTool(cfg) {
  return {
    name: `${cfg.pack}.save_leads`,
    title: 'Save to your Pipeline',
    description: 'Saves the ranked businesses to your Pipeline with what Do my day reads for each one: the first message and follow-ups for its best channel, the facts it opens on, the fit score and the channel. Also a spreadsheet of the batch.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 0,
    timeoutSec: 90,
    input: {
      type: 'object',
      properties: {
        rank: { type: 'object', title: 'Ranked businesses', description: 'From leads.score_fit' },
        messages: { type: 'array', title: 'Messages', description: 'From leads.write_outreach' },
        edits: { type: 'array', title: 'Edited messages', description: 'Items from the approve step' },
        scan: { type: 'array', title: 'Checked businesses', description: 'From leads.scan_business, used when you asked for more than 60' },
        count: { type: 'integer', minimum: 1, maximum: 100, title: 'How many to save' },
        export: { type: ['object', 'null'], title: 'Saved files', description: 'From leads.export (its workbook, spreadsheet and calendar are shown here)' },
        batch: { type: 'string', maxLength: 40, default: 'next 25', title: 'Batch name' },
      },
      required: ['rank'],
    },
    output: { type: 'object', properties: { saved: { type: 'integer' }, failed: { type: 'integer' }, list: { type: 'array' }, csv: { type: ['object', 'null'] }, files: { type: 'object' }, sample: { type: 'boolean' } }, required: ['saved', 'list', 'files'] },
    async run(input, ctx) {
      const ranked = ((input.rank && input.rank.leads) || []).filter((l) => l && l.key && !l.error);
      const want = input.count || ranked.length;
      let list = ranked.slice(0, want);
      if (want > list.length && Array.isArray(input.scan)) {
        const have = new Set(list.map((l) => l.key));
        const rest = kit.leads.rankLeads(input.scan.filter((l) => l && l.key && !l.error && !have.has(l.key)), cfg.service, { top: want - list.length }).leads;
        list = list.concat(rest.map((l, i) => ({ ...l, rank: list.length + i + 1 })));
      }
      if (!list.length) throw new Error('No businesses to save.');
      const byKey = new Map((input.messages || []).filter((m) => m && m.key).map((m) => [m.key, { ...m }]));
      applyEdits(byKey, input.edits);
      const sender = senderOf(ctx);
      let saved = 0;
      let failed = 0;
      const out = [];
      const rows = [];
      for (const l of list) {
        const m = byKey.get(l.key) || kit.outreach.draft({ lead: l, service: cfg.service, sender });
        try {
          const row = kit.leads.pipelineLead(l, { service: cfg.service, message: m.dm, draft: m });
          row.data = { ...row.data, from: l.source || null, ...(l.searchBy ? { searchBy: l.searchBy } : {}), batch: input.batch || 'next 25' };
          if (ctx.leads && typeof ctx.leads.upsert === 'function') {
            await ctx.leads.upsert(row);
            saved++;
          }
          out.push({ rank: l.rank, name: row.name, score: row.score != null ? row.score : null, channel: row.channel || '', opens: text.clip((row.facts && row.facts[0]) || '', 110) });
        } catch {
          failed++;
        }
        rows.push(kit.leads.csvRow(l, m, { status: 'In your Pipeline', service: cfg.service }));
      }
      let csv = null;
      if (!input.export) {
        const credit = kit.places.creditLine(list);
        const cat = list[0].category || {};
        const city = kit.places.cityShort(list[0].city || '');
        // Dated, so a weekly repeat never overwrites last week's batch.
        const name = save.fileName(input.batch || 'next 25', cfg.service.label, cat.many || 'businesses', city, time.today(ctx), '.csv');
        csv = await save.saveFile(ctx, name, files.csv(credit ? rows.concat([{ rank: credit }]) : rows, kit.leads.CSV_COLUMNS, { bom: true }));
      }
      const ex = input.export || {};
      ctx.log(`Saved ${saved} businesses to your Pipeline${failed ? ` (${failed} could not be saved)` : ''}`);
      return { saved, failed, list: out, csv, files: { workbook: ex.workbook || null, csv: ex.csv || null, calendar: ex.calendar || null }, credit: list.filter((l) => l.source === 'osm' || l.searchBy).slice(0, 1).map((l) => ({ source: l.source, searchBy: l.searchBy || null })), sample: list.some((l) => l.sample) };
    },
    view(out) {
      return views.blocks(
        views.metric('Saved to your Pipeline', out.saved, 'Stage: found. Do my day hands you each first message, then the follow-ups on day 3 and 7.'),
        views.file(out.files && out.files.workbook, 'Your first 25 workbook (plan and every message)'),
        views.file(out.files && out.files.csv, 'The list as a spreadsheet (CSV)'),
        views.file(out.files && out.files.calendar, 'Reminders for the 7-day plan (calendar file)'),
        views.file(out.csv, 'This batch as a spreadsheet (CSV)'),
        views.table([{ key: 'rank', label: '#', format: 'number' }, { key: 'name', label: 'Business' }, { key: 'score', label: 'Fit', format: 'number' }, { key: 'opens', label: 'Opens with' }], out.list, 10),
        kit.places.creditBlocks(out.credit || [])
      );
    },
  };
}

function makeTools(cfg) {
  return {
    pick: pickTool(cfg),
    log: logTool(cfg),
    logSample: logSampleTool(cfg),
    answer: answerTool(cfg),
    callSheet: callSheetTool(cfg),
    start: startTool(cfg),
    keep: keepTool(cfg),
    month: monthTool(cfg),
    fresh: freshTool(cfg),
    save: saveTool(cfg),
  };
}

module.exports = { makeTools, offerNow, senderOf, monthKey, monthLabel, shiftMonth, pageHtml, offerSheet, foundingText, paletteOf, findRow, keepsFacts, norm, isUrl, toYou, STAGES };
