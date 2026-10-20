// Nightfall (animated, product, for a maker with a story): a cinematic scroll story at night.
//   Object:   the maker's piece on a stone plinth at the end of a path through a night forest, past a gate and four
//             stone lanterns; the chapters are numbered with brush strokes (SVG, no CJK font needed).
//   Material: night forest, stone and steel: flat SVG planes in the member's colours, a serif set like a film title.
//   One move: night falls as the page opens (the scene develops from a pale dusk to dark, the name comes into focus
//             word by word), then scroll moves a camera through the planes, chapter by chapter, backwards on the way up.
//   Pop:      the member's colour is the gate and, per chapter, one drawn line: the route the story travels, the
//             hairlines that draw the piece's details, then the roadmap from the collection to the Buy button.
// At rest the moon and the piece drift and lean toward the pointer. The camera is the choreo runtime's scene progress
// (--p on the story, measured while its stage is stuck); this design's own script adds each chapter's progress and
// lights the lanterns one by one. After the story: the workshop photo with its caption, the collection, shipping and
// returns as a roadmap, questions. No fog, no glow, no flicker loops. Reduced motion and no script: the scene is a
// still behind the first chapter and the chapters read as a normal page. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

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
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="lw ci-w" data-ci-part>${[...w].map((ch) => `<span class="ch" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`))
    .join('');
}

// The scene: flat planes, back to front. Each plane is its own SVG so the camera can move it at its own depth.
const TREE = '<symbol id="nf-t" viewBox="0 0 100 200"><path d="M50 0 64 42H57L75 84H63L86 128H67L94 172H55V200H45V172H6L33 128H14L37 84H25L43 42H36Z"/></symbol>';
const MAPLE = '<symbol id="nf-m" viewBox="0 0 120 160"><path d="M57 160V96L44 80 50 78 60 90 70 70 76 73 64 98V160Z"/><circle cx="60" cy="52" r="34"/><circle cx="30" cy="70" r="24"/><circle cx="92" cy="66" r="26"/><circle cx="62" cy="22" r="20"/></symbol>';
const trees = (list) => list.map(([x, y, s, m]) => `<use href="#nf-${m ? 'm' : 't'}" x="${x}" y="${y}" width="${Math.round(100 * s * (m ? 1.2 : 1))}" height="${Math.round(200 * s * (m ? 0.8 : 1))}"/>`).join('');
function scene() {
  const svg = (cls, inner, extra = '') => `<svg class="nf-l ${cls}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"${extra}>${inner}</svg>`;
  const lantern = (x, s, i) => `<g class="nf-lan" style="--i:${i}" transform="translate(${x} ${Math.round(900 - 150 * s)}) scale(${s})"><path class="nf-stone" d="M4 30 20 19 36 30ZM18 14h4v5h-4ZM16 46h8v30h-8ZM8 76h24v8H8Z"/><rect class="nf-fire" x="10" y="30" width="20" height="16" rx="2"/></g>`;
  return `<div class="nf-stage" aria-hidden="true" data-sc-stage data-ci="subject">
<svg width="0" height="0" class="nf-defs"><defs>${TREE}${MAPLE}</defs></svg>
<div class="nf-sky"><span class="nf-moon" data-alive="0.7"></span></div>
${svg('nf-ridge', '<path d="M0 640 120 560 260 610 420 500 560 590 700 520 820 470 960 560 1120 480 1260 560 1400 500 1600 580V900H0Z"/>')}
${svg('nf-far', trees([[40, 470, 1.6], [180, 500, 1.4, 1], [330, 460, 1.7], [470, 520, 1.3], [1080, 500, 1.4], [1210, 470, 1.6, 1], [1360, 490, 1.5], [1490, 460, 1.7]]) + '<path d="M0 820H1600V900H0Z"/>')}
${svg('nf-path', '<path d="M700 900 788 610H812L900 900Z"/>')}
${svg('nf-gate', '<g transform="translate(640 430)"><path d="M-24 34Q160 6 344 34L338 54Q160 28-18 54Z"/><path d="M28 92H292V108H28Z"/><path d="M68 50H92V330H68ZM228 50H252V330H228ZM151 54H169V92H151Z"/></g>')}
${svg('nf-lamps', lantern(600, 1.25, 0) + lantern(960, 1.25, 1) + lantern(470, 1.8, 2) + lantern(1080, 1.8, 3))}
${svg('nf-mid', trees([[-30, 300, 3, 1], [150, 360, 2.6], [1290, 330, 2.8], [1440, 300, 3, 1]]))}
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
${name !== c.name ? `<p class="nf-kick" data-ci="then">${esc(c.name)}</p>` : `<p class="nf-kick" data-ci="then">${esc(c.heroTitle !== name ? c.heroTitle : c.whatShort || '')}</p>`}
<h1 id="hero-title" data-ci="head" class="nf-name${[...name].length > 14 ? ' long' : ''}" aria-label="${esc(name)}"><span aria-hidden="true">${letters(name)}</span></h1>
<p class="nf-sub" data-ci="then">${esc(sub)}</p>
<div class="nf-ctas" data-ci="then">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>
</div></article>`;

  const ch2 = `<article class="nf-ch nf-ch2" aria-labelledby="ch2-title"><div class="nf-ch-in">
${num(1)}
<h2 class="nf-h2" id="ch2-title" data-split>${esc(c.owner && c.owner !== c.name ? `From ${c.owner}${c.city && !c.online ? ` in ${c.city}` : ''}` : c.city ? `From ${c.city}` : `About ${c.name}`)}</h2>
${paras.slice(0, 2).filter(Boolean).map((p, i) => `<p class="nf-p" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<svg class="nf-route" viewBox="0 0 400 120" aria-hidden="true"><path d="M8 96C60 92 70 40 120 46S180 104 236 82 300 20 352 30 388 54 392 50" pathLength="1"/><circle cx="392" cy="50" r="5"/></svg>
${c.city ? `<p class="nf-place" data-rv style="--d:4">${esc(c.city)}</p>` : ''}
</div></article>`;

  const ch3 = `<article class="nf-ch nf-ch3" aria-labelledby="ch3-title"><div class="nf-ch-in nf-show">
<div class="nf-show-copy">
${num(2)}
<h2 class="nf-h2" id="ch3-title" data-split>${esc(name)}</h2>
${paras[2] ? `<p class="nf-p" data-rv style="--d:2">${esc(paras[2])}</p>` : ''}
${specs.length ? `<ul class="nf-specs">${specs.map((x, i) => `<li style="--j:${i}"><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="nf-plinth"><div class="nf-piece" data-alive="1">${P.img(c, 'hero', { cls: 'nf-img' })}<span class="nf-rim" aria-hidden="true"></span></div><span class="nf-stone-top" aria-hidden="true"></span></div>
</div></article>`;

  const facts = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.email && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const priced = c.services.filter((s) => s.name);
  const endTitle = waitlist ? c.ctaTitle : priced.length > 1 ? 'Choose yours.' : `Get ${name}.`;
  const ch4 = `<article class="nf-ch nf-ch4" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title"><div class="nf-ch-in nf-end">
${num(3)}
<h2 class="nf-h2 big" id="buy-title" data-split>${esc(endTitle)}</h2>
${waitlist && c.ctaSub ? `<p class="nf-p" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${waitlist
  ? `<div class="nf-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="nf-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>`}
${facts.length ? `<dl class="nf-facts" data-rv style="--d:4">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
</div></article>`;

  const story = `<section class="nf-story" id="story" data-sc aria-label="${esc(`The story of ${name}`)}">
${scene()}
${ch1}
${ch2}
${ch3}
${ch4}
</section>`;

  // The collection, shipping and returns as a roadmap (each piece with its price, then the member's own shipping and
  // returns), drawn in with the scroll and ending at the Buy button.
  const work = c.images.work
    ? `<section class="nf-work" aria-label="${esc(`Where ${c.name} is made`)}"><figure class="wrap nf-work-in"><div class="nf-work-frame">${P.img(c, 'work', { cls: 'nf-work-img' }).replace('<img ', '<img data-par="0.05" ')}</div><figcaption><span>${esc(c.owner && c.owner !== c.name ? `${c.owner}, ${c.name}` : c.name)}</span>${c.city ? `<span>${esc(c.city)}</span>` : ''}</figcaption></figure></section>`
    : '';
  const collection = buy.kind === 'form' ? '' : roadmap({ id: 'collection', cls: 'nf-road', title: priced.length > 1 ? 'Choose yours.' : 'Order to door.', nodes: [...priced.map((s) => ({ title: s.name, meta: s.priceText || '', sub: s.blurb || '' })), c.shipping && { title: 'Shipping', sub: c.shipping }, c.returns && { title: 'Returns', sub: c.returns }], end: P.button(buy, 'btn btn-primary'), endLabel: name });

  const reviews = c.reviews.length
    ? `<section class="nf-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="nf-h2" id="reviews-title">Kind words</h2><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';
  const faq = c.faq.length
    ? `<section class="nf-sec" id="faq" aria-labelledby="faq-title"><div class="wrap nf-faq"><h2 class="nf-h2" id="faq-title">Questions.</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const m = motion();
  const body = [P.header(c, { cls: 'nf-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', story, work, collection, reviews, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '4px', btnRadius: '2px', max: '80rem' } };
}

// The camera is the choreo runtime's scene progress (--p on the story, measured while the stage is stuck). This adds
// each chapter's own progress (--k) for its type and drawings, and lights the lanterns one by one. Off for reduced
// motion.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,st=d.querySelector('.nf-story');if(!st)return;var chs=[].slice.call(st.querySelectorAll('.nf-ch')),lan=[].slice.call(st.querySelectorAll('.nf-lan')),t=false;
function cl(v){return v<0?0:v>1?1:v}
function f(){t=false;var vh=innerHeight,r=st.getBoundingClientRect(),p=cl(-r.top/Math.max(1,r.height-vh));
lan.forEach(function(l,i){l.classList.toggle('on',p>=i*.025)});
chs.forEach(function(c){var b=c.getBoundingClientRect();c.style.setProperty('--k',cl((vh-b.top)/(b.height+vh)).toFixed(4))})}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);--night:color-mix(in srgb,var(--primary) 10%,var(--dark));--glow:color-mix(in srgb,var(--primary-on-dark) 30%,#ffcf8a);background:var(--dark);color:var(--on-dark)}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
.btn-sm{min-height:2.5rem;padding:.45rem 1.05rem;font-size:.875rem}
.btn{letter-spacing:.04em}
.btn-line{background:transparent;border:1px solid var(--edge);color:var(--on-dark)}
.btn-line:hover{border-color:var(--on-dark)}
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;transition:background-color .3s ease}
.hdr.scrolled{background:var(--dark);border-bottom:1px solid var(--edge)}
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
.nf-kick{font-size:1rem;font-weight:500;letter-spacing:0;color:color-mix(in srgb,var(--on-dark) 82%,var(--dark))}
.nf-h2{font-size:clamp(2.4rem,1.6rem + 3.4vw,4.6rem);line-height:1;text-wrap:balance}
.nf-h2.big{font-size:clamp(2.8rem,1.8rem + 4.4vw,6rem)}
.nf-p{margin-top:1.2rem;max-width:34rem;font-size:clamp(1.05rem,1rem + .3vw,1.25rem);line-height:1.65;color:color-mix(in srgb,var(--on-dark) 84%,var(--dark))}
.nf-num{display:block;width:2.6rem;height:2.6rem;margin-bottom:1.1rem;color:var(--primary-on-dark)}
.nf-num svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
html.m .nf-num path{stroke-dasharray:1;stroke-dashoffset:calc(1 - min(1,var(--k,.5) * 4))}
/* the scene */
.nf-story{--p:0;position:relative;isolation:isolate}
.nf-stage{position:absolute;left:0;right:0;top:0;height:100vh;height:100svh;overflow:hidden;z-index:0;background:var(--dark);pointer-events:none}
html.m .nf-stage{position:sticky;margin-bottom:-100vh;margin-bottom:-100svh}
.nf-defs{position:absolute}
.nf-sky{position:absolute;inset:0;background:linear-gradient(180deg,var(--dark) 0%,var(--night) 55%,color-mix(in srgb,var(--primary) 6%,var(--dark)) 100%);transform:translate3d(0,calc(var(--p) * 6vh),0)}
.nf-sky::before{content:'';position:absolute;inset:0 0 40%;background-image:radial-gradient(1px 1px at 12% 22%,var(--on-dark),transparent),radial-gradient(1px 1px at 28% 12%,var(--on-dark),transparent),radial-gradient(1.5px 1.5px at 44% 28%,var(--on-dark),transparent),radial-gradient(1px 1px at 63% 9%,var(--on-dark),transparent),radial-gradient(1px 1px at 78% 24%,var(--on-dark),transparent),radial-gradient(1.5px 1.5px at 90% 14%,var(--on-dark),transparent),radial-gradient(1px 1px at 6% 40%,var(--on-dark),transparent),radial-gradient(1px 1px at 55% 40%,var(--on-dark),transparent);opacity:.55}
.nf-moon{position:absolute;left:64%;top:16%;width:clamp(4rem,7vw,7rem);aspect-ratio:1;border-radius:50%;background:radial-gradient(28% 22% at 34% 40%,color-mix(in srgb,var(--on-dark) 80%,var(--night)),transparent),radial-gradient(18% 16% at 62% 62%,color-mix(in srgb,var(--on-dark) 78%,var(--night)),transparent),radial-gradient(14% 12% at 58% 30%,color-mix(in srgb,var(--on-dark) 84%,var(--night)),transparent),radial-gradient(circle at 38% 34%,var(--on-dark) 40%,color-mix(in srgb,var(--on-dark) 66%,var(--night)));opacity:clamp(0,calc((.8 - var(--p)) * 6),1)}
.nf-l{position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 64%;transform:translate3d(0,calc(var(--p) * var(--dy,0vh)),0) scale(calc(1 + var(--p) * var(--z,0)));will-change:transform}
.nf-ridge{--z:.18;fill:color-mix(in srgb,var(--on-dark) 7%,var(--night))}
.nf-far{--z:.9;--dy:4vh;fill:color-mix(in srgb,var(--on-dark) 4%,var(--dark))}
.nf-far use:nth-child(2),.nf-far use:nth-child(6){fill:color-mix(in srgb,var(--primary) 30%,var(--dark))}
.nf-path{--z:2.6;--dy:10vh;fill:color-mix(in srgb,var(--on-dark) 7%,var(--dark))}
.nf-gate{--z:7;--dy:18vh;fill:color-mix(in srgb,var(--primary) 82%,var(--dark));opacity:clamp(0,calc((.5 - var(--p)) * 9),1);transform-origin:50% 72%}
.nf-lamps{--z:3.2;--dy:14vh;opacity:clamp(0,calc((.62 - var(--p)) * 6),1)}
.nf-stone{fill:color-mix(in srgb,var(--on-dark) 12%,var(--dark))}
.nf-fire{fill:var(--glow)}
html.m .nf-lan .nf-fire{fill:color-mix(in srgb,var(--on-dark) 10%,var(--dark));transition:fill .6s ease}
html.m .nf-lan.on .nf-fire{fill:var(--glow)}
.nf-mid{--z:4;--dy:8vh;fill:color-mix(in srgb,var(--on-dark) 2%,#000);transform-origin:50% 55%}
.nf-mid use:nth-child(1),.nf-mid use:nth-child(4){fill:color-mix(in srgb,var(--primary) 34%,#000)}
.nf-near{--z:6;fill:#000;transform-origin:50% 50%;opacity:clamp(0,calc((.4 - var(--p)) * 5),1)}
.nf-vig{position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--dark) 70%,transparent),transparent 55%)}
@media (max-width:47.99rem){.nf-far use:nth-child(n+5),.nf-mid use:nth-child(2),.nf-mid use:nth-child(3){display:none}.nf-moon{left:auto;right:8%;top:9%;width:3.2rem;opacity:clamp(0,calc((.12 - var(--p)) * 12),1)}.nf-vig{background:linear-gradient(0deg,color-mix(in srgb,var(--dark) 85%,transparent) 18%,transparent 62%)}html.m .nf-ch3 .nf-ch-in{position:relative;opacity:1}html.m .nf-ch3{min-height:0}.nf-plinth{max-width:20rem}}
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
.nf-name.long{font-size:clamp(3rem,1rem + 8vw,9.6rem);max-width:11ch}
.nf-name .lw{display:inline-block;white-space:nowrap}
.nf-name .ch{display:inline-block}
.nf-name .ci-pop{background-position:0 88%}
.nf-sub{margin-top:1.2rem;max-width:30rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.45;color:color-mix(in srgb,var(--on-dark) 86%,var(--dark))}
.nf-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.4rem;margin-top:2rem}
.nf-from{font-size:1.05rem;color:var(--muted);letter-spacing:.04em}
.nf-route{width:min(100%,26rem);margin-top:2rem;overflow:visible}
.nf-route path{fill:none;stroke:var(--pop);stroke-width:2.5;stroke-linecap:round}
.nf-route circle{fill:var(--pop)}
html.m .nf-route path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--k) - .3) * 3,1))}
html.m .nf-route circle{opacity:clamp(0,(var(--k) - .55) * 8,1)}
.nf-place{display:flex;align-items:center;gap:.8rem;margin-top:.8rem;font-size:.95rem;color:var(--muted)}.nf-place::before{content:'';width:2.5rem;height:1px;background:currentColor}
.nf-show{gap:2.5rem}
@media (min-width:56rem){.nf-show{grid-template-columns:1fr 1fr;align-items:center;gap:4rem}}
.nf-specs{display:grid;gap:.2rem;margin-top:1.8rem;width:100%;max-width:30rem}
.nf-specs li{display:flex;align-items:center;gap:1rem;padding:.7rem 0;font-size:1rem;line-height:1.4}
.nf-specs li::before{content:'';flex:none;width:3.5rem;height:2px;background:var(--pop);transform-origin:0 50%}
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
.nf-facts{display:grid;width:min(100%,30rem);margin:2rem auto 0;text-align:left;text-shadow:none}
.nf-facts div{display:grid;grid-template-columns:7rem minmax(0,1fr);gap:1rem;padding:.7rem 0;border-top:1px solid var(--edge)}
.nf-facts dt{font-weight:500}
.nf-facts dd{margin:0;color:var(--muted)}
.nf-facts a{color:var(--on-dark)}
.field input,.field select,.field textarea{background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));border-color:var(--edge)}
/* after the story */
.nf-sec{position:relative;z-index:1;padding-block:clamp(5rem,3.5rem + 5vw,9rem);border-top:1px solid var(--edge);background:var(--dark)}
.nf-road{position:relative;z-index:1;background:var(--dark);border-top:1px solid var(--edge);--rm-ink:var(--on-dark);--rm-muted:var(--muted-on-dark);--rm-line:var(--edge);--rm-accent:var(--pop);--rm-dot-bg:var(--dark)}
.nf-road .h2{font-size:clamp(2.4rem,1.6rem + 3.4vw,4.6rem);line-height:1;font-weight:400}
.nf-road .rm-txt h3{font-size:clamp(1.35rem,1.15rem + .6vw,1.75rem);font-weight:400}
.nf-road .rm-meta{font-weight:500;color:var(--on-dark);letter-spacing:.04em}
.nf-road .rm-dot{border-width:1px;font-family:var(--font-body);font-weight:500}
.nf-faq{display:grid;gap:2rem}
@media (min-width:60rem){.nf-faq{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem;font-weight:500}
.faq .ans{padding:0 0 1.25rem}
.review{background:transparent;border-color:var(--edge)}
.ftr{position:relative;z-index:1;background:var(--dark);border-top:1px solid var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none}
.btn-primary{box-shadow:none}
.nf-work{position:relative;z-index:1;background:var(--dark);padding-block:clamp(4rem,3rem + 4vw,7rem) 0}
.nf-work-frame{overflow:hidden;aspect-ratio:4/5;border-radius:2px}
@media (min-width:48rem){.nf-work-frame{aspect-ratio:16/8}}
.nf-work-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.nf-work figcaption{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.4rem 2rem;padding-top:1rem;font-size:.95rem;color:var(--muted)}
.nf-work figcaption span:first-child{color:var(--on-dark)}
.mbar .btn-ghost{color:var(--on-dark)}
@media (prefers-reduced-motion:reduce){.nf-l,.nf-sky{transform:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Nightfall',
  bestFor: 'A maker or brand with a story to tell: knives, spirits, tools, small-batch goods sold online',
  match: /\b(knives|knife|knifemaker|bladesmith|blacksmith|hand-?forged|forged|forge|sake|whisk(e)?y|distiller(y|s)?|incense)\b/,
  why: 'Built for a maker with a story: night falls as the page opens, then scroll moves a camera through a night forest in your colors, chapter by chapter, past a gate and lit lanterns to your product under a rim light, and your collection draws in as a route to the Buy button.',
  fonts: { q: 'family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600', display: ['Instrument Serif', 'serif'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): night falling over the scene, a moon and a blade that drift, a camera on scroll.
  choreo: { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'scene', pace: 'calm', look: 'cinematic, dark, slow' },
  tokens,
  slots,
  nav,
  render,
};
