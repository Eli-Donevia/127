// Roastery (animated, product): for coffee roasters who sell whole bean coffee by the bag, by the week or both.
//   Object: the bag. A kraft bag with its top rolled and tin-tied, standing on a walnut counter under one warm lamp at
//   night, beans spilled in the light. The hero is that photo at full size (a photoreal render from assets/real when
//   there is one, else the drawing), with a roast tag hanging off its corner: the roast day stamped in the member's ink.
//   Material: kraft and card stock, walnut and lamp light. Square corners, hairline rules, a warm old-style serif set
//   big and tight, a plain sans for the facts with tabular figures. No pills, no icon rows, no neon signs.
//   One move: develop. The photo comes into focus like a lens pulling focus, the headline's words sharpen one by one,
//   then a band of warm light sweeps once across the bag. The photo drifts a little slower than the page (parallax).
//   Scroll moment: the origin cards. Each coffee is an origin card (country, process, altitude, the notes in the
//   roaster's words, the roast on a light-to-dark rule) dealt onto the counter as it comes up the screen, from
//   alternating sides, and taken back when scrolling up. On the roast ladder below, each step's bean roasts from green
//   to its colour as you reach it.
//   Pop: the stamp's ink on the roast tag; links underline in it. The member's neon partner is only a faint edge of
//   light on the bag's gusset in the drawing.
// Then the roast and ship week set like a timetable (from the member's own words), the subscription with its rhythm
// drawn as weeks, the roastery with the drum roaster drawn, the back of the bag (shipping, returns, what's on every
// bag) and a footer in kraft like the bag's bottom gusset. Light mode is the counter in the morning, dark mode the
// roastery after hours; the photos are the same in both. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const theme = require('../../theme');
const { cheapest, esc } = require('../shared');

const id = 'roastery';
const MAX = 8;

function tokens(p, mode) {
  return mode === 'dark'
    ? { bg: color.mix(p.ink, '#15100c', 0.88), dark: '#0d0a07' }
    : { bg: color.mix(p.paper, '#efe7da', 0.82), dark: color.mix(p.ink, '#1b140f', 0.6) };
}

// ---------- the facts a roaster writes ----------

const ORIGINS = ['Ethiopia', 'Kenya', 'Rwanda', 'Burundi', 'Uganda', 'Tanzania', 'Congo', 'Yemen', 'Colombia', 'Brazil', 'Peru', 'Bolivia', 'Ecuador', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Mexico', 'Jamaica', 'Hawaii', 'Sumatra', 'Java', 'Sulawesi', 'Indonesia', 'Papua New Guinea', 'India', 'Myanmar', 'Vietnam', 'Thailand', 'Yunnan', 'Laos', 'Timor'];
const ORIGIN_RE = new RegExp(`\\b(${ORIGINS.join('|')})\\b`, 'gi');
const PROCESS_RE = /\b(fully washed|washed|pulped natural|natural|black honey|red honey|yellow honey|honey|anaerobic(?: natural| washed)?|carbonic maceration|wet[- ]hulled|giling basah)\b(?: process(?:ed)?)?/i;
const ALT_RE = /\b(\d{1,2},?\d{3}(?:\s?(?:-|to)\s?\d{1,2},?\d{3})?)\s?(m|masl|meters|metres|ft|feet)\b\.?/i;
const ROAST_RE = /\b(light|medium[- ]light|medium|medium[- ]dark|dark|espresso|filter|omni)(?:[- ]roast(?:ed)?)\b|\broast(?:ed)?:?\s+(light|medium[- ]light|medium|medium[- ]dark|dark)\b/i;
const WEIGHT_RE = /\b(\d+(?:\.\d+)?)\s?(oz|g|kg|lbs?)\b(?:\s+bags?)?/i;
const SUB_RE = /\bsubscri|\bevery\s+\d+\s*(?:or\s+\d+\s*)?weeks?\b|\bmonthly\b/i;
const LEVELS = [
  { k: 'Light', c: '#9b6b40' },
  { k: 'Medium light', c: '#83552f' },
  { k: 'Medium', c: '#6a4126' },
  { k: 'Medium dark', c: '#4d2f1c' },
  { k: 'Dark', c: '#301e13' },
];
const GREEN = '#a3a66a';

function levelOf(word) {
  const w = String(word || '').toLowerCase().replace(/[- ]/g, '');
  return { light: 0, filter: 0, mediumlight: 1, medium: 2, omni: 2, mediumdark: 3, espresso: 3, dark: 4 }[w];
}

// One coffee from the member's line: where it's from, how it was processed, how high it grew, how dark it's roasted,
// the bag size, and whatever is left as the notes (the roaster's own words, as written).
function coffeeOf(s) {
  const d = String(s.description || '');
  const origins = [...new Set((`${d}`.match(ORIGIN_RE) || []).map((o) => ORIGINS.find((x) => x.toLowerCase() === o.toLowerCase())))];
  const pr = d.match(PROCESS_RE), al = d.match(ALT_RE), ro = d.match(ROAST_RE), wt = d.match(WEIGHT_RE);
  const level = ro ? levelOf(ro[1] || ro[2]) : undefined;
  let rest = d;
  for (const m of [pr, al, ro, wt]) if (m) rest = rest.replace(m[0], '');
  rest = rest.replace(ORIGIN_RE, '').replace(/\b(and|&)\b(?=\s*[,.]|\s*$)/gi, '');
  const notes = rest.split(/[.;]\s*|,\s+/).map((x) => x.trim().replace(/^(and|&|notes? of|tastes? like)\s+/i, '')).filter((x) => x && !/^(and|&|blend|single origin)$/i.test(x));
  const blend = origins.length > 1 || /blend/i.test(`${s.category || ''} ${s.name}`);
  return {
    s,
    origin: origins.join(' and '),
    blend,
    process: pr ? pr[1].replace(/^./, (x) => x.toUpperCase()) : '',
    alt: al ? `${al[1].replace(/\s?to\s?/, ' to ').replace(/\s?-\s?/, ' to ')} ${/f/i.test(al[2]) ? 'ft' : 'm'}` : '',
    level,
    weight: wt ? `${wt[1]} ${wt[2].toLowerCase()}` : '',
    notes: notes.length ? notes.join(', ').replace(/^./, (x) => x.toUpperCase()) : '',
  };
}

const products = (c) => c.services.filter((s) => s.name && !SUB_RE.test(`${s.name} ${s.description || ''} ${s.category || ''}`)).slice(0, MAX);
const subscription = (c) => c.services.find((s) => s.name && SUB_RE.test(`${s.name} ${s.description || ''} ${s.category || ''}`));
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi;

// The roast and ship days, only from the member's own sentences ("Roasted every Tuesday, shipped Wednesday").
function week(c) {
  const roast = new Set(), ship = new Set();
  const src = [c.tagline, ...(c.aboutParas || []), ...(c.included || []), c.shipping].filter(Boolean).join('. ');
  for (const bit of src.split(/[.;\n]+|,\s+|\s+and\s+(?=(?:we\s+)?(?:ship|roast|pack|post|mail))/i)) {
    const ds = [...bit.matchAll(DAY_RE)].map((m) => DAYS.findIndex((d) => d.toLowerCase() === m[1].toLowerCase()));
    if (!ds.length) continue;
    if (/roast/i.test(bit) && !/\bship|post|mail/i.test(bit)) ds.forEach((d) => roast.add(d));
    else if (/\bship|post|mail/i.test(bit) && !/roast/i.test(bit)) ds.forEach((d) => ship.add(d));
  }
  return { roast: [...roast].sort(), ship: [...ship].sort() };
}

const isCoffee = (c) => /coffee|espresso|roast|bean|cafe|café/i.test(`${c.what || ''} ${c.niche || ''} ${(c.profile && c.profile.id) || ''} ${c.services.map((s) => s.name).join(' ')}`);

// ---------- the drawings ----------

const f1 = (n) => (Math.round(n * 10) / 10).toString();

// The bag on the counter at night (hero) and the drum roaster with its cooling tray (the roastery), or, for a shop
// that isn't coffee, kraft parcels tied with twine in the same lamp light. A photoreal render for the slot replaces the
// drawing when the pack has one (art.photo). Light and material, never outlines: kraft fibre from a lit bump, walnut
// grain, steel catching the lamp, beans with their crease and a highlight each.
function roasteryArt(s, ctx) {
  const ph = ctx.art.photo('roastery', s.slot);
  if (ph) return ph;
  if (s.slot !== 'bag' && s.slot !== 'roaster') return null;
  const { p, c, seed, art } = ctx;
  const { w, h } = s;
  const m = Math.min(w, h);
  const r = art.rng(`${seed}:rs:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const mix = color.mix;
  const P2 = (x, y) => `${f1(x)} ${f1(y)}`;
  const F = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
  const S = (d, col, wd, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f1(wd)}" stroke-linecap="round"${x}/>`;
  const st = (stops) => stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const lg = (i, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${i}" ${at}>${st(stops)}</linearGradient>`;
  const rg = (i, stops, at = 'cx=".5" cy=".5" r=".5"') => `<radialGradient id="${i}" ${at}>${st(stops)}</radialGradient>`;
  const bump = (i, fq, sc, k = 1.2, el = 48) => `<filter id="${i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="3" seed="${Math.round(R(1, 90))}"/><feDiffuseLighting surfaceScale="${sc}" lighting-color="#fff"><feDistantLight azimuth="235" elevation="${el}"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="${k}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const blur = (i, sd) => `<filter id="${i}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f1(sd)}"/></filter>`;
  const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"${x}/>`;
  const neon = theme.neonFor(p.primary, '#1e1712', c.neon);
  const coffee = isCoffee(c);
  const list = products(c).map(coffeeOf);
  const lv = (list.find((k) => k.level != null) || { level: 2 }).level;
  const bean = LEVELS[lv].c;
  const defs = blur('sb', m * 0.006) + blur('bl', m * 0.016) + blur('bx', m * 0.045) + blur('nt', m * 0.005) +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 .9 0 0 0 0 .8 0 0 0 .06 0"/></filter>` +
    bump('kb', `${(260 / m).toFixed(4)} ${(170 / m).toFixed(4)}`, 1.5, 1.14, 55) + bump('wd', `${(1.6 / m).toFixed(4)} ${(70 / m).toFixed(4)}`, 1.6, 1.1, 40) + bump('cs', (90 / m).toFixed(4), 1.2, 1.08, 55) +
    lg('wl', [[0, '#120d0a'], [0.55, '#221912'], [1, '#2b2019']]) +
    rg('lp', [[0, '#f0c48c', 0.42], [0.45, '#c48b56', 0.14], [1, '#c48b56', 0]]) +
    lg('wt', [[0, '#4a3324'], [0.4, '#36251a'], [1, '#1d140e']]) +
    rg('cp', [[0, '#b7895c', 0.55], [0.6, '#8a6042', 0.16], [1, '#8a6042', 0]]) +
    lg('kf', [[0, '#e2c497'], [0.42, '#c9a274'], [1, '#8c6844']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('kd', [[0, '#000', 0], [0.4, '#000', 0.06], [1, '#000', 0.62]]) + lg('kl', [[0, '#000', 0], [1, '#000', 0.16]]) + rg('sh', [[0, '#fff6e6', 0.34], [1, '#fff6e6', 0]]) +
    lg('gu', [[0, '#7a5a3b'], [1, '#3e2b1c']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('lb', [[0, '#f4ecdc'], [1, '#d8ccb5']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('me', [[0, '#4b4d50'], [0.3, '#d6d8da'], [0.55, '#7d8084'], [1, '#2a2c2e']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('mv', [[0, '#9a9da1'], [0.25, '#e9eaeb'], [0.6, '#6c6f73'], [1, '#2b2d30']]) +
    lg('ir', [[0, '#2c2d30'], [0.5, '#1a1b1d'], [1, '#0f1011']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('br', [[0, '#f1d39a'], [0.5, '#b88a45'], [1, '#6f4f22']]) +
    rg('bn', [[0, mix(bean, '#e8c49a', 0.45)], [0.55, bean], [1, mix(bean, '#000', 0.45)]], 'cx=".35" cy=".3" r=".75"') +
    rg('vg', [[0.55, '#000', 0], [1, '#000', 0.6]], 'cx=".5" cy=".45" r=".75"') +
    `<pattern id="bp" width="${f1(m * 0.05)}" height="${f1(m * 0.034)}" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">${E(m * 0.013, m * 0.01, m * 0.014, m * 0.0095, 'url(#bn)')}${E(m * 0.037, m * 0.026, m * 0.013, m * 0.0092, 'url(#bn)', ` transform="rotate(-38 ${f1(m * 0.037)} ${f1(m * 0.026)})"`)}<path d="M${P2(m * 0.002, m * 0.011)}c${f1(m * 0.008)} ${f1(-m * 0.006)} ${f1(m * 0.014)} ${f1(m * 0.005)} ${f1(m * 0.022)} ${f1(-m * 0.002)}M${P2(m * 0.027, m * 0.03)}c${f1(m * 0.006)} ${f1(-m * 0.01)} ${f1(m * 0.012)} 0 ${f1(m * 0.02)} ${f1(-m * 0.009)}" stroke="#140b06" stroke-width="${f1(m * 0.0022)}" fill="none" opacity=".7"/></pattern>` +
    `<g id="b">${E(m * 0.004, m * 0.007, m * 0.016, m * 0.009, '#000', ' opacity=".55" filter="url(#sb)"')}${E(0, 0, m * 0.016, m * 0.0115, 'url(#bn)')}<path d="M${P2(-m * 0.013, m * 0.001)}c${f1(m * 0.007)} ${f1(-m * 0.007)} ${f1(m * 0.012)} ${f1(m * 0.007)} ${f1(m * 0.026)} ${f1(-m * 0.002)}" stroke="#140b06" stroke-width="${f1(m * 0.0018)}" fill="none" opacity=".55"/>${E(-m * 0.005, -m * 0.005, m * 0.006, m * 0.0025, '#fff', ' opacity=".28"')}</g>`;
  let body = '';
  // The room: a dark wall with the lamp's pool on it, and the walnut counter (concrete floor for the roaster).
  const top = h * (s.slot === 'bag' ? 0.66 : 0.8);
  body += `<rect width="${w}" height="${h}" fill="url(#wl)"/>` + E(w * 0.42, h * 0.12, w * 0.62, h * 0.5, 'url(#lp)');
  if (s.slot === 'roaster') body += F(`M0 ${f1(top)}H${w}V${h}H0Z`, '#2a2622') + F(`M0 ${f1(top)}H${w}V${h}H0Z`, '#2a2622', ' filter="url(#cs)" opacity=".5"');
  else body += F(`M0 ${f1(top)}H${w}V${h}H0Z`, 'url(#wt)') + F(`M0 ${f1(top)}H${w}V${h}H0Z`, '#5a3e2b', ' filter="url(#wd)" opacity=".55"') + E(w * 0.44, h * 0.84, w * 0.62, h * 0.2, 'url(#cp)');
  const beans = (n, x0, x1, y0, y1, k0 = 0.9, k1 = 1.3) => {
    let o = '';
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([R(x0, x1), R(y0, y1), R(-70, 70)]);
    pts.sort((a, b) => a[1] - b[1]).forEach(([x, y, a]) => { const k = k0 + ((y - y0) / Math.max(1, y1 - y0)) * (k1 - k0); o += `<use href="#b" transform="translate(${P2(x, y)}) rotate(${Math.round(a)}) scale(${k.toFixed(2)})"/>`; });
    return o;
  };

  if (s.slot === 'bag' && coffee) {
    const x0 = w * 0.25, x1 = w * 0.665, gw = w * 0.115, yt = h * 0.25, yb = h * 0.805, fw = x1 - x0;
    const front = `M${P2(x0 + w * 0.006, yt + h * 0.07)}L${P2(x1, yt + h * 0.064)}C${P2(x1 + w * 0.008, yt + h * 0.3)} ${P2(x1 + w * 0.012, yb - h * 0.12)} ${P2(x1 + w * 0.004, yb - h * 0.004)}Q${P2(x0 + fw * 0.5, yb + h * 0.018)} ${P2(x0 - w * 0.002, yb)}C${P2(x0 - w * 0.016, yb - h * 0.15)} ${P2(x0 - w * 0.012, yt + h * 0.3)} ${P2(x0 + w * 0.006, yt + h * 0.07)}Z`;
    const gus = `M${P2(x1, yt + h * 0.064)}L${P2(x1 + gw, yt + h * 0.05)}C${P2(x1 + gw + w * 0.006, yt + h * 0.3)} ${P2(x1 + gw + w * 0.004, yb - h * 0.12)} ${P2(x1 + gw - w * 0.004, yb - h * 0.024)}L${P2(x1 + w * 0.004, yb - h * 0.004)}C${P2(x1 + w * 0.012, yb - h * 0.12)} ${P2(x1 + w * 0.008, yt + h * 0.3)} ${P2(x1, yt + h * 0.064)}Z`;
    // Shadow thrown back on the wall and counter, and the contact shadow.
    body += F(`M${P2(x1, yb - h * 0.01)}L${P2(x1 + gw * 2.6, yt + h * 0.2)}L${P2(x1 + gw * 3.4, yt + h * 0.26)}L${P2(x1 + gw * 1.2, yb)}Z`, '#000', ' opacity=".45" filter="url(#bx)"') + E(x0 + fw * 0.6, yb + h * 0.004, fw * 0.66, h * 0.02, '#000', ' opacity=".75" filter="url(#bl)"');
    // Front, its fibre, the fall-off toward the bottom, the gusset with its crease.
    body += F(front, 'url(#kf)') + F(front, '#c9a274', ' filter="url(#kb)" opacity=".55"') + F(front, 'url(#kd)') + `<clipPath id="fc"><path d="${front}"/></clipPath><g clip-path="url(#fc)">${E(x0 + fw * 0.28, yt + h * 0.16, fw * 0.5, h * 0.2, 'url(#sh)')}${F(`M${P2(x0 + fw * 0.82, yt)}L${P2(x1 + w * 0.02, yt)}V${f1(yb)}H${f1(x0 + fw * 0.7)}Z`, '#000', ' opacity=".18" filter="url(#bx)"')}</g>` +
      F(gus, 'url(#gu)') + F(gus, '#6b4d32', ' filter="url(#kb)" opacity=".45"') +
      S(`M${P2(x1 + gw * 0.5, yt + h * 0.06)}C${P2(x1 + gw * 0.55, yt + h * 0.3)} ${P2(x1 + gw * 0.5, yb - h * 0.2)} ${P2(x1 + gw * 0.46, yb - h * 0.1)}L${P2(x1 + w * 0.006, yb - h * 0.006)}M${P2(x1 + gw * 0.46, yb - h * 0.1)}L${P2(x1 + gw * 0.96, yb - h * 0.026)}`, '#2a1c12', m * 0.003, ' opacity=".7"') +
      S(`M${P2(x1 + gw - w * 0.002, yt + h * 0.06)}C${P2(x1 + gw + w * 0.005, yt + h * 0.3)} ${P2(x1 + gw + w * 0.003, yb - h * 0.14)} ${P2(x1 + gw - w * 0.004, yb - h * 0.03)}`, neon, m * 0.003, ' opacity=".3" filter="url(#nt)"');
    // Crumples across the front: soft highlights where the paper faces the lamp, soft creases below them.
    for (let i = 0; i < 6; i++) {
      const yy = yt + h * R(0.14, 0.5), xa = x0 + fw * R(0.02, 0.3), xb = x0 + fw * R(0.55, 0.98), dy = h * R(-0.05, 0.05);
      body += S(`M${P2(xa, yy)}Q${P2((xa + xb) / 2, yy + dy - h * 0.02)} ${P2(xb, yy + dy)}`, '#fff3dc', m * R(0.004, 0.009), ' opacity=".22" filter="url(#sb)"') + S(`M${P2(xa, yy + h * 0.008)}Q${P2((xa + xb) / 2, yy + dy - h * 0.01)} ${P2(xb, yy + dy + h * 0.008)}`, '#3a2616', m * 0.004, ' opacity=".2" filter="url(#sb)"');
    }
    // The rolled top: two folds, the top edge catching the lamp, and the tin tie bent down at both ends.
    const fy = yt + h * 0.012, fh = h * 0.062;
    body += F(`M${P2(x0 - w * 0.004, fy)}L${P2(x1 + gw + w * 0.004, fy - h * 0.014)}L${P2(x1 + gw + w * 0.002, fy + fh - h * 0.012)}L${P2(x0, fy + fh)}Z`, 'url(#kf)') + F(`M${P2(x0 - w * 0.004, fy)}L${P2(x1 + gw + w * 0.004, fy - h * 0.014)}L${P2(x1 + gw + w * 0.002, fy + fh - h * 0.012)}L${P2(x0, fy + fh)}Z`, '#c9a274', ' filter="url(#kb)" opacity=".5"') +
      F(`M${P2(x0, fy + fh)}L${P2(x1 + gw + w * 0.002, fy + fh - h * 0.012)}l0 ${f1(h * 0.016)}L${P2(x0 + w * 0.004, fy + fh + h * 0.016)}Z`, '#000', ' opacity=".35" filter="url(#sb)"') +
      S(`M${P2(x0 - w * 0.004, fy)}L${P2(x1 + gw + w * 0.004, fy - h * 0.014)}`, '#fbe7c4', m * 0.004, ' opacity=".8"') + S(`M${P2(x0, fy + fh * 0.5)}L${P2(x1 + gw, fy + fh * 0.5 - h * 0.013)}`, '#5b3f27', m * 0.0025, ' opacity=".55"');
    const ty = fy + fh * 0.28;
    body += S(`M${P2(x0 - w * 0.03, ty + h * 0.03)}L${P2(x0 - w * 0.022, ty)}L${P2(x1 + gw + w * 0.025, ty - h * 0.014)}L${P2(x1 + gw + w * 0.034, ty + h * 0.016)}`, 'url(#mv)', m * 0.011) + S(`M${P2(x0 - w * 0.022, ty - h * 0.003)}L${P2(x1 + gw + w * 0.025, ty - h * 0.017)}`, '#fff', m * 0.002, ' opacity=".6"');
    // The valve, and the blank label (the roast tag on the page carries the words).
    const vx = x0 + fw * 0.5, vy = yt + h * 0.15;
    body += E(vx, vy, m * 0.021, m * 0.021, '#3b2a1c', ' opacity=".55"') + E(vx - m * 0.002, vy - m * 0.002, m * 0.017, m * 0.017, '#d9b88c') + E(vx, vy, m * 0.009, m * 0.009, '#7c5c3c') + E(vx - m * 0.006, vy - m * 0.007, m * 0.006, m * 0.003, '#fff', ' opacity=".5"');
    const lx0 = x0 + fw * 0.13, lx1 = x1 - fw * 0.11, ly0 = yt + h * 0.24, ly1 = yt + h * 0.43;
    body += F(`M${P2(lx0 + w * 0.004, ly0 + h * 0.006)}H${f1(lx1 + w * 0.004)}V${f1(ly1 + h * 0.006)}H${f1(lx0 + w * 0.004)}Z`, '#000', ' opacity=".3" filter="url(#sb)"') + F(`M${P2(lx0, ly0)}L${P2(lx1, ly0 - h * 0.003)}L${P2(lx1 + w * 0.002, ly1)}L${P2(lx0 - w * 0.002, ly1 + h * 0.002)}Z`, 'url(#lb)') +
      F(`M${P2(lx0, ly0)}L${P2(lx1, ly0 - h * 0.003)}L${P2(lx1 + w * 0.002, ly1)}L${P2(lx0 - w * 0.002, ly1 + h * 0.002)}Z`, 'url(#kl)') +
      F(`M${P2(lx0 + fw * 0.03, ly0 + h * 0.012)}H${f1(lx1 - fw * 0.03)}V${f1(ly1 - h * 0.012)}H${f1(lx0 + fw * 0.03)}Z`, 'none', ` stroke="#6b4c33" stroke-width="${f1(m * 0.002)}" opacity=".6"`);
    // Beans in the lamp light: a heap against the bag's foot and a scatter toward the front.
    body += beans(16, x0 - w * 0.12, x0 + fw * 0.45, yb - h * 0.012, yb + h * 0.03, 1, 1.15) + beans(14, w * 0.06, w * 0.86, h * 0.86, h * 0.97, 1.15, 1.45);
  } else if (s.slot === 'roaster' && coffee) {
    // The drum roaster: cabinet, drum housing and faceplate, hopper with beans, chimney out of frame, and the cooling
    // tray turning in front with its arms through the beans and the last smoke coming off them.
    const cx = w * 0.56, cy = h * 0.42, rr = h * 0.17;
    body += E(cx, top + h * 0.03, w * 0.26, h * 0.035, '#000', ' opacity=".6" filter="url(#bl)"');
    body += F(`M${P2(w * 0.68, -2)}h${f1(w * 0.05)}V${f1(h * 0.3)}h${f1(-w * 0.05)}Z`, 'url(#me)') + F(`M${P2(w * 0.665, h * 0.27)}h${f1(w * 0.08)}v${f1(h * 0.025)}h${f1(-w * 0.08)}Z`, 'url(#me)');
    body += F(`M${P2(w * 0.43, h * 0.5)}H${f1(w * 0.76)}V${f1(top + h * 0.02)}H${f1(w * 0.43)}Z`, 'url(#ir)') + S(`M${P2(w * 0.43, h * 0.5)}V${f1(top + h * 0.02)}`, '#8d8f92', m * 0.003, ' opacity=".5"') +
      F(`M${P2(w * 0.47, h * 0.24)}H${f1(w * 0.76)}Q${P2(w * 0.79, h * 0.24)} ${P2(w * 0.79, h * 0.3)}V${f1(h * 0.56)}H${f1(w * 0.47)}Z`, 'url(#ir)') + S(`M${P2(w * 0.47, h * 0.245)}H${f1(w * 0.76)}`, '#c9cbce', m * 0.003, ' opacity=".45"');
    // Hopper.
    body += F(`M${P2(w * 0.58, h * 0.04)}H${f1(w * 0.72)}L${P2(w * 0.675, h * 0.2)}H${f1(w * 0.625)}Z`, 'url(#me)') + F(`M${P2(w * 0.625, h * 0.2)}h${f1(w * 0.05)}v${f1(h * 0.045)}h${f1(-w * 0.05)}Z`, '#26282b') +
      E(w * 0.65, h * 0.04, w * 0.07, h * 0.022, '#1a120c') + E(w * 0.65, h * 0.045, w * 0.064, h * 0.017, 'url(#bp)');
    // Faceplate: steel ring with bolts, the drum's dark window, the trier handle and the bean door.
    body += E(cx, cy, rr * 1.1, rr * 1.1, '#000', ' opacity=".5" filter="url(#bl)"') + E(cx, cy, rr, rr, 'url(#mv)') + E(cx, cy, rr * 0.86, rr * 0.86, 'url(#ir)');
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; body += E(cx + Math.cos(a) * rr * 0.93, cy + Math.sin(a) * rr * 0.93, rr * 0.035, rr * 0.035, 'url(#br)'); }
    body += E(cx + rr * 0.15, cy - rr * 0.3, rr * 0.22, rr * 0.22, '#0b0b0c') + E(cx + rr * 0.15, cy - rr * 0.3, rr * 0.17, rr * 0.17, '#5a3a22', ' opacity=".55"') + E(cx + rr * 0.1, cy - rr * 0.36, rr * 0.07, rr * 0.035, '#fff', ' opacity=".5"') +
      F(`M${P2(cx - rr * 1.25, cy - rr * 0.06)}H${f1(cx - rr * 0.3)}v${f1(rr * 0.12)}H${f1(cx - rr * 1.25)}Z`, 'url(#mv)') + E(cx - rr * 1.27, cy, rr * 0.07, rr * 0.11, 'url(#br)') +
      F(`M${P2(cx - rr * 0.5, cy + rr * 0.42)}A${f1(rr * 0.5)} ${f1(rr * 0.5)} 0 0 0 ${P2(cx + rr * 0.5, cy + rr * 0.42)}Z`, '#2c2e31') + S(`M${P2(cx - rr * 0.5, cy + rr * 0.42)}H${f1(cx + rr * 0.5)}`, '#b9bbbe', m * 0.003);
    // Chute down to the tray.
    body += F(`M${P2(cx - rr * 0.45, cy + rr * 0.55)}L${P2(cx - rr * 0.05, cy + rr * 0.6)}L${P2(w * 0.4, h * 0.66)}L${P2(w * 0.33, h * 0.64)}Z`, 'url(#me)');
    // Cooling tray: steel drum wall, a bed of beans, the arms, and smoke.
    const tx = w * 0.27, ty = h * 0.72, trx = w * 0.19, try_ = h * 0.085, wall = h * 0.06;
    body += E(tx, ty + wall + h * 0.02, trx * 1.05, try_ * 1.05, '#000', ' opacity=".6" filter="url(#bl)"') +
      F(`M${P2(tx - trx, ty)}V${f1(ty + wall)}A${f1(trx)} ${f1(try_)} 0 0 0 ${P2(tx + trx, ty + wall)}V${f1(ty)}Z`, 'url(#me)') +
      E(tx, ty, trx, try_, '#2a2c2f') + E(tx, ty + try_ * 0.06, trx * 0.95, try_ * 0.9, '#20140c') + E(tx, ty + try_ * 0.06, trx * 0.95, try_ * 0.9, 'url(#bp)') + E(tx, ty + try_ * 0.06, trx * 0.95, try_ * 0.9, 'url(#vg)') +
      S(`M${P2(tx - trx * 0.8, ty + try_ * 0.3)}L${P2(tx + trx * 0.8, ty - try_ * 0.25)}M${P2(tx - trx * 0.3, ty - try_ * 0.7)}L${P2(tx + trx * 0.3, ty + try_ * 0.75)}`, '#2b2d30', m * 0.012) +
      S(`M${P2(tx - trx * 0.8, ty + try_ * 0.27)}L${P2(tx + trx * 0.8, ty - try_ * 0.28)}`, '#c5c7ca', m * 0.002, ' opacity=".6"') + E(tx, ty, trx * 0.06, try_ * 0.12, 'url(#br)') +
      S(`M${P2(tx - trx, ty)}A${f1(trx)} ${f1(try_)} 0 0 1 ${P2(tx + trx, ty)}`, '#e7e8ea', m * 0.003, ' opacity=".55"');
    for (let i = 0; i < 3; i++) { const sx = tx + trx * R(-0.5, 0.4); body += S(`M${P2(sx, ty - try_ * 0.2)}c${f1(-w * 0.02)} ${f1(-h * 0.08)} ${f1(w * 0.03)} ${f1(-h * 0.12)} ${f1(w * 0.005)} ${f1(-h * 0.22)}s${f1(w * 0.02)} ${f1(-h * 0.1)} ${f1(-w * 0.01)} ${f1(-h * 0.2)}`, '#e9dccb', m * R(0.01, 0.02), ' opacity=".08" filter="url(#bl)"'); }
    // A few beans thrown over the rim onto the floor.
    body += beans(7, tx - trx * 1.2, tx + trx * 1.3, ty + wall + try_ + h * 0.02, h * 0.97, 1.1, 1.3);
  } else {
    // Not coffee: kraft parcels tied with twine, one on the counter (hero) or three stacked on the bench.
    const box = (x, y, bw, bh, d) => {
      const tp = `M${P2(x, y)}L${P2(x + d, y - d * 0.55)}L${P2(x + bw + d, y - d * 0.55)}L${P2(x + bw, y)}Z`, fr = `M${P2(x, y)}H${f1(x + bw)}V${f1(y + bh)}H${f1(x)}Z`, sd = `M${P2(x + bw, y)}L${P2(x + bw + d, y - d * 0.55)}V${f1(y + bh - d * 0.55)}L${P2(x + bw, y + bh)}Z`;
      return E(x + bw * 0.6, y + bh, bw * 0.75, bh * 0.08, '#000', ' opacity=".6" filter="url(#bl)"') + F(fr, 'url(#kf)') + F(fr, '#c9a274', ' filter="url(#kb)" opacity=".5"') + F(fr, 'url(#kd)') + F(tp, '#e8cfa6') + F(sd, 'url(#gu)') +
        S(`M${P2(x + bw * 0.5, y)}V${f1(y + bh)}M${P2(x + bw * 0.5, y)}L${P2(x + bw * 0.5 + d, y - d * 0.55)}M${P2(x + d * 0.5, y - d * 0.27)}H${f1(x + bw + d * 0.5)}L${P2(x + bw + d * 0.5, y + bh * 0.5 - d * 0.27)}`, '#efe2c9', m * 0.006) +
        S(`M${P2(x + bw * 0.5 + d * 0.5, y - d * 0.27)}c${f1(-bw * 0.08)} ${f1(-bh * 0.12)} ${f1(-bw * 0.16)} ${f1(-bh * 0.02)} 0 0c${f1(bw * 0.08)} ${f1(-bh * 0.12)} ${f1(bw * 0.16)} ${f1(-bh * 0.02)} 0 0`, '#efe2c9', m * 0.005);
    };
    if (s.slot === 'bag') body += box(w * 0.22, h * 0.48, w * 0.46, h * 0.3, w * 0.12);
    else body += box(w * 0.3, h * 0.56, w * 0.26, h * 0.24, w * 0.08) + box(w * 0.33, h * 0.36, w * 0.22, h * 0.2, w * 0.07) + box(w * 0.6, h * 0.62, w * 0.18, h * 0.18, w * 0.06);
  }
  body += `<rect width="${w}" height="${h}" fill="url(#vg)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  // Only the defs this drawing uses, and each long path written once.
  const all = defs.match(/<(filter|linearGradient|radialGradient|pattern) id="[^"]+"[\s\S]*?<\/\1>|<g id="b">[\s\S]*?<\/g>/g);
  const used = all.filter((x) => { const i = x.match(/id="([^"]+)"/)[1]; return body.includes(`url(#${i})`) || body.includes(`href="#${i}"`) || (i !== 'b' && all.some((y) => y !== x && y.includes(`url(#${i})`) && body.includes(`#${y.match(/id="([^"]+)"/)[1]}`))); }).join('');
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, used + ids, body);
}

function slots(c) {
  const coffee = isCoffee(c);
  const first = products(c)[0];
  return [
    { slot: 'bag', file: 'bag.jpg', w: 1200, h: 1500, style: 'object', alt: coffee ? `A bag of ${first ? first.name : 'our coffee'} on the counter, beans spilled beside it` : `${c.name}, packed and ready to send` },
    { slot: 'roaster', file: 'roaster.jpg', w: 1600, h: 1000, style: 'sweep', alt: coffee ? 'Beans cooling in the tray beside the drum roaster' : `${c.name} at work` },
  ];
}

function nav(c) {
  return [
    products(c).length ? { label: isCoffee(c) ? 'Coffee' : 'Shop', href: '#coffee' } : null,
    subscription(c) ? { label: 'Subscribe', href: '#subscribe' } : null,
    { label: 'Roastery', href: '#roastery' },
    c.shipping || c.returns ? { label: 'Shipping', href: '#shipping' } : null,
  ].filter(Boolean).map((l) => (l.label === 'Roastery' && !isCoffee(c) ? { ...l, label: 'About' } : l));
}

// A bean, drawn once in the page (inline SVG) and used on the cards and the roast ladder in its roast's colour.
const BEAN = '<svg class="rs-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><radialGradient id="rs-bh" cx=".34" cy=".28" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient><symbol id="rs-bean" viewBox="0 0 40 28"><ellipse cx="20" cy="14" rx="18" ry="12.5" fill="currentColor"/><ellipse cx="20" cy="14" rx="18" ry="12.5" fill="url(#rs-bh)"/><path d="M4.5 15c7-7 13 6 31-2" fill="none" stroke="#120a05" stroke-width="2.4" stroke-linecap="round" opacity=".7"/></symbol></defs></svg>';
const bean = (col, cls = 'rs-bn') => `<svg class="${cls}" viewBox="0 0 40 28" aria-hidden="true" focusable="false" style="color:${col}"><use href="#rs-bean"/></svg>`;

function render(c0) {
  const coffee = isCoffee(c0);
  const list = products(c0).map(coffeeOf);
  const sub = subscription(c0);
  const order = { label: 'Ask to order', short: 'Order', href: '#order', kind: 'form' };
  const c = c0.buy ? { ...c0, primary: { ...c0.primary, label: coffee ? 'Shop coffee' : c0.primary.label } } : { ...c0, primary: order };
  const wk = coffee ? week(c) : { roast: [], ship: [] };
  const title = (c.tagline || c.heroTitle).replace(/[.!]+$/, '');
  let lead = c.tagline && c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.tagline ? c.heroSub : '';
  if (lead && lead.replace(/[.!]+$/, '').toLowerCase() === title.toLowerCase()) lead = '';
  const k = Math.min(8, 330 / Math.max(title.length, 14)).toFixed(2);
  const km = Math.min(13.5, 470 / Math.max(title.length, 14)).toFixed(2);
  const low = cheapest({ services: products(c) });
  const weights = [...new Set(list.map((x) => x.weight).filter(Boolean))];
  const priceLine = low ? `${weights.length === 1 ? `${weights[0]} bags from` : 'From'} ${low.priceText}` : '';
  const subLink = c.links.find((l) => /subscri/i.test(l.label));
  const buyHref = (c.buy && c.buy.href) || '#order';
  const rel = (h) => (/^https?:/.test(h) ? ' rel="noopener"' : '');

  // The roast tag on the photo's corner: the roast day stamped in the member's ink (the script swaps in the date of
  // the last roast day), and the coffee in the bag.
  const first = list[0];
  const dayList = wk.roast.map((d) => `${DAYS[d]}s`).join(' and ');
  const tag = coffee && (wk.roast.length || first)
    ? `<div class="rs-tag" data-ci="then" data-ci-from="fade"><div class="rs-tag-in" data-alive="0.25">
${wk.roast.length ? `<p class="rs-stamp" data-days="${wk.roast.join(',')}"><span class="rs-stamp-k">Roasted</span> <span class="rs-stamp-d">${esc(dayList)}</span></p>` : ''}
${first ? `<p class="rs-tag-n">${esc(first.s.name)}</p>${[first.origin, first.process].filter(Boolean).length ? `<p class="rs-tag-o">${esc([first.origin, first.process].filter(Boolean).join(', '))}</p>` : ''}` : ''}
</div></div>`
    : '';

  const hero = `<section class="rs-hero" aria-labelledby="hero-title">
<div class="rs-hero-grid">
<figure class="rs-shot" data-ci="subject"><div class="rs-par" data-par="0.06">${P.img(c, 'bag', { cls: 'rs-shot-img', eager: true, sizes: '(min-width: 60rem) 50vw, 100vw' })}</div></figure>
${tag}
<div class="rs-hero-copy">
<h1 id="hero-title" class="rs-title" data-ci="head" style="--k:${k}vw;--km:${km}vw">${esc(title)}</h1>
${lead ? `<p class="rs-lead" data-ci="then">${esc(lead)}</p>` : ''}
<div class="rs-ctas" data-ci="then">${P.button({ label: c.primary.label, href: list.length ? '#coffee' : c.primary.href, kind: 'anchor' }, 'btn btn-primary btn-lg')}${sub ? `<a class="rs-tx" href="#subscribe">${esc(sub.name)}</a>` : ''}</div>
${priceLine || wk.ship.length ? `<p class="rs-fine" data-ci="then">${[priceLine, wk.ship.length ? `Ships ${wk.ship.map((d) => DAYS[d]).join(' and ')}` : ''].filter(Boolean).map(esc).join('<span aria-hidden="true"> / </span>')}</p>` : ''}
</div>
</div>
</section>`;

  // The week, set like a timetable: the roast days stamped, the ship days marked. Only when the member said them.
  const weekSec = wk.roast.length
    ? `<section class="rs-week" aria-labelledby="week-title"><div class="wrap rs-week-in">
<h2 class="rs-h2 rs-week-h" id="week-title">The roasting week</h2>
<ol class="rs-days">${DAYS.map((d, i) => {
      const ro = wk.roast.includes(i), sh = wk.ship.includes(i);
      return `<li class="${ro ? 'ro' : ''}${sh ? ' sh' : ''}"><span class="rs-dn"><abbr title="${d}">${d.slice(0, 3)}</abbr></span><span class="rs-dm">${ro ? 'Roast' : sh ? 'Ship' : ''}</span></li>`;
    }).join('')}</ol>
${c.hours && c.hours.rows && c.hours.rows.length && !c.online ? '' : ''}
</div></section>`
    : '';

  // The origin cards: each dealt onto the counter as it comes up the screen.
  const roastRule = (lvl) => (lvl == null ? '' : `<div class="rs-rule" role="img" aria-label="Roast: ${LEVELS[lvl].k.toLowerCase()}"><span class="rs-rule-bar">${LEVELS.map((L, i) => `<i style="background:${L.c}"${i === lvl ? ' class="on"' : ''}></i>`).join('')}</span><span class="rs-rule-k">${LEVELS[lvl].k} roast</span></div>`);
  const groups = [...new Set(list.map((x) => x.s.category).filter(Boolean))];
  const cards = list.map((x, i) => {
    const facts = [
      x.process && ['Process', x.process],
      x.alt && ['Grown at', x.alt],
      x.weight && ['Bag', x.weight],
    ].filter(Boolean);
    const plain = !x.origin && !x.process && !x.alt && x.level == null;
    return `<li class="rs-card${plain ? ' plain' : ''}" id="coffee-${i + 1}" data-sc style="--r:${[-1.6, 1.2, -0.7, 1.7, -1.2, 0.8, -1.8, 1][i % 8]}deg;--dir:${i % 2 ? -1 : 1}"><article class="rs-card-in" data-sc-part>
<p class="rs-c-o">${esc(x.origin || x.s.category || (coffee ? 'Coffee' : c.name))}${x.blend && x.origin ? '<span>Blend</span>' : ''}</p>
<h3 class="rs-c-n">${esc(x.s.name)}</h3>
${x.notes ? `<p class="rs-c-notes">${esc(x.notes)}</p>` : ''}
${facts.length ? `<dl class="rs-c-f">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>` : ''}
${roastRule(x.level)}
<div class="rs-c-buy">${x.s.priceText ? `<p class="rs-c-p">${esc(x.s.priceText)}</p>` : ''}${c.buy ? `<a class="rs-c-a" href="${esc(buyHref)}"${rel(buyHref)}>Buy<span class="sr-only"> ${esc(x.s.name)}</span>${icon('arrowUpRight', { size: 16 })}</a>` : `<a class="rs-c-a" href="#order">Ask to order<span class="sr-only"> ${esc(x.s.name)}</span></a>`}</div>
</article></li>`;
  });
  const origins = list.length
    ? `<section class="rs-origins" id="coffee" aria-labelledby="coffee-title"><div class="wrap">
<div class="rs-oh"><h2 class="rs-h2" id="coffee-title">${coffee ? (groups.length === 1 ? esc(groups[0]) : 'On the bar now') : 'The shop'}</h2>${coffee ? `<p>${esc([`${list.length} ${list.length === 1 ? 'coffee' : 'coffees'}`, /whole bean/i.test(`${c.what} ${c.included.join(' ')}`) ? 'whole bean' : '', dayList ? `roasted ${dayList.toLowerCase().replace(/(^|\s)(\w)/g, (a, b2, l) => `${b2}${l.toUpperCase()}`)}` : ''].filter(Boolean).join(', '))}</p>` : ''}</div>
<ol class="rs-cards">${cards.join('\n')}</ol>
</div></section>`
    : '';

  // The roast ladder: light to dark, each coffee against its step; each bean roasts from green as you reach it.
  const lad = list.filter((x) => x.level != null);
  const ladder = lad.length >= 2
    ? `<section class="rs-roast" aria-labelledby="roast-title" data-sc><div class="wrap">
<h2 class="rs-h2" id="roast-title">Light to dark</h2>
<ol class="rs-ladder">${LEVELS.map((L, i) => {
      const here = lad.filter((x) => x.level === i);
      return `<li class="rs-step${here.length ? ' has' : ''}" style="--rc:${L.c}" data-sc-part><span class="rs-beans" aria-hidden="true">${bean(GREEN, 'rs-bn g')}${bean(L.c, 'rs-bn r')}</span><span class="rs-step-k">${L.k}</span>${here.length ? `<span class="rs-step-n">${here.map((x) => `<a href="#coffee-${list.indexOf(x) + 1}">${esc(x.s.name)}</a>`).join('')}</span>` : ''}</li>`;
    }).join('')}</ol>
</div></section>`
    : '';

  // The subscription: its rhythm drawn as weeks (only the rhythm the member wrote), price and terms as written.
  let subSec = '';
  if (sub) {
    const d = String(sub.description || '');
    const m2 = d.match(/every\s+(\d+)(?:\s*(?:or|,|to)\s*(\d+))?\s*weeks?/i);
    const ns = m2 ? [m2[1], m2[2]].filter(Boolean).map(Number).filter((n) => n > 0 && n <= 8) : /\bmonthly|every month\b/i.test(d) ? [4] : [];
    const N = 12;
    const rhythm = ns.length
      ? `<div class="rs-rhythm">${ns.map((n) => `<div class="rs-rh-row"><p class="rs-rh-k">${/\bmonthly|every month\b/i.test(d) && !m2 ? 'Monthly' : `Every ${n} weeks`}</p><ol class="rs-rh-w" aria-label="${N} weeks, a bag ${/\bmonthly|every month\b/i.test(d) && !m2 ? 'about every month' : `every ${n} weeks`}">${Array.from({ length: N }, (_, j) => `<li${(j + 1) % n === 0 ? ' class="b"' : ''}>${(j + 1) % n === 0 ? bean(LEVELS[2].c, 'rs-bn') : ''}</li>`).join('')}</ol></div>`).join('')}<p class="rs-rh-scale" aria-hidden="true"><span>Week 1</span><span>Week ${N}</span></p></div>`
      : '';
    const href = (subLink && subLink.href) || buyHref;
    subSec = `<section class="rs-sub" id="subscribe" aria-labelledby="sub-title"><div class="wrap rs-sub-grid">
<div class="rs-sub-copy"><h2 class="rs-h2" id="sub-title">${esc(sub.name)}</h2>${sub.priceText ? `<p class="rs-sub-p">${esc(sub.priceText)}<small>${/\bbag/i.test(d) ? ' a bag' : ''}</small></p>` : ''}${d ? `<p class="rs-sub-d">${esc(d.replace(/^./, (x) => x.toUpperCase()).replace(/\.?$/, '.'))}</p>` : ''}
<p>${P.button({ label: subLink ? subLink.label : 'Subscribe', href, kind: 'link' }, 'btn btn-primary')}</p></div>
${rhythm}
</div></section>`;
  }

  // The roastery: the drum roaster drawn, the roaster's own first sentence pulled out, the rest under it; the visit.
  const paras = c.aboutParas.slice();
  const firstS = paras.length ? paras[0].split(/(?<=[.!?])\s+/) : [];
  const pull = firstS.length > 1 && firstS[0].length < 160 ? firstS.shift() : '';
  if (pull) paras[0] = firstS.join(' ');
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const visit = !c.online && (c.address || (c.hours && c.hours.rows && c.hours.rows.length))
    ? `<div class="rs-visit"><h3 class="rs-visit-h">Come by the roastery</h3>${c.address ? `<p class="rs-addr">${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)}</p>` : ''}${P.hours(c.hours && c.hours.rows, 'rs-hours')}</div>`
    : '';
  const about = `<section class="rs-about" id="roastery" aria-labelledby="about-title">
<figure class="rs-room">${P.img(c, 'roaster', { cls: 'rs-room-img', sizes: '(min-width: 60rem) 60vw, 100vw' }).replace('<img ', '<img data-par="0.06" ')}</figure>
<div class="wrap rs-about-grid">
<h2 class="rs-pull" id="about-title">${esc(pull || (coffee ? `About ${c.name}` : `About ${c.name}`))}</h2>
<div class="rs-about-copy">${paras.filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('\n')}${person ? `<p class="rs-sig">${esc(person)}, ${esc(c.name)}</p>` : ''}</div>
${visit}
</div>
</section>`;

  // The back of the bag: shipping, returns, questions and what is on every bag, ruled like a printed back label.
  const backRows = [
    c.shipping && ['Shipping', esc(c.shipping)],
    c.returns && ['Returns', esc(c.returns)],
    (c.email || c.phone) && ['Questions', [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('<br>')],
  ].filter(Boolean);
  const onBag = c.included.filter((l) => !(wk.roast.length && DAY_RE.test(l) && /roast|ship/i.test(l)));
  DAY_RE.lastIndex = 0;
  const back = c.shipping || c.returns || onBag.length
    ? `<section class="rs-back" id="shipping" aria-labelledby="back-title"><div class="wrap">
<div class="rs-label">
<h2 class="rs-h2" id="back-title">${c.shipping || c.returns ? 'Shipping and returns' : 'Good to know'}</h2>
${backRows.length ? `<dl class="rs-back-dl">${backRows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>` : ''}
${onBag.length ? `<div class="rs-every"><h3>${coffee ? 'On every bag' : 'Good to know'}</h3><ul>${onBag.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
${c.buy && (c.shipping || c.returns) ? '<p class="rs-pol"><a href="policies.html">Full shipping and returns policy</a></p>' : ''}
</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="rs-kind" aria-labelledby="reviews-title"><div class="wrap"><h2 class="rs-h2" id="reviews-title">From the cups</h2><div class="rs-quotes">${c.reviews.map((rv) => `<figure class="rs-q"><blockquote><p>${esc(rv.quote)}</p></blockquote>${rv.name ? `<figcaption>${esc(rv.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const qs = c.faq.filter((q) => !(c.shipping || c.returns) || !/\b(ship|shipping|deliver|send it back|return|refund)/i.test(q.q));
  const faq = qs.length >= 2 ? `<section class="rs-faq" aria-labelledby="faq-title"><div class="wrap"><h2 class="rs-h2" id="faq-title">Questions</h2>${P.faq(qs)}</div></section>` : '';
  const orderSec = c.buy
    ? ''
    : `<section class="rs-order" id="order" aria-labelledby="order-title"><div class="wrap rs-order-grid"><h2 class="rs-h2" id="order-title">${coffee ? 'Ask for a bag' : 'Ask to order'}</h2><div class="rs-slip">${P.form(c, { id: 'order', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: coffee ? 'Which coffee, how many bags, and where it goes' : 'What you would like, and where it goes' }], submit: 'Send my order', subject: `Order request for ${c.name}` })}</div></div></section>`;

  const bar = `<nav class="mbar rs-bar" aria-label="Shop ${esc(c.name)}"><div class="rs-bar-t"><strong>${esc(c.name)}</strong>${priceLine ? `<span>${esc(priceLine)}</span>` : ''}</div>${P.button(list.length ? { label: c.primary.label, href: '#coffee', kind: 'anchor' } : c.primary, 'btn btn-primary')}</nav>`;

  // The footer is the bag's bottom gusset: the name across it, where it's roasted, how to reach the roaster.
  const reach = [
    c.email && `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`,
    c.phone && `<li><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></li>`,
    c.buy && `<li><a href="${esc(c.buy.href)}"${rel(c.buy.href)}>Shop online</a></li>`,
  ].filter(Boolean).join('');
  const footer = `<footer class="rs-ftr"><div class="wrap">
<p class="rs-ftr-n">${esc(c.name)}</p>
<div class="rs-ftr-row">${!c.online && (c.address || c.city) ? `<p class="rs-ftr-at">${coffee ? 'Roasted at ' : ''}${esc(c.address || c.city)}</p>` : ''}${reach ? `<ul class="rs-ftr-l">${reach}</ul>` : ''}${P.socials(c, { cls: 'rs-soc', size: 18 })}</div>
<p class="rs-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div></footer>`;

  const m = motion();
  const body = [BEAN, '<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'rs-hdr', ctaCls: 'btn btn-primary btn-sm', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, origins, ladder, weekSec, subSec, about, back, reviews, faq, orderSec, '</main>', footer, bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '84rem' } };
}

// The page's own script: the stamp takes the date of the last roast day. With JavaScript off it reads
// "Roasted Tuesdays".
const JS = `(function(){var d=document,st=d.querySelector('.rs-stamp');if(st){var ds=(st.getAttribute('data-days')||'').split(',').map(Number),t=new Date(),k=0;for(;k<7;k++){var x=new Date(t.getFullYear(),t.getMonth(),t.getDate()-k);if(ds.indexOf((x.getDay()+6)%7)>=0){st.querySelector('.rs-stamp-d').textContent=x.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});break}}}
})();`;

const CSS = `
@font-face{font-family:'Roastery Display Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Liberation Serif'),local('LiberationSerif');size-adjust:121.1%;ascent-override:86.7%;descent-override:30.6%;line-gap-override:0%}
@font-face{font-family:'Roastery Body Fallback';font-weight:400 500;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:103%;ascent-override:92.2%;descent-override:24.3%;line-gap-override:0%}
@font-face{font-family:'Roastery Body Fallback';font-weight:600 700;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:98.3%;ascent-override:96.7%;descent-override:25.4%;line-gap-override:0%}
html:root{--muted:color-mix(in srgb,var(--ink) 66%,var(--bg));--font-display:"Young Serif","Roastery Display Fallback",Georgia,serif;--font-body:"Albert Sans","Roastery Body Fallback",system-ui,sans-serif;--ease:cubic-bezier(.16,1,.3,1);--rs-rule:color-mix(in srgb,var(--ink) 16%,transparent);--rs-card:color-mix(in srgb,var(--bg) 35%,#fffdf8);--rs-card-ink:var(--ink);--rs-shadow:0 1px 0 rgba(60,40,20,.06),0 18px 34px -22px rgba(60,38,18,.55);--rs-ink:color-mix(in srgb,var(--primary-text) 82%,var(--ink));--rs-kraft:#c9a476;--rs-on-kraft:#2a1b10}
html[data-theme="dark"]{--rs-rule:color-mix(in srgb,var(--ink) 18%,transparent);--rs-card:#231a14;--rs-shadow:inset 0 1px 0 rgba(255,236,210,.07),0 22px 40px -24px rgba(0,0,0,.9);--rs-kraft:#3a2b1e;--rs-on-kraft:#f1e3cc}
body{background:var(--bg);font-feature-settings:"kern"}
.rs-defs{position:absolute;width:0;height:0;overflow:hidden}
h1,h2,h3{font-family:var(--font-display);font-weight:400;letter-spacing:-.015em}
.btn{font-weight:600;box-shadow:none;letter-spacing:.01em}
.btn:hover{transform:none}
.btn-sm{min-height:2.5rem;padding:.45rem 1rem;font-size:.9rem}
a{text-underline-offset:.2em}
main a:not(.btn):hover{text-decoration-color:var(--primary-text)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rs-rule)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:3.75rem}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
@media (min-width:60rem){.menu{display:none}}
.brand{margin-right:auto;font-family:var(--font-display);font-size:clamp(1.02rem,.8rem + 1vw,1.25rem);letter-spacing:-.01em;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nav ul{display:flex;gap:1.5rem}
.nav a{text-decoration:none;font-weight:500}
.mode-tg{border-radius:2px;border-color:var(--rs-rule)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
.menu>summary{border-radius:2px;border-color:var(--rs-rule)}

/* hero: the photo full bleed on phones, the headline under it on the page; on wide screens side by side */
.rs-hero{padding-bottom:clamp(2.5rem,1.5rem + 4vw,5.5rem)}
.rs-hero-grid{display:grid;position:relative}
.rs-shot{margin:0;position:relative;overflow:hidden;background:#120d0a}
.rs-par{height:100%}
.rs-shot-img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
/* the light sweeping once across the bag after the focus pull */
.rs-shot::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,232,196,.2) 50%,transparent 62%);mix-blend-mode:soft-light;opacity:0}
html.m .rs-shot::after{animation:rsSweep 3.4s 1.5s cubic-bezier(.45,0,.2,1) both}
@keyframes rsSweep{from{transform:translateX(-70%);opacity:1}to{transform:translateX(70%);opacity:0}}
.rs-tag{position:relative;z-index:4;justify-self:start;margin:-3.6rem 0 0 1rem;rotate:-3deg}
.rs-tag-in{background:var(--rs-card);color:var(--rs-card-ink);padding:.85rem 1.1rem .9rem 1.6rem;min-width:13.5rem;max-width:16rem;box-shadow:var(--rs-shadow);position:relative}
.rs-tag-in::before{content:"";position:absolute;left:.55rem;top:50%;width:.5rem;height:.5rem;margin-top:-.25rem;border-radius:50%;background:var(--bg);box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}
.rs-stamp{margin:0 0 .45rem;display:inline-block;padding:.3rem .55rem .25rem;border:2px solid var(--rs-ink);color:var(--rs-ink);font-weight:700;font-size:.82rem;letter-spacing:.09em;text-transform:uppercase;line-height:1.2;rotate:-4deg;transform-origin:left center;mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 2.3'/%3E%3C/filter%3E%3Crect width='90' height='90' filter='url(%23n)'/%3E%3C/svg%3E");-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 2.3'/%3E%3C/filter%3E%3Crect width='90' height='90' filter='url(%23n)'/%3E%3C/svg%3E")}
.rs-ftr .mpause{opacity:1}
.rs-tag-n{margin:0;font-family:var(--font-display);font-size:1.3rem;line-height:1.1}
.rs-tag-o{margin:.2rem 0 0;font-size:.85rem;color:var(--muted)}
html[data-theme="dark"] .rs-tag-o{color:color-mix(in srgb,var(--ink) 72%,var(--rs-card))}
.rs-hero-copy{padding:2rem 1rem 0;max-width:46rem}
.rs-title{font-size:var(--km);line-height:.98;letter-spacing:-.03em;margin:0;text-wrap:balance}
.rs-lead{margin:1.25rem 0 0;font-size:1.08rem;line-height:1.5;max-width:34rem;color:var(--muted)}
.rs-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:1.75rem}
.rs-tx{font-weight:600;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.3em}
.rs-fine{margin:1.25rem 0 0;font-size:.92rem;color:var(--muted);font-variant-numeric:tabular-nums}
@media (min-width:60rem){
.rs-hero-grid{grid-template-columns:minmax(0,1fr) 50vw;grid-template-rows:1fr auto;height:calc(100svh - 3.75rem);min-height:40rem;max-height:64rem;align-items:end}
.rs-shot{grid-column:2;grid-row:1/3;height:100%;align-self:stretch}
.rs-shot-img{height:100%;aspect-ratio:auto}
.rs-hero-copy{grid-column:1;grid-row:1;align-self:end;padding:3rem 3rem 0 max(2rem,(100vw - 84rem)/2 + 2rem);max-width:none}
.rs-title{font-size:var(--k)}
.rs-tag{grid-column:1/3;grid-row:2;justify-self:end;margin:0 calc(50vw - 7rem) 2.5rem 0;align-self:end}
}

.rs-h2{font-size:clamp(2.1rem,1.4rem + 3.2vw,4rem);line-height:1;letter-spacing:-.025em;margin:0}

/* origin cards: real cards, each dealt from the side as it comes up */
.rs-origins{padding-block:clamp(3rem,2rem + 4vw,6rem)}
.rs-oh{display:grid;gap:.6rem;margin-bottom:2.25rem}
.rs-oh p{margin:0;color:var(--muted);font-size:1rem}
.rs-cards{list-style:none;margin:0;padding:0;display:grid;gap:1.4rem}
.rs-card{transform:rotate(var(--r))}
.rs-card-in{background:var(--rs-card);color:var(--rs-card-ink);box-shadow:var(--rs-shadow);padding:1.3rem 1.25rem 1.2rem;display:grid;gap:.85rem;position:relative}
.rs-card-in::after{content:"";position:absolute;inset:.45rem;border:1px solid var(--rs-rule);pointer-events:none}
html.m .rs-card[data-sc] .rs-card-in{transform:translate3d(calc((1 - var(--pi,1)) * 105% * var(--dir)),calc((1 - var(--pi,1)) * 1.5rem),0) rotate(calc((1 - var(--pi,1)) * 9deg * var(--dir)))}
.rs-c-o{margin:0;display:flex;justify-content:space-between;gap:1rem;font-size:.8rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
html[data-theme="dark"] .rs-c-o{color:color-mix(in srgb,var(--ink) 70%,var(--rs-card))}
.rs-c-o span{font-weight:600;letter-spacing:.08em}
.rs-c-n{margin:0;font-size:clamp(2rem,1.5rem + 2vw,2.7rem);line-height:1;letter-spacing:-.025em}
.rs-c-notes{margin:0;font-size:1.06rem;line-height:1.45}
.rs-c-f{margin:0;display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:.2rem 1.6rem;border-top:1px solid var(--rs-rule);padding-top:.75rem}
.rs-c-f div{display:grid;gap:.1rem}
.rs-c-f dt{font-size:.78rem;color:var(--muted)}
html[data-theme="dark"] .rs-c-f dt{color:color-mix(in srgb,var(--ink) 70%,var(--rs-card))}
.rs-c-f dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.rs-rule{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:.8rem;font-size:.85rem}
.rs-rule-bar{display:grid;grid-template-columns:repeat(5,1.6rem);gap:3px}
.rs-rule-bar i{height:.55rem;opacity:.35}
.rs-rule-bar i.on{opacity:1;box-shadow:0 0 0 2px var(--rs-card),0 0 0 3.5px var(--primary-text)}
.rs-c-buy{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;border-top:1px solid var(--rs-rule);padding-top:.8rem}
.rs-c-p{margin:0;font-family:var(--font-display);font-size:1.6rem;font-variant-numeric:tabular-nums}
.rs-c-a{display:inline-flex;align-items:center;gap:.3rem;font-weight:700;text-decoration:none;min-height:2.75rem}
.rs-c-a:hover{text-decoration:underline;text-decoration-color:var(--primary-text)}
@media (min-width:48rem){.rs-cards{grid-template-columns:1fr 1fr;gap:2rem 2.5rem}.rs-card:nth-child(even){margin-top:4rem}.rs-card-in{padding:1.75rem 1.75rem 1.5rem}}
@media (min-width:72rem){.rs-cards{grid-template-columns:repeat(3,1fr)}.rs-card:nth-child(even){margin-top:0}.rs-card:nth-child(3n+2){margin-top:3.5rem}.rs-card:nth-child(3n){margin-top:1.5rem}}

/* the roast ladder */
.rs-roast{padding-block:clamp(2.5rem,1.5rem + 3vw,5rem);border-top:1px solid var(--rs-rule)}
.rs-ladder{list-style:none;margin:2rem 0 0;padding:0;display:grid}
.rs-step{display:grid;grid-template-columns:3.4rem 1fr;grid-template-rows:auto auto;column-gap:1rem;align-items:center;padding:.9rem 0;border-bottom:1px solid var(--rs-rule)}
.rs-beans{grid-row:1/3;position:relative;width:3.4rem;height:2.4rem}
.rs-bn{width:100%;height:100%;display:block}
.rs-beans .rs-bn{position:absolute;inset:0}
.rs-step-k{font-weight:600}
.rs-step:not(.has) .rs-step-k{color:var(--muted)}
.rs-step-n{display:flex;flex-wrap:wrap;gap:.1rem 1rem;font-family:var(--font-display);font-size:1.25rem}
.rs-step-n a{text-decoration:none}
.rs-step-n a:hover{text-decoration:underline;text-decoration-color:var(--primary-text)}
html.m .rs-roast[data-sc] .rs-bn.r{opacity:var(--pi,1)}
@media (min-width:60rem){.rs-ladder{grid-template-columns:repeat(5,1fr);border-top:1px solid var(--rs-rule)}.rs-step{grid-template-columns:1fr;grid-template-rows:auto;align-content:start;gap:.5rem;padding:1.5rem 1.25rem 1.75rem 0;border-bottom:0}.rs-step+.rs-step{border-left:1px solid var(--rs-rule);padding-left:1.25rem}.rs-beans{grid-row:auto;width:4.4rem;height:3.1rem}.rs-step-n{flex-direction:column}}

/* the week */
.rs-week{padding-block:clamp(2.5rem,1.5rem + 3vw,4.5rem);background:var(--rs-kraft);color:var(--rs-on-kraft)}
.rs-week-in{display:grid;gap:1.5rem}
.rs-week-h{font-size:clamp(1.8rem,1.3rem + 2vw,3rem)}
.rs-days{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);border-top:2px solid currentColor}
.rs-days li{display:grid;gap:.6rem;padding:.6rem 0 .2rem;text-align:center;border-right:1px solid color-mix(in srgb,currentColor 25%,transparent)}
.rs-days li:last-child{border-right:0}
.rs-dn abbr{text-decoration:none;font-weight:700;font-size:.85rem;letter-spacing:.06em;text-transform:uppercase}
.rs-dm{min-height:2.2rem;display:grid;place-items:center;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.rs-days .ro .rs-dm{border:2px solid currentColor;margin-inline:.2rem;rotate:-6deg}
.rs-days .sh .rs-dm{text-decoration:underline;text-underline-offset:.3em}
@media (min-width:48rem){.rs-week-in{grid-template-columns:1fr 2fr;align-items:end}.rs-dm{font-size:.85rem;min-height:3rem}}

/* subscription */
.rs-sub{padding-block:clamp(3rem,2rem + 4vw,6rem)}
.rs-sub-grid{display:grid;gap:2.5rem}
.rs-sub-p{margin:1.25rem 0 0;font-family:var(--font-display);font-size:clamp(3rem,2rem + 5vw,5.5rem);line-height:1;font-variant-numeric:tabular-nums}
.rs-sub-p small{font-family:var(--font-body);font-size:1rem;color:var(--muted);margin-left:.4rem}
.rs-sub-d{font-size:1.1rem;line-height:1.5;max-width:30rem}
.rs-rhythm{display:grid;gap:1.25rem;align-content:start}
.rs-rh-k{margin:0 0 .5rem;font-weight:700}
.rs-rh-w{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(12,1fr);border-top:1px solid var(--rs-rule);border-bottom:1px solid var(--rs-rule)}
.rs-rh-w li{height:2.6rem;display:grid;place-items:center;border-right:1px solid var(--rs-rule)}
.rs-rh-w li:last-child{border-right:0}
.rs-rh-w .rs-bn{width:70%;height:auto;aspect-ratio:40/28}
.rs-rh-scale{display:flex;justify-content:space-between;margin:0;font-size:.82rem;color:var(--muted)}
@media (min-width:60rem){.rs-sub-grid{grid-template-columns:5fr 6fr;gap:4rem;align-items:center}.rs-rh-w li{height:3.4rem}}

/* the roastery */
.rs-about{padding-bottom:clamp(3rem,2rem + 4vw,6rem)}
.rs-room{margin:0 0 2.5rem;overflow:hidden;background:#120d0a}
.rs-room-img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;scale:1.08}
.rs-about-grid{display:grid;gap:1.75rem}
.rs-pull{margin:0;font-size:clamp(1.9rem,1.3rem + 2.6vw,3.4rem);line-height:1.05;letter-spacing:-.02em;max-width:22ch}
.rs-about-copy p{margin:0 0 1rem;font-size:1.06rem;line-height:1.6;max-width:36rem}
.rs-sig{font-weight:600}
.rs-visit{border-top:2px solid var(--ink);padding-top:1rem}
.rs-visit-h{margin:0 0 .5rem;font-size:1.5rem}
.rs-addr{margin:0 0 .75rem}
.rs-hours{margin:0;display:grid;gap:.25rem}
.rs-hours div{display:flex;justify-content:space-between;gap:1rem;border-bottom:1px dotted var(--rs-rule);padding:.3rem 0;font-variant-numeric:tabular-nums}
.rs-hours dt{font-weight:600}.rs-hours dd{margin:0}
@media (min-width:60rem){.rs-room{width:min(100%,84rem);margin-inline:auto}.rs-about-grid{grid-template-columns:6fr 5fr;column-gap:4rem}.rs-pull{grid-column:1/3}.rs-visit{grid-column:2;grid-row:2/4;align-self:start}}

/* the back of the bag */
.rs-back{padding-block:clamp(2.5rem,1.5rem + 3vw,5rem)}
.rs-label{border:2px solid var(--ink);padding:1.5rem 1.25rem;display:grid;gap:1.5rem;max-width:60rem}
.rs-label .rs-h2{font-size:clamp(1.8rem,1.3rem + 2vw,2.8rem)}
.rs-back-dl{margin:0;display:grid}
.rs-back-dl div{display:grid;gap:.25rem;padding:.9rem 0;border-top:1px solid var(--rs-rule)}
.rs-back-dl dt{font-weight:700;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase}
.rs-back-dl dd{margin:0;line-height:1.55;max-width:40rem}
.rs-every h3{margin:0 0 .6rem;font-size:1.3rem}
.rs-every ul{margin:0;padding:0;list-style:none;display:grid;gap:.4rem}
.rs-every li{padding-left:1.4rem;position:relative}
.rs-every li::before{content:"";position:absolute;left:0;top:.65em;width:.7rem;height:1px;background:currentColor}
.rs-pol{margin:0}
@media (min-width:48rem){.rs-label{padding:2rem 2.25rem;grid-template-columns:1fr 1fr;column-gap:3rem}.rs-label .rs-h2{grid-column:1/3}.rs-back-dl div{grid-template-columns:8rem 1fr;gap:1rem}.rs-back-dl{grid-column:1/3}.rs-pol{grid-column:1/3}}

.rs-kind,.rs-faq,.rs-order{padding-block:clamp(2.5rem,1.5rem + 3vw,5rem);border-top:1px solid var(--rs-rule)}
.rs-quotes{display:grid;gap:2rem;margin-top:2rem}
.rs-q{margin:0}.rs-q blockquote{margin:0;font-family:var(--font-display);font-size:1.4rem;line-height:1.3}.rs-q figcaption{margin-top:.6rem;color:var(--muted)}
@media (min-width:48rem){.rs-quotes{grid-template-columns:repeat(2,1fr)}}
.rs-faq .faq{margin-top:1.5rem;max-width:48rem}
.rs-order-grid{display:grid;gap:2rem}
.rs-slip{background:var(--rs-card);box-shadow:var(--rs-shadow);padding:1.5rem}
@media (min-width:60rem){.rs-order-grid{grid-template-columns:1fr 1.2fr}}

/* footer: the bottom gusset */
.rs-ftr{background:var(--rs-kraft);color:var(--rs-on-kraft);padding-block:clamp(2.5rem,1.5rem + 3vw,4.5rem) calc(5.5rem + env(safe-area-inset-bottom,0px))}
@media (min-width:60rem){.rs-ftr{padding-bottom:2.5rem}}
.rs-ftr a{color:inherit}
.rs-ftr-n{margin:0;font-family:var(--font-display);font-size:clamp(2.6rem,1rem + 8vw,8rem);line-height:.92;letter-spacing:-.035em;border-bottom:2px solid currentColor;padding-bottom:1rem}
.rs-ftr-row{display:grid;gap:1.25rem;padding-top:1.25rem}
.rs-ftr-at{margin:0;font-weight:600}
.rs-ftr-l{list-style:none;margin:0;padding:0;display:grid;gap:.35rem}
.rs-ftr-l a{display:inline-block;min-height:1.75rem}
.rs-soc{display:flex;gap:.5rem;list-style:none;margin:0;padding:0}
.rs-soc a{display:inline-grid;place-items:center;width:2.75rem;height:2.75rem;border:1px solid color-mix(in srgb,currentColor 40%,transparent)}
.rs-ftr-c{margin:1.5rem 0 0;font-size:.85rem}
@media (min-width:48rem){.rs-ftr-row{grid-template-columns:1fr 1fr auto;align-items:start}}

/* the phone bar */
.rs-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.6rem 1rem calc(.6rem + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--rs-rule)}
.rs-bar-t{display:grid;line-height:1.2;min-width:0}
.rs-bar-t strong{font-family:var(--font-display);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-bar-t span{font-size:.82rem;color:var(--muted)}
@media (min-width:60rem){.rs-bar{display:none}}
@media (prefers-reduced-motion:reduce){.rs-shot::after{display:none}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Roastery',
  bestFor: 'A coffee roaster selling whole bean bags and a subscription',
  why: 'Built for a coffee roaster: your bag on the counter under the lamp with the roast day stamped on its tag, each coffee as an origin card dealt onto the counter as people scroll, the roast from light to dark, your roasting week and your subscription spelled out.',
  match: /\b(coffee roast\w*|roaster(y|ies)?|roastery|whole bean|single origins?|coffee beans|coffee subscriptions?|specialty coffee|micro-?roaster)\b/,
  fonts: { q: 'family=Young+Serif&family=Albert+Sans:wght@400;500;600;700', display: ['Young Serif', 'serif'], body: ['Albert Sans', 'sans'] },
  modes: ['light', 'dark'],
  // The motion, as data (lib/choreo.md): a focus pull on the bag, then the origin cards dealt as you scroll.
  choreo: { intro: 'develop', alive: ['drift'], scroll: 'scrub', pace: 'calm', look: 'a kraft bag under one lamp, a slow focus pull and a light sweep, origin cards dealt onto walnut' },
  art: roasteryArt,
  tokens,
  slots,
  nav,
  render,
};
