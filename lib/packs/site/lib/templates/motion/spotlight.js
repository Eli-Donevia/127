// Spotlight (animated, creator): a full creator page set like the cover and contents of a magazine about them.
//   Object: the cover. The creator's name is the masthead, their portrait is the cover photo, their links are the
//   cover lines and the contents page.
//   Material: cover stock and newsprint: warm uncoated paper, black ink, one photo, hairline rules, square corners.
//   One move: unfold. The masthead's words unfold up from their baseline like a turned page and the cover photo opens
//   from its centre; the cover lines follow.
//   Pop: the member's colour as the line drawn under the masthead's last word, the roadmap's line and its current rate.
// Then the contents (every link, numbered, with where it goes), the rates as a roadmap that draws itself with the
// scroll and ends at Brand inquiries, the brands set as one sentence, the story beside a second photo, questions and a
// brand inquiry form. The cover leans toward the pointer and springs when tapped. No sparkles, no stickers, no loops.
// JavaScript off and reduced motion: the complete, still page. Its motion is the `choreo` block at the bottom.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'spotlight';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f4f4f1', 0.9), dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#14100d', 0.6) };
}

function slots(c) {
  const who = c.owner && c.owner !== c.name ? c.owner : c.name;
  return [
    { slot: 'portrait', file: 'portrait.jpg', w: 1200, h: 1500, style: 'portrait', alt: `${who}, ${c.whatShort || 'creator'}` },
    { slot: 'work', file: 'at-work.jpg', w: 1200, h: 900, style: 'tile', alt: `${who} at work` },
  ];
}

function nav(c) {
  return [
    c.links.length && { label: 'Contents', href: '#links' },
    c.services.length && { label: 'Work with me', href: '#rates' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// Where a link goes, from its address only.
const PLACES = [
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/instagram\.com/i, 'Instagram'],
  [/tiktok\.com/i, 'TikTok'],
  [/twitch\.tv/i, 'Twitch'],
  [/(^|\/\/|\.)x\.com|twitter\.com/i, 'X'],
  [/linkedin\.com/i, 'LinkedIn'],
  [/facebook\.com/i, 'Facebook'],
  [/spotify\.com|podcasts\.apple|anchor\.fm/i, 'Podcast'],
  [/substack\.com|beehiiv\.com|kit\.com|convertkit|buttondown/i, 'Newsletter'],
  [/pinterest\./i, 'Pinterest'],
  [/threads\.net/i, 'Threads'],
  [/etsy\.com|shopify|amazon\.|stan\.store|gumroad|bigcartel/i, 'Shop'],
];
function whereOf(l) {
  const hit = PLACES.find(([re]) => re.test(l.href));
  if (hit) return hit[1];
  if (/^mailto:/.test(l.href)) return 'Email';
  return String(l.href).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

// "YouTube: New recipe every Tuesday" -> kicker "YouTube", line "New recipe every Tuesday".
function split(l) {
  const m = String(l.label).match(/^([^:]{2,24}):\s*(.+)$/);
  return m ? { kick: m[1], line: m[2] } : { kick: whereOf(l), line: l.label };
}

// The masthead: words (the intro unfolds them), on as many lines as the markup says, sized in CSS from the longest
// line so the cover's height is fixed before the font arrives.
function masthead(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const n = words.join(' ').length;
  const lines = words.length > 1 && n > 13 ? 2 : 1;
  let groups = [words];
  if (lines === 2) {
    let best = null;
    for (let j = 1; j < words.length; j++) {
      const g = [words.slice(0, j), words.slice(j)];
      const worst = Math.max(...g.map((x) => x.join(' ').length));
      if (!best || worst < best.worst) best = { worst, g };
    }
    groups = best.g;
  }
  const longLine = Math.max(...groups.map((g) => g.join(' ').length));
  // Unbounded at 800, in capitals: about 0.82em a letter.
  const fs = Math.min(15, 112 / Math.max(longLine, 4)).toFixed(2);
  const fsm = Math.min(19, 108 / Math.max(Math.max(...words.map((w) => w.length)), 4)).toFixed(2);
  const html = groups.map((g) => `<span class="ml">${g.map((w) => `<span class="mw">${esc(w)}</span>`).join(' ')}</span>`).join(' ');
  return { html, fs, fsm, stack: words.length > 1 };
}

function render(c) {
  const person = c.owner && c.owner !== c.name ? c.owner : c.name.split(/\s+/)[0];
  const mast = masthead(c.name);
  const mag = (html) => html.replace('<a ', '<a data-mag ');
  const links = c.links.map((l) => ({ ...l, ...split(l), where: whereOf(l) }));
  const cover = links.slice(0, 3);
  const folio = [c.handle, c.whatShort, c.area && !c.online ? c.area : ''].filter(Boolean);

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap">
${folio.length ? `<p class="folio" data-ci="then">${folio.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}
<h1 class="mast${mast.stack ? ' stack' : ''}" id="hero-title" data-ci="head" style="--fs:${mast.fs}vw;--fsm:${mast.fsm}vw">${mast.html}</h1>
<div class="cover-grid">
<figure class="cover" data-alive="0.5"><div class="cv" data-ci="subject">${P.img(c, 'portrait', { cls: 'cv-img', eager: true }).replace('<img ', '<img data-par="0.04" ')}</div></figure>
<div class="cover-side">
<p class="tagline" data-ci="then">${esc(c.heroSub)}</p>
${cover.length ? `<ul class="lines" data-ci="then">${cover.map((l) => `<li><a href="${esc(l.href)}"><span class="ln-k">${esc(l.kick)}</span><span class="ln-t">${esc(l.line)}</span>${icon('arrowUpRight', { size: 20 })}</a></li>`).join('')}</ul>` : ''}
<div class="ctas" data-ci="then"><a class="btn btn-ink btn-lg" data-mag href="#contact">Brand inquiries</a>${P.socials(c, { cls: 'hero-social' })}</div>
</div>
</div>
</div>
</section>`;

  // The contents page: every link, numbered, with where it goes.
  const contents = links.length
    ? `<section class="sec contents" id="links" aria-labelledby="links-title"><div class="wrap ct-grid">
<h2 class="h2" id="links-title" data-split>Contents</h2>
<ol class="toc">${links.map((l, i) => `<li data-rv style="--d:${i % 6}"><a href="${esc(l.href)}"><span class="toc-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="toc-t">${esc(l.line)}</span><span class="toc-w">${esc(l.kick === l.where ? l.where : `${l.kick}, ${l.where}`)}</span>${icon('arrowUpRight', { size: 22 })}</a></li>`).join('')}</ol>
</div></section>`
    : '';

  // The rates as a roadmap (the creator's own offers, in their order, with prices), drawn in with the scroll and ending
  // at Brand inquiries. One offer only: a plain line.
  const priced = c.services.some((s) => s.priceText);
  const road = roadmap({ id: 'rates', cls: 'rates', title: priced ? 'Rates' : 'Work with me', nodes: c.services.map((s) => ({ title: s.name, meta: s.priceText || '', sub: [s.duration, s.blurb].filter(Boolean).join(', ') })), end: '<a class="btn btn-paper" href="#contact">Brand inquiries</a>', endLabel: person });
  const inclList = c.included.length ? `<ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const rates = road
    ? road.replace(/<\/div>\n<\/section>$/, `${inclList}</div>\n</section>`)
    : c.services.length
      ? `<section class="sec rates rates-one" id="rates" aria-labelledby="rates-title"><div class="wrap"><h2 class="h2" id="rates-title">Work with me</h2><p class="one">${esc(c.services[0].name)}${c.services[0].priceText ? ` <span>${esc(c.services[0].priceText)}</span>` : ''}</p>${inclList}<a class="btn btn-paper" href="#contact">Brand inquiries</a></div></section>`
      : '';

  const cl = c.clients || [];
  const brands = cl.length
    ? `<section class="sec brands" aria-labelledby="brands-title"><div class="wrap">
<h2 class="sr-only" id="brands-title">Worked with</h2>
<p class="brand-line" data-rv>Worked with ${cl.map((x, i) => `<span class="bn">${esc(x)}</span>${i < cl.length - 2 ? ', ' : i === cl.length - 2 ? ' and ' : '.'}`).join('')}</p>
</div></section>`
    : '';

  const [p0 = '', ...more] = c.aboutParas;
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<figure class="about-media" data-rv="mask"><div>${P.img(c, 'work', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div></figure>
<div class="about-copy">
<h2 class="h2" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${p0 ? `<p class="about-first" data-rv>${esc(p0)}</p>` : ''}
${more.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="sr-only" id="reviews-title">What people say</h2><div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div></div></section>`
    : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-split>Good to know</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Brand' },
    c.services.length > 1 ? { name: 'interest', label: 'Interested in', type: 'select', options: [...c.services.map((s) => s.name), 'Something else'], half: true } : { ...P.FIELD_PRESETS.when, label: 'Timing' },
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the campaign', required: true },
  ];
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-copy">
<h2 class="contact-title" id="contact-title" data-split>Brand inquiries</h2>
<p class="lead" data-rv style="--d:3">Tell me about your brand and what you have in mind${c.email ? ', or write to me directly' : ''}.</p>
<div data-rv style="--d:4">${P.contactList(c, { cls: 'ct-list' })}</div>
</div>
<div class="form-wrap" data-rv style="--d:2">
${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [
    '<div class="prog" aria-hidden="true"></div>',
    P.header(c, { cls: 'hdr-sl', mark: false, cta: { label: 'Brand inquiries', href: '#contact' } }).replace('<header class="hdr', '<header data-hdr class="hdr'),
    '<main id="main">',
    hero,
    contents,
    rates,
    brands,
    about,
    reviews,
    faq,
    contact,
    '</main>',
    P.footer(c),
    P.mobileBar(c),
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '80rem' } };
}

// Nudges the masthead to the width with a transform only (its size is set in CSS, so nothing shifts).
const JS = `(function(){var d=document,h=d.querySelector('.mast');
function fit(){if(!h)return;var ls=[].slice.call(h.querySelectorAll(innerWidth<640&&h.classList.contains('stack')?'.mw':'.ml'));ls.forEach(function(l){l.style.transform=''});var w=h.clientWidth,m=Math.max.apply(0,ls.map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.8,Math.min(1.12,w/m));h.style.setProperty('--fit',Math.abs(r-1)<.004?1:r.toFixed(3))}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit)})();`;

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
:root{--ease:cubic-bezier(.16,1,.3,1);--rule:color-mix(in srgb,var(--ink) 16%,transparent)}
h1,h2,h3{font-weight:800;letter-spacing:-.04em}
.h2{font-size:clamp(2.2rem,1.4rem + 3.2vw,4.4rem);line-height:.98;text-transform:uppercase}
.lead{color:var(--muted)}
.btn{font-weight:700;letter-spacing:.01em}
.btn:hover{transform:none}
.btn-primary,.btn-ink{background:var(--ink);color:var(--bg);box-shadow:none;border-color:var(--ink)}
.btn-primary:hover,.btn-ink:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-paper{background:var(--on-dark);color:var(--dark)}
.btn-paper:hover{background:color-mix(in srgb,var(--on-dark) 85%,var(--dark))}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1rem;letter-spacing:-.02em;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;font-weight:600;font-size:.95rem;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 2px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(.5rem,.4rem + .8vw,1.25rem) clamp(3.5rem,2rem + 4vw,6rem)}
.folio{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 2rem;padding-block:.65rem;border-block:1px solid var(--ink);font-size:.92rem;font-weight:600}
.mast{--fit:1;margin-top:clamp(.75rem,1.5vw,1.5rem);font-size:var(--fs);font-weight:800;line-height:.86;letter-spacing:-.045em;text-transform:uppercase;overflow:hidden;padding-block:.04em}
.ml{display:block;width:max-content;white-space:nowrap;transform:scale(var(--fit));transform-origin:0 50%}
.mw{display:inline-block}
@media (max-width:39.99rem){.mast{font-size:var(--fsm)}.mast.stack .ml{display:inline;transform:none}.mast.stack .mw{display:block;width:max-content;transform:scale(var(--fit));transform-origin:0 50%}}
.cover-grid{display:grid;gap:2rem;margin-top:clamp(1.25rem,1rem + 1.5vw,2.25rem)}
@media (min-width:60rem){.cover-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.cover{grid-column:1/8}.cover-side{grid-column:8/13}}
.cover{margin:0}
.cv{overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
@media (max-width:59.99rem){.cv{aspect-ratio:1}}
.cv-img{width:100%;height:110%;margin-top:-5%;object-fit:cover}
.tagline{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:700;line-height:1.08;letter-spacing:-.035em;text-wrap:balance}
.lines{margin-top:1.75rem;border-top:1px solid var(--ink)}
.lines a{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.15rem 1rem;align-items:center;padding-block:.9rem;border-bottom:1px solid var(--rule);text-decoration:none}
.ln-k{grid-column:1;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ln-t{grid-column:1;font-size:1.15rem;font-weight:600;line-height:1.25}
.lines .i{grid-column:2;grid-row:1/3;transition:transform .35s var(--ease)}
.lines a:hover .ln-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:2px}
.lines a:hover .i{transform:translate(3px,-3px)}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.25rem;margin-top:1.75rem}
.socials a{border-width:1px;border-radius:0;width:2.75rem;height:2.75rem}
.contents{border-top:1px solid var(--ink)}
.ct-grid{display:grid;gap:2rem}
@media (min-width:60rem){.ct-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.ct-grid>.h2{grid-column:1/5}.toc{grid-column:5/13}}
.toc{border-top:1px solid var(--ink)}
.toc a{display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;gap:.25rem 1rem;align-items:baseline;padding-block:clamp(1rem,.8rem + .8vw,1.5rem);border-bottom:1px solid var(--rule);text-decoration:none}
.toc-n{font-family:var(--font-display);font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted)}
.toc-t{font-family:var(--font-display);font-size:clamp(1.35rem,1.1rem + 1vw,2.1rem);font-weight:700;line-height:1.08;letter-spacing:-.035em}
.toc-w{grid-column:2;font-size:.85rem;font-weight:600;color:var(--muted)}
.toc .i{grid-column:3;grid-row:1/3;align-self:center;transition:transform .35s var(--ease)}
.toc a:hover .toc-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:.08em;text-underline-offset:.15em}
.toc a:hover .i{transform:translate(4px,-4px)}
.rates{background:var(--dark);color:var(--on-dark)}
.rates.rm-sec{--rm-ink:var(--on-dark);--rm-muted:var(--muted-on-dark);--rm-line:var(--line-on-dark);--rm-accent:var(--primary-on-dark);--rm-dot-bg:var(--dark);--pop:var(--primary-on-dark)}
.rates .rm-dot{border-width:1px;border-radius:0;font-size:.85rem}
.rates .rm-txt h3{font-size:clamp(1.15rem,1rem + .6vw,1.55rem);letter-spacing:-.03em}
.rates .rm-meta{font-family:var(--font-display);font-size:clamp(1.8rem,1.4rem + 1.4vw,2.8rem);font-weight:800;line-height:1;letter-spacing:-.05em;color:var(--on-dark);font-variant-numeric:tabular-nums}
.incl{display:flex;flex-wrap:wrap;gap:.5rem 2rem;margin-top:clamp(2rem,1.5rem + 2vw,3rem);padding-top:1.25rem;border-top:1px solid var(--line-on-dark);color:var(--muted-on-dark)}
.one{margin-block:1.5rem 2rem;font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.6vw,2.6rem);font-weight:700;letter-spacing:-.03em}
.one span{color:var(--primary-on-dark)}
.brand-line{max-width:62rem;font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.2vw,3.4rem);font-weight:700;line-height:1.12;letter-spacing:-.04em;text-wrap:balance;color:var(--muted)}
.bn{color:var(--ink)}
.about{border-top:1px solid var(--ink)}
.about-grid{display:grid;gap:2rem}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.about-media{grid-column:1/7}.about-copy{grid-column:8/13}}
.about-media{margin:0}
.about-media>div{overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-copy .h2{margin-bottom:.5rem}
.about-first{font-size:clamp(1.25rem,1.1rem + .6vw,1.55rem);font-weight:500;line-height:1.45;letter-spacing:-.01em;max-width:34rem}
.about-copy p:not(.about-first){font-size:1.08rem;line-height:1.65;max-width:34rem;color:var(--muted)}
.quotes{display:grid;border-top:1px solid var(--ink)}
.quote{display:grid;gap:.8rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--rule)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.8vw,2.6rem);font-weight:700;line-height:1.12;letter-spacing:-.035em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:700;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.h2{grid-column:1/5}.faq-grid>div{grid-column:5/13}}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent}
.faq summary{padding:1.15rem 0;font-weight:700;font-size:1.08rem}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.25rem}
.contact{border-top:1px solid var(--ink)}
.contact-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.contact-copy{grid-column:1/6}.form-wrap{grid-column:7/13}}
.contact-title{font-size:clamp(2.6rem,1.6rem + 4.4vw,6rem);line-height:.92;letter-spacing:-.05em;text-transform:uppercase}
.contact .lead{margin-top:1.25rem;max-width:26rem}
.ct-list{margin-top:1.75rem}
.ct-list .i{color:var(--ink)}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid var(--ink);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--ink)}
.ftr-name{text-transform:uppercase;letter-spacing:-.02em}
.mbar{box-shadow:none;border-top:1px solid var(--ink)}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Spotlight',
  bestFor: 'Creators, streamers, podcasters and writers who want a full page with their links, rates and a brand inquiry form, with motion',
  why: 'A magazine about you, with motion: your name is the masthead and unfolds like a turned page, your photo opens as the cover, your links are the contents, and your rates draw in as a route to the brand inquiry form.',
  fonts: { q: 'family=Unbounded:wght@500..900&family=Plus+Jakarta+Sans:wght@400;500;600;700', display: ['Unbounded', 'grotesk'], body: ['Plus Jakarta Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): the masthead unfolds, the cover leans toward you, the rates draw in.
  choreo: { intro: 'unfold', alive: ['pointer', 'tap'], scroll: 'roadmap', pace: 'medium', look: 'a magazine cover, crisp and editorial' },
  tokens,
  slots,
  nav,
  render,
};
