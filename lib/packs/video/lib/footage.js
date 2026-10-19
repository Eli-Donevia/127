// Background footage for a rendered video: one clip (or photo) per scene, taking turns, each trimmed
// to its scene, filled to the frame and dimmed a little so white text reads on top. Clips come from
// Pexels (Find stock footage) or the member's own Library files (clips or photos they added).

const fs = require('fs');
const path = require('path');
const { media } = require('../../_kit');
const { assetFile, idOf, isImage, isVideo } = require('./assets');

const MAX_SOURCES = 6;

// Local files for up to 6 footage items. Pexels clips are downloaded (free to use, credited);
// Library files are copied out of the Library. Returns [{ file, kind: 'video' | 'image', credit }].
async function gather(ctx, items, dir) {
  const out = [];
  for (const it of (items || []).slice(0, 12)) {
    if (out.length >= MAX_SOURCES) break;
    try {
      if (it && typeof it === 'object' && /^https:\/\//.test(String(it.link || ''))) {
        const file = await media.fetchToFile(ctx, it.link, { dir, name: `stock-${out.length}`, maxBytes: 90e6 });
        out.push({ file, kind: 'video', credit: { by: String(it.by || 'a Pexels creator'), page: String(it.page || 'https://www.pexels.com/') } });
        continue;
      }
      if (!idOf(it)) continue;
      const a = await assetFile(ctx, it);
      if (!a || !(isVideo(a) || isImage(a))) continue;
      const file = path.join(dir, `own-${out.length}${path.extname(a.name || '') || (isImage(a) ? '.jpg' : '.mp4')}`);
      fs.copyFileSync(a.path, file);
      out.push({ file, kind: isImage(a) ? 'image' : 'video', credit: null });
    } catch (e) {
      ctx.log(`A footage clip was skipped: ${String(e.message).slice(0, 90)}`);
    }
  }
  // Every video source must open and have a picture.
  const ok = [];
  for (const s of out) {
    if (s.kind === 'image') {
      ok.push(s);
      continue;
    }
    try {
      const info = await media.probe(s.file, { signal: ctx.signal });
      if (info.hasVideo && info.duration > 0.5) ok.push({ ...s, duration: info.duration });
    } catch {
      /* not a video */
    }
  }
  return ok;
}

// ffmpeg inputs and the filter that makes [bg] from footage, scene by scene. first: the input
// index of the first footage input. Returns { args, chain, credits } or null when there's no footage.
function backgroundFrom(sources, scenes, { W, H, fps = 30, first = 0 }) {
  if (!sources.length || !scenes.length) return null;
  const args = [];
  const parts = [];
  const used = new Map();
  scenes.forEach((sc, i) => {
    const src = sources[i % sources.length];
    const d = Math.max(0.5, sc.end - sc.start);
    const k = first + i;
    if (src.kind === 'image') {
      args.push('-loop', '1', '-framerate', String(fps), '-t', d.toFixed(2), '-i', src.file);
      const frames = Math.max(1, Math.round(d * fps));
      parts.push(`[${k}:v]scale=${Math.round(W * 1.5)}:${Math.round(H * 1.5)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.5)}:${Math.round(H * 1.5)},zoompan=z='1+0.07*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps},trim=duration=${d.toFixed(2)},setpts=PTS-STARTPTS,setsar=1,eq=saturation=0.9,drawbox=c=black@0.4:t=fill,format=yuv420p[s${i}]`);
    } else {
      // The same clip used again starts further in, so it doesn't show the same moment twice.
      const n = used.get(src.file) || 0;
      used.set(src.file, n + 1);
      const offset = src.duration ? (n * d) % Math.max(0.1, src.duration - Math.min(d, src.duration - 0.1)) : 0;
      args.push('-stream_loop', '-1', '-ss', offset.toFixed(2), '-t', d.toFixed(2), '-i', src.file);
      parts.push(`[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},trim=duration=${d.toFixed(2)},setpts=PTS-STARTPTS,setsar=1,eq=saturation=0.88,drawbox=c=black@0.42:t=fill,format=yuv420p[s${i}]`);
    }
  });
  const chain = `${parts.join(';')};${scenes.map((_, i) => `[s${i}]`).join('')}concat=n=${scenes.length}:v=1:a=0,vignette=PI/5,format=yuv420p[bg]`;
  const credits = [];
  const seen = new Set();
  for (const s of sources) if (s.credit && !seen.has(s.credit.page)) seen.add(s.credit.page) && credits.push(s.credit);
  return { args, chain, credits };
}

module.exports = { gather, backgroundFrom, MAX_SOURCES };
