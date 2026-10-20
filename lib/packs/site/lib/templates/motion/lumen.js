// Lumen (animated, product, for software and digital products): the light lives inside the type, nowhere else.
//   Object:   the product's promise, set as one big line of type that writes itself (a notes app writing its notes).
//   Material: light and night: a near-black page; the headline's letters are windows onto a slow field of the member's
//             two colours (a small hand-written WebGL shader). Everything else is plain white type and hairlines.
//   One move: the headline is typed out letter by letter, and the light comes up inside the letters as it lands.
//   Pop:      the light itself, in the hero's letters and nowhere else (the one gradient on the page); below, plain
//             white type, the roadmap's line in the member's colour. No pills, no glass, no glow behind anything.
// The shader starts after load, draws only the headline's box at half resolution (device pixel ratio capped at 2),
// stops off screen and on Pause motion; phones, reduced motion and no WebGL get the letters filled with a plain CSS
// gradient of the same two colours. Sections: hero (left, big), the features pinned and taking turns (unpinned on
// phones), the plans as a roadmap into the button, the member's story, questions, and the name with one button.
// Its motion is the `choreo` block.

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
<p class="lm-name" data-ci="then"><span>${esc(name)}</span>${c.whatShort && c.whatShort !== name ? `<span>${esc(c.whatShort)}</span>` : ''}</p>
<div class="lm-type" data-alive="0.35"><div class="lm-fb" aria-hidden="true"></div><canvas class="lm-gl" aria-hidden="true"></canvas><h1 class="lm-h1" id="hero-title" data-ci="head">${esc(title)}</h1></div>
<div class="lm-row">
${sub ? `<p class="lm-sub" data-ci="then">${esc(sub)}</p>` : ''}
<div class="lm-ctas" data-ci="then">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}${price ? `<span class="lm-from">${esc(price)}</span>` : ''}</div>
</div>
</div>
</section>`;

  const features = beats.length
    ? `<section class="lm-beats" id="features" aria-labelledby="features-title" data-sc><h2 class="sr-only" id="features-title">What ${esc(name)} does</h2><div class="lm-stage" data-sc-stage><ol class="wrap lm-beat-list">
${beats
  .map(
    (x, i) => `<li class="lm-beat" data-sc-part>
<p class="lm-count" aria-hidden="true"><b>${two(i)}</b> / ${two(beats.length - 1)}</p>
<h3 class="lm-h2">${esc(x)}</h3>
</li>`
  )
  .join('\n')}
</ol></div>
${more.length ? `<div class="wrap lm-more"><ul>${more.map((x, i) => `<li><b aria-hidden="true">${two(i + 3)}</b>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</section>`
    : '';

  // A roadmap that draws itself in with the scroll, ending at the button: the member's steps when given, else their
  // plans in order (name, price, what it includes).
  const plans = c.services.filter((s) => s.name && s.priceText);
  const fromSteps = c.steps.length >= 2;
  const free = plans.some((s) => s.price === 0);
  const path = roadmap({ id: fromSteps ? 'how' : 'pricing', cls: 'lm-road', title: fromSteps ? 'How it works.' : free ? 'Start free.' : 'Plans.', nodes: fromSteps ? c.steps.map((s) => ({ title: s.title, sub: s.body })) : plans.map((s) => ({ title: s.name, meta: s.priceText, sub: s.blurb || '' })), end: mag(P.button(buy, 'btn btn-primary lm-btn')), endLabel: name });
  const pricing = plans.length > 1 && (fromSteps || !path)
    ? `<section class="lm-sec" id="pricing" aria-labelledby="pricing-title"><div class="wrap"><h2 class="lm-h2 sm" id="pricing-title">${free ? 'Start free.' : 'Plans.'}</h2>
<ul class="lm-plans">${plans.map((s) => `<li><h3>${esc(s.name)}</h3><p class="lm-price">${esc(s.priceText)}</p>${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}</li>`).join('')}</ul></div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="lm-sec lm-about" aria-labelledby="about-title"><div class="wrap lm-about-in"><h2 class="lm-side" id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${name}`)}</h2><div>${c.aboutParas.map((p, i) => `<p class="lm-say${i ? ' more' : ''}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="lm-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="lm-h2 sm" id="reviews-title">What people say</h2><div class="lm-rv">${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="lm-sec lm-faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap lm-faq"><h2 class="lm-h2 sm" id="faq-title">Questions.</h2>${P.faq(c.faq)}</div></section>` : '';

  const end = `<section class="lm-sec lm-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title"><div class="wrap lm-end-in">
<h2 class="lm-end-t" id="end-title">${esc(waitlist ? c.ctaTitle : name)}</h2>
<div class="lm-end-side">
${waitlist && c.ctaSub ? `<p class="lm-sub">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist ? `<div class="lm-form">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `<div class="lm-ctas">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}${price ? `<span class="lm-from">${esc(price)}</span>` : ''}</div>${c.email ? `<p class="lm-mail"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}`}
</div>
</div></section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'lm-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm lm-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, path, pricing, about, reviews, faq, end, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '4px', btnRadius: '4px', max: '80rem' } };
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
.btn-primary{box-shadow:none}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.lm-btn{background:var(--on-dark);color:var(--dark);box-shadow:none;font-weight:600}
.lm-btn:hover{background:#fff;color:var(--dark)}
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;transition:background-color .3s ease}
.hdr{border-bottom:1px solid transparent}.hdr.scrolled{background:var(--dark);border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-weight:700;font-size:1.05rem;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:.5rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.86rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--on-dark)}
.menu>summary{background:transparent;border-color:var(--edge);color:var(--on-dark)}
.menu-panel{background:var(--dark);border-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lm-type{position:relative;isolation:isolate;max-width:13ch;margin-left:-.04em;font-size:clamp(3.1rem,.6rem + 9.2vw,10.4rem)}
.lm-h1{position:relative;z-index:1;padding:.04em .06em .1em;background:var(--dark);color:#fff;mix-blend-mode:darken;font-size:inherit;line-height:.93;letter-spacing:-.058em;text-wrap:balance}
.lm-h2{font-size:clamp(2.4rem,1.4rem + 4.6vw,6rem);line-height:.98;letter-spacing:-.05em;text-wrap:balance;color:var(--on-dark)}
.lm-h2.sm{font-size:clamp(2.2rem,1.5rem + 3vw,4.2rem)}
.lm-sub{max-width:30rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.lm-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.4rem}
.lm-from{color:var(--muted);font-variant-numeric:tabular-nums}
/* hero: left, big; the light is CSS by default and the shader once it has drawn */
.lm-hero{position:relative;overflow:hidden;display:grid;align-items:end;min-height:100vh;min-height:100svh;padding-block:7rem clamp(3rem,2rem + 4vw,6rem)}
@media (max-width:47.99rem){.lm-hero{align-items:start;min-height:0;padding-top:6.5rem}}
.lm-name{display:flex;flex-wrap:wrap;gap:.2rem 1rem;margin-bottom:clamp(1.4rem,1rem + 1.5vw,2.6rem);font-size:.95rem;color:var(--muted)}
.lm-name span:first-child{color:var(--on-dark);font-weight:600}
.lm-row{display:grid;gap:1.6rem;margin-top:clamp(1.6rem,1rem + 2vw,3rem);padding-top:1.4rem;border-top:1px solid var(--edge)}
@media (min-width:56rem){.lm-row{grid-template-columns:minmax(0,1fr) auto;align-items:center}.lm-row .lm-ctas:only-child{grid-column:2}}
.lm-fb,.lm-gl{position:absolute;inset:0;z-index:0;width:100%;height:100%}
.lm-fb{background:linear-gradient(105deg,color-mix(in srgb,var(--primary-on-dark) 80%,#fff) 0%,var(--primary-on-dark) 38%,color-mix(in srgb,var(--accent) 85%,#fff) 100%)}
.lm-gl{opacity:0;transition:opacity 1.2s ease}
.lm-type.gl .lm-gl{opacity:1}
/* feature beats: stacked (phones, no script), pinned and stepped one by one on a desktop */
.lm-beats{border-top:1px solid var(--edge)}
.lm-beat-list{display:grid;gap:clamp(3rem,2rem + 5vw,6rem);padding-block:clamp(4rem,3rem + 5vw,8rem)}
.lm-beat{display:grid;gap:1.2rem;justify-items:start}
.lm-count{font-size:.95rem;color:var(--muted);font-variant-numeric:tabular-nums}
.lm-count b{color:var(--on-dark);font-weight:600}
.lm-beat .lm-h2{max-width:17ch}
@media (min-width:48rem) and (hover:hover){
html.m .lm-stage{display:grid;align-items:center}
html.m .lm-beat-list{grid-template:1fr/1fr;padding-block:0}
html.m .lm-beat{grid-area:1/1;opacity:0;transform:translateY(3rem);transition:opacity .6s ease,transform .9s cubic-bezier(.16,1,.3,1)}
html.m .lm-beat.on:not(.cur){transform:translateY(-3rem)}
html.m .lm-beat.cur{opacity:1;transform:none}
}
.lm-more ul{display:grid;padding-bottom:4rem;border-top:1px solid var(--edge)}
.lm-more li{display:grid;grid-template-columns:3rem minmax(0,1fr);gap:1rem;padding-block:1.1rem;border-bottom:1px solid var(--edge);font-size:clamp(1.15rem,1rem + .5vw,1.4rem);letter-spacing:-.02em}
.lm-more b{font-size:.9rem;font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:.2rem}
/* sections */
.lm-sec{position:relative;padding-block:clamp(5rem,3.5rem + 5vw,9rem);border-top:1px solid var(--edge)}
.lm-road{--rm-line:var(--edge)}
.lm-road .rm-dot{border-radius:3px;border-width:1.5px}
.lm-plans{display:grid;margin-top:2.5rem;border-top:1px solid var(--on-dark)}
.lm-plans li{display:grid;gap:.3rem;padding-block:1.4rem;border-bottom:1px solid var(--edge)}
@media (min-width:48rem){.lm-plans li{grid-template-columns:1fr 1fr 2fr;align-items:baseline}}
.lm-plans h3{font-size:1.3rem}
.lm-price{font-size:1.6rem;font-weight:600;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.lm-plans p{color:var(--muted)}
.lm-about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.lm-about-in{grid-template-columns:3fr 9fr}}
.lm-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:-.01em;color:var(--muted)}
.lm-say{font-size:clamp(1.6rem,1.1rem + 2vw,3rem);font-weight:500;line-height:1.14;letter-spacing:-.04em;max-width:28ch}
.lm-say.more{margin-top:1.4rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.4;color:var(--muted);max-width:40ch}
.lm-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--on-dark);padding:1.4rem 0 0}
.lm-faq{display:grid;gap:2rem}
@media (min-width:60rem){.lm-faq{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.faq{gap:0;border-top:1px solid var(--on-dark)}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq details[open]{border-color:var(--edge)}
.faq summary{padding:1.25rem 0;font-size:1.15rem;letter-spacing:-.02em}
.faq summary .i{color:var(--on-dark)}
.faq .ans{padding:0 0 1.3rem}
.lm-end{padding-bottom:clamp(4rem,3rem + 4vw,7rem)}
.lm-end-in{display:grid;gap:2rem;align-items:end}
@media (min-width:60rem){.lm-end-in{grid-template-columns:minmax(0,1fr) auto}}
.lm-end-t{font-size:clamp(3.4rem,1rem + 10vw,11rem);line-height:.86;letter-spacing:-.065em}
.lm-end-side{display:grid;gap:1.2rem;justify-items:start}
.lm-mail a{color:var(--muted);text-decoration-color:var(--edge)}
.lm-mail a:hover{color:var(--on-dark)}
.lm-form{width:min(100%,28rem)}
.field input,.field select,.field textarea{background:color-mix(in srgb,var(--on-dark) 6%,var(--dark));border-color:var(--edge)}
.form .btn-primary{background:var(--on-dark);color:var(--dark)}
.ftr{border-top:1px solid var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none}
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
  why: 'Built for a digital product where the light lives in the type: your headline types itself out, its letters filled with a slow moving field of your two colors that leans toward the cursor, then each feature takes its turn on a quiet dark stage, the plans as a line into one button.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
