// Spotlight (animated, creator): a full creator page set like the cover and inside pages of a magazine about them.
//   Object: the cover. The creator's name is the masthead, their portrait is the cover photo (drawn as the cover shoot
//   until they add one), their first links are the cover lines, the rest the contents.
//   Material: cover stock and newsprint: warm uncoated paper, black ink, one photo, hairline rules, square corners.
//   One move: unfold. The masthead's words unfold up from their baseline like a turned page and the cover photo opens
//   from its centre; the cover lines follow.
//   Pop: a page number in the member's colour: the cover line or contents entry under the pointer, and each rate as its
//   page turns open. A number, never a fill.
// Then the rest of the contents (links not on the cover), the rates as a rate card whose pages turn open on their spine
// as you scroll (the scroll moment), the brands as masthead credits, the story set as a feature in two columns with a
// drop cap beside a second photo, real questions only, and a brand inquiry form. The cover leans toward the pointer and
// springs when tapped. No sparkles, no stickers, no loops. JavaScript off and reduced motion: the complete, still
// page, the masthead sized in CSS to fit. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');

const id = 'spotlight';

const f1 = (n) => String(Math.round(n));

// The cover shoot drawn for the photo slots, in line and the member's colours, like a studio comp for a magazine. A
// food creator gets the set from above: the skillet, the spoon, small bowls of what goes in, a linen towel; and at work,
// the board with the knife and the phone recording. Anyone else gets the phone on its tripod under a ring light, and a
// desk of notebook, phone and headphones.
function slKind(c) {
  return /food|cook|recipe|chef|bak|kitchen|eat|meal|grill|vegan/i.test(`${c.what} ${c.profile && c.profile.id}`) ? 'food' : 'set';
}

function spotlightArt(s, { p, c, seed, index, art }) {
  if (s.slot !== 'portrait' && s.slot !== 'work') return null;
  const { w, h } = s;
  const bg = art.wall({ style: 'portrait', w, h, p, seed, index, quiet: true });
  const r = art.rng(`${seed}:sl:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const ink = color.mix(p.ink, '#000000', 0.1);
  const sw = Math.max(2, m * 0.0045);
  const L = (k = 1, col = ink) => `fill="none" stroke="${col}" stroke-width="${f1(sw * k)}" stroke-linecap="round" stroke-linejoin="round"`;
  const F = (fill, k = 1) => `fill="${fill}" stroke="${ink}" stroke-width="${f1(sw * k)}" stroke-linejoin="round"`;
  const circ = (cx, cy, rx, ry = rx) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`;
  const shadow = (d, k = 1) => `<path d="${d}" fill="#000000" opacity=".22" transform="translate(${f1(m * 0.012 * k)} ${f1(m * 0.02 * k)})" filter="url(#sls)"/>`;
  const defs = bg.defs + `<filter id="sls" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(m * 0.012)}"/></filter>`;
  const steel = color.mix(p.ink, p.paper, 0.7);
  const iron = color.mix(p.ink, '#000000', 0.25);
  const wood = color.mix(color.mix(p.accent, p.ink, 0.35), p.paper, 0.3);
  const china = color.mix(p.paper, '#ffffff', 0.6);
  const herb = color.mix(p.accent, p.ink, 0.5);
  let body = bg.body;
  const chop = (n, at, sz, fill) => {
    let d = '';
    for (let i = 0; i < n; i++) { const [x, y] = at(), a = sz * R(0.6, 1.3); d += `M${f1(x)} ${f1(y)}l${f1(a)} ${f1(R(-0.3, 0.3) * a)}l${f1(R(-0.3, 0.3) * a)} ${f1(a)}l${f1(-a)} ${f1(R(-0.2, 0.2) * a)}Z`; }
    return `<path d="${d}" ${F(fill, 0.4)}/>`;
  };
  const leaf = (x, y, l, a, fill) => { const dx = Math.cos(a) * l, dy = Math.sin(a) * l; return `<path d="M${f1(x)} ${f1(y)}q${f1(dx / 2 - dy * 0.4)} ${f1(dy / 2 + dx * 0.4)} ${f1(dx)} ${f1(dy)}q${f1(-dx / 2 + dy * 0.4)} ${f1(-dy / 2 - dx * 0.4)} ${f1(-dx)} ${f1(-dy)}Z" ${F(fill, 0.5)}/>`; };
  const bowlOf = (x, y, rr, fill, what) => shadow(circ(x, y, rr), 0.5) + `<path d="${circ(x, y, rr)}" ${F(china)}/><path d="${circ(x, y, rr * 0.78)}" fill="${fill}"/>${what}<path d="${circ(x, y, rr * 0.78)}" ${L(0.5)}/>`;

  if (slKind(c) === 'food') {
    // The counter: a pale stone, a linen towel folded under the pan.
    body += `<rect width="${w}" height="${h}" fill="${color.mix(p.paper, p.ink, 0.06)}" opacity=".55"/>`;
    const towel = (x, y, tw, th, a) => {
      let st = '';
      for (let i = 1; i < 5; i++) st += `M${f1(x + tw * (i / 5))} ${f1(y)}v${f1(th)}`;
      return `<g transform="rotate(${f1(a)} ${f1(x + tw / 2)} ${f1(y + th / 2)})">${shadow(`M${f1(x)} ${f1(y)}h${f1(tw)}v${f1(th)}h${f1(-tw)}Z`, 0.5)}<rect x="${f1(x)}" y="${f1(y)}" width="${f1(tw)}" height="${f1(th)}" ${F(color.mix(p.primary, p.paper, 0.72), 0.6)}/><path d="${st}" ${L(2.2, color.mix(p.primary, p.paper, 0.4))}/></g>`;
    };
    if (s.slot === 'portrait') {
      const cx = w * 0.5, cy = h * 0.48, rr = w * 0.29;
      body += towel(w * 0.04, h * 0.58, w * 0.58, h * 0.3, -8);
      // The skillet: iron, its handle, what's cooking (pieces seared, greens, a sauce), a wooden spoon resting in it.
      const handle = `M${f1(cx + rr * 0.9)} ${f1(cy - rr * 0.18)}L${f1(w * 1.02)} ${f1(cy - rr * 0.5)}l${f1(w * 0.02)} ${f1(rr * 0.3)}L${f1(cx + rr * 0.95)} ${f1(cy + rr * 0.16)}Z`;
      body += shadow(circ(cx, cy, rr)) + `<path d="${handle}" ${F(iron)}/><path d="${circ(cx, cy, rr)}" ${F(iron)}/><path d="${circ(cx, cy, rr * 0.86)}" fill="${color.mix(p.primary, p.ink, 0.35)}"/>`;
      let food = '';
      for (let i = 0; i < 9; i++) { const a = R(0, 6.3), d = rr * R(0.1, 0.62), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, k = rr * R(0.1, 0.16); food += `<g transform="rotate(${f1(R(0, 180))} ${f1(x)} ${f1(y)})"><rect x="${f1(x - k)}" y="${f1(y - k * 0.6)}" width="${f1(k * 2)}" height="${f1(k * 1.2)}" rx="${f1(k * 0.4)}" ${F(color.mix(p.accent, p.primary, 0.45), 0.6)}/><path d="M${f1(x - k * 0.6)} ${f1(y - k * 0.2)}h${f1(k * 1.2)}M${f1(x - k * 0.6)} ${f1(y + k * 0.25)}h${f1(k * 1.2)}" ${L(1.4, color.mix(p.primary, p.ink, 0.5))}/></g>`; }
      for (let i = 0; i < 7; i++) { const a = R(0, 6.3), d = rr * R(0.1, 0.7); food += leaf(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr * 0.16, R(0, 6.3), herb); }
      body += food + `<path d="${circ(cx, cy, rr * 0.86)}" ${L(0.6)}/>`;
      body += `<g transform="rotate(-32 ${f1(cx)} ${f1(cy)})">${shadow(`M${f1(cx - rr * 0.1)} ${f1(cy - rr * 0.2)}h${f1(rr * 1.9)}v${f1(rr * 0.1)}h${f1(-rr * 1.9)}Z`, 0.4)}<path d="${circ(cx - rr * 0.02, cy - rr * 0.15, rr * 0.2, rr * 0.13)}" ${F(wood)}/><rect x="${f1(cx + rr * 0.16)}" y="${f1(cy - rr * 0.19)}" width="${f1(rr * 1.15)}" height="${f1(rr * 0.07)}" rx="${f1(rr * 0.04)}" ${F(wood)}/></g>`;
      // Small bowls of what goes in: salt, chopped onion, chilli.
      body += bowlOf(w * 0.13, h * 0.27, w * 0.08, color.mix(p.paper, '#ffffff', 0.5), chop(9, () => [w * 0.13 + R(-0.04, 0.02) * w, h * 0.27 + R(-0.04, 0.02) * w], w * 0.012, china));
      body += bowlOf(w * 0.84, h * 0.7, w * 0.11, color.mix(p.paper, p.accent, 0.2), chop(10, () => [w * 0.84 + R(-0.06, 0.03) * w, h * 0.7 + R(-0.06, 0.03) * w], w * 0.02, color.mix(p.paper, '#ffffff', 0.4)));
      body += bowlOf(w * 0.22, h * 0.75, w * 0.09, color.mix(p.primary, p.paper, 0.2), chop(7, () => [w * 0.22 + R(-0.05, 0.03) * w, h * 0.75 + R(-0.05, 0.03) * w], w * 0.016, p.primary));
    } else {
      // At work: the board, sliced vegetables, the knife, and the phone lying beside it, recording.
      const bx = w * 0.12, by = h * 0.18, bw = w * 0.56, bh = h * 0.62;
      body += shadow(`M${f1(bx)} ${f1(by)}h${f1(bw)}v${f1(bh)}h${f1(-bw)}Z`) + `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(bw * 0.04)}" ${F(wood)}/>`;
      let gr = '';
      for (let i = 0; i < 7; i++) { const y = by + bh * R(0.1, 0.9); gr += `M${f1(bx + bw * 0.06)} ${f1(y)}q${f1(bw * 0.4)} ${f1(R(-8, 8))} ${f1(bw * 0.86)} 0`; }
      body += `<path d="${gr}" ${L(0.6, color.mix(wood, ink, 0.3))}/>`;
      // Rounds of a vegetable, sliced and fanned.
      for (let i = 0; i < 6; i++) { const x = bx + bw * (0.18 + i * 0.075), y = by + bh * (0.32 + i * 0.03), rr = bh * 0.085; body += `<path d="${circ(x, y, rr)}" ${F(color.mix(p.primary, p.paper, 0.2), 0.7)}/><path d="${circ(x, y, rr * 0.62)}" fill="${color.mix(p.primary, p.paper, 0.5)}"/>`; }
      body += chop(16, () => [bx + bw * R(0.2, 0.6), by + bh * R(0.6, 0.8)], bh * 0.03, color.mix(p.accent, p.paper, 0.4));
      body += `<g transform="rotate(-12 ${f1(bx + bw * 0.5)} ${f1(by + bh * 0.5)})">${shadow(`M${f1(bx + bw * 0.1)} ${f1(by + bh * 0.48)}h${f1(bw * 0.9)}v${f1(bh * 0.06)}h${f1(-bw * 0.9)}Z`, 0.4)}<path d="M${f1(bx + bw * 0.1)} ${f1(by + bh * 0.52)}h${f1(bw * 0.52)}l${f1(bw * 0.08)} ${f1(-bh * 0.07)}V${f1(by + bh * 0.56)}H${f1(bx + bw * 0.1)}Z" ${F(steel)}/><rect x="${f1(bx + bw * 0.7)}" y="${f1(by + bh * 0.5)}" width="${f1(bw * 0.34)}" height="${f1(bh * 0.07)}" rx="${f1(bh * 0.02)}" ${F(ink)}/></g>`;
      const px = w * 0.74, py = h * 0.24, pw = w * 0.18, ph = pw * 2.05;
      body += `<g transform="rotate(8 ${f1(px + pw / 2)} ${f1(py + ph / 2)})">${shadow(`M${f1(px)} ${f1(py)}h${f1(pw)}v${f1(ph)}h${f1(-pw)}Z`, 0.5)}<rect x="${f1(px)}" y="${f1(py)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(pw * 0.16)}" ${F(iron)}/><rect x="${f1(px + pw * 0.07)}" y="${f1(py + pw * 0.07)}" width="${f1(pw * 0.86)}" height="${f1(ph - pw * 0.14)}" rx="${f1(pw * 0.1)}" fill="${color.mix(p.primary, p.ink, 0.25)}"/><path d="${circ(px + pw * 0.5, py + ph * 0.84, pw * 0.13)}" fill="none" stroke="${china}" stroke-width="${f1(sw * 1.2)}"/><path d="${circ(px + pw * 0.5, py + ph * 0.84, pw * 0.08)}" fill="${p.primary}"/><path d="M${f1(px + pw * 0.2)} ${f1(py + ph * 0.12)}h${f1(pw * 0.25)}" ${L(1.6, china)}/></g>`;
    }
  } else {
    if (s.slot === 'portrait') {
      // The set: a ring light on its stand, the phone in its clamp at the centre, the tripod's legs.
      const cx = w * 0.5, cy = h * 0.36, rr = w * 0.27;
      body += shadow(circ(cx, cy, rr)) + `<path d="${circ(cx, cy, rr)}${circ(cx, cy, rr * 0.78)}" fill="${color.mix(p.paper, '#ffffff', 0.7)}" fill-rule="evenodd" stroke="${ink}" stroke-width="${f1(sw)}"/><path d="${circ(cx, cy, rr * 0.89)}" ${L(0.5, color.mix(p.paper, ink, 0.2))}/>`;
      body += `<path d="M${f1(cx)} ${f1(cy + rr)}V${f1(h * 0.78)}M${f1(cx)} ${f1(h * 0.78)}L${f1(cx - w * 0.22)} ${f1(h * 0.97)}M${f1(cx)} ${f1(h * 0.78)}L${f1(cx + w * 0.22)} ${f1(h * 0.97)}M${f1(cx)} ${f1(h * 0.78)}V${f1(h * 0.99)}" ${L(3.2)}/><path d="M${f1(cx)} ${f1(cy)}V${f1(cy + rr)}" ${L(2)}/>`;
      const pw = w * 0.14, ph = pw * 2;
      body += `<rect x="${f1(cx - pw / 2)}" y="${f1(cy - ph / 2)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(pw * 0.16)}" ${F(iron)}/><rect x="${f1(cx - pw * 0.42)}" y="${f1(cy - ph * 0.45)}" width="${f1(pw * 0.84)}" height="${f1(ph * 0.9)}" rx="${f1(pw * 0.1)}" fill="${color.mix(p.primary, p.ink, 0.3)}"/><path d="M${f1(cx - pw * 0.7)} ${f1(cy - ph * 0.08)}h${f1(pw * 1.4)}v${f1(ph * 0.16)}h${f1(-pw * 1.4)}Z" ${F(steel, 0.8)}/>`;
    } else {
      // The desk: notebook open with its lines, a pen, the phone, headphones.
      body += shadow(`M${f1(w * 0.1)} ${f1(h * 0.2)}h${f1(w * 0.5)}v${f1(h * 0.6)}h${f1(-w * 0.5)}Z`) + `<rect x="${f1(w * 0.1)}" y="${f1(h * 0.2)}" width="${f1(w * 0.5)}" height="${f1(h * 0.6)}" ${F(china)}/><path d="M${f1(w * 0.35)} ${f1(h * 0.2)}v${f1(h * 0.6)}" ${L(0.8)}/>`;
      let ln = '';
      for (let i = 0; i < 8; i++) ln += `M${f1(w * 0.13)} ${f1(h * (0.3 + i * 0.06))}h${f1(w * R(0.12, 0.19))}M${f1(w * 0.38)} ${f1(h * (0.3 + i * 0.06))}h${f1(w * R(0.1, 0.19))}`;
      body += `<path d="${ln}" ${L(0.7, color.mix(ink, china, 0.4))}/><path d="M${f1(w * 0.64)} ${f1(h * 0.3)}l${f1(w * 0.04)} ${f1(h * 0.42)}" ${L(3, p.primary)}/>`;
      body += `<path d="M${f1(w * 0.72)} ${f1(h * 0.62)}a${f1(w * 0.11)} ${f1(w * 0.11)} 0 0 1 ${f1(w * 0.22)} 0" ${L(3.2)}/><rect x="${f1(w * 0.69)}" y="${f1(h * 0.6)}" width="${f1(w * 0.06)}" height="${f1(h * 0.14)}" rx="${f1(w * 0.02)}" ${F(iron)}/><rect x="${f1(w * 0.91)}" y="${f1(h * 0.6)}" width="${f1(w * 0.06)}" height="${f1(h * 0.14)}" rx="${f1(w * 0.02)}" ${F(iron)}/>`;
    }
  }
  return art.svgDoc(w, h, defs, body);
}


function tokens(p) {
  return { bg: color.mix(p.paper, '#f4f4f1', 0.9), dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#14100d', 0.6) };
}

function slots(c) {
  const who = c.owner && c.owner !== c.name ? c.owner : c.name;
  return [
    { slot: 'portrait', file: 'portrait.jpg', w: 1200, h: 1500, style: 'portrait', alt: `${who}, ${c.whatShort || 'creator'}` },
    { slot: 'work', file: 'at-work.jpg', w: 1200, h: 900, style: 'tile', alt: `${who} at work` },
  ];
}

function nav(c) {
  return [
    c.links.length > 3 && { label: 'Contents', href: '#links' },
    c.services.length && { label: 'Rates', href: '#rates' },
    { label: 'About', href: '#about' },
    c.faq.length >= 2 && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// Where a link goes, from its address only.
const PLACES = [
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/instagram\.com/i, 'Instagram'],
  [/tiktok\.com/i, 'TikTok'],
  [/twitch\.tv/i, 'Twitch'],
  [/(^|\/\/|\.)x\.com|twitter\.com/i, 'X'],
  [/linkedin\.com/i, 'LinkedIn'],
  [/facebook\.com/i, 'Facebook'],
  [/spotify\.com|podcasts\.apple|anchor\.fm/i, 'Podcast'],
  [/substack\.com|beehiiv\.com|kit\.com|convertkit|buttondown/i, 'Newsletter'],
  [/pinterest\./i, 'Pinterest'],
  [/threads\.net/i, 'Threads'],
  [/etsy\.com|shopify|amazon\.|stan\.store|gumroad|bigcartel/i, 'Shop'],
];
function whereOf(l) {
  const hit = PLACES.find(([re]) => re.test(l.href));
  if (hit) return hit[1];
  if (/^mailto:/.test(l.href)) return 'Email';
  return String(l.href).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

// "YouTube: New recipe every Tuesday" -> kicker "YouTube", line "New recipe every Tuesday".
function split(l) {
  const m = String(l.label).match(/^([^:]{2,24}):\s*(.+)$/);
  return m ? { kick: m[1], line: m[2] } : { kick: whereOf(l), line: l.label };
}

// The masthead: words (the intro unfolds them), on as many lines as the markup says, sized in CSS from the longest
// line so the cover's height is fixed before the font arrives.
function masthead(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const n = words.join(' ').length;
  const lines = words.length > 1 && n > 13 ? 2 : 1;
  let groups = [words];
  if (lines === 2) {
    let best = null;
    for (let j = 1; j < words.length; j++) {
      const g = [words.slice(0, j), words.slice(j)];
      const worst = Math.max(...g.map((x) => x.join(' ').length));
      if (!best || worst < best.worst) best = { worst, g };
    }
    groups = best.g;
  }
  const longLine = Math.max(...groups.map((g) => g.join(' ').length));
  // Unbounded at 800, in capitals: about 0.82em a letter.
  const fs = Math.min(15, 112 / Math.max(longLine, 4)).toFixed(2);
  const fsm = Math.min(19, 108 / Math.max(Math.max(...words.map((w) => w.length)), 4)).toFixed(2);
  const html = groups.map((g) => `<span class="ml">${g.map((w) => `<span class="mw">${esc(w)}</span>`).join(' ')}</span>`).join(' ');
  // The widest line and the longest word in ems (Unbounded 800 caps, tight tracking, letter by letter), so CSS alone
  // sizes the masthead to its column with JavaScript off; the script only nudges it closer.
  const em = (t) => [...t.toUpperCase()].reduce((n, ch) => n + (/\s/.test(ch) ? 0.32 : /[IL1!.,']/.test(ch) ? 0.5 : /J/.test(ch) ? 0.75 : /[MW]/.test(ch) ? 1.12 : /[OQGCD]/.test(ch) ? 0.98 : 0.84), 0) * 1.02 + 0.05;
  const widest = (list) => Math.max(...list.map(em)).toFixed(2);
  return { html, fs, fsm, stack: words.length > 1, em: widest(groups.map((g) => g.join(' '))), emw: widest(words) };
}

function render(c) {
  const person = c.owner && c.owner !== c.name ? c.owner : c.name.split(/\s+/)[0];
  const mast = masthead(c.name);
  const mag = (html) => html.replace('<a ', '<a data-mag ');
  const links = c.links.map((l) => ({ ...l, ...split(l), where: whereOf(l) }));
  const cover = links.slice(0, 3);
  const folio = [c.handle, c.whatShort, c.area && !c.online ? c.area : ''].filter(Boolean);

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap">
${folio.length ? `<p class="folio" data-ci="then" data-ci-from="fade">${folio.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
<h1 class="mast${mast.stack ? ' stack' : ''}" id="hero-title" data-ci="head" style="--fs:${mast.fs}vw;--fsm:${mast.fsm}vw;--em:${mast.em};--emw:${mast.emw}">${mast.html}</h1>
<div class="cover-grid">
<figure class="cover" data-alive="0.5"><div class="cv" data-ci="subject">${P.img(c, 'portrait', { cls: 'cv-img', eager: true }).replace('<img ', '<img data-par="0.04" ')}</div></figure>
<div class="cover-side">
<p class="tagline" data-ci="then">${esc(c.heroSub)}</p>
${cover.length ? `<ul class="lines" data-ci="then" data-ci-from="mask">${cover.map((l, i) => `<li><a href="${esc(l.href)}"><span class="ln-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ln-k">${esc(l.kick)}</span><span class="ln-t">${esc(l.line)}</span>${icon('arrowUpRight', { size: 20 })}</a></li>`).join('')}</ul>` : ''}
<div class="ctas" data-ci="then"><a class="btn btn-ink btn-lg" data-mag href="#contact">Brand inquiries</a>${P.socials(c, { cls: 'hero-social' })}</div>
</div>
</div>
</div>
</section>`;

  // The contents page: the links that aren't on the cover, numbered on from the cover lines, with where each goes.
  const inside = links.slice(3);
  const contents = inside.length
    ? `<section class="sec contents" id="links" aria-labelledby="links-title"><div class="wrap ct-grid">
<h2 class="ct-title" id="links-title" data-split>Also inside</h2>
<ol class="toc" start="4">${inside.map((l, i) => `<li data-rv style="--d:${i % 6}"><a href="${esc(l.href)}"><span class="toc-n" aria-hidden="true">${String(i + 4).padStart(2, '0')}</span><span class="toc-t">${esc(l.line)}</span><span class="toc-w">${esc(l.kick === l.where ? l.where : `${l.kick}, ${l.where}`)}</span>${icon('arrowUpRight', { size: 22 })}</a></li>`).join('')}</ol>
</div></section>`
    : '';

  // The rates as the magazine's rate card: one page a format, its price set large, turning open on its spine as you
  // scroll (the scroll moment). Still frame: every page open.
  const inclList = c.included.length ? `<ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const rates = c.services.length
    ? `<section class="sec rates" id="rates" aria-labelledby="rates-title"><div class="wrap">
<div class="rc-head"><h2 class="h2" id="rates-title" data-split>Rates</h2>${c.services.length > 1 ? `<p class="rc-k">${c.services.length} formats</p>` : ''}</div>
<ol class="rc" data-sc>${c.services.map((sv, i) => `<li class="rc-page" data-sc-part><span class="rc-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(sv.name)}</h3>${sv.duration || sv.blurb ? `<p class="rc-sub">${esc([sv.duration, sv.blurb].filter(Boolean).join(', '))}</p>` : ''}${sv.priceText ? `<p class="rc-p">${esc(sv.priceText)}</p>` : ''}</li>`).join('')}</ol>
${inclList}
<p class="rc-go"><a class="btn btn-paper" href="#contact">Brand inquiries</a></p>
</div></section>`
    : '';

  const cl = c.clients || [];
  // The brands as the masthead's credits: a small label, the names in one ink, ruled like a magazine's staff box.
  const brands = cl.length
    ? `<section class="sec brands" aria-labelledby="brands-title"><div class="wrap credits">
<h2 class="cr-k" id="brands-title">Worked with</h2>
<ul class="cr-list">${cl.map((x, i) => `<li data-rv style="--d:${i % 6}">${esc(x)}</li>`).join('')}</ul>
</div></section>`
    : '';

  // The story as a feature: a kicker, the text in two columns with a drop cap, the second photo set beside it as a tall
  // plate with its caption.
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap feature">
<div class="ft-copy">
<h2 class="ft-k" id="about-title">${esc(`About ${person}`)}</h2>
<div class="ft-cols${c.aboutParas.join(' ').length > 360 ? ' two' : ''}" data-rv>${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
</div>
<figure class="ft-media" data-rv="mask"><div>${P.img(c, 'work', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div><figcaption>${esc(c.images.work ? c.images.work.alt : '')}</figcaption></figure>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">What people say</h2><div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div></div></section>`
    : '';
  // Questions only when there are two real ones, set as the letters page: the question in the display face, the answer
  // under it. No accordion.
  const faq = c.faq.length >= 2 ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="ct-title" id="faq-title" data-split>Good to know</h2><dl class="qa">${c.faq.map((f, i) => `<div data-rv style="--d:${Math.min(i + 1, 6)}"><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Brand' },
    c.services.length > 1 ? { name: 'interest', label: 'Interested in', type: 'select', options: [...c.services.map((s) => s.name), 'Something else'], half: true } : { ...P.FIELD_PRESETS.when, label: 'Timing' },
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the campaign', required: true },
  ];
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-copy">
<h2 class="contact-title" id="contact-title" data-split>Brand inquiries</h2>
<p class="lead" data-rv style="--d:3">Tell me about your brand and what you have in mind${c.email ? ', or write to me directly' : ''}.</p>
<div data-rv style="--d:4">${P.contactList(c, { cls: 'ct-list' })}</div>
</div>
<div class="form-wrap" data-rv style="--d:2">
${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [
    '<div class="prog" aria-hidden="true"></div>',
    P.header(c, { cls: 'hdr-sl', mark: false, cta: { label: 'Brand inquiries', href: '#contact' } }).replace('<header class="hdr', '<header data-hdr class="hdr'),
    '<main id="main">',
    hero,
    contents,
    rates,
    brands,
    about,
    reviews,
    faq,
    contact,
    '</main>',
    P.footer(c),
    P.mobileBar({ ...c, phone: null, primary: { label: 'Brand inquiries', href: '#contact', kind: 'form' } }),
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '80rem' } };
}

// Nudges the masthead to the width with a transform only (its size is set in CSS, so nothing shifts).
const JS = `(function(){var d=document,h=d.querySelector('.mast');
function fit(){if(!h)return;var ls=[].slice.call(h.querySelectorAll(innerWidth<640&&h.classList.contains('stack')?'.mw':'.ml'));ls.forEach(function(l){l.style.transform=''});var w=h.clientWidth,m=Math.max.apply(0,ls.map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.8,Math.min(1.12,w/m));h.style.setProperty('--fit',Math.abs(r-1)<.004?1:r.toFixed(3))}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit)})();`;

const CSS = `
${FOOTER_CSS}
:root{--ease:cubic-bezier(.16,1,.3,1);--rule:color-mix(in srgb,var(--ink) 16%,transparent)}
h1,h2,h3{font-weight:800;letter-spacing:-.04em}
.h2{font-size:clamp(2.2rem,1.4rem + 3.2vw,4.4rem);line-height:.98;text-transform:uppercase}
.lead{color:var(--muted)}
.btn{font-weight:700;letter-spacing:.01em}
.btn:hover{transform:none}
.btn-primary,.btn-ink{background:var(--ink);color:var(--bg);box-shadow:none;border-color:var(--ink)}
.btn-primary:hover,.btn-ink:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-paper{background:var(--on-dark);color:var(--dark)}
.btn-paper:hover{background:color-mix(in srgb,var(--on-dark) 85%,var(--dark))}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1rem;letter-spacing:-.02em;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;font-weight:600;font-size:.95rem;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 2px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(.5rem,.4rem + .8vw,1.25rem) clamp(3.5rem,2rem + 4vw,6rem)}
.folio{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 2rem;padding-block:.65rem;border-block:1px solid var(--ink);font-size:.92rem;font-weight:600}
.mast{--fit:1;margin-top:clamp(.75rem,1.5vw,1.5rem);font-size:min(var(--fs),calc(min(100vw - 4rem,var(--max)) / var(--em)));font-weight:800;line-height:.86;letter-spacing:-.045em;text-transform:uppercase;overflow:hidden;padding-block:.04em}
.ml{display:block;width:max-content;white-space:nowrap;transform:scale(var(--fit));transform-origin:0 50%}
.mw{display:inline-block}
@media (max-width:47.99rem){.mast{font-size:min(var(--fs),calc((100vw - 2rem) / var(--em)))}}
@media (max-width:39.99rem){.mast{font-size:min(var(--fsm),calc((100vw - 2rem) / var(--emw)))}.mast:not(.stack){font-size:min(var(--fsm),calc((100vw - 2rem) / var(--em)))}.mast.stack .ml{display:inline;transform:none}.mast.stack .mw{display:block;width:max-content;transform:scale(var(--fit));transform-origin:0 50%}}
.cover-grid{display:grid;gap:2rem;margin-top:clamp(1.25rem,1rem + 1.5vw,2.25rem)}
@media (min-width:60rem){.cover-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.cover{grid-column:1/8}.cover-side{grid-column:8/13}}
.cover{margin:0}
.cv{overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
@media (max-width:59.99rem){.cv{aspect-ratio:1}}
.cv-img{width:100%;height:110%;margin-top:-5%;object-fit:cover}
.tagline{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:700;line-height:1.08;letter-spacing:-.035em;text-wrap:balance}
.lines{margin-top:1.75rem;border-top:1px solid var(--ink)}
.lines a{display:grid;grid-template-columns:2.25rem minmax(0,1fr) auto;gap:.15rem .75rem;align-items:center;padding-block:.9rem;border-bottom:1px solid var(--rule);text-decoration:none}
.ln-n{grid-column:1;grid-row:1/3;align-self:start;padding-top:.1rem;font-family:var(--font-display);font-size:.95rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted);transition:color .2s ease}
.lines a:hover .ln-n,.lines a:focus-visible .ln-n,.toc a:hover .toc-n,.toc a:focus-visible .toc-n{color:var(--pop)}
.ln-k{grid-column:2;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ln-t{grid-column:2;font-size:1.15rem;font-weight:600;line-height:1.25}
.lines .i{grid-column:3;grid-row:1/3;transition:transform .35s var(--ease)}
.lines a:hover .ln-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:2px}
.lines a:hover .i{transform:translate(3px,-3px)}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.25rem;margin-top:1.75rem}
.socials a{border-width:1px;border-radius:0;width:2.75rem;height:2.75rem}
.contents{border-top:1px solid var(--ink)}
.ct-grid{display:grid;gap:2rem}
.ct-title{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:800;line-height:1;letter-spacing:-.04em;text-transform:uppercase}
@media (min-width:60rem){.ct-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.ct-grid>.ct-title{grid-column:1/4}.toc{grid-column:5/13}}
.toc{border-top:1px solid var(--ink)}
.toc a{display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;gap:.25rem 1rem;align-items:baseline;padding-block:clamp(1rem,.8rem + .8vw,1.5rem);border-bottom:1px solid var(--rule);text-decoration:none}
.toc-n{font-family:var(--font-display);font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted)}
.toc-t{font-family:var(--font-display);font-size:clamp(1.35rem,1.1rem + 1vw,2.1rem);font-weight:700;line-height:1.08;letter-spacing:-.035em}
.toc-w{grid-column:2;font-size:.85rem;font-weight:600;color:var(--muted)}
.toc .i{grid-column:3;grid-row:1/3;align-self:center;transition:transform .35s var(--ease)}
.toc a:hover .toc-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:.08em;text-underline-offset:.15em}
.toc a:hover .i{transform:translate(4px,-4px)}
.rates{background:var(--dark);color:var(--on-dark);--pop:var(--primary-on-dark);--focus:var(--on-dark)}
.rc-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.5rem 2rem;padding-bottom:1rem;border-bottom:1px solid var(--on-dark)}
.rc-k{font-weight:600;color:var(--muted-on-dark)}
.rc{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin-top:1.5rem;border-top:1px solid var(--line-on-dark);perspective:1600px}
.rc-page{display:grid;align-content:start;gap:.6rem;min-height:clamp(14rem,10rem + 10vw,20rem);padding:clamp(1.25rem,1rem + 1vw,2rem);border-left:1px solid var(--line-on-dark);border-bottom:1px solid var(--line-on-dark);background:var(--dark);transform-origin:0 50%;backface-visibility:hidden}
.rc-n{font-family:var(--font-display);font-size:.95rem;font-weight:700;color:var(--muted-on-dark);font-variant-numeric:tabular-nums}
.rc-page h3{font-size:clamp(1.25rem,1.05rem + .8vw,1.7rem);line-height:1.1;letter-spacing:-.035em}
.rc-sub{color:var(--muted-on-dark)}
.rc-p{margin-top:auto;padding-top:1.5rem;font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.2vw,3.6rem);font-weight:800;line-height:.95;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
html.m .rc[data-sc] .rc-page[data-sc-part]{transform:rotateY(calc((1 - var(--pi,1)) * -78deg))}
html.m .rc[data-sc] .rc-page.on .rc-n{color:var(--pop)}
.incl{display:flex;flex-wrap:wrap;gap:.5rem 2rem;margin-top:clamp(1.5rem,1rem + 2vw,2.5rem);color:var(--muted-on-dark)}
.rc-go{margin-top:clamp(1.5rem,1rem + 2vw,2.5rem)}
.credits{display:grid;gap:1rem;padding-block:.25rem}
@media (min-width:60rem){.credits{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.cr-k{grid-column:1/4}.cr-list{grid-column:5/13}}
.cr-k{font-family:var(--font-body);font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding-top:.6rem}
.cr-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));border-top:1px solid var(--ink)}
.cr-list li{padding-block:.75rem;border-bottom:1px solid var(--rule);font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .6vw,1.5rem);font-weight:700;letter-spacing:-.03em}
.about{border-top:1px solid var(--ink)}
.feature{display:grid;gap:2rem}
@media (min-width:60rem){.feature{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.ft-copy{grid-column:1/9}.ft-media{grid-column:10/13}}
.ft-k{font-family:var(--font-body);font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding-bottom:.75rem;margin-bottom:1.25rem;border-bottom:1px solid var(--ink)}
.ft-cols{max-width:40rem;font-size:1.1rem;line-height:1.65}
.ft-cols.two{max-width:none;columns:2 17rem;column-gap:2.5rem;column-rule:1px solid var(--rule)}
.ft-cols p+p{margin-top:1rem}
.ft-cols.two p:first-child::first-letter{float:left;margin:.06em .12em 0 0;font-family:var(--font-display);font-size:4.1em;font-weight:800;line-height:.8;color:var(--ink)}
.ft-media{margin:0}
.ft-media>div{overflow:hidden;aspect-ratio:3/4;background:var(--surface)}
@media (max-width:59.99rem){.ft-media>div{aspect-ratio:4/3}}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.ft-media figcaption{margin-top:.6rem;font-size:.85rem;font-weight:600;color:var(--muted)}
.qa{border-top:1px solid var(--ink)}
.qa>div{display:grid;gap:.35rem;padding-block:1.1rem;border-bottom:1px solid var(--rule)}
.qa dt{font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .6vw,1.45rem);font-weight:700;letter-spacing:-.03em}
.qa dd{margin:0;max-width:40rem;color:var(--muted)}
.quotes{display:grid;border-top:1px solid var(--ink)}
.quote{display:grid;gap:.8rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--rule)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);font-weight:700;line-height:1.12;letter-spacing:-.035em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:700;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.ct-title{grid-column:1/4}.faq-grid>.qa{grid-column:5/13}}
.contact{border-top:1px solid var(--ink)}
.contact-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.contact-copy{grid-column:1/6}.form-wrap{grid-column:7/13}}
.contact-title{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem);line-height:.92;letter-spacing:-.05em;text-transform:uppercase}
.contact .lead{margin-top:1.25rem;max-width:26rem}
.ct-list{margin-top:1.75rem}
.ct-list .i{color:var(--ink)}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid var(--ink);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--ink)}
.form-wrap{padding:clamp(1.25rem,1rem + 1.5vw,2.25rem);border:4px double var(--ink)}
.ftr{border-top:1px solid var(--ink)}
.ftr-name{font-size:clamp(1.6rem,1.2rem + 1.6vw,2.6rem);font-weight:800;line-height:.9;text-transform:uppercase;letter-spacing:-.045em}
.ftr-links a,.ftr-contact a{text-decoration:none}
.ftr-links a:hover,.ftr-contact a:hover{text-decoration:underline;text-decoration-color:var(--pop)}
.menu-panel{border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}
.menu-panel ul{counter-reset:pg}
.menu-panel li a{display:flex;align-items:baseline;gap:.9rem;padding:.9rem 0;border-bottom:1px solid var(--rule);font-size:1.9rem;font-weight:800;letter-spacing:-.045em;text-transform:uppercase}
.menu-panel li a::before{counter-increment:pg;content:counter(pg,decimal-leading-zero);font-size:.85rem;font-weight:700;letter-spacing:0;color:var(--muted)}
.menu-panel li a:hover::before{color:var(--pop)}
.menu-panel .btn{background:var(--ink);color:var(--bg)}
.mbar{box-shadow:none;border-top:1px solid var(--ink)}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Spotlight',
  bestFor: 'Creators, streamers, podcasters and writers who want a full page with their links, rates and a brand inquiry form, with motion',
  why: 'A magazine about you, with motion: your name is the masthead and unfolds like a turned page, your photo opens as the cover, your links are the cover lines, and your rates are a rate card whose pages turn open as you scroll.',
  fonts: { q: 'family=Unbounded:wght@500..900&family=Hanken+Grotesk:wght@400;500;600;700', display: ['Unbounded', 'grotesk'], body: ['Hanken Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the masthead unfolds, the cover leans toward you, the rate card's pages turn.
  choreo: { intro: 'unfold', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'medium', look: 'a magazine cover, crisp and editorial' },
  art: spotlightArt,
  tokens,
  slots,
  nav,
  render,
};
