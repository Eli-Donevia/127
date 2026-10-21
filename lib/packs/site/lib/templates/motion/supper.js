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
const { esc } = require('../shared');

const id = 'supper';

const f1 = (n) => String(Math.round(n));

// The dish drawn for its photo slot: one plate seen from above on butcher paper over the charred table, built from
// light (window light falling across it, glazes, soft shadows and hairline edges, char and crumb as texture), not from
// outlines. The kind comes from the dish's name; with no menu, from the kind of place, and a place we can't read gets a
// table laid for one.
function spKind(t) {
  const s = String(t || '').toLowerCase();
  if (/fish|baja|shrimp|camar|pescado/.test(s)) return 'fish';
  if (/taco|tostada|quesadilla|burrito|gordita|sope|taqueria/.test(s)) return 'taco';
  if (/elote|corn|esquite|cob\b/.test(s)) return 'elote';
  if (/pizza|flatbread|pizzeria/.test(s)) return 'pizza';
  if (/soup|pozole|bowl|ramen|pho\b|stew|chili|curry|menudo|caldo|noodle|udon/.test(s)) return 'bowl';
  if (/coffee|latte|espresso|cappuccino|\btea\b|mocha|cortado|cafe|café|roaster/.test(s)) return 'coffee';
  if (/agua|horchata|marg|drink|beer|cerveza|mezcal|tequila|soda|lemonade|juice|cocktail|wine|spritz|michelada|limonada|\bbar\b|brewery|taproom/.test(s)) return 'drink';
  if (/flan|cake|pie\b|tart|dessert|churro|pastel|cheesecake|brownie|cookie|pastry|croissant|concha|sweet|bakery|patisserie|donut|ice cream|gelato/.test(s)) return 'sweet';
  if (/pollo|chicken|turkey|duck/.test(s)) return 'bird';
  if (/steak|asada|carne|brisket|rib|pork|lamb|bbq|barbecue|grill|smokehouse|brasa|kebab|chop/.test(s)) return 'grill';
  return 'set';
}

function supperArt(s, { p, c, seed, index, art }) {
  if (!/^(hero|d\d)$/.test(s.slot)) return null;
  const { w, h } = s;
  const r = art.rng(`${seed}:sp:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const mix = color.mix;
  // Natural food colours, warmed a little toward the member's palette so the plate sits in the page.
  const warm = (hex, k = 0.12) => mix(hex, p.primary, k);
  const china = mix('#f4f1ea', p.paper, 0.3);
  const table = mix(mix(p.ink, p.primary, 0.25), '#0b0705', 0.5);
  const kraft = mix(mix('#d9c3a0', p.primary, 0.1), p.paper, 0.2);
  const corn = warm('#ead8a8', 0.06), meat = warm('#6b3a22', 0.08), herb = '#3f7a2c', lime = '#9cc24a', onion = '#f3efe4';
  const cream = '#f6f0e0', red = warm('#a8321e', 0.1);
  const steel = 'url(#st)';
  const P2 = (x, y) => `${f1(x)} ${f1(y)}`;
  const circ = (cx, cy, rr) => `M${f1(cx - rr)} ${f1(cy)}a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(-rr * 2)} 0Z`;
  // A soft, irregular round: n points around an ellipse, joined with curves through their midpoints.
  const blob = (cx, cy, rx, ry, n = 9, j = 0.12, a0 = 0) => {
    const pts = Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2, k = 1 + R(-j, j); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
    const mid = (a, b) => P2((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    return `M${mid(pts[n - 1], pts[0])}${pts.map((q, i) => `Q${P2(q[0], q[1])} ${mid(q, pts[(i + 1) % n])}`).join('')}Z`;
  };
  // Many small rounded bits in one path (onion, crumbs, cotija, seeds).
  const bits = (n, at, sz) => { let d = ''; for (let i = 0; i < n; i++) { const [x, y] = at(); const a = sz * R(0.5, 1.1), b = a * R(0.6, 1); d += `M${f1(x)} ${f1(y)}l${f1(a)} ${f1(a * R(-0.3, 0.3))}l${f1(b * R(-0.3, 0.2))} ${f1(b)}l${f1(-a)} ${f1(a * R(-0.2, 0.2))}Z`; } return d; };
  // Leaves of cilantro or basil: small almonds, one path.
  const leaves = (n, at, sz) => { let d = ''; for (let i = 0; i < n; i++) { const [x, y] = at(); const a = R(0, 6.3), l = sz * R(0.7, 1.2), dx = Math.cos(a) * l, dy = Math.sin(a) * l; d += `M${f1(x)} ${f1(y)}q${f1(dx / 2 - dy * 0.4)} ${f1(dy / 2 + dx * 0.4)} ${f1(dx)} ${f1(dy)}q${f1(-dx / 2 + dy * 0.4)} ${f1(-dy / 2 - dx * 0.4)} ${f1(-dx)} ${f1(-dy)}Z`; } return d; };
  const inDisc = (cx, cy, rr) => () => { const a = R(0, 6.3), d = Math.sqrt(r()) * rr; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d]; };
  // The shadow every object casts away from the window (down and to the right), soft-edged.
  const shadow = (d, k = 1) => `<path d="${d}" fill="#000" opacity=".42" transform="translate(${f1(m * 0.012 * k)} ${f1(m * 0.02 * k)})" filter="url(#sh)"/>`;
  // A glaze highlight: a thin arc of window light on a rim.
  const glint = (cx, cy, rr, a0, a1, wd, op = 0.7) => `<path d="M${P2(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr)}A${f1(rr)} ${f1(rr)} 0 0 1 ${P2(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr)}" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${f1(wd)}" stroke-linecap="round" filter="url(#sf)"/>`;
  // A plate: china with a lit rim, the well a step down, a hairline where they meet.
  const plate = (x, y, rr) => shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="url(#ch)"/><path d="${circ(x, y, rr * 0.72)}" fill="url(#wl)"/><path d="${circ(x, y, rr * 0.72)}" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="2"/>` + glint(x, y, rr * 0.92, 3.5, 4.6, rr * 0.03) + glint(x, y, rr * 0.75, 0.4, 1.1, rr * 0.012, 0.5);
  // A lime wedge from above: the rind's curve, the flesh lit from the cut, its segments in light.
  const wedge = (x, y, rr, a) => `<g transform="translate(${P2(x, y)}) rotate(${f1(a)})">${shadow(`M${f1(-rr)} 0A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rr)} 0Z`, 0.4)}<path d="M${f1(-rr)} 0A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rr)} 0Z" fill="#3f6b1f"/><path d="M${f1(-rr * 0.88)} 0A${f1(rr * 0.88)} ${f1(rr * 0.88)} 0 0 1 ${f1(rr * 0.88)} 0Z" fill="url(#lm)"/><path d="M0 0L${P2(-rr * 0.6, -rr * 0.55)}M0 0V${f1(-rr * 0.8)}M0 0L${P2(rr * 0.6, -rr * 0.55)}" stroke="#f4f8d8" stroke-opacity=".6" stroke-width="${f1(rr * 0.05)}"/></g>`;
  // A textured mass (meat, crust, crumb): its colour, then the bump light, clipped to itself.
  const mass = (d, fill, tx = 'bp') => `<path d="${d}" fill="${fill}"/><path d="${d}" fill="${fill}" filter="url(#${tx})"/>`;
  // A corn tortilla: toasted at the edge, char spots from the comal.
  const tortilla = (x, y, rr) => shadow(circ(x, y, rr), 0.4) + `<path d="${circ(x, y, rr)}" fill="url(#tt)"/><path d="${circ(x, y, rr)}" fill="#7a4216" opacity=".55" filter="url(#cr)"/>`;
  // Street tacos, open on the plate: the chopped meat heaped nearly to the edge (or battered fish on slaw), diced
  // onion and cilantro over it.
  const taco = (x, y, rr, fish) => {
    let top = tortilla(x, y, rr);
    if (fish) {
      let slaw = '';
      for (let i = 0; i < 16; i++) { const [sx, sy] = inDisc(x, y, rr * 0.62)(); const a = R(-0.6, 0.6); slaw += `M${P2(sx, sy)}q${P2(rr * 0.12, rr * 0.05 * a)} ${P2(rr * 0.22, rr * a * 0.2)}`; }
      top += `<path d="${slaw}" fill="none" stroke="#c9d69a" stroke-width="${f1(rr * 0.03)}" stroke-linecap="round"/><path d="${slaw.replace(/M(\d+)/g, (q, v) => `M${+v + 6}`)}" fill="none" stroke="#8d4a7a" stroke-opacity=".75" stroke-width="${f1(rr * 0.022)}" stroke-linecap="round"/>`;
      const fd = blob(x - rr * 0.05, y, rr * 0.72, rr * 0.26, 10, 0.1);
      top += `<g transform="rotate(${f1(R(-30, -15))} ${P2(x, y)})">${shadow(fd, 0.25)}${mass(fd, 'url(#fb)', 'bf')}</g><path d="M${P2(x - rr * 0.45, y + rr * 0.12)}c${P2(rr * 0.3, -rr * 0.12)} ${P2(rr * 0.6, -rr * 0.12)} ${P2(rr * 0.9, -rr * 0.3)}" fill="none" stroke="${cream}" stroke-width="${f1(rr * 0.045)}" stroke-linecap="round"/>`;
    } else {
      const md = blob(x, y, rr * 0.8, rr * 0.76, 15, 0.22);
      top += shadow(md, 0.15) + mass(md, 'url(#mt)', 'bm') + `<path d="${md}" fill="#1c0b04" opacity=".8" filter="url(#cr)"/>`;
    }
    return top + `<path d="${bits(fish ? 6 : 12, inDisc(x, y, rr * 0.6), rr * 0.1)}" fill="${onion}" opacity=".95"/><path d="${leaves(fish ? 6 : 11, inDisc(x, y, rr * 0.64), rr * 0.17)}" fill="${herb}"/><path d="${leaves(5, inDisc(x, y, rr * 0.55), rr * 0.11)}" fill="#6fa847"/>`;
  };
  // Sliced grilled meat, shingled in an arc: a seared crust round the cut face (pink for steak, pale for chicken).
  const grill = (x, y, u, bird) => {
    let o = '';
    // Chicken comes off the grill in pieces, golden and charred at the edges, beside a mound of rice.
    if (bird) {
      const rice = blob(x - u * 0.28, y + u * 0.3, u * 0.36, u * 0.3, 11, 0.12);
      o += shadow(rice, 0.2) + mass(rice, '#efe4cc', 'bm');
      [[0.12, -0.34, 0.42, 0.2, -20], [0.32, 0.08, 0.4, 0.19, 35], [-0.26, -0.12, 0.36, 0.18, 70]].forEach(([dx, dy, rx, ry, t]) => {
        const d = blob(0, 0, rx * u, ry * u, 10, 0.14);
        o += `<g transform="translate(${P2(x + dx * u, y + dy * u)}) rotate(${t})">${shadow(d, 0.3)}${mass(d, 'url(#gc)', 'bm')}<path d="${d}" fill="#3a1808" filter="url(#cr)"/><path d="M${P2(-rx * u * 0.6, -ry * u * 0.4)}q${P2(rx * u * 0.6, -ry * u * 0.3)} ${P2(rx * u * 1.1, 0)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${f1(u * 0.025)}" stroke-linecap="round" filter="url(#sf)"/></g>`;
      });
      return o + `<path d="${leaves(10, () => [x + R(-0.45, 0.1) * u, y + R(0.1, 0.5) * u], u * 0.06)}" fill="${herb}"/>` + wedge(x + u * 0.5, y + u * 0.5, u * 0.2, -30);
    }
    for (let i = 0; i < 6; i++) {
      const sx = x - u * 0.12 + i * u * 0.05, sy = y - u * 0.5 + i * u * 0.18, sl = u * 0.74, sh = u * 0.26;
      const d = `M${P2(sx - sl / 2, sy - sh / 2)}h${f1(sl)}v${f1(sh)}h${f1(-sl)}Z`;
      o += `<g transform="rotate(${f1(-12 + i * 5)} ${P2(sx, sy)})">${shadow(d, 0.15)}<rect x="${f1(sx - sl / 2)}" y="${f1(sy - sh / 2)}" width="${f1(sl)}" height="${f1(sh)}" rx="${f1(sh * 0.3)}" fill="url(#mt)" filter="url(#bp)"/><rect x="${f1(sx - sl * 0.45)}" y="${f1(sy - sh * 0.3)}" width="${f1(sl * 0.9)}" height="${f1(sh * 0.52)}" rx="${f1(sh * 0.22)}" fill="url(#${bird ? 'pb' : 'pk'})"/></g>`;
    }
    return o + `<path d="${leaves(12, () => [x + R(0.2, 0.55) * u, y + R(-0.3, 0.4) * u], u * 0.07)}" fill="${herb}"/><path d="${bits(8, () => [x + R(0.25, 0.55) * u, y + R(-0.3, 0.4) * u], u * 0.025)}" fill="${red}"/>` + wedge(x + u * 0.5, y - u * 0.52, u * 0.2, 30);
  };
  // Corn on the cob: kernels as a pattern, the cob shaded as a cylinder, crema smeared on, cotija and chile.
  const cob = (x, y, l, a) => {
    const cw = l * 0.3;
    const d = `M${P2(-l / 2 + cw / 2, -cw / 2)}h${f1(l - cw)}a${f1(cw / 2)} ${f1(cw / 2)} 0 0 1 0 ${f1(cw)}h${f1(-(l - cw))}a${f1(cw / 2)} ${f1(cw / 2)} 0 0 1 0 ${f1(-cw)}Z`;
    return `<g transform="translate(${P2(x, y)}) rotate(${f1(a)})">${shadow(d, 0.5)}<rect x="${f1(-l * 0.72)}" y="${f1(-cw * 0.06)}" width="${f1(l * 0.26)}" height="${f1(cw * 0.12)}" fill="#d9c7a3"/><path d="${d}" fill="#e2ad2e"/><path d="${d}" fill="url(#kp)"/><path d="${d}" fill="url(#cy)"/>` +
      `<path d="${blob(0, -cw * 0.08, l * 0.36, cw * 0.18, 12, 0.3)}" fill="${cream}" opacity=".75"/><path d="${bits(14, () => [R(-0.42, 0.4) * l, R(-0.3, 0.2) * cw], cw * 0.07)}" fill="#fbfaf4"/><path d="${bits(18, () => [R(-0.42, 0.4) * l, R(-0.35, 0.3) * cw], cw * 0.025)}" fill="${red}" opacity=".85"/></g>`;
  };
  // A bowl of soup: glazed clay with its rim in light, the broth with the window in it, garnish floating.
  const bowl = (x, y, u) => {
    const b = u * 0.8;
    return shadow(circ(x, y, u)) + `<path d="${circ(x, y, u)}" fill="url(#cl)"/><path d="${circ(x, y, b)}" fill="url(#br)"/>` + glint(x, y, u * 0.92, 3.4, 4.7, u * 0.03) +
      `<clipPath id="bc"><path d="${circ(x, y, b)}"/></clipPath><g clip-path="url(#bc)"><path d="M${P2(x - b * 0.7, y - b)}h${f1(b * 0.34)}l${P2(b * 0.5, b * 1.2)}h${f1(-b * 0.34)}ZM${P2(x - b * 0.25, y - b)}h${f1(b * 0.2)}l${P2(b * 0.5, b * 1.2)}h${f1(-b * 0.2)}Z" fill="#fff" opacity=".13" filter="url(#sf)"/></g>` +
      [0, 1, 2].map((i) => { const a = i * 2.1 + R(0, 0.5), d = b * R(0.25, 0.45), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, rr = b * 0.13; return `<path d="${circ(cx, cy, rr)}" fill="#c24763"/><path d="${circ(cx, cy, rr * 0.82)}" fill="#f6ece9"/>`; }).join('') +
      `<path d="${leaves(9, inDisc(x, y, b * 0.6), b * 0.1)}" fill="${herb}"/><path d="${bits(7, inDisc(x, y, b * 0.5), b * 0.08)}" fill="${corn}"/>` + wedge(x + u * 0.74, y - u * 0.62, u * 0.26, 40);
  };
  // A glass from above: the rim catching the window, the drink, ice, a lime wheel.
  const glass = (x, y, rr, drink) => {
    let ice = '';
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + R(0, 0.6), d = rr * 0.34, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, k = rr * 0.3; ice += `<rect x="${f1(cx - k / 2)}" y="${f1(cy - k / 2)}" width="${f1(k)}" height="${f1(k)}" rx="${f1(k * 0.2)}" fill="#fff" fill-opacity=".22" stroke="#fff" stroke-opacity=".5" stroke-width="${f1(rr * 0.02)}" transform="rotate(${f1(R(0, 90))} ${P2(cx, cy)})"/>`; }
    const lx = x - rr * 0.22, ly = y + rr * 0.28, lr = rr * 0.3;
    return shadow(circ(x, y, rr), 0.7) + `<path d="${circ(x, y, rr)}" fill="${drink}" opacity=".9"/><path d="${circ(x, y, rr)}" fill="url(#gl)"/>${ice}<path d="${circ(lx, ly, lr)}" fill="#4d7d22"/><path d="${circ(lx, ly, lr * 0.86)}" fill="url(#lm)"/>` +
      `<path d="${circ(x, y, rr)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${f1(rr * 0.025)}"/>` + glint(x, y, rr * 0.93, 3.3, 4.8, rr * 0.05, 0.9);
  };
  // A cup of coffee on its saucer: china in light, the crema's ring, a steel spoon.
  const cup = (x, y, rr) => shadow(circ(x, y, rr * 1.5)) + `<path d="${circ(x, y, rr * 1.5)}" fill="url(#ch)"/>` + glint(x, y, rr * 1.4, 3.5, 4.5, rr * 0.04) +
    `<path d="M${P2(x + rr * 0.92, y - rr * 0.16)}h${f1(rr * 0.42)}a${f1(rr * 0.16)} ${f1(rr * 0.16)} 0 0 1 0 ${f1(rr * 0.32)}h${f1(-rr * 0.42)}Z" fill="url(#ch)"/>` + shadow(circ(x, y, rr), 0.4) +
    `<path d="${circ(x, y, rr)}" fill="url(#ch)"/><path d="${circ(x, y, rr * 0.84)}" fill="url(#cf)"/>` + glint(x, y, rr * 0.93, 3.4, 4.6, rr * 0.05, 0.9) +
    `<g transform="rotate(${f1(R(20, 35))} ${P2(x, y)})"><path d="M${P2(x - rr * 0.12, y + rr * 1.05)}h${f1(rr * 0.24)}l${P2(-rr * 0.04, rr * 0.38)}h${f1(-rr * 0.16)}Z" fill="${steel}"/><ellipse cx="${f1(x)}" cy="${f1(y + rr * 1.55)}" rx="${f1(rr * 0.07)}" ry="${f1(rr * 0.17)}" fill="${steel}"/></g>`;
  // A tart: the fluted crust baked gold, the custard glossy in the window light, one slice cut and drawn out.
  const sweet = (x, y, u) => {
    const t = u * 0.66, a0 = -0.42, a1 = 0.42, at = (a, d, dx = 0) => P2(x + dx + Math.cos(a) * d, y + Math.sin(a) * d);
    const rest = `M${P2(x, y)}L${at(a1, t)}A${f1(t)} ${f1(t)} 0 1 1 ${at(a0, t)}Z`, cut = `M${P2(x + u * 0.16, y)}L${at(a0, t, u * 0.16)}A${f1(t)} ${f1(t)} 0 0 1 ${at(a1, t, u * 0.16)}Z`;
    const top = (d, k) => `<path d="${d}" transform="translate(${P2(x * (1 - k), y * (1 - k))}) scale(${k})" fill="url(#fl)"/>`;
    return plate(x, y, u) + [rest, cut].map((d) => shadow(d, 0.3) + mass(d, '#c98a3e', 'bp') + top(d, 0.86)).join('') + glint(x, y, t * 0.6, 3.5, 4.3, u * 0.04, 0.8) +
      `<path d="${bits(16, inDisc(x - u * 0.2, y, u * 0.3), u * 0.012)}" fill="#fff" opacity=".7"/><g transform="rotate(-30 ${P2(x + u * 0.62, y + u * 0.3)})"><rect x="${f1(x + u * 0.6)}" y="${f1(y - u * 0.1)}" width="${f1(u * 0.05)}" height="${f1(u * 0.7)}" rx="${f1(u * 0.02)}" fill="${steel}"/></g>`;
  };
  // A pizza: the cornicione blistered from the oven, sauce, pools of cheese, basil.
  const pizza = (x, y, u) => {
    const pools = [0, 1, 2, 3, 4].map((i) => { const a = i * 1.26 + R(0, 0.4), d = u * R(0.3, 0.5); return blob(x + Math.cos(a) * d, y + Math.sin(a) * d, u * 0.16, u * 0.14, 8, 0.2); }).join('');
    return shadow(circ(x, y, u)) + `<path d="${circ(x, y, u)}" fill="url(#cn)"/><path d="${circ(x, y, u)}" fill="#2a1206" opacity=".85" filter="url(#cr)"/><path d="${blob(x, y, u * 0.8, u * 0.8, 14, 0.04)}" fill="${red}"/><path d="${blob(x, y, u * 0.8, u * 0.8, 14, 0.04)}" fill="${red}" filter="url(#bp)" opacity=".6"/>` +
      `<path d="${pools}" fill="#f7eedb" filter="url(#sf)"/><path d="${pools}" fill="#f3e2bd" filter="url(#bp)" opacity=".7"/><path d="${leaves(5, inDisc(x, y, u * 0.5), u * 0.26)}" fill="#3f7d2c"/>` + glint(x, y, u * 0.9, 3.5, 4.4, u * 0.03, 0.4);
  };
  // A table laid for one: a folded linen napkin, the plate waiting, knife and fork, a glass of water.
  const set = (x, y, u) => {
    const nx = x - u * 1.25;
    return shadow(`M${P2(nx - u * 0.26, y - u * 0.7)}h${f1(u * 0.52)}v${f1(u * 1.4)}h${f1(-u * 0.52)}Z`, 0.3) + `<rect x="${f1(nx - u * 0.26)}" y="${f1(y - u * 0.7)}" width="${f1(u * 0.52)}" height="${f1(u * 1.4)}" fill="url(#nk)"/><path d="M${P2(nx, y - u * 0.7)}v${f1(u * 1.4)}" stroke="#000" stroke-opacity=".1" stroke-width="2"/>` +
      `<rect x="${f1(nx - u * 0.06)}" y="${f1(y - u * 0.55)}" width="${f1(u * 0.06)}" height="${f1(u * 1.1)}" rx="${f1(u * 0.03)}" fill="${steel}"/><path d="M${P2(nx + u * 0.05, y - u * 0.55)}h${f1(u * 0.1)}v${f1(u * 0.2)}l${P2(-u * 0.03, u * 0.06)}v${f1(u * 0.84)}h${f1(-u * 0.04)}v${f1(-u * 0.84)}l${P2(-u * 0.03, -u * 0.06)}Z" fill="${steel}"/>` +
      plate(x, y, u) + shadow(`M${P2(x + u * 1.18, y - u * 0.55)}h${f1(u * 0.07)}v${f1(u * 1.2)}h${f1(-u * 0.07)}Z`, 0.2) + `<path d="M${P2(x + u * 1.18, y - u * 0.55)}q${P2(u * 0.09, 0)} ${P2(u * 0.09, u * 0.5)}v${f1(u * 0.7)}h${f1(-u * 0.09)}Z" fill="${steel}"/>` + glass(x + u * 0.9, y - u * 1.05, u * 0.3, '#dfe8ea');
  };
  const nm = String(s.alt || '').toLowerCase();
  const pour = /horchata|milk|coconut|cream|atole/.test(nm) ? '#efe5d2' : /marg|lime|agua|mojito|limon/.test(nm) ? '#cfdc94' : /wine|jamaica|sangria/.test(nm) ? '#7a1f33' : '#c98a3b';
  const dish = (kind, x, y, u) => {
    if (kind === 'taco' || kind === 'fish') {
      const rr = u * 0.42;
      return plate(x, y, u) + [[-0.36, -0.3], [0.36, -0.18], [-0.02, 0.4]].map(([dx, dy]) => taco(x + dx * u, y + dy * u, rr, kind === 'fish')).join('') + wedge(x + u * 0.62, y + u * 0.48, u * 0.17, -30);
    }
    if (kind === 'elote') return plate(x, y, u) + cob(x - u * 0.04, y - u * 0.22, u * 1.25, -16) + cob(x + u * 0.04, y + u * 0.24, u * 1.25, -10) + wedge(x + u * 0.62, y - u * 0.6, u * 0.18, 30);
    if (kind === 'bowl') return bowl(x, y, u);
    if (kind === 'drink') return glass(x - u * 0.3, y + u * 0.12, u * 0.62, pour) + glass(x + u * 0.62, y - u * 0.5, u * 0.46, '#e9d9a8');
    if (kind === 'coffee') return cup(x, y, u * 0.55);
    if (kind === 'sweet') return sweet(x, y, u);
    if (kind === 'pizza') return pizza(x, y, u);
    if (kind === 'grill' || kind === 'bird') return plate(x, y, u) + grill(x, y, u, kind === 'bird');
    return set(x, y, u * 0.62);
  };

  const g = (id, stops, at = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`;
  const rg = (id, stops, at = 'cx=".42" cy=".38" r=".7"') => `<radialGradient id="${id}" ${at}>${stops.map(([o, cc, op]) => `<stop offset="${o}" stop-color="${cc}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;
  const bump = (id, fq, sc, k = 1.25) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="2" seed="${f1(R(1, 90))}"/><feDiffuseLighting surfaceScale="${sc}" lighting-color="#fff"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting><feComposite in2="SourceGraphic" operator="arithmetic" k1="${k}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const defs = `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(m * 0.014)}"/></filter><filter id="sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(m * 0.003)}"/></filter><filter id="pn" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.03)}"/></filter>` +
    `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0"/></filter>` +
    `<filter id="wd" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0025 .08" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1.05"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    `<filter id="cr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${(30 / m).toFixed(4)}" numOctaves="3" seed="${f1(R(1, 90))}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 3.6"/><feGaussianBlur stdDeviation="${f1(m * 0.003)}"/><feComposite in="SourceGraphic" operator="in"/></filter>` +
    bump('bp', (40 / m).toFixed(4), 4) + bump('bf', (60 / m).toFixed(4), 3, 1.35) + bump('bm', (110 / m).toFixed(4), 9, 1.5) +
    g('tb', [[0, mix(table, '#fff', 0.06)], [1, mix(table, '#000', 0.35)]], 'x1="0" y1="0" x2="1" y2="1"') +
    rg('kr', [[0, mix(kraft, '#fff', 0.12)], [1, mix(kraft, '#000', 0.08)]], 'cx=".35" cy=".3" r="1"') +
    rg('ch', [[0, china], [0.86, china], [0.95, mix(china, '#000', 0.05)], [1, mix(china, '#000', 0.16)]], 'cx=".5" cy=".5" r=".5"') +
    rg('wl', [[0, mix(china, '#fff', 0.5)], [0.8, china], [1, mix(china, '#000', 0.07)]]) +
    rg('tt', [[0, mix(corn, '#fff', 0.15)], [0.75, corn], [1, mix(corn, '#7a4a1c', 0.45)]], 'cx=".45" cy=".42" r=".6"') +
    rg('mt', [[0, mix(meat, '#a0613a', 0.4)], [0.7, meat], [1, mix(meat, '#000', 0.4)]]) +
    g('fb', [[0, '#e9b45a'], [0.5, '#c9862e'], [1, '#8a5218']]) +
    rg('lm', [[0, '#f2f7c8'], [0.7, lime], [1, '#7aa63a']], 'cx=".5" cy=".9" r=".9"') +
    `<pattern id="kp" width="${f1(m * 0.026)}" height="${f1(m * 0.032)}" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="${f1(m * 0.024)}" height="${f1(m * 0.03)}" rx="${f1(m * 0.009)}" fill="url(#kn)"/></pattern>` + rg('kn', [[0, '#fff3b8'], [0.5, '#f4c84a'], [1, '#c98a1c']], 'cx=".35" cy=".3" r=".8"') + g('pk', [[0, '#c0705c'], [0.5, '#d48a76'], [1, '#a95a46']]) + rg('gc', [[0, '#e2a65a'], [0.7, '#b86f2c'], [1, '#6e3a14']]) + g('cy', [[0, '#000', 0.3], [0.3, '#fff', 0.25], [0.45, '#fff', 0], [1, '#000', 0.45]]) +
    rg('cl', [[0, mix(p.primary, '#5a2e1c', 0.5)], [0.85, mix(p.primary, '#5a2e1c', 0.5)], [1, mix(p.primary, '#1e0f08', 0.6)]], 'cx=".5" cy=".5" r=".5"') +
    rg('br', [[0, '#b8452a'], [0.8, '#8e2c18'], [1, '#5c1a0c']]) +
    rg('gl', [[0, '#fff', 0.05], [0.8, '#fff', 0.1], [1, '#fff', 0.45]], 'cx=".5" cy=".5" r=".5"') +
    rg('cf', [[0, '#8a5530'], [0.7, '#b07a47'], [0.92, '#d9b58a'], [1, '#5a3418']], 'cx=".5" cy=".5" r=".5"') +
    rg('fl', [[0, '#f2bf66'], [0.7, '#d8902f'], [1, '#9a5414']], 'cx=".4" cy=".35" r=".75"') +
    rg('cn', [[0, '#f0d2a0'], [0.8, '#f0d2a0'], [0.92, '#d9a35e'], [1, '#9a6230']], 'cx=".5" cy=".5" r=".5"') +
    g('st', [[0, '#5d6268'], [0.3, '#e8ebee'], [0.5, '#9aa0a6'], [1, '#4a4f55']], 'x1="0" y1="0" x2="1" y2="0"') +
    g('nk', [[0, mix(p.accent, '#fff', 0.55)], [0.5, mix(p.accent, '#fff', 0.7)], [1, mix(p.accent, '#fff', 0.45)]], 'x1="0" y1="0" x2="1" y2="0"');

  // The table: charred planks with their grain and seams; the butcher paper on it, a little askew, with its fold.
  const pl = h / 5;
  let seams = '';
  for (let i = 1; i < 6; i++) seams += `M0 ${f1(i * pl + R(-6, 6))}H${w}`;
  const sheet = (x, y, sw2, sh, a) => `<g transform="rotate(${f1(a)} ${P2(x + sw2 / 2, y + sh / 2)})">${shadow(`M${P2(x, y)}h${f1(sw2)}v${f1(sh)}h${f1(-sw2)}Z`, 0.5)}<rect x="${f1(x)}" y="${f1(y)}" width="${f1(sw2)}" height="${f1(sh)}" fill="url(#kr)"/><path d="M${P2(x + sw2 * 0.5, y)}v${f1(sh)}" stroke="#000" stroke-opacity=".08" stroke-width="2"/><path d="M${P2(x + sw2 * 0.5 + 2, y)}v${f1(sh)}" stroke="#fff" stroke-opacity=".25" stroke-width="1"/></g>`;
  let body = `<rect width="${w}" height="${h}" fill="url(#tb)"/><rect width="${w}" height="${h}" fill="#000" filter="url(#wd)" opacity=".55"/><path d="${seams}" stroke="#000" stroke-opacity=".6" stroke-width="3"/><path d="${seams.replace(/M0 (\d+)/g, (q, v) => `M0 ${+v + 3}`)}" stroke="#fff" stroke-opacity=".05" stroke-width="1.5"/>`;
  // Without a menu, the kind of place says what's on the table; a place we can't read gets a table laid for one.
  const own = spKind(`${c.what || ''} ${c.profile && c.profile.id || ''}`);
  const kinds = [...new Set((c.menu || []).flatMap((sec) => sec.items).map((i) => spKind(i.name)).filter((k) => k !== 'set'))];
  if (!kinds.length) kinds.push(...(own === 'coffee' ? ['coffee', 'sweet'] : own === 'drink' ? ['drink'] : own === 'set' ? ['set'] : [own, 'set']));
  if (s.slot === 'hero') {
    const main1 = kinds.find((x) => x === 'taco' || x === 'fish') || kinds[0];
    body += sheet(w * 0.12, h * 0.02, w * 0.6, h * 0.96, R(-4, -2));
    if (main1 === 'set') body += set(w * 0.5, h * 0.52, h * 0.3);
    else {
      body += dish(main1, w * 0.42, h * 0.52, h * 0.4);
      body += main1 === 'coffee' ? cup(w * 0.82, h * 0.32, h * 0.13) : main1 === 'drink' ? '' : glass(w * 0.82, h * 0.3, h * 0.14, '#d29a4b');
      if (!/coffee|sweet|drink/.test(main1)) body += wedge(w * 0.78, h * 0.74, h * 0.08, 160);
    }
  } else {
    const n = +s.slot.slice(1);
    const named = (c.menu || []).some((sec) => sec.items.some((i) => i.name === s.alt));
    const kind = named && spKind(s.alt) !== 'set' ? spKind(s.alt) : kinds[(n - 1) % kinds.length];
    body += sheet(w * R(0.04, 0.1), h * R(0.1, 0.14), w * 0.86, h * 0.74, R(-5, 5));
    body += kind === 'set' ? set(w * 0.56, h * 0.5, w * 0.22) : dish(kind, w * 0.5, h * 0.5, w * 0.36);
  }
  // The window: two panes of daylight falling across the whole table from the upper left, soft at the edges, and grain.
  const pw = w * 0.22, sk = w * 0.35;
  body += `<path d="M${P2(w * 0.05, -h * 0.1)}h${f1(pw)}l${P2(sk, h * 1.2)}h${f1(-pw)}ZM${P2(w * 0.05 + pw * 1.15, -h * 0.1)}h${f1(pw * 0.8)}l${P2(sk, h * 1.2)}h${f1(-pw * 0.8)}Z" fill="#fff6e6" opacity=".12" filter="url(#pn)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  const all = defs.match(/<(filter|linearGradient|radialGradient|pattern) id="[^"]+"[\s\S]*?<\/\1>/g);
  const need = (d) => d.includes('<pattern') ? d.replace(/^<pattern[^>]*>/, '') : '';
  const ref = body + all.filter((d) => body.includes(`url(#${d.match(/id="([^"]+)"/)[1]})`)).map(need).join('');
  const used = all.filter((d) => ref.includes(`url(#${d.match(/id="([^"]+)"/)[1]})`)).join('');
  // A long path drawn more than once (its shadow, its colour, its texture) is written once and used by reference.
  const seen = {};
  for (const [, d] of body.matchAll(/<path d="([^"]{60,})"/g)) seen[d] = (seen[d] || 0) + 1;
  let ids = '';
  Object.keys(seen).filter((d) => seen[d] > 1).forEach((d, i) => { ids += `<path id="u${i}" d="${d}"/>`; body = body.split(`<path d="${d}"`).join(`<use href="#u${i}"`); });
  return art.svgDoc(w, h, used + ids, body);
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
  // The lead ends at the fact: a closing sentence that only repeats a button under it ("Order online.") is dropped.
  const btns = [c.primary, c.secondary].filter(Boolean).map((l) => `${l.label}.`.toLowerCase());
  const sents = String(c.heroSub || '').split(/(?<=\.)\s+/);
  const sub = sents.length > 1 && btns.includes(sents[sents.length - 1].toLowerCase()) ? sents.slice(0, -1).join(' ') : c.heroSub;
  const said = String(sub || '').toLowerCase();
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
<p class="lead" data-ci="then">${esc(sub)}</p>
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

  // The close is an order slip from the pass: its head (the house, the heading, one line), the fields set like the
  // slip's rows, torn at both ends. It comes in as one piece, heading and form together.
  const contact = c.email || c.formMode !== 'email'
    ? `<section class="sec contact" id="contact" aria-labelledby="contact-title"><div class="wrap">
<div class="slip paper" data-rv>
<header class="slip-head"><p class="slip-k"><span>${esc(c.name)}</span>${short ? `<span>${esc(short)}</span>` : ''}</p><h2 class="h2" id="contact-title">${/cater|truck|bakery|cake/i.test(`${c.what} ${c.profile.id}`) ? 'Catering, events and big orders' : 'Big orders and questions'}</h2><p class="lead">Send a few details and we will get back to you.</p></header>
${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.date }, { ...P.FIELD_PRESETS.guests }, 'message'], submit: 'Send', subject: `Message for ${c.name}` })}
</div>
</div></section>`
    : '';

  // The foot of the page is the head of the menu again: the name set full width, then the folio's facts across a
  // hairline (where, when, how to reach us), and the small print.
  const foot = [
    addrLines.length && `<p><span class="sf-k">Find us</span>${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(addrLines.join(', '))}</a>` : esc(addrLines.join(', '))}</p>`,
    c.hoursLine && `<p><span class="sf-k">Open</span>${esc(c.hoursLine)}</p>`,
    c.phone && `<p><span class="sf-k">Call</span><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>`,
    c.email && `<p><span class="sf-k">Write</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>`,
  ].filter(Boolean);
  const footer = `<footer class="sp-ftr wrap">
<p class="sf-name" aria-hidden="true" style="--n:${Math.max(6, c.name.length)}">${esc(c.name)}</p>
${foot.length ? `<div class="sf-row">${foot.join('')}</div>` : ''}
<div class="sf-base"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${P.socials(c, { cls: 'sf-social', size: 18 })}</div>
</footer>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-sp', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, order, plates, about, reviews, visit, faq, contact, '</main>', footer, P.mobileBar(c)].filter(Boolean).join('\n');
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
:root{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--primary-deep:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-soft:color-mix(in srgb,var(--primary) 20%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--paper:color-mix(in srgb,var(--on-dark) 45%,#ecdfca);--ease:cubic-bezier(.16,1,.3,1);color-scheme:dark}
.paper{--bg:var(--paper);--ink:var(--dark);--muted:color-mix(in srgb,var(--dark) 74%,var(--on-dark));--line:color-mix(in srgb,var(--dark) 22%,var(--on-dark));--pop:color-mix(in srgb,var(--primary) 70%,var(--dark));--focus:var(--dark);background:var(--bg);color:var(--ink);color-scheme:light}
.menu-sec{position:relative;z-index:1}
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
.ticket{padding:1rem 1.1rem 1.15rem;background:var(--paper);color:var(--dark);box-shadow:0 1px 0 color-mix(in srgb,var(--dark) 20%,transparent),0 18px 28px -18px rgba(0,0,0,.7);transform-origin:50% 0;cursor:pointer}
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
.slip{--bg:color-mix(in srgb,var(--paper) 70%,#ffffff);position:relative;max-width:52rem;margin-inline:auto;padding:clamp(1.5rem,1rem + 2.4vw,3.25rem);background:var(--bg)}
.slip::before,.slip::after{content:'';position:absolute;left:0;right:0;height:10px;background:radial-gradient(circle at 50% 0,var(--dark) 5px,transparent 5.5px) 0 0/16px 10px repeat-x}
.slip::before{top:-5px}
.slip::after{bottom:-5px;transform:scaleY(-1)}
.slip-head{padding-bottom:clamp(1.25rem,1rem + 1vw,2rem);margin-bottom:clamp(1.25rem,1rem + 1vw,2rem);border-bottom:2px solid var(--ink)}
.slip-k{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1.25rem;padding-bottom:.6rem;border-bottom:1px dashed var(--line);font-size:.75rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.slip .h2{font-size:clamp(2.4rem,1.6rem + 3.2vw,4.6rem)}
.slip .lead{margin-top:.9rem;max-width:30rem}
@media (min-width:48rem){.slip .form{display:grid;grid-template-columns:1fr 1fr;gap:0 2rem}.slip .form>*{grid-column:1/-1}.slip .form>.field:not(:has(textarea)){grid-column:auto}}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid color-mix(in srgb,var(--ink) 40%,transparent);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1.5px 0 var(--ink)}
.sp-ftr{padding-block:clamp(3rem,2rem + 4vw,6rem) calc(2rem + env(safe-area-inset-bottom,0px));overflow:hidden}
.sf-name{font-family:var(--font-display);font-size:min(11rem,calc((min(100vw,80rem) - 3rem) / (var(--n) * .5)));font-weight:800;font-stretch:75%;line-height:.82;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap}
.sf-row{display:grid;gap:1rem 2rem;margin-top:clamp(1.5rem,1rem + 1.5vw,2.5rem);padding-block:1.1rem;border-block:1px solid var(--line)}
@media (min-width:48rem){.sf-row{grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))}}
.sf-row p{display:grid;gap:.3rem;font-size:.95rem}
.sf-k{font-size:.72rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.sf-row a{text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:background-size .35s var(--ease)}
.sf-row a:hover{background-size:100% 1px}
.sf-base{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;margin-top:1.25rem;font-size:.85rem;color:var(--muted)}
.sp-ftr .legal-links{margin-top:.75rem;text-align:left;color:var(--muted)}
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
