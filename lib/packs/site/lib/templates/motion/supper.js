// Supper (animated, restaurant): for food and drink, on a warm dark page with the menu printed on paper.
//   Object: the menu, hand-set like a price list (dish, dotted leader, price), the kitchen's ticket, and the dishes
//   themselves, drawn overhead on butcher paper over a charred table until the member adds photos.
//   Material: charred dark and butcher paper: square corners, hairline rules, heavy condensed type, no cards.
//   One move: pour. The name pours in letter by letter while the hero photo fills from the bottom like a glass, then
//   the night's first dishes are set on a paper ticket pinned to the photo.
//   Pop: the kitchen ticks the ticket, dish by dish, in the member's colour (a stroke, never a fill); today's hours
//   and a dish's price under the pointer take the same colour.
// Then the full menu on paper, three dishes turning past at their own depth (the scroll moment, captioned with their
// names), the member's own story when they wrote one, the visit (address set like a label, hours like a timetable),
// questions as a printed list when there are real ones, and a form on an order slip.
// The name is sized in CSS from its length (a small script only fine-tunes it with a transform), so nothing shifts while
// the intro plays. JavaScript off and reduced motion: the complete, still page, the ticket already ticked. Its motion
// is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');

const id = 'supper';

const f1 = (n) => String(Math.round(n));

// The dish drawn for its photo slot: each one overhead on butcher paper over the charred table, in line and the
// member's colours (a studio comp, not a photo). The kind comes from the dish's name.
function spKind(t) {
  const s = String(t || '').toLowerCase();
  if (/fish|baja|shrimp|camar|pescado/.test(s)) return 'fish';
  if (/taco|tostada|quesadilla|burrito|gordita|sope/.test(s)) return 'taco';
  if (/elote|corn|esquite|cob/.test(s)) return 'elote';
  if (/pizza|flatbread/.test(s)) return 'pizza';
  if (/soup|pozole|bowl|ramen|pho|stew|chili|curry|salad|menudo|caldo|noodle/.test(s)) return 'bowl';
  if (/coffee|latte|espresso|cappuccino|tea\b|mocha|cortado/.test(s)) return 'coffee';
  if (/agua|horchata|marg|drink|beer|cerveza|mezcal|tequila|soda|lemonade|juice|cocktail|wine|spritz|michelada|limonada/.test(s)) return 'drink';
  if (/flan|cake|pie|tart|dessert|churro|pastel|cheesecake|brownie|cookie|pastry|croissant|concha|sweet/.test(s)) return 'sweet';
  return 'plate';
}

function supperArt(s, { p, c, seed, index, art }) {
  if (!/^(hero|d\d)$/.test(s.slot)) return null;
  const { w, h } = s;
  const bg = art.wall({ style: 'plates', w, h, p, seed, index, quiet: true });
  const r = art.rng(`${seed}:sp:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const ink = color.mix(p.ink, '#000000', 0.15);
  const sw = Math.max(2, m * 0.0042);
  const L = (k = 1, col = ink) => `fill="none" stroke="${col}" stroke-width="${f1(sw * k)}" stroke-linecap="round" stroke-linejoin="round"`;
  const table = color.mix(color.mix(p.ink, p.primary, 0.22), '#0c0705', 0.5);
  const kraft = color.mix(color.mix(p.paper, p.primary, 0.16), p.accent, 0.08);
  const china = color.mix(color.mix(p.paper, '#ffffff', 0.4), p.accent, 0.06);
  const tortilla = color.mix(p.accent, p.paper, 0.5);
  const toast = color.mix(p.accent, p.primary, 0.45);
  const meat = color.mix(p.primary, p.ink, 0.42);
  const herb = color.mix(p.accent, p.ink, 0.42);
  const lime = color.mix(p.accent, p.paper, 0.25);
  const rind = color.mix(p.accent, p.ink, 0.3);
  const salsa = color.mix(p.primary, '#000000', 0.12);
  const cream = color.mix(p.paper, '#ffffff', 0.6);
  const clay = color.mix(p.primary, p.paper, 0.38);
  const shadow = (d, k = 1) => `<path d="${d}" fill="#000000" opacity=".34" transform="translate(${f1(m * 0.014 * k)} ${f1(m * 0.022 * k)})" filter="url(#sps)"/>`;
  const circ = (cx, cy, rr) => `M${f1(cx - rr)} ${f1(cy)}a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(-rr * 2)} 0Z`;
  // Small uneven quads: chopped onion, crumbs, char; one path per colour.
  const bits = (n, at, sz) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const [x, y] = at();
      const a = sz * R(0.6, 1.2);
      d += `M${f1(x)} ${f1(y)}l${f1(a)} ${f1(R(-0.3, 0.3) * a)}l${f1(R(-0.3, 0.3) * a)} ${f1(a)}l${f1(-a)} ${f1(R(-0.2, 0.2) * a)}Z`;
    }
    return d;
  };
  const leaves = (n, at, sz) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const [x, y] = at();
      const a = R(0, Math.PI * 2), l = sz * R(0.7, 1.2);
      const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
      d += `M${f1(x)} ${f1(y)}q${f1(dx / 2 - dy * 0.45)} ${f1(dy / 2 + dx * 0.45)} ${f1(dx)} ${f1(dy)}q${f1(-dx / 2 + dy * 0.45)} ${f1(-dy / 2 - dx * 0.45)} ${f1(-dx)} ${f1(-dy)}Z`;
    }
    return d;
  };
  // A lime wedge seen from above: half a wheel, its rind, its segments.
  const wedge = (x, y, rr, a) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(`M${f1(-rr)} 0A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rr)} 0Z`, 0.5)}<path d="M${f1(-rr)} 0A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rr)} 0Z" fill="${lime}" stroke="${rind}" stroke-width="${f1(sw * 2.2)}"/><path d="M0 0L${f1(-rr * 0.62)} ${f1(-rr * 0.52)}M0 0V${f1(-rr * 0.8)}M0 0L${f1(rr * 0.62)} ${f1(-rr * 0.52)}" ${L(0.6, color.mix(lime, '#ffffff', 0.5))}/><path d="M${f1(-rr)} 0A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rr)} 0Z" ${L(0.8)}/></g>`;
  // A ramekin of salsa: the rim, the sauce, seeds and a few chopped bits.
  const ramekin = (x, y, rr) => shadow(circ(x, y, rr), 0.6) + `<path d="${circ(x, y, rr)}" fill="${china}"/><path d="${circ(x, y, rr * 0.78)}" fill="${salsa}"/><path d="${bits(7, () => [x + R(-0.45, 0.4) * rr, y + R(-0.45, 0.4) * rr], rr * 0.09)}" fill="${color.mix(salsa, '#ffffff', 0.3)}"/><path d="${leaves(3, () => [x + R(-0.4, 0.3) * rr, y + R(-0.4, 0.3) * rr], rr * 0.22)}" fill="${herb}"/><path d="${circ(x, y, rr)}M${f1(x - rr * 0.78)} ${f1(y)}a${f1(rr * 0.78)} ${f1(rr * 0.78)} 0 1 0 ${f1(rr * 1.56)} 0a${f1(rr * 0.78)} ${f1(rr * 0.78)} 0 1 0 ${f1(-rr * 1.56)} 0" ${L(0.8)}/>`;
  // A taco from above: the folded tortilla, the filling down its length, onion, herbs, crema; a fish taco gets a
  // battered strip and slaw instead.
  const taco = (x, y, l, a, fish) => {
    const wd = l * 0.64, li = l * 0.8, wi = wd * 0.62;
    const lens = (ll, ww) => `M${f1(-ll / 2)} 0Q0 ${f1(-ww)} ${f1(ll / 2)} 0Q0 ${f1(ww)} ${f1(-ll / 2)} 0Z`;
    const inside = () => { const xx = R(-0.38, 0.34) * li, t = (xx + li / 2) / li, hw = 2 * wi * t * (1 - t) * 0.75; return [xx, R(-hw * 0.4, hw * 0.8)]; };
    let fill = '';
    if (fish) {
      fill = `<path d="${lens(li * 0.9, wi * 0.7)}" fill="${toast}" stroke="${ink}" stroke-width="${f1(sw * 0.7)}"/>` +
        `<path d="${bits(7, inside, l * 0.035)}" fill="${color.mix(toast, '#ffffff', 0.35)}"/>` +
        `<path d="M${f1(-li * 0.36)} ${f1(wi * 0.1)}q${f1(li * 0.18)} ${f1(wi * 0.4)} ${f1(li * 0.36)} ${f1(wi * 0.05)}t${f1(li * 0.34)} 0M${f1(-li * 0.3)} ${f1(wi * 0.42)}q${f1(li * 0.18)} ${f1(-wi * 0.3)} ${f1(li * 0.32)} 0t${f1(li * 0.28)} 0" ${L(1.3, color.mix(p.primary, p.paper, 0.45))}/>`;
    } else {
      fill = `<path d="${lens(li, wi)}" fill="${meat}"/><path d="${bits(8, inside, l * 0.05)}" fill="${color.mix(meat, '#000000', 0.35)}"/>`;
    }
    fill += `<path d="${bits(5, inside, l * 0.032)}" fill="${cream}"/><path d="${leaves(5, inside, l * 0.06)}" fill="${herb}"/>` +
      `<path d="M${f1(-li * 0.36)} ${f1(wi * 0.25)}q${f1(li * 0.09)} ${f1(-wi * 0.4)} ${f1(li * 0.18)} 0t${f1(li * 0.18)} 0t${f1(li * 0.18)} 0t${f1(li * 0.18)} 0" ${L(1.4, cream)}/>`;
    // The folded lip: the tortilla's near edge, curled over the filling.
    const lip = `M${f1(-l / 2)} 0Q0 ${f1(-wd)} ${f1(l / 2)} 0Q0 ${f1(-wd * 0.55)} ${f1(-l / 2)} 0Z`;
    return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(lens(l, wd))}<path d="${lens(l, wd)}" fill="${tortilla}"/>${fill}<path d="${lip}" fill="${tortilla}" stroke="${ink}" stroke-width="${f1(sw * 0.8)}"/><path d="${bits(3, () => [R(-0.3, 0.3) * l, -wd * R(0.32, 0.4)], l * 0.03)}" fill="${toast}" opacity=".8"/><path d="${lens(l, wd)}" ${L()}/></g>`;
  };
  // A tray of tacos: the metal tray, the paper liner, three in a row.
  const tray = (x, y, tw, a, fish) => {
    const th = tw * 0.62;
    return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(`M${f1(-tw / 2)} ${f1(-th / 2)}h${f1(tw)}v${f1(th)}h${f1(-tw)}Z`)}` +
      `<rect x="${f1(-tw / 2)}" y="${f1(-th / 2)}" width="${f1(tw)}" height="${f1(th)}" rx="${f1(tw * 0.04)}" fill="${color.mix(p.ink, p.paper, 0.55)}" stroke="${ink}" stroke-width="${f1(sw)}"/>` +
      `<rect x="${f1(-tw * 0.44)}" y="${f1(-th * 0.4)}" width="${f1(tw * 0.88)}" height="${f1(th * 0.8)}" fill="${kraft}" transform="rotate(${f1(R(-3, 3))})"/>` +
      [-1, 0, 1].map((k) => taco(k * tw * 0.27, k * th * 0.04, tw * 0.5, 90 + k * 6 + R(-4, 4), fish)).join('') + '</g>';
  };
  // A plate: the china, its well, and what's on it.
  const plate = (x, y, rr, on) => shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${china}"/><path d="${circ(x, y, rr * 0.74)}" ${L(0.5, color.mix(china, ink, 0.25))}/>${on}<path d="${circ(x, y, rr)}" ${L()}/>`;
  // A main: slices of grilled meat fanned out, rice, leaves of salad.
  const main = (x, y, rr) => {
    let slices = '';
    for (let i = 0; i < 5; i++) {
      const sx = x + rr * 0.05 + i * rr * 0.1 - (i - 2) * (i - 2) * rr * 0.03, sy = y - rr * 0.42 + i * rr * 0.15, sl = rr * 0.56, sh = rr * 0.24;
      slices += `<g transform="translate(${f1(sx)} ${f1(sy)}) rotate(${-40 + i * 7})"><rect x="${f1(-sl / 2)}" y="${f1(-sh / 2)}" width="${f1(sl)}" height="${f1(sh)}" rx="${f1(sh * 0.4)}" fill="${color.mix(meat, '#000000', 0.2)}" stroke="${ink}" stroke-width="${f1(sw * 0.7)}"/><rect x="${f1(-sl * 0.4)}" y="${f1(-sh * 0.24)}" width="${f1(sl * 0.8)}" height="${f1(sh * 0.48)}" rx="${f1(sh * 0.2)}" fill="${color.mix(p.accent, p.paper, 0.45)}"/><path d="M${f1(-sl * 0.25)} ${f1(-sh / 2)}l${f1(-sh * 0.3)} ${f1(sh * 0.3)}M0 ${f1(-sh / 2)}l${f1(-sh * 0.3)} ${f1(sh * 0.3)}M${f1(sl * 0.25)} ${f1(-sh / 2)}l${f1(-sh * 0.3)} ${f1(sh * 0.3)}" ${L(1.4, '#000000')} opacity=".55"/></g>`;
    }
    const rice = `M${f1(x - rr * 0.66)} ${f1(y + rr * 0.05)}c${f1(rr * 0.05)} ${f1(-rr * 0.34)} ${f1(rr * 0.46)} ${f1(-rr * 0.22)} ${f1(rr * 0.5)} ${f1(rr * 0.1)}c${f1(rr * 0.08)} ${f1(rr * 0.36)} ${f1(-rr * 0.14)} ${f1(rr * 0.5)} ${f1(-rr * 0.34)} ${f1(rr * 0.44)}c${f1(-rr * 0.18)} ${f1(-rr * 0.06)} ${f1(-rr * 0.2)} ${f1(-rr * 0.24)} ${f1(-rr * 0.16)} ${f1(-rr * 0.54)}Z`;
    return `<path d="${rice}" fill="${color.mix(p.primary, p.paper, 0.5)}" stroke="${ink}" stroke-width="${f1(sw * 0.7)}"/><path d="${leaves(12, () => [x + R(-0.58, -0.28) * rr, y + R(0, 0.4) * rr], rr * 0.035)}" fill="${color.mix(p.primary, p.paper, 0.75)}"/>` +
      `<path d="${leaves(6, () => [x + R(-0.15, 0.3) * rr, y + R(0.35, 0.58) * rr], rr * 0.2)}" fill="${herb}" stroke="${ink}" stroke-width="${f1(sw * 0.5)}"/>` + slices + wedge(x - rr * 0.38, y - rr * 0.42, rr * 0.18, 210);
  };
  // Corn on the cob: kernels in rows, crema, crumbled cheese, chile, the stick.
  const cob = (x, y, l, a) => {
    const cw = l * 0.3;
    return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(`M${f1(-l / 2)} ${f1(-cw / 2)}h${f1(l)}v${f1(cw)}h${f1(-l)}Z`, 0.8)}` +
      `<path d="M${f1(-l / 2 - l * 0.22)} ${f1(-cw * 0.08)}h${f1(l * 0.26)}v${f1(cw * 0.16)}h${f1(-l * 0.26)}Z" fill="${color.mix(p.accent, p.paper, 0.6)}" stroke="${ink}" stroke-width="${f1(sw * 0.7)}"/>` +
      `<rect x="${f1(-l / 2)}" y="${f1(-cw / 2)}" width="${f1(l)}" height="${f1(cw)}" rx="${f1(cw / 2)}" fill="url(#spk)"/>` +
      `<path d="M${f1(-l * 0.42)} 0${Array.from({ length: 9 }, (_, i) => `L${f1(-l * 0.42 + (i + 1) * l * 0.09)} ${f1((i % 2 ? -1 : 1) * cw * 0.28)}`).join('')}" ${L(2.2, cream)}/>` +
      `<path d="${bits(16, () => [R(-0.44, 0.42) * l, R(-0.34, 0.3) * cw], cw * 0.07)}" fill="${china}"/><path d="${bits(14, () => [R(-0.44, 0.42) * l, R(-0.34, 0.3) * cw], cw * 0.035)}" fill="${salsa}"/>` +
      `<rect x="${f1(-l / 2)}" y="${f1(-cw / 2)}" width="${f1(l)}" height="${f1(cw)}" rx="${f1(cw / 2)}" ${L()}/></g>`;
  };
  // A bowl of soup: glazed clay, the broth, radish, strips of tortilla, herbs and a lime wedge on the rim.
  const bowl = (x, y, rr) => shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${clay}"/><path d="${circ(x, y, rr * 0.8)}" fill="${color.mix(p.primary, p.ink, 0.15)}" stroke="${ink}" stroke-width="${f1(sw * 0.7)}"/>` +
    `<path d="M${f1(x - rr * 0.5)} ${f1(y - rr * 0.35)}a${f1(rr * 0.7)} ${f1(rr * 0.7)} 0 0 1 ${f1(rr * 0.6)} ${f1(-rr * 0.2)}" ${L(1.6, color.mix(p.primary, '#ffffff', 0.35))} opacity=".6"/>` +
    [0, 1, 2, 3].map((i) => { const a = i * 1.7 + R(0, 0.5), d = rr * R(0.2, 0.5), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; return `<path d="${circ(cx, cy, rr * 0.1)}" fill="${china}" stroke="${salsa}" stroke-width="${f1(sw * 1.4)}"/>`; }).join('') +
    `<path d="${bits(8, () => [x + R(-0.45, 0.4) * rr, y + R(-0.45, 0.4) * rr], rr * 0.09)}" fill="${tortilla}" stroke="${ink}" stroke-width="${f1(sw * 0.4)}"/><path d="${leaves(9, () => [x + R(-0.4, 0.4) * rr, y + R(-0.4, 0.4) * rr], rr * 0.09)}" fill="${herb}"/>` +
    `<path d="${circ(x, y, rr)}" ${L()}/>` + wedge(x + rr * 0.72, y - rr * 0.62, rr * 0.26, 40);
  // A glass from above: the rim, the drink, ice, a lime wheel and a straw.
  const glass = (x, y, rr, drink) => {
    let ice = '';
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + R(0, 0.6), d = rr * 0.32, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, k = rr * 0.26, t = R(0, 90);
      ice += `<rect x="${f1(cx - k / 2)}" y="${f1(cy - k / 2)}" width="${f1(k)}" height="${f1(k)}" rx="${f1(k * 0.18)}" fill="#ffffff" fill-opacity=".35" stroke="#ffffff" stroke-opacity=".8" stroke-width="${f1(sw * 0.7)}" transform="rotate(${f1(t)} ${f1(cx)} ${f1(cy)})"/>`;
    }
    const lw = x - rr * 0.25, ly = y + rr * 0.3, lr = rr * 0.32;
    const segs = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `M${f1(lw)} ${f1(ly)}l${f1(Math.cos(a) * lr * 0.8)} ${f1(Math.sin(a) * lr * 0.8)}`; }).join('');
    return shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${color.mix(bg.lit, '#ffffff', 0.4)}" fill-opacity=".55"/><path d="${circ(x, y, rr * 0.86)}" fill="${drink}" fill-opacity=".9"/>${ice}` +
      `<path d="${circ(lw, ly, lr)}" fill="${lime}" stroke="${rind}" stroke-width="${f1(sw * 1.8)}"/><path d="${segs}" ${L(0.6, color.mix(lime, '#ffffff', 0.5))}/>` +
      `<path d="M${f1(x + rr * 0.2)} ${f1(y - rr * 0.15)}l${f1(rr * 0.9)} ${f1(-rr * 0.7)}" ${L(3.2, ink)}/><path d="M${f1(x + rr * 0.2)} ${f1(y - rr * 0.15)}l${f1(rr * 0.9)} ${f1(-rr * 0.7)}" ${L(1.6, china)}/>` +
      `<path d="${circ(x, y, rr)}M${f1(x - rr * 0.86)} ${f1(y)}a${f1(rr * 0.86)} ${f1(rr * 0.86)} 0 1 0 ${f1(rr * 1.72)} 0a${f1(rr * 0.86)} ${f1(rr * 0.86)} 0 1 0 ${f1(-rr * 1.72)} 0" ${L(0.8)}/>`;
  };
  // A cup of coffee on its saucer, with the handle.
  const cup = (x, y, rr) => shadow(circ(x, y, rr * 1.45)) + `<path d="${circ(x, y, rr * 1.45)}" fill="${china}" stroke="${ink}" stroke-width="${f1(sw * 0.8)}"/><path d="${circ(x, y, rr * 1.1)}" ${L(0.5, color.mix(china, ink, 0.25))}/>` +
    `<path d="M${f1(x + rr * 0.9)} ${f1(y - rr * 0.18)}h${f1(rr * 0.45)}a${f1(rr * 0.18)} ${f1(rr * 0.18)} 0 0 1 0 ${f1(rr * 0.36)}h${f1(-rr * 0.45)}" fill="${china}" stroke="${ink}" stroke-width="${f1(sw)}"/>` +
    `<path d="${circ(x, y, rr)}" fill="${china}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="${circ(x, y, rr * 0.84)}" fill="${color.mix(p.primary, p.ink, 0.35)}"/>` +
    `<path d="M${f1(x - rr * 0.3)} ${f1(y - rr * 0.1)}c${f1(rr * 0.1)} ${f1(-rr * 0.4)} ${f1(rr * 0.5)} ${f1(-rr * 0.4)} ${f1(rr * 0.6)} 0c${f1(-rr * 0.1)} ${f1(rr * 0.2)} ${f1(-rr * 0.2)} ${f1(rr * 0.5)} ${f1(-rr * 0.3)} ${f1(rr * 0.5)}c${f1(-rr * 0.1)} 0 ${f1(-rr * 0.2)} ${f1(-rr * 0.3)} ${f1(-rr * 0.3)} ${f1(-rr * 0.5)}Z" fill="${color.mix(p.accent, cream, 0.5)}" opacity=".85"/>`;
  // A tart or flan with one slice cut and pulled out.
  const sweet = (x, y, rr) => {
    const t = rr * 0.72, a0 = -0.5, a1 = 0.35, P = (a, d) => `${f1(x + Math.cos(a) * d)} ${f1(y + Math.sin(a) * d)}`;
    const body = `M${f1(x)} ${f1(y)}L${P(a1, t)}A${f1(t)} ${f1(t)} 0 1 1 ${P(a0, t)}Z`;
    const sx = rr * 0.12, sl = `M${f1(x + sx)} ${f1(y)}L${P(a0, t).replace(/^[\d.]+/, (v) => f1(+v + sx))}A${f1(t)} ${f1(t)} 0 0 1 ${P(a1, t).replace(/^[\d.]+/, (v) => f1(+v + sx))}Z`;
    let cuts = '';
    for (let i = 1; i < 6; i++) { const a = a1 + i * ((Math.PI * 2 - (a1 - a0)) / 6); cuts += `M${f1(x)} ${f1(y)}L${P(a, t)}`; }
    return plate(x, y, rr, `${shadow(body, 0.4)}<path d="${body}" fill="${toast}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="M${f1(x)} ${f1(y)}L${P(a1, t * 0.86)}A${f1(t * 0.86)} ${f1(t * 0.86)} 0 1 1 ${P(a0, t * 0.86)}Z" fill="${color.mix(p.primary, p.accent, 0.45)}"/><path d="${cuts}" ${L(0.6)}/>` +
      `<path d="${sl}" fill="${color.mix(p.primary, p.accent, 0.45)}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="${leaves(4, () => [x - rr * 0.2 + R(-0.15, 0.15) * rr, y + R(-0.3, 0.2) * rr], rr * 0.07)}" fill="${cream}"/>`);
  };
  // A pizza: crust, sauce, cheese, rounds of salami and torn herbs, cut into slices.
  const pizza = (x, y, rr) => {
    let cuts = '';
    for (let i = 0; i < 4; i++) { const a = i * (Math.PI / 4) + 0.2; cuts += `M${f1(x - Math.cos(a) * rr * 0.9)} ${f1(y - Math.sin(a) * rr * 0.9)}L${f1(x + Math.cos(a) * rr * 0.9)} ${f1(y + Math.sin(a) * rr * 0.9)}`; }
    const tops = [0, 1, 2, 3, 4, 5].map((i) => { const a = i * 1.05 + R(0, 0.4), d = rr * R(0.3, 0.6); return `<path d="${circ(x + Math.cos(a) * d, y + Math.sin(a) * d, rr * 0.1)}" fill="${color.mix(meat, '#000000', 0.2)}" stroke="${ink}" stroke-width="${f1(sw * 0.5)}"/>`; }).join('');
    return shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${toast}"/><path d="${circ(x, y, rr * 0.84)}" fill="${salsa}"/><path d="${leaves(10, () => [x + R(-0.55, 0.5) * rr, y + R(-0.55, 0.5) * rr], rr * 0.2)}" fill="${cream}"/>${tops}` +
      `<path d="${leaves(5, () => [x + R(-0.5, 0.5) * rr, y + R(-0.5, 0.5) * rr], rr * 0.1)}" fill="${herb}"/><path d="${cuts}" ${L(0.7)}/><path d="${circ(x, y, rr)}" ${L()}/>`;
  };
  const dish = (kind, x, y, u) => {
    if (kind === 'taco') return tray(x, y, u * 2.1, (w < h ? 90 : 0) + R(-8, 8), false);
    // Fish tacos come two to a plate, crossed, with a wedge of lime.
    if (kind === 'fish') return plate(x, y, u, taco(x - u * 0.12, y - u * 0.18, u * 1.15, -28, true) + taco(x + u * 0.1, y + u * 0.2, u * 1.15, -8, true) + wedge(x + u * 0.5, y - u * 0.5, u * 0.2, 35));
    if (kind === 'elote') return plate(x, y, u, cob(x - u * 0.05, y - u * 0.24, u * 1.2, -18 + R(-4, 4)) + cob(x + u * 0.05, y + u * 0.26, u * 1.2, -12 + R(-4, 4))) + wedge(x + u * 0.62, y - u * 0.62, u * 0.2, 30);
    if (kind === 'bowl') return bowl(x, y, u);
    if (kind === 'drink') return glass(x - u * 0.38, y + u * 0.1, u * 0.62, color.mix(p.primary, p.paper, 0.3)) + glass(x + u * 0.62, y - u * 0.48, u * 0.5, color.mix(p.accent, p.paper, 0.45));
    if (kind === 'coffee') return cup(x, y, u * 0.55);
    if (kind === 'sweet') return sweet(x, y, u);
    if (kind === 'pizza') return pizza(x, y, u);
    return plate(x, y, u, main(x, y, u));
  };

  // The table: charred planks with their grain, under the plaster light; the butcher paper on it, a little askew.
  let grainD = '';
  const pl = h / (s.slot === 'hero' ? 5 : 6);
  for (let i = 1; i < 7; i++) grainD += `M0 ${f1(i * pl)}H${w}`;
  let fib = '';
  for (let i = 0; i < 18; i++) { const y = R(0, h), x = R(-0.1, 0.8) * w; fib += `M${f1(x)} ${f1(y)}q${f1(w * 0.1)} ${f1(R(-6, 6))} ${f1(w * R(0.15, 0.35))} ${f1(R(-4, 4))}`; }
  const sheet = (x, y, sw2, sh, a) => `<g transform="rotate(${f1(a)} ${f1(x + sw2 / 2)} ${f1(y + sh / 2)})">${shadow(`M${f1(x)} ${f1(y)}h${f1(sw2)}v${f1(sh)}h${f1(-sw2)}Z`, 0.6)}<path d="M${f1(x)} ${f1(y)}h${f1(sw2)}v${f1(sh)}h${f1(-sw2)}Z" fill="${kraft}"/><path d="M${f1(x + sw2 * 0.5)} ${f1(y)}v${f1(sh)}M${f1(x)} ${f1(y + sh * 0.52)}h${f1(sw2)}" ${L(0.6, color.mix(kraft, '#000000', 0.12))}/></g>`;
  // The wall's own light is left out under the table; one soft patch of daylight falls across it instead.
  let body = bg.body.replace(/<path[^>]*\/>/g, '') + `<rect width="${w}" height="${h}" fill="${table}" opacity=".86"/><path d="M${f1(w * 0.3)} ${f1(-h * 0.1)}h${f1(w * 0.5)}l${f1(w * 0.3)} ${f1(h * 1.2)}h${f1(-w * 0.5)}Z" fill="${bg.lit}" opacity=".1" filter="url(#b${index})"/><path d="${grainD}" ${L(1, '#000000')} opacity=".5"/><path d="${fib}" ${L(0.6, color.mix(table, '#ffffff', 0.12))}/>`;
  const defs = bg.defs + `<filter id="sps" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.012)}"/></filter>` +
    `<pattern id="spk" width="${f1(m * 0.024)}" height="${f1(m * 0.03)}" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="${f1(m * 0.024 - 2)}" height="${f1(m * 0.03 - 2)}" rx="${f1(m * 0.008)}" fill="${color.mix(p.accent, p.paper, 0.2)}" stroke="${color.mix(p.accent, p.ink, 0.35)}" stroke-width="1.5"/></pattern>`;
  // Without a menu, the kind of place says what's on the table (a coffee shop gets cups, not a grill plate).
  const own = spKind(`${c.what} ${c.name}`);
  const kinds = [...new Set((c.menu || []).flatMap((sec) => sec.items).map((i) => spKind(i.name)))];
  if (!kinds.length) kinds.push(...(own === 'coffee' ? ['coffee', 'sweet'] : own === 'drink' ? ['drink', 'plate'] : [own]));
  if (s.slot === 'hero') {
    const k = [...kinds, 'plate', 'drink', 'bowl'].filter((x, i, a) => a.indexOf(x) === i);
    const main1 = k.find((x) => x === 'taco' || x === 'fish') || k[0];
    const rest = k.filter((x) => !['taco', 'fish', main1, 'drink', 'coffee'].includes(x));
    const drink = k.includes('coffee') ? 'coffee' : 'drink';
    body += sheet(w * 0.1, h * 0.14, w * 0.5, h * 0.76, R(-4, -1)) + sheet(w * 0.55, h * 0.28, w * 0.38, h * 0.62, R(2, 5));
    body += dish(main1, w * 0.36, h * 0.5, h * 0.26) + dish(rest[0] || 'plate', w * 0.75, h * 0.6, h * 0.26);
    body += (drink === 'coffee' ? cup(w * 0.88, h * 0.16, h * 0.11) : glass(w * 0.88, h * 0.16, h * 0.13, color.mix(p.primary, p.paper, 0.3))) + (/coffee|sweet/.test(main1) ? '' : ramekin(w * 0.58, h * 0.86, h * 0.085) + wedge(w * 0.62, h * 0.26, h * 0.06, 200));
  } else {
    const n = +s.slot.slice(1);
    const named = (c.menu || []).some((sec) => sec.items.some((i) => i.name === s.alt));
    const kind = named ? spKind(s.alt) : kinds[(n - 1) % kinds.length];
    body += sheet(w * R(0.04, 0.1), h * R(0.08, 0.14), w * 0.86, h * 0.76, R(-5, 5));
    body += dish(kind, w * 0.5, h * 0.5, w * 0.34);
    if (!/drink|coffee|sweet/.test(kind)) body += n % 2 ? ramekin(w * 0.82, h * 0.85, w * 0.09) : wedge(w * 0.2, h * 0.84, w * 0.08, 190 + R(-20, 20));
  }
  return art.svgDoc(w, h, defs, body);
}


function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.22), '#0c0705', 0.55) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const hero = c.profile.hero || `Food at ${c.name}`;
  const dishes = (c.menu || []).flatMap((sec) => sec.items).map((i) => i.name);
  const pool = [...new Set([...dishes, ...g, `A dish at ${c.name}`, `${c.name}, up close`, `Food at ${c.name}`])].filter((x) => x && x !== hero);
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1600, h: 1100, style: 'plates', alt: hero },
    { slot: 'd1', file: 'dish-1.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[0] },
    { slot: 'd2', file: 'dish-2.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[1] },
    { slot: 'd3', file: 'dish-3.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[2] },
  ];
}

function sections(c) {
  if (c.menu && c.menu.length) return c.menu;
  if (c.services.length) return [{ title: 'Menu', items: c.services.map((s) => ({ ...s, tags: [] })) }];
  return [];
}

// The member's own story, or nothing: the generated line ("X is a ... in Y. We're open ...") only restates the hero.
function ownAbout(c) {
  const all = c.aboutParas.join(' ');
  const made = all.startsWith(`${c.name} is a`) && all.split(/(?<=\.)\s+(?=[A-Z])/).filter((x) => !x.startsWith("We're open")).length <= 1;
  return all && !made ? c.aboutParas : [];
}

function nav(c) {
  return [
    sections(c).length && { label: 'Menu', href: '#menu' },
    c.orderLinks.length > 1 && { label: 'Order', href: '#order' },
    ownAbout(c).length && { label: 'Story', href: '#about' },
    { label: 'Visit', href: '#visit' },
    c.faq.length >= 2 && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

const TAG_NAMES = { V: 'Vegetarian', VG: 'Vegan', GF: 'Gluten free', DF: 'Dairy free', SPICY: 'Spicy' };

// The name, one span per letter (screen readers get the plain name). Its size comes from its length, in CSS, so the
// hero's height is known before the font arrives (CLS 0); the script only nudges it with a transform.
function kineticName(name) {
  const words = String(name).trim().split(/\s+/);
  const n = name.length;
  const lines = Math.min(words.length, n <= 18 ? 1 : n <= 30 ? 2 : 3);
  // The words split into that many lines, balanced by length, in the markup itself: the line count never depends on
  // which font has arrived, so the hero's height is fixed from the first paint.
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
  const longest = Math.max(...words.map((w) => w.length));
  // Bricolage Grotesque at 75% width, 800: about 0.37em a letter.
  const fs = Math.min(26, 252 / Math.max(longLine, 4)).toFixed(2);
  // Phones: a name of two or three words stacks one word a line; a longer one keeps its lines.
  const st = words.length > 1 && words.length < 4;
  const fsm = Math.min(40, 236 / Math.max(st ? longest : longLine, 3)).toFixed(2);
  let i = 0;
  const html = groups
    .map((g) => `<span class="kl">${g.map((w) => `<span class="kw">${[...w].map((ch) => `<span class="ch" data-ci-part style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span>`)
    .join(' ');
  return { html, fs, fsm, st, fh: [31, 20, 14][groups.length - 1], one: groups.length === 1 };
}

function tagsHtml(it) {
  return (it.tags || []).map((t) => ` <abbr class="tag" title="${esc(TAG_NAMES[t] || t)}">${esc(t)}</abbr>`).join('');
}

// One line of the price list: the dish, a dotted leader, the price; its description under it.
function dishLine(it) {
  const desc = it.blurb || it.description;
  return `<li class="dish"><p class="dish-top"><span class="dish-name">${esc(it.name)}${tagsHtml(it)}</span><span class="lead-dots" aria-hidden="true"></span>${it.priceText ? `<span class="dish-price">${esc(it.priceText)}</span>` : ''}</p>${desc ? `<p class="dish-desc">${esc(desc)}</p>` : ''}</li>`;
}

function menuHtml(secs) {
  if (secs.length === 1) return `<div class="mgrid one"><div class="grp-box"><ul class="panel">${secs[0].items.map(dishLine).join('\n')}</ul></div></div>`;
  return `<div class="mgrid">${secs
    .map((s, i) => `<div class="grp-box" data-rv style="--d:${Math.min(i, 6)}"><h3 class="grp"><span class="grp-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h3><ul class="panel">${s.items.map(dishLine).join('\n')}</ul></div>`)
    .join('\n')}</div>`;
}

function render(c) {
  const secs = sections(c);
  const kin = kineticName(c.name);
  const short = c.address ? c.address.split(',')[0] : c.area && !c.online ? c.area : '';
  const pIcon = c.primary ? { phone: 'phone', maps: 'pin', reserve: 'calendar', booking: 'calendar', form: '' }[c.primary.kind] || 'bag' : '';
  const sIcon = c.secondary ? (c.secondary.kind === 'reserve' ? 'calendar' : /maps|directions/i.test(c.secondary.label) ? 'pin' : '') : '';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const items = secs.flatMap((s) => s.items);
  const priced = (name) => items.find((x) => x.name === name);

  // The folio: what, where and when, set across a hairline like the head of a printed menu, leaving out what the lead
  // already says; the street and the way there close it.
  const said = String(c.heroSub || '').toLowerCase();
  const folio = [c.whatShort, c.city || (!c.online && c.area), c.hoursLine].filter((x) => x && !said.includes(String(x).toLowerCase()));
  const dirs = c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">Directions${icon('arrowUpRight', { size: 14 })}</a>` : '';
  const ticket = items.filter((x) => x.priceText).slice(0, 3);
  const tick = (i) => `<svg class="tk-tick" style="--k:${i}" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M3 9.5 7.2 13.5 15 4"/></svg>`;
  const hero = `<section class="hero" aria-labelledby="hero-title">
${folio.length || short ? `<div class="wrap folio" data-ci="then" data-ci-from="fade">${folio.map((x) => `<p${x === c.hoursLine ? ' class="fo-when"' : ''}>${esc(x)}</p>`).join('')}${short ? `<p class="fo-where"><span>${esc(short)}</span>${dirs}</p>` : ''}</div>` : ''}
<div class="name-wrap">
<h1 id="hero-title" data-ci="head" class="kin${kin.one ? ' one' : ''}${kin.st ? ' st' : ''}" style="--fs:${kin.fs}vw;--fh:${kin.fh}vh;--fsm:${kin.fsm}vw"><span class="sr-only">${esc(c.name)}</span><span class="kin-in" aria-hidden="true">${kin.html}</span></h1>
</div>
<div class="wrap hero-grid">
<div class="hero-copy">
${c.heroTitle && c.heroTitle !== c.name ? `<p class="hero-line" data-ci="then">${esc(c.heroTitle)}</p>` : ''}
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
${c.primary ? `<div class="ctas" data-ci="then">${mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon))}${c.secondary ? mag(P.button(c.secondary, 'btn btn-ghost btn-lg', sIcon)) : ''}</div>` : ''}
</div>
<div class="hero-media">
<div class="hm" data-ci="subject"><div class="hm-in">${P.img(c, 'hero', { cls: 'hero-img', eager: true }).replace('<img ', '<img data-par="0.05" ')}</div></div>
${ticket.length >= 2 ? `<div class="ticket-wrap" data-ci="then" data-ci-from="side"><div class="ticket" data-alive="0.6"><p class="tk-head"><span>${esc(c.name)}</span><span>No. ${String(ticket.length).padStart(3, '0')}</span></p><ul>${ticket.map((x, i) => `<li>${tick(i)}<span>${esc(x.name)}</span><i aria-hidden="true"></i><span class="tk-p">${esc(x.priceText)}</span></li>`).join('')}</ul></div></div>` : ''}
</div>
</div>
</section>`;

  const tagged = items.some((i) => (i.tags || []).length);
  const menu = secs.length
    ? `<section class="sec menu-sec paper" id="menu" aria-labelledby="menu-title">
<div class="wrap">
<div class="menu-head">
<h2 class="menu-title" id="menu-title" data-split>Menu</h2>
${tagged ? '<div class="menu-side"><p class="legend">V vegetarian, VG vegan, GF gluten free</p></div>' : ''}
</div>
${menuHtml(secs)}
${c.primary ? `<div class="menu-foot">${mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon))}</div>` : ''}
</div>
</section>`
    : '';

  const order = c.orderLinks.length > 1 || (c.orderLinks.length && c.reserve)
    ? `<section class="sec order" id="order" aria-labelledby="order-title"><div class="wrap order-grid">
<h2 class="h2" id="order-title" data-split>Order your way</h2>
<ul class="order-list">${c.orderLinks.map((l, i) => `<li data-rv style="--d:${i + 1}"><a href="${esc(l.href)}"><span>${esc(l.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>`).join('')}${c.reserve ? `<li data-rv style="--d:${c.orderLinks.length + 1}"><a href="${esc(c.booking.href)}"><span>${esc(c.booking.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>` : ''}</ul>
</div></section>`
    : '';

  // Three dishes at their own depth (the scroll moment), each captioned with its name (the price is on the menu).
  const plates = `<section class="plates" aria-label="Photos" data-sc><div class="wrap plate-row">
${['d1', 'd2', 'd3'].map((k, i) => {
    const im = c.images[k];
    const it = im && priced(im.alt);
    return `<figure class="plate p${i + 1}" data-sc-part style="--depth:${[0.5, 1.3, 0.85][i]};--turn:${[1.4, -1.8, 1.2][i]}deg"><div class="plate-in" data-alive="${[0.7, 1, 0.6][i]}">${P.img(c, k)}</div>${it ? `<figcaption><span class="pc-n">${String(i + 1).padStart(2, '0')}</span><span>${esc(it.name)}</span></figcaption>` : ''}</figure>`;
  }).join('\n')}
</div></section>`;

  // The story only when the member wrote one; the generated line would restate the hero, so it's left out and the
  // visit follows the menu.
  const own = ownAbout(c);
  const [first = '', ...rest] = own;
  const about = own.length ? `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<h2 class="about-title" id="about-title" data-split>${esc(c.tagline && !said.includes(c.tagline.toLowerCase()) ? c.tagline : 'The kitchen')}</h2>
<div class="about-copy">
${first ? `<p class="about-first" data-rv>${esc(first)}</p>` : ''}
${rest.map((p, i) => `<p data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig" data-rv style="--d:3">${esc(c.owner)}</p>` : ''}
</div>
</div></section>` : '';

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="sr-only" id="reviews-title">From our guests</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const directions = c.mapsUrl && (!c.primary || c.primary.kind !== 'maps') ? `<a data-mag class="btn btn-ghost btn-lg" href="${esc(c.mapsUrl)}">${icon('pin', { size: 18 })}Get directions</a>` : '';
  const addrLines = c.address ? c.address.split(/,\s*/) : c.area && !c.online ? [c.area] : [];
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title"><div class="wrap visit-grid">
<div class="visit-copy">
<h2 class="visit-title" id="visit-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas" data-rv style="--d:4">${c.primary ? mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon)) : ''}${directions}</div>
</div>
<div class="visit-facts">
${addrLines.length ? `<div class="vf" data-rv style="--d:2"><h3>Find us</h3><address class="label">${addrLines.map((l) => `<span>${esc(l)}</span>`).join('')}</address>${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>` : ''}
${c.hours.rows.length ? `<div class="vf" data-rv style="--d:3"><h3>Hours</h3>${P.hours(c.hours.rows, 'sp-hours')}</div>` : ''}
${c.phone || c.email ? `<div class="vf" data-rv style="--d:4"><h3>Call or write</h3>${c.phone ? `<p class="vf-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
${P.socials(c) ? `<div class="vf" data-rv style="--d:5"><h3>Follow</h3>${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  // Questions, only when there are two real ones, printed like the menu: the question set like a dish, the answer
  // under it. No accordion.
  const faq = c.faq.length >= 2
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-split>Questions</h2><dl class="qa">${c.faq.map((f, i) => `<div data-rv style="--d:${Math.min(i + 1, 6)}"><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const contact = c.email || c.formMode !== 'email'
    ? `<section class="sec contact paper" id="contact" aria-labelledby="contact-title"><div class="wrap contact-grid">
<div><h2 class="h2" id="contact-title" data-split>${/cater|truck|bakery|cake/i.test(`${c.what} ${c.profile.id}`) ? 'Catering, events and big orders' : 'Big orders and questions'}</h2><p class="lead" data-rv style="--d:3">Send a few details and we will get back to you.</p></div>
<div class="form-wrap slip" data-rv style="--d:2">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.date }, { ...P.FIELD_PRESETS.guests }, 'message'], submit: 'Send', subject: `Message for ${c.name}` })}</div>
</div></section>`
    : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-sp', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, order, plates, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '3px', radiusSm: '2px', btnRadius: '3px', max: '80rem' } };
}

// Nudges the name to the width with a transform only (its box is already sized in CSS, so nothing moves); marks today's
// hours.
const JS = `(function(){var d=document;
var k=d.querySelector('.kin-in');function fit(){if(!k)return;k.style.transform='';var h=k.parentNode,w=h.clientWidth,ws=[].slice.call(k.querySelectorAll('.kw')),st=h.classList.contains('st')&&innerWidth<640;var ls=st?ws:[].slice.call(k.querySelectorAll('.kl')),m=Math.max.apply(0,ls.map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.86,Math.min(1.08,w/m));k.style.transform=Math.abs(r-1)<.004?'':'scale('+r.toFixed(3)+')'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var D=['sun','mon','tue','wed','thu','fri','sat'],t=new Date().getDay();[].slice.call(d.querySelectorAll('.sp-hours>div')).forEach(function(r){var s=(r.querySelector('dt')||{}).textContent||'',x=s.toLowerCase(),hit=/every ?day|daily/.test(x);x.replace(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*(?:\\s*(?:to|-|\\u2013)\\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*)?/g,function(m,a,b){var i=D.indexOf(a),j=b?D.indexOf(b):i;for(var n=0;n<7;n++){if((i+n)%7===t)hit=true;if((i+n)%7===j)break}});if(hit)r.classList.add('today')});
})();`;

const CSS = `
${FOOTER_CSS}
:root{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--primary-deep:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-soft:color-mix(in srgb,var(--primary) 20%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--paper:color-mix(in srgb,var(--on-dark) 45%,#ecdfca);--ease:cubic-bezier(.16,1,.3,1);color-scheme:dark}
.paper{--bg:var(--paper);--ink:var(--dark);--muted:color-mix(in srgb,var(--dark) 74%,var(--on-dark));--line:color-mix(in srgb,var(--dark) 22%,var(--on-dark));--pop:color-mix(in srgb,var(--primary) 70%,var(--dark));--focus:var(--dark);background:var(--bg);color:var(--ink);color-scheme:light}
h1,h2,h3{font-weight:800;font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
.h2{font-size:clamp(2.8rem,1.6rem + 4.6vw,6rem);line-height:.86}
.lead{color:var(--muted)}
.btn{font-weight:600;letter-spacing:.01em}
.btn-primary{box-shadow:none}
.btn:hover{transform:none}
.btn-ghost{border-width:1px;border-color:var(--line)}
.btn-ghost:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .35s ease,border-color .35s ease}
.hdr.scrolled{background:var(--dark);border-bottom-color:var(--line-on-dark)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.45rem;font-weight:800;font-stretch:75%;line-height:1;letter-spacing:0;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{display:block;padding:.5rem 0;font-weight:500;text-decoration:none;color:var(--muted-on-dark);background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--on-dark);background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{background:transparent;border-color:var(--line-on-dark);border-radius:3px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(.75rem,.5rem + 1vw,1.5rem) clamp(3.5rem,2rem + 5vw,7rem)}
.folio{display:flex;flex-wrap:wrap;gap:.35rem 2rem;justify-content:space-between;padding-block:.7rem;border-block:1px solid var(--line);font-size:.8rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.folio p:first-child{color:var(--ink)}
@media (max-width:47.99rem){.fo-when{display:none}}
.fo-where{display:flex;align-items:center;gap:.4rem 1.25rem}
.fo-where a{display:inline-flex;align-items:center;gap:.25rem;min-height:2.75rem;margin-block:-.7rem;color:var(--ink);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:.2em}
.fo-where a:hover{text-decoration-color:currentColor}
.name-wrap{position:relative;padding-inline:max(1rem,(100% - var(--max)) / 2);margin-top:clamp(1rem,2vw,2rem);overflow:hidden}
.kin{font-size:clamp(3rem,min(var(--fs),max(var(--fh),11.5rem)),22rem);font-weight:800;font-stretch:75%;line-height:.8;letter-spacing:-.025em;text-transform:none;padding-block:.05em .06em}
.kin-in{display:block;transform-origin:0 50%}
.kl{display:block;width:max-content;white-space:nowrap}
.kw{display:inline-block;white-space:nowrap}
@media (min-width:48rem){.name-wrap{padding-inline:max(2rem,(100% - var(--max)) / 2)}}
@media (max-width:39.99rem){.kin{font-size:var(--fsm)}.kin.st .kw{display:block;width:max-content}}
.ch{display:inline-block;transition:font-weight .5s cubic-bezier(.2,.8,.2,1),color .5s ease}
@media (hover:hover){html.m .ch:hover{font-weight:300;color:var(--pop)}html.m .ch:has(+.ch:hover),html.m .ch:hover+.ch{font-weight:540}}
.hero-grid{position:relative;display:grid;gap:2.5rem;margin-top:clamp(1.5rem,.8rem + 2.4vw,3rem)}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.hero-copy{grid-column:1/5;padding-top:.25rem}.hero-media{grid-column:6/13;margin-right:calc((min(100vw - 4rem,var(--max)) - 100vw) / 2)}}
.hero-line{font-family:var(--font-display);font-size:clamp(1.8rem,1.3rem + 1.6vw,2.6rem);font-weight:800;font-stretch:75%;line-height:.95;text-transform:uppercase;margin-bottom:1rem}
.hero .lead{max-width:30rem;font-size:1.15rem}
.ctas{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.75rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 100%}}
.hero-media{position:relative}
.hm{overflow:hidden;aspect-ratio:16/9;background:var(--primary-soft)}
.hm-in{height:100%;overflow:hidden}
.hero-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.ticket-wrap{position:absolute;left:clamp(-1rem,-4vw,-4rem);bottom:clamp(-2.5rem,-3vw,-1.5rem);width:min(19rem,72%)}
@media (max-width:59.99rem){.ticket-wrap{left:.75rem;bottom:-2rem}}
.ticket{padding:1rem 1.1rem 1.15rem;background:var(--paper);color:var(--dark);box-shadow:0 1px 0 color-mix(in srgb,var(--dark) 20%,transparent),0 30px 50px -30px rgba(0,0,0,.8);transform-origin:50% 0;cursor:pointer}
.tk-head{display:flex;justify-content:space-between;gap:1rem;padding-bottom:.6rem;margin-bottom:.4rem;border-bottom:1px dashed color-mix(in srgb,var(--dark) 40%,transparent);font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.ticket li{display:flex;align-items:baseline;gap:.5rem;padding:.3rem 0;font-size:.95rem;font-weight:500}
.ticket li i{flex:1;min-width:1rem;border-bottom:1px dotted color-mix(in srgb,var(--dark) 45%,transparent)}
.tk-p{font-variant-numeric:tabular-nums;font-weight:600}
.tk-tick{flex:none;align-self:center;margin-left:-.15rem;overflow:visible}
.tk-tick path{fill:none;stroke:color-mix(in srgb,var(--primary) 72%,var(--dark));stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:20}
html.m .tk-tick path{stroke-dashoffset:20}
html.m.ci-go .tk-tick path{animation:tkTick .5s var(--ease) calc(2.3s + var(--k) * .45s) forwards}
@keyframes tkTick{to{stroke-dashoffset:0}}
.menu-head{display:grid;gap:1rem 3rem;align-items:end;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem);padding-bottom:1rem;border-bottom:2px solid var(--ink)}
@media (min-width:48rem){.menu-head{grid-template-columns:1fr auto}}
.menu-title{font-size:clamp(4.5rem,2rem + 12vw,13rem);line-height:.78;letter-spacing:-.03em}
.menu-side{display:grid;gap:.2rem;font-size:.85rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
@media (min-width:48rem){.menu-side{text-align:right;padding-bottom:.4rem}}
.legend{letter-spacing:.02em;text-transform:none;font-weight:500}
.mgrid{display:grid;gap:2.75rem 4rem}
@media (min-width:56rem){.mgrid{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}.mgrid.one .panel{columns:2;column-gap:4rem}}
.grp{display:flex;align-items:baseline;gap:.8rem;margin-bottom:.4rem;padding-bottom:.6rem;border-bottom:1px solid var(--line);font-size:clamp(1.7rem,1.4rem + 1vw,2.4rem);line-height:1}
.grp-n{font-family:var(--font-body);font-size:.85rem;font-weight:600;letter-spacing:.06em;color:var(--muted);font-variant-numeric:tabular-nums}
.dish{break-inside:avoid;padding:.85rem 0;border-bottom:1px solid var(--line)}
.dish-top{display:flex;align-items:baseline;gap:.6rem}
.dish-name{font-size:1.1rem;font-weight:600;line-height:1.3}
.lead-dots{flex:1;min-width:1.5rem;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 45%,transparent);transform:translateY(-.25em)}
.dish-price{font-size:1.1rem;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dish:hover .dish-price{color:var(--pop)}
.dish:hover .lead-dots{border-bottom-color:var(--pop)}
.dish-desc{margin-top:.2rem;max-width:30rem;font-size:.97rem;color:var(--muted)}
.tag{margin-left:.3rem;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-decoration:none;color:var(--muted);vertical-align:.15em}
.menu-foot{margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
.paper .btn-primary{background:var(--dark);color:var(--on-dark)}
.paper .btn-primary:hover{background:color-mix(in srgb,var(--dark) 85%,var(--primary))}
.order-grid{display:grid;gap:2rem}
@media (min-width:60rem){.order-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.order-list{border-top:1px solid var(--line)}
.order-list li{border-bottom:1px solid var(--line)}
.order-list a{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:clamp(1rem,.8rem + 1vw,1.5rem) 0;font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.2vw,3.2rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase;text-decoration:none}
.order-list a .i{flex:none;color:var(--pop);transition:transform .4s var(--ease)}
.order-list a:hover .i{transform:translate(4px,-4px)}
.plates{padding-block:clamp(4rem,2rem + 6vw,8rem) clamp(6rem,3rem + 8vw,11rem);overflow:hidden}
.plate-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:1rem;align-items:start}
.plate{margin:0}
.p1{grid-column:1/5;margin-top:clamp(2rem,6vw,6rem)}
.p2{grid-column:5/10}
.p3{grid-column:10/13;margin-top:clamp(4rem,12vw,12rem)}
@media (max-width:47.99rem){.plate-row{gap:2rem 1rem}.p1{grid-column:1/9;margin-top:0}.p2{grid-column:4/13;margin-top:0}.p3{grid-column:1/8;margin-top:0}}
.plate-in{overflow:hidden;aspect-ratio:4/5;background:var(--primary-soft);cursor:pointer;transform-origin:50% 50%;outline:1px solid transparent;backface-visibility:hidden}
.plate[data-sc-part]{outline:1px solid transparent;backface-visibility:hidden}
.plate img{width:100%;height:100%;object-fit:cover}
.plate figcaption{display:flex;align-items:baseline;gap:.6rem;margin-top:.7rem;font-size:.92rem;color:var(--muted)}
.plate figcaption span:nth-child(2){color:var(--ink);font-weight:600}
.pc-n{font-variant-numeric:tabular-nums;font-size:.78rem;letter-spacing:.08em}
.about-grid{display:grid;gap:2rem 4rem}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr))}.about-title{grid-column:1/7}.about-copy{grid-column:7/12;padding-top:.6rem}}
.about-title{font-size:clamp(2.6rem,1.6rem + 4vw,5.6rem);line-height:.88}
.about-copy{display:grid;gap:1.1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.about-first{font-size:clamp(1.3rem,1.1rem + .8vw,1.7rem);line-height:1.35;color:var(--ink)}
.sig{font-family:var(--font-display);font-size:1.6rem;font-weight:800;font-stretch:75%;text-transform:uppercase;color:var(--ink)}
.quotes{display:grid;border-top:1px solid var(--line)}
.quote{display:grid;gap:1rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--line)}
@media (min-width:60rem){.quote{grid-template-columns:repeat(12,minmax(0,1fr));align-items:baseline}.quote blockquote{grid-column:1/10}.quote figcaption{grid-column:10/13;text-align:right}}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.9rem,1.3rem + 2.4vw,3.6rem);font-weight:700;font-stretch:80%;line-height:1;letter-spacing:-.02em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-size:.9rem;font-weight:600;color:var(--muted)}
.visit{border-top:1px solid var(--line)}
.visit-grid{display:grid;gap:3rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.visit-copy{grid-column:1/8}.visit-facts{grid-column:9/13;padding-top:1rem}}
.visit-title{font-size:clamp(3.6rem,2rem + 8vw,10rem);line-height:.8;letter-spacing:-.03em}
.visit .lead{margin-top:1.5rem;max-width:30rem}
.visit .ctas{margin-top:2rem}
.visit-facts{display:grid;gap:0;border-top:1px solid var(--line)}
.vf{padding-block:1.25rem;border-bottom:1px solid var(--line)}
.vf h3{margin-bottom:.6rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.14em;font-stretch:100%;color:var(--muted)}
.label{display:grid;font-style:normal;font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1vw,2.2rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase}
.vf-big{font-family:var(--font-display);font-size:1.7rem;font-weight:800;font-stretch:75%;line-height:1.1}
.vf p+p{margin-top:.4rem}
.vf a{color:var(--ink)}
.vf .vf-big a{text-decoration:none}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;margin-top:.4rem;font-weight:600;text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.sp-hours div{padding:.4rem 0;border-bottom:1px dotted var(--line);font-variant-numeric:tabular-nums}
.sp-hours dd{color:var(--ink)}
.sp-hours .today dt,.sp-hours .today dd{color:var(--pop)}
.sp-hours .today dt::after{content:' (today)';font-weight:400}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.h2{grid-column:1/5}.faq-grid>div{grid-column:6/13}}
.qa{border-top:2px solid var(--ink)}
.qa>div{display:grid;gap:.4rem;padding-block:1.25rem;border-bottom:1px solid var(--line)}
@media (min-width:48rem){.qa>div{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:2rem}}
.qa dt{font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .6vw,1.7rem);font-weight:800;font-stretch:75%;line-height:1.05;text-transform:uppercase}
.qa dd{margin:0;color:var(--muted)}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.contact-grid>div:first-child{grid-column:1/6}.form-wrap{grid-column:7/13}}
.contact .lead{margin-top:1.25rem;max-width:26rem}
.slip{padding:clamp(1.25rem,1rem + 1.4vw,2.25rem);border-top:2px dashed color-mix(in srgb,var(--ink) 45%,transparent);border-bottom:2px dashed color-mix(in srgb,var(--ink) 45%,transparent);background:color-mix(in srgb,var(--paper) 70%,#ffffff)}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid color-mix(in srgb,var(--ink) 40%,transparent);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1.5px 0 var(--ink)}
.ftr{border-top:2px solid var(--paper)}
.ftr-name{font-size:clamp(2.2rem,1.6rem + 2.4vw,3.6rem);font-weight:800;font-stretch:75%;line-height:.85;letter-spacing:-.02em;text-transform:uppercase}
.ftr-links a,.ftr-contact a{text-decoration:none}
.ftr-links a:hover,.ftr-contact a:hover{text-decoration:underline}
.ftr-contact .i{color:var(--pop)}
.menu-panel{background:var(--paper);color:var(--dark);border-top:0;border-bottom:2px solid var(--dark);--line:color-mix(in srgb,var(--dark) 22%,var(--on-dark))}
.menu-panel li a{display:flex;align-items:baseline;gap:.6rem;padding:.9rem 0;border-bottom:1px solid var(--line);font-size:2.2rem;font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase;color:var(--dark)}
.menu-panel li a::after{content:'';flex:1;border-bottom:1.5px dotted color-mix(in srgb,var(--dark) 40%,transparent)}
.menu-panel li a:hover{color:color-mix(in srgb,var(--primary) 70%,var(--dark))}
.menu-panel .btn-primary{background:var(--dark);color:var(--on-dark)}
.mbar{background:var(--dark);border-top-color:var(--line-on-dark);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'restaurant',
  name: 'Supper',
  bestFor: 'Restaurants, cafes, bars, bakeries and food trucks, with motion',
  why: 'Warm and appetizing on a dark page, with motion: your name pours in and fills the screen, your first dishes are set on a ticket the kitchen ticks off, the full menu is printed on paper with prices on dotted leaders, and your dishes turn past as you scroll.',
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Schibsted+Grotesk:wght@400;500;600', display: ['Bricolage Grotesque', 'grotesk'], body: ['Schibsted Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): poured in, a ticket and plates you can nudge, three dishes that turn as you
  // pass.
  choreo: { intro: 'pour', alive: ['drift', 'tap'], scroll: 'scene', pace: 'medium', look: 'warm and generous: charred dark, butcher paper' },
  art: supperArt,
  tokens,
  slots,
  nav,
  render,
};
