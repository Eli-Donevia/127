// Market (animated, product): a small shop with several products, for makers who sell candles, jewelry, skincare,
// prints or clothes. The first products are dealt into a fan of cards beside the headline and lean toward the pointer;
// a ribbon of product names and prices runs under the hero; the shop is a grid of product cards (filter chips when the
// member grouped them) whose photos open up as they come in; the maker's story sits beside a wide photo, and shipping
// and returns are spelled out with a link to the policies page. Without a buy link every Buy becomes "Ask to order"
// and the page ends in an order form.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'market';
const MAX = 8;

function tokens(p) {
  return { bg: color.mix(p.paper, '#fbf7f1', 0.6), dark: color.mix(p.ink, '#000000', 0.5) };
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

function render(c0) {
  const list = products(c0);
  const order = { label: 'Ask to order', short: 'Order', href: '#order', kind: 'form' };
  const c = c0.buy ? c0 : { ...c0, primary: order };
  const buyLink = (s) => (c.buy ? { ...c.primary, label: 'Buy', href: c.buy.href } : { ...order, label: 'Ask to order' });
  const groups = [...new Set(list.map((s) => s.category).filter(Boolean))];
  const title = c.tagline ? c.tagline.replace(/[.!]+$/, '') : c.heroTitle;
  // The subline is whatever the hero words add to the headline, minus the shipping line (it sits by the button).
  const shipFirst = c.shipping ? c.shipping.split(/(?<=\.)\s/)[0].replace(/[.]+$/, '') : '';
  let sub = c.tagline && c.heroSub.startsWith(`${title}.`) ? c.heroSub.slice(title.length + 1).trim() : c.tagline ? c.heroSub : '';
  if (shipFirst && sub.includes(shipFirst)) sub = '';

  const fan = list.slice(0, 4);
  const hero = `<section class="mk-hero" aria-labelledby="hero-title">
<div class="wrap mk-hero-in${fan.length ? '' : ' solo'}">
<div class="mk-copy">
<p class="mk-eyebrow" data-rv>${esc(c.name)}${c.city ? ` · ${esc(c.city)}` : ''}</p>
<h1 id="hero-title" class="mk-title" data-split>${esc(title)}</h1>
${sub ? `<p class="mk-sub" data-rv style="--d:5">${esc(sub)}</p>` : ''}
<div class="mk-ctas" data-rv style="--d:7">
${P.button({ label: 'Shop the collection', href: '#shop', kind: 'anchor' }, 'btn btn-primary btn-lg').replace('<a ', '<a data-mag ')}
${shipFirst ? `<p class="mk-ship">${icon('truck', { size: 18 })}<span>${esc(shipFirst)}</span></p>` : ''}
</div>
</div>
${fan.length ? `<div class="mk-fan n${fan.length}" data-fan aria-hidden="true">${fan.map((s, i) => `<figure class="mk-card" style="--i:${i}">${P.img(c, `p${i + 1}`, { cls: 'mk-card-img', eager: i < 2 }).replace(/alt="[^"]*"/, 'alt=""')}<figcaption><span>${esc(s.name)}</span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</figcaption></figure>`).join('')}</div>` : ''}
</div>
</section>`;

  const ribbonItems = list.map((s) => `<li>${esc(s.name)}${s.priceText ? ` <b>${esc(s.priceText)}</b>` : ''}</li><li class="dot" aria-hidden="true">${icon('spark', { size: 12 })}</li>`).join('');
  const ribbon = list.length > 1
    ? `<div class="mk-ribbon mq" aria-hidden="true"><ul class="mq-track"><li class="mq-set"><ul>${ribbonItems}</ul></li><li class="mq-set"><ul>${ribbonItems}</ul></li></ul></div>`
    : '';

  const chips = groups.length > 1
    ? `<div class="mk-chips" role="group" aria-label="Show" data-rv><button type="button" class="chip" aria-pressed="true" data-f="">All</button>${groups.map((g) => `<button type="button" class="chip" aria-pressed="false" data-f="${esc(g)}">${esc(g)}</button>`).join('')}</div>`
    : '';
  const shop = `<section class="mk-sec mk-shop" id="shop" aria-labelledby="shop-title">
<div class="wrap">
<div class="mk-head"><h2 class="mk-h2" id="shop-title" data-split>${esc(list.length > 1 ? 'The collection' : 'The shop')}</h2>${chips}</div>
${list.length ? '' : `<p class="mk-sub" data-rv>Ask what's in stock and we'll reply with what's ready to ship.</p><p class="mk-empty" data-rv style="--d:1">${P.button(c.buy ? { ...c.primary } : order, 'btn btn-primary btn-lg')}</p>`}
${list.length ? '<ul class="mk-grid">' : ''}
${list
  .map(
    (s, i) => `<li class="mk-item" data-g="${esc(s.category || '')}" data-rv style="--d:${i % 4}">
<div class="mk-ph" data-rv="mask">${P.img(c, `p${i + 1}`, { cls: 'mk-ph-img', sizes: '(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw' })}</div>
<div class="mk-meta"><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="mk-price">${esc(s.priceText)}</p>` : ''}</div>
${s.blurb ? `<p class="mk-blurb">${esc(s.blurb)}</p>` : ''}
${P.button(buyLink(s), 'btn btn-ghost mk-buy')}
</li>`
  )
  .join('\n')}
${list.length ? '</ul>' : ''}
</div>
</section>`;

  const story = `<section class="mk-sec mk-story" id="story" aria-labelledby="story-title">
<div class="wrap mk-story-grid">
<div class="mk-story-ph" data-rv="mask">${P.img(c, 'maker', { cls: 'mk-story-img' }).replace('<img ', '<img data-par="0.06" ')}</div>
<div>
<p class="mk-eyebrow" data-rv>${esc(c.owner && c.owner !== c.name ? `${c.owner}, ${c.name}` : 'Our story')}</p>
<h2 class="mk-h2" id="story-title" data-split>${esc(c.owner ? 'Made by hand, in small batches.' : 'How it is made.')}</h2>
${c.aboutParas.map((p, i) => `<p class="mk-say" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
</div>
</div>
</section>`;

  const policyLink = c.buy ? ' <a href="policies.html">Full shipping and returns policy</a>' : '';
  const shipping = c.shipping || c.returns
    ? `<section class="mk-sec mk-pol" id="shipping" aria-labelledby="shipping-title">
<div class="wrap">
<h2 class="mk-h2 mk-h2s" id="shipping-title" data-rv>Shipping and returns</h2>
<ul class="mk-pol-grid">
${c.shipping ? `<li data-rv data-spot>${icon('truck', { size: 22 })}<h3>Shipping</h3><p>${esc(c.shipping)}</p></li>` : ''}
${c.returns ? `<li data-rv data-spot style="--d:1">${icon('refresh', { size: 22 })}<h3>Returns</h3><p>${esc(c.returns)}</p></li>` : ''}
${c.email ? `<li data-rv data-spot style="--d:2">${icon('mail', { size: 22 })}<h3>Questions</h3><p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p></li>` : ''}
</ul>
${policyLink ? `<p class="mk-pol-more" data-rv>${policyLink.trim()}</p>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="mk-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="mk-h2 mk-h2s" id="reviews-title" data-rv>What people say</h2><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="mk-sec mk-faq" id="faq" aria-labelledby="faq-title"><div class="wrap mk-faq-grid"><h2 class="mk-h2 mk-h2s" id="faq-title" data-rv>Questions</h2><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const orderSec = c.buy
    ? ''
    : `<section class="mk-sec mk-order" id="order" aria-labelledby="order-title"><div class="wrap mk-order-grid"><div><h2 class="mk-h2" id="order-title" data-split>Ask to order.</h2><p class="mk-sub" data-rv style="--d:2">Tell us what you'd like and where it's going, and we'll reply with the total and how to pay.</p></div><div data-rv style="--d:3">${P.form(c, { id: 'order', fields: ['name', 'email', { ...P.FIELD_PRESETS.message, label: 'What you would like' }], submit: 'Send my order request', subject: `Order request for ${c.name}` })}</div></div></section>`;

  const bar = `<nav class="mbar mk-bar" aria-label="Shop ${esc(c.name)}"><div class="mk-bar-t"><strong>${esc(c.name)}</strong>${list.length ? `<span>${list.length} ${list.length === 1 ? 'product' : 'products'}</span>` : ''}</div>${P.button({ label: 'Shop', href: '#shop', kind: 'anchor' }, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'mk-hdr', ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, ribbon, shop, story, shipping, reviews, faq, orderSec, '</main>', P.footer(c), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '22px', radiusSm: '12px', btnRadius: '999px', max: '76rem' } };
}

// The fan leans toward the pointer; filter chips show one group. Chips work with motion off too.
const JS = `(function(){var d=document;
[].slice.call(d.querySelectorAll('.mk-chips .chip')).forEach(function(b,_,all){b.addEventListener('click',function(){var f=b.getAttribute('data-f');all.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});[].slice.call(d.querySelectorAll('.mk-item')).forEach(function(it){it.hidden=!!f&&it.getAttribute('data-g')!==f})})});
var fan=d.querySelector('[data-fan]');if(!fan||matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(pointer:fine)').matches)return;
var t=false,x=0,y=0;addEventListener('pointermove',function(e){x=e.clientX/innerWidth-.5;y=e.clientY/innerHeight-.5;if(!t){t=true;requestAnimationFrame(function(){t=false;fan.style.setProperty('--tx',x.toFixed(3));fan.style.setProperty('--ty',y.toFixed(3))})}},{passive:true})})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{background:var(--bg)}
h1,h2,h3{font-weight:600;letter-spacing:-.025em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.btn-ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.btn-ghost:hover{border-color:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.5rem}
.brand{display:flex;align-items:center;gap:.6rem;margin-right:auto;font-family:var(--font-display);font-size:1.15rem;font-weight:600;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:2rem;height:2rem;border-radius:50%;background:var(--primary);color:var(--on-primary);font-family:var(--font-body);font-size:.7rem;font-weight:700;letter-spacing:0}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.9rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.mk-eyebrow{font-size:.85rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--primary-text)}
.mk-h2{margin-top:.5rem;font-family:var(--font-display);font-size:clamp(2.3rem,1.5rem + 3.6vw,4.6rem);font-weight:500;line-height:1;letter-spacing:-.03em;text-wrap:balance}
.mk-h2s{font-size:clamp(1.9rem,1.4rem + 2vw,3rem)}
.mk-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.mk-sub{margin-top:1.1rem;max-width:34rem;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);line-height:1.5;color:var(--muted)}
/* hero and the fan of product cards */
.mk-hero{overflow:hidden;padding-block:clamp(2.5rem,1.5rem + 5vw,6rem) clamp(3rem,2rem + 4vw,6rem)}
.mk-hero-in{display:grid;gap:clamp(2.5rem,1.5rem + 4vw,5rem);align-items:center}
@media (min-width:60rem){.mk-hero-in:not(.solo){grid-template-columns:1fr 1fr}}
.mk-empty{margin-top:1.5rem}
.mk-title{margin-top:.8rem;font-family:var(--font-display);font-size:clamp(2.9rem,1.6rem + 5.6vw,6.4rem);font-weight:500;line-height:.98;letter-spacing:-.035em;text-wrap:balance}
.mk-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.5rem;margin-top:clamp(1.5rem,1rem + 1.5vw,2.4rem)}
.mk-ship{display:flex;align-items:center;gap:.5rem;font-size:.95rem;color:var(--muted)}
.mk-ship .i{color:var(--primary-text);flex:none}
.mk-fan{--tx:0;--ty:0;position:relative;height:clamp(22rem,16rem + 22vw,34rem);margin-inline:auto;width:min(100%,34rem)}
.mk-card{--r:0deg;--x:0%;--y:0%;position:absolute;left:50%;top:50%;width:52%;margin:0;border-radius:var(--radius);overflow:hidden;background:var(--surface);box-shadow:0 2px 0 color-mix(in srgb,var(--ink) 5%,transparent),0 40px 70px -40px color-mix(in srgb,var(--ink) 55%,transparent);transform:translate(-50%,-50%) translate(var(--x),var(--y)) rotate(var(--r))}
.mk-card-img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}
.mk-card figcaption{display:flex;justify-content:space-between;gap:.5rem;padding:.7rem .9rem;font-size:.85rem;font-weight:600}
.mk-card figcaption span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mk-card figcaption strong{color:var(--primary-text);font-weight:600}
.n1 .mk-card{--r:-3deg}
.n2 .mk-card:nth-child(1){--r:-8deg;--x:-22%}.n2 .mk-card:nth-child(2){--r:6deg;--x:22%;--y:4%}
.n3 .mk-card:nth-child(1){--r:-12deg;--x:-40%;--y:6%}.n3 .mk-card:nth-child(2){--r:0deg;--y:-4%;z-index:2}.n3 .mk-card:nth-child(3){--r:11deg;--x:40%;--y:7%}
.n4 .mk-card:nth-child(1){--r:-15deg;--x:-44%;--y:10%}.n4 .mk-card:nth-child(2){--r:-5deg;--x:-17%;--y:-2%;z-index:2}.n4 .mk-card:nth-child(3){--r:5deg;--x:17%;--y:-2%;z-index:3}.n4 .mk-card:nth-child(4){--r:14deg;--x:44%;--y:10%}
@media (max-width:39.99rem){.mk-fan{height:clamp(17rem,62vw,21rem)}.mk-card{width:44%}.n4 .mk-card:nth-child(1){--x:-36%}.n4 .mk-card:nth-child(2){--x:-12%}.n4 .mk-card:nth-child(3){--x:12%}.n4 .mk-card:nth-child(4){--x:36%}.n3 .mk-card:nth-child(1){--x:-30%}.n3 .mk-card:nth-child(3){--x:30%}}
html.m .mk-card{animation:mkDeal 1.2s cubic-bezier(.16,1,.3,1) calc(.35s + var(--i) * 110ms) both;transition:transform .9s cubic-bezier(.2,.8,.2,1)}
html.m .mk-fan .mk-card{transform:translate(-50%,-50%) translate(calc(var(--x) + var(--tx) * 18px * (var(--i) + 1)),calc(var(--y) + var(--ty) * 12px * (var(--i) + 1))) rotate(calc(var(--r) + var(--tx) * 4deg))}
html.m .mk-fan:hover .mk-card:hover{z-index:5}
@keyframes mkDeal{from{opacity:0;transform:translate(-50%,-30%) rotate(0deg) scale(.9)}}
/* ribbon of products */
.mk-ribbon{--mq-speed:46s;border-block:1px solid var(--line);background:var(--surface)}
.mk-ribbon ul{display:flex;align-items:center;list-style:none;margin:0;padding:0}
.mk-ribbon li{flex:none;padding:1rem 1.1rem;font-family:var(--font-display);font-size:clamp(1.1rem,1rem + .6vw,1.5rem);white-space:nowrap}
.mk-ribbon b{font-family:var(--font-body);font-size:.85em;font-weight:600;color:var(--primary-text)}
.mk-ribbon .dot{padding-inline:.2rem;color:var(--primary-text)}
/* shop grid */
.mk-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:1.25rem 2rem;margin-bottom:clamp(2rem,1.5rem + 2vw,3.25rem)}
.mk-chips{display:flex;flex-wrap:wrap;gap:.5rem}
.chip{min-height:2.75rem;padding:.4rem 1.1rem;border:1.5px solid var(--line);border-radius:999px;background:transparent;color:var(--ink);font:inherit;font-size:.92rem;font-weight:500;cursor:pointer;transition:background-color .2s ease,border-color .2s ease,color .2s ease}
.chip:hover{border-color:var(--ink)}
.chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.mk-grid{display:grid;gap:clamp(1.75rem,1rem + 2vw,2.75rem) clamp(1rem,.75rem + 1vw,1.75rem);grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))}
.mk-item{display:flex;flex-direction:column;gap:.55rem;min-width:0}
.mk-ph{overflow:hidden;border-radius:var(--radius);background:var(--surface)}
.mk-ph-img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;transition:transform 1.2s cubic-bezier(.16,1,.3,1)}
.mk-item:hover .mk-ph-img{transform:scale(1.045)}
.mk-meta{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-top:.45rem}
.mk-meta h3{font-family:var(--font-display);font-size:1.3rem;font-weight:500;letter-spacing:-.015em}
.mk-price{font-weight:600;white-space:nowrap}
.mk-blurb{color:var(--muted);font-size:.95rem}
.mk-buy{align-self:flex-start;margin-top:.35rem;min-height:2.75rem;padding-inline:1.3rem}
/* story */
.mk-story{background:var(--dark);color:var(--on-dark)}
.mk-story .mk-eyebrow{color:var(--primary-on-dark)}
.mk-story-grid{display:grid;gap:clamp(2rem,1rem + 4vw,5rem);align-items:center}
@media (min-width:56rem){.mk-story-grid{grid-template-columns:1.1fr .9fr}}
.mk-story-ph{overflow:hidden;border-radius:var(--radius);aspect-ratio:4/3}
.mk-story-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
.mk-say{margin-top:1.2rem;max-width:36rem;font-size:clamp(1.05rem,1rem + .35vw,1.25rem);line-height:1.6;color:var(--muted-on-dark)}
/* shipping and returns */
.mk-pol-grid{display:grid;gap:1rem;margin-top:clamp(1.75rem,1.25rem + 1.5vw,2.75rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))}
.mk-pol-grid li{--spot:color-mix(in srgb,var(--primary) 14%,transparent);display:grid;gap:.5rem;align-content:start;padding:clamp(1.4rem,1.1rem + 1vw,2rem);border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
.mk-pol-grid .i{color:var(--primary-text)}
.mk-pol-grid h3{font-size:1.15rem}
.mk-pol-grid p{color:var(--muted)}
.mk-pol-grid a,.mk-pol-more a{color:var(--ink);font-weight:600}
.mk-pol-more{margin-top:1.4rem}
.mk-faq{border-top:1px solid var(--line)}
.mk-faq-grid,.mk-order-grid{display:grid;gap:2rem}
@media (min-width:60rem){.mk-faq-grid,.mk-order-grid{grid-template-columns:.8fr 1.2fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.25rem 0;font-size:1.1rem}
.faq .ans{padding:0 0 1.25rem}
.mk-order{background:var(--surface)}
.ftr{background:var(--surface);border-top:1px solid var(--line)}
/* phone shop bar */
.mk-bar{align-items:center;gap:.8rem;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px)}
.mk-bar .btn{flex:none;min-width:7.5rem}
.mk-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.mk-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mk-bar-t span{font-size:.9rem;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.mk-card,.mk-ph-img,.mk-story-img{animation:none!important;transition:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Market',
  bestFor: 'A small shop with several products: candles, jewelry, skincare, prints, clothes',
  why: 'Built for a shop with several products: your best sellers dealt into a fan beside the headline, a ribbon of names and prices, a product grid with filters, your story, and shipping and returns spelled out.',
  match: /\b(candles?|soap|jewel(le)?ry|earrings?|necklaces?|skin ?care|serums?|cosmetics|makeup|apparel|clothing|clothes|t-?shirts?|tees|hoodies|merch|prints?|posters?|stickers?|ceramics?|pottery|mugs?|handmade|hand-?made|hand-?poured|crochet|knit|boutique|shop|store|bakery|cookies|treats|coffee beans|roaster|tea|sauces?|spices?|gifts?|plants?|stationery)\b/,
  fonts: { q: 'family=Fraunces:opsz,wght@9..144,400..600&family=Hanken+Grotesk:wght@400;500;600;700', display: ['Fraunces', 'serif'], body: ['Hanken Grotesk', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
