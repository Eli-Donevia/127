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
//   class "mq"            marquee: put the items twice inside .mq-track (the second copy aria-hidden)
//   class "prog"          a reading progress bar at the top (scroll-driven CSS where the browser has it)
//   data-hdr              the header gets class "scrolled" once the page moves

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
.mq{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.mq-track{display:flex;width:max-content;animation:mq var(--mq-speed,38s) linear infinite}
.mq:hover .mq-track{animation-play-state:paused}
.mq-rev .mq-track{animation-direction:reverse}
@keyframes mq{to{transform:translateX(-50%)}}
.prog{position:fixed;left:0;right:0;top:0;z-index:60;height:2px;background:var(--primary);transform-origin:0 50%;transform:scaleX(0)}
@supports (animation-timeline:scroll()){.prog{animation:prog linear both;animation-timeline:scroll(root)}@keyframes prog{to{transform:scaleX(1)}}}
@media (prefers-reduced-motion:reduce){.mq-track{animation:none}.prog{display:none}::view-transition-old(root),::view-transition-new(root){animation:none}[data-par],[data-mag]{transform:none!important}}
`;

// Plain ES2017, no build step. Runs once at the end of <body>.
const MOTION_JS = `(function(){
var d=document,h=d.documentElement,q=function(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s))};
var calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
q('[data-split]').forEach(function(el){if(el.querySelector('.w'))return;var i=0;var walk=function(n){Array.prototype.slice.call(n.childNodes).forEach(function(c){if(c.nodeType===3){var f=d.createDocumentFragment();c.textContent.split(/(\\s+)/).forEach(function(t){if(!t)return;if(/^\\s+$/.test(t)){f.appendChild(d.createTextNode(t));return}var w=d.createElement('span'),s=d.createElement('span');w.className='w';s.textContent=t;s.style.setProperty('--i',i++);w.appendChild(s);f.appendChild(w)});n.replaceChild(f,c)}else if(c.nodeType===1&&!/^(BR|SVG)$/i.test(c.tagName))walk(c)})};walk(el)});
if(calm)return;
h.classList.add('m');
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

module.exports = { motion, MOTION_CSS, MOTION_JS };
