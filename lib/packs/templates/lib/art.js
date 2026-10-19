// Pictures for the templates pack, drawn as SVG from the template's own spec (rendered to PNG with
// media.svgToPng): the listing mockup, three Pinterest pins (2:3, 1000 x 1500) and a bundle mockup.
// Nothing here is a photo or someone else's design.

const { svg, text, color } = require('../../_kit');

// Cut a label so it fits a width (svg.textWidth runs a little narrow for bold text, so leave room).
function fitLabel(label, maxW, size, weight) {
  const t = String(label || '');
  if (svg.textWidth(t, size, weight) * 1.12 <= maxW) return t;
  let cut = t;
  while (cut.length > 3 && svg.textWidth(`${cut}...`, size, weight) * 1.12 > maxW) cut = cut.slice(0, -1);
  return `${cut.trim()}...`;
}

// A white "sheet" showing the template's real columns and first rows. Columns with formulas are
// tinted and say "fills in". Templates whose rows start blank show their example rows instead, so
// the picture shows how it is used (the files the buyer gets stay blank).
function sheetCard(spec, pal, { x, y, w, h, cols = 5, rows = 6, size = 26, shadow = true }) {
  const n = spec.columns.length;
  // Narrow cards keep the first formula column in view: it is what the buyer pays for.
  const firstF = Object.keys(spec.f || {}).map(Number).sort((a, b) => a - b)[0];
  const idx = spec.wide
    ? [...[0, 1, 2, 3, 4].slice(0, Math.max(2, cols - 1)), n - 2]
    : cols < n && firstF != null && firstF >= cols
      ? [...spec.columns.slice(0, cols - 1).map((_, j) => j), firstF]
      : spec.columns.slice(0, cols).map((_, j) => j);
  // The first column is as wide as its longest label needs, within limits.
  const labels = [...spec.rows.slice(0, rows), ...(spec.example || []).map((r) => r[0])].filter(Boolean);
  const need = labels.length ? Math.max(...labels.map((l) => svg.textWidth(String(l), size, 600) * 1.12)) + size * 1.4 : w * 0.3;
  const firstW = idx.length >= 5 ? Math.max(w * 0.2, Math.min(w * 0.34, need)) : idx.length >= 3 ? Math.max(w * 0.26, Math.min(w * 0.4, need)) : w * 0.5;
  const restW = (w - firstW) / Math.max(1, idx.length - 1);
  const xs = idx.map((_, k) => (k === 0 ? x : x + firstW + (k - 1) * restW));
  const ws = idx.map((_, k) => (k === 0 ? firstW : restW));
  const formula = new Set(Object.keys(spec.f || {}).map(Number));
  const tint = color.lighten(pal.primary, 0.86);
  const headH = Math.round(size * 2.6);
  const rowH = (h - headH) / rows;
  const id = `c${Math.round(x)}x${Math.round(y)}`;
  const out = [];
  if (shadow) out.push(svg.rect({ x: x + 10, y: y + 14, w, h, r: 22, fill: '#000000', opacity: 0.1 }));
  out.push(svg.rect({ x, y, w, h, r: 22, fill: '#ffffff' }));
  out.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/></clipPath>`);
  const inner = [];
  inner.push(svg.rect({ x, y, w, h: headH, fill: pal.primary }));
  idx.forEach((j, k) => {
    if (formula.has(j)) inner.push(svg.rect({ x: xs[k], y: y + headH, w: ws[k], h: h - headH, fill: tint }));
    inner.push(svg.text({ x: xs[k] + size * 0.6, y: y + headH / 2 + size * 0.36, lines: [fitLabel(spec.columns[j], ws[k] - size * 0.9, size, 700)], size, weight: 700, fill: pal.onPrimary }));
  });
  for (let i = 0; i < rows; i++) {
    const ry = y + headH + i * rowH;
    if (i % 2 === 1) inner.push(svg.rect({ x, y: ry, w: firstW, h: rowH, fill: pal.surface }));
    const ex = (spec.example || [])[i];
    const label = spec.rows[i] || (ex && ex[0]) || '';
    if (label) inner.push(svg.text({ x: x + size * 0.6, y: ry + rowH / 2 + size * 0.36, lines: [fitLabel(label, firstW - size * 0.9, size, 600)], size, weight: 600, fill: pal.ink }));
    if (ex) idx.forEach((j, k) => {
      if (k > 0 && ex[j]) inner.push(svg.text({ x: xs[k] + size * 0.6, y: ry + rowH / 2 + size * 0.36, lines: [fitLabel(ex[j], ws[k] - size * 0.9, size, formula.has(j) ? 700 : 500)], size, weight: formula.has(j) ? 700 : 500, fill: formula.has(j) ? color.darken(pal.primary, 0.2) : pal.ink }));
    });
    else if (i === 0 && !(spec.example || []).length) idx.forEach((j, k) => {
      if (formula.has(j)) inner.push(svg.text({ x: xs[k] + size * 0.6, y: ry + rowH / 2 + size * 0.32, lines: [fitLabel('fills in', ws[k] - size * 0.9, size * 0.8, 500)], size: Math.round(size * 0.8), weight: 500, fill: pal.muted }));
    });
    for (let k = 1; k < idx.length; k++) inner.push(svg.line({ x1: xs[k], y1: ry, x2: xs[k], y2: ry + rowH, stroke: pal.line, strokeWidth: 2 }));
    inner.push(svg.line({ x1: x, y1: ry + rowH, x2: x + w, y2: ry + rowH, stroke: pal.line, strokeWidth: 2 }));
  }
  out.push(`<g clip-path="url(#${id})">${inner.join('')}</g>`);
  return out.join('');
}

// The listing mockup: 2000 x 1600, the template's name, its formats and the sheet itself.
function mockup(spec, title, pal) {
  const W = 2000;
  const H = 1600;
  const f = svg.fit(title, { width: 1700, maxSize: 110, minSize: 60, maxLines: 1, weight: 800 });
  const body = [
    svg.text({ x: W / 2, y: 230, lines: f.lines, size: f.size, weight: 800, fill: pal.ink, anchor: 'middle' }),
    svg.text({ x: W / 2, y: 330, lines: ['Printable  +  Google Sheets  +  Notion'], size: 48, weight: 600, fill: pal.primary, anchor: 'middle' }),
    sheetCard(spec, pal, { x: 300, y: 430, w: 1400, h: 980, cols: 6, rows: 7, size: 30 }),
    svg.text({ x: W / 2, y: 1520, lines: [spec.sheet ? 'Instant download. Formulas included.' : 'Instant download. Print it or fill it in on screen.'], size: 44, weight: 600, fill: pal.muted, anchor: 'middle' }),
  ].join('');
  return svg.doc({ width: W, height: H, background: pal.surface, body });
}

const PIN_W = 1000;
const PIN_H = 1500;

// Three pins, each a different reason to click: the hook, what's inside, how it works.
function pin(spec, { title, pal, variant = 0, shop = '', formulas = 0 }) {
  const out = [];
  const foot = shop ? `Instant download from ${shop}` : 'Instant download';
  if (variant === 0) {
    const f = svg.fit(spec.hook, { width: 780, maxSize: 100, minSize: 56, maxLines: 3, weight: 800 });
    out.push(svg.rect({ x: 0, y: 0, w: PIN_W, h: 620, fill: pal.primary }));
    out.push(svg.text({ x: 70, y: 120, lines: [title.toUpperCase()], size: 30, weight: 700, fill: pal.onPrimary, letterSpacing: 3, opacity: 0.85 }));
    out.push(svg.text({ x: 70, y: 215 + f.size * 0.45, lines: f.lines, size: f.size, weight: 800, fill: pal.onPrimary, lineHeight: 1.08 }));
    out.push(sheetCard(spec, pal, { x: 70, y: 680, w: 860, h: 540, cols: 4, rows: 6, size: 24 }));
    let px = 70;
    for (const label of ['Google Sheets', 'Notion', 'Printable']) {
      const p = svg.pill({ x: px, y: 1272, label, size: 30, weight: 700, fill: color.darken(pal.primary, 0.15), color: '#ffffff' });
      out.push(p.svg);
      px += p.width + 18;
    }
    out.push(svg.text({ x: 70, y: 1425, lines: [foot], size: 30, weight: 600, fill: pal.muted }));
  } else if (variant === 1) {
    const f = svg.fit(title, { width: 780, maxSize: 96, minSize: 56, maxLines: 2, weight: 800 });
    out.push(svg.text({ x: 70, y: 160, lines: ["WHAT'S INSIDE"], size: 30, weight: 700, fill: pal.primary, letterSpacing: 3 }));
    out.push(svg.text({ x: 70, y: 260 + f.size * 0.3, lines: f.lines, size: f.size, weight: 800, fill: pal.ink, lineHeight: 1.08 }));
    const items = [spec.sheet ? `A spreadsheet with ${formulas} formulas` : 'A spreadsheet for Sheets or Excel', 'A Notion page you can import', 'A printable page, letter size', 'Steps to open each file'];
    items.forEach((it, i) => {
      const y = 520 + i * 120;
      out.push(svg.circle({ cx: 105, cy: y - 12, r: 34, fill: pal.primary }));
      out.push(svg.icon('check', { x: 81, y: y - 36, size: 48, color: pal.onPrimary, weight: 2 }));
      out.push(svg.text({ x: 165, y, lines: [it], size: 42, weight: 600, fill: pal.ink }));
    });
    out.push(sheetCard(spec, pal, { x: 70, y: 1010, w: 860, h: 330, cols: 4, rows: 3, size: 22 }));
    out.push(svg.text({ x: 70, y: 1430, lines: [foot], size: 30, weight: 600, fill: pal.muted }));
  } else {
    out.push(svg.rect({ x: 0, y: 0, w: PIN_W, h: PIN_H, fill: pal.primary }));
    out.push(svg.text({ x: 70, y: 150, lines: ['HOW IT WORKS'], size: 30, weight: 700, fill: pal.onPrimary, letterSpacing: 3, opacity: 0.85 }));
    const f = svg.fit(title, { width: 780, maxSize: 92, minSize: 54, maxLines: 2, weight: 800 });
    out.push(svg.text({ x: 70, y: 250 + f.size * 0.3, lines: f.lines, size: f.size, weight: 800, fill: pal.onPrimary, lineHeight: 1.08 }));
    const sub = svg.fit(spec.hook, { width: 840, maxSize: 40, minSize: 30, maxLines: 2, weight: 500 });
    out.push(svg.text({ x: 70, y: 250 + f.size * 0.3 + (f.lines.length - 1) * f.size * 1.08 + 90, lines: sub.lines, size: sub.size, weight: 500, fill: pal.onPrimary, opacity: 0.9, lineHeight: 1.2 }));
    const first = String(spec.use).split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    const steps = ['Download the files right after you buy', 'Open it in Google Sheets, Notion, or print it', first];
    steps.forEach((s, i) => {
      const y = 560 + i * 250;
      out.push(svg.rect({ x: 70, y, w: 860, h: 210, r: 24, fill: '#ffffff' }));
      out.push(svg.circle({ cx: 150, cy: y + 105, r: 46, fill: pal.primary }));
      out.push(svg.text({ x: 150, y: y + 122, lines: [String(i + 1)], size: 50, weight: 800, fill: pal.onPrimary, anchor: 'middle' }));
      const t = svg.fit(s, { width: 600, maxSize: 40, minSize: 28, maxLines: 3, weight: 600 });
      const top = y + 105 - ((t.lines.length - 1) * t.size * 1.15) / 2 + t.size * 0.35;
      out.push(svg.text({ x: 230, y: top, lines: t.lines, size: t.size, weight: 600, fill: pal.ink }));
    });
    out.push(svg.text({ x: 70, y: 1430, lines: [foot], size: 30, weight: 600, fill: pal.onPrimary, opacity: 0.85 }));
  }
  return svg.doc({ width: PIN_W, height: PIN_H, background: pal.surface, body: out.join('') });
}

// The three pins side by side on one image, for a quick look.
function contactSheet(pngs, { w = 1000, h = 1500, scale = 0.5, gap = 40, background = '#f3f4f6' } = {}) {
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const W = gap + pngs.length * (cw + gap);
  const H = ch + gap * 2;
  const body = pngs.map((png, i) => svg.image({ x: gap + i * (cw + gap), y: gap, w: cw, h: ch, data: png, type: 'image/png' })).join('');
  return { svg: svg.doc({ width: W, height: H, background, body }), width: W, height: H };
}

// A bundle mockup: three sheets fanned out under the bundle's name.
function bundleMockup(specs, title, pal, { subtitle } = {}) {
  const W = 2000;
  const H = 1600;
  const f = svg.fit(title, { width: 1700, maxSize: 110, minSize: 60, maxLines: 1, weight: 800 });
  // Side by side with a slight tilt: no card hides another's first column.
  const cards = specs.slice(0, 3).map((s, i) => {
    const angle = [-3, 0, 3][i];
    const cx = [415, 1000, 1585][i];
    const card = sheetCard(s, pal, { x: cx - 270, y: 520, w: 540, h: 760, cols: 3, rows: 7, size: 22 });
    const label = svg.text({ x: cx, y: 480, lines: [text.clip(s.title, 30)], size: 34, weight: 700, fill: pal.ink, anchor: 'middle' });
    return svg.group(`${card}${label}`, { transform: `rotate(${angle} ${cx} 900)` });
  });
  const body = [
    svg.text({ x: W / 2, y: 200, lines: f.lines, size: f.size, weight: 800, fill: pal.ink, anchor: 'middle' }),
    svg.text({ x: W / 2, y: 300, lines: [subtitle || `${specs.length} templates. Printable + Google Sheets + Notion`], size: 46, weight: 600, fill: pal.primary, anchor: 'middle' }),
    [cards[0], cards[2], cards[1]].filter(Boolean).join(''),
    svg.text({ x: W / 2, y: 1520, lines: ['Instant download. One zip, every format.'], size: 44, weight: 600, fill: pal.muted, anchor: 'middle' }),
  ].join('');
  return svg.doc({ width: W, height: H, background: pal.surface, body });
}

module.exports = { sheetCard, mockup, pin, contactSheet, bundleMockup, PIN_W, PIN_H };
