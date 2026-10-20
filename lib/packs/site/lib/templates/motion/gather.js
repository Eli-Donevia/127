// Gather (animated, product, for an event): a workshop, pop-up, class or launch party, where the buy link is tickets.
// Bold poster style: the date (only when the member gave one) or the event's name set huge in condensed type that
// drops in letter by letter over an outlined echo moving at its own speed, two crossing bands of the event's facts,
// what's included as a numbered agenda whose rules draw across, ticket stubs with a light that follows the pointer,
// when and where in poster blocks, and a ticket button that stays in reach once the hero has scrolled away.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, HEAD_CSS, esc } = require('../shared');

const id = 'gather';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f2eee4', 0.75) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1200, h: 1500, style: 'tile', alt: c.profile.hero || g[0] || `${c.productName || c.name}` },
    { slot: 'host', file: 'host.jpg', w: 1000, h: 1200, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, the host` : g[3] || `${c.name}, the host` },
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

// The giant line, one span per letter (screen readers get the plain words elsewhere), with a size from its length.
function giant(textIn) {
  const t = String(textIn).trim();
  const words = t.split(/\s+/);
  const n = t.length;
  const longest = Math.max(...words.map((w) => w.length));
  const lines = n <= 12 ? 1 : n <= 26 ? 2 : 3;
  const per = lines === 1 ? n : Math.ceil(n / lines) + 2;
  const fs = Math.min(36, 230 / Math.max(per, 3), 200 / Math.max(longest, 3)).toFixed(2);
  let i = 0;
  const html = words.map((w) => `<span class="gw">${[...w].map((ch) => `<span class="gch" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
  return { html, plain: words.map((w) => `<span class="gw">${esc(w)}</span>`).join(' '), fs, fh: [58, 30, 20][lines - 1], lines, one: lines === 1 };
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
  const tix = (cls) => P.button(c.primary, cls, c.buy ? 'arrowUpRight' : 'arrow').replace('<a ', '<a data-mag ');

  const metaRows = [
    c.whatShort && ['What', c.whatShort],
    where && ['Where', c.city && c.address ? c.city : where],
    c.deadline && ['When', c.deadline],
  ].filter(Boolean);

  const hero = `<section class="hero" aria-labelledby="hero-title">
${metaRows.length ? `<div class="wrap"><dl class="meta" data-rv>${metaRows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>` : ''}
<div class="giant-wrap">
<div class="giant${big.one ? ' one' : ''}${date ? ' dt' : ''}" data-lines="${big.lines}" style="--fs:${big.fs}vw;--fh:${big.fh}vh" aria-hidden="true">
<span class="g-ghost" data-par="-0.06"><span class="g-in">${big.plain}</span></span>
<span class="g-real" data-par="0.04"><span class="g-in">${big.html}</span></span>
</div>
</div>
<div class="wrap hero-grid">
<div class="hero-copy">
${date ? `<h1 id="hero-title" data-split>${esc(c.heroTitle)}</h1>` : `<h1 id="hero-title" class="sr-only">${esc(c.heroTitle)}</h1>${sameWords(c.heroTitle, event) ? '' : `<p class="hero-name" data-split>${esc(c.heroTitle)}</p>`}`}
<p class="lead" data-rv style="--d:4">${esc(c.heroSub)}</p>
<div class="ctas" data-rv style="--d:5">${tix('btn btn-lg btn-ink')}${fromText ? `<span class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></span>` : ''}</div>
</div>
<div class="hero-media">
<div class="poster" data-rv="mask" style="--d:3"><div class="poster-in">${P.img(c, 'hero', { cls: 'poster-img', eager: true }).replace('<img ', '<img data-par="0.05" ')}</div></div>
<span class="sticker" data-rv="scale" style="--d:9" aria-hidden="true"><span>${esc(c.capacity || (c.buy ? 'Tickets' : 'Join the list'))}</span></span>
</div>
</div>
</section>`;

  const bandWords = [event, date ? c.deadline : '', where ? (c.city || where) : '', c.capacity, fromText, c.buy ? 'Get tickets' : 'Join the list'].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  const star = '<span class="bstar" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 1l2.6 7.4L22 6l-4.4 6L22 18l-7.4-2.4L12 23l-2.6-7.4L2 18l4.4-6L2 6l7.4 2.4z" fill="currentColor"/></svg></span>';
  const bandRow = (hidden) => `<ul class="brow"${hidden ? ' aria-hidden="true"' : ''}>${bandWords.map((w) => `<li>${esc(w)}${star}</li>`).join('')}</ul>`;
  const bands = `<div class="bands" aria-label="${esc(event)}">
<div class="band band-a mq"><div class="mq-track">${bandRow(false)}${bandRow(true)}</div></div>
<div class="band band-b mq mq-rev" aria-hidden="true"><div class="mq-track">${bandRow(true)}${bandRow(true)}</div></div>
</div>`;

  const features = c.included.length
    ? `<section class="sec features" id="features" aria-labelledby="features-title"><div class="wrap">
<div class="sec-top"><p class="eyebrow" data-rv>The plan</p><h2 class="h2" id="features-title" data-split>What's included</h2></div>
<ol class="agenda">${c.included.map((x, i) => `<li data-rv style="--d:${i}"><span class="ag-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ag-t">${esc(x)}</span></li>`).join('')}</ol>
</div></section>`
    : '';

  const ticketItems = c.services.length ? c.services : c.priceText ? [{ name: event, priceText: c.priceText, blurb: '' }] : [];
  const tickets = ticketItems.length
    ? `<section class="sec tickets" id="tickets" aria-labelledby="tickets-title"><div class="wrap">
<div class="sec-top"><p class="eyebrow" data-rv>Tickets</p><h2 class="h2" id="tickets-title" data-split>${c.buy ? 'Pick your ticket' : 'Prices'}</h2></div>
<ul class="stubs${ticketItems.length === 1 ? ' solo' : ''}">${ticketItems
        .map(
          (s, i) => `<li class="stub" data-spot data-rv="scale" style="--d:${i + 1}">
<div class="stub-main"><p class="stub-k">${esc(event)}</p><h3>${esc(s.name)}</h3>${s.blurb || s.duration ? `<p class="stub-d">${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}${c.deadline ? `<p class="stub-when">${icon('calendar', { size: 16 })}${esc(c.deadline)}</p>` : ''}</div>
<div class="stub-side">${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}${c.buy ? `<a class="stub-go" href="${esc(c.buy.href)}">${esc(c.primary.label)}${icon('arrowUpRight', { size: 16 })}</a>` : ''}</div>
</li>`
        )
        .join('')}</ul>
${c.capacity || c.shipping ? `<p class="tix-note" data-rv>${c.capacity ? `${icon('user', { size: 18 })}<span>${esc(c.capacity)}</span>` : ''}${c.shipping ? `${icon('truck', { size: 18 })}<span>${esc(c.shipping)}</span>` : ''}</p>` : ''}
</div></section>`
    : '';

  const blocks = [
    c.deadline && { k: 'When', v: c.deadline },
    where && { k: 'Where', v: where, link: c.mapsUrl },
    c.capacity && { k: 'How many', v: c.capacity },
  ].filter(Boolean);
  const details = blocks.length
    ? `<section class="details" id="details" aria-label="When and where"><div class="wrap det-grid${blocks.length === 1 ? ' solo' : ''}">
${blocks.map((b, i) => `<div class="det" data-rv style="--d:${i * 2}"><p class="det-k">${esc(b.k)}</p><p class="det-v">${esc(b.v)}</p>${b.link ? `<a class="det-a" href="${esc(b.link)}">Get directions${icon('arrowUpRight', { size: 16 })}</a>` : ''}</div>`).join('\n')}
</div></section>`
    : '';

  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const about = c.aboutParas.length
    ? `<section class="sec about" id="about" aria-labelledby="about-title"><div class="wrap about-grid">
<div class="host" data-rv="mask"><div class="host-in">${P.img(c, 'host', { cls: 'host-img' }).replace('<img ', '<img data-par="0.05" ')}</div></div>
<div class="about-copy">
<p class="eyebrow" data-rv>Your host</p>
<h2 class="h2" id="about-title" data-split>${esc(person ? `Hosted by ${person}` : `About ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c) ? `<div data-rv style="--d:4">${P.socials(c)}</div>` : ''}
</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<div class="sec-top"><p class="eyebrow" data-rv>Kind words</p><h2 class="h2" id="reviews-title" data-split>What people say</h2></div>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div class="sec-top"><p class="eyebrow" data-rv>FAQ</p><h2 class="h2" id="faq-title" data-split>Questions</h2></div><div data-rv style="--d:2">${P.faq(c.faq)}</div></div></section>`
    : '';

  const signup = `<section class="sec signup" id="signup" aria-labelledby="signup-title"><div class="wrap signup-grid">
<div class="signup-copy">
<h2 class="signup-title" id="signup-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
${c.buy ? `<div class="ctas" data-rv style="--d:4">${tix('btn btn-lg btn-ink')}${fromText ? `<span class="from"><small>Tickets</small><strong>${esc(fromText)}</strong></span>` : ''}</div>` : ''}
${P.contactList(c, { cls: 'signup-contact' }) ? `<div data-rv style="--d:5">${P.contactList(c, { cls: 'signup-contact' })}</div>` : ''}
</div>
${c.buy ? '' : `<div class="form-card" data-rv="scale" style="--d:2"><h3 class="form-title">Join the list</h3><p class="form-lead">Leave your email and we will write when tickets are out.</p>${P.form(c, { id: 'signup', fields: ['name', 'email'], submit: 'Join the list', subject: `${event}: join the list` })}</div>`}
</div></section>`;

  const float = `<div class="tix-float" aria-label="Tickets"><span class="tf-name">${esc(event)}${fromText ? `<small>${esc(fromText)}</small>` : ''}</span>${P.button(c.primary, 'btn btn-primary tf-btn').replace('<a ', '<a data-mag ')}</div>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-ga', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, bands, features, tickets, details, about, reviews, faq, signup, '</main>', float, P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '18px', btnRadius: '999px', max: '78rem' } };
}

// Fits the giant line to the width (one word per line on phones), and shows the floating ticket button once the
// hero has scrolled away.
const JS = `(function(){var d=document,g=d.querySelector('.giant'),k=g&&g.querySelector('.g-real .g-in');
function fit(){if(!k)return;g.style.fontSize='';var w=g.clientWidth,ws=[].slice.call(k.querySelectorAll('.gw')),st=innerWidth<640&&ws.length>1&&ws.length<4&&!g.classList.contains('dt'),cap=Math.max(innerHeight,500)*.58;g.classList.toggle('st',st);var big=function(){return Math.max.apply(0,ws.map(function(e){return e.offsetWidth}))};var fs=parseFloat(getComputedStyle(g).fontSize);
if(st||g.classList.contains('one')){var m=st?big():k.offsetWidth;if(!m)return;var r=Math.max(.5,Math.min(st?2.4:1.5,w/m));fs=fs*r*.985;if(!st)fs=Math.min(fs,cap)}
else{var L=(+g.getAttribute('data-lines')||2)+(innerWidth<640?1:0);fs=Math.min(cap/L/.8,fs*2.5);g.style.fontSize=fs+'px';for(var i=0;i<40&&fs>40&&(k.offsetHeight>fs*.8*L*1.1||big()>w);i++){fs*=.96;g.style.fontSize=fs+'px'}}
g.style.fontSize=fs.toFixed(1)+'px'}
fit();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(fit);addEventListener('resize',fit);
var f=d.querySelector('.tix-float'),h=d.querySelector('.hero'),s=d.querySelector('.signup');if(f&&h&&'IntersectionObserver' in window){d.documentElement.classList.add('tf');var past=false,end=false;var set=function(){f.classList.toggle('show',past&&!end)};new IntersectionObserver(function(e){past=!e[0].isIntersecting&&e[0].boundingClientRect.top<0;set()}).observe(h);if(s)new IntersectionObserver(function(e){end=e[0].isIntersecting;set()}).observe(s)}})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}
h1,h2,h3{font-weight:800;letter-spacing:-.01em;text-transform:uppercase}
.h2{font-size:clamp(3rem,1.8rem + 5vw,6.4rem);line-height:.86}
.eyebrow{font-weight:700;letter-spacing:.18em;color:var(--ink)}
.eyebrow::before{content:'';display:inline-block;width:.6rem;height:.6rem;margin-right:.6rem;border-radius:50%;background:var(--primary);vertical-align:.05em}
.sec-top{display:grid;gap:.9rem;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.btn{font-weight:700;letter-spacing:.02em}
.btn-ink{background:var(--ink);color:var(--bg);box-shadow:0 18px 40px -18px rgba(0,0,0,.6)}
.btn-ink:hover{background:var(--ink);color:var(--bg);box-shadow:0 22px 50px -18px rgba(0,0,0,.75)}
.hdr{position:sticky;top:0;z-index:30;background:var(--primary);color:var(--on-primary);border-bottom:1.5px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:color-mix(in srgb,var(--on-primary) 35%,transparent)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;font-weight:900;line-height:1;text-transform:uppercase;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.5rem .8rem;border-radius:999px;font-size:.92rem;font-weight:600;text-decoration:none;transition:background-color .2s ease}
.nav a:hover{background:color-mix(in srgb,var(--on-primary) 14%,transparent)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.2rem;background:var(--ink);color:var(--bg);box-shadow:none}
.hdr-cta:hover{background:var(--ink)}
.menu>summary{background:transparent;color:inherit;border-color:color-mix(in srgb,var(--on-primary) 40%,transparent)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(1.25rem,1rem + 1.5vw,2.25rem) clamp(3.5rem,2rem + 5vw,7rem);background:var(--primary);color:var(--on-primary)}
.meta{display:grid;gap:0;border-block:1.5px solid color-mix(in srgb,var(--on-primary) 40%,transparent)}
@media (min-width:48rem){.meta{grid-template-columns:repeat(3,auto);justify-content:space-between;gap:2rem}}
.meta div{display:flex;gap:.75rem;align-items:baseline;padding-block:.75rem;font-size:.85rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
@media (max-width:47.99rem){.meta div+div{border-top:1px solid color-mix(in srgb,var(--on-primary) 25%,transparent)}}
.meta dt{opacity:.7}
.giant-wrap{padding-inline:clamp(1rem,3vw,3rem);margin-top:clamp(1rem,2vw,2rem)}
.giant{position:relative;font-family:var(--font-display);font-size:clamp(4rem,min(var(--fs),var(--fh)),40rem);font-weight:900;line-height:.8;letter-spacing:-.01em;text-transform:uppercase;text-wrap:balance}
.g-real,.g-ghost{display:block}
.g-ghost{position:absolute;left:0;top:0;width:100%;color:transparent;-webkit-text-stroke:2px color-mix(in srgb,var(--on-primary) 45%,transparent);translate:.06em .08em;pointer-events:none}
.giant.one .g-in{display:inline-block;white-space:nowrap}
.gw{display:inline-block;white-space:nowrap}
.giant.st .g-in{display:block;white-space:normal}
.giant.st .gw{display:block;width:max-content}
.gch{display:inline-block;transition:translate .45s cubic-bezier(.2,1.6,.4,1),color .3s ease}
html.m .gch{animation:gaDrop 1.1s cubic-bezier(.2,1.25,.35,1) both;animation-delay:calc(var(--i) * 70ms + .15s)}
@keyframes gaDrop{from{transform:translateY(-55%) rotate(-10deg) scale(1.08);opacity:0}}
html.m .g-ghost{animation:gaFade 1.2s ease both;animation-delay:calc(var(--i,6) * 70ms + .9s)}
@keyframes gaFade{from{opacity:0}}
@media (hover:hover){.gch:hover{translate:0 -.07em;color:var(--ink)}}
.hero-grid{position:relative;display:grid;gap:3rem;margin-top:clamp(2rem,1rem + 3vw,4rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:4rem}}
.hero h1,.hero-name{font-family:var(--font-display);font-size:clamp(2.6rem,1.6rem + 4vw,5.4rem);font-weight:900;line-height:.88;text-transform:uppercase}
.hero .lead{margin-top:1.25rem;max-width:34rem;color:var(--on-primary)}
.ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:2rem}
.from{display:grid;line-height:1.1}
.from small{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.from strong{font-family:var(--font-display);font-size:2.2rem;font-weight:900;text-transform:uppercase}
.hero-media{position:relative;justify-self:center;width:min(86%,24rem)}
.poster{overflow:hidden;aspect-ratio:4/5;border-radius:6px;rotate:2.5deg;box-shadow:0 40px 70px -30px rgba(0,0,0,.55);background:var(--ink)}
.poster-in{height:100%;overflow:hidden}
.poster-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.sticker{position:absolute;left:-1.5rem;top:-1.5rem;display:grid;place-items:center;width:7.5rem;aspect-ratio:1;padding:.9rem;border-radius:50%;background:var(--ink);color:var(--bg);font-family:var(--font-display);font-size:1.3rem;font-weight:900;line-height:.95;text-align:center;text-transform:uppercase;rotate:-12deg}
html.m .sticker>span{animation:gaWobble 6s ease-in-out infinite}
@keyframes gaWobble{50%{transform:rotate(10deg) scale(1.05)}}
@media (max-width:39.99rem){.sticker{left:-.25rem;width:6.25rem;font-size:1.1rem}}
.bands{position:relative;height:clamp(9rem,7rem + 6vw,13rem);overflow:hidden;background:var(--bg)}
.band{position:absolute;left:-5%;right:-5%;padding-block:.85rem}
.band-a{top:18%;rotate:-3deg;background:var(--ink);color:var(--bg);--mq-speed:34s;z-index:1;-webkit-mask-image:none;mask-image:none}
.band-b{top:42%;rotate:2.5deg;background:var(--primary);color:var(--on-primary);--mq-speed:40s;-webkit-mask-image:none;mask-image:none}
.brow{display:flex;flex:none;align-items:center}
.brow li{display:flex;align-items:center;gap:1.4rem;padding-right:1.4rem;font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.6vw,2.6rem);font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap}
.bstar{display:inline-grid}
html.m .bstar svg{animation:gaSpin 6s linear infinite}
@keyframes gaSpin{to{transform:rotate(1turn)}}
.agenda{border-top:2px solid var(--ink)}
.agenda li{position:relative;display:grid;grid-template-columns:auto 1fr;gap:1.25rem clamp(1.25rem,1rem + 2vw,3rem);align-items:baseline;padding-block:clamp(1.1rem,.9rem + 1vw,1.8rem)}
.agenda li::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--ink);transform-origin:0 50%}
html.m .agenda li[data-rv]::after{transform:scaleX(0);transition:transform 1.2s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms + .2s)}
html.m .agenda li.in::after{transform:scaleX(1)}
html.m .agenda li[data-rv]{transform:translateX(-24px)}
html.m .agenda li.in{transform:none}
.agenda li::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--primary);clip-path:inset(100% 0 0 0);transition:clip-path .5s cubic-bezier(.7,0,.2,1)}
.agenda li{isolation:isolate}
.agenda li:hover::before{clip-path:inset(0)}
.agenda li:hover{color:var(--on-primary)}
.ag-n{font-family:var(--font-display);font-size:clamp(2.4rem,1.8rem + 2.4vw,4.4rem);font-weight:900;line-height:.8;color:transparent;-webkit-text-stroke:1.5px var(--ink);padding-left:.15rem;transition:-webkit-text-stroke-color .3s ease}
.agenda li:hover .ag-n{-webkit-text-stroke-color:var(--on-primary)}
.ag-t{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.7vw,3rem);font-weight:800;line-height:.98;text-transform:uppercase;text-wrap:balance}
.tickets{background:var(--surface)}
.stubs{display:grid;gap:1.25rem}
@media (min-width:56rem){.stubs{grid-template-columns:repeat(2,1fr)}.stubs.solo{grid-template-columns:minmax(0,40rem)}}
.stub{--spot:color-mix(in srgb,var(--primary) 28%,transparent);display:grid;grid-template-columns:1fr auto;border-radius:16px;background:var(--bg);border:2px solid var(--ink);overflow:hidden;transition:transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s ease}
html.m .stub[data-rv].in:hover,.stub:hover{transform:translateY(-4px) rotate(-.6deg);box-shadow:8px 10px 0 var(--ink)}
.stub-main{display:grid;gap:.5rem;align-content:start;padding:1.5rem 1.4rem}
.stub-k{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.stub h3{font-family:var(--font-display);font-size:clamp(1.8rem,1.5rem + 1vw,2.4rem);font-weight:900;line-height:.95}
.stub-d{color:var(--muted)}
.stub-when{display:flex;align-items:center;gap:.45rem;margin-top:.4rem;font-size:.9rem;font-weight:600}
.stub-side{position:relative;display:grid;align-content:space-between;justify-items:end;gap:1rem;min-width:9rem;padding:1.5rem 1.4rem;border-left:2px dashed var(--ink);background:var(--primary);color:var(--on-primary)}
.stub-side::before,.stub-side::after{content:'';position:absolute;left:-.8rem;width:1.4rem;height:1.4rem;border-radius:50%;background:var(--surface);border:2px solid var(--ink)}
.stub-side::before{top:-.85rem}
.stub-side::after{bottom:-.85rem}
.stub-side strong{font-family:var(--font-display);font-size:clamp(2.4rem,2rem + 1.4vw,3.4rem);font-weight:900;line-height:.9;text-align:right}
.stub-go{display:inline-flex;align-items:center;gap:.3rem;min-height:2.75rem;font-weight:700;text-decoration:none;border-bottom:2px solid currentColor}
@media (max-width:30rem){.stub{grid-template-columns:1fr}.stub-side{grid-auto-flow:column;align-items:center;justify-content:space-between;min-width:0;border-left:0;border-top:2px dashed var(--ink)}.stub-side::before,.stub-side::after{display:none}}
.tix-note{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.5rem;margin-top:1.5rem;font-weight:600}
.tix-note .i{color:var(--primary-text)}
.details{background:var(--ink);color:var(--bg)}
.det-grid{display:grid}
@media (min-width:56rem){.det-grid{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}}
.det{display:grid;gap:.6rem;align-content:start;padding:clamp(2rem,1.5rem + 2vw,3.5rem) 0;border-bottom:1.5px solid color-mix(in srgb,var(--bg) 22%,transparent)}
@media (min-width:56rem){.det{padding-inline:2rem;border-bottom:0;border-left:1.5px solid color-mix(in srgb,var(--bg) 22%,transparent)}.det:first-child{padding-left:0;border-left:0}}
.det-k{font-size:.8rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--primary-on-dark)}
.det-v{font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.4rem);font-weight:900;line-height:.92;text-transform:uppercase}
.det-a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;font-weight:700;text-decoration:none;color:var(--bg)}
.det-a:hover{text-decoration:underline}
.about-grid{display:grid;gap:clamp(2.5rem,1.5rem + 3vw,5rem);align-items:center}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr}}
.host{justify-self:center;width:min(100%,24rem);overflow:hidden;aspect-ratio:5/6;border-radius:6px;rotate:-2deg;box-shadow:12px 14px 0 var(--primary)}
.host-in{height:100%;overflow:hidden}
.host-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.about-copy{display:grid;gap:1.2rem;justify-items:start}
.about-copy p:not(.eyebrow){font-size:1.18rem;line-height:1.65;max-width:38rem}
.quotes{display:grid;gap:1.25rem}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}}
.quote{display:grid;gap:1rem;padding:1.75rem;border:2px solid var(--ink);border-radius:16px;background:var(--bg)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + 1vw,2.2rem);font-weight:800;line-height:1;text-transform:uppercase}
.quote figcaption{font-weight:700;color:var(--muted)}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.faq details{border:2px solid var(--ink);border-radius:14px}
.faq details[open]{border-color:var(--ink);background:var(--surface)}
.faq summary{font-weight:700}
.signup{background:var(--primary);color:var(--on-primary)}
.signup-grid{display:grid;gap:2.5rem;align-items:center}
@media (min-width:60rem){.signup-grid{grid-template-columns:1.1fr .9fr;gap:4rem}}
.signup-title{font-family:var(--font-display);font-size:clamp(3.6rem,2rem + 7vw,9rem);font-weight:900;line-height:.82}
.signup .lead{margin-top:1.25rem;color:var(--on-primary)}
.signup-contact{margin-top:2rem}
.signup-contact .i{color:inherit}
.signup .form-card{padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border-radius:18px;background:var(--bg);color:var(--ink);border:2px solid var(--ink);box-shadow:10px 12px 0 var(--ink)}
.form-title{font-family:var(--font-display);font-size:2.2rem;font-weight:900;line-height:1}
.form-lead{margin:.5rem 0 1.25rem;color:var(--muted)}
.tix-float{position:fixed;right:1.5rem;bottom:1.5rem;z-index:45;display:flex;align-items:center;gap:1rem;padding:.5rem .5rem .5rem 1.4rem;border-radius:999px;background:var(--ink);color:var(--bg);box-shadow:0 24px 50px -20px rgba(0,0,0,.6);transition:transform .6s cubic-bezier(.16,1,.3,1),opacity .4s ease}
.tf-name{display:grid;font-family:var(--font-display);font-size:1.25rem;font-weight:900;line-height:1;text-transform:uppercase}
.tf-name small{margin-top:.2rem;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.06em;opacity:.75}
.tf-btn{min-height:3rem}
html.tf .tix-float:not(.show){transform:translateY(160%);opacity:0;pointer-events:none}
@media (max-width:59.99rem){.tix-float{display:none}}
.ftr{background:var(--bg)}
.ftr-name{font-weight:900;text-transform:uppercase}
.mbar{border-top:2px solid var(--ink)}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Gather',
  bestFor: 'Workshops, pop-ups, classes and launch parties that sell tickets, with motion',
  match: /\b(events?|workshops?|classes|class|pop-?ups?|tickets?|festivals?|conferences?|meetups?|retreats?|parties|party|shows?|concerts?|tastings?)\b/,
  why: 'Bold poster style for an event, with motion: the date or name set huge, what is included as an agenda, ticket stubs and a ticket button that stays in reach.',
  fonts: { q: 'family=Big+Shoulders+Display:wght@500..900&family=Familjen+Grotesk:wght@400..700', display: ['Big Shoulders Display', 'grotesk'], body: ['Familjen Grotesk', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
