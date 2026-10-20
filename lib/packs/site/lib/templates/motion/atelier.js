// Atelier (animated, studio): for salons, barbers, nails, lashes, spas and tattoo.
//   Object:   the finished set: lacquered tips fanned on an ivory swatch card, the bottle beside them, drawn in the
//             member's own shades until the photos come in, seen through arch-cut frames (the shape of a nail tip),
//             and the price card at the front desk, hand set with dotted leaders.
//   Material: ivory card stock and espresso ink: 1px ink hairlines, an oversized high-contrast serif with room for its
//             descenders, square-cornered buttons, no cards.
//   One move: the headline unfolds up from its baseline like a turned page while the arched photo opens from its
//             center (choreo intro 'unfold').
//   Pop:      the member's colour is the lacquer itself, on the tips in the drawings, and the price a pointer rests on.
//             No line under the headline.
// At rest the arch sways a little toward the pointer. The one scroll moment is the gallery: the row of arches is
// scrubbed sideways by the scroll, from the first frame to the last (and back). The visit band sets the street address
// as the headline. JavaScript off and reduced motion: the complete, still page. Motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, HEAD_CSS, esc } = require('../shared');


const id = 'atelier';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f4ece1', 0.8), dark: color.mix(color.mix(p.ink, p.primary, 0.3), '#000000', 0.45) };
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
    { slot: 'about', file: 'about.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner} at ${c.name}` : `The team at ${c.name}` },
  ];
}

// The member's about paragraphs, less any sentence that only restates the hero (the name and the kind of business
// again) or says how to reach the owner, which the visit band already says.
function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const restates = (t) => (lw(t).includes(lw(c.name)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  return [
    c.services.length && { label: 'Menu', href: '#menu' },
    { label: 'Gallery', href: '#gallery' },
    aboutParas(c).length && { label: 'About', href: '#about' },
    { label: 'Visit', href: '#visit' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function menuHtml(c) {
  const groups = [];
  for (const s of c.services) {
    const title = s.category || '';
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    g.items.push(s);
  }
  const hn = groups.some((g) => g.title) ? 'h4' : 'h3';
  return `<div class="mn${groups.length > 1 ? ' cols' : ''}">
${groups
  .map(
    (g, gi) => `<div class="mn-group">
${g.title ? `<h3 class="mn-cat" data-rv><span class="mn-num" aria-hidden="true">${ROMAN[gi] || gi + 1}.</span>${esc(g.title)}</h3>` : ''}
<ul>
${g.items
  .map(
    (s, i) => `<li data-rv style="--d:${Math.min(i + 1, 8)}"><div class="mn-top"><${hn} class="mn-name">${esc(s.name)}</${hn}>${s.priceText ? `<span class="dots" aria-hidden="true"></span><span class="mn-price">${esc(s.priceText)}</span>` : ''}</div>
${s.duration || s.blurb ? `<p class="mn-meta">${[s.duration, s.blurb].filter(Boolean).map(esc).join('<span class="sep" aria-hidden="true"></span>')}</p>` : ''}</li>`
  )
  .join('\n')}
</ul>
</div>`
  )
  .join('\n')}
</div>`;
}

// The lead says what the headline doesn't: what's on the menu, where, and who runs it.
function leadLine(c) {
  const cats = [...new Set(c.services.map((s) => s.category).filter(Boolean))].filter((t) => !/extra|add|other/i.test(t));
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1].toLowerCase()}` : a[0] || '');
  const what = cats.length ? list(cats.map((t, i) => (i ? t.toLowerCase() : t))) : c.whatShort || '';
  const where = c.online ? '' : c.city || c.area || '';
  const who = c.owner && c.owner !== c.name ? `, run by ${c.owner}` : '';
  return what ? `${what}${where ? ` in ${where}` : ''}${who}.` : c.heroSub;
}

function render(c) {
  const bookIcon = c.primary.kind === 'phone' ? 'phone' : c.primary.kind === 'form' ? '' : 'calendar';
  const book = (cls) => P.button(c.primary, cls, bookIcon).replace('<a ', '<a data-mag ');
  const long = c.heroTitle.length > 30;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
<h1 id="hero-title" data-ci="head"${long ? ' class="long"' : ''}>${esc(c.heroTitle)}</h1>
<p class="lead" data-ci="then">${esc(leadLine(c))}</p>
<div class="ctas" data-ci="then">
${book('btn btn-primary btn-lg')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
</div>
<div class="hero-media" data-ci="subject">
<div class="arch" data-alive="0.6"><div class="arch-in">${P.img(c, 'hero', { cls: 'arch-img', eager: true })}</div></div>
</div>
</div>
</section>`;

  const priced = c.services.some((s) => s.priceText);
  const menu = c.services.length
    ? `<section class="sec menu-sec" id="menu" aria-labelledby="menu-title">
<div class="wrap">
<div class="menu-head">
<h2 class="h2" id="menu-title" data-rv>${priced ? 'Services and prices' : 'The services'}</h2>
${c.services.some((s) => s.duration) ? '<p class="lead" data-rv style="--d:3">Times are a guide, so you can plan your day.</p>' : ''}
</div>
${menuHtml(c)}
<div class="center-cta" data-rv>${book('btn btn-primary btn-lg')}</div>
</div>
</section>`
    : '';

  const shapes = ['f1', 'f2', 'f3', 'f4'];
  const figs = () =>
    shapes
      .map((k, i) => {
        const im = P.img(c, `g${i + 1}`);
        const alt = (c.images[`g${i + 1}`] || {}).alt || '';
        return `<li><figure class="${k}"><div class="ph">${im}</div><figcaption aria-hidden="true"><b>${String(i + 1).padStart(2, '0')}</b>${esc(alt)}</figcaption></figure></li>`;
      })
      .join('');
  const gallery = `<section class="gallery-sec" id="gallery" aria-labelledby="gallery-title" data-sc>
<div class="wrap gal-head">
<h2 class="h2" id="gallery-title" data-rv>A look inside</h2>
${c.socials.instagram ? `<a class="gal-more" data-rv href="${esc(c.socials.instagram)}">${icon('instagram', { size: 18 })}More on Instagram${icon('arrowUpRight', { size: 16 })}</a>` : ''}
</div>
<div class="strip"><ul class="strip-row">${figs()}</ul></div>
</section>`;

  // The menu at a glance as a roadmap: each group (or service) with its lowest listed price, drawn in with the scroll,
  // ending at the Book button.
  // First sentence large, the rest at reading size (the member's paragraphs kept). A sentence that only restates the
  // hero (the name and the kind of business again, or how to reach the owner, which the visit band says) is left out.
  const [p0 = '', ...more] = aboutParas(c);
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = !first && !rest.length ? '' : `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media"><div class="oval" data-rv="mask"><div class="oval-in">${P.img(c, 'about', { cls: 'oval-img' }).replace('class="oval-img"', 'class="oval-img" data-par="0.05"')}</div></div></div>
<div class="about-copy">
<h2 class="sr-only" id="about-title">About ${esc(c.name)}</h2>
<p class="about-big" data-rv>${esc(first)}</p>
${rest.map((p, i) => `<p class="about-more" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig" data-rv style="--d:4">${esc(c.owner)}</p>` : ''}
${P.socials(c, { cls: 'about-social' }) ? `<div data-rv style="--d:5">${P.socials(c, { cls: 'about-social' })}</div>` : ''}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="h2" id="reviews-title" data-rv>From our clients</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const where = c.address
    ? `<div class="vi" data-rv style="--d:1"><h3>Address</h3><p class="vi-big">${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)}</p>${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Get directions${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>`
    : c.area && !c.online
      ? `<div class="vi" data-rv style="--d:1"><h3>Area</h3><p class="vi-big">${esc(c.area)}</p></div>`
      : '';
  const street = c.address ? c.address.split(',')[0].trim() : '';
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title">
<div class="wrap visit-grid">
<div class="visit-copy">
<h2 class="h2 visit-h" id="visit-title" data-rv>${esc(street || 'Book a time')}</h2>
${street ? `<p class="visit-rest" data-rv style="--d:1">${esc(c.address.slice(street.length).replace(/^,\s*/, ''))}</p>` : ''}
<div class="ctas" data-rv style="--d:4">${book('btn btn-primary btn-lg')}</div>
</div>
<div class="visit-info">
${street ? (c.mapsUrl ? `<div class="vi" data-rv style="--d:1"><p><a class="arrow-link" href="${esc(c.mapsUrl)}">Get directions${icon('arrowUpRight', { size: 16 })}</a></p></div>` : '') : where}
${c.hours.rows.length ? `<div class="vi" data-rv style="--d:2"><h3>Hours</h3>${P.hours(c.hours.rows, 'on-dark')}</div>` : ''}
${c.phone || c.email ? `<div class="vi" data-rv style="--d:3"><h3>Contact</h3>${c.phone ? `<p class="vi-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
</div>
</div>
</section>`;

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">
<h2 class="h2" id="faq-title">Before you book</h2>
<dl class="qa">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl>
</div></section>`
    : '';

  const fields = ['name', 'email', 'phone', c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: c.services.map((s) => s.name), half: true } : null, c.booking ? null : { ...P.FIELD_PRESETS.when }, 'message'].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-head">
<h2 class="h2" id="contact-title">${c.booking ? 'Write a note' : 'Request a time'}</h2>
<p class="lead">${c.booking ? `For a question about a set or a colour before you book${c.owner && c.owner !== c.name ? `, ${c.owner} will write back` : ''}.` : 'Tell us what you would like and when, and we will confirm your time.'}</p>
</div>
<div class="form-card">
${P.form(c, { id: 'contact', fields, submit: c.booking ? 'Send' : 'Request my time', subject: `Message for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-at', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, gallery, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', btnRadius: '2px' } };
}

// The placeholders, drawn: lacquered tips fanned on an ivory swatch card with the bottle beside them (hero and about),
// a single tip close up, a row of swatch sticks and the bottle alone (gallery), each over plaster in window light.
// The lacquer is the member's colour in a few shades, with a gloss that runs along each tip. No text, no blobs.
function art(slot, { p, seed, index, art: Art }) {
  const w = slot.w, h = slot.h;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:${slot.slot}`);
  const W = Art.wall({ style: slot.style || 'arch', w, h, p, seed, index, quiet: true });
  const ivory = color.mix(p.paper, '#fffaf2', 0.6);
  const ink = color.mix(p.ink, '#2a1a14', 0.4);
  const shades = [color.mix(p.primary, '#000000', 0.18), p.primary, color.mix(p.primary, '#ffffff', 0.28), color.mix(p.primary, '#f6e7dc', 0.55), color.mix(p.primary, '#000000', 0.38)];
  const id = slot.slot;
  // One tip, base at (0,0), pointing up, tw wide and th tall; almond shape with a soft cuticle curve and a gloss.
  const tip = (x, y, tw, th, rot, fill) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M${f(-tw / 2)} 0C${f(-tw / 2)} ${f(-th * 0.62)} ${f(-tw * 0.18)} ${f(-th)} 0 ${f(-th)}C${f(tw * 0.18)} ${f(-th)} ${f(tw / 2)} ${f(-th * 0.62)} ${f(tw / 2)} 0Q0 ${f(th * 0.1)} ${f(-tw / 2)} 0Z" fill="${fill}"/><path d="M${f(-tw * 0.28)} ${f(-th * 0.12)}C${f(-tw * 0.3)} ${f(-th * 0.55)} ${f(-tw * 0.16)} ${f(-th * 0.82)} ${f(-tw * 0.04)} ${f(-th * 0.9)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${f(tw * 0.09)}" stroke-linecap="round"/><path d="M${f(-tw / 2)} 0Q0 ${f(th * 0.1)} ${f(tw / 2)} 0" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${f(tw * 0.04)}"/></g>`;
  const bottle = (x, y, bw, fill) => {
    const bh = bw * 1.05, cw = bw * 0.42, ch = bw * 1.1;
    return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-bw / 2 + bw * 0.04)}" y="${f(-bh + bw * 0.06)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="#000" opacity=".12" filter="url(#sh${id})"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="${fill}"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="url(#gl${id})"/><rect x="${f(-bw * 0.36)}" y="${f(-bh * 0.86)}" width="${f(bw * 0.1)}" height="${f(bh * 0.66)}" rx="${f(bw * 0.05)}" fill="#fff" opacity=".45"/><rect x="${f(-cw / 2)}" y="${f(-bh - ch)}" width="${f(cw)}" height="${f(ch)}" rx="${f(cw * 0.12)}" fill="${ink}"/><rect x="${f(-cw / 2 + cw * 0.14)}" y="${f(-bh - ch + ch * 0.06)}" width="${f(cw * 0.12)}" height="${f(ch * 0.86)}" fill="#fff" opacity=".18"/></g>`;
  };
  const defs = `${W.defs}<filter id="sh${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(Math.min(w, h) * 0.012)}"/></filter><linearGradient id="gl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;
  const card = (x, y, cw, chh, rot) => `<g transform="rotate(${f(rot)} ${f(x + cw / 2)} ${f(y + chh / 2)})"><rect x="${f(x + cw * 0.02)}" y="${f(y + chh * 0.025)}" width="${f(cw)}" height="${f(chh)}" fill="#000" opacity=".14" filter="url(#sh${id})"/><rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(chh)}" fill="${ivory}"/><rect x="${f(x + cw * 0.05)}" y="${f(y + chh * 0.05)}" width="${f(cw * 0.9)}" height="${f(chh * 0.9)}" fill="none" stroke="${color.mix(ivory, ink, 0.18)}" stroke-width="1.5"/></g>`;
  let body = W.body;
  const kind = slot.slot === 'g2' ? 'one' : slot.slot === 'g3' ? 'sticks' : slot.slot === 'g4' ? 'bottle' : 'fan';
  if (kind === 'fan') {
    const cw = w * 0.7, chh = h * 0.5, x = (w - cw) / 2, y = h * 0.36;
    body += card(x, y, cw, chh, -3 + r() * 2);
    const cx = w / 2, cy = y + chh * 0.88, tw = w * 0.1, th = h * 0.2;
    for (let i = 0; i < 5; i++) body += tip(cx + (i - 2) * tw * 1.25, cy - Math.abs(i - 2) * th * 0.08, tw, th, (i - 2) * 11, shades[i]);
    body += bottle(w * 0.78, y + chh * 0.08, w * 0.15, shades[1]);
  } else if (kind === 'one') {
    body += tip(w / 2, h * 0.84, w * 0.36, h * 0.7, -8 + r() * 6, shades[1]);
  } else if (kind === 'sticks') {
    for (let i = 0; i < 5; i++) {
      const x = w * (0.18 + i * 0.16), y = h * (0.88 - (i % 2) * 0.05);
      body += `<rect x="${f(x - w * 0.012)}" y="${f(y - h * 0.02)}" width="${f(w * 0.024)}" height="${f(h * 0.3)}" fill="${color.mix(ivory, ink, 0.12)}"/>`;
      body += tip(x, y, w * 0.12, h * 0.26, 0, shades[i]);
    }
  } else {
    body += bottle(w * 0.5, h * 0.84, w * 0.36, shades[1]);
    body += tip(w * 0.2, h * 0.88, w * 0.1, h * 0.14, -70, shades[2]);
  }
  return Art.svgDoc(w, h, defs, body);
}

// On a mouse, a small arched photo follows the pointer along the price menu.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(hover: hover)').matches)return;var d=document,rows=[].slice.call(d.querySelectorAll('.mn li')),src=[].slice.call(d.querySelectorAll('.strip-row:first-child img')).map(function(i){return i.getAttribute('src')});if(!rows.length||!src.length)return;var f=d.createElement('div'),im=d.createElement('img');f.className='peek';f.setAttribute('aria-hidden','true');im.alt='';f.appendChild(im);d.body.appendChild(f);var x=0,y=0,tx=0,ty=0,on=false,raf=0;function loop(){x+=(tx-x)*.16;y+=(ty-y)*.16;f.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';raf=on||Math.abs(tx-x)>.5?requestAnimationFrame(loop):0}rows.forEach(function(r,i){r.addEventListener('pointerenter',function(e){im.src=src[i%src.length];if(!on&&!f.classList.contains('on')){x=tx=e.clientX+28;y=ty=e.clientY-110}on=true;f.classList.add('on');if(!raf)raf=requestAnimationFrame(loop)});r.addEventListener('pointermove',function(e){tx=e.clientX+28;ty=e.clientY-110});r.addEventListener('pointerleave',function(){on=false;f.classList.remove('on')})})})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.02em}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg));color:var(--bg)}
.arch{transform-origin:50% 100%}
.h2{font-size:clamp(2.5rem,1.5rem + 3.8vw,4.8rem);line-height:.98;letter-spacing:-.035em}
.lead{color:var(--muted)}
.narrow{max-width:46rem}
.btn{font-weight:500;letter-spacing:.12em;text-transform:uppercase;font-size:.82rem}
.btn-lg{font-size:.86rem;padding-inline:2.1rem}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .4s ease,border-color .4s ease}
.hdr{background:var(--bg)}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:5.25rem;transition:min-height .4s ease}
.hdr.scrolled .hdr-in{min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;font-style:italic;line-height:1.05;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:.4rem}
.nav a{position:relative;display:block;padding:.6rem .8rem;font-size:.74rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;color:var(--muted);transition:color .3s ease}
.nav a::after{content:'';position:absolute;left:.8rem;right:.8rem;bottom:.35rem;height:1px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .5s cubic-bezier(.7,0,.2,1)}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{transform:scaleX(1);transform-origin:left}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.9rem;padding:.6rem 1.4rem;font-size:.74rem}
.menu>summary{background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;padding-block:clamp(1.5rem,1rem + 2.5vw,3.5rem) clamp(3rem,2rem + 4vw,6rem)}
.hero-grid{display:grid;gap:clamp(2.75rem,1.5rem + 4vw,4rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);gap:clamp(2rem,4vw,5rem)}}
.hero h1{font-size:clamp(3.6rem,1.3rem + 7vw,8.8rem);line-height:1.02;letter-spacing:-.045em}
.hero h1.long{font-size:clamp(2.9rem,1.2rem + 5.4vw,6.8rem);line-height:1.04}
.hero .lead{margin-top:clamp(1.5rem,1rem + 1.5vw,2.25rem);max-width:31rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-media{position:relative;justify-self:center;width:min(100%,29rem)}
@media (min-width:60rem){.hero-media{justify-self:end}}
.arch{overflow:hidden;border-radius:999px 999px 4px 4px;aspect-ratio:11/14;background:var(--primary-soft);isolation:isolate}
.arch-in{height:100%;overflow:hidden;border-radius:inherit}
.arch-img{display:block;width:100%;height:100%;object-fit:cover}
.facts{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem 1.4rem;margin-top:clamp(2.5rem,1.5rem + 3vw,4.5rem);padding-block:1.15rem;border-block:1px solid var(--line);font-size:.74rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.facts{gap:.7rem 0}
.facts li{padding-right:1.4rem}
.facts li+li{padding-left:1.4rem;border-left:1px solid var(--line)}
@media (max-width:39.99rem){.facts{display:grid}.facts li+li{padding-left:0;border-left:0}}
.hero-cap{margin-top:1rem;font-size:.8rem;letter-spacing:.04em;color:var(--muted);text-align:right}
.menu-sec{background:var(--surface)}
.menu-head{display:grid;gap:1rem;justify-items:center;max-width:44rem;margin:0 auto clamp(2.5rem,1.5rem + 3vw,4.5rem);text-align:center}
.mn{display:grid;gap:3rem 5.5rem;max-width:66rem;margin-inline:auto}
@media (min-width:56rem){.mn.cols{grid-template-columns:1fr 1fr}}
.mn-cat{display:flex;align-items:baseline;gap:.9rem;padding-bottom:.6rem;border-bottom:1px solid var(--ink);font-size:clamp(1.8rem,1.4rem + 1.2vw,2.4rem);letter-spacing:-.02em}
.mn-num{font-family:var(--font-body);font-size:.72rem;font-style:normal;font-weight:500;letter-spacing:.24em;color:var(--primary-deep)}
.mn li{position:relative;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.mn li::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--pop);transform:scaleX(0);transform-origin:right;transition:transform .7s cubic-bezier(.7,0,.2,1)}
.mn li:hover::after{transform:scaleX(1);transform-origin:left}
.mn-top{display:flex;align-items:baseline;gap:.9rem}
.mn-name{margin:0;font-family:var(--font-display);font-size:clamp(1.2rem,1.1rem + .4vw,1.45rem);font-weight:400;letter-spacing:-.01em}
.dots{flex:1;min-width:1.5rem;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 38%,transparent);transform:translateY(-.3rem);transform-origin:0 50%}
html.m .mn li[data-rv] .dots{transform:translateY(-.3rem) scaleX(0);transition:transform 1.2s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms + .3s)}
html.m .mn li.in .dots{transform:translateY(-.3rem) scaleX(1)}
.mn-price{font-family:var(--font-display);font-size:clamp(1.25rem,1.1rem + .5vw,1.55rem);white-space:nowrap;transition:color .3s ease}
.mn li:hover .mn-price{color:var(--pop)}
.mn-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .6rem;margin-top:.3rem;font-size:.95rem;color:var(--muted)}
.mn-meta .sep{width:.25rem;height:.25rem;border-radius:50%;background:currentColor;opacity:.6}
.peek{position:fixed;left:0;top:0;z-index:25;width:9.5rem;aspect-ratio:3/4;overflow:hidden;border-radius:999px 999px 6px 6px;pointer-events:none;opacity:0;scale:.6;rotate:-4deg;transition:opacity .35s ease,scale .6s cubic-bezier(.16,1,.3,1),rotate .6s cubic-bezier(.16,1,.3,1);box-shadow:0 30px 60px -28px rgba(0,0,0,.45)}
.peek.on{opacity:1;scale:1;rotate:0deg}
.peek img{width:100%;height:100%;object-fit:cover}
.center-cta{display:flex;justify-content:center;margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
.gallery-sec{padding-block:var(--section);overflow:hidden}
.gal-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1.25rem 2rem;margin-bottom:clamp(2rem,1.5rem + 2.5vw,4rem)}
.gal-head .h2{margin-top:.9rem}
.gal-more{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;font-size:.78rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid var(--line)}
.gal-more:hover{border-bottom-color:currentColor}
.strip{overflow-x:auto;scrollbar-width:none;padding-inline:max(1rem,calc((100vw - var(--max)) / 2))}
.strip::-webkit-scrollbar{display:none}
html.m .strip{overflow:hidden}
.strip-row{width:max-content}
html.m .strip-row{transform:translate3d(calc((100vw - 100% - 2 * max(1rem,(100vw - var(--max)) / 2)) * var(--p,0)),0,0)}
.strip-row{display:flex;flex:none;align-items:center;gap:clamp(1rem,2vw,2.25rem)}
.strip figure{margin:0}
.strip .ph{overflow:hidden;background:var(--primary-soft)}
.strip img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.16,1,.3,1)}
.strip figure:hover img{transform:scale(1.06)}
.strip .f1 .ph{width:clamp(16rem,10rem + 16vw,30rem);aspect-ratio:3/4;border-radius:999px 999px 4px 4px}
.strip .f2 .ph{width:clamp(14rem,9rem + 12vw,24rem);aspect-ratio:1;border-radius:2px}
.strip .f3 .ph{width:clamp(15rem,9rem + 14vw,27rem);aspect-ratio:4/5;border-radius:2px}
.strip .f4 .ph{width:clamp(14rem,9rem + 12vw,24rem);aspect-ratio:3/4;border-radius:999px 999px 4px 4px}
.strip .f2{margin-top:clamp(5rem,10vw,12rem)}
.strip .f4{margin-top:clamp(2rem,5vw,6rem)}
.strip-row{align-items:flex-start}
.strip figcaption{display:flex;gap:.8rem;max-width:min(16rem,100%);margin-top:.9rem;font-size:.85rem;line-height:1.4;color:var(--muted)}
.strip figcaption b{font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums}
.about-grid{display:grid;gap:clamp(2.5rem,1.5rem + 3vw,6rem);align-items:center}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr}}
.about-media{display:grid;justify-items:center}
.oval{width:min(100%,25rem);overflow:hidden;border-radius:999px 999px 4px 4px;aspect-ratio:4/5;background:var(--primary-soft)}
.oval-in{height:100%;overflow:hidden}
.oval-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.about-copy{display:grid;gap:1.4rem;justify-items:start}
.about-big{font-family:var(--font-display);font-size:clamp(1.85rem,1.2rem + 2.3vw,3.1rem);line-height:1.16;letter-spacing:-.025em;text-wrap:balance}
.about-more{font-size:1.15rem;line-height:1.7;color:var(--muted);max-width:38rem}
.sig{font-family:var(--font-display);font-size:2.1rem;font-style:italic;line-height:1;color:var(--primary-deep)}
.about-social{margin-top:.25rem}
.reviews-sec{background:var(--surface)}
.quotes{display:grid;gap:2.5rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:4rem}}
.quote{display:grid;gap:1.1rem;padding-top:1.5rem;border-top:1px solid var(--ink)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.4rem,1.15rem + 1vw,1.9rem);font-style:italic;line-height:1.3;letter-spacing:-.015em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-size:.75rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.visit{position:relative;overflow:hidden;background:var(--dark);color:var(--on-dark)}
.visit .lead{margin-top:1.25rem;color:var(--muted-on-dark)}
.visit-grid{position:relative;display:grid;gap:3.5rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:1.1fr .9fr;gap:6rem;align-items:start}}
.visit-h{font-size:clamp(2.6rem,1.2rem + 5vw,6.2rem);line-height:.95}
.visit-rest{margin-top:1rem;font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem)}
.visit-info{display:grid;gap:2.25rem}
.vi{padding-top:1.4rem;border-top:1px solid var(--line-on-dark)}
.vi h3{margin-bottom:.7rem;font-family:var(--font-body);font-size:.72rem;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--muted-on-dark)}
.vi p{font-size:1.1rem}
.vi p+p{margin-top:.45rem}
.vi-big{font-family:var(--font-display);font-size:clamp(1.4rem,1.2rem + .8vw,1.85rem)!important;line-height:1.25;letter-spacing:-.015em}
.vi a{color:var(--on-dark);text-decoration-color:var(--line-on-dark)}
.vi .arrow-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;color:var(--primary-on-dark)}
.hours.on-dark div{border-color:var(--line-on-dark)}
.hours.on-dark dt{font-weight:500}
.hours.on-dark dd{color:var(--muted-on-dark)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}}
.qa{border-top:1px solid var(--ink)}
.qa div{display:grid;gap:.4rem;padding:1.3rem 0;border-bottom:1px solid var(--line)}
.qa dt{font-family:var(--font-display);font-size:clamp(1.2rem,1.1rem + .4vw,1.45rem)}
.qa dd{color:var(--muted)}
.contact{background:var(--surface)}
.contact-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.contact-grid{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:5rem}}
.contact-head{display:grid;gap:1rem;align-content:start}
.contact .form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.4rem);background:color-mix(in srgb,#fffaf2 60%,var(--bg));border-top:1px solid var(--ink)}
.contact .field input,.contact .field select,.contact .field textarea{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding-inline:0}
.contact .field input:focus,.contact .field select:focus,.contact .field textarea:focus{border-bottom-color:var(--ink);box-shadow:none}
.menu-panel li a{font-weight:400;font-size:1.9rem;letter-spacing:-.03em}
.ftr{background:var(--bg)}
.ftr-name{font-style:italic;font-weight:400}
.mbar{background:var(--bg);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'studio',
  name: 'Atelier',
  bestFor: 'Salons, barbers, nail and lash artists, spas and tattoo studios, with motion',
  why: 'Editorial and luxurious, with motion: an oversized serif headline unfolds like a turned page, your work opens in an arch from its center, the gallery of arches is scrubbed by as you scroll, and your price card is hand set with dotted leaders beside one clear Book button.',
  fonts: { q: 'family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..600&family=Jost:wght@400;500;600', display: ['Bodoni Moda', 'serif'], body: ['Jost', 'sans'] },
  // The motion, as data (lib/choreo.md): a page turning, a photo that sways a little, a gallery you scroll past.
  choreo: { intro: 'unfold', alive: ['pointer', 'drift'], scroll: 'scrub', pace: 'calm', look: 'editorial, slow and soft' },
  tokens,
  slots,
  nav,
  render,
  art,
};
