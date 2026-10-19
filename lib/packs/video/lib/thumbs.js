// Thumbnails drawn as SVG and rendered with librsvg (through media.svgToPng, so the kit's Inter is
// used): three designs, wide (1920 x 1080, YouTube) and tall (1080 x 1920, Shorts, Reels and TikTok
// covers). Big words, one of them in the pop color, the member's photo or a frame of their video
// when they gave one. The bottom right of a wide thumbnail stays clear: YouTube puts the length there.

const { media, color } = require('../../_kit');

const DESIGNS = [
  { id: 'photo', label: 'Full photo' },
  { id: 'split', label: 'Split' },
  { id: 'block', label: 'Color block' },
];
const SIZES = { wide: [1920, 1080], tall: [1080, 1920] };
const SKIP = /^(the|a|an|and|or|of|to|in|on|for|with|your|you|this|that|is|are|it|its|how|why|what|my|our|at|by|from|be|do|does|can|i|we|was|not)$/i;

const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The words to show, uppercase, and which one gets the color: a number first, else the longest
// word that isn't a filler.
function wordsOf(str) {
  const words = String(str || '').replace(/[“”"]/g, '').split(/\s+/).filter(Boolean).slice(0, 10).map((w) => w.toUpperCase());
  let key = -1;
  let len = 0;
  words.forEach((w, i) => {
    const c = w.replace(/[^A-Z0-9$%]/g, '');
    if (/\d/.test(c)) {
      if (key === -1 || !/\d/.test(words[key])) {
        key = i;
        len = 99;
      }
      return;
    }
    if (!SKIP.test(c) && c.length > len) {
      key = i;
      len = c.length;
    }
  });
  return { words, key };
}

const tw = (s, size) => media.textWidth(s, size, { weight: 900 });

function wrap(words, size, maxW) {
  const lines = [];
  let cur = [];
  words.forEach((w, i) => {
    const next = [...cur.map((x) => x.w), w].join(' ');
    if (cur.length && tw(next, size) > maxW) {
      lines.push(cur);
      cur = [{ w, i }];
    } else cur.push({ w, i });
  });
  if (cur.length) lines.push(cur);
  return lines;
}

// The biggest size at which the words fit the box in maxLines lines.
function fit(words, { maxW, maxH, maxLines = 3, max = 230, min = 80, lh = 1.02 }) {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrap(words, size, maxW);
    if (lines.length <= maxLines && lines.length * size * lh <= maxH && lines.every((l) => tw(l.map((x) => x.w).join(' '), size) <= maxW)) return { size, lines, lh };
  }
  return { size: min, lines: wrap(words, min, maxW).slice(0, maxLines), lh };
}

// The big words as SVG. align 'start' (x is the left edge) or 'middle' (x is the center); top is
// where the first line's capitals start. keyStyle: 'fill' (the word in the pop color) or 'box'
// (the word on a box). Returns { svg, height }.
function bigText({ fitted, key, x, top, align = 'start', ink = '#ffffff', pop, boxFill, boxInk, stroke, strokeW = 0, shadow = true }) {
  const { size, lines, lh } = fitted;
  const lineH = size * lh;
  const cap = size * 0.727;
  const space = tw(' ', size) + size * 0.02;
  let out = '';
  lines.forEach((line, li) => {
    const widths = line.map((x) => tw(x.w, size));
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let cx = align === 'middle' ? x - total / 2 : x;
    const base = top + li * lineH + cap;
    line.forEach((wd, k) => {
      const isKey = wd.i === key;
      if (isKey && boxFill) {
        const padX = size * 0.12;
        out += `<rect x="${r1(cx - padX)}" y="${r1(base - cap - size * 0.13)}" width="${r1(widths[k] + padX * 2)}" height="${r1(cap + size * 0.26)}" rx="${r1(size * 0.12)}" fill="${boxFill}"${shadow ? ' filter="url(#sh)"' : ''}/>`;
      }
      const fill = isKey ? (boxFill ? boxInk : pop) : ink;
      const st = stroke && !(isKey && boxFill) ? ` stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" paint-order="stroke"` : '';
      out += `<text x="${r1(cx)}" y="${r1(base)}" font-family="Inter" font-weight="900" font-size="${size}" fill="${fill}"${st}${shadow && !st && !(isKey && boxFill) ? ' filter="url(#sh)"' : ''}>${esc(wd.w)}</text>`;
      cx += widths[k] + space;
    });
  });
  return { svg: out, height: lines.length * lineH };
}

// A small label (the kicker) on a pill.
function pill({ label, x, y, size, fill, ink, align = 'start' }) {
  const t = String(label || '').toUpperCase();
  if (!t) return { svg: '', height: 0 };
  const ls = size * 0.12;
  const w = media.textWidth(t, size, { weight: 800 }) + ls * t.length + size * 1.4;
  const h = size * 1.9;
  const x0 = align === 'middle' ? x - w / 2 : x;
  return {
    svg: `<rect x="${r1(x0)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(h / 2)}" fill="${fill}"/><text x="${r1(x0 + w / 2)}" y="${r1(y + h / 2 + size * 0.36)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="${r1(ls)}" fill="${ink}">${esc(t)}</text>`,
    height: h,
  };
}

const DEFS = `<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dx="0" dy="7" result="b"/><feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>`;

function photo(img, { x = 0, y = 0, w, h, clip }) {
  if (!img) return '';
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"${clip ? ` clip-path="url(#${clip})"` : ''} href="data:image/jpeg;base64,${img.toString('base64')}"/>`;
}

// Soft light shapes in the brand colors, for designs with no photo.
function glowArt({ W, H, look, cx, cy, r }) {
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${look.glow}" opacity="0.55" filter="url(#soft)"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.62)}" fill="none" stroke="${look.pop}" stroke-width="${r1(Math.min(W, H) * 0.012)}" opacity="0.5"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.9)}" fill="none" stroke="#ffffff" stroke-width="${r1(Math.min(W, H) * 0.004)}" opacity="0.25"/>`;
}

// One design at one shape. Returns an SVG string. img: a JPEG Buffer or null.
function design(id, shape, { words, key, sub, img, look }) {
  const [W, H] = SIZES[shape] || SIZES.wide;
  const wide = W > H;
  const u = Math.min(W, H) / 1080;
  const m = wide ? 90 : 80;
  let body = '';
  let defs = DEFS;
  const kicker = (x, y, align) => pill({ label: sub, x, y, size: 34 * u, fill: look.pop, ink: look.onPop || '#0b0b10', align });
  if (id === 'photo') {
    defs += `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${look.mid}"/><stop offset="1" stop-color="${look.deep}"/></linearGradient>`;
    defs += wide
      ? `<linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.86"/><stop offset="0.48" stop-color="#000" stop-opacity="0.5"/><stop offset="0.78" stop-color="#000" stop-opacity="0"/></linearGradient>`
      : `<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.82"/><stop offset="0.5" stop-color="#000" stop-opacity="0.35"/><stop offset="0.75" stop-color="#000" stop-opacity="0"/></linearGradient>`;
    body += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    body += img ? photo(img, { w: W, h: H }) : glowArt({ W, H, look, cx: wide ? W * 0.78 : W * 0.6, cy: wide ? H * 0.42 : H * 0.72, r: wide ? 430 : 520 });
    body += `<rect width="${W}" height="${H}" fill="url(#scrim)"/>`;
    const fitted = fit(words, wide ? { maxW: 1080, maxH: 640, maxLines: 3, max: 230 } : { maxW: W - 2 * m, maxH: 780, maxLines: 4, max: 210 });
    // Tall covers keep the words below the top eighth: profile grids crop the top and bottom.
    const k = sub ? kicker(wide ? m : W / 2, wide ? 110 : 300, wide ? 'start' : 'middle') : { svg: '', height: 0 };
    const top = wide ? Math.max(110 + k.height + 46, (H - fitted.lines.length * fitted.size * fitted.lh) / 2 - 20) : 300 + (k.height ? k.height + 50 : 0);
    body += k.svg + bigText({ fitted, key, x: wide ? m : W / 2, top, align: wide ? 'start' : 'middle', ink: '#ffffff', boxFill: look.box, boxInk: look.onBox, stroke: '#0b0b10', strokeW: r1(fitted.size * 0.07) }).svg;
  } else if (id === 'split') {
    // With no photo the words get more of the frame.
    const [c0, c1] = wide ? (img ? [0.47, 0.39] : [0.66, 0.58]) : img ? [0.53, 0.45] : [0.68, 0.62];
    const cut = wide ? `${r1(W * c0)},0 ${W},0 ${W},${H} ${r1(W * c1)},${H}` : `0,${r1(H * c0)} ${W},${r1(H * c1)} ${W},${H} 0,${H}`;
    const edge = wide ? `${r1(W * c0 - 16)},0 ${r1(W * c0)},0 ${r1(W * c1)},${H} ${r1(W * c1 - 16)},${H}` : `0,${r1(H * c0 - 16)} ${W},${r1(H * c1 - 16)} ${W},${r1(H * c1)} 0,${r1(H * c0)}`;
    defs += `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.mid}"/><stop offset="1" stop-color="${look.deep}"/></linearGradient><clipPath id="cut"><polygon points="${cut}"/></clipPath>`;
    body += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    body += img ? photo(img, { w: W, h: H, clip: 'cut' }) : `<g clip-path="url(#cut)"><rect width="${W}" height="${H}" fill="${look.deep}"/>${glowArt({ W, H, look, cx: wide ? W * 0.86 : W * 0.5, cy: wide ? H * 0.5 : H * 0.86, r: wide ? 250 : 260 })}</g>`;
    body += `<polygon points="${edge}" fill="${look.pop}"/>`;
    const k = sub ? kicker(wide ? m : W / 2, wide ? 100 : 300, wide ? 'start' : 'middle') : { svg: '', height: 0 };
    const fitted = fit(words, wide ? { maxW: W * (Math.min(c0, c1) - 0.03) - m, maxH: 760, maxLines: 4, max: 220 } : { maxW: W - 2 * m, maxH: H * Math.min(c0, c1) - 380 - (k.height ? k.height + 46 : 0), maxLines: 4, max: 200 });
    const blockH = fitted.lines.length * fitted.size * fitted.lh;
    const top = wide ? Math.max(100 + k.height + 44, (H - blockH) / 2 - 10) : 300 + (k.height ? k.height + 46 : 0);
    body += k.svg + bigText({ fitted, key, x: wide ? m : W / 2, top, align: wide ? 'start' : 'middle', ink: '#ffffff', pop: look.pop }).svg;
  } else {
    // Color block: the brand color, the words in its readable ink, the key word on a dark box, and
    // the photo as a tilted print.
    const ink = look.onBox;
    defs += `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.box}"/><stop offset="1" stop-color="${color.darken(look.box, 0.18)}"/></linearGradient>`;
    body += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    const card = wide ? { x: 1190, y: 150, w: 630, h: 630, rot: 4 } : { x: 160, y: 1060, w: 760, h: 700, rot: -3 };
    if (img) {
      defs += `<clipPath id="card"><rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="${r1(22 * u)}"/></clipPath>`;
      const cx = card.x + card.w / 2;
      const cy = card.y + card.h / 2;
      body += `<g transform="rotate(${card.rot} ${cx} ${cy})"><rect x="${card.x - 16}" y="${card.y - 16}" width="${card.w + 32}" height="${card.h + 32}" rx="${r1(30 * u)}" fill="#ffffff" filter="url(#sh)"/>${photo(img, { x: card.x, y: card.y, w: card.w, h: card.h, clip: 'card' })}</g>`;
    } else {
      body += `<circle cx="${wide ? 1560 : W / 2}" cy="${wide ? 470 : 1450}" r="${wide ? 330 : 380}" fill="none" stroke="${ink}" stroke-width="${r1(26 * u)}" opacity="0.14"/><circle cx="${wide ? 1560 : W / 2}" cy="${wide ? 470 : 1450}" r="${wide ? 190 : 220}" fill="${ink}" opacity="0.1"/>`;
    }
    const k = sub ? pill({ label: sub, x: wide ? m : W / 2, y: wide ? 100 : 300, size: 34 * u, fill: look.deep, ink: '#ffffff', align: wide ? 'start' : 'middle' }) : { svg: '', height: 0 };
    const fitted = fit(words, wide ? { maxW: 1000, maxH: 720, maxLines: 4, max: 210 } : { maxW: W - 2 * m, maxH: 680 - (k.height ? k.height + 46 : 0), maxLines: 4, max: 200 });
    const blockH = fitted.lines.length * fitted.size * fitted.lh;
    const top = wide ? Math.max(100 + k.height + 44, (H - blockH) / 2 - 10) : 300 + (k.height ? k.height + 46 : 0);
    body += k.svg + bigText({ fitted, key, x: wide ? m : W / 2, top, align: wide ? 'start' : 'middle', ink, boxFill: look.deep, boxInk: '#ffffff', shadow: false }).svg;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
}

// The page that shows every design side by side and at phone size. tiles: [{ label, wideBig,
// wideSmall, tallBig, tallSmall }] as PNG Buffers already scaled to SHEET sizes for the shape.
const SHEET = {
  wide: { big: [600, 338], small: [300, 169] },
  tall: { big: [360, 640], small: [120, 213] },
  both: { big: [600, 338], small: [300, 169], tall: [270, 480] },
};

function sheetSvg({ title, tiles, look, shape = 'wide' }) {
  const S = SHEET[shape] || SHEET.wide;
  const W = 2000;
  const pad = 70;
  const colW = (W - pad * 2 - 60) / 3;
  const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  const label = (x, y, t, size = 28, weight = 700, fill = '#111827') => `<text x="${r1(x)}" y="${r1(y)}" font-family="Inter" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(t)}</text>`;
  let y = 210;
  let body = '';
  const big = S.big;
  const isTall = shape === 'tall';
  tiles.forEach((t, i) => {
    const x = pad + i * (colW + 30);
    const pick = i === 0;
    body += label(x, y - 24, `${i + 1}. ${t.label}${pick ? ' (top pick)' : ''}`);
    body += `<rect x="${r1(x - 4)}" y="${r1(y - 4)}" width="${big[0] + 8}" height="${big[1] + 8}" rx="12" fill="${pick ? look.pop : '#d1d5db'}"/>`;
    body += `<image x="${r1(x)}" y="${y}" width="${big[0]}" height="${big[1]}" href="${b64(isTall ? t.tallBig : t.wideBig)}"/>`;
    if (isTall) {
      const sx = x + big[0] + 24;
      body += `<image x="${r1(sx)}" y="${y + big[1] - S.small[1]}" width="${S.small[0]}" height="${S.small[1]}" href="${b64(t.tallSmall)}"/>`;
      body += label(sx, y + big[1] - S.small[1] - 46, 'At phone size', 22, 600, '#374151') + label(sx, y + big[1] - S.small[1] - 16, 'in a profile grid', 20, 500, '#6b7280');
    }
  });
  y += big[1] + 60;
  if (!isTall) {
    tiles.forEach((t, i) => {
      const x = pad + i * (colW + 30);
      body += `<image x="${r1(x)}" y="${y}" width="${S.small[0]}" height="${S.small[1]}" href="${b64(t.wideSmall)}"/>`;
      body += label(x + S.small[0] + 22, y + 44, 'At phone size', 24, 600, '#374151') + label(x + S.small[0] + 22, y + 78, 'as in search results', 22, 500, '#6b7280');
    });
    y += S.small[1] + 60;
  }
  if (S.tall) {
    body += label(pad, y + 6, 'Tall covers (Shorts, Reels, TikTok)', 28, 700);
    y += 40;
    tiles.forEach((t, i) => {
      const x = pad + i * (colW + 30);
      body += `<image x="${r1(x)}" y="${y}" width="${S.tall[0]}" height="${S.tall[1]}" href="${b64(t.tallBig)}"/>`;
    });
    y += S.tall[1] + 50;
  }
  const H = Math.round(y + 20);
  const head = `<rect width="${W}" height="${H}" fill="#f3f4f6"/>${label(pad, 92, `Thumbnails: ${String(title).slice(0, 70)}`, 46, 800)}${label(pad, 146, 'Pick the one you can still read at phone size. Every design, full size, is in the zip.', 28, 500, '#4b5563')}`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${head}${body}</svg>`, W, H };
}

// A set of covers side by side, the way they sit in a profile grid or a channel page. tiles:
// [{ png, label }] with each PNG already scaled to gridTile(shape). Returns { svg, W, H }.
function gridTile(shape = 'tall') {
  const tall = shape === 'tall';
  const cols = tall ? 5 : 3;
  const cw = Math.floor((2000 - 140 - 30 * (cols - 1)) / cols);
  return { cols, w: cw, h: Math.round(tall ? (cw * 16) / 9 : (cw * 9) / 16) };
}

function gridSvg({ title, tiles, shape = 'tall' }) {
  const W = 2000;
  const pad = 70;
  const { cols, w, h } = gridTile(shape);
  const rows = Math.ceil(tiles.length / cols);
  const top = 190;
  const rowH = h + 96;
  const label = (x, y, t, size = 26, weight = 700, fill = '#111827') => `<text x="${r1(x)}" y="${r1(y)}" font-family="Inter" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(t)}</text>`;
  let body = '';
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * (w + 30);
    const y = top + Math.floor(i / cols) * rowH;
    body += `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${t.png.toString('base64')}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#d1d5db" stroke-width="2"/>`;
    const max = shape === 'tall' ? 24 : 44;
    const lines = [];
    for (const word of `${i + 1}. ${t.label || ''}`.split(/\s+/)) {
      if (lines.length && `${lines[lines.length - 1]} ${word}`.length <= max) lines[lines.length - 1] += ` ${word}`;
      else lines.push(word);
    }
    lines.slice(0, 2).forEach((l, k) => (body += label(x, y + h + 36 + k * 28, l, 22, 700, '#374151')));
  });
  const H = Math.round(top + rows * rowH + 20);
  const head = `<rect width="${W}" height="${H}" fill="#f3f4f6"/>${label(pad, 92, /cover/i.test(String(title)) ? String(title).slice(0, 70) : `Covers: ${String(title).slice(0, 70)}`, 46, 800)}${label(pad, 146, `${tiles.length} covers side by side, the way they sit on your profile. Every one, full size, is in the zip.`, 28, 500, '#4b5563')}`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${head}${body}</svg>`, W, H };
}

module.exports = { DESIGNS, SIZES, SHEET, wordsOf, fit, wrap, design, sheetSvg, gridTile, gridSvg };
