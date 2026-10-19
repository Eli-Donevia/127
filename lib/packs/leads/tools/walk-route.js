// A walk-in route for one day: businesses near where the member starts, in an order that saves travel
// (nearest next, then untangled), each with its address, its OpenStreetMap page (or an OpenStreetMap
// search for its address), its hours, the walk-in line and boxes to tick. Legs of up to 4 stops open
// in Google Maps from coordinates (Maps URLs allow 3 waypoints on a mobile browser, see
// data/rules.json maps_urls). Starts with the Pipeline; finds more on OpenStreetMap when it runs
// short. No Google Places data: Google listings keep only a place ID, so they never join a route.

const { text, time, places, outreach, views, save, files } = require('../../_kit');
const { serviceOf, senderOf, cityOf } = require('../lib/services');
const V = require('../lib/visits');
const S = require('../lib/sheets');

const LEG = 4;
const RADIUS = { walking: 2.5, driving: 12 };

// When a walk-in usually lands best, by kind of business (a rule of thumb, shown as a tip).
const BEST = {
  fitness: 'Late morning or early afternoon, between the class rushes.',
  food: 'Between 2pm and 4pm, after lunch and before dinner.',
  beauty: 'Weekday mornings, before the chairs fill up.',
  health: 'Mid-morning or mid-afternoon on a weekday. Ask the front desk for the office manager.',
  pro: 'Mid-morning, Tuesday to Thursday.',
  auto: 'Mid-morning, after the drop-off rush.',
  home: 'Early morning before crews head out, or late afternoon.',
  community: 'Weekday mornings. Ask at the office.',
  retail: 'Weekday mornings, soon after they open.',
  hospitality: 'Mid-afternoon on a weekday. Ask for the manager.',
  other: 'Mid-morning or mid-afternoon on a weekday.',
};

const bestFor = (lead) => {
  const c = lead.category && lead.category.id ? places.CATEGORIES[lead.category.id] : null;
  return BEST[(c && c.family) || 'other'] || BEST.other;
};

// Nearest next from the start, then 2-opt swaps until no swap shortens the path (start stays first).
// No start: begin at the stop farthest from the middle, so the route sweeps across once.
function order(stops, start) {
  const left = stops.slice();
  const out = [];
  if (!start && left.length > 2) {
    const mid = centroid(left);
    left.sort((a, b) => (places.km(mid, b) || 0) - (places.km(mid, a) || 0));
  }
  let at = start || left[0];
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((s, i) => {
      const d = places.km(at, s);
      if (d != null && d < bd) [bd, bi] = [d, i];
    });
    at = left.splice(bi, 1)[0];
    out.push(at);
  }
  const p = start ? [start, ...out] : out;
  const d = (a, b) => (a && b ? places.km(a, b) || 0 : 0);
  for (let pass = 0, better = true; better && pass < 60; pass++) {
    better = false;
    for (let i = 1; i < p.length - 1; i++) {
      for (let k = i + 1; k < p.length; k++) {
        const delta = d(p[i - 1], p[k]) + d(p[i], p[k + 1]) - d(p[i - 1], p[i]) - d(p[k], p[k + 1]);
        if (delta < -1e-9) {
          p.splice(i, k - i + 1, ...p.slice(i, k + 1).reverse());
          better = true;
        }
      }
    }
  }
  return start ? p.slice(1) : p;
}

const centroid = (list) => (list.length ? { lat: list.reduce((a, s) => a + s.lat, 0) / list.length, lng: list.reduce((a, s) => a + s.lng, 0) / list.length } : null);
const at = (s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;

// A walk-in follow-up, for a business already sent a first message.
function followUpLine({ d, sender, when }) {
  return text.plain(`Hi, I'm ${sender.first || '[your name]'}. I reached out ${when} with an idea for ${d.name}, and I was nearby, so I thought I'd stop in. Is the owner or the manager in today?`);
}

function spoken(day, today) {
  if (!day) return 'last week';
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / V.DAY);
  if (diff <= 1) return diff <= 0 ? 'earlier today' : 'yesterday';
  if (diff < 7) return `on ${time.WEEKDAYS[time.weekdayOf(day)]}`;
  return `on ${time.longDate(day).replace(/, \d{4}$/, '')}`;
}

module.exports = {
  name: 'leads.walk_route',
  title: 'Plan your walk-in route',
  description: 'An ordered route through the businesses near where you start, with each address, a map link from OpenStreetMap, hours, what to say at the counter and boxes to tick. Starts with your Pipeline; finds more on OpenStreetMap when it runs short. Legs open in Google Maps on a phone.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['osm'],
  credits: 5,
  timeoutSec: 150,
  input: {
    type: 'object',
    properties: {
      service: { type: 'string', title: 'What you sell', description: 'For example "websites" or "photos"' },
      category: { type: 'string', title: 'Who to visit (optional)', description: 'Like "salons". Empty: businesses already in your Pipeline' },
      city: { type: 'string', title: 'City (optional)', description: "Empty: your profile's city" },
      start: { type: 'string', title: 'Where you start (optional)', maxLength: 120, description: 'An address or a neighborhood, like "Court Ave, Des Moines". Empty: the middle of your city' },
      stops: { type: 'integer', title: 'How many stops', minimum: 4, maximum: 20, default: 10 },
      travel: { type: 'string', title: 'Getting around', enum: ['driving', 'walking'], default: 'driving' },
      your_name: { type: 'string', title: 'Your first name (optional)', maxLength: 40 },
    },
    required: ['service'],
  },
  output: {
    type: 'object',
    properties: { stops: { type: 'integer' }, km: { type: 'number' }, legs: { type: 'array' }, entries: { type: 'array' }, route: { type: 'object' }, csv: { type: 'object' }, saved: { type: 'integer' }, notes: { type: 'array' } },
    required: ['stops', 'legs', 'entries', 'route', 'csv'],
  },
  async run(input, ctx) {
    const service = serviceOf(input.service);
    const sender = senderOf(ctx, input);
    const want = Math.max(4, Math.min(20, input.stops || 10));
    const travel = input.travel === 'walking' ? 'walking' : 'driving';
    const city = cityOf(ctx, input);
    const startText = text.clip(text.oneLine(input.start || ''), 120);
    const now = ctx.now();
    const today = time.today(ctx);
    const notes = [];

    // Where the day starts: the address they typed (found on the map), else the middle of their city
    // to pick nearby stops, with the first leg starting wherever the member is.
    let center = null;
    let started = false;
    if (ctx.sample) center = city ? places.sampleCenter(city) : null;
    else {
      if (startText) {
        center = await places.geocode(ctx, startText);
        started = !!center;
        if (!center) notes.push(`The map search didn't find "${startText}", so leg 1 starts from wherever you are.`);
      }
      if (!center && city) center = await places.geocode(ctx, city);
    }

    // 1. The Pipeline: businesses with a map position (found, or due a follow-up), nearest first.
    const { list, rows } = await V.pipelineBusinesses(ctx, { category: input.category, now });
    let pool = list.filter((x) => Number.isFinite(x.lead.lat) && Number.isFinite(x.lead.lng));
    const hub = center || centroid(pool.map((x) => x.lead));
    if (hub) pool = pool.map((x) => ({ ...x, km: places.km(hub, x.lead) })).filter((x) => x.km <= RADIUS[travel] * 2).sort((a, b) => a.km - b.km);
    pool = pool.slice(0, want);

    // 2. Fresh businesses near the start when the Pipeline runs short.
    let fresh = { leads: [] };
    let saved = 0;
    let freshItems = [];
    if (pool.length < want) {
      if (input.category && city) {
        fresh = await V.freshLeads(ctx, { category: input.category, city, near: started ? startText : null, need: want - pool.length, rows, service, want: 'place', radiusKm: travel === 'walking' ? 2 : 10, seconds: 60 });
        if (fresh.sample) {
          // Sample businesses sit around a made-up middle of the city; keep a walking route walkable.
          const mid = places.sampleCenter(city);
          if (!center) center = mid;
          if (travel === 'walking') for (const l of fresh.leads) Object.assign(l, { lat: mid.lat + (l.lat - mid.lat) * 0.2, lng: mid.lng + (l.lng - mid.lng) * 0.2 });
        }
        freshItems = fresh.leads.map((lead) => ({ lead, draft: outreach.draft({ lead, service, sender, cityName: places.cityShort(lead.city || city) }) }));
        saved = await V.saveFresh(ctx, freshItems, { service });
        if (fresh.note) notes.push(fresh.note);
      } else if (!pool.length) {
        throw new Error('Your Pipeline has no businesses with an address yet. Say who to visit (like "salons") and your city, and this finds them.');
      } else notes.push(`Your Pipeline had ${pool.length} businesses near you. Say who to visit and your city to fill the rest of the route.`);
    }

    const stops = [
      ...pool.map((x) => {
        const svc = x.row.data && x.row.data.service ? serviceOf(x.row.data.service) : service;
        const d = outreach.draft({ lead: x.lead, service: svc, sender, cityName: places.cityShort(x.lead.city || city) });
        const sinceDay = x.due && x.row.lastTouchAt ? String(x.row.lastTouchAt).slice(0, 10) : null;
        const walkIn = x.due ? followUpLine({ d, sender, when: spoken(sinceDay, today) }) : (x.row.msg && x.row.msg.walkin) || d.walkIn;
        return { lead: x.lead, kind: x.due ? 'followup' : 'first', walkIn, mention: d.cites[0] || null, fact: d.facts[0] || null, offer: d.freeThing };
      }),
      ...freshItems.map(({ lead, draft }) => ({ lead, kind: 'new', walkIn: draft.walkIn, mention: draft.cites[0] || null, fact: draft.facts[0] || null, offer: draft.freeThing })),
    ].filter((s) => Number.isFinite(s.lead.lat) && Number.isFinite(s.lead.lng));
    if (!stops.length) throw new Error(`No ${places.categoryOf(input.category).many} with an address turned up near ${places.cityShort(startText || city)}. Try a nearby area or another kind of business.`);
    if (stops.length < 4) notes.push(`Only ${stops.length} stops turned up near ${places.cityShort(startText || city)}. Try "driving", a wider area or another kind of business for a fuller day.`);

    // 3. The order, the legs and the distance (straight lines; real roads run longer).
    const path = order(stops.map((s) => ({ ...s, lat: s.lead.lat, lng: s.lead.lng })), started || ctx.sample ? center : null);
    const sample = path.some((s) => s.lead.sample);
    let km = 0;
    path.forEach((s, i) => {
      const prev = i ? path[i - 1] : started ? center : null;
      s.hop = prev ? Math.round(places.km(prev, s) * 10) / 10 : null;
      km += s.hop || 0;
    });
    const legs = [];
    for (let i = 0; i < path.length; i += LEG) {
      const chunk = path.slice(i, i + LEG);
      const origin = i === 0 ? (started ? startText : null) : at(path[i - 1]);
      const url = sample ? null : places.directionsLink(chunk.map((s) => ({ lat: s.lat, lng: s.lng })), { origin: origin || undefined, mode: travel });
      legs.push({ from: i + 1, to: i + chunk.length, url, label: `Stops ${i + 1} to ${i + chunk.length}` });
    }
    const entries = path.map((s, i) => ({
      order: i + 1,
      key: s.lead.key,
      name: s.lead.sample ? s.lead.name : s.lead.siteName || s.lead.name,
      address: s.lead.address || '',
      hours: V.hoursText(s.lead.hours || (s.lead.site && s.lead.site.hours)),
      best: bestFor(s.lead),
      map: V.mapLinkOf(s.lead),
      hop: s.hop,
      kind: s.kind,
      walkIn: s.walkIn,
      mention: s.mention,
      fact: s.fact,
      offer: s.offer,
      phone: V.phoneOf(s.lead),
      website: s.lead.website || null,
      source: s.lead.source,
      sample: !!s.lead.sample,
      ...(s.lead.searchBy ? { searchBy: s.lead.searchBy } : {}),
    }));

    const where = startText || places.cityShort(city);
    const base = save.fileName('walk-in route', service.label, where, time.shortDate(today));
    const route = await save.saveFile(ctx, `${base}.html`, routeHtml({ entries, legs, today, service, where, travel, km, sample, startText: started ? startText : '' }));
    const credit = places.creditLine(entries);
    const cols = [
      { key: 'order', label: '#' },
      { key: 'name', label: 'Business' },
      { key: 'address', label: 'Address' },
      { key: 'hours', label: 'Hours' },
      { key: 'best', label: 'Best time' },
      { key: 'map', label: 'Map' },
      { key: 'walkIn', label: 'What to say' },
      { key: 'mention', label: 'Mention' },
      { key: 'phone', label: 'Phone' },
      { key: 'website', label: 'Website' },
      { key: 'outcome', label: 'How it went' },
      { key: 'back', label: 'Come back on' },
      { key: 'notes', label: 'Notes' },
    ];
    const csvRows = entries.map((e) => ({ ...e, mention: e.mention || '', phone: e.phone || '', website: e.website || '', map: e.map || '', outcome: '', back: '', notes: '' }));
    const csv = await save.saveFile(ctx, `${base}.csv`, files.csv(credit ? csvRows.concat([{ order: credit }]) : csvRows, cols, { bom: true }));
    ctx.log(`Walk-in route: ${entries.length} stops, about ${Math.round(km * 10) / 10} km in straight lines`);
    return {
      stops: entries.length,
      km: Math.round(km * 10) / 10,
      travel,
      start: startText || null,
      legs,
      entries: entries.map((e) => ({ order: e.order, name: e.name, address: e.address, hours: e.hours, map: e.map, walkIn: e.walkIn, mention: e.mention, kind: e.kind, source: e.source, ...(e.searchBy ? { searchBy: e.searchBy } : {}) })),
      route,
      csv,
      saved,
      fromPipeline: pool.length,
      fresh: freshItems.length,
      notes,
      sample,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Stops on your route', out.stops, `About ${out.km} km between stops in straight lines${out.travel === 'walking' ? ', on foot' : ''}`),
      views.file(out.route, 'Your route (open it on your phone or print it)'),
      views.file(out.csv, 'The same route as a spreadsheet (CSV)'),
      out.legs.map((l) => (l.url ? views.link(`${l.label} in Google Maps`, l.url) : null)),
      out.sample ? views.text('Sample businesses have no map links. Real ones get an OpenStreetMap link each and a Google Maps link for every 4 stops.') : null,
      views.table([{ key: 'order', label: '#', format: 'number' }, { key: 'name', label: 'Business' }, { key: 'address', label: 'Address' }, { key: 'hours', label: 'Hours' }], out.entries, 10),
      out.entries[0] ? views.copy(`At ${out.entries[0].name}: what to say`, out.entries[0].walkIn) : null,
      out.saved ? views.text(`Added ${out.saved} new businesses to your Pipeline. Mark each one Contacted once you've stopped in.`) : views.text('Mark each one in your Pipeline after your visit: Contacted, Replied if they want the sample, Lost if they said no.'),
      (out.notes || []).map((n) => views.text(n)),
      places.creditBlocks(out.entries),
      (out.notes || []).some((n) => /sample/i.test(n)) ? null : views.sampleNote(out, 'These businesses')
    );
  },
};

function stopCard(e) {
  const tag = e.kind === 'followup' ? '<span class="tag due">Follow-up visit</span>' : e.kind === 'new' ? '<span class="tag new">New</span>' : '<span class="tag">First visit</span>';
  const meta = [e.address && S.esc(e.address), e.hours ? `Hours: ${S.esc(e.hours)}` : 'Hours: not listed', e.hop != null ? `${S.esc(String(e.hop))} km from the last stop` : null].filter(Boolean).join(' · ');
  const links = [e.map && `<a href="${S.esc(e.map)}">Map (OpenStreetMap)</a>`, e.website && `<a href="${S.esc(e.website)}">Website</a>`, e.phone && `<a href="tel:${S.esc(String(e.phone).replace(/[^\d+]/g, ''))}">${S.esc(e.phone)}</a>`].filter(Boolean).join(' · ');
  return `<div class="card"><div class="top"><span class="n">${e.order}</span><div class="grow"><h3>${S.esc(e.name)}</h3><div class="small muted" style="margin-top:3px">${meta}</div>${tag}${e.fact ? `<p class="fact"><b>What we saw:</b> ${S.esc(e.fact)}</p>` : ''}
<div class="say"><b>At the counter</b>${S.esc(e.walkIn)}</div>${e.mention ? `<div class="say vm"><b>Then mention</b>${S.esc(e.mention)}</div>` : ''}<div class="small muted" style="margin-top:6px">Best time: ${S.esc(e.best)}</div>${links ? `<div class="links">${links}</div>` : ''}
<div class="ticks">${S.tick('Talked to the owner')}${S.tick('Left my card')}${S.tick('Wants the free sample')}${S.tickLine('Come back on')}${S.tick('Not interested')}</div><div class="notes">Name of who I met, notes <i class="line"></i></div></div></div></div>`;
}

function routeHtml({ entries, legs, today, service, where, travel, km, sample, startText }) {
  const minutes = entries.length * 10;
  const pills = [`${entries.length} stops`, `About ${Math.round(km * 10) / 10} km in straight lines`, `About ${Math.round(minutes / 60 * 2) / 2} hours of visits, plus travel`, travel === 'walking' ? 'On foot' : 'By car'];
  const legList = legs
    .map((l) => `<div class="leg"><strong>${S.esc(l.label)}</strong>${l.url ? `<a class="btn" href="${S.esc(l.url)}">Open in Google Maps</a>` : '<span class="small muted">Map links appear for real businesses.</span>'}</div>`)
    .join('');
  const ready = `<div class="grid"><div class="card"><h3>Bring</h3><ul class="plain"><li>This route on your phone, or printed with a pen.</li><li>A business card or a one-page note with your free offer for each stop.</li><li>One example of your work on your phone, ready to show.</li></ul></div><div class="card"><h3>At each stop</h3><ol class="steps"><li>Ask for the owner or the manager by name if you have it.</li><li>Say the line under "At the counter". Keep it under a minute.</li><li>Not in? Ask for their name and a good time, leave your card, and tick Come back.</li></ol></div></div>`;
  const body = `<h2>Before you go</h2>${ready}<h2>Your legs</h2><p class="small muted" style="margin:-4px 0 10px">${startText ? `Leg 1 starts at ${S.esc(startText)}. ` : 'Leg 1 starts from where you are. '}Each leg holds up to 4 stops, so it opens in Google Maps on a phone.</p>${legList}<h2>Your stops</h2>${entries.map(stopCard).join('')}<div class="card"><h3>After your route</h3><ul class="plain"><li>Mark each business in your Pipeline: Contacted when you talked or left your card, Replied when they want the sample, Lost when they said no.</li><li>Send the free sample within 2 days to everyone who said yes.</li><li>Follow up by email or phone 3 days later with anyone you missed.</li></ul></div>`;
  const footer = `${places.creditHtml(entries)}${sample ? '<p>Sample businesses: made up to show how the route works. Their addresses are not real.</p>' : ''}<p>Made ${S.esc(time.longDate(today))}. Distances are straight lines between stops; real roads run longer. Hours come from OpenStreetMap: check before you go.</p>`;
  return S.page({ title: `Walk-in route: ${where}`, eyebrow: `Walk-in route · ${service.label}`, h1: `${entries.length} stops near ${where}`, sub: 'In order, so you spend your time in doorways, not in traffic. Tick a box after each stop.', pills, body, footer });
}
