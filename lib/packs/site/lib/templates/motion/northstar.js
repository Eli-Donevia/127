// Northstar (animated, coach): for one person people want to work with.
//   Object:   the written plan you leave the first session with: a sheet of writing paper with its ruled lines, the
//             plan in graphite, three boxes ticked and the pencil laid across it (drawn until the member adds a
//             portrait), then the rates set like a written fee list and the steps as the plan's own ticked lines.
//   Material: writing paper and graphite: a warm off-white sheet, ink hairlines, 2px radii, a book serif set very large.
//             Buttons are graphite, never the member's colour.
//   One move: clarity. The sheet develops like a photograph from a grey blur while the headline's words come into
//             focus one by one (choreo intro 'develop').
//   Pop:      the member's colour as the one line drawn under the headline's last word (data-pop 'line'), then as the
//             tick in each box of the plan as you reach it.
// At rest the sheet leans a little toward the pointer. The one scroll moment is the plan: the steps as ruled lines
// whose boxes tick themselves in order with the scroll, backwards when scrolling up. The contact is a letter on the
// same paper. JavaScript off and reduced motion: the complete, still page, every box ticked. Motion is `choreo`.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'northstar';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f7f5f0', 0.65), dark: color.mix(color.mix(p.ink, p.primary, 0.35), '#05080a', 0.5) };
}

function slots(c) {
  return [{ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'coach'}` : c.profile.hero || c.name }];
}

// The generated about restates the hero ("X is a Y in Z, run by W. You can reach W directly"); keep only what is new.
function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const who = [c.name, c.owner].filter(Boolean).map(lw);
  const restates = (t) => (who.some((w) => lw(t).includes(w)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  return [
    (c.services.length || c.offer || c.included.length) && { label: 'The offer', href: '#offer' },
    c.steps.length && { label: 'How it works', href: '#how' },
    aboutParas(c).length && { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The headline split on the server into words (so nothing reflows when the intro starts).
function headParts(title) {
  return String(title || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

const lc = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

// The lead says what the headline doesn't: who, where, and what it costs to start.
function leadLine(c, low, person) {
  const free = c.services.find((s) => /^free$/i.test(String(s.priceText || '').trim()) || /(^|,\s*)free\b/i.test(String(s.blurb || '')));
  const who = person ? `${person} coaches one to one` : `${c.name} works one to one`;
  const where = c.online ? ', online' : c.area ? ` in ${c.area}` : '';
  const cost = free && low ? ` The ${lc(free.name)} is free, and sessions start at ${low.priceText.replace(/^From /, '')}.` : low ? ` Sessions start at ${low.priceText.replace(/^From /, '')}.` : '';
  return `${who}${where}.${cost}`;
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const where = c.online ? (c.area && /online|zoom|virtual|remote/i.test(c.area) ? c.area : 'Online') : c.area;
  const book = (cls) => P.button(c.primary, cls).replace('<a ', '<a data-mag ');
  const long = c.heroTitle.length > 44;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<h1 id="hero-title" class="hero-h${long ? ' long' : ''}" data-ci="head" data-pop="line">${headParts(c.heroTitle)}</h1>
<figure class="portrait">
<div class="pt-lean" data-alive="0.6"><div class="pt-frame" data-ci="subject">${P.img(c, 'portrait', { cls: 'pt-img', eager: true })}</div></div>
${person || c.whatShort ? `<figcaption data-ci="then"><strong>${esc(person || c.name)}</strong>${[c.whatShort, where].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</figcaption>` : ''}
</figure>
<div class="hero-copy">
<p class="lead">${esc(leadLine(c, low, person))}</p>
<div class="ctas" data-ci="then" data-ci-from="fade">${book('btn btn-primary btn-lg')}${c.secondary ? P.button(c.secondary, 'btn btn-quiet btn-lg') : ''}</div>
</div>
</div>
</section>`;

  const aud = c.audience ? c.audience.replace(/^for\s+/i, '').replace(/[.!]+$/, '') : '';
  const forWho = aud
    ? `<section class="sec forwho" aria-labelledby="forwho-title"><div class="wrap">
<h2 class="statement" id="forwho-title" data-rv>For ${esc(aud)}${c.profile.result ? `, with ${esc(c.profile.result)}.` : '.'}</h2>
</div></section>`
    : '';

  const offer = c.services.length || c.included.length
    ? `<section class="sec offer" id="offer" aria-labelledby="offer-title"><div class="wrap">
<h2 class="h2 offer-h" id="offer-title" data-rv>${esc(person ? `Work with ${person}` : 'Ways to work together')}</h2>
${c.services.length ? `<ol class="rates">${c.services.map((s, i) => `<li class="rate" data-rv style="--d:${i}"><span class="rate-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3><p class="rate-m">${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p><p class="rate-p">${esc(s.priceText || '')}</p></li>`).join('')}</ol>` : ''}
<div class="offer-foot">
${c.included.length ? `<div class="incl-wrap" data-rv><h3>Included</h3><ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div></div>'}
<div class="offer-cta" data-rv style="--d:1">${c.capacity ? `<p class="cap">${esc(c.capacity)}</p>` : ''}${book('btn btn-primary btn-lg')}</div>
</div>
</div></section>`
    : '';

  // The one scroll moment: the steps (or, without steps, the ways to work together) as a path that draws itself in
  // with the scroll and ends at the Book button.
  // The steps only (never the rates again), with "Get started" set as what it is: the first session.
  const path = c.steps.length >= 2
    ? roadmap({ id: 'how', cls: 'ways', title: 'The plan', nodes: c.steps.map((s) => ({ title: /^get started$/i.test(s.title) ? 'The first session' : s.title, sub: s.body })) })
        .replace(/<\/ol>\n<\/div>\n<\/div>\n<\/section>$/, `</ol>\n</div>\n<div class="ways-go">${book('btn btn-primary')}</div>\n</div>\n</section>`)
    : '';

  // The first sentence large, the rest at reading size (the member's paragraphs kept).
  // A sentence that only restates the hero (the name and the kind of work again) is left out.
  const paras = aboutParas(c);
  const [p0 = '', ...more] = paras;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = !first && !rest.length ? '' : `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-in">
<h2 class="about-h" id="about-title">${esc(person ? `About ${person}` : `About ${c.name}`)}</h2>
${first ? `<p class="about-first" data-rv style="--d:1">${esc(first)}</p>` : ''}
<div class="about-rest">
${rest.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="h2" id="reviews-title" data-rv>What people say</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title">Questions</h2><dl class="qa">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const closing = c.booking ? (person ? `Book a call with ${person}.` : 'Book a call.') : person ? `Write to ${person}.` : 'Send a message.';
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-head">
<h2 class="h2 contact-h" id="contact-title">${esc(closing)}</h2>
${c.ctaSub && !c.booking ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.booking ? `<div class="ctas">${book('btn btn-primary btn-lg')}</div>` : ''}
${P.contactList(c) ? `<div class="contact-side">${P.contactList(c)}</div>` : ''}
</div>
<div class="letter">
<h3 class="form-title">${esc(person ? `Dear ${person},` : `Dear ${c.name},`)}</h3>
${P.form(c, { id: 'contact', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What would you like help with?', required: true }], submit: 'Send message', subject: `Message for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-ns', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, forWho, offer, path, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '78rem' } };
}

// The placeholder, drawn: the written plan on a sheet of writing paper in window light. Ruled lines, a margin rule,
// graphite lines of writing (strokes, never text), three boxes with ticks, and a pencil laid across the corner.
function art(slot, { p, seed, index, art: Art }) {
  if (slot.slot !== 'portrait') return null;
  const w = slot.w, h = slot.h;
  const r = Art.rng(`${seed}:plan`);
  const f = (v) => v.toFixed(1);
  const W = Art.wall({ style: 'portrait', w, h, p, seed, index, quiet: true });
  const paper = color.mix(p.paper, '#fffdf8', 0.75);
  const graphite = color.mix(p.ink, '#3b3d40', 0.6);
  const rule = color.mix(paper, color.mix(p.primary, '#8aa0b4', 0.5), 0.32);
  const sx = w * 0.13, sy = h * 0.08, sw = w * 0.74, sh = h * 0.84;
  const gap = sh / 22;
  let lines = '';
  for (let i = 3; i < 22; i++) lines += `M${f(sx)} ${f(sy + i * gap)}h${f(sw)}`;
  // Handwriting: a run of small loops along a line, its length set by the seed.
  const hand = (x, y, len, amp) => {
    let d = `M${f(x)} ${f(y)}`;
    let cx = x;
    while (cx < x + len) {
      const st = 11 + r() * 13, up = amp * (0.35 + r() * 0.45);
      d += `q${f(st * 0.4)} ${f(-up)} ${f(st * 0.7)} ${f(-up * 0.25)}t${f(st * 0.3)} ${f(up * 0.25)}`;
      cx += st;
      if (r() > 0.86) { cx += 14; d += `m14 0`; }
    }
    return d;
  };
  let writing = hand(sx + sw * 0.1, sy + gap * 2.3, sw * 0.55, gap * 0.75);
  const rows = [5, 9, 13];
  rows.forEach((row, k) => {
    writing += hand(sx + sw * 0.22, sy + gap * row - 6, sw * (0.45 + r() * 0.25), gap * 0.55);
    writing += hand(sx + sw * 0.22, sy + gap * (row + 1) - 6, sw * (0.3 + r() * 0.3), gap * 0.5);
    if (k < 2) writing += hand(sx + sw * 0.22, sy + gap * (row + 2) - 6, sw * (0.2 + r() * 0.3), gap * 0.5);
  });
  writing += hand(sx + sw * 0.1, sy + gap * 17 - 6, sw * 0.6, gap * 0.55) + hand(sx + sw * 0.1, sy + gap * 18 - 6, sw * 0.42, gap * 0.55);
  const bs = gap * 0.72;
  const boxes = rows.map((row) => {
    const bx = sx + sw * 0.1, by = sy + gap * row - bs - 4;
    return `<rect x="${f(bx)}" y="${f(by)}" width="${f(bs)}" height="${f(bs)}" rx="2" fill="none" stroke="${graphite}" stroke-width="2.4"/><path d="M${f(bx + bs * 0.2)} ${f(by + bs * 0.55)}l${f(bs * 0.25)} ${f(bs * 0.28)}l${f(bs * 0.62)} ${f(-bs * 0.85)}" fill="none" stroke="${graphite}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  // The pencil, laid across the lower corner.
  const px = sx + sw * 0.5, py = sy + sh * 0.97, ang = -24 - r() * 8, L = w * 0.62, T = w * 0.034;
  const pencil = `<g transform="translate(${f(px)} ${f(py)}) rotate(${f(ang)})"><rect x="${f(-T * 0.2)}" y="${f(-T / 2 + T * 0.35)}" width="${f(L)}" height="${f(T)}" fill="#000" opacity=".12" filter="url(#psh)"/><rect width="${f(L * 0.86)}" height="${f(T)}" y="${f(-T / 2)}" fill="${color.mix(p.primary, '#2f3a45', 0.55)}"/><rect width="${f(L * 0.86)}" height="${f(T * 0.3)}" y="${f(-T / 2)}" fill="#fff" opacity=".14"/><rect x="${f(L * 0.86)}" width="${f(L * 0.06)}" height="${f(T)}" y="${f(-T / 2)}" fill="#b9b3a7"/><path d="M0 ${f(-T / 2)}L${f(-L * 0.1)} 0L0 ${f(T / 2)}Z" fill="#e2c9a0"/><path d="M${f(-L * 0.065)} ${f(-T * 0.17)}L${f(-L * 0.1)} 0L${f(-L * 0.065)} ${f(T * 0.17)}Z" fill="${graphite}"/></g>`;
  const defs = `${W.defs}<filter id="psh" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${f(w * 0.006)}"/></filter><filter id="ssh" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(w * 0.014)}"/></filter><linearGradient id="pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const body = `${W.body}<g transform="rotate(${f(-1.5 + r() * 2)} ${f(w / 2)} ${f(h / 2)})">
<rect x="${f(sx + w * 0.012)}" y="${f(sy + h * 0.016)}" width="${f(sw)}" height="${f(sh)}" fill="${W.shade}" opacity=".5" filter="url(#ssh)"/>
<rect x="${f(sx)}" y="${f(sy)}" width="${f(sw)}" height="${f(sh)}" fill="${paper}"/><rect x="${f(sx)}" y="${f(sy)}" width="${f(sw)}" height="${f(sh)}" fill="url(#pl)"/>
<path d="${lines}" stroke="${rule}" stroke-width="1.6"/><path d="M${f(sx + sw * 0.07)} ${f(sy)}V${f(sy + sh)}" stroke="${color.mix(paper, '#c96b5c', 0.45)}" stroke-width="1.6"/>
<path d="${writing}" fill="none" stroke="${graphite}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
${boxes}
</g>${pencil}`;
  return Art.svgDoc(w, h, defs, body);
}

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
@font-face{font-family:'Northstar Display Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Liberation Serif'),local('LiberationSerif'),local('Times');size-adjust:107%}
@font-face{font-family:'Northstar Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.7%}
html:root{--font-display:"Newsreader","Northstar Display Fallback",serif;--font-body:"Manrope","Northstar Body Fallback",sans-serif;--ease:cubic-bezier(.16,1,.3,1)}
h1,h2,h3{font-weight:400;letter-spacing:-.025em}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em}
.h2{font-size:clamp(2.4rem,1.5rem + 3.4vw,4.6rem);line-height:1}
.lead{color:var(--muted)}
.btn{font-weight:600;transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.btn:hover{transform:none}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg));color:var(--bg)}
.btn-quiet{background:none;color:var(--ink);border:0;border-bottom:1px solid var(--ink);border-radius:0;padding-inline:0;min-height:auto;padding-block:.35rem}
.btn-quiet:hover{border-bottom-color:var(--pop);color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .4s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.55rem;line-height:1;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.75rem}
.nav a{display:block;padding:.4rem 0;font-size:.95rem;font-weight:500;color:var(--muted);text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.15rem}
.menu>summary{border-radius:2px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(2rem,1rem + 3vw,4.5rem) clamp(4rem,2.5rem + 5vw,8rem)}
.hero-grid{display:grid;gap:2rem}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto 1fr;column-gap:2rem;row-gap:0;align-items:start}.hero-h{grid-column:1 / span 8;grid-row:1;position:relative;z-index:1}.portrait{grid-column:9 / span 4;grid-row:1 / span 2;align-self:start}.hero-copy{grid-column:1 / span 6;grid-row:2;align-self:start}}
.hero-h{font-size:clamp(3.1rem,1.2rem + 7.2vw,8.8rem);line-height:.94;letter-spacing:-.045em;text-wrap:balance}
.hero-h.long{font-size:clamp(2.7rem,1.2rem + 5.4vw,6.8rem)}
.hero-copy{padding-top:clamp(1.5rem,1rem + 2vw,3rem)}
.hero .lead{max-width:32rem}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.75rem;margin-top:2rem}
.meta{display:flex;flex-wrap:wrap;margin-top:2.25rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.92rem;color:var(--muted)}
.meta li{padding-right:1.1rem}
.meta li+li{padding-left:1.1rem;border-left:1px solid var(--line)}
.portrait{position:relative;margin:0}
.pt-frame{overflow:hidden;aspect-ratio:4/5;border-radius:2px;background:var(--surface)}
.pt-img{width:100%;height:100%;object-fit:cover}
.portrait figcaption{display:grid;grid-template-columns:auto 1fr;gap:.1rem 1rem;margin-top:.9rem;font-size:.9rem;color:var(--muted)}
.portrait figcaption strong{grid-row:span 2;font-family:var(--font-display);font-size:1.5rem;font-weight:400;line-height:1.1;color:var(--ink)}
@media (max-width:59.99rem){.portrait{width:min(82%,26rem);justify-self:end}}
@media (min-width:60rem){.portrait{margin-right:calc(-1 * max(2rem,(100vw - var(--max)) / 2));margin-top:2.5rem}.pt-frame{aspect-ratio:4/5.4;border-radius:2px 0 0 2px}.portrait figcaption{padding-right:2rem}}
.forwho{background:var(--dark);color:var(--on-dark)}
.statement{max-width:20ch;font-size:clamp(2.1rem,1.2rem + 4vw,5.2rem);line-height:1.04;letter-spacing:-.035em;color:var(--on-dark)}
.offer-h{max-width:14ch;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.rates{border-top:1px solid var(--ink)}
.rate{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;align-items:baseline;column-gap:1rem;padding:1.5rem 0;border-bottom:1px solid var(--line)}
.rate-n{font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
.rate h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.6rem,1.2rem + 1.6vw,2.8rem);line-height:1.05;letter-spacing:-.03em}
.rate-m{grid-column:2;grid-row:2;margin-top:.35rem;color:var(--muted)}
.rate-p{grid-column:3;grid-row:1 / span 2;align-self:center;font-family:var(--font-display);font-size:clamp(1.8rem,1.3rem + 2vw,3.4rem);line-height:1;letter-spacing:-.03em;font-variant-numeric:lining-nums tabular-nums;white-space:nowrap}
@media (min-width:60rem){.rate{grid-template-columns:2.5rem minmax(0,6fr) minmax(0,3fr) minmax(0,3fr)}.rate-m{grid-column:3;grid-row:1;margin:0}.rate-p{grid-column:4;grid-row:1;text-align:right}}
.offer-foot{display:grid;gap:2rem;margin-top:2.5rem}
@media (min-width:60rem){.offer-foot{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:end}}
.incl-wrap h3{font-size:.95rem;margin-bottom:.6rem}
.incl{display:grid;gap:.5rem}
.incl li{position:relative;padding-left:1.6rem;font-size:1.08rem}
.incl li::before{content:'';position:absolute;left:0;top:.8em;width:.9rem;height:1px;background:var(--ink)}
.offer-cta{display:grid;gap:.8rem;justify-items:start}
@media (min-width:60rem){.offer-cta{justify-items:end}}
.cap{font-weight:600}
.ways{border-top:1px solid var(--line);--rm-accent:var(--pop)}
.ways .wrap{display:grid;gap:2rem}
@media (min-width:60rem){.ways .wrap{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.ways .rm-head{grid-column:1 / span 4}.ways .rm{grid-column:5 / span 8}.ways-go{grid-column:5 / span 8}}
.ways .rm-wave,.ways .rm-comet{display:none!important}
.ways .rm-nodes{gap:0;padding-left:0;border-top:1px solid var(--ink);grid-template-columns:none;counter-reset:st}
.ways .rm-nodes::before,.ways .rm-nodes::after{display:none}
.ways .rm-node{display:grid;grid-template-columns:2.2rem minmax(0,1fr);column-gap:1.25rem;padding:1.4rem 0 1.5rem;border-bottom:1px solid var(--line);justify-items:start;text-align:left}
.ways .rm-dot{position:relative;left:auto;top:.35rem;margin:0;width:1.6rem;height:1.6rem;border-radius:2px;border:1.5px solid var(--ink);background:var(--bg);font-size:0}
.ways .rm-dot b{display:none}
.ways .rm-dot::after{content:'';position:absolute;left:.42rem;top:.12rem;width:.5rem;height:.9rem;border:solid var(--pop);border-width:0 3px 3px 0;transform:rotate(40deg)}
.ways .rm-txt{justify-items:start}
.ways .rm-txt h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);line-height:1.05;letter-spacing:-.03em}
.ways .rm-sub{max-width:34rem;font-size:1.05rem}
html.rm-go .ways .rm-node .rm-dot{transform:none;opacity:1}
html.rm-go .ways .rm-node .rm-dot::after{opacity:0;transform:rotate(40deg) scale(.4);transition:opacity .25s ease,transform .5s cubic-bezier(.16,1,.3,1)}
html.rm-go .ways .rm-node.on .rm-dot::after{opacity:1;transform:rotate(40deg)}
html.rm-go .ways .rm-node .rm-txt{transform:none}
html.rm-go .ways .rm-node.cur .rm-dot{transform:none;background:var(--bg);color:inherit}
html.rm-go .ways .rm-node.cur .rm-txt h3{color:var(--ink)}
@media (min-width:48rem){.ways .rm-node{padding-top:1.4rem}.ways .rm-dot{left:auto;margin-left:0}}
.ways-go{margin-top:1rem}
.about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.about-in{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.about-h{grid-column:1 / span 3}.about-first{grid-column:4 / span 9}.about-rest{grid-column:7 / span 6}}
.about-h{font-family:var(--font-body);font-size:1rem;font-weight:600;letter-spacing:0;padding-top:.9rem}
.about-first{font-family:var(--font-display);font-size:clamp(1.9rem,1.2rem + 2.8vw,4rem);line-height:1.12;letter-spacing:-.03em;text-wrap:balance}
.about-rest{display:grid;gap:1.1rem;font-size:1.1rem;line-height:1.65;color:var(--muted)}
.quotes{display:grid;gap:2rem;margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:3rem}}
.quote{display:grid;gap:1rem;padding-top:1.25rem;border-top:1px solid var(--ink)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.35rem,1.15rem + .8vw,1.75rem);line-height:1.35}
.quote figcaption{font-weight:600;color:var(--muted)}
.faq-sec{border-top:1px solid var(--line)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.faq-grid>.h2{grid-column:1 / span 4}.faq-grid>.qa{grid-column:6 / span 7}}
.qa{border-top:1px solid var(--ink)}
.qa div{display:grid;gap:.4rem;padding:1.3rem 0;border-bottom:1px solid var(--line)}
.qa dt{font-family:var(--font-display);font-size:clamp(1.25rem,1.1rem + .5vw,1.55rem)}
.qa dd{color:var(--muted)}
.contact{border-top:1px solid var(--ink)}
.contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:4rem}}
.contact-h{font-size:clamp(2.8rem,1.4rem + 5vw,6.4rem);line-height:.98;max-width:12ch}
.contact .lead{margin-top:1.25rem}
.contact-side{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--line)}
.letter{position:relative;padding:clamp(1.3rem,1rem + 1.5vw,2.4rem) clamp(1.3rem,1rem + 1.5vw,2.4rem) clamp(1.3rem,1rem + 1.5vw,2.4rem) clamp(2.2rem,1.6rem + 2vw,3.6rem);background:color-mix(in srgb,#fffdf8 70%,var(--bg));border-left:1px solid color-mix(in srgb,#c96b5c 55%,var(--bg))}
.letter .field input,.letter .field textarea,.letter .field select{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding-inline:0}
.letter .field textarea{min-height:9rem;background:repeating-linear-gradient(transparent 0 calc(2rem - 1px),var(--line) calc(2rem - 1px) 2rem);line-height:2rem;padding-top:0}
.letter .field input:focus,.letter .field textarea:focus{border-bottom-color:var(--ink);box-shadow:none}
.form-title{margin-bottom:1.25rem;font-family:var(--font-display);font-size:1.9rem;font-weight:400;font-style:normal;letter-spacing:-.02em}
.menu-panel li a{font-weight:400;letter-spacing:-.03em}
.sec{padding-block:clamp(4rem,3rem + 4vw,7.5rem)}
.ftr{background:var(--bg)}
.mbar{background:var(--bg);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'coach',
  name: 'Northstar',
  bestFor: 'Coaches, tutors, consultants and anyone people book one to one, with motion',
  why: 'Calm and confident, set on writing paper: the plan develops like a photograph as the headline comes into focus, your rates set like a written fee list, your steps as a plan whose boxes tick themselves as you scroll, and a contact form written like a letter.',
  fonts: { q: 'family=Newsreader:ital,opsz,wght@0,48,400;1,48,400&family=Manrope:wght@400;500;600;700', display: ['Newsreader', 'serif'], body: ['Manrope', 'sans'] },
  // The motion, as data (lib/choreo.md): coming into focus, a calm drift, steps that take their turn.
  choreo: { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'roadmap', pace: 'calm', look: 'writing paper and graphite, coming into focus' },
  tokens,
  slots,
  nav,
  render,
  art,
};
