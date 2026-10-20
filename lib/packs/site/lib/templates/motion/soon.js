// Soon (animated, product, for a waitlist): one cinematic screen. The product's name fills the width in a tall serif,
// its letters rising out of a blur, while soft colored light drifts behind it (and leans toward the pointer) under a
// fine film grain. The email form sits front and center, the launch date shows only when the member gave one (with a
// live countdown when it is a full date), and what's coming types itself in, line by line.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'soon';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#000000', 0.68) };
}

function slots() {
  return [];
}

function nav(c) {
  return [{ label: 'Join the waitlist', href: '#signup' }, c.included.length && { label: "What's coming", href: '#coming' }, c.faq.length && { label: 'Questions', href: '#faq' }].filter(Boolean);
}

// A full date (with a day) gives a countdown; anything looser ("Spring 2027") is shown as written.
function launchDate(deadline) {
  const s = String(deadline || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d = null;
  if (iso) d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  else if (/\b\d{1,2}(st|nd|rd|th)?\b/.test(s.replace(/\b\d{4}\b/, '')) && /\b\d{4}\b/.test(s) && !Number.isNaN(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`))) d = new Date(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`));
  if (!d || Number.isNaN(d.getTime())) return { text: s, iso: '' };
  return { text: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`, iso: d.toISOString().slice(0, 10) };
}

function letters(s) {
  let i = 0;
  return String(s)
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="lw">${[...w].map((ch) => `<span class="ch" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`))
    .join('');
}

function render(c) {
  const name = c.productName || c.name;
  const date = launchDate(c.deadline);
  const len = [...name].length;
  const longest = Math.max(...name.split(/\s+/).map((w) => [...w].length));
  // Fit the name to the width: one line when short, wrapping by word when long (never a word wider than the screen).
  const fs = Math.max(9, Math.min(26, 200 / Math.max(len > 16 ? longest + 2 : len, 4)));
  const fsm = Math.max(fs, Math.min(30, 200 / (longest + 1)));
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const kicker = c.buy ? c.name : name === c.name ? 'Coming soon' : `${c.name} presents`;

  const form = P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: c.buy ? 'Keep me posted' : 'Join the waitlist', subject: `Waitlist for ${name}`, cls: 'sn-f' });

  const hero = `<section class="sn-hero" aria-labelledby="hero-title">
<div class="sn-light" aria-hidden="true"><span class="l1"></span><span class="l2"></span><span class="l3"></span></div>
<div class="sn-grain" aria-hidden="true"></div>
<div class="wrap sn-top">
<a class="sn-brand" href="#top"><span class="mark" aria-hidden="true">${esc(P.monogram(c.name))}</span><span>${esc(c.name)}</span></a>
${date ? `<p class="sn-date mono" data-rv style="--d:2">${icon('calendar', { size: 16 })}<span>${date.iso ? `<time datetime="${date.iso}">${esc(date.text)}</time>` : esc(date.text)}</span></p>` : P.socials(c, { cls: 'sn-soc', size: 18 })}
</div>
<div class="sn-stage">
<p class="sn-kicker mono" data-rv>${esc(kicker)}</p>
<h1 id="hero-title" class="sn-name" style="--fs:${fs.toFixed(1)}vw;--fsm:${fsm.toFixed(1)}vw" aria-label="${esc(name)}"><span aria-hidden="true">${letters(name)}</span></h1>
</div>
<div class="wrap sn-base">
<div class="sn-ask" id="signup">
<p class="sn-sub" data-rv style="--d:6">${esc(sub)}</p>
<div class="sn-form" data-rv style="--d:8">${form}</div>
${date && date.iso ? `<div class="sn-count mono" data-date="${date.iso}" hidden aria-hidden="true"><span><b data-u="d">0</b>days</span><span><b data-u="h">0</b>hrs</span><span><b data-u="m">0</b>min</span><span><b data-u="s">0</b>sec</span></div>` : ''}
${c.buy ? `<p class="sn-buy" data-rv style="--d:9"><a href="${esc(c.buy.href)}">${esc(c.buy.label)}${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}
</div>
${c.included.length ? `<div class="sn-coming" id="coming" data-rv style="--d:9">
<h2 class="mono">What's coming</h2>
<ol class="sn-list">${c.included.map((x, i) => `<li><span class="sn-i mono" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="sr-only">${esc(x)}</span><span class="sn-tw" aria-hidden="true" data-tw>${esc(x)}</span></li>`).join('')}</ol>
</div>` : ''}
</div>
</section>`;

  const about = c.aboutParas.length && c.about !== draftCopy({ ...c, about: '' }, 'product').about
    ? `<section class="sn-sec" aria-labelledby="about-title"><div class="wrap sn-narrow"><h2 class="sn-h2" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${c.name}`)}</h2>${c.aboutParas.map((p, i) => `<p class="sn-p" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sn-sec" id="faq" aria-labelledby="faq-title"><div class="wrap sn-faq"><h2 class="sn-h2" id="faq-title" data-split>Questions</h2><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  const m = motion();
  const body = ['<main id="main">', hero, about, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '18px', radiusSm: '14px', btnRadius: '999px', max: '84rem' } };
}

// The countdown (only for a full date, shown by script), the list typing in, the light leaning toward the pointer, and
// the phone bar that waits until the form has scrolled away. Reduced motion keeps the countdown and the bar only.
const JS = `(function(){var d=document,q=function(s){return [].slice.call(d.querySelectorAll(s))};
q('.sn-count').forEach(function(el){var t=Date.parse(el.getAttribute('data-date')+'T00:00:00');if(!(t>Date.now()))return;el.hidden=false;var u={};q('.sn-count [data-u]').forEach(function(b){u[b.getAttribute('data-u')]=b});function tick(){var s=Math.max(0,Math.floor((t-Date.now())/1000));u.d.textContent=Math.floor(s/86400);u.h.textContent=('0'+Math.floor(s%86400/3600)).slice(-2);u.m.textContent=('0'+Math.floor(s%3600/60)).slice(-2);u.s.textContent=('0'+s%60).slice(-2)}tick();setInterval(tick,1000)});
var bar=d.querySelector('.mbar'),ask=d.getElementById('signup');if(bar&&ask){bar.classList.add('wait');new IntersectionObserver(function(es){bar.classList.toggle('wait',es[0].isIntersecting||es[0].boundingClientRect.top>0)}).observe(ask)}
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var tw=q('[data-tw]');tw.forEach(function(e){e.setAttribute('data-full',e.textContent);e.textContent=''});
var list=d.querySelector('.sn-list');if(list){var go=function(){var i=0;(function next(){if(i>=tw.length)return;var e=tw[i++],f=e.getAttribute('data-full'),n=0;e.classList.add('on');var k=setInterval(function(){n+=1;e.textContent=f.slice(0,n);if(n>=f.length){clearInterval(k);e.classList.remove('on');setTimeout(next,160)}},24)})()};var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){io.disconnect();setTimeout(go,900)}},{threshold:.3});io.observe(list)}
var l=d.querySelector('.sn-light .l3');if(l&&matchMedia('(hover: hover)').matches){var x=.5,y=.5,tx=.5,ty=.5,run=false;addEventListener('pointermove',function(e){tx=e.clientX/innerWidth;ty=e.clientY/innerHeight;if(!run){run=true;requestAnimationFrame(step)}});function step(){x+=(tx-x)*.05;y+=(ty-y)*.05;l.style.setProperty('--px',(x*100).toFixed(2)+'%');l.style.setProperty('--py',(y*100).toFixed(2)+'%');if(Math.abs(tx-x)+Math.abs(ty-y)>.001)requestAnimationFrame(step);else run=false}}
})();`;

const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const CSS = `
${FOOTER_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);overflow-x:hidden}
.mono{font-family:"DM Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;font-weight:400;letter-spacing:.14em;text-transform:uppercase}
h1,h2{font-weight:400;letter-spacing:-.02em}
.sn-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;min-height:100vh;min-height:100svh;padding-bottom:clamp(1.5rem,1rem + 2vw,3rem)}
.sn-light{position:absolute;inset:-10%;z-index:-2;pointer-events:none}
.sn-light span{position:absolute;border-radius:50%;opacity:.55;will-change:transform}
.sn-light .l1{left:-10%;top:-15%;width:70vmax;height:70vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 70%,transparent),transparent);animation:snDrift1 26s ease-in-out infinite alternate}
.sn-light .l2{right:-15%;bottom:-25%;width:80vmax;height:80vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 45%,transparent),transparent);animation:snDrift2 34s ease-in-out infinite alternate}
.sn-light .l3{--px:50%;--py:45%;inset:0;width:auto;height:auto;border-radius:0;opacity:.5;background:radial-gradient(38vmax 38vmax at var(--px) var(--py),color-mix(in srgb,var(--primary-on-dark) 32%,transparent),transparent 70%);animation:snBreath 9s ease-in-out infinite}
@keyframes snDrift1{to{transform:translate3d(28vw,18vh,0) scale(1.15)}}
@keyframes snDrift2{to{transform:translate3d(-24vw,-22vh,0) scale(.9)}}
@keyframes snBreath{50%{opacity:.28}}
.sn-grain{position:absolute;inset:-50%;z-index:-1;background-image:url("${GRAIN}");opacity:.07;pointer-events:none;animation:snGrain .9s steps(5) infinite}
@keyframes snGrain{20%{transform:translate(-3%,2%)}40%{transform:translate(2%,-4%)}60%{transform:translate(-4%,-1%)}80%{transform:translate(3%,3%)}}
.sn-hero::after{content:'';position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,color-mix(in srgb,#000 55%,transparent));pointer-events:none}
.sn-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-top:1.4rem}
.sn-brand{display:inline-flex;align-items:center;gap:.6rem;min-height:2.75rem;font-weight:600;letter-spacing:-.01em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:2rem;height:2rem;border-radius:50%;border:1px solid var(--edge);font-size:.72rem;font-weight:600}
.sn-date{display:inline-flex;align-items:center;gap:.55rem;padding:.55rem .95rem;border-radius:999px;border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 4%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.sn-date .i{color:var(--primary-on-dark)}
.sn-soc a{border-color:var(--edge)}
.sn-stage{display:grid;align-content:center;justify-items:center;padding-block:clamp(2rem,1rem + 4vh,4rem);text-align:center}
.sn-kicker{color:var(--muted)}
.sn-name{margin-top:clamp(.5rem,1vh,1.2rem);padding-inline:2vw;font-size:min(var(--fs),34vh);line-height:.86;letter-spacing:-.035em;font-weight:400;text-wrap:balance}
.sn-name .lw{display:inline-block;white-space:nowrap}
.sn-name .ch{display:inline-block;background:linear-gradient(180deg,var(--on-dark) 30%,color-mix(in srgb,var(--on-dark) 45%,var(--primary)) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:.08em}
html.m .sn-name .ch{animation:snRise 1.8s cubic-bezier(.16,1,.3,1) calc(var(--i) * 70ms + .2s) both}
@keyframes snRise{from{opacity:0;transform:translateY(.32em) scale(1.06);filter:blur(18px)}}
.sn-base{display:grid;gap:2.5rem;align-items:end}
@media (min-width:60rem){.sn-base{grid-template-columns:minmax(0,30rem) minmax(0,26rem);justify-content:space-between}}
.sn-ask{display:grid;gap:1.25rem;scroll-margin-top:1rem}
.sn-sub{font-size:clamp(1.15rem,1rem + .6vw,1.45rem);line-height:1.45;color:color-mix(in srgb,var(--on-dark) 82%,var(--dark));text-wrap:pretty}
.sn-f{position:relative;display:grid;grid-template-columns:1fr;gap:.6rem}
.sn-f .field label{font-size:.8rem;font-weight:500;color:var(--muted);letter-spacing:.02em}
.sn-f .field input{min-height:3.6rem;padding-inline:1.3rem;border-radius:999px;border:1px solid var(--edge);background:color-mix(in srgb,var(--on-dark) 6%,transparent);color:var(--on-dark);font-size:1.05rem;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.sn-f .field input:focus{border-color:var(--primary-on-dark);box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 30%,transparent)}
.sn-f .btn{min-height:3.6rem;background:var(--on-dark);color:var(--dark);box-shadow:0 0 40px -10px color-mix(in srgb,var(--primary-on-dark) 80%,transparent)}
.sn-f .btn:hover{background:#fff;color:var(--dark)}
.sn-f .btn .i{transition:transform .3s ease}
.sn-f .btn:hover .i{transform:translateX(3px)}
.sn-f .form-note{font-size:.88rem}
.sn-f .form-note a{color:var(--on-dark)}
@media (min-width:40rem){.sn-f{grid-template-columns:1fr auto;align-items:end}.sn-f .field{grid-column:1}.sn-f .btn{grid-column:2;grid-row:1;align-self:end;width:auto;padding-inline:1.7rem}.sn-f .form-note{grid-column:1/-1}}
.sn-count{display:flex;gap:1.5rem;color:var(--muted)}
.sn-count span{display:grid;gap:.2rem}
.sn-count b{font-family:var(--font-display);font-size:2.4rem;font-weight:400;line-height:1;letter-spacing:0;text-transform:none;color:var(--on-dark);font-variant-numeric:tabular-nums}
.sn-buy a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:600;color:var(--on-dark)}
.sn-coming h2{color:var(--muted)}
.sn-list{display:grid;gap:.15rem;margin-top:1rem;border-top:1px solid var(--edge)}
.sn-list li{display:flex;gap:1rem;align-items:baseline;padding:.75rem 0;border-bottom:1px solid var(--edge)}
.sn-i{flex:none;color:var(--primary-on-dark);font-size:.72rem}
.sn-tw{min-height:1.5em;font-size:1.02rem;line-height:1.5}
.sn-tw.on::after{content:'';display:inline-block;width:.5em;height:1.05em;margin-left:2px;vertical-align:-.15em;background:var(--primary-on-dark);animation:snCaret .8s steps(1) infinite}
@keyframes snCaret{50%{opacity:0}}
.sn-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.sn-narrow{max-width:46rem}
.sn-h2{font-family:var(--font-display);font-size:clamp(2.8rem,1.8rem + 4vw,5.5rem);line-height:.95}
.sn-p{margin-top:1.25rem;font-size:1.2rem;line-height:1.6;color:color-mix(in srgb,var(--on-dark) 82%,var(--dark))}
.sn-faq{display:grid;gap:2rem}
@media (min-width:60rem){.sn-faq{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem;font-weight:500}
.faq .ans{padding:0 0 1.25rem}
.ftr{border-top:1px solid var(--edge)}
.mbar{background:color-mix(in srgb,var(--dark) 85%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-top-color:var(--edge);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.mbar .btn-primary{background:var(--on-dark);color:var(--dark)}
.mbar.wait{transform:translateY(120%)}
@media (max-width:39.99rem){.sn-name{font-size:min(var(--fsm),24vh)}.sn-top{padding-top:1rem}.sn-date{padding:.45rem .8rem;font-size:.7rem;letter-spacing:.1em}.sn-count{gap:1.1rem}.sn-count b{font-size:2rem}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Soon',
  bestFor: 'A product that is not out yet: a waitlist page with one email form and the launch date',
  match: /\b(coming soon|waitlist|wait list|pre-?orders?|launching soon|not out yet)\b/,
  why: 'Built for a waitlist: one cinematic screen with your product name huge, light drifting behind it, the email form front and center and what is coming typing itself in.',
  fonts: { q: 'family=Instrument+Serif&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono', display: ['Instrument Serif', 'serif'], body: ['DM Sans', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
