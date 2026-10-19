// Local service: for jobs people call or book (detailing, cleaning, lawn care, pet care, handymen).
// Bold and practical: the price up front with what's included, the area and hours, the member's promise
// next to the quote form, and a call bar on phones.

const P = require('../parts');
const { icon } = require('../icons');
const { heroFacts, cheapest, head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('./shared');

const id = 'local-service';

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1200, h: 1500, style: 'sweep', alt: c.profile.hero || `${c.name} at work` },
    { slot: 'about', file: 'about.jpg', w: 1200, h: 1200, style: 'mesh', alt: g[0] || `${c.name}, a finished job` },
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

function render(c) {
  const facts = heroFacts(c);
  const low = cheapest(c);
  const top = c.phone || c.hoursLine
    ? `<div class="topbar"><div class="wrap">
${c.hoursLine ? `<p class="tb-hours">${icon('clock', { size: 16 })}${esc(c.hoursLine)}</p>` : '<p></p>'}
${c.phone ? `<a href="${esc(c.phone.href)}">${icon('phone', { size: 16 })}${esc(c.phone.display)}</a>` : ''}
</div></div>`
    : '';

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
${c.area && !c.online ? `<p class="chip">${icon('pin', { size: 16 })}<span>${esc(c.place || c.area)}</span>${c.mobile ? '<span class="sep" aria-hidden="true"></span><span>We come to you</span>' : ''}</p>` : ''}
<h1 id="hero-title"${c.heroTitle.length > 34 ? ' class="long"' : ''}>${esc(c.heroTitle)}</h1>
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas">
${P.button(c.primary, 'btn btn-primary btn-lg')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg', c.secondary.kind === 'phone' ? 'phone' : '') : ''}
</div>
${facts.length ? `<ul class="ticks">${facts.map((f) => `<li>${icon('check', { size: 18 })}${esc(f)}</li>`).join('')}</ul>` : ''}
</div>
<div class="hero-media">
${P.img(c, 'hero', { cls: 'hero-img', eager: true })}
${low ? `<div class="price-card"><small>Prices from</small><strong>${esc(low.priceText.replace(/^From /, ''))}</strong><span>${esc(low.name)}</span></div>` : ''}
</div>
</div>
</section>`;

  // What's included (the member's own list), under the prices, or on its own when there are no prices.
  const included = c.included.length
    ? `<div class="incl-box"><h3>What's included</h3><ul class="incl">${c.included.map((x) => `<li>${icon('check', { size: 18 })}<span>${esc(x)}</span></li>`).join('')}</ul></div>`
    : '';
  const services = c.services.length || included
    ? `<section class="sec services" id="services" aria-labelledby="services-title">
<div class="wrap">
${c.services.length ? head({ eyebrow: 'Prices', title: c.services.some((s) => s.priceText) ? 'Services and prices' : 'Services', lead: c.services.some((s) => s.priceText) ? 'Every price is listed up front.' : '', id: 'services-title' }) : head({ eyebrow: 'Services', title: "What's included", id: 'services-title' })}
${c.services.length ? `<ul class="svc-grid${c.services.length === 2 || c.services.length === 4 ? ' two' : ''}">
${c.services
  .map(
    (s) => `<li class="svc">
<h3>${esc(s.name)}</h3>
${s.priceText ? `<p class="svc-price">${esc(s.priceText)}</p>` : ''}
${s.blurb ? `<p class="svc-blurb">${esc(s.blurb)}</p>` : ''}
${s.duration ? `<p class="svc-meta">${icon('clock', { size: 16 })}${esc(s.duration)}</p>` : ''}
</li>`
  )
  .join('\n')}
</ul>` : ''}
${included}
<div class="svc-foot">${P.button(c.primary, 'btn btn-primary')}${c.phone && c.primary.kind !== 'phone' ? `<p class="muted">Questions first? Call <a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>.</p>` : ''}</div>
</div>
</section>`
    : '';

  const how = c.steps.length
    ? `<section class="sec how" id="how" aria-labelledby="how-title">
<div class="wrap">
${head({ eyebrow: 'How it works', title: `Booked in ${['one', 'two', 'three', 'four', 'five', 'six'][c.steps.length - 1] || c.steps.length} steps`, id: 'how-title' })}
<ol class="steps">
${c.steps.map((s, i) => `<li class="step"><span class="step-n" aria-hidden="true">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('\n')}
</ol>
</div>
</section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
${P.img(c, 'about', { cls: 'about-img' })}
<div class="about-copy">
<p class="eyebrow">About</p>
<h2 class="h2" id="about-title">${esc(c.owner && c.owner !== c.name ? `Meet ${c.owner}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'about-social' })}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap">${head({ eyebrow: 'Reviews', title: 'What customers say', id: 'reviews-title' })}${P.reviews(c)}</div></section>`
    : '';

  const areaCard = c.area && !c.online
    ? `<div class="card"><h3>${icon('pin')}${c.mobile ? 'Where we work' : 'Where to find us'}</h3><p class="big">${esc(c.address || c.area)}</p>${c.mobile ? '<p class="muted">We come to your home or office.</p>' : ''}${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>`
    : '';
  const hoursCard = c.hours.rows.length ? `<div class="card"><h3>${icon('clock')}Hours</h3>${P.hours(c.hours.rows)}</div>` : '';
  const info = areaCard || hoursCard
    ? `<section class="sec info-sec" id="area" aria-labelledby="area-title"><div class="wrap">${head({ eyebrow: 'Area and hours', title: c.mobile ? 'Where and when' : 'Visit or call', id: 'area-title' })}<div class="info">${areaCard}${hoursCard}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}${P.faq(c.faq)}</div></section>`
    : '';

  const formTitle = c.primary.kind === 'form' ? 'Get a quote' : 'Or send a message';
  const formLead = c.primary.kind === 'form' ? `Tell us what you need${c.mobile ? ' and where' : ''}, and ${c.owner && c.owner !== c.name ? c.owner : 'we'} will get back to you with a price.` : `Not sure which service fits? Ask here and ${c.owner && c.owner !== c.name ? c.owner : 'we'} will get back to you.`;
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
<div class="quote-copy">
<p class="eyebrow">Contact</p>
<h2 class="h2" id="quote-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="promise">${icon('shield', { size: 20 })}<span><strong>${c.owner && c.owner !== c.name ? 'My promise' : 'Our promise'}:</strong> ${esc(c.promise)}</span></p>` : ''}
${c.primary.kind !== 'form' ? `<div class="ctas">${P.button(c.primary, 'btn btn-primary btn-lg')}</div>` : ''}
${P.contactList(c, { cls: 'quote-contact' })}
</div>
<div class="form-card">
<h3 class="form-title">${esc(formTitle)}</h3>
<p class="form-lead">${esc(formLead)}</p>
${P.form(c, { id: 'quote', fields, submit: c.primary.kind === 'form' ? 'Send my request' : 'Send message', subject: `Quote request for ${c.name}` })}
</div>
</div>
</section>`;

  const body = [top, P.header(c, { cls: 'hdr-ls' }), '<main id="main">', hero, services, how, about, reviews, info, faq, quote, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: CSS, bodyClass: 'has-bar' };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2,h3{font-weight:800}
.h2{letter-spacing:-.03em}
.topbar{background:var(--dark);color:var(--on-dark);font-size:.875rem}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:2.5rem}
.topbar p,.topbar a{display:flex;align-items:center;gap:.5rem}
.topbar p{color:var(--muted-on-dark)}
.topbar a{font-weight:600;text-decoration:none;color:var(--on-dark)}
@media (max-width:47.99rem){.topbar .tb-hours{display:none}.topbar .wrap{justify-content:center}}
.hdr{position:relative;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
@media (min-width:60rem){.hdr{position:sticky;top:0}}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.5rem}
.brand{display:flex;align-items:center;gap:.7rem;margin-right:auto;font-family:var(--font-display);font-size:1.15rem;font-weight:800;line-height:1.1;letter-spacing:-.015em;text-decoration:none}
.mark{display:inline-grid;place-items:center;flex:none;width:2.5rem;height:2.5rem;border-radius:.75rem;background:var(--primary);color:var(--on-primary);font-size:.95rem;letter-spacing:0}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.55rem .8rem;border-radius:.6rem;font-size:.97rem;font-weight:500;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink);background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.2rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(2.25rem,1.25rem + 4vw,5.5rem) clamp(3.5rem,2rem + 5vw,7rem)}
.hero::before{content:"";position:absolute;top:-30%;right:-20%;width:70vw;height:70vw;max-width:60rem;max-height:60rem;background:radial-gradient(closest-side,var(--primary-soft),transparent 70%);pointer-events:none}
.hero-grid{position:relative;display:grid;gap:clamp(2.25rem,1rem + 4vw,4.5rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:1.12fr .88fr}}
.chip{display:inline-flex;flex-wrap:wrap;align-items:center;gap:.5rem;padding:.42rem .9rem .42rem .65rem;border-radius:999px;background:var(--bg);border:1px solid var(--line);font-size:.9rem;font-weight:600}
.chip .i{color:var(--primary-text)}
.chip .sep{width:.3rem;height:.3rem;border-radius:50%;background:var(--muted)}
.hero h1{margin-top:1.3rem;font-size:clamp(2.55rem,1.5rem + 4.6vw,5.2rem);line-height:.98;letter-spacing:-.04em}
.hero h1.long{font-size:clamp(2.3rem,1.45rem + 3.6vw,4.3rem);line-height:1}
.hero .lead{margin-top:1.3rem;max-width:34rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.ticks{display:flex;flex-wrap:wrap;gap:.65rem 1.5rem;margin-top:2rem;font-size:.95rem;font-weight:500;color:var(--muted)}
.ticks li{display:flex;align-items:center;gap:.45rem}
.ticks .i{color:var(--primary-text)}
.hero-media{position:relative}
.hero-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:28px;box-shadow:0 40px 80px -40px rgba(0,0,0,.45)}
@media (max-width:59.99rem){.hero-img{aspect-ratio:5/4}}
.price-card{position:absolute;left:1rem;bottom:1rem;display:grid;gap:.1rem;min-width:11rem;padding:1rem 1.3rem;border-radius:18px;background:var(--bg);box-shadow:0 24px 48px -20px rgba(0,0,0,.4)}
@media (min-width:60rem){.price-card{left:-2rem;bottom:2.5rem}}
.price-card small{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.price-card strong{font-family:var(--font-display);font-size:2.1rem;font-weight:800;line-height:1.05;letter-spacing:-.03em;color:var(--primary-deep)}
.price-card span{font-size:.95rem;color:var(--muted)}
.services{padding-top:clamp(3rem,2rem + 3vw,5rem)}
.svc-grid{display:grid;gap:1rem}
@media (min-width:40rem){.svc-grid{grid-template-columns:repeat(2,1fr)}}
@media (min-width:64rem){.svc-grid{grid-template-columns:repeat(3,1fr)}.svc-grid.two{grid-template-columns:repeat(2,1fr)}}
.svc{display:flex;flex-direction:column;gap:.7rem;padding:1.7rem;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.svc:hover{transform:translateY(-3px);border-color:var(--primary-tint);box-shadow:0 22px 44px -28px rgba(0,0,0,.35)}
.svc h3{font-size:1.3rem;letter-spacing:-.015em}
.svc-price{font-family:var(--font-display);font-size:2.3rem;font-weight:800;line-height:1;letter-spacing:-.035em;color:var(--primary-deep)}
.svc-blurb{color:var(--muted)}
.svc-meta{display:flex;align-items:center;gap:.4rem;margin-top:auto;font-size:.9rem;color:var(--muted)}
.svc-foot{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:2rem}
.incl-box{margin-top:2rem;padding:clamp(1.25rem,1rem + 1vw,2rem);border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
.services .sec-head + .incl-box{margin-top:0}
.incl-box h3{margin-bottom:1rem;font-size:1.15rem}
.incl{display:grid;gap:.7rem}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;gap:.7rem 2rem}}
.incl li{display:flex;gap:.6rem;align-items:flex-start}
.incl .i{flex:none;margin-top:.25rem;color:var(--primary-text)}
.svc-foot a:not(.btn){font-weight:600;color:var(--ink)}
.how{background:var(--dark);color:var(--on-dark)}
.how .eyebrow{color:var(--primary-on-dark)}
.steps{display:grid;gap:1rem}
@media (min-width:48rem){.steps{grid-template-columns:repeat(3,1fr)}}
.step{padding:1.9rem;border-radius:var(--radius);border:1px solid var(--line-on-dark)}
.step-n{display:block;font-family:var(--font-display);font-size:3.4rem;font-weight:800;line-height:1;letter-spacing:-.05em;color:var(--primary-on-dark)}
.step h3{margin-top:1.4rem;font-size:1.35rem}
.step p{margin-top:.55rem;color:var(--muted-on-dark)}
.about-grid{display:grid;gap:clamp(2rem,1rem + 3vw,4.5rem);align-items:center}
@media (min-width:56rem){.about-grid{grid-template-columns:.95fr 1.05fr}}
.about-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:28px}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-copy p:not(.eyebrow){font-size:1.15rem;line-height:1.65;max-width:36rem}
.about-social{margin-top:.5rem}
.info-sec{background:var(--surface)}
.info{display:grid;gap:1rem}
@media (min-width:48rem){.info{grid-template-columns:repeat(2,1fr)}}
.card{display:grid;align-content:start;gap:.75rem;padding:1.9rem;border-radius:var(--radius);background:var(--bg);border:1px solid var(--line)}
.card h3{display:flex;align-items:center;gap:.6rem;font-size:1.15rem}
.card h3 .i{color:var(--primary-text)}
.card .big{font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1.4vw,2.4rem);font-weight:800;line-height:1.08;letter-spacing:-.03em}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;font-weight:600;color:var(--primary-text);text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.quote{background:var(--dark);color:var(--on-dark)}
.quote .eyebrow{color:var(--primary-on-dark)}
.quote .lead{color:var(--muted-on-dark);margin-top:1rem}
.quote-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.quote-grid{grid-template-columns:.85fr 1.15fr;gap:4rem}}
.quote-copy{display:grid;gap:.4rem;align-content:start}
.promise{display:flex;gap:.7rem;align-items:flex-start;margin-top:1.25rem;padding:1rem 1.2rem;border-radius:18px;border:1px solid var(--line-on-dark);font-size:1.05rem;line-height:1.5}
.promise .i{flex:none;margin-top:.15rem;color:var(--primary-on-dark)}
.promise strong{color:var(--on-dark)}
.quote-contact{margin-top:1.75rem}
.quote-contact .i{color:var(--primary-on-dark)}
.quote-contact a{color:var(--on-dark)}
.form-card{padding:clamp(1.3rem,1rem + 1.6vw,2.4rem);border-radius:26px;background:var(--bg);color:var(--ink);box-shadow:0 40px 90px -40px rgba(0,0,0,.65)}
.form-title{font-size:1.6rem;letter-spacing:-.02em}
.form-lead{margin:.4rem 0 1.5rem;color:var(--muted)}
.quote .ctas{margin-top:1.75rem}
`;

module.exports = {
  id,
  name: 'Local service',
  bestFor: 'Detailers, cleaners, lawn care, pet care, handymen and other jobs people call or book',
  slots,
  nav,
  render,
};
