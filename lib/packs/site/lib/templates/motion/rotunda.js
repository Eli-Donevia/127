// Rotunda (animated, portfolio): the work hung on the inside of a curved gallery wall, each piece opened on its own.
//   Object: the rotunda. The member's pieces, drawn as architecture photographs (sky, sun, two-point perspective,
//   glass that holds the sky, cast shadows), picked from each piece's title and note; members outside architecture
//   get studies of light in a plaster room, product people vessels on plinths. They stand on a cylinder around the
//   viewer (CSS 3D, no library) that turns as you scroll or drag, with inertia.
//   Material: gallery plaster in daylight: a warm white wall, inscriptional capitals (Marcellus) over a plain grotesk,
//   hairline rules, square frames, wall labels.
//   One move: mask. The name rises out of its own rule, the lead and the wall label follow out of theirs, and the wall
//   is uncovered from the floor up.
//   Scroll moment: the cylinder, pinned, turning with the scroll (and the drag), the cards bending a little with speed.
//   Pop: the number of the piece facing you on the wall lights in the member's colour as the ring turns (and the
//   hovered piece's frame); the facing piece is framed in a hairline of their neon partner, the page's one lit line.
//   Hyperreal: each slot takes a photoreal render from assets/real when the pack has one, else the drawing.
//   After hours (the other mode) is the same rotunda with the house lights down: charcoal walls, the work lit.
// Each piece shows once: its case study is a sheet over the page at #case-n (opens with no script too), with the print
// large, its wall label and the next piece. Then who it was made for as a credits list, services as a price list,
// about as wall text beside the view camera (or an open door), the project form set as a loan form addressed to the
// studio, and a footer that is the checklist by the gallery door. Phones get a flat carousel;
// reduced motion and no script get a two-column contact sheet. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { esc } = require('../shared');

const id = 'rotunda';
const STYLES = ['portrait', 'sweep', 'arch', 'mesh', 'object', 'plates', 'grid', 'tile'];

// Gallery plaster in daylight (its own mode). After hours (the other): the same rotunda with the house lights down,
// charcoal walls a breath warm, the work lit where it hangs.
function tokens(p, mode) {
  const deep = color.mix(color.mix(p.ink, p.primary, 0.08), '#0d0d0d', 0.8);
  if (mode === 'dark') {
    const bg = color.mix(color.mix(p.ink, '#141413', 0.86), p.primary, 0.02);
    return { bg, dark: color.mix(bg, '#000000', 0.45) };
  }
  return { bg: color.mix(p.paper, '#f3f1ec', 0.88), dark: deep };
}

// The pieces with photos: the member's work (up to 12), else 6 placeholder spots.
function pieceCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(12, n) : 6;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const out = [];
  for (let i = 0; i < pieceCount(c); i++) {
    const piece = (c.work || [])[i];
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 1200, h: 1500, style: STYLES[i % STYLES.length], alt: piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work`, piece: piece ? `${piece.title} ${piece.detail || ''}`.toLowerCase() : '' });
  }
  out.push({ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'at work'}` : `${c.name} at work` });
  return out;
}

function nav(c) {
  return [
    { label: 'Work', href: '#work' },
    c.services.length || c.included.length ? { label: 'Services', href: '#services' } : null,
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The drawn work (T.art): each piece as an architecture photograph, built from light: a sky, the sun from the upper
// left, faces in two-point perspective lit and shaded, glass that holds the sky, cast shadows, a little grain. What it
// is comes from the piece's own title and note (a tower, a house at dusk, a cabin, a chapel, a lobby, a hall, a loft,
// a street of townhouses). A member who is not in architecture gets studies of light in a room instead (an open door,
// a window, an arch, an empty plinth), product people get vessels on plinths, and the portrait slot is the view camera
// for a photographer, else the open door. No text.
const f1 = (n) => n.toFixed(1);

function rtFamily(c) {
  const t = `${(c.profile && c.profile.id) || ''} ${c.niche || ''} ${c.what || ''}`.toLowerCase();
  if (/architect|interior|real estate|realtor|building|propert|residential|construction|builder|hotel|archviz|landscape design/.test(t)) return 'arch';
  if (/product|still life|packshot|ceramic|pottery|furniture|industrial design|jewel/.test(t)) return 'still';
  return 'room';
}

function rtKind(t, fam, i) {
  if (fam === 'room') return ['window', 'arch', 'plinth'][i % 3];
  if (fam === 'still') return 'still';
  if (/chapel|church|cathedral|temple|mission|monastery/.test(t)) return 'chapel';
  if (/market|\bhall\b|retail|store|museum|station|gallery|library/.test(t)) return 'hall';
  if (/lobby|interior|hotel|restaurant|\bbar\b|kitchen|\broom|lounge|\bspa\b/.test(t)) return 'interior';
  if (/street|townhouse|terrace|\brow\b|brownstone/.test(t)) return 'row';
  if (/loft|warehouse|factory|reuse|\bmill\b|brick|depot/.test(t)) return 'brick';
  if (/cabin|cottage|barn|chalet|lodge|farmhouse/.test(t)) return 'gable';
  if (/house|home|residence|villa|pavilion/.test(t)) return 'house';
  if (/office|tower|workplace|campus|apartment|condo|headquarters|school|\blab\b/.test(t)) return 'grid';
  return ['grid', 'house', 'interior', 'row', 'chapel', 'brick', 'gable', 'hall'][i % 8];
}

function rotundaArt(s, { p, c, seed, art }) {
  if (!/^w\d+$|^portrait$/.test(s.slot)) return null;
  const ph = art.photo('rotunda', s.slot);
  if (ph) return ph;
  const { w, h } = s;
  const m = Math.min(w, h);
  const r = art.rng(`${seed}:rt:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const mix = color.mix;
  const P2 = (x, y) => `${f1(x)} ${f1(y)}`;
  const poly = (pts) => `M${pts.map((q) => P2(q[0], q[1])).join('L')}Z`;
  const F = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
  const S = (d, col, wd, op = 1) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f1(wd)}" stroke-opacity="${op}"/>`;
  const st = (stops) => stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const lg = (id, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${st(stops)}</linearGradient>`;
  const rg = (id, stops, at = 'cx=".5" cy=".5" r=".5"') => `<radialGradient id="${id}" ${at}>${st(stops)}</radialGradient>`;
  const bump = (id, fq, sc, k = 1.18) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="2" seed="${f1(R(1, 90))}"/><feDiffuseLighting surfaceScale="${sc}" lighting-color="#fff"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="${k}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const blur = (id, sd) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(sd)}"/></filter>`;
  const ix = Number(s.slot.slice(1)) - 1 || 0;
  const fam = rtFamily(c);
  const flip = s.slot !== 'portrait' && fam !== 'arch' && ix % 2 === 1;
  const kind = s.slot === 'portrait' ? (/photo/.test(`${c.profile && c.profile.id} ${c.what || ''}`.toLowerCase()) ? 'camera' : 'door') : rtKind(s.piece || '', fam, ix);
  // The light and the stuff: a duotone sky and concrete from neutrals, nudged toward the member's page and ink.
  const day = mix('#6f8ba6', p.ink, 0.12), haze = mix('#eae5da', p.paper, 0.35);
  const lit = mix('#e6ded0', p.paper, 0.2), shade = mix('#868d96', p.ink, 0.1), deep = mix('#3c434b', p.ink, 0.2);
  const plaster = mix(p.paper, '#efe9df', 0.6), door = mix(p.primary, '#8a8379', 0.45);
  const defs = blur('sb', m * 0.006) + blur('bl', m * 0.02) + blur('hz', m * 0.07) + blur('hl', m * 0.0015) +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .075 0"/></filter>` +
    bump('bm', (60 / m).toFixed(4), 2.2) + bump('bk', `${(9 / m).toFixed(4)} ${(170 / m).toFixed(4)}`, 2.6, 1.22) + bump('wd', `${(140 / m).toFixed(4)} ${(5 / m).toFixed(4)}`, 2, 1.2) +
    lg('sk', [[0, day], [0.75, mix(day, haze, 0.7)], [1, haze]]) +
    lg('du', [[0, mix('#1c2a44', p.ink, 0.15)], [0.55, '#58698a'], [0.86, '#c99a74'], [1, '#e8c39a']]) +
    lg('gl', [[0, mix(haze, '#fff', 0.3)], [0.45, mix(day, haze, 0.45)], [1, mix(day, deep, 0.4)]]) +
    lg('gs', [[0, mix(day, deep, 0.35)], [1, mix(deep, '#11161b', 0.5)]]) +
    lg('lt', [[0, mix(lit, '#fff', 0.25)], [1, mix(lit, shade, 0.3)]], 'x1="0" y1="0" x2="1" y2="1"') +
    lg('sd', [[0, mix(shade, deep, 0.25)], [1, mix(shade, lit, 0.18)]]) +
    lg('gd', [[0, mix(haze, '#a59d90', 0.5)], [1, mix('#857e73', p.ink, 0.15)]]) +
    lg('wl', [[0, mix(plaster, '#fff', 0.35)], [1, mix(plaster, '#a49b8e', 0.35)]], 'x1="0" y1="0" x2="1" y2=".3"') +
    lg('fl', [[0, mix('#b9ad9b', p.paper, 0.2)], [1, mix('#7c7062', p.ink, 0.1)]]) +
    lg('gw', [[0, '#fff1d6'], [1, '#e7a25e']]) +
    lg('br', [[0, '#b56a4c'], [1, '#86452f']], 'x1="0" y1="0" x2="1" y2="1"') +
    lg('dr', [[0, mix(door, '#fff', 0.2)], [1, mix(door, '#000', 0.25)]], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('me', [[0, '#3d4247'], [0.35, '#d9dde0'], [0.6, '#8d9399'], [1, '#2f3337']], 'x1="0" y1="0" x2="1" y2="0"') +
    lg('vs', [[0, '#000', 0.4], [0.22, '#fff', 0.3], [0.38, '#fff', 0], [0.78, '#000', 0.12], [1, '#000', 0.5]], 'x1="0" y1="0" x2="1" y2="0"') + rg('sun', [[0, '#fff', 0.55], [1, '#fff', 0]]) + rg('br2', [[0, '#f2d79a'], [0.6, '#b8893c'], [1, '#6e4f1c']], 'cx=".35" cy=".35" r=".7"');
  let body = '';
  const sky = (fill = 'url(#sk)') => `<rect width="${w}" height="${h}" fill="${fill}"/><ellipse cx="${f1(-w * 0.05)}" cy="${f1(-h * 0.04)}" rx="${f1(w * 0.75)}" ry="${f1(h * 0.42)}" fill="url(#sun)"/>`;
  const grain = () => `<rect width="${w}" height="${h}" filter="url(#gr)"/>`;

  // Two-point perspective: a corner at x=cx from t to b, its faces running to the vanishing points VL and VR on the
  // eye line hy. q() is a patch of a face (u along it, v down it); spacing shortens as a face goes away.
  const box = (o) => {
    const pr = (y0, x) => y0 + (o.hy - y0) * (x < o.cx ? (o.cx - x) / (o.cx - o.VL) : (x - o.cx) / (o.VR - o.cx));
    const fx = (u, far) => o.cx + ((far - o.cx) * u * 1.5) / (1 + 0.5 * u);
    const yv = (v, x) => pr(o.t + (o.b - o.t) * v, x);
    const q = (u0, u1, v0, v1, far) => { const a = fx(u0, far), z = fx(u1, far); return poly([[a, yv(v0, a)], [z, yv(v0, z)], [z, yv(v1, z)], [a, yv(v1, a)]]); };
    const verts = (n, far, v0 = 0, v1 = 1) => { let d = ''; for (let k = 1; k < n; k++) { const x = fx(k / n, far); d += `M${P2(x, yv(v0, x))}V${f1(yv(v1, x))}`; } return d; };
    const rows = (n, far, sv, v0 = 0, v1 = 1) => { let d = ''; for (let j = 0; j < n; j++) { const v = v0 + ((v1 - v0) * j) / n; d += q(0, 1, v, v + sv, far); } return d; };
    const holes = (cols, rws, far, gx = 0.2, gy = 0.3, v0 = 0.06, v1 = 0.94) => { let d = ''; for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) { const dv = (v1 - v0) / rws; d += q((i + gx / 2) / cols, (i + 1 - gx / 2) / cols, v0 + dv * j + (dv * gy) / 2, v0 + dv * (j + 1) - (dv * gy) / 2, far); } return d; };
    return { ...o, pr, fx, yv, q, verts, rows, holes, L: q(0, 1, 0, 1, o.xl), Rt: q(0, 1, 0, 1, o.xr) };
  };
  // The ground in front, a shadow cast to the right, and the hairline where the sun catches the corner and the roof.
  const ground = (y) => F(`M0 ${f1(y)}H${w}V${h}H0Z`, 'url(#gd)');
  const edges = (B) => S(`M${P2(B.cx, B.t)}V${f1(B.b)}`, '#fff', m * 0.0025, 0.75) + S(`M${P2(B.xl, B.pr(B.t, B.xl))}L${P2(B.cx, B.t)}L${P2(B.xr, B.pr(B.t, B.xr))}`, '#fff', m * 0.002, 0.55);
  const cast = (B, len = 0.5) => F(poly([[B.cx, B.b], [B.xr, B.pr(B.b, B.xr)], [Math.min(w * 1.1, B.xr + w * len), B.pr(B.b, B.xr) + h * 0.03], [B.cx + w * len * 0.8, h * 1.02]]), '#0e1418', ' opacity=".34" filter="url(#sb)"');

  if (kind === 'grid' || kind === 'brick') {
    const B = box({ hy: h * 0.9, cx: w * R(0.42, 0.56), t: h * R(0.12, 0.2), b: h * 0.93, VL: -w * R(0.7, 1.1), VR: w * R(1.9, 2.5), xl: -w * 0.02, xr: w * R(0.86, 0.95) });
    body += sky() + ground(h * 0.88);
    if (kind === 'grid') {
      const fl = 14 + Math.floor(R(0, 5)), cols = 9 + Math.floor(R(0, 4));
      body += F(B.L, 'url(#gl)') + F(B.q(0.52, 0.74, 0.1, 1, B.xl), deep, ' opacity=".14"') + F(B.rows(fl, B.xl, 0.18 / fl), lit) + S(B.verts(cols, B.xl), deep, m * 0.0016, 0.45) +
        F(B.Rt, 'url(#gs)') + F(B.rows(fl, B.xr, 0.18 / fl), shade) + S(B.verts(Math.round(cols * 0.6), B.xr), '#c8d2da', m * 0.0012, 0.28);
      // A neighbour off the frame shades the lower floors of the lit face.
      body += F(poly([[B.xl, B.yv(0.55, B.xl)], [B.cx, B.yv(0.8, B.cx)], [B.cx, B.b], [B.xl, B.pr(B.b, B.xl)]]), '#16202a', ' opacity=".3"');
    } else {
      // Brick with punched windows, and the new glass storey set on the old roof.
      const T = box({ ...B, t: B.t - h * 0.07, b: B.t });
      body += F(B.L, 'url(#br)') + F(B.L, 'url(#br)', ' filter="url(#bk)"') + F(B.holes(6, 6, B.xl), deep) + F(B.holes(6, 6, B.xl, 0.2, 0.3, 0.06, 0.94), 'url(#gl)', ' opacity=".35"') +
        F(B.Rt, '#5e392c') + F(B.Rt, '#5e392c', ' filter="url(#bk)"') + F(B.holes(4, 6, B.xr), '#26313a') +
        F(T.L, 'url(#gl)') + S(T.verts(7, B.xl), deep, m * 0.0016, 0.5) + F(T.Rt, 'url(#gs)') + S(T.verts(4, B.xr), '#c8d2da', m * 0.0012, 0.3) + edges(T);
    }
    body += edges(B) + cast(B);
  } else if (kind === 'house' || kind === 'gable') {
    const dusk = kind === 'house';
    const hy = h * 0.66, B = box({ hy, cx: w * R(0.52, 0.62), t: h * (dusk ? 0.52 : 0.47), b: h * 0.7, VL: -w * R(0.6, 0.9), VR: w * R(2.2, 2.8), xl: w * 0.04, xr: w * 1.02 });
    body += sky(dusk ? 'url(#du)' : 'url(#sk)');
    // The tree line behind, soft.
    let tl = `M0 ${f1(hy + h * 0.02)}`;
    for (let x = 0; x <= w; x += w / 14) tl += `L${P2(x, hy - h * R(0.03, dusk ? 0.07 : 0.13))}`;
    body += F(`${tl}V${f1(hy + h * 0.04)}H0Z`, dusk ? '#18202c' : '#2f3a35', ' filter="url(#sb)"') + F(`M0 ${f1(hy)}H${w}V${h}H0Z`, dusk ? '#1f2a2c' : 'url(#gd)');
    if (dusk) {
      // Flat roof slab out past the walls, the glass lit from inside, a pool holding it all.
      const sl = box({ ...B, t: B.t - h * 0.028, b: B.t, xl: B.xl - w * 0.06 });
      body += F(B.L, 'url(#gw)') + F(B.q(0, 1, 0, 0.16, B.xl), '#000', ' opacity=".3"') + S(B.verts(9, B.xl), '#2a2018', m * 0.0022, 0.7) +
        F(B.Rt, '#3b3e43') + F(B.q(0.3, 0.9, 0.35, 0.5, B.xr), 'url(#gw)', ' opacity=".9"') +
        F(sl.L, '#cfc8bd') + F(sl.Rt, '#55585d') + edges(sl) +
        F(poly([[B.xl, B.pr(B.b, B.xl)], [B.cx, B.b], [B.cx + w * 0.1, h * 0.84], [B.xl - w * 0.1, h * 0.82]]), '#ffd29a', ' opacity=".3" filter="url(#bl)"') +
        F(`M0 ${f1(h * 0.8)}H${w}V${f1(h * 0.93)}H0Z`, '#24384a', ' opacity=".9"') +
        F(poly([[B.xl, h * 0.81], [B.cx, h * 0.81], [B.cx, h * 0.9], [B.xl, h * 0.86]]), '#ffd9a6', ' opacity=".35" filter="url(#sb)"') +
        S(`M0 ${f1(h * 0.8)}H${w}`, '#fff', m * 0.002, 0.4) + F(`M0 ${f1(h * 0.93)}H${w}V${h}H0Z`, '#8c8579');
    } else {
      // A cabin: the gable end to the sun with its glass, the long side and the roof in shade, boards on both.
      const xm = B.fx(0.5, B.xl), ya = B.pr(B.t, xm) - h * 0.17, rf = (B.xr - B.cx) / (B.VR - B.cx), apex = [xm, ya], far = [xm + (B.VR - xm) * rf, ya + (B.hy - ya) * rf];
      const gable = `M${P2(B.xl, B.pr(B.t, B.xl))}L${P2(...apex)}L${P2(B.cx, B.t)}V${f1(B.b)}L${P2(B.xl, B.pr(B.b, B.xl))}Z`;
      const gw = `M${P2(B.fx(0.25, B.xl), B.yv(0.95, B.fx(0.25, B.xl)))}V${f1(B.pr(B.t, B.fx(0.25, B.xl)) - h * 0.02)}L${P2(xm, ya + h * 0.05)}L${P2(B.fx(0.75, B.xl), B.pr(B.t, B.fx(0.75, B.xl)) - h * 0.02)}V${f1(B.yv(0.95, B.fx(0.75, B.xl)))}Z`;
      body += F(gable, '#8d6a4c') + F(gable, '#8d6a4c', ' filter="url(#wd)"') + S(B.verts(18, B.xl, -0.2, 1), '#3a281a', m * 0.0012, 0.35) + F(gw, 'url(#gl)') + S(`M${P2(xm, ya + h * 0.05)}V${f1(B.yv(0.95, xm))}`, '#2b2016', m * 0.003, 0.8) +
        F(B.Rt, '#3d2e24') + F(B.Rt, '#3d2e24', ' filter="url(#wd)"') + F(B.q(0.35, 0.6, 0.15, 0.75, B.xr), 'url(#gs)') +
        F(poly([apex, far, [B.xr, B.pr(B.t, B.xr)], [B.cx, B.t]]), '#2c2f33') + S(`M${P2(...apex)}L${P2(...far)}`, '#fff', m * 0.003, 0.5) + S(`M${P2(B.xl, B.pr(B.t, B.xl))}L${P2(...apex)}L${P2(B.cx, B.t)}V${f1(B.b)}`, '#fff', m * 0.0022, 0.6) + cast(B, 0.3);
    }
  } else if (kind === 'chapel') {
    const B = box({ hy: h * 0.84, cx: w * R(0.42, 0.5), t: h * 0.36, b: h * 0.88, VL: -w * R(0.8, 1.2), VR: w * R(1.8, 2.2), xl: w * 0.08, xr: w * 0.86 });
    const xm = B.fx(0.5, B.xl), ya = B.pr(B.t, xm) - h * 0.2, rf = (B.xr - B.cx) / (B.VR - B.cx), apex = [xm, ya], far = [xm + (B.VR - xm) * rf, ya + (B.hy - ya) * rf];
    const face = `M${P2(B.xl, B.pr(B.t, B.xl))}L${P2(...apex)}L${P2(B.cx, B.t)}V${f1(B.b)}L${P2(B.xl, B.pr(B.b, B.xl))}Z`;
    let forms = '';
    for (let j = 1; j < 16; j++) { const v = j / 16; forms += `M${P2(B.xl, B.yv(v, B.xl))}L${P2(B.cx, B.yv(v, B.cx))}L${P2(B.xr, B.yv(v, B.xr))}`; }
    body += sky() + ground(h * 0.84) + F(face, 'url(#lt)') + F(face, lit, ' filter="url(#bm)" opacity=".7"') + F(B.Rt, 'url(#sd)') + S(forms, deep, m * 0.0012, 0.2) +
      F(poly([apex, far, [B.xr, B.pr(B.t, B.xr)], [B.cx, B.t]]), mix(shade, lit, 0.35)) +
      F(B.q(0.46, 0.54, -0.3, 0.86, B.xl), '#20262d') + S(`M${P2(B.fx(0.54, B.xl), B.yv(-0.3, B.fx(0.54, B.xl)))}V${f1(B.yv(0.86, B.fx(0.54, B.xl)))}`, '#fff', m * 0.002, 0.6) +
      F(B.q(0.42, 0.62, 0.68, 1, B.xr), '#2a2f35') + S(`M${P2(B.xl, B.pr(B.t, B.xl))}L${P2(...apex)}L${P2(...far)}`, '#fff', m * 0.0025, 0.55) + edges({ ...B, xl: B.cx, xr: B.cx }) + cast(B, 0.7);
  } else if (kind === 'row') {
    // Townhouses face on, in raking morning light: deep window reveals, cornices, stoops, a neighbour's shadow.
    const n = 3, bw = w / n, gy = h * 0.88;
    body += sky() + F(`M0 ${f1(gy)}H${w}V${h}H0Z`, 'url(#gd)') + S(`M0 ${f1(gy + h * 0.015)}H${w}`, '#fff', m * 0.002, 0.4);
    const tones = ['#b26b4f', mix('#cfc6b6', p.paper, 0.2), mix(p.primary, '#7d7468', 0.6), '#9c8f7d'];
    let prevTop = 0;
    const tops = Array.from({ length: n }, () => h * R(0.14, 0.3));
    for (let i = 0; i < n; i++) {
      const x = i * bw, top = tops[i], tone = tones[(i + ix) % tones.length];
      body += F(`M${P2(x, top)}H${f1(x + bw)}V${f1(gy)}H${f1(x)}Z`, tone) + F(`M${P2(x, top)}H${f1(x + bw)}V${f1(gy)}H${f1(x)}Z`, tone, ' filter="url(#bk)"') +
        F(`M${P2(x - 4, top - h * 0.025)}H${f1(x + bw + 4)}V${f1(top + h * 0.004)}H${f1(x - 4)}Z`, mix(tone, '#fff', 0.35)) + F(`M${P2(x, top + h * 0.004)}H${f1(x + bw)}V${f1(top + h * 0.03)}H${f1(x)}Z`, '#000', ' opacity=".28" filter="url(#sb)"');
      let win = '', shd = '', sill = '';
      const ww = bw * 0.24, wh = (gy - top) * 0.16, dd = ww * 0.14;
      for (let j = 0; j < 3; j++) for (let k = 0; k < 2; k++) {
        const wx = x + bw * (0.17 + k * 0.42), wy = top + (gy - top) * (0.1 + j * 0.24);
        if (j === 2 && k === 0) continue;
        win += `M${P2(wx, wy)}h${f1(ww)}v${f1(wh)}h${f1(-ww)}Z`;
        shd += `M${P2(wx, wy)}h${f1(ww)}l${P2(-dd, dd)}h${f1(-ww + dd * 2)}v${f1(wh - dd)}l${P2(-dd, dd)}Z`;
        sill += `M${P2(wx - 3, wy + wh + 2)}h${f1(ww + 6)}`;
      }
      const dx = x + bw * 0.17, dy = gy - (gy - top) * 0.22, st = (gy - dy) * 0.3;
      body += F(win, 'url(#gl)') + F(shd, '#000', ' opacity=".38"') + S(sill, '#fff', m * 0.004, 0.55) +
        F(`M${P2(dx, dy - st)}h${f1(ww)}v${f1(gy - dy)}h${f1(-ww)}Z`, '#2a2522') + F(`M${P2(dx, dy - st)}h${f1(ww)}l${P2(-dd, dd)}h${f1(-ww + dd * 2)}v${f1(gy - dy)}h${f1(-dd)}Z`, '#000', ' opacity=".3"') +
        F(`M${P2(dx - ww * 0.25, gy - st)}h${f1(ww * 1.5)}V${f1(gy)}h${f1(-ww * 1.5)}Z`, mix('#cbc3b5', p.paper, 0.2)) + S(`M${P2(dx - ww * 0.25, gy - st)}h${f1(ww * 1.5)}M${P2(dx - ww * 0.25, gy - st * 0.5)}h${f1(ww * 1.5)}`, '#fff', m * 0.002, 0.6) +
        F(`M${P2(dx + ww * 1.25, gy - st)}l${P2(ww * 0.5, st * 0.6)}V${f1(gy)}h${f1(-ww * 0.5)}Z`, '#000', ' opacity=".25"');
      // The taller house to the left throws its shadow over this one's top corner.
      if (i && prevTop < top) body += F(`M${P2(x, top - h * 0.025)}h${f1(bw * 0.45)}L${P2(x, top + bw * 0.9)}Z`, '#000', ' opacity=".2"');
      prevTop = top;
    }
    body += S(tops.slice(1).map((tp, i) => `M${f1((i + 1) * bw)} ${f1(Math.max(tp, tops[i]))}V${f1(gy)}`).join(''), '#000', m * 0.003, 0.3);
  } else if (kind === 'interior' || kind === 'hall' || kind === 'door' || kind === 'window' || kind === 'arch' || kind === 'plinth' || kind === 'still' || kind === 'camera') {
    // One-point rooms: a back wall, the floor and ceiling running to the vanishing point, and the sun let in.
    const room = kind === 'interior' || kind === 'hall';
    const vx = w * (room ? R(0.44, 0.56) : 0.5), vy = h * (room ? 0.46 : 0.42), bw = w * (room ? 0.3 : 0.5), bh = h * (room ? 0.2 : 0.32);
    const x0 = vx - bw, x1 = vx + bw, y0 = vy - bh, y1 = vy + bh * (room ? 1 : 0.95);
    if (room) {
      const vault = kind === 'hall';
      body += F(`M0 0H${w}V${h}H0Z`, mix(lit, shade, 0.45)) + F(poly([[0, h], [x0, y1], [x1, y1], [w, h]]), 'url(#fl)') + F(poly([[0, 0], [x0, y1 - (y1 - y0) * 1.0], [x1, y0], [w, 0]]), mix(shade, deep, 0.3)) +
        F(poly([[0, 0], [x0, y0], [x0, y1], [0, h]]), 'url(#lt)') + F(poly([[w, 0], [x1, y0], [x1, y1], [w, h]]), 'url(#sd)');
      // The window wall: glass to the sky (an arched end in a hall), mullions, and its reflection in the polished floor.
      const gx0 = x0 + bw * 0.08, gx1 = x1 - bw * 0.08, gy0 = y0 + bh * (vault ? 0.25 : 0.12);
      const win = vault ? `M${P2(gx0, y1)}V${f1(gy0)}A${f1((gx1 - gx0) / 2)} ${f1((gx1 - gx0) / 2)} 0 0 1 ${P2(gx1, gy0)}V${f1(y1)}Z` : `M${P2(gx0, gy0)}H${f1(gx1)}V${f1(y1)}H${f1(gx0)}Z`;
      body += F(`M${P2(x0, y0)}H${f1(x1)}V${f1(y1)}H${f1(x0)}Z`, mix(lit, shade, 0.2)) + F(win, 'url(#sk)') + S(Array.from({ length: 5 }, (_, i) => `M${f1(gx0 + ((gx1 - gx0) * (i + 1)) / 6)} ${f1(gy0 - (vault ? bw * 0.6 : 0))}V${f1(y1)}`).join('') + `M${P2(gx0, y1 - bh * 0.6)}H${f1(gx1)}`, deep, m * 0.003, 0.7) +
        F(poly([[gx0, y1], [gx1, y1], [gx1 + bw * 0.5, h], [gx0 - bw * 0.5, h]]), '#fff', ' opacity=".18" filter="url(#bl)"');
      // The sun through the glass, laid on the floor toward you, mullion shadows across it.
      const sp = [[gx0 + bw * 0.1, y1 + h * 0.02], [gx1, y1 + h * 0.02], [w * 1.05, h * 0.86], [w * 0.38, h * 0.92]];
      body += F(poly(sp), '#fff6e4', ' opacity=".42" filter="url(#sb)"');
      let ms = '';
      for (let i = 1; i < 6; i++) { const k = i / 6; ms += `M${P2(sp[0][0] + (sp[1][0] - sp[0][0]) * k, sp[0][1])}L${P2(sp[3][0] + (sp[2][0] - sp[3][0]) * k, sp[3][1] + (sp[2][1] - sp[3][1]) * k)}`; }
      body += S(ms, mix(lit, shade, 0.5), m * 0.008, 0.5);
      if (vault) {
        // Ribs of a barrel vault stepping back to the far wall, a skylight along the crown.
        let rb = '';
        for (let i = 0; i < 6; i++) { const k = Math.pow(i / 6, 0.7), a = x0 * k, z = w - (w - x1) * k, yb = y0 * k + h * 0.12 * (1 - k), rr = (z - a) / 2; rb += `M${P2(a, yb)}A${f1(rr)} ${f1(rr * 0.6)} 0 0 1 ${P2(z, yb)}`; }
        body += F(poly([[w * 0.38, 0], [w * 0.62, 0], [vx + bw * 0.12, y0 - bh * 0.4], [vx - bw * 0.12, y0 - bh * 0.4]]), '#fff', ' opacity=".55" filter="url(#sb)"') + S(rb, '#fff', m * 0.006, 0.5) + S(rb, deep, m * 0.002, 0.5);
      } else {
        // Downlights in the ceiling and a low stone desk in the room.
        let dl = '';
        for (let j = 1; j < 4; j++) for (let i = -1; i < 2; i++) { const k = j / 4.2, x = vx + i * bw * (1 + (1 - k) * 2.4), y = y0 * k; dl += `M${P2(x - 10 * (1 - k + 0.3), y)}a${f1(10 * (1 - k + 0.3))} ${f1(4 * (1 - k + 0.3))} 0 1 0 ${f1(20 * (1 - k + 0.3))} 0a${f1(10 * (1 - k + 0.3))} ${f1(4 * (1 - k + 0.3))} 0 1 0 ${f1(-20 * (1 - k + 0.3))} 0Z`; }
        const dx0 = w * 0.2, dx1 = w * 0.66, dy0 = h * 0.7, dy1 = h * 0.8, k = 0.12;
        body += F(dl, '#fffbe8', ' opacity=".9"') + F(poly([[dx0 - w * 0.02, dy1 + h * 0.01], [dx1 + w * 0.06, dy1 + h * 0.01], [dx1 + w * 0.1, h * 0.86], [dx0, h * 0.86]]), '#000', ' opacity=".3" filter="url(#bl)"') +
          F(poly([[dx0, dy0], [dx1, dy0], [dx1 + (vx - dx1) * k, dy0 + (vy - dy0) * k], [dx0 + (vx - dx0) * k, dy0 + (vy - dy0) * k]]), mix(lit, '#fff', 0.3)) + F(`M${P2(dx0, dy0)}H${f1(dx1)}V${f1(dy1)}H${f1(dx0)}Z`, 'url(#sd)') + F(`M${P2(dx0, dy0)}H${f1(dx1)}V${f1(dy1)}H${f1(dx0)}Z`, shade, ' filter="url(#bm)" opacity=".5"') + S(`M${P2(dx0, dy0)}H${f1(dx1)}`, '#fff', m * 0.002, 0.7);
      }
    } else {
      // A plaster room face on: the wall, the floor, and what the light does in it.
      const fy = h * 0.74;
      body += F(`M0 0H${w}V${f1(fy)}H0Z`, 'url(#wl)') + F(`M0 0H${w}V${f1(fy)}H0Z`, plaster, ' filter="url(#bm)" opacity=".3"') + F(`M0 ${f1(fy)}H${w}V${h}H0Z`, 'url(#fl)') + F(`M0 ${f1(fy)}H${w}V${f1(fy + h * 0.012)}H0Z`, mix(plaster, '#fff', 0.4)) + S(`M0 ${f1(fy + h * 0.012)}H${w}`, '#000', m * 0.002, 0.25);
      if (kind === 'door' || kind === 'arch') {
        const dw = w * (kind === 'arch' ? 0.36 : 0.3), dx = w * (kind === 'arch' ? 0.32 : 0.42), dt = h * (kind === 'arch' ? 0.26 : 0.24);
        const op = kind === 'arch' ? `M${P2(dx, fy)}V${f1(dt + dw / 2)}A${f1(dw / 2)} ${f1(dw / 2)} 0 0 1 ${P2(dx + dw, dt + dw / 2)}V${f1(fy)}Z` : `M${P2(dx, dt)}H${f1(dx + dw)}V${f1(fy)}H${f1(dx)}Z`;
        // Beyond: the bright day (sky over a sunlit court or a further wall), then the reveal in the wall's thickness.
        body += F(op, kind === 'arch' ? mix(plaster, '#fff6e6', 0.5) : 'url(#sk)') + (kind === 'arch' ? F(`M${P2(dx, fy - h * 0.2)}H${f1(dx + dw)}V${f1(fy)}H${f1(dx)}Z`, mix(lit, shade, 0.3)) + F(`M${P2(dx + dw * 0.55, dt)}L${P2(dx + dw, dt)}V${f1(fy)}L${P2(dx + dw * 0.2, fy)}Z`, '#000', ' opacity=".14"') : F(`M${P2(dx, fy - h * 0.12)}H${f1(dx + dw)}V${f1(fy)}H${f1(dx)}Z`, '#8f9a7f', ' opacity=".8" filter="url(#sb)"')) +
          F(`M${P2(dx + dw, kind === 'arch' ? dt + dw / 2 : dt)}l${P2(-w * 0.04, h * 0.012)}V${f1(fy)}h${f1(w * 0.04)}Z`, mix(plaster, '#000', 0.25));
        // The light coming in across the floor toward you.
        body += F(poly([[dx, fy], [dx + dw, fy], [dx + dw * 2.1, h], [dx + dw * 0.4, h]]), '#fff3dc', ' opacity=".55" filter="url(#sb)"');
        if (kind === 'door') {
          // The door leaf swung in toward the room, its panels, its shadow on the wall.
          const lx = dx - dw * 0.5, lf = poly([[dx, dt], [lx, dt - h * 0.035], [lx, fy + h * 0.05], [dx, fy]]);
          body += F(poly([[lx - w * 0.06, dt], [dx, dt], [dx, fy], [lx - w * 0.04, fy + h * 0.02]]), '#000', ' opacity=".16" filter="url(#bl)"') + F(lf, 'url(#dr)') + F(lf, door, ' filter="url(#wd)" opacity=".4"') +
            S(`M${P2(lx + dw * 0.08, dt + h * 0.02)}L${P2(dx - dw * 0.05, dt + h * 0.035)}V${f1(dt + (fy - dt) * 0.45)}L${P2(lx + dw * 0.08, dt + (fy - dt) * 0.45)}ZM${P2(lx + dw * 0.08, dt + (fy - dt) * 0.52)}L${P2(dx - dw * 0.05, dt + (fy - dt) * 0.52)}V${f1(fy - h * 0.03)}L${P2(lx + dw * 0.08, fy)}Z`, '#000', m * 0.002, 0.3) +
            S(`M${P2(lx, dt - h * 0.035)}V${f1(fy + h * 0.05)}`, '#fff', m * 0.003, 0.5) + `<circle cx="${f1(lx + dw * 0.06)}" cy="${f1(dt + (fy - dt) * 0.52)}" r="${f1(m * 0.008)}" fill="url(#br2)"/>`;
        }
      } else if (kind === 'window') {
        // A deep window: its sky, the reveal, and the sun's patch it throws on the wall and the floor, crossed by the bars.
        const wx = w * 0.18, wy = h * 0.16, ww = w * 0.28, wh = h * 0.3, rv = w * 0.035;
        body += F(`M${P2(wx, wy)}h${f1(ww)}v${f1(wh)}h${f1(-ww)}Z`, 'url(#sk)') + F(`M${P2(wx, wy)}h${f1(ww)}l${P2(-rv, rv)}h${f1(-ww + rv * 2)}v${f1(wh - rv * 2)}l${P2(-rv, rv)}Z`, mix(plaster, '#000', 0.22)) + F(`M${P2(wx + ww, wy)}v${f1(wh)}l${P2(-rv, -rv)}v${f1(-wh + rv * 2)}Z`, mix(plaster, '#fff', 0.3)) +
          S(`M${P2(wx + ww / 2, wy + rv)}v${f1(wh - rv * 2)}M${P2(wx + rv, wy + wh / 2)}h${f1(ww - rv * 2)}`, deep, m * 0.006, 0.8) + F(`M${P2(wx - 4, wy + wh)}h${f1(ww + 8)}v${f1(h * 0.012)}h${f1(-ww - 8)}Z`, mix(plaster, '#fff', 0.45));
        const sx = w * 0.5, sy = h * 0.4, sw2 = w * 0.3, sh = h * 0.26, sk = w * 0.12;
        const sp = `M${P2(sx, sy)}h${f1(sw2)}l${P2(sk, sh)}h${f1(-sw2)}Z`;
        body += F(sp, '#fff4dc', ' opacity=".6" filter="url(#hl)"') + S(`M${P2(sx + sw2 / 2, sy)}l${P2(sk, sh)}M${P2(sx + sk / 2, sy + sh / 2)}h${f1(sw2)}`, mix(plaster, '#7d7466', 0.4), m * 0.008, 0.6) +
          F(poly([[sx + sk, fy + h * 0.02], [sx + sk + sw2, fy + h * 0.02], [sx + sk + sw2 * 1.5, h], [sx + sk * 0.6, h]]), '#fff3dc', ' opacity=".4" filter="url(#sb)"');
      } else if (kind === 'plinth' || kind === 'still') {
        // The skylight's fall of light, and plinths (empty, or with vessels for product people) with their shadows.
        body += F(poly([[w * 0.25, 0], [w * 0.75, 0], [w * 0.95, h], [w * 0.05, h]]), '#fff', ' opacity=".16" filter="url(#hz)"');
        const pl = kind === 'still' ? [[0.16, R(0.3, 0.38), R(0.44, 0.56)], [0.5, R(0.22, 0.28), R(0.5, 0.64)], [0.73, R(0.18, 0.22), R(0.38, 0.48)]].slice(0, 2 + (ix % 2)) : [[0.36, 0.3, 0.5]];
        pl.forEach(([px, pw, ph], i) => {
          const x = w * px, pwx = w * pw, top = fy - h * (ph - 0.18) + h * 0.06, d = h * 0.03;
          body += F(poly([[x + pwx, fy + h * 0.06], [x + pwx + w * 0.16, fy + h * 0.04], [x + pwx + w * 0.2, fy + h * 0.1], [x + pwx, fy + h * 0.12]]), '#000', ' opacity=".22" filter="url(#bl)"') +
            F(`M${P2(x, top)}h${f1(pwx)}V${f1(fy + h * 0.12)}h${f1(-pwx)}Z`, 'url(#lt)') + F(`M${P2(x + pwx * 0.62, top)}h${f1(pwx * 0.38)}V${f1(fy + h * 0.12)}h${f1(-pwx * 0.38)}Z`, '#000', ' opacity=".14"') +
            F(`M${P2(x, top)}l${P2(w * 0.03, -d)}h${f1(pwx - w * 0.03)}l${P2(-w * 0.0, d)}Z`, mix(lit, '#fff', 0.5)) + S(`M${P2(x, top)}h${f1(pwx)}`, '#fff', m * 0.002, 0.8);
          if (kind === 'still') {
            const cx = x + pwx * 0.5, base = top - d * 0.3, sh = (i + ix) % 3, gz = [mix(p.primary, '#3a3631', 0.55), '#e9e3d8', '#a0765a'][(i + ix * 2) % 3];
            const vs = sh === 0 ? `M${P2(cx - pwx * 0.2, base)}C${P2(cx - pwx * 0.34, base - h * 0.12)} ${P2(cx - pwx * 0.06, base - h * 0.16)} ${P2(cx - pwx * 0.08, base - h * 0.22)}H${f1(cx + pwx * 0.08)}C${P2(cx + pwx * 0.06, base - h * 0.16)} ${P2(cx + pwx * 0.34, base - h * 0.12)} ${P2(cx + pwx * 0.2, base)}Z`
              : sh === 1 ? `M${P2(cx - pwx * 0.3, base)}a${f1(pwx * 0.3)} ${f1(pwx * 0.3)} 0 1 1 ${f1(pwx * 0.6)} 0Z` : `M${P2(cx - pwx * 0.22, base)}V${f1(base - h * 0.14)}Q${P2(cx - pwx * 0.22, base - h * 0.17)} ${P2(cx - pwx * 0.06, base - h * 0.18)}V${f1(base - h * 0.24)}H${f1(cx + pwx * 0.06)}V${f1(base - h * 0.18)}Q${P2(cx + pwx * 0.22, base - h * 0.17)} ${P2(cx + pwx * 0.22, base - h * 0.14)}V${f1(base)}Z`;
            body += F(poly([[cx, base], [cx + pwx * 0.9, base - d * 0.2], [cx + pwx * 0.7, base + d * 0.15]]), '#000', ' opacity=".25" filter="url(#sb)"') + F(vs, gz) + F(vs, `url(#vs)`) + S(sh === 1 ? `M${P2(cx - pwx * 0.2, base - pwx * 0.12)}A${f1(pwx * 0.22)} ${f1(pwx * 0.22)} 0 0 1 ${P2(cx - pwx * 0.04, base - pwx * 0.26)}` : `M${P2(cx - pwx * 0.1, base - h * 0.03)}V${f1(base - h * 0.12)}`, '#fff', m * 0.006, 0.55);
          }
        });
      } else {
        // The photographer's view camera on its tripod in the window light: leather bellows between two metal standards,
        // the lens on the front, the ground glass on the back, brass knobs, three legs with their locks.
        const cx = w * 0.5, cy = h * 0.42, fs = w * 0.28, bs = w * 0.36, bh2 = h * 0.2, fh = h * 0.14;
        body += F(poly([[w * 0.05, 0], [w * 0.45, 0], [w * 0.75, fy], [w * 0.2, fy]]), '#fff6e6', ' opacity=".28" filter="url(#hz)"');
        const legs = [[cx - w * 0.3, h * 0.97], [cx + w * 0.04, h * 0.99], [cx + w * 0.3, h * 0.95]];
        body += F(poly([[cx - w * 0.32, h * 0.97], [cx + w * 0.36, h * 0.95], [cx + w * 0.4, h * 0.99], [cx - w * 0.3, h]]), '#000', ' opacity=".25" filter="url(#bl)"');
        legs.forEach(([lx, ly]) => { body += `<path d="M${P2(cx - w * 0.012, cy + bh2 * 0.62)}L${P2(lx - w * 0.012, ly)}h${f1(w * 0.024)}L${P2(cx + w * 0.012, cy + bh2 * 0.62)}Z" fill="url(#me)"/>` + F(`M${P2(cx + (lx - cx) * 0.55 - w * 0.016, cy + bh2 * 0.62 + (ly - cy - bh2 * 0.62) * 0.55)}h${f1(w * 0.032)}v${f1(h * 0.025)}h${f1(-w * 0.032)}Z`, '#1d1f22'); });
        body += F(`M${P2(cx - w * 0.05, cy + bh2 * 0.5)}h${f1(w * 0.1)}v${f1(h * 0.05)}h${f1(-w * 0.1)}Z`, 'url(#me)') + F(`M${P2(cx - w * 0.36, cy + bh2 * 0.44)}h${f1(w * 0.72)}v${f1(h * 0.018)}h${f1(-w * 0.72)}Z`, 'url(#me)');
        // Bellows: folds narrowing from the back standard to the front.
        const bx0 = cx + w * 0.18, bx1 = cx - w * 0.2, n = 9;
        let fd = '', fl2 = '';
        for (let i = 0; i < n; i++) {
          const k0 = i / n, k1 = (i + 1) / n, xa = bx0 + (bx1 - bx0) * k0, xb = bx0 + (bx1 - bx0) * k1, ha = bh2 * (1 - k0 * 0.35) / 2, hb = bh2 * (1 - k1 * 0.35) / 2;
          const seg = `M${P2(xa, cy - ha)}L${P2(xb, cy - hb)}V${f1(cy + hb)}L${P2(xa, cy + ha)}Z`;
          if (i % 2) fd += seg; else fl2 += seg;
        }
        body += F(fl2, '#2a2826') + F(fd, '#141312') + F(fl2, '#2a2826', ' filter="url(#bm)" opacity=".6"') + F(`M${P2(bx0, cy - bh2 / 2)}L${P2(bx1, cy - bh2 * 0.325)}V${f1(cy - bh2 * 0.29)}L${P2(bx0, cy - bh2 * 0.45)}Z`, '#fff', ' opacity=".14"');
        // Standards, ground glass, lens.
        body += F(`M${P2(bx0, cy - bs / 2.4)}h${f1(w * 0.05)}v${f1(bs / 1.2)}h${f1(-w * 0.05)}Z`, 'url(#me)') + F(`M${P2(bx0 + w * 0.05, cy - bs / 2.6)}h${f1(w * 0.02)}v${f1(bs / 1.3)}h${f1(-w * 0.02)}Z`, '#5b6a6f') +
          F(`M${P2(bx1 - w * 0.04, cy - fs / 2.2)}h${f1(w * 0.04)}v${f1(fs / 1.1)}h${f1(-w * 0.04)}Z`, 'url(#me)') +
          `<ellipse cx="${f1(bx1 - w * 0.06)}" cy="${f1(cy)}" rx="${f1(w * 0.04)}" ry="${f1(fh * 0.42)}" fill="#141516"/><ellipse cx="${f1(bx1 - w * 0.085)}" cy="${f1(cy)}" rx="${f1(w * 0.026)}" ry="${f1(fh * 0.32)}" fill="#3d4a50"/><ellipse cx="${f1(bx1 - w * 0.09)}" cy="${f1(cy - fh * 0.08)}" rx="${f1(w * 0.008)}" ry="${f1(fh * 0.1)}" fill="#fff" opacity=".6" filter="url(#hl)"/>` +
          [[bx0 + w * 0.025, cy + bs / 2.4], [bx1 - w * 0.02, cy + fs / 2.2], [bx0 + w * 0.025, cy - bs / 2.4]].map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(m * 0.016)}" fill="url(#br2)"/>`).join('');
      }
    }
  }
  // A mirrored study keeps its plaster outside the mirror (lighting filters go dark under a negative scale).
  if (flip) { const k = body.indexOf('/>', body.indexOf('url(#bm)')) + 2; body = `${body.slice(0, k)}<g transform="matrix(-1 0 0 1 ${w} 0)">${body.slice(k)}</g>`; }
  body += grain();
  // Only the defs this drawing uses, and each long path written once.
  const all = defs.match(/<(filter|linearGradient|radialGradient) id="[^"]+"[\s\S]*?<\/\1>/g);
  const used = all.filter((x) => body.includes(`url(#${x.match(/id="([^"]+)"/)[1]})`)).join('');
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, used + ids, body);
}

const num = (i) => String(i + 1).padStart(2, '0');

// The name, broken into lines in the markup (balanced by length) and sized in CSS from its longest line, so its
// height is fixed before the font arrives. Wide screens keep it on one line when it fits.
function nameLines(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const len = words.join(' ').length;
  const k = words.length < 2 || len < 9 ? 1 : len > 26 && words.length > 2 ? 3 : 2;
  let best = { worst: len, g: [words] };
  if (k > 1) {
    const cuts = (from, left) => (left === 1 ? [[words.slice(from)]] : words.slice(from, words.length - left + 1).flatMap((_, j) => cuts(from + j + 1, left - 1).map((r) => [words.slice(from, from + j + 1), ...r])));
    for (const g of cuts(0, k)) {
      const worst = Math.max(...g.map((x) => x.join(' ').length));
      if (worst < best.worst) best = { worst, g };
    }
  }
  const one = len <= 22;
  const fs = Math.min(14, 210 / Math.max(one ? len : best.worst, 4)).toFixed(2);
  const fsm = Math.min(24, 194 / Math.max(best.worst, 4)).toFixed(2);
  return { html: best.g.map((g) => `<span class="nl">${g.map(esc).join(' ')}</span>`).join(' '), style: `--fs:${fs}vw;--fsm:${fsm}vw`, one };
}

function render(c) {
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const work = (c.work || []).slice(0, 12);
  const n = pieceCount(c);
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  // A full ring needs about ten cards: the pieces repeat around it (the repeats are hidden from screen readers).
  const ring = Math.max(n, 10);
  const cards = [];
  for (let k = 0; k < ring; k++) {
    const i = k % n;
    const piece = work[i];
    const dup = k >= n;
    const href = piece ? `#case-${i + 1}` : '#contact';
    const img = P.img(c, `w${i + 1}`, { eager: k < 3 }).replace(dup ? /alt="[^"]*"/ : /$^/, 'alt=""');
    cards.push(`<li class="rt-card${dup ? ' dup' : ''}" style="--i:${k}"${dup ? ' aria-hidden="true"' : ''}><a class="rt-in" href="${href}"${dup ? ' tabindex="-1"' : ''}><span class="rt-ph">${img}</span><span class="rt-cap"><span class="rt-n">${num(i)}</span>${piece ? `<span class="rt-t">${esc(piece.title)}</span>` : ''}</span></a></li>`);
  }

  // The wall label: what, where, from what price, set like the card beside a print.
  const label = [
    c.online ? '' : c.city || c.area,
    work.length ? `${work.length} ${work.length === 1 ? 'piece' : 'pieces'} on the wall` : '',
  ].filter(Boolean);
  const nm = nameLines(c.name);
  const hero = `<section class="rt-hero" aria-labelledby="hero-title">
<div class="wrap rt-intro">
<h1 class="rt-name${nm.one ? ' one' : ''}" id="hero-title" data-ci="head" style="${nm.style}">${nm.html}</h1>
<div class="rt-row">
<p class="rt-lead" data-ci="then" data-ci-from="mask">${esc(c.heroSub)}</p>
<div class="rt-side" data-ci="then" data-ci-from="mask">
${label.length ? `<p class="rt-label">${label.map((x, i) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}
</div>
</div>
</div>
</section>
<section class="rt-gal" id="work" aria-labelledby="work-title">
<h2 class="sr-only" id="work-title">Selected work</h2>
<div class="rt-pin" data-ci="subject">
<div class="rt-scene" data-alive="0.45"><ul class="rt-ring${n === 6 ? ' n6' : ''}">${cards.join('')}</ul></div>
<p class="rt-hint" aria-hidden="true"><span>Drag or scroll</span><span class="rt-count">${num(n - 1)} pieces</span></p>
</div>
</section>`;

  // The case studies: each piece once, opened from the wall. A case is a sheet over the page (its address is the piece's
  // #case-n, so it opens with no script too), with the print large, its wall label, and the next and previous pieces.
  const cases = work.length
    ? `<section class="rt-cases" aria-label="Case studies">${work
        .map(
          (p, i) => `<article class="rt-case" id="case-${i + 1}" aria-labelledby="case-${i + 1}-t">
<div class="rt-case-media">${P.img(c, `w${i + 1}`, { cls: 'rt-case-img' }).replace(/alt="[^"]*"/, 'alt=""')}</div>
<div class="rt-case-copy"><span class="rt-n">${num(i)} of ${num(work.length - 1)}</span><h3 class="rt-case-t" id="case-${i + 1}-t">${esc(p.title)}</h3>${p.detail ? `<p class="rt-case-d">${esc(p.detail)}</p>` : ''}${p.href ? `<a class="rt-case-a" href="${esc(p.href)}">${esc(p.linkLabel || 'See it')}${icon('arrowUpRight', { size: 16 })}</a>` : ''}
<p class="rt-case-nav">${work.length > 1 ? `<a href="#case-${((i - 1 + work.length) % work.length) + 1}">Previous<span class="sr-only">: ${esc(work[(i - 1 + work.length) % work.length].title)}</span></a><a href="#case-${((i + 1) % work.length) + 1}">Next<span class="sr-only">: ${esc(work[(i + 1) % work.length].title)}</span></a>` : ''}<a class="rt-x" href="#work">Back to the wall</a></p></div>
</article>`
        )
        .join('\n')}</section>`
    : '';

  const cl = c.clients || [];
  const clients = cl.length
    ? `<section class="rt-sec rt-clients" aria-labelledby="clients-title"><div class="wrap rt-credits"><h2 class="rt-k" id="clients-title">Made for</h2><ul class="rt-cl" data-rv>${cl.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`
    : '';

  const services = c.services.length || c.included.length
    ? `<section class="rt-sec" id="services" aria-labelledby="services-title"><div class="wrap rt-svc-grid">
<div><h2 class="rt-h2" id="services-title" data-split>${c.services.length ? 'Ways to work together' : "What's included"}</h2></div>
<div>
${c.services.length ? `<ul class="rt-svc">${c.services.map((s, i) => `<li data-rv style="--d:${i % 4}"><span class="rt-n">${num(i)}</span><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="rt-incl" data-rv><h3>${c.services.length ? 'Every project includes' : 'With every project'}</h3><ul>${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</div>
</div></section>`
    : '';

  const about = `<section class="rt-sec rt-about" id="about" aria-labelledby="about-title"><div class="wrap rt-about-grid">
<figure class="rt-about-media" data-rv="mask"><div>${P.img(c, 'portrait', { cls: 'rt-about-img' }).replace('<img ', '<img data-par="0.05" ')}</div><figcaption>${esc([person || c.name, c.online ? '' : c.city].filter(Boolean).join(', '))}</figcaption></figure>
<div class="rt-about-copy"><h2 class="rt-k rt-about-k" id="about-title">About ${esc(person || c.name)}</h2>
${c.aboutParas.map((p, i) => `<p class="rt-p${i === 0 ? ' first' : ''}" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c, { cls: 'rt-soc' })}</div></div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="rt-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">Kind words</h2><div class="rt-quotes">${c.reviews.map((r, i) => `<figure class="rt-q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const faq = c.faq.length >= 2 ? `<section class="rt-sec" id="faq" aria-labelledby="faq-title"><div class="wrap rt-faq"><h2 class="rt-h2" id="faq-title" data-split>Good to know</h2><dl class="rt-qa" data-rv style="--d:1">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const types = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  // Project words only for studios that take projects; anyone else gets a plain message field.
  const proj = /portfolio|agency/.test(c.profile.template || '');
  const fields = ['name', 'email', proj ? { ...P.FIELD_PRESETS.company, label: 'Business or brand' } : null, types || { ...P.FIELD_PRESETS.when, label: proj ? 'Date or deadline' : 'Preferred date' }, types ? { ...P.FIELD_PRESETS.when, label: proj ? 'Date or deadline' : 'Preferred date', half: false } : null, { ...P.FIELD_PRESETS.message, label: proj ? `Tell ${person ? 'me' : 'us'} about the project` : 'Your message', required: true }].filter(Boolean);
  // The project form set as a loan form: one sheet, addressed to the studio, the heading across its top, the notes in
  // a ruled strip under it and the numbered fields in two columns below (one column on phones).
  const notes = [c.ctaSub, c.promise].filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');
  const contact = `<section class="rt-sec rt-contact" id="contact" aria-labelledby="contact-title"><div class="wrap">
<div class="rt-loan">
<p class="rt-loan-to"><span>To</span>${esc([c.name, c.online ? '' : c.city].filter(Boolean).join(', '))}</p>
<h2 class="rt-h2 big" id="contact-title" data-split>${esc(c.ctaTitle)}</h2>
${notes || c.booking ? `<div class="rt-loan-notes" data-rv style="--d:2">${notes}${c.booking ? `<p>${mag(P.button(c.primary, 'btn btn-primary btn-lg', 'calendar'))}</p>` : ''}</div>` : ''}
<div class="rt-form" data-rv style="--d:3">${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}</div>
</div>
</div></section>`;

  // The footer is the checklist by the gallery door: every piece on the wall by number, and the studio's own label.
  const reach = [
    c.email ? `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : '',
    c.phone ? `<li><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></li>` : '',
    c.address ? `<li>${esc(c.address)}</li>` : '',
  ].join('');
  const footer = `<footer class="rt-ftr"><div class="wrap rt-ftr-in">
${work.length ? `<nav class="rt-check" aria-label="The work"><p class="rt-k">On the wall</p><ol>${work.map((p, i) => `<li><a href="#case-${i + 1}"><span class="rt-n">${num(i)}</span>${esc(p.title)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="rt-wl"><p class="rt-wl-n">${esc(c.name)}</p>${c.what ? `<p>${esc(c.what)}</p>` : ''}${!c.online && c.city ? `<p>${esc(c.city)}</p>` : ''}${reach ? `<ul>${reach}</ul>` : ''}${P.socials(c, { cls: 'rt-soc', size: 18 })}</div>
</div>
<div class="wrap rt-ftr-base"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p></div>
</footer>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'rt-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, cases, clients, services, about, reviews, faq, contact, '</main>', footer, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '86rem' } };
}

// The ring (wide screens with motion only): the pinned section's scroll and any drag turn it; a drag keeps going and
// slows down; the speed bends the cards a little. Each card is placed from its angle; cards far round the back hide.
// The loop runs only while the gallery is on screen and stops when nothing moves.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,gal=d.querySelector('.rt-gal');if(!gal)return;var wide=matchMedia('(min-width: 48rem)');
var cards=[].slice.call(gal.querySelectorAll('.rt-card')),n=cards.length,step=360/n,drag=0,vel=0,last=null,bend=0,R=600,on=false,raf=0,down=null,moved=0;
function size(){var w=cards[0].offsetWidth||300;R=Math.round(w/2/Math.tan(Math.PI/n)*1.06);gal.style.setProperty('--r',R+'px')}
function rot(){var r=gal.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));return p*300+drag}
function draw(){raf=0;if(!wide.matches)return;if(!down){drag+=vel;vel*=.94;if(Math.abs(vel)<.01)vel=0}var a=rot(),dv=last===null?0:a-last;last=a;bend+=(Math.max(-12,Math.min(12,dv*2.2))-bend)*.18;
for(var i=0;i<n;i++){var t=((a-i*step)%360+540)%360-180,c=cards[i];var hide=Math.abs(t)>80;c.style.visibility=hide?'hidden':'';c.classList.toggle('front',Math.abs(t)<step/2);if(hide)continue;c.style.transform='translate(-50%,-50%) translateZ(var(--r)) rotateY('+t.toFixed(2)+'deg) translateZ(calc(var(--r) * -1))';c.firstChild.style.transform='rotateY('+(-bend).toFixed(2)+'deg) skewY('+(bend*.25).toFixed(2)+'deg)'}
if(on&&(vel||down||Math.abs(bend)>.02))raf=requestAnimationFrame(draw)}
function kick(){if(!raf)raf=requestAnimationFrame(draw)}
size();addEventListener('resize',function(){size();kick()});addEventListener('scroll',kick,{passive:true});
new IntersectionObserver(function(es){on=es[0].isIntersecting;if(on)kick()}).observe(gal);
var pin=gal.querySelector('.rt-pin');
pin.addEventListener('pointerdown',function(e){if(!wide.matches||e.button)return;down={x:e.clientX,t:performance.now()};moved=0;vel=0;pin.classList.add('grab')});
addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-down.x;down.x=e.clientX;moved+=Math.abs(dx);drag-=dx*.12;vel=-dx*.12;kick()});
addEventListener('pointerup',function(){if(!down)return;down=null;pin.classList.remove('grab');kick()});
pin.addEventListener('click',function(e){if(moved>6){e.preventDefault();moved=0}},true);
pin.addEventListener('dragstart',function(e){e.preventDefault()});
gal.classList.add('live');kick()})();
(function(){addEventListener('keydown',function(e){if(e.key==='Escape'&&/^#case-/.test(location.hash))location.hash='work'})})();`;

const CSS = `
@font-face{font-family:'Rotunda Display Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.4%;ascent-override:96.1%;descent-override:27.6%;line-gap-override:0%}
@font-face{font-family:'Rotunda Body Fallback';font-weight:400 500;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:100.4%;ascent-override:99.6%;descent-override:30.2%;line-gap-override:0%}
@font-face{font-family:'Rotunda Body Fallback';font-weight:600 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:95.3%;ascent-override:104.9%;descent-override:31.8%;line-gap-override:0%}
html:root{--font-display:"Marcellus","Rotunda Display Fallback",serif;--font-body:"Hanken Grotesk","Rotunda Body Fallback",sans-serif}
:root{--ease:cubic-bezier(.16,1,.3,1)}
body{--edge:color-mix(in srgb,var(--ink) 13%,transparent)}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
.btn{font-weight:500}
.btn:hover{transform:none}
.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.rt-n{font-family:var(--font-body);font-size:.85rem;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:0;color:var(--muted)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:400;letter-spacing:0;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.4rem 0;font-size:.92rem;text-decoration:none;color:var(--muted);background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-cta{min-height:2.5rem;padding:.45rem 1.1rem;font-size:.9rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.rt-hero{padding-top:clamp(2rem,1.5rem + 3vw,4.5rem)}
.rt-name{font-size:clamp(2.6rem,var(--fsm),9rem);font-weight:400;line-height:.94;letter-spacing:-.03em;padding-bottom:.08em}
.nl{display:block;white-space:nowrap}
@media (min-width:48rem){.rt-name{font-size:clamp(3.5rem,var(--fs),15rem)}.rt-name.one .nl{display:inline}}
.rt-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
@media (min-width:56rem){.rt-row{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-lead{grid-column:1/7}.rt-side{grid-column:9/13}}
.rt-lead{max-width:36rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.rt-side{display:grid;gap:1.25rem;justify-items:start}
.rt-label{display:grid;margin:0;width:100%;max-width:22rem;padding-top:.75rem;border-top:1px solid var(--ink);font-size:.9rem;line-height:1.5;color:var(--muted)}
.rt-gal{padding-block:clamp(2.5rem,2rem + 3vw,5rem)}
.rt-ring{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem .75rem;width:min(100% - 2rem,var(--max));margin-inline:auto}
@media (min-width:48rem){.rt-ring{grid-template-columns:repeat(4,minmax(0,1fr));gap:2.5rem 1.5rem;width:min(100% - 4rem,var(--max))}.rt-ring.n6{grid-template-columns:repeat(3,minmax(0,1fr))}}
.rt-card.dup{display:none}
.rt-in{display:block;text-decoration:none;color:inherit}
.rt-ph{display:block;overflow:hidden;aspect-ratio:4/5;background:var(--surface);outline:1px solid transparent;outline-offset:6px;transition:outline-color .4s ease}
.rt-ph img{width:100%;height:100%;object-fit:cover;pointer-events:none}
.rt-cap{display:flex;gap:.8rem;align-items:baseline;padding-top:.7rem}
.rt-t{font-family:var(--font-display);font-weight:400;letter-spacing:0}
.rt-in:hover .rt-ph,.rt-in:focus-visible .rt-ph{outline-color:var(--pop)}
.rt-in:hover .rt-n,.rt-in:focus-visible .rt-n,.rt-card.front .rt-n{color:var(--pop)}
.rt-cap .rt-n{transition:color .3s ease}
.rt-hint{display:none;font-size:.85rem;color:var(--muted)}
/* phones with motion: a flat carousel that snaps */
@media (max-width:47.99rem){html.m .rt-ring{display:flex;gap:.8rem;width:auto;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 1rem 1rem;scrollbar-width:none}html.m .rt-ring::-webkit-scrollbar{display:none}html.m .rt-card{flex:none;width:72vw;scroll-snap-align:center}html.m .rt-hint{display:flex;justify-content:space-between;width:min(100% - 2rem,var(--max));margin:.5rem auto 0}}
/* wide screens with motion: the cylinder */
@media (min-width:48rem){
html.m .rt-gal{height:260vh;padding:0}
html.m .rt-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;cursor:grab;touch-action:pan-y;user-select:none}
html.m .rt-pin.grab{cursor:grabbing}
html.m .rt-scene{position:absolute;inset:0;perspective:calc(var(--r,700px) * 1.12);perspective-origin:50% 48%}
html.m .rt-ring{display:block;position:absolute;left:50%;top:48%;width:0;height:0;margin:0;transform-style:preserve-3d}
html.m .rt-card,html.m .rt-card.dup{display:block;position:absolute;left:0;top:0;width:clamp(16rem,24vw,25rem);backface-visibility:hidden;transform-style:preserve-3d}
html.m .rt-gal:not(.live) .rt-card{position:relative}
html.m .rt-in{transform-origin:50% 50%;will-change:transform}
html.m .rt-hint{display:flex;position:absolute;z-index:1;left:0;right:0;bottom:2rem;justify-content:space-between;width:min(100% - 4rem,var(--max));margin-inline:auto;padding-top:.75rem;border-top:1px solid var(--edge)}
}
/* a case study: a sheet over the page, opened from its piece on the wall */
.rt-case{display:none}
.rt-case:target{display:grid;position:fixed;inset:0;z-index:60;overflow:auto;gap:1.5rem;align-content:start;padding:clamp(1rem,.5rem + 2vw,2.5rem);background:var(--bg)}
@media (min-width:56rem){.rt-case:target{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-content:center}.rt-case-media{grid-column:1/9}.rt-case-copy{grid-column:9/13;align-self:end}}
.rt-case-media{overflow:hidden;max-height:calc(100svh - 5rem);aspect-ratio:4/5;justify-self:start;background:var(--surface)}
@media (min-width:56rem){.rt-case-media{height:calc(100svh - 5rem);width:auto;justify-self:center}}
.rt-case-img{display:block;width:100%;height:100%;object-fit:cover}
.rt-case-copy{display:grid;gap:.5rem;justify-items:start;padding-top:1rem;border-top:1px solid var(--ink)}
.rt-case-t{font-size:clamp(2rem,1.5rem + 2vw,3.4rem);line-height:1}
.rt-case-d{color:var(--muted);font-size:1.1rem}
.rt-case-a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:500}
.rt-case-nav{display:flex;flex-wrap:wrap;gap:0 1.5rem;margin-top:1.5rem}
.rt-case-nav a{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:500}
.rt-x{margin-left:auto}
.rt-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.rt-credits{display:grid;gap:1rem}
@media (min-width:56rem){.rt-credits{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:baseline}.rt-credits .rt-k{grid-column:1/3}.rt-cl{grid-column:3/13}}
.rt-k{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:0}
.rt-cl{display:flex;flex-wrap:wrap;border-top:1px solid var(--ink)}
.rt-cl li{flex:1 1 14rem;padding:1rem 1.5rem 1rem 0;border-bottom:1px solid var(--edge);font-family:var(--font-display);font-size:clamp(1.4rem,1.1rem + 1.2vw,2.2rem);font-weight:400;letter-spacing:-.01em}
.rt-svc-grid,.rt-about-grid,.rt-faq{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.rt-svc-grid,.rt-faq{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-svc-grid>div:first-child,.rt-faq>.rt-h2{grid-column:1/6}.rt-svc-grid>div:last-child,.rt-faq>div{grid-column:7/13}.rt-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:center}.rt-about-media{grid-column:1/6}.rt-about-copy{grid-column:7/12}}
.rt-svc{border-top:1px solid var(--ink)}
.rt-svc li{display:grid;grid-template-columns:2.5rem 1fr auto;gap:.3rem 1.5rem;align-items:baseline;padding:1.3rem 0;border-bottom:1px solid var(--edge)}
.rt-svc h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem)}
.rt-svc p{grid-column:2;color:var(--muted)}
.rt-svc strong{grid-column:3;grid-row:1;font-family:var(--font-body);font-size:1.15rem;font-weight:500;font-variant-numeric:tabular-nums}
.rt-incl{margin-top:2.5rem}
.rt-incl h3{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:0}
.rt-incl ul{margin-top:.75rem;border-top:1px solid var(--edge)}
.rt-incl li{padding:.6rem 0;border-bottom:1px solid var(--edge)}
.rt-about-media{margin:0}
.rt-about-k{padding-bottom:.75rem;border-bottom:1px solid var(--ink)}
.rt-about-media>div{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.rt-about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.rt-about-media figcaption{padding-top:.7rem;font-size:.9rem;color:var(--muted)}
.rt-h2{font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);line-height:1;letter-spacing:-.02em}
.rt-h2.big{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem)}
.rt-p{margin-top:1.1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.rt-p.first{font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.7rem);line-height:1.3;letter-spacing:0;color:var(--ink)}
.rt-soc{margin-top:1.5rem}
.socials a{border-width:1px;border-radius:0}
.rt-quotes{display:grid;border-top:1px solid var(--ink)}
.rt-q{display:grid;gap:.75rem;padding-block:clamp(1.5rem,1rem + 2vw,2.75rem);border-bottom:1px solid var(--edge)}
.rt-q blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);line-height:1.15;letter-spacing:-.01em}
.rt-q figcaption{color:var(--muted)}
.rt-contact{border-top:1px solid var(--ink)}
.rt-loan{padding:clamp(1.25rem,.5rem + 3vw,3.5rem);border:1px solid var(--ink);background:color-mix(in srgb,var(--bg) 55%,#fff);counter-reset:fld}
.rt-loan-to{display:flex;gap:.75rem;align-items:baseline;margin:0 0 clamp(1.25rem,1rem + 1.5vw,2.25rem);padding-bottom:.75rem;border-bottom:1px solid var(--edge);font-size:.95rem;color:var(--muted)}
.rt-loan-to span{font-weight:600;color:var(--ink)}
.rt-loan-notes{display:grid;gap:1rem 2.5rem;margin-top:clamp(1.25rem,1rem + 1.5vw,2.25rem);padding-block:1.1rem;border-block:1px solid var(--edge);color:var(--muted)}
.rt-loan-notes p{margin:0;max-width:34rem;line-height:1.55}
@media (min-width:48rem){.rt-loan-notes{grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));align-items:center}}
.rt-form{margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
.rt-form .form{gap:0 2.5rem}
@media (min-width:56rem){.rt-form .form{display:grid;grid-template-columns:1fr 1fr}.rt-form .row{display:contents}.rt-form .field:has(textarea),.rt-form .btn,.rt-form .form-note{grid-column:1/-1}}
.rt-form .row{gap:0 2.5rem}
.rt-form .field{display:grid;gap:.25rem;padding:.9rem 0;border-bottom:1px solid var(--edge)}
.rt-form .field label{font-size:.92rem;font-weight:600}
.rt-form .field label::before{counter-increment:fld;content:counter(fld,decimal-leading-zero);display:inline-block;width:2.25rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--muted)}
.field input,.field select,.field textarea{min-height:2.6rem;border:0;border-radius:0;background-color:transparent;padding:.4rem 0}
.field textarea{min-height:7rem}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1px 0 var(--ink)}
.rt-form .btn{margin-top:1.5rem;width:100%;min-height:3.4rem}
.rt-form .form-note{margin-top:.75rem}
.rt-qa{display:grid;margin:0;border-top:1px solid var(--ink)}
.rt-qa>div{display:grid;gap:.35rem;padding:1.1rem 0 1.3rem;border-bottom:1px solid var(--edge)}
.rt-qa dt{font-family:var(--font-display);font-size:1.25rem;font-weight:400;letter-spacing:0}
.rt-qa dd{margin:0;color:var(--muted)}
.menu-panel{border-bottom:1px solid var(--ink)}
.menu-panel li a{font-family:var(--font-display);font-size:2rem;font-weight:400;letter-spacing:-.015em;padding:1rem 0}
.menu-panel .btn{border-radius:0}
.rt-ftr{padding-block:clamp(3rem,2rem + 4vw,6rem) calc(5rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ink)}
@media (min-width:60rem){.rt-ftr{padding-bottom:2rem}}
.rt-ftr-in{display:grid;gap:2.5rem}
@media (min-width:56rem){.rt-ftr-in{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-check{grid-column:1/8}.rt-wl{grid-column:9/13}.rt-wl:only-child{grid-column:1/6}}
.rt-check ol{margin-top:.75rem;border-top:1px solid var(--edge);columns:2 14rem;column-gap:1.5rem}
.rt-check li{break-inside:avoid;border-bottom:1px solid var(--edge)}
.rt-check a{display:flex;gap:.8rem;align-items:baseline;min-height:2.75rem;padding:.55rem 0;font-family:var(--font-display);font-size:1.15rem;text-decoration:none}
.rt-check a:hover{color:var(--pop)}
.rt-wl{display:grid;gap:.2rem;justify-items:start;padding:1.1rem 1.25rem 1.25rem;border:1px solid var(--edge);border-left:2px solid var(--ink);font-size:.95rem;color:var(--muted)}
.rt-wl p{margin:0}
.rt-wl-n{margin-bottom:.35rem!important;font-family:var(--font-display);font-size:1.5rem;line-height:1.1;color:var(--ink)}
.rt-wl ul{display:grid;margin-top:.6rem}
.rt-wl ul a{display:inline-flex;align-items:center;min-height:2.5rem;color:var(--ink)}
.rt-wl .rt-soc{margin-top:.5rem}
.rt-ftr-base{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem);padding-top:1rem;border-top:1px solid var(--edge);font-size:.85rem;color:var(--muted)}
.rt-ftr .legal-links{width:min(100% - 2rem,var(--max));margin:.5rem auto 0;text-align:left;color:var(--ink)}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.2rem 0;font-weight:500}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.2rem}
.mbar{box-shadow:none}
/* the piece facing you on the turning wall is framed in a hairline of the member's neon partner: the page's one lit
   line (the hovered piece keeps the member's own colour) */
.rt-card.front .rt-in:not(:hover) .rt-ph{outline-color:var(--neon)}
/* after hours */
html[data-theme="dark"] .rt-loan{background:color-mix(in srgb,var(--bg) 92%,#fff)}
html[data-theme="dark"] .rt-ph,html[data-theme="dark"] .rt-about-media>div,html[data-theme="dark"] .rt-case-media{box-shadow:0 18px 40px -18px rgba(0,0,0,.7)}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Rotunda',
  bestFor: 'Architects, interior and product photographers, illustrators and studios with a body of work to walk through',
  match: /\b(architects?|architecture|architectural|interiors?|interior design(er)?|illustrat(or|ors|ion)|3d artists?|motion design(er)?|art direct(or|ion)|set design(er)?)\b/,
  why: 'Built to walk through your work: your name rises out of the rule, then your pieces, drawn as the buildings and rooms they are, stand on a curved wall around the viewer that turns as you scroll or drag; each opens its own case study, and the project form is set like a loan form.',
  fonts: { q: 'family=Marcellus&family=Hanken+Grotesk:wght@400;500;600;700', display: ['Marcellus', 'serif'], body: ['Hanken Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the name rising out of its rule, a wall of work that leans your way; the
  // ring's own script turns the cylinder with the pinned scroll (pin).
  modes: ['light', 'dark'],
  choreo: { intro: 'mask', alive: ['pointer', 'drift'], scroll: 'pin', pace: 'medium', look: 'gallery plaster in daylight, quiet, precise' },
  art: rotundaArt,
  tokens,
  slots,
  nav,
  render,
};
