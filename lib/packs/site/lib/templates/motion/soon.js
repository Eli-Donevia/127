// Soon (animated, product, for a waitlist): a bedroom at night, one product not out yet.
//   Object:   the product's dial, drawn in hairline: a ring of ticks and one bright mark, the thing you reach for in the
//             dark. The name is set beside it, large, in a soft serif.
//   Material: night and a warm lamp: a deep blue-black room, soft serif type, fine grain, nothing glossy.
//   One move: the dial comes into focus like eyes adjusting to the dark (only the dial develops) and turns down to its
//             resting mark while the name rises out of its baseline beside it. At rest the dial drifts like slow
//             breathing and leans toward the pointer.
//   Pop:      the member's colour is the dial's one mark in the hero, then the needle that each listed thing is tuned
//             to as you scroll.
// The launch date is set like a label; with a full date, the page counts the nights left (script only, its space
// reserved). The email form is in the first screen. Sections: hero; what's in it, the dial seen close and turned by
// the scroll (pinned on a desktop) so each thing the member listed comes under the needle in turn; the member's story
// when they wrote one; their questions when they gave two or more. No light blobs, no typewriter, no monogram.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'soon';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Night (own mode), and the morning after: a pale linen page. The bedside, with the device on it, stays at night in
// both, the one dark room on the page.
function tokens(p, mode) {
  const dark = color.mix(color.mix(p.ink, p.primary, 0.22), '#05070c', 0.72);
  return mode === 'light' ? { bg: color.mix(p.paper, '#f3f1ec', 0.8), dark } : { dark };
}

// The bedside at night: a dark wall and the top of a bedside table, a warm lamp just out of frame on the left, the
// middle left empty for the dial. Dark in both modes.
function slots(c) {
  return [{ slot: 'hero', file: 'bedside.jpg', w: 1400, h: 1600, style: 'portrait', alt: `${c.productName || c.name} on a bedside table at night` }];
}

// The bedside, drawn: a blue-black wall, a lamp's warm fall-off from the left edge, the table top in the lower third
// catching the same light along its front edge, a little film grain.
function art(slot, ctx) {
  const ph = ctx.art.photo('soon', slot.slot);
  if (ph) return ph;
  if (slot.slot !== 'hero') return null;
  const { p } = ctx;
  const { w, h } = slot;
  const wall = color.mix('#0a0d14', p.primary, 0.06);
  const top = h * 0.74;
  const defs = `<linearGradient id="wl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.mix(wall, '#000', 0.4)}"/><stop offset="1" stop-color="${wall}"/></linearGradient>`
    + `<radialGradient id="lm" cx="-.08" cy=".5" r=".95"><stop offset="0" stop-color="#ffcf96" stop-opacity=".22"/><stop offset=".5" stop-color="#ffcf96" stop-opacity=".05"/><stop offset="1" stop-color="#ffcf96" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a221c"/><stop offset=".06" stop-color="#16120f"/><stop offset="1" stop-color="#070605"/></linearGradient>`
    + `<filter id="fg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0"/></filter>`;
  const body = `<rect width="${w}" height="${h}" fill="url(#wl)"/><rect y="${top}" width="${w}" height="${h - top}" fill="url(#tb)"/><rect y="${top}" width="${w}" height="2" fill="#ffcf96" opacity=".18"/><rect width="${w}" height="${h}" fill="url(#lm)"/><rect width="${w}" height="${h}" filter="url(#fg)"/>`;
  return ctx.art.svgDoc(w, h, defs, body);
}

function nav(c) {
  return [c.included.length >= 2 && { label: "What's in it", href: '#coming' }, c.faq.length >= 2 && { label: 'Questions', href: '#faq' }].filter(Boolean);
}

// A full date (with a day) gives a count of nights; anything looser ("Spring 2027") is shown as written.
function launchDate(deadline) {
  const s = String(deadline || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d = null;
  if (iso) d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  else if (/\b\d{1,2}(st|nd|rd|th)?\b/.test(s.replace(/\b\d{4}\b/, '')) && /\b\d{4}\b/.test(s) && !Number.isNaN(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`))) d = new Date(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`));
  if (!d || Number.isNaN(d.getTime())) return { text: s, iso: '' };
  return { text: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`, iso: d.toISOString().slice(0, 10) };
}

// The dial: 48 ticks on a ring, every fourth one longer, and the one mark in the member's colour.
function dial(ph) {
  const ticks = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    const r1 = long ? 84 : 88;
    const x1 = 100 + Math.sin(a) * r1;
    const y1 = 100 - Math.cos(a) * r1;
    const x2 = 100 + Math.sin(a) * 94;
    const y2 = 100 - Math.cos(a) * 94;
    ticks.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"${long ? ' class="lg"' : ''}/>`);
  }
  return `<div class="sn-dialbox" aria-hidden="true">${ph}<div class="sn-breath" data-alive="0.6"><div class="sn-dial" data-ci="subject"><svg viewBox="0 0 200 200">
<defs><radialGradient id="sn-knob-g" cx="38%" cy="30%" r="80%"><stop offset="0" class="s1"/><stop offset=".55" class="s2"/><stop offset="1" class="s3"/></radialGradient></defs>
<g class="sn-ticks">${ticks.join('')}</g>
<circle class="sn-face" cx="100" cy="100" r="70" fill="url(#sn-knob-g)"/>
<circle class="sn-rim" cx="100" cy="100" r="62"/>
<g class="sn-knob"><line class="sn-mark" x1="100" y1="44" x2="100" y2="62"/></g>
</svg><i class="sn-led"></i></div></div></div>`;
}

// The scroll moment: the dial seen close, a long arc of ticks with one stop for each thing the member listed. The arc
// turns as you scroll so each stop comes under the needle (the member's colour) while its line is lit beside it.
function tuner(items) {
  const STEP = 24;
  const ticks = [];
  for (let i = 0; i < 120; i++) {
    const a = (i * 3 * Math.PI) / 180;
    const long = i % 8 === 0;
    const r1 = long ? 404 : 418;
    ticks.push(`<line x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * 440).toFixed(1)}" y2="${(-Math.cos(a) * 440).toFixed(1)}"${long ? ' class="lg"' : ''}/>`);
  }
  const stops = items.map((x, i) => `<g transform="rotate(${i * STEP})"><line class="st" x1="0" y1="-384" x2="0" y2="-446"/><circle class="sd" cx="0" cy="-364" r="5"/></g>`).join('');
  return `<div class="sn-tuner" aria-hidden="true"><svg viewBox="-500 -500 1000 1000"><circle class="sn-face" r="330" fill="url(#sn-knob-g)"/><g class="sn-arc">${ticks.join('')}${stops}</g><path class="sn-needle" d="M0 -470V-372"/></svg></div>`;
}

// The footer: the dial's mark small, the name in the soft serif, and one quiet line beneath it.
function footer(c, name, date) {
  const links = (c.nav || []).map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`);
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean);
  return `<footer class="sn-ftr"><div class="wrap sn-ftr-in">
<svg class="sn-ftr-d" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15"/><path d="M20 8v6"/></svg>
<p class="sn-ftr-n">${esc(name)}${date ? `<span>${esc(date.text)}</span>` : ''}</p>
<p class="sn-ftr-l">${[...links, ...reach, `&copy; ${esc(c.year)} ${esc(c.name)}`].map((x) => `<span>${x}</span>`).join('')}</p>
${P.socials(c, { cls: 'sn-ftr-so', size: 18 })}
</div></footer>`;
}

function render(c) {
  const name = c.productName || c.name;
  const date = launchDate(c.deadline);
  const len = [...name].length;
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const what = c.whatShort && norm(c.whatShort) !== norm(name) && !norm(sub).includes(norm(c.whatShort)) ? c.whatShort : '';
  const own = c.aboutParas.length && c.about !== draftCopy({ ...c, about: '' }, 'product').about;
  const faqs = c.faq;

  const form = P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: c.buy ? 'Keep me posted' : 'Join the waitlist', subject: `Waitlist for ${name}`, cls: 'sn-f' });

  const hero = `<section class="sn-hero" aria-labelledby="hero-title">
<div class="wrap sn-hero-in">
<div class="sn-head">
${what ? `<p class="sn-what" data-ci="then">${esc(what)}</p>` : ''}
<h1 id="hero-title" class="sn-name${len > 10 ? ' long' : ''}" data-ci="then" data-ci-from="mask">${esc(name)}</h1>
</div>
${dial(c.images.hero ? `<div class="sn-ph"><img src="${esc(c.images.hero.src)}" alt="" width="${c.images.hero.w}" height="${c.images.hero.h}" fetchpriority="high" decoding="async"></div>` : '')}
<div class="sn-ask" id="signup">
<p class="sn-sub" data-ci="then">${esc(sub)}</p>
<div class="sn-form" data-ci="then">${form}</div>
${date ? `<p class="sn-date" data-ci="then"><span>Launching</span> ${date.iso ? `<time datetime="${date.iso}">${esc(date.text)}</time>` : esc(date.text)}${date.iso ? `<span class="sn-nights" data-date="${date.iso}"></span>` : ''}</p>` : ''}
${c.buy ? `<p class="sn-buy" data-ci="then"><a href="${esc(c.buy.href)}">${esc(c.buy.label)}</a></p>` : ''}
</div>
</div>
</section>`;

  // What's in it: the member's own list as stops on the dial, tuned in one by one as you scroll (pinned on a desktop).
  const items = c.included.slice(0, 6);
  const coming = items.length >= 2
    ? `<section class="sn-tune" id="coming" aria-labelledby="coming-title" data-sc style="--k:${items.length}">
<div class="sn-tune-stage" data-sc-stage>
${tuner(items)}
<div class="wrap sn-tune-in">
<div class="sn-tune-copy">
<h2 class="sn-h2" id="coming-title">What's in it.</h2>
<ol class="sn-stops">${items.map((x, i) => `<li data-sc-part><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(x)}</span></li>`).join('')}</ol>
<p class="sn-again"><a href="#signup">${esc(c.buy ? 'Keep me posted' : 'Join the waitlist')}</a>${date ? ` <span>${esc(date.text)}</span>` : ''}</p>
</div>
</div>
</div>
</section>`
    : c.included.length
      ? `<section class="sn-sec" id="coming" aria-labelledby="coming-title"><div class="wrap"><h2 class="sn-h2" id="coming-title">${esc(c.included[0])}</h2></div></section>`
      : '';

  const about = own
    ? `<section class="sn-sec" aria-labelledby="about-title"><div class="wrap sn-about" data-rv><h2 class="sn-side" id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${c.name}`)}</h2><div>${c.aboutParas.map((p, i) => `<p class="${i ? 'sn-p' : 'sn-say'}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';

  const faq = faqs.length >= 2
    ? `<section class="sn-sec" id="faq" aria-labelledby="faq-title"><div class="wrap sn-faq"><h2 class="sn-h2" id="faq-title" data-rv>Asked at night.</h2><dl class="sn-qa" data-rv style="--d:2">${faqs.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const m = motion();
  const body = [P.header(c, { cls: 'sn-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, coming, about, faq, '</main>', footer(c, name, date), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '4px', btnRadius: '4px', max: '82rem' } };
}

// The nights left (only for a full date; its space is reserved, so nothing moves), and the phone bar that waits until
// the form has scrolled away. Both run with reduced motion too: they are information, not motion.
const JS = `(function(){var d=document;
[].slice.call(d.querySelectorAll('.sn-nights')).forEach(function(el){var t=Date.parse(el.getAttribute('data-date')+'T00:00:00');var n=Math.ceil((t-Date.now())/864e5);if(n>1)el.textContent=n+' nights to go';else if(n===1)el.textContent='Tomorrow night'});
var bar=d.querySelector('.mbar'),ask=d.getElementById('signup');if(bar&&ask){bar.classList.add('wait');new IntersectionObserver(function(es){bar.classList.toggle('wait',es[0].isIntersecting||es[0].boundingClientRect.top>0)}).observe(ask)}
})();`;

const CSS = `
${FOOTER_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);--soft:color-mix(in srgb,var(--on-dark) 86%,var(--dark));--ease:cubic-bezier(.16,1,.3,1)}
h1,h2,h3{font-weight:400;letter-spacing:-.02em}
.btn{font-weight:500}
.btn-primary,.mbar .btn-primary,.form .btn-primary{background:var(--on-dark);color:var(--dark);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--on-dark) 86%,var(--primary-on-dark))}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.9rem}
.hdr{position:absolute;left:0;right:0;top:0;z-index:30}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.4rem;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.92rem;color:var(--soft);text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;padding-block:.3rem;transition:background-size .4s var(--ease)}
.nav a:hover{background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.menu>summary{border-radius:4px;border-color:var(--edge);background:transparent;color:var(--on-dark)}
.menu-panel{background:var(--dark);border-color:var(--edge);border-radius:0}
.menu-panel li a{font-family:var(--font-display);font-weight:400;font-size:2rem;border-bottom-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the room at night */
.sn-hero{position:relative;isolation:isolate;overflow:hidden;min-height:100vh;min-height:100svh;display:grid;align-items:end;padding-block:6.5rem clamp(2rem,1.5rem + 2vw,3.5rem)}
.sn-hero-in{display:grid;gap:2rem}
@media (min-width:60rem){.sn-hero-in{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto auto;gap:2.5rem 1.5rem;align-items:end}.sn-head{grid-column:1/9;grid-row:1}.sn-dialbox{grid-column:9/13;grid-row:1;align-self:center}.sn-ask{grid-column:1/13;grid-row:2}}
.sn-what{font-size:1rem;color:var(--soft)}
.sn-name{margin-top:.6rem;margin-left:-.05em;font-size:clamp(4.4rem,1rem + 15vw,16rem);line-height:.84;letter-spacing:-.045em;padding-bottom:.08em}
.sn-name.long{font-size:clamp(3.4rem,1rem + 9vw,10rem);line-height:.9}
.sn-ask{display:grid;gap:1.2rem 2.5rem;padding-top:1.6rem;border-top:1px solid var(--edge)}
@media (min-width:60rem){.sn-ask{grid-template-columns:4fr 5fr 3fr;align-items:start}}
.sn-sub{max-width:24rem;font-family:var(--font-display);font-size:clamp(1.35rem,1.1rem + .8vw,1.8rem);line-height:1.2;letter-spacing:-.01em}
.sn-f{gap:.6rem}
.sn-f .field label{font-weight:500;font-size:.9rem;color:var(--soft)}
.field input{border-radius:4px;border-color:var(--edge);background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));color:var(--on-dark)}
.form-note{color:var(--muted);font-size:.875rem}
.form-note a{color:var(--on-dark)}
.sn-date{display:grid;gap:.2rem;font-variant-numeric:tabular-nums}
.sn-date span:first-child{font-size:.9rem;color:var(--muted)}
.sn-date time{font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + .8vw,2.1rem);line-height:1.1;letter-spacing:-.01em}
.sn-nights{display:block;min-height:1.6em;font-size:.95rem;color:var(--soft)}
.sn-buy a{color:var(--on-dark);font-weight:500}
/* the dial */
.sn-dialbox{position:relative;isolation:isolate;display:grid;place-items:center}
.sn-breath{width:min(100%,28rem)}
/* the bedside photo (or its drawing) behind the dial, dark in both modes */
.sn-ph{position:absolute;inset:0;z-index:-1;overflow:hidden;background:#07090d}
.sn-ph img{width:100%;height:100%;object-fit:cover;object-position:40% 60%}
html.m .sn-ph img{transform:scale(1.06);transition:transform 3s cubic-bezier(.16,1,.3,1)}
html.m.ci-go .sn-ph img{transform:none}
@media (min-width:60rem){.sn-head{position:relative;z-index:1}.sn-hero-in .sn-dialbox{grid-column:8/13;align-self:stretch;margin:-2.25rem calc((100vw - min(100vw - 4rem,var(--max))) / -2) 0 0;padding:clamp(2.5rem,1rem + 4vw,5rem) clamp(2rem,1rem + 3vw,4.5rem)}.sn-hero-in .sn-head{grid-column:1/8}.sn-name{font-size:clamp(4.4rem,1rem + 10.5vw,13rem)}}
@media (max-width:59.99rem){.sn-dialbox{order:-1;margin-inline:-1rem;padding:2.2rem 0 2.6rem}.sn-breath{width:min(56vw,17rem)}.sn-hero{padding-top:4.25rem}}
@media (min-width:48rem) and (max-width:59.99rem){.sn-dialbox{margin-inline:-2rem}}
/* the neon moment: the standby light under the dial, a pinpoint with a small bloom */
.sn-dial{position:relative}
.sn-led{position:absolute;left:50%;top:86%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:color-mix(in srgb,var(--neon) 60%,#fff);box-shadow:0 0 6px 1px color-mix(in srgb,var(--neon) 50%,transparent),0 0 16px color-mix(in srgb,var(--neon) 30%,transparent)}
html.m .sn-led{opacity:0;transition:opacity 1.2s ease 2.4s}
html.m.ci-go .sn-led{opacity:1}
html.m:not(.ci-go) .sn-led{animation:snLed 0s 3s forwards}
@keyframes snLed{to{opacity:1}}
.sn-dial svg{display:block;width:100%;height:auto;overflow:visible}
.sn-ticks line{stroke:color-mix(in srgb,var(--on-dark) 32%,transparent);stroke-width:.7}
.sn-ticks line.lg{stroke:color-mix(in srgb,var(--on-dark) 70%,transparent);stroke-width:1}
.sn-face{stroke:color-mix(in srgb,var(--on-dark) 22%,transparent);stroke-width:.6}
.sn-dial .s1{stop-color:color-mix(in srgb,var(--on-dark) 16%,var(--dark))}.sn-dial .s2{stop-color:color-mix(in srgb,var(--on-dark) 6%,var(--dark))}.sn-dial .s3{stop-color:color-mix(in srgb,#000 30%,var(--dark))}
.sn-dial{filter:drop-shadow(0 18px 22px rgba(0,0,0,.45))}
.sn-rim{fill:none;stroke:color-mix(in srgb,var(--on-dark) 12%,transparent);stroke-width:.6}
.sn-mark{stroke:var(--pop);stroke-width:3.2;stroke-linecap:round}
.sn-knob{transform-origin:100px 100px;transform:rotate(-38deg)}
html.m .sn-knob{transform:rotate(150deg)}
html.m.ci-go .sn-knob{transform:rotate(-38deg);transition:transform 2.2s cubic-bezier(.45,0,.2,1) .5s}
html.m:not(.ci-go) .sn-knob{animation:snKnob 0s 2.8s forwards}
@keyframes snKnob{to{transform:rotate(-38deg)}}
/* what's in it: the dial close up, tuned by the scroll */
.sn-h2{font-family:var(--font-display);font-size:clamp(2.8rem,1.6rem + 4.4vw,6rem);line-height:.92;letter-spacing:-.035em;font-weight:400}
.sn-tune{position:relative;border-top:1px solid var(--edge);--rot:calc(-1 * clamp(0deg,(var(--p,0) * var(--k) - .5) * 24deg,(var(--k) - 1) * 24deg))}
.sn-tune-stage{position:relative;overflow:hidden;padding-block:clamp(4rem,3rem + 5vw,8rem)}
.sn-tuner{position:absolute;left:calc(27vw - min(45vh,24vw));top:clamp(5rem,3rem + 12vh,9rem);width:min(90vh,48vw);aspect-ratio:1;pointer-events:none}
.sn-tuner svg{display:block;width:100%;height:100%;overflow:visible}
.sn-arc{transform:rotate(var(--rot));transition:transform .5s cubic-bezier(.3,0,.2,1)}
.sn-arc line{stroke:color-mix(in srgb,var(--on-dark) 26%,transparent);stroke-width:1.4}
.sn-arc line.lg{stroke:color-mix(in srgb,var(--on-dark) 55%,transparent);stroke-width:2}
.sn-arc line.st{stroke:var(--on-dark);stroke-width:3}
.sn-arc .sd{fill:var(--soft)}
.sn-needle{stroke:var(--pop);stroke-width:6;stroke-linecap:round}
.sn-tuner .sn-face{stroke:color-mix(in srgb,var(--on-dark) 14%,transparent);stroke-width:1.5;filter:drop-shadow(0 30px 40px rgba(0,0,0,.5))}
.sn-tune-in{position:relative;display:grid}
@media (min-width:60rem){.sn-tune-in{grid-template-columns:repeat(12,minmax(0,1fr))}.sn-tune-copy{grid-column:8/13}}
@media (max-width:59.99rem){.sn-tuner{position:relative;left:-10vw;top:0;width:120vw;height:15rem;aspect-ratio:auto;overflow:hidden;margin-bottom:1rem}.sn-tuner svg{height:auto}.sn-tune-stage{padding-top:2.5rem}}
.sn-stops{margin-top:clamp(1.8rem,1rem + 2vw,3rem);border-top:1px solid var(--edge)}
.sn-stops li{display:grid;grid-template-columns:2.6rem 1fr;gap:.6rem;padding-block:1.05rem;border-bottom:1px solid var(--edge);transition:color .4s ease}
.sn-stops b{font-weight:500;font-size:.9rem;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:.35rem}
.sn-stops span{font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);line-height:1.18}
.sn-again{margin-top:1.8rem;color:var(--muted)}
.sn-again a{color:var(--on-dark);font-weight:500;text-underline-offset:.25em}
@media (min-width:48rem) and (hover:hover){
html.m .sn-tune[data-sc]{height:calc(100vh + min(var(--n,3) * 40vh,150vh))!important;height:calc(100svh + min(var(--n,3) * 40svh,150svh))!important}
html.m .sn-tune-stage{height:100vh;height:100svh;display:grid;align-content:center;padding-block:4rem 2rem}
html.m .sn-stops li{color:var(--muted)}
html.m .sn-stops li.cur{color:var(--on-dark)}
}
.sn-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.sn-about{display:grid;gap:1.5rem}
@media (min-width:60rem){.sn-about{grid-template-columns:3fr 9fr}}
.sn-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.sn-say{font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2vw,3rem);line-height:1.14;max-width:26ch}
.sn-p{margin-top:1.2rem;font-size:1.15rem;line-height:1.6;color:var(--soft);max-width:40rem}
.sn-faq{display:grid;gap:2rem}
@media (min-width:60rem){.sn-faq{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.sn-qa{border-top:1px solid var(--edge)}
.sn-qa div{padding-block:1.3rem;border-bottom:1px solid var(--edge)}
.sn-qa dt{font-family:var(--font-display);font-size:1.4rem;line-height:1.2}
.sn-qa dd{margin-top:.4rem;color:var(--soft)}
/* footer: quiet, the name in the soft serif, the rest dimmed like a room with the lamp off */
.sn-ftr{padding-block:clamp(4rem,3rem + 3vw,6rem) 2rem;border-top:1px solid var(--edge);text-align:center}
.sn-ftr-in{display:grid;justify-items:center;gap:1rem}
.sn-ftr-d{width:2.4rem;height:2.4rem;fill:none;stroke:var(--soft);stroke-width:1.2}
.sn-ftr-d path{stroke:var(--pop);stroke-width:2;stroke-linecap:round}
.sn-ftr-n{display:grid;gap:.3rem;font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.2rem);line-height:1;letter-spacing:-.02em}
.sn-ftr-n span{font-family:var(--font-body);font-size:.9rem;letter-spacing:.02em;color:var(--muted)}
.sn-ftr-l{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem 1.4rem;font-size:.88rem;color:var(--muted)}
.sn-ftr-l a{color:var(--soft);text-decoration:none}.sn-ftr-l a:hover{color:var(--on-dark)}
.sn-ftr .legal-links{margin-top:1.2rem}
.sn-ftr .mpause{background:transparent;color:var(--on-dark);border-color:var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.mbar.wait{transform:translateY(120%)}
.mpause{border-radius:4px}
/* morning: the page in linen and ink; the bedside panel keeps the night, and the dial in it its night colours */
html[data-theme="light"]{--night:var(--dark)}
html[data-theme="light"] body{--bg:inherit;--ink:inherit;--muted:inherit;--line:inherit;--primary-text:inherit;--focus:inherit;--dark:var(--bg);--on-dark:var(--ink);--muted-on-dark:var(--muted);--line-on-dark:var(--line);--primary-on-dark:var(--primary-text);--edge:color-mix(in srgb,var(--ink) 14%,transparent);--soft:color-mix(in srgb,var(--ink) 80%,var(--bg))}
html[data-theme="light"] .sn-dialbox{--dark:var(--night);--on-dark:#e8ebf0;--soft:#c4c9d1;--edge:rgba(232,235,240,.14)}
html[data-theme="light"] .btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
html[data-theme="light"] .sn-dial .s1{stop-color:color-mix(in srgb,#e8ebf0 16%,var(--night))}
html[data-theme="light"] .sn-tuner .sn-face{filter:drop-shadow(0 30px 40px rgba(20,24,34,.22))}
html[data-theme="light"] .field input{background:color-mix(in srgb,#fff 60%,var(--bg))}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Soon',
  bestFor: 'A product that is not out yet: a waitlist page with one email form and the launch date',
  match: /\b(coming soon|waitlist|wait list|pre-?orders?|launching soon|not out yet)\b/,
  why: 'Built for a waitlist: a night room that comes into focus, your product name large beside a drawn dial that turns down to rest, the email form in the first screen, the launch date and the nights left, and what is in it tuned in on the dial as you scroll.',
  fonts: { q: 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600', display: ['Fraunces', 'serif'], body: ['DM Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): eyes adjusting to the dark, a dial that breathes, what's coming drawn in.
  choreo: { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'pin', pace: 'calm', look: 'a bedroom at night, soft and slow' },
  modes: ['dark', 'light'],
  tokens,
  slots,
  art,
  nav,
  render,
};
