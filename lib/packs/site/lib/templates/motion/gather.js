// Gather (animated, product, for an event): a workshop, pop-up, class or launch party, where the buy link is tickets.
//   Object: the ticket. A real one, set in type: the event, the date, the time, the place, the price on its stub.
//   Material: poster stock and ticket card: off-white stock, black ink, square corners, perforations, no cards.
//   One move: stamp. The date (only when the member gave one, else the event's name) is pressed onto the poster a word
//   at a time, like type in a press, and the ticket is stamped down beside it.
//   Pop: the stub's price, ringed in the member's colour like a rubber stamp (a line, never a fill).
// Then what's included as the ticket's fine print, whose stub tears off along the perforation as you scroll past (the
// scroll moment), the event drawn edge to edge, the ticket types as a box-office board, the host beside the bake, real
// questions only, and a last call on black poster stock with the date again. The ticket leans toward the pointer and
// springs when tapped. A ticket bar stays in reach between the hero and the questions. JavaScript off and reduced
// motion: the complete, still poster, the stub already torn. Its motion is the `choreo` block (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, esc } = require('../shared');

const id = 'gather';

const f1 = (n) => String(Math.round(n));

// The event drawn for its photo slots, built from light like a photograph of the bench: window light across it,
// soft shadows, hairline edges, and texture where the material has it (crust, crumb, clay, flour, paper). The kind
// comes from the facts: a bake (bread, pastry) gets the loaf and, for the host, its open crumb; a clay class the pots
// thrown that day; a painting class the palette and brushes. Anything else gets what every event runs on: admission
// tickets, blank stock with a perforation (no stand-in type: the real words are on the page).
function gaKind(c) {
  const t = `${c.what} ${c.productName} ${c.name} ${(c.included || []).join(' ')}`;
  if (/bread|sourdough|bak|pastry|pastries|loaf|loaves|dough|croissant|bagel|biscuit/i.test(t)) return 'bake';
  if (/pottery|ceramic|clay|wheel[- ]?throw|glaz/i.test(t)) return 'clay';
  if (/paint|watercolou?r|acrylic|gouache|canvas|sketch|drawing class|illustrat/i.test(t)) return 'paint';
  return 'tickets';
}

function gatherArt(s, { p, c, seed, index, art }) {
  if (s.slot !== 'hero' && s.slot !== 'host') return null;
  const { w, h } = s;
  const r = art.rng(`${seed}:ga:${s.slot}`);
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
  const shadow = (d, k = 1, op = 0.34) => `<path d="${d}" fill="#000" opacity="${op}" transform="translate(${f1(m * 0.012 * k)} ${f1(m * 0.02 * k)})" filter="url(#sh)"/>`;
  const glint = (d, wd, op = 0.6) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${f1(wd)}" stroke-linecap="round" filter="url(#sf)"/>`;
  const mass = (d, fill, tx = 'bp') => `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${fill}" filter="url(#${tx})"/>`;
  const g = (id, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`;
  const rg = (id, stops, at = 'cx=".42" cy=".38" r=".7"') => `<radialGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;
  const bump = (id, fq, sc, k = 1.25) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="2" seed="${f1(R(1, 90))}"/><feDiffuseLighting surfaceScale="${sc}" lighting-color="#fff"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="${k}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const kind = gaKind(c);
  const crust = '#9a5a2a', wood = mix('#c9ad86', p.paper, 0.25);
  const clay = mix('#b9704a', p.primary, 0.15), glaze = mix(mix(p.accent, '#e8e2d4', 0.55), p.primary, 0.08);
  const stock = mix(p.paper, '#ffffff', 0.55), tint = mix(p.primary, p.paper, 0.82);
  const defs = `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(m * 0.014)}"/></filter><filter id="sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(m * 0.003)}"/></filter><filter id="pn" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.03)}"/></filter>` +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .07 0"/></filter>` +
    `<filter id="wd" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".08 .003" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 .95"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    // Flour: fine white speckle where it was thrown, denser at the centre of the patch.
    `<filter id="fl" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="1" seed="${f1(R(1, 90))}"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -9 4.9" result="n"/><feGaussianBlur in="SourceAlpha" stdDeviation="${f1(m * 0.06)}"/><feComposite in="n" operator="in"/></filter>` +
    // The open crumb: irregular holes from noise, each lit as a hollow (bright lip on the far side, shade on the near).
    `<filter id="cb" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${(30 / m).toFixed(4)} ${(42 / m).toFixed(4)}" numOctaves="3" seed="${f1(R(1, 90))}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 16 -8.4"/><feGaussianBlur stdDeviation="${f1(m * 0.0012)}" result="b"/><feDiffuseLighting in="b" surfaceScale="-5" lighting-color="#fff"><feDistantLight azimuth="250" elevation="45"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="1.12" result="l"/><feColorMatrix in="b" values="0 0 0 0 .45 0 0 0 0 .28 0 0 0 0 .12 0 0 0 .6 0"/><feComposite in2="l"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    bump('bp', (34 / m).toFixed(4), 4.5, 1.3) + bump('bc', (70 / m).toFixed(4), 2.5, 1.2) +
    g('st', [[0, '#5d6268'], [0.3, '#eceef0'], [0.55, '#9aa0a6'], [1, '#4a4f55']], 'x1="0" y1="0" x2="1" y2="0"') +
    rg('cr', [[0, '#d9a868'], [0.5, crust], [0.85, '#6a3816'], [1, '#3e1e0c']], 'cx=".42" cy=".38" r=".66"') + g('ea', [[0, '#f0d6a2'], [0.6, '#d9a560'], [1, '#8a5124']], 'x1="0" y1="0" x2=".3" y2="1"') +
    rg('cm', [[0, '#f4e7cc'], [0.85, '#ead8b4'], [1, '#d9b98a']], 'cx=".5" cy=".6" r=".6"') +
    g('cy', [[0, '#000', 0.4], [0.22, '#fff', 0.28], [0.36, '#fff', 0], [0.75, '#000', 0.1], [1, '#000', 0.5]], 'x1="0" y1="0" x2="1" y2="0"') +
    g('wb', [[0, mix(wood, '#fff', 0.15)], [1, mix(wood, '#000', 0.12)]], 'x1="0" y1="0" x2="1" y2="1"') +
    rg('pa', [[0, mix(stock, '#fff', 0.4)], [1, mix(stock, '#000', 0.05)]], 'cx=".3" cy=".2" r="1"') +
    rg('pt', [[0, mix(tint, '#fff', 0.3)], [1, mix(tint, '#000', 0.05)]], 'cx=".3" cy=".2" r="1"') +
    '';
  let body = '', pre = '';
  const table = (fill) => `<rect width="${w}" height="${h}" fill="${fill}"/><rect width="${w}" height="${h}" fill="#000" filter="url(#wd)" opacity=".045"/>`;
  const flour = (d, op = 0.8) => `<path d="${d}" fill="#fff" opacity="${op}" filter="url(#fl)"/>`;

  // A round loaf from above: domed (lit at the crown, baked dark at the edge), blistered, with the rings the proofing
  // basket left in flour and one long score opened into an ear.
  const boule = (x, y, rr) => {
    const d = blob(x, y, rr, rr * 0.97, 12, 0.03);
    let rings = '';
    for (let i = 1; i < 6; i++) rings += circ(x, y, rr * (1 - i * 0.15), rr * (1 - i * 0.15) * 0.97);
    const A = [x - rr * 0.52, y + rr * 0.32], B = [x + rr * 0.56, y - rr * 0.34], C1 = [x - rr * 0.1, y - rr * 0.22], k = rr * 0.16;
    const cut = `M${P2(...A)}Q${P2(C1[0] - k * 0.5, C1[1] - k)} ${P2(...B)}Q${P2(C1[0] + k * 0.6, C1[1] + k * 0.7)} ${P2(...A)}Z`;
    return shadow(d) + mass(d, 'url(#cr)') + `<path d="${rings}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="${f1(rr * 0.05)}" filter="url(#sf)"/>` +
      `<path d="${cut}" fill="url(#ea)"/><path d="${cut}" fill="url(#ea)" filter="url(#bc)"/><path d="M${P2(...A)}Q${P2(C1[0] - k * 0.5, C1[1] - k)} ${P2(...B)}" fill="none" stroke="#3a1a08" stroke-opacity=".7" stroke-width="${f1(rr * 0.018)}" stroke-linecap="round"/>` +
      glint(`M${P2(A[0] + rr * 0.08, A[1] - rr * 0.1)}Q${P2(C1[0] - k * 0.3, C1[1] - k * 0.6)} ${P2(B[0] - rr * 0.1, B[1] + rr * 0.03)}`, rr * 0.015, 0.5) +
      glint(`M${P2(x - rr * 0.8, y - rr * 0.3)}A${f1(rr)} ${f1(rr)} 0 0 1 ${P2(x - rr * 0.2, y - rr * 0.92)}`, rr * 0.03, 0.35);
  };
  // A loaf cut through, face up: the crust round it, the open crumb, a few crumbs on the board.
  const half = (x, y, rx, ry) => {
    const d = blob(x, y, rx, ry, 12, 0.03), inn = blob(x, y + ry * 0.02, rx * 0.9, ry * 0.88, 12, 0.03);
    return shadow(d) + mass(d, 'url(#cr)') + `<path d="${inn}" fill="url(#cm)"/><path d="${inn}" fill="url(#cm)" filter="url(#cb)"/><path d="${inn}" fill="none" stroke="#7a4a20" stroke-opacity=".35" stroke-width="2"/>` +
      glint(`M${P2(x - rx * 0.85, y - ry * 0.4)}A${f1(rx)} ${f1(ry)} 0 0 1 ${P2(x - rx * 0.1, y - ry * 0.97)}`, m * 0.006, 0.5);
  };
  // A bench scraper: brushed steel with a wooden grip, lying flat.
  const scraper = (x, y, sl, a) => `<g transform="translate(${P2(x, y)}) rotate(${f1(a)})">${shadow(`M0 0h${f1(sl)}v${f1(sl * 0.7)}h${f1(-sl)}Z`, 0.4)}<rect width="${f1(sl)}" height="${f1(sl * 0.7)}" rx="${f1(sl * 0.04)}" fill="url(#st)"/><rect width="${f1(sl)}" height="${f1(sl * 0.2)}" rx="${f1(sl * 0.04)}" fill="#7a5232" filter="url(#bc)"/><path d="M0 ${f1(sl * 0.7 - 1)}h${f1(sl)}" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/></g>`;
  // A thrown pot standing in window light: clay shaded round as a cylinder, the glaze dipped to a line, the rim lit.
  const pot = (x, base, pw, ph, belly, glz) => {
    const t = base - ph, rim = pw * 0.42, ry = pw * 0.06;
    const d = `M${P2(x - rim, t)}C${P2(x - rim, t + ph * 0.3)} ${P2(x - pw * belly, t + ph * 0.35)} ${P2(x - pw * belly * 0.95, t + ph * 0.7)}C${P2(x - pw * belly * 0.9, base - ph * 0.08)} ${P2(x - pw * 0.3, base)} ${P2(x - pw * 0.28, base)}H${f1(x + pw * 0.28)}C${P2(x + pw * 0.3, base)} ${P2(x + pw * belly * 0.9, base - ph * 0.08)} ${P2(x + pw * belly * 0.95, t + ph * 0.7)}C${P2(x + pw * belly, t + ph * 0.35)} ${P2(x + rim, t + ph * 0.3)} ${P2(x + rim, t)}Z`;
    return `<ellipse cx="${f1(x + pw * 0.15)}" cy="${f1(base)}" rx="${f1(pw * 0.7)}" ry="${f1(pw * 0.06)}" fill="#000" opacity=".3" filter="url(#sh)"/><clipPath id="k${f1(x)}"><path d="${d}"/></clipPath>` +
      `<g clip-path="url(#k${f1(x)})"><rect x="${f1(x - pw)}" y="${f1(t)}" width="${f1(pw * 2)}" height="${f1(ph)}" fill="${clay}" filter="url(#bc)"/><path d="M${P2(x - pw, t)}H${f1(x + pw)}V${f1(t + ph * glz)}q${P2(-pw * 0.5, ph * 0.04)} ${P2(-pw, -ph * 0.01)}T${P2(x - pw, t + ph * glz)}Z" fill="${glaze}"/><rect x="${f1(x - pw * belly)}" y="${f1(t)}" width="${f1(pw * belly * 2)}" height="${f1(ph)}" fill="url(#cy)"/></g>` +
      `<ellipse cx="${f1(x)}" cy="${f1(t)}" rx="${f1(rim)}" ry="${f1(ry)}" fill="${mix(glaze, '#000', 0.45)}"/><ellipse cx="${f1(x)}" cy="${f1(t)}" rx="${f1(rim)}" ry="${f1(ry)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${f1(pw * 0.02)}"/>`;
  };
  // A painting class from above: a ceramic palette with wet paint in the member's colours, glossy, and two brushes.
  const palette = (x, y, rr) => {
    const cols = [p.primary, p.accent, mix(p.primary, '#1b2a4a', 0.5), '#f2efe6', mix(p.accent, '#2a5a3a', 0.4), mix(p.primary, '#000', 0.4)];
    let o = shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="url(#pa)"/>` + glint(`M${P2(x - rr * 0.85, y - rr * 0.35)}A${f1(rr)} ${f1(rr)} 0 0 1 ${P2(x - rr * 0.1, y - rr * 0.98)}`, rr * 0.03, 0.8);
    cols.forEach((cc, i) => { const a = i * 1.05 + R(-0.1, 0.1), d = rr * 0.6, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, b = blob(cx, cy, rr * 0.17, rr * 0.15, 8, 0.25); o += `<path d="${b}" fill="${cc}"/>` + glint(`M${P2(cx - rr * 0.08, cy - rr * 0.06)}q${P2(rr * 0.05, -rr * 0.05)} ${P2(rr * 0.1, -rr * 0.02)}`, rr * 0.025, 0.85); });
    const brush = (bx, by, bl, a, tip) => `<g transform="translate(${P2(bx, by)}) rotate(${f1(a)})">${shadow(`M0 0h${f1(bl)}v${f1(bl * 0.04)}h${f1(-bl)}Z`, 0.3)}<path d="M0 ${f1(-bl * 0.018)}L${f1(bl * 0.62)} ${f1(-bl * 0.024)}V${f1(bl * 0.024)}L0 ${f1(bl * 0.018)}Z" fill="${mix(p.ink, p.primary, 0.3)}"/><rect x="${f1(bl * 0.62)}" y="${f1(-bl * 0.026)}" width="${f1(bl * 0.16)}" height="${f1(bl * 0.052)}" fill="url(#st)"/><path d="M${f1(bl * 0.78)} ${f1(-bl * 0.024)}q${P2(bl * 0.16, bl * 0.006)} ${P2(bl * 0.22, bl * 0.024)}q${P2(-bl * 0.06, bl * 0.018)} ${P2(-bl * 0.22, bl * 0.024)}Z" fill="${tip}"/></g>`;
    return o + brush(x - rr * 1.1, y + rr * 1.05, rr * 1.6, -12, cols[0]) + brush(x - rr * 0.9, y + rr * 1.25, rr * 1.4, -4, cols[2]);
  };
  // Admission tickets from above: blank card stock with an inner rule and a perforation, one stub torn away.
  const ticket = (x, y, tw, a, fill, torn) => {
    const th = tw * 0.4, st = tw * 0.27, n = th * 0.07;
    const d = `M0 0H${f1(tw - st - n)}a${f1(n)} ${f1(n)} 0 0 0 ${f1(n * 2)} 0H${f1(torn ? tw - st + n : tw)}V${f1(th)}H${f1(tw - st + n)}a${f1(n)} ${f1(n)} 0 0 0 ${f1(-n * 2)} 0H0Z`;
    let holes = '';
    for (let i = 1; i < 12; i++) holes += circ(tw - st, n + (i / 12) * (th - n * 2), tw * 0.004);
    return `<g transform="translate(${P2(x, y)}) rotate(${f1(a)})">${shadow(d, 0.5)}<path d="${d}" fill="${fill}"/><path d="${d}" fill="${fill}" filter="url(#bc)" opacity=".22"/><rect x="${f1(tw * 0.04)}" y="${f1(th * 0.1)}" width="${f1(tw - st - tw * 0.08)}" height="${f1(th * 0.8)}" fill="none" stroke="${p.ink}" stroke-opacity=".35" stroke-width="1.5"/><rect x="${f1(tw * 0.05)}" y="${f1(th * 0.12)}" width="${f1(tw - st - tw * 0.1)}" height="${f1(th * 0.76)}" fill="none" stroke="${p.ink}" stroke-opacity=".2" stroke-width="1"/><path d="${holes}" fill="#000" opacity=".35"/><path d="M0 0H${f1(torn ? tw - st - n : tw)}" stroke="#fff" stroke-opacity=".8" stroke-width="2"/></g>`;
  };

  if (kind === 'bake') {
    body += table('url(#wb)') + flour(blob(w * 0.48, h * 0.52, w * 0.4, h * 0.4, 10, 0.25), 0.9);
    if (s.slot === 'hero') body += boule(w * 0.36, h * 0.52, h * 0.3) + half(w * 0.7, h * 0.5, h * 0.27, h * 0.2) + scraper(w * 0.86, h * 0.2, h * 0.2, 16);
    else body += half(w * 0.5, h * 0.45, w * 0.4, w * 0.3) + boule(w * 0.74, h * 0.84, w * 0.2);
  } else if (kind === 'clay') {
    const wl = art.wall({ style: 'object', w, h, p, seed, index, quiet: true });
    body += wl.body + `<rect y="${f1(h * 0.72)}" width="${w}" height="${f1(h * 0.28)}" fill="${mix(wood, '#000', 0.08)}"/><path d="M0 ${f1(h * 0.72)}H${w}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
    const fl = h * 0.8;
    body += s.slot === 'hero' ? pot(w * 0.34, fl, h * 0.34, h * 0.38, 0.6, 0.45) + pot(w * 0.55, fl, h * 0.26, h * 0.5, 0.52, 0.6) + pot(w * 0.72, fl, h * 0.4, h * 0.22, 0.62, 0.5) : pot(w * 0.5, h * 0.82, w * 0.5, w * 0.62, 0.6, 0.5);
    pre = wl.defs;
  } else if (kind === 'paint') {
    body += table('url(#wb)');
    body += s.slot === 'hero' ? palette(w * 0.44, h * 0.44, h * 0.28) : palette(w * 0.52, h * 0.4, w * 0.3);
  } else {
    body += `<rect width="${w}" height="${h}" fill="${mix(p.paper, '#000', 0.07)}"/>`;
    body += s.slot === 'hero'
      ? ticket(w * 0.16, h * 0.22, w * 0.44, -7, 'url(#pa)') + ticket(w * 0.24, h * 0.4, w * 0.44, 4, 'url(#pt)') + ticket(w * 0.5, h * 0.5, w * 0.4, -3, 'url(#pa)', true)
      : ticket(w * 0.1, h * 0.28, w * 0.8, -8, 'url(#pt)') + ticket(w * 0.12, h * 0.5, w * 0.8, 5, 'url(#pa)', true);
  }
  // The window: daylight across the bench from the upper left, and grain.
  const pw = w * 0.22, sk = w * 0.3;
  body += `<path d="M${P2(w * 0.02, -h * 0.1)}h${f1(pw)}l${P2(sk, h * 1.2)}h${f1(-pw)}ZM${P2(w * 0.02 + pw * 1.15, -h * 0.1)}h${f1(pw * 0.8)}l${P2(sk, h * 1.2)}h${f1(-pw * 0.8)}Z" fill="#fff8ec" opacity=".16" filter="url(#pn)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  const all = defs.match(/<(filter|linearGradient|radialGradient) id="[^"]+"[\s\S]*?<\/\1>/g);
  const used = all.filter((x) => body.includes(`url(#${x.match(/id="([^"]+)"/)[1]})`)).join('');
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, pre + used + ids, body);
}


function tokens(p) {
  return { bg: color.mix(p.paper, '#f2f2ef', 0.9) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1600, h: 1000, style: 'tile', alt: c.profile.hero || g[0] || `${c.productName || c.name}` },
    { slot: 'host', file: 'host.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, the host` : g[3] || `${c.name}, the host` },
  ];
}

function nav(c) {
  return [
    c.included.length && { label: "What's included", href: '#features' },
    (c.services.length || c.priceText) && { label: 'Tickets', href: '#tickets' },
    c.faq.length >= 2 && { label: 'FAQ', href: '#faq' },
    { label: 'When and where', href: '#signup' },
  ].filter(Boolean);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// The date inside the member's deadline ("Saturday, Nov 15, 10am" -> "NOV 15"), or '' when there is none.
function dateOf(s) {
  const t = String(s || '');
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  let m = t.match(new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (m) return `${m[1].toUpperCase()} ${Number(m[2])}`;
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}`, 'i'));
  if (m) return `${Number(m[1])} ${m[2].toUpperCase()}`;
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MON[Number(m[2]) - 1]} ${Number(m[3])}`;
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (m) return `${m[1]}/${m[2]}`;
  return '';
}

// The giant line: one span per letter, its lines fixed in the markup (balanced by length) and its size set in CSS from
// its length, so the poster's height never depends on which font has arrived (no layout shift).
function giant(textIn) {
  const t = String(textIn).trim();
  const words = t.split(/\s+/);
  const n = t.length;
  const lines = Math.min(words.length, n <= 12 ? 1 : n <= 26 ? 2 : 3);
  // Fewest-longest-line split into that many lines (words stay whole), so the lines are balanced.
  const groups = [];
  let best = null;
  const cut = (from, k, acc) => {
    if (k === 1) { const all = [...acc, words.slice(from)]; const worst = Math.max(...all.map((g) => g.join(' ').length)); if (!best || worst < best.worst) best = { worst, all }; return; }
    for (let j = from + 1; j <= words.length - k + 1; j++) cut(j, k - 1, [...acc, words.slice(from, j)]);
  };
  cut(0, lines, []);
  groups.push(...best.all);
  const longLine = Math.max(...groups.map((g) => g.join(' ').length));
  // Big Shoulders Display at 900, in capitals: about 0.5em a letter (figures a little less).
  const fs = Math.min(40, 186 / Math.max(longLine, 3)).toFixed(2);
  const fsm = Math.min(46, 186 / Math.max(longLine, 3)).toFixed(2);
  let i = 0;
  const html = groups
    .map((g) => `<span class="gl">${g.map((w) => `<span class="gw">${[...w].map((ch) => `<span class="gch" data-ci-part>${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span>`)
    .join(' ');
  return { html, fs, fsm, fh: [62, 34, 22][groups.length - 1] };
}

// "Pop-up night market" and "Night Market Pop-up" say the same thing: show it once.
function sameWords(a, b) {
  const key = (t) => String(t).toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
  return key(a) === key(b);
}

function render(c0) {
  // Tickets, not "Buy now": the event's own words on the main button.
  const generic = /^(buy now|shop now)$/i;
  const primary = c0.buy && generic.test(c0.primary.label) ? { ...c0.primary, label: 'Get tickets', short: 'Tickets' } : c0.primary;
  const secondary = c0.secondary && c0.secondary.href === '#features' ? { ...c0.secondary, label: "What's included" } : c0.secondary;
  // The written words follow the new label ("Tap Buy now to order." -> "Tap Get tickets to order.").
  const relabel = (t) => (primary !== c0.primary ? String(t || '').split(c0.primary.label).join(primary.label) : t);
  const c = { ...c0, primary, secondary, heroSub: relabel(c0.heroSub), ctaSub: relabel(c0.ctaSub), faq: c0.faq.map((q) => ({ q: q.q, a: relabel(q.a) })) };
  const event = c.productName || c.name;
  const date = dateOf(c.deadline);
  const big = giant(date || event);
  const low = cheapest(c);
  const fromText = low ? `From ${low.priceText.replace(/^From /, '')}` : c.priceText || '';
  const where = c.address || (c.area && !c.online ? c.area : '');
  const whereShort = c.address ? c.address.split(',')[0] : where;
  const tix = (cls) => P.button(c.primary, cls, c.buy ? 'arrowUpRight' : 'arrow').replace('<a ', '<a data-mag ');
  const person = c.owner && c.owner !== c.name ? c.owner : '';

  const said = String(c.heroSub || '').toLowerCase();
  const metaRows = [c.whatShort, where ? (c.city && c.address ? c.city : where) : ''].filter((x) => x && !said.includes(String(x).toLowerCase()));

  // The ticket: only the member's facts. Its stub carries the lowest price (or the seats, or the word for the button).
  const seats = String(c.capacity || '').match(/^(\d+)\s*([a-z]+)?/i);
  const first = c.services[0];
  const stubBig = low ? low.priceText.replace(/^From /, '') : c.priceText || '';
  const ticket = `<div class="tk-wrap" id="ticket" data-ci="subject"><div class="ticket" data-alive="0.8">
<div class="tk-main">
<p class="tk-top"><span>${esc(c.name)}</span>${first && first.name ? `<span>${esc(first.name)}</span>` : ''}</p>
<p class="tk-event">${esc(event)}</p>
<dl class="tk-rows">${c.deadline ? `<div><dt>When</dt><dd>${esc(c.deadline)}</dd></div>` : ''}${where ? `<div><dt>Where</dt><dd>${esc(whereShort)}${c.city && c.address ? `, ${esc(c.city)}` : ''}</dd></div>` : ''}${person ? `<div><dt>Host</dt><dd>${esc(person)}</dd></div>` : ''}</dl>
</div>
<div class="tk-stub"><span class="tk-perf" aria-hidden="true"></span>${stubBig ? `<p class="tk-price"><span>${esc(stubBig)}</span></p>` : ''}${c.capacity && !seats ? `<p class="tk-cap">${esc(c.capacity)}</p>` : ''}</div>
</div></div>`;

  const hero = `<section class="hero" aria-labelledby="hero-title">
${metaRows.length ? `<div class="wrap"><p class="folio" data-ci="then" data-ci-from="fade">${metaRows.map((v) => `<span>${esc(v)}</span>`).join('')}</p></div>` : ''}
<div class="giant-wrap">
${date ? `<p class="giant" data-ci="head" style="--fs:${big.fs}vw;--fh:${big.fh}vh;--fsm:${big.fsm}vw"><span class="sr-only">${esc(c.deadline)}</span><span class="g-in" aria-hidden="true">${big.html}</span></p>` : `<h1 class="giant" id="hero-title" data-ci="head" style="--fs:${big.fs}vw;--fh:${big.fh}vh;--fsm:${big.fsm}vw"><span class="sr-only">${esc(event)}</span><span class="g-in" aria-hidden="true">${big.html}</span></h1>`}
</div>
<div class="wrap hero-grid${date ? ' dt' : ''}">
<div class="hero-copy">
${date ? `<h1 id="hero-title" data-ci="then">${esc(sameWords(c.heroTitle, event) ? c.heroTitle : `${event}: ${c.heroTitle}`)}</h1>` : sameWords(c.heroTitle, event) ? '' : `<p class="hero-name" data-ci="then">${esc(c.heroTitle)}</p>`}
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
<div class="ctas" data-ci="then">${tix('btn btn-lg btn-ink')}${fromText ? `<p class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></p>` : ''}</div>
</div>
${ticket}
</div>
</section>`;

  // What's included as the ticket's fine print: the back of the ticket, its lines printed in as you reach them, and its
  // stub tearing off along the perforation as you scroll past (the scroll moment). Still frame: printed, stub torn.
  const fine = c.included.length
    ? `<section class="sec fine-sec" id="features" aria-labelledby="features-title"><div class="wrap"><div class="fine" data-sc>
<div class="fine-main">
<h2 class="fine-title" id="features-title">What's included</h2>
<ol class="fine-list">${c.included.map((x, i) => `<li data-sc-part><span class="fn" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(x)}</li>`).join('')}</ol>
</div>
<div class="fine-stub" data-sc-part aria-hidden="true"><span class="tk-perf"></span>${seats ? `<span class="fs-v">${esc(seats[1])}</span><span class="fs-k">${esc(seats[2] || 'seats')}</span>` : ''}</div>
</div></div></section>`
    : '';

  // The event, edge to edge: the member's photo, or the bake drawn on the bench until they add one.
  const photo = `<section class="photo" aria-label="Photo"><div class="ph-in" data-rv="mask"><div>${P.img(c, 'hero', { cls: 'ph-img' }).replace('<img ', '<img data-par="0.06" ')}</div></div></section>`;

  // The ticket types as a box-office board: name, what it is, a perforation, the price, the button.
  const ticketItems = c.services.length ? c.services : c.priceText ? [{ name: event, priceText: c.priceText, blurb: '' }] : [];
  const tickets = ticketItems.length
    ? `<section class="sec tickets" id="tickets" aria-labelledby="tickets-title"><div class="wrap tix-grid">
<div class="tix-side"><h2 class="h2" id="tickets-title" data-split>${c.buy ? 'Tickets' : 'Prices'}</h2>${c.shipping ? `<p class="tix-note">${esc(c.shipping)}</p>` : ''}</div>
<ul class="board">${ticketItems
        .map((s, i) => `<li class="row" data-rv style="--d:${i + 1}"><span class="row-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="row-t"><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}</div>${s.priceText ? `<p class="row-p">${esc(s.priceText)}</p>` : ''}${c.buy ? `<a class="row-go" href="${esc(c.buy.href)}">${esc(c.primary.label)}${icon('arrowUpRight', { size: 18 })}<span class="sr-only">: ${esc(s.name)}</span></a>` : ''}</li>`)
        .join('')}</ul>
</div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<figure class="host" data-rv="mask"><div class="host-in">${P.img(c, 'host', { cls: 'host-img' }).replace('<img ', '<img data-par="0.05" ')}</div>${person ? `<figcaption>${esc(person)}, ${esc(c.name)}</figcaption>` : ''}</figure>
<div class="about-copy">
<h2 class="h2" id="about-title" data-split>${esc(person ? `Hosted by ${person}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="sr-only" id="reviews-title">What people say</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  // Questions only when there are two real ones, set as fine print: the question in the poster face, the answer under
  // it. No accordion.
  const faq = c.faq.length >= 2
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-split>Questions</h2><dl class="qa">${c.faq.map((f, i) => `<div data-rv style="--d:${Math.min(i + 1, 6)}"><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  // The last call: with a date, "See you on Nov 15." (the member's own date) over the button.
  const lastTitle = date && c.buy ? `See you ${/^\d/.test(date) ? 'on the' : 'on'} ${date.replace(/^(\w{3}) (\d+)$/, (m, a, b) => `${a.charAt(0)}${a.slice(1).toLowerCase()} ${b}`)}.` : c.ctaTitle;
  // Under it, facts rather than an instruction: the seats, the time, the place and the way there.
  // The date is in the title already, so only the day and the time stay; the address is in the contact list beside it.
  const when = date ? String(c.deadline).replace(/,?\s*\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b|,?\s*\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/i, '').replace(/^\s*,\s*/, '') : c.deadline;
  const lastFacts = [c.capacity, when].filter(Boolean);
  const signup = `<section class="sec signup" id="signup" aria-labelledby="signup-title"><div class="wrap signup-grid">
<div class="signup-copy">
<h2 class="signup-title" id="signup-title" data-split>${esc(lastTitle)}</h2>
${lastFacts.length ? `<p class="last-facts" data-rv style="--d:3">${lastFacts.map((x) => `<span>${esc(x)}</span>`).join('')}${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">Directions${icon('arrowUpRight', { size: 16 })}</a>` : ''}</p>` : c.ctaSub && !/\btap\b/i.test(c.ctaSub) ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.buy ? `<div class="ctas" data-rv style="--d:4">${tix('btn btn-lg btn-ink')}${fromText ? `<p class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></p>` : ''}</div>` : ''}
</div>
<div class="signup-side">
${c.buy ? '' : `<div class="form-wrap stub-form" data-rv style="--d:2"><h3 class="form-title">Join the list</h3><p class="form-lead">Leave your email and we will write when tickets are out.</p>${P.form(c, { id: 'signup', fields: ['name', 'email'], submit: 'Join the list', subject: `${event}: join the list` })}</div>`}
${P.contactList(c, { cls: 'signup-contact' }) ? `<div data-rv style="--d:5">${P.contactList(c, { cls: 'signup-contact' })}</div>` : ''}
</div>
</div></section>`;

  const float = `<div class="tix-float" aria-label="Tickets"><span class="tf-name">${esc(event)}${fromText ? `<small>${esc(fromText)}</small>` : ''}</span>${P.button(c.primary, 'btn btn-primary tf-btn')}</div>`;

  // The foot is the ticket's last stub: torn off along the perforation under the last call, the box-office small print
  // on it (the event, when, where, how to reach the box office), and the legal line.
  const office = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('<br>');
  const print = [[event !== c.name && 'Event', event], ['When', c.deadline], ['Where', c.address || where], ['Box office', office]].filter(([k, v]) => k && v);
  const footer = `<footer class="ga-ftr"><div class="wrap">
<div class="gf-top"><p class="gf-name">${esc(c.name)}</p>${print.length ? `<dl class="gf-print">${print.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === 'Box office' ? v : esc(v)}</dd></div>`).join('')}</dl>` : ''}</div>
<div class="gf-base"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${P.socials(c, { cls: 'gf-social', size: 18 })}</div>
</div></footer>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-ga', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, fine, photo, tickets, about, reviews, faq, signup, '</main>', float, footer, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '80rem' } };
}

// Nudges the giant line to the width with a transform only (its box is sized in CSS), and shows the ticket bar once the
// hero has scrolled away, until the questions, the last call or the footer come into view.
const JS = `(function(){var d=document,k=d.querySelector('.giant .g-in');
function fit(){if(!k)return;k.style.transform='';var w=k.parentNode.clientWidth,m=Math.max.apply(0,[].slice.call(k.querySelectorAll('.gl')).map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.76,Math.min(1.1,w/m));k.style.transform=Math.abs(r-1)<.004?'':'scale('+r.toFixed(3)+')'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var f=d.querySelector('.tix-float'),h=d.querySelector('.hero'),ends=[].slice.call(d.querySelectorAll('#faq,.signup,.ga-ftr'));if(f&&h&&'IntersectionObserver' in window){d.documentElement.classList.add('tf');var past=false,seen=new Set();var set=function(){f.classList.toggle('show',past&&!seen.size)};new IntersectionObserver(function(e){past=!e[0].isIntersecting&&e[0].boundingClientRect.top<0;set()}).observe(h);var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting)seen.add(x.target);else seen.delete(x.target)});set()});ends.forEach(function(x){io.observe(x)})}})();`;

const CSS = `
@font-face{font-family:'Gather Display Fallback';font-weight:500 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:72.0%;ascent-override:136.1%;descent-override:29.2%;line-gap-override:0%}
@font-face{font-family:'Gather Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:93.5%;ascent-override:110.2%;descent-override:24.6%;line-gap-override:0%}
html:root{--font-display:"Big Shoulders Display","Gather Display Fallback",sans-serif;--font-body:"Familjen Grotesk","Gather Body Fallback",sans-serif}
:root{--ease:cubic-bezier(.16,1,.3,1);--rule:color-mix(in srgb,var(--ink) 18%,transparent);--card:color-mix(in srgb,var(--bg) 40%,#fffdf8)}
h1,h2,h3{font-weight:800;letter-spacing:-.005em;text-transform:uppercase}
.h2{font-size:clamp(3rem,1.8rem + 5vw,6.6rem);line-height:.84}
.lead{color:var(--muted)}
.btn{font-weight:700;letter-spacing:.02em}
.btn:hover{transform:none}
.btn-ink,.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-ink:hover,.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg))}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;font-weight:900;line-height:1;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;font-size:.95rem;font-weight:600;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 2px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.2rem}
.menu>summary{background:transparent;border-radius:2px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(.5rem,.4rem + .8vw,1.25rem) clamp(4rem,2.5rem + 5vw,7.5rem)}
.folio{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 2rem;padding-block:.7rem;border-block:2px solid var(--ink);font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.giant-wrap{padding-inline:max(1rem,(100% - var(--max)) / 2);margin-top:clamp(.75rem,1.5vw,1.5rem);overflow:hidden}
.giant{font-family:var(--font-display);font-size:clamp(4.5rem,min(var(--fs),var(--fh)),40rem);font-weight:900;line-height:.8;letter-spacing:-.01em;text-transform:uppercase;padding-block:.07em .04em}
@media (min-width:48rem){.giant-wrap{padding-inline:max(2rem,(100% - var(--max)) / 2)}}
@media (max-width:39.99rem){.giant{font-size:var(--fsm)}}
.g-in{display:block;transform-origin:0 50%}
.gl{display:block;width:max-content;white-space:nowrap}
.gw{display:inline-block;white-space:nowrap}
.gch{display:inline-block;transition:translate .45s var(--ease)}
@media (hover:hover){html.m .gch:hover{translate:0 -.05em}}
.hero-grid{position:relative;display:grid;gap:2.5rem;margin-top:clamp(1.75rem,1rem + 2vw,3rem)}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.hero-copy{grid-column:1/6}.tk-wrap{grid-column:7/13}.dt .tk-wrap{margin-top:calc(-1 * clamp(4rem,9vw,10rem))}}
.hero-name{text-transform:uppercase}
.hero h1:not(.giant),.hero-name{font-family:var(--font-display);font-size:clamp(2.4rem,1.6rem + 3vw,4.4rem);font-weight:900;line-height:.88}
.hero .lead{margin-top:1rem;max-width:30rem;font-size:1.15rem}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:1.75rem}
.from{display:grid;line-height:1.05}
.from small{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.from strong{font-family:var(--font-display);font-size:2.2rem;font-weight:900;text-transform:uppercase;font-variant-numeric:tabular-nums}
.tk-wrap{position:relative;z-index:1;filter:drop-shadow(0 1px 0 color-mix(in srgb,var(--ink) 22%,transparent)) drop-shadow(0 24px 30px rgba(0,0,0,.18))}
.ticket{display:grid;grid-template-columns:minmax(0,1fr) auto;background:var(--card);color:var(--ink);rotate:-2.5deg;cursor:pointer;-webkit-mask:radial-gradient(circle .7rem at calc(100% - var(--stub)) 0,#0000 98%,#000) 0 0/100% 51% no-repeat,radial-gradient(circle .7rem at calc(100% - var(--stub)) 100%,#0000 98%,#000) 0 100%/100% 51% no-repeat;mask:radial-gradient(circle .7rem at calc(100% - var(--stub)) 0,#0000 98%,#000) 0 0/100% 51% no-repeat,radial-gradient(circle .7rem at calc(100% - var(--stub)) 100%,#0000 98%,#000) 0 100%/100% 51% no-repeat;--stub:clamp(6.5rem,5rem + 4vw,9.5rem)}
.tk-main{display:grid;gap:.9rem;align-content:start;padding:clamp(1.1rem,.8rem + 1vw,1.75rem)}
.tk-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 1rem;padding-bottom:.7rem;border-bottom:1px solid var(--rule);font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.tk-event{font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.4vw,3.8rem);font-weight:900;line-height:.86;text-transform:uppercase;text-wrap:balance}
.tk-rows{display:grid;gap:0}
.tk-rows div{display:grid;grid-template-columns:4.5rem 1fr;gap:.75rem;padding-block:.45rem;border-top:1px solid var(--rule);font-size:.95rem}
.tk-rows dt{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding-top:.2rem}
.tk-rows dd{font-weight:600}
.tk-stub{position:relative;display:grid;align-content:center;justify-items:center;gap:.5rem;width:var(--stub);padding:1rem .75rem;text-align:center;transform-origin:0 100%}
.tk-perf{position:absolute;left:0;top:.9rem;bottom:.9rem;border-left:2px dashed color-mix(in srgb,var(--ink) 35%,transparent)}
.tk-price{font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,4rem);font-weight:900;line-height:.85;color:var(--ink);font-variant-numeric:tabular-nums}
.tk-price span{position:relative;display:inline-block;padding:.12em .14em .06em;rotate:-7deg}
.tk-price span::after{content:'';position:absolute;inset:0;border:3px solid var(--pop)}
html.m .tk-price span::after{opacity:0;transform:scale(1.25)}
html.m.ci-go .tk-price span::after{animation:gaInk .32s cubic-bezier(.2,0,0,1) 1.5s forwards}
@keyframes gaInk{to{opacity:1;transform:none}}
.tk-cap{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
@media (max-width:59.99rem){.tk-wrap{order:-1;padding-inline:.25rem}.dt .tk-wrap{margin-top:calc(-1 * clamp(1rem,5vw,3rem))}}
.fine-sec{padding-block:clamp(3rem,2rem + 3vw,5rem)}
.fine{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;background:var(--card);border-block:2px solid var(--ink);--stub:clamp(5.5rem,4rem + 4vw,9rem)}
.fine-main{padding:clamp(1.25rem,1rem + 2vw,3rem) clamp(1rem,.5rem + 2vw,3rem)}
.fine-title{font-family:var(--font-display);font-size:clamp(2.6rem,1.8rem + 3.4vw,5rem);font-weight:900;line-height:.86;margin-bottom:clamp(1rem,.8rem + 1vw,1.75rem)}
.fine-list{columns:2 20rem;column-gap:3rem}
.fine-list li{display:grid;grid-template-columns:2.2rem 1fr;gap:.5rem;break-inside:avoid;padding-block:.65rem;border-top:1px dashed color-mix(in srgb,var(--ink) 35%,transparent);font-size:1.02rem;font-weight:600;line-height:1.35}
.fn{font-family:var(--font-display);font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums}
.fine-stub{position:relative;display:grid;align-content:center;justify-items:center;gap:.25rem;min-width:var(--stub);padding:1.25rem clamp(1rem,.5rem + 2vw,3rem) 1.25rem clamp(1rem,.6rem + 1vw,1.75rem);border-left:0;text-align:center;font-family:var(--font-display);font-weight:900;text-transform:uppercase;line-height:.85;transform-origin:0 100%;rotate:5deg;translate:.6rem .4rem}
.fs-k{font-size:clamp(1.4rem,1rem + 1.4vw,2.2rem)}
.fs-v{font-size:clamp(3rem,2rem + 3vw,5.4rem)}
html.m .fine[data-sc] .fine-list li[data-sc-part]{transform:translateX(calc((1 - var(--pi,1)) * -1.25rem))}
html.m .fine[data-sc] .fine-stub[data-sc-part]{transform:none;rotate:calc(var(--pi,1) * 5deg);translate:calc(var(--pi,1) * .6rem) calc(var(--pi,1) * .4rem)}
@media (max-width:47.99rem){.fine{grid-template-columns:1fr}.fine-main{padding-inline:1rem}.fine-stub{width:auto;grid-auto-flow:column;justify-content:start;gap:.6rem;padding:1rem;transform-origin:0 0;rotate:-2deg;translate:0 .3rem}.fine-stub .tk-perf{left:0;right:0;top:0;bottom:auto;border-left:0;border-top:2px dashed color-mix(in srgb,var(--ink) 35%,transparent)}html.m .fine[data-sc] .fine-stub[data-sc-part]{rotate:calc(var(--pi,1) * -2deg);translate:0 calc(var(--pi,1) * .3rem)}}
.photo{overflow:hidden}
.ph-in>div{overflow:hidden;aspect-ratio:16/7;background:var(--surface)}
@media (max-width:47.99rem){.ph-in>div{aspect-ratio:4/3}}
.ph-img{width:100%;height:116%;margin-top:-8%;object-fit:cover}
.tickets{border-top:2px solid var(--ink)}
.tix-grid{display:grid;gap:2rem}
@media (min-width:60rem){.tix-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.tix-side{grid-column:1/5}.board{grid-column:5/13}}
.tix-note{margin-top:1.25rem;max-width:20rem;font-weight:600;color:var(--muted)}
.board{border-top:2px solid var(--ink)}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.5rem 1.5rem;padding-block:clamp(1.1rem,.8rem + 1vw,1.75rem);border-bottom:2px dashed color-mix(in srgb,var(--ink) 30%,transparent)}
.row-n{font-family:var(--font-display);font-size:1.4rem;font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums;align-self:start;padding-top:.3rem}
.row-t h3{font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.4rem);font-weight:900;line-height:.86}
.row-t p{margin-top:.35rem;color:var(--muted)}
.row-p{font-family:var(--font-display);font-size:clamp(2.4rem,1.8rem + 2.6vw,4.4rem);font-weight:900;line-height:.85;font-variant-numeric:tabular-nums}
.row-go{grid-column:2/4;justify-self:start;display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:700;text-decoration:none;border-bottom:2px solid currentColor}
.row-go:hover{border-bottom-color:var(--pop)}
@media (min-width:48rem){.row{grid-template-columns:auto minmax(0,1fr) auto auto}.row-go{grid-column:auto;justify-self:end}}
.about-grid{display:grid;gap:clamp(2rem,1.5rem + 3vw,4rem)}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.host{grid-column:1/7}.about-copy{grid-column:8/13}}
.host{margin:0}
.host-in{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.host-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.host figcaption{margin-top:.7rem;font-size:.9rem;font-weight:600;color:var(--muted)}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-copy .h2{margin-bottom:.5rem}
.about-copy p{font-size:1.12rem;line-height:1.6;max-width:34rem}
.quotes{display:grid;border-top:2px solid var(--ink)}
.quote{display:grid;gap:.8rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--rule)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(2rem,1.4rem + 2.6vw,3.8rem);font-weight:800;line-height:.95;text-transform:uppercase}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:700;color:var(--muted)}
.qa{border-top:2px solid var(--ink)}
.qa>div{display:grid;gap:.35rem;padding-block:1.1rem;border-bottom:1px dashed color-mix(in srgb,var(--ink) 35%,transparent)}
.qa dt{font-family:var(--font-display);font-size:clamp(1.5rem,1.2rem + 1vw,2.2rem);font-weight:900;line-height:.95;text-transform:uppercase}
.qa dd{margin:0;max-width:40rem;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.h2{grid-column:1/5}.faq-grid>div{grid-column:5/13}}
.signup{background:var(--ink);color:var(--bg);--muted:color-mix(in srgb,var(--bg) 72%,var(--ink));--rule:color-mix(in srgb,var(--bg) 22%,transparent);--focus:var(--bg)}
.signup a{color:var(--bg)}
.signup .btn-ink{background:var(--bg);color:var(--ink)}
.signup .btn-ink:hover{background:var(--card)}
.signup-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.signup-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.signup-copy{grid-column:1/9}.signup-side{grid-column:9/13}}
.signup-title{font-family:var(--font-display);font-size:clamp(3.8rem,2rem + 8vw,10rem);font-weight:900;line-height:.8}
.signup .lead{margin-top:1.25rem}
.last-facts{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem 0;margin-top:1.5rem;font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);font-weight:800;line-height:1;text-transform:uppercase}
.last-facts>*{padding-right:1.1rem;margin-right:1.1rem;border-right:2px solid var(--rule)}
.last-facts>:last-child{border-right:0}
.last-facts a{display:inline-flex;align-items:center;gap:.3rem;min-height:2.75rem;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.15em}
.signup-contact .i{color:var(--bg)}
.stub-form{padding:1.5rem;background:var(--bg);color:var(--ink);border-left:2px dashed var(--pop)}
.stub-form a{color:var(--ink)}
.form-title{font-family:var(--font-display);font-size:2.2rem;font-weight:900;line-height:1}
.form-lead{margin:.5rem 0 1.25rem;color:var(--muted)}
.field input,.field select,.field textarea{border:0;border-bottom:2px solid var(--ink);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field textarea:focus{box-shadow:0 2px 0 var(--ink)}
.tix-float{position:fixed;right:1.5rem;bottom:1.5rem;z-index:45;display:flex;align-items:center;gap:1.25rem;padding:.45rem .45rem .45rem 1.25rem;background:var(--ink);color:var(--bg);transition:transform .6s var(--ease),opacity .4s ease}
.tf-name{display:grid;font-family:var(--font-display);font-size:1.25rem;font-weight:900;line-height:1;text-transform:uppercase}
.tf-name small{margin-top:.2rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.06em;opacity:.8}
.tix-float .tf-btn{min-height:3rem;background:var(--bg);color:var(--ink)}
.tix-float .tf-btn:hover{background:var(--card)}
html:not(.tf) .tix-float{display:none}
html.tf .tix-float:not(.show){transform:translateY(160%);opacity:0;pointer-events:none}
@media (max-width:59.99rem){.tix-float{display:none}}
.ga-ftr{position:relative;padding-block:clamp(2.5rem,2rem + 2vw,3.75rem) calc(1.75rem + env(safe-area-inset-bottom,0px));background:var(--card)}
.ga-ftr::before{content:'';position:absolute;left:0;right:0;top:-6px;height:12px;background:radial-gradient(circle at 50% 50%,var(--ink) 5px,transparent 5.5px) 0 0/18px 12px repeat-x}
.ga-ftr::after{content:'';position:absolute;left:0;right:0;top:1.1rem;border-top:2px dashed color-mix(in srgb,var(--ink) 35%,transparent)}
.gf-top{display:grid;gap:1.5rem;padding-top:.75rem}
@media (min-width:60rem){.gf-top{grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:1.5rem;align-items:start}}
.gf-name{font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.4vw,3.6rem);font-weight:900;line-height:.86;text-transform:uppercase}
.gf-print{display:grid;gap:0;border-top:2px solid var(--ink)}
@media (min-width:40rem){.gf-print{grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))}}
.gf-print>div{display:grid;gap:.25rem;align-content:start;padding:.75rem 1rem .9rem 0;border-bottom:1px dashed color-mix(in srgb,var(--ink) 30%,transparent)}
.gf-print dt{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.gf-print dd{margin:0;font-size:.92rem;font-weight:600;line-height:1.35}
.gf-print a{text-decoration:none;border-bottom:1px solid currentColor}
.gf-print a:hover{border-bottom-color:var(--pop)}
.gf-base{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1.5rem;margin-top:1.75rem;font-size:.82rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.ga-ftr .legal-links{width:min(100% - 2rem,var(--max));margin:1rem auto 0;text-align:left;font-size:.82rem}
@media (min-width:48rem){.ga-ftr .legal-links{width:min(100% - 4rem,var(--max))}}
.menu-panel{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.menu-panel li a{padding:.75rem 0;border-bottom:2px dashed color-mix(in srgb,var(--ink) 30%,transparent);font-size:2.6rem;font-weight:900;line-height:.9;text-transform:uppercase}
.menu-panel li a:hover{color:var(--ink);text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:3px}
.menu-panel .btn{background:var(--ink);color:var(--bg)}
.ftr-name{font-weight:900;text-transform:uppercase}
.mbar{border-top:2px solid var(--ink);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Gather',
  bestFor: 'Workshops, pop-ups, classes and launch parties that sell tickets, with motion',
  match: /\b(events?|workshops?|classes|class|pop-?ups?|tickets?|festivals?|conferences?|meetups?|retreats?|parties|party|shows?|concerts?|tastings?)\b/,
  why: 'A poster for your event, with motion: the date stamped huge, your ticket pressed down beside it with the price ringed, what is included printed as the fine print whose stub tears off as you scroll, and a ticket button that stays in reach.',
  fonts: { q: 'family=Big+Shoulders+Display:wght@500..900&family=Familjen+Grotesk:wght@400..700', display: ['Big Shoulders Display', 'grotesk'], body: ['Familjen Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the date is stamped, the ticket leans to you, the fine print's stub tears.
  choreo: { intro: 'stamp', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'medium', look: 'poster stock, a ticket you can tear' },
  art: gatherArt,
  tokens,
  slots,
  nav,
  render,
};
