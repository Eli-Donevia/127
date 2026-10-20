// Rotunda (animated, portfolio): the work hung on the inside of a curved gallery wall, each piece opened on its own.
//   Object: the rotunda. The member's pieces, drawn as the buildings and rooms they are (an elevation, a gridded
//   facade, a chapel, a lobby in one-point perspective, a row of townhouses) in ink on concrete and paper, stand on a
//   cylinder around the viewer (CSS 3D, no library) that turns as you scroll or drag, with inertia.
//   Material: gallery plaster in daylight: a warm white wall, graphite type, hairline rules, square frames, wall labels.
//   One move: mask. The name rises out of its own rule, the lead and the wall label follow out of theirs, and the wall
//   is uncovered from the floor up.
//   Scroll moment: the cylinder, pinned, turning with the scroll (and the drag), the cards bending a little with speed.
//   Pop: the number of the piece facing you on the wall lights in the member's colour as the ring turns (and the
//   hovered piece's frame).
// Each piece shows once: its case study is a sheet over the page at #case-n (opens with no script too), with the print
// large, its wall label and the next piece. Then who it was made for as a credits list, services as a price list,
// about as wall text beside the view camera, and the project form set as a loan form. Phones get a flat carousel;
// reduced motion and no script get a two-column contact sheet. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');

const id = 'rotunda';
const STYLES = ['portrait', 'sweep', 'arch', 'mesh', 'object', 'plates', 'grid', 'tile'];

function tokens(p) {
  return { bg: color.mix(p.paper, '#f3f1ec', 0.88), dark: color.mix(color.mix(p.ink, p.primary, 0.08), '#0d0d0d', 0.8) };
}

// The pieces with photos: the member's work (up to 12), else 8 placeholder spots.
function pieceCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(12, n) : 8;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const out = [];
  for (let i = 0; i < pieceCount(c); i++) {
    const piece = (c.work || [])[i];
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 1200, h: 1500, style: STYLES[i % STYLES.length], alt: piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work`, piece: piece ? `${piece.title} ${piece.detail || ''}`.toLowerCase() : ['grid', 'house', 'interior', 'row'][i % 4] });
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

// The drawn work (T.art): each piece as an architect's elevation or a photographer's comp of the room, in ink line on
// concrete and paper (a duotone from the member's ink and page, so a blue brand never tints the wall lavender). What
// it is comes from the piece's own title and note: a house, a gridded facade, a chapel, a lobby in one-point
// perspective, a row of townhouses. The portrait slot is the photographer's view camera on its tripod. No text.
const f1 = (n) => n.toFixed(1);

function rtKind(t) {
  if (/\b(chapel|church|restoration|cathedral|temple|mission)\b/.test(t)) return 'chapel';
  if (/\b(lobby|interior|interiors|hotel|restaurant|bar|kitchen|room|lounge)\b/.test(t)) return 'interior';
  if (/\b(street|townhouse|terrace|row|brownstone)\b/.test(t)) return 'row';
  if (/\b(house|home|residence|cabin|cottage|villa|barn)\b/.test(t)) return 'house';
  return 'grid';
}

function rotundaArt(s, { p, c, seed, index, art }) {
  if (!/^w\d+$|^portrait$/.test(s.slot)) return null;
  const { w, h } = s;
  const r = art.rng(`${seed}:rt:${s.slot}`);
  const paper = color.mix(p.paper, '#ffffff', 0.25);
  const sky = color.mix(paper, p.ink, 0.06);
  const conc = color.mix(paper, p.ink, 0.16);
  const side = color.mix(paper, p.ink, 0.32);
  const glass = color.mix(color.mix(p.ink, p.primary, 0.12), paper, 0.55);
  const ink = color.mix(p.ink, paper, 0.12);
  const sw = Math.max(1.6, w * 0.0026);
  const L = (o = 1, k = 1) => `fill="none" stroke="${ink}" stroke-width="${f1(sw * k)}" stroke-opacity="${o}" stroke-linejoin="round" stroke-linecap="round"`;
  const gy = h * (0.8 + r() * 0.06);
  const defs = `<filter id="rg${index}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="${index + 3}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter>` +
    `<linearGradient id="rs${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${paper}"/></linearGradient>`;
  let body = `<rect width="${w}" height="${h}" fill="url(#rs${index})"/><rect y="${f1(gy)}" width="${w}" height="${f1(h - gy)}" fill="${conc}"/><path d="M0 ${f1(gy)}H${w}" ${L(0.9)}/>`;
  // Windows: a grid of panes, glass with a mullion line, inside a box.
  const panes = (x, y, bw, bh, cols, rows, gap = 0.12) => {
    let o = '';
    const cw = bw / cols, rh = bh / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const px = x + i * cw + cw * gap / 2, py = y + j * rh + rh * gap / 2;
      o += `<rect x="${f1(px)}" y="${f1(py)}" width="${f1(cw * (1 - gap))}" height="${f1(rh * (1 - gap))}" fill="${glass}" ${L(0.8, 0.7).replace('fill="none" ', '')}/>`;
    }
    return o;
  };
  const t = s.piece || '';
  const kind = s.slot === 'portrait' ? 'camera' : rtKind(t);
  if (kind === 'house') {
    const bw = w * (0.62 + r() * 0.1), bx = (w - bw) / 2 + (r() - 0.5) * w * 0.08, bh = h * 0.28, by = gy - bh, rh = bw * (0.32 + r() * 0.12);
    body += `<path d="M${f1(bx)} ${f1(by)}L${f1(bx + bw / 2)} ${f1(by - rh)}L${f1(bx + bw)} ${f1(by)}Z" fill="${side}" ${L().replace('fill="none" ', '')}/>` +
      `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" fill="${conc}" ${L().replace('fill="none" ', '')}/>`;
    for (let i = 1; i < 14; i++) body += `<path d="M${f1(bx + (bw * i) / 14)} ${f1(by)}V${f1(gy)}" ${L(0.25, 0.6)}/>`;
    body += panes(bx + bw * 0.08, by + bh * 0.18, bw * 0.52, bh * 0.82, 4, 1, 0.06) + `<rect x="${f1(bx + bw * 0.72)}" y="${f1(by + bh * 0.3)}" width="${f1(bw * 0.14)}" height="${f1(bh * 0.7)}" fill="${side}" ${L().replace('fill="none" ', '')}/>` +
      panes(bx + bw * 0.4, by - rh * 0.55, bw * 0.2, rh * 0.4, 1, 1, 0.1);
  } else if (kind === 'grid') {
    const bw = w * (0.58 + r() * 0.12), bx = w * (0.12 + r() * 0.08), top = h * (0.12 + r() * 0.1), sd = w * 0.12, cols = 5 + Math.floor(r() * 3), rows = 6 + Math.floor(r() * 4);
    body += `<path d="M${f1(bx + bw)} ${f1(top)}L${f1(bx + bw + sd)} ${f1(top + sd * 0.4)}V${f1(gy)}H${f1(bx + bw)}Z" fill="${side}" ${L().replace('fill="none" ', '')}/>` +
      `<rect x="${f1(bx)}" y="${f1(top)}" width="${f1(bw)}" height="${f1(gy - top)}" fill="${conc}" ${L().replace('fill="none" ', '')}/>` +
      panes(bx + bw * 0.05, top + (gy - top) * 0.05, bw * 0.9, (gy - top) * 0.8, cols, rows, 0.18) +
      `<rect x="${f1(bx + bw * 0.3)}" y="${f1(gy - (gy - top) * 0.12)}" width="${f1(bw * 0.4)}" height="${f1((gy - top) * 0.12)}" fill="${glass}" ${L().replace('fill="none" ', '')}/>`;
    for (let j = 1; j < rows; j++) body += `<path d="M${f1(bx + bw)} ${f1(top + ((gy - top) * 0.85 * j) / rows)}l${f1(sd)} ${f1(sd * 0.4 * (1 - j / rows))}" ${L(0.35, 0.6)}/>`;
  } else if (kind === 'chapel') {
    const bw = w * 0.5, bx = (w - bw) / 2, bh = h * 0.32, by = gy - bh, rh = bw * 0.62;
    body += `<path d="M${f1(bx)} ${f1(by)}L${f1(bx + bw / 2)} ${f1(by - rh)}L${f1(bx + bw)} ${f1(by)}V${f1(gy)}H${f1(bx)}Z" fill="${conc}" ${L().replace('fill="none" ', '')}/>`;
    for (let j = 1; j < 9; j++) body += `<path d="M${f1(bx)} ${f1(by + (bh * j) / 9)}H${f1(bx + bw)}" ${L(0.22, 0.6)}/>`;
    const aw = bw * 0.3, ax = bx + (bw - aw) / 2, ay = by - rh * 0.35, ab = gy - bh * 0.25;
    body += `<path d="M${f1(ax)} ${f1(ab)}V${f1(ay + aw * 0.6)}Q${f1(ax)} ${f1(ay)} ${f1(ax + aw / 2)} ${f1(ay - aw * 0.3)}Q${f1(ax + aw)} ${f1(ay)} ${f1(ax + aw)} ${f1(ay + aw * 0.6)}V${f1(ab)}Z" fill="${glass}" ${L().replace('fill="none" ', '')}/>` +
      `<path d="M${f1(ax + aw / 2)} ${f1(ay - aw * 0.3)}V${f1(ab)}M${f1(ax)} ${f1(ay + aw * 0.9)}H${f1(ax + aw)}" ${L(0.8, 0.8)}/>` +
      `<rect x="${f1(bx + bw * 0.42)}" y="${f1(gy - bh * 0.22)}" width="${f1(bw * 0.16)}" height="${f1(bh * 0.22)}" fill="${side}" ${L().replace('fill="none" ', '')}/>` +
      `<path d="M${f1(bx + bw * 0.06)} ${f1(by)}V${f1(gy)}M${f1(bx + bw * 0.94)} ${f1(by)}V${f1(gy)}" ${L(0.6, 1.4)}/>`;
  } else if (kind === 'interior') {
    // One-point perspective: the back wall, floor and ceiling lines running to the vanishing point, columns, lamps.
    const vx = w * (0.45 + r() * 0.1), vy = h * 0.5, bwx = w * 0.26, bwy = h * 0.2;
    const bx0 = vx - bwx, bx1 = vx + bwx, by0 = vy - bwy, by1 = vy + bwy;
    body = `<rect width="${w}" height="${h}" fill="${conc}"/>` +
      `<path d="M0 ${f1(h)}L${f1(bx0)} ${f1(by1)}H${f1(bx1)}L${w} ${f1(h)}Z" fill="${color.mix(conc, paper, 0.45)}"/>` +
      `<path d="M0 0L${f1(bx0)} ${f1(by0)}H${f1(bx1)}L${w} 0Z" fill="${side}"/>` +
      `<rect x="${f1(bx0)}" y="${f1(by0)}" width="${f1(bx1 - bx0)}" height="${f1(by1 - by0)}" fill="${paper}" ${L().replace('fill="none" ', '')}/>` +
      panes(bx0 + (bx1 - bx0) * 0.1, by0 + (by1 - by0) * 0.12, (bx1 - bx0) * 0.8, (by1 - by0) * 0.88, 3, 1, 0.08) +
      `<path d="M0 0L${f1(bx0)} ${f1(by0)}M${w} 0L${f1(bx1)} ${f1(by0)}M0 ${f1(h)}L${f1(bx0)} ${f1(by1)}M${w} ${f1(h)}L${f1(bx1)} ${f1(by1)}" ${L()}/>`;
    for (let i = 1; i < 6; i++) body += `<path d="M${f1(vx + (i - 3) * w * 0.4)} ${f1(h)}L${f1(vx + ((i - 3) * (bx1 - bx0)) / 4.2)} ${f1(by1)}" ${L(0.25, 0.6)}/>`;
    [0.18, 0.34].forEach((k) => {
      for (const sgn of [-1, 1]) {
        const cx = vx + sgn * (w / 2) * (1 - k * 1.6), cw = w * 0.05 * (1 - k), top = h * k * 0.5, bot = h - h * k * 0.55;
        body += `<rect x="${f1(cx - cw / 2)}" y="${f1(top)}" width="${f1(cw)}" height="${f1(bot - top)}" fill="${paper}" ${L().replace('fill="none" ', '')}/>`;
      }
    });
    for (let i = 0; i < 3; i++) { const lx = vx + (i - 1) * w * 0.14, ly = h * (0.2 + i * 0.03); body += `<path d="M${f1(lx)} ${f1(by0 * 0.4)}V${f1(ly)}" ${L(0.8, 0.6)}/><path d="M${f1(lx - w * 0.03)} ${f1(ly + h * 0.02)}L${f1(lx)} ${f1(ly)}L${f1(lx + w * 0.03)} ${f1(ly + h * 0.02)}Z" fill="${ink}"/>`; }
  } else if (kind === 'row') {
    let x = w * 0.04;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const bw = (w * 0.92) / n, bh = h * (0.42 + r() * 0.14), by = gy - bh, tone = i % 2 ? side : conc;
      body += `<rect x="${f1(x)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" fill="${tone}" ${L().replace('fill="none" ', '')}/>` +
        `<rect x="${f1(x - bw * 0.02)}" y="${f1(by - bh * 0.03)}" width="${f1(bw * 1.04)}" height="${f1(bh * 0.03)}" fill="${ink}"/>` +
        panes(x + bw * 0.14, by + bh * 0.1, bw * 0.72, bh * 0.56, 2, 3, 0.3) +
        `<rect x="${f1(x + bw * 0.38)}" y="${f1(gy - bh * 0.22)}" width="${f1(bw * 0.24)}" height="${f1(bh * 0.22)}" fill="${glass}" ${L().replace('fill="none" ', '')}/>` +
        `<path d="M${f1(x + bw * 0.3)} ${f1(gy)}h${f1(bw * 0.4)}M${f1(x + bw * 0.33)} ${f1(gy - bh * 0.03)}h${f1(bw * 0.34)}" ${L(0.9)}/>`;
      x += bw;
    }
  } else {
    // The view camera on its tripod, facing a building across the floor.
    body = `<rect width="${w}" height="${h}" fill="url(#rs${index})"/><rect y="${f1(gy)}" width="${w}" height="${f1(h - gy)}" fill="${conc}"/><path d="M0 ${f1(gy)}H${w}" ${L(0.9)}/>` +
      `<rect x="${f1(w * 0.62)}" y="${f1(h * 0.22)}" width="${f1(w * 0.3)}" height="${f1(gy - h * 0.22)}" fill="${conc}" ${L(0.5).replace('fill="none" ', '')}/>` + panes(w * 0.64, h * 0.25, w * 0.26, gy - h * 0.3, 3, 6, 0.25);
    const cx = w * 0.36, cy = h * 0.46, cw = w * 0.34, ch = h * 0.16;
    body += `<path d="M${f1(cx)} ${f1(cy + ch * 0.6)}L${f1(cx - w * 0.16)} ${f1(gy + h * 0.05)}M${f1(cx)} ${f1(cy + ch * 0.6)}L${f1(cx + w * 0.02)} ${f1(gy + h * 0.08)}M${f1(cx)} ${f1(cy + ch * 0.6)}L${f1(cx + w * 0.17)} ${f1(gy + h * 0.04)}" ${L(1, 1.6)}/>` +
      `<rect x="${f1(cx - cw * 0.5)}" y="${f1(cy)}" width="${f1(cw * 0.26)}" height="${f1(ch)}" fill="${ink}"/>` +
      `<path d="M${f1(cx - cw * 0.24)} ${f1(cy)}L${f1(cx + cw * 0.28)} ${f1(cy + ch * 0.18)}V${f1(cy + ch * 0.82)}L${f1(cx - cw * 0.24)} ${f1(cy + ch)}Z" fill="${side}" ${L().replace('fill="none" ', '')}/>`;
    for (let i = 1; i < 6; i++) { const xx = cx - cw * 0.24 + (cw * 0.52 * i) / 6; body += `<path d="M${f1(xx)} ${f1(cy + ch * 0.18 * (i / 6))}V${f1(cy + ch - ch * 0.18 * (i / 6))}" ${L(0.5, 0.6)}/>`; }
    body += `<rect x="${f1(cx + cw * 0.28)}" y="${f1(cy + ch * 0.12)}" width="${f1(cw * 0.12)}" height="${f1(ch * 0.76)}" fill="${ink}"/><rect x="${f1(cx - cw * 0.08)}" y="${f1(cy + ch * 0.54)}" width="${f1(cw * 0.16)}" height="${f1(ch * 0.1)}" fill="${ink}"/>`;
  }
  body += `<rect width="${w}" height="${h}" filter="url(#rg${index})"/>`;
  return art.svgDoc(w, h, defs, body);
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
  const fs = Math.min(14, 222 / Math.max(one ? len : best.worst, 4)).toFixed(2);
  const fsm = Math.min(24, 206 / Math.max(best.worst, 4)).toFixed(2);
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
<div class="rt-scene" data-alive="0.45"><ul class="rt-ring">${cards.join('')}</ul></div>
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
<div class="rt-about-copy"><h2 class="sr-only" id="about-title">About ${esc(person || c.name)}</h2>
${c.aboutParas.map((p, i) => `<p class="rt-p${i === 0 ? ' first' : ''}" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c, { cls: 'rt-soc' })}</div></div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="rt-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">Kind words</h2><div class="rt-quotes">${c.reviews.map((r, i) => `<figure class="rt-q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const faq = c.faq.length >= 2 ? `<section class="rt-sec" id="faq" aria-labelledby="faq-title"><div class="wrap rt-faq"><h2 class="rt-h2" id="faq-title" data-split>Good to know</h2><dl class="rt-qa" data-rv style="--d:1">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const types = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const fields = ['name', 'email', { ...P.FIELD_PRESETS.company, label: 'Business or brand' }, types || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' }, types ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null, { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true }].filter(Boolean);
  const contact = `<section class="rt-sec rt-contact" id="contact" aria-labelledby="contact-title"><div class="wrap"><h2 class="rt-h2 big" id="contact-title" data-split>${esc(c.ctaTitle)}</h2></div><div class="wrap rt-contact-grid">
<div>
${c.ctaSub ? `<p class="rt-p" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="rt-p" data-rv style="--d:4">${esc(c.promise)}</p>` : ''}
${c.booking ? `<div class="rt-book" data-rv style="--d:5">${mag(P.button(c.primary, 'btn btn-primary btn-lg', 'calendar'))}</div>` : ''}
<div data-rv style="--d:5">${P.contactList(c)}</div></div>
<div class="rt-form" data-rv style="--d:2">${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}</div>
</div></section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'rt-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, cases, clients, services, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
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
${FOOTER_CSS}
:root{--ease:cubic-bezier(.16,1,.3,1)}
body{--edge:color-mix(in srgb,var(--ink) 13%,transparent)}
h1,h2,h3{font-weight:500;letter-spacing:-.035em}
.btn{font-weight:500}
.btn:hover{transform:none}
.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.rt-n{font-family:var(--font-display);font-size:.85rem;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:0;color:var(--muted)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:500;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.4rem 0;font-size:.92rem;text-decoration:none;color:var(--muted);background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-cta{min-height:2.5rem;padding:.45rem 1.1rem;font-size:.9rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.rt-hero{padding-top:clamp(2rem,1.5rem + 3vw,4.5rem)}
.rt-name{font-size:clamp(2.6rem,var(--fsm),9rem);font-weight:500;line-height:.9;letter-spacing:-.065em;padding-bottom:.06em}
.nl{display:block;white-space:nowrap}
@media (min-width:48rem){.rt-name{font-size:clamp(3.5rem,var(--fs),15rem)}.rt-name.one .nl{display:inline}}
.rt-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
@media (min-width:56rem){.rt-row{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-lead{grid-column:1/7}.rt-side{grid-column:9/13}}
.rt-lead{max-width:36rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.rt-side{display:grid;gap:1.25rem;justify-items:start}
.rt-label{display:grid;margin:0;width:100%;max-width:22rem;padding-top:.75rem;border-top:1px solid var(--ink);font-size:.9rem;line-height:1.5;color:var(--muted)}
.rt-gal{padding-block:clamp(2.5rem,2rem + 3vw,5rem)}
.rt-ring{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem .75rem;width:min(100% - 2rem,var(--max));margin-inline:auto}
@media (min-width:48rem){.rt-ring{grid-template-columns:repeat(4,minmax(0,1fr));gap:2.5rem 1.5rem;width:min(100% - 4rem,var(--max))}}
.rt-card.dup{display:none}
.rt-in{display:block;text-decoration:none;color:inherit}
.rt-ph{display:block;overflow:hidden;aspect-ratio:4/5;background:var(--surface);outline:1px solid transparent;outline-offset:6px;transition:outline-color .4s ease}
.rt-ph img{width:100%;height:100%;object-fit:cover;pointer-events:none}
.rt-cap{display:flex;gap:.8rem;align-items:baseline;padding-top:.7rem}
.rt-t{font-family:var(--font-display);font-weight:500;letter-spacing:-.02em}
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
html.m .rt-card,html.m .rt-card.dup{display:block;position:absolute;left:0;top:0;width:clamp(15rem,22vw,22rem);backface-visibility:hidden;transform-style:preserve-3d}
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
.rt-cl li{flex:1 1 14rem;padding:1rem 1.5rem 1rem 0;border-bottom:1px solid var(--edge);font-family:var(--font-display);font-size:clamp(1.4rem,1.1rem + 1.2vw,2.2rem);font-weight:500;letter-spacing:-.035em}
.rt-svc-grid,.rt-about-grid,.rt-contact-grid,.rt-faq{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.rt-svc-grid,.rt-faq{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-svc-grid>div:first-child,.rt-faq>.rt-h2{grid-column:1/6}.rt-svc-grid>div:last-child,.rt-faq>div{grid-column:7/13}.rt-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.rt-about-media{grid-column:1/6}.rt-about-copy{grid-column:7/12}.rt-contact-grid{grid-template-columns:1fr 1fr;align-items:start}}
.rt-svc{border-top:1px solid var(--ink)}
.rt-svc li{display:grid;grid-template-columns:2.5rem 1fr auto;gap:.3rem 1.5rem;align-items:baseline;padding:1.3rem 0;border-bottom:1px solid var(--edge)}
.rt-svc h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem)}
.rt-svc p{grid-column:2;color:var(--muted)}
.rt-svc strong{grid-column:3;grid-row:1;font-family:var(--font-display);font-size:1.3rem;font-weight:500;font-variant-numeric:tabular-nums}
.rt-incl{margin-top:2.5rem}
.rt-incl h3{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:0}
.rt-incl ul{margin-top:.75rem;border-top:1px solid var(--edge)}
.rt-incl li{padding:.6rem 0;border-bottom:1px solid var(--edge)}
.rt-about-media{margin:0}
.rt-about-media>div{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.rt-about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.rt-about-media figcaption{padding-top:.7rem;font-size:.9rem;color:var(--muted)}
.rt-h2{font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);line-height:.98;letter-spacing:-.05em}
.rt-h2.big{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem)}
.rt-p{margin-top:1.1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.rt-p.first{font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.7rem);line-height:1.3;letter-spacing:-.025em;color:var(--ink)}
.rt-soc{margin-top:1.5rem}
.socials a{border-width:1px;border-radius:0}
.rt-quotes{display:grid;border-top:1px solid var(--ink)}
.rt-q{display:grid;gap:.75rem;padding-block:clamp(1.5rem,1rem + 2vw,2.75rem);border-bottom:1px solid var(--edge)}
.rt-q blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);line-height:1.12;letter-spacing:-.035em}
.rt-q figcaption{color:var(--muted)}
.rt-contact{border-top:1px solid var(--ink)}
.rt-contact-grid{margin-top:clamp(2rem,1.5rem + 2vw,3.5rem)}
@media (min-width:56rem){.rt-contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.rt-contact-grid>div:first-child{grid-column:1/5}.rt-form{grid-column:6/13}}
.rt-book{margin-top:2rem}
.rt-contact .contact-list{margin-top:1.5rem}
.rt-form .form{gap:0;border-top:1px solid var(--ink)}
.rt-form .field{display:grid;gap:.25rem 1.5rem;padding:.9rem 0;border-bottom:1px solid var(--edge)}
@media (min-width:40rem){.rt-form .field{grid-template-columns:11rem 1fr;align-items:baseline}}
.rt-form .field label{font-size:.92rem;font-weight:600}
.field input,.field select,.field textarea{min-height:2.6rem;border:0;border-radius:0;background-color:transparent;padding:.4rem 0}
.field textarea{min-height:7rem}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1px 0 var(--ink)}
.rt-form .btn{margin-top:1.5rem;width:100%;min-height:3.4rem}
.rt-qa{display:grid;margin:0;border-top:1px solid var(--ink)}
.rt-qa>div{display:grid;gap:.35rem;padding:1.1rem 0 1.3rem;border-bottom:1px solid var(--edge)}
.rt-qa dt{font-family:var(--font-display);font-size:1.25rem;font-weight:500;letter-spacing:-.02em}
.rt-qa dd{margin:0;color:var(--muted)}
.menu-panel{border-bottom:1px solid var(--ink)}
.menu-panel li a{font-size:2rem;font-weight:500;letter-spacing:-.045em;padding:1rem 0}
.menu-panel .btn{border-radius:0}
.ftr{border-top:1px solid var(--ink)}
.ftr-name{font-family:var(--font-display);font-size:clamp(1.8rem,1.4rem + 1.6vw,2.8rem);font-weight:500;letter-spacing:-.05em;line-height:1}
.ftr-base{border-top:1px solid var(--edge)}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.2rem 0;font-weight:500}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.2rem}
.mbar{box-shadow:none}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Rotunda',
  bestFor: 'Architects, interior and product photographers, illustrators and studios with a body of work to walk through',
  match: /\b(architects?|architecture|architectural|interiors?|interior design(er)?|illustrat(or|ors|ion)|3d artists?|motion design(er)?|art direct(or|ion)|set design(er)?)\b/,
  why: 'Built to walk through your work: your name rises out of the rule, then your pieces, drawn as the buildings and rooms they are, stand on a curved wall around the viewer that turns as you scroll or drag; each opens its own case study, and the project form is set like a loan form.',
  fonts: { q: 'family=Hanken+Grotesk:wght@400;500;600;700', display: ['Hanken Grotesk', 'grotesk'], body: ['Hanken Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the name rising out of its rule, a wall of work that leans your way; the
  // ring's own script turns the cylinder with the pinned scroll (pin).
  choreo: { intro: 'mask', alive: ['pointer', 'drift'], scroll: 'pin', pace: 'medium', look: 'gallery plaster in daylight, quiet, precise' },
  art: rotundaArt,
  tokens,
  slots,
  nav,
  render,
};
