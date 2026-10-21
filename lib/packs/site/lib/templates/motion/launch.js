// Launch (animated, product): one product, presented like a launch keynote: the thing itself, drawn in steel, big.
//   Object:   the product, drawn and picked from the facts: a steel bottle (bottles, flasks, tumblers), a steel tin
//             (candles, balms, tea, anything that comes in a jar or a kit), a steel device with a dial (gadgets, lamps,
//             clocks), or, for anything else, a stamped steel shop tag on a ring with the name struck into it. Built in
//             the page from light and metal (brushed gradients, a soft highlight, a contact shadow) so it can turn.
//   Material: brushed steel on warm paper: a pale paper tinted with the member's colour, near-black ink, the steel in
//             greys only, hairline rules, round only where the thing is round in life (the button, like a cap).
//   Layout:   the keynote frame: the name set wide and centred across the top, the object standing huge under it and
//             cropped by the fold, the line on its left and the price with the button on its right.
//   One move: the object fills from the bottom like it is being poured (the pour intro), then, as you scroll, it turns
//             once on its axis (pinned): the name struck into it goes round the back and comes again, the knurl rolls,
//             and each detail the member listed is read out beside it.
//   Pop:      the member's colour is the one anodised part: the cap, the lid, the dial ring or the tag's ring.
// Then the everyday photo (drawn: the object at home in window light), the sizes standing side by side at their real
// proportions with their prices, the member's story when they wrote one, and their questions when they gave some.
// Reduced motion and no script: the object standing still, every detail listed. Its motion is the `choreo` block at
// the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'launch';

// Warm paper by day (own mode); at night the hall itself: warm graphite, the steel lit by the same stage light.
function tokens(p, mode) {
  if (mode === 'dark') return { bg: color.mix(color.mix(p.ink, '#111112', 0.88), p.primary, 0.025), dark: '#060607' };
  return { bg: color.mix(color.mix(p.paper, '#f4f1ea', 0.6), p.primary, 0.05), dark: color.mix(p.ink, '#000000', 0.55) };
}

function product(c) {
  return c.productName || c.heroTitle || c.name;
}

// What to draw, from what the member sells: a bottle, a tin, a device, or (anything else, a service included) a tag.
function shapeOf(c) {
  const s = `${c.what || ''} ${product(c)} ${c.name} ${c.services.map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\b(bottles?|flasks?|tumblers?|thermos|canteens?|carafes?|growlers?|jugs?|drinkware|water bottles?|sake|spirits?|gin|whisk(e)?y|wine|olive oil|hot sauces?|sauces?)\b/.test(s)) return 'bottle';
  if (/\b(candles?|balms?|salves?|soaps?|teas?|coffee|spices?|jars?|tins?|wax|creams?|pomades?|mints?|skincare|cosmetics?|honey|kits?|sets?|bundles?|snacks?|supplements?)\b/.test(s)) return 'tin';
  if (/\b(gadgets?|devices?|clocks?|alarms?|lamps?|lights?|speakers?|radios?|headphones|chargers?|cameras?|keyboards?|thermostats?|trackers?|electronics?|smart \w+|sound machines?|timers?)\b/.test(s)) return 'device';
  return 'tag';
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [
    // The keynote stage the object stands on: an empty dark seamless backdrop and floor under one soft top light. Dark
    // in both modes; the steel object is built in the page and stands in front of it.
    { slot: 'hero', file: 'stage.jpg', w: 1800, h: 1200, style: 'sweep', alt: `${name} on a dark stage` },
    { slot: 'wide', file: 'everyday.jpg', w: 1800, h: 1100, style: 'sweep', alt: g[3] || g[2] || g[0] || `${name} at home` },
  ];
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

// The steel object, built from boxes so the page can turn it. The name struck into the steel is real type (hidden from
// screen readers: the page says it already), and turns with the object.
function steel(name, shape, { h = '', cls = '' } = {}) {
  const word = `<i class="lx-eng"><span>${esc(String(name).toUpperCase())}</span></i>`;
  const inner = {
    bottle: `<i class="lx-cap"><i class="lx-knurl"></i></i><i class="lx-neck"></i><i class="lx-body">${word}<i class="lx-hi"></i></i>`,
    tin: `<i class="lx-cap"><i class="lx-knurl"></i></i><i class="lx-body">${word}<i class="lx-hi"></i></i>`,
    device: `<i class="lx-body"><i class="lx-dial"><i class="lx-dial-in"></i><i class="lx-dial-mk"></i></i>${word}<i class="lx-slot"></i><i class="lx-hi"></i></i><i class="lx-feet"></i>`,
    tag: `<i class="lx-ring"></i><i class="lx-body"><i class="lx-hole"></i>${word}<i class="lx-hi"></i></i>`,
  }[shape];
  return `<div class="lx-obj lx-${shape} ${cls}" style="--len:${Math.max(4, [...String(name)].length)}${h ? `;--h:${h}` : ''}" aria-hidden="true">${inner}</div>`;
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

  const hero = `<section class="lx-hero lx-is-${shape}" aria-labelledby="hero-title">
<div class="wrap lx-hero-in">
<div class="lx-top">
${maker ? `<p class="lx-maker" data-ci="then" data-ci-from="fade">${esc(maker)}</p>` : ''}
<h1 id="hero-title" data-ci="head" class="lx-name" style="--len:${Math.max(4, len)}">${esc(name)}</h1>
</div>
<p class="lx-sub" data-ci="then">${esc(sub)}${subMore ? ` <span>${esc(subMore)}</span>` : ''}</p>
${c.images.hero ? `<div class="lx-stage" aria-hidden="true"><img src="${esc(c.images.hero.src)}" alt="" width="${c.images.hero.w}" height="${c.images.hero.h}" fetchpriority="high" decoding="async"></div>` : ''}
<div class="lx-stand" data-ci="subject"><div class="lx-lean" data-alive="0.5">${steel(name, shape)}</div><i class="lx-shadow" aria-hidden="true"></i></div>
<div class="lx-ctas lx-on-stage" data-ci="then">
${price ? `<p class="lx-from">${priceHtml(price.text)}</p>` : ''}
${buyBtn()}
${!price && c.secondary ? P.button(c.secondary, 'lx-link') : ''}
</div>
</div>
</section>`;

  // The scroll moment: the object turns once while each listed detail is read out beside it.
  const n = c.included.length;
  const turn = n
    ? `<section class="lx-turn" id="turn" aria-labelledby="turn-title" data-sc>
<div class="lx-turn-stage" data-sc-stage>
<div class="wrap lx-turn-in">
<div class="lx-turn-obj">${steel(name, shape, { cls: 'big' })}<i class="lx-shadow" aria-hidden="true"></i></div>
<div class="lx-turn-copy">
<h2 class="lx-h2" id="turn-title">All the way round.</h2>
<ol class="lx-feats">${c.included.map((x, i) => `<li data-sc-part><span class="lx-fn">${String(i + 1).padStart(2, '0')}</span><span class="lx-ft">${esc(x)}</span></li>`).join('')}</ol>
</div>
</div>
</div>
</section>`
    : '';

  const wide = `<section class="lx-wide" aria-label="${esc(name)}, every day">
<div class="lx-wide-frame">${P.img(c, 'wide', { cls: 'lx-wide-img' }).replace('<img ', '<img data-par="0.06" ')}</div>
</section>`;

  // The sizes: each variant drawn standing beside the others at its own proportion, its price set under it.
  const priced = c.services.filter((s) => s.name);
  const vols = priced.map((s) => volume(s.name));
  const vmax = Math.max(...vols, 0);
  const sizes = priced.length > 1
    ? `<ul class="lx-sizes" data-rv style="--k:${priced.length};--d:2">${priced.map((s, i) => {
      const k = vmax && vols[i] ? Math.pow(vols[i] / vmax, 0.5) : 1;
      return `<li><div class="lx-size-obj">${steel(name, shape, { h: (k * 100).toFixed(1), cls: 'sm' })}<i class="lx-shadow" aria-hidden="true"></i></div><p class="lx-size-name">${esc(s.name)}</p>${s.priceText ? `<p class="lx-size-price">${esc(s.priceText)}</p>` : ''}${s.blurb ? `<p class="lx-size-note">${esc(s.blurb)}</p>` : ''}</li>`;
    }).join('')}</ul>`
    : '';
  const facts = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.capacity && ['Made', esc(c.capacity)], c.email && !waitlist && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const sizeTitle = priced.length > 1 ? (vols.every(Boolean) ? `${words[priced.length] || priced.length} sizes.` : `${words[priced.length] || priced.length} to choose from.`) : '';
  const buySec = `<section class="lx-sec lx-buy${waitlist ? ' lx-wait' : ''}" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title">
<div class="wrap">
<div class="lx-buy-head" data-rv>
<h2 class="lx-h2" id="buy-title">${esc(waitlist ? c.ctaTitle : sizeTitle || name)}</h2>
${waitlist ? `<p class="lx-lead">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
</div>
${sizes}
<div class="lx-buy-row" data-rv style="--d:3">
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
<div class="wrap lx-story-in" data-rv>
<h2 class="lx-side" id="story-title">${esc(c.owner && c.owner !== c.name ? `${c.owner}, ${c.name}` : c.name)}</h2>
<div>${paras.map((p, i) => `<p class="lx-say${i ? ' more' : ''}">${esc(p)}</p>`).join('\n')}</div>
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="lx-sec" aria-labelledby="reviews-title"><div class="wrap" data-rv><h2 class="lx-h2" id="reviews-title">What people say</h2><div class="lx-rv">${P.reviews(c)}</div></div></section>`
    : '';

  // Questions only when the member gave two or more, set as a spec list: every answer open.
  const asked = c.faq.length >= 2
    ? `<section class="lx-sec lx-asked" id="asked" aria-labelledby="asked-title"><div class="wrap lx-asked-in" data-rv><h2 class="lx-h2" id="asked-title">Asked.</h2><dl>${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const bar = `<nav class="mbar lx-bar" aria-label="Buy ${esc(name)}"><div class="lx-bar-t"><strong>${esc(name)}</strong>${price ? `<span>${esc(price.text)}</span>` : ''}</div>${P.button(buy, 'btn btn-primary')}</nav>`;

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'lx-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, turn, wide, buySec, story, reviews, asked, '</main>', P.footer(c, { cls: 'lx-ftr' }), bar].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '3px', btnRadius: '999px', max: '84rem' } };
}

// The phone buy bar slides up once the hero has passed (the turn is the choreo block's own scroll moment).
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var hero=document.querySelector('.lx-hero'),bar=document.querySelector('.lx-bar'),t=false;if(!hero||!bar)return;
function f(){t=false;bar.classList.toggle('on',hero.getBoundingClientRect().bottom<innerHeight*.5)}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});f()})();`;

// A drawn placeholder for the everyday photo (T.art): the object at home in low window light, on a table or, for the
// tag, hung from a hook on the wall. The room is the page's own paper, warmed, never a tinted placeholder.
function art(slot, ctx) {
  const ph = ctx.art.photo('launch', slot.slot);
  if (ph) return ph;
  const { p, c, art: A } = ctx;
  if (slot.slot === 'hero') return stage(slot, ctx);
  if (slot.slot !== 'wide') return null;
  const { w, h } = slot;
  const shape = shapeOf(c);
  const wall = color.mix(p.paper, '#efe9df', 0.55);
  const lit = color.mix(wall, '#ffffff', 0.45);
  const dim = color.mix(wall, p.ink, 0.22);
  const wood = color.mix(color.mix(p.paper, '#b89a78', 0.55), p.ink, 0.12);
  const ano = [color.mix(p.primary, '#000000', 0.45), p.primary, color.mix(p.primary, '#ffffff', 0.42), color.mix(p.primary, '#000000', 0.3)];
  const table = h * 0.7;
  const x = w * 0.6;
  const steelG = (gid) => `<linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="#3b4045"/><stop offset=".1" stop-color="#8b9197"/><stop offset=".22" stop-color="#e4e7e9"/><stop offset=".3" stop-color="#f6f7f8"/><stop offset=".42" stop-color="#b3b8bd"/><stop offset=".64" stop-color="#7d838a"/><stop offset=".84" stop-color="#a8adb2"/><stop offset="1" stop-color="#454a50"/></linearGradient>`;
  const defs = `<radialGradient id="rm" cx=".22" cy=".18" r="1.05"><stop offset="0" stop-color="${lit}"/><stop offset=".55" stop-color="${wall}"/><stop offset="1" stop-color="${dim}"/></radialGradient>`
    + `<linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.mix(wood, '#ffffff', 0.18)}"/><stop offset=".08" stop-color="${wood}"/><stop offset="1" stop-color="${color.mix(wood, p.ink, 0.35)}"/></linearGradient>`
    + `<linearGradient id="win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `${steelG('st')}<linearGradient id="an" x1="0" x2="1"><stop offset="0" stop-color="${ano[0]}"/><stop offset=".25" stop-color="${ano[1]}"/><stop offset=".36" stop-color="${ano[2]}"/><stop offset=".6" stop-color="${ano[1]}"/><stop offset="1" stop-color="${ano[3]}"/></linearGradient>`
    + `<filter id="sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(h * 0.012).toFixed(1)}"/></filter><filter id="sf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(h * 0.04).toFixed(1)}"/></filter>`;
  // The room: a wall lit from the upper left, one soft fall of window light across it, the table edge.
  let body = `<rect width="${w}" height="${h}" fill="url(#rm)"/><path d="M${w * 0.06} 0H${w * 0.34}L${w * 0.62} ${table}H${w * 0.3}Z" fill="url(#win)" opacity=".5" filter="url(#sf)"/>`
    + `<rect y="${table}" width="${w}" height="${h - table}" fill="url(#tb)"/><rect y="${table}" width="${w}" height="${h * 0.006}" fill="#fff" opacity=".35"/>`;
  const shadow = (cx, rx) => `<ellipse cx="${cx + rx * 0.22}" cy="${table + h * 0.004}" rx="${rx}" ry="${h * 0.016}" fill="#000" opacity=".3" filter="url(#sh)"/>`;
  const hi = (x0, y0, ww, hh) => `<rect x="${x0 + ww * 0.24}" y="${y0 + hh * 0.04}" width="${ww * 0.06}" height="${hh * 0.9}" rx="${ww * 0.03}" fill="#fff" opacity=".35"/>`;
  if (shape === 'bottle' || shape === 'tin') {
    const bottle = shape === 'bottle';
    const oh = h * (bottle ? 0.4 : 0.24);
    const ow = oh * (bottle ? 0.3 : 0.9);
    const top = table - oh;
    const capH = oh * (bottle ? 0.1 : 0.16);
    const neckH = bottle ? oh * 0.035 : 0;
    const bodyY = top + capH + neckH;
    const capW = ow * (bottle ? 0.64 : 1.02);
    body += shadow(x, ow * 0.8)
      + `<rect x="${x - ow / 2}" y="${bodyY}" width="${ow}" height="${table - bodyY}" rx="${ow * 0.16}" fill="url(#st)"/>${hi(x - ow / 2, bodyY, ow, table - bodyY)}`
      + (bottle ? `<rect x="${x - ow * 0.27}" y="${top + capH - 2}" width="${ow * 0.54}" height="${neckH + 4}" fill="#5d6268"/>` : '')
      + `<rect x="${x - capW / 2}" y="${top}" width="${capW}" height="${capH}" rx="${capW * 0.12}" fill="url(#an)"/><rect x="${x - capW / 2}" y="${top + capH * 0.45}" width="${capW}" height="${capH * 0.3}" fill="#000" opacity=".16"/>`;
  } else if (shape === 'device') {
    const oh = h * 0.34;
    const ow = oh * 0.74;
    const top = table - oh;
    const cy = top + oh * 0.38;
    const r = ow * 0.3;
    body += shadow(x, ow * 0.75)
      + `<rect x="${x - ow / 2}" y="${top}" width="${ow}" height="${oh}" rx="${ow * 0.12}" fill="url(#st)"/>${hi(x - ow / 2, top, ow, oh)}`
      + `<circle cx="${x}" cy="${cy}" r="${r * 1.08}" fill="url(#an)"/><circle cx="${x}" cy="${cy}" r="${r}" fill="url(#st)"/><circle cx="${x}" cy="${cy}" r="${r * 0.78}" fill="#5b6066" opacity=".35"/>`
      + `<rect x="${x - ow * 0.22}" y="${top + oh * 0.78}" width="${ow * 0.44}" height="${oh * 0.018}" rx="2" fill="#2f3337" opacity=".6"/>`;
  } else {
    // The tag hangs from a brass-dark hook on the wall, its ring in the member's colour.
    const th = h * 0.32;
    const tw = th * 0.58;
    const hy = h * 0.3;
    const top = hy + th * 0.12;
    body += `<ellipse cx="${x + tw * 0.25}" cy="${top + th * 0.55}" rx="${tw * 0.55}" ry="${th * 0.5}" fill="#000" opacity=".16" filter="url(#sf)"/>`
      + `<rect x="${x - 6}" y="${hy - 14}" width="12" height="22" rx="4" fill="#3a3d41"/>`
      + `<circle cx="${x}" cy="${hy + th * 0.06}" r="${tw * 0.16}" fill="none" stroke="url(#an)" stroke-width="${tw * 0.05}"/>`
      + `<rect x="${x - tw / 2}" y="${top}" width="${tw}" height="${th}" rx="${tw * 0.14}" fill="url(#st)"/>${hi(x - tw / 2, top, tw, th)}`
      + `<circle cx="${x}" cy="${top + th * 0.1}" r="${tw * 0.07}" fill="${dim}"/><circle cx="${x}" cy="${top + th * 0.1}" r="${tw * 0.07}" fill="none" stroke="#2f3337" stroke-opacity=".5"/>`;
  }
  return A.svgDoc(w, h, defs, body);
}

// The stage, drawn: a dark seamless backdrop curving into the floor, one soft light from above falling on the floor
// where the object stands, a little film grain. Neutral greys, so any member's steel and anodised colour sit on it.
function stage(slot, { art: A }) {
  const { w, h } = slot;
  const defs = `<linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050506"/><stop offset=".5" stop-color="#0c0c0e"/><stop offset=".68" stop-color="#151518"/><stop offset="1" stop-color="#09090a"/></linearGradient>`
    + `<radialGradient id="fl" cx=".5" cy=".74" r=".42" gradientTransform="translate(0 .37) scale(1 .5)"><stop offset="0" stop-color="#d9d6d0" stop-opacity=".16"/><stop offset=".5" stop-color="#d9d6d0" stop-opacity=".05"/><stop offset="1" stop-color="#d9d6d0" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="wl" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="#2a2a2e" stop-opacity=".55"/><stop offset="1" stop-color="#2a2a2e" stop-opacity="0"/></radialGradient>`
    + `<filter id="fg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .09 0"/></filter>`;
  const body = `<rect width="${w}" height="${h}" fill="url(#bk)"/><rect width="${w}" height="${h}" fill="url(#wl)"/><rect width="${w}" height="${h}" fill="url(#fl)"/><rect width="${w}" height="${h}" filter="url(#fg)"/>`;
  return A.svgDoc(w, h, defs, body);
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Launch Display Fallback';font-weight:800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold');size-adjust:114.9%;ascent-override:94.9%;descent-override:27.9%;line-gap-override:0%}
@font-face{font-family:'Launch Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:105%;ascent-override:90.5%;descent-override:21.4%;line-gap-override:0%}
html:root{--font-display:"Mona Sans","Launch Display Fallback",sans-serif;--font-body:"Public Sans","Launch Body Fallback",sans-serif}
body{--rule:color-mix(in srgb,var(--ink) 16%,transparent);--s1:#3b4045;--s2:#8b9197;--s3:#e4e7e9;--s4:#f7f8f9;--s5:#b3b8bd;--s6:#7d838a;--s7:#a8adb2;--s8:#454a50;--steel:linear-gradient(90deg,var(--s1),var(--s2) 9%,var(--s3) 21%,var(--s4) 27%,var(--s5) 39%,var(--s6) 60%,var(--s7) 82%,var(--s8));--ano:linear-gradient(90deg,color-mix(in srgb,var(--primary) 55%,#000),var(--primary) 18%,color-mix(in srgb,var(--primary) 58%,#fff) 31%,var(--primary) 46%,color-mix(in srgb,var(--primary) 78%,#000) 72%,color-mix(in srgb,var(--primary) 80%,#fff) 87%,color-mix(in srgb,var(--primary) 50%,#000));letter-spacing:-.005em}
h1,h2,h3{font-family:var(--font-display);font-weight:800;font-stretch:125%;letter-spacing:-.02em}
.btn{font-weight:600}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
.btn-sm{min-height:2.4rem;padding:.45rem 1.05rem;font-size:.875rem}
.prog{background:var(--ink)}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-stretch:125%;font-size:1rem;font-weight:800;letter-spacing:-.01em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.875rem;color:var(--muted);text-decoration:none;transition:color .2s ease}
.nav a:hover{color:var(--ink)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
.menu-panel{background:var(--ink);color:var(--bg);border:0;padding-bottom:2rem}
.menu-panel li a{color:var(--bg);border-bottom-color:color-mix(in srgb,var(--bg) 18%,transparent);font-family:var(--font-display);font-stretch:125%;font-size:1.7rem;font-weight:800;letter-spacing:-.02em}
.menu-panel .btn-primary{background:var(--bg);color:var(--ink)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.lx-h2{font-size:clamp(2.1rem,1.4rem + 3.2vw,4.4rem);line-height:.98}
.lx-lead{margin-top:1.25rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
.lx-sec{padding-block:clamp(5rem,3.5rem + 6vw,10rem)}
/* the steel object: built from boxes; --h is its height in the box it stands in (100 = the tallest) */
.lx-obj{--h:100;--a:calc(var(--p,0) * 1turn);--oh:calc(var(--H,30rem) * var(--h) / 100 * var(--tk,1));position:relative;display:grid;height:var(--oh);aspect-ratio:var(--ar);margin-inline:auto;justify-items:center;grid-template-rows:var(--rows)}
.lx-bottle{--ar:.31;--rows:9.5% 3.5% 1fr}
.lx-tin{--ar:.86;--rows:16% 1fr;--tk:.62}
.lx-device{--ar:.74;--rows:1fr 2.5%;--tk:.7}
.lx-tag{--ar:.58;--rows:1fr;--tk:.66}
.lx-obj i{display:block}
.lx-cap{position:relative;width:64%;height:100%;border-radius:22% 22% 6% 6% / 34% 34% 8% 8%;overflow:hidden;background:var(--ano)}
.lx-tin .lx-cap{width:103%;border-radius:10% 10% 4% 4% / 30% 30% 10% 10%}
.lx-cap::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.28),transparent 30%,transparent 80%,rgba(0,0,0,.25))}
.lx-knurl{position:absolute;left:0;right:0;top:40%;bottom:20%;background:linear-gradient(90deg,rgba(0,0,0,.3) 0 45%,rgba(255,255,255,.16) 45% 70%,transparent 70%) 0 0/6px 100%;background-position-x:calc(var(--p,0) * -14rem);mix-blend-mode:multiply}
.lx-neck{width:56%;height:100%;background:linear-gradient(90deg,#2e3236,#6c7278 30%,#4b5056 60%,#24282b)}
.lx-body{position:relative;width:100%;height:100%;border-radius:26% 26% 10% 10% / 7% 7% 3% 3%;overflow:hidden;background:var(--steel)}
.lx-tin .lx-body{border-radius:6% 6% 9% 9% / 5% 5% 8% 8%}
.lx-device .lx-body{border-radius:12% / 9%}
.lx-tag .lx-body{border-radius:14% / 9%;transform:scaleX(max(.06,cos(var(--a)),calc(-1 * cos(var(--a)))))}
.lx-body::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.2),transparent 10%,transparent 86%,rgba(0,0,0,.24))}
/* one soft highlight in the steel's own grey, where the light from the left catches the curve */
.lx-hi{position:absolute;left:23%;top:4%;bottom:4%;width:7%;border-radius:50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5) 50%,transparent);opacity:.7}
.lx-tag .lx-hi,.lx-device .lx-hi{left:10%;width:10%;opacity:.45}
.lx-eng{position:absolute;left:8%;right:8%;top:22%;display:grid;place-items:center;transform:translate3d(calc(sin(var(--a)) * 44%),0,0) scaleX(max(.02,cos(var(--a))));opacity:clamp(0,calc(cos(var(--a)) * 1.6 - .25),1)}
.lx-tin .lx-eng{top:38%}
.lx-device .lx-eng{top:auto;bottom:24%}
.lx-tag .lx-eng{top:40%;transform:none;opacity:1}
.lx-eng span{font-family:var(--font-display);font-stretch:125%;font-weight:800;font-size:min(calc(var(--oh) * var(--fk,.026)),calc(var(--oh) * var(--ar) * .78 / (var(--len) * 1.22)));letter-spacing:.3em;white-space:nowrap;color:rgba(36,40,44,.42);text-shadow:0 1px 0 rgba(255,255,255,.55)}
.lx-tin{--fk:.05}.lx-device{--fk:.034}
.lx-tag .lx-eng span{writing-mode:vertical-rl;font-size:min(calc(var(--oh) * .05),calc(var(--oh) * .5 / (var(--len) * 1.16)));letter-spacing:.2em}
.lx-dial{position:absolute;left:50%;top:34%;width:62%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:var(--ano);box-shadow:0 10px 18px -8px rgba(0,0,0,.5)}
.lx-dial-in{position:absolute;inset:7%;border-radius:50%;background:radial-gradient(circle at 36% 30%,#fafbfc,#c4c9ce 40%,#80868c 78%,#5a5f65);transform:rotate(calc(var(--p,0) * 300deg))}
.lx-dial-mk{position:absolute;left:50%;top:12%;width:3%;height:16%;border-radius:2px;background:#2a2e32;transform-origin:50% 237%;transform:translateX(-50%) rotate(calc(-40deg + var(--p,0) * 300deg))}
.lx-slot{position:absolute;left:30%;right:30%;bottom:12%;height:1.6%;border-radius:2px;background:#2b2f33;opacity:.55}
.lx-feet{width:84%;height:100%;background:linear-gradient(90deg,#2a2d31,#4a4f55 40%,#2a2d31);border-radius:0 0 30% 30%}
.lx-ring{position:absolute;left:50%;top:-11%;width:30%;aspect-ratio:1;border-radius:50%;border:calc(var(--H,30rem) * var(--h) / 100 * var(--tk,1) * .014) solid var(--primary);border-color:color-mix(in srgb,var(--primary) 70%,#fff) var(--primary) color-mix(in srgb,var(--primary) 60%,#000) var(--primary);transform:translateX(-50%) rotateY(calc(var(--a) * .5))}
.lx-hole{position:absolute;left:50%;top:7%;width:14%;aspect-ratio:1;border-radius:50%;transform:translateX(-50%);background:var(--bg);box-shadow:inset 0 2px 3px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.6)}
.lx-tag{margin-top:calc(var(--oh) * .1)}
.lx-shadow{display:block;position:relative;height:0}
.lx-shadow::before{content:'';position:absolute;left:50%;top:-7px;width:min(78%,18rem);height:14px;transform:translateX(-46%);border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.3),rgba(0,0,0,.12) 55%,transparent)}
.lx-is-tag .lx-shadow,.lx-turn-obj:has(.lx-tag) .lx-shadow,.lx-size-obj:has(.lx-tag) .lx-shadow{display:none}
/* hero: the keynote frame; the name across the top, the object huge in the middle, cropped by the fold */
.lx-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--rule)}
.lx-hero-in{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;padding-top:clamp(1.6rem,1rem + 2.4vw,3.4rem)}
.lx-top{display:grid;justify-items:center;gap:.5rem;width:100%}
.lx-maker{font-size:.95rem;font-weight:600;color:var(--muted)}
.lx-name{max-width:100%;font-size:clamp(2.5rem,calc(90vw / (var(--len) * .8)),11rem);line-height:.92;letter-spacing:-.025em;text-wrap:balance}
.lx-sub{max-width:24rem;margin-top:1.2rem;font-size:clamp(1.05rem,1rem + .35vw,1.3rem);line-height:1.4;font-weight:500;letter-spacing:-.01em}
.lx-sub span{color:var(--muted)}
.lx-ctas{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.8rem 1.4rem;margin-top:1.4rem}
.lx-from{display:flex;align-items:baseline;gap:.4rem;font-variant-numeric:tabular-nums}
.lx-from span{color:var(--muted)}
.lx-from b{font-family:var(--font-display);font-stretch:125%;font-size:clamp(1.4rem,1.1rem + .9vw,2rem);font-weight:800;letter-spacing:-.02em}
.lx-link{font-weight:600;text-decoration-color:var(--rule)}
.lx-stand{--H:min(92vh,44rem);position:relative;width:100%;height:min(30rem,62vh);margin-top:2rem;overflow:hidden;display:grid;align-content:start}
.lx-is-tin .lx-stand{--H:38rem}.lx-is-device .lx-stand{--H:40rem}
.lx-is-tag .lx-stand{--H:50rem}
.lx-lean{display:grid;justify-items:center}
/* the stage: the photo (or its drawing) full-bleed under the name, dark in both modes; the object stands in front */
.lx-stage{position:relative;z-index:0;grid-column:1/-1;align-self:stretch;justify-self:stretch;margin-inline:calc((100% - 100vw) / 2);overflow:hidden;background:#09090a}
.lx-stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 70%}
html.m .lx-stage img{transform:scale(1.05);transition:transform 2.8s cubic-bezier(.16,1,.3,1)}
html.m.ci-go .lx-stage img{transform:none}
.lx-sub,.lx-stand,.lx-ctas{position:relative;z-index:1}
.lx-top{padding-bottom:clamp(1.2rem,.8rem + 1.6vw,2.4rem)}
.lx-stand .lx-shadow{display:none}
/* on the stage, the words and the button take the stage's light ink */
.lx-on-stage{--ink:#f3f1ec;--muted:#b8b5af;--bg:#0b0b0c;--rule:rgba(243,241,236,.3);color:var(--ink)}
/* the neon moment: one gelled rim light down the object's shadow side, the only coloured light on the stage */
.lx-hero .lx-body::after{content:'';position:absolute;top:7%;bottom:9%;right:1.2%;width:2.4%;border-radius:50%;background:linear-gradient(180deg,transparent,var(--neon) 28%,var(--neon) 72%,transparent);opacity:.75;box-shadow:0 0 16px color-mix(in srgb,var(--neon) 45%,transparent)}
.lx-hero .lx-tag .lx-body::after,.lx-hero .lx-device .lx-body::after{right:2.5%}
html.m .lx-hero .lx-body::after{opacity:0;transition:opacity 1.4s ease 1.5s}
html.m.ci-go .lx-hero .lx-body::after{opacity:.75}
html.m:not(.ci-go) .lx-hero .lx-body::after{animation:lxRim 0s 2.8s forwards}
@keyframes lxRim{to{opacity:.75}}
@media (min-width:48rem) and (max-width:59.99rem){.lx-hero-in .lx-stage{margin-inline:-2rem}}
@media (max-width:59.99rem){
.lx-top,.lx-sub,.lx-stand,.lx-ctas{grid-column:1}.lx-top{grid-row:1}.lx-sub{grid-row:2}
.lx-stage{grid-row:3/5;margin-top:1.8rem;margin-inline:-1rem}
.lx-stand{grid-row:3;margin-top:3rem;height:auto;padding-bottom:1.4rem}
.lx-hero .lx-hero-in .lx-stand{--H:min(25rem,54vh)}
.lx-hero .lx-stand .lx-shadow{display:block}
.lx-ctas{grid-row:4;margin-top:0;padding-block:.4rem 2.2rem}
}
@media (min-width:60rem){
.lx-hero-in{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:2rem;height:max(38rem,min(calc(100svh - 3.5rem),62rem))}
.lx-top{grid-column:1/-1;grid-row:1}
.lx-sub{grid-column:1;grid-row:2;align-self:end;justify-self:start;text-align:left;margin:0 0 clamp(2.5rem,1.5rem + 3vh,4rem)}
.lx-ctas{grid-column:3;grid-row:2;align-self:end;justify-self:end;justify-content:flex-end;margin:0 0 clamp(2.5rem,1.5rem + 3vh,4rem)}
.lx-stand{grid-column:2;grid-row:2;height:100%;margin-top:clamp(1.6rem,.8rem + 3vh,3.5rem);--H:min(118vh,74rem)}
.lx-stage{grid-row:2}
.lx-sub{--ink:#f3f1ec;--muted:#b8b5af;color:var(--ink)}
.lx-is-tin .lx-stand{--H:min(104vh,62rem)}.lx-is-device .lx-stand{--H:min(100vh,60rem)}
.lx-is-tag .lx-stand{--H:min(108vh,66rem)}
}
/* the turn: pinned on desktop, the object turning once while the details are read out */
.lx-turn{border-bottom:1px solid var(--rule)}
.lx-turn-stage{display:grid;align-content:center;padding-block:clamp(4rem,3rem + 5vw,8rem)}
.lx-turn-in{display:grid;gap:3rem;align-items:center}
@media (min-width:48rem){.lx-turn-in{grid-template-columns:5fr 7fr;gap:clamp(2rem,1rem + 5vw,7rem)}}
.lx-turn-obj{--H:min(70vh,42rem);display:grid;align-content:end}
.lx-turn-obj:has(.lx-tin),.lx-turn-obj:has(.lx-device){--H:min(90vh,56rem)}
.lx-turn-obj:has(.lx-tag){--H:min(80vh,48rem)}
@media (max-width:47.99rem){.lx-turn-obj{--H:24rem}.lx-turn-obj:has(.lx-tin),.lx-turn-obj:has(.lx-device),.lx-turn-obj:has(.lx-tag){--H:30rem}}
.lx-feats{margin-top:clamp(2rem,1rem + 2vw,3rem);border-top:1px solid var(--ink)}
.lx-feats li{display:grid;grid-template-columns:3.2rem 1fr;align-items:baseline;padding-block:clamp(1rem,.7rem + 1vw,1.6rem);border-bottom:1px solid var(--rule);transition:color .4s ease}
.lx-fn{font-size:.9rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted)}
.lx-ft{font-family:var(--font-display);font-stretch:125%;font-size:clamp(1.3rem,1rem + 1.3vw,2.3rem);font-weight:800;line-height:1.08;letter-spacing:-.02em}
html.m .lx-feats li{color:var(--muted)}
html.m .lx-feats li.on{color:var(--ink)}
@media (min-width:48rem) and (hover:hover){html.m .lx-turn[data-sc]{height:calc(100vh + min(var(--n,3) * 46vh,150vh))!important;height:calc(100svh + min(var(--n,3) * 46svh,150svh))!important}html.m .lx-turn-stage{height:100vh;height:100svh;padding-block:4.5rem 2rem}html.m .lx-feats li.on:not(.cur){color:var(--muted)}html.m .lx-feats li.cur{color:var(--ink)}}
/* the everyday photo */
.lx-wide-frame{overflow:hidden;aspect-ratio:4/5}
@media (min-width:48rem){.lx-wide-frame{aspect-ratio:18/9}}
.lx-wide-img{width:100%;height:114%;margin-top:-7%;object-fit:cover}
/* buy: the sizes standing side by side, prices under them */
.lx-buy-head{display:grid;gap:.6rem;max-width:44rem}
.lx-sizes{display:grid;grid-template-columns:repeat(var(--k),minmax(0,1fr));gap:clamp(1rem,1rem + 3vw,5rem);margin-top:clamp(2.5rem,1.5rem + 3vw,4.5rem);max-width:52rem}
.lx-sizes li{display:grid;align-content:end;gap:.2rem}
.lx-size-obj{--H:clamp(13rem,9rem + 16vw,28rem);display:grid;align-content:end;height:var(--H);margin-bottom:1.6rem}
.lx-size-obj:has(.lx-tin),.lx-size-obj:has(.lx-device),.lx-size-obj:has(.lx-tag){--H:clamp(16rem,10rem + 18vw,30rem)}
.lx-size-name{font-weight:600;letter-spacing:-.01em}
.lx-size-price{font-family:var(--font-display);font-stretch:125%;font-size:clamp(1.8rem,1.4rem + 1.6vw,3rem);font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.lx-size-note{color:var(--muted)}
.lx-buy-row{display:grid;gap:1.5rem;margin-top:clamp(2rem,1.5rem + 2vw,3.5rem);align-items:start}
@media (min-width:56rem){.lx-buy-row{grid-template-columns:auto minmax(0,1fr);gap:1.5rem 4rem}.lx-buy-row .lx-facts{grid-column:2;grid-row:1 / span 3}}
.lx-price{display:flex;align-items:baseline;gap:.5rem;font-variant-numeric:tabular-nums}
.lx-price span{color:var(--muted)}
.lx-price b{font-family:var(--font-display);font-stretch:125%;font-size:clamp(2rem,1.5rem + 1.8vw,3.2rem);font-weight:800;letter-spacing:-.02em}
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
.lx-side{font-family:var(--font-body);font-stretch:100%;font-size:.95rem;font-weight:600;letter-spacing:0;color:var(--muted)}
.lx-say{font-family:var(--font-display);font-stretch:125%;font-size:clamp(1.5rem,1.1rem + 1.8vw,2.8rem);font-weight:800;line-height:1.12;letter-spacing:-.02em;max-width:26ch}
.lx-say.more{margin-top:1.4rem;font-family:var(--font-body);font-stretch:100%;font-weight:500;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.4;max-width:36ch;color:var(--muted)}
.lx-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--ink);padding:1.4rem 0 0}
/* questions: a spec list, every answer open */
.lx-asked{border-top:1px solid var(--rule)}
.lx-asked-in{display:grid;gap:2rem}
@media (min-width:56rem){.lx-asked-in{grid-template-columns:5fr 7fr;gap:4rem}}
.lx-asked dl{border-top:1px solid var(--ink)}
.lx-asked dl div{display:grid;gap:.35rem;padding-block:1.2rem;border-bottom:1px solid var(--rule)}
@media (min-width:40rem){.lx-asked dl div{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:2rem}}
.lx-asked dt{font-weight:700;letter-spacing:-.01em}
.lx-asked dd{color:var(--muted)}
/* footer: an ink band, the name set wide and large */
.lx-ftr{background:var(--ink);color:var(--bg);border-top:0;padding-block:clamp(3.5rem,2.5rem + 3vw,6rem) 2rem;--muted:color-mix(in srgb,var(--bg) 70%,var(--ink))}
.lx-ftr .ftr-name{font-family:var(--font-display);font-stretch:125%;font-size:clamp(1.8rem,1.2rem + 2.2vw,3.2rem);font-weight:800;letter-spacing:-.02em;line-height:1}
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
.lx-bar-t strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-display);font-stretch:125%;font-weight:800;letter-spacing:-.01em}
.lx-bar-t span{font-size:.9rem;color:var(--muted);font-variant-numeric:tabular-nums}
html.m .lx-bar{transform:translateY(120%);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
html.m .lx-bar.on{transform:none}
/* dark: the hall with the house lights down; panels and the footer are graphite, never an inverted band */
html[data-theme="dark"] .menu-panel{background:color-mix(in srgb,var(--bg) 90%,var(--ink));color:var(--ink);border:1px solid var(--rule)}
html[data-theme="dark"] .menu-panel li a{color:var(--ink);border-bottom-color:var(--rule)}
html[data-theme="dark"] .menu-panel .btn-primary{background:var(--ink);color:var(--bg)}
html[data-theme="dark"] .lx-ftr{background:color-mix(in srgb,var(--bg) 55%,#000);color:var(--ink);border-top:1px solid var(--rule);--muted:color-mix(in srgb,var(--ink) 66%,var(--bg))}
html[data-theme="dark"] .lx-ftr a{color:var(--ink)}
html[data-theme="dark"] .lx-ftr .ftr-base{border-top-color:var(--rule)}
html[data-theme="dark"] .lx-ftr .mpause{color:var(--ink);border-color:var(--rule)}
html[data-theme="dark"] .lx-shadow::before{background:radial-gradient(closest-side,rgba(0,0,0,.6),rgba(0,0,0,.25) 55%,transparent)}
html[data-theme="dark"] .lx-hero{border-bottom-color:transparent}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Launch',
  bestFor: 'One hero product: a bottle, a candle, a gadget, a kit, sold with one Buy button',
  why: 'Built to sell one product like a launch keynote: your name set wide across the top, the product drawn in steel standing huge under it, poured onto the page and turning once as you scroll while its details are read out, and the sizes standing side by side with their prices.',
  fonts: { q: 'family=Mona+Sans:wdth,wght@125,800&family=Public+Sans:wght@400..600', display: ['Mona Sans', 'grotesk'], body: ['Public Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): poured onto the page, a product you can nudge, turned once on the scroll.
  choreo: { intro: 'pour', alive: ['pointer', 'tap'], scroll: 'pin', pace: 'medium', look: 'launch keynote, steel on warm paper, one slow turn' },
  modes: ['light', 'dark'],
  tokens,
  slots,
  nav,
  art,
  render,
};
