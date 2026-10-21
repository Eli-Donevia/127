// Spotlight (animated, creator): a full creator page set like the cover and inside pages of a magazine about them.
//   Object: the cover. The creator's name is the masthead, their portrait is the cover photo (drawn as the cover shoot
//   until they add one), their first links are the cover lines, the rest the contents.
//   Material: cover stock and newsprint: warm uncoated paper, black ink, one photo, hairline rules, square corners.
//   One move: unfold. The masthead's words unfold up from their baseline like a turned page and the cover photo opens
//   from its centre; the cover lines follow.
//   Pop: a page number in the member's colour: the cover line or contents entry under the pointer, and each rate as its
//   page turns open. A number, never a fill.
// Then the rest of the contents (links not on the cover), the rates as a rate card whose pages turn open on their spine
// as you scroll (the scroll moment), the brands as masthead credits, the story set as a feature in two columns with a
// drop cap beside a second photo, real questions only, and a brand inquiry form. The cover leans toward the pointer and
// springs when tapped. No sparkles, no stickers, no loops. JavaScript off and reduced motion: the complete, still
// page, the masthead sized in CSS to fit. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { esc } = require('../shared');

const id = 'spotlight';

const f1 = (n) => String(Math.round(n));

// The cover shoot drawn for the photo slots, lit like a magazine cover: one object on a seamless in the member's colour,
// a flash from the upper left with its hard shadow, glazes and metal in highlights, no outlines. The object comes from
// what the member makes: a food creator gets one hero dish (and the board at work), a podcaster the microphone (and
// the headphones), a writer the pen on an open notebook (and the desk), and anyone else the phone everything is made
// on (and the notebook beside it).
function slKind(c) {
  const t = `${c.what} ${c.profile && c.profile.id} ${(c.services || []).map((s) => s.name).join(' ')}`;
  if (/food|cook|recipe|chef|bak|kitchen|\beat|meal|grill|vegan|dinner/i.test(t)) return 'food';
  if (/podcast|radio|audio|interview|\bshow\b|voice/i.test(t)) return 'audio';
  if (/writer|newsletter|author|essay|journal|poet|book|substack|column/i.test(t)) return 'write';
  return 'phone';
}

function spotlightArt(s, { p, c, seed, index, art }) {
  if (s.slot !== 'portrait' && s.slot !== 'work') return null;
  const { w, h } = s;
  const r = art.rng(`${seed}:sl:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const mix = color.mix;
  const P2 = (x, y) => `${f1(x)} ${f1(y)}`;
  const circ = (cx, cy, rx, ry = rx) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`;
  const blob = (cx, cy, rx, ry, n = 9, j = 0.12) => {
    const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + R(-j, j); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
    const mid = (a, b) => P2((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    return `M${mid(pts[n - 1], pts[0])}${pts.map((q, i) => `Q${P2(q[0], q[1])} ${mid(q, pts[(i + 1) % n])}`).join('')}Z`;
  };
  // The flash: one hard shadow, cast down and to the right, its edge only just softened.
  const hard = (d, k = 1) => `<path d="${d}" fill="#000" opacity=".26" transform="translate(${f1(m * 0.03 * k)} ${f1(m * 0.035 * k)})" filter="url(#hs)"/>`;
  const glint = (d, wd, op = 0.75) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${f1(wd)}" stroke-linecap="round" filter="url(#sf)"/>`;
  const arc = (cx, cy, rr, a0, a1) => `M${P2(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr)}A${f1(rr)} ${f1(rr)} 0 0 1 ${P2(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr)}`;
  const g = (id, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`;
  const rg = (id, stops, at = 'cx=".42" cy=".38" r=".7"') => `<radialGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;
  const kind = slKind(c);
  const seam = mix(mix(p.primary, p.paper, 0.6), '#d8d2c8', 0.25);
  const glazeC = mix(p.accent, '#f2efe8', 0.55);
  const defs = `<filter id="hs" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.004)}"/></filter><filter id="sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(m * 0.003)}"/></filter>` +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .06 0"/></filter>` +
    `<filter id="wd" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    `<filter id="bp" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${(60 / m).toFixed(4)}" numOctaves="2" seed="5"/><feDiffuseLighting surfaceScale="2.5" lighting-color="#fff"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="1.2"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    rg('bg', [[0, mix(seam, '#fff', 0.22)], [0.7, seam], [1, mix(seam, '#000', 0.14)]], 'cx=".35" cy=".3" r=".95"') +
    rg('gz', [[0, mix(glazeC, '#fff', 0.45)], [0.8, glazeC], [1, mix(glazeC, '#000', 0.25)]], 'cx=".38" cy=".32" r=".7"') +
    rg('bt', [[0, '#d9a45a'], [0.75, '#b77a34'], [1, '#7a4a1a']], 'cx=".45" cy=".45" r=".6"') +
    rg('yk', [[0, '#ffd27a'], [0.6, '#f29a1e'], [1, '#c86a0a']], 'cx=".4" cy=".35" r=".7"') +
    rg('ew', [[0, '#ffffff'], [0.8, '#f4efe4'], [1, '#d9d0bf']], 'cx=".4" cy=".35" r=".7"') +
    g('st', [[0, '#4a4f55'], [0.25, '#eceef0'], [0.5, '#9aa0a6'], [0.8, '#d5d8db'], [1, '#3e4248']], 'x1="0" y1="0" x2="1" y2="0"') +
    g('wb', [[0, '#c99a66'], [1, '#a5754a']], 'x1="0" y1="0" x2="1" y2="1"') +
    g('lq', [[0, mix(p.primary, '#000', 0.55)], [0.3, mix(p.primary, '#fff', 0.15)], [0.45, mix(p.primary, '#000', 0.1)], [1, mix(p.primary, '#000', 0.6)]], 'x1="0" y1="0" x2="0" y2="1"') +
    g('gs', [[0, '#3a3e44'], [0.5, '#16181b'], [1, '#050607']], 'x1="0" y1="0" x2="1" y2="1"') +
    g('pp', [[0, '#fbfaf6'], [1, '#ece8df']], 'x1="0" y1="0" x2="1" y2="1"') +
    g('lm', [[0, '#fff3a6'], [1, '#f2c832']], 'x1="0" y1="0" x2="1" y2="1"') +
    g('lf', [[0, '#2f6a22'], [0.6, '#4f9a36'], [1, '#9cc96a']], 'x1="0" y1="1" x2="1" y2="0"') +
    `<pattern id="ms" width="${f1(m * 0.012)}" height="${f1(m * 0.012)}" patternUnits="userSpaceOnUse"><circle cx="${f1(m * 0.006)}" cy="${f1(m * 0.006)}" r="${(m * 0.0032).toFixed(1)}" fill="#000" fill-opacity=".55"/></pattern>`;
  let body = `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;

  // One hero dish from above: a glazed bowl of noodles in broth, a soft egg cut open, greens, chilli oil, chopsticks.
  const noodles = (x, y, u) => {
    const b = u * 0.8;
    let nd = '';
    // The noodles lie in a loose nest: each strand its own angle and length, waved along its run.
    for (let i = 0; i < 30; i++) {
      const t = R(-0.3, 0.3), len = b * R(0.6, 0.95), sx = x - b * 0.72 + R(0, 0.2) * b, sy = y - b * 0.55 + i * b * 0.037 + R(-0.015, 0.015) * b, ux = Math.cos(t), uy = Math.sin(t), seg = len / 8, amp = b * R(0.015, 0.03);
      nd += `M${P2(sx, sy)}`;
      for (let k = 1; k <= 8; k++) { const s2 = k % 2 ? 1 : -1, cx2 = sx + ux * seg * (k - 0.5) - uy * amp * s2, cy2 = sy + uy * seg * (k - 0.5) + ux * amp * s2; nd += `Q${P2(cx2, cy2)} ${P2(sx + ux * seg * k, sy + uy * seg * k)}`; }
    }
    let o = hard(circ(x, y, u)) + `<path d="${circ(x, y, u)}" fill="url(#gz)"/><path d="${circ(x, y, b)}" fill="url(#bt)"/><clipPath id="nc"><path d="${circ(x, y, b * 0.97)}"/></clipPath>`;
    o += `<g clip-path="url(#nc)"><path d="${nd}" fill="none" stroke="#b8893c" stroke-width="${f1(u * 0.03)}" stroke-linecap="round" transform="translate(2 4)"/><path d="${nd}" fill="none" stroke="#f3dc9a" stroke-width="${f1(u * 0.022)}" stroke-linecap="round"/><path d="${nd}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="${f1(u * 0.007)}" stroke-linecap="round" transform="translate(-2 -3)"/></g>`;
    [[0.32, -0.3, 0.6], [0.42, 0.12, -0.4]].forEach(([dx, dy, t]) => {
      const ex = x + dx * u, ey = y + dy * u, er = u * 0.2;
      o += `<g transform="rotate(${f1(t * 57)} ${P2(ex, ey)})">${hard(circ(ex, ey, er, er * 0.8), 0.25)}<path d="${circ(ex, ey, er, er * 0.8)}" fill="url(#ew)"/><path d="${circ(ex - er * 0.05, ey, er * 0.52, er * 0.46)}" fill="url(#yk)"/>${glint(arc(ex - er * 0.1, ey - er * 0.05, er * 0.3, 3.6, 4.5), er * 0.06, 0.8)}</g>`;
    });
    let sc = '';
    for (let i = 0; i < 12; i++) { const a = R(0, 6.3), d = b * R(0.1, 0.75), cx = x - b * 0.25 + Math.cos(a) * d * 0.6, cy = y + Math.sin(a) * d * 0.7; sc += circ(cx, cy, u * 0.022); }
    // Oil on the broth catching the flash, and the flash itself on the surface.
    o += `<path d="${Array.from({ length: 16 }, () => circ(x + R(-0.7, 0.7) * b, y + R(-0.7, 0.7) * b, u * R(0.008, 0.022))).join('')}" fill="#f6d58a" opacity=".55"/><ellipse cx="${f1(x - b * 0.35)}" cy="${f1(y - b * 0.45)}" rx="${f1(b * 0.22)}" ry="${f1(b * 0.08)}" fill="#fff" opacity=".22" transform="rotate(-35 ${P2(x - b * 0.35, y - b * 0.45)})" filter="url(#sf)"/>`;
    o += `<path d="M${P2(x - b * 0.75, y + b * 0.3)}q${P2(b * 0.3, -b * 0.5)} ${P2(b * 0.62, -b * 0.26)}q${P2(-b * 0.12, b * 0.4)} ${P2(-b * 0.62, b * 0.26)}Z" fill="url(#lf)"/><path d="M${P2(x - b * 0.72, y + b * 0.28)}q${P2(b * 0.3, -b * 0.38)} ${P2(b * 0.58, -b * 0.24)}" fill="none" stroke="#bfe08e" stroke-width="${f1(u * 0.012)}"/>` +
      `<path d="${sc}" fill="#a8d27a" stroke="#4f8a34" stroke-width="${f1(u * 0.009)}"/><path d="${Array.from({ length: 7 }, () => circ(x + R(-0.6, 0.6) * b, y + R(-0.6, 0.6) * b, u * R(0.02, 0.04))).join('')}" fill="#c0281a" opacity=".55"/>` +
      glint(arc(x, y, u * 0.93, 3.3, 4.6), u * 0.035, 0.85) + glint(arc(x, y, b * 0.98, 0.3, 1.2), u * 0.012, 0.5);
    const cs = (dy) => `<path d="M${P2(x + u * 0.1, y - u * 1.05 + dy)}l${P2(u * 1.3, u * 0.62)}l${P2(-u * 0.01, u * 0.04)}l${P2(-u * 1.3, -u * 0.58)}Z" fill="url(#wb)"/>`;
    return o + hard(`M${P2(x + u * 0.1, y - u * 1.05)}l${P2(u * 1.3, u * 0.62)}l${P2(-u * 0.01, u * 0.12)}l${P2(-u * 1.3, -u * 0.58)}Z`, 0.5) + cs(0) + cs(u * 0.08);
  };
  // At work: the board, a chef's knife in steel, a lemon cut open, a bunch of herbs.
  const board = (x, y, bw, bh) => {
    let o = hard(`M${P2(x, y)}h${f1(bw)}v${f1(bh)}h${f1(-bw)}Z`) + `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(bw * 0.04)}" fill="url(#wb)"/><rect x="${f1(x)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(bw * 0.04)}" fill="#000" filter="url(#wd)" opacity=".18"/><path d="M${P2(x + bw * 0.04, y + 2)}h${f1(bw * 0.92)}" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>`;
    const kx = x + bw * 0.12, ky = y + bh * 0.72, kl = bw * 0.8;
    o += `<g transform="rotate(-14 ${P2(kx, ky)})">${hard(`M${P2(kx, ky)}h${f1(kl)}v${f1(kl * 0.1)}h${f1(-kl)}Z`, 0.3)}<path d="M${P2(kx, ky)}h${f1(kl * 0.6)}v${f1(kl * 0.06)}c${P2(-kl * 0.2, kl * 0.06)} ${P2(-kl * 0.45, kl * 0.04)} ${P2(-kl * 0.6, -kl * 0.02)}Z" fill="url(#st)"/><path d="M${P2(kx, ky)}h${f1(kl * 0.6)}" stroke="#fff" stroke-opacity=".8" stroke-width="2"/><rect x="${f1(kx + kl * 0.6)}" y="${f1(ky - kl * 0.004)}" width="${f1(kl * 0.38)}" height="${f1(kl * 0.07)}" rx="${f1(kl * 0.03)}" fill="url(#gs)"/><path d="${circ(kx + kl * 0.72, ky + kl * 0.033, kl * 0.008)}${circ(kx + kl * 0.86, ky + kl * 0.033, kl * 0.008)}" fill="url(#st)"/></g>`;
    const lx = x + bw * 0.7, ly = y + bh * 0.3, lr = bh * 0.15;
    let seg = '';
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, a2 = a + 0.6; seg += `M${P2(lx, ly)}L${P2(lx + Math.cos(a) * lr * 0.78, ly + Math.sin(a) * lr * 0.78)}A${f1(lr * 0.78)} ${f1(lr * 0.78)} 0 0 1 ${P2(lx + Math.cos(a2) * lr * 0.78, ly + Math.sin(a2) * lr * 0.78)}Z`; }
    o += hard(circ(lx, ly, lr), 0.3) + `<path d="${circ(lx, ly, lr)}" fill="#e9b81e"/><path d="${circ(lx, ly, lr * 0.88)}" fill="#fbf3d0"/><path d="${seg}" fill="url(#lm)"/>` + glint(arc(lx, ly, lr * 0.6, 3.5, 4.5), lr * 0.05);
    let lv = '';
    for (let i = 0; i < 9; i++) { const a = -2.4 + i * 0.25, l = bh * R(0.16, 0.22), sx = x + bw * 0.28, sy = y + bh * 0.4, ex = sx + Math.cos(a) * l, ey = sy + Math.sin(a) * l, nx = -Math.sin(a) * l * 0.25, ny = Math.cos(a) * l * 0.25; lv += `M${P2(sx, sy)}Q${P2((sx + ex) / 2 + nx, (sy + ey) / 2 + ny)} ${P2(ex, ey)}Q${P2((sx + ex) / 2 - nx, (sy + ey) / 2 - ny)} ${P2(sx, sy)}Z`; }
    return o + hard(lv, 0.2) + `<path d="${lv}" fill="#3f7a2c"/><path d="${lv}" fill="none" stroke="#9fd06a" stroke-opacity=".5" stroke-width="1.5"/>`;
  };
  // A studio microphone on its mount, side on: the grille's mesh, chrome bands lit by the flash, the shock mount.
  const mic = (x, y, mw, mh) => {
    const body2 = `M${P2(x - mw / 2, y)}a${f1(mw / 2)} ${f1(mw / 2)} 0 0 1 ${f1(mw)} 0v${f1(mh)}h${f1(-mw)}Z`;
    return hard(body2) + hard(`M${P2(x - mw * 0.08, y + mh)}h${f1(mw * 0.16)}v${f1(h)}h${f1(-mw * 0.16)}Z`) + `<rect x="${f1(x - mw * 0.08)}" y="${f1(y + mh)}" width="${f1(mw * 0.16)}" height="${f1(h)}" fill="url(#st)"/>` +
      `<path d="${body2}" fill="url(#st)"/><path d="M${P2(x - mw * 0.46, y)}a${f1(mw * 0.46)} ${f1(mw * 0.46)} 0 0 1 ${f1(mw * 0.92)} 0v${f1(mh * 0.5)}h${f1(-mw * 0.92)}Z" fill="url(#ms)"/>` +
      `<rect x="${f1(x - mw / 2)}" y="${f1(y + mh * 0.5)}" width="${f1(mw)}" height="${f1(mh * 0.06)}" fill="url(#st)"/><rect x="${f1(x - mw / 2)}" y="${f1(y + mh * 0.56)}" width="${f1(mw)}" height="${f1(mh * 0.44)}" fill="url(#gs)"/>` +
      `<path d="M${P2(x - mw * 0.72, y + mh * 0.62)}a${f1(mw * 0.72)} ${f1(mw * 0.3)} 0 0 0 ${f1(mw * 1.44)} 0" fill="none" stroke="#1c1e21" stroke-width="${f1(mw * 0.06)}"/><path d="M${P2(x - mw * 0.72, y + mh * 0.62)}v${f1(-mh * 0.12)}M${P2(x + mw * 0.72, y + mh * 0.62)}v${f1(-mh * 0.12)}" stroke="#1c1e21" stroke-width="${f1(mw * 0.06)}" stroke-linecap="round"/>` +
      glint(`M${P2(x - mw * 0.3, y - mw * 0.3)}v${f1(mh * 0.75)}`, mw * 0.05, 0.6);
  };
  // Headphones lying flat: two padded cups in leather, the band between them catching the light.
  const cans = (x, y, u) => {
    const cup = (cx) => hard(circ(cx, y, u * 0.32, u * 0.38), 0.4) + `<path d="${circ(cx, y, u * 0.32, u * 0.38)}" fill="url(#gs)"/><path d="${circ(cx, y, u * 0.24, u * 0.3)}" fill="#2a2c30" filter="url(#bp)"/>` + glint(arc(cx, y, u * 0.28, 3.6, 4.6), u * 0.03, 0.55);
    const band = `M${P2(x - u * 0.7, y - u * 0.2)}C${P2(x - u * 0.7, y - u * 1.2)} ${P2(x + u * 0.7, y - u * 1.2)} ${P2(x + u * 0.7, y - u * 0.2)}`;
    return `<path d="${band}" fill="none" stroke="#000" stroke-opacity=".26" stroke-width="${f1(u * 0.12)}" transform="translate(${f1(m * 0.03)} ${f1(m * 0.035)})"/><path d="${band}" fill="none" stroke="#1d1f22" stroke-width="${f1(u * 0.12)}"/>` + glint(band, u * 0.02, 0.5) + cup(x - u * 0.7) + cup(x + u * 0.7);
  };
  // An open notebook (ruled, nothing written) and a lacquered pen across it.
  const notebook = (x, y, nw, nh, a) => {
    let rule = '';
    for (let i = 1; i < 14; i++) rule += `M${P2(x + nw * 0.04, y + (i / 14) * nh)}H${f1(x + nw * 0.96)}`;
    return `<g transform="rotate(${f1(a)} ${P2(x + nw / 2, y + nh / 2)})">${hard(`M${P2(x, y)}h${f1(nw)}v${f1(nh)}h${f1(-nw)}Z`)}<rect x="${f1(x - nw * 0.01)}" y="${f1(y - nh * 0.01)}" width="${f1(nw * 1.02)}" height="${f1(nh * 1.02)}" fill="${mix(p.primary, '#000', 0.35)}"/><rect x="${f1(x)}" y="${f1(y)}" width="${f1(nw)}" height="${f1(nh)}" fill="url(#pp)"/><path d="${rule}" stroke="#7d9ac0" stroke-opacity=".35" stroke-width="1.2"/><path d="M${P2(x + nw / 2, y)}v${f1(nh)}" stroke="#000" stroke-opacity=".18" stroke-width="${f1(nw * 0.012)}" filter="url(#sf)"/></g>`;
  };
  const pen = (x, y, l, a) => `<g transform="rotate(${f1(a)} ${P2(x, y)})">${hard(`M${P2(x, y - l * 0.035)}h${f1(l)}v${f1(l * 0.07)}h${f1(-l)}Z`, 0.5)}<rect x="${f1(x)}" y="${f1(y - l * 0.035)}" width="${f1(l * 0.82)}" height="${f1(l * 0.07)}" rx="${f1(l * 0.035)}" fill="url(#lq)"/><rect x="${f1(x + l * 0.5)}" y="${f1(y - l * 0.037)}" width="${f1(l * 0.03)}" height="${f1(l * 0.074)}" fill="url(#st)"/><path d="M${P2(x + l * 0.82, y - l * 0.028)}L${P2(x + l, y)}L${P2(x + l * 0.82, y + l * 0.028)}Z" fill="url(#st)"/>` + glint(`M${P2(x + l * 0.04, y - l * 0.018)}H${f1(x + l * 0.78)}`, l * 0.008, 0.8) + '</g>';
  // A phone face up, its black glass holding the flash and the room.
  const phone = (x, y, pw, a) => {
    const ph = pw * 2.06;
    return `<g transform="rotate(${f1(a)} ${P2(x, y)})">${hard(`M${P2(x - pw / 2, y - ph / 2)}h${f1(pw)}v${f1(ph)}h${f1(-pw)}Z`)}<rect x="${f1(x - pw / 2)}" y="${f1(y - ph / 2)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(pw * 0.14)}" fill="url(#st)"/><rect x="${f1(x - pw * 0.47)}" y="${f1(y - ph * 0.485)}" width="${f1(pw * 0.94)}" height="${f1(ph * 0.97)}" rx="${f1(pw * 0.12)}" fill="url(#gs)"/><clipPath id="ph"><rect x="${f1(x - pw * 0.47)}" y="${f1(y - ph * 0.485)}" width="${f1(pw * 0.94)}" height="${f1(ph * 0.97)}" rx="${f1(pw * 0.12)}"/></clipPath><path d="M${P2(x - pw * 0.6, y - ph * 0.55)}h${f1(pw * 0.42)}l${P2(pw * 0.7, ph * 1.1)}h${f1(-pw * 0.42)}Z" fill="#fff" opacity=".1" clip-path="url(#ph)"/><rect x="${f1(x - pw * 0.12)}" y="${f1(y - ph * 0.46)}" width="${f1(pw * 0.24)}" height="${f1(pw * 0.06)}" rx="${f1(pw * 0.03)}" fill="#000"/></g>`;
  };
  const cupOf = (x, y, rr) => hard(circ(x, y, rr * 1.4)) + `<path d="${circ(x, y, rr * 1.4)}" fill="url(#ew)"/><path d="${circ(x, y, rr)}" fill="url(#ew)"/><path d="${circ(x, y, rr * 0.84)}" fill="#4a2a16"/><path d="${circ(x, y, rr * 0.74)}" fill="#6b4226"/>` + glint(arc(x, y, rr * 0.92, 3.4, 4.6), rr * 0.06, 0.9);

  const port = s.slot === 'portrait';
  if (kind === 'food') body += port ? noodles(w * 0.44, h * 0.56, m * 0.4) : board(w * 0.12, h * 0.14, w * 0.76, h * 0.72);
  else if (kind === 'audio') body += port ? mic(w * 0.5, h * 0.2, m * 0.3, m * 0.62) : cans(w * 0.5, h * 0.6, m * 0.3);
  else if (kind === 'write') body += port ? notebook(w * 0.12, h * 0.16, w * 0.76, h * 0.68, -4) + pen(w * 0.2, h * 0.7, w * 0.7, -28) : notebook(w * 0.08, h * 0.22, w * 0.6, h * 0.56, 6) + cupOf(w * 0.8, h * 0.32, m * 0.1) + pen(w * 0.18, h * 0.84, w * 0.6, -6);
  else body += port ? phone(w * 0.5, h * 0.5, m * 0.3, -12) : notebook(w * 0.1, h * 0.2, w * 0.58, h * 0.6, -5) + phone(w * 0.8, h * 0.52, m * 0.2, 14);
  body += `<rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  const all = defs.match(/<(filter|linearGradient|radialGradient|pattern) id="[^"]+"[\s\S]*?<\/\1>/g);
  const used = all.filter((x) => body.includes(`url(#${x.match(/id="([^"]+)"/)[1]})`)).join('');
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, used + ids, body);
}


function tokens(p) {
  return { bg: color.mix(p.paper, '#f4f4f1', 0.9), dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#14100d', 0.6) };
}

function slots(c) {
  const who = c.owner && c.owner !== c.name ? c.owner : c.name;
  return [
    { slot: 'portrait', file: 'portrait.jpg', w: 1200, h: 1000, style: 'portrait', alt: `${who}, ${c.whatShort || 'creator'}` },
    { slot: 'work', file: 'at-work.jpg', w: 1000, h: 1100, style: 'tile', alt: `${who} at work` },
  ];
}

function nav(c) {
  return [
    c.links.length > 3 && { label: 'Contents', href: '#links' },
    c.services.length && { label: 'Rates', href: '#rates' },
    { label: 'About', href: '#about' },
    c.faq.length >= 2 && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// Where a link goes, from its address only.
const PLACES = [
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/instagram\.com/i, 'Instagram'],
  [/tiktok\.com/i, 'TikTok'],
  [/twitch\.tv/i, 'Twitch'],
  [/(^|\/\/|\.)x\.com|twitter\.com/i, 'X'],
  [/linkedin\.com/i, 'LinkedIn'],
  [/facebook\.com/i, 'Facebook'],
  [/spotify\.com|podcasts\.apple|anchor\.fm/i, 'Podcast'],
  [/substack\.com|beehiiv\.com|kit\.com|convertkit|buttondown/i, 'Newsletter'],
  [/pinterest\./i, 'Pinterest'],
  [/threads\.net/i, 'Threads'],
  [/etsy\.com|shopify|amazon\.|stan\.store|gumroad|bigcartel/i, 'Shop'],
];
function whereOf(l) {
  const hit = PLACES.find(([re]) => re.test(l.href));
  if (hit) return hit[1];
  if (/^mailto:/.test(l.href)) return 'Email';
  return String(l.href).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

// "YouTube: New recipe every Tuesday" -> kicker "YouTube", line "New recipe every Tuesday".
function split(l) {
  const m = String(l.label).match(/^([^:]{2,24}):\s*(.+)$/);
  return m ? { kick: m[1], line: m[2] } : { kick: whereOf(l), line: l.label };
}

// The masthead: words (the intro unfolds them), on as many lines as the markup says, sized in CSS from the longest
// line so the cover's height is fixed before the font arrives.
function masthead(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const n = words.join(' ').length;
  const lines = words.length > 1 && n > 13 ? 2 : 1;
  let groups = [words];
  if (lines === 2) {
    let best = null;
    for (let j = 1; j < words.length; j++) {
      const g = [words.slice(0, j), words.slice(j)];
      const worst = Math.max(...g.map((x) => x.join(' ').length));
      if (!best || worst < best.worst) best = { worst, g };
    }
    groups = best.g;
  }
  const longLine = Math.max(...groups.map((g) => g.join(' ').length));
  // Unbounded at 800, in capitals: about 0.82em a letter.
  const fs = Math.min(15, 112 / Math.max(longLine, 4)).toFixed(2);
  const fsm = Math.min(19, 108 / Math.max(Math.max(...words.map((w) => w.length)), 4)).toFixed(2);
  const html = groups.map((g) => `<span class="ml">${g.map((w) => `<span class="mw">${esc(w)}</span>`).join(' ')}</span>`).join(' ');
  // The widest line and the longest word in ems (Unbounded 800 caps, tight tracking, letter by letter), so CSS alone
  // sizes the masthead to its column with JavaScript off; the script only nudges it closer.
  const em = (t) => [...t.toUpperCase()].reduce((n, ch) => n + (/\s/.test(ch) ? 0.32 : /[IL1!.,']/.test(ch) ? 0.5 : /J/.test(ch) ? 0.75 : /[MW]/.test(ch) ? 1.12 : /[OQGCD]/.test(ch) ? 0.98 : 0.84), 0) * 1.02 + 0.05;
  const widest = (list) => Math.max(...list.map(em)).toFixed(2);
  return { html, fs, fsm, stack: words.length > 1, em: widest(groups.map((g) => g.join(' '))), emw: widest(words) };
}

function render(c) {
  // A person only when the facts name one; otherwise the page speaks as the business.
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  // Brand work is the creator's ask; anyone else gets plain inquiries, with no brand field.
  const brandy = c.profile.template === 'creator' || c.profile.id === 'creator' || (c.clients || []).length > 0;
  const ask = brandy ? 'Brand inquiries' : 'Inquiries';
  const mast = masthead(c.name);
  const mag = (html) => html.replace('<a ', '<a data-mag ');
  const links = c.links.map((l) => ({ ...l, ...split(l), where: whereOf(l) }));
  const cover = links.slice(0, 3);
  const folio = [c.handle, c.whatShort, c.area && !c.online ? c.area : ''].filter(Boolean);

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap">
${folio.length ? `<p class="folio" data-ci="then" data-ci-from="fade">${folio.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
<h1 class="mast${mast.stack ? ' stack' : ''}" id="hero-title" data-ci="head" style="--fs:${mast.fs}vw;--fsm:${mast.fsm}vw;--em:${mast.em};--emw:${mast.emw}">${mast.html}</h1>
<div class="cover-grid">
<figure class="cover" data-alive="0.5"><div class="cv" data-ci="subject">${P.img(c, 'portrait', { cls: 'cv-img', eager: true }).replace('<img ', '<img data-par="0.04" ')}</div></figure>
<div class="cover-side">
<p class="tagline" data-ci="then">${esc(c.heroSub)}</p>
${cover.length ? `<ul class="lines" data-ci="then" data-ci-from="mask">${cover.map((l, i) => `<li><a href="${esc(l.href)}"><span class="ln-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ln-k">${esc(l.kick)}</span><span class="ln-t">${esc(l.line)}</span>${icon('arrowUpRight', { size: 20 })}</a></li>`).join('')}</ul>` : ''}
<div class="ctas" data-ci="then"><a class="btn btn-ink btn-lg" data-mag href="#contact">${ask}</a>${P.socials(c, { cls: 'hero-social' })}</div>
</div>
</div>
</div>
</section>`;

  // The contents page: the links that aren't on the cover, numbered on from the cover lines, with where each goes.
  const inside = links.slice(3);
  const contents = inside.length
    ? `<section class="sec contents" id="links" aria-labelledby="links-title"><div class="wrap ct-grid">
<h2 class="ct-title" id="links-title" data-split>Also inside</h2>
<ol class="toc" start="4">${inside.map((l, i) => `<li data-rv style="--d:${i % 6}"><a href="${esc(l.href)}"><span class="toc-n" aria-hidden="true">${String(i + 4).padStart(2, '0')}</span><span class="toc-t">${esc(l.line)}</span><span class="toc-w">${esc(l.kick === l.where ? l.where : `${l.kick}, ${l.where}`)}</span>${icon('arrowUpRight', { size: 22 })}</a></li>`).join('')}</ol>
</div></section>`
    : '';

  // The rates as the magazine's rate card: one page a format, its price set large, turning open on its spine as you
  // scroll (the scroll moment). Still frame: every page open.
  const inclList = c.included.length ? `<ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const rates = c.services.length
    ? `<section class="sec rates" id="rates" aria-labelledby="rates-title"><div class="wrap">
<div class="rc-head"><h2 class="h2" id="rates-title" data-split>Rates</h2>${c.services.length > 1 ? `<p class="rc-k">${c.services.length} formats</p>` : ''}</div>
<ol class="rc" data-sc>${c.services.map((sv, i) => `<li class="rc-page" data-sc-part><span class="rc-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(sv.name)}</h3>${sv.duration || sv.blurb ? `<p class="rc-sub">${esc([sv.duration, sv.blurb].filter(Boolean).join(', '))}</p>` : ''}${sv.priceText ? `<p class="rc-p">${esc(sv.priceText)}</p>` : ''}</li>`).join('')}</ol>
${inclList}
<p class="rc-go"><a class="btn btn-paper" href="#contact">${ask}</a></p>
</div></section>`
    : '';

  const cl = c.clients || [];
  // The brands as the masthead's credits: a small label, the names in one ink, ruled like a magazine's staff box.
  const brands = cl.length
    ? `<section class="sec brands" aria-labelledby="brands-title"><div class="wrap credits">
<h2 class="cr-k" id="brands-title">Worked with</h2>
<ul class="cr-list">${cl.map((x, i) => `<li data-rv style="--d:${i % 6}">${esc(x)}</li>`).join('')}</ul>
</div></section>`
    : '';

  // The story as a feature: a kicker, the text in two columns with a drop cap, the second photo set beside it as a tall
  // plate with its caption.
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap feature">
<div class="ft-copy">
<h2 class="ft-k" id="about-title">${esc(`About ${person || c.name}`)}</h2>
<div class="ft-cols${c.aboutParas.join(' ').length > 360 ? ' two' : ''}" data-rv>${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
</div>
<figure class="ft-media" data-rv="mask"><div>${P.img(c, 'work', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div><figcaption>${esc(c.images.work ? c.images.work.alt : '')}</figcaption></figure>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">What people say</h2><div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div></div></section>`
    : '';
  // Questions only when there are two real ones, set as the letters page: the question in the display face, the answer
  // under it. No accordion.
  const faq = c.faq.length >= 2 ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="ct-title" id="faq-title" data-split>Good to know</h2><dl class="qa">${c.faq.map((f, i) => `<div data-rv style="--d:${Math.min(i + 1, 6)}"><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const fields = [
    'name',
    'email',
    brandy && { ...P.FIELD_PRESETS.company, label: 'Brand' },
    c.services.length > 1 ? { name: 'interest', label: 'Interested in', type: 'select', options: [...c.services.map((s) => s.name), 'Something else'], half: true } : { ...P.FIELD_PRESETS.when, label: 'Timing' },
    { ...P.FIELD_PRESETS.message, label: brandy ? 'Tell me about the campaign' : 'Your message', required: true },
  ].filter(Boolean);
  // The close is the magazine's reply card: cut out along its dashed line, its head set like a section opener (the
  // ask, one line, where else to write), the fields on the card. It comes in as one piece.
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap">
<div class="reply" data-rv>
<div class="reply-head"><p class="reply-k"><span>${esc(c.name)}</span><span>Reply card</span></p><h2 class="contact-title" id="contact-title">${ask}</h2><p class="lead">${brandy ? 'Tell me about your brand and what you have in mind' : 'Tell us what you need'}${c.email ? `, or write to <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}.</p></div>
${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `${brandy ? 'Brand inquiry' : 'Inquiry'} for ${c.name}` })}
</div>
</div>
</section>`;

  // The foot is the colophon: the masthead small, what and who, the contents in one line, the year.
  const colo = [c.whatShort, c.handle, c.area && !c.online ? c.area : ''].filter(Boolean);
  const footer = `<footer class="colophon"><div class="wrap">
<p class="co-mast" aria-hidden="true">${esc(c.name)}</p>
${colo.length ? `<p class="co-line">${colo.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
${(c.nav || []).length ? `<nav aria-label="Footer"><ul class="co-nav">${c.nav.map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('')}</ul></nav>` : ''}
${P.socials(c, { cls: 'co-social', size: 18 })}
<p class="co-base">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div></footer>`;

  const m = motion();
  const body = [
    '<div class="prog" aria-hidden="true"></div>',
    P.header(c, { cls: 'hdr-sl', mark: false, cta: { label: ask, href: '#contact' } }).replace('<header class="hdr', '<header data-hdr class="hdr'),
    '<main id="main">',
    hero,
    contents,
    rates,
    brands,
    about,
    reviews,
    faq,
    contact,
    '</main>',
    footer,
    P.mobileBar({ ...c, phone: null, primary: { label: ask, href: '#contact', kind: 'form' } }),
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '80rem' } };
}

// Nudges the masthead to the width with a transform only (its size is set in CSS, so nothing shifts).
const JS = `(function(){var d=document,h=d.querySelector('.mast');
function fit(){if(!h)return;var ls=[].slice.call(h.querySelectorAll(innerWidth<640&&h.classList.contains('stack')?'.mw':'.ml'));ls.forEach(function(l){l.style.transform=''});var w=h.clientWidth,m=Math.max.apply(0,ls.map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.8,Math.min(1.12,w/m));h.style.setProperty('--fit',Math.abs(r-1)<.004?1:r.toFixed(3))}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit)})();`;

// Fallback faces sized to the real ones (width, ascent, descent), so a late font swaps in without moving a line.
const CSS = `
@font-face{font-family:'Spotlight Display Fallback';font-weight:500 750;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:130.5%;ascent-override:76.2%;descent-override:18.8%;line-gap-override:0%}
@font-face{font-family:'Spotlight Display Fallback';font-weight:751 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:132.7%;ascent-override:75.0%;descent-override:18.5%;line-gap-override:0%}
@font-face{font-family:'Spotlight Body Fallback';font-weight:400 500;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:100.4%;ascent-override:99.6%;descent-override:30.2%;line-gap-override:0%}
@font-face{font-family:'Spotlight Body Fallback';font-weight:600 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:95.3%;ascent-override:104.9%;descent-override:31.8%;line-gap-override:0%}
html:root{--font-display:"Unbounded","Spotlight Display Fallback",sans-serif;--font-body:"Hanken Grotesk","Spotlight Body Fallback",sans-serif}
:root{--ease:cubic-bezier(.16,1,.3,1);--rule:color-mix(in srgb,var(--ink) 16%,transparent)}
h1,h2,h3{font-weight:800;letter-spacing:-.04em}
.h2{font-size:clamp(2.2rem,1.4rem + 3.2vw,4.4rem);line-height:.98;text-transform:uppercase}
.lead{color:var(--muted)}
.btn{font-weight:700;letter-spacing:.01em}
.btn:hover{transform:none}
.btn-primary,.btn-ink{background:var(--ink);color:var(--bg);box-shadow:none;border-color:var(--ink)}
.btn-primary:hover,.btn-ink:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-paper{background:var(--on-dark);color:var(--dark)}
.btn-paper:hover{background:color-mix(in srgb,var(--on-dark) 85%,var(--dark))}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1rem;letter-spacing:-.02em;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;font-weight:600;font-size:.95rem;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 2px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(.5rem,.4rem + .8vw,1.25rem) clamp(3.5rem,2rem + 4vw,6rem)}
.folio{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 2rem;padding-block:.65rem;border-block:1px solid var(--ink);font-size:.92rem;font-weight:600}
.mast{--fit:1;margin-top:clamp(.75rem,1.5vw,1.5rem);font-size:min(var(--fs),calc(min(100vw - 4rem,var(--max)) / var(--em)));font-weight:800;line-height:.86;letter-spacing:-.045em;text-transform:uppercase;overflow:hidden;padding-block:.04em}
.ml{display:block;width:max-content;white-space:nowrap;transform:scale(var(--fit));transform-origin:0 50%}
.mw{display:inline-block}
@media (max-width:47.99rem){.mast{font-size:min(var(--fs),calc((100vw - 2rem) / var(--em)))}}
@media (max-width:39.99rem){.mast{font-size:min(var(--fsm),calc((100vw - 2rem) / var(--emw)))}.mast:not(.stack){font-size:min(var(--fsm),calc((100vw - 2rem) / var(--em)))}.mast.stack .ml{display:inline;transform:none}.mast.stack .mw{display:block;width:max-content;transform:scale(var(--fit));transform-origin:0 50%}}
.cover-grid{display:grid;gap:2rem;margin-top:clamp(1.25rem,1rem + 1.5vw,2.25rem)}
@media (min-width:60rem){.cover-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.cover{grid-column:1/8}.cover-side{grid-column:8/13}}
.cover{margin:0}
.cv{overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
@media (max-width:59.99rem){.cv{aspect-ratio:1}}
.cv-img{width:100%;height:110%;margin-top:-5%;object-fit:cover}
.tagline{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:700;line-height:1.08;letter-spacing:-.035em;text-wrap:balance}
.lines{margin-top:1.75rem;border-top:1px solid var(--ink)}
.lines a{display:grid;grid-template-columns:2.25rem minmax(0,1fr) auto;gap:.15rem .75rem;align-items:center;padding-block:.9rem;border-bottom:1px solid var(--rule);text-decoration:none}
.ln-n{grid-column:1;grid-row:1/3;align-self:start;padding-top:.1rem;font-family:var(--font-display);font-size:.95rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted);transition:color .2s ease}
.lines a:hover .ln-n,.lines a:focus-visible .ln-n,.toc a:hover .toc-n,.toc a:focus-visible .toc-n{color:var(--pop)}
.ln-k{grid-column:2;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ln-t{grid-column:2;font-size:1.15rem;font-weight:600;line-height:1.25}
.lines .i{grid-column:3;grid-row:1/3;transition:transform .35s var(--ease)}
.lines a:hover .ln-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:2px}
.lines a:hover .i{transform:translate(3px,-3px)}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.25rem;margin-top:1.75rem}
.socials a{border-width:1px;border-radius:0;width:2.75rem;height:2.75rem}
.contents{border-top:1px solid var(--ink)}
.ct-grid{display:grid;gap:2rem}
.ct-title{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:800;line-height:1;letter-spacing:-.04em;text-transform:uppercase}
@media (min-width:60rem){.ct-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.ct-grid>.ct-title{grid-column:1/4}.toc{grid-column:5/13}}
.toc{border-top:1px solid var(--ink)}
.toc a{display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;gap:.25rem 1rem;align-items:baseline;padding-block:clamp(1rem,.8rem + .8vw,1.5rem);border-bottom:1px solid var(--rule);text-decoration:none}
.toc-n{font-family:var(--font-display);font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted)}
.toc-t{font-family:var(--font-display);font-size:clamp(1.35rem,1.1rem + 1vw,2.1rem);font-weight:700;line-height:1.08;letter-spacing:-.035em}
.toc-w{grid-column:2;font-size:.85rem;font-weight:600;color:var(--muted)}
.toc .i{grid-column:3;grid-row:1/3;align-self:center;transition:transform .35s var(--ease)}
.toc a:hover .toc-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:.08em;text-underline-offset:.15em}
.toc a:hover .i{transform:translate(4px,-4px)}
.rates{background:var(--dark);color:var(--on-dark);--pop:var(--primary-on-dark);--focus:var(--on-dark)}
.rc-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.5rem 2rem;padding-bottom:1rem;border-bottom:1px solid var(--on-dark)}
.rc-k{font-weight:600;color:var(--muted-on-dark)}
.rc{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin-top:1.5rem;border-top:1px solid var(--line-on-dark);border-right:1px solid var(--line-on-dark);perspective:1600px}
.rc-page{display:grid;align-content:start;gap:.6rem;min-height:clamp(14rem,10rem + 10vw,20rem);padding:clamp(1.25rem,1rem + 1vw,2rem);border-left:1px solid var(--line-on-dark);border-bottom:1px solid var(--line-on-dark);background:var(--dark);transform-origin:0 50%;backface-visibility:hidden}
.rc-n{font-family:var(--font-display);font-size:.95rem;font-weight:700;color:var(--muted-on-dark);font-variant-numeric:tabular-nums}
.rc-page h3{font-size:clamp(1.25rem,1.05rem + .8vw,1.7rem);line-height:1.1;letter-spacing:-.035em}
.rc-sub{color:var(--muted-on-dark)}
.rc-p{margin-top:auto;padding-top:1.5rem;font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.2vw,3.6rem);font-weight:800;line-height:.95;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
html.m .rc[data-sc] .rc-page[data-sc-part]{transform:rotateY(calc((1 - var(--pi,1)) * -78deg))}
html.m .rc[data-sc] .rc-page.on .rc-n{color:var(--pop)}
.incl{display:flex;flex-wrap:wrap;gap:.5rem 2rem;margin-top:clamp(1.5rem,1rem + 2vw,2.5rem);color:var(--muted-on-dark)}
.rc-go{margin-top:clamp(1.5rem,1rem + 2vw,2.5rem)}
.brands{padding-block:clamp(2.5rem,2rem + 2.5vw,4.5rem)}
.credits{display:grid;gap:1rem;padding-block:.25rem}
@media (min-width:60rem){.credits{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.cr-k{grid-column:1/4}.cr-list{grid-column:5/13}}
.cr-k{font-family:var(--font-body);font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding-top:.6rem}
.cr-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));border-top:1px solid var(--ink)}
.cr-list li{padding-block:.75rem;border-bottom:1px solid var(--rule);font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .6vw,1.5rem);font-weight:700;letter-spacing:-.03em}
.about{border-top:1px solid var(--ink)}
.feature{display:grid;gap:2rem}
@media (min-width:60rem){.feature{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.ft-copy{grid-column:1/9}.ft-media{grid-column:10/13}}
.ft-k{font-family:var(--font-body);font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding-bottom:.75rem;margin-bottom:1.25rem;border-bottom:1px solid var(--ink)}
.ft-cols{max-width:40rem;font-size:1.1rem;line-height:1.65}
.ft-cols.two{max-width:none;columns:2 17rem;column-gap:2.5rem;column-rule:1px solid var(--rule)}
.ft-cols p+p{margin-top:1rem}
.ft-cols.two p:first-child::first-letter{float:left;margin:.06em .12em 0 0;font-family:var(--font-display);font-size:4.1em;font-weight:800;line-height:.8;color:var(--ink)}
.ft-media{margin:0}
.ft-media>div{overflow:hidden;aspect-ratio:3/4;background:var(--surface)}
@media (max-width:59.99rem){.ft-media>div{aspect-ratio:4/3}}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.ft-media figcaption{margin-top:.6rem;font-size:.85rem;font-weight:600;color:var(--muted)}
.qa{border-top:1px solid var(--ink)}
.qa>div{display:grid;gap:.35rem;padding-block:1.1rem;border-bottom:1px solid var(--rule)}
.qa dt{font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .6vw,1.45rem);font-weight:700;letter-spacing:-.03em}
.qa dd{margin:0;max-width:40rem;color:var(--muted)}
.quotes{display:grid;border-top:1px solid var(--ink)}
.quote{display:grid;gap:.8rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--rule)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);font-weight:700;line-height:1.12;letter-spacing:-.035em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:700;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.ct-title{grid-column:1/4}.faq-grid>.qa{grid-column:5/13}}
.contact{border-top:1px solid var(--ink)}
.reply{position:relative;max-width:60rem;margin-inline:auto;padding:clamp(1.25rem,1rem + 2vw,3rem);border:4px double var(--ink);background:color-mix(in srgb,var(--bg) 55%,#ffffff);outline:1.5px dashed color-mix(in srgb,var(--ink) 45%,transparent);outline-offset:clamp(.6rem,.4rem + .6vw,1rem)}
.reply-head{display:grid;gap:.9rem;padding-bottom:clamp(1.25rem,1rem + 1vw,2rem);margin-bottom:clamp(1.25rem,1rem + 1vw,2rem);border-bottom:1px solid var(--ink)}
.reply-k{display:flex;justify-content:space-between;gap:1rem;font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.contact-title{font-size:clamp(2.4rem,1.4rem + 4.4vw,5.6rem);line-height:.92;letter-spacing:-.05em;text-transform:uppercase}
.reply .lead{max-width:36rem}
.reply .lead a{color:var(--ink)}
@media (min-width:48rem){.reply .form{display:grid;grid-template-columns:1fr 1fr;gap:0 2rem}.reply .form>*{grid-column:1/-1}.reply .form>.field:not(:has(textarea)){grid-column:auto}}
.ct-list{margin-top:1.75rem}
.ct-list .i{color:var(--ink)}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid var(--ink);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--ink)}
.form-wrap{padding:clamp(1.25rem,1rem + 1.5vw,2.25rem);border:4px double var(--ink)}
.colophon{padding-block:clamp(3rem,2rem + 3vw,5rem) calc(2rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ink);text-align:center}
.colophon .wrap{display:grid;justify-items:center;gap:1rem}
.co-mast{font-family:var(--font-display);font-size:clamp(1.8rem,1.2rem + 2.4vw,3.4rem);font-weight:800;line-height:.9;letter-spacing:-.045em;text-transform:uppercase}
.co-line{display:flex;flex-wrap:wrap;justify-content:center;gap:.3rem 0;font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.co-line span+span::before{content:'';display:inline-block;width:1.25rem;height:1px;margin-inline:.6rem;vertical-align:middle;background:currentColor}
.co-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:.25rem 1.5rem;padding-block:.75rem;border-block:1px solid var(--rule)}
.co-nav a{display:inline-block;padding-block:.35rem;font-weight:600;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:background-size .35s var(--ease)}
.co-nav a:hover{background-size:100% 1px}
.co-base{font-size:.85rem;color:var(--muted)}
.colophon .legal-links{margin-top:.25rem}
.menu-panel{border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}
.menu-panel ul{counter-reset:pg}
.menu-panel li a{display:flex;align-items:baseline;gap:.9rem;padding:.9rem 0;border-bottom:1px solid var(--rule);font-size:1.9rem;font-weight:800;letter-spacing:-.045em;text-transform:uppercase}
.menu-panel li a::before{counter-increment:pg;content:counter(pg,decimal-leading-zero);font-size:.85rem;font-weight:700;letter-spacing:0;color:var(--muted)}
.menu-panel li a:hover::before{color:var(--pop)}
.menu-panel .btn{background:var(--ink);color:var(--bg)}
.mbar{box-shadow:none;border-top:1px solid var(--ink)}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Spotlight',
  bestFor: 'Creators, streamers, podcasters and writers who want a full page with their links, rates and a brand inquiry form, with motion',
  why: 'A magazine about you, with motion: your name is the masthead and unfolds like a turned page, your photo opens as the cover, your links are the cover lines, and your rates are a rate card whose pages turn open as you scroll.',
  fonts: { q: 'family=Unbounded:wght@500..900&family=Hanken+Grotesk:wght@400;500;600;700', display: ['Unbounded', 'grotesk'], body: ['Hanken Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the masthead unfolds, the cover leans toward you, the rate card's pages turn.
  choreo: { intro: 'unfold', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'medium', look: 'a magazine cover, crisp and editorial' },
  art: spotlightArt,
  tokens,
  slots,
  nav,
  render,
};
