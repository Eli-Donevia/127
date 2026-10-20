// Foundry (animated, agency): business to business services, set like a brand guidelines document.
//   Object:   the brand guide: numbered chapters, a price schedule set as big rows, and the studio's own name set as
//             the specimen at the foot of the page.
//   Material: Swiss poster stock: off-white sheet, black ink, 1.5px rules, square corners, a hard offset shadow on the
//             inquiry form only.
//   One move: the type is set. The headline's words fly in from scattered places and lock onto the grid, the hero
//             plate landing under them (choreo intro 'assemble').
//   Pop:      the member's colour as the line under the headline's last word, then the process line and its comet.
// At rest the hero plate leans toward the pointer and lags with the scroll. The one scroll moment is the process as a
// roadmap that draws itself in and ends at the button. Service rows open on hover (always open on phones). No band of
// outline text, no asterisks, no italic accent words. JavaScript off and reduced motion: the complete, still page.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'foundry';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f2f0eb', 0.85), dark: color.mix(p.ink, '#000000', 0.55) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'studio', file: 'studio.jpg', w: 1400, h: 1100, style: 'sweep', alt: c.profile.hero || g[0] || `${c.name} at work` }];
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

// The headline split on the server into words (so nothing reflows when the intro starts).
function headParts(title) {
  return String(title || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const NOUN = /\b(agency|studio|firm|consultancy|company|practice|collective|shop|partner|team|bureau)$/i;

// The hero sentence, from the facts and never slotted into a fixed template: "Northline Studio is a brand and website
// design agency in Chicago, IL, working with B2B software companies."
function heroLine(c) {
  const what = String(c.whatShort || '').trim();
  const where = c.online ? '' : c.place || c.city || '';
  const aud = c.audience ? lowerFirst(String(c.audience).replace(/^for\s+/i, '').replace(/[.!]+$/, '')) : '';
  let first;
  // The headline already names the work and who it is for, so the lead says who runs it and where instead.
  const said = (t) => t && String(c.heroTitle || '').toLowerCase().includes(String(t).toLowerCase().slice(0, 18));
  if (said(what) || said(aud)) first = c.owner && c.owner !== c.name ? `${c.name} is run by ${c.owner}${where ? ` in ${where}` : ''}.` : `${c.name}${where ? ` works from ${where}` : ''}.`;
  else if (what && NOUN.test(what)) first = `${c.name} is ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${lowerFirst(what)}${where ? ` in ${where}` : ''}${aud ? `, working with ${aud}` : ''}.`;
  else if (what) first = `${c.name} works on ${lowerFirst(what)}${aud ? ` with ${aud}` : ''}${where ? `, from ${where}` : ''}.`;
  else first = `${c.name}${where ? `, ${where}` : ''}.`;
  const bits = [first];
  if (c.services.some((s) => s.priceText)) bits.push('Every price is listed below.');
  if (c.booking) bits.push('Book a call to start.');
  return bits.join(' ');
}

function render(c) {
  const oneOff = c.services.filter((s) => typeof s.price === 'number' && !s.unit);
  const low = oneOff.length ? oneOff.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const primary = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace('<a ', '<a data-mag ').replace(/<\/a>$/, `${icon('arrowUpRight', { size: 18 })}</a>`);
  const meta = [c.online ? 'Working remotely' : c.place || c.area, low ? `Projects from ${low.priceText.replace(/^From /, '')}` : ''].filter(Boolean);
  let n = 0;
  const no = () => `<span class="fx-no" aria-hidden="true">${String((n += 1)).padStart(2, '0')}</span>`;

  const hero = `<section class="fx-hero" aria-labelledby="hero-title">
<div class="wrap">
<h1 id="hero-title" class="fx-title${c.heroTitle.length > 48 ? ' long' : ''}" data-ci="head">${headParts(c.heroTitle)}</h1>
<div class="fx-hero-row">
<p class="fx-lead">${esc(heroLine(c))}</p>
<div class="fx-ctas" data-ci="then">${primary()}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}</div>
</div>
${meta.length ? `<ul class="fx-meta" data-ci="then">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
<figure class="fx-plate"><div class="fx-plate-lean" data-alive="0.18"><div class="fx-plate-in" data-ci="subject">${P.img(c, 'studio', { cls: 'fx-plate-img', eager: true })}</div></div></figure>
</section>`;

  const services = c.services.length
    ? `<section class="fx-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
<div class="fx-head" data-rv><h2 class="fx-h2" id="services-title">${no()}${esc(c.services.some((s) => s.priceText) ? 'What we do, and what it costs' : 'What we do')}</h2></div>
<ol class="fx-rows">
${c.services
  .map(
    (s, i) => `<li class="fx-row">
<div class="fx-row-top"><span class="fx-row-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="fx-row-p">${esc(s.priceText)}</p>` : ''}<span class="fx-row-a" aria-hidden="true">${icon('arrowUpRight', { size: 28 })}</span></div>
<div class="fx-row-more"><div class="fx-row-in">${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${s.duration ? `<p class="fx-row-d">${esc(s.duration)}</p>` : ''}<a class="fx-row-go" href="#contact">Ask about ${esc(s.name.length > 32 ? 'this' : lowerFirst(s.name))}${icon('arrow', { size: 16 })}</a></div></div>
</li>`
  )
  .join('\n')}
</ol>
${c.included.length ? `<div class="fx-incl" data-rv><h3>Every project includes</h3><ol>${c.included.map((x, i) => `<li><span aria-hidden="true">${String.fromCharCode(97 + i)}</span>${esc(x)}</li>`).join('')}</ol></div>` : ''}
</div>
</section>`
    : c.included.length
      ? `<section class="fx-sec" id="services" aria-labelledby="services-title"><div class="wrap"><div class="fx-head" data-rv><h2 class="fx-h2" id="services-title">${no()}What you get</h2></div><ul class="fx-incl-big">${c.included.map((x, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(x)}</li>`).join('')}</ul></div></section>`
      : '';

  // The process as a roadmap: the member's steps, drawn in with the scroll, ending at the main button.
  const process = c.steps.length >= 2
    ? roadmap({ id: 'process', cls: 'fx-process', title: 'How a project runs', nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })), end: primary('btn btn-primary'), endLabel: c.name })
    : '';

  // The first sentence as a statement, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = c.aboutParas;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = `<section class="fx-sec fx-about" id="about" aria-labelledby="about-title">
<div class="wrap fx-about-grid">
<h2 class="fx-h2 fx-about-h" id="about-title">${no()}${esc(c.owner && c.owner !== c.name ? `${c.name}, led by ${c.owner}` : c.name)}</h2>
${first ? `<p class="fx-state" data-rv>${esc(first)}</p>` : ''}
<div class="fx-about-rest">
${rest.map((p) => `<p class="fx-p" data-rv>${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'fx-social' })}
</div>
</div>
</section>`;

  const clients = c.clients.length
    ? `<section class="fx-clients" aria-labelledby="clients-title"><div class="wrap fx-clients-in"><h2 class="fx-cl-h" id="clients-title">Clients</h2><ul class="fx-clients-list">${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="fx-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="fx-head" data-rv><h2 class="fx-h2" id="reviews-title">What clients say</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="fx-sec fx-faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap fx-faq"><h2 class="fx-h2" id="faq-title" data-rv>Good to know</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
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
<h2 class="fx-h2 fx-big" id="contact-title" data-rv>Tell us about the project.</h2>
${c.ctaSub ? `<p class="fx-lead" data-rv style="--d:1">${esc(c.ctaSub)}</p>` : ''}
${c.primary.kind !== 'form' ? `<div class="fx-ctas" data-rv style="--d:2">${primary()}</div>` : ''}
${c.promise ? `<p class="fx-promise" data-rv style="--d:2">${esc(c.promise)}</p>` : ''}
${P.contactList(c, { cls: 'fx-contact-list' })}
</div>
<div class="fx-form" data-rv style="--d:2">
<h3>Project inquiry</h3>
${P.form(c, { id: 'contact', fields, submit: 'Send the inquiry', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const mega = `<div class="fx-mega" aria-hidden="true"><span style="--fs:${Math.min(16, 158 / Math.max([...c.name].length, 6)).toFixed(1)}vw">${esc(c.name)}</span></div>`;
  const m = motion();
  const body = [P.header(c, { cls: 'fx-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, services, process, about, clients, reviews, faq, contact, '</main>', P.footer(c), mega, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '82rem' } };
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
@font-face{font-family:'Foundry Display Fallback';font-weight:500 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:99.4%}
@font-face{font-family:'Foundry Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.1%}
html:root{--font-display:"Schibsted Grotesk","Foundry Display Fallback",sans-serif;--font-body:"Instrument Sans","Foundry Body Fallback",sans-serif}
body{font-size:1.05rem}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn{border-radius:0;font-weight:600;letter-spacing:-.01em}
.btn:hover{transform:none}
.btn .i{transition:transform .3s cubic-bezier(.16,1,.3,1)}
.btn:hover .i{transform:translate(2px,-2px)}
.btn-primary{box-shadow:none}
.btn-ghost{border-width:1.5px}
.fx-no{display:block;margin-bottom:.9rem;font-family:var(--font-body);font-size:.9rem;font-weight:600;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--muted)}
@media (min-width:72rem){.fx-h2 .fx-no{position:absolute;margin:0;transform:translateX(calc(-100% - 1.25rem)) translateY(.4em)}}
.fx-h2{position:relative;font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-head{max-width:56rem;margin-bottom:clamp(2.5rem,2rem + 2vw,4.5rem)}
.fx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem);border-top:1px solid var(--line)}
.fx-lead{font-size:clamp(1.15rem,1rem + .55vw,1.4rem);line-height:1.5;color:var(--muted);max-width:36rem}
/* header */
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{position:relative;display:block;padding:.5rem 0;font-size:.95rem;font-weight:500;text-decoration:none}
.nav a::after{content:'';position:absolute;left:0;right:0;bottom:.3rem;height:1.5px;background:var(--pop);transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.7,0,.2,1)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem;font-size:.95rem}
.menu>summary{border-radius:0}
.menu-panel{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero */
.fx-hero{padding-top:clamp(2.5rem,2rem + 4vw,6rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem)}
.fx-meta{display:flex;flex-wrap:wrap;gap:.4rem 0;margin-top:2.5rem;padding-top:1rem;border-top:1.5px solid var(--ink);font-size:.85rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.fx-meta li{display:flex;align-items:center}
.fx-meta li+li::before{content:'';width:1.6rem;height:1px;margin:0 .8rem;background:var(--line)}
@media (max-width:39.99rem){.fx-meta{flex-direction:column;gap:.35rem}.fx-meta li+li::before{display:none}}
.fx-title{font-size:clamp(3.1rem,1.2rem + 8.2vw,10.5rem);line-height:.88;letter-spacing:-.065em;font-weight:600;text-wrap:balance}
.fx-title.long{font-size:clamp(2.6rem,1.2rem + 5.6vw,7.4rem)}
.fx-plate{margin:clamp(2.5rem,1.5rem + 4vw,5rem) 0 0;padding-left:max(1rem,calc((100% - var(--max)) / 2))}
@media (min-width:48rem){.fx-plate{padding-left:max(2rem,calc((100% - var(--max)) / 2 + var(--max) * .25))}}
.fx-plate-in{overflow:hidden;aspect-ratio:21/9;background:var(--surface)}
@media (max-width:47.99rem){.fx-plate-in{aspect-ratio:4/3}}
.fx-plate-img{width:100%;height:100%;object-fit:cover}
.fx-hero-row{display:grid;gap:1.75rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem);align-items:start}
@media (min-width:60rem){.fx-hero-row{grid-template-columns:1fr auto;align-items:end}}
.fx-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.fx-ctas .btn{flex:1 1 100%}}
/* service rows */
.fx-rows{border-top:1.5px solid var(--ink)}
.fx-row{position:relative;isolation:isolate;border-bottom:1px solid var(--line);outline:none}
.fx-row::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--dark);transform:scaleY(0);transform-origin:50% 100%;transition:transform .6s cubic-bezier(.7,0,.2,1)}
.fx-row-top{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:.5rem 1.25rem;padding:clamp(1.4rem,1rem + 1.4vw,2.4rem) .25rem}
.fx-row-n{font-size:.9rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted);transition:color .4s ease}
.fx-row h3{font-size:clamp(1.8rem,1.1rem + 3vw,4.2rem);line-height:.98;letter-spacing:-.055em;transition:transform .6s cubic-bezier(.16,1,.3,1),color .4s ease}
.fx-row-p{grid-column:2;font-family:var(--font-display);font-size:clamp(1.05rem,.95rem + .5vw,1.4rem);font-weight:600;letter-spacing:-.03em;transition:color .4s ease}
.fx-row-a{display:none;color:var(--muted);transition:transform .6s cubic-bezier(.16,1,.3,1),color .4s ease}
@media (min-width:48rem){.fx-row-top{grid-template-columns:4rem 1fr auto auto}.fx-row-p{grid-column:auto}.fx-row-a{display:inline-grid}}
.fx-row-more{display:grid;grid-template-rows:1fr;transition:grid-template-rows .6s cubic-bezier(.7,0,.2,1)}
.fx-row-in{overflow:hidden;display:grid;gap:.75rem;justify-items:start;padding:0 .25rem}
.fx-row-in>:last-child{margin-bottom:clamp(1.4rem,1rem + 1.4vw,2.4rem)}
.fx-row-in p{max-width:40rem;color:var(--muted);font-size:1.1rem;transition:color .4s ease}
.fx-row-d{font-variant-numeric:tabular-nums}
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
.fx-incl ol{display:grid;gap:0;border-top:1px solid var(--line)}
@media (min-width:48rem){.fx-incl ol{grid-template-columns:1fr 1fr;column-gap:2rem}}
.fx-incl li{display:flex;gap:1rem;align-items:baseline;padding:.75rem 0;border-bottom:1px solid var(--line);font-weight:500}
.fx-incl li span{font-size:.85rem;color:var(--muted)}
.fx-incl-big{border-top:1.5px solid var(--ink)}
.fx-incl-big li{display:flex;gap:1.5rem;align-items:baseline;padding:1.5rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.4rem,1rem + 1.6vw,2.4rem);font-weight:600;letter-spacing:-.04em;line-height:1.1}
.fx-incl-big span{font-size:.9rem;color:var(--muted);letter-spacing:0}
/* process */
.fx-process{padding-block:clamp(5rem,3.5rem + 6vw,10rem);background:var(--dark);color:var(--on-dark);--rm-ink:var(--on-dark);--rm-muted:var(--muted-on-dark);--rm-line:var(--line-on-dark);--rm-accent:var(--primary-on-dark);--rm-dot-bg:var(--dark)}
.fx-process .h2{font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-process .rm-txt h3{font-size:clamp(1.4rem,1.1rem + 1vw,2rem);letter-spacing:-.04em}
.fx-process .btn-primary{background:var(--on-dark);color:var(--dark)}
/* about */
.fx-about-grid{display:grid;gap:2rem}
@media (min-width:60rem){.fx-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-about-h{grid-column:1 / span 4;font-size:clamp(1.6rem,1.2rem + 1.4vw,2.6rem)}.fx-state{grid-column:5 / span 8}.fx-about-rest{grid-column:7 / span 6}}
.fx-about-h{font-size:clamp(1.6rem,1.2rem + 1.4vw,2.6rem);line-height:1.05}
.fx-state{font-family:var(--font-display);font-size:clamp(2rem,1.2rem + 3.4vw,4.6rem);font-weight:600;line-height:1;letter-spacing:-.05em;text-wrap:balance}
.fx-about-rest{display:grid;gap:1rem;justify-items:start}
.fx-p{font-size:1.15rem;line-height:1.65;max-width:34rem;color:var(--muted)}
/* clients */
.fx-clients{padding-block:clamp(3rem,2rem + 3vw,5rem);border-top:1px solid var(--line)}
.fx-clients-in{display:grid;gap:1.25rem}
@media (min-width:60rem){.fx-clients-in{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-cl-h{grid-column:1 / span 4}.fx-clients-list{grid-column:5 / span 8}}
.fx-cl-h{font-size:1rem;font-weight:600;letter-spacing:0;padding-top:.5rem}
.fx-clients-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));border-top:1.5px solid var(--ink)}
.fx-clients-list li{padding:.9rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);font-weight:600;letter-spacing:-.04em}
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
.fx-promise{padding-top:1rem;border-top:1px solid var(--line);color:var(--muted)}
.fx-contact-list{margin-top:.5rem;font-size:1.1rem}
.fx-form{padding:clamp(1.3rem,1rem + 1.6vw,2.6rem);background:var(--bg);border:1.5px solid var(--ink)}
.fx-form h3{margin-bottom:1.5rem;font-size:1.6rem}
.field input,.field select,.field textarea{border-radius:0;border-width:0 0 1.5px;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--pop)}
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
  why: 'Built for business to business services, with motion: a headline whose words snap onto the grid, your services and prices as big numbered rows, the process drawn in as a roadmap as you scroll, and a project inquiry form.',
  fonts: { q: 'family=Schibsted+Grotesk:wght@500..800&family=Instrument+Sans:wght@400..600&family=Instrument+Serif:ital@1', display: ['Schibsted Grotesk', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): type set on the grid, a plate that leans in, a process you scroll through.
  choreo: { intro: 'assemble', alive: ['pointer', 'scroll'], scroll: 'roadmap', pace: 'fast', look: 'Swiss poster stock, type set on the grid, crisp' },
  tokens,
  slots,
  nav,
  render,
};
