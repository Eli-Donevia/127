// Frame (animated, portfolio): for photographers, editors and designers, the work first.
//   Object:   the print and the contact sheet it came from. The hero is the print hanging to dry on the darkroom line
//             (drawn until the member adds a photo); the work is the contact sheet itself, every frame on the dark film
//             base with its number in the margin and its caption under it, the pick circled in grease pencil.
//   Material: darkroom paper and film stock: gallery white, film-base black, 1px rules, condensed poster type for the
//             name, mono for everything the lab would write.
//   One move: the print develops. The hanging print comes up from a grey haze while the name comes into focus word by
//             word (choreo intro 'develop').
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
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'frame';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f1efea', 0.85), dark: color.mix(color.mix(p.ink, p.primary, 0.12), '#0a0a0a', 0.72) };
}

function frameCount(c) {
  const n = (c.work || []).length;
  return n ? Math.min(9, Math.max(3, n)) : 6;
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

function nav(c) {
  return [
    { label: 'Work', href: '#work' },
    c.services.length || c.included.length ? { label: 'Services', href: '#services' } : null,
    { label: 'About', href: '#about' },
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
const sentencesOf = (t) => String(t || '').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);

// The grease pencil loop, drawn by hand around the pick (it overshoots where it closes, the way a pencil does).
const GREASE = '<svg class="grease" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" vector-effect="non-scaling-stroke" d="M14 24C26 4 78 0 93 22C104 42 98 82 62 95C28 104 0 86 3 54C5 36 16 22 34 14"/></svg>';

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
    frames.push(`<li class="fr${i === 0 ? ' pick' : ''}" data-sc-part style="--i:${i}">
<div class="fr-shot"><div class="fr-in">${P.img(c, `w${i + 1}`, { eager: false })}</div><span class="fr-dev" aria-hidden="true"></span>${i === 0 ? GREASE : ''}</div>
<p class="mono fr-cap"><span class="fr-n">${num(i)}${i === 0 ? '<span class="sr-only"> (the pick)</span>' : ''}</span>${piece ? `<span class="fr-t">${esc(piece.title)}</span>${piece.detail ? `<span class="fr-d">${esc(piece.detail)}</span>` : ''}${piece.href ? `<a class="fr-link" href="${esc(piece.href)}">${esc(piece.linkLabel || 'See it')}${icon('arrowUpRight', { size: 14 })}</a>` : ''}` : ''}</p>
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

  const restAbout = [own.slice(1).join(' '), ...c.aboutParas.slice(1)].filter(Boolean);
  const aboutParas = own.length ? restAbout : c.aboutParas;
  const credits = c.clients && c.clients.length ? `<p class="mono credits"><span>Clients</span> ${c.clients.map(esc).join(', ')}</p>` : '';
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<figure class="about-media"><div class="shot"><div class="shot-in">${P.img(c, 'portrait', { cls: 'about-img' })}</div></div>${c.city && !c.online ? `<figcaption class="mono">${esc(person || c.name)}, ${esc(c.city)}</figcaption>` : ''}</figure>
<div class="about-copy">
<h2 class="mono about-h" id="about-title">${esc(person ? `About ${person}` : `About ${c.name}`)}</h2>
${aboutParas.map((p, i) => `<p${i === 0 ? ' class="about-first"' : ''}>${esc(p)}</p>`).join('\n')}
${credits}
${P.socials(c)}
</div>
</div>
</section>`;

  // How a shoot runs: the member's steps as frames of a strip, numbered in mono. Not a roadmap.
  const how = c.steps.length >= 2
    ? `<section class="sec how" aria-labelledby="how-title"><div class="wrap"><h2 class="h2 how-h" id="how-title">How a shoot runs</h2><ol class="strip">${c.steps.map((s, i) => `<li><span class="mono strip-n">${num(i)}</span><h3>${esc(s.title)}</h3>${s.body ? `<p>${esc(s.body)}</p>` : ''}</li>`).join('')}</ol></div></section>`
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
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Business or brand' },
    projectTypes || { ...P.FIELD_PRESETS.when, label: 'Date or deadline' },
    projectTypes ? { ...P.FIELD_PRESETS.when, label: 'Date or deadline', half: false } : null,
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the project', required: true },
  ].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-copy">
<h2 class="h2 contact-h" id="contact-title">Send the brief.</h2>
${c.promise ? `<p class="promise">${esc(c.promise)}</p>` : ''}
${c.booking ? `<div class="ctas">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}</div>` : ''}
${P.contactList(c, { cls: 'contact-l' })}
</div>
<div class="brief">
<p class="mono brief-h">Job ticket</p>
${P.form(c, { id: 'contact', fields, submit: 'Send', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-fr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, workSec, services, how, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '88rem' } };
}

// ---- the placeholders, drawn: photographs in tone (a landscape, a still life, light through a window), the print
// drying on the line for the hero, and a camera on the table for the about. Duotone in the member's ink and paper,
// with grain. No text, no people, no blobs.
function tones(p) {
  const dark = color.mix(p.ink, '#0d0d0d', 0.5), light = color.mix(p.paper, '#ffffff', 0.55);
  return { dark, light, t: (k) => color.mix(dark, light, k) };
}
function photo(kind, w, h, p, r, uid, Art) {
  const T = tones(p);
  const f = (v) => v.toFixed(1);
  const grain = `<filter id="gr${uid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" seed="${Math.floor(r() * 90)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0"/></filter><filter id="bl${uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(Math.min(w, h) * 0.02)}"/></filter>`;
  let defs = grain, body = '';
  if (kind === 'land') {
    defs += `<linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.t(0.62)}"/><stop offset="1" stop-color="${T.t(0.9)}"/></linearGradient>`;
    body += `<rect width="${w}" height="${h}" fill="url(#sky${uid})"/>`;
    [0.5, 0.62, 0.74].forEach((y0, k) => {
      let d = `M0 ${f(h * (y0 + r() * 0.06))}`;
      for (let i = 1; i <= 4; i++) d += `Q${f((w * (i - 0.5)) / 4)} ${f(h * (y0 - 0.08 + r() * 0.14))} ${f((w * i) / 4)} ${f(h * (y0 + r() * 0.06))}`;
      body += `<path d="${d}V${h}H0Z" fill="${T.t(0.5 - k * 0.2)}"/>`;
    });
  } else if (kind === 'still') {
    defs += `<linearGradient id="bw${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${T.t(0.42)}"/><stop offset="1" stop-color="${T.t(0.66)}"/></linearGradient>`;
    const ty = h * 0.66;
    body += `<rect width="${w}" height="${h}" fill="url(#bw${uid})"/><rect y="${f(ty)}" width="${w}" height="${f(h - ty)}" fill="${T.t(0.78)}"/><rect y="${f(ty)}" width="${w}" height="${f(h * 0.012)}" fill="${T.t(0.92)}"/>`;
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const cx = w * (0.3 + i * 0.22 + r() * 0.05), bw = w * (0.08 + r() * 0.06), bh = h * (0.22 + r() * 0.2), nk = bw * 0.32;
      const top = ty - bh;
      body += `<ellipse cx="${f(cx + bw * 0.9)}" cy="${f(ty + h * 0.03)}" rx="${f(bw * 1.3)}" ry="${f(h * 0.025)}" fill="${T.dark}" opacity=".35" filter="url(#bl${uid})"/>`;
      body += `<path d="M${f(cx - nk / 2)} ${f(top)}h${f(nk)}c0 ${f(bh * 0.18)} ${f(bw / 2 - nk / 2)} ${f(bh * 0.22)} ${f(bw / 2 - nk / 2)} ${f(bh * 0.55)}c0 ${f(bh * 0.3)} ${f(-bw * 0.1)} ${f(bh * 0.45)} ${f(-bw * 0.18)} ${f(bh * 0.45)}h${f(-bw * 0.64)}c${f(-bw * 0.08)} 0 ${f(-bw * 0.18)} ${f(-bh * 0.15)} ${f(-bw * 0.18)} ${f(-bh * 0.45)}c0 ${f(-bh * 0.33)} ${f(bw / 2 - nk / 2)} ${f(-bh * 0.37)} ${f(bw / 2 - nk / 2)} ${f(-bh * 0.55)}Z" fill="${T.t(0.1 + r() * 0.25)}"/>`;
      body += `<path d="M${f(cx - bw * 0.3)} ${f(top + bh * 0.5)}q${f(-bw * 0.06)} ${f(bh * 0.2)} 0 ${f(bh * 0.38)}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="${f(bw * 0.06)}" stroke-linecap="round"/>`;
    }
  } else {
    const Wl = Art.wall({ style: 'tile', w, h, p: { ...p, primary: T.t(0.5), paper: T.t(0.7) }, seed: uid, index: Math.floor(r() * 3) + 7 });
    defs += Wl.defs;
    body += Wl.body;
  }
  body += `<rect width="${w}" height="${h}" filter="url(#gr${uid})"/>`;
  return { defs, body };
}
const KINDS = ['still', 'land', 'window', 'land', 'still', 'window', 'still', 'land', 'window'];
function art(slot, { p, seed, index, art: Art }) {
  const w = slot.w, h = slot.h;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:${slot.slot}`);
  if (/^w\d+$/.test(slot.slot)) {
    const i = +slot.slot.slice(1) - 1;
    const ph = photo(KINDS[i % KINDS.length], w, h, p, r, `w${i}`, Art);
    return Art.svgDoc(w, h, ph.defs, ph.body);
  }
  const W = Art.wall({ style: 'sweep', w, h, p, seed, index, quiet: true });
  const T = tones(p);
  const paper = color.mix(p.paper, '#ffffff', 0.75);
  let defs = `${W.defs}<filter id="psh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(w * 0.01)}"/></filter>`;
  let body = W.body;
  if (slot.slot === 'hero') {
    // Two prints drying on the line, pegged at the top, a little curled.
    const ly = h * 0.12;
    body += `<path d="M0 ${f(ly)}Q${f(w / 2)} ${f(ly + h * 0.03)} ${w} ${f(ly)}" fill="none" stroke="${T.t(0.25)}" stroke-width="2.5"/>`;
    const prints = [
      { x: w * 0.12, pw: w * 0.36, ar: 1.25, kind: KINDS[0], rot: -1.2 },
      { x: w * 0.53, pw: w * 0.38, ar: 0.72, kind: KINDS[1], rot: 1.4 },
    ];
    prints.forEach((pr, k) => {
      const ph = pr.pw * pr.ar, y = ly + h * 0.025, b = pr.pw * 0.06;
      const iw = pr.pw - b * 2, ih = ph - b * 2;
      const img = photo(pr.kind, Math.round(iw), Math.round(ih), p, r, `h${k}`, Art);
      defs += img.defs;
      body += `<g transform="rotate(${f(pr.rot)} ${f(pr.x + pr.pw / 2)} ${f(y)})"><rect x="${f(pr.x + w * 0.01)}" y="${f(y + h * 0.02)}" width="${f(pr.pw)}" height="${f(ph)}" fill="#000" opacity=".22" filter="url(#psh)"/><rect x="${f(pr.x)}" y="${f(y)}" width="${f(pr.pw)}" height="${f(ph)}" fill="${paper}"/><svg x="${f(pr.x + b)}" y="${f(y + b)}" width="${f(iw)}" height="${f(ih)}" viewBox="0 0 ${Math.round(iw)} ${Math.round(ih)}">${img.body}</svg>
<rect x="${f(pr.x + pr.pw / 2 - w * 0.012)}" y="${f(y - h * 0.045)}" width="${f(w * 0.024)}" height="${f(h * 0.085)}" fill="${color.mix('#b98d5a', T.dark, 0.15)}"/><path d="M${f(pr.x + pr.pw / 2 - w * 0.012)} ${f(y - h * 0.005)}h${f(w * 0.024)}" stroke="#d9dde2" stroke-width="3"/></g>`;
    });
    return Art.svgDoc(w, h, defs, body);
  }
  if (slot.slot === 'portrait') {
    // A rangefinder camera on the table, lens toward you, the strap trailing off.
    const ty = h * 0.62, cx = w / 2, bw = w * 0.66, bh = bw * 0.48, by = ty - bh * 0.55;
    const metal = color.mix('#c9ccd1', T.light, 0.2), leather = color.mix(T.dark, '#1a1a1a', 0.4);
    body += `<rect y="${f(ty)}" width="${w}" height="${f(h - ty)}" fill="${color.mix(W.wall, '#000', 0.12)}"/>`;
    body += `<ellipse cx="${f(cx + bw * 0.06)}" cy="${f(by + bh + h * 0.012)}" rx="${f(bw * 0.56)}" ry="${f(h * 0.022)}" fill="#000" opacity=".3" filter="url(#psh)"/>`;
    body += `<rect x="${f(cx - bw / 2)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" rx="${f(bw * 0.05)}" fill="${metal}"/><rect x="${f(cx - bw / 2)}" y="${f(by + bh * 0.28)}" width="${f(bw)}" height="${f(bh * 0.58)}" fill="${leather}"/>`;
    body += `<rect x="${f(cx - bw * 0.42)}" y="${f(by + bh * 0.07)}" width="${f(bw * 0.14)}" height="${f(bh * 0.13)}" rx="3" fill="${T.dark}"/><rect x="${f(cx + bw * 0.24)}" y="${f(by + bh * 0.07)}" width="${f(bw * 0.16)}" height="${f(bh * 0.13)}" rx="3" fill="${T.dark}"/><rect x="${f(cx + bw * 0.27)}" y="${f(by + bh * 0.09)}" width="${f(bw * 0.05)}" height="${f(bh * 0.04)}" fill="#fff" opacity=".35"/>`;
    body += `<rect x="${f(cx + bw * 0.12)}" y="${f(by - bh * 0.1)}" width="${f(bw * 0.12)}" height="${f(bh * 0.1)}" rx="3" fill="${metal}"/><rect x="${f(cx - bw * 0.36)}" y="${f(by - bh * 0.07)}" width="${f(bw * 0.1)}" height="${f(bh * 0.07)}" rx="3" fill="${metal}"/>`;
    const R = bh * 0.42, lx = cx, lyy = by + bh * 0.57;
    body += `<circle cx="${f(lx)}" cy="${f(lyy)}" r="${f(R)}" fill="${color.mix(metal, '#000', 0.35)}"/><circle cx="${f(lx)}" cy="${f(lyy)}" r="${f(R * 0.86)}" fill="${T.dark}"/><circle cx="${f(lx)}" cy="${f(lyy)}" r="${f(R * 0.64)}" fill="${color.mix(T.dark, '#3a4250', 0.4)}" stroke="${metal}" stroke-opacity=".4" stroke-width="2"/><circle cx="${f(lx)}" cy="${f(lyy)}" r="${f(R * 0.38)}" fill="#07080a"/><path d="M${f(lx - R * 0.42)} ${f(lyy - R * 0.2)}a${f(R * 0.46)} ${f(R * 0.46)} 0 0 1 ${f(R * 0.5)} ${f(-R * 0.3)}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="${f(R * 0.06)}" stroke-linecap="round"/>`;
    body += `<path d="M${f(cx - bw / 2)} ${f(by + bh * 0.2)}C${f(cx - bw * 0.7)} ${f(by + bh * 0.4)} ${f(w * 0.08)} ${f(ty + h * 0.08)} 0 ${f(ty + h * 0.2)}" fill="none" stroke="${leather}" stroke-width="${f(w * 0.022)}" stroke-linecap="round"/>`;
    return Art.svgDoc(w, h, defs, body);
  }
  return null;
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Frame Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.9%}
@font-face{font-family:'Frame Display Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:70.7%}
html:root{--font-body:"Familjen Grotesk","Frame Body Fallback",sans-serif;--font-display:"Anton","Frame Display Fallback",sans-serif}
body{--film:color-mix(in srgb,var(--dark) 92%,#000)}
.btn{font-weight:500;letter-spacing:-.005em;border-radius:0}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg));color:var(--bg)}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border-color:var(--ink)}
.btn-line:hover{background:var(--ink);color:var(--bg)}
.mono{font-family:"DM Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:400;letter-spacing:0;text-transform:none}
h1,h2{font-family:var(--font-display);font-weight:400;text-transform:uppercase;letter-spacing:0;line-height:.9}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em;line-height:1.25}
.h2{font-size:clamp(2.4rem,1.6rem + 3vw,4.4rem)}
.sec{padding-block:clamp(4rem,3rem + 4vw,8rem)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.35rem;text-transform:uppercase;letter-spacing:.01em;text-decoration:none}
.nav ul{display:flex;gap:.1rem}
.nav a{position:relative;display:block;padding:.5rem .8rem;font-family:"DM Mono",ui-monospace,monospace;font-size:.85rem;text-decoration:none;color:var(--muted);transition:color .2s ease}
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
.about-copy .about-first{font-family:var(--font-display);text-transform:uppercase;font-size:clamp(2rem,1.4rem + 2.4vw,3.6rem);line-height:.98;color:var(--ink)}
.credits{padding-top:1rem;border-top:1px solid var(--line);font-size:.88rem!important;line-height:1.6!important}
.credits span{color:var(--ink);margin-right:.5rem}
/* questions */
.faq-grid{display:grid;gap:1.5rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.faq-grid>h2{grid-column:1 / span 4}.faq-grid>.qa{grid-column:6 / span 7}}
.qa{border-top:1px solid var(--ink)}
.qa div{display:grid;gap:.35rem;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.qa dt{font-weight:600}
.qa dd{color:var(--muted)}
/* contact: a job ticket */
.contact{border-top:1px solid var(--ink)}
.contact-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.contact-copy{grid-column:1 / span 5}.brief{grid-column:7 / span 6}}
.contact-copy{display:grid;gap:1.25rem;align-content:start;justify-items:start}
.contact-h{font-size:clamp(3rem,1.6rem + 5vw,7rem)}
.promise{max-width:30rem;color:var(--muted)}
.brief{padding:clamp(1.2rem,1rem + 1vw,2rem);border:1px solid var(--ink)}
.brief-h{margin-bottom:1rem;padding-bottom:.6rem;border-bottom:1px dashed var(--line);font-size:.85rem;color:var(--muted)}
.brief label{font-family:"DM Mono",ui-monospace,monospace;font-weight:400;font-size:.85rem}
.field input,.field select,.field textarea{border-radius:0;border:0;border-bottom:1px solid var(--line);background:transparent;padding-inline:0}
.field textarea{border:1px solid var(--line);padding-inline:.7rem}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:none}
.ftr-name{font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:1.6rem}
.ftr-links a{font-family:"DM Mono",ui-monospace,monospace;font-size:.85rem}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'portfolio',
  name: 'Frame',
  bestFor: 'Photographers, video editors, designers and UGC creators who get hired for their work, with motion',
  why: 'The work comes first, set like a darkroom: your print develops on the drying line as your name comes into focus, then the work is a contact sheet whose frames develop one by one as you scroll, the pick circled in grease pencil, with mono captions like a lab would write.',
  fonts: { q: 'family=Anton&family=Familjen+Grotesk:wght@400;500;600&family=DM+Mono:wght@400;500', display: ['Anton', 'grotesk'], body: ['Familjen Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): prints developing in the tray, a wall that moves past at different distances.
  choreo: { intro: 'develop', alive: ['pointer', 'scroll'], scroll: 'scene', pace: 'medium', look: 'darkroom paper and film base, frames developing on a contact sheet' },
  tokens,
  slots,
  nav,
  render,
  art,
};
