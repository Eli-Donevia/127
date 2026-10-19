'use strict';
/*
 * render.js: renders a 15-second 1080x1920 "spec reel" (a sample Reel made for one gym) with
 * nothing but ffmpeg (libass, librsvg, libx264) and the bundled fonts. No npm packages.
 *
 *   const { renderSpecReel, buildPlan, TEMPLATES } = require('./render');
 *   const res = await renderSpecReel(props, { outPath: '/tmp/reel.mp4' });
 *   // -> { video, poster, durationSec, template, warnings }
 *
 * One ffmpeg run does everything: footage shots (center-cropped to 9:16, punch-in zoom, grade) or a
 * generated brand gradient are concatenated into a base layer, the logo is overlaid on the end card,
 * libass draws all type, panels and wipes from an ASS script built in ass.js, grain is added and the
 * result is encoded to H.264 + AAC. A second tiny run grabs the poster frame.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const A = require('./ass');

const { W, H, FPS, SAFE } = A;
const DURATION = 15;
const FRAMES = DURATION * FPS;
const BEAT = 0.5; // 120 BPM: cuts land on beats, words on 8ths
const PUSH = Object.freeze({ type: 'slideup', dur: 0.24 }); // the one footage transition in the offer reel
const OFFER_COVER = 0.3; // the offer's brand sweeps cover the frame this long after they start
const FONTS_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');

const TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'offer',
    title: 'Offer reel',
    description: 'Hook over their footage, three punchy lines, a brand-color offer card, then the end card.',
    needs: 'clips-or-photos',
    durationSec: DURATION,
  }),
  Object.freeze({
    id: 'class',
    title: 'Inside a class',
    description: '"What a class at <gym> looks like": one shot per block of the class with a label, the class time only when one is given, and a progress bar.',
    needs: 'clips-or-photos',
    durationSec: DURATION,
  }),
  Object.freeze({
    id: 'hype',
    title: 'Hype (no footage)',
    description: 'Kinetic type on an animated brand gradient: city, hook, lines, offer, end card. Needs no footage.',
    needs: 'none',
    durationSec: DURATION,
  }),
]);
const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
const CATEGORIES = ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts', 'climbing', 'cycling', 'dance', 'other'];

const DEFAULT_COLORS = { primary: '#F2F2EE', accent: '#111113' };
const DEFAULT_LINES = {
  gym: ['Show up as you are', 'Train with people who show up', 'Start this week'],
  crossfit: ['Every workout scales to you', 'Cheered on to the last rep', 'Start this week'],
  yoga: ['Breathe out the week', 'Every body, every level', 'Roll out the mat'],
  pilates: ['Slow, controlled, strong', 'Every body, every level', 'Start this week'],
  boxing: ['Wrap up', 'Learn the combo', 'Leave it on the bag'],
  martial_arts: ['Day one is a white belt', 'Learn from the ground up', 'Bow in'],
  climbing: ['Shoes on, chalk up', 'One more move', 'Top out'],
  cycling: ['Lights down', 'Music up', 'Ride it out'],
  dance: ['Learn it slow', 'Then full speed', 'Then own it'],
  other: ['Show up as you are', 'Find your people', 'Start this week'],
};
// Labels only: a made-up class time would be a claim about the gym, so times show only when given.
const DEFAULT_SCHEDULE = {
  yoga: [{ label: 'Arrive' }, { label: 'Breathe' }, { label: 'Flow' }, { label: 'Rest' }],
  pilates: [{ label: 'Warm-up' }, { label: 'Reformer' }, { label: 'Core' }, { label: 'Stretch' }],
  cycling: [{ label: 'Clip in' }, { label: 'Climb' }, { label: 'Sprint' }, { label: 'Cool down' }],
  default: [{ label: 'Warm-up' }, { label: 'Strength' }, { label: 'Conditioning' }, { label: 'Cool-down' }],
};

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|mpg|mpeg|3gp|ts|mts)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|bmp|tiff?|gif|avif|heic)$/i;
const LOGO_EXT = /\.(png|jpe?g|webp|svg)$/i;

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

function clipText(s, max, warnings, label) {
  const { text, removed } = A.cleanText(s);
  if (removed.length && warnings) warnings.push(`${label}: removed characters the fonts can't draw (${[...new Set(removed)].join(' ')}).`);
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  if (warnings) warnings.push(`${label} was longer than ${max} characters and was shortened.`);
  return `${cut.replace(/[\s,.;:–—-]+$/, '')}…`;
}

function shortSite(s) {
  if (typeof s !== 'string') return '';
  return s
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

function asPathList(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim());
}

/** Validates and defaults every field. Never throws. Returns { props, warnings }. */
function normalizeProps(input) {
  const warnings = [];
  const p = input && typeof input === 'object' ? input : {};
  if (!input || typeof input !== 'object') warnings.push('No props given; rendered with defaults.');

  let template = typeof p.template === 'string' ? p.template.trim().toLowerCase() : '';
  if (!TEMPLATE_IDS.includes(template)) {
    if (template) warnings.push(`Unknown template "${p.template}"; used "offer".`);
    template = 'offer';
  }

  const g = p.gym && typeof p.gym === 'object' ? p.gym : {};
  let name = clipText(g.name, 60, warnings, 'Gym name');
  if (!name) {
    name = 'Your Gym';
    warnings.push('No gym name given; used "Your Gym".');
  }
  const city = clipText(g.city, 40, warnings, 'City');
  const site = clipText(shortSite(g.site), 48, warnings, 'Site');
  const category = CATEGORIES.includes(g.category) ? g.category : 'gym';
  const colors = g.colors && typeof g.colors === 'object' ? g.colors : {};
  let primary = A.parseHex(colors.primary);
  let accent = A.parseHex(colors.accent);
  if (colors.primary != null && !primary) warnings.push(`Brand color "${colors.primary}" isn't a hex color; used a default.`);
  if (colors.accent != null && !accent) warnings.push(`Accent color "${colors.accent}" isn't a hex color; used a default.`);
  primary = A.toHex(primary || DEFAULT_COLORS.primary);
  accent = A.toHex(accent || DEFAULT_COLORS.accent);
  const logo = typeof g.logo === 'string' && g.logo.trim() ? g.logo.trim() : null;

  let hook = clipText(p.hook, 70, warnings, 'Hook');
  if (!hook) hook = name;

  let lines = (Array.isArray(p.lines) ? p.lines : typeof p.lines === 'string' ? [p.lines] : [])
    .map((l, i) => clipText(l, 70, warnings, `Line ${i + 1}`))
    .filter(Boolean);
  if (lines.length > 4) {
    warnings.push(`${lines.length} lines given; used the first 4.`);
    lines = lines.slice(0, 4);
  }
  if (!lines.length) lines = (DEFAULT_LINES[category] || DEFAULT_LINES.gym).slice();

  const o = p.offer && typeof p.offer === 'object' ? p.offer : {};
  const offer = {
    headline: clipText(o.headline, 56, warnings, 'Offer headline') || 'Come try a class',
    sub: clipText(o.sub, 80, warnings, 'Offer sub'),
  };
  const cta = clipText(p.cta, 56, warnings, 'CTA') || (site ? `Book at ${site}` : 'Send us a DM');

  let schedule = (Array.isArray(p.schedule) ? p.schedule : [])
    .filter((it) => it && typeof it === 'object')
    .map((it, i) => ({ time: clipText(it.time, 9, warnings, `Schedule ${i + 1} time`), label: clipText(it.label, 28, warnings, `Schedule ${i + 1} label`) }))
    .filter((it) => it.label || it.time);
  if (schedule.length > 5) {
    warnings.push(`${schedule.length} schedule items given; used the first 5.`);
    schedule = schedule.slice(0, 5);
  }
  if (!schedule.length) schedule = (DEFAULT_SCHEDULE[category] || DEFAULT_SCHEDULE.default).map((x) => Object.assign({}, x));

  const clips = asPathList(p.clips);
  const photos = asPathList(p.photos);
  const music = typeof p.music === 'string' && p.music.trim() ? p.music.trim() : null;
  const watermark = clipText(p.watermark, 80, warnings, 'Watermark') || `SAMPLE · made for ${name}`;

  return {
    props: {
      template,
      gym: { name, city, site, category, colors: { primary, accent }, logo },
      hook,
      lines,
      offer,
      cta,
      schedule,
      clips,
      photos,
      beat: p.beat === true || p.beat === 'true',
      music,
      watermark,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------

function palette(primary, accent) {
  const brand = A.toHex(primary);
  let dark = A.toHex(accent);
  // The "dark" scenes need a deep color. If the accent is light (or too close to the brand),
  // derive a deep shade of the brand instead.
  if (A.luminance(dark) > 0.06 || A.contrast(dark, brand) < 1.6) dark = A.withLightness(brand, 0.075, 0.7);
  if (A.luminance(dark) > 0.06) dark = '#0E0E10';
  const onBrand = A.textOn(brand);
  // A version of the brand that reads as type/lines on the dark color.
  const hsl = A.rgbToHsl(brand);
  let brandOnDark = brand;
  if (A.contrast(brand, dark) < 4.5) brandOnDark = A.withLightness(brand, Math.max(0.62, hsl.l), hsl.s < 0.15 ? 1 : 1.1);
  if (A.contrast(brandOnDark, dark) < 4.5) brandOnDark = '#FFFFFF';
  // Panels on brand: a slightly deeper/lighter brand for stripes and texture.
  const brandShade = A.luminance(brand) > 0.4 ? A.mix(brand, '#000000', 0.1) : A.mix(brand, '#FFFFFF', 0.1);
  const glow = A.luminance(brand) < 0.03 ? A.withLightness(brand, 0.35, 1.2) : brand;
  // Bright brands (lime, pastel) turn muddy when mixed into the dark, so they tint it less.
  const tintK = Math.min(1, 0.3 / Math.max(0.3, A.luminance(glow)));
  const deep = A.mix(dark, glow, 0.14 * tintK);
  const deep2 = A.mix(dark, glow, 0.26 * tintK);
  return { brand, dark, onBrand, onDark: '#FFFFFF', brandOnDark, brandShade, glow, deep, deep2 };
}

// ---------------------------------------------------------------------------------------------
// Text helpers shared by the scenes
// ---------------------------------------------------------------------------------------------

/** Picks the emphasized word: *marked* words first, else the last word that isn't filler. */
function keyWords(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const marked = new Set();
  const clean = words.map((w, i) => {
    if (/^\*.+\*[.,!?]*$/.test(w)) {
      marked.add(i);
      return w.replace(/^\*/, '').replace(/\*([.,!?]*)$/, '$1');
    }
    return w.replace(/\*/g, '');
  });
  if (!marked.size && clean.length > 1) {
    const filler = new Set(['A', 'AN', 'THE', 'OF', 'TO', 'IN', 'ON', 'AT', 'AND', 'OR', 'IS', 'IT', 'UP']);
    for (let i = clean.length - 1; i >= 0; i -= 1) {
      const bare = A.upper(clean[i]).replace(/[^A-Z0-9]/g, '');
      if (bare && !filler.has(bare)) {
        marked.add(i);
        break;
      }
    }
  }
  return { text: clean.join(' '), keys: marked };
}

const STYLE_ON_FOOTAGE = { bord: 5, bordColor: '#000000', bordOpacity: 0.3, blur: 7, shad: 0 };
// Highlight boxes reach PAD_Y x size above the cap top and below the baseline; BOX_LEADING keeps
// boxed lines from touching the lines around them.
const PAD_Y = 0.055;
const BOX_LEADING = 1.22;

/**
 * Word-by-word kinetic caption. Every word is its own event (\an5, so pops scale around the word);
 * key words get a brand box that wipes in from the left. Returns the layout.
 */
function kineticWords(doc, opts) {
  const {
    text,
    t0,
    t1,
    y,
    top,
    font = 'anton',
    maxSize = 190,
    minSize = 90,
    maxLines = 3,
    maxHeight = 520,
    maxWidth = SAFE.w,
    leading = 1.16,
    gap = 0.14,
    mode = 'pop',
    color = '#FFFFFF',
    boxColor,
    boxText,
    halo = false,
    layer = 40,
    exit = 'none',
    align = 'center',
    startDelay = 0.06,
    hit = false, // first word lands on t0 (the cut) instead of popping in after it
    caps = true,
    keys: forcedKeys,
  } = opts;
  const k = keyWords(text);
  const display = caps ? A.upper(k.text) : k.text;
  const keys = forcedKeys || k.keys;
  const padFor = (size) => Math.round(size * 0.1);
  const boxed = !!(boxColor && keys.size);
  // Boxes need air between lines: the box reaches PAD_Y above the cap top and below the baseline.
  const lead = boxed ? Math.max(leading, BOX_LEADING) : leading;
  // Two passes: estimate size without box padding, then with padding at that size.
  const pad = new Map();
  let layout = A.layoutText(display, { font, maxWidth, maxLines, maxSize, minSize, maxHeight, leading: lead, align });
  if (!layout) return null;
  if (boxed) {
    for (const i of keys) pad.set(i, padFor(layout.size));
    layout = A.layoutText(display, { font, maxWidth, maxLines, maxSize: layout.size, minSize, maxHeight, leading: lead, pad, align });
  }
  A.placeBlock(layout, { y, top });
  const f = layout.font;
  const size = layout.size;
  let idx = 0;
  const nWords = layout.words.length;
  const restSx = layout.sx !== 1 ? layout.sx * 100 : 100;
  const step = nWords > 1 ? Math.min(gap, (Math.max(0.3, t1 - t0) * 0.55) / (nWords - 1)) : gap;
  for (const ln of layout.lines) {
    for (const w of ln.words) {
      const isKey = keys.has(w.i) && !!boxColor;
      const hitIt = hit && idx === 0 && !isKey;
      const ts = hitIt ? A.snap(t0 + (typeof hit === 'number' ? hit : 0)) : A.snap(t0 + startDelay + idx * step);
      idx += 1;
      if (ts >= t1) continue;
      const totalMs = (t1 - ts) * 1000;
      const base = { an: 5, pos: [w.cx, ln.posY], font: f, size, sx: layout.sx !== 1 ? layout.sx * 100 : undefined };
      if (layout.sp) base.fsp = layout.sp;
      if (isKey) {
        const px = pad.get(w.i) || padFor(size);
        const bx0 = w.x0 - px;
        const bx1 = w.x1 + px;
        const by0 = ln.capTop - size * PAD_Y;
        const by1 = ln.baseline + size * PAD_Y;
        const bw = bx1 - bx0;
        const bh = by1 - by0;
        const tb = Math.max(t0, ts - 0.03);
        const wipe = A.anim(0, 160, `\\clip(${Math.round(bx0)},${Math.round(by0) - 2},${Math.round(bx1)},${Math.round(by1) + 2})`, 0.4);
        doc.shape(layer - 2, tb, t1, { an: 7, pos: [bx0, by0], color: boxColor, clip: [bx0 - 4, by0 - 2, bx0 - 3, by1 + 2] }, A.roundRectPath(bw, bh, Math.min(10, size * 0.05)), wipe + A.exitTags((t1 - tb) * 1000, exit));
        doc.text(layer, ts, t1, Object.assign({}, base, { color: boxText || A.textOn(boxColor) }), w.text, A.entrance(mode, { dur: 200, sx: restSx }) + A.exitTags(totalMs, exit));
      } else {
        const o = Object.assign({}, base, { color });
        const kind = hitIt ? 'hit' : mode;
        let ent;
        if (halo) {
          Object.assign(o, STYLE_ON_FOOTAGE);
          ent = A.entrance(kind, { dur: 200, bordTo: STYLE_ON_FOOTAGE.bordOpacity, sx: restSx });
        } else ent = A.entrance(kind, { dur: 200, sx: restSx });
        doc.text(layer, ts, t1, o, w.text, ent + A.exitTags(totalMs, exit));
      }
    }
  }
  layout.lastIn = A.snap(t0 + startDelay + (nWords - 1) * step) + 0.2;
  return layout;
}

/** Lines that rise into place from behind their own mask (eased, baked per frame). */
function riseLines(doc, opts) {
  const { layout, t0, t1, stagger = 0.07, dur = 0.36, color = '#FFFFFF', layer = 40, opacity = 1, extra = {}, keyBox } = opts;
  const f = layout.font;
  const size = layout.size;
  layout.lines.forEach((ln, i) => {
    const s = A.snap(t0 + i * stagger);
    const e = A.snap(s + dur);
    if (s >= t1) return;
    const clipTop = Math.round(ln.capTop - size * 0.12);
    const clipBot = Math.round(ln.baseline + size * 0.16);
    const dy = (clipBot - clipTop) * 1.05;
    const x = (ln.x0 + ln.x1) / 2;
    const base = Object.assign({ an: 5, font: f, size, color, opacity }, extra);
    if (layout.sx !== 1) base.sx = layout.sx * 100;
    if (layout.sp) base.fsp = layout.sp;
    doc.bake(layer, s, Math.min(e, t1), A.ease.outQuart, (p) => ({
      text: ln.text,
      o: Object.assign({}, base, { pos: [x, ln.posY + dy * (1 - p)], clip: [0, clipTop, W, clipBot] }),
    }));
    if (e < t1) doc.text(layer, e, t1, Object.assign({}, base, { pos: [x, ln.posY] }), ln.text);
    if (keyBox && keyBox.line === i) keyBox.draw(ln, e);
  });
}

/**
 * A soft dark band behind text over footage (a blurred full-width rectangle from y0 to y1).
 * ffmpeg draws it into the footage shot it belongs to (see shotScrim): libass would blend a
 * 1.6-megapixel image every frame on one thread.
 */
function scrim(doc, t0, t1, { y0, y1, opacity = 0.55 }) {
  doc.scrims.push({ t0, t1, y0, y1, opacity });
}

function watermark(doc, text, t0, t1) {
  const f = A.FONTS.inter600;
  let size = 25;
  const maxW = SAFE.w - 60;
  const spacing = 0.6;
  while (size > 15 && A.textWidth(text, f, size, spacing) > maxW) size -= 1;
  const w = A.textWidth(text, f, size, spacing);
  const padX = 16;
  const h = Math.round(size * 1.55);
  const x0 = SAFE.x0;
  const y0 = SAFE.y0 + 4;
  doc.shape(90, t0, t1, { an: 7, pos: [x0, y0], color: '#000000', opacity: 0.32 }, A.roundRectPath(w + padX * 2, h, h / 2));
  doc.text(91, t0, t1, { an: 4, pos: [x0 + padX, y0 + h / 2 - f.capCenter * size], font: f, size, fsp: spacing, color: '#FFFFFF', opacity: 0.6 }, text);
}

// ---------------------------------------------------------------------------------------------
// Backgrounds and transitions
// ---------------------------------------------------------------------------------------------

/**
 * Dark scenes: two drifting brand glows (drawn by ffmpeg on the generated gradient), a thin ring
 * and, behind hype scenes, a huge outlined word drifting sideways (both libass). The ring and word
 * are emitted at the end (emitBackdrops) so they can skip the time ranges covered by solid panels.
 */
function darkBackdrop(doc, t0, t1, pal, { seed = 0, title = '' } = {}) {
  const rnd = (i) => {
    const x = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  // Bright brand colors get fainter glows so the dark stays dark.
  const gk = Math.min(1, 0.42 / Math.max(0.42, A.luminance(pal.glow)));
  const ax = -120 + rnd(1) * 300 + 420;
  const ay = 120 + rnd(2) * 380 + 420;
  doc.glows.push({ t0, t1, r: 420, from: [ax, ay], to: [ax + 160, ay + 120], opacity: 0.34 * gk, color: pal.glow });
  const bx = 520 + rnd(3) * 240 + 340;
  const by = 1080 + rnd(4) * 300 + 340;
  doc.glows.push({ t0, t1, r: 340, from: [bx, by], to: [bx - 140, by - 160], opacity: 0.22 * gk, color: pal.glow });
  doc.backdrops.push({ t0, t1, pal, title });
}

/** Time ranges of [t0, t1] not covered by any solid panel. */
function uncovered(t0, t1, solids) {
  let out = [[t0, t1]];
  for (const s of solids) {
    const next = [];
    for (const [a, b] of out) {
      if (s.t1 <= a + 1e-6 || s.t0 >= b - 1e-6) next.push([a, b]);
      else {
        if (s.t0 > a + 1e-6) next.push([a, s.t0]);
        if (s.t1 < b - 1e-6) next.push([s.t1, b]);
      }
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a >= 1 / FPS - 1e-6);
}

/** Ring arcs: a thin ring cut into short arcs, so libass blends small images, not a 0.9 MP one. */
function ringArcs(cx, cy, r, thick, n = 48) {
  const arcs = [];
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 + 0.002;
    const pts = [];
    for (let k = 0; k <= 3; k += 1) {
      const a = a0 + ((a1 - a0) * k) / 3;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let k = 3; k >= 0; k -= 1) {
      const a = a0 + ((a1 - a0) * k) / 3;
      pts.push([cx + Math.cos(a) * (r - thick), cy + Math.sin(a) * (r - thick)]);
    }
    const x0 = Math.floor(Math.min(...pts.map((q) => q[0])));
    const y0 = Math.floor(Math.min(...pts.map((q) => q[1])));
    arcs.push({ x0, y0, path: A.polyPath(pts.map(([x, y]) => [x - x0, y - y0])) });
  }
  return arcs;
}

function emitBackdrops(doc) {
  for (const bd of doc.backdrops) {
    const { pal } = bd;
    const span = bd.t1 - bd.t0;
    for (const [a, b] of uncovered(bd.t0, bd.t1, doc.solids)) {
      // the ring holds still (a static image is cached by libass)
      for (const arc of ringArcs(SAFE.cx + 260, 520, 450, 3)) {
        doc.shape(2, a, b, { an: 7, pos: [arc.x0, arc.y0], color: pal.brandOnDark, opacity: 0.16 }, arc.path);
      }
      if (bd.title) {
        // the outlined word drifts 1-2 px per frame on whole pixels, so libass reuses its bitmap
        const word = A.upper(bd.title);
        doc.bake(2, a, b, A.ease.linear, (p, n) => {
          const x = Math.round(60 - (320 * (n / FPS - bd.t0)) / span);
          return { text: word, o: { an: 4, pos: [x, 1520], font: 'anton', size: 520, color: pal.dark, opacity: 0, bord: 2.5, bordColor: pal.brandOnDark, bordOpacity: 0.13 } };
        });
      }
    }
  }
}

/**
 * Full-screen solid panel in `color`. With base support (doc.solids) ffmpeg draws it as a flat
 * color shot under libass; a recorded group still gets an item, so liftGroup can move a copy.
 */
function panel(doc, t0, t1, color, layer = 10) {
  const item = { kind: 'shape', layer, start: t0, end: t1, o: { an: 7, pos: [0, 0], color }, p: A.rectPath(W, H), anim: '' };
  if (doc.solids) {
    doc.solids.push({ t0, t1, color });
    if (doc.onItem) doc.onItem(item);
    return;
  }
  doc.shape(item.layer, t0, t1, item.o, item.p);
}

/** A slanted texture band on a solid panel (static; drawn into the panel by ffmpeg). */
function band(doc, t0, t1, { x, w, skew = 520, color, opacity, layer = 11 }) {
  const item = { kind: 'shape', layer, start: t0, end: t1, o: { an: 7, pos: [x, 0], color, opacity }, p: A.slantPath(w, H, skew), anim: '' };
  if (doc.solids) {
    doc.bands.push({ t0, t1, x, w, skew, color, opacity });
    if (doc.onItem) doc.onItem(item);
    return;
  }
  doc.shape(layer, t0, t1, item.o, item.p);
}

/**
 * Slanted panel that sweeps across the frame (eased). dir: 'left' (enters from the right moving
 * left) or 'right'. mode 'in': ends covering the frame; 'out': starts covering and leaves.
 */
function sweep(doc, t0, dur, color, { dir = 'left', mode = 'in', layer = 60, skew = 260 } = {}) {
  const wide = W + skew;
  const from = mode === 'in' ? (dir === 'left' ? W : -wide) : -skew / 2;
  const to = mode === 'in' ? -skew / 2 : dir === 'left' ? -wide - 40 : W + 40;
  doc.bake(layer, t0, t0 + dur, mode === 'in' ? A.ease.outQuart : A.ease.inCubic, (p) => ({
    path: A.slantPath(wide, H, dir === 'left' ? skew : -skew),
    o: { an: 7, pos: [from + (to - from) * p, 0], color },
  }));
}

/** Vertical version: a panel that slides up out of the frame (reveals what is under it). */
function liftAway(doc, t0, dur, color, layer = 60, easing = A.ease.inCubic) {
  doc.bake(layer, t0, t0 + dur, easing, (p) => ({
    path: A.rectPath(W, H + 200),
    o: { an: 7, pos: [0, -(H + 220) * p], color },
  }));
}

/** Records every text/shape event a scene adds, so the whole scene can be moved later. */
function recordGroup(doc, fn) {
  const items = [];
  const { text, shape } = doc;
  doc.text = function recText(layer, start, end, o, s, anim = '') {
    items.push({ kind: 'text', layer, start, end, o, s, anim });
    return text.call(this, layer, start, end, o, s, anim);
  };
  doc.shape = function recShape(layer, start, end, o, p, anim = '') {
    items.push({ kind: 'shape', layer, start, end, o, p, anim });
    return shape.call(this, layer, start, end, o, p, anim);
  };
  const prevOnItem = doc.onItem;
  doc.onItem = (it) => items.push(it);
  let ret;
  try {
    ret = fn();
  } finally {
    doc.text = text;
    doc.shape = shape;
    doc.onItem = prevOnItem;
  }
  return { items, ret };
}

/**
 * Lifts a recorded scene off the top of the frame as one sheet (eased, baked per frame), above
 * whatever comes next, so the next scene is revealed from below. Only events still on screen at
 * t0 move; entrance animations are long finished by then, so their resting state is used.
 */
function liftGroup(doc, items, t0, dur, { layerBase = 62, easing = A.ease.inCubic, lift = H + 260, blur = true } = {}) {
  const live = items.filter((it) => it.start < t0 - 1e-6 && it.end >= t0 - 1e-6 && (it.o.pos || it.o.move));
  const layers = [...new Set(live.map((it) => it.layer))].sort((a, b) => a - b);
  for (const it of live) {
    const o0 = Object.assign({}, it.o);
    if (o0.move) {
      const [x1, y1, x2, y2, m0 = 0, m1 = (it.end - it.start) * 1000] = o0.move;
      const k = Math.min(1, Math.max(0, ((t0 - it.start) * 1000 - m0) / Math.max(1, m1 - m0)));
      o0.pos = [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k];
      delete o0.move;
    }
    delete o0.fad;
    // A clip that was animated (a wipe) rests at its last \clip rectangle.
    const clips = [...String(it.anim).matchAll(/\\clip\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)/g)];
    if (clips.length) o0.clip = clips[clips.length - 1].slice(1, 5).map(Number);
    const layer = layerBase + layers.indexOf(it.layer);
    const f0 = Math.round(t0 * FPS);
    const cnt = Math.max(1, Math.round((t0 + dur) * FPS) - f0);
    doc.bake(layer, t0, t0 + dur, easing, (p, n) => {
      const dy = -lift * p;
      const o = Object.assign({}, o0, { pos: [o0.pos[0], o0.pos[1] + dy] });
      if (o0.clip) o.clip = [o0.clip[0], o0.clip[1] + dy, o0.clip[2], o0.clip[3] + dy];
      if (it.kind === 'text') {
        // Fake motion blur: type blurs with the distance it travelled since the last frame.
        const prev = cnt > 1 ? easing(Math.max(0, (n - f0 - 1) / (cnt - 1))) : 0;
        const speed = lift * (p - prev);
        if (blur && speed > 40) o.blur = Math.max(o0.blur || 0, Math.min(14, speed / 32));
        return { o, text: it.s };
      }
      return { o, path: it.p };
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------------------------

function textColors(bg, pal) {
  if (bg === 'brand') return { color: pal.onBrand, boxColor: pal.onBrand, boxText: pal.brand, halo: false };
  if (bg === 'dark') return { color: '#FFFFFF', boxColor: pal.brand, boxText: pal.onBrand, halo: false };
  return { color: '#FFFFFF', boxColor: pal.brand, boxText: pal.onBrand, halo: true };
}

function hookScene(doc, t0, t1, hook, pal, { bg = 'footage', y = 780 } = {}) {
  const c = textColors(bg, pal);
  if (bg === 'footage') scrim(doc, t0, t1, { y0: y - 420, y1: y + 420, opacity: 0.42 });
  const words = hook.split(/\s+/).filter(Boolean).length;
  return kineticWords(doc, {
    text: hook,
    t0,
    t1,
    y,
    maxSize: 300,
    minSize: 110,
    maxLines: words > 6 ? 4 : 3,
    maxHeight: 640,
    leading: 1.13,
    gap: words <= 4 ? 0.17 : words <= 6 ? 0.13 : 0.1,
    mode: 'slam',
    startDelay: 0.1,
    ...c,
  });
}

function lineScene(doc, t0, t1, line, pal, { bg = 'footage', index = 0, count = 1, y, delay = 0 } = {}) {
  const c = textColors(bg, pal);
  const yy = y || (bg === 'footage' ? 1110 : 860);
  if (bg === 'footage') scrim(doc, t0, t1, { y0: yy - 330, y1: H + 200, opacity: 0.5, fadeIn: delay });
  const lay = kineticWords(doc, {
    text: line,
    t0,
    t1,
    y: yy,
    maxSize: bg === 'footage' ? 215 : 250,
    minSize: 84,
    maxLines: 3,
    maxHeight: bg === 'footage' ? 520 : 660,
    leading: 1.14,
    gap: 0.12,
    mode: 'pop',
    startDelay: 0.06 + delay,
    hit: delay > 0 ? delay : true,
    ...c,
  });
  // Small "01 / 03" counter above the block: structure, not decoration.
  if (lay && count > 1) {
    const f = A.FONTS.inter800;
    const s = 36;
    const label = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    const yLab = lay.top - 70;
    const col = bg === 'brand' ? pal.onBrand : bg === 'dark' ? pal.brandOnDark : '#FFFFFF';
    const tIn = A.snap(t0 + 0.03 + delay);
    doc.text(44, tIn, t1, { an: 5, pos: [SAFE.cx, yLab - f.capCenter * s], font: f, size: s, fsp: 4, color: col, opacity: bg === 'footage' ? 0.92 : 0.85, ...(bg === 'footage' ? { bord: 3, bordColor: '#000000', bordOpacity: 0.35, blur: 4 } : {}) }, label, A.entrance('soft', { dur: 180, alphaTo: bg === 'footage' ? 0.92 : 0.85, bordTo: bg === 'footage' ? 0.35 : undefined }));
  }
  return lay;
}

function offerScene(doc, t0, t1, props, pal, { enter = 'sweep' } = {}) {
  const { offer, gym, cta } = props;
  if (enter === 'sweep') {
    sweep(doc, t0, 0.26, pal.dark, { dir: 'left', layer: 60, skew: 300 });
    sweep(doc, A.snap(t0 + 0.05), 0.26, pal.brand, { dir: 'left', layer: 61, skew: 300 });
    panel(doc, A.snap(t0 + OFFER_COVER), t1, pal.brand, 10);
  } else panel(doc, t0, t1, pal.brand, 10);
  // type starts rising under the brand sweep, so it is nearly settled when the sweep clears
  const tIn = A.snap(t0 + (enter === 'sweep' ? 0.24 : 0.05));
  const ink = pal.onBrand;
  // Texture: two big slanted bands in a slightly different brand shade.
  band(doc, t0, t1, { x: -420, w: 300, color: pal.brandShade, opacity: 0.55 });
  band(doc, t0, t1, { x: 780, w: 120, color: pal.brandShade, opacity: 0.4 });

  // Label: the gym name, small and tracked out.
  const labF = A.FONTS.inter800;
  const lab = A.upper(gym.name);
  let ls = 30;
  while (ls > 18 && A.textWidth(lab, labF, ls, 5) > SAFE.w) ls -= 1;
  // Headline
  const k = keyWords(offer.headline);
  const head = A.upper(k.text);
  const pad = new Map();
  const headLead = k.keys.size ? BOX_LEADING : 1.1;
  let lay = A.layoutText(head, { font: 'anton', maxWidth: SAFE.w, maxLines: 4, maxSize: 330, minSize: 100, maxHeight: 700, leading: headLead });
  for (const i of k.keys) pad.set(i, Math.round(lay.size * 0.1));
  lay = A.layoutText(head, { font: 'anton', maxWidth: SAFE.w, maxLines: 4, maxSize: lay.size, minSize: 100, maxHeight: 700, leading: headLead, pad });
  const subText = offer.sub && offer.sub.toLowerCase() !== String(cta).toLowerCase() ? offer.sub : '';
  const subF = A.FONTS.inter700;
  const subLay = subText ? A.layoutText(subText, { font: subF, maxWidth: SAFE.w - 40, maxLines: 2, maxSize: 60, minSize: 32, leading: 1.45 }) : null;
  const gapLab = 70;
  const gapSub = 84;
  const totalH = ls + gapLab + lay.height + (subLay ? gapSub + subLay.height : 0);
  const top = Math.max(SAFE.y0 + 120, SAFE.cy - totalH / 2 - 20);
  const labY = top + ls / 2;
  doc.text(42, A.snap(tIn + 0.02), t1, { an: 5, pos: [SAFE.cx, labY - labF.capCenter * ls], font: labF, size: ls, fsp: 5, color: ink, opacity: 0.78 }, lab, A.entrance('soft', { dur: 220, alphaTo: 0.78 }));
  A.placeBlock(lay, { top: top + ls + gapLab });
  // Key word: inverted box (ink box, brand-colored word)
  const keyLine = lay.lines.findIndex((ln) => ln.words.some((w) => k.keys.has(w.i)));
  const riseAt = A.snap(tIn + 0.04);
  const stagger = 0.045;
  const riseDur = 0.3;
  riseLines(doc, {
    layout: lay,
    t0: riseAt,
    t1,
    stagger,
    dur: riseDur,
    color: ink,
    layer: 44,
  });
  if (keyLine >= 0) {
    const ln = lay.lines[keyLine];
    const tKey = A.snap(riseAt + keyLine * stagger + riseDur + 0.06);
    for (const w of ln.words) {
      if (!k.keys.has(w.i)) continue;
      const px = pad.get(w.i) || Math.round(lay.size * 0.1);
      const bx0 = w.x0 - px;
      const bx1 = w.x1 + px;
      const by0 = ln.capTop - lay.size * PAD_Y;
      const by1 = ln.baseline + lay.size * PAD_Y;
      const wipe = A.anim(0, 200, `\\clip(${Math.round(bx0)},${Math.round(by0) - 2},${Math.round(bx1)},${Math.round(by1) + 2})`, 0.45);
      doc.shape(46, tKey, t1, { an: 7, pos: [bx0, by0], color: ink, clip: [bx0 - 4, by0 - 2, bx0 - 3, by1 + 2] }, A.roundRectPath(bx1 - bx0, by1 - by0, 8), wipe);
      doc.text(47, tKey, t1, { an: 5, pos: [w.cx, ln.posY], font: lay.font, size: lay.size, color: pal.brand, clip: [bx0 - 4, by0 - 2, bx0 - 3, by1 + 2] }, w.text, wipe);
    }
  }
  if (subLay) {
    const subTop = lay.bottom + gapSub;
    A.placeBlock(subLay, { top: subTop });
    // short rule between headline and sub
    const ruleY = lay.bottom + gapSub / 2 - 3;
    const tr = A.snap(tIn + 0.4);
    doc.shape(42, tr, t1, { an: 7, pos: [SAFE.cx - 60, ruleY], color: ink, clip: [SAFE.cx - 64, ruleY - 2, SAFE.cx - 63, ruleY + 8] }, A.rectPath(120, 6), A.anim(0, 260, `\\clip(${SAFE.cx - 60},${Math.round(ruleY) - 2},${SAFE.cx + 60},${Math.round(ruleY) + 8})`, 0.5));
    riseLines(doc, { layout: subLay, t0: A.snap(tIn + 0.46), t1, stagger: 0.06, dur: 0.32, color: ink, layer: 44 });
  }
  return lay;
}

function endScene(doc, t0, t1, props, pal, { logo } = {}) {
  const { gym, cta } = props;
  // name
  const name = A.upper(gym.name);
  const lay = A.layoutText(name, { font: 'anton', maxWidth: SAFE.w, maxLines: 3, maxSize: 190, minSize: 80, maxHeight: 460, leading: 1.1 });
  // CTA pill
  const ctaText = A.upper(cta);
  const ctaF = A.FONTS.archivo;
  let cs = 46;
  while (cs > 24 && A.textWidth(ctaText, ctaF, cs, 1) > SAFE.w - 100) cs -= 1;
  const ctaW = A.textWidth(ctaText, ctaF, cs, 1) + 84;
  const ctaH = Math.round(cs * 2.05);
  // small lines under the CTA
  const site = gym.site && !cta.toLowerCase().includes(gym.site.toLowerCase()) ? gym.site : '';
  const small = [];
  if (site) small.push({ text: site, font: A.FONTS.inter700, size: 38, spacing: 0.5, opacity: 0.9, upper: false });
  if (gym.city) small.push({ text: A.upper(gym.city), font: A.FONTS.inter700, size: 30, spacing: 6, opacity: 0.72, upper: true, pin: true });
  for (const s of small) {
    while (s.size > 18 && A.textWidth(s.text, s.font, s.size, s.spacing) + (s.pin ? 50 : 0) > SAFE.w) s.size -= 1;
  }
  const logoH = logo ? logo.h : 0;
  const gLogo = logo ? 70 : 0;
  const gCta = 84;
  const gSmall = 64;
  const smallH = small.reduce((acc, s, i) => acc + s.size * 0.75 + (i ? 26 : 0), 0);
  const total = logoH + gLogo + lay.height + gCta + ctaH + (small.length ? gSmall + smallH : 0);
  const top = Math.max(SAFE.y0 + 110, SAFE.cy - total / 2);
  let y = top;
  if (logo) {
    logo.y = Math.round(y);
    logo.x = Math.round(SAFE.cx - logo.w / 2);
    logo.t = A.snap(t0 + 0.12);
    y += logoH + gLogo;
  }
  A.placeBlock(lay, { top: y });
  y = lay.bottom;
  kineticLines(doc, lay, A.snap(t0 + (logo ? 0.22 : 0.1)), t1, '#FFFFFF');
  // CTA
  y += gCta;
  const tc = A.snap(t0 + (logo ? 0.55 : 0.45));
  const cx0 = SAFE.cx - ctaW / 2;
  doc.shape(40, tc, t1, { an: 5, pos: [SAFE.cx, y + ctaH / 2], color: pal.brand }, A.roundRectPath(ctaW, ctaH, ctaH / 2), A.entrance('pop', { dur: 240 }));
  doc.text(41, tc, t1, { an: 5, pos: [SAFE.cx, y + ctaH / 2 - ctaF.capCenter * cs], font: ctaF, size: cs, fsp: 1, color: pal.onBrand }, ctaText, A.entrance('pop', { dur: 240 }));
  void cx0;
  y += ctaH;
  if (small.length) {
    y += gSmall;
    small.forEach((s, i) => {
      const tt = A.snap(tc + 0.18 + i * 0.1);
      const w = A.textWidth(s.text, s.font, s.size, s.spacing) + (s.pin ? 44 : 0);
      const cyy = y + (s.size * 0.75) / 2;
      const tx = SAFE.cx + (s.pin ? 22 : 0);
      doc.text(42, tt, t1, { an: 5, pos: [tx, cyy - s.font.capCenter * s.size], font: s.font, size: s.size, fsp: s.spacing, color: '#FFFFFF', opacity: s.opacity }, s.text, A.entrance('soft', { dur: 220, alphaTo: s.opacity }));
      if (s.pin) {
        const pinH = s.size * 0.95;
        const px = SAFE.cx - w / 2;
        doc.shape(42, tt, t1, { an: 7, pos: [px, cyy - pinH / 2], color: pal.brandOnDark, opacity: 0.95 }, pinPath(pinH), A.entrance('soft', { dur: 220, alphaTo: 0.95 }));
      }
      y += s.size * 0.75 + 26;
    });
  }
  return lay;
}

function pinPath(h) {
  // map pin: circle head with a point, hole in the middle
  const r = h * 0.36;
  const w = r * 2;
  const k = r * 0.5523;
  const cx = r;
  const cy = r;
  const outer = [
    `m ${cx} ${h}`,
    `b ${cx - r * 0.35} ${h - r * 0.7} ${0} ${cy + r * 0.75} ${0} ${cy}`,
    `b 0 ${cy - k} ${cx - k} 0 ${cx} 0`,
    `b ${cx + k} 0 ${w} ${cy - k} ${w} ${cy}`,
    `b ${w} ${cy + r * 0.75} ${cx + r * 0.35} ${h - r * 0.7} ${cx} ${h}`,
  ].join(' ');
  return `${outer} ${A.circlePath(r * 0.38, cx - r * 0.38, cy - r * 0.38, true)}`;
}

/** Whole lines slam in one after another (used for names and titles). */
function kineticLines(doc, lay, t0, t1, color, { gap = 0.1, mode = 'slam', layer = 40, extra = {} } = {}) {
  lay.lines.forEach((ln, i) => {
    const s = A.snap(t0 + i * gap);
    const o = Object.assign({ an: 5, pos: [(ln.x0 + ln.x1) / 2, ln.posY], font: lay.font, size: lay.size, color }, extra);
    if (lay.sx !== 1) o.sx = lay.sx * 100;
    if (lay.sp) o.fsp = lay.sp;
    doc.text(layer, s, t1, o, ln.text, A.entrance(mode, { dur: 220, bordTo: extra.bordOpacity, sx: o.sx || 100 }));
  });
}

function cityScene(doc, t0, t1, city, pal) {
  panel(doc, t0, t1, pal.brand, 10);
  band(doc, t0, t1, { x: -340, w: 260, color: pal.brandShade, opacity: 0.5 });
  const text = `${A.upper(city).replace(/[.!?]+$/, '')}.`;
  const lay = A.layoutText(text, { font: 'anton', maxWidth: SAFE.w, maxLines: 3, maxSize: 330, minSize: 120, maxHeight: 760, leading: 1.08 });
  A.placeBlock(lay, { y: SAFE.cy - 20 });
  // letters drop in one by one, all of them landed by about 60% of the scene
  const letters = text.replace(/\s/g, '').length;
  const stagger = Math.min(0.035, ((t1 - t0) * 0.45) / Math.max(1, letters - 1));
  let n = 0;
  lay.lines.forEach((ln) => {
    let x = ln.x0;
    for (const ch of ln.text) {
      const cw = A.charWidth(lay.font, ch) * lay.size * (lay.sx || 1);
      if (ch !== ' ') {
        const s = A.snap(t0 + 0.05 + n * stagger);
        n += 1;
        doc.text(40, s, t1, { an: 5, pos: [x + cw / 2, ln.posY], font: lay.font, size: lay.size, color: pal.onBrand, sx: lay.sx !== 1 ? lay.sx * 100 : undefined }, ch, A.entrance('slam', { dur: 200, sx: lay.sx !== 1 ? lay.sx * 100 : 100 }));
      }
      x += cw;
    }
  });
  return lay;
}

// ---------------------------------------------------------------------------------------------
// Class template pieces
// ---------------------------------------------------------------------------------------------

/** "6:00" -> "6AM", "18:30" -> "6:30PM", "6pm" -> "6PM". */
function classTime(t) {
  const m = String(t || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return { short: A.upper(t || '').replace(/\s+/g, ''), ok: false };
  let h = parseInt(m[1], 10);
  const min = m[2] && m[2] !== '00' ? m[2] : '';
  let ap = m[3] ? m[3].toUpperCase() : '';
  if (!ap) {
    if (h >= 12 && h < 24) {
      ap = 'P';
      if (h > 12) h -= 12;
    } else ap = 'A';
  }
  if (h === 0) h = 12;
  return { short: `${h}${min ? `:${min}` : ''}${ap}M`, ok: true };
}

function classTitleScene(doc, t0, t1, props, pal, { bg = 'footage' } = {}) {
  const time = classTime(props.schedule[0] && props.schedule[0].time).short;
  const small = A.FONTS.inter800;
  const c = textColors(bg, pal);
  const halo = bg === 'footage' ? { bord: 4, bordColor: '#000000', bordOpacity: 0.3, blur: 6 } : {};
  if (bg === 'footage') scrim(doc, t0, t1, { y0: 380, y1: 1300, opacity: 0.5 });
  // big line: "6AM CLASS" with the time boxed
  const big = A.layoutText(time ? `${time} CLASS` : 'CLASS', { font: 'anton', maxWidth: SAFE.w - 20, maxLines: 1, maxSize: 260, minSize: 120, pad: new Map([[0, 26]]) });
  const name = A.layoutText(`AT ${A.upper(props.gym.name)}`, { font: 'anton', maxWidth: SAFE.w, maxLines: 2, maxSize: 112, minSize: 64, leading: 1.12 });
  const smallSize = 44;
  const gap = 46;
  const total = smallSize * 0.75 + gap + big.height + gap + name.height + gap + smallSize * 0.75;
  let y = SAFE.cy - 60 - total / 2;
  const tA = A.snap(t0 + 0.08);
  const lineSmall = (text, yy, tt) => {
    doc.text(43, tt, t1, Object.assign({ an: 5, pos: [SAFE.cx, yy + (smallSize * 0.75) / 2 - small.capCenter * smallSize], font: small, size: smallSize, fsp: 10, color: '#FFFFFF' }, halo), text, A.entrance('soft', { dur: 220, bordTo: halo.bordOpacity }));
  };
  lineSmall('WHAT A', y, tA);
  y += smallSize * 0.75 + gap;
  A.placeBlock(big, { top: y });
  const ln = big.lines[0];
  const w0 = ln.words[0];
  const tB = A.snap(t0 + 0.22);
  const px = 26;
  const bx0 = w0.x0 - px;
  const bx1 = w0.x1 + px;
  const by0 = ln.capTop - big.size * 0.085;
  const by1 = ln.baseline + big.size * 0.085;
  doc.shape(41, tB, t1, { an: 7, pos: [bx0, by0], color: c.boxColor, clip: [bx0 - 4, by0 - 2, bx0 - 3, by1 + 2] }, A.roundRectPath(bx1 - bx0, by1 - by0, 10), A.anim(0, 180, `\\clip(${Math.round(bx0)},${Math.round(by0) - 2},${Math.round(bx1)},${Math.round(by1) + 2})`, 0.4));
  ln.words.forEach((w, i) => {
    const o = { an: 5, pos: [w.cx, ln.posY], font: big.font, size: big.size, color: i === 0 ? c.boxText : c.color };
    if (i > 0) Object.assign(o, halo);
    doc.text(43, A.snap(tB + i * 0.12), t1, o, w.text, A.entrance('slam', { dur: 220, bordTo: i > 0 ? halo.bordOpacity : undefined }));
  });
  y = big.top + big.height + gap;
  A.placeBlock(name, { top: y });
  kineticLines(doc, name, A.snap(t0 + 0.5), t1, c.color, { gap: 0.1, mode: 'pop', layer: 43, extra: halo });
  y = name.bottom + gap;
  lineSmall('LOOKS LIKE', y, A.snap(t0 + 0.7));
}

function scheduleScene(doc, t0, t1, item, i, n, pal, { bg = 'footage' } = {}) {
  const c = textColors(bg, pal);
  const halo = bg === 'footage' ? { bord: 5, bordColor: '#000000', bordOpacity: 0.3, blur: 7 } : {};
  if (bg === 'footage') scrim(doc, t0, t1, { y0: 860, y1: H + 200, opacity: 0.58 });
  // chip
  const chipF = A.FONTS.archivo;
  const cs = 58;
  const time = item.time || '';
  const label = A.upper(item.label || '');
  const lay = A.layoutText(label, { font: 'anton', maxWidth: SAFE.w, maxLines: 2, maxSize: 210, minSize: 90, maxHeight: 360, leading: 1.1, align: 'left', x0: SAFE.x0 });
  const chipH = Math.round(cs * 1.7);
  const chipW = time ? A.textWidth(time, chipF, cs, 1) + 56 : 0;
  const barY = 1404;
  const labelBottom = barY - 70;
  A.placeBlock(lay, { bottom: labelBottom });
  const chipY = lay.top - 44 - chipH;
  const tc = A.snap(t0);
  if (time) {
    doc.shape(41, tc, t1, { an: 4, pos: [SAFE.x0, chipY + chipH / 2], color: c.boxColor, clip: [SAFE.x0 - 4, chipY - 2, SAFE.x0 - 3, chipY + chipH + 2] }, A.roundRectPath(chipW, chipH, 12), A.anim(0, 140, `\\clip(${SAFE.x0},${Math.round(chipY) - 2},${Math.round(SAFE.x0 + chipW)},${Math.round(chipY + chipH) + 2})`, 0.4));
    doc.text(42, A.snap(tc + 0.03), t1, { an: 4, pos: [SAFE.x0 + 28, chipY + chipH / 2 - chipF.capCenter * cs], font: chipF, size: cs, fsp: 1, color: c.boxText }, time, A.entrance('soft', { dur: 160 }));
  }
  // step counter on the right, aligned with the chip
  const cf = A.FONTS.inter800;
  const cnt = `${String(i + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`;
  doc.text(42, tc, t1, Object.assign({ an: 6, pos: [SAFE.x1, chipY + chipH / 2 - cf.capCenter * 32], font: cf, size: 32, fsp: 3, color: '#FFFFFF', opacity: 0.85 }, halo), cnt, A.entrance('soft', { dur: 160, alphaTo: 0.85, bordTo: halo.bordOpacity }));
  // label words pop in, left aligned
  let k = 0;
  lay.lines.forEach((ln) => {
    ln.words.forEach((w) => {
      // the first word lands on the cut, the rest pop in after it
      const s = k === 0 ? A.snap(t0) : A.snap(t0 + 0.08 + k * 0.09);
      const kind = k === 0 ? 'hit' : 'pop';
      k += 1;
      doc.text(43, s, t1, Object.assign({ an: 5, pos: [w.cx, ln.posY], font: lay.font, size: lay.size, color: c.color, sx: lay.sx !== 1 ? lay.sx * 100 : undefined }, halo), w.text, A.entrance(kind, { dur: 200, bordTo: halo.bordOpacity, sx: lay.sx !== 1 ? lay.sx * 100 : 100 }));
    });
  });
}

/** Progress bar along the bottom of the safe zone across the whole schedule section. */
function progressBar(doc, t0, t1, bounds, pal, { bg = 'footage' } = {}) {
  const y = 1404;
  const h = 10;
  const x0 = SAFE.x0;
  const x1 = SAFE.x1;
  const len = x1 - x0;
  const span = bounds[bounds.length - 1] - bounds[0];
  const tIn = A.snap(t0);
  doc.shape(45, tIn, t1, { an: 7, pos: [x0, y], color: '#FFFFFF', opacity: bg === 'brand' ? 0.35 : 0.28 }, A.roundRectPath(len, h, h / 2), A.entrance('soft', { dur: 200, alphaTo: bg === 'brand' ? 0.35 : 0.28 }));
  // fill grows linearly across the section (clip animation)
  const fillColor = pal.brand;
  doc.shape(46, tIn, t1, { an: 7, pos: [x0, y], color: fillColor, clip: [x0, y - 2, x0 + 1, y + h + 2] }, A.roundRectPath(len, h, h / 2), A.anim(0, Math.round(span * 1000), `\\clip(${x0},${y - 2},${x1},${y + h + 2})`));
  // dots at each block start
  bounds.slice(0, -1).forEach((b, i) => {
    const dx = x0 + ((b - bounds[0]) / span) * len;
    const r = 11;
    const tt = A.snap(Math.max(tIn, b - 0.02));
    doc.shape(47, tIn, t1, { an: 7, pos: [dx - r + (i === 0 ? r : 0), y + h / 2 - r], color: '#FFFFFF', opacity: 0.6 }, A.circlePath(r));
    doc.shape(48, tt, t1, { an: 5, pos: [dx + (i === 0 ? r : 0), y + h / 2], color: fillColor }, A.circlePath(r), A.entrance('pop', { dur: 200 }));
  });
}

// ---------------------------------------------------------------------------------------------
// Timelines
// ---------------------------------------------------------------------------------------------

function beatSplit(t0, t1, n) {
  const out = [t0];
  for (let i = 1; i < n; i += 1) out.push(Math.round((t0 + ((t1 - t0) * i) / n) / BEAT) * BEAT);
  out.push(t1);
  // make strictly increasing
  for (let i = 1; i < out.length; i += 1) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + BEAT;
  return out;
}

/** Splits [t0,t1] into footage shots of at most `maxLen` seconds, cut on beats. */
function shotsFor(t0, t1, maxLen = 2.0) {
  const n = Math.max(1, Math.ceil((t1 - t0) / maxLen - 1e-9));
  if (n === 1) return [[t0, t1]];
  const b = beatSplit(t0, t1, n);
  const out = [];
  for (let i = 0; i < b.length - 1; i += 1) out.push([b[i], b[i + 1]]);
  return out;
}

/**
 * Template timeline: the ASS document plus the base-layer shots.
 * Each shot: { t0, t1, kind: 'footage'|'bg', role, group } (footage is assigned to media later).
 */
function buildTimeline(props, pal, { footage, logoBox }) {
  const doc = new A.AssDoc({ title: `${props.gym.name} sample` });
  // Big flat or soft elements are drawn by ffmpeg in the base layer (it blends them on all cores
  // or at low resolution); scenes record them here and libass draws only type and small shapes.
  Object.assign(doc, { solids: [], bands: [], glows: [], scrims: [], backdrops: [] });
  const shots = [];
  const tpl = props.template;
  const useFootage = footage && tpl !== 'hype';
  const bgMain = useFootage ? 'footage' : 'dark';
  let posterTime = 1.2;
  const cues = { impacts: [], riser: null };

  // xfade: a (sparse) crossfade-style transition INTO this shot, e.g. { type: 'smoothup', dur: 0.24 }
  const footageShot = (t0, t1, role, group, xfade) => shots.push({ t0, t1, kind: 'footage', role, group, xfade });
  const bgShot = (t0, t1) => shots.push({ t0, t1, kind: 'bg' });

  if (tpl === 'offer' || tpl === 'hype') {
    let tHook0 = 0;
    let tLines0 = 2.0;
    const tOffer = 9.0;
    const tEnd = 12.5;
    if (tpl === 'hype') {
      tHook0 = 1.0;
      tLines0 = 3.0;
      const city = recordGroup(doc, () => cityScene(doc, 0, tHook0, props.gym.city || props.gym.name, pal));
      liftGroup(doc, city.items, tHook0, 0.26);
      darkBackdrop(doc, 0, 9.4, pal, { seed: 3, title: props.gym.city || props.gym.name });
      cues.impacts.push(tHook0);
    }
    // HOOK
    if (useFootage) footageShot(0, tLines0, 'hook', 0);
    else if (tpl !== 'hype') darkBackdrop(doc, 0, 9.4, pal, { seed: 3, title: props.gym.city || props.gym.name });
    const hook = recordGroup(doc, () => hookScene(doc, tHook0, tLines0, props.hook, pal, { bg: bgMain, y: useFootage ? 760 : 820 }));
    // With footage, line 1 comes in on a push (xfade slideup): the hook text rides up with the
    // outgoing shot (slideup moves it linearly by H/k per frame) and line 1 waits for the push.
    let pushDelay = 0;
    if (useFootage) {
      const k = Math.round(PUSH.dur * FPS);
      liftGroup(doc, hook.items, tLines0, k / FPS, { easing: A.ease.linear, lift: (H * (k - 1)) / k, blur: false });
      pushDelay = k / FPS;
    }
    // LINES
    const bounds = beatSplit(tLines0, tOffer, props.lines.length);
    props.lines.forEach((line, i) => {
      const s = bounds[i];
      const e = bounds[i + 1];
      let bg = bgMain;
      if (!useFootage && i % 2 === 0) {
        // alternate brand / dark scenes when there is no footage
        bg = 'brand';
        // the last brand line stays up under the offer sweeps
        const pe = e === tOffer ? A.snap(tOffer + OFFER_COVER) : e;
        panel(doc, s, pe, pal.brand, 10);
        band(doc, s, pe, { x: 690, w: 240, color: pal.brandShade, opacity: 0.55 });
      }
      if (useFootage) {
        shotsFor(s, e === tOffer ? A.snap(tOffer + OFFER_COVER) : e, 2.0).forEach(([a, b], k) => footageShot(a, b, 'line', i + 1, i === 0 && k === 0 ? PUSH : null));
      }
      lineScene(doc, s, e, line, pal, { bg, index: i, count: props.lines.length, delay: i === 0 ? pushDelay : 0 });
      cues.impacts.push(s);
    });
    // OFFER
    if (useFootage) bgShot(A.snap(tOffer + OFFER_COVER), DURATION);
    else bgShot(0, DURATION);
    const offerGroup = recordGroup(doc, () => offerScene(doc, tOffer, tEnd, props, pal, { enter: 'sweep' }));
    cues.impacts.push(tOffer);
    cues.riser = [tOffer - 1.0, tOffer];
    // END: the offer card lifts off as one sheet and reveals the end card
    liftGroup(doc, offerGroup.items, tEnd, 0.3);
    darkBackdrop(doc, tEnd, DURATION, pal, { seed: 9 });
    endScene(doc, A.snap(tEnd + 0.08), DURATION, props, pal, { logo: logoBox });
    cues.impacts.push(tEnd);
    // Poster: the finished hook (hype opens on the city card, so its hook lands later).
    posterTime = tpl === 'hype' ? 2.4 : 1.2;
  } else if (tpl === 'class') {
    const tItems = 2.5;
    const tEnd = 12.5;
    if (useFootage) {
      footageShot(0, 1.5, 'title', 0);
      footageShot(1.5, tItems, 'title', 0, { type: 'fade', dur: 0.3 });
    } else darkBackdrop(doc, 0, tEnd + 0.3, pal, { seed: 5, title: props.gym.city || props.gym.name });
    classTitleScene(doc, 0, tItems, props, pal, { bg: bgMain });
    const items = props.schedule.slice(0, 5);
    const bounds = beatSplit(tItems, tEnd, items.length);
    items.forEach((it, i) => {
      const s = bounds[i];
      const e = bounds[i + 1];
      if (useFootage) {
        const parts = e - s > 2.0 ? shotsFor(s, e, 1.5) : [[s, e]];
        parts.forEach(([a, b]) => footageShot(a, b, 'item', i + 1));
      }
      scheduleScene(doc, s, e, it, i, items.length, pal, { bg: bgMain });
      cues.impacts.push(s);
    });
    progressBar(doc, tItems, tEnd, bounds, pal, { bg: bgMain });
    // swipe through the brand color into the end card
    sweep(doc, A.snap(tEnd - 0.22), 0.22, pal.brand, { dir: 'left', mode: 'in', layer: 62 });
    liftAway(doc, tEnd, 0.3, pal.brand, 62, A.ease.inQuad);
    if (useFootage) bgShot(tEnd, DURATION);
    else bgShot(0, DURATION);
    darkBackdrop(doc, tEnd, DURATION, pal, { seed: 9 });
    endScene(doc, A.snap(tEnd + 0.06), DURATION, props, pal, { logo: logoBox });
    cues.impacts.push(tEnd);
    posterTime = 1.2;
  }
  watermark(doc, props.watermark, 0, DURATION);
  emitBackdrops(doc);
  // solid panels replace whatever is under them in the base layer
  for (const sd of doc.solids) shots.push({ t0: sd.t0, t1: sd.t1, kind: 'solid', color: sd.color });
  // normalize shots: sort, clamp, fill gaps, drop overlaps (later shots win)
  const norm = normalizeShots(shots);
  const overlaps = (a, s) => a.t0 < s.t1 - 1e-6 && a.t1 > s.t0 + 1e-6;
  for (const s of norm) {
    if (s.kind === 'solid') s.bands = doc.bands.filter((b) => overlaps(b, s));
    if (s.kind === 'bg') s.glows = doc.glows.filter((g) => overlaps(g, s));
    if (s.kind === 'footage') {
      const mid = (s.t0 + s.t1) / 2;
      s.scrim = doc.scrims.find((sc) => mid >= sc.t0 && mid < sc.t1) || null;
    }
  }
  return { doc, shots: norm, posterTime, cues };
}

function normalizeShots(shots) {
  const frames = new Array(FRAMES).fill(null);
  shots.forEach((s, idx) => {
    const f0 = Math.max(0, Math.round(s.t0 * FPS));
    const f1 = Math.min(FRAMES, Math.round(s.t1 * FPS));
    for (let f = f0; f < f1; f += 1) frames[f] = idx;
  });
  // fill holes with the previous shot
  for (let f = 0; f < FRAMES; f += 1) if (frames[f] == null) frames[f] = f > 0 ? frames[f - 1] : shots.findIndex((s) => s.kind === 'bg');
  const out = [];
  let cur = null;
  for (let f = 0; f < FRAMES; f += 1) {
    const idx = frames[f];
    if (!cur || cur.idx !== idx) {
      const s = shots[idx] || { kind: 'bg' };
      cur = Object.assign({}, s, { idx, f0: f, f1: f + 1 });
      out.push(cur);
    } else cur.f1 = f + 1;
  }
  const res = out.map(({ idx, ...s }) => Object.assign(s, { t0: s.f0 / FPS, t1: s.f1 / FPS, frames: s.f1 - s.f0, extra: 0, xk: 0 }));
  // A transition into shot i overlaps the last xk frames of shot i-1, so shot i-1 renders xk extra frames.
  res.forEach((s, i) => {
    const prev = res[i - 1];
    if (!s.xfade || !prev) return;
    const k = Math.min(Math.round(s.xfade.dur * FPS), prev.frames - 2, s.frames - 2);
    if (k >= 2) {
      s.xk = k;
      prev.extra = k;
    }
  });
  return res;
}

// ---------------------------------------------------------------------------------------------
// Media assignment
// ---------------------------------------------------------------------------------------------

/** Assigns clips/photos to footage shots. media: [{ kind, path, duration }] */
function assignMedia(shots, media) {
  const clips = media.filter((m) => m.kind === 'clip');
  const photos = media.filter((m) => m.kind === 'photo');
  // order: clips, with photos interleaved every third slot when both exist
  const order = [];
  if (clips.length && photos.length) {
    let ci = 0;
    let pi = 0;
    for (let i = 0; i < clips.length + photos.length; i += 1) {
      if ((i % 3 === 2 && pi < photos.length) || ci >= clips.length) order.push(photos[pi++]);
      else order.push(clips[ci++]);
    }
  } else order.push(...clips, ...photos);
  const uses = new Map();
  let k = 0;
  let prevGroupMedia = null;
  let prevGroup = null;
  const footage = shots.filter((s) => s.kind === 'footage');
  footage.forEach((s, i) => {
    let m;
    if (s.role === 'item' && prevGroup === s.group && prevGroupMedia) {
      m = prevGroupMedia; // a schedule block keeps "its own clip" across its cuts
    } else {
      m = order[k % order.length];
      k += 1;
      if (order.length > 1 && footage[i - 1] && footage[i - 1].media === m) {
        m = order[k % order.length];
        k += 1;
      }
    }
    prevGroup = s.group;
    prevGroupMedia = m;
    const n = uses.get(m) || 0;
    uses.set(m, n + 1);
    s.media = m;
    s.use = n;
    const d = (s.frames + (s.extra || 0)) / FPS;
    if (m.kind === 'clip') {
      const D = m.duration || 0;
      if (D && D < d + 0.35) {
        s.srcStart = 0;
        s.loop = true;
      } else {
        const offsets = [0, 1, -1, 2, -2, 3, -3];
        const off = offsets[n % offsets.length] * (d + 0.4);
        const center = (D || d + 1) / 2 + off;
        const lo = 0.15;
        const hi = Math.max(lo, (D || d + 1) - d - 0.15);
        s.srcStart = Math.round(Math.min(hi, Math.max(lo, center - d / 2)) * 1000) / 1000;
      }
    }
  });
  // zoom choreography
  let alt = 0;
  footage.forEach((s, idx) => {
    const prev = footage[idx - 1];
    if (s.role === 'hook' || s.role === 'title') s.zoom = { z0: 1.0, z1: 1.08, bump: 0, pan: 0 };
    else if (s.role === 'item' && prev && prev.role === 'item' && prev.group === s.group && prev.media === s.media) {
      // second cut inside one class block: a clear punch-in on the same clip
      s.zoom = { z0: 1.17, z1: 1.11, bump: 0.03, pan: 0 };
    } else if (s.role === 'item') s.zoom = { z0: 1.0, z1: 1.06, bump: 0.05, pan: 0 };
    else {
      s.zoom = alt % 2 === 0 ? { z0: 1.0, z1: 1.07, bump: 0.05, pan: 0 } : { z0: 1.08, z1: 1.01, bump: 0.04, pan: 0 };
      alt += 1;
    }
    if (s.media && s.media.kind === 'photo') {
      const dir = s.use % 2 === 0 ? 1 : -1;
      s.zoom = { z0: 1.04, z1: 1.16, bump: 0, pan: 0.035 * dir };
    }
  });
  return shots;
}

// ---------------------------------------------------------------------------------------------
// ffmpeg graph
// ---------------------------------------------------------------------------------------------

function q(s) {
  return `'${String(s).replace(/'/g, '')}'`;
}

/** Escapes a value for use as a filter option inside a filtergraph string. */
function escapeFilterValue(s) {
  const lvl1 = String(s).replace(/[\\':]/g, (c) => `\\${c}`);
  return lvl1.replace(/[\\'[\],;]/g, (c) => `\\${c}`);
}

function perspectiveExpr(z, frames) {
  const N = Math.max(1, frames - 1);
  const dz = z.z1 - z.z0;
  const Z = `(${z.z0}+${dz.toFixed(4)}*min(in/${N},1)${z.bump ? `+${z.bump}*exp(-in/3.2)` : ''})`;
  const CX = z.pan ? `(W/2+${(z.pan * -1).toFixed(4)}*W+${(z.pan * 2).toFixed(4)}*W*min(in/${N},1))` : '(W/2)';
  const CY = '(H/2)';
  const x0 = `${CX}-W/(2*${Z})`;
  const x1 = `${CX}+W/(2*${Z})`;
  const y0 = `${CY}-H/(2*${Z})`;
  const y1 = `${CY}+H/(2*${Z})`;
  return `perspective=x0=${q(x0)}:y0=${q(y0)}:x1=${q(x1)}:y1=${q(y0)}:x2=${q(x0)}:y2=${q(y1)}:x3=${q(x1)}:y3=${q(y1)}:interpolation=linear:eval=frame`;
}

/** Footage grade: gentle S-curve, saturation lift, a whisper of brand color in the shadows, vignette. */
function gradeChain(pal) {
  const s = 1.14;
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  const m = (a) => a.toFixed(4);
  const ccm = [
    `rr=${m(lr * (1 - s) + s)}:rg=${m(lg * (1 - s))}:rb=${m(lb * (1 - s))}`,
    `gr=${m(lr * (1 - s))}:gg=${m(lg * (1 - s) + s)}:gb=${m(lb * (1 - s))}`,
    `br=${m(lr * (1 - s))}:bg=${m(lg * (1 - s))}:bb=${m(lb * (1 - s) + s)}`,
  ].join(':');
  const b = A.parseHex(pal.brand);
  const avg = (b.r + b.g + b.b) / 3;
  const tint = (v) => Math.max(-0.06, Math.min(0.06, ((v - avg) / 255) * 0.08)).toFixed(3);
  return [
    "curves=master='0/0 0.12/0.085 0.5/0.52 0.86/0.9 1/1'",
    `colorchannelmixer=${ccm}`,
    `colorbalance=rs=${tint(b.r)}:gs=${tint(b.g)}:bs=${tint(b.b)}`,
    'vignette=angle=0.5',
  ].join(',');
}

function gradientSource(pal, frames, seed, t0 = 0) {
  const c0 = A.ffColor(pal.dark);
  const c1 = A.ffColor(pal.deep);
  const c2 = A.ffColor(pal.deep2);
  const dur = (frames / FPS + 0.5).toFixed(3);
  // The gradients source swaps any point outside its canvas for a random one, so the axis runs
  // through the centre and stops at the canvas edge. Its angle continues the source's slow rotation
  // (speed rad per frame) from the shot's start time, so consecutive background shots match.
  const gw = 270;
  const gh = 480;
  const speed = 0.0035;
  const th = Math.atan2(gh, gw) + Math.round(t0 * FPS) * speed;
  const cx = gw / 2;
  const cy = gh / 2;
  const co = Math.cos(th);
  const si = Math.sin(th);
  const L = Math.min(Math.abs(co) > 1e-6 ? (cx - 1) / Math.abs(co) : 1e9, Math.abs(si) > 1e-6 ? (cy - 1) / Math.abs(si) : 1e9);
  const px = (v) => Math.max(0, Math.min(gw - 1, Math.round(v)));
  const py = (v) => Math.max(0, Math.min(gh - 1, Math.round(v)));
  const pts = `x0=${px(cx - L * co)}:y0=${py(cy - L * si)}:x1=${px(cx + L * co)}:y1=${py(cy + L * si)}`;
  return `gradients=s=${gw}x${gh}:r=${FPS}:d=${dur}:c0=${c0}:c1=${c1}:c2=${c2}:n=3:${pts}:speed=${speed}:seed=${seed}`;
}

const sgn = (v) => (v < 0 ? `-${Math.abs(v).toFixed(4)}` : `+${v.toFixed(4)}`);

/** A scrim as an RGBA frame: 8x480 geq vertical profile (smoothstep edges), stretched to 1080x1920. */
function scrimSource(sc) {
  const k = 170; // half-width of the soft edges in px (about what libass \blur110 gives)
  const op = Math.round(255 * sc.opacity);
  const up = `clip((Y*4+2-${Math.round(sc.y0 - k)})/${2 * k}\\,0\\,1)`;
  const dn = `clip((Y*4+2-${Math.round(sc.y1 - k)})/${2 * k}\\,0\\,1)`;
  const a = `st(0\\,${up});st(1\\,${dn});${op}*ld(0)*ld(0)*(3-2*ld(0))*(1-ld(1)*ld(1)*(3-2*ld(1)))`;
  return `color=c=black:s=8x480:r=${FPS}:d=0.03,format=rgba,geq=r='0':g='0':b='0':a='${a}',scale=${W}:${H}:flags=bilinear`;
}

/**
 * A solid panel shot: the flat color plus its static slanted bands, composed once at half size,
 * scaled up and held for N frames (no per-frame work).
 */
function solidChains(s, N, lab) {
  const hw = W / 2;
  const hh = H / 2;
  const out = [`color=c=${A.ffColor(s.color)}:s=${hw}x${hh}:r=${FPS}:d=0.03,format=rgba[${lab}p0]`];
  let cur = `[${lab}p0]`;
  (s.bands || []).forEach((b, j) => {
    const bw = Math.ceil((b.w + b.skew) / 2) + 2;
    const c = A.parseHex(b.color);
    const left = `${b.skew}*(1-(Y+0.5)*2/${H})`;
    const a = `${Math.round(255 * b.opacity)}*clip(min((X+0.5)*2-${left}\\,${left}+${b.w}-(X+0.5)*2)/2+0.5\\,0\\,1)`;
    out.push(`color=c=black:s=${bw}x${hh}:r=${FPS}:d=0.03,format=rgba,geq=r='${c.r}':g='${c.g}':b='${c.b}':a='${a}'[${lab}b${j}]`);
    out.push(`${cur}[${lab}b${j}]overlay=x=${Math.round(b.x / 2)}:y=0:format=rgb[${lab}p${j + 1}]`);
    cur = `[${lab}p${j + 1}]`;
  });
  out.push(`${cur}scale=${W}:${H}:flags=bilinear,format=rgb24,setsar=1,loop=loop=${Math.max(0, N - 1)}:size=1:start=0,setpts=N/${FPS}/TB,trim=end_frame=${N},setpts=PTS-STARTPTS[${lab}]`);
  return out;
}

/** A generated-background shot: the drifting gradient plus soft brand glows, all at quarter size. */
function bgChains(pal, s, N, lab, seed, st = '') {
  const glows = s.glows || [];
  if (!glows.length) return [`${gradientSource(pal, N, seed, s.t0)},scale=${W}:${H}:flags=bicubic${st},format=rgb24,setsar=1,trim=end_frame=${N},setpts=PTS-STARTPTS[${lab}]`];
  const out = [`${gradientSource(pal, N, seed, s.t0)},format=rgba[${lab}g0]`];
  let cur = `[${lab}g0]`;
  glows.forEach((g, j) => {
    const sg = 30; // softness (quarter-size px)
    const R = g.r / 4;
    const S = Math.ceil(2 * (R + 2 * sg)) + 2;
    const c = S / 2;
    const col = A.parseHex(g.color);
    const a = `st(0\\,clip((${R + 2 * sg}-hypot(X+0.5-${c}\\,Y+0.5-${c}))/${4 * sg}\\,0\\,1));${Math.round(255 * g.opacity)}*ld(0)*ld(0)*(3-2*ld(0))`;
    out.push(`color=c=black:s=${S}x${S}:r=${FPS}:d=0.03,format=rgba,geq=r='${col.r}':g='${col.g}':b='${col.b}':a='${a}'[${lab}o${j}]`);
    const dt = Math.max(0.001, g.t1 - g.t0);
    const T = `(t${sgn(s.t0 - g.t0)})`;
    const x = `(${g.from[0].toFixed(2)}${sgn(g.to[0] - g.from[0])}*${T}/${dt.toFixed(4)})/4-${c}`;
    const y = `(${g.from[1].toFixed(2)}${sgn(g.to[1] - g.from[1])}*${T}/${dt.toFixed(4)})/4-${c}`;
    const en = `between(t\\,${(g.t0 - s.t0 - 0.001).toFixed(4)}\\,${(g.t1 - s.t0 - 0.001).toFixed(4)})`;
    out.push(`${cur}[${lab}o${j}]overlay=x='${x}':y='${y}':eval=frame:format=rgb:enable='${en}'[${lab}g${j + 1}]`);
    cur = `[${lab}g${j + 1}]`;
  });
  out.push(`${cur}scale=${W}:${H}:flags=bicubic${st},format=rgb24,setsar=1,trim=end_frame=${N},setpts=PTS-STARTPTS[${lab}]`);
  return out;
}

/**
 * Builds the ffmpeg argument list. paths: { ass, fontsDir, out }
 */
function buildArgs(shots, pal, media, opts) {
  const { assPath, fontsDir, outPath, logo, audio, preset = 'veryfast', crf = 18 } = opts;
  // swscale runs on one thread unless told otherwise (ffmpeg 5.0+ has the option): the full-size
  // scales and color conversions are the slowest single-threaded steps of the graph.
  const st = opts.scaleThreads ? ':threads=0' : '';
  const inputs = [];
  const chains = [];
  const labels = [];
  let inIdx = 0;
  const grade = gradeChain(pal);
  // ",[scrim overlay]," spliced into a footage chain (or just ",")
  const withScrim = (s, lab) => (s.scrim ? `[${lab}f];${scrimSource(s.scrim)}[${lab}m];[${lab}f][${lab}m]overlay=format=rgb,format=rgb24,` : ',');
  shots.forEach((s, i) => {
    const lab = `s${i}`;
    const N = s.frames + (s.extra || 0);
    if (s.kind === 'footage' && s.media && s.media.kind === 'clip') {
      const d = (N / FPS + 0.35).toFixed(3);
      if (s.loop) inputs.push('-stream_loop', '-1', '-t', d, '-i', s.media.path);
      else inputs.push('-ss', String(s.srcStart || 0), '-t', d, '-i', s.media.path);
      const cm = s.media.matrix || 'bt709';
      // Low-res sources (a 720p landscape clip is only 405 px wide once cropped to 9:16) get a
      // light unsharp mask at source size before the lanczos upscale.
      const cropW = s.media.width && s.media.height ? Math.min(s.media.width, (s.media.height * 9) / 16) : 0;
      const sharpen = !cropW || W / cropW > 1.3 ? 'unsharp=5:5:0.6:5:5:0,' : '';
      chains.push(
        `[${inIdx}:v]setpts=PTS-STARTPTS,fps=${FPS},` +
          "crop=w='trunc(min(iw\\,ih*9/16)/2)*2':h='trunc(min(ih\\,iw*16/9)/2)*2'," +
          `scale=w='trunc(min(iw\\,1080)/2)*2':h=-2:flags=bicubic${st},` +
          `${perspectiveExpr(s.zoom, N)},${sharpen}` +
          `scale=w=iw:h=ih:in_color_matrix=${cm}:in_range=auto${st},format=rgb24,${grade},` +
          `scale=${W}:${H}:flags=lanczos${st},setsar=1${withScrim(s, lab)}tpad=stop_mode=clone:stop_duration=2,trim=end_frame=${N},setpts=PTS-STARTPTS[${lab}]`,
      );
      inIdx += 1;
    } else if (s.kind === 'footage' && s.media && s.media.kind === 'photo') {
      // A still comes in at 25 fps (time base 1/25): it gets a 1/30 time base before its frames are
      // numbered, or the shot's cuts drift a frame or two off the text.
      inputs.push('-i', s.media.path);
      chains.push(
        `[${inIdx}:v]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,format=gbrp,${grade},` +
          `loop=loop=${N + 5}:size=1:start=0,settb=1/${FPS},setpts=N,${perspectiveExpr(s.zoom, N)},format=rgb24${withScrim(s, lab)}trim=end_frame=${N},setpts=PTS-STARTPTS[${lab}]`,
      );
      inIdx += 1;
    } else if (s.kind === 'solid') {
      chains.push(...solidChains(s, N, lab));
    } else {
      chains.push(...bgChains(pal, s, N, lab, 7 + i, st));
    }
    labels.push(`[${lab}]`);
  });
  // Sparse transitions: shots with xk > 0 are joined to the previous piece with xfade, the rest
  // are concatenated. Each xfade eats exactly the extra frames the previous shot rendered.
  const pieces = [];
  let pieceLen = 0;
  shots.forEach((s, i) => {
    const len = s.frames + (s.extra || 0);
    if (s.xk && pieces.length) {
      const out = `[x${i}]`;
      const off = (pieceLen - s.xk) / FPS;
      chains.push(`${pieces[pieces.length - 1]}${labels[i]}xfade=transition=${s.xfade.type}:duration=${(s.xk / FPS).toFixed(4)}:offset=${off.toFixed(4)}${out}`);
      pieces[pieces.length - 1] = out;
      pieceLen = pieceLen - s.xk + len;
    } else {
      pieces.push(labels[i]);
      pieceLen = len;
    }
  });
  chains.push(`${pieces.join('')}concat=n=${pieces.length}:v=1:a=0,format=rgb24[base]`);
  let cur = '[base]';
  // Logo on the end card
  if (logo) {
    const li = inIdx;
    if (logo.svg) inputs.push('-width', String(logo.renderW || 1200), '-height', String(logo.renderH || 1200), '-keep_ar', '1');
    inputs.push('-i', logo.path);
    inIdx += 1;
    let lc = `[${li}:v]scale=w=${logo.w}:h=${logo.h}:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba`;
    if (logo.tile) {
      lc += `,pad=w=${logo.w}:h=${logo.h}:x=(ow-iw)/2:y=(oh-ih)/2:color=${logo.tile}@1`;
      lc += `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip((${logo.radius}-hypot(max(abs(X-W/2)-(W/2-${logo.radius}),0),max(abs(Y-H/2)-(H/2-${logo.radius}),0))+0.5),0,1)'`;
    } else if (logo.round) {
      lc += `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip((${logo.radius}-hypot(max(abs(X-W/2)-(W/2-${logo.radius}),0),max(abs(Y-H/2)-(H/2-${logo.radius}),0))+0.5),0,1)'`;
    }
    const t = logo.t;
    lc += `,loop=loop=${FRAMES}:size=1:start=0,setpts=N/${FPS}/TB,fade=t=in:st=${t.toFixed(3)}:d=0.22:alpha=1[lg]`;
    chains.push(lc);
    const yExpr = `${logo.y}+56*pow(1-min(max((t-${t.toFixed(3)})/0.38\\,0)\\,1)\\,3)`;
    chains.push(`${cur}[lg]overlay=x='(${logo.x * 2}+${logo.w}-w)/2':y='${yExpr}+(${logo.h}-h)/2':format=rgb:eval=frame:enable='gte(t\\,${(t - 0.01).toFixed(3)})'[lgo]`);
    cur = '[lgo]';
  }
  // Fine static grain on the generated-background stretches only: it hides 8-bit banding in the
  // dark gradients and glows. (Footage has its own grain; temporal grain would triple the file size.)
  const grain = [];
  for (const s of shots) {
    if (s.kind !== 'bg' && s.kind !== 'solid') continue;
    const last = grain[grain.length - 1];
    if (last && Math.abs(last[1] - s.t0) < 1e-6) last[1] = s.t1;
    else grain.push([s.t0, s.t1]);
  }
  let grainFilter = '';
  if (grain.length) {
    const full = grain.length === 1 && grain[0][0] <= 0 && grain[0][1] >= DURATION - 1e-6;
    const en = grain.map(([a, b]) => `between(t\\,${(a - 0.001).toFixed(3)}\\,${(b - 0.001).toFixed(3)})`).join('+');
    grainFilter = full ? 'noise=c0s=6,' : `noise=c0s=6:enable='${en}',`;
  }
  chains.push(
    `${cur}ass=filename=${escapeFilterValue(assPath)}:fontsdir=${escapeFilterValue(fontsDir)},` +
      `scale=${W}:${H}:out_color_matrix=bt709:out_range=tv:flags=bicubic${st},format=yuv420p,` +
      `${grainFilter}setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[vout]`,
  );
  // Audio
  let aLabel = '[aout]';
  if (audio.kind === 'music') {
    inputs.push('-i', audio.path);
    chains.push(
      `[${inIdx}:a]atrim=0:${DURATION},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
        `apad=whole_dur=${DURATION},afade=t=in:st=0:d=0.03,afade=t=out:st=${DURATION - 0.5}:d=0.5,atrim=0:${DURATION}[aout]`,
    );
    inIdx += 1;
  } else if (audio.kind === 'beat') {
    chains.push(...beatGraph(audio.cues || {}));
  } else {
    chains.push(`anullsrc=r=48000:cl=stereo,atrim=0:${DURATION}[aout]`);
  }
  const args = ['-hide_banner', '-nostdin', '-y', ...inputs, '-filter_complex', chains.join(';\n'), '-map', '[vout]', '-map', aLabel];
  args.push(
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-maxrate', '20M', '-bufsize', '30M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', String(FPS), '-frames:v', String(FRAMES), '-g', '60',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-t', String(DURATION),
    '-movflags', '+faststart', outPath,
  );
  return { args, filter: chains.join(';\n') };
}

/** A small synthesized 120 BPM beat: kick, off-beat hats, clap on 2 and 4, sub pulse, riser + impacts. */
function beatGraph(cues) {
  const tb = 'mod(t,0.5)';
  const kick = `0.95*sin(2*PI*(46*${tb}+(118/26)*(1-exp(-26*${tb}))))*exp(-7.5*${tb})+0.25*sin(2*PI*1700*${tb})*exp(-260*${tb})`;
  const bassF = 'if(lt(mod(t,8),2),55,if(lt(mod(t,8),4),43.65,if(lt(mod(t,8),6),65.41,49)))';
  const bass = `if(gte(t,2),0.22*(sin(2*PI*2*${bassF}*t)+0.3*sin(2*PI*4*${bassF}*t))*min(1,${tb}*14)*exp(-3.2*${tb}),0)`;
  const impacts = (cues.impacts || []).filter((x) => x > 0.3);
  const boom = impacts.length
    ? impacts.map((x) => `if(between(t,${x},${x + 1.2}),0.55*sin(2*PI*(38*(t-${x})+(70/9)*(1-exp(-9*(t-${x})))))*exp(-3.4*(t-${x})),0)`).join('+')
    : '0';
  const end = DURATION;
  const gate = `if(lt(t,${end - 0.6}),1,max(0,(${end}-t)/0.6))`;
  const hat = `(random(0)*2-1)*(0.3*exp(-34*mod(t-0.25,0.5))+0.09*exp(-90*mod(t,0.125)))*if(lt(t,0.5),0,1)`;
  const clap = `(random(1)*2-1)*if(gte(t,2),0.62*exp(-21*mod(t-0.5,1))+0.25*exp(-60*mod(t-0.52,1)),0)`;
  const r = cues.riser;
  const riser = r ? `(random(2)*2-1)*if(between(t,${r[0]},${r[1]}),0.33*pow((t-${r[0]})/${r[1] - r[0]},2.2),0)` : '0';
  return [
    `aevalsrc=exprs='(${kick}+${bass}+${boom})*${gate}':s=48000:d=${DURATION},lowpass=f=9000[bk]`,
    `aevalsrc=exprs='${hat}*${gate}':s=48000:d=${DURATION},highpass=f=7200,highpass=f=7200[bh]`,
    `aevalsrc=exprs='${clap}*${gate}':s=48000:d=${DURATION},bandpass=f=1700:width_type=q:w=0.8,aecho=0.8:0.6:23|41:0.35|0.22[bc]`,
    `aevalsrc=exprs='${riser}':s=48000:d=${DURATION},highpass=f=1400,lowpass=f=9000[br]`,
    `[bk][bh][bc][br]amix=inputs=4:normalize=0:weights='1 0.55 0.75 0.6',volume=0.9,alimiter=limit=0.9:attack=4:release=60:level=disabled,` +
      `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=0:${DURATION}[aout]`,
  ];
}

// ---------------------------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------------------------

/**
 * Pure planning step (no ffmpeg, no writes): validates props, resolves the template (falling back
 * to the animated background when a footage template has no usable footage), lays out the ASS
 * script and builds the ffmpeg arguments.
 *
 * opts.media: { [path]: { ok, duration, matrix } } from probing. Without it, files are checked
 * with fs.existsSync and durations are unknown (segments start at the clip's 0.15 s).
 * opts.logo: { ok, hasAlpha, darkness } for props.gym.logo (from analyzeLogo), optional.
 */
function buildPlan(rawProps, opts = {}) {
  const { props, warnings } = normalizeProps(rawProps);
  const media = opts.media || null;
  const known = (p) => {
    if (media) return !!(media[p] && media[p].ok);
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  };
  const items = [];
  for (const p of props.clips) {
    if (!VIDEO_EXT.test(p) && IMAGE_EXT.test(p)) {
      if (known(p)) items.push({ kind: 'photo', path: p });
      else warnings.push(`Clip not found or unreadable, skipped: ${path.basename(p)}`);
      continue;
    }
    if (known(p)) {
      const mi = (media && media[p]) || {};
      items.push({ kind: 'clip', path: p, duration: mi.duration || 0, matrix: mi.matrix || null, width: mi.width || 0, height: mi.height || 0 });
    }
    else warnings.push(`Clip not found or unreadable, skipped: ${path.basename(p)}`);
  }
  for (const p of props.photos) {
    if (known(p)) items.push({ kind: VIDEO_EXT.test(p) ? 'clip' : 'photo', path: p, duration: media && media[p] ? media[p].duration : 0 });
    else warnings.push(`Photo not found or unreadable, skipped: ${path.basename(p)}`);
  }
  const requested = props.template;
  let fallback = false;
  if (requested !== 'hype' && !items.length) {
    fallback = true;
    const given = props.clips.length + props.photos.length;
    warnings.push(given
      ? `The "${requested}" style needs clips or photos for footage and none of the ${given} given were usable, so it uses the animated brand background.`
      : `No clips or photos, so the "${requested}" Reel uses the animated brand background (it needs clips or photos for footage).`);
  }
  const pal = palette(props.gym.colors.primary, props.gym.colors.accent);

  // Logo box (size on the end card)
  let logoBox = null;
  if (props.gym.logo) {
    const li = opts.logo || (media && media[props.gym.logo]) || null;
    const ok = li ? li.ok : known(props.gym.logo) && LOGO_EXT.test(props.gym.logo);
    if (ok) {
      const aspect = li && li.width && li.height ? li.width / li.height : 1;
      let w;
      let h;
      if (aspect >= 1) {
        w = Math.min(520, Math.round(240 * aspect));
        h = Math.round(w / aspect);
      } else {
        h = 240;
        w = Math.round(h * aspect);
      }
      h = Math.max(80, Math.min(240, h));
      w = Math.max(80, Math.min(560, w));
      const needsTile = li ? !li.hasAlpha || li.darkness > 0.6 : false;
      const pad = needsTile ? 34 : 0;
      logoBox = {
        path: props.gym.logo,
        svg: /\.svg$/i.test(props.gym.logo),
        w: (w + pad * 2) & ~1,
        h: (h + pad * 2) & ~1,
        tile: li && li.hasAlpha && li.darkness > 0.6 ? A.ffColor('#FFFFFF') : null,
        round: li ? !li.hasAlpha : false,
        radius: 28,
        renderW: 1200,
        renderH: 1200,
      };
      if (logoBox.round && !logoBox.tile) {
        logoBox.w = w & ~1;
        logoBox.h = h & ~1;
      }
    } else warnings.push(`Logo not found or unreadable, skipped: ${path.basename(props.gym.logo)}`);
  }

  const tplProps = Object.assign({}, props, { template: requested });
  const { doc, shots, posterTime, cues } = buildTimeline(tplProps, pal, { footage: !fallback && items.length > 0, logoBox });
  if (items.length && requested !== 'hype') assignMedia(shots, items);
  else shots.forEach((s) => {
    if (s.kind === 'footage') Object.assign(s, { kind: 'bg', glows: [] });
  });

  let audio = { kind: 'silent' };
  if (props.music) {
    const ok = media ? media[props.music] && media[props.music].ok && media[props.music].hasAudio !== false : known(props.music);
    if (ok) audio = { kind: 'music', path: props.music };
    else warnings.push(`Music not found or unreadable, skipped: ${path.basename(props.music)}`);
  }
  if (audio.kind === 'silent' && props.beat) audio = { kind: 'beat', cues };

  const assText = doc.toString();
  const { args, filter } = buildArgs(shots, pal, items, {
    assPath: opts.assPath || 'reel.ass',
    fontsDir: opts.fontsDir || FONTS_DIR,
    outPath: opts.outPath || 'reel.mp4',
    logo: logoBox,
    audio,
    preset: opts.preset,
    crf: opts.crf,
    scaleThreads: !!opts.scaleThreads,
  });
  return {
    template: requested,
    fallback,
    durationSec: DURATION,
    fps: FPS,
    size: { width: W, height: H },
    posterTime,
    palette: pal,
    props,
    shots: shots.map((s) => ({ t0: s.t0, t1: s.t1, kind: s.kind, role: s.role, media: s.media ? s.media.path : null, srcStart: s.srcStart, transition: s.xk ? s.xfade.type : 'cut' })),
    logo: logoBox ? { path: logoBox.path, x: logoBox.x, y: logoBox.y, w: logoBox.w, h: logoBox.h, t: logoBox.t } : null,
    audio: audio.kind,
    ass: assText,
    filter,
    args,
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------
// Running ffmpeg
// ---------------------------------------------------------------------------------------------

function abortError() {
  const e = new Error('Render aborted');
  e.name = 'AbortError';
  return e;
}

function run(cmd, args, { signal, env, cwd, onStdout, timeoutMs, allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(abortError());
      return;
    }
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: env || process.env, cwd, windowsHide: true });
    } catch (err) {
      reject(err);
      return;
    }
    let stderr = '';
    let stdout = '';
    let done = false;
    const onAbort = () => {
      if (!done) child.kill('SIGKILL');
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGKILL'), timeoutMs) : null;
    child.stdout.on('data', (d) => {
      const s = d.toString();
      if (onStdout) onStdout(s);
      else if (stdout.length < 1e6) stdout += s;
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 2e5) stderr = stderr.slice(-1e5);
    });
    child.on('error', (err) => {
      done = true;
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err.code === 'ENOENT' ? new Error(`ffmpeg not found (${cmd}). Install ffmpeg with libass, librsvg and libx264.`) : err);
    });
    child.on('close', (code) => {
      done = true;
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (signal && signal.aborted) reject(abortError());
      else if (code === 0 || allowFail) resolve({ code, stdout, stderr });
      else {
        const e = new Error(`ffmpeg exited with code ${code}: ${stderr.trim().split('\n').slice(-6).join(' | ')}`);
        e.stderr = stderr;
        reject(e);
      }
    });
  });
}

/** Reads duration / size / color matrix / audio presence from `ffmpeg -i` (no ffprobe needed). */
async function probe(ffmpeg, file, signal) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    if (!fs.statSync(file).isFile()) return { ok: false };
  } catch {
    return { ok: false };
  }
  try {
    const { stderr } = await run(ffmpeg, ['-hide_banner', '-nostdin', '-i', file], { signal, allowFail: true, timeoutMs: 20000 });
    const dm = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const duration = dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0;
    const vs = stderr.match(/Stream #\d+:\d+[^\n]*?: Video: ([^\n]+)/);
    const as = /Stream #\d+:\d+[^\n]*?: Audio:/.test(stderr);
    if (!vs && !as) return { ok: false };
    let width = 0;
    let height = 0;
    let matrix = null;
    let hasAlpha = false;
    if (vs) {
      const sz = vs[1].match(/\b(\d{2,5})x(\d{2,5})\b/);
      if (sz) {
        width = +sz[1];
        height = +sz[2];
      }
      if (/bt470bg|smpte170m|bt601/.test(vs[1])) matrix = 'bt601';
      else if (/bt2020/.test(vs[1])) matrix = 'bt2020';
      else matrix = 'bt709';
      hasAlpha = /\b(rgba|bgra|argb|abgr|ya8|ya16|yuva\w*|gbrap\w*|pal8|rgba64\w*|monob)\b/.test(vs[1]);
      const rot = stderr.match(/rotation of (-?\d+(?:\.\d+)?) degrees/);
      if (rot && Math.abs(Math.round(+rot[1])) % 180 === 90) [width, height] = [height, width];
    }
    return { ok: true, duration, width, height, matrix, hasVideo: !!vs, hasAudio: as, hasAlpha };
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return { ok: false };
  }
}

/** Logo check: decodes a 24x24 RGBA thumbnail to learn transparency and how dark the mark is. */
async function analyzeLogo(ffmpeg, file, signal) {
  const info = await probe(ffmpeg, file, signal);
  if (!info.ok || !info.hasVideo) return { ok: false };
  const pre = /\.svg$/i.test(file) ? ['-width', '256', '-height', '256', '-keep_ar', '1'] : [];
  try {
    const chunks = [];
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...pre, '-i', file, '-frames:v', '1', '-vf', 'scale=24:24:flags=area,format=rgba', '-f', 'rawvideo', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] });
      const kill = () => child.kill('SIGKILL');
      if (signal) signal.addEventListener('abort', kill, { once: true });
      child.stdout.on('data', (d) => chunks.push(d));
      child.on('error', reject);
      child.on('close', (code) => {
        if (signal) signal.removeEventListener('abort', kill);
        if (signal && signal.aborted) reject(abortError());
        else if (code === 0) resolve();
        else reject(new Error('logo decode failed'));
      });
    });
    const raw = Buffer.concat(chunks);
    if (raw.length < 24 * 24 * 4) return { ok: false };
    let cover = 0;
    let lum = 0;
    let transparent = 0;
    for (let i = 0; i < raw.length; i += 4) {
      const a = raw[i + 3] / 255;
      if (a < 0.5) transparent += 1;
      cover += a;
      lum += a * A.luminance({ r: raw[i], g: raw[i + 1], b: raw[i + 2] });
    }
    const n = raw.length / 4;
    const hasAlpha = transparent / n > 0.04;
    const meanLum = cover ? lum / cover : 1;
    return { ok: true, width: info.width || 512, height: info.height || 512, hasAlpha, darkness: 1 - Math.min(1, meanLum / 0.35) };
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return { ok: false };
  }
}

const swsThreadsCache = new Map();
/** True when this ffmpeg's scale filter takes a threads option (FFmpeg 5.0 and later). */
async function swscaleThreads(ffmpeg, signal) {
  if (swsThreadsCache.has(ffmpeg)) return swsThreadsCache.get(ffmpeg);
  try {
    const out = await run(ffmpeg, ['-hide_banner', '-nostdin', '-h', 'filter=scale'], { signal, allowFail: true, timeoutMs: 15000 });
    const ok = /^\s*-threads\s/m.test(`${out.stdout}\n${out.stderr}`);
    swsThreadsCache.set(ffmpeg, ok);
    return ok;
  } catch {
    return false; // not cached: a missing ffmpeg or an abort is reported by the render itself
  }
}

function fontsConf(fontsDir, cacheDir) {
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n  <dir>${x(fontsDir)}</dir>\n  <cachedir>${x(cacheDir)}</cachedir>\n</fontconfig>\n`;
}

/**
 * Renders a spec reel.
 * @param {object} props  see README.md
 * @param {object} options { outPath, tmpDir, ffmpeg='ffmpeg', signal, onProgress, posterPath,
 *                           preset='veryfast', crf=18, keepTemp=false }
 * @returns {Promise<{ video, poster, durationSec, template, warnings }>}
 */
async function renderSpecReel(props, options = {}) {
  const ffmpeg = options.ffmpeg || 'ffmpeg';
  const signal = options.signal;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  if (!options.outPath) throw new Error('renderSpecReel needs options.outPath');
  const outPath = path.resolve(options.outPath);
  const posterPath = path.resolve(options.posterPath || outPath.replace(/\.[a-z0-9]+$/i, '') + '.png');
  const t0 = Date.now();
  const report = (phase, progress) => {
    if (onProgress) {
      try {
        onProgress({ phase, progress: Math.max(0, Math.min(1, progress)), elapsedMs: Date.now() - t0 });
      } catch {
        /* never let a progress callback break a render */
      }
    }
  };
  if (signal && signal.aborted) throw abortError();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const baseTmp = options.tmpDir || os.tmpdir();
  fs.mkdirSync(baseTmp, { recursive: true });
  const work = fs.mkdtempSync(path.join(baseTmp, 'specreel-'));
  const fontsDir = options.fontsDir || FONTS_DIR;
  try {
    report('probe', 0);
    const { props: norm } = normalizeProps(props);
    const files = [...new Set([...norm.clips, ...norm.photos, ...(norm.music ? [norm.music] : [])])];
    const media = {};
    let i = 0;
    const queue = files.slice();
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const f = queue.shift();
        media[f] = await probe(ffmpeg, f, signal);
        i += 1;
        report('probe', i / Math.max(1, files.length));
      }
    });
    await Promise.all(workers);
    const logo = norm.gym.logo ? await analyzeLogo(ffmpeg, norm.gym.logo, signal) : null;
    const extraWarnings = [];
    if (!fs.existsSync(path.join(fontsDir, 'Anton-Regular.ttf'))) extraWarnings.push(`Fonts not found in ${fontsDir}; text uses fallback fonts.`);

    const assPath = path.join(work, 'reel.ass');
    const scaleThreads = await swscaleThreads(ffmpeg, signal);
    const plan = buildPlan(props, { media, logo, assPath, fontsDir, outPath, preset: options.preset, crf: options.crf, scaleThreads });
    fs.writeFileSync(assPath, plan.ass, 'utf8');
    const cacheDir = path.join(work, 'fc-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const confPath = path.join(work, 'fonts.conf');
    fs.writeFileSync(confPath, fontsConf(fontsDir, cacheDir), 'utf8');
    const env = Object.assign({}, process.env, { FONTCONFIG_FILE: confPath });
    const tmpOut = path.join(path.dirname(outPath), `.${path.basename(outPath)}.${process.pid}.${Date.now()}.part.mp4`);
    const args = plan.args.slice();
    args[args.length - 1] = tmpOut;
    args.splice(args.length - 1, 0, '-progress', 'pipe:1', '-nostats');
    report('render', 0);
    let buf = '';
    try {
      await run(ffmpeg, args, {
        signal,
        env,
        cwd: work,
        onStdout: (s) => {
          buf += s;
          const m = buf.match(/out_time_(?:us|ms)=(\d+)(?![\s\S]*out_time_(?:us|ms)=)/);
          if (m) report('render', +m[1] / 1e6 / DURATION);
          if (buf.length > 4096) buf = buf.slice(-1024);
        },
      });
      fs.renameSync(tmpOut, outPath);
    } finally {
      try {
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
      } catch {
        /* ignore */
      }
    }
    report('poster', 0.98);
    await run(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-ss', String(plan.posterTime), '-i', outPath, '-frames:v', '1', '-update', '1', posterPath], { signal });
    report('done', 1);
    return {
      video: outPath,
      poster: posterPath,
      durationSec: DURATION,
      template: plan.template,
      fallback: plan.fallback,
      warnings: extraWarnings.concat(plan.warnings),
      renderMs: Date.now() - t0,
    };
  } finally {
    if (!options.keepTemp) {
      try {
        fs.rmSync(work, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  renderSpecReel,
  buildPlan,
  TEMPLATES,
  normalizeProps,
  palette,
  classTime,
  keyWords,
  escapeFilterValue,
  probe,
  DURATION,
  FPS,
};
