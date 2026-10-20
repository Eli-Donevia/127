// Bloom (animated, studio): a botanical plate for florists and small studios.
//   Object:   the stem and the bunch. The hero is a botanical plate: one flower drawn in a single line inside a ruled
//             plate frame, the name set beside it like the plate's title. Further down, loose stems lie across the
//             page and the scroll gathers them into one tied bunch. The price list is the shop's card on its string.
//   Material: white newsprint and black ink: 1px and 1.5px ink rules, square corners, a heavy wide grotesk.
//   One move: the flower draws itself, stem first, then the head opens, while the name settles from wide tracking
//             (choreo intro 'draw').
//   Pop:      the member's colour is the flower's head in every drawing and the ribbon that ties the bunch. Never a
//             fill, never a line under the name.
// At rest the plate leans toward the pointer and drifts. The one scroll moment is the bunch: the stems swing in from
// where they lie and gather into a fan, then the ribbon is drawn round them (backwards when scrolling up), on the
// choreo runtime's --p. JavaScript off and reduced motion: the bunch is tied, every drawing complete.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'bloom';

function tokens(p) {
  return { bg: color.mix(p.paper, '#ffffff', 0.94), dark: color.mix(p.ink, '#111111', 0.8) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'bunch', file: 'bunch.jpg', w: 1200, h: 1500, style: 'portrait', alt: g[0] || c.profile.hero || `Flowers from ${c.name}` }];
}

function nav(c) {
  return [
    c.services.length && { label: c.template === 'studio' ? 'Prices' : 'Services', href: '#menu' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Visit', href: '#visit' },
  ].filter(Boolean);
}

// The name as words, one to a line, so the draw intro's tracking never rewraps it.
function nameParts(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w bl-word" data-ci-part>${esc(w)}</span>`).join(' ');
}

// The plate: one stem with two leaves (ink) and an open flower (the member's colour), every path drawn on.
const PLATE = `<svg class="bl-plate-svg" viewBox="0 0 300 420" aria-hidden="true"><g class="ink"><path pathLength="1" d="M150 410C150 330 146 270 152 200"/><path pathLength="1" d="M151 300C120 290 92 262 86 228 118 232 146 256 151 300Z"/><path pathLength="1" d="M152 252C178 236 210 226 232 200 200 194 166 214 152 252Z"/></g><g class="head"><path pathLength="1" d="M152 200C126 196 104 176 104 150 104 120 128 104 152 128 168 100 204 104 206 134 232 132 246 160 228 180 246 200 232 228 206 222 204 248 172 252 160 226 150 238 132 230 136 210"/><path pathLength="1" d="M152 128C150 148 152 170 152 200M170 176C178 166 192 162 206 166M134 172C126 160 116 156 104 160"/></g></svg>`;

// Loose stems for the bunch, each a different flower in one line: open bloom, tulip, sprig of buds, frond, daisy.
// Base at (60,360); the head sits at the top. Ink stems, heads in the member's colour.
const HEADS = [
  'M60 92C40 90 28 72 34 56 44 40 58 52 60 62 62 46 80 38 90 52 98 66 84 86 60 92ZM60 92C58 78 60 66 60 62',
  'M60 96C38 92 32 66 40 44 48 56 54 52 60 36 66 52 72 56 80 44 88 66 82 92 60 96Z',
  'M60 150C46 128 40 108 44 90M60 120C74 104 80 86 78 70M44 90a8 8 0 1 1 1 0M78 70a8 8 0 1 1 1 0M60 98a8 8 0 1 1 1 0',
  'M60 210C40 196 30 176 34 160M60 180C80 168 88 150 86 134M60 150C42 138 36 120 40 106M60 124C76 112 82 96 80 82M60 100C48 88 46 74 50 62',
  'M60 70L60 40M60 70L82 48M60 70L90 72M60 70L80 94M60 70L56 98M60 70L36 90M60 70L30 66M60 70L38 46',
];
const STEMS = [
  { stem: 'M60 360C58 260 64 170 60 92', leaf: 'M60 250C40 236 32 214 34 196 50 204 60 222 60 250Z', head: 0, x: -38, r: -64, f: -14 },
  { stem: 'M60 360C62 270 56 170 60 96', leaf: 'M60 230C82 220 92 198 90 180 74 188 62 206 60 230Z', head: 1, x: 30, r: 58, f: -5 },
  { stem: 'M60 360C60 280 60 200 60 150', leaf: '', head: 2, x: -22, r: -38, f: 4 },
  { stem: 'M60 360C58 300 62 250 60 210', leaf: '', head: 3, x: 40, r: 76, f: 12 },
  { stem: 'M60 360C62 240 56 140 60 70', leaf: 'M60 270C42 258 36 240 38 224 52 232 60 248 60 270Z', head: 4, x: -46, r: -84, f: 20 },
  { stem: 'M60 360C58 250 62 160 60 92', leaf: 'M60 210C80 200 88 182 86 166 72 174 62 190 60 210Z', head: 0, x: 22, r: 44, f: -22 },
];
function stemSvg(st, i) {
  return `<svg class="bl-stem" viewBox="0 0 120 380" aria-hidden="true" style="--x:${(st.x * 0.22).toFixed(2)}rem;--r:${st.r}deg;--f:${st.f}deg;--i:${i}"><path class="ink" d="${st.stem}"/>${st.leaf ? `<path class="ink" d="${st.leaf}"/>` : ''}<path class="head" d="${HEADS[st.head]}"/></svg>`;
}

function render(c) {
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const formAsk = c.primary.kind === 'form';
  const open = c.hours.rows.filter((r) => !r.closed);
  const plateCap = [c.name, c.address ? c.address.split(',')[0] : '', c.city].filter(Boolean).join(', ');
  // The lead: what the studio makes, from the services, in the owner's terms.
  const svc = c.services.map((s) => s.name);
  const lc = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const lead = svc.length >= 2 ? `${svc.slice(0, -1).map((t, i) => (i ? lc(t) : t)).join(', ')} and ${lc(svc[svc.length - 1])}${c.city && !c.online ? `, from a small studio in ${c.city}` : ''}.` : c.heroSub;

  const hero = `<section class="bl-hero" aria-labelledby="hero-title">
<div class="wrap bl-hero-grid">
<div class="bl-hero-copy">
<h1 class="bl-name" id="hero-title" data-ci="head">${nameParts(c.name)}</h1>
<p class="bl-lead">${esc(lead)}</p>
<div class="bl-act" data-ci="then" data-ci-from="fade">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg') : ''}</div>
</div>
<figure class="bl-plate"><div class="bl-plate-lean" data-alive="0.4"><div class="bl-plate-in" data-ci="subject">${PLATE}</div></div>${plateCap ? `<figcaption>${esc(plateCap)}</figcaption>` : ''}</figure>
</div>
</section>`;

  // The price list as the shop's card on its string: a punched hole, the services hand set with leaders.
  const list = c.services.length
    ? `<ul class="bl-menu">${c.services.map((s) => `<li><span class="bl-mt">${esc(s.name)}${s.duration || s.blurb ? `<small>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</small>` : ''}</span><span class="bl-dots" aria-hidden="true"></span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>`
    : '';
  const incl = c.included.length ? `<ul class="bl-incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const label = c.template === 'studio' ? 'Prices' : 'Services';
  const menu = list || incl
    ? `<section class="bl-sec bl-shop" id="menu" aria-labelledby="menu-title"><div class="wrap bl-shop-grid">
<div class="bl-card"><span class="bl-hole" aria-hidden="true"></span><h2 class="bl-card-h" id="menu-title">${esc(label)}</h2>${list}${incl}<div class="bl-menu-cta">${mag(P.button(c.primary, 'btn btn-primary'))}</div></div>
<figure class="bl-photo">${P.img(c, 'bunch', { cls: 'bl-photo-img' })}</figure>
</div></section>`
    : '';

  // The scroll moment and the story: loose stems gathered into a bunch beside the member's own words.
  // Generated about copy restates the hero ("X is a Y in Z, run by W. You can reach W directly"); keep what is new.
  const lw = (t) => String(t || '').toLowerCase();
  const restates = (t) => (lw(t).includes(lw(c.name)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  const [say = '', ...more] = c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
  const about = `<section class="bl-sec bl-bunch" id="about" aria-labelledby="about-title" data-sc>
<div class="bl-stage" data-sc-stage>
<div class="wrap bl-bunch-grid">
<div class="bl-story"><h2 class="bl-h" id="about-title">${esc(c.owner && c.owner !== c.name ? `${c.name}, by ${c.owner}` : `About ${c.name}`)}</h2>
${say ? `<p class="bl-say">${esc(say)}</p>` : ''}
${more.map((p) => `<p class="bl-p">${esc(p)}</p>`).join('\n')}
${c.promise ? `<p class="bl-p">${esc(c.promise)}</p>` : ''}</div>
<div class="bl-field" aria-hidden="true">${STEMS.map(stemSvg).join('')}<svg class="bl-ribbon" viewBox="0 0 120 60"><path pathLength="1" d="M18 22C40 34 80 34 102 22M58 30C46 44 38 54 30 58M62 30C72 44 82 52 92 56"/></svg></div>
</div>
</div>
</section>`;

  const how = c.steps.length
    ? `<section class="bl-sec" aria-labelledby="how-title"><div class="wrap"><h2 class="bl-h" id="how-title">How it works</h2><ol class="bl-steps">${c.steps.map((s, i) => `<li><span class="bl-n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="bl-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="bl-h" id="reviews-title">Kind words</h2>${P.reviews(c)}</div></section>` : '';
  const faq = c.faq.length ? `<section class="bl-sec" id="faq" aria-labelledby="faq-title"><div class="wrap bl-two"><h2 class="bl-h" id="faq-title">Questions</h2><dl class="bl-qa">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const visit = `<section class="bl-sec bl-visit" id="visit" aria-labelledby="visit-title"><div class="wrap bl-two">
<div><h2 class="bl-visit-h" id="visit-title">${esc(open.length ? `Open ${open.map((r) => `${r.days}, ${r.time}`).join('. ')}.` : c.address ? c.address.split(',')[0] : 'Book a time.')}</h2>
${formAsk ? '' : `<div class="bl-act">${mag(P.button(c.primary, 'btn btn-light btn-lg'))}</div>`}</div>
<div>${P.contactList(c, { showHours: false })}
${formAsk ? `<div id="contact" class="bl-form">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.when }, { ...P.FIELD_PRESETS.message, label: 'What would you like?' }], submit: 'Send', subject: `Request from your website` })}</div>` : ''}</div>
</div></section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'bl-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, about, how, reviews, faq, visit, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '84rem' } };
}

// The placeholder, drawn: a bunch wrapped in newsprint on the studio bench, the heads in the member's colour, tied
// with string. Over plaster in window light. No text.
function art(slot, { p, seed, index, art: Art }) {
  if (slot.slot !== 'bunch') return null;
  const w = slot.w, h = slot.h;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:bunch`);
  const W = Art.wall({ style: 'portrait', w, h, p, seed, index, quiet: true });
  const ink = color.mix(p.ink, '#1b1b1b', 0.5);
  const leaf = color.mix(ink, '#5c6b4f', 0.55);
  const paper = color.mix(p.paper, '#efe9dc', 0.6);
  const heads = [p.primary, color.mix(p.primary, '#ffffff', 0.3), color.mix(p.primary, '#000000', 0.25), color.mix(p.primary, '#f4e3d7', 0.55)];
  const cx = w / 2, by = h * 0.86;
  let stems = '', blooms = '';
  for (let i = 0; i < 9; i++) {
    const a = (-0.42 + (i / 8) * 0.84) + (r() - 0.5) * 0.08;
    const len = h * (0.5 + r() * 0.12);
    const tx = cx + Math.sin(a) * len, ty = by - Math.cos(a) * len;
    stems += `<path d="M${f(cx + (i - 4) * 4)} ${f(by)}Q${f(cx + Math.sin(a) * len * 0.4)} ${f(by - len * 0.5)} ${f(tx)} ${f(ty)}" stroke="${leaf}" stroke-width="5" fill="none"/>`;
    const R = w * (0.045 + r() * 0.035), col = heads[i % heads.length];
    let petals = '';
    const n = 5 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2 + r();
      petals += `<ellipse cx="${f(tx + Math.cos(t) * R * 0.62)}" cy="${f(ty + Math.sin(t) * R * 0.62)}" rx="${f(R * 0.62)}" ry="${f(R * 0.4)}" transform="rotate(${f((t * 180) / Math.PI)} ${f(tx + Math.cos(t) * R * 0.62)} ${f(ty + Math.sin(t) * R * 0.62)})" fill="${col}"/>`;
    }
    blooms += `<g opacity="${f(0.92 + r() * 0.08)}">${petals}<circle cx="${f(tx)}" cy="${f(ty)}" r="${f(R * 0.28)}" fill="${color.mix(col, '#000', 0.45)}"/></g>`;
    if (r() > 0.4) stems += `<path d="M${f(cx + Math.sin(a) * len * 0.5)} ${f(by - len * 0.5)}q${f(Math.sin(a) * 60 + 30)} -10 ${f(Math.sin(a) * 70 + 50)} -50q-40 0 -${f(Math.abs(Math.sin(a) * 70 + 50))} 50z" fill="${leaf}"/>`;
  }
  // The newsprint cone, folded, with its shadow side; the string round the waist.
  const cone = `M${f(cx - w * 0.3)} ${f(h * 0.5)}L${f(cx + w * 0.3)} ${f(h * 0.46)}L${f(cx + w * 0.06)} ${f(h * 0.98)}L${f(cx - w * 0.05)} ${f(h * 0.98)}Z`;
  const fold = `M${f(cx + w * 0.3)} ${f(h * 0.46)}L${f(cx + w * 0.06)} ${f(h * 0.98)}L${f(cx + w * 0.02)} ${f(h * 0.6)}Z`;
  const defs = `${W.defs}<filter id="bsh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(w * 0.02)}"/></filter>`;
  const body = `${W.body}<ellipse cx="${f(cx + w * 0.06)}" cy="${f(h * 0.97)}" rx="${f(w * 0.3)}" ry="${f(h * 0.02)}" fill="#000" opacity=".22" filter="url(#bsh)"/>${stems}${blooms}<path d="${cone}" fill="${paper}"/><path d="${fold}" fill="${color.mix(paper, '#000', 0.12)}"/><path d="M${f(cx - w * 0.16)} ${f(h * 0.74)}Q${f(cx)} ${f(h * 0.765)} ${f(cx + w * 0.17)} ${f(h * 0.72)}" stroke="${ink}" stroke-width="3" fill="none"/>`;
  return Art.svgDoc(w, h, defs, body);
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Bloom Display Fallback';font-weight:500 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold');size-adjust:98%}
@font-face{font-family:'Bloom Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:106.4%}
html:root{--font-display:"Archivo","Bloom Display Fallback",sans-serif;--font-body:"Inter","Bloom Body Fallback",sans-serif}
body{--acc:var(--dark);--on-acc:var(--on-dark);--button:var(--ink);--on-button:var(--bg)}
.btn{font-weight:600;letter-spacing:.01em;border-radius:0}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg));color:var(--bg)}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}
.btn-line:hover{background:var(--ink);color:var(--bg)}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.85rem}
.btn-light{background:var(--on-dark);color:var(--dark)}
.btn-light:hover{background:color-mix(in srgb,var(--on-dark) 82%,var(--dark));color:var(--dark)}
h1,h2,h3{font-weight:800;letter-spacing:-.04em;font-stretch:118%}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--ink)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-stretch:120%;letter-spacing:-.03em;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.4rem .7rem;font-size:.9rem;font-weight:500;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) .7rem calc(100% - .2rem)/0 1.5px no-repeat;transition:background-size .35s cubic-bezier(.16,1,.3,1)}
.nav a:hover{background-size:calc(100% - 1.4rem) 1.5px}
.menu>summary{border-radius:0;border-color:var(--ink)}
.menu-panel li a{font-weight:800;font-stretch:118%;letter-spacing:-.04em}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.bl-n{font-size:.85rem;font-weight:600;font-variant-numeric:tabular-nums}
/* hero: the botanical plate */
.bl-hero{padding-block:clamp(2rem,1.5rem + 3vw,5rem) clamp(3rem,2rem + 4vw,6rem)}
.bl-hero-grid{display:grid;gap:2.5rem}
@media (min-width:56rem){.bl-hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;align-items:center}.bl-hero-copy{grid-column:1 / span 6}.bl-plate{grid-column:7 / span 6}}
.bl-hero-copy{display:grid;gap:1.5rem;justify-items:start}
.bl-name{font-size:clamp(3.4rem,1.4rem + 8vw,9.6rem);line-height:.86;letter-spacing:-.06em;font-weight:900;font-stretch:125%}
.bl-word{display:block;width:max-content}
.bl-lead{max-width:24em;font-size:clamp(1.15rem,1rem + .5vw,1.45rem);line-height:1.35}
.bl-act{display:flex;flex-wrap:wrap;gap:.75rem}
.bl-plate{margin:0;width:100%;max-width:min(30rem,62svh);justify-self:end}
.bl-plate-in{display:grid;place-items:center;aspect-ratio:4/5;border:1.5px solid var(--ink);outline:1px solid var(--ink);outline-offset:-10px}
.bl-plate-svg{width:68%;height:auto;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.bl-plate-svg .ink{stroke:var(--ink)}
.bl-plate-svg .head{stroke:var(--pop)}
.bl-plate figcaption{margin-top:.7rem;font-size:.9rem;color:var(--muted)}
/* the shop's price card on its string, beside the bunch */
.bl-sec{padding-block:clamp(4rem,3rem + 4vw,8rem);border-top:1px solid var(--ink)}
.bl-shop-grid{display:grid;gap:2.5rem;align-items:center}
@media (min-width:56rem){.bl-shop-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.bl-card{grid-column:1 / span 6}.bl-photo{grid-column:8 / span 5}}
.bl-card{position:relative;padding:clamp(2.6rem,2rem + 2vw,3.6rem) clamp(1.25rem,1rem + 2vw,2.75rem) clamp(1.5rem,1rem + 2vw,2.5rem);border:1.5px solid var(--ink);background:var(--bg);transform:rotate(-1.2deg)}
.bl-hole{position:absolute;left:50%;top:1rem;width:.9rem;height:.9rem;margin-left:-.45rem;border:1.5px solid var(--ink);border-radius:50%}
.bl-hole::before{content:'';position:absolute;left:50%;bottom:100%;width:1.5px;height:3rem;margin-left:-.75px;background:var(--ink)}
.bl-card-h{text-align:center;font-size:clamp(2rem,1.4rem + 2.4vw,3.4rem);line-height:.95;margin-bottom:1.5rem}
.bl-menu{border-top:1.5px solid var(--ink)}
.bl-menu li{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:.75rem;padding:1rem 0;border-bottom:1px solid var(--line)}
.bl-mt{display:grid;gap:.15rem;font-family:var(--font-display);font-weight:700;font-stretch:112%;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);letter-spacing:-.02em}
.bl-mt small{font-family:var(--font-body);font-weight:400;font-stretch:100%;font-size:.9rem;letter-spacing:0;color:var(--muted)}
.bl-dots{align-self:start;margin-top:1em;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 40%,transparent)}
.bl-menu strong{font-family:var(--font-display);font-weight:800;font-stretch:112%;font-size:clamp(1.1rem,1rem + .5vw,1.4rem);white-space:nowrap;font-variant-numeric:tabular-nums}
.bl-menu li:hover strong{color:var(--primary-text)}
.bl-incl{display:grid;margin-top:1.5rem;border-top:1px solid var(--ink)}
.bl-incl li{padding:.7rem 0;border-bottom:1px solid var(--line)}
.bl-menu-cta{display:flex;justify-content:center;margin-top:1.75rem}
.bl-photo{margin:0}
.bl-photo-img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
/* the bunch: loose stems the scroll gathers and ties */
.bl-bunch{padding:0}
.bl-bunch-grid{display:grid;gap:2rem;align-items:center}
@media (min-width:56rem){.bl-bunch-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.bl-story{grid-column:1 / span 6}.bl-field{grid-column:7 / span 6}}
.bl-story{display:grid;gap:1.25rem;justify-items:start}
.bl-h{font-family:var(--font-body);font-size:1rem;font-weight:600;font-stretch:100%;letter-spacing:0}
.bl-say{font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 2vw,2.8rem);font-weight:700;font-stretch:110%;line-height:1.08;letter-spacing:-.035em}
.bl-p{max-width:36rem;font-size:1.05rem;line-height:1.6;color:var(--muted)}
.bl-field{position:relative;height:min(64vh,34rem);min-height:18rem;overflow:hidden}
@media (max-width:55.99rem){.bl-field{height:38svh;min-height:15rem}.bl-say{font-size:1.35rem}}
.bl-stem{position:absolute;left:50%;bottom:8%;width:min(30%,9rem);height:auto;margin-left:max(-15%,-4.5rem);fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transform-origin:50% 96%;transform:rotate(var(--f))}
.bl-stem .ink{stroke:var(--ink)}
.bl-stem .head{stroke:var(--pop)}
.bl-ribbon{position:absolute;left:50%;bottom:3%;width:min(30%,9rem);margin-left:max(-15%,-4.5rem);fill:none;stroke:var(--pop);stroke-width:3;stroke-linecap:round}
.bl-bunch{height:170vh;height:170svh}
.bl-stage{position:sticky;top:3.5rem;display:grid;align-items:center;min-height:calc(100vh - 3.5rem);min-height:calc(100svh - 3.5rem);padding-block:2rem}
@media (min-width:56rem){.bl-bunch{height:200vh;height:200svh}}
html.m .bl-bunch{--g:clamp(0,calc(var(--p,1) * 1.6),1)}
html.m .bl-stem{transform:translateX(calc(var(--x) * (1 - var(--g)))) rotate(calc(var(--f) + (var(--r) - var(--f)) * (1 - var(--g))))}
html.m .bl-ribbon path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--p,1) - .62) * 4,1))}
/* steps, questions */
.bl-steps{display:grid;gap:0;border-top:1.5px solid var(--ink)}
@media (min-width:48rem){.bl-steps{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));column-gap:2rem}}
.bl-steps li{display:grid;gap:.4rem;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.bl-steps h3{font-size:1.3rem}
.bl-steps p{color:var(--muted)}
.bl-two{display:grid;gap:2rem}
@media (min-width:56rem){.bl-two{grid-template-columns:1fr 1fr;gap:4rem;align-items:start}}
.bl-qa{border-top:1.5px solid var(--ink)}
.bl-qa div{display:grid;gap:.35rem;padding:1.1rem 0;border-bottom:1px solid var(--line)}
.bl-qa dt{font-weight:600}
.bl-qa dd{color:var(--muted)}
/* visit: the opening-hours poster */
.bl-visit{background:var(--acc);color:var(--on-acc);border-top:0;--ink:var(--on-acc);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--focus:var(--on-acc)}
.bl-visit-h{max-width:9em;font-size:clamp(2.4rem,1.2rem + 4.6vw,6rem);line-height:.92;text-transform:uppercase;font-weight:900;font-stretch:125%}
.bl-visit .bl-act{margin-top:2rem}
.bl-visit .contact-list a{color:var(--on-acc)}
.bl-visit .i{color:var(--primary-on-dark)}
.reviews .review{border-radius:0;border:0;border-top:1.5px solid var(--ink);background:none;padding:1.25rem 0 0}
.ftr{border-top:1.5px solid var(--ink)}
.ftr-name{font-stretch:120%;font-weight:800}
.mbar{border-top:1.5px solid var(--ink)}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'studio',
  name: 'Bloom',
  bestFor: 'Florists, flower and plant studios, yoga and pilates studios, small design studios: a bold, editorial page',
  match: /\b(florists?|floral|flowers?|botanical|bouquets?|yoga|pilates|barre|design studio|creative studio|tattoo studio)\b/,
  why: 'Built like a botanical plate: one flower draws itself in a single line beside your name, your price list hangs like the shop card on its string, and loose stems gather into a tied bunch as you scroll.',
  fonts: { q: 'family=Archivo:wdth,wght@100..125,500..900&family=Host+Grotesk:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Host Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): a flower drawn in one line, a plate that leans your way, a bunch the scroll gathers.
  choreo: { intro: 'draw', alive: ['pointer', 'drift'], scroll: 'scene', pace: 'medium', look: 'white newsprint, black ink, a flower drawn in one line' },
  tokens,
  slots,
  nav,
  render,
  art,
};
