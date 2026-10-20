// The studio's editing functions: real edits on the server's ffmpeg, no keys needed. Every function
// takes ctx first and local file paths (never Library ids: the tools read those with ctx.asset),
// writes into ctx.tmpdir() and returns { path, seconds, width, height } (plus what it did).
// Output: H.264 yuv420p bt709 (TV range) at 30 fps, AAC 48 kHz stereo at -14 LUFS, faststart,
// under about 21 MB (lib/edit-media.js).
//
//   cutSilence   cuts the pauses              cutWords   cuts filler words (um, uh, like, you know)
//   jumpCuts     punch-ins at the cut points  reframe    to 9:16, 1:1, 16:9 or 4:5 (crop or blur fill)
//   hookTitle    a title over the first seconds
//   musicBed     a music bed (the member's track, or one made in code), ducked under the voice
//   insertBroll  clips or photos over the video at set times, the voice kept
//   outro        a brand end card (name, line, handle, logo) with a soft cross fade
//   captions     word-by-word captions in six looks (lib/edit-captions.js)
//   assemble     scenes (clips or photos with gentle motion), voice, captions, music, hook, outro: one MP4
//   adSizes      one picture and its words as PNG ads in five sizes (lib/edit-ads.js)

const fs = require('fs');
const path = require('path');
const { media, text } = require('../../_kit');
const M = require('./edit-media');
const C = require('./edit-captions');
const { adSizes } = require('./edit-ads');

const { FPS, BT709, LOUD, r2, even } = M;

// The working size for a source: its own shape, the long edge at most 1920, even numbers.
function capSize(i) {
  const w = i.width || 1080;
  const h = i.height || 1920;
  const k = Math.min(1, 1920 / Math.max(w, h));
  return [even(w * k), even(h * k)];
}

async function videoInfo(ctx, file) {
  const i = await M.info(ctx, file);
  if (!i.hasVideo) throw new Error("That file has no picture. Add a video file (MP4 or MOV), not just the sound.");
  if (!(i.duration > 0.3)) throw new Error('That video is empty or too short to edit.');
  return i;
}

// Inputs for the source plus a silent track when it has no sound: { args, a } (a = the audio label).
function sourceInputs(file, i) {
  const args = ['-i', file];
  if (i.hasAudio) return { args, a: '[0:a]', next: 1 };
  args.push(...media.silence(i.duration + 1));
  return { args, a: '[1:a]', next: 2 };
}

const STEREO = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';

// Burns an ASS file over the whole video (scaled or cropped to W x H when given).
async function burnAss(ctx, file, i, assText, { W, H, fill = 'crop', focus = 0.5, what } = {}) {
  const [w0, h0] = capSize(i);
  const tw = W || w0;
  const th = H || h0;
  const dir = M.scratch(ctx, 'burn');
  const assFile = path.join(dir, 'over.ass');
  fs.writeFileSync(assFile, assText);
  const src = sourceInputs(file, i);
  const v = M.fillChain({ srcW: i.width, srcH: i.height, W: tw, H: th, fill, focus, outLabel: '[f]' });
  const out = path.join(dir, 'out.mp4');
  await M.run(ctx, [...src.args, '-filter_complex', `${v};[f]ass=${media.filterPath(assFile)},${BT709}[v];${src.a}${STEREO},${LOUD}[a]`, '-map', '[v]', '-map', '[a]', '-t', String(i.duration), ...M.encodeArgs(i.duration), out], { what });
  return out;
}

// ---------- cuts ----------

const HARD_FILLERS = ['um', 'umm', 'uhm', 'uh', 'uhh', 'erm', 'er', 'ah', 'ahh', 'hmm', 'mm', 'mhm'];
const SOFT_FILLERS = ['like', 'basically', 'actually', 'literally'];
const PAIRS = [['you', 'know'], ['i', 'mean'], ['kind', 'of'], ['sort', 'of']];
const bare = (w) => String(w || '').toLowerCase().replace(/[^a-z']/g, '');
const hasComma = (w) => /,$/.test(String(w || ''));

// Filler words in a word list: [{ start, end, word }]. Hard fillers (um, uh) always go; "like",
// "basically", "you know" and the rest only when set off by a comma or a pause, so "I like it" stays.
// fillers: your own list of words or two-word phrases that always go (replaces the hard list).
function fillerCuts(words, { fillers } = {}) {
  const list = M.flatWords(words);
  const hard = new Set((Array.isArray(fillers) && fillers.length ? fillers.filter((f) => !/\s/.test(String(f).trim())) : HARD_FILLERS).map(bare));
  const customPairs = (Array.isArray(fillers) ? fillers : []).map((f) => String(f).trim().toLowerCase().split(/\s+/).map(bare)).filter((p) => p.length === 2);
  const out = [];
  const gapBefore = (k) => (k > 0 ? list[k].s - list[k - 1].e : 1);
  const gapAfter = (k) => (k + 1 < list.length ? list[k + 1].s - list[k].e : 1);
  const setOff = (a, b) => hasComma(list[b].w) || (a > 0 && hasComma(list[a - 1].w)) || /[.!?]$/.test(list[b].w) || (gapBefore(a) > 0.22 && gapAfter(b) > 0.12) || gapAfter(b) > 0.3;
  const cut = (a, b) => {
    const s = a > 0 ? Math.max(list[a - 1].e, list[a].s - 0.06) : Math.max(0, list[a].s - 0.06);
    const e = b + 1 < list.length ? Math.min(list[b + 1].s, list[b].e + 0.06) : list[b].e + 0.06;
    out.push({ start: r2(s), end: r2(e), word: list.slice(a, b + 1).map((x) => x.w).join(' ') });
  };
  for (let k = 0; k < list.length; k++) {
    const w = bare(list[k].w);
    const next = k + 1 < list.length ? bare(list[k + 1].w) : '';
    const pair = [...customPairs, ...(fillers && fillers.length ? [] : PAIRS)].find((p) => p[0] === w && p[1] === next);
    if (pair && (customPairs.includes(pair) || setOff(k, k + 1))) {
      cut(k, k + 1);
      k++;
      continue;
    }
    if (hard.has(w)) cut(k, k);
    else if (!(fillers && fillers.length) && SOFT_FILLERS.includes(w) && setOff(k, k)) cut(k, k);
  }
  return out;
}

// Pauses in a video as cuts: [{ start, end }], each pause shrunk by pad on both sides so words keep
// their breath. A pause at the very start or end goes completely (less pad).
async function silenceCuts(ctx, file, i, { minSilence = 0.45, threshold = -35, pad = 0.12 } = {}) {
  if (!i.hasAudio) return [];
  const quiet = await M.detectSilence(ctx, file, { threshold, minSilence, duration: i.duration });
  return quiet
    .map((q) => ({ start: q.start <= 0.05 ? 0 : q.start + pad, end: q.end >= i.duration - 0.05 ? i.duration : q.end - pad }))
    .map((c) => ({ start: r2(c.start), end: r2(Math.min(i.duration, c.end)) }))
    .filter((c) => c.end - c.start > 0.1);
}

// Points (seconds on the output clock) to zoom segments: alternate segments between the points get
// the punch-in. Returns [{ from, to, scale }].
function punchSteps(points, total, zoom) {
  const pts = [...new Set([0, ...points.filter((p) => p > 0.3 && p < total - 0.3).map(r2), r2(total)])].sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < pts.length && out.length < 60; k++) if (k % 2 === 1 && pts[k + 1] - pts[k] > 0.5) out.push({ from: pts[k], to: pts[k + 1], scale: zoom });
  return out;
}

function zoomChain(W, H, steps) {
  if (!steps.length) return '';
  const z = steps.map((s) => `between(t\\,${s.from.toFixed(2)}\\,${s.to.toFixed(2)})*${(s.scale - 1).toFixed(3)}`).join('+');
  // Grow the frame, then cut the middle back out, a little above center where faces are.
  return `,scale=w='trunc(${W}*(1+${z})/2)*2':h='trunc(${H}*(1+${z})/2)*2':eval=frame,crop=${W}:${H}:(iw-${W})/2:(ih-${H})*0.4`;
}

// Renders only the `keep` parts of a video, joined, with optional punch-ins. Each join gets a 12 ms
// sound fade so cuts never click.
async function renderKeep(ctx, file, i, keep, { zoom = [], what = 'The cut' } = {}) {
  const [W, H] = capSize(i);
  const src = sourceInputs(file, i);
  const n = keep.length;
  const parts = [];
  const vIn = n > 1 ? Array.from({ length: n }, (_, k) => `[vs${k}]`) : ['[vs0]'];
  const aIn = n > 1 ? Array.from({ length: n }, (_, k) => `[as${k}]`) : ['[as0]'];
  parts.push(`[0:v]fps=${FPS},scale=${W}:${H},setsar=1${n > 1 ? `,split=${n}${vIn.join('')}` : vIn[0]}`);
  parts.push(`${src.a}${STEREO}${n > 1 ? `,asplit=${n}${aIn.join('')}` : aIn[0]}`);
  let cat = '';
  keep.forEach((k, j) => {
    const len = Math.max(0.05, k.end - k.start);
    parts.push(`${vIn[j]}trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS[vt${j}]`);
    parts.push(`${aIn[j]}atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.012,afade=t=out:st=${Math.max(0, len - 0.012).toFixed(3)}:d=0.012[at${j}]`);
    cat += `[vt${j}][at${j}]`;
  });
  parts.push(`${cat}concat=n=${n}:v=1:a=1[cv][ca]`);
  parts.push(`[cv]null${zoomChain(W, H, zoom)},${BT709}[v]`);
  parts.push(`[ca]${LOUD}[a]`);
  const total = keep.reduce((t, k) => t + (k.end - k.start), 0);
  const out = path.join(M.scratch(ctx, 'cut'), 'cut.mp4');
  await M.run(ctx, [...src.args, '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3), ...M.encodeArgs(total), out], { what });
  return out;
}

const sumLen = (rs) => r2(rs.reduce((t, r) => t + Math.max(0, r.end - r.start), 0));

// Cuts any ranges out of a video in one render, optionally with punch-ins on every cut point (or
// every `every` seconds when there are no cuts). Returns { path, seconds, width, height, cuts, keep,
// removed, punches }.
async function cutRanges(ctx, file, cuts, { jump = false, every = 4, zoom = 1.12, info: known, what } = {}) {
  const i = known || (await videoInfo(ctx, file));
  const merged = M.mergeRanges(cuts.map((c) => ({ start: Math.max(0, c.start), end: Math.min(i.duration, c.end) })));
  const keep = M.keepFrom(merged, i.duration);
  if (!keep.length) throw new Error("That video is all quiet, so nothing would be left after cutting the pauses. Check the video has sound.");
  const total = sumLen(keep);
  let points = [];
  if (jump) {
    let t = 0;
    for (const k of keep.slice(0, -1)) {
      t += k.end - k.start;
      points.push(t);
    }
    // Long stretches without a cut get a point every `every` seconds too.
    const all = [0, ...points, total];
    const extra = [];
    for (let j = 0; j + 1 < all.length; j++) for (let p = all[j] + every; p < all[j + 1] - every / 2; p += every) extra.push(p);
    points = [...points, ...extra].sort((a, b) => a - b);
  }
  const steps = jump ? punchSteps(points, total, Math.max(1.02, Math.min(1.4, Number(zoom) || 1.12))) : [];
  const out = await renderKeep(ctx, file, i, keep, { zoom: steps, what });
  const removed = sumLen(merged);
  return M.done(ctx, out, { cuts: merged, keep, removed, punches: steps.length });
}

async function cutSilence(ctx, file, { minSilence = 0.45, threshold = -35, pad = 0.12 } = {}) {
  const i = await videoInfo(ctx, file);
  const cuts = await silenceCuts(ctx, file, i, { minSilence, threshold, pad });
  return cutRanges(ctx, file, cuts, { info: i, what: 'Cutting the pauses' });
}

async function cutWords(ctx, file, words, { fillers } = {}) {
  const i = await videoInfo(ctx, file);
  const cuts = fillerCuts(words, { fillers });
  const r = await cutRanges(ctx, file, cuts, { info: i, what: 'Cutting the filler words' });
  return { ...r, words: cuts.map((c) => c.word) };
}

async function jumpCuts(ctx, file, { every = 4, zoom = 1.12, cuts } = {}) {
  const i = await videoInfo(ctx, file);
  // Cut points given (seconds on this video's clock) become the punch points; else every few seconds.
  const pts = Array.isArray(cuts) && cuts.length ? cuts.map((c) => (typeof c === 'number' ? c : Number(c && (c.at != null ? c.at : c.start)))).filter(Number.isFinite) : [];
  const total = i.duration;
  const points = pts.length ? pts : Array.from({ length: Math.max(0, Math.floor(total / every)) }, (_, k) => (k + 1) * every);
  const steps = punchSteps(points, total, Math.max(1.02, Math.min(1.4, Number(zoom) || 1.12)));
  const out = await renderKeep(ctx, file, i, [{ start: 0, end: total }], { zoom: steps, what: 'The jump cuts' });
  return M.done(ctx, out, { punches: steps.length });
}

// ---------- frame, title, music ----------

async function reframe(ctx, file, { aspect = '9:16', focus = 0.5, fill = 'crop', labels } = {}) {
  const i = await videoInfo(ctx, file);
  const [W, H] = M.sizeOf(aspect);
  const src = sourceInputs(file, i);
  const v = M.fillChain({ srcW: i.width, srcH: i.height, W, H, fill, focus: Math.max(0, Math.min(1, Number(focus))), outLabel: '[f]' });
  const dir = M.scratch(ctx, 'frame');
  const out = path.join(dir, `frame-${aspect.replace(':', 'x')}.mp4`);
  // AI labels are drawn again in the new shape, so a crop never cuts them off.
  const lbl = C.labelEvents({ W, H, labels, start: 0, end: i.duration });
  let over = '';
  if (lbl.events.length) {
    const assFile = path.join(dir, 'labels.ass');
    fs.writeFileSync(assFile, media.assDoc({ width: W, height: H, styles: lbl.styles, events: lbl.events, title: 'Labels' }));
    over = `ass=${media.filterPath(assFile)},`;
  }
  await M.run(ctx, [...src.args, '-filter_complex', `${v};[f]${over}${BT709}[v];${src.a}${STEREO},${LOUD}[a]`, '-map', '[v]', '-map', '[a]', '-t', String(i.duration), ...M.encodeArgs(i.duration), out], { what: 'The reframe' });
  return M.done(ctx, out, { aspect, fill: fill === 'blur' ? 'blur' : 'crop', labels: lbl.lines || [] });
}

async function hookTitle(ctx, file, { text: title, seconds = 3, style = 'box', color: c, line, look, sample = false, labels } = {}) {
  const t = text.oneLine(title || '');
  if (!t) throw new Error('Write the hook title first, like "3 mistakes that make a video feel slow".');
  const i = await videoInfo(ctx, file);
  const [W, H] = capSize(i);
  const lk = look || M.lookFor(ctx, { color: c });
  const end = Math.min(i.duration, Math.max(1, Number(seconds) || 3));
  const lbl = C.labelEvents({ W, H, labels, start: 0, end: i.duration });
  const hook = C.hookEvents({ title: t, line, W, H, look: lk, style, start: 0, end, top: lbl.bottom != null ? lbl.bottom + 16 : undefined });
  const tag = sample ? C.sampleTag({ W, H, end: i.duration }) : null;
  const all = C.join(lbl, hook, tag);
  const doc = media.assDoc({ width: W, height: H, styles: all.styles, events: all.events, title: 'Hook' });
  const out = await burnAss(ctx, file, i, doc, { W, H, what: 'The hook title' });
  return M.done(ctx, out, { title: t, until: r2(end), labels: lbl.lines || [] });
}

// The bed: the member's track (looped to length) or one made in code. With a voice in the video the
// music is ducked under it (sidechain compression keyed on the voice), and fades out at the end.
async function musicBed(ctx, file, { music = null, level = 0.18, duck = true, seed } = {}) {
  const i = await videoInfo(ctx, file);
  const [W, H] = capSize(i);
  const dir = M.scratch(ctx, 'music');
  const dur = i.duration;
  let musicFile = music;
  if (musicFile) {
    const mi = await M.info(ctx, musicFile, 'That music file');
    if (!mi.hasAudio) throw new Error('That music file has no sound. Add an MP3, WAV or M4A.');
  } else {
    musicFile = path.join(dir, 'bed.wav');
    fs.writeFileSync(musicFile, M.musicWav(dur + 0.5, { seed: seed != null ? seed : text.hash(path.basename(file)), level: 0.9 }));
  }
  const args = ['-i', file, '-stream_loop', '-1', '-i', musicFile];
  const lv = Math.max(0.02, Math.min(1, Number(level) || 0.18));
  const fadeOut = Math.max(0, dur - 1.5).toFixed(2);
  const mus = `[1:a]${STEREO},atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${i.hasAudio ? lv : Math.max(lv, 0.8)},afade=t=in:d=0.4,afade=t=out:st=${fadeOut}:d=1.5`;
  let achain;
  if (i.hasAudio && duck) achain = `[0:a]${STEREO},asplit=2[vo][key];${mus}[mu];[mu][key]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=380:makeup=1[dk];[vo][dk]amix=inputs=2:duration=first:normalize=0,${LOUD}[a]`;
  else if (i.hasAudio) achain = `[0:a]${STEREO}[vo];${mus}[mu];[vo][mu]amix=inputs=2:duration=first:normalize=0,${LOUD}[a]`;
  else achain = `${mus},${LOUD}[a]`;
  const out = path.join(dir, 'music.mp4');
  await M.run(ctx, [...args, '-filter_complex', `[0:v]fps=${FPS},scale=${W}:${H},setsar=1,${BT709}[v];${achain}`, '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(3), ...M.encodeArgs(dur), out], { what: 'Adding the music' });
  return M.done(ctx, out, { music: music ? 'your track' : 'made in code', ducked: !!(i.hasAudio && duck) });
}

// ---------- b-roll ----------

// clips: [{ path, at, seconds }]. at missing on every clip: spread evenly. Each clip fills the frame
// (photos pan slowly); the video's own sound plays on unless keepAudio is false, then the clip's
// sound takes over while it shows and the voice drops low.
async function insertBroll(ctx, file, clips, { keepAudio = true } = {}) {
  const i = await videoInfo(ctx, file);
  const [W, H] = capSize(i);
  const dur = i.duration;
  const given = (clips || []).filter((c) => c && c.path);
  if (!given.length) throw new Error('Add at least one clip or photo to put over your video.');
  const spread = given.every((c) => c.at == null || !Number.isFinite(Number(c.at)));
  const plan = [];
  given.forEach((c, k) => {
    const secs = Math.max(0.8, Math.min(8, Number(c.seconds) || 2.5));
    const at = spread ? ((k + 1) * dur) / (given.length + 1) - secs / 2 : Number(c.at);
    plan.push({ ...c, at: Math.max(0, Math.min(dur - 0.8, at)), seconds: secs });
  });
  plan.sort((a, b) => a.at - b.at);
  // No overlaps: a clip that would start inside the last one moves after it, or is dropped.
  const used = [];
  for (const c of plan) {
    const last = used[used.length - 1];
    if (last && c.at < last.at + last.seconds) c.at = last.at + last.seconds;
    c.seconds = Math.min(c.seconds, dur - c.at);
    if (c.seconds >= 0.6) used.push(c);
  }
  const src = sourceInputs(file, i);
  const args = [...src.args];
  const parts = [`[0:v]fps=${FPS},scale=${W}:${H},setsar=1[b0]`];
  const audioParts = [];
  const audioLabels = [];
  let idx = src.next;
  let k = 0;
  for (const c of used) {
    const ci = await M.info(ctx, c.path, 'One of the b-roll files');
    const still = !ci.hasVideo || M.isStill(c.path) || ci.duration < 0.2;
    if (still) args.push('-loop', '1', '-framerate', String(FPS), '-t', c.seconds.toFixed(2), '-i', c.path);
    else args.push('-t', c.seconds.toFixed(2), '-i', c.path);
    let chain;
    if (still) {
      // Cover a slightly bigger frame, then pan across it.
      const bw = even(W * 1.12);
      const bh = even(H * 1.12);
      const dirX = k % 2 ? -1 : 1;
      chain = `[${idx}:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},crop=${W}:${H}:x='(iw-${W})*(0.5+${0.5 * dirX}*(t/${c.seconds.toFixed(2)}-0.5))':y='(ih-${H})/2',fps=${FPS},setsar=1`;
    } else {
      chain = `${M.fillChain({ srcW: ci.width, srcH: ci.height, W, H, fill: 'crop', inLabel: `[${idx}:v]`, outLabel: '' })},tpad=stop_mode=clone:stop_duration=${c.seconds.toFixed(2)},trim=duration=${c.seconds.toFixed(2)}`;
    }
    parts.push(`${chain},setpts=PTS-STARTPTS+${c.at.toFixed(3)}/TB[r${k}]`);
    parts.push(`[b${k}][r${k}]overlay=enable='between(t,${c.at.toFixed(3)},${(c.at + c.seconds).toFixed(3)})':eof_action=pass[b${k + 1}]`);
    if (!keepAudio && ci.hasAudio && !still) {
      const ms = Math.round(c.at * 1000);
      audioParts.push(`[${idx}:a]${STEREO},atrim=0:${c.seconds.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, c.seconds - 0.12).toFixed(2)}:d=0.12,adelay=${ms}|${ms}[ba${k}]`);
      audioLabels.push(`[ba${k}]`);
    }
    idx++;
    k++;
  }
  parts.push(`[b${k}]${BT709}[v]`);
  if (!keepAudio && audioParts.length) {
    const low = used.map((c) => `between(t,${c.at.toFixed(3)},${(c.at + c.seconds).toFixed(3)})`).join('+');
    parts.push(...audioParts);
    parts.push(`${src.a}${STEREO},volume=volume='if(${low},0.15,1)':eval=frame[main]`);
    parts.push(`[main]${audioLabels.join('')}amix=inputs=${audioParts.length + 1}:duration=first:normalize=0,${LOUD}[a]`);
  } else parts.push(`${src.a}${STEREO},${LOUD}[a]`);
  const out = path.join(M.scratch(ctx, 'broll'), 'broll.mp4');
  await M.run(ctx, [...args, '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(3), ...M.encodeArgs(dur), out], { what: 'Adding the b-roll' });
  return M.done(ctx, out, { inserted: used.map((c) => ({ at: r2(c.at), seconds: r2(c.seconds) })) });
}

// ---------- outro ----------

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Biggest size at which text fits a width in maxLines (real Inter widths, css mode).
function fitCss(str, { width, max, min, maxLines = 2, weight = 800 }) {
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const wrap = (size) => {
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
  };
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(size);
    if (lines.length <= maxLines && lines.every((l) => media.textWidth(l, size, { weight }) <= width)) return { size, lines };
  }
  return { size: min, lines: wrap(min).slice(0, maxLines) };
}

// The end card as an SVG: the business name big, a short line, the handle on a pill, the logo on
// top when there is one. look: lib/edit-media videoLook.
function outroSvg({ W, H, look, name, line, handle, logoPng }) {
  const u = Math.min(W, H) / 1080;
  const cx = W / 2;
  const tall = H > W;
  const nameFit = fitCss(name || 'Thanks for watching', { width: W * 0.8, max: Math.round(112 * u), min: Math.round(48 * u), maxLines: 2, weight: 900 });
  const lineFit = line ? fitCss(line, { width: W * 0.78, max: Math.round(46 * u), min: Math.round(30 * u), maxLines: 2, weight: 500 }) : null;
  const h = handle ? `@${String(handle).replace(/^@/, '')}` : '';
  const logoSize = Math.round(220 * u);
  const blocks = [];
  let y = 0;
  if (logoPng) {
    blocks.push({ kind: 'logo', y, h: logoSize });
    y += logoSize + 56 * u;
  }
  const nameH = nameFit.lines.length * nameFit.size * 1.08;
  blocks.push({ kind: 'name', y, h: nameH });
  y += nameH + 26 * u;
  if (lineFit) {
    const lh = lineFit.lines.length * lineFit.size * 1.3;
    blocks.push({ kind: 'line', y, h: lh });
    y += lh + 40 * u;
  }
  const pillSize = Math.round(40 * u);
  const pillW = h ? media.textWidth(h, pillSize, { weight: 700 }) + 70 * u : 0;
  const pillH = pillSize * 1.9;
  if (h) {
    blocks.push({ kind: 'pill', y, h: pillH });
    y += pillH;
  }
  const top = (tall ? H * 0.46 : H * 0.5) - y / 2;
  const body = [];
  for (const b of blocks) {
    const by = top + b.y;
    if (b.kind === 'logo') {
      body.push(`<clipPath id="lc"><circle cx="${cx}" cy="${by + logoSize / 2}" r="${logoSize / 2}"/></clipPath>`);
      body.push(`<circle cx="${cx}" cy="${by + logoSize / 2}" r="${logoSize / 2 + 8 * u}" fill="#ffffff" fill-opacity="0.9"/>`);
      body.push(`<image x="${cx - logoSize / 2}" y="${by}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#lc)" href="data:image/png;base64,${logoPng.toString('base64')}"/>`);
    } else if (b.kind === 'name') {
      nameFit.lines.forEach((l, k) => body.push(`<text x="${cx}" y="${by + nameFit.size * (0.86 + k * 1.08)}" text-anchor="middle" font-family="Inter" font-weight="900" font-size="${nameFit.size}" fill="#ffffff">${esc(l)}</text>`));
    } else if (b.kind === 'line') {
      lineFit.lines.forEach((l, k) => body.push(`<text x="${cx}" y="${by + lineFit.size * (0.95 + k * 1.3)}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="${lineFit.size}" fill="#ffffff" fill-opacity="0.82">${esc(l)}</text>`));
    } else if (b.kind === 'pill') {
      body.push(`<rect x="${cx - pillW / 2}" y="${by}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${look.box}"/>`);
      body.push(`<text x="${cx}" y="${by + pillH / 2 + pillSize * 0.36}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${pillSize}" fill="${look.onBox}">${esc(h)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${look.mid}"/><stop offset="1" stop-color="${look.deep}"/></linearGradient><radialGradient id="gl" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="${look.glow}" stop-opacity="0.35"/><stop offset="1" stop-color="${look.glow}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#gl)"/>${body.join('')}</svg>`;
}

async function outroCard(ctx, { W, H, look, name, line, handle, logo }) {
  let logoPng = null;
  if (logo) {
    try {
      logoPng = await media.frame(ctx, logo, { width: 440, height: 440, format: 'png' });
    } catch {
      logoPng = null;
    }
  }
  const png = await media.svgToPng(ctx, outroSvg({ W, H, look, name: text.clip(text.oneLine(name || ''), 60), line: text.clip(text.oneLine(line || ''), 90), handle: text.clip(text.oneLine(handle || ''), 40), logoPng }));
  const file = path.join(M.scratch(ctx, 'card'), 'card.png');
  fs.writeFileSync(file, png);
  return { file, logo: !!logoPng };
}

async function outro(ctx, file, { name, line, handle, color: c, logo = null, seconds = 2.5, look } = {}) {
  const i = await videoInfo(ctx, file);
  const [W, H] = capSize(i);
  const lk = look || M.lookFor(ctx, { color: c });
  const sec = Math.max(1.5, Math.min(6, Number(seconds) || 2.5));
  const card = await outroCard(ctx, { W, H, look: lk, name, line, handle, logo });
  const xf = 0.4;
  const dur = i.duration;
  const total = dur + sec - xf;
  const frames = Math.round(sec * FPS);
  const src = sourceInputs(file, i);
  const args = [...src.args, '-loop', '1', '-framerate', String(FPS), '-t', sec.toFixed(2), '-i', card.file];
  const ci = src.next;
  const parts = [
    `[0:v]fps=${FPS},scale=${W}:${H},setsar=1,format=yuv420p,settb=AVTB[m]`,
    `[${ci}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.035*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},trim=duration=${sec.toFixed(2)},setsar=1,format=yuv420p,settb=AVTB[c]`,
    `[m][c]xfade=transition=fade:duration=${xf}:offset=${(dur - xf).toFixed(3)},${BT709}[v]`,
    `${src.a}${STEREO},atrim=0:${dur.toFixed(3)},afade=t=out:st=${Math.max(0, dur - 0.6).toFixed(2)}:d=0.6,apad=whole_dur=${total.toFixed(3)},${LOUD}[a]`,
  ];
  const out = path.join(M.scratch(ctx, 'outro'), 'outro.mp4');
  await M.run(ctx, [...args, '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3), ...M.encodeArgs(total), out], { what: 'The end card' });
  return M.done(ctx, out, { card: r2(sec), logo: card.logo });
}

// ---------- captions ----------

async function captions(ctx, file, words, { style = 'bold', color: c, look, sample = false, hook, labels } = {}) {
  const list = M.flatWords(words);
  if (!list.length) throw new Error('There are no words to caption yet. Captions need the video transcribed first.');
  const i = await videoInfo(ctx, file);
  const [W, H] = capSize(i);
  const lk = look || M.lookFor(ctx, { color: c });
  const lbl = C.labelEvents({ W, H, labels, start: 0, end: i.duration });
  const top = lbl.bottom != null ? lbl.bottom + 16 : undefined;
  const extra = C.join(lbl, sample ? C.sampleTag({ W, H, end: i.duration }) : null, hook && hook.text ? C.hookEvents({ title: hook.text, line: hook.line, W, H, look: lk, style: hook.style, start: 0, end: Math.min(i.duration, hook.seconds || 3), top }) : null);
  const doc = C.captionsDoc(list, { style, W, H, look: lk, extra });
  const out = await burnAss(ctx, file, i, doc, { W, H, what: 'The captions' });
  return M.done(ctx, out, { style: C.STYLES.includes(style) ? style : 'bold', words: list.length, labels: lbl.lines || [] });
}

// ---------- assemble ----------

// scenes: [{ path, seconds, kind: 'video' | 'image', audio }] in order. voice: an audio file (or
// null); words: its word times (from 0 at the voice's start). keepAudio: the scenes' own sound is
// the voice (a talking clip). music: a file path, true for the bed made in code, or false. hook:
// a string or { text, seconds, style }. captions: a caption style or null. outro: { name, line,
// handle, logo } or null. Returns one finished MP4.
async function assemble(ctx, { scenes = [], voice = null, words = [], music = true, hook = null, captions: capStyle = null, outro: end = null, aspect = '9:16', maxSeconds = 60, keepAudio = false, look, color: c, sample = false, labels } = {}) {
  const [W, H] = M.sizeOf(aspect);
  const lk = look || M.lookFor(ctx, { color: c });
  const limit = Math.max(4, Math.min(180, Number(maxSeconds) || 60));
  const list = [];
  for (const s of scenes) {
    if (!s || !s.path) continue;
    const si = await M.info(ctx, s.path, 'One of the scenes');
    const still = s.kind === 'image' || M.isStill(s.path) || !si.hasVideo || !(si.duration > 0.3);
    if (!si.hasVideo && !M.isStill(s.path)) continue;
    list.push({ path: s.path, still, info: si, own: still ? 0 : si.duration, want: Number(s.seconds) || 0, audio: !still && si.hasAudio });
  }
  if (!list.length) throw new Error('There are no clips or pictures to put together yet.');
  const LEAD = voice ? 0.25 : 0;
  let vInfo = null;
  if (voice) {
    vInfo = await M.info(ctx, voice, 'The voiceover');
    if (!vInfo.hasAudio) vInfo = null;
  }
  // Scene lengths: their own (or asked) length, stretched to cover the voice when there is one.
  for (const s of list) s.len = s.still ? s.want || 3 : keepAudio ? s.own : Math.min(s.want || s.own, s.own + 3, 10);
  let total = list.reduce((t, s) => t + s.len, 0);
  const target = vInfo ? Math.min(limit, vInfo.duration + LEAD + 0.6) : Math.min(limit, total);
  const k = target / total;
  for (const s of list) s.len = Math.max(0.6, s.len * k);
  total = list.reduce((t, s) => t + s.len, 0);
  // The end card is the last scene, so the music plays under it.
  let card = null;
  if (end) {
    card = await outroCard(ctx, { W, H, look: lk, name: end.name, line: end.line, handle: end.handle, logo: end.logo });
    list.push({ path: card.file, still: true, card: true, len: Math.max(1.5, Math.min(5, Number(end.seconds) || 2.5)), audio: false });
  }
  const full = list.reduce((t, s) => t + s.len, 0);
  const args = [];
  const parts = [];
  const vLabels = [];
  const aLabels = [];
  let idx = 0;
  list.forEach((s, j) => {
    const L = s.len.toFixed(3);
    if (s.still) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', L, '-i', s.path);
      if (s.card) {
        const frames = Math.round(s.len * FPS);
        parts.push(`[${idx}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.03*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},trim=duration=${L},fade=t=in:st=0:d=0.3,setsar=1,format=yuv420p[s${j}]`);
      } else {
        // Gentle motion: cover a slightly bigger frame, pan across it (direction changes per scene).
        const bw = even(W * 1.14);
        const bh = even(H * 1.14);
        const dx = [1, -1, 0, 1][j % 4];
        const dy = [0, 0, 1, -1][j % 4];
        parts.push(`[${idx}:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},crop=${W}:${H}:x='(iw-${W})*(0.5+${0.5 * dx}*(t/${L}-0.5))':y='(ih-${H})*(0.5+${0.5 * dy}*(t/${L}-0.5))',fps=${FPS},trim=duration=${L},setsar=1,format=yuv420p[s${j}]`);
      }
    } else {
      // A clip shorter than its slot plays a little slower (up to 1.35x longer), then loops.
      const slow = keepAudio ? 1 : Math.max(1, Math.min(1.35, s.len / s.own));
      args.push('-stream_loop', '-1', '-t', (s.len / slow + 0.2).toFixed(3), '-i', s.path);
      parts.push(`[${idx}:v]setpts=(PTS-STARTPTS)*${slow.toFixed(3)},${M.fillChain({ srcW: s.info.width, srcH: s.info.height, W, H, fill: 'crop', inLabel: '', outLabel: '' })},trim=duration=${L},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[s${j}]`);
    }
    vLabels.push(`[s${j}]`);
    if (keepAudio) {
      if (s.audio) parts.push(`[${idx}:a]${STEREO},atrim=0:${L},asetpts=PTS-STARTPTS,apad=whole_dur=${L}[sa${j}]`);
      else parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${L}[sa${j}]`);
      aLabels.push(`[sa${j}]`);
    }
    idx++;
  });
  parts.push(`${vLabels.join('')}concat=n=${vLabels.length}:v=1:a=0[base]`);
  // Words on the video's clock.
  const shifted = M.flatWords(words).map((x) => ({ w: x.w, s: x.s + LEAD, e: x.e + LEAD })).filter((x) => x.s < total);
  const hk = typeof hook === 'string' ? { text: hook } : hook && hook.text ? hook : null;
  // AI labels from the start to the end card (the card stays clean); the hook title sits below them.
  const lbl = C.labelEvents({ W, H, labels, start: 0, end: total });
  const extra = C.join(
    lbl,
    hk ? C.hookEvents({ title: hk.text, line: hk.line, W, H, look: lk, style: hk.style || 'box', start: 0, end: Math.min(total, Number(hk.seconds) || 3), top: lbl.bottom != null ? lbl.bottom + 16 : undefined }) : null,
    sample ? C.sampleTag({ W, H, end: total }) : null,
  );
  const useCaps = capStyle && shifted.length;
  let assText = null;
  if (useCaps) assText = C.captionsDoc(shifted, { style: capStyle, W, H, look: lk, extra });
  else if (extra.events.length) assText = media.assDoc({ width: W, height: H, styles: extra.styles, events: extra.events, title: 'Video' });
  const dir = M.scratch(ctx, 'assemble');
  if (assText) {
    const assFile = path.join(dir, 'video.ass');
    fs.writeFileSync(assFile, assText);
    parts.push(`[base]ass=${media.filterPath(assFile)},${BT709}[v]`);
  } else parts.push(`[base]${BT709}[v]`);
  // Sound: the voice (or the scenes' own sound), the music bed under it, ducked.
  let voiceLabel = null;
  if (keepAudio) {
    parts.push(`${aLabels.join('')}concat=n=${aLabels.length}:v=0:a=1[vo0]`);
    voiceLabel = '[vo0]';
  } else if (vInfo) {
    args.push('-i', voice);
    const ms = Math.round(LEAD * 1000);
    parts.push(`[${idx}:a]${STEREO},adelay=${ms}|${ms},apad=whole_dur=${full.toFixed(3)},atrim=0:${full.toFixed(3)}[vo0]`);
    voiceLabel = '[vo0]';
    idx++;
  }
  let musicLabel = null;
  if (music) {
    let mf = typeof music === 'string' ? music : null;
    if (!mf) {
      mf = path.join(dir, 'bed.wav');
      fs.writeFileSync(mf, M.musicWav(full + 0.5, { seed: text.hash(String(hk ? hk.text : list.length)), level: 0.9 }));
    }
    args.push('-stream_loop', '-1', '-i', mf);
    const lv = voiceLabel ? 0.16 : 0.85;
    parts.push(`[${idx}:a]${STEREO},atrim=0:${full.toFixed(3)},asetpts=PTS-STARTPTS,volume=${lv},afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, full - 1.4).toFixed(2)}:d=1.4[mu]`);
    musicLabel = '[mu]';
    idx++;
  }
  if (voiceLabel && musicLabel) parts.push(`${voiceLabel}asplit=2[vo][key];${musicLabel}[key]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=380:makeup=1[dk];[vo][dk]amix=inputs=2:duration=first:normalize=0,${LOUD}[a]`);
  else if (voiceLabel) parts.push(`${voiceLabel}${LOUD}[a]`);
  else if (musicLabel) parts.push(`${musicLabel}${LOUD}[a]`);
  else {
    args.push(...media.silence(full + 0.5));
    parts.push(`[${idx}:a]${STEREO}[a]`);
  }
  const out = path.join(dir, 'video.mp4');
  await M.run(ctx, [...args, '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-t', full.toFixed(3), ...M.encodeArgs(full), out], { what: 'Putting the video together', timeoutSec: 840 });
  return M.done(ctx, out, { aspect, scenes: list.filter((s) => !s.card).length, captions: useCaps ? capStyle : null, outro: !!card, labels: lbl.lines || [], until: r2(total) });
}

module.exports = {
  cutSilence,
  cutWords,
  jumpCuts,
  reframe,
  hookTitle,
  musicBed,
  insertBroll,
  outro,
  captions,
  assemble,
  adSizes,
  // building blocks the tools use
  cutRanges,
  silenceCuts,
  fillerCuts,
  punchSteps,
  outroSvg,
  capSize,
  videoInfo,
  HARD_FILLERS,
};
