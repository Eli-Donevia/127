// A voiceover for a script, with the time each line is spoken, so scenes and captions land on the
// words. Three ways, best first:
//   elevenlabs  a natural voice with word timings (the `voice` key, 127's account)
//   flite       the free computer voice built into ffmpeg: clearly robotic, fine for timing and a
//               first test, and every output says so
//   none        no sound at all; lines are timed at reading pace so the video still works
// Nothing here guesses: the line times come from the audio itself (or reading pace when there is none).

const fs = require('fs');
const path = require('path');
const { media, text } = require('../../_kit');
const { speak } = require('./providers');
const { lineList, spokenOf } = require('./scenes');

const RATE = 16000; // flite speaks at 16 kHz mono
const LEAD = 0.2; // seconds before the first word
const GAP = 0.32; // seconds between lines
const READ_WPS = 2.6; // words a second when nothing is spoken (on-screen reading pace)
const FLITE_VOICES = { female: 'slt', male: 'rms' };

const r2 = (n) => Math.round(n * 100) / 100;
const wordsIn = (s) => String(s || '').split(/\s+/).filter(Boolean);

// What a voice should not read out: links, handles, hashtags.
function sayable(s) {
  return text
    .oneLine(String(s || '').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)[@#][\w.]+/g, '$1').replace(/\s+([,.!?])/g, '$1'))
    .replace(/^[,.;:\s]+/, '')
    .replace(/([^.!?])$/, '$1.');
}

// The lines to say: a script's labelled lines (HOOK:, LINE:, POINT:, CTA: ...) or plain text, one line
// per row, long rows split into sentences. Returns [{ type, text, sub, say }].
function linesToSay({ script, text: plainText } = {}) {
  const src = script && typeof script === 'object' ? script.text : script;
  const labelled = lineList(src || '');
  if (labelled.length) return labelled.map((l) => ({ type: l.type, text: l.text, sub: l.sub || '', say: sayable(spokenOf({ ...l, sub: l.type === 'OFFER' ? l.sub : '' })) })).filter((l) => l.say.length > 1);
  const rows = String(src || plainText || '').split(/\r?\n/).map((r) => text.oneLine(r)).filter(Boolean);
  const out = [];
  for (const r of rows) {
    const parts = r.length > 140 ? r.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [r] : [r];
    for (const p of parts) {
      const t = text.oneLine(p);
      if (t) out.push({ type: 'LINE', text: t, sub: '', say: sayable(t) });
    }
  }
  return out.filter((l) => l.say.length > 1);
}

// Word times inside one line, spread by length (flite gives no word timings of its own).
function spread(say, start, end) {
  const ws = wordsIn(say);
  const total = ws.reduce((n, w) => n + w.length + 1, 0) || 1;
  let t = start;
  return ws.map((w) => {
    const d = ((end - start) * (w.length + 1)) / total;
    const out = { w, s: r2(t), e: r2(t + d) };
    t += d;
    return out;
  });
}

// Reading-pace times when there is no audio.
function readingTimes(lines) {
  let t = LEAD;
  const words = [];
  const timed = lines.map((l) => {
    const d = Math.max(1.5, wordsIn(l.say).length / READ_WPS + 0.3);
    const out = { ...l, start: r2(t), end: r2(t + d) };
    words.push(...spread(l.say, t, t + d));
    t += d + GAP;
    return out;
  });
  return { lines: timed, words, seconds: r2(t - GAP + 0.6) };
}

// Trims flite's quiet head and tail (keeps 40 ms), so lines sit tight and times are true.
function trimQuiet(pcm, threshold = 260) {
  const n = Math.floor(pcm.length / 2);
  let a = 0;
  let b = n - 1;
  while (a < n && Math.abs(pcm.readInt16LE(a * 2)) < threshold) a++;
  while (b > a && Math.abs(pcm.readInt16LE(b * 2)) < threshold) b--;
  const pad = Math.round(0.04 * RATE);
  a = Math.max(0, a - pad);
  b = Math.min(n - 1, b + pad);
  return b > a ? pcm.subarray(a * 2, (b + 1) * 2) : pcm;
}

function wavOf(pcm, rate = RATE) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// The free computer voice, one line at a time so every line's start and end are exact.
async function viaFlite(ctx, lines, { gender = 'female' } = {}) {
  const voice = FLITE_VOICES[gender] || 'slt';
  const dir = media.scratch(ctx, 'voice');
  const parts = [Buffer.alloc(Math.round(LEAD * RATE) * 2)];
  let t = LEAD;
  const words = [];
  const timed = [];
  for (let i = 0; i < lines.length; i++) {
    const f = path.join(dir, `l${i}.txt`);
    fs.writeFileSync(f, lines[i].say);
    const { stdout } = await media.ffmpeg(['-f', 'lavfi', '-i', `flite=textfile=${media.filterPath(f)}:voice=${voice}`, '-ar', String(RATE), '-ac', '1', '-f', 's16le', '-'], { timeoutSec: 60, signal: ctx && ctx.signal });
    const pcm = trimQuiet(stdout);
    const d = pcm.length / 2 / RATE;
    timed.push({ ...lines[i], start: r2(t), end: r2(t + d) });
    words.push(...spread(lines[i].say, t, t + d));
    parts.push(pcm, Buffer.alloc(Math.round((i === lines.length - 1 ? 0.5 : GAP) * RATE) * 2));
    t += d + (i === lines.length - 1 ? 0.5 : GAP);
  }
  const raw = path.join(dir, 'raw.wav');
  fs.writeFileSync(raw, wavOf(Buffer.concat(parts)));
  const out = path.join(dir, 'voice.mp3');
  // A little cleanup so it sits well under music: low rumble off, harsh top off, even level.
  await media.ffmpeg(['-i', raw, '-af', 'highpass=f=80,lowpass=f=7400,acompressor=threshold=0.125:ratio=2.5:attack=5:release=80,aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', out], { timeoutSec: 120, signal: ctx && ctx.signal });
  return { file: out, lines: timed, words, seconds: r2(t), engine: 'flite', voice: `Computer voice (${gender === 'male' ? 'male' : 'female'})`, usd: 0 };
}

// ElevenLabs: one request for the whole script, then its word timings are counted off line by line.
async function viaElevenLabs(ctx, key, lines, { gender = 'female', seed = '' } = {}) {
  const said = lines.map((l) => l.say).join(' ');
  const v = await speak(ctx, key, said, { gender, seed });
  const dir = media.scratch(ctx, 'voice');
  const file = path.join(dir, 'voice.mp3');
  fs.writeFileSync(file, v.audio);
  const counts = lines.map((l) => wordsIn(l.say).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const ws = v.words;
  const end = ws.length ? ws[ws.length - 1].e : 0;
  let i = 0;
  const timed = lines.map((l, k) => {
    // Same count of words as the text: exact. Otherwise share them out by position.
    const from = ws.length === total ? i : Math.round((i / total) * ws.length);
    const to = ws.length === total ? i + counts[k] : Math.round(((i + counts[k]) / total) * ws.length);
    i += counts[k];
    const mine = ws.slice(from, Math.max(from + 1, to));
    const start = mine.length ? mine[0].s : end;
    const stop = mine.length ? mine[mine.length - 1].e : end;
    return { ...l, start: r2(start), end: r2(stop) };
  });
  await ctx.spend(v.usd, 'Voiceover');
  return { file, lines: timed, words: ws.map((x) => ({ w: x.w, s: r2(x.s), e: r2(x.e) })), seconds: r2(end + 0.4), engine: 'elevenlabs', voice: v.voice, usd: v.usd, chars: v.chars };
}

// The voiceover: the natural voice when the key is on, else the computer voice (when robot is
// allowed and ffmpeg has it), else timing only. Never throws for a missing key; a failed service
// call falls back the same way and says so in `note`.
async function makeVoice(ctx, lines, { gender = 'female', seed = '', robot = true } = {}) {
  if (!lines.length) throw new Error('There are no lines to read. Add the words you want said, one line each.');
  let key = null;
  try {
    key = ctx.secret('voice');
  } catch {
    key = null;
  }
  let problem = '';
  if (key) {
    try {
      return { ...(await viaElevenLabs(ctx, key, lines, { gender, seed })), note: '' };
    } catch (e) {
      problem = `The voice service didn't answer (${String(e.message).slice(0, 80)}).`;
      ctx.log(`Natural voice skipped: ${String(e.message).slice(0, 100)}`);
    }
  }
  if (robot && media.canRender(ctx) && media.hasFilter('flite')) {
    const out = await viaFlite(ctx, lines, { gender });
    return { ...out, note: `${problem || 'The natural voice is not switched on here yet.'} This is the free computer voice: it sounds robotic. Use it to check timing, then record your own voice reading the script before you post.`.trim() };
  }
  const t = readingTimes(lines);
  return { file: null, ...t, engine: 'none', voice: '', usd: 0, note: `${problem ? `${problem} ` : ''}No voice was made${robot ? ' (no voice is available on this server right now)' : ''}, so the lines are timed at reading pace. Record your own voice reading the script and add it to the video in your editor.`.trim() };
}

module.exports = { linesToSay, makeVoice, readingTimes, spread, sayable, viaFlite, FLITE_VOICES, READ_WPS };
