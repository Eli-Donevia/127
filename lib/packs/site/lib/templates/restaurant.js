// Food and drink: restaurants, cafes, bakeries, food trucks, bars and caterers. Warm and appetizing:
// a dark photo hero with the name, hours and address up top, the full menu with prices, order and
// reservation buttons, and directions.

const { color } = require('../../../_kit');
const P = require('../parts');
const { icon } = require('../icons');
const { head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('./shared');

const id = 'restaurant';

function tokens(p) {
  return { bg: color.mix(p.paper, '#fbf6ee', 0.7), dark: color.mix(color.mix(p.ink, p.primary, 0.18), '#0b0806', 0.45) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const hero = c.profile.hero || `Food at ${c.name}`;
  const dishes = (c.menu || []).flatMap((sec) => sec.items).map((i) => i.name);
  const pool = [...new Set([...dishes, ...g, `A dish at ${c.name}`, `${c.name}, up close`, `Food at ${c.name}`])].filter((x) => x && x !== hero);
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1920, h: 1200, style: 'plates', alt: hero },
    { slot: 'd1', file: 'dish-1.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[0] },
    { slot: 'd2', file: 'dish-2.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[1] },
    { slot: 'd3', file: 'dish-3.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[2] },
  ];
}

function sections(c) {
  if (c.menu && c.menu.length) return c.menu;
  if (c.services.length) return [{ title: 'Menu', items: c.services.map((s) => ({ ...s, tags: [] })) }];
  return [];
}

function nav(c) {
  return [
    sections(c).length && { label: 'Menu', href: '#menu' },
    c.orderLinks.length > 1 && { label: 'Order', href: '#order' },
    { label: 'About', href: '#about' },
    { label: 'Visit', href: '#visit' },
  ].filter(Boolean);
}

const TAG_NAMES = { V: 'Vegetarian', VG: 'Vegan', GF: 'Gluten free', DF: 'Dairy free', SPICY: 'Spicy' };

function menuHtml(c) {
  const secs = sections(c);
  return secs
    .map(
      (sec) => `<div class="mgroup">
<h3 class="mgroup-title">${esc(sec.title)}</h3>
<ul class="mitems">
${sec.items
  .map(
    (it) => `<li class="mitem">
<div class="mitem-top"><h4>${esc(it.name)}${(it.tags || []).map((t) => ` <abbr class="tag" title="${esc(TAG_NAMES[t] || t)}">${esc(t)}</abbr>`).join('')}</h4>
${it.priceText ? `<span class="mprice">${esc(it.priceText)}</span>` : ''}</div>
${it.blurb || it.description ? `<p class="mdesc">${esc(it.blurb || it.description)}</p>` : ''}
</li>`
  )
  .join('\n')}
</ul>
</div>`
    )
    .join('\n');
}

function render(c) {
  const secs = sections(c);
  const short = c.address ? c.address.split(',')[0] : c.area;
  const hero = `<section class="hero" aria-labelledby="hero-title">
${P.img(c, 'hero', { cls: 'hero-bg', eager: true })}
<div class="hero-shade" aria-hidden="true"></div>
<div class="wrap hero-in">
${c.whatShort ? `<p class="eyebrow">${esc([c.whatShort, c.city].filter(Boolean).join(' in '))}</p>` : ''}
<h1 id="hero-title">${esc(c.heroTitle)}</h1>
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas">
${P.button(c.primary, 'btn btn-primary btn-lg', c.primary && c.primary.kind === 'phone' ? 'phone' : c.primary && c.primary.kind === 'maps' ? 'pin' : 'bag')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
</div>
</section>`;

  const strip = `<section class="strip" aria-label="Hours and location">
<div class="wrap strip-in">
${c.hours.rows.length ? `<div class="si"><h2>${icon('clock', { size: 18 })}Hours</h2>${P.hours(c.hours.rows)}</div>` : ''}
${c.address || c.area ? `<div class="si"><h2>${icon('pin', { size: 18 })}Find us</h2><p class="si-big">${esc(short || '')}</p>${c.address && c.address !== short ? `<p class="muted">${esc(c.address.split(',').slice(1).join(',').trim())}</p>` : ''}${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Get directions${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>` : ''}
${c.phone || c.orderLinks.length ? `<div class="si"><h2>${icon(c.orderLinks.length ? 'bag' : 'phone', { size: 18 })}${c.orderLinks.length ? 'Order' : 'Call'}</h2>${c.orderLinks.slice(0, 3).map((l) => `<p><a class="arrow-link" href="${esc(l.href)}">${esc(l.label)}${icon('arrowUpRight', { size: 16 })}</a></p>`).join('')}${c.phone ? `<p class="si-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}</div>` : ''}
</div>
</section>`;

  const menu = secs.length
    ? `<section class="sec menu-sec" id="menu" aria-labelledby="menu-title">
<div class="wrap">
${head({ eyebrow: 'Menu', title: 'The menu', lead: secs.some((s) => s.items.some((i) => (i.tags || []).length)) ? 'V vegetarian, VG vegan, GF gluten free.' : '', id: 'menu-title' })}
<div class="mgrid${secs.length > 1 ? ' cols' : ''}">
${menuHtml(c)}
</div>
</div>
</section>`
    : '';

  const order = c.orderLinks.length > 1 || (c.orderLinks.length && c.reserve)
    ? `<section class="sec order" id="order" aria-labelledby="order-title"><div class="wrap order-in">
<h2 class="h2" id="order-title">Order your way</h2>
<div class="order-btns">${c.orderLinks.map((l) => `<a class="btn btn-primary btn-lg" href="${esc(l.href)}">${icon('bag', { size: 18 })}${esc(l.label)}</a>`).join('')}${c.reserve ? `<a class="btn btn-ghost btn-lg" href="${esc(c.booking.href)}">${icon('calendar', { size: 18 })}${esc(c.booking.label)}</a>` : ''}</div>
</div></section>`
    : '';

  const photos = `<section class="photos" aria-label="Photos"><div class="wrap photo-row">
${['d1', 'd2', 'd3'].map((k) => `<figure>${P.img(c, k)}</figure>`).join('\n')}
</div></section>`;

  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-in">
<p class="eyebrow">Our story</p>
<h2 class="h2" id="about-title">${esc(c.tagline || `About ${c.name}`)}</h2>
${c.aboutParas.map((p) => `<p class="about-p">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig">${esc(c.owner)}</p>` : ''}
</div></section>`;

  const reviews = c.reviews.length ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap">${head({ eyebrow: 'Kind words', title: 'From our guests', id: 'reviews-title' })}${P.reviews(c)}</div></section>` : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap narrow">${head({ eyebrow: 'Good to know', title: 'Questions', id: 'faq-title' })}${P.faq(c.faq)}</div></section>` : '';

  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title"><div class="wrap visit-in">
<h2 class="visit-title" id="visit-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas center">${P.button(c.primary, 'btn btn-primary btn-lg')}${c.mapsUrl && c.primary.kind !== 'maps' ? `<a class="btn btn-ghost btn-lg" href="${esc(c.mapsUrl)}">${icon('pin', { size: 18 })}Directions</a>` : ''}</div>
${P.contactList(c, { cls: 'visit-list' })}
</div></section>`;

  const contact = c.email || c.formMode !== 'email'
    ? `<section class="sec contact" id="contact" aria-labelledby="contact-title"><div class="wrap narrow">
${head({ eyebrow: 'Contact', title: /cater|truck|bakery|cake/i.test(`${c.what} ${c.profile.id}`) ? 'Catering, events and big orders' : 'Questions and big orders', lead: 'Send a few details and we will get back to you.', id: 'contact-title' })}
<div class="form-card">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.date }, { ...P.FIELD_PRESETS.guests }, 'message'], submit: 'Send', subject: `Message for ${c.name}` })}</div>
</div></section>`
    : '';

  const body = [P.header(c, { cls: 'hdr-rs', mark: false }), '<main id="main">', hero, strip, menu, order, photos, about, reviews, faq, visit, contact, '</main>', P.footer(c), P.mobileBar(c)].join('\n');
  return { body, css: CSS, bodyClass: 'has-bar', base: { radius: '18px', btnRadius: '999px' } };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
.h2{font-size:clamp(2.2rem,1.5rem + 3vw,3.6rem)}
.narrow{max-width:48rem}
.hdr{position:relative;z-index:30;background:var(--dark);color:var(--on-dark)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;line-height:1;text-decoration:none;color:var(--on-dark)}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.5rem .85rem;border-radius:999px;font-weight:500;text-decoration:none;color:var(--muted-on-dark)}
.nav a:hover{color:var(--on-dark);background:rgba(255,255,255,.08)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.2rem}
.menu>summary{background:transparent;color:var(--on-dark);border-color:var(--line-on-dark)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;isolation:isolate;display:flex;align-items:flex-end;min-height:min(88vh,52rem);padding-block:7rem clamp(3rem,2rem + 4vw,6rem);color:#fff;background:var(--dark)}
.hero-bg{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover}
.hero-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,.6) 40%,rgba(0,0,0,.88) 100%)}
@media (min-width:60rem){.hero-shade{background:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 45%,rgba(0,0,0,.1) 100%)}}
.hero .eyebrow{color:#fff;opacity:.85}
.hero h1{margin-top:.9rem;max-width:16ch;font-size:clamp(3.2rem,2rem + 6vw,7.5rem);line-height:.95;letter-spacing:-.02em;color:#fff}
.hero .lead{margin-top:1.25rem;max-width:36rem;color:rgba(255,255,255,.88)}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}
.ctas.center{justify-content:center}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero .btn-ghost{color:#fff;border-color:rgba(255,255,255,.7)}
.hero .btn-ghost:hover{background:rgba(255,255,255,.12);color:#fff;border-color:#fff}
.strip{background:var(--surface);border-bottom:1px solid var(--line)}
.strip-in{display:grid;gap:2rem;padding-block:2.5rem}
@media (min-width:56rem){.strip-in{grid-template-columns:repeat(3,1fr);gap:3rem}}
.si h2{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;font-family:var(--font-body);font-size:.8rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--primary-deep)}
.si-big{font-family:var(--font-display);font-size:1.6rem;line-height:1.2}
.si-big a{text-decoration:none}
.si p+p{margin-top:.35rem}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;font-weight:600;color:var(--primary-deep);text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.mgrid{display:grid;gap:3rem 4.5rem}
@media (min-width:60rem){.mgrid.cols{grid-template-columns:1fr 1fr}}
.mgroup-title{padding-bottom:.75rem;margin-bottom:.5rem;border-bottom:2px solid var(--ink);font-size:2rem}
.mitem{padding:1rem 0;border-bottom:1px solid var(--line)}
.mitem-top{display:flex;align-items:baseline;justify-content:space-between;gap:1rem}
.mitem h4{margin:0;font-family:var(--font-body);font-size:1.1rem;font-weight:600;letter-spacing:0}
.mprice{font-family:var(--font-display);font-size:1.35rem;white-space:nowrap;color:var(--primary-deep)}
.mdesc{margin-top:.3rem;color:var(--muted);max-width:34rem}
.tag{margin-left:.25rem;padding:.1rem .4rem;border-radius:.35rem;border:1px solid var(--line);font-size:.7rem;font-weight:700;letter-spacing:.06em;text-decoration:none;color:var(--muted);vertical-align:.15em}
.order{background:var(--primary-soft)}
.order-in{display:grid;gap:1.5rem;justify-items:center;text-align:center}
.order-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem}
.photo-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;padding-block:1rem}
.photo-row figure{margin:0;overflow:hidden;border-radius:var(--radius)}
.photo-row img{width:100%;aspect-ratio:1;object-fit:cover}
@media (max-width:39.99rem){.photo-row{grid-template-columns:1fr 1fr}.photo-row figure:first-child{grid-column:span 2}.photo-row figure:first-child img{aspect-ratio:16/10}}
.about-in{max-width:52rem;display:grid;gap:1.2rem;justify-items:start}
.about-p{font-size:1.2rem;line-height:1.65;color:var(--muted)}
.sig{font-family:var(--font-display);font-size:1.8rem;font-style:italic;color:var(--primary-deep)}
.visit{background:var(--dark);color:var(--on-dark);text-align:center}
.visit-in{display:grid;justify-items:center;gap:1rem}
.visit-title{font-size:clamp(3rem,2rem + 5vw,6rem);line-height:1;color:var(--on-dark)}
.visit .lead{color:var(--muted-on-dark)}
.visit .btn-ghost{color:var(--on-dark);border-color:var(--line-on-dark)}
.visit-list{margin-top:2rem;text-align:left}
.visit-list .i{color:var(--primary-on-dark)}
.visit-list a{color:var(--on-dark)}
.contact .form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
`;

module.exports = {
  id,
  name: 'Food and drink',
  bestFor: 'Restaurants, cafes, bakeries, food trucks, bars and caterers',
  tokens,
  slots,
  nav,
  render,
};
