// Market (animated, product): a small shop with several products, for makers who sell candles, jewelry, skincare,
// prints or clothes.
//   Object: the shop's shelves. Under the headline the bench runs the full width as a photograph (the pieces lined up
//   as they come off it: a photoreal render from assets/real when there is one, else drawn), then the products stand
//   on dark ledges; each ledge is a shelf-edge rail carrying the member's group name, with a printed shelf ticket
//   (name, size, price, Buy) hanging under every piece. A drawn piece's label carries the product's real name and
//   size, set in HTML on the blank paper (a rendered piece carries none).
//   Material: unbleached paper and a dark ledge in the member's ink (daylight, its own mode); after hours (the other
//   mode) the floor goes warm near-black and the ledges a step lighter than it. A condensed grotesk for the tickets,
//   prices in tabular figures, hairline rules. No cards, no shadows, no pills.
//   One move: assemble. The headline sets itself letter by letter, one band of light crosses the bench, and the first
//   shelf is stocked one piece at a time. The bench drifts a little slower than the page.
//   Scroll moment: the shelf filling. Each later shelf is stocked as it comes up the screen, the pieces set down onto
//   the ledge in order, and lifted off again when scrolling back.
//   Pop: the price on the ticket of the piece under the pointer (or keyboard focus) lights in the member's colour. The
//   first shelf's front edge is lit like a strip light in the member's neon partner, the page's one neon line.
// Then the maker's story as a pulled line on a dark band, shipping and returns as three plain columns with a link to
// the policies page, kind words, the member's own questions printed as a list, and a footer that is the shop's last
// shelf (the name over a ledge rail, shelf tickets for buying, shipping and writing). Without a buy link every Buy
// becomes "Ask to order" and the page ends in an order slip. Its motion is the `choreo` block at the bottom
// (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, esc } = require('../shared');
const { policiesLabel } = require('../../privacy');
const art = require('../../art');

const id = 'market';
const MAX = 8;

// Daylight (its own mode): unbleached paper and a dark ledge. After hours (the other): the shop with the lights down, a
// warm near-black floor, the ledges a step lighter than it and lit along their front edge.
function tokens(p, mode) {
  if (mode === 'dark') {
    const bg = color.mix(color.mix(p.ink, '#100f0e', 0.86), p.primary, 0.03);
    return { bg, dark: color.mix(bg, '#000000', 0.45) };
  }
  return { bg: color.mix(p.paper, '#f1f1ef', 0.9), dark: color.mix(p.ink, '#000000', 0.5) };
}

const products = (c) => c.services.filter((s) => s.name).slice(0, MAX);

// The drawn products (T.art): each product as a studio comp would sketch it for the shelf, in line over the wall's
// light, standing on the ledge with its shadow thrown the way the sun falls. What it is comes from the member's own
// words: candles in glass jars (sized by their ounces, three small ones for a trio, a pouch for a refill), bottles
// for serums and oils, mugs and bowls for ceramics, a framed print for prints, a folded tee for clothes, else a box
// with a paper band. No text in the art (an <img> SVG can't load fonts): each label is blank paper, and the page sets
// the product's real name and size on it in HTML (labelRect gives both the same box).
const f1 = (n) => n.toFixed(1);

// The size printed on a label, only when the member wrote one (8 oz, 30 ml, 250 g).
const sizeOf = (t) => ((String(t).match(/\b(\d+(?:\.\d+)?\s*(?:fl\.? oz|oz|ml|g|lb))\b/i) || [])[1] || '');

// Where a shelf piece's label sits, as fractions of its 1000 x 1250 picture (the drawing and the HTML share it).
// Pieces without a label (mugs, bowls, prints, tees, the trio of small jars) get none.
function labelRect(kind, t, index) {
  const w = 1000, h = 1250, ground = h * 0.955, base = w * 0.98, cx = w * 0.5, sw = Math.max(2, w * 0.0045), v = index % 3;
  let b = null;
  if (kind === 'jar') {
    const oz = +((t.match(/(\d+(?:\.\d+)?)\s*oz/) || [])[1] || 8), k = Math.max(0.75, Math.min(1.25, Math.sqrt(oz / 8)));
    const jw = base * 0.5 * k, jh = base * 0.6 * k * (1 + (oz > 10 ? 0.12 : 0)), x = cx - jw / 2, y = ground - jh;
    b = v === 1 ? [x + sw, y + jh * 0.38, jw - sw * 2, jh * 0.3] : v === 2 ? [x + jw * 0.26, y + jh * 0.3, jw * 0.48, jh * 0.5] : [x + jw * 0.12, y + jh * 0.42, jw * 0.76, jh * 0.34];
  } else if (kind === 'bottle') {
    const bw = base * 0.34, bh = base * 0.86, sh = bh * 0.62, x = cx - bw / 2;
    b = [x + bw * 0.1, ground - sh * 0.82, bw * 0.8, sh * 0.42];
  } else if (kind === 'pouch') {
    const pw = base * 0.4, ph = base * 0.52, x = cx - base * 0.08 - pw / 2, y = ground - ph;
    b = [x + pw * 0.16, y + ph * 0.32, pw * 0.68, ph * 0.34];
  } else if (kind === 'box') {
    const bw = base * 0.52, bh = base * 0.42, x = cx - bw / 2, y = ground - bh;
    b = [x + bw * 0.25, y + bh * 0.48, bw * 0.5, bh * 0.3];
  }
  return b && { x: b[0] / w, y: b[1] / h, w: b[2] / w, h: b[3] / h };
}
const itemText = (it, c) => `${it ? `${it.name} ${it.description || ''} ${it.blurb || ''} ${it.duration || ''} ${it.category || ''}` : ''} ${c.what || ''}`.toLowerCase();

function kindOf(t) {
  if (/\b(trio|set of|three|3 x|sampler)\b/.test(t) && /\b(candles?|oz|wax|soy)\b/.test(t)) return 'trio';
  if (/\brefill|wick|wax melt/.test(t)) return 'pouch';
  if (/\b(candles?|soy|wax|beeswax)\b/.test(t)) return 'jar';
  if (/\b(serum|oil|tincture|perfume|fragrance|toner|bottle|hot sauce|sauce|syrup|bitters)\b/.test(t)) return 'bottle';
  if (/\b(bowl|plate|dish)\b/.test(t)) return 'bowl';
  if (/\b(mug|cup|tumbler|vase|ceramics?|pottery|stoneware)\b/.test(t)) return 'mug';
  if (/\b(print|poster|art|illustration|card|stationery|photo)\b/.test(t)) return 'print';
  if (/\b(tee|t-?shirt|shirt|hoodie|sweater|apparel|clothing|clothes|merch|crewneck)\b/.test(t)) return 'tee';
  if (/\b(jar|honey|jam|balm|salve|cream|butter|spice|tea|coffee)\b/.test(t)) return 'jar';
  return 'box';
}

function marketArt(s, { p, c, seed, index, art }) {
  if (!/^p\d+$|^maker$/.test(s.slot)) return null;
  const ph = art.photo('market', s.slot);
  if (ph) return ph;
  const { w, h } = s;
  const bg = art.wall({ style: 'object', w, h, p, seed, index, quiet: true });
  const r = art.rng(`${seed}:mk:${s.slot}`);
  const ink = color.mix(p.ink, bg.shade, 0.15);
  const glassClear = color.mix(bg.lit, '#ffffff', 0.4);
  const label = color.mix(p.paper, '#ffffff', 0.7);
  const tint = color.mix(p.primary, p.paper, 0.35);
  const sw = Math.max(2, Math.min(w, h) * 0.0045);
  const L = `fill="none" stroke="${ink}" stroke-width="${f1(sw)}" stroke-linejoin="round" stroke-linecap="round"`;
  const ground = h * 0.955;
  const shear = r() > 0.5 ? 1 : -1;
  // The shadow: the object's footprint thrown along the floor and up the wall, soft.
  const shadow = (x, bw, oh) => `<path d="M${f1(x)} ${f1(ground)}h${f1(bw)}l${f1(shear * oh * 0.55)} ${f1(-oh * 0.62)}h${f1(-bw * 0.9)}Z" fill="${bg.shade}" opacity=".26" filter="url(#mks)"/>`;
  // A label: blank paper with a hairline edge (the page prints the real words on it).
  const tag = (x, y, lw, lh) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(lw)}" height="${f1(lh)}" fill="${label}" stroke="${ink}" stroke-width="${f1(sw * 0.6)}"/>`;
  // A candle in a glass tumbler: glass, wax to a line below the rim, a wick, the label.
  // Three glasses (clear, amber, smoke) and three labels (square, band, tall), picked per product so a row varies.
  const v = s.slot === 'maker' ? (index + (r() > 0.7 ? 1 : 0)) % 3 : index % 3;
  const jar = (cx, jw, jh, vv = v) => {
    const x = cx - jw / 2, y = ground - jh, rad = jw * 0.07, lvl = y + jh * 0.2, el = jw * 0.07;
    const glass = [glassClear, color.mix(color.mix(p.primary, p.ink, 0.3), p.paper, 0.45), color.mix(p.ink, p.paper, 0.55)][vv];
    const wax = color.mix(p.paper, tint, 0.12 + ((index * 7) % 5) * 0.06);
    const lab = vv === 1 ? tag(x + sw, y + jh * 0.38, jw - sw * 2, jh * 0.3) : vv === 2 ? tag(x + jw * 0.26, y + jh * 0.3, jw * 0.48, jh * 0.5) : tag(x + jw * 0.12, y + jh * 0.42, jw * 0.76, jh * 0.34);
    return shadow(x, jw, jh) +
      `<path d="M${f1(x)} ${f1(y)}V${f1(ground - rad)}q0 ${f1(rad)} ${f1(rad)} ${f1(rad)}H${f1(x + jw - rad)}q${f1(rad)} 0 ${f1(rad)} ${f1(-rad)}V${f1(y)}" fill="${glass}" fill-opacity="${vv ? 0.8 : 0.55}"/>` +
      `<path d="M${f1(x + sw * 2)} ${f1(lvl)}V${f1(ground - rad - sw)}H${f1(x + jw - sw * 2)}V${f1(lvl)}Z" fill="${wax}"/>` +
      `<path d="M${f1(x + sw * 2)} ${f1(lvl)}q${f1(jw / 2 - sw * 2)} ${f1(el)} ${f1(jw - sw * 4)} 0q${f1(-(jw / 2 - sw * 2))} ${f1(-el)} ${f1(-(jw - sw * 4))} 0Z" fill="${color.mix(wax, '#ffffff', 0.35)}" stroke="${ink}" stroke-width="${f1(sw * 0.5)}"/>` +
      `<path d="M${f1(cx)} ${f1(lvl)}q${f1(jw * 0.03)} ${f1(-jh * 0.06)} ${f1(jw * 0.01)} ${f1(-jh * 0.1)}" ${L}/>` +
      lab +
      `<path d="M${f1(x + jw * 0.1)} ${f1(y + jh * 0.08)}V${f1(ground - jh * 0.08)}" stroke="#ffffff" stroke-opacity=".55" stroke-width="${f1(jw * 0.035)}" stroke-linecap="round"/>` +
      `<path d="M${f1(x)} ${f1(y)}V${f1(ground - rad)}q0 ${f1(rad)} ${f1(rad)} ${f1(rad)}H${f1(x + jw - rad)}q${f1(rad)} 0 ${f1(rad)} ${f1(-rad)}V${f1(y)}" ${L}/>` +
      `<path d="M${f1(x - sw)} ${f1(y)}q${f1(jw / 2 + sw)} ${f1(el * 0.9)} ${f1(jw + sw * 2)} 0q${f1(-(jw / 2 + sw))} ${f1(-el * 0.9)} ${f1(-(jw + sw * 2))} 0Z" ${L}/>`;
  };
  const bottle = (cx, bw, bh) => {
    const x = cx - bw / 2, y = ground - bh, sh = bh * 0.62, nw = bw * 0.34, ny = ground - sh - bw * 0.18;
    return shadow(x, bw, bh) +
      `<path d="M${f1(x)} ${f1(ground)}V${f1(ground - sh)}q0 ${f1(-bw * 0.18)} ${f1(bw / 2 - nw / 2)} ${f1(-bw * 0.18)}V${f1(y + bh * 0.2)}h${f1(nw)}V${f1(ny)}q${f1(bw / 2 - nw / 2)} 0 ${f1(bw / 2 - nw / 2)} ${f1(bw * 0.18)}V${f1(ground)}Z" fill="${color.mix(tint, bg.shade, 0.35)}" fill-opacity=".8" ${L.replace('fill="none" ', '')}/>` +
      `<rect x="${f1(cx - nw * 0.7)}" y="${f1(y + bh * 0.08)}" width="${f1(nw * 1.4)}" height="${f1(bh * 0.13)}" fill="${ink}"/>` +
      `<path d="M${f1(cx - nw * 0.38)} ${f1(y + bh * 0.08)}V${f1(y)}h${f1(nw * 0.76)}V${f1(y + bh * 0.08)}" fill="${ink}"/>` +
      tag(x + bw * 0.1, ground - sh * 0.82, bw * 0.8, sh * 0.42) +
      `<path d="M${f1(x + bw * 0.12)} ${f1(ground - sh * 0.95)}V${f1(ground - bh * 0.06)}" stroke="#ffffff" stroke-opacity=".4" stroke-width="${f1(bw * 0.05)}" stroke-linecap="round"/>`;
  };
  const mug = (cx, mw, mh) => {
    const x = cx - mw / 2, y = ground - mh, t = mw * 0.04;
    const glaze = color.mix(tint, p.paper, 0.25);
    return shadow(x, mw * 1.2, mh) +
      `<path d="M${f1(x + mw)} ${f1(y + mh * 0.22)}c${f1(mw * 0.36)} 0 ${f1(mw * 0.36)} ${f1(mh * 0.5)} 0 ${f1(mh * 0.52)}" fill="none" stroke="${ink}" stroke-width="${f1(sw * 3)}" stroke-linecap="round"/>` +
      `<path d="M${f1(x)} ${f1(y)}L${f1(x + t)} ${f1(ground)}H${f1(x + mw - t)}L${f1(x + mw)} ${f1(y)}Z" fill="${glaze}" ${L.replace('fill="none" ', '')}/>` +
      `<path d="M${f1(x + t * 0.6)} ${f1(ground - mh * 0.24)}L${f1(x + t)} ${f1(ground)}H${f1(x + mw - t)}L${f1(x + mw - t * 0.6)} ${f1(ground - mh * 0.24)}Z" fill="${color.mix(glaze, bg.shade, 0.6)}"/>` +
      `<path d="M${f1(x)} ${f1(y)}q${f1(mw / 2)} ${f1(mw * 0.08)} ${f1(mw)} 0q${f1(-mw / 2)} ${f1(-mw * 0.08)} ${f1(-mw)} 0Z" fill="${color.mix(glaze, bg.shade, 0.3)}" ${L.replace('fill="none" ', '')}/>`;
  };
  const bowl = (cx, bw, bh) => {
    const x = cx - bw / 2, y = ground - bh;
    const glaze = color.mix(tint, p.paper, 0.25);
    return shadow(x, bw, bh) +
      `<path d="M${f1(x)} ${f1(y)}C${f1(x)} ${f1(y + bh * 0.9)} ${f1(x + bw * 0.25)} ${f1(ground)} ${f1(x + bw * 0.38)} ${f1(ground)}H${f1(x + bw * 0.62)}C${f1(x + bw * 0.75)} ${f1(ground)} ${f1(x + bw)} ${f1(y + bh * 0.9)} ${f1(x + bw)} ${f1(y)}Z" fill="${glaze}" ${L.replace('fill="none" ', '')}/>` +
      `<path d="M${f1(x)} ${f1(y)}q${f1(bw / 2)} ${f1(bw * 0.1)} ${f1(bw)} 0q${f1(-bw / 2)} ${f1(-bw * 0.1)} ${f1(-bw)} 0Z" fill="${color.mix(glaze, bg.shade, 0.35)}" ${L.replace('fill="none" ', '')}/>`;
  };
  const print = (cx, fw, fh) => {
    const x = cx - fw / 2, y = ground - fh, lean = fw * 0.06, m = fw * 0.12;
    const sky = color.mix(p.paper, tint, 0.25), hill = color.mix(tint, p.ink, 0.25);
    return shadow(x, fw, fh) +
      `<g transform="skewX(${f1(-lean / fh * 57)}) translate(${f1(lean * (ground / fh))} 0)"><rect x="${f1(x)}" y="${f1(y)}" width="${f1(fw)}" height="${f1(fh)}" fill="${ink}"/>` +
      `<rect x="${f1(x + sw * 4)}" y="${f1(y + sw * 4)}" width="${f1(fw - sw * 8)}" height="${f1(fh - sw * 8)}" fill="${label}"/>` +
      `<rect x="${f1(x + m)}" y="${f1(y + m)}" width="${f1(fw - m * 2)}" height="${f1(fh * 0.62)}" fill="${sky}"/>` +
      `<path d="M${f1(x + m)} ${f1(y + m + fh * 0.62)}V${f1(y + m + fh * 0.4)}L${f1(x + fw * 0.4)} ${f1(y + m + fh * 0.22)}L${f1(x + fw * 0.6)} ${f1(y + m + fh * 0.36)}L${f1(x + fw * 0.75)} ${f1(y + m + fh * 0.28)}L${f1(x + fw - m)} ${f1(y + m + fh * 0.42)}V${f1(y + m + fh * 0.62)}Z" fill="${hill}"/></g>`;
  };
  const tee = (cx, tw, th) => {
    const x = cx - tw / 2, y = ground - th, cloth = color.mix(tint, p.paper, 0.2);
    return shadow(x, tw, th) +
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(tw)}" height="${f1(th)}" rx="${f1(tw * 0.04)}" fill="${cloth}" ${L.replace('fill="none" ', '')}/>` +
      `<path d="M${f1(x + tw * 0.32)} ${f1(y)}q${f1(tw * 0.18)} ${f1(th * 0.3)} ${f1(tw * 0.36)} 0" ${L}/>` +
      `<path d="M${f1(x + tw * 0.2)} ${f1(y)}V${f1(ground)}M${f1(x + tw * 0.8)} ${f1(y)}V${f1(ground)}" ${L} opacity=".45"/>` +
      `<path d="M${f1(x)} ${f1(y + th * 0.55)}h${f1(tw)}" ${L} opacity=".3"/>`;
  };
  const pouch = (cx, pw, ph) => {
    const x = cx - pw / 2, y = ground - ph, kraft = color.mix(color.mix(p.primary, bg.shade, 0.4), p.paper, 0.45);
    let zig = `M${f1(x)} ${f1(y)}`;
    for (let i = 1; i <= 12; i++) zig += `L${f1(x + (pw * i) / 12)} ${f1(y + (i % 2 ? -pw * 0.025 : 0))}`;
    return shadow(x, pw, ph) +
      `<path d="${zig}L${f1(x + pw * 1.02)} ${f1(ground)}H${f1(x - pw * 0.02)}Z" fill="${kraft}" ${L.replace('fill="none" ', '')}/>` +
      `<path d="M${f1(x)} ${f1(y + ph * 0.1)}h${f1(pw)}" ${L} opacity=".5"/>` + tag(x + pw * 0.16, y + ph * 0.32, pw * 0.68, ph * 0.34) +
      `<path d="M${f1(x + pw * 1.08)} ${f1(ground - sw)}l${f1(pw * 0.42)} ${f1(-ph * 0.08)}" ${L}/><rect x="${f1(x + pw * 1.04)}" y="${f1(ground - sw * 5)}" width="${f1(pw * 0.08)}" height="${f1(sw * 5)}" fill="${ink}"/>`;
  };
  const box = (cx, bw, bh) => {
    const x = cx - bw / 2, y = ground - bh, card = color.mix(p.paper, tint, 0.3);
    return shadow(x, bw, bh) +
      `<rect x="${f1(x)}" y="${f1(y + bh * 0.22)}" width="${f1(bw)}" height="${f1(bh * 0.78)}" fill="${card}" ${L.replace('fill="none" ', '')}/>` +
      `<rect x="${f1(x - bw * 0.03)}" y="${f1(y)}" width="${f1(bw * 1.06)}" height="${f1(bh * 0.26)}" fill="${color.mix(card, bg.shade, 0.15)}" ${L.replace('fill="none" ', '')}/>` +
      `<rect x="${f1(cx - bw * 0.09)}" y="${f1(y)}" width="${f1(bw * 0.18)}" height="${f1(bh)}" fill="${tint}" opacity=".85"/>` +
      tag(x + bw * 0.25, y + bh * 0.48, bw * 0.5, bh * 0.3);
  };
  const DRAW = { jar, bottle, mug, bowl, print, tee, pouch, box, trio: null };
  // One product, sized by what the member wrote (ounces, a set of three).
  const one = (kind, cx, scale, text) => {
    const oz = +((text.match(/(\d+(?:\.\d+)?)\s*oz/) || [])[1] || 8);
    const base = w * scale;
    if (kind === 'trio') return [-0.3, 0.3, 0].map((d, i) => jar(cx + d * base, base * 0.29, base * (0.4 + (i === 2 ? 0.03 : 0)), i)).join('');
    if (kind === 'jar') { const k = Math.max(0.75, Math.min(1.25, Math.sqrt(oz / 8))); return jar(cx, base * 0.5 * k, base * 0.6 * k * (1 + (oz > 10 ? 0.12 : 0))); }
    if (kind === 'bottle') return bottle(cx, base * 0.34, base * 0.86);
    if (kind === 'mug') return mug(cx - base * 0.06, base * 0.46, base * 0.52);
    if (kind === 'bowl') return bowl(cx, base * 0.78, base * 0.32);
    if (kind === 'print') return print(cx, base * 0.6, base * 0.78);
    if (kind === 'tee') return tee(cx, base * 0.66, base * 0.3);
    if (kind === 'pouch') return pouch(cx - base * 0.08, base * 0.4, base * 0.52);
    return DRAW.box(cx, base * 0.52, base * 0.42);
  };
  const list = c.services.filter((x) => x.name);
  const defs = `${bg.defs}<filter id="mks" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="${f1(Math.min(w, h) * 0.014)}"/></filter>`;
  const floor = `<rect y="${f1(ground)}" width="${w}" height="${f1(h - ground)}" fill="${bg.shade}" opacity=".35"/>`;
  let body;
  if (s.slot === 'maker') {
    // The maker's table: a few of the products in a row, the way they come off the bench.
    const picks = list.slice(0, 4);
    const n = Math.max(3, picks.length);
    body = Array.from({ length: n }, (_, i) => {
      const it = picks[i % Math.max(1, picks.length)];
      const t = `${it ? `${it.name} ${it.description || ''} ${it.blurb || ''} ${it.category || ''}` : ''} ${c.what || ''}`.toLowerCase();
      return one(kindOf(t), w * (0.17 + (i * 0.66) / (n - 1)), 0.3 + r() * 0.05, t);
    }).join('');
  } else {
    const it = list[+s.slot.slice(1) - 1];
    const t = itemText(it, c);
    body = one(kindOf(t), w * 0.5, 0.98, t);
  }
  return art.svgDoc(w, h, defs, bg.body + floor + body);
}

function slots(c) {
  const list = products(c);
  return [
    ...list.map((s, i) => ({ slot: `p${i + 1}`, file: `product-${i + 1}.jpg`, w: 1000, h: 1250, style: 'object', alt: [s.name, s.description || s.blurb].filter(Boolean).join(', ') })),
    { slot: 'maker', file: 'maker.jpg', w: 1600, h: 1000, style: 'sweep', alt: list.length ? `${list.slice(0, 4).map((s) => s.name).join(', ')} on the bench` : `${c.owner || c.name} at work` },
  ];
}

// The words for the business it's given (the free builder can put this shop on any business): a maker who sells
// goods shops and orders; a cafe or restaurant orders from its menu; anyone else (a class, a barber) books, through
// its booking link when it has one. Labels come from the niche, never from the shop's own trade.
function words(c) {
  const t = (c.profile && c.profile.template) || 'product';
  const goods = t === 'product';
  const food = t === 'restaurant';
  const noun = (c.profile && c.profile.noun) || '';
  const plural = noun ? (/(s|sh|ch|x)$/.test(noun) ? `${noun}es` : `${noun}s`) : '';
  const book = !c.buy && c.booking ? { label: c.booking.label, short: c.booking.kind === 'reserve' ? 'Reserve' : 'Book', href: c.booking.href, kind: c.booking.kind } : null;
  const orders = goods || food;
  return {
    goods,
    book,
    nav: goods ? 'Shop' : food ? 'Menu' : plural ? plural.charAt(0).toUpperCase() + plural.slice(1) : 'Services',
    see: goods ? 'Shop the shelves' : food ? 'See the menu' : plural ? `See the ${plural}` : 'See what we offer',
    ask: orders ? 'Ask to order' : 'Ask to book',
    short: orders ? 'Order' : 'Book',
    each: goods ? 'Buy' : 'Book',
    all: goods ? 'The collection' : food ? 'The menu' : 'What we offer',
    shelves: goods ? 'The shelves' : food ? 'The menu' : plural ? `The ${plural}` : 'What we offer',
    made: (c) => (goods ? `How ${c.name} is made` : `About ${c.name}`),
    lead: goods ? "Tell us what you'd like and where it's going, and we'll reply with the total and how to pay." : food ? "Tell us what you'd like and when you'll come for it, and we'll reply to confirm." : "Tell us what you'd like and the day that suits you, and we'll reply to confirm.",
    field: orders ? 'What you would like' : 'What you would like, and when',
    submit: orders ? 'Send my order request' : 'Send my request',
  };
}

function nav(c) {
  return [
    products(c).length ? { label: words(c).nav, href: '#shop' } : null,
    { label: 'Story', href: '#story' },
    (c.shipping || c.returns) && { label: 'Shipping', href: '#shipping' },
  ].filter(Boolean);
}

// The shelves: the member's groups, each its own ledge (four to a ledge at most); with no groups, threes.
function shelves(list) {
  const groups = [...new Set(list.map((s) => s.category).filter(Boolean))];
  const out = [];
  const chunk = (items, label) => {
    const size = items.length <= 4 ? items.length : 3;
    for (let i = 0; i < items.length; i += size) out.push({ label: i === 0 ? label : '', items: items.slice(i, i + size) });
  };
  if (groups.length > 1) groups.forEach((g) => chunk(list.filter((s) => s.category === g), g));
  else chunk(list, '');
  return out;
}

function render(c0) {
  const list = products(c0);
  const w = words(c0);
  const order = { label: w.ask, short: w.short, href: '#order', kind: 'form' };
  // A launch's words ("Launching Nov 15.") only fit a maker's goods.
  const heroSub = !w.goods && !c0.buy && c0.deadline ? String(c0.heroSub || '').replace(` Launching ${c0.deadline}.`, '').replace(`Launching ${c0.deadline}.`, '').trim() : c0.heroSub;
  const c = c0.buy ? c0 : { ...c0, heroSub, primary: w.book || order };
  const title = c.tagline ? c.tagline.replace(/[.!]+$/, '') : c.heroTitle;
  // The subline is whatever the hero words add to the headline, minus the shipping line (it sits in the label row).
  const shipFirst = c.shipping ? c.shipping.split(/(?<=\.)\s/)[0].replace(/[.]+$/, '') : '';
  let sub = c.tagline && c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.tagline ? c.heroSub : '';
  if (shipFirst && sub.includes(shipFirst)) sub = '';
  // The headline is sized from its length, so its line count is settled before the font arrives.
  const k = Math.min(11, 480 / Math.max(title.length, 12)).toFixed(2);
  const km = Math.min(17, 720 / Math.max(title.length, 12)).toFixed(2);
  const low = cheapest(c);
  const detail = (s) => [s.duration, s.blurb].filter(Boolean).join(', ');
  const rows = shelves(list);
  const grouped = rows.some((r) => r.label);
  const hN = grouped ? 'h4' : 'h3';
  let n = 0;
  const out = c.buy || w.book;
  const buy = (s) => (out
    ? `<a class="mk-buy" href="${esc(out.href)}"${/^https?:/.test(out.href) ? ' rel="noopener"' : ''}>${w.each}<span class="sr-only"> ${esc(s.name)}</span>${icon('arrowUpRight', { size: 16 })}</a>`
    : `<a class="mk-buy" href="#order">${w.ask}<span class="sr-only"> ${esc(s.name)}</span></a>`);

  // The label on each drawn piece: its name and, when the member gave one, its size, set on the blank paper in the
  // drawing. (A member who swaps in a photo deletes the mk-lab span with it; the README's photo step says so.)
  const lab = (s, i) => {
    if (art.photo('market', `p${i + 1}`)) return '';
    const t = itemText(s, c), b = labelRect(kindOf(t), t, i);
    if (!b) return '';
    const size = sizeOf(t);
    return `<span class="mk-lab" aria-hidden="true" style="left:${(b.x * 100).toFixed(2)}%;top:${(b.y * 100).toFixed(2)}%;width:${(b.w * 100).toFixed(2)}%;height:${(b.h * 100).toFixed(2)}%;--lw:${(b.w * 100).toFixed(1)}"><b>${esc(s.name)}</b>${size ? `<small>${esc(size)}</small>` : ''}</span>`;
  };

  const hero = `<section class="mk-hero" aria-labelledby="hero-title">
<div class="wrap">
<h1 id="hero-title" class="mk-title" data-ci="head" style="--k:${k}vw;--km:${km}vw">${esc(title)}</h1>
<div class="mk-row${sub ? '' : ' nosub'}" data-ci="then" data-ci-from="mask">
${sub ? `<p class="mk-sub">${esc(sub)}</p>` : ''}
<div class="mk-ctas">${P.button({ label: list.length ? w.see : c.primary.label, href: list.length ? '#shop' : c.primary.href, kind: 'anchor' }, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}</div>
${shipFirst ? `<p class="mk-ship">${esc(shipFirst)}</p>` : ''}
</div>
</div>
<figure class="mk-bench"><div class="mk-bench-p" data-par="0.06">${P.img(c, 'maker', { cls: 'mk-bench-img', eager: true, sizes: '100vw' })}</div></figure>
</section>`;

  const shop = list.length
    ? `<section class="mk-shop" id="shop" aria-labelledby="shop-title"${rows.length > 1 ? ' data-sc' : ''}>
<div class="wrap">
<h2 class="sr-only" id="shop-title">${w.all}</h2>
${rows
  .map((row, ri) => `<div class="mk-shelf" style="--n:${row.items.length}"${ri === 0 ? ' data-ci="subject"' : ''}>
<div class="mk-rail">${row.label ? `<h3 class="mk-group">${esc(row.label)}</h3><span class="mk-gn">${row.items.length}</span>` : ''}</div>
<ul class="mk-items">${row.items
    .map((s, j) => {
      const i = n++;
      return `<li class="mk-item" style="grid-column:${j + 1};--i:${j}"${ri > 0 ? ' data-sc-part' : ''}>
<div class="mk-stand"><div class="mk-ph"><div class="mk-pw" data-alive="${[0.5, 0.7, 0.6, 0.8][j % 4]}">${P.img(c, `p${i + 1}`, { cls: 'mk-img', eager: ri === 0, sizes: '(min-width: 56rem) 30vw, 62vw' })}${lab(s, i)}</div></div></div>
<div class="mk-tag"><${hN} class="mk-nm">${esc(s.name)}</${hN}>${s.priceText ? `<p class="mk-pr">${esc(s.priceText)}</p>` : ''}${detail(s) ? `<p class="mk-dt">${esc(detail(s))}</p>` : ''}${buy(s)}</div>
</li>`;
    })
    .join('\n')}</ul>
</div>`)
  .join('\n')}
</div>
</section>`
    : '';

  // The story: the maker's own first sentence pulled out large, the rest set under it, beside the bench.
  const paras = c.aboutParas.slice();
  const first = paras.length ? paras[0].split(/(?<=[.!?])\s+/) : [];
  const pull = first.length > 1 && first[0].length < 150 ? first.shift() : '';
  if (pull) paras[0] = first.join(' ');
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const story = `<section class="mk-sec mk-story" id="story" aria-labelledby="story-title">
<div class="wrap mk-story-grid">
<div class="mk-story-head">
${pull ? `<h2 class="mk-pull" id="story-title" data-split>${esc(pull)}</h2>${person ? `<p class="mk-by" data-rv>${esc(person)}, ${esc(c.name)}</p>` : ''}` : `<h2 class="mk-pull" id="story-title" data-split>${esc(list.length ? w.made(c) : `About ${c.name}`)}</h2>`}
</div>
<div class="mk-story-copy">
${paras.filter(Boolean).map((p, i) => `<p class="mk-say" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'mk-soc' })}
</div>
</div>
</section>`;

  const policyLink = c.buy ? `<a href="policies.html">Full ${policiesLabel(c).toLowerCase()} policy</a>` : '';
  const pol = [
    c.shipping && { h: 'Shipping', p: esc(c.shipping) },
    c.returns && { h: 'Returns', p: esc(c.returns) },
    c.email && { h: 'Questions', p: `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` },
  ].filter(Boolean);
  const shipping = c.shipping || c.returns
    ? `<section class="mk-sec mk-pol" id="shipping" aria-labelledby="shipping-title">
<div class="wrap">
<h2 class="mk-h2" id="shipping-title" data-split>Shipping and returns</h2>
<dl class="mk-pol-grid">${pol.map((x, i) => `<div data-rv style="--d:${i}"><dt>${x.h}</dt><dd>${x.p}</dd></div>`).join('')}</dl>
${policyLink ? `<p class="mk-pol-more" data-rv>${policyLink}</p>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="mk-sec mk-kind" aria-labelledby="reviews-title"><div class="wrap"><h2 class="mk-h2" id="reviews-title" data-split>Kind words</h2><div class="mk-quotes">${c.reviews.map((r, i) => `<figure class="mk-q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';

  // The member's own questions, printed as a list; any already answered by the shipping block are left out.
  const qs = c.faq.filter((q) => !(c.shipping || c.returns) || !/\b(ship|shipping|deliver|send it back|return|refund)/i.test(q.q));
  const faq = qs.length >= 2
    ? `<section class="mk-sec mk-faq" id="faq" aria-labelledby="faq-title"><div class="wrap mk-faq-grid"><h2 class="mk-h2" id="faq-title" data-split>Questions</h2><dl class="mk-qa">${qs.map((q, i) => `<div data-rv style="--d:${i % 3}"><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const orderSec = out
    ? ''
    : `<section class="mk-sec mk-order" id="order" aria-labelledby="order-title"><div class="wrap mk-order-grid"><div><h2 class="mk-h2" id="order-title" data-split>${w.ask}.</h2><p class="mk-sub" data-rv style="--d:2">${esc(w.lead)}</p></div><div class="mk-slip" data-rv style="--d:3">${P.form(c, { id: 'order', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: w.field }], submit: w.submit, subject: `${w.goods ? 'Order request' : 'Request'} for ${c.name}` })}</div></div></section>`;

  const bar = `<nav class="mbar mk-bar" aria-label="${w.goods ? 'Shop ' : ''}${esc(c.name)}"><div class="mk-bar-t"><strong>${esc(c.name)}</strong>${low ? `<span>From ${esc(low.priceText.replace(/^From /, ''))}</span>` : ''}</div>${P.button(list.length ? { label: w.see, href: '#shop', kind: 'anchor' } : c.primary, 'btn btn-primary')}</nav>`;

  // The footer is the last shelf in the shop: the name over a ledge rail, and shelf tickets for how to buy, what ships
  // when, and how to reach the maker. Only what the facts give.
  const tix = [
    list.length ? [w.nav, `<a href="${out ? esc(out.href) : '#shop'}"${out && /^https?:/.test(out.href) ? ' rel="noopener"' : ''}>${c.buy ? (w.goods ? 'Buy online' : esc(c.primary.label)) : w.book ? esc(w.book.label) : w.shelves}</a>`] : null,
    shipFirst ? ['Ships', esc(shipFirst)] : null,
    c.email ? ['Write', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`] : null,
    c.phone ? ['Call', `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`] : null,
    c.address ? ['Find us', esc(c.address)] : null,
  ].filter(Boolean);
  const footer = `<footer class="mk-ftr"><div class="wrap">
<p class="mk-ftr-name">${esc(c.name)}</p>
<div class="mk-rail mk-ftr-rail"><span class="mk-group">${esc(c.what || 'The shop')}</span>${!c.online && c.city ? `<span class="mk-gn">${esc(c.city)}</span>` : ''}</div>
${tix.length ? `<dl class="mk-ftr-tix">${tix.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
<div class="mk-ftr-base"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${P.socials(c, { cls: 'mk-ftr-soc', size: 18 })}</div>
</div></footer>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'mk-hdr', ctaCls: 'btn btn-primary btn-sm', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, shop, story, shipping, reviews, faq, orderSec, '</main>', footer, bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '84rem' } };
}

// Fallback faces sized to the real ones, so a late font swaps in without moving a line.
const CSS = `
@font-face{font-family:'Market Display Fallback';font-weight:600;font-stretch:75% 78%;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:67.8%;ascent-override:137.2%;descent-override:39.8%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:700 800;font-stretch:75% 78%;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:70.0%;ascent-override:132.9%;descent-override:38.6%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:400 500;font-stretch:75% 78%;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:70.0%;ascent-override:132.9%;descent-override:38.6%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:700 800;font-stretch:79% 90%;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:82.0%;ascent-override:113.4%;descent-override:32.9%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:600;font-stretch:79% 90%;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:75.0%;ascent-override:124.0%;descent-override:36.0%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:400 500;font-stretch:79% 90%;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:78.0%;ascent-override:119.2%;descent-override:34.6%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:600 800;font-stretch:91% 100%;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:92.0%;ascent-override:101.1%;descent-override:29.3%;line-gap-override:0%}
@font-face{font-family:'Market Display Fallback';font-weight:400 500;font-stretch:91% 100%;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:95.0%;ascent-override:97.9%;descent-override:28.4%;line-gap-override:0%}
@font-face{font-family:'Market Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:99.7%;ascent-override:95.3%;descent-override:25.1%;line-gap-override:0%}
html:root{--font-display:"Bricolage Grotesque","Market Display Fallback",sans-serif;--font-body:"Figtree","Market Body Fallback",sans-serif;--ease:cubic-bezier(.16,1,.3,1)}
body{background:var(--bg);--ledge:color-mix(in srgb,var(--ink) 88%,var(--primary));--on-ledge:color-mix(in srgb,var(--bg) 82%,transparent);--edge:color-mix(in srgb,var(--ink) 14%,transparent)}
h1,h2,h3,h4{font-weight:600;letter-spacing:-.02em}
.btn{font-weight:600;box-shadow:none}
.btn:hover{transform:none}
.btn-sm{min-height:2.5rem;padding:.45rem 1.05rem;font-size:.9rem}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.3rem;font-weight:700;font-stretch:80%;letter-spacing:-.01em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.4rem 0;font-size:.95rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.menu>summary{border-radius:0;border-color:var(--ink)}
.menu-panel{border-top:.5rem solid var(--ledge);border-bottom:1px solid var(--ink);padding-bottom:1.75rem}
.menu-panel li a{padding:1rem 0;border-bottom-color:var(--edge);font-size:2.2rem;font-weight:700;font-stretch:76%;letter-spacing:-.02em}
.menu-panel .btn{border-radius:2px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.mk-h2{font-family:var(--font-display);font-size:clamp(2.4rem,1.5rem + 3.8vw,5rem);font-weight:600;font-stretch:78%;line-height:.95;letter-spacing:-.02em;text-wrap:balance}
.mk-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.mk-sub{max-width:30rem;font-size:clamp(1.08rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
/* hero: the headline, a label row, then straight onto the shelves */
.mk-hero{padding-top:clamp(2rem,1.5rem + 3vw,4.5rem)}
.mk-title{font-family:var(--font-display);font-size:clamp(2.6rem,var(--km),5.5rem);font-weight:600;font-stretch:76%;line-height:.9;letter-spacing:-.025em;text-wrap:balance}
@media (min-width:56rem){.mk-title{font-size:clamp(3.5rem,var(--k),10rem)}}
.mk-row{display:grid;gap:1rem;justify-items:start;margin-top:clamp(1.5rem,1rem + 1.5vw,2.5rem);padding-block:1rem;border-block:1px solid var(--ink)}
@media (min-width:56rem){.mk-row{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:center}.mk-row .mk-sub{grid-column:1/7}.mk-row .mk-ctas{grid-column:7/10;white-space:nowrap}.mk-row .mk-ship{grid-column:10/13;justify-self:end;text-align:right}.mk-row.nosub .mk-ctas{grid-column:1/5}.mk-row.nosub .mk-ship{grid-column:5/13}}
.mk-ship{font-size:.98rem;color:var(--muted)}
/* the bench: the shop's pieces lined up, as a photograph across the full width (a dark frame in both modes) */
.mk-bench{position:relative;margin:clamp(1.5rem,1rem + 2vw,3rem) 0 0;aspect-ratio:4/3;overflow:hidden;background:#0d0c0b}
@media (min-width:48rem){.mk-bench{aspect-ratio:auto;height:clamp(20rem,58svh,46rem)}}
.mk-bench-p{position:absolute;inset:-6% 0}
.mk-bench-img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 80%}
.mk-bench::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 40%,rgba(255,244,226,.18) 50%,transparent 60%);mix-blend-mode:soft-light;opacity:0}
html.m .mk-bench::after{animation:mkSweep 3.6s 1.4s cubic-bezier(.45,0,.2,1) both}
@keyframes mkSweep{from{transform:translateX(-70%);opacity:1}to{transform:translateX(70%);opacity:0}}
/* the shelves */
.mk-shop{padding-block:clamp(2.5rem,1.5rem + 4vw,5rem) clamp(4.5rem,3rem + 5vw,8rem)}
.mk-shelf{position:relative;display:grid;grid-template-rows:auto auto auto}
.mk-shelf+.mk-shelf{margin-top:clamp(3.5rem,2.5rem + 4vw,6.5rem)}
.mk-items{display:grid;grid-row:1/span 3;grid-column:1;grid-template-columns:repeat(var(--n),minmax(0,1fr));grid-template-rows:subgrid;column-gap:clamp(.8rem,.4rem + 1.4vw,2rem);max-width:calc(var(--n) * 24rem)}
.mk-rail{grid-row:2;grid-column:1;display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:2rem;padding:.3rem .9rem;background:var(--ledge);color:var(--on-ledge);z-index:1;max-width:calc(var(--n) * 24rem)}
.mk-group{font-family:var(--font-display);font-size:1.05rem;font-weight:700;font-stretch:80%;letter-spacing:.01em;line-height:1}
.mk-gn{font-size:.85rem;font-variant-numeric:tabular-nums}
.mk-item{display:grid;grid-row:1/span 3;grid-template-rows:subgrid;min-width:0}
.mk-stand{grid-row:1;align-self:end}
.mk-ph{overflow:hidden;aspect-ratio:4/5;background:var(--surface);container-type:inline-size}
.mk-pw{position:relative;height:100%}
.mk-lab{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25em;padding:0 .4em;overflow:hidden;text-align:center;color:#1b1916;font-size:calc(var(--lw) * .135cqi);line-height:1;pointer-events:none}
.mk-lab b{font-family:var(--font-display);font-weight:700;font-stretch:78%;text-transform:uppercase;letter-spacing:.02em;text-wrap:balance}
.mk-lab small{font-size:.72em;font-weight:500;letter-spacing:.06em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.mk-img{display:block;width:100%;height:100%;object-fit:cover}
.mk-tag{grid-row:3;display:grid;grid-template-columns:1fr auto;gap:.15rem 1rem;align-content:start;padding-top:.9rem}
.mk-nm{font-family:var(--font-display);font-size:clamp(1.2rem,1rem + .55vw,1.55rem);font-weight:600;font-stretch:80%;line-height:1.1;letter-spacing:-.01em}
.mk-pr{font-family:var(--font-display);font-size:clamp(1.2rem,1rem + .55vw,1.55rem);font-weight:500;font-stretch:80%;font-variant-numeric:tabular-nums;line-height:1.1;transition:color .25s ease}
.mk-dt{grid-column:1/-1;font-size:.92rem;color:var(--muted)}
.mk-buy{grid-column:1/-1;display:inline-flex;align-items:center;gap:.35rem;justify-self:start;min-height:2.75rem;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:.25em;text-decoration-thickness:1px}
.mk-buy:hover{text-decoration-thickness:2px}
.mk-item:hover .mk-pr,.mk-item:focus-within .mk-pr{color:var(--pop)}
@media (max-width:47.99rem){.mk-shelf{overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:1rem;margin-inline:-1rem;padding-inline:1rem;scrollbar-width:none}.mk-shelf::-webkit-scrollbar{display:none}.mk-items,.mk-rail{max-width:none;width:calc(var(--n) * 66vw)}.mk-shelf[style*="--n:1"] .mk-items,.mk-shelf[style*="--n:1"] .mk-rail{width:auto}.mk-item{scroll-snap-align:start}}
/* stocking the shelf: the first as the page opens, the rest as they come up the screen */
html.ci-go .mk-shelf[data-ci] .mk-ph{animation:mkSet .9s var(--ease) calc(.5s + var(--i) * .13s) both}
@keyframes mkSet{from{opacity:0;transform:translate3d(0,-2.4rem,0)}}
html.m .mk-shop[data-sc] .mk-item[data-sc-part]{transform:none}
html.m .mk-shop[data-sc] .mk-item[data-sc-part] .mk-ph{opacity:calc(.15 + var(--pi,1) * .85);transform:translate3d(0,calc((var(--pi,1) - 1) * 2.6rem),0)}
/* story */
.mk-story{background:var(--dark);color:var(--on-dark);--muted:var(--muted-on-dark);--pop:var(--primary-on-dark);--focus:var(--primary-on-dark)}
.mk-story-grid{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.mk-story-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.mk-story-head{grid-column:1/8}.mk-story-copy{grid-column:9/13;padding-top:.6rem}}
.mk-pull{font-family:var(--font-display);font-size:clamp(2.1rem,1.3rem + 3vw,4.4rem);font-weight:600;font-stretch:80%;line-height:1.02;letter-spacing:-.015em;text-wrap:balance}
.mk-by{margin-top:1rem;font-size:.95rem;color:var(--muted-on-dark)}
.mk-say{margin-top:1.1rem;max-width:34rem;font-size:1.08rem;line-height:1.65;color:var(--muted-on-dark)}
.mk-soc{margin-top:1.5rem}
.mk-story .socials a{border-radius:0;border-color:var(--line-on-dark);color:var(--on-dark)}
/* shipping and returns */
.mk-pol-grid{display:grid;gap:0 1.5rem;margin:clamp(2rem,1.5rem + 2vw,3rem) 0 0;border-top:1px solid var(--ink)}
@media (min-width:48rem){.mk-pol-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.mk-pol-grid>div{display:grid;gap:.5rem;align-content:start;padding:1.25rem 0 1.5rem;border-bottom:1px solid var(--edge)}
.mk-pol-grid dt,.mk-qa dt{font-family:var(--font-display);font-size:1.35rem;font-weight:600;font-stretch:80%}
.mk-pol-grid dd,.mk-qa dd{margin:0;max-width:26rem;color:var(--muted)}
.mk-pol-grid a,.mk-pol-more a{color:var(--ink);font-weight:600}
.mk-pol-more{margin-top:1.5rem}
.mk-pol,.mk-kind,.mk-faq{border-top:1px solid var(--edge)}
/* kind words */
.mk-quotes{display:grid;margin-top:clamp(2rem,1.5rem + 2vw,3rem);border-top:1px solid var(--ink)}
@media (min-width:56rem){.mk-quotes{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 1.5rem}}
.mk-q{display:grid;gap:.75rem;align-content:start;margin:0;padding:1.5rem 0 2rem;border-bottom:1px solid var(--edge)}
.mk-q blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.15rem + 1.4vw,2.3rem);font-weight:500;font-stretch:82%;line-height:1.12;letter-spacing:-.01em}
.mk-q figcaption{color:var(--muted)}
.mk-faq-grid,.mk-order-grid{display:grid;gap:2rem}
@media (min-width:60rem){.mk-faq-grid,.mk-order-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.mk-faq-grid>h2,.mk-order-grid>div:first-child{grid-column:1/6}.mk-faq-grid>dl,.mk-order-grid>div:last-child{grid-column:7/13}}
.mk-qa{display:grid;margin:0;border-top:1px solid var(--ink)}
.mk-qa>div{display:grid;gap:.4rem;padding:1.2rem 0 1.4rem;border-bottom:1px solid var(--edge)}
/* the order slip */
.mk-order{background:var(--surface)}
.mk-order .mk-sub{margin-top:1.1rem}
.mk-slip{padding:clamp(1.25rem,1rem + 1.5vw,2.25rem);background:var(--bg);border-top:.5rem solid var(--ledge)}
.field input,.field select,.field textarea{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 45%,transparent);border-radius:0;background-color:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1px 0 var(--ink)}
/* the footer: the bottom shelf */
.mk-ftr{padding-block:clamp(3.5rem,2.5rem + 4vw,6.5rem) calc(5.5rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ink)}
@media (min-width:60rem){.mk-ftr{padding-bottom:2.5rem}}
.mk-ftr-name{font-family:var(--font-display);font-size:clamp(2.6rem,1.6rem + 5vw,6.5rem);font-weight:700;font-stretch:76%;line-height:.9;letter-spacing:-.02em;padding-left:.9rem}
.mk-ftr-rail{max-width:none;margin-top:.5rem}
.mk-ftr-tix{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:0 1.5rem;margin:0}
.mk-ftr-tix>div{display:grid;gap:.2rem;align-content:start;padding:1rem .9rem 1.1rem;border-bottom:1px solid var(--line)}
.mk-ftr-tix dt{font-family:var(--font-display);font-size:1.15rem;font-weight:600;font-stretch:80%;line-height:1.1}
.mk-ftr-tix dd{margin:0;font-size:.95rem;color:var(--muted)}
.mk-ftr-tix a{display:inline-flex;align-items:center;min-height:2.5rem;color:var(--ink);text-underline-offset:.2em}
.mk-ftr-base{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.5rem;padding-inline:.9rem;font-size:.85rem;color:var(--muted)}
.mk-ftr-soc a{border-radius:2px}
.mk-ftr .legal-links{width:min(100% - 2rem,var(--max));margin:.75rem auto 0;padding-inline:.9rem;text-align:left;color:var(--ink)}
html.m .mk-pull .w>span{transition-duration:.7s;transition-delay:calc(var(--i,0) * 18ms)}
/* phone shop bar */
.mk-bar{align-items:center;gap:.8rem;background:var(--ledge);color:var(--on-ledge);box-shadow:none;border:0}
.mk-bar .btn{flex:none;background:var(--bg);color:var(--ink)}
.mk-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.mk-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-display);font-stretch:80%;font-size:1.1rem;color:var(--bg)}
.mk-bar-t span{font-size:.9rem}
/* the first shelf's front edge is lit, a strip light under the pieces: the page's one neon line (a little bloom after
   hours, none by day) */
.mk-shelf[data-ci] .mk-rail{box-shadow:inset 0 1px 0 var(--neon)}
html[data-theme="dark"] .mk-shelf[data-ci] .mk-rail{box-shadow:inset 0 1px 0 var(--neon),0 -1px 4px color-mix(in srgb,var(--neon) 45%,transparent)}
/* after hours */
html[data-theme="dark"] body{--ledge:color-mix(in srgb,var(--ink) 12%,var(--bg));--on-ledge:color-mix(in srgb,var(--ink) 88%,var(--bg));--edge:color-mix(in srgb,var(--ink) 16%,transparent)}
html[data-theme="dark"] .mk-bar{border-top:1px solid var(--edge)}
html[data-theme="dark"] .mk-bar-t strong{color:var(--ink)}
html[data-theme="dark"] .mk-bar .btn{background:var(--button);color:var(--on-button)}
html[data-theme="dark"] .mk-ph{background:color-mix(in srgb,var(--ink) 6%,var(--bg))}
@media (prefers-reduced-motion:reduce){.mk-ph{animation:none!important;transition:none!important}.mk-bench::after{display:none}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Market',
  bestFor: 'A small shop with several products: candles, jewelry, skincare, prints, clothes',
  why: 'Built for a shop with several products: your pieces drawn standing on shelves straight under the headline, one shelf per group with a printed ticket and price under each, stocked as people scroll, then your story and shipping and returns spelled out.',
  match: /\b(candles?|soap|jewel(le)?ry|earrings?|necklaces?|skin ?care|serums?|cosmetics|makeup|clothes|prints?|posters?|stickers?|ceramics?|pottery|mugs?|handmade|hand-?made|hand-?poured|crochet|knit|boutique|shop|store|bakery|cookies|treats|tea|sauces?|spices?|gifts?|plants?|stationery)\b/,
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Figtree:wght@400;500;600', display: ['Bricolage Grotesque', 'grotesk'], body: ['Figtree', 'sans'] },
  // The motion, as data (lib/choreo.md): the counter set out piece by piece, then each shelf stocked as you scroll.
  modes: ['light', 'dark'],
  choreo: { intro: 'assemble', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'medium', look: 'a shop shelf in daylight, paper tickets' },
  art: marketArt,
  tokens,
  slots,
  nav,
  render,
};
