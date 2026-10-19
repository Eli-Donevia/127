// Renders the 15-second concept preview for one brand: four scenes that follow the script, the
// product's real name and price from its store, captions burned in, 1080x1920 H.264. With a Pexels
// key, scenes 1 and 3 are stock B-roll; without it they are shot cards that show what to film.
// The member's own footage replaces all of it once they have the product.

const fs = require('fs');
const path = require('path');
const { media, svg, money, text, color } = require('../../_kit');

const W = 1080;
const H = 1920;

async function fetchImage(ctx, url) {
  if (!url || typeof ctx.fetch !== 'function') return null;
  try {
    const u = `${url}${url.includes('?') ? '&' : '?'}width=900`;
    const res = await ctx.fetch(u, { headers: { Accept: 'image/jpeg,image/png;q=0.9', 'User-Agent': 'Mozilla/5.0 (compatible; 127-workflows/0.1; +https://127group.io)' } });
    if (!res || !res.ok) return null;
    const type = String(res.headers.get('content-type') || '').split(';')[0];
    if (!/image\/(jpeg|png)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 1000 && buf.length < 8e6 ? { data: buf, type } : null;
  } catch {
    return null;
  }
}

// Up to `count` portrait stock clips from Pexels (their API; key from the member's connection).
async function pexelsClips(ctx, key, queries, count = 2) {
  const out = [];
  for (const q of queries.slice(0, count)) {
    try {
      const res = await ctx.fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=5`, { headers: { Authorization: key } });
      if (!res || !res.ok) continue;
      const j = await res.json();
      const v = (j.videos || []).find((x) => x.duration >= 4 && (x.video_files || []).some((f) => f.height >= f.width && f.width >= 540 && f.width <= 1440));
      if (!v) continue;
      const f = v.video_files.filter((x) => x.height >= x.width && x.width >= 540 && x.width <= 1440).sort((a, b) => b.width - a.width)[0];
      const file = await media.fetchToFile(ctx, f.link, { maxBytes: 80e6, name: `stock-${out.length}` });
      out.push({ file, by: (v.user && v.user.name) || 'Pexels', url: v.url });
    } catch {
      // one stock clip missing is fine: that scene uses its shot card
    }
  }
  return out;
}

function base(pal, body, defs = '') {
  return svg.doc({
    width: W,
    height: H,
    defs: svg.linearGradient('bg', [pal.ink, color.darken(pal.primary, 0.55)]) + defs,
    body: `<rect width="${W}" height="${H}" fill="url(#bg)"/>${body}`,
  });
}

function badge(brandName) {
  return [
    svg.pill({ x: 80, y: 96, label: 'CONCEPT PREVIEW', size: 26, weight: 700, fill: '#ffffff', color: '#111111' }).svg,
    svg.text({ x: 80, y: 230, lines: [text.clip(`for ${brandName}`, 40)], size: 40, weight: 600, fill: '#ffffff', opacity: 0.85 }),
  ].join('');
}

function shotCard(n, shot, brandName, pal) {
  const f = svg.fit(shot, { width: 900, maxSize: 76, minSize: 40, maxLines: 4, weight: 700 });
  const body = [
    badge(brandName),
    svg.text({ x: 80, y: 520, lines: [`SHOT ${n}`], size: 44, weight: 700, fill: pal.accent, letterSpacing: 4 }),
    svg.text({ x: 80, y: 520 + 110, lines: f.lines, size: f.size, weight: 700, fill: '#ffffff', lineHeight: 1.12 }),
    svg.rect({ x: 80, y: 470, w: 8, h: 40 + f.lines.length * f.size * 1.12 + 120, fill: pal.accent }),
  ].join('');
  return base(pal, body);
}

function productCard(brand, img, pal) {
  const p = brand.product || {};
  const name = svg.fit(p.title || brand.name, { width: 900, maxSize: 64, minSize: 36, maxLines: 2, weight: 700 });
  const pic = img
    ? `${svg.rect({ x: 140, y: 310, w: 800, h: 800, r: 28, fill: '#ffffff' })}${svg.image({ x: 160, y: 330, w: 760, h: 760, data: img.data, type: img.type, fit: 'xMidYMid meet' })}`
    : `${svg.rect({ x: 140, y: 310, w: 800, h: 800, r: 28, fill: pal.surface })}${svg.text({ x: 540, y: 790, lines: [text.initials(brand.name, 2)], size: 220, weight: 800, fill: pal.primary, anchor: 'middle' })}`;
  const body = [
    badge(brand.name),
    pic,
    svg.text({ x: 80, y: 1210, lines: name.lines, size: name.size, weight: 700, fill: '#ffffff', lineHeight: 1.1 }),
    p.price ? svg.pill({ x: 80, y: 1210 + (name.lines.length - 1) * name.size * 1.1 + 40, label: money.usd(p.price), size: 36, weight: 700, fill: pal.accent, color: pal.onAccent }).svg : '',
  ].join('');
  return base(pal, body);
}

function endCard(brand, pal) {
  const nm = svg.fit(brand.name, { width: 900, maxSize: 110, minSize: 50, maxLines: 2, weight: 800 });
  const body = [
    badge(brand.name),
    svg.text({ x: 80, y: 560, lines: nm.lines, size: nm.size, weight: 800, fill: '#ffffff', lineHeight: 1.05 }),
    svg.text({ x: 80, y: 560 + nm.lines.length * nm.size * 1.05 + 40, lines: [brand.domain], size: 48, weight: 600, fill: pal.accent }),
    svg.text({ x: 80, y: 1760, lines: ['Made from your public product page.', 'Not posted anywhere.'], size: 30, weight: 500, fill: '#ffffff', opacity: 0.7, lineHeight: 1.3 }),
  ].join('');
  return base(pal, body);
}

// A still frame held for `seconds` with a short fade in and out, as an MP4 with a silent track.
async function still(ctx, svgStr, seconds, out) {
  const dir = media.scratch(ctx, 'still');
  const img = path.join(dir, 'frame.png');
  fs.writeFileSync(img, await media.svgToPng(ctx, svgStr, { width: W, height: H }));
  const vf = `fps=30,fade=t=in:st=0:d=0.2,fade=t=out:st=${Math.max(0, seconds - 0.2).toFixed(2)}:d=0.2,format=yuv420p`;
  await media.ffmpeg(['-loop', '1', '-framerate', '30', '-i', img, ...media.silence(seconds), '-vf', vf, '-t', String(seconds), '-map', '0:v', '-map', '1:a', ...media.encodeArgs({ fps: 30 }), out], { timeoutSec: 120, signal: ctx.signal });
  return out;
}

// Words timed evenly inside each script line, for the kit's caption renderer.
function captionWords(lines) {
  const words = [];
  for (const l of lines) {
    const ws = String(l.caption || '').split(/\s+/).filter(Boolean);
    if (ws.length && !/[.!?]$/.test(ws[ws.length - 1])) ws[ws.length - 1] += '.';
    const span = Math.max(0.2, (l.end - l.at - 0.4) / Math.max(1, ws.length));
    ws.forEach((w, k) => words.push({ w, s: l.at + 0.2 + k * span, e: l.at + 0.2 + (k + 1) * span }));
  }
  return words;
}

async function renderConcept(ctx, { brand, script, cat, palette, pexelsKey }) {
  const pal = palette || color.palette('bold');
  const dir = media.scratch(ctx, 'ugc');
  const img = brand.product && brand.product.image ? await fetchImage(ctx, brand.product.image) : null;
  const stock = pexelsKey ? await pexelsClips(ctx, pexelsKey, cat.stock, 2) : [];
  const segs = [];
  const cards = [];
  for (const [i, line] of script.lines.entries()) {
    const dur = line.end - line.at;
    const out = path.join(dir, `s${i}.mp4`);
    const clip = i === 0 ? stock[0] : i === 2 ? stock[1] : null;
    if (clip) {
      await media.burn(ctx, { input: clip.file, out, start: 0, end: dur, loudnorm: false, maxMB: 8 });
    } else {
      const s = i === 1 ? productCard(brand, img, pal) : i === 3 ? endCard(brand, pal) : shotCard(i + 1, line.shot, brand.name, pal);
      cards.push(s);
      await still(ctx, s, dur, out);
    }
    segs.push(out);
  }
  const joined = path.join(dir, 'joined.mp4');
  const args = [];
  for (const s of segs) args.push('-i', s);
  const fc = `${segs.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${segs.length}:v=1:a=1[v][a]`;
  await media.ffmpeg([...args, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', ...media.encodeArgs({ fps: 30 }), joined], { timeoutSec: 300, signal: ctx.signal });
  const assFile = path.join(dir, 'captions.ass');
  fs.writeFileSync(assFile, media.captionsAss(captionWords(script.lines), { style: 'bold', width: W, height: H, cy: 1590 }));
  const final = path.join(dir, 'concept.mp4');
  await media.burn(ctx, { input: joined, ass: assFile, out: final, loudnorm: false, maxMB: 12 });
  const poster = await media.frame(ctx, final, { at: 4.6 });
  return { file: final, poster, stock: stock.map((s) => ({ by: s.by, url: s.url })), photo: !!img, cards: cards.length };
}

module.exports = { renderConcept, captionWords, shotCard, productCard, endCard, fetchImage, W, H };
