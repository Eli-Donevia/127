// Lumen (animated, product, for software and digital products): light is the only decoration. A near-black page where a
// small hand-written WebGL shader paints a slow, domain-warped field of the member's two colors fading to black behind
// the hero, leaning toward the pointer. It starts after the page has loaded, draws at half resolution (device pixel
// ratio capped at 2), stops while the hero is off screen or motion is paused, and phones, reduced motion and browsers
// without WebGL get a soft CSS gradient instead. Below, each feature gets a pinned beat where a beam of light narrows
// behind its headline and a glass pill counts it off, then plans, the story, questions and one button under a halo.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
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
<div class="lm-fb" aria-hidden="true"><span></span><span></span></div>
<canvas class="lm-gl" aria-hidden="true"></canvas>
<div class="wrap lm-hero-in">
<p class="lm-pill" data-rv><span class="lm-dot" aria-hidden="true"></span>${esc(name)}</p>
<h1 class="lm-h1" id="hero-title" data-split>${esc(title)}</h1>
${sub ? `<p class="lm-sub" data-rv style="--d:5">${esc(sub)}</p>` : ''}
<div class="lm-ctas" data-rv style="--d:7">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}${price ? `<span class="lm-from">${esc(price)}</span>` : ''}</div>
</div>
</section>`;

  const features = beats.length
    ? `<section class="lm-beats" id="features" aria-label="Features">
${beats
  .map(
    (x, i) => `<article class="lm-beat" style="--i:${i}"><div class="lm-beat-in">
<span class="lm-beam" aria-hidden="true"></span>
<p class="lm-glass" data-rv><b>${two(i)}</b><span aria-hidden="true">/</span><span>${two(beats.length - 1)}</span></p>
<h2 class="lm-h2" data-split>${esc(x)}</h2>
</div></article>`
  )
  .join('\n')}
${more.length ? `<div class="wrap lm-more"><ul>${more.map((x, i) => `<li class="lm-glass" data-rv style="--d:${i}"><b>${two(i + 3)}</b>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</section>`
    : '';

  const how = c.steps.length
    ? `<section class="lm-sec" aria-labelledby="how-title"><div class="wrap"><p class="lm-kick" data-rv>How it works</p><h2 class="lm-h2 sm" id="how-title" data-split>Three steps.</h2>
<ol class="lm-steps">${c.steps.slice(0, 3).map((s, i) => `<li class="lm-card" data-rv style="--d:${i}"><b>${two(i)}</b><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol></div></section>`
    : '';

  const plans = c.services.filter((s) => s.name && s.priceText);
  const pricing = plans.length > 1
    ? `<section class="lm-sec" id="pricing" aria-labelledby="pricing-title"><div class="wrap"><p class="lm-kick" data-rv>Pricing</p><h2 class="lm-h2 sm" id="pricing-title" data-split>Pick a plan.</h2>
<ul class="lm-plans">${plans.map((s, i) => `<li class="lm-card" data-spot data-rv="scale" style="--d:${i}"><h3>${esc(s.name)}</h3><p class="lm-price">${esc(s.priceText)}</p>${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${c.buy ? P.button(buy, 'btn lm-btn-ghost') : ''}</li>`).join('')}</ul></div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="lm-sec" aria-labelledby="about-title"><div class="wrap lm-narrow"><p class="lm-kick" data-rv id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${name}`)}</p>${c.aboutParas.map((p, i) => `<p class="lm-say" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="lm-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="lm-kick" data-rv>Reviews</p><h2 class="sr-only" id="reviews-title">Reviews</h2><div data-rv>${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="lm-sec" id="faq" aria-labelledby="faq-title"><div class="wrap lm-faq"><div data-rv><p class="lm-kick">FAQ</p><h2 class="lm-h2 sm" id="faq-title">Questions.</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const end = `<section class="lm-sec lm-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title"><span class="lm-halo" aria-hidden="true"></span><div class="wrap lm-end-in">
<h2 class="lm-h2" id="end-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lm-sub" data-rv style="--d:3">${esc(c.ctaSub)}${waitlist && c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist ? `<div class="lm-form" data-rv style="--d:4">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `<div class="lm-ctas" data-rv style="--d:4">${mag(P.button(buy, 'btn btn-primary btn-lg lm-btn'))}</div>`}
</div></section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'lm-hdr', ctaCls: 'btn btn-primary btn-sm lm-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, how, pricing, about, reviews, faq, end, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', radiusSm: '14px', btnRadius: '999px', max: '74rem' } };
}

// The light field. A fragment shader of domain-warped noise (fbm of fbm) mixing the page's --primary and --accent into
// --dark, its center easing toward the pointer. WebGL 1, no library. Also the beats' scroll progress (--k: the beam
// narrows as the beat plays). Reduced motion: none of it runs and the CSS gradient stays.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,h=d.documentElement;
var beats=[].slice.call(d.querySelectorAll('.lm-beat')),tk=false;function cl(v){return v<0?0:v>1?1:v}
function sc(){tk=false;var vh=innerHeight;beats.forEach(function(b){var r=b.getBoundingClientRect();b.style.setProperty('--k',cl((vh-r.top)/(r.height+vh)).toFixed(4))})}
addEventListener('scroll',function(){if(!tk){tk=true;requestAnimationFrame(sc)}},{passive:true});sc();
var hero=d.querySelector('.lm-hero'),cv=d.querySelector('.lm-gl');if(!hero||!cv||innerWidth<768)return;
function start(){var gl=cv.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'});if(!gl)return;
var VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
var FS='precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 a,b,k;'+
'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}'+
'float fb(vec2 p){float s=0.,w=.5;for(int i=0;i<5;i++){s+=w*n(p);p=p*2.02+vec2(1.7,9.2);w*=.5;}return s;}'+
'void main(){vec2 p=(gl_FragCoord.xy-.5*r)/r.y;vec2 c=(m-.5)*vec2(r.x/r.y,1.)*.5;vec2 q=p-c*.6;'+
'vec2 u=vec2(fb(q*1.5+t*.03),fb(q*1.5+vec2(5.2,1.3)-t*.024));vec2 w=vec2(fb(q*1.5+2.*u+vec2(1.7,9.2)+t*.018),fb(q*1.5+2.*u+vec2(8.3,2.8)-t*.02));float f=fb(q*1.3+2.3*w);'+
'vec3 col=mix(a,b,clamp(length(w)*1.2-.45,0.,1.));float g=smoothstep(.25,.95,f)*(1.-smoothstep(.15,1.15,length(p-c)));'+
'gl_FragColor=vec4(mix(k,col,clamp(g*1.25,0.,1.)),1.);}';
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
${FOOTER_CSS}${REVIEWS_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 12%,transparent);background:var(--dark);color:var(--on-dark);letter-spacing:-.011em}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.lm-btn{background:var(--on-dark);color:var(--dark);box-shadow:0 0 0 1px color-mix(in srgb,#fff 40%,transparent),0 0 40px -8px color-mix(in srgb,var(--primary-on-dark) 70%,transparent)}
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
.lm-h1,.lm-h2{background:linear-gradient(180deg,#fff 20%,color-mix(in srgb,var(--on-dark) 55%,var(--dark)) 110%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:.06em}
.lm-h1 .w>span,.lm-h2 .w>span{background:linear-gradient(180deg,#fff 30%,color-mix(in srgb,var(--on-dark) 62%,var(--dark)) 130%);-webkit-background-clip:text;background-clip:text;color:transparent}
.lm-h1{max-width:16ch;font-size:clamp(3rem,1.2rem + 7vw,7.6rem);line-height:.95;letter-spacing:-.055em;text-wrap:balance}
.lm-h2{font-size:clamp(2.4rem,1.4rem + 4.6vw,6rem);line-height:1;letter-spacing:-.05em;text-wrap:balance}
.lm-h2.sm{margin-top:.5rem;font-size:clamp(2.2rem,1.5rem + 3vw,4.2rem)}
.lm-sub{max-width:34rem;margin-top:1.4rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
.lm-ctas{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.8rem 1.4rem;margin-top:2.2rem}
.lm-from{color:var(--muted)}
/* hero light: CSS by default, the shader once it has drawn */
.lm-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;align-items:center;min-height:100vh;min-height:100svh;padding-block:6rem 4rem;text-align:center}
.lm-hero-in{display:grid;justify-items:center}
.lm-fb,.lm-gl{position:absolute;inset:0;z-index:-1;width:100%;height:100%}
.lm-fb{background:radial-gradient(50% 45% at 50% 55%,color-mix(in srgb,var(--primary) 45%,transparent),transparent 70%),var(--dark)}
.lm-fb span{position:absolute;width:60vmax;height:60vmax;border-radius:50%;filter:blur(30px);opacity:.55}
.lm-fb span:first-child{left:-10%;top:10%;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 70%,transparent),transparent)}
.lm-fb span:last-child{right:-15%;bottom:-20%;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 55%,transparent),transparent)}
html.m .lm-fb span:first-child{animation:lmDrift 24s ease-in-out infinite alternate}
html.m .lm-fb span:last-child{animation:lmDrift 31s ease-in-out infinite alternate-reverse}
@keyframes lmDrift{to{transform:translate3d(18vw,-10vh,0) scale(1.12)}}
.lm-gl{opacity:0;transition:opacity 1.6s ease}
.lm-hero.gl .lm-gl{opacity:1}
.lm-hero::after{content:'';position:absolute;inset:auto 0 0;height:40%;z-index:-1;background:linear-gradient(180deg,transparent,var(--dark))}
.lm-pill,.lm-glass{display:inline-flex;align-items:center;gap:.6rem;padding:.55rem 1.1rem;border-radius:999px;background:color-mix(in srgb,var(--on-dark) 7%,transparent);border:1px solid var(--edge);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 18%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);font-size:.9rem;font-weight:500}
.lm-pill{margin-bottom:1.6rem}
.lm-dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent)}
/* feature beats */
.lm-beat{--k:.45;position:relative}
.lm-beat-in{position:relative;isolation:isolate;display:grid;justify-items:center;align-content:center;gap:1.6rem;min-height:70vh;padding:4rem 1rem;text-align:center}
.lm-beat .lm-h2{max-width:18ch}
.lm-beam{position:absolute;left:50%;top:0;bottom:0;z-index:-1;width:min(60rem,90vw);transform:translateX(-50%);background:radial-gradient(50% 50% at 50% 50%,color-mix(in srgb,var(--primary) 42%,transparent),transparent 72%);opacity:.8}
.lm-glass b{font-variant-numeric:tabular-nums}
.lm-glass span{color:var(--muted)}
html.m .lm-beat{min-height:170vh;min-height:170svh}
html.m .lm-beat-in{position:sticky;top:0;min-height:100vh;min-height:100svh;opacity:clamp(0,min(calc((var(--k) - .1) * 6),calc((.9 - var(--k)) * 6)),1)}
html.m .lm-beam{width:calc(min(70rem,100vw) * (1 - clamp(0,(var(--k) - .25) * 1.6,1) * .78));background:radial-gradient(50% 60% at 50% 50%,color-mix(in srgb,var(--primary) 55%,transparent),color-mix(in srgb,var(--accent) 12%,transparent) 55%,transparent 75%);filter:blur(calc(10px + var(--k) * 20px))}
html.m .lm-beat .lm-glass{border-radius:calc(999px - var(--k) * 990px);padding-inline:calc(1.1rem + var(--k) * 1.2rem);transition:none}
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
.lm-halo{position:absolute;left:50%;top:58%;z-index:-1;width:min(70rem,140vw);aspect-ratio:1.6;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,#fff 26%,var(--primary)),color-mix(in srgb,var(--primary) 40%,transparent) 40%,transparent 72%);opacity:.65}
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
  match: /\b(ai|a\.i\.|gpt|llm|machine learning|beta|chrome extension|browser extension)\b/,
  why: 'Built for a digital product where light is the only decoration: a slow glowing field in your two colors that leans toward the cursor, each feature lit by a narrowing beam, glass cards and one button under a halo.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
