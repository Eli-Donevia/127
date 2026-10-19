// Word timings: the one shape every video tool shares. A word is { w, s, e } (text, start and end in
// seconds on the source's clock). Tool outputs store them compactly as [w, s, e] to stay small.
// Pure functions: sentences, caption cues (SRT and VTT), a readable transcript, time stamps.

const { text } = require('../../_kit');

const r2 = (n) => Math.round(Number(n) * 100) / 100;

function one(x) {
  if (Array.isArray(x)) return { w: String(x[0] == null ? '' : x[0]), s: Number(x[1]), e: Number(x[2]) };
  if (x && typeof x === 'object') return { w: String(x.w != null ? x.w : x.word != null ? x.word : x.text || ''), s: Number(x.s != null ? x.s : x.start), e: Number(x.e != null ? x.e : x.end) };
  return null;
}

// Accepts transcribe outputs ([{ words }], some may be { error }), { words }, [[w,s,e]] or [{w,s,e}],
// and returns clean, sorted words with duplicates (from overlapping minutes) removed.
function flatten(input) {
  const raw = [];
  const add = (list) => {
    for (const x of list || []) {
      const o = one(x);
      if (o && o.w.trim() && Number.isFinite(o.s) && Number.isFinite(o.e)) raw.push({ w: o.w.trim(), s: o.s, e: Math.max(o.e, o.s + 0.04) });
    }
  };
  if (Array.isArray(input)) {
    if (input.length && input.every((x) => x && typeof x === 'object' && !Array.isArray(x) && ('words' in x || 'error' in x))) {
      for (const block of input) if (block && Array.isArray(block.words)) add(block.words);
    } else add(input);
  } else if (input && Array.isArray(input.words)) add(input.words);
  raw.sort((a, b) => a.s - b.s);
  const out = [];
  for (const x of raw) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.s - x.s) < 0.03 && prev.w.toLowerCase() === x.w.toLowerCase()) continue;
    out.push(x);
  }
  return out;
}

function compact(words) {
  return (words || []).map((x) => [x.w, r2(x.s), r2(x.e)]);
}

// Words that start inside [start, end).
function slice(words, start, end) {
  return (words || []).filter((x) => x.s >= start - 0.001 && x.s < end);
}

const END = /[.!?]["')\]]?$/;

// Sentences: break at end punctuation, or at a pause of maxGap seconds, or after maxWords words.
function sentences(words, { maxGap = 0.9, maxWords = 40 } = {}) {
  const out = [];
  let cur = [];
  const push = () => {
    if (!cur.length) return;
    out.push({ text: cur.map((x) => x.w).join(' '), start: cur[0].s, end: cur[cur.length - 1].e, words: cur, i: out.length });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const x = words[i];
    const prev = cur[cur.length - 1];
    if (prev && (x.s - prev.e > maxGap || cur.length >= maxWords)) push();
    cur.push(x);
    if (END.test(x.w)) push();
  }
  push();
  return out;
}

// Caption cues for SRT and VTT: at most 2 lines of 42 characters, at most 6 seconds, broken at
// sentence ends and pauses. Returns [{ start, end, text }] with lines joined by a newline.
function cues(words, { maxChars = 42, maxLines = 2, maxDur = 6, minDur = 0.9, offset = 0 } = {}) {
  const out = [];
  let lines = [[]];
  let first = null;
  let last = null;
  const len = (line) => line.reduce((n, x) => n + x.w.length, 0) + Math.max(0, line.length - 1);
  const push = () => {
    const t = lines.map((l) => l.map((x) => x.w).join(' ')).filter(Boolean).join('\n');
    if (t && first) out.push({ start: Math.max(0, first.s - offset), end: Math.max(0, last.e - offset), text: t });
    lines = [[]];
    first = null;
    last = null;
  };
  for (let i = 0; i < words.length; i++) {
    const x = words[i];
    if (first && (x.s - last.e > 0.7 || x.e - first.s > maxDur)) push();
    let line = lines[lines.length - 1];
    if (line.length && len(line) + 1 + x.w.length > maxChars) {
      if (lines.length >= maxLines) push();
      else lines.push([]);
      line = lines[lines.length - 1];
    }
    line.push(x);
    if (!first) first = x;
    last = x;
    if (END.test(x.w) && x.e - first.s >= minDur) push();
  }
  push();
  // No overlaps, and a short cue stays up until the next one starts (up to a second longer).
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    if (next) out[i].end = Math.min(next.start, Math.max(out[i].end, Math.min(out[i].start + minDur, next.start), Math.min(out[i].end + 1, next.start)));
    out[i].start = r2(out[i].start);
    out[i].end = r2(Math.max(out[i].end, out[i].start + 0.3));
  }
  return out;
}

// 75.4 -> "1:15", 3725 -> "1:02:05". pad: always show hours ("00:01:15" style for chapters uses chapterStamp).
function stamp(sec) {
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// YouTube chapter style: "00:00", "01:15", "1:02:05".
function chapterStamp(sec) {
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// A readable transcript: paragraphs of a few sentences with a time stamp in front of each.
function transcriptText(words, { title, every = 30 } = {}) {
  const sents = sentences(words);
  const paras = [];
  let cur = null;
  for (const s of sents) {
    if (!cur || s.start - cur.start >= every || (cur.prevEnd != null && s.start - cur.prevEnd > 1.2)) {
      cur = { start: s.start, parts: [] };
      paras.push(cur);
    }
    cur.parts.push(s.text);
    cur.prevEnd = s.end;
  }
  const body = paras.map((p) => `[${stamp(p.start)}] ${p.parts.join(' ')}`).join('\n\n');
  return `${title ? `${text.oneLine(title)}\n\n` : ''}${body}\n`;
}

function duration(words) {
  return words.length ? words[words.length - 1].e : 0;
}

// Words per second over a span (speech pace), ignoring long pauses.
function pace(words) {
  if (words.length < 2) return 0;
  const span = words[words.length - 1].e - words[0].s;
  return span > 0 ? words.length / span : 0;
}

module.exports = { flatten, compact, slice, sentences, cues, stamp, chapterStamp, transcriptText, duration, pace, r2, END };
