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
const { cheapest, FOOTER_CSS, esc } = require('../shared');

const id = 'gather';

const f1 = (n) => String(Math.round(n));

// The event drawn for its photo slots, in line and the member's colours, like a studio comp. A bake (a bread or
// pastry class) gets the bench: loaves, the proofing basket, the starter, flour, and for the host the loaf cut open to
// its crumb. Anything else gets what the event runs on: admission tickets, torn and stacked on the poster stock.
function gaKind(c) {
  return /bread|sourdough|bak|pastry|pastries|loaf|loaves|dough|croissant|pizza|bagel|biscuit|cake/i.test(`${c.what} ${c.productName} ${c.name} ${(c.included || []).join(' ')}`) ? 'bake' : 'tickets';
}

function gatherArt(s, { p, c, seed, index, art }) {
  if (s.slot !== 'hero' && s.slot !== 'host') return null;
  const { w, h } = s;
  const bg = art.wall({ style: 'object', w, h, p, seed, index, quiet: true });
  const r = art.rng(`${seed}:ga:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const ink = color.mix(p.ink, '#000000', 0.1);
  const sw = Math.max(2, m * 0.0045);
  const L = (k = 1, col = ink) => `fill="none" stroke="${col}" stroke-width="${f1(sw * k)}" stroke-linecap="round" stroke-linejoin="round"`;
  const circ = (cx, cy, rx, ry = rx) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`;
  const shadow = (d, k = 1) => `<path d="${d}" fill="#000000" opacity=".22" transform="translate(${f1(m * 0.012 * k)} ${f1(m * 0.018 * k)})" filter="url(#gas)"/>`;
  const flourC = color.mix(p.paper, '#ffffff', 0.7);
  // Flour: speckle from noise, cut to the patch it was thrown on.
  let defs = bg.defs + `<filter id="gas" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.01)}"/></filter>` +
    `<filter id="gaf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".32" numOctaves="1" seed="${Math.floor(R(1, 90))}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -11 5.6"/></filter>`;
  let body = '';
  const flour = (id, d, op = 0.85) => { defs += `<clipPath id="${id}"><path d="${d}"/></clipPath>`; return `<g clip-path="url(#${id})" opacity="${op}"><rect x="${-w}" y="${-h}" width="${w * 3}" height="${h * 3}" fill="${flourC}" filter="url(#gaf)"/></g>`; };
  const patch = (cx, cy, rr) => {
    let d = `M${f1(cx + rr)} ${f1(cy)}`;
    for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI * 2, k = rr * R(0.7, 1.1); d += `L${f1(cx + Math.cos(a) * k)} ${f1(cy + Math.sin(a) * k * 0.75)}`; }
    return `${d}Z`;
  };

  if (gaKind(c) === 'bake') {
    const crust = color.mix(color.mix(p.primary, p.ink, 0.42), p.paper, 0.18);
    const crustLit = color.mix(crust, p.paper, 0.35);
    const crumb = color.mix(p.paper, color.mix(p.primary, p.paper, 0.6), 0.25);
    const wood = color.mix(color.mix(p.paper, p.primary, 0.05), p.ink, 0.13);
    const cane = color.mix(wood, p.paper, 0.35);
    // The bench: boards with their grain.
    body += `<rect width="${w}" height="${h}" fill="${wood}"/>`;
    let gr = '';
    const bw = w / (s.slot === 'hero' ? 5 : 4);
    for (let i = 1; i < 6; i++) gr += `M${f1(i * bw)} 0V${h}`;
    let fib = '';
    for (let i = 0; i < 16; i++) { const x = R(0, w), y = R(-0.1, 0.7) * h; fib += `M${f1(x)} ${f1(y)}q${f1(R(-6, 6))} ${f1(h * 0.12)} ${f1(R(-4, 4))} ${f1(h * R(0.18, 0.4))}`; }
    body += `<path d="${gr}" ${L(1, color.mix(wood, ink, 0.4))}/><path d="${fib}" ${L(0.5, color.mix(wood, ink, 0.22))}/>` + bg.body.replace(/<rect[^>]*fill="url\(#v\d+\)"\/>/, '').replace(/opacity="\.(\d+)"/g, (x, n) => `opacity=".${Math.round(n / 3)}"`);
    // A round loaf from above: the crust, flour from the basket, one curved score with its ear.
    const boule = (x, y, rr) => {
      const d = circ(x, y, rr, rr * 0.96);
      return shadow(d) + `<path d="${d}" fill="${crust}"/>` + flour(`gab${f1(x)}`, circ(x, y, rr * 0.92), 0.25) +
        `<path d="M${f1(x - rr * 0.55)} ${f1(y + rr * 0.35)}C${f1(x - rr * 0.3)} ${f1(y - rr * 0.45)} ${f1(x + rr * 0.35)} ${f1(y - rr * 0.5)} ${f1(x + rr * 0.6)} ${f1(y - rr * 0.1)}" ${L(9, crustLit)}/>` +
        `<path d="M${f1(x - rr * 0.55)} ${f1(y + rr * 0.35)}C${f1(x - rr * 0.3)} ${f1(y - rr * 0.45)} ${f1(x + rr * 0.35)} ${f1(y - rr * 0.5)} ${f1(x + rr * 0.6)} ${f1(y - rr * 0.1)}" ${L(2.4, color.mix(crust, '#000000', 0.35))}/>` +
        `<path d="${d}" ${L()}/>`;
    };
    // A long loaf with three slashes.
    const batard = (x, y, lw, a) => {
      const lh = lw * 0.42, d = circ(0, 0, lw / 2, lh / 2);
      let sl = '';
      for (let i = -1; i <= 1; i++) sl += `M${f1(i * lw * 0.24 - lw * 0.1)} ${f1(lh * 0.22)}q${f1(lw * 0.1)} ${f1(-lh * 0.3)} ${f1(lw * 0.2)} ${f1(-lh * 0.44)}`;
      return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(d)}<path d="${d}" fill="${crust}"/>${flour('gat', circ(0, 0, lw * 0.44, lh * 0.4), 0.2)}<path d="${sl}" ${L(7, crustLit)}/><path d="${sl}" ${L(2, color.mix(crust, '#000000', 0.35))}/><path d="${d}" ${L()}/></g>`;
    };
    // The proofing basket from above: the cane coiled round, dusted with flour.
    const basket = (x, y, rr) => {
      let rings = '';
      for (let i = 1; i <= 6; i++) rings += circ(x, y, rr * (1 - i * 0.13));
      return shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${cane}"/><path d="${rings}" ${L(1.6, color.mix(cane, ink, 0.45))}/>` + flour('gak', circ(x, y, rr * 0.8), 0.6) + `<path d="${circ(x, y, rr)}" ${L(1.4)}/>`;
    };
    // The starter: a jar from above, its rim and the bubbly surface, the lid set beside it.
    const jar = (x, y, rr) => {
      let bub = '';
      for (let i = 0; i < 9; i++) { const a = R(0, 6.3), d = rr * R(0.1, 0.65); bub += circ(x + Math.cos(a) * d, y + Math.sin(a) * d, rr * R(0.04, 0.1)); }
      return shadow(circ(x, y, rr)) + `<path d="${circ(x, y, rr)}" fill="${color.mix(bg.lit, '#ffffff', 0.5)}" fill-opacity=".7"/><path d="${circ(x, y, rr * 0.8)}" fill="${crumb}"/><path d="${bub}" ${L(0.8, color.mix(crumb, ink, 0.4))}/><path d="${circ(x, y, rr)}${circ(x, y, rr * 0.8)}" ${L()}/>` +
        `<path d="${circ(x + rr * 1.5, y + rr * 0.8, rr * 0.86)}" fill="${p.primary}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="${circ(x + rr * 1.5, y + rr * 0.8, rr * 0.7)}" ${L(0.6)}/>`;
    };
    // A bench scraper: steel blade, a wooden grip.
    const scraper = (x, y, sl, a) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(`M0 0h${f1(sl)}v${f1(sl * 0.7)}h${f1(-sl)}Z`, 0.5)}<rect width="${f1(sl)}" height="${f1(sl * 0.7)}" rx="${f1(sl * 0.04)}" fill="${color.mix(p.ink, p.paper, 0.72)}" stroke="${ink}" stroke-width="${f1(sw)}"/><rect width="${f1(sl)}" height="${f1(sl * 0.2)}" rx="${f1(sl * 0.04)}" fill="${color.mix(wood, ink, 0.25)}" stroke="${ink}" stroke-width="${f1(sw)}"/></g>`;
    // The crumb shot: a loaf cut through, its open crumb set with holes of every size, the knife beside it.
    const cut = (x, y, lw) => {
      const lh = lw * 0.62, d = `M${f1(x - lw / 2)} ${f1(y + lh * 0.3)}C${f1(x - lw / 2)} ${f1(y - lh * 0.6)} ${f1(x + lw / 2)} ${f1(y - lh * 0.6)} ${f1(x + lw / 2)} ${f1(y + lh * 0.3)}Q${f1(x + lw / 2)} ${f1(y + lh * 0.42)} ${f1(x + lw * 0.42)} ${f1(y + lh * 0.42)}H${f1(x - lw * 0.42)}Q${f1(x - lw / 2)} ${f1(y + lh * 0.42)} ${f1(x - lw / 2)} ${f1(y + lh * 0.3)}Z`;
      const inner = `M${f1(x - lw * 0.44)} ${f1(y + lh * 0.3)}C${f1(x - lw * 0.44)} ${f1(y - lh * 0.48)} ${f1(x + lw * 0.44)} ${f1(y - lh * 0.48)} ${f1(x + lw * 0.44)} ${f1(y + lh * 0.3)}V${f1(y + lh * 0.36)}H${f1(x - lw * 0.44)}Z`;
      let holes = '';
      for (let i = 0; i < 34; i++) {
        const hx = x + R(-0.36, 0.36) * lw, hy = y + R(-0.22, 0.3) * lh, t = (hx - x) / (lw * 0.44), top = y + lh * 0.3 - (lh * 0.78) * (1 - t * t) * 0.75;
        if (hy < top + lh * 0.06) continue;
        const rr = lw * (r() > 0.85 ? R(0.03, 0.05) : R(0.008, 0.02));
        holes += circ(hx, hy, rr * R(1, 1.8), rr);
      }
      return shadow(d) + `<path d="${d}" fill="${crust}"/><path d="${inner}" fill="${crumb}"/><path d="${holes}" fill="${color.mix(crumb, crust, 0.45)}" stroke="${color.mix(crumb, ink, 0.3)}" stroke-width="${f1(sw * 0.5)}"/><path d="${d}${inner}" ${L()}/>` +
        `<g transform="translate(${f1(x - lw * 0.42)} ${f1(y + lh * 0.75)}) rotate(-4)">${shadow(`M0 0h${f1(lw * 0.8)}v${f1(lw * 0.06)}h${f1(-lw * 0.8)}Z`, 0.4)}<path d="M0 0h${f1(lw * 0.56)}q${f1(lw * 0.04)} 0 ${f1(lw * 0.05)} ${f1(lw * 0.03)}l${f1(-lw * 0.01)} ${f1(lw * 0.03)}H0Z" fill="${color.mix(p.ink, p.paper, 0.75)}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="M${f1(lw * 0.04)} ${f1(lw * 0.06)}${Array.from({ length: 12 }, (_, i) => `l${f1(lw * 0.02)} ${f1(i % 2 ? lw * 0.008 : -lw * 0.008)}`).join('')}" ${L(0.5)}/><rect x="${f1(lw * 0.58)}" y="${f1(-lw * 0.01)}" width="${f1(lw * 0.3)}" height="${f1(lw * 0.08)}" rx="${f1(lw * 0.03)}" fill="${color.mix(wood, ink, 0.35)}" stroke="${ink}" stroke-width="${f1(sw)}"/></g>`;
    };
    if (s.slot === 'hero') {
      body += flour('gap', patch(w * 0.48, h * 0.5, w * 0.3), 0.5);
      body += basket(w * 0.2, h * 0.42, h * 0.2) + boule(w * 0.47, h * 0.52, h * 0.24) + batard(w * 0.74, h * 0.4, h * 0.56, -18) + jar(w * 0.82, h * 0.74, h * 0.09) + scraper(w * 0.26, h * 0.68, h * 0.18, 14);
    } else {
      body += flour('gap', patch(w * 0.5, h * 0.48, w * 0.42), 0.5);
      body += cut(w * 0.5, h * 0.44, w * 0.78) + boule(w * 0.78, h * 0.86, w * 0.16);
    }
  } else {
    // Admission tickets on poster stock: a short stack, one torn at its perforation, stubs scattered. Lines stand in
    // for type (an image can't load the page's fonts).
    const stock = color.mix(p.paper, '#ffffff', 0.5);
    const card = (x, y, tw, a, fill, torn) => {
      const th = tw * 0.42, st = tw * 0.26, n = th * 0.08, d = `M0 0H${f1(tw - st - n)}a${f1(n)} ${f1(n)} 0 0 0 ${f1(n * 2)} 0H${f1(tw)}V${f1(th)}H${f1(tw - st + n)}a${f1(n)} ${f1(n)} 0 0 0 ${f1(-n * 2)} 0H0Z`;
      const notch = '';
      return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(d, 0.6)}<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${f1(sw)}"/>` +
        `<path d="M${f1(tw - st)} ${f1(th * 0.12)}V${f1(th * 0.88)}" ${L(1.2)} stroke-dasharray="${f1(sw * 2)} ${f1(sw * 2.4)}"/>` +
        `<path d="M${f1(tw * 0.07)} ${f1(th * 0.2)}h${f1(tw * 0.18)}M${f1(tw * 0.07)} ${f1(th * 0.72)}h${f1(tw * 0.36)}M${f1(tw * 0.07)} ${f1(th * 0.83)}h${f1(tw * 0.26)}" ${L(1.1)}/><path d="M${f1(tw * 0.07)} ${f1(th * 0.46)}h${f1(tw * 0.5)}" ${L(7, color.mix(ink, fill, 0.1))}/>` +
        `<path d="M${f1(tw - st * 0.7)} ${f1(th * 0.38)}h${f1(st * 0.4)}M${f1(tw - st * 0.7)} ${f1(th * 0.56)}h${f1(st * 0.4)}" ${L(4, p.primary)}/>` + '</g>';
    };
    const stub = (x, y, sw2, a, fill) => {
      const sh = sw2 * 1.6, zz = Array.from({ length: 9 }, (_, i) => `L${f1(i % 2 ? sw2 * 0.07 : 0)} ${f1(((8 - i) / 8) * sh)}`).join('');
      return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})">${shadow(`M0 0H${f1(sw2)}V${f1(sh)}H0Z`, 0.5)}<path d="M0 0H${f1(sw2)}V${f1(sh)}H0${zz}Z" fill="${fill}" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="M${f1(sw2 * 0.3)} ${f1(sh * 0.4)}h${f1(sw2 * 0.4)}M${f1(sw2 * 0.3)} ${f1(sh * 0.58)}h${f1(sw2 * 0.4)}" ${L(4, p.primary)}/></g>`;
    };
    body += bg.body;
    const tint = color.mix(p.primary, p.paper, 0.78);
    if (s.slot === 'hero') {
      body += card(w * 0.18, h * 0.26, w * 0.42, -6, stock) + card(w * 0.22, h * 0.36, w * 0.42, 3, tint) + card(w * 0.26, h * 0.46, w * 0.42, -2, stock) + stub(w * 0.76, h * 0.3, w * 0.1, 12, tint) + stub(w * 0.68, h * 0.52, w * 0.1, -8, stock);
    } else {
      body += card(w * 0.12, h * 0.3, w * 0.76, -8, tint) + card(w * 0.14, h * 0.46, w * 0.76, 4, stock) + stub(w * 0.6, h * 0.74, w * 0.18, 14, tint);
    }
  }
  return art.svgDoc(w, h, defs, body);
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

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-ga', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, fine, photo, tickets, about, reviews, faq, signup, '</main>', float, P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '80rem' } };
}

// Nudges the giant line to the width with a transform only (its box is sized in CSS), and shows the ticket bar once the
// hero has scrolled away, until the questions, the last call or the footer come into view.
const JS = `(function(){var d=document,k=d.querySelector('.giant .g-in');
function fit(){if(!k)return;k.style.transform='';var w=k.parentNode.clientWidth,m=Math.max.apply(0,[].slice.call(k.querySelectorAll('.gl')).map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.76,Math.min(1.1,w/m));k.style.transform=Math.abs(r-1)<.004?'':'scale('+r.toFixed(3)+')'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var f=d.querySelector('.tix-float'),h=d.querySelector('.hero'),ends=[].slice.call(d.querySelectorAll('#faq,.signup,.ftr'));if(f&&h&&'IntersectionObserver' in window){d.documentElement.classList.add('tf');var past=false,seen=new Set();var set=function(){f.classList.toggle('show',past&&!seen.size)};new IntersectionObserver(function(e){past=!e[0].isIntersecting&&e[0].boundingClientRect.top<0;set()}).observe(h);var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting)seen.add(x.target);else seen.delete(x.target)});set()});ends.forEach(function(x){io.observe(x)})}})();`;

const CSS = `
${FOOTER_CSS}
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
.fine-stub{position:relative;display:grid;align-content:center;justify-items:center;gap:.25rem;width:var(--stub);border-left:0;text-align:center;font-family:var(--font-display);font-weight:900;text-transform:uppercase;line-height:.85;transform-origin:0 100%;rotate:5deg;translate:.6rem .4rem}
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
.ftr{background:var(--bg);border-top:2px dashed var(--ink)}
.ftr-links a,.ftr-contact a{text-decoration:none}
.ftr-links a:hover,.ftr-contact a:hover{text-decoration:underline;text-decoration-thickness:2px}
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
