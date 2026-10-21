// Bloom (animated, studio): a botanical plate for florists and small studios.
//   Object:   the stem and the bunch. The hero is a botanical plate: one flower drawn in a single line inside a ruled
//             plate frame, the name set beside it like the plate's title. Further down, loose stems lie across the
//             page and the scroll gathers them into one tied bunch. The price list is the shop's card on its string.
//   Material: white newsprint and black ink: 1px and 1.5px ink rules, square corners, a heavy wide grotesk.
//   One move: the flower draws itself, stem first, then the head opens, while the name settles from wide tracking
//             (choreo intro 'draw').
//   Pop:      the member's colour is the flower's head in every drawing. The neon partner is the one tie: the ribbon
//             round the bunch (or the ring round the keys). Never a fill, never a line under the name.
//   Kinds:    flowers for a florist, a plant for a plant shop, a sprig for a yoga or pilates studio, and for anyone
//             else a bunch of keys on a ring (no flowers for a barber).
// Two modes: newsprint (its own) and the herbarium after dark. A rendered photo, when the pack ships one, takes the
// hero plate and the drawing moves down to the shop. At rest the plate drifts; once tied, the bunch sways on springs
// when tapped, brushed past or scrolled (SWAY_JS, the page's showpiece). The one scroll moment is the bunch: the stems swing in from
// where they lie and gather into a fan, then the ribbon is drawn round them (backwards when scrolling up), on the
// choreo runtime's --p. JavaScript off and reduced motion: the bunch is tied, every drawing complete.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { REVIEWS_CSS, esc } = require('../shared');
const Art = require('../../art');
// No Lenis here: its 19 KB would take the page past the 70 KB budget the reel designs keep (test/site-motion.test.js).

const id = 'bloom';

// Two rooms: white newsprint and black ink (its own), and the herbarium after dark: green-black stock, bone ink,
// and the opening-hours poster turned to bone paper.
function tokens(p, mode) {
  if (mode === 'dark') return { bg: '#111412', dark: '#080a09' };
  return { bg: color.mix(p.paper, '#ffffff', 0.94), dark: color.mix(p.ink, '#111111', 0.8) };
}
// The rendered photo for this kind, when the pack ships one: the florist's bunch (bunch), else bunch-plant,
// bunch-sprig or bunch-keys.
const photoName = (kind) => (kind === 'flower' ? 'bunch' : `bunch-${kind}`);

// The bunch, once tied, is alive (the page's showpiece): a tap knocks the stems (or keys) on their springs, a pointer
// brushing across them stirs them, and the scroll's speed sets them swaying a little; each settles on its own spring.
// Stands down without the motion class, under a still brief (no alive rule), while paused and off screen.
const SWAY_JS = `(function(){var d=document,h=d.documentElement;if(!h.classList.contains('m'))return;var fld=d.querySelector('.bl-field'),a=d.querySelector('[data-alive]');if(!fld||!a||getComputedStyle(a).willChange.indexOf('transform')<0)return;var S=[].slice.call(fld.querySelectorAll('.bl-stem')).map(function(e,i){return{e:e,x:0,v:0,k:30+i*7}});var raf=0,last=0,vis=false,ly=scrollY,px=-1;var paused=function(){return h.classList.contains('mp')||d.hidden};function f(now){raf=0;if(paused()||!vis)return;var dt=Math.min(.033,last?(now-last)/1000:.016),any=false;last=now;S.forEach(function(s){s.v+=(-s.k*s.x-3.2*s.v)*dt;s.x+=s.v*dt;if(Math.abs(s.x)+Math.abs(s.v)>.01)any=true;else{s.x=s.v=0}s.e.style.setProperty('--sw',s.x.toFixed(2)+'deg')});if(any)raf=requestAnimationFrame(f);else last=0}function go(){if(!raf&&vis&&!paused()){last=0;raf=requestAnimationFrame(f)}}function kick(v,cx){var r=fld.getBoundingClientRect();S.forEach(function(s,i){var b=s.e.getBoundingClientRect(),near=cx==null?1:Math.max(0,1-Math.abs(cx-(b.left+b.width/2))/(r.width*.35));s.v+=v*near*(i%2?1:-.8)});go()}fld.addEventListener('pointerdown',function(e){kick(26,e.clientX)});fld.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;if(px>=0)kick(Math.max(-6,Math.min(6,(e.clientX-px)*.35)),e.clientX);px=e.clientX});fld.addEventListener('pointerleave',function(){px=-1});addEventListener('scroll',function(){var dy=scrollY-ly;ly=scrollY;if(vis)kick(Math.max(-3,Math.min(3,dy*.04)))},{passive:true});new IntersectionObserver(function(es){vis=es[0].isIntersecting;go()}).observe(fld);new MutationObserver(go).observe(h,{attributes:true,attributeFilter:['class']});d.addEventListener('visibilitychange',go)})();`;

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'bunch', file: 'bunch.jpg', w: 1200, h: 1500, style: 'portrait', alt: g[0] || c.profile.hero || `Flowers from ${c.name}` }];
}

function nav(c) {
  return [
    c.services.length && { label: c.template === 'studio' ? 'Prices' : 'Services', href: '#menu' },
    { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Visit', href: '#visit' },
  ].filter(Boolean);
}

// What the plates show, from the facts: flowers for a florist, a plant for a plant studio, a cut sprig (green and a
// few berries) for a yoga or pilates studio, and for anyone else (a barber, a coach, a cafe) no botany at all: a bunch
// of keys on a ring, the studio's own, which is about the place rather than a trade.
function kindOf(c) {
  const s = `${c.what || ''} ${c.niche || ''} ${c.name || ''} ${(c.services || []).map((x) => x.name).join(' ')}`.toLowerCase();
  if ((c.profile && c.profile.id === 'florist') || /\b(florists?|floral|flowers?|bouquets?|blooms?)\b/.test(s)) return 'flower';
  if (/\b(plants?|houseplants?|nurser(y|ies)|botanical|garden\w*|terrarium\w*|succulents?)\b/.test(s)) return 'plant';
  if (/\b(yoga|pilates|meditation|breathwork)\b/.test(s)) return 'sprig';
  return 'keys';
}

// The name as words, one to a line, so the draw intro's tracking never rewraps it.
function nameParts(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w bl-word" data-ci-part>${esc(w)}</span>`).join(' ');
}

// The plate: one stem with two leaves (ink) and an open flower (the member's colour), every path drawn on.
const PLATE = `<svg class="bl-plate-svg" viewBox="0 0 300 420" aria-hidden="true"><g class="ink"><path pathLength="1" d="M150 410C150 330 146 270 152 200"/><path pathLength="1" d="M151 300C120 290 92 262 86 228 118 232 146 256 151 300Z"/><path pathLength="1" d="M152 252C178 236 210 226 232 200 200 194 166 214 152 252Z"/></g><g class="head"><path pathLength="1" d="M152 200C126 196 104 176 104 150 104 120 128 104 152 128 168 100 204 104 206 134 232 132 246 160 228 180 246 200 232 228 206 222 204 248 172 252 160 226 150 238 132 230 136 210"/><path pathLength="1" d="M152 128C150 148 152 170 152 200M170 176C178 166 192 162 206 166M134 172C126 160 116 156 104 160"/></g></svg>`;

// The plate for a plant studio: a pot, three stems, two open leaves and the new one unfurling (the member's colour).
const PLATE_PLANT = `<svg class="bl-plate-svg" viewBox="0 0 300 420" aria-hidden="true"><g class="ink"><path pathLength="1" d="M86 330H214V348H86Z"/><path pathLength="1" d="M92 348L104 404H196L208 348"/><path pathLength="1" d="M150 330C150 286 130 244 100 216"/><path pathLength="1" d="M150 330C152 276 170 234 204 202"/><path pathLength="1" d="M150 330C150 296 150 256 152 180"/><path pathLength="1" d="M100 216C64 222 40 196 46 162 78 152 106 174 100 216ZM100 216C84 198 68 182 52 170"/><path pathLength="1" d="M204 202C242 210 266 182 258 148 224 140 198 166 204 202ZM204 202C220 186 236 172 252 158"/></g><g class="head"><path pathLength="1" d="M152 180C126 170 118 140 136 120 156 106 180 126 168 148 160 162 142 158 146 142"/></g></svg>`;
// The plate for anything else: one cut sprig, its leaves paired up the stem, berries at the tip (the member's colour).
const PLATE_SPRIG = `<svg class="bl-plate-svg" viewBox="0 0 300 420" aria-hidden="true"><g class="ink"><path pathLength="1" d="M150 410C148 330 156 250 150 170C146 130 150 104 156 84"/><path pathLength="1" d="M150 344C124 340 108 324 106 306 128 306 146 322 150 344Z"/><path pathLength="1" d="M151 300C176 292 190 274 190 256 168 258 152 276 151 300Z"/><path pathLength="1" d="M151 250C126 244 112 226 112 208 134 210 150 228 151 250Z"/><path pathLength="1" d="M150 204C172 196 184 180 184 162 164 164 150 182 150 204Z"/><path pathLength="1" d="M149 160C130 152 122 136 124 120 142 124 150 140 149 160Z"/></g><g class="head"><path pathLength="1" d="M156 100C162 94 168 90 174 82M153 104C150 96 146 92 140 86M156 84V70"/><path pathLength="1" d="M156 70a8 8 0 1 1 .1 0M174 82a7 7 0 1 1 .1 0M140 86a7 7 0 1 1 .1 0"/></g></svg>`;
// The neutral plate: the studio's key, standing on its bow, its paper tag (the member's colour) on a loop of string.
const PLATE_KEY = `<svg class="bl-plate-svg" viewBox="0 0 300 420" aria-hidden="true"><g class="ink"><path pathLength="1" d="M150 296a36 36 0 1 0 .1 0"/><path pathLength="1" d="M150 320a9 9 0 1 0 .1 0"/><path pathLength="1" d="M150 296V96M138 284h24M140 276h20"/><path pathLength="1" d="M150 96h28v18h-12v14h12v20h-12v12h12v18h-28"/><path pathLength="1" d="M178 350C204 362 222 346 226 318"/></g><g class="head"><path pathLength="1" d="M210 316l34-14 16 40-34 14Z"/><path pathLength="1" d="M226 318a4 4 0 1 0 .1 0"/></g></svg>`;

// Loose stems for the bunch, each a different flower in one line: open bloom, tulip, sprig of buds, frond, daisy.
// Base at (60,360); the head sits at the top. Ink stems, heads in the member's colour.
const HEADS = [
  'M60 92C40 90 28 72 34 56 44 40 58 52 60 62 62 46 80 38 90 52 98 66 84 86 60 92ZM60 92C58 78 60 66 60 62',
  'M60 96C38 92 32 66 40 44 48 56 54 52 60 36 66 52 72 56 80 44 88 66 82 92 60 96Z',
  'M60 150C46 128 40 108 44 90M60 120C74 104 80 86 78 70M44 90a8 8 0 1 1 1 0M78 70a8 8 0 1 1 1 0M60 98a8 8 0 1 1 1 0',
  'M60 210C40 196 30 176 34 160M60 180C80 168 88 150 86 134M60 150C42 138 36 120 40 106M60 124C76 112 82 96 80 82M60 100C48 88 46 74 50 62',
  'M60 70L60 40M60 70L82 48M60 70L90 72M60 70L80 94M60 70L56 98M60 70L36 90M60 70L30 66M60 70L38 46',
];
const STEMS = [
  { stem: 'M60 360C58 260 64 170 60 92', leaf: 'M60 250C40 236 32 214 34 196 50 204 60 222 60 250Z', head: 0, x: -38, r: -64, f: -14 },
  { stem: 'M60 360C62 270 56 170 60 96', leaf: 'M60 230C82 220 92 198 90 180 74 188 62 206 60 230Z', head: 1, x: 30, r: 58, f: -5 },
  { stem: 'M60 360C60 280 60 200 60 150', leaf: '', head: 2, x: -22, r: -38, f: 4 },
  { stem: 'M60 360C58 300 62 250 60 210', leaf: '', head: 3, x: 40, r: 76, f: 12 },
  { stem: 'M60 360C62 240 56 140 60 70', leaf: 'M60 270C42 258 36 240 38 224 52 232 60 248 60 270Z', head: 4, x: -46, r: -84, f: 20 },
  { stem: 'M60 360C58 250 62 160 60 92', leaf: 'M60 210C80 200 88 182 86 166 72 174 62 190 60 210Z', head: 0, x: 22, r: 44, f: -22 },
];
// Keys for the neutral bunch, in the same box (bow at the base, 60,330): bow, shank and collar in ink, the bit's
// teeth in the member's colour. Three bows (round, square, trefoil), each its own length and cut.
const BOWS = ['M60 308a22 22 0 1 0 .1 0M60 324a6 6 0 1 0 .1 0', 'M46 310h28q4 0 4 4v32q0 4-4 4h-28q-4 0-4-4v-32q0-4 4-4ZM60 326a6 6 0 1 0 .1 0', 'M48 318a12 12 0 1 0 .1 0M72 318a12 12 0 1 0 .1 0M60 300a12 12 0 1 0 .1 0M60 322a4 4 0 1 0 .1 0'];
function keyPaths(i) {
  const top = [96, 130, 112, 150, 88, 124][i % 6], sq = i % 3;
  const bit = i % 2 ? `M60 ${top}h16v10h-7v9h7v12h-7v8h7v9h-16` : `M60 ${top}h12v14h8v10h-8v12h10v11h-22`;
  return { ink: `${BOWS[sq]}M60 ${sq === 1 ? 310 : 300}V${top}M52 296h16`, head: bit };
}
function stemSvg(st, i, kind) {
  const leafy = kind !== 'flower';
  const style = `--x:${(st.x * 0.22).toFixed(2)}rem;--r:${st.r}deg;--f:${st.f}deg;--i:${i}`;
  if (kind === 'keys') { const k = keyPaths(i); return `<svg class="bl-stem" viewBox="0 0 120 380" aria-hidden="true" style="${style}"><path class="ink" d="${k.ink}"/><path class="head" d="${k.head}"/></svg>`; }
  return `<svg class="bl-stem" viewBox="0 0 120 380" aria-hidden="true" style="${style}"><path class="ink" d="${st.stem}"/>${st.leaf ? `<path class="ink" d="${st.leaf}"/>` : ''}<path class="head" d="${HEADS[leafy ? [3, 2][i % 2] : st.head]}"/></svg>`;
}

// "Workshop" in a list of what the studio makes reads as plural ("weekly flowers, wedding flowers and workshops").
const PLURAL = /^(workshop|class|lesson|course|session|event|tour|consultation|subscription|delivery|installation|arrangement|bouquet)$/i;
const plural = (t) => (PLURAL.test(t) ? t.replace(/(ss|sh|ch|x)$/i, '$1e').replace(/y$/i, 'ie') + 's' : t);

function render(c) {
  const kind = kindOf(c);
  // A florist's button orders flowers; the label follows the member's own link otherwise.
  if (kind === 'flower' && c.primary && /^(book|book now|book online)$/i.test(c.primary.label || '') && c.primary.kind !== 'form' && c.primary.kind !== 'phone') c = { ...c, primary: { ...c.primary, label: 'Order flowers', short: 'Order' } };
  const mag = (h) => h.replace('<a ', '<a data-mag ');
  const formAsk = c.primary.kind === 'form';
  const open = c.hours.rows.filter((r) => !r.closed);
  // With a rendered photo for this kind, the photo takes the hero plate and the drawing moves down to the shop.
  const heroPhoto = !!(Art.photo && Art.photo('bloom', photoName(kind)));
  const drawn = kind === 'flower' ? PLATE : kind === 'plant' ? PLATE_PLANT : kind === 'sprig' ? PLATE_SPRIG : PLATE_KEY;
  const plateCap = [c.name, c.address ? c.address.split(',')[0] : '', c.city].filter(Boolean).join(', ');
  // The lead: what the studio makes, from the services, in the owner's terms.
  const svc = c.services.map((s) => s.name);
  const lc = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const lead = svc.length >= 2 ? `${svc.slice(0, -1).map((t, i) => plural(i ? lc(t) : t)).join(', ')} and ${plural(lc(svc[svc.length - 1]))}${c.city && !c.online ? `, from a small studio in ${c.city}` : ''}.` : c.heroSub;

  const hero = `<section class="bl-hero" aria-labelledby="hero-title">
<div class="wrap bl-hero-grid">
<div class="bl-hero-copy">
<h1 class="bl-name" id="hero-title" data-ci="head">${nameParts(c.name)}</h1>
<p class="bl-lead">${esc(lead)}</p>
<div class="bl-act" data-ci="then" data-ci-from="fade">${mag(P.button(c.primary, 'btn btn-primary btn-lg'))}${c.secondary ? P.button(c.secondary, 'btn btn-line btn-lg') : ''}</div>
</div>
<figure class="bl-plate"><div class="bl-plate-lean" data-alive="0.4"><div class="bl-plate-in${heroPhoto ? ' bl-plate-photo' : ''}" data-ci="subject">${heroPhoto ? P.img(c, 'bunch', { cls: 'bl-plate-img', eager: true }) : drawn}</div></div>${plateCap ? `<figcaption>${esc(plateCap)}</figcaption>` : ''}</figure>
</div>
</section>`;

  // The price list as the shop's card on its string: a punched hole, the services hand set with leaders.
  const list = c.services.length
    ? `<ul class="bl-menu">${c.services.map((s) => `<li><span class="bl-mt">${esc(s.name)}${s.duration || s.blurb ? `<small>${esc([s.duration, s.blurb].filter(Boolean).join(', '))}</small>` : ''}</span><span class="bl-dots" aria-hidden="true"></span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul>`
    : '';
  const incl = c.included.length ? `<ul class="bl-incl">${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const label = c.template === 'studio' ? 'Prices' : 'Services';
  const menu = list || incl
    ? `<section class="bl-sec bl-shop" id="menu" aria-labelledby="menu-title"><div class="wrap bl-shop-grid">
<div class="bl-card"><span class="bl-hole" aria-hidden="true"></span><h2 class="bl-card-h" id="menu-title">${esc(label)}</h2>${list}${incl}<div class="bl-menu-cta">${mag(P.button(c.primary, 'btn btn-primary'))}</div></div>
<figure class="bl-photo">${heroPhoto ? `<div class="bl-plate-in">${drawn}</div>` : P.img(c, 'bunch', { cls: 'bl-photo-img' })}</figure>
</div></section>`
    : '';

  // The scroll moment and the story: loose stems gathered into a bunch beside the member's own words.
  // Generated about copy restates the hero ("X is a Y in Z, run by W. You can reach W directly"); keep what is new.
  const lw = (t) => String(t || '').toLowerCase();
  const restates = (t) => (lw(t).includes(lw(c.name)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  const [say = '', ...more] = c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
  // With no story of the member's own, the bunch has the stage to itself (a shorter scene, the field centred).
  const story = !!(say || more.length || c.promise);
  const about = `<section class="bl-sec bl-bunch${story ? '' : ' bl-bunch-solo'}" id="about" aria-labelledby="about-title" data-sc>
<div class="bl-stage" data-sc-stage>
<div class="wrap bl-bunch-grid">
<div class="bl-story"><h2 class="${story ? 'bl-h' : 'sr-only'}" id="about-title">${esc(c.owner && c.owner !== c.name ? `${c.name}, by ${c.owner}` : `About ${c.name}`)}</h2>
${say ? `<p class="bl-say">${esc(say)}</p>` : ''}
${more.map((p) => `<p class="bl-p">${esc(p)}</p>`).join('\n')}
${c.promise ? `<p class="bl-p">${esc(c.promise)}</p>` : ''}</div>
<div class="bl-field" aria-hidden="true">${STEMS.map((st, i) => stemSvg(st, i, kind)).join('')}${kind === 'keys' ? '<svg class="bl-ribbon bl-ring" viewBox="0 0 120 380"><path pathLength="1" d="M60 296a34 34 0 1 0 .1 0"/></svg>' : '<svg class="bl-ribbon" viewBox="0 0 120 60"><path pathLength="1" d="M18 22C40 34 80 34 102 22M58 30C46 44 38 54 30 58M62 30C72 44 82 52 92 56"/></svg>'}</div>
</div>
</div>
</section>`;

  const how = c.steps.length
    ? `<section class="bl-sec" aria-labelledby="how-title"><div class="wrap"><h2 class="bl-h" id="how-title">How it works</h2><ol class="bl-steps">${c.steps.map((s, i) => `<li><span class="bl-n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol></div></section>`
    : '';
  const reviews = c.reviews.length ? `<section class="bl-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="bl-h" id="reviews-title">Kind words</h2>${P.reviews(c)}</div></section>` : '';
  const faq = c.faq.length ? `<section class="bl-sec" id="faq" aria-labelledby="faq-title"><div class="wrap bl-two"><h2 class="bl-h" id="faq-title">Questions</h2><dl class="bl-qa">${c.faq.map((q) => `<div><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl></div></section>` : '';

  const visit = `<section class="bl-sec bl-visit" id="visit" aria-labelledby="visit-title"><div class="wrap bl-visit-in">
<div><h2 class="bl-visit-h" id="visit-title">${esc(open.length ? `Open ${open.map((r) => `${r.days}, ${r.time}`).join('. ')}.` : c.address ? c.address.split(',')[0] : c.primary ? `${c.primary.label}.` : 'Book a time.')}</h2>
${formAsk ? '' : `<div class="bl-act">${mag(P.button(c.primary, 'btn btn-light btn-lg'))}</div>`}</div>
<div class="bl-reach">${P.contactList(c, { showHours: false })}</div>
${formAsk ? `<div id="contact" class="bl-form">${P.form(c, { id: 'contact', fields: ['name', 'email', 'phone', { ...P.FIELD_PRESETS.when }, { ...P.FIELD_PRESETS.message, label: 'What would you like?' }], submit: 'Send', subject: `Request from your website` })}</div>` : ''}
</div></section>`;

  // The close is a herbarium label, the card pinned under every pressed specimen: what it is, where it was found,
  // who keeps it, when it is open and how to reach them, in ruled rows. The pages run beside it. Not the shared footer.
  const reach = [c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`, c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`].filter(Boolean).join('<br>');
  const where = c.address || (c.area && !c.online ? c.area : '');
  const rows = [
    ['Studio', esc(c.name)],
    c.whatShort && ['Kind', esc(c.whatShort)],
    where && ['Found at', c.mapsUrl && c.address ? `<a href="${esc(c.mapsUrl)}">${esc(where)}</a>` : esc(where)],
    c.owner && c.owner !== c.name && ['Kept by', esc(c.owner)],
    c.hoursLine && ['Open', esc(c.hoursLine)],
    reach && ['Reach', reach],
  ].filter(Boolean);
  const footer = `<footer class="bl-ftr"><div class="wrap bl-ftr-in">
<nav aria-label="Footer"><ul class="bl-ftr-nav">${(c.nav || []).map((x) => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul>${P.socials(c, { cls: 'bl-ftr-social', size: 18 })}</nav>
<dl class="bl-label">${rows.map(([k2, v]) => `<div><dt>${k2}</dt><dd>${v}</dd></div>`).join('')}</dl>
<p class="bl-ftr-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div></footer>`;

  const m = motion();
  const body = [P.header(c, { cls: 'bl-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, menu, about, how, reviews, faq, visit, '</main>', footer, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}${SWAY_JS}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '84rem' } };
}

// The placeholder, drawn as the hero is: a second botanical plate on white newsprint, in the same single ink line,
// with the heads (or the new growth) in the member's colour. What it shows comes from the facts:
//   flowers: a hand-tied bunch in a paper wrap, the ribbon in a bow   plants: a potted plant, a new leaf unfurling
//   anything else: three cut sprigs in a glass jar of water, berries at the tips (about the room, not a trade).
// Line only: a paper sheet with a double rule, ink strokes in one weight, hatching for the shadow side. No text.
function art(slot, { p, c, seed, index, art: Art }) {
  if (slot.slot !== 'bunch') return null;
  const kind = kindOf(c || {});
  // A rendered photo wins when the pack ships one for this kind; the drawing stays the fallback.
  const ph = Art.photo && Art.photo('bloom', photoName(kind));
  if (ph) return ph;
  const w = slot.w, h = slot.h, k = w / 300;
  const f = (v) => v.toFixed(1);
  const r = Art.rng(`${seed}:bunch`);
  const paper = color.mix(p.paper, '#ffffff', 0.94);
  const ink = color.mix(p.ink, '#111111', 0.5);
  const pop = p.primary;
  const I = `fill="none" stroke="${ink}"`, O = `fill="none" stroke="${pop}"`;
  const dir = (a, R) => [Math.cos(a) * R, Math.sin(a) * R];
  // A flower head in one line: five looped petals round a small eye.
  const bloom = (x, y, R, rot) => {
    let d = '';
    for (let i = 0; i < 5; i++) { const a = rot + (i / 5) * Math.PI * 2, [ax, ay] = dir(a - 0.5, R * 1.9), [bx, by] = dir(a + 0.5, R * 1.9); d += `M${f(x)} ${f(y)}C${f(x + ax)} ${f(y + ay)} ${f(x + bx)} ${f(y + by)} ${f(x)} ${f(y)}`; }
    return `<path d="${d}" ${O}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.28)}" ${O}/>`;
  };
  const leaf = (x, y, L, a) => { const [tx, ty] = dir(a, L), [n1x, n1y] = dir(a - 0.6, L * 0.55), [n2x, n2y] = dir(a + 0.6, L * 0.55); return `<path d="M${f(x)} ${f(y)}Q${f(x + n1x)} ${f(y + n1y)} ${f(x + tx)} ${f(y + ty)}Q${f(x + n2x)} ${f(y + n2y)} ${f(x)} ${f(y)}M${f(x)} ${f(y)}L${f(x + tx * 0.8)} ${f(y + ty * 0.8)}" ${I}/>`; };
  let g = '';
  if (kind === 'flower') {
    // Stems fan from the tie; the wrap folds round them; the ribbon is tied in a bow over the wrap.
    const tie = [150, 262];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.24 + (r() - 0.5) * 0.08, L = 120 + r() * 46;
      const [hx, hy] = dir(a, L);
      const x = tie[0] + hx, y = tie[1] + hy;
      g += `<path d="M${f(150 + (i - 3) * 3)} 352L${f(tie[0] + (i - 3) * 1.2)} ${tie[1]}Q${f(tie[0] + hx * 0.5)} ${f(tie[1] + hy * 0.55)} ${f(x)} ${f(y)}" ${I}/>`;
      if (i % 2 === 0) g += leaf(tie[0] + hx * 0.5, tie[1] + hy * 0.5, 30, a + (i < 3 ? -0.7 : 0.7));
      g += i % 2 ? bloom(x, y, 15 + r() * 6, r() * 6) : `<path d="M${f(x)} ${f(y + 8)}C${f(x - 10)} ${f(y - 2)} ${f(x - 6)} ${f(y - 16)} ${f(x)} ${f(y - 20)}C${f(x + 6)} ${f(y - 16)} ${f(x + 10)} ${f(y - 2)} ${f(x)} ${f(y + 8)}Z" ${O}/>`;
    }
    const wrap = 'M66 196L232 178L172 360L134 362Z';
    const hatch = Array.from({ length: 9 }, (_, i) => `M${f(176 + i * 7)} ${f(196 + i * 6)}L${f(162 + i * 2.2)} ${f(232 + i * 14)}`).join('');
    g += `<path d="${wrap}" fill="${paper}" stroke="${ink}"/><path d="M232 178L150 270L134 362" ${I}/><clipPath id="bw"><path d="M232 178L150 270L172 360Z"/></clipPath><path d="${hatch}" ${I} stroke-width="1" clip-path="url(#bw)"/>`;
    g += `<path d="M120 300Q152 312 186 296" ${O}/><path d="M152 306C130 284 112 296 122 310C130 320 146 312 152 306C166 286 192 292 184 310C176 322 160 314 152 306M152 306C146 324 138 340 128 350M152 306C160 324 170 338 182 346" ${O}/>`;
  } else if (kind === 'plant') {
    g += `<path d="M86 300H214V318H86ZM92 318L104 368H196L208 318" fill="${paper}" stroke="${ink}"/><path d="${Array.from({ length: 7 }, (_, i) => `M${f(160 + i * 7)} 322L${f(150 + i * 7)} 366`).join('')}" ${I} stroke-width="1"/>`;
    g += `<path d="M150 300C150 256 130 214 100 186M150 300C152 246 170 204 204 172M150 300C150 266 150 226 152 150" ${I}/>`;
    g += `<path d="M100 186C64 192 40 166 46 132C78 122 106 144 100 186ZM100 186C84 168 68 152 52 140M204 172C242 180 266 152 258 118C224 110 198 136 204 172ZM204 172C220 156 236 142 252 128" ${I}/>`;
    g += `<path d="M152 150C126 140 118 110 136 90C156 76 180 96 168 118C160 132 142 128 146 112" ${O}/>`;
  } else if (kind === 'keys') {
    // The studio's keys on a ring, lying on the paper; the paper tag (the member's colour) on its loop of string.
    const [rx, ry] = [150, 168];
    g += `<path d="M${rx} ${ry - 28}a28 28 0 1 0 .1 0" ${I}/><path d="M${rx} ${ry - 24}a24 24 0 1 0 .1 0" ${I} stroke-width="1"/>`;
    [[-36, 118, 0], [-6, 128, 1], [24, 104, 2]].forEach(([a, L, i]) => {
      const bow = i === 1 ? 'M-13 -13h26v26h-26Z' : 'M0 -15a15 15 0 1 0 .1 0';
      const t = 15 + L;
      g += `<g transform="translate(${rx} ${ry}) rotate(${a}) translate(0 41)"><path d="${bow}M0 -4a4 4 0 1 0 .1 0M0 15V${t}M-7 22h14" ${I}/><path d="M0 ${t - 44}h12v8h-6v8h6v10h-6v6h6v12h-12" ${O}/></g>`;
    });
    g += `<path d="M${rx - 22} ${ry - 18}C${rx - 46} ${ry - 44} ${rx - 70} ${ry - 40} ${rx - 84} ${ry - 22}" ${I}/><path d="M${rx - 74} ${ry - 30}l-36 -8 -9 40 36 8Z" ${O}/><path d="M${rx - 82} ${ry - 22}a3.5 3.5 0 1 0 .1 0" ${O}/>`;
  } else {
    // A jar of water: the glass in two lines with the waterline, three sprigs leaning, berries at the tips.
    g += `<path d="M108 230V350Q108 362 120 362H180Q192 362 192 350V230M102 230H198" ${I}/><path d="M110 268Q150 276 190 268" ${I} stroke-width="1"/><path d="M116 246V340" ${I} stroke-width="1" stroke-opacity=".5"/>`;
    [[150, -0.05], [136, -0.4], [166, 0.34]].forEach(([x, a]) => {
      const [tx, ty] = dir(-Math.PI / 2 + a, 190);
      const ex = x + tx, ey = 340 + ty;
      g += `<path d="M${x} 340Q${f(x + tx * 0.3)} ${f(340 + ty * 0.6)} ${f(ex)} ${f(ey)}" ${I}/>`;
      for (let i = 1; i < 5; i++) { const t = 0.35 + i * 0.13; g += leaf(x + tx * t * 0.92, 340 + ty * t, 24 - i * 2, -Math.PI / 2 + a + (i % 2 ? -0.62 : 0.62)); }
      g += `<circle cx="${f(ex)}" cy="${f(ey)}" r="5" ${O}/><circle cx="${f(ex + 9)}" cy="${f(ey + 6)}" r="4" ${O}/><circle cx="${f(ex - 8)}" cy="${f(ey + 7)}" r="4" ${O}/>`;
    });
  }
  const body = `<rect width="${w}" height="${h}" fill="${paper}"/><rect x="${f(16 * k)}" y="${f(16 * k)}" width="${f(w - 32 * k)}" height="${f(h - 32 * k)}" fill="none" stroke="${ink}" stroke-width="${f(1.5 * k / 2)}"/><rect x="${f(22 * k)}" y="${f(22 * k)}" width="${f(w - 44 * k)}" height="${f(h - 44 * k)}" fill="none" stroke="${ink}" stroke-width="${f(k / 2)}"/><g transform="scale(${f(k * 0.86)}) translate(${f(150 / 0.86 - 150)} ${f((h / k / 0.86 - 375) / 2 + 6)})" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${g}</g>`;
  return Art.svgDoc(w, h, '', body);
}

const CSS = `
${REVIEWS_CSS}
@font-face{font-family:'Bloom Display Fallback';font-weight:500 900;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold');size-adjust:98%}
@font-face{font-family:'Bloom Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:104.6%}
html:root{--font-display:"Archivo","Bloom Display Fallback",sans-serif;--font-body:"Host Grotesk","Bloom Body Fallback",sans-serif}
body{--acc:var(--dark);--on-acc:var(--on-dark);--button:var(--ink);--on-button:var(--bg)}
/* the herbarium after dark: bone ink on green-black stock; the hours poster turns to bone paper with dark ink */
html[data-theme="dark"]{--ink:#ece8dd}
html[data-theme="dark"] .bl-visit{--acc:#ece8dd;--on-acc:#121512;--bg:#ece8dd;--surface:#e2ddd0;--surface-2:#d8d3c5;--muted:#4b504a;--line:#bdb8aa;--primary-on-dark:#121512}
html[data-theme="dark"] .bl-visit .btn-light{background:#121512;color:#ece8dd}
html[data-theme="dark"] .bl-visit .btn-light:hover{background:#2a2e2a;color:#ece8dd}
.btn{font-weight:600;letter-spacing:.01em;border-radius:0}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 82%,var(--bg));color:var(--bg)}
.btn:hover{transform:none}
.btn-line{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}
.btn-line:hover{background:var(--ink);color:var(--bg)}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.85rem}
.btn-light{background:var(--on-dark);color:var(--dark)}
.btn-light:hover{background:color-mix(in srgb,var(--on-dark) 82%,var(--dark));color:var(--dark)}
h1,h2,h3{font-weight:800;letter-spacing:-.04em;font-stretch:118%}
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--ink)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:3.5rem}
.brand{margin-right:auto;font-family:var(--font-display);font-weight:800;font-stretch:120%;letter-spacing:-.03em;text-decoration:none}
.nav ul{display:flex;gap:.2rem}
.nav a{display:block;padding:.4rem .7rem;font-size:.9rem;font-weight:500;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) .7rem calc(100% - .2rem)/0 1.5px no-repeat;transition:background-size .35s cubic-bezier(.16,1,.3,1)}
.nav a:hover{background-size:calc(100% - 1.4rem) 1.5px}
.menu>summary{border-radius:0;border-color:var(--ink)}
.menu-panel li a{font-weight:800;font-stretch:118%;letter-spacing:-.04em}
.menu-panel{min-height:calc(100svh - 3.5rem);overflow-y:auto}
body.has-bar .menu-panel>.btn{display:none}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.bl-n{font-size:.85rem;font-weight:600;font-variant-numeric:tabular-nums}
/* hero: the botanical plate */
.bl-hero{padding-block:clamp(2rem,1.5rem + 3vw,5rem) clamp(3rem,2rem + 4vw,6rem)}
.bl-hero-grid{display:grid;gap:2.5rem}
@media (min-width:56rem){.bl-hero-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;align-items:center}.bl-hero-copy{grid-column:1 / span 6}.bl-plate{grid-column:7 / span 6}}
.bl-hero-copy{display:grid;gap:1.5rem;justify-items:start}
.bl-name{font-size:clamp(3.4rem,1.4rem + 8vw,9.6rem);line-height:.86;letter-spacing:-.06em;font-weight:900;font-stretch:125%}
.bl-word{display:block;width:max-content}
.bl-lead{max-width:24em;font-size:clamp(1.15rem,1rem + .5vw,1.45rem);line-height:1.35}
.bl-act{display:flex;flex-wrap:wrap;gap:.75rem}
.bl-plate{margin:0;width:100%;max-width:min(32rem,66svh);justify-self:end}
.bl-plate-photo{overflow:hidden;background:#0d0f0e}
.bl-plate-img{width:100%;height:100%;object-fit:cover}
.bl-plate-in{display:grid;place-items:center;aspect-ratio:4/5;border:1.5px solid var(--ink);outline:1px solid var(--ink);outline-offset:-10px}
.bl-plate-svg{width:68%;height:auto;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.bl-plate-svg .ink{stroke:var(--ink)}
.bl-plate-svg .head{stroke:var(--pop)}
.bl-plate figcaption{margin-top:.7rem;font-size:.9rem;color:var(--muted)}
/* the shop's price card on its string, beside the bunch */
.bl-sec{padding-block:clamp(4rem,3rem + 4vw,8rem);border-top:1px solid var(--ink)}
.bl-shop-grid{display:grid;gap:2.5rem;align-items:center}
@media (min-width:56rem){.bl-shop-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.bl-card{grid-column:1 / span 6}.bl-photo{grid-column:8 / span 5}}
.bl-card{position:relative;padding:clamp(2.6rem,2rem + 2vw,3.6rem) clamp(1.25rem,1rem + 2vw,2.75rem) clamp(1.5rem,1rem + 2vw,2.5rem);border:1.5px solid var(--ink);background:var(--bg);transform:rotate(-1.2deg)}
.bl-hole{position:absolute;left:50%;top:1rem;width:.9rem;height:.9rem;margin-left:-.45rem;border:1.5px solid var(--ink);border-radius:50%}
.bl-hole::before{content:'';position:absolute;left:50%;bottom:100%;width:1.5px;height:3rem;margin-left:-.75px;background:var(--ink)}
.bl-card-h{text-align:center;font-size:clamp(2rem,1.4rem + 2.4vw,3.4rem);line-height:.95;margin-bottom:1.5rem}
.bl-menu{border-top:1.5px solid var(--ink)}
.bl-menu li{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:.75rem;padding:1rem 0;border-bottom:1px solid var(--line)}
.bl-mt{display:grid;gap:.15rem;font-family:var(--font-display);font-weight:700;font-stretch:112%;font-size:clamp(1.1rem,1rem + .5vw,1.35rem);letter-spacing:-.02em}
.bl-mt small{font-family:var(--font-body);font-weight:400;font-stretch:100%;font-size:.9rem;letter-spacing:0;color:var(--muted)}
.bl-dots{align-self:start;margin-top:1em;border-bottom:1.5px dotted color-mix(in srgb,var(--ink) 40%,transparent)}
.bl-menu strong{font-family:var(--font-display);font-weight:800;font-stretch:112%;font-size:clamp(1.1rem,1rem + .5vw,1.4rem);white-space:nowrap;font-variant-numeric:tabular-nums}
.bl-menu li:hover strong{color:var(--primary-text)}
.bl-incl{display:grid;margin-top:1.5rem;border-top:1px solid var(--ink)}
.bl-incl li{padding:.7rem 0;border-bottom:1px solid var(--line)}
.bl-menu-cta{display:flex;justify-content:center;margin-top:1.75rem}
.bl-photo{margin:0}
.bl-photo .bl-plate-in{width:100%}
.bl-photo-img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
/* the bunch: loose stems the scroll gathers and ties */
.bl-bunch{padding:0}
.bl-bunch-grid{display:grid;gap:2rem;align-items:center}
@media (min-width:56rem){.bl-bunch-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.bl-story{grid-column:1 / span 6}.bl-field{grid-column:7 / span 6}}
.bl-story{display:grid;gap:1.25rem;justify-items:start}
.bl-h{font-family:var(--font-body);font-size:1rem;font-weight:600;font-stretch:100%;letter-spacing:0}
.bl-say{font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 2vw,2.8rem);font-weight:700;font-stretch:110%;line-height:1.08;letter-spacing:-.035em}
.bl-p{max-width:36rem;font-size:1.05rem;line-height:1.6;color:var(--muted)}
.bl-field{position:relative;height:min(64vh,34rem);min-height:18rem;overflow:hidden}
@media (max-width:55.99rem){.bl-field{height:38svh;min-height:15rem}.bl-say{font-size:1.35rem}}
.bl-stem{position:absolute;left:50%;bottom:8%;width:min(30%,9rem);height:auto;margin-left:max(-15%,-4.5rem);fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transform-origin:50% 96%;transform:rotate(var(--f))}
.bl-stem .ink{stroke:var(--ink)}
.bl-stem .head{stroke:var(--pop)}
.bl-ribbon{position:absolute;left:50%;bottom:3%;width:min(30%,9rem);margin-left:max(-15%,-4.5rem);fill:none;stroke:var(--neon);stroke-width:3;stroke-linecap:round}
.bl-ring{bottom:8%;stroke-width:2.6}
.bl-bunch{height:170vh;height:170svh}
.bl-stage{position:sticky;top:3.5rem;display:grid;align-items:center;min-height:calc(100vh - 3.5rem);min-height:calc(100svh - 3.5rem);padding-block:2rem}
@media (min-width:56rem){.bl-bunch{height:200vh;height:200svh}}
html.m .bl-bunch{--g:clamp(0,calc(var(--p,1) * 1.6),1)}
html.m .bl-stem{transform:translateX(calc(var(--x) * (1 - var(--g)))) rotate(calc(var(--f) + (var(--r) - var(--f)) * (1 - var(--g)) + var(--sw,0deg)))}
html.m .bl-ribbon path{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--p,1) - .62) * 4,1))}
/* steps, questions */
.bl-steps{display:grid;gap:0;border-top:1.5px solid var(--ink)}
@media (min-width:48rem){.bl-steps{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));column-gap:2rem}}
.bl-steps li{display:grid;gap:.4rem;padding:1.2rem 0;border-bottom:1px solid var(--line)}
.bl-steps h3{font-size:1.3rem}
.bl-steps p{color:var(--muted)}
.bl-two{display:grid;gap:2rem}
@media (min-width:56rem){.bl-two{grid-template-columns:1fr 1fr;gap:4rem;align-items:start}}
.bl-qa{border-top:1.5px solid var(--ink)}
.bl-qa div{display:grid;gap:.35rem;padding:1.1rem 0;border-bottom:1px solid var(--line)}
.bl-qa dt{font-weight:600}
.bl-qa dd{color:var(--muted)}
/* visit: the opening-hours poster */
.bl-visit{background:var(--acc);color:var(--on-acc);border-top:0;--ink:var(--on-acc);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--focus:var(--on-acc)}
.bl-visit-h{max-width:9em;font-size:clamp(2.4rem,1.2rem + 4.6vw,6rem);line-height:.92;text-transform:uppercase;font-weight:900;font-stretch:125%}
.bl-visit .bl-act{margin-top:2rem}
.bl-visit .btn-primary{background:var(--on-acc);color:var(--acc)}
.bl-visit .field input,.bl-visit .field select,.bl-visit .field textarea{background:transparent;color:var(--on-acc);border:1px solid color-mix(in srgb,var(--on-acc) 45%,var(--acc));border-radius:0}
.bl-visit .field input:focus,.bl-visit .field select:focus,.bl-visit .field textarea:focus{border-color:var(--on-acc)}
.bl-visit .field select option{color:#111;background:#fff}
.bl-visit .btn-primary:hover{background:color-mix(in srgb,var(--on-acc) 84%,var(--acc));color:var(--acc)}
.bl-visit .contact-list a{color:var(--on-acc)}
.bl-visit .i{color:var(--primary-on-dark)}
.reviews .review{border-radius:0;border:0;border-top:1.5px solid var(--ink);background:none;padding:1.25rem 0 0}
.bl-visit-in{display:grid;gap:2.5rem}
.bl-reach .contact-list{display:flex;flex-wrap:wrap;gap:.75rem 2.5rem;padding-top:1.25rem;border-top:1px solid var(--line)}
.bl-form{max-width:52rem;padding-top:2rem;border-top:1.5px solid var(--ink)}
@media (min-width:48rem){.bl-form .form{display:grid;grid-template-columns:1fr 1fr;column-gap:2rem}.bl-form .form>*{grid-column:1 / -1}.bl-form .form>.field:not(:has(textarea)){grid-column:auto}}
.bl-bunch-solo{height:150vh;height:150svh}
@media (min-width:56rem){.bl-bunch-solo{height:160vh;height:160svh}.bl-bunch-solo .bl-field{grid-column:1 / -1}}
.bl-bunch-solo .bl-story{position:absolute}
.bl-ftr{padding-block:clamp(3rem,2rem + 3vw,5rem) 6.5rem;border-top:1.5px solid var(--ink)}
@media (min-width:60rem){.bl-ftr{padding-bottom:3rem}}
.bl-ftr-in{display:grid;gap:2.5rem}
@media (min-width:56rem){.bl-ftr-in{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;align-items:start}.bl-ftr-in nav{grid-column:1 / span 5}.bl-label{grid-column:7 / span 6}.bl-ftr-c{grid-column:1 / -1}}
.bl-ftr-nav{display:grid;gap:.1rem}
.bl-ftr-nav a{display:inline-block;padding:.3rem 0;font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.4vw,2.4rem);font-weight:800;font-stretch:118%;letter-spacing:-.04em;line-height:1.05;text-decoration:none}
.bl-ftr-nav a:hover{color:var(--primary-text)}
.bl-ftr-social{margin-top:1.25rem}
.bl-label{border:1.5px solid var(--ink);outline:1px solid var(--ink);outline-offset:-6px;padding:.9rem 1.2rem}
.bl-label div{display:grid;grid-template-columns:6.5rem 1fr;gap:1rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
.bl-label div:last-child{border-bottom:0}
.bl-label dt{font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding-top:.15rem}
.bl-label a{color:var(--ink);text-decoration-color:var(--line)}
.bl-ftr-c{font-size:.85rem;color:var(--muted)}
.bl-ftr>.legal-links{width:min(100% - 2rem,var(--max));margin-inline:auto;text-align:left}
.bl-ftr>.mpause{margin-left:max(1rem,calc((100% - var(--max)) / 2))}
.mbar{border-top:1.5px solid var(--ink)}
.mbar .btn{border-radius:0}
`;

module.exports = {
  id,
  kind: 'studio',
  name: 'Bloom',
  bestFor: 'Florists, flower and plant studios, yoga and pilates studios, small design studios: a bold, editorial page',
  match: /\b(florists?|floral|flowers?|botanical|bouquets?|yoga|pilates|barre|design studio|creative studio|tattoo studio)\b/,
  why: 'Built like a botanical plate: one flower draws itself in a single line beside your name, your price list hangs like the shop card on its string, and loose stems gather into a tied bunch as you scroll.',
  fonts: { q: 'family=Archivo:wdth,wght@100..125,500..900&family=Host+Grotesk:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Host Grotesk', 'sans'] },
  // The motion, as data (lib/choreo.md): a flower drawn in one line, a plate that leans your way, a bunch the scroll gathers.
  choreo: { intro: 'draw', alive: ['drift'], scroll: 'scene', pace: 'medium', look: 'white newsprint, black ink, a flower drawn in one line' },
  modes: ['light', 'dark'],
  tokens,
  slots,
  nav,
  render,
  art,
};
