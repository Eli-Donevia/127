// Motion renders with HyperFrames (Apache-2.0, github.com/heygen-com/hyperframes): an HTML page drawn
// frame by frame in headless Chrome and encoded with ffmpeg. Studio uses it for animated cards and
// kinetic captions when the server has it: the harness need 'motion' gives { cli, browser, ffmpeg }
// while STUDIO_MOTION is on and both are installed (Eli approved it Oct 21). Without it the tools
// fall back to their ffmpeg versions.
//
// Nothing is fetched from the web. The page (motion/*.html), its fonts (Geist, OFL, in motion/fonts) and the
// member's files are written to this call's scratch folder. The pages animate with WAAPI or from the
// time alone, so no animation library loads from a CDN. HyperFrames' anonymous usage data and update
// check are off for every run. Chrome runs in its own process group, so a stop or a timeout ends
// all of it.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { text } = require('../../_kit');
const M = require('./edit-media');

const PAGES = path.join(__dirname, '..', 'motion');
const FONTS = path.join(__dirname, '..', 'motion', 'fonts');
const FONT_FILES = ['Geist-Medium.woff2', 'Geist-SemiBold.woff2', 'Geist-Bold.woff2'];

// Switches HyperFrames reads: no usage data, no update check, no skill install.
const QUIET = { HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };

// The engine when this server has it and the tool declared 'motion', else null.
function engine(ctx) {
  try {
    const m = ctx && typeof ctx.secret === 'function' ? ctx.secret('motion') : null;
    return m && typeof m === 'object' && m.cli && m.browser ? m : null;
  } catch {
    return null;
  }
}

// JSON for a <script type="application/json"> block: nothing in it can close the tag.
function jsonForPage(data) {
  return JSON.stringify(data == null ? {} : data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// A page from motion/<name>.html with its size, length and data filled in.
function page(name, { W, H, seconds, data }) {
  const w = Math.round(Number(W));
  const h = Math.round(Number(H));
  const s = Math.round(Number(seconds) * 100) / 100;
  if (!(w >= 64 && w <= 4096 && h >= 64 && h <= 4096)) throw new Error('That size is not one Studio renders.');
  if (!(s > 0 && s <= 600)) throw new Error('That length is not one Studio renders.');
  const html = fs.readFileSync(path.join(PAGES, `${name}.html`), 'utf8');
  return html.replace(/__W__/g, String(w)).replace(/__H__/g, String(h)).replace(/__SECONDS__/g, String(s)).replace('__DATA__', () => jsonForPage(data));
}

// Runs the HyperFrames CLI and waits. A stop or the time limit kills Chrome too (process group).
function runCli(ctx, m, args, { timeoutSec, env }) {
  return new Promise((resolve, reject) => {
    const signal = ctx && ctx.signal;
    if (signal && signal.aborted) return reject(new Error('Stopped.'));
    const child = spawn(process.execPath, [m.cli, ...args], { env, detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    let why = null;
    const kill = (reason) => {
      why = reason;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }
    };
    const timer = setTimeout(() => kill('time'), timeoutSec * 1000);
    const onAbort = () => kill('stop');
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    child.stderr.on('data', (d) => {
      err = (err + d.toString()).slice(-2000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`The animation engine didn't start (${text.clip(String(e.message), 80)}).`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (why === 'stop') return reject(new Error('Stopped.'));
      if (why === 'time') return reject(Object.assign(new Error('The animation took too long, so it was stopped. Try a shorter video.'), { code: 'ETIMEDOUT' }));
      if (code !== 0) return reject(Object.assign(new Error("The animation didn't render. Try again, or turn animation off for this one."), { detail: err }));
      resolve();
    });
  });
}

// Renders motion/<name>.html to an MP4 at W x H for `seconds`, re-encoded the way every Studio video
// is (H.264, bt709, AAC; a silent track when the page has no sound). files: [{ from, as }] copied
// next to the page. Returns M.done's { path, seconds, width, height, bytes, motion: true }.
async function render(ctx, m, name, { W, H, seconds, data, files = [], timeoutSec = 480, what = 'The animation' }) {
  const dir = M.scratch(ctx, 'motion');
  const proj = path.join(dir, 'page');
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(path.join(proj, 'index.html'), page(name, { W, H, seconds, data }));
  for (const f of FONT_FILES) fs.copyFileSync(path.join(FONTS, f), path.join(proj, f));
  for (const f of files) fs.copyFileSync(f.from, path.join(proj, path.basename(f.as)));
  const raw = path.join(dir, 'raw.mp4');
  const env = {
    ...process.env,
    ...QUIET,
    HYPERFRAMES_BROWSER_PATH: m.browser,
    // HyperFrames takes only a full path here; without one it finds ffmpeg on the PATH.
    ...(m.ffmpeg && path.isAbsolute(m.ffmpeg) ? { HYPERFRAMES_FFMPEG_PATH: m.ffmpeg } : {}),
    HYPERFRAMES_MEDIA_HOME: path.join(dir, 'home'),
    HYPERFRAMES_FONT_CACHE_DIR: path.join(dir, 'fonts'),
    HYPERFRAMES_EXTRACT_CACHE_DIR: path.join(dir, 'extract'),
  };
  await runCli(ctx, m, ['render', proj, '-o', raw, '--workers', '1', '--fps', String(M.FPS), '--quiet'], { timeoutSec, env });
  const i = await M.info(ctx, raw, what);
  const out = path.join(dir, `${name}.mp4`);
  const audio = i.hasAudio ? ['-i', raw] : ['-i', raw, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
  const map = i.hasAudio ? ['-map', '0:v', '-map', '0:a'] : ['-map', '0:v', '-map', '1:a', '-shortest'];
  await M.run(ctx, [...audio, ...map, '-vf', `format=yuv420p,${M.BT709}`, ...M.encodeArgs(i.duration || seconds), out], { what });
  return M.done(ctx, out, { motion: true });
}

// Caption pages for kinetic captions: up to 3 words (2 when a word is long), a new page after a pause
// or at the end of a sentence. words: [{ w, s, e }]. Returns [{ s, e, w: [[word, s, e]] }].
function captionPages(words, { maxWords = 3, gap = 0.6 } = {}) {
  const list = (words || []).filter((x) => x && String(x.w || '').trim() && Number.isFinite(x.s) && Number.isFinite(x.e)).map((x) => ({ w: text.oneLine(x.w), s: Math.max(0, x.s), e: Math.max(x.s, x.e) }));
  const pages = [];
  let cur = null;
  for (let k = 0; k < list.length; k++) {
    const x = list[k];
    const prev = list[k - 1];
    const long = cur && cur.w.some((y) => y[0].length > 9);
    const brk = !cur || cur.w.length >= (long || x.w.length > 9 ? Math.min(2, maxWords) : maxWords) || (prev && x.s - prev.e > gap) || (prev && /[.!?]$/.test(prev.w));
    if (brk) {
      cur = { s: x.s, e: x.e, w: [] };
      pages.push(cur);
    }
    cur.w.push([x.w, Math.round(x.s * 1000) / 1000, Math.round(x.e * 1000) / 1000]);
    cur.e = x.e;
  }
  // Each page stays up until the next one starts (or 0.4 s after its last word, at most 1.2 s gap).
  for (let k = 0; k < pages.length; k++) {
    const next = pages[k + 1];
    const end = next ? Math.min(next.s, pages[k].e + 1.2) : pages[k].e + 0.4;
    pages[k].s = Math.round(pages[k].s * 1000) / 1000;
    pages[k].e = Math.round(Math.max(end, pages[k].e) * 1000) / 1000;
  }
  return pages;
}

// The fallback card when motion is off: the ffmpeg card (lib/edit.js outroSvg) with a slow push in.
async function stillCard(ctx, png, { W, H, seconds }) {
  const sec = Math.max(1.5, Math.min(8, Number(seconds) || 4));
  const frames = Math.round(sec * M.FPS);
  const out = path.join(M.scratch(ctx, 'card'), 'card.mp4');
  await M.run(ctx, [
    '-loop', '1', '-framerate', String(M.FPS), '-t', sec.toFixed(2), '-i', png,
    '-f', 'lavfi', '-t', sec.toFixed(2), '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `[0:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${M.FPS},trim=duration=${sec.toFixed(2)},setsar=1,format=yuv420p,${M.BT709}[v]`,
    '-map', '[v]', '-map', '1:a', '-t', sec.toFixed(2), ...M.encodeArgs(sec), out,
  ], { what: 'The card' });
  return M.done(ctx, out, { motion: false });
}

module.exports = { engine, page, render, captionPages, stillCard, jsonForPage, QUIET, PAGES };
