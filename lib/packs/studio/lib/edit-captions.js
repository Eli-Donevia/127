// Caption and title drawings (ASS, burned by libass) for the studio's edits.
//
// Six caption looks. bold, box and clean come from the kit (media.captionsAss); the other three are
// built here on the kit's caption pages:
//   bold     big uppercase, the spoken word turns the pop color and grows
//   box      uppercase, the spoken word sits on a rounded box in the brand color
//   clean    sentence case with a soft shadow, words go from dim to white as they're said
//   karaoke  one or two lines, the color sweeps through each word as it's said
//   pop      one word at a time, big, popping in, every other word in the pop color
//   minimal  small sentence case phrases low in the frame, no highlight (for calm, talky videos)
// Hook titles: a rounded box (box), a white card (white) or big outlined words (bold) near the top,
// inside the Reels and Stories safe zone, that rise in and fade out after the first seconds.

const { media, text } = require('../../_kit');

const STYLES = ['bold', 'box', 'clean', 'karaoke', 'pop', 'minimal'];
const HOOK_STYLES = ['box', 'white', 'bold'];
const ff = (n) => Math.round(n * 10) / 10;
const cs = (sec) => Math.max(1, Math.round(sec * 100));

// Where captions sit: lower middle for tall video (clear of the app buttons and the post text), lower
// third for wide video.
function captionY(W, H, style) {
  if (style === 'minimal') return W > H ? H * 0.86 : W === H ? H * 0.82 : H * 0.7;
  if (W > H) return H * 0.8;
  if (W === H) return H * 0.74;
  if (H / W < 1.5) return H * 0.7;
  return H * 0.6;
}

function palette(look) {
  return { text: '#ffffff', pop: look.pop, outline: look.outline || '#0b0b10', box: look.box, onBox: look.onBox };
}

// One whole line of words as plain text, uppercase for the loud looks.
const lineText = (line, upper) => line.map((w) => (upper ? w.text : String(w.w).replace(/[{}\\]/g, ''))).join(' ');

function karaokeEvents(words, { W, H, look, cy }) {
  const unit = Math.min(W, H) / 1080;
  const size = Math.round(74 * unit * (W > H ? 0.86 : 1));
  const pages = media.captionPages(words, { style: 'clean', width: W, height: H, size, maxWords: 8, maxLines: 2 });
  const lineH = size * 1.2;
  const out = [];
  // \kf sweeps from the secondary color (white) to the primary (pop) over each word's time.
  const base = `\\bord${ff(6 * unit)}\\shad${ff(3 * unit)}\\3c${media.assTagColor(look.outline || '#0b0b10')}\\4c&H000000&\\4a&H80&\\1c${media.assTagColor(look.pop)}\\2c&HFFFFFF&`;
  for (const p of pages) {
    const top = cy - (p.lines.length * lineH) / 2;
    p.lines.forEach((line, li) => {
      const y = top + li * lineH + lineH / 2;
      const lead = line[0].s - p.start;
      let body = lead > 0.02 ? `{\\k${cs(lead)}}` : '';
      line.forEach((w, j) => {
        const next = line[j + 1];
        const d = next ? next.s - w.s : Math.max(0.1, w.e - w.s);
        body += `{\\kf${cs(d)}}${media.assText(String(w.w).replace(/[{}\\]/g, ''))}${next ? ' ' : ''}`;
      });
      out.push(media.assEvent({ layer: 1, start: p.start, end: p.end, style: 'Kar', text: `{\\an5\\pos(${ff(W / 2)},${ff(y)})${base}}${body}` }));
    });
  }
  return { styles: [media.assStyle({ name: 'Kar', font: 'Inter ExtraBold', size, color: look.pop, secondary: '#ffffff', align: 5, outline: 6, shadow: 3 })], events: out };
}

function popEvents(words, { W, H, look, cy }) {
  const unit = Math.min(W, H) / 1080;
  const size = Math.round(118 * unit * (W > H ? 0.86 : 1));
  const list = media.captionWords(words);
  const out = [];
  const maxW = W * 0.84;
  list.forEach((w, i) => {
    const next = list[i + 1];
    const end = next && next.s - w.e < 0.35 ? next.s : w.e + 0.18;
    if (end - w.s < 0.04) return;
    const word = String(w.w).toUpperCase().replace(/[{}\\]/g, '').replace(/[.,;:]+$/g, '');
    const wpx = media.textWidth(word, size, { weight: 900, mode: 'ass' });
    const fs = wpx > maxW ? Math.floor((size * maxW) / wpx) : size;
    const c = i % 2 ? look.pop : '#ffffff';
    const anim = '\\fscx62\\fscy62\\t(0,90,\\fscx110\\fscy110)\\t(90,170,\\fscx100\\fscy100)';
    out.push(media.assEvent({ layer: 1, start: w.s, end, style: 'Pop', text: `{\\an5\\pos(${ff(W / 2)},${ff(cy)})\\fs${fs}\\bord${ff(8 * unit)}\\shad${ff(4 * unit)}\\3c${media.assTagColor(look.outline || '#0b0b10')}\\4c&H000000&\\4a&H70&\\c${media.assTagColor(c)}${anim}}${media.assText(word)}` }));
  });
  return { styles: [media.assStyle({ name: 'Pop', font: 'Inter Black', size, align: 5, outline: 8, shadow: 4 })], events: out };
}

function minimalEvents(words, { W, H, cy }) {
  const unit = Math.min(W, H) / 1080;
  const size = Math.round(50 * unit * (W > H ? 0.9 : 1));
  const pages = media.captionPages(words, { style: 'clean', width: W, height: H, size, maxWords: 9, maxLines: 2, maxWidth: W * 0.78 });
  const lineH = size * 1.25;
  const out = [];
  for (const p of pages) {
    const top = cy - (p.lines.length * lineH) / 2;
    p.lines.forEach((line, li) => {
      const y = top + li * lineH + lineH / 2;
      out.push(media.assEvent({ layer: 1, start: p.start, end: p.end, style: 'Min', text: `{\\an5\\pos(${ff(W / 2)},${ff(y)})\\bord0\\shad${ff(2 * unit)}\\4c&H000000&\\4a&H60&\\c&HFFFFFF&\\fad(80,80)}${media.assText(lineText(line, false))}` }));
    });
  }
  return { styles: [media.assStyle({ name: 'Min', font: 'Inter Medium', size, align: 5, outline: 0, shadow: 2 })], events: out };
}

// A whole ASS file of captions for words (on the video's own clock), plus `extra` drawings.
function captionsDoc(words, { style = 'bold', W = 1080, H = 1920, look, extra = {}, title = 'Captions' }) {
  const st = STYLES.includes(style) ? style : 'bold';
  const cy = captionY(W, H, st);
  if (st === 'bold' || st === 'box' || st === 'clean') {
    return media.captionsAss(words, { style: st, width: W, height: H, cy, palette: palette(look), title, extra });
  }
  const made = st === 'karaoke' ? karaokeEvents(words, { W, H, look, cy }) : st === 'pop' ? popEvents(words, { W, H, look, cy }) : minimalEvents(words, { W, H, cy });
  return media.assDoc({ width: W, height: H, styles: [...made.styles, ...(extra.styles || [])], events: [...(extra.events || []), ...made.events], title });
}

// ---------- hook titles ----------

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
function fitTitle(title, { maxW, max = 72, min = 36, maxLines = 3, weight = 800 }) {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrapAss(title, size, maxW, weight);
    if (lines.length <= maxLines && lines.every((l) => media.textWidth(l, size, { weight, mode: 'ass' }) <= maxW)) return { size, lines };
  }
  return { size: min, lines: wrapAss(title, min, maxW, weight).slice(0, maxLines) };
}

// Top of the title: inside the safe zone (Reels and Stories keep the top 14% clear).
function titleTop(W, H) {
  const r = H / W;
  if (r > 1.6) return H * 0.17;
  if (r > 1.1) return H * 0.1;
  if (r > 0.9) return H * 0.09;
  return H * 0.08;
}

// ASS styles and events for a hook title over [start, end]. line: an optional smaller line under it
// (a hook variant's first caption line).
function hookEvents({ title, line, W = 1080, H = 1920, look, style = 'box', start = 0, end = 3, layer = 10, top }) {
  const unit = Math.min(W, H) / 1080;
  const st = HOOK_STYLES.includes(style) ? style : 'box';
  const tall = H > W;
  const maxW = (tall ? 880 : W > H ? 1150 : 900) * unit;
  const weight = st === 'bold' ? 900 : 800;
  const { size, lines } = fitTitle(text.oneLine(title), { maxW, max: (st === 'bold' ? 92 : 74) * unit, min: 40 * unit, maxLines: 3, weight });
  const lineH = size * 1.1;
  const padX = 36 * unit;
  const padY = 24 * unit;
  const widths = lines.map((l) => media.textWidth(l, size, { weight, mode: 'ass' }));
  const bw = Math.max(...widths, 10) + padX * 2;
  const bh = lines.length * lineH + padY * 2;
  const x0 = (W - bw) / 2;
  const y0 = top != null ? Math.max(top, titleTop(W, H)) : titleTop(W, H);
  const fade = `\\fad(140,220)`;
  const anim = (x, y) => `\\move(${ff(x)},${ff(y + 28 * unit)},${ff(x)},${ff(y)},0,240)${fade}`;
  const events = [];
  const font = st === 'bold' ? 'Inter Black' : 'Inter ExtraBold';
  if (st !== 'bold') {
    const boxC = st === 'white' ? '#ffffff' : look.box;
    events.push(media.assEvent({ layer, start, end, style: 'Hook', text: `{\\an7${anim(x0, y0)}\\bord0\\shad${ff(6 * unit)}\\4c&H000000&\\4a&HA0&\\c${media.assTagColor(boxC)}\\p1}${media.assRoundRect(bw, bh, 26 * unit)}{\\p0}` }));
  }
  const ink = st === 'white' ? '#0b0b10' : st === 'bold' ? '#ffffff' : look.onBox;
  lines.forEach((l, i) => {
    const cy = y0 + padY + lineH * i + lineH / 2;
    const outline = st === 'bold' ? `\\bord${ff(8 * unit)}\\shad${ff(4 * unit)}\\3c${media.assTagColor(look.outline || '#0b0b10')}\\4c&H000000&\\4a&H70&` : '\\bord0\\shad0';
    events.push(media.assEvent({ layer: layer + 1, start, end, style: 'Hook', text: `{\\an5${anim(W / 2, cy)}\\fn${font}\\fs${ff(size)}${outline}\\c${media.assTagColor(ink)}}${media.assText(l)}` }));
  });
  let bottom = y0 + bh;
  if (line) {
    const ls = 46 * unit;
    const { size: s2, lines: l2 } = fitTitle(text.oneLine(line), { maxW: maxW * 0.95, max: ls, min: 30 * unit, maxLines: 2, weight: 700 });
    l2.forEach((l, i) => {
      const cy = bottom + 40 * unit + i * s2 * 1.2;
      events.push(media.assEvent({ layer: layer + 1, start: start + 0.25, end, style: 'Hook', text: `{\\an5\\pos(${ff(W / 2)},${ff(cy)})\\fnInter Bold\\fs${ff(s2)}\\bord${ff(5 * unit)}\\shad${ff(2 * unit)}\\3c&H0B0B10&\\4c&H000000&\\4a&H80&\\c&HFFFFFF&\\fad(160,220)}${media.assText(l)}` }));
    });
    bottom += 40 * unit + l2.length * s2 * 1.2;
  }
  return { styles: [media.assStyle({ name: 'Hook', font: 'Inter', size: 60 * unit, align: 5 })], events, bottom };
}

// AI labels (Legal row 8, V3): "AI-generated person" (an AI actor), "AI-generated video" (a real
// person made to move or speak, as in a talking clip) and "AI-generated voice", one line each, white
// on a 60% black box, top left inside the safe zone (clear of the captions, which sit lower), from
// start to end (the end card is left clean). Text at least 34 px on a 1080 wide frame.
const LABEL_TEXT = { person: 'AI-generated person', video: 'AI-generated video', voice: 'AI-generated voice' };

function labelLines(labels) {
  if (!labels || typeof labels !== 'object') return [];
  return ['person', 'video', 'voice'].filter((k) => labels[k] === true).map((k) => LABEL_TEXT[k]);
}

function labelTop(W, H) {
  return H / W > 1.6 ? H * 0.14 + 10 * (Math.min(W, H) / 1080) : H * 0.05;
}

function labelEvents({ W = 1080, H = 1920, labels, start = 0, end, layer = 30 }) {
  const lines = labelLines(labels);
  if (!lines.length || !(end > start)) return { styles: [], events: [], bottom: null };
  const unit = Math.min(W, H) / 1080;
  const size = Math.max(34, Math.round(36 * unit));
  const padX = 18 * unit;
  const bh = size * 1.5;
  const x = Math.round(W * 0.06);
  let y = labelTop(W, H);
  const events = [];
  for (const l of lines) {
    const bw = media.textWidth(l, size, { weight: 700, mode: 'ass' }) + padX * 2;
    events.push(media.assEvent({ layer, start, end, style: 'Lbl', text: `{\\an7\\pos(${ff(x)},${ff(y)})\\bord0\\shad0\\c&H000000&\\alpha&H66&\\p1}${media.assRoundRect(bw, bh, 10 * unit)}{\\p0}` }));
    events.push(media.assEvent({ layer: layer + 1, start, end, style: 'Lbl', text: `{\\an4\\pos(${ff(x + padX)},${ff(y + bh / 2)})\\fnInter Bold\\fs${size}\\bord0\\shad0\\c&HFFFFFF&}${media.assText(l)}` }));
    y += bh + 8 * unit;
  }
  return { styles: [media.assStyle({ name: 'Lbl', font: 'Inter Bold', size, align: 7 })], events, bottom: y, lines };
}

// A small SAMPLE pill at the top right, for renders of the sample clip.
function sampleTag({ W, H, end }) {
  const unit = Math.min(W, H) / 1080;
  const size = 26 * unit;
  const label = 'SAMPLE';
  const bw = media.textWidth(label, size, { weight: 800, mode: 'ass' }) + 52 * unit;
  const bh = 46 * unit;
  const x = W - bw - 40 * unit;
  const y = H / W > 1.6 ? 0.09 * H : 0.03 * H;
  return {
    styles: [media.assStyle({ name: 'Tag', font: 'Inter', size: 30 * unit, align: 5 })],
    events: [
      media.assEvent({ layer: 20, start: 0, end, style: 'Tag', text: `{\\an7\\pos(${ff(x)},${ff(y)})\\bord0\\shad0\\c&H000000&\\alpha&H60&\\p1}${media.assRoundRect(bw, bh, bh / 2)}{\\p0}` }),
      media.assEvent({ layer: 21, start: 0, end, style: 'Tag', text: `{\\an5\\pos(${ff(x + bw / 2)},${ff(y + bh / 2)})\\fnInter ExtraBold\\fs${ff(size)}\\fsp${ff(2 * unit)}\\bord0\\shad0\\c&HFFFFFF&}${label}` }),
    ],
  };
}

// Joins drawings ({ styles, events }) into one.
function join(...parts) {
  const ok = parts.filter(Boolean);
  return { styles: ok.flatMap((p) => p.styles || []), events: ok.flatMap((p) => p.events || []) };
}

module.exports = { LABEL_TEXT, labelLines, labelEvents, STYLES, HOOK_STYLES, captionsDoc, captionY, hookEvents, fitTitle, wrapAss, titleTop, sampleTag, join };
