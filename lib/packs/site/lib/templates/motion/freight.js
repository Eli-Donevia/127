// Freight (animated, local-service): for trucking companies and carriers, dark and light.
//   Object:   the rig and the road. The hero is a photograph-sized scene, full bleed: a tractor-trailer on the highway
//             at first light, backlit, its marker lights on (art: the trailer the carrier pulls, dry van, reefer,
//             flatbed, tanker or box truck; a loading dock for anything else). A rendered photo replaces it when one
//             ships with the pack (art.photo). The yard slot is the dock at dusk with the carrier's trailers backed in.
//   Material: road and paperwork: night asphalt (dark) or dock concrete in daylight (light), the highway-sign face
//             (Overpass, from the Highway Gothic signs), mono numbers for authority, a bill of lading for the quote.
//   One move: the name is lettered on like a cab door (choreo intro 'stamp', fast), the photo lands with a flash of
//             contrast, then slowly pushes in while the dawn comes up behind the truck.
//   Pop:      the member's colour is the marker lights and the lanes drawn on the map, nothing else.
// The one scroll moment is the lanes map: the carrier's own lanes ("Joplin, MO to Dallas, TX") draw across the map one
// after another as you scroll, each city coming up as its lane reaches it. Authority (USDOT and MC numbers, with the
// FMCSA lookup), fleet size, lanes and hiring come only from what the carrier wrote; any of them missing, its part is
// left out. JavaScript off and reduced motion: every lane drawn, the photo still.

const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const Art = require('../../art');
const { esc } = require('../shared');
const { color } = require('../../../../_kit');
const { lenisScript, LENIS_CSS } = require('../../../vendor/lenis/lenis');

const id = 'freight';

function tokens(p, mode) {
  return mode === 'light' ? { bg: '#e9eaeb', dark: '#111316' } : { bg: '#0d0f12', dark: '#060709' };
}

// ---- facts, read for a carrier -----------------------------------------------------------------------------------
const lines = (c) => [...(c.included || []), ...String(c.about || '').split(/(?<=[.!?])\s+/)];
function authority(c) {
  const all = lines(c).join(' \n ');
  const dot = (all.match(/\b(?:US\s?DOT|DOT)\s*(?:#|no\.?|number)?\s*:?\s*(\d{5,8})\b/i) || [])[1] || '';
  const mc = (all.match(/\b(?:MC|ICC)\s*(?:#|no\.?|number)?\s*:?\s*-?\s*(\d{4,8})\b/i) || [])[1] || '';
  return { dot, mc };
}
const LANE_RE = /^\s*([A-Za-z][A-Za-z .'-]+?),\s*([A-Z]{2})\s*(?:to|-|–|>|→|and)\s*([A-Za-z][A-Za-z .'-]+?),\s*([A-Z]{2})\b/;
function lanesOf(c) {
  return (c.included || []).map((t) => t.match(LANE_RE)).filter(Boolean).map((m) => ({ a: [m[1].trim(), m[2]], b: [m[3].trim(), m[4]] }));
}
function fleetOf(c) {
  const out = [];
  const re = /\b(\d{1,4})\s+(trucks|tractors|power units|trailers|reefers|flatbeds|tankers|box trucks|drivers)\b/gi;
  for (const t of lines(c)) for (const m of t.matchAll(re)) if (!out.some((x) => x.what === m[2].toLowerCase())) out.push({ n: m[1], what: m[2].toLowerCase() });
  return out.slice(0, 3);
}
const HIRE_RE = /\b(hiring|now hiring|drivers wanted|driver (jobs|positions)|cdl[- ]?a drivers?)\b/i;
const hiringOf = (c) => (c.included || []).find((t) => HIRE_RE.test(t)) || '';
// The lines shown under "With every load": what's left once authority, lanes and hiring have their own places.
const usedLine = (t) => LANE_RE.test(t) || HIRE_RE.test(t) || /^\s*(US\s?DOT|DOT|MC|ICC)\b[\s#:.-]*\d/i.test(t);

// What the carrier pulls, for the drawings: from its words, the first named wins.
function rigOf(c) {
  const s = `${c.what || ''} ${c.niche || ''} ${(c.services || []).map((x) => `${x.name} ${x.description || ''}`).join(' ')}`.toLowerCase();
  const trucking = (c.profile && c.profile.id === 'trucking') || /\b(truck\w*|freight|carrier|logistics|cdl|haul\w*|dispatch|ltl|ftl|drayage)\b/.test(s);
  if (!trucking) return '';
  const hits = [['reefer', /\b(reefer|refrigerat\w*|temperature|cold chain)\b/], ['flatbed', /\b(flatbed|step ?deck|lowboy|hotshot|conestoga)\b/], ['tanker', /\b(tank(er)?s?|bulk liquid)\b/], ['box', /\b(box trucks?|straight trucks?|final mile)\b/], ['van', /\b(dry van|van|truckload|ftl|ltl)\b/]]
    .map(([k, re]) => [k, s.search(re)]).filter(([, i]) => i >= 0).sort((x, y) => x[1] - y[1]);
  return hits.length ? hits[0][0] : 'van';
}
const rigOfService = (s) => rigOf({ what: 'trucking', services: [s] });

// ---- the map -------------------------------------------------------------------------------------------------------
// Freight towns (lat, lon), then each state's middle for anywhere else.
const CITY = {
  'joplin|mo': [37.08, -94.51], 'springfield|mo': [37.21, -93.29], 'kansas city|mo': [39.1, -94.58], 'kansas city|ks': [39.11, -94.63], 'st. louis|mo': [38.63, -90.2], 'saint louis|mo': [38.63, -90.2], 'st louis|mo': [38.63, -90.2], 'columbia|mo': [38.95, -92.33],
  'dallas|tx': [32.78, -96.8], 'fort worth|tx': [32.75, -97.33], 'houston|tx': [29.76, -95.37], 'san antonio|tx': [29.42, -98.49], 'austin|tx': [30.27, -97.74], 'el paso|tx': [31.76, -106.49], 'laredo|tx': [27.53, -99.49], 'amarillo|tx': [35.22, -101.83], 'lubbock|tx': [33.58, -101.86], 'waco|tx': [31.55, -97.15], 'corpus christi|tx': [27.8, -97.4],
  'oklahoma city|ok': [35.47, -97.52], 'tulsa|ok': [36.15, -95.99], 'little rock|ar': [34.75, -92.29], 'fort smith|ar': [35.39, -94.4], 'fayetteville|ar': [36.06, -94.16], 'memphis|tn': [35.15, -90.05], 'nashville|tn': [36.16, -86.78], 'knoxville|tn': [35.96, -83.92], 'chattanooga|tn': [35.05, -85.31],
  'atlanta|ga': [33.75, -84.39], 'savannah|ga': [32.08, -81.09], 'macon|ga': [32.84, -83.63], 'birmingham|al': [33.52, -86.8], 'montgomery|al': [32.37, -86.3], 'mobile|al': [30.69, -88.04], 'jackson|ms': [32.3, -90.18], 'new orleans|la': [29.95, -90.07], 'baton rouge|la': [30.45, -91.15], 'shreveport|la': [32.53, -93.75], 'lafayette|la': [30.22, -92.02],
  'jacksonville|fl': [30.33, -81.66], 'orlando|fl': [28.54, -81.38], 'tampa|fl': [27.95, -82.46], 'miami|fl': [25.76, -80.19], 'pensacola|fl': [30.42, -87.22], 'charlotte|nc': [35.23, -80.84], 'raleigh|nc': [35.78, -78.64], 'greensboro|nc': [36.07, -79.79], 'columbia|sc': [34.0, -81.03], 'charleston|sc': [32.78, -79.93], 'greenville|sc': [34.85, -82.4],
  'richmond|va': [37.54, -77.44], 'norfolk|va': [36.85, -76.29], 'roanoke|va': [37.27, -79.94], 'washington|dc': [38.91, -77.04], 'baltimore|md': [39.29, -76.61], 'philadelphia|pa': [39.95, -75.17], 'pittsburgh|pa': [40.44, -80.0], 'harrisburg|pa': [40.27, -76.88], 'allentown|pa': [40.6, -75.49], 'newark|nj': [40.74, -74.17], 'new york|ny': [40.71, -74.01], 'albany|ny': [42.65, -73.75], 'buffalo|ny': [42.89, -78.88], 'boston|ma': [42.36, -71.06], 'hartford|ct': [41.76, -72.67],
  'chicago|il': [41.88, -87.63], 'peoria|il': [40.69, -89.59], 'indianapolis|in': [39.77, -86.16], 'fort wayne|in': [41.08, -85.14], 'evansville|in': [37.97, -87.57], 'columbus|oh': [39.96, -83.0], 'cincinnati|oh': [39.1, -84.51], 'cleveland|oh': [41.5, -81.69], 'toledo|oh': [41.65, -83.54], 'detroit|mi': [42.33, -83.05], 'grand rapids|mi': [42.96, -85.67], 'louisville|ky': [38.25, -85.76], 'lexington|ky': [38.04, -84.5],
  'milwaukee|wi': [43.04, -87.91], 'green bay|wi': [44.51, -88.01], 'minneapolis|mn': [44.98, -93.27], 'st. paul|mn': [44.95, -93.09], 'des moines|ia': [41.59, -93.62], 'omaha|ne': [41.26, -95.94], 'lincoln|ne': [40.81, -96.7], 'wichita|ks': [37.69, -97.34], 'topeka|ks': [39.05, -95.68], 'fargo|nd': [46.88, -96.79], 'sioux falls|sd': [43.55, -96.73],
  'denver|co': [39.74, -104.99], 'cheyenne|wy': [41.14, -104.82], 'billings|mt': [45.78, -108.5], 'salt lake city|ut': [40.76, -111.89], 'boise|id': [43.62, -116.21], 'phoenix|az': [33.45, -112.07], 'tucson|az': [32.22, -110.97], 'albuquerque|nm': [35.08, -106.65], 'las vegas|nv': [36.17, -115.14], 'reno|nv': [39.53, -119.81],
  'los angeles|ca': [34.05, -118.24], 'ontario|ca': [34.06, -117.65], 'san diego|ca': [32.72, -117.16], 'fresno|ca': [36.74, -119.79], 'sacramento|ca': [38.58, -121.49], 'oakland|ca': [37.8, -122.27], 'san francisco|ca': [37.77, -122.42], 'stockton|ca': [37.96, -121.29], 'portland|or': [45.52, -122.68], 'seattle|wa': [47.61, -122.33], 'tacoma|wa': [47.25, -122.44], 'spokane|wa': [47.66, -117.43],
};
const STATE = {
  al: [32.8, -86.8], az: [34.2, -111.7], ar: [34.9, -92.4], ca: [37.2, -119.5], co: [39.0, -105.5], ct: [41.6, -72.7], de: [39.0, -75.5], dc: [38.9, -77.0], fl: [28.6, -82.4], ga: [32.7, -83.4], id: [44.4, -114.6], il: [40.0, -89.2], in: [39.9, -86.3], ia: [42.1, -93.5], ks: [38.5, -98.4], ky: [37.5, -85.3], la: [31.1, -92.0], me: [45.4, -69.2], md: [39.0, -76.8], ma: [42.3, -71.8], mi: [43.8, -84.6], mn: [46.3, -94.3], ms: [32.7, -89.7], mo: [38.4, -92.5], mt: [47.0, -109.6], ne: [41.5, -99.8], nv: [39.3, -116.6], nh: [43.7, -71.6], nj: [40.2, -74.7], nm: [34.4, -106.1], ny: [42.9, -75.5], nc: [35.6, -79.4], nd: [47.5, -100.5], oh: [40.3, -82.8], ok: [35.6, -97.5], or: [43.9, -120.6], pa: [40.9, -77.8], ri: [41.7, -71.5], sc: [33.9, -80.9], sd: [44.4, -100.2], tn: [35.9, -86.4], tx: [31.5, -99.3], ut: [39.3, -111.7], vt: [44.1, -72.7], va: [37.5, -78.9], wa: [47.4, -120.5], wv: [38.6, -80.6], wi: [44.6, -89.9], wy: [43.0, -107.6],
};
const where = ([city, st]) => CITY[`${city.toLowerCase()}|${st.toLowerCase()}`] || STATE[st.toLowerCase()] || null;
// The lower 48, coarsely (lon, lat), the border run through the lakes.
const US = [[-124.7, 48.4], [-124, 46.3], [-124.1, 43], [-124.2, 41.9], [-123.8, 39.8], [-122.5, 37.8], [-121.9, 36.6], [-120.6, 34.6], [-118.5, 34], [-117.1, 32.5], [-114.7, 32.7], [-111.1, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.9, 30.6], [-103.3, 29], [-102.4, 29.8], [-101.4, 29.8], [-99.5, 27.5], [-97.4, 25.9], [-97.4, 27.8], [-96, 28.6], [-94.7, 29.4], [-93.8, 29.7], [-92, 29.6], [-90.2, 29.1], [-89.4, 29], [-89.6, 30.2], [-88, 30.4], [-86.5, 30.4], [-85.3, 29.7], [-84, 30], [-83, 29], [-82.6, 27.5], [-81.8, 26.1], [-80.9, 25.1], [-80.1, 25.8], [-80, 27], [-80.6, 28.6], [-81.4, 30.7], [-81.1, 32.1], [-79.2, 33.2], [-77.9, 33.9], [-75.5, 35.2], [-75.9, 36.9], [-75.4, 38.4], [-74.9, 38.9], [-74, 40.5], [-71.9, 41.3], [-70.6, 41.6], [-70, 41.8], [-70.8, 42.9], [-70.2, 43.7], [-68.9, 44.4], [-67, 44.8], [-67.8, 47.1], [-69.2, 47.4], [-70.9, 45.3], [-74.7, 45], [-76.4, 44.2], [-79.2, 43.3], [-79, 42.8], [-82.5, 41.7], [-83.1, 42.3], [-82.4, 43], [-82.5, 45.3], [-84.4, 46.5], [-89.6, 48], [-95.2, 49], [-123.3, 49], [-124.7, 48.4]];
const COS = Math.cos((38 * Math.PI) / 180);
const proj = ([lat, lon]) => [(lon + 125) * COS * 20, (50 - lat) * 20];

function mapOf(c) {
  const lanes = lanesOf(c).map((l) => ({ ...l, pa: where(l.a), pb: where(l.b) })).filter((l) => l.pa && l.pb).slice(0, 6);
  if (!lanes.length) return null;
  const pts = lanes.flatMap((l) => [proj(l.pa), proj(l.pb)]);
  let [x0, y0, x1, y1] = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  // Pad, and keep the frame between 1.25:1 and 1.7:1 so the lanes fill it on a phone and a desktop.
  let w = Math.max(x1 - x0, 160), h = Math.max(y1 - y0, 100);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  w *= 1.34; h *= 1.5;
  if (w / h < 1.25) w = h * 1.25;
  if (w / h > 1.7) h = w / 1.7;
  [x0, y0] = [cx - w / 2, cy - h / 2];
  const r1 = (v) => Math.round(v * 10) / 10;
  const vb = [r1(x0), r1(y0), r1(w), r1(h)];
  const home = c.city ? String(c.city).split(',')[0].trim().toLowerCase() : '';
  const cities = [];
  const addCity = (name, p, i) => { const k = `${name[0]}|${name[1]}`; let x = cities.find((q) => q.k === k); if (!x) { const [px, py] = proj(p); x = { k, name: `${name[0]}, ${name[1]}`, x: px, y: py, i, home: name[0].toLowerCase() === home }; cities.push(x); } x.i = Math.min(x.i, i); return x; };
  const routes = lanes.map((l, i) => {
    const A = addCity(l.a, l.pa, i - 0.01), B = addCity(l.b, l.pb, i + 0.9);
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
    // Bow each lane a little to the north, the way a long haul reads on a map.
    const k = 0.16 * d * (dx >= 0 ? -1 : 1);
    const qx = (A.x + B.x) / 2 + (dy / d) * k, qy = (A.y + B.y) / 2 - (dx / d) * k;
    return { i, d: `M${r1(A.x)} ${r1(A.y)}Q${r1(qx)} ${r1(qy)} ${r1(B.x)} ${r1(B.y)}`, A, B, label: `${l.a[0]}, ${l.a[1]} to ${l.b[0]}, ${l.b[1]}` };
  });
  const outline = `M${US.map(([lo, la]) => proj([la, lo]).map(r1).join(' ')).join('L')}Z`;
  return { vb, routes, cities, outline, n: routes.length };
}

// City labels: to the right of the dot, or to the left near the right edge or when a neighbour is in the way.
function labels(map) {
  const out = map.cities.map((q) => ({ ...q, lx: ((q.x - map.vb[0]) / map.vb[2]) * 100, ly: ((q.y - map.vb[1]) / map.vb[3]) * 100 }));
  out.forEach((q) => { q.left = q.lx > 66; });
  out.forEach((q, i) => out.slice(0, i).forEach((o) => { if (Math.abs(o.ly - q.ly) < 7 && Math.abs(o.lx - q.lx) < 26 && o.left === q.left) q.left = !q.left && q.lx > 22 ? true : q.lx < 66 ? false : q.left; }));
  return out;
}

// ---- the trailers, drawn small for the list (side view, line only) -------------------------------------------------
function rigLine(kind) {
  const wheels = '<circle cx="18" cy="40" r="5"/><circle cx="30" cy="40" r="5"/><circle cx="118" cy="40" r="5"/><circle cx="130" cy="40" r="5"/><circle cx="160" cy="40" r="5"/>';
  const cab = 'M114 35V14h18l6 8h18q6 0 6 6v7';
  const body = kind === 'flatbed' ? 'M4 34h116M10 34V24h46v10M60 34V20h40v14' : kind === 'tanker' ? 'M8 32Q4 32 4 24T8 16h100q8 0 8 8t-8 8Z' : kind === 'box' ? 'M60 34V8h52v26' : 'M4 34V6h106v28';
  const extra = kind === 'reefer' ? '<path d="M110 10h5v16h-5"/>' : '';
  return `<svg class="rig" viewBox="0 0 170 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="${body}"/>${extra}<path d="${cab}"/><path d="M4 35h158"/>${wheels}</g></svg>`;
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1800, h: 1200, style: 'object', alt: c.profile.hero || g[0] || `A ${c.name} truck on the highway at first light` },
    { slot: 'heroPhone', file: 'hero-phone.jpg', w: 1080, h: 1600, style: 'object', alt: c.profile.hero || g[0] || `A ${c.name} truck on the highway at first light` },
    { slot: 'yard', file: 'yard.jpg', w: 1500, h: 900, style: 'object', alt: g[1] || `Trailers backed into the dock at ${c.name}` },
  ];
}

function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const restates = (t) => (lw(t).includes(lw(c.name)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return (c.aboutParas || []).map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  return [
    (c.services || []).length && { label: 'Services', href: '#haul' },
    mapOf(c) && { label: 'Lanes', href: '#lanes' },
    hiringOf(c) && { label: 'Drivers', href: '#drivers' },
    { label: 'Quote', href: '#quote' },
  ].filter(Boolean);
}

function footer(c, au) {
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  return `<footer class="fr-ftr">
<div class="wrap fr-ftr-in">
<div class="door">
<p class="door-name">${esc(c.name)}</p>
${c.city && !c.online ? `<p class="door-city">${esc(c.city)}</p>` : ''}
${au.dot || au.mc ? `<p class="door-no">${au.dot ? `<span>USDOT ${esc(au.dot)}</span>` : ''}${au.mc ? `<span>MC ${esc(au.mc)}</span>` : ''}</p>` : ''}
</div>
${links ? `<nav aria-label="Footer"><ul class="fr-ftr-nav">${links}</ul></nav>` : ''}
${P.socials(c, { cls: 'fr-ftr-social', size: 18 })}
<p class="fr-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div>
</footer>`;
}

function render(c) {
  const au = authority(c);
  const fleet = fleetOf(c);
  const hire = hiringOf(c);
  const map = mapOf(c);
  const rig = rigOf(c);
  const sv = c.services || [];

  // Hero: the photo, full bleed; the name lettered on; what they haul and from where; authority; the two buttons.
  const lead = c.footerLine || c.heroSub;
  const safer = au.dot ? `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${encodeURIComponent(au.dot)}` : '';
  const auLine = au.dot || au.mc ? `<p class="auth" data-ci="then">${au.dot ? `<span>USDOT ${esc(au.dot)}</span>` : ''}${au.mc ? `<span>MC ${esc(au.mc)}</span>` : ''}${safer ? `<a href="${esc(safer)}">Check us on FMCSA${icon('arrowUpRight', { size: 15 })}</a>` : ''}</p>` : '';
  // One wide render and no upright one: the wide photo serves both, so the page carries it once.
  const onePhoto = !Art.photo(id, 'heroPhone') && Art.photo(id, 'hero');
  const pics = onePhoto ? P.img(c, 'hero', { cls: 'hero-img hero-img-1', eager: true }) : `${P.img(c, 'heroPhone', { cls: 'hero-img hero-img-p', eager: true })}${P.img(c, 'hero', { cls: 'hero-img hero-img-d' })}`;
  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="hero-pic" data-ci="subject"><div class="hero-par" data-par="0.1"><div class="hero-alive" data-alive="0.5"><div class="hero-push">${pics}</div></div></div><span class="dawn" aria-hidden="true"></span></div>
<div class="wrap hero-in">
<h1 class="hero-h" id="hero-title" data-ci="head">${esc(c.name)}</h1>
<p class="lead" data-ci="then">${esc(lead)}</p>
${auLine}
<div class="ctas" data-ci="then">${c.primary ? P.button(c.primary, 'btn btn-primary btn-lg') : ''}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg', c.secondary.kind === 'phone' ? 'phone' : '') : ''}</div>
</div>
</section>`;

  // What we haul: each service as the carrier wrote it, with the trailer it goes in drawn small.
  const haul = sv.length ? `<section class="sec haul" id="haul" aria-labelledby="haul-title">
<div class="wrap">
<h2 class="h2" id="haul-title" data-rv>What we haul</h2>
<ol class="haul-l">${sv.map((s, i) => `<li class="hl" data-rv style="--d:${i % 4}"><span class="hl-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="hl-b"><h3 class="hl-t">${esc(s.name)}</h3>${s.description ? `<p class="hl-d">${esc(s.description)}</p>` : ''}</div>${s.priceText ? `<p class="hl-p">${esc(s.priceText)}</p>` : ''}${rigLine(rigOfService(s) || rig || 'van')}</li>`).join('')}</ol>
</div>
</section>` : '';

  // The yard: the dock photo, the fleet in the carrier's own numbers, and what comes with every load.
  const extras = (c.included || []).filter((t) => !usedLine(t));
  const yard = `<section class="sec yard" aria-label="${fleet.length ? 'Our fleet' : 'Our yard'}">
<div class="wrap yard-in">
<figure class="yard-pic" data-rv="mask">${P.img(c, 'yard', { cls: 'yard-img' })}</figure>
<div class="yard-t">
${fleet.length ? `<h2 class="h2 yard-h">Our fleet</h2><dl class="fleet">${fleet.map((f) => `<div data-rv><dt>${esc(f.what)}</dt><dd>${esc(f.n)}</dd></div>`).join('')}</dl>` : ''}
${extras.length ? `<h3 class="yard-k">With every load</h3><ul class="checks">${extras.map((t) => `<li>${icon('check', { size: 18 })}${esc(t)}</li>`).join('')}</ul>` : ''}
</div>
</div>
</section>`;

  // The moment: the lanes, drawn across the map one after another as you scroll.
  const lanesSec = map ? `<section class="lanes" id="lanes" aria-labelledby="lanes-title" data-sc style="--nl:${map.n}">
<div class="lanes-stage" data-sc-stage>
<div class="wrap lanes-in">
<h2 class="h2 lanes-h" id="lanes-title">Our lanes</h2>
<div class="map">
<svg class="map-svg" viewBox="${map.vb.join(' ')}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><path class="us" d="${map.outline}"/>${map.routes.map((r) => `<path class="rt-base" d="${r.d}"/><path class="rt" style="--i:${r.i}" d="${r.d}" pathLength="1"/>`).join('')}${map.cities.map((q) => `<circle class="city${q.home ? ' home' : ''}" style="--i:${q.i.toFixed(2)}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(map.vb[2] / 160).toFixed(2)}"/>`).join('')}</svg>
${labels(map).map((q) => `<span class="cl${q.left ? ' cl-l' : ''}" aria-hidden="true" style="--i:${q.i.toFixed(2)};left:${q.lx.toFixed(1)}%;top:${q.ly.toFixed(1)}%">${esc(q.name.split(',')[0])}</span>`).join('')}
</div>
<ol class="lane-l">${map.routes.map((r) => `<li style="--i:${r.i}">${esc(r.label.replace(' to ', ' → '))}</li>`).join('')}</ol>
</div>
</div>
</section>` : '';

  // Quote: a bill of lading.
  const equip = [...new Set(sv.map((s) => s.name))].slice(0, 8);
  const fields = ['company', 'name', 'phone', 'email',
    { name: 'pickup', label: 'Pickup city', type: 'text', half: true, required: true },
    { name: 'delivery', label: 'Delivery city', type: 'text', half: true, required: true },
    { name: 'ready', label: 'Ready date', type: 'date', half: true },
    { name: 'weight', label: 'Weight in pounds', type: 'number', half: true },
    ...(equip.length > 1 ? [{ name: 'equipment', label: 'Service', type: 'select', options: equip }] : []),
    { name: 'message', label: 'What it is, and anything else we should know', type: 'textarea' }];
  const quote = `<section class="sec quote" id="quote" aria-labelledby="quote-title">
<div class="wrap quote-in">
<div class="quote-head">
<h2 class="h2" id="quote-title" data-rv>Get a quote</h2>
${c.promise ? `<p class="promise" data-rv>${esc(c.promise)}</p>` : ''}
<dl class="disp" data-rv>${c.phone ? `<div><dt>Dispatch</dt><dd><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></dd></div>` : ''}${c.email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd></div>` : ''}${c.address ? `<div><dt>Yard</dt><dd>${esc(c.address)}</dd></div>` : ''}</dl>
${c.hours.rows.length ? `<div class="disp-h" data-rv><h3 class="yard-k">Dispatch hours</h3>${P.hours(c.hours.rows)}</div>` : ''}
</div>
<div class="bol" data-rv>
<p class="bol-top" aria-hidden="true"><span>Bill of lading</span><span>${esc(c.name)}</span></p>
${P.form(c, { id: 'quote', fields, submit: 'Send for a quote', subject: `Quote request for ${c.name}`, note: false })}
</div>
</div>
</section>`;

  // Drivers: only when the carrier says it's hiring, in its words.
  const apply = c.email ? { label: 'Apply by email', href: `mailto:${c.email}?subject=${encodeURIComponent('Driver application')}` } : c.phone ? { label: `Call ${c.phone.display}`, href: c.phone.href } : null;
  const drivers = hire ? `<section class="sec drivers" id="drivers" aria-labelledby="drivers-title">
<div class="wrap drivers-in">
<h2 class="h2" id="drivers-title" data-rv>Drive with us</h2>
<p class="drivers-l" data-rv>${esc(hire)}</p>
${apply ? `<a class="btn btn-line btn-lg" href="${esc(apply.href)}" data-rv>${esc(apply.label)}</a>` : ''}
</div>
</section>` : '';

  const paras = aboutParas(c);
  const who = c.owner && c.owner !== c.name ? c.owner : '';
  const about = paras.length ? `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-in">
<h2 class="h2" id="about-title" data-rv>${esc(who ? `About ${c.name}` : 'About us')}</h2>
<div class="about-t" data-rv>${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
</div>
</section>` : '';

  const faq = c.faq.length ? `<section class="sec faq-sec" aria-labelledby="faq-title"><div class="wrap about-in"><h2 class="h2" id="faq-title">Questions</h2>${P.faq(c.faq)}</div></section>` : '';

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-fr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, haul, lanesSec, yard, quote, drivers, about, faq, '</main>', footer(c, au), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}${LENIS_CSS}`, script: `${m.script}${lenisScript({ lerp: 0.12 })}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '3px', btnRadius: '4px', max: '78rem' } };
}

// ---- the drawings -------------------------------------------------------------------------------------------------
// hero: first light on the highway, side on, the rig backlit by the sun coming up, its marker lights and headlights
// on. The phone frame is upright with the rig smaller and the sky taller. yard: the dock at dusk, the carrier's
// trailers backed in under the dock lights, seen from behind. Anything that isn't a carrier gets the dock, doors down.
// No text, under 12 KB each.
function rigSil(kind, mk) {
  // Side view, facing right, ground at y = 0, about 720 long. Silhouette, rim-lit along the top.
  const W = (x) => `<circle cx="${x}" cy="-20" r="20" fill="#050506"/><circle cx="${x}" cy="-20" r="9" fill="none" stroke="#2a2d31" stroke-width="2"/>`;
  let trailer = '', rim = '';
  if (kind === 'flatbed') {
    trailer = '<rect x="0" y="-52" width="530" height="14" fill="#08090b"/><path d="M14 -52V-104Q14 -112 22 -112H230Q238 -112 238 -104V-52ZM262 -52V-96Q262 -102 268 -102H500Q506 -102 506 -96V-52Z" fill="#0b0c0e"/><path d="M60 -112V-52M120 -112V-52M180 -112V-52M320 -102V-52M400 -102V-52M470 -102V-52" stroke="#1a1c20" stroke-width="3"/>';
    rim = 'M14 -112H238M262 -102H506';
  } else if (kind === 'tanker') {
    trailer = '<rect x="6" y="-128" width="512" height="86" rx="43" fill="#0a0b0d"/><path d="M40 -128V-138H480V-128" fill="none" stroke="#0a0b0d" stroke-width="4"/><rect x="0" y="-46" width="530" height="8" fill="#08090b"/>';
    rim = 'M50 -128H474';
  } else if (kind === 'box') {
    trailer = '<rect x="250" y="-128" width="290" height="92" fill="#0a0b0d"/>';
    rim = 'M250 -128H540';
  } else {
    trailer = '<rect x="0" y="-138" width="530" height="100" fill="#0a0b0d"/><path d="M0 -46H530" stroke="#16181b" stroke-width="2"/>';
    rim = 'M0 -138H530';
    if (kind === 'reefer') { trailer += '<rect x="530" y="-128" width="18" height="70" rx="3" fill="#0d0e10"/>'; rim += 'M530 -128H548'; }
  }
  const box = kind === 'box';
  const legs = box ? '' : '<path d="M420 -38V-6M432 -38V-6" stroke="#08090b" stroke-width="5"/>';
  const axles = box ? `${W(300)}${W(342)}` : `${W(40)}${W(82)}`;
  const tx = box ? 540 : 520;
  const tractor = box
    ? `<path d="M540 -128H598L630 -96H668Q676 -96 676 -86V-40H540Z" fill="#0b0c0e"/><path d="M604 -122L628 -98" stroke="#2a3038" stroke-width="10"/>`
    : `<path d="M${tx} -150H${tx + 66}V-40H${tx}Z" fill="#0b0c0e"/><path d="M${tx + 66} -150Q${tx + 78} -150 ${tx + 84} -138L${tx + 112} -100H${tx + 166}Q${tx + 182} -98 ${tx + 184} -84V-40H${tx + 66}Z" fill="#0c0d0f"/><rect x="${tx + 58}" y="-182" width="7" height="132" fill="#0b0c0e"/><path d="M${tx + 84} -134L${tx + 106} -104" stroke="#2c323a" stroke-width="12" stroke-linecap="round"/><path d="M${tx + 184} -52V-34H${tx + 190}V-56Z" fill="#0b0c0e"/>`;
  const tw = box ? `${W(650)}` : `${W(tx + 10)}${W(tx + 52)}${W(tx + 150)}`;
  const tRim = box ? 'M540 -128H598L630 -96H668' : `M${tx} -150H${tx + 66}Q${tx + 78} -150 ${tx + 84} -138L${tx + 112} -100H${tx + 166}`;
  const front = box ? 676 : tx + 186;
  const markers = Array.from({ length: box ? 3 : 6 }, (_, i) => `<circle cx="${(box ? 270 : 20) + i * (box ? 120 : 100)}" cy="-44" r="3.2" fill="${mk}"/>`).join('') + `<circle cx="${box ? 252 : 4}" cy="${box ? -124 : -134}" r="3" fill="${mk}"/><circle cx="${front - 40}" cy="${box ? -100 : -146}" r="2.6" fill="${mk}"/>`;
  const lights = `<circle cx="${front - 2}" cy="-62" r="5" fill="#fff6e6"/><circle cx="${box ? 254 : 4}" cy="-50" r="4" fill="#ff3b2f"/>`;
  return { body: `${trailer}${legs}${axles}${tractor}${tw}<path d="${rim}${tRim}" fill="none" stroke="#ffd2a1" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>${markers}${lights}`, front };
}
function art(slot, { p, c, seed, art: Art }) {
  // A rendered photo wins when the pack ships one; the phone hero falls back to the wide render, cropped.
  const ph = Art.photo && (Art.photo('freight', slot.slot) || (slot.slot === 'heroPhone' && Art.photo('freight', 'hero')));
  if (ph) return ph;
  const cc = c || {};
  const kind = rigOf(cc);
  const w = slot.w, h = slot.h;
  const f = (v) => (+v).toFixed(1);
  const r = Art.rng(`${seed}:${slot.slot}`);
  // Marker lights: the member's colour, warmed toward amber so it reads as a lamp.
  const mk = color.mix(color.ensureContrast(p.primary, '#0b0c0e', 4), '#ffb347', 0.35);
  const grain = '<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter><filter id="sb" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>';
  const dock = (doors, rigs) => {
    // The dock wall at dusk: dock doors under lamps; rigs (if any) backed into them, seen from behind.
    const dw = w / (doors + 0.6), top = h * 0.2, base = h * 0.78;
    let s = `<rect width="${w}" height="${h}" fill="url(#dk)"/><rect y="${f(base)}" width="${w}" height="${f(h - base)}" fill="url(#lot)"/><rect y="${f(base - 18)}" width="${w}" height="18" fill="#17191c"/>`;
    for (let i = 0; i < doors; i++) {
      const x = dw * 0.3 + i * dw + dw * 0.1, dx = dw * 0.8;
      s += `<ellipse cx="${f(x + dx / 2)}" cy="${f(top + 20)}" rx="${f(dx * 0.62)}" ry="${f(h * 0.3)}" fill="url(#lmp)"/><rect x="${f(x + dx / 2 - 14)}" y="${f(top - 26)}" width="28" height="8" rx="3" fill="#2a2d31"/><circle cx="${f(x + dx / 2)}" cy="${f(top - 16)}" r="5" fill="#ffe7c2"/>`;
      s += `<rect x="${f(x)}" y="${f(top + 30)}" width="${f(dx)}" height="${f(base - top - 48)}" fill="#1c1f23" stroke="#2c3035" stroke-width="3"/>`;
      if (!rigs || !rigs[i]) {
        for (let k = 1; k < 9; k++) s += `<path d="M${f(x + 4)} ${f(top + 30 + k * (base - top - 48) / 9)}h${f(dx - 8)}" stroke="#262a2f" stroke-width="2"/>`;
        continue;
      }
      // A trailer from behind: doors, lock rods, bumper, tail and marker lights.
      const tw2 = dx * 0.96, tx2 = x + (dx - tw2) / 2, ty = top + 44, th = base - ty + 12;
      const reef = rigs[i] === 'reefer';
      s += `<rect x="${f(tx2 - 6)}" y="${f(base + 30)}" width="${f(tw2 + 12)}" height="22" fill="#000" opacity=".6" filter="url(#sb)"/><rect x="${f(tx2)}" y="${f(ty)}" width="${f(tw2)}" height="${f(th - 26)}" fill="${reef ? '#d9dcdf' : '#c4c8cc'}"/><rect x="${f(tx2)}" y="${f(ty)}" width="${f(tw2)}" height="${f(th - 26)}" fill="url(#tsh)"/>`;
      s += `<path d="M${f(tx2 + tw2 / 2)} ${f(ty + 4)}V${f(ty + th - 30)}M${f(tx2 + tw2 * 0.2)} ${f(ty + 8)}V${f(ty + th - 32)}M${f(tx2 + tw2 * 0.4)} ${f(ty + 8)}V${f(ty + th - 32)}M${f(tx2 + tw2 * 0.6)} ${f(ty + 8)}V${f(ty + th - 32)}M${f(tx2 + tw2 * 0.8)} ${f(ty + 8)}V${f(ty + th - 32)}" stroke="#7d848b" stroke-width="3"/>`;
      s += `<rect x="${f(tx2 + 4)}" y="${f(ty + th - 26)}" width="${f(tw2 - 8)}" height="10" fill="#1a1c1f"/><rect x="${f(tx2 + tw2 * 0.12)}" y="${f(ty + th - 12)}" width="${f(tw2 * 0.76)}" height="9" fill="#2a2d31"/><circle cx="${f(tx2 + 14)}" cy="${f(ty + th - 34)}" r="6" fill="#d8352b"/><circle cx="${f(tx2 + tw2 - 14)}" cy="${f(ty + th - 34)}" r="6" fill="#d8352b"/>`;
      s += `<circle cx="${f(tx2 + tw2 / 2 - 14)}" cy="${f(ty + 8)}" r="3" fill="${mk}"/><circle cx="${f(tx2 + tw2 / 2)}" cy="${f(ty + 8)}" r="3" fill="${mk}"/><circle cx="${f(tx2 + tw2 / 2 + 14)}" cy="${f(ty + 8)}" r="3" fill="${mk}"/>`;
    }
    // Faded bay lines on the lot.
    for (let i = 0; i <= doors; i++) { const x = dw * 0.3 + i * dw; s += `<path d="M${f(x)} ${f(base + 4)}L${f(x + (x - w / 2) * 0.35)} ${h}" stroke="#c9b46a" stroke-opacity=".18" stroke-width="5"/>`; }
    return s;
  };
  const dockDefs = '<linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0f14"/><stop offset="1" stop-color="#1b1e23"/></linearGradient><linearGradient id="lot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101113"/><stop offset="1" stop-color="#060607"/></linearGradient><radialGradient id="lmp" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffe2b8" stop-opacity=".34"/><stop offset=".6" stop-color="#ffe2b8" stop-opacity=".05"/><stop offset="1" stop-color="#ffe2b8" stop-opacity="0"/></radialGradient><linearGradient id="tsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>';
  if (slot.slot === 'yard' || !kind) {
    if (slot.slot === 'yard' && !kind) return null;
    const types = [...new Set((cc.services || []).map(rigOfService).filter(Boolean))];
    const doors = slot.slot === 'yard' ? 4 : h > w ? 2 : 4;
    const rigs = slot.slot === 'yard' ? Array.from({ length: doors }, (_, i) => (i === 2 ? null : types[i % Math.max(1, types.length)] || kind || 'van')) : null;
    return Art.svgDoc(w, h, `${dockDefs}${grain}`, `${dock(doors, rigs)}<rect width="${w}" height="${h}" filter="url(#gr)"/>`);
  }
  // hero / heroPhone: first light.
  const tall = h > w;
  const hz = tall ? h * 0.27 : h * 0.66, ground = hz + (tall ? 110 : 130);
  const sc = tall ? 0.86 : 1.5;
  const R = rigSil(kind, mk);
  const len = (R.front + 10) * sc;
  const x0 = tall ? (w - len) / 2 : w - len - 70;
  const sunX = tall ? w * 0.36 : x0 + len * 0.42;
  let hills = '';
  for (const [k, col, amp] of [[0, '#1d1f2b', 70], [1, '#13151c', 40]]) {
    let d = `M0 ${f(hz)}`;
    for (let x = 0; x <= w; x += w / 9) d += `L${f(x)} ${f(hz - (k ? 8 : 20) - r() * amp)}`;
    hills += `<path d="${d}L${w} ${f(hz)}Z" fill="${col}"/>`;
  }
  const defs = `${grain}<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b16"/><stop offset=".45" stop-color="#1c2236"/><stop offset=".78" stop-color="#5b4250"/><stop offset=".92" stop-color="#c46a43"/><stop offset="1" stop-color="#f0a463"/></linearGradient><radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1d6"/><stop offset=".12" stop-color="#ffd59a" stop-opacity=".9"/><stop offset=".4" stop-color="#f29a5a" stop-opacity=".28"/><stop offset="1" stop-color="#f29a5a" stop-opacity="0"/></radialGradient><linearGradient id="rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2a30"/><stop offset=".3" stop-color="#141417"/><stop offset="1" stop-color="#060607"/></linearGradient><linearGradient id="bm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3dc" stop-opacity=".32"/><stop offset="1" stop-color="#fff3dc" stop-opacity="0"/></linearGradient>`;
  let road = `<rect y="${f(hz)}" width="${w}" height="${f(h - hz)}" fill="url(#rd)"/><path d="M0 ${f(hz + 6)}H${w}" stroke="#f0a463" stroke-opacity=".25" stroke-width="3"/>`;
  road += `<path d="M0 ${f(ground + 34)}H${w}" stroke="#f3d27a" stroke-opacity=".28" stroke-width="5" stroke-dasharray="70 90"/><path d="M0 ${f(ground + 6)}H${w}" stroke="#d9d4c7" stroke-opacity=".16" stroke-width="4"/>`;
  road += `<ellipse cx="${f(sunX)}" cy="${f(ground + 20)}" rx="${f(w * 0.35)}" ry="18" fill="#f0a463" opacity=".12"/>`;
  const beam = `<path d="M${f(x0 + (R.front - 2) * sc)} ${f(ground - 62 * sc)}L${f(Math.min(w, x0 + (R.front + 420) * sc))} ${f(ground - 30)}V${f(ground + 40)}Z" fill="url(#bm)"/>`;
  const shadow = `<rect x="${f(x0)}" y="${f(ground - 6)}" width="${f(len)}" height="16" fill="#000" opacity=".7" filter="url(#sb)"/>`;
  const body = `<rect width="${w}" height="${f(hz + 2)}" fill="url(#sky)"/><circle cx="${f(sunX)}" cy="${f(hz)}" r="${f(tall ? 420 : 520)}" fill="url(#sun)"/>${hills}${road}${shadow}${beam}<g transform="translate(${f(x0)} ${f(ground)}) scale(${sc})">${R.body}</g><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  return Art.svgDoc(w, h, defs, body);
}

const CSS = `
@font-face{font-family:'Freight Display Fallback';font-weight:700 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('Arial');size-adjust:96%;ascent-override:92%;descent-override:40%;line-gap-override:0%}
@font-face{font-family:'Freight Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Helvetica');size-adjust:104%;ascent-override:91%;descent-override:22%;line-gap-override:0%}
@font-face{font-family:'Freight Mono Fallback';src:local('Courier New'),local('Liberation Mono'),local('Menlo');size-adjust:101%;ascent-override:87%;descent-override:38%;line-gap-override:0%}
html:root{--surface:#14171b;--surface-2:#1a1e23;--ink:#eceef0;--muted:#9aa1a9;--line:#272b31;--primary-deep:#e7a184;--focus:#e0855e;--font-display:"Overpass","Freight Display Fallback",sans-serif;--font-body:"Public Sans","Freight Body Fallback",sans-serif;--mono:"Overpass Mono","Freight Mono Fallback",monospace;--ease:cubic-bezier(.16,1,.3,1);--panel:#14171b;--panel-line:#262a30;--map:#14181e;--map-edge:#2b313a;--rt-glow:drop-shadow(0 0 3px var(--primary-text))}
html[data-theme="light"]{--surface:#f3f4f5;--surface-2:#f6f6f7;--ink:#15171a;--muted:#545a61;--line:#cdd0d4;--primary-deep:#7e2a08;--focus:#c2410c;--panel:#f6f6f7;--panel-line:#d4d6d9;--map:#f1f2f3;--map-edge:#c3c7cc;--rt-glow:none}
body{font-size:1.0625rem;line-height:1.55}
h1,h2,h3{font-family:var(--font-display);font-weight:800;letter-spacing:-.01em;line-height:1}
.h2{font-size:clamp(2.2rem,1.5rem + 3.2vw,4.4rem);text-transform:uppercase;letter-spacing:.01em}
.btn{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:.06em;transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border:2px solid color-mix(in srgb,var(--ink) 40%,var(--bg))}
.btn-line:hover{border-color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1rem;min-height:4rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1.15rem;text-transform:uppercase;letter-spacing:.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{display:block;padding:.5rem 0;text-decoration:none;color:var(--muted);font-family:var(--font-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.9rem;transition:color .2s ease}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.hdr-cta{min-height:2.75rem;padding:.5rem 1.1rem}
.menu-panel{min-height:calc(100svh - 4rem);overflow-y:auto;background:var(--bg)}
.menu-panel li a{font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:2rem}
body.has-bar .menu-panel>.btn{display:none}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.sec{padding-block:clamp(3.5rem,2.5rem + 4vw,7rem)}
/* hero: the photo, full bleed, dark in both modes */
.hero{position:relative;isolation:isolate;display:grid;align-items:end;padding-block:0 2.5rem;background:#07080b;color:#f1f2f3;overflow:hidden}
.hero-pic{position:relative;height:min(60svh,32rem);z-index:-2;overflow:hidden}
.hero-pic::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgb(7,8,11) 0,rgba(7,8,11,.6) 22%,rgba(7,8,11,0) 48%);pointer-events:none}
.hero-par{position:absolute;inset:-8% 0}
.hero-alive,.hero-push{position:absolute;inset:0}
html.m .hero-push{animation:push 9s cubic-bezier(.16,1,.3,1) .2s both}
@keyframes push{from{transform:scale(1.08)}to{transform:none}}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-img-p{object-position:50% 0%}
.hero-img-1{object-position:50% 50%}
.hero-img-d{display:none;object-position:70% 60%}
.dawn{position:absolute;left:0;right:0;bottom:22%;height:40%;background:radial-gradient(60% 50% at 45% 100%,rgba(255,196,140,.22),transparent 70%);mix-blend-mode:screen;opacity:0;pointer-events:none}
html.m .dawn{animation:dawn 6s ease-out 1s both}
@keyframes dawn{from{opacity:0}to{opacity:1}}
html:not(.m) .dawn{opacity:1}
.hero::after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none}
.hero-in{position:relative;display:grid;gap:1rem;justify-items:start;margin-top:-4.5rem}
.hero-h{font-size:clamp(2.9rem,1.6rem + 7vw,7.4rem);line-height:.92;text-transform:uppercase;letter-spacing:-.005em;max-width:12ch;color:#fff;text-wrap:balance}
.hero .lead{max-width:32rem;color:#dfe2e5;font-size:clamp(1.08rem,1rem + .4vw,1.3rem)}
.auth{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1.1rem;font-family:var(--mono);font-size:.9rem;letter-spacing:.04em;color:#c9cdd2}
.auth a{display:inline-flex;align-items:center;gap:.3rem;min-height:2.75rem;color:#fff;text-decoration:underline;text-underline-offset:.3em;text-decoration-color:rgba(255,255,255,.4)}
.auth a:hover{text-decoration-color:#fff}
.ctas{display:flex;flex-wrap:wrap;gap:.6rem}
.hero .btn-line{color:#fff;border-color:rgba(255,255,255,.55)}
.hero .btn-line:hover{border-color:#fff}
.hero .btn-line svg{width:18px;height:18px}
@media (min-width:48rem){
.hero{align-items:center;min-height:max(40rem,calc(100svh - 4rem));padding-block:4rem}
.hero-pic{position:absolute;inset:0;height:auto}
.hero-pic::after{content:none}
.hero-in{margin-top:0}
.hero-img-p{display:none}
.hero-img-d{display:block}
.hero::after{background:linear-gradient(90deg,rgba(7,8,11,.94) 0,rgba(7,8,11,.74) 32%,rgba(7,8,11,.1) 60%,rgba(7,8,11,0) 72%),linear-gradient(0deg,rgba(7,8,11,.6),transparent 30%)}
.hero-in{max-width:78rem}
.hero-h{max-width:11ch}
}
/* what we haul */
.haul-l{border-top:2px solid var(--ink);margin-top:1.5rem}
.hl{display:grid;grid-template-columns:2.25rem minmax(0,1fr) auto;gap:.3rem 1rem;align-items:baseline;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.hl-n{font-family:var(--mono);font-size:.85rem;color:var(--muted)}
.hl-t{font-size:clamp(1.5rem,1.2rem + 1.3vw,2.4rem);text-transform:uppercase}
.hl-d{margin-top:.35rem;color:var(--muted);max-width:40rem}
.hl-p{font-family:var(--mono);font-weight:500}
.rig{grid-column:2 / -1;width:min(100%,15rem);height:auto;color:color-mix(in srgb,var(--ink) 55%,var(--bg));margin-top:.4rem}
@media (min-width:48rem){.hl{grid-template-columns:3rem minmax(0,1fr) auto 15rem;align-items:center}.rig{grid-column:auto;margin:0}}
/* lanes: the moment */
.lanes{--p:1;border-top:1px solid var(--line)}
html.m .lanes{height:calc(110svh + var(--nl) * 28svh)}
.lanes-stage{position:sticky;top:4rem;min-height:calc(100svh - 4rem);display:grid;align-content:center;padding-block:2rem}
.lanes-in{display:grid;gap:1.25rem}
@media (min-width:60rem){.lanes-in{grid-template-columns:minmax(0,8fr) minmax(0,4fr);align-items:end;gap:1.5rem 3rem}.lanes-h{grid-column:1 / -1}}
.map{position:relative;aspect-ratio:1.45;border-radius:4px;background:var(--map);border:1px solid var(--panel-line);overflow:hidden}
.map-svg{position:absolute;inset:0;width:100%;height:100%}
.us{fill:var(--map);stroke:var(--map-edge);stroke-width:1.5;vector-effect:non-scaling-stroke}
.rt-base{fill:none;stroke:var(--map-edge);stroke-width:1.5;stroke-dasharray:4 5;vector-effect:non-scaling-stroke}
.rt{--li:clamp(0,calc(var(--p) * (var(--nl) + .6) - var(--i)),1);fill:none;stroke:var(--primary-text);stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:1 1;stroke-dashoffset:calc(1 - var(--li));opacity:clamp(0,calc(var(--li) * 40),1);filter:var(--rt-glow)}
.city{--on:clamp(0,calc((var(--p) * (var(--nl) + .6) - var(--i)) * 6),1);fill:var(--ink);opacity:max(.35,var(--on))}
.city.home{fill:var(--primary-text);opacity:1}
.cl{--on:clamp(0,calc((var(--p) * (var(--nl) + .6) - var(--i)) * 6),1);position:absolute;transform:translate(.55rem,-50%);font-family:var(--font-display);font-weight:700;font-size:clamp(.75rem,.7rem + .3vw,.95rem);text-transform:uppercase;letter-spacing:.05em;color:color-mix(in srgb,var(--ink) calc(var(--on) * 100%),var(--muted));white-space:nowrap;text-shadow:0 0 6px var(--map),0 0 2px var(--map)}
.cl-l{transform:translate(calc(-100% - .55rem),-50%)}
.lane-l{display:grid;gap:0;border-top:2px solid var(--ink)}
.lane-l li{--on:clamp(0,calc((var(--p) * (var(--nl) + .6) - var(--i)) * 3),1);padding:.7rem 0;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:.95rem;color:color-mix(in srgb,var(--ink) calc(var(--on) * 100%),var(--muted))}
/* the yard */
.yard{background:var(--panel);border-block:1px solid var(--line)}
.yard-in{display:grid;gap:2rem}
@media (min-width:60rem){.yard-in{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:center;gap:3.5rem}}
.yard-pic{margin:0;border-radius:4px;overflow:hidden}
.yard-img{width:100%;height:auto}
.yard-t{display:grid;gap:1.25rem}
.fleet{display:flex;flex-wrap:wrap;gap:1rem 2.5rem}
.fleet div{display:flex;flex-direction:column-reverse}
.fleet dd{font-family:var(--font-display);font-weight:800;font-size:clamp(3.2rem,2.4rem + 3vw,5rem);line-height:.9}
.fleet dt{font-family:var(--mono);font-size:.9rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.yard-k{font-family:var(--mono);font-weight:500;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.6rem}
.checks{display:grid;gap:.6rem}
.checks li{display:flex;gap:.6rem;align-items:flex-start}
.checks svg{flex:none;margin-top:.2rem;color:var(--primary-text)}
/* quote: a bill of lading */
.quote-in{display:grid;gap:2.5rem}
@media (min-width:60rem){.quote-in{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:4rem;align-items:start}}
.quote-head{display:grid;gap:1.4rem;align-content:start}
.promise{font-size:1.15rem;max-width:32rem}
.disp{display:grid;gap:.9rem}
.disp dt{font-family:var(--mono);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.disp dd a{display:inline-flex;align-items:center;min-height:2.75rem;font-family:var(--font-display);font-weight:800;font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem);color:var(--ink);text-decoration:none;overflow-wrap:anywhere}
.disp dd a:hover{text-decoration:underline;text-decoration-color:var(--primary-text);text-underline-offset:.2em}
.bol{background:var(--panel);border:1px solid var(--panel-line);border-top:4px solid var(--ink);border-radius:2px;padding:1.25rem}
@media (min-width:48rem){.bol{padding:2rem}}
.bol-top{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1.25rem;padding-bottom:.8rem;border-bottom:1px dashed var(--panel-line);font-family:var(--mono);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.bol-top span{white-space:nowrap}
.bol-top span:last-child{overflow:hidden;text-overflow:ellipsis}
.bol label{font-family:var(--mono);font-size:.82rem;text-transform:uppercase;letter-spacing:.05em}
.bol input,.bol select,.bol textarea{border-radius:2px;background:var(--bg)}
/* drivers */
.drivers{border-top:1px solid var(--line)}
.drivers-in{display:grid;gap:1.25rem;justify-items:start}
.drivers-l{font-family:var(--font-display);font-weight:700;font-size:clamp(1.4rem,1.1rem + 1.4vw,2.4rem);line-height:1.15;max-width:28ch}
/* about */
.about{border-top:1px solid var(--line)}
.about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.about-in{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:4rem}}
.about-t{display:grid;gap:1rem;max-width:42rem;font-size:1.12rem}
/* footer: the cab door */
.fr-ftr{border-top:1px solid var(--line);padding-block:3rem 1.5rem}
.fr-ftr-in{display:grid;gap:1.25rem;justify-items:start}
.door{display:grid;gap:.35rem;padding:1.4rem 1.6rem;border:2px solid var(--ink);border-radius:4px 4px 4px 22px;min-width:min(100%,22rem)}
.door-name{font-family:var(--font-display);font-weight:800;font-size:clamp(1.5rem,1.2rem + 1.4vw,2.3rem);text-transform:uppercase;line-height:1}
.door-city{font-family:var(--font-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.door-no{display:flex;flex-wrap:wrap;gap:.2rem 1.2rem;font-family:var(--mono);font-size:.95rem;letter-spacing:.04em}
.fr-ftr a{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ink);text-decoration:none}
.fr-ftr a:hover{text-decoration:underline;text-decoration-color:var(--primary-text);text-underline-offset:.3em}
.fr-ftr-nav{display:flex;flex-wrap:wrap;gap:0 1.4rem;font-family:var(--font-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.9rem}
.fr-ftr-c{font-size:.85rem;color:var(--muted)}
.mbar{background:var(--bg);border-top-color:var(--line)}
.mbar .btn{border-radius:4px}
`;

module.exports = {
  id,
  kind: 'local-service',
  name: 'Freight',
  bestFor: 'Trucking companies and carriers: dry van, reefer, flatbed and tanker, with lanes, authority numbers and driver hiring, with motion',
  why: 'Built for carriers: your truck on the highway at first light, full bleed; your USDOT and MC numbers with the FMCSA lookup; your lanes drawn across the map as people scroll; a bill-of-lading quote form, and a hiring section when you are hiring.',
  match: /\b(trucking|truckload|freight|logistics|motor carrier|dry van|reefer|flatbed|ltl|ftl|drayage|cdl|tractor[- ]trailers?|semi trucks?)\b/,
  fonts: { q: 'family=Overpass:wght@700;800&family=Public+Sans:wght@400;500;700&family=Overpass+Mono:wght@500', display: ['Overpass', 'sans'], body: ['Public Sans', 'sans'] },
  modes: ['dark', 'light'],
  // The motion, as data (lib/choreo.md): the name lettered on, the photo pushing in at dawn, the lanes drawn on scroll.
  choreo: { intro: 'stamp', alive: ['scroll'], scroll: 'scene', pace: 'fast', look: 'a carrier at first light: the rig backlit on the highway, the lanes on a dispatch map' },
  tokens,
  slots,
  nav,
  render,
  art,
};
