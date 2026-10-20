// Launch (animated, product): one product, presented like a launch keynote, set on steel and white paper.
//   Object:   the product itself, its photo, and its name set as big as the page allows.
//   Material: brushed steel and paper: a cool white page, near-black ink, steel-grey hairlines, round only where the
//             thing is round in life (the button, like a cap).
//   One move: the name's letters fly in and lock together, the shot lands under it with a small bounce, then grows to
//             fill the screen as you scroll (backwards when scrolling up). At rest the shot leans toward the pointer.
//   Pop:      the member's colour is one line: under the name's last word in the hero, then the roadmap's line from
//             order to door. Buttons are ink.
// Sections: hero (name across the page, the line and the price beside it), the details as large hairline rows beside
// a tall photo, the member's story when they wrote one, a wide photo with its caption set beside it, the buy block with
// sizes and prices set like a price list, order to door as a roadmap, questions. No bento, no glass, no glow.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'launch';

function tokens(p) {
  return { bg: color.mix(p.paper, '#ffffff', 0.7), dark: color.mix(p.ink, '#000000', 0.55) };
}

function product(c) {
  return c.productName || c.heroTitle || c.name;
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [
    { slot: 'hero', file: 'product.jpg', w: 1600, h: 1200, style: 'object', alt: c.profile.hero && !/^the product/i.test(c.profile.hero) ? c.profile.hero : `${name}, up close` },
    { slot: 'detail', file: 'detail.jpg', w: 1200, h: 1000, style: 'mesh', alt: g[1] || `${name} in use` },
    { slot: 'wide', file: 'everyday.jpg', w: 1800, h: 1000, style: 'sweep', alt: g[3] || g[2] || `${name} at home` },
  ];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return { text: c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText, low };
  if (c.priceText) return { text: c.priceText, low: null };
  return null;
}

function nav(c) {
  return [
    c.included.length && { label: 'Features', href: '#features' },
    c.buy ? { label: 'Buy', href: '#buy' } : { label: 'Waitlist', href: '#signup' },
    ownAbout(c).length && { label: 'Story', href: '#story' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

// The name, one letter per span so each can rise in; read as one word by screen readers.
function letters(s) {
  let i = 0;
  return String(s)
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="lw">${[...w].map((ch) => `<span class="ch" data-ci-part style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`))
    .join('');
}

// The generated "About" for a product ("X makes Y. Ships... Questions?...") repeats the page; only the member's own
// words make a story section.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  const gen = new RegExp(`^${String(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} makes `, 'i');
  if (paras.length === 1 && gen.test(paras[0])) return [];
  if (/^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const buyBtn = (cls = 'btn btn-primary btn-lg') => P.button(buy, cls).replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const subMore = c.tagline && c.heroSub.startsWith(sub) ? c.heroSub.slice(sub.length).trim() : '';
  const maker = name !== c.name && !String(sub).includes(c.name) ? c.name : '';
  const len = Math.max(5, [...name].length);
  const priceHtml = (t) => esc(t).replace(/^(From )?(\S+)/, (m, f, v) => `${f ? '<span>From</span> ' : ''}<b>${v}</b>`);

  const hero = `<section class="lx-hero" aria-labelledby="hero-title" data-sc>
<div class="lx-stage" data-sc-stage>
<div class="wrap lx-copy">
${maker ? `<p class="lx-maker" data-ci="then">${esc(maker)}</p>` : ''}
<h1 id="hero-title" data-ci="head" class="lx-name${len > 12 ? ' long' : ''}" style="--len:${len}" aria-label="${esc(name)}"><span aria-hidden="true">${letters(name)}</span></h1>
<div class="lx-row">
<p class="lx-sub" data-ci="then">${esc(sub)}${subMore ? ` <span>${esc(subMore)}</span>` : ''}</p>
<div class="lx-ctas" data-ci="then">
${price ? `<p class="lx-from">${priceHtml(price.text)}</p>` : ''}
${buyBtn()}
${!price && c.secondary ? P.button(c.secondary, 'lx-link') : ''}
</div>
</div>
</div>
<div class="lx-shot">
<div class="lx-shot-in" data-ci="subject" data-alive="0.45">${P.img(c, 'hero', { cls: 'lx-shot-img', eager: true })}</div>
<p class="lx-tag" aria-hidden="true"><span>${esc(name)}</span>${price ? `<span>${esc(price.text)}</span>` : ''}</p>
</div>
</div>
</section>`;

  const paras = ownAbout(c);
  const story = paras.length
    ? `<section class="lx-sec lx-story" id="story" aria-labelledby="story-title">
<div class="wrap lx-story-in">
<h2 class="lx-side" id="story-title">${esc(c.owner && c.owner !== c.name ? `${c.owner}, ${c.name}` : c.name)}</h2>
<div>${paras.map((p, i) => `<p class="lx-say${i ? ' more' : ''}">${esc(p)}</p>`).join('\n')}</div>
</div>
</section>`
    : '';

  const n = c.included.length;
  const features = n
    ? `<section class="lx-sec lx-spec" id="features" aria-labelledby="features-title">
<div class="wrap lx-spec-in">
<div class="lx-spec-media">${P.img(c, 'detail', { cls: 'lx-spec-img' }).replace('<img ', '<img data-par="0.04" ')}</div>
<div class="lx-spec-list">
<h2 class="lx-h2" id="features-title">${n > 1 ? 'The details.' : 'The detail.'}</h2>
<ul>${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
</div>
</div>
</section>`
    : '';

  const ship = c.shipping ? c.shipping.replace(/[.]+$/, '') : '';
  const wide = `<section class="lx-wide" aria-label="${esc(name)}">
<div class="lx-wide-frame">${P.img(c, 'wide', { cls: 'lx-wide-img' }).replace('<img ', '<img data-par="0.06" ')}</div>
${ship ? `<p class="wrap lx-wide-cap"><span>${esc(name)}</span><span>${esc(ship)}.</span></p>` : ''}
</section>`;

  const priced = c.services.filter((s) => s.name);
  // From order to door as a roadmap: each size or option with its price, then shipping and returns as the member wrote
  // them, drawn in with the scroll and ending at the Buy button.
  const route = buy.kind === 'form' ? '' : roadmap({ id: 'route', cls: 'route lx-sec', title: 'Order to door.', nodes: [...priced.map((s) => ({ title: s.name, meta: s.priceText || '', sub: s.blurb || '' })), c.shipping && { title: 'Shipping', sub: c.shipping }, c.returns && { title: 'Returns', sub: c.returns }], end: buyBtn('btn btn-primary'), endLabel: name });
  const waitlist = buy.kind === 'form';
  const facts = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.capacity && ['Made', esc(c.capacity)], c.email && !waitlist && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const buySec = `<section class="lx-sec lx-buy${waitlist ? ' lx-wait' : ''}" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title">
<div class="wrap lx-buy-grid">
<div class="lx-buy-media">${P.img(c, 'hero', { cls: 'lx-buy-img' }).replace(/alt="[^"]*"/, 'alt=""')}</div>
<div class="lx-buy-copy">
<h2 class="lx-h2" id="buy-title">${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist ? `<p class="lx-lead">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${price && priced.length < 2 ? `<p class="lx-price">${priceHtml(price.text)}</p>` : ''}
${priced.length > 1 ? `<ul class="lx-opts">${priced.map((s) => `<li><span>${esc(s.name)}${s.blurb ? `<small>${esc(s.blurb)}</small>` : ''}</span><i aria-hidden="true"></i>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>` : ''}
${priced.length === 1 && priced[0].blurb ? `<p class="lx-note">${esc(priced[0].blurb)}</p>` : ''}
${waitlist
  ? `<div class="lx-form">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="lx-buy-cta">${buyBtn('btn btn-primary btn-lg lx-big')}</div>`}
${facts.length ? `<dl class="lx-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="lx-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="lx-h2" id="reviews-title">What people say</h2><div class="lx-rv">${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="lx-sec lx-faq" id="faq" aria-labelledby="faq-title"><div class="wrap lx-faq-grid"><h2 class="lx-h2" id="faq-title">Questions.</h2>${P.faq(c.faq)}</div></section>`
    : '';

  const bar = `<nav class="mbar lx-bar" aria-label="Buy ${esc(name)}"><div class="lx-bar-t"><strong>${esc(name)}</strong>${price ? `<span>${esc(price.text)}</span>` : ''}</div>${P.button(buy, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'lx-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, story, wide, buySec, route, reviews, faq, '</main>', P.footer(c), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '999px', max: '80rem' } };
}

// The phone buy bar slides up once the hero has passed (the hero's own scroll moment is the choreo block's).
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var hero=document.querySelector('.lx-hero'),bar=document.querySelector('.lx-bar'),t=false;if(!hero||!bar)return;
function f(){t=false;bar.classList.toggle('on',hero.getBoundingClientRect().bottom<innerHeight*.5)}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
body{--rule:color-mix(in srgb,var(--ink) 15%,transparent);--ease:cubic-bezier(.16,1,.3,1);letter-spacing:-.011em}
h1,h2,h3{font-weight:700;letter-spacing:-.035em}
.btn{font-weight:600}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-sm{min-height:2.4rem;padding:.45rem 1.05rem;font-size:.875rem}
.prog{background:var(--pop)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.05rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{font-size:.875rem;color:var(--muted);text-decoration:none;transition:color .2s ease}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
.menu-panel{border-radius:6px;box-shadow:none;border-color:var(--rule)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.route{border-top:1px solid var(--rule)}
.route .h2{font-size:clamp(2.6rem,1.6rem + 4.4vw,5.6rem);line-height:.96;letter-spacing:-.055em}
.route .rm-meta{color:var(--ink);font-variant-numeric:tabular-nums}
.lx-h2{font-size:clamp(2.6rem,1.6rem + 4.4vw,5.6rem);line-height:.96;letter-spacing:-.055em}
.lx-lead{margin-top:1.25rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
.lx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem)}
/* hero: without motion it is a plain stack; with motion the stage sticks and the shot grows as you scroll */
.lx-hero{--p:1;position:relative;overflow-x:clip}
.lx-stage{position:relative;display:grid;padding:clamp(2rem,1rem + 4vw,4.5rem) 0 0}
.lx-copy{position:relative;z-index:2}
.lx-maker{font-size:.95rem;font-weight:600;color:var(--muted)}
.lx-name{margin-top:.2rem;margin-left:-.05em;font-size:min(16rem,calc(90vw / (var(--len,10) * .54)));line-height:.86;letter-spacing:-.065em;font-weight:700;padding-bottom:.04em;white-space:nowrap}
.lx-name .lw{display:inline-block;white-space:nowrap}
@media (max-width:47.99rem){.lx-name.long{white-space:normal;font-size:calc(90vw / (var(--len,10) * .54) * 1.8);line-height:.9}}
.lx-name .ch{display:inline-block}
.lx-row{display:grid;gap:1.4rem;margin-top:clamp(1.2rem,.8rem + 1.4vw,2.2rem);padding-top:1.2rem;border-top:1px solid var(--rule)}
@media (min-width:56rem){.lx-row{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:3rem}}
.lx-sub{max-width:32rem;font-size:clamp(1.15rem,1rem + .55vw,1.5rem);line-height:1.35;font-weight:500;letter-spacing:-.025em}
.lx-sub span{color:var(--muted)}
.lx-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.6rem}
.lx-from{display:flex;align-items:baseline;gap:.4rem;font-variant-numeric:tabular-nums}
.lx-from span{color:var(--muted)}
.lx-from b{font-size:clamp(1.6rem,1.2rem + 1vw,2.2rem);font-weight:700;letter-spacing:-.045em}
.lx-link{font-weight:600;text-decoration-color:var(--rule)}
.lx-shot{position:relative;width:min(100% - 2rem,80rem);margin:clamp(2rem,1.5rem + 3vw,4rem) auto 0}
.lx-shot-in{overflow:hidden;border-radius:6px;aspect-ratio:4/3;background:var(--surface)}
@media (min-width:48rem){.lx-shot-in{aspect-ratio:16/9}}
.lx-shot-img{width:100%;height:100%;object-fit:cover}
.lx-tag{display:none}
html.m .lx-hero{--p:0;height:240vh;height:240svh}
html.m .lx-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;align-content:start;padding-top:calc(3.5rem + clamp(1rem,.5rem + 3vh,3rem))}
html.m .lx-copy{z-index:0;transform:translate3d(0,calc(var(--p) * -10vh),0);opacity:calc(1 - var(--p) * 2.4)}
html.m .lx-shot{z-index:1;position:absolute;left:0;right:0;top:3.5rem;bottom:0;width:auto;margin:0 auto;max-width:100%;transform-origin:50% 0;transform:translate3d(0,calc((1 - var(--p)) * 58vh),0) scale(calc(.62 + var(--p) * .38))}
@media (min-width:48rem){html.m .lx-shot{transform:translate3d(0,calc((1 - var(--p)) * 56vh),0) scale(calc(.5 + var(--p) * .5))}}
html.m .lx-shot-in{height:100%;aspect-ratio:auto;border-radius:calc(10px - var(--p) * 10px)}
html.m .lx-shot-img{transform:scale(calc(1.16 - var(--p) * .16))}
html.m .lx-tag{position:absolute;left:clamp(1rem,3vw,2.5rem);bottom:clamp(1rem,3vw,2.5rem);display:flex;gap:1.2rem;padding:.7rem 1rem;border-radius:4px;background:var(--bg);font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;opacity:calc((var(--p) - .78) * 5)}
.lx-tag span+span{color:var(--muted)}
/* the details: big hairline rows beside a tall photo */
.lx-spec-in{display:grid;gap:clamp(2rem,1rem + 3vw,4rem)}
@media (min-width:56rem){.lx-spec-in{grid-template-columns:5fr 7fr;align-items:start}.lx-spec-media{position:sticky;top:5rem}}
.lx-spec-media{overflow:hidden;border-radius:6px;aspect-ratio:4/5;background:var(--surface)}
.lx-spec-img{width:100%;height:110%;margin-top:-5%;object-fit:cover}
.lx-spec-list ul{margin-top:clamp(1.8rem,1rem + 2vw,3rem);border-top:1px solid var(--ink)}
.lx-spec-list li{padding-block:clamp(1.1rem,.8rem + 1vw,1.8rem);border-bottom:1px solid var(--rule);font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 1.8vw,3rem);font-weight:600;line-height:1.05;letter-spacing:-.045em}
/* story */
.lx-story{border-top:1px solid var(--rule)}
.lx-story-in{display:grid;gap:1.5rem}
@media (min-width:56rem){.lx-story-in{grid-template-columns:3fr 9fr}}
.lx-side{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:-.01em;color:var(--muted)}
.lx-say{font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.2vw,3.4rem);font-weight:600;line-height:1.1;letter-spacing:-.045em;max-width:24ch}
.lx-say.more{margin-top:1.4rem;font-size:clamp(1.2rem,1rem + .8vw,1.7rem);line-height:1.3;max-width:34ch;color:var(--muted)}
/* wide photo */
.lx-wide-frame{overflow:hidden;aspect-ratio:4/5}
@media (min-width:48rem){.lx-wide-frame{aspect-ratio:21/9}}
.lx-wide-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.lx-wide-cap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 2rem;padding-top:1rem;font-size:.95rem;color:var(--muted)}
.lx-wide-cap span:first-child{color:var(--ink);font-weight:600}
/* buy */
.lx-buy-grid{display:grid;gap:clamp(2rem,1rem + 4vw,6rem);align-items:center}
@media (min-width:56rem){.lx-buy-grid{grid-template-columns:1.05fr .95fr}}
.lx-buy-media{overflow:hidden;border-radius:6px;aspect-ratio:1}
.lx-buy-img{width:100%;height:100%;object-fit:cover}
.lx-buy-copy{display:grid;justify-items:start}
.lx-price{display:flex;align-items:baseline;gap:.5rem;margin-top:1.2rem;font-variant-numeric:tabular-nums}
.lx-price span{color:var(--muted)}
.lx-price b{font-size:clamp(2.2rem,1.6rem + 2vw,3.4rem);letter-spacing:-.05em}
.lx-opts{display:grid;width:100%;margin-top:1.75rem;border-top:1px solid var(--ink)}
.lx-opts li{display:flex;align-items:baseline;gap:.8rem;padding:1rem 0;border-bottom:1px solid var(--rule)}
.lx-opts span{display:grid;gap:.1rem;font-weight:600;letter-spacing:-.02em}
.lx-opts small{font-size:.9rem;font-weight:400;color:var(--muted);letter-spacing:0}
.lx-opts i{flex:1;align-self:center;border-bottom:1px dotted color-mix(in srgb,var(--ink) 35%,transparent)}
.lx-opts strong{font-size:1.35rem;font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-variant-numeric:tabular-nums}
.lx-note{margin-top:.9rem;color:var(--muted)}
.lx-buy-cta{width:100%;margin-top:1.75rem}
.lx-big{min-height:3.9rem;padding-inline:2.6rem;font-size:1.1rem}
@media (max-width:39.99rem){.lx-big{width:100%}}
.lx-facts{display:grid;width:100%;margin-top:2rem}
.lx-facts div{display:grid;grid-template-columns:7rem minmax(0,1fr);gap:1rem;padding:.7rem 0;border-top:1px solid var(--rule)}
.lx-facts dt{font-weight:600}
.lx-facts dd{margin:0;color:var(--muted)}
.lx-facts a{color:var(--ink);font-weight:600}
.lx-form{width:100%;margin-top:1.75rem}
.lx-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--ink);padding:1.4rem 0 0}
.lx-faq{border-top:1px solid var(--rule)}
.lx-faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.lx-faq-grid{grid-template-columns:.75fr 1.25fr;gap:4rem;align-items:start}}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details{border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent}
.faq summary{padding:1.3rem 0;font-size:1.15rem;letter-spacing:-.02em}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.3rem}
.ftr{border-top:1px solid var(--rule)}
/* phone buy bar */
.lx-bar{align-items:center;gap:.8rem;background:var(--bg);box-shadow:none;border-top-color:var(--rule)}
.lx-bar .btn{flex:none;min-width:8.5rem}
.lx-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.lx-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.02em}
.lx-bar-t span{font-size:.9rem;color:var(--muted);font-variant-numeric:tabular-nums}
html.m .lx-bar{transform:translateY(120%);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
html.m .lx-bar.on{transform:none}
@media (prefers-reduced-motion:reduce){.lx-shot-img{transform:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Launch',
  bestFor: 'One hero product: a bottle, a candle, a gadget, a kit, sold with one Buy button',
  why: 'Built to sell one product: its name set across the page and snapping together, the product shot leaning toward you and growing to fill the screen as you scroll, the details as big hairline rows and the sizes set like a price list.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  // The motion, as data (lib/choreo.md): put together on stage, a product you can nudge, a shot that grows with the scroll.
  choreo: { intro: 'assemble', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'fast', look: 'launch keynote on steel and paper, precise' },
  tokens,
  slots,
  nav,
  render,
};
