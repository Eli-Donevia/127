// Pick a niche: compares 3 to 5 business types for the member's city from 127's crowd scores
// (data/niches.json, copied from research/crowd.json: our judgment, and the page says so), how this
// month sits in each one's season, and live counts of buyers, partners or places to source from
// within 10 km on OpenStreetMap (one Overpass request with a count per niche, D27 credit). Counts
// are a floor: OpenStreetMap doesn't list every business. Offline, held or in a sample run the counts
// say "not counted" and the ranking uses the scores alone (D5: unknown, never a guess).

const { text, time, places, views, save, crowd } = require('../../_kit');
const NICHES = require('../data/niches.json');
const S = require('../lib/sheets');

const RADIUS_KM = 10;
const FIRST = { Fast: 2, 'Fast in season': 2, Medium: 0, Slow: -2 };
const ROLE = { buyers: 'businesses that could buy', partners: 'possible referral partners', families: 'schools nearby', sources: 'places to source from' };
const norm = (s) => ` ${String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

// "web design, lawn care or pet sitting" -> { ids: ['webdesign', 'lawn', 'petcare'], unknown: [] }
function matchNiches(raw) {
  const ids = [];
  const unknown = [];
  const one = (phrase) => {
    const p = norm(phrase);
    if (p.trim().length < 2) return null;
    let best = null;
    for (const [id, n] of Object.entries(NICHES.niches)) {
      for (const a of [id, n.label, n.sells, ...(n.aliases || [])]) {
        const w = norm(a);
        const hit = p === w ? 3 : p.includes(w) ? 2 : w.includes(p) && p.trim().length >= 4 ? 1 : 0;
        if (hit && (!best || hit > best.hit || (hit === best.hit && w.length > best.len))) best = { id, hit, len: w.length };
      }
    }
    return best ? best.id : null;
  };
  for (const part of String(raw || '').split(/[,;\n/]+|\s+(?:or|vs\.?|versus)\s+/i)) {
    const phrase = part.trim();
    if (!phrase) continue;
    let id = one(phrase);
    if (!id && /\s+and\s+/i.test(phrase)) {
      for (const bit of phrase.split(/\s+and\s+/i)) {
        const b = one(bit);
        if (b && !ids.includes(b)) ids.push(b);
        else if (!b && bit.trim()) unknown.push(text.clip(bit.trim(), 40));
      }
      continue;
    }
    if (id && !ids.includes(id)) ids.push(id);
    else if (!id) unknown.push(text.clip(phrase, 40));
  }
  return { ids: ids.slice(0, 5), unknown, extra: Math.max(0, ids.length - 5) };
}

// Points: the four scores (4 to 20), how fast a first $1 comes, the season now, and what's nearby.
function pointsOf(n, { month, lat, fast, count }) {
  const c = n.crowd;
  const s = c.scores;
  const total = s.pain + s.can_pay + s.findable + s.growing;
  const sea = crowd.season(c, { month, lat });
  let first = FIRST[c.first_dollar] || 0;
  if (c.first_dollar === 'Fast in season' && sea.slow) first = -1;
  if (fast) first *= 2;
  let seasonPts = sea.slow ? (sea.sure ? -3 : -1) : 0;
  // The slow season starts next month: worth knowing before buying gear or printing flyers.
  const nextSea = crowd.season(c, { month: (month % 12) + 1, lat });
  const ending = !sea.slow && nextSea.slow;
  if (ending) seasonPts = nextSea.sure ? -2 : -1;
  let near = 0;
  const role = n.count && n.count.role;
  if (Number.isFinite(count)) {
    if (role === 'buyers') near = count >= 150 ? 2 : count >= 40 ? 1 : count >= 10 ? 0 : count >= 1 ? -1 : -2;
    else near = count >= 40 ? 1 : count >= 5 ? 0 : -1;
  }
  const parts = [`Scores ${total} of 20`, `First $1 ${String(c.first_dollar).toLowerCase()} ${first >= 0 ? '+' : ''}${first}`];
  if (seasonPts) parts.push(`${ending ? `Slow season from ${crowd.MONTHS[month % 12]}` : 'Slow season'} ${seasonPts}`);
  if (Number.isFinite(count) && near) parts.push(`Nearby ${near > 0 ? '+' : ''}${near}`);
  return { total, first, season: sea, ending, nextSeason: nextSea, seasonPts, near, points: total + first + seasonPts + near, parts };
}

const filterOf = (tag) =>
  String(tag)
    .split('][')
    .map((kv) => {
      const [k, v] = kv.replace(/^\[|\]$/g, '').split('=');
      return `["${k.replace(/"/g, '')}"="${String(v || '').replace(/"/g, '')}"]`;
    })
    .join('');

function tagsOf(n) {
  const c = n.count || {};
  const tags = [...(c.tags || [])];
  for (const id of c.categories || []) for (const t of (places.CATEGORIES[id] && places.CATEGORIES[id].osm) || []) if (!tags.includes(t)) tags.push(t);
  return tags;
}

// One Overpass request: a named count for each niche, in order.
function countQuery(list, center) {
  const around = `(around:${RADIUS_KM * 1000},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`;
  const sets = list.map((tags, i) => `(${tags.map((t) => `nwr${filterOf(t)}["name"]${around};`).join('')})->.s${i};.s${i} out count;`);
  return `[out:json][timeout:25];${sets.join('')}`;
}

async function counts(ctx, ids, city) {
  const want = ids.filter((id) => NICHES.niches[id].count);
  if (ctx.sample) return { why: 'Not counted in a sample run. A live run counts each one on OpenStreetMap.', byId: {} };
  if (!want.length) return { why: '', byId: {} };
  if (places.osmServer(ctx).held) return { why: "Not counted: the live map search isn't switched on yet, so the ranking uses our scores alone.", byId: {} };
  const center = await places.geocode(ctx, city);
  if (!center) return { why: `Not counted: the map search didn't answer for ${places.cityShort(city)}, so the ranking uses our scores alone.`, byId: {} };
  try {
    const els = await places.overpass(ctx, countQuery(want.map((id) => tagsOf(NICHES.niches[id])), center), { timeoutMs: 30000, maxBytes: 200000 });
    const nums = els.filter((e) => e && e.type === 'count').map((e) => Number((e.tags || {}).total));
    const byId = {};
    want.forEach((id, i) => {
      if (Number.isFinite(nums[i])) byId[id] = nums[i];
    });
    return { why: '', byId, center, counted: Object.keys(byId).length > 0 };
  } catch (e) {
    if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    return { why: "OpenStreetMap didn't answer, so nothing was counted. The ranking uses our scores alone. Try again in a few minutes.", byId: {}, center };
  }
}

module.exports = {
  name: 'leads.pick_niche',
  title: 'Compare niches',
  description: "Compares 3 to 5 business types for your city: 127's scores for pain, can pay, easy to find and growing, how long a first sale usually takes, whether this is their slow season, and how many of them (or partners) OpenStreetMap lists within 10 km.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['osm'],
  credits: 3,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      city: { type: 'string', title: 'Your city', description: 'For example "Des Moines, IA"' },
      niches: { type: 'string', title: 'Which ones are you choosing between? (optional)', maxLength: 300, description: 'Up to 5, like "web design, lawn care, pet sitting". Empty: the 5 that fit this month best' },
      fast: { type: 'boolean', title: 'I need a first sale this month', default: false },
    },
    required: ['city'],
  },
  output: {
    type: 'object',
    properties: { best: { type: 'object' }, picks: { type: 'array' }, counted: { type: 'boolean' }, page: { type: 'object' }, notes: { type: 'array' }, month: { type: 'string' } },
    required: ['best', 'picks', 'counted', 'page', 'notes'],
  },
  async run(input, ctx) {
    const city = text.clip(text.oneLine(input.city || ''), 80);
    if (!city) throw new Error('Add your city first.');
    const { m } = time.partsIn(ctx.now(), time.tzOf(ctx));
    const month = crowd.MONTHS[m - 1];
    const notes = [];
    const asked = matchNiches(input.niches);
    if (asked.unknown.length) notes.push(`No scores yet for ${text.list(asked.unknown.map((u) => `"${u}"`))}, so ${asked.unknown.length > 1 ? "they're" : "it's"} left out. We score the ${Object.keys(NICHES.niches).length} business types 127 has packs for.`);
    if (asked.extra) notes.push(`Compared the first 5. Run it again for the rest.`);
    let ids = asked.ids;
    const chosen = ids.length > 0;
    if (ids.length === 1) notes.push('Only one matched, so the next best 2 for this month are added to compare it with.');
    if (ids.length < 3) {
      // Fill with the best for this month (scores, first $1 and season), so there's always a comparison.
      const rest = Object.keys(NICHES.niches)
        .filter((id) => !ids.includes(id))
        .map((id) => ({ id, p: pointsOf(NICHES.niches[id], { month: m, fast: input.fast }).points }))
        .sort((a, b) => b.p - a.p);
      ids = ids.concat(rest.slice(0, (chosen ? 3 : 5) - ids.length).map((x) => x.id));
    }
    const got = await counts(ctx, ids, city);
    if (got.why) notes.push(got.why);
    const lat = got.center ? got.center.lat : null;
    const picks = ids
      .map((id) => {
        const n = NICHES.niches[id];
        const count = Number.isFinite(got.byId[id]) ? got.byId[id] : null;
        const p = pointsOf(n, { month: m, lat, fast: input.fast, count });
        return {
          id,
          label: n.label,
          kind: n.kind,
          buyer: n.crowd.buyer,
          scores: n.crowd.scores,
          total: p.total,
          first_dollar: n.crowd.first_dollar,
          season: p.ending ? `${p.season.note || ''} ${p.nextSeason.note}`.trim() : p.season.note || (p.season.best === 'All year' ? 'Sells all year.' : `Best months: ${p.season.best}.`),
          slow: p.season.slow,
          ending: p.ending,
          best_months: p.season.best,
          count,
          countWhat: n.count ? n.count.what : null,
          countRole: n.count ? n.count.role : null,
          online: n.kind === 'online' && !(n.count && n.count.role === 'sources'),
          points: p.points,
          parts: p.parts,
          note: n.crowd.note,
          not_yet: n.crowd.not_yet,
          next: `Open "${n.pack}" and run Your first 25.`,
        };
      })
      .sort((a, b) => b.points - a.points || b.total - a.total || b.scores.pain + b.scores.can_pay - (a.scores.pain + a.scores.can_pay) || b.scores.findable - a.scores.findable || a.label.localeCompare(b.label));
    picks.forEach((p, i) => (p.rank = i + 1));
    const best = picks[0];
    const counted = !!got.counted;
    const credit = counted ? [{ source: 'osm', ...(got.center && got.center.searchBy ? { searchBy: got.center.searchBy } : {}) }] : [];
    const html = pageHtml({ picks, city, month, year: time.partsIn(ctx.now(), time.tzOf(ctx)).y, counted, notes, credit, fast: !!input.fast });
    const page = await save.saveFile(ctx, `${save.fileName('pick a niche', places.cityShort(city))}.html`, html);
    ctx.log(`Compared ${picks.length} niches for ${places.cityShort(city)}${counted ? ' with OpenStreetMap counts' : ''}`);
    return { city, month, best: { id: best.id, label: best.label, points: best.points, why: whyOf(best, picks[1], counted) }, picks, counted, radiusKm: RADIUS_KM, notes, credit, page, sample: !!ctx.sample };
  },
  view(out) {
    const near = (p) => (p.online ? 'Online' : Number.isFinite(p.count) ? `${p.count} ${ROLE[p.countRole] || 'nearby'}` : 'Not counted');
    return views.blocks(
      views.metric('Start with', out.best.label, out.best.why),
      views.table(
        [{ key: 'rank', label: '#', format: 'number' }, { key: 'label', label: 'Niche' }, { key: 'total', label: 'Scores (of 20)', format: 'number' }, { key: 'first', label: 'First $1' }, { key: 'month', label: `In ${out.month}` }, { key: 'near', label: 'Within 10 km' }, { key: 'points', label: 'Points', format: 'number' }],
        out.picks.map((p) => ({ rank: p.rank, label: p.label, total: p.total, first: p.first_dollar, month: p.slow ? 'Slow season' : p.ending ? 'Good, slows next month' : 'Good', near: near(p), points: p.points })),
      ),
      views.file(out.page, 'The full comparison (with what not to do yet for each)'),
      views.text(`Next: ${out.picks[0].next}`),
      (out.notes || []).map((n) => views.text(n)),
      views.text('Scores from 1 to 5 are our judgment before real member data. Counts are what OpenStreetMap lists, so the real number is usually higher.'),
      places.creditBlocks(out.credit || [])
    );
  },
};

function whyOf(best, second, counted) {
  const bits = [`Scores ${best.total} of 20`, `first $1 ${String(best.first_dollar).toLowerCase()}`];
  bits.push(best.slow ? 'slow season now' : best.ending ? 'good now, slower from next month' : 'a good month for it');
  if (counted && Number.isFinite(best.count)) bits.push(`${best.count} ${ROLE[best.countRole] || 'nearby'} within ${RADIUS_KM} km`);
  const lead = second && best.points > second.points ? `, ${best.points - second.points} ahead of ${second.label}` : second ? `, tied with ${second.label}` : '';
  return `${bits.join(', ')}${lead}.`;
}

function scoreBars(s) {
  const row = (k, label) => `<div>${S.esc(label)} <b>${s[k]}</b>/5<div class="bar"><i style="width:${s[k] * 20}%"></i></div></div>`;
  return `<div class="score">${row('pain', 'Pain')}${row('can_pay', 'Can pay')}${row('findable', 'Easy to find')}${row('growing', 'Growing')}</div>`;
}

function pageHtml({ picks, city, month, year, counted, notes, credit, fast }) {
  const best = picks[0];
  const near = (p) => (p.online ? 'Online: not tied to your city' : Number.isFinite(p.count) ? `${p.count} ${S.esc(p.countWhat)}` : 'Not counted');
  const table = `<table class="t"><tr><th>#</th><th>Niche</th><th>Scores</th><th>First $1</th><th>${S.esc(month)}</th><th>Within ${RADIUS_KM} km</th><th>Points</th></tr>${picks
    .map((p) => `<tr${p.rank === 1 ? ' class="win"' : ''}><td>${p.rank}</td><td><strong>${S.esc(p.label)}</strong><div class="small muted">${S.esc(p.buyer)}</div></td><td>${p.total} of 20</td><td>${S.esc(p.first_dollar)}</td><td>${p.slow ? 'Slow season' : p.ending ? 'Good, slows next month' : 'Good'}</td><td>${p.online ? 'Online' : Number.isFinite(p.count) ? p.count : 'Not counted'}</td><td><strong>${p.points}</strong></td></tr>`)
    .join('')}</table>`;
  const cards = picks
    .map(
      (p) => `<div class="card${p.rank === 1 ? ' win' : ''}">${p.rank === 1 ? '<span class="ribbon">Start here</span>' : ''}<div class="top"><span class="n">${p.rank}</span><div class="grow"><h3>${S.esc(p.label)}</h3><p class="small muted" style="margin-top:3px">Who buys: ${S.esc(p.buyer)}. ${S.esc(p.parts.join(' · '))} = ${p.points} points</p>${scoreBars(p.scores)}
<p style="margin-top:10px"><strong>This month:</strong> ${S.esc(p.season)}</p><p style="margin-top:4px"><strong>Near you:</strong> ${near(p)}${!p.online && Number.isFinite(p.count) && p.countRole !== 'buyers' ? ` (${S.esc(ROLE[p.countRole] || '')})` : ''}.</p><p style="margin-top:4px"><strong>Good to know:</strong> ${S.esc(p.note)}</p>
<p style="margin-top:8px"><strong>Not yet:</strong></p><ul class="plain">${p.not_yet.map((x) => `<li>${S.esc(x)}</li>`).join('')}</ul><p style="margin-top:8px"><strong>Next:</strong> ${S.esc(p.next)}</p></div></div></div>`
    )
    .join('');
  const how = `<div class="card"><h3>How the points add up</h3><ul class="plain"><li>Our scores for pain, can pay, easy to find and growing, 1 to 5 each (out of 20). They are 127's judgment before real member data, not a promise of results.</li><li>How long a first sale usually takes in this niche: fast +2, medium 0, slow -2${fast ? ', doubled because you need a first sale this month' : ''}.</li><li>This month: -3 in a slow season where you are, -2 when it starts next month (-1 when we can't tell your climate).</li><li>Near you: up to +2 for plenty of these businesses within ${RADIUS_KM} km, down to -2 for none, from what OpenStreetMap lists. Partner and source counts move the points by 1 at most.</li></ul></div>`;
  const body = `<h2>Side by side</h2>${table}${notes.length ? `<div class="card" style="margin-top:12px">${notes.map((n) => `<p class="small">${S.esc(n)}</p>`).join('')}</div>` : ''}<h2>Each one</h2>${cards}<h2>How we ranked them</h2>${how}`;
  const footer = `${places.creditHtml(credit)}<p>${counted ? `Counts: businesses with a name on OpenStreetMap within ${RADIUS_KM} km of the middle of ${S.esc(places.cityShort(city))}. OpenStreetMap doesn't list every business, so the real numbers are usually higher.` : 'No counts this time: the ranking uses our scores and the season alone.'}</p>`;
  return S.page({ title: `Pick a niche: ${places.cityShort(city)}`, eyebrow: `Pick a niche · ${places.cityShort(city)} · ${month} ${year}`, h1: `Start with: ${best.label}`, sub: `${picks.length} business types compared for ${city}: pain, whether they pay, how easy they are to find, how long a sale usually takes, the season and what's near you.`, pills: picks.map((p) => `${p.rank}. ${p.label} (${p.points})`), body, footer });
}

module.exports.matchNiches = matchNiches;
module.exports.pointsOf = pointsOf;
module.exports.countQuery = countQuery;
