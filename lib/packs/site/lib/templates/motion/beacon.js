// Beacon (animated, local service): for jobs people call or book. A dark hero with the headline rising in word by word,
// the photo wiping in under it with a slow parallax, a band of the member's services running across the page, price
// cards with a light that follows the pointer, steps joined by a line that draws as you scroll, and the quote form.

const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { heroFacts, cheapest, head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('../shared');

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

// The band's words: the member's service names and area, nothing else.
function bandItems(c) {
  const out = c.services.map((s) => s.name);
  if (!out.length) out.push(...c.included.slice(0, 6));
  if (c.area && !c.online) out.push(c.mobile ? `We come to you in ${c.place || c.area}` : c.place || c.area);
  return out.slice(0, 10);
}

function render(c) {
  const facts = heroFacts(c);
  const low = cheapest(c);
  const band = bandItems(c);
  const bandRow = (hidden) => `<ul class="band-row"${hidden ? ' aria-hidden="true"' : ''}>${band.map((b) => `<li>${esc(b)}<span class="star" aria-hidden="true">${icon('spark', { size: 18 })}</span></li>`).join('')}</ul>`;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="hero-glow" aria-hidden="true" data-par="-0.08"></div>
<div class="wrap hero-in">
${c.area && !c.online ? `<p class="chip" data-rv><span class="dot" aria-hidden="true"></span><span>${esc(c.place || c.area)}</span>${c.mobile ? '<span class="sep" aria-hidden="true"></span><span>We come to you</span>' : ''}</p>` : ''}
<h1 id="hero-title" data-split${c.heroTitle.length > 34 ? ' class="long"' : ''}>${esc(c.heroTitle)}</h1>
<div class="hero-row">
<p class="lead" data-rv style="--d:4">${esc(c.heroSub)}</p>
<div class="ctas" data-rv style="--d:5">
${P.button(c.primary, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg', c.secondary.kind === 'phone' ? 'phone' : '') : ''}
</div>
</div>
${facts.length ? `<ul class="ticks" data-rv style="--d:6">${facts.map((f) => `<li>${icon('check', { size: 18 })}${esc(f)}</li>`).join('')}</ul>` : ''}
</div>
<div class="wrap hero-media">
<div class="hero-frame" data-rv="mask" style="--d:3">${P.img(c, 'hero', { cls: 'hero-img', eager: true }).replace('<img ', '<img data-par="0.06" ')}</div>
${low ? `<div class="price-card" data-rv="scale" style="--d:8"><small>Prices from</small><strong>${esc(low.priceText.replace(/^From /, ''))}</strong><span>${esc(low.name)}</span></div>` : ''}
</div>
</section>`;

  const marquee = band.length > 1
    ? `<div class="band" aria-label="Services"><div class="mq"><div class="mq-track">${bandRow(false)}${bandRow(true)}</div></div></div>`
    : '';

  const included = c.included.length
    ? `<div class="incl-box" data-rv><h3>What's included</h3><ul class="incl">${c.included.map((x) => `<li>${icon('check', { size: 18 })}<span>${esc(x)}</span></li>`).join('')}</ul></div>`
    : '';
  const services = c.services.length || included
    ? `<section class="sec services" id="services" aria-labelledby="services-title">
<div class="wrap">
<div data-rv>${c.services.length ? head({ eyebrow: 'Prices', title: c.services.some((s) => s.priceText) ? 'Services and prices' : 'Services', lead: c.services.some((s) => s.priceText) ? 'Every price is listed up front.' : '', id: 'services-title' }) : head({ eyebrow: 'Services', title: "What's included", id: 'services-title' })}</div>
${c.services.length ? `<ul class="svc-grid${c.services.length === 2 || c.services.length === 4 ? ' two' : ''}">
${c.services
  .map(
    (s, i) => `<li class="svc" data-spot data-rv style="--d:${i % 3}">
<span class="svc-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<h3>${esc(s.name)}</h3>
${s.priceText ? `<p class="svc-price">${esc(s.priceText)}</p>` : ''}
${s.blurb ? `<p class="svc-blurb">${esc(s.blurb)}</p>` : ''}
${s.duration ? `<p class="svc-meta">${icon('clock', { size: 16 })}${esc(s.duration)}</p>` : ''}
</li>`
  )
  .join('\n')}
</ul>` : ''}
${included}
<div class="svc-foot" data-rv>${P.button(c.primary, 'btn btn-primary').replace('<a ', '<a data-mag ')}${c.phone && c.primary.kind !== 'phone' ? `<p class="muted">Questions first? Call <a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>.</p>` : ''}</div>
</div>
</section>`
    : '';

  const how = c.steps.length
    ? `<section class="sec how" id="how" aria-labelledby="how-title">
<div class="wrap">
<div data-rv>${head({ eyebrow: 'How it works', title: `Booked in ${['one', 'two', 'three', 'four', 'five', 'six'][c.steps.length - 1] || c.steps.length} steps`, id: 'how-title' })}</div>
<ol class="steps" data-rv style="--n:${Math.min(c.steps.length, 4)}">
${c.steps.map((s, i) => `<li class="step" style="--d:${i + 1}"><span class="step-n" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('\n')}
</ol>
</div>
</section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media" data-rv="mask">${P.img(c, 'about', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div>
<div class="about-copy">
<p class="eyebrow" data-rv>About</p>
<h2 class="h2" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `Meet ${c.owner}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c, { cls: 'about-social' })}</div>
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap"><div data-rv>${head({ eyebrow: 'Reviews', title: 'What customers say', id: 'reviews-title' })}</div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const areaCard = c.area && !c.online
    ? `<div class="card" data-spot data-rv><h3>${icon('pin')}${c.mobile ? 'Where we work' : 'Where to find us'}</h3><p class="big">${esc(c.address || c.area)}</p>${c.mobile ? '<p class="muted">We come to your home or office.</p>' : ''}${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>`
    : '';
  const hoursCard = c.hours.rows.length ? `<div class="card" data-spot data-rv style="--d:1"><h3>${icon('clock')}Hours</h3>${P.hours(c.hours.rows)}</div>` : '';
  const info = areaCard || hoursCard
    ? `<section class="sec info-sec" id="area" aria-labelledby="area-title"><div class="wrap"><div data-rv>${head({ eyebrow: 'Area and hours', title: c.mobile ? 'Where and when' : 'Visit or call', id: 'area-title' })}</div><div class="info">${areaCard}${hoursCard}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div data-rv>${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}</div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const formTitle = c.primary.kind === 'form' ? 'Get a quote' : 'Or send a message';
  const who = c.owner && c.owner !== c.name ? c.owner : 'we';
  const formLead = c.primary.kind === 'form' ? `Tell us what you need${c.mobile ? ' and where' : ''}, and ${who} will get back to you with a price.` : `Not sure which service fits? Ask here and ${who} will get back to you.`;
  const fields = [
    'name',
    { ...P.FIELD_PRESETS.phone, required: true },
    { ...P.FIELD_PRESETS.email, required: false },
    c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: [...c.services.map((s) => s.name), 'Something else'], half: true } : null,
    c.mobile ? { ...P.FIELD_PRESETS.address, half: true } : null,
    { ...P.FIELD_PRESETS.message, label: 'Tell us about the job' },
  ].filter(Boolean);
  const quote = `<section class="sec quote" id="quote" aria-labelledby="quote-title">
<div class="quote-glow" aria-hidden="true"></div>
<div class="wrap quote-grid">
<div class="quote-copy">
<p class="eyebrow" data-rv>Contact</p>
<h2 class="h2" id="quote-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="promise" data-rv style="--d:4">${icon('shield', { size: 20 })}<span><strong>${c.owner && c.owner !== c.name ? 'My promise' : 'Our promise'}:</strong> ${esc(c.promise)}</span></p>` : ''}
${c.primary.kind !== 'form' ? `<div class="ctas" data-rv style="--d:5">${P.button(c.primary, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}</div>` : ''}
<div data-rv style="--d:5">${P.contactList(c, { cls: 'quote-contact' })}</div>
</div>
<div class="form-card" data-rv="scale" style="--d:2">
<h3 class="form-title">${esc(formTitle)}</h3>
<p class="form-lead">${esc(formLead)}</p>
${P.form(c, { id: 'quote', fields, submit: c.primary.kind === 'form' ? 'Send my request' : 'Send message', subject: `Quote request for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-bc' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, marquee, services, how, about, reviews, info, faq, quote, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar' };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2,h3{font-weight:800}
.h2{font-size:clamp(2.2rem,1.4rem + 3vw,4rem);letter-spacing:-.045em;font-stretch:112%}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--dark) 72%,transparent);color:var(--on-dark);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid transparent;transition:border-color .3s ease,background-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line-on-dark)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem;transition:min-height .35s ease}
.hdr.scrolled .hdr-in{min-height:4rem}
.brand{display:flex;align-items:center;gap:.7rem;margin-right:auto;font-family:var(--font-display);font-size:1.15rem;font-weight:800;line-height:1.1;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;flex:none;width:2.4rem;height:2.4rem;border-radius:.8rem;background:var(--primary);color:var(--on-primary);font-size:.92rem;letter-spacing:0}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.55rem .85rem;border-radius:999px;font-size:.95rem;font-weight:500;color:var(--muted-on-dark);text-decoration:none;transition:color .2s ease,background-color .2s ease}
.nav a:hover{color:var(--on-dark);background:var(--line-on-dark)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.25rem}
.menu>summary{background:transparent;color:var(--on-dark);border-color:var(--line-on-dark)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;margin-top:-4.75rem;padding-top:calc(4.75rem + clamp(2.5rem,1.5rem + 4vw,6rem));padding-bottom:clamp(3rem,2rem + 4vw,6rem);background:var(--dark);color:var(--on-dark)}
.hero-glow{position:absolute;left:50%;top:-30%;width:min(80rem,140vw);aspect-ratio:1;transform:translateX(-50%);background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 38%,transparent),transparent 70%);opacity:.55;pointer-events:none}
.hero-in{position:relative;display:grid;justify-items:start}
.chip{display:inline-flex;flex-wrap:wrap;align-items:center;gap:.55rem;padding:.45rem .95rem .45rem .75rem;border-radius:999px;border:1px solid var(--line-on-dark);background:color-mix(in srgb,var(--on-dark) 6%,transparent);font-size:.9rem;font-weight:600}
.chip .dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--primary-on-dark);box-shadow:0 0 0 0 var(--primary-on-dark);animation:bcPing 2.4s ease-out infinite}
.chip .sep{width:.3rem;height:.3rem;border-radius:50%;background:var(--muted-on-dark)}
@keyframes bcPing{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--primary-on-dark) 70%,transparent)}80%,100%{box-shadow:0 0 0 .7rem transparent}}
.hero h1{margin-top:1.4rem;max-width:16ch;font-size:clamp(3rem,1.4rem + 7vw,7.6rem);line-height:.92;letter-spacing:-.055em;font-stretch:118%}
.hero h1.long{max-width:20ch;font-size:clamp(2.6rem,1.3rem + 5vw,5.6rem)}
.hero-row{display:grid;gap:1.75rem;width:100%;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem);align-items:end}
@media (min-width:60rem){.hero-row{grid-template-columns:minmax(0,34rem) auto;justify-content:space-between}}
.hero .lead{color:var(--muted-on-dark)}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero .btn-ghost{color:var(--on-dark);border-color:var(--line-on-dark)}
.hero .btn-ghost:hover{background:var(--line-on-dark);border-color:var(--line-on-dark);color:var(--on-dark)}
.ticks{display:flex;flex-wrap:wrap;gap:.65rem 1.5rem;margin-top:1.75rem;font-size:.95rem;font-weight:500;color:var(--muted-on-dark)}
.ticks li{display:flex;align-items:center;gap:.45rem}
.ticks .i{color:var(--primary-on-dark)}
.hero-media{position:relative;margin-top:clamp(2.5rem,1.5rem + 4vw,5rem)}
.hero-frame{overflow:hidden;border-radius:clamp(20px,1rem + 1vw,36px);aspect-ratio:16/9}
@media (max-width:47.99rem){.hero-frame{aspect-ratio:4/3}}
.hero-img{width:100%;height:118%;margin-top:-9%;object-fit:cover}
.price-card{position:absolute;right:clamp(1rem,2vw,2.5rem);bottom:clamp(1rem,2vw,2.5rem);display:grid;gap:.1rem;min-width:11rem;padding:1rem 1.35rem;border-radius:20px;background:var(--bg);color:var(--ink);box-shadow:0 30px 60px -24px rgba(0,0,0,.55)}
.price-card small{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.price-card strong{font-family:var(--font-display);font-size:2.2rem;font-weight:800;line-height:1.05;letter-spacing:-.04em;color:var(--primary-deep)}
.price-card span{font-size:.95rem;color:var(--muted)}
.band{padding-block:1.3rem;background:var(--primary);color:var(--on-primary);--mq-speed:42s}
.band-row{display:flex;flex:none}
.band-row li{display:flex;align-items:center;gap:1.6rem;padding-right:1.6rem;font-family:var(--font-display);font-size:clamp(1.4rem,1.1rem + 1.2vw,2.2rem);font-weight:800;letter-spacing:-.03em;white-space:nowrap;font-stretch:115%}
.band .star{display:inline-grid;opacity:.75}
.services{padding-top:clamp(4rem,3rem + 4vw,7rem)}
.svc-grid{display:grid;gap:1rem}
@media (min-width:40rem){.svc-grid{grid-template-columns:repeat(2,1fr)}}
@media (min-width:64rem){.svc-grid{grid-template-columns:repeat(3,1fr)}.svc-grid.two{grid-template-columns:repeat(2,1fr)}}
.svc{--spot:var(--primary-soft);display:flex;flex-direction:column;gap:.7rem;padding:1.8rem;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s ease,border-color .35s ease}
html.m .svc[data-rv].in:hover,.svc:hover{transform:translateY(-4px);border-color:var(--primary-tint);box-shadow:0 26px 50px -30px rgba(0,0,0,.4)}
.svc-n{font-family:var(--font-display);font-size:.85rem;font-weight:800;letter-spacing:.08em;color:var(--primary-text)}
.svc h3{font-size:1.35rem;letter-spacing:-.02em}
.svc-price{font-family:var(--font-display);font-size:2.6rem;font-weight:800;line-height:1;letter-spacing:-.045em;color:var(--primary-deep);font-stretch:110%}
.svc-blurb{color:var(--muted)}
.svc-meta{display:flex;align-items:center;gap:.4rem;margin-top:auto;font-size:.9rem;color:var(--muted)}
.svc-foot{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:2rem}
.svc-foot a:not(.btn){font-weight:600;color:var(--ink)}
.incl-box{margin-top:2rem;padding:clamp(1.25rem,1rem + 1vw,2rem);border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
.incl-box h3{margin-bottom:1rem;font-size:1.15rem}
.incl{display:grid;gap:.7rem}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;gap:.7rem 2rem}}
.incl li{display:flex;gap:.6rem;align-items:flex-start}
.incl .i{flex:none;margin-top:.25rem;color:var(--primary-text)}
.how{background:var(--dark);color:var(--on-dark)}
.how .eyebrow{color:var(--primary-on-dark)}
.steps{position:relative;display:grid;gap:2.5rem}
@media (min-width:48rem){.steps{grid-template-columns:repeat(var(--n,3),1fr);gap:2rem}.steps::before{content:'';position:absolute;left:0;right:0;top:1.75rem;height:1px;background:var(--line-on-dark)}.steps::after{content:'';position:absolute;left:0;right:0;top:1.75rem;height:1px;background:var(--primary-on-dark);transform-origin:0 50%;transform:scaleX(0);transition:transform 1.6s cubic-bezier(.7,0,.2,1) .2s}html:not(.m) .steps::after,.steps.in::after{transform:scaleX(1)}}
.step{position:relative}
html.m .steps .step{opacity:0;transform:translateY(20px);transition:opacity .8s ease,transform 1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--d,0) * 160ms + .2s)}
html.m .steps.in .step{opacity:1;transform:none}
.step-n{position:relative;z-index:1;display:inline-grid;place-items:center;width:3.5rem;height:3.5rem;border-radius:50%;background:var(--dark);border:1px solid var(--line-on-dark);font-family:var(--font-display);font-size:1.3rem;font-weight:800;color:var(--primary-on-dark)}
.step h3{margin-top:1.4rem;font-size:1.4rem;letter-spacing:-.02em}
.step p{margin-top:.55rem;color:var(--muted-on-dark)}
.about-grid{display:grid;gap:clamp(2rem,1rem + 3vw,5rem);align-items:center}
@media (min-width:56rem){.about-grid{grid-template-columns:.9fr 1.1fr}}
.about-media{overflow:hidden;border-radius:30px;aspect-ratio:5/6}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-copy p:not(.eyebrow){font-size:1.15rem;line-height:1.65;max-width:36rem}
.about-social{margin-top:.5rem}
.info-sec{background:var(--surface)}
.info{display:grid;gap:1rem}
@media (min-width:48rem){.info{grid-template-columns:repeat(2,1fr)}}
.card{--spot:var(--primary-soft);display:grid;align-content:start;gap:.75rem;padding:1.9rem;border-radius:var(--radius);background:var(--bg);border:1px solid var(--line)}
.card h3{display:flex;align-items:center;gap:.6rem;font-size:1.15rem}
.card h3 .i{color:var(--primary-text)}
.card .big{font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1.4vw,2.4rem);font-weight:800;line-height:1.08;letter-spacing:-.035em}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;font-weight:600;color:var(--primary-text);text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.quote{position:relative;overflow:hidden;background:var(--dark);color:var(--on-dark)}
.quote-glow{position:absolute;right:-20%;bottom:-40%;width:60rem;aspect-ratio:1;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 30%,transparent),transparent 70%);opacity:.5;pointer-events:none}
.quote .eyebrow{color:var(--primary-on-dark)}
.quote .lead{color:var(--muted-on-dark);margin-top:1rem}
.quote-grid{position:relative;display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.quote-grid{grid-template-columns:.85fr 1.15fr;gap:4rem}}
.quote-copy{display:grid;gap:.4rem;align-content:start}
.promise{display:flex;gap:.7rem;align-items:flex-start;margin-top:1.25rem;padding:1rem 1.2rem;border-radius:18px;border:1px solid var(--line-on-dark);font-size:1.05rem;line-height:1.5}
.promise .i{flex:none;margin-top:.15rem;color:var(--primary-on-dark)}
.promise strong{color:var(--on-dark)}
.quote-contact{margin-top:1.75rem}
.quote-contact .i{color:var(--primary-on-dark)}
.quote-contact a{color:var(--on-dark)}
.form-card{padding:clamp(1.3rem,1rem + 1.6vw,2.4rem);border-radius:28px;background:var(--bg);color:var(--ink);box-shadow:0 40px 90px -40px rgba(0,0,0,.7)}
.form-title{font-size:1.6rem;letter-spacing:-.02em}
.form-lead{margin:.4rem 0 1.5rem;color:var(--muted)}
.quote .ctas{margin-top:1.75rem}
`;

module.exports = {
  id,
  kind: 'local-service',
  name: 'Beacon',
  bestFor: 'Detailers, cleaners, lawn care, movers and other jobs people call or book, with motion',
  why: 'Built for jobs people call or book, with motion: the headline rises in, your services run across the page, and prices, area and the quote form stay up front.',
  fonts: { q: 'family=Archivo:wdth,wght@100..125,500..900&family=Inter:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Inter', 'sans'] },
  slots,
  nav,
  render,
};
