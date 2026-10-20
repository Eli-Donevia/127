// Labeled stand-ins for what the AI models would make, so every workflow runs end to end before a
// model service is cleared and switched on. A sample clip is the member's own photo (or a card in
// their colors with the shot written on it) with a slow push-in and a SAMPLE tag; a sample image is
// the same still. Each says what the real model would do, and costs nothing (sample: true).

const fs = require('fs');
const path = require('path');
const { media, svg, color, text } = require('../../_kit');

const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };

function hash(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

function sizeOf(aspect) {
  return SIZES[aspect] || SIZES['9:16'];
}

// The member's colors from their business name (or a fixed seed), as { bg, ink, accent, soft }.
function lookOf(seed) {
  const hex = color.isHex(seed) ? seed : null;
  const p = color.palette(hex || 'clean', hex ? 0 : Math.abs(hash(String(seed || 'studio'))) % 4);
  const bg = color.darken(p.primary, 0.45);
  return { bg, ink: color.readableOn(bg), accent: p.accent, soft: p.surface };
}

function tag(W, H, label) {
  const u = Math.min(W, H) / 1080;
  return svg.pill({ x: 48 * u, y: 64 * u, label, size: 30 * u, weight: 700, fill: '#000000', color: '#ffffff' }).svg;
}

// A still in the member's colors with the shot written on it (no photo).
function cardSvg({ W, H, look, title, lines }) {
  const u = Math.min(W, H) / 1080;
  const pad = 80 * u;
  const head = svg.fit(title, { width: W - pad * 2, height: H * 0.3, maxSize: 72 * u, minSize: 36 * u, maxLines: 3, weight: 800 });
  const body = svg.fit(lines, { width: W - pad * 2, height: H * 0.35, maxSize: 40 * u, minSize: 24 * u, maxLines: 8, weight: 500 });
  const top = H * 0.32;
  return svg.doc({
    width: W,
    height: H,
    defs: svg.linearGradient('g', [look.bg, color.darken(look.bg, 0.5)]),
    body: [
      svg.rect({ w: W, h: H, fill: 'url(#g)' }),
      svg.circle({ cx: W * 0.82, cy: H * 0.18, r: Math.min(W, H) * 0.32, fill: look.accent, opacity: 0.22 }),
      svg.text({ x: pad, y: top, lines: head.lines, size: head.size, weight: 800, fill: look.ink }),
      svg.text({ x: pad, y: top + head.lines.length * head.size * 1.15 + 40 * u, lines: body.lines, size: body.size, weight: 500, fill: look.ink, opacity: 0.85 }),
      tag(W, H, 'SAMPLE'),
    ].join(''),
  });
}

// The member's photo cropped to fill the frame, with the SAMPLE tag on top.
async function photoPng(ctx, image, { W, H, label = 'SAMPLE' }) {
  const dir = media.scratch(ctx, 'sample');
  const crop = path.join(dir, 'crop.png');
  await media.ffmpeg(['-i', image, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, '-frames:v', '1', crop], { timeoutSec: 60, signal: ctx.signal });
  const data = fs.readFileSync(crop);
  const doc = svg.doc({ width: W, height: H, body: [svg.image({ x: 0, y: 0, w: W, h: H, data, type: 'image/png' }), tag(W, H, label)].join('') });
  return media.svgToPng(ctx, doc, { width: W, height: H });
}

// A sample clip: { path, seconds, width, height } or null when this server can't render.
// image: a local file path (the member's photo) or null. shot: the words the real model would get.
async function clip(ctx, { image, title, shot, seconds = 5, aspect = '9:16', seed } = {}) {
  if (!media.canRender(ctx)) return null;
  const [W, H] = sizeOf(aspect);
  const png = image
    ? await photoPng(ctx, image, { W, H })
    : await media.svgToPng(ctx, cardSvg({ W, H, look: lookOf(seed), title: text.clip(title || 'AI clip', 80), lines: text.clip(shot || '', 260) }), { width: W, height: H });
  const out = path.join(media.scratch(ctx, 'clip'), 'sample.mp4');
  await media.textCard(ctx, { png, seconds, W, H, push: 0.08, out, fade: 0.2 });
  return { path: out, seconds, width: W, height: H };
}

// A sample image: { path, width, height } or null when this server can't render.
async function image(ctx, { photo, title, shot, aspect = '1:1', seed } = {}) {
  if (!media.canRender(ctx)) return null;
  const [W, H] = sizeOf(aspect);
  const png = photo
    ? await photoPng(ctx, photo, { W, H })
    : await media.svgToPng(ctx, cardSvg({ W, H, look: lookOf(seed), title: text.clip(title || 'AI image', 80), lines: text.clip(shot || '', 260) }), { width: W, height: H });
  const out = path.join(media.scratch(ctx, 'img'), 'sample.png');
  fs.writeFileSync(out, png);
  return { path: out, width: W, height: H };
}

// A quiet sample sound of `seconds` (a soft tone bed), as a WAV path, or null without ffmpeg.
async function sound(ctx, { seconds = 10 } = {}) {
  if (!media.canRender(ctx)) return null;
  const out = path.join(media.scratch(ctx, 'snd'), 'sample.wav');
  const s = Math.max(1, Math.min(60, Number(seconds) || 10));
  await media.ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${s}`, '-f', 'lavfi', '-i', `sine=frequency=330:duration=${s}`, '-filter_complex', `[0][1]amix=inputs=2,volume=0.15,afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, s - 0.8)}:d=0.8[a]`, '-map', '[a]', '-ar', '48000', '-ac', '2', out], { timeoutSec: 60, signal: ctx.signal });
  return { path: out, seconds: s };
}

module.exports = { SIZES, sizeOf, lookOf, clip, image, sound, cardSvg };
