// Portfolio: for people hired for what they make (photographers, UGC creators, video editors,
// designers). The work comes first: a short statement, then a gallery grid of their projects (from
// the "work" lines they give, placeholders until they add files), then what they offer with prices,
// who it was made for (only names they list), about, how it works and a project form.

const { color } = require('../../../_kit');
const P = require('../parts');
const { icon } = require('../icons');
const { head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, cheapest, esc } = require('./shared');

const id = 'portfolio';

// Placeholder art styles for the grid, in order.
const STYLES = ['portrait', 'mesh', 'arch', 'sweep', 'object', 'plates', 'grid', 'tile', 'mesh'];

// The grid has 3 columns on wide screens and 2 on phones. So rows always end full, a few pieces span
// two columns: on wide screens the first (and the last when one is left over), on phones the first
// when the count is odd. Returns { desk: Set, phone: Set } of item indexes.
function spans(n) {
  const desk = new Set();
  if (n % 3 === 2) desk.add(0);
  if (n % 3 === 1 && n > 1) {
    desk.add(0);
    desk.add(n - 1);
  }
  const phone = new Set(n % 2 === 1 ? [0] : []);
  return { desk, phone };
}

function tokens(p) {
  return { bg: color.mix(p.paper, '#f6f5f2', 0.7), dark: color.mix(color.mix(p.ink, p.primary, 0.18), '#000000', 0.45) };
}

// How many frames the grid shows: one per piece of work they listed (3 to 9), else 6 placeholders.
function frameCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(9, Math.max(3, n)) : 6;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const out = [];
  const n = frameCount(c);
  const { desk } = spans(n);
  for (let i = 0; i < n; i++) {
    const [w, h] = desk.has(i) ? [1650, 1000] : [1000, 1250];
    const style = STYLES[i % STYLES.length];
    const piece = (c.work || [])[i];
    const alt = piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work`;
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w, h, style, alt });
  }
  out.push({ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'at work'}` : c.profile.hero || `${c.name} at work` });
  return out;
}

function nav(c) {
  return [
    { label: 'Work', href: '#work' },
    c.services.length && { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

function workHtml(c) {
  const n = frameCount(c);
  const { desk, phone } = spans(n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const cls = ['w', desk.has(i) ? 'span-d' : '', phone.has(i) ? 'span-m' : ''].filter(Boolean).join(' ');
    const piece = (c.work || [])[i];
    const caption = piece
      ? `<figcaption><span class="w-title">${esc(piece.title)}</span>${piece.detail ? `<span class="w-detail">${esc(piece.detail)}</span>` : ''}${piece.href ? `<a class="w-link" href="${esc(piece.href)}">${esc(piece.linkLabel || 'See it')}${icon('arrow', { size: 16 })}</a>` : ''}</figcaption>`
      : '';
    items.push(`<figure class="${cls}">${P.img(c, `w${i + 1}`, { eager: i < 2 })}${caption}</figure>`);
  }
  return `<div class="work">\n${items.join('\n')}\n</div>`;
}

// "2 hours" + "On site, 25 edited photos" -> "2 hours, on site, 25 edited photos".
function detailOf(s) {
  const blurb = String(s.blurb || '');
  if (!s.duration) return blurb;
  if (!blurb) return s.duration;
  return `${s.duration}, ${/^[A-Z][a-z]/.test(blurb) && !/^I\b/.test(blurb) ? blurb.charAt(0).toLowerCase() + blurb.slice(1) : blurb}`;
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const meta = [c.online ? '' : c.city || c.area, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap">
<p class="eyebrow">${esc(c.name)}</p>
<h1 id="hero-title">${esc(c.heroTitle)}</h1>
<div class="hero-row">
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas">
${P.button(c.primary, 'btn btn-primary btn-lg', c.booking ? 'calendar' : '')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
</div>
${meta.length ? `<ul class="meta">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
</section>`;

  const work = `<section class="sec work-sec" id="work" aria-labelledby="work-title">
<div class="wrap">
<div class="work-head"><h2 class="h2" id="work-title">Selected work</h2>${c.socials.instagram ? `<a class="more" href="${esc(c.socials.instagram)}">${icon('instagram', { size: 18 })}More on Instagram</a>` : c.socials.tiktok ? `<a class="more" href="${esc(c.socials.tiktok)}">${icon('tiktok', { size: 18 })}More on TikTok</a>` : ''}</div>
${workHtml(c)}
</div>
</section>`;

  const clients = c.clients && c.clients.length
    ? `<section class="clients" aria-label="Made for"><div class="wrap clients-in"><p class="eyebrow">Made for</p><ul>${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`
    : '';

  const services = c.services.length || c.included.length
    ? `<section class="sec svc-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
${head({ eyebrow: 'Services', title: 'What I offer', lead: c.services.some((s) => s.priceText) ? 'Prices are a starting point. Every project gets a written quote before anything is booked.' : '', id: 'services-title' })}
${c.services.length ? `<ul class="svc">${c.services.map((s, i) => `<li><span class="svc-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="svc-body"><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc(detailOf(s))}</p>` : ''}</div>${s.priceText ? `<span class="svc-price">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="incl-box"><h3>Every project includes</h3><ul class="incl">${c.included.map((x) => `<li>${icon('check', { size: 18 })}<span>${esc(x)}</span></li>`).join('')}</ul></div>` : ''}
</div>
</section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<figure class="about-media">${P.img(c, 'portrait', { cls: 'about-img' })}</figure>
<div class="about-copy">
<p class="eyebrow">About</p>
<h2 class="h2" id="about-title">${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${P.socials(c)}
</div>
</div>
</section>`;

  const how = c.steps.length
    ? `<section class="sec how" aria-labelledby="how-title"><div class="wrap">
${head({ eyebrow: 'How it works', title: 'From first message to final files', id: 'how-title' })}
<ol class="steps">${c.steps.map((s, i) => `<li><span class="n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol>
</div></section>`
    : '';

  const reviews = c.reviews.length ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap">${head({ eyebrow: 'Kind words', title: 'From the people I made it for', id: 'reviews-title' })}${P.reviews(c)}</div></section>` : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}${P.faq(c.faq)}</div></section>` : '';

  const projectTypes = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-copy">
<p class="eyebrow">Contact</p>
<h2 class="h2" id="contact-title">${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.promise ? `<p class="promise">${icon('shield', { size: 20 })}<span><strong>My promise:</strong> ${esc(c.promise)}</span></p>` : ''}
${c.booking ? `<div class="ctas">${P.button(c.primary, 'btn btn-primary btn-lg', 'calendar')}</div>` : ''}
${P.contactList(c, { cls: 'on-dark' })}
</div>
<div class="form-card">
${P.form(c, { id: 'contact', fields: ['name', 'email', { ...P.FIELD_PRESETS.company, label: 'Business or brand' }, projectTypes || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' }, projectTypes ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null, { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true }].filter(Boolean), submit: 'Send', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const body = [P.header(c, { cls: 'hdr-pf', mark: false }), '<main id="main">', hero, work, clients, services, about, how, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].join('\n');
  return { body, css: CSS, bodyClass: 'has-bar', base: { radius: '14px', radiusSm: '10px', btnRadius: '999px', max: '76rem' } };
}

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
h1,h2{letter-spacing:-.035em;font-weight:800}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:0;line-height:1.3}
.hdr{position:relative;z-index:30}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1.3rem;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:.15rem}
.nav a{display:block;padding:.5rem .8rem;font-size:.95rem;font-weight:500;color:var(--muted);text-decoration:none;border-radius:999px}
.nav a:hover{color:var(--ink);background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.2rem}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(2rem,1rem + 4vw,5.5rem) clamp(1.5rem,1rem + 2vw,3rem)}
.hero h1{margin-top:1.1rem;max-width:18ch;font-size:clamp(2.7rem,1.5rem + 5.6vw,6.6rem);line-height:.98}
.hero-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 1.5vw,2.5rem);align-items:end}
@media (min-width:60rem){.hero-row{grid-template-columns:1.1fr .9fr;gap:4rem}.hero-row .ctas{justify-content:flex-end}}
.hero .lead{max-width:36rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:2rem}
.meta li{padding:.35rem .8rem;border-radius:999px;border:1px solid var(--line);font-size:.875rem;font-weight:500;color:var(--muted)}
.work-sec{padding-top:clamp(1rem,.5rem + 2vw,2.5rem)}
.work-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:clamp(1.5rem,1rem + 1.5vw,2.5rem)}
.more{display:inline-flex;align-items:center;gap:.45rem;font-weight:600;text-decoration:none}
.more:hover{text-decoration:underline}
.work{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(1.25rem,.75rem + 1.5vw,2rem) clamp(.75rem,.5rem + 1vw,1.5rem);align-items:start}
@media (min-width:56rem){.work{grid-template-columns:repeat(3,minmax(0,1fr))}}
.w{margin:0;display:grid;gap:.6rem;min-width:0}
.w img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius);background:var(--surface);transition:transform .5s ease,filter .3s ease}
@media (max-width:55.99rem){.w.span-m{grid-column:span 2}.w.span-m img{aspect-ratio:33/20}}
@media (min-width:56rem){.w.span-d{grid-column:span 2}.w.span-d img{aspect-ratio:33/20}}
.w:hover img{transform:scale(1.015)}
.w figcaption{display:grid;gap:.1rem;padding-inline:.15rem}
.w-title{font-weight:600}
.w-detail{font-size:.9rem;color:var(--muted)}
.w-link{display:inline-flex;align-items:center;gap:.35rem;margin-top:.2rem;font-size:.9rem;font-weight:600;color:var(--primary-text);text-decoration:none}
.w-link:hover{text-decoration:underline}
.clients{padding-block:clamp(1.75rem,1rem + 2vw,2.75rem);border-block:1px solid var(--line)}
.clients-in{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 2rem}
.clients ul{display:flex;flex-wrap:wrap;gap:.6rem 2rem}
.clients li{font-family:var(--font-display);font-weight:700;font-size:1.2rem;letter-spacing:-.01em;color:var(--muted)}
.svc-sec{background:var(--surface)}
.svc{display:grid;border-top:1px solid var(--ink)}
.svc li{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1.25rem;align-items:baseline;padding:1.35rem 0;border-bottom:1px solid var(--line)}
@media (min-width:48rem){.svc li{grid-template-columns:3.5rem 1fr auto;gap:1.5rem}}
.svc-n{font-family:var(--font-display);font-weight:700;color:var(--primary-text)}
.svc-body h3{font-size:1.2rem}
.svc-body p{margin-top:.25rem;color:var(--muted)}
.svc-price{grid-column:2;font-family:var(--font-display);font-weight:700;font-size:1.35rem;white-space:nowrap}
@media (min-width:48rem){.svc-price{grid-column:auto;font-size:1.6rem}}
.incl-box{margin-top:2.5rem;padding:clamp(1.25rem,1rem + 1vw,2rem);border-radius:var(--radius);background:var(--bg);border:1px solid var(--line)}
.incl-box h3{margin-bottom:1rem;font-size:1.05rem}
.incl{display:grid;gap:.7rem}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;gap:.7rem 2rem}}
.incl li{display:flex;gap:.6rem;align-items:flex-start}
.incl .i{margin-top:.25rem;color:var(--primary-text)}
.about-grid{display:grid;gap:2.5rem;align-items:center}
@media (min-width:60rem){.about-grid{grid-template-columns:.85fr 1.15fr;gap:5rem}}
.about-media{margin:0;width:min(100%,26rem)}
.about-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius)}
.about-copy{display:grid;gap:1.1rem;justify-items:start;font-size:1.15rem;line-height:1.65}
.about-copy .h2{margin-bottom:.25rem}
.how{border-top:1px solid var(--line)}
.steps{display:grid;gap:2rem;counter-reset:s}
@media (min-width:56rem){.steps{grid-template-columns:repeat(4,1fr);gap:2rem}}
.steps li{display:grid;gap:.55rem;align-content:start;padding-top:1.25rem;border-top:2px solid var(--ink)}
.steps .n{font-family:var(--font-display);font-weight:800;font-size:1.1rem;color:var(--primary-text)}
.steps h3{font-size:1.15rem}
.steps p{color:var(--muted)}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.contact{background:var(--dark);color:var(--on-dark)}
.contact .eyebrow{color:var(--primary-on-dark)}
.contact .h2{color:var(--on-dark)}
.contact .lead{margin-top:.25rem;color:var(--muted-on-dark)}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:1fr 1fr;gap:5rem}}
.contact-copy{display:grid;gap:1rem;justify-items:start}
.promise{display:flex;gap:.7rem;align-items:flex-start;max-width:34rem;padding:1rem 1.2rem;border-radius:14px;border:1px solid var(--line-on-dark);line-height:1.5}
.promise .i{flex:none;margin-top:.15rem;color:var(--primary-on-dark)}
.promise strong{color:var(--on-dark)}
.contact-list.on-dark{margin-top:1rem}
.contact-list.on-dark .i{color:var(--primary-on-dark)}
.contact-list.on-dark a{color:var(--on-dark)}
.form-card{width:100%;padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border-radius:var(--radius);background:var(--bg);color:var(--ink)}
`;

module.exports = {
  id,
  name: 'Portfolio',
  bestFor: 'Photographers, UGC creators, video editors and designers: anyone hired for what they make',
  tokens,
  slots,
  nav,
  render,
};
