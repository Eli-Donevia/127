// Northstar (animated, coach): for one person people want to work with. Calm and confident on a warm off-white page:
// a split hero (the headline rises in word by word on the left, the portrait wipes in on the right with a slow
// parallax and a small star that draws itself), who it's for as a statement whose words light up as you read down,
// the offer with its list checking in, a sticky "How it works" where each step lights as you scroll past it, the
// story, questions and a Book a call band with a slow aurora behind it.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, HEAD_CSS, esc } = require('../shared');

const id = 'northstar';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f7f5f0', 0.65), dark: color.mix(color.mix(p.ink, p.primary, 0.35), '#05080a', 0.5) };
}

function slots(c) {
  return [{ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'coach'}` : c.profile.hero || c.name }];
}

function nav(c) {
  return [
    (c.services.length || c.offer || c.included.length) && { label: 'The offer', href: '#offer' },
    c.steps.length && { label: 'How it works', href: '#how' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

const STAR = '<svg class="star" viewBox="0 0 48 48" aria-hidden="true"><path pathLength="1" d="M24 2C25.2 15.5 32.5 22.8 46 24 32.5 25.2 25.2 32.5 24 46 22.8 32.5 15.5 25.2 2 24 15.5 22.8 22.8 15.5 24 2Z"/></svg>';

// "Leadership coaching for new managers" -> the part from "for" on in italics; else the last two words.
function emphasize(title) {
  const t = String(title);
  const m = t.match(/^(.{6,}?)\s(for\s.+)$/i);
  if (m) return `${esc(m[1])} <em>${esc(m[2])}</em>`;
  const words = t.split(/\s+/);
  if (words.length < 3) return esc(t);
  return `${esc(words.slice(0, -2).join(' '))} <em>${esc(words.slice(-2).join(' '))}</em>`;
}

// Words that light up one by one as the statement scrolls through the screen.
function litWords(textIn, start = 0) {
  return String(textIn)
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => `<span class="lw" style="--i:${start + i}">${esc(w)}</span>`)
    .join(' ');
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const meta = [c.online ? (c.area && /online|zoom|virtual|remote/i.test(c.area) ? c.area : 'Online') : c.area, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);
  const bookIcon = c.booking ? 'calendar' : '';
  const book = (cls) => P.button(c.primary, cls, bookIcon).replace('<a ', '<a data-mag ');
  const long = c.heroTitle.length > 44;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="dawn" aria-hidden="true" data-par="-0.06"></div>
<div class="wrap hero-grid">
<div class="hero-copy">
<p class="pill" data-rv><span class="pill-dot" aria-hidden="true"></span>${esc([person || c.name, c.whatShort].filter(Boolean).join(' · '))}</p>
<h1 id="hero-title" data-split${long ? ' class="long"' : ''}>${emphasize(c.heroTitle)}</h1>
<p class="lead" data-rv style="--d:6">${esc(c.heroSub)}</p>
<div class="ctas" data-rv style="--d:7">${book('btn btn-primary btn-lg')}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}</div>
${meta.length ? `<ul class="meta" data-rv style="--d:8">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
<figure class="portrait">
<div class="pt-frame" data-rv="mask" style="--d:3"><div class="pt-in">${P.img(c, 'portrait', { cls: 'pt-img', eager: true }).replace('<img ', '<img data-par="0.07" ')}</div></div>
<span class="pt-star" aria-hidden="true">${STAR}</span>
${person || c.whatShort ? `<figcaption data-rv="right" style="--d:10"><strong>${esc(person || c.name)}</strong>${c.whatShort ? `<span>${esc(c.whatShort)}</span>` : ''}</figcaption>` : ''}
</figure>
</div>
</section>`;

  const aud = c.audience ? c.audience.replace(/^for\s+/i, '').replace(/[.!]+$/, '') : '';
  const forWords = aud ? litWords(`For ${aud}${c.profile.result ? ',' : '.'}`) : '';
  const forWho = aud
    ? `<section class="sec forwho" aria-labelledby="forwho-title"><div class="wrap forwho-in">
<p class="eyebrow" data-rv>Who it's for</p>
<h2 class="statement lit-text" id="forwho-title">${forWords}${c.profile.result ? ` <em>${litWords(`with ${c.profile.result}.`, aud.split(/\s+/).length + 1)}</em>` : ''}</h2>
</div></section>`
    : '';

  const offerName = c.offer || (c.services[0] && c.services[0].name) || c.whatShort;
  const offer = c.services.length || c.offer || c.included.length
    ? `<section class="sec offer" id="offer" aria-labelledby="offer-title"><div class="wrap offer-grid">
<div class="offer-copy">
<p class="eyebrow" data-rv>The offer</p>
<h2 class="h2" id="offer-title" data-split>${esc(offerName)}</h2>
${c.included.length ? `<ul class="incl">${c.included.map((x, i) => `<li data-rv style="--d:${i + 2}"><svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path pathLength="1" d="M7 12.5l3.2 3.2L17 8.8"/></svg><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="offer-card" data-spot data-rv="scale" style="--d:2">
${c.services.length ? `<ul class="prices">${c.services.map((s) => `<li><div><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}</div>${s.priceText ? `<span class="pp">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${c.capacity ? `<p class="cap">${icon('user', { size: 18 })}${esc(c.capacity)}</p>` : ''}
${book('btn btn-primary btn-lg btn-block')}
</div>
</div></section>`
    : '';

  const n = c.steps.length;
  const how = n
    ? `<section class="sec how" id="how" aria-labelledby="how-title"><div class="wrap how-grid">
<div class="how-side">
<p class="eyebrow" data-rv>How it works</p>
<h2 class="h2" id="how-title" data-split>Simple from the <em>first message</em></h2>
<p class="how-count" aria-hidden="true" data-rv style="--d:3"><span class="how-now">01</span><span class="how-of">/ ${String(n).padStart(2, '0')}</span></p>
${book('btn btn-primary how-cta')}
</div>
<ol class="how-steps">
${c.steps.map((s, i) => `<li class="hs"><span class="hs-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('\n')}
</ol>
</div></section>`
    : '';

  // The first sentence large, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = c.aboutParas;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<div class="about-side"><p class="eyebrow" data-rv>About</p><h2 class="h2" id="about-title" data-split>${person ? `Hi, I'm <em>${esc(person)}.</em>` : `About <em>${esc(c.name)}</em>`}</h2></div>
<div class="about-copy">
${first ? `<p class="about-first" data-rv>${esc(first)}</p>` : ''}
${rest.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<p class="eyebrow" data-rv>Kind words</p><h2 class="h2" id="reviews-title" data-split>What people <em>say</em></h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div><p class="eyebrow" data-rv>FAQ</p><h2 class="h2" id="faq-title" data-split>Questions, <em>answered</em></h2></div><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="aurora" aria-hidden="true"><span></span><span></span></div>
<div class="wrap contact-in">
<div class="contact-head">
<span class="c-star" aria-hidden="true" data-rv="scale">${STAR}</span>
<h2 class="h2" id="contact-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.booking ? `<div class="ctas center" data-rv style="--d:4">${book('btn btn-primary btn-lg')}</div>` : ''}
</div>
<div class="contact-grid">
<div class="form-card" data-rv="scale" style="--d:2">
<h3 class="form-title">${c.booking ? 'Or send a message' : 'Send a message'}</h3>
${P.form(c, { id: 'contact', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What would you like help with?', required: true }], submit: 'Send message', subject: `Message for ${c.name}` })}
</div>
${P.contactList(c) ? `<div class="contact-side" data-rv style="--d:3"><h3>Reach ${esc(person || c.name)}</h3>${P.contactList(c)}</div>` : ''}
</div>
</div>
</section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-ns', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, forWho, offer, how, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', btnRadius: '999px' } };
}

// The statement's words light up with the scroll; each step lights once it passes the reading line, the rail fills
// and the counter follows.
const JS = `(function(){var d=document;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var box=d.querySelector('.lit-text'),lw=box?[].slice.call(box.querySelectorAll('.lw')):[],how=d.querySelector('.how-steps'),st=how?[].slice.call(how.querySelectorAll('.hs')):[],num=d.querySelector('.how-now'),tick=0;
function f(){tick=0;var vh=innerHeight;if(box){var r=box.getBoundingClientRect(),p=(vh*.88-r.top)/(r.height+vh*.4),n=Math.round(Math.max(0,Math.min(1,p))*lw.length);lw.forEach(function(w,i){w.classList.toggle('on',i<n)})}
if(how){var k=0;st.forEach(function(s,i){var on=s.getBoundingClientRect().top<vh*.6;s.classList.toggle('lit',on);if(on)k=i});var q=how.getBoundingClientRect();how.style.setProperty('--p',Math.max(0,Math.min(1,(vh*.6-q.top)/q.height)).toFixed(3));if(num)num.textContent=String(k+1).padStart(2,'0')}}
addEventListener('scroll',function(){if(!tick){tick=1;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.025em}
h1 em,h2 em{font-style:italic;color:var(--primary-deep)}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em}
.h2{font-size:clamp(2.4rem,1.5rem + 3.4vw,4.4rem);line-height:1.02}
.eyebrow{display:inline-flex;align-items:center;gap:.6rem;font-weight:600;letter-spacing:.16em;color:var(--primary-deep)}
.eyebrow::before{content:'';width:1.6rem;height:1px;background:currentColor}
.lead{color:var(--muted)}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .4s ease,border-color .4s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--bg) 85%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:5rem;transition:min-height .4s ease}
.hdr.scrolled .hdr-in{min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;line-height:1;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.5rem .85rem;border-radius:999px;font-size:.95rem;font-weight:500;color:var(--muted);text-decoration:none;transition:color .2s ease,background-color .2s ease}
.nav a:hover{color:var(--ink);background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.25rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(1.5rem,1rem + 3vw,4.5rem) clamp(4rem,2.5rem + 5vw,8rem)}
.dawn{position:absolute;right:-18rem;top:-22rem;width:min(64rem,130vw);aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,var(--primary-soft),transparent 70%);pointer-events:none}
.hero-grid{position:relative;display:grid;gap:clamp(3rem,2rem + 4vw,5rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}}
.pill{display:inline-flex;align-items:center;gap:.6rem;padding:.45rem 1rem .45rem .7rem;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--bg) 70%,transparent);font-size:.9rem;font-weight:600}
.pill-dot{width:.55rem;height:.55rem;border-radius:50%;background:var(--primary)}
html.m .pill-dot{animation:nsBreathe 3.2s ease-in-out infinite}
@keyframes nsBreathe{50%{transform:scale(.6);opacity:.6}}
.hero h1{margin-top:1.5rem;font-size:clamp(3rem,1.6rem + 5.4vw,6.6rem);line-height:.98;letter-spacing:-.035em}
.hero h1.long{font-size:clamp(2.6rem,1.4rem + 4.2vw,5.2rem);line-height:1.02}
.hero .lead{margin-top:1.5rem;max-width:34rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
.ctas.center{justify-content:center}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:2rem}
.meta li{padding:.45rem .9rem;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:.9rem;font-weight:500;color:var(--muted)}
.portrait{position:relative;margin:0;justify-self:center;width:min(100%,28rem)}
@media (min-width:60rem){.portrait{justify-self:end}}
.pt-frame{overflow:hidden;border-radius:240px 240px 26px 26px;aspect-ratio:4/5;background:var(--primary-soft)}
.pt-in{height:100%;overflow:hidden}
html.m .pt-frame .pt-in{transform:scale(1.12);transition:clip-path 1.5s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms),transform 2.4s cubic-bezier(.16,1,.3,1) calc(var(--d,0) * 70ms)}
html.m .pt-frame.in .pt-in{transform:none}
.pt-img{width:100%;height:122%;margin-top:-11%;object-fit:cover}
.pt-star{position:absolute;left:-1.6rem;top:12%;width:4.5rem;color:var(--primary-deep)}
.star{display:block;width:100%;height:auto;overflow:visible}
.star path{fill:currentColor;stroke:currentColor;stroke-width:1.2}
html.m .star path{fill-opacity:0;stroke-dasharray:1;stroke-dashoffset:1;animation:nsDraw 2.4s cubic-bezier(.7,0,.2,1) .8s forwards,nsFill 1s ease 2.6s forwards}
html.m .pt-star .star{animation:nsSpin 40s linear infinite}
@keyframes nsDraw{to{stroke-dashoffset:0}}
@keyframes nsFill{to{fill-opacity:1}}
@keyframes nsSpin{to{transform:rotate(1turn)}}
.portrait figcaption{position:absolute;right:-1rem;bottom:2rem;display:grid;gap:.15rem;padding:1rem 1.3rem;border-radius:18px;background:var(--bg);box-shadow:0 30px 60px -30px rgba(0,0,0,.4)}
.portrait figcaption strong{font-family:var(--font-display);font-size:1.5rem;font-weight:400;line-height:1.1}
.portrait figcaption span{font-size:.9rem;color:var(--muted)}
@media (max-width:39.99rem){.portrait figcaption{right:.75rem}.pt-star{left:.5rem;width:3.4rem}}
.forwho{background:var(--dark);color:var(--on-dark)}
.forwho .eyebrow{color:var(--primary-on-dark)}
.forwho-in{max-width:66rem}
.statement{margin-top:1.5rem;font-size:clamp(2.1rem,1.3rem + 3.6vw,4.6rem);line-height:1.08;letter-spacing:-.03em;color:var(--on-dark)}
.statement em{color:var(--primary-on-dark)}
html.m .lw{color:var(--muted-on-dark);transition:color .5s ease}
html.m .lw.on{color:inherit}
.offer-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.offer-grid{grid-template-columns:1fr 1fr;gap:5rem}.offer-card{position:sticky;top:6rem}}
.offer-copy .h2{margin-top:1rem}
.incl{display:grid;gap:1.1rem;margin-top:2.25rem}
.incl li{display:flex;gap:.9rem;align-items:flex-start;font-size:1.12rem;line-height:1.5}
.tick{flex:none;width:1.6rem;height:1.6rem;margin-top:.05rem}
.tick circle{fill:var(--primary-soft)}
.tick path{fill:none;stroke:var(--primary-deep);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
html.m .incl li[data-rv] .tick path{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .7s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms + .45s)}
html.m .incl li.in .tick path{stroke-dashoffset:0}
.offer-card{--spot:var(--primary-soft);display:grid;gap:1.5rem;padding:clamp(1.5rem,1rem + 1.6vw,2.5rem);border-radius:28px;background:var(--surface);border:1px solid var(--line);box-shadow:0 40px 80px -60px rgba(0,0,0,.4)}
.prices{display:grid}
.prices li{display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;padding:1.15rem 0;border-bottom:1px solid var(--line)}
.prices li:first-child{padding-top:0}
.prices h3{font-size:1.1rem}
.prices p{margin-top:.2rem;font-size:.95rem;color:var(--muted)}
.pp{font-family:var(--font-display);font-size:2.1rem;line-height:1;letter-spacing:-.03em;white-space:nowrap}
.cap{display:flex;align-items:center;gap:.5rem;font-weight:600;color:var(--primary-deep)}
.how{background:var(--surface)}
.how-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.how-grid{grid-template-columns:.9fr 1.1fr;gap:5rem;align-items:start}.how-side{position:sticky;top:22vh}}
.how-side .h2{margin-top:1rem}
.how-count{display:flex;align-items:baseline;gap:.5rem;margin-top:2rem;font-family:var(--font-display);line-height:1}
.how-now{font-size:clamp(3.5rem,2.5rem + 3vw,6rem);font-style:italic;color:var(--primary-deep);font-variant-numeric:tabular-nums}
.how-of{font-size:1.5rem;color:var(--muted)}
.how-cta{margin-top:2rem}
@media (max-width:59.99rem){.how-count,.how-cta{display:none}}
.how-steps{position:relative;display:grid;padding-left:2.5rem}
.how-steps::before,.how-steps::after{content:'';position:absolute;left:.45rem;top:.6rem;bottom:.6rem;width:2px;border-radius:2px;background:var(--line)}
.how-steps::after{background:var(--primary-deep);transform-origin:50% 0;transform:scaleY(var(--p,1))}
.hs{position:relative;display:grid;gap:.6rem;align-content:start;padding-block:0 clamp(2.5rem,2rem + 5vh,6rem)}
@media (min-width:60rem){.hs{min-height:38vh}}
.hs:last-child{padding-bottom:0;min-height:0}
.hs::before{content:'';position:absolute;left:-2.5rem;top:.35rem;width:1.1rem;height:1.1rem;border-radius:50%;background:var(--bg);border:2px solid var(--line);transition:background-color .5s ease,border-color .5s ease,box-shadow .5s ease}
.hs-n{font-family:var(--font-display);font-size:1.1rem;font-style:italic;color:var(--primary-deep)}
.hs h3{font-family:var(--font-display);font-size:clamp(1.8rem,1.4rem + 1.6vw,2.8rem);font-weight:400;line-height:1.05;letter-spacing:-.025em}
.hs p{max-width:30rem;font-size:1.1rem;color:var(--muted)}
html.m .hs{opacity:.3;transform:translateX(-6px);transition:opacity .6s ease,transform .8s cubic-bezier(.16,1,.3,1)}
html.m .hs.lit{opacity:1;transform:none}
html:not(.m) .hs::before,.hs.lit::before{background:var(--primary-deep);border-color:var(--primary-deep);box-shadow:0 0 0 .4rem var(--primary-soft)}
.about-grid{display:grid;gap:2rem 5rem}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr;align-items:start}.about-side{position:sticky;top:7rem}}
.about-side .h2{margin-top:1rem}
.about-copy{display:grid;gap:1.25rem;font-size:1.15rem;line-height:1.7;color:var(--muted)}
.about-first{font-family:var(--font-display);font-size:clamp(1.5rem,1.2rem + 1.2vw,2.2rem);line-height:1.3;letter-spacing:-.015em;color:var(--ink)}
.quotes{display:grid;gap:1.25rem;margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}}
.quote{display:grid;gap:1.2rem;align-content:space-between;padding:clamp(1.5rem,1rem + 1.5vw,2.25rem);border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.35rem,1.15rem + .8vw,1.75rem);font-style:italic;line-height:1.35}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:600;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}}
.faq-grid .h2{margin-top:1rem}
.contact{position:relative;overflow:hidden;background:var(--dark);color:var(--on-dark)}
.aurora{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.aurora span{position:absolute;width:46rem;aspect-ratio:1;border-radius:50%;filter:blur(40px);opacity:.5}
.aurora span:first-child{left:-12rem;top:-16rem;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 70%,transparent),transparent)}
.aurora span:last-child{right:-14rem;bottom:-20rem;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 55%,transparent),transparent)}
html.m .aurora span:first-child{animation:nsDrift 18s ease-in-out infinite alternate}
html.m .aurora span:last-child{animation:nsDrift 22s ease-in-out infinite alternate-reverse}
@keyframes nsDrift{to{transform:translate(12rem,8rem) scale(1.15)}}
.contact-in{position:relative}
.contact-head{display:grid;justify-items:center;gap:1.1rem;max-width:50rem;margin:0 auto clamp(2.5rem,2rem + 3vw,4.5rem);text-align:center}
.contact .h2{font-size:clamp(2.8rem,1.6rem + 5vw,6rem);line-height:1}
.contact .h2 em{color:var(--primary-on-dark)}
.contact .lead{color:var(--muted-on-dark)}
.c-star{width:3.2rem;color:var(--primary-on-dark)}
.contact-grid{display:grid;gap:2rem;max-width:62rem;margin-inline:auto;align-items:start}
@media (min-width:56rem){.contact-grid{grid-template-columns:1.3fr .7fr;gap:3rem}}
.form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.4rem);border-radius:26px;background:var(--bg);color:var(--ink);box-shadow:0 50px 100px -50px rgba(0,0,0,.6)}
.form-title{margin-bottom:1.25rem;font-family:var(--font-display);font-size:1.9rem;font-weight:400;letter-spacing:-.02em}
.contact-side{display:grid;gap:1.25rem;padding-top:1rem}
.contact-side h3{font-family:var(--font-display);font-size:1.6rem;font-weight:400}
.contact-side .i{color:var(--primary-on-dark)}
.contact-side a{color:var(--on-dark)}
.ftr{background:var(--bg)}
.mbar{background:color-mix(in srgb,var(--bg) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
`;

module.exports = {
  id,
  kind: 'coach',
  name: 'Northstar',
  bestFor: 'Coaches, tutors, consultants and anyone people book one to one, with motion',
  why: 'Calm and confident, with motion: a split hero with your portrait, who it is for, your offer, a How it works that lights up step by step, your story and a Book a call button.',
  fonts: { q: 'family=Newsreader:ital,opsz,wght@0,48,400;1,48,400&family=Manrope:wght@400;500;600;700', display: ['Newsreader', 'serif'], body: ['Manrope', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
