// Launch (animated, product): one product, presented like a launch keynote: the thing itself, drawn in steel.
//   Object:   the product, drawn: a steel bottle (or, for anything that isn't a bottle, a steel tin) standing on a
//             paper shelf with its cap knurled and its name engraved, built in the page so it can turn.
//   Material: brushed steel on warm paper: a pale paper tinted with the member's colour, near-black ink, the steel in
//             greys only, hairline rules, round only where the thing is round in life (the button, like a cap).
//   One move: the bottle fills from the bottom like it is being poured (the pour intro), then, as you scroll, it turns
//             once on its axis (pinned): the engraving goes round the back and comes again, the knurl rolls, and each
//             detail the member listed is read out beside it.
//   Pop:      the member's colour is one line of light: the rim light running down the steel's edge. Buttons are ink.
// Then the everyday photo, the sizes as bottles standing side by side at their real proportions with their prices,
// the member's story when they wrote one, and their questions when they gave some, set as a spec list.
// Reduced motion and no script: the bottle standing still, every detail listed. Its motion is the `choreo` block at
// the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'launch';

function tokens(p) {
  return { bg: color.mix(color.mix(p.paper, '#f4f1ea', 0.6), p.primary, 0.05), dark: color.mix(p.ink, '#000000', 0.55) };
}

function product(c) {
  return c.productName || c.heroTitle || c.name;
}

// What to draw: a tall bottle for anything poured from, otherwise a low steel tin (candles, jars, kits, gadgets).
function shapeOf(c) {
  const s = `${c.what || ''} ${product(c)} ${c.name}`.toLowerCase();
  return /\b(bottles?|flasks?|tumblers?|thermos|canteens?|carafes?|growlers?|jugs?)\b/.test(s) ? 'bottle' : 'tin';
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [{ slot: 'wide', file: 'everyday.jpg', w: 1800, h: 1100, style: 'sweep', alt: g[3] || g[2] || g[0] || `${name} at home` }];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return { text: c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText, low };
  if (c.priceText) return { text: c.priceText, low: null };
  return null;
}

function nav(c) {
  const n = c.services.filter((s) => s.name).length;
  return [
    c.included.length && { label: 'Details', href: '#turn' },
    c.buy ? { label: n > 1 ? 'Sizes' : 'Buy', href: '#buy' } : { label: 'Waitlist', href: '#signup' },
    ownAbout(c).length && { label: 'Story', href: '#story' },
    c.faq.length >= 2 && { label: 'Questions', href: '#asked' },
  ].filter(Boolean);
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

// A size in a variant's name (600 ml, 1 L, 32 oz), in millilitres, for drawing the sizes at their proportions.
function volume(s) {
  const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*(ml|millilit\w*|cl|l|lit\w*|oz|fl\.? ?oz)\b/i);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(',', '.'));
  const u = m[2].toLowerCase();
  return u.startsWith('m') ? v : u === 'cl' ? v * 10 : u.startsWith('l') ? v * 1000 : v * 29.57;
}

// The steel object, built from boxes so the page can turn it: cap with a knurled band, neck, body with the name
// engraved (an inline SVG, so it uses the page's font and is hidden from screen readers), the rim light in the
// member's colour, and its shadow on the shelf.
function steel(name, shape, { h = '', cls = '' } = {}) {
  const word = esc(String(name).toUpperCase());
  return `<div class="lx-obj lx-${shape} ${cls}"${h ? ` style="--h:${h}"` : ''} aria-hidden="true">
<i class="lx-cap"><i class="lx-knurl"></i></i>${shape === 'bottle' ? '<i class="lx-neck"></i>' : ''}
<i class="lx-body"><svg class="lx-eng" viewBox="0 0 200 40" preserveAspectRatio="xMidYMid meet"><text x="100" y="27" text-anchor="middle">${word}</text></svg><i class="lx-rim"></i></i>
</div>`;
}

function render(c) {
  const name = product(c);
  const shape = shapeOf(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const buyBtn = (cls = 'btn btn-primary btn-lg') => P.button(buy, cls).replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const subMore = c.tagline && c.heroSub.startsWith(sub) ? c.heroSub.slice(sub.length).trim() : '';
  const maker = name !== c.name && !String(sub).includes(c.name) ? c.name : '';
  const len = [...name].length;
  const priceHtml = (t) => esc(t).replace(/^(From )?(\S+)/, (m, f, v) => `${f ? '<span>From</span> ' : ''}<b>${v}</b>`);

  const hero = `<section class="lx-hero" aria-labelledby="hero-title">
<div class="wrap lx-hero-in">
<div class="lx-copy">
${maker ? `<p class="lx-maker" data-ci="then" data-ci-from="fade">${esc(maker)}</p>` : ''}
<h1 id="hero-title" data-ci="head" class="lx-name${len > 14 ? ' long' : ''}">${esc(name)}</h1>
<p class="lx-sub" data-ci="then">${esc(sub)}${subMore ? ` <span>${esc(subMore)}</span>` : ''}</p>
<div class="lx-ctas" data-ci="then">
${price ? `<p class="lx-from">${priceHtml(price.text)}</p>` : ''}
${buyBtn()}
${!price && c.secondary ? P.button(c.secondary, 'lx-link') : ''}
</div>
</div>
<div class="lx-stand" data-ci="subject"><div class="lx-lean" data-alive="0.5">${steel(name, shape)}</div><i class="lx-shelf" aria-hidden="true"></i></div>
</div>
</section>`;

  // The scroll moment: the object turns once while each listed detail is read out beside it.
  const n = c.included.length;
  const turn = n
    ? `<section class="lx-turn" id="turn" aria-labelledby="turn-title" data-sc>
<div class="lx-turn-stage" data-sc-stage>
<div class="wrap lx-turn-in">
<div class="lx-turn-obj">${steel(name, shape, { cls: 'big' })}<i class="lx-shelf" aria-hidden="true"></i></div>
<div class="lx-turn-copy">
<h2 class="lx-h2" id="turn-title">All the way round.</h2>
<ol class="lx-feats">${c.included.map((x, i) => `<li data-sc-part><span class="lx-fn">${String(i + 1).padStart(2, '0')}</span><span class="lx-ft">${esc(x)}</span></li>`).join('')}</ol>
</div>
</div>
</div>
</section>`
    : '';

  const ship = c.shipping ? c.shipping.replace(/[.]+$/, '') : '';
  const wide = `<section class="lx-wide" aria-label="${esc(name)}, every day">
<div class="lx-wide-frame">${P.img(c, 'wide', { cls: 'lx-wide-img' }).replace('<img ', '<img data-par="0.06" ')}</div>
</section>`;

  // The sizes: each variant drawn standing beside the others at its own proportion, its price set under it.
  const priced = c.services.filter((s) => s.name);
  const vols = priced.map((s) => volume(s.name));
  const vmax = Math.max(...vols, 0);
  const sizes = priced.length > 1
    ? `<ul class="lx-sizes" style="--k:${priced.length}">${priced.map((s, i) => {
      const k = vmax && vols[i] ? Math.pow(vols[i] / vmax, 0.5) : 1;
      return `<li><div class="lx-size-obj">${steel(name, shape, { h: (k * 100).toFixed(1), cls: 'sm' })}</div><p class="lx-size-name">${esc(s.name)}</p>${s.priceText ? `<p class="lx-size-price">${esc(s.priceText)}</p>` : ''}${s.blurb ? `<p class="lx-size-note">${esc(s.blurb)}</p>` : ''}</li>`;
    }).join('')}</ul>`
    : '';
  const facts = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.capacity && ['Made', esc(c.capacity)], c.email && !waitlist && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const sizeTitle = priced.length > 1 ? (vols.every(Boolean) ? `${words[priced.length] || priced.length} sizes.` : `${words[priced.length] || priced.length} to choose from.`) : '';
  const buySec = `<section class="lx-sec lx-buy${waitlist ? ' lx-wait' : ''}" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title">
<div class="wrap">
<div class="lx-buy-head">
<h2 class="lx-h2" id="buy-title">${esc(waitlist ? c.ctaTitle : sizeTitle || name)}</h2>
${waitlist ? `<p class="lx-lead">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
</div>
${sizes}
<div class="lx-buy-row">
${price && priced.length < 2 ? `<p class="lx-price">${priceHtml(price.text)}</p>` : ''}
${priced.length === 1 && priced[0].blurb ? `<p class="lx-note">${esc(priced[0].blurb)}</p>` : ''}
${waitlist
  ? `<div class="lx-form">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="lx-buy-cta">${buyBtn('btn btn-primary btn-lg lx-big')}</div>`}
${facts.length ? `<dl class="lx-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
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

  const reviews = c.reviews.length
    ? `<section class="lx-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="lx-h2" id="reviews-title">What people say</h2><div class="lx-rv">${P.reviews(c)}</div></div></section>`
    : '';

  // Questions only when the member gave two or more, set as a spec list: every answer open.
  const asked = c.faq.length >= 2
    ? `<section class="lx-sec lx-asked" id="asked" aria-labelledby="asked-title"><div class="wrap lx-asked-in"><h2 class="lx-h2" id="asked-title">Asked.</h2><dl>${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const bar = `<nav class="mbar lx-bar" aria-label="Buy ${esc(name)}"><div class="lx-bar-t"><strong>${esc(name)}</strong>${price ? `<span>${esc(price.text)}</span>` : ''}</div>${P.button(buy, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'lx-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, turn, wide, buySec, story, reviews, asked, '</main>', P.footer(c, { cls: 'lx-ftr' }), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '3px', btnRadius: '999px', max: '82rem' } };
}

// The phone buy bar slides up once the hero has passed (the turn is the choreo block's own scroll moment).
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var hero=document.querySelector('.lx-hero'),bar=document.querySelector('.lx-bar'),t=false;if(!hero||!bar)return;
function f(){t=false;bar.classList.toggle('on',hero.getBoundingClientRect().bottom<innerHeight*.5)}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});f()})();`;

// A drawn placeholder for the everyday photo (T.art): the steel object standing on a table in window light.
function art(slot, { p, seed, index, art: A, c }) {
  if (slot.slot !== 'wide') return null;
  const { w, h } = slot;
  const wl = A.wall({ style: 'sweep', w, h, p, seed, index, quiet: true });
  const bottle = shapeOf(c) === 'bottle';
  const oh = h * (bottle ? 0.48 : 0.28);
  const ow = oh * (bottle ? 0.3 : 0.86);
  const x = w * 0.58;
  const top = h * 0.72 - oh;
  const table = h * 0.72;
  const r = ow * 0.16;
  const capH = oh * (bottle ? 0.1 : 0.14);
  const neckH = bottle ? oh * 0.035 : 0;
  const bodyY = top + capH + neckH;
  const capW = ow * (bottle ? 0.64 : 1.02);
  const defs = `${wl.defs}<linearGradient id="st" x1="0" x2="1"><stop offset="0" stop-color="#3b4045"/><stop offset=".1" stop-color="#8b9197"/><stop offset=".22" stop-color="#e4e7e9"/><stop offset=".3" stop-color="#f6f7f8"/><stop offset=".42" stop-color="#b3b8bd"/><stop offset=".64" stop-color="#7d838a"/><stop offset=".84" stop-color="#a8adb2"/><stop offset="1" stop-color="#454a50"/></linearGradient><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wl.lit}"/><stop offset="1" stop-color="${wl.shade}"/></linearGradient><filter id="sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(h * 0.012).toFixed(1)}"/></filter>`;
  const body = `${wl.body}<rect y="${table}" width="${w}" height="${h - table}" fill="url(#tb)" opacity=".55"/><path d="M0 ${table}H${w}" stroke="${wl.shade}" stroke-width="2" opacity=".5"/>`
    + `<ellipse cx="${x + ow * 0.18}" cy="${table}" rx="${ow * 0.78}" ry="${h * 0.014}" fill="#000" opacity=".28" filter="url(#sh)"/>`
    + `<rect x="${x - ow / 2}" y="${bodyY}" width="${ow}" height="${table - bodyY}" rx="${r}" fill="url(#st)"/>`
    + (bottle ? `<rect x="${x - ow * 0.27}" y="${top + capH - 2}" width="${ow * 0.54}" height="${neckH + 4}" fill="#5d6268"/>` : '')
    + `<rect x="${x - capW / 2}" y="${top}" width="${capW}" height="${capH}" rx="${capW * 0.12}" fill="url(#st)"/><path d="M${x - capW / 2} ${top + capH * 0.62}H${x + capW / 2}" stroke="#2f3337" stroke-width="2" opacity=".5"/>`;
  return A.svgDoc(w, h, defs, body);
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{--rule:color-mix(in srgb,var(--ink) 16%,transparent);--s1:#3b4045;--s2:#8b9197;--s3:#e4e7e9;--s4:#f7f8f9;--s5:#b3b8bd;--s6:#7d838a;--s7:#a8adb2;--s8:#454a50;letter-spacing:-.011em}
h1,h2,h3{font-weight:700;letter-spacing:-.04em}
.btn{font-weight:600}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-sm{min-height:2.4rem;padding:.45rem 1.05rem;font-size:.875rem}
.prog{background:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.05rem;font-weight:700;letter-spacing:-.03em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.875rem;color:var(--muted);text-decoration:none;transition:color .2s ease}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
.menu-panel{background:var(--ink);color:var(--bg);border:0;padding-bottom:2rem}
.menu-panel li a{color:var(--bg);border-bottom-color:color-mix(in srgb,var(--bg) 18%,transparent);font-size:2rem;font-weight:700;letter-spacing:-.04em}
.menu-panel .btn-primary{background:var(--bg);color:var(--ink)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lx-h2{font-size:clamp(2.5rem,1.6rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.05em}
.lx-lead{margin-top:1.25rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
.lx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem)}
/* the steel object: built from boxes; --h is its height in the box it stands in (100 = the tallest) */
.lx-obj{--h:100;--a:calc(var(--p,0) * 1turn);position:relative;display:grid;height:calc(var(--H,30rem) * var(--h) / 100 * var(--tk,1));aspect-ratio:var(--ar);margin-inline:auto;justify-items:center;grid-template-rows:var(--rows)}
.lx-bottle{--ar:.31;--rows:9.5% 3.5% 1fr}
.lx-tin{--ar:.86;--rows:15% 1fr;--tk:.62}
.lx-obj i{display:block}
.lx-cap{position:relative;width:64%;height:100%;border-radius:22% 22% 6% 6% / 34% 34% 8% 8%;overflow:hidden;background:linear-gradient(90deg,var(--s1),var(--s2) 12%,var(--s3) 26%,var(--s4) 32%,var(--s5) 44%,var(--s6) 66%,var(--s7) 84%,var(--s8))}
.lx-tin .lx-cap{width:103%;border-radius:10% 10% 4% 4% / 30% 30% 10% 10%}
.lx-knurl{position:absolute;left:0;right:0;top:38%;bottom:18%;background:linear-gradient(90deg,rgba(0,0,0,.34) 0 45%,rgba(255,255,255,.2) 45% 70%,transparent 70%) 0 0/7px 100%;background-position-x:calc(var(--p,0) * -14rem);mix-blend-mode:multiply}
.lx-knurl::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.45),transparent 18% 82%,rgba(0,0,0,.45))}
.lx-neck{width:56%;height:100%;background:linear-gradient(90deg,#2e3236,#6c7278 30%,#4b5056 60%,#24282b)}
.lx-body{position:relative;width:100%;height:100%;border-radius:26% 26% 10% 10% / 7% 7% 3% 3%;overflow:hidden;background:linear-gradient(90deg,var(--s1),var(--s2) 9%,var(--s3) 21%,var(--s4) 27%,var(--s5) 39%,var(--s6) 60%,var(--s7) 82%,var(--s8))}
.lx-tin .lx-body{border-radius:6% 6% 9% 9% / 5% 5% 8% 8%}
.lx-body::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 12%,transparent 88%,rgba(0,0,0,.22))}
.lx-eng{position:absolute;left:12%;top:50%;width:76%;height:auto;overflow:visible;transform:translate3d(calc(sin(var(--a)) * 44%),-50%,0) scaleX(max(.02,cos(var(--a))));opacity:clamp(0,calc(cos(var(--a)) * 1.6 - .25),1)}
.lx-bottle .lx-eng{top:auto;bottom:22%;transform:translate3d(calc(sin(var(--a)) * 44%),0,0) scaleX(max(.02,cos(var(--a))))}
.lx-eng text{font-family:var(--font-display);font-size:22px;font-weight:600;letter-spacing:.32em;fill:rgba(40,44,48,.5)}
.lx-bottle .lx-eng text{font-size:19px}
.lx-rim{position:absolute;right:7%;top:6%;bottom:5%;width:2px;border-radius:2px;background:linear-gradient(180deg,transparent,var(--pop) 14%,var(--pop) 86%,transparent)}
.lx-shelf{display:block;height:1px;background:var(--ink);position:relative}
.lx-shelf::before{content:'';position:absolute;left:50%;top:-6px;width:min(70%,16rem);height:12px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.28),transparent)}
/* hero: the name and the line on the left, the object standing on its shelf on the right */
.lx-hero{padding-block:clamp(1.5rem,1rem + 3vw,4rem) clamp(3rem,2rem + 4vw,6rem);border-bottom:1px solid var(--rule)}
.lx-hero-in{display:grid;gap:2.5rem;align-items:end}
@media (min-width:56rem){.lx-hero-in{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:3rem}}
.lx-maker{font-size:.95rem;font-weight:600;color:var(--muted)}
.lx-name{margin-top:.4rem;margin-left:-.05em;font-size:clamp(4rem,1.4rem + 9vw,11rem);line-height:.86;letter-spacing:-.06em;font-weight:800;text-wrap:balance}
.lx-name.long{font-size:clamp(3rem,1rem + 6vw,7.4rem)}
.lx-sub{max-width:30rem;margin-top:clamp(1.4rem,1rem + 1.4vw,2.4rem);font-size:clamp(1.15rem,1rem + .55vw,1.5rem);line-height:1.35;font-weight:500;letter-spacing:-.025em}
.lx-sub span{color:var(--muted)}
.lx-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.6rem;margin-top:1.8rem}
.lx-from{display:flex;align-items:baseline;gap:.4rem;font-variant-numeric:tabular-nums}
.lx-from span{color:var(--muted)}
.lx-from b{font-size:clamp(1.6rem,1.2rem + 1vw,2.2rem);font-weight:700;letter-spacing:-.045em}
.lx-link{font-weight:600;text-decoration-color:var(--rule)}
.lx-stand{--H:min(68vh,42rem);display:grid;align-content:end}
@media (max-width:55.99rem){.lx-stand{--H:min(54vh,27rem)}}
.lx-lean{display:grid;align-items:end}
/* the turn: pinned on desktop, the object turning once while the details are read out */
.lx-turn{border-bottom:1px solid var(--rule)}
.lx-turn-stage{display:grid;align-content:center;padding-block:clamp(4rem,3rem + 5vw,8rem)}
.lx-turn-in{display:grid;gap:3rem;align-items:center}
@media (min-width:48rem){.lx-turn-in{grid-template-columns:5fr 7fr;gap:clamp(2rem,1rem + 5vw,7rem)}}
.lx-turn-obj{--H:min(70vh,42rem);display:grid;align-content:end}
@media (max-width:47.99rem){.lx-turn-obj{--H:24rem}}
.lx-feats{margin-top:clamp(2rem,1rem + 2vw,3rem);border-top:1px solid var(--ink)}
.lx-feats li{display:grid;grid-template-columns:3.2rem 1fr;align-items:baseline;padding-block:clamp(1rem,.7rem + 1vw,1.6rem);border-bottom:1px solid var(--rule);transition:color .4s ease}
.lx-fn{font-size:.9rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted)}
.lx-ft{font-family:var(--font-display);font-size:clamp(1.5rem,1.1rem + 1.6vw,2.8rem);font-weight:700;line-height:1.05;letter-spacing:-.045em}
html.m .lx-feats li{color:var(--muted)}
html.m .lx-feats li.on{color:var(--ink)}
@media (min-width:48rem) and (hover:hover){html.m .lx-turn[data-sc]{height:calc(100vh + var(--n,3) * 46vh)!important;height:calc(100svh + var(--n,3) * 46svh)!important}html.m .lx-turn-stage{height:100vh;height:100svh;padding-block:4.5rem 2rem}html.m .lx-feats li.on:not(.cur){color:var(--muted)}html.m .lx-feats li.cur{color:var(--ink)}}
/* the everyday photo */
.lx-wide-frame{overflow:hidden;aspect-ratio:4/5}
@media (min-width:48rem){.lx-wide-frame{aspect-ratio:18/9}}
.lx-wide-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
/* buy: the sizes standing side by side, prices under them */
.lx-buy-head{display:grid;gap:.6rem;max-width:44rem}
.lx-sizes{display:grid;grid-template-columns:repeat(var(--k),minmax(0,1fr));gap:clamp(1rem,1rem + 3vw,5rem);margin-top:clamp(2.5rem,1.5rem + 3vw,4.5rem);max-width:52rem}
.lx-sizes li{display:grid;align-content:end;gap:.2rem}
.lx-size-obj{--H:clamp(13rem,9rem + 16vw,28rem);display:grid;align-items:end;height:var(--H);padding-bottom:1.2rem;margin-bottom:.9rem;border-bottom:1px solid var(--ink)}
.lx-size-name{font-weight:600;letter-spacing:-.02em}
.lx-size-price{font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.4rem);font-weight:700;letter-spacing:-.05em;font-variant-numeric:tabular-nums;line-height:1}
.lx-size-note{color:var(--muted)}
.lx-buy-row{display:grid;gap:1.5rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem);align-items:start}
@media (min-width:56rem){.lx-buy-row{grid-template-columns:auto minmax(0,1fr);gap:1.5rem 4rem}.lx-buy-row .lx-facts{grid-column:2;grid-row:1 / span 3}}
.lx-price{display:flex;align-items:baseline;gap:.5rem;font-variant-numeric:tabular-nums}
.lx-price span{color:var(--muted)}
.lx-price b{font-size:clamp(2.2rem,1.6rem + 2vw,3.4rem);letter-spacing:-.05em}
.lx-note{color:var(--muted)}
.lx-big{min-height:3.9rem;padding-inline:2.6rem;font-size:1.1rem}
@media (max-width:39.99rem){.lx-big{width:100%}}
.lx-facts{display:grid;align-content:start}
.lx-facts div{display:grid;grid-template-columns:7rem minmax(0,1fr);gap:1rem;padding:.75rem 0;border-top:1px solid var(--rule)}
.lx-facts dt{font-weight:600}
.lx-facts dd{margin:0;color:var(--muted)}
.lx-facts a{color:var(--ink);font-weight:600}
.lx-form{width:min(100%,32rem)}
.form .field input{border-radius:3px;background:transparent;border-color:color-mix(in srgb,var(--ink) 30%,transparent)}
/* story */
.lx-story{border-top:1px solid var(--rule)}
.lx-story-in{display:grid;gap:1.5rem}
@media (min-width:56rem){.lx-story-in{grid-template-columns:3fr 9fr}}
.lx-side{font-family:var(--font-body);font-size:.95rem;font-weight:600;letter-spacing:-.01em;color:var(--muted)}
.lx-say{font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2.2vw,3.4rem);font-weight:600;line-height:1.1;letter-spacing:-.045em;max-width:24ch}
.lx-say.more{margin-top:1.4rem;font-size:clamp(1.2rem,1rem + .8vw,1.7rem);line-height:1.3;max-width:34ch;color:var(--muted)}
.lx-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--ink);padding:1.4rem 0 0}
/* questions: a spec list, every answer open */
.lx-asked{border-top:1px solid var(--rule)}
.lx-asked-in{display:grid;gap:2rem}
@media (min-width:56rem){.lx-asked-in{grid-template-columns:5fr 7fr;gap:4rem}}
.lx-asked dl{border-top:1px solid var(--ink)}
.lx-asked dl div{display:grid;gap:.35rem;padding-block:1.2rem;border-bottom:1px solid var(--rule)}
@media (min-width:40rem){.lx-asked dl div{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:2rem}}
.lx-asked dt{font-weight:700;letter-spacing:-.02em}
.lx-asked dd{color:var(--muted)}
/* footer: an ink band, the name set large */
.lx-ftr{background:var(--ink);color:var(--bg);border-top:0;padding-block:clamp(3.5rem,2.5rem + 3vw,6rem) 2rem;--muted:color-mix(in srgb,var(--bg) 70%,var(--ink))}
.lx-ftr .ftr-name{font-size:clamp(2rem,1.4rem + 2.4vw,3.6rem);font-weight:800;letter-spacing:-.05em;line-height:1}
.lx-ftr .ftr-links a,.lx-ftr .ftr-line,.lx-ftr .ftr-base,.lx-ftr .legal-links,.lx-ftr .legal-links a{color:var(--muted)}
.lx-ftr a{color:var(--bg)}
.lx-ftr .ftr-base{border-top-color:color-mix(in srgb,var(--bg) 18%,transparent)}
.lx-ftr .contact-list .i{display:none}
.lx-ftr .contact-list li{padding:0}
.lx-ftr .mpause{color:var(--bg);border-color:color-mix(in srgb,var(--bg) 35%,transparent);background:transparent}
/* phone buy bar */
.lx-bar{align-items:center;gap:.8rem;background:var(--bg);box-shadow:none;border-top-color:var(--rule)}
.lx-bar .btn{flex:none;min-width:8.5rem}
.lx-bar-t{display:grid;flex:1;min-width:0;line-height:1.2}
.lx-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.02em}
.lx-bar-t span{font-size:.9rem;color:var(--muted);font-variant-numeric:tabular-nums}
html.m .lx-bar{transform:translateY(120%);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
html.m .lx-bar.on{transform:none}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Launch',
  bestFor: 'One hero product: a bottle, a candle, a gadget, a kit, sold with one Buy button',
  why: 'Built to sell one product: the product drawn in steel and poured onto the page, turning once as you scroll while its details are read out, and the sizes standing side by side with their prices.',
  fonts: { q: 'family=Geist:wght@400..800', display: ['Geist', 'grotesk'], body: ['Geist', 'grotesk'] },
  // The motion, as data (lib/choreo.md): poured onto the page, a product you can nudge, turned once on the scroll.
  choreo: { intro: 'pour', alive: ['pointer', 'tap'], scroll: 'pin', pace: 'medium', look: 'launch keynote, steel on warm paper, one slow turn' },
  tokens,
  slots,
  nav,
  art,
  render,
};
