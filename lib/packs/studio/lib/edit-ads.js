// Image ads in five sizes from one picture and its words (lib/edit.js adSizes).
//
// Sizes: 1080x1080 (feed square), 1080x1350 (feed 4:5), 1080x1920 (Stories and Reels), 1200x628
// (link ads) and 1920x1080 (wide). Words are measured with the real Inter widths (media.textWidth) and
// fitted to their column. In 1080x1920 the words stay out of the Stories safe zone: 14% top, 35%
// bottom and 6% each side (Meta's Instagram Stories ad guide, in packs/ads/data/platforms.json,
// checked 2026-10-19). Behind the words the picture is darkened until white text has at least a
// 4.5:1 contrast with the brightest part of the picture under it (WCAG AA), measured on the pixels.

const fs = require('fs');
const path = require('path');
const { media, color, text } = require('../../_kit');
const M = require('./edit-media');

const SIZES = [
  { w: 1080, h: 1080, label: 'Feed square 1:1' },
  { w: 1080, h: 1350, label: 'Feed portrait 4:5' },
  { w: 1080, h: 1920, label: 'Stories and Reels 9:16' },
  { w: 1200, h: 628, label: 'Link ad 1.91:1' },
  { w: 1920, h: 1080, label: 'Wide 16:9' },
];
const STORY_SAFE = { top: 0.14, bottom: 0.35, sides: 0.06 };
const TARGET = 4.6; // a little over 4.5:1, so rounding never lands under it

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

function sizeList(sizes) {
  if (!Array.isArray(sizes) || !sizes.length) return SIZES;
  const out = [];
  for (const s of sizes) {
    const m = String(typeof s === 'object' && s ? `${s.w || s.width}x${s.h || s.height}` : s).match(/^(\d{3,4})x(\d{3,4})$/);
    if (!m) continue;
    const hit = SIZES.find((x) => x.w === Number(m[1]) && x.h === Number(m[2]));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out.length ? out : SIZES;
}

function wrap(str, size, width, weight) {
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && media.textWidth(next, size, { weight }) > width) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Biggest size (2 px steps) at which the text fits width in maxLines, with real Inter widths.
function fit(str, { width, max, min, maxLines, weight }) {
  for (let size = Math.round(max); size >= min; size -= 2) {
    const lines = wrap(str, size, width, weight);
    if (lines.length <= maxLines && lines.every((l) => media.textWidth(l, size, { weight }) <= width)) return { size, lines };
  }
  const lines = wrap(str, min, width, weight).slice(0, maxLines);
  return { size: min, lines };
}

// sRGB 0-255 to relative luminance.
function lum(r, g, b) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// How dark the black layer over the words must be (0 to 0.9) so white text reads at TARGET:1 on the
// brightest 2% of the pixels in that box. pixels: rgb24 Buffer. Darkening blends in sRGB, like the
// renderer, so the check is on the darkened pixel itself.
function darkenFor(pixels, { floor = 0.28 } = {}) {
  const n = Math.floor(pixels.length / 3);
  const need = 1.05 / TARGET - 0.05;
  const worst = (a) => {
    const L = [];
    for (let i = 0; i < n; i++) L.push(lum(pixels[i * 3] * (1 - a), pixels[i * 3 + 1] * (1 - a), pixels[i * 3 + 2] * (1 - a)));
    L.sort((x, y) => x - y);
    return L[Math.min(L.length - 1, Math.floor(L.length * 0.98))] || 0;
  };
  let lo = 0;
  let hi = 0.92;
  if (worst(0) <= need) return { darken: floor, contrast: Math.round((1.05 / (worst(floor) + 0.05)) * 10) / 10 };
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (worst(mid) <= need) hi = mid;
    else lo = mid;
  }
  const a = Math.max(floor, Math.ceil(hi * 100) / 100);
  return { darken: a, contrast: Math.round((1.05 / (worst(a) + 0.05)) * 10) / 10 };
}

async function pixelsOf(ctx, jpgFile, box) {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const w = Math.max(8, Math.round(box.w));
  const h = Math.max(8, Math.round(box.h));
  const { stdout } = await media.ffmpeg(['-i', jpgFile, '-vf', `crop=${w}:${h}:${x}:${y},scale=64:-2:flags=area,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-'], { timeoutSec: 60, signal: ctx && ctx.signal });
  return stdout;
}

// The button: brand color with the ink that reads on it, darkened until the pair is 4.5:1 or more.
function buttonColors(brand) {
  let fill = brand;
  let ink = color.readableOn(fill, '#0b0b10', '#ffffff');
  for (let k = 0; k < 12 && color.contrast(fill, ink) < 4.5; k++) {
    fill = color.darken(fill, 0.1);
    ink = '#ffffff';
  }
  return { fill, ink, contrast: Math.round(color.contrast(fill, ink) * 10) / 10 };
}

// The layout of one size: the column the words live in and their sizes. Returns { col, lines... }.
function layout({ w: W, h: H }, { headline, sub, button }) {
  const story = H / W > 1.7;
  const wide = W / H > 1.3;
  const m = Math.round(Math.min(W, H) * 0.06);
  const safe = story ? { top: H * STORY_SAFE.top, bottom: H * (1 - STORY_SAFE.bottom), left: W * STORY_SAFE.sides, right: W * (1 - STORY_SAFE.sides) } : { top: m, bottom: H - m, left: m, right: W - m };
  const colW = wide ? Math.round(W * 0.56 - safe.left) : Math.round(safe.right - safe.left);
  const hMax = wide ? H * 0.12 : W * (story ? 0.1 : 0.095);
  const head = fit(headline, { width: colW, max: hMax, min: Math.max(30, Math.round(Math.min(W, H) * 0.045)), maxLines: wide ? 3 : 3, weight: 800 });
  const subSize = Math.max(22, Math.min(46, Math.round(head.size * 0.42)));
  const subFit = sub ? fit(sub, { width: colW, max: subSize, min: 20, maxLines: 2, weight: 500 }) : null;
  const btnSize = Math.max(24, Math.min(42, Math.round(head.size * 0.36)));
  const btn = button ? { size: btnSize, w: media.textWidth(button, btnSize, { weight: 700 }) + btnSize * 2.2, h: btnSize * 2.3 } : null;
  if (btn) btn.w = Math.min(btn.w, colW);
  const headH = head.lines.length * head.size * 1.1;
  const subH = subFit ? 18 + subFit.lines.length * subFit.size * 1.32 : 0;
  const btnH = btn ? 30 + btn.h : 0;
  const blockH = headH + subH + btnH;
  const top = wide ? Math.max(safe.top, (H - blockH) / 2) : safe.bottom - blockH;
  return { W, H, story, wide, safe, colW, head, subFit, btn, headH, subH, blockH, top, left: safe.left };
}

function adSvg(L, { bg, brand, headline, sub, button, name, darken, sample }) {
  const { W, H } = L;
  const pad = Math.round(Math.min(W, H) * 0.05);
  const btnC = buttonColors(brand.box);
  const body = [];
  const defs = [];
  if (bg) body.push(`<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${bg.toString('base64')}"/>`);
  else {
    defs.push(`<linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand.mid}"/><stop offset="1" stop-color="${brand.deep}"/></linearGradient>`);
    body.push(`<rect width="${W}" height="${H}" fill="url(#bgg)"/>`);
  }
  // The darkening: flat at `darken` over the words' box, fading out beyond it.
  if (L.wide) {
    const x1 = L.left + L.colW + pad;
    defs.push(`<linearGradient id="scrim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${Math.min(W, x1 + W * 0.22)}" y2="0"><stop offset="0" stop-color="#000" stop-opacity="${darken}"/><stop offset="${r1(x1 / Math.min(W, x1 + W * 0.22))}" stop-color="#000" stop-opacity="${darken}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`);
  } else {
    const y0 = Math.max(0, L.top - pad - H * 0.2);
    const y1 = Math.max(0, L.top - pad);
    defs.push(`<linearGradient id="scrim" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(y0)}" x2="0" y2="${H}"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${r1((y1 - y0) / (H - y0))}" stop-color="#000" stop-opacity="${darken}"/><stop offset="1" stop-color="#000" stop-opacity="${darken}"/></linearGradient>`);
  }
  if (darken > 0) body.push(`<rect width="${W}" height="${H}" fill="url(#scrim)"/>`);
  let y = L.top;
  L.head.lines.forEach((l, k) => body.push(`<text x="${r1(L.left)}" y="${r1(y + L.head.size * (0.84 + k * 1.1))}" font-family="Inter" font-weight="800" font-size="${L.head.size}" fill="#ffffff">${esc(l)}</text>`));
  y += L.headH;
  if (L.subFit) {
    y += 18;
    L.subFit.lines.forEach((l, k) => body.push(`<text x="${r1(L.left)}" y="${r1(y + L.subFit.size * (0.9 + k * 1.32))}" font-family="Inter" font-weight="500" font-size="${L.subFit.size}" fill="#ffffff">${esc(l)}</text>`));
    y += L.subFit.lines.length * L.subFit.size * 1.32;
  }
  if (L.btn) {
    y += 30;
    const b = L.btn;
    const label = fit(button, { width: b.w - b.size * 1.6, max: b.size, min: 18, maxLines: 1, weight: 700 });
    body.push(`<rect x="${r1(L.left)}" y="${r1(y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="${r1(b.h / 2)}" fill="${btnC.fill}"/>`);
    body.push(`<text x="${r1(L.left + b.w / 2)}" y="${r1(y + b.h / 2 + label.size * 0.36)}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${label.size}" fill="${btnC.ink}">${esc(label.lines[0] || '')}</text>`);
  }
  if (name) {
    const ns = Math.max(20, Math.round(Math.min(W, H) * 0.028));
    const nameFit = fit(text.clip(name, 40), { width: W * 0.5, max: ns, min: 16, maxLines: 1, weight: 700 });
    const ny = L.safe.top + nameFit.size;
    if (bg) body.push(`<rect x="${r1(L.left - 16)}" y="${r1(ny - nameFit.size * 1.15)}" width="${r1(media.textWidth(nameFit.lines[0] || '', nameFit.size, { weight: 700 }) + 32)}" height="${r1(nameFit.size * 1.6)}" rx="${r1(nameFit.size * 0.8)}" fill="#000" fill-opacity="0.55"/>`);
    body.push(`<text x="${r1(L.left)}" y="${r1(ny)}" font-family="Inter" font-weight="700" font-size="${nameFit.size}" fill="#ffffff">${esc(nameFit.lines[0] || '')}</text>`);
  }
  if (sample) {
    const s = Math.max(18, Math.round(Math.min(W, H) * 0.022));
    const pw = media.textWidth('SAMPLE', s, { weight: 800 }) + s * 1.6;
    const px = L.safe.right - pw;
    const py = L.safe.top;
    body.push(`<rect x="${r1(px)}" y="${r1(py)}" width="${r1(pw)}" height="${r1(s * 1.8)}" rx="${r1(s * 0.9)}" fill="#000" fill-opacity="0.6"/><text x="${r1(px + pw / 2)}" y="${r1(py + s * 1.25)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${s}" fill="#ffffff">SAMPLE</text>`);
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`, button: btnC };
}

// image: a picture's path (or null for a brand gradient). Returns { path, width, height, seconds: 0,
// files: [{ path, width, height, label, contrast, darken, button }] }.
async function adSizes(ctx, { image = null, headline, sub = '', button = '', color: c, sizes, name = '', look, sample = false } = {}) {
  const head = text.oneLine(headline || '');
  if (!head) throw new Error('Write the headline for the ad first.');
  const brand = look || M.lookFor(ctx, { color: c });
  const dir = M.scratch(ctx, 'ads');
  const files = [];
  for (const sz of sizeList(sizes)) {
    const L = layout(sz, { headline: head, sub: text.oneLine(sub || ''), button: text.clip(text.oneLine(button || ''), 30) });
    let bg = null;
    let check = null;
    if (image) {
      try {
        bg = await media.frame(ctx, image, { width: sz.w, height: sz.h, format: 'jpg', quality: 3 });
      } catch {
        throw new Error("That picture doesn't open. Save it as a JPG or PNG and try again, or leave it out.");
      }
      const jpg = path.join(dir, `bg-${sz.w}x${sz.h}.jpg`);
      fs.writeFileSync(jpg, bg);
      const box = L.wide ? { x: L.left - 10, y: L.top - 10, w: L.colW + 20, h: L.blockH + 20 } : { x: L.left - 10, y: L.top - 10, w: L.colW + 20, h: L.blockH + 20 };
      check = darkenFor(await pixelsOf(ctx, jpg, box));
    } else {
      // On the brand gradient: the darker end is under the words; check the lighter one to be safe.
      const rgb = color.hexToRgb(brand.mid);
      check = darkenFor(Buffer.from([...rgb, ...rgb, ...rgb]), { floor: 0 });
    }
    const { svg, button: btn } = adSvg(L, { bg, brand, headline: head, sub, button: L.btn ? text.clip(text.oneLine(button), 30) : '', name, darken: check.darken, sample });
    const png = await media.svgToPng(ctx, svg, { width: sz.w, height: sz.h });
    const file = path.join(dir, `ad-${sz.w}x${sz.h}.png`);
    fs.writeFileSync(file, png);
    files.push({ path: file, width: sz.w, height: sz.h, label: sz.label, contrast: check.contrast, darken: check.darken, button: L.btn ? btn.contrast : null, safe: L.story ? 'Stories safe zone kept clear (14% top, 35% bottom, 6% sides)' : null });
  }
  return { path: files[0].path, width: files[0].width, height: files[0].height, seconds: 0, files };
}

module.exports = { adSizes, SIZES, STORY_SAFE, darkenFor, layout, buttonColors, sizeList, fit };
