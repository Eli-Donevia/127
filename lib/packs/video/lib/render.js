// Rendering clips: word-by-word captions, a hook title, the member's handle, and either their own
// footage reframed to 9:16 (media.burn) or an audiogram scene for audio-only sources and the sample
// talk (a moving gradient in their colors, their initials, a live voice meter, captions).
// Output: H.264 + AAC MP4, 1080x1920 for vertical, under 22 MB.

const fs = require('fs');
const path = require('path');
const { media, text, color } = require('../../_kit');
const { slice, r2 } = require('./words');

const W9 = 1080;
const H9 = 1920;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Greedy line wrap by measured width (ASS units). Returns lines of text.
function wrapAss(str, size, maxW, weight) {
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && media.textWidth(next, size, { weight, mode: 'ass' }) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// The biggest size (from max down) at which the title fits maxW in at most maxLines lines.
function fitTitle(title, { maxW, max = 64, min = 40, maxLines = 3, weight = 800 }) {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrapAss(title, size, maxW, weight);
    if (lines.length <= maxLines && lines.every((l) => media.textWidth(l, size, { weight, mode: 'ass' }) <= maxW)) return { size, lines };
  }
  return { size: min, lines: wrapAss(title, min, maxW, weight).slice(0, maxLines) };
}

const ff = (n) => Math.round(n * 10) / 10;

// Title box, handle and the SAMPLE tag as ASS styles and events. Returns { styles, events, bottom }.
function overlay({ W = W9, H = H9, look, title, handle, sample, dur, top, titleStyle = 'box' }) {
  const unit = Math.min(W, H) / 1080;
  const styles = [media.assStyle({ name: 'Ovl', font: 'Inter', size: 40 * unit, align: 5 })];
  const events = [];
  let bottom = top != null ? top : H > W ? 300 * unit : 70 * unit;
  const end = dur + 0.05;
  if (sample) {
    const label = 'SAMPLE';
    const size = 26 * unit;
    const tw = media.textWidth(label, size, { weight: 800, mode: 'ass' }) + size * 0.25 * label.length * 0.12;
    const bw = tw + 36 * unit;
    const bh = 46 * unit;
    const x = W - bw - 40 * unit;
    const y = H > W ? 190 * unit : 36 * unit;
    events.push(media.assEvent({ layer: 6, start: 0, end, style: 'Ovl', text: `{\\an7\\pos(${ff(x)},${ff(y)})\\bord0\\shad0\\c&H000000&\\alpha&H60&\\p1}${media.assRoundRect(bw, bh, bh / 2)}{\\p0}` }));
    events.push(media.assEvent({ layer: 7, start: 0, end, style: 'Ovl', text: `{\\an5\\pos(${ff(x + bw / 2)},${ff(y + bh / 2)})\\fnInter ExtraBold\\fs${ff(size)}\\fsp${ff(2 * unit)}\\bord0\\shad0\\c&HFFFFFF&}${label}` }));
  }
  if (title) {
    const maxW = (H > W ? 820 : 1100) * unit;
    const { size, lines } = fitTitle(text.oneLine(title), { maxW, max: (H > W ? 64 : 58) * unit, min: 40 * unit, maxLines: 2 });
    const lineH = size * 1.08;
    const padX = 34 * unit;
    const padY = 22 * unit;
    const widths = lines.map((l) => media.textWidth(l, size, { weight: 800, mode: 'ass' }));
    const bw = Math.max(...widths) + padX * 2;
    const bh = lines.length * lineH + padY * 2;
    const x0 = (W - bw) / 2;
    const y0 = bottom;
    const boxC = titleStyle === 'white' ? '#ffffff' : look.box;
    const inkC = titleStyle === 'white' ? '#0b0b10' : look.onBox;
    const anim = (x, y) => `\\move(${ff(x)},${ff(y + 26 * unit)},${ff(x)},${ff(y)},0,240)\\fad(160,0)`;
    events.push(media.assEvent({ layer: 4, start: 0, end, style: 'Ovl', text: `{\\an7${anim(x0, y0)}\\bord0\\shad${ff(6 * unit)}\\4c&H000000&\\4a&HA0&\\c${media.assTagColor(boxC)}\\p1}${media.assRoundRect(bw, bh, 26 * unit)}{\\p0}` }));
    lines.forEach((l, i) => {
      const cy = y0 + padY + lineH * i + lineH / 2;
      events.push(media.assEvent({ layer: 5, start: 0, end, style: 'Ovl', text: `{\\an5${anim(W / 2, cy)}\\fnInter ExtraBold\\fs${ff(size)}\\bord0\\shad0\\c${media.assTagColor(inkC)}}${media.assText(l)}` }));
    });
    bottom = y0 + bh;
  }
  if (handle) {
    const h = `@${String(handle).replace(/^@/, '')}`;
    const y = bottom + 46 * unit;
    events.push(media.assEvent({ layer: 5, start: 0, end, style: 'Ovl', text: `{\\an5\\pos(${ff(W / 2)},${ff(y)})\\fnInter SemiBold\\fs${ff(32 * unit)}\\bord0\\shad${ff(3 * unit)}\\4c&H000000&\\4a&H70&\\c&HFFFFFF&\\alpha&H30&\\fad(300,0)}${media.assText(h)}` }));
    bottom = y + 20 * unit;
  }
  return { styles, events, bottom };
}

// Where captions sit: lower middle for vertical (clear of the app buttons and post text), lower
// third for wide video.
function captionY(W, H, layout) {
  if (W > H) return H * 0.8;
  if (W === H) return H * 0.74;
  return layout === 'audiogram' ? H * 0.6 : H * 0.6;
}

// The ASS file for one clip. words are absolute (source clock); the clip starts at `start`.
function clipAss({ words, start, end, look, style = 'bold', W = W9, H = H9, title, handle, sample, layout = 'crop', extra = {} }) {
  const dur = end - start;
  const ovl = overlay({ W, H, look, title, handle, sample, dur, titleStyle: style === 'clean' ? 'white' : 'box' });
  const inClip = slice(words, start, end).map((x) => ({ w: x.w, s: x.s - start, e: Math.min(x.e, end) - start }));
  const palette = { text: '#ffffff', pop: look.pop, outline: look.outline, box: look.box, onBox: look.onBox };
  return media.captionsAss(inClip, {
    style,
    width: W,
    height: H,
    cy: captionY(W, H, layout),
    palette,
    title: title || 'Clip',
    extra: { styles: [...ovl.styles, ...(extra.styles || [])], events: [...(extra.events || []), ...ovl.events] },
  });
}

// ---------- audiogram scene ----------

// The static layer: initials badge, name and business line, as a transparent PNG covering just that
// block (overlaying a small image is much faster than a full frame). Returns { svg, x, y, w, h }.
function audiogramSvg({ W = W9, H = H9, look, name, line, initials }) {
  const unit = Math.min(W, H) / 1080;
  const w = Math.round(800 * unit);
  const h = Math.round(560 * unit);
  const cxFull = W / 2;
  const cyFull = H > W ? 700 * unit : H * 0.38;
  const x = Math.round(cxFull - w / 2);
  const y = Math.round(cyFull - 180 * unit);
  const cx = cxFull - x;
  const cy = cyFull - y;
  const r = 128 * unit;
  const ini = esc(String(initials || '?').slice(0, 2).toUpperCase());
  const iniSize = ini.length > 1 ? 104 * unit : 124 * unit;
  const nameSize = 52 * unit;
  const lineSize = 32 * unit;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${look.pop}"/><stop offset="1" stop-color="${look.box}"/></linearGradient>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.lighten(look.mid, 0.12)}"/><stop offset="1" stop-color="${look.deep}"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${18 * unit}"/></filter>
</defs>
<circle cx="${cx}" cy="${cy + 14 * unit}" r="${r + 10 * unit}" fill="#000" opacity="0.35" filter="url(#soft)"/>
<circle cx="${cx}" cy="${cy}" r="${r + 9 * unit}" fill="url(#ring)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#face)"/>
<text x="${cx}" y="${cy + iniSize * 0.36}" text-anchor="middle" font-family="Inter" font-weight="900" font-size="${iniSize}" fill="#ffffff" letter-spacing="${-2 * unit}">${ini}</text>
<text x="${cx}" y="${cy + r + 92 * unit}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${nameSize}" fill="#ffffff">${esc(name)}</text>
${line ? `<text x="${cx}" y="${cy + r + 92 * unit + lineSize * 1.6}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="${lineSize}" fill="#ffffff" fill-opacity="0.72">${esc(line)}</text>` : ''}
</svg>`;
  return { svg, x, y, w, h };
}

// Loudness of an audio file over time: one value from 0 to 1 per 1/rate seconds.
async function envelope(ctx, file, { start = 0, dur, rate = 25 } = {}) {
  const { stdout } = await media.ffmpeg(['-ss', String(start), '-t', String(dur), '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { timeoutSec: 120, signal: ctx && ctx.signal });
  const n = Math.floor(stdout.length / 2);
  const hop = Math.round(8000 / rate);
  const out = [];
  for (let i = 0; i + hop <= n; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) {
      const v = stdout.readInt16LE((i + j) * 2);
      s += v * v;
    }
    out.push(Math.sqrt(s / hop));
  }
  const sorted = out.slice().sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  let prev = 0;
  return out.map((v) => {
    const x = Math.min(1, v / (ref || 1));
    prev = x > prev ? prev * 0.35 + x * 0.65 : prev * 0.8 + x * 0.2; // quick rise, soft fall
    return prev;
  });
}

// The live voice meter: rounded bars that move with the voice. Each bar is its own event with its
// height rounded to one of 10 steps, so libass draws each shape once and reuses it (fast renders).
function meterEvents(env, { W = W9, H = H9, look, rate = 25, fps = 15 }) {
  const unit = Math.min(W, H) / 1080;
  const cx = W / 2;
  const y = H > W ? 1345 * unit : H * 0.62;
  const bars = 25;
  const bw = 12 * unit;
  const gap = 10 * unit;
  const maxH = 96 * unit;
  const minH = 12 * unit;
  const total = bars * bw + (bars - 1) * gap;
  const x0 = cx - total / 2;
  const pop = media.assTagColor(look.pop);
  const steps = 10;
  const shapes = Array.from({ length: steps + 1 }, (_, k) => {
    const h = minH + ((maxH - minH) * k) / steps;
    return { h, d: media.assRoundRect(bw, h, bw / 2) };
  });
  const events = [];
  const frames = Math.floor((env.length / rate) * fps);
  for (let f = 0; f < frames; f++) {
    const t0 = f / fps;
    const t1 = (f + 1) / fps;
    const at = (t) => env[Math.max(0, Math.min(env.length - 1, Math.round(t * rate)))] || 0;
    for (let i = 0; i < bars; i++) {
      const k = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
      const bell = 0.3 + 0.7 * Math.cos((k * Math.PI) / 2) ** 1.4;
      const wob = 0.72 + 0.28 * Math.sin(f * 1.3 + i * 2.1);
      const v = Math.min(1, at(t0 - k * 0.12) * bell * wob * 1.2);
      const sh = shapes[Math.round(v * steps)];
      const x = x0 + i * (bw + gap);
      events.push(media.assEvent({ layer: 1, start: t0, end: t1, style: 'Ovl', text: `{\\an7\\pos(${ff(x)},${ff(y - sh.h / 2)})\\bord0\\shad0\\c${pop}\\p1}${sh.d}{\\p0}` }));
    }
  }
  return events;
}

// Renders the audiogram scene for [start, start + dur] of an audio (or video) file, with an ASS
// file burned on top. Returns the output path.
async function renderAudiogram(ctx, { audio, start = 0, dur, W = W9, H = H9, look, assText, png, at = { x: 0, y: 0 }, out, fps = 30, maxMB = 22 }) {
  const dir = media.scratch(ctx, 'gram');
  const dst = out || path.join(dir, 'clip.mp4');
  const assFile = path.join(dir, 'clip.ass');
  fs.writeFileSync(assFile, assText);
  const pngFile = path.join(dir, 'badge.png');
  fs.writeFileSync(pngFile, png);
  const lw = Math.round(W / 4 / 2) * 2;
  const lh = Math.round(H / 4 / 2) * 2;
  const hex = (c) => `0x${String(c).replace('#', '')}`;
  const bg = `gradients=s=${lw}x${lh}:r=${fps}:d=${dur.toFixed(2)}:c0=${hex(look.deep)}:c1=${hex(look.mid)}:c2=${hex(color.mix(look.glow, look.deep, 0.15))}:c3=${hex(look.deep)}:n=4:speed=0.01:type=radial:seed=7`;
  const args = ['-f', 'lavfi', '-i', bg, '-loop', '1', '-framerate', String(fps), '-t', dur.toFixed(2), '-i', pngFile];
  if (audio) args.push('-ss', String(start), '-t', dur.toFixed(2), '-i', audio);
  else args.push(...media.silence(dur));
  const filter = [
    `[0:v]vignette=PI/4.6,scale=${W}:${H}:flags=bicubic,format=yuv420p[bg]`,
    `[bg][1:v]overlay=${at.x}:${at.y}:format=yuv420[s1]`,
    `[s1]ass=${media.filterPath(assFile)},format=yuv420p[v]`,
    audio ? `[2:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]` : null,
  ].filter(Boolean).join(';');
  args.push('-filter_complex', filter, '-map', '[v]', '-map', audio ? '[a]' : '2:a', '-t', dur.toFixed(2), ...media.encodeArgs({ crf: 23, fps, maxrateK: media.bitrateFor(dur, { maxMB }) }), dst);
  await media.ffmpeg(args, { timeoutSec: 600, signal: ctx && ctx.signal });
  return dst;
}

// Light punch-ins on alternate sentences for talking-head footage (a common jump-cut style).
function punchIns(words, start, end) {
  const out = [];
  let k = 0;
  let segStart = 0;
  const inClip = slice(words, start, end);
  for (let i = 0; i < inClip.length; i++) {
    const x = inClip[i];
    if (/[.!?]$/.test(x.w)) {
      const segEnd = Math.min(end - start, x.e - start + 0.05);
      if (k % 2 === 1 && segEnd - segStart > 1.2) out.push({ from: segStart, to: segEnd, scale: 1.08 });
      segStart = segEnd;
      k++;
    }
  }
  return out;
}

module.exports = { overlay, clipAss, captionY, fitTitle, wrapAss, audiogramSvg, envelope, meterEvents, renderAudiogram, punchIns, W9, H9, r2 };
