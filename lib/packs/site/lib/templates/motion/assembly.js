// Assembly (animated, product, for a physical product worth opening up): the exploded view.
//   Object:   the product itself, built in the page from its real parts and picked from the facts: a bookshelf speaker
//             (shell, amplifier board, battery, woofer, tweeter, front baffle), headphones (cup, board, driver, grille,
//             cushion), a lamp (base, heat sink, LED board, diffuser), a bag (back panel, body, front, pocket), a device
//             (shell, battery, board, frame, glass) or, for other goods, the box it ships in (tray, the piece, insert,
//             lid with the name on it). Each part is tied by a hairline callout to a line from the member's own list,
//             matched by what the line says. A business that sells no physical thing gets an aluminium rating plate
//             with its own details struck on it, and no exploded view.
//   Material: aluminium and paper: a cool light page, graphite ink, machined edges (small radii), hairlines, a spec
//             sheet ruled like a drawing, a condensed engineering face for the titles.
//   One move: the name's letters fly in and lock together like parts fitted, the product lands beside them, whole;
//             then the scroll takes that same product apart along its own axis and puts it back together (pinned), and
//             it comes to rest centred on its price.
//   Pop:      the member's colour is the callout lines as they draw to each part, and the small marks on the parts they
//             point to. Buttons are ink.
// At rest the product leans toward the pointer and springs when tapped. When the member has renders in frames/
// (facts.frames: frames/0001.webp...), the pinned section plays them on a canvas instead. Then, for a speaker, two
// close-ups drawn at the cabinet's scale beside the member's story, the spec sheet, the Buy block, and the member's
// questions when they gave some. Reduced motion and no script: the exploded still with its labels in a list beside
// it. Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');

const id = 'assembly';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f6f7f8', 0.9), dark: color.mix(p.ink, '#0b0b0c', 0.85) };
}

function product(c) {
  return c.productName || c.name;
}

// The kinds of product drawn, each as its parts from the back to the front. face: 'front' parts stand upright and
// come apart toward you; 'flat' parts lie in a stack and lift apart. kw: the words in a feature line that tie it to
// that part. dot: where on the part its callout lands (percent of the part's plane). z: the part's depth in the
// assembled product (0 back, 1 front), times the product's depth D (a share of its width).
const KITS = {
  speaker: { face: 'front', ar: 0.62, D: 0.5, parts: [
    { id: 'shell', z: 0, kw: /shell|alumin|case|cabinet|enclosure|housing|body/, dot: [96, 38] },
    { id: 'board', z: 0.22, kw: /usb|bluetooth|wi-?fi|port|amp|chip|input|wireless|aux/, dot: [72, 26] },
    { id: 'battery', z: 0.4, kw: /batter|charge|hours?|power/, dot: [70, 80] },
    { id: 'woofer', z: 0.84, kw: /driver|woofer|bass|sound|watts?|audio/, dot: [80, 62] },
    { id: 'tweeter', z: 0.9, kw: /tweeter|treble|dome/, dot: [62, 26] },
    { id: 'baffle', z: 1, kw: /baffle|front|grille|screw|repair|tool|magnet|cover/, dot: [10, 5] },
  ] },
  headphones: { face: 'front', ar: 1, D: 0.32, parts: [
    { id: 'cup', z: 0, kw: /cup|shell|alumin|case|body|fold/, dot: [92, 40] },
    { id: 'board', z: 0.3, kw: /bluetooth|usb|chip|noise|anc|batter|hours?|charge|mic/, dot: [62, 44] },
    { id: 'driver', z: 0.6, kw: /driver|sound|mm|bass|audio/, dot: [78, 30] },
    { id: 'grille', z: 0.82, kw: /grille|mesh|cover/, dot: [24, 24] },
    { id: 'cushion', z: 1, kw: /cushion|ear|foam|leather|comfort|pad|memory/, dot: [8, 50] },
  ] },
  lamp: { face: 'flat', ar: 1, D: 0.2, parts: [
    { id: 'base', z: 0, kw: /base|weight|cable|cord|usb|switch|dimm|touch|plug/, dot: [86, 66] },
    { id: 'sink', z: 0.35, kw: /alumin|metal|heat|body|brass|steel|shell/, dot: [84, 32] },
    { id: 'led', z: 0.7, kw: /led|light|lumen|warm|bulb|colou?r|kelvin|bright/, dot: [50, 18] },
    { id: 'diffuser', z: 1, kw: /glass|diffus|shade|frost|opal|glare/, dot: [16, 30] },
  ] },
  bag: { face: 'front', ar: 0.78, D: 0.34, parts: [
    { id: 'back', z: 0, kw: /padded|back|laptop|strap|harness|carry/, dot: [94, 30] },
    { id: 'body', z: 0.45, kw: /lit(re|er)|capacity|main|canvas|nylon|leather|waterproof|fabric|cordura|wax/, dot: [86, 56] },
    { id: 'front', z: 0.85, kw: /zip|zipper|front|closure|buckle|magnet/, dot: [50, 10] },
    { id: 'pocket', z: 1, kw: /pocket|bottle|organi[sz]er|sleeve|compartment/, dot: [80, 78] },
  ] },
  device: { face: 'flat', ar: 1, D: 0.14, parts: [
    { id: 'shell', z: 0, kw: /shell|alumin|case|body|metal|housing|enclosure/, dot: [92, 70] },
    { id: 'battery', z: 0.3, kw: /batter|hours?|charge|power/, dot: [66, 60] },
    { id: 'board', z: 0.55, kw: /chip|usb|bluetooth|wi-?fi|port|board|sensor|wireless/, dot: [30, 34] },
    { id: 'frame', z: 0.8, kw: /frame|button|keys?|switch|dial|knob/, dot: [92, 8] },
    { id: 'glass', z: 1, kw: /glass|screen|display|sapphire|touch/, dot: [8, 8] },
  ] },
  box: { face: 'flat', ar: 1.25, D: 0.24, parts: [
    { id: 'tray', z: 0, kw: /ship|box|packag|recycl|plastic.?free|compost/, dot: [94, 70] },
    { id: 'piece', z: 0.45, kw: /./, dot: [70, 40] },
    { id: 'insert', z: 0.8, kw: /insert|card|note|guide|care|instructions?/, dot: [12, 80] },
    { id: 'lid', z: 1, kw: /gift|lid|wrap|name|engrav|personal/, dot: [8, 8] },
  ] },
};

// What the member makes, for the drawing. A product with no kit of its own ships in a box; a business that sells no
// physical thing gets the plate.
function kindOf(c) {
  const s = `${c.what || ''} ${product(c)} ${c.services.map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\b(speakers?|soundbars?|boombox(es)?|hi-?fi|sound systems?|subwoofers?)\b/.test(s)) return 'speaker';
  if (/\b(headphones?|earbuds?|earphones?|headsets?|iems?)\b/.test(s)) return 'headphones';
  if (/\b(lamps?|lights?|lighting|lanterns?|sconces?|pendants?)\b/.test(s)) return 'lamp';
  if (/\b(bags?|backpacks?|packs?|totes?|duffels?|wallets?|luggage|slings?|panniers?|briefcases?)\b/.test(s)) return 'bag';
  if (/\b(gadgets?|devices?|hardware|electronics?|keyboards?|chargers?|drones?|wearables?|trackers?|consoles?|controllers?|cameras?|watches|clocks?|radios?|routers?|e-?bikes?|bike parts?|kits?)\b/.test(s)) return 'device';
  const pr = c.profile || {};
  if (pr.template === 'product' && pr.id !== 'digital') return 'box';
  return 'none';
}

// Each feature line goes to the part it names (the first free part whose words it uses), the rest to the free parts
// from the front back, so the outer parts are labelled first.
function callouts(kit, lines) {
  const free = kit.parts.map((_, i) => i);
  const take = (i) => free.splice(free.indexOf(i), 1)[0];
  const out = lines.map((x) => {
    const s = String(x).toLowerCase();
    const i = free.find((k) => kit.parts[k].id !== 'piece' && kit.parts[k].kw.test(s));
    return i === undefined ? null : take(i);
  });
  const piece = kit.parts.findIndex((x) => x.id === 'piece');
  // In a box, every line that names no part is about the piece itself.
  return out.map((i) => (i === null ? (piece >= 0 ? piece : free.length ? take(free[free.length - 1]) : null) : i));
}

// A part's own drawing, inside its plane.
function partHtml(kind, part, name) {
  const p = part.id;
  if (kind === 'speaker') {
    if (p === 'shell') return '<i class="as-side as-r"></i><i class="as-side as-t"></i>';
    if (p === 'board') return '<i class="as-pcb"><i class="as-port"></i></i>';
    if (p === 'battery') return '<i class="as-bat"></i>';
    if (p === 'woofer') return '<i class="as-drv as-wf"></i>';
    if (p === 'tweeter') return '<i class="as-drv as-tw"></i>';
    return '';
  }
  if (kind === 'headphones') return p === 'board' ? '<i class="as-pcb sm"></i>' : p === 'driver' ? '<i class="as-drv as-hd"></i>' : p === 'cup' ? '<i class="as-side as-r"></i><i class="as-band"></i>' : '';
  if (kind === 'lamp') return p === 'led' ? '<i class="as-leds"></i>' : '';
  if (kind === 'bag') return p === 'front' ? '<i class="as-zip"></i>' : p === 'back' ? '<i class="as-pad"></i><i class="as-pad b"></i>' : p === 'body' ? '<i class="as-handle"></i>' : '';
  if (kind === 'device') return p === 'board' ? '<i class="as-pcb"><i class="as-port"></i></i>' : p === 'battery' ? '<i class="as-bat"></i>' : '';
  if (kind === 'box') return p === 'lid' ? `<span class="as-lid-t">${esc(name)}</span>` : '';
  return '';
}

// The product, built from its parts. With labels, each part carries the mark its callout points to.
function build(kind, name, { marks = [], cls = '' } = {}) {
  const kit = KITS[kind];
  const n = kit.parts.length;
  const parts = kit.parts.map((part, i) => {
    const mark = marks.includes(i) ? `<i class="as-dot" data-for="${i}" style="left:${part.dot[0]}%;top:${part.dot[1]}%"></i>` : '';
    return `<div class="as-ly as-p-${part.id}" style="--n:${(i - (n - 1) / 2).toFixed(2)};--z:${part.z}">${partHtml(kind, part, name)}${mark}</div>`;
  }).join('');
  return `<div class="as-kit as-k-${kind} as-${kit.face} ${cls}" style="--ar:${kit.ar};--d:${kit.D}"><div class="as-stack">${parts}</div></div>`;
}

function slots(c) {
  if (kindOf(c) !== 'speaker') return [];
  const name = product(c);
  return [
    { slot: 'detail', file: 'detail-1.jpg', w: 1200, h: 1400, style: 'mesh', alt: `${name}, the woofer in the cabinet` },
    { slot: 'detail2', file: 'detail-2.jpg', w: 1200, h: 1400, style: 'grid', alt: `${name}, the back panel` },
  ];
}

function priceOf(c) {
  const low = cheapest(c);
  if (low) return c.services.filter((s) => s.priceText).length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText;
  return c.priceText || '';
}

function nav(c) {
  return [
    kindOf(c) !== 'none' && { label: 'Inside', href: '#inside' },
    specRows(c).length && { label: 'Specs', href: '#specs' },
    questions(c).length >= 2 && { label: 'Questions', href: '#asked' },
    c.buy ? { label: 'Buy', href: '#buy' } : { label: c.primary && c.primary.kind === 'form' ? 'Waitlist' : 'Contact', href: '#signup' },
  ].filter(Boolean);
}

// The generated "About" for a product ("X makes Y...") repeats the page; only the member's own words are shown.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  const gen = new RegExp(`^${String(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} makes `, 'i');
  if (paras.length === 1 && gen.test(paras[0])) return [];
  if (/^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

// The member's questions, less any whose answer is already on the page as shipping or returns.
function questions(c) {
  const shown = [c.shipping, c.returns].filter(Boolean).map((x) => x.replace(/[.\s]+$/, '').toLowerCase());
  return c.faq.filter((q) => !shown.some((x) => String(q.a).toLowerCase().includes(x)));
}

function specRows(c) {
  const priced = c.services.filter((s) => s.name);
  return [
    // One product's price already sits in the hero and the buy block; the sheet lists it only when there are several.
    ...(priced.length > 1 ? priced.map((s) => [s.name, [s.priceText, s.blurb].filter(Boolean).join(', ')]) : []),
    // The parts' callouts already list the features when the product is drawn; the sheet lists only the rest.
    ...(c.included.slice(KITS[kindOf(c)] ? KITS[kindOf(c)].parts.length : 0).length ? [[c.included.length - (KITS[kindOf(c)] ? KITS[kindOf(c)].parts.length : 0) > 1 ? 'Features' : 'Feature', `<ul>${c.included.slice(KITS[kindOf(c)] ? KITS[kindOf(c)].parts.length : 0).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, true]] : []),
    c.returns && ['Returns', c.returns],
    c.capacity && ['Made in', c.capacity],
  ].filter(Boolean).filter((r) => r[1]);
}

function initials(n) {
  const w = String(n).replace(/&/g, ' ').split(/\s+/).filter((x) => /^[A-Za-z0-9]/.test(x));
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]) : [String(n).slice(0, 2)]).join('').toUpperCase();
}

function plateRows(c) {
  return [c.city && ['Based in', c.city], c.phone && ['Phone', c.phone.display], c.email && ['Email', c.email], c.hoursLine && ['Hours', c.hoursLine]].filter(Boolean).slice(0, 3);
}

// The footer, ruled like the spec sheet: the name, then one row per way to reach the member, then the pages.
function footer(c) {
  const rows = [
    c.email && ['Email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
    c.phone && ['Phone', `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`],
    c.address ? ['Address', c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)] : c.city && ['Based in', esc(c.city)],
    c.hoursLine && ['Hours', esc(c.hoursLine)],
  ].filter(Boolean);
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  return `<footer class="as-ftr"><div class="wrap">
<div class="as-ftr-top"><p class="as-ftr-n">${esc(c.name)}</p>${c.footerLine ? `<p class="as-ftr-l">${esc(c.footerLine)}</p>` : ''}</div>
${rows.length ? `<dl class="as-ftr-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
<div class="as-ftr-base">${links ? `<nav aria-label="Footer"><ul>${links}</ul></nav>` : ''}${P.socials(c, { cls: 'as-ftr-so', size: 18 })}<p>&copy; ${esc(c.year)} ${esc(c.name)}</p></div>
</div></footer>`;
}

function render(c) {
  const name = product(c);
  const price = priceOf(c);
  const buy = c.primary;
  const waitlist = buy.kind === 'form';
  const kind = kindOf(c);
  const kit = KITS[kind];
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const lines = kit ? c.included.slice(0, kit.parts.length) : [];
  const map = kit ? callouts(kit, lines) : [];
  // The labels run down the page in the order their marks do, so no two hairlines cross.
  const yOf = (i) => (map[i] === null ? 999 : kit.face === 'flat' ? (1 - kit.parts[map[i]].z) * 100 : kit.parts[map[i]].dot[1]);
  const order = lines.map((_, i) => i).sort((a, b) => yOf(a) - yOf(b) || a - b);

  // A business with nothing to take apart: its own details struck on an aluminium plate, screwed at the corners.
  const plate = `<div class="as-plate" aria-hidden="true"><i class="as-screw"></i><i class="as-screw"></i><i class="as-screw"></i><i class="as-screw"></i>
<p class="as-plate-n">${esc(initials(c.name))}</p>${plateRows(c).map(([k, v]) => `<p class="as-plate-l"><span>${k}</span>${esc(v)}</p>`).join('')}</div>`;
  const hero = `<section class="as-hero" aria-labelledby="hero-title"><div class="wrap as-hero-in">
<h1 class="as-name" id="hero-title" data-ci="head">${esc(name)}</h1>
<div class="as-hero-copy2"><p class="as-sub" data-ci="then" data-ci-from="side">${esc(sub)}</p>
<div class="as-ctas" data-ci="then" data-ci-from="side">${mag(P.button(buy, 'btn btn-primary btn-lg'))}${price ? `<span class="as-from">${esc(price)}</span>` : ''}</div></div>
<div class="as-hero-shot" data-ci="subject"><div class="as-lean" data-alive="0.9">${kit ? build(kind, name, { cls: 'as-whole' }) : plate}</div>${kit ? '<i class="as-floor" aria-hidden="true"></i>' : ''}</div>
</div></section>`;

  const frames = c.frames ? ` data-frames="${c.frames}"` : '';
  const inside = kit
    ? `<section class="as-x as-x-${kit.face}" id="inside" aria-labelledby="inside-title"${frames}>
<div class="as-pin">
<div class="wrap as-x-head"><h2 class="as-h2" id="inside-title" data-split>${esc(kind === 'box' ? `What comes in the box.` : `Take ${name} apart.`)}</h2></div>
<div class="as-x-body">
<div class="as-stage" aria-hidden="true">${build(kind, name, { marks: map.filter((i) => i !== null) })}${c.frames ? '<canvas class="as-seq" width="1600" height="1200"></canvas>' : ''}</div>
${waitlist ? '' : `<div class="as-x-end" aria-hidden="true"><span>${esc(name)}</span>${price ? `<b>${esc(price)}</b>` : ''}</div>`}
${order.length ? `<ol class="as-labels">${order.map((i, j) => `<li${map[i] === null ? '' : ` data-for="${map[i]}"`} style="--j:${j}"><span class="as-ln" aria-hidden="true"></span><span class="as-lt"><b>${String(j + 1).padStart(2, '0')}</b>${esc(lines[i])}</span></li>`).join('')}</ol>` : ''}
</div>
</div>
</section>`
    : '';

  // Close-ups at the cabinet's own scale beside the member's story (a speaker), or the story alone.
  const own = ownAbout(c);
  const copy = own.length ? `<div class="as-close-copy">${own.slice(0, 2).map((p, i) => `<p class="${i ? 'as-p' : 'as-say'}" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</div>` : '';
  const close = c.images.detail
    ? `<section class="as-sec as-close" aria-label="${esc(`${name}, up close`)}" data-sc><div class="wrap as-close-grid">
<figure class="as-cl" data-sc-part><div>${P.img(c, 'detail', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.08" ')}</div></figure>
<figure class="as-cl down" data-sc-part style="--sy:7rem"><div>${P.img(c, 'detail2', { cls: 'as-cl-img' }).replace('<img ', '<img data-par="0.04" ')}</div></figure>
${copy}
</div></section>`
    : copy ? `<section class="as-sec as-close" aria-label="${esc(`About ${c.name}`)}"><div class="wrap as-close-grid">${copy}</div></section>` : '';

  const rows = specRows(c);
  const specs = rows.length
    ? `<section class="as-sec" id="specs" aria-labelledby="specs-title"><div class="wrap as-specs">
<h2 class="as-h2" id="specs-title">Spec sheet.</h2>
<dl class="as-dl" data-rv style="--d:1">${rows.map(([k, v, raw]) => `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('')}</dl>
</div></section>`
    : '';

  const buyTitle = waitlist ? c.ctaTitle : kit && kind !== 'box' ? `${name}, assembled.` : name;
  const contact = !c.buy && !waitlist;
  const buySec = `<section class="as-sec as-buy${kit ? '' : ' solo'}" id="${c.buy ? 'buy' : 'signup'}" aria-labelledby="buy-title"><div class="wrap as-buy-in">
${kit ? `<div class="as-buy-shot" data-rv="scale">${build(kind, name, { cls: 'as-whole as-rest' })}<i class="as-floor" aria-hidden="true"></i></div>` : ''}
<div class="as-buy-copy"><h2 class="as-h2 big" id="buy-title" data-split>${esc(buyTitle)}</h2>
${waitlist ? `<p class="as-p" data-rv style="--d:2">${esc(c.ctaSub)}${c.deadline ? ` Launching ${esc(c.deadline)}.` : ''}</p><div class="as-form" data-rv style="--d:3">${P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.name, required: false }, P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>` : `${price ? `<p class="as-price" data-rv style="--d:2">${esc(price)}</p>` : ''}<div class="as-ctas" data-rv style="--d:3">${mag(P.button(buy, 'btn btn-primary btn-lg'))}</div>`}
${c.shipping && !contact ? `<p class="as-ship" data-rv style="--d:4">${esc(c.shipping)}</p>` : ''}</div>
</div></section>`;

  const reviews = c.reviews.length ? `<section class="as-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="as-h2" id="reviews-title">What people say</h2><div data-rv style="margin-top:2rem">${P.reviews(c)}</div></div></section>` : '';
  const qs = questions(c);
  const faq = qs.length >= 2 ? `<section class="as-sec" id="asked" aria-labelledby="asked-title"><div class="wrap as-specs"><h2 class="as-h2" id="asked-title">Before you open the box.</h2><ol class="as-qa" data-rv style="--d:1">${qs.map((q, i) => `<li><b aria-hidden="true">Q${i + 1}</b><div><h3>${esc(q.q)}</h3><p>${esc(q.a)}</p></div></li>`).join('')}</ol></div></section>` : '';

  const m = motion();
  const body = ['<div class="prog" aria-hidden="true"></div>', P.header(c, { cls: 'as-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, inside, close, specs, buySec, reviews, faq, '</main>', footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '6px', radiusSm: '4px', btnRadius: '6px', max: '80rem' } };
}

// The pinned section's progress (--e: how far apart the parts are, 0 together, 1 apart and back) and its callouts: each
// label's hairline is drawn to its part's mark, read from where the browser put that mark on screen. With frames
// in frames/, a canvas plays them instead (phones load every few frames only). Off for reduced motion.
const JS = `(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document,x=d.querySelector('.as-x');if(!x)return;
var pin=x.querySelector('.as-pin'),labs=[].slice.call(x.querySelectorAll('.as-labels li')),t=false;
function cl(v){return v<0?0:v>1?1:v}
var cv=x.querySelector('.as-seq'),N=+x.getAttribute('data-frames')||0,imgs=[],g=null,cur=-1;
if(cv&&N){var phone=innerWidth<768,step=phone?Math.max(1,Math.ceil(N/12)):1;g=cv.getContext('2d');var load=function(i){var im=new Image();im.decoding='async';im.src='frames/'+('000'+(i+1)).slice(-4)+'.webp';imgs[i]=im;im.onload=function(){if(i===0)x.classList.add('seq');f()}};addEventListener('load',function(){for(var i=0;i<N;i+=step)load(i);if((N-1)%step)load(N-1)})}
function frame(p){if(!g)return;var want=Math.round(p*(N-1)),best=-1;for(var i=0;i<N;i++){if(imgs[i]&&imgs[i].complete&&imgs[i].naturalWidth&&(best<0||Math.abs(i-want)<Math.abs(best-want)))best=i}if(best>=0&&best!==cur){cur=best;g.clearRect(0,0,cv.width,cv.height);g.drawImage(imgs[best],0,0,cv.width,cv.height)}}
function f(){t=false;var vh=innerHeight,r=x.getBoundingClientRect(),p=cl(-r.top/Math.max(1,r.height-vh)),e=Math.sin(Math.PI*cl((p-.06)/.86));x.style.setProperty('--e',e.toFixed(4));x.style.setProperty('--p',p.toFixed(4));x.style.setProperty('--q',cl((p-.8)/.12).toFixed(4));frame(p);
if(labs.length){labs.forEach(function(li,j){var on=p>.14+j*.07&&p<.8;li.classList.toggle('on',on);var dot=x.querySelector('.as-dot[data-for="'+li.getAttribute('data-for')+'"]');if(!dot)return;var b=dot.getBoundingClientRect(),lr=li.getBoundingClientRect(),dx=lr.left-6-(b.left+b.width/2),dy=(b.top+b.height/2)-(lr.top+lr.height/2);li.style.setProperty('--w',Math.max(0,Math.sqrt(dx*dx+dy*dy)).toFixed(1)+'px');li.style.setProperty('--a',Math.atan2(-dy,dx).toFixed(4)+'rad')})}}
addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);x.classList.add('live');f()})();`;

// Drawn close-ups (T.art) for a speaker, at the cabinet's own scale on a cool aluminium light: the woofer in the
// corner of the cabinet (its edge and side in frame), and the back panel with its battery door, screws and port.
function art(slot, { c, art: A }) {
  if (kindOf(c) !== 'speaker' || !/^detail/.test(slot.slot)) return null;
  const { w, h } = slot;
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f6"/><stop offset=".7" stop-color="#e3e6e9"/><stop offset="1" stop-color="#cfd3d7"/></linearGradient><linearGradient id="al" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f5f7"/><stop offset=".45" stop-color="#d3d7db"/><stop offset=".7" stop-color="#bfc4ca"/><stop offset="1" stop-color="#e2e5e8"/></linearGradient><linearGradient id="sd" x1="0" x2="1"><stop offset="0" stop-color="#a6acb3"/><stop offset="1" stop-color="#848a92"/></linearGradient><radialGradient id="cn" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#4a4e54"/><stop offset=".6" stop-color="#25282c"/><stop offset="1" stop-color="#141517"/></radialGradient><radialGradient id="dm" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#e3e6e9"/><stop offset=".5" stop-color="#868c93"/><stop offset="1" stop-color="#2a2d31"/></radialGradient><radialGradient id="sr" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#2b2e33"/><stop offset=".9" stop-color="#3d4147"/><stop offset="1" stop-color="#1a1c1f"/></radialGradient><filter id="fs" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>`;
  let body = `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  if (slot.slot === 'detail') {
    // The front corner: the baffle's edge and the cabinet's side running out of frame, the woofer set into it.
    body += `<ellipse cx="${w * 0.6}" cy="${h * 1.02}" rx="${w * 0.6}" ry="${h * 0.06}" fill="#000" opacity=".22" filter="url(#fs)"/>`
      + `<path d="M${w * 0.16} ${h * 0.12}H${w * 1.1}V${h * 1.1}H${w * 0.16}Z" fill="url(#al)"/><path d="M${w * 0.04} ${h * 0.17}L${w * 0.16} ${h * 0.12}V${h * 1.1}L${w * 0.04} ${h * 1.1}Z" fill="url(#sd)"/><path d="M${w * 0.16} ${h * 0.12}H${w * 1.1}" stroke="#fff" stroke-opacity=".8" stroke-width="3"/>`
      + `<circle cx="${w * 0.62}" cy="${h * 0.6}" r="${w * 0.36}" fill="#b4b9bf"/><circle cx="${w * 0.62}" cy="${h * 0.6}" r="${w * 0.34}" fill="url(#sr)"/><circle cx="${w * 0.62}" cy="${h * 0.6}" r="${w * 0.29}" fill="url(#cn)"/><circle cx="${w * 0.62}" cy="${h * 0.6}" r="${w * 0.1}" fill="url(#dm)"/>`;
  } else {
    // The back panel: an aluminium plate, the battery door with four screws, the USB-C port and a vent line.
    const s = (x, y) => `<circle cx="${x}" cy="${y}" r="${w * 0.018}" fill="#9aa0a7"/><path d="M${x - w * 0.011} ${y}H${x + w * 0.011}M${x} ${y - w * 0.011}V${y + w * 0.011}" stroke="#555a60" stroke-width="3"/>`;
    body += `<ellipse cx="${w * 0.5}" cy="${h * 0.95}" rx="${w * 0.48}" ry="${h * 0.04}" fill="#000" opacity=".22" filter="url(#fs)"/>`
      + `<rect x="${w * 0.1}" y="${h * 0.06}" width="${w * 0.8}" height="${h * 0.88}" rx="${w * 0.05}" fill="url(#al)"/><rect x="${w * 0.1}" y="${h * 0.06}" width="${w * 0.8}" height="${h * 0.88}" rx="${w * 0.05}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`
      + `<rect x="${w * 0.24}" y="${h * 0.5}" width="${w * 0.52}" height="${h * 0.3}" rx="${w * 0.02}" fill="#c7cbd0" stroke="#9ba1a8" stroke-width="2"/>${s(w * 0.29, h * 0.54)}${s(w * 0.71, h * 0.54)}${s(w * 0.29, h * 0.76)}${s(w * 0.71, h * 0.76)}`
      + `<rect x="${w * 0.45}" y="${h * 0.3}" width="${w * 0.1}" height="${h * 0.028}" rx="${h * 0.014}" fill="#2a2d31"/><rect x="${w * 0.465}" y="${h * 0.308}" width="${w * 0.07}" height="${h * 0.012}" rx="${h * 0.006}" fill="#55595f"/>`
      + `<circle cx="${w * 0.5}" cy="${h * 0.2}" r="${w * 0.06}" fill="#2b2e33"/><circle cx="${w * 0.5}" cy="${h * 0.2}" r="${w * 0.045}" fill="#141517"/>`;
  }
  return A.svgDoc(w, h, defs, body);
}

// Aluminium, graphite and the PCB greens, as shared gradients.
const AL = 'linear-gradient(135deg,#f3f5f7,#d3d7db 40%,#bfc4ca 66%,#e2e5e8)';

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}
@font-face{font-family:'Assembly Display Fallback';font-weight:600;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:82.8%;ascent-override:120.8%;descent-override:24.2%;line-gap-override:0%}
@font-face{font-family:'Assembly Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.2%;ascent-override:101.3%;descent-override:27.2%;line-gap-override:0%}
html:root{--font-display:"Barlow Semi Condensed","Assembly Display Fallback",sans-serif;--font-body:"IBM Plex Sans","Assembly Body Fallback",sans-serif}
body{--rule:color-mix(in srgb,var(--ink) 15%,transparent);--al:${AL}}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 84%,var(--bg))}
h1,h2,h3{font-family:var(--font-display);font-weight:600;letter-spacing:-.005em}
.btn{font-weight:500}
.btn-primary{box-shadow:none}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.875rem}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid transparent;transition:border-color .3s ease}.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;font-weight:600;letter-spacing:0;text-decoration:none}
.nav ul{display:flex;gap:.25rem}
.nav a{display:block;padding:.4rem .75rem;font-size:.84rem;color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--ink)}
.menu>summary{width:2.75rem;height:2.75rem;border:0;background:transparent}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.as-h2{margin-top:.5rem;font-size:clamp(2.4rem,1.6rem + 3.6vw,5rem);line-height:.96}
.as-h2.big{font-size:clamp(2.9rem,1.7rem + 5vw,6.8rem)}
.as-p{margin-top:1rem;max-width:36rem;font-size:1.1rem;line-height:1.6;color:var(--muted)}
/* the product, built from its parts in 3D: --W its width, --D its depth; --e how far apart (0 whole) */
.as-kit{--W:min(22vmin,13rem);--D:calc(var(--W) * var(--d));--gap:calc(var(--W) * .5);--e:0;position:relative;width:var(--W);aspect-ratio:var(--ar);transform-style:preserve-3d}
.as-stack{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(-10deg) rotateY(calc(-28deg - var(--e,0) * 26deg))}
.as-flat .as-stack{transform:rotateX(calc(58deg - var(--e,0) * 6deg)) rotateZ(calc(-36deg + var(--p,0) * 24deg))}
.as-ly{position:absolute;inset:0;transform-style:preserve-3d;transform:translateZ(calc(var(--z) * var(--D) + var(--n) * var(--e) * var(--gap)))}
.as-ly i{display:block;position:absolute}
.as-dot{width:7px;height:7px;margin:-3.5px 0 0 -3.5px;background:var(--pop);box-shadow:0 0 0 2px var(--bg);opacity:min(1,calc(var(--e,0) * 3))}
/* speaker: the shell is the open box (back, side and top); the baffle closes it, the drivers show through */
.as-k-speaker .as-p-shell{border-radius:6%/4%;background:radial-gradient(circle at 50% 40%,#2c2f34,#131416);box-shadow:inset 0 0 0 calc(var(--W) * .03) #b8bdc3,inset 0 0 calc(var(--W) * .1) rgba(0,0,0,.7)}
.as-side{background:linear-gradient(90deg,#9aa0a7,#b9bec4 45%,#8d939a)}
.as-side.as-r{top:0;bottom:0;right:0;width:var(--D);transform-origin:100% 50%;transform:rotateY(90deg);border-radius:0 8% 8% 0/0 4% 4% 0}
.as-side.as-t{left:0;right:0;top:0;height:var(--D);transform-origin:50% 0;transform:rotateX(90deg);background:linear-gradient(180deg,#e4e7ea,#cdd1d6);border-radius:4%/8%}
.as-pcb{left:20%;right:20%;top:12%;height:30%;border-radius:3px;background:linear-gradient(#0f1112,#0f1112) 22% 30%/20% 26% no-repeat,linear-gradient(#0f1112,#0f1112) 70% 38%/14% 18% no-repeat,linear-gradient(#a8acb0,#a8acb0) 70% 74%/22% 8% no-repeat,linear-gradient(160deg,#2b3c34,#17231e);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.as-pcb.sm{left:32%;right:32%;top:38%;height:24%}
.as-port{left:42%;right:42%;bottom:-3%;height:9%;border-radius:999px;background:#c9ccd0;box-shadow:inset 0 0 0 2px #6d7278}
.as-bat{left:24%;right:24%;top:70%;height:20%;border-radius:4%/10%;background:linear-gradient(180deg,#454a51,#24272b);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.as-bat::after{content:'';position:absolute;left:8%;right:58%;top:30%;bottom:30%;border-radius:2px;background:color-mix(in srgb,#fff 22%,transparent)}
.as-drv{left:50%;border-radius:50%;transform:translate(-50%,-50%)}
.as-wf{top:65%;width:78%;aspect-ratio:1;background:radial-gradient(circle at 44% 40%,#eef0f2 0,#a4aab0 9%,transparent 14%),radial-gradient(circle,#3a3d42 0 16%,#25282c 46%,#3f434a 56%,#1b1d20 63%,#33363b 70%,#121315 74%,#5a5f66 77%,#2c2f33 80%)}
.as-tw{top:27%;width:36%;aspect-ratio:1;background:radial-gradient(circle at 42% 38%,#f2f3f4 0,#9aa0a6 26%,#3a3d42 46%,#1b1d20 60%,#5a5f66 66%,#25282c 74%)}
.as-k-speaker .as-p-baffle{border-radius:6%/4%;background:var(--al);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8),inset 0 -2px 6px rgba(0,0,0,.12);-webkit-mask:radial-gradient(circle calc(var(--W) * .3) at 50% 65%,transparent 97%,#000 100%),radial-gradient(circle calc(var(--W) * .14) at 50% 27%,transparent 96%,#000 100%);-webkit-mask-composite:source-in;mask:radial-gradient(circle calc(var(--W) * .3) at 50% 65%,transparent 97%,#000 100%),radial-gradient(circle calc(var(--W) * .14) at 50% 27%,transparent 96%,#000 100%);mask-composite:intersect}
/* headphones: one ear cup coming apart */
.as-k-headphones .as-ly{border-radius:50%}
.as-k-headphones .as-p-cup{background:radial-gradient(circle,#1b1c1f 0 60%,#cfd3d8 63%,#9ea4ab 80%,#e4e7ea 92%,#a9afb5 100%)}
.as-k-headphones .as-side{top:0;bottom:0;right:0;width:var(--D);transform-origin:100% 50%;transform:rotateY(90deg);border-radius:50%/20%}
.as-hd{top:50%;width:70%;aspect-ratio:1;background:radial-gradient(circle at 44% 40%,#eef0f2 0,#a4aab0 10%,transparent 15%),radial-gradient(circle,#3a3d42 0 18%,#22252a 56%,#4a4e55 66%,#1b1d20 72%,#9ca2a9 76%,#2b2e33 82%)}
.as-band{left:50%;bottom:50%;width:calc(var(--W) * .8);height:calc(var(--W) * .86);transform-origin:0 100%;transform:rotateY(-90deg);border:calc(var(--W) * .07) solid #33363b;border-right:0;border-bottom:0;border-top-left-radius:100% 100%;box-shadow:inset 1px 1px 0 rgba(255,255,255,.18)}
.as-band::after{content:'';position:absolute;left:calc(var(--W) * -.1);bottom:-2px;width:calc(var(--W) * .13);height:calc(var(--W) * .3);border-radius:4px;background:linear-gradient(90deg,#c3c8ce,#8e949b)}
.as-stage .as-band{display:none}
.as-k-headphones .as-p-grille{inset:12%;background:radial-gradient(circle,#0e0f11 32%,transparent 38%) 0 0/8px 8px,radial-gradient(circle,#4a4e55,#2b2e33)}
.as-k-headphones .as-p-cushion{background:radial-gradient(circle,transparent 0 50%,#26282c 52%,#4a4e54 66%,#1c1e21 84%,#33363a 100%)}
/* lamp: the disc stack, lifted apart */
.as-k-lamp .as-ly{border-radius:50%}
.as-k-lamp .as-p-base{background:radial-gradient(circle at 40% 36%,#eef0f2,#b9bec4 60%,#8d939a 100%);box-shadow:0 30px 40px -24px rgba(0,0,0,.4)}
.as-k-lamp .as-p-sink{inset:6%;background:radial-gradient(circle,#3b3f45 0 26%,transparent 27%),conic-gradient(#9aa0a7 0 4deg,#d6dade 4deg 15deg,#9aa0a7 15deg 19deg,#d6dade 19deg 30deg,#9aa0a7 30deg 34deg,#d6dade 34deg 45deg,#9aa0a7 45deg 49deg,#d6dade 49deg 60deg,#9aa0a7 60deg 64deg,#d6dade 64deg 75deg,#9aa0a7 75deg 79deg,#d6dade 79deg 90deg,#9aa0a7 90deg 94deg,#d6dade 94deg 105deg,#9aa0a7 105deg 109deg,#d6dade 109deg 120deg,#9aa0a7 120deg 124deg,#d6dade 124deg 135deg,#9aa0a7 135deg 139deg,#d6dade 139deg 150deg,#9aa0a7 150deg 154deg,#d6dade 154deg 165deg,#9aa0a7 165deg 169deg,#d6dade 169deg 180deg,#9aa0a7 180deg 184deg,#d6dade 184deg 195deg,#9aa0a7 195deg 199deg,#d6dade 199deg 210deg,#9aa0a7 210deg 214deg,#d6dade 214deg 225deg,#9aa0a7 225deg 229deg,#d6dade 229deg 240deg,#9aa0a7 240deg 244deg,#d6dade 244deg 255deg,#9aa0a7 255deg 259deg,#d6dade 259deg 270deg,#9aa0a7 270deg 274deg,#d6dade 274deg 285deg,#9aa0a7 285deg 289deg,#d6dade 289deg 300deg,#9aa0a7 300deg 304deg,#d6dade 304deg 315deg,#9aa0a7 315deg 319deg,#d6dade 319deg 330deg,#9aa0a7 330deg 334deg,#d6dade 334deg 345deg,#9aa0a7 345deg 349deg,#d6dade 349deg 360deg)}
.as-k-lamp .as-p-led{inset:12%;background:radial-gradient(circle,#1f2226,#101114)}
.as-leds{inset:14%;border-radius:50%;background:radial-gradient(circle at 50% 4%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 96% 50%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 50% 96%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 4% 50%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 82% 18%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 82% 82%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 18% 82%,#ffe2b0 0 5%,transparent 6%),radial-gradient(circle at 18% 18%,#ffe2b0 0 5%,transparent 6%)}
.as-k-lamp .as-p-diffuser{background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.95),rgba(240,242,244,.7) 50%,rgba(220,224,228,.55));box-shadow:inset 0 0 0 1px rgba(255,255,255,.9),0 0 0 1px rgba(0,0,0,.06)}
/* bag: the panels standing apart */
.as-k-bag .as-ly{border-radius:16%/12%}
.as-k-bag .as-p-back{background:linear-gradient(160deg,#3a3d42,#1f2124)}
.as-pad{left:12%;width:32%;top:14%;bottom:20%;border-radius:30%/14%;background:linear-gradient(90deg,#2a2c30,#46494f 50%,#2a2c30)}
.as-pad.b{left:auto;right:12%}
.as-k-bag .as-p-body{background:linear-gradient(160deg,#5a5e64,#3a3d42 60%,#2c2e32);box-shadow:inset 0 0 0 3px rgba(255,255,255,.06)}
.as-handle{left:36%;right:36%;top:-9%;height:12%;border:calc(var(--W) * .03) solid #2a2c30;border-bottom:0;border-radius:999px 999px 0 0}
.as-k-bag .as-p-front{inset:6% 8% 22%;background:linear-gradient(160deg,#666a70,#45484d)}
.as-zip{left:8%;right:8%;top:12%;height:3%;border-radius:2px;background:linear-gradient(90deg,#c8ccd1,#8e949b)}
.as-k-bag .as-p-pocket{inset:56% 16% 8%;border-radius:12%/22%;background:linear-gradient(160deg,#585c62,#3b3e43);box-shadow:inset 0 2px 0 rgba(255,255,255,.12)}
/* device: rounded slabs stacked */
.as-k-device .as-ly{border-radius:18%}
.as-k-device .as-p-shell{background:var(--al);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),inset 0 -6px 14px rgba(0,0,0,.18),0 40px 50px -30px rgba(0,0,0,.35)}
.as-k-device .as-p-battery{inset:12%;border-radius:12%;background:transparent}
.as-k-device .as-bat{inset:10% 18% 40% 18%;border-radius:8%}
.as-k-device .as-p-board{inset:8%;border-radius:12%;background:transparent}
.as-k-device .as-pcb{inset:46% 10% 10% 10%;height:auto}
.as-k-device .as-p-frame{inset:2%;border-radius:16%;border:clamp(5px,1.2vmin,12px) solid #3b3e43;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
.as-k-device .as-p-glass{background:linear-gradient(135deg,rgba(255,255,255,.7),rgba(255,255,255,.14) 55%,rgba(255,255,255,.42));box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),inset 0 0 0 2px rgba(0,0,0,.06)}
/* box: the tray, the piece, the card insert and the lid with the name on it */
.as-k-box .as-ly{border-radius:3%}
.as-k-box .as-p-tray{background:linear-gradient(135deg,#d9c6a6,#bfa784);box-shadow:inset 0 0 0 calc(var(--W) * .03) #cbb594,0 40px 50px -30px rgba(0,0,0,.35)}
.as-k-box .as-p-piece{inset:18% 22%;border-radius:22%;background:radial-gradient(circle at 36% 30%,color-mix(in srgb,var(--surface) 30%,#fff),color-mix(in srgb,var(--ink) 30%,#c9cdd2) 70%);box-shadow:0 10px 18px -10px rgba(0,0,0,.45)}
.as-k-box .as-p-insert{inset:6%;background:#f4f1ea;-webkit-mask:radial-gradient(closest-side,transparent 64%,#000 66%) 50% 50%/62% 70% no-repeat,linear-gradient(#000,#000);-webkit-mask-composite:xor;mask:radial-gradient(closest-side,transparent 64%,#000 66%) 50% 50%/62% 70% no-repeat exclude,linear-gradient(#000,#000)}
.as-k-box .as-p-lid{display:grid;place-items:center;background:linear-gradient(135deg,#f6f3ec,#e3ddd1);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.as-lid-t{font-family:var(--font-display);font-weight:600;font-size:calc(var(--W) * .11);letter-spacing:.06em;text-transform:uppercase;color:color-mix(in srgb,var(--ink) 70%,transparent);text-align:center;line-height:1.05;padding:0 8%}
/* a business with nothing to take apart: the rating plate */
.as-plate{position:relative;display:grid;width:min(100%,24rem);gap:.35rem;align-content:center;min-height:clamp(16rem,10rem + 14vw,24rem);padding:clamp(1.6rem,1rem + 2vw,3rem);border-radius:10px;background:var(--al);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8),inset 0 -3px 8px rgba(0,0,0,.12),0 30px 50px -30px rgba(0,0,0,.4)}
.as-plate-n{font-family:var(--font-display);font-weight:600;font-size:clamp(4.5rem,3rem + 6vw,8rem);line-height:.9;letter-spacing:.02em;color:#b7bcc2;text-shadow:0 1px 0 rgba(255,255,255,.9),0 -1px 0 rgba(0,0,0,.25)}
.as-plate-l{display:grid;grid-template-columns:6.5rem 1fr;gap:.8rem;padding-top:.5rem;border-top:1px solid rgba(0,0,0,.14);font-size:1rem;color:#2d3035;text-shadow:0 1px 0 rgba(255,255,255,.6);overflow-wrap:anywhere}
.as-plate-l span{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#5d6268;padding-top:.2rem}
.as-plate-n+.as-plate-l{margin-top:1rem}
.as-screw{position:absolute;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#f2f3f4,#9ea4aa);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
.as-screw::after{content:'';position:absolute;left:2px;right:2px;top:5px;height:2px;background:#6d7278;transform:rotate(-30deg)}
.as-screw:nth-child(1){left:12px;top:12px}.as-screw:nth-child(2){right:12px;top:12px}.as-screw:nth-child(3){left:12px;bottom:12px}.as-screw:nth-child(4){right:12px;bottom:12px}
/* hero */
.as-hero{padding-block:clamp(2.5rem,1.5rem + 4vw,5.5rem) clamp(3rem,2rem + 3vw,5rem);border-bottom:1px solid var(--rule)}
.as-hero-in{display:grid;gap:0 1.5rem;align-items:end}
@media (min-width:60rem){.as-hero-in{grid-template-columns:repeat(12,minmax(0,1fr))}.as-name,.as-hero-copy2{grid-column:1/7}.as-hero-shot{grid-column:7/13;grid-row:1/3;align-self:center}}
.as-hero-copy2{padding-top:1.2rem;margin-top:1.4rem;border-top:1px solid var(--rule)}
.as-name{margin-top:.4rem;margin-left:-.03em;font-size:clamp(3.8rem,1rem + 9vw,10.4rem);line-height:.88;letter-spacing:0}
.as-sub{max-width:30rem;font-size:clamp(1.15rem,1rem + .7vw,1.6rem);line-height:1.32;font-weight:500;letter-spacing:-.01em;text-wrap:balance}
.as-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1.4rem;margin-top:1.6rem}
.as-from{color:var(--muted);font-weight:500;font-variant-numeric:tabular-nums}
.as-hero-shot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:clamp(20rem,14rem + 18vw,34rem);margin-top:clamp(2rem,1.5rem + 3vw,3rem);perspective:1800px}
@media (min-width:60rem){.as-hero-shot{margin-top:0}}
.as-hero-shot .as-kit{--W:min(26vmin,15rem)}
.as-hero-shot .as-k-box,.as-hero-shot .as-k-lamp,.as-hero-shot .as-k-device{--W:min(34vmin,20rem)}
.as-lean{transform-style:preserve-3d}
.as-floor{display:block;width:calc(var(--fw,15rem) * 1.5);max-width:90%;height:30px;margin-top:-12px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.26),transparent);pointer-events:none}
.as-lean:has(.as-flat)~.as-floor{margin-top:-30%}
.as-buy-shot .as-floor{position:absolute;left:50%;bottom:12%;width:min(60%,22rem);transform:translateX(-50%);margin:0}
.as-buy-shot:has(.as-flat) .as-floor{bottom:26%}
/* the exploded view: a still with a list by default */
.as-x{--e:.85;--p:.5;padding-block:clamp(4rem,3rem + 4vw,7rem)}
.as-x-head{display:grid;gap:.6rem}
.as-x-body{display:grid;gap:2rem;align-items:center;width:min(100% - 2rem,var(--max));margin:2rem auto 0}
@media (min-width:56rem){.as-x-body{grid-template-columns:1.3fr .7fr}.as-x-body:not(:has(.as-labels)){grid-template-columns:1fr}.as-x-body:not(:has(.as-labels)) .as-stage{justify-self:center;width:min(100%,46rem)}}
.as-stage{position:relative;aspect-ratio:1;max-height:70vh;width:100%;perspective:1800px;display:grid;place-items:center}
.as-stage .as-kit{--W:min(19vmin,12rem)}
.as-x-flat .as-stage .as-kit{--W:min(26vmin,16rem)}
.as-stage .as-kit{--e:inherit}
.as-x-end{display:none}
html.m .as-x.live .as-x-end{display:flex;position:absolute;left:0;right:0;bottom:7vh;justify-content:center;align-items:baseline;gap:1rem;font-weight:600;opacity:var(--q,0);transform:translateY(calc((1 - var(--q,0)) * 1rem))}
.as-x-end b{font-family:var(--font-display);font-size:1.8rem;font-variant-numeric:tabular-nums}
@media (min-width:56rem){html.m .as-x.live .as-stage{transform:translateX(calc(var(--q,0) * 27%))}}
@media (max-width:55.99rem){html.m .as-x.live .as-x-end{display:none}}
.as-seq{display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.as-x.seq .as-seq{display:block}
.as-x.seq .as-kit{visibility:hidden}
.as-labels{display:grid;gap:.9rem}
.as-labels li{display:flex;align-items:center;gap:.8rem}
.as-ln{display:none}
.as-lt{display:grid;gap:.15rem;font-size:1.02rem;font-weight:500;line-height:1.35}
.as-lt b{font-size:.75rem;font-weight:600;color:var(--primary-text);font-variant-numeric:tabular-nums}
html.m .as-x{height:340vh;height:340svh;padding:0}
html.m .as-pin{position:sticky;top:0;height:100vh;height:100svh;display:grid;grid-template-rows:auto 1fr;padding-top:calc(3.25rem + 2vh);overflow:hidden}
html.m .as-x-body{margin-top:0;height:100%}
html.m .as-x.live .as-labels{position:absolute;inset:0;pointer-events:none}
html.m .as-x.live .as-labels li{position:absolute;right:max(1rem,calc((100vw - var(--max)) / 2));top:calc(28vh + var(--j) * 10vh);width:min(17rem,30vw);opacity:0;transition:opacity .5s ease}
html.m .as-x.live .as-labels li.on{opacity:1}
html.m .as-x.live .as-ln{display:block;position:absolute;right:100%;top:50%;width:var(--w,0px);height:2px;margin-right:6px;background:var(--pop);transform-origin:100% 50%;transform:rotate(var(--a,0rad)) scaleX(0);transition:transform .7s cubic-bezier(.7,0,.2,1)}
html.m .as-x.live .as-labels li.on .as-ln{transform:rotate(var(--a,0rad)) scaleX(1)}
html.m .as-x.live .as-labels li .as-lt{padding:.55rem .8rem;border-radius:4px;background:var(--bg);border:1px solid var(--rule)}
@media (max-width:55.99rem){html.m .as-x-body{grid-template-rows:minmax(0,1fr) auto}html.m .as-stage{max-height:46vh;justify-self:center}html.m .as-x.live .as-labels{position:static;display:grid;gap:.35rem;padding-bottom:5.5rem}html.m .as-x.live .as-labels li{position:static;width:auto;transform:none;opacity:1;color:var(--muted);transition:color .4s ease}html.m .as-x.live .as-labels li .as-lt b{color:var(--muted)}html.m .as-x.live .as-labels li.on{color:var(--ink)}html.m .as-x.live .as-labels li.on .as-lt b{color:var(--primary-text)}html.m .as-x.live .as-ln{display:none}html.m .as-x.live .as-labels li .as-lt{padding:0;background:none;border:0;font-size:.95rem;grid-template-columns:2rem 1fr;align-items:baseline}}
/* close-ups */
.as-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.as-close-grid{display:grid;gap:1rem;grid-template-columns:1fr 1fr}
.as-cl>div{overflow:hidden;border-radius:var(--radius);aspect-ratio:6/7}
.as-cl.down{margin-top:clamp(2rem,1rem + 6vw,7rem)}
.as-cl-img{width:100%;height:118%;margin-top:-9%;object-fit:cover}
.as-close-copy{grid-column:1/-1;max-width:46rem;margin-top:2rem}
.as-say{font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2vw,3rem);font-weight:600;line-height:1.1;letter-spacing:0}
/* specs */
.as-specs{display:grid;gap:2rem}
@media (min-width:60rem){.as-specs{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.as-dl{border-top:1px solid var(--ink)}
.as-dl div{display:grid;gap:.3rem;padding:1.15rem 0;border-bottom:1px solid var(--line)}
@media (min-width:40rem){.as-dl div{grid-template-columns:12rem 1fr;gap:1.5rem}}
.as-dl dt{font-weight:600}
.as-dl dd{color:var(--muted)}
.as-dl ul{display:grid;gap:.3rem}
/* buy */
.as-buy{border-top:1px solid var(--rule)}
.as-buy-in{display:grid;gap:2rem;align-items:end}
@media (min-width:56rem){.as-buy-in{grid-template-columns:7fr 5fr;gap:clamp(2rem,1rem + 4vw,6rem)}.as-buy.solo .as-buy-in{grid-template-columns:minmax(0,40rem)}}
.as-buy-shot{position:relative;display:grid;place-items:center;min-height:clamp(18rem,12rem + 16vw,30rem);border-radius:var(--radius);background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 4%,var(--bg)),color-mix(in srgb,var(--ink) 9%,var(--bg)));perspective:1800px}
.as-buy-shot .as-kit{--W:min(24vmin,14rem)}
.as-rest .as-stack{transform:rotateX(-8deg) rotateY(-20deg)}
.as-rest.as-flat .as-stack{transform:rotateX(58deg) rotateZ(-24deg)}
.as-buy-copy{padding-top:1.2rem;border-top:1px solid var(--ink)}
.as-price{margin-top:1rem;font-family:var(--font-display);font-size:clamp(2.2rem,1.7rem + 1.8vw,3.4rem);font-weight:600;letter-spacing:0}
.as-ship{margin-top:1.4rem;color:var(--muted)}
.as-form{width:min(100%,30rem);margin-top:1.6rem}
.as-qa{border-top:1px solid var(--ink)}
.as-qa li{display:grid;grid-template-columns:3rem 1fr;gap:1rem;padding:1.2rem 0;border-bottom:1px solid var(--rule)}
.as-qa b{font-size:.8rem;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:.3rem}
.as-qa h3{font-size:1.3rem}
.as-qa p{margin-top:.35rem;color:var(--muted)}
/* footer: ruled like the spec sheet */
.as-ftr{padding-block:clamp(3.5rem,2.5rem + 3vw,6rem) 1.5rem;border-top:1px solid var(--rule);background:color-mix(in srgb,var(--ink) 4%,var(--bg))}
.as-ftr-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem 1.5rem;padding-bottom:1.2rem;border-bottom:2px solid var(--ink)}
.as-ftr-n{font-family:var(--font-display);font-weight:600;font-size:clamp(2.4rem,1.6rem + 3.4vw,4.6rem);line-height:.95}
.as-ftr-l{color:var(--muted)}
.as-ftr-dl div{display:grid;gap:.2rem;padding:.95rem 0;border-bottom:1px solid var(--rule)}
@media (min-width:40rem){.as-ftr-dl div{grid-template-columns:12rem 1fr;gap:1.5rem}}
.as-ftr-dl dt{font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding-top:.2rem}
.as-ftr-dl dd{font-size:1.05rem}
.as-ftr-dl a{text-decoration:none}.as-ftr-dl a:hover{text-decoration:underline}
.as-ftr-base{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.6rem;padding-top:1.4rem;font-size:.88rem;color:var(--muted)}
.as-ftr-base ul{display:flex;flex-wrap:wrap;gap:.2rem 1.2rem}
.as-ftr-base a{color:var(--muted);text-decoration:none}.as-ftr-base a:hover{color:var(--ink)}
.as-ftr-base p{margin-left:auto}
.as-ftr .legal-links,.as-ftr .mpause{margin-inline:auto}
.menu-panel{border-top:2px solid var(--ink)}
.menu-panel li a{font-family:var(--font-display);font-weight:600;letter-spacing:0}
.field input,.field select,.field textarea{border-radius:4px;background:#fff}
.mbar{box-shadow:none;border-top-color:var(--rule)}
@media (prefers-reduced-motion:reduce){.as-stack{transform:rotateX(-12deg) rotateY(-30deg)}.as-flat .as-stack{transform:rotateX(58deg) rotateZ(-30deg)}}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Assembly',
  bestFor: 'A physical product worth opening up: a speaker, headphones, a bag, a lamp, a device, a kit with parts',
  match: /\b(speakers?|headphones|earbuds|keyboards?|lamps?|gadgets?|devices?|hardware|electronics|e-?bikes?|drones?|backpacks?|chargers?|wearables?|mod(ular)? kits?)\b/,
  why: 'Built for a physical product: the name assembles like fitted parts and your product lands beside it, built from its real parts; then it comes apart along its own axis as you scroll, each part labelled from your own feature list, and goes back together, ending on the price; then the spec sheet and the Buy block.',
  fonts: { q: 'family=Barlow+Semi+Condensed:wght@600&family=IBM+Plex+Sans:wght@400..600', display: ['Barlow Semi Condensed', 'grotesk'], body: ['IBM Plex Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): parts fitted together, a product with spring in it, close-ups at two speeds.
  choreo: { intro: 'assemble', alive: ['pointer', 'tap', 'drift'], scroll: 'scrub', pace: 'medium', look: 'clean, engineered, aluminium and paper' },
  tokens,
  slots,
  nav,
  art,
  render,
};
