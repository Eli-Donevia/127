// Bloom (animated, studio): an editorial motion study for florists and small studios.
//   Object:   the stem and the bunch: one flower drawn in a single line, and loose stems (photo tiles) gathered into
//             one bouquet (one full photo).
//   Material: white newsprint and black ink: a masthead, 1px ink rules, square corners, a giant wide grotesk.
//   One move: the bloom opens. The name's letters unfold up from their baseline one by one like petals opening
//             (choreo intro 'unfold').
//   Pop:      the member's colour as the line under the name's last word, the drawn stem, and the roadmap's line. Never
//             a fill: the fields behind the tiles and the visit band are ink.
// At rest the tiles lean toward the pointer and drift. Scroll: the tiles gather into one full photo (pinned), the stem
// draws itself beside the story, and the services draw in as a roadmap ending at the Book button; all backwards when
// scrolling up, all on the choreo runtime's --p (no script of its own). JavaScript off and reduced motion: the tiles
// sit in a grid, the photo is full width, the drawing and the roadmap are complete.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { heroFacts, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS, servicesByCategory, groupNodes } = require('../roadmap');

const id = 'bloom';
const TILES = [
  { x: -34, y: -22, r: -7, s: 'portrait' },
  { x: 30, y: -26, r: 5, s: 'arch' },
  { x: -26, y: 24, r: 4, s: 'mesh' },
  { x: 34, y: 20, r: -5, s: 'plates' },
  { x: 2, y: -2, r: 2, s: 'object' },
];

function tokens(p) {
  return { bg: color.mix(p.paper, '#ffffff', 0.94), dark: color.mix(p.ink, '#111111', 0.8) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const pool = [...g, `${c.name}, recent work`];
  return [
    ...TILES.map((t, i) => ({ slot: `t${i + 1}`, file: `tile-${i + 1}.jpg`, w: 900, h: 1100, style: t.s, alt: pool[i % pool.length] })),
    { slot: 'full', file: 'wide.jpg', w: 2000, h: 1200, style: 'sweep', alt: c.profile.hero || `Inside ${c.name}` },
  ];
}

function nav(c) {
  return [
    c.services.length && { label: c.template === 'studio' ? 'Menu' : 'Services', href: '#menu' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Visit', href: '#visit' },
  ].filter(Boolean);
}

// The name as masked letters; --fs fits it to the width on one line, --fsm to a phone with one word per line.
function giant(name) {
  const len = [...name].length;
  const longest = Math.max(...name.split(/\s+/).map((w) => [...w].length));
  const fs = Math.max(8, Math.min(22, 124 / Math.max(len, 4)));
  const fsm = Math.max(fs, Math.min(28, 108 / Math.max(longest, 3)));
  const html = name
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="bl-w ci-w">${[...w].map((ch) => `<span class="bl-m" data-ci-part>${esc(ch)}</span>`).join('')}</span>`))
    .join('');
  return { html, fs, fsm };
}

// A botanical line drawing (one stem, leaves and an open flower), drawn with the scroll.
const DRAWING = `<svg class="bl-draw" viewBox="0 0 300 420" aria-hidden="true"><path pathLength="1" d="M150 410C150 330 146 270 152 200M151 300C120 290 92 262 86 228 118 232 146 256 151 300ZM152 252C178 236 210 226 232 200 200 194 166 214 152 252ZM152 200C126 196 104 176 104 150 104 120 128 104 152 128 168 100 204 104 206 134 232 132 246 160 228 180 246 200 232 228 206 222 204 248 172 252 160 226 150 238 132 230 136 210M152 128C150 148 152 170 152 200M170 176C178 166 192 162 206 166M134 172C126 160 116 156 104 160"/></svg>`;

function render(c) {
  const g = giant(c.name);
  const facts = heroFacts(c, 3);
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const formAsk = c.primary.kind === 'form';

  const hero = `<section class="bl-hero" aria-labelledby="hero-title">
<h1 class="bl-giant" id="hero-title" data-ci="head" style="--fs:${g.fs.toFixed(1)}vw;--fsm:${g.fsm.toFixed(1)}vw" aria-label="${esc(c.name)}"><span aria-hidden="true">${g.html}</span></h1>
<div class="wrap bl-intro">
<p class="bl-lead">${esc(c.heroSub)}</p>
<div class="bl-act" data-ci="then">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}${facts.length ? `<ul class="bl-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</div>
</div>
</section>`;

  const tiles = `<section class="bl-tiles" aria-label="${esc(`Photos from ${c.name}`)}" data-sc>
<div class="bl-pin" data-sc-stage>
<ul class="bl-field">${TILES.map((t, i) => `<li class="bl-tile" style="--x:${t.x}vw;--y:${t.y}vh;--r:${t.r}deg;--i:${i}"><div class="bl-tile-in" data-alive="0.6">${P.img(c, `t${i + 1}`, { cls: 'bl-tile-img' })}</div></li>`).join('')}</ul>
<div class="bl-full">${P.img(c, 'full', { cls: 'bl-full-img' })}</div>
</div>
</section>`;

  // The services as a roadmap (by category when the member grouped them, each with its lowest price), drawn in with
  // the scroll and ending at the button. The full price list follows when the roadmap cannot show every service.
  const groups = servicesByCategory(c);
  const nodes = groupNodes(groups);
  const everyOne = groups.length === 1 && c.services.length <= 6;
  const label = c.template === 'studio' ? 'Menu' : 'Services';
  const road = roadmap({ id: 'menu', cls: 'bl-road', title: label, nodes, end: mag(P.button(c.primary, 'btn btn-primary')), endLabel: c.name });
  const list = c.services.length
    ? `<ul class="bl-menu">${c.services.map((s, i) => `<li><span class="bl-n">${String(i + 1).padStart(2, '0')}</span><span class="bl-mt">${esc(s.name)}${s.duration || s.blurb ? `<small>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</small>` : ''}</span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>`
    : '';
  const incl = c.included.length ? `<ul class="bl-incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const menu = road
    ? road.replace(/<\/div>\n<\/section>$/, `${everyOne ? '' : `<h3 class="bl-sub">Every price</h3>${list}`}${incl}</div>\n</section>`)
    : c.services.length || incl
      ? `<section class="bl-sec" id="menu" aria-labelledby="menu-title"><div class="wrap">
<h2 class="bl-t" id="menu-title">${esc(label)}</h2>
${list}${incl}
<div class="bl-menu-cta">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}</div>
</div></section>`
      : '';

  const about = `<section class="bl-sec bl-about" id="about" data-sc aria-labelledby="about-title"><div class="wrap bl-about-grid">
<div class="bl-art">${DRAWING}</div>
<div><h2 class="bl-h" id="about-title">${esc(c.owner && c.owner !== c.name ? `Hello, I'm ${c.owner}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p class="${i ? 'bl-p' : 'bl-say'}" data-rv>${esc(p)}</p>`).join('\n')}
${c.promise ? `<p class="bl-p" data-rv>${esc(c.promise)}</p>` : ''}</div>
</div></section>`;

  const how = c.steps.length
    ? `<section class="bl-sec" aria-labelledby="how-title"><div class="wrap"><h2 class="bl-h" id="how-title">How it works</h2><ol class="bl-steps">${c.steps.map((s, i) => `<li><span class="bl-n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="bl-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="bl-h" id="reviews-title">Kind words</h2><div data-rv>${P.reviews(c)}</div></div></section>` : '';
  const faq = c.faq.length ? `<section class="bl-sec" id="faq" aria-labelledby="faq-title"><div class="wrap bl-two"><h2 class="bl-t" id="faq-title">Questions</h2>${P.faq(c.faq)}</div></section>` : '';

  const visit = `<section class="bl-sec bl-visit" id="visit" aria-labelledby="visit-title"><div class="wrap bl-two">
<div><h2 class="bl-t bl-visit-h" id="visit-title">${esc(c.hours.rows.length ? `Open ${c.hours.rows.filter((r) => !r.closed).map((r) => `${r.days}, ${r.time}`).join('. ')}.` : c.address ? c.address.split(',')[0] : 'Book a time.')}</h2>${c.ctaSub ? `<p class="bl-p">${esc(c.ctaSub)}</p>` : ''}
${formAsk ? '' : `<div class="bl-act">${mag(P.button(c.primary, 'btn btn-light btn-lg'))}</div>`}
${P.contactList(c, { showHours: false })}</div>
${formAsk ? `<div id="contact" class="bl-form">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.when }, { ...P.FIELD_PRESETS.message, label: 'What would you like?' }], submit: 'Send', subject: `Request from your website` })}</div>` : ''}
</div></section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'bl-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, tiles, menu, about, how, reviews, faq, visit, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '84rem' } };
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
@font-face{font-family:'Bloom Display Fallback';font-weight:500 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold');size-adjust:98%}
@font-face{font-family:'Bloom Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:106.4%}
html:root{--font-display:"Archivo","Bloom Display Fallback",sans-serif;--font-body:"Inter","Bloom Body Fallback",sans-serif}
body{--acc:var(--dark);--on-acc:var(--on-dark)}
.btn-primary{box-shadow:none}
.btn:hover{transform:none}
h1,h2,h3{font-weight:800;letter-spacing:-.04em;font-stretch:118%}
.btn{font-weight:600;letter-spacing:.01em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.85rem}
.btn-light{background:var(--on-dark);color:var(--dark)}
.btn-light:hover{background:var(--button);color:var(--on-button)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--ink)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-stretch:120%;letter-spacing:-.03em;text-decoration:none;text-transform:uppercase}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.4rem .7rem;font-size:.85rem;font-weight:500;text-decoration:none;text-transform:uppercase;letter-spacing:.06em}
.nav a{background:linear-gradient(var(--pop),var(--pop)) .7rem calc(100% - .2rem)/0 1px no-repeat;transition:background-size .35s cubic-bezier(.16,1,.3,1)}
.nav a:hover{background-size:calc(100% - 1.4rem) 1px}
.menu>summary{border-radius:0;border-color:var(--ink)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.bl-n{font-size:.78rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.bl-hero{padding-top:clamp(1.5rem,1rem + 2vw,3rem)}
.bl-giant{margin:clamp(.5rem,1vw,1.5rem) 0 0;padding-inline:1.5vw;font-size:var(--fs);line-height:.82;letter-spacing:-.06em;font-weight:900;font-stretch:125%;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.bl-w{display:inline-block;white-space:nowrap}
.bl-m{display:inline-block;vertical-align:top}
@media (max-width:47.99rem){.bl-giant{font-size:var(--fsm);white-space:normal}}
.bl-intro{display:grid;gap:1.6rem;padding-block:clamp(1.5rem,1rem + 2vw,3rem) clamp(3rem,2rem + 4vw,6rem)}
@media (min-width:60rem){.bl-intro{grid-template-columns:repeat(12,1fr);gap:1.5rem}.bl-lead{grid-column:1 / span 6}.bl-act{grid-column:8 / span 5;align-self:end}}
.bl-lead{max-width:21em;font-size:clamp(1.25rem,1rem + 1vw,1.9rem);font-weight:500;line-height:1.25;letter-spacing:-.02em}
.bl-act{display:grid;gap:1rem;justify-items:start}
.bl-facts{display:flex;flex-wrap:wrap;gap:.3rem 1.2rem;font-size:.92rem;color:var(--muted)}
/* tiles on the accent field, collapsing into one photo */
.bl-tiles{--p:1;background:var(--acc)}
.bl-pin{position:relative}
.bl-field{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;padding:clamp(1rem,3vw,3rem)}
@media (min-width:48rem){.bl-field{grid-template-columns:repeat(5,1fr)}}
.bl-tile-in{background:var(--bg);padding:.5rem}
.bl-tile-img{width:100%;aspect-ratio:9/11;object-fit:cover}
.bl-full-img{width:100%;height:auto;aspect-ratio:5/3;object-fit:cover}
html.m .bl-tiles{height:230vh;height:230svh}
html.m .bl-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}
html.m .bl-field{display:block;position:absolute;inset:0;padding:0}
html.m .bl-tile{position:absolute;left:50%;top:50%;width:clamp(9rem,17vw,16rem);transform:translate(-50%,-50%) translate(calc(var(--x) * (1 - var(--p) * 1.3)),calc(var(--y) * (1 - var(--p) * 1.3))) rotate(calc(var(--r) * (1 - var(--p)))) scale(calc(1 - var(--p) * .25));opacity:clamp(0,calc((.78 - var(--p)) * 4),1)}
html.m .bl-full{position:absolute;inset:0;overflow:hidden;transform:scale(calc(.3 + .7 * clamp(0,(var(--p) - .35) * 1.7,1)));opacity:clamp(0,calc((var(--p) - .32) * 8),1)}
html.m .bl-full-img{height:100%;aspect-ratio:auto;transform:scale(calc(1.25 - var(--p) * .25))}
@media (max-width:47.99rem){html.m .bl-tile{width:38vw}}
/* sections */
.bl-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem);border-top:1px solid var(--ink)}
.bl-t{font-size:clamp(2.6rem,1.4rem + 5vw,6.4rem);line-height:.9;text-transform:uppercase;margin-bottom:clamp(1.5rem,1rem + 2vw,3rem)}
.bl-h{font-size:1rem;font-family:var(--font-body);font-weight:600;font-stretch:100%;letter-spacing:0;margin-bottom:1.25rem}
.bl-road{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem);border-top:1px solid var(--ink);--rm-accent:var(--pop)}
.bl-road .h2{font-size:clamp(2.6rem,1.4rem + 5vw,6.4rem);line-height:.9;text-transform:uppercase;font-weight:900}
.bl-road .rm-dot{border-radius:0;font-size:.75rem}
.bl-road .rm-txt h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem);font-weight:800;font-stretch:112%;letter-spacing:-.03em}
.bl-road .rm-meta{font-family:var(--font-display);font-size:1.3rem;font-weight:700;color:var(--ink)}
.bl-sub{margin:4rem 0 1rem;font-family:var(--font-body);font-size:1rem;font-weight:600;font-stretch:100%;letter-spacing:0}
.bl-menu-cta{margin-top:2rem}
.bl-menu{border-top:2px solid var(--ink)}
.bl-menu li{display:grid;grid-template-columns:3rem 1fr auto;gap:1rem;align-items:baseline;padding:1.2rem 0;border-bottom:1px solid var(--line);transition:background-color .25s ease,color .25s ease,padding .25s ease}
.bl-menu li:hover strong{color:var(--pop)}
.bl-mt{display:grid;gap:.15rem;font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + 1vw,2rem);font-weight:700;font-stretch:112%;letter-spacing:-.03em;line-height:1.1}
.bl-mt small{font-family:var(--font-body);font-size:.95rem;font-weight:400;font-stretch:100%;letter-spacing:0;color:var(--muted)}
.bl-menu strong{font-family:var(--font-display);font-size:1.3rem;font-weight:700;white-space:nowrap}
.bl-incl{display:grid;margin-top:2.5rem;border-top:1px solid var(--ink)}
@media (min-width:48rem){.bl-incl{grid-template-columns:1fr 1fr;column-gap:2rem}}
.bl-incl li{padding:.7rem 0;border-bottom:1px solid var(--line)}
.bl-about-grid{display:grid;gap:2rem}
@media (min-width:56rem){.bl-about-grid{grid-template-columns:5fr 7fr;gap:4rem;align-items:center}}
.bl-art{display:grid;place-items:center;border:1px solid var(--ink);aspect-ratio:1}
.bl-draw{width:62%;height:auto;fill:none;stroke:var(--pop);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.bl-about{--p:1}
html.m .bl-draw path{stroke-dasharray:1;stroke-dashoffset:calc(1 - min(1,var(--p) * 2))}
.bl-say{font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.6vw,2.6rem);font-weight:600;font-stretch:108%;line-height:1.15;letter-spacing:-.03em}
.bl-p{margin-top:1.2rem;max-width:38rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.bl-steps{display:grid;gap:1.5rem}
@media (min-width:56rem){.bl-steps{grid-template-columns:repeat(3,1fr)}}
.bl-steps li{display:grid;gap:.5rem;padding-top:1rem;border-top:2px solid var(--ink)}
.bl-steps p{color:var(--muted)}
.bl-two{display:grid;gap:2rem}
@media (min-width:60rem){.bl-two{grid-template-columns:1fr 1fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--ink);border-radius:0;background:transparent}
.faq summary{padding:1.2rem 0;font-size:1.1rem}
.faq .ans{padding:0 0 1.2rem}
.bl-visit{background:var(--acc);color:var(--on-acc);border-top:0;--ink:var(--on-acc);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--focus:var(--on-acc)}
.bl-visit-h{max-width:9em;font-size:clamp(2.2rem,1.2rem + 4vw,5.2rem);line-height:.95}
.bl-visit .bl-p{opacity:.9}
.bl-visit .bl-act{margin-top:2rem}
.bl-visit .contact-list{margin-top:2rem}
.bl-form{padding:clamp(1.25rem,1rem + 1.5vw,2rem);background:var(--bg);color:var(--ink);--ink:#111;--muted:#555}
.ftr{border-top:0}
`;

module.exports = {
  id,
  kind: 'studio',
  name: 'Bloom',
  bestFor: 'Florists, flower and plant studios, yoga and pilates studios, small design studios: a bold, editorial page',
  match: /\b(florists?|floral|flowers?|botanical|bouquets?|yoga|pilates|barre|design studio|creative studio|tattoo studio)\b/,
  why: 'Built like an editorial motion study: your name set giant on white opens letter by letter like petals, photo tiles lean toward the cursor and gather into one full photo as you scroll, a line drawing draws itself, and your services draw in as a route to the button.',
  fonts: { q: 'family=Archivo:wdth,wght@100..125,500..900&family=Inter:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): petals opening, stems that lean your way, a bunch the scroll gathers up.
  choreo: { intro: 'unfold', alive: ['pointer', 'drift'], scroll: 'scene', pace: 'medium', look: 'white newsprint, black ink, one colour as light' },
  tokens,
  slots,
  nav,
  render,
};
