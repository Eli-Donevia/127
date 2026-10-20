// Gather (animated, product, for an event): a workshop, pop-up, class or launch party, where the buy link is tickets.
//   Object: the ticket. A real one, set in type: the event, the date, the time, the place, the price on its stub.
//   Material: poster stock and ticket card: off-white stock, black ink, square corners, perforations, no cards.
//   One move: the date (only when the member gave one, else the event's name) locks together in huge condensed type
//   and the ticket lands on the poster with a bounce, then its stub tears along the perforation.
//   Pop: the member's colour as the line drawn under the date and the roadmap's line; the stub's price at rest.
// Then what's included as a plan that draws itself with the scroll (the roadmap, ending at the ticket button), the
// ticket types as a box-office board, when and where as a black poster block, the host beside a big quiet photo,
// questions, and a last call. The ticket leans toward the pointer and springs when tapped. A ticket bar stays in reach
// once the hero has gone. JavaScript off and reduced motion: the complete, still poster. Its motion is the `choreo`
// block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'gather';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f2f2ef', 0.9) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1600, h: 1000, style: 'tile', alt: c.profile.hero || g[0] || `${c.productName || c.name}` },
    { slot: 'host', file: 'host.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, the host` : g[3] || `${c.name}, the host` },
  ];
}

function nav(c) {
  return [
    c.included.length && { label: "What's included", href: '#features' },
    (c.services.length || c.priceText) && { label: 'Tickets', href: '#tickets' },
    (c.deadline || c.address || c.area) && { label: 'When and where', href: '#details' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// The date inside the member's deadline ("Saturday, Nov 15, 10am" -> "NOV 15"), or '' when there is none.
function dateOf(s) {
  const t = String(s || '');
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  let m = t.match(new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (m) return `${m[1].toUpperCase()} ${Number(m[2])}`;
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}`, 'i'));
  if (m) return `${Number(m[1])} ${m[2].toUpperCase()}`;
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MON[Number(m[2]) - 1]} ${Number(m[3])}`;
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (m) return `${m[1]}/${m[2]}`;
  return '';
}

// The giant line: one span per letter, its lines fixed in the markup (balanced by length) and its size set in CSS from
// its length, so the poster's height never depends on which font has arrived (no layout shift).
function giant(textIn) {
  const t = String(textIn).trim();
  const words = t.split(/\s+/);
  const n = t.length;
  const lines = Math.min(words.length, n <= 12 ? 1 : n <= 26 ? 2 : 3);
  // Fewest-longest-line split into that many lines (words stay whole), so the lines are balanced.
  const groups = [];
  let best = null;
  const cut = (from, k, acc) => {
    if (k === 1) { const all = [...acc, words.slice(from)]; const worst = Math.max(...all.map((g) => g.join(' ').length)); if (!best || worst < best.worst) best = { worst, all }; return; }
    for (let j = from + 1; j <= words.length - k + 1; j++) cut(j, k - 1, [...acc, words.slice(from, j)]);
  };
  cut(0, lines, []);
  groups.push(...best.all);
  const longLine = Math.max(...groups.map((g) => g.join(' ').length));
  // Big Shoulders Display at 900, in capitals: about 0.5em a letter (figures a little less).
  const fs = Math.min(40, 186 / Math.max(longLine, 3)).toFixed(2);
  const fsm = Math.min(46, 186 / Math.max(longLine, 3)).toFixed(2);
  let i = 0;
  const html = groups
    .map((g) => `<span class="gl">${g.map((w) => `<span class="gw">${[...w].map((ch) => `<span class="gch" data-ci-part>${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span>`)
    .join(' ');
  return { html, fs, fsm, fh: [62, 34, 22][groups.length - 1] };
}

// "Pop-up night market" and "Night Market Pop-up" say the same thing: show it once.
function sameWords(a, b) {
  const key = (t) => String(t).toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
  return key(a) === key(b);
}

function render(c0) {
  // Tickets, not "Buy now": the event's own words on the main button.
  const generic = /^(buy now|shop now)$/i;
  const primary = c0.buy && generic.test(c0.primary.label) ? { ...c0.primary, label: 'Get tickets', short: 'Tickets' } : c0.primary;
  const secondary = c0.secondary && c0.secondary.href === '#features' ? { ...c0.secondary, label: "What's included" } : c0.secondary;
  // The written words follow the new label ("Tap Buy now to order." -> "Tap Get tickets to order.").
  const relabel = (t) => (primary !== c0.primary ? String(t || '').split(c0.primary.label).join(primary.label) : t);
  const c = { ...c0, primary, secondary, heroSub: relabel(c0.heroSub), ctaSub: relabel(c0.ctaSub), faq: c0.faq.map((q) => ({ q: q.q, a: relabel(q.a) })) };
  const event = c.productName || c.name;
  const date = dateOf(c.deadline);
  const big = giant(date || event);
  const low = cheapest(c);
  const fromText = low ? `From ${low.priceText.replace(/^From /, '')}` : c.priceText || '';
  const where = c.address || (c.area && !c.online ? c.area : '');
  const whereShort = c.address ? c.address.split(',')[0] : where;
  const tix = (cls) => P.button(c.primary, cls, c.buy ? 'arrowUpRight' : 'arrow').replace('<a ', '<a data-mag ');
  const person = c.owner && c.owner !== c.name ? c.owner : '';

  const metaRows = [c.whatShort, where ? (c.city && c.address ? c.city : where) : '', c.capacity].filter(Boolean);

  // The ticket: only the member's facts. Its stub carries the lowest price (or the seats, or the word for the button).
  const first = c.services[0];
  const stubBig = low ? low.priceText.replace(/^From /, '') : c.priceText || '';
  const ticket = `<div class="tk-wrap" data-ci="subject"><div class="ticket" data-alive="0.8">
<div class="tk-main">
<p class="tk-top"><span>${esc(c.name)}</span>${first && first.name ? `<span>${esc(first.name)}</span>` : ''}</p>
<p class="tk-event">${esc(event)}</p>
<dl class="tk-rows">${c.deadline ? `<div><dt>When</dt><dd>${esc(c.deadline)}</dd></div>` : ''}${where ? `<div><dt>Where</dt><dd>${esc(whereShort)}${c.city && c.address ? `, ${esc(c.city)}` : ''}</dd></div>` : ''}${person ? `<div><dt>Host</dt><dd>${esc(person)}</dd></div>` : ''}</dl>
</div>
<div class="tk-stub"><span class="tk-perf" aria-hidden="true"></span>${stubBig ? `<p class="tk-price">${esc(stubBig)}</p>` : ''}${c.capacity ? `<p class="tk-cap">${esc(c.capacity)}</p>` : ''}</div>
</div></div>`;

  const hero = `<section class="hero" aria-labelledby="hero-title">
${metaRows.length ? `<div class="wrap"><p class="folio" data-ci="then">${metaRows.map((v) => `<span>${esc(v)}</span>`).join('')}</p></div>` : ''}
<div class="giant-wrap">
${date ? `<p class="giant" data-ci="head" style="--fs:${big.fs}vw;--fh:${big.fh}vh;--fsm:${big.fsm}vw"><span class="sr-only">${esc(c.deadline)}</span><span class="g-in" aria-hidden="true">${big.html}</span></p>` : `<h1 class="giant" id="hero-title" data-ci="head" style="--fs:${big.fs}vw;--fh:${big.fh}vh;--fsm:${big.fsm}vw"><span class="sr-only">${esc(event)}</span><span class="g-in" aria-hidden="true">${big.html}</span></h1>`}
</div>
<div class="wrap hero-grid${date ? ' dt' : ''}">
<div class="hero-copy">
${date ? `<h1 id="hero-title" data-ci="then">${esc(sameWords(c.heroTitle, event) ? c.heroTitle : `${event}: ${c.heroTitle}`)}</h1>` : sameWords(c.heroTitle, event) ? '' : `<p class="hero-name" data-ci="then">${esc(c.heroTitle)}</p>`}
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
<div class="ctas" data-ci="then">${tix('btn btn-lg btn-ink')}${fromText ? `<p class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></p>` : ''}</div>
</div>
${ticket}
</div>
</section>`;

  // What's included as the plan: a roadmap that draws itself with the scroll and ends at the ticket button.
  const plan = c.included.length >= 2
    ? roadmap({ id: 'features', cls: 'plan', title: "What's included", nodes: c.included.map((x) => ({ title: x })), end: c.buy ? tix('btn btn-ink') : '', endLabel: fromText || event })
    : c.included.length
      ? `<section class="sec plan-one" id="features" aria-labelledby="features-title"><div class="wrap"><h2 class="h2" id="features-title">What's included</h2><p class="one-line">${esc(c.included[0])}</p></div></section>`
      : '';

  // One big quiet photo of the event, edge to edge.
  const photo = `<section class="photo" aria-label="Photo"><div class="ph-in" data-rv="mask"><div>${P.img(c, 'hero', { cls: 'ph-img' }).replace('<img ', '<img data-par="0.06" ')}</div></div></section>`;

  // The ticket types as a box-office board: name, what it is, a perforation, the price, the button.
  const ticketItems = c.services.length ? c.services : c.priceText ? [{ name: event, priceText: c.priceText, blurb: '' }] : [];
  const tickets = ticketItems.length
    ? `<section class="sec tickets" id="tickets" aria-labelledby="tickets-title"><div class="wrap tix-grid">
<div class="tix-side"><h2 class="h2" id="tickets-title" data-split>${c.buy ? 'Tickets' : 'Prices'}</h2>${c.capacity || c.shipping ? `<p class="tix-note">${[c.capacity, c.shipping].filter(Boolean).map(esc).join('. ')}</p>` : ''}</div>
<ul class="board">${ticketItems
        .map((s, i) => `<li class="row" data-rv style="--d:${i + 1}"><span class="row-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="row-t"><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}</div>${s.priceText ? `<p class="row-p">${esc(s.priceText)}</p>` : ''}${c.buy ? `<a class="row-go" href="${esc(c.buy.href)}">${esc(c.primary.label)}${icon('arrowUpRight', { size: 18 })}<span class="sr-only">: ${esc(s.name)}</span></a>` : ''}</li>`)
        .join('')}</ul>
</div></section>`
    : '';

  const blocks = [
    c.deadline && { k: 'When', v: c.deadline },
    where && { k: 'Where', v: where, link: c.mapsUrl },
    c.capacity && { k: 'How many', v: c.capacity },
  ].filter(Boolean);
  const details = blocks.length
    ? `<section class="details" id="details" aria-labelledby="details-title"><div class="wrap">
<h2 class="sr-only" id="details-title">When and where</h2>
<dl class="det-list">${blocks.map((b, i) => `<div class="det" data-rv style="--d:${i * 2}"><dt>${esc(b.k)}</dt><dd><span class="det-v">${esc(b.v)}</span>${b.link ? `<a class="det-a" href="${esc(b.link)}">Get directions${icon('arrowUpRight', { size: 16 })}</a>` : ''}</dd></div>`).join('\n')}</dl>
</div></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<figure class="host" data-rv="mask"><div class="host-in">${P.img(c, 'host', { cls: 'host-img' }).replace('<img ', '<img data-par="0.05" ')}</div>${person ? `<figcaption>${esc(person)}, ${esc(c.name)}</figcaption>` : ''}</figure>
<div class="about-copy">
<h2 class="h2" id="about-title" data-split>${esc(person ? `Hosted by ${person}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="sr-only" id="reviews-title">What people say</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-split>Questions</h2><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  // The last call: with a date, "See you on Nov 15." (the member's own date) over the button.
  const lastTitle = date && c.buy ? `See you ${/^\d/.test(date) ? 'on the' : 'on'} ${date.replace(/^(\w{3}) (\d+)$/, (m, a, b) => `${a.charAt(0)}${a.slice(1).toLowerCase()} ${b}`)}.` : c.ctaTitle;
  const signup = `<section class="sec signup" id="signup" aria-labelledby="signup-title"><div class="wrap signup-grid">
<div class="signup-copy">
<h2 class="signup-title" id="signup-title" data-split>${esc(lastTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.buy ? `<div class="ctas" data-rv style="--d:4">${tix('btn btn-lg btn-ink')}${fromText ? `<p class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></p>` : ''}</div>` : ''}
</div>
<div class="signup-side">
${c.buy ? '' : `<div class="form-wrap" data-rv style="--d:2"><h3 class="form-title">Join the list</h3><p class="form-lead">Leave your email and we will write when tickets are out.</p>${P.form(c, { id: 'signup', fields: ['name', 'email'], submit: 'Join the list', subject: `${event}: join the list` })}</div>`}
${P.contactList(c, { cls: 'signup-contact' }) ? `<div data-rv style="--d:5">${P.contactList(c, { cls: 'signup-contact' })}</div>` : ''}
</div>
</div></section>`;

  const float = `<div class="tix-float" aria-label="Tickets"><span class="tf-name">${esc(event)}${fromText ? `<small>${esc(fromText)}</small>` : ''}</span>${P.button(c.primary, 'btn btn-primary tf-btn')}</div>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-ga', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, plan, photo, tickets, details, about, reviews, faq, signup, '</main>', float, P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '80rem' } };
}

// Nudges the giant line to the width with a transform only (its box is sized in CSS), and shows the ticket bar once the
// hero has scrolled away.
const JS = `(function(){var d=document,k=d.querySelector('.giant .g-in');
function fit(){if(!k)return;k.style.transform='';var w=k.parentNode.clientWidth,m=Math.max.apply(0,[].slice.call(k.querySelectorAll('.gl')).map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.76,Math.min(1.1,w/m));k.style.transform=Math.abs(r-1)<.004?'':'scale('+r.toFixed(3)+')'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var f=d.querySelector('.tix-float'),h=d.querySelector('.hero'),s=d.querySelector('.signup');if(f&&h&&'IntersectionObserver' in window){d.documentElement.classList.add('tf');var past=false,end=false;var set=function(){f.classList.toggle('show',past&&!end)};new IntersectionObserver(function(e){past=!e[0].isIntersecting&&e[0].boundingClientRect.top<0;set()}).observe(h);if(s)new IntersectionObserver(function(e){end=e[0].isIntersecting;set()}).observe(s)}})();`;

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
:root{--ease:cubic-bezier(.16,1,.3,1);--rule:color-mix(in srgb,var(--ink) 18%,transparent);--card:color-mix(in srgb,var(--bg) 40%,#fffdf8)}
h1,h2,h3{font-weight:800;letter-spacing:-.005em;text-transform:uppercase}
.h2{font-size:clamp(3rem,1.8rem + 5vw,6.6rem);line-height:.84}
.lead{color:var(--muted)}
.btn{font-weight:700;letter-spacing:.02em}
.btn:hover{transform:none}
.btn-ink,.btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-ink:hover,.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg))}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;font-weight:900;line-height:1;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.5rem 0;font-size:.95rem;font-weight:600;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 2px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.2rem}
.menu>summary{background:transparent;border-radius:2px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(.5rem,.4rem + .8vw,1.25rem) clamp(4rem,2.5rem + 5vw,7.5rem)}
.folio{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 2rem;padding-block:.7rem;border-block:2px solid var(--ink);font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.giant-wrap{padding-inline:clamp(1rem,2.4vw,3rem);margin-top:clamp(.75rem,1.5vw,1.5rem);overflow:hidden}
.giant{font-family:var(--font-display);font-size:clamp(4.5rem,min(var(--fs),var(--fh)),40rem);font-weight:900;line-height:.8;letter-spacing:-.01em;text-transform:uppercase;padding-block:.07em .04em}
@media (max-width:39.99rem){.giant{font-size:var(--fsm)}}
.g-in{display:block;transform-origin:0 50%}
.gl{display:block;width:max-content;white-space:nowrap}
.gw{display:inline-block;white-space:nowrap}
.gch{display:inline-block;transition:translate .45s var(--ease)}
@media (hover:hover){html.m .gch:hover{translate:0 -.05em}}
.hero-grid{position:relative;display:grid;gap:2.5rem;margin-top:clamp(1.75rem,1rem + 2vw,3rem)}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.hero-copy{grid-column:1/6}.tk-wrap{grid-column:7/13}.dt .tk-wrap{margin-top:calc(-1 * clamp(4rem,9vw,10rem))}}
.hero-name{text-transform:uppercase}
.hero h1:not(.giant),.hero-name{font-family:var(--font-display);font-size:clamp(2.4rem,1.6rem + 3vw,4.4rem);font-weight:900;line-height:.88}
.hero .lead{margin-top:1rem;max-width:30rem;font-size:1.15rem}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:1.75rem}
.from{display:grid;line-height:1.05}
.from small{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.from strong{font-family:var(--font-display);font-size:2.2rem;font-weight:900;text-transform:uppercase;font-variant-numeric:tabular-nums}
.tk-wrap{position:relative;z-index:1;filter:drop-shadow(0 1px 0 color-mix(in srgb,var(--ink) 22%,transparent)) drop-shadow(0 24px 30px rgba(0,0,0,.18))}
.ticket{display:grid;grid-template-columns:minmax(0,1fr) auto;background:var(--card);color:var(--ink);rotate:-2.5deg;cursor:pointer;-webkit-mask:radial-gradient(circle .7rem at calc(100% - var(--stub)) 0,#0000 98%,#000) 0 0/100% 51% no-repeat,radial-gradient(circle .7rem at calc(100% - var(--stub)) 100%,#0000 98%,#000) 0 100%/100% 51% no-repeat;mask:radial-gradient(circle .7rem at calc(100% - var(--stub)) 0,#0000 98%,#000) 0 0/100% 51% no-repeat,radial-gradient(circle .7rem at calc(100% - var(--stub)) 100%,#0000 98%,#000) 0 100%/100% 51% no-repeat;--stub:clamp(6.5rem,5rem + 4vw,9.5rem)}
.tk-main{display:grid;gap:.9rem;align-content:start;padding:clamp(1.1rem,.8rem + 1vw,1.75rem)}
.tk-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.25rem 1rem;padding-bottom:.7rem;border-bottom:1px solid var(--rule);font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.tk-event{font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2.4vw,3.8rem);font-weight:900;line-height:.86;text-transform:uppercase;text-wrap:balance}
.tk-rows{display:grid;gap:0}
.tk-rows div{display:grid;grid-template-columns:4.5rem 1fr;gap:.75rem;padding-block:.45rem;border-top:1px solid var(--rule);font-size:.95rem}
.tk-rows dt{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding-top:.2rem}
.tk-rows dd{font-weight:600}
.tk-stub{position:relative;display:grid;align-content:center;justify-items:center;gap:.5rem;width:var(--stub);padding:1rem .75rem;text-align:center;transform-origin:0 100%}
.tk-perf{position:absolute;left:0;top:.9rem;bottom:.9rem;border-left:2px dashed color-mix(in srgb,var(--ink) 35%,transparent)}
.tk-price{font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,4rem);font-weight:900;line-height:.85;color:var(--pop);font-variant-numeric:tabular-nums}
.tk-cap{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
html.m .tk-stub{animation:gaTear 1.1s cubic-bezier(.16,1,.3,1) 1.7s both}
@keyframes gaTear{from{transform:none}to{transform:translate(.35rem,.15rem) rotate(4deg)}}
@media (max-width:59.99rem){.tk-wrap{order:-1;padding-inline:.25rem}.dt .tk-wrap{margin-top:calc(-1 * clamp(1rem,5vw,3rem))}}
.plan{--rm-accent:var(--pop);--rm-dot-bg:var(--bg);border-top:2px solid var(--ink)}
.plan .rm-dot{border-radius:2px;font-family:var(--font-display);font-size:1.15rem;font-weight:900}
.plan .rm-txt h3{font-family:var(--font-display);font-size:clamp(1.5rem,1.2rem + 1vw,2.1rem);font-weight:800;line-height:.95;text-wrap:balance}
.plan .rm-meta{font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--ink)}
.one-line{margin-top:1.5rem;font-family:var(--font-display);font-size:clamp(1.8rem,1.4rem + 2vw,3rem);font-weight:800;text-transform:uppercase;line-height:.95}
.photo{overflow:hidden}
.ph-in>div{overflow:hidden;aspect-ratio:16/7;background:var(--surface)}
@media (max-width:47.99rem){.ph-in>div{aspect-ratio:4/3}}
.ph-img{width:100%;height:116%;margin-top:-8%;object-fit:cover}
.tickets{border-top:2px solid var(--ink)}
.tix-grid{display:grid;gap:2rem}
@media (min-width:60rem){.tix-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.tix-side{grid-column:1/5}.board{grid-column:5/13}}
.tix-note{margin-top:1.25rem;max-width:20rem;font-weight:600;color:var(--muted)}
.board{border-top:2px solid var(--ink)}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.5rem 1.5rem;padding-block:clamp(1.1rem,.8rem + 1vw,1.75rem);border-bottom:2px dashed color-mix(in srgb,var(--ink) 30%,transparent)}
.row-n{font-family:var(--font-display);font-size:1.4rem;font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums;align-self:start;padding-top:.3rem}
.row-t h3{font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.4rem);font-weight:900;line-height:.86}
.row-t p{margin-top:.35rem;color:var(--muted)}
.row-p{font-family:var(--font-display);font-size:clamp(2.4rem,1.8rem + 2.6vw,4.4rem);font-weight:900;line-height:.85;font-variant-numeric:tabular-nums}
.row-go{grid-column:2/4;justify-self:start;display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:700;text-decoration:none;border-bottom:2px solid currentColor}
.row-go:hover{border-bottom-color:var(--pop)}
@media (min-width:48rem){.row{grid-template-columns:auto minmax(0,1fr) auto auto}.row-go{grid-column:auto;justify-self:end}}
.details{background:var(--ink);color:var(--bg)}
.det-list{display:grid}
@media (min-width:56rem){.det-list{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}}
.det{display:grid;gap:.75rem;align-content:start;padding:clamp(2.25rem,1.5rem + 2.5vw,4rem) 0;border-bottom:1px solid color-mix(in srgb,var(--bg) 22%,transparent)}
@media (min-width:56rem){.det{padding-inline:2rem;border-bottom:0;border-left:1px solid color-mix(in srgb,var(--bg) 22%,transparent)}.det:first-child{padding-left:0;border-left:0}}
.det dt{font-size:.8rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb,var(--bg) 72%,var(--ink))}
.det dd{display:grid;gap:.6rem;justify-items:start}
.det-v{font-family:var(--font-display);font-size:clamp(2.1rem,1.5rem + 2.2vw,3.6rem);font-weight:900;line-height:.9;text-transform:uppercase;text-wrap:balance}
.det-a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:700;text-decoration:none;color:var(--bg);border-bottom:1px solid currentColor}
.about-grid{display:grid;gap:clamp(2rem,1.5rem + 3vw,4rem)}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.host{grid-column:1/7}.about-copy{grid-column:8/13}}
.host{margin:0}
.host-in{overflow:hidden;aspect-ratio:4/5;background:var(--surface)}
.host-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.host figcaption{margin-top:.7rem;font-size:.9rem;font-weight:600;color:var(--muted)}
.about-copy{display:grid;gap:1.1rem;justify-items:start}
.about-copy .h2{margin-bottom:.5rem}
.about-copy p{font-size:1.12rem;line-height:1.6;max-width:34rem}
.quotes{display:grid;border-top:2px solid var(--ink)}
.quote{display:grid;gap:.8rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--rule)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(2rem,1.4rem + 2.6vw,3.8rem);font-weight:800;line-height:.95;text-transform:uppercase}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-weight:700;color:var(--muted)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.h2{grid-column:1/5}.faq-grid>div{grid-column:5/13}}
.faq{gap:0;border-top:2px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent}
.faq summary{padding:1.15rem 0;font-weight:700;font-size:1.1rem}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.25rem}
.signup{border-top:2px solid var(--ink)}
.signup-grid{display:grid;gap:2.5rem}
@media (min-width:60rem){.signup-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.signup-copy{grid-column:1/9}.signup-side{grid-column:9/13}}
.signup-title{font-family:var(--font-display);font-size:clamp(3.8rem,2rem + 8vw,10rem);font-weight:900;line-height:.8}
.signup .lead{margin-top:1.25rem}
.signup-contact .i{color:var(--ink)}
.form-title{font-family:var(--font-display);font-size:2.2rem;font-weight:900;line-height:1}
.form-lead{margin:.5rem 0 1.25rem;color:var(--muted)}
.field input,.field select,.field textarea{border:0;border-bottom:2px solid var(--ink);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field textarea:focus{box-shadow:0 2px 0 var(--ink)}
.tix-float{position:fixed;right:1.5rem;bottom:1.5rem;z-index:45;display:flex;align-items:center;gap:1.25rem;padding:.45rem .45rem .45rem 1.25rem;background:var(--ink);color:var(--bg);transition:transform .6s var(--ease),opacity .4s ease}
.tf-name{display:grid;font-family:var(--font-display);font-size:1.25rem;font-weight:900;line-height:1;text-transform:uppercase}
.tf-name small{margin-top:.2rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.06em;opacity:.8}
.tix-float .tf-btn{min-height:3rem;background:var(--bg);color:var(--ink)}
.tix-float .tf-btn:hover{background:var(--card)}
html.tf .tix-float:not(.show){transform:translateY(160%);opacity:0;pointer-events:none}
@media (max-width:59.99rem){.tix-float{display:none}}
.ftr{background:var(--bg);border-top:2px solid var(--ink)}
.ftr-name{font-weight:900;text-transform:uppercase}
.mbar{border-top:2px solid var(--ink);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Gather',
  bestFor: 'Workshops, pop-ups, classes and launch parties that sell tickets, with motion',
  match: /\b(events?|workshops?|classes|class|pop-?ups?|tickets?|festivals?|conferences?|meetups?|retreats?|parties|party|shows?|concerts?|tastings?)\b/,
  why: 'A poster for your event, with motion: the date set huge, your ticket landing on it and tearing at the stub, what is included drawn in as a plan as you scroll, and a ticket button that stays in reach.',
  fonts: { q: 'family=Big+Shoulders+Display:wght@500..900&family=Familjen+Grotesk:wght@400..700', display: ['Big Shoulders Display', 'grotesk'], body: ['Familjen Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): the date locks together, the ticket lands and leans to you, the plan draws in.
  choreo: { intro: 'assemble', alive: ['pointer', 'tap'], scroll: 'roadmap', pace: 'medium', look: 'poster stock, a ticket you can tear' },
  tokens,
  slots,
  nav,
  render,
};
