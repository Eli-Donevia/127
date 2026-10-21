// Reel (animated, portfolio, for video editors): the editor's own sequence, open on the page.
//   Object:   the edit. A program monitor and under it the timeline: one clip per project on V1, named for the member's real projects, each with its
//             frame thumbnail and its waveform on A1, a ruler of real in-points and the playhead. Until the member adds
//             stills each project's frame is drawn to its caption (coffee, a workbench, a road at dawn, a product on a
//             sweep, an interview chair, a night market) over a night window as the neutral one.
//   Material: the edit bay. Dark: graphite panels and 1px seams at night. Light: the same bay with the blinds up, warm
//             grey panels with real shadows; the monitor stays a black glass rectangle in both. Chivo for the name and
//             the panels, Chivo Mono for everything the software would print (timecode, track names, durations).
//   One move: fade up from black (choreo intro 'develop'): the picture comes up out of black into focus like the first
//             frame of a cut, the name's words resolve one by one.
//   Moment:   scrolling scrubs the sequence. The bay holds on screen; the playhead runs across the clips (on a phone it
//             stays in the middle and the sequence slides under it, the way phone editors work), the monitor cuts to
//             each project as the playhead enters it and the timecode counts in real time.
//   Pop:      the member's colour is the light: the playhead (lit, a short bloom on dark, a 12% coloured shadow on
//             light), the selects and the in and out handles on the cut below. No neon: the frame is the colour. Buttons
//             are ink, never a coloured fill.
// Then the cut (a project's raw footage against the finished length, when the member wrote both: "6 hours of footage
// to 2 minutes"), turnaround as a schedule from their own day counts, rates as a plain sheet with what every edit
// comes with, who they cut for, their own words and an end slate. JavaScript off and reduced motion: the sequence
// is printed as an edit list (every project, its line and its link), the monitor on the first frame.
// The cut's in and out handles follow kokonutUI's Clip Trimmer (MIT, (c) 2025 kokonutUI, @dorianbaffier): the kept
// range framed by two handles, the cut dimmed.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { draftCopy } = require('../../copy');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const Art = require('../../art');

const id = 'reel';

// The page: graphite at night (own mode) and warm grey with the blinds up.
function tokens(p, mode) {
  if (mode === 'light') return { bg: '#e9e7e2' };
  const bg = color.mix('#121214', p.primary, 0.03);
  return { bg, dark: bg };
}

// ---------- facts ----------

const SEC = { h: 3600, hr: 3600, hour: 3600, m: 60, min: 60, minute: 60, s: 1, sec: 1, second: 1 };
const sec = (n, u) => parseFloat(n) * (SEC[u.toLowerCase().replace(/s$/, '')] || 0);
const DUR = /(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i;
// "6 hours of footage to 2 minutes", "3 hours to 24 minutes", "40 hours into an 11 minute film"
const CUT = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b(?:\s+of\s+[a-z]+)?\s+(?:to|into|down to)\s+(?:a\s+|an\s+)?(\d+(?:\.\d+)?)\s*-?\s*(hours?|minutes?|mins?|seconds?|secs?)\b/i;

function cutOf(w) {
  const m = CUT.exec(`${w.detail || ''}`);
  if (!m) return null;
  const raw = sec(m[1], m[2]), kept = sec(m[3], m[4]);
  return raw > kept && kept > 0 ? { raw, kept } : null;
}

// A project's finished length in seconds, from its line ("90 seconds", "2 minutes"); null when it doesn't say.
function lengthOf(w) {
  const cut = cutOf(w);
  if (cut) return cut.kept;
  const m = DUR.exec(`${w.detail || ''}`);
  return m ? sec(m[1], m[2]) : null;
}

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
// Timecode, HH:MM:SS:FF at 24 frames.
function tc(s) {
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}:${pad((s % 1) * 24)}`;
}
// Plain length: "6 h", "2 min", "90 s", "1 h 20 min".
function plain(s) {
  if (s >= 3600) return `${Math.floor(s / 3600)} h${s % 3600 ? ` ${Math.round((s % 3600) / 60)} min` : ''}`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} min`;
  if (s >= 120) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

// The sequence: each project a clip, its width by its length (log scaled so a 24 minute episode doesn't swallow a
// 60 second recap), its real in-point on the ruler.
function sequence(c) {
  const work = (c.work || []).slice(0, 9);
  let t = 0;
  const clips = work.map((w, i) => {
    const len = lengthOf(w);
    const s = len || 60;
    const clip = { ...w, i, len, t0: t, weight: 1 + Math.log2(1 + s / 45) };
    t += s;
    return clip;
  });
  const total = clips.reduce((a, b) => a + b.weight, 0) || 1;
  let x = 0;
  for (const k of clips) {
    k.a = x / total;
    x += k.weight;
    k.b = x / total;
    k.t1 = k.t0 + (k.len || 60);
  }
  return { clips, seconds: t };
}

// Turnaround: the member's lines that give a time ("First cut in 5 working days", "48 hours"), with days for the bar.
const DAYS = /(\d+(?:\.\d+)?)\s*(working |business )?(days?|weeks?|hours?)\b/i;
function turnaround(c) {
  return (c.included || [])
    .map((line) => {
      const m = DAYS.exec(line);
      if (!m) return null;
      const n = parseFloat(m[1]);
      const days = /week/i.test(m[3]) ? n * 7 : /hour/i.test(m[3]) ? n / 24 : n;
      return { line, days, label: `${m[1]} ${m[2] || ''}${m[3]}`.replace(/\s+/g, ' ') };
    })
    .filter(Boolean)
    .slice(0, 5);
}
const extras = (c, timed) => (c.included || []).filter((l) => !timed.some((t) => t.line === l));

// The member's own words only: the drafted portfolio about repeats the hero.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length || /^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'portfolio').about ? [] : paras;
}

// What each drawn frame shows, for its alt text while a slot is still drawn (never "a frame from" the member's work).
const DRAWN = { window: 'a city at night through a window', cup: 'a coffee cup on a table', bench: 'a workbench', road: 'a road at dawn', box: 'a product box', chair: 'an empty interview chair', lights: 'string lights at night' };

function slots(c) {
  const g = (c.profile && c.profile.gallery) || [];
  const work = (c.work || []).slice(0, 9);
  // A slot still drawn (no still in the pack, the member's own not in yet) says it is a drawing and what of.
  const drawn = (slot) => !Art.photo('reel', slot);
  const used = new Set();
  const scenes = work.map((w) => { const k = sceneOf(`${w.title} ${w.detail}`, used); used.add(k); return k; });
  const hd = drawn('hero');
  const out = [{ slot: 'hero', file: 'hero.jpg', w: 1600, h: 900, style: 'sweep', drawn: hd, alt: hd ? `A drawing of ${DRAWN.window}` : (c.profile && c.profile.hero) || `A frame from ${c.name}'s work` }];
  work.forEach((w, i) => {
    const d = drawn(`w${i + 1}`);
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 1600, h: 900, style: 'tile', drawn: d, alt: d ? `A drawing of ${DRAWN[scenes[i]] || DRAWN.window}` : [w.title, w.detail].filter(Boolean).join(', ') || g[i % Math.max(1, g.length)] || `${c.name}, recent work` });
  });
  return out;
}

function nav(c) {
  const timed = turnaround(c);
  return [
    (c.work || []).length && { label: 'Work', href: '#work' },
    (c.work || []).some(cutOf) && { label: 'The cut', href: '#cut' },
    timed.length && { label: 'Turnaround', href: '#turnaround' },
    c.services.some((s) => s.name) && { label: 'Rates', href: '#rates' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// ---------- drawings (the frames on the monitor, until the member adds stills) ----------

// Which scene a project's frame shows, from its words; a night window when nothing fits.
const SCENES = [
  ['cup', /\b(coffee|roast\w*|caf[eé]s?|espresso|tea|bakery|brunch)\b/],
  ['bench', /\b(wood\w*|carpent\w*|furniture|maker|workshop|craft|build\w*|tools?|diy)\b/],
  ['road', /\b(run\w*|race|marathon|cycl\w*|bike|road|travel|trip|car|drive|outdoor|hike|sport\w*|fitness|gym)\b/],
  ['box', /\b(product|launch|kit|unbox\w*|gear|tech|app|brand film|commercial|ad|ads)\b/],
  ['chair', /\b(documentar\w*|interview\w*|podcast|talking head|story|portrait|profile|founder)\b/],
  ['lights', /\b(event|market|night|concert|festival|party|wedding|music|club|bar|restaurant|food hall|recap)\b/],
];
function sceneOf(text, used) {
  const t = String(text || '').toLowerCase();
  const hit = SCENES.find(([k, re]) => re.test(t) && !used.has(k)) || SCENES.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'window';
}

const f1 = (v) => (Math.round(v * 10) / 10).toString();

// A graded film still: the scene, then a vignette and fine grain over it.
function still(Art, w, h, seed, scene, sky) {
  const r = Art.rng(seed);
  let defs = `<radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient><filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .07 0"/></filter><filter id="sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(w * 0.012)}"/></filter>`;
  let body = '';
  const S = SCENE[scene] || SCENE.window;
  const out = S(w, h, r, sky);
  defs += out.defs;
  body += out.body;
  body += `<rect width="${w}" height="${h}" fill="url(#vg)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`;
  return Art.svgDoc(w, h, defs, body);
}

const SCENE = {
  // A night window: the city at blue hour through a tall pane, a sill, the room dark.
  window(w, h, r) {
    let b = `<rect width="${w}" height="${h}" fill="#07090d"/>`;
    const x0 = w * 0.16, x1 = w * 0.84, y0 = h * 0.08, y1 = h * 0.8;
    let city = '';
    let x = x0;
    while (x < x1) {
      const bw = w * (0.03 + r() * 0.05), bh = h * (0.12 + r() * 0.42), by = y1 - bh;
      city += `<rect x="${f1(x)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" fill="#0b1018"/>`;
      for (let k = 0; k < 7; k++) if (r() < 0.55) city += `<rect x="${f1(x + bw * (0.15 + r() * 0.65))}" y="${f1(by + bh * (0.08 + r() * 0.8))}" width="${f1(w * 0.004)}" height="${f1(h * 0.008)}" fill="${r() < 0.7 ? '#e9b871' : '#a9c4e6'}" opacity="${(0.45 + r() * 0.5).toFixed(2)}"/>`;
      x += bw + w * 0.004;
    }
    b += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#sky)"/>${city}`;
    b += `<path d="M0 0H${w}V${h}H0Z M${x0} ${y0}V${y1}H${x1}V${y0}Z" fill="#050608" fill-rule="evenodd"/>`;
    b += `<rect x="${f1(w / 2 - w * 0.006)}" y="${y0}" width="${f1(w * 0.012)}" height="${f1(y1 - y0)}" fill="#050608"/><rect x="${x0}" y="${f1(h * 0.42)}" width="${f1(x1 - x0)}" height="${f1(h * 0.012)}" fill="#050608"/>`;
    b += `<rect x="${f1(x0 - w * 0.03)}" y="${f1(y1)}" width="${f1(x1 - x0 + w * 0.06)}" height="${f1(h * 0.03)}" fill="#151820"/><rect x="${f1(x0 - w * 0.03)}" y="${f1(y1)}" width="${f1(x1 - x0 + w * 0.06)}" height="${f1(h * 0.004)}" fill="#3a4258"/>`;
    return { defs: `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1730"/><stop offset=".62" stop-color="#1f3354"/><stop offset=".9" stop-color="#5a5468"/><stop offset="1" stop-color="#a97958"/></linearGradient>`, body: b };
  },
  // A cup on a dark table in window light, steam rising.
  cup(w, h) {
    const cx = w * 0.55, ty = h * 0.62;
    let b = `<rect width="${w}" height="${h}" fill="#140d09"/><rect y="${f1(ty)}" width="${w}" height="${f1(h - ty)}" fill="url(#tb)"/>`;
    b += `<path d="M0 0H${f1(w * 0.42)}L${f1(w * 0.3)} ${f1(ty)}H0Z" fill="#c9a27a" opacity=".1"/><path d="M${f1(w * 0.08)} ${f1(ty)}L${f1(w * 0.72)} ${f1(ty)}L${f1(w * 0.95)} ${h}H0V${f1(ty + h * 0.08)}Z" fill="#e6c49b" opacity=".12"/>`;
    b += `<ellipse cx="${f1(cx + w * 0.03)}" cy="${f1(h * 0.83)}" rx="${f1(w * 0.19)}" ry="${f1(h * 0.045)}" fill="#000" opacity=".55" filter="url(#sf)"/>`;
    b += `<ellipse cx="${f1(cx)}" cy="${f1(h * 0.8)}" rx="${f1(w * 0.17)}" ry="${f1(h * 0.05)}" fill="url(#sc)"/>`;
    const cw = w * 0.09, top = h * 0.5, bot = h * 0.78;
    b += `<path d="M${f1(cx + cw)} ${f1(top + h * 0.06)}c${f1(w * 0.05)} 0 ${f1(w * 0.05)} ${f1(h * 0.13)} ${f1(-w * 0.004)} ${f1(h * 0.14)}" fill="none" stroke="#d9cfc4" stroke-width="${f1(w * 0.009)}"/>`;
    b += `<path d="M${f1(cx - cw)} ${f1(top)}L${f1(cx - cw * 0.82)} ${f1(bot)}Q${f1(cx)} ${f1(bot + h * 0.03)} ${f1(cx + cw * 0.82)} ${f1(bot)}L${f1(cx + cw)} ${f1(top)}Z" fill="url(#cb)"/>`;
    b += `<ellipse cx="${f1(cx)}" cy="${f1(top)}" rx="${f1(cw)}" ry="${f1(h * 0.022)}" fill="#efe7de"/><ellipse cx="${f1(cx)}" cy="${f1(top + h * 0.003)}" rx="${f1(cw * 0.88)}" ry="${f1(h * 0.016)}" fill="#3b2115"/>`;
    b += `<g fill="none" stroke="#f4ece2" stroke-linecap="round" filter="url(#sf)" opacity=".35"><path d="M${f1(cx - w * 0.02)} ${f1(top - h * 0.03)}c${f1(-w * 0.03)} ${f1(-h * 0.08)} ${f1(w * 0.04)} ${f1(-h * 0.12)} ${f1(w * 0.005)} ${f1(-h * 0.24)}" stroke-width="${f1(w * 0.012)}"/><path d="M${f1(cx + w * 0.025)} ${f1(top - h * 0.04)}c${f1(w * 0.03)} ${f1(-h * 0.07)} ${f1(-w * 0.035)} ${f1(-h * 0.13)} ${f1(w * 0.01)} ${f1(-h * 0.26)}" stroke-width="${f1(w * 0.008)}"/></g>`;
    return { defs: `<linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2618"/><stop offset="1" stop-color="#160d08"/></linearGradient><linearGradient id="cb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf6ef"/><stop offset=".55" stop-color="#d8cfc5"/><stop offset="1" stop-color="#7d7268"/></linearGradient><radialGradient id="sc" cx=".4" cy=".35"><stop offset="0" stop-color="#f1e9df"/><stop offset="1" stop-color="#9c8f83"/></radialGradient>`, body: b };
  },
  // A workbench under a hanging lamp: a chisel across the grain, a block with a planed face, long curled shavings.
  bench(w, h) {
    const ty = h * 0.42;
    let b = `<rect width="${w}" height="${h}" fill="#0d0a08"/><path d="M0 ${f1(ty)}L${w} ${f1(ty - h * 0.06)}V${h}H0Z" fill="url(#wd)"/>`;
    for (let k = 0; k < 9; k++) {
      const y = ty + h * (0.04 + k * 0.07), d = h * (0.012 * Math.sin(k * 1.7));
      b += `<path d="M0 ${f1(y)}C${f1(w * 0.3)} ${f1(y - h * 0.01 + d)} ${f1(w * 0.6)} ${f1(y - h * 0.03 - d)} ${w} ${f1(y - h * 0.065)}" fill="none" stroke="#24150b" stroke-width="${f1(1 + (k % 3))}" opacity=".45"/>`;
    }
    b += `<ellipse cx="${f1(w * 0.52)}" cy="${f1(h * 0.66)}" rx="${f1(w * 0.46)}" ry="${f1(h * 0.3)}" fill="url(#pool)"/>`;
    // the block, its planed top catching the lamp
    const bx = w * 0.16, by = h * 0.47, bw = w * 0.3, bh = h * 0.16, dp = h * 0.07;
    b += `<path d="M${f1(bx)} ${f1(by + dp + bh)}L${f1(bx + bw)} ${f1(by + dp + bh - h * 0.02)}L${f1(bx + bw + w * 0.05)} ${f1(by + bh - h * 0.03)}" fill="none" stroke="#000" stroke-width="${f1(h * 0.03)}" opacity=".35" filter="url(#sf)"/>`;
    b += `<path d="M${f1(bx)} ${f1(by + dp)}L${f1(bx + bw)} ${f1(by + dp - h * 0.02)}V${f1(by + dp + bh - h * 0.02)}L${f1(bx)} ${f1(by + dp + bh)}Z" fill="url(#bk)"/>`;
    b += `<path d="M${f1(bx)} ${f1(by + dp)}L${f1(bx + w * 0.05)} ${f1(by)}L${f1(bx + bw + w * 0.05)} ${f1(by - h * 0.02)}L${f1(bx + bw)} ${f1(by + dp - h * 0.02)}Z" fill="#d9a46a"/>`;
    b += `<path d="M${f1(bx + bw)} ${f1(by + dp - h * 0.02)}L${f1(bx + bw + w * 0.05)} ${f1(by - h * 0.02)}V${f1(by + bh - h * 0.04)}L${f1(bx + bw)} ${f1(by + dp + bh - h * 0.02)}Z" fill="#5a3418"/>`;
    for (let k = 1; k < 5; k++) b += `<path d="M${f1(bx + w * 0.01 * k)} ${f1(by + dp - h * 0.012 * k)}L${f1(bx + bw + w * 0.01 * k)} ${f1(by + dp - h * 0.02 - h * 0.012 * k)}" stroke="#b9824c" stroke-width="1.5" opacity=".6"/>`;
    // the chisel: a turned handle, a ferrule, the blade with its bevel lit
    const cx = w * 0.56, cy = h * 0.74, ang = -14;
    b += `<g transform="translate(${f1(cx)} ${f1(cy)}) rotate(${ang})"><rect x="${f1(-w * 0.02)}" y="${f1(h * 0.035)}" width="${f1(w * 0.36)}" height="${f1(h * 0.02)}" fill="#000" opacity=".5" filter="url(#sf)"/><rect x="0" y="${f1(-h * 0.022)}" width="${f1(w * 0.15)}" height="${f1(h * 0.044)}" rx="${f1(h * 0.02)}" fill="url(#hd)"/><rect x="${f1(w * 0.15)}" y="${f1(-h * 0.018)}" width="${f1(w * 0.02)}" height="${f1(h * 0.036)}" fill="#a88a5a"/><path d="M${f1(w * 0.17)} ${f1(-h * 0.008)}H${f1(w * 0.27)}L${f1(w * 0.31)} ${f1(-h * 0.016)}V${f1(h * 0.016)}L${f1(w * 0.27)} ${f1(h * 0.008)}H${f1(w * 0.17)}Z" fill="url(#st)"/><path d="M${f1(w * 0.27)} ${f1(-h * 0.008)}L${f1(w * 0.31)} ${f1(-h * 0.016)}V${f1(-h * 0.004)}L${f1(w * 0.27)} 0Z" fill="#eef1f4" opacity=".85"/></g>`;
    // shavings: thin ribbons curling over themselves, lit on one edge
    [[0.62, 0.52, 1], [0.74, 0.58, 0.8], [0.84, 0.5, 0.65], [0.5, 0.88, 0.9]].forEach(([x, y, sc]) => {
      const X = w * x, Y = h * y, R = w * 0.035 * sc;
      b += `<path d="M${f1(X - R * 2.4)} ${f1(Y + R * 0.6)}C${f1(X - R)} ${f1(Y + R * 0.9)} ${f1(X + R * 1.2)} ${f1(Y + R * 0.4)} ${f1(X + R)} ${f1(Y - R * 0.5)}S${f1(X - R * 0.6)} ${f1(Y - R * 1.1)} ${f1(X - R * 0.5)} ${f1(Y - R * 0.1)}S${f1(X + R * 0.5)} ${f1(Y + R * 0.2)} ${f1(X + R * 0.3)} ${f1(Y - R * 0.4)}" fill="none" stroke="#c99459" stroke-width="${f1(R * 0.42)}" stroke-linecap="round"/><path d="M${f1(X - R * 2.4)} ${f1(Y + R * 0.5)}C${f1(X - R)} ${f1(Y + R * 0.8)} ${f1(X + R * 1.1)} ${f1(Y + R * 0.3)} ${f1(X + R * 0.9)} ${f1(Y - R * 0.5)}" fill="none" stroke="#f3d3a4" stroke-width="${f1(R * 0.12)}" stroke-linecap="round" opacity=".8"/>`;
    });
    return { defs: `<linearGradient id="wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2e18"/><stop offset="1" stop-color="#1f1209"/></linearGradient><radialGradient id="pool"><stop offset="0" stop-color="#ffd9a3" stop-opacity=".28"/><stop offset="1" stop-color="#ffd9a3" stop-opacity="0"/></radialGradient><linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6334"/><stop offset="1" stop-color="#4b2a12"/></linearGradient><linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8743d"/><stop offset=".45" stop-color="#7d4520"/><stop offset="1" stop-color="#3e200c"/></linearGradient><linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dce1"/><stop offset=".5" stop-color="#7d858d"/><stop offset="1" stop-color="#3a4046"/></linearGradient>`, body: b };
  },
  // A road at dawn running to the horizon, the low sun, cones on the shoulder.
  road(w, h) {
    const hy = h * 0.5;
    let b = `<rect width="${w}" height="${f1(hy)}" fill="url(#dw)"/><rect y="${f1(hy)}" width="${w}" height="${f1(h - hy)}" fill="#1b1a1d"/>`;
    b += `<circle cx="${f1(w * 0.62)}" cy="${f1(hy - h * 0.02)}" r="${f1(h * 0.05)}" fill="#ffe2b3"/><circle cx="${f1(w * 0.62)}" cy="${f1(hy - h * 0.02)}" r="${f1(h * 0.14)}" fill="#ffc98a" opacity=".22" filter="url(#sf)"/>`;
    b += `<path d="M0 ${f1(hy)}Q${f1(w * 0.2)} ${f1(hy - h * 0.07)} ${f1(w * 0.36)} ${f1(hy - h * 0.02)}T${f1(w * 0.7)} ${f1(hy - h * 0.03)}T${w} ${f1(hy - h * 0.01)}V${f1(hy)}Z" fill="#2a2430"/>`;
    b += `<path d="M${f1(w * 0.47)} ${f1(hy)}L${f1(w * 0.53)} ${f1(hy)}L${f1(w * 0.98)} ${h}H${f1(w * 0.02)}Z" fill="url(#rd)"/>`;
    for (let k = 0; k < 6; k++) {
      const t0 = Math.pow(k / 6, 1.8), t1 = Math.pow((k + 0.45) / 6, 1.8);
      const y0 = hy + (h - hy) * t0, y1 = hy + (h - hy) * t1;
      b += `<path d="M${f1(w * 0.5 - w * 0.004 * (1 + t0 * 3))} ${f1(y0)}L${f1(w * 0.5 + w * 0.004 * (1 + t0 * 3))} ${f1(y0)}L${f1(w * 0.5 + w * 0.004 * (1 + t1 * 3))} ${f1(y1)}L${f1(w * 0.5 - w * 0.004 * (1 + t1 * 3))} ${f1(y1)}Z" fill="#e8dcc2" opacity=".8"/>`;
    }
    [[0.2, 0.86, 1], [0.3, 0.7, 0.6], [0.37, 0.6, 0.35]].forEach(([x, y, s]) => {
      const cw = w * 0.025 * s, ch = h * 0.09 * s;
      b += `<path d="M${f1(w * x - cw)} ${f1(h * y)}L${f1(w * x)} ${f1(h * y - ch)}L${f1(w * x + cw)} ${f1(h * y)}Z" fill="#e2632d"/><path d="M${f1(w * x - cw * 0.55)} ${f1(h * y - ch * 0.45)}H${f1(w * x + cw * 0.55)}" stroke="#f3eee6" stroke-width="${f1(ch * 0.12)}"/>`;
    });
    return { defs: `<linearGradient id="dw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2440"/><stop offset=".6" stop-color="#7d5a6b"/><stop offset="1" stop-color="#f0a873"/></linearGradient><linearGradient id="rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d4a4c"/><stop offset=".25" stop-color="#2d2a2f"/><stop offset="1" stop-color="#121115"/></linearGradient>`, body: b };
  },
  // A product box on a paper sweep under a softbox.
  box(w, h) {
    let b = `<rect width="${w}" height="${h}" fill="url(#sw)"/><ellipse cx="${f1(w * 0.53)}" cy="${f1(h * 0.735)}" rx="${f1(w * 0.15)}" ry="${f1(h * 0.035)}" fill="#000" opacity=".6" filter="url(#sf)"/>`;
    const x = w * 0.4, y = h * 0.38, bw = w * 0.17, bh = h * 0.36, d = w * 0.07;
    b += `<path d="M${f1(x)} ${f1(y)}L${f1(x + d)} ${f1(y - d * 0.45)}L${f1(x + bw + d)} ${f1(y - d * 0.45)}L${f1(x + bw)} ${f1(y)}Z" fill="#d9d6d0"/>`;
    b += `<path d="M${f1(x + bw)} ${f1(y)}L${f1(x + bw + d)} ${f1(y - d * 0.45)}V${f1(y + bh - d * 0.45)}L${f1(x + bw)} ${f1(y + bh)}Z" fill="#6f6c68"/>`;
    b += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" fill="url(#bf)"/><rect x="${f1(x + bw * 0.12)}" y="${f1(y + bh * 0.62)}" width="${f1(bw * 0.4)}" height="${f1(h * 0.006)}" fill="#3b3936" opacity=".5"/>`;
    b += `<rect x="${f1(w * 0.12)}" y="${f1(h * 0.02)}" width="${f1(w * 0.22)}" height="${f1(h * 0.05)}" fill="#fff" opacity=".2" filter="url(#sf)"/>`;
    return { defs: `<radialGradient id="sw" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#5a5652"/><stop offset=".7" stop-color="#211f1d"/><stop offset="1" stop-color="#0c0b0a"/></radialGradient><linearGradient id="bf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bdb8b1"/><stop offset="1" stop-color="#8a857f"/></linearGradient>`, body: b };
  },
  // An interview chair under a key light against a dark backdrop.
  chair(w, h) {
    const cx = w * 0.46, fy = h * 0.8;
    let b = `<rect width="${w}" height="${h}" fill="url(#bd)"/><ellipse cx="${f1(cx)}" cy="${f1(fy)}" rx="${f1(w * 0.26)}" ry="${f1(h * 0.07)}" fill="#c9b9a6" opacity=".16" filter="url(#sf)"/>`;
    b += `<g stroke="#120f0d" stroke-width="${f1(w * 0.008)}" stroke-linecap="round"><path d="M${f1(cx - w * 0.07)} ${f1(h * 0.6)}L${f1(cx - w * 0.09)} ${f1(fy)}M${f1(cx + w * 0.07)} ${f1(h * 0.6)}L${f1(cx + w * 0.09)} ${f1(fy)}M${f1(cx - w * 0.03)} ${f1(h * 0.62)}L${f1(cx - w * 0.04)} ${f1(fy - h * 0.03)}M${f1(cx + w * 0.04)} ${f1(h * 0.62)}L${f1(cx + w * 0.05)} ${f1(fy - h * 0.03)}"/></g>`;
    b += `<path d="M${f1(cx - w * 0.1)} ${f1(h * 0.57)}Q${f1(cx)} ${f1(h * 0.53)} ${f1(cx + w * 0.1)} ${f1(h * 0.57)}L${f1(cx + w * 0.09)} ${f1(h * 0.62)}Q${f1(cx)} ${f1(h * 0.64)} ${f1(cx - w * 0.09)} ${f1(h * 0.62)}Z" fill="url(#lt)"/>`;
    b += `<path d="M${f1(cx - w * 0.08)} ${f1(h * 0.56)}Q${f1(cx - w * 0.09)} ${f1(h * 0.33)} ${f1(cx)} ${f1(h * 0.31)}Q${f1(cx + w * 0.09)} ${f1(h * 0.33)} ${f1(cx + w * 0.08)} ${f1(h * 0.56)}Z" fill="url(#lt)"/>`;
    b += `<g stroke="#2b2724" stroke-width="${f1(w * 0.004)}"><path d="M${f1(w * 0.86)} ${f1(h * 0.12)}V${f1(fy)}M${f1(w * 0.86)} ${f1(fy)}l${f1(-w * 0.04)} ${f1(h * 0.05)}M${f1(w * 0.86)} ${f1(fy)}l${f1(w * 0.04)} ${f1(h * 0.05)}"/></g><rect x="${f1(w * 0.8)}" y="${f1(h * 0.05)}" width="${f1(w * 0.12)}" height="${f1(h * 0.1)}" fill="#25211e"/><rect x="${f1(w * 0.8)}" y="${f1(h * 0.14)}" width="${f1(w * 0.12)}" height="${f1(h * 0.012)}" fill="#f2e3cc" opacity=".7"/>`;
    return { defs: `<radialGradient id="bd" cx=".62" cy=".3" r=".9"><stop offset="0" stop-color="#3b332d"/><stop offset=".6" stop-color="#141110"/><stop offset="1" stop-color="#070606"/></radialGradient><linearGradient id="lt" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98b5e"/><stop offset=".5" stop-color="#6a4426"/><stop offset="1" stop-color="#24150b"/></linearGradient>`, body: b };
  },
  // A night market: strings of warm bulbs over the stalls.
  lights(w, h, r) {
    let b = `<rect width="${w}" height="${h}" fill="url(#nm)"/>`;
    for (let s = 0; s < 2; s++) {
      const y0 = h * (0.1 + s * 0.16), sag = h * (0.08 + s * 0.05);
      let path = `M0 ${f1(y0)}Q${f1(w / 2)} ${f1(y0 + sag * 2)} ${w} ${f1(y0 - h * 0.03)}`;
      b += `<path d="${path}" fill="none" stroke="#1a1410" stroke-width="2"/>`;
      for (let k = 1; k < 10; k++) {
        const t = k / 10, x = w * t, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * (y0 - h * 0.03);
        const rr = h * (0.008 + s * 0.003);
        b += `<circle cx="${f1(x)}" cy="${f1(y + rr * 1.6)}" r="${f1(rr * 2.2)}" fill="#ffb35c" opacity=".1"/><circle cx="${f1(x)}" cy="${f1(y + rr * 1.6)}" r="${f1(rr)}" fill="#ffe1a8"/>`;
      }
    }
    for (let k = 0; k < 4; k++) {
      const x = w * (0.04 + k * 0.25), aw = w * 0.21, ay = h * (0.6 + r() * 0.05);
      b += `<path d="M${f1(x)} ${f1(ay)}L${f1(x + aw * 0.1)} ${f1(ay - h * 0.08)}H${f1(x + aw * 0.9)}L${f1(x + aw)} ${f1(ay)}Z" fill="${k % 2 ? '#3d1f17' : '#2a2b30'}"/><rect x="${f1(x + aw * 0.06)}" y="${f1(ay)}" width="${f1(aw * 0.88)}" height="${f1(h - ay)}" fill="#0d0b0a"/><rect x="${f1(x + aw * 0.1)}" y="${f1(ay + h * 0.02)}" width="${f1(aw * 0.8)}" height="${f1(h * 0.1)}" fill="#f4a85a" opacity=".22"/>`;
    }
    return { defs: `<linearGradient id="nm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090b14"/><stop offset=".7" stop-color="#1d1622"/><stop offset="1" stop-color="#2b1a14"/></linearGradient>`, body: b };
  },
};

function art(slot, ctx) {
  const ph = ctx.art.photo('reel', slot.slot);
  if (ph) return ph;
  const { c, seed, art: Art } = ctx;
  const cc = c || {};
  const work = (cc.work || []).slice(0, 9);
  const used = new Set();
  const scenes = work.map((w) => {
    const s = sceneOf(`${w.title} ${w.detail}`, used);
    used.add(s);
    return s;
  });
  if (slot.slot === 'hero') return still(Art, slot.w, slot.h, `${seed}:hero`, 'window');
  const m = /^w(\d+)$/.exec(slot.slot);
  if (!m) return null;
  return still(Art, slot.w, slot.h, `${seed}:${slot.slot}`, scenes[+m[1] - 1] || 'window');
}

// ---------- page ----------

// A clip's waveform on A1, drawn once from a seed: mirrored bars as one path.
function wave(seed, n = 28) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let d = '';
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const v = 0.15 + ((h >>> 8) % 1000) / 1000 * 0.75 * (0.6 + 0.4 * Math.sin(i * 0.7));
    const x = (i + 0.5) * (100 / n), y = Math.max(0.6, v * 9);
    d += `M${x.toFixed(1)} ${(10 - y).toFixed(1)}V${(10 + y).toFixed(1)}`;
  }
  return `<svg class="rl-wv" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}

function footer(c) {
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('');
  return `<footer class="rl-ftr"><div class="wrap rl-ftr-in">
<p class="rl-ftr-n">${esc(c.name)}${c.city && !c.online ? `<span>${esc(c.city)}</span>` : ''}</p>
${reach ? `<p class="rl-ftr-c">${reach}</p>` : ''}${P.socials(c, { cls: 'rl-ftr-so', size: 18 })}
<p class="rl-ftr-y">&copy; ${esc(c.year)}</p>
</div></footer>`;
}

function render(c) {
  const btn = (l, cls = '') => P.button(l, `btn btn-primary rl-btn${cls}`).replace('<a ', '<a data-mag ');
  const { clips, seconds } = sequence(c);
  const has = clips.length > 0;
  const own = ownAbout(c);
  const label = [c.whatShort || c.what, c.online ? '' : c.city].filter(Boolean).join(', ');
  const lead = c.tagline || (own.length ? '' : c.heroSub.replace(/^I'm [^.]+\.\s*/, ''));

  // The monitor: the opening frame, then each project's frame, cut to as the playhead enters its clip.
  const pics = [`<div class="rl-pic cur" data-k="-1">${P.img(c, 'hero', { eager: true })}</div>`, ...clips.map((k) => `<div class="rl-pic" data-k="${k.i}">${P.img(c, `w${k.i + 1}`)}</div>`)].join('');
  const monitor = `<div class="rl-mon" data-ci="subject"><div class="rl-glass" data-alive="0.2">${pics}<p class="rl-tc" aria-hidden="true"><span class="rl-tcv">${tc(0)}</span></p></div></div>`;

  // The sequence on V1 and A1, a clip per project (drawn, for the eye), and the projects themselves as a list: the bay
  // shows the current one under the timeline, the still page prints them all as an edit list.
  const seq = has
    ? `<div class="rl-tl">
<div class="rl-ruler" aria-hidden="true">${clips.map((k) => `<span style="left:${(k.a * 100).toFixed(2)}%">${tc(k.t0).slice(0, 8)}</span>`).join('')}</div>
<div class="rl-win"><div class="rl-track">
<div class="rl-seq" aria-hidden="true">${clips
        .map((k) => `<div class="rl-clip${k.i ? '' : ' cur'}" data-a="${k.a.toFixed(4)}" data-b="${k.b.toFixed(4)}" data-t0="${k.t0}" data-len="${k.len || 60}" style="--a:${k.a.toFixed(4)};--b:${k.b.toFixed(4)}"><div class="rl-blk"><span class="rl-n">${String(k.i + 1).padStart(2, '0')}</span><span class="rl-t">${esc(k.title)}</span>${k.len ? `<span class="rl-len">${esc(plain(k.len))}</span>` : ''}</div>${wave(`${k.title}${k.i}`)}</div>`)
        .join('')}</div>
</div><i class="rl-head" aria-hidden="true"></i></div>
<p class="rl-tracks" aria-hidden="true"><span>V1</span><span>A1</span></p>
</div>
<ol class="rl-list" aria-label="Projects">${clips
        .map((k) => `<li class="rl-item${k.i ? '' : ' cur'}"><h2 class="rl-it"><span class="rl-in2" aria-hidden="true">${String(k.i + 1).padStart(2, '0')}</span>${esc(k.title)}</h2>${k.detail ? `<p>${esc(k.detail)}</p>` : ''}${k.href ? `<a class="rl-watch" href="${esc(k.href)}" target="_blank" rel="noopener">${esc(k.linkLabel || 'Watch')}<span class="sr-only"> ${esc(k.title)}</span></a>` : ''}</li>`)
        .join('')}</ol>`
    : '';

  const hero = `<section class="rl-hero${has ? '' : ' solo'}" id="work" aria-labelledby="hero-title"${has ? ` data-sc data-total="${seconds}" style="--nc:${clips.length}"` : ''}>
<div class="rl-stage"${has ? ' data-sc-stage' : ''}>
<div class="rl-bay">
<div class="rl-head-in">
<p class="rl-what" data-ci="then">${esc(label)}</p><h1 class="rl-h1" id="hero-title" data-ci="head">${esc(c.name)}</h1>
${lead ? `<p class="rl-sub" data-ci="then">${esc(lead)}</p>` : ''}<div class="rl-ctas" data-ci="then">${btn(c.primary)}</div>
</div>
${monitor}${seq}
</div>
</div>
</section>`;

  // The cut: raw footage against the finished length, for every project whose line gives both.
  const cuts = clips.map((k) => ({ k, cut: cutOf(k) })).filter((x) => x.cut).slice(0, 3);
  const cutSec = cuts.length
    ? `<section class="rl-sec rl-cut" id="cut" aria-labelledby="cut-title"><div class="wrap">
<h2 class="rl-h2" id="cut-title">The cut</h2>
<ul class="rl-cuts">${cuts
        .map(({ k, cut }) => {
          const ratio = Math.round(cut.raw / cut.kept);
          // The kept seconds, spread through the footage as selects, each at least a hairline wide.
          const n = Math.max(3, Math.min(9, Math.round(Math.log2(ratio)) + 2));
          const sel = Array.from({ length: n }, (_, i) => `<i style="left:${(((i + 0.5) / n) * 100 + Math.sin(i * 2.3) * 3).toFixed(1)}%;--i:${i}"></i>`).join('');
          return `<li><h3 class="rl-h3">${esc(k.title)}</h3>
<div class="rl-trim" data-rv role="img" aria-label="${esc(`${plain(cut.raw)} of footage cut to ${plain(cut.kept)}`)}">
<div class="rl-raw"><span class="rl-lab">Footage <b>${esc(tc(cut.raw).slice(0, 8))}</b></span><div class="rl-strip">${sel}</div></div>
<svg class="rl-zoom" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10L45 0" pathLength="1"/><path d="M100 10L55 0" pathLength="1"/></svg>
<div class="rl-kept"><span class="rl-lab">Cut <b>${esc(tc(cut.kept).slice(0, 8))}</b></span><div class="rl-bar"><span class="rl-in"></span><span class="rl-out"></span></div></div>
</div>
<p class="rl-ratio">${esc(`${plain(cut.raw)} of footage, ${plain(cut.kept)} on screen: one second kept for every ${ratio}.`)}</p></li>`;
        })
        .join('')}</ul>
</div></section>`
    : '';

  // Turnaround: each timed line as a bar on a day ruler, longest last.
  const timed = turnaround(c);
  const maxD = Math.max(1, ...timed.map((t) => t.days));
  const turn = timed.length
    ? `<section class="rl-sec rl-turn" id="turnaround" aria-labelledby="turn-title"><div class="wrap rl-turn-in">
<h2 class="rl-h2" id="turn-title">Turnaround</h2>
<ol class="rl-days" data-rv>${timed.map((t) => `<li style="--d:${Math.max(0.04, t.days / maxD).toFixed(3)}"><p>${esc(t.line)}</p><span class="rl-dbar" aria-hidden="true"><span class="rl-blocks">${'<i></i>'.repeat(Math.max(1, Math.min(21, Math.ceil(t.days))))}</span><b>${esc(t.label)}</b></span></li>`).join('')}</ol>
</div></section>`
    : '';

  // Rates: a plain sheet, then what every edit comes with.
  const rates = c.services.filter((s) => s.name);
  const more = extras(c, timed);
  const rateSec = rates.length || more.length
    ? `<section class="rl-sec rl-rates" id="rates" aria-labelledby="rates-title"><div class="wrap rl-rates-in">
<h2 class="rl-h2" id="rates-title">Rates</h2>
<div>${rates.length ? `<ul class="rl-sheet">${rates.map((s) => `<li><h3 class="rl-rn">${esc(s.name)}</h3>${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${s.priceText ? `<span class="rl-price">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${more.length ? `<div class="rl-with"><h3 class="rl-side">With every edit</h3><ul>${more.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}</div>
</div></section>`
    : '';

  const clients = c.clients || [];
  const about = own.length || clients.length
    ? `<section class="rl-sec rl-about" id="about" aria-labelledby="about-title"><div class="wrap rl-about-in">
<h2 class="rl-side" id="about-title">${esc(c.owner && c.owner !== c.name ? `About ${c.owner}` : `About ${c.name}`)}</h2>
<div>${own.map((p, i) => `<p class="rl-say${i ? ' more' : ''}">${esc(p)}</p>`).join('')}
${clients.length ? `<div class="rl-credits"><h3 class="rl-side">Cut for</h3><ul>${clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>
</div></section>`
    : '';

  const reviews = c.reviews.length ? `<section class="rl-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="rl-h2" id="reviews-title">Kind words</h2><div class="rl-rv">${P.reviews(c)}</div></div></section>` : '';
  const asked = c.faq.length >= 2 ? `<section class="rl-sec" aria-labelledby="asked-title"><div class="wrap rl-asked"><h2 class="rl-h2" id="asked-title">Questions</h2><dl>${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  // The end slate: the last frame of the sequence, title-safe corners around the ask.
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean);
  const end = `<section class="rl-sec rl-end" id="contact" aria-labelledby="end-title"><div class="wrap">
<div class="rl-slate"><span class="rl-safe" aria-hidden="true"></span>
<h2 class="rl-end-t" id="end-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="rl-sub">${esc(c.ctaSub)}</p>` : ''}
<div class="rl-ctas">${c.primary.kind === 'form' ? '' : btn(c.primary)}</div>
${c.primary.kind === 'form' ? `<div class="rl-form">${P.form(c, { id: 'project', fields: ['name', 'email', { name: 'project', label: 'The project', type: 'textarea' }], submit: 'Send', subject: `A project for ${c.name}` })}</div>` : ''}
${reach.length ? `<p class="rl-reach">${reach.join('')}</p>` : ''}
</div></div></section>`;

  const m = motion();
  const header = P.header(c, { cls: 'rl-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm rl-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr');
  const body = [header, '<main id="main">', hero, cutSec, turn, rateSec, about, reviews, asked, end, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '4px', max: '84rem' } };
}

// The bay's own script: reads the scrub (--p on the section, set by the choreo runtime), cuts the monitor to the clip
// under the playhead, marks it current and runs the timecode in real time. Nothing runs without the runtime.
const JS = `(function(){var s=document.querySelector('.rl-hero[data-sc]');if(!s)return;
var cl=[].slice.call(s.querySelectorAll('.rl-clip')),it=[].slice.call(s.querySelectorAll('.rl-item')),pics=[].slice.call(s.querySelectorAll('.rl-pic')),tv=s.querySelector('.rl-tcv'),last=-2,lt='';
function p2(n){n=Math.floor(n);return n<10?'0'+n:''+n}
function tc(x){return p2(x/3600)+':'+p2(x%3600/60)+':'+p2(x%60)+':'+p2(x%1*24)}
function up(){var p=parseFloat(s.style.getPropertyValue('--p'))||0,k=-1,t=0;
cl.forEach(function(e,i){var a=+e.dataset.a,b=+e.dataset.b;if(p>=a-1e-4){k=i;t=+e.dataset.t0+Math.min(1,(p-a)/Math.max(1e-4,b-a))*+e.dataset.len}});
if(p<.004)k=-1;var c=k<0?0:k;
if(c!==last){last=c;cl.forEach(function(e,i){e.classList.toggle('cur',i===c)});it.forEach(function(e,i){e.classList.toggle('cur',i===c)});pics.forEach(function(e){e.classList.toggle('cur',+e.dataset.k===k)});s.classList.toggle('rl-cut1',true);setTimeout(function(){s.classList.remove('rl-cut1')},90)}
var v=tc(t);if(v!==lt){lt=v;tv.textContent=v}}
new MutationObserver(up).observe(s,{attributes:true,attributeFilter:['style']});up()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Reel Display Fallback';font-weight:700 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:102.8%;ascent-override:91.4%;descent-override:24.3%;line-gap-override:0%}
@font-face{font-family:'Reel Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:106.6%;ascent-override:88.2%;descent-override:23.4%;line-gap-override:0%}
@font-face{font-family:'Reel Mono Fallback';font-weight:400 500;src:local('Courier New'),local('CourierNewPSMT'),local('Liberation Mono'),local('LiberationMono');size-adjust:100%;ascent-override:94%;descent-override:25%;line-gap-override:0%}
html:root{--font-display:"Chivo","Reel Display Fallback",sans-serif;--font-body:"Chivo","Reel Body Fallback",sans-serif;--mono:"Chivo Mono","Reel Mono Fallback",ui-monospace,monospace;
--bg:#121214;--ink:#eceae6;--muted:#a3a19c;--line:rgba(255,255,255,.1);--panel:#19191c;--panel-2:#202024;--seam:rgba(255,255,255,.07);--clip:#2b2b30;--clip-cur:#3b3b42;--clip-ink:#c4c2bd;--wave:#77756f;--glass:#030304;--bezel:#0b0b0d;--btn:#eceae6;--on-btn:#121214;--muted-2:#a3a19c;--shadow:none;--focus:var(--primary-text)}
html[data-theme="light"]{--bg:#e9e7e2;--ink:#1a1a19;--muted:#5a5853;--line:rgba(20,18,14,.13);--panel:#f4f3ef;--panel-2:#e2e0da;--seam:rgba(20,18,14,.1);--clip:#d2cfc8;--clip-cur:#c3bfb7;--clip-ink:#3e3c38;--wave:#8a867d;--glass:#060607;--bezel:#1c1c1e;--btn:#1a1a19;--on-btn:#f4f3ef;--muted-2:#5a5853;--shadow:0 1px 0 rgba(255,255,255,.7) inset,0 1px 2px rgba(30,26,20,.08),0 18px 40px -24px rgba(30,26,20,.35)}
body{background:var(--bg);color:var(--ink);font-feature-settings:"ss01"}
h1,h2,h3{font-family:var(--font-display);letter-spacing:-.02em}
.rl-btn,.mbar .btn-primary,.menu-panel .btn-primary,.form .btn-primary{background:var(--btn);color:var(--on-btn);box-shadow:none;font-weight:600}
.rl-btn:hover,.mbar .btn-primary:hover{background:var(--btn);color:var(--on-btn);opacity:.88}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.hdr{background:var(--bg);border-bottom:1px solid var(--seam)}
.hdr-in{display:flex;align-items:center;gap:1rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1.02rem;letter-spacing:-.02em;text-decoration:none}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .7rem;font-family:var(--mono);font-size:.78rem;color:var(--muted);text-decoration:none;text-transform:uppercase;letter-spacing:.04em}
.nav a:hover{color:var(--ink)}
.mode-tg{border-color:var(--line);width:2.5rem;height:2.5rem;border-radius:6px}
.menu>summary{background:transparent;border-color:var(--line);color:var(--ink);border-radius:6px}
.menu-panel{background:var(--panel);border-color:var(--line)}
.menu-panel li a{border-bottom-color:var(--seam)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.rl-h2{font-size:clamp(2rem,1.4rem + 2.6vw,3.6rem);font-weight:800;line-height:1;letter-spacing:-.03em}
.rl-h3{font-size:1.15rem;font-weight:700;letter-spacing:-.01em}
.rl-side{font-family:var(--mono);font-size:.78rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.rl-sub{max-width:34rem;font-size:clamp(1.02rem,.95rem + .3vw,1.2rem);line-height:1.5;color:var(--muted)}
.rl-ctas{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center}

/* hero: the frame is the hero. Phone: the frame full-bleed and square, the name over it like an opening title (it
   dissolves as the scrub starts); tablet: the name over a full-width frame; desktop: the frame large on the left, the
   name and the current project beside it, the timeline under both. */
.rl-stage{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;padding-block:0 clamp(1.4rem,1rem + 2vw,2.4rem)}
.rl-bay{display:grid;grid-template-columns:minmax(0,1fr);grid-template-areas:"mon" "tl" "info";max-width:var(--max);margin-inline:auto;width:100%}
.rl-head-in{grid-area:mon;align-self:end;z-index:2;display:grid;gap:.5rem;justify-items:start;padding:3.5rem var(--gutter,1.25rem) 1.1rem;color:#f4f2ee;background:linear-gradient(to top,rgba(4,4,5,.86),rgba(4,4,5,.55) 55%,rgba(4,4,5,0));--muted:#c9c6c0;pointer-events:none}
.rl-head-in a{pointer-events:auto}
.rl-what{font-family:var(--mono);font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.rl-h1{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem);font-weight:900;line-height:.92;letter-spacing:-.045em;text-wrap:balance}
.rl-head-in .rl-sub{max-width:30rem;font-size:.98rem;line-height:1.45;color:var(--muted)}
.rl-head-in .rl-ctas{display:none}
html.m .rl-hero[data-sc] .rl-head-in{opacity:clamp(0,calc(1 - var(--p,0) * 16),1)}
.rl-mon{grid-area:mon;position:relative}
.rl-glass{position:relative;aspect-ratio:1/1;width:100%;background:var(--glass);overflow:hidden}
html.m .rl-tc{opacity:0}
@media (max-width:47.99rem){html:not(.m) .rl-tc{display:none}}
html.m .rl-hero[data-sc] .rl-tc{opacity:clamp(0,calc(var(--p,0) * 16 - .2),1)}
@media (min-width:48rem){
.rl-stage{padding-top:clamp(1rem,.5rem + 1.5vw,2rem)}
.rl-bay{padding-inline:var(--gutter,1.5rem);grid-template-areas:"head" "mon" "tl" "info"}
.rl-head-in{grid-area:head;align-self:auto;padding:0 0 1.4rem;background:none;color:var(--ink);--muted:var(--muted-2)}
html.m .rl-hero[data-sc] .rl-head-in{opacity:1}
.rl-head-in .rl-ctas{display:flex;margin-top:.6rem}
.rl-tc{opacity:1}html.m .rl-hero[data-sc] .rl-tc{opacity:1}
.rl-glass{aspect-ratio:16/9;border:8px solid var(--bezel);border-radius:8px;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.rl-mon{padding-bottom:1rem}
}
@media (min-width:60rem){
.rl-bay{grid-template-columns:auto minmax(17rem,1fr);grid-template-rows:auto 1fr auto;grid-template-areas:"mon head" "mon info" "tl tl";column-gap:clamp(1.2rem,.5rem + 1.5vw,2.4rem)}
.rl-glass{width:min(60rem,calc((100svh - 19rem) * 16 / 9),calc(100vw - 30rem));min-width:34rem}
.rl-head-in{padding:0;align-self:start}
.rl-h1{font-size:clamp(3rem,1rem + 3.4vw,5.2rem)}
}
.rl-pic{position:absolute;inset:0;opacity:0}
.rl-pic.cur{opacity:1}
.rl-pic img{width:100%;height:100%;object-fit:cover}
html.m .rl-cut1 .rl-pic.cur{animation:rl-dip .26s ease-out}
@keyframes rl-dip{from{opacity:.25}to{opacity:1}}
.rl-tc{position:absolute;right:.6rem;bottom:.5rem;padding:.2rem .45rem;border-radius:3px;background:rgba(0,0,0,.6);color:#f2f0ec;font-family:var(--mono);font-size:clamp(.7rem,.6rem + .3vw,.86rem);font-variant-numeric:tabular-nums;letter-spacing:.02em}
/* the timeline */
.rl-tl{position:relative;padding:.3rem 0 .2rem;background:var(--panel);border:1px solid var(--seam);border-radius:6px;box-shadow:var(--shadow)}
@media (max-width:47.99rem){.rl-tl{border-radius:0;border-inline:0;border-top:0}}
.rl-tl{grid-area:tl}
.rl-ruler{position:relative;height:1.3rem;margin-inline:var(--tl-pad,1rem);border-bottom:1px solid var(--seam);font-family:var(--mono);font-size:.62rem;color:var(--muted);font-variant-numeric:tabular-nums}
.rl-ruler span{position:absolute;top:.2rem;padding-left:.3rem;border-left:1px solid var(--line);line-height:1}
.rl-win{position:relative;margin-inline:var(--tl-pad,1rem);padding-block:.45rem}
.rl-track{position:relative}
.rl-seq{position:relative;height:7.4rem}
.rl-clip{position:absolute;top:0;bottom:0;left:calc(var(--a) * 100%);width:calc((var(--b) - var(--a)) * 100% - 3px)}
.rl-blk{position:relative;display:flex;align-items:flex-start;gap:.45rem;height:3.6rem;padding:.4rem .5rem;border-radius:4px;background:var(--clip);overflow:hidden;transition:background .25s ease}
.rl-clip.cur .rl-blk{background:var(--clip-cur)}
.rl-n,.rl-len{font-family:var(--mono);font-size:.66rem;color:var(--clip-ink);font-variant-numeric:tabular-nums;flex:none;padding-top:.1rem}
.rl-len{margin-left:auto}
.rl-t{min-width:0;font-size:.84rem;font-weight:600;line-height:1.2;letter-spacing:-.005em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rl-wv{display:block;width:100%;height:2.4rem;margin-top:.3rem;border-radius:4px;background:var(--panel-2)}
.rl-wv path{stroke:var(--wave);stroke-width:1.2;vector-effect:non-scaling-stroke}
.rl-head{position:absolute;top:-1.85rem;bottom:.2rem;left:0;width:2px;margin-left:-1px;background:var(--pop);pointer-events:none;box-shadow:0 0 4px color-mix(in srgb,var(--pop) 50%,transparent)}
html[data-theme="light"] .rl-head{box-shadow:2px 0 6px color-mix(in srgb,var(--pop) 12%,transparent)}
.rl-head::before{content:'';position:absolute;top:0;left:50%;width:.7rem;height:.8rem;transform:translateX(-50%);background:var(--pop);clip-path:polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)}
.rl-tracks{position:absolute;left:.4rem;top:2.2rem;display:none;gap:1.9rem;flex-direction:column;font-family:var(--mono);font-size:.62rem;color:var(--muted)}
@media (min-width:48rem){.rl-tl{--tl-pad:2.2rem}.rl-tracks{display:flex}}
/* the scrub, with the runtime: the section is tall and the bay holds; the playhead runs, or on a phone stays put and
   the sequence slides under it */
html.m .rl-hero[data-sc]{height:calc(100vh + min(150vh,var(--nc,5) * 24vh));height:calc(100svh + min(150svh,var(--nc,5) * 26svh))}
html.m .rl-hero[data-sc] .rl-stage{position:sticky;top:0;min-height:100vh;min-height:100svh;align-content:center}
html.m .rl-head{left:calc(var(--p,0) * 100%)}
@media (max-width:47.99rem){
html.m .rl-hero[data-sc] .rl-stage{align-content:start;padding-top:0}
html.m .rl-win{overflow:hidden;margin-inline:0}
html.m .rl-track{width:calc(var(--nc,5) * 44vw);transform:translateX(calc(50vw - var(--p,0) * var(--nc,5) * 44vw))}
html.m .rl-head{left:50%}
html.m .rl-ruler{overflow:hidden;margin-inline:0}
html.m .rl-ruler span{display:none}
}
/* the projects: with the runtime, the current one under the timeline (the others there but clear) */
.rl-list{grid-area:info;display:grid;margin-top:.9rem;padding-inline:var(--gutter,1.25rem)}
@media (min-width:48rem){.rl-list{padding-inline:0}}
.rl-item{display:grid;gap:.3rem;align-content:start;justify-items:start}
.rl-it{font-size:1rem;font-weight:700;letter-spacing:-.01em}
.rl-in2{font-family:var(--mono);font-size:.72rem;font-weight:400;color:var(--muted);margin-right:.6rem}
.rl-item p{color:var(--muted)}
.rl-watch{font-family:var(--mono);font-size:.8rem;color:var(--ink);text-decoration:underline;text-decoration-color:var(--pop);text-underline-offset:.25em}
html.m .rl-item{grid-area:1/1;opacity:0;transition:opacity .2s ease}
html.m .rl-item.cur,html.m .rl-item:focus-within{opacity:1}
html.m .rl-item:not(.cur) a{pointer-events:none}
@media (min-width:60rem){
.rl-list{grid-area:info;align-self:stretch;margin:1.4rem 0 1rem;padding:1.2rem;background:var(--panel);border:1px solid var(--seam);border-radius:6px;box-shadow:var(--shadow)}
.rl-list::before{content:'Project';grid-area:1/1;align-self:start;font-family:var(--mono);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
html.m .rl-item{padding-top:1.8rem;align-self:start}
.rl-it{font-size:1.35rem;line-height:1.15}
html:not(.m) .rl-bay{grid-template-areas:"mon head" "info info"}
html:not(.m) .rl-list{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:3rem;margin-top:1.4rem;padding:0;background:none;border:0;border-top:1px solid var(--ink);border-radius:0;box-shadow:none}
html:not(.m) .rl-list::before{display:none}
}
/* still (no script, or reduced motion): the timeline put away, the projects printed as an edit list */
html:not(.m) .rl-tl{display:none}
html:not(.m) .rl-list{margin-top:1.2rem;border-top:1px solid var(--ink)}
html:not(.m) .rl-item{display:grid;gap:.3rem;padding-block:1rem;border-bottom:1px solid var(--seam)}
html:not(.m) .rl-item p,html:not(.m) .rl-watch{margin-left:1.95rem}
/* sections */
.rl-sec{padding-block:clamp(4rem,3rem + 4vw,7.5rem);border-top:1px solid var(--seam)}
/* the cut: the footage strip, the selects lit in the member's colour, the zoom down to the finished cut */
.rl-cut .rl-h2{margin-bottom:clamp(1.8rem,1.4rem + 1.5vw,3rem)}
.rl-cuts{display:grid;gap:clamp(2.6rem,2rem + 2vw,4rem)}
.rl-cuts li{display:grid;gap:1rem}
.rl-trim{display:grid;gap:0;padding:1rem;background:var(--panel);border:1px solid var(--seam);border-radius:6px;box-shadow:var(--shadow)}
.rl-lab{display:flex;gap:.6rem;align-items:baseline;margin-bottom:.45rem;font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.rl-lab b{font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:.02em}
.rl-strip{position:relative;height:2.6rem;border-radius:4px;background:var(--clip)}
.rl-strip i{position:absolute;top:-3px;bottom:-3px;width:3px;margin-left:-1.5px;border-radius:1px;background:var(--pop)}
.rl-zoom{display:block;width:100%;height:2.4rem}
.rl-zoom path{fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;opacity:.6}
/* the cut plays when it comes into view: the selects light one by one, the zoom opens, the cut widens between its handles */
html.m .rl-trim .rl-strip i{opacity:0;transform:scaleY(.2);transition:opacity .3s ease,transform .5s cubic-bezier(.2,.8,.2,1);transition-delay:calc(.35s + var(--i,0) * 90ms)}
html.m .rl-trim.in .rl-strip i{opacity:1;transform:none}
html.m .rl-trim .rl-zoom{opacity:0;transition:opacity .6s ease 1.1s}
html.m .rl-trim.in .rl-zoom{opacity:1}
html.m .rl-trim .rl-bar{margin-inline:44%;transition:margin .9s cubic-bezier(.7,0,.2,1) 1.25s}
html.m .rl-trim.in .rl-bar{margin-inline:16px}
.rl-bar{position:relative;height:2.6rem;margin-inline:16px;border-block:3px solid var(--pop);background:var(--clip-cur)}
.rl-in,.rl-out{position:absolute;top:-3px;bottom:-3px;width:16px;background:var(--pop)}
.rl-in{right:100%;border-radius:4px 0 0 4px}
.rl-out{left:100%;border-radius:0 4px 4px 0}
.rl-in::after,.rl-out::after{content:'';position:absolute;left:50%;top:50%;width:3px;height:40%;transform:translate(-50%,-50%);border-radius:2px;background:var(--bg);opacity:.75}
.rl-kept .rl-lab{padding-inline:16px}
.rl-ratio{max-width:40rem;color:var(--muted)}
/* turnaround: the member's day counts as days, a block each; the first deadline's last day lit */
.rl-turn-in{display:grid;gap:2rem}
@media (min-width:60rem){.rl-turn-in{grid-template-columns:4fr 8fr;gap:4rem}}
.rl-days{display:grid;border-top:1px solid var(--ink)}
.rl-days li{display:grid;gap:.6rem;padding-block:1.1rem;border-bottom:1px solid var(--seam)}
.rl-days p{font-size:1.1rem;font-weight:600;letter-spacing:-.01em}
.rl-dbar{display:flex;align-items:center;gap:.7rem}
.rl-blocks{display:flex;gap:3px}
.rl-blocks i{display:block;width:clamp(.7rem,.5rem + .6vw,1.15rem);height:clamp(.7rem,.5rem + .6vw,1.15rem);border-radius:2px;background:var(--clip-cur)}
.rl-days li:first-child .rl-blocks i:last-child{background:var(--pop)}
html.m .rl-days .rl-blocks i{transform:scale(.3);opacity:0;transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .3s ease}
html.m .rl-days.in .rl-blocks i{transform:none;opacity:1}
.rl-dbar b{font-family:var(--mono);font-size:.75rem;font-weight:500;color:var(--muted);white-space:nowrap}
/* rates: the sheet */
.rl-rates-in{display:grid;gap:2rem}
@media (min-width:60rem){.rl-rates-in{grid-template-columns:4fr 8fr;gap:4rem}}
.rl-sheet{border-top:1px solid var(--ink)}
.rl-sheet li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.3rem 1.5rem;padding-block:1.2rem;border-bottom:1px solid var(--seam)}
.rl-rn{font-size:1.25rem;font-weight:700}
.rl-sheet p{grid-column:1;color:var(--muted)}
.rl-price{grid-column:2;grid-row:1;font-family:var(--mono);font-size:1.05rem;font-variant-numeric:tabular-nums;white-space:nowrap;padding-top:.15rem}
.rl-with{margin-top:2.2rem;display:grid;gap:.8rem}
.rl-with ul{display:grid;gap:.5rem}
.rl-with li{position:relative;padding-left:1.3rem}
.rl-with li::before{content:'';position:absolute;left:0;top:.62em;width:.6rem;height:1px;background:var(--muted)}
/* about and credits */
.rl-about-in{display:grid;gap:1.4rem}
@media (min-width:60rem){.rl-about-in{grid-template-columns:4fr 8fr;gap:4rem}}
.rl-say{font-size:clamp(1.35rem,1.05rem + 1.3vw,2.2rem);font-weight:500;line-height:1.25;letter-spacing:-.02em;max-width:34ch}
.rl-say.more{margin-top:1.2rem;font-size:1.1rem;color:var(--muted);font-weight:400;letter-spacing:0;max-width:52ch}
.rl-credits{margin-top:2.4rem;display:grid;gap:.8rem}
.rl-credits ul{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem}
.rl-credits li{font-size:1.15rem;font-weight:600;letter-spacing:-.01em}
.rl-rv{margin-top:2rem}
.review{border-radius:6px;background:var(--panel);border:1px solid var(--seam);box-shadow:var(--shadow)}
.rl-asked{display:grid;gap:2rem}
@media (min-width:60rem){.rl-asked{grid-template-columns:4fr 8fr;gap:4rem}}
.rl-asked dl{border-top:1px solid var(--ink)}
.rl-asked dl div{display:grid;gap:.4rem;padding-block:1.1rem;border-bottom:1px solid var(--seam)}
.rl-asked dt{font-weight:700}
.rl-asked dd{color:var(--muted)}
/* the end slate: a black frame in both modes, title-safe corners around the ask */
.rl-end{border-top:0;padding-top:0}
.rl-slate{position:relative;display:grid;gap:1.2rem;justify-items:start;padding:clamp(2.6rem,2rem + 4vw,6rem) clamp(1.6rem,1rem + 4vw,6rem);background:var(--glass);color:#f2f0ec;border-radius:6px;--muted:#a9a6a0;--ink:#f2f0ec;--btn:#f2f0ec;--on-btn:#0b0b0c;--line:rgba(255,255,255,.18)}
.rl-safe{position:absolute;inset:clamp(.8rem,.5rem + 1vw,1.4rem);pointer-events:none;background:linear-gradient(var(--line),var(--line)) 0 0/1.2rem 1px no-repeat,linear-gradient(var(--line),var(--line)) 0 0/1px 1.2rem no-repeat,linear-gradient(var(--line),var(--line)) 100% 0/1.2rem 1px no-repeat,linear-gradient(var(--line),var(--line)) 100% 0/1px 1.2rem no-repeat,linear-gradient(var(--line),var(--line)) 0 100%/1.2rem 1px no-repeat,linear-gradient(var(--line),var(--line)) 0 100%/1px 1.2rem no-repeat,linear-gradient(var(--line),var(--line)) 100% 100%/1.2rem 1px no-repeat,linear-gradient(var(--line),var(--line)) 100% 100%/1px 1.2rem no-repeat}
.rl-end-t{font-size:clamp(2.2rem,1.4rem + 3.6vw,5rem);font-weight:900;line-height:.98;letter-spacing:-.035em;max-width:16ch;text-wrap:balance}
.rl-slate .rl-sub{color:var(--muted)}
.rl-reach{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem;font-family:var(--mono);font-size:.86rem}
.rl-reach a{color:#f2f0ec;text-decoration-color:var(--pop);text-underline-offset:.3em}
.rl-form{width:min(100%,30rem)}
.rl-slate .field input,.rl-slate .field textarea{background:transparent;color:#f2f0ec;border-color:var(--line)}
@media (max-width:47.99rem){.rl-end .wrap{padding-inline:0}.rl-slate{border-radius:0}}
/* footer: one line */
.rl-ftr{padding-block:1.4rem 1.6rem;border-top:1px solid var(--seam);font-size:.86rem;color:var(--muted)}
.rl-ftr-in{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.8rem}
.rl-ftr-n{margin-right:auto;font-weight:800;color:var(--ink);display:flex;gap:.8rem;align-items:baseline}
.rl-ftr-n span{font-family:var(--mono);font-weight:400;font-size:.78rem;color:var(--muted)}
.rl-ftr-c{display:flex;flex-wrap:wrap;gap:.3rem 1.2rem;font-family:var(--mono);font-size:.8rem}
.rl-ftr a{color:var(--muted);text-decoration:none}
.rl-ftr a:hover{color:var(--ink)}
.rl-ftr-y{font-family:var(--mono);font-size:.78rem}
.rl-ftr .legal-links{flex-basis:100%}
.rl-ftr .mpause,.rl-ftr .legal-links a{opacity:1;color:var(--muted)}
.mbar{background:var(--bg);border-top-color:var(--seam);box-shadow:none}
.mbar .btn-ghost{color:var(--ink);border-color:var(--line)}
.field input,.field select,.field textarea{background:transparent;border-color:var(--line);border-radius:4px}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Reel',
  bestFor: 'A video editor, a colorist or a filmmaker who wants their projects seen as a sequence',
  // The motion, as data (lib/choreo.md): fade up from black, the monitor leaning a touch toward the pointer, the scroll scrubbing the sequence.
  choreo: { intro: 'develop', alive: ['pointer'], scroll: 'scrub', pace: 'medium', look: 'the edit bay at night: graphite, one bias light, the playhead' },
  match: /\b(video edit\w*|editors?|editing|videograph\w*|filmmak\w*|colou?rists?|colou?r grad\w*|post.?production|youtube edit\w*|reels? edit\w*|short.?form edit\w*)\b/,
  why: 'Built for a video editor: your projects are the clips on a timeline under a program monitor, and scrolling scrubs through them. Then the cut from footage to final, your turnaround and your rates.',
  fonts: { q: 'family=Chivo:wght@400..900&family=Chivo+Mono:wght@400;500', display: ['Chivo', 'grotesk'], body: ['Chivo', 'sans'] },
  modes: ['dark', 'light'],
  tokens,
  slots,
  nav,
  art,
  render,
};
