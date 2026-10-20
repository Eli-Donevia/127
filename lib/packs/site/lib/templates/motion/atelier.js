// Atelier (animated, studio): for salons, barbers, nails, lashes, spas and tattoo. Editorial luxury on an ivory page:
// an oversized serif headline whose words unfold up from their baseline like a turned page while the arched photo
// opens from its center, the arch leaning softly toward the pointer at rest, a price menu whose rows arrive as their
// dotted leaders draw across, the menu at a glance as a roadmap that draws itself in with the scroll, a gallery that slides sideways as you scroll (and back when you scroll up), and the
// visit details on a dark espresso band. No seal or other props. Its motion is the `choreo` block (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { heroFacts, FOOTER_CSS, HEAD_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS, groupNodes, servicesByCategory } = require('../roadmap');

const id = 'atelier';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f4ece1', 0.8), dark: color.mix(color.mix(p.ink, p.primary, 0.3), '#000000', 0.45) };
}

function slots(c) {
  const g = c.profile.gallery || [];
  const alt = (i, d) => g[i] || d;
  return [
    { slot: 'hero', file: 'hero.jpg', w: 1100, h: 1400, style: 'arch', alt: c.profile.hero || `Inside ${c.name}` },
    { slot: 'g1', file: 'photo-1.jpg', w: 900, h: 1200, style: 'portrait', alt: alt(0, `${c.name}, finished work`) },
    { slot: 'g2', file: 'photo-2.jpg', w: 900, h: 900, style: 'mesh', alt: alt(1, `${c.name}, up close`) },
    { slot: 'g3', file: 'photo-3.jpg', w: 900, h: 900, style: 'arch', alt: alt(2, `Inside ${c.name}`) },
    { slot: 'g4', file: 'photo-4.jpg', w: 900, h: 1200, style: 'sweep', alt: alt(3, `${c.name}, details`) },
    { slot: 'about', file: 'about.jpg', w: 1000, h: 1250, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner} at ${c.name}` : `The team at ${c.name}` },
  ];
}

function nav(c) {
  return [
    c.services.length && { label: 'Menu', href: '#menu' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'About', href: '#about' },
    { label: 'Visit', href: '#visit' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

// "Nails you keep looking at." -> "Nails you keep <em>looking at.</em>"
function emphasize(title) {
  const words = String(title).split(/\s+/);
  if (words.length < 3) return esc(title);
  const n = words.length > 5 ? 2 : 1;
  return `${esc(words.slice(0, -n).join(' '))} <em>${esc(words.slice(-n).join(' '))}</em>`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function menuHtml(c) {
  const groups = [];
  for (const s of c.services) {
    const title = s.category || '';
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    g.items.push(s);
  }
  return `<div class="mn${groups.length > 1 ? ' cols' : ''}">
${groups
  .map(
    (g, gi) => `<div class="mn-group">
${g.title ? `<h3 class="mn-cat" data-rv><span class="mn-num" aria-hidden="true">${ROMAN[gi] || gi + 1}.</span>${esc(g.title)}</h3>` : ''}
<ul>
${g.items
  .map(
    (s, i) => `<li data-rv style="--d:${Math.min(i + 1, 8)}"><div class="mn-top"><h4>${esc(s.name)}</h4>${s.priceText ? `<span class="dots" aria-hidden="true"></span><span class="mn-price">${esc(s.priceText)}</span>` : ''}</div>
${s.duration || s.blurb ? `<p class="mn-meta">${[s.duration, s.blurb].filter(Boolean).map(esc).join('<span class="sep" aria-hidden="true"></span>')}</p>` : ''}</li>`
  )
  .join('\n')}
</ul>
</div>`
  )
  .join('\n')}
</div>`;
}

function render(c) {
  const eyebrow = [c.whatShort, c.city].filter(Boolean).join(' in ');
  const facts = heroFacts(c, 3);
  const bookIcon = c.primary.kind === 'phone' ? 'phone' : c.primary.kind === 'form' ? '' : 'calendar';
  const book = (cls) => P.button(c.primary, cls, bookIcon).replace('<a ', '<a data-mag ');
  const long = c.heroTitle.length > 30;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
<div class="hero-copy">
${eyebrow ? `<p class="kicker" data-ci="then"><span class="rule" aria-hidden="true"></span>${esc(eyebrow)}</p>` : ''}
<h1 id="hero-title" data-ci="head"${long ? ' class="long"' : ''}>${emphasize(c.heroTitle)}</h1>
<p class="lead" data-ci="then">${esc(c.heroSub)}</p>
<div class="ctas" data-ci="then">
${book('btn btn-primary btn-lg')}
${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}
</div>
</div>
<div class="hero-media" data-ci="subject">
<div class="arch" data-alive="0.6"><div class="arch-in">${P.img(c, 'hero', { cls: 'arch-img', eager: true }).replace('<img ', '<img data-par="0.07" ')}</div></div>
</div>
</div>
${facts.length ? `<div class="wrap"><ul class="facts" data-ci="then">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
</section>`;

  const priced = c.services.some((s) => s.priceText);
  const menu = c.services.length
    ? `<section class="sec menu-sec" id="menu" aria-labelledby="menu-title">
<div class="wrap">
<div class="menu-head">
<p class="eyebrow" data-rv>Menu</p>
<h2 class="h2" id="menu-title" data-split>${priced ? 'Services <em>and prices</em>' : 'The <em>services</em>'}</h2>
${c.services.some((s) => s.duration) ? '<p class="lead" data-rv style="--d:3">Times are a guide, so you can plan your day.</p>' : ''}
</div>
${menuHtml(c)}
<div class="center-cta" data-rv>${book('btn btn-primary btn-lg')}</div>
</div>
</section>`
    : '';

  const shapes = ['f1', 'f2', 'f3', 'f4'];
  const figs = () =>
    shapes
      .map((k, i) => {
        const im = P.img(c, `g${i + 1}`);
        return `<li><figure class="${k}"><div class="ph">${im}</div><figcaption aria-hidden="true">No. ${String(i + 1).padStart(2, '0')}</figcaption></figure></li>`;
      })
      .join('');
  const gallery = `<section class="gallery-sec" id="gallery" aria-labelledby="gallery-title" data-sc>
<div class="wrap gal-head">
<div><p class="eyebrow" data-rv>Gallery</p><h2 class="h2" id="gallery-title" data-split>A look <em>inside</em></h2></div>
${c.socials.instagram ? `<a class="gal-more" data-rv href="${esc(c.socials.instagram)}">${icon('instagram', { size: 18 })}More on Instagram${icon('arrowUpRight', { size: 16 })}</a>` : ''}
</div>
<div class="strip"><ul class="strip-row">${figs()}</ul></div>
</section>`;

  // The menu at a glance as a roadmap: each group (or service) with its lowest listed price, drawn in with the scroll,
  // ending at the Book button.
  const glance = roadmap({ id: 'glance', cls: 'glance', eyebrow: 'At a glance', title: 'The menu, start to finish', nodes: groupNodes(servicesByCategory(c)), end: book('btn btn-primary'), endLabel: c.name });

  // First sentence large, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = c.aboutParas;
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media"><div class="oval" data-rv="mask"><div class="oval-in">${P.img(c, 'about', { cls: 'oval-img' }).replace('<img ', '<img data-par="0.05" ')}</div></div></div>
<div class="about-copy">
<p class="eyebrow" data-rv>About</p>
<h2 class="sr-only" id="about-title">About ${esc(c.name)}</h2>
<p class="about-big" data-split>${esc(first)}</p>
${rest.map((p, i) => `<p class="about-more" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${c.owner && c.owner !== c.name ? `<p class="sig" data-rv style="--d:4">${esc(c.owner)}</p>` : ''}
${P.socials(c, { cls: 'about-social' }) ? `<div data-rv style="--d:5">${P.socials(c, { cls: 'about-social' })}</div>` : ''}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec reviews-sec" aria-labelledby="reviews-title"><div class="wrap">
<p class="eyebrow" data-rv>Kind words</p><h2 class="h2" id="reviews-title" data-split>From our <em>clients</em></h2>
<div class="quotes">${c.reviews.map((r, i) => `<figure class="quote" data-rv style="--d:${i + 1}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('\n')}</div>
</div></section>`
    : '';

  const where = c.address
    ? `<div class="vi" data-rv style="--d:1"><h3>Address</h3><p class="vi-big">${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)}</p>${c.mapsUrl ? `<p><a class="arrow-link" href="${esc(c.mapsUrl)}">Get directions${icon('arrowUpRight', { size: 16 })}</a></p>` : ''}</div>`
    : c.area && !c.online
      ? `<div class="vi" data-rv style="--d:1"><h3>Area</h3><p class="vi-big">${esc(c.area)}</p></div>`
      : '';
  const visit = `<section class="sec visit" id="visit" aria-labelledby="visit-title">
<div class="wrap visit-grid">
<div class="visit-copy">
<p class="eyebrow" data-rv>Visit</p>
<h2 class="h2" id="visit-title" data-split>${esc(c.ctaTitle)}</h2>
${c.ctaSub ? `<p class="lead" data-rv style="--d:3">${esc(c.ctaSub)}</p>` : ''}
<div class="ctas" data-rv style="--d:4">${book('btn btn-primary btn-lg')}</div>
</div>
<div class="visit-info">
${where}
${c.hours.rows.length ? `<div class="vi" data-rv style="--d:2"><h3>Hours</h3>${P.hours(c.hours.rows, 'on-dark')}</div>` : ''}
${c.phone || c.email ? `<div class="vi" data-rv style="--d:3"><h3>Contact</h3>${c.phone ? `<p class="vi-big"><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>` : ''}
</div>
</div>
</section>`;

  const faq = c.faq.length
    ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">
<div><p class="eyebrow" data-rv>Questions</p><h2 class="h2" id="faq-title" data-split>Before <em>you book</em></h2></div>
<div data-rv style="--d:2">${P.faq(c.faq)}</div>
</div></section>`
    : '';

  const fields = ['name', 'email', 'phone', c.services.length > 1 ? { name: 'service', label: 'Service', type: 'select', options: c.services.map((s) => s.name), half: true } : null, c.booking ? null : { ...P.FIELD_PRESETS.when }, 'message'].filter(Boolean);
  const contact = `<section class="sec contact" id="contact" aria-labelledby="contact-title">
<div class="wrap narrow">
<div class="contact-head">
<p class="eyebrow" data-rv>Contact</p>
<h2 class="h2" id="contact-title" data-split>${c.booking ? 'Have a question <em>first?</em>' : 'Request <em>a time</em>'}</h2>
<p class="lead" data-rv style="--d:3">${c.booking ? 'Send a note and we will get back to you.' : 'Tell us what you would like and when, and we will confirm your time.'}</p>
</div>
<div class="form-card" data-rv="scale" style="--d:2">
${P.form(c, { id: 'contact', fields, submit: c.booking ? 'Send' : 'Request my time', subject: `Message for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'hdr-at', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, glance, gallery, about, reviews, visit, faq, contact, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '24px', btnRadius: '999px' } };
}

// On a mouse, a small arched photo follows the pointer along the price menu.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(hover: hover)').matches)return;var d=document,rows=[].slice.call(d.querySelectorAll('.mn li')),src=[].slice.call(d.querySelectorAll('.strip-row:first-child img')).map(function(i){return i.getAttribute('src')});if(!rows.length||!src.length)return;var f=d.createElement('div'),im=d.createElement('img');f.className='peek';f.setAttribute('aria-hidden','true');im.alt='';f.appendChild(im);d.body.appendChild(f);var x=0,y=0,tx=0,ty=0,on=false,raf=0;function loop(){x+=(tx-x)*.16;y+=(ty-y)*.16;f.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';raf=on||Math.abs(tx-x)>.5?requestAnimationFrame(loop):0}rows.forEach(function(r,i){r.addEventListener('pointerenter',function(e){im.src=src[i%src.length];if(!on&&!f.classList.contains('on')){x=tx=e.clientX+28;y=ty=e.clientY-110}on=true;f.classList.add('on');if(!raf)raf=requestAnimationFrame(loop)});r.addEventListener('pointermove',function(e){tx=e.clientX+28;ty=e.clientY-110});r.addEventListener('pointerleave',function(){on=false;f.classList.remove('on')})})})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${ROADMAP_CSS}
.glance .rm-txt h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,1.2rem + 1vw,2rem)}
.glance .rm-meta{font-family:var(--font-display);font-style:italic;font-weight:400;font-size:1.2rem;color:var(--primary-deep)}
.glance{--rm-accent:var(--primary-deep)}
h1,h2,h3{font-weight:400;letter-spacing:-.02em}
.btn-primary{box-shadow:none}
.arch{transform-origin:50% 100%}
h1 em,h2 em,.about-big em{font-style:italic;color:var(--primary-deep)}
.h2{font-size:clamp(2.5rem,1.5rem + 3.8vw,4.8rem);line-height:.98;letter-spacing:-.035em}
.eyebrow{font-weight:500;letter-spacing:.26em;font-size:.75rem;color:var(--primary-deep)}
.lead{color:var(--muted)}
.narrow{max-width:46rem}
.btn{font-weight:500;letter-spacing:.12em;text-transform:uppercase;font-size:.82rem}
.btn-lg{font-size:.86rem;padding-inline:2.1rem}
.hdr{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;transition:background-color .4s ease,border-color .4s ease}
.hdr.scrolled{background:color-mix(in srgb,var(--bg) 84%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:5.25rem;transition:min-height .4s ease}
.hdr.scrolled .hdr-in{min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.6rem;font-style:italic;line-height:1.05;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:.4rem}
.nav a{position:relative;display:block;padding:.6rem .8rem;font-size:.74rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;color:var(--muted);transition:color .3s ease}
.nav a::after{content:'';position:absolute;left:.8rem;right:.8rem;bottom:.35rem;height:1px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .5s cubic-bezier(.7,0,.2,1)}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{transform:scaleX(1);transform-origin:left}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.9rem;padding:.6rem 1.4rem;font-size:.74rem}
.menu>summary{background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;padding-block:clamp(1.5rem,1rem + 2.5vw,3.5rem) clamp(3rem,2rem + 4vw,6rem)}
.hero-grid{display:grid;gap:clamp(2.75rem,1.5rem + 4vw,4rem);align-items:center}
@media (min-width:60rem){.hero-grid{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);gap:clamp(2rem,4vw,5rem)}}
.kicker{display:flex;align-items:center;gap:1rem;font-size:.76rem;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)}
.kicker .rule{flex:none;width:3.5rem;height:1px;background:currentColor;transform-origin:0 50%}
html.m .kicker .rule{animation:atRule 1.6s cubic-bezier(.7,0,.2,1) .3s both}
@keyframes atRule{from{transform:scaleX(0)}}
.hero h1{margin-top:1.6rem;font-size:clamp(3.9rem,1.3rem + 7.6vw,9.4rem);line-height:.9;letter-spacing:-.05em}
.hero h1.long{font-size:clamp(2.9rem,1.2rem + 5.6vw,7rem);line-height:.94}
.hero h1 em{padding-right:.06em}
.hero .lead{margin-top:clamp(1.5rem,1rem + 1.5vw,2.25rem);max-width:31rem}
.ctas{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.2rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 auto}}
.hero-media{position:relative;justify-self:center;width:min(100%,29rem)}
@media (min-width:60rem){.hero-media{justify-self:end}}
.arch{overflow:hidden;border-radius:999px 999px 6px 6px;aspect-ratio:11/14;background:var(--primary-soft)}
.arch-in{height:100%;overflow:hidden}
.arch-img{width:100%;height:116%;margin-top:-8%;object-fit:cover}
.facts{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem 1.4rem;margin-top:clamp(2.5rem,1.5rem + 3vw,4.5rem);padding-block:1.15rem;border-block:1px solid var(--line);font-size:.74rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.facts li{display:flex;align-items:center;gap:.9rem}
.facts li::before{content:'';flex:none;width:.38rem;height:.38rem;background:var(--primary);transform:rotate(45deg)}
.menu-sec{background:var(--surface)}
.menu-head{display:grid;gap:1rem;justify-items:center;max-width:44rem;margin:0 auto clamp(2.5rem,1.5rem + 3vw,4.5rem);text-align:center}
.mn{display:grid;gap:3rem 5.5rem;max-width:66rem;margin-inline:auto}
@media (min-width:56rem){.mn.cols{grid-template-columns:1fr 1fr}}
.mn-cat{display:flex;align-items:baseline;gap:.9rem;padding-bottom:.4rem;font-size:clamp(1.8rem,1.4rem + 1.2vw,2.4rem);font-style:italic;letter-spacing:-.02em}
.mn-num{font-family:var(--font-body);font-size:.72rem;font-style:normal;font-weight:500;letter-spacing:.24em;color:var(--primary-deep)}
.mn li{position:relative;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.mn li::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--primary-deep);transform:scaleX(0);transform-origin:right;transition:transform .7s cubic-bezier(.7,0,.2,1)}
.mn li:hover::after{transform:scaleX(1);transform-origin:left}
.mn-top{display:flex;align-items:baseline;gap:.9rem}
.mn-top h4{margin:0;font-family:var(--font-display);font-size:clamp(1.2rem,1.1rem + .4vw,1.45rem);font-weight:400;letter-spacing:-.01em}
.dots{flex:1;min-width:1.5rem;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 38%,transparent);transform:translateY(-.3rem);transform-origin:0 50%}
html.m .mn li[data-rv] .dots{transform:translateY(-.3rem) scaleX(0);transition:transform 1.2s cubic-bezier(.7,0,.2,1) calc(var(--d,0) * 70ms + .3s)}
html.m .mn li.in .dots{transform:translateY(-.3rem) scaleX(1)}
.mn-price{font-family:var(--font-display);font-size:clamp(1.25rem,1.1rem + .5vw,1.55rem);white-space:nowrap;transition:color .3s ease}
.mn li:hover .mn-price{color:var(--primary-deep)}
.mn-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .6rem;margin-top:.3rem;font-size:.95rem;color:var(--muted)}
.mn-meta .sep{width:.25rem;height:.25rem;border-radius:50%;background:currentColor;opacity:.6}
.peek{position:fixed;left:0;top:0;z-index:25;width:9.5rem;aspect-ratio:3/4;overflow:hidden;border-radius:999px 999px 6px 6px;pointer-events:none;opacity:0;scale:.6;rotate:-4deg;transition:opacity .35s ease,scale .6s cubic-bezier(.16,1,.3,1),rotate .6s cubic-bezier(.16,1,.3,1);box-shadow:0 30px 60px -28px rgba(0,0,0,.45)}
.peek.on{opacity:1;scale:1;rotate:0deg}
.peek img{width:100%;height:100%;object-fit:cover}
.center-cta{display:flex;justify-content:center;margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
.gallery-sec{padding-block:var(--section);overflow:hidden}
.gal-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1.25rem 2rem;margin-bottom:clamp(2rem,1.5rem + 2.5vw,4rem)}
.gal-head .h2{margin-top:.9rem}
.gal-more{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;font-size:.78rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid var(--line)}
.gal-more:hover{border-bottom-color:currentColor}
.strip{overflow-x:auto;scrollbar-width:none;padding-inline:max(1.25rem,calc((100vw - var(--max)) / 2))}
.strip::-webkit-scrollbar{display:none}
html.m .strip{overflow:hidden}
.strip-row{width:max-content}
html.m .strip-row{transform:translate3d(calc((.5 - var(--p,.5)) * 46vw - 8vw),0,0)}
.strip-row{display:flex;flex:none;align-items:center;gap:clamp(1rem,2vw,2.25rem)}
.strip figure{margin:0}
.strip .ph{overflow:hidden;background:var(--primary-soft)}
.strip img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.16,1,.3,1)}
.strip figure:hover img{transform:scale(1.06)}
.strip .f1 .ph{width:clamp(14rem,10rem + 10vw,22rem);aspect-ratio:3/4;border-radius:999px 999px 4px 4px}
.strip .f2 .ph{width:clamp(11rem,8rem + 7vw,16.5rem);aspect-ratio:1;border-radius:4px}
.strip .f3 .ph{width:clamp(12.5rem,9rem + 8vw,19rem);aspect-ratio:1;border-radius:50%}
.strip .f4 .ph{width:clamp(13rem,9rem + 9vw,20rem);aspect-ratio:4/5;border-radius:4px 4px 999px 999px}
.strip .f2{margin-top:clamp(4rem,8vw,9rem)}
.strip .f3{margin-bottom:clamp(3rem,6vw,7rem)}
.strip figcaption{margin-top:.8rem;font-size:.7rem;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.about-grid{display:grid;gap:clamp(2.5rem,1.5rem + 3vw,6rem);align-items:center}
@media (min-width:60rem){.about-grid{grid-template-columns:.8fr 1.2fr}}
.about-media{display:grid;justify-items:center}
.oval{width:min(100%,25rem);overflow:hidden;border-radius:50%;aspect-ratio:4/5;background:var(--primary-soft)}
.oval-in{height:100%;overflow:hidden}
.oval-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.about-copy{display:grid;gap:1.4rem;justify-items:start}
.about-big{font-family:var(--font-display);font-size:clamp(1.85rem,1.2rem + 2.3vw,3.1rem);line-height:1.16;letter-spacing:-.025em;text-wrap:balance}
.about-more{font-size:1.15rem;line-height:1.7;color:var(--muted);max-width:38rem}
.sig{font-family:var(--font-display);font-size:2.1rem;font-style:italic;line-height:1;color:var(--primary-deep)}
.about-social{margin-top:.25rem}
.reviews-sec{background:var(--surface)}
.quotes{display:grid;gap:2.5rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem)}
@media (min-width:56rem){.quotes{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:4rem}}
.quote{display:grid;gap:1.1rem;padding-top:1.5rem;border-top:1px solid var(--ink)}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.4rem,1.15rem + 1vw,1.9rem);font-style:italic;line-height:1.3;letter-spacing:-.015em}
.quote blockquote p::before{content:'\\201C'}
.quote blockquote p::after{content:'\\201D'}
.quote figcaption{font-size:.75rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.visit{position:relative;overflow:hidden;background:var(--dark);color:var(--on-dark)}
.visit .eyebrow{color:var(--primary-on-dark)}
.visit .lead{margin-top:1.25rem;color:var(--muted-on-dark)}
.visit-grid{position:relative;display:grid;gap:3.5rem}
@media (min-width:60rem){.visit-grid{grid-template-columns:1.1fr .9fr;gap:6rem;align-items:start}}
.visit-copy .h2{margin-top:1rem}
.visit-info{display:grid;gap:2.25rem}
.vi{padding-top:1.4rem;border-top:1px solid var(--line-on-dark)}
.vi h3{margin-bottom:.7rem;font-family:var(--font-body);font-size:.72rem;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--muted-on-dark)}
.vi p{font-size:1.1rem}
.vi p+p{margin-top:.45rem}
.vi-big{font-family:var(--font-display);font-size:clamp(1.4rem,1.2rem + .8vw,1.85rem)!important;line-height:1.25;letter-spacing:-.015em}
.vi a{color:var(--on-dark);text-decoration-color:var(--line-on-dark)}
.vi .arrow-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;color:var(--primary-on-dark)}
.hours.on-dark div{border-color:var(--line-on-dark)}
.hours.on-dark dt{font-weight:500}
.hours.on-dark dd{color:var(--muted-on-dark)}
.faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}}
.faq-grid .h2{margin-top:1rem}
.faq{gap:0}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq details:first-child{border-top:1px solid var(--line)}
.faq summary{padding:1.4rem 0;font-family:var(--font-display);font-size:clamp(1.2rem,1.1rem + .4vw,1.45rem);font-weight:400;letter-spacing:-.01em}
.faq .ans{padding:0 0 1.4rem}
.contact{background:var(--surface)}
.contact-head{display:grid;gap:1rem;justify-items:center;margin-bottom:2.5rem;text-align:center}
.contact .form-card{padding:clamp(1.4rem,1rem + 1.6vw,2.5rem);border-radius:var(--radius);background:var(--bg);border:1px solid var(--line)}
.ftr{background:var(--bg)}
.ftr-name{font-style:italic;font-weight:400}
.mbar{background:color-mix(in srgb,var(--bg) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
`;

module.exports = {
  id,
  kind: 'studio',
  name: 'Atelier',
  bestFor: 'Salons, barbers, nail and lash artists, spas and tattoo studios, with motion',
  why: 'Editorial and luxurious, with motion: an oversized serif headline unfolds like a turned page, your arched photo opens from its center, the gallery slides by as you scroll, and your price menu draws itself row by row beside one clear Book button.',
  fonts: { q: 'family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..600&family=Jost:wght@400;500;600', display: ['Bodoni Moda', 'serif'], body: ['Jost', 'sans'] },
  // The motion, as data (lib/choreo.md): a page turning, a photo that sways a little, a gallery you scroll past.
  choreo: { intro: 'unfold', alive: ['pointer', 'drift'], scroll: 'scrub', pace: 'calm', look: 'editorial, slow and soft' },
  tokens,
  slots,
  nav,
  render,
};
