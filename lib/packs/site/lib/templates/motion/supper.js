// Supper (animated, restaurant): for food and drink, on a warm dark page. The name fills the width in heavy condensed
// type and pours in, letter after letter landing with a bounce, while the hero photo fills from the bottom like a glass;
// letters lean light under the pointer; dish names slide across the page in two opposite bands moved by the scroll; the
// menu has category tabs that work with CSS only (radio buttons), then draws itself in as a roadmap of its sections
// with the scroll; order and reserve buttons are magnetic; the round dish
// photos are the scroll moment (each at its own depth, turning as the row crosses the screen) and drift on springs,
// bouncing when tapped; hours mark today, with directions. No glow or grain. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, HEAD_CSS, esc } = require('../shared');
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
    { slot: 'd1', file: 'dish-1.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[0] },
    { slot: 'd2', file: 'dish-2.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[1] },
    { slot: 'd3', file: 'dish-3.jpg', w: 1000, h: 1000, style: 'plates', alt: pool[2] },
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
const MAX_TABS = 8;

// The name, one span per letter (screen readers get the plain name). Sized from its length so it fills the width.
function kineticName(name) {
  const words = String(name).trim().split(/\s+/);
  const n = name.length;
  const lines = n <= 18 ? 1 : n <= 30 ? 2 : 3;
  const longest = Math.max(...words.map((w) => w.length));
  const per = lines === 1 ? n : Math.ceil(n / lines) + 2;
  const fs = Math.min(26, 255 / Math.max(per, 4), 230 / Math.max(longest, 4)).toFixed(2);
  // On phones a name of two or three words stacks, one word per line, sized by its longest word.
  const st = words.length > 1 && words.length < 4;
  const fsm = Math.min(40, 214 / Math.max(longest, 3)).toFixed(2);
  let i = 0;
  const html = words
    .map((w) => `<span class="kw">${[...w].map((ch) => `<span class="ch" data-ci-part style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`)
    .join(' ');
  return { html, fs, fsm, st, fh: [36, 22, 15][lines - 1], one: lines === 1 };
}

// h: 'h3' when the menu has one group and so no group heading (headings never skip a level).
function itemHtml(it, i, h) {
  const hx = h === 'h3' ? 'h3' : 'h4';
  return `<li class="dish" style="--i:${Math.min(i, 14)}">
<div class="dish-top"><${hx}>${esc(it.name)}${(it.tags || []).map((t) => ` <abbr class="tag" title="${esc(TAG_NAMES[t] || t)}">${esc(t)}</abbr>`).join('')}</${hx}>${it.priceText ? `<span class="dish-price">${esc(it.priceText)}</span>` : ''}</div>
${it.blurb || it.description ? `<p class="dish-desc">${esc(it.blurb || it.description)}</p>` : ''}
</li>`;
}

// Category tabs with radio buttons: no script needed, and each tab's dishes stagger in when it opens.
function menuHtml(secs) {
  if (secs.length === 1) return `<div class="mtabs one" data-rv><div class="panels"><ul class="panel">${secs[0].items.map((it, i) => itemHtml(it, i, 'h3')).join('\n')}</ul></div></div>`;
  // More groups than tabs fit: every group stacked under its own heading.
  if (secs.length > MAX_TABS) return `<div class="mtabs one many" data-rv><div class="panels">${secs.map((s) => `<div class="grp-box"><h3 class="grp">${esc(s.title)}</h3><ul class="panel">${s.items.map(itemHtml).join('\n')}</ul></div>`).join('\n')}</div></div>`;
  const tabs = secs;
  return `<div class="mtabs" data-rv>
${tabs.map((s, i) => `<input class="sr-only" type="radio" name="menu-tab" id="mt-${i}"${i === 0 ? ' checked' : ''}>`).join('')}
<div class="tabbar" role="presentation">${tabs.map((s, i) => `<label for="mt-${i}">${esc(s.title)}<span class="cnt" aria-hidden="true">${s.items.length}</span></label>`).join('')}</div>
<div class="panels">${tabs.map((s, i) => `<div class="pnl pnl-${i}"><h3 class="sr-only">${esc(s.title)}</h3><ul class="panel">${s.items.map(itemHtml).join('\n')}</ul></div>`).join('\n')}</div>
</div>`;
}

function render(c) {
  const secs = sections(c);
  const kin = kineticName(c.name);
  const short = c.address ? c.address.split(',')[0] : c.area && !c.online ? c.area : '';
  const pIcon = c.primary ? { phone: 'phone', maps: 'pin', reserve: 'calendar', booking: 'calendar', form: '' }[c.primary.kind] || 'bag' : '';
  const sIcon = c.secondary ? (c.secondary.kind === 'reserve' ? 'calendar' : /maps|directions/i.test(c.secondary.label) ? 'pin' : '') : '';
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const eyebrow = [c.whatShort, c.city].filter(Boolean).join(' · ');

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-top">
${eyebrow ? `<p class="hero-eye" data-ci="then"><span class="flame" aria-hidden="true"></span>${esc(eyebrow)}</p>` : '<span></span>'}
${c.hoursLine ? `<p class="hero-hours" data-ci="then">${icon('clock', { size: 16 })}${esc(c.hoursLine)}</p>` : ''}
</div>
<div class="name-wrap">
<h1 id="hero-title" data-ci="head" class="kin${kin.one ? ' one' : ''}${kin.st ? ' st' : ''}" style="--fs:${kin.fs}vw;--fh:${kin.fh}vh;--fsm:${kin.fsm}vw"><span class="sr-only">${esc(c.name)}</span><span class="kin-in" aria-hidden="true">${kin.html}</span></h1>
</div>
<div class="wrap hero-grid">
<div class="hero-copy">
${c.heroTitle && c.heroTitle !== c.name ? `<p class="hero-line" data-ci="then">${esc(c.heroTitle)}</p>` : ''}
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
${c.primary ? `<div class="ctas" data-ci="then">${mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon))}${c.secondary ? mag(P.button(c.secondary, 'btn btn-ghost btn-lg', sIcon)) : ''}</div>` : ''}
${short ? `<p class="hero-where" data-ci="then">${icon('pin', { size: 16 })}<span>${esc(short)}</span>${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">Directions${icon('arrowUpRight', { size: 14 })}</a>` : ''}</p>` : ''}
</div>
<div class="hero-media" data-ci="subject"><div class="hm-in">${P.img(c, 'hero', { cls: 'hero-img', eager: true }).replace('<img ', '<img data-par="0.06" ')}</div></div>
</div>
</section>`;

  const dishes = [...new Set(secs.flatMap((s) => s.items.map((i) => i.name)))].slice(0, 12);
  const star = '<span class="ast" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
  const row = (list, hidden, cls) => `<ul class="${cls}"${hidden ? ' aria-hidden="true"' : ''}>${list.map((d) => `<li>${esc(d)}${star}</li>`).join('')}</ul>`;
  const marquee = dishes.length >= 3
    ? `<div class="dishband" aria-label="From the menu">
<div class="band band-a"><div class="band-track" data-sx="0.22">${row(dishes, false, 'dl')}${row(dishes, true, 'dl')}</div></div>
<div class="band band-b" aria-hidden="true"><div class="band-track" data-sx="-0.16">${row([...dishes].reverse(), true, 'dl')}${row([...dishes].reverse(), true, 'dl')}</div></div>
</div>`
    : '';

  const tagged = secs.some((s) => s.items.some((i) => (i.tags || []).length));
  const menu = secs.length
    ? `<section class="sec menu-sec" id="menu" aria-labelledby="menu-title">
<div class="wrap">
<div class="menu-head">
<div><p class="eyebrow" data-rv>Menu</p><h2 class="h2" id="menu-title" data-split>The menu</h2></div>
${tagged ? '<p class="legend" data-rv style="--d:2">V vegetarian, VG vegan, GF gluten free</p>' : ''}
</div>
${menuHtml(secs)}
</div>
</section>`
    : '';

  const order = c.orderLinks.length > 1 || (c.orderLinks.length && c.reserve)
    ? `<section class="sec order" id="order" aria-labelledby="order-title"><div class="wrap">
<p class="eyebrow" data-rv>Order</p>
<h2 class="h2" id="order-title" data-split>Order your way</h2>
<ul class="order-list">${c.orderLinks.map((l, i) => `<li data-rv style="--d:${i + 1}"><a data-mag href="${esc(l.href)}"><span>${esc(l.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>`).join('')}${c.reserve ? `<li data-rv style="--d:${c.orderLinks.length + 1}"><a data-mag href="${esc(c.booking.href)}"><span>${esc(c.booking.label)}</span>${icon('arrowUpRight', { size: 28 })}</a></li>` : ''}</ul>
</div></section>`
    : '';

  // The menu as a roadmap: each section with its lowest price and first dishes, drawn in with the scroll, ending at
  // the order (or reserve) button.
  const course = c.primary ? roadmap({ id: 'courses', cls: 'courses', eyebrow: 'From the kitchen', title: 'Start to finish', nodes: groupNodes(secs), end: mag(P.button(c.primary, 'btn btn-primary', pIcon)), endLabel: c.name }) : '';

  const plates = `<section class="plates" aria-label="Photos" data-sc><div class="wrap plate-row">
${['d1', 'd2', 'd3'].map((k, i) => `<figure class="plate p${i + 1}" data-sc-part style="--depth:${[0.6, 1.4, 0.9][i]};--turn:${[40, -70, 55][i]}deg"><div class="plate-in" data-alive="${[1, 1.3, 0.9][i]}"><div class="spin">${P.img(c, k)}</div></div></figure>`).join('\n')}
</div></section>`;

  const about = `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<div><p class="eyebrow" data-rv>Our story</p><h2 class="h2" id="about-title" data-split>${esc(c.tagline || `About ${c.name}`)}</h2></div>
<div class="about-copy">
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig" data-rv style="--d:3">${esc(c.owner)}</p>` : ''}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<p class="eyebrow" data-rv>Kind words</p><h2 class="h2" id="reviews-title" data-split>From our guests</h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-spot data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const directions = c.mapsUrl && (!c.primary || c.primary.kind !== 'maps') ? `<a data-mag class="btn btn-ghost btn-lg" href="${esc(c.mapsUrl)}">${icon('pin', { size: 18 })}Get directions</a>` : '';
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title"><div class="wrap visit-grid">
<div class="visit-copy">
<p class="eyebrow" data-rv>Visit</p>
<h2 class="visit-title" id="visit-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas" data-rv style="--d:4">${c.primary ? mag(P.button(c.primary, 'btn btn-primary btn-lg', pIcon)) : ''}${directions}</div>
</div>
<div class="visit-card" data-rv="scale" style="--d:2">
${c.hours.rows.length ? `<div class="vc"><h3>${icon('clock', { size: 16 })}Hours</h3>${P.hours(c.hours.rows, 'sp-hours')}</div>` : ''}
${c.address || (c.area && !c.online) ? `<div class="vc"><h3>${icon('pin', { size: 16 })}Find us</h3><p class="vc-big">${esc(c.address || c.area)}</p>${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Open in Google Maps${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>` : ''}
${c.phone || c.email ? `<div class="vc"><h3>${icon('phone', { size: 16 })}Call or write</h3>${c.phone ? `<p class="vc-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
</div>
</div></section>`;

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div><p class="eyebrow" data-rv>Good to know</p><h2 class="h2" id="faq-title" data-split>Questions</h2></div><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  const contact = c.email || c.formMode !== 'email'
    ? `<section class="sec contact" id="contact" aria-labelledby="contact-title"><div class="wrap contact-grid">
<div><p class="eyebrow" data-rv>Contact</p><h2 class="h2" id="contact-title" data-split>${/cater|truck|bakery|cake/i.test(`${c.what} ${c.profile.id}`) ? 'Catering, events and big orders' : 'Questions and big orders'}</h2><p class="lead" data-rv style="--d:3">Send a few details and we will get back to you.</p></div>
<div class="form-card" data-rv="scale" style="--d:2">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.date }, { ...P.FIELD_PRESETS.guests }, 'message'], submit: 'Send', subject: `Message for ${c.name}` })}</div>
</div></section>`
    : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-sp', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, marquee, menu, course, order, plates, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', btnRadius: '999px', max: '78rem' } };
}

// Fits the name to the width (on phones a short name stacks one word per line); marks today's hours.
const JS = `(function(){var d=document,calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var k=d.querySelector('.kin-in');function fit(){if(!k)return;k.style.fontSize='';var h=k.parentNode,w=h.clientWidth,ws=[].slice.call(k.querySelectorAll('.kw')),st=innerWidth<640&&h.classList.contains('st');var one=!st&&h.classList.contains('one'),m=one?k.offsetWidth:Math.max.apply(0,ws.map(function(e){return e.offsetWidth}));if(!m)return;var r=one||st?w/m:Math.min(1,w/m);r=Math.max(.5,Math.min(st?2.4:1.35,r));var px=parseFloat(getComputedStyle(k).fontSize)*r*.985;if(!st)px=Math.min(px,Math.max(innerHeight,500)*.36);k.style.fontSize=px.toFixed(1)+'px'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var D=['sun','mon','tue','wed','thu','fri','sat'],t=new Date().getDay();[].slice.call(d.querySelectorAll('.sp-hours>div')).forEach(function(r){var s=(r.querySelector('dt')||{}).textContent||'',x=s.toLowerCase(),hit=/every ?day|daily/.test(x);x.replace(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*(?:\\s*(?:to|-|\\u2013)\\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*)?/g,function(m,a,b){var i=D.indexOf(a),j=b?D.indexOf(b):i;for(var n=0;n<7;n++){if((i+n)%7===t)hit=true;if((i+n)%7===j)break}});if(hit)r.classList.add('today')});
})();`;

const TAB_CSS = Array.from({ length: MAX_TABS }, (_, i) => `#mt-${i}:checked~.panels .pnl-${i}{display:block}#mt-${i}:checked~.tabbar label[for=mt-${i}]{background:var(--button);color:var(--on-button);border-color:var(--button)}#mt-${i}:focus-visible~.tabbar label[for=mt-${i}]{outline:3px solid var(--focus);outline-offset:3px}`).join('\n');

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${ROADMAP_CSS}
.courses .rm-txt h3{font-family:var(--font-display);font-weight:800;font-stretch:75%;text-transform:uppercase;font-size:clamp(1.6rem,1.3rem + 1.2vw,2.4rem);letter-spacing:-.01em}
.courses .rm-meta{font-family:var(--serif);font-style:italic;font-weight:400;font-size:1.35rem}
:root{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--primary-deep:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-soft:color-mix(in srgb,var(--primary) 20%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--serif:"Instrument Serif","Iowan Old Style",Georgia,serif;color-scheme:dark}
h1,h2,h3{font-weight:700;letter-spacing:-.03em;font-stretch:80%}
.h2{font-size:clamp(2.6rem,1.6rem + 4vw,5.2rem);line-height:.92;text-transform:uppercase;font-weight:800;font-stretch:75%;letter-spacing:-.02em}
.eyebrow{color:var(--primary-on-dark)}
.btn-primary{box-shadow:none}
.lead{color:var(--muted-on-dark)}
.btn-ghost{border-color:var(--line-on-dark);border-width:1.5px}
.btn-ghost:hover{background:var(--on-dark);color:var(--dark);border-color:var(--on-dark)}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .35s ease,border-color .35s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--dark) 80%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);border-bottom-color:var(--line-on-dark)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.5rem;font-weight:800;font-stretch:75%;line-height:1;letter-spacing:-.01em;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.55rem .9rem;border-radius:999px;font-weight:500;text-decoration:none;color:var(--muted-on-dark);transition:color .2s ease,background-color .2s ease}
.nav a:hover{color:var(--on-dark);background:color-mix(in srgb,var(--on-dark) 8%,transparent)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.6rem 1.25rem}
.menu>summary{background:transparent;border-color:var(--line-on-dark)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(1.25rem,1rem + 1.5vw,2.5rem) clamp(3.5rem,2rem + 5vw,7rem)}
.hero-top{position:relative;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.75rem 2rem}
.hero-eye{display:flex;align-items:center;gap:.7rem;font-size:.82rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--on-dark)}
.flame{width:.6rem;height:.6rem;border-radius:50%;background:var(--primary-on-dark)}
@media (max-width:47.99rem){.hero-hours{display:none!important}}
.hero-hours{display:flex;align-items:center;gap:.5rem;font-size:.95rem;color:var(--muted-on-dark)}
.name-wrap{position:relative;padding-inline:clamp(1rem,3vw,3rem);margin-top:clamp(.5rem,1.5vw,1.5rem)}
.kin{font-size:clamp(3rem,min(var(--fs),var(--fh)),20rem);font-weight:800;font-stretch:75%;line-height:.8;letter-spacing:-.025em;text-wrap:balance}
.kin-in{display:block}
.kin.one .kin-in{display:inline-block;white-space:nowrap}
.kw{display:inline-block;white-space:nowrap}
@media (max-width:39.99rem){.kin.st{font-size:var(--fsm)}.kin.st .kin-in{display:block;white-space:normal}.kin.st .kw{display:block;width:max-content}}
.ch{display:inline-block;transition:font-weight .5s cubic-bezier(.2,.8,.2,1),color .5s ease}
@media (hover:hover){html.m .ch:hover{font-weight:250;color:var(--primary-on-dark)}html.m .ch:has(+.ch:hover),html.m .ch:hover+.ch{font-weight:520}}
.hero-grid{position:relative;display:grid;gap:2.5rem;margin-top:clamp(2rem,1rem + 3vw,4rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:4rem}}
.hero-line{font-family:var(--serif);font-size:clamp(1.8rem,1.3rem + 1.8vw,2.8rem);font-style:italic;line-height:1.1;letter-spacing:-.01em;margin-bottom:1rem}
.hero .lead{max-width:32rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-where{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .6rem;margin-top:1.75rem;color:var(--muted-on-dark)}
.hero-where .i{color:var(--primary-on-dark)}
.hero-where a{display:inline-flex;align-items:center;gap:.25rem;min-height:2.75rem;margin-left:.4rem;font-weight:600;color:var(--on-dark);text-decoration:underline;text-decoration-color:var(--line-on-dark)}
.hero-media{overflow:hidden;border-radius:var(--radius);aspect-ratio:16/11;background:var(--primary-soft)}
.hm-in{height:100%;overflow:hidden}
.hero-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.dishband{position:relative;display:grid;gap:.6rem;padding-block:clamp(1.5rem,1rem + 2vw,2.75rem);border-block:1px solid var(--line-on-dark);overflow:hidden}
.dl{display:flex;flex:none;align-items:center}
.dl li{display:flex;align-items:center;gap:1.6rem;padding-right:1.6rem;white-space:nowrap}
.band{overflow:hidden}
.band-track{display:flex;width:max-content}
.band-a li{font-family:var(--serif);font-size:clamp(2rem,1.4rem + 2.6vw,4rem);font-style:italic;line-height:1.1}
.band-a li:nth-child(even){color:var(--primary-on-dark)}
.band-b li{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.8vw,3rem);font-weight:800;font-stretch:75%;line-height:1.1;text-transform:uppercase;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--on-dark) 45%,transparent)}
.ast{display:inline-grid;color:var(--primary-on-dark)}
.band-b .ast{color:color-mix(in srgb,var(--on-dark) 35%,transparent)}
.menu-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1rem 2rem;margin-bottom:clamp(1.75rem,1.2rem + 2vw,3rem)}
.menu-head .h2{margin-top:.8rem}
.legend{font-size:.9rem;color:var(--muted-on-dark)}
html.m .mtabs[data-rv]{opacity:1;transform:none}
.tabbar{display:flex;gap:.5rem;margin:0 -1rem 2rem;padding:0 1rem .25rem;overflow-x:auto;scrollbar-width:none}
.tabbar::-webkit-scrollbar{display:none}
.tabbar label{flex:none;display:inline-flex;align-items:center;gap:.55rem;min-height:2.9rem;padding:.6rem 1.2rem;border-radius:999px;border:1.5px solid var(--line-on-dark);font-weight:600;cursor:pointer;transition:background-color .3s ease,color .3s ease,border-color .3s ease;user-select:none}
.tabbar label:hover{border-color:var(--on-dark)}
.cnt{display:inline-grid;place-items:center;min-width:1.5rem;height:1.5rem;padding:0 .35rem;border-radius:999px;background:color-mix(in srgb,currentColor 14%,transparent);font-size:.75rem}
.pnl{display:none}
.grp{margin:0 0 .5rem;font-size:clamp(1.6rem,1.3rem + 1vw,2.2rem);font-weight:800;font-stretch:75%;text-transform:uppercase}
.many .panels{columns:2 22rem;column-gap:4rem}
.grp-box{break-inside:avoid;padding-bottom:2.5rem}
.many .panel{grid-template-columns:1fr}
.one .panel{display:grid}
.panel{display:grid;gap:0 4rem}
@media (min-width:56rem){.panel{grid-template-columns:1fr 1fr}}
.dish{position:relative;padding:1.3rem 0;border-bottom:1px solid var(--line-on-dark)}
html.m .dish{animation:spIn .8s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i) * 55ms)}
html.m .mtabs:not(.in) .dish{animation-play-state:paused}
@keyframes spIn{from{opacity:0;transform:translateY(22px)}}
.dish-top{display:flex;align-items:baseline;justify-content:space-between;gap:1.25rem}
.dish h3,.dish h4{font-family:var(--font-body);font-size:1.15rem;font-weight:600;letter-spacing:0;line-height:1.3}
.dish-price{font-family:var(--serif);font-size:1.6rem;font-style:italic;line-height:1;white-space:nowrap;color:var(--primary-on-dark)}
.dish-desc{margin-top:.3rem;color:var(--muted-on-dark);max-width:32rem}
.tag{margin-left:.25rem;padding:.12rem .42rem;border-radius:.4rem;border:1px solid var(--line-on-dark);font-size:.68rem;font-weight:700;letter-spacing:.06em;text-decoration:none;color:var(--muted-on-dark);vertical-align:.18em}
.order{background:var(--button);color:var(--on-button)}
.order .eyebrow{color:var(--on-primary)}
.order-list{margin-top:clamp(1.5rem,1rem + 2vw,3rem);border-top:1px solid color-mix(in srgb,var(--on-primary) 30%,transparent)}
.order-list li{border-bottom:1px solid color-mix(in srgb,var(--on-primary) 30%,transparent)}
.order-list a{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:clamp(1rem,.8rem + 1vw,1.6rem) 0;font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.4vw,3.4rem);font-weight:800;font-stretch:75%;line-height:1;text-transform:uppercase;text-decoration:none}
.order-list a .i{flex:none;transition:transform .4s cubic-bezier(.2,.8,.2,1)}
.order-list a:hover .i{transform:translate(4px,-4px) rotate(8deg)}
.plates{padding-block:clamp(2rem,1rem + 3vw,4rem);overflow:hidden}
.plate-row{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(.75rem,2vw,2.5rem);align-items:center}
.plate{margin:0}
.plate-in{overflow:hidden;border-radius:50%;aspect-ratio:1;background:var(--primary-soft);cursor:pointer}
.plate-in>.spin{height:100%}
.plates{padding-block:clamp(3rem,2rem + 5vw,7rem)}
.plate img{width:100%;height:100%;object-fit:cover}
.p2{margin-top:clamp(3rem,8vw,8rem)}
.p1,.p3{margin-bottom:clamp(2rem,6vw,6rem)}
.about-grid{display:grid;gap:2rem 5rem}
@media (min-width:60rem){.about-grid{grid-template-columns:1fr 1fr;align-items:start}}
.about .h2{margin-top:.8rem;text-transform:none;font-family:var(--serif);font-weight:400;font-stretch:100%;font-style:italic;letter-spacing:-.02em;line-height:1}
.about-copy{display:grid;gap:1.2rem;font-size:1.2rem;line-height:1.7;color:var(--muted-on-dark)}
.sig{font-family:var(--serif);font-size:2.2rem;font-style:italic;line-height:1;color:var(--on-dark)}
.quotes{display:grid;gap:1rem;margin-top:clamp(2rem,1.5rem + 2vw,3rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}}
.quote{--spot:color-mix(in srgb,var(--primary) 26%,transparent);display:grid;gap:1.25rem;align-content:space-between;padding:clamp(1.5rem,1rem + 1.5vw,2.4rem);border-radius:var(--radius);border:1px solid var(--line-on-dark);background:var(--surface)}
.quote blockquote{margin:0;font-family:var(--serif);font-size:clamp(1.5rem,1.2rem + 1vw,2rem);font-style:italic;line-height:1.25}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-size:.85rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-on-dark)}
.visit{background:color-mix(in srgb,var(--primary) 12%,var(--dark))}
.visit-grid{display:grid;gap:3rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:1.05fr .95fr;gap:5rem;align-items:center}}
.visit-title{margin-top:.8rem;font-size:clamp(3.4rem,2rem + 6vw,8rem);font-weight:800;font-stretch:75%;line-height:.85;letter-spacing:-.02em;text-transform:uppercase}
.visit .lead{margin-top:1.25rem}
.visit .btn-ghost{color:var(--on-dark)}
.visit-card{display:grid;gap:0;padding:clamp(1.4rem,1rem + 1.5vw,2.4rem);border-radius:calc(var(--radius) + 6px);background:var(--dark);border:1px solid var(--line-on-dark);box-shadow:0 50px 100px -50px rgba(0,0,0,.9)}
.vc{padding-block:1.4rem;border-bottom:1px solid var(--line-on-dark)}
.vc:first-child{padding-top:0}
.vc:last-child{padding-bottom:0;border-bottom:0}
.vc h3{display:flex;align-items:center;gap:.5rem;margin-bottom:.8rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-stretch:100%;color:var(--primary-on-dark)}
.vc-big{font-family:var(--font-display);font-size:clamp(1.4rem,1.2rem + .8vw,1.9rem);font-weight:700;font-stretch:80%;line-height:1.15}
.vc p+p{margin-top:.5rem}
.vc a{color:var(--on-dark)}
.vc .vc-big a{text-decoration:none}
.arrow-link{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:600;text-decoration:none}
.arrow-link:hover{text-decoration:underline}
.sp-hours div{position:relative;align-items:center}
.sp-hours .today dt,.sp-hours .today dd{color:var(--on-dark)}
.sp-hours .today dt::after{content:'Today';margin-left:.6rem;padding:.15rem .5rem;border-radius:999px;background:var(--button);color:var(--on-button);font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;vertical-align:.1em}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}}
.faq-grid .h2{margin-top:.8rem}
.faq details{background:var(--surface)}
.contact{background:var(--surface)}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:.9fr 1.1fr;gap:5rem}}
.contact .h2{margin-top:.8rem}
.contact .lead{margin-top:1rem}
.form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.4rem);border-radius:var(--radius);background:var(--dark);border:1px solid var(--line-on-dark)}
.ftr-name{font-weight:800;font-stretch:75%;text-transform:uppercase}
.mbar{background:color-mix(in srgb,var(--dark) 88%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-top-color:var(--line-on-dark)}
${TAB_CSS}
`;

module.exports = {
  id,
  kind: 'restaurant',
  name: 'Supper',
  bestFor: 'Restaurants, cafes, bars, bakeries and food trucks, with motion',
  why: 'Warm and appetizing on a dark page, with motion: your name pours in and fills the screen, your dishes slide across it as you scroll, round dish photos turn past at their own depth, and the menu, order buttons, hours and directions are one tap away.',
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1', display: ['Bricolage Grotesque', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): poured in, plates you can nudge, a row of dishes that turns as you pass.
  choreo: { intro: 'pour', alive: ['drift', 'tap'], scroll: 'scene', pace: 'medium', look: 'warm, generous, a little bounce' },
  tokens,
  slots,
  nav,
  render,
};
