// Assembly (animated, product, for a physical product): the exploded view. A quiet grey-to-white launch page where the
// hero is a still of the product with its one-line promise, then a pinned scroll section where the product comes apart
// into layers floating in space (shell, board, the product's own photo, frame, glass: CSS 3D planes in the member's
// colors), each with a hairline callout labelled from the member's own list of features, and goes back together as you
// keep scrolling. When the member has renders in frames/ (facts.frames: frames/0001.webp, 0002.webp...), the section
// plays them on a canvas instead. Then close-ups with parallax, a specs table of what they told us, and the Buy button.
// Reduced motion and no script: the exploded still with its labels in a list beside it.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

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
${name !== c.name ? `<p class="as-kick" data-rv>${esc(c.name)}</p>` : ''}
<h1 class="as-name" id="hero-title" data-split>${esc(name)}</h1>
<p class="as-sub" data-rv style="--d:4">${esc(sub)}</p>
<div class="as-ctas" data-rv style="--d:5">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="as-from">${esc(price)}</span>` : ''}</div>
<div class="as-hero-shot" data-rv="scale" style="--d:3">${P.img(c, 'hero', { cls: 'as-hero-img', eager: true })}</div>
</div></section>`;

  const layers = LAYERS.map((l, i) => `<div class="as-ly as-${l}" style="--n:${i - 2}">${l === 'photo' ? P.img(c, 'hero', { cls: 'as-ly-img' }).replace(/alt="[^"]*"/, 'alt=""') : ''}<i class="as-dot" data-for="${i}"></i></div>`).join('');
  const frames = c.frames ? ` data-frames="${c.frames}"` : '';
  const inside = `<section class="as-x" id="inside" aria-labelledby="inside-title"${frames}>
<div class="as-pin">
<div class="wrap as-x-head"><p class="as-kick" data-rv>Inside</p><h2 class="as-h2" id="inside-title" data-split>${esc(`Take ${name} apart.`)}</h2></div>
<div class="as-x-body">
<div class="as-stage" aria-hidden="true"><div class="as-stack">${layers}</div>${c.frames ? '<canvas class="as-seq" width="1600" height="1200"></canvas>' : ''}</div>
${labels.length ? `<ol class="as-labels">${labels.map((x, i) => `<li data-for="${LAYERS.length - 1 - i}" style="--j:${i}"><span class="as-ln" aria-hidden="true"></span><span class="as-lt"><b>${String(i + 1).padStart(2, '0')}</b>${esc(x)}</span></li>`).join('')}</ol>` : ''}
</div>
</div>
</section>`;

  const close = `<section class="as-sec as-close" aria-label="${esc(`${name}, up close`)}"><div class="wrap as-close-grid">
<div class="as-cl" data-rv="mask"><div>${P.img(c, 'detail', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.08" ')}</div></div>
<div class="as-cl down" data-rv="mask" style="--d:2"><div>${P.img(c, 'detail2', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.04" ')}</div></div>
<div class="as-close-copy">${c.aboutParas.slice(0, 2).map((p, i) => `<p class="${i ? 'as-p' : 'as-say'}" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div>
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
<div data-rv><p class="as-kick">Specs</p><h2 class="as-h2" id="specs-title">The details.</h2></div>
<dl class="as-dl" data-rv style="--d:1">${rows.map(([k, v, raw]) => `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('')}</dl>
</div></section>`
    : '';

  const buySec = `<section class="as-sec as-buy" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title"><div class="wrap as-buy-in">
<div class="as-buy-shot" data-rv="scale">${P.img(c, 'hero', { cls: 'as-buy-img' }).replace(/alt="[^"]*"/, 'alt=""')}</div>
<p class="as-kick" data-rv>${waitlist ? 'Waitlist' : 'Buy'}</p>
<h2 class="as-h2 big" id="buy-title" data-split>${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist ? `<p class="as-p" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p><div class="as-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `${price ? `<p class="as-price" data-rv style="--d:2">${esc(price)}</p>` : ''}<div class="as-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}</div>`}
${c.shipping ? `<p class="as-ship" data-rv style="--d:4">${icon('truck', { size: 18 })}${esc(c.shipping)}</p>` : ''}
</div></section>`;

  const reviews = c.reviews.length ? `<section class="as-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="as-kick" data-rv>Reviews</p><h2 class="as-h2" id="reviews-title">What people say</h2><div data-rv style="margin-top:2rem">${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="as-sec" id="faq" aria-labelledby="faq-title"><div class="wrap as-specs"><div data-rv><p class="as-kick">FAQ</p><h2 class="as-h2" id="faq-title">Questions.</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'as-hdr', ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, inside, close, specs, buySec, reviews, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', radiusSm: '12px', btnRadius: '999px', max: '76rem' } };
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
${FOOTER_CSS}${REVIEWS_CSS}
body{background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 6%,var(--bg)) 0,var(--bg) 70rem);letter-spacing:-.011em}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.25rem}
.brand{display:flex;align-items:center;gap:.55rem;margin-right:auto;font-family:var(--font-display);font-weight:600;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:.5rem;background:var(--ink);color:var(--bg);font-size:.7rem;font-weight:700}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.84rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.as-kick{font-size:.9rem;font-weight:600;color:var(--primary-text)}
.as-h2{margin-top:.5rem;font-size:clamp(2.3rem,1.5rem + 3.6vw,4.8rem);line-height:1}
.as-h2.big{font-size:clamp(2.8rem,1.6rem + 5vw,6.4rem)}
.as-p{margin-top:1rem;max-width:36rem;font-size:1.12rem;line-height:1.6;color:var(--muted)}
.as-hero{padding-top:clamp(3rem,2rem + 4vw,6rem);text-align:center}
.as-hero-in{display:grid;justify-items:center}
.as-name{margin-top:.4rem;font-size:clamp(3.4rem,1rem + 10vw,10rem);line-height:.92;letter-spacing:-.06em}
.as-sub{max-width:34rem;margin-top:1.2rem;font-size:clamp(1.2rem,1rem + .8vw,1.7rem);line-height:1.3;font-weight:500;letter-spacing:-.025em;text-wrap:balance}
.as-ctas{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.6rem 1.4rem;margin-top:1.8rem}
.as-from{color:var(--muted);font-weight:500}
.as-hero-shot{width:min(100%,58rem);margin-top:clamp(2.5rem,2rem + 3vw,4.5rem)}
.as-hero-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius);box-shadow:0 50px 90px -50px color-mix(in srgb,var(--ink) 50%,transparent)}
/* the exploded view: a still with a list by default */
.as-x{--e:.85;--p:.5;padding-block:clamp(4rem,3rem + 4vw,7rem)}
.as-x-head{text-align:center}
.as-x-body{display:grid;gap:2rem;align-items:center;width:min(100% - 2rem,var(--max));margin:2rem auto 0}
@media (min-width:56rem){.as-x-body{grid-template-columns:1.3fr .7fr}}
.as-stage{position:relative;aspect-ratio:1;max-height:70vh;width:100%;perspective:1800px;display:grid;place-items:center}
.as-stack{position:relative;width:52%;aspect-ratio:1;transform-style:preserve-3d;transform:rotateX(58deg) rotateZ(-36deg) rotateZ(calc(var(--p) * 24deg))}
.as-ly{position:absolute;inset:0;border-radius:18%;transform:translateZ(calc(var(--n) * (6px + var(--e) * 13vmin)));transform-style:preserve-3d;transition:box-shadow .4s ease}
.as-shell{background:linear-gradient(135deg,color-mix(in srgb,var(--ink) 70%,var(--bg)),var(--ink));box-shadow:0 60px 80px -30px color-mix(in srgb,var(--ink) 60%,transparent)}
.as-board{inset:8%;border-radius:12%;background:repeating-linear-gradient(0deg,transparent 0 14px,color-mix(in srgb,var(--on-primary) 20%,transparent) 14px 15px),repeating-linear-gradient(90deg,transparent 0 14px,color-mix(in srgb,var(--on-primary) 20%,transparent) 14px 15px),var(--primary)}
.as-board::after{content:'';position:absolute;inset:32%;border-radius:20%;background:color-mix(in srgb,var(--ink) 80%,var(--primary));box-shadow:0 0 0 6px color-mix(in srgb,var(--on-primary) 25%,transparent)}
.as-photo{inset:4%;overflow:hidden;border-radius:15%;background:var(--surface)}
.as-ly-img{width:100%;height:100%;object-fit:cover}
.as-frame{inset:2%;border-radius:16%;border:clamp(6px,1.4vmin,14px) solid color-mix(in srgb,var(--accent) 80%,var(--ink));background:transparent}
.as-glass{border-radius:18%;background:linear-gradient(135deg,color-mix(in srgb,#fff 65%,transparent),color-mix(in srgb,#fff 12%,transparent) 55%,color-mix(in srgb,#fff 40%,transparent));border:1px solid color-mix(in srgb,#fff 80%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 8%,transparent)}
.as-dot{position:absolute;right:6%;top:6%;width:6px;height:6px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 3px var(--bg)}
.as-glass .as-dot,.as-frame .as-dot{background:var(--primary)}
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
html.m .as-x.live .as-ln{display:block;position:absolute;right:100%;top:50%;width:var(--w,0px);height:1px;margin-right:6px;background:var(--ink);transform-origin:100% 50%;transform:rotate(var(--a,0rad)) scaleX(0);transition:transform .7s cubic-bezier(.7,0,.2,1)}
html.m .as-x.live .as-labels li.on .as-ln{transform:rotate(var(--a,0rad)) scaleX(1)}
html.m .as-x.live .as-labels li .as-lt{padding:.6rem .9rem;border-radius:12px;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 8%,transparent)}
@media (max-width:55.99rem){html.m .as-x-body{grid-template-rows:1fr auto}html.m .as-stage{max-height:52vh;justify-self:center}html.m .as-x.live .as-labels{position:static;display:grid;gap:.4rem;padding-bottom:5.5rem}html.m .as-x.live .as-labels li{position:static;width:auto;transform:none;opacity:.35;transition:opacity .4s ease}html.m .as-x.live .as-labels li.on{opacity:1}html.m .as-x.live .as-ln{display:none}html.m .as-x.live .as-labels li .as-lt{padding:0;background:none;box-shadow:none;font-size:.95rem}.as-stack{width:62%}}
/* close-ups */
.as-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.as-close-grid{display:grid;gap:1rem;grid-template-columns:1fr 1fr}
.as-cl>div{overflow:hidden;border-radius:var(--radius);aspect-ratio:6/7}
.as-cl.down{margin-top:clamp(2rem,1rem + 6vw,7rem)}
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
.as-buy{text-align:center;background:radial-gradient(60rem 30rem at 50% 30%,var(--surface),transparent 70%)}
.as-buy-in{display:grid;justify-items:center}
.as-buy-shot{width:min(100%,24rem);margin-bottom:2rem}
.as-buy-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius)}
.as-price{margin-top:1rem;font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:600;letter-spacing:-.04em}
.as-ship{display:flex;align-items:center;gap:.5rem;margin-top:1.4rem;color:var(--muted)}
.as-form{width:min(100%,30rem);margin-top:1.6rem;text-align:left}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem}
.faq .ans{padding:0 0 1.25rem}
.ftr{background:var(--surface);border-top:0}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Assembly',
  bestFor: 'A physical product worth opening up: a speaker, a bag, a lamp, a bike part, a kit with parts',
  match: /\b(speakers?|headphones|earbuds|keyboards?|lamps?|gadgets?|devices?|hardware|electronics|e-?bikes?|drones?|backpacks?|chargers?|wearables?|mod(ular)? kits?)\b/,
  why: 'Built for a physical product: a clean product hero, then your product comes apart into floating layers as you scroll, each labelled from your own feature list, and goes back together before the Buy button.',
  fonts: { q: 'family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600', display: ['Inter Tight', 'sans'], body: ['Inter', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
