// Orbit (animated, product, for software and digital products): the product itself, drawn in type and line.
//   Object:   the month a content planner fills, a calendar page set in type and hairline (no browser window, no bars).
//   Material: planner paper and graphite: warm paper, near-black ink, 1px rules, square corners, no glow.
//   One move: the sheet's rules draw themselves in while the headline settles from wide tracking (the draw intro),
//             then the planned days fill with slips and tick themselves off one after another, a month planned in
//             one sitting.
//   Pop:      the member's colour is the pen: the ticks on the planned days in the hero, then the current page
//             numeral in the pinned index. Buttons are ink, never a coloured fill.
// Sections: hero (headline left, calendar sheet bleeding off the right edge), what's inside as a pinned index of pages
// (the scroll moment; unpinned on phones), the plans as a price table ruled on a planner sheet, the member's questions
// as ruled notes when they gave some, and a closing line with the product's name set large.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'orbit';

// The page: planner paper by day (own mode), a graphite desk at night. The sheet stays paper in both, under the lamp.
function tokens(p, mode) {
  if (mode === 'dark') return { bg: color.mix(p.ink, '#141311', 0.85), dark: '#0a0908' };
  return { bg: color.mix(p.paper, '#f3efe6', 0.75), dark: color.mix(p.ink, '#0d0c0a', 0.6) };
}

// The product is drawn in type and line; the photo is the desk it lies on: a dark walnut desk at night under one
// lamp, empty in the middle, so the sheet can lie on it. Dark in both modes.
function slots(c) {
  return [{ slot: 'hero', file: 'hero.jpg', w: 1800, h: 1200, style: 'sweep', alt: `A desk at night under a lamp, ${c.productName || c.name} open on it` }];
}

// The desk, drawn: dark walnut seen from above, the lamp's pool falling from the upper left, long grain, a little
// film grain. Neutral (a breath of the member's colour in the shade), so any member's sheet sits on it.
function art(slot, ctx) {
  const ph = ctx.art.photo('orbit', slot.slot);
  if (ph) return ph;
  if (slot.slot !== 'hero') return null;
  const { p, seed, art: A } = ctx;
  const { w, h } = slot;
  const r = A.rng(`${seed}:desk`);
  const wood = color.mix('#1c1712', p.primary, 0.04);
  const deep = color.mix('#070605', p.primary, 0.03);
  const f = (n) => n.toFixed(1);
  let grain = '';
  for (let i = 0; i < 26; i++) {
    const y = h * (-0.1 + i * 0.048 + r() * 0.02);
    const a = h * (0.02 + r() * 0.04);
    grain += `<path d="M${f(-w * 0.05)} ${f(y)}C${f(w * 0.3)} ${f(y + a)} ${f(w * 0.62)} ${f(y - a)} ${f(w * 1.05)} ${f(y + h * 0.18)}" stroke="${i % 3 ? '#000' : '#e9d9c4'}" stroke-opacity="${i % 3 ? (0.16 + r() * 0.12).toFixed(2) : (0.025 + r() * 0.02).toFixed(3)}" stroke-width="${f(1 + r() * 3)}" fill="none"/>`;
  }
  const defs = `<linearGradient id="dk" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${wood}"/><stop offset="1" stop-color="${deep}"/></linearGradient>`
    + `<radialGradient id="lp" cx=".3" cy=".28" r=".75"><stop offset="0" stop-color="#f3dcb8" stop-opacity=".2"/><stop offset=".45" stop-color="#f3dcb8" stop-opacity=".07"/><stop offset="1" stop-color="#f3dcb8" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="vg" cx=".42" cy=".42" r=".85"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`
    + `<filter id="fg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0"/></filter>`;
  const body = `<rect width="${w}" height="${h}" fill="url(#dk)"/><g transform="rotate(-8 ${w / 2} ${h / 2})">${grain}</g><rect width="${w}" height="${h}" fill="url(#lp)"/><rect width="${w}" height="${h}" fill="url(#vg)"/><rect width="${w}" height="${h}" filter="url(#fg)"/>`;
  return A.svgDoc(w, h, defs, body);
}

function plans(c) {
  return c.services.filter((s) => s.name);
}

function nav(c) {
  return [
    c.included.length && { label: 'Inside', href: '#features' },
    plans(c).length && { label: 'Plans', href: '#pricing' },
    c.faq.length >= 2 && { label: 'Questions', href: '#faq' },
  ].filter(Boolean);
}

// The generated "About" for a product ("X makes Y. Questions? Write to Z.") repeats the header; only the member's own
// words make an about section.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length) return [];
  const gen = new RegExp(`^${String(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} makes `, 'i');
  if (paras.length === 1 && gen.test(paras[0])) return [];
  if (/^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// The month on the sheet: it starts on a Wednesday; the planned days are a steady rhythm across the weeks.
const START = 2;
const PLANNED = [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27];
const TODAY = 16;
const TICK = '<svg class="ob-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.8 9.4 17.6 19.6 6.4"/></svg>';

// What the sheet is, from what the member makes: a month that fills with posts (a content planner), sends (a
// newsletter tool), lessons (a course) or ticked days (any other planner, booking or habit tool); for anything else,
// the product's own index card: its name and the facts on file, ruled and ticked.
function sheetKind(c, name) {
  const s = `${c.what || ''} ${c.tagline || ''} ${name} ${c.included.join(' ')}`.toLowerCase();
  if (/\b(content|posts?|social|instagram|tiktok|captions?|reels?)\b/.test(s)) return { k: 'month', label: 'Post' };
  if (/\b(newsletters?|email campaigns?|mailing lists?)\b/.test(s)) return { k: 'month', label: 'Send' };
  if (/\b(courses?|lessons?|cohorts?|curriculum|tutorials?|workshops?)\b/.test(s)) return { k: 'month', label: 'Lesson' };
  if (/\b(planners?|calendars?|schedul\w*|habits?|routines?|bookings?|appointments?|agenda|planning|to-?dos?|tasks?)\b/.test(s)) return { k: 'month', label: '' };
  return { k: 'card', label: '' };
}

// The index card: the name set large, then one ruled line per fact on file, each ticked in turn.
function card(c, name) {
  const low = cheapest(c);
  const rows = [
    plans(c).length > 1 ? plans(c).map((s) => s.name).join(', ') : low && low.priceText,
    c.city && !c.online && c.city,
    c.email || (c.phone && c.phone.display),
    c.hoursLine,
  ].filter(Boolean).slice(0, 4);
  return `<div class="ob-desk" aria-hidden="true"><div class="ob-float" data-alive="0.5"><div class="ob-sheet ob-card" data-ci="subject">
<p class="ob-card-n">${esc(name)}</p>
<ul class="ob-card-l">${rows.map((x, k) => `<li style="--k:${k * 2}"><span class="ob-slip">${TICK}</span><span>${esc(x)}</span></li>`).join('')}</ul>
<svg class="ob-rules" viewBox="0 0 700 500" preserveAspectRatio="none" aria-hidden="true"><path d="M60 0V500" pathLength="1"/></svg>
</div></div></div>`;
}

function sheet(c, name) {
  const kind = sheetKind(c, name);
  if (kind.k === 'card') return card(c, name);
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const day = i - START + 1;
    if (day < 1 || day > 30) {
      cells.push('<span class="ob-day off"></span>');
      continue;
    }
    const k = PLANNED.indexOf(day);
    cells.push(`<span class="ob-day${k > -1 ? ' on' : ''}${day === TODAY ? ' now' : ''}"${k > -1 ? ` style="--k:${k}"` : ''}><b>${day}</b>${k > -1 ? `<span class="ob-slip">${TICK}${kind.label ? `<i>${kind.label}</i>` : ''}</span>` : ''}</span>`);
  }
  const cal = c.included.find((x) => /calendar/i.test(x)) ? 'Content calendar' : '';
  return `<div class="ob-desk" aria-hidden="true"><div class="ob-float" data-alive="0.5"><div class="ob-sheet" data-ci="subject">
<div class="ob-sh-top"><span>${esc(name)}</span>${cal ? `<span>${cal}</span>` : ''}</div>
<div class="ob-wk">${DAYS.map((d) => `<span>${d}</span>`).join('')}</div>
<div class="ob-cells">${cells.join('')}<svg class="ob-rules" viewBox="0 0 700 500" preserveAspectRatio="none" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((r) => `<path d="M0 ${r * 100}H700" pathLength="1"/>`).join('')}${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<path d="M${k * 100} 0V500" pathLength="1"/>`).join('')}</svg></div>
</div></div></div>`;
}

// The footer as the planner's colophon: the name, then the pages, the address and the year ruled like its last page.
function footer(c, name) {
  const links = (c.nav || []).map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('');
  const rows = [
    links && ['Pages', links],
    c.email && ['Write', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
    c.phone && ['Call', `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`],
    c.city && !c.online && ['From', esc(c.city)],
  ].filter(Boolean);
  return `<footer class="ob-ftr"><div class="wrap ob-ftr-in">
<p class="ob-ftr-n">${esc(name)}${name !== c.name ? ` <span>by ${esc(c.name)}</span>` : ''}</p>
<dl class="ob-ftr-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
${P.socials(c, { cls: 'ob-ftr-so', size: 18 })}<p class="ob-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div></footer>`;
}

function render(c) {
  const name = c.productName || c.name;
  const low = cheapest(c);
  const list = plans(c);
  const waitlist = c.primary.kind === 'form';
  const sub = String(c.heroSub || '').trim();
  const useSub = sub && sub.length <= 64 && sub.replace(/[.!\s]+$/, '').toLowerCase() !== String(c.heroTitle).replace(/[.!\s]+$/, '').toLowerCase();
  const title = useSub ? sub : c.heroTitle;
  const same = (a, b) => String(a || '').replace(/[.!\s]+$/, '').toLowerCase() === String(b || '').replace(/[.!\s]+$/, '').toLowerCase();
  const lead = c.audience ? `For ${c.audience.charAt(0).toLowerCase()}${c.audience.slice(1).replace(/[.]+$/, '')}.` : useSub || same(sub, title) ? '' : sub;
  const from = low ? `${list.filter((s) => s.priceText).length > 1 ? 'Plans from ' : ''}${low.priceText.replace(/^From /, '')}` : c.priceText;
  const cta = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace(/<\/a>$/, `${icon('arrow', { size: 18 })}</a>`);

  const hero = `<section class="ob-hero" aria-labelledby="hero-title">
<div class="wrap ob-hero-in">
<div class="ob-copy">
<p class="ob-label" data-ci="then"><span>${esc(name)}</span>${c.whatShort && c.whatShort !== name && !same(c.whatShort, title) ? `<span>${esc(c.whatShort)}</span>` : ''}</p>
<h1 id="hero-title" data-ci="head" class="ob-title${title.length > 40 ? ' long' : ''}">${esc(title)}</h1>
</div>
<div class="ob-scene">${c.images.hero ? `<div class="ob-ph" aria-hidden="true"><img src="${esc(c.images.hero.src)}" alt="" width="${c.images.hero.w}" height="${c.images.hero.h}" fetchpriority="high" decoding="async"></div>` : ''}${sheet(c, name)}</div>
<div class="ob-copy2">
${lead ? `<p class="ob-lead" data-ci="then" data-ci-from="mask">${esc(lead)}</p>` : ''}
<div class="ob-ctas" data-ci="then" data-ci-from="fade">${cta()}${c.secondary ? P.button(c.secondary, 'ob-link') : ''}</div>
${from ? `<p class="ob-from" data-ci="then" data-ci-from="fade">${esc(from)}</p>` : ''}
</div>
</div>
</section>`;

  const n = c.included.length;
  const features = n
    ? `<section class="ob-inside" id="features" aria-labelledby="features-title" data-sc>
<div class="ob-stage" data-sc-stage>
<div class="wrap ob-inside-in">
<div class="ob-inside-head">
<h2 class="ob-h2" id="features-title">Inside ${esc(name)}.</h2>
<p class="ob-of" aria-hidden="true">${String(n).padStart(2, '0')} ${n === 1 ? 'page' : 'pages'}</p>
</div>
<ol class="ob-pages">
${c.included.map((x, i) => `<li class="ob-page" data-sc-part><span class="ob-pn" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ob-big" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><p>${esc(x)}</p></li>`).join('\n')}
</ol>
</div>
</div>
</section>`
    : '';

  // The plans, as the member listed them, ruled into a price table on a planner sheet: one row each, figures lined up.
  const ladder = list.length >= 2
    ? `<section class="ob-sec ob-plans" id="pricing" aria-labelledby="pricing-title"><div class="wrap ob-plans-in">
<div data-rv><h2 class="ob-h2" id="pricing-title">${list.length === 2 ? 'Two plans.' : list.length === 3 ? 'Three plans.' : 'The plans.'}</h2>${c.email ? `<p class="ob-body">Questions about a plan? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>
<div class="ob-ledger" data-rv style="--d:2"><table><thead><tr><th scope="col">Plan</th><th scope="col">Includes</th><th scope="col" class="ob-num">Price</th></tr></thead><tbody>${list.map((s) => `<tr><th scope="row">${esc(s.name)}</th><td>${esc(s.blurb || s.duration || '')}</td><td class="ob-num">${esc(s.priceText || '')}</td></tr>`).join('')}</tbody></table>
<div class="ob-ledger-cta">${cta()}</div></div>
</div></section>`
    : '';
  const one = list.length === 1 || (!list.length && c.priceText) ? list[0] || { name, priceText: c.priceText, blurb: '' } : null;
  const single = one
    ? `<section class="ob-sec ob-one" id="pricing" aria-labelledby="pricing-title"><div class="wrap ob-one-in" data-rv>
<h2 class="ob-h2" id="pricing-title">${esc(one.name)}</h2>
${one.priceText ? `<p class="ob-one-p">${esc(one.priceText)}</p>` : ''}
${one.blurb ? `<p class="ob-body">${esc(one.blurb)}</p>` : ''}
<div>${cta()}</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="ob-sec" aria-labelledby="reviews-title"><div class="wrap" data-rv><h2 class="ob-h2" id="reviews-title">What people say</h2><div class="ob-rv">${P.reviews(c)}</div></div></section>`
    : '';

  const paras = ownAbout(c);
  const about = paras.length
    ? `<section class="ob-sec ob-about" id="about" aria-labelledby="about-title"><div class="wrap ob-about-in" data-rv><h2 class="ob-side" id="about-title">About ${esc(c.name)}</h2><div>${paras.map((p, i) => `<p class="${i ? 'ob-body' : 'ob-say'}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';

  // Questions only when the member gave two or more: ruled like notes on the sheet, every answer open.
  const faq = c.faq.length >= 2
    ? `<section class="ob-sec ob-faq" id="faq" aria-labelledby="faq-title"><div class="wrap ob-faq-in"><div data-rv><h2 class="ob-h2" id="faq-title">Notes.</h2>${c.email ? `<p class="ob-body">Something else? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div><dl class="ob-notes" data-rv style="--d:2">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const prices = list.filter((s) => s.priceText).map((s) => `${s.name} ${s.priceText}`);
  const end = `<section class="ob-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title">
<div class="wrap ob-end-in" data-rv>
<h2 class="ob-h2" id="end-title">${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist
  ? `${c.ctaSub ? `<p class="ob-body">${esc(c.ctaSub)}</p>` : ''}<div class="ob-form">${P.form(c, { id: 'signup', fields: [P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `${prices.length ? `<p class="ob-prices">${prices.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}<div class="ob-ctas">${cta()}</div>`}
</div>
<p class="ob-word" aria-hidden="true" style="--len:${Math.max(4, [...name].length)}">${esc(name)}</p>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'ob-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, ladder || single, reviews, about, faq, end, '</main>', footer(c, name), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '3px', max: '78rem' } };
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{--rule:color-mix(in srgb,var(--ink) 16%,transparent);--rule-hi:var(--ink);--sheet:color-mix(in srgb,var(--bg) 55%,#fff);--ease:cubic-bezier(.16,1,.3,1);font-size:1.0625rem;line-height:1.55}
h1,h2,h3{font-weight:600;letter-spacing:-.035em}
.btn{border-radius:var(--radius-btn);font-weight:500;letter-spacing:-.01em}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 86%,var(--bg))}
.btn-primary:hover .i{transform:translateX(3px)}
.btn .i{transition:transform .35s var(--ease)}
.btn-sm{min-height:2.5rem;padding:.45rem 1rem;font-size:.9rem}
.ob-link{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:500;text-decoration:underline;text-decoration-color:var(--rule);text-underline-offset:.3em;transition:text-decoration-color .25s ease}
.ob-link:hover{text-decoration-color:var(--pop)}
/* header: a wordmark, quiet links */
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:4rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.2rem;font-weight:600;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.95rem;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;padding-block:.3rem;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.menu>summary{border-radius:3px;border-color:var(--rule);background:transparent}
.menu-panel{border-radius:0;box-shadow:none;border-color:var(--ink);background:var(--sheet)}
.menu-panel li a{font-weight:600;letter-spacing:-.04em;border-bottom-color:var(--rule)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.ob-h2{font-size:clamp(2.3rem,1.4rem + 3.6vw,4.6rem);line-height:.98;letter-spacing:-.045em}
.ob-body{max-width:34rem;margin-top:1rem;color:var(--muted)}
.ob-body a{color:var(--ink)}
.ob-sec{padding-block:clamp(4.5rem,3rem + 6vw,9rem)}
/* hero */
.ob-hero{overflow:hidden;border-bottom:1px solid var(--rule)}
.ob-hero-in{--hpt:clamp(2.5rem,1.5rem + 4vw,5.5rem);--hpb:clamp(3rem,2rem + 4vw,6rem);display:grid;gap:3rem;padding-block:var(--hpt) var(--hpb)}
/* the scene: the desk photo (or its drawing) full-bleed to the right edge and the hero's top and bottom, the sheet on it */
.ob-scene{position:relative;display:grid;align-items:center;isolation:isolate}
.ob-ph{position:absolute;inset:0;z-index:-1;overflow:hidden;background:#0d0b09}
.ob-ph img{width:100%;height:100%;object-fit:cover;object-position:30% 40%}
html.m .ob-ph img{transform:scale(1.06);transition:transform 2.6s cubic-bezier(.16,1,.3,1)}
html.m.ci-go .ob-ph img{transform:none}
@media (min-width:64rem){.ob-hero-in{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:1fr 1fr;gap:0 1.5rem;min-height:calc(100vh - 4rem);min-height:calc(100svh - 4rem)}.ob-copy{grid-column:1/6;grid-row:1;align-self:end;position:relative;z-index:1}.ob-copy2{grid-column:1/6;grid-row:2;align-self:start}.ob-scene{grid-column:6/13;grid-row:1/3;align-self:stretch;margin-block:calc(-1 * var(--hpt)) calc(-1 * var(--hpb));margin-right:calc((100vw - min(100vw - 4rem,var(--max))) / -2);padding:clamp(3rem,2rem + 3vw,5rem) 0 clamp(3rem,2rem + 3vw,5rem) clamp(2rem,1rem + 2.5vw,4rem)}.ob-desk{margin-right:-4rem}}
@media (max-width:63.99rem){.ob-hero-in{gap:2.2rem}.ob-copy2 .ob-lead{margin-top:0}.ob-scene{margin-inline:calc((100% - 100vw) / 2);padding:clamp(2.2rem,1.5rem + 3vw,4rem) clamp(1rem,.5rem + 3vw,3rem)}}
.ob-label{display:flex;flex-wrap:wrap;gap:.3rem .9rem;font-size:.92rem;color:var(--muted)}
.ob-label span:first-child{color:var(--ink);font-weight:500}
.ob-label span+span{padding-left:.9rem;border-left:1px solid var(--rule)}
@media (max-width:39.99rem){.ob-label{flex-direction:column}.ob-label span+span{padding-left:0;border-left:0}}
.ob-title{margin-top:1.4rem;max-width:12ch;font-size:clamp(2.9rem,1rem + 5.4vw,6.4rem);line-height:.94;letter-spacing:-.05em;padding-bottom:.05em}
.ob-title.long{max-width:15ch;font-size:clamp(2.5rem,1rem + 4.2vw,5.2rem)}
.ob-lead{max-width:30rem;margin-top:1.6rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
.ob-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.6rem;margin-top:2.2rem}
.ob-from{margin-top:1.2rem;font-size:.95rem;color:var(--muted);font-variant-numeric:tabular-nums}
/* the sheet */
.ob-desk{transform:rotate(-2deg);transform-origin:20% 50%}
.ob-sheet{padding:clamp(1rem,.7rem + 1.2vw,2rem);background:var(--sheet);border:1px solid var(--rule);box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 10%,transparent),0 40px 60px -48px color-mix(in srgb,var(--ink) 55%,transparent)}
.ob-sh-top{display:flex;align-items:baseline;gap:1.2rem;padding-bottom:.9rem;font-family:var(--font-display);font-size:clamp(.95rem,.85rem + .4vw,1.2rem);letter-spacing:-.03em}
.ob-sh-top span+span{font-family:var(--font-body);font-size:.85rem;letter-spacing:0;color:var(--muted)}
.ob-wk,.ob-cells{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.ob-wk span{padding:.5rem .45rem;font-size:.72rem;color:var(--muted);border-top:1px solid var(--rule-hi)}
.ob-cells{position:relative}
.ob-rules{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.ob-rules path{fill:none;stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.ob-day{position:relative;min-height:clamp(3.3rem,2rem + 3.6vw,6.4rem);padding:.4rem .45rem}
.ob-day b{font-family:var(--font-display);font-weight:600;font-size:clamp(.85rem,.75rem + .35vw,1.1rem);letter-spacing:-.02em;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-day.on b{color:var(--ink)}
.ob-day.off{background:color-mix(in srgb,var(--ink) 4%,transparent)}
.ob-slip{position:absolute;left:8%;right:8%;bottom:10%;display:flex;align-items:center;gap:.3rem;height:clamp(1.15rem,.8rem + 1vw,1.9rem);padding-inline:.25rem;background:color-mix(in srgb,var(--sheet) 40%,#fff);border:1px solid var(--rule);border-left:2px solid var(--pop);box-shadow:0 5px 8px -6px color-mix(in srgb,var(--ink) 60%,transparent)}
.ob-slip i{font-style:normal;font-size:.72rem;color:var(--ink);overflow:hidden}
@media (max-width:89.99rem){.ob-slip i{display:none}}
.ob-tick{flex:none;width:clamp(.8rem,.6rem + .5vw,1.15rem);height:clamp(.8rem,.6rem + .5vw,1.15rem);fill:none;stroke:var(--pop);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
html.m .ob-slip{opacity:0;transform:translate3d(0,-1.4rem,0) rotate(-6deg) scale(1.08)}
html.m .ob-tick path{stroke-dasharray:24;stroke-dashoffset:24}
html.m.ci-go .ob-slip{opacity:1;transform:none;transition:opacity .2s ease calc(1s + var(--k,0) * 95ms),transform .7s cubic-bezier(.16,1,.3,1) calc(1s + var(--k,0) * 95ms)}
html.m.ci-go .ob-tick path{stroke-dashoffset:0;transition:stroke-dashoffset .35s cubic-bezier(.65,0,.35,1) calc(1.3s + var(--k,0) * 95ms)}
html.m:not(.ci-go) .ob-slip,html.m:not(.ci-go) .ob-tick path{animation:obSlip 0s 2.8s forwards}
@keyframes obSlip{to{opacity:1;transform:none;stroke-dashoffset:0}}
@media (max-width:63.99rem){.ob-desk{transform:rotate(-1.2deg)}}
/* the sheet is paper under the lamp in both modes: its own ink, rules and pen */
.ob-desk{--ink:#1c1b18;--muted:#5f5b53;--rule:rgba(28,27,24,.16);--rule-hi:#1c1b18;--sheet:#f5f2ea;--pop:var(--primary);color:var(--ink)}
.ob-sheet{box-shadow:0 1px 0 rgba(0,0,0,.25),18px 34px 50px -22px rgba(0,0,0,.65)}
/* today: one day run over with a highlighter in the neon partner, after the month has ticked itself off */
.ob-day.now b{position:relative;z-index:0;color:var(--ink)}
.ob-day.now b::before{content:"";position:absolute;z-index:-1;inset:.1em -.3em -.05em;background:color-mix(in srgb,var(--neon) 42%,#fff);mix-blend-mode:multiply;transform-origin:0 50%;transform:skewX(-8deg)}
html.m .ob-day.now b::before{transform:skewX(-8deg) scaleX(0)}
html.m.ci-go .ob-day.now b::before{transform:skewX(-8deg);transition:transform .5s cubic-bezier(.65,0,.35,1) calc(1.5s + 12 * 95ms)}
html.m:not(.ci-go) .ob-day.now b::before{animation:obHi 0s 2.8s forwards}
@keyframes obHi{to{transform:skewX(-8deg)}}
/* the index card */
.ob-card{position:relative;min-height:clamp(20rem,14rem + 14vw,30rem);padding-left:clamp(3.4rem,2.6rem + 2vw,4.6rem)}
.ob-card .ob-rules path{stroke:var(--pop);stroke-opacity:.5}
.ob-card-n{font-family:var(--font-display);font-weight:600;font-size:clamp(2.2rem,1.4rem + 3vw,4.2rem);line-height:.95;letter-spacing:-.05em;padding-bottom:1.2rem}
.ob-card-l li{position:relative;display:flex;align-items:center;gap:.8rem;min-height:clamp(2.8rem,2.2rem + 1.4vw,3.6rem);border-top:1px solid var(--rule);font-size:clamp(1rem,.9rem + .4vw,1.25rem)}
.ob-card-l .ob-slip{position:static;height:auto;padding:0;background:none;border:0;box-shadow:none}
.ob-card-l li:last-child{border-bottom:1px solid var(--rule)}
html.m .ob-desk{transition:transform 1.1s var(--ease) .1s}
html.m:not(.ci-go) .ob-desk{transform:translate3d(0,2.5rem,0) rotate(-5deg)}
/* inside: a pinned index of pages */
.ob-inside{border-bottom:1px solid var(--rule)}
.ob-stage{padding-block:clamp(4.5rem,3rem + 6vw,8rem)}
.ob-inside-in{display:grid;gap:2.5rem}
.ob-of{margin-top:1rem;font-size:.95rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-pages{counter-reset:pg;border-top:1px solid var(--rule-hi)}
.ob-page{position:static;display:grid;grid-template-columns:3rem minmax(0,1fr);gap:1rem;padding-block:1.1rem;border-bottom:1px solid var(--rule)}
.ob-pn{padding-top:.35rem;font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-page p{font-family:var(--font-display);font-size:clamp(1.3rem,1rem + 1.3vw,2.25rem);line-height:1.12;letter-spacing:-.035em;max-width:24ch;transition:color .4s ease}
.ob-big{display:none}
html.m .ob-page p{color:var(--muted)}
html.m .ob-page.on p{color:var(--ink)}
@media (min-width:64rem){.ob-inside-in{grid-template-columns:repeat(12,minmax(0,1fr));gap:1.5rem}.ob-inside-head{grid-column:1/6;position:relative}.ob-pages{grid-column:6/13}}
@media (min-width:48rem) and (hover:hover){
html.m .ob-inside[data-sc]{height:calc(100vh + 85vh + var(--n,3) * 8vh)!important;height:calc(100svh + 85svh + var(--n,3) * 8svh)!important}
html.m .ob-pages{background:linear-gradient(var(--neon),var(--neon)) 0 0/2px calc(var(--p,0) * 100%) no-repeat}
html.m .ob-pn{padding-left:.75rem}
html.m .ob-stage{position:sticky;top:0;min-height:100vh;min-height:100svh;display:grid;align-items:center;padding-block:5rem 3rem}
html.m .ob-inside-in{position:relative;min-height:min(34rem,70vh)}
html.m .ob-page.on p{color:var(--muted)}
html.m .ob-page.cur p{color:var(--ink)}
html.m .ob-page.cur .ob-pn{color:var(--pop)}
}
@media (min-width:64rem) and (hover:hover){
html.m .ob-big{display:block;position:absolute;left:0;bottom:0;font-family:var(--font-display);font-size:clamp(9rem,4rem + 12vw,17rem);line-height:.8;letter-spacing:-.07em;color:var(--pop);font-variant-numeric:tabular-nums;opacity:0;transform:translateY(.15em);transition:opacity .35s ease,transform .6s var(--ease)}
html.m .ob-page.cur .ob-big{opacity:1;transform:none}
html.m .ob-page.cur .ob-pn{color:var(--muted)}
}
/* plans: a price table ruled on a planner sheet */
.ob-plans{border-bottom:1px solid var(--rule)}
.ob-plans-in{display:grid;gap:2.5rem}
@media (min-width:64rem){.ob-plans-in{grid-template-columns:5fr 7fr;gap:1.5rem}}
.ob-ledger{padding:clamp(1rem,.6rem + 1.4vw,2rem);background:var(--sheet);border:1px solid var(--rule);box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 10%,transparent)}
.ob-ledger table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.ob-ledger thead th{padding:.5rem .6rem .5rem 0;font-size:.75rem;font-weight:500;color:var(--muted);text-align:left;border-top:1px solid var(--rule-hi);border-bottom:1px solid var(--rule)}
.ob-ledger tbody th,.ob-ledger td{padding:1.1rem .6rem 1.1rem 0;border-bottom:1px solid var(--rule);text-align:left;vertical-align:baseline}
.ob-ledger tbody th{font-family:var(--font-display);font-size:clamp(1.25rem,1rem + .8vw,1.7rem);font-weight:600;letter-spacing:-.04em;white-space:nowrap}
.ob-ledger td{color:var(--muted)}
.ob-ledger .ob-num{text-align:right;padding-right:0}
.ob-ledger td.ob-num{font-family:var(--font-display);font-size:clamp(1.3rem,1rem + .9vw,1.8rem);font-weight:600;letter-spacing:-.04em;color:var(--ink);white-space:nowrap}
@media (max-width:39.99rem){.ob-ledger thead{display:none}.ob-ledger tr{display:grid;grid-template-columns:1fr auto;padding-block:.9rem;border-bottom:1px solid var(--rule)}.ob-ledger tbody th,.ob-ledger td{padding:0;border:0}.ob-ledger td:not(.ob-num){grid-column:1/-1;grid-row:2;padding-top:.3rem}}
.ob-ledger-cta{margin-top:1.6rem}
.ob-one-in{display:grid;gap:1rem;justify-items:start}
.ob-one-p{font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,3.6rem);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.ob-one{border-bottom:1px solid var(--rule)}
/* about */
.ob-about-in{display:grid;gap:1.5rem}
@media (min-width:64rem){.ob-about-in{grid-template-columns:repeat(12,minmax(0,1fr))}.ob-about-in>.ob-side{grid-column:1/4}.ob-about-in>div{grid-column:4/12}}
.ob-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.ob-say{font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 1.8vw,2.8rem);line-height:1.12;letter-spacing:-.04em;max-width:26ch}
.ob-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--rule-hi);padding:1.4rem 0 0}
/* questions */
.ob-faq{border-bottom:1px solid var(--rule)}
.ob-faq-in{display:grid;gap:2.5rem}
@media (min-width:64rem){.ob-faq-in{grid-template-columns:5fr 7fr;gap:1.5rem}}
.ob-notes{border-top:1px solid var(--rule-hi)}
.ob-notes div{display:grid;gap:.35rem;padding-block:1.2rem;border-bottom:1px solid var(--rule)}
.ob-notes dt{font-family:var(--font-display);font-weight:600;font-size:1.2rem;letter-spacing:-.03em}
.ob-notes dd{color:var(--muted)}
/* end */
.ob-end{overflow:hidden;padding-top:clamp(4.5rem,3rem + 6vw,9rem)}
.ob-end-in{display:grid;gap:1.4rem;justify-items:start}
.ob-prices{display:flex;flex-wrap:wrap;gap:.3rem 1.4rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-prices span+span{padding-left:1.4rem;border-left:1px solid var(--rule)}
.ob-end .ob-ctas{margin-top:.6rem}
.ob-form{width:min(100%,30rem)}
.ob-word{margin-top:clamp(3rem,2rem + 4vw,6rem);margin-left:-.06em;padding-bottom:clamp(1rem,.5rem + 1.5vw,2.5rem);font-family:var(--font-display);font-weight:600;font-size:min(22rem,calc(94vw / (var(--len,10) * .7)));line-height:.9;letter-spacing:-.07em;white-space:nowrap;color:var(--ink)}
.field input{border-radius:3px;border-color:var(--rule);background:var(--sheet)}
.ob-ftr{padding-block:clamp(3rem,2rem + 3vw,5rem) 1.5rem;border-top:1px solid var(--rule-hi);background:var(--sheet)}
.ob-ftr-in{display:grid;gap:1.6rem}
@media (min-width:64rem){.ob-ftr-in{grid-template-columns:5fr 7fr;gap:1.5rem;align-items:start}}
.ob-ftr-n{font-family:var(--font-display);font-weight:600;font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);letter-spacing:-.045em;line-height:1}
.ob-ftr-n span{display:block;margin-top:.5rem;font-family:var(--font-body);font-weight:400;font-size:.9rem;letter-spacing:0;color:var(--muted)}
.ob-ftr-dl{border-top:1px solid var(--rule-hi)}
.ob-ftr-dl div{display:grid;grid-template-columns:5rem 1fr;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--rule);font-size:.95rem}
.ob-ftr-dl dt{color:var(--muted);font-size:.8rem;padding-top:.15rem}
.ob-ftr-dl dd{display:flex;flex-wrap:wrap;gap:.2rem 1.2rem}
.ob-ftr-dl a{text-decoration:none}.ob-ftr-dl a:hover{text-decoration:underline;text-decoration-color:var(--pop)}
.ob-ftr-c{font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
@media (min-width:64rem){.ob-ftr-c{grid-column:2}}
.mbar{background:var(--bg);border-top-color:var(--rule);box-shadow:none}
.mbar .btn{border-radius:3px}
.mpause{border-radius:3px}
/* dark: the same planner at night, on a graphite desk; the hairlines soften, the lamp-lit sheet stays paper */
html[data-theme="dark"] body{--rule:color-mix(in srgb,var(--ink) 14%,transparent);--rule-hi:color-mix(in srgb,var(--ink) 42%,transparent);--sheet:color-mix(in srgb,var(--bg) 93%,var(--ink))}
html[data-theme="dark"] .ob-desk{--rule-hi:#1c1b18}
html[data-theme="dark"] .ob-ledger{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--ink) 6%,transparent)}
html[data-theme="dark"] .btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
html[data-theme="dark"] .ob-ph{box-shadow:inset 1px 0 0 color-mix(in srgb,var(--ink) 8%,transparent)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Orbit',
  bestFor: 'Software, apps, templates and other digital products sold online, with plans',
  match: /\b(software|apps?|saas|platform|plugin|extension|templates?|digital products?|courses?|ebooks?|presets|notion|api)\b/,
  why: 'Built for software and digital products: the product drawn as a planner page whose days tick themselves off, what is inside as a pinned index of pages, and the plans as a price table on planner paper.',
  fonts: { q: 'family=Syne:wght@600;700;800&family=Inter:wght@400;500;600', display: ['Syne', 'grotesk'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): the page opens and the month fills, a sheet you can nudge, an index that pins.
  choreo: { intro: 'draw', alive: ['pointer', 'tap'], scroll: 'pin', pace: 'fast', look: 'planner paper and graphite, precise, unhurried' },
  modes: ['light', 'dark'],
  tokens,
  slots,
  art,
  nav,
  render,
};
