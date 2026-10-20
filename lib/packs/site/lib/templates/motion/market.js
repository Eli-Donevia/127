// Market (animated, product): a small shop with several products, for makers who sell candles, jewelry, skincare,
// prints or clothes.
//   Object: the shop shelf. The first products stand on one long ledge under the headline, each with its shelf label
//   (name, size, price) printed underneath, the way a good shop labels the edge of a shelf.
//   Material: unbleached paper and a dark ledge in the member's ink: big quiet product photos, labels set in a
//   condensed grotesk, prices in tabular figures, hairline rules. No cards, no shadows, no pills.
//   One move: assemble. The headline sets itself letter by letter, then the products are set down on the ledge one
//   at a time; further down, each row of the collection settles onto its shelf as you scroll.
//   Pop: the member's colour as the line under the headline's last word, the price of the product under the pointer,
//   and the line under the chosen group.
// Below the hero: the collection on shelves (the member's groups as plain text tabs), the maker's story beside a wide
// photo, shipping and returns as three plain columns with a link to the policies page, kind words, questions. Without
// a buy link every Buy becomes "Ask to order" and the page ends in an order form. Its motion is the `choreo` block at
// the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');

const id = 'market';
const MAX = 8;

function tokens(p) {
  return { bg: color.mix(p.paper, '#f1f1ef', 0.9), dark: color.mix(p.ink, '#000000', 0.5) };
}

const products = (c) => c.services.filter((s) => s.name).slice(0, MAX);

function slots(c) {
  const g = c.profile.gallery || [];
  const list = products(c);
  return [
    ...list.map((s, i) => ({ slot: `p${i + 1}`, file: `product-${i + 1}.jpg`, w: 1000, h: 1250, style: 'object', alt: s.name })),
    { slot: 'maker', file: 'maker.jpg', w: 1600, h: 1100, style: 'sweep', alt: g[0] && !/^the product/i.test(g[0]) ? g[0] : `${c.owner || c.name} at work` },
  ];
}

function nav(c) {
  return [
    { label: 'Shop', href: '#shop' },
    { label: 'Story', href: '#story' },
    (c.shipping || c.returns) && { label: 'Shipping', href: '#shipping' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

// The shelf in the hero: column widths and photo shapes by how many products stand on it.
const SHELF = { 1: ['8fr', '4fr'], 2: ['7fr', '4.5fr'], 3: ['6fr', '3.6fr', '4.4fr'], 4: ['5fr', '3fr', '4fr', '3.2fr'] };
const SHAPE = { 1: ['4/3'], 2: ['4/3', '1/1'], 3: ['4/5', '3/4', '1/1'], 4: ['4/5', '3/4', '1/1', '4/5'] };

function render(c0) {
  const list = products(c0);
  const order = { label: 'Ask to order', short: 'Order', href: '#order', kind: 'form' };
  const c = c0.buy ? c0 : { ...c0, primary: order };
  const buyLink = (s) => (c.buy ? { ...c.primary, label: `Buy ${s.name}`, href: c.buy.href } : { ...order, label: `Ask about ${s.name}` });
  const groups = [...new Set(list.map((s) => s.category).filter(Boolean))];
  const title = c.tagline ? c.tagline.replace(/[.!]+$/, '') : c.heroTitle;
  // The subline is whatever the hero words add to the headline, minus the shipping line (it sits by the button).
  const shipFirst = c.shipping ? c.shipping.split(/(?<=\.)\s/)[0].replace(/[.]+$/, '') : '';
  let sub = c.tagline && c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.tagline ? c.heroSub : '';
  if (shipFirst && sub.includes(shipFirst)) sub = '';
  // The headline is sized from its length, so its line count is settled before the font arrives.
  const k = Math.min(11, 480 / Math.max(title.length, 12)).toFixed(2);
  const km = Math.min(17, 720 / Math.max(title.length, 12)).toFixed(2);
  const price = (s) => (s.priceText ? `<span class="mk-pr">${esc(s.priceText)}</span>` : '');
  const detail = (s) => [s.duration, s.blurb].filter(Boolean).join(', ');

  const fan = list.slice(0, 4);
  const cols = SHELF[fan.length] || SHELF[1];
  const shelf = fan.length
    ? `<div class="mk-shelf n${fan.length}" data-ci="subject" style="--cols:${cols.join(' ')}" aria-label="On the shelf" role="group">
<span class="mk-ledge" aria-hidden="true"></span>
${fan
  .map(
    (s, i) => `<figure class="mk-on" style="grid-column:${i + 1};--i:${i};--ar:${SHAPE[fan.length][i]}"><div class="mk-stand"><div class="mk-ph" data-alive="${[0.7, 0.9, 0.8, 1][i]}">${P.img(c, `p${i + 1}`, { cls: 'mk-img', eager: i < 2, sizes: '(min-width: 56rem) 36vw, 55vw' })}</div></div>
<figcaption class="mk-tag"><span class="mk-nm">${esc(s.name)}</span>${price(s)}${detail(s) ? `<span class="mk-dt">${esc(detail(s))}</span>` : ''}</figcaption></figure>`
  )
  .join('\n')}
</div>`
    : `<figure class="mk-solo" data-ci="subject"><div class="mk-ph">${P.img(c, 'maker', { cls: 'mk-img', eager: true })}</div></figure>`;

  const hero = `<section class="mk-hero" aria-labelledby="hero-title">
<div class="wrap">
<div class="mk-top">
<h1 id="hero-title" class="mk-title" data-ci="head" style="--k:${k}vw;--km:${km}vw">${esc(title)}</h1>
<div class="mk-aside${sub ? '' : ' nosub'}" data-ci="then">
${sub ? `<p class="mk-sub">${esc(sub)}</p>` : ''}
<div class="mk-ctas">${P.button({ label: list.length ? 'Shop the collection' : c.primary.label, href: list.length ? '#shop' : c.primary.href, kind: 'anchor' }, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}</div>
${shipFirst ? `<p class="mk-ship">${esc(shipFirst)}</p>` : ''}
</div>
</div>
${shelf}
</div>
</section>`;

  const tabs = groups.length > 1
    ? `<div class="mk-tabs" role="group" aria-label="Show" data-rv><button type="button" class="mk-tab" aria-pressed="true" data-f="">All</button>${groups.map((g) => `<button type="button" class="mk-tab" aria-pressed="false" data-f="${esc(g)}">${esc(g)}</button>`).join('')}</div>`
    : '';
  const shop = `<section class="mk-sec mk-shop" id="shop" aria-labelledby="shop-title"${list.length > 1 ? ' data-sc' : ''}>
<div class="wrap">
<div class="mk-head"><h2 class="mk-h2" id="shop-title" data-split>${esc(list.length > 1 ? 'The collection' : 'The shop')}</h2>${list.length ? `<p class="mk-count" data-rv>${list.length} ${list.length === 1 ? 'piece' : 'pieces'}</p>` : ''}${tabs}</div>
${list.length ? '' : `<p class="mk-sub" data-rv>Ask what's in stock and we'll reply with what's ready to ship.</p><p class="mk-empty" data-rv style="--d:1">${P.button(c.buy ? { ...c.primary } : order, 'btn btn-primary btn-lg')}</p>`}
${list.length ? '<ul class="mk-grid">' : ''}
${list
  .map(
    (s, i) => `<li class="mk-item" data-g="${esc(s.category || '')}" data-sc-part style="--i:${i % 3}">
<div class="mk-stand"><div class="mk-ph">${P.img(c, `p${i + 1}`, { cls: 'mk-img', sizes: '(min-width: 56rem) 30vw, 50vw' })}</div></div>
<div class="mk-tag"><h3 class="mk-nm">${esc(s.name)}</h3>${price(s)}${detail(s) ? `<p class="mk-dt">${esc(detail(s))}</p>` : ''}</div>
${P.button(buyLink(s), 'mk-buy').replace(/>([^<]*)<\/a>$/, `><span>${c.buy ? 'Buy' : 'Ask to order'}</span><span class="sr-only"> ${esc(s.name)}</span>${icon('arrowUpRight', { size: 16 })}</a>`).replace(/ aria-label="[^"]*"/, '')}
</li>`
  )
  .join('\n')}
${list.length ? '</ul>' : ''}
</div>
</section>`;

  const person = c.owner && c.owner !== c.name ? c.owner : '';
  const story = `<section class="mk-sec mk-story" id="story" aria-labelledby="story-title">
<div class="wrap mk-story-grid">
<figure class="mk-story-ph" data-rv="mask"><div>${P.img(c, 'maker', { cls: 'mk-story-img' }).replace('<img ', '<img data-par="0.06" ')}</div></figure>
<div class="mk-story-copy">
<h2 class="mk-h2" id="story-title" data-split>${esc(person ? `Meet ${person}.` : `About ${c.name}.`)}</h2>
${c.aboutParas.map((p, i) => `<p class="mk-say${i === 0 ? ' first' : ''}" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'mk-soc' })}
</div>
</div>
</section>`;

  const policyLink = c.buy ? '<a href="policies.html">Full shipping and returns policy</a>' : '';
  const pol = [
    c.shipping && { h: 'Shipping', p: esc(c.shipping) },
    c.returns && { h: 'Returns', p: esc(c.returns) },
    c.email && { h: 'Questions', p: `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` },
  ].filter(Boolean);
  const shipping = c.shipping || c.returns
    ? `<section class="mk-sec mk-pol" id="shipping" aria-labelledby="shipping-title">
<div class="wrap">
<h2 class="mk-h2" id="shipping-title" data-split>Shipping and returns</h2>
<dl class="mk-pol-grid">${pol.map((x, i) => `<div data-rv style="--d:${i}"><dt>${x.h}</dt><dd>${x.p}</dd></div>`).join('')}</dl>
${policyLink ? `<p class="mk-pol-more" data-rv>${policyLink}</p>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="mk-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="mk-h2" id="reviews-title" data-split>Kind words</h2><div class="mk-quotes">${c.reviews.map((r, i) => `<figure class="mk-q" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="mk-sec mk-faq" id="faq" aria-labelledby="faq-title"><div class="wrap mk-faq-grid"><h2 class="mk-h2" id="faq-title" data-split>Questions</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const orderSec = c.buy
    ? ''
    : `<section class="mk-sec mk-order" id="order" aria-labelledby="order-title"><div class="wrap mk-order-grid"><div><h2 class="mk-h2" id="order-title" data-split>Ask to order.</h2><p class="mk-sub" data-rv style="--d:2">Tell us what you'd like and where it's going, and we'll reply with the total and how to pay.</p></div><div data-rv style="--d:3">${P.form(c, { id: 'order', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What you would like' }], submit: 'Send my order request', subject: `Order request for ${c.name}` })}</div></div></section>`;

  const bar = `<nav class="mbar mk-bar" aria-label="Shop ${esc(c.name)}"><div class="mk-bar-t"><strong>${esc(c.name)}</strong>${list.length ? `<span>${list.length} ${list.length === 1 ? 'piece' : 'pieces'}</span>` : ''}</div>${P.button({ label: 'Shop', href: '#shop', kind: 'anchor' }, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'mk-hdr', ctaCls: 'btn btn-primary btn-sm', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, shop, story, shipping, reviews, faq, orderSec, '</main>', P.footer(c), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '84rem' } };
}

// The group tabs show one group. They work with motion off too.
const JS = `(function(){var d=document;
[].slice.call(d.querySelectorAll('.mk-tabs .mk-tab')).forEach(function(b,_,all){b.addEventListener('click',function(){var f=b.getAttribute('data-f');all.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});[].slice.call(d.querySelectorAll('.mk-item')).forEach(function(it){it.hidden=!!f&&it.getAttribute('data-g')!==f})})})})();`;

// Fallback faces sized to the real ones, so a late font swaps in without moving a line.
const CSS = `
${FOOTER_CSS}
@font-face{font-family:'Market Display Fallback';font-weight:400 800;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:60.5%}
@font-face{font-family:'Market Body Fallback';font-weight:400 700;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:100.7%}
html:root{--font-display:"Bricolage Grotesque","Market Display Fallback",sans-serif;--font-body:"Figtree","Market Body Fallback",sans-serif;--ease:cubic-bezier(.16,1,.3,1)}
body{background:var(--bg);--ledge:color-mix(in srgb,var(--ink) 86%,var(--primary));--edge:color-mix(in srgb,var(--ink) 14%,transparent)}
h1,h2,h3{font-weight:600;letter-spacing:-.02em}
.btn{font-weight:600;box-shadow:none}
.btn:hover{transform:none}
.btn-sm{min-height:2.5rem;padding:.45rem 1.05rem;font-size:.9rem}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.75rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.3rem;font-weight:700;font-stretch:80%;letter-spacing:-.01em;text-decoration:none}
.nav ul{display:flex;gap:1.5rem}
.nav a{display:block;padding:.4rem 0;font-size:.95rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.menu>summary{border-radius:0}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.mk-h2{font-family:var(--font-display);font-size:clamp(2.4rem,1.5rem + 3.8vw,5rem);font-weight:600;font-stretch:78%;line-height:.95;letter-spacing:-.02em;text-wrap:balance}
.mk-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.mk-sub{max-width:30rem;font-size:clamp(1.08rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
/* hero: the headline, then the shelf */
.mk-hero{overflow:clip;padding-top:clamp(2rem,1.5rem + 3vw,4.5rem)}
.mk-top{display:grid;gap:1.5rem}
@media (min-width:56rem){.mk-top{grid-template-columns:repeat(12,minmax(0,1fr));gap:2rem 1.5rem;align-items:end}.mk-title{grid-column:1/13}.mk-aside{grid-column:1/13;grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:center}.mk-aside .mk-sub{grid-column:1/6}.mk-aside .mk-ctas{grid-column:7/10;justify-self:start;white-space:nowrap}.mk-aside .mk-ship{grid-column:10/13}.mk-aside.nosub .mk-ctas{grid-column:1/5}.mk-aside.nosub .mk-ship{grid-column:5/9}}
.mk-title{font-family:var(--font-display);font-size:clamp(2.6rem,var(--km),5.5rem);font-weight:600;font-stretch:76%;line-height:.9;letter-spacing:-.025em;text-wrap:balance}
@media (min-width:56rem){.mk-title{font-size:clamp(3.5rem,var(--k),10rem)}}
.mk-aside{display:grid;gap:1.25rem;justify-items:start}
.mk-ship{padding-top:.75rem;border-top:1px solid var(--edge);font-size:.95rem;color:var(--muted);width:100%;max-width:22rem}
.mk-shelf{position:relative;display:grid;grid-template-columns:var(--cols);grid-template-rows:auto auto;margin-top:clamp(2.5rem,1.5rem + 4vw,5rem)}
.mk-ledge{grid-row:1;grid-column:1/-1;align-self:end;height:.5rem;margin-inline:calc(50% - 50vw);background:var(--ledge)}
.mk-on{display:grid;grid-row:1/span 2;grid-template-rows:subgrid;margin:0;min-width:0}
.mk-stand{display:flex;align-items:flex-end;padding:0 clamp(.5rem,.25rem + 1vw,1.25rem) .5rem}
.mk-on:first-of-type .mk-stand,.mk-on:first-of-type .mk-tag{padding-left:0}
.mk-on:last-of-type .mk-stand,.mk-on:last-of-type .mk-tag{padding-right:0}
.mk-ph{width:100%;overflow:hidden;background:var(--surface)}
.mk-on .mk-ph{aspect-ratio:var(--ar)}
.mk-img{display:block;width:100%;height:100%;object-fit:cover}
.mk-tag{display:grid;grid-template-columns:1fr auto;gap:.15rem 1rem;align-content:start;padding:.85rem clamp(.5rem,.25rem + 1vw,1.25rem) 0}
.mk-nm{font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .5vw,1.5rem);font-weight:600;font-stretch:80%;line-height:1.1;letter-spacing:-.01em}
.mk-pr{font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .5vw,1.5rem);font-weight:500;font-stretch:80%;font-variant-numeric:tabular-nums;line-height:1.1;transition:color .25s ease}
.mk-dt{grid-column:1/-1;font-size:.9rem;color:var(--muted)}
.mk-solo{margin:clamp(2.5rem,1.5rem + 4vw,5rem) 0 0}.mk-solo .mk-ph{aspect-ratio:21/9}
@media (max-width:55.99rem){.mk-solo .mk-ph{aspect-ratio:4/3}.mk-shelf.n3,.mk-shelf.n4{--cols:1.3fr 1fr!important}.mk-shelf .mk-on:nth-of-type(n+3){display:none}.mk-shelf.n3 .mk-on:nth-of-type(2) .mk-stand,.mk-shelf.n4 .mk-on:nth-of-type(2) .mk-stand,.mk-shelf.n3 .mk-on:nth-of-type(2) .mk-tag,.mk-shelf.n4 .mk-on:nth-of-type(2) .mk-tag{padding-right:0}}
html.ci-go .mk-on .mk-stand>.mk-ph{animation:mkSet .95s var(--ease) calc(.55s + var(--i) * .14s) both}
@keyframes mkSet{from{opacity:0;transform:translate3d(0,-2.2rem,0)}}
/* the collection, on shelves */
.mk-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:1rem 2rem;margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.mk-count{color:var(--muted);font-variant-numeric:tabular-nums}
.mk-tabs{display:flex;flex-wrap:wrap;gap:0 1.5rem;margin-left:auto}
.mk-tab{position:relative;min-height:2.75rem;padding:0;border:0;background:none;color:var(--muted);font:inherit;font-size:1rem;font-weight:500;cursor:pointer;transition:color .2s ease}
.mk-tab::after{content:'';position:absolute;left:0;right:0;bottom:.55rem;height:2px;background:var(--pop);transform:scaleX(0);transform-origin:0 50%;transition:transform .35s var(--ease)}
.mk-tab:hover{color:var(--ink)}
.mk-tab[aria-pressed=true]{color:var(--ink)}
.mk-tab[aria-pressed=true]::after{transform:none}
.mk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(3rem,2rem + 3vw,5rem) 0}
@media (min-width:56rem){.mk-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.mk-item{display:flex;flex-direction:column;min-width:0}
.mk-item .mk-stand{border-bottom:.5rem solid var(--ledge);padding-bottom:0}
.mk-item .mk-ph{aspect-ratio:4/5}
.mk-item .mk-tag{flex:1}
.mk-buy{display:inline-flex;align-items:center;gap:.35rem;align-self:flex-start;min-height:2.75rem;margin:.35rem clamp(.5rem,.25rem + 1vw,1.25rem) 0;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:.25em;text-decoration-thickness:1px}
.mk-buy:hover{text-decoration-thickness:2px}
.mk-item:hover .mk-pr,.mk-item:focus-within .mk-pr,.mk-on:hover .mk-pr{color:var(--pop)}
html.m .mk-shop[data-sc] .mk-item[data-sc-part]{transform:none}
html.m .mk-shop[data-sc] .mk-item[data-sc-part] .mk-ph{transform:translate3d(0,calc((var(--pi,1) - 1) * 2.4rem),0)}
/* story */
.mk-story{background:var(--dark);color:var(--on-dark);--muted:var(--muted-on-dark);--pop:var(--primary-on-dark);--focus:var(--primary-on-dark)}
.mk-story-grid{display:grid;gap:clamp(2rem,1rem + 4vw,5rem)}
@media (min-width:56rem){.mk-story-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:end}.mk-story-ph{grid-column:1/8}.mk-story-copy{grid-column:8/13}}
.mk-story-ph{margin:0}
.mk-story-ph>div{overflow:hidden;aspect-ratio:4/3}
.mk-story-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.mk-say{margin-top:1.1rem;max-width:34rem;font-size:1.08rem;line-height:1.65;color:var(--muted-on-dark)}
.mk-say.first{font-size:clamp(1.2rem,1.05rem + .6vw,1.5rem);line-height:1.45;color:var(--on-dark)}
.mk-soc{margin-top:1.5rem}
.mk-story .socials a{border-radius:0;border-color:var(--line-on-dark);color:var(--on-dark)}
/* shipping and returns */
.mk-pol-grid{display:grid;gap:0 1.5rem;margin:clamp(2rem,1.5rem + 2vw,3rem) 0 0;border-top:1px solid var(--ink)}
@media (min-width:48rem){.mk-pol-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.mk-pol-grid>div{display:grid;gap:.5rem;align-content:start;padding:1.25rem 0 1.5rem;border-bottom:1px solid var(--edge)}
.mk-pol-grid dt{font-family:var(--font-display);font-size:1.35rem;font-weight:600;font-stretch:80%}
.mk-pol-grid dd{margin:0;max-width:24rem;color:var(--muted)}
.mk-pol-grid a,.mk-pol-more a{color:var(--ink);font-weight:600}
.mk-pol-more{margin-top:1.5rem}
.mk-pol,.mk-faq,.mk-sec+.mk-sec:not(.mk-order){border-top:1px solid var(--edge)}
/* kind words */
.mk-quotes{display:grid;margin-top:clamp(2rem,1.5rem + 2vw,3rem);border-top:1px solid var(--ink)}
@media (min-width:56rem){.mk-quotes{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 1.5rem}}
.mk-q{display:grid;gap:.75rem;align-content:start;margin:0;padding:1.5rem 0 2rem;border-bottom:1px solid var(--edge)}
.mk-q blockquote{margin:0;font-family:var(--font-display);font-size:clamp(1.5rem,1.15rem + 1.4vw,2.3rem);font-weight:500;font-stretch:82%;line-height:1.12;letter-spacing:-.01em}
.mk-q figcaption{color:var(--muted)}
.mk-faq-grid,.mk-order-grid{display:grid;gap:2rem}
@media (min-width:60rem){.mk-faq-grid,.mk-order-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 1.5rem;align-items:start}.mk-faq-grid>h2,.mk-order-grid>div:first-child{grid-column:1/6}.mk-faq-grid>div,.mk-order-grid>div:last-child{grid-column:7/13}}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.08rem;font-weight:600}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.25rem}
.mk-order{background:var(--surface)}
.mk-order .mk-sub{margin-top:1.1rem}
.field input,.field select,.field textarea{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 45%,transparent);border-radius:0;background-color:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1px 0 var(--ink)}
.ftr{border-top:1px solid var(--edge)}
/* phone shop bar */
.mk-bar{align-items:center;gap:.8rem;background:var(--bg);box-shadow:none;border-top:1px solid var(--edge)}
.mk-bar .btn{flex:none;min-width:7.5rem}
.mk-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.mk-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mk-bar-t span{font-size:.9rem;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.mk-ph,.mk-story-img{animation:none!important;transition:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Market',
  bestFor: 'A small shop with several products: candles, jewelry, skincare, prints, clothes',
  why: 'Built for a shop with several products: your best sellers stand on a long shelf under the headline with their labels and prices, the collection settles onto its shelves as people scroll, then your story, and shipping and returns spelled out.',
  match: /\b(candles?|soap|jewel(le)?ry|earrings?|necklaces?|skin ?care|serums?|cosmetics|makeup|apparel|clothing|clothes|t-?shirts?|tees|hoodies|merch|prints?|posters?|stickers?|ceramics?|pottery|mugs?|handmade|hand-?made|hand-?poured|crochet|knit|boutique|shop|store|bakery|cookies|treats|coffee beans|roaster|tea|sauces?|spices?|gifts?|plants?|stationery)\b/,
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Figtree:wght@400;500;600', display: ['Bricolage Grotesque', 'grotesk'], body: ['Figtree', 'sans'] },
  // The motion, as data (lib/choreo.md): the counter set out piece by piece, then each shelf filling as you scroll.
  choreo: { intro: 'assemble', alive: ['pointer', 'tap'], scroll: 'scrub', pace: 'medium', look: 'a shop shelf in daylight, paper labels' },
  tokens,
  slots,
  nav,
  render,
};
