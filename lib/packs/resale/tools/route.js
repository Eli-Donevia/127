// A sourcing route from the places the member lists (thrift stores, estate and yard sales, pickups):
// put in a sensible order (estate sales first, pickups last), with a time at each stop, what to
// bring, what to look for there from their category, and Google Maps links in legs a phone can
// open. A printable route sheet with a box to tick at each stop. Nothing is looked up or geocoded:
// the member's own list is the route, and the map links show the real drive times.

const { views, files, save, time, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const { soldLink, query } = require('./first25');

const { usd, num } = money;
const { plain, clip } = text;
const esc = files.esc;

const MAX_STOPS = 12;
const DRIVE = 15; // minutes between stops, a guess the map links replace
const LEG = 3; // stops in between per Google Maps link (what phones open)

// "8", "8am", "8:30", "8:30 pm", "14:00" -> minutes after midnight.
function clock(s) {
  const m = String(s || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = (m[3] || '').replace(/\./g, '');
  if (h > 23 || min > 59) return null;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 6) h += 12; // "3" means 3pm on a sourcing day
  return h * 60 + min;
}
const showClock = (t) => {
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const OPENS = /\bopens?\s*(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i;

const mapSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
function mapLeg(points) {
  const [origin, ...rest] = points;
  const destination = rest.pop();
  const way = rest.length ? `&waypoints=${encodeURIComponent(rest.join('|'))}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${way}&travelmode=driving`;
}

const ROUTE_CSS = `${C.SHEET_CSS}
.stop{border:1px solid #e3e6eb;border-radius:12px;padding:14px 16px 12px 52px;margin:12px 0;position:relative}
.stop:before{content:"";position:absolute;left:16px;top:18px;width:18px;height:18px;border:2px solid #5b6475;border-radius:5px}
.stop h3{margin:0 0 2px;font-size:17px}.when{color:#b8460b;font-weight:700;font-size:14px}.stop p{margin:6px 0;line-height:1.45}
.stop ul{margin:4px 0;padding-left:18px}.legs a,.stop a{color:#2a5bd7}.rules{background:#fff8e6;border-radius:10px;padding:10px 16px;margin-top:14px}`;

function routeTool(N) {
  const R = N.route;
  const cats = Object.keys(N.categories);
  return {
    name: 'resale.plan_route',
    title: 'Plan a sourcing route',
    description: 'Your sourcing stops in a sensible order with a time at each, what to bring, what to look for there and Google Maps links, as a printable route sheet. From the places you list: nothing is looked up.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['stops'],
      properties: {
        stops: { type: 'string', format: 'textarea', maxLength: 3000, title: 'Places on your route, one per line', description: 'Name and address, and the opening time if you know it. Like "Estate sale, 55 Oak Ave, Columbus OH, opens 8am"' },
        start: { type: 'string', maxLength: 160, title: 'Where you start (optional)', description: 'Your street or neighborhood, for the map links' },
        day: { type: 'string', maxLength: 40, title: 'Day (optional)', description: 'Like "Saturday"' },
        time: { type: 'string', maxLength: 10, title: 'Start time', default: '8:00 am' },
        category: { type: 'string', enum: cats, default: cats[0], title: 'What you look for' },
        cash: { type: 'string', maxLength: 10, title: 'Cash you bring (optional)', description: 'Like "80"' },
      },
    },
    output: { type: 'object', required: ['stops', 'legs', 'file'], properties: { stops: { type: 'array' }, legs: { type: 'array' }, file: { type: 'object' } } },
    async run(input, ctx) {
      const lines = C.linesOf(input.stops, MAX_STOPS + 1);
      if (!lines.length) throw new Error('Add the places on your route, one per line: name and address.');
      const cat = cats.includes(input.category) ? input.category : cats[0];
      const pool = N.categories[cat].items;
      const parsed = lines.slice(0, MAX_STOPS).map((line, i) => {
        const clean = clip(plain(line), 200);
        const kind = R.kinds.find((k) => new RegExp(k.match, 'i').test(clean)) || R.other;
        const om = clean.match(OPENS);
        const opens = om ? clock(om[1]) : null;
        const where = clean.replace(/,?\s*opens?\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/i, '').trim();
        const [name, ...rest] = where.split(',').map((s) => s.trim());
        return { i, line: clean, where, name, address: rest.join(', '), kind, opens };
      });
      const ordered = [...parsed].sort((a, b) => a.kind.order - b.kind.order || (a.opens ?? 0) - (b.opens ?? 0) || a.i - b.i);
      let at = clock(input.time) ?? 8 * 60;
      const startAt = at;
      const stops = ordered.map((s, n) => {
        const arrive = s.opens != null && s.opens > at ? s.opens : at;
        const leave = arrive + s.kind.minutes;
        at = leave + DRIVE;
        const route = N.routes[s.kind.id];
        const look = pool.filter((it) => it.where === s.kind.id).slice(0, 4);
        const lookFor = (look.length ? look : s.kind.id === 'other' ? pool.slice(0, 3) : []).map((it) => ({ name: it.name, check: soldLink(query(it.name)), watch: it.watch }));
        return {
          n: n + 1,
          name: s.name,
          address: s.address,
          where: s.where,
          kind: route ? route.label : 'Other stop',
          arrive: showClock(arrive),
          leave: showClock(leave),
          minutes: s.kind.minutes,
          opens: s.opens != null ? showClock(s.opens) : '',
          bring: s.kind.bring,
          tip: s.kind.tip,
          look: lookFor,
          map: mapSearch(s.where),
        };
      });
      const start = clip(plain(input.start || ''), 160);
      const points = [start, ...stops.map((s) => s.where)].filter(Boolean);
      const legs = [];
      for (let k = 0; k < points.length - 1; k += LEG + 1) {
        const chunk = points.slice(k, k + LEG + 2);
        if (chunk.length >= 2) legs.push({ n: legs.length + 1, from: chunk[0], to: chunk[chunk.length - 1], stops: chunk.length - 2, link: mapLeg(chunk) });
      }
      const day = clip(plain(input.day || ''), 40);
      const cash = num(input.cash, null);
      const end = at - DRIVE;
      const hours = Math.round(((end - startAt) / 60) * 2) / 2;
      const title = `Sourcing route${day ? `: ${day}` : ''}`;
      const rules = [
        'Check sold prices on your phone before anything goes in the cart, and pay no more than your "pay at most" price.',
        cash ? `Bring ${usd(cash)} in small bills, and stop when it's spent.` : 'Bring small bills, and decide your spending limit before the first stop.',
        ...N.rules.slice(0, 3),
      ];
      const today = time.today(ctx);
      const body = `<main>
<p class="muted">${esc(N.categories[cat].label)} &middot; ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} &middot; about ${hours} ${hours === 1 ? 'hour' : 'hours'}</p>
<h1>${esc(title)}</h1>
<p>Start ${esc(showClock(startAt))}${start ? ` from ${esc(start)}` : ''}. Times allow ${DRIVE} minutes of driving between stops: the map links show the real times.</p>
<div class="legs"><strong>Maps:</strong> ${legs.map((l) => `<a href="${esc(l.link)}">Leg ${l.n}: ${esc(clip(l.from, 40))} to ${esc(clip(l.to, 40))}</a>`).join(' &middot; ')}</div>
${stops
  .map(
    (s) => `<div class="stop"><span class="when">${esc(s.arrive)} to ${esc(s.leave)}${s.opens ? ` (opens ${esc(s.opens)})` : ''}</span>
<h3>${s.n}. ${esc(s.name)}</h3>
<p class="muted">${esc(s.kind)}${s.address ? ` &middot; ${esc(s.address)}` : ''} &middot; <a href="${esc(s.map)}">Map</a></p>
<p><strong>Bring:</strong> ${esc(s.bring)} <strong>Tip:</strong> ${esc(s.tip)}</p>
${s.look.length ? `<p><strong>Look for:</strong></p><ul>${s.look.map((it) => `<li>${esc(it.name)} (<a href="${esc(it.check)}">sold prices</a>)${it.watch ? `: ${esc(it.watch)}` : ''}</li>`).join('')}</ul>` : ''}</div>`,
  )
  .join('\n')}
<div class="rules"><strong>Before you buy</strong>${C.li(rules)}</div>
<footer>${esc(R.maps_note)} Tick each stop as you go.</footer>
</main>`;
      const html = files.htmlDoc({ title, css: ROUTE_CSS, body, description: `${title}: ${stops.length} stops` });
      const file = await save.saveFile(ctx, save.fileName('resale', 'sourcing route', day || '', today, '.html'), html);
      const skipped = lines.length > MAX_STOPS ? `Only the first ${MAX_STOPS} places fit one route: plan the rest as a second day.` : '';
      return { title, day, start: showClock(startAt), end: showClock(end), hours, stops, legs, file, rules, skipped, category: N.categories[cat].label };
    },
    view(out) {
      return views.blocks(
        views.metric(out.title, `${out.stops.length} ${out.stops.length === 1 ? 'stop' : 'stops'}`, `${out.start} to about ${out.end}, looking for ${out.category.toLowerCase()}.`),
        out.skipped ? views.text(out.skipped) : null,
        views.table(
          [
            { key: 'arrive', label: 'Time' },
            { key: 'name', label: 'Stop' },
            { key: 'kind', label: 'Kind' },
            { key: 'bring', label: 'Bring' },
            { key: 'map', label: 'Map', format: 'link' },
          ],
          out.stops,
        ),
        out.legs.map((l) => views.link(`Maps, leg ${l.n}: ${l.from} to ${l.to}${l.stops ? ` with ${l.stops} ${l.stops === 1 ? 'stop' : 'stops'} between` : ''}`, l.link)),
        views.text(`Before you buy: ${out.rules.slice(0, 2).join(' ')}`),
        views.file(out.file, 'Route sheet (print it or open it on your phone)'),
      );
    },
  };
}

module.exports = { routeTool, clock, showClock, mapLeg };
