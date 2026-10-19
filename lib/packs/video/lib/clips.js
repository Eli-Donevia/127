// Finding the moments worth cutting from a long video. Code scores every window that starts and ends
// on a sentence (a strong first line, a complete thought, a payoff, a good length); AI only reranks
// and titles the top few. Titles for the on-screen hook come from the clip's own words.

const { text } = require('../../_kit');
const { sentences, slice, compact, stamp, r2, END } = require('./words');

// Lines that make people stop scrolling: a claim, a number, a warning, a question, a promise of how.
const HOOK = [
  [/\?$/, 3],
  [/^(here'?s|this is) (the|what|how|why|my)\b/i, 2.5],
  [/\b(the|my) (first|biggest|one|only|real|best|worst|number one)\b/i, 2],
  [/\b(don'?t|never|stop|quit|avoid)\b/i, 2],
  [/\b(mistake|wrong|secret|truth|nobody|most people|everyone|myth|instead)\b/i, 2],
  [/\b(how to|why|what if|if you)\b/i, 1.5],
  [/\b(\d+|one|two|three|five|ten|twenty)\b/i, 1],
  [/\byou(r)?\b/i, 0.8],
  [/\b(decide|changes?|saves?|works?|fix(es)?|matters?)\b/i, 1],
];
// Lines that make a weak opening: fillers, connectors, sign-posts and goodbyes.
const WEAK_START = /^(so|and|but|um+|uh+|like|okay|ok|anyway|also|then|now|well|right|yeah|number (one|two|three|four|five)\b|here'?s the (first|next|last) one|thanks? for|thank you|that'?s it|hi\b|hey\b|hello\b)/i;
// Sign-posts start a new section ("Number two...", "Now, reading."): a clip shouldn't run across one.
const SIGNPOST = /^(number (one|two|three|four|five|six|seven)\b|here'?s the (first|next|last|second|third)\b|(now|next|first|second|third|finally|okay so|alright|all right),)/i;
const PAYOFF = /\b(start|stop|check|ask|try|book|drop|say|do|use|pick|write|call|send|walk away|instead|so that|because|that'?s why|the goal|the answer|the trick)\b/i;
const GOODBYE = /\b(thanks for watching|see you|subscribe|link in (my|the) bio|bye)\b/i;

function hookScore(line) {
  let s = 0;
  for (const [re, w] of HOOK) if (re.test(line)) s += w;
  const words = line.split(/\s+/).length;
  if (words <= 12) s += 1;
  if (words <= 7 && !/\?$/.test(line)) s += 0.8; // short and quotable
  if (words > 26) s -= 1.5;
  if (WEAK_START.test(line)) s -= 3;
  return s;
}

// All windows of whole sentences between min and max seconds, scored.
function candidates(words, { min = 15, max = 45, target = 28 } = {}) {
  const sents = sentences(words);
  // A pause counts as a section break when it's clearly longer than this speaker's usual pause.
  const gaps = sents.slice(1).map((x, k) => x.start - sents[k].end).sort((a, b) => a - b);
  const usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0.4;
  const gapLimit = Math.max(0.9, usual * 1.4);
  const breaks = sents.map((x, k) => k > 0 && (x.start - sents[k - 1].end > gapLimit || SIGNPOST.test(x.text)));
  const out = [];
  for (let i = 0; i < sents.length; i++) {
    const first = sents[i];
    if (GOODBYE.test(first.text)) continue;
    let payoff = 0;
    for (let j = i; j < sents.length; j++) {
      const last = sents[j];
      if (j > i && last.start - sents[j - 1].end > 2.5) break; // a long silence ends the thought
      const dur = last.end - first.start;
      if (dur > max) break;
      if (PAYOFF.test(last.text)) payoff += 1;
      if (dur < min) continue;
      const span = sents.slice(i, j + 1);
      const n = span.reduce((k, x) => k + x.words.length, 0);
      const wps = n / Math.max(1, dur);
      let score = hookScore(first.text) * 2;
      score += Math.min(3, payoff) * 0.8;
      score += END.test(last.text) ? 1 : -2;
      score -= Math.abs(dur - target) / 12;
      if (wps < 1.4) score -= 2; // long pauses, not much said
      if (span.some((x) => GOODBYE.test(x.text))) score -= 2.5;
      for (let k = i + 1; k <= j; k++) if (breaks[k]) score -= 4; // runs into the next section
      if (SIGNPOST.test(last.text)) score -= 3;
      // A section break (a longer pause) right after the window is a natural ending.
      const next = sents[j + 1];
      if (!next || next.start - last.end > gapLimit || SIGNPOST.test(next.text)) score += 1;
      // Starting right after a pause is a natural beginning.
      const prev = sents[i - 1];
      if (!prev || first.start - prev.end > gapLimit || SIGNPOST.test(prev.text)) score += 0.8;
      out.push({ i, j, start: first.start, end: last.end, score: Math.round(score * 100) / 100, first: first.text, text: span.map((x) => x.text).join(' ') });
    }
  }
  return { sents, list: out.sort((a, b) => b.score - a.score) };
}

// The best `count` windows that don't overlap (with a 1 second gap), skipping weak ones (score
// under floor) when there's a choice.
function pickWindows(list, count, chosen = [], floor = 0) {
  for (const c of list) {
    if (chosen.length >= count) break;
    if (c.score < floor) continue;
    if (chosen.some((x) => c.start < x.end + 1 && c.end > x.start - 1)) continue;
    chosen.push(c);
  }
  return chosen;
}

// A hook title from a clip's own words: its first line when that's strong, else its strongest line,
// tidied. At most 60 characters (two lines in the title box).
function titleFor(textOrSentences, { max = 60 } = {}) {
  const lines = Array.isArray(textOrSentences) ? textOrSentences : String(textOrSentences || '').split(/(?<=[.!?])\s+/);
  const lead = String(lines[0] || '').trim();
  if (lead && hookScore(lead) >= 1.8 && lead.length <= max) return tidyTitle(lead, max);
  const ranked = lines
    .map((l) => String(l).trim())
    .filter(Boolean)
    .map((l, k) => ({ l, s: hookScore(l) - k * 0.35 - (l.length > max ? 1.5 : 0) }))
    .sort((a, b) => b.s - a.s);
  for (const { l } of ranked) {
    const t = tidyTitle(l, max);
    if (t && t.split(' ').length >= 3) return t;
  }
  return tidyTitle(lines[0] || 'Watch this', max);
}

function tidyTitle(line, max = 60) {
  let t = text.oneLine(line)
    .replace(/^(so|and|but|well|now|okay|ok|look|listen),?\s+/i, '')
    .replace(/^(here'?s the thing|the thing is),?\s*/i, '')
    .replace(/["“”]/g, '')
    .trim();
  t = t.replace(/[.!]+$/, '');
  if (t.length > max) {
    // Keep the first clause if it stands on its own.
    const clause = t.split(/,\s+|\s+and\s+|\s+but\s+/)[0];
    t = clause.length >= 12 && clause.length <= max ? clause : text.clip(t, max).replace(/\.\.\.$/, '');
  }
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// Why this moment works, in plain words, from what the code saw.
function whyFor(c) {
  const bits = [];
  if (/\?$/.test(c.first)) bits.push('opens on a question people want answered');
  else if (hookScore(c.first) >= 4) bits.push('opens on a strong line');
  if (PAYOFF.test(c.text)) bits.push('ends with something to do');
  bits.push(`${Math.round(c.end - c.start)} seconds, one complete thought`);
  return text.sentenceCase(text.list(bits));
}

// Turns windows into clip records with their words (absolute times) and a hook title.
function toClips(windows, words, sents) {
  return windows.map((c, k) => {
    const span = sents.slice(c.i, c.j + 1);
    const start = Math.max(0, r2(c.start - 0.15));
    const end = r2(c.end + 0.35);
    return {
      id: `clip-${k + 1}`,
      n: k + 1,
      start,
      end,
      seconds: r2(end - start),
      range: `${stamp(start)} to ${stamp(end)}`,
      title: c.title || titleFor(span.map((x) => x.text)),
      why: c.why || whyFor(c),
      score: c.score,
      firstLine: text.clip(span[0].text, 120),
      text: text.clip(span.map((x) => x.text).join(' '), 600),
      words: compact(slice(words, start, end)),
    };
  });
}

// Code-only picks: the top `count` windows. Short videos fall back to looser windows so there's
// always something to cut; weak windows come last.
function heuristicClips(words, { count = 5, min = 15, max = 45 } = {}) {
  const { sents, list } = candidates(words, { min, max, target: (min + max) / 2 });
  const picked = pickWindows(list, count);
  let loose = null;
  if (picked.length < count && min > 8) {
    loose = candidates(words, { min: Math.max(6, min / 2), max, target: min }).list;
    pickWindows(loose, count, picked);
  }
  if (picked.length < count) pickWindows(loose || list, count, picked, -Infinity);
  return { clips: toClips(picked, words, sents), candidates: list, sents };
}

module.exports = { candidates, pickWindows, heuristicClips, toClips, titleFor, tidyTitle, hookScore, whyFor, WEAK_START, SIGNPOST };
