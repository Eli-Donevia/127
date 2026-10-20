// Rotunda (animated, portfolio): the work on the inside of a curved wall. On a gallery-white page the member's pieces
// stand on a cylinder around the viewer (CSS 3D, no library): scrolling or dragging turns it with inertia, the cards
// bend a little with the speed and lift when hovered, and each card links to its case study below, where the photo runs
// full width and the title rises in line by line. Phones get a flat carousel that snaps card by card; reduced motion
// and no script get a plain grid. Then services, about, how it works and the project form on black.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { head, cheapest, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'rotunda';
const STYLES = ['portrait', 'sweep', 'arch', 'mesh', 'object', 'plates', 'grid', 'tile'];

function tokens(p) {
  return { bg: color.mix(p.paper, '#f4f3ef', 0.88), dark: color.mix(color.mix(p.ink, p.primary, 0.08), '#0d0d0d', 0.8) };
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

  const meta = [c.online ? '' : c.city || c.area, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);
  const hero = `<section class="rt-hero" aria-labelledby="hero-title">
<div class="wrap rt-intro">
<p class="rt-label" data-rv>${esc(c.whatShort || c.heroTitle)}</p>
<h1 class="rt-name" id="hero-title" data-split>${esc(c.name)}</h1>
<div class="rt-row">
<p class="rt-lead" data-rv style="--d:4">${esc(c.heroSub)}</p>
<div class="rt-ctas" data-rv style="--d:5">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}${meta.length ? `<ul class="rt-meta">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}</div>
</div>
</div>
</section>
<section class="rt-gal" id="work" aria-labelledby="work-title">
<h2 class="sr-only" id="work-title">Selected work</h2>
<div class="rt-pin">
<div class="rt-scene"><ul class="rt-ring">${cards.join('')}</ul></div>
<p class="rt-hint" aria-hidden="true"><span>Drag or scroll</span><span class="rt-count">(${num(n - 1)})</span></p>
</div>
</section>`;

  const cases = work.length
    ? `<section class="rt-cases" aria-label="Case studies">${work
        .map(
          (p, i) => `<article class="rt-case" id="case-${i + 1}" aria-labelledby="case-${i + 1}-t">
<div class="rt-case-media" data-rv="mask"><div>${P.img(c, `w${i + 1}`, { cls: 'rt-case-img' }).replace(/alt="[^"]*"/, 'alt=""').replace('<img ', '<img data-par="0.06" ')}</div></div>
<div class="wrap rt-case-copy"><span class="rt-n" data-rv>${num(i)}</span><h3 class="rt-case-t" id="case-${i + 1}-t" data-split>${esc(p.title)}</h3>${p.detail ? `<p class="rt-case-d" data-rv style="--d:3">${esc(p.detail)}</p>` : ''}${p.href ? `<a class="rt-case-a" data-rv style="--d:4" href="${esc(p.href)}">${esc(p.linkLabel || 'See it')}${icon('arrowUpRight', { size: 16 })}</a>` : ''}</div>
</article>`
        )
        .join('\n')}</section>`
    : '';

  const clients = c.clients && c.clients.length
    ? `<section class="rt-sec rt-clients" aria-label="Made for"><div class="wrap"><p class="rt-label" data-rv>Made for</p><ul class="rt-cl" data-rv style="--d:1">${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`
    : '';

  const services = c.services.length || c.included.length
    ? `<section class="rt-sec" id="services" aria-labelledby="services-title"><div class="wrap">
<div data-rv>${head({ eyebrow: 'Services', title: c.services.length ? 'Ways to work together' : "What's included", id: 'services-title', lead: c.services.some((s) => s.priceText) ? 'Prices are a starting point. Every project gets a written quote before anything is booked.' : '' })}</div>
${c.services.length ? `<ul class="rt-svc">${c.services.map((s, i) => `<li data-rv style="--d:${i % 4}"><span class="rt-n">${num(i)}</span><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : '<p></p>'}${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="rt-incl" data-rv><p class="rt-label">${c.services.length ? 'Every project includes' : 'With every project'}</p><ul>${c.included.map((x) => `<li>${icon('check', { size: 18 })}<span>${esc(x)}</span></li>`).join('')}</ul></div>` : ''}
</div></section>`
    : '';

  const about = `<section class="rt-sec rt-about" id="about" aria-labelledby="about-title"><div class="wrap rt-about-grid">
<div class="rt-about-media" data-rv="mask"><div>${P.img(c, 'portrait', { cls: 'rt-about-img' }).replace('<img ', '<img data-par="0.05" ')}</div></div>
<div><p class="rt-label" data-rv>About</p><h2 class="rt-h2" id="about-title" data-split>${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p class="rt-p" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c, { cls: 'rt-soc' })}</div></div>
</div></section>`;

  const how = c.steps.length
    ? `<section class="rt-sec" aria-labelledby="how-title"><div class="wrap"><div data-rv>${head({ eyebrow: 'How it works', title: 'From first message to final files', id: 'how-title' })}</div>
<ol class="rt-steps">${c.steps.map((s, i) => `<li data-rv style="--d:${i}"><span class="rt-n">${num(i)}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol></div></section>`
    : '';

  const reviews = c.reviews.length ? `<section class="rt-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="rt-label" data-rv>Kind words</p><h2 class="sr-only" id="reviews-title">Kind words</h2><div data-rv>${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="rt-sec" id="faq" aria-labelledby="faq-title"><div class="wrap rt-faq"><div data-rv>${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}</div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const types = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const fields = ['name', 'email', { ...P.FIELD_PRESETS.company, label: 'Business or brand' }, types || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' }, types ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null, { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true }].filter(Boolean);
  const contact = `<section class="rt-sec rt-contact" id="contact" aria-labelledby="contact-title"><div class="wrap rt-contact-grid">
<div><p class="rt-label" data-rv>Contact</p><h2 class="rt-h2 big" id="contact-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="rt-p" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="rt-p" data-rv style="--d:4">${icon('shield', { size: 20 })} ${esc(c.promise)}</p>` : ''}
${c.booking ? `<div data-rv style="--d:5">${mag(P.button(c.primary, 'btn btn-primary btn-lg', 'calendar'))}</div>` : ''}
<div data-rv style="--d:5">${P.contactList(c)}</div></div>
<div class="rt-form" data-rv="scale" style="--d:2">${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}</div>
</div></section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'rt-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, cases, clients, services, about, how, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '10px', radiusSm: '6px', btnRadius: '999px', max: '86rem' } };
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
${FOOTER_CSS}${HEAD_CSS}${REVIEWS_CSS}
body{--edge:color-mix(in srgb,var(--ink) 12%,transparent)}
h1,h2,h3{font-weight:600;letter-spacing:-.035em}
.rt-label,.rt-n,.rt-meta,.rt-hint{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.75rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:400;letter-spacing:.08em;color:var(--muted)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:600;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.9rem;text-decoration:none;color:var(--muted)}
.nav a:hover{color:var(--ink)}
.hdr-cta{min-height:2.5rem;padding:.45rem 1.1rem;font-size:.9rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.rt-hero{padding-top:clamp(2.5rem,1.5rem + 4vw,5rem)}
.rt-name{margin-top:.8rem;font-size:clamp(3.2rem,1rem + 9vw,9.5rem);line-height:.9;letter-spacing:-.06em}
.rt-row{display:grid;gap:1.5rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
@media (min-width:56rem){.rt-row{grid-template-columns:1fr auto;align-items:end;gap:4rem}}
.rt-lead{max-width:36rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.rt-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.6rem}
.rt-meta{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem}
/* the gallery: a plain grid by default */
.rt-gal{padding-block:clamp(2.5rem,2rem + 3vw,5rem)}
.rt-ring{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:1rem;width:min(100% - 2rem,var(--max));margin-inline:auto}
.rt-card.dup{display:none}
.rt-in{display:block;text-decoration:none;color:inherit}
.rt-ph{display:block;overflow:hidden;border-radius:var(--radius);aspect-ratio:4/5;background:var(--surface);transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s ease,filter .5s ease}
.rt-ph img{width:100%;height:100%;object-fit:cover;pointer-events:none}
.rt-cap{display:flex;gap:.8rem;align-items:baseline;padding-top:.7rem}
.rt-t{font-family:var(--font-display);font-weight:500;letter-spacing:-.02em}
.rt-in:hover .rt-ph,.rt-in:focus-visible .rt-ph{transform:translateY(-10px) scale(1.03);filter:brightness(1.07) saturate(1.05);box-shadow:0 30px 50px -28px color-mix(in srgb,var(--ink) 55%,transparent)}
.rt-hint{display:none}
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
html.m .rt-hint{display:flex;position:absolute;z-index:1;left:0;right:0;bottom:2rem;justify-content:space-between;width:min(100% - 4rem,var(--max));margin-inline:auto}
html.m .rt-pin::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,var(--bg),transparent 14%,transparent 86%,var(--bg))}
}
/* case studies */
.rt-case{padding-bottom:clamp(3rem,2rem + 3vw,5rem)}
.rt-case-media>div{overflow:hidden;height:min(86vh,52rem);min-height:22rem}
@media (max-width:47.99rem){.rt-case-media>div{height:62vh;min-height:18rem}}
.rt-case-img{width:100%;height:116%;margin-top:-8%;object-fit:cover}
.rt-case-copy{display:grid;gap:.6rem;padding-top:1.4rem}
@media (min-width:56rem){.rt-case-copy{grid-template-columns:5rem 1fr auto;align-items:baseline;gap:2rem}}
.rt-case-t{font-size:clamp(2rem,1.3rem + 3vw,4.5rem);line-height:1}
.rt-case-d{color:var(--muted)}
.rt-case-a{display:inline-flex;align-items:center;gap:.35rem;font-weight:600;text-decoration:none}
.rt-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.rt-cl{display:flex;flex-wrap:wrap;gap:.5rem 2.5rem;margin-top:1.2rem;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.6vw,2.6rem);font-weight:500;letter-spacing:-.03em}
.rt-svc{border-top:1px solid var(--edge)}
.rt-svc li{display:grid;grid-template-columns:3rem 1fr auto;gap:.3rem 1.5rem;align-items:baseline;padding:1.4rem 0;border-bottom:1px solid var(--edge)}
.rt-svc h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem)}
.rt-svc p{grid-column:2;color:var(--muted)}
.rt-svc strong{grid-column:3;grid-row:1;font-family:var(--font-display);font-size:1.2rem;font-weight:500}
.rt-incl{margin-top:2.5rem}
.rt-incl ul{display:grid;gap:.6rem;margin-top:1rem}
@media (min-width:48rem){.rt-incl ul{grid-template-columns:repeat(3,1fr)}}
.rt-incl li{display:flex;gap:.6rem}
.rt-incl .i{margin-top:.25rem;color:var(--primary-text)}
.rt-about-grid,.rt-contact-grid,.rt-faq{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.rt-about-grid{grid-template-columns:.8fr 1.2fr;align-items:center}.rt-contact-grid{grid-template-columns:1fr 1fr;align-items:start}.rt-faq{grid-template-columns:.8fr 1.2fr}}
.rt-about-media>div{overflow:hidden;border-radius:var(--radius);aspect-ratio:4/5}
.rt-about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.rt-h2{margin-top:.6rem;font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);line-height:.98}
.rt-h2.big{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem)}
.rt-p{margin-top:1.1rem;max-width:36rem;font-size:1.12rem;line-height:1.6}
.rt-soc{margin-top:1.5rem}
.rt-steps{display:grid;gap:1.5rem}
@media (min-width:56rem){.rt-steps{grid-template-columns:repeat(4,1fr)}}
.rt-steps li{display:grid;gap:.6rem;padding-top:1.2rem;border-top:1px solid var(--ink)}
.rt-steps h3{font-size:1.25rem}
.rt-steps p{color:var(--muted)}
.rt-contact{background:var(--dark);color:var(--on-dark);border-top:0;--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--bg:var(--dark);--primary-text:var(--primary-on-dark);--focus:var(--primary-on-dark)}
.rt-contact .contact-list{margin-top:2rem}
.rt-form{padding:clamp(1.25rem,1rem + 1.5vw,2.25rem);border-radius:var(--radius);background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));border:1px solid var(--line-on-dark)}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.2rem 0}
.faq .ans{padding:0 0 1.2rem}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Rotunda',
  bestFor: 'Architects, interior and product photographers, illustrators and studios with a body of work to walk through',
  match: /\b(architects?|architecture|architectural|interiors?|interior design(er)?|illustrat(or|ors|ion)|3d artists?|motion design(er)?|art direct(or|ion)|set design(er)?)\b/,
  why: 'Built to walk through your work: your pieces stand on a curved wall around the viewer that turns as you scroll or drag, each one opening its case study below, with a project form on black.',
  fonts: { q: 'family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500', display: ['Space Grotesk', 'grotesk'], body: ['Inter', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
