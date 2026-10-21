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
//   Neon:     the member's neon partner is one keyline around the hero arch, set in once the photo has opened.
// Two modes: ivory by day (its own) and the studio after hours (dark), espresso with ivory type. At rest the arch
// drifts a little. The one scroll moment is the gallery: the row of arches is scrubbed sideways by the scroll, from the
// first frame to the last (and back), and each photo shifts inside its arch at its own depth, like walking past
// windows (the page's showpiece). The visit band sets the street address
// as the headline. JavaScript off and reduced motion: the complete, still page. Motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { HEAD_CSS, esc } = require('../shared');
const { lenisScript, LENIS_CSS } = require('../../../vendor/lenis/lenis');


const id = 'atelier';

// Two rooms: ivory card stock by day (its own), and the studio after hours, espresso and warm lamplight.
function tokens(p, mode) {
  if (mode === 'dark') return { bg: '#17110e', dark: '#0c0907' };
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
  // "Menu" only for a place with a menu (a cafe given this design); a studio lists its prices or services.
  const menuWord = c.profile && c.profile.template === 'restaurant' ? 'Menu' : c.services.some((s) => s.priceText) ? 'Prices' : 'Services';
  return [
    c.services.length && { label: menuWord, href: '#menu' },
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

// The close is the salon's own card, set centred like the back of an appointment card: the name in italic, then where,
// when and how to reach the studio, the pages, and the small print. Not the shared three-column footer.
function footer(c) {
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  const reach = [c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`, c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`].filter(Boolean).join('<span class="at-dot" aria-hidden="true"></span>');
  const place = c.address ? (c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)) : c.area && !c.online ? esc(c.area) : '';
  return `<footer class="at-ftr">
<div class="wrap at-ftr-in">
<p class="at-ftr-name">${esc(c.name)}</p>
${place ? `<p class="at-ftr-line">${place}</p>` : ''}
${c.hoursLine ? `<p class="at-ftr-line">${esc(c.hoursLine)}</p>` : ''}
${reach ? `<p class="at-ftr-line">${reach}</p>` : ''}
${P.socials(c, { cls: 'at-ftr-social', size: 18 })}
${links ? `<nav aria-label="Footer"><ul class="at-ftr-nav">${links}</ul></nav>` : ''}
<p class="at-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div>
</footer>`;
}

function render(c) {
  // "We will confirm your time" only when the form asks for a time (its button says so); a florist's order, a coach's
  // message or a cafe's note gets plainer words.
  const own = !c.booking && c.primary.kind === 'form' && /\btime\b/i.test(c.primary.label);
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
<div class="hero-media">
<div class="arch-key" aria-hidden="true"></div>
<div class="arch-mv" data-ci="subject"><div class="arch" data-alive="0.5"><div class="arch-in">${P.img(c, 'hero', { cls: 'arch-img', eager: true })}</div></div></div>
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
        return `<li style="--k:${(i / 3).toFixed(3)}"><figure class="${k}"><div class="ph">${im}</div><figcaption aria-hidden="true"><b>${String(i + 1).padStart(2, '0')}</b>${esc(alt)}</figcaption></figure></li>`;
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
<h2 class="h2 visit-h" id="visit-title" data-rv>${esc(street || (own || c.booking ? 'Book a time' : 'Find us'))}</h2>
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

  const fields = ['name', 'email', 'phone', c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: c.services.map((s) => s.name), half: true } : null, c.booking || !own ? null : { ...P.FIELD_PRESETS.when }, 'message'].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-card">
<div class="contact-head">
<h2 class="h2" id="contact-title">${esc(!c.booking && c.primary.kind === 'form' ? c.primary.label : 'Write a note')}</h2>
<p class="lead">${c.booking ? `For a question ${['nails', 'hair', 'beauty'].includes(kindOf(c)) ? 'about a set or a colour ' : ''}before you book${c.owner && c.owner !== c.name ? `, ${c.owner} will write back` : ''}.` : own ? 'Tell us what you would like and when, and we will confirm your time.' : 'Tell us what you need, and we will get back to you.'}</p>
</div>
${P.form(c, { id: 'contact', fields, submit: c.booking || !own ? 'Send' : 'Request my time', subject: `Message for ${c.name}` })}
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-at', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, gallery, about, reviews, visit, faq, contact, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}${LENIS_CSS}`, script: `${m.script}${lenisScript({ lerp: 0.08 })}`, bodyClass: 'has-bar', base: { radius: '4px', btnRadius: '2px' } };
}

// The placeholders, drawn from the kind of studio (c.profile.id, else the words in the facts), each set on an ivory
// card over plaster in window light, built from light and material: lacquer with its gloss, brushed steel with a
// hairline edge, glass with its rim light, and a real shadow under everything.
//   nails: lacquered tips fanned on the card, the bottle beside them   hair: shears open over a comb
//   barber: a straight razor, open, and a shaving brush                beauty: a pair of strip lashes and tweezers
//   spa: warm stones stacked beside rolled towels                     tattoo: ink bottles and caps on the tray
//   anything else: the studio's open door, light falling in from the room (about the place, not a trade).
// The gallery shows the same things one at a time, and a dropper bottle of the studio's product. No text, no blobs.
function kindOf(c) {
  const id = (c.profile && c.profile.id) || '';
  const KIND = { nails: 'nails', salon: 'hair', barber: 'barber', beauty: 'beauty', spa: 'spa', tattoo: 'tattoo' };
  if (KIND[id]) return KIND[id];
  const s = `${c.what || ''} ${c.niche || ''} ${(c.services || []).map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\b(nails?|manicures?|pedicures?|gel x|acrylics)\b/.test(s)) return 'nails';
  if (/\b(barber\w*|beard|shaves?|fades?)\b/.test(s)) return 'barber';
  if (/\btattoo/.test(s)) return 'tattoo';
  if (/\b(massage\w*|day spa|spa|bodywork|reflexology)\b/.test(s)) return 'spa';
  if (/\b(lash\w*|brows?|makeup|facials?|esthetic\w*|waxing)\b/.test(s)) return 'beauty';
  if (/\b(hair\w*|salons?|stylists?|blowouts?|balayage|braid\w*|colou?r)\b/.test(s)) return 'hair';
  return '';
}
function art(slot, { p, c, seed, index, art: Art }) {
  const kind = kindOf(c || {});
  // A rendered photo wins when the pack ships one: the nail studio's own set (hero, g1 to g4, about), and for the other
  // trades their own (hero-hair, g1-barber, ... ; hero-door for anything else). The drawing stays the fallback.
  const ph = Art.photo && Art.photo('atelier', kind === 'nails' ? slot.slot : `${slot.slot}-${kind || 'door'}`);
  if (ph) return ph;
  if (!kind && slot.slot !== 'hero') return null;
  const w = slot.w, h = slot.h;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:${slot.slot}`);
  const W = Art.wall({ style: slot.style || 'arch', w, h, p, seed, index, quiet: true });
  const ivory = color.mix(p.paper, '#fffaf2', 0.6);
  const ink = color.mix(p.ink, '#2a1a14', 0.4);
  const shades = [color.mix(p.primary, '#000000', 0.18), p.primary, color.mix(p.primary, '#ffffff', 0.28), color.mix(p.primary, '#f6e7dc', 0.55), color.mix(p.primary, '#000000', 0.38)];
  const id = slot.slot;
  const m = Math.min(w, h);
  const hair = `stroke="#000" stroke-opacity=".28" stroke-width="1"`;
  // Anything drawn gets its own soft shadow: the same shapes in black, blurred and dropped toward the light's far side.
  const shadow = (g, dx = m * 0.012, dy = m * 0.02, op = 0.22) => `<g transform="translate(${f(dx)} ${f(dy)})" opacity="${op}" filter="url(#sh${id})">${g.replace(/fill="(?!none)[^"]*"/g, 'fill="#000"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="#000"').replace(/ stroke-opacity="[^"]*"/g, '')}</g>`;
  const lit = (g) => shadow(g) + g;
  const defs = `${W.defs}<filter id="sh${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(m * 0.012)}"/></filter><linearGradient id="gl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient><linearGradient id="st${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f8fa"/><stop offset=".42" stop-color="#a7adb5"/><stop offset=".58" stop-color="#e9ebee"/><stop offset="1" stop-color="#6f757d"/></linearGradient><radialGradient id="rd${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>`;

  // One tip, base at (0,0), pointing up, tw wide and th tall; almond shape with a soft cuticle curve and a gloss.
  const tip = (x, y, tw, th, rot, fill) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M${f(-tw / 2)} 0C${f(-tw / 2)} ${f(-th * 0.62)} ${f(-tw * 0.18)} ${f(-th)} 0 ${f(-th)}C${f(tw * 0.18)} ${f(-th)} ${f(tw / 2)} ${f(-th * 0.62)} ${f(tw / 2)} 0Q0 ${f(th * 0.1)} ${f(-tw / 2)} 0Z" fill="${fill}"/><path d="M${f(-tw * 0.28)} ${f(-th * 0.12)}C${f(-tw * 0.3)} ${f(-th * 0.55)} ${f(-tw * 0.16)} ${f(-th * 0.82)} ${f(-tw * 0.04)} ${f(-th * 0.9)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${f(tw * 0.09)}" stroke-linecap="round"/><path d="M${f(-tw / 2)} 0Q0 ${f(th * 0.1)} ${f(tw / 2)} 0" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${f(tw * 0.04)}"/></g>`;
  // The polish bottle: a squat glass block with lacquer behind it and a tall ink cap.
  const polish = (x, y, bw, fill) => {
    const bh = bw * 1.05, cw = bw * 0.42, ch = bw * 1.1;
    return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-bw / 2 + bw * 0.04)}" y="${f(-bh + bw * 0.06)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="#000" opacity=".12" filter="url(#sh${id})"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="${fill}"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.16)}" fill="url(#gl${id})"/><rect x="${f(-bw * 0.36)}" y="${f(-bh * 0.86)}" width="${f(bw * 0.1)}" height="${f(bh * 0.66)}" rx="${f(bw * 0.05)}" fill="#fff" opacity=".45"/><rect x="${f(-cw / 2)}" y="${f(-bh - ch)}" width="${f(cw)}" height="${f(ch)}" rx="${f(cw * 0.12)}" fill="${ink}"/><rect x="${f(-cw / 2 + cw * 0.14)}" y="${f(-bh - ch + ch * 0.06)}" width="${f(cw * 0.12)}" height="${f(ch * 0.86)}" fill="#fff" opacity=".18"/></g>`;
  };
  // A dropper bottle of the studio's own product: frosted glass, the liquid in the member's shade, a rubber bulb.
  const dropper = (x, y, bw, fill) => {
    const bh = bw * 1.35, nw = bw * 0.36;
    return lit(`<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.22)}" fill="${color.mix(fill, ivory, 0.35)}" opacity=".9"/><rect x="${f(-bw / 2 + bw * 0.05)}" y="${f(-bh * 0.62)}" width="${f(bw * 0.9)}" height="${f(bh * 0.58)}" rx="${f(bw * 0.18)}" fill="${fill}"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.22)}" fill="url(#gl${id})" ${hair}/><path d="M${f(-bw * 0.3)} ${f(-bh * 0.85)}v${f(bh * 0.7)}" stroke="#fff" stroke-opacity=".6" stroke-width="${f(bw * 0.05)}" stroke-linecap="round" fill="none"/><rect x="${f(-nw / 2)}" y="${f(-bh - bw * 0.22)}" width="${f(nw)}" height="${f(bw * 0.26)}" fill="url(#st${id})" ${hair}/><path d="M${f(-nw * 0.42)} ${f(-bh - bw * 0.22)}c0 ${f(-bw * 0.5)} ${f(nw * 0.84)} ${f(-bw * 0.5)} ${f(nw * 0.84)} 0Z" fill="${ink}"/><path d="M${f(-nw * 0.2)} ${f(-bh - bw * 0.3)}q0 ${f(-bw * 0.22)} ${f(nw * 0.16)} ${f(-bw * 0.3)}" stroke="#fff" stroke-opacity=".3" stroke-width="${f(bw * 0.04)}" fill="none" stroke-linecap="round"/></g>`);
  };
  // Shears, open a little, pivot at (x, y), blades toward the angle rot; rings in lacquer, blades in brushed steel.
  const shears = (x, y, L, rot) => {
    const blade = (a, s) => `<g transform="rotate(${a})"><path d="M${f(-L * 0.06)} ${f(-L * 0.035 * s)}L${f(L * 0.62)} ${f(-L * 0.012 * s)}Q${f(L * 0.66)} 0 ${f(L * 0.6)} ${f(L * 0.004 * s)}L${f(-L * 0.06)} ${f(L * 0.02 * s)}Z" fill="url(#st${id})" ${hair}/><path d="M0 ${f(-L * 0.022 * s)}L${f(L * 0.55)} ${f(-L * 0.009 * s)}" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" fill="none"/><path d="M${f(-L * 0.06)} 0L${f(-L * 0.3)} ${f(L * 0.06 * s)}" stroke="url(#st${id})" stroke-width="${f(L * 0.032)}" stroke-linecap="round" fill="none"/><circle cx="${f(-L * 0.38)}" cy="${f(L * 0.1 * s)}" r="${f(L * 0.085)}" fill="none" stroke="${shades[0]}" stroke-width="${f(L * 0.034)}"/><path d="M${f(-L * 0.44)} ${f(L * (0.1 * s - 0.04))}a${f(L * 0.085)} ${f(L * 0.085)} 0 0 1 ${f(L * 0.09)} ${f(-L * 0.04)}" stroke="#fff" stroke-opacity=".5" stroke-width="${f(L * 0.008)}" fill="none" stroke-linecap="round"/></g>`;
    return lit(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${blade(-5, 1)}${blade(5, -1)}<path d="M${f(-L * 0.45)} ${f(L * 0.17)}q${f(-L * 0.05)} ${f(L * 0.03)} ${f(-L * 0.06)} ${f(L * 0.08)}" stroke="${shades[0]}" stroke-width="${f(L * 0.022)}" stroke-linecap="round" fill="none"/><circle r="${f(L * 0.03)}" fill="url(#st${id})" ${hair}/><path d="M${f(-L * 0.018)} 0h${f(L * 0.036)}" stroke="#000" stroke-opacity=".45" stroke-width="1.5"/></g>`);
  };
  // A comb in tortoiseshell: one spine, the teeth as fine strokes with the light running along them.
  const comb = (x, y, L, rot) => {
    const sh = L * 0.1, n = 34;
    let teeth = '';
    for (let i = 0; i < n; i++) teeth += `M${f(L * (0.04 + (i * 0.92) / n))} ${f(sh)}v${f(sh * (i < n / 2 ? 1.25 : 1.6))}`;
    const shell = color.mix(ink, '#6b3a1e', 0.45);
    return lit(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect width="${f(L)}" height="${f(sh * 1.05)}" rx="${f(sh * 0.4)}" fill="${shell}"/><path d="${teeth}" stroke="${shell}" stroke-width="${f(L * 0.012)}" stroke-linecap="round" fill="none"/><rect width="${f(L)}" height="${f(sh * 1.05)}" rx="${f(sh * 0.4)}" fill="url(#gl${id})"/><path d="M${f(L * 0.03)} ${f(sh * 0.28)}H${f(L * 0.97)}" stroke="#fff" stroke-opacity=".35" stroke-width="${f(sh * 0.12)}" stroke-linecap="round"/></g>`);
  };
  // A straight razor, open: the steel blade with its hollow-ground edge, the scales in lacquer, two pins.
  const razor = (x, y, L, rot) => lit(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0 ${f(-L * 0.035)}H${f(L * 0.5)}Q${f(L * 0.56)} ${f(-L * 0.035)} ${f(L * 0.56)} ${f(L * 0.02)}V${f(L * 0.09)}Q${f(L * 0.3)} ${f(L * 0.1)} ${f(L * 0.06)} ${f(L * 0.05)}L0 ${f(L * 0.02)}Z" fill="url(#st${id})" ${hair}/><path d="M${f(L * 0.06)} ${f(L * 0.045)}Q${f(L * 0.3)} ${f(L * 0.085)} ${f(L * 0.555)} ${f(L * 0.08)}" stroke="#fff" stroke-opacity=".8" stroke-width="1.4" fill="none"/><path d="M${f(L * 0.04)} ${f(-L * 0.02)}H${f(L * 0.5)}" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none"/><g transform="rotate(-150)"><path d="M${f(-L * 0.03)} ${f(-L * 0.04)}H${f(L * 0.54)}q${f(L * 0.05)} 0 ${f(L * 0.05)} ${f(L * 0.04)}t${f(-L * 0.05)} ${f(L * 0.04)}H${f(-L * 0.03)}q${f(-L * 0.03)} 0 ${f(-L * 0.03)} ${f(-L * 0.04)}t${f(L * 0.03)} ${f(-L * 0.04)}Z" fill="${shades[4]}"/><path d="M${f(-L * 0.03)} ${f(-L * 0.04)}H${f(L * 0.54)}q${f(L * 0.05)} 0 ${f(L * 0.05)} ${f(L * 0.04)}t${f(-L * 0.05)} ${f(L * 0.04)}H${f(-L * 0.03)}q${f(-L * 0.03)} 0 ${f(-L * 0.03)} ${f(-L * 0.04)}t${f(L * 0.03)} ${f(-L * 0.04)}Z" fill="url(#gl${id})" ${hair}/><path d="M0 ${f(-L * 0.022)}H${f(L * 0.52)}" stroke="#fff" stroke-opacity=".4" stroke-width="${f(L * 0.008)}" stroke-linecap="round"/><circle cx="${f(L * 0.55)}" r="${f(L * 0.012)}" fill="url(#st${id})"/></g><circle r="${f(L * 0.014)}" fill="url(#st${id})" ${hair}/></g>`);
  // A shaving brush standing: a lacquered handle and a knot of badger hair, light at the tips, dark at the root.
  const brush = (x, y, s) => {
    let hairs = '';
    for (let i = 0; i < 11; i++) { const a = -0.9 + (i / 10) * 1.8; hairs += `M${f(Math.sin(a) * s * 0.18)} ${f(-s * 0.62)}Q${f(Math.sin(a) * s * 0.34)} ${f(-s * 0.85)} ${f(Math.sin(a) * s * 0.3)} ${f(-s * (1.02 - Math.abs(a) * 0.12))}`; }
    return lit(`<g transform="translate(${f(x)} ${f(y)})"><defs><linearGradient id="kn${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2b221c"/><stop offset=".55" stop-color="#7a6a5a"/><stop offset="1" stop-color="#f1e9dc"/></linearGradient></defs><path d="M${f(-s * 0.2)} ${f(-s * 0.6)}C${f(-s * 0.46)} ${f(-s * 0.8)} ${f(-s * 0.34)} ${f(-s * 1.12)} 0 ${f(-s * 1.12)}S${f(s * 0.46)} ${f(-s * 0.8)} ${f(s * 0.2)} ${f(-s * 0.6)}Z" fill="url(#kn${id})"/><path d="${hairs}" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" fill="none"/><path d="M${f(-s * 0.2)} ${f(-s * 0.62)}h${f(s * 0.4)}l${f(s * 0.04)} ${f(s * 0.2)}c${f(-s * 0.1)} ${f(s * 0.12)} ${f(-s * 0.06)} ${f(s * 0.3)} ${f(s * 0.06)} ${f(s * 0.42)}H${f(-s * 0.3)}c${f(s * 0.12)} ${f(-s * 0.12)} ${f(s * 0.16)} ${f(-s * 0.3)} ${f(s * 0.06)} ${f(-s * 0.42)}Z" fill="${shades[4]}"/><path d="M${f(-s * 0.2)} ${f(-s * 0.62)}h${f(s * 0.4)}l${f(s * 0.04)} ${f(s * 0.2)}c${f(-s * 0.1)} ${f(s * 0.12)} ${f(-s * 0.06)} ${f(s * 0.3)} ${f(s * 0.06)} ${f(s * 0.42)}H${f(-s * 0.3)}c${f(s * 0.12)} ${f(-s * 0.12)} ${f(s * 0.16)} ${f(-s * 0.3)} ${f(s * 0.06)} ${f(-s * 0.42)}Z" fill="url(#gl${id})" ${hair}/><path d="M${f(-s * 0.12)} ${f(-s * 0.5)}c${f(-s * 0.02)} ${f(s * 0.14)} ${f(-s * 0.04)} ${f(s * 0.26)} ${f(-s * 0.12)} ${f(s * 0.36)}" stroke="#fff" stroke-opacity=".45" stroke-width="${f(s * 0.03)}" fill="none" stroke-linecap="round"/></g>`);
  };
  // Warm basalt stones, stacked: each its own dome of dark stone with a soft sheen where the window falls on it.
  const stones = (x, y, s) => {
    let g = '', yy = 0;
    [[1, 0.3], [0.82, 0.27], [0.62, 0.24], [0.42, 0.2]].forEach(([k, t], i) => {
      const rx = s * k * 0.5, ry = s * t * 0.5, cx = (r() - 0.5) * s * 0.06;
      yy -= ry * (i ? 1.55 : 1);
      g += `<ellipse cx="${f(cx)}" cy="${f(yy + ry * 0.75)}" rx="${f(rx * 0.92)}" ry="${f(ry * 0.4)}" fill="#000" opacity=".35" filter="url(#sh${id})"/><ellipse cx="${f(cx)}" cy="${f(yy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${color.mix('#3b3633', p.primary, 0.08)}"/><ellipse cx="${f(cx)}" cy="${f(yy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#rd${id})"/>`;
      yy -= ry * 0.45;
    });
    return `<g transform="translate(${f(x)} ${f(y)})">${g}</g>`;
  };
  // Rolled towels lying on their sides: a cylinder in cotton, its spiral end toward you.
  const towel = (x, y, R, L, tint) => {
    let spiral = '';
    for (let k = 1; k <= 4; k++) spiral += `<circle cx="0" cy="0" r="${f(R * (0.25 + k * 0.17))}" fill="none" stroke="#000" stroke-opacity="${(0.06 + k * 0.02).toFixed(2)}" stroke-width="1.2"/>`;
    return lit(`<g transform="translate(${f(x)} ${f(y)})"><defs><linearGradient id="tw${id}${f(x)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.mix(tint, '#ffffff', 0.5)}"/><stop offset=".5" stop-color="${tint}"/><stop offset="1" stop-color="${color.mix(tint, '#000000', 0.22)}"/></linearGradient></defs><rect x="0" y="${f(-R)}" width="${f(L)}" height="${f(R * 2)}" fill="url(#tw${id}${f(x)})"/><circle r="${f(R)}" fill="${color.mix(tint, '#ffffff', 0.2)}" ${hair}/>${spiral}<path d="M${f(R * 0.2)} ${f(-R * 0.15)}a${f(R * 0.25)} ${f(R * 0.25)} 0 1 1 ${f(-R * 0.3)} ${f(R * 0.3)}" stroke="#000" stroke-opacity=".25" stroke-width="1.4" fill="none"/></g>`);
  };
  // Tattoo ink: a squat bottle with a dropper cap, the ink nearly black with the member's shade at its edges.
  const inkBottle = (x, y, bw, fill) => {
    const bh = bw * 1.2;
    return lit(`<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.14)}" fill="${color.mix(fill, '#000000', 0.35)}"/><rect x="${f(-bw / 2)}" y="${f(-bh)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.14)}" fill="url(#gl${id})" ${hair}/><path d="M${f(-bw * 0.32)} ${f(-bh * 0.85)}v${f(bh * 0.7)}" stroke="#fff" stroke-opacity=".5" stroke-width="${f(bw * 0.06)}" stroke-linecap="round"/><path d="M${f(-bw * 0.2)} ${f(-bh)}h${f(bw * 0.4)}l${f(-bw * 0.08)} ${f(-bw * 0.5)}h${f(-bw * 0.24)}Z" fill="${ivory}" ${hair}/><path d="M${f(-bw * 0.04)} ${f(-bh - bw * 0.5)}l${f(bw * 0.02)} ${f(-bw * 0.22)}l${f(bw * 0.02)} ${f(bw * 0.22)}Z" fill="${ivory}"/></g>`);
  };
  const cap = (x, y, s, fill) => `<g transform="translate(${f(x)} ${f(y)})"><path d="M${f(-s / 2)} 0v${f(-s * 0.6)}h${f(s)}v${f(s * 0.6)}Z" fill="${ivory}" ${hair}/><ellipse cy="${f(-s * 0.6)}" rx="${f(s / 2)}" ry="${f(s * 0.18)}" fill="${fill}"/><ellipse cx="${f(-s * 0.12)}" cy="${f(-s * 0.64)}" rx="${f(s * 0.14)}" ry="${f(s * 0.05)}" fill="#fff" opacity=".4"/></g>`;
  // A pair of strip lashes on the card, each lash its own fine curve; brushed-steel tweezers beside them.
  const lashes = (x, y, s, flip) => {
    let d = '';
    for (let i = 0; i <= 30; i++) { const t = i / 30, bx = s * (t - 0.5), by = -Math.sin(t * Math.PI) * s * 0.08, len = s * (0.12 + Math.sin(t * Math.PI) * 0.14 + r() * 0.03); d += `M${f(bx)} ${f(by)}q${f(len * 0.1)} ${f(-len * 0.7)} ${f(len * (0.45 + t * 0.3))} ${f(-len)}`; }
    return lit(`<g transform="translate(${f(x)} ${f(y)})${flip ? ' scale(-1 1)' : ''}"><path d="${d}" stroke="${ink}" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M${f(-s / 2)} 0Q0 ${f(-s * 0.18)} ${f(s / 2)} 0" stroke="${ink}" stroke-width="${f(s * 0.022)}" fill="none" stroke-linecap="round"/></g>`);
  };
  const tweezers = (x, y, L, rot) => lit(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0 ${f(-L * 0.02)}L${f(L)} ${f(-L * 0.05)}L${f(L)} ${f(-L * 0.03)}L0 ${f(L * 0.012)}Z" fill="url(#st${id})" ${hair}/><path d="M0 ${f(L * 0.012)}L${f(L)} ${f(L * 0.05)}L${f(L)} ${f(L * 0.07)}L0 ${f(L * 0.035)}Z" fill="url(#st${id})" ${hair}/><path d="M${f(L * 0.1)} ${f(-L * 0.018)}L${f(L * 0.9)} ${f(-L * 0.042)}" stroke="#fff" stroke-opacity=".7" stroke-width="1" fill="none"/></g>`);
  const card = (x, y, cw, chh, rot) => `<g transform="rotate(${f(rot)} ${f(x + cw / 2)} ${f(y + chh / 2)})"><rect x="${f(x + cw * 0.02)}" y="${f(y + chh * 0.025)}" width="${f(cw)}" height="${f(chh)}" fill="#000" opacity=".14" filter="url(#sh${id})"/><rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(chh)}" fill="${ivory}"/><rect x="${f(x + cw * 0.05)}" y="${f(y + chh * 0.05)}" width="${f(cw * 0.9)}" height="${f(chh * 0.9)}" fill="none" stroke="${color.mix(ivory, ink, 0.18)}" stroke-width="1.5"/></g>`;

  let body = W.body;
  const scene = slot.slot === 'hero' || slot.slot === 'g1' || slot.slot === 'about';
  if (!kind) {
    // The open door: a plaster arch in the wall, the room lit warm beyond it, the door leaf swung in with its panels,
    // and the room's light falling out across the floor.
    const dw = w * 0.44, dx = (w - dw) / 2, fy = h * 0.84, top = h * 0.2;
    const arch = `M${f(dx)} ${f(fy)}V${f(top + dw / 2)}A${f(dw / 2)} ${f(dw / 2)} 0 0 1 ${f(dx + dw)} ${f(top + dw / 2)}V${f(fy)}Z`;
    const leaf = color.mix(ink, p.primary, 0.22);
    const lx = dx + dw * 0.06, ly = top + dw * 0.5;
    body += `<defs><radialGradient id="rm${id}" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#fff3df"/><stop offset=".6" stop-color="${color.mix(W.wall, '#fff1dc', 0.6)}"/><stop offset="1" stop-color="${color.mix(W.wall, '#000000', 0.18)}"/></radialGradient><linearGradient id="lf${id}" x1="0" x2="1"><stop offset="0" stop-color="${color.mix(leaf, '#000000', 0.3)}"/><stop offset="1" stop-color="${leaf}"/></linearGradient></defs>`;
    body += `<rect y="${f(fy)}" width="${w}" height="${f(h - fy)}" fill="${color.mix(W.wall, '#000000', 0.12)}"/><path d="M${f(dx)} ${f(fy)}h${f(dw)}l${f(w * 0.16)} ${f(h - fy)}H${f(dx - w * 0.1)}Z" fill="#fff3df" opacity=".55"/>`;
    body += `<path d="${arch}" fill="url(#rm${id})"/><path d="M${f(dx + dw * 0.3)} ${f(fy)}h${f(dw * 0.6)}" stroke="#000" stroke-opacity=".12" stroke-width="2"/><path d="${arch}" fill="none" stroke="${color.mix(W.wall, '#000000', 0.22)}" stroke-width="${f(m * 0.014)}"/><path d="${arch}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" transform="translate(${f(m * 0.008)} 0)"/>`;
    body += shadow(`<path d="M${f(lx)} ${f(fy)}V${f(ly)}L${f(dx - dw * 0.2)} ${f(ly - dw * 0.12)}V${f(fy + h * 0.035)}Z" fill="#000"/>`, m * 0.03, m * 0.01, 0.3);
    body += `<path d="M${f(lx)} ${f(fy)}V${f(ly)}L${f(dx - dw * 0.2)} ${f(ly - dw * 0.12)}V${f(fy + h * 0.035)}Z" fill="url(#lf${id})"/><path d="M${f(lx - dw * 0.05)} ${f(ly + (fy - ly) * 0.1)}V${f(ly + (fy - ly) * 0.46)}L${f(dx - dw * 0.15)} ${f(ly + (fy - ly) * 0.4)}V${f(ly + (fy - ly) * 0.04)}ZM${f(lx - dw * 0.05)} ${f(ly + (fy - ly) * 0.56)}V${f(fy - (fy - ly) * 0.06)}L${f(dx - dw * 0.15)} ${f(fy - (fy - ly) * 0.02)}V${f(ly + (fy - ly) * 0.52)}Z" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/><path d="M${f(lx)} ${f(fy)}V${f(ly)}" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><circle cx="${f(dx - dw * 0.13)}" cy="${f(ly + (fy - ly) * 0.5)}" r="${f(m * 0.01)}" fill="url(#st${id})" ${hair}/>`;
    return Art.svgDoc(w, h, defs, body);
  }
  if (scene) {
    const cw = w * 0.78, chh = h * 0.52, x = (w - cw) / 2, y = h * 0.34, cx = w / 2;
    body += card(x, y, cw, chh, -3 + r() * 2);
    if (kind === 'nails') {
      const cy = y + chh * 0.88, tw = w * 0.1, th = h * 0.2;
      for (let i = 0; i < 5; i++) body += tip(cx + (i - 2) * tw * 1.25, cy - Math.abs(i - 2) * th * 0.08, tw, th, (i - 2) * 11, shades[i]);
      body += polish(w * 0.8, y + chh * 0.08, w * 0.15, shades[1]);
    } else if (kind === 'hair') {
      body += comb(x + cw * 0.1, y + chh * 0.72, cw * 0.78, -9);
      body += shears(x + cw * 0.48, y + chh * 0.3, cw * 0.7, -16);
    } else if (kind === 'barber') {
      body += razor(x + cw * 0.4, y + chh * 0.72, cw * 0.62, -6);
      body += brush(x + cw * 0.8, y + chh * 0.5, cw * 0.24);
    } else if (kind === 'beauty') {
      body += lashes(cx - cw * 0.23, y + chh * 0.46, cw * 0.34, false) + lashes(cx + cw * 0.23, y + chh * 0.46, cw * 0.34, true);
      body += tweezers(x + cw * 0.16, y + chh * 0.78, cw * 0.66, -4);
    } else if (kind === 'spa') {
      body += towel(x + cw * 0.5, y + chh * 0.64, chh * 0.16, cw * 0.4, ivory) + towel(x + cw * 0.58, y + chh * 0.34, chh * 0.15, cw * 0.36, shades[3]);
      body += stones(x + cw * 0.26, y + chh * 0.86, cw * 0.36);
    } else {
      [0, 1, 2].forEach((i) => { body += inkBottle(x + cw * (0.24 + i * 0.26), y + chh * (0.6 + (i % 2) * 0.05), cw * 0.19, [shades[4], shades[0], '#1a1a1a'][i]); });
      [0, 1, 2, 3].forEach((i) => { body += cap(x + cw * (0.2 + i * 0.2), y + chh * 0.88, cw * 0.1, [shades[1], '#141414', shades[2], shades[0]][i]); });
    }
    return Art.svgDoc(w, h, defs, body);
  }
  // The gallery: one thing at a time, big; the last frame is the studio's own product in its dropper bottle.
  const one = slot.slot === 'g2', two = slot.slot === 'g3';
  if (!one && !two) body += kind === 'nails' ? polish(w * 0.5, h * 0.84, w * 0.36, shades[1]) + tip(w * 0.2, h * 0.88, w * 0.1, h * 0.14, -70, shades[2]) : kind === 'tattoo' ? inkBottle(w * 0.42, h * 0.84, w * 0.3, shades[4]) + cap(w * 0.76, h * 0.86, w * 0.12, shades[1]) : dropper(w * 0.5, h * 0.84, w * 0.3, shades[1]);
  else if (kind === 'nails') {
    if (one) body += tip(w / 2, h * 0.84, w * 0.36, h * 0.7, -8 + r() * 6, shades[1]);
    else for (let i = 0; i < 5; i++) { const x = w * (0.18 + i * 0.16), y = h * (0.88 - (i % 2) * 0.05); body += `<rect x="${f(x - w * 0.012)}" y="${f(y - h * 0.02)}" width="${f(w * 0.024)}" height="${f(h * 0.3)}" fill="${color.mix(ivory, ink, 0.12)}"/>` + tip(x, y, w * 0.12, h * 0.26, 0, shades[i]); }
  } else if (kind === 'hair') body += one ? shears(w * 0.56, h * 0.5, w * 0.8, -40) : comb(w * 0.12, h * 0.5, w * 0.76, -18);
  else if (kind === 'barber') body += one ? razor(w * 0.16, h * 0.58, w * 0.8, -20) : brush(w * 0.5, h * 0.86, w * 0.44);
  else if (kind === 'beauty') body += one ? lashes(w * 0.5, h * 0.58, w * 0.7, false) : tweezers(w * 0.14, h * 0.6, w * 0.76, -24);
  else if (kind === 'spa') body += one ? stones(w * 0.5, h * 0.86, w * 0.6) : towel(w * 0.3, h * 0.66, h * 0.13, w * 0.6, ivory) + towel(w * 0.34, h * 0.4, h * 0.12, w * 0.56, shades[3]);
  else body += one ? [0, 1, 2].map((i) => cap(w * (0.25 + i * 0.25), h * 0.8, w * 0.18, [shades[1], '#141414', shades[0]][i])).join('') : inkBottle(w * 0.5, h * 0.84, w * 0.34, shades[0]);
  return Art.svgDoc(w, h, defs, body);
}

// On a mouse, a small arched photo follows the pointer along the price menu.

const CSS = `
${HEAD_CSS}
h1,h2,h3{font-weight:400;letter-spacing:-.02em}
/* after hours: espresso and lamplight, ivory type; the same hairlines and arches */
html[data-theme="dark"]{--ink:#f2e9df}
html[data-theme="dark"] .contact-card{background:var(--surface-2)}
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
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(2rem,4vw,5rem)}}
.hero h1{font-size:clamp(3.6rem,1.3rem + 7vw,8.8rem);line-height:1.12;letter-spacing:-.045em}
.hero h1.long{font-size:clamp(2.9rem,1.2rem + 5.4vw,6.8rem);line-height:1.12}
.hero .lead{margin-top:clamp(1.5rem,1rem + 1.5vw,2.25rem);max-width:31rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-media{position:relative;justify-self:center;width:min(100% - 1.4rem,29rem)}
@media (min-width:60rem){.hero-media{justify-self:end;width:min(100% - 1.4rem,34rem)}}
/* the one neon line on the page: a keyline around the arch, set in once the photo has opened */
.arch-key{position:absolute;inset:-.7rem;border:1px solid var(--neon);border-radius:999px 999px 8px 8px;pointer-events:none}
html.m .arch-key{animation:atKey 1.6s cubic-bezier(.16,1,.3,1) 1.4s both}
@keyframes atKey{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
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
.strip img{width:100%;height:100%;object-fit:cover}
/* walking past arched windows: each photo shifts inside its frame at its own depth as the row is scrubbed by */
html.m .strip img{transform:translate3d(calc((var(--p,0) - var(--k,0)) * -8%),0,0) scale(1.18)}
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
.contact-card{max-width:46rem;padding:clamp(1.75rem,1rem + 3vw,3.75rem) clamp(1.25rem,.5rem + 3vw,3.5rem);background:color-mix(in srgb,#fffaf2 60%,var(--bg));border:1px solid var(--ink);outline:1px solid var(--line);outline-offset:-.6rem}
@media (min-width:60rem){.at-ftr{padding-bottom:3rem}}
.contact-head{display:grid;gap:1rem;justify-items:center;margin-bottom:clamp(1.75rem,1rem + 2vw,2.75rem);text-align:center}
.contact-head .lead{max-width:30rem}
.contact .form-note{text-align:center}
.contact .field input,.contact .field select,.contact .field textarea{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding-inline:0}
.contact .field input:focus,.contact .field select:focus,.contact .field textarea:focus{border-bottom-color:var(--ink);box-shadow:none}
.menu-panel li a{font-weight:400;font-size:1.9rem;letter-spacing:-.03em}
.menu-panel{min-height:calc(100svh - 4.25rem);overflow-y:auto}
body.has-bar .menu-panel>.btn{display:none}
.at-ftr{padding-block:clamp(3.5rem,2.5rem + 3vw,6rem) 6.5rem;background:var(--bg);text-align:center;border-top:1px solid var(--line)}
.at-ftr-in{display:grid;justify-items:center;gap:.7rem}
.at-ftr-name{margin-bottom:.6rem;font-family:var(--font-display);font-size:clamp(2.4rem,1.6rem + 3vw,4rem);font-style:italic;line-height:1.1;letter-spacing:-.03em}
.at-ftr-line{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.3rem .8rem;color:var(--muted)}
.at-ftr-line a{color:var(--ink);text-decoration-color:var(--line)}
.at-dot{width:.25rem;height:.25rem;border-radius:50%;background:currentColor;opacity:.6}
.at-ftr-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:.2rem 1.6rem;margin-top:1.4rem;padding-top:1.4rem;border-top:1px solid var(--line)}
.at-ftr-nav a{display:inline-block;padding:.55rem 0;font-size:.74rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.at-ftr-nav a:hover{color:var(--ink)}
.at-ftr-c{margin-top:.6rem;font-size:.8rem;color:var(--muted)}
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
  choreo: { intro: 'unfold', alive: ['drift'], scroll: 'scrub', pace: 'calm', look: 'editorial, slow and soft' },
  modes: ['light', 'dark'],
  tokens,
  slots,
  nav,
  render,
  art,
};
