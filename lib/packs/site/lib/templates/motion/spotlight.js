// Spotlight (animated, creator): a full creator page, bold and playful. The name fills the screen in big round letters
// that drop in, lean toward the pointer and squash when tapped; two bands of the creator's platforms cross the page;
// big link cards tilt toward the pointer under a soft light; then rates, brands, about and a brand inquiry form.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon, iconForLink } = require('../../icons');
const { motion } = require('../../motion');
const { head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'spotlight';

function tokens(p) {
  return { bg: color.mix(p.paper, '#fbf2e2', 0.85), dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#14100d', 0.6) };
}

function slots(c) {
  return [{ slot: 'portrait', file: 'portrait.jpg', w: 1000, h: 1200, style: 'portrait', alt: c.owner && c.owner !== c.name ? `${c.owner}, ${c.whatShort || 'creator'}` : `${c.name}, ${c.whatShort || 'creator'}` }];
}

function nav(c) {
  return [
    c.links.length && { label: 'Links', href: '#links' },
    c.services.length && { label: 'Work with me', href: '#rates' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// Where the creator is, from their own links and socials only: [{ name, icon }].
const PLACES = [
  [/youtube\.com|youtu\.be/i, 'YouTube', 'youtube'],
  [/instagram\.com/i, 'Instagram', 'instagram'],
  [/tiktok\.com/i, 'TikTok', 'tiktok'],
  [/twitch\.tv/i, 'Twitch', 'play'],
  [/(^|\/\/|\.)x\.com|twitter\.com/i, 'X', 'x'],
  [/linkedin\.com/i, 'LinkedIn', 'linkedin'],
  [/facebook\.com/i, 'Facebook', 'facebook'],
  [/spotify\.com|podcasts\.apple|anchor\.fm/i, 'Podcast', 'play'],
  [/substack\.com|beehiiv\.com|kit\.com|convertkit|buttondown/i, 'Newsletter', 'mail'],
  [/pinterest\./i, 'Pinterest', 'link'],
  [/threads\.net/i, 'Threads', 'link'],
  [/etsy\.com|shopify|amazon\.|stan\.store|gumroad|bigcartel/i, 'Shop', 'bag'],
];
function platforms(c) {
  const out = [];
  const hrefs = [...Object.values(c.socials || {}), ...c.links.map((l) => l.href)];
  for (const h of hrefs) {
    const hit = PLACES.find(([re]) => re.test(h));
    if (hit && !out.some((x) => x.name === hit[1])) out.push({ name: hit[1], icon: hit[2] });
  }
  return out;
}

// The domain a link goes to, as a small label on its card.
function whereOf(l) {
  const hit = PLACES.find(([re]) => re.test(l.href));
  if (hit) return hit[1];
  if (/^mailto:/.test(l.href)) return 'Email';
  return String(l.href).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

// Letters of the name: each drops in, leans toward the pointer and squashes on tap. The screen reader gets the name.
function bigName(c) {
  const name = String(c.name || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  const longest = Math.max(...words.map((w) => w.length));
  const n = words.length <= 2 ? longest : Math.max(longest, Math.ceil(name.length / 2));
  let k = 0;
  const tilt = [-6, 4, -3, 7, -5, 3, 6, -4];
  const html = words
    .map((w) => `<span class="nw">${Array.from(w).map((ch) => `<span class="lt" style="--i:${k};--r:${tilt[k++ % tilt.length]}deg"><span class="lv"><span>${esc(ch)}</span></span></span>`).join('')}</span>`)
    .join(' ');
  return `<h1 class="sl-name" id="hero-title" style="--n:${n};--m:${Math.max(longest, 4)}"><span class="sr-only">${esc(name)}</span><span aria-hidden="true">${html}</span></h1>`;
}

const STICKER = 'Say hello \u2726 Brand inquiries \u2726 ';

function render(c) {
  const person = c.owner && c.owner !== c.name ? c.owner : c.name.split(/\s+/)[0];
  const places = platforms(c);
  const mag = (html) => html.replace('<a ', '<a data-mag ');

  const sticker = `<a class="sticker" href="#contact" aria-label="Brand inquiries"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><path id="sl-c" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs><text><textPath href="#sl-c" textLength="272" lengthAdjust="spacing">${esc(STICKER)}</textPath></text></svg><span class="sticker-c">${icon('arrowUpRight', { size: 26, stroke: 2.2 })}</span></a>`;

  const hero = `<section class="hero" aria-labelledby="hero-title">
<span class="blob b1" aria-hidden="true" data-par="-0.12"></span><span class="blob b2" aria-hidden="true" data-par="0.1"></span>
<span class="spark s1" aria-hidden="true" data-par="-0.25">${icon('star4', { size: 54, stroke: 1.6 })}</span><span class="spark s2" aria-hidden="true" data-par="0.18">${icon('star4', { size: 34, stroke: 1.8 })}</span>
<div class="wrap hero-in">
<div class="hero-top" data-rv>
<span class="av" aria-hidden="true">${esc(P.monogram(c.name))}</span>
<p>${c.handle ? `<strong>${esc(c.handle)}</strong>` : ''}${c.whatShort ? `<span>${esc(c.whatShort)}</span>` : ''}</p>
</div>
${bigName(c)}
<div class="hero-row">
<p class="hero-sub" data-rv style="--d:6">${esc(c.heroSub)}</p>
<div class="hero-act" data-rv style="--d:7">
<div class="ctas">${c.primary ? mag(P.button(c.primary, 'btn btn-primary btn-lg', iconForLink(c.primary) === 'link' ? '' : iconForLink(c.primary))) : ''}<a class="btn btn-ink btn-lg" href="#contact">Brand inquiries</a></div>
${P.socials(c, { cls: 'hero-social' })}
</div>
</div>
</div>
${sticker}
</section>`;

  // Two bands of platforms cross the page. Short lists repeat so a band always fills the width.
  let bandItems = places.map((x) => x.name);
  const bandIcons = new Map(places.map((x) => [x.name, x.icon]));
  if (bandItems.length) while (bandItems.length < 6) bandItems = bandItems.concat(bandItems);
  const row = (items, hidden) => `<ul class="band-row"${hidden ? ' aria-hidden="true"' : ''}>${items.map((b) => `<li><span class="bi">${icon(bandIcons.get(b) || 'link', { size: 30, stroke: 2 })}</span>${esc(b)}</li>`).join('')}</ul>`;
  const bands = places.length
    ? `<section class="bands" aria-label="Find ${esc(person)} on ${esc(places.map((x) => x.name).join(', '))}">
<div class="band band-a"><div class="mq"><div class="mq-track">${row(bandItems, true)}${row(bandItems, true)}</div></div></div>
<div class="band band-b mq-rev"><div class="mq"><div class="mq-track">${row(bandItems.slice().reverse(), true)}${row(bandItems.slice().reverse(), true)}</div></div></div>
</section>`
    : '';

  const odd = c.links.length % 2 === 1;
  const links = c.links.length
    ? `<section class="sec links-sec" id="links" aria-labelledby="links-title">
<div class="wrap">
<div class="sec-top"><p class="eyebrow" data-rv>Links</p><h2 class="h2" id="links-title" data-split>Find me here</h2></div>
<ul class="links">
${c.links.map((l, i) => `<li class="${i === 0 && odd && c.links.length > 1 ? 'wide' : ''}" data-rv="scale" style="--d:${i % 4}"><a class="lk lk-${i % 4}" href="${esc(l.href)}" data-spot><span class="lk-ic">${P.linkIcon(l, 26)}</span><span class="lk-where">${esc(whereOf(l))}</span><span class="lk-t">${esc(l.label)}</span><span class="lk-go" aria-hidden="true">${icon('arrowUpRight', { size: 24, stroke: 2.2 })}</span></a></li>`).join('\n')}
</ul>
</div>
</section>`
    : '';

  const rates = c.services.length
    ? `<section class="sec rates" id="rates" aria-labelledby="rates-title">
<div class="wrap">
<div class="sec-top"><p class="eyebrow" data-rv>Work with me</p><h2 class="h2" id="rates-title" data-split>${c.services.some((s) => s.priceText) ? 'Rates' : 'What I offer'}</h2></div>
<ul class="rate-grid">
${c.services.map((s, i) => `<li class="rate" data-rv style="--d:${i % 3}"><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="rate-p">${esc(s.priceText)}</p>` : ''}${s.blurb || s.duration ? `<p class="rate-b">${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</p>` : ''}</li>`).join('\n')}
</ul>
${c.included.length ? `<ul class="incl" data-rv>${c.included.map((x) => `<li>${icon('check', { size: 18, stroke: 2.4 })}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
</section>`
    : '';

  const brands = c.clients && c.clients.length
    ? `<section class="brands" aria-labelledby="brands-title"><div class="wrap"><h2 class="eyebrow" id="brands-title" data-rv>Worked with</h2><ul class="brand-list">${c.clients.map((x, i) => `<li data-rv="scale" style="--d:${i % 6}">${esc(x)}</li>`).join('')}</ul></div></section>`
    : '';

  const about = `<section class="sec about" id="about" aria-labelledby="about-title">
<div class="wrap about-grid">
<div class="about-media-wrap"><div class="about-media" data-rv="mask">${P.img(c, 'portrait', { cls: 'about-img' }).replace('<img ', '<img data-par="0.05" ')}</div><span class="about-star" aria-hidden="true">${icon('star4', { size: 64, stroke: 1.4 })}</span></div>
<div class="about-copy">
<p class="eyebrow" data-rv>About</p>
<h2 class="h2" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `Hi, I'm ${c.owner}.` : `Hi, I'm ${c.name}.`)}</h2>
${c.aboutParas.map((p, i) => `<p data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<div data-rv style="--d:4">${P.socials(c)}</div>
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="sec" aria-labelledby="reviews-title"><div class="wrap"><div data-rv>${head({ eyebrow: 'Kind words', title: 'What people say', id: 'reviews-title' })}</div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';
  const faq = c.faq.length ? `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div data-rv>${head({ eyebrow: 'FAQ', title: 'Good to know', id: 'faq-title' })}</div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>` : '';

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
<p class="eyebrow" data-rv>Contact</p>
<h2 class="h2" id="contact-title" data-split>Brand inquiries</h2>
<p class="lead" data-rv style="--d:3">Tell me about your brand and what you have in mind${c.email ? ', or write to me directly' : ''}.</p>
<div data-rv style="--d:4">${P.contactList(c, { cls: 'ct-list' })}</div>
</div>
<div class="form-card" data-rv="scale" style="--d:2">
${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}
</div>
</div>
</section>`;

  const m = motion();
  const body = [
    '<div class="prog" aria-hidden="true"></div>',
    P.header(c, { cls: 'hdr-sl', cta: { label: 'Brand inquiries', href: '#contact' } }).replace('<header class="hdr', '<header data-hdr class="hdr'),
    '<main id="main">',
    hero,
    bands,
    links,
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
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '28px', radiusSm: '14px', btnRadius: '999px', max: '80rem' } };
}

// Letters lean toward the pointer and squash on tap; link cards tilt toward it. Pointer effects only with a mouse.
const JS = `(function(){
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var d=document,fine=matchMedia('(hover: hover) and (pointer: fine)').matches,nm=d.querySelector('.sl-name');
var L=nm?Array.prototype.slice.call(nm.querySelectorAll('.lt')):[];
L.forEach(function(l){l.addEventListener('click',function(){l.classList.remove('pop');void l.offsetWidth;l.classList.add('pop')})});
if(!fine)return;
if(nm){var hero=nm.closest('section'),px=-9999,py=0,raf=0;
var f=function(){raf=0;L.forEach(function(l){var r=l.getBoundingClientRect(),dx=px-r.left-r.width/2,dy=py-r.top-r.height/2,k=Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/280);l.style.setProperty('--k',k.toFixed(3));l.classList.toggle('hot',k>.5)})};
hero.addEventListener('pointermove',function(e){px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(f)});
hero.addEventListener('pointerleave',function(){px=-9999;if(!raf)raf=requestAnimationFrame(f)})}
d.querySelectorAll('.lk').forEach(function(c){c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.setProperty('--rx',(-y*8).toFixed(2)+'deg');c.style.setProperty('--ry',(x*10).toFixed(2)+'deg')});c.addEventListener('pointerleave',function(){c.style.removeProperty('--rx');c.style.removeProperty('--ry')})});
})();`;

const CSS = `
${HEAD_CSS}${FOOTER_CSS}${REVIEWS_CSS}
.sec-head{justify-items:start}
h1,h2,h3{font-weight:800;letter-spacing:-.03em}
.h2{font-size:clamp(2.3rem,1.5rem + 3.4vw,4.6rem);line-height:1}
.eyebrow{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .85rem;border:2px solid var(--ink);border-radius:999px;background:var(--bg);color:var(--ink);font-size:.78rem;font-weight:700;letter-spacing:.1em}
.btn{font-weight:700;border-width:2px}
.btn-primary{border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}
.btn-primary:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.btn-ink{background:var(--bg);color:var(--ink);border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}
.btn-ink:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink);background:var(--surface)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:2px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--ink)}
.hdr-in{display:flex;align-items:center;gap:1.25rem;min-height:4.5rem}
.brand{display:flex;align-items:center;gap:.6rem;margin-right:auto;font-family:var(--font-display);font-weight:800;font-size:1.05rem;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;border:2px solid var(--ink);background:var(--primary);color:var(--on-primary);font-size:.85rem}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.5rem .85rem;border-radius:999px;font-weight:600;font-size:.95rem;text-decoration:none;transition:background-color .2s ease}
.nav a:hover{background:var(--primary-soft)}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.8rem;padding:.55rem 1.15rem;box-shadow:3px 3px 0 var(--ink)}
.menu>summary{border:2px solid var(--ink)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.hero{position:relative;overflow:hidden;padding-block:clamp(2rem,1.5rem + 3vw,4.5rem) clamp(3rem,2rem + 4vw,6rem)}
.blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;pointer-events:none}
.b1{width:34rem;height:34rem;right:-10rem;top:-8rem;background:var(--primary-tint)}
.b2{width:24rem;height:24rem;left:-12rem;bottom:1rem;background:var(--accent-soft)}
.spark{position:absolute;color:var(--primary);pointer-events:none}
.spark .i,.about-star .i{fill:currentColor;stroke:none;animation:slSpin 14s linear infinite}
.s1{right:8%;top:58%}
.s2{left:46%;top:6%;color:var(--ink)}
@media (max-width:47.99rem){.s2{display:none}}
@keyframes slSpin{to{transform:rotate(360deg)}}
.hero-in{position:relative}
.hero-top{display:flex;align-items:center;gap:.8rem}
.av{display:inline-grid;place-items:center;flex:none;width:3.4rem;height:3.4rem;border-radius:50%;border:2px solid var(--ink);background:var(--primary);color:var(--on-primary);font-family:var(--font-display);font-weight:800;font-size:1.05rem;box-shadow:3px 3px 0 var(--ink)}
.hero-top p{display:grid;line-height:1.3}
.hero-top strong{font-size:1.05rem}
.hero-top p span{color:var(--muted);font-size:.95rem}
.sl-name{margin:clamp(1rem,.5rem + 2vw,2rem) 0 0;font-size:min(calc((100vw - 2rem) / var(--m) * 1.17),9rem);line-height:.98;letter-spacing:-.045em;font-weight:900;cursor:default;user-select:none;-webkit-user-select:none}
@media (min-width:48rem){.sl-name{font-size:min(calc((100vw - 5rem) * .72 / var(--n) * 1.22),14rem)}}
.nw{display:inline-block;white-space:nowrap}
@media (max-width:47.99rem){.nw{display:block}}
.lt{display:inline-block}
.lv{display:inline-block;transform:translateY(calc(var(--k,0) * -.16em)) rotate(calc(var(--k,0) * var(--r) * 1.8)) scale(calc(1 + var(--k,0) * .1));transition:transform .4s cubic-bezier(.2,1.4,.4,1),color .25s ease}
.lt.hot .lv{color:var(--primary)}
.lv>span{display:inline-block}
html.m .lv>span{animation:slDrop 1s cubic-bezier(.3,1.5,.5,1) both;animation-delay:calc(var(--i) * 55ms + .1s)}
html.m .lt.pop .lv>span{animation:slPop .7s cubic-bezier(.3,1.5,.5,1)}
@keyframes slDrop{from{opacity:0;transform:translateY(-.9em) rotate(calc(var(--r) * 4))}40%{opacity:1}}
@keyframes slPop{30%{transform:scale(1.25,.72) translateY(.08em)}55%{transform:scale(.88,1.18) translateY(-.12em)}80%{transform:scale(1.05,.96)}}
.hero-row{display:grid;gap:1.75rem;margin-top:clamp(1.5rem,1rem + 2vw,2.75rem)}
@media (min-width:60rem){.hero-row{grid-template-columns:1fr auto;align-items:end;gap:4rem}}
.hero-sub{max-width:34rem;font-size:clamp(1.25rem,1.05rem + .8vw,1.75rem);line-height:1.35;font-weight:600;letter-spacing:-.015em}
.hero-act{display:grid;gap:1.25rem;justify-items:start}
@media (min-width:60rem){.hero-act{justify-items:end}}
.ctas{display:flex;flex-wrap:wrap;gap:.85rem}
@media (max-width:39.99rem){.ctas .btn{flex:1 1 100%}}
.socials a{border-width:2px;background:var(--bg);transition:transform .25s cubic-bezier(.2,1.4,.4,1),background-color .2s ease}
.socials a:hover{transform:translateY(-3px) rotate(-6deg);background:var(--primary-soft)}
.sticker{position:absolute;right:clamp(1rem,4vw,4rem);top:clamp(5rem,9vw,8rem);display:grid;place-items:center;width:clamp(6.5rem,5rem + 5vw,9.5rem);aspect-ratio:1;border-radius:50%;background:var(--ink);color:var(--bg);text-decoration:none;transition:transform .4s cubic-bezier(.2,1.4,.4,1)}
.sticker:hover{transform:scale(1.08) rotate(-8deg)}
.sticker>svg{position:absolute;inset:0;width:100%;height:100%;animation:slSpin 18s linear infinite}
.sticker text{fill:currentColor;font-family:var(--font-display);font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.sticker-c{display:grid;place-items:center;width:42%;aspect-ratio:1;border-radius:50%;background:var(--primary);color:var(--on-primary)}
@media (max-width:47.99rem){.sticker{top:1rem;right:1rem;width:4.75rem}.sticker text{font-size:11px}}
.bands{position:relative;padding-block:clamp(2.5rem,2rem + 3vw,5rem);overflow:hidden}
.band{border-block:2px solid var(--ink);padding-block:clamp(.8rem,.6rem + .8vw,1.3rem);margin-inline:-2rem}
.band-a{position:relative;z-index:2;background:var(--primary);color:var(--on-primary);transform:rotate(-2.5deg);--mq-speed:30s}
.band-b{margin-top:-.6rem;background:var(--ink);color:var(--bg);transform:rotate(2deg);--mq-speed:36s}
.band .mq{-webkit-mask-image:none;mask-image:none}
.band-row{display:flex;flex:none}
.band-row li{display:flex;align-items:center;gap:.9rem;padding-right:2.6rem;font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 2vw,3.2rem);font-weight:800;letter-spacing:-.03em;white-space:nowrap}
.bi{display:inline-grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;border:2px solid currentColor}
.bi .i{width:.8em;height:.8em}
.sec-top{display:grid;justify-items:start;gap:1rem;margin-bottom:clamp(2rem,1.5rem + 2vw,3.25rem)}
.links-sec{padding-top:clamp(2rem,1.5rem + 2vw,3.5rem)}
.links{display:grid;gap:1.25rem}
@media (min-width:48rem){.links{grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem}.links .wide{grid-column:span 2}}
.links li{perspective:900px}
.lk{--spot:rgba(255,255,255,.45);display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto 1fr;gap:.35rem 1rem;align-items:start;min-height:9.5rem;height:100%;padding:clamp(1.25rem,1rem + 1vw,2rem);border:2px solid var(--ink);border-radius:var(--radius);background:var(--surface);color:var(--ink);text-decoration:none;box-shadow:6px 6px 0 var(--ink);transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease;overflow:hidden}
.lk:hover{box-shadow:10px 10px 0 var(--ink);transition:transform .12s linear,box-shadow .3s ease}
.lk-0{background:var(--primary);color:var(--on-primary)}
.lk-1{background:var(--bg)}
.lk-2{background:var(--accent-soft)}
.lk-3{background:var(--dark);color:var(--on-dark);--spot:rgba(255,255,255,.14);box-shadow:6px 6px 0 var(--primary)}
.lk-3:hover{box-shadow:10px 10px 0 var(--primary)}
.lk-ic{grid-row:1;display:grid;place-items:center;width:3.4rem;height:3.4rem;border-radius:50%;border:2px solid currentColor}
.lk-where{align-self:center;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.75;overflow-wrap:anywhere}
.lk-t{grid-column:1 / -1;align-self:end;margin-top:1.25rem;font-family:var(--font-display);font-size:clamp(1.3rem,1.05rem + 1vw,2rem);font-weight:700;line-height:1.1;letter-spacing:-.03em}
.wide .lk-t{font-size:clamp(1.5rem,1.1rem + 1.8vw,2.8rem)}
.lk-go{grid-column:3;grid-row:1;display:grid;place-items:center;width:3rem;height:3rem;border-radius:50%;background:var(--ink);color:var(--bg);transition:transform .45s cubic-bezier(.2,1.4,.4,1)}
.lk-0 .lk-go,.lk-3 .lk-go{background:var(--bg);color:var(--ink)}
.lk:hover .lk-go{transform:rotate(45deg) scale(1.08)}
.rates{background:var(--dark);color:var(--on-dark)}
.rates .eyebrow{background:var(--dark);color:var(--on-dark);border-color:var(--on-dark)}
.rate-grid{display:grid;gap:1.25rem}
@media (min-width:48rem){.rate-grid{grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))}}
.rate{display:grid;gap:.6rem;align-content:start;padding:1.75rem;border:2px solid var(--line-on-dark);border-radius:var(--radius);transition:transform .4s cubic-bezier(.2,1.4,.4,1),border-color .3s ease,background-color .3s ease}
.rate:hover{transform:translateY(-6px) rotate(-1deg);border-color:var(--primary-on-dark);background:color-mix(in srgb,var(--on-dark) 5%,transparent)}
.rate h3{font-size:1.25rem;letter-spacing:-.02em}
.rate-p{font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.4vw,2.8rem);font-weight:800;line-height:1;letter-spacing:-.05em;color:var(--primary-on-dark)}
.rate-b{color:var(--muted-on-dark)}
.rates .incl{display:grid;gap:.6rem;margin-top:2rem}
@media (min-width:48rem){.rates .incl{grid-template-columns:1fr 1fr}}
.rates .incl li{display:flex;gap:.6rem}
.rates .incl .i{flex:none;margin-top:.25rem;color:var(--primary-on-dark)}
.brands{padding-block:clamp(3rem,2rem + 3vw,5rem);border-bottom:2px solid var(--ink)}
.brand-list{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.brand-list li{padding:.7rem 1.3rem;border:2px solid var(--ink);border-radius:999px;font-family:var(--font-display);font-size:clamp(1.05rem,.95rem + .6vw,1.5rem);font-weight:700;letter-spacing:-.02em;background:var(--bg);transition:transform .35s cubic-bezier(.2,1.4,.4,1),background-color .2s ease}
.brand-list li:nth-child(3n+1):hover{background:var(--primary-soft)}
.brand-list li:hover{transform:rotate(-4deg) scale(1.05);background:var(--accent-soft)}
.about-grid{display:grid;gap:3rem;align-items:center}
@media (min-width:56rem){.about-grid{grid-template-columns:.85fr 1.15fr;gap:5rem}}
.about-media-wrap{position:relative;width:min(100%,28rem);justify-self:center}
.about-media{overflow:hidden;aspect-ratio:5/6;border:2px solid var(--ink);border-radius:999px 999px var(--radius) var(--radius);box-shadow:10px 10px 0 var(--primary)}
.about-img{width:100%;height:112%;margin-top:-6%;object-fit:cover}
.about-star{position:absolute;right:-.25rem;top:-1.5rem;color:var(--ink)}
.about-star .i{animation:slSpin 12s linear infinite}
.about-copy{display:grid;gap:1.15rem;justify-items:start}
.about-copy p:not(.eyebrow){max-width:36rem;font-size:1.15rem;line-height:1.65}
.faq details{border:2px solid var(--ink);border-radius:var(--radius-sm)}
.faq-grid{display:grid;gap:1rem}
@media (min-width:60rem){.faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.review{border:2px solid var(--ink);box-shadow:5px 5px 0 var(--ink)}
.contact{background:var(--primary);color:var(--on-primary);border-top:2px solid var(--ink)}
.contact .h2{font-size:clamp(2.8rem,1.6rem + 5vw,6rem)}
.contact .lead{color:inherit;opacity:.9;margin-top:.5rem}
.contact-grid{display:grid;gap:2.5rem;align-items:start}
@media (min-width:60rem){.contact-grid{grid-template-columns:1fr 1fr;gap:4rem}}
.contact-copy{display:grid;gap:1rem;justify-items:start}
.ct-list{margin-top:1rem}
.ct-list .i{color:inherit}
.ct-list a{color:inherit}
.form-card{width:100%;padding:clamp(1.3rem,1rem + 1.5vw,2.25rem);border:2px solid var(--ink);border-radius:var(--radius);background:var(--bg);color:var(--ink);box-shadow:10px 10px 0 var(--ink)}
.field input,.field select,.field textarea{border:2px solid var(--ink)}
.ftr{border-top:0}
.mbar{border-top:2px solid var(--ink)}
.mbar .btn{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;text-align:center;line-height:2.6}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Spotlight',
  bestFor: 'Creators, streamers, podcasters and writers who want a full page with their links, rates and a brand inquiry form, with motion',
  why: 'Bold and playful: your name fills the screen and plays with the cursor, your platforms cross the page, and big link cards, rates and a brand inquiry form follow.',
  fonts: { q: 'family=Unbounded:wght@500..900&family=Plus+Jakarta+Sans:wght@400;500;600;700', display: ['Unbounded', 'grotesk'], body: ['Plus Jakarta Sans', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
