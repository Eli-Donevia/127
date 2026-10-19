// Coach: one person people book one to one (coaches, tutors, teachers, trainers who work online).
// Calm and personal: a serif statement, who it's for, the offer with what's included, how it works,
// the story and a Book a call button.

const { color } = require('../../../_kit');
const P = require('../parts');
const { icon } = require('../icons');
const { head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, cheapest, esc } = require('./shared');

const id = 'coach';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f8f6f1', 0.6) };
}

function slots(c) {
  return [{ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'coach'}` : c.profile.hero || c.name }];
}

function nav(c) {
  return [
    (c.services.length || c.offer) && { label: 'The offer', href: '#offer' },
    c.steps.length && { label: 'How it works', href: '#how' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const meta = [c.online ? (c.area && /online|zoom|virtual|remote/i.test(c.area) ? c.area : 'Online') : c.area, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);
  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
<p class="eyebrow">${esc(c.name)}</p>
<h1 id="hero-title">${esc(c.heroTitle)}</h1>
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas">
${P.button(c.primary, 'btn btn-primary btn-lg', c.booking ? 'calendar' : '')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
${meta.length ? `<ul class="meta">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
<figure class="portrait">
${P.img(c, 'portrait', { cls: 'portrait-img', eager: true })}
${person || c.whatShort ? `<figcaption><strong>${esc(person || c.name)}</strong>${c.whatShort ? `<span>${esc(c.whatShort)}</span>` : ''}</figcaption>` : ''}
</figure>
</div>
</section>`;

  const forWho = c.audience
    ? `<section class="sec forwho" aria-labelledby="forwho-title"><div class="wrap forwho-in">
<p class="eyebrow">Who it's for</p>
<h2 class="statement" id="forwho-title">For ${esc(c.audience.replace(/^for\s+/i, ''))}${c.profile.result ? `, with <em>${esc(c.profile.result)}</em>.` : '.'}</h2>
</div></section>`
    : '';

  const offerName = c.offer || (c.services[0] && c.services[0].name) || c.whatShort;
  const offer = c.services.length || c.offer || c.included.length
    ? `<section class="sec offer" id="offer" aria-labelledby="offer-title"><div class="wrap offer-grid">
<div class="offer-copy">
<p class="eyebrow">The offer</p>
<h2 class="h2" id="offer-title">${esc(offerName)}</h2>
${c.included.length ? `<ul class="incl">${c.included.map((x) => `<li>${icon('check', { size: 20 })}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="offer-card">
${c.services.length ? `<ul class="prices">${c.services.map((s) => `<li><div><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}</div>${s.priceText ? `<span class="pp">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${c.capacity ? `<p class="cap">${icon('user', { size: 18 })}${esc(c.capacity)}</p>` : ''}
${P.button(c.primary, 'btn btn-primary btn-lg btn-block', c.booking ? 'calendar' : '')}
</div>
</div></section>`
    : '';

  const how = c.steps.length
    ? `<section class="sec how" id="how" aria-labelledby="how-title"><div class="wrap">
${head({ eyebrow: 'How it works', title: 'Simple from the first message', id: 'how-title' })}
<ol class="steps">${c.steps.map((s, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol>
</div></section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<div><p class="eyebrow">About</p><h2 class="h2" id="about-title">${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2></div>
<div class="about-copy">${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('\n')}${P.socials(c)}</div>
</div></section>`;

  const reviews = c.reviews.length ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap">${head({ eyebrow: 'Kind words', title: 'What people say', id: 'reviews-title' })}${P.reviews(c)}</div></section>` : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">${head({ eyebrow: 'FAQ', title: 'Questions, answered', id: 'faq-title' })}${P.faq(c.faq)}</div></section>` : '';

  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title"><div class="wrap contact-grid">
<div class="contact-copy">
<p class="eyebrow">Contact</p>
<h2 class="h2" id="contact-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.booking ? `<div class="ctas">${P.button(c.primary, 'btn btn-primary btn-lg', 'calendar')}</div>` : ''}
${P.contactList(c)}
</div>
<div class="form-card">
<h3 class="form-title">${c.booking ? 'Or send a message' : 'Send a message'}</h3>
${P.form(c, { id: 'contact', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What would you like help with?', required: true }], submit: 'Send message', subject: `Message for ${c.name}` })}
</div>
</div></section>`;

  const body = [P.header(c, { cls: 'hdr-co', mark: false }), '<main id="main">', hero, forWho, offer, how, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].join('\n');
  return { body, css: CSS, bodyClass: 'has-bar', base: { radius: '20px', btnRadius: '999px' } };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:0}
.h2{font-size:clamp(2.3rem,1.5rem + 3.2vw,4rem);line-height:1.02}
.hdr{position:relative;z-index:30}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.65rem;line-height:1;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.5rem .8rem;border-radius:999px;font-size:.95rem;font-weight:500;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink);background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.2rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(1.5rem,1rem + 3vw,4rem) clamp(3.5rem,2rem + 5vw,7rem)}
.hero-grid{display:grid;gap:clamp(2.5rem,1rem + 4vw,5rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:1.2fr .8fr}}
.hero h1{margin-top:1rem;font-size:clamp(3rem,1.9rem + 5vw,6.4rem);line-height:.98;letter-spacing:-.025em}
.hero .lead{margin-top:1.4rem;max-width:34rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:2rem}
.meta li{padding:.4rem .85rem;border-radius:999px;border:1px solid var(--line);font-size:.9rem;font-weight:500;color:var(--muted);background:var(--bg)}
.portrait{position:relative;margin:0;justify-self:center;width:min(100%,27rem)}
.portrait-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:220px 220px 24px 24px}
.portrait figcaption{position:absolute;right:-.5rem;bottom:1.75rem;display:grid;gap:.1rem;padding:.9rem 1.2rem;border-radius:16px;background:var(--bg);box-shadow:0 20px 40px -20px rgba(0,0,0,.35)}
.portrait figcaption strong{font-family:var(--font-display);font-size:1.4rem;font-weight:400;line-height:1.1}
.portrait figcaption span{font-size:.9rem;color:var(--muted)}
@media (max-width:39.99rem){.portrait figcaption{right:.75rem}}
.forwho{background:var(--dark);color:var(--on-dark)}
.forwho .eyebrow{color:var(--primary-on-dark)}
.forwho-in{max-width:62rem}
.statement{margin-top:1.25rem;font-size:clamp(2rem,1.3rem + 3vw,3.6rem);line-height:1.12;color:var(--on-dark)}
.statement em{color:var(--primary-on-dark)}
.offer-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.offer-grid{grid-template-columns:1fr 1fr;gap:5rem}}
.incl{display:grid;gap:1rem;margin-top:2rem}
.incl li{display:flex;gap:.75rem;align-items:flex-start;font-size:1.1rem}
.incl .i{flex:none;margin-top:.2rem;padding:.2rem;width:1.6rem;height:1.6rem;border-radius:50%;background:var(--primary-soft);color:var(--primary-deep)}
.offer-card{display:grid;gap:1.5rem;padding:clamp(1.4rem,1rem + 1.6vw,2.4rem);border-radius:28px;background:var(--surface);border:1px solid var(--line)}
.prices{display:grid}
.prices li{display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;padding:1.1rem 0;border-bottom:1px solid var(--line)}
.prices li:first-child{padding-top:0}
.prices h3{font-size:1.1rem}
.prices p{margin-top:.2rem;font-size:.95rem;color:var(--muted)}
.pp{font-family:var(--font-display);font-size:2rem;line-height:1;white-space:nowrap}
.cap{display:flex;align-items:center;gap:.5rem;font-weight:600;color:var(--primary-deep)}
.how{background:var(--surface)}
.steps{display:grid;gap:2rem}
@media (min-width:56rem){.steps{grid-template-columns:repeat(3,1fr);gap:2.5rem}}
.steps li{display:grid;gap:.6rem;padding-top:1.5rem;border-top:1px solid var(--ink)}
.steps .n{font-family:var(--font-display);font-size:3rem;line-height:1;color:var(--primary-deep)}
.steps h3{font-size:1.25rem}
.steps p{color:var(--muted)}
.about-grid{display:grid;gap:1.5rem 4rem}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr}}
.about-copy{display:grid;gap:1.1rem;font-size:1.2rem;line-height:1.65}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.contact{background:var(--primary-soft)}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:1fr 1fr;gap:5rem}}
.contact-copy{display:grid;gap:1rem;justify-items:start}
.contact-copy .contact-list{margin-top:1rem}
.form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border-radius:24px;background:var(--bg);box-shadow:0 30px 60px -40px rgba(0,0,0,.35)}
.form-title{margin-bottom:1.25rem;font-family:var(--font-display);font-size:1.8rem;font-weight:400}
`;

module.exports = {
  id,
  name: 'Coach',
  bestFor: 'Coaches, tutors, teachers and anyone people book one to one',
  tokens,
  slots,
  nav,
  render,
};
