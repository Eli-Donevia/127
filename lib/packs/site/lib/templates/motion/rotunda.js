// Rotunda (animated, portfolio): the work hung on the inside of a curved gallery wall, then each piece on its own.
//   Object: the rotunda. The member's pieces stand on a cylinder around the viewer (CSS 3D, no library) that turns as
//   you scroll or drag, with inertia; the cards bend a little with the speed.
//   Material: gallery plaster in daylight: a warm white wall, graphite type, hairline rules, square frames, a wall label.
//   One move: develop. The name comes into focus word by word as the curved wall develops like a print, from a pale blur.
//   Pop: the member's colour as the line drawn under the name's last word, the hovered piece's number and rule, and the
//   roadmap's line.
// Below the wall, the case studies: the first full width, the rest in pairs of a large and a small print, each captioned
// beside it. Then who it was made for set as one line, services as a price list, about, how it works as a roadmap that
// draws itself with the scroll and ends at the button, and the project form. At rest the wall leans toward the pointer
// and drifts on springs. Phones get a flat carousel that snaps card by card; reduced motion and no script get a plain
// grid. Its motion is the `choreo` block at the bottom (lib/choreo.md), and the ring keeps its own script.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'rotunda';
const STYLES = ['portrait', 'sweep', 'arch', 'mesh', 'object', 'plates', 'grid', 'tile'];

function tokens(p) {
  return { bg: color.mix(p.paper, '#f3f1ec', 0.88), dark: color.mix(color.mix(p.ink, p.primary, 0.08), '#0d0d0d', 0.8) };
}

// The pieces with photos: the member's work (up to 12), else 8 placeholder spots.
function pieceCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(12, n) : 8;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const out = [];
  for (let i = 0; i < pieceCount(c); i++) {
    const piece = (c.work || [])[i];
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 1200, h: 1500, style: STYLES[i % STYLES.length], alt: piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work` });
  }
  out.push({ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'at work'}` : `${c.name} at work` });
  return out;
}

function nav(c) {
  return [
    { label: 'Work', href: '#work' },
    c.services.length || c.included.length ? { label: 'Services', href: '#services' } : null,
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

const num = (i) => String(i + 1).padStart(2, '0');

// The name, broken into lines in the markup (balanced by length) and sized in CSS from its longest line, so its
// height is fixed before the font arrives. Wide screens keep it on one line when it fits.
function nameLines(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const len = words.join(' ').length;
  const k = words.length < 2 || len < 9 ? 1 : len > 26 && words.length > 2 ? 3 : 2;
  let best = { worst: len, g: [words] };
  if (k > 1) {
    const cuts = (from, left) => (left === 1 ? [[words.slice(from)]] : words.slice(from, words.length - left + 1).flatMap((_, j) => cuts(from + j + 1, left - 1).map((r) => [words.slice(from, from + j + 1), ...r])));
    for (const g of cuts(0, k)) {
      const worst = Math.max(...g.map((x) => x.join(' ').length));
      if (worst < best.worst) best = { worst, g };
    }
  }
  const one = len <= 22;
  const fs = Math.min(14, 222 / Math.max(one ? len : best.worst, 4)).toFixed(2);
  const fsm = Math.min(24, 206 / Math.max(best.worst, 4)).toFixed(2);
  return { html: best.g.map((g) => `<span class="nl">${g.map(esc).join(' ')}</span>`).join(' '), style: `--fs:${fs}vw;--fsm:${fsm}vw`, one };
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const work = (c.work || []).slice(0, 12);
  const n = pieceCount(c);
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  // A full ring needs about ten cards: the pieces repeat around it (the repeats are hidden from screen readers).
  const ring = Math.max(n, 10);
  const cards = [];
  for (let k = 0; k < ring; k++) {
    const i = k % n;
    const piece = work[i];
    const dup = k >= n;
    const href = piece ? `#case-${i + 1}` : '#contact';
    const img = P.img(c, `w${i + 1}`, { eager: k < 3 }).replace(dup ? /alt="[^"]*"/ : /$^/, 'alt=""');
    cards.push(`<li class="rt-card${dup ? ' dup' : ''}" style="--i:${k}"${dup ? ' aria-hidden="true"' : ''}><a class="rt-in" href="${href}"${dup ? ' tabindex="-1"' : ''}><span class="rt-ph">${img}</span><span class="rt-cap"><span class="rt-n">${num(i)}</span>${piece ? `<span class="rt-t">${esc(piece.title)}</span>` : ''}</span></a></li>`);
  }

  // The wall label: what, where, from what price, set like the card beside a print.
  const label = [
    c.whatShort && c.whatShort !== c.name ? c.whatShort : '',
    c.online ? '' : c.city || c.area,
    low ? `From ${low.priceText.replace(/^From /, '')}` : '',
  ].filter(Boolean);
  const nm = nameLines(c.name);
  const hero = `<section class="rt-hero" aria-labelledby="hero-title">
<div class="wrap rt-intro">
<h1 class="rt-name${nm.one ? ' one' : ''}" id="hero-title" data-ci="head" style="${nm.style}">${nm.html}</h1>
<div class="rt-row">
<p class="rt-lead" data-ci="then">${esc(c.heroSub)}</p>
<div class="rt-side" data-ci="then">
${label.length ? `<p class="rt-label">${label.map((x, i) => `<span${i === 0 ? ' class="lb-1"' : ''}>${esc(x)}</span>`).join('')}</p>` : ''}
${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}
</div>
</div>
</div>
</section>
<section class="rt-gal" id="work" aria-labelledby="work-title">
<h2 class="sr-only" id="work-title">Selected work</h2>
<div class="rt-pin" data-ci="subject">
<div class="rt-scene" data-alive="0.45"><ul class="rt-ring">${cards.join('')}</ul></div>
<p class="rt-hint" aria-hidden="true"><span>Drag or scroll</span><span class="rt-count">${num(n - 1)} pieces</span></p>
</div>
</section>`;

  // The case studies: the first full width, then pairs of a large and a small print, alternating sides.
  // The first piece full width; after it, pairs of a large and a small print that swap sides each row.
  const caseCls = (i, len) => {
    if (i === 0) return 'full';
    const k = i - 1, row = Math.floor(k / 2), first = k % 2 === 0;
    if (first && i === len - 1) return 'solo';
    return row % 2 ? (first ? 's a' : 'l b') : first ? 'l a' : 's b';
  };
  const cases = work.length
    ? `<section class="rt-cases" aria-label="Case studies">${work
        .map(
          (p, i) => `<article class="rt-case" data-at="${caseCls(i, work.length)}" id="case-${i + 1}" aria-labelledby="case-${i + 1}-t">
<div class="rt-case-media" data-rv="mask"><div>${P.img(c, `w${i + 1}`, { cls: 'rt-case-img' }).replace(/alt="[^"]*"/, 'alt=""').replace('<img ', '<img data-par="0.05" ')}</div></div>
<div class="rt-case-copy"><span class="rt-n">${num(i)}</span><h3 class="rt-case-t" id="case-${i + 1}-t">${esc(p.title)}</h3>${p.detail ? `<p class="rt-case-d">${esc(p.detail)}</p>` : ''}${p.href ? `<a class="rt-case-a" href="${esc(p.href)}">${esc(p.linkLabel || 'See it')}${icon('arrowUpRight', { size: 16 })}</a>` : ''}</div>
</article>`
        )
        .join('\n')}</section>`
    : '';

  const cl = c.clients || [];
  const clients = cl.length
    ? `<section class="rt-sec rt-clients" aria-labelledby="clients-title"><div class="wrap"><h2 class="sr-only" id="clients-title">Made for</h2><p class="rt-cl" data-rv>Made for ${cl.map((x, i) => `<span>${esc(x)}</span>${i < cl.length - 2 ? ', ' : i === cl.length - 2 ? ' and ' : '.'}`).join('')}</p></div></section>`
    : '';

  const services = c.services.length || c.included.length
    ? `<section class="rt-sec" id="services" aria-labelledby="services-title"><div class="wrap rt-svc-grid">
<div><h2 class="rt-h2" id="services-title" data-split>${c.services.length ? 'Ways to work together' : "What's included"}</h2>${c.services.some((s) => s.priceText) ? '<p class="rt-p">Prices are a starting point. Every project gets a written quote before anything is booked.</p>' : ''}</div>
<div>
${c.services.length ? `<ul class="rt-svc">${c.services.map((s, i) => `<li data-rv style="--d:${i % 4}"><span class="rt-n">${num(i)}</span><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="rt-incl" data-rv><h3>${c.services.length ? 'Every project includes' : 'With every project'}</h3><ul>${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</div>
</div></section>`
    : '';

  const about = `<section class="rt-sec rt-about" id="about" aria-labelledby="about-title"><div class="wrap rt-about-grid">
<figure class="rt-about-media" data-rv="mask"><div>${P.img(c, 'portrait', { cls: 'rt-about-img' }).replace('<img ', '<img data-par="0.05" ')}</div></figure>
<div class="rt-about-copy"><h2 class="rt-h2" id="about-title" data-split>${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p class="rt-p${i === 0 ? ' first' : ''}" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c, { cls: 'rt-soc' })}</div></div>
</div></section>`;

  // How it works as a roadmap: the member's steps, drawn in with the scroll, ending at the page's button.
  const how = c.steps.length ? roadmap({ id: 'how', cls: 'rt-road', title: 'From first message to final files', nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })), end: mag(P.button(c.primary, 'btn btn-primary')), endLabel: person || c.name }) : '';

  const reviews = c.reviews.length
    ? `<section class="rt-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">Kind words</h2><div class="rt-quotes">${c.reviews.map((r, i) => `<figure class="rt-q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const faq = c.faq.length ? `<section class="rt-sec" id="faq" aria-labelledby="faq-title"><div class="wrap rt-faq"><h2 class="rt-h2" id="faq-title" data-split>Good to know</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const types = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const fields = ['name', 'email', { ...P.FIELD_PRESETS.company, label: 'Business or brand' }, types || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' }, types ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null, { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true }].filter(Boolean);
  const contact = `<section class="rt-sec rt-contact" id="contact" aria-labelledby="contact-title"><div class="wrap rt-contact-grid">
<div><h2 class="rt-h2 big" id="contact-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="rt-p" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="rt-p" data-rv style="--d:4">${esc(c.promise)}</p>` : ''}
${c.booking ? `<div class="rt-book" data-rv style="--d:5">${mag(P.button(c.primary, 'btn btn-primary btn-lg', 'calendar'))}</div>` : ''}
<div data-rv style="--d:5">${P.contactList(c)}</div></div>
<div class="rt-form" data-rv style="--d:2">${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}</div>
</div></section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'rt-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, cases, clients, services, about, how, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '86rem' } };
}

// The ring (wide screens with motion only): the pinned section's scroll and any drag turn it; a drag keeps going and
// slows down; the speed bends the cards a little. Each card is placed from its angle; cards far round the back hide.
// The loop runs only while the gallery is on screen and stops when nothing moves.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,gal=d.querySelector('.rt-gal');if(!gal)return;var wide=matchMedia('(min-width: 48rem)');
var cards=[].slice.call(gal.querySelectorAll('.rt-card')),n=cards.length,step=360/n,drag=0,vel=0,last=null,bend=0,R=600,on=false,raf=0,down=null,moved=0;
function size(){var w=cards[0].offsetWidth||300;R=Math.round(w/2/Math.tan(Math.PI/n)*1.06);gal.style.setProperty('--r',R+'px')}
function rot(){var r=gal.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));return p*300+drag}
function draw(){raf=0;if(!wide.matches)return;if(!down){drag+=vel;vel*=.94;if(Math.abs(vel)<.01)vel=0}var a=rot(),dv=last===null?0:a-last;last=a;bend+=(Math.max(-12,Math.min(12,dv*2.2))-bend)*.18;
for(var i=0;i<n;i++){var t=((a-i*step)%360+540)%360-180,c=cards[i];var hide=Math.abs(t)>80;c.style.visibility=hide?'hidden':'';if(hide)continue;c.style.transform='translate(-50%,-50%) translateZ(var(--r)) rotateY('+t.toFixed(2)+'deg) translateZ(calc(var(--r) * -1))';c.firstChild.style.transform='rotateY('+(-bend).toFixed(2)+'deg) skewY('+(bend*.25).toFixed(2)+'deg)'}
if(on&&(vel||down||Math.abs(bend)>.02))raf=requestAnimationFrame(draw)}
function kick(){if(!raf)raf=requestAnimationFrame(draw)}
size();addEventListener('resize',function(){size();kick()});addEventListener('scroll',kick,{passive:true});
new IntersectionObserver(function(es){on=es[0].isIntersecting;if(on)kick()}).observe(gal);
var pin=gal.querySelector('.rt-pin');
pin.addEventListener('pointerdown',function(e){if(!wide.matches||e.button)return;down={x:e.clientX,t:performance.now()};moved=0;vel=0;pin.classList.add('grab')});
addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-down.x;down.x=e.clientX;moved+=Math.abs(dx);drag-=dx*.12;vel=-dx*.12;kick()});
addEventListener('pointerup',function(){if(!down)return;down=null;pin.classList.remove('grab');kick()});
pin.addEventListener('click',function(e){if(moved>6){e.preventDefault();moved=0}},true);
pin.addEventListener('dragstart',function(e){e.preventDefault()});
gal.classList.add('live');kick()})();`;

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
:root{--ease:cubic-bezier(.16,1,.3,1)}
body{--edge:color-mix(in srgb,var(--ink) 13%,transparent)}
h1,h2,h3{font-weight:500;letter-spacing:-.035em}
.btn{font-weight:500}
.btn:hover{transform:none}
.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.rt-n{font-family:var(--font-display);font-size:.85rem;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:0;color:var(--muted)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:500;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.4rem 0;font-size:.92rem;text-decoration:none;color:var(--muted);background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-cta{min-height:2.5rem;padding:.45rem 1.1rem;font-size:.9rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.rt-hero{padding-top:clamp(2rem,1.5rem + 3vw,4.5rem)}
.rt-name{font-size:clamp(2.6rem,var(--fsm),9rem);font-weight:500;line-height:.9;letter-spacing:-.065em;padding-bottom:.06em}
.nl{display:block;white-space:nowrap}
@media (min-width:48rem){.rt-name{font-size:clamp(3.5rem,var(--fs),15rem)}.rt-name.one .nl{display:inline}}
.rt-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
@media (min-width:56rem){.rt-row{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-lead{grid-column:1/7}.rt-side{grid-column:9/13}}
.rt-lead{max-width:36rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.rt-side{display:grid;gap:1.25rem;justify-items:start}
.rt-label{display:grid;margin:0;width:100%;max-width:22rem;padding-top:.75rem;border-top:1px solid var(--ink);font-size:.9rem;line-height:1.5;color:var(--muted)}
.rt-label .lb-1{font-family:var(--font-display);font-size:1rem;font-weight:500;color:var(--ink)}
.rt-gal{padding-block:clamp(2.5rem,2rem + 3vw,5rem)}
.rt-ring{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:1rem;width:min(100% - 2rem,var(--max));margin-inline:auto}
.rt-card.dup{display:none}
.rt-in{display:block;text-decoration:none;color:inherit}
.rt-ph{display:block;overflow:hidden;aspect-ratio:4/5;background:var(--surface);outline:1px solid transparent;outline-offset:6px;transition:outline-color .4s ease}
.rt-ph img{width:100%;height:100%;object-fit:cover;pointer-events:none}
.rt-cap{display:flex;gap:.8rem;align-items:baseline;padding-top:.7rem}
.rt-t{font-family:var(--font-display);font-weight:500;letter-spacing:-.02em}
.rt-in:hover .rt-ph,.rt-in:focus-visible .rt-ph{outline-color:var(--pop)}
.rt-in:hover .rt-n,.rt-in:focus-visible .rt-n{color:var(--pop)}
.rt-hint{display:none;font-size:.85rem;color:var(--muted)}
/* phones with motion: a flat carousel that snaps */
@media (max-width:47.99rem){html.m .rt-ring{display:flex;gap:.8rem;width:auto;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 1rem 1rem;scrollbar-width:none}html.m .rt-ring::-webkit-scrollbar{display:none}html.m .rt-card{flex:none;width:72vw;scroll-snap-align:center}html.m .rt-hint{display:flex;justify-content:space-between;width:min(100% - 2rem,var(--max));margin:.5rem auto 0}}
/* wide screens with motion: the cylinder */
@media (min-width:48rem){
html.m .rt-gal{height:260vh;padding:0}
html.m .rt-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;cursor:grab;touch-action:pan-y;user-select:none}
html.m .rt-pin.grab{cursor:grabbing}
html.m .rt-scene{position:absolute;inset:0;perspective:calc(var(--r,700px) * 1.12);perspective-origin:50% 48%}
html.m .rt-ring{display:block;position:absolute;left:50%;top:48%;width:0;height:0;margin:0;transform-style:preserve-3d}
html.m .rt-card,html.m .rt-card.dup{display:block;position:absolute;left:0;top:0;width:clamp(15rem,22vw,22rem);backface-visibility:hidden;transform-style:preserve-3d}
html.m .rt-gal:not(.live) .rt-card{position:relative}
html.m .rt-in{transform-origin:50% 50%;will-change:transform}
html.m .rt-hint{display:flex;position:absolute;z-index:1;left:0;right:0;bottom:2rem;justify-content:space-between;width:min(100% - 4rem,var(--max));margin-inline:auto;padding-top:.75rem;border-top:1px solid var(--edge)}
}
/* case studies: the first full width, then a large and a small print to a row, swapping sides; captions under them */
.rt-cases{display:grid;gap:clamp(3.5rem,2.5rem + 4vw,6.5rem) 1.5rem;padding-bottom:clamp(4rem,3rem + 4vw,7rem);width:min(100% - 2rem,var(--max));margin-inline:auto}
@media (min-width:48rem){.rt-cases{width:min(100% - 4rem,var(--max));grid-template-columns:repeat(12,minmax(0,1fr))}}
.rt-case{display:grid;gap:.9rem;align-content:start}
.rt-case-media>div{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.rt-case-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
[data-at~="full"] .rt-case-media>div{aspect-ratio:4/3}
.rt-case-copy{display:grid;grid-template-columns:2.25rem 1fr;gap:.2rem .75rem;align-items:baseline;justify-items:start;padding-top:.8rem;border-top:1px solid var(--edge)}
.rt-case-copy>*:not(.rt-n){grid-column:2}
.rt-case-copy .rt-n{grid-row:1}
.rt-case-t{font-size:clamp(1.45rem,1.2rem + 1vw,2.2rem);line-height:1.05}
.rt-case-d{color:var(--muted)}
.rt-case-a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:500;text-decoration:none}
@media (min-width:48rem){
[data-at~="full"]{grid-column:1/13}[data-at~="full"] .rt-case-media>div{aspect-ratio:21/10}[data-at~="full"] .rt-case-copy{grid-template-columns:2.25rem minmax(0,24rem) 1fr}[data-at~="full"] .rt-case-d{grid-column:3;grid-row:1}
.rt-case[data-at="l a"]{grid-column:1/8}.rt-case[data-at="s b"]{grid-column:9/13;margin-top:clamp(4rem,10vw,10rem)}
.rt-case[data-at="s a"]{grid-column:2/6;margin-top:clamp(4rem,10vw,10rem)}.rt-case[data-at="l b"]{grid-column:7/13}
[data-at~="l"] .rt-case-media>div{aspect-ratio:5/4}
[data-at~="solo"]{grid-column:4/11}[data-at~="solo"] .rt-case-media>div{aspect-ratio:3/2}
}
.rt-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.rt-cl{max-width:64rem;font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.4vw,3.6rem);font-weight:500;line-height:1.08;letter-spacing:-.045em;color:var(--muted);text-wrap:balance}
.rt-cl span{color:var(--ink)}
.rt-svc-grid,.rt-about-grid,.rt-contact-grid,.rt-faq{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.rt-svc-grid,.rt-faq{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.rt-svc-grid>div:first-child,.rt-faq>.rt-h2{grid-column:1/6}.rt-svc-grid>div:last-child,.rt-faq>div{grid-column:7/13}.rt-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.rt-about-media{grid-column:1/6}.rt-about-copy{grid-column:7/12}.rt-contact-grid{grid-template-columns:1fr 1fr;align-items:start}}
.rt-svc{border-top:1px solid var(--ink)}
.rt-svc li{display:grid;grid-template-columns:2.5rem 1fr auto;gap:.3rem 1.5rem;align-items:baseline;padding:1.3rem 0;border-bottom:1px solid var(--edge)}
.rt-svc h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem)}
.rt-svc p{grid-column:2;color:var(--muted)}
.rt-svc strong{grid-column:3;grid-row:1;font-family:var(--font-display);font-size:1.3rem;font-weight:500;font-variant-numeric:tabular-nums}
.rt-incl{margin-top:2.5rem}
.rt-incl h3{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:0}
.rt-incl ul{margin-top:.75rem;border-top:1px solid var(--edge)}
.rt-incl li{padding:.6rem 0;border-bottom:1px solid var(--edge)}
.rt-about-media{margin:0}
.rt-about-media>div{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.rt-about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.rt-h2{font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);line-height:.98;letter-spacing:-.05em}
.rt-h2.big{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem)}
.rt-p{margin-top:1.1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.rt-p.first{font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.7rem);line-height:1.3;letter-spacing:-.025em;color:var(--ink)}
.rt-soc{margin-top:1.5rem}
.socials a{border-width:1px;border-radius:0}
.rt-road{--rm-accent:var(--pop);border-top:1px solid var(--edge)}
.rt-road .h2{font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);font-weight:500;line-height:.98;letter-spacing:-.05em}
.rt-road .rm-dot{border-width:1px;font-weight:500}
.rt-road .rm-txt h3{font-weight:500;letter-spacing:-.03em}
.rt-quotes{display:grid;border-top:1px solid var(--ink)}
.rt-q{display:grid;gap:.75rem;padding-block:clamp(1.5rem,1rem + 2vw,2.75rem);border-bottom:1px solid var(--edge)}
.rt-q blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);line-height:1.12;letter-spacing:-.035em}
.rt-q figcaption{color:var(--muted)}
.rt-contact{background:var(--dark);color:var(--on-dark);border-top:0;--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--edge:var(--line-on-dark);--bg:var(--dark);--primary-text:var(--primary-on-dark);--focus:var(--primary-on-dark);--pop:var(--primary-on-dark)}
.rt-contact .btn-primary{background:var(--on-dark);color:var(--dark)}
.rt-book{margin-top:2rem}
.rt-contact .contact-list{margin-top:2rem}
.rt-contact .contact-list .i{color:var(--on-dark)}
.field input,.field select,.field textarea{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 45%,transparent);border-radius:0;background-color:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1px 0 var(--ink)}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.2rem 0;font-weight:500}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.2rem}
.mbar{box-shadow:none}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Rotunda',
  bestFor: 'Architects, interior and product photographers, illustrators and studios with a body of work to walk through',
  match: /\b(architects?|architecture|architectural|interiors?|interior design(er)?|illustrat(or|ors|ion)|3d artists?|motion design(er)?|art direct(or|ion)|set design(er)?)\b/,
  why: 'Built to walk through your work: the page develops like a print, then your pieces stand on a curved wall around the viewer that turns as you scroll or drag, each one opening its case study below, with your process drawn in as a route to the project form.',
  fonts: { q: 'family=Fraunces:opsz,wght@9..144,400..600&family=Hanken+Grotesk:wght@400;500;600;700', display: ['Hanken Grotesk', 'grotesk'], body: ['Hanken Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): a print developing, a wall of work that leans your way, the process as a route.
  choreo: { intro: 'develop', alive: ['pointer', 'drift'], scroll: 'roadmap', pace: 'medium', look: 'gallery plaster in daylight, quiet, precise' },
  tokens,
  slots,
  nav,
  render,
};
