// Assembly (animated, product, for a physical product worth opening up): the exploded view.
//   Object:   the product, and the product taken apart: its layers as flat planes in space (shell, board, the photo,
//             frame, glass), each tied by a hairline callout to a line from the member's own feature list.
//   Material: aluminium and paper: a cool light page, graphite ink, machined edges (small radii), hairlines.
//   One move: the name's letters fly in and lock together like parts fitted, the product lands beside them; then the
//             scroll takes it apart and puts it back together (pinned), backwards on the way up.
//   Pop:      the member's colour is the callout lines as they draw to each layer, then the roadmap's line from order
//             to door. Buttons are ink.
// At rest the product leans toward the pointer and springs when tapped. When the member has renders in frames/
// (facts.frames: frames/0001.webp...), the pinned section plays them on a canvas instead. Then close-ups with the
// member's story, order to door as a roadmap, the specs as a table of what they told us, and the Buy block.
// Reduced motion and no script: the exploded still with its labels in a list beside it. Its motion is the `choreo`
// block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'assembly';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f6f7f8', 0.9), dark: color.mix(p.ink, '#0b0b0c', 0.85) };
}

function product(c) {
  return c.productName || c.name;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [
    { slot: 'hero', file: 'product.jpg', w: 1600, h: 1200, style: 'object', alt: c.profile.hero && !/^the product/i.test(c.profile.hero) ? c.profile.hero : `${name}, up close` },
    { slot: 'detail', file: 'detail-1.jpg', w: 1200, h: 1400, style: 'mesh', alt: g[1] || `${name}, a close look at the materials` },
    { slot: 'detail2', file: 'detail-2.jpg', w: 1200, h: 1400, style: 'grid', alt: g[2] || `${name}, the details` },
  ];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText;
  return c.priceText || '';
}

function nav(c) {
  return [
    { label: 'Inside', href: '#inside' },
    { label: 'Specs', href: '#specs' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    c.buy ? { label: 'Buy', href: '#buy' } : { label: 'Waitlist', href: '#signup' },
  ].filter(Boolean);
}

// The generated "About" for a product ("X makes Y...") repeats the page; only the member's own words are shown.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  const gen = new RegExp(`^${String(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} makes `, 'i');
  if (paras.length === 1 && gen.test(paras[0])) return [];
  if (/^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

// The layers, bottom to top. Each is a flat plane in the stack; the product photo is one of them.
const LAYERS = ['shell', 'board', 'photo', 'frame', 'glass'];

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const labels = c.included.slice(0, LAYERS.length);

  const hero = `<section class="as-hero" aria-labelledby="hero-title"><div class="wrap as-hero-in">
${name !== c.name ? `<p class="as-kick" data-ci="then">${esc(c.name)}</p>` : ''}
<h1 class="as-name" id="hero-title" data-ci="head">${esc(name)}</h1>
<div class="as-hero-copy2"><p class="as-sub" data-ci="then">${esc(sub)}</p>
<div class="as-ctas" data-ci="then">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="as-from">${esc(price)}</span>` : ''}</div></div>
<div class="as-hero-shot" data-ci="subject">${P.img(c, 'hero', { cls: 'as-hero-img', eager: true }).replace('<img ', '<img data-alive="0.9" ')}</div>
</div></section>`;

  const layers = LAYERS.map((l, i) => `<div class="as-ly as-${l}" style="--n:${i - 2}">${l === 'photo' ? P.img(c, 'hero', { cls: 'as-ly-img' }).replace(/alt="[^"]*"/, 'alt=""') : ''}<i class="as-dot" data-for="${i}"></i></div>`).join('');
  const frames = c.frames ? ` data-frames="${c.frames}"` : '';
  const inside = `<section class="as-x" id="inside" aria-labelledby="inside-title"${frames}>
<div class="as-pin">
<div class="wrap as-x-head"><h2 class="as-h2" id="inside-title" data-split>${esc(`Take ${name} apart.`)}</h2></div>
<div class="as-x-body">
<div class="as-stage" aria-hidden="true"><div class="as-stack">${layers}</div>${c.frames ? '<canvas class="as-seq" width="1600" height="1200"></canvas>' : ''}</div>
${labels.length ? `<ol class="as-labels">${labels.map((x, i) => `<li data-for="${LAYERS.length - 1 - i}" style="--j:${i}"><span class="as-ln" aria-hidden="true"></span><span class="as-lt"><b>${String(i + 1).padStart(2, '0')}</b>${esc(x)}</span></li>`).join('')}</ol>` : ''}
</div>
</div>
</section>`;

  const close = `<section class="as-sec as-close" aria-label="${esc(`${name}, up close`)}"><div class="wrap as-close-grid">
<div class="as-cl" data-rv="mask"><div>${P.img(c, 'detail', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.08" ')}</div></div>
<div class="as-cl down" data-rv="mask" style="--d:2">${ownAbout(c).length ? '' : `<p class="as-cl-cap">${esc(`${name}, up close.`)}</p>`}<div>${P.img(c, 'detail2', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.04" ')}</div></div>
<div class="as-close-copy">${ownAbout(c).slice(0, 2).map((p, i) => `<p class="${i ? 'as-p' : 'as-say'}" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div>
</div></section>`;

  const priced = c.services.filter((s) => s.name);
  const rows = [
    ...priced.map((s) => [s.name, [s.priceText, s.blurb].filter(Boolean).join(', ')]),
    ...(c.included.length ? [[c.included.length > 1 ? 'Features' : 'Feature', `<ul>${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, true]] : []),
    c.shipping && ['Shipping', c.shipping],
    c.returns && ['Returns', c.returns],
    c.capacity && ['Made in', c.capacity],
  ].filter(Boolean).filter((r) => r[1]);
  const specs = rows.length
    ? `<section class="as-sec" id="specs" aria-labelledby="specs-title"><div class="wrap as-specs">
<h2 class="as-h2" id="specs-title">The details.</h2>
<dl class="as-dl" data-rv style="--d:1">${rows.map(([k, v, raw]) => `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('')}</dl>
</div></section>`
    : '';

  // Order to door as a roadmap: each size or option with its price, then the member's own shipping and returns, drawn
  // in with the scroll and ending at the Buy button.
  const route = waitlist ? '' : roadmap({ id: 'route', cls: 'as-road', title: 'Order to door.', nodes: [...priced.map((s) => ({ title: s.name, meta: s.priceText || '', sub: s.blurb || '' })), c.shipping && { title: 'Shipping', sub: c.shipping }, c.returns && { title: 'Returns', sub: c.returns }], end: mag(P.button(buy, 'btn btn-primary')), endLabel: name });

  const buySec = `<section class="as-sec as-buy" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title"><div class="wrap as-buy-in">
<div class="as-buy-shot" data-rv="scale">${P.img(c, 'hero', { cls: 'as-buy-img' }).replace(/alt="[^"]*"/, 'alt=""')}</div>
<div class="as-buy-copy"><h2 class="as-h2 big" id="buy-title" data-split>${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist ? `<p class="as-p" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p><div class="as-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `${price ? `<p class="as-price" data-rv style="--d:2">${esc(price)}</p>` : ''}<div class="as-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}</div>`}
${c.shipping ? `<p class="as-ship" data-rv style="--d:4">${esc(c.shipping)}</p>` : ''}</div>
</div></section>`;

  const reviews = c.reviews.length ? `<section class="as-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="as-h2" id="reviews-title">What people say</h2><div data-rv style="margin-top:2rem">${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="as-sec" id="faq" aria-labelledby="faq-title"><div class="wrap as-specs"><h2 class="as-h2" id="faq-title">Questions.</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'as-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, inside, close, route, specs, buySec, reviews, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '6px', max: '80rem' } };
}

// The pinned section's progress (--e: how far apart the layers are, 0 together, 1 apart and back) and its callouts: each
// label's hairline is drawn to its layer's corner, read from where the browser put that corner on screen. With frames
// in frames/, a canvas plays them instead (phones load every few frames only). Off for reduced motion.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,x=d.querySelector('.as-x');if(!x)return;
var stk=x.querySelector('.as-stack'),pin=x.querySelector('.as-pin'),labs=[].slice.call(x.querySelectorAll('.as-labels li')),dots=[].slice.call(x.querySelectorAll('.as-dot')),t=false;
function cl(v){return v<0?0:v>1?1:v}
var cv=x.querySelector('.as-seq'),N=+x.getAttribute('data-frames')||0,imgs=[],g=null,cur=-1;
if(cv&&N){var phone=innerWidth<768,step=phone?Math.max(1,Math.ceil(N/12)):1;g=cv.getContext('2d');var load=function(i){var im=new Image();im.decoding='async';im.src='frames/'+('000'+(i+1)).slice(-4)+'.webp';imgs[i]=im;im.onload=function(){if(i===0)x.classList.add('seq');f()}};addEventListener('load',function(){for(var i=0;i<N;i+=step)load(i);if((N-1)%step)load(N-1)})}
function frame(p){if(!g)return;var want=Math.round(p*(N-1)),best=-1;for(var i=0;i<N;i++){if(imgs[i]&&imgs[i].complete&&imgs[i].naturalWidth&&(best<0||Math.abs(i-want)<Math.abs(best-want)))best=i}if(best>=0&&best!==cur){cur=best;g.clearRect(0,0,cv.width,cv.height);g.drawImage(imgs[best],0,0,cv.width,cv.height)}}
function f(){t=false;var vh=innerHeight,r=x.getBoundingClientRect(),p=cl(-r.top/Math.max(1,r.height-vh)),e=Math.sin(Math.PI*cl((p-.06)/.86));x.style.setProperty('--e',e.toFixed(4));x.style.setProperty('--p',p.toFixed(4));frame(p);
if(labs.length){var pr=pin.getBoundingClientRect();labs.forEach(function(li,j){var on=p>.14+j*.07&&p<.8;li.classList.toggle('on',on);var dot=dots[+li.getAttribute('data-for')];if(!dot)return;var b=dot.getBoundingClientRect(),lr=li.getBoundingClientRect(),dx=lr.left-6-(b.left+b.width/2),dy=(b.top+b.height/2)-(lr.top+lr.height/2);li.style.setProperty('--w',Math.max(0,Math.sqrt(dx*dx+dy*dy)).toFixed(1)+'px');li.style.setProperty('--a',Math.atan2(-dy,dx).toFixed(4)+'rad')})}}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);x.classList.add('live');f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
body{--rule:color-mix(in srgb,var(--ink) 15%,transparent);letter-spacing:-.011em}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn-primary{box-shadow:none}
.as-name .ci-pop{background-position:0 96%}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.1rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.84rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.as-kick{font-size:.95rem;font-weight:600;color:var(--muted)}
.as-h2{margin-top:.5rem;font-size:clamp(2.3rem,1.5rem + 3.6vw,4.8rem);line-height:1}
.as-h2.big{font-size:clamp(2.8rem,1.6rem + 5vw,6.4rem)}
.as-p{margin-top:1rem;max-width:36rem;font-size:1.12rem;line-height:1.6;color:var(--muted)}
.as-hero{padding-block:clamp(2.5rem,1.5rem + 4vw,5.5rem) clamp(3rem,2rem + 3vw,5rem);border-bottom:1px solid var(--rule)}
.as-hero-in{display:grid;gap:0 1.5rem;align-items:end}
@media (min-width:60rem){.as-hero-in{grid-template-columns:repeat(12,minmax(0,1fr))}.as-hero-in>.as-kick,.as-name,.as-hero-copy2{grid-column:1/7}.as-hero-shot{grid-column:7/13;grid-row:1/4;align-self:center}}
.as-hero-copy2{padding-top:1.2rem;margin-top:1.4rem;border-top:1px solid var(--rule)}
.as-name{margin-top:.4rem;margin-left:-.05em;font-size:clamp(3.6rem,1rem + 9vw,10rem);line-height:.88;letter-spacing:-.065em}
.as-sub{max-width:30rem;font-size:clamp(1.2rem,1rem + .8vw,1.7rem);line-height:1.3;font-weight:500;letter-spacing:-.025em;text-wrap:balance}
.as-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.4rem;margin-top:1.6rem}
.as-from{color:var(--muted);font-weight:500;font-variant-numeric:tabular-nums}
.as-hero-shot{width:100%;margin-top:clamp(2rem,1.5rem + 3vw,3rem)}
@media (min-width:60rem){.as-hero-shot{margin-top:0}}
.as-hero-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius)}
/* the exploded view: a still with a list by default */
.as-x{--e:.85;--p:.5;padding-block:clamp(4rem,3rem + 4vw,7rem)}
.as-x-head{display:grid;gap:.6rem}
.as-x-body{display:grid;gap:2rem;align-items:center;width:min(100% - 2rem,var(--max));margin:2rem auto 0}
@media (min-width:56rem){.as-x-body{grid-template-columns:1.3fr .7fr}.as-x-body:not(:has(.as-labels)){grid-template-columns:1fr}.as-x-body:not(:has(.as-labels)) .as-stage{justify-self:center;width:min(100%,46rem)}}
.as-stage{position:relative;aspect-ratio:1;max-height:70vh;width:100%;perspective:1800px;display:grid;place-items:center}
.as-stack{position:relative;width:52%;aspect-ratio:1;transform-style:preserve-3d;transform:rotateX(58deg) rotateZ(-36deg) rotateZ(calc(var(--p) * 24deg))}
.as-ly{position:absolute;inset:0;border-radius:18%;transform:translateZ(calc(var(--n) * (6px + var(--e) * 13vmin)));transform-style:preserve-3d;transition:box-shadow .4s ease}
.as-shell{background:linear-gradient(135deg,#eef0f2 0,#c9cdd2 38%,#a9aeb5 62%,#d9dce0 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),inset 0 -6px 14px rgba(0,0,0,.18),0 40px 50px -30px rgba(0,0,0,.35)}
.as-board{inset:8%;border-radius:12%;background:linear-gradient(135deg,#3a3d42,#24262a 60%,#1b1c1f)}
.as-board::before{content:'';position:absolute;left:14%;top:16%;width:22%;height:14%;border-radius:8%;background:linear-gradient(180deg,#b9bdc3,#8d9298)}
.as-board::after{content:"";position:absolute;inset:32%;border-radius:20%;background:linear-gradient(135deg,#55595f,#2c2e32);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 0 4px #2f3135,0 0 0 5px rgba(255,255,255,.08)}
.as-photo{inset:4%;overflow:hidden;border-radius:15%;background:var(--surface)}
.as-ly-img{width:100%;height:100%;object-fit:cover}
.as-frame{inset:2%;border-radius:16%;border:clamp(6px,1.4vmin,14px) solid #3b3e43;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 0 0 1px rgba(0,0,0,.25);background:transparent}
.as-glass{border-radius:18%;background:linear-gradient(135deg,color-mix(in srgb,#fff 65%,transparent),color-mix(in srgb,#fff 12%,transparent) 55%,color-mix(in srgb,#fff 40%,transparent));border:1px solid color-mix(in srgb,#fff 80%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 8%,transparent)}
.as-dot{position:absolute;right:6%;top:6%;width:7px;height:7px;background:var(--ink)}
.as-glass .as-dot,.as-frame .as-dot{background:var(--pop)}
.as-seq{display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.as-x.seq .as-seq{display:block}
.as-x.seq .as-stack{visibility:hidden}
.as-labels{display:grid;gap:.9rem;counter-reset:a}
.as-labels li{display:flex;align-items:center;gap:.8rem}
.as-ln{display:none}
.as-lt{display:grid;gap:.15rem;font-size:1.05rem;font-weight:500;line-height:1.35}
.as-lt b{font-size:.75rem;font-weight:600;color:var(--primary-text);font-variant-numeric:tabular-nums}
html.m .as-x{height:340vh;height:340svh;padding:0}
html.m .as-pin{position:sticky;top:0;height:100vh;height:100svh;display:grid;grid-template-rows:auto 1fr;padding-top:calc(3.25rem + 2vh);overflow:hidden}
html.m .as-x-body{margin-top:0;height:100%}
html.m .as-x.live .as-labels{position:absolute;inset:0;pointer-events:none}
html.m .as-x.live .as-labels li{position:absolute;right:max(1rem,calc((100vw - var(--max)) / 2));top:calc(30vh + var(--j) * 10vh);width:min(17rem,30vw);opacity:0;transition:opacity .5s ease}
html.m .as-x.live .as-labels li.on{opacity:1}
html.m .as-x.live .as-ln{display:block;position:absolute;right:100%;top:50%;width:var(--w,0px);height:2px;margin-right:6px;background:var(--pop);transform-origin:100% 50%;transform:rotate(var(--a,0rad)) scaleX(0);transition:transform .7s cubic-bezier(.7,0,.2,1)}
html.m .as-x.live .as-labels li.on .as-ln{transform:rotate(var(--a,0rad)) scaleX(1)}
html.m .as-x.live .as-labels li .as-lt{padding:.55rem .8rem;border-radius:4px;background:var(--bg);border:1px solid var(--rule)}
@media (max-width:55.99rem){html.m .as-x-body{grid-template-rows:1fr auto}html.m .as-stage{max-height:52vh;justify-self:center}html.m .as-x.live .as-labels{position:static;display:grid;gap:.4rem;padding-bottom:5.5rem}html.m .as-x.live .as-labels li{position:static;width:auto;transform:none;opacity:1;color:var(--muted);transition:color .4s ease}html.m .as-x.live .as-labels li .as-lt b{color:var(--muted)}html.m .as-x.live .as-labels li.on{color:var(--ink)}html.m .as-x.live .as-labels li.on .as-lt b{color:var(--primary-text)}html.m .as-x.live .as-ln{display:none}html.m .as-x.live .as-labels li .as-lt{padding:0;background:none;border:0;font-size:.95rem}.as-stack{width:62%}}
/* close-ups */
.as-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.as-close-grid{display:grid;gap:1rem;grid-template-columns:1fr 1fr}
.as-cl>div{overflow:hidden;border-radius:var(--radius);aspect-ratio:6/7}
.as-cl.down{margin-top:clamp(2rem,1rem + 6vw,7rem)}
.as-cl-cap{margin:-2.4rem 0 1rem;font-family:var(--font-display);font-size:clamp(1.1rem,.9rem + 1vw,1.8rem);font-weight:600;letter-spacing:-.03em;line-height:1.1}
@media (max-width:39.99rem){.as-cl-cap{margin-top:-1.6rem;font-size:1rem}}
.as-cl-img{width:100%;height:118%;margin-top:-9%;object-fit:cover}
.as-close-copy{grid-column:1/-1;max-width:46rem;margin-top:2rem}
.as-say{font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 2vw,2.8rem);font-weight:600;line-height:1.15;letter-spacing:-.04em}
/* specs */
.as-specs{display:grid;gap:2rem}
@media (min-width:60rem){.as-specs{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.as-dl{border-top:1px solid var(--line)}
.as-dl div{display:grid;gap:.3rem;padding:1.15rem 0;border-bottom:1px solid var(--line)}
@media (min-width:40rem){.as-dl div{grid-template-columns:12rem 1fr;gap:1.5rem}}
.as-dl dt{font-weight:600}
.as-dl dd{color:var(--muted)}
.as-dl ul{display:grid;gap:.3rem}
/* buy */
.as-buy{border-top:1px solid var(--rule)}
.as-road{border-top:1px solid var(--line)}
.as-road .h2{font-size:clamp(2.3rem,1.5rem + 3.6vw,4.8rem);line-height:1}
.as-road .rm-meta{font-family:var(--font-display);font-size:1.5rem;letter-spacing:-.03em;color:var(--ink)}
.as-buy-in{display:grid;gap:2rem;align-items:end}
@media (min-width:56rem){.as-buy-in{grid-template-columns:7fr 5fr;gap:clamp(2rem,1rem + 4vw,6rem)}}
.as-buy-img{width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:var(--radius)}
.as-buy-copy{padding-top:1.2rem;border-top:1px solid var(--ink)}
.as-price{margin-top:1rem;font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:600;letter-spacing:-.04em}
.as-ship{margin-top:1.4rem;color:var(--muted)}
.as-form{width:min(100%,30rem);margin-top:1.6rem}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem}
.faq .ans{padding:0 0 1.25rem}
.ftr{border-top:1px solid var(--rule)}
.mbar{box-shadow:none;border-top-color:var(--rule)}
.as-dl{border-top-color:var(--ink)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Assembly',
  bestFor: 'A physical product worth opening up: a speaker, a bag, a lamp, a bike part, a kit with parts',
  match: /\b(speakers?|headphones|earbuds|keyboards?|lamps?|gadgets?|devices?|hardware|electronics|e-?bikes?|drones?|backpacks?|chargers?|wearables?|mod(ular)? kits?)\b/,
  why: 'Built for a physical product: the name assembles like fitted parts and your product lands beside it, then it comes apart into floating layers as you scroll, each labelled from your own feature list, and goes back together, with order to door drawn in as a route to the Buy button.',
  fonts: { q: 'family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600', display: ['Inter Tight', 'sans'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): parts fitted together, a product with spring in it, order to door as a route.
  choreo: { intro: 'assemble', alive: ['pointer', 'tap', 'drift'], scroll: 'roadmap', pace: 'medium', look: 'clean, engineered, precise springs' },
  tokens,
  slots,
  nav,
  render,
};
