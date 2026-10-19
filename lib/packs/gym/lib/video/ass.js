'use strict';
/*
 * ass.js: builds the ASS (Advanced SubStation Alpha) script that libass draws over a spec reel:
 * every word, panel, highlight box, glow and wipe. Pure functions, no dependencies.
 *
 * Coordinates are 1:1 with the 1080x1920 frame (PlayResX/PlayResY). Text is laid out here, not by
 * libass: every line (and for kinetic captions every word) is its own event with an explicit \pos,
 * so leading, word pops and highlight boxes are fully under our control. Widths come from
 * per-character advance tables measured from libass renders of the bundled fonts (no font-metrics
 * library at runtime); unknown characters fall back to each font's average glyph-width ratio.
 */

const W = 1080;
const H = 1920;
const FPS = 30;
// Instagram Reels safe zone: the top bar, the caption/buttons area at the bottom and the
// right-hand action buttons cover everything else.
const SAFE = Object.freeze({ x0: 90, x1: 930, y0: 250, y1: 1450, w: 840, h: 1200, cx: 510, cy: 850 });

// ---------------------------------------------------------------------------------------------
// Font metrics. Advance width of each character as a fraction of the ASS font size (\fs), x1000,
// for ASCII 32..126 plus common extras. Measured from libass 0.17 renders of the files in
// assets/fonts (note libass sizes fonts by ascender+descender, not by em, so ratios are per font).
// capTop / baseline: where the cap top and the baseline sit relative to an \an5 anchor (x fs).
// ---------------------------------------------------------------------------------------------
const METRICS = {
  anton: {
    ascii: [138,133,248,318,265,610,300,125,168,168,263,208,138,180,133,235,285,193,285,285,285,285,285,285,285,285,140,140,188,180,188,285,500,283,278,275,285,238,230,283,290,133,270,275,230,430,290,283,275,285,278,265,230,275,270,410,283,258,238,185,235,185,275,213,185,283,290,285,290,283,160,293,293,140,153,285,145,438,290,290,290,290,200,275,175,290,265,403,265,265,223,195,125,195,285],
    extra: {"·":138,"—":325,"–":180,"’":133,"‘":138,"“":270,"”":270,"…":410,"•":203,"×":200,"→":395,"é":283,"è":283,"ê":283,"ë":283,"á":283,"à":283,"â":283,"ä":283,"í":138,"ì":138,"î":138,"ï":138,"ó":290,"ò":290,"ô":290,"ö":290,"ú":290,"ù":290,"û":290,"ü":290,"ç":285,"ñ":290,"É":238,"È":238,"Á":283,"À":283,"Ó":283,"Ú":275,"Ñ":290,"Ç":275},
  },
  archivo: {
    ascii: [248,248,373,490,498,743,660,208,290,290,415,490,248,248,248,208,498,498,498,498,498,498,498,498,498,498,248,248,490,490,490,455,553,580,580,580,580,535,498,618,618,290,498,618,498,700,618,618,535,618,580,535,535,618,580,743,580,580,535,290,208,290,490,373,248,498,498,498,498,498,290,498,498,248,248,498,248,743,498,498,498,498,330,455,330,498,455,700,498,455,415,290,208,290,490],
    extra: {"·":248,"—":743,"–":373,"’":208,"‘":208,"“":373,"”":373,"…":743,"•":373,"×":490,"→":743,"é":498,"è":498,"ê":498,"ë":498,"á":498,"à":498,"â":498,"ä":498,"í":248,"ì":248,"î":248,"ï":248,"ó":498,"ò":498,"ô":498,"ö":498,"ú":498,"ù":498,"û":498,"ü":498,"ç":498,"ñ":498,"É":535,"È":535,"Á":580,"À":580,"Ó":618,"Ú":618,"Ñ":618,"Ç":580},
  },
  inter400: {
    ascii: [195,200,325,443,450,688,450,210,255,255,450,460,203,320,203,255,443,285,425,435,453,415,435,395,435,435,203,210,460,460,460,360,675,485,458,513,505,423,415,523,520,188,398,470,395,633,528,535,445,535,450,450,453,520,485,688,478,473,443,255,255,255,328,320,228,395,430,398,430,408,258,430,415,168,168,383,168,613,415,418,430,430,263,368,230,415,395,570,383,395,388,298,235,298,460],
    extra: {"·":203,"—":700,"–":353,"’":185,"‘":185,"“":310,"”":310,"…":605,"•":395,"×":460,"→":668,"é":408,"è":408,"ê":408,"ë":408,"á":395,"à":395,"â":395,"ä":395,"í":168,"ì":168,"î":168,"ï":168,"ó":418,"ò":418,"ô":418,"ö":418,"ú":415,"ù":415,"û":415,"ü":415,"ç":398,"ñ":415,"É":423,"È":423,"Á":485,"À":485,"Ó":535,"Ú":520,"Ñ":528,"Ç":513},
  },
  inter600: {
    ascii: [178,228,368,450,455,705,465,228,263,263,465,470,223,325,223,268,463,298,438,448,465,430,450,403,450,450,223,233,470,470,470,380,700,510,463,518,505,423,410,525,520,198,408,493,395,645,533,540,450,540,458,455,463,518,510,715,505,500,458,263,268,263,338,330,248,403,438,408,438,415,275,438,430,185,185,400,185,630,430,428,438,438,278,385,248,430,410,588,400,410,395,318,250,318,470],
    extra: {"·":223,"—":700,"–":353,"’":208,"‘":208,"“":358,"”":353,"…":670,"•":353,"×":470,"→":670,"é":415,"è":415,"ê":415,"ë":415,"á":403,"à":403,"â":403,"ä":403,"í":185,"ì":185,"î":185,"ï":185,"ó":428,"ò":428,"ô":428,"ö":428,"ú":430,"ù":430,"û":430,"ü":430,"ç":408,"ñ":430,"É":423,"È":423,"Á":510,"À":510,"Ó":540,"Ú":518,"Ñ":533,"Ç":518},
  },
  inter700: {
    ascii: [165,235,388,455,458,713,470,240,263,263,473,473,235,330,235,270,473,303,443,455,473,435,455,408,458,455,235,240,473,473,473,393,713,525,463,518,505,428,410,525,525,195,410,505,395,653,533,540,455,545,463,458,465,513,525,728,518,513,465,263,270,263,340,333,255,408,443,410,443,420,278,443,435,193,193,408,193,638,435,430,443,443,285,393,258,435,420,595,408,423,403,330,263,330,473],
    extra: {"·":235,"—":700,"–":353,"’":220,"‘":220,"“":380,"”":373,"…":700,"•":333,"×":473,"→":670,"é":420,"è":420,"ê":420,"ë":420,"á":408,"à":408,"â":408,"ä":408,"í":193,"ì":193,"î":193,"ï":193,"ó":430,"ò":430,"ô":430,"ö":430,"ú":435,"ù":435,"û":435,"ü":435,"ç":410,"ñ":435,"É":428,"È":428,"Á":525,"À":525,"Ó":540,"Ú":513,"Ñ":533,"Ç":518},
  },
  inter800: {
    ascii: [153,250,410,458,463,720,478,248,268,268,483,483,248,330,248,283,485,310,445,463,483,443,463,410,465,463,248,250,483,483,483,408,723,540,465,520,505,428,410,528,525,200,415,518,395,660,535,540,458,548,465,463,473,507,540,740,533,528,473,268,283,268,345,340,268,410,445,420,445,423,285,445,445,200,200,415,200,650,445,435,445,445,295,403,268,445,430,603,415,435,408,340,270,340,483],
    extra: {"·":248,"—":700,"–":353,"’":233,"‘":233,"“":408,"”":400,"…":740,"•":305,"×":483,"→":670,"é":423,"è":423,"ê":423,"ë":423,"á":410,"à":410,"â":410,"ä":410,"í":200,"ì":200,"î":200,"ï":200,"ó":435,"ò":435,"ô":435,"ö":435,"ú":445,"ù":445,"û":445,"ü":445,"ç":420,"ñ":445,"É":428,"È":428,"Á":540,"À":540,"Ó":540,"Ú":507,"Ñ":535,"Ç":520},
  },
};

function makeFont(key, family, bold, capTop, baseline, metrics) {
  const caps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (const c of caps) sum += metrics.ascii[c.charCodeAt(0) - 32];
  return Object.freeze({
    key,
    family,
    bold, // value for \b (0 = the face's own weight, 600..900 = a named instance of the variable font)
    capTop,
    baseline,
    capHeight: baseline - capTop,
    capCenter: (capTop + baseline) / 2,
    avg: sum / caps.length / 1000, // average glyph-width ratio, used for characters not in the table
    metrics,
  });
}

const FONTS = Object.freeze({
  anton: makeFont('anton', 'Anton', 0, -0.185, 0.3075, METRICS.anton),
  archivo: makeFont('archivo', 'Archivo Black', 0, -0.2425, 0.2675, METRICS.archivo),
  inter: makeFont('inter', 'Inter', 0, -0.235, 0.2725, METRICS.inter400),
  inter600: makeFont('inter600', 'Inter', 600, -0.245, 0.2725, METRICS.inter600),
  inter700: makeFont('inter700', 'Inter', 700, -0.245, 0.2725, METRICS.inter700),
  inter800: makeFont('inter800', 'Inter', 800, -0.245, 0.2725, METRICS.inter800),
});

function font(f) {
  if (f && typeof f === 'object' && f.metrics) return f;
  return FONTS[f] || FONTS.inter;
}

const COMBINING = /[̀-ͯ]/;

function charWidth(f, ch) {
  const fo = font(f);
  const code = ch.codePointAt(0);
  if (code >= 32 && code <= 126) return fo.metrics.ascii[code - 32] / 1000;
  if (fo.metrics.extra[ch] != null) return fo.metrics.extra[ch] / 1000;
  if (COMBINING.test(ch)) return 0;
  if (code === 0x2060 || code === 0x200b) return 0;
  return fo.avg;
}

/** Width in pixels of `text` set in font `f` at ASS size `size`, with \fsp `spacing` px. */
function textWidth(text, f, size, spacing = 0) {
  let w = 0;
  let n = 0;
  for (const ch of String(text)) {
    w += charWidth(f, ch);
    n += 1;
  }
  return w * size + spacing * n;
}

// ---------------------------------------------------------------------------------------------
// Text cleanup and escaping
// ---------------------------------------------------------------------------------------------

// Characters the bundled fonts can draw (Latin, Latin-1, Latin Extended-A, common punctuation).
const ALLOWED = /[ -~ -ſ‐-‧‰-›€™←-↓×]/u;

/**
 * Normalizes user text for drawing: NFC, collapses whitespace and newlines, swaps exotic spaces,
 * removes characters the bundled fonts cannot draw (emoji, symbols, other scripts).
 * Returns { text, removed } where removed lists the dropped characters.
 */
function cleanText(input) {
  if (input == null) return { text: '', removed: [] };
  let s = String(input).normalize('NFC');
  s = s.replace(/[  -   　\t\r\n\f\v]+/g, ' ');
  s = s.replace(/[​-‍⁠﻿️︎]/g, '');
  const removed = [];
  let out = '';
  for (const ch of s) {
    if (ALLOWED.test(ch) || COMBINING.test(ch)) out += ch;
    else removed.push(ch);
  }
  out = out.replace(/\s+/g, ' ').trim();
  return { text: out, removed };
}

/**
 * Escapes user text so libass draws it literally: a backslash gets a word joiner after it (so
 * \N, \h, \n never become line breaks or hard spaces), and braces become \{ and \} (literal braces
 * in libass) so user text can never open an override block. Newlines become spaces.
 */
function escapeText(input) {
  return String(input == null ? '' : input)
    .replace(/\\/g, '\\⁠')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r\n|\r|\n/g, ' ');
}

function upper(s) {
  return String(s).toLocaleUpperCase('en-US');
}

// ---------------------------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------------------------

function parseHex(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{8}$/i.test(s)) s = s.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function rgb(c) {
  if (c && typeof c === 'object' && 'r' in c) return c;
  return parseHex(c) || { r: 255, g: 255, b: 255 };
}

const h2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

function toHex(c) {
  const { r, g, b } = rgb(c);
  return `#${h2(r)}${h2(g)}${h2(b)}`.toUpperCase();
}

/** ASS color: &HBBGGRR& */
function assColor(c) {
  const { r, g, b } = rgb(c);
  return `&H${h2(b)}${h2(g)}${h2(r)}&`.toUpperCase();
}

/** ASS alpha from an opacity 0..1 (ASS alpha is transparency: 00 opaque, FF invisible). */
function assAlpha(opacity) {
  const o = Math.max(0, Math.min(1, opacity));
  return `&H${h2(255 - o * 255)}&`.toUpperCase();
}

/** ffmpeg color literal 0xRRGGBB */
function ffColor(c) {
  return `0x${toHex(c).slice(1)}`;
}

function lin(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance 0..1 */
function luminance(c) {
  const { r, g, b } = rgb(c);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK = '#0B0B0C';
const PAPER = '#FFFFFF';

/** Black or white, whichever reads better on `bg`. */
function textOn(bg) {
  return contrast(bg, INK) >= contrast(bg, PAPER) ? INK : PAPER;
}

function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

function rgbToHsl(c) {
  const { r, g, b } = rgb(c);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const f = (p, q, t) => {
    let u = t;
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  if (s === 0) return toHex({ r: l * 255, g: l * 255, b: l * 255 });
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex({ r: f(p, q, h + 1 / 3) * 255, g: f(p, q, h) * 255, b: f(p, q, h - 1 / 3) * 255 });
}

/** Same hue, new lightness (0..1) and optionally scaled saturation. */
function withLightness(c, l, satScale = 1) {
  const hsl = rgbToHsl(c);
  return hslToHex({ h: hsl.h, s: Math.min(1, hsl.s * satScale), l });
}

// ---------------------------------------------------------------------------------------------
// Time and easing
// ---------------------------------------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * ASS timestamp (H:MM:SS.cc). Floors to the centisecond so an event that starts on a frame time
 * n/30 is shown on frame n (libass is asked for floor(n*1000/30) ms) and not on frame n-1.
 */
function ts(sec) {
  let cs = Math.floor(Math.max(0, sec) * 100 + 1e-6);
  const h = Math.floor(cs / 360000);
  cs -= h * 360000;
  const m = Math.floor(cs / 6000);
  cs -= m * 6000;
  const s = Math.floor(cs / 100);
  cs -= s * 100;
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = {
  linear: (t) => clamp01(t),
  outCubic: (t) => 1 - Math.pow(1 - clamp01(t), 3),
  outQuart: (t) => 1 - Math.pow(1 - clamp01(t), 4),
  outQuint: (t) => 1 - Math.pow(1 - clamp01(t), 5),
  outExpo: (t) => (clamp01(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t))),
  inQuad: (t) => Math.pow(clamp01(t), 2),
  inCubic: (t) => Math.pow(clamp01(t), 3),
  inOutCubic: (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  outBack: (t, k = 1.6) => {
    const x = clamp01(t) - 1;
    return 1 + (k + 1) * x * x * x + k * x * x;
  },
};

/** Snap a time to the frame grid. */
function snap(t) {
  return Math.round(t * FPS) / FPS;
}

// ---------------------------------------------------------------------------------------------
// Override tags
// ---------------------------------------------------------------------------------------------

function num(v) {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

/**
 * Builds an override block from an options object. Keys:
 * an, pos:[x,y], move:[x1,y1,x2,y2,t1,t2], org:[x,y], font, size, color, opacity, bord, bordColor,
 * bordOpacity, shad, shadColor, shadOpacity, blur, be, fsp, sx, sy, rz, clip:[x0,y0,x1,y1] or
 * drawing string, iclip, fad:[in,out], p (drawing scale), raw (appended verbatim).
 */
function tags(o = {}) {
  let s = '';
  if (o.an) s += `\\an${o.an}`;
  if (o.pos) s += `\\pos(${num(o.pos[0])},${num(o.pos[1])})`;
  if (o.move) s += `\\move(${o.move.map(num).join(',')})`;
  if (o.org) s += `\\org(${num(o.org[0])},${num(o.org[1])})`;
  if (o.font) {
    const f = font(o.font);
    s += `\\fn${f.family}\\b${f.bold}`;
  }
  if (o.size != null) s += `\\fs${num(o.size)}`;
  if (o.fsp != null) s += `\\fsp${num(o.fsp)}`;
  if (o.sx != null) s += `\\fscx${num(o.sx)}`;
  if (o.sy != null) s += `\\fscy${num(o.sy)}`;
  if (o.rz != null) s += `\\frz${num(o.rz)}`;
  if (o.color) s += `\\1c${assColor(o.color)}`;
  if (o.bordColor) s += `\\3c${assColor(o.bordColor)}`;
  if (o.shadColor) s += `\\4c${assColor(o.shadColor)}`;
  if (o.opacity != null) s += `\\1a${assAlpha(o.opacity)}`;
  if (o.bordOpacity != null) s += `\\3a${assAlpha(o.bordOpacity)}`;
  if (o.shadOpacity != null) s += `\\4a${assAlpha(o.shadOpacity)}`;
  s += `\\bord${num(o.bord || 0)}\\shad${num(o.shad || 0)}`;
  if (o.xshad != null) s += `\\xshad${num(o.xshad)}`;
  if (o.yshad != null) s += `\\yshad${num(o.yshad)}`;
  if (o.blur) s += `\\blur${num(o.blur)}`;
  if (o.be) s += `\\be${num(o.be)}`;
  if (o.clip) s += Array.isArray(o.clip) ? `\\clip(${o.clip.map((v) => Math.round(v)).join(',')})` : `\\clip(${o.clip})`;
  if (o.iclip) s += Array.isArray(o.iclip) ? `\\iclip(${o.iclip.map((v) => Math.round(v)).join(',')})` : `\\iclip(${o.iclip})`;
  if (o.fad) s += `\\fad(${Math.round(o.fad[0])},${Math.round(o.fad[1])})`;
  if (o.raw) s += o.raw;
  if (o.p) s += `\\p${o.p}`;
  return `{${s}}`;
}

/** \t() animation. t1/t2 in ms relative to the event start; accel < 1 eases out. */
function anim(t1, t2, inner, accel) {
  const a = accel == null || accel === 1 ? '' : `${num(accel)},`;
  return `\\t(${Math.round(t1)},${Math.round(t2)},${a}${inner})`;
}

// ---------------------------------------------------------------------------------------------
// Shapes (ASS \p1 drawings; local coordinates start at 0,0)
// ---------------------------------------------------------------------------------------------

const R = (v) => Math.round(v * 10) / 10;
const K = 0.5523;

function rectPath(w, h) {
  return `m 0 0 l ${R(w)} 0 l ${R(w)} ${R(h)} l 0 ${R(h)}`;
}

function roundRectPath(w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr < 0.5) return rectPath(w, h);
  const k = rr * K;
  return [
    `m ${R(rr)} 0`,
    `l ${R(w - rr)} 0`,
    `b ${R(w - rr + k)} 0 ${R(w)} ${R(rr - k)} ${R(w)} ${R(rr)}`,
    `l ${R(w)} ${R(h - rr)}`,
    `b ${R(w)} ${R(h - rr + k)} ${R(w - rr + k)} ${R(h)} ${R(w - rr)} ${R(h)}`,
    `l ${R(rr)} ${R(h)}`,
    `b ${R(rr - k)} ${R(h)} 0 ${R(h - rr + k)} 0 ${R(h - rr)}`,
    `l 0 ${R(rr)}`,
    `b 0 ${R(rr - k)} ${R(rr - k)} 0 ${R(rr)} 0`,
  ].join(' ');
}

/** Circle of radius r with its bounding box at 0,0 .. 2r,2r (offset by ox, oy). */
function circlePath(r, ox = 0, oy = 0, reverse = false) {
  const k = r * K;
  const cx = ox + r;
  const cy = oy + r;
  if (!reverse) {
    return [
      `m ${R(cx)} ${R(cy - r)}`,
      `b ${R(cx + k)} ${R(cy - r)} ${R(cx + r)} ${R(cy - k)} ${R(cx + r)} ${R(cy)}`,
      `b ${R(cx + r)} ${R(cy + k)} ${R(cx + k)} ${R(cy + r)} ${R(cx)} ${R(cy + r)}`,
      `b ${R(cx - k)} ${R(cy + r)} ${R(cx - r)} ${R(cy + k)} ${R(cx - r)} ${R(cy)}`,
      `b ${R(cx - r)} ${R(cy - k)} ${R(cx - k)} ${R(cy - r)} ${R(cx)} ${R(cy - r)}`,
    ].join(' ');
  }
  return [
    `m ${R(cx)} ${R(cy - r)}`,
    `b ${R(cx - k)} ${R(cy - r)} ${R(cx - r)} ${R(cy - k)} ${R(cx - r)} ${R(cy)}`,
    `b ${R(cx - r)} ${R(cy + k)} ${R(cx - k)} ${R(cy + r)} ${R(cx)} ${R(cy + r)}`,
    `b ${R(cx + k)} ${R(cy + r)} ${R(cx + r)} ${R(cy + k)} ${R(cx + r)} ${R(cy)}`,
    `b ${R(cx + r)} ${R(cy - k)} ${R(cx + k)} ${R(cy - r)} ${R(cx)} ${R(cy - r)}`,
  ].join(' ');
}

/** Ring (outer radius r, stroke thickness t), bounding box 0,0 .. 2r,2r. */
function ringPath(r, t) {
  return `${circlePath(r)} ${circlePath(r - t, t, t, true)}`;
}

/** Slanted panel: a parallelogram w wide and h tall whose top edge is shifted right by skew. */
function slantPath(w, h, skew) {
  const s = Math.abs(skew);
  return skew >= 0
    ? `m ${R(s)} 0 l ${R(w + s)} 0 l ${R(w)} ${R(h)} l 0 ${R(h)}`
    : `m 0 0 l ${R(w)} 0 l ${R(w + s)} ${R(h)} l ${R(s)} ${R(h)}`;
}

function polyPath(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `m ${R(first[0])} ${R(first[1])} ${rest.map((p) => `l ${R(p[0])} ${R(p[1])}`).join(' ')}`;
}

// ---------------------------------------------------------------------------------------------
// Layout: wrap + auto-size from character widths
// ---------------------------------------------------------------------------------------------

const WEAK_END = new Set(['A', 'AN', 'THE', 'OF', 'TO', 'IN', 'ON', 'AT', 'FOR', 'AND', 'OR', '&', 'WITH', 'YOUR', 'OUR', 'MY', 'BY', 'FROM']);

function partitions(n, k) {
  // all ways to cut n words into k non-empty consecutive lines; returns arrays of cut indices
  const out = [];
  const cuts = [];
  (function rec(start, left) {
    if (left === 1) {
      out.push(cuts.slice());
      return;
    }
    for (let i = start + 1; i <= n - left + 1; i += 1) {
      cuts.push(i);
      rec(i, left - 1);
      cuts.pop();
      if (out.length > 4000) return;
    }
  })(0, k);
  return out;
}

function bestBreaks(words, widths, gaps, maxWidth, maxLines) {
  const n = words.length;
  const lineW = (a, b) => {
    let w = 0;
    for (let i = a; i < b; i += 1) w += widths[i] + (i > a ? gaps[i] : 0);
    return w;
  };
  for (let k = 1; k <= Math.min(maxLines, n); k += 1) {
    let best = null;
    for (const cuts of partitions(n, k)) {
      const bounds = [0, ...cuts, n];
      const lines = [];
      let ok = true;
      for (let i = 0; i < k; i += 1) {
        const w = lineW(bounds[i], bounds[i + 1]);
        if (w > maxWidth + 0.5) {
          ok = false;
          break;
        }
        lines.push({ a: bounds[i], b: bounds[i + 1], w });
      }
      if (!ok) continue;
      const max = Math.max(...lines.map((l) => l.w));
      const min = Math.min(...lines.map((l) => l.w));
      let cost = max + 0.2 * (max - min);
      for (let i = 0; i < k - 1; i += 1) {
        if (WEAK_END.has(upper(words[lines[i].b - 1]).replace(/[^A-Z&]/g, ''))) cost += maxWidth * 0.12;
      }
      if (k > 1 && lines[k - 1].b - lines[k - 1].a === 1 && n > 3 && lines[k - 1].w < max * 0.35) cost += maxWidth * 0.1;
      if (!best || cost < best.cost) best = { cost, lines };
    }
    if (best) return best.lines;
  }
  return null;
}

/**
 * Wraps and auto-sizes text into at most `maxLines` lines that fit `maxWidth`, shrinking from
 * maxSize toward minSize. Words in `pad` (a Map word index -> extra px each side) reserve room for
 * highlight boxes. If nothing fits at minSize, long words are squeezed horizontally (\fscx) down
 * to 72% and, failing that, hard-broken.
 * Returns { size, sx, font, lines:[{ words:[{ text, w, x0, x1, cx, i }], w, x0 }], capH, pitch, height }.
 */
function layoutText(text, opts) {
  const f = font(opts.font);
  const maxWidth = opts.maxWidth || SAFE.w;
  const maxLines = opts.maxLines || 3;
  const maxSize = opts.maxSize || 200;
  const minSize = Math.min(opts.minSize || 40, maxSize);
  const maxHeight = opts.maxHeight || Infinity;
  const leading = opts.leading || 1.18; // line pitch as a multiple of cap height
  const spacingRatio = opts.spacing || 0; // \fsp as a fraction of size
  const pad = opts.pad || new Map();
  const wordGap = opts.wordGap == null ? 1 : opts.wordGap; // scale on the space width
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const tryAt = (size, sx = 1) => {
    const sp = spacingRatio * size;
    const widths = words.map((w, i) => (textWidth(w, f, size, sp) - sp) * sx + 2 * (pad.get(i) || 0));
    const space = textWidth(' ', f, size, sp) * sx * wordGap;
    const gaps = words.map(() => space);
    const lines = bestBreaks(words, widths, gaps, maxWidth, maxLines);
    if (!lines) return null;
    const capH = f.capHeight * size;
    const pitch = capH * leading;
    const height = capH + pitch * (lines.length - 1);
    if (height > maxHeight + 0.5) return null;
    return { size, sx, sp, widths, space, lines, capH, pitch, height };
  };

  let found = null;
  for (let size = maxSize; size >= minSize - 0.01; size *= 0.97) {
    found = tryAt(Math.round(size * 10) / 10);
    if (found) break;
  }
  if (!found) {
    for (let sx = 0.96; sx >= 0.72 && !found; sx -= 0.04) found = tryAt(minSize, sx);
  }
  let wordsUsed = words;
  if (!found) {
    // Last resort: hard-break words that cannot fit even squeezed.
    const size = minSize;
    const sp = spacingRatio * size;
    const broken = [];
    for (const w of words) {
      let cur = '';
      for (const ch of w) {
        if (cur && (textWidth(cur + ch, f, size, sp) - sp) * 0.72 > maxWidth - 10) {
          broken.push(`${cur}-`);
          cur = ch;
        } else cur += ch;
      }
      if (cur) broken.push(cur);
    }
    wordsUsed = broken;
    const sx = 0.72;
    const widths = broken.map((w) => (textWidth(w, f, size, sp) - sp) * sx);
    const space = textWidth(' ', f, size, sp) * sx * wordGap;
    const lines = [];
    let cur = null;
    broken.forEach((w, i) => {
      if (cur && cur.w + space + widths[i] <= maxWidth) {
        cur.b = i + 1;
        cur.w += space + widths[i];
      } else {
        cur = { a: i, b: i + 1, w: widths[i] };
        lines.push(cur);
      }
    });
    const capH = f.capHeight * size;
    found = { size, sx, sp, widths, space, lines, capH, pitch: capH * (opts.leading || 1.18), height: capH + capH * (opts.leading || 1.18) * (lines.length - 1), overflow: true };
  }

  const cx = opts.cx == null ? SAFE.cx : opts.cx;
  const align = opts.align || 'center';
  const lines = found.lines.map((ln) => {
    const x0 = align === 'left' ? opts.x0 == null ? SAFE.x0 : opts.x0 : align === 'right' ? (opts.x1 == null ? SAFE.x1 : opts.x1) - ln.w : cx - ln.w / 2;
    let x = x0;
    const ws = [];
    for (let i = ln.a; i < ln.b; i += 1) {
      const p = pad.get(i) || 0;
      const inner = found.widths[i] - 2 * p;
      ws.push({ text: wordsUsed[i], i, w: inner, x0: x + p, x1: x + p + inner, cx: x + p + inner / 2 });
      x += found.widths[i] + found.space;
    }
    return { words: ws, w: ln.w, x0, x1: x0 + ln.w, text: ws.map((w) => w.text).join(' ') };
  });
  return {
    font: f,
    size: found.size,
    sx: found.sx,
    sp: found.sp,
    lines,
    capH: found.capH,
    pitch: found.pitch,
    height: found.height,
    overflow: !!found.overflow,
    words: wordsUsed,
  };
}

/**
 * Places a layout vertically. `y` is the visual center of the block (cap tops to last baseline),
 * or use top/bottom. Adds per-line `capTop`, `baseline`, `cy` (cap center) and `posY` (the \an5 y).
 */
function placeBlock(layout, { y, top, bottom }) {
  const h = layout.height;
  let y0;
  if (top != null) y0 = top;
  else if (bottom != null) y0 = bottom - h;
  else y0 = (y == null ? SAFE.cy : y) - h / 2;
  const f = layout.font;
  layout.lines.forEach((ln, i) => {
    ln.capTop = y0 + i * layout.pitch;
    ln.baseline = ln.capTop + layout.capH;
    ln.cy = ln.capTop + layout.capH / 2;
    ln.posY = ln.cy - f.capCenter * layout.size;
  });
  layout.top = y0;
  layout.bottom = y0 + h;
  layout.x0 = Math.min(...layout.lines.map((l) => l.x0));
  layout.x1 = Math.max(...layout.lines.map((l) => l.x1));
  return layout;
}

// ---------------------------------------------------------------------------------------------
// Script builder
// ---------------------------------------------------------------------------------------------

class AssDoc {
  constructor({ title = 'spec reel' } = {}) {
    this.title = title;
    this.events = [];
  }

  /** Adds a Dialogue line. Times in seconds. */
  add(layer, start, end, text) {
    if (!(end > start) || end - start < 0.5 / FPS) return this;
    this.events.push({ layer: Math.max(0, Math.round(layer)), start, end, text });
    return this;
  }

  /** Text event: o = tags() options, s = raw user text (escaped here). */
  text(layer, start, end, o, s, animTags = '') {
    const t = tags(o);
    return this.add(layer, start, end, `${t.slice(0, -1)}${animTags}}${escapeText(s)}`);
  }

  /** Drawing event: o = tags() options (p defaults to 1), path = drawing commands. */
  shape(layer, start, end, o, path, animTags = '') {
    const t = tags(Object.assign({ an: 7, p: undefined }, o));
    return this.add(layer, start, end, `${t.slice(0, -1)}${animTags}\\p1}${path}{\\p0}`);
  }

  /**
   * Per-frame events for eased motion libass cannot do with \move (which is linear). fn(e, n)
   * gets the eased progress 0..1 and frame index and returns { o, path?, text?, anim? }.
   */
  bake(layer, t0, t1, easing, fn) {
    const f0 = Math.round(t0 * FPS);
    const f1 = Math.max(f0 + 1, Math.round(t1 * FPS));
    for (let n = f0; n < f1; n += 1) {
      const p = f1 - f0 <= 1 ? 1 : (n - f0) / (f1 - f0 - 1);
      const e = (easing || ease.outCubic)(p);
      const r = fn(e, n, p);
      if (!r) continue;
      const s = n / FPS;
      const en = (n + 1) / FPS;
      if (r.path != null) this.shape(r.layer == null ? layer : r.layer, s, en, r.o, r.path, r.anim || '');
      else if (r.text != null) this.text(r.layer == null ? layer : r.layer, s, en, r.o, r.text, r.anim || '');
    }
    return this;
  }

  toString() {
    const head = [
      '[Script Info]',
      `Title: ${this.title.replace(/[\r\n]/g, ' ')}`,
      'ScriptType: v4.00+',
      `PlayResX: ${W}`,
      `PlayResY: ${H}`,
      'WrapStyle: 2',
      'ScaledBorderAndShadow: yes',
      'Kerning: yes',
      'YCbCr Matrix: None',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Base,Inter,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ];
    const ev = this.events
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.layer - b.e.layer || a.i - b.i)
      .map(({ e }) => `Dialogue: ${e.layer},${ts(e.start)},${ts(e.end)},Base,,0,0,0,,${e.text}`);
    return `${head.concat(ev).join('\n')}\n`;
  }
}

// ---------------------------------------------------------------------------------------------
// Kinetic building blocks
// ---------------------------------------------------------------------------------------------

/**
 * Fade + scale entrance tags (relative ms). kind: pop | slam | soft | none.
 * sx/sy: the element's resting \fscx/\fscy in percent (default 100).
 */
function entrance(kind, { dur = 220, alphaTo = 1, bordTo, shadTo, sx = 100, sy = 100 } = {}) {
  const fadeIn = (ms) => {
    let inner = `\\1a${assAlpha(alphaTo)}`;
    if (bordTo != null) inner += `\\3a${assAlpha(bordTo)}`;
    if (shadTo != null) inner += `\\4a${assAlpha(shadTo)}`;
    return `\\1a&HFF&\\3a&HFF&\\4a&HFF&${anim(0, ms, inner)}`;
  };
  const sc = (k) => `\\fscx${num(sx * k)}\\fscy${num(sy * k)}`;
  if (kind === 'none') return '';
  if (kind === 'slam') {
    const a = Math.round(dur * 0.55);
    return `${sc(1.65)}${fadeIn(Math.round(dur * 0.35))}${anim(0, a, sc(0.94), 0.45)}${anim(a, dur, sc(1), 1.4)}`;
  }
  if (kind === 'soft') {
    return `${sc(0.92)}${fadeIn(Math.round(dur * 0.8))}${anim(0, dur, sc(1), 0.5)}`;
  }
  if (kind === 'hit') {
    // lands on a cut: fully visible on its first frame, oversized, settles fast
    return `${sc(1.18)}${anim(0, dur, sc(1), 0.45)}`;
  }
  // pop: small -> overshoot -> settle
  const a = Math.round(dur * 0.6);
  return `${sc(0.45)}${fadeIn(Math.round(dur * 0.35))}${anim(0, a, sc(1.1), 0.5)}${anim(a, dur, sc(1), 1.3)}`;
}

/** Exit tags (relative ms, measured from the event start): quick shrink + fade at the end. */
function exitTags(totalMs, kind = 'fade', ms = 140) {
  if (kind === 'none' || totalMs <= ms + 10) return '';
  const t1 = Math.max(0, totalMs - ms);
  if (kind === 'drop') return anim(t1, totalMs, '\\fscx88\\fscy88\\alpha&HFF&', 1.6);
  if (kind === 'up') return anim(t1, totalMs, '\\fscx104\\fscy104\\alpha&HFF&', 1.4);
  return anim(t1, totalMs, '\\alpha&HFF&', 1.2);
}

module.exports = {
  W,
  H,
  FPS,
  SAFE,
  FONTS,
  font,
  charWidth,
  textWidth,
  cleanText,
  escapeText,
  upper,
  parseHex,
  toHex,
  assColor,
  assAlpha,
  ffColor,
  luminance,
  contrast,
  textOn,
  mix,
  withLightness,
  rgbToHsl,
  INK,
  PAPER,
  ts,
  ease,
  snap,
  num,
  tags,
  anim,
  rectPath,
  roundRectPath,
  circlePath,
  ringPath,
  slantPath,
  polyPath,
  layoutText,
  placeBlock,
  AssDoc,
  entrance,
  exitTags,
};
