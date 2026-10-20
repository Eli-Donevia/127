// Orbit (animated, product, for software and digital products): a dark page with a glowing hero. A conic light turns
// slowly behind the headline as its words rise in, and the product window tilts up flat as you scroll to it. Features
// sit in a bento grid with a pointer spotlight (the big card has rings that orbit), "how it works" fills a progress
// line as you scroll, then plans and prices from the member's services, questions and a last glowing call to action.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'orbit';
const GLYPHS = ['spark', 'bolt', 'refresh', 'link', 'chat', 'calendar', 'shield', 'globe', 'card', 'heart'];

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.12), '#000000', 0.62) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'hero', file: 'app.jpg', w: 1600, h: 1000, style: 'grid', alt: c.profile.hero || `${c.productName || c.name} on screen` }, { slot: 'detail', file: 'detail.jpg', w: 1200, h: 900, style: 'mesh', alt: g[1] || `${c.productName || c.name}, up close` }];
}

// How it works, from the member's own facts only: the plans, the buy link or waitlist, shipping, and who to email.
function howSteps(c) {
  if (c.steps.length >= 3) return c.steps.slice(0, 4);
  const out = [];
  if (c.services.length > 1) out.push({ title: 'Pick a plan', body: 'Choose the plan that fits how you work.' });
  out.push(c.buy ? { title: 'Check out', body: `Tap ${c.buy.label} and pay through the checkout page.` } : { title: 'Join the waitlist', body: 'Leave your email and hear the moment it opens.' });
  if (c.shipping) out.push({ title: 'Delivery', body: c.shipping });
  out.push({ title: 'Get started', body: c.email ? `Open it and dive in. Stuck on something? Email ${c.email}.` : 'Open it and dive in.' });
  return out;
}

function plans(c) {
  if (c.services.length) return c.services;
  if (c.priceText) return [{ name: c.productName || c.name, priceText: c.priceText, blurb: '' }];
  return [];
}

function nav(c) {
  return [
    c.included.length && { label: 'Features', href: '#features' },
    howSteps(c).length >= 3 && { label: 'How it works', href: '#how' },
    plans(c).length && { label: 'Pricing', href: '#pricing' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

function render(c) {
  const name = c.productName || c.name;
  const low = cheapest(c);
  const waitlist = c.primary.kind === 'form';
  const cta = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, `${cls} ob-btn`).replace('<a ', '<a data-mag ').replace(/<\/a>$/, `${icon('arrow', { size: 18 })}</a>`);
  const pill = c.audience ? `For ${c.audience.charAt(0).toLowerCase()}${c.audience.slice(1)}` : name !== c.heroTitle ? name : c.whatShort;
  const meta = [low ? `From ${low.priceText.replace(/^From /, '')}` : c.priceText, c.shipping, c.deadline && waitlist ? `Launching ${c.deadline}` : ''].filter(Boolean);

  const hero = `<section class="ob-hero" aria-labelledby="hero-title">
<div class="ob-sky" aria-hidden="true"><div class="ob-conic"></div><div class="ob-grid"></div></div>
<div class="wrap ob-hero-in">
${pill ? `<p class="ob-pill" data-rv><span class="ob-dot"></span>${esc(pill)}</p>` : ''}
<h1 id="hero-title" class="ob-title${c.heroTitle.length > 28 ? ' long' : ''}" data-split style="--d:1">${esc(c.heroTitle)}</h1>
${c.heroSub.replace(/[.!\s]+$/, '').toLowerCase() !== c.heroTitle.replace(/[.!\s]+$/, '').toLowerCase() ? `<p class="ob-sub" data-rv style="--d:5">${esc(c.heroSub)}</p>` : ''}
<div class="ob-ctas" data-rv style="--d:6">${cta()}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg ob-ghost') : ''}</div>
${meta.length ? `<ul class="ob-meta" data-rv style="--d:7">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
<div class="wrap ob-stage">
<div class="ob-horizon" aria-hidden="true"></div>
<div class="ob-window">
<div class="ob-chrome" aria-hidden="true"><i></i><i></i><i></i><span>${esc(name)}</span></div>
<div class="ob-screen">${P.img(c, 'hero', { cls: 'ob-screen-img', eager: true })}</div>
</div>
</div>
</section>`;

  const n = c.included.length;
  const features = n
    ? `<section class="ob-sec" id="features" aria-labelledby="features-title">
<div class="wrap">
<div class="ob-head" data-rv><p class="ob-eyebrow">Features</p><h2 class="ob-h2" id="features-title" data-split>${esc(n > 1 ? `Everything in ${name}` : `What you get with ${name}`)}</h2></div>
<ul class="ob-bento ob-n${Math.min(n, 7)}">
${c.included
  .map(
    (x, i) => `<li class="ob-card${i === 0 ? ' ob-card-big' : ''}" data-spot data-rv style="--d:${i % 3}">
${i === 0 ? '<div class="ob-orbit" aria-hidden="true"><span class="ob-ring r1"><i></i></span><span class="ob-ring r2"><i></i></span><span class="ob-ring r3"><i></i></span><span class="ob-core"></span></div>' : `<span class="ob-glyph" aria-hidden="true">${icon(GLYPHS[(i - 1) % GLYPHS.length], { size: 20 })}</span>`}
<p class="ob-card-t">${esc(x)}</p>
</li>`
  )
  .join('\n')}
</ul>
</div>
</section>`
    : '';

  const steps = howSteps(c);
  const how = steps.length >= 3
    ? `<section class="ob-sec ob-how" id="how" aria-labelledby="how-title">
<div class="wrap">
<div class="ob-head center" data-rv><p class="ob-eyebrow">How it works</p><h2 class="ob-h2" id="how-title" data-split>${esc(['', '', '', 'Three steps.', 'Four steps.'][steps.length] || 'How it works.')}</h2></div>
<ol class="ob-steps" style="--n:${steps.length}">
<li class="ob-track" aria-hidden="true"><span class="ob-fill"></span></li>
${steps.map((s, i) => `<li class="ob-step" data-rv style="--d:${i + 1}"><span class="ob-step-n" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('\n')}
</ol>
</div>
</section>`
    : '';

  const list = plans(c);
  const pricing = list.length
    ? `<section class="ob-sec ob-pricing" id="pricing" aria-labelledby="pricing-title">
<div class="wrap">
<div class="ob-head center" data-rv><p class="ob-eyebrow">Pricing</p><h2 class="ob-h2" id="pricing-title" data-split>${esc(list.length > 1 ? 'Pick your plan.' : 'One simple price.')}</h2></div>
<ul class="ob-plans ob-p${Math.min(list.length, 4)}">
${list
  .map(
    (s, i) => `<li class="ob-plan" data-spot data-rv="scale" style="--d:${i}">
<h3>${esc(s.name)}</h3>
${s.priceText ? `<p class="ob-price"><span class="ob-num">${esc(s.priceText.replace(/(\/\w+| (a|per) \w+)$/, ''))}</span>${/(\/\w+| (a|per) \w+)$/.test(s.priceText) ? `<small>${esc(s.priceText.match(/(\/\w+| (a|per) \w+)$/)[0].trim())}</small>` : ''}</p>` : ''}
${s.blurb ? `<p class="ob-plan-b">${esc(s.blurb)}</p>` : ''}
${s.duration ? `<p class="ob-plan-b">${icon('clock', { size: 16 })} ${esc(s.duration)}</p>` : ''}
${P.button(c.primary, 'btn btn-primary btn-block ob-btn')}
</li>`
  )
  .join('\n')}
</ul>
${c.shipping ? `<p class="ob-note" data-rv>${icon('truck', { size: 18 })}${esc(c.shipping)}</p>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="ob-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="ob-head" data-rv><p class="ob-eyebrow">Reviews</p><h2 class="ob-h2" id="reviews-title">What people say</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="ob-sec ob-about" id="about" aria-labelledby="about-title"><div class="wrap ob-about-in"><p class="ob-eyebrow" data-rv>About</p><h2 class="sr-only" id="about-title">About ${esc(c.name)}</h2>${c.aboutParas.map((p, i) => `<p class="ob-about-p${i ? ' more' : ''}" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="ob-sec" id="faq" aria-labelledby="faq-title"><div class="wrap ob-faq"><div data-rv><p class="ob-eyebrow">FAQ</p><h2 class="ob-h2" id="faq-title">Questions</h2>${c.email ? `<p class="ob-faq-more">Something else? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const end = `<section class="ob-sec ob-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title">
<div class="wrap">
<div class="ob-end-box" data-rv="scale">
<div class="ob-end-glow" aria-hidden="true"></div>
<h2 class="ob-h2" id="end-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="ob-sub" data-rv style="--d:2">${esc(c.ctaSub)}</p>` : ''}
${waitlist
  ? `<div class="ob-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="ob-ctas" data-rv style="--d:3">${cta()}</div>`}
</div>
</div>
</section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'ob-hdr' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, how, pricing, reviews, about, faq, end, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', radiusSm: '12px', btnRadius: '12px', max: '72rem' } };
}

// The product window tilts flat as it scrolls in (--t), the steps' line fills with the scroll (--h). Reduced motion
// leaves both settled.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,w=d.querySelector('.ob-stage'),s=d.querySelector('.ob-steps'),st=s?[].slice.call(s.querySelectorAll('.ob-step')):[],t=false;
function cl(v){return v<0?0:v>1?1:v}
function f(){t=false;var vh=innerHeight,r;if(w){r=w.getBoundingClientRect();w.style.setProperty('--t',cl((vh-r.top)/(vh*.75)).toFixed(4))}
if(s){r=s.getBoundingClientRect();var h=cl((vh*.7-r.top)/Math.max(1,r.height));s.style.setProperty('--h',h.toFixed(4));st.forEach(function(e,i){e.classList.toggle('on',h>=(i+.15)/st.length)})}}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@property --ang{syntax:'<angle>';inherits:false;initial-value:0deg}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 4%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 16%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--glow:color-mix(in srgb,var(--primary) 80%,#fff);--edge:color-mix(in srgb,var(--on-dark) 10%,transparent);overflow-x:hidden}
h1,h2,h3{font-weight:600;letter-spacing:-.035em}
.ob-eyebrow{display:inline-block;font-size:.8rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;background:linear-gradient(90deg,var(--primary-on-dark),var(--on-dark));-webkit-background-clip:text;background-clip:text;color:transparent}
.ob-h2{margin-top:.75rem;font-size:clamp(2.2rem,1.4rem + 3.2vw,4.2rem);line-height:1.04;letter-spacing:-.045em;padding-bottom:.08em}
.ob-h2,.ob-h2 .w>span{background:linear-gradient(180deg,var(--on-dark) 45%,color-mix(in srgb,var(--on-dark) 62%,var(--dark)));-webkit-background-clip:text;background-clip:text;color:transparent}
.ob-head{max-width:44rem;margin-bottom:clamp(2.5rem,2rem + 2vw,4rem)}
.ob-head.center{margin-inline:auto;text-align:center}
.ob-sec{position:relative;padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.ob-btn{gap:.5rem;box-shadow:0 0 0 1px color-mix(in srgb,#fff 18%,transparent) inset,0 10px 40px -10px var(--primary)}
.ob-btn .i{transition:transform .3s ease}
.ob-btn:hover .i{transform:translateX(3px)}
.ob-ghost{border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 5%,transparent);color:var(--on-dark)}
.ob-ghost:hover{background:color-mix(in srgb,var(--on-dark) 10%,transparent);border-color:var(--edge);color:var(--on-dark)}
/* header */
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .3s ease,border-color .3s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--dark) 70%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{display:flex;align-items:center;gap:.6rem;margin-right:auto;font-family:var(--font-display);font-weight:600;font-size:1.05rem;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:2rem;height:2rem;border-radius:.6rem;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 40%,var(--accent)));color:#fff;font-size:.75rem;font-weight:700;box-shadow:0 0 20px -4px var(--primary)}
.nav ul{display:flex;gap:.15rem;padding:.3rem;border-radius:999px;border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 3%,transparent)}
.nav a{display:block;padding:.4rem .9rem;border-radius:999px;font-size:.88rem;color:var(--muted);text-decoration:none;transition:color .2s ease,background-color .2s ease}
.nav a:hover{color:var(--on-dark);background:color-mix(in srgb,var(--on-dark) 8%,transparent)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.6rem;padding:.5rem 1.1rem;font-size:.92rem}
.menu>summary{background:transparent;color:var(--on-dark);border-color:var(--edge)}
.menu-panel{background:color-mix(in srgb,var(--dark) 92%,#fff);border-color:var(--edge);color:var(--on-dark)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero */
.ob-hero{position:relative;overflow:hidden;padding-top:calc(4.25rem + clamp(3.5rem,2rem + 6vw,7.5rem));text-align:center;isolation:isolate}
.ob-sky{position:absolute;inset:0;z-index:-1;pointer-events:none}
.ob-conic{position:absolute;left:50%;top:-76vmax;width:140vmax;height:140vmax;margin-left:-70vmax;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,color-mix(in srgb,var(--primary) 70%,transparent) 40deg,transparent 95deg,transparent 150deg,color-mix(in srgb,var(--accent) 55%,transparent) 200deg,transparent 250deg,color-mix(in srgb,var(--primary) 45%,transparent) 300deg,transparent 350deg);-webkit-mask-image:radial-gradient(closest-side,transparent 4%,#000 20%,rgba(0,0,0,.5) 48%,transparent 74%);mask-image:radial-gradient(closest-side,transparent 4%,#000 20%,rgba(0,0,0,.5) 48%,transparent 74%);opacity:.7;animation:obSpin 48s linear infinite}
@keyframes obSpin{to{transform:rotate(1turn)}}
.ob-grid{position:absolute;inset:0;background-image:linear-gradient(var(--edge) 1px,transparent 1px),linear-gradient(90deg,var(--edge) 1px,transparent 1px);background-size:64px 64px;background-position:center top;-webkit-mask-image:radial-gradient(70% 55% at 50% 30%,#000,transparent 75%);mask-image:radial-gradient(70% 55% at 50% 30%,#000,transparent 75%);opacity:.55}
.ob-hero-in{position:relative;display:grid;justify-items:center}
.ob-pill{display:inline-flex;align-items:center;gap:.6rem;max-width:100%;padding:.4rem 1rem .4rem .8rem;border-radius:999px;border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 5%,transparent);font-size:.9rem;color:var(--muted);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ob-dot{flex:none;width:.5rem;height:.5rem;border-radius:50%;background:var(--glow);box-shadow:0 0 12px 2px var(--primary)}
.ob-title{margin-top:1.5rem;max-width:14ch;font-size:clamp(3.2rem,1.2rem + 8.4vw,8.4rem);line-height:.95;letter-spacing:-.06em;font-weight:600;padding-bottom:.08em}
.ob-title,.ob-title .w>span{background:linear-gradient(100deg,var(--on-dark) 25%,var(--glow) 50%,var(--on-dark) 75%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:obSheen 10s ease-in-out infinite}
.ob-title.long{max-width:18ch;font-size:clamp(2.6rem,1.2rem + 5.4vw,6rem)}
@keyframes obSheen{0%,100%{background-position:100% 0}50%{background-position:0 0}}
.ob-sub{max-width:40rem;margin:1.4rem auto 0;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.55;color:var(--muted)}
.ob-ctas{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ob-ctas{width:100%}.ob-ctas .btn{flex:1 1 100%}}
.ob-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem 1.6rem;margin-top:1.4rem;font-size:.92rem;color:var(--muted)}
.ob-meta li{display:flex;align-items:center;gap:.5rem}
.ob-meta li+li::before{content:'';width:4px;height:4px;border-radius:50%;background:var(--muted);margin-left:-1rem;margin-right:.5rem;opacity:.6}
.ob-stage{--t:1;position:relative;margin-top:clamp(3rem,2rem + 4vw,5.5rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem);perspective:1600px}
.ob-horizon{position:absolute;left:50%;top:8%;width:120%;height:70%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,color-mix(in srgb,var(--primary) 55%,transparent),transparent 70%);filter:blur(10px);opacity:.6;pointer-events:none}
.ob-window{position:relative;border-radius:18px;padding:1px;background:linear-gradient(180deg,color-mix(in srgb,#fff 22%,transparent),color-mix(in srgb,#fff 4%,transparent));box-shadow:0 50px 120px -40px #000,0 0 0 1px var(--edge)}
.ob-window::before{content:'';position:absolute;inset:-1px;z-index:0;border-radius:19px;padding:1.5px;background:conic-gradient(from var(--ang),transparent 0 70%,var(--glow) 80%,var(--primary) 88%,transparent 96%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:obAng 6s linear infinite}
@keyframes obAng{to{--ang:1turn}}
html.m .ob-window{transform:rotateX(calc((1 - var(--t)) * 24deg)) scale(calc(.9 + var(--t) * .1));transform-origin:50% 100%;transition:none}
html.m .ob-window{animation:obIn 1.6s cubic-bezier(.16,1,.3,1) .45s both}
@keyframes obIn{from{opacity:0;translate:0 80px}}
.ob-chrome{position:relative;z-index:1;display:flex;align-items:center;gap:.4rem;height:2.4rem;padding:0 .9rem;border-radius:17px 17px 0 0;background:color-mix(in srgb,var(--dark) 82%,#fff);text-align:left}
.ob-chrome i{width:.65rem;height:.65rem;border-radius:50%;background:color-mix(in srgb,var(--on-dark) 22%,transparent)}
.ob-chrome span{flex:1;margin-right:2.2rem;font-size:.78rem;color:var(--muted);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ob-screen{position:relative;z-index:1;overflow:hidden;border-radius:0 0 17px 17px;aspect-ratio:16/9;background:var(--dark)}
@media (max-width:39.99rem){.ob-screen{aspect-ratio:4/3}}
.ob-screen-img{width:100%;height:100%;object-fit:cover}
/* bento */
.ob-bento{display:grid;gap:1rem}
@media (min-width:48rem){.ob-bento{grid-template-columns:repeat(2,1fr)}.ob-card-big{grid-column:1/-1}}
@media (min-width:64rem){.ob-bento{grid-template-columns:repeat(3,1fr)}.ob-card-big{grid-column:span 2;grid-row:span 2}.ob-n1 .ob-card-big,.ob-n4 .ob-card-big{grid-column:1/-1;grid-row:auto}.ob-n2{grid-template-columns:2fr 1fr}.ob-n2 .ob-card-big{grid-column:auto;grid-row:auto}.ob-n5 .ob-card:last-child,.ob-n7 .ob-card:last-child{grid-column:span 2}}
.ob-card{--spot:color-mix(in srgb,var(--primary) 26%,transparent);position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:1rem;min-height:12.5rem;padding:1.6rem;border-radius:var(--radius);background:linear-gradient(180deg,color-mix(in srgb,var(--on-dark) 6%,transparent),color-mix(in srgb,var(--on-dark) 2%,transparent));border:1px solid var(--edge);overflow:hidden;transition:border-color .4s ease,transform .5s cubic-bezier(.2,.8,.2,1)}
.ob-card:hover{border-color:color-mix(in srgb,var(--primary) 55%,transparent)}
html.m .ob-card.in:hover,.ob-card:hover{transform:translateY(-3px)}
.ob-glyph{position:absolute;top:1.5rem;left:1.6rem;display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:.8rem;border:1px solid var(--edge);background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--primary-on-dark);box-shadow:0 0 24px -8px var(--primary)}
.ob-card-t{position:relative;font-family:var(--font-display);font-size:1.18rem;font-weight:500;line-height:1.35;letter-spacing:-.02em;color:var(--on-dark)}
.ob-card-big{min-height:22rem}
@media (max-width:47.99rem){.ob-card:not(.ob-card-big){min-height:0;flex-direction:row;align-items:center;padding:1.15rem 1.25rem}.ob-card:not(.ob-card-big) .ob-glyph{position:static;flex:none}.ob-card-t{font-size:1.05rem}}
.ob-card-big .ob-card-t{max-width:26rem;font-size:clamp(1.5rem,1.2rem + 1.2vw,2.2rem);line-height:1.15;font-weight:600}
.ob-orbit{position:absolute;right:-12%;top:-30%;width:min(34rem,90%);aspect-ratio:1;pointer-events:none}
@media (max-width:47.99rem){.ob-orbit{right:-30%;top:-24%;width:120%}}
.ob-ring{position:absolute;inset:0;margin:auto;border-radius:50%;border:1px solid color-mix(in srgb,var(--on-dark) 14%,transparent);animation:obSpin var(--sp,24s) linear infinite}
.ob-ring.r1{width:38%;height:38%;--sp:14s}
.ob-ring.r2{width:66%;height:66%;--sp:26s;animation-direction:reverse}
.ob-ring.r3{width:94%;height:94%;--sp:40s}
.ob-ring i{position:absolute;top:-5px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--glow);box-shadow:0 0 16px 4px var(--primary)}
.ob-ring.r2 i{background:var(--accent);box-shadow:0 0 16px 4px var(--accent);width:8px;height:8px}
.ob-core{position:absolute;inset:0;margin:auto;width:16%;height:16%;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,var(--primary) 45%,transparent 72%);box-shadow:0 0 60px 20px color-mix(in srgb,var(--primary) 40%,transparent)}
/* how it works */
.ob-steps{position:relative;display:grid;gap:2.2rem;padding-left:3.4rem}
.ob-track{position:absolute;left:1.15rem;top:.6rem;bottom:.6rem;width:2px;border-radius:2px;background:var(--edge);overflow:hidden}
.ob-fill{position:absolute;inset:0;transform-origin:50% 0;transform:scaleY(var(--h,1));background:linear-gradient(180deg,var(--primary-on-dark),var(--accent));box-shadow:0 0 16px var(--primary)}
.ob-step{position:relative}
.ob-step-n{position:absolute;left:-3.4rem;top:-.2rem;display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;background:var(--dark);border:1px solid var(--edge);font-family:var(--font-display);font-weight:600;color:var(--muted);transition:color .4s ease,border-color .4s ease,box-shadow .4s ease,background-color .4s ease}
.ob-step.on .ob-step-n,html:not(.m) .ob-step-n{color:#fff;border-color:var(--primary-on-dark);background:var(--primary);box-shadow:0 0 0 6px color-mix(in srgb,var(--primary) 18%,transparent),0 0 30px var(--primary)}
.ob-step h3{font-size:1.3rem}
.ob-step p{margin-top:.5rem;color:var(--muted);max-width:30rem}
@media (min-width:56rem){.ob-steps{grid-template-columns:repeat(var(--n),1fr);gap:2rem;padding-left:0;padding-top:4.2rem}.ob-track{left:0;right:0;top:1.2rem;bottom:auto;width:auto;height:2px}.ob-fill{transform-origin:0 50%;transform:scaleX(var(--h,1))}.ob-step-n{left:0;top:-4.2rem}}
html:not(.m) .ob-fill{transform:none}
/* pricing */
.ob-plans{display:grid;gap:1rem;justify-content:center}
@media (min-width:48rem){.ob-p2{grid-template-columns:repeat(2,minmax(0,22rem))}.ob-p3,.ob-p4{grid-template-columns:repeat(2,1fr)}}
@media (min-width:64rem){.ob-p3{grid-template-columns:repeat(3,1fr)}.ob-p4{grid-template-columns:repeat(4,1fr)}}
.ob-p1{grid-template-columns:minmax(0,26rem)}
.ob-plan{--spot:color-mix(in srgb,var(--primary) 24%,transparent);display:flex;flex-direction:column;gap:.9rem;padding:1.9rem;border-radius:var(--radius);border:1px solid var(--edge);background:linear-gradient(180deg,color-mix(in srgb,var(--on-dark) 6%,transparent),transparent)}
.ob-plan h3{font-size:1.1rem;font-weight:500;color:var(--muted);letter-spacing:-.01em}
.ob-price{display:flex;align-items:baseline;gap:.4rem}
.ob-num{font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,3.4rem);font-weight:600;letter-spacing:-.05em;line-height:1}
.ob-price small{color:var(--muted);font-size:1rem}
.ob-plan-b{display:flex;gap:.4rem;align-items:center;color:var(--muted)}
.ob-plan .btn{margin-top:auto}
.ob-note{display:flex;justify-content:center;align-items:center;gap:.5rem;margin-top:1.6rem;color:var(--muted);text-align:center}
.ob-about-in{max-width:52rem}
.ob-about-p{margin-top:1rem;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.6vw,2.4rem);line-height:1.25;letter-spacing:-.03em}
.ob-about-p.more{font-size:clamp(1.1rem,1rem + .4vw,1.3rem);color:var(--muted);font-family:var(--font-body);letter-spacing:0}
/* faq */
.ob-faq{display:grid;gap:2rem}
@media (min-width:60rem){.ob-faq{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.ob-faq-more{margin-top:1rem;color:var(--muted)}
.ob-faq-more a{color:var(--on-dark);font-weight:600}
.faq details{border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 3%,transparent)}
.faq details[open]{border-color:color-mix(in srgb,var(--primary) 50%,transparent);background:color-mix(in srgb,var(--primary) 7%,transparent)}
/* end */
.ob-end-box{position:relative;overflow:hidden;padding:clamp(3rem,2rem + 5vw,6.5rem) clamp(1.25rem,1rem + 3vw,4rem);border-radius:calc(var(--radius) + 10px);border:1px solid var(--edge);text-align:center;background:color-mix(in srgb,var(--on-dark) 3%,transparent);isolation:isolate}
.ob-end-glow{position:absolute;left:50%;bottom:-70%;z-index:-1;width:140%;aspect-ratio:2;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 60%,transparent),transparent);opacity:.8}
.ob-end-box .ob-h2{margin:0 auto;max-width:18ch}
.ob-form{max-width:30rem;margin:2rem auto 0;text-align:left}
.field input,.field select,.field textarea{background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));border-color:var(--edge)}
.ftr{border-top:1px solid var(--edge)}
.mbar{background:color-mix(in srgb,var(--dark) 85%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-top-color:var(--edge)}
.mbar .btn-ghost{color:var(--on-dark)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Orbit',
  bestFor: 'Software, apps, templates and other digital products sold online, with plans',
  why: 'Built for software and digital products: a dark glowing hero with a slowly turning light, a product window that tilts flat as you scroll, a bento grid of features, a how-it-works line and clear plans.',
  fonts: { q: 'family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600', display: ['Sora', 'grotesk'], body: ['Inter', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
