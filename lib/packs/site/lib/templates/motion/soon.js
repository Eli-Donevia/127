// Soon (animated, product, for a waitlist): a bedroom at night, one product not out yet.
//   Object:   the product's dial, drawn in hairline: a ring of ticks and one bright mark, the thing you reach for in the
//             dark. The name is set beside it, large, in a soft serif.
//   Material: night and a warm lamp: a deep blue-black room, soft serif type, fine grain, nothing glossy.
//   One move: the room comes into focus like eyes adjusting to the dark (the name and the dial develop), then the dial
//             turns down to its resting mark. At rest the dial drifts like slow breathing and leans toward the pointer.
//   Pop:      the member's colour is the dial's one mark in the hero, then the roadmap's line through what's coming,
//             ending at the email form.
// The launch date is set like a label; with a full date, the page counts the nights left (script only, its space
// reserved). The email form is in the first screen. Sections: hero, what's coming as a roadmap into the form, the
// member's story when they wrote one, questions. No light blobs, no typewriter, no monogram.
// Its motion is the `choreo` block at the bottom (lib/choreo.md).

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { motion } = require('../../motion');
const { FOOTER_CSS, esc } = require('../shared');
const { draftCopy } = require('../../copy');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'soon';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.22), '#05070c', 0.72) };
}

function slots() {
  return [];
}

function nav(c) {
  return [c.included.length >= 2 && { label: "What's coming", href: '#coming' }, c.faq.length && { label: 'Questions', href: '#faq' }].filter(Boolean);
}

// A full date (with a day) gives a count of nights; anything looser ("Spring 2027") is shown as written.
function launchDate(deadline) {
  const s = String(deadline || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d = null;
  if (iso) d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  else if (/\b\d{1,2}(st|nd|rd|th)?\b/.test(s.replace(/\b\d{4}\b/, '')) && /\b\d{4}\b/.test(s) && !Number.isNaN(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`))) d = new Date(Date.parse(`${s.replace(/(\d)(st|nd|rd|th)\b/, '$1')} UTC`));
  if (!d || Number.isNaN(d.getTime())) return { text: s, iso: '' };
  return { text: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`, iso: d.toISOString().slice(0, 10) };
}

// The dial: 48 ticks on a ring, every fourth one longer, and the one mark in the member's colour.
function dial() {
  const ticks = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    const r1 = long ? 84 : 88;
    const x1 = 100 + Math.sin(a) * r1;
    const y1 = 100 - Math.cos(a) * r1;
    const x2 = 100 + Math.sin(a) * 94;
    const y2 = 100 - Math.cos(a) * 94;
    ticks.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"${long ? ' class="lg"' : ''}/>`);
  }
  return `<div class="sn-dialbox" aria-hidden="true"><div class="sn-breath" data-alive="0.6"><div class="sn-dial" data-ci="subject"><svg viewBox="0 0 200 200">
<defs><radialGradient id="sn-knob-g" cx="38%" cy="30%" r="80%"><stop offset="0" class="s1"/><stop offset=".55" class="s2"/><stop offset="1" class="s3"/></radialGradient></defs>
<g class="sn-ticks">${ticks.join('')}</g>
<circle class="sn-face" cx="100" cy="100" r="70" fill="url(#sn-knob-g)"/>
<circle class="sn-rim" cx="100" cy="100" r="62"/>
<g class="sn-knob"><line class="sn-mark" x1="100" y1="44" x2="100" y2="62"/></g>
</svg></div></div></div>`;
}

function render(c) {
  const name = c.productName || c.name;
  const date = launchDate(c.deadline);
  const len = [...name].length;
  const sub = c.tagline ? `${c.tagline.replace(/[.!]+$/, '')}.` : c.heroSub;
  const what = c.whatShort && c.whatShort.toLowerCase() !== name.toLowerCase() ? c.whatShort : '';
  const own = c.aboutParas.length && c.about !== draftCopy({ ...c, about: '' }, 'product').about;
  const faqs = c.included.length >= 2 ? c.faq.filter((q) => !/^what's included\?$/i.test(q.q)) : c.faq;

  const form = P.form(c, { id: 'signup', fields: [{ ...P.FIELD_PRESETS.email, label: 'Your email' }], submit: c.buy ? 'Keep me posted' : 'Join the waitlist', subject: `Waitlist for ${name}`, cls: 'sn-f' });

  const hero = `<section class="sn-hero" aria-labelledby="hero-title">
<div class="sn-grain" aria-hidden="true"></div>
<div class="wrap sn-hero-in">
<div class="sn-head">
${what ? `<p class="sn-what" data-ci="then">${esc(what)}</p>` : ''}
<h1 id="hero-title" class="sn-name${len > 10 ? ' long' : ''}" data-ci="head">${esc(name)}</h1>
</div>
${dial()}
<div class="sn-ask" id="signup">
<p class="sn-sub" data-ci="then">${esc(sub)}</p>
<div class="sn-form" data-ci="then">${form}</div>
${date ? `<p class="sn-date" data-ci="then"><span>Launching</span> ${date.iso ? `<time datetime="${date.iso}">${esc(date.text)}</time>` : esc(date.text)}${date.iso ? `<span class="sn-nights" data-date="${date.iso}"></span>` : ''}</p>` : ''}
${c.buy ? `<p class="sn-buy" data-ci="then"><a href="${esc(c.buy.href)}">${esc(c.buy.label)}</a></p>` : ''}
</div>
</div>
</section>`;

  // What's coming: the member's own list, drawn as a line that ends at the email form.
  const coming = c.included.length >= 2
    ? roadmap({ id: 'coming', cls: 'sn-road', title: "What's coming.", nodes: c.included.map((x) => ({ title: x })), end: P.button({ label: c.buy ? 'Keep me posted' : 'Join the waitlist', href: '#signup' }, 'btn btn-primary'), endLabel: date ? date.text : name })
    : c.included.length
      ? `<section class="sn-sec" id="coming" aria-labelledby="coming-title"><div class="wrap"><h2 class="sn-h2" id="coming-title">${esc(c.included[0])}</h2></div></section>`
      : '';

  const about = own
    ? `<section class="sn-sec" aria-labelledby="about-title"><div class="wrap sn-about"><h2 class="sn-side" id="about-title">${esc(c.owner && c.owner !== c.name ? `From ${c.owner}` : `About ${c.name}`)}</h2><div>${c.aboutParas.map((p, i) => `<p class="${i ? 'sn-p' : 'sn-say'}">${esc(p)}</p>`).join('')}</div></div></section>`
    : '';

  const faq = faqs.length
    ? `<section class="sn-sec" id="faq" aria-labelledby="faq-title"><div class="wrap sn-faq"><h2 class="sn-h2" id="faq-title">Questions</h2>${P.faq(faqs)}</div></section>`
    : '';

  const m = motion();
  const body = [P.header(c, { cls: 'sn-hdr', mark: false, ctaCls: 'btn btn-primary btn-sm' }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, coming, about, faq, '</main>', P.footer(c), P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, bodyClass: 'has-bar', base: { radius: '4px', radiusSm: '4px', btnRadius: '4px', max: '82rem' } };
}

// The nights left (only for a full date; its space is reserved, so nothing moves), and the phone bar that waits until
// the form has scrolled away. Both run with reduced motion too: they are information, not motion.
const JS = `(function(){var d=document;
[].slice.call(d.querySelectorAll('.sn-nights')).forEach(function(el){var t=Date.parse(el.getAttribute('data-date')+'T00:00:00');var n=Math.ceil((t-Date.now())/864e5);if(n>1)el.textContent=n+' nights to go';else if(n===1)el.textContent='Tomorrow night'});
var bar=d.querySelector('.mbar'),ask=d.getElementById('signup');if(bar&&ask){bar.classList.add('wait');new IntersectionObserver(function(es){bar.classList.toggle('wait',es[0].isIntersecting||es[0].boundingClientRect.top>0)}).observe(ask)}
})();`;

const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const CSS = `
${FOOTER_CSS}${ROADMAP_CSS}
body{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--surface:color-mix(in srgb,var(--on-dark) 5%,var(--dark));--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 50%,var(--dark));--focus:var(--primary-on-dark);--edge:color-mix(in srgb,var(--on-dark) 14%,transparent);--soft:color-mix(in srgb,var(--on-dark) 86%,var(--dark));--ease:cubic-bezier(.16,1,.3,1)}
h1,h2,h3{font-weight:400;letter-spacing:-.02em}
.btn{font-weight:500}
.btn-primary,.mbar .btn-primary,.form .btn-primary{background:var(--on-dark);color:var(--dark);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--on-dark) 86%,var(--primary-on-dark))}
.btn-sm{min-height:2.4rem;padding:.45rem 1rem;font-size:.9rem}
.hdr{position:absolute;left:0;right:0;top:0;z-index:30}
.hdr-in{display:flex;align-items:center;gap:2rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.4rem;letter-spacing:-.02em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{font-size:.92rem;color:var(--soft);text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 1px no-repeat;padding-block:.3rem;transition:background-size .4s var(--ease)}
.nav a:hover{background-size:100% 1px}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.menu>summary{border-radius:4px;border-color:var(--edge);background:transparent;color:var(--on-dark)}
.menu-panel{background:var(--dark);border-color:var(--edge);border-radius:4px}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the room at night */
.sn-hero{position:relative;isolation:isolate;overflow:hidden;min-height:100vh;min-height:100svh;display:grid;align-items:end;padding-block:6.5rem clamp(2rem,1.5rem + 2vw,3.5rem)}
.sn-grain{position:absolute;inset:0;z-index:-1;background-image:url("${GRAIN}");opacity:.07;pointer-events:none}
.sn-hero-in{display:grid;gap:2rem}
@media (min-width:60rem){.sn-hero-in{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto auto;gap:2.5rem 1.5rem;align-items:end}.sn-head{grid-column:1/9;grid-row:1}.sn-dialbox{grid-column:9/13;grid-row:1;align-self:center}.sn-ask{grid-column:1/13;grid-row:2}}
.sn-what{font-size:1rem;color:var(--soft)}
.sn-name{margin-top:.6rem;margin-left:-.05em;font-size:clamp(4.4rem,1rem + 15vw,16rem);line-height:.84;letter-spacing:-.045em;padding-bottom:.08em}
.sn-name.long{font-size:clamp(3.4rem,1rem + 9vw,10rem);line-height:.9}
.sn-ask{display:grid;gap:1.2rem 2.5rem;padding-top:1.6rem;border-top:1px solid var(--edge)}
@media (min-width:60rem){.sn-ask{grid-template-columns:4fr 5fr 3fr;align-items:start}}
.sn-sub{max-width:24rem;font-family:var(--font-display);font-size:clamp(1.35rem,1.1rem + .8vw,1.8rem);line-height:1.2;letter-spacing:-.01em}
.sn-f{gap:.6rem}
.sn-f .field label{font-weight:500;font-size:.9rem;color:var(--soft)}
.field input{border-radius:4px;border-color:var(--edge);background:color-mix(in srgb,var(--on-dark) 5%,var(--dark));color:var(--on-dark)}
.form-note{color:var(--muted);font-size:.875rem}
.form-note a{color:var(--on-dark)}
.sn-date{display:grid;gap:.2rem;font-variant-numeric:tabular-nums}
.sn-date span:first-child{font-size:.9rem;color:var(--muted)}
.sn-date time{font-family:var(--font-display);font-size:clamp(1.6rem,1.3rem + .8vw,2.1rem);line-height:1.1;letter-spacing:-.01em}
.sn-nights{display:block;min-height:1.6em;font-size:.95rem;color:var(--soft)}
.sn-buy a{color:var(--on-dark);font-weight:500}
/* the dial */
.sn-dialbox{width:min(100%,28rem);justify-self:end}
@media (min-width:60rem){.sn-head{position:relative;z-index:1}.sn-hero-in .sn-dialbox{grid-column:8/13}}
@media (max-width:59.99rem){.sn-dialbox{order:-1;width:min(52vw,18rem);margin-bottom:-1rem}}
.sn-dial svg{display:block;width:100%;height:auto;overflow:visible}
.sn-ticks line{stroke:color-mix(in srgb,var(--on-dark) 32%,transparent);stroke-width:.7}
.sn-ticks line.lg{stroke:color-mix(in srgb,var(--on-dark) 70%,transparent);stroke-width:1}
.sn-face{stroke:color-mix(in srgb,var(--on-dark) 22%,transparent);stroke-width:.6}
.sn-dial .s1{stop-color:color-mix(in srgb,var(--on-dark) 16%,var(--dark))}.sn-dial .s2{stop-color:color-mix(in srgb,var(--on-dark) 6%,var(--dark))}.sn-dial .s3{stop-color:color-mix(in srgb,#000 30%,var(--dark))}
.sn-dial{filter:drop-shadow(0 18px 22px rgba(0,0,0,.45))}
.sn-rim{fill:none;stroke:color-mix(in srgb,var(--on-dark) 12%,transparent);stroke-width:.6}
.sn-mark{stroke:var(--pop);stroke-width:3.2;stroke-linecap:round}
.sn-knob{transform-origin:100px 100px;transform:rotate(-38deg)}
html.m .sn-knob{transform:rotate(150deg)}
html.m.ci-go .sn-knob{transform:rotate(-38deg);transition:transform 2.2s cubic-bezier(.45,0,.2,1) .5s}
html.m:not(.ci-go) .sn-knob{animation:snKnob 0s 2.8s forwards}
@keyframes snKnob{to{transform:rotate(-38deg)}}
/* what's coming: the roadmap */
.sn-road{--rm-line:var(--edge);--rm-dot-bg:var(--dark);border-top:1px solid var(--edge)}
.sn-road .h2,.sn-h2{font-family:var(--font-display);font-size:clamp(2.8rem,1.6rem + 4.4vw,6rem);line-height:.92;letter-spacing:-.035em;font-weight:400}
.sn-road .rm-txt h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.35rem,1.1rem + .7vw,1.75rem);line-height:1.15}
.sn-road .rm-dot{font-family:var(--font-body);font-weight:500}
.sn-road .rm-meta{color:var(--soft);font-weight:500}
.sn-sec{padding-block:clamp(4.5rem,3rem + 5vw,8rem);border-top:1px solid var(--edge)}
.sn-about{display:grid;gap:1.5rem}
@media (min-width:60rem){.sn-about{grid-template-columns:3fr 9fr}}
.sn-side{font-family:var(--font-body);font-size:.95rem;font-weight:500;letter-spacing:0;color:var(--muted)}
.sn-say{font-family:var(--font-display);font-size:clamp(1.7rem,1.2rem + 2vw,3rem);line-height:1.14;max-width:26ch}
.sn-p{margin-top:1.2rem;font-size:1.15rem;line-height:1.6;color:var(--soft);max-width:40rem}
.sn-faq{display:grid;gap:2rem}
@media (min-width:60rem){.sn-faq{grid-template-columns:.7fr 1.3fr;gap:4rem;align-items:start}}
.faq{gap:0;border-top:1px solid var(--edge)}
.faq details{border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent}
.faq details[open]{border-color:var(--edge)}
.faq summary{padding:1.25rem 0;font-family:var(--font-display);font-weight:400;font-size:1.35rem}
.faq summary .i{color:var(--on-dark)}
.faq .ans{padding:0 0 1.25rem}
.ftr{border-top:1px solid var(--edge)}
.mbar{background:var(--dark);border-top-color:var(--edge);box-shadow:none;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.mbar.wait{transform:translateY(120%)}
.mpause{border-radius:4px}
`;

module.exports = {
  id,
  kind: 'product',
  name: 'Soon',
  bestFor: 'A product that is not out yet: a waitlist page with one email form and the launch date',
  match: /\b(coming soon|waitlist|wait list|pre-?orders?|launching soon|not out yet)\b/,
  why: 'Built for a waitlist: a night room that comes into focus, your product name large beside a drawn dial that turns down to rest, the email form in the first screen, the launch date and the nights left, and what is coming as a line into the form.',
  fonts: { q: 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600', display: ['Fraunces', 'serif'], body: ['DM Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): eyes adjusting to the dark, a dial that breathes, what's coming drawn in.
  choreo: { intro: 'develop', alive: ['drift', 'pointer'], scroll: 'roadmap', pace: 'calm', look: 'a bedroom at night, soft and slow' },
  tokens,
  slots,
  nav,
  render,
};
