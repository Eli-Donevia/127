// Motion for the animated designs (lib/templates/motion): one small stylesheet and one small script every animated
// design shares, so a page stays fast (about 3 KB of script, no libraries) and every design moves the same careful way.
// The page reads and works with JavaScript off and with reduced motion: nothing is hidden until the script has run and
// said motion is fine (it adds class "m" to <html>), and reduced motion never gets that class.
//
// Hooks a design can use in its markup:
//   data-rv               reveals when scrolled into view (fade up). data-rv="mask" wipes its children in from the bottom
//                         (put it on the box around an image, not the image), "scale" grows it
//                         in, "left"/"right" slide in. style="--d:2" staggers it (each step is 70 ms).
//   data-split            kinetic type: the words rise in one after another (on load, or on view inside data-rv)
//   data-par="0.12"       parallax: moves at that fraction of the scroll, while on screen
//   data-mag              magnetic: a button leans toward the pointer
//   data-spot             spotlight: a soft light follows the pointer across a card (--mx, --my)
//   data-count            ticks through its own text once on view (letters shuffle into place; never invents numbers)
//   class "prog"          a reading progress bar at the top (scroll-driven CSS where the browser has it)
//   data-hdr              the header gets class "scrolled" once the page moves
// Every animated page also gets a "Pause motion" button (in the footer, else at the end of the page) that stops every
// looping animation: marquees, drifting light, turning badges (WCAG 2.2.2, Legal L76 W5).
//
// Choreography (the premium pass, lib/choreo.md has the full schema with an example per preset). A design module can
// declare its motion as data instead of hand-written animation code:
//   choreo: { intro: 'assemble' | 'develop' | 'pour' | 'unfold' | 'type' | 'mask' | 'stamp' | 'draw' | 'none',
//             alive: ['drift' | 'pointer' | 'tap' | 'scroll'] or ['still'],
//             scroll: 'scrub' | 'pin' | 'scene' | 'roadmap' | 'none',
//             pace: 'calm' | 'medium' | 'fast',
//             look: 'free words, kept and passed through' }
// Every field is optional; an unknown value falls back to the design's own value, then to CHOREO_DEFAULTS (never
// throws). A site brief's `motion` (site.build input) overrides the design's block field by field (resolveChoreo).
// The markup carries the hooks the runtime (lib/choreo-client.js, driving the vendored Motion bundle) reads:
//   data-ci="head"        the headline: its words or letters play the intro (or its own [data-ci-part] pieces)
//   data-ci="subject"     the hero's main thing (photo, product, card): it forms the intro's way
//   data-ci="then"        what follows (lead, buttons): rises in once the idea has played, in page order
//   data-alive="1"        moves at rest on springs (strength 0.2 to 2); put it on an element inside a data-ci one
//   data-sc               the scroll moment's section; data-sc-part its pieces (each gets --pi and class "on");
//                         data-sc-stage the box that sticks when the moment is "pin"; the section gets --p (0 to 1)
//   data-sx="0.3"         a band that slides sideways with the page scroll (replaces a looping marquee)
//   data-rm               a roadmap section (lib/templates/roadmap.js): its line draws and its nodes pop in, in order, with
//                         the scroll, whatever the scroll preset (except "none"); html gets class "rm-go" while it runs
// Only pages of designs with choreo carry the bundle (motion.js beside index.html, loaded with defer; the one-file
// preview inlines it). JavaScript off and reduced motion: nothing is hidden, the page is complete and still.

const MOTION_CSS = `
html,body{overflow-x:clip}
@view-transition{navigation:auto}
::view-transition-old(root){animation:.35s cubic-bezier(.4,0,.2,1) both mvOut}
::view-transition-new(root){animation:.5s cubic-bezier(.2,.8,.2,1) both mvIn}
@keyframes mvOut{to{opacity:0;transform:translateY(-8px)}}
@keyframes mvIn{from{opacity:0;transform:translateY(12px)}}
html.m [data-rv]{opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.2,.8,.2,1),transform 1.1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--d,0) * 70ms)}
html.m [data-rv=scale]{transform:scale(.94)}
html.m [data-rv=left]{transform:translateX(-36px)}
html.m [data-rv=right]{transform:translateX(36px)}
html.m [data-rv].in{opacity:1;transform:none}
html.m [data-rv=mask]{opacity:1;transform:none}
html.m [data-rv=mask]>*{clip-path:inset(100% 0 0 0);transition:clip-path 1.3s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms)}
html.m [data-rv=mask].in>*{clip-path:inset(0)}
html.m [data-split] .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}
html.m [data-split] .w>span{display:inline-block;transform:translateY(105%);transition:transform 1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i,0) * 55ms + var(--d,0) * 70ms)}
html.m [data-split].in .w>span{transform:none}
[data-par]{will-change:transform}
[data-mag]{transition:transform .5s cubic-bezier(.2,.8,.2,1)}
[data-mag].mag-on{transition:transform .12s linear}
[data-spot]{--mx:50%;--my:50%;position:relative;isolation:isolate}
[data-spot]::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;background:radial-gradient(22rem 22rem at var(--mx) var(--my),var(--spot,rgba(255,255,255,.12)),transparent 60%);opacity:0;transition:opacity .4s ease}
[data-spot]:hover::before{opacity:1}
.prog{position:fixed;left:0;right:0;top:0;z-index:60;height:2px;background:var(--primary);transform-origin:0 50%;transform:scaleX(0)}
@supports (animation-timeline:scroll()){.prog{animation:prog linear both;animation-timeline:scroll(root)}@keyframes prog{to{transform:scaleX(1)}}}
html.mp *,html.mp *::before,html.mp *::after{animation-play-state:paused!important}
.mpause{display:block;margin:1.25rem auto 0;padding:.4em 1em;border:1px solid currentColor;border-radius:999px;background:none;color:inherit;font:inherit;font-size:.8rem;line-height:1.2;opacity:.75;cursor:pointer}
.mpause:hover,.mpause:focus-visible{opacity:1}
@media (prefers-reduced-motion:reduce){.prog{display:none}::view-transition-old(root),::view-transition-new(root){animation:none}[data-par],[data-mag]{transform:none!important}}
`;

// Plain ES2017, no build step. Runs once at the end of <body>.
const MOTION_JS = `(function(){
var d=document,h=d.documentElement,q=function(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s))};
var calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
q('[data-split]').forEach(function(el){if(el.querySelector('.w'))return;var i=0;var walk=function(n){Array.prototype.slice.call(n.childNodes).forEach(function(c){if(c.nodeType===3){var f=d.createDocumentFragment();c.textContent.split(/(\\s+)/).forEach(function(t){if(!t)return;if(/^\\s+$/.test(t)){f.appendChild(d.createTextNode(t));return}var w=d.createElement('span'),s=d.createElement('span');w.className='w';s.textContent=t;s.style.setProperty('--i',i++);w.appendChild(s);f.appendChild(w)});n.replaceChild(f,c)}else if(c.nodeType===1&&!/^(BR|SVG)$/i.test(c.tagName))walk(c)})};walk(el)});
if(calm)return;
h.classList.add('m');
var pb=d.createElement('button');pb.type='button';pb.className='mpause';pb.setAttribute('aria-pressed','false');pb.textContent='Pause motion';
pb.addEventListener('click',function(){var p=h.classList.toggle('mp');pb.setAttribute('aria-pressed',p?'true':'false');pb.textContent=p?'Play motion':'Pause motion'});
(d.querySelector('footer')||d.body).appendChild(pb);
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);e.target.querySelectorAll('[data-split]').forEach(function(s){s.classList.add('in')});if(e.target.hasAttribute('data-count'))shuffle(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.12});
q('[data-rv],[data-split],[data-count]').forEach(function(el){if(!el.closest('[data-rv]')||el.hasAttribute('data-rv'))io.observe(el)});
function shuffle(el){var t=el.textContent,n=0,G='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';var k=setInterval(function(){n+=1;el.textContent=t.split('').map(function(ch,i){return i<n/2||ch===' '?ch:G[(Math.random()*G.length)|0]}).join('');if(n/2>=t.length){clearInterval(k);el.textContent=t}},28)}
var par=q('[data-par]'),hdr=d.querySelector('[data-hdr]'),tick=false;
function frame(){tick=false;var vh=innerHeight;par.forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;var k=parseFloat(el.getAttribute('data-par'))||.1;el.style.transform='translate3d(0,'+((r.top+r.height/2-vh/2)*-k).toFixed(1)+'px,0)'});if(hdr)hdr.classList.toggle('scrolled',scrollY>12)}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(frame)}},{passive:true});frame();
if(matchMedia('(hover: hover)').matches){
q('[data-mag]').forEach(function(el){el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect();el.classList.add('mag-on');el.style.transform='translate('+((e.clientX-r.left-r.width/2)*.22).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.3).toFixed(1)+'px)'});el.addEventListener('pointerleave',function(){el.classList.remove('mag-on');el.style.transform=''})});
q('[data-spot]').forEach(function(el){el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect();el.style.setProperty('--mx',(e.clientX-r.left)+'px');el.style.setProperty('--my',(e.clientY-r.top)+'px')})});
}
})();`;

// { css, script } for a design to add to its own.
function motion() {
  return { css: MOTION_CSS, script: MOTION_JS };
}

// ---- choreography -------------------------------------------------------------------------------------------------

// Every accepted value, with what it does (code can list them; the site brief picks from them).
const CHOREO_PRESETS = {
  intro: {
    assemble: 'the headline letters fly in from scattered places and lock together on a firm spring; the subject lands and settles',
    develop: 'the subject develops like a photograph (blur, grey and bright to sharp and full color); the words come into focus one by one',
    pour: 'the letters drop in left to right like something poured, settling as they land; the subject fills from the bottom up',
    unfold: 'the words unfold upward from their baseline like a turned page; the subject opens from its center',
    type: 'the headline is typed out letter by letter with a caret; the subject wipes on from the left',
    mask: 'the words rise out of their own baseline as if from behind a rule; the subject is uncovered from the bottom up',
    stamp: 'each word is pressed onto the page a beat apart, like type in a press; the subject is printed in with a flash of ink',
    draw: "the words settle from wide tracking; the subject's own line drawing draws itself",
    none: 'no intro: the hero is there at once',
  },
  alive: {
    drift: 'drifts and breathes slowly on soft springs (a new resting place every few seconds)',
    pointer: 'leans toward the pointer on a spring (mouse and trackpad only)',
    tap: 'gives a small, firm spring when tapped or clicked',
    scroll: 'lags and tilts a little with the scroll speed, then settles',
    still: 'no motion at rest (only when it is the one value)',
  },
  scroll: {
    scrub: 'the section\'s pieces move with the scroll, in order, and back when scrolling up',
    pin: 'the section holds on screen while its pieces step through one by one (phones: unpinned, the pieces light as they pass)',
    scene: 'the section changes scene as it crosses the screen: its pieces move at their own depth and turn',
    roadmap: "the design's roadmap (the member's steps, services or what's included, drawn as a line of nodes) is the one scroll moment; other data-sc sections stay still",
    none: 'no scroll moment',
  },
  pace: { calm: 'slower and softer (1.3x)', medium: 'as designed', fast: 'quicker and snappier (0.78x)' },
};
const CHOREO_DEFAULTS = { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'scrub', pace: 'medium', look: '' };
const PACE = { calm: 1.3, medium: 1, fast: 0.78 };
const LOOK_MAX = 200;

// One field, cleaned against a fallback. Unknown values never throw: they take the fallback.
function cleanField(key, v, fb) {
  if (key === 'alive') {
    const list = (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter((x) => typeof x === 'string' && Object.prototype.hasOwnProperty.call(CHOREO_PRESETS.alive, x));
    const uniq = [...new Set(list)];
    const moving = uniq.filter((x) => x !== 'still');
    if (moving.length) return moving;
    return uniq.length ? ['still'] : fb;
  }
  if (key === 'look') return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, LOOK_MAX) : fb;
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHOREO_PRESETS[key], v) ? v : fb;
}

// The design's block, then a brief's override on top, field by field: { intro, alive, scroll, pace, look }.
function resolveChoreo(base, override) {
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const b = obj(base), o = obj(override), out = {};
  for (const key of Object.keys(CHOREO_DEFAULTS)) {
    const own = cleanField(key, b[key], CHOREO_DEFAULTS[key]);
    out[key] = key in o ? cleanField(key, o[key], own) : own;
  }
  return out;
}

const fs = require('fs');
const path = require('path');
const VENDOR = path.join(__dirname, '..', 'vendor');
let bundleCache = null;
// The vendored Motion bundle (vendor/motion-sites.js, MIT) and its license, read once.
function motionBundle() {
  if (!bundleCache) bundleCache = { js: fs.readFileSync(path.join(VENDOR, 'motion-sites.js'), 'utf8').trim(), license: fs.readFileSync(path.join(VENDOR, 'MOTION-LICENSE.md'), 'utf8') };
  return bundleCache;
}
let clientCache = null;
function choreoClient() {
  if (!clientCache) {
    clientCache = fs
      .readFileSync(path.join(__dirname, 'choreo-client.js'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
  }
  return clientCache;
}

// The CSS a resolved block needs (only its presets' rules), all behind html.m so JS off and reduced motion stay still.
function choreoCss(ch) {
  // --pop: the member's own colour as light on the subject (their brand colour, contrast-safe on the page). Used for the
  // intro's colour trail, one line drawn under the head's last word, roadmap draw-ins and hover states; never a fill.
  const css = [':root{--pop:var(--primary-text,var(--primary))}',
    'main a:not(.btn):hover{text-decoration-color:var(--pop);text-decoration-thickness:.12em}'];
  if (ch.intro !== 'none') {
    // Hidden only until the runtime takes over; if it never does, the pieces show anyway after 2.6 s.
    css.push('html.m:not(.ci-go) [data-ci]{opacity:0;animation:ciSafe 0s 2.6s forwards}@keyframes ciSafe{to{opacity:1}}');
    css.push('.ci-w{display:inline-block;white-space:nowrap}.ci-c{display:inline-block;position:relative}');
    css.push('.ci-pop{padding-bottom:.16em;margin-bottom:-.16em;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0% min(.07em,.36rem) no-repeat;transition:background-size .9s cubic-bezier(.65,0,.35,1)}.ci-pop.ci-pop-on{background-size:100% min(.07em,.36rem)}');
    if (ch.intro === 'type') css.push(".ci-typing .ci-at::after{content:'';position:absolute;left:100%;top:.14em;bottom:.08em;width:.07em;margin-left:.03em;background:var(--pop,currentColor);animation:ciBlink .8s steps(1) infinite}@keyframes ciBlink{50%{opacity:0}}");
  }
  if (!(ch.alive.length === 1 && ch.alive[0] === 'still')) css.push('html.m [data-alive]{will-change:transform;transform-style:preserve-3d}');
  if (ch.scroll === 'scrub') css.push('html.m [data-sc] [data-sc-part]{transform:translate3d(calc((1 - var(--pi,1)) * var(--sx,0px)),calc((1 - var(--pi,1)) * var(--sy,4rem)),0) scale(calc(.9 + var(--pi,1) * .1))}html.m [data-sc] [data-sc-line]{transform-origin:0 50%;transform:scaleX(var(--p,1))}');
  if (ch.scroll === 'pin') css.push('@media (min-width:48rem) and (hover:hover){html.m [data-sc]{height:calc(100vh + var(--n,3) * 70vh);height:calc(100svh + var(--n,3) * 70svh)}html.m [data-sc] [data-sc-stage]{position:sticky;top:0;min-height:100vh;min-height:100svh}}');
  if (ch.scroll === 'scene') css.push('html.m [data-sc] [data-sc-part]{transform:translate3d(0,calc((.5 - var(--p,.5)) * var(--depth,1) * 13rem),0) rotate(calc((var(--p,.5) - .5) * var(--turn,0deg)))}@media (max-width:47.99rem){html.m [data-sc] [data-sc-part]{transform:translate3d(0,calc((.5 - var(--p,.5)) * var(--depth,1) * 4rem),0)}}');
  return css.join('\n');
}

// What a page of a choreo design adds: { css, script (inline, end of body), head (the deferred bundle), bundle, license }.
function choreoAssets(ch) {
  const cfg = { intro: ch.intro, alive: ch.alive, scroll: ch.scroll, k: PACE[ch.pace] || 1, look: ch.look };
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  const b = motionBundle();
  return { css: choreoCss(ch), script: choreoClient().replace(/\(CHOREO\);?$/, `(${json});`), head: '<script defer src="motion.js"></script>', bundle: b.js, license: b.license };
}

module.exports = { motion, MOTION_CSS, MOTION_JS, CHOREO_PRESETS, CHOREO_DEFAULTS, PACE, resolveChoreo, choreoAssets, choreoCss, motionBundle };
