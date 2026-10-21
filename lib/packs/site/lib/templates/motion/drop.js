// Drop (animated, product): for streetwear and apparel labels that sell in drops.
//   Object: the piece. One garment on a hanger under a single hard light in a bare concrete room: the fabric's knit or
//   weave, its seams and ribbing, a crisp shadow thrown on the wall, and one quiet practical light at the edge of the
//   frame. The photo stands at full height in the middle of the page, the way a piece hangs on its own in a store.
//   Material: raw concrete and black steel. Square corners, hairlines, an extra-wide heavy grotesk for the drop's name
//   and the countdown, a mono for every spec (weight, fabric, sizes), set like a hang tag.
//   One move: stamp. The light snaps on (the photo is printed in with a flash) and the drop's name is pressed onto the
//   page word by word, then the countdown to the drop starts and the sizes are stamped in one by one.
//   Scroll moment: the lookbook. Each piece holds on screen at full height while its tag (name, price, colour, fabric,
//   sizes) scrolls past, and the next piece slides up over it.
//   Pop: the countdown's live digit and the current size's edge; links underline in it.
// Then the size chart printed from the member's own measurements, the drop dates as a timetable (the next drop, then the
// past ones with their status as written), the restock list (one email, piece and size), the label's story with the
// drop folded on a plinth, shipping and returns, and a footer that is the label's name across the full width. Dark is
// the room at night, light the same room with the doors open; the photos are the same in both. Its motion is the
// `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const theme = require('../../theme');
const { esc } = require('../shared');

const id = 'drop';
const MAX = 6;

function tokens(p, mode) {
  return mode === 'light'
    ? { bg: color.mix(p.paper, '#e8e7e3', 0.86), dark: '#111112' }
    : { bg: color.mix(p.ink, '#0b0b0c', 0.94), dark: '#000000' };
}

// ---------- the facts a label writes ----------

const pieces = (c) => c.services.filter((s) => s.name).slice(0, MAX);
const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL', 'OS'];
const SIZE_ROW = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|XXXL|OS)\s*[:,]\s*(.+)$/i;
const DROP_ROW = /^drop\s*(\d+)\b[\s,:.-]*([A-Z][a-z]{2,8}\.?\s+\d{1,2}(?:,\s*\d{4})?)?[\s,:.-]*(.*)$/i;
const STATUS_RE = /\b(sold out|restocking|restocked|back in stock|live now|available|coming soon)\b/i;

// "S to XXL" or "S, M, L" in a piece's words -> the run of sizes.
function sizesOf(t) {
  const m = String(t).match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\s*(?:to|-|through)\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\b/i);
  if (m) {
    const run = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const n = (x) => run.indexOf(x.toUpperCase().replace(/^2XL$/, 'XXL'));
    const a = n(m[1]), b = n(m[2]);
    if (a >= 0 && b > a) return run.slice(a, b + 1);
  }
  if (/\bone size\b|\bOS\b/.test(t)) return ['One size'];
  return [];
}

// The member's measurements, one size a line ("M: chest 23.5 in, length 28 in"), as a chart.
function chartOf(c) {
  const rows = [];
  for (const l of c.included) {
    const m = l.match(SIZE_ROW);
    if (!m) continue;
    const cells = {};
    for (const part of m[2].split(/,\s*|;\s*/)) {
      const q = part.match(/^([a-z][a-z ]{1,20}?)\s+(\d+(?:\.\d+)?)\s*(in|cm|")?$/i) || part.match(/^(\d+(?:\.\d+)?)\s*(in|cm|")?\s+([a-z][a-z ]{1,20})$/i);
      if (!q) continue;
      const [k, v, u] = /^\d/.test(q[1]) ? [q[3], q[1], q[2]] : [q[1], q[2], q[3]];
      cells[k.trim().toLowerCase()] = { v, u: (u || '').replace('"', 'in') };
    }
    if (Object.keys(cells).length) rows.push({ size: m[1].toUpperCase(), cells });
  }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r.cells)))];
  const unit = (rows.flatMap((r) => Object.values(r.cells)).find((x) => x.u) || {}).u || '';
  const notes = c.included.filter((l) => /\b(fit|size (up|down)|runs (small|large|big|true))\b/i.test(l) && !SIZE_ROW.test(l));
  return rows.length >= 2 ? { rows, cols, unit, notes } : { rows: [], cols: [], unit, notes };
}

// The drops the member listed ("Drop 03, Aug 22: Summer Static, sold out").
function dropsOf(c) {
  return c.included.map((l) => {
    const m = l.match(DROP_ROW);
    if (!m) return null;
    const st = (m[3] || '').match(STATUS_RE);
    const name = (m[3] || '').replace(STATUS_RE, '').replace(/^[\s,:.-]+|[\s,:.-]+$/g, '');
    return { n: m[1].padStart(2, '0'), date: (m[2] || '').trim(), name, status: st ? st[1].toLowerCase() : '' };
  }).filter(Boolean);
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const TZ = { pt: [-8, -7], pst: [-8, -8], pdt: [-7, -7], mt: [-7, -6], mst: [-7, -7], mdt: [-6, -6], ct: [-6, -5], cst: [-6, -6], cdt: [-5, -5], et: [-5, -4], est: [-5, -5], edt: [-4, -4], utc: [0, 0], gmt: [0, 0] };

// US daylight time: second Sunday of March to first Sunday of November.
function usDst(y, mo, d) {
  const sun = (m, n) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); };
  const a = Date.UTC(y, 2, sun(2, 2)), b = Date.UTC(y, 10, sun(10, 1)), t = Date.UTC(y, mo, d);
  return t >= a && t < b;
}

// "Saturday, Nov 14, 11am PT" -> an instant, for the countdown. Null when the words don't name a day.
function whenOf(text, today) {
  const s = String(text || '');
  const md = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
  if (!md) return null;
  const mo = MON[md[1].toLowerCase()], d = +md[2];
  const t0 = String(today || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y = md[3] ? +md[3] : t0 ? +t0[1] : new Date().getFullYear();
  if (!md[3] && t0 && Date.UTC(y, mo, d) < Date.UTC(+t0[1], +t0[2] - 1, +t0[3])) y += 1;
  const tm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || s.match(/\b(noon|midnight)\b/i);
  let hh = 0, mm = 0;
  if (tm && /noon/i.test(tm[1])) hh = 12;
  else if (tm && /midnight/i.test(tm[1])) hh = 0;
  else if (tm) { hh = (+tm[1] % 12) + (/pm/i.test(tm[3]) ? 12 : 0); mm = +(tm[2] || 0); }
  const z = s.match(/\b(PT|PST|PDT|MT|MST|MDT|CT|CST|CDT|ET|EST|EDT|UTC|GMT)\b/);
  const pad = (n) => String(n).padStart(2, '0');
  if (!z) return { iso: `${y}-${pad(mo + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`, local: true };
  const off = TZ[z[1].toLowerCase()][usDst(y, mo, d) ? 1 : 0];
  return { iso: new Date(Date.UTC(y, mo, d, hh - off, mm)).toISOString().replace('.000', ''), local: false };
}

// ---------- the drawings ----------

const f1 = (n) => (Math.round(n * 10) / 10).toString();
const SHADES = [['washed black', '#2a2a2c'], ['black', '#1d1d1f'], ['charcoal', '#38393b'], ['heather grey', '#8b8c8e'], ['heather gray', '#8b8c8e'], ['grey', '#7d7f82'], ['gray', '#7d7f82'], ['bone', '#ddd4c2'], ['cream', '#e6dcc6'], ['ecru', '#ddd3bd'], ['off white', '#e9e5dc'], ['white', '#eceae6'], ['olive', '#5b5c3b'], ['khaki', '#9a8c64'], ['sand', '#c2ab84'], ['tan', '#b39470'], ['brown', '#5b4030'], ['navy', '#20283c'], ['blue', '#35507c'], ['green', '#2f4a39'], ['forest', '#29402f'], ['red', '#8a2b26'], ['burgundy', '#5b1f24'], ['maroon', '#5b1f24'], ['pink', '#d29fa6'], ['purple', '#4b3a5e'], ['orange', '#c4622d'], ['yellow', '#d1a93a']];
const DEFAULT_SHADES = ['#232325', '#ddd4c2', '#8b8c8e', '#5b5c3b', '#20283c', '#5b4030'];

function kindOf(t) {
  if (/\bhood(ie|y|ed)?\b|\bzip[- ]?up\b/.test(t)) return 'hoodie';
  if (/\bcrew ?neck|sweat ?shirt|\bfleece\b/.test(t)) return 'crew';
  if (/\bjacket|coat|shell|windbreaker|bomber|overshirt|shacket\b/.test(t)) return 'jacket';
  if (/\blong ?sleeve|\bl\/s\b/.test(t)) return 'longsleeve';
  if (/\btees?\b|t-?shirts?|\bshirts?\b|\btank\b|\bjersey\b/.test(t)) return 'tee';
  if (/\bcaps?\b|\bhats?\b|beanie|snapback/.test(t)) return 'cap';
  return 'tote';
}
const pieceText = (s, c) => `${s ? `${s.name} ${s.description || ''}` : ''} ${s ? '' : c.what || ''}`.toLowerCase();
const shadeOf = (t, i) => (SHADES.find(([k]) => new RegExp(`\\b${k}\\b`).test(t)) || [0, DEFAULT_SHADES[i % DEFAULT_SHADES.length]])[1];

// One piece on its hanger under a hard light (hero and each lookbook slot), or the drop folded on a plinth. Built from
// light and fabric: a lit knit from a bump, drape shading down from the shoulders, ribbing and seams as fine relief, a
// crisp cast shadow on the concrete, and one thin practical light at the frame's edge in the member's neon.
function dropArt(s, ctx) {
  const ph = ctx.art.photo('drop', s.slot);
  if (ph) return ph;
  if (!/^(hero|p\d+|folded)$/.test(s.slot)) return null;
  const { p, c, seed, art } = ctx;
  const { w, h } = s;
  const m = Math.min(w, h);
  const r = art.rng(`${seed}:dp:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const mix = color.mix;
  const P2 = (x, y) => `${f1(x)} ${f1(y)}`;
  const F = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
  const S = (d, col, wd, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f1(wd)}" stroke-linecap="round"${x}/>`;
  const st = (stops) => stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const lg = (i, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${i}" ${at}>${st(stops)}</linearGradient>`;
  const rg = (i, stops, at = 'cx=".5" cy=".5" r=".5"') => `<radialGradient id="${i}" ${at}>${st(stops)}</radialGradient>`;
  const bump = (i, fq, sc, k, el = 50, oct = 3) => `<filter id="${i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="${oct}" seed="${Math.round(R(1, 90))}"/><feDiffuseLighting surfaceScale="${sc}" lighting-color="#fff"><feDistantLight azimuth="250" elevation="${el}"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="${k}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const blur = (i, sd) => `<filter id="${i}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f1(sd)}"/></filter>`;
  const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"${x}/>`;
  const list = pieces(c);
  const ix = s.slot === 'hero' || s.slot === 'folded' ? 0 : Number(s.slot.slice(1)) - 1;
  const it = list[ix];
  const t = pieceText(it, c);
  const kind = it ? kindOf(t) : 'tote';
  const cloth = shadeOf(t, ix);
  const dark = color.luminance(cloth) < 0.08;
  const neon = theme.neonFor(p.primary, '#121213', c.neon);
  const defs = blur('sb', m * 0.004) + blur('bl', m * 0.014) + blur('bx', m * 0.04) + blur('nb', m * 0.012) +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .055 0"/></filter>` +
    bump('cn', (40 / m).toFixed(4), 2.2, 1.12, 48) + bump('kn', `${(520 / m).toFixed(4)} ${(380 / m).toFixed(4)}`, 1.4, 1.16, 58, 2) + bump('ny', `${(6 / m).toFixed(4)} ${(30 / m).toFixed(4)}`, 3.2, 1.22, 40, 2) +
    lg('wl', [[0, '#1b1b1c'], [1, '#0e0e0f']]) +
    rg('sp', [[0, '#77736d'], [0.55, '#4a4845'], [0.92, '#2b2a29'], [1, '#2b2a29', 0]]) +
    lg('fd', [[0, '#fff', 0.22], [0.3, '#fff', 0.04], [0.65, '#000', 0.1], [1, '#000', 0.55]]) +
    lg('sd', [[0, '#000', 0.45], [0.2, '#000', 0], [0.8, '#000', 0], [1, '#000', 0.5]], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('me', [[0, '#3a3c3f'], [0.35, '#cfd2d5'], [0.6, '#6d7074'], [1, '#202224']]) +
    lg('wd', [[0, '#cdb08a'], [1, '#8a6a47']]) +
    lg('nt', [[0, neon, 0], [0.12, neon, 0.95], [0.88, neon, 0.95], [1, neon, 0]]) +
    rg('vg', [[0.5, '#000', 0], [1, '#000', 0.62]], 'cx=".5" cy=".42" r=".78"');
  let body = `<rect width="${w}" height="${h}" fill="url(#wl)"/><rect width="${w}" height="${h}" fill="#1f1f20" filter="url(#cn)" opacity=".5"/>`;

  // The garment, as one silhouette built from its left half and mirrored: neck, shoulder, sleeve (long sleeves hang by
  // the sides, short ones stand out), body to the hem.
  const garment = (cx, top, sc) => {
    const g = {
      hoodie: { nw: 0.075, sh: 0.03, sw: 0.25, bw: 0.215, bl: 0.6, sl: 'long', hood: 1, rib: 0.04, pocket: 1 },
      crew: { nw: 0.07, sh: 0.035, sw: 0.245, bw: 0.21, bl: 0.56, sl: 'long', rib: 0.035 },
      longsleeve: { nw: 0.065, sh: 0.035, sw: 0.235, bw: 0.2, bl: 0.6, sl: 'long', rib: 0.012 },
      jacket: { nw: 0.075, sh: 0.03, sw: 0.26, bw: 0.225, bl: 0.58, sl: 'long', collar: 1, placket: 1, rib: 0.012, shine: 1 },
      tee: { nw: 0.07, sh: 0.035, sw: 0.25, bw: 0.215, bl: 0.6, sl: 'short', rib: 0.01 },
    }[kind];
    const k = m * sc, X = (u) => cx + u * k, Y = (v) => top + v * k;
    const sy = g.sh, hem = g.bl, sw = g.sw, bw = g.bw;
    let L;
    if (g.sl === 'long') L = [[-g.nw, 0], [-sw * 0.62, sy * 0.55], [-sw, sy + 0.035], [-sw - 0.035, 0.26], [-sw - 0.02, hem - 0.03], [-sw + 0.07, hem - 0.03], [-bw - 0.004, 0.2], [-bw, hem]];
    else L = [[-g.nw, 0], [-sw * 0.62, sy * 0.55], [-sw, sy + 0.035], [-sw - 0.1, 0.2], [-sw - 0.04, 0.245], [-bw - 0.005, 0.19], [-bw, hem]];
    const pts = [...L, ...L.slice().reverse().map(([u, v]) => [-u, v])];
    const sil = `M${pts.map(([u, v]) => P2(X(u), Y(v))).join('L')}Z`.replace(/L([^L]*)L/, 'L$1L');
    let out = '';
    // Hard shadow on the wall: the same silhouette, offset down and right, barely softened.
    out += `<g transform="translate(${f1(k * 0.06)} ${f1(k * 0.075)})" opacity=".62" filter="url(#bl)"><path d="${sil}" fill="#050505"/></g>`;
    // Hanger: hook from the rail, then the bar under the shoulders.
    out += S(`M${P2(cx, top - k * 0.16)}c${f1(k * 0.035)} 0 ${f1(k * 0.04)} ${f1(-k * 0.05)} ${f1(k * 0.005)} ${f1(-k * 0.06)}M${P2(cx, top - k * 0.16)}V${f1(top - k * 0.06)}`, 'url(#me)', k * 0.008) +
      F(`M${P2(X(-sw + 0.03), Y(sy + 0.05))}Q${P2(cx, top - k * 0.03)} ${P2(X(sw - 0.03), Y(sy + 0.05))}l0 ${f1(k * 0.016)}Q${P2(cx, top - k * 0.01)} ${P2(X(-sw + 0.03), Y(sy + 0.066))}Z`, 'url(#wd)');
    if (g.hood) out += F(`M${P2(X(-0.14), Y(0.03))}C${P2(X(-0.14), Y(-0.045))} ${P2(X(0.14), Y(-0.045))} ${P2(X(0.14), Y(0.03))}Z`, mix(cloth, '#000', 0.2)) + S(`M${P2(X(-0.135), Y(0.02))}C${P2(X(-0.13), Y(-0.035))} ${P2(X(0.13), Y(-0.035))} ${P2(X(0.135), Y(0.02))}`, '#fff', k * 0.004, ' opacity=".12"');
    out += F(sil, cloth) + F(sil, cloth, ` filter="url(#${g.shine ? 'ny' : 'kn'})" opacity="${g.shine ? '.55' : dark ? '.9' : '.6'}"`);
    // Drape: soft vertical folds from the shoulders, the light from above falling off down the body, the sides rolling
    // away from it.
    out += `<clipPath id="gc${ix}"><path d="${sil}"/></clipPath><g clip-path="url(#gc${ix})">`;
    for (let i = 0; i < 7; i++) {
      const u = R(-bw + 0.03, bw - 0.03), v0 = R(0.1, 0.22), v1 = hem - R(0.02, 0.12), du = R(-0.02, 0.02);
      out += S(`M${P2(X(u), Y(v0))}Q${P2(X(u + du), Y((v0 + v1) / 2))} ${P2(X(u - du * 0.5), Y(v1))}`, i % 2 ? '#000' : '#fff', k * R(0.012, 0.03), ` opacity="${i % 2 ? '.2' : dark ? '.08' : '.12'}" filter="url(#bx)"`);
    }
    out += `<rect x="${f1(X(-sw - 0.15))}" y="${f1(Y(-0.1))}" width="${f1((sw * 2 + 0.3) * k)}" height="${f1((hem + 0.12) * k)}" fill="url(#fd)"/><rect x="${f1(X(-sw - 0.04))}" y="${f1(Y(0))}" width="${f1((sw * 2 + 0.08) * k)}" height="${f1(hem * k)}" fill="url(#sd)"/>`;
    // Long sleeves hang beside the body: the crease between them in shadow, the sleeve a shade darker.
    if (g.sl === 'long') for (const sg of [-1, 1]) out += F(`M${P2(X(sg * (bw + 0.004)), Y(0.2))}L${P2(X(sg * (bw - 0.006)), Y(hem - 0.03))}L${P2(X(sg * (sw + 0.03)), Y(hem - 0.03))}L${P2(X(sg * (sw + 0.035)), Y(0.26))}Z`, '#000', ' opacity=".14"') + S(`M${P2(X(sg * (bw + 0.004)), Y(0.2))}L${P2(X(sg * (bw - 0.004)), Y(hem - 0.035))}`, '#000', k * 0.01, ' opacity=".4" filter="url(#sb)"') + S(`M${P2(X(sg * (bw - 0.012)), Y(0.22))}L${P2(X(sg * (bw - 0.02)), Y(hem - 0.04))}`, '#fff', k * 0.004, ` opacity="${dark ? '.08' : '.14'}" filter="url(#sb)"`);
    // Ribbing, seams and the details of the kind.
    const ribs = (x0, x1, y0, y1, n) => { let d = ''; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; d += `M${P2(x, y0)}V${f1(y1)}`; } return S(d, '#000', k * 0.0024, ' opacity=".28"') + S(`M${P2(x0, y0)}H${f1(x1)}`, '#000', k * 0.004, ' opacity=".3"'); };
    if (g.rib > 0.02) {
      out += ribs(X(-bw + 0.004), X(bw - 0.004), Y(hem - g.rib), Y(hem), 60);
      if (g.sl === 'long') out += ribs(X(-sw - 0.02), X(-sw + 0.07), Y(hem - 0.03 - g.rib * 0.9), Y(hem - 0.03), 12) + ribs(X(sw - 0.07), X(sw + 0.02), Y(hem - 0.03 - g.rib * 0.9), Y(hem - 0.03), 12);
    } else out += S(`M${P2(X(-bw), Y(hem - 0.02))}H${f1(X(bw))}`, '#000', k * 0.003, ' opacity=".3" stroke-dasharray="3 5"');
    // Shoulder and armhole seams.
    out += S(`M${P2(X(-g.nw - 0.01), Y(0.004))}L${P2(X(-sw + 0.005), Y(sy + 0.03))}C${P2(X(-bw + 0.01), Y(0.12))} ${P2(X(-bw + 0.012), Y(0.16))} ${P2(X(-bw - 0.002), Y(0.2))}M${P2(X(g.nw + 0.01), Y(0.004))}L${P2(X(sw - 0.005), Y(sy + 0.03))}C${P2(X(bw - 0.01), Y(0.12))} ${P2(X(bw - 0.012), Y(0.16))} ${P2(X(bw + 0.002), Y(0.2))}`, '#000', k * 0.004, ' opacity=".35"');
    // Neckline: rib band, hood opening with drawcords, or a collar with a placket and snaps.
    if (g.hood) {
      out += F(`M${P2(X(-0.1), Y(0.0))}C${P2(X(-0.08), Y(0.09))} ${P2(X(0.08), Y(0.09))} ${P2(X(0.1), Y(0.0))}C${P2(X(0.06), Y(0.04))} ${P2(X(-0.06), Y(0.04))} ${P2(X(-0.1), Y(0.0))}Z`, mix(cloth, '#000', 0.5)) +
        S(`M${P2(X(-0.035), Y(0.07))}c${f1(-k * 0.006)} ${f1(k * 0.08)} ${f1(k * 0.004)} ${f1(k * 0.14)} ${f1(-k * 0.004)} ${f1(k * 0.2)}M${P2(X(0.035), Y(0.07))}c${f1(k * 0.008)} ${f1(k * 0.07)} ${f1(-k * 0.004)} ${f1(k * 0.13)} ${f1(k * 0.006)} ${f1(k * 0.18)}`, mix(cloth, dark ? '#ffffff' : '#000000', 0.18), k * 0.007) +
        F(`M${P2(X(-0.044), Y(0.27))}h${f1(k * 0.012)}v${f1(k * 0.03)}h${f1(-k * 0.012)}ZM${P2(X(0.035), Y(0.25))}h${f1(k * 0.012)}v${f1(k * 0.03)}h${f1(-k * 0.012)}Z`, 'url(#me)');
    } else if (g.collar) {
      out += F(`M${P2(X(-g.nw), Y(0))}L${P2(X(-0.02), Y(0.07))}L${P2(X(-0.11), Y(0.06))}ZM${P2(X(g.nw), Y(0))}L${P2(X(0.02), Y(0.07))}L${P2(X(0.11), Y(0.06))}Z`, mix(cloth, '#000', 0.3)) +
        S(`M${P2(cx, Y(0.06))}V${f1(Y(hem - 0.01))}`, '#000', k * 0.004, ' opacity=".4"');
      for (let i = 0; i < 5; i++) out += E(cx + k * 0.012, Y(0.1 + i * 0.1), k * 0.009, k * 0.009, 'url(#me)');
    } else {
      out += F(`M${P2(X(-g.nw), Y(0))}C${P2(X(-0.055), Y(0.06))} ${P2(X(0.055), Y(0.06))} ${P2(X(g.nw), Y(0))}C${P2(X(0.05), Y(0.035))} ${P2(X(-0.05), Y(0.035))} ${P2(X(-g.nw), Y(0))}Z`, mix(cloth, '#000', 0.55)) +
        S(`M${P2(X(-g.nw - 0.01), Y(0.004))}C${P2(X(-0.06), Y(0.075))} ${P2(X(0.06), Y(0.075))} ${P2(X(g.nw + 0.01), Y(0.004))}`, '#000', k * 0.004, ' opacity=".35"');
    }
    if (g.pocket) out += S(`M${P2(X(-0.13), Y(hem - 0.2))}L${P2(X(-0.1), Y(hem - 0.06))}H${f1(X(0.1))}L${P2(X(0.13), Y(hem - 0.2))}M${P2(X(-0.13), Y(hem - 0.2))}C${P2(X(-0.09), Y(hem - 0.27))} ${P2(X(0.09), Y(hem - 0.27))} ${P2(X(0.13), Y(hem - 0.2))}`, '#000', k * 0.004, ' opacity=".38"');
    // The practical light's edge on the right side of the piece.
    out += S(`M${P2(X(sw + 0.002), Y(sy + 0.04))}L${P2(X(sw + 0.03), Y(0.26))}L${P2(X(sw + 0.02), Y(hem - 0.04))}`, neon, k * 0.005, ' opacity=".16" filter="url(#sb)"');
    out += '</g>';
    return out;
  };

  const tote = (cx, top, sc) => {
    const k = m * sc, x0 = cx - k * 0.2, x1 = cx + k * 0.2, y0 = top + k * 0.12, y1 = top + k * 0.62;
    const bag = `M${P2(x0, y0)}H${f1(x1)}L${P2(x1 + k * 0.01, y1)}H${f1(x0 - k * 0.01)}Z`;
    return `<g transform="translate(${f1(k * 0.06)} ${f1(k * 0.07)})" opacity=".6" filter="url(#bl)"><path d="${bag}" fill="#050505"/></g>` +
      S(`M${P2(cx - k * 0.1, y0)}C${P2(cx - k * 0.1, top - k * 0.05)} ${P2(cx + k * 0.1, top - k * 0.05)} ${P2(cx + k * 0.1, y0)}`, '#cfc6b3', k * 0.03) + E(cx, top - k * 0.03, k * 0.012, k * 0.012, 'url(#me)') +
      F(bag, '#d9cfbc') + F(bag, '#d9cfbc', ' filter="url(#kn)" opacity=".7"') + F(bag, 'url(#fd)') + S(`M${P2(x0 + k * 0.01, y0 + k * 0.02)}H${f1(x1 - k * 0.01)}`, '#000', k * 0.003, ' opacity=".3" stroke-dasharray="3 5"');
  };

  if (s.slot === 'folded') {
    // The drop folded on a concrete plinth under the light: each piece a folded square with its collar and hem showing.
    body += E(w * 0.5, h * 0.36, w * 0.34, h * 0.5, 'url(#sp)');
    const pw = w * 0.42, px = w * 0.29, py = h * 0.66;
    body += F(`M${P2(px, py)}H${f1(px + pw)}V${f1(h)}H${f1(px)}Z`, '#5c5a57') + F(`M${P2(px, py)}H${f1(px + pw)}V${f1(h)}H${f1(px)}Z`, '#5c5a57', ' filter="url(#cn)" opacity=".7"') + F(`M${P2(px, py)}H${f1(px + pw)}V${f1(py + h * 0.012)}H${f1(px)}Z`, '#8a8782');
    const stack = (list.length ? list : [null, null, null]).slice(0, 4);
    let y = py;
    stack.forEach((pc, i) => {
      const col = pc ? shadeOf(pieceText(pc, c), i) : DEFAULT_SHADES[i];
      const fw = w * (0.3 - i * 0.012), fh = h * (0.075 + (i === stack.length - 1 ? 0.02 : 0)), x = w * 0.5 - fw / 2 + R(-w * 0.012, w * 0.012);
      y -= fh;
      const sq = `M${P2(x + w * 0.006, y)}H${f1(x + fw - w * 0.006)}Q${P2(x + fw, y)} ${P2(x + fw, y + fh * 0.3)}V${f1(y + fh)}H${f1(x)}V${f1(y + fh * 0.3)}Q${P2(x, y)} ${P2(x + w * 0.006, y)}Z`;
      body += F(`M${P2(x, y + fh)}H${f1(x + fw)}v${f1(h * 0.01)}H${f1(x)}Z`, '#000', ' opacity=".5" filter="url(#sb)"') + F(sq, col) + F(sq, col, ' filter="url(#kn)" opacity=".7"') + F(sq, 'url(#fd)') +
        S(`M${P2(x + fw * 0.02, y + fh * 0.5)}H${f1(x + fw * 0.98)}`, '#000', m * 0.002, ' opacity=".25"');
      if (i === stack.length - 1) body += F(`M${P2(x + fw * 0.38, y + fh * 0.08)}C${P2(x + fw * 0.42, y + fh * 0.5)} ${P2(x + fw * 0.58, y + fh * 0.5)} ${P2(x + fw * 0.62, y + fh * 0.08)}Z`, mix(col, '#000', 0.45));
    });
  } else {
    const hero = s.slot === 'hero';
    const sc = hero ? 1.06 : 1.1, top = h * (hero ? 0.24 : 0.2);
    // The rail, the hard pool of light on the wall, the garment, then the practical light at the frame's edge.
    body += E(w * 0.5, h * (hero ? 0.42 : 0.4), w * (hero ? 0.46 : 0.5), h * (hero ? 0.4 : 0.42), 'url(#sp)') + `<rect width="${w}" height="${h}" fill="#1f1f20" filter="url(#cn)" opacity=".35"/>`;
    body += F(`M0 ${f1(h * 0.075)}H${w}v${f1(m * 0.016)}H0Z`, 'url(#me)') + F(`M0 ${f1(h * 0.075 + m * 0.016)}H${w}v${f1(m * 0.02)}H0Z`, '#000', ' opacity=".45" filter="url(#sb)"');
    body += S(`M${P2(w * 0.5, h * 0.075 + m * 0.016)}V${f1(top - m * sc * 0.16)}`, 'url(#me)', m * 0.006);
    body += it && kind !== 'tote' && kind !== 'cap' ? garment(w * 0.5, top, sc) : tote(w * 0.5, top, sc);
    if (hero) body += F(`M${P2(w * 0.955, h * 0.1)}h${f1(m * 0.007)}V${f1(h * 0.94)}h${f1(-m * 0.007)}Z`, 'url(#nt)', ' opacity=".75"') + F(`M${P2(w * 0.951, h * 0.1)}h${f1(m * 0.015)}V${f1(h * 0.94)}h${f1(-m * 0.015)}Z`, 'url(#nt)', ' opacity=".3" filter="url(#nb)"');
  }
  body += `<rect width="${w}" height="${h}" fill="url(#vg)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  const all = defs.match(/<(filter|linearGradient|radialGradient) id="[^"]+"[\s\S]*?<\/\1>/g);
  const used = all.filter((x) => body.includes(`url(#${x.match(/id="([^"]+)"/)[1]})`)).join('');
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, used + ids, body);
}

function slots(c) {
  const list = pieces(c);
  const first = list[0];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1200, h: 1500, style: 'object', alt: first ? `${first.name} on a hanger under a single light` : `${c.name}, the new piece on a hanger` },
    ...list.map((s, i) => ({ slot: `p${i + 1}`, file: `piece-${i + 1}.jpg`, w: 1000, h: 1250, style: 'object', alt: [s.name, s.description].filter(Boolean).join(', ') })),
    { slot: 'folded', file: 'folded.jpg', w: 1600, h: 1000, style: 'sweep', alt: list.length ? `${list.slice(0, 4).map((s) => s.name).join(', ')}, folded` : `${c.name}, the drop folded` },
  ];
}

// The words for the business it's given (the free builder can put this design on any business): a label that sells
// goods has its drop and its restock list; a cafe orders, anyone else (a class, a barber) books, through its booking
// link when it has one, and the restock list becomes a request.
function words(c) {
  const tpl = (c.profile && c.profile.template) || 'product';
  const goods = tpl === 'product';
  const book = !c.buy && c.booking ? { label: c.booking.label, short: c.booking.kind === 'reserve' ? 'Reserve' : 'Book', href: c.booking.href, kind: c.booking.kind } : null;
  const ask = tpl === 'restaurant' ? 'Ask to order' : 'Ask to book';
  return { goods, book, ask, all: goods ? 'The drop' : 'What we offer', list: goods ? 'Restock list' : ask };
}

function nav(c) {
  const w = words(c);
  return [
    pieces(c).length ? { label: w.all, href: '#drop' } : null,
    chartOf(c).rows.length ? { label: 'Sizes', href: '#sizes' } : null,
    w.book ? null : { label: w.list, href: '#restock' },
    { label: 'About', href: '#about' },
  ].filter(Boolean);
}

function render(c0) {
  const list = pieces(c0);
  const w = words(c0);
  const c = c0.buy ? { ...c0, primary: { ...c0.primary, label: w.goods ? 'Shop the drop' : c0.primary.label } } : { ...c0, primary: w.book || (w.goods ? { label: 'Get on the restock list', short: 'Restock', href: '#restock', kind: 'anchor' } : { label: w.ask, short: w.ask.split(' ').pop(), href: '#restock', kind: 'anchor' }) };
  const chart = chartOf(c);
  const drops = dropsOf(c);
  const when = whenOf(c.deadline, c.today);
  const groups = [...new Set(list.map((s) => s.category).filter(Boolean))];
  const dropLabel = groups.length === 1 ? groups[0] : '';
  const dropNum = (dropLabel.match(/^drop\s*(\d+)/i) || [])[1];
  // The drop's name: the member's product name, else the group's name after "Drop 04,", else the headline.
  const title = (c.productName && c.productName !== c.name ? c.productName : dropLabel.replace(/^drop\s*\d+\s*[,:.-]?\s*/i, '') || c.tagline || c.heroTitle).replace(/[.!]+$/, '');
  // Sized from the longest word so no word breaks: the wide face runs about 1.1em a letter.
  const longest = Math.max(4, ...title.split(/\s+/).map((x) => x.length));
  const kt = Math.min(7.5, 23 / longest).toFixed(2);
  const ktm = Math.min(17, 80 / longest).toFixed(2);
  const allSizes = [...new Set(list.flatMap((s) => sizesOf(`${s.name} ${s.description || ''}`)))];
  const sizeOrder = (a) => { const i = SIZES.indexOf(a); return i < 0 ? 99 : i; };
  allSizes.sort((a, b) => sizeOrder(a) - sizeOrder(b));
  const rel = (h) => (/^https?:/.test(h) ? ' rel="noopener"' : '');
  const buyHref = c.buy ? c.buy.href : w.book ? w.book.href : '#restock';
  const lead0 = c.tagline && c.tagline.replace(/[.!]+$/, '') !== title ? c.tagline : c.what;
  const lead = lead0 && lead0.replace(/[.!]+$/, '').toLowerCase() !== title.toLowerCase() ? lead0 : '';

  const cd = when
    ? `<div class="dp-cd" data-at="${esc(when.iso)}"${when.local ? ' data-local' : ''} hidden aria-hidden="true">${[['d', 'Days'], ['h', 'Hrs'], ['m', 'Min'], ['s', 'Sec']].map(([k, l]) => `<span class="dp-cd-u"><b data-u="${k}">00</b><small>${l}</small></span>`).join('')}</div>`
    : '';
  const meta = `<div class="dp-meta" data-ci="then" data-ci-from="fade">
${dropNum || c.deadline ? `<p class="dp-when">${dropNum ? `<span class="dp-no">Drop ${esc(dropNum)}</span>` : ''}${c.deadline ? `<span class="dp-date">${when ? `<time datetime="${esc(when.iso)}">${esc(c.deadline)}</time>` : esc(c.deadline)}</span>` : ''}</p>` : ''}
${cd}
</div>`;
  const sizesRow = allSizes.length
    ? `<ul class="dp-sizes" aria-label="Sizes">${allSizes.map((z, i) => `<li style="--i:${i}">${esc(z)}</li>`).join('')}</ul>`
    : '';

  const hero = `<section class="dp-hero" aria-labelledby="hero-title">
<div class="dp-hero-grid">
<figure class="dp-shot" data-ci="subject"><div class="dp-par" data-par="0.05">${P.img(c, 'hero', { cls: 'dp-shot-img', eager: true, sizes: '(min-width: 60rem) 44vw, 100vw' }).replace('<img ', '<img data-alive="0.35" ')}</div></figure>
<div class="dp-hl">
${dropLabel && !dropNum ? `<p class="dp-kick">${esc(dropLabel)}</p>` : ''}
<h1 id="hero-title" class="dp-title" data-ci="head" style="--k:${kt}vw;--km:${ktm}vw">${esc(title)}</h1>
${lead ? `<p class="dp-lead" data-ci="then">${esc(lead.replace(/^./, (x) => x.toUpperCase()))}</p>` : ''}
</div>
<div class="dp-side">
${meta}
${sizesRow}
<div class="dp-ctas" data-ci="then">${P.button({ label: c.primary.label, href: list.length && c.buy ? '#drop' : c.primary.href, kind: 'anchor' }, 'btn btn-primary btn-lg')}${c.capacity ? `<p class="dp-cap">${esc(c.capacity.replace(/^./, (x) => x.toUpperCase()))}</p>` : ''}</div>
</div>
</div>
</section>`;

  // The lookbook: each piece at full height, holding while its tag scrolls past, the next sliding up over it.
  const tagRows = (s) => {
    const t = `${s.name} ${s.description || ''}`;
    const sz = sizesOf(t);
    const parts = String(s.description || '').split(/,\s+/).filter((x) => x && !/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\s*(?:to|-|through)\s*/i.test(x) && !STATUS_RE.test(x));
    const status = (String(s.description || '').match(STATUS_RE) || [])[1];
    return { parts, sz, status };
  };
  const look = list.length
    ? `<section class="dp-look" id="drop" aria-labelledby="drop-title" data-sc>
<div class="wrap dp-look-h"><h2 class="dp-h2" id="drop-title">${esc(dropLabel ? dropLabel.replace(/,\s*/, ': ') : w.all)}</h2><p class="dp-count">${list.length} ${list.length === 1 ? 'piece' : 'pieces'}</p></div>
<ol class="dp-pieces">${list.map((s, i) => {
      const { parts, sz, status } = tagRows(s);
      return `<li class="dp-piece" data-sc-part style="--i:${i}">
<figure class="dp-pf">${P.img(c, `p${i + 1}`, { cls: 'dp-pimg', sizes: '(min-width: 60rem) 46vw, 100vw' })}</figure>
<div class="dp-tag">
<p class="dp-tag-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
<h3 class="dp-tag-h">${esc(s.name)}</h3>
${s.priceText ? `<p class="dp-tag-p">${esc(s.priceText)}</p>` : ''}
${parts.length ? `<ul class="dp-tag-l">${parts.map((x) => `<li>${esc(x.replace(/^./, (y) => y.toUpperCase()))}</li>`).join('')}</ul>` : ''}
${sz.length ? `<p class="dp-tag-s"><span class="sr-only">Sizes: </span>${sz.map((z) => `<span>${esc(z)}</span>`).join('')}</p>` : ''}
${status ? `<p class="dp-tag-st">${esc(status.replace(/^./, (y) => y.toUpperCase()))}</p>` : ''}
${c.buy || w.book ? `<a class="dp-buy" href="${esc(buyHref)}"${rel(buyHref)}>${c.buy ? 'Buy' : 'Book'}<span class="sr-only"> ${esc(s.name)}</span></a>` : `<a class="dp-buy" href="#restock">Ask for it<span class="sr-only"> ${esc(s.name)}</span></a>`}
</div>
</li>`;
    }).join('\n')}</ol>
</section>`
    : '';

  // The size chart, as the member measured it.
  const sizes = chart.rows.length
    ? `<section class="dp-sec dp-chart" id="sizes" aria-labelledby="sizes-title"><div class="wrap dp-chart-grid">
<div><h2 class="dp-h2" id="sizes-title">Size chart</h2>${chart.unit ? `<p class="dp-note">Measured flat, in ${chart.unit === 'in' ? 'inches' : chart.unit}.</p>` : ''}${chart.notes.map((n) => `<p class="dp-note">${esc(n)}</p>`).join('')}</div>
<div class="dp-tw"><table class="dp-table"><caption class="sr-only">Measurements by size${chart.unit ? `, in ${chart.unit === 'in' ? 'inches' : chart.unit}` : ''}</caption><thead><tr><th scope="col">Size</th>${chart.cols.map((k) => `<th scope="col">${esc(k.replace(/^./, (x) => x.toUpperCase()))}</th>`).join('')}</tr></thead><tbody>${chart.rows.map((rw) => `<tr><th scope="row">${esc(rw.size)}</th>${chart.cols.map((k) => `<td>${rw.cells[k] ? esc(rw.cells[k].v) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
</div></section>`
    : '';

  // Drop dates: the next one, then the ones before it, with their status as the member wrote it.
  const next = c.deadline ? { n: dropNum || '', date: c.deadline, name: title, status: 'next', iso: when && when.iso } : null;
  const rows = [next, ...drops.filter((d) => !next || d.n !== next.n)].filter(Boolean);
  const dates = rows.length >= 2 || (rows.length === 1 && drops.length)
    ? `<section class="dp-sec dp-dates" aria-labelledby="dates-title"><div class="wrap">
<h2 class="dp-h2" id="dates-title">Drop dates</h2>
<ol class="dp-tt">${rows.map((d) => `<li class="${d.status === 'next' ? 'nx' : ''}"><span class="dp-tt-n">${d.n ? esc(d.n) : ''}</span><span class="dp-tt-d">${d.iso ? `<time datetime="${esc(d.iso)}">${esc(d.date)}</time>` : esc(d.date)}</span><span class="dp-tt-name">${esc(d.name)}</span><span class="dp-tt-s">${d.status === 'next' ? 'Next' : esc(d.status.replace(/^./, (x) => x.toUpperCase()))}</span></li>`).join('')}</ol>
</div></section>`
    : '';

  // The restock list: one email, the piece and the size.
  const restock = w.book ? '' : !w.goods ? `<section class="dp-sec dp-restock" id="restock" aria-labelledby="restock-title"><div class="wrap dp-rs-grid">
<h2 class="dp-rs-h" id="restock-title">${w.ask}</h2>
<div class="dp-rs-f"><p class="dp-rs-p">Tell us what you'd like and the day that suits you, and we will write back to confirm.</p>
${P.form(c, { id: 'book', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What you would like, and when' }], submit: 'Send my request', subject: `Request for ${c.name}` })}
</div>
</div></section>` : `<section class="dp-sec dp-restock" id="restock" aria-labelledby="restock-title"><div class="wrap dp-rs-grid">
<h2 class="dp-rs-h" id="restock-title">Restock list</h2>
<div class="dp-rs-f"><p class="dp-rs-p">${list.length && allSizes.length ? 'Leave your email, the piece and your size.' : list.length ? 'Leave your email and the piece.' : 'Leave your email.'} You get one email if it comes back.</p>
${P.form(c, { id: 'restock', fields: ['email', ...(list.length ? [{ name: 'piece', label: 'Which piece', type: 'select', options: list.map((s) => s.name), half: true }] : []), ...(allSizes.length ? [{ name: 'size', label: 'Your size', type: 'select', options: allSizes, half: true }] : [])], submit: 'Join the restock list', subject: `Restock list for ${c.name}` })}
</div>
</div></section>`;

  const paras = c.aboutParas.slice();
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const about = `<section class="dp-sec dp-about" id="about" aria-labelledby="about-title">
<figure class="dp-fold">${P.img(c, 'folded', { cls: 'dp-fold-img', sizes: '100vw' }).replace('<img ', '<img data-par="0.06" ')}</figure>
<div class="wrap dp-about-grid"><h2 class="dp-h2" id="about-title">${esc(c.name)}</h2><div class="dp-about-t">${paras.map((t) => `<p>${esc(t)}</p>`).join('')}${person || (!c.online && c.city) ? `<p class="dp-sig">${esc([person, !c.online && c.city].filter(Boolean).join(', '))}</p>` : ''}</div></div>
</section>`;

  const pol = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.email && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const shipping = c.shipping || c.returns
    ? `<section class="dp-sec dp-pol" aria-labelledby="pol-title"><div class="wrap"><h2 class="dp-h2" id="pol-title">Shipping and returns</h2><dl class="dp-pol-dl">${pol.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>${c.buy ? '<p class="dp-pol-more"><a href="policies.html">Full shipping and returns policy</a></p>' : ''}</div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="dp-sec" aria-labelledby="rv-title"><div class="wrap"><h2 class="dp-h2" id="rv-title">Worn</h2><div class="dp-quotes">${c.reviews.map((rv) => `<figure class="dp-q"><blockquote><p>${esc(rv.quote)}</p></blockquote>${rv.name ? `<figcaption>${esc(rv.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>` : '';
  const qs = c.faq.filter((q) => !(c.shipping || c.returns) || !/\b(ship|shipping|deliver|send it back|return|refund)/i.test(q.q));
  const faq = qs.length >= 2 ? `<section class="dp-sec" aria-labelledby="faq-title"><div class="wrap"><h2 class="dp-h2" id="faq-title">Questions</h2>${P.faq(qs)}</div></section>` : '';

  const bar = `<nav class="mbar dp-bar" aria-label="${w.goods ? 'Shop ' : ''}${esc(c.name)}"><p class="dp-bar-t">${esc(title)}${c.deadline ? `<span>${esc(c.deadline)}</span>` : ''}</p>${P.button(c.buy ? { label: w.goods ? 'Shop' : c.primary.short || c.primary.label, href: list.length ? '#drop' : buyHref, kind: 'anchor' } : w.book ? { label: w.book.short, href: w.book.href, kind: 'link' } : { label: w.goods ? 'Restock list' : w.ask, href: '#restock', kind: 'anchor' }, 'btn btn-primary')}</nav>`;

  const footer = `<footer class="dp-ftr"><div class="wrap">
<p class="dp-ftr-n" style="--n:${Math.max(c.name.length, 4)}">${esc(c.name)}</p>
<div class="dp-ftr-row">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.phone ? `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>` : ''}${c.buy ? `<a href="${esc(c.buy.href)}"${rel(c.buy.href)}>Shop</a>` : ''}${P.socials(c, { cls: 'dp-soc', size: 18 })}</div>
<p class="dp-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}${!c.online && c.city ? `, ${esc(c.city)}` : ''}</p>
</div></footer>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'dp-hdr', ctaCls: 'btn btn-primary btn-sm', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, look, sizes, dates, restock, about, shipping, reviews, faq, '</main>', footer, bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '88rem' } };
}

// The countdown: days, hours, minutes and seconds to the drop, updated each second (each minute while motion is
// paused), and "Live now" once it has passed. Without JavaScript the date stands on its own.
const JS = `(function(){var el=document.querySelector('.dp-cd');if(!el)return;var at=el.getAttribute('data-at'),t=el.hasAttribute('data-local')?new Date(at):new Date(at),u={};if(isNaN(t))return;['d','h','m','s'].forEach(function(k){u[k]=el.querySelector('[data-u="'+k+'"]')});var h=document.documentElement,last=-1;
function tick(){var ms=t-Date.now();if(ms<=0){el.innerHTML='<span class="dp-live">Live now</span>';return}var s=Math.floor(ms/1000),v={d:Math.floor(s/86400),h:Math.floor(s/3600)%24,m:Math.floor(s/60)%60,s:s%60};if(h.classList.contains('mp')&&v.m===last){setTimeout(tick,1000);return}last=v.m;for(var k in v){var x=String(v[k]).padStart(2,'0');if(u[k].textContent!==x){u[k].textContent=x;if(k!=='d'){u[k].classList.remove('fl');void u[k].offsetWidth;u[k].classList.add('fl')}}}setTimeout(tick,1000-Date.now()%1000)}
tick();el.hidden=false;el.removeAttribute('aria-hidden')})();`;

const CSS = `
@font-face{font-family:'Drop Display Fallback';font-weight:700 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:179.9%;ascent-override:44.5%;descent-override:13.3%;line-gap-override:0%}
@font-face{font-family:'Drop Body Fallback';font-weight:400 500;src:local('Courier New'),local('CourierNewPSMT'),local('Liberation Mono'),local('LiberationMono');size-adjust:100%;ascent-override:103%;descent-override:28%;line-gap-override:0%}
@font-face{font-family:'Drop Body Fallback';font-weight:600 700;src:local('Courier New Bold'),local('CourierNewPS-BoldMT'),local('Liberation Mono Bold'),local('LiberationMono-Bold');size-adjust:100%;ascent-override:103%;descent-override:28%;line-gap-override:0%}
html:root{--muted:color-mix(in srgb,var(--ink) 66%,var(--bg));--font-display:"Anybody","Drop Display Fallback",sans-serif;--font-body:"IBM Plex Mono","Drop Body Fallback",ui-monospace,monospace;--ease:cubic-bezier(.16,1,.3,1);--dp-rule:color-mix(in srgb,var(--ink) 20%,transparent);--dp-panel:#161617;--dp-shot:#0e0e0f}
html[data-theme="light"]{--dp-rule:color-mix(in srgb,var(--ink) 22%,transparent);--dp-panel:#dddcd7}
body{background:var(--bg);font-size:.95rem;letter-spacing:-.005em}
h1,h2,h3{font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;letter-spacing:-.02em}
.btn{font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;letter-spacing:.02em;font-size:.82rem;box-shadow:none}
.btn:hover{transform:none}
.btn-sm{min-height:2.5rem;padding:.45rem 1rem;font-size:.72rem}
.btn-lg{min-height:3.4rem;padding:.9rem 1.6rem}
a{text-underline-offset:.22em}
main a:not(.btn):hover{text-decoration-color:var(--primary-text)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--dp-rule)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:3.5rem}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:.9rem;letter-spacing:.01em;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nav ul{display:flex;gap:1.5rem}
.nav a{text-decoration:none;text-transform:uppercase;font-size:.78rem;letter-spacing:.06em;color:var(--ink)}
.mode-tg,.menu>summary{border-radius:0;border-color:var(--dp-rule);width:2.75rem;height:2.75rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}

/* hero: the piece at full height in the middle; the name and the clock either side of it on wide screens */
.dp-hero{border-bottom:1px solid var(--dp-rule)}
.dp-hero-grid{display:grid}
.dp-shot{margin:0;position:relative;overflow:hidden;background:var(--dp-shot)}
.dp-par{height:100%}
.dp-shot-img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.dp-hl{padding:1.75rem 1rem 0}
.dp-kick{margin:0 0 .6rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em}
.dp-title{margin:0;font-size:var(--km);line-height:.86}
.dp-lead{margin:1rem 0 0;max-width:30rem;line-height:1.55;color:var(--muted)}
.dp-side{padding:1.5rem 1rem 2.5rem;display:grid;gap:1.4rem;align-content:start}
.dp-meta{display:grid;gap:.9rem}
.dp-when{margin:0;display:flex;flex-wrap:wrap;gap:.4rem 1rem;align-items:baseline;font-size:.82rem;text-transform:uppercase;letter-spacing:.06em}
.dp-no{font-family:var(--font-display);font-weight:900;font-stretch:150%;letter-spacing:.02em}
.dp-cd{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--dp-rule);border-bottom:1px solid var(--dp-rule)}
.dp-cd[hidden]{display:none}
.dp-cd-u{display:grid;gap:.15rem;min-width:0;padding:.6rem .5rem .5rem;border-right:1px solid var(--dp-rule);text-align:center;container-type:inline-size}
.dp-cd-u:last-child{border-right:0}
/* two digits always clear their dividers: the figures size to the cell and stay a little narrower than the face's widest */
.dp-cd b{font-family:var(--font-display);font-weight:900;font-stretch:125%;font-size:min(clamp(1.5rem,1.1rem + 1.6vw,2.1rem),38cqi);line-height:1;font-variant-numeric:tabular-nums;display:block}
.dp-cd-u:last-child b{color:var(--primary-text)}
.dp-cd b.fl{animation:dpTick .5s var(--ease)}
@keyframes dpTick{from{opacity:.25;transform:translateY(-.12em)}to{opacity:1;transform:none}}
.dp-cd small{font-size:.66rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.dp-live{grid-column:1/-1;padding:.9rem 0;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:1.6rem;color:var(--primary-text)}
.dp-sizes{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.4rem}
.dp-sizes li{min-width:2.9rem;height:2.9rem;display:grid;place-items:center;padding:0 .5rem;border:1px solid var(--ink);font-family:var(--font-display);font-weight:900;font-stretch:150%;font-size:.78rem}
html.m .dp-sizes li{animation:dpStamp .34s calc(1.9s + var(--i) * .11s) cubic-bezier(.2,0,0,1) both}
@keyframes dpStamp{from{opacity:0;transform:scale(1.35)}to{opacity:1;transform:none}}
.dp-ctas{display:grid;gap:.8rem;justify-items:start}
.dp-cap{margin:0;font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
@media (min-width:60rem){
.dp-hero-grid{grid-template-columns:1fr auto 1fr;height:calc(100svh - 3.5rem);min-height:38rem;max-height:66rem}
.dp-shot{grid-column:2;grid-row:1;height:100%;width:min(44vw,calc(min(100svh - 3.5rem,66rem) * .8))}
.dp-shot-img{height:100%;aspect-ratio:auto}
.dp-hl{grid-column:1;grid-row:1;align-self:end;padding:2rem 2.5rem 2.5rem max(2rem,(100vw - 88rem)/2 + 2rem);display:grid;justify-items:start}
.dp-title{font-size:var(--k)}
.dp-side{grid-column:3;grid-row:1;align-self:end;padding:2rem max(2rem,(100vw - 88rem)/2 + 2rem) 2.5rem 2.5rem}
}

.dp-h2{margin:0;font-size:clamp(1.9rem,1.2rem + 3vw,3.6rem);line-height:.9}
.dp-sec{padding-block:clamp(3rem,2rem + 4vw,6rem);border-bottom:1px solid var(--dp-rule)}

/* the lookbook */
.dp-look{border-bottom:1px solid var(--dp-rule)}
.dp-look-h{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding-block:clamp(2.5rem,2rem + 3vw,5rem) 1.5rem}
.dp-count{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.dp-pieces{list-style:none;margin:0;padding:0}
.dp-piece{display:grid;border-top:1px solid var(--dp-rule)}
.dp-pf{margin:0;background:var(--dp-shot);overflow:hidden}
.dp-pimg{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.dp-tag{padding:1.25rem 1rem 2.5rem;display:grid;gap:.7rem;align-content:start}
.dp-tag-n{margin:0;font-size:.78rem;color:var(--muted);letter-spacing:.1em}
.dp-tag-h{margin:0;font-size:clamp(1.6rem,1.1rem + 2.2vw,2.8rem);line-height:.92}
.dp-tag-p{margin:0;font-family:var(--font-display);font-weight:900;font-stretch:150%;font-size:1.3rem;font-variant-numeric:tabular-nums}
.dp-tag-l{list-style:none;margin:0;padding:.75rem 0 0;border-top:1px solid var(--dp-rule);display:grid;gap:.3rem}
.dp-tag-l li::before{content:"/ ";color:var(--muted)}
.dp-tag-s{margin:0;display:flex;flex-wrap:wrap;gap:.3rem}
.dp-tag-s span{border:1px solid var(--dp-rule);padding:.2rem .45rem;font-size:.8rem}
.dp-tag-st{margin:0;text-transform:uppercase;letter-spacing:.08em;font-size:.8rem;color:var(--primary-text)}
.dp-buy{justify-self:start;display:inline-flex;align-items:center;min-height:2.75rem;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:.85rem;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.35em}
@media (min-width:60rem){
.dp-piece{grid-template-columns:minmax(0,46vw) 1fr;min-height:calc(100svh - 3.5rem)}
.dp-pf{position:sticky;top:3.5rem;height:calc(100svh - 3.5rem)}
.dp-pimg{height:100%;aspect-ratio:auto}
.dp-tag{align-self:center;padding:4rem 3rem;max-width:34rem}
.dp-tag-h{font-size:clamp(2.2rem,1rem + 2.6vw,3.6rem)}
html.m .dp-look[data-sc] .dp-tag{opacity:calc(.35 + var(--pi,1) * .65)}
html.m .dp-look[data-sc] .dp-piece.cur .dp-tag-n{color:var(--primary-text)}
}

/* size chart */
.dp-chart-grid{display:grid;gap:2rem}
.dp-note{margin:.8rem 0 0;color:var(--muted);max-width:30rem}
.dp-tw{overflow-x:auto}
.dp-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.dp-table th,.dp-table td{padding:.8rem .6rem;text-align:left;border-bottom:1px solid var(--dp-rule)}
.dp-table thead th{font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);border-bottom:1px solid var(--ink)}
.dp-table tbody th{font-family:var(--font-display);font-weight:900;font-stretch:150%}
.dp-table tbody tr:hover th,.dp-table tbody tr:hover td{color:var(--primary-text)}
@media (min-width:60rem){.dp-chart-grid{grid-template-columns:1fr 1.6fr;gap:4rem}.dp-table th,.dp-table td{padding:1rem}}

/* drop dates */
.dp-tt{list-style:none;margin:2rem 0 0;padding:0}
.dp-tt li{display:grid;grid-template-columns:3.2rem 1fr auto;grid-template-areas:"n name s" "n d s";gap:.15rem 1rem;padding:1rem 0;border-top:1px solid var(--dp-rule);align-items:baseline}
.dp-tt-n{grid-area:n;font-family:var(--font-display);font-weight:900;font-stretch:150%;font-size:1.5rem}
.dp-tt-d{grid-area:d;color:var(--muted);font-size:.85rem}
.dp-tt-name{grid-area:name;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:1rem}
.dp-tt-s{grid-area:s;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em}
.dp-tt .nx .dp-tt-s{color:var(--primary-text)}
.dp-tt .nx .dp-tt-n{color:var(--primary-text)}
@media (min-width:60rem){.dp-tt li{grid-template-columns:6rem 16rem 1fr auto;grid-template-areas:"n d name s";padding:1.4rem 0}.dp-tt-n{font-size:2.2rem}.dp-tt-name{font-size:1.4rem}}

/* restock: the word runs across, the form sits in one line */
.dp-restock{background:var(--dp-panel);--muted:color-mix(in srgb,var(--ink) 76%,var(--dp-panel))}
.dp-rs-grid{display:grid;gap:1.5rem}
.dp-rs-h{margin:0;font-size:clamp(2.6rem,.5rem + 11vw,10rem);line-height:.82;letter-spacing:-.04em}
.dp-rs-p{margin:0 0 1rem;max-width:34rem}
.dp-restock .form{display:grid;gap:1rem}
.dp-restock input,.dp-restock select{border-radius:0}
@media (min-width:60rem){.dp-rs-grid{grid-template-columns:1fr;gap:2.5rem}.dp-rs-f{display:grid;grid-template-columns:1fr 2fr;gap:3rem;align-items:start}}

/* about */
.dp-about{padding-top:0}
.dp-fold{margin:0 0 clamp(2rem,1.5rem + 3vw,4rem);overflow:hidden;background:var(--dp-shot)}
.dp-fold-img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;scale:1.08}
.dp-about-grid{display:grid;gap:1.5rem}
.dp-about-t p{margin:0 0 1rem;line-height:1.65;max-width:38rem}
.dp-sig{text-transform:uppercase;letter-spacing:.06em;font-size:.82rem}
@media (min-width:60rem){.dp-about-grid{grid-template-columns:1fr 1.3fr;gap:4rem}}

.dp-pol-dl{margin:2rem 0 0;display:grid}
.dp-pol-dl div{display:grid;gap:.3rem;padding:1rem 0;border-top:1px solid var(--dp-rule)}
.dp-pol-dl dt{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.dp-pol-dl dd{margin:0;line-height:1.6;max-width:42rem}
@media (min-width:60rem){.dp-pol-dl{grid-template-columns:repeat(3,1fr);gap:0 2rem}}
.dp-pol-more{margin:1rem 0 0}
.dp-quotes{display:grid;gap:2rem;margin-top:2rem}.dp-q{margin:0}.dp-q blockquote{margin:0;font-size:1.1rem;line-height:1.5}.dp-q figcaption{margin-top:.5rem;color:var(--muted)}

/* footer: the name across the full width */
.dp-ftr{padding-block:clamp(2.5rem,1.5rem + 3vw,4rem) calc(5.5rem + env(safe-area-inset-bottom,0px))}
@media (min-width:60rem){.dp-ftr{padding-bottom:2.5rem}}
.dp-ftr-n{margin:0;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:min(calc(86vw / var(--n)),14rem);line-height:.82;letter-spacing:-.035em;white-space:nowrap;overflow:hidden}
.dp-ftr-row{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1.5rem;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--dp-rule)}
.dp-ftr-row>a{min-height:2.75rem;display:inline-flex;align-items:center}
.dp-soc{display:flex;gap:.4rem;list-style:none;margin:0 0 0 auto;padding:0}
.dp-soc a{display:inline-grid;place-items:center;width:2.75rem;height:2.75rem;border:1px solid var(--dp-rule)}
.dp-ftr-c{margin:1rem 0 0;font-size:.78rem;color:var(--muted)}

.dp-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.6rem 1rem calc(.6rem + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--dp-rule)}
.dp-bar-t{margin:0;display:grid;min-width:0;font-family:var(--font-display);font-weight:900;font-stretch:150%;text-transform:uppercase;font-size:.85rem}
.dp-bar-t span{font-family:var(--font-body);font-weight:400;font-stretch:100%;text-transform:none;font-size:.75rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp-bar .btn{white-space:nowrap;flex:none}
@media (min-width:60rem){.dp-bar{display:none}}
@media (prefers-reduced-motion:reduce){.dp-cd b.fl{animation:none}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Drop',
  bestFor: 'A streetwear or apparel label that sells in limited drops',
  why: 'Built for a label that sells in drops: the new piece hanging under one hard light at full height, the countdown to the drop with the sizes stamped in under it, each piece held on screen in turn as people scroll, your size chart, your drop dates and a restock list.',
  match: /\b(streetwear|apparel|clothing (brand|label|line)|clothing|t-?shirts?|tees|hoodies?|crewnecks?|fashion (brand|label)|merch drops?|drops?\b.*\b(hoodie|tee|apparel)|limited drops?)\b/,
  fonts: { q: 'family=Anybody:wdth,wght@150,900&family=IBM+Plex+Mono:wght@400;600', display: ['Anybody', 'grotesk'], body: ['IBM Plex Mono', 'sans'] },
  modes: ['dark', 'light'],
  // The motion, as data (lib/choreo.md): the light snaps on and the name is pressed on, then the lookbook holds each piece.
  choreo: { intro: 'stamp', alive: ['scroll'], scroll: 'pin', pace: 'medium', look: 'one piece under a hard light in a concrete room, a countdown, sizes stamped' },
  art: dropArt,
  tokens,
  slots,
  nav,
  render,
};
