// Orbit (animated, product, for software and digital products): the product itself, drawn in type and line.
//   Object:   the month a content planner fills, a calendar page set in type and hairline (no browser window, no bars).
//   Material: planner paper and graphite: warm paper, near-black ink, 1px rules, square corners, no glow.
//   One move: the page opens from its centre while the headline unfolds word by word, then the planned days tick
//             themselves off one after another, a month planned in one sitting.
//   Pop:      the member's colour is the pen: the ticks on the planned days in the hero, the current page numeral in
//             the pinned index, the roadmap line through the plans. Buttons are ink, never a coloured fill.
// Sections: hero (headline left, calendar sheet bleeding off the right edge), what's inside as a pinned index of pages
// (the scroll moment; unpinned on phones), the plans as a roadmap that draws itself into the Buy button, questions as
// hairline rows, and a closing line with the product's name set large and cropped by the edge.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { cheapest, FOOTER_CSS, REVIEWS_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'orbit';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f3efe6', 0.75), dark: color.mix(p.ink, '#0d0c0a', 0.6) };
}

// The product is drawn, not photographed: no image slots.
function slots() {
  return [];
}

function plans(c) {
  return c.services.filter((s) => s.name);
}

function nav(c) {
  return [
    c.included.length && { label: 'Inside', href: '#features' },
    plans(c).length && { label: 'Plans', href: '#pricing' },
    c.faq.length && { label: 'Questions', href: '#faq' },
  ].filter(Boolean);
}

// The generated "About" for a product ("X makes Y. Questions? Write to Z.") repeats the header; only the member's own
// words make an about section.
function ownAbout(c) {
  const paras = c.aboutParas || [];
  if (!paras.length) return [];
  const gen = new RegExp(`^${String(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} makes `, 'i');
  if (paras.length === 1 && gen.test(paras[0])) return [];
  if (/^Questions\? Write to /.test(paras[0])) return [];
  return c.about === draftCopy({ ...c, about: '' }, 'product').about ? [] : paras;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// The month on the sheet: it starts on a Wednesday; the planned days are a steady rhythm across the weeks.
const START = 2;
const PLANNED = [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27];
const TICK = '<svg class="ob-tick" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M4.5 12.8 9.4 17.6 19.6 6.4"/></svg>';

function sheet(c, name) {
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const day = i - START + 1;
    if (day < 1 || day > 30) {
      cells.push('<span class="ob-day off"></span>');
      continue;
    }
    const k = PLANNED.indexOf(day);
    cells.push(`<span class="ob-day${k > -1 ? ' on' : ''}"${k > -1 ? ` style="--k:${k}"` : ''}><b>${day}</b>${k > -1 ? `<span class="ob-slip">${TICK}<i>Post</i></span>` : ''}</span>`);
  }
  const cal = c.included.find((x) => /calendar/i.test(x)) ? 'Content calendar' : '';
  return `<div class="ob-desk" aria-hidden="true"><div class="ob-float" data-alive="0.5"><div class="ob-sheet" data-ci="subject">
<div class="ob-sh-top"><span>${esc(name)}</span>${cal ? `<span>${cal}</span>` : ''}</div>
<div class="ob-wk">${DAYS.map((d) => `<span>${d}</span>`).join('')}</div>
<div class="ob-cells">${cells.join('')}</div>
</div></div></div>`;
}

function render(c) {
  const name = c.productName || c.name;
  const low = cheapest(c);
  const list = plans(c);
  const waitlist = c.primary.kind === 'form';
  const sub = String(c.heroSub || '').trim();
  const useSub = sub && sub.length <= 64 && sub.replace(/[.!\s]+$/, '').toLowerCase() !== String(c.heroTitle).replace(/[.!\s]+$/, '').toLowerCase();
  const title = useSub ? sub : c.heroTitle;
  const same = (a, b) => String(a || '').replace(/[.!\s]+$/, '').toLowerCase() === String(b || '').replace(/[.!\s]+$/, '').toLowerCase();
  const lead = c.audience ? `For ${c.audience.charAt(0).toLowerCase()}${c.audience.slice(1).replace(/[.]+$/, '')}.` : useSub || same(sub, title) ? '' : sub;
  const from = low ? `${list.filter((s) => s.priceText).length > 1 ? 'Plans from ' : ''}${low.priceText.replace(/^From /, '')}` : c.priceText;
  const cta = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace(/<\/a>$/, `${icon('arrow', { size: 18 })}</a>`);

  const hero = `<section class="ob-hero" aria-labelledby="hero-title">
<div class="wrap ob-hero-in">
<div class="ob-copy">
<p class="ob-label" data-ci="then"><span>${esc(name)}</span>${c.whatShort && c.whatShort !== name && !same(c.whatShort, title) ? `<span>${esc(c.whatShort)}</span>` : ''}</p>
<h1 id="hero-title" data-ci="head" class="ob-title${title.length > 40 ? ' long' : ''}">${esc(title)}</h1>
</div>
${sheet(c, name)}
<div class="ob-copy2">
${lead ? `<p class="ob-lead" data-ci="then">${esc(lead)}</p>` : ''}
<div class="ob-ctas" data-ci="then">${cta()}${c.secondary ? P.button(c.secondary, 'ob-link') : ''}</div>
${from ? `<p class="ob-from" data-ci="then">${esc(from)}</p>` : ''}
</div>
</div>
</section>`;

  const n = c.included.length;
  const features = n
    ? `<section class="ob-inside" id="features" aria-labelledby="features-title" data-sc>
<div class="ob-stage" data-sc-stage>
<div class="wrap ob-inside-in">
<div class="ob-inside-head">
<h2 class="ob-h2" id="features-title">Inside ${esc(name)}.</h2>
<p class="ob-of" aria-hidden="true">${String(n).padStart(2, '0')} ${n === 1 ? 'page' : 'pages'}</p>
</div>
<ol class="ob-pages">
${c.included.map((x, i) => `<li class="ob-page" data-sc-part><span class="ob-pn" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ob-big" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><p>${esc(x)}</p></li>`).join('\n')}
</ol>
</div>
</div>
</section>`
    : '';

  // The plans, as the member listed them, drawn as a line that ends at the Buy button.
  const ladder = list.length >= 2
    ? roadmap({ id: 'pricing', cls: 'ob-plans', title: `${list.map((s) => s.name).join(', ').replace(/, ([^,]*)$/, list.length > 2 ? ', $1' : ' and $1')}.`, nodes: list.map((s) => ({ title: s.name, meta: s.priceText || '', sub: s.blurb || s.duration || '' })), end: cta('btn btn-primary'), endLabel: name })
    : '';
  const one = list.length === 1 || (!list.length && c.priceText) ? list[0] || { name, priceText: c.priceText, blurb: '' } : null;
  const single = one
    ? `<section class="ob-sec ob-one" id="pricing" aria-labelledby="pricing-title"><div class="wrap ob-one-in">
<h2 class="ob-h2" id="pricing-title">${esc(one.name)}</h2>
${one.priceText ? `<p class="ob-one-p">${esc(one.priceText)}</p>` : ''}
${one.blurb ? `<p class="ob-body">${esc(one.blurb)}</p>` : ''}
<div>${cta()}</div>
</div></section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="ob-sec" aria-labelledby="reviews-title"><div class="wrap"><h2 class="ob-h2" id="reviews-title">What people say</h2><div class="ob-rv">${P.reviews(c)}</div></div></section>`
    : '';

  const paras = ownAbout(c);
  const about = paras.length
    ? `<section class="ob-sec ob-about" id="about" aria-labelledby="about-title"><div class="wrap ob-about-in"><h2 class="ob-side" id="about-title">About ${esc(c.name)}</h2><div>${paras.map((p, i) => `<p class="${i ? 'ob-body' : 'ob-say'}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="ob-sec ob-faq" id="faq" aria-labelledby="faq-title"><div class="wrap ob-faq-in"><div><h2 class="ob-h2" id="faq-title">Questions.</h2>${c.email ? `<p class="ob-body">Something else? <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}</div>${P.faq(c.faq)}</div></section>`
    : '';

  const prices = list.filter((s) => s.priceText).map((s) => `${s.name} ${s.priceText}`);
  const end = `<section class="ob-end" id="${waitlist ? 'signup' : 'start'}" aria-labelledby="end-title">
<div class="wrap ob-end-in">
<h2 class="ob-h2" id="end-title">${esc(waitlist ? c.ctaTitle : `Get ${name}.`)}</h2>
${waitlist
  ? `${c.ctaSub ? `<p class="ob-body">${esc(c.ctaSub)}</p>` : ''}<div class="ob-form">${P.form(c, { id: 'signup', fields: [P.FIELD_PRESETS.email], submit: 'Join the waitlist', subject: `Waitlist for ${name}` })}</div>`
  : `${prices.length ? `<p class="ob-prices">${prices.map((x) => `<span>${esc(x)}</span>`).join('')}</p>` : ''}<div class="ob-ctas">${cta()}${c.email ? `<a class="ob-link" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</div>`}
</div>
<p class="ob-word" aria-hidden="true" style="--len:${Math.max(4, [...name].length)}">${esc(name)}</p>
</section>`;

  const m = motion();
  const body = [P.header(c, { cls: 'ob-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, features, ladder || single, reviews, about, faq, end, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '3px', max: '78rem' } };
}

const CSS = `
${FOOTER_CSS}${REVIEWS_CSS}${ROADMAP_CSS}
body{--rule:color-mix(in srgb,var(--ink) 16%,transparent);--sheet:color-mix(in srgb,var(--bg) 55%,#fff);--ease:cubic-bezier(.16,1,.3,1);font-size:1.0625rem;line-height:1.55}
h1,h2,h3{font-weight:600;letter-spacing:-.035em}
.btn{border-radius:var(--radius-btn);font-weight:500;letter-spacing:-.01em}
.btn-primary,.mbar .btn-primary{background:var(--ink);color:var(--bg);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--ink) 86%,var(--bg))}
.btn-primary:hover .i{transform:translateX(3px)}
.btn .i{transition:transform .35s var(--ease)}
.btn-sm{min-height:2.5rem;padding:.45rem 1rem;font-size:.9rem}
.ob-link{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:500;text-decoration:underline;text-decoration-color:var(--rule);text-underline-offset:.3em;transition:text-decoration-color .25s ease}
.ob-link:hover{text-decoration-color:var(--pop)}
/* header: a wordmark, quiet links */
.hdr{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 92%,transparent);border-bottom:1px solid transparent;transition:border-color .3s ease}
.hdr.scrolled{border-bottom-color:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:4rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.2rem;font-weight:600;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.95rem;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;padding-block:.3rem;transition:background-size .35s var(--ease)}
.nav a:hover{background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.menu>summary{border-radius:3px;border-color:var(--rule);background:transparent}
.menu-panel{border-radius:0;box-shadow:none;border-color:var(--rule)}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
.ob-h2{font-size:clamp(2.3rem,1.4rem + 3.6vw,4.6rem);line-height:.98;letter-spacing:-.045em}
.ob-body{max-width:34rem;margin-top:1rem;color:var(--muted)}
.ob-body a{color:var(--ink)}
.ob-sec{padding-block:clamp(4.5rem,3rem + 6vw,9rem)}
/* hero */
.ob-hero{overflow:hidden;border-bottom:1px solid var(--rule)}
.ob-hero-in{display:grid;gap:3rem;padding-block:clamp(2.5rem,1.5rem + 4vw,5.5rem) clamp(3rem,2rem + 4vw,6rem)}
@media (min-width:64rem){.ob-hero-in{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto auto;gap:0 1.5rem;align-content:center;min-height:calc(100vh - 4rem);min-height:calc(100svh - 4rem)}.ob-copy{grid-column:1/6;grid-row:1;align-self:end;position:relative;z-index:1}.ob-copy2{grid-column:1/6;grid-row:2;align-self:start}.ob-desk{grid-column:6/13;grid-row:1/3;margin-right:calc((100vw - min(100vw - 4rem,var(--max))) / -2 - 4rem)}}
@media (max-width:63.99rem){.ob-hero-in{gap:2.2rem}.ob-copy2 .ob-lead{margin-top:0}}
.ob-label{display:flex;flex-wrap:wrap;gap:.3rem .9rem;font-size:.92rem;color:var(--muted)}
.ob-label span:first-child{color:var(--ink);font-weight:500}
.ob-label span+span{padding-left:.9rem;border-left:1px solid var(--rule)}
@media (max-width:39.99rem){.ob-label{flex-direction:column}.ob-label span+span{padding-left:0;border-left:0}}
.ob-title{margin-top:1.4rem;max-width:12ch;font-size:clamp(2.9rem,1rem + 5.4vw,6.4rem);line-height:.94;letter-spacing:-.05em;padding-bottom:.05em}
.ob-title.long{max-width:15ch;font-size:clamp(2.5rem,1rem + 4.2vw,5.2rem)}
.ob-hero .ci-pop{background-image:linear-gradient(var(--ink),var(--ink))}
.ob-lead{max-width:30rem;margin-top:1.6rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted)}
.ob-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.6rem;margin-top:2.2rem}
.ob-from{margin-top:1.2rem;font-size:.95rem;color:var(--muted);font-variant-numeric:tabular-nums}
/* the sheet */
.ob-desk{transform:rotate(-2deg);transform-origin:20% 50%}
.ob-sheet{padding:clamp(1rem,.7rem + 1.2vw,2rem);background:var(--sheet);border:1px solid var(--rule);box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 10%,transparent),0 40px 60px -48px color-mix(in srgb,var(--ink) 55%,transparent)}
.ob-sh-top{display:flex;align-items:baseline;gap:1.2rem;padding-bottom:.9rem;font-family:var(--font-display);font-size:clamp(.95rem,.85rem + .4vw,1.2rem);letter-spacing:-.03em}
.ob-sh-top span+span{font-family:var(--font-body);font-size:.85rem;letter-spacing:0;color:var(--muted)}
.ob-wk,.ob-cells{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.ob-wk span{padding:.5rem .45rem;font-size:.72rem;color:var(--muted);border-top:1px solid var(--ink)}
.ob-cells{border-top:1px solid var(--rule);border-left:1px solid var(--rule)}
.ob-day{position:relative;min-height:clamp(3.3rem,2rem + 3.6vw,6.4rem);padding:.4rem .45rem;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.ob-day b{font-family:var(--font-display);font-weight:600;font-size:clamp(.85rem,.75rem + .35vw,1.1rem);letter-spacing:-.02em;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-day.on b{color:var(--ink)}
.ob-day.off{background:color-mix(in srgb,var(--ink) 4%,transparent)}
.ob-slip{position:absolute;left:8%;right:8%;bottom:10%;display:flex;align-items:center;gap:.3rem;height:clamp(1.15rem,.8rem + 1vw,1.9rem);padding-inline:.25rem;background:color-mix(in srgb,var(--sheet) 40%,#fff);border:1px solid var(--rule);border-left:2px solid var(--pop);box-shadow:0 5px 8px -6px color-mix(in srgb,var(--ink) 60%,transparent)}
.ob-slip i{font-style:normal;font-size:.72rem;color:var(--ink);overflow:hidden}
@media (max-width:89.99rem){.ob-slip i{display:none}}
.ob-tick{flex:none;width:clamp(.8rem,.6rem + .5vw,1.15rem);height:clamp(.8rem,.6rem + .5vw,1.15rem);fill:none;stroke:var(--pop);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
html.m .ob-slip{opacity:0;transform:translate3d(0,-1.4rem,0) rotate(-6deg) scale(1.08)}
html.m .ob-tick path{stroke-dasharray:1;stroke-dashoffset:1}
html.m.ci-go .ob-slip{opacity:1;transform:none;transition:opacity .2s ease calc(1s + var(--k,0) * 95ms),transform .7s cubic-bezier(.16,1,.3,1) calc(1s + var(--k,0) * 95ms)}
html.m.ci-go .ob-tick path{stroke-dashoffset:0;transition:stroke-dashoffset .35s cubic-bezier(.65,0,.35,1) calc(1.3s + var(--k,0) * 95ms)}
html.m:not(.ci-go) .ob-slip,html.m:not(.ci-go) .ob-tick path{animation:obSlip 0s 2.8s forwards}
@keyframes obSlip{to{opacity:1;transform:none;stroke-dashoffset:0}}
@media (max-width:63.99rem){.ob-desk{margin-inline:-.5rem;transform:rotate(-1.2deg)}}
/* inside: a pinned index of pages */
.ob-inside{border-bottom:1px solid var(--rule)}
.ob-stage{padding-block:clamp(4.5rem,3rem + 6vw,8rem)}
.ob-inside-in{display:grid;gap:2.5rem}
.ob-of{margin-top:1rem;font-size:.95rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-pages{counter-reset:pg;border-top:1px solid var(--ink)}
.ob-page{position:static;display:grid;grid-template-columns:3rem minmax(0,1fr);gap:1rem;padding-block:1.1rem;border-bottom:1px solid var(--rule)}
.ob-pn{padding-top:.35rem;font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-page p{font-family:var(--font-display);font-size:clamp(1.3rem,1rem + 1.3vw,2.25rem);line-height:1.12;letter-spacing:-.035em;max-width:24ch;transition:color .4s ease}
.ob-big{display:none}
html.m .ob-page p{color:var(--muted)}
html.m .ob-page.on p{color:var(--ink)}
@media (min-width:64rem){.ob-inside-in{grid-template-columns:repeat(12,minmax(0,1fr));gap:1.5rem}.ob-inside-head{grid-column:1/6;position:relative}.ob-pages{grid-column:6/13}}
@media (min-width:48rem) and (hover:hover){
html.m .ob-inside[data-sc]{height:calc(100vh + var(--n,3) * 42vh)!important;height:calc(100svh + var(--n,3) * 42svh)!important}
html.m .ob-stage{position:sticky;top:0;min-height:100vh;min-height:100svh;display:grid;align-items:center;padding-block:5rem 3rem}
html.m .ob-inside-in{position:relative;min-height:min(34rem,70vh)}
html.m .ob-page.on p{color:var(--muted)}
html.m .ob-page.cur p{color:var(--ink)}
html.m .ob-page.cur .ob-pn{color:var(--pop)}
}
@media (min-width:64rem) and (hover:hover){
html.m .ob-big{display:block;position:absolute;left:0;bottom:0;font-family:var(--font-display);font-size:clamp(9rem,4rem + 12vw,17rem);line-height:.8;letter-spacing:-.07em;color:var(--pop);font-variant-numeric:tabular-nums;opacity:0;transform:translateY(.15em);transition:opacity .35s ease,transform .6s var(--ease)}
html.m .ob-page.cur .ob-big{opacity:1;transform:none}
html.m .ob-page.cur .ob-pn{color:var(--muted)}
}
/* plans: the roadmap */
.ob-plans{border-bottom:1px solid var(--rule)}
.ob-plans .rm-sec,.ob-plans{--rm-line:var(--rule);--rm-dot-bg:var(--bg);--rm-accent:var(--pop)}
.ob-plans .h2{font-size:clamp(2.3rem,1.4rem + 3.6vw,4.6rem);line-height:.98;letter-spacing:-.045em}
.ob-plans .rm-dot{border-radius:2px;border-width:1.5px;font-weight:500}
.ob-plans .rm-txt h3{font-size:clamp(1.5rem,1.2rem + 1vw,2.2rem);letter-spacing:-.04em}
.ob-plans .rm-meta{font-family:var(--font-display);font-size:1.25rem;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.ob-plans .rm-sub{max-width:17rem}
.ob-one-in{display:grid;gap:1rem;justify-items:start}
.ob-one-p{font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,3.6rem);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.ob-one{border-bottom:1px solid var(--rule)}
/* about */
.ob-about-in{display:grid;gap:1.5rem}
@media (min-width:64rem){.ob-about-in{grid-template-columns:repeat(12,minmax(0,1fr))}.ob-about-in>.ob-side{grid-column:1/4}.ob-about-in>div{grid-column:4/12}}
.ob-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.ob-say{font-family:var(--font-display);font-size:clamp(1.6rem,1.1rem + 1.8vw,2.8rem);line-height:1.12;letter-spacing:-.04em;max-width:26ch}
.ob-rv{margin-top:2.5rem}
.review{border-radius:0;background:transparent;border:0;border-top:1px solid var(--ink);padding:1.4rem 0 0}
/* questions */
.ob-faq{border-bottom:1px solid var(--rule)}
.ob-faq-in{display:grid;gap:2.5rem}
@media (min-width:64rem){.ob-faq-in{grid-template-columns:5fr 7fr;gap:1.5rem}}
.faq{gap:0;border-top:1px solid var(--ink)}
.faq details{border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent}
.faq details[open]{border-color:var(--rule)}
.faq summary{padding:1.2rem 0;font-family:var(--font-display);font-weight:600;font-size:1.2rem;letter-spacing:-.03em}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.3rem}
/* end */
.ob-end{overflow:hidden;padding-top:clamp(4.5rem,3rem + 6vw,9rem)}
.ob-end-in{display:grid;gap:1.4rem;justify-items:start}
.ob-prices{display:flex;flex-wrap:wrap;gap:.3rem 1.4rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ob-prices span+span{padding-left:1.4rem;border-left:1px solid var(--rule)}
.ob-end .ob-ctas{margin-top:.6rem}
.ob-form{width:min(100%,30rem)}
.ob-word{margin-top:clamp(3rem,2rem + 4vw,6rem);margin-left:-.06em;font-family:var(--font-display);font-weight:600;font-size:min(22rem,calc(94vw / (var(--len,10) * .7)));line-height:.78;letter-spacing:-.07em;white-space:nowrap;color:var(--ink);transform:translateY(.12em)}
.field input{border-radius:3px;border-color:var(--rule);background:var(--sheet)}
.ftr{border-top:1px solid var(--ink)}
.mbar{background:var(--bg);border-top-color:var(--rule);box-shadow:none}
.mbar .btn{border-radius:3px}
.mpause{border-radius:3px}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Orbit',
  bestFor: 'Software, apps, templates and other digital products sold online, with plans',
  match: /\b(software|apps?|saas|platform|plugin|extension|templates?|digital products?|courses?|ebooks?|presets|notion|api)\b/,
  why: 'Built for software and digital products: the product drawn as a planner page whose days tick themselves off, what is inside as a pinned index of pages, and the plans as a line that ends at the Buy button.',
  fonts: { q: 'family=Syne:wght@600;700;800&family=Inter:wght@400;500;600', display: ['Syne', 'grotesk'], body: ['Inter', 'sans'] },
  // The motion, as data (lib/choreo.md): the page opens and the month fills, a sheet you can nudge, an index that pins.
  choreo: { intro: 'unfold', alive: ['pointer', 'tap'], scroll: 'pin', pace: 'medium', look: 'planner paper and graphite, precise, unhurried' },
  tokens,
  slots,
  nav,
  render,
};
