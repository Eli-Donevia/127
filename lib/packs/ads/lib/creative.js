// Ad images in the member's colors, one angle each, in three sizes: square feed (1080x1080),
// portrait feed (1080x1350) and Stories or Reels (1080x1920), where every word sits inside Meta's
// safe zone (14% top, 35% bottom and 6% each side, data/platforms.json) so the app's buttons never
// cover it. The words come only from the member's facts (service, area, price, offer) and pass
// claims.js. With a photo of their own work the photo leads; without one, big type does. Text is
// measured with Inter's real widths (kit media.textWidth) and fitted, so nothing runs off an image.

const { svg, color, text, money } = require('../../_kit');
const LIMITS = require('../data/platforms.json');
const C = require('./claims');

const FONT = svg.FONTS.sans;
const SIZES = [
  { id: 'square', w: 1080, h: 1080, label: 'Feed, square (1:1)', use: 'Facebook and Instagram feed' },
  { id: 'portrait', w: 1080, h: 1350, label: 'Feed, portrait (4:5)', use: 'Instagram and Facebook feed' },
  { id: 'story', w: 1080, h: 1920, label: 'Stories and Reels (9:16)', use: 'Stories, Reels and TikTok' },
];
const pct = (s) => Number(String(s).replace('%', '')) / 100;
const SAFE = { top: pct(LIMITS.meta.storySafeZone.top), bottom: pct(LIMITS.meta.storySafeZone.bottom), sides: pct(LIMITS.meta.storySafeZone.sides) };

let metrics = null;
function measure(str, size, weight = 700) {
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
      return metrics.textWidth(String(str || ''), size, { weight, mode: 'css', letterSpacing: track(size) });
    } catch {
      /* the estimate below */
    }
  }
  return svg.textWidth(String(str || ''), size, weight);
}
const track = (size) => (size >= 90 ? -0.03 * size : size >= 56 ? -0.02 * size : 0);

function wrap(str, width, size, weight) {
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next, size, weight) <= width) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The biggest size that fits width x height in maxLines, with lines balanced so none ends alone.
function fit(str, { width, height, maxSize, minSize = 30, maxLines = 4, weight = 800, lh = 1.04 }) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrap(str, width, size, weight);
    if (lines.length <= maxLines && lines.length * size * lh <= height && lines.every((l) => measure(l, size, weight) <= width)) {
      let best = lines;
      if (lines.length > 1) {
        let lo = width * 0.55;
        let hi = width;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          const l = wrap(str, mid, size, weight);
          if (l.length <= lines.length) {
            best = l;
            hi = mid;
          } else lo = mid;
        }
      }
      return { size, lines: best, lh };
    }
  }
  const lines = wrap(str, width, minSize, weight);
  if (lines.length > 1 && lines.length <= maxLines) {
    let lo = width * 0.55;
    let hi = width;
    let best = lines;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const l = wrap(str, mid, minSize, weight);
      if (l.length <= lines.length) {
        best = l;
        hi = mid;
      } else lo = mid;
    }
    return { size: minSize, lines: best, lh };
  }
  return { size: minSize, lines: lines.slice(0, maxLines), lh };
}

function words(t, { x, y, f, fill, weight = 800, anchor = 'start', opacity }) {
  return svg.text({ x, y, lines: f.lines, size: f.size, weight, fill, font: FONT, lineHeight: f.lh, anchor, letterSpacing: track(f.size) || undefined, opacity });
}

// Colors for the ads: a deep background white text reads on (4.5:1 or better), the accent for the
// price and the label, and the button.
function colorsFor(seed) {
  const p = color.palette(color.isHex(seed) ? seed : seed || 'bold', 0);
  let bg = p.primary;
  for (let i = 0; i < 12 && color.contrast('#ffffff', bg) < 4.5; i++) bg = color.mix(bg, '#000000', 0.12);
  let accent = p.accent;
  if (color.contrast(accent, bg) < 3) accent = color.mix(accent, '#ffffff', 0.45);
  if (color.contrast(accent, bg) < 3) accent = '#ffffff';
  return { primary: p.primary, bg, accent, onAccent: color.readableOn(accent), soft: color.mix(bg, '#ffffff', 0.1), paper: p.paper, ink: p.ink };
}

const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const lowerFirst = (s) => (/^[A-Z]{2,}\b|^I\b/.test(String(s)) ? String(s) : String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1));

// Up to 3 short lines of what's included, from the member's offer.
function itemsFrom(f) {
  const parts = String(f.offer || '')
    .split(/,|;|\s+\+\s+|\s+plus\s+/i)
    .map((x) => sc(noEnd(x)))
    .filter((x) => x && x.length <= 60);
  const out = parts.slice(0, 3);
  if (f.price != null && out.length < 4) out.push('Price set before we start');
  if (f.mobile && out.length < 4 && !/driveway|your (home|house|office|door)|come to you/i.test(f.offer || '')) out.push('We come to you');
  if (out.length < 3) out.push('Easy to book');
  return out.slice(0, 4);
}

// The words for one angle. Each candidate passes claims.js, or the next one is used.
function wordsFor(f, angle, { photo = false } = {}) {
  const S = sc(f.service || 'Your service');
  const area = f.where || f.city || '';
  const P = f.price != null ? money.usd(f.price) : '';
  const k = angle.key;
  let w;
  if (k === 'price') w = { kicker: area ? `${S} in ${area}` : S, big: P, headline: P ? `${S}, price up front` : `${S} with the price up front`, sub: 'You know the price before we start.', icon: 'tag' };
  else if (k === 'local') w = { kicker: area || S, headline: area ? (f.mobile ? `${S} that comes to you in ${area}` : `${S} in ${area}`) : `${S} near you`, sub: f.offer ? `${sc(noEnd(f.offer))}.` : 'Message us for a price.', icon: 'pin' };
  else if (k === 'time') w = { kicker: area ? `${S} in ${area}` : S, headline: f.mobile ? 'Keep your Saturday' : `Book ${lowerFirst(S)} in two minutes`, sub: f.mobile ? `We come to you${f.offer ? `: ${lowerFirst(noEnd(f.offer))}` : ''}.` : f.offer ? `${sc(noEnd(f.offer))}.` : `${S}${area ? ` in ${area}` : ''}.`, icon: 'clock' };
  else if (k === 'included') w = { kicker: "What's included", headline: P ? `What you get for ${P}` : `What you get with ${lowerFirst(S)}`, items: itemsFrom(f), icon: 'check' };
  else if (k === 'who') w = { kicker: S, headline: f.audience ? `For ${lowerFirst(noEnd(f.audience))}` : `${S} for busy people`, sub: P ? `${S}, ${P}, price up front.` : `${S} without the hassle.`, icon: 'user' };
  else if (k === 'proof') w = { kicker: 'Our work', headline: `${S}${area ? ` in ${area}` : ''}`, sub: f.offer ? `${sc(noEnd(f.offer))}.` : 'A real job of ours.', icon: 'camera', needsPhoto: true };
  else w = { kicker: S, headline: noEnd(text.clip(angle.hook || S, 70)).replace(/\.\.\.$/, ''), sub: P ? `${P}, price up front.` : '', icon: 'sparkle' };
  w.cta = P ? 'Book now' : 'Get a price';
  w.by = [f.name, f.website ? f.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : f.handle ? `@${f.handle}` : ''].filter(Boolean).join('  ·  ');
  // Anything that fails the claims check is dropped rather than shipped.
  for (const key of ['kicker', 'headline', 'sub']) if (w[key] && !C.ok(w[key])) w[key] = key === 'headline' ? S : '';
  if (w.items) w.items = w.items.filter(C.ok);
  w.photo = !!photo;
  return w;
}

// The safe box for a size: Stories keep to Meta's safe zone, feeds keep a 7% margin.
function boxFor(size) {
  if (size.id === 'story') return { x0: Math.round(size.w * SAFE.sides) + 24, y0: Math.round(size.h * SAFE.top) + 8, x1: size.w - Math.round(size.w * SAFE.sides) - 24, y1: size.h - Math.round(size.h * SAFE.bottom) - 8 };
  const m = Math.round(size.w * 0.074);
  return { x0: m, y0: m, x1: size.w - m, y1: size.h - m };
}

// A pill label with an icon.
function kickerPill(label, { x, y, size, fill, ink, icon }) {
  const fs = size;
  const pad = Math.round(fs * 0.8);
  const iconW = icon ? Math.round(fs * 1.25) : 0;
  const w = Math.round(measure(label, fs, 700) + pad * 2 + iconW);
  const h = Math.round(fs * 2.05);
  return {
    w,
    h,
    svg:
      svg.rect({ x, y, w, h, r: h / 2, fill }) +
      (icon ? svg.icon(icon, { x: x + pad - fs * 0.1, y: y + (h - fs * 1.05) / 2, size: fs * 1.05, color: ink, weight: 2.2 }) : '') +
      svg.text({ x: x + pad + iconW, y: y + h / 2 + fs * 0.36, lines: [label], size: fs, weight: 700, fill: ink, font: FONT }),
  };
}

function button(label, { x, y, size, fill, ink }) {
  const fs = size;
  const pad = Math.round(fs * 1.1);
  const arrow = Math.round(fs * 1.1);
  const w = Math.round(measure(label, fs, 800) + pad * 2 + arrow + fs * 0.4);
  const h = Math.round(fs * 2.3);
  return {
    w,
    h,
    svg:
      svg.rect({ x, y, w, h, r: h / 2, fill }) +
      svg.text({ x: x + pad, y: y + h / 2 + fs * 0.36, lines: [label], size: fs, weight: 800, fill: ink, font: FONT }) +
      svg.icon('arrow', { x: x + w - pad - arrow + fs * 0.1, y: y + (h - arrow) / 2, size: arrow, color: ink, weight: 2.4 }),
  };
}

// The body of one ad (no outer <svg>), so the preview sheet can reuse it. uid keeps ids unique.
function adBody(w, size, cols, { photoUri, uid = 'a', aiLabel = '' } = {}) {
  const { w: W, h: H } = size;
  const b = boxFor(size);
  const bw = b.x1 - b.x0;
  const out = [];
  const defs = [];
  const story = size.id === 'story';
  const unit = W / 1080;
  out.push(svg.rect({ x: 0, y: 0, w: W, h: H, fill: cols.bg }));
  let top = b.y0;
  let bottom = b.y1;
  if (photoUri) {
    // The photo on top with a clean edge, the words on a solid panel below it. On Stories the photo
    // takes the top third and the words end at the safe zone; the bottom stays clear for the app.
    const ph = Math.round(H * (story ? 0.36 : size.id === 'square' ? 0.4 : 0.48));
    defs.push(`<clipPath id="${uid}-clip"><rect x="0" y="0" width="${W}" height="${ph}"/></clipPath>`);
    out.push(`<g clip-path="url(#${uid}-clip)"><image x="0" y="0" width="${W}" height="${ph}" preserveAspectRatio="xMidYMid slice" href="${photoUri}"/></g>`);
    out.push(svg.rect({ x: 0, y: ph, w: W, h: Math.round(10 * unit), fill: cols.accent }));
    if (story) out.push(svg.circle({ cx: W * 0.86, cy: H * 0.86, r: 210 * unit, fill: cols.soft, opacity: 0.7 }));
    // The price as a round sticker on the photo's edge, so the price ad still leads with it.
    if (w.big) {
      const r = Math.round(124 * unit);
      const cx = b.x1 - r;
      const cy = ph;
      const pf = fit(w.big, { width: r * 1.56, height: r, maxSize: Math.round(r * 0.66), minSize: 28, maxLines: 1, weight: 800, lh: 1 });
      out.push(svg.circle({ cx, cy, r: r + Math.round(8 * unit), fill: cols.bg }));
      out.push(svg.circle({ cx, cy, r, fill: cols.accent }));
      out.push(words(w.big, { x: cx, y: cy + pf.size * 0.36, f: pf, fill: cols.onAccent, anchor: 'middle' }));
    }
    top = ph + Math.round((story ? 44 : 48) * unit);
  } else {
    // Quiet shapes in a lighter tone of the background, away from the words.
    out.push(svg.circle({ cx: W - 40 * unit, cy: (story ? H * 0.16 : 70 * unit), r: (story ? 330 : 290) * unit, fill: cols.soft }));
    out.push(svg.circle({ cx: W - 40 * unit, cy: (story ? H * 0.16 : 70 * unit), r: (story ? 190 : 165) * unit, fill: cols.bg, opacity: 0.55 }));
    if (story) out.push(svg.circle({ cx: W * 0.86, cy: H * 0.83, r: 210 * unit, fill: cols.soft, opacity: 0.7 }));
  }

  // Footer first (the button and who it's from), so the headline gets whatever room is left.
  const btnSize = Math.round((story ? 42 : 38) * unit);
  const btnH = Math.round(btnSize * 2.3);
  const byF = w.by && !(story && photoUri) ? fit(w.by, { width: bw, height: 60 * unit, maxSize: Math.round(30 * unit), minSize: 20, maxLines: 1, weight: 600, lh: 1.1 }) : null;
  const btnY = bottom - btnH - (byF ? Math.round(byF.size * 1.9) : 0);
  const btn = button(w.cta, { x: b.x0, y: btnY, size: btnSize, fill: '#ffffff', ink: cols.bg });
  out.push(btn.svg);
  if (byF) out.push(words(w.by, { x: b.x0, y: btnY + btn.h + byF.size * 1.45, f: byF, fill: '#ffffff', weight: 600, opacity: 0.78 }));

  // The label at the top, then the words, nudged toward the middle of the room that's left.
  const kSize = Math.round((story ? 30 : 27) * unit);
  let y = top;
  // D5: an ad with an AI-made person or voice carries the label, burned in and readable. On a photo it
  // sits on the photo, where the person is; without one it leads the words.
  if (aiLabel) {
    const lp = kickerPill(aiLabel, { x: b.x0, y: photoUri ? b.y0 : y, size: kSize, fill: '#111111', ink: '#ffffff' });
    out.push(lp.svg);
    if (!photoUri) y += lp.h + Math.round(18 * unit);
  }
  if (w.kicker) {
    const kp = kickerPill(text.clip(w.kicker, 34).replace(/\.\.\.$/, ''), { x: b.x0, y, size: kSize, fill: cols.accent, ink: cols.onAccent, icon: w.icon });
    out.push(kp.svg);
    y += kp.h + Math.round(34 * unit);
  }
  const room = btnY - Math.round(44 * unit) - y;
  const bigF = w.big && !photoUri ? fit(w.big, { width: bw, height: room * 0.36, maxSize: Math.round((story ? 230 : 210) * unit), minSize: 60, maxLines: 1, weight: 800, lh: 1 }) : null;
  const bigH = bigF ? bigF.size * 1.02 + Math.round(18 * unit) : 0;
  let subF = w.sub ? fit(w.sub, { width: bw, height: Math.min((room - bigH) * 0.3, 150 * unit), maxSize: Math.round((story ? 42 : 38) * unit), minSize: 24, maxLines: 3, weight: 500, lh: 1.25 }) : null;
  const items = w.items || [];
  const itemSize = Math.round((story ? 40 : 36) * unit);
  const itemsH = items.length ? items.length * itemSize * 1.75 + Math.round(10 * unit) : 0;
  let subH = subF ? subF.lines.length * subF.size * subF.lh + Math.round(26 * unit) : 0;
  const headFit = (h) => fit(w.headline, { width: bw, height: Math.max(80, h), maxSize: Math.round((story && !photoUri ? 124 : photoUri ? 88 : 132) * unit), minSize: 40, maxLines: photoUri ? 3 : 4, weight: 800, lh: 1.06 });
  let headF = headFit(room - bigH - subH - itemsH - 26 * unit);
  if (subF && headF.size < 58 * unit) {
    subF = null;
    subH = 0;
    headF = headFit(room - bigH - itemsH - 26 * unit);
  }
  const headH = headF.lines.length * headF.size * headF.lh + Math.round(26 * unit);
  const spare = Math.max(0, room - (bigH + headH + subH + itemsH));
  y += spare * (photoUri ? 0.3 : story ? 0.25 : 0.4);
  if (bigF) {
    out.push(words(w.big, { x: b.x0 - bigF.size * 0.04, y: y + bigF.size * 0.86, f: bigF, fill: cols.accent }));
    y += bigH;
  }
  out.push(words(w.headline, { x: b.x0, y: y + headF.size * 0.9, f: headF, fill: '#ffffff' }));
  y += headH;
  if (subF) {
    out.push(words(w.sub, { x: b.x0, y: y + subF.size * 0.9, f: subF, fill: '#ffffff', weight: 500, opacity: 0.88 }));
    y += subH;
  }
  for (const it of items) {
    out.push(svg.icon('check', { x: b.x0, y: y + itemSize * 0.05, size: itemSize * 1.1, color: cols.accent, weight: 2.2 }));
    const itF = fit(it, { width: bw - itemSize * 1.6, height: itemSize * 1.3, maxSize: itemSize, minSize: 22, maxLines: 1, weight: 600, lh: 1.1 });
    out.push(words(it, { x: b.x0 + itemSize * 1.55, y: y + itemSize * 0.92, f: itF, fill: '#ffffff', weight: 600 }));
    y += itemSize * 1.75;
  }
  return { body: out.join(''), defs: defs.join('') };
}

function adSvg(w, size, cols, opts = {}) {
  const { body, defs } = adBody(w, size, cols, opts);
  return svg.doc({ width: size.w, height: size.h, defs, body, title: w.headline });
}

// One preview with every ad: a row per angle, the three sizes side by side, the Stories safe zone
// shown as a dashed box (only here, never on the ad itself).
function previewSvg(rows, { title, cols }) {
  const H0 = 560;
  const gap = 44;
  const pad = 64;
  const scaled = SIZES.map((s) => ({ ...s, sw: Math.round((s.w / s.h) * H0), sh: H0 }));
  const rowW = scaled.reduce((t, s) => t + s.sw, 0) + gap * (scaled.length - 1);
  const W = rowW + pad * 2;
  const head = 150;
  const rowH = H0 + 96;
  const Ht = head + rows.length * rowH + 40;
  const parts = [svg.rect({ x: 0, y: 0, w: W, h: Ht, fill: '#f4f4f2' })];
  parts.push(svg.text({ x: pad, y: 84, lines: [text.clip(title, 60)], size: 44, weight: 800, fill: '#141414', font: FONT, letterSpacing: -0.8 }));
  parts.push(svg.text({ x: pad, y: 122, lines: ['Every ad in three sizes. The dashed box on Stories is where the app puts no buttons.'], size: 22, weight: 500, fill: '#5b5b57', font: FONT }));
  rows.forEach((r, ri) => {
    let x = pad;
    const y = head + ri * rowH;
    parts.push(svg.text({ x: pad, y: y + 30, lines: [r.label], size: 24, weight: 700, fill: '#141414', font: FONT }));
    scaled.forEach((s) => {
      const ad = r.ads[s.id];
      const yy = y + 52;
      parts.push(svg.rect({ x: x - 1, y: yy - 1, w: s.sw + 2, h: s.sh + 2, r: 10, fill: '#d9d9d4' }));
      parts.push(`<svg x="${x}" y="${yy}" width="${s.sw}" height="${s.sh}" viewBox="0 0 ${s.w} ${s.h}">${ad.defs ? `<defs>${ad.defs}</defs>` : ''}${ad.body}</svg>`);
      if (s.id === 'story') {
        const k = s.sw / s.w;
        parts.push(svg.rect({ x: x + s.w * SAFE.sides * k, y: yy + s.h * SAFE.top * k, w: s.w * (1 - 2 * SAFE.sides) * k, h: s.h * (1 - SAFE.top - SAFE.bottom) * k, fill: 'none', stroke: '#ffffff', strokeWidth: 1.5, opacity: 0.85 }).replace('/>', ' stroke-dasharray="6 6"/>'));
      }
      x += s.sw + gap;
    });
  });
  void cols;
  return svg.doc({ width: W, height: Ht, body: parts.join('') });
}

module.exports = { SIZES, SAFE, colorsFor, wordsFor, adBody, adSvg, previewSvg, boxFor, fit, measure, itemsFrom };
