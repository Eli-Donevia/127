// Linkstack (animated, creator): a link in bio page that reads like a person's own index, not a column of buttons.
//   Object: the index, under a cover. Their shelf as a photograph (a photoreal render from assets/real when there is
//   one, else drawn at night) fills the top of the phone and the whole left half of a wide screen, with the handle and
//   the light/dark switch across its top and their name set over its foot like the title of a book. Every link is a
//   numbered line with where it goes, the way a contents page lists chapters.
//   Material: night glass (its own mode): a near-black page, white serif and quiet sans, hairline rules, square
//   corners, no cards. Day (the other mode) is the same index on warm book paper; the cover stays a dark lit frame.
//   One move: unfold. The name's letters turn up off their baseline one after another, like the leaves of a book
//   riffled under a thumb, then the index wipes up out of its rules; one band of light crosses the cover. The cover
//   drifts a little slower than the page.
//   Pop: the lit index row: the line you are on (under the pointer, in focus, or where the scroll has reached) gets its
//   number in the member's colour and its rule in their neon partner, the page's one lit line. A line, never a fill.
// Wide screens hold the cover on the left while the index scrolls on the right. As the index scrolls up, the lit row
// walks down it (the scroll moment). Then a brand inquiry form that opens in place, the rates as a rate card, a short
// about and kind words, questions only when there are two real ones. The name leans toward the pointer and springs when
// tapped. No monogram, no halo, no loops. JavaScript off and reduced motion: the complete, still page, the first row
// lit. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon, SOCIAL_LABEL } = require('../../icons');
const { motion } = require('../../motion');
const { esc } = require('../shared');

const id = 'linkstack';

const f1 = (n) => String(Math.round(n));

// The shelf on the cover (a render replaces it when the pack has one), drawn at night in white line on dark glass: a plant
// creator's trailing plant in its pot beside a mister; anyone else, a stack of books (the index's own material) with
// a desk lamp.
function lsKind(c) {
  const t = `${c.what} ${c.name} ${c.handle || ''}`;
  if (/plant|garden|botan|flower|houseplant|grow/i.test(t)) return 'plant';
  if (/podcast|radio|audio|interview|voice|dj\b|music|beats|producer/i.test(t)) return 'audio';
  if (/video|youtube|vlog|film|stream|twitch|reels?|tiktok|camera|photo/i.test(t)) return 'film';
  return 'books';
}

function linkstackArt(s, { p, c, seed, index, art }) {
  if (s.slot !== 'still') return null;
  const ph = art.photo('linkstack', s.slot);
  if (ph) return ph;
  const { w, h } = s;
  const bg = art.wall({ style: 'object', w, h, p, seed, index, quiet: true });
  const r = art.rng(`${seed}:ls:${s.slot}`);
  const R = (a, b) => a + r() * (b - a);
  const m = Math.min(w, h);
  const dark = color.mix(color.mix(p.ink, p.primary, 0.12), '#07090a', 0.7);
  const line = color.mix(p.paper, dark, 0.12);
  const dim = color.mix(p.paper, dark, 0.55);
  const sw = Math.max(2, m * 0.004);
  const L = (k = 1, col = line) => `fill="none" stroke="${col}" stroke-width="${f1(sw * k)}" stroke-linecap="round" stroke-linejoin="round"`;
  const F = (fill, k = 1, col = line) => `fill="${fill}" stroke="${col}" stroke-width="${f1(sw * k)}" stroke-linejoin="round"`;
  const tint = (k) => color.mix(p.primary, dark, k);
  // The room at night: dark glass and the grain, no glow.
  const defs = bg.defs;
  const ground = h * 0.8;
  let body = `<rect width="${w}" height="${h}" fill="${dark}"/>` + bg.body.replace(/<rect[^>]*fill="url\(#v\d+\)"\/>/, '').replace(/<path[^>]*\/>/g, '');
  body += `<path d="M0 ${f1(ground)}H${w}" ${L(1.2, dim)}/><rect y="${f1(ground)}" width="${w}" height="${f1(h - ground)}" fill="${color.mix(dark, p.paper, 0.06)}"/>`;
  const pot = (cx, pw, ph) => `<path d="M${f1(cx - pw / 2)} ${f1(ground - ph)}h${f1(pw)}l${f1(-pw * 0.1)} ${f1(ph)}h${f1(-pw * 0.8)}Z" ${F(tint(0.55))}/><path d="M${f1(cx - pw * 0.54)} ${f1(ground - ph)}h${f1(pw * 1.08)}v${f1(ph * 0.16)}h${f1(-pw * 1.08)}Z" ${F(tint(0.45))}/>`;
  const leaf = (x, y, l, a) => { const dx = Math.cos(a) * l, dy = Math.sin(a) * l; return `M${f1(x)} ${f1(y)}q${f1(dx / 2 - dy * 0.45)} ${f1(dy / 2 + dx * 0.45)} ${f1(dx)} ${f1(dy)}q${f1(-dx / 2 + dy * 0.45)} ${f1(-dy / 2 - dx * 0.45)} ${f1(-dx)} ${f1(-dy)}Z`; };
  if (lsKind(c) === 'plant') {
    // A trailing plant: vines falling over the rim and down past the shelf, heart-shaped leaves along them.
    const cx = w * 0.42, pw = w * 0.22, ph = h * 0.2, top = ground - ph;
    let vines = '', leaves = '';
    for (let v = 0; v < 5; v++) {
      const sx = cx + (v - 2) * pw * 0.2, dir = v < 2 ? -1 : 1, len = h * R(0.2, 0.42);
      let x = sx, y = top + ph * 0.05;
      let d = `M${f1(x)} ${f1(y)}`;
      for (let k = 0; k < 6; k++) {
        const nx = x + dir * w * R(0.02, 0.05), ny = y + (k < 1 ? -h * 0.05 : len / 6);
        d += `Q${f1(x + dir * w * 0.04)} ${f1((y + ny) / 2)} ${f1(nx)} ${f1(ny)}`;
        leaves += leaf(nx, ny, m * R(0.05, 0.075), (dir > 0 ? 0.3 : 2.8) + R(-0.6, 0.6));
        x = nx; y = ny;
      }
      vines += d;
    }
    // Upright leaves from the soil.
    for (let i = 0; i < 7; i++) leaves += leaf(cx + R(-0.4, 0.4) * pw, top, m * R(0.07, 0.11), -Math.PI / 2 + R(-0.9, 0.9));
    body += `<path d="${vines}" ${L(0.9)}/>` + pot(cx, pw, ph) + `<path d="${leaves}" ${F(tint(0.25), 0.7)}/>`;
    // The mister beside it: bottle, neck, trigger.
    const mx = w * 0.74, mw = w * 0.08, mh = h * 0.22;
    body += `<rect x="${f1(mx - mw / 2)}" y="${f1(ground - mh)}" width="${f1(mw)}" height="${f1(mh)}" rx="${f1(mw * 0.2)}" ${F(color.mix(dark, p.paper, 0.12))}/><path d="M${f1(mx - mw * 0.2)} ${f1(ground - mh)}v${f1(-mh * 0.12)}h${f1(mw * 0.4)}v${f1(mh * 0.12)}M${f1(mx - mw * 0.25)} ${f1(ground - mh * 1.12)}h${f1(mw * 0.6)}l${f1(mw * 0.3)} ${f1(-mh * 0.08)}h${f1(-mw * 0.9)}Z" ${L(0.9)}/><path d="M${f1(mx - mw * 0.25)} ${f1(ground - mh * 0.7)}h${f1(mw * 0.5)}" ${L(0.6, dim)}/>`;
  } else if (lsKind(c) === 'audio') {
    // A desk microphone on a boom arm clamped to the shelf, the grille as rings, and headphones lying beside it.
    const cx = w * 0.4, mw = w * 0.09, mh = h * 0.24, my = h * 0.22, ax = w * 0.12;
    let grille = '';
    for (let i = 1; i < 6; i++) grille += `M${f1(cx - mw * 0.36)} ${f1(my + (mh * 0.62 * i) / 6)}h${f1(mw * 0.72)}`;
    body += `<path d="M${f1(ax)} ${f1(ground)}v${f1(-h * 0.05)}M${f1(ax - w * 0.025)} ${f1(ground - h * 0.05)}h${f1(w * 0.05)}M${f1(ax)} ${f1(ground - h * 0.05)}L${f1(ax + w * 0.1)} ${f1(h * 0.38)}L${f1(cx)} ${f1(my + mh + h * 0.03)}V${f1(my + mh)}" ${L(1.3)}/>` +
      `<circle cx="${f1(ax + w * 0.1)}" cy="${f1(h * 0.38)}" r="${f1(m * 0.012)}" ${F(tint(0.4))}/>` +
      `<rect x="${f1(cx - mw / 2)}" y="${f1(my)}" width="${f1(mw)}" height="${f1(mh)}" rx="${f1(mw / 2)}" ${F(tint(0.5))}/><path d="${grille}" ${L(0.6, dim)}/><path d="M${f1(cx - mw / 2)} ${f1(my + mh * 0.72)}h${f1(mw)}" ${L(0.9)}/>`;
    const hx = w * 0.72, hr = w * 0.1;
    body += `<path d="M${f1(hx - hr)} ${f1(ground - h * 0.03)}A${f1(hr)} ${f1(hr * 0.7)} 0 0 1 ${f1(hx + hr)} ${f1(ground - h * 0.03)}" ${L(1.4)}/>` +
      `<rect x="${f1(hx - hr - w * 0.035)}" y="${f1(ground - h * 0.07)}" width="${f1(w * 0.06)}" height="${f1(h * 0.07)}" rx="${f1(w * 0.015)}" ${F(tint(0.45))}/><rect x="${f1(hx + hr - w * 0.025)}" y="${f1(ground - h * 0.07)}" width="${f1(w * 0.06)}" height="${f1(h * 0.07)}" rx="${f1(w * 0.015)}" ${F(tint(0.45))}/>`;
  } else if (lsKind(c) === 'film') {
    // A small camera on a table tripod, its lens rings and hood, and a light panel on a stand beside it.
    const cx = w * 0.4, bw = w * 0.2, bh = h * 0.16, by = h * 0.4;
    body += `<path d="M${f1(cx)} ${f1(by + bh)}v${f1(h * 0.06)}M${f1(cx)} ${f1(by + bh + h * 0.06)}L${f1(cx - w * 0.08)} ${f1(ground)}M${f1(cx)} ${f1(by + bh + h * 0.06)}L${f1(cx + w * 0.08)} ${f1(ground)}M${f1(cx)} ${f1(by + bh + h * 0.06)}V${f1(ground)}" ${L(1.2)}/>` +
      `<rect x="${f1(cx - bw / 2)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(m * 0.01)}" ${F(color.mix(dark, p.paper, 0.12))}/><path d="M${f1(cx - bw * 0.3)} ${f1(by)}v${f1(-bh * 0.18)}h${f1(bw * 0.26)}v${f1(bh * 0.18)}" ${L(0.9)}/>` +
      `<circle cx="${f1(cx - bw * 0.05)}" cy="${f1(by + bh / 2)}" r="${f1(bh * 0.36)}" ${F(tint(0.5))}/><circle cx="${f1(cx - bw * 0.05)}" cy="${f1(by + bh / 2)}" r="${f1(bh * 0.22)}" ${F(tint(0.3), 0.7)}/><path d="M${f1(cx + bw * 0.32)} ${f1(by + bh * 0.22)}h${f1(bw * 0.1)}" ${L(0.8, dim)}/>`;
    const lx = w * 0.76, lw = w * 0.13, lh = h * 0.16, ly = h * 0.26;
    body += `<path d="M${f1(lx)} ${f1(ly + lh)}V${f1(ground)}M${f1(lx - w * 0.05)} ${f1(ground)}L${f1(lx)} ${f1(ground - h * 0.06)}L${f1(lx + w * 0.05)} ${f1(ground)}" ${L(1.1)}/><rect x="${f1(lx - lw / 2)}" y="${f1(ly)}" width="${f1(lw)}" height="${f1(lh)}" ${F(color.mix(dark, p.paper, 0.18))}/><rect x="${f1(lx - lw * 0.4)}" y="${f1(ly + lh * 0.12)}" width="${f1(lw * 0.8)}" height="${f1(lh * 0.76)}" ${F(color.mix(dark, p.paper, 0.32), 0.5, dim)}/>`;
  } else {
    // A stack of books on their sides, spines out (bands at the head and tail, no fake titles), one standing; and a
    // desk lamp over them.
    let x = w * 0.18, y = ground;
    for (let i = 0; i < 5; i++) {
      const bw = w * R(0.32, 0.42), bh = h * R(0.055, 0.085), bx = x + R(-0.03, 0.03) * w;
      y -= bh;
      body += `<rect x="${f1(bx)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" ${F(i % 2 ? tint(0.5) : color.mix(dark, p.paper, 0.1))}/><path d="M${f1(bx + bw * 0.08)} ${f1(y + bh * 0.2)}v${f1(bh * 0.6)}M${f1(bx + bw * 0.85)} ${f1(y + bh * 0.25)}v${f1(bh * 0.5)}" ${L(0.8, dim)}/>`;
    }
    const sx = w * 0.64, sh = h * 0.42, sw2 = w * 0.07;
    body += `<rect x="${f1(sx)}" y="${f1(ground - sh)}" width="${f1(sw2)}" height="${f1(sh)}" ${F(tint(0.4))}/><path d="M${f1(sx + sw2 / 2)} ${f1(ground - sh * 0.85)}v${f1(sh * 0.5)}" ${L(0.8, dim)}/>`;
    const lx = w * 0.84;
    body += `<path d="M${f1(lx - w * 0.06)} ${f1(ground)}h${f1(w * 0.12)}M${f1(lx)} ${f1(ground)}L${f1(lx - w * 0.04)} ${f1(h * 0.45)}L${f1(lx - w * 0.14)} ${f1(h * 0.3)}" ${L(1.4)}/><path d="M${f1(lx - w * 0.14)} ${f1(h * 0.24)}l${f1(-w * 0.09)} ${f1(h * 0.1)}l${f1(w * 0.06)} ${f1(h * 0.06)}Z" ${F(color.mix(dark, p.paper, 0.15))}/>`;
  }
  return art.svgDoc(w, h, defs, body);
}


// Night (its own mode): near-black glass with a breath of the member's colour. Day: the same index on pale stone paper,
// barely warm, the ink near black; the cover photo stays the dark lit frame it is in both.
function tokens(p, mode) {
  const night = color.mix(color.mix(p.ink, p.primary, 0.12), '#07090a', 0.7);
  if (mode === 'light') return { bg: color.mix(p.paper, '#edeceb', 0.8), dark: night };
  return { bg: night, dark: color.mix(night, '#000000', 0.35) };
}

// One photo, the cover: the shelf behind the name (drawn until the member adds theirs). Wide, 4:3; the cover crops it
// to a portrait on wide screens, so the subject sits in the middle third.
function slots(c) {
  const who = c.owner && c.owner !== c.name ? c.owner : c.name;
  return [{ slot: 'still', file: 'shelf.jpg', w: 1200, h: 900, style: 'object', alt: `On ${who}'s shelf` }];
}

function nav() {
  return [];
}

function where(l) {
  const h = String(l.href || '');
  if (/^mailto:/.test(h)) return 'Email';
  if (/^tel:/.test(h)) return 'Phone';
  return h.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];
}

function render(c) {
  const name = String(c.name || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  const longest = Math.max(...words.map((w) => w.length), 3);
  // One word a line, sized from the longest word (DM Serif Display: about 0.5em a letter), so nothing reflows when the
  // font arrives.
  const fs = Math.min(0.6, 1.9 / longest).toFixed(3);
  const fsm = Math.min(30, 160 / longest).toFixed(2);
  // A person only when the facts name an owner; otherwise the page speaks as the name.
  const person = c.owner && c.owner !== c.name ? c.owner : name;

  const links = c.links.slice();
  if (!links.length && c.email) links.push({ label: 'Email me', href: `mailto:${c.email}`, kind: 'link' });
  const socials = Object.entries(c.socials || {});

  // The cover: their shelf as a photograph, full bleed (the whole left half on a wide screen, held while the index
  // scrolls), with the handle and the switch across its top and the name set over its foot like a book's title.
  const profile = `<header class="pf">
<div class="cv">
<figure class="cv-ph" data-ci="subject"><div class="cv-par" data-par="0.06">${P.img(c, 'still', { cls: 'shelf-img', eager: true, sizes: '(min-width: 56rem) 50vw, 100vw' })}</div></figure>
<div class="cv-top"><p class="hd" data-ci="then" data-ci-from="fade">${esc(c.handle || c.whatShort || '')}</p>${P.modeToggle(c, { cls: 'cv-tg' })}</div>
<div class="nm-wrap" data-alive="0.5"><h1 class="nm" id="hero-title" data-ci="head" style="--fs:${fs};--fsm:${fsm}vw"><span class="sr-only">${esc(name)}</span><span aria-hidden="true">${words.map((w) => `<span class="nw">${Array.from(w).map((ch) => `<span class="nc" data-ci-part>${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span></h1></div>
</div>
</header>`;
  const intro = c.heroSub || socials.length
    ? `<div class="pf-t">${c.heroSub ? `<p class="bio" data-ci="then" data-ci-from="mask">${esc(c.heroSub)}</p>` : ''}
${socials.length ? `<ul class="soc" data-ci="then" data-ci-from="fade">${socials.map(([k, href]) => `<li><a href="${esc(href)}">${esc(SOCIAL_LABEL[k] || k)}<span class="sr-only"> (${esc(c.name)})</span></a></li>`).join('')}</ul>` : ''}</div>`
    : '';

  const stack = links.length
    ? `<nav class="idx" aria-label="Links" data-ci="then" data-ci-from="mask" data-sc><ol>
${links.map((l, i) => `<li data-sc-part><a class="ln${i === 0 ? ' ln-1' : ''}" data-mag href="${esc(l.href)}"><span class="ln-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ln-t">${esc(l.label)}</span><span class="ln-w">${esc(where(l))}</span>${icon('arrowUpRight', { size: 20 })}</a></li>`).join('\n')}
</ol></nav>`
    : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Brand', half: false },
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the campaign', required: true },
  ];
  const inquiry = `<details class="inq" id="contact" data-ci="then" data-ci-from="mask">
<summary><span class="ln-n" aria-hidden="true">${String(links.length + 1).padStart(2, '0')}</span><span class="ln-t">Brand inquiries</span><span class="ln-w">Send a message</span><span class="inq-x" aria-hidden="true">${icon('arrow', { size: 20 })}</span></summary>
<div class="inq-body">${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}</div>
</details>`;

  // What the creator offers as a rate card: each format, what it is, its price set in the title face, and the way to
  // ask for it.
  const offer = c.services.length
    ? `<section class="blk" aria-labelledby="offer-title"><h2 class="bh" id="offer-title">Rates</h2><dl class="rate">${c.services.map((sv) => `<div><dt>${esc(sv.name)}${sv.duration || sv.blurb ? `<small>${esc([sv.duration, sv.blurb].filter(Boolean).join(', '))}</small>` : ''}</dt><dd>${esc(sv.priceText || 'Ask')}</dd></div>`).join('')}</dl><p><a class="btn btn-primary ls-open" href="#contact">Brand inquiries</a></p></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="blk" aria-labelledby="about-title"><h2 class="bh" id="about-title" data-split>${esc(`About ${person}`)}</h2>${c.aboutParas.map((p, i) => `<p class="ab" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="blk" aria-labelledby="reviews-title"><h2 class="bh" id="reviews-title">Kind words</h2>${c.reviews.map((r, i) => `<figure class="rq" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</section>`
    : '';

  // Questions only when there are two real ones, as index lines: the question, the answer under it. No accordion.
  const faq = c.faq.length >= 2 ? `<section class="blk" aria-labelledby="faq-title"><h2 class="bh" id="faq-title">Questions</h2><dl class="qa">${c.faq.map((f) => `<div><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('')}</dl></section>` : '';

  const m = motion();
  const body = [
    '<main id="main" class="ls">',
    profile,
    '<div class="ls-col">',
    intro,
    stack,
    inquiry,
    offer,
    about,
    reviews,
    faq,
    `<footer class="ls-ftr"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}${c.phone ? `<p><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}</footer>`,
    '</div>',
    '</main>',
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '76rem' } };
}

// A link to the inquiry form opens it in place.
const JS = `(function(){var d=document,f=d.getElementById('contact');if(!f)return;[].slice.call(d.querySelectorAll('a[href="#contact"]')).forEach(function(a){a.addEventListener('click',function(){f.open=true})})})();`;

const CSS = `
@font-face{font-family:'Linkstack Display Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Liberation Serif'),local('LiberationSerif'),local('Times');size-adjust:106.6%;ascent-override:97.2%;descent-override:31.4%;line-gap-override:0%}
@font-face{font-family:'Linkstack Body Fallback';font-weight:400 500;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:109.6%;ascent-override:84.9%;descent-override:22.2%;line-gap-override:0%}
@font-face{font-family:'Linkstack Body Fallback';font-weight:600 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:102.7%;ascent-override:90.6%;descent-override:23.7%;line-gap-override:0%}
html:root{--font-display:"DM Serif Display","Linkstack Display Fallback",serif;--font-body:"Work Sans","Linkstack Body Fallback",sans-serif}
:root{--ease:cubic-bezier(.16,1,.3,1);--surface:color-mix(in srgb,var(--ink) 4%,var(--bg))}
body{background:var(--bg)}
.ls{display:grid;padding-bottom:2rem;gap:clamp(2rem,1.5rem + 2vw,3rem)}
.ls>.ls-col{width:min(100% - 2rem,40rem);margin-inline:auto}
@media (min-width:56rem){.ls{grid-template-columns:minmax(0,1fr) minmax(0,min(46rem,54vw));gap:0;align-items:start;padding-bottom:0}.ls>.ls-col{width:auto;margin:0;padding:clamp(2.5rem,2rem + 2vw,4.5rem) clamp(2rem,5vw,5.5rem) 3rem}.pf{position:sticky;top:0;height:100svh}}
/* the cover: a dark lit frame in both modes, so its type is always white */
.cv{position:relative;display:grid;grid-template-rows:auto 1fr auto;height:min(78svh,128vw);min-height:24rem;overflow:hidden;background:#0b0c0d;color:#f6f4ef;isolation:isolate}
@media (min-width:56rem){.cv{height:100%}}
.cv-ph{position:absolute;inset:0;z-index:-1;margin:0;overflow:hidden}
.cv-par{position:absolute;inset:-6% 0}
.cv-ph img{display:block;width:100%;height:100%;object-fit:cover}
.cv-ph::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(6,7,8,.62),rgba(6,7,8,0) 22%,rgba(6,7,8,0) 48%,rgba(6,7,8,.78) 100%)}
.cv-ph::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(100deg,transparent 40%,rgba(255,246,230,.16) 50%,transparent 60%);mix-blend-mode:soft-light;opacity:0}
html.m .cv-ph::after{animation:lsSweep 3.6s 1.6s cubic-bezier(.45,0,.2,1) both}
@keyframes lsSweep{from{transform:translateX(-70%);opacity:1}to{transform:translateX(70%);opacity:0}}
.cv-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:clamp(.9rem,.6rem + 1vw,1.6rem) clamp(1rem,.5rem + 2vw,2.5rem)}
.hd{font-size:.85rem;font-weight:500;letter-spacing:.04em;color:#f6f4ef;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.cv .mode-tg{border-color:rgba(255,255,255,.4);color:#f6f4ef;background:rgba(10,11,12,.35)}
.cv .mode-tg:hover{border-color:#fff}
.nm-wrap{grid-row:3;transform-origin:0 100%;padding:0 clamp(1rem,.5rem + 2vw,2.5rem) clamp(1rem,.6rem + 2vw,2.6rem)}
.nm{font-size:var(--fsm);font-weight:400;line-height:.86;letter-spacing:-.035em;padding-bottom:.08em;text-shadow:0 2px 24px rgba(0,0,0,.35)}
/* phones: the photo first and the name under it on the dark ground, so the name never sits on the subject */
@media (max-width:55.99rem){.cv{height:auto;min-height:0;grid-template-rows:auto minmax(16rem,80vw) auto}.cv-ph{position:relative;inset:auto;grid-row:1/3;grid-column:1}.cv-top{grid-row:1;grid-column:1}.cv-ph img{object-position:50% 72%}.cv-ph::before{background:linear-gradient(180deg,rgba(6,7,8,.62),rgba(6,7,8,0) 26%,rgba(6,7,8,0) 70%,#0b0c0d 100%)}.nm-wrap{padding-top:.75rem}}
@media (min-width:56rem){.nm{font-size:clamp(4rem,calc(var(--fs) * (100vw - min(46rem,54vw) - 5rem)),10rem)}}
.nw{display:block;width:max-content;max-width:100%}
.nc{display:inline-block}
.pf-t{display:grid;gap:1.25rem}
.bio{max-width:30rem;font-size:1.15rem;line-height:1.5;color:var(--muted)}
.soc{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem}
.soc a{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:500;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 85%/0 1px no-repeat;transition:background-size .35s var(--ease)}
.soc a:hover{background-size:100% 1px}
@media (prefers-reduced-motion:reduce){.cv-ph::after{display:none}}
.ls-col{display:grid;gap:clamp(2.5rem,2rem + 2vw,4rem);min-width:0}
.idx ol{border-top:1px solid var(--ink)}
.ln,.inq summary{position:relative;display:grid;grid-template-columns:2.25rem minmax(0,1fr) auto;gap:.15rem .75rem;align-items:baseline;padding:1.05rem 0;border-bottom:1px solid var(--line);text-decoration:none}
@media (min-width:56rem){.ln,.inq summary{padding:1.45rem 0}.ln-t{font-size:clamp(1.6rem,.9rem + 1.3vw,2.3rem)}}
.ln-n{font-size:.8rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--muted)}
.ln-t{font-family:var(--font-display);font-size:clamp(1.45rem,1.25rem + .8vw,1.9rem);line-height:1.1;letter-spacing:-.015em}
.ln-w{grid-column:2;font-size:.85rem;color:var(--muted)}
.ln .i,.inq-x{grid-column:3;grid-row:1/3;align-self:center;transition:transform .35s var(--ease)}
.ln:hover .ln-t,.inq summary:hover .ln-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:1px;text-underline-offset:.18em}
.ln:hover .i{transform:translate(3px,-3px)}
.ln::before{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--neon);box-shadow:0 0 4px color-mix(in srgb,var(--neon) 45%,transparent);transform-origin:0 50%;transform:scaleX(0);transition:transform .5s var(--ease)}
.ln-n{transition:color .3s ease}
.ln-1::before{transform:none}
.ln-1 .ln-n{color:var(--pop)}
.idx ol:is(:hover,:focus-within) .ln-1:not(:hover,:focus-visible)::before{transform:scaleX(0)}
.idx ol:is(:hover,:focus-within) .ln-1:not(:hover,:focus-visible) .ln-n{color:var(--muted)}
.idx .ln:is(:hover,:focus-visible)::before{transform:none}
.idx .ln:is(:hover,:focus-visible) .ln-n{color:var(--pop)}
html.m .idx[data-sc] li[data-sc-part]{transform:none}
@media (hover:none){html.m .idx[data-sc] li.on:not(:has(~ li.on)) .ln::before{transform:none}html.m .idx[data-sc] li.on:not(:has(~ li.on)) .ln-n{color:var(--pop)}html.m .idx[data-sc]:has(li.on) li:not(.on) .ln-1::before,html.m .idx[data-sc]:has(li.on) li.on:has(~ li.on) .ln-1::before{transform:scaleX(0)}html.m .idx[data-sc]:has(li.on) li.on:has(~ li.on) .ln-1 .ln-n{color:var(--muted)}}
.inq{margin-top:calc(-1 * clamp(2.5rem,2rem + 2vw,4rem))}
.inq summary{list-style:none}
.inq-x{transform:rotate(90deg)}
.inq[open] .inq-x{transform:rotate(-90deg)}
.inq-body{padding:1.5rem 0 1rem;border-bottom:1px solid var(--line)}
html.m .inq[open] .inq-body{animation:lsOpen .6s var(--ease)}
@keyframes lsOpen{from{opacity:0;transform:translateY(-10px)}}
.field input,.field select,.field textarea{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 45%,transparent);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1px 0 var(--ink)}
.btn{font-weight:600}
.btn:hover{transform:none}
.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 85%,var(--bg))}
html[data-theme="light"] .ln::before{box-shadow:none}
html[data-theme="light"] .field input,html[data-theme="light"] .field textarea{background:color-mix(in srgb,var(--ink) 3%,transparent)}
.bh{font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:400;line-height:1;letter-spacing:-.02em}
.blk{display:grid;gap:1rem;padding-top:1.25rem;border-top:1px solid var(--line)}
.ab{max-width:34rem;font-size:1.08rem;line-height:1.6;color:var(--muted)}
.ab:first-of-type{font-family:var(--font-display);font-size:clamp(1.35rem,1.2rem + .6vw,1.7rem);line-height:1.3;color:var(--ink)}
.one{font-family:var(--font-display);font-size:1.8rem}
.one span{color:var(--muted)}
.rate{border-top:1px solid var(--ink)}
.rate>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:baseline;padding-block:1rem;border-bottom:1px solid var(--line)}
.rate dt{display:grid;gap:.2rem;font-family:var(--font-display);font-size:clamp(1.4rem,1.2rem + .8vw,1.85rem);line-height:1.1;letter-spacing:-.015em}
.rate small{font-family:var(--font-body);font-size:.85rem;letter-spacing:0;color:var(--muted)}
.rate dd{margin:0;font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1vw,2.2rem);font-variant-numeric:tabular-nums}
.blk>p:last-child{margin-top:.5rem}
.qa{border-top:1px solid var(--line)}
.qa>div{display:grid;gap:.3rem;padding-block:1rem;border-bottom:1px solid var(--line)}
.qa dt{font-family:var(--font-display);font-size:1.35rem;line-height:1.2}
.qa dd{margin:0;color:var(--muted)}
.rq{display:grid;gap:.5rem;padding-block:1rem;border-bottom:1px solid var(--line)}
.rq blockquote{margin:0;font-family:var(--font-display);font-size:1.5rem;line-height:1.25}
.rq figcaption{font-size:.9rem;color:var(--muted)}
.ls-ftr{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem;padding-top:1.25rem;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
.ls-ftr a{color:var(--ink)}
.mpause{margin:1rem 0 0}
.ls-ftr .mpause{opacity:1;color:var(--muted)}
.ls-ftr .legal-links a{opacity:1;color:var(--muted)}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Linkstack',
  bestFor: 'Creators who need one link in bio: every link, socials and a brand inquiry form on one phone-sized page, with motion',
  why: 'A link in bio page that reads like your own index: your name turns up off the page like the leaves of a book, every link is a numbered line that says where it goes and lights as you reach it, your rates are a rate card, and an inquiry form opens in place.',
  fonts: { q: 'family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@400;500;600', display: ['DM Serif Display', 'serif'], body: ['Work Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): the name's letters turn up off the page one after another like leaves of a
  // book riffled (calm pace; spotlight's unfold turns whole words of a masthead and opens its cover), then the index
  // wipes up line by line; the name leans toward you and the lit row walks down the index.
  modes: ['dark', 'light'],
  choreo: { intro: 'unfold', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'calm', look: 'quiet, at night, a personal index' },
  art: linkstackArt,
  tokens,
  slots,
  nav,
  render,
};
