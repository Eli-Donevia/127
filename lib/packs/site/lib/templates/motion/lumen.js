// Lumen (animated, product, for software and digital products): the product working, and light only in the type.
//   Object:   the app itself, drawn as a studio comp: a call's transcript on the left turning into notes on the right
//             (summary lines writing in, next steps ticking off), in a window of the app.
//   Material: light and night: a near-black page, hairlines, the app in two greys; the headline's letters are windows
//             onto a slow field of light in one hue, the member's colour (a small hand-written WebGL shader).
//   One move: the headline types itself out and the app wipes on beside it; then the hero holds (pinned) while the
//             scroll reads the transcript down line by line and the notes write themselves, one listed feature at a
//             time underneath.
//   Pop:      the member's colour is the light in the headline and the ticks as each next step is checked off. Buttons
//             are white. No pills, no glass, no glow behind anything, no gradient beyond the headline.
// The shader starts after load, draws only the headline's box at half resolution (device pixel ratio capped at 2),
// stops off screen and on Pause motion; phones, reduced motion and no WebGL get the letters filled with a plain CSS
// light in the same hue. Then the plans as a table, the member's story when they wrote one, their questions when
// they gave some, and the name with one button. Reduced motion and no script: the notes already written.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { draftCopy } = require('../../copy');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

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

function plansOf(c) {
  return c.services.filter((s) => s.name && s.priceText);
}

function hasFree(c) {
  return plansOf(c).some((s) => s.price === 0);
}

// The member's own words only: the generated product about repeats the page.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length || /^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

function nav(c) {
  return [
    c.included.length && { label: 'How it works', href: '#notes' },
    plansOf(c).length > 1 && { label: 'Plans', href: '#plans' },
    ownAbout(c).length && { label: 'About', href: '#about' },
    c.faq.length >= 2 && { label: 'Questions', href: '#asked' },
  ].filter(Boolean);
}

// The app, drawn: a window with the call's transcript (speaker, then the line, as grey type bars) and the notes it
// becomes (summary lines, then next steps with boxes). Each note line has a threshold --t on the scroll (0 to 1).
function app(name) {
  const tw = [[34, 88, 62], [28, 74], [36, 92, 40], [30, 66, 80], [34, 84], [28, 58, 70]];
  const transcript = tw.map((ws, i) => `<li style="--i:${i}"><i class="lm-who${i % 2 ? ' b' : ''}" style="width:${ws[0]}%"></i>${ws.slice(1).map((w) => `<i style="width:${w}%"></i>`).join('')}</li>`).join('');
  const sum = [[92, 0.08], [78, 0.2], [86, 0.32]].map(([w, t]) => `<li style="--t:${t}"><i style="width:${w}%"></i></li>`).join('');
  const steps = [[70, 0.5], [56, 0.64], [64, 0.78]].map(([w, t]) => `<li style="--t:${t}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="2.5"/><path d="M4.2 8.4 7 11l5-6" pathLength="1"/></svg><i style="width:${w}%"></i></li>`).join('');
  return `<div class="lm-app" aria-hidden="true">
<div class="lm-bar"><span>${esc(name)}</span><i class="lm-rec"></i><i class="lm-wave">${Array.from({ length: 28 }, (_, i) => `<b style="--v:${(0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))).toFixed(2)}"></b>`).join('')}</i></div>
<div class="lm-panes">
<div class="lm-pane lm-tr"><p class="lm-pt">Transcript</p><ol>${transcript}</ol><i class="lm-read"></i></div>
<div class="lm-pane lm-nt"><p class="lm-pt">Notes</p><i class="lm-nh"></i><ul class="lm-sum">${sum}</ul><p class="lm-pt sm">Next steps</p><ul class="lm-todo">${steps}</ul></div>
</div>
</div>`;
}

function render(c) {
  const name = product(c);
  const plans = plansOf(c);
  const free = hasFree(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const cta = waitlist || !free ? buy : { ...buy, label: 'Start free' };
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const title = c.tagline ? c.tagline.replace(/[.!]+$/, '') : c.heroTitle;
  const sub = c.tagline ? (c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.heroSub) : '';
  const paid = plans.filter((s) => s.price > 0);
  const note = free ? '' : paid.length ? (plans.length > 1 ? `From ${paid.reduce((a, b) => (b.price < a.price ? b : a)).priceText}` : paid[0].priceText) : c.priceText || '';
  const feats = c.included.slice(0, 4);

  const hero = `<section class="lm-hero" id="notes" aria-labelledby="hero-title"${feats.length ? ' data-sc' : ''}>
<div class="lm-stage"${feats.length ? ' data-sc-stage' : ''}>
<div class="wrap lm-hero-in">
<div class="lm-copy">
<p class="lm-name" data-ci="then" data-ci-from="fade"><span>${esc(name)}</span>${c.whatShort && norm(c.whatShort) !== norm(name) && !norm(title).includes(norm(c.whatShort)) ? `<span>${esc(c.whatShort)}</span>` : ''}</p>
<div class="lm-type" data-alive="0.3"><div class="lm-fb" aria-hidden="true"></div><canvas class="lm-gl" aria-hidden="true"></canvas><h1 class="lm-h1" id="hero-title" data-ci="head">${esc(title)}</h1></div>
${sub ? `<p class="lm-sub" data-ci="then">${esc(sub)}</p>` : ''}
<div class="lm-ctas" data-ci="then">${mag(P.button(cta, 'btn btn-primary btn-lg lm-btn'))}${note ? `<span class="lm-from">${esc(note)}</span>` : ''}</div>
</div>
<div class="lm-work"><div data-ci="subject">${app(name)}</div>
${feats.length ? `<h2 class="sr-only">What ${esc(name)} does</h2><ol class="lm-steps">${feats.map((x, i) => `<li data-sc-part><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(x)}</span></li>`).join('')}</ol>` : ''}
</div>
</div>
</div>
</section>`;

  const more = c.included.slice(4);
  const extra = more.length ? `<section class="lm-sec" aria-label="More in ${esc(name)}"><div class="wrap"><ul class="lm-more">${more.map((x, i) => `<li><b aria-hidden="true">${String(i + 5).padStart(2, '0')}</b>${esc(x)}</li>`).join('')}</ul></div></section>` : '';

  // The plans as a table: name, price, what it includes; one row each, figures lined up.
  const table = plans.length > 1
    ? `<section class="lm-sec" id="plans" aria-labelledby="plans-title"><div class="wrap lm-plans-in"><h2 class="lm-h2" id="plans-title">Pricing.</h2>
<table class="lm-plans"><thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Includes</th></tr></thead><tbody>${plans.map((s) => `<tr><th scope="row">${esc(s.name)}</th><td class="lm-price">${esc(s.priceText)}</td><td>${esc(s.blurb || '')}</td></tr>`).join('')}</tbody></table>
<div class="lm-plans-cta">${mag(P.button(cta, 'btn btn-primary lm-btn'))}</div></div></section>`
    : '';

  const paras = ownAbout(c);
  const about = paras.length
    ? `<section class="lm-sec lm-about" id="about" aria-labelledby="about-title"><div class="wrap lm-about-in"><h2 class="lm-side" id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${name}`)}</h2><div>${paras.map((p, i) => `<p class="lm-say${i ? ' more' : ''}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="lm-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="lm-h2" id="reviews-title">What people say</h2><div class="lm-rv">${P.reviews(c)}</div></div></section>` : '';
  const asked = c.faq.length >= 2
    ? `<section class="lm-sec" id="asked" aria-labelledby="asked-title"><div class="wrap lm-asked"><h2 class="lm-h2" id="asked-title">Asked.</h2><dl>${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const endTitle = waitlist ? c.ctaTitle : name;
  const end = `<section class="lm-sec lm-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title"><div class="wrap lm-end-in${waitlist ? ' wait' : ''}">
<h2 class="lm-end-t${[...endTitle].length > 12 ? ' long' : ''}" id="end-title">${esc(endTitle)}</h2>
<div class="lm-end-side">
${waitlist && c.ctaSub ? `<p class="lm-sub">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist ? `<div class="lm-form">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `<div class="lm-ctas">${mag(P.button(cta, 'btn btn-primary btn-lg lm-btn'))}${note ? `<span class="lm-from">${esc(note)}</span>` : ''}</div>${c.email ? `<p class="lm-mail"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}`}
</div>
</div></section>`;

  const bar = `<nav class="mbar lm-mbar" aria-label="${esc(cta.label)}">${P.button(cta, 'btn btn-primary lm-btn')}</nav>`;
  const m = motion();
  const header = P.header({ ...c, primary: cta }, { cls: 'lm-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm lm-btn' }).replace('<header class="hdr', '<header data-hdr class="hdr');
  const body = [header, '<main id="main">', hero, extra, table, about, reviews, asked, end, '</main>', P.footer(c, { cls: 'lm-ftr' }), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '4px', max: '82rem' } };
}

// The light inside the headline. A fragment shader of domain-warped noise (fbm of fbm) in one hue, the member's
// colour (--primary-on-dark) running from deep to pale, its center easing toward the pointer, drawn on a canvas the
// size of the headline's box (the headline sits over it with mix-blend-mode darken: its dark background hides the
// canvas, its white letters show it). WebGL 1, no library. Reduced motion: it never runs and the CSS light stays.
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
'vec3 col=mix(a,b,clamp(length(w)*1.2-.45,0.,1.));float g=.45+.55*smoothstep(.15,.9,f);'+
'gl_FragColor=vec4(mix(mix(k,a,.55),col,clamp(g,0.,1.)),1.);}';
function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);var loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
var U={};['r','t','m','a','b','k'].forEach(function(x){U[x]=gl.getUniformLocation(pr,x)});
var cs=getComputedStyle(h);function rgb(v){var x=cs.getPropertyValue(v).trim().replace('#','');if(x.length===3)x=x.replace(/./g,'$&$&');var n=parseInt(x,16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
var A=rgb('--primary-on-dark');gl.uniform3fv(U.a,A);gl.uniform3fv(U.b,A.map(function(v){return v+(1-v)*.62}));gl.uniform3fv(U.k,rgb('--dark'));
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
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 13%,transparent);--G1:color-mix(in srgb,var(--on-dark) 36%,var(--dark));--G2:color-mix(in srgb,var(--on-dark) 17%,var(--dark));--win:color-mix(in srgb,var(--on-dark) 4%,var(--dark));background:var(--dark);color:var(--on-dark);letter-spacing:-.011em}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn-primary{box-shadow:none}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.lm-btn{background:var(--on-dark);color:var(--dark);box-shadow:none;font-weight:600}
.lm-btn:hover{background:#fff;color:var(--dark)}
.hdr{position:sticky;top:0;z-index:30;background:var(--dark);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-weight:700;font-size:1.05rem;letter-spacing:-.03em;text-decoration:none}
.nav ul{display:flex;gap:.5rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.86rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--on-dark)}
.menu>summary{background:transparent;border-color:var(--edge);color:var(--on-dark);border-radius:6px}
.menu-panel{background:var(--dark);border-color:var(--edge)}
.menu-panel li a{font-family:var(--font-body);font-weight:600;letter-spacing:-.04em;border-bottom-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lm-h2{font-size:clamp(2.2rem,1.5rem + 3vw,4.2rem);line-height:.98;letter-spacing:-.05em;color:var(--on-dark)}
.lm-sub{max-width:30rem;margin-top:clamp(1.2rem,1rem + 1vw,2rem);font-size:clamp(1.1rem,1rem + .45vw,1.3rem);line-height:1.5;color:var(--muted)}
.lm-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.4rem;margin-top:1.8rem}
.lm-from{color:var(--muted);font-variant-numeric:tabular-nums}
/* hero: the headline lit from inside on the left, the app working on the right; pinned on a desktop */
.lm-stage{display:grid;align-items:center;padding-block:clamp(2.5rem,2rem + 3vw,5rem)}
.lm-hero-in{display:grid;gap:clamp(2.5rem,2rem + 2vw,4rem);align-items:center}
@media (min-width:60rem){.lm-hero-in{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(2.5rem,1rem + 4vw,6rem)}}
.lm-name{display:flex;flex-wrap:wrap;gap:.2rem 1rem;margin-bottom:clamp(1.2rem,1rem + 1vw,2rem);font-size:.95rem;color:var(--muted)}
.lm-name span:first-child{color:var(--on-dark);font-weight:600}
.lm-type{position:relative;isolation:isolate;margin-left:-.04em;font-size:clamp(2.8rem,1rem + 4.6vw,5.6rem)}
@media (max-width:59.99rem){.lm-type{font-size:clamp(2.8rem,1rem + 8vw,5.6rem)}}
.lm-h1{position:relative;z-index:1;padding:.04em .06em .1em;background:var(--dark);color:#fff;mix-blend-mode:darken;font-size:inherit;line-height:.94;letter-spacing:-.055em;text-wrap:balance}
.lm-fb,.lm-gl{position:absolute;inset:0;z-index:0;width:100%;height:100%}
.lm-fb{background:linear-gradient(100deg,var(--primary-on-dark),color-mix(in srgb,var(--primary-on-dark) 45%,#fff) 70%,var(--primary-on-dark))}
.lm-gl{opacity:0;transition:opacity 1.2s ease}
.lm-type.gl .lm-gl{opacity:1}
/* the app */
.lm-app{--p1:var(--p,1);font-size:clamp(.8rem,.45rem + .55vw,1.08rem);border:1px solid var(--edge);border-radius:8px;background:var(--win);overflow:hidden}
.lm-bar{display:flex;align-items:center;gap:.9em;padding:.75em 1em;border-bottom:1px solid var(--edge);font-size:.82em;font-weight:600;color:var(--on-dark)}
.lm-rec{display:block;width:.55em;height:.55em;border-radius:2px;background:var(--G1)}
.lm-wave{display:flex;flex:1;align-items:center;gap:3px;height:1.4em;justify-content:flex-end;opacity:.9}
.lm-wave b{display:block;width:3px;height:calc(var(--v) * 100%);border-radius:2px;background:var(--G1)}
.lm-panes{display:grid;grid-template-columns:1fr 1fr}
.lm-pane{position:relative;padding:1.1em 1.1em 1.4em}
.lm-tr{border-right:1px solid var(--edge)}
.lm-pt{font-size:.78em;font-weight:600;color:var(--muted);margin-bottom:.9em}
.lm-pt.sm{margin:1.3em 0 .7em}
.lm-pane i{display:block;height:.5em;border-radius:2px;background:var(--G2)}
.lm-tr ol{display:grid;gap:.95em}
.lm-tr li{display:grid;gap:.38em;transition:opacity .4s ease}
.lm-tr .lm-who{height:.42em;background:var(--G1)}
.lm-tr .lm-who.b{background:color-mix(in srgb,var(--on-dark) 22%,var(--dark))}
.lm-read{position:absolute;left:.35em;top:2.65em;width:2px!important;height:2.2em!important;background:var(--on-dark)!important;opacity:.7;transform:translateY(calc(var(--p1) * 5 * 3.05em));transition:transform .2s linear}
.lm-nh{width:58%;height:.72em!important;margin-bottom:1em;background:var(--G1)!important}
.lm-sum{display:grid;gap:.6em}
.lm-sum li,.lm-todo li{--k:clamp(0,calc((var(--p1) * 1.08 - var(--t)) * 7),1)}
.lm-sum li i{transform-origin:0 50%;transform:scaleX(var(--k));background:var(--G1)}
.lm-todo{display:grid;gap:.7em}
.lm-todo li{display:grid;grid-template-columns:1em 1fr;gap:.6em;align-items:center}
.lm-todo svg{width:1em;height:1em;fill:none;stroke-linecap:round;stroke-linejoin:round}
.lm-todo rect{stroke:var(--G1);stroke-width:1.3}
.lm-todo path{stroke:var(--pop);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--k))}
.lm-todo li i{transform-origin:0 50%;transform:scaleX(var(--k));opacity:calc(.35 + var(--k) * .65)}
.lm-steps{display:grid;margin-top:1.4rem;border-top:1px solid var(--edge)}
.lm-steps li{display:grid;grid-template-columns:2.4rem 1fr;gap:.6rem;padding-block:.85rem;border-bottom:1px solid var(--edge);font-size:clamp(1.05rem,1rem + .3vw,1.25rem);letter-spacing:-.02em;transition:color .4s ease}
.lm-steps b{font-size:.85rem;font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:.2rem}
@media (min-width:48rem) and (hover:hover){
html.m .lm-hero[data-sc]{height:calc(100vh + var(--n,3) * 50vh)!important;height:calc(100svh + var(--n,3) * 50svh)!important}
html.m .lm-stage{height:calc(100vh - 3.75rem);height:calc(100svh - 3.75rem);top:3.75rem!important;min-height:0!important;padding-block:1rem}
html.m .lm-steps li{color:var(--muted)}
html.m .lm-steps li.cur{color:var(--on-dark)}
html.m .lm-tr li{opacity:calc(.45 + clamp(0,calc((var(--i) + 1) / 6 - var(--p1)),1) * 3)}
}
/* sections */
.lm-sec{position:relative;padding-block:clamp(5rem,3.5rem + 5vw,9rem);border-top:1px solid var(--edge)}
.lm-more{display:grid;border-top:1px solid var(--edge)}
.lm-more li{display:grid;grid-template-columns:3rem minmax(0,1fr);gap:1rem;padding-block:1.1rem;border-bottom:1px solid var(--edge);font-size:clamp(1.15rem,1rem + .5vw,1.4rem);letter-spacing:-.02em}
.lm-more b{font-size:.9rem;font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:.2rem}
.lm-plans-in{display:grid;gap:2.2rem}
.lm-plans{width:100%;border-collapse:collapse;border-top:1px solid var(--on-dark);font-variant-numeric:tabular-nums}
.lm-plans thead th:first-child{width:28%}.lm-plans thead th:nth-child(2){width:22%}
.lm-plans thead th{padding:.8rem 0;font-size:.82rem;font-weight:500;color:var(--muted);text-align:left;border-bottom:1px solid var(--edge)}
.lm-plans tbody th,.lm-plans td{padding:1.3rem 1rem 1.3rem 0;border-bottom:1px solid var(--edge);text-align:left;vertical-align:baseline}
.lm-plans tbody th{font-size:1.25rem;font-weight:600;letter-spacing:-.03em}
.lm-plans .lm-price{font-size:clamp(1.4rem,1.2rem + .8vw,2rem);font-weight:600;letter-spacing:-.045em;white-space:nowrap}
.lm-plans td:last-child{color:var(--muted)}
@media (max-width:39.99rem){.lm-plans thead{display:none}.lm-plans tr{display:grid;grid-template-columns:1fr auto;padding-block:1rem;border-bottom:1px solid var(--edge)}.lm-plans tbody th,.lm-plans td{padding:0;border:0}.lm-plans td:last-child{grid-column:1/-1;padding-top:.3rem}}
.lm-about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.lm-about-in{grid-template-columns:3fr 9fr}}
.lm-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:-.01em;color:var(--muted)}
.lm-say{font-size:clamp(1.6rem,1.1rem + 2vw,3rem);font-weight:500;line-height:1.14;letter-spacing:-.04em;max-width:28ch}
.lm-say.more{margin-top:1.4rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.4;color:var(--muted);max-width:40ch}
.lm-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--on-dark);padding:1.4rem 0 0}
.lm-asked{display:grid;gap:2rem}
@media (min-width:60rem){.lm-asked{grid-template-columns:5fr 7fr;gap:4rem}}
.lm-asked dl{border-top:1px solid var(--on-dark)}
.lm-asked dl div{display:grid;gap:.4rem;padding-block:1.2rem;border-bottom:1px solid var(--edge)}
.lm-asked dt{font-weight:600;letter-spacing:-.02em}
.lm-asked dd{color:var(--muted)}
.lm-end{padding-bottom:clamp(4rem,3rem + 4vw,7rem)}
.lm-end-in{display:grid;gap:2rem;align-items:end}
@media (min-width:60rem){.lm-end-in{grid-template-columns:minmax(0,1fr) auto}}
@media (max-width:59.99rem){.lm-end-in.wait{grid-template-columns:1fr}}
.lm-end-t{font-size:clamp(3.4rem,1rem + 10vw,11rem);line-height:.86;letter-spacing:-.065em}
.lm-end-t.long{font-size:clamp(2.6rem,1.4rem + 5vw,6.4rem);line-height:.94;text-wrap:balance}
.lm-end-side{display:grid;gap:1.2rem;justify-items:start}
.lm-end-side .lm-sub,.lm-end-side .lm-ctas{margin-top:0}
.lm-mail a{color:var(--muted);text-decoration-color:var(--edge)}
.lm-mail a:hover{color:var(--on-dark)}
.lm-form{width:min(100%,28rem)}
.field input,.field select,.field textarea{background:transparent;border-color:var(--edge);border-radius:4px}
.form .btn-primary{background:var(--on-dark);color:var(--dark)}
/* footer: one hairline, the name in the app's weight, the rest in grey */
.lm-ftr{border-top:1px solid var(--edge)}
.lm-ftr .ftr-name{font-family:var(--font-body);font-size:1.05rem;letter-spacing:-.03em}
.lm-ftr .contact-list .i{display:none}
.lm-ftr .ftr-base{border-top-color:var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none}
.mbar .btn-primary{background:var(--on-dark);color:var(--dark)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Lumen',
  bestFor: 'An app, an AI tool or another digital product with a clear promise and one button',
  // The motion, as data (lib/choreo.md): written out like notes, light that leans your way, the app working on the scroll.
  choreo: { intro: 'type', alive: ['drift', 'pointer'], scroll: 'pin', pace: 'medium', look: 'dark, quiet, the product working; the light is in the type' },
  match: /\b(ai|a\.i\.|gpt|llm|machine learning|beta|chrome extension|browser extension)\b/,
  why: 'Built for a digital product: your headline types itself out lit from inside in your color, and beside it your app works: as the page scrolls, a call turns into notes and each feature takes its turn, then the plans as a plain table.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
