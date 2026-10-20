// Launch (animated, product): a one-product page in the spirit of a big product launch. The product's name is set
// huge and its letters rise in, then the product shot grows from under the name to fill the screen as you scroll
// (scroll-linked). The member's story lights up word by word, features sit in a bento grid with a light that follows
// the pointer, a wide photo opens up on scroll, and the price sits beside a magnetic Buy button. On phones a slim buy
// bar slides up once the hero has passed.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

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
    { label: 'Story', href: '#story' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
  ].filter(Boolean);
}

// The name, one letter per span so each can rise in; read as one word by screen readers.
function letters(s) {
  let i = 0;
  return String(s)
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="lw">${[...w].map((ch) => `<span class="ch" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`))
    .join('');
}

// Bento spans: the first feature is the big card with the photo, the rest fill full rows.
function bentoSpans(n) {
  if (n === 1) return ['big full'];
  if (n === 2) return ['big', 'tall'];
  const out = ['big', 'side', 'side'];
  const rest = n - 3;
  const rows = Math.floor(rest / 3);
  for (let i = 0; i < rows * 3; i++) out.push('third');
  if (rest % 3 === 1) out.push('full');
  if (rest % 3 === 2) out.push('half', 'half');
  return out;
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const buyBtn = (cls = 'btn btn-primary btn-lg') => P.button(buy, cls).replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const subMore = c.tagline && c.heroSub.startsWith(sub) ? c.heroSub.slice(sub.length).trim() : '';

  const hero = `<section class="lx-hero" aria-labelledby="hero-title">
<div class="lx-stage">
<div class="lx-copy">
${name !== c.name ? `<p class="lx-maker" data-rv>${esc(c.name)}</p>` : ''}
<h1 id="hero-title" class="lx-name${name.length > 14 ? ' long' : ''}" aria-label="${esc(name)}"><span aria-hidden="true">${letters(name)}</span></h1>
<p class="lx-sub" data-rv style="--d:6">${esc(sub)}${subMore ? ` <span>${esc(subMore)}</span>` : ''}</p>
<div class="lx-ctas" data-rv style="--d:8">
${buyBtn()}
${price ? `<p class="lx-from">${esc(price.text)}</p>` : c.secondary ? P.button(c.secondary, 'lx-link') : ''}
</div>
</div>
<div class="lx-shot">
<div class="lx-shot-in">${P.img(c, 'hero', { cls: 'lx-shot-img', eager: true })}</div>
<div class="lx-over" aria-hidden="true"><span>${esc(name)}</span>${price ? `<strong>${esc(price.text)}</strong>` : ''}</div>
</div>
</div>
</section>`;

  const story = `<section class="lx-sec lx-story" id="story" aria-labelledby="story-title">
<div class="wrap lx-narrow">
<h2 class="lx-eyebrow" id="story-title" data-rv>${esc(c.owner && c.owner !== c.name ? `From ${c.owner} at ${c.name}` : `From ${c.name}`)}</h2>
${c.aboutParas.map((p, i) => `<p class="lx-say${i ? ' more' : ''}" data-split>${esc(p)}</p>`).join('\n')}
</div>
</section>`;

  const spans = bentoSpans(c.included.length);
  const features = c.included.length
    ? `<section class="lx-sec lx-features" id="features" aria-labelledby="features-title">
<div class="wrap">
<div class="lx-head" data-rv><p class="lx-eyebrow">Features</p><h2 class="lx-h2" id="features-title" data-split>${esc(c.included.length > 1 ? 'The details.' : 'The detail.')}</h2></div>
<ul class="bento">
${c.included
  .map(
    (x, i) => `<li class="bx bx-${spans[i].replace(' ', ' bx-')}" data-spot data-rv="scale" style="--d:${i % 3}">
${i === 0 && c.included.length > 1 ? `<div class="bx-media" aria-hidden="true">${P.img(c, 'detail', { cls: 'bx-img' }).replace(/alt="[^"]*"/, 'alt=""').replace('<img ', '<img data-par="0.05" ')}</div>` : ''}
<span class="bx-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<p class="bx-t">${esc(x)}</p>
</li>`
  )
  .join('\n')}
</ul>
</div>
</section>`
    : '';

  const wide = `<section class="lx-wide" aria-label="${esc(name)}">
<div class="lx-wide-frame">${P.img(c, 'wide', { cls: 'lx-wide-img' }).replace('<img ', '<img data-par="0.07" ')}</div>
${c.shipping ? `<p class="lx-wide-cap" data-rv>${icon('truck', { size: 18 })}${esc(c.shipping.replace(/[.]+$/, ''))}</p>` : ''}
</section>`;

  const priced = c.services.filter((s) => s.name);
  const waitlist = buy.kind === 'form';
  const buySec = `<section class="lx-sec lx-buy${waitlist ? ' lx-wait' : ''}" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title">
<div class="wrap lx-buy-grid">
<div class="lx-buy-media" data-rv="mask">${P.img(c, 'hero', { cls: 'lx-buy-img' }).replace(/alt="[^"]*"/, 'alt=""')}</div>
<div class="lx-buy-copy">
<p class="lx-eyebrow" data-rv>${waitlist ? 'Waitlist' : 'Buy'}</p>
<h2 class="lx-h2" id="buy-title" data-split>${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist ? `<p class="lx-lead" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${price && priced.length < 2 ? `<p class="lx-price" data-rv style="--d:2">${esc(price.text)}</p>` : ''}
${priced.length > 1 ? `<ul class="lx-opts" data-rv style="--d:2">${priced.map((s) => `<li><span>${esc(s.name)}${s.blurb ? `<small>${esc(s.blurb)}</small>` : ''}</span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>` : ''}
${priced.length === 1 && priced[0].blurb ? `<p class="lx-note" data-rv style="--d:3">${esc(priced[0].blurb)}</p>` : ''}
${waitlist
  ? `<div class="lx-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="lx-buy-cta" data-rv style="--d:3">${buyBtn('btn btn-primary btn-lg lx-big')}</div>`}
<ul class="lx-facts" data-rv style="--d:4">
${c.shipping ? `<li>${icon('truck', { size: 18 })}<span>${esc(c.shipping)}</span></li>` : ''}
${c.email && !waitlist ? `<li>${icon('mail', { size: 18 })}<span>Questions? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span></li>` : ''}
${c.capacity ? `<li>${icon('bag', { size: 18 })}<span>${esc(c.capacity)}</span></li>` : ''}
</ul>
</div>
</div>
</section>`;

  const reviews = c.reviews.length
    ? `<section class="lx-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="lx-head" data-rv><p class="lx-eyebrow">Reviews</p><h2 class="lx-h2" id="reviews-title">What people say</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="lx-sec lx-faq" id="faq" aria-labelledby="faq-title"><div class="wrap lx-faq-grid"><div data-rv><p class="lx-eyebrow">FAQ</p><h2 class="lx-h2" id="faq-title">Questions.</h2></div><div data-rv style="--d:1">${P.faq(c.faq)}</div></div></section>`
    : '';

  const bar = `<nav class="mbar lx-bar" aria-label="Buy ${esc(name)}"><div class="lx-bar-t"><strong>${esc(name)}</strong>${price ? `<span>${esc(price.text)}</span>` : ''}</div>${P.button(buy, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'lx-hdr', ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, story, wide, buySec, reviews, faq, '</main>', P.footer(c), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '28px', radiusSm: '14px', btnRadius: '999px', max: '74rem' } };
}

// Scroll-linked pieces: the hero's progress (--p), the story's words lighting up, the wide photo opening (--q) and the
// phone buy bar. Off for reduced motion (the page then shows everything in place).
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,hero=d.querySelector('.lx-hero'),wide=d.querySelector('.lx-wide'),bar=d.querySelector('.lx-bar'),says=[].slice.call(d.querySelectorAll('.lx-say')),t=false;
function cl(v){return v<0?0:v>1?1:v}
function f(){t=false;var vh=innerHeight,r;
if(hero){r=hero.getBoundingClientRect();hero.style.setProperty('--p',cl(-r.top/Math.max(1,r.height-vh)).toFixed(4));if(bar)bar.classList.toggle('on',r.bottom<vh*.5)}
says.forEach(function(s){var ws=s.querySelectorAll('.w');r=s.getBoundingClientRect();var n=Math.round(cl((vh*.82-r.top)/(r.height+vh*.3))*ws.length);for(var i=0;i<ws.length;i++)ws[i].classList.toggle('lit',i<n)});
if(wide){r=wide.getBoundingClientRect();wide.style.setProperty('--q',cl((vh-r.top)/(vh*.85)).toFixed(4))}}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{letter-spacing:-.011em}
h1,h2,h3{font-weight:700;letter-spacing:-.035em}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 78%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--line)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.25rem}
.brand{display:flex;align-items:center;gap:.55rem;margin-right:auto;font-family:var(--font-display);font-size:1.02rem;font-weight:600;letter-spacing:-.02em;text-decoration:none}
.mark{display:inline-grid;place-items:center;width:1.85rem;height:1.85rem;border-radius:.55rem;background:var(--ink);color:var(--bg);font-size:.72rem;font-weight:700;letter-spacing:0}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.84rem;color:var(--muted);text-decoration:none;transition:color .2s ease}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lx-eyebrow{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:-.01em;color:var(--primary-text)}
.lx-h2{margin-top:.6rem;font-size:clamp(2.6rem,1.6rem + 4.4vw,5.6rem);line-height:.98;letter-spacing:-.05em}
.lx-lead{margin-top:1.25rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.45;color:var(--muted)}
.lx-head{margin-bottom:clamp(2rem,1.5rem + 2vw,3.5rem)}
.lx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem)}
.lx-narrow{max-width:58rem}
/* hero: without motion it is a plain stack; with motion the stage sticks and the shot grows as you scroll */
.lx-hero{--p:1;position:relative}
.lx-stage{position:relative;display:grid;justify-items:center;padding:clamp(3rem,2rem + 4vw,6rem) 0 0;text-align:center}
.lx-copy{position:relative;z-index:2;display:grid;justify-items:center;padding-inline:1rem}
.lx-maker{font-size:clamp(1rem,.9rem + .4vw,1.25rem);font-weight:600;color:var(--muted);letter-spacing:-.01em}
.lx-name{margin-top:.25rem;font-size:clamp(3.6rem,1rem + 14vw,13.5rem);line-height:.9;letter-spacing:-.065em;font-weight:700;padding-bottom:.06em}
.lx-name.long{font-size:clamp(2.8rem,.8rem + 7.4vw,7.6rem)}
.lx-name .lw{display:inline-block;white-space:nowrap}
.lx-name .ch{display:inline-block;background:linear-gradient(180deg,var(--ink) 35%,color-mix(in srgb,var(--ink) 50%,var(--primary)));-webkit-background-clip:text;background-clip:text;color:transparent}
.lx-sub{max-width:38rem;margin-top:clamp(.9rem,.6rem + 1vw,1.6rem);font-size:clamp(1.2rem,1rem + .9vw,1.85rem);line-height:1.3;font-weight:500;letter-spacing:-.025em;text-wrap:balance}
.lx-sub span{color:var(--muted)}
.lx-ctas{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.6rem 1.4rem;margin-top:clamp(1.4rem,1rem + 1.4vw,2.2rem)}
.lx-from{font-size:1.05rem;font-weight:500;color:var(--muted)}
.lx-link{font-weight:600;color:var(--primary-text);text-decoration:none}
.lx-shot{position:relative;width:min(100% - 2rem,74rem);margin-top:clamp(2.5rem,2rem + 3vw,5rem)}
.lx-shot-in{overflow:hidden;border-radius:clamp(22px,1rem + 1.5vw,40px);aspect-ratio:4/3;background:var(--surface)}
@media (min-width:48rem){.lx-shot-in{aspect-ratio:16/10}}
.lx-shot-img{width:100%;height:100%;object-fit:cover}
.lx-over{display:none}
html.m .lx-hero{--p:0;height:240vh;height:240svh}
html.m .lx-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;align-content:start;padding-top:calc(3.25rem + clamp(1.5rem,1rem + 4vh,4.5rem))}
html.m .lx-copy{z-index:0;transform:translate3d(0,calc(var(--p) * -14vh),0) scale(calc(1 - var(--p) * .1));opacity:calc(1 - var(--p) * 2.4)}
html.m .lx-shot{z-index:1;position:absolute;left:0;right:0;top:3.75rem;bottom:.75rem;width:auto;margin:0 auto;max-width:calc(100% - 1.5rem);transform-origin:50% 0;transform:translate3d(0,calc((1 - var(--p)) * 56vh),0) scale(calc(.6 + var(--p) * .4))}
@media (min-width:48rem){html.m .lx-shot{transform:translate3d(0,calc((1 - var(--p)) * 66vh),0) scale(calc(.5 + var(--p) * .5))}}
html.m .lx-shot-in{height:100%;aspect-ratio:auto;border-radius:calc(48px - var(--p) * 22px);box-shadow:0 60px 120px -60px color-mix(in srgb,var(--ink) 45%,transparent)}
html.m .lx-shot-img{transform:scale(calc(1.18 - var(--p) * .18))}
html.m .lx-over{position:absolute;left:clamp(1rem,3vw,2.5rem);bottom:clamp(1rem,3vw,2.5rem);display:grid;gap:.1rem;padding:1rem 1.3rem;border-radius:20px;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);text-align:left;opacity:calc((var(--p) - .78) * 5);transform:translate3d(0,calc((1 - var(--p)) * 40px),0)}
.lx-over span{font-weight:600;letter-spacing:-.02em}
.lx-over strong{font-size:1.6rem;letter-spacing:-.04em}
html.m .lx-name .ch{transform:translateY(105%);animation:lxRise 1.25s cubic-bezier(.16,1,.3,1) calc(var(--i) * 38ms + .15s) both}
html.m .lx-name .lw{overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}
@keyframes lxRise{to{transform:none}}
/* features: bento */
.lx-features{background:var(--surface)}
.bento{display:grid;gap:.9rem}
@media (min-width:48rem){.bento{grid-template-columns:repeat(6,1fr);grid-auto-rows:minmax(13rem,auto)}.bx-big{grid-column:span 4;grid-row:span 2}.bx-side{grid-column:span 2}.bx-tall{grid-column:span 2;grid-row:span 2}.bx-third{grid-column:span 2}.bx-half{grid-column:span 3}.bx-full{grid-column:1/-1}}
.bx{--spot:color-mix(in srgb,var(--primary) 16%,transparent);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:.6rem;min-height:12rem;padding:clamp(1.4rem,1.1rem + 1vw,2.2rem);border-radius:var(--radius);background:var(--bg);box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 4%,transparent),0 20px 40px -32px color-mix(in srgb,var(--ink) 30%,transparent);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
html.m .bx.in:hover,.bx:hover{transform:translateY(-3px)}
.bx-n{position:absolute;top:clamp(1.2rem,1rem + .6vw,1.8rem);left:clamp(1.4rem,1.1rem + 1vw,2.2rem);font-family:var(--font-display);font-size:.85rem;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.bx-t{font-family:var(--font-display);font-size:clamp(1.25rem,1.05rem + .7vw,1.65rem);font-weight:600;line-height:1.18;letter-spacing:-.03em;text-wrap:balance}
.bx-big{min-height:24rem;justify-content:flex-end;color:var(--on-dark);background:var(--dark)}
.bx-big .bx-n{color:var(--muted-on-dark);z-index:1}
.bx-big .bx-t{position:relative;z-index:1;max-width:28rem;font-size:clamp(1.7rem,1.2rem + 1.8vw,2.9rem);line-height:1.04}
.bx-media{position:absolute;inset:0;z-index:0}
.bx-media::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--dark) 85%,transparent))}
.bx-img{width:100%;height:115%;margin-top:-7%;object-fit:cover}
.bx-big::before{z-index:1}
.bx-big.bx-full{min-height:20rem}
/* story: words light up as you scroll */
.lx-story{text-align:left}
.lx-say{margin-top:1.4rem;font-family:var(--font-display);font-size:clamp(1.8rem,1.2rem + 2.6vw,3.6rem);font-weight:600;line-height:1.12;letter-spacing:-.04em}
.lx-say.more{font-size:clamp(1.35rem,1.1rem + 1.2vw,2.2rem);line-height:1.25}
html.m .lx-say .w>span{transform:none;opacity:.16;transition:opacity .45s ease;transition-delay:0s}
html.m .lx-say .w.lit>span{opacity:1}
/* wide photo opens up as it comes in */
.lx-wide{--q:1;position:relative;padding-inline:clamp(.75rem,2vw,1.5rem)}
.lx-wide-frame{overflow:hidden;border-radius:var(--radius);aspect-ratio:4/5}
@media (min-width:48rem){.lx-wide-frame{aspect-ratio:21/10}}
html.m .lx-wide-frame{clip-path:inset(0 calc((1 - var(--q)) * 12%) round var(--radius))}
.lx-wide-img{width:100%;height:116%;margin-top:-8%;object-fit:cover}
.lx-wide-cap{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:1.1rem;font-weight:500;color:var(--muted);text-align:center}
.lx-wide-cap .i{color:var(--primary-text)}
/* buy */
.lx-buy-grid{display:grid;gap:clamp(2rem,1rem + 4vw,6rem);align-items:center}
@media (min-width:56rem){.lx-buy-grid{grid-template-columns:1.05fr .95fr}}
.lx-buy-media{overflow:hidden;border-radius:var(--radius);aspect-ratio:1}
.lx-buy-img{width:100%;height:100%;object-fit:cover}
.lx-buy-copy{display:grid;justify-items:start}
.lx-price{margin-top:1.2rem;font-family:var(--font-display);font-size:clamp(2.2rem,1.6rem + 2vw,3.4rem);font-weight:600;letter-spacing:-.045em}
.lx-opts{display:grid;gap:.6rem;width:100%;margin-top:1.75rem}
.lx-opts li{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1.3rem;border-radius:18px;border:1.5px solid var(--line);transition:border-color .25s ease,background-color .25s ease}
.lx-opts li:hover{border-color:var(--primary-tint);background:var(--primary-soft)}
.lx-opts span{display:grid;gap:.1rem;font-weight:600;letter-spacing:-.02em}
.lx-opts small{font-size:.9rem;font-weight:400;color:var(--muted);letter-spacing:0}
.lx-opts strong{font-family:var(--font-display);font-size:1.35rem;font-weight:600;letter-spacing:-.03em;white-space:nowrap}
.lx-note{margin-top:.9rem;color:var(--muted)}
.lx-buy-cta{margin-top:1.75rem}
.lx-big{min-height:3.9rem;padding-inline:2.6rem;font-size:1.1rem}
.lx-buy-cta{width:100%}
@media (max-width:39.99rem){.lx-big{width:100%}}
@media (max-width:47.99rem){.bx{min-height:8.5rem}.bx-big{min-height:22rem}}
.lx-facts{display:grid;gap:.7rem;margin-top:1.75rem;color:var(--muted)}
.lx-facts li{display:flex;gap:.6rem;align-items:flex-start}
.lx-facts .i{margin-top:.2rem;color:var(--primary-text)}
.lx-facts a{color:var(--ink);font-weight:600}
.lx-form{width:100%;margin-top:1.75rem}
.lx-wait .lx-facts:empty{display:none}
.lx-faq{border-top:1px solid var(--line)}
.lx-faq-grid{display:grid;gap:2rem}
@media (min-width:60rem){.lx-faq-grid{grid-template-columns:.75fr 1.25fr;gap:4rem;align-items:start}}
.faq details{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.3rem 0;font-size:1.15rem;letter-spacing:-.02em}
.faq .ans{padding:0 0 1.3rem}
.ftr{background:var(--surface);border-top:0}
/* phone buy bar */
.lx-bar{align-items:center;gap:.8rem;background:color-mix(in srgb,var(--bg) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(18px);backdrop-filter:saturate(1.8) blur(18px)}
.lx-bar .btn{flex:none;min-width:8.5rem}
.lx-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.lx-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.02em}
.lx-bar-t span{font-size:.9rem;color:var(--muted)}
html.m .lx-bar{transform:translateY(120%);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
html.m .lx-bar.on{transform:none}
@media (prefers-reduced-motion:reduce){.lx-shot-img,.lx-wide-frame{transform:none!important;clip-path:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Launch',
  bestFor: 'One hero product: a bottle, a candle, a gadget, a kit, sold with one Buy button',
  why: 'Built to sell one product: its name set huge, the product shot growing to fill the screen as you scroll, features in a bento grid and the price beside a magnetic Buy button.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  tokens,
  slots,
  nav,
  render,
};
