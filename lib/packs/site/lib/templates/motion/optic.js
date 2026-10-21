// Optic (animated, product): for eyewear shops and opticians, light and dark.
//   Object:   the frames and the glass in them. The hero is an eye chart set in the shop's own name, with a pair of the
//             shop's own frames laid across it whose lenses really magnify the letters behind them (a scaled copy of the
//             chart, clipped to each lens). The photo slots draw the frames on a lit table and the colours on a shelf
//             (art: by what the shop sells, frames, sun or exams, with an empty display tray for anything else).
//   Material: optician's glass and acetate: a lit white table (light) or a charcoal velvet tray (dark), hairline rules,
//             a reading face made for low vision (Atkinson Hyperlegible) for the chart and the text, Gloock for names.
//   One move: the chart comes into focus. The name sharpens out of a blur word by word, the way letters do when the
//             right lens drops in (choreo intro 'develop', calm), and the frames come up sharp over it.
//   Pop:      the member's colour is the coating's reflection on the lens and the underline of the frame you point at.
// The one scroll moment is the lens tray: the shop's lens options are set large and the frames glide down across them;
// in the lenses the words start out of focus and sharpen, then the frames change into each colour the shop lists.
// Frames carry their own colours as named swatches, and a face-shape finder filters them when the shop says which
// faces each suits. JavaScript off and reduced motion: the still final frame, frames over the last lens, all in focus.

const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const Art = require('../../art');
const { esc } = require('../shared');
const { color } = require('../../../../_kit');
const { lenisScript, LENIS_CSS } = require('../../../vendor/lenis/lenis');

const id = 'optic';

function tokens(p, mode) {
  return mode === 'dark' ? { bg: '#0e1012', dark: '#060708' } : { bg: '#f3f4f3', dark: '#101214' };
}

// ---- facts, read for an optician ------------------------------------------------------------------------------
const LENS_RE = /\b(lens(es)?|single[- ]vision|progressives?|bifocals?|varifocals?|blue[- ]?light|polari[sz]ed|transitions?|photochromic|anti[- ]?(glare|reflective)|coatings?|tints?)\b/i;
function lineup(c) {
  const sv = c.services || [];
  const isLens = (s) => /lens/i.test(s.category || '') || (!/frame/i.test(s.category || '') && LENS_RE.test(s.name));
  return { frames: sv.filter((s) => !isLens(s)), lenses: sv.filter(isLens) };
}
const COL = {
  tortoise: ['#6a3d1c', 't'], havana: ['#5a3417', 't'], black: ['#161616'], crystal: ['#dfe7ea', 'c'], clear: ['#dfe7ea', 'c'],
  honey: ['#c2873a'], amber: ['#b5702a'], olive: ['#5d6a37'], green: ['#2e5b3e'], navy: ['#1f2d4d'], blue: ['#2c5a8c'],
  red: ['#9b2b2b'], burgundy: ['#5b1e2a'], wine: ['#5b1e2a'], rose: ['#cf9797'], pink: ['#dd9fb0'], gold: ['#c9a54c', 'm'],
  silver: ['#b8bdc3', 'm'], gunmetal: ['#4b5056', 'm'], grey: ['#7b8086'], gray: ['#7b8086'], brown: ['#5a3a23'],
  ivory: ['#ebe2cd'], white: ['#f1f1ec'], champagne: ['#d7c29a'], horn: ['#3c3125', 't'], purple: ['#5a3e77'], yellow: ['#d8b13a'], teal: ['#2a6b6b'],
};
const COL_RE = new RegExp(`\\b(${Object.keys(COL).join('|')})\\b`, 'gi');
function coloursOf(s) {
  const seen = new Set();
  return [...String(s.description || '').matchAll(COL_RE)].map((m) => m[1].toLowerCase()).filter((k) => !seen.has(k) && seen.add(k)).map((k) => ({ name: k, hex: COL[k][0], kind: COL[k][1] || '' }));
}
const FACES = ['round', 'oval', 'square', 'heart', 'long', 'diamond', 'oblong'];
function facesOf(s) {
  const m = String(s.description || '').toLowerCase().match(/suits?\s+([a-z ,/&-]+?)\s+faces?/);
  return m ? FACES.filter((f) => new RegExp(`\\b${f}\\b`).test(m[1])) : [];
}
// The shape a frame is drawn in: its own word for it, else what its material usually is (wire rims for metal).
function shapeOf(s, i) {
  const d = `${s.name} ${s.description || ''}`.toLowerCase();
  if (/cat[- ]?eye/.test(d)) return 'cat';
  if (/aviator|pilot/.test(d)) return 'aviator';
  if (/browline|clubmaster/.test(d)) return 'browline';
  if (/\bround\b(?!\s+and|\s+faces?|,)/.test(d.replace(/suits?.*$/, ''))) return 'round';
  if (/rectang|square/.test(d.replace(/suits?.*$/, ''))) return 'rect';
  if (/panto|keyhole|p3/.test(d)) return 'panto';
  if (/(acetate|horn|wood)[^,]*(and|&)\s*(steel|metal|titanium)/.test(d)) return 'browline';
  if (/titanium|steel|metal|wire|rimless/.test(d) && !/acetate/.test(d)) return 'round';
  return ['panto', 'rect'][i % 2];
}
const metalOf = (s) => { const d = String(s.description || '').toLowerCase(); return /titanium|steel|metal|wire/.test(d) && !/acetate|horn|wood/.test(d); };
// What the shop sells, for the drawings: frames (the default for eyewear), sun, or exams; '' for anything else.
function kindOf(c) {
  const s = `${c.what || ''} ${c.niche || ''} ${(c.services || []).map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\bsunglass\w*|\bsun ?shades?\b/.test(s) && !/\b(eye ?glass\w*|optical|optician)\b/.test(s)) return 'sun';
  if ((c.profile && c.profile.id === 'eyewear') || /\b(eyewear|eye ?glass\w*|glasses|spectacles|optic\w*|frames?|lenses)\b/.test(s)) return 'frames';
  if (/\b(optometr\w*|eye (exams?|care|doctor))\b/.test(s)) return 'frames';
  return '';
}

// ---- the frames, drawn from the front ---------------------------------------------------------------------------
// Corner radii [rx, ry] as fractions of the lens, top-left, top-right, bottom-right, bottom-left, for the lens on the
// left as you face the frames (its outer side is the left). The right lens is the mirror.
const SHAPES = {
  round: [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]],
  rect: [[0.15, 0.22], [0.15, 0.22], [0.18, 0.26], [0.18, 0.26]],
  panto: [[0.3, 0.34], [0.32, 0.36], [0.5, 0.6], [0.5, 0.6]],
  cat: [[0.12, 0.18], [0.44, 0.4], [0.5, 0.6], [0.42, 0.6]],
  aviator: [[0.3, 0.28], [0.26, 0.26], [0.4, 0.72], [0.56, 0.72]],
  browline: [[0.14, 0.2], [0.14, 0.2], [0.5, 0.64], [0.5, 0.64]],
};
const mirror = (R) => [R[1], R[0], R[3], R[2]];
const n1 = (v) => +v.toFixed(1);
function rr(x, y, w, h, R) {
  const [tl, tr, br, bl] = R.map(([a, b]) => [n1(a * w), n1(b * h)]);
  return `M${n1(x + tl[0])} ${y}H${n1(x + w - tr[0])}A${tr[0]} ${tr[1]} 0 0 1 ${x + w} ${n1(y + tr[1])}V${n1(y + h - br[1])}A${br[0]} ${br[1]} 0 0 1 ${n1(x + w - br[0])} ${y + h}H${n1(x + bl[0])}A${bl[0]} ${bl[1]} 0 0 1 ${x} ${n1(y + h - bl[1])}V${n1(y + tl[1])}A${tl[0]} ${tl[1]} 0 0 1 ${n1(x + tl[0])} ${y}Z`;
}
const radius = (R) => `${R.map((r) => `${Math.round(r[0] * 100)}%`).join(' ')} / ${R.map((r) => `${Math.round(r[1] * 100)}%`).join(' ')}`;
// One pair in a 200 x 72 box: lenses at x 8 and 112, 80 x 50, from y 12. Returns the rims in one colour as a group.
function rims(shape, col, metal, uid) {
  const R = SHAPES[shape] || SHAPES.panto, sw = metal ? 2.4 : 6.5;
  const paint = col.kind === 't' ? `url(#tt${uid})` : col.kind === 'm' ? `url(#mt${uid}${col.name})` : col.hex;
  const L = rr(8, 12, 80, 50, R), Rt = rr(112, 12, 80, 50, mirror(R));
  const bridge = metal ? 'M88 24Q100 15 112 24M88 31Q100 26 112 31' : 'M86 27Q100 13 114 27';
  const ends = metal ? 'M8 22H1M192 22H199' : 'M10 18H1.5M190 18H198.5';
  const brow = shape === 'browline' ? `<path d="${rr(6, 10, 84, 20, [[0.2, 0.5], [0.2, 0.5], [0.05, 0.3], [0.05, 0.3]])}M110 10h84v20h-84z" fill="${paint}"/>` : '';
  const crystal = col.kind === 'c';
  return `<g fill="none" stroke="${crystal ? 'rgba(214,226,230,.62)' : paint}" stroke-width="${sw}" stroke-linecap="round">${brow}<path d="${L}"/><path d="${Rt}"/><path d="${bridge}" stroke-width="${metal ? 1.8 : 6}"/><path d="${ends}" stroke-width="${metal ? 2.2 : 5}"/>${crystal ? `<path d="${L}${Rt}" stroke="rgba(60,80,88,.45)" stroke-width="1"/>` : ''}<path d="${rr(8, 11, 80, 50, R)}${rr(112, 11, 80, 50, mirror(R))}" style="stroke:var(--rim,rgba(255,255,255,.16))" stroke-width="${metal ? 0.7 : 1.1}"/>${metal ? '<ellipse cx="91" cy="38" rx="2" ry="3.4" fill="rgba(255,255,255,.5)" stroke="none"/><ellipse cx="109" cy="38" rx="2" ry="3.4" fill="rgba(255,255,255,.5)" stroke="none"/>' : ''}</g>`;
}
// The rims' highlight and the glass: a catch of light on the upper rims and a coating reflection in the member's colour.
function glass(shape, pop, metal, sun) {
  const R = SHAPES[shape] || SHAPES.panto;
  const L = rr(8, 12, 80, 50, R), Rt = rr(112, 12, 80, 50, mirror(R));
  return `<path d="${L}${Rt}" fill="${sun ? 'rgba(24,26,28,.42)' : 'rgba(170,200,210,.07)'}"/><path d="M16 52 46 16M124 52 154 16" stroke="#fff" stroke-opacity=".34" stroke-width="7" stroke-linecap="round"/><g class="glint"><path d="M58 59q18-4 27-20M162 59q18-4 27-20" fill="none" style="stroke:${pop}" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/></g>${metal ? '' : '<path d="M14 17q30-6 66 0M118 17q30-6 66 0" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1.4" stroke-linecap="round"/>'}`;
}
function defsFor(cols, uid) {
  let d = `<pattern id="tt${uid}" width="26" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><rect width="26" height="19" fill="#7a4519"/><path d="M0 4q5-4 10 0t6 5q-4 5-10 3T0 4zM15 13q4-3 9-1t2 5q-5 3-9 0z" fill="#2c160a" opacity=".85"/><path d="M8 13q3-2 5 0t-1 4q-3 1-4-4zM19 2q3-1 5 2t-3 3q-3-1-2-5z" fill="#4a2610"/><path d="M12 2q2-1 3 1t-2 2q-2 0-1-3zM3 15q2-1 3 1t-2 1q-2 0-1-2z" fill="#c4873f" opacity=".8"/><path d="M21 9q2 0 2 2t-2 1q-1-1 0-3z" fill="#e0a95c" opacity=".55"/></pattern>`;
  cols.filter((x) => x.kind === 'm').forEach((x) => { d += `<linearGradient id="mt${uid}${x.name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.mix(x.hex, '#ffffff', 0.55)}"/><stop offset=".5" stop-color="${x.hex}"/><stop offset="1" stop-color="${color.mix(x.hex, '#000000', 0.35)}"/></linearGradient>`; });
  return d;
}
// When each colour shows in the moment: from p = s to p = e (the first from the start, the last to the end).
const win = (k, n) => [k ? +(0.5 + ((k - 1) * 0.42) / Math.max(1, n - 1)).toFixed(3) : -9, k < n - 1 ? +(0.5 + (k * 0.42) / Math.max(1, n - 1)).toFixed(3) : 9];
// A pair as inline SVG. cols: one colour, or several stacked (the moment shows them in turn).
function pairSvg({ shape, cols, metal, pop, sun, uid, cls = '' }) {
  return `<svg class="${cls}" viewBox="0 0 200 72" aria-hidden="true" focusable="false"><defs>${defsFor(cols, uid)}</defs>${cols.map((col, k) => `<g class="fc" style="--s:${win(k, cols.length)[0]};--e:${win(k, cols.length)[1]}">${rims(shape, col, metal, uid)}</g>`).join('')}${glass(shape, pop, metal, sun)}</svg>`;
}

// ---- the eye chart: the shop's name in rows that get smaller, the town on the last line ---------------------------
function chartRows(c) {
  const words = String(c.name).toUpperCase().split(/\s+/).filter(Boolean);
  const rows = [];
  for (const w of words) {
    const last = rows[rows.length - 1];
    if (last && rows.length >= 3) rows[rows.length - 1] = `${last} ${w}`;
    else if (last && last.length + w.length + 1 <= 8 && rows.length > 0) rows[rows.length - 1] = `${last} ${w}`;
    else rows.push(w);
  }
  const fit = (s) => 86 / (s.length * 0.72 + Math.max(0, s.length - 1) * 0.1);
  let prev = 99;
  return rows.map((t, i) => { const f = Math.min(24, fit(t), i ? prev * 0.8 : 99); prev = f; return { t, f: +f.toFixed(2) }; });
}
function chartHtml(rows, c, { head }) {
  const city = c.online ? '' : c.city || c.place || '';
  const rowsHtml = rows.map((r, i) => `<span class="cr" style="--f:${r.f}cqw">${head ? `<span class="ci-w" data-ci-part>${esc(r.t)}</span>` : esc(r.t)}</span>`).join('');
  const name = head ? `<h1 class="cr-h" id="hero-title" data-ci="head"><span class="sr-only">${esc(c.name)}</span><span aria-hidden="true">${rowsHtml}</span></h1>` : `<div class="cr-h">${rowsHtml}</div>`;
  return `<div class="chart-in">${name}${city ? `<p class="cr cr-city" style="--f:5.2cqw"${head ? '' : ' aria-hidden="true"'}>${esc(city.toUpperCase())}</p>` : ''}</div>`;
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1800, h: 1200, style: 'object', alt: c.profile.hero || g[0] || `${c.name}, frames on the table` },
    { slot: 'heroPhone', file: 'hero-phone.jpg', w: 1080, h: 1600, style: 'object', alt: c.profile.hero || g[0] || `${c.name}, frames on the table` },
    { slot: 'tray', file: 'colours.jpg', w: 1500, h: 900, style: 'object', alt: g[1] || `Frames from ${c.name}` },
  ];
}

// The about, less any line that only restates the hero.
function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const restates = (t) => (lw(t).includes(lw(c.name)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  const { frames, lenses } = lineup(c);
  return [
    frames.length && { label: 'Frames', href: '#frames' },
    lenses.length && { label: 'Lenses', href: '#lenses' },
    { label: 'Visit', href: '#visit' },
    aboutParas(c).length && { label: 'About', href: '#about' },
  ].filter(Boolean);
}

function footer(c) {
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  const reach = [c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`, c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`].filter(Boolean).join('');
  return `<footer class="op-ftr">
<div class="wrap op-ftr-in">
<div class="op-case"><p class="op-case-name">${esc(c.name)}</p>${c.footerLine ? `<p class="op-case-line">${esc(c.footerLine)}</p>` : ''}</div>
${reach ? `<p class="op-ftr-reach">${reach}</p>` : ''}
${links ? `<nav aria-label="Footer"><ul class="op-ftr-nav">${links}</ul></nav>` : ''}
${P.socials(c, { cls: 'op-ftr-social', size: 18 })}
<p class="op-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div>
</footer>`;
}

function render(c0) {
  // The shop's buttons say what they do: shop the frames, book the exam.
  const exam = /\b(eye )?exams?\b|optometr/i.test(`${c0.what} ${c0.about || ''} ${(c0.services || []).map((s) => s.name).join(' ')}`);
  const relabel = (l) => (!l ? l : l.kind === 'buy' && /^buy now$/i.test(l.label) ? { ...l, label: c0.profile.book && /frame/i.test(c0.profile.book) ? c0.profile.book : 'Shop frames', short: 'Shop' } : l);
  const bookL = c0.booking ? { label: exam ? 'Book an eye exam' : 'Book a fitting', short: exam ? 'Book exam' : 'Book', href: c0.booking.href, kind: 'booking' } : null;
  const primary = relabel(c0.primary);
  const secondary = c0.booking && primary && primary.href !== c0.booking.href ? bookL : c0.phone && primary && primary.kind !== 'phone' ? { label: `Call ${c0.phone.display}`, href: c0.phone.href, kind: 'phone' } : null;
  const c = { ...c0, primary: primary && primary.kind === 'booking' ? bookL : primary, secondary };
  const { frames, lenses } = lineup(c);
  const kind = kindOf(c);
  const sun = kind === 'sun';
  const pop = 'var(--neon)';
  const first = frames[0];
  const fShape = first ? shapeOf(first, 0) : 'panto';
  const fCols = first ? coloursOf(first) : [];
  const fMetal = first ? metalOf(first) : false;
  const ink = { name: 'ink', hex: '#1a1a1a', kind: '' };

  // Hero: the chart, the frames across it, the lenses magnifying what is under them.
  const rows = chartRows(c);
  const lead = c.footerLine || c.heroSub;
  // The photo is the hero, full bleed and dark in both modes: the shop's frames under one light. The name sits on it
  // as an eye chart, the lines getting smaller; the photo comes into focus, drifts with the scroll, and once, a slow
  // band of light passes across it. Phones get their own upright photo, desktops the wide one.
  // One wide render and no upright one: the wide photo serves both, so the page carries it once.
  const onePhoto = !Art.photo(id, 'heroPhone') && Art.photo(id, 'hero');
  const pics = onePhoto ? P.img(c, 'hero', { cls: 'hero-img hero-img-1', eager: true }) : `${P.img(c, 'heroPhone', { cls: 'hero-img hero-img-p', eager: true })}${P.img(c, 'hero', { cls: 'hero-img hero-img-d' })}`;
  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="hero-pic" data-ci="subject"><div class="hero-par" data-par="0.08"><div class="hero-drift" data-alive="0.35">${pics}</div></div><span class="sweep" aria-hidden="true"></span></div>
<div class="wrap hero-in">
<div class="chart">${chartHtml(rows, c, { head: true })}</div>
<p class="lead" data-ci="then">${esc(lead)}</p>
<div class="ctas" data-ci="then">${c.primary ? P.button(c.primary, 'btn btn-primary btn-lg') : ''}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg') : ''}</div>
</div>
</section>`;

  // Frames: each one as the shop wrote it, drawn small in its first colour, with its colours as named swatches.
  const faces = [...new Set(frames.flatMap(facesOf))];
  const frameRows = frames.map((s, i) => {
    const cols = coloursOf(s), fc = facesOf(s);
    return `<li class="fr" data-faces="${fc.join(' ')}" data-rv style="--d:${i % 4}">
<div class="fr-pic">${pairSvg({ shape: shapeOf(s, i), cols: [cols[0] || ink], metal: metalOf(s), pop, sun, uid: `f${i}` })}</div>
<div class="fr-body"><h3 class="fr-name">${esc(s.name)}</h3>${s.description ? `<p class="fr-d">${esc(s.description)}</p>` : ''}${cols.length ? `<ul class="sw" aria-label="Colours">${cols.map((x) => `<li><span class="sw-dot sw-${x.kind || 's'}" style="--c:${x.hex}" aria-hidden="true"></span>${esc(x.name)}</li>`).join('')}</ul>` : ''}</div>
${s.priceText ? `<p class="fr-p">${esc(s.priceText)}</p>` : ''}
</li>`;
  }).join('\n');
  const tryOn = (c.links || []).find((l) => /try/i.test(l.label));
  const finder = faces.length > 1 ? `<fieldset class="finder" hidden><legend>Your face shape</legend><div class="finder-b"><button type="button" aria-pressed="true" data-face="">All</button>${faces.map((f) => `<button type="button" aria-pressed="false" data-face="${f}">${esc(f.charAt(0).toUpperCase() + f.slice(1))}</button>`).join('')}</div></fieldset>` : '';
  const framesSec = frames.length ? `<section class="sec frames" id="frames" aria-labelledby="frames-title">
<div class="wrap">
<div class="frames-head">
<h2 class="h2" id="frames-title">Frames</h2>
<figure class="tray" data-rv="mask">${P.img(c, 'tray', { cls: 'tray-img' })}</figure>
</div>
${finder}
<ol class="fr-list">
${frameRows}
</ol>
<p class="fr-none" hidden>No frames listed for that face shape yet.</p>
<div class="frames-foot">${c.primary && c.primary.kind === 'buy' ? P.button(c.primary, 'btn btn-primary') : ''}${tryOn ? `<a class="btn btn-line" href="${esc(tryOn.href)}">${esc(tryOn.label)}</a>` : ''}</div>
${c.returns ? `<p class="returns"><strong>Returns.</strong> ${esc(c.returns)}</p>` : ''}
</div>
</section>` : '';

  // The moment: the lens options set large; the frames glide down across them, focus, then change colour.
  const swaps = [];
  for (const s of frames) for (const col of coloursOf(s)) if (swaps.length < 4 && !swaps.some((x) => x.col.name === col.name)) swaps.push({ s, col });
  const mShape = fShape, mMetal = fMetal;
  const mCols = swaps.length ? swaps.map((x) => x.col) : [ink];
  const board = lenses.slice(0, 6);
  const boardIn = (clone) => `<div class="board-in"${clone ? ' aria-hidden="true"' : ''}>${board.map((s) => `<${clone ? 'div' : 'li'} class="lr"><span class="lr-n">${esc(s.name)}</span>${s.priceText ? `<span class="lr-p">${esc(s.priceText)}</span>` : ''}${s.description ? `<span class="lr-d">${esc(s.description)}</span>` : ''}</${clone ? 'div' : 'li'}>`).join('')}</div>`;
  const mLens = (side) => `<div class="ln ln-${side}" style="border-radius:${radius(side === 'l' ? SHAPES[mShape] : mirror(SHAPES[mShape]))}"><div class="ln-in" inert>${boardIn(true)}</div><div class="ln-in ln-soft" inert>${boardIn(true)}</div></div>`;
  const lensSec = board.length ? `<section class="lensx" id="lenses" aria-labelledby="lenses-title" data-sc style="--rows:${board.length};--K:${mCols.length}">
<div class="lensx-stage" data-sc-stage>
<div class="wrap lensx-in">
<h2 class="h2 lensx-h" id="lenses-title">Lenses</h2>
<div class="board"><ul class="board-list">${boardIn(false).replace('<div class="board-in">', '').replace(/<\/div>$/, '')}</ul>
<div class="specs mspecs" aria-hidden="true">${mLens('l')}${mLens('r')}${pairSvg({ shape: mShape, cols: mCols, metal: mMetal, pop, sun, uid: 'm', cls: 'specs-svg' })}</div>
</div>
${swaps.length > 1 ? `<p class="swap-cap" aria-hidden="true">${swaps.map((x, k) => `<span style="--s:${win(k, swaps.length)[0]};--e:${win(k, swaps.length)[1]}">${esc(x.s.name)} in ${esc(x.col.name)}</span>`).join('')}</p>` : ''}
</div>
</div>
</section>` : '';

  // At the shop: what comes with every pair, as the shop wrote it.
  const shop = c.included.length ? `<section class="sec shop" aria-labelledby="shop-title">
<div class="wrap shop-in">
<h2 class="h2" id="shop-title">With every pair</h2>
<ol class="shop-l">${c.included.map((x, i) => `<li data-rv style="--d:${i}"><span class="shop-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(x)}</li>`).join('')}</ol>
</div>
</section>` : '';

  // Visit: the address set like the shop's door, the hours like a timetable, the exam.
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title">
<div class="wrap visit-in">
<div class="visit-door">
<h2 class="h2" id="visit-title">${c.address ? 'Visit the shop' : 'Get in touch'}</h2>
${c.address ? `<p class="door">${esc(c.address)}</p>` : c.area && !c.online ? `<p class="door">${esc(c.areaLine || c.area)}</p>` : ''}
${c.mapsUrl && (c.address || c.area) ? `<a class="u-link" href="${esc(c.mapsUrl)}">Open in Maps${icon('arrowUpRight', { size: 16 })}</a>` : ''}
</div>
${c.hours.rows.length ? `<div class="visit-hours"><h3 class="visit-k">Hours</h3>${P.hours(c.hours.rows)}</div>` : ''}
<div class="visit-reach">
${bookL ? `<div class="exam"><h3 class="visit-k">${exam ? 'Eye exams' : 'Fittings'}</h3>${P.button(bookL, 'btn btn-primary')}</div>` : ''}
${c.phone || c.email ? `<ul class="reach">${c.phone ? `<li><span class="visit-k">Call</span><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></li>` : ''}${c.email ? `<li><span class="visit-k">Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}</ul>` : ''}
</div>
</div>
</section>`;

  const paras = aboutParas(c);
  const who = c.owner && c.owner !== c.name ? c.owner : '';
  const about = paras.length ? `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-in">
<h2 class="h2" id="about-title">${esc(who ? `About ${who}` : `About ${c.name}`)}</h2>
<div class="about-t">${paras.map((p, i) => `<p${i ? '' : ' class="about-first"'}>${esc(p)}</p>`).join('')}</div>
</div>
</section>` : '';

  const faq = c.faq.length ? `<section class="sec faq-sec" aria-labelledby="faq-title"><div class="wrap faq-in"><h2 class="h2" id="faq-title">Questions</h2>${P.faq ? P.faq(c.faq) : ''}</div></section>` : '';

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-op', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, framesSec, lensSec, shop, visit, about, faq, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}${LENIS_CSS}`, script: `${m.script}${finder ? FINDER_JS : ''}${lenisScript({ lerp: 0.085 })}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '999px', max: '76rem' } };
}

// The face-shape finder: shows the frames that suit the face picked (all of them with JavaScript off).
const FINDER_JS = `;(function(){var f=document.querySelector('.finder');if(!f)return;f.hidden=false;var bs=f.querySelectorAll('button'),rs=document.querySelectorAll('.fr-list .fr'),none=document.querySelector('.fr-none');bs.forEach(function(b){b.addEventListener('click',function(){var k=b.getAttribute('data-face'),n=0;bs.forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});rs.forEach(function(r){var on=!k||(' '+r.getAttribute('data-faces')+' ').indexOf(' '+k+' ')>-1;r.style.display=on?'':'none';if(on)n++});if(none)none.hidden=n>0})})})();`;

// ---- the placeholders, drawn ---------------------------------------------------------------------------------
// hero: from above, on a lit white table, an open pair and a folded one with a case and its cloth; the lenses really
// refract the cloth's folds (a shrunk copy inside each lens, as a minus lens does) and throw a bright caustic into
// their shadows. tray: the shop's colours, one pair each, on an acrylic ledge. Anything that isn't an eyewear shop
// gets the empty display tray and its cloth. No text, under 12 KB each.
function art(slot, { p, c, seed, art: Art }) {
  // A rendered photo wins when the pack ships one; the phone hero falls back to the wide render, cropped.
  const ph = Art.photo && (Art.photo('optic', slot.slot) || (slot.slot === 'heroPhone' && Art.photo('optic', 'hero')));
  if (ph) return ph;
  const cc = c || {};
  const kind = kindOf(cc);
  const w = slot.w, h = slot.h;
  const f = (v) => (+v).toFixed(1);
  const { frames } = lineup({ services: cc.services || [] });
  const pairs = frames.map((s, i) => ({ shape: shapeOf(s, i), cols: coloursOf(s), metal: metalOf(s) }));
  const pop = color.ensureContrast(color.mix(p.primary, '#ffffff', 0.25), '#101214', 4);
  const table = `<linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfa"/><stop offset="1" stop-color="#e4e6e5"/></linearGradient><radialGradient id="lt" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient><filter id="sb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter><filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter>`;
  if (slot.slot === 'hero' || slot.slot === 'heroPhone') {
    // Night in the shop: a walnut table under one spot, a dark microfibre cloth, the open pair on it. Dark in both modes.
    // Where things lie: the desktop frame keeps its left side quiet for the type, the phone frame its lower part.
    const tall = h > w;
    const L = tall
      ? { X: 260, Y: 360, K: 2.8, cloth: 'M150 290L960 250L990 800L180 840Z', fold: 'translate(660 1060) rotate(-9) scale(1.5)', kase: 'translate(-60 1160) rotate(-8)', sp: [540, 480], tray: [100, 260, 880, 900] }
      : { X: 900, Y: 540, K: 3.2, cloth: 'M820 470L1720 410L1780 990L860 1050Z', fold: 'translate(1040 60) rotate(9) scale(1.6)', kase: 'translate(330 860) rotate(-8)', sp: [1200, 620], tray: [700, 300, 1000, 640] };
    const dk = `<radialGradient id="lp"><stop offset="0" stop-color="#ffe9cf" stop-opacity=".09"/><stop offset="1" stop-color="#ffe9cf" stop-opacity="0"/></radialGradient><radialGradient id="sp" cx="${tall ? .5 : .62}" cy="${tall ? .38 : .52}" r="${tall ? .7 : .6}"><stop offset="0" stop-color="#3a2a1d"/><stop offset=".55" stop-color="#1c140e"/><stop offset="1" stop-color="#070605"/></radialGradient><filter id="sb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter><filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>`;
    const r = Art.rng ? Art.rng(seed || 7) : Math.random;
    let grain = '';
    for (let i = 0; i < Math.ceil(h / 48); i++) { const y = f(i * 48 + r() * 30); grain += `M0 ${y}C${w / 3} ${f(+y + r() * 40 - 20)} ${(2 * w) / 3} ${f(+y + r() * 40 - 20)} ${w} ${f(+y + r() * 30 - 15)}`; }
    const table = `<rect width="${w}" height="${h}" fill="url(#sp)"/><path d="${grain}" fill="none" stroke="#c8935c" stroke-opacity=".07" stroke-width="3"/>`;
    const clothD = L.cloth;
    const cloth = `<path d="${clothD}" fill="#22262a"/><g clip-path="url(#cl)" fill="none" stroke-linecap="round"><path d="M${L.X - 200} ${L.Y + 260}C${L.X + 200} ${L.Y + 180} ${L.X + 500} ${L.Y + 330} ${L.X + 900} ${L.Y + 240}" stroke="#3a4045" stroke-width="40" opacity=".35"/><path d="M${L.X - 200} ${L.Y + 300}C${L.X + 200} ${L.Y + 220} ${L.X + 500} ${L.Y + 370} ${L.X + 900} ${L.Y + 280}" stroke="#121416" stroke-width="30" opacity=".4"/></g><path d="${clothD}" fill="none" stroke="#3d4347" stroke-width="2"/>`;
    const spot = `<ellipse cx="${L.sp[0]}" cy="${L.sp[1]}" rx="620" ry="460" fill="url(#lp)"/>`;
    if (!kind) {
      // An empty display tray, lined, and the cloth folded on it.
      const defs = `${dk}<clipPath id="cl"><path d="${clothD}"/></clipPath>`;
      const [tx, ty, tw, th] = L.tray;
      const body = `${table}<rect x="${tx + 10}" y="${ty + 10}" width="${tw}" height="${th}" rx="24" fill="#000" opacity=".5" filter="url(#sb)" transform="translate(14 24)"/><rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="24" fill="#16181a" stroke="#34383c" stroke-width="3"/><rect x="${tx + 32}" y="${ty + 32}" width="${tw - 64}" height="${th - 64}" rx="14" fill="#1e2124"/><path d="M${tx + 46} ${ty + 40}h${tw - 92}" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>${cloth}${spot}<rect width="${w}" height="${h}" filter="url(#gr)"/>`;
      return Art.svgDoc(w, h, defs, body);
    }
    const A = pairs[0] || { shape: 'panto', cols: [{ name: 'black', hex: '#161616', kind: '' }], metal: false };
    const B = pairs[1] || { shape: 'round', cols: [{ name: 'silver', hex: '#b8bdc3', kind: 'm' }], metal: true };
    const ca = A.cols[0] || { name: 'black', hex: '#161616', kind: '' }, cb = B.cols[0] || { name: 'silver', hex: '#b8bdc3', kind: 'm' };
    const sunTint = kind === 'sun';
    const RA = SHAPES[A.shape] || SHAPES.panto;
    const lensA = `${rr(8, 12, 80, 50, RA)}${rr(112, 12, 80, 50, mirror(RA))}`;
    const { X, Y, K } = L;
    const defs = `${dk}<clipPath id="cl"><path d="${clothD}"/></clipPath><clipPath id="la" transform="translate(${X} ${Y}) scale(${K})"><path d="${lensA}"/></clipPath>${defsFor([ca, cb], 'a')}<linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2f33"/><stop offset="1" stop-color="#121315"/></linearGradient><radialGradient id="cu" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff4e2" stop-opacity=".85"/><stop offset="1" stop-color="#fff4e2" stop-opacity="0"/></radialGradient>`;
    // The open pair, seen from above: its front on the cloth, the temples running up and away under the spot.
    const front = `<g transform="translate(${X} ${Y}) scale(${K})">${rims(A.shape, ca, A.metal, 'a')}</g>`;
    const tCol = ca.kind === 't' ? 'url(#tta)' : ca.kind === 'c' ? 'rgba(214,226,230,.7)' : ca.kind === 'm' ? ca.hex : ca.hex;
    const temples = A.metal
      ? `<path d="M${X + 6} ${Y + 64}L${X - 90} ${Y - 360}M${X + 634} ${Y + 64}L${X + 730} ${Y - 360}" stroke="${tCol}" stroke-width="6" stroke-linecap="round"/>`
      : `<path d="M${X + 8} ${Y + 60}L${X - 74} ${Y - 340}Q${X - 78} ${Y - 360} ${X - 60} ${Y - 364}M${X + 632} ${Y + 60}L${X + 714} ${Y - 340}Q${X + 718} ${Y - 360} ${X + 700} ${Y - 364}" fill="none" stroke="${tCol}" stroke-width="15" stroke-linecap="round"/>`;
    const shadow = `<g transform="translate(${X + 36} ${Y + 64}) scale(${K})" opacity=".55" filter="url(#sb)"><path d="${lensA}" fill="none" stroke="#000" stroke-width="7"/></g><g transform="translate(${X + 36} ${Y + 64}) scale(${K})"><ellipse cx="52" cy="40" rx="18" ry="10" fill="url(#cu)" opacity=".7"/><ellipse cx="156" cy="40" rx="18" ry="10" fill="url(#cu)" opacity=".7"/></g>`;
    // Inside the lenses: the cloth again, shrunk about each lens centre (a minus lens), so the folds jump at the rim.
    const bend = (cx, cy) => `<g transform="translate(${cx} ${cy}) scale(.82) translate(${-cx} ${-cy})"><rect width="${w}" height="${h}" fill="url(#sp)"/>${cloth}</g>`;
    const refr = `<g clip-path="url(#la)">${bend(X + 48 * K, Y + 37 * K)}${bend(X + 152 * K, Y + 37 * K)}${sunTint ? `<rect width="${w}" height="${h}" fill="#0b0c0d" opacity=".5"/>` : ''}</g>`;
    const glassTop = `<g transform="translate(${X} ${Y}) scale(${K})">${glass(A.shape, pop, A.metal, sunTint)}</g>`;
    // A folded pair up and to the right, the open case down and to the left.
    const folded = `<g transform="${L.fold}"><g opacity=".5" filter="url(#sb)" transform="translate(10 16)"><rect x="6" y="10" width="188" height="56" rx="20"/></g><path d="M12 30H188" stroke="${cb.kind === 'm' ? 'url(#mta' + cb.name + ')' : cb.hex}" stroke-width="3"/>${rims(B.shape, cb, B.metal, 'a')}${glass(B.shape, pop, B.metal, sunTint)}</g>`;
    const kase = `<g transform="${L.kase}"><rect x="14" y="26" width="500" height="200" rx="100" fill="#000" opacity=".6" filter="url(#sb)"/><rect width="500" height="200" rx="100" fill="url(#cs)"/><rect x="16" y="14" width="468" height="172" rx="86" fill="#1b1d20" stroke="#3a3e43" stroke-width="2"/><path d="M70 28q180-22 360 0" stroke="#fff" stroke-opacity=".14" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
    const body = `${table}${cloth}${kase}${folded}${shadow}${temples}${refr}${front}${glassTop}${spot}<rect width="${w}" height="${h}" filter="url(#gr)"/>`;
    return Art.svgDoc(w, h, defs, body);
  }
  if (slot.slot === 'tray') {
    if (!kind) return null;
    // Every colour the shop lists, one pair each, on a clear acrylic ledge under a top light.
    const list = [];
    pairs.forEach((pr) => pr.cols.forEach((col) => { if (list.length < 6 && !list.some((x) => x.col.name === col.name)) list.push({ ...pr, col }); }));
    if (!list.length) list.push({ shape: 'panto', metal: false, col: { name: 'black', hex: '#161616', kind: '' } }, { shape: 'round', metal: true, col: { name: 'gold', hex: '#c9a54c', kind: 'm' } });
    // One ledge for up to three pairs, two ledges (three over two) for more.
    const rowsOf = list.length > 3 ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : [list];
    const defs = `<radialGradient id="wl" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#5a5f64"/><stop offset=".55" stop-color="#2a2d30"/><stop offset="1" stop-color="#121315"/></radialGradient><linearGradient id="ac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e4e8" stop-opacity=".55"/><stop offset="1" stop-color="#7d8a90" stop-opacity=".25"/></linearGradient><filter id="sb" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>${defsFor(list.map((x) => x.col), 'y')}`;
    let body = `<rect width="${w}" height="${h}" fill="url(#wl)"/>`;
    rowsOf.forEach((row, ri) => {
      const ly = rowsOf.length > 1 ? h * (ri ? 0.86 : 0.44) : h * 0.66;
      const n = row.length, sc = Math.min(rowsOf.length > 1 ? 2.1 : 2.6, (w - 160) / (n * 230)), gap = (w - n * 200 * sc) / (n + 1);
      body += `<rect x="40" y="${f(ly + 6)}" width="${w - 80}" height="30" fill="url(#ac)"/><rect x="40" y="${f(ly + 6)}" width="${w - 80}" height="3" fill="#fff" opacity=".8"/><rect x="40" y="${f(ly + 36)}" width="${w - 80}" height="22" fill="#000" opacity=".5" filter="url(#sb)"/>`;
      row.forEach((it, i) => {
        const x = gap + i * (200 * sc + gap), y = ly - 66 * sc;
        body += `<ellipse cx="${f(x + 100 * sc)}" cy="${f(ly + 4)}" rx="${f(92 * sc)}" ry="6" fill="#000" opacity=".5" filter="url(#sb)"/><g transform="translate(${f(x)} ${f(y)}) scale(${sc.toFixed(3)})">${rims(it.shape, it.col, it.metal, 'y')}${glass(it.shape, pop, it.metal, kind === 'sun')}</g>`;
      });
    });
    return Art.svgDoc(w, h, defs, body);
  }
  return null;
}

const CSS = `
@font-face{font-family:'Optic Display Fallback';src:local('Georgia'),local('Times New Roman'),local('Liberation Serif');size-adjust:110%;ascent-override:89%;descent-override:21%;line-gap-override:0%}
@font-face{font-family:'Optic Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Helvetica');size-adjust:98%;ascent-override:97%;descent-override:30%;line-gap-override:0%}
html:root{--rim:transparent;--font-display:"Gloock","Optic Display Fallback",serif;--font-body:"Atkinson Hyperlegible","Optic Body Fallback",sans-serif;--ease:cubic-bezier(.16,1,.3,1);--table:#ffffff;--table-edge:color-mix(in srgb,var(--ink) 9%,var(--bg));--shade:0 1px 0 rgba(255,255,255,.9) inset,0 18px 40px -24px rgba(18,24,28,.35);--velvet:none}
html[data-theme="dark"]{--ink:#e8ebeb;--primary-deep:#9cc3c5;--focus:#6fb3b6;--rim:rgba(255,255,255,.22);--table:#16181b;--table-edge:#2a2d31;--shade:0 1px 0 rgba(255,255,255,.06) inset,0 20px 50px -28px rgba(0,0,0,.9);--velvet:radial-gradient(120% 90% at 30% 0%,rgba(255,255,255,.05),transparent 60%)}
body{font-size:1.0625rem;line-height:1.55}
h1,h2,h3{font-family:var(--font-display);font-weight:400;letter-spacing:-.01em;line-height:1.04}
.h2{font-size:clamp(2.3rem,1.6rem + 3vw,4.2rem)}
.btn{font-weight:700;letter-spacing:.01em;transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border:1.5px solid color-mix(in srgb,var(--ink) 35%,var(--bg))}
.btn-line:hover{border-color:var(--ink)}
.u-link{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;color:var(--ink);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--ink) 30%,var(--bg));text-underline-offset:.3em}
.u-link:hover{text-decoration-color:var(--primary-text)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1rem;min-height:4rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.35rem;letter-spacing:-.01em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;text-decoration:none;color:var(--muted);background:linear-gradient(var(--primary-text),var(--primary-text)) 0 100%/0 1.5px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1.5px}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.hdr-cta{min-height:2.75rem;padding:.5rem 1.15rem}
.menu-panel{min-height:calc(100svh - 4rem);overflow-y:auto;background:var(--bg)}
.menu-panel li a{font-family:var(--font-display);font-size:2.2rem;font-weight:400}
body.has-bar .menu-panel>.btn{display:none}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the photo, full bleed and dark in both modes; the name on it as an eye chart */
.hero{position:relative;isolation:isolate;display:grid;align-items:end;padding-block:0 2.5rem;background:#08090a;color:#eef2f1;overflow:hidden}
.hero-pic{position:relative;height:min(60svh,32rem);z-index:-2;overflow:hidden}
.hero-pic::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgb(8,9,10) 0,rgba(8,9,10,.6) 22%,rgba(8,9,10,0) 48%);pointer-events:none}
.hero-par{position:absolute;inset:-6% 0}
.hero-drift{position:absolute;inset:-3%}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-img-p{object-position:70% 30%}
.hero-img-1{object-position:70% 50%}
.hero-img-d{display:none;object-position:72% 50%}
.sweep{position:absolute;inset:-10% auto -10% 0;width:55%;background:linear-gradient(100deg,transparent,rgba(255,236,214,.13) 50%,transparent);mix-blend-mode:screen;opacity:0;transform:translateX(-110%) skewX(-8deg);pointer-events:none}
html.m .sweep{animation:sweep 3.2s cubic-bezier(.45,0,.25,1) 1.5s both}
@keyframes sweep{0%{opacity:0;transform:translateX(-110%) skewX(-8deg)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(230%) skewX(-8deg)}}
.hero::after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none}
.hero-in{position:relative;display:grid;gap:1.1rem;justify-items:start;margin-top:-4.5rem}
.chart{container-type:inline-size;width:min(100%,34rem)}
.chart-in{text-align:left}
.cr-h{margin:0;font:inherit;letter-spacing:0;line-height:inherit;color:#fff}
.cr{display:block;font-family:"Atkinson Hyperlegible","Optic Body Fallback",sans-serif;font-weight:700;font-size:var(--f);line-height:1.12;letter-spacing:.1em;white-space:nowrap}
.cr-city{margin-top:.9rem;font-size:.9rem!important;font-weight:700;letter-spacing:.32em;color:#c9d0cf}
.cr-city::before{content:'';display:block;width:3.5rem;height:2px;margin-bottom:.9rem;background:var(--neon)}
.hero .lead{max-width:30rem;color:#e7ecea;font-size:clamp(1.08rem,1rem + .4vw,1.3rem)}
.ctas{display:flex;flex-wrap:wrap;gap:.6rem}
.hero .btn-line{color:#fff;border-color:rgba(255,255,255,.55)}
.hero .btn-line:hover{border-color:#fff}
@media (min-width:48rem){
.hero{align-items:center;min-height:max(40rem,calc(100svh - 4rem));padding-block:4rem}
.hero-pic{position:absolute;inset:0;height:auto}
.hero-pic::after{content:none}
.hero-in{margin-top:0}
.hero-img-p{display:none}
.hero-img-d{display:block}
.hero::after{background:linear-gradient(90deg,rgba(8,9,10,.94) 0,rgba(8,9,10,.78) 30%,rgba(8,9,10,.15) 58%,rgba(8,9,10,0) 72%)}
.hero-in{max-width:76rem}
.chart{width:min(46%,34rem)}
}
/* the drawn frames (frames list and the lens tray): lenses magnify what passes under them */
.specs{position:absolute;left:var(--X);top:var(--Y);width:var(--S);aspect-ratio:200/72;pointer-events:none;z-index:2}
.specs-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 10px 9px rgba(0,0,0,.22))}
.ln{position:absolute;top:calc(var(--S) * .06);width:calc(var(--S) * .4);height:calc(var(--S) * .25);overflow:hidden;background:var(--table)}
.ln-l{left:calc(var(--S) * .04);--lx:calc(var(--S) * .04)}
.ln-r{left:calc(var(--S) * .56);--lx:calc(var(--S) * .56)}
.ln-in{--m:1.24;position:absolute;width:100cqw;left:calc(-1 * (var(--X) + var(--lx)));top:calc(-1 * (var(--Y) + var(--S) * .06));transform-origin:calc(var(--X) + var(--lx) + var(--S) * .2) calc(var(--Y) + var(--S) * .185);transform:translate(calc(-1 * var(--m) * var(--dx,0px)),calc(-1 * var(--m) * var(--dy,0px))) scale(var(--m));background:var(--table)}
/* frames */
.frames{border-top:1px solid var(--line)}
.frames-head{display:grid;gap:1.25rem;margin-bottom:1.5rem}
@media (min-width:60rem){.frames-head{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:end;gap:3rem}}
.tray{margin:0;border-radius:6px;overflow:hidden;box-shadow:var(--shade)}
.tray-img{width:100%}
.finder{margin:0 0 1rem;padding:0;border:0;min-width:0}
.finder legend{margin-bottom:.6rem;font-size:.95rem;color:var(--muted)}
.finder-b{display:flex;flex-wrap:wrap;gap:.4rem}
.finder button{min-height:2.75rem;padding:.4rem 1rem;border-radius:999px;border:1.5px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:.95rem;cursor:pointer;transition:border-color .2s ease,background-color .2s ease}
.finder button[aria-pressed="true"]{border-color:var(--ink);background:var(--ink);color:var(--bg)}
.fr-list{border-top:1px solid var(--line)}
.fr{display:grid;grid-template-columns:7.5rem minmax(0,1fr);grid-template-areas:"pic name" "pic price";gap:.2rem 1rem;align-items:center;padding:1.1rem 0;border-bottom:1px solid var(--line)}
@media (min-width:48rem){.fr{grid-template-columns:12rem minmax(0,1fr) auto;grid-template-areas:"pic name price";gap:2rem;padding:1.5rem 0}}
.fr-pic{grid-area:pic;padding:.9rem .6rem;border-radius:6px;background:var(--table);background-image:var(--velvet);box-shadow:var(--shade)}
html[data-theme="dark"] .fr-pic{background:radial-gradient(120% 100% at 50% 0%,#33373c,#1c1e21)}
.fr-pic svg{display:block;width:100%;height:auto;overflow:visible}
.fr-body{grid-area:name;display:grid;gap:.3rem}
.fr-name{font-size:clamp(1.5rem,1.2rem + 1.2vw,2.2rem)}
.fr-d{font-size:.95rem;color:var(--muted)}
.fr-p{grid-area:price;font-weight:700;font-variant-numeric:tabular-nums;font-size:1.15rem}
.sw{display:flex;flex-wrap:wrap;gap:.2rem .8rem;margin-top:.2rem;font-size:.9rem}
.sw li{display:inline-flex;align-items:center;gap:.4rem}
.sw-dot{width:.95rem;height:.95rem;border-radius:50%;background:var(--c);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 25%,transparent)}
.sw-t{background:linear-gradient(135deg,#2e1a0c 0 28%,#7a4519 28% 52%,#c0853f 52% 62%,#4a2610 62%)}
.sw-c{background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(190,205,210,.5))}
.sw-m{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 45%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 70%,#000))}
.fr-none{padding:1rem 0;color:var(--muted)}
.frames-foot{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.5rem}
.returns{max-width:44rem;margin-top:1.5rem;font-size:.95rem;color:var(--muted)}
.returns strong{color:var(--ink)}
/* the lens tray: the moment */
.lensx{--p:1;border-top:1px solid var(--line)}
html.m .lensx{height:calc(150svh + var(--rows) * 22svh)}
.lensx-stage{position:sticky;top:4rem;min-height:calc(100svh - 4rem);display:grid;align-content:center;padding-block:2.5rem}
.lensx-h{margin-bottom:1.25rem}
/* the prices keep their own gutter on the right; the frames travel only over the names, so no price is ever under glass */
.board{--rh:5.75rem;--px:4.5cqw;--pc:5.75rem;--X:3cqw;--lim:calc(100cqw - var(--px) - var(--pc) - 1.25rem);--S:min(74cqw,calc(var(--lim) - var(--X)));--Y:calc(var(--rh) * .5 - var(--S) * .18);position:relative;container-type:inline-size;border-radius:6px;background:var(--table);background-image:var(--velvet);box-shadow:var(--shade);overflow:hidden}
@media (min-width:48rem){.board{--rh:6.75rem;--px:6cqw;--pc:8rem;--S:min(38cqw,calc(var(--lim) - var(--X)))}}
.board-list,.board-in{display:block}
.lr{position:relative;display:grid;grid-template-columns:minmax(0,1fr) var(--pc);align-content:center;column-gap:1rem;height:var(--rh);padding:0 var(--px);border-bottom:1px solid var(--table-edge)}
.lr:last-child{border-bottom:0}
.lr-n{font-family:var(--font-display);font-size:clamp(1.55rem,1.2rem + 1.6vw,2.6rem);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr-p{align-self:center;justify-self:end;max-width:var(--pc);text-align:right;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;white-space:normal;overflow-wrap:anywhere}
.lr-d{grid-column:1 / -1;font-size:.9rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mspecs{transform:translate(var(--dx),var(--dy));--dx:calc(var(--p) * max(0px,var(--lim) - var(--X) - var(--S)));--dy:calc(var(--p) * var(--rh) * (var(--rows) - 1))}
.mspecs .ln-in:not(.ln-soft){opacity:clamp(0,calc(var(--p) * 4),1)}
.ln-soft{color:transparent;text-shadow:0 0 .16em var(--ink);opacity:clamp(0,calc(1 - var(--p) * 4),1)}
.ln-soft .lr-d,.ln-soft .lr-p{text-shadow:0 0 .3em var(--muted)}
@media (max-width:47.99rem){.lr-n{font-size:min(1.4rem,6.2cqw)}.ln-soft{display:none}.mspecs .ln-in:not(.ln-soft){opacity:1}}
.fc{opacity:calc(clamp(0,calc((var(--p,1) - var(--s)) * 14),1) - clamp(0,calc((var(--p,1) - var(--e)) * 14),1))}
.hero .fc,.fr-pic .fc{opacity:1}
.swap-cap{position:relative;height:1.6em;margin-top:1rem;font-size:1rem;color:var(--muted)}
.swap-cap span{position:absolute;left:0;top:0;opacity:calc(clamp(0,calc((var(--p) - var(--s)) * 14),1) - clamp(0,calc((var(--p) - var(--e)) * 14),1))}
/* with every pair */
.shop{background:var(--table);background-image:var(--velvet);border-block:1px solid var(--line)}
.shop-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.shop-in{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:3rem}}
.shop-l{border-top:1px solid var(--line)}
.shop-l li{display:flex;gap:1.1rem;align-items:baseline;padding:1rem 0;border-bottom:1px solid var(--line);font-size:1.15rem}
.shop-n{font-size:.85rem;font-variant-numeric:tabular-nums;color:var(--primary-text);font-weight:700}
/* visit */
.visit-in{display:grid;gap:2rem}
@media (min-width:60rem){.visit-in{grid-template-columns:minmax(0,6fr) minmax(0,3fr) minmax(0,3fr);gap:3rem;align-items:start}}
.visit-door{display:grid;gap:1rem;justify-items:start}
.door{font-family:var(--font-display);font-size:clamp(1.5rem,1.2rem + 1.2vw,2.2rem);line-height:1.3;max-width:22ch}
.visit-k{display:block;font-family:var(--font-body);font-size:.9rem;font-weight:700;color:var(--muted);margin-bottom:.4rem}
.visit-reach{display:grid;gap:1.5rem}
.reach{display:grid;gap:.9rem}
.reach a{display:inline-flex;min-height:2.75rem;align-items:center;font-size:1.1rem;color:var(--ink);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--ink) 30%,var(--bg));text-underline-offset:.3em;overflow-wrap:anywhere}
.reach a:hover{text-decoration-color:var(--primary-text)}
/* about */
.about{border-top:1px solid var(--line)}
.about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.about-in{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:3rem}}
.about-t{display:grid;gap:1rem;max-width:40rem}
.about-first{font-family:var(--font-display);font-size:clamp(1.45rem,1.2rem + 1vw,2rem);line-height:1.3}
.about-t p:not(.about-first){color:var(--muted)}
.faq-in{display:grid;gap:1.5rem}
/* footer: the case */
.op-ftr{border-top:1px solid var(--line);padding-block:3rem 1.5rem}
.op-ftr-in{display:grid;gap:1.25rem;justify-items:center;text-align:center}
.op-case{position:relative;width:min(100%,34rem);padding:2.4rem 2rem;border-radius:999px;background:var(--table);background-image:var(--velvet);box-shadow:var(--shade),0 0 0 1px var(--table-edge)}
.op-case-name{display:flex;align-items:center;gap:.9rem;margin-inline:-1rem;font-family:var(--font-display);font-size:clamp(1.8rem,1.3rem + 2vw,2.8rem);line-height:1.05}
.op-case-name::before,.op-case-name::after{content:'';flex:1 1 0;min-width:1rem;border-top:1px solid var(--table-edge)}
.op-case-line{position:relative;z-index:1;margin-top:.6rem;font-size:.95rem;color:var(--muted)}
.op-ftr-reach{display:flex;flex-wrap:wrap;justify-content:center;gap:0 1.5rem}
.op-ftr a{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ink);text-decoration:none}
.op-ftr a:hover{text-decoration:underline;text-decoration-color:var(--primary-text);text-underline-offset:.3em}
.op-ftr-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:0 1.25rem;color:var(--muted)}
.op-ftr-c{font-size:.85rem;color:var(--muted)}
.op-ftr>.legal-links{text-align:center}
.mbar{background:var(--bg);border-top-color:var(--line)}
.sec{padding-block:clamp(3.5rem,2.5rem + 4vw,7rem)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Optic',
  bestFor: 'Eyewear shops, opticians and sunglasses makers, with frames to try and lenses to choose, with motion',
  why: 'Built for glasses: your name is set as an eye chart and comes into focus, your frames lie across it with lenses that really magnify the letters, then your lens options pass under the glass as you scroll and the frames change into each of your colours.',
  match: /\b(eyewear|eye ?glass(es)?|glasses|spectacles|optic(al|ians?)?|optometr\w*|sunglass(es)?|eye exams?|frames and lenses)\b/,
  fonts: { q: 'family=Gloock&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400', display: ['Gloock', 'serif'], body: ['Atkinson Hyperlegible', 'sans'] },
  modes: ['light', 'dark'],
  // The motion, as data (lib/choreo.md): the chart comes into focus, the plate leans to the pointer, the lens tray scrolls.
  choreo: { intro: 'develop', alive: ['drift'], scroll: 'scene', pace: 'calm', look: 'an optician\'s lit table and the glass in the frames, letters coming into focus' },
  tokens,
  slots,
  nav,
  render,
  art,
};
