// Northstar (animated, coach): for one person people want to work with.
//   Object:   the coach's portrait, printed and pinned beside a written plan (the rates, the steps, the plan you leave with).
//   Material: writing paper and graphite: a warm off-white sheet, ink hairlines, 2px radii, a book serif set very large.
//   One move: clarity. The portrait develops like a photograph from a grey blur while the headline's words come into
//             focus one by one (choreo intro 'develop').
//   Pop:      the member's colour as the one line drawn under the headline's last word, then as the path that draws
//             itself through the steps and ends at the Book button.
// At rest the portrait leans a little toward the pointer. The one scroll moment is that path (the roadmap), backwards
// when scrolling up. JavaScript off and reduced motion: the complete, still page. Motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'northstar';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f7f5f0', 0.65), dark: color.mix(color.mix(p.ink, p.primary, 0.35), '#05080a', 0.5) };
}

function slots(c) {
  return [{ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'coach'}` : c.profile.hero || c.name }];
}

function nav(c) {
  return [
    (c.services.length || c.offer || c.included.length) && { label: 'The offer', href: '#offer' },
    c.steps.length && { label: 'How it works', href: '#how' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The headline split on the server into words (so nothing reflows when the intro starts).
function headParts(title) {
  return String(title || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

function render(c) {
  const low = cheapest(c);
  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const where = c.online ? (c.area && /online|zoom|virtual|remote/i.test(c.area) ? c.area : 'Online') : c.area;
  const meta = [where, low ? `From ${low.priceText.replace(/^From /, '')}` : '', c.capacity].filter(Boolean).slice(0, 3);
  const book = (cls) => P.button(c.primary, cls).replace('<a ', '<a data-mag ');
  const long = c.heroTitle.length > 44;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<h1 id="hero-title" class="hero-h${long ? ' long' : ''}" data-ci="head">${headParts(c.heroTitle)}</h1>
<figure class="portrait">
<div class="pt-lean" data-alive="0.6"><div class="pt-frame" data-ci="subject">${P.img(c, 'portrait', { cls: 'pt-img', eager: true })}</div></div>
${person || c.whatShort ? `<figcaption data-ci="then"><strong>${esc(person || c.name)}</strong>${[c.whatShort, where].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</figcaption>` : ''}
</figure>
<div class="hero-copy">
<p class="lead">${esc(c.heroSub)}</p>
<div class="ctas" data-ci="then">${book('btn btn-primary btn-lg')}${c.secondary ? P.button(c.secondary, 'btn btn-quiet btn-lg') : ''}</div>
${meta.length > 1 ? `<ul class="meta" data-ci="then">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
</div>
</div>
</section>`;

  const aud = c.audience ? c.audience.replace(/^for\s+/i, '').replace(/[.!]+$/, '') : '';
  const forWho = aud
    ? `<section class="sec forwho" aria-labelledby="forwho-title"><div class="wrap">
<h2 class="statement" id="forwho-title" data-rv>For ${esc(aud)}${c.profile.result ? `, with ${esc(c.profile.result)}.` : '.'}</h2>
</div></section>`
    : '';

  const offer = c.services.length || c.included.length
    ? `<section class="sec offer" id="offer" aria-labelledby="offer-title"><div class="wrap">
<h2 class="h2 offer-h" id="offer-title" data-rv>${esc(person ? `Work with ${person}` : 'Ways to work together')}</h2>
${c.services.length ? `<ol class="rates">${c.services.map((s, i) => `<li class="rate" data-rv style="--d:${i}"><span class="rate-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3><p class="rate-m">${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p><p class="rate-p">${esc(s.priceText || '')}</p></li>`).join('')}</ol>` : ''}
<div class="offer-foot">
${c.included.length ? `<div class="incl-wrap" data-rv><h3>Included</h3><ul class="incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div></div>'}
<div class="offer-cta" data-rv style="--d:1">${c.capacity ? `<p class="cap">${esc(c.capacity)}</p>` : ''}${book('btn btn-primary btn-lg')}</div>
</div>
</div></section>`
    : '';

  // The one scroll moment: the steps (or, without steps, the ways to work together) as a path that draws itself in
  // with the scroll and ends at the Book button.
  const path = c.steps.length >= 2
    ? roadmap({ id: 'how', cls: 'ways', title: 'How it works', nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })), end: book('btn btn-primary'), endLabel: person || c.name })
    : c.services.length >= 2
      ? roadmap({ id: 'how', cls: 'ways', title: 'From a first call to the full program', nodes: c.services.map((s) => ({ title: s.name, meta: s.priceText || '', sub: [s.duration, s.blurb].filter(Boolean).join(', ') })), end: book('btn btn-primary'), endLabel: person || c.name })
      : '';

  // The first sentence large, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = c.aboutParas;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-in">
<h2 class="about-h" id="about-title" data-rv>${esc(person ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>
${first ? `<p class="about-first" data-rv style="--d:1">${esc(first)}</p>` : ''}
<div class="about-rest">
${rest.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="h2" id="reviews-title" data-rv>What people say</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-rv>Questions</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const closing = c.booking ? (person ? `Book a call with ${person}.` : 'Book a call.') : person ? `Write to ${person}.` : 'Send a message.';
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap contact-grid">
<div class="contact-head" data-rv>
<h2 class="h2 contact-h" id="contact-title">${esc(closing)}</h2>
${c.ctaSub ? `<p class="lead">${esc(c.ctaSub)}</p>` : ''}
${c.booking ? `<div class="ctas">${book('btn btn-primary btn-lg')}</div>` : ''}
${P.contactList(c) ? `<div class="contact-side">${P.contactList(c)}</div>` : ''}
</div>
<div class="form-card" data-rv style="--d:2">
<h3 class="form-title">${c.booking ? 'Or send a message' : 'Send a message'}</h3>
${P.form(c, { id: 'contact', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What would you like help with?', required: true }], submit: 'Send message', subject: `Message for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'hdr-ns', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, forWho, offer, path, about, reviews, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '78rem' } };
}

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
@font-face{font-family:'Northstar Display Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Liberation Serif'),local('LiberationSerif'),local('Times');size-adjust:107%}
@font-face{font-family:'Northstar Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.7%}
html:root{--font-display:"Newsreader","Northstar Display Fallback",serif;--font-body:"Manrope","Northstar Body Fallback",sans-serif;--ease:cubic-bezier(.16,1,.3,1)}
h1,h2,h3{font-weight:400;letter-spacing:-.025em}
h3{font-family:var(--font-body);font-weight:600;letter-spacing:-.01em}
.h2{font-size:clamp(2.4rem,1.5rem + 3.4vw,4.6rem);line-height:1}
.lead{color:var(--muted)}
.btn{font-weight:600;transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.btn:hover{transform:none}
.btn-primary{box-shadow:none}
.btn-quiet{background:none;color:var(--ink);border:0;border-bottom:1px solid var(--ink);border-radius:0;padding-inline:0;min-height:auto;padding-block:.35rem}
.btn-quiet:hover{border-bottom-color:var(--pop);color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .4s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.55rem;line-height:1;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.75rem}
.nav a{display:block;padding:.4rem 0;font-size:.95rem;font-weight:500;color:var(--muted);text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--ink);background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.15rem}
.menu>summary{border-radius:2px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{padding-block:clamp(2rem,1rem + 3vw,4.5rem) clamp(4rem,2.5rem + 5vw,8rem)}
.hero-grid{display:grid;gap:2rem}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;row-gap:0}.hero-h{grid-column:1 / span 9;grid-row:1;position:relative;z-index:1}.portrait{grid-column:9 / span 4;grid-row:1 / span 2;align-self:start;margin-top:4rem}.hero-copy{grid-column:1 / span 6;grid-row:2;align-self:end}}
.hero-h{font-size:clamp(3.1rem,1.2rem + 7.2vw,8.8rem);line-height:.94;letter-spacing:-.045em;text-wrap:balance}
.hero-h.long{font-size:clamp(2.7rem,1.2rem + 5.4vw,6.8rem)}
.hero-copy{padding-top:clamp(1.5rem,1rem + 2vw,3rem)}
.hero .lead{max-width:32rem}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.75rem;margin-top:2rem}
.meta{display:flex;flex-wrap:wrap;margin-top:2.25rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.92rem;color:var(--muted)}
.meta li{padding-right:1.1rem}
.meta li+li{padding-left:1.1rem;border-left:1px solid var(--line)}
.portrait{position:relative;margin:0}
.pt-frame{overflow:hidden;aspect-ratio:4/5;border-radius:2px;background:var(--surface)}
.pt-img{width:100%;height:100%;object-fit:cover}
.portrait figcaption{display:grid;grid-template-columns:auto 1fr;gap:.1rem 1rem;margin-top:.9rem;font-size:.9rem;color:var(--muted)}
.portrait figcaption strong{grid-row:span 2;font-family:var(--font-display);font-size:1.5rem;font-weight:400;line-height:1.1;color:var(--ink)}
@media (max-width:59.99rem){.portrait{width:min(82%,26rem);justify-self:end}}
@media (min-width:60rem){.portrait{margin-right:calc(-1 * max(2rem,(100vw - var(--max)) / 2));margin-top:2.5rem}.pt-frame{aspect-ratio:4/5.4;border-radius:2px 0 0 2px}.portrait figcaption{padding-right:2rem}}
.forwho{background:var(--dark);color:var(--on-dark)}
.statement{max-width:20ch;font-size:clamp(2.1rem,1.2rem + 4vw,5.2rem);line-height:1.04;letter-spacing:-.035em;color:var(--on-dark)}
.offer-h{max-width:14ch;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.rates{border-top:1px solid var(--ink)}
.rate{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;align-items:baseline;column-gap:1rem;padding:1.5rem 0;border-bottom:1px solid var(--line)}
.rate-n{font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
.rate h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.6rem,1.2rem + 1.6vw,2.8rem);line-height:1.05;letter-spacing:-.03em}
.rate-m{grid-column:2;grid-row:2;margin-top:.35rem;color:var(--muted)}
.rate-p{grid-column:3;grid-row:1 / span 2;align-self:center;font-family:var(--font-display);font-size:clamp(1.8rem,1.3rem + 2vw,3.4rem);line-height:1;letter-spacing:-.03em;font-variant-numeric:lining-nums tabular-nums;white-space:nowrap}
@media (min-width:60rem){.rate{grid-template-columns:2.5rem minmax(0,6fr) minmax(0,3fr) minmax(0,3fr)}.rate-m{grid-column:3;grid-row:1;margin:0}.rate-p{grid-column:4;grid-row:1;text-align:right}}
.offer-foot{display:grid;gap:2rem;margin-top:2.5rem}
@media (min-width:60rem){.offer-foot{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:end}}
.incl-wrap h3{font-size:.95rem;margin-bottom:.6rem}
.incl{display:grid;gap:.5rem}
.incl li{position:relative;padding-left:1.6rem;font-size:1.08rem}
.incl li::before{content:'';position:absolute;left:0;top:.8em;width:.9rem;height:1px;background:var(--ink)}
.offer-cta{display:grid;gap:.8rem;justify-items:start}
@media (min-width:60rem){.offer-cta{justify-items:end}}
.cap{font-weight:600}
.ways{background:var(--surface);--rm-accent:var(--pop)}
.ways .rm-txt h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,1.2rem + 1vw,2rem)}
.ways .rm-meta{font-family:var(--font-display);font-size:1.4rem;font-weight:400;color:var(--ink)}
.about-in{display:grid;gap:1.5rem}
@media (min-width:60rem){.about-in{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.about-h{grid-column:1 / span 3}.about-first{grid-column:4 / span 9}.about-rest{grid-column:7 / span 6}}
.about-h{font-family:var(--font-body);font-size:1rem;font-weight:600;letter-spacing:0;padding-top:.9rem}
.about-first{font-family:var(--font-display);font-size:clamp(1.9rem,1.2rem + 2.8vw,4rem);line-height:1.12;letter-spacing:-.03em;text-wrap:balance}
.about-rest{display:grid;gap:1.1rem;font-size:1.1rem;line-height:1.65;color:var(--muted)}
.quotes{display:grid;gap:2rem;margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:3rem}}
.quote{display:grid;gap:1rem;padding-top:1.25rem;border-top:1px solid var(--ink)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.35rem,1.15rem + .8vw,1.75rem);line-height:1.35}
.quote figcaption{font-weight:600;color:var(--muted)}
.faq-sec{border-top:1px solid var(--line)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.faq-grid>.h2{grid-column:1 / span 4}.faq-grid>div{grid-column:6 / span 7}}
.faq{gap:0}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:none}
.faq details:first-child{border-top:1px solid var(--ink)}
.faq summary{padding:1.3rem 0;font-family:var(--font-display);font-size:clamp(1.2rem,1.1rem + .4vw,1.45rem);font-weight:400}
.faq .ans{padding:0 0 1.3rem}
.contact{background:var(--dark);color:var(--on-dark)}
.contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:4rem}}
.contact-h{font-size:clamp(2.8rem,1.4rem + 5vw,6.4rem);line-height:.98;max-width:12ch}
.contact .lead{margin-top:1.25rem;color:var(--muted-on-dark)}
.contact-side{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--line-on-dark)}
.contact-side .i{color:var(--primary-on-dark)}
.contact-side a{color:var(--on-dark)}
.form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.4rem);border-radius:2px;background:var(--bg);color:var(--ink)}
.form-title{margin-bottom:1.25rem;font-family:var(--font-display);font-size:1.9rem;font-weight:400;letter-spacing:-.02em}
.ftr{background:var(--bg)}
.mbar{background:var(--bg);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'coach',
  name: 'Northstar',
  bestFor: 'Coaches, tutors, consultants and anyone people book one to one, with motion',
  why: 'Calm and confident, with motion: your portrait develops like a photograph as the headline comes into focus, then your rates set like a written plan, your steps as a path that draws itself in as you scroll, your story and a Book a call button.',
  fonts: { q: 'family=Newsreader:ital,opsz,wght@0,48,400;1,48,400&family=Manrope:wght@400;500;600;700', display: ['Newsreader', 'serif'], body: ['Manrope', 'sans'] },
  // The motion, as data (lib/choreo.md): coming into focus, a calm drift, steps that take their turn.
  choreo: { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'roadmap', pace: 'calm', look: 'writing paper and graphite, coming into focus' },
  tokens,
  slots,
  nav,
  render,
};
