// Foundry (animated, agency): business to business services, set like the studio's own brand guidelines.
//   Object:   the brand guide. The page opens on its cover: the studio's name set as a type specimen with its cap
//             height, x-height and baseline ruled across the sheet, the column ticks of the grid along the top, and
//             the guide itself (drawn: an open spread with the mark's construction and the colour chips) as the
//             subject. Every section after it is a numbered chapter.
//   Material: Swiss poster stock: off-white sheet, black ink, 1.5px rules, square corners, nothing rounded.
//   One move: the type comes up from behind its own baseline, word by word (choreo intro 'mask'); the spread is
//             uncovered from the bottom up and the buttons wipe up the same way.
//   Pop:      the member's colour is the specimen's baseline, drawn across the sheet once the name has landed (data-pop
//             'line' left off; the baseline is the design's own gesture), then the current step of the process.
// At rest the spread leans toward the pointer and lags with the scroll. The one scroll moment is the process: the
// member's steps as columns under a rule that draws itself left to right. Buttons are ink, never the member's colour.
// No outline marquee, no asterisks, no italic accents, no plus accordion. JavaScript off and reduced motion: the
// complete, still page.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const A = require('../../art');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'foundry';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f2f0eb', 0.85), dark: color.mix(p.ink, '#000000', 0.55) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'studio', file: 'studio.jpg', w: 1400, h: 1100, style: 'sweep', alt: c.profile.hero || g[0] || `${c.name} at work` }];
}

// The generated about restates the hero ("X is a Y in Z, run by W. You can reach W directly"); keep only what is new.
function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const who = [c.name, c.owner].filter(Boolean).map(lw);
  const restates = (t) => (who.some((w) => lw(t).includes(w)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  return [
    c.services.length && { label: 'Services', href: '#services' },
    c.steps.length && { label: 'Process', href: '#process' },
    (aboutParas(c).length || c.clients.length) && { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The name split on the server into words (so nothing reflows when the intro starts).
function headParts(title) {
  return String(title || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

// The cover's one line under the specimen: what the studio does and for whom, from the facts ("Brand and website
// design for B2B software companies"), never a category label with "agency" tacked on.
function whatLine(c) {
  const what = String(c.whatShort || '').trim().replace(/\s+(agency|studio|firm|consultancy|company|collective|bureau)$/i, '');
  const aud = c.audience ? lowerFirst(String(c.audience).replace(/^for\s+/i, '').replace(/[.!]+$/, '')) : '';
  if (!what) return c.heroTitle || '';
  return `${what}${aud ? ` for ${aud}` : ''}.`;
}

// The cover's facts: where, and where prices start. Only what the member gave.
function leadLine(c, low) {
  const where = c.online ? 'Working remotely' : c.place || c.city || '';
  const bits = [];
  if (where) bits.push(c.online ? `${where}.` : `Working from ${where}.`);
  if (low) bits.push(`Projects start at ${low.priceText.replace(/^From /, '')}.`);
  return bits.join(' ');
}

// Member Q&A as a two-column sheet: the question set in the display face, the answer beside it. No accordion.
function faqSheet(items) {
  return `<dl class="fx-qa">${items.map((q) => `<div class="fx-qa-row"><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl>`;
}

function render(c) {
  const oneOff = c.services.filter((s) => typeof s.price === 'number' && !s.unit);
  const low = oneOff.length ? oneOff.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const primary = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace('<a ', '<a data-mag ').replace(/<\/a>$/, `${icon('arrowUpRight', { size: 18 })}</a>`);
  let n = 0;
  const chap = (label) => `<p class="fx-chap"><span class="fx-chap-n">${String((n += 1)).padStart(2, '0')}</span>${esc(label)}</p>`;
  const nameLen = [...c.name].length;
  const longest = Math.max(...c.name.split(/\s+/).map((w) => [...w].length));
  const lead = leadLine(c, low);

  const hero = `<section class="fx-hero" aria-labelledby="hero-title">
<div class="wrap">
<div class="fx-ticks" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
${chap('Cover')}
<h1 id="hero-title" class="fx-spec" data-ci="head" style="--fs:${Math.min(10, 150 / Math.max(nameLen, 8)).toFixed(2)}vw;--fsm:${Math.min(15, 170 / Math.max(longest, 6)).toFixed(2)}vw">${headParts(c.name)}<span class="fx-guides" aria-hidden="true"><i class="g-cap"></i><i class="g-x"></i><i class="g-base"></i><span class="gl l-cap"><b>Cap height</b></span><span class="gl l-x"><b>x-height</b></span><span class="gl l-base"><b>Baseline</b></span></span></h1>
<div class="fx-cover">
<div class="fx-cover-copy">
<p class="fx-what">${esc(whatLine(c))}</p>
${lead ? `<p class="fx-lead">${esc(lead)}</p>` : ''}
<div class="fx-ctas" data-ci="then" data-ci-from="mask">${primary()}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}</div>
</div>
<figure class="fx-plate"><div class="fx-plate-lean" data-alive="0.18"><div class="fx-plate-in" data-ci="subject">${P.img(c, 'studio', { cls: 'fx-plate-img', eager: true })}</div></div></figure>
</div>
</div>
</section>`;

  const services = c.services.length
    ? `<section class="fx-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
<div class="fx-head">${chap('Services')}<h2 class="fx-h2" id="services-title">${esc(c.services.some((s) => s.priceText) ? 'What we do, and what it costs' : 'What we do')}</h2></div>
<ol class="fx-rows">
${c.services
  .map(
    (s, i) => `<li class="fx-row">
<div class="fx-row-top"><span class="fx-row-n" aria-hidden="true">${n}.${i + 1}</span><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="fx-row-p">${esc(s.priceText)}</p>` : ''}</div>
${s.blurb || s.duration ? `<div class="fx-row-in">${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${s.duration ? `<p class="fx-row-d">${esc(s.duration)}</p>` : ''}</div>` : ''}
</li>`
  )
  .join('\n')}
</ol>
${c.included.length ? `<div class="fx-incl"><h3>Every project includes</h3><ol>${c.included.map((x, i) => `<li><span aria-hidden="true">${String.fromCharCode(97 + i)}</span>${esc(x)}</li>`).join('')}</ol></div>` : ''}
</div>
</section>`
    : c.included.length
      ? `<section class="fx-sec" id="services" aria-labelledby="services-title"><div class="wrap"><div class="fx-head">${chap('Services')}<h2 class="fx-h2" id="services-title">What you get</h2></div><ul class="fx-incl-big">${c.included.map((x, i) => `<li><span>${n}.${i + 1}</span>${esc(x)}</li>`).join('')}</ul></div></section>`
      : '';

  // The process: the member's steps as columns under one rule that draws itself with the scroll (the roadmap's
  // markup, restyled as a Swiss schedule). No end node with the business name; the button follows the schedule.
  const procN = c.steps.length >= 2 ? n + 1 : 0;
  const process = c.steps.length >= 2
    ? roadmap({ id: 'process', cls: 'fx-process', title: 'How a project runs', nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })) })
        .replace('<div class="rm-head">', `<div class="rm-head"><p class="fx-chap"><span class="fx-chap-n">${String(procN).padStart(2, '0')}</span>Process</p>`)
        .replace(/<\/ol>\n<\/div>\n<\/div>\n<\/section>$/, `</ol>\n</div>\n${c.primary.kind !== 'form' ? `<div class="fx-proc-go">${primary('btn btn-primary')}</div>` : ''}\n</div>\n</section>`)
    : '';
  if (procN) n = procN;

  // The first sentence as a statement, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = aboutParas(c);
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = first || rest.length || c.clients.length
    ? `<section class="fx-sec fx-about" id="about" aria-labelledby="about-title">
<div class="wrap fx-about-grid">
<div class="fx-about-side">${chap('Studio')}<h2 class="fx-about-h" id="about-title">The studio</h2></div>
${first ? `<p class="fx-state" data-rv>${esc(first)}</p>` : ''}
<div class="fx-about-rest">
${rest.map((p) => `<p class="fx-p" data-rv>${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'fx-social' })}
</div>
${c.clients.length ? `<div class="fx-clients"><h3 class="fx-cl-h">Clients</h3><ul class="fx-clients-list">${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="fx-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="fx-head">${chap('Clients')}<h2 class="fx-h2" id="reviews-title">In their words</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="fx-sec" id="faq" aria-labelledby="faq-title"><div class="wrap"><div class="fx-head">${chap('Questions')}<h2 class="fx-h2" id="faq-title">Before you write</h2></div>${faqSheet(c.faq)}</div></section>`
    : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Company' },
    { ...P.FIELD_PRESETS.website, label: 'Company website' },
    c.services.length > 1 ? { name: 'service', label: 'What do you need?', type: 'select', options: [...c.services.map((s) => s.name), 'Not sure yet'], half: true } : null,
    { name: 'timeline', label: 'When do you need it?', type: 'text', half: true },
    { ...P.FIELD_PRESETS.message, label: 'Tell us about the project' },
  ].filter(Boolean);
  const mail = c.email ? `<a class="fx-mail" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '';
  const contact = `<section class="fx-sec fx-contact" id="contact" aria-labelledby="contact-title">
<div class="wrap">
<div class="fx-head">${chap('Contact')}<h2 class="fx-h2" id="contact-title">${esc(c.owner && c.owner !== c.name ? `Write to ${c.owner}` : `Write to ${c.name}`)}</h2></div>
${mail ? `<p class="fx-mail-p">${mail}</p>` : ''}
<div class="fx-contact-grid">
<div class="fx-contact-copy">
${c.primary.kind !== 'form' ? `<div class="fx-ctas">${primary()}</div>` : ''}
${c.promise ? `<p class="fx-promise">${esc(c.promise)}</p>` : ''}
${P.contactList(mail ? { ...c, email: '' } : c, { cls: 'fx-contact-list' })}
</div>
<div class="fx-form">
<h3>Project brief</h3>
${P.form(c, { id: 'contact', fields, submit: 'Send the brief', subject: `Project inquiry for ${c.name}` })}
</div>
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'fx-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, services, process, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '82rem' } };
}

// The placeholder for the studio photo, drawn: the brand guide itself, open on a plaster wall. The left page holds the
// mark on its construction (square, circle, diagonals); the right page the colour chips in the member's palette and a
// layout grid with one module filled. No text (an <img> SVG can't load fonts).
function art(slot, { p, seed, index, art: Art }) {
  if (slot.slot !== 'studio') return null;
  const w = slot.w, h = slot.h;
  const r = Art.rng(`${seed}:guide`);
  const W = Art.wall({ style: 'sweep', w, h, p, seed, index, quiet: true });
  const paper = color.mix(p.paper, '#ffffff', 0.7);
  const ink = color.mix(p.ink, '#000000', 0.3);
  const hair = color.mix(ink, paper, 0.72);
  const pw = w * 0.34, ph = pw * 1.36, x0 = w / 2 - pw, y0 = (h - ph) / 2 + h * 0.02;
  const f = (v) => v.toFixed(1);
  // The mark: one of three simple ink marks, picked by the business name.
  const cx = x0 + pw / 2, cy = y0 + ph * 0.42, s = pw * 0.26;
  const marks = [
    `M${f(cx - s)} ${f(cy + s)}L${f(cx)} ${f(cy - s)}L${f(cx + s)} ${f(cy + s)}L${f(cx)} ${f(cy + s * 0.45)}Z`,
    `M${f(cx - s)} ${f(cy + s)}V${f(cy)}A${f(s)} ${f(s)} 0 0 1 ${f(cx + s)} ${f(cy)}V${f(cy + s)}H${f(cx + s * 0.45)}V${f(cy)}A${f(s * 0.45)} ${f(s * 0.45)} 0 0 0 ${f(cx - s * 0.45)} ${f(cy)}V${f(cy + s)}Z`,
    `M${f(cx - s)} ${f(cy - s)}H${f(cx + s)}V${f(cy - s * 0.4)}H${f(cx - s * 0.2)}V${f(cy + s)}H${f(cx - s)}Z`,
  ];
  const mark = marks[Math.floor(r() * marks.length)];
  const rx = x0 + pw;
  // Right page: three chips, then a 6-column layout grid with one module in the member's colour.
  const chipW = pw * 0.22, chipH = ph * 0.2, chipY = y0 + ph * 0.12;
  const chips = [ink, p.primary, color.mix(p.paper, p.ink, 0.12)].map((col, i) => `<rect x="${f(rx + pw * 0.12 + i * (chipW + pw * 0.04))}" y="${f(chipY)}" width="${f(chipW)}" height="${f(chipH)}" fill="${col}"/><path d="M${f(rx + pw * 0.12 + i * (chipW + pw * 0.04))} ${f(chipY + chipH + ph * 0.03)}h${f(chipW * 0.7)}" stroke="${hair}" stroke-width="3"/>`).join('');
  const gx = rx + pw * 0.12, gy = y0 + ph * 0.48, gw = pw * 0.76, gh = ph * 0.38, col = gw / 6;
  let grid = `<rect x="${f(gx)}" y="${f(gy)}" width="${f(gw)}" height="${f(gh)}" fill="none" stroke="${hair}" stroke-width="2"/>`;
  for (let i = 1; i < 6; i++) grid += `<path d="M${f(gx + i * col)} ${f(gy)}V${f(gy + gh)}" stroke="${hair}" stroke-width="1.2"/>`;
  grid += `<path d="M${f(gx)} ${f(gy + gh * 0.34)}H${f(gx + gw)}" stroke="${hair}" stroke-width="1.2"/>`;
  grid += `<rect x="${f(gx + col * 2)}" y="${f(gy + gh * 0.34)}" width="${f(col * 3)}" height="${f(gh * 0.66)}" fill="${color.mix(p.primary, paper, 0.25)}"/><rect x="${f(gx)}" y="${f(gy)}" width="${f(col * 4)}" height="${f(gh * 0.34)}" fill="${ink}"/>`;
  const defs = `${W.defs}<linearGradient id="fxs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient><filter id="fxb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(w * 0.012)}"/></filter>`;
  const body = `${W.body}<g transform="rotate(${f(-2.5 + r() * 1.5)} ${f(w / 2)} ${f(h / 2)})">
<rect x="${f(x0 + w * 0.012)}" y="${f(y0 + h * 0.022)}" width="${f(pw * 2)}" height="${f(ph)}" fill="${W.shade}" opacity=".45" filter="url(#fxb)"/>
<rect x="${f(x0)}" y="${f(y0)}" width="${f(pw * 2)}" height="${f(ph)}" fill="${paper}"/>
<rect x="${f(x0)}" y="${f(y0)}" width="${f(pw)}" height="${f(ph)}" fill="url(#fxs)"/>
<path d="M${f(rx)} ${f(y0)}V${f(y0 + ph)}" stroke="${color.mix(paper, ink, 0.18)}" stroke-width="2"/>
<g fill="none" stroke="${hair}" stroke-width="1.6"><rect x="${f(cx - s * 1.5)}" y="${f(cy - s * 1.5)}" width="${f(s * 3)}" height="${f(s * 3)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 1.5)}"/><path d="M${f(cx - s * 1.5)} ${f(cy - s * 1.5)}L${f(cx + s * 1.5)} ${f(cy + s * 1.5)}M${f(cx + s * 1.5)} ${f(cy - s * 1.5)}L${f(cx - s * 1.5)} ${f(cy + s * 1.5)}M${f(cx)} ${f(cy - s * 1.8)}V${f(cy + s * 1.8)}M${f(cx - s * 1.8)} ${f(cy)}H${f(cx + s * 1.8)}"/></g>
<path d="${mark}" fill="${ink}"/>
<path d="M${f(x0 + pw * 0.12)} ${f(y0 + ph * 0.86)}h${f(pw * 0.3)}M${f(x0 + pw * 0.12)} ${f(y0 + ph * 0.9)}h${f(pw * 0.18)}" stroke="${hair}" stroke-width="3"/>
${chips}${grid}
</g>`;
  return Art.svgDoc(w, h, defs, body);
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
@font-face{font-family:'Foundry Display Fallback';font-weight:500 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:99.4%}
@font-face{font-family:'Foundry Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.1%}
html:root{--font-display:"Schibsted Grotesk","Foundry Display Fallback",sans-serif;--font-body:"Instrument Sans","Foundry Body Fallback",sans-serif}
body{font-size:1.05rem;--button:var(--ink);--on-button:var(--bg);--rule:1.5px solid var(--ink)}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn{border-radius:0;font-weight:600;letter-spacing:-.01em}
.btn:hover{transform:none}
.btn .i{transition:transform .3s cubic-bezier(.16,1,.3,1)}
.btn:hover .i{transform:translate(2px,-2px)}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:var(--bg);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--ink)}
.btn-ghost{border-width:1.5px;border-color:var(--ink)}
/* chapters: a number and a name, in the body face at body size, never caps */
.fx-chap{display:flex;gap:.9rem;align-items:baseline;margin-bottom:1.1rem;padding-top:.7rem;border-top:var(--rule);font-size:.95rem;font-weight:600;letter-spacing:0}
.fx-chap-n{min-width:2.2rem;font-variant-numeric:tabular-nums}
.fx-h2{font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-head{max-width:56rem;margin-bottom:clamp(2.5rem,2rem + 2vw,4.5rem)}
.fx-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.fx-lead{font-size:clamp(1.05rem,1rem + .3vw,1.2rem);line-height:1.5;color:var(--muted);max-width:30rem}
/* header */
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{position:relative;display:block;padding:.5rem 0;font-size:.95rem;font-weight:500;text-decoration:none}
.nav a::after{content:'';position:absolute;left:0;right:0;bottom:.3rem;height:1.5px;background:var(--ink);transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.16,1,.3,1)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem;font-size:.95rem}
.menu>summary{border-radius:0;border:var(--rule)}
.menu-panel{border-radius:0;border-top:var(--rule);border-bottom:var(--rule);counter-reset:ch}
.menu-panel li a{display:flex;gap:1rem;align-items:baseline;font-size:2rem;font-weight:600;letter-spacing:-.05em;border-bottom:1px solid var(--line)}
.menu-panel li a::before{counter-increment:ch;content:counter(ch,decimal-leading-zero);font-family:var(--font-body);font-size:.9rem;font-weight:600;letter-spacing:0;color:var(--muted)}
.menu-panel .btn{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the cover */
.fx-hero{padding-top:clamp(1.5rem,1rem + 2vw,3rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem);overflow-x:clip}
.fx-ticks{display:grid;grid-template-columns:repeat(4,1fr);height:.6rem;margin-bottom:1.25rem}
.fx-ticks i{border-left:1px solid var(--ink)}
.fx-ticks i:nth-child(n+5){display:none}
@media (min-width:48rem){.fx-ticks{grid-template-columns:repeat(12,1fr);column-gap:2rem}.fx-ticks i:nth-child(n+5){display:block}}
.fx-hero .fx-chap{border-top:0;padding-top:0}
.fx-spec{position:relative;margin:clamp(1.5rem,1rem + 3vw,4.5rem) 0 clamp(2.5rem,2rem + 3vw,5rem);font-size:var(--fsm);line-height:.9;letter-spacing:-.065em;font-weight:600}
@media (min-width:60rem){.fx-spec{font-size:min(var(--fs),13rem);white-space:nowrap}}
/* the specimen's guides, measured for this face: cap height .71em, x-height .53em, on the last line's baseline */
.fx-guides{display:inline-block;position:relative;width:0;height:0;vertical-align:baseline}
.fx-guides i{position:absolute;left:-100vw;width:200vw;height:1px;background:color-mix(in srgb,var(--ink) 30%,transparent)}
.fx-guides .g-cap{bottom:.71em}.fx-guides .g-x{bottom:.53em}
.fx-guides .g-base{bottom:-1px;height:2px;background:var(--pop);transform-origin:0 50%}
.fx-guides .gl{display:none}
@media (min-width:60rem){.fx-guides .gl{display:block;position:absolute;left:1.25rem;width:0;height:0}
.fx-guides .gl b{position:absolute;left:0;bottom:.35rem;font-family:var(--font-body);font-size:.85rem;line-height:1;font-weight:600;letter-spacing:0;white-space:nowrap;color:var(--muted)}
.fx-guides .l-cap{bottom:.71em}.fx-guides .l-x{bottom:.53em}.fx-guides .l-base{bottom:0}.fx-guides .l-base b{color:var(--ink)}}
html.m .fx-guides .g-base{animation:fxBase 1.2s cubic-bezier(.16,1,.3,1) .9s both}
html.m .fx-guides .g-cap,html.m .fx-guides .g-x,html.m .fx-guides .gl{animation:fxFade .8s ease .5s both}
@keyframes fxBase{from{transform:scaleX(0)}}
@keyframes fxFade{from{opacity:0}}
.fx-cover{display:grid;gap:2.5rem;padding-top:1.5rem;border-top:var(--rule)}
@media (min-width:60rem){.fx-cover{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-cover-copy{grid-column:1 / span 5}.fx-plate{grid-column:6 / span 7}}
.fx-cover-copy{display:grid;gap:1.4rem;align-content:start;justify-items:start}
.fx-what{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.6vw,2.6rem);font-weight:600;line-height:1.05;letter-spacing:-.045em;max-width:16em}
.fx-plate{margin:0}
.fx-plate-in{overflow:hidden;aspect-ratio:14/11;background:var(--surface)}
.fx-plate-img{width:100%;height:100%;object-fit:cover}
.fx-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.fx-ctas .btn{flex:1 1 100%}}
/* service rows: numbered by chapter, like a guide's sections */
.fx-rows{border-top:var(--rule)}
.fx-row{display:grid;border-bottom:1px solid var(--line)}
.fx-row-top{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:.5rem 1.25rem;padding:clamp(1.3rem,1rem + 1vw,2rem) 0 .6rem}
.fx-row-n{font-size:.95rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted)}
.fx-row h3{font-size:clamp(1.8rem,1.1rem + 3vw,4.2rem);line-height:.98;letter-spacing:-.055em}
.fx-row-p{grid-column:2;font-family:var(--font-display);font-size:clamp(1.05rem,.95rem + .5vw,1.4rem);font-weight:600;letter-spacing:-.03em}
.fx-row-in{display:grid;gap:.5rem;padding:0 0 clamp(1.3rem,1rem + 1vw,2rem)}
.fx-row-in p{max-width:40rem;color:var(--muted);font-size:1.05rem}
.fx-row-d{font-variant-numeric:tabular-nums}
@media (min-width:48rem){.fx-row-top{grid-template-columns:5rem 1fr auto}.fx-row-p{grid-column:auto}.fx-row-in{padding-left:calc(5rem + 1.25rem)}}
.fx-incl{display:grid;gap:1.25rem;margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
@media (min-width:60rem){.fx-incl{grid-template-columns:16rem 1fr}}
.fx-incl h3{font-size:1.1rem;letter-spacing:-.02em}
.fx-incl ol{display:grid;gap:0;border-top:var(--rule)}
@media (min-width:48rem){.fx-incl ol{grid-template-columns:1fr 1fr;column-gap:2rem}}
.fx-incl li{display:flex;gap:1rem;align-items:baseline;padding:.75rem 0;border-bottom:1px solid var(--line);font-weight:500}
.fx-incl li span{font-size:.85rem;color:var(--muted)}
.fx-incl-big{border-top:var(--rule)}
.fx-incl-big li{display:flex;gap:1.5rem;align-items:baseline;padding:1.5rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.4rem,1rem + 1.6vw,2.4rem);font-weight:600;letter-spacing:-.04em;line-height:1.1}
.fx-incl-big span{font-size:.9rem;color:var(--muted);letter-spacing:0}
/* process: a schedule of columns under one rule that draws with the scroll */
.fx-process{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem);--rm-accent:var(--pop);--rm-line:color-mix(in srgb,var(--ink) 22%,transparent)}
.fx-process .h2{font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-process .rm-head{max-width:none}
.fx-process .rm-wave,.fx-process .rm-comet{display:none!important}
.fx-process .rm-nodes{gap:0;padding-left:0;border-top:0}
.fx-process .rm-nodes::before,.fx-process .rm-nodes::after{display:block;left:0;top:0;bottom:auto;width:3px;height:100%}
.fx-process .rm-node{padding:1.25rem 0 1.5rem 1.5rem;justify-items:start;text-align:left;border-bottom:1px solid var(--line)}
.fx-process .rm-dot{position:static;width:auto;height:auto;margin:0 0 .6rem;border:0;border-radius:0;background:none;place-items:start;font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,4.2rem);font-weight:600;letter-spacing:-.06em;line-height:1;color:var(--ink)}
.fx-process .rm-txt{justify-items:start}
.fx-process .rm-txt h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem);letter-spacing:-.04em}
.fx-process .rm-sub{max-width:20rem}
html.rm-go .fx-process .rm-node .rm-dot{transform:translateY(.5em);opacity:0;transition:transform .7s cubic-bezier(.16,1,.3,1),opacity .4s ease,color .3s ease}
html.rm-go .fx-process .rm-node.on .rm-dot{transform:none;opacity:1}
html.rm-go .fx-process .rm-node.cur .rm-dot{transform:none;background:none;color:var(--pop)}
html.rm-go .fx-process .rm-node.cur .rm-txt h3{color:var(--ink)}
@media (min-width:48rem){
.fx-process .rm-nodes{grid-template-columns:repeat(var(--n),minmax(0,1fr));column-gap:2rem}
.fx-process .rm-nodes::before,.fx-process .rm-nodes::after{width:100%;height:3px;left:0;right:0}
.fx-process .rm-nodes::after{transform-origin:0 50%}
html.rm-go .fx-process .rm-nodes::after{transform:scaleX(var(--p,0))}
.fx-process .rm-node{padding:1.75rem 0 0;border-bottom:0}
}
.fx-proc-go{margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
/* about */
.fx-about{border-top:0}
.fx-about-grid{display:grid;gap:2rem}
@media (min-width:60rem){.fx-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;row-gap:3rem}.fx-about-side{grid-column:1 / span 4}.fx-state{grid-column:5 / span 8}.fx-about-rest{grid-column:7 / span 6}.fx-clients{grid-column:1 / span 12}}
.fx-about-h{font-size:clamp(1.5rem,1.2rem + 1vw,2.2rem);line-height:1.05}
.fx-state{font-family:var(--font-display);font-size:clamp(2rem,1.2rem + 3.4vw,4.6rem);font-weight:600;line-height:1;letter-spacing:-.05em;text-wrap:balance}
.fx-about-rest{display:grid;gap:1rem;justify-items:start}
.fx-p{font-size:1.1rem;line-height:1.6;max-width:34rem;color:var(--muted)}
.fx-clients{display:grid;gap:1rem}
@media (min-width:60rem){.fx-clients{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-cl-h{grid-column:1 / span 4}.fx-clients-list{grid-column:5 / span 8}}
.fx-cl-h{font-size:1rem;font-weight:600;letter-spacing:0;padding-top:.7rem}
.fx-clients-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));border-top:var(--rule)}
.fx-clients-list li{padding:.9rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);font-weight:600;letter-spacing:-.04em}
/* questions: set as a sheet, both columns open */
.fx-qa{border-top:var(--rule)}
.fx-qa-row{display:grid;gap:.5rem;padding:1.4rem 0;border-bottom:1px solid var(--line)}
@media (min-width:60rem){.fx-qa-row{grid-template-columns:5fr 7fr;gap:2rem}}
.fx-qa dt{font-family:var(--font-display);font-size:1.4rem;font-weight:600;letter-spacing:-.035em;line-height:1.15}
.fx-qa dd{color:var(--muted);max-width:36rem}
/* contact: the address set as the headline, the form as a brief with numbered rules */
.fx-contact .fx-head{margin-bottom:1rem}
.fx-mail-p{margin-bottom:clamp(2.5rem,2rem + 2vw,4rem);padding-bottom:1.25rem;border-bottom:var(--rule);overflow-wrap:anywhere}
.fx-mail{font-family:var(--font-display);font-size:clamp(1.8rem,1rem + 4.4vw,6rem);font-weight:600;letter-spacing:-.06em;line-height:1;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .5s cubic-bezier(.16,1,.3,1)}
.fx-mail:hover{background-size:100% 2px}
.fx-contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.fx-contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-contact-copy{grid-column:1 / span 4}.fx-form{grid-column:6 / span 7}}
.fx-contact-copy{display:grid;gap:1.25rem;justify-items:start}
.fx-promise{padding-top:1rem;border-top:1px solid var(--line);color:var(--muted)}
.fx-contact-list{font-size:1.05rem}
.fx-form h3{margin-bottom:1rem;font-size:1rem;font-weight:600;letter-spacing:0}
.fx-form form{counter-reset:f}
.fx-form .field{position:relative;padding-top:.6rem;border-top:var(--rule)}
.fx-form .field>label{counter-increment:f}
.fx-form .field>label::before{content:counter(f,decimal-leading-zero);display:inline-block;min-width:2.2rem;font-variant-numeric:tabular-nums;color:var(--muted)}
.field input,.field select,.field textarea{border-radius:0;border:0;border-bottom:1px solid var(--line);background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--ink);outline-offset:2px}
.field textarea{border:1px solid var(--line);padding-inline:.8rem}
/* footer: the colophon */
.ftr{border-top:var(--rule)}
.ftr-name{font-size:1.6rem;letter-spacing:-.05em}
.ftr-links{counter-reset:fl}
.ftr-links a::before{counter-increment:fl;content:counter(fl,decimal-leading-zero) ' ';font-variant-numeric:tabular-nums}
.ftr-base{border-top:var(--rule)}
.mbar{border-top:var(--rule);border-radius:0}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'agency',
  name: 'Foundry',
  bestFor: 'Agencies, consultants and studios that sell to other businesses: branding, web, marketing, automation, bookkeeping',
  why: 'Built for business to business services and set like your own brand guide: your name as a type specimen on the cover, every section a numbered chapter, services and prices as big rows, your process as a schedule that draws itself as you scroll, and a project brief form.',
  fonts: { q: 'family=Schibsted+Grotesk:wght@500..800&family=Instrument+Sans:wght@400..600&family=Instrument+Serif:ital@1', display: ['Schibsted Grotesk', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): type set on the grid, a plate that leans in, a process you scroll through.
  choreo: { intro: 'mask', alive: ['pointer', 'scroll'], scroll: 'roadmap', pace: 'medium', look: 'Swiss poster stock, a brand guide cover, type rising from its baseline' },
  tokens,
  slots,
  nav,
  render,
  art,
};
