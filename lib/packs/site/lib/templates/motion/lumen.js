// Lumen (animated, product, for software and digital products): the light lives inside the type. On a near-black page
// the headline is typed out letter by letter (a notes app writing itself), and its letters are windows onto a small
// hand-written WebGL shader: a slow, domain-warped field of the member's two colors that drifts and leans toward the
// pointer. Nothing glows behind the hero. The shader starts after the page has loaded, draws only the headline's box
// at half resolution (device pixel ratio capped at 2), stops while the headline is off screen or motion is paused, and
// phones, reduced motion and browsers without WebGL see the letters filled with a plain CSS gradient of the same two
// colors. Below, the features are pinned and step through one by one, light sweeping through each headline as you
// scroll (unpinned on phones), then the steps or plans as a roadmap that draws itself in with the scroll, the story,
// questions and one button. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { roadmap, ROADMAP_CSS } = require('../roadmap');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'lumen';

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.06), '#060607', 0.9) };
}

function product(c) {
  return c.productName || c.name;
}

function slots() {
  return [];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low && low.price === 0) return 'Has a free plan';
  if (low) return c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText;
  return c.priceText || '';
}

function nav(c) {
  return [
    c.included.length && { label: 'Features', href: '#features' },
    c.services.filter((s) => s.priceText).length > 1 && { label: 'Pricing', href: '#pricing' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    c.buy ? { label: 'Get started', href: '#start' } : { label: 'Waitlist', href: '#signup' },
  ].filter(Boolean);
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const title = c.tagline ? c.tagline.replace(/[.!]+$/, '') : c.heroTitle;
  const sub = c.tagline ? (c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.heroSub) : '';
  const beats = c.included.slice(0, 3);
  const more = c.included.slice(3);
  const two = (i) => String(i + 1).padStart(2, '0');

  const hero = `<section class="lm-hero" aria-labelledby="hero-title">
<div class="wrap lm-hero-in">
<p class="lm-pill" data-ci="then"><span class="lm-dot" aria-hidden="true"></span>${esc(name)}</p>
<div class="lm-type" data-alive="0.35"><div class="lm-fb" aria-hidden="true"></div><canvas class="lm-gl" aria-hidden="true"></canvas><h1 class="lm-h1" id="hero-title" data-ci="head">${esc(title)}</h1></div>
${sub ? `<p class="lm-sub" data-ci="then">${esc(sub)}</p>` : ''}
<div class="lm-ctas" data-ci="then">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}${price ? `<span class="lm-from">${esc(price)}</span>` : ''}</div>
</div>
</section>`;

  const features = beats.length
    ? `<section class="lm-beats" id="features" aria-label="Features" data-sc><div class="lm-stage" data-sc-stage><ol class="wrap lm-beat-list">
${beats
  .map(
    (x, i) => `<li class="lm-beat" data-sc-part>
<p class="lm-glass"><b>${two(i)}</b><span aria-hidden="true">/</span><span>${two(beats.length - 1)}</span></p>
<h2 class="lm-h2">${esc(x)}</h2>
</li>`
  )
  .join('\n')}
</ol></div>
${more.length ? `<div class="wrap lm-more"><ul>${more.map((x, i) => `<li class="lm-glass" data-rv style="--d:${i}"><b>${two(i + 3)}</b>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</section>`
    : '';

  // A roadmap that draws itself in with the scroll, ending at the button: the member's steps when given, else their
  // plans in order (name, price, what it includes).
  const plans = c.services.filter((s) => s.name && s.priceText);
  const fromSteps = c.steps.length >= 2;
  const path = roadmap({ id: fromSteps ? 'how' : 'pricing', cls: 'lm-road', eyebrow: fromSteps ? 'How it works' : 'Pricing', title: fromSteps ? 'How it works.' : 'Pick a plan.', nodes: fromSteps ? c.steps.map((s) => ({ title: s.title, sub: s.body })) : plans.map((s) => ({ title: s.name, meta: s.priceText, sub: s.blurb || '' })), end: mag(P.button(buy, 'btn btn-primary lm-btn')), endLabel: name });
  const pricing = plans.length > 1 && (fromSteps || !path)
    ? `<section class="lm-sec" id="pricing" aria-labelledby="pricing-title"><div class="wrap"><p class="lm-kick" data-rv>Pricing</p><h2 class="lm-h2 sm" id="pricing-title" data-split>Pick a plan.</h2>
<ul class="lm-plans">${plans.map((s, i) => `<li class="lm-card" data-spot data-rv="scale" style="--d:${i}"><h3>${esc(s.name)}</h3><p class="lm-price">${esc(s.priceText)}</p>${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${c.buy ? P.button(buy, 'btn lm-btn-ghost') : ''}</li>`).join('')}</ul></div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="lm-sec" aria-labelledby="about-title"><div class="wrap lm-narrow"><p class="lm-kick" data-rv id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${name}`)}</p>${c.aboutParas.map((p, i) => `<p class="lm-say" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="lm-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="lm-kick" data-rv>Reviews</p><h2 class="sr-only" id="reviews-title">Reviews</h2><div data-rv>${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="lm-sec" id="faq" aria-labelledby="faq-title"><div class="wrap lm-faq"><div data-rv><p class="lm-kick">FAQ</p><h2 class="lm-h2 sm" id="faq-title">Questions.</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const end = `<section class="lm-sec lm-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title"><div class="wrap lm-end-in">
<h2 class="lm-h2" id="end-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lm-sub" data-rv style="--d:3">${esc(c.ctaSub)}${waitlist && c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist ? `<div class="lm-form" data-rv style="--d:4">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `<div class="lm-ctas" data-rv style="--d:4">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}</div>`}
</div></section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'lm-hdr', ctaCls: 'btn btn-primary btn-sm lm-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, path, pricing, about, reviews, faq, end, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', radiusSm: '14px', btnRadius: '999px', max: '74rem' } };
}

// The light inside the headline. A fragment shader of domain-warped noise (fbm of fbm) mixing the page's --primary and
// --accent into --dark, its center easing toward the pointer, drawn on a canvas the size of the headline's box (the
// headline sits over it with mix-blend-mode darken: its dark background hides the canvas, its white letters show it).
// WebGL 1, no library. Reduced motion: it never runs and the letters keep the CSS gradient.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,h=d.documentElement;
var hero=d.querySelector('.lm-type'),cv=d.querySelector('.lm-gl');if(!hero||!cv||innerWidth<768)return;
function start(){var gl=cv.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'});if(!gl)return;
var VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
var FS='precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 a,b,k;'+
'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}'+
'float fb(vec2 p){float s=0.,w=.5;for(int i=0;i<5;i++){s+=w*n(p);p=p*2.02+vec2(1.7,9.2);w*=.5;}return s;}'+
'void main(){vec2 p=(gl_FragCoord.xy-.5*r)/r.y;vec2 c=(m-.5)*vec2(r.x/r.y,1.)*.5;vec2 q=p-c*.6;'+
'vec2 u=vec2(fb(q*1.5+t*.03),fb(q*1.5+vec2(5.2,1.3)-t*.024));vec2 w=vec2(fb(q*1.5+2.*u+vec2(1.7,9.2)+t*.018),fb(q*1.5+2.*u+vec2(8.3,2.8)-t*.02));float f=fb(q*1.3+2.3*w);'+
'vec3 col=mix(a,b,clamp(length(w)*1.2-.45,0.,1.));float g=.35+.65*smoothstep(.15,.9,f);'+
'gl_FragColor=vec4(mix(mix(k,vec3(1.),.35),col*1.15,clamp(g,0.,1.)),1.);}';
function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);var loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
var U={};['r','t','m','a','b','k'].forEach(function(x){U[x]=gl.getUniformLocation(pr,x)});
var cs=getComputedStyle(h);function rgb(v){var x=cs.getPropertyValue(v).trim().replace('#','');if(x.length===3)x=x.replace(/./g,'$&$&');var n=parseInt(x,16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
gl.uniform3fv(U.a,rgb('--primary'));gl.uniform3fv(U.b,rgb('--accent'));gl.uniform3fv(U.k,rgb('--dark'));
function fit(){var s=Math.min(devicePixelRatio||1,2)*.5;cv.width=Math.max(1,Math.round(cv.clientWidth*s));cv.height=Math.max(1,Math.round(cv.clientHeight*s));gl.viewport(0,0,cv.width,cv.height);gl.uniform2f(U.r,cv.width,cv.height)}
fit();addEventListener('resize',fit);
var mx=.5,my=.5,tx=.5,ty=.5,vis=true,raf=0,t0=performance.now();
addEventListener('pointermove',function(e){tx=e.clientX/innerWidth;ty=1-e.clientY/innerHeight});
function go(){if(!raf&&vis&&!d.hidden&&!h.classList.contains('mp'))raf=requestAnimationFrame(draw)}
function draw(now){raf=0;mx+=(tx-mx)*.03;my+=(ty-my)*.03;gl.uniform1f(U.t,(now-t0)/1000);gl.uniform2f(U.m,mx,my);gl.drawArrays(gl.TRIANGLES,0,3);hero.classList.add('gl');go()}
new IntersectionObserver(function(es){vis=es[0].isIntersecting;go()}).observe(hero);
d.addEventListener('visibilitychange',go);new MutationObserver(go).observe(h,{attributes:true,attributeFilter:['class']});go()}
var later=function(){setTimeout(start,150)};if(d.readyState==='complete')later();else addEventListener('load',later)})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
.lm-road{--rm-accent:var(--primary-on-dark);--rm-dot-bg:var(--dark)}
.lm-road .eyebrow{font-size:.9rem;font-weight:500;letter-spacing:0;text-transform:none;color:var(--primary-text)}
.lm-road .h2{font-size:clamp(2.2rem,1.5rem + 3vw,4.2rem);letter-spacing:-.05em}
.lm-road .rm-meta{font-size:1.6rem;font-weight:600;letter-spacing:-.04em;color:var(--on-dark)}
.lm-road .rm-end .rm-dot{background:var(--on-dark);border-color:var(--on-dark)}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 12%,transparent);background:var(--dark);color:var(--on-dark);letter-spacing:-.011em}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.lm-btn{background:var(--on-dark);color:var(--dark);box-shadow:none}
.lm-btn:hover{background:#fff;color:var(--dark)}
.lm-btn-ghost{margin-top:auto;border:1px solid var(--edge);color:var(--on-dark);background:color-mix(in srgb,var(--on-dark) 4%,transparent)}
.lm-btn-ghost:hover{border-color:var(--on-dark)}
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;transition:background-color .3s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--dark) 70%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{display:flex;align-items:center;gap:.55rem;margin-right:auto;font-weight:600;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:1.9rem;height:1.9rem;border-radius:.6rem;border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 6%,transparent);font-size:.7rem}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.86rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--on-dark)}
.menu>summary{background:transparent;border-color:var(--edge);color:var(--on-dark)}
.menu-panel{background:var(--dark);border-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lm-kick{font-size:.9rem;font-weight:500;color:var(--primary-text)}
.lm-h2{background:linear-gradient(180deg,#fff 20%,color-mix(in srgb,var(--on-dark) 55%,var(--dark)) 110%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:.06em}
.lm-h2 .w>span{background:linear-gradient(180deg,#fff 30%,color-mix(in srgb,var(--on-dark) 62%,var(--dark)) 130%);-webkit-background-clip:text;background-clip:text;color:transparent}
.lm-type{position:relative;isolation:isolate;margin-inline:auto;max-width:16ch;font-size:clamp(3rem,1.2rem + 7vw,7.6rem)}
.lm-h1{position:relative;z-index:1;padding:.04em .06em .1em;background:var(--dark);color:#fff;mix-blend-mode:darken;font-size:clamp(3rem,1.2rem + 7vw,7.6rem);line-height:.95;letter-spacing:-.055em;text-wrap:balance}
.lm-h2{font-size:clamp(2.4rem,1.4rem + 4.6vw,6rem);line-height:1;letter-spacing:-.05em;text-wrap:balance}
.lm-h2.sm{margin-top:.5rem;font-size:clamp(2.2rem,1.5rem + 3vw,4.2rem)}
.lm-sub{max-width:34rem;margin-top:1.4rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.lm-ctas{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.8rem 1.4rem;margin-top:2.2rem}
.lm-from{color:var(--muted)}
/* hero light: CSS by default, the shader once it has drawn */
.lm-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;align-items:center;min-height:100vh;min-height:100svh;padding-block:6rem 4rem;text-align:center}
.lm-hero-in{display:grid;justify-items:center}
.lm-fb,.lm-gl{position:absolute;inset:0;z-index:0;width:100%;height:100%}
.lm-fb{background:linear-gradient(105deg,color-mix(in srgb,var(--primary-on-dark) 80%,#fff) 0%,var(--primary-on-dark) 38%,color-mix(in srgb,var(--accent) 85%,#fff) 100%)}
.lm-gl{opacity:0;transition:opacity 1.2s ease}
.lm-type.gl .lm-gl{opacity:1}
.lm-pill,.lm-glass{display:inline-flex;align-items:center;gap:.6rem;padding:.55rem 1.1rem;border-radius:999px;background:color-mix(in srgb,var(--on-dark) 7%,transparent);border:1px solid var(--edge);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 18%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);font-size:.9rem;font-weight:500}
.lm-pill{margin-bottom:1.6rem}
.lm-dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--accent)}
/* feature beats: stacked (phones, no script), pinned and stepped one by one on a desktop; light sweeps through each */
.lm-beat-list{display:grid;gap:clamp(4rem,3rem + 6vw,8rem);padding-block:clamp(4rem,3rem + 5vw,8rem)}
.lm-beat{display:grid;justify-items:center;gap:1.6rem;text-align:center}
.lm-beat .lm-h2{max-width:18ch;background:linear-gradient(100deg,#fff 0 40%,var(--primary-on-dark) 50%,var(--muted) 60% 100%);background-size:260% 100%;background-position:calc((1 - var(--pi,1)) * 100%) 0;-webkit-background-clip:text;background-clip:text}
.lm-glass b{font-variant-numeric:tabular-nums}
.lm-glass span{color:var(--muted)}
@media (min-width:48rem) and (hover:hover){
html.m .lm-stage{display:grid;align-items:center}
html.m .lm-beat-list{grid-template:1fr/1fr;padding-block:0}
html.m .lm-beat{grid-area:1/1;opacity:0;transform:translateY(3rem) scale(.97);transition:opacity .6s ease,transform .9s cubic-bezier(.16,1,.3,1)}
html.m .lm-beat.on:not(.cur){transform:translateY(-3rem) scale(.97)}
html.m .lm-beat.cur{opacity:1;transform:none}
}
.lm-more ul{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem;padding-block:2rem 4rem}
/* cards */
.lm-sec{position:relative;padding-block:clamp(5rem,3.5rem + 5vw,9rem)}
.lm-card{--spot:color-mix(in srgb,var(--primary) 26%,transparent);display:flex;flex-direction:column;gap:.7rem;padding:1.8rem;border-radius:var(--radius);border:1px solid var(--edge);background:linear-gradient(180deg,color-mix(in srgb,var(--on-dark) 6%,transparent),color-mix(in srgb,var(--on-dark) 2%,transparent));box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 12%,transparent)}
.lm-card b{font-size:.8rem;color:var(--primary-text)}
.lm-card p{color:var(--muted)}
.lm-steps,.lm-plans{display:grid;gap:1rem;margin-top:2.5rem}
@media (min-width:48rem){.lm-steps{grid-template-columns:repeat(3,1fr)}.lm-plans{grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))}}
.lm-plans h3{font-size:1.1rem;font-weight:500;color:var(--muted);letter-spacing:-.01em}
.lm-card .lm-price{font-size:clamp(2.2rem,1.8rem + 1.6vw,3.2rem);font-weight:600;letter-spacing:-.05em;color:var(--on-dark);line-height:1.05}
.lm-narrow{max-width:50rem}
.lm-say{margin-top:1rem;font-size:clamp(1.5rem,1.1rem + 1.6vw,2.4rem);font-weight:500;line-height:1.25;letter-spacing:-.035em}
.lm-faq{display:grid;gap:2rem}
@media (min-width:60rem){.lm-faq{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.faq details{border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 3%,transparent)}
.lm-end{overflow:hidden;text-align:center;isolation:isolate}
.lm-end-in{display:grid;justify-items:center}
.lm-form{width:min(100%,28rem);margin-top:2rem;text-align:left}
.field input,.field select,.field textarea{background:color-mix(in srgb,var(--on-dark) 6%,var(--dark));border-color:var(--edge)}
.form .btn-primary{background:var(--on-dark);color:var(--dark)}
.ftr{border-top:1px solid var(--edge)}
.mbar{background:color-mix(in srgb,var(--dark) 85%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-top-color:var(--edge)}
.mbar .btn-primary{background:var(--on-dark);color:var(--dark)}
.mbar .btn-ghost{color:var(--on-dark)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Lumen',
  bestFor: 'An app, an AI tool or another digital product with a clear promise and one button',
  // The motion, as data (lib/choreo.md): written out like notes, light that leans your way, features taking turns.
  choreo: { intro: 'type', alive: ['drift', 'pointer'], scroll: 'pin', pace: 'medium', look: 'dark, quiet, the light is the type' },
  match: /\b(ai|a\.i\.|gpt|llm|machine learning|beta|chrome extension|browser extension)\b/,
  why: 'Built for a digital product where the light lives in the type: your headline types itself out, its letters filled with a slow moving field of your two colors that leans toward the cursor, then each feature takes its turn as light sweeps through it, glass cards and one button.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
