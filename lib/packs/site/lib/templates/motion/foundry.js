// Foundry (animated, agency): business to business services, sharp and editorial. A giant headline rises in word by
// word over a rule that draws itself, the member's services run across a dark band, then each service is a big
// numbered row that opens on hover (always open on phones) with a dark fill sweeping up behind it. The process is a
// timeline whose line draws as you scroll, clients (only when given) run as a marquee of names, and the page ends on a
// project inquiry form and an oversized wordmark.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'foundry';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f2f0eb', 0.85), dark: color.mix(p.ink, '#000000', 0.55) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'studio', file: 'studio.jpg', w: 1400, h: 1100, style: 'grid', alt: c.profile.hero || g[0] || `${c.name} at work` }];
}

function nav(c) {
  return [
    c.services.length && { label: 'Services', href: '#services' },
    c.steps.length && { label: 'Process', href: '#process' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// "Brand and website design for B2B software companies" -> the last words set in the italic serif.
function emphasize(title) {
  const words = String(title).trim().split(/\s+/);
  if (words.length < 3) return esc(title);
  const n = words.length > 6 ? 3 : words.length > 4 ? 2 : 1;
  return `${esc(words.slice(0, -n).join(' '))} <em>${esc(words.slice(-n).join(' '))}</em>`;
}

function label(n, text) {
  return `<p class="fx-label"><span>(${String(n).padStart(2, '0')})</span>${esc(text)}</p>`;
}

function render(c) {
  const low = cheapest(c);
  const primary = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace('<a ', '<a data-mag ').replace(/<\/a>$/, `${icon('arrowUpRight', { size: 18 })}</a>`);
  const meta = [c.whatShort, c.online ? 'Working remotely' : c.place || c.area, low ? `Projects from ${low.priceText.replace(/^From /, '')}` : ''].filter(Boolean);
  let n = 0;
  const next = () => (n += 1);

  const hero = `<section class="fx-hero" aria-labelledby="hero-title">
<div class="wrap">
${meta.length ? `<ul class="fx-meta" data-rv>${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
<h1 id="hero-title" class="fx-title${c.heroTitle.length > 48 ? ' long' : ''}" data-split>${emphasize(c.heroTitle)}</h1>
<div class="fx-rule" aria-hidden="true"></div>
<div class="fx-hero-row">
<p class="fx-lead" data-rv style="--d:5">${esc(c.heroSub)}</p>
<div class="fx-ctas" data-rv style="--d:6">${primary()}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}</div>
</div>
</div>
</section>`;

  const band = (c.services.length ? c.services.map((s) => s.name) : c.included).slice(0, 8);
  const bandRow = (hidden) => `<ul class="fx-band-row"${hidden ? ' aria-hidden="true"' : ''}>${band.map((b, i) => `<li class="${i % 2 ? 'o' : ''}">${esc(b)}<span class="fx-star" aria-hidden="true">${icon('spark', { size: 26 })}</span></li>`).join('')}</ul>`;
  const marquee = band.length > 1 ? `<div class="fx-band" aria-label="Services"><div class="mq"><div class="mq-track">${bandRow(false)}${bandRow(true)}</div></div></div>` : '';

  const services = c.services.length
    ? `<section class="fx-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
<div class="fx-head" data-rv>${label(next(), 'Services')}<h2 class="fx-h2" id="services-title" data-split>${esc(c.services.some((s) => s.priceText) ? 'What we do, and what it costs' : 'What we do')}</h2></div>
<ol class="fx-rows">
${c.services
  .map(
    (s, i) => `<li class="fx-row" data-rv style="--d:${i % 4}">
<div class="fx-row-top"><span class="fx-row-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="fx-row-p">${esc(s.priceText)}</p>` : ''}<span class="fx-row-a" aria-hidden="true">${icon('arrowUpRight', { size: 28 })}</span></div>
<div class="fx-row-more"><div class="fx-row-in">${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${s.duration ? `<p class="fx-row-d">${icon('clock', { size: 16 })}${esc(s.duration)}</p>` : ''}<a class="fx-row-go" href="#contact">Ask about ${esc(s.name.length > 32 ? 'this' : /^[A-Z][a-z]/.test(s.name) ? s.name.charAt(0).toLowerCase() + s.name.slice(1) : s.name)}${icon('arrow', { size: 16 })}</a></div></div>
</li>`
  )
  .join('\n')}
</ol>
${c.included.length ? `<div class="fx-incl" data-rv><h3>Every project includes</h3><ul>${c.included.map((x) => `<li>${icon('check', { size: 18 })}${esc(x)}</li>`).join('')}</ul></div>` : ''}
</div>
</section>`
    : c.included.length
      ? `<section class="fx-sec" id="services" aria-labelledby="services-title"><div class="wrap"><div class="fx-head" data-rv>${label(next(), 'Services')}<h2 class="fx-h2" id="services-title" data-split>What you get</h2></div><ul class="fx-incl-big">${c.included.map((x, i) => `<li data-rv style="--d:${i % 3}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(x)}</li>`).join('')}</ul></div></section>`
      : '';

  const process = c.steps.length
    ? `<section class="fx-sec fx-process" id="process" aria-labelledby="process-title">
<div class="wrap fx-process-grid">
<div class="fx-process-head" data-rv>${label(next(), 'Process')}<h2 class="fx-h2" id="process-title" data-split>How a project <em>runs</em></h2>${c.primary ? `<p class="fx-side-cta">${P.button(c.primary, 'btn btn-primary')}</p>` : ''}</div>
<ol class="fx-line">
<li class="fx-line-track" aria-hidden="true"><span></span></li>
${c.steps.map((s, i) => `<li class="fx-step" data-rv style="--d:1"><span class="fx-step-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div></li>`).join('\n')}
</ol>
</div>
</section>`
    : '';

  const about = `<section class="fx-sec fx-about" id="about" aria-labelledby="about-title">
<div class="wrap fx-about-grid">
<div class="fx-about-media" data-rv="mask">${P.img(c, 'studio', { cls: 'fx-about-img' }).replace('<img ', '<img data-par="0.06" ')}</div>
<div class="fx-about-copy">
${label(next(), 'About')}
<h2 class="fx-h2" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `${c.name}, led by ${c.owner}` : c.name)}</h2>
${c.aboutParas.map((p, i) => `<p class="fx-p" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:3">${P.socials(c, { cls: 'fx-social' })}</div>
</div>
</div>
</section>`;

  const clientRow = (hidden) => `<ul class="fx-clients-row"${hidden ? ' aria-hidden="true"' : ''}>${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const clients = c.clients.length
    ? `<section class="fx-clients" aria-labelledby="clients-title"><div class="wrap" data-rv>${label(next(), 'Clients')}<h2 class="sr-only" id="clients-title">Clients</h2></div>${c.clients.length > 2 ? `<div class="mq mq-rev"><div class="mq-track">${clientRow(false)}${clientRow(true)}</div></div>` : `<div class="wrap">${clientRow(false)}</div>`}</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="fx-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="fx-head" data-rv>${label(next(), 'Words')}<h2 class="fx-h2" id="reviews-title">What clients say</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="fx-sec fx-faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap fx-faq"><div data-rv>${label(next(), 'Questions')}<h2 class="fx-h2" id="faq-title" data-split>Good to know</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Company' },
    { ...P.FIELD_PRESETS.website, label: 'Company website' },
    c.services.length > 1 ? { name: 'service', label: 'What do you need?', type: 'select', options: [...c.services.map((s) => s.name), 'Not sure yet'], half: true } : null,
    { name: 'timeline', label: 'When do you need it?', type: 'text', half: true },
    { ...P.FIELD_PRESETS.message, label: 'Tell us about the project' },
  ].filter(Boolean);
  const contact = `<section class="fx-sec fx-contact" id="contact" aria-labelledby="contact-title">
<div class="wrap fx-contact-grid">
<div class="fx-contact-copy">
${label(next(), 'Contact')}
<h2 class="fx-h2 fx-big" id="contact-title" data-split>${emphasize(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="fx-lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.primary.kind !== 'form' ? `<div class="fx-ctas" data-rv style="--d:4">${primary()}</div>` : ''}
${c.promise ? `<p class="fx-promise" data-rv style="--d:4">${icon('shield', { size: 20 })}<span>${esc(c.promise)}</span></p>` : ''}
<div data-rv style="--d:5">${P.contactList(c, { cls: 'fx-contact-list' })}</div>
</div>
<div class="fx-form" data-rv="scale" style="--d:2">
<h3>Project inquiry</h3>
${P.form(c, { id: 'contact', fields, submit: 'Send the inquiry', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const mega = `<div class="fx-mega" aria-hidden="true"><span style="--fs:${Math.min(16, 158 / Math.max([...c.name].length, 6)).toFixed(1)}vw">${esc(c.name)}</span></div>`;
  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'fx-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, marquee, services, process, about, clients, reviews, faq, contact, '</main>', P.footer(c), mega, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '2px', btnRadius: '0px', max: '82rem' } };
}

// The process line draws with the scroll (--h) and each step lights as the line reaches it.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,l=d.querySelector('.fx-line'),st=l?[].slice.call(l.querySelectorAll('.fx-step')):[],t=false;if(!l)return;
function f(){t=false;var vh=innerHeight,r=l.getBoundingClientRect(),h=Math.max(0,Math.min(1,(vh*.6-r.top)/Math.max(1,r.height)));l.style.setProperty('--h',h.toFixed(4));st.forEach(function(e){var y=e.getBoundingClientRect().top-r.top;e.classList.toggle('on',h*r.height>=y+8)})}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{font-size:1.05rem}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
em{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-.02em;color:var(--primary-text)}
.btn{border-radius:0;font-weight:600;letter-spacing:-.01em}
.btn .i{transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.btn:hover .i{transform:translate(2px,-2px)}
.btn-primary{box-shadow:none}
.btn-ghost{border-width:1.5px}
.fx-label{display:flex;align-items:baseline;gap:.6rem;font-size:.82rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.fx-label span{font-variant-numeric:tabular-nums;color:var(--primary-text)}
.fx-h2{margin-top:1rem;font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-h2 em{letter-spacing:-.03em}
.fx-head{max-width:56rem;margin-bottom:clamp(2.5rem,2rem + 2vw,4.5rem)}
.fx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem);border-top:1px solid var(--line)}
.fx-lead{font-size:clamp(1.15rem,1rem + .55vw,1.4rem);line-height:1.5;color:var(--muted);max-width:36rem}
/* header */
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{position:relative;display:block;padding:.5rem 0;font-size:.95rem;font-weight:500;text-decoration:none}
.nav a::after{content:'';position:absolute;left:0;right:0;bottom:.3rem;height:1.5px;background:currentColor;transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.7,0,.2,1)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem;font-size:.95rem}
.menu>summary{border-radius:0}
.menu-panel{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero */
.fx-hero{padding-top:clamp(2.5rem,2rem + 4vw,6rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem)}
.fx-meta{display:flex;flex-wrap:wrap;gap:.4rem 0;font-size:.85rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.fx-meta li{display:flex;align-items:center}
.fx-meta li+li::before{content:'';width:1.6rem;height:1px;margin:0 .8rem;background:var(--line)}
@media (max-width:39.99rem){.fx-meta{flex-direction:column;gap:.35rem}.fx-meta li+li::before{display:none}}
.fx-title{margin-top:clamp(1.5rem,1rem + 2vw,3rem);font-size:clamp(3.1rem,1.2rem + 8.2vw,10.5rem);line-height:.88;letter-spacing:-.065em;font-weight:600;text-wrap:balance}
.fx-title.long{font-size:clamp(2.6rem,1.2rem + 5.6vw,7.4rem)}
.fx-title em{letter-spacing:-.035em;padding-right:.05em}
.fx-rule{height:1.5px;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem);background:var(--ink);transform-origin:0 50%}
html.m .fx-rule{animation:fxDraw 1.6s cubic-bezier(.7,0,.2,1) .5s both}
@keyframes fxDraw{from{transform:scaleX(0)}}
.fx-hero-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 1.5vw,2.5rem);align-items:start}
@media (min-width:60rem){.fx-hero-row{grid-template-columns:1fr auto;align-items:end}}
.fx-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.fx-ctas .btn{flex:1 1 100%}}
/* band */
.fx-band{padding-block:clamp(1.4rem,1rem + 1.5vw,2.4rem);background:var(--dark);color:var(--on-dark);--mq-speed:46s}
.fx-band-row{display:flex;flex:none}
.fx-band-row li{display:flex;align-items:center;gap:clamp(1.2rem,1rem + 1.5vw,2.6rem);padding-right:clamp(1.2rem,1rem + 1.5vw,2.6rem);font-family:var(--font-display);font-size:clamp(2.2rem,1.4rem + 3.6vw,5rem);font-weight:700;letter-spacing:-.05em;line-height:1.1;white-space:nowrap}
.fx-band-row li.o{color:transparent;-webkit-text-stroke:1.5px var(--on-dark)}
.fx-star{display:inline-grid;color:var(--primary-on-dark);-webkit-text-stroke:0}
html.m .fx-star .i{animation:obSpin 8s linear infinite}
@keyframes obSpin{to{transform:rotate(1turn)}}
/* service rows */
.fx-rows{border-top:1.5px solid var(--ink)}
.fx-row{position:relative;isolation:isolate;border-bottom:1px solid var(--line);outline:none}
.fx-row::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--dark);transform:scaleY(0);transform-origin:50% 100%;transition:transform .6s cubic-bezier(.7,0,.2,1)}
.fx-row-top{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:.5rem 1.25rem;padding:clamp(1.4rem,1rem + 1.4vw,2.4rem) .25rem}
.fx-row-n{font-size:.9rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--primary-text);transition:color .4s ease}
.fx-row h3{font-size:clamp(1.8rem,1.1rem + 3vw,4.2rem);line-height:.98;letter-spacing:-.055em;transition:transform .6s cubic-bezier(.2,.8,.2,1),color .4s ease}
.fx-row-p{grid-column:2;font-family:var(--font-display);font-size:clamp(1.05rem,.95rem + .5vw,1.4rem);font-weight:600;letter-spacing:-.03em;transition:color .4s ease}
.fx-row-a{display:none;color:var(--muted);transition:transform .6s cubic-bezier(.2,.8,.2,1),color .4s ease}
@media (min-width:48rem){.fx-row-top{grid-template-columns:4rem 1fr auto auto}.fx-row-p{grid-column:auto}.fx-row-a{display:inline-grid}}
.fx-row-more{display:grid;grid-template-rows:1fr;transition:grid-template-rows .6s cubic-bezier(.7,0,.2,1)}
.fx-row-in{overflow:hidden;display:grid;gap:.75rem;justify-items:start;padding:0 .25rem}
.fx-row-in>:last-child{margin-bottom:clamp(1.4rem,1rem + 1.4vw,2.4rem)}
.fx-row-in p{max-width:40rem;color:var(--muted);font-size:1.1rem;transition:color .4s ease}
.fx-row-d{display:flex;align-items:center;gap:.4rem}
.fx-row-go{display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;font-weight:600;color:var(--primary-text);text-decoration:none;transition:color .4s ease}
.fx-row-go:hover{text-decoration:underline}
@media (min-width:48rem){.fx-row-in{padding-left:calc(4rem + 1.5rem)}}
@media (hover:hover) and (min-width:48rem){
.fx-row-more{grid-template-rows:0fr}
.fx-row:hover::before,.fx-row:focus-within::before{transform:scaleY(1)}
.fx-row:hover .fx-row-more,.fx-row:focus-within .fx-row-more{grid-template-rows:1fr}
.fx-row:hover h3,.fx-row:focus-within h3{transform:translateX(1rem);color:var(--on-dark)}
.fx-row:hover .fx-row-p,.fx-row:focus-within .fx-row-p,.fx-row:hover .fx-row-in p,.fx-row:focus-within .fx-row-in p{color:var(--on-dark)}
.fx-row:hover .fx-row-n,.fx-row:focus-within .fx-row-n,.fx-row:hover .fx-row-go,.fx-row:focus-within .fx-row-go{color:var(--primary-on-dark)}
.fx-row:hover .fx-row-a,.fx-row:focus-within .fx-row-a{transform:rotate(45deg);color:var(--primary-on-dark)}
.fx-row:hover .fx-row-in p,.fx-row:focus-within .fx-row-in p{color:var(--muted-on-dark)}
}
.fx-incl{display:grid;gap:1.25rem;margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
@media (min-width:60rem){.fx-incl{grid-template-columns:16rem 1fr}}
.fx-incl h3{font-size:1.1rem;letter-spacing:-.02em}
.fx-incl ul{display:flex;flex-wrap:wrap;gap:.6rem}
.fx-incl li{display:inline-flex;align-items:center;gap:.45rem;padding:.55rem .95rem;border:1px solid var(--line);font-weight:500}
.fx-incl .i{color:var(--primary-text)}
.fx-incl-big{border-top:1.5px solid var(--ink)}
.fx-incl-big li{display:flex;gap:1.5rem;align-items:baseline;padding:1.5rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.4rem,1rem + 1.6vw,2.4rem);font-weight:600;letter-spacing:-.04em;line-height:1.1}
.fx-incl-big span{font-size:.9rem;color:var(--primary-text);letter-spacing:0}
/* process */
.fx-process{background:var(--dark);color:var(--on-dark);border-top:0}
.fx-process .fx-label{color:var(--muted-on-dark)}
.fx-process .fx-label span,.fx-process em{color:var(--primary-on-dark)}
.fx-process-grid{display:grid;gap:3rem}
@media (min-width:60rem){.fx-process-grid{grid-template-columns:.9fr 1.1fr;gap:5rem}.fx-process-head{position:sticky;top:7rem;align-self:start}}
.fx-side-cta{margin-top:2rem}
.fx-line{--h:1;position:relative;display:grid;gap:clamp(2.5rem,2rem + 2vw,4rem);padding-left:clamp(4.5rem,3.5rem + 3vw,6.5rem)}
.fx-line-track{position:absolute;left:clamp(1.6rem,1.2rem + 1vw,2.2rem);top:.5rem;bottom:.5rem;width:1.5px;background:var(--line-on-dark)}
.fx-line-track span{position:absolute;inset:0;background:var(--primary-on-dark);transform-origin:50% 0;transform:scaleY(var(--h))}
html.m .fx-line{--h:0}
.fx-step{position:relative}
.fx-step-n{position:absolute;left:calc(-1 * clamp(4.5rem,3.5rem + 3vw,6.5rem));top:-.2rem;display:grid;place-items:center;width:clamp(3.3rem,2.5rem + 2vw,4.4rem);aspect-ratio:1;border:1.5px solid var(--line-on-dark);border-radius:50%;background:var(--dark);font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:clamp(1.3rem,1rem + 1vw,1.8rem);color:var(--muted-on-dark);transition:background-color .5s ease,color .5s ease,border-color .5s ease}
.fx-step.on .fx-step-n,html:not(.m) .fx-step-n{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.fx-step h3{font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);line-height:1.05}
.fx-step p{margin-top:.7rem;max-width:30rem;color:var(--muted-on-dark);font-size:1.1rem}
/* about */
.fx-about-grid{display:grid;gap:clamp(2rem,1rem + 4vw,6rem);align-items:center}
@media (min-width:56rem){.fx-about-grid{grid-template-columns:1fr 1fr}}
.fx-about-media{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.fx-about-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.fx-about-copy{display:grid;gap:1.1rem;justify-items:start}
.fx-p{font-size:1.15rem;line-height:1.65;max-width:34rem}
/* clients */
.fx-clients{padding-block:clamp(3.5rem,2.5rem + 3vw,6rem);border-top:1px solid var(--line)}
.fx-clients .mq,.fx-clients .wrap+.wrap{margin-top:2rem}
.fx-clients-row{display:flex;flex:none;flex-wrap:nowrap}
.fx-clients .wrap .fx-clients-row{flex-wrap:wrap;gap:1rem 3rem}
.fx-clients-row li{display:flex;align-items:center;padding-right:clamp(2.5rem,2rem + 3vw,5rem);font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:clamp(2.2rem,1.5rem + 3vw,4.4rem);line-height:1.1;white-space:nowrap;color:var(--ink)}
.fx-clients-row li::after{content:'';width:.4rem;height:.4rem;margin-left:clamp(2.5rem,2rem + 3vw,5rem);border-radius:50%;background:var(--primary)}
.fx-clients .mq{--mq-speed:40s}
/* faq */
.fx-faq{display:grid;gap:2rem}
@media (min-width:60rem){.fx-faq{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}}
.faq{gap:0;border-top:1.5px solid var(--ink)}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.4rem 0;font-family:var(--font-display);font-size:1.25rem;letter-spacing:-.03em}
.faq .ans{padding:0 0 1.4rem}
/* contact */
.fx-contact{background:var(--surface)}
.fx-contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.fx-contact-grid{grid-template-columns:1fr 1fr;gap:5rem}}
.fx-contact-copy{display:grid;gap:1.25rem;justify-items:start}
.fx-big{font-size:clamp(2.8rem,1.6rem + 5vw,6.6rem)}
.fx-promise{display:flex;gap:.7rem;align-items:flex-start;padding:1rem 1.2rem;border:1px solid var(--line);background:var(--bg)}
.fx-promise .i{flex:none;margin-top:.15rem;color:var(--primary-text)}
.fx-contact-list{margin-top:.5rem;font-size:1.1rem}
.fx-form{padding:clamp(1.3rem,1rem + 1.6vw,2.6rem);background:var(--bg);border:1.5px solid var(--ink);box-shadow:10px 10px 0 var(--ink)}
.fx-form h3{margin-bottom:1.5rem;font-size:1.6rem}
@media (max-width:39.99rem){.fx-form{box-shadow:6px 6px 0 var(--ink);margin-right:6px}}
.field input,.field select,.field textarea{border-radius:0;border-width:0 0 1.5px;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--primary-text)}
.field textarea{border-width:1.5px;padding-inline:.8rem}
.ftr{border-top:1.5px solid var(--ink)}
.fx-mega{overflow:hidden;padding:0 1rem;line-height:.78;text-align:center}
.fx-mega span{display:block;font-family:var(--font-display);font-size:var(--fs,12vw);font-weight:800;letter-spacing:-.07em;white-space:nowrap;color:var(--ink);opacity:.95;transform:translateY(12%)}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'agency',
  name: 'Foundry',
  bestFor: 'Agencies, consultants and studios that sell to other businesses: branding, web, marketing, automation, bookkeeping',
  why: 'Built for business to business services: a sharp editorial look with your services running across the page, big numbered rows that open on hover, a process timeline that draws as you scroll and a project inquiry form.',
  fonts: { q: 'family=Schibsted+Grotesk:wght@500..800&family=Instrument+Sans:wght@400..600&family=Instrument+Serif:ital@1', display: ['Schibsted Grotesk', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
