// Studio: for appointment businesses (salons, barbers, nails, lashes, spas, trainers, tattoo).
// Editorial and warm: a serif headline, an arched photo, an elegant price menu with times, a photo
// grid and one clear Book button.

const { color } = require('../../../_kit');
const P = require('../parts');
const { icon } = require('../icons');
const { head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('./shared');

const id = 'studio';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f7f0e6', 0.75), dark: color.mix(color.mix(p.ink, p.primary, 0.25), '#000000', 0.35) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const alt = (i, d) => g[i] || d;
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1100, h: 1400, style: 'arch', alt: c.profile.hero || `Inside ${c.name}` },
    { slot: 'g1', file: 'photo-1.jpg', w: 900, h: 1200, style: 'portrait', alt: alt(0, `${c.name}, finished work`) },
    { slot: 'g2', file: 'photo-2.jpg', w: 900, h: 900, style: 'mesh', alt: alt(1, `${c.name}, up close`) },
    { slot: 'g3', file: 'photo-3.jpg', w: 900, h: 900, style: 'arch', alt: alt(2, `Inside ${c.name}`) },
    { slot: 'g4', file: 'photo-4.jpg', w: 900, h: 1200, style: 'sweep', alt: alt(3, `${c.name}, details`) },
  ];
}

function nav(c) {
  return [
    c.services.length && { label: 'Menu', href: '#menu' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'About', href: '#about' },
    { label: 'Visit', href: '#visit' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

// "Nails you keep looking at." -> "Nails you keep <em>looking at.</em>"
function emphasize(title) {
  const words = String(title).split(/\s+/);
  if (words.length < 3) return esc(title);
  const n = words.length > 5 ? 2 : 1;
  return `${esc(words.slice(0, -n).join(' '))} <em>${esc(words.slice(-n).join(' '))}</em>`;
}

function menuHtml(c) {
  const groups = [];
  for (const s of c.services) {
    const title = s.category || '';
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    g.items.push(s);
  }
  return `<div class="mn${groups.length > 1 ? ' cols' : ''}">
${groups
  .map(
    (g) => `<div class="mn-group">
${g.title ? `<h3 class="mn-cat">${esc(g.title)}</h3>` : ''}
<ul>
${g.items
  .map(
    (s) => `<li><div class="mn-top"><h4>${esc(s.name)}</h4><span class="dots" aria-hidden="true"></span>${s.priceText ? `<span class="mn-price">${esc(s.priceText)}</span>` : ''}</div>
${s.duration || s.blurb ? `<p class="mn-meta">${[s.duration, s.blurb].filter(Boolean).map(esc).join('<span aria-hidden="true"> / </span>')}</p>` : ''}</li>`
  )
  .join('\n')}
</ul>
</div>`
  )
  .join('\n')}
</div>`;
}

function render(c) {
  const eyebrow = [c.whatShort, c.city].filter(Boolean).join(' in ');
  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
<h1 id="hero-title">${emphasize(c.heroTitle)}</h1>
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas">
${P.button(c.primary, 'btn btn-primary btn-lg', 'calendar')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
${c.hoursLine ? `<p class="hero-note">${icon('clock', { size: 16 })}${esc(c.hoursLine)}</p>` : ''}
</div>
<div class="hero-media">
${P.img(c, 'hero', { cls: 'hero-img', eager: true })}
<span class="hero-seal" aria-hidden="true">${esc(P.monogram(c.name))}</span>
</div>
</div>
</section>`;

  const menu = c.services.length
    ? `<section class="sec menu-sec" id="menu" aria-labelledby="menu-title">
<div class="wrap">
${head({ eyebrow: 'Menu', title: 'Services and prices', lead: c.services.some((s) => s.duration) ? 'Times are a guide, so you can plan your day.' : '', id: 'menu-title', cls: 'center' })}
${menuHtml(c)}
<div class="center-cta">${P.button(c.primary, 'btn btn-primary btn-lg', 'calendar')}</div>
</div>
</section>`
    : '';

  const gallery = `<section class="sec gallery-sec" id="gallery" aria-labelledby="gallery-title">
<div class="wrap">
${head({ eyebrow: 'Gallery', title: 'A look inside', id: 'gallery-title' })}
<div class="gallery">
${['g1', 'g2', 'g3', 'g4'].map((k, i) => `<figure class="ph ph-${i + 1}">${P.img(c, k)}</figure>`).join('\n')}
</div>
${c.socials.instagram ? `<p class="gallery-more"><a href="${esc(c.socials.instagram)}">${icon('instagram', { size: 18 })}More on Instagram</a></p>` : ''}
</div>
</section>`;

  // First sentence large, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = c.aboutParas;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const firstPara = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-in">
<p class="eyebrow">About</p>
<h2 class="sr-only" id="about-title">About ${esc(c.name)}</h2>
<p class="about-big">${esc(firstPara || '')}</p>
${rest.map((p) => `<p class="about-more">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig">${esc(c.owner)}</p>` : ''}
</div>
</section>`;

  const reviews = c.reviews.length ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap">${head({ eyebrow: 'Kind words', title: 'From our clients', id: 'reviews-title' })}${P.reviews(c)}</div></section>` : '';

  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title">
<div class="wrap visit-grid">
<div>
<p class="eyebrow">Visit</p>
<h2 class="h2" id="visit-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas">${P.button(c.primary, 'btn btn-primary btn-lg', 'calendar')}</div>
</div>
<div class="visit-info">
${c.address ? `<div class="vi"><h3>${icon('pin', { size: 18 })}Address</h3><p>${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)}</p></div>` : c.area && !c.online ? `<div class="vi"><h3>${icon('pin', { size: 18 })}Area</h3><p>${esc(c.area)}</p></div>` : ''}
${c.hours.rows.length ? `<div class="vi"><h3>${icon('clock', { size: 18 })}Hours</h3>${P.hours(c.hours.rows, 'on-dark')}</div>` : ''}
${c.phone || c.email ? `<div class="vi"><h3>${icon('phone', { size: 18 })}Contact</h3>${c.phone ? `<p><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
</div>
</div>
</section>`;

  const faq = c.faq.length ? `<section class="sec" id="faq" aria-labelledby="faq-title"><div class="wrap narrow">${head({ eyebrow: 'Questions', title: 'Before you book', id: 'faq-title', cls: 'center' })}${P.faq(c.faq)}</div></section>` : '';

  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap narrow">
${head({ eyebrow: 'Contact', title: c.booking ? 'Have a question first?' : 'Request a time', lead: c.booking ? 'Send a note and we will get back to you.' : 'Tell us what you would like and when, and we will confirm your time.', id: 'contact-title', cls: 'center' })}
<div class="form-card">
${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: c.services.map((s) => s.name), half: true } : null, c.booking ? null : { ...P.FIELD_PRESETS.when }, 'message'].filter(Boolean), submit: c.booking ? 'Send' : 'Request my time', subject: `Message for ${c.name}` })}
</div>
</div>
</section>`;

  const body = [P.header(c, { cls: 'hdr-st', mark: false }), '<main id="main">', hero, menu, gallery, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].join('\n');
  return { body, css: CSS, bodyClass: 'has-bar', base: { radius: '22px', btnRadius: '999px' } };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.015em}
h1 em,h2 em{font-style:italic;color:var(--primary-deep)}
.h2{font-size:clamp(2.2rem,1.5rem + 3vw,3.8rem)}
.eyebrow{color:var(--primary-deep)}
.narrow{max-width:46rem}
.hdr{position:relative;z-index:30}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.5rem;line-height:1.05;letter-spacing:-.01em;text-decoration:none}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.5rem .85rem;font-size:.95rem;font-weight:500;text-decoration:none;color:var(--muted);border-radius:999px}
.nav a:hover{color:var(--ink);background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.25rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(1.5rem,1rem + 3vw,4.5rem) clamp(3.5rem,2rem + 5vw,7rem)}
.hero-grid{display:grid;gap:clamp(2.5rem,1rem + 4vw,5rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:1.1fr .9fr}}
.hero h1{margin-top:1.2rem;font-size:clamp(3rem,1.9rem + 5vw,6.2rem);line-height:1;letter-spacing:-.03em}
.hero .lead{margin-top:1.5rem;max-width:32rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-note{display:flex;align-items:center;gap:.5rem;margin-top:1.75rem;font-size:.95rem;color:var(--muted)}
.hero-media{position:relative;justify-self:center;width:min(100%,30rem)}
.hero-img{width:100%;aspect-ratio:11/14;object-fit:cover;border-radius:999px 999px 28px 28px}
.hero-seal{position:absolute;left:-1rem;bottom:2.5rem;display:grid;place-items:center;width:6.5rem;height:6.5rem;border-radius:50%;background:var(--primary);color:var(--on-primary);font-family:var(--font-display);font-size:2rem;font-style:italic;box-shadow:0 20px 40px -18px rgba(0,0,0,.4);border:6px solid var(--bg)}
@media (max-width:39.99rem){.hero-seal{width:5rem;height:5rem;font-size:1.5rem;left:.25rem}}
.menu-sec{background:var(--surface)}
.mn{display:grid;gap:2.5rem 4rem;max-width:62rem;margin-inline:auto}
@media (min-width:56rem){.mn.cols{grid-template-columns:1fr 1fr}}
.mn-cat{margin-bottom:.5rem;font-size:1.65rem;font-style:italic;color:var(--primary-deep)}
.mn li{padding:1.05rem 0;border-bottom:1px solid var(--line)}
.mn-top{display:flex;align-items:baseline;gap:.75rem}
.mn-top h4{margin:0;font-family:var(--font-body);font-size:1.08rem;font-weight:600;letter-spacing:0}
.dots{flex:1;min-width:1.5rem;border-bottom:1.5px dotted var(--muted);opacity:.45;transform:translateY(-.3rem)}
.mn-price{font-family:var(--font-display);font-size:1.35rem;white-space:nowrap}
.mn-meta{margin-top:.25rem;font-size:.95rem;color:var(--muted)}
.center-cta{display:flex;justify-content:center;margin-top:3rem}
.gallery{display:grid;gap:1rem;grid-template-columns:1fr 1fr;grid-auto-rows:10.5rem}
.gallery .ph{margin:0;overflow:hidden;border-radius:var(--radius);height:100%}
.gallery img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.gallery .ph:hover img{transform:scale(1.03)}
.ph-1{grid-row:span 2}
.ph-4{grid-column:span 2;grid-row:span 1}
@media (min-width:56rem){.gallery{grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:17rem 17rem;grid-auto-rows:auto}.ph-1{grid-row:1 / 3}.ph-4{grid-column:2 / 4}}
.gallery-more{margin-top:1.5rem}
.gallery-more a{display:inline-flex;align-items:center;gap:.5rem;font-weight:600;text-decoration:none}
.gallery-more a:hover{text-decoration:underline}
.about-in{max-width:58rem;display:grid;gap:1.4rem}
.about-big{font-family:var(--font-display);font-size:clamp(1.7rem,1.25rem + 2vw,2.9rem);line-height:1.22;letter-spacing:-.015em}
.about-more{font-size:1.15rem;color:var(--muted);max-width:40rem}
.sig{font-family:var(--font-display);font-style:italic;font-size:1.8rem;color:var(--primary-deep)}
.visit{background:var(--dark);color:var(--on-dark)}
.visit .eyebrow{color:var(--primary-on-dark)}
.visit .lead{margin-top:1rem;color:var(--muted-on-dark)}
.visit-grid{display:grid;gap:3rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:1fr 1fr;gap:5rem;align-items:start}}
.visit-info{display:grid;gap:2rem}
.vi h3{display:flex;align-items:center;gap:.55rem;margin-bottom:.6rem;font-family:var(--font-body);font-size:.8rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-on-dark)}
.vi p{font-size:1.2rem}
.vi a{color:var(--on-dark);text-decoration-color:var(--line-on-dark)}
.hours.on-dark div{border-color:var(--line-on-dark)}
.hours.on-dark dd{color:var(--muted-on-dark)}
.contact .form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border-radius:var(--radius);background:var(--bg);border:1px solid var(--line);box-shadow:0 30px 60px -40px rgba(0,0,0,.3)}
.contact{background:var(--surface)}
.ftr{background:var(--bg)}
`;

module.exports = {
  id,
  name: 'Studio',
  bestFor: 'Salons, barbers, nail and lash artists, spas, trainers and tattoo studios',
  tokens,
  slots,
  nav,
  render,
};
