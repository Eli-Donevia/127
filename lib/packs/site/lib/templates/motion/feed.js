// Feed (animated, portfolio, for UGC creators who make videos for brands): the page a creator sends a brand.
//   Object:   the phone playing their videos. Each project is a vertical clip with the creator's handle, the line
//             under it and a scrubber, the way a brand will see it on a feed; the brands they made videos for sit beside
//             it as cards, each tied to its clip. Until the member adds stills each clip's frame is drawn to its
//             caption (a serum on a bathroom counter, a skillet on the stove, folded sheets, a spray bottle by a
//             stovetop, jars on a board) over an opened parcel as the neutral one.
//   Material: daylight on a white counter (own mode): warm paper white, real soft shadows, rounded corners the size
//             of a phone's. Dark: the same feed scrolled at night, near-black with lit edges instead of shadows. Funnel
//             Display for the name, Funnel Sans for everything else, captions set the way an editing app sets them.
//   One move: the caption is typed onto the first clip (choreo intro 'type'), the phone wipes on.
//   Moment:   clips flick past like a feed. On a wide screen the phone holds while the scroll flicks it from clip to
//             clip, the scrubber runs with the scroll and the brand card for the clip on screen lights; on a phone the
//             clips are the page, one under another, each one's scrubber running once as it reaches the middle.
//   Pop:      the member's colour is the scrubber and the lit edge of the current brand card. Buttons are ink.
// Then the rates and the usage rights set plainly side by side (what a brand can do with the videos and for how
// long), what every video comes with, a short about in their words and a brief form a brand can fill in. JavaScript
// off and reduced motion: every clip shown, every scrubber at rest, nothing hidden.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { draftCopy } = require('../../copy');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'feed';

function tokens(p, mode) {
  if (mode === 'dark') {
    const bg = color.mix('#100f0e', p.primary, 0.025);
    return { bg, dark: bg };
  }
  return { bg: '#f6f3ee' };
}

// ---------- facts ----------

const SEC = { h: 3600, hr: 3600, hour: 3600, m: 60, min: 60, minute: 60, s: 1, sec: 1, second: 1 };
const DUR = /(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i;
function secondsOf(w) {
  const m = DUR.exec(`${w.detail || ''} ${w.title || ''}`);
  return m ? Math.round(parseFloat(m[1]) * (SEC[m[2].toLowerCase().replace(/s$/, '')] || 1)) : null;
}
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function clipsOf(c) {
  return (c.work || []).slice(0, 8).map((w, i) => ({ ...w, i, secs: secondsOf(w) }));
}

// Each brand, and the clip made for it when a clip's words name it ("Unboxing the Cobble skillet" for Cobble Cookware).
function brandsOf(c, clips) {
  return (c.clients || []).slice(0, 8).map((name) => {
    const words = name.toLowerCase().split(/\s+/).filter((x) => x.length >= 4 && !/^(the|and|home|co|company|brand|brands)$/.test(x));
    const k = clips.find((w) => {
      const t = `${w.title} ${w.detail}`.toLowerCase();
      return t.includes(name.toLowerCase()) || words.some((x) => new RegExp(`\\b${x.replace(/[^a-z0-9]/g, '')}\\b`).test(t));
    });
    return { name, k: k ? k.i : -1, kind: k && k.detail ? k.detail.split(',')[0] : '' };
  });
}

// Usage rights: the member's lines about where and how long a brand can use the videos.
const USAGE = /\b(usage|use|used|rights?|licen[cs]\w*|whitelist\w*|paid|organic|ads?|boost\w*|spark|perpetual|in perpetuity|exclusiv\w*|raw (clips|footage))\b/i;
function usageOf(c) {
  const inc = c.included || [];
  return { usage: inc.filter((l) => USAGE.test(l)), rest: inc.filter((l) => !USAGE.test(l)) };
}

function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length || /^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'portfolio').about ? [] : paras;
}

function slots(c) {
  const clips = clipsOf(c);
  const alt = (w) => [w.title, w.detail].filter(Boolean).join(', ');
  const out = [{ slot: 'hero', file: 'hero.jpg', w: 900, h: 1600, style: 'portrait', alt: clips[0] ? alt(clips[0]) : (c.profile && c.profile.hero) || `A frame from a video by ${c.name}` }];
  clips.slice(1).forEach((w, i) => out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 900, h: 1600, style: 'portrait', alt: alt(w) || `${c.name}, a recent video` }));
  return out;
}

function nav(c) {
  const { usage } = usageOf(c);
  return [
    (c.work || []).length > 1 && { label: 'Videos', href: '#videos' },
    c.services.some((s) => s.name) && { label: 'Rates', href: '#rates' },
    usage.length && !c.services.some((s) => s.name) && { label: 'Usage', href: '#usage' },
    { label: 'Send a brief', href: '#contact' },
  ].filter(Boolean);
}

// ---------- drawings: the frame of each clip until the member adds stills ----------

const SCENES = [
  ['serum', /\b(skin\w*|serum|routine|beauty|makeup|cosmetic\w*|moistur\w*|spf|sunscreen|hair|lotion|glow|dew)\b/],
  ['pan', /\b(skillet|pan|pans|cook\w*|kitchen|recipe|stove|knife|knives|cast iron)\b/],
  ['jars', /\b(spice\w*|salt|sauce\w*|snack\w*|food|coffee|tea|pantry|ways with|jar|jars|honey)\b/],
  ['sheets', /\b(sheets?|bed\w*|sleep|pillow\w*|linen\w*|towel\w*|home goods|blanket)\b/],
  ['spray', /\b(clean\w*|spray|stovetop|grease|greasy|laundry|detergent|before and after)\b/],
];
function sceneOf(t, used) {
  t = String(t || '').toLowerCase();
  const hit = SCENES.find(([k, re]) => re.test(t) && !used.has(k)) || SCENES.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'parcel';
}
const f1 = (v) => (Math.round(v * 10) / 10).toString();

// Window light from the left onto a counter: the wall, the counter's top and front edge, a soft fall of light.
function counter(w, h, top, wall, slab, edge) {
  return `<rect width="${w}" height="${h}" fill="${wall}"/><path d="M0 0H${f1(w * 0.55)}L${f1(w * 0.2)} ${f1(top)}H0Z" fill="#fff" opacity=".16"/><rect y="${f1(top)}" width="${w}" height="${f1(h - top)}" fill="url(#ct)"/><rect y="${f1(top)}" width="${w}" height="${f1(h * 0.004)}" fill="#fff" opacity=".45"/><path d="M0 ${f1(top)}L${f1(w * 0.75)} ${f1(top)}L${w} ${h}H0Z" fill="#fff" opacity=".1"/>`
    + `<defs><linearGradient id="ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${slab}"/><stop offset="1" stop-color="${edge}"/></linearGradient></defs>`;
}
const shadow = (cx, cy, rx, ry, o = 0.35) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#2a2018" opacity="${o}" filter="url(#sf)"/>`;

const SCENE = {
  // A dropper bottle in amber glass and a jar on a pale counter, morning light.
  serum(w, h) {
    const top = h * 0.6;
    let b = counter(w, h, top, '#d9d2c8', '#efe9e1', '#c9c0b4');
    const bx = w * 0.42, bw = w * 0.2, by = h * 0.44;
    b += shadow(bx + bw * 0.7, top + h * 0.12, w * 0.24, h * 0.02) + shadow(w * 0.78, top + h * 0.13, w * 0.16, h * 0.018);
    b += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(top + h * 0.11 - by)}" rx="${f1(w * 0.03)}" fill="url(#am)"/><rect x="${f1(bx + bw * 0.12)}" y="${f1(by + h * 0.02)}" width="${f1(bw * 0.1)}" height="${f1((top + h * 0.11 - by) * 0.8)}" rx="${f1(w * 0.01)}" fill="#fff" opacity=".35"/>`;
    b += `<rect x="${f1(bx + bw * 0.28)}" y="${f1(by - h * 0.035)}" width="${f1(bw * 0.44)}" height="${f1(h * 0.04)}" rx="4" fill="#20201f"/><path d="M${f1(bx + bw * 0.32)} ${f1(by - h * 0.035)}C${f1(bx + bw * 0.3)} ${f1(by - h * 0.11)} ${f1(bx + bw * 0.7)} ${f1(by - h * 0.11)} ${f1(bx + bw * 0.68)} ${f1(by - h * 0.035)}Z" fill="#2c2b29"/>`;
    b += `<rect x="${f1(bx + bw * 0.14)}" y="${f1(by + h * 0.06)}" width="${f1(bw * 0.72)}" height="${f1(h * 0.075)}" rx="3" fill="#f3eee6" opacity=".92"/>`;
    const jx = w * 0.66, jw = w * 0.26, jy = top + h * 0.035;
    b += `<rect x="${f1(jx)}" y="${f1(jy)}" width="${f1(jw)}" height="${f1(h * 0.1)}" rx="${f1(w * 0.03)}" fill="url(#jr)"/><rect x="${f1(jx - w * 0.006)}" y="${f1(jy - h * 0.03)}" width="${f1(jw + w * 0.012)}" height="${f1(h * 0.04)}" rx="${f1(w * 0.015)}" fill="#cfc6ba"/><rect x="${f1(jx + jw * 0.08)}" y="${f1(jy + h * 0.012)}" width="${f1(jw * 0.08)}" height="${f1(h * 0.07)}" rx="4" fill="#fff" opacity=".55"/>`;
    b += `<path d="M${f1(w * 0.12)} ${f1(top + h * 0.2)}c${f1(w * 0.06)} ${f1(-h * 0.01)} ${f1(w * 0.12)} 0 ${f1(w * 0.18)} ${f1(h * 0.012)}" stroke="#fff" stroke-width="${f1(w * 0.02)}" stroke-linecap="round" opacity=".5"/>`;
    return { defs: `<linearGradient id="am" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3e12"/><stop offset=".45" stop-color="#b8661f"/><stop offset="1" stop-color="#5a2a0b"/></linearGradient><linearGradient id="jr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf8f3"/><stop offset=".6" stop-color="#e6ded3"/><stop offset="1" stop-color="#b9afa2"/></linearGradient>`, body: b };
  },
  // A cast iron skillet on the stove, a wooden spoon, a sprig on the board beside it.
  pan(w, h) {
    const top = h * 0.5;
    let b = counter(w, h, top, '#3a332d', '#4a4039', '#1f1a16');
    const cx = w * 0.48, cy = h * 0.7, rx = w * 0.34, ry = h * 0.08;
    b += shadow(cx + w * 0.03, cy + h * 0.03, rx * 1.05, ry * 1.1, 0.6);
    b += `<rect x="${f1(cx + rx * 0.9)}" y="${f1(cy - h * 0.018)}" width="${f1(w * 0.3)}" height="${f1(h * 0.03)}" rx="${f1(h * 0.015)}" fill="#1b1a19" transform="rotate(-8 ${f1(cx + rx)} ${f1(cy)})"/>`;
    b += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#141312"/><ellipse cx="${f1(cx)}" cy="${f1(cy - h * 0.006)}" rx="${f1(rx * 0.88)}" ry="${f1(ry * 0.8)}" fill="url(#ci)"/>`;
    b += `<ellipse cx="${f1(cx - rx * 0.2)}" cy="${f1(cy - h * 0.01)}" rx="${f1(rx * 0.3)}" ry="${f1(ry * 0.25)}" fill="#e7b25e" opacity=".85"/><ellipse cx="${f1(cx + rx * 0.25)}" cy="${f1(cy)}" rx="${f1(rx * 0.22)}" ry="${f1(ry * 0.22)}" fill="#f2e8d6"/><circle cx="${f1(cx + rx * 0.25)}" cy="${f1(cy)}" r="${f1(ry * 0.13)}" fill="#f0a63a"/>`;
    b += `<path d="M${f1(cx - rx * 0.86)} ${f1(cy - ry * 0.5)}A${f1(rx * 0.88)} ${f1(ry * 0.8)} 0 0 1 ${f1(cx + rx * 0.5)} ${f1(cy - ry * 0.75)}" fill="none" stroke="#fff" stroke-width="2" opacity=".25"/>`;
    b += `<path d="M${f1(w * 0.08)} ${f1(h * 0.9)}L${f1(w * 0.5)} ${f1(h * 0.83)}" stroke="#a6774a" stroke-width="${f1(w * 0.02)}" stroke-linecap="round"/><ellipse cx="${f1(w * 0.55)}" cy="${f1(h * 0.825)}" rx="${f1(w * 0.05)}" ry="${f1(h * 0.012)}" fill="#a6774a" transform="rotate(-10 ${f1(w * 0.55)} ${f1(h * 0.825)})"/>`;
    for (let k = 0; k < 5; k++) b += `<ellipse cx="${f1(w * (0.72 + k * 0.035))}" cy="${f1(h * (0.9 - k * 0.012))}" rx="${f1(w * 0.022)}" ry="${f1(h * 0.006)}" fill="#5e7a3a" transform="rotate(${-30 + k * 12} ${f1(w * (0.72 + k * 0.035))} ${f1(h * (0.9 - k * 0.012))})"/>`;
    return { defs: `<radialGradient id="ci" cx=".4" cy=".35"><stop offset="0" stop-color="#3a3532"/><stop offset="1" stop-color="#191716"/></radialGradient>`, body: b };
  },
  // Three jars on a board: salt, a red spice, dried herbs.
  jars(w, h) {
    const top = h * 0.56;
    let b = counter(w, h, top, '#e4dccf', '#c79a68', '#8f6740');
    const cols = [['#f4f1ec', '#ddd6cc'], ['#b5401f', '#7e2a13'], ['#6f7d43', '#4a5529']];
    cols.forEach(([a, d], i) => {
      const x = w * (0.14 + i * 0.26), jw = w * 0.2, y = top - h * (0.06 + (i % 2) * 0.03), jh = h * 0.2;
      b += shadow(x + jw * 0.6, y + jh + h * 0.008, jw * 0.65, h * 0.014);
      b += `<rect x="${f1(x)}" y="${f1(y + jh * 0.3)}" width="${f1(jw)}" height="${f1(jh * 0.7)}" rx="${f1(w * 0.02)}" fill="${a}"/><rect x="${f1(x)}" y="${f1(y + jh * 0.3)}" width="${f1(jw)}" height="${f1(jh * 0.7)}" rx="${f1(w * 0.02)}" fill="url(#gl)"/><rect x="${f1(x - w * 0.004)}" y="${f1(y + jh * 0.12)}" width="${f1(jw + w * 0.008)}" height="${f1(jh * 0.2)}" rx="${f1(w * 0.012)}" fill="#c9b79e"/><rect x="${f1(x + jw * 0.1)}" y="${f1(y + jh * 0.38)}" width="${f1(jw * 0.1)}" height="${f1(jh * 0.5)}" rx="4" fill="#fff" opacity=".45"/>`;
      void d;
    });
    return { defs: `<linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`, body: b };
  },
  // The corner of a made bed, a stack of folded sheets, window light across it.
  sheets(w, h) {
    let b = `<rect width="${w}" height="${h}" fill="#cfc6bb"/><path d="M0 ${f1(h * 0.52)}C${f1(w * 0.4)} ${f1(h * 0.48)} ${f1(w * 0.7)} ${f1(h * 0.5)} ${w} ${f1(h * 0.47)}V${h}H0Z" fill="url(#bd)"/>`;
    b += `<path d="M${f1(w * 0.1)} 0L${f1(w * 0.5)} 0L${f1(w * 0.95)} ${h}L${f1(w * 0.45)} ${h}Z" fill="#fff" opacity=".12"/>`;
    const x = w * 0.2, sw = w * 0.6;
    [['#e9e3da', 0], ['#c9b8a3', 1], ['#e9e3da', 2], ['#a7b2a4', 3]].forEach(([col, k]) => {
      const y = h * (0.66 - k * 0.055);
      b += `<rect x="${f1(x - k * w * 0.01)}" y="${f1(y)}" width="${f1(sw)}" height="${f1(h * 0.06)}" rx="${f1(h * 0.018)}" fill="${col}"/><rect x="${f1(x - k * w * 0.01)}" y="${f1(y)}" width="${f1(sw)}" height="${f1(h * 0.012)}" rx="4" fill="#fff" opacity=".35"/><path d="M${f1(x + sw * 0.08 - k * w * 0.01)} ${f1(y + h * 0.045)}H${f1(x + sw * 0.9)}" stroke="#000" stroke-width="2" opacity=".08"/>`;
    });
    b += shadow(w * 0.52, h * 0.73, w * 0.36, h * 0.015, 0.25);
    return { defs: `<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ece5"/><stop offset="1" stop-color="#bdb3a7"/></linearGradient>`, body: b };
  },
  // A spray bottle beside a clean steel stovetop.
  spray(w, h) {
    const top = h * 0.55;
    let b = counter(w, h, top, '#c7cdcf', '#d7dadb', '#9aa1a4');
    b += `<rect x="${f1(w * 0.04)}" y="${f1(top + h * 0.04)}" width="${f1(w * 0.56)}" height="${f1(h * 0.2)}" rx="10" fill="#202224"/><ellipse cx="${f1(w * 0.18)}" cy="${f1(top + h * 0.1)}" rx="${f1(w * 0.09)}" ry="${f1(h * 0.025)}" fill="none" stroke="#3b3e41" stroke-width="5"/><ellipse cx="${f1(w * 0.44)}" cy="${f1(top + h * 0.17)}" rx="${f1(w * 0.1)}" ry="${f1(h * 0.028)}" fill="none" stroke="#3b3e41" stroke-width="5"/><path d="M${f1(w * 0.06)} ${f1(top + h * 0.05)}H${f1(w * 0.5)}" stroke="#fff" stroke-width="3" opacity=".25"/>`;
    const x = w * 0.66, bw = w * 0.2, y = h * 0.42;
    b += shadow(x + bw * 0.6, top + h * 0.2, bw * 0.8, h * 0.016);
    b += `<path d="M${f1(x)} ${f1(top + h * 0.2)}V${f1(y + h * 0.06)}Q${f1(x)} ${f1(y)} ${f1(x + bw * 0.25)} ${f1(y)}H${f1(x + bw * 0.75)}Q${f1(x + bw)} ${f1(y)} ${f1(x + bw)} ${f1(y + h * 0.06)}V${f1(top + h * 0.2)}Z" fill="url(#sp)"/>`;
    b += `<rect x="${f1(x + bw * 0.3)}" y="${f1(y - h * 0.05)}" width="${f1(bw * 0.4)}" height="${f1(h * 0.05)}" fill="#f2f2f0"/><path d="M${f1(x + bw * 0.25)} ${f1(y - h * 0.05)}H${f1(x + bw * 0.85)}L${f1(x + bw * 1.05)} ${f1(y - h * 0.035)}V${f1(y - h * 0.065)}L${f1(x + bw * 0.2)} ${f1(y - h * 0.085)}Z" fill="#ececea"/><path d="M${f1(x + bw * 0.55)} ${f1(y - h * 0.035)}l${f1(-bw * 0.08)} ${f1(h * 0.06)}" stroke="#d8d8d5" stroke-width="${f1(w * 0.015)}" stroke-linecap="round"/>`;
    b += `<rect x="${f1(x + bw * 0.12)}" y="${f1(y + h * 0.08)}" width="${f1(bw * 0.76)}" height="${f1(h * 0.1)}" rx="4" fill="#fbfbf9" opacity=".9"/><rect x="${f1(x + bw * 0.1)}" y="${f1(y + h * 0.02)}" width="${f1(bw * 0.07)}" height="${f1(h * 0.2)}" rx="4" fill="#fff" opacity=".4"/>`;
    return { defs: `<linearGradient id="sp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f9fb0"/><stop offset=".5" stop-color="#8ac3d1"/><stop offset="1" stop-color="#3f7887"/></linearGradient>`, body: b };
  },
  // An opened parcel on a counter, tissue folded back.
  parcel(w, h) {
    const top = h * 0.56;
    let b = counter(w, h, top, '#d8d0c4', '#e8e1d6', '#bcb2a5');
    const x = w * 0.18, bw = w * 0.64, y = top - h * 0.02, bh = h * 0.18, d = h * 0.05;
    b += shadow(x + bw * 0.55, y + bh + h * 0.01, bw * 0.6, h * 0.02);
    b += `<path d="M${f1(x)} ${f1(y)}L${f1(x + w * 0.06)} ${f1(y - d)}H${f1(x + bw + w * 0.06)}L${f1(x + bw)} ${f1(y)}Z" fill="#6e5236"/>`;
    b += `<path d="M${f1(x + w * 0.05)} ${f1(y - d * 0.5)}C${f1(x + w * 0.2)} ${f1(y - d * 2.2)} ${f1(x + w * 0.4)} ${f1(y - d * 0.4)} ${f1(x + w * 0.52)} ${f1(y - d * 1.8)}C${f1(x + w * 0.6)} ${f1(y - d * 0.6)} ${f1(x + bw)} ${f1(y - d * 1.4)} ${f1(x + bw + w * 0.02)} ${f1(y - d * 0.4)}L${f1(x + bw)} ${f1(y)}H${f1(x)}Z" fill="#f7f4ef"/>`;
    b += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" fill="url(#kb)"/><path d="M${f1(x + bw)} ${f1(y)}L${f1(x + bw + w * 0.06)} ${f1(y - d)}V${f1(y + bh - d)}L${f1(x + bw)} ${f1(y + bh)}Z" fill="#8a6a46"/>`;
    b += `<path d="M${f1(x)} ${f1(y)}L${f1(x - w * 0.08)} ${f1(y - h * 0.06)}L${f1(x - w * 0.04)} ${f1(y + h * 0.02)}Z" fill="#c9a575"/><path d="M${f1(x + bw * 0.45)} ${f1(y)}V${f1(y + bh)}" stroke="#e8dcc6" stroke-width="${f1(w * 0.03)}" opacity=".55"/>`;
    return { defs: `<linearGradient id="kb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c49a66"/><stop offset="1" stop-color="#9c7448"/></linearGradient>`, body: b };
  },
};

function art(slot, ctx) {
  const ph = ctx.art.photo('feed', slot.slot);
  if (ph) return ph;
  const { c, seed, art: Art } = ctx;
  const clips = clipsOf(c || {});
  const used = new Set();
  const scenes = clips.map((w) => {
    const s = sceneOf(`${w.title} ${w.detail}`, used);
    used.add(s);
    return s;
  });
  const k = slot.slot === 'hero' ? 0 : /^w(\d+)$/.test(slot.slot) ? +slot.slot.slice(1) : -1;
  if (k < 0) return null;
  const w = slot.w, h = slot.h;
  const S = SCENE[scenes[k]] || SCENE.parcel;
  const out = S(w, h);
  void Art.rng(seed);
  // A soft vignette and fine grain over every frame, like a phone's camera indoors.
  const defs = `${out.defs}<filter id="sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f1(w * 0.018)}"/></filter><radialGradient id="vg" cx=".5" cy=".45" r=".8"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient><filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .06 0"/></filter>`;
  return Art.svgDoc(w, h, defs, `${out.body}<rect width="${w}" height="${h}" fill="url(#vg)"/><rect width="${w}" height="${h}" filter="url(#gr)"/>`);
}

// ---------- page ----------

function footer(c) {
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('');
  return `<footer class="fd-ftr"><div class="wrap fd-ftr-in">
<p class="fd-ftr-n">${esc(c.name)}${c.handle ? `<span>${esc(c.handle)}</span>` : ''}</p>
${reach ? `<p class="fd-ftr-c">${reach}</p>` : ''}${P.socials(c, { cls: 'fd-ftr-so', size: 18 })}
<p class="fd-ftr-y">&copy; ${esc(c.year)}</p>
</div></footer>`;
}

function render(c) {
  const clips = clipsOf(c);
  const has = clips.length > 0;
  const brands = brandsOf(c, clips);
  const { usage, rest } = usageOf(c);
  const own = ownAbout(c);
  const handle = c.handle || c.name;
  const cta = c.primary;
  const btn = (l, cls = 'btn btn-primary fd-btn') => P.button(l, cls).replace('<a ', '<a data-mag ');
  const rates = c.services.filter((s) => s.name);
  const hook = c.heroTitle;
  const lead = c.tagline || (own.length ? '' : c.heroSub.replace(/^I'm [^.]+\.\s*/, ''));

  // The clips. The first carries the page's caption (the h1, typed in); each has the creator's handle, its own line,
  // its link and a scrubber with its real length.
  const frame = (k) => P.img(c, k.i ? `w${k.i}` : 'hero', { eager: !k.i, cls: 'fd-img' });
  const clipHtml = (k) => {
    const len = k.secs ? `<span class="fd-time" aria-hidden="true">0:00 / ${clock(k.secs)}</span>` : '';
    return `<li class="fd-clip${k.i ? '' : ' first cur'}" data-sc-part style="--dur:${Math.min(9, Math.max(3, k.secs || 6))}s">
<div class="fd-frame">${frame(k)}<span class="fd-sheen" aria-hidden="true"></span></div>
<div class="fd-ui">
${k.i ? `<p class="fd-cap"><span>${esc(k.title)}</span></p>` : `<div class="fd-capw"><h1 class="fd-cap" id="hero-title" data-ci="head">${esc(hook)}</h1></div>`}
<div class="fd-meta"><p class="fd-who">${esc(handle)}</p>${k.i ? '' : `<p class="fd-line"><b>${esc(k.title)}</b></p>`}${k.detail ? `<p class="fd-line">${esc(k.detail)}</p>` : ''}${k.href ? `<a class="fd-watch" href="${esc(k.href)}" target="_blank" rel="noopener">${esc(k.linkLabel || 'Watch')}<span class="sr-only"> ${esc(k.title)}</span></a>` : ''}</div>
<div class="fd-scrub" aria-hidden="true"><span class="fd-bar"><i></i></span>${len}</div>
</div>
</li>`;
  };

  const intro = `<div class="fd-intro">
${has ? `<p class="fd-name">${esc(c.name)}</p>` : ''}
${lead ? `<p class="fd-sub" data-ci="then">${esc(lead)}</p>` : ''}
<div class="fd-ctas" data-ci="then">${btn(cta)}${rates.length ? `<a class="fd-link" href="#rates">See rates</a>` : ''}</div>
</div>`;

  const brandList = brands.length
    ? `<div class="fd-brands"><h2 class="fd-kick">Made videos for</h2><ul>${brands.map((b, i) => `<li class="fd-brand" data-k="${b.k}" style="--i:${i}"><span class="fd-bn">${esc(b.name)}</span>${b.kind ? `<span class="fd-bk">${esc(b.kind)}</span>` : ''}</li>`).join('')}</ul></div>`
    : '';

  const hero = has
    ? `<section class="fd-hero" id="videos" aria-labelledby="hero-title" data-sc style="--nc:${clips.length}">
<div class="fd-stage" data-sc-stage>
<div class="wrap fd-grid">
${intro}
<div class="fd-phone" data-ci="subject"><span class="fd-island" aria-hidden="true"></span><ol class="fd-feed" aria-label="Videos">${clips.map(clipHtml).join('')}</ol></div>
${brandList}
</div>
</div>
</section>`
    : `<section class="fd-hero solo" aria-labelledby="hero-title"><div class="wrap fd-solo"><h1 class="fd-solo-t" id="hero-title" data-ci="head">${esc(c.name)}</h1>${intro}${brandList}</div></section>`;

  // Rates and usage, side by side, plainly.
  const rateList = rates.length ? `<div class="fd-col" id="rates"><h2 class="fd-h2">Rates</h2><ul class="fd-rates">${rates.map((s) => `<li><span class="fd-rn">${esc(s.name)}</span>${s.priceText ? `<span class="fd-price">${esc(s.priceText)}</span>` : ''}${s.blurb ? `<span class="fd-rb">${esc(s.blurb)}</span>` : ''}</li>`).join('')}</ul></div>` : '';
  const useList = usage.length ? `<div class="fd-col" id="usage"><h2 class="fd-h2">Usage rights</h2><ul class="fd-use">${usage.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : '';
  const restList = rest.length ? `<div class="fd-with"><h3 class="fd-kick">Every video comes with</h3><ul>${rest.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : '';
  const terms = rateList || useList || restList
    ? `<section class="fd-sec fd-terms" aria-label="Rates and usage"><div class="wrap"><div class="fd-terms-in">${rateList}${useList}</div>${restList}</div></section>`
    : '';

  const about = own.length
    ? `<section class="fd-sec fd-about" aria-labelledby="about-title"><div class="wrap fd-about-in"><h2 class="fd-kick" id="about-title">${esc(c.owner && c.owner !== c.name ? `About ${c.owner}` : `About ${c.name}`)}</h2><div>${own.map((p, i) => `<p class="fd-say${i ? ' more' : ''}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="fd-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="fd-h2" id="reviews-title">From brands</h2><div class="fd-rv">${P.reviews(c)}</div></div></section>` : '';
  const asked = c.faq.length >= 2 ? `<section class="fd-sec" aria-labelledby="asked-title"><div class="wrap fd-asked"><h2 class="fd-h2" id="asked-title">Questions</h2><dl>${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  // The brief: what a brand would send anyway, from the member's own deliverables.
  const opts = rates.map((s) => s.name);
  const fields = [
    'name',
    'email',
    { name: 'brand', label: 'Brand', type: 'text', auto: 'organization', required: true, half: true },
    { name: 'site', label: 'Brand website', type: 'url', half: true },
    { name: 'product', label: 'The product', type: 'text', placeholder: 'What it is and who it is for' },
    opts.length ? { name: 'deliverables', label: 'What you need', type: 'select', options: [...opts, 'Not sure yet'], half: true } : null,
    { name: 'usage', label: 'Where it will run', type: 'select', options: ['Your own pages', 'Paid ads', 'Both', 'Not sure yet'], half: true },
    { name: 'when', label: 'When you need it', type: 'text', half: true },
    { name: 'message', label: 'Anything else', type: 'textarea' },
  ].filter(Boolean);
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean);
  const brief = `<section class="fd-sec fd-brief" id="contact" aria-labelledby="brief-title"><div class="wrap fd-brief-in">
<div class="fd-brief-h"><h2 class="fd-h2" id="brief-title">Send a brief</h2>${c.ctaSub ? `<p class="fd-sub">${esc(c.ctaSub)}</p>` : ''}${c.booking ? `<div class="fd-ctas">${btn(c.booking, 'btn btn-ghost fd-ghost')}</div>` : ''}${reach.length ? `<p class="fd-reach">${reach.join('')}</p>` : ''}</div>
<div class="fd-form">${P.form(c, { id: 'brief', fields, submit: 'Send the brief', subject: `A brief for ${c.name}`, note: false })}</div>
</div></section>`;

  const m = motion();
  const header = P.header(c, { cls: 'fd-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm fd-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr');
  const body = [header, '<main id="main">', hero, terms, about, reviews, asked, brief, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '14px', radiusSm: '10px', btnRadius: '999px', max: '80rem' } };
}

// The feed's own script. Wide screens (the runtime pins the section): the clip on screen is the runtime's current part;
// its brand card lights. Phones: each clip plays its scrubber once as it reaches the middle of the screen.
const JS = `(function(){var s=document.querySelector('.fd-hero[data-sc]');if(!s||!document.documentElement.classList.contains('m'))return;
var cl=[].slice.call(s.querySelectorAll('.fd-clip')),br=[].slice.call(s.querySelectorAll('.fd-brand'));
function lit(){var k=-1;cl.forEach(function(e,i){if(e.classList.contains('cur')||e.classList.contains('play'))k=i});br.forEach(function(b){b.classList.toggle('lit',+b.dataset.k===k)})}
new MutationObserver(lit).observe(s,{attributes:true,subtree:true,attributeFilter:['class']});
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){cl.forEach(function(x){x.classList.toggle('play',x===e.target)})}})},{rootMargin:'-45% 0px -45% 0px'});cl.forEach(function(e){io.observe(e)})}
lit()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Feed Display Fallback';font-weight:600 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:102%;ascent-override:98.1%;descent-override:24.5%;line-gap-override:0%}
@font-face{font-family:'Feed Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:100.7%;ascent-override:99.3%;descent-override:24.8%;line-gap-override:0%}
html:root{--font-display:"Funnel Display","Feed Display Fallback",sans-serif;--font-body:"Funnel Sans","Feed Body Fallback",sans-serif;
--bg:#f6f3ee;--ink:#171513;--muted:#5f5a53;--line:rgba(40,30,20,.14);--card:#fffdfa;--card-edge:rgba(40,30,20,.08);--sh:0 1px 2px rgba(40,30,20,.06),0 14px 34px -16px rgba(40,30,20,.22);--btn:#171513;--on-btn:#fffdfa;--bezel:#121212;--focus:var(--primary-text)}
html[data-theme="dark"]{--bg:#100f0e;--ink:#f3efe9;--muted:#aaa49b;--line:rgba(255,255,255,.12);--card:#1a1917;--card-edge:rgba(255,255,255,.09);--sh:0 1px 0 rgba(255,255,255,.06) inset;--btn:#f3efe9;--on-btn:#100f0e;--bezel:#000}
body{background:var(--bg);color:var(--ink)}
h1,h2,h3{font-family:var(--font-display);letter-spacing:-.02em}
.fd-btn,.mbar .btn-primary,.menu-panel .btn-primary,.form .btn-primary{background:var(--btn);color:var(--on-btn);box-shadow:none;font-weight:600}
.fd-btn:hover,.mbar .btn-primary:hover,.form .btn-primary:hover{background:var(--btn);color:var(--on-btn);opacity:.88}
.btn-sm{min-height:2.4rem;padding:.45rem 1.1rem;font-size:.9rem}
.hdr{background:color-mix(in srgb,var(--bg) 92%,transparent);border-bottom:1px solid transparent}
.hdr-in{display:flex;align-items:center;gap:1rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:700;font-size:1.1rem;letter-spacing:-.02em;text-decoration:none}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.92rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.mode-tg{border-color:var(--line)}
.menu>summary{background:transparent;border-color:var(--line);color:var(--ink)}
.menu-panel{background:var(--card);border-color:var(--line)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.fd-h2{font-size:clamp(2rem,1.5rem + 2vw,3.2rem);font-weight:700;line-height:1;letter-spacing:-.03em}
.fd-kick{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:0;color:var(--muted)}
.fd-sub{max-width:32rem;font-size:clamp(1.05rem,1rem + .3vw,1.25rem);line-height:1.5;color:var(--muted)}
.fd-ctas{display:flex;flex-wrap:wrap;gap:.8rem 1.4rem;align-items:center}
.fd-link{color:var(--ink);font-weight:600;text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:2px;text-underline-offset:.3em}

/* hero: on a phone the clips are the page, the first full screen under its caption; wide screens hold the phone */
.fd-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:1.6rem}
@media (max-width:47.99rem){
.fd-grid{padding-inline:0;gap:0}
.fd-phone,.fd-feed{display:contents}
.fd-island{display:none}
.fd-clip.first{order:-2}
.fd-intro{order:-1;padding:1.6rem var(--gutter,1.25rem) 1.8rem}
.fd-brands{order:0;padding:0 var(--gutter,1.25rem) 2rem}
.fd-clip{order:1;margin-bottom:8px;border-radius:14px}
.fd-clip.first{border-radius:0 0 14px 14px}
}
.fd-intro{display:grid;gap:1rem;justify-items:start}
.fd-name{font-family:var(--font-display);font-size:clamp(2.6rem,1.6rem + 4vw,5.4rem);font-weight:800;line-height:.92;letter-spacing:-.045em}
/* a clip: the frame, a scrim top and bottom, the caption, the handle and line, the scrubber */
.fd-clip{position:relative;overflow:hidden;background:#0c0c0c;color:#fff;aspect-ratio:9/16;max-height:calc(100svh - 3.75rem);width:100%}
.fd-clip:not(.first){aspect-ratio:4/5}
.fd-frame{position:absolute;inset:0}
.fd-img{width:100%;height:100%;object-fit:cover}
.fd-sheen{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.16) 50%,transparent 65%);transform:translateX(-120%);pointer-events:none}
.fd-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:1.1rem 1rem .9rem;background:linear-gradient(to bottom,rgba(0,0,0,.42),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.62))}
.fd-capw{max-width:20ch;margin-top:12%}
.fd-cap{font-family:var(--font-body);font-size:clamp(1.55rem,1.2rem + 1.6vw,2.1rem);font-weight:700;line-height:1.14;letter-spacing:-.01em;text-wrap:balance;text-shadow:0 1px 2px rgba(0,0,0,.45);color:#fff}
p.fd-cap{font-size:clamp(1.2rem,1rem + 1vw,1.5rem);max-width:18ch;margin-top:8%}
/* the caption sits on solid ground, the way a clip's text sticker does: a near-black box behind each line, so it reads
   on any frame, light or dark */
h1.fd-cap{display:inline;line-height:1.32}
h1.fd-cap,p.fd-cap>span{background:#111;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:.14em .32em;border-radius:4px;text-shadow:none}
p.fd-cap{line-height:1.36}
.fd-capw{margin-left:.32em}
p.fd-cap>span{margin-left:.32em}
.fd-meta{display:grid;gap:.25rem;justify-items:start;margin-top:auto;padding-bottom:.7rem;max-width:28ch;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.fd-who{font-weight:700;font-size:.98rem}
.fd-line{font-size:.92rem;line-height:1.35;color:rgba(255,255,255,.92)}
.fd-line b{font-weight:600}
.fd-watch{margin-top:.35rem;font-size:.88rem;font-weight:600;color:#fff;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.25em}
.fd-scrub{display:flex;align-items:center;gap:.7rem}
.fd-bar{position:relative;flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}
.fd-bar i{position:absolute;inset:0;background:var(--primary-on-dark,var(--pop));transform-origin:0 50%;transform:scaleX(.35)}
.fd-time{font-size:.74rem;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.88)}
/* brands: cards, each tied to its clip */
.fd-brands{display:grid;gap:.8rem}
.fd-brands ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}
.fd-brand{display:grid;gap:.15rem;padding:.85rem 1rem;border-radius:12px;background:var(--card);box-shadow:var(--sh);border:1px solid var(--card-edge);transition:border-color .35s ease,box-shadow .35s ease}
.fd-bn{font-family:var(--font-display);font-weight:700;font-size:1.05rem;letter-spacing:-.015em;line-height:1.15}
.fd-bk{font-size:.84rem;color:var(--muted)}
.fd-brand.lit{border-color:var(--pop);box-shadow:var(--sh),0 0 0 1px var(--pop)}
/* the motion: phones play each clip's scrubber once as it reaches the middle; the light passes over its frame */
html.m .fd-bar i{transform:scaleX(0)}
html.m .fd-clip.play .fd-bar i{transform:scaleX(1);transition:transform var(--dur,6s) linear}
html.m .fd-clip.play .fd-sheen{transform:translateX(120%);transition:transform 2.4s cubic-bezier(.4,0,.2,1) .3s}
html.m .fd-clip .fd-img{transform:scale(1.06);transition:transform 3.5s cubic-bezier(.2,.8,.2,1)}
html.m .fd-clip.play .fd-img,html.m .fd-clip.cur .fd-img{transform:none}
/* wide screens: the text, the phone, the brands; the phone holds while the scroll flicks through the clips */
@media (min-width:48rem){
.fd-stage{padding-block:clamp(1.5rem,1rem + 2vw,3rem)}
.fd-grid{grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:clamp(2rem,1rem + 3vw,5rem)}
.fd-intro{grid-row:1}
.fd-brands{grid-column:1;grid-row:2;align-self:start}
.fd-phone{grid-column:2;grid-row:1/3;position:relative;width:min(25rem,calc((100svh - 9rem) * 9 / 19.5));aspect-ratio:9/19.5;padding:10px;border-radius:3rem;background:var(--bezel);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 2px 0 1px rgba(255,255,255,.05),0 50px 90px -40px rgba(30,20,10,.55)}
html[data-theme="dark"] .fd-phone{box-shadow:0 0 0 1px rgba(255,255,255,.14),0 50px 90px -40px rgba(0,0,0,.8)}
.fd-island{position:absolute;z-index:3;top:20px;left:50%;width:28%;height:22px;transform:translateX(-50%);border-radius:12px;background:#000}
.fd-feed{position:relative;width:100%;height:100%;border-radius:2.4rem;overflow-y:auto;overscroll-behavior:contain;scroll-snap-type:y mandatory;scrollbar-width:none;background:#000}
.fd-feed::-webkit-scrollbar{display:none}
.fd-clip,.fd-clip:not(.first){aspect-ratio:auto;max-height:none;height:100%;scroll-snap-align:start}
.fd-capw{margin-top:22%}
p.fd-cap{margin-top:18%}
}
@media (min-width:64rem){
.fd-grid{grid-template-columns:minmax(0,1fr) auto minmax(0,.72fr);column-gap:clamp(2rem,1rem + 3vw,5rem)}
.fd-intro{grid-column:1;grid-row:1/3;align-self:center}
.fd-phone{grid-column:2;grid-row:1/3}
.fd-brands{grid-column:3;grid-row:1/3;align-self:center}
.fd-brands ul{grid-template-columns:minmax(0,1fr)}
.fd-brand:nth-child(even){margin-left:clamp(1rem,2vw,2.4rem);margin-right:calc(-1 * clamp(1rem,2vw,2.4rem))}
}
/* a wide screen with a mouse and motion on: the runtime pins the section and the scroll flicks the clips up, each
   one's scrubber running with the scroll while it is on screen */
@media (min-width:48rem) and (hover:hover){
html.m .fd-hero[data-sc]{height:calc(100vh + min(160vh,var(--nc,4) * 34vh))!important;height:calc(100svh + min(160svh,var(--nc,4) * 34svh))!important}
html.m .fd-stage{min-height:0!important;height:100vh;height:100svh;display:grid;align-items:center}
html.m .fd-feed{overflow:hidden}
html.m .fd-clip{position:absolute;inset:0;transform:translateY(calc((1 - clamp(0,var(--pi,0) * 3,1)) * 101%))}
html.m .fd-clip.first{transform:none}
html.m .fd-clip .fd-bar i{transform:scaleX(clamp(0,(var(--pi,0) - .33) * 1.6,1));transition:none}
html.m .fd-clip.first .fd-bar i{transform:scaleX(clamp(.02,var(--p,0) * var(--nc,4) * 1.2,1))}
html.m .fd-clip.cur .fd-sheen{transform:translateX(120%);transition:transform 2.4s cubic-bezier(.4,0,.2,1) .2s}
}
.fd-solo{display:grid;gap:2rem;padding-block:clamp(3rem,2rem + 4vw,6rem)}
.fd-solo-t{font-size:clamp(2.6rem,1.6rem + 4vw,5rem);font-weight:800;line-height:.95;letter-spacing:-.04em;max-width:18ch}
/* sections */
.fd-sec{padding-block:clamp(4rem,3rem + 4vw,7rem)}
.fd-terms-in{display:grid;gap:3rem}
@media (min-width:60rem){.fd-terms-in{grid-template-columns:7fr 5fr;gap:4rem}}
.fd-col{display:grid;gap:1.6rem;align-content:start}
.fd-rates{display:grid;gap:.6rem}
.fd-rates li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.2rem 1rem;padding:1.1rem 1.2rem;border-radius:14px;background:var(--card);border:1px solid var(--card-edge);box-shadow:var(--sh)}
.fd-rn{font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-.015em}
.fd-price{font-family:var(--font-display);font-size:1.25rem;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.fd-rb{grid-column:1/-1;color:var(--muted);font-size:.95rem}
.fd-use{display:grid;border-top:1px solid var(--ink)}
.fd-use li{padding:1rem 0;border-bottom:1px solid var(--line);font-size:1.08rem;line-height:1.4}
.fd-with{margin-top:3rem;display:grid;gap:.9rem}
.fd-with ul{display:flex;flex-wrap:wrap;gap:.5rem 2rem}
.fd-with li{font-weight:500}
.fd-about-in{display:grid;gap:1.2rem}
@media (min-width:60rem){.fd-about-in{grid-template-columns:3fr 9fr;gap:4rem}}
.fd-say{font-family:var(--font-display);font-size:clamp(1.4rem,1.1rem + 1.3vw,2.3rem);font-weight:600;line-height:1.22;letter-spacing:-.02em;max-width:32ch}
.fd-say.more{margin-top:1rem;font-family:var(--font-body);font-size:1.1rem;font-weight:400;color:var(--muted);letter-spacing:0;max-width:52ch}
.fd-rv{margin-top:2rem}
.review{border-radius:14px;background:var(--card);border:1px solid var(--card-edge);box-shadow:var(--sh)}
.fd-asked{display:grid;gap:2rem}
@media (min-width:60rem){.fd-asked{grid-template-columns:4fr 8fr;gap:4rem}}
.fd-asked dl div{display:grid;gap:.35rem;padding-block:1rem;border-bottom:1px solid var(--line)}
.fd-asked dt{font-weight:700}
.fd-asked dd{color:var(--muted)}
/* the brief */
.fd-brief-in{display:grid;gap:2rem}
@media (min-width:60rem){.fd-brief-in{grid-template-columns:5fr 7fr;gap:4rem}}
.fd-brief-h{display:grid;gap:1rem;align-content:start;justify-items:start}
.fd-reach{display:flex;flex-wrap:wrap;gap:.4rem 1.4rem}
.fd-reach a{color:var(--ink);text-decoration-color:var(--pop);text-underline-offset:.3em}
.fd-form{padding:clamp(1.2rem,1rem + 1vw,2rem);border-radius:18px;background:var(--card);border:1px solid var(--card-edge);box-shadow:var(--sh)}
.field input,.field select,.field textarea{background:var(--bg);border-color:var(--line);border-radius:10px;color:var(--ink)}
.fd-ghost{border-color:var(--line);color:var(--ink)}
/* footer */
.fd-ftr{padding-block:1.6rem;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
.fd-ftr-in{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.8rem}
.fd-ftr-n{margin-right:auto;font-family:var(--font-display);font-weight:700;color:var(--ink);display:flex;gap:.7rem;align-items:baseline}
.fd-ftr-n span{font-family:var(--font-body);font-weight:400;color:var(--muted)}
.fd-ftr-c{display:flex;flex-wrap:wrap;gap:.3rem 1.2rem}
.fd-ftr a{color:var(--muted);text-decoration:none}
.fd-ftr a:hover{color:var(--ink)}
.fd-ftr .legal-links{flex-basis:100%}
.fd-ftr .mpause,.fd-ftr .legal-links a{opacity:1;color:var(--muted)}
.mbar{background:var(--bg);border-top-color:var(--line);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Feed',
  bestFor: 'A UGC creator who makes videos for brands and wants a page to send them',
  // The motion, as data (lib/choreo.md): the caption typed onto the first clip, the brand cards drifting a little,
  // the clips flicking past with the scroll.
  choreo: { intro: 'type', alive: ['drift'], scroll: 'pin', pace: 'medium', look: 'daylight on a white counter, a phone playing the videos, brands beside it' },
  match: /\b(ugc|user.generated content|content creators? for brands|creators? for brands|brand content creator|whitelisting|spark ads)\b/,
  why: 'Built for a UGC creator: your videos play in a phone the way a brand will see them, the brands you made them for beside it, then your rates and usage rights set plainly and a brief form a brand can fill in.',
  fonts: { q: 'family=Funnel+Display:wght@600..800&family=Funnel+Sans:wght@400..700', display: ['Funnel Display', 'grotesk'], body: ['Funnel Sans', 'sans'] },
  modes: ['light', 'dark'],
  tokens,
  slots,
  nav,
  art,
  render,
};
