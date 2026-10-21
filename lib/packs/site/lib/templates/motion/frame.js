// Frame (animated, portfolio): for photographers, editors and designers, the work first.
//   Object:   the print and the contact sheet it came from. The hero is two prints from the sheet hanging to dry on the
//             darkroom line; the work is the contact sheet itself, every frame on the dark film base with its number in
//             the margin and its caption under it, the pick circled in grease pencil. Until the member adds photos each
//             frame is drawn to its caption (motifsFor: a coffee bag, a set table, a bowl on the wheel, a coat on the
//             rail...), never the same motif twice, and the about shows the member's tool by kind (toolOf).
//   Material: darkroom paper and film stock: gallery white, film-base black, 1px rules. Three voices: condensed poster
//             caps for the name only, a plain grotesk for the section heads, mono for everything the lab would write.
//   One move: the print is exposed. The name is printed onto the page word by word under the enlarger, slowly, and the
//             print comes up in contrast as the light hits it (choreo intro 'stamp', pace calm).
//   Pop:      the member's colour is the grease pencil: the loop drawn around the pick on the contact sheet, and the
//             underline of the link you point at. No line under the name.
// At rest the prints lean toward the pointer and sway a little with the scroll. The one scroll moment is the contact
// sheet: as it crosses the screen, each frame develops from blank paper in order, then the grease pencil circles the
// pick (backwards when scrolling up). Clients are credits in the about, never a strip. JavaScript off and reduced
// motion: the complete, still page, every frame developed and the pick circled. Motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, REVIEWS_CSS, esc } = require('../shared');

const id = 'frame';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f1efea', 0.85), dark: color.mix(color.mix(p.ink, p.primary, 0.12), '#0a0a0a', 0.72) };
}

function frameCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(9, Math.max(3, n)) : 3;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const n = frameCount(c);
  const out = [{ slot: 'hero', file: 'hero.jpg', w: 1600, h: 1100, style: 'sweep', alt: c.profile.hero || ((c.work || [])[0] ? `${c.work[0].title}, a print` : `${c.name}, a print`) }];
  for (let i = 0; i < n; i++) {
    const piece = (c.work || [])[i];
    const alt = piece ? [piece.title, piece.detail].filter(Boolean).join(', ') : g[i % Math.max(1, g.length)] || `${c.name}, recent work`;
    out.push({ slot: `w${i + 1}`, file: `work-${i + 1}.jpg`, w: 1500, h: 1000, style: 'tile', alt });
  }
  out.push({ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'at work'}` : `${c.name} at work` });
  return out;
}

// The about after the lead: the member's own words, less any line that only restates the hero ("X is a Y in Z", "reach
// me directly at"). The about section (and its nav link) drops out when nothing is left to say.
const sentencesOf = (t) => String(t || '').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
function aboutRest(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const who = [c.name, c.owner].filter(Boolean).map(lw);
  const restates = (t) => (who.some((w) => lw(t).includes(w)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  const own = sentencesOf(c.aboutParas[0]);
  const rest = own.length ? [own.slice(1).join(' '), ...c.aboutParas.slice(1)] : c.aboutParas;
  return rest.map((p) => sentencesOf(p).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}
const hasAbout = (c) => aboutRest(c).length > 0 || (c.clients && c.clients.length > 0);

function nav(c) {
  return [
    { label: 'Work', href: '#work' },
    c.services.length || c.included.length ? { label: 'Services', href: '#services' } : null,
    hasAbout(c) && { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The name split on the server into words (so nothing reflows when the intro starts).
function headParts(t) {
  return String(t || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

function detailOf(s) {
  const blurb = String(s.blurb || '');
  if (!s.duration) return blurb;
  if (!blurb) return s.duration;
  return `${s.duration}, ${/^[A-Z][a-z]/.test(blurb) && !/^I\b/.test(blurb) ? blurb.charAt(0).toLowerCase() + blurb.slice(1) : blurb}`;
}

const num = (i) => String(i + 1).padStart(2, '0');
// The grease pencil loop, drawn by hand around the pick (it overshoots where it closes, the way a pencil does).
const GREASE = '<svg class="grease" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" vector-effect="non-scaling-stroke" d="M14 24C26 4 78 0 93 22C104 42 98 82 62 95C28 104 0 86 3 54C5 36 16 22 34 14"/></svg>';

// The footer is the film's own edge: sprocket holes along it, the name, and the lab's edge print in mono (what, where,
// the pages, how to reach), with the year. Legal links and the motion switch follow it.
function footer(c) {
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  const edge = [c.whatShort, c.online ? '' : c.city].filter(Boolean).map(esc).join(' / ');
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('');
  return `<footer class="fr-ftr">
<div class="wrap fr-ftr-in">
<p class="fr-ftr-name">${esc(c.name)}</p>
${edge ? `<p class="mono fr-ftr-edge">${edge}</p>` : ''}
${links ? `<nav aria-label="Footer"><ul class="mono fr-ftr-nav">${links}</ul></nav>` : ''}
${reach ? `<p class="mono fr-ftr-reach">${reach}</p>` : ''}
${P.socials(c, { cls: 'fr-ftr-social', size: 18 })}
<p class="mono fr-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div>
</footer>`;
}

function render(c) {
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const n = frameCount(c);
  const work = c.work || [];
  const mag = (html) => html.replace('<a ', '<a data-mag ');
  // The member's own first line about the work is the lead; the about keeps the rest. Without one, the copy's line.
  const own = sentencesOf(c.aboutParas[0]);
  const people = c.profile.people || 'clients';
  const lead = own.length ? own[0] : c.audience ? c.heroSub : c.heroSub.replace(` for ${people},`, ',').replace(` for ${people}.`, '.');
  const label = [c.whatShort, c.online ? '' : c.city].filter(Boolean).join(', ');

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
<h1 class="name" id="hero-title" data-ci="head">${headParts(c.name)}</h1>
${label ? `<p class="mono role">${esc(label)}</p>` : ''}
<p class="lead">${esc(lead)}</p>
<div class="ctas" data-ci="then" data-ci-from="fade">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg') : ''}</div>
</div>
<figure class="hero-print"><div class="lean" data-alive="0.5"><div class="shot" data-ci="subject">${P.img(c, 'hero', { eager: true })}</div></div></figure>
</div>
</section>`;

  // The contact sheet: every frame on the film base, numbered in the margin, captioned under it; the first is the pick.
  const frames = [];
  for (let i = 0; i < n; i++) {
    const piece = work[i];
    const pick = i === 0 && !!piece;
    frames.push(`<li class="fr${pick ? ' pick' : ''}" data-sc-part style="--i:${i}">
<div class="fr-shot"><div class="fr-in">${P.img(c, `w${i + 1}`, { eager: false })}</div><span class="fr-dev" aria-hidden="true"></span>${pick ? GREASE : ''}</div>
<p class="mono fr-cap"><span class="fr-n">${num(i)}${pick ? '<span class="sr-only"> (the pick)</span>' : ''}</span>${piece ? `<span class="fr-t">${esc(piece.title)}</span>${piece.detail ? `<span class="fr-d">${esc(piece.detail)}</span>` : ''}${piece.href ? `<a class="fr-link" href="${esc(piece.href)}">${esc(piece.linkLabel || 'See it')}${icon('arrowUpRight', { size: 14 })}</a>` : ''}` : ''}</p>
</li>`);
  }
  const more = c.socials.instagram ? ['instagram', 'Instagram'] : c.socials.tiktok ? ['tiktok', 'TikTok'] : c.socials.youtube ? ['youtube', 'YouTube'] : null;
  const workSec = `<section class="sec sheet-sec" id="work" aria-labelledby="work-title" data-sc style="--n:${n}">
<div class="wrap">
<div class="sheet-head"><h2 class="mono sheet-h" id="work-title">Contact sheet, ${num(n - 1)} frames</h2>${more ? `<a class="mono more" href="${esc(c.socials[more[0]])}">${icon(more[0], { size: 16 })}More on ${more[1]}${icon('arrowUpRight', { size: 14 })}</a>` : ''}</div>
<ol class="sheet">
${frames.join('\n')}
</ol>
</div>
</section>`;

  const services = c.services.length || c.included.length
    ? `<section class="sec svc-sec" id="services" aria-labelledby="services-title">
<div class="wrap svc-grid">
<h2 class="h2" id="services-title">${c.services.length ? 'Rates' : "What's included"}</h2>
<div>
${c.services.length ? `<ul class="svc">${c.services.map((s, i) => `<li><span class="mono svc-n">${num(i)}</span><div class="svc-body"><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc(detailOf(s))}</p>` : ''}</div>${s.priceText ? `<span class="svc-price">${esc(s.priceText)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${c.included.length ? `<div class="incl-box"><h3 class="mono">${c.services.length ? 'Every project includes' : 'With every project'}</h3><ol class="incl">${c.included.map((x, i) => `<li><span class="mono incl-n" aria-hidden="true">${num(i)}</span><span>${esc(x)}</span></li>`).join('')}</ol></div>` : ''}
${mag(P.button(c.primary, 'btn btn-primary btn-lg svc-cta'))}
</div>
</div>
</section>`
    : '';

  const aboutParas = aboutRest(c);
  const credits = c.clients && c.clients.length ? `<p class="mono credits"><span>Clients</span> ${c.clients.map(esc).join(', ')}</p>` : '';
  const about = hasAbout(c) ? `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<figure class="about-media"><div class="shot"><div class="shot-in">${P.img(c, 'portrait', { cls: 'about-img' })}</div></div>${c.city && !c.online ? `<figcaption class="mono">${esc(person || c.name)}, ${esc(c.city)}</figcaption>` : ''}</figure>
<div class="about-copy">
<h2 class="mono about-h" id="about-title">${esc(person ? `About ${person}` : `About ${c.name}`)}</h2>
${aboutParas.map((p, i) => `<p${i === 0 ? ' class="about-first"' : ''}>${esc(p)}</p>`).join('\n')}
${credits}
</div>
</div>
</section>` : '';

  // How a shoot runs: the member's steps as frames of a strip, numbered in mono. Not a roadmap.
  const how = c.steps.length >= 2
    ? `<section class="sec how" aria-labelledby="how-title"><div class="wrap"><h2 class="h2 how-h" id="how-title">${/^(photo|bizphoto|video)$/.test(c.profile.id) ? 'How a shoot runs' : 'How a project runs'}</h2><ol class="strip">${c.steps.map((s, i) => `<li><span class="mono strip-n">${num(i)}</span><h3>${esc(s.title)}</h3>${s.body ? `<p>${esc(s.body)}</p>` : ''}</li>`).join('')}</ol></div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="sec rv-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="h2" id="reviews-title">Kind words</h2>
<div class="quotes">${c.reviews.map((r) => `<figure class="q"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption class="mono">${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';
  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="mono about-h" id="faq-title">Questions</h2><dl class="qa">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const projectTypes = c.services.length > 1 ? { name: 'project', label: 'What do you need?', type: 'select', options: c.services.map((s) => s.name), half: true } : null;
  const fields = [
    { ...P.FIELD_PRESETS.name, half: true },
    { ...P.FIELD_PRESETS.email, half: true },
    { ...P.FIELD_PRESETS.company, label: 'Business or brand' },
    projectTypes || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' },
    projectTypes ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null,
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true },
  ].filter(Boolean);
  // The contact: the ways to reach the member as frames on a strip of film, then the job ticket, full width under it.
  const ways = [
    c.email && ['Email', `mailto:${c.email}`, c.email],
    c.booking && ['Book', c.booking.href, String(c.booking.href).replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')],
    c.phone && ['Call', c.phone.href, c.phone.display],
    more && [more[1], c.socials[more[0]], `@${String(c.socials[more[0]]).replace(/\/+$/, '').split('/').pop().replace(/^@/, '')}`],
  ].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap">
<div class="ct-head">
<h2 class="h2 contact-h" id="contact-title">Send the brief</h2>
${c.promise ? `<p class="promise">${esc(c.promise)}</p>` : ''}
</div>
${ways.length ? `<ol class="ct-strip">${ways.map(([k, href, v], i) => `<li><span class="mono ct-n" aria-hidden="true">${num(i)}</span><span class="mono ct-k">${esc(k)}</span><a class="ct-v" href="${esc(href)}">${esc(v)}</a></li>`).join('')}</ol>` : ''}
<div class="brief">
<p class="mono brief-h"><span>Job ticket</span><span>${esc(c.name)}</span></p>
${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}`, note: false })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-fr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, workSec, services, how, about, reviews, faq, contact, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '88rem' } };
}

// ---- the placeholders, drawn: each frame of the contact sheet is a photograph of what its caption names (a coffee bag
// and cup, a table set from above, a bowl on the wheel, a coat on the rail, a grocer's shelf, a product on a plinth, a
// studio set, a desk of proofs), else a neutral photograph (window light, a landscape, a still life), never the same
// motif twice on one sheet. Duotone in the member's ink and paper, lit from the upper left, with grain. No text, no
// people. The hero is two of those prints drying on the line; the about is the member's tool on the table by kind.
function tones(p) {
  const dark = color.mix(p.ink, '#0d0d0d', 0.5), light = color.mix(p.paper, '#ffffff', 0.55);
  return { dark, light, t: (k) => color.mix(dark, light, Math.max(0, Math.min(1, k))) };
}
// Motifs by the words of the caption, most specific first; the neutral ones fill whatever is left.
const MOTIFS = [
  ['coffee', /\b(coffee|roast\w*|caf[eé]|espresso|tea)\b/],
  ['ceramic', /\b(ceramic\w*|potter\w*|clay|kiln)\b/],
  ['coat', /\b(outerwear|coats?|jackets?|apparel|fashion|clothing|lookbook|knitwear)\b/],
  ['grocer', /\b(grocer\w*|market|shop|store|deli|produce|pantry)\b/],
  ['table', /\b(restaurant\w*|table|dinner|food|menu|chef|kitchen|supper|bakery|dish\w*)\b/],
  ['product', /\b(product\w*|bottles?|skincare|beauty|cosmetic\w*|packag\w*|perfume|candles?|unboxing)\b/],
  ['desk', /\b(brand identity|identity|poster|illustration|website|social kit|type|book|print|logo)\b/],
  ['studio', /\b(portraits?|headshots?|people|team|family|talking head)\b/],
  ['land', /\b(travel|landscape|outdoors?|mountains?|hike|coast|sea|wild\w*)\b/],
  ['still', /\b(still life|flowers?|vases?|objects?)\b/],
  ['window', /\b(personal|quiet|light|home|interior|hours)\b/],
];
const NEUTRAL = ['window', 'land', 'still', 'studio', 'desk'];
function motifsFor(c, n) {
  const used = new Set(), out = [];
  const work = c.work || [];
  for (let i = 0; i < n; i++) {
    const piece = work[i];
    const s = piece ? `${piece.title} ${piece.detail || ''}`.toLowerCase() : '';
    const hit = s && MOTIFS.find(([k, re]) => !used.has(k) && re.test(s));
    out.push(hit ? hit[0] : null);
    if (hit) used.add(hit[0]);
  }
  const pool = (c.profile && c.profile.id === 'design' ? ['desk', ...NEUTRAL] : NEUTRAL).concat(MOTIFS.map((m) => m[0]));
  return out.map((k) => {
    if (k) return k;
    const free = pool.find((x) => !used.has(x)) || NEUTRAL[0];
    used.add(free);
    return free;
  });
}
// One photograph, w x h, drawn in a 1500 x 1000 stage that is scaled to cover the print and centred.
function photo(kind, w, h, p, r, uid, Art) {
  const T = tones(p), t = T.t;
  const f = (v) => v.toFixed(1);
  const k = Math.max(w / 1500, h / 1000) * (w / h < 1 ? 1.25 : 1);
  const ox = (w - 1500 * k) / 2, oy = (h - 1000 * k) / 2;
  const u = (id) => `url(#${id}${uid})`;
  let defs = `<filter id="gr${uid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" seed="${Math.floor(r() * 90)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0"/></filter>
<filter id="bl${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
<linearGradient id="wa${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t(0.74)}"/><stop offset="1" stop-color="${t(0.5)}"/></linearGradient>
<linearGradient id="tb${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t(0.84)}"/><stop offset="1" stop-color="${t(0.6)}"/></linearGradient>
<linearGradient id="cy${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t(0.55)}"/><stop offset=".3" stop-color="${t(0.95)}"/><stop offset=".7" stop-color="${t(0.62)}"/><stop offset="1" stop-color="${t(0.38)}"/></linearGradient>
<linearGradient id="cd${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t(0.16)}"/><stop offset=".32" stop-color="${t(0.42)}"/><stop offset=".7" stop-color="${t(0.2)}"/><stop offset="1" stop-color="${t(0.06)}"/></linearGradient>
<linearGradient id="cm${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t(0.34)}"/><stop offset=".3" stop-color="${t(0.72)}"/><stop offset=".7" stop-color="${t(0.46)}"/><stop offset="1" stop-color="${t(0.24)}"/></linearGradient>
<radialGradient id="rd${uid}" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="${t(1)}"/><stop offset="1" stop-color="${t(0.72)}"/></radialGradient>
<radialGradient id="rf${uid}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${t(0.72)}"/><stop offset="1" stop-color="${t(0.22)}"/></radialGradient>
<linearGradient id="sk${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t(0.62)}"/><stop offset="1" stop-color="${t(0.95)}"/></linearGradient>`;
  const sh = (cx, cy, rx, ry, o = 0.4) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${T.dark}" opacity="${o}" filter="${u('bl')}"/>`;
  const hl = (d, o = 0.5, sw = 6) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${sw}" stroke-linecap="round"/>`;
  // The room: a wall with the window's light on it, and the table the thing stands on.
  const room = (ty, light = true) => `<rect x="-400" y="-400" width="2300" height="${ty + 400}" fill="${u('wa')}"/>${light ? `<path d="M880 -60h260l-150 ${ty - 60}h-260ZM1180 -60h200l-150 ${ty - 60}h-200Z" fill="${t(1)}" opacity=".32" filter="${u('bl')}"/>` : ''}<rect x="-400" y="${ty}" width="2300" height="${1400 - ty}" fill="${u('tb')}"/><rect x="-400" y="${ty}" width="2300" height="4" fill="${t(1)}" opacity=".5"/>`;
  let g = '';
  if (kind === 'coffee') {
    g += room(690);
    g += sh(650, 694, 190, 16) + sh(990, 690, 170, 14);
    g += `<path d="M505 690 494 360Q494 334 516 330H724Q746 334 746 360L757 690Z" fill="${u('cm')}"/><path d="M712 334 746 360 757 690H722Z" fill="${t(0.12)}" opacity=".35"/><rect x="510" y="270" width="232" height="66" rx="5" fill="${u('cm')}"/><path d="M510 304H742" stroke="${t(0.15)}" stroke-opacity=".35" stroke-width="3"/><rect x="498" y="288" width="256" height="10" rx="5" fill="${u('cy')}"/>
<circle cx="626" cy="430" r="17" fill="${t(0.3)}" stroke="${t(0.8)}" stroke-width="4"/>${hl('M530 380V660', 0.3, 10)}
<ellipse cx="990" cy="684" rx="160" ry="26" fill="${u('rd')}"/><path d="M890 570Q894 664 945 676H1035Q1086 664 1090 570Z" fill="${u('cy')}"/><path d="M1090 590q46 4 38 44q-8 30-46 24" fill="none" stroke="${t(0.82)}" stroke-width="13"/><ellipse cx="990" cy="570" rx="100" ry="19" fill="${t(0.98)}"/><ellipse cx="990" cy="572" rx="86" ry="14" fill="${t(0.14)}"/><ellipse cx="990" cy="572" rx="86" ry="14" fill="none" stroke="${t(0.42)}" stroke-width="5"/>`;
    [[820, 712, 20], [858, 726, -30], [884, 704, 60], [790, 734, 100], [930, 730, 10]].forEach(([x, y, a]) => {
      g += `<g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="15" ry="10" fill="${t(0.16)}"/><path d="M-11 0q6-4 11 0t11 0" fill="none" stroke="${t(0.45)}" stroke-width="2"/></g>`;
    });
  } else if (kind === 'table') {
    // From above: linen, two plates, a glass, the cutlery and a board of bread.
    g += `<rect x="-400" y="-400" width="2300" height="1800" fill="${u('tb')}"/><path d="M-400 360H1900M760 -400V1400" stroke="${t(0.6)}" stroke-opacity=".35" stroke-width="3"/><path d="M-400 364H1900M764 -400V1400" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>`;
    [[520, 440, 175], [1010, 600, 175]].forEach(([x, y, R], i) => {
      g += `<circle cx="${x + 14}" cy="${y + 20}" r="${R}" fill="${T.dark}" opacity=".35" filter="${u('bl')}"/><circle cx="${x}" cy="${y}" r="${R}" fill="${u('rd')}"/><circle cx="${x}" cy="${y}" r="${R * 0.7}" fill="${t(0.9)}" stroke="${t(0.7)}" stroke-opacity=".6" stroke-width="3"/>`;
      g += i === 0
        ? `${[[-40, -30, 20, 0.28], [30, -40, -40, 0.4], [50, 20, 70, 0.22], [-30, 40, -10, 0.34], [0, 0, 120, 0.18], [-60, 10, 50, 0.45]].map(([dx, dy, rot, tn]) => `<g transform="translate(${x + dx} ${y + dy}) rotate(${rot})"><path d="M-46 0Q0-30 46 0Q0 30-46 0Z" fill="${t(tn)}"/><path d="M-40 0H40" stroke="${t(tn + 0.3)}" stroke-width="3"/></g>`).join('')}${[[24, 52], [-56, -46]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="22" fill="${u('rf')}"/><circle cx="${x + dx - 6}" cy="${y + dy - 7}" r="5" fill="#fff" opacity=".5"/>`).join('')}`
        : `<circle cx="${x}" cy="${y}" r="108" fill="${t(0.72)}"/><circle cx="${x}" cy="${y}" r="92" fill="${u('rf')}"/>${hl(`M${x - 70} ${y - 40}a90 90 0 0 1 60-50`, 0.55, 7)}`;
    });
    g += `<rect x="290" y="300" width="16" height="280" rx="8" fill="${u('cy')}"/>${[0, 1, 2, 3].map((j) => `<rect x="${287 + j * 6}" y="262" width="3" height="54" rx="1.5" fill="${t(0.85)}"/>`).join('')}<rect x="742" y="290" width="18" height="300" rx="9" fill="${u('cy')}"/>
<circle cx="820" cy="290" r="62" fill="${t(0.95)}" opacity=".35" stroke="${t(1)}" stroke-width="4"/><circle cx="820" cy="290" r="44" fill="${t(0.22)}" opacity=".55"/>${hl('M780 262a50 50 0 0 1 40-24', 0.8, 5)}
<g transform="rotate(-8 1240 260)"><rect x="1150" y="190" width="190" height="140" rx="6" fill="${t(0.8)}"/><path d="M1150 260H1340" stroke="${t(0.58)}" stroke-width="3"/></g>
<rect x="1110" y="820" width="330" height="150" rx="16" fill="${u('cm')}"/><ellipse cx="1270" cy="890" rx="120" ry="52" fill="${u('rf')}"/><path d="M1200 870l30 30M1250 860l30 30M1300 862l30 30" stroke="${t(0.78)}" stroke-width="5" stroke-linecap="round"/>`;
  } else if (kind === 'ceramic') {
    // A bowl just thrown on the wheel, wet, the throwing rings still on it; bisque bowls drying on the board behind.
    g += room(760);
    g += `<rect x="120" y="330" width="1260" height="18" fill="${t(0.36)}"/><rect x="120" y="330" width="1260" height="3" fill="#fff" opacity=".35"/>`;
    [220, 420, 980, 1180].forEach((x, i) => {
      const bw = 70 + (i % 2) * 18;
      g += sh(x + 18, 330, bw, 7, 0.3) + `<path d="M${x - bw} ${270 - (i % 2) * 12}Q${x - bw * 0.9} 330 ${x} 330Q${x + bw * 0.9} 330 ${x + bw} ${270 - (i % 2) * 12}Z" fill="${u('cy')}"/><ellipse cx="${x}" cy="${270 - (i % 2) * 12}" rx="${bw}" ry="12" fill="${t(0.88)}"/>`;
    });
    g += sh(760, 776, 360, 26) + `<ellipse cx="750" cy="740" rx="340" ry="74" fill="${t(0.22)}"/><ellipse cx="750" cy="728" rx="310" ry="60" fill="${t(0.1)}"/><ellipse cx="750" cy="700" rx="230" ry="44" fill="${u('cd')}"/><ellipse cx="750" cy="694" rx="230" ry="40" fill="${u('cm')}"/>
<path d="M580 690C548 610 556 540 586 500H914C944 540 952 610 920 690Z" fill="${u('cm')}"/><path d="M586 500C566 560 570 630 600 690" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="16" stroke-linecap="round"/>
${[540, 580, 625].map((y) => `<path d="M${578 - (y - 540) * 0.1} ${y}Q750 ${y + 22} ${922 + (y - 540) * 0.1} ${y}" fill="none" stroke="${t(0.88)}" stroke-opacity=".35" stroke-width="3"/>`).join('')}<ellipse cx="750" cy="500" rx="164" ry="30" fill="${t(0.72)}"/><ellipse cx="750" cy="503" rx="148" ry="23" fill="${t(0.26)}"/>`;
  } else if (kind === 'coat') {
    // A wool coat on a wooden hanger on the rail, a lighter one behind it.
    g += room(900);
    g += `<rect x="150" y="160" width="1200" height="14" rx="7" fill="${u('cy')}"/>`;
    const coat = (x, tone, fill) => `<path d="M${x - 150} 250Q${x} 226 ${x + 150} 250L${x + 236} 330L${x + 260} 860H${x - 260}L${x - 236} 330Z" fill="${fill}"/><path d="M${x - 236} 330L${x - 280} 800L${x - 222} 812L${x - 190} 380Z" fill="${tone}" opacity=".55"/><path d="M${x + 236} 330L${x + 280} 800L${x + 222} 812L${x + 190} 380Z" fill="${T.dark}" opacity=".35"/>`;
    g += `<path d="M1000 300l260 520" stroke="${T.dark}" stroke-opacity=".2" stroke-width="160" filter="${u('bl')}"/>` + coat(1020, t(0.9), u('cy')) + `<path d="M1020 174q-22 0-22 22t22 22v20" fill="none" stroke="${u('cy')}" stroke-width="7"/>`;
    g += `<path d="M700 290l100 600" stroke="${T.dark}" stroke-opacity=".3" stroke-width="220" filter="${u('bl')}"/>` + coat(740, t(0.4), u('cd')) + `<path d="M740 174q-22 0-22 22t22 22v18" fill="none" stroke="${t(0.8)}" stroke-width="7"/><path d="M580 252Q740 220 900 252" fill="none" stroke="${u('cm')}" stroke-width="16" stroke-linecap="round"/>
<path d="M690 244L740 520L790 244" fill="${t(0.28)}"/><path d="M690 244L728 470L660 330Z M790 244L752 470L820 330Z" fill="${t(0.12)}"/><path d="M742 520V860" stroke="${t(0.04)}" stroke-width="3"/>
${[580, 670, 760].map((y) => `<circle cx="760" cy="${y}" r="10" fill="${t(0.5)}"/><circle cx="757" cy="${y - 3}" r="3" fill="#fff" opacity=".5"/>`).join('')}<path d="M570 690h110M800 690h110" stroke="${t(0.04)}" stroke-width="5"/>${hl('M590 340L560 840', 0.12, 20)}`;
  } else if (kind === 'grocer') {
    // The grocer's shelf: jars on the top board, a crate of fruit and a paper bag below.
    g += room(1000, false);
    [430, 720].forEach((y) => { g += `<rect x="100" y="${y}" width="1300" height="26" fill="${u('cm')}"/><rect x="100" y="${y}" width="1300" height="3" fill="#fff" opacity=".4"/>` + sh(750, y + 40, 650, 12, 0.35); });
    [330, 530, 730, 930, 1130].forEach((x, i) => {
      const fill = t(0.18 + (i % 3) * 0.14);
      g += `<rect x="${x - 70}" y="${430 - 200}" width="140" height="200" rx="20" fill="${t(0.9)}" opacity=".35"/><rect x="${x - 62}" y="${430 - 150 + (i % 2) * 20}" width="124" height="${144 - (i % 2) * 20}" rx="14" fill="${fill}"/><rect x="${x - 60}" y="${430 - 226}" width="120" height="30" rx="5" fill="${u('cy')}"/>${hl(`M${x - 46} ${430 - 170}V${430 - 30}`, 0.55, 8)}`;
    });
    g += `<path d="M280 720V575H820V720Z" fill="${u('cm')}"/>${[600, 650].map((y) => `<path d="M280 ${y}H820" stroke="${t(0.2)}" stroke-width="6"/>`).join('')}`;
    for (let i = 0; i < 6; i++) g += `<circle cx="${330 + i * 92}" cy="${566 - (i % 2) * 18}" r="48" fill="${u('rf')}"/>${hl(`M${310 + i * 92} ${546 - (i % 2) * 18}a24 24 0 0 1 22-14`, 0.6, 6)}`;
    g += `<path d="M960 720L975 520H1160L1175 720Z" fill="${u('cy')}"/><path d="M975 520l30-24 30 24 30-24 30 24 30-24 30 24" fill="${t(0.78)}"/>`;
  } else if (kind === 'product') {
    // A bottle on a plinth, the window's light running down its shoulder.
    g += room(860);
    g += `<path d="M520 560H980L1020 600V860H560L520 820Z" fill="${t(0.62)}"/><path d="M520 560H980L1020 600H560Z" fill="${t(0.9)}"/><path d="M980 560L1020 600V860L980 820Z" fill="${t(0.42)}"/>` + sh(770, 590, 150, 12, 0.45);
    g += `<path d="M680 590V330Q680 290 720 280H740V220H800V280H820Q860 290 860 330V590Z" fill="${u('cd')}"/><rect x="728" y="170" width="84" height="64" rx="6" fill="${u('cy')}"/><path d="M728 196H812" stroke="${t(0.3)}" stroke-width="2"/>${hl('M700 340V570', 0.35, 14)}${hl('M836 340V570', 0.12, 5)}<path d="M690 586H850" stroke="#fff" stroke-opacity=".2" stroke-width="3"/>`;
  } else if (kind === 'studio') {
    // A studio set: the paper sweep, a stool on it, the softbox lighting it from the left.
    g += `<rect x="-400" y="-400" width="2300" height="1800" fill="${u('wa')}"/><path d="M-400 760Q750 640 1900 760V1400H-400Z" fill="${u('tb')}"/><ellipse cx="800" cy="560" rx="520" ry="380" fill="${t(1)}" opacity=".32" filter="${u('bl')}"/>`;
    g += sh(820, 850, 170, 18) + `<ellipse cx="800" cy="610" rx="130" ry="26" fill="${u('cm')}"/><path d="M672 612V634A128 26 0 0 0 928 634V612" fill="${t(0.3)}"/>${[[700, 840], [800, 870], [900, 840]].map(([x, y]) => `<path d="M800 640L${x} ${y}" stroke="${u('cy')}" stroke-width="10" stroke-linecap="round"/>`).join('')}<path d="M730 740H870" stroke="${t(0.7)}" stroke-width="7"/>
<path d="M150 220L420 160L450 520L180 560Z" fill="${t(0.18)}"/><path d="M180 240L410 190L436 500L206 535Z" fill="${t(1)}"/><path d="M315 360V900M315 900L210 980M315 900L420 980M315 900V990" stroke="${t(0.2)}" stroke-width="9" stroke-linecap="round"/>`;
  } else if (kind === 'desk') {
    // From above: proofs on the desk, a pencil, a steel rule and three swatch chips.
    g += `<rect x="-400" y="-400" width="2300" height="1800" fill="${u('tb')}"/>`;
    g += `<g transform="rotate(-4 700 500)"><rect x="380" y="200" width="560" height="640" fill="${T.dark}" opacity=".3" filter="${u('bl')}"/><rect x="360" y="180" width="560" height="640" fill="${t(0.96)}"/><rect x="420" y="240" width="440" height="330" fill="${u('rf')}"/></g>
<g transform="rotate(7 1150 500)"><rect x="1010" y="230" width="300" height="420" fill="${t(0.9)}"/><rect x="1050" y="270" width="220" height="220" fill="${t(0.5)}"/></g>
${[0, 1, 2].map((j) => `<rect x="${1020 + j * 110}" y="760" width="92" height="140" rx="6" fill="${t(0.2 + j * 0.28)}"/><rect x="${1020 + j * 110}" y="868" width="92" height="32" fill="${t(0.98)}"/>`).join('')}
<g transform="rotate(-24 300 760)"><rect x="80" y="745" width="420" height="30" fill="${u('cm')}"/><path d="M500 745L560 760L500 775Z" fill="${t(0.82)}"/><path d="M542 755L560 760L542 765Z" fill="${t(0.12)}"/><rect x="60" y="745" width="26" height="30" fill="${t(0.3)}"/></g>
<g transform="rotate(12 760 900)"><rect x="380" y="880" width="760" height="44" fill="${u('cy')}"/><path d="${Array.from({ length: 30 }, (_, j) => `M${400 + j * 24} 880v${j % 5 ? 12 : 22}`).join('')}" stroke="${t(0.25)}" stroke-width="2"/></g>`;
  } else if (kind === 'land') {
    g += `<rect x="-400" y="-400" width="2300" height="1800" fill="${u('sk')}"/><circle cx="1050" cy="330" r="160" fill="${t(1)}" opacity=".6" filter="${u('bl')}"/>`;
    [0.5, 0.6, 0.7].forEach((y0, j) => {
      let d = `M-400 ${f(1000 * (y0 + r() * 0.05))}`;
      for (let i = 1; i <= 5; i++) d += `Q${f(-400 + 460 * (i - 0.5))} ${f(1000 * (y0 - 0.1 + r() * 0.14))} ${f(-400 + 460 * i)} ${f(1000 * (y0 + r() * 0.05))}`;
      g += `<path d="${d}V780H-400Z" fill="${t(0.6 - j * 0.2)}"/>`;
    });
    g += `<rect x="-400" y="780" width="2300" height="620" fill="${t(0.5)}"/><rect x="-400" y="780" width="2300" height="220" fill="${t(0.8)}" opacity=".35"/>${[820, 860, 905].map((y, i) => `<path d="M${880 + i * 30} ${y}h${200 - i * 50}" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`).join('')}`;
  } else if (kind === 'still') {
    g += room(660);
    for (let i = 0; i < 3; i++) {
      const cx = 450 + i * 300 + r() * 40, bw = 120 + r() * 70, bh = 220 + r() * 160, nk = bw * 0.32, top = 660 - bh;
      g += sh(cx + bw * 0.8, 668, bw * 1.2, 12, 0.4);
      g += `<path d="M${f(cx - nk / 2)} ${f(top)}h${f(nk)}c0 ${f(bh * 0.18)} ${f(bw / 2 - nk / 2)} ${f(bh * 0.22)} ${f(bw / 2 - nk / 2)} ${f(bh * 0.55)}c0 ${f(bh * 0.3)} ${f(-bw * 0.1)} ${f(bh * 0.45)} ${f(-bw * 0.18)} ${f(bh * 0.45)}h${f(-bw * 0.64)}c${f(-bw * 0.08)} 0 ${f(-bw * 0.18)} ${f(-bh * 0.15)} ${f(-bw * 0.18)} ${f(-bh * 0.45)}c0 ${f(-bh * 0.33)} ${f(bw / 2 - nk / 2)} ${f(-bh * 0.37)} ${f(bw / 2 - nk / 2)} ${f(-bh * 0.55)}Z" fill="${i === 1 ? u('cd') : u('cy')}"/>`;
      g += hl(`M${f(cx - bw * 0.32)} ${f(top + bh * 0.48)}q${f(-bw * 0.06)} ${f(bh * 0.2)} 0 ${f(bh * 0.4)}`, 0.4, f(bw * 0.06));
    }
  } else {
    // Window light: the panes across the wall and the floor, a chair standing in them.
    g += `<rect x="-400" y="-400" width="2300" height="1100" fill="${t(0.42)}"/><rect x="-400" y="700" width="2300" height="700" fill="${t(0.5)}"/><rect x="-400" y="700" width="2300" height="4" fill="${t(0.7)}"/>
<g fill="${t(1)}" opacity=".7" filter="${u('bl')}"><path d="M700 60h170l-40 280h-170ZM900 60h170l-40 280h-170ZM670 380h170l-40 300h-170ZM870 380h170l-40 300h-170Z"/><path d="M620 710h200l-160 260h-220ZM850 710h200l-160 260h-220Z" opacity=".6"/></g>
<g fill="${t(0.2)}" opacity=".55" filter="${u('bl')}"><ellipse cx="760" cy="420" rx="70" ry="22" transform="rotate(-35 760 420)"/><ellipse cx="860" cy="470" rx="80" ry="20" transform="rotate(25 860 470)"/></g>`;
    g += sh(560, 900, 240, 20, 0.5) + `<path d="M420 520H700L690 552H430Z" fill="${u('cm')}"/><path d="M432 552V900M688 552V900M470 552V860M650 552V860" stroke="${u('cd')}" stroke-width="14" stroke-linecap="round"/><path d="M430 520V200M470 520V210" stroke="${u('cd')}" stroke-width="14" stroke-linecap="round"/><path d="M420 230H480M420 300H480" stroke="${t(0.3)}" stroke-width="16" stroke-linecap="round"/><path d="M425 522H700" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>`;
  }
  const body = `<g transform="translate(${f(ox)} ${f(oy)}) scale(${k.toFixed(4)})">${g}</g><rect width="${w}" height="${h}" filter="url(#gr${uid})"/>`;
  return { defs, body };
}
// What the member works with, on the table under the window, picked by kind: the camera for photographers and video
// makers, the proof and rule for designers, and for everyone else the frame on the wall, its mat cut and empty.
function toolOf(c) {
  const id = (c.profile && c.profile.id) || '';
  if (/^(photo|bizphoto|video|ugc|creator)$/.test(id)) return 'camera';
  if (/^(design|webdesign)$/.test(id)) return 'desk';
  const s = `${c.what || ''} ${c.niche || ''}`.toLowerCase();
  if (/\b(photo\w*|video\w*|film\w*|camera|wedding|ugc)\b/.test(s)) return 'camera';
  if (/\b(design\w*|illustrat\w*|brand\w*|artist)\b/.test(s)) return 'desk';
  return 'mat';
}
function art(slot, { p, c, seed, index, art: Art }) {
  const w = slot.w, h = slot.h;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:${slot.slot}`);
  const cc = c || {};
  const kinds = motifsFor(cc, Math.max(frameCount(cc), 2));
  if (/^w\d+$/.test(slot.slot)) {
    const i = +slot.slot.slice(1) - 1;
    const ph = photo(kinds[i] || NEUTRAL[i % NEUTRAL.length], w, h, p, r, `w${i}`, Art);
    return Art.svgDoc(w, h, ph.defs, ph.body);
  }
  const T = tones(p);
  const paper = color.mix(p.paper, '#ffffff', 0.75);
  if (slot.slot === 'hero') {
    // Two prints from the sheet drying on the line, pegged at the top, a little curled.
    const W = Art.wall({ style: 'sweep', w, h, p, seed, index, quiet: true });
    let defs = `${W.defs}<filter id="psh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(w * 0.01)}"/></filter><linearGradient id="peg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6740"/><stop offset=".4" stop-color="#c9a478"/><stop offset="1" stop-color="#6e5232"/></linearGradient>`;
    let body = W.body;
    const ly = h * 0.12;
    body += `<path d="M0 ${f(ly)}Q${f(w / 2)} ${f(ly + h * 0.03)} ${w} ${f(ly)}" fill="none" stroke="${T.t(0.25)}" stroke-width="2.5"/>`;
    const prints = [
      { x: w * 0.12, pw: w * 0.36, ar: 1.25, kind: kinds[0], rot: -1.2 },
      { x: w * 0.53, pw: w * 0.38, ar: 0.72, kind: kinds[1], rot: 1.4 },
    ];
    prints.forEach((pr, k) => {
      const ph = pr.pw * pr.ar, y = ly + h * 0.025, b = pr.pw * 0.06;
      const iw = pr.pw - b * 2, ih = ph - b * 2;
      // Both prints share one set of tones and grain (the same paper, the same developer).
      const img = photo(pr.kind, Math.round(iw), Math.round(ih), p, r, 'h', Art);
      if (!k) defs += img.defs;
      body += `<g transform="rotate(${f(pr.rot)} ${f(pr.x + pr.pw / 2)} ${f(y)})"><rect x="${f(pr.x + w * 0.01)}" y="${f(y + h * 0.02)}" width="${f(pr.pw)}" height="${f(ph)}" fill="#000" opacity=".22" filter="url(#psh)"/><rect x="${f(pr.x)}" y="${f(y)}" width="${f(pr.pw)}" height="${f(ph)}" fill="${paper}"/><svg x="${f(pr.x + b)}" y="${f(y + b)}" width="${f(iw)}" height="${f(ih)}" viewBox="0 0 ${Math.round(iw)} ${Math.round(ih)}">${img.body}</svg>
<rect x="${f(pr.x + pr.pw / 2 - w * 0.012)}" y="${f(y - h * 0.045)}" width="${f(w * 0.024)}" height="${f(h * 0.085)}" rx="2" fill="url(#peg)"/><path d="M${f(pr.x + pr.pw / 2 - w * 0.012)} ${f(y - h * 0.005)}h${f(w * 0.024)}" stroke="#d9dde2" stroke-width="3"/></g>`;
    });
    return Art.svgDoc(w, h, defs, body);
  }
  if (slot.slot === 'portrait') {
    const tool = toolOf(cc);
    if (tool === 'desk') {
      const ph = photo('desk', w, h, p, r, 'pt', Art);
      return Art.svgDoc(w, h, ph.defs, ph.body);
    }
    const t = T.t;
    let defs = `<linearGradient id="pw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t(0.8)}"/><stop offset="1" stop-color="${t(0.52)}"/></linearGradient><linearGradient id="pt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t(0.7)}"/><stop offset="1" stop-color="${t(0.46)}"/></linearGradient>
<linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f6"/><stop offset=".45" stop-color="#9da2a8"/><stop offset=".55" stop-color="#d7dadd"/><stop offset="1" stop-color="#6d7278"/></linearGradient><linearGradient id="pk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#70757b"/><stop offset=".35" stop-color="#eceef0"/><stop offset="1" stop-color="#5a5f65"/></linearGradient>
<radialGradient id="pg" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="${color.mix(T.dark, '#4a5a70', 0.5)}"/><stop offset=".6" stop-color="#0b0d12"/><stop offset="1" stop-color="#020304"/></radialGradient>
<pattern id="pl" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#17181b"/><circle cx="3" cy="3" r="1.3" fill="#26282c"/></pattern>
<filter id="pb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(w * 0.012)}"/></filter><filter id="pn" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .09 0"/></filter>`;
    const ty = h * 0.64;
    let body = `<rect width="${w}" height="${h}" fill="url(#pw)"/><path d="M${f(w * 0.52)} 0h${f(w * 0.24)}l${f(-w * 0.16)} ${f(ty)}h${f(-w * 0.24)}Z" fill="${t(1)}" opacity=".28" filter="url(#pb)"/>`;
    if (tool === 'mat') {
      // The frame on the wall, its mat cut and the window empty, waiting for the member's own picture.
      const fx = w * 0.2, fy = h * 0.16, fw = w * 0.6, fh = h * 0.56, m = fw * 0.06, mt = fw * 0.16;
      body += `<rect x="${f(fx + w * 0.03)}" y="${f(fy + h * 0.03)}" width="${f(fw)}" height="${f(fh)}" fill="#000" opacity=".3" filter="url(#pb)"/><rect x="${f(fx)}" y="${f(fy)}" width="${f(fw)}" height="${f(fh)}" fill="url(#pk)"/><rect x="${f(fx + m)}" y="${f(fy + m)}" width="${f(fw - m * 2)}" height="${f(fh - m * 2)}" fill="${t(0.97)}"/>
<path d="M${f(fx)} ${f(fy)}h${f(fw)}l${f(-m)} ${f(m)}h${f(-fw + m * 2)}Z" fill="#fff" opacity=".35"/><path d="M${f(fx + fw)} ${f(fy)}v${f(fh)}l${f(-m)} ${f(-m)}v${f(-fh + m * 2)}Z" fill="#000" opacity=".25"/>
<rect x="${f(fx + mt)}" y="${f(fy + mt)}" width="${f(fw - mt * 2)}" height="${f(fh - mt * 2.4)}" fill="${t(0.84)}"/><path d="M${f(fx + mt)} ${f(fy + fh - mt * 1.4)}V${f(fy + mt)}H${f(fx + fw - mt)}" fill="none" stroke="${t(0.6)}" stroke-width="3"/><path d="M${f(fx + mt)} ${f(fy + fh - mt * 1.4)}H${f(fx + fw - mt)}V${f(fy + mt)}" fill="none" stroke="#fff" stroke-width="3"/>`;
      body += `<rect width="${w}" height="${h}" filter="url(#pn)"/>`;
      return Art.svgDoc(w, h, defs, body);
    }
    // A rangefinder on the table: chrome top plate, black leatherette, the lens with its knurled rings and coated glass.
    const cx = w / 2, bw = w * 0.7, bh = bw * 0.5, by = ty - bh * 0.62, R = bh * 0.44, lyy = by + bh * 0.58;
    body += `<rect y="${f(ty)}" width="${w}" height="${f(h - ty)}" fill="url(#pt)"/><rect y="${f(ty)}" width="${w}" height="3" fill="#fff" opacity=".4"/>`;
    body += `<ellipse cx="${f(cx + bw * 0.06)}" cy="${f(by + bh + h * 0.01)}" rx="${f(bw * 0.58)}" ry="${f(h * 0.022)}" fill="#000" opacity=".45" filter="url(#pb)"/>`;
    body += `<rect x="${f(cx + bw * 0.1)}" y="${f(by - bh * 0.12)}" width="${f(bw * 0.14)}" height="${f(bh * 0.14)}" rx="4" fill="url(#pk)"/><path d="M${f(cx + bw * 0.1)} ${f(by - bh * 0.12)}h${f(bw * 0.14)}" stroke="#555a60" stroke-width="3" stroke-dasharray="2 3"/><rect x="${f(cx - bw * 0.38)}" y="${f(by - bh * 0.08)}" width="${f(bw * 0.12)}" height="${f(bh * 0.08)}" rx="3" fill="url(#pk)"/>
<rect x="${f(cx - bw / 2)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.06)}" fill="url(#pm)"/><rect x="${f(cx - bw / 2)}" y="${f(by + bh * 0.3)}" width="${f(bw)}" height="${f(bh * 0.56)}" fill="url(#pl)"/><path d="M${f(cx - bw / 2)} ${f(by + bh * 0.3)}h${f(bw)}" stroke="#000" stroke-opacity=".5" stroke-width="2"/><path d="M${f(cx - bw / 2 + 8)} ${f(by + 5)}h${f(bw - 16)}" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
<rect x="${f(cx - bw * 0.42)}" y="${f(by + bh * 0.08)}" width="${f(bw * 0.15)}" height="${f(bh * 0.14)}" rx="3" fill="url(#pg)" stroke="#4d5157" stroke-width="2"/><rect x="${f(cx + bw * 0.25)}" y="${f(by + bh * 0.08)}" width="${f(bw * 0.17)}" height="${f(bh * 0.14)}" rx="3" fill="url(#pg)" stroke="#4d5157" stroke-width="2"/><path d="M${f(cx + bw * 0.27)} ${f(by + bh * 0.12)}l${f(bw * 0.05)} 0" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`;
    body += `<circle cx="${f(cx + 6)}" cy="${f(lyy + 8)}" r="${f(R * 1.02)}" fill="#000" opacity=".35" filter="url(#pb)"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R)}" fill="url(#pk)"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.94)}" fill="none" stroke="#2a2d31" stroke-width="${f(R * 0.07)}" stroke-dasharray="3 3"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.82)}" fill="#141619"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.74)}" fill="url(#pk)"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.64)}" fill="#0b0c0f"/><circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.56)}" fill="url(#pg)"/>
<circle cx="${f(cx)}" cy="${f(lyy)}" r="${f(R * 0.3)}" fill="none" stroke="${color.mix(T.light, '#7d6fb0', 0.4)}" stroke-opacity=".35" stroke-width="${f(R * 0.05)}"/><path d="M${f(cx - R * 0.42)} ${f(lyy - R * 0.14)}a${f(R * 0.44)} ${f(R * 0.44)} 0 0 1 ${f(R * 0.34)} ${f(-R * 0.3)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="${f(R * 0.06)}" stroke-linecap="round"/><circle cx="${f(cx + R * 0.2)}" cy="${f(lyy + R * 0.22)}" r="${f(R * 0.05)}" fill="#fff" opacity=".35"/>`;
    body += `<path d="M${f(cx - bw / 2)} ${f(by + bh * 0.2)}C${f(cx - bw * 0.7)} ${f(by + bh * 0.4)} ${f(w * 0.08)} ${f(ty + h * 0.08)} 0 ${f(ty + h * 0.2)}" fill="none" stroke="#1b1c1f" stroke-width="${f(w * 0.022)}" stroke-linecap="round"/><path d="M${f(cx - bw / 2)} ${f(by + bh * 0.2)}C${f(cx - bw * 0.7)} ${f(by + bh * 0.4)} ${f(w * 0.08)} ${f(ty + h * 0.08)} 0 ${f(ty + h * 0.2)}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2" transform="translate(0 -6)"/><rect width="${w}" height="${h}" filter="url(#pn)"/>`;
    return Art.svgDoc(w, h, defs, body);
  }
  return null;
}

const CSS = `
${REVIEWS_CSS}
@font-face{font-family:'Frame Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:94.5%;ascent-override:109%;descent-override:24%;line-gap-override:0%}
@font-face{font-family:'Frame Display Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:70.4%;ascent-override:167.6%;descent-override:46.9%;line-gap-override:0%}
@font-face{font-family:'Frame Mono Fallback';src:local('Courier New'),local('CourierNewPSMT'),local('Liberation Mono'),local('LiberationMono-Regular');size-adjust:100%;ascent-override:99%;descent-override:31%;line-gap-override:0%}
html:root{--font-body:"Familjen Grotesk","Frame Body Fallback",sans-serif;--font-display:"Anton","Frame Display Fallback",sans-serif}
body{--film:color-mix(in srgb,var(--dark) 92%,#000)}
.btn{font-weight:500;letter-spacing:-.005em;border-radius:0}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg));color:var(--bg)}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border-color:var(--ink)}
.btn-line:hover{background:var(--ink);color:var(--bg)}
.mono{font-family:"DM Mono","Frame Mono Fallback",ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:400;letter-spacing:0;text-transform:none}
h1{font-family:var(--font-display);font-weight:400;text-transform:uppercase;letter-spacing:0;line-height:.9}
h2{font-family:var(--font-body);font-weight:500;text-transform:none;letter-spacing:-.025em;line-height:1.05}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em;line-height:1.25}
.h2{font-size:clamp(1.9rem,1.5rem + 1.6vw,3rem)}
.sec{padding-block:clamp(4rem,3rem + 4vw,8rem)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.35rem;text-transform:uppercase;letter-spacing:.01em;text-decoration:none}
.nav ul{display:flex;gap:.1rem}
.nav a{position:relative;display:block;padding:.5rem .8rem;font-family:"DM Mono","Frame Mono Fallback",ui-monospace,monospace;font-size:.85rem;text-decoration:none;color:var(--muted);transition:color .2s ease}
.nav a::after{content:'';position:absolute;left:.8rem;right:.8rem;bottom:.3rem;height:2px;background:var(--pop);transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.16,1,.3,1)}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.2rem}
.menu>summary{border-radius:0}
.menu-panel li a{text-transform:uppercase;font-size:2.2rem;letter-spacing:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the name beside the print drying on the line */
.hero{padding-block:clamp(2rem,1.5rem + 3vw,5rem) clamp(3rem,2rem + 4vw,6rem)}
.hero-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;align-items:end}.hero-copy{grid-column:1 / span 5}.hero-print{grid-column:6 / span 7;margin-right:calc(-1 * max(2rem,(100vw - var(--max)) / 2))}}
.hero-copy{display:grid;gap:1.25rem;justify-items:start}
.name{font-size:clamp(3.6rem,1.6rem + 7vw,8.4rem);line-height:.88}
.role{font-size:.9rem;color:var(--muted)}
.hero .lead{max-width:30rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.45}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.5rem}
.hero-print{margin:0}
.shot{overflow:hidden;background:var(--surface)}
.shot img{display:block;width:100%;height:auto}
/* the contact sheet */
.sheet-sec{background:var(--film);color:color-mix(in srgb,var(--on-dark) 86%,var(--film))}
.sheet-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.75rem 2rem;margin-bottom:clamp(1.5rem,1rem + 2vw,3rem)}
.sheet-h{font-size:.95rem;color:var(--on-dark)}
.more{display:inline-flex;align-items:center;gap:.45rem;min-height:2.75rem;font-size:.85rem;color:var(--on-dark);text-decoration:none}
.more:hover{text-decoration:underline;text-decoration-color:var(--primary-on-dark)}
.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem .75rem}
@media (min-width:48rem){.sheet{grid-template-columns:repeat(3,minmax(0,1fr));gap:2rem 1.25rem}}
.fr{position:relative;padding-top:.9rem}
@media (max-width:47.99rem){.sheet>.fr:last-child:nth-child(odd){grid-column:span 2}}
.fr::before{content:'';position:absolute;left:0;right:0;top:0;height:.45rem;background:repeating-linear-gradient(90deg,transparent 0 .5rem,color-mix(in srgb,var(--on-dark) 16%,var(--film)) .5rem 1.1rem,transparent 1.1rem 1.6rem)}
.fr-shot{position:relative}
.fr-in{overflow:hidden;aspect-ratio:3/2;background:#000}
.fr-in img{display:block;width:100%;height:100%;object-fit:cover}
.fr-dev{position:absolute;inset:0;background:color-mix(in srgb,#fff 88%,var(--film));opacity:0;pointer-events:none}
.grease{position:absolute;left:-5%;top:-9%;width:110%;height:118%;overflow:visible;pointer-events:none}
.grease path{fill:none;stroke:var(--primary-on-dark);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}
.fr-cap{display:grid;gap:.15rem;margin-top:.6rem;font-size:.8rem;line-height:1.35}
@media (min-width:48rem){.fr-cap{grid-template-columns:2.2rem minmax(0,1fr)}.fr-cap>*:not(.fr-n){grid-column:2}}
.fr-n{color:var(--primary-on-dark)}
.fr-t{color:var(--on-dark)}
.fr-d{color:color-mix(in srgb,var(--on-dark) 68%,var(--film))}
.fr-link{display:inline-flex;align-items:center;gap:.3rem;min-height:2.75rem;color:var(--on-dark);text-decoration:underline;text-decoration-color:var(--primary-on-dark);text-underline-offset:.25em}
/* scrubbed: each frame develops from blank paper in order, then the pick is circled */
html.m .fr{--dv:clamp(0,calc((var(--p,1) - .1 - var(--i) * .05) * 9),1)}
html.m .fr-dev{opacity:calc(1 - var(--dv))}
html.m .fr-in img{transform:scale(calc(1.04 - .04 * var(--dv)))}
html.m .grease path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--p,1) - .42) * 5,1))}
/* rates */
.svc-grid{display:grid;gap:2rem}
@media (min-width:60rem){.svc-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.svc-grid>.h2{grid-column:1 / span 4}.svc-grid>div{grid-column:5 / span 8}}
.svc{border-top:1px solid var(--ink)}
.svc li{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;gap:.25rem 1rem;align-items:baseline;padding:1.3rem 0;border-bottom:1px solid var(--line)}
.svc-n{font-size:.85rem;color:var(--muted)}
.svc h3{font-size:clamp(1.25rem,1.1rem + .6vw,1.6rem)}
.svc-body p{margin-top:.25rem;color:var(--muted)}
.svc-price{font-family:var(--font-display);font-size:clamp(1.5rem,1.2rem + 1.2vw,2.4rem);white-space:nowrap;font-variant-numeric:tabular-nums}
.incl-box{margin-top:2rem}
.incl-box h3{font-size:.9rem;font-weight:400;margin-bottom:.6rem}
.incl{display:grid;border-top:1px solid var(--line)}
@media (min-width:48rem){.incl{grid-template-columns:1fr 1fr;column-gap:2rem}}
.incl li{display:flex;gap:1rem;padding:.7rem 0;border-bottom:1px solid var(--line)}
.incl-n{font-size:.8rem;color:var(--muted);padding-top:.15rem}
.svc-cta{margin-top:2rem}
/* how a shoot runs: a strip of frames */
.how{border-top:1px solid var(--line)}
.how-h{margin-bottom:2rem}
.strip{display:grid;gap:0;border-top:1px solid var(--ink)}
@media (min-width:48rem){.strip{grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))}}
.strip li{display:grid;gap:.4rem;align-content:start;padding:1.2rem 1.25rem 1.4rem 0;border-bottom:1px solid var(--line)}
@media (min-width:48rem){.strip li{border-bottom:0;border-right:1px solid var(--line);padding-left:1.25rem}.strip li:first-child{padding-left:0}.strip li:last-child{border-right:0}}
.strip-n{font-size:.8rem;color:var(--muted)}
.strip p{color:var(--muted);font-size:.98rem}
/* about */
.about{border-top:1px solid var(--line)}
.about-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;align-items:start}.about-media{grid-column:1 / span 4}.about-copy{grid-column:6 / span 7}}
.about-media{margin:0}
.about-media figcaption{margin-top:.6rem;font-size:.8rem;color:var(--muted)}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-h{font-size:.95rem;color:var(--muted)}
.about-copy p{font-size:1.1rem;line-height:1.6;max-width:36rem;color:var(--muted)}
.about-copy .about-first{font-weight:500;font-size:clamp(1.35rem,1.15rem + .9vw,2rem);line-height:1.3;letter-spacing:-.015em;color:var(--ink)}
.credits{padding-top:1rem;border-top:1px solid var(--line);font-size:.88rem!important;line-height:1.6!important}
.credits span{color:var(--ink);margin-right:.5rem}
/* questions */
.faq-grid{display:grid;gap:1.5rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.faq-grid>h2{grid-column:1 / span 4}.faq-grid>.qa{grid-column:6 / span 7}}
.qa{border-top:1px solid var(--ink)}
.qa div{display:grid;gap:.35rem;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.qa dt{font-weight:600}
.qa dd{color:var(--muted)}
/* contact: the ways to reach on a strip of film, then the job ticket under it */
.contact{border-top:1px solid var(--ink)}
.ct-head{display:grid;gap:1rem;max-width:44rem;margin-bottom:clamp(1.5rem,1rem + 2vw,2.75rem)}
.promise{max-width:34rem;color:var(--muted)}
.ct-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:.6rem;padding:1.35rem .6rem;background:var(--film);color:var(--on-dark);position:relative}
.ct-strip::before,.ct-strip::after{content:'';position:absolute;left:0;right:0;height:.4rem;background:repeating-linear-gradient(90deg,transparent 0 .5rem,color-mix(in srgb,var(--on-dark) 18%,var(--film)) .5rem 1.1rem,transparent 1.1rem 1.6rem)}
.ct-strip::before{top:.4rem}.ct-strip::after{bottom:.4rem}
.ct-strip li{display:grid;grid-template-columns:auto 1fr;gap:.2rem .7rem;align-content:start;padding:1rem;border:1px solid color-mix(in srgb,var(--on-dark) 22%,var(--film));min-width:0}
.ct-n{grid-row:span 2;font-size:.8rem;color:var(--primary-on-dark)}
.ct-k{font-size:.8rem;color:color-mix(in srgb,var(--on-dark) 68%,var(--film))}
.ct-v{display:inline-flex;align-items:center;min-height:2.75rem;font-size:1.05rem;color:var(--on-dark);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--on-dark) 35%,var(--film));text-underline-offset:.25em;overflow-wrap:anywhere}
.ct-v:hover{text-decoration-color:var(--primary-on-dark)}
.brief{max-width:60rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem);padding:clamp(1.2rem,1rem + 1.5vw,2.5rem);border:1px solid var(--ink)}
.brief-h{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;padding-bottom:.6rem;border-bottom:1px dashed var(--line);font-size:.85rem;color:var(--muted)}
.brief label{font-family:"DM Mono","Frame Mono Fallback",ui-monospace,monospace;font-weight:400;font-size:.85rem}
.field input,.field select,.field textarea{border-radius:0;border:0;border-bottom:1px solid var(--line);background:transparent;padding-inline:0}
.field textarea{border:1px solid var(--line);padding-inline:.7rem}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:none}
/* footer: the film's edge */
.fr-ftr{position:relative;background:var(--film);color:color-mix(in srgb,var(--on-dark) 80%,var(--film));padding-block:3.25rem 1.75rem}
.fr-ftr::before{content:'';position:absolute;left:0;right:0;top:.9rem;height:.45rem;background:repeating-linear-gradient(90deg,transparent 0 .5rem,color-mix(in srgb,var(--on-dark) 18%,var(--film)) .5rem 1.1rem,transparent 1.1rem 1.6rem)}
.fr-ftr-in{display:grid;gap:.9rem;justify-items:start}
.fr-ftr-name{font-family:var(--font-display);text-transform:uppercase;font-size:clamp(2.6rem,1.4rem + 5vw,6rem);line-height:.9;color:var(--on-dark);overflow-wrap:anywhere}
.fr-ftr-edge{font-size:.85rem;color:var(--primary-on-dark)}
.fr-ftr-nav{display:flex;flex-wrap:wrap;gap:0 1.4rem;font-size:.85rem}
.fr-ftr a{color:var(--on-dark);text-decoration:none;display:inline-flex;align-items:center;min-height:2.75rem}
.fr-ftr a:hover{text-decoration:underline;text-decoration-color:var(--primary-on-dark);text-underline-offset:.25em}
.fr-ftr-reach{display:flex;flex-wrap:wrap;gap:0 1.4rem;font-size:.9rem}
.fr-ftr-c{font-size:.8rem}
.fr-ftr>.legal-links{width:min(100% - 2rem,var(--max));margin-inline:auto;text-align:left}
.fr-ftr>.legal-links a{color:var(--on-dark)}
.fr-ftr>.mpause{margin-left:max(1rem,calc((100% - var(--max)) / 2));color:var(--on-dark);border-color:color-mix(in srgb,var(--on-dark) 40%,var(--film))}
.menu-panel{min-height:calc(100svh - 4.25rem);overflow-y:auto}
body.has-bar .menu-panel>.btn{display:none}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Frame',
  bestFor: 'Photographers, video editors, designers and UGC creators who get hired for their work, with motion',
  why: 'The work comes first, set like a darkroom: your name is printed onto the page word by word as two prints come up on the drying line, then the work is a contact sheet whose frames develop one by one as you scroll, the pick circled in grease pencil, with mono captions like a lab would write.',
  fonts: { q: 'family=Anton&family=Familjen+Grotesk:wght@400;500;600&family=DM+Mono:wght@400;500', display: ['Anton', 'grotesk'], body: ['Familjen Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): prints developing in the tray, a wall that moves past at different distances.
  choreo: { intro: 'stamp', alive: ['pointer', 'scroll'], scroll: 'scene', pace: 'calm', look: 'darkroom paper and film base, the name exposed under the enlarger, frames developing on a contact sheet' },
  tokens,
  slots,
  nav,
  render,
  art,
};
