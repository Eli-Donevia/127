// ffmpeg helpers for tools that render images, audio or video. Owner: video agent.
//
// A tool that renders declares needs: ['render'] (or wants: ['render']) and its pack declares
// system: ['ffmpeg']. Check canRender(ctx) first and fall back to a file the member can still use
// (an SVG, an HTML preview, caption files) when it says no.
//
// What's here:
//   canRender, exec, ffmpeg, probe, scratch, svgToPng, slideshow   (stable since the first version)
//   hasFfmpeg, hasFilter, encodeArgs, bitrateFor, silence, filterPath
//   fonts and text metrics: fontFile, fontInfo, textWidth (real Inter metrics when the font is installed)
//   ASS (libass) builders: assColor, assTagColor, assAlpha, assTime, assText, assStyle, assEvent,
//     assDoc, assRoundRect
//   word-by-word captions: captionWords, captionPages, captionEvents, captionStyle, captionsAss
//   video jobs: fetchToFile, cut, verticalFilter (crop to 9:16), burn (burned captions), frame
//     (alias thumbnail), textCard
//
// Renders are H.264 (yuv420p, high profile) with AAC audio (a silent track when the source has none)
// and +faststart, so files play on every phone and upload to Reels, TikTok and Shorts as they are.

const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FFMPEG = () => process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = () => process.env.FFPROBE_PATH || (process.env.FFMPEG_PATH ? path.join(path.dirname(process.env.FFMPEG_PATH), 'ffprobe') : 'ffprobe');

let ffmpegPresent;
// True when ffmpeg runs on this machine. MEDIA_RENDER=off turns rendering off (to test fallbacks).
function hasFfmpeg() {
  if (process.env.MEDIA_RENDER === 'off') return false;
  if (ffmpegPresent === undefined) {
    try {
      execFileSync(FFMPEG(), ['-version'], { stdio: 'ignore', timeout: 8000 });
      ffmpegPresent = true;
    } catch {
      ffmpegPresent = false;
    }
  }
  return ffmpegPresent;
}

// Can this call render? Yes when the harness hands over the `render` key (ffmpeg on the server). A
// sample run also renders its sample media when ffmpeg is on this machine: rendering costs no money,
// and it's how the catalog shows a real file. Never throws, even for a tool that didn't declare render.
function canRender(ctx) {
  if (process.env.MEDIA_RENDER === 'off') return false;
  try {
    if (ctx && typeof ctx.secret === 'function' && ctx.secret('render')) return true;
  } catch {
    /* the tool didn't declare render: fall through */
  }
  return !!(ctx && ctx.sample && hasFfmpeg());
}

// A stop or a timeout kills the process outright (SIGKILL): ffmpeg catches SIGTERM and can keep encoding for
// minutes, and a stopped render's output is thrown away anyway (Harness, Oct 19). Node's own abort sends
// SIGTERM whatever killSignal says, so a stop is handled here and rejects with "Stopped." like the engine.
function exec(bin, args, { timeoutSec = 120, signal, env } = {}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error('Stopped.'));
    let stopped = false;
    const onAbort = () => {
      stopped = true;
      child.kill('SIGKILL');
    };
    const child = execFile(bin, args, { timeout: timeoutSec * 1000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024, encoding: 'buffer', ...(env ? { env } : {}) }, (err, stdout, stderr) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (stopped) return reject(new Error('Stopped.'));
      if (err) {
        const name = path.basename(String(bin));
        const timedOut = err.killed && err.signal === 'SIGKILL';
        const what = name === 'ffmpeg' ? 'The render' : name === 'ffprobe' ? 'Reading the file' : name;
        const span = timeoutSec >= 120 && timeoutSec % 60 === 0 ? `${timeoutSec / 60} minutes` : `${timeoutSec} seconds`;
        const e = new Error(timedOut ? `${what} ran past ${span}, so it was stopped.` : `${name} failed: ${String(stderr || err.message).slice(-800)}`);
        e.code = timedOut ? 'ETIMEDOUT' : err.code;
        return reject(e);
      }
      resolve({ stdout, stderr: String(stderr || '') });
    });
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

// Runs ffmpeg quietly and overwrites outputs. args are everything after the global options.
// Text (libass captions, librsvg cards) finds the kit's own Inter through fontsEnv().
function ffmpeg(args, opts = {}) {
  return exec(FFMPEG(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { env: fontsEnv(), ...opts });
}

let filterList;
// True when this ffmpeg build has a filter or source (ass, subtitles, xfade, flite, gradients...).
function hasFilter(name) {
  if (!hasFfmpeg()) return false;
  if (!filterList) {
    try {
      const out = execFileSync(FFMPEG(), ['-hide_banner', '-filters'], { timeout: 8000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      filterList = new Set(out.split('\n').map((l) => l.trim().split(/\s+/)[1] || '').filter(Boolean));
    } catch {
      filterList = new Set();
    }
  }
  return filterList.has(name);
}

// Duration, size (in display orientation: phones store portrait video as landscape plus a rotation
// flag), frame rate and streams of a media file.
async function probe(file, opts = {}) {
  const { stdout } = await exec(FFPROBE(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], opts);
  const j = JSON.parse(String(stdout));
  const v = (j.streams || []).find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  const rate = v && v.avg_frame_rate && v.avg_frame_rate.includes('/') ? v.avg_frame_rate.split('/').map(Number) : null;
  let rotation = 0;
  if (v) {
    const side = (v.side_data_list || []).find((d) => d.rotation != null);
    rotation = side ? Number(side.rotation) : Number((v.tags && v.tags.rotate) || 0);
    rotation = (((Math.round(rotation) % 360) + 360) % 360) || 0;
  }
  const turned = rotation === 90 || rotation === 270;
  return {
    duration: Number((j.format && j.format.duration) || (v && v.duration) || (a && a.duration) || 0),
    width: v ? (turned ? v.height : v.width) : null,
    height: v ? (turned ? v.width : v.height) : null,
    fps: rate && rate[1] ? Math.round((rate[0] / rate[1]) * 100) / 100 : null,
    hasVideo: !!v,
    hasAudio: !!a,
    rotation,
    videoCodec: v ? v.codec_name : null,
    audioCodec: a ? a.codec_name : null,
    format: j.format && j.format.format_name,
    bytes: Number((j.format && j.format.size) || 0),
  };
}

function scratch(ctx, prefix = 'media') {
  const base = ctx && typeof ctx.tmpdir === 'function' ? ctx.tmpdir() : os.tmpdir();
  return fs.mkdtempSync(path.join(base, `${prefix}-`));
}

// SVG string to PNG Buffer at the SVG's own size (or width/height if given). Needs ffmpeg with librsvg.
async function svgToPng(ctx, svg, { width, height, timeoutSec = 60 } = {}) {
  const dir = scratch(ctx, 'svg');
  const src = path.join(dir, 'in.svg');
  const out = path.join(dir, 'out.png');
  fs.writeFileSync(src, svg);
  const size = [];
  if (width) size.push('-width', String(width));
  if (height) size.push('-height', String(height));
  await ffmpeg([...size, '-i', src, '-frames:v', '1', out], { timeoutSec, signal: ctx && ctx.signal });
  return fs.readFileSync(out);
}

// PNG frames (Buffers) to an MP4 slideshow, each held for seconds, H.264 yuv420p with a silent AAC
// track so phones and every app play it.
async function slideshow(ctx, frames, { seconds = 2.5, fps = 30, width = 1080, height = 1920, timeoutSec = 300 } = {}) {
  const dir = scratch(ctx, 'slides');
  const list = [];
  frames.forEach((buf, i) => {
    const f = path.join(dir, `f${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(f, buf);
    list.push(`file '${f}'`, `duration ${seconds}`);
  });
  if (frames.length) list.push(`file '${path.join(dir, `f${String(frames.length - 1).padStart(3, '0')}.png`)}'`);
  const listFile = path.join(dir, 'list.txt');
  fs.writeFileSync(listFile, list.join('\n'));
  const out = path.join(dir, 'out.mp4');
  const total = Math.max(0.1, frames.length * seconds);
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${fps}`;
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, ...silence(total), '-vf', vf, '-map', '0:v', '-map', '1:a', '-t', String(total), ...encodeArgs({ crf: 23, fps }), out], {
    timeoutSec,
    signal: ctx && ctx.signal,
  });
  return fs.readFileSync(out);
}

// ---------- encoding ----------

// Output arguments for a phone-ready MP4. maxrateK caps the video bitrate (see bitrateFor).
function encodeArgs({ crf = 21, preset = 'veryfast', fps = 30, maxrateK, audioK = 128, audio = true } = {}) {
  const v = ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps)];
  if (maxrateK) v.push('-maxrate', `${Math.round(maxrateK)}k`, '-bufsize', `${Math.round(maxrateK * 2)}k`);
  const a = audio ? ['-c:a', 'aac', '-b:a', `${audioK}k`, '-ar', '48000', '-ac', '2'] : ['-an'];
  return [...v, ...a, '-movflags', '+faststart'];
}

// The video bitrate cap (kbps) that keeps a render of `seconds` under maxMB (the Library takes 25 MB).
function bitrateFor(seconds, { maxMB = 22, audioK = 128, ceilK = 9000, floorK = 900 } = {}) {
  const s = Math.max(1, Number(seconds) || 1);
  const k = (maxMB * 8 * 1024) / s - audioK - 64;
  return Math.max(floorK, Math.min(ceilK, Math.floor(k)));
}

// Input arguments for a silent stereo track of `seconds` (endless when seconds is falsy).
function silence(seconds) {
  return ['-f', 'lavfi', ...(seconds ? ['-t', String(seconds)] : []), '-i', 'anullsrc=r=48000:cl=stereo'];
}

// A path inside a filter argument (ass=, subtitles=, movie=). Scratch paths are plain, but be safe.
function filterPath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

// ---------- fonts and text metrics ----------
// The kit ships Inter (OFL, fonts/licenses) in six weights, 400 to 900, because no font is promised
// on the server (Harness thread, contract v1.3). ffmpeg reads them through a fontconfig file that adds
// fonts/ to the system's fonts (librsvg cards and libass captions), and the ass filter also gets
// fontsdir. textWidth reads the real advance widths from the same files, so captions, title boxes
// and thumbnails line up exactly.

const STYLE_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const FONTS_DIR = path.join(__dirname, 'fonts');
const FONT_DIRS = [FONTS_DIR, '/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts')];

let fontsEnvCache;
// process.env plus FONTCONFIG_FILE for a config that keeps the system's fonts and adds the kit's.
function fontsEnv() {
  if (fontsEnvCache !== undefined) return fontsEnvCache;
  fontsEnvCache = null;
  try {
    const dir = path.join(os.tmpdir(), '127-kit-fontconfig');
    fs.mkdirSync(path.join(dir, 'cache'), { recursive: true });
    const x = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const conf = path.join(dir, 'fonts.conf');
    const own = process.env.FONTCONFIG_FILE;
    const sys = own && path.resolve(own) !== conf ? own : '/etc/fonts/fonts.conf';
    fs.writeFileSync(conf, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n  <include ignore_missing="yes">${x(sys)}</include>\n  <dir>${x(FONTS_DIR)}</dir>\n  <cachedir>${x(path.join(dir, 'cache'))}</cachedir>\n</fontconfig>\n`);
    fontsEnvCache = { ...process.env, FONTCONFIG_FILE: conf };
  } catch {
    /* no writable temp folder: ffmpeg uses the system's fonts */
  }
  return fontsEnvCache || undefined;
}
const fontFiles = new Map();
const fontCache = new Map();

function weightOf(w) {
  const n = Math.round((Number(w) || 400) / 100) * 100;
  return Math.max(100, Math.min(900, n));
}

function findFile(dir, name, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return path.join(dir, e.name);
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const hit = findFile(path.join(dir, e.name), name, depth + 1);
    if (hit) return hit;
  }
  return null;
}

// Path of the Inter font file for a weight (100 to 900), or null.
function fontFile(weight = 700, family = 'Inter') {
  const style = STYLE_NAMES[weightOf(weight)];
  const key = `${family}:${style}`;
  if (fontFiles.has(key)) return fontFiles.get(key);
  // The kit's own copy first, so metrics match what the server renders.
  let file = findFile(FONTS_DIR, `${family}-${style}.otf`) || findFile(FONTS_DIR, `${family}-${style}.ttf`);
  if (file) {
    fontFiles.set(key, file);
    return file;
  }
  try {
    const out = execFileSync('fc-match', ['-f', '%{file}', `${family}:style=${style}`], { timeout: 5000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const base = path.basename(out).replace(/[-_ ]/g, '').toLowerCase();
    if (out && fs.existsSync(out) && base.startsWith(family.toLowerCase()) && base.includes(style.toLowerCase())) file = out;
  } catch {
    /* no fontconfig tools */
  }
  if (!file) {
    for (const dir of FONT_DIRS) {
      file = findFile(dir, `${family}-${style}.otf`) || findFile(dir, `${family}-${style}.ttf`);
      if (file) break;
    }
  }
  fontFiles.set(key, file);
  return file;
}

// Reads an OpenType or TrueType file: units per em, line metrics and advance widths by character.
function parseFont(file) {
  const buf = fs.readFileSync(file);
  const n = buf.readUInt16BE(4);
  const t = {};
  for (let i = 0; i < n; i++) {
    const off = 12 + i * 16;
    t[buf.toString('ascii', off, off + 4)] = { offset: buf.readUInt32BE(off + 8), length: buf.readUInt32BE(off + 12) };
  }
  if (!t.head || !t.hhea || !t.hmtx || !t.cmap) throw new Error('Not a font file');
  const upem = buf.readUInt16BE(t.head.offset + 18);
  const ascent = buf.readInt16BE(t.hhea.offset + 4);
  const descent = buf.readInt16BE(t.hhea.offset + 6);
  const nH = buf.readUInt16BE(t.hhea.offset + 34);
  const adv = new Array(nH);
  for (let i = 0; i < nH; i++) adv[i] = buf.readUInt16BE(t.hmtx.offset + i * 4);
  const cm = t.cmap.offset;
  const subs = buf.readUInt16BE(cm + 2);
  let fmt12 = null;
  let fmt4 = null;
  for (let i = 0; i < subs; i++) {
    const platform = buf.readUInt16BE(cm + 4 + i * 8);
    const o = cm + buf.readUInt32BE(cm + 8 + i * 8);
    const fmt = buf.readUInt16BE(o);
    if (fmt === 12) fmt12 = o;
    else if (fmt === 4 && (platform === 3 || platform === 0)) fmt4 = fmt4 || o;
  }
  const map = new Map();
  if (fmt12) {
    const groups = buf.readUInt32BE(fmt12 + 12);
    for (let g = 0; g < groups; g++) {
      const b = fmt12 + 16 + g * 12;
      const s = buf.readUInt32BE(b);
      const e = buf.readUInt32BE(b + 4);
      const gid = buf.readUInt32BE(b + 8);
      if (s > 0x2ffff) continue;
      for (let c = s; c <= e && c - s < 70000; c++) map.set(c, gid + (c - s));
    }
  } else if (fmt4) {
    const segX2 = buf.readUInt16BE(fmt4 + 6);
    const ends = fmt4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(ends + s * 2);
      const start = buf.readUInt16BE(starts + s * 2);
      const delta = buf.readInt16BE(deltas + s * 2);
      const ro = buf.readUInt16BE(ranges + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let gid;
        if (ro === 0) gid = (c + delta) & 0xffff;
        else {
          const gi = buf.readUInt16BE(ranges + s * 2 + ro + (c - start) * 2);
          gid = gi ? (gi + delta) & 0xffff : 0;
        }
        map.set(c, gid);
      }
    }
  }
  let capHeight = Math.round(upem * 0.727);
  let xHeight = Math.round(upem * 0.546);
  if (t['OS/2'] && buf.readUInt16BE(t['OS/2'].offset) >= 2) {
    xHeight = buf.readInt16BE(t['OS/2'].offset + 86) || xHeight;
    capHeight = buf.readInt16BE(t['OS/2'].offset + 88) || capHeight;
  }
  return { upem, ascent, descent, capHeight, xHeight, adv, map };
}

function metricsFor(weight) {
  const w = weightOf(weight);
  if (fontCache.has(w)) return fontCache.get(w);
  let m = null;
  const file = fontFile(w);
  if (file) {
    try {
      m = parseFont(file);
      m.file = file;
    } catch {
      m = null;
    }
  }
  fontCache.set(w, m);
  return m;
}

// { file, upem, ascent, descent, capHeight, xHeight } for a weight of Inter, or null.
function fontInfo(weight = 700) {
  const m = metricsFor(weight);
  return m ? { file: m.file, upem: m.upem, ascent: m.ascent, descent: m.descent, capHeight: m.capHeight, xHeight: m.xHeight } : null;
}

// Width in pixels of text at a font size. mode 'css' is for SVG and HTML (size = the em); mode 'ass'
// is for libass, which scales a font so ascent plus descent equals the size (about 0.83 em for
// Inter). letterSpacing is extra pixels per character.
function textWidth(text, size, { weight = 700, mode = 'css', letterSpacing = 0 } = {}) {
  const s = String(text == null ? '' : text);
  const m = metricsFor(weight);
  let units = 0;
  let count = 0;
  if (m) {
    for (const ch of s) {
      const gid = m.map.get(ch.codePointAt(0)) || m.map.get(0x3f) || 0;
      units += m.adv[Math.min(gid, m.adv.length - 1)] || m.upem * 0.5;
      count++;
    }
    const em = mode === 'ass' ? m.ascent - m.descent : m.upem;
    return (units / em) * size + letterSpacing * count;
  }
  const w = weightOf(weight);
  const per = 0.5 + (w - 400) * 0.00018;
  for (const ch of s) {
    units += /[mwMW@%]/.test(ch) ? 1.45 : /[il.,:;'|!I1 ]/.test(ch) ? 0.52 : /[A-Z0-9$&]/.test(ch) ? 1.22 : 1;
    count++;
  }
  return units * per * size * (mode === 'ass' ? 0.83 : 1) + letterSpacing * count;
}

// ---------- ASS (libass) ----------

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, '0');

function rgbOf(hex) {
  let h = String(hex || '#ffffff').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = 'ffffff';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// '#ff8800' with opacity 1 -> '&H000088FF' (ASS stores alpha, blue, green, red; alpha 00 is solid).
function assColor(hex, opacity = 1) {
  const [r, g, b] = rgbOf(hex);
  return `&H${hex2((1 - opacity) * 255)}${hex2(b)}${hex2(g)}${hex2(r)}`;
}

// For \c, \3c and \4c tags: '&HBBGGRR&'.
function assTagColor(hex) {
  const [r, g, b] = rgbOf(hex);
  return `&H${hex2(b)}${hex2(g)}${hex2(r)}&`;
}

// For \alpha tags: opacity 1 -> '&H00&', 0 -> '&HFF&'.
function assAlpha(opacity = 1) {
  return `&H${hex2((1 - opacity) * 255)}&`;
}

// Seconds to ASS time: 0:00:03.25
function assTime(sec) {
  const cs = Math.max(0, Math.round(Number(sec || 0) * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

// Member text inside an event: no override braces, no stray backslashes, line breaks as \N.
function assText(s) {
  return String(s == null ? '' : s)
    .replace(/[{}]/g, '')
    .replace(/\\/g, '/')
    .replace(/\r?\n/g, '\\N');
}

const STYLE_FORMAT = 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';

function assStyle({ name = 'Default', font = 'Inter', size = 64, color = '#ffffff', secondary, outlineColor = '#000000', backColor = '#000000', backOpacity = 0.5, bold = 0, italic = 0, spacing = 0, borderStyle = 1, outline = 0, shadow = 0, align = 5, marginL = 0, marginR = 0, marginV = 0 } = {}) {
  return `Style: ${name},${font},${Math.round(size)},${assColor(color)},${assColor(secondary || color)},${assColor(outlineColor)},${assColor(backColor, backOpacity)},${bold ? -1 : 0},${italic ? -1 : 0},0,0,100,100,${spacing},0,${borderStyle},${outline},${shadow},${align},${marginL},${marginR},${marginV},1`;
}

function assEvent({ layer = 0, start = 0, end, style = 'Default', text = '' }) {
  return `Dialogue: ${layer},${assTime(start)},${assTime(end)},${style},,0,0,0,,${text}`;
}

function assDoc({ width = 1080, height = 1920, styles = [], events = [], title = '127' } = {}) {
  const st = styles.length ? styles : [assStyle()];
  return [
    '[Script Info]',
    `Title: ${assText(title)}`,
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    STYLE_FORMAT,
    ...st,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

const r1 = (n) => Math.round(n * 10) / 10;

// A rounded rectangle as an ASS drawing (use with \p1), from 0,0 to w,h.
function assRoundRect(w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const k = rr * 0.4477;
  return [
    `m ${r1(rr)} 0`,
    `l ${r1(w - rr)} 0`,
    `b ${r1(w - k)} 0 ${r1(w)} ${r1(k)} ${r1(w)} ${r1(rr)}`,
    `l ${r1(w)} ${r1(h - rr)}`,
    `b ${r1(w)} ${r1(h - k)} ${r1(w - k)} ${r1(h)} ${r1(w - rr)} ${r1(h)}`,
    `l ${r1(rr)} ${r1(h)}`,
    `b ${r1(k)} ${r1(h)} 0 ${r1(h - k)} 0 ${r1(h - rr)}`,
    `l 0 ${r1(rr)}`,
    `b 0 ${r1(k)} ${r1(k)} 0 ${r1(rr)} 0`,
  ].join(' ');
}

// ---------- word-by-word captions ----------
// words: [{ w, s, e }] (or { word | text, start, end }, or [w, s, e]) in seconds.
// Three looks, each lighting up the word being spoken:
//   bold   big uppercase, white with a dark outline; the spoken word turns the pop color and grows
//   box    uppercase; the spoken word sits on a rounded box in the brand color
//   clean  sentence case with a soft shadow; words go from dim to white as they're spoken

const CAPTION_STYLES = {
  bold: { weight: 900, font: 'Inter Black', size: 92, upper: true, maxWords: 3, lineGap: 0.06, outline: 7, shadow: 4 },
  box: { weight: 800, font: 'Inter ExtraBold', size: 80, upper: true, maxWords: 4, lineGap: 0.16, outline: 5, shadow: 3 },
  clean: { weight: 700, font: 'Inter Bold', size: 68, upper: false, maxWords: 7, lineGap: 0.14, outline: 0, shadow: 3 },
};

function captionWords(words) {
  return (words || [])
    .map((x) => {
      if (Array.isArray(x)) return { w: String(x[0] == null ? '' : x[0]), s: Number(x[1]), e: Number(x[2]) };
      if (!x || typeof x !== 'object') return null;
      return { w: String(x.w != null ? x.w : x.word != null ? x.word : x.text != null ? x.text : ''), s: Number(x.s != null ? x.s : x.start), e: Number(x.e != null ? x.e : x.end) };
    })
    .filter((x) => x && x.w.trim() && Number.isFinite(x.s) && Number.isFinite(x.e))
    .map((x) => ({ w: x.w.trim(), s: x.s, e: Math.max(x.e, x.s + 0.05) }))
    .sort((a, b) => a.s - b.s);
}

function displayWord(w, upper) {
  const t = String(w).replace(/[{}\\]/g, '');
  return upper ? t.toUpperCase().replace(/[.,;:]+$/g, '') : t;
}

function captionSize(style, width, height) {
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.bold;
  const unit = Math.min(width, height) / 1080;
  return Math.round(st.size * unit * (width > height ? 0.86 : 1));
}

// Groups words into pages that fit the width in at most maxLines lines. Pages break at sentence ends,
// pauses and the style's word limit. Each page: { start, end, size, space, lines: [[{ w, s, e, text, width }]] }.
function captionPages(words, { style = 'bold', width = 1080, height = 1920, size, maxWidth, maxLines = 2, maxWords, maxGap = 0.55 } = {}) {
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.bold;
  const unit = Math.min(width, height) / 1080;
  const fs0 = size || captionSize(style, width, height);
  const mw = maxWidth || Math.round(Math.min(width - 220 * unit, (width > height ? 0.7 : 0.8) * width));
  const limit = maxWords || st.maxWords;
  const list = captionWords(words);
  // Word gap: a real space plus room for the outline on both words and the active word's pop.
  const space = textWidth(' ', fs0, { weight: st.weight, mode: 'ass' }) + st.outline * unit * 2 + fs0 * (style === 'clean' ? 0.03 : 0.07);
  // The bold look keeps the spoken word at 110% around its center, so each gap also leaves 5% of the
  // wider of its two words, and a line leaves room for its end words to grow past the edge.
  const grow = style === 'clean' || style === 'box' ? 0 : 0.05;
  const gapOf = (a, b) => space + grow * Math.max(a.width, b.width);
  const pages = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.lines.length && cur.lines[0].length) pages.push(cur);
    cur = null;
  };
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    const text = displayWord(x.w, st.upper);
    if (!text) continue;
    const wpx = textWidth(text, fs0, { weight: st.weight, mode: 'ass' });
    const prev = i > 0 ? list[i - 1] : null;
    const pause = prev && x.s - prev.e > maxGap;
    const sentenceEnd = prev && /[.!?]["')]?$/.test(prev.w);
    const count = cur ? cur.lines.reduce((n, l) => n + l.length, 0) : 0;
    if (cur && (pause || sentenceEnd || count >= limit)) flush();
    if (!cur) cur = { lines: [[]], size: fs0 };
    let line = cur.lines[cur.lines.length - 1];
    const lineW = line.reduce((n, y, j) => n + y.width + (j ? gapOf(line[j - 1], y) : 0), 0);
    const added = line.length ? gapOf(line[line.length - 1], { width: wpx }) + wpx + 2 * grow * Math.max(line[0].width, wpx) : 0;
    if (line.length && lineW + added > mw) {
      if (cur.lines.length >= maxLines) {
        flush();
        cur = { lines: [[]], size: fs0 };
      } else cur.lines.push([]);
      line = cur.lines[cur.lines.length - 1];
    }
    line.push({ w: x.w, s: x.s, e: x.e, text, width: wpx });
  }
  flush();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const all = p.lines.flat();
    p.start = all[0].s;
    const next = pages[i + 1];
    const lastEnd = all[all.length - 1].e;
    // Hold a page until the next one when the gap is short, so captions don't flicker.
    p.end = next && next.lines[0][0].s - lastEnd < 0.45 ? next.lines[0][0].s : lastEnd + 0.15;
    p.space = space;
    // Each word's gap to the next one on its line.
    for (const l of p.lines) l.forEach((w, j) => (w.gap = j + 1 < l.length ? gapOf(w, l[j + 1]) : 0));
  }
  return pages;
}

// ASS events for caption pages. palette: { text, pop, outline, box, onBox }. cx, cy: the center of the
// caption block (default: lower middle, inside the Reels and TikTok safe zone). offset: seconds to
// subtract from word times (when the words are on the source's clock and the clip starts later).
function captionEvents(pages, { style = 'bold', width = 1080, height = 1920, cx, cy, palette = {}, offset = 0 } = {}) {
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.bold;
  const unit = Math.min(width, height) / 1080;
  const X = cx != null ? cx : width / 2;
  const Y = cy != null ? cy : height * (width > height ? 0.8 : 0.6);
  const textC = assTagColor(palette.text || '#ffffff');
  const popC = assTagColor(palette.pop || '#ffd84d');
  const outC = assTagColor(palette.outline || '#0b0b0f');
  const boxC = assTagColor(palette.box || palette.pop || '#ffd84d');
  const onBoxC = assTagColor(palette.onBox || '#0b0b0f');
  const ol = r1(st.outline * unit);
  const sh = r1(st.shadow * unit);
  const out = [];
  const T = (t) => Math.max(0, t - offset);
  for (const p of pages) {
    const ps = T(p.start);
    const pe = T(p.end);
    if (pe - ps < 0.04) continue;
    const size = p.size;
    const lineH = size * (1 + st.lineGap);
    const top = Y - (p.lines.length * lineH) / 2;
    const placed = [];
    p.lines.forEach((line, li) => {
      const gap = (w, j) => (j + 1 < line.length ? (w.gap != null ? w.gap : p.space) : 0);
      const total = line.reduce((n, w, j) => n + w.width + gap(w, j), 0);
      let x = X - total / 2;
      const y = top + li * lineH + lineH / 2;
      line.forEach((w, j) => {
        placed.push({ ...w, x: x + w.width / 2, y });
        x += w.width + gap(w, j);
      });
    });
    placed.forEach((w, i) => {
      const a0 = Math.max(ps, T(w.s));
      const a1 = Math.max(a0 + 0.05, i + 1 < placed.length ? T(placed[i + 1].s) : pe);
      const pos = `\\an5\\pos(${r1(w.x)},${r1(w.y)})`;
      const txt = assText(w.text);
      if (style === 'clean') {
        // Dim before it's spoken, white once it is. A soft shadow keeps it readable on any footage.
        const base = `{${pos}\\bord0\\shad${sh}\\4c&H000000&\\c${textC}`;
        if (a0 > ps + 0.02) out.push(assEvent({ layer: 1, start: ps, end: a0, style: 'Cap', text: `${base}\\alpha&H9C&\\4a&HD8&}${txt}` }));
        out.push(assEvent({ layer: 1, start: a0, end: pe, style: 'Cap', text: `${base}\\4a&H78&}${txt}` }));
        return;
      }
      const base = `{${pos}\\bord${ol}\\shad${sh}\\3c${outC}\\4c&H000000&\\4a&H80&\\c${textC}`;
      if (a0 > ps + 0.02) out.push(assEvent({ layer: 1, start: ps, end: a0, style: 'Cap', text: `${base}\\fscx94\\fscy94\\t(0,90,\\fscx100\\fscy100)}${txt}` }));
      if (a1 < pe - 0.02) out.push(assEvent({ layer: 1, start: a1, end: pe, style: 'Cap', text: `${base}}${txt}` }));
      if (style === 'box') {
        const bw = w.width + size * 0.44;
        const bh = size * 1.04;
        const pop = '\\fscx88\\fscy88\\t(0,80,\\fscx104\\fscy104)\\t(80,150,\\fscx100\\fscy100)';
        out.push(assEvent({ layer: 2, start: a0, end: Math.min(pe, a1), style: 'Cap', text: `{${pos}\\bord0\\shad${sh}\\4c&H000000&\\4a&H90&\\c${boxC}${pop}\\p1}${assRoundRect(bw, bh, size * 0.24)}{\\p0}` }));
        out.push(assEvent({ layer: 3, start: a0, end: Math.min(pe, a1), style: 'Cap', text: `{${pos}\\bord0\\shad0\\c${onBoxC}${pop}}${txt}` }));
        return;
      }
      out.push(assEvent({ layer: 2, start: a0, end: Math.min(pe, a1), style: 'Cap', text: `${base.replace(`\\c${textC}`, `\\c${popC}`)}\\t(0,70,\\fscx116\\fscy116)\\t(70,150,\\fscx110\\fscy110)}${txt}` }));
    });
  }
  return out;
}

// The caption style line for an ASS doc (Inter at the look's weight).
function captionStyle(style = 'bold', { width = 1080, height = 1920 } = {}) {
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.bold;
  return assStyle({ name: 'Cap', font: st.font, size: captionSize(style, width, height), align: 5, outline: st.outline, shadow: st.shadow });
}

// A whole ASS file of word-by-word captions. opts: style, width, height, cx, cy, palette, offset,
// maxWords, size, and extra: { styles, events } to draw other things (a title, a watermark) with it.
function captionsAss(words, opts = {}) {
  const { style = 'bold', width = 1080, height = 1920, extra = {} } = opts;
  const pages = captionPages(words, opts);
  const events = captionEvents(pages, opts);
  return assDoc({ width, height, styles: [captionStyle(style, { width, height }), ...(extra.styles || [])], events: [...(extra.events || []), ...events], title: opts.title || 'Captions' });
}

// ---------- video jobs ----------

// Downloads a public media file through ctx.fetch (the harness guards it: public addresses only, and
// each request ends after at most 60 seconds) to a local path, stopping at maxBytes. Big files come
// down in 32 MB ranges when the server allows it, so no single request runs long. Returns the path.
// Errors are member-readable.
const UA = 'Mozilla/5.0 (compatible; 127-workflows/0.1; +https://127group.io)';

async function fetchToFile(ctx, url, { dir, maxBytes = 600e6, name = 'source', timeoutMs = 900000, chunkBytes = 32 * 1024 * 1024 } = {}) {
  const doFetch = ctx && typeof ctx.fetch === 'function' ? ctx.fetch : fetch;
  const folder = dir || scratch(ctx, 'dl');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort();
  if (ctx && ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
  const tooBig = () => new Error(`That file is over ${Math.round(maxBytes / 1e6)} MB. Trim it or export a smaller copy first.`);
  const get = async (range) => {
    try {
      return await doFetch(url, { redirect: 'follow', signal: ac.signal, timeoutMs: 60000, headers: { 'User-Agent': UA, ...(range ? { Range: range } : {}) } });
    } catch (e) {
      if (ac.signal.aborted) throw new Error('The download took too long. Try a shorter or smaller file.');
      throw new Error(`Couldn't download the video (${String((e && e.message) || e).slice(0, 80)}). Check that the link opens the file itself.`);
    }
  };
  // Streams one response into the file. Returns the bytes written.
  const pour = async (res, fd, room) => {
    let n = 0;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      for (;;) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch (e) {
          throw new Error('The download stopped part way. Try again, or use a smaller file.');
        }
        if (chunk.done) break;
        n += chunk.value.length;
        if (n > room) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          throw tooBig();
        }
        fs.writeSync(fd, Buffer.from(chunk.value));
      }
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > room) throw tooBig();
      fs.writeSync(fd, buf);
      n = buf.length;
    }
    return n;
  };
  let file = null;
  let fd = null;
  try {
    let res = await get(`bytes=0-${chunkBytes - 1}`);
    if (res.status === 416) res = await get(null);
    if (!res.ok) throw new Error(`The video link answered ${res.status}. Check that the link opens the file itself.`);
    const header = (k) => (res.headers && typeof res.headers.get === 'function' ? res.headers.get(k) || '' : '');
    const type = header('content-type');
    if (/text\/html/i.test(type)) throw new Error('That link opens a web page, not a video file. Use a link that ends in .mp4 or .mov, or upload the file.');
    const total = res.status === 206 ? Number((header('content-range').match(/\/(\d+)\s*$/) || [])[1]) || 0 : Number(header('content-length')) || 0;
    if (total && total > maxBytes) throw tooBig();
    const ext = (String(url).match(/\.(mp4|mov|m4v|webm|mkv|mp3|m4a|wav|aac|ogg|oga|ogv|opus|flac)(\?|#|$)/i) || [])[1] || (/audio/i.test(type) ? 'm4a' : 'mp4');
    file = path.join(folder, `${name}.${ext.toLowerCase()}`);
    fd = fs.openSync(file, 'w');
    let size = await pour(res, fd, maxBytes);
    if (res.status === 206 && total) {
      while (size < total) {
        const r = await get(`bytes=${size}-${Math.min(total, size + chunkBytes) - 1}`);
        if (r.status !== 206) throw new Error(`The video link answered ${r.status} part way through. Try again in a minute.`);
        const n = await pour(r, fd, maxBytes - size);
        if (!n) throw new Error('The download stopped part way. Try again, or use a smaller file.');
        size += n;
      }
    }
    if (!size) throw new Error('The link sent an empty file.');
    return file;
  } catch (e) {
    if (fd != null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
      fd = null;
    }
    if (file) fs.rmSync(file, { force: true });
    throw e;
  } finally {
    if (fd != null) fs.closeSync(fd);
    clearTimeout(timer);
    if (ctx && ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
  }
}

// Cuts [start, end] out of a video, re-encoded so the cut is frame exact. Returns the output path.
async function cut(ctx, input, { start = 0, end, out, crf = 20, timeoutSec = 600 } = {}) {
  const dst = out || path.join(scratch(ctx, 'cut'), 'cut.mp4');
  const info = await probe(input, { signal: ctx && ctx.signal });
  const dur = Math.max(0.1, (end != null ? end : info.duration) - start);
  const args = ['-ss', String(Math.max(0, start)), '-i', input];
  if (!info.hasAudio) args.push(...silence(dur));
  args.push('-t', String(dur), '-map', '0:v:0', '-map', info.hasAudio ? '0:a:0' : '1:a:0', ...encodeArgs({ crf, fps: Math.min(60, Math.round(info.fps || 30)), maxrateK: bitrateFor(dur) }), dst);
  await ffmpeg(args, { timeoutSec, signal: ctx && ctx.signal });
  return dst;
}

// The filter chain (from inLabel, default [0:v], to outLabel, default [v]) that turns a srcW x srcH
// picture into W x H. layout: 'crop' fills the frame (focus 0 to 1 slides the window left to right),
// 'fit' shows the whole picture over a blurred, darker copy of itself, 'pad' letterboxes on a color.
// zoom: [{ from, to, scale }] punch-ins on the output clock (talking-head jump cuts), crop only.
function verticalFilter({ srcW, srcH, W = 1080, H = 1920, layout = 'crop', focus = 0.5, zoom = [], background = '#000000', fps = 30, inLabel = '[0:v]', outLabel = '[v]' } = {}) {
  const f = Math.max(0, Math.min(1, Number(focus) || 0.5));
  const sw = srcW || W;
  const sh = srcH || H;
  if (layout === 'fit') {
    const bw = Math.round(W / 4 / 2) * 2;
    const bh = Math.round(H / 4 / 2) * 2;
    return [
      `${inLabel}fps=${fps},split=2[fg0][bg0]`,
      `[bg0]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},gblur=sigma=9,eq=brightness=-0.14:saturation=1.1,scale=${W}:${H}[bg1]`,
      `[fg0]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg1]`,
      `[bg1][fg1]overlay=(W-w)/2:(H-h)/2,setsar=1${outLabel}`,
    ].join(';');
  }
  if (layout === 'pad') {
    const [r, g, b] = rgbOf(background);
    return `${inLabel}fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x${hex2(r)}${hex2(g)}${hex2(b)},setsar=1${outLabel}`;
  }
  const scale = Math.max(W / sw, H / sh);
  const cw = Math.ceil((sw * scale) / 2) * 2;
  const ch = Math.ceil((sh * scale) / 2) * 2;
  const x = Math.round((cw - W) * f);
  const y = Math.round((ch - H) / 2);
  const steps = (zoom || []).filter((z) => z && z.scale > 1 && z.to > z.from);
  const base = `${inLabel}fps=${fps},scale=${cw}:${ch},crop=${W}:${H}:${x}:${y}`;
  if (!steps.length) return `${base},setsar=1${outLabel}`;
  const zexpr = steps.map((z) => `between(t\\,${z.from.toFixed(2)}\\,${z.to.toFixed(2)})*${(z.scale - 1).toFixed(3)}`).join('+');
  return `${base},scale=w='trunc(${W}*(1+${zexpr})/2)*2':h='trunc(${H}*(1+${zexpr})/2)*2':eval=frame,crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2,setsar=1${outLabel}`;
}

// Renders a captioned clip: cut [start, end] from input, reframe to W x H, burn an ASS file, bring the
// sound to -14 LUFS, encode under maxMB. Returns the output path.
async function burn(ctx, { input, ass, out, start = 0, end, W = 1080, H = 1920, layout = 'crop', focus = 0.5, zoom = [], fps = 30, crf = 21, maxMB = 22, loudnorm = true, timeoutSec = 900 } = {}) {
  const info = await probe(input, { signal: ctx && ctx.signal });
  const dur = Math.max(0.5, (end != null ? Math.min(end, info.duration || end) : info.duration) - start);
  const dst = out || path.join(scratch(ctx, 'burn'), 'clip.mp4');
  const args = ['-ss', String(Math.max(0, start)), '-t', String(dur), '-i', input];
  if (!info.hasAudio) args.push(...silence(dur));
  const vchain = info.hasVideo
    ? verticalFilter({ srcW: info.width, srcH: info.height, W, H, layout, focus, zoom, fps, outLabel: '[vr]' })
    : `color=c=black:s=${W}x${H}:r=${fps}:d=${dur.toFixed(2)}[vr]`;
  const subs = ass ? `;[vr]ass=filename=${filterPath(ass)}:fontsdir=${filterPath(FONTS_DIR)},format=yuv420p[v]` : ';[vr]format=yuv420p[v]';
  const achain = info.hasAudio ? `;[0:a]${loudnorm ? 'loudnorm=I=-14:TP=-1.5:LRA=11,' : ''}aresample=48000[a]` : '';
  args.push('-filter_complex', vchain + subs + achain, '-map', '[v]', '-map', info.hasAudio ? '[a]' : '1:a:0', '-t', String(dur), ...encodeArgs({ crf, fps, maxrateK: bitrateFor(dur, { maxMB }) }), dst);
  await ffmpeg(args, { timeoutSec, signal: ctx && ctx.signal });
  return dst;
}

// One frame as an image Buffer (PNG, or JPEG with format 'jpg'), cropped to fill width x height when
// both are given. at: seconds.
// A still photo has one frame, and seeking it (even "-ss 0" on some JPEGs) leaves ffmpeg nothing to
// write, so a still is never seeked, and a seek that wrote nothing is tried once more from the start.
async function frame(ctx, input, { at = 0, width, height, format = 'png', quality = 3 } = {}) {
  const dir = scratch(ctx, 'frame');
  const out = path.join(dir, format === 'jpg' ? 'frame.jpg' : 'frame.png');
  const still = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic)$/i.test(String(input));
  const seek = Number(at) > 0 && !still ? ['-ss', String(Number(at))] : [];
  const rest = ['-i', input, '-frames:v', '1'];
  if (width && height) rest.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`);
  if (format === 'jpg') rest.push('-q:v', String(quality));
  rest.push('-update', '1', out);
  await ffmpeg([...seek, ...rest], { timeoutSec: 60, signal: ctx && ctx.signal });
  if (!fs.existsSync(out) && seek.length) await ffmpeg(rest, { timeoutSec: 60, signal: ctx && ctx.signal });
  return fs.readFileSync(out);
}

// A text card: an SVG (or a PNG Buffer) held for `seconds` with a slow push-in and a fade in and out,
// as an MP4 with a silent track. Returns the output path.
async function textCard(ctx, { svg, png, seconds = 2.5, W = 1080, H = 1920, fps = 30, push = 0.04, out, fade = 0.25 } = {}) {
  const dir = scratch(ctx, 'card');
  const img = path.join(dir, 'card.png');
  fs.writeFileSync(img, png || (await svgToPng(ctx, svg, { width: W, height: H })));
  const dst = out || path.join(dir, 'card.mp4');
  const frames = Math.max(1, Math.round(seconds * fps));
  const z = Math.max(0, Number(push) || 0);
  const vf = [
    `scale=${W * 2}:${H * 2}`,
    `zoompan=z='1+${z}*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps}`,
    `fade=t=in:st=0:d=${fade}`,
    `fade=t=out:st=${Math.max(0, seconds - fade).toFixed(2)}:d=${fade}`,
    'format=yuv420p',
  ].join(',');
  await ffmpeg(['-loop', '1', '-framerate', String(fps), '-i', img, ...silence(seconds), '-vf', vf, '-t', String(seconds), '-map', '0:v', '-map', '1:a', ...encodeArgs({ fps }), dst], {
    timeoutSec: 180,
    signal: ctx && ctx.signal,
  });
  return dst;
}

module.exports = {
  canRender,
  exec,
  ffmpeg,
  probe,
  scratch,
  svgToPng,
  slideshow,
  hasFfmpeg,
  hasFilter,
  encodeArgs,
  bitrateFor,
  silence,
  filterPath,
  fontFile,
  fontInfo,
  textWidth,
  assColor,
  assTagColor,
  assAlpha,
  assTime,
  assText,
  assStyle,
  assEvent,
  assDoc,
  assRoundRect,
  CAPTION_STYLES,
  captionWords,
  captionPages,
  captionEvents,
  captionStyle,
  captionsAss,
  fetchToFile,
  cut,
  verticalFilter,
  burn,
  frame,
  thumbnail: frame,
  textCard,
};
