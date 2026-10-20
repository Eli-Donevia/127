// Supper (animated, restaurant): for food and drink, on a warm dark page with the menu printed on paper.
//   Object: the menu, hand-set like a price list (dish, dotted leader, price), and the kitchen's ticket.
//   Material: charred dark and butcher paper: square corners, hairline rules, heavy condensed type, no cards.
//   One move: pour. The name pours in letter by letter and lands with a bounce while the hero photo fills from the
//   bottom like a glass, then the night's first dishes are set on a paper ticket pinned to the photo.
//   Pop: the member's colour as a line drawn under the name's last word, the roadmap's line and the current course.
// Then a band of the dishes that slides with the scroll (not a loop), the courses as a roadmap that draws itself, the
// full menu on paper, three dish photos turning past at their own depth (the scene moment) with their names and prices
// set beside them, the story, the visit (address set like a label, hours like a timetable), questions and a form.
// The name is sized in CSS from its length (a small script only fine-tunes it with a transform), so nothing shifts while
// the intro plays. JavaScript off and reduced motion: the complete, still page. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS, groupNodes } = require('../roadmap');

const id = 'supper';

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.22), '#0c0705', 0.55) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const hero = c.profile.hero || `Food at ${c.name}`;
  const dishes = (c.menu || []).flatMap((sec) => sec.items).map((i) => i.name);
  const pool = [...new Set([...dishes, ...g, `A dish at ${c.name}`, `${c.name}, up close`, `Food at ${c.name}`])].filter((x) => x && x !== hero);
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1600, h: 1100, style: 'plates', alt: hero },
    { slot: 'd1', file: 'dish-1.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[0] },
    { slot: 'd2', file: 'dish-2.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[1] },
    { slot: 'd3', file: 'dish-3.jpg', w: 1000, h: 1250, style: 'plates', alt: pool[2] },
  ];
}

function sections(c) {
  if (c.menu && c.menu.length) return c.menu;
  if (c.services.length) return [{ title: 'Menu', items: c.services.map((s) => ({ ...s, tags: [] })) }];
  return [];
}

function nav(c) {
  return [
    sections(c).length && { label: 'Menu', href: '#menu' },
    c.orderLinks.length > 1 && { label: 'Order', href: '#order' },
    { label: 'Story', href: '#about' },
    { label: 'Visit', href: '#visit' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

const TAG_NAMES = { V: 'Vegetarian', VG: 'Vegan', GF: 'Gluten free', DF: 'Dairy free', SPICY: 'Spicy' };

// The name, one span per letter (screen readers get the plain name). Its size comes from its length, in CSS, so the
// hero's height is known before the font arrives (CLS 0); the script only nudges it with a transform.
function kineticName(name) {
  const words = String(name).trim().split(/\s+/);
  const n = name.length;
  const lines = Math.min(words.length, n <= 18 ? 1 : n <= 30 ? 2 : 3);
  // The words split into that many lines, balanced by length, in the markup itself: the line count never depends on
  // which font has arrived, so the hero's height is fixed from the first paint.
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
  const longest = Math.max(...words.map((w) => w.length));
  // Bricolage Grotesque at 75% width, 800: about 0.37em a letter.
  const fs = Math.min(26, 252 / Math.max(longLine, 4)).toFixed(2);
  // Phones: a name of two or three words stacks one word a line; a longer one keeps its lines.
  const st = words.length > 1 && words.length < 4;
  const fsm = Math.min(40, 236 / Math.max(st ? longest : longLine, 3)).toFixed(2);
  let i = 0;
  const html = groups
    .map((g) => `<span class="kl">${g.map((w) => `<span class="kw">${[...w].map((ch) => `<span class="ch" data-ci-part style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join(' ')}</span>`)
    .join(' ');
  return { html, fs, fsm, st, fh: [31, 20, 14][groups.length - 1], one: groups.length === 1 };
}

function tagsHtml(it) {
  return (it.tags || []).map((t) => ` <abbr class="tag" title="${esc(TAG_NAMES[t] || t)}">${esc(t)}</abbr>`).join('');
}

// One line of the price list: the dish, a dotted leader, the price; its description under it.
function dishLine(it) {
  const desc = it.blurb || it.description;
  return `<li class="dish"><p class="dish-top"><span class="dish-name">${esc(it.name)}${tagsHtml(it)}</span><span class="lead-dots" aria-hidden="true"></span>${it.priceText ? `<span class="dish-price">${esc(it.priceText)}</span>` : ''}</p>${desc ? `<p class="dish-desc">${esc(desc)}</p>` : ''}</li>`;
}

function menuHtml(secs) {
  if (secs.length === 1) return `<div class="mgrid one"><div class="grp-box"><ul class="panel">${secs[0].items.map(dishLine).join('\n')}</ul></div></div>`;
  return `<div class="mgrid">${secs
    .map((s, i) => `<div class="grp-box" data-rv style="--d:${Math.min(i, 6)}"><h3 class="grp"><span class="grp-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h3><ul class="panel">${s.items.map(dishLine).join('\n')}</ul></div>`)
    .join('\n')}</div>`;
}

function render(c) {
  const secs = sections(c);
  const kin = kineticName(c.name);
  const short = c.address ? c.address.split(',')[0] : c.area && !c.online ? c.area : '';
  const pIcon = c.primary ? { phone: 'phone', maps: 'pin', reserve: 'calendar', booking: 'calendar', form: '' }[c.primary.kind] || 'bag' : '';
  const sIcon = c.secondary ? (c.secondary.kind === 'reserve' ? 'calendar' : /maps|directions/i.test(c.secondary.label) ? 'pin' : '') : '';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const items = secs.flatMap((s) => s.items);
  const priced = (name) => items.find((x) => x.name === name);

  // The folio: what, where and when, set across a hairline like the head of a printed menu.
  const folio = [c.whatShort, c.city || (!c.online && c.area), c.hoursLine].filter(Boolean);
  const ticket = items.filter((x) => x.priceText).slice(0, 3);
  const hero = `<section class="hero" aria-labelledby="hero-title">
${folio.length ? `<div class="wrap folio" data-ci="then">${folio.map((x, i) => `<p class="${i === 2 ? 'fo-when' : ''}">${esc(x)}</p>`).join('')}</div>` : ''}
<div class="name-wrap">
<h1 id="hero-title" data-ci="head" class="kin${kin.one ? ' one' : ''}${kin.st ? ' st' : ''}" style="--fs:${kin.fs}vw;--fh:${kin.fh}vh;--fsm:${kin.fsm}vw"><span class="sr-only">${esc(c.name)}</span><span class="kin-in" aria-hidden="true">${kin.html}</span></h1>
</div>
<div class="wrap hero-grid">
<div class="hero-copy">
${c.heroTitle && c.heroTitle !== c.name ? `<p class="hero-line" data-ci="then">${esc(c.heroTitle)}</p>` : ''}
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
${c.primary ? `<div class="ctas" data-ci="then">${mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon))}${c.secondary ? mag(P.button(c.secondary, 'btn btn-ghost btn-lg', sIcon)) : ''}</div>` : ''}
${short ? `<p class="hero-where" data-ci="then"><span>${esc(short)}</span>${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">Directions${icon('arrowUpRight', { size: 14 })}</a>` : ''}</p>` : ''}
</div>
<div class="hero-media">
<div class="hm" data-ci="subject"><div class="hm-in">${P.img(c, 'hero', { cls: 'hero-img', eager: true }).replace('<img ', '<img data-par="0.05" ')}</div></div>
${ticket.length >= 2 ? `<div class="ticket-wrap" data-ci="then"><div class="ticket" data-alive="0.6"><p class="tk-head"><span>${esc(c.name)}</span><span>No. ${String(ticket.length).padStart(3, '0')}</span></p><ul>${ticket.map((x) => `<li><span>${esc(x.name)}</span><i aria-hidden="true"></i><span class="tk-p">${esc(x.priceText)}</span></li>`).join('')}</ul></div></div>` : ''}
</div>
</div>
</section>`;

  // The dishes as a band that moves with the page (no loop): names, with their prices.
  const dishes = [...new Map(items.map((i) => [i.name, i])).values()].slice(0, 12);
  const row = (list, hidden) => `<ul class="dl"${hidden ? ' aria-hidden="true"' : ''}>${list.map((d) => `<li><span>${esc(d.name)}</span>${d.priceText ? `<span class="dl-p">${esc(d.priceText)}</span>` : ''}</li>`).join('')}</ul>`;
  const band = dishes.length >= 3
    ? `<div class="dishband"><div class="band"><div class="band-track" data-sx="0.2"><h2 class="sr-only">From the menu</h2>${row(dishes, false)}${row(dishes, true)}</div></div></div>`
    : '';

  const tagged = items.some((i) => (i.tags || []).length);
  const menu = secs.length
    ? `<section class="sec menu-sec paper" id="menu" aria-labelledby="menu-title">
<div class="wrap">
<div class="menu-head">
<h2 class="menu-title" id="menu-title" data-split>Menu</h2>
<div class="menu-side">${c.whatShort ? `<p>${esc(c.whatShort)}</p>` : ''}${short ? `<p>${esc(short)}</p>` : ''}${tagged ? '<p class="legend">V vegetarian, VG vegan, GF gluten free</p>' : ''}</div>
</div>
${menuHtml(secs)}
${c.primary ? `<div class="menu-foot">${mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon))}</div>` : ''}
</div>
</section>`
    : '';

  const order = c.orderLinks.length > 1 || (c.orderLinks.length && c.reserve)
    ? `<section class="sec order" id="order" aria-labelledby="order-title"><div class="wrap order-grid">
<h2 class="h2" id="order-title" data-split>Order your way</h2>
<ul class="order-list">${c.orderLinks.map((l, i) => `<li data-rv style="--d:${i + 1}"><a href="${esc(l.href)}"><span>${esc(l.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>`).join('')}${c.reserve ? `<li data-rv style="--d:${c.orderLinks.length + 1}"><a href="${esc(c.booking.href)}"><span>${esc(c.booking.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>` : ''}</ul>
</div></section>`
    : '';

  // The courses as a roadmap (each group with its lowest price and first dishes), drawn in with the scroll, ending at
  // the order button.
  const nodes = groupNodes(secs);
  const grouped = secs.filter((s) => s.items.length).length >= 2;
  const course = c.primary ? roadmap({ id: 'courses', cls: 'courses', title: grouped ? `${secs[0].title} to ${secs[secs.length - 1].title}` : 'Start to finish', nodes, end: mag(P.button(c.primary, 'btn btn-primary', pIcon)), endLabel: c.name }) : '';

  // Three dish photos at their own depth (the scene moment), each captioned beside it with the dish and its price.
  const plates = `<section class="plates" aria-label="Photos" data-sc><div class="wrap plate-row">
${['d1', 'd2', 'd3'].map((k, i) => {
    const im = c.images[k];
    const it = im && priced(im.alt);
    return `<figure class="plate p${i + 1}" data-sc-part style="--depth:${[0.5, 1.3, 0.85][i]};--turn:${[1.4, -1.8, 1.2][i]}deg"><div class="plate-in" data-alive="${[0.7, 1, 0.6][i]}">${P.img(c, k)}</div>${it ? `<figcaption><span class="pc-n">${String(i + 1).padStart(2, '0')}</span><span>${esc(it.name)}</span>${it.priceText ? `<span class="pc-p">${esc(it.priceText)}</span>` : ''}</figcaption>` : ''}</figure>`;
  }).join('\n')}
</div></section>`;

  const [first = '', ...rest] = c.aboutParas;
  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<h2 class="about-title" id="about-title" data-split>${esc(c.tagline || `About ${c.name}`)}</h2>
<div class="about-copy">
${first ? `<p class="about-first" data-rv>${esc(first)}</p>` : ''}
${rest.map((p, i) => `<p data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig" data-rv style="--d:3">${esc(c.owner)}</p>` : ''}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<h2 class="sr-only" id="reviews-title">From our guests</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const directions = c.mapsUrl && (!c.primary || c.primary.kind !== 'maps') ? `<a data-mag class="btn btn-ghost btn-lg" href="${esc(c.mapsUrl)}">${icon('pin', { size: 18 })}Get directions</a>` : '';
  const addrLines = c.address ? c.address.split(/,\s*/) : c.area && !c.online ? [c.area] : [];
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title"><div class="wrap visit-grid">
<div class="visit-copy">
<h2 class="visit-title" id="visit-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas" data-rv style="--d:4">${c.primary ? mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon)) : ''}${directions}</div>
</div>
<div class="visit-facts">
${addrLines.length ? `<div class="vf" data-rv style="--d:2"><h3>Find us</h3><address class="label">${addrLines.map((l) => `<span>${esc(l)}</span>`).join('')}</address>${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>` : ''}
${c.hours.rows.length ? `<div class="vf" data-rv style="--d:3"><h3>Hours</h3>${P.hours(c.hours.rows, 'sp-hours')}</div>` : ''}
${c.phone || c.email ? `<div class="vf" data-rv style="--d:4"><h3>Call or write</h3>${c.phone ? `<p class="vf-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
</div>
</div></section>`;

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title" data-split>Questions</h2><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  const contact = c.email || c.formMode !== 'email'
    ? `<section class="sec contact paper" id="contact" aria-labelledby="contact-title"><div class="wrap contact-grid">
<div><h2 class="h2" id="contact-title" data-split>${/cater|truck|bakery|cake/i.test(`${c.what} ${c.profile.id}`) ? 'Catering, events and big orders' : 'Big orders and questions'}</h2><p class="lead" data-rv style="--d:3">Send a few details and we will get back to you.</p></div>
<div class="form-wrap" data-rv style="--d:2">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.date }, { ...P.FIELD_PRESETS.guests }, 'message'], submit: 'Send', subject: `Message for ${c.name}` })}</div>
</div></section>`
    : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-sp', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, band, course, menu, order, plates, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '3px', radiusSm: '2px', btnRadius: '3px', max: '80rem' } };
}

// Nudges the name to the width with a transform only (its box is already sized in CSS, so nothing moves); marks today's
// hours.
const JS = `(function(){var d=document;
var k=d.querySelector('.kin-in');function fit(){if(!k)return;k.style.transform='';var h=k.parentNode,w=h.clientWidth,ws=[].slice.call(k.querySelectorAll('.kw')),st=h.classList.contains('st')&&innerWidth<640;var ls=st?ws:[].slice.call(k.querySelectorAll('.kl')),m=Math.max.apply(0,ls.map(function(e){return e.offsetWidth}));if(!m)return;var r=Math.max(.86,Math.min(1.08,w/m));k.style.transform=Math.abs(r-1)<.004?'':'scale('+r.toFixed(3)+')'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var D=['sun','mon','tue','wed','thu','fri','sat'],t=new Date().getDay();[].slice.call(d.querySelectorAll('.sp-hours>div')).forEach(function(r){var s=(r.querySelector('dt')||{}).textContent||'',x=s.toLowerCase(),hit=/every ?day|daily/.test(x);x.replace(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*(?:\\s*(?:to|-|\\u2013)\\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*)?/g,function(m,a,b){var i=D.indexOf(a),j=b?D.indexOf(b):i;for(var n=0;n<7;n++){if((i+n)%7===t)hit=true;if((i+n)%7===j)break}});if(hit)r.classList.add('today')});
})();`;

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
:root{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--primary-deep:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-soft:color-mix(in srgb,var(--primary) 20%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--paper:color-mix(in srgb,var(--on-dark) 45%,#ecdfca);--ease:cubic-bezier(.16,1,.3,1);color-scheme:dark}
.paper{--bg:var(--paper);--ink:var(--dark);--muted:color-mix(in srgb,var(--dark) 74%,var(--on-dark));--line:color-mix(in srgb,var(--dark) 22%,var(--on-dark));--pop:color-mix(in srgb,var(--primary) 70%,var(--dark));--focus:var(--dark);background:var(--bg);color:var(--ink);color-scheme:light}
h1,h2,h3{font-weight:800;font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
.h2{font-size:clamp(2.8rem,1.6rem + 4.6vw,6rem);line-height:.86}
.lead{color:var(--muted)}
.btn{font-weight:600;letter-spacing:.01em}
.btn-primary{box-shadow:none}
.btn:hover{transform:none}
.btn-ghost{border-width:1px;border-color:var(--line)}
.btn-ghost:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .35s ease,border-color .35s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--dark) 92%,transparent);border-bottom-color:var(--line-on-dark)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.45rem;font-weight:800;font-stretch:75%;line-height:1;letter-spacing:0;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{display:block;padding:.5rem 0;font-weight:500;text-decoration:none;color:var(--muted-on-dark);background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;transition:color .2s ease,background-size .35s var(--ease)}
.nav a:hover{color:var(--on-dark);background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem}
.menu>summary{background:transparent;border-color:var(--line-on-dark);border-radius:3px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(.75rem,.5rem + 1vw,1.5rem) clamp(3.5rem,2rem + 5vw,7rem)}
.folio{display:flex;flex-wrap:wrap;gap:.35rem 2rem;justify-content:space-between;padding-block:.7rem;border-block:1px solid var(--line);font-size:.8rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.folio p:first-child{color:var(--ink)}
@media (max-width:47.99rem){.fo-when{display:none}}
.name-wrap{position:relative;padding-inline:clamp(1rem,2.6vw,3rem);margin-top:clamp(1rem,2vw,2rem);overflow:hidden}
.kin{font-size:clamp(3rem,min(var(--fs),max(var(--fh),11.5rem)),22rem);font-weight:800;font-stretch:75%;line-height:.8;letter-spacing:-.025em;text-transform:none;padding-block:.05em .06em}
.kin-in{display:block;transform-origin:0 50%}
.kl{display:block;width:max-content;white-space:nowrap}
.kw{display:inline-block;white-space:nowrap}
@media (max-width:39.99rem){.kin{font-size:var(--fsm)}.kin.st .kw{display:block;width:max-content}}
.ch{display:inline-block;transition:font-weight .5s cubic-bezier(.2,.8,.2,1),color .5s ease}
@media (hover:hover){html.m .ch:hover{font-weight:300;color:var(--pop)}html.m .ch:has(+.ch:hover),html.m .ch:hover+.ch{font-weight:540}}
.hero-grid{position:relative;display:grid;gap:2.5rem;margin-top:clamp(1.5rem,.8rem + 2.4vw,3rem)}
@media (min-width:60rem){.hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.hero-copy{grid-column:1/5;padding-top:.25rem}.hero-media{grid-column:6/13;margin-right:calc((min(100vw - 4rem,var(--max)) - 100vw) / 2)}}
.hero-line{font-family:var(--font-display);font-size:clamp(1.8rem,1.3rem + 1.6vw,2.6rem);font-weight:800;font-stretch:75%;line-height:.95;text-transform:uppercase;margin-bottom:1rem}
.hero .lead{max-width:30rem;font-size:1.15rem}
.ctas{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.75rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-where{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.95rem;color:var(--muted)}
.hero-where a{display:inline-flex;align-items:center;gap:.25rem;min-height:2.75rem;font-weight:600;color:var(--ink);text-decoration:underline;text-decoration-color:var(--line)}
.hero-media{position:relative}
.hm{overflow:hidden;aspect-ratio:16/9;background:var(--primary-soft)}
.hm-in{height:100%;overflow:hidden}
.hero-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.ticket-wrap{position:absolute;left:clamp(-1rem,-4vw,-4rem);bottom:clamp(-2.5rem,-3vw,-1.5rem);width:min(19rem,72%)}
@media (max-width:59.99rem){.ticket-wrap{left:.75rem;bottom:-2rem}}
.ticket{padding:1rem 1.1rem 1.15rem;background:var(--paper);color:var(--dark);box-shadow:0 1px 0 color-mix(in srgb,var(--dark) 20%,transparent),0 30px 50px -30px rgba(0,0,0,.8);transform-origin:50% 0;cursor:pointer}
.tk-head{display:flex;justify-content:space-between;gap:1rem;padding-bottom:.6rem;margin-bottom:.4rem;border-bottom:1px dashed color-mix(in srgb,var(--dark) 40%,transparent);font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.ticket li{display:flex;align-items:baseline;gap:.5rem;padding:.3rem 0;font-size:.95rem;font-weight:500}
.ticket li i{flex:1;min-width:1rem;border-bottom:1px dotted color-mix(in srgb,var(--dark) 45%,transparent)}
.tk-p{font-variant-numeric:tabular-nums;font-weight:600}
.dishband{border-block:1px solid var(--line);overflow:hidden;margin-top:clamp(1.5rem,1rem + 2vw,3rem)}
.band{overflow:hidden;padding-block:clamp(1.1rem,.8rem + 1vw,1.75rem)}
.band-track{display:flex;width:max-content}
.dl{display:flex;flex:none;align-items:baseline}
.dl li{display:flex;align-items:baseline;gap:.6rem;padding-right:2.5rem;white-space:nowrap;font-family:var(--font-display);font-size:clamp(2rem,1.4rem + 2.4vw,3.8rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase;letter-spacing:-.01em}
.dl li::after{content:'';align-self:center;width:2.5rem;height:1px;margin-left:1.9rem;background:var(--line)}
.dl-p{font-family:var(--font-body);font-size:max(.95rem,.4em);font-weight:500;letter-spacing:0;color:var(--muted);font-variant-numeric:tabular-nums}
.courses{--rm-accent:var(--pop);--rm-dot-bg:var(--dark)}
.courses .rm-head{margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.courses .h2{font-size:clamp(2.4rem,1.5rem + 3.6vw,4.8rem)}
.courses .rm-dot{border-width:1px;border-radius:50%}
.courses .rm-txt h3{font-size:clamp(1.6rem,1.3rem + 1.2vw,2.4rem);letter-spacing:-.01em}
.courses .rm-meta{font-variant-numeric:tabular-nums}
.menu-head{display:grid;gap:1rem 3rem;align-items:end;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem);padding-bottom:1rem;border-bottom:2px solid var(--ink)}
@media (min-width:48rem){.menu-head{grid-template-columns:1fr auto}}
.menu-title{font-size:clamp(4.5rem,2rem + 12vw,13rem);line-height:.78;letter-spacing:-.03em}
.menu-side{display:grid;gap:.2rem;font-size:.85rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
@media (min-width:48rem){.menu-side{text-align:right;padding-bottom:.4rem}}
.legend{letter-spacing:.02em;text-transform:none;font-weight:500}
.mgrid{display:grid;gap:2.75rem 4rem}
@media (min-width:56rem){.mgrid{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}.mgrid.one .panel{columns:2;column-gap:4rem}}
.grp{display:flex;align-items:baseline;gap:.8rem;margin-bottom:.4rem;padding-bottom:.6rem;border-bottom:1px solid var(--line);font-size:clamp(1.7rem,1.4rem + 1vw,2.4rem);line-height:1}
.grp-n{font-family:var(--font-body);font-size:.85rem;font-weight:600;letter-spacing:.06em;color:var(--muted);font-variant-numeric:tabular-nums}
.dish{break-inside:avoid;padding:.85rem 0;border-bottom:1px solid var(--line)}
.dish-top{display:flex;align-items:baseline;gap:.6rem}
.dish-name{font-size:1.1rem;font-weight:600;line-height:1.3}
.lead-dots{flex:1;min-width:1.5rem;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 45%,transparent);transform:translateY(-.25em)}
.dish-price{font-size:1.1rem;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dish-desc{margin-top:.2rem;max-width:30rem;font-size:.97rem;color:var(--muted)}
.tag{margin-left:.3rem;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-decoration:none;color:var(--muted);vertical-align:.15em}
.menu-foot{margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
.paper .btn-primary{background:var(--dark);color:var(--on-dark)}
.paper .btn-primary:hover{background:color-mix(in srgb,var(--dark) 85%,var(--primary))}
.order-grid{display:grid;gap:2rem}
@media (min-width:60rem){.order-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.order-list{border-top:1px solid var(--line)}
.order-list li{border-bottom:1px solid var(--line)}
.order-list a{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:clamp(1rem,.8rem + 1vw,1.5rem) 0;font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.2vw,3.2rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase;text-decoration:none}
.order-list a .i{flex:none;color:var(--pop);transition:transform .4s var(--ease)}
.order-list a:hover .i{transform:translate(4px,-4px)}
.plates{padding-block:clamp(4rem,2rem + 6vw,8rem) clamp(6rem,3rem + 8vw,11rem);overflow:hidden}
.plate-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:1rem;align-items:start}
.plate{margin:0}
.p1{grid-column:1/5;margin-top:clamp(2rem,6vw,6rem)}
.p2{grid-column:5/10}
.p3{grid-column:10/13;margin-top:clamp(4rem,12vw,12rem)}
@media (max-width:47.99rem){.plate-row{gap:2rem 1rem}.p1{grid-column:1/9;margin-top:0}.p2{grid-column:4/13;margin-top:0}.p3{grid-column:1/8;margin-top:0}}
.plate-in{overflow:hidden;aspect-ratio:4/5;background:var(--primary-soft);cursor:pointer;transform-origin:50% 50%}
.plate img{width:100%;height:100%;object-fit:cover}
.plate figcaption{display:flex;align-items:baseline;gap:.6rem;margin-top:.7rem;font-size:.92rem;color:var(--muted)}
.plate figcaption span:nth-child(2){color:var(--ink);font-weight:600}
.pc-n{font-variant-numeric:tabular-nums;font-size:.78rem;letter-spacing:.08em}
.pc-p{margin-left:auto;font-variant-numeric:tabular-nums}
.about-grid{display:grid;gap:2rem 4rem}
@media (min-width:60rem){.about-grid{grid-template-columns:repeat(12,minmax(0,1fr))}.about-title{grid-column:1/7}.about-copy{grid-column:7/12;padding-top:.6rem}}
.about-title{font-size:clamp(2.6rem,1.6rem + 4vw,5.6rem);line-height:.88}
.about-copy{display:grid;gap:1.1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
.about-first{font-size:clamp(1.3rem,1.1rem + .8vw,1.7rem);line-height:1.35;color:var(--ink)}
.sig{font-family:var(--font-display);font-size:1.6rem;font-weight:800;font-stretch:75%;text-transform:uppercase;color:var(--ink)}
.quotes{display:grid;border-top:1px solid var(--line)}
.quote{display:grid;gap:1rem;padding-block:clamp(1.75rem,1.2rem + 2vw,3rem);border-bottom:1px solid var(--line)}
@media (min-width:60rem){.quote{grid-template-columns:repeat(12,minmax(0,1fr));align-items:baseline}.quote blockquote{grid-column:1/10}.quote figcaption{grid-column:10/13;text-align:right}}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.9rem,1.3rem + 2.4vw,3.6rem);font-weight:700;font-stretch:80%;line-height:1;letter-spacing:-.02em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-size:.9rem;font-weight:600;color:var(--muted)}
.visit{border-top:1px solid var(--line)}
.visit-grid{display:grid;gap:3rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.visit-copy{grid-column:1/8}.visit-facts{grid-column:9/13;padding-top:1rem}}
.visit-title{font-size:clamp(3.6rem,2rem + 8vw,10rem);line-height:.8;letter-spacing:-.03em}
.visit .lead{margin-top:1.5rem;max-width:30rem}
.visit .ctas{margin-top:2rem}
.visit-facts{display:grid;gap:0;border-top:1px solid var(--line)}
.vf{padding-block:1.25rem;border-bottom:1px solid var(--line)}
.vf h3{margin-bottom:.6rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.14em;font-stretch:100%;color:var(--muted)}
.label{display:grid;font-style:normal;font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1vw,2.2rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase}
.vf-big{font-family:var(--font-display);font-size:1.7rem;font-weight:800;font-stretch:75%;line-height:1.1}
.vf p+p{margin-top:.4rem}
.vf a{color:var(--ink)}
.vf .vf-big a{text-decoration:none}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;margin-top:.4rem;font-weight:600;text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.sp-hours div{padding:.4rem 0;border-bottom:1px dotted var(--line);font-variant-numeric:tabular-nums}
.sp-hours dd{color:var(--ink)}
.sp-hours .today dt,.sp-hours .today dd{color:var(--pop)}
.sp-hours .today dt::after{content:' (today)';font-weight:400}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.faq-grid>.h2{grid-column:1/5}.faq-grid>div{grid-column:6/13}}
.faq{gap:0;border-top:1px solid var(--line)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.15rem 0;font-size:1.1rem}
.faq summary .i{color:var(--pop)}
.faq .ans{padding:0 0 1.25rem}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem}.contact-grid>div:first-child{grid-column:1/6}.form-wrap{grid-column:7/13}}
.contact .lead{margin-top:1.25rem;max-width:26rem}
.field input,.field select,.field textarea{border:0;border-bottom:1.5px solid color-mix(in srgb,var(--ink) 40%,transparent);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1.5px 0 var(--ink)}
.ftr-name{font-weight:800;font-stretch:75%;text-transform:uppercase}
.mbar{background:var(--dark);border-top-color:var(--line-on-dark);box-shadow:none}
`;

module.exports = {
  id,
  kind: 'restaurant',
  name: 'Supper',
  bestFor: 'Restaurants, cafes, bars, bakeries and food trucks, with motion',
  why: 'Warm and appetizing on a dark page, with motion: your name pours in and fills the screen, your first dishes are set on a ticket beside the photo, your courses draw in as you scroll, and the full menu is printed on paper with prices on dotted leaders.',
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1', display: ['Bricolage Grotesque', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): poured in, a ticket and plates you can nudge, a row of dishes that turns as you
  // pass.
  choreo: { intro: 'pour', alive: ['drift', 'tap'], scroll: 'scene', pace: 'medium', look: 'warm, generous, a little bounce' },
  tokens,
  slots,
  nav,
  render,
};
