// Carousel slides, a contact sheet and Reel frames as SVG, in the member's own colors. 1080 x 1350
// (Instagram's 4:5 portrait), Inter, big confident type, a clean grid with 96px margins, one idea
// per slide, a progress bar so people know there's more. Text is measured with Inter's real
// advance widths (kit media.textWidth) and fitted to its box, so nothing ever runs off a slide.
//
// Slide kinds: cover, point, mythtruth, list, compare, statement, cta.

const { svg, color } = require('../../_kit');

const W = 1080;
const H = 1350;
const M = 96; // side margin
const FONT = "Inter, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif";

let metrics = null;
function measure(str, size, weight = 400, letterSpacing = 0) {
  const s = String(str || '');
  if (metrics === null) {
    try {
      const media = require('../../_kit').media;
      metrics = media.fontFile(700) ? media : false;
    } catch {
      metrics = false;
    }
  }
  if (metrics) {
    try {
      return metrics.textWidth(s, size, { weight, mode: 'css', letterSpacing });
    } catch {
      /* fall through to the estimate */
    }
  }
  return svg.textWidth(s, size, weight) + letterSpacing * Math.max(0, s.length - 1);
}

// Tight tracking for big type, normal for body text (what designers do by eye).
const tracking = (size) => (size >= 90 ? -0.035 * size : size >= 56 ? -0.025 * size : size >= 40 ? -0.01 * size : 0);

function wrapLines(str, { width, size, weight }) {
  const ls = tracking(size);
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next, size, weight, ls) <= width) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Even out a ragged block: the narrowest width that keeps the same number of lines, so a headline
// never ends on one lonely word.
function balance(str, lines, { width, size, weight }) {
  if (lines.length < 2) return lines;
  let lo = width * 0.55;
  let hi = width;
  let best = lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const l = wrapLines(str, { width: mid, size, weight });
    if (l.length <= lines.length) {
      best = l;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

// Biggest size (step 2px) at which the text fits width x height in maxLines. Never overflows: at the
// smallest size the last line is cut with "..." if it still doesn't fit.
function fitText(str, { width, height = Infinity, maxSize = 120, minSize = 28, maxLines = 4, weight = 800, lineHeight = 1.08 }) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrapLines(str, { width, size, weight });
    const ok = lines.length <= maxLines && lines.length * size * lineHeight <= height + 0.5 && lines.every((l) => measure(l, size, weight, tracking(size)) <= width);
    if (ok) return { size, lines: balance(str, lines, { width, size, weight }), lineHeight };
  }
  let lines = wrapLines(str, { width, size: minSize, weight });
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 3 && measure(`${last}...`, minSize, weight) > width) last = last.replace(/\s*\S+$/, '');
    lines[maxLines - 1] = `${last.replace(/[,.;:]$/, '')}...`;
  }
  return { size: minSize, lines, lineHeight };
}

function textBlock({ x, y, fit, fill, weight = 800, anchor = 'start', opacity }) {
  return svg.text({ x, y: Math.round(y + fit.size * 0.8), lines: fit.lines, size: fit.size, weight, fill, font: FONT, lineHeight: fit.lineHeight, anchor, letterSpacing: Math.round(tracking(fit.size) * 10) / 10 || undefined, opacity });
}

const blockHeight = (fit) => Math.round(fit.lines.length * fit.size * fit.lineHeight);

// ---------- themes ----------

// Colors for each slide role from the member's palette (kit color.palette).
function themeColors(p, theme = 'bold') {
  const deep = color.darken(p.primary, 0.78);
  const glow = color.ensureContrast(color.lighten(p.primary, 0.35), deep, 4.5);
  if (theme === 'dark') {
    const bg = deep;
    return {
      cover: { bg, fg: '#ffffff', sub: color.mix('#ffffff', bg, 0.3), accent: glow, onAccent: color.readableOn(glow), deco: glow },
      body: { bg, fg: '#ffffff', sub: color.mix('#ffffff', bg, 0.3), accent: glow, onAccent: color.readableOn(glow), panel: color.mix(bg, '#ffffff', 0.08), panelFg: '#ffffff', track: color.mix(bg, '#ffffff', 0.18) },
      cta: { bg: p.primary, fg: p.onPrimary, sub: color.mix(p.onPrimary, p.primary, 0.25), accent: p.onPrimary, onAccent: p.primary, deco: p.onPrimary },
    };
  }
  if (theme === 'light') {
    return {
      cover: { bg: p.paper, fg: p.ink, sub: p.muted, accent: p.primary, onAccent: p.onPrimary, deco: p.primary },
      body: { bg: p.paper, fg: p.ink, sub: p.muted, accent: p.primary, onAccent: p.onPrimary, panel: p.surface, panelFg: p.ink, track: p.line },
      cta: { bg: p.primary, fg: p.onPrimary, sub: color.mix(p.onPrimary, p.primary, 0.25), accent: p.onPrimary, onAccent: p.primary, deco: p.onPrimary },
    };
  }
  // bold: color cover, paper inside, dark close
  return {
    cover: { bg: p.primary, fg: p.onPrimary, sub: color.mix(p.onPrimary, p.primary, 0.22), accent: p.onPrimary, onAccent: p.primary, deco: p.onPrimary },
    body: { bg: p.paper, fg: p.ink, sub: p.muted, accent: p.primary, onAccent: p.onPrimary, panel: p.surface, panelFg: p.ink, track: p.line },
    cta: { bg: deep, fg: '#ffffff', sub: color.mix('#ffffff', deep, 0.3), accent: color.contrast(p.primary, deep) >= 3 ? p.primary : glow, onAccent: color.contrast(p.primary, deep) >= 3 ? p.onPrimary : color.readableOn(glow), deco: glow },
  };
}

// ---------- pieces ----------

function footer(c, { index, total, signature }) {
  const y = H - 92;
  let out = '';
  if (signature) out += svg.text({ x: M, y: y + 9, lines: [signature], size: 28, weight: 600, fill: c.sub || c.fg, font: FONT });
  if (total > 1) {
    const tw = 200;
    const x = W - M - tw;
    out += svg.rect({ x, y: -3 + y, w: tw, h: 6, r: 3, fill: c.track || color.mix(c.fg, c.bg, 0.8) });
    out += svg.rect({ x, y: -3 + y, w: Math.max(18, Math.round((tw * (index + 1)) / total)), h: 6, r: 3, fill: c.accent });
  }
  return out;
}

function labelPill(c, label, x, y) {
  if (!label) return { svg: '', h: 0 };
  const t = String(label).toUpperCase();
  const size = 24;
  const ls = 2.4;
  const w = Math.round(measure(t, size, 700, ls) + 2 * 26);
  const h = 54;
  return {
    h,
    svg: svg.rect({ x, y, w, h, r: 27, fill: c.accent }) + svg.text({ x: x + 26, y: y + 36, lines: [t], size, weight: 700, fill: c.onAccent, font: FONT, letterSpacing: ls }),
  };
}

function checkMark(cx, cy, r, fill, stroke) {
  return svg.circle({ cx, cy, r, fill }) + svg.path({ d: `M${cx - r * 0.42} ${cy + r * 0.02}L${cx - r * 0.1} ${cy + r * 0.34}L${cx + r * 0.46} ${cy - r * 0.32}`, stroke, strokeWidth: Math.max(4, r * 0.2), linecap: 'round', linejoin: 'round' });
}

function crossMark(cx, cy, r, fill, stroke) {
  const k = r * 0.32;
  return svg.circle({ cx, cy, r, fill }) + svg.path({ d: `M${cx - k} ${cy - k}L${cx + k} ${cy + k}M${cx + k} ${cy - k}L${cx - k} ${cy + k}`, stroke, strokeWidth: Math.max(4, r * 0.2), linecap: 'round' });
}

function arrow(x, y, size, stroke) {
  return svg.path({ d: `M${x} ${y}H${x + size}M${x + size * 0.62} ${y - size * 0.36}L${x + size} ${y}L${x + size * 0.62} ${y + size * 0.36}`, stroke, strokeWidth: 5, linecap: 'round', linejoin: 'round' });
}

// ---------- slides ----------

function cover(s, c, o) {
  let body = '';
  // A big soft circle off the top right corner and a thin ring inside it: depth without clutter.
  body += svg.circle({ cx: W - 40, cy: 150, r: 330, fill: c.deco, opacity: 0.09 });
  body += svg.circle({ cx: W - 40, cy: 150, r: 210, fill: 'none', stroke: c.deco, strokeWidth: 3, opacity: 0.22 });
  const pill = labelPill(c, s.label, M, 150);
  body += pill.svg;
  const top = 150 + (pill.h ? pill.h + 70 : 40);
  const subFit = s.sub ? fitText(s.sub, { width: W - 2 * M, maxSize: 40, minSize: 30, maxLines: 3, weight: 500, lineHeight: 1.3 }) : null;
  const bottomLimit = H - 200 - (subFit ? blockHeight(subFit) + 44 : 0);
  const title = fitText(s.title, { width: W - 2 * M, height: bottomLimit - top, maxSize: 132, minSize: 64, maxLines: 6, weight: 800, lineHeight: 1.02 });
  const titleH = blockHeight(title);
  // Sit the headline low on the slide: it reads like a poster, not a document.
  const ty = Math.max(top, Math.min(bottomLimit - titleH, top + (bottomLimit - top - titleH) * 0.62));
  body += textBlock({ x: M, y: ty, fit: title, fill: c.fg, weight: 800 });
  if (subFit) {
    const sy = ty + titleH + 44;
    body += svg.rect({ x: M, y: sy - 22, w: 88, h: 6, r: 3, fill: c.fg, opacity: 0.85 });
    body += textBlock({ x: M, y: sy + 8, fit: subFit, fill: c.sub, weight: 500 });
  }
  // Swipe cue
  const sw = 'Swipe';
  const swW = Math.round(measure(sw, 30, 700) + 26 + 40 + 2 * 30);
  const sx = W - M - swW;
  const sy2 = H - 92 - 33;
  body += svg.rect({ x: sx, y: sy2, w: swW, h: 66, r: 33, fill: 'none', stroke: c.fg, strokeWidth: 3, opacity: 0.9 });
  body += svg.text({ x: sx + 30, y: sy2 + 44, lines: [sw], size: 30, weight: 700, fill: c.fg, font: FONT });
  body += arrow(sx + 30 + measure(sw, 30, 700) + 18, sy2 + 33, 34, c.fg);
  if (o.signature) body += svg.text({ x: M, y: H - 92 + 9, lines: [o.signature], size: 28, weight: 600, fill: c.sub, font: FONT });
  return body;
}

function point(s, c, o) {
  let body = '';
  const num = s.n != null ? String(s.n).padStart(2, '0') : '';
  const top = 130;
  const bottom = H - 180;
  const w = W - 2 * M;
  const calloutFit = s.callout ? fitText(s.callout.text, { width: w - 64 - 92, maxSize: 38, minSize: 28, maxLines: 4, weight: 600, lineHeight: 1.3 }) : null;
  const calloutH = calloutFit ? Math.max(150, blockHeight(calloutFit) + 112) : 0;
  const bodyFit = s.body ? fitText(s.body, { width: w, maxSize: 42, minSize: 30, maxLines: 6, weight: 500, lineHeight: 1.36 }) : null;
  const numH = num ? 200 : 0;
  const bodyH = bodyFit ? blockHeight(bodyFit) + 44 : 0;
  const room = bottom - top - numH - bodyH - (calloutH ? calloutH + 56 : 0);
  const title = fitText(s.title, { width: w, height: Math.max(120, room), maxSize: s.body ? 96 : 112, minSize: 48, maxLines: s.body ? 4 : 6, weight: 800, lineHeight: 1.05 });
  const groupH = numH + blockHeight(title) + bodyH + (calloutH ? calloutH + 56 : 0);
  // The group sits a little above the middle: balanced, with room to breathe at the bottom.
  let y = Math.max(top, Math.round(top + (bottom - top - groupH) * 0.42));
  if (num) {
    body += svg.text({ x: M - 6, y: y + 132, lines: [num], size: 172, weight: 800, fill: c.accent, font: FONT, letterSpacing: -6 });
    y += numH;
  }
  body += textBlock({ x: M, y, fit: title, fill: c.fg, weight: 800 });
  y += blockHeight(title) + 44;
  if (bodyFit) {
    body += textBlock({ x: M, y, fit: bodyFit, fill: c.sub, weight: 500 });
    y += blockHeight(bodyFit) + 56;
  } else y += 12;
  if (calloutFit) {
    body += svg.rect({ x: M, y, w, h: calloutH, r: 32, fill: c.panel });
    body += checkMark(M + 32 + 30, y + 32 + 30, 30, c.accent, c.onAccent);
    const lx = M + 32 + 92;
    body += svg.text({ x: lx, y: y + 32 + 40, lines: [String(s.callout.label || 'Do this instead').toUpperCase()], size: 24, weight: 700, fill: c.accent, font: FONT, letterSpacing: 2.4 });
    body += textBlock({ x: lx, y: y + 32 + 62, fit: calloutFit, fill: c.panelFg, weight: 600 });
  }
  body += footer(c, o);
  return body;
}

function mythtruth(s, c, o) {
  let body = '';
  const x = M;
  const w = W - 2 * M;
  const top = 130;
  const bottom = H - 180;
  const head = fitText(s.title || 'Myth vs truth', { width: w, maxSize: 64, minSize: 44, maxLines: 2, weight: 800 });
  const inner = w - 64 - 96;
  const mythFit = fitText(`"${s.myth}"`, { width: inner, maxSize: 50, minSize: 32, maxLines: 4, weight: 600, lineHeight: 1.24 });
  const truthFit = fitText(s.truth, { width: inner, maxSize: 56, minSize: 34, maxLines: 6, weight: 700, lineHeight: 1.22 });
  const pad = 150;
  let mH = blockHeight(mythFit) + pad;
  let tH = Math.max(280, blockHeight(truthFit) + pad);
  const gap = 32;
  const headH = blockHeight(head) + 64;
  const avail = bottom - top - headH;
  if (mH + tH + gap > avail) {
    const k = avail / (mH + tH + gap);
    mH = Math.round(mH * k);
    tH = Math.round(tH * k);
  }
  let y = Math.max(top, Math.round(top + (bottom - top - (headH + mH + gap + tH)) * 0.42));
  body += textBlock({ x, y, fit: head, fill: c.fg });
  y += headH;
  body += svg.rect({ x, y, w, h: mH, r: 36, fill: c.panel });
  body += crossMark(x + 32 + 30, y + 32 + 30, 30, c.sub, c.bg);
  body += svg.text({ x: x + 32 + 92, y: y + 32 + 40, lines: ['MYTH'], size: 26, weight: 800, fill: c.sub, font: FONT, letterSpacing: 3 });
  body += textBlock({ x: x + 32 + 92, y: y + 32 + 72, fit: mythFit, fill: c.panelFg, weight: 600, opacity: 0.78 });
  const ty = y + mH + gap;
  body += svg.rect({ x, y: ty, w, h: tH, r: 36, fill: c.accent });
  body += checkMark(x + 32 + 30, ty + 32 + 30, 30, c.onAccent, c.accent);
  body += svg.text({ x: x + 32 + 92, y: ty + 32 + 40, lines: ['TRUTH'], size: 26, weight: 800, fill: c.onAccent, font: FONT, letterSpacing: 3 });
  body += textBlock({ x: x + 32 + 92, y: ty + 32 + 72, fit: truthFit, fill: c.onAccent, weight: 700 });
  body += footer(c, o);
  return body;
}

function list(s, c, o) {
  let body = '';
  const w = W - 2 * M;
  const top = 130;
  const bottom = H - 180;
  const head = fitText(s.title, { width: w, maxSize: 80, minSize: 46, maxLines: 3, weight: 800 });
  const headH = blockHeight(head) + 72;
  const items = (s.items || []).slice(0, 6);
  const avail = bottom - top - headH;
  const rowGap = 44;
  let fits = [];
  let total = 0;
  for (let size = 50; size >= 28; size -= 2) {
    fits = items.map((t) => fitText(t, { width: w - 104, maxSize: size, minSize: size, maxLines: 3, weight: 600, lineHeight: 1.22 }));
    total = fits.reduce((n, f) => n + Math.max(blockHeight(f), 64), 0) + rowGap * Math.max(0, items.length - 1);
    if (total <= avail) break;
  }
  let y = Math.max(top, Math.round(top + (bottom - top - headH - total) * 0.42));
  body += textBlock({ x: M, y, fit: head, fill: c.fg });
  y += headH;
  items.forEach((t, i) => {
    const f = fits[i];
    const rowH = Math.max(blockHeight(f), 64);
    const my = y + Math.min(0, (blockHeight(f) - 64) / 2) + Math.max(0, (rowH - 64) / 2) * 0;
    if (s.checks === false) {
      body += svg.circle({ cx: M + 32, cy: my + 32, r: 32, fill: c.accent });
      body += svg.text({ x: M + 32, y: my + 44, lines: [String(i + 1)], size: 32, weight: 800, fill: c.onAccent, font: FONT, anchor: 'middle' });
    } else {
      body += svg.rect({ x: M, y: my + 2, w: 60, h: 60, r: 16, fill: c.accent });
      body += svg.path({ d: `M${M + 16} ${my + 33}L${M + 27} ${my + 44}L${M + 46} ${my + 21}`, stroke: c.onAccent, strokeWidth: 7, linecap: 'round', linejoin: 'round' });
    }
    const ty = y + Math.max(0, (64 - blockHeight(f)) / 2) - 2;
    body += textBlock({ x: M + 104, y: ty, fit: f, fill: c.fg, weight: 600 });
    y += rowH + rowGap;
    if (i < items.length - 1) body += svg.rect({ x: M + 104, y: y - rowGap / 2 - 1, w: w - 104, h: 2, fill: c.track || c.panel, opacity: 0.9 });
  });
  body += footer(c, o);
  return body;
}

function compare(s, c, o) {
  let body = '';
  const w = W - 2 * M;
  const top = 130;
  const bottom = H - 180;
  const head = fitText(s.title, { width: w, maxSize: 80, minSize: 46, maxLines: 3, weight: 800 });
  const headH = blockHeight(head) + 64;
  const colW = (w - 32) / 2;
  const inner = colW - 80;
  const labels = [s.a, s.b].map((side) => fitText(String(side.label || ''), { width: inner, maxSize: 48, minSize: 32, maxLines: 3, weight: 800 }));
  const texts = [s.a, s.b].map((side) => fitText(String(side.text || ''), { width: inner, maxSize: 44, minSize: 28, maxLines: 8, weight: 500, lineHeight: 1.3 }));
  const colH = Math.min(bottom - top - headH, Math.max(...[0, 1].map((i) => 48 + blockHeight(labels[i]) + 40 + 6 + 40 + blockHeight(texts[i]) + 56), 420));
  let y = Math.max(top, Math.round(top + (bottom - top - headH - colH) * 0.42));
  body += textBlock({ x: M, y, fit: head, fill: c.fg });
  y += headH;
  [0, 1].forEach((i) => {
    const x = M + i * (colW + 32);
    const strong = i === 1;
    body += svg.rect({ x, y, w: colW, h: colH, r: 36, fill: strong ? c.accent : c.panel });
    body += textBlock({ x: x + 40, y: y + 48, fit: labels[i], fill: strong ? c.onAccent : c.panelFg });
    const ly = y + 48 + blockHeight(labels[i]) + 40;
    body += svg.rect({ x: x + 40, y: ly, w: 64, h: 6, r: 3, fill: strong ? c.onAccent : c.accent });
    body += textBlock({ x: x + 40, y: ly + 40, fit: texts[i], fill: strong ? c.onAccent : c.panelFg, weight: 500 });
  });
  body += footer(c, o);
  return body;
}

function statement(s, c, o) {
  let body = '';
  const w = W - 2 * M;
  const top = 130;
  const bottom = H - 180;
  const bodyFit = s.body ? fitText(s.body, { width: w, maxSize: 42, minSize: 30, maxLines: 4, weight: 500, lineHeight: 1.35 }) : null;
  const title = fitText(s.title, { width: w, height: 640, maxSize: 112, minSize: 56, maxLines: 5, weight: 800, lineHeight: 1.04 });
  const groupH = 14 + 64 + blockHeight(title) + (bodyFit ? 48 + blockHeight(bodyFit) : 0);
  let y = Math.max(top, Math.round(top + (bottom - top - groupH) * 0.45));
  body += svg.rect({ x: M, y, w: 132, h: 14, r: 7, fill: c.accent });
  y += 14 + 64;
  body += textBlock({ x: M, y, fit: title, fill: c.fg });
  y += blockHeight(title) + 48;
  if (bodyFit) body += textBlock({ x: M, y, fit: bodyFit, fill: c.sub, weight: 500 });
  body += footer(c, o);
  return body;
}

function cta(s, c, o) {
  let body = '';
  const w = W - 2 * M;
  body += svg.circle({ cx: 60, cy: H - 60, r: 360, fill: c.deco, opacity: 0.08 });
  let y = 170;
  const head = fitText(s.title || 'Want help with this?', { width: w, maxSize: 92, minSize: 56, maxLines: 4, weight: 800, lineHeight: 1.04 });
  body += textBlock({ x: M, y, fit: head, fill: c.fg });
  y += blockHeight(head) + 70;
  body += svg.text({ x: M, y: y + 30, lines: ['COMMENT'], size: 28, weight: 700, fill: c.sub, font: FONT, letterSpacing: 4 });
  y += 62;
  const kw = String(s.keyword || '').toUpperCase();
  const kwFit = fitText(kw, { width: w - 120, maxSize: 132, minSize: 64, maxLines: 1, weight: 800 });
  const kwW = Math.round(measure(kw, kwFit.size, 800, tracking(kwFit.size)) + 120);
  const kwH = Math.round(kwFit.size * 1.42);
  body += svg.rect({ x: M, y, w: kwW, h: kwH, r: kwH / 2, fill: c.accent });
  body += svg.text({ x: M + 60, y: y + kwH / 2 + kwFit.size * 0.36, lines: [kw], size: kwFit.size, weight: 800, fill: c.onAccent, font: FONT, letterSpacing: Math.round(tracking(kwFit.size)) });
  y += kwH + 56;
  if (s.promise) {
    const pf = fitText(s.promise, { width: w, maxSize: 44, minSize: 30, maxLines: 3, weight: 600, lineHeight: 1.3 });
    body += textBlock({ x: M, y, fit: pf, fill: c.fg, weight: 600 });
    y += blockHeight(pf) + 40;
  }
  if (s.note) {
    const nf = fitText(s.note, { width: w, maxSize: 32, minSize: 26, maxLines: 2, weight: 500, lineHeight: 1.3 });
    body += textBlock({ x: M, y, fit: nf, fill: c.sub, weight: 500 });
  }
  if (o.signature) body += svg.text({ x: M, y: H - 92 + 9, lines: [o.signature], size: 30, weight: 700, fill: c.fg, font: FONT });
  if (s.save) {
    const t = 'Save this for later';
    const tw = measure(t, 28, 600);
    const x = W - M - tw;
    body += svg.path({ d: `M${x - 44} ${H - 92 - 20}h26v40l-13-10l-13 10z`, fill: 'none', stroke: c.fg, strokeWidth: 4, linejoin: 'round' });
    body += svg.text({ x, y: H - 92 + 9, lines: [t], size: 28, weight: 600, fill: c.sub, font: FONT });
  }
  return body;
}

const KINDS = { cover, point, mythtruth, list, compare, statement, cta };

// One slide as a standalone SVG string. o: { palette, theme, index, total, signature }
function slideSvg(s, o) {
  const roles = themeColors(o.palette, o.theme);
  const c = s.kind === 'cover' ? roles.cover : s.kind === 'cta' ? roles.cta : roles.body;
  const draw = KINDS[s.kind] || point;
  return svg.doc({ width: W, height: H, background: c.bg, body: draw(s, c, o), title: s.title || s.kind });
}

function slidesSvg(slides, { palette, theme = 'bold', signature = '' }) {
  return slides.map((s, i) => slideSvg(s, { palette, theme, index: i, total: slides.length, signature }));
}

// Strip the outer <svg ...> wrapper so a slide can sit inside another drawing.
function inner(svgString) {
  return String(svgString).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

// All slides on one image (a preview to share or check before posting).
function contactSheet(svgs, { palette, cols = 4, gap = 36, pad = 72, title = '' } = {}) {
  const n = svgs.length;
  const c = Math.min(cols, n);
  const rows = Math.ceil(n / c);
  const tw = 420;
  const th = Math.round((tw * H) / W);
  const head = title ? 110 : 0;
  const width = pad * 2 + c * tw + (c - 1) * gap;
  const height = pad * 2 + head + rows * th + (rows - 1) * gap;
  let body = '';
  if (title) body += svg.text({ x: pad, y: pad + 52, lines: [title], size: 44, weight: 800, fill: palette.ink, font: FONT, letterSpacing: -0.5 });
  svgs.forEach((s, i) => {
    const x = pad + (i % c) * (tw + gap);
    const y = pad + head + Math.floor(i / c) * (th + gap);
    body += svg.rect({ x: x + 6, y: y + 10, w: tw, h: th, r: 18, fill: '#000000', opacity: 0.08 });
    body += `<svg x="${x}" y="${y}" width="${tw}" height="${th}" viewBox="0 0 ${W} ${H}">${inner(s)}</svg>`;
    body += svg.rect({ x, y, w: tw, h: th, r: 0, fill: 'none', stroke: palette.line, strokeWidth: 2 });
  });
  return svg.doc({ width, height, background: palette.surface, body });
}

// A 1080 x 1920 Reel frame: the slide in the middle of a background in the member's color, so a
// carousel doubles as a Reel (no black bars).
function reelFrame(slide, { palette, theme = 'bold', index = 0, total = 1, caption = '' }) {
  const bg = theme === 'light' ? palette.surface : color.darken(palette.primary, 0.82);
  const fg = theme === 'light' ? palette.ink : '#ffffff';
  const y = Math.round((1920 - H) / 2);
  let body = `<svg x="0" y="${y}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner(slide)}</svg>`;
  if (caption) {
    const f = fitText(caption, { width: W - 2 * M, maxSize: 40, minSize: 30, maxLines: 2, weight: 700, lineHeight: 1.2 });
    body += textBlock({ x: W / 2, y: 120, fit: f, fill: fg, weight: 700, anchor: 'middle' });
  }
  const dots = Math.min(total, 10);
  const dw = 14;
  const gap = 12;
  const sx = W / 2 - (dots * dw + (dots - 1) * gap) / 2;
  for (let i = 0; i < dots; i++) body += svg.circle({ cx: sx + i * (dw + gap) + dw / 2, cy: y + H + 70, r: dw / 2, fill: fg, opacity: i === index ? 0.95 : 0.3 });
  return svg.doc({ width: W, height: 1920, background: bg, body });
}

module.exports = { W, H, M, FONT, measure, fitText, wrapLines, tracking, themeColors, slideSvg, slidesSvg, contactSheet, reelFrame, inner, KINDS };
