// Frame (animated, portfolio): for photographers, editors and designers, the work first. A gallery-white page where the
// name fills the width and rises in letter by letter (and drifts apart as you scroll), a staggered grid where every
// piece wipes in, an index of project titles with a preview that follows the cursor (desktop only), services rows
// that fill on hover, clients running across the page, and the hire form on black.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { head, cheapest, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'frame';

// Desktop places for the grid on 12 columns, in a loop: wide, tall and offset, so it reads like a wall of prints.
const PLACES = [
  { col: '1 / span 7', a: 'l' },
  { col: '9 / span 4', a: 'p', down: 1 },
  { col: '2 / span 4', a: 'p' },
  { col: '7 / span 6', a: 'l', down: 1 },
  { col: '1 / span 6', a: 'l' },
  { col: '8 / span 4', a: 'p', down: 1 },
];
const STYLES = ['sweep', 'portrait', 'arch', 'mesh', 'object', 'plates', 'grid', 'tile', 'sweep'];

function tokens(p) {
  return { bg: color.mix(p.paper, '#f1efea', 0.85), dark: color.mix(color.mix(p.ink, p.primary, 0.12), '#0a0a0a', 0.72) };
}

function frameCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(9, Math.max(3, n)) : 6;
}

// Where piece i sits; an odd last piece gets a wide, centered place of its own.
function place(i, n) {
  if (n % 2 === 1 && i === n - 1) return { col: '3 / span 8', a: 'l', solo: 1 };
  return PLACES[i % PLACES.length];
}

function slots(c) {
  const g = c.profile.gallery || [];
  const n = frameCount(c);
  const out = [];
  for (let i = 0; i < n; i++) {
    const piece = (c.work || [])[i];
    const [w, h] = place(i, n).a === 'l' ? [1600, 1000] : [1000, 1250];
    const alt = piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work`;
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w, h, style: STYLES[i % STYLES.length], alt });
  }
  out.push({ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'at work'}` : c.profile.hero || `${c.name} at work` });
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

// The name as letters for the kinetic hero: each letter rises in on load and drifts at its own pace on scroll.
// --n is the desktop line's width in em (Anton's letters), --m the longest word's, for phones (one word per line there).
const EM = { I: 0.25, J: 0.38, E: 0.42, F: 0.42, L: 0.42, T: 0.42, O: 0.52, Q: 0.52, M: 0.66, W: 0.66, ' ': 0.2, '&': 0.55 };
function kineticName(c) {
  const name = String(c.name || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  const ems = (w) => Array.from(w.toUpperCase()).reduce((t, ch) => t + (EM[ch] || (/[\p{L}\p{N}]/u.test(ch) ? 0.5 : 0.3)), 0);
  const total = ems(name);
  const longest = Math.max(...words.map(ems));
  const n = (name.length <= 18 ? total : Math.max(longest, total / 2 + 0.4)) * 1.03;
  const m = Math.max(longest, 2.6) * 1.03;
  let k = 0;
  const html = words
    .map((w) => `<span class="nw">${Array.from(w).map((ch) => `<span class="ch" style="--i:${k};--k:${[0.06, 0.2, 0.12, 0.28, 0.04, 0.16][k++ % 6]}"><span>${esc(ch)}</span></span>`).join('')}</span>`)
    .join(' ');
  return `<h1 class="name" id="hero-title" style="--n:${n.toFixed(2)};--m:${m.toFixed(2)}"><span class="sr-only">${esc(name)}${c.whatShort ? `, ${esc(c.whatShort)}` : ''}</span><span class="name-in" aria-hidden="true">${html}</span></h1>`;
}

function detailOf(s) {
  const blurb = String(s.blurb || '');
  if (!s.duration) return blurb;
  if (!blurb) return s.duration;
  return `${s.duration}, ${/^[A-Z][a-z]/.test(blurb) && !/^I\b/.test(blurb) ? blurb.charAt(0).toLowerCase() + blurb.slice(1) : blurb}`;
}

const num = (i) => String(i + 1).padStart(2, '0');

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const n = frameCount(c);
  const work = c.work || [];
  const meta = [c.online ? '' : c.city || c.area, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);
  const mag = (html) => html.replace('<a ', '<a data-mag ');

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="hero-name" data-par="-0.04">${kineticName(c)}</div>
<div class="wrap hero-row">
<div class="hero-left">
<p class="role" data-rv style="--d:6"><span class="dot" aria-hidden="true"></span>${esc(c.heroTitle)}</p>
${meta.length ? `<ul class="meta" data-rv style="--d:9">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
<div class="hero-copy">
<p class="lead" data-rv style="--d:7">${esc(c.heroSub)}</p>
<div class="ctas" data-rv style="--d:8">${mag(P.button(c.primary, 'btn btn-primary btn-lg', c.booking ? 'calendar' : ''))}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg') : ''}</div>
</div>
</div>
</section>`;

  const pieces = [];
  for (let i = 0; i < n; i++) {
    const pl = place(i, n);
    const piece = work[i];
    const cap = piece
      ? `<figcaption><span class="w-n">${num(i)}</span><span class="w-t">${esc(piece.title)}</span>${piece.detail ? `<span class="w-d">${esc(piece.detail)}</span>` : ''}${piece.href ? `<a class="w-link" href="${esc(piece.href)}">${esc(piece.linkLabel || 'See it')}${icon('arrowUpRight', { size: 16 })}</a>` : ''}</figcaption>`
      : '';
    pieces.push(`<figure class="w ${pl.a}${pl.down ? ' down' : ''}${pl.solo ? ' solo' : ''}" id="w-${i + 1}" style="--col:${pl.col}">
<div class="shot" data-rv="mask"><div class="shot-in">${P.img(c, `w${i + 1}`, { eager: i < 2 }).replace('<img ', '<img data-par="0.05" ')}</div></div>
${cap}
</figure>`);
  }
  const more = c.socials.instagram ? ['instagram', 'Instagram'] : c.socials.tiktok ? ['tiktok', 'TikTok'] : c.socials.youtube ? ['youtube', 'YouTube'] : null;
  const workSec = `<section class="sec work-sec" id="work" aria-labelledby="work-title">
<div class="wrap">
<div class="work-head">
<h2 class="big" id="work-title" data-split>Selected work</h2>
<p class="count" data-rv style="--d:2">(${num(n - 1)})</p>
${more ? `<a class="more" data-rv style="--d:3" href="${esc(c.socials[more[0]])}">${icon(more[0], { size: 18 })}More on ${more[1]}${icon('arrowUpRight', { size: 16 })}</a>` : ''}
</div>
<div class="grid">
${pieces.join('\n')}
</div>
</div>
</section>`;

  // The index: every titled piece as a row; on desktop a preview of its photo follows the cursor.
  const titled = work.slice(0, n);
  const index = titled.length >= 2
    ? `<section class="sec idx-sec" aria-labelledby="idx-title">
<div class="wrap">
<div class="idx-head"><p class="eyebrow" data-rv>Index</p><h2 class="h2" id="idx-title" data-split>Every project</h2></div>
<ol class="idx">
${titled
  .map((p, i) => {
    const inner = `<span class="idx-n">${num(i)}</span><span class="idx-t">${esc(p.title)}</span><span class="idx-d">${esc(p.detail || '')}</span><span class="idx-go">${p.href ? `${esc(p.linkLabel || 'See it')}${icon('arrowUpRight', { size: 18 })}` : icon('arrow', { size: 18 })}</span>`;
    return `<li data-rv style="--d:${i % 4}">${p.href ? `<a class="idx-row" data-for="w-${i + 1}" href="${esc(p.href)}">${inner}</a>` : `<a class="idx-row" data-for="w-${i + 1}" href="#w-${i + 1}">${inner}</a>`}</li>`;
  })
  .join('\n')}
</ol>
</div>
<div class="fx" aria-hidden="true"><div class="fx-in"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1000" height="1250"></div></div>
</section>`
    : '';

  const clientRow = (hidden) => `<ul class="cl-row"${hidden ? ' aria-hidden="true"' : ''}>${c.clients.map((x) => `<li>${esc(x)}<span class="cl-star" aria-hidden="true">${icon('star4', { size: 22 })}</span></li>`).join('')}</ul>`;
  const clients = c.clients && c.clients.length
    ? `<section class="clients" aria-label="Made for"><div class="wrap"><p class="eyebrow">Made for</p></div>${c.clients.length > 2 ? `<div class="mq"><div class="mq-track">${clientRow(false)}${clientRow(true)}</div></div>` : `<div class="wrap">${clientRow(false)}</div>`}</section>`
    : '';

  const services = c.services.length || c.included.length
    ? `<section class="sec svc-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
<div class="svc-head">
<h2 class="big" id="services-title" data-split>${c.services.length ? 'Services' : "What's included"}</h2>
${c.services.some((s) => s.priceText) ? '<p class="lead" data-rv style="--d:2">Prices are a starting point. Every project gets a written quote before anything is booked.</p>' : ''}
</div>
${c.services.length ? `<ul class="svc">${c.services.map((s, i) => `<li data-rv style="--d:${i % 4}"><span class="svc-n">${num(i)}</span><div class="svc-body"><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc(detailOf(s))}</p>` : ''}</div>${s.priceText ? `<span class="svc-price">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="incl-box" data-rv><h3>${c.services.length ? 'Every project includes' : 'With every project'}</h3><ul class="incl">${c.included.map((x) => `<li>${icon('check', { size: 18 })}<span>${esc(x)}</span></li>`).join('')}</ul></div>` : ''}
${mag(P.button(c.primary, 'btn btn-primary btn-lg svc-cta'))}
</div>
</section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media" data-rv="mask"><div class="shot-in">${P.img(c, 'portrait', { cls: 'about-img' }).replace('<img ', '<img data-par="0.06" ')}</div></div>
<div class="about-copy">
<p class="eyebrow" data-rv>About</p>
<h2 class="big" id="about-title" data-split>${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c)}</div>
</div>
</div>
</section>`;

  const how = c.steps.length
    ? `<section class="sec how" aria-labelledby="how-title"><div class="wrap">
<div data-rv>${head({ eyebrow: 'How it works', title: 'From first message to final files', id: 'how-title' })}</div>
<ol class="steps" data-rv style="--n:${Math.min(4, c.steps.length)}">${c.steps.map((s, i) => `<li style="--d:${i + 1}"><span class="st-n">${num(i)}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="sec rv-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="eyebrow" data-rv>Kind words</p><h2 class="sr-only" id="reviews-title">Kind words</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div data-rv>${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}</div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const projectTypes = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Business or brand' },
    projectTypes || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' },
    projectTypes ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null,
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true },
  ].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-copy">
<p class="eyebrow" data-rv>Contact</p>
<h2 class="big" id="contact-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="promise" data-rv style="--d:4">${icon('shield', { size: 20 })}<span><strong>My promise:</strong> ${esc(c.promise)}</span></p>` : ''}
${c.booking ? `<div class="ctas" data-rv style="--d:5">${mag(P.button(c.primary, 'btn btn-primary btn-lg', 'calendar'))}</div>` : ''}
<div data-rv style="--d:5">${P.contactList(c, { cls: 'on-dark' })}</div>
</div>
<div class="form-card" data-rv="scale" style="--d:2">
<h3 class="form-title">Start a project</h3>
${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [
    '<div class="prog" aria-hidden="true"></div>',
    P.header(c, { cls: 'hdr-fr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'),
    '<main id="main">',
    hero,
    workSec,
    index,
    clients,
    services,
    about,
    how,
    reviews,
    faq,
    contact,
    '</main>',
    P.footer(c),
    P.mobileBar(c),
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '999px', max: '88rem' } };
}

// The name drifts apart on scroll; the index preview follows the cursor. Off for reduced motion and touch.
const JS = `(function(){
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var d=document,nm=d.querySelector('.name'),t=false;
if(nm)addEventListener('scroll',function(){if(t)return;t=true;requestAnimationFrame(function(){t=false;nm.style.setProperty('--s',Math.min(scrollY,900).toFixed(0))})},{passive:true});
var fx=d.querySelector('.fx'),list=d.querySelector('.idx');
if(!fx||!list||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
var im=fx.querySelector('img'),x=0,y=0,tx=0,ty=0,raf=0;
function loop(){x+=(tx-x)*.14;y+=(ty-y)*.14;fx.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) rotate('+Math.max(-8,Math.min(8,(tx-x)*.04)).toFixed(2)+'deg)';raf=Math.abs(tx-x)+Math.abs(ty-y)>.4?requestAnimationFrame(loop):0}
list.querySelectorAll('.idx-row').forEach(function(r){r.addEventListener('pointerenter',function(e){var s=d.querySelector('#'+r.getAttribute('data-for')+' img');if(s)im.src=s.currentSrc||s.src;if(!fx.classList.contains('on')){x=tx=e.clientX;y=ty=e.clientY}fx.classList.add('on');list.classList.add('hov')})});
list.addEventListener('pointerleave',function(){fx.classList.remove('on');list.classList.remove('hov')});
list.addEventListener('pointermove',function(e){tx=e.clientX;ty=e.clientY;if(!raf)raf=requestAnimationFrame(loop)});
})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
.mono,.eyebrow,.role,.meta,.count,.w-n,.w-d,.idx-n,.idx-d,.idx-go,.svc-n,.st-n,.more,.w-link{font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.eyebrow{font-size:.75rem;font-weight:500;letter-spacing:.12em;color:var(--muted)}
.eyebrow::before{content:'';display:inline-block;width:.5rem;height:.5rem;margin-right:.6rem;border-radius:50%;background:var(--primary);vertical-align:.05em}
h1,h2,.big{font-family:var(--font-display);font-weight:400;text-transform:uppercase;letter-spacing:0;line-height:.9}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em;line-height:1.25}
.h2{font-size:clamp(2.4rem,1.6rem + 3vw,4.4rem)}
.big{font-size:clamp(3.2rem,1.6rem + 6.4vw,8.5rem);line-height:.86}
.btn{font-weight:500;letter-spacing:-.005em}
.btn-line{background:transparent;color:var(--ink);border-color:var(--ink)}
.btn-line:hover{background:var(--ink);color:var(--bg)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.35rem;text-transform:uppercase;letter-spacing:.01em;text-decoration:none}
.nav ul{display:flex;gap:.1rem}
.nav a{position:relative;display:block;padding:.5rem .8rem;font-size:.92rem;font-weight:500;text-decoration:none;color:var(--muted);transition:color .2s ease}
.nav a::after{content:'';position:absolute;left:.8rem;right:.8rem;bottom:.3rem;height:1px;background:currentColor;transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.7,0,.2,1)}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.2rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;padding-top:clamp(1.5rem,1rem + 2vw,3rem);padding-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.hero-name{padding-inline:clamp(.75rem,.4rem + 1.2vw,2rem)}
.name{margin:0;font-size:min(calc((100vw - 1.6rem) / var(--m)),11rem);line-height:.94;text-wrap:balance}
@media (min-width:48rem){.name{font-size:min(calc((100vw - 4rem) / var(--n)),19rem)}}
.name-in{display:block}
.nw{display:inline-block;white-space:nowrap}
@media (max-width:47.99rem){.nw{display:block}}
.ch{display:inline-block;overflow:hidden;padding-top:.06em;margin-top:-.06em;transform:translate3d(0,calc(var(--s,0) * var(--k) * -1px),0);will-change:transform}
.ch>span{display:inline-block}
html.m .ch>span{animation:frRise 1.25s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i) * 45ms + .15s)}
@keyframes frRise{from{transform:translateY(105%) rotate(6deg)}}
.hero-row{display:grid;gap:1.5rem 3rem;margin-top:clamp(1.5rem,1rem + 2.5vw,3.5rem);padding-top:1.25rem;border-top:1px solid var(--ink)}
@media (min-width:60rem){.hero-row{grid-template-columns:1fr 1.15fr;align-items:start}}
.role{display:flex;align-items:baseline;gap:.7rem;font-size:clamp(.95rem,.85rem + .3vw,1.1rem);font-weight:500;text-transform:uppercase;letter-spacing:.04em}
.role .dot{flex:none;width:.6rem;height:.6rem;border-radius:50%;background:var(--primary);box-shadow:0 0 0 0 var(--primary);animation:frPing 2.6s ease-out infinite}
@keyframes frPing{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--primary) 55%,transparent)}80%,100%{box-shadow:0 0 0 .7rem transparent}}
.hero-copy{display:grid;gap:1.5rem}
.hero .lead{max-width:38rem;color:var(--ink);font-size:clamp(1.15rem,1rem + .5vw,1.45rem);line-height:1.45}
.ctas{display:flex;flex-wrap:wrap;gap:.7rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}
.meta li{padding:.35rem .75rem;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.hero-left{display:grid;gap:1.25rem;align-content:space-between}
.work-sec{padding-top:clamp(.5rem,.25rem + 1vw,1.5rem)}
.work-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:.5rem 1.25rem;margin-bottom:clamp(1.75rem,1.25rem + 2vw,3.5rem)}
.count{align-self:flex-start;font-size:.9rem;color:var(--muted)}
.more{display:inline-flex;align-items:center;gap:.45rem;margin-left:auto;padding-bottom:.6rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;text-decoration:none}
.more:hover{text-decoration:underline}
.grid{display:grid;gap:3rem}
@media (min-width:56rem){.grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:5rem 1.5rem;align-items:start}.w{grid-column:var(--col)}.w.down{margin-top:clamp(4rem,8vw,9rem)}}
@media (max-width:55.99rem){.w.p{width:78%}.w.p:nth-child(4n+2){margin-left:auto}}
.w{margin:0;display:grid;gap:.85rem;min-width:0;scroll-margin-top:6rem}
.shot{overflow:hidden;border-radius:var(--radius);background:var(--surface)}
.w.l .shot{aspect-ratio:16/10}
.w.p .shot{aspect-ratio:4/5}
.shot-in{height:100%;transition:transform 1.2s cubic-bezier(.16,1,.3,1)}
.shot img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.w:hover .shot-in{transform:scale(1.035)}
.w figcaption{display:grid;grid-template-columns:auto 1fr;gap:.15rem 1rem;align-items:baseline}
.w-n{grid-row:span 3;font-size:.8rem;color:var(--primary-text)}
.w-t{font-size:1.1rem;font-weight:600;letter-spacing:-.01em}
.w-d{font-size:.82rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.w-link{display:inline-flex;align-items:center;gap:.3rem;margin-top:.3rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink)}
.w-link .i{transition:transform .3s ease}
.w-link:hover .i{transform:translate(2px,-2px)}
.idx-sec{position:relative;padding-top:clamp(2rem,1rem + 3vw,4rem)}
.idx-head{display:grid;gap:.75rem;margin-bottom:2rem}
.idx{border-top:1px solid var(--ink)}
.idx-row{position:relative;display:grid;grid-template-columns:2.5rem 1fr auto;gap:.25rem 1rem;align-items:center;min-height:4.5rem;padding:1.1rem 0;border-bottom:1px solid var(--line);text-decoration:none;isolation:isolate;transition:opacity .4s ease}
.idx-row::before{content:'';position:absolute;inset:0 -1rem;z-index:-1;background:var(--primary-soft);transform:scaleY(0);transform-origin:50% 100%;transition:transform .5s cubic-bezier(.7,0,.2,1)}
.idx-row:hover::before,.idx-row:focus-visible::before{transform:scaleY(1);transform-origin:50% 0}
.idx-n{font-size:.8rem;color:var(--primary-text)}
.idx-t{font-family:var(--font-display);font-size:clamp(1.9rem,1.2rem + 3.2vw,4.6rem);line-height:.95;text-transform:uppercase;transition:transform .6s cubic-bezier(.16,1,.3,1)}
.idx-d{grid-column:2;font-size:.82rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.idx-go{grid-row:1 / span 2;grid-column:3;display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}
@media (max-width:47.99rem){.idx-go{font-size:0;gap:0}.idx-go .i{width:22px;height:22px}}
@media (min-width:60rem){.idx-row{grid-template-columns:4rem minmax(0,1.25fr) minmax(0,1fr) 13rem}.idx-d{grid-column:3;text-align:left}.idx-go{grid-column:4;grid-row:1;justify-self:end}}
.idx-row:hover .idx-t{transform:translateX(.75rem)}
.idx.hov .idx-row:not(:hover){opacity:.38}
.fx{position:fixed;left:0;top:0;z-index:40;width:clamp(14rem,20vw,21rem);pointer-events:none;will-change:transform}
.fx-in{aspect-ratio:4/5;overflow:hidden;border-radius:var(--radius);transform:translate(-50%,-50%) scale(.6);opacity:0;clip-path:inset(30% 30% 30% 30%);transition:opacity .35s ease,transform .6s cubic-bezier(.16,1,.3,1),clip-path .6s cubic-bezier(.16,1,.3,1);box-shadow:0 40px 80px -30px rgba(0,0,0,.45)}
.fx.on .fx-in{opacity:1;transform:translate(-50%,-50%) scale(1);clip-path:inset(0)}
.fx img{width:100%;height:100%;object-fit:cover}
@media (hover:none),(pointer:coarse),(prefers-reduced-motion:reduce){.fx{display:none}}
.clients{padding-block:clamp(2.5rem,2rem + 2vw,4rem);border-block:1px solid var(--line);overflow:hidden}
.clients .eyebrow{margin-bottom:1.25rem}
.clients .mq{--mq-speed:34s}
.cl-row{display:flex;flex:none;flex-wrap:nowrap}
.wrap>.cl-row{flex-wrap:wrap;gap:.5rem 0}
.cl-row li{display:flex;align-items:center;gap:1.5rem;padding-right:1.5rem;font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.6vw,4.4rem);line-height:1;text-transform:uppercase;white-space:nowrap}
.cl-star{display:inline-grid;color:var(--primary)}
.svc-sec{background:var(--surface)}
.svc-head{display:grid;gap:1.25rem;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
@media (min-width:60rem){.svc-head{grid-template-columns:1fr 26rem;align-items:end}}
.svc-head .lead{font-size:1.05rem}
.svc{border-top:1px solid var(--ink)}
.svc li{position:relative;display:grid;grid-template-columns:2.5rem 1fr;gap:.35rem 1rem;align-items:baseline;padding:1.6rem 0;border-bottom:1px solid var(--line);isolation:isolate}
.svc li::before{content:'';position:absolute;inset:0 -1rem;z-index:-1;background:var(--bg);transform:scaleX(0);transform-origin:0 50%;transition:transform .6s cubic-bezier(.7,0,.2,1)}
.svc li:hover::before{transform:scaleX(1)}
@media (min-width:48rem){.svc li{grid-template-columns:4rem 1fr auto;gap:1.5rem}}
.svc-n{font-size:.8rem;color:var(--primary-text)}
.svc-body h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.7rem,1.3rem + 1.5vw,2.8rem);line-height:1;text-transform:uppercase}
.svc-body p{margin-top:.45rem;color:var(--muted)}
.svc-price{grid-column:2;font-size:1.25rem;font-weight:600;letter-spacing:-.02em;white-space:nowrap}
@media (min-width:48rem){.svc-price{grid-column:auto;font-size:1.5rem}}
.incl-box{margin-top:2.5rem;padding:clamp(1.25rem,1rem + 1vw,2rem);border:1px solid var(--line);border-radius:var(--radius);background:var(--bg)}
.incl-box h3{margin-bottom:1rem;font-size:1rem}
.incl{display:grid;gap:.7rem}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;gap:.7rem 2rem}}
.incl li{display:flex;gap:.6rem;align-items:flex-start}
.incl .i{flex:none;margin-top:.25rem;color:var(--primary-text)}
.svc-cta{margin-top:2.25rem}
.about-grid{display:grid;gap:2.5rem;align-items:center}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr;gap:6rem}}
.about-media{overflow:hidden;width:min(100%,30rem);aspect-ratio:4/5;border-radius:var(--radius)}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.about-copy{display:grid;gap:1.15rem;justify-items:start}
.about-copy p:not(.eyebrow){max-width:38rem;font-size:1.15rem;line-height:1.65}
.socials a{width:3rem;height:3rem;border-width:1px;transition:background-color .25s ease,color .25s ease}
.socials a:hover{background:var(--ink);color:var(--bg)}
.how{border-top:1px solid var(--line)}
.steps{position:relative;display:grid;gap:2.25rem}
@media (min-width:56rem){.steps{grid-template-columns:repeat(var(--n,4),1fr);gap:2rem}}
.steps li{position:relative;display:grid;gap:.6rem;align-content:start;padding-top:1.4rem}
.steps li::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:var(--ink);transform-origin:0 50%}
html.m .steps li::before{transform:scaleX(0);transition:transform 1.1s cubic-bezier(.7,0,.2,1);transition-delay:calc(var(--d) * 140ms)}
html.m .steps.in li::before{transform:scaleX(1)}
.st-n{font-size:.85rem;color:var(--primary-text)}
.steps h3{font-size:1.2rem}
.steps p{color:var(--muted)}
.rv-sec{border-top:1px solid var(--line)}
.quotes{display:grid;gap:2.5rem;margin-top:1.5rem}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:3rem}}
.q blockquote{margin:0;font-size:clamp(1.4rem,1.1rem + 1.1vw,2.1rem);line-height:1.25;letter-spacing:-.02em;font-weight:500}
.q blockquote p::before{content:'\\201C'}
.q blockquote p::after{content:'\\201D'}
.q figcaption{margin-top:1rem;font-size:.9rem;color:var(--muted)}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.faq details{border-radius:var(--radius)}
.contact{background:var(--dark);color:var(--on-dark)}
.contact .eyebrow{color:var(--muted-on-dark)}
.contact .big{color:var(--on-dark)}
.contact .lead{color:var(--muted-on-dark)}
.contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:1.1fr .9fr;gap:5rem}}
.contact-copy{display:grid;gap:1.25rem;justify-items:start}
.promise{display:flex;gap:.7rem;align-items:flex-start;max-width:34rem;padding:1rem 1.2rem;border-radius:var(--radius);border:1px solid var(--line-on-dark);line-height:1.5}
.promise .i{flex:none;margin-top:.15rem;color:var(--primary-on-dark)}
.promise strong{color:var(--on-dark)}
.contact-list.on-dark{margin-top:.5rem}
.contact-list.on-dark .i{color:var(--primary-on-dark)}
.contact-list.on-dark a{color:var(--on-dark)}
.form-card{width:100%;padding:clamp(1.3rem,1rem + 1.5vw,2.4rem);border-radius:var(--radius);background:var(--bg);color:var(--ink)}
.form-title{margin-bottom:1.25rem;font-family:var(--font-display);font-weight:400;font-size:2rem;text-transform:uppercase}
.ftr-name{font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:1.6rem}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Frame',
  bestFor: 'Photographers, video editors, designers and UGC creators who get hired for their work, with motion',
  why: 'The work comes first: your name fills the screen, every piece wipes in on a gallery wall, and an index of projects shows a preview as the cursor moves.',
  fonts: { q: 'family=Anton&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500', display: ['Anton', 'grotesk'], body: ['Geist', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
