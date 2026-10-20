// Nightfall (animated, product, for a maker with a story): a cinematic scroll story at night, ending at the work.
//   Object:   the maker's piece, drawn: their knives (or bottles, for a distiller) hung on a rack at their real
//             lengths, at the end of a walk down a valley at night toward a workshop with its door lit.
//   Material: night air, steel and walnut: five ridgelines, each paler with distance, fog lying between them, a
//             treeline on the near ridges, film grain over all of it; the only warm light comes from the open door.
//             A serif set like a film title.
//   One move: the scene is uncovered from the bottom up as the name rises out of its baseline (the mask intro); then
//             the scroll walks a camera down the valley, plane by plane, chapter by chapter, until the door fills the
//             frame; backwards on the way up.
//   Pop:      the member's colour is one drawn line per chapter: the route of the story, the hairlines that set out
//             the piece's details, and the price marks on the rack.
// At rest the smoke from the chimney drifts and the piece leans toward the pointer. The camera is the choreo
// runtime's scene progress (--p on the story, measured while its stage is stuck); this design's own script adds each
// chapter's progress. After the story: the workshop photo with its caption, kind words, and the member's questions
// as a list. Reduced motion and no script: the scene is a still behind the first chapter and the chapters read as a
// normal page. Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { rng } = require('../../art');
const { draftCopy } = require('../../copy');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');

const id = 'nightfall';

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.1), '#05070a', 0.8) };
}

function product(c) {
  return c.productName || c.name;
}

// What the maker makes, for the drawings: knives, bottles, or neither (then the member's photos stand alone).
function kindOf(c) {
  const s = `${c.what || ''} ${c.name} ${c.services.map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\b(knife|knives|blades?|knifemaker|bladesmith|gyuto|santoku|nakiri|petty|cleaver)\b/.test(s)) return 'knife';
  if (/\b(whisk(e)?y|sake|gin|rum|mezcal|spirits?|distill\w*|bourbon|brandy|vodka)\b/.test(s)) return 'bottle';
  return '';
}

function slots(c) {
  const g = c.profile.gallery || [];
  const name = product(c);
  return [
    { slot: 'hero', file: 'product.jpg', w: 1400, h: 1100, style: 'object', alt: c.profile.hero && !/^the product/i.test(c.profile.hero) ? c.profile.hero : `${name}, up close` },
    { slot: 'work', file: 'workshop.jpg', w: 1600, h: 1000, style: 'sweep', alt: g[1] || `Where ${c.name} is made` },
  ];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText;
  return c.priceText || '';
}

// The member's own words only: the generated about ("X makes Y. Write to Z...") repeats the page.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length || /^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

// The member's questions, less any whose answer is already on the page as shipping or returns.
function questions(c) {
  const shown = [c.shipping, c.returns].filter(Boolean).map((x) => x.replace(/[.\s]+$/, '').toLowerCase());
  return c.faq.filter((q) => !shown.some((x) => String(q.a).toLowerCase().includes(x)));
}

function nav(c) {
  return [
    { label: 'Story', href: '#story' },
    c.services.length > 1 && { label: 'The rack', href: '#buy' },
    questions(c).length >= 2 && { label: 'Questions', href: '#asked' },
    c.buy ? { label: 'Buy', href: '#buy' } : { label: 'Waitlist', href: '#signup' },
  ].filter((x, i, a) => x && a.findIndex((y) => y && y.href === x.href) === i);
}

// Split a story told as one paragraph into sentences, never inside an email address, a URL or a decimal.
function sentences(s) {
  const out = String(s).split(/(?<=[.!?])\s+(?=[A-Z"“'(])/).map((x) => x.trim()).filter(Boolean);
  if (out.length < 3) return out.length ? [out.join(' ')] : [];
  const half = Math.ceil(out.length * 0.6);
  return [out.slice(0, half).join(' '), '', out.slice(half).join(' ')];
}

function num(i) {
  return `<p class="nf-num" aria-hidden="true"><span>${String(i + 1).padStart(2, '0')}</span></p>`;
}

// A ridgeline across the 1600 x 900 frame: a smooth sum of waves (deterministic from the business name), optionally
// edged with a ragged treeline, closed down to the bottom. lo/hi are its height range; dip opens a valley mid-frame.
function ridge(r, { lo, hi, step = 20, trees = 0, dip = 0 }) {
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3];
  const pts = [];
  for (let x = -40; x <= 1640; x += step) {
    const u = x / 1600;
    let y = 0.5 + 0.28 * Math.sin(u * 3.1 + ph[0]) + 0.16 * Math.sin(u * 7.3 + ph[1]) + 0.07 * Math.sin(u * 17 + ph[2]);
    y -= dip * Math.exp(-Math.pow((u - 0.5) / 0.16, 2));
    let yy = hi + (lo - hi) * Math.min(1, Math.max(0, 1 - y));
    if (trees) yy -= (r() * 0.7 + 0.3) * trees * (x % (step * 2) === 0 ? 1 : 0.35);
    pts.push(`${x} ${yy.toFixed(0)}`);
  }
  return `M${pts.join('L')}L1640 900L-40 900Z`;
}

// The scene: planes back to front, each its own SVG so the camera can move it at its own depth.
function scene(seed) {
  const r = rng(`${seed}:night`);
  const svg = (cls, inner) => `<svg class="nf-l ${cls}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`;
  const fog = (cls) => `<div class="nf-fog ${cls}"></div>`;
  // The workshop: a low shed with a chimney, its door open on the forge; the door's light falls on the ground.
  const shop = `<g class="nf-shop"><path class="nf-shed" d="M712 742V676L800 632 888 676V742Z"/><path class="nf-shed" d="M846 652V612H862V662Z"/><path class="nf-door" d="M786 742V694H814V742Z" fill="url(#nfd)"/><path d="M727 704h22v14h-22Z" class="nf-win"/><path class="nf-spill" d="M786 742H814L878 830H722Z" fill="url(#nfs)"/><g class="nf-smoke" data-alive="0.6"><path d="M854 604C846 588 866 576 856 558S872 532 864 514"/><path d="M856 596C870 584 858 566 874 552"/></g></g>`;
  return `<div class="nf-stage" aria-hidden="true" data-sc-stage data-ci="subject">
<div class="nf-sky"></div>
${svg('nf-r5', `<path d="${ridge(r, { lo: 560, hi: 430, step: 32 })}"/>`)}
${fog('f1')}
${svg('nf-r4', `<path d="${ridge(r, { lo: 640, hi: 500, step: 26 })}"/>`)}
${fog('f2')}
${svg('nf-r3', `<path d="${ridge(r, { lo: 720, hi: 560, step: 14, trees: 16, dip: 0.3 })}"/>`)}
${svg('nf-r2', `<defs><linearGradient id="nfd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd59a"/><stop offset="1" stop-color="#e0782e"/></linearGradient><linearGradient id="nfs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35c" stop-opacity=".34"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></linearGradient></defs><path d="${ridge(r, { lo: 860, hi: 610, step: 12, trees: 26, dip: 0.9 })}"/>${shop}`)}
${fog('f3')}
${svg('nf-r1', `<path d="${ridge(r, { lo: 1000, hi: 520, step: 10, trees: 44, dip: 2.2 })}"/>`)}
<div class="nf-grain"></div><div class="nf-vig"></div>
</div>`;
}

// One knife, hung blade down: walnut handle, a dark ferrule, the blade (its shape from its name, its length from
// the number in it, in millimetres), and a drawn temper line along the edge. Units are millimetres.
function knife(s, gid = 'nf') {
  const n = String(s.name || '');
  const m = n.match(/\b(\d{2,3})\b/);
  const L = m ? Math.min(330, Math.max(70, +m[1])) : 180;
  const flat = /nakiri|usuba|cleaver|chuka|kiritsuke/i.test(n);
  const slim = /petty|paring|utility|honesuki/i.test(n);
  const W = flat ? 50 : slim ? 24 : 46;
  const H = 120;
  const top = H + 10;
  const blade = flat
    ? `M8 ${top}H${8 + W}V${top + L - 6}Q${8 + W} ${top + L} ${2 + W} ${top + L}H8Z`
    : `M8 ${top}H${8 + W}V${top + L * 0.5}C${8 + W} ${top + L * 0.84} ${8 + W * 0.55} ${top + L * 0.97} 8 ${top + L}Z`;
  const edge = flat
    ? `M${W - 4} ${top + 8}V${top + L - 10}`
    : `M${W - 4} ${top + 8}V${top + L * 0.5}C${W - 4} ${top + L * 0.8} ${8 + W * 0.45} ${top + L * 0.93} 12 ${top + L - 8}`;
  return { L, w: W + 16, h: top + L, body: `<rect class="nf-hd" x="${8 + W * 0.2}" y="0" width="${W * 0.6}" height="${H}" rx="${W * 0.18}" fill="url(#${gid}w)"/><rect x="${6 + W * 0.15}" y="${H - 2}" width="${W * 0.7 + 4}" height="12" rx="2" fill="#20242a"/><path d="${blade}" fill="url(#${gid}s)"/><path class="nf-ham" d="${edge}" pathLength="1"/>` };
}
const STEEL_DEFS = (gid) => `<linearGradient id="${gid}s" x1="0" x2="1"><stop offset="0" stop-color="#5c636b"/><stop offset=".35" stop-color="#9aa2aa"/><stop offset=".7" stop-color="#d9dde1"/><stop offset="1" stop-color="#f2f4f5"/></linearGradient><linearGradient id="${gid}w" x1="0" x2="1"><stop offset="0" stop-color="#3a2416"/><stop offset=".5" stop-color="#6b4528"/><stop offset="1" stop-color="#2c1a10"/></linearGradient>`;

function rack(items) {
  const ks = items.map((s) => knife(s, 'nk'));
  const maxH = Math.max(...ks.map((k) => k.h));
  return `<div class="nf-rack"><svg width="0" height="0" class="nf-defs" aria-hidden="true"><defs>${STEEL_DEFS('nk')}</defs></svg><i class="nf-bar" aria-hidden="true"></i>
<ul>${items.map((s, i) => `<li><svg class="nf-knife" viewBox="0 0 ${ks[i].w} ${ks[i].h}" style="--kh:${(ks[i].h / maxH).toFixed(3)}" aria-hidden="true">${ks[i].body}</svg><p class="nf-kn">${esc(s.name)}</p>${s.priceText ? `<p class="nf-kp"><i aria-hidden="true"></i>${esc(s.priceText)}</p>` : ''}${s.blurb ? `<p class="nf-kb">${esc(s.blurb)}</p>` : ''}</li>`).join('')}</ul></div>`;
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const kind = kindOf(c);
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const kick0 = name !== c.name ? c.name : c.heroTitle !== name ? c.heroTitle : c.whatShort || '';
  const kick = kick0 && !norm(sub).includes(norm(kick0)) ? kick0 : '';
  const own = ownAbout(c);
  // The member's story, split across chapters two and three by sentence when it came as one paragraph.
  const paras = own.length > 1 ? own : sentences(own[0] || '');
  const specs = c.included.slice(0, 5);

  const ch1 = `<article class="nf-ch nf-ch1" aria-labelledby="hero-title"><div class="nf-ch-in">
${num(0)}
${kick ? `<p class="nf-kick" data-ci="then" data-ci-from="mask">${esc(kick)}</p>` : ''}
<h1 id="hero-title" data-ci="head" class="nf-name${[...name].length > 14 ? ' long' : ''}">${esc(name)}</h1>
<p class="nf-sub" data-ci="then" data-ci-from="mask">${esc(sub)}</p>
<div class="nf-ctas" data-ci="then" data-ci-from="fade">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>
</div></article>`;

  const where = c.city && !c.online ? c.city : '';
  const ch2 = `<article class="nf-ch nf-ch2" aria-labelledby="ch2-title"><div class="nf-ch-in">
${num(1)}
<h2 class="nf-h2" id="ch2-title" data-split>${esc(c.owner && c.owner !== c.name ? `${c.owner}${where ? `, ${where}` : ''}` : where ? `From ${where}` : `About ${c.name}`)}</h2>
${paras.slice(0, 2).filter(Boolean).map((p, i) => `<p class="nf-p" data-rv style="--d:${i + 2}">${esc(p)}</p>`).join('\n')}
<svg class="nf-route" viewBox="0 0 400 120" aria-hidden="true"><path d="M8 96C60 92 70 40 120 46S180 104 236 82 300 20 352 30 388 54 392 50" pathLength="1"/></svg>
</div></article>`;

  const ch3 = `<article class="nf-ch nf-ch3" aria-labelledby="ch3-title"><div class="nf-ch-in nf-show">
<div class="nf-show-copy">
${num(2)}
<h2 class="nf-h2" id="ch3-title" data-split>${esc(name !== c.name ? name : kind === 'knife' ? 'In the hand.' : kind === 'bottle' ? 'In the glass.' : 'The work.')}</h2>
${paras[2] ? `<p class="nf-p" data-rv style="--d:2">${esc(paras[2])}</p>` : ''}
${specs.length ? `<ul class="nf-specs">${specs.map((x, i) => `<li style="--j:${i}"><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
</div>
<div class="nf-plinth"><div class="nf-piece" data-alive="0.8">${P.img(c, 'hero', { cls: 'nf-img' })}<span class="nf-rim" aria-hidden="true"></span></div></div>
</div></article>`;

  const facts = [c.shipping && ['Shipping', esc(c.shipping)], c.returns && ['Returns', esc(c.returns)], c.email && ['Questions', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]].filter(Boolean);
  const priced = c.services.filter((s) => s.name);
  const hung = kind === 'knife' && priced.length > 1;
  const endTitle = waitlist ? c.ctaTitle : priced.length > 1 ? 'Choose yours.' : `${name}, from the bench.`;
  const list = priced.length > 1 && !hung ? `<ul class="nf-list">${priced.map((s) => `<li><span>${esc(s.name)}${s.blurb ? `<small>${esc(s.blurb)}</small>` : ''}</span><i aria-hidden="true"></i>${s.priceText ? `<b>${esc(s.priceText)}</b>` : ''}</li>`).join('')}</ul>` : '';
  const ch4 = `<article class="nf-ch nf-ch4" id="${waitlist ? 'signup' : 'buy'}" aria-labelledby="buy-title"><div class="nf-ch-in nf-end">
${num(3)}
<h2 class="nf-h2 big" id="buy-title" data-split>${esc(endTitle)}</h2>
${waitlist && c.ctaSub ? `<p class="nf-p" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p>` : ''}
${hung ? rack(priced) : list}
${waitlist
  ? `<div class="nf-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `<div class="nf-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price && priced.length < 2 ? `<span class="nf-from">${esc(price)}</span>` : ''}</div>`}
${facts.length ? `<dl class="nf-facts" data-rv style="--d:4">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
</div></article>`;

  const story = `<section class="nf-story" id="story" data-sc aria-label="${esc(`The story of ${name}`)}">
${scene(c.name)}
${ch1}
${ch2}
${ch3}
${ch4}
</section>`;

  const work = c.images.work
    ? `<section class="nf-work" aria-label="${esc(`Where ${c.name} is made`)}"><figure class="wrap nf-work-in"><div class="nf-work-frame">${P.img(c, 'work', { cls: 'nf-work-img' }).replace('<img ', '<img data-par="0.05" ')}</div><figcaption><span>${esc(c.owner && c.owner !== c.name ? `${c.owner}, ${c.name}` : c.name)}</span>${where ? `<span>${esc(where)}</span>` : ''}</figcaption></figure></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="nf-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="nf-h2" id="reviews-title">Kind words</h2><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';
  const qs = questions(c);
  const asked = qs.length >= 2
    ? `<section class="nf-sec" id="asked" aria-labelledby="asked-title"><div class="wrap nf-asked"><h2 class="nf-h2" id="asked-title">Asked at the bench.</h2><dl>${qs.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>`
    : '';

  const m = motion();
  const body = [P.header(c, { cls: 'nf-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', story, work, reviews, asked, '</main>', P.footer(c, { cls: 'nf-ftr' }), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '2px', radiusSm: '2px', btnRadius: '2px', max: '80rem' } };
}

// The camera is the choreo runtime's scene progress (--p on the story, measured while the stage is stuck). This adds
// each chapter's own progress (--k) for its type and drawings. Off for reduced motion.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,st=d.querySelector('.nf-story');if(!st)return;var chs=[].slice.call(st.querySelectorAll('.nf-ch')),t=false;
function cl(v){return v<0?0:v>1?1:v}
function f(){t=false;var vh=innerHeight;chs.forEach(function(c){var b=c.getBoundingClientRect();c.style.setProperty('--k',cl((vh-b.top)/(b.height+vh)).toFixed(4))})}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f()})();`;

// Drawn placeholders (T.art): the piece itself on dark cloth under a raking light, and nothing else (the workshop
// photo keeps the plain light, for the member to replace).
function art(slot, { c, seed, art: A }) {
  if (slot.slot !== 'hero') return null;
  const kind = kindOf(c);
  if (!kind) return null;
  const { w, h } = slot;
  const r = A.rng(`${seed}:piece`);
  const bg = `<radialGradient id="bg" cx=".32" cy=".3" r=".9"><stop offset="0" stop-color="#2a2d33"/><stop offset=".55" stop-color="#15171b"/><stop offset="1" stop-color="#08090b"/></radialGradient><filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" seed="${Math.floor(r() * 90)}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>`;
  let body;
  if (kind === 'knife') {
    const k = knife(c.services[0] || { name: c.name }, 'a');
    const s = (h * 1.18) / k.h;
    const shadow = k.body.replace(/fill="[^"]*"/g, 'fill="#000"').replace('class="nf-ham"', 'fill="none"');
    body = `<g transform="translate(${w * 0.5} ${h * 0.52}) rotate(-58) translate(${(-k.w * s) / 2} ${(-k.h * s) / 2}) scale(${s.toFixed(3)})"><g transform="translate(16 10)" opacity=".75" filter="url(#sh)">${shadow}</g>${k.body.replace('class="nf-ham"', 'fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"')}</g>`;
  } else {
    const bw = w * 0.2;
    const bh = h * 0.62;
    const x = w * 0.5 - bw / 2;
    const y = h * 0.86 - bh;
    body = `<ellipse cx="${w * 0.5}" cy="${h * 0.86}" rx="${bw * 0.8}" ry="14" fill="#000" opacity=".6" filter="url(#sh)"/><path d="M${x} ${y + bh * 0.32}Q${x} ${y + bh * 0.22} ${x + bw * 0.32} ${y + bh * 0.17}V${y}H${x + bw * 0.68}V${y + bh * 0.17}Q${x + bw} ${y + bh * 0.22} ${x + bw} ${y + bh * 0.32}V${y + bh}H${x}Z" fill="url(#as)"/><rect x="${x + bw * 0.12}" y="${y + bh * 0.5}" width="${bw * 0.76}" height="${bh * 0.26}" fill="#e9e1d2" opacity=".85"/>`;
  }
  return A.svgDoc(w, h, `${bg}${STEEL_DEFS('a')}`, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${body}<rect width="${w}" height="${h}" filter="url(#gr)"/>`);
}

const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E";

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);--night:color-mix(in srgb,#1d2a3a 55%,var(--dark));--air:#8fa1b3;--forge:#ffb35c;background:var(--dark);color:var(--on-dark)}
h1,h2,h3{font-weight:400;letter-spacing:-.01em}
.btn-sm{min-height:2.5rem;padding:.45rem 1.05rem;font-size:.875rem}
.btn{letter-spacing:.04em}
.btn-primary{box-shadow:none}
.hdr{position:fixed;left:0;right:0;top:0;z-index:30;transition:background-color .3s ease}
.hdr.scrolled{background:var(--dark);border-bottom:1px solid var(--edge)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;text-decoration:none}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .8rem;font-size:.84rem;letter-spacing:.06em;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--on-dark)}
.menu>summary{background:transparent;border-color:var(--edge);color:var(--on-dark);border-radius:2px}
.menu-panel{background:var(--dark);border-color:var(--edge)}
.menu-panel li a{font-family:var(--font-display);font-size:2.2rem;font-weight:400;border-bottom-color:var(--edge)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.nf-kick{font-size:1rem;font-weight:500;color:color-mix(in srgb,var(--on-dark) 82%,var(--dark))}
.nf-h2{font-size:clamp(2.4rem,1.6rem + 3.4vw,4.6rem);line-height:1;text-wrap:balance}
.nf-h2.big{font-size:clamp(2.8rem,1.8rem + 4.4vw,6rem)}
.nf-p{margin-top:1.2rem;max-width:34rem;font-size:clamp(1.05rem,1rem + .3vw,1.25rem);line-height:1.65;color:color-mix(in srgb,var(--on-dark) 86%,var(--dark));text-wrap:pretty}
.nf-num{display:flex;align-items:center;gap:.9rem;margin-bottom:1.4rem;font-family:var(--font-display);font-style:italic;font-size:1.25rem;color:color-mix(in srgb,var(--on-dark) 80%,var(--dark))}
.nf-num::after{content:'';width:3.5rem;height:1px;background:currentColor;opacity:.6}
/* the scene */
.nf-story{--p:0;position:relative;isolation:isolate}
.nf-stage{position:absolute;left:0;right:0;top:0;height:100vh;height:100svh;overflow:hidden;z-index:0;background:var(--dark);pointer-events:none}
html.m .nf-stage{position:sticky;margin-bottom:-100vh;margin-bottom:-100svh}
.nf-defs{position:absolute}
.nf-sky{position:absolute;inset:0;background:linear-gradient(180deg,var(--dark) 0%,var(--night) 48%,color-mix(in srgb,var(--air) 22%,var(--night)) 72%,var(--night) 100%)}
.nf-sky::before{content:'';position:absolute;inset:0 0 50%;background-image:radial-gradient(1px 1px at 12% 22%,var(--on-dark),transparent),radial-gradient(1px 1px at 28% 12%,var(--on-dark),transparent),radial-gradient(1px 1px at 44% 28%,var(--on-dark),transparent),radial-gradient(1px 1px at 63% 9%,var(--on-dark),transparent),radial-gradient(1px 1px at 78% 24%,var(--on-dark),transparent),radial-gradient(1px 1px at 90% 14%,var(--on-dark),transparent),radial-gradient(1px 1px at 6% 40%,var(--on-dark),transparent);opacity:.4}
.nf-l{position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 80%;transform:translate3d(0,calc(var(--p) * var(--dy,0vh)),0) scale(calc(1 + var(--p) * var(--z,0)));will-change:transform}
.nf-r5{--z:.12;fill:color-mix(in srgb,var(--air) 34%,var(--night))}
.nf-r4{--z:.35;--dy:2vh;fill:color-mix(in srgb,var(--air) 22%,var(--night))}
.nf-r3{--z:.9;--dy:5vh;fill:color-mix(in srgb,var(--air) 11%,var(--dark))}
.nf-r2{--z:1.3;--dy:6vh;fill:color-mix(in srgb,var(--air) 5%,var(--dark));transform-origin:50% 80%}
.nf-r1{--z:4.5;--dy:16vh;fill:#030405;opacity:clamp(0,calc((.55 - var(--p)) * 5),1)}
.nf-shed{fill:#0a0c0f}
.nf-win{fill:#ffb35c;opacity:.55}
.nf-smoke path{fill:none;stroke:color-mix(in srgb,var(--air) 40%,var(--night));stroke-width:5;stroke-linecap:round;opacity:.45}
.nf-fog{position:absolute;left:-20%;right:-20%;height:22%;transform:translate3d(calc(var(--p) * var(--fx,-6vw)),calc(var(--p) * var(--dy,0vh)),0);background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--air) 30%,transparent) 50%,transparent)}
.nf-fog.f1{top:50%;opacity:.5}
.nf-fog.f2{top:58%;--fx:8vw;--dy:3vh;opacity:.45}
.nf-fog.f3{top:72%;--fx:-14vw;--dy:10vh;opacity:.55;height:28%}
.nf-grain{position:absolute;inset:0;background-image:url("${GRAIN}");opacity:.7;mix-blend-mode:overlay}
.nf-vig{position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--dark) 78%,transparent),transparent 58%),linear-gradient(180deg,color-mix(in srgb,var(--dark) 70%,transparent),transparent 22%)}
@media (max-width:47.99rem){.nf-vig{background:linear-gradient(0deg,color-mix(in srgb,var(--dark) 88%,transparent) 22%,transparent 64%)}html.m .nf-ch3 .nf-ch-in{position:relative;opacity:1}html.m .nf-ch3{min-height:0}.nf-plinth{max-width:22rem}}
/* chapters */
.nf-ch{position:relative;z-index:1;--k:.4}
.nf-ch-in{display:grid;justify-items:start;padding:clamp(5rem,4rem + 6vh,8rem) 0 clamp(4rem,3rem + 4vh,6rem);width:min(100% - 2rem,var(--max));margin-inline:auto;text-shadow:0 2px 24px color-mix(in srgb,#000 60%,transparent)}
@media (min-width:48rem){.nf-ch-in{width:min(100% - 5rem,var(--max))}}
.nf-ch1 .nf-ch-in{min-height:100vh;min-height:100svh;align-content:center}
html.m .nf-ch{min-height:150vh;min-height:150svh}
html.m .nf-ch1{min-height:130vh;min-height:130svh}
html.m .nf-ch-in{position:sticky;top:0;min-height:100vh;min-height:100svh;align-content:center;opacity:clamp(0,min(calc((var(--k) - .06) * 6),calc((.84 - var(--k)) * 7)),1)}
html.m .nf-ch1 .nf-ch-in{opacity:clamp(0,calc((.6 - var(--k)) * 8),1)}
html.m .nf-ch4{min-height:120vh;min-height:120svh}
html.m .nf-ch4::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,transparent 18%,color-mix(in srgb,var(--dark) 78%,transparent) 52%,color-mix(in srgb,var(--dark) 90%,transparent))}
.nf-ch4 .nf-ch-in{position:relative;z-index:1}
html.m .nf-ch4 .nf-ch-in{position:relative;opacity:clamp(0,calc((var(--k) - .08) * 6),1)}
.nf-name{margin-top:.6rem;font-size:clamp(3.4rem,1rem + 10vw,10.4rem);line-height:.94;letter-spacing:-.025em;max-width:12ch;text-wrap:balance}
.nf-name.long{font-size:clamp(3rem,1rem + 8vw,9rem);max-width:11ch}
.nf-sub{margin-top:1.4rem;max-width:30rem;font-size:clamp(1.15rem,1rem + .6vw,1.5rem);line-height:1.45;color:color-mix(in srgb,var(--on-dark) 88%,var(--dark));text-wrap:balance}
.nf-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.4rem;margin-top:2rem}
.nf-from{font-size:1.05rem;color:var(--muted);letter-spacing:.04em}
.nf-route{width:min(100%,26rem);margin-top:2rem;overflow:visible}
.nf-route path{fill:none;stroke:var(--pop);stroke-width:2;stroke-linecap:round}
html.m .nf-route path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--k) - .3) * 3,1))}
.nf-show{gap:2.5rem}
@media (min-width:56rem){.nf-show{grid-template-columns:1fr 1fr;align-items:center;gap:4rem}}
.nf-specs{display:grid;gap:.2rem;margin-top:1.8rem;width:100%;max-width:30rem}
.nf-specs li{display:flex;align-items:center;gap:1rem;padding:.7rem 0;font-size:1rem;line-height:1.4}
.nf-specs li::before{content:'';flex:none;width:3.5rem;height:1px;background:var(--pop);transform-origin:0 50%}
html.m .nf-specs li{opacity:clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 14),1);transform:translateX(calc((1 - clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 14),1)) * 24px))}
html.m .nf-specs li::before{transform:scaleX(clamp(0,calc((var(--k) - .26 - var(--j) * .045) * 10),1))}
.nf-plinth{position:relative;width:100%;max-width:32rem;justify-self:center}
.nf-piece{position:relative;overflow:hidden;width:100%;aspect-ratio:14/11;border-radius:2px;box-shadow:0 40px 80px -30px #000,0 0 0 1px var(--edge)}
.nf-img{width:100%;height:100%;object-fit:cover}
.nf-rim{position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,color-mix(in srgb,var(--on-dark) 30%,transparent) 50%,transparent 62%);mix-blend-mode:screen;transform:translateX(-60%)}
html.m .nf-rim{transform:translateX(calc(-80% + clamp(0,(var(--k) - .2) * 2.6,1) * 160%))}
html.m .nf-plinth{transform:translate3d(0,calc((1 - clamp(0,(var(--k) - .1) * 4,1)) * 12vh),0)}
/* the rack: knives hung blade down at their real lengths, name and price under each */
.nf-end{text-align:left}
.nf-rack{position:relative;width:100%;margin-top:2.2rem;text-shadow:none}
.nf-bar{display:block;height:14px;border-radius:2px;background:linear-gradient(180deg,#6b4528,#3a2416);box-shadow:0 10px 20px -8px #000}
.nf-rack ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(6.4rem,1fr));gap:1.5rem clamp(1rem,.5rem + 2vw,3rem);max-width:58rem}
.nf-rack li{display:grid;justify-items:start;align-content:start}
.nf-knife{display:block;width:auto;height:calc(var(--kh) * clamp(15rem,8rem + 24vh,26rem));margin:-4px 0 1.1rem clamp(.2rem,1vw,1.2rem);filter:drop-shadow(0 18px 18px rgba(0,0,0,.55))}
.nf-ham{fill:none;stroke:#fff;stroke-opacity:.5;stroke-width:1.2}
html.m .nf-ham{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--k) - .25) * 3,1))}
.nf-kn{font-family:var(--font-display);font-size:clamp(1.2rem,1rem + .6vw,1.6rem);line-height:1.1}
.nf-kp{display:flex;align-items:center;gap:.6rem;margin-top:.35rem;font-size:1.05rem;font-variant-numeric:tabular-nums;letter-spacing:.03em}
.nf-kp i{display:block;width:1.6rem;height:1px;background:var(--pop)}
.nf-kb{margin-top:.35rem;max-width:16rem;font-size:.92rem;color:var(--muted)}
.nf-list{width:min(100%,40rem);margin-top:2rem;border-top:1px solid var(--edge)}
.nf-list li{display:flex;align-items:baseline;gap:.8rem;padding:1rem 0;border-bottom:1px solid var(--edge)}
.nf-list span{display:grid;font-family:var(--font-display);font-size:1.4rem}
.nf-list small{font-family:var(--font-body);font-size:.92rem;color:var(--muted)}
.nf-list i{flex:1;border-bottom:1px dotted var(--edge)}
.nf-list b{font-weight:500;font-variant-numeric:tabular-nums}
.nf-form{width:min(100%,30rem);margin-top:2rem}
.nf-facts{display:grid;width:min(100%,34rem);margin-top:2rem;text-shadow:none}
.nf-facts div{display:grid;grid-template-columns:7rem minmax(0,1fr);gap:1rem;padding:.7rem 0;border-top:1px solid var(--edge)}
.nf-facts dt{font-weight:500}
.nf-facts dd{margin:0;color:var(--muted)}
.nf-facts a{color:var(--on-dark)}
.field input,.field select,.field textarea{background:transparent;border:0;border-bottom:1px solid var(--edge);border-radius:0;padding-inline:0}
/* after the story */
.nf-sec{position:relative;z-index:1;padding-block:clamp(5rem,3.5rem + 5vw,9rem);border-top:1px solid var(--edge);background:var(--dark)}
.nf-asked{display:grid;gap:2rem}
@media (min-width:60rem){.nf-asked{grid-template-columns:.8fr 1.2fr;gap:4rem}}
.nf-asked dl div{padding:1.3rem 0;border-bottom:1px solid var(--edge)}
.nf-asked dt{font-family:var(--font-display);font-size:1.5rem;line-height:1.2}
.nf-asked dd{margin-top:.4rem;color:var(--muted)}
.review{background:transparent;border-color:var(--edge)}
.nf-work{position:relative;z-index:1;background:var(--dark);padding-block:0 clamp(4rem,3rem + 4vw,7rem)}
.nf-work-frame{overflow:hidden;aspect-ratio:4/5;border-radius:2px}
@media (min-width:48rem){.nf-work-frame{aspect-ratio:16/8}}
.nf-work-img{width:100%;height:112%;margin-top:-6%;object-fit:cover;filter:saturate(.7) brightness(.85)}
.nf-work figcaption{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.4rem 2rem;padding-top:1rem;font-size:.95rem;color:var(--muted)}
.nf-work figcaption span:first-child{color:var(--on-dark)}
/* footer: set like end credits, centred, the name in the title face */
.nf-ftr{position:relative;z-index:1;background:var(--dark);border-top:1px solid var(--edge);text-align:center}
.nf-ftr .ftr-in{justify-items:center;grid-template-columns:1fr!important}
.nf-ftr .ftr-name{font-family:var(--font-display);font-size:clamp(2rem,1.5rem + 2vw,3.2rem);font-weight:400}
.nf-ftr .ftr-links{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem 1.6rem}
.nf-ftr .ftr-links a{letter-spacing:.06em;font-size:.88rem}
.nf-ftr .contact-list{justify-items:center}
.nf-ftr .contact-list .i{display:none}
.nf-ftr .ftr-base{justify-content:center;border-top-color:var(--edge)}
.nf-ftr .mpause{background:transparent;color:var(--on-dark);border-color:var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none}
.mbar .btn-ghost{color:var(--on-dark)}
@media (prefers-reduced-motion:reduce){.nf-l,.nf-fog{transform:none!important}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Nightfall',
  bestFor: 'A maker or brand with a story to tell: knives, spirits, tools, small-batch goods sold online',
  match: /\b(knives|knife|knifemaker|bladesmith|blacksmith|hand-?forged|forged|forge|sake|whisk(e)?y|distiller(y|s)?|incense)\b/,
  why: 'Built for a maker with a story: the scene rises out of the dark as your name does, then the scroll walks a camera down a valley at night, through fog and past ridgelines, chapter by chapter, toward a workshop with its door lit, and ends at your pieces hung on a rack with their prices.',
  fonts: { q: 'family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600', display: ['Instrument Serif', 'serif'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): the scene uncovered, smoke and a blade that drift, a camera on scroll.
  choreo: { intro: 'mask', alive: ['drift', 'pointer'], scroll: 'scene', pace: 'calm', look: 'cinematic night, fog and steel, slow' },
  tokens,
  slots,
  nav,
  art,
  render,
};
