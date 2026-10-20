// Nightfall (animated, product, for a maker with a story): a cinematic scroll story at night. Scroll moves a camera
// through a forest scene built from layered SVG planes (far ridge, trees, a gate, stone lanterns, fog) in the member's
// colors: chapter one starts wide behind the gate while the lanterns light one by one, chapter two passes through the
// gate while a route line draws itself, chapter three stops on the product under a sweeping rim light with its details
// on hairlines, and the last chapter clears the fog for one button. The type stays pinned while each chapter plays.
// Chapter markers are the numerals 一 二 三 四 drawn as brush strokes (SVG, so no CJK font is needed). No 3D library:
// depth is CSS transforms on flat planes, driven by one scroll listener. Reduced motion and no script: the scene is a
// still behind the first chapter and the chapters read as a normal page. Phones get fewer planes and no fog drift.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'nightfall';

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.14), '#05060a', 0.78) };
}

function product(c) {
  return c.productName || c.name;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [
    { slot: 'hero', file: 'product.jpg', w: 1400, h: 1100, style: 'object', alt: c.profile.hero && !/^the product/i.test(c.profile.hero) ? c.profile.hero : `${name}, up close` },
    { slot: 'work', file: 'workshop.jpg', w: 1600, h: 1000, style: 'sweep', alt: g[1] || `Where ${c.name} is made` },
  ];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText;
  return c.priceText || '';
}

function nav(c) {
  return [
    { label: 'Story', href: '#story' },
    c.services.length > 1 && { label: 'Collection', href: '#collection' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    c.buy ? { label: 'Buy', href: '#buy' } : { label: 'Waitlist', href: '#signup' },
  ].filter(Boolean);
}

// The chapter numerals as brush strokes, so they draw on view and need no Japanese font.
const NUMS = [
  ['一', 'M5 21Q20 17.5 35 20'],
  ['二', 'M10 12H30M5 30Q20 27 35 29'],
  ['三', 'M9 8H31M12 19.5H28M5 32Q20 29 35 31'],
  ['四', 'M7 9V33H33V9ZM16 9Q16 20 11 25M24 9V22Q24 25 28 25H32'],
];
function num(i) {
  const [ch, d] = NUMS[i];
  return `<span class="nf-num" aria-hidden="true" title="${ch}"><svg viewBox="0 0 40 40" width="40" height="40"><path d="${d}" pathLength="1"/></svg></span>`;
}

function sentences(s) {
  const all = String(s).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  const out = all.map((x) => x.trim()).filter(Boolean);
  if (out.length < 3) return out.length ? [out.join(' ')] : [];
  const half = Math.ceil(out.length * 0.6);
  return [out.slice(0, half).join(' '), '', out.slice(half).join(' ')];
}

// One letter per span for the hero name; screen readers get the name once.
function letters(s) {
  let i = 0;
  return String(s)
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="lw">${[...w].map((ch) => `<span class="ch" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`))
    .join('');
}

// The scene: flat planes, back to front. Each plane is its own SVG so the camera can move it at its own depth.
const TREE = '<symbol id="nf-t" viewBox="0 0 100 200"><path d="M50 0 64 42H57L75 84H63L86 128H67L94 172H55V200H45V172H6L33 128H14L37 84H25L43 42H36Z"/></symbol>';
const MAPLE = '<symbol id="nf-m" viewBox="0 0 120 160"><path d="M57 160V96L44 80 50 78 60 90 70 70 76 73 64 98V160Z"/><circle cx="60" cy="52" r="34"/><circle cx="30" cy="70" r="24"/><circle cx="92" cy="66" r="26"/><circle cx="62" cy="22" r="20"/></symbol>';
const trees = (list) => list.map(([x, y, s, m]) => `<use href="#nf-${m ? 'm' : 't'}" x="${x}" y="${y}" width="${Math.round(100 * s * (m ? 1.2 : 1))}" height="${Math.round(200 * s * (m ? 0.8 : 1))}"/>`).join('');
function scene() {
  const svg = (cls, inner, extra = '') => `<svg class="nf-l ${cls}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"${extra}>${inner}</svg>`;
  const lantern = (x, s, i) => `<g class="nf-lan" style="--i:${i}" transform="translate(${x} ${Math.round(900 - 150 * s)}) scale(${s})"><circle class="nf-glow" cx="20" cy="38" r="34"/><path class="nf-stone" d="M4 30 20 19 36 30ZM18 14h4v5h-4ZM16 46h8v30h-8ZM8 76h24v8H8Z"/><rect class="nf-fire" x="10" y="30" width="20" height="16" rx="2"/></g>`;
  return `<div class="nf-stage" aria-hidden="true">
<svg width="0" height="0" class="nf-defs"><defs>${TREE}${MAPLE}</defs></svg>
<div class="nf-sky"><span class="nf-moon"></span></div>
${svg('nf-ridge', '<path d="M0 640 120 560 260 610 420 500 560 590 700 520 820 470 960 560 1120 480 1260 560 1400 500 1600 580V900H0Z"/>')}
${svg('nf-far', trees([[40, 470, 1.6], [180, 500, 1.4, 1], [330, 460, 1.7], [470, 520, 1.3], [1080, 500, 1.4], [1210, 470, 1.6, 1], [1360, 490, 1.5], [1490, 460, 1.7]]) + '<path d="M0 820H1600V900H0Z"/>')}
${svg('nf-path', '<path d="M700 900 788 610H812L900 900Z"/>')}
${svg('nf-gate', '<g transform="translate(640 430)"><path d="M-24 34Q160 6 344 34L338 54Q160 28-18 54Z"/><path d="M28 92H292V108H28Z"/><path d="M68 50H92V330H68ZM228 50H252V330H228ZM151 54H169V92H151Z"/></g>')}
${svg('nf-lamps', lantern(600, 1.25, 0) + lantern(960, 1.25, 1) + lantern(470, 1.8, 2) + lantern(1080, 1.8, 3))}
${svg('nf-mid', trees([[-30, 300, 3, 1], [150, 360, 2.6], [1290, 330, 2.8], [1440, 300, 3, 1]]))}
<div class="nf-fog f1"></div><div class="nf-fog f2"></div>
${svg('nf-near', trees([[-160, -60, 5.2], [1390, -40, 5.1]]))}
<div class="nf-vig"></div>
</div>`;
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  // The member's story, split across chapters two and three by sentence when it came as one paragraph.
  const paras = c.aboutParas.length > 1 ? c.aboutParas : sentences(c.aboutParas[0] || '');
  const specs = c.included.slice(0, 5);

  const ch1 = `<article class="nf-ch nf-ch1" aria-labelledby="hero-title"><div class="nf-ch-in">
${num(0)}
${name !== c.name ? `<p class="nf-kick" data-rv>${esc(c.name)}</p>` : `<p class="nf-kick" data-rv>${esc(c.heroTitle !== name ? c.heroTitle : c.whatShort || '')}</p>`}
<h1 id="hero-title" class="nf-name${[...name].length > 14 ? ' long' : ''}" aria-label="${esc(name)}"><span aria-hidden="true">${letters(name)}</span></h1>
<p class="nf-sub" data-rv style="--d:6">${esc(sub)}</p>
<div class="nf-ctas" data-rv style="--d:8">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>
<p class="nf-cue" data-rv style="--d:10"><span></span>Scroll</p>
</div></article>`;

  const ch2 = `<article class="nf-ch nf-ch2" aria-labelledby="ch2-title"><div class="nf-ch-in">
${num(1)}
<h2 class="nf-h2" id="ch2-title" data-split>${esc(c.owner && c.owner !== c.name ? `From ${c.owner}${c.city && !c.online ? ` in ${c.city}` : ''}` : c.city ? `From ${c.city}` : `About ${c.name}`)}</h2>
${paras.slice(0, 2).filter(Boolean).map((p, i) => `<p class="nf-p" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<svg class="nf-route" viewBox="0 0 400 120" aria-hidden="true"><path d="M8 96C60 92 70 40 120 46S180 104 236 82 300 20 352 30 388 54 392 50" pathLength="1"/><circle cx="392" cy="50" r="5"/></svg>
${c.city ? `<p class="nf-place" data-rv style="--d:4">${icon('pin', { size: 16 })}${esc(c.city)}</p>` : ''}
</div></article>`;

  const ch3 = `<article class="nf-ch nf-ch3" aria-labelledby="ch3-title"><div class="nf-ch-in nf-show">
<div class="nf-show-copy">
${num(2)}
<h2 class="nf-h2" id="ch3-title" data-split>${esc(name)}</h2>
${paras[2] ? `<p class="nf-p" data-rv style="--d:2">${esc(paras[2])}</p>` : ''}
${specs.length ? `<ul class="nf-specs">${specs.map((x, i) => `<li style="--j:${i}"><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="nf-plinth"><div class="nf-piece">${P.img(c, 'hero', { cls: 'nf-img' })}<span class="nf-rim" aria-hidden="true"></span></div><span class="nf-stone-top" aria-hidden="true"></span></div>
</div></article>`;

  const facts = [c.shipping && `${icon('truck', { size: 18 })}<span>${esc(c.shipping)}</span>`, c.email && `${icon('mail', { size: 18 })}<span>Questions? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span>`].filter(Boolean);
  const ch4 = `<article class="nf-ch nf-ch4" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title"><div class="nf-ch-in nf-end">
${num(3)}
<h2 class="nf-h2 big" id="buy-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="nf-p" data-rv style="--d:2">${esc(c.ctaSub)}${waitlist && c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist
  ? `<div class="nf-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="nf-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>`}
${facts.length ? `<ul class="nf-facts" data-rv style="--d:4">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>` : ''}
</div></article>`;

  const story = `<section class="nf-story" id="story" aria-label="${esc(`The story of ${name}`)}">
${scene()}
${ch1}
${ch2}
${ch3}
${ch4}
</section>`;

  const priced = c.services.filter((s) => s.name);
  const collection = priced.length > 1
    ? `<section class="nf-sec" id="collection" aria-labelledby="col-title"><div class="wrap nf-col">
<div class="nf-col-media" data-rv="mask"><div>${P.img(c, 'work', { cls: 'nf-col-img' }).replace('<img ', '<img data-par="0.05" ')}</div></div>
<div><p class="nf-eyebrow" data-rv>The collection</p><h2 class="nf-h2" id="col-title" data-split>Choose yours.</h2>
<ul class="nf-list">${priced.map((s, i) => `<li data-rv style="--d:${i % 4}"><span class="nf-li-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="nf-li-t">${esc(s.name)}${s.blurb ? `<small>${esc(s.blurb)}</small>` : ''}</span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>
${c.buy ? `<div data-rv>${P.button(buy, 'btn btn-line')}</div>` : ''}
</div></div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="nf-sec" aria-labelledby="reviews-title"><div class="wrap"><p class="nf-eyebrow" data-rv>Kind words</p><h2 class="sr-only" id="reviews-title">Kind words</h2><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';
  const faq = c.faq.length
    ? `<section class="nf-sec" id="faq" aria-labelledby="faq-title"><div class="wrap nf-faq"><div data-rv><p class="nf-eyebrow">FAQ</p><h2 class="nf-h2" id="faq-title">Questions.</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const m = motion();
  const body = [P.header(c, { cls: 'nf-hdr', ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', story, collection, reviews, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '4px', btnRadius: '2px', max: '80rem' } };
}

// The camera: the story's scroll progress (--cam) moves every plane at its own depth; each chapter gets its own
// progress (--k) for its type and drawings; the lanterns light one by one. The fog stops drifting while the story is
// off screen. Off for reduced motion.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,st=d.querySelector('.nf-story');if(!st)return;var stage=st.querySelector('.nf-stage'),chs=[].slice.call(st.querySelectorAll('.nf-ch')),lan=[].slice.call(st.querySelectorAll('.nf-lan')),t=false;
function cl(v){return v<0?0:v>1?1:v}
function f(){t=false;var vh=innerHeight,r=st.getBoundingClientRect(),p=cl(-r.top/Math.max(1,r.height-vh));stage.style.setProperty('--cam',p.toFixed(4));
lan.forEach(function(l,i){l.classList.toggle('on',p>=i*.025)});
chs.forEach(function(c){var b=c.getBoundingClientRect();c.style.setProperty('--k',cl((vh-b.top)/(b.height+vh)).toFixed(4))})}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f();
new IntersectionObserver(function(es){stage.classList.toggle('off',!es[0].isIntersecting)}).observe(st)})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);--night:color-mix(in srgb,var(--primary) 10%,var(--dark));--glow:color-mix(in srgb,var(--primary-on-dark) 30%,#ffcf8a);background:var(--dark);color:var(--on-dark)}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
.btn-sm{min-height:2.5rem;padding:.45rem 1.05rem;font-size:.875rem}
.btn{letter-spacing:.04em}
.btn-line{background:transparent;border:1px solid var(--edge);color:var(--on-dark)}
.btn-line:hover{border-color:var(--on-dark)}
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;transition:background-color .3s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--dark) 72%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4rem}
.brand{display:flex;align-items:center;gap:.6rem;margin-right:auto;font-family:var(--font-display);font-size:1.2rem;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:2rem;height:2rem;border:1px solid var(--edge);border-radius:50%;font-family:var(--font-body);font-size:.68rem;font-weight:600}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .8rem;font-size:.84rem;letter-spacing:.06em;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--on-dark)}
.menu>summary{background:transparent;border-color:var(--edge);color:var(--on-dark)}
.menu-panel{background:var(--dark);border-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.nf-eyebrow,.nf-kick{font-size:.78rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--primary-text)}
.nf-h2{font-size:clamp(2.4rem,1.6rem + 3.4vw,4.6rem);line-height:1;text-wrap:balance}
.nf-h2.big{font-size:clamp(2.8rem,1.8rem + 4.4vw,6rem)}
.nf-p{margin-top:1.2rem;max-width:34rem;font-size:clamp(1.05rem,1rem + .3vw,1.25rem);line-height:1.65;color:color-mix(in srgb,var(--on-dark) 84%,var(--dark))}
.nf-num{display:block;width:2.6rem;height:2.6rem;margin-bottom:1.1rem;color:var(--primary-on-dark)}
.nf-num svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
html.m .nf-num path{stroke-dasharray:1;stroke-dashoffset:calc(1 - min(1,var(--k,.5) * 4))}
/* the scene */
.nf-story{position:relative;isolation:isolate}
.nf-stage{--cam:0;position:absolute;left:0;right:0;top:0;height:100vh;height:100svh;overflow:hidden;z-index:0;background:var(--dark);pointer-events:none}
html.m .nf-stage{position:sticky;margin-bottom:-100vh;margin-bottom:-100svh}
.nf-defs{position:absolute}
.nf-sky{position:absolute;inset:0;background:radial-gradient(60% 50% at 50% 38%,color-mix(in srgb,var(--primary) 16%,transparent),transparent 70%),linear-gradient(180deg,var(--dark) 0%,var(--night) 55%,color-mix(in srgb,var(--primary) 6%,var(--dark)) 100%);transform:translate3d(0,calc(var(--cam) * 6vh),0)}
.nf-sky::before{content:'';position:absolute;inset:0 0 40%;background-image:radial-gradient(1px 1px at 12% 22%,var(--on-dark),transparent),radial-gradient(1px 1px at 28% 12%,var(--on-dark),transparent),radial-gradient(1.5px 1.5px at 44% 28%,var(--on-dark),transparent),radial-gradient(1px 1px at 63% 9%,var(--on-dark),transparent),radial-gradient(1px 1px at 78% 24%,var(--on-dark),transparent),radial-gradient(1.5px 1.5px at 90% 14%,var(--on-dark),transparent),radial-gradient(1px 1px at 6% 40%,var(--on-dark),transparent),radial-gradient(1px 1px at 55% 40%,var(--on-dark),transparent);opacity:.55}
.nf-moon{position:absolute;left:64%;top:16%;width:clamp(4rem,7vw,7rem);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 38%,var(--on-dark),color-mix(in srgb,var(--on-dark) 70%,var(--night)));box-shadow:0 0 60px 18px color-mix(in srgb,var(--on-dark) 16%,transparent),0 0 200px 80px color-mix(in srgb,var(--primary) 12%,transparent)}
.nf-l{position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 64%;transform:translate3d(0,calc(var(--cam) * var(--dy,0vh)),0) scale(calc(1 + var(--cam) * var(--z,0)));will-change:transform}
.nf-ridge{--z:.18;fill:color-mix(in srgb,var(--on-dark) 7%,var(--night))}
.nf-far{--z:.9;--dy:4vh;fill:color-mix(in srgb,var(--on-dark) 4%,var(--dark))}
.nf-far use:nth-child(2),.nf-far use:nth-child(6){fill:color-mix(in srgb,var(--primary) 30%,var(--dark))}
.nf-path{--z:2.6;--dy:10vh;fill:color-mix(in srgb,var(--on-dark) 7%,var(--dark))}
.nf-gate{--z:7;--dy:18vh;fill:color-mix(in srgb,var(--primary) 82%,var(--dark));opacity:clamp(0,calc((.5 - var(--cam)) * 9),1);transform-origin:50% 72%}
.nf-lamps{--z:3.2;--dy:14vh;opacity:clamp(0,calc((.62 - var(--cam)) * 6),1)}
.nf-stone{fill:color-mix(in srgb,var(--on-dark) 12%,var(--dark))}
.nf-fire{fill:var(--glow)}
.nf-glow{fill:var(--glow);opacity:.22;filter:blur(10px)}
html.m .nf-lan .nf-fire{fill:color-mix(in srgb,var(--on-dark) 10%,var(--dark));transition:fill .6s ease}
html.m .nf-lan .nf-glow{opacity:0;transition:opacity .9s ease}
html.m .nf-lan.on .nf-fire{fill:var(--glow);animation:nfFlick 3.2s ease-in-out calc(var(--i) * -.7s) infinite}
html.m .nf-lan.on .nf-glow{opacity:.28;animation:nfFlick 3.2s ease-in-out calc(var(--i) * -.7s) infinite}
@keyframes nfFlick{0%,100%{opacity:1}30%{opacity:.82}34%{opacity:.95}60%{opacity:.88}}
.nf-mid{--z:4;--dy:8vh;fill:color-mix(in srgb,var(--on-dark) 2%,#000);transform-origin:50% 55%}
.nf-mid use:nth-child(1),.nf-mid use:nth-child(4){fill:color-mix(in srgb,var(--primary) 34%,#000)}
.nf-near{--z:6;fill:#000;transform-origin:50% 50%;opacity:clamp(0,calc((.4 - var(--cam)) * 5),1)}
.nf-fog{position:absolute;left:-30%;right:-30%;height:46%;bottom:6%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--on-dark) 20%,transparent),transparent);filter:blur(24px);opacity:calc(.75 - var(--cam) * .75);animation:nfFog 38s ease-in-out infinite alternate}
.nf-fog.f2{bottom:-10%;height:40%;animation-duration:52s;animation-direction:alternate-reverse;opacity:calc(.6 - var(--cam) * .6)}
@keyframes nfFog{to{transform:translate3d(14%,-3%,0)}}
.nf-stage.off .nf-fog,.nf-stage.off .nf-lan *{animation-play-state:paused}
.nf-vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,transparent 45%,color-mix(in srgb,#000 70%,transparent)),linear-gradient(90deg,color-mix(in srgb,var(--dark) 70%,transparent),transparent 55%)}
@media (max-width:47.99rem){.nf-far use:nth-child(n+5),.nf-mid use:nth-child(2),.nf-mid use:nth-child(3){display:none}.nf-fog{animation:none}.nf-fog.f2{display:none}.nf-moon{left:auto;right:8%;top:9%;width:3.2rem}html.m .nf-ch3 .nf-ch-in{position:relative;opacity:1}html.m .nf-ch3{min-height:0}.nf-plinth{max-width:20rem}}
/* chapters */
.nf-ch{position:relative;z-index:1;--k:.4}
.nf-ch-in{display:grid;justify-items:start;padding:clamp(5rem,4rem + 6vh,8rem) 0 clamp(4rem,3rem + 4vh,6rem);width:min(100% - 2rem,var(--max));margin-inline:auto;text-shadow:0 2px 24px color-mix(in srgb,#000 60%,transparent)}
@media (min-width:48rem){.nf-ch-in{width:min(100% - 5rem,var(--max))}}
.nf-ch1 .nf-ch-in{min-height:100vh;min-height:100svh;align-content:center}
html.m .nf-ch{min-height:150vh;min-height:150svh}
html.m .nf-ch1{min-height:130vh;min-height:130svh}
html.m .nf-ch-in{position:sticky;top:0;min-height:100vh;min-height:100svh;align-content:center;opacity:clamp(0,min(calc((var(--k) - .06) * 6),calc((.84 - var(--k)) * 7)),1)}
html.m .nf-ch1 .nf-ch-in{opacity:clamp(0,calc((.6 - var(--k)) * 8),1)}
html.m .nf-ch4{min-height:120vh;min-height:120svh}
html.m .nf-ch4 .nf-ch-in{position:relative;opacity:clamp(0,calc((var(--k) - .08) * 6),1)}
.nf-name{margin-top:.6rem;font-size:clamp(3.4rem,1rem + 11vw,11rem);line-height:.92;letter-spacing:-.03em;max-width:14ch}
.nf-name.long{font-size:clamp(2.8rem,1rem + 6.5vw,7rem)}
.nf-name .lw{display:inline-block;white-space:nowrap}
.nf-name .ch{display:inline-block}
html.m .nf-name .lw{overflow:hidden;vertical-align:top;padding-bottom:.1em;margin-bottom:-.1em}
html.m .nf-name .ch{animation:nfRise 1.4s cubic-bezier(.16,1,.3,1) calc(var(--i) * 45ms + .2s) both}
@keyframes nfRise{from{transform:translateY(105%);filter:blur(6px)}}
.nf-sub{margin-top:1.2rem;max-width:30rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.45;color:color-mix(in srgb,var(--on-dark) 86%,var(--dark))}
.nf-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.4rem;margin-top:2rem}
.nf-from{font-size:1.05rem;color:var(--muted);letter-spacing:.04em}
.nf-cue{display:none;align-items:center;gap:.7rem;margin-top:3.5rem;font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}
.nf-cue span{width:3rem;height:1px;background:currentColor}
html.m .nf-cue{display:flex}
.nf-route{width:min(100%,26rem);margin-top:2rem;overflow:visible}
.nf-route path{fill:none;stroke:var(--glow);stroke-width:2;stroke-linecap:round;filter:drop-shadow(0 0 6px var(--glow))}
.nf-route circle{fill:var(--glow)}
html.m .nf-route path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--k) - .3) * 3,1))}
html.m .nf-route circle{opacity:clamp(0,(var(--k) - .55) * 8,1)}
.nf-place{display:flex;align-items:center;gap:.45rem;margin-top:.8rem;font-size:.85rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.nf-show{gap:2.5rem}
@media (min-width:56rem){.nf-show{grid-template-columns:1fr 1fr;align-items:center;gap:4rem}}
.nf-specs{display:grid;gap:.2rem;margin-top:1.8rem;width:100%;max-width:30rem}
.nf-specs li{display:flex;align-items:center;gap:1rem;padding:.7rem 0;font-size:1rem;line-height:1.4}
.nf-specs li::before{content:'';flex:none;width:3.5rem;height:1px;background:var(--primary-on-dark);transform-origin:0 50%}
html.m .nf-specs li{opacity:clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 14),1);transform:translateX(calc((1 - clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 14),1)) * 24px))}
html.m .nf-specs li::before{transform:scaleX(clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 10),1))}
.nf-plinth{position:relative;display:grid;justify-items:center;width:100%;max-width:30rem;justify-self:center}
.nf-piece{position:relative;overflow:hidden;width:100%;aspect-ratio:14/11;border-radius:2px;box-shadow:0 40px 80px -30px #000,0 0 0 1px var(--edge)}
.nf-img{width:100%;height:100%;object-fit:cover}
.nf-rim{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,color-mix(in srgb,var(--on-dark) 45%,transparent) 50%,transparent 65%);mix-blend-mode:screen;transform:translateX(-60%)}
html.m .nf-rim{transform:translateX(calc(-80% + clamp(0,(var(--k) - .2) * 2.6,1) * 160%))}
.nf-stone-top{width:118%;height:1.6rem;margin-top:-2px;border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--on-dark) 16%,var(--dark)),color-mix(in srgb,var(--on-dark) 6%,var(--dark)));box-shadow:0 30px 60px -10px #000}
html.m .nf-plinth{transform:translate3d(0,calc((1 - clamp(0,(var(--k) - .1) * 4,1)) * 12vh),0) scale(calc(.9 + clamp(0,(var(--k) - .1) * 4,1) * .1))}
.nf-end{justify-items:center;text-align:center}
.nf-end .nf-p{margin-inline:auto}
.nf-end .nf-ctas{justify-content:center}
.nf-form{width:min(100%,30rem);margin-top:2rem;text-align:left}
.nf-facts{display:grid;gap:.6rem;margin-top:2rem;color:var(--muted);text-shadow:none}
.nf-facts li{display:flex;gap:.6rem;align-items:flex-start;justify-content:center}
.nf-facts .i{margin-top:.2rem;color:var(--primary-on-dark)}
.nf-facts a{color:var(--on-dark)}
.field input,.field select,.field textarea{background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));border-color:var(--edge)}
/* after the story */
.nf-sec{position:relative;z-index:1;padding-block:clamp(5rem,3.5rem + 5vw,9rem);border-top:1px solid var(--edge);background:var(--dark)}
.nf-col{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.nf-col{grid-template-columns:.9fr 1.1fr;align-items:center}}
.nf-col-media>div{overflow:hidden;aspect-ratio:4/5;border-radius:2px}
.nf-col-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.nf-list{display:grid;margin:2rem 0;border-top:1px solid var(--edge)}
.nf-list li{display:flex;align-items:baseline;gap:1rem;padding:1.1rem 0;border-bottom:1px solid var(--edge)}
.nf-li-n{flex:none;font-size:.75rem;letter-spacing:.14em;color:var(--primary-on-dark)}
.nf-li-t{display:grid;flex:1;gap:.15rem;font-family:var(--font-display);font-size:1.4rem;line-height:1.2}
.nf-li-t small{font-family:var(--font-body);font-size:.92rem;color:var(--muted)}
.nf-list strong{font-weight:500;white-space:nowrap}
.nf-faq{display:grid;gap:2rem}
@media (min-width:60rem){.nf-faq{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem;font-weight:500}
.faq .ans{padding:0 0 1.25rem}
.review{background:transparent;border-color:var(--edge)}
.ftr{position:relative;z-index:1;background:var(--dark);border-top:1px solid var(--edge)}
.mbar{background:color-mix(in srgb,var(--dark) 85%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-top-color:var(--edge)}
.mbar .btn-ghost{color:var(--on-dark)}
@media (prefers-reduced-motion:reduce){.nf-l,.nf-sky{transform:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Nightfall',
  bestFor: 'A maker or brand with a story to tell: knives, spirits, tools, small-batch goods sold online',
  match: /\b(knives|knife|knifemaker|bladesmith|blacksmith|hand-?forged|forged|forge|sake|whisk(e)?y|distiller(y|s)?|incense)\b/,
  why: 'Built for a maker with a story: scroll moves a camera through a night forest in your colors, chapter by chapter, past a gate and lit lanterns to your product under a rim light, then one button.',
  fonts: { q: 'family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600', display: ['Instrument Serif', 'serif'], body: ['Inter', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
