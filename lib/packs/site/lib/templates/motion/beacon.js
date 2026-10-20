// Beacon (animated, local service): for jobs people call or book, set on black lacquer.
//   Object:   the finished panel, and the work-order tag that hangs from the mirror while the job is done.
//   Material: black lacquer and chrome: a near-black ground, 1px chrome hairlines, 4px radii, wide grotesk type.
//   One move: haze to gloss. The hero photo comes up from a dull grey haze to a clear, saturated finish while the
//             headline's words come into focus one by one (choreo intro 'develop').
//   Pop:      the member's colour lands on the place in the headline (one drawn line), then on the roadmap's line.
// At rest the work-order tag sways on its string toward the pointer and swings when tapped. The one scroll moment is
// the member's steps as a roadmap that draws itself, ending at the Book button (backwards when scrolling up).
// Prices are hand set with leaders and tabular figures; area and hours are set like a label and a timetable.
// JavaScript off and reduced motion: the complete, still page. Its motion is the `choreo` block at the bottom.

const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'beacon';

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1600, h: 1000, style: 'sweep', alt: c.profile.hero || `${c.name} at work` },
    { slot: 'about', file: 'about.jpg', w: 1200, h: 1400, style: 'mesh', alt: g[0] || `${c.name}, a finished job` },
  ];
}

function nav(c) {
  return [
    c.services.length ? { label: 'Prices', href: '#services' } : c.included.length ? { label: "What's included", href: '#services' } : null,
    c.steps.length && { label: 'How it works', href: '#how' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#quote' },
  ].filter(Boolean);
}

// The headline split on the server into words (so nothing reflows when the intro starts); a short place at the end
// stays one piece, so the member's colour underlines the whole place.
function headParts(title, place) {
  let rest = String(title || '').trim();
  let tail = '';
  if (place && place.length <= 14 && rest.endsWith(place) && rest.length > place.length) {
    tail = place;
    rest = rest.slice(0, -place.length).trim();
  }
  const parts = rest.split(/\s+/).filter(Boolean);
  if (tail) parts.push(tail);
  return parts.map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

function render(c) {
  const low = cheapest(c);
  const who = c.owner && c.owner !== c.name ? c.owner : '';
  const priced = c.services.some((s) => s.priceText);

  // The spec beside the photo: where and when, set as a small timetable.
  const spec = [
    c.area && !c.online ? ['Where', c.mobile ? `We come to you in ${c.area}` : c.address || c.area] : null,
    c.hoursLine ? ['When', c.hoursLine] : null,
    c.booking ? ['Booking', 'Online, any time'] : c.phone ? ['Call', c.phone.display] : null,
  ].filter(Boolean);

  const tag = low
    ? `<div class="tag-pos" aria-hidden="true"><div class="tag" data-alive="1.4"><span class="tag-hole"></span><span class="tag-k">${low.from || c.services.length > 1 ? 'From' : 'Price'}</span><strong>${esc(low.priceText.replace(/^From /, ''))}</strong><span class="tag-n">${esc(low.name)}</span>${low.duration ? `<span class="tag-d">${esc(low.duration)}</span>` : ''}</div></div>`
    : '';

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap">
<h1 id="hero-title" class="hero-h${c.heroTitle.length > 44 ? ' long' : ''}" data-ci="head">${headParts(c.heroTitle, c.place)}</h1>
<div class="hero-row">
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas" data-ci="then">
${P.button(c.primary, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}
${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg', c.secondary.kind === 'phone' ? 'phone' : '') : ''}
</div>
</div>
</div>
<div class="hero-media">
${spec.length ? `<dl class="spec" data-ci="then">${spec.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '<div></div>'}
<div class="hero-fig">
<div class="hero-frame" data-ci="subject">${P.img(c, 'hero', { cls: 'hero-img', eager: true })}</div>
${tag}
</div>
</div>
</section>`;

  const included = c.included.length
    ? `<div class="incl-box"><h3>What's included</h3><ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '';
  const services = c.services.length || included
    ? `<section class="sec prices" id="services" aria-labelledby="services-title">
<div class="wrap prices-grid">
<div class="prices-head" data-rv>
<h2 class="h2" id="services-title">${c.services.length ? (priced ? 'Prices' : 'Services') : "What's included"}</h2>
${priced ? '<p class="prices-note">Every price is listed up front.</p>' : ''}
<div class="prices-cta">${P.button(c.primary, 'btn btn-primary').replace('<a ', '<a data-mag ')}${c.phone && c.primary.kind !== 'phone' ? `<p class="muted">Questions first? Call <a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>.</p>` : ''}</div>
</div>
<div class="prices-body">
${c.services.length ? `<ol class="plist">
${c.services
  .map(
    (s, i) => `<li class="pl" data-rv style="--d:${i}">
<span class="pl-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<h3 class="pl-name">${esc(s.name)}</h3>
<span class="pl-lead" aria-hidden="true"></span>
${s.priceText ? `<p class="pl-price">${esc(s.priceText)}</p>` : '<span></span>'}
${s.blurb || s.duration ? `<p class="pl-meta">${[s.blurb, s.duration].filter(Boolean).map(esc).join('<span aria-hidden="true"> / </span>')}</p>` : ''}
</li>`
  )
  .join('\n')}
</ol>` : ''}
${included}
</div>
</div>
</section>`
    : '';

  const how = c.steps.length
    ? roadmap({ id: 'how', cls: 'how', title: `Booked in ${['one', 'two', 'three', 'four', 'five', 'six'][c.steps.length - 1] || c.steps.length} steps`, nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })), end: P.button(c.primary, 'btn btn-primary'), endLabel: c.name })
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media" data-rv="mask">${P.img(c, 'about', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div>
<div class="about-copy" data-rv>
<h2 class="h2" id="about-title">${esc(who ? `Meet ${who}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'about-social' })}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec revs" aria-labelledby="reviews-title"><div class="wrap"><h2 class="h2" id="reviews-title" data-rv>What customers say</h2><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const hasArea = c.area && !c.online;
  const info = hasArea || c.hours.rows.length
    ? `<section class="sec info" id="area" aria-labelledby="area-title">
<div class="wrap">
<h2 class="info-h" id="area-title" data-rv>${c.mobile ? 'Where and when' : 'Visit or call'}</h2>
${hasArea ? `<div class="strip" data-rv style="--d:1"><p class="label-k">${c.mobile ? 'Service area' : 'Address'}</p><p class="strip-v">${esc(c.address || c.area)}</p></div>` : ''}
<div class="info-row">
${hasArea ? `<div class="info-note" data-rv style="--d:2">${c.mobile ? '<p>We come to your home or office.</p>' : ''}${c.mapsUrl ? `<p><a class="u-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>` : ''}
${c.hours.rows.length ? `<div class="tt" data-rv style="--d:3"><p class="label-k">Hours</p>${P.hours(c.hours.rows)}</div>` : ''}
</div>
</div>
</section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-rv>Good to know</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const formTitle = c.primary.kind === 'form' ? 'Get a quote' : 'Or send a message';
  const formLead = c.primary.kind === 'form' ? `Tell us what you need${c.mobile ? ' and where' : ''}, and ${who || 'we'} will get back to you with a price.` : `Not sure which service fits? Ask here and ${who || 'we'} will get back to you.`;
  const closing = c.mobile ? `Tell ${who || 'us'} where the car is.` : c.primary.kind === 'form' ? 'Ask for a price.' : 'Book a time.';
  const fields = [
    'name',
    { ...P.FIELD_PRESETS.phone, required: true },
    { ...P.FIELD_PRESETS.email, required: false },
    c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: [...c.services.map((s) => s.name), 'Something else'], half: true } : null,
    c.mobile ? { ...P.FIELD_PRESETS.address, half: true } : null,
    { ...P.FIELD_PRESETS.message, label: 'Tell us about the job' },
  ].filter(Boolean);
  const quote = `<section class="sec quote" id="quote" aria-labelledby="quote-title">
<div class="wrap quote-grid">
<div class="quote-copy" data-rv>
<h2 class="h2 quote-h" id="quote-title">${esc(closing)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="promise"><strong>${who ? 'My promise' : 'Our promise'}.</strong> ${esc(c.promise)}</p>` : ''}
${c.primary.kind !== 'form' ? `<div class="ctas">${P.button(c.primary, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}</div>` : ''}
${P.contactList(c, { cls: 'quote-contact' })}
</div>
<div class="sheet" data-rv style="--d:2">
<h3 class="sheet-title">${esc(formTitle)}</h3>
<p class="sheet-lead">${esc(formLead)}</p>
${P.form(c, { id: 'quote', fields, submit: c.primary.kind === 'form' ? 'Send my request' : 'Send message', subject: `Quote request for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-bc', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, services, how, about, reviews, info, faq, quote, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '3px', btnRadius: '4px', max: '80rem' } };
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
@font-face{font-family:'Beacon Display Fallback';font-weight:500 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:123.6%}
@font-face{font-family:'Beacon Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:106.4%}
html:root{--pop:var(--primary-on-dark);--font-display:"Archivo","Beacon Display Fallback",sans-serif;--font-body:"Inter","Beacon Body Fallback",sans-serif}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 4%,var(--dark));--chrome:color-mix(in srgb,var(--on-dark) 16%,var(--dark));--paper:var(--on-dark);--ease:cubic-bezier(.16,1,.3,1)}
h1,h2,h3{font-weight:800}
.h2{font-size:clamp(2.3rem,1.3rem + 3.6vw,4.6rem);line-height:.95;letter-spacing:-.045em;font-stretch:115%}
.btn{font-weight:600;letter-spacing:-.005em;transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.btn:hover{transform:none}
.btn-primary{box-shadow:none}
.btn-line{background:transparent;color:var(--ink);border:1px solid var(--chrome)}
.btn-line:hover{border-color:var(--ink)}
.u-link{display:inline-flex;align-items:center;gap:.35rem;color:var(--ink);text-decoration:underline;text-decoration-color:var(--chrome);text-underline-offset:.3em}
.u-link:hover{text-decoration-color:var(--pop)}
.hdr{position:sticky;top:0;z-index:30;background:var(--dark);color:var(--ink);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--chrome)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.1rem;font-weight:800;font-stretch:118%;line-height:1.1;letter-spacing:-.025em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{display:block;padding:.4rem 0;font-size:.95rem;color:var(--muted);text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{background:transparent;color:var(--ink);border:1px solid var(--chrome);border-radius:4px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-top:clamp(2.5rem,1.5rem + 4vw,6rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem)}
.hero-h{max-width:13.5ch;font-size:clamp(2.75rem,.9rem + 6.6vw,7.4rem);line-height:.9;letter-spacing:-.05em;font-stretch:118%}
.hero-h.long{max-width:15ch;font-size:clamp(2.6rem,.9rem + 5.6vw,6.4rem)}
.hero-row{display:grid;gap:1.75rem;margin-top:clamp(1.75rem,1rem + 2.5vw,3.25rem)}
@media (min-width:60rem){.hero-row{grid-template-columns:minmax(0,32rem) auto;justify-content:space-between;align-items:end}}
.hero .lead{color:var(--muted);max-width:34rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-media{display:grid;gap:1.5rem;margin-top:clamp(2.5rem,1.5rem + 4vw,5rem);padding-left:1rem}
@media (min-width:48rem){.hero-media{padding-left:max(2rem,calc((100% - var(--max)) / 2))}}
@media (min-width:60rem){.hero-media{grid-template-columns:13rem minmax(0,1fr);gap:2rem;align-items:end}}
.spec{display:grid;align-content:end;padding-right:1rem;font-size:.9375rem;order:2}
@media (min-width:60rem){.spec{order:0;padding-right:0}}
.spec div{display:grid;gap:.15rem;padding:.8rem 0;border-top:1px solid var(--chrome)}
.spec dt,.label-k{font-size:.75rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.spec dd{margin:0;color:var(--ink)}
.hero-fig{position:relative}
.hero-frame{overflow:hidden;aspect-ratio:21/9;border-radius:4px 0 0 4px;background:var(--surface)}
@media (max-width:47.99rem){.hero-frame{aspect-ratio:4/3}}
.hero-img{width:100%;height:100%;object-fit:cover}
.tag-pos{position:absolute;left:clamp(1rem,3vw,3rem);top:-1.6rem;transform:rotate(-4deg);transform-origin:50% 0}
.tag{position:relative;display:grid;gap:.05rem;width:9.5rem;padding:1.6rem 1rem .9rem;border-radius:3px;background:var(--paper);color:var(--dark);transform-origin:50% 0;box-shadow:0 18px 30px -18px rgba(0,0,0,.7)}
.tag-hole{position:absolute;left:50%;top:.55rem;width:.6rem;height:.6rem;margin-left:-.3rem;border-radius:50%;background:var(--dark)}
.tag-k,.tag-d{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--dark) 70%,var(--paper))}
.tag strong{font-family:var(--font-display);font-size:2.3rem;font-weight:800;font-stretch:112%;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.tag-n{margin-top:.2rem;font-size:.9rem;line-height:1.3;border-top:1px solid color-mix(in srgb,var(--dark) 18%,var(--paper));padding-top:.4rem}
@media (max-width:47.99rem){.tag{width:8.25rem;padding:1.4rem .8rem .75rem}.tag strong{font-size:1.9rem}}
.prices-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.prices-grid{grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:2rem}}
.prices-head{display:grid;gap:1rem;align-content:start}
@media (min-width:60rem){.prices-head{position:sticky;top:7rem}}
.prices-note{color:var(--muted)}
.prices-cta{display:grid;gap:.9rem;justify-items:start;margin-top:.75rem}
.prices-cta a:not(.btn){color:var(--ink);font-weight:600}
.plist{border-top:1px solid var(--chrome)}
.pl{display:grid;grid-template-columns:2.4rem auto minmax(1.5rem,1fr) auto;align-items:baseline;column-gap:.75rem;padding:1.4rem 0 1.5rem;border-bottom:1px solid var(--chrome)}
.pl-n{font-size:.8rem;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.pl-name{font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);font-stretch:112%;letter-spacing:-.03em;line-height:1.1}
.pl-lead{align-self:end;margin-bottom:.45em;border-bottom:1px dotted var(--chrome)}
.pl-price{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.6vw,2.8rem);font-weight:800;font-stretch:112%;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap}
.pl-meta{grid-column:2 / -1;margin-top:.35rem;color:var(--muted);font-size:.975rem}
@media (max-width:39.99rem){.pl{grid-template-columns:2rem minmax(0,1fr) auto}.pl-lead{display:none}}
.incl-box{margin-top:2.5rem}
.incl-box h3{font-size:1.2rem;font-stretch:112%;margin-bottom:.75rem}
.incl{display:grid;border-top:1px solid var(--chrome)}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;column-gap:2rem}}
.incl li{padding:.75rem 0;border-bottom:1px solid var(--chrome)}
.how{border-top:1px solid var(--chrome);border-bottom:1px solid var(--chrome);--rm-line:var(--chrome);--rm-accent:var(--pop);--rm-dot-bg:var(--dark)}
.how .rm-head .h2{max-width:12ch}
.about-grid{display:grid;gap:clamp(2rem,1rem + 3vw,5rem);align-items:end}
@media (min-width:56rem){.about-grid{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}
.about-media{overflow:hidden;aspect-ratio:5/6;border-radius:4px}
@media (min-width:56rem){.about-media{margin-left:calc(-1 * max(0rem,(100vw - var(--max)) / 2 - 2rem))}}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.about-copy{display:grid;gap:1.2rem;justify-items:start;padding-bottom:1rem}
.about-copy p{font-size:1.125rem;line-height:1.65;max-width:34rem;color:var(--muted)}
.about-copy p:first-of-type{color:var(--ink)}
.review{background:none;border:0;border-top:1px solid var(--chrome);border-radius:0;padding:1.5rem 0 0}
.revs .h2{margin-bottom:2.5rem}
.info{border-top:1px solid var(--chrome)}
.info-h{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem);font-stretch:112%;letter-spacing:-.03em;margin-bottom:clamp(1.5rem,1rem + 2vw,3rem)}
.strip{display:grid;gap:.75rem;padding-block:1.25rem 1.6rem;border-block:1px solid var(--chrome)}
.strip-v{font-family:var(--font-display);font-size:clamp(2.4rem,.8rem + 6vw,7.5rem);font-weight:800;font-stretch:118%;line-height:.9;letter-spacing:-.05em;text-wrap:balance}
.label-s{color:var(--muted)}
.info-row{display:grid;gap:2rem;margin-top:2rem}
@media (min-width:60rem){.info-row{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:2rem}}
.info-note{display:grid;gap:.5rem;align-content:start;color:var(--muted)}
.tt{display:grid;gap:.4rem}
.tt .hours div{border-bottom-color:var(--chrome)}
.tt .hours dd{color:var(--ink);font-variant-numeric:tabular-nums}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:2.5rem 2rem}.faq-grid>.h2{grid-column:1 / span 8}.faq-grid>div{grid-column:5 / span 8}}
.faq{gap:0;border-top:1px solid var(--chrome)}
.faq details{border:0;border-bottom:1px solid var(--chrome);border-radius:0;background:none}
.faq summary{padding:1.2rem 0;font-size:1.1rem}
.faq .ans{padding:0 0 1.3rem}
.quote{border-top:1px solid var(--chrome)}
.quote-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.quote-grid{grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:4rem}}
.quote-copy{display:grid;gap:1.1rem;align-content:start}
.quote-h{max-width:11ch;font-size:clamp(2.5rem,1.2rem + 4.4vw,5.4rem)}
.quote .lead{color:var(--muted)}
.promise{padding-top:1rem;border-top:1px solid var(--chrome);color:var(--muted)}
.promise strong{color:var(--ink)}
.quote-contact{margin-top:1rem}
.quote-contact a{color:var(--ink)}
.sheet{--bg:var(--paper);--ink:var(--dark);--muted:color-mix(in srgb,var(--dark) 68%,var(--paper));--line:color-mix(in srgb,var(--dark) 22%,var(--paper));--primary-text:var(--primary-deep);padding:clamp(1.3rem,1rem + 1.6vw,2.4rem);border-radius:4px;background:var(--bg);color:var(--ink)}
.sheet-title{font-size:1.6rem;font-stretch:112%;letter-spacing:-.03em}
.sheet-lead{margin:.4rem 0 1.5rem;color:var(--muted)}
.sheet .field input,.sheet .field select,.sheet .field textarea{border-radius:3px}
.ftr{border-top-color:var(--chrome)}
.mbar{background:var(--dark);border-top-color:var(--chrome);box-shadow:none}
.mbar .btn-ghost{border:1px solid var(--chrome)}
`;

module.exports = {
  id,
  kind: 'local-service',
  name: 'Beacon',
  bestFor: 'Detailers, cleaners, lawn care, movers and other jobs people call or book, with motion',
  why: 'Built for jobs people call or book, with motion: the hero comes up from haze to a clear finish, the price tag sways toward you, the steps draw themselves in as you scroll, and prices, area and the quote form stay up front.',
  fonts: { q: 'family=Archivo:wdth,wght@100..125,500..900&family=Inter:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): haze to gloss, a hanging tag with some spring in it, steps you scroll through.
  choreo: { intro: 'develop', alive: ['pointer', 'tap', 'drift'], scroll: 'roadmap', pace: 'medium', look: 'black lacquer, chrome hairlines, haze to gloss' },
  slots,
  nav,
  render,
};
