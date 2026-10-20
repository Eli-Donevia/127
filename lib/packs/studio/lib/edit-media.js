// Low-level helpers for the studio's editing area (lib/edit.js): output settings every edit shares,
// ffmpeg runs with member-readable errors, silence detection, the member's video colors, a music bed
// made in code and a short labeled sample clip for runs with no video.
//
// Every edit writes the same kind of file: H.264 high profile, yuv420p, tagged bt709 (TV range),
// 30 fps, AAC 48 kHz stereo at -14 LUFS, +faststart, and a bitrate cap that keeps it under about
// 21 MB (the Library takes 25). ffmpeg runs through the kit (media.ffmpeg / media.exec) only.
// Adapted from the video pack's lib/look.js and lib/music.js (a pack never requires another's files).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { media, color, brain, text } = require('../../_kit');

const FPS = 30;
const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
const ASPECTS = Object.keys(SIZES);
const MAX_MB = 21;
const BT709 = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
const LOUD = 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';
const FFMPEG = () => process.env.FFMPEG_PATH || 'ffmpeg';
// The render lane is shared, so each encode keeps to a couple of threads (EDIT_THREADS to change).
const THREADS = () => String(Math.max(1, Math.min(8, Number(process.env.EDIT_THREADS) || 2)));

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function sizeOf(aspect) {
  return SIZES[aspect] || SIZES['9:16'];
}

// The nearest of our four shapes to a width and height.
function aspectOf(w, h) {
  if (!w || !h) return '9:16';
  const r = w / h;
  let best = '9:16';
  let gap = Infinity;
  for (const [k, [W, H]] of Object.entries(SIZES)) {
    const d = Math.abs(Math.log(r / (W / H)));
    if (d < gap) {
      gap = d;
      best = k;
    }
  }
  return best;
}

// Output arguments for every edit: video, audio and container settings in one place.
function encodeArgs(seconds, { crf = 21, maxMB = MAX_MB } = {}) {
  const k = media.bitrateFor(seconds, { maxMB, floorK: 450 });
  return [
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-maxrate', `${k}k`, '-bufsize', `${k * 2}k`,
    '-colorspace', 'bt709', '-color_trc', 'bt709', '-color_primaries', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-threads', THREADS(), '-movflags', '+faststart',
  ];
}

// Runs ffmpeg. A failure becomes a member-readable error (the raw text stays on e.detail for tests
// and server logs, never in what the member reads).
async function run(ctx, args, { timeoutSec = 600, what = 'The edit' } = {}) {
  try {
    return await media.ffmpeg(['-filter_complex_threads', THREADS(), ...args], { timeoutSec, signal: ctx && ctx.signal });
  } catch (e) {
    if (/Stopped/.test(String(e && e.message))) throw e;
    const err = new Error(e && e.code === 'ETIMEDOUT' ? `${what} took too long, so it was stopped. Try a shorter video.` : `${what} didn't render. Export the video again as an MP4 from your phone or editor and rerun, or try a shorter clip.`);
    err.detail = String((e && e.message) || e).slice(-1200);
    throw err;
  }
}

// Size, length and streams of a file, with a member-readable error when it won't open.
async function info(ctx, file, what = 'That video') {
  try {
    const i = await media.probe(file, { signal: ctx && ctx.signal });
    if (!(i.duration > 0.2) && i.hasVideo) i.duration = 0;
    return i;
  } catch (e) {
    if (/Stopped/.test(String(e && e.message))) throw e;
    throw new Error(`${what} doesn't open. Save it as an MP4 (or a JPG or PNG for a picture) and try again.`);
  }
}

function scratch(ctx, prefix = 'edit') {
  return media.scratch(ctx, `studio-${prefix}`);
}

// What every edit returns: { path, seconds, width, height } plus extras.
async function done(ctx, file, extra = {}) {
  const i = await info(ctx, file, 'The finished video');
  return { path: file, seconds: r2(i.duration), width: i.width, height: i.height, bytes: i.bytes, ...extra };
}

const isStill = (file) => /\.(jpe?g|png|webp|gif|bmp|tiff?|heic)$/i.test(String(file));

// The video chain that turns a srcW x srcH picture into W x H: crop to fill (focus slides the window),
// or the whole picture over a blurred copy of itself. Ends at outLabel, already 30 fps.
function fillChain({ srcW, srcH, W, H, focus = 0.5, fill = 'crop', inLabel = '[0:v]', outLabel = '[v]' }) {
  return media.verticalFilter({ srcW, srcH, W, H, layout: fill === 'blur' ? 'fit' : 'crop', focus, fps: FPS, inLabel, outLabel });
}

// ---------- silence ----------

// Quiet stretches of a file's sound: [{ start, end }] in seconds.
async function detectSilence(ctx, file, { threshold = -35, minSilence = 0.45, duration } = {}) {
  let stderr = '';
  try {
    ({ stderr } = await media.exec(FFMPEG(), ['-hide_banner', '-nostdin', '-i', file, '-vn', '-af', `silencedetect=n=${threshold}dB:d=${minSilence}`, '-f', 'null', '-'], { timeoutSec: 300, signal: ctx && ctx.signal }));
  } catch (e) {
    if (/Stopped/.test(String(e && e.message))) throw e;
    throw new Error("We couldn't read the sound in that video. Export it again as an MP4 and rerun.");
  }
  const out = [];
  let open = null;
  for (const line of String(stderr).split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && open != null) {
      out.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  if (open != null && duration) out.push({ start: open, end: duration });
  return out;
}

// Merges ranges that touch and drops tiny ones. ranges: [{ start, end }].
function mergeRanges(ranges, { minLen = 0.04, join = 0.02 } = {}) {
  const sorted = ranges.filter((r) => r && r.end - r.start > minLen).map((r) => ({ start: r.start, end: r.end })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + join) last.end = Math.max(last.end, r.end);
    else out.push(r);
  }
  return out;
}

// The parts to keep once `cuts` come out of [0, duration].
function keepFrom(cuts, duration, { minKeep = 0.08 } = {}) {
  const keep = [];
  let t = 0;
  for (const c of mergeRanges(cuts)) {
    if (c.start - t > minKeep) keep.push({ start: r2(t), end: r2(c.start) });
    t = Math.max(t, c.end);
  }
  if (duration - t > minKeep) keep.push({ start: r2(t), end: r2(duration) });
  return keep;
}

// ---------- words ----------

// Any word list to [{ w, s, e }] in time order: [w, s, e], { w, s, e }, { word, start, end }, or the
// list of video.transcribe outputs ({ words: [[w, s, e]] } per block, { error } items skipped).
function flatWords(words) {
  const list = [];
  const add = (x) => {
    if (Array.isArray(x)) list.push({ w: String(x[0] == null ? '' : x[0]), s: Number(x[1]), e: Number(x[2]) });
    else if (x && typeof x === 'object' && Array.isArray(x.words)) x.words.forEach(add);
    else if (x && typeof x === 'object' && !x.error) list.push({ w: String(x.w != null ? x.w : x.word != null ? x.word : x.text != null ? x.text : ''), s: Number(x.s != null ? x.s : x.start), e: Number(x.e != null ? x.e : x.end) });
  };
  (Array.isArray(words) ? words : []).forEach(add);
  const clean = list.filter((x) => x.w.trim() && Number.isFinite(x.s) && Number.isFinite(x.e)).map((x) => ({ w: x.w.trim(), s: r2(x.s), e: r2(Math.max(x.e, x.s + 0.05)) }));
  clean.sort((a, b) => a.s - b.s);
  // Blocks overlap by a second or so: drop repeats.
  const out = [];
  for (const x of clean) {
    const last = out[out.length - 1];
    if (last && x.s < last.e - 0.02 && x.w === last.w) continue;
    if (last && x.s < last.s + 0.01) continue;
    out.push(x);
  }
  return out;
}

// Word times on the new clock once only the `keep` parts are left. Words inside a cut are dropped.
function remapWords(words, keep) {
  const out = [];
  let offset = 0;
  const starts = keep.map((k) => {
    const o = offset;
    offset += k.end - k.start;
    return o;
  });
  for (const x of flatWords(words)) {
    const mid = (x.s + x.e) / 2;
    const i = keep.findIndex((k) => mid >= k.start && mid <= k.end);
    if (i < 0) continue;
    const k = keep[i];
    out.push({ w: x.w, s: r2(starts[i] + Math.max(0, x.s - k.start)), e: r2(starts[i] + Math.min(k.end, x.e) - k.start) });
  }
  return out;
}

// ---------- the member's look ----------

const MOOD_BY_NICHE = [
  [/tutor|school|teach|learn|coach|consult|therap|counsel|account|bookkeep|law|finance/i, 'calm'],
  [/detail|car|auto|wash|clean|pressure|plumb|electric|hvac|roof|repair|handy|moving|junk/i, 'bold'],
  [/lawn|garden|landscap|plant|farm|tree|organic|outdoor/i, 'fresh'],
  [/bak|cafe|coffee|food|restaurant|candle|cook|chef|cater|soap/i, 'warm'],
  [/salon|beauty|spa|nail|lash|brow|wedding|jewel|photo|interior|design|real estate/i, 'premium'],
  [/kid|pet|dog|cat|groom|party|toy|craft|art/i, 'playful'],
];

const hexFrom = (v) => (typeof v === 'string' && color.isHex(v.trim()) ? v.trim() : null);

// The color seed: the color typed, the brand pack's saved palette, else a mood for the business.
function seedFor(ctx, input = {}) {
  const typed = hexFrom(input.color);
  if (typed) return typed;
  const mem = brain.packMemory(ctx, 'brand');
  const pal = mem.palette || mem.colors || {};
  const saved = [pal.primary, mem.primary, mem.color, Array.isArray(mem.colors) ? mem.colors[0] : null].map(hexFrom).find(Boolean);
  if (saved) return saved;
  const b = brain.brainOf(ctx, input);
  const hay = [b.niche, b.what, b.name].join(' ');
  return (MOOD_BY_NICHE.find(([re]) => re.test(hay)) || [null, 'bold'])[1];
}

// Video colors from a seed (hex or mood): deep and mid backgrounds, a bright pop for the spoken word,
// a box color for titles and the ink that reads on each.
function videoLook(seed = 'bold') {
  const p = color.palette(seed, 0);
  const [h, s0] = color.rgbToHsl(color.hexToRgb(p.primary));
  const s = clamp(s0, 0.42, 0.9);
  const deep = color.hslToHex(h, clamp(s * 0.85, 0.35, 0.75), 0.1);
  const mid = color.hslToHex(h + 14, clamp(s, 0.4, 0.85), 0.27);
  const glow = color.hslToHex(h - 18, clamp(s + 0.1, 0.5, 0.95), 0.48);
  const [ah] = color.rgbToHsl(color.hexToRgb(p.accent));
  const dist = (a, b) => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));
  let popHue = dist(ah, h) >= 45 ? ah : (h + 180) % 360;
  if ((h >= 330 || h <= 40) && dist(popHue, 52) > 30 && dist(ah, h) < 45) popHue = 52;
  const blueish = popHue >= 200 && popHue <= 290;
  let pop = color.hslToHex(popHue, 0.92, blueish ? 0.7 : 0.6);
  if (color.contrast(pop, '#0b0b10') < 7) pop = color.hslToHex(popHue, 1, 0.72);
  let box = hexFrom(seed) ? color.rgbToHex(color.hexToRgb(seed)) : p.primary;
  if (color.contrast(box, deep) < 2.2) box = color.hslToHex(h, clamp(s, 0.5, 0.9), 0.55);
  return { primary: box, deep, mid, glow, pop, box, onBox: color.readableOn(box, '#0b0b10', '#ffffff'), text: '#ffffff', outline: '#0b0b10' };
}

function lookFor(ctx, input = {}) {
  return videoLook(seedFor(ctx, input));
}

// ---------- a music bed made in code ----------
// A soft pad on a four-chord loop, a light kick and a hat (no samples, nothing licensed). 48 kHz
// stereo WAV. The hat's noise is seeded, so the same video gets the same bed.

const NOTES = [0, 2, 4, 5, 7, 9];

function musicWav(seconds, { seed = 0, bpm = 100, level = 0.22 } = {}) {
  const rate = 48000;
  const n = Math.ceil(Math.max(0.5, seconds) * rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / bpm;
  const key = NOTES[Math.abs(seed) % NOTES.length];
  const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
  const root = key - 21;
  const f = (st) => 440 * 2 ** (st / 12);
  let rnd = (Math.abs(seed) % 2147483647) || 7;
  const noise = () => {
    rnd = (rnd * 48271) % 2147483647;
    return (rnd / 2147483647) * 2 - 1;
  };
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const bar = Math.floor(t / (beat * 4));
    const chord = chords[bar % chords.length];
    const inBar = (t % (beat * 4)) / (beat * 4);
    const swell = Math.min(1, inBar * 6) * (1 - 0.25 * inBar);
    let pad = 0;
    for (const st of chord) {
      const fr = f(root + st);
      pad += Math.sin(2 * Math.PI * fr * t) * 0.5 + Math.sin(2 * Math.PI * fr * 2.003 * t) * 0.12;
    }
    pad *= 0.11 * swell;
    const bass = Math.sin(2 * Math.PI * f(root + chord[0] - 12) * t) * 0.16 * swell;
    const tb = t % (beat * 2);
    const kick = tb < 0.25 ? Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 13) * 0.55 : 0;
    const duck = tb < 0.3 ? 0.55 + 0.45 * (tb / 0.3) : 1;
    const th = (t + beat / 2) % beat;
    const hat = th < 0.05 ? noise() * Math.exp(-th * 90) * 0.06 : 0;
    const fade = Math.min(1, t / 0.6, (seconds - t) / 1.2);
    const m = ((pad + bass) * duck + kick) * level * Math.max(0, fade);
    L[i] = m + hat * level;
    R[i] = m * 0.97 + hat * level * 0.6;
  }
  return wav([L, R], rate);
}

// Float channels to a 16-bit PCM WAV Buffer.
function wav(channels, rate) {
  const ch = channels.length;
  const n = channels[0].length;
  const buf = Buffer.alloc(44 + n * 2 * ch);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2 * ch, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2 * ch, 28);
  buf.writeUInt16LE(2 * ch, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2 * ch, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(channels[c][i] * 32767))), 44 + (i * ch + c) * 2);
  return buf;
}

// ---------- the sample clip ----------
// A 1920x1080 clip in a calm palette: a soft gradient, a head-and-shoulders shape left of center (so
// reframing has something to follow) and a SAMPLE CLIP label, with four spoken lines (ffmpeg's flite
// voice, or tones where flite is missing) and real pauses between them, one with an "um". Made once
// per server and reused. Returns { path, words, sample: true }.

const SAMPLE_LINES = [
  'Here is one quick tip for your next video.',
  'Um, film facing a window, so the light is soft.',
  'Then cut out the pauses, so every second moves.',
  'Follow for more tips like this one.',
];
const SAMPLE_GAPS = [0.5, 1.1, 0.95, 1.2, 0.7];
const SAMPLE_VERSION = 'v2';

function cacheDir() {
  const dir = path.join(os.tmpdir(), '127-studio-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Word times inside a spoken span, shared out by length.
function spread(line, s, e) {
  const ws = String(line).split(/\s+/).filter(Boolean);
  const total = ws.reduce((n, w) => n + w.length + 2, 0) || 1;
  let t = s;
  return ws.map((w) => {
    const d = ((e - s) * (w.length + 2)) / total;
    const out = { w, s: r2(t), e: r2(t + d * 0.92) };
    t += d;
    return out;
  });
}

async function pcmOf(ctx, args) {
  const { stdout } = await media.ffmpeg([...args, '-ar', '48000', '-ac', '1', '-f', 's16le', '-'], { timeoutSec: 60, signal: ctx && ctx.signal });
  const n = Math.floor(stdout.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = stdout.readInt16LE(i * 2) / 32768;
  return out;
}

const inflight = new Map();

async function sampleClip(ctx) {
  const dir = cacheDir();
  const file = path.join(dir, `sample-clip-${SAMPLE_VERSION}.mp4`);
  const meta = path.join(dir, `sample-clip-${SAMPLE_VERSION}.json`);
  if (fs.existsSync(file) && fs.existsSync(meta)) {
    try {
      return { path: file, words: JSON.parse(fs.readFileSync(meta, 'utf8')), sample: true };
    } catch {
      /* rebuild */
    }
  }
  if (inflight.has(file)) return inflight.get(file);
  const job = (async () => {
    const work = media.scratch(ctx, 'studio-sample');
    const rate = 48000;
    const parts = [];
    const words = [];
    let t = SAMPLE_GAPS[0];
    const flite = media.hasFilter('flite');
    for (let i = 0; i < SAMPLE_LINES.length; i++) {
      const line = SAMPLE_LINES[i];
      let pcm;
      if (flite) {
        const tf = path.join(work, `line${i}.txt`);
        fs.writeFileSync(tf, line);
        pcm = await pcmOf(ctx, ['-f', 'lavfi', '-i', `flite=textfile=${media.filterPath(tf)}:voice=slt`]);
        // Trim flite's quiet head and tail.
        let a = 0;
        let b = pcm.length - 1;
        while (a < b && Math.abs(pcm[a]) < 0.01) a++;
        while (b > a && Math.abs(pcm[b]) < 0.01) b--;
        pcm = pcm.slice(Math.max(0, a - 960), Math.min(pcm.length, b + 960));
      } else {
        const secs = 0.32 * line.split(/\s+/).length;
        pcm = new Float32Array(Math.round(secs * rate));
        for (let k = 0; k < pcm.length; k++) pcm[k] = 0.3 * Math.sin((2 * Math.PI * (180 + 40 * Math.sin(k / 4000)) * k) / rate) * (0.6 + 0.4 * Math.sin(k / 2400));
      }
      const secs = pcm.length / rate;
      words.push(...spread(line, t, t + secs));
      parts.push({ at: t, pcm });
      t += secs + SAMPLE_GAPS[i + 1];
    }
    const total = t;
    const mono = new Float32Array(Math.ceil(total * rate));
    for (const p of parts) mono.set(p.pcm.map((v) => v * 0.9), Math.round(p.at * rate));
    const wavFile = path.join(work, 'voice.wav');
    fs.writeFileSync(wavFile, wav([mono, mono], rate));
    const look = videoLook('calm');
    const assFile = path.join(work, 'label.ass');
    const u = 1;
    const label = 'SAMPLE CLIP';
    const events = [
      // Head and shoulders, left of center.
      media.assEvent({ layer: 1, start: 0, end: total, style: 'L', text: `{\\an7\\pos(610,230)\\bord0\\shad0\\c${media.assTagColor(color.lighten(look.mid, 0.35))}\\p1}${circlePath(150)}{\\p0}` }),
      media.assEvent({ layer: 1, start: 0, end: total, style: 'L', text: `{\\an7\\pos(480,560)\\bord0\\shad0\\c${media.assTagColor(color.lighten(look.mid, 0.25))}\\p1}${media.assRoundRect(560, 600, 200)}{\\p0}` }),
      media.assEvent({ layer: 2, start: 0, end: total, style: 'L', text: `{\\an7\\pos(810,60)\\bord0\\shad0\\c&H000000&\\alpha&H60&\\p1}${media.assRoundRect(300, 64, 32)}{\\p0}` }),
      media.assEvent({ layer: 3, start: 0, end: total, style: 'L', text: `{\\an5\\pos(960,92)\\fnInter ExtraBold\\fs${30 * u}\\fsp3\\bord0\\shad0\\c&HFFFFFF&}${label}` }),
    ];
    fs.writeFileSync(assFile, media.assDoc({ width: 1920, height: 1080, styles: [media.assStyle({ name: 'L', font: 'Inter', size: 40 })], events, title: 'Sample' }));
    const hex = (c) => `0x${String(c).replace('#', '')}`;
    const tmp = path.join(work, 'sample.mp4');
    await run(ctx, [
      '-f', 'lavfi', '-i', `gradients=s=480x270:r=${FPS}:d=${total.toFixed(2)}:c0=${hex(look.deep)}:c1=${hex(look.mid)}:c2=${hex(look.glow)}:c3=${hex(look.deep)}:n=4:speed=0.01:type=linear:seed=5`,
      '-i', wavFile,
      '-filter_complex', `[0:v]scale=1920:1080:flags=bicubic,ass=${media.filterPath(assFile)},${BT709}[v];[1:a]aresample=48000[a]`,
      '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2), ...encodeArgs(total, { crf: 24 }), tmp,
    ], { what: 'The sample clip' });
    const part = `${file}.${process.pid}.tmp`;
    fs.copyFileSync(tmp, part);
    fs.renameSync(part, file);
    fs.writeFileSync(meta, JSON.stringify(words));
    return { path: file, words, sample: true };
  })();
  inflight.set(file, job);
  try {
    return await job;
  } finally {
    inflight.delete(file);
  }
}

// A circle as an ASS drawing from 0,0 to 2r,2r.
function circlePath(r) {
  return media.assRoundRect(2 * r, 2 * r, r);
}

module.exports = {
  FPS,
  SIZES,
  ASPECTS,
  MAX_MB,
  BT709,
  LOUD,
  r2,
  even,
  clamp,
  sizeOf,
  aspectOf,
  encodeArgs,
  run,
  info,
  scratch,
  done,
  isStill,
  fillChain,
  detectSilence,
  mergeRanges,
  keepFrom,
  flatWords,
  remapWords,
  spread,
  seedFor,
  videoLook,
  lookFor,
  musicWav,
  wav,
  sampleClip,
  SAMPLE_LINES,
  cacheDir,
  text,
};
