// Linkstack (animated, creator): a link in bio page that reads like a person's own index, not a column of buttons.
//   Object: the index. The creator's name set large like the title of a book, then every link as a numbered line with
//   where it goes, the way a contents page lists chapters.
//   Material: night glass: a near-black page, white serif and quiet sans, hairline rules, square corners, no cards.
//   One move: develop. The name comes into focus word by word and the index develops under it, then the lines settle.
//   Pop: the member's colour as the line drawn under the name's last word, the first link's lit rule and the roadmap.
// Phones get one column; wide screens a spread, the name held on the left while the index scrolls on the right. Then
// a brand inquiry form that opens in place, the rates as a roadmap down a rail ending at that form, a short about,
// kind words and questions. The name leans toward the pointer and springs when tapped. No monogram, no gradient, no
// halo, no loops. JavaScript off and reduced motion: the complete, still page. Its motion is the `choreo` block.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon, SOCIAL_LABEL } = require('../../icons');
const { motion } = require('../../motion');
const { esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');

const id = 'linkstack';

function tokens(p) {
  return { dark: color.mix(color.mix(p.ink, p.primary, 0.12), '#07090a', 0.7) };
}

// No photos: the name is the picture.
function slots() {
  return [];
}

function nav() {
  return [];
}

function where(l) {
  const h = String(l.href || '');
  if (/^mailto:/.test(h)) return 'Email';
  if (/^tel:/.test(h)) return 'Phone';
  return h.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];
}

function render(c) {
  const name = String(c.name || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  const longest = Math.max(...words.map((w) => w.length), 3);
  // One word a line, sized from the longest word (DM Serif Display: about 0.5em a letter), so nothing reflows when the
  // font arrives.
  const fs = Math.min(0.6, 1.9 / longest).toFixed(3);
  const fsm = Math.min(30, 160 / longest).toFixed(2);
  const person = c.owner && c.owner !== c.name ? c.owner : words[0] || name;

  const links = c.links.slice();
  if (!links.length && c.email) links.push({ label: 'Email me', href: `mailto:${c.email}`, kind: 'link' });
  const socials = Object.entries(c.socials || {});

  const profile = `<header class="pf">
<p class="hd" data-ci="then">${esc(c.handle || c.whatShort || '')}</p>
<div class="nm-wrap" data-alive="0.5"><h1 class="nm" id="hero-title" data-ci="head" style="--fs:${fs};--fsm:${fsm}vw">${words.map((w) => `<span class="nw">${esc(w)}</span>`).join(' ')}</h1></div>
${c.heroSub ? `<p class="bio" data-ci="then">${esc(c.heroSub)}</p>` : ''}
${socials.length ? `<ul class="soc" data-ci="then">${socials.map(([k, href]) => `<li><a href="${esc(href)}">${esc(SOCIAL_LABEL[k] || k)}<span class="sr-only"> (${esc(c.name)})</span></a></li>`).join('')}</ul>` : ''}
</header>`;

  const stack = links.length
    ? `<nav class="idx" aria-label="Links" data-ci="subject"><ol>
${links.map((l, i) => `<li><a class="ln${i === 0 ? ' ln-1' : ''}" data-mag href="${esc(l.href)}"><span class="ln-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="ln-t">${esc(l.label)}</span><span class="ln-w">${esc(where(l))}</span>${icon('arrowUpRight', { size: 20 })}</a></li>`).join('\n')}
</ol></nav>`
    : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Brand', half: false },
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the campaign', required: true },
  ];
  const inquiry = `<details class="inq" id="contact">
<summary><span class="ln-n" aria-hidden="true">${String(links.length + 1).padStart(2, '0')}</span><span class="ln-t">Brand inquiries</span><span class="ln-w">Send a message</span><span class="inq-x" aria-hidden="true">${icon('plus', { size: 20 })}</span></summary>
<div class="inq-body">${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}</div>
</details>`;

  // What the creator offers, as a roadmap down a rail (their order, their prices), drawn in with the scroll and ending
  // at the inquiry form. One offer only: a plain line.
  const road = roadmap({ id: 'offer', cls: 'ls-road', title: 'Work with me', nodes: c.services.map((s) => ({ title: s.name, meta: s.priceText || '', sub: [s.duration, s.blurb].filter(Boolean).join(', ') })), end: '<a class="btn btn-primary ls-open" href="#contact">Brand inquiries</a>', endLabel: person });
  const offer = road || (c.services.length
    ? `<section class="blk" aria-labelledby="offer-title"><h2 class="bh" id="offer-title">Work with me</h2><p class="one">${esc(c.services[0].name)}${c.services[0].priceText ? ` <span>${esc(c.services[0].priceText)}</span>` : ''}</p></section>`
    : '');

  const about = c.aboutParas.length
    ? `<section class="blk" aria-labelledby="about-title"><h2 class="bh" id="about-title" data-split>${esc(c.owner && c.owner !== c.name ? `Hi, I'm ${person}.` : `About ${c.name}`)}</h2>${c.aboutParas.map((p, i) => `<p class="ab" data-rv style="--d:${i + 1}">${esc(p)}</p>`).join('')}</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="blk" aria-labelledby="reviews-title"><h2 class="bh" id="reviews-title">Kind words</h2>${c.reviews.map((r, i) => `<figure class="rq" data-rv style="--d:${i}"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</section>`
    : '';

  const faq = c.faq.length ? `<section class="blk" aria-labelledby="faq-title"><h2 class="bh" id="faq-title">Questions</h2>${P.faq(c.faq)}</section>` : '';

  const m = motion();
  const body = [
    '<main id="main" class="ls">',
    profile,
    '<div class="ls-col">',
    stack,
    inquiry,
    offer,
    about,
    reviews,
    faq,
    `<footer class="ls-ftr"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}${c.phone ? `<p><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}</footer>`,
    '</div>',
    '</main>',
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: `${m.script}\n${JS}`, base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '76rem' } };
}

// A link to the inquiry form opens it in place.
const JS = `(function(){var d=document,f=d.getElementById('contact');if(!f)return;[].slice.call(d.querySelectorAll('a[href="#contact"]')).forEach(function(a){a.addEventListener('click',function(){f.open=true})})})();`;

const CSS = `
${ROADMAP_CSS}
:root{--bg:var(--dark);--ink:var(--on-dark);--muted:var(--muted-on-dark);--line:var(--line-on-dark);--primary-text:var(--primary-on-dark);--primary-soft:color-mix(in srgb,var(--primary) 18%,var(--dark));--primary-tint:color-mix(in srgb,var(--primary) 40%,var(--dark));--focus:var(--primary-on-dark);--surface:color-mix(in srgb,var(--on-dark) 4%,var(--dark));--ease:cubic-bezier(.16,1,.3,1);color-scheme:dark}
body{background:var(--bg)}
.ls{display:grid;width:min(100% - 2rem,var(--max));margin-inline:auto;padding-block:clamp(1.5rem,1rem + 3vw,4rem) 2rem;gap:clamp(2rem,1.5rem + 2vw,3rem)}
@media (min-width:56rem){.ls{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:0 clamp(3rem,6vw,7rem);align-items:start}.pf{position:sticky;top:clamp(2rem,6vh,4rem)}}
.hd{padding-bottom:.7rem;border-bottom:1px solid var(--line);font-size:.85rem;font-weight:500;letter-spacing:.04em;color:var(--muted)}
.nm-wrap{transform-origin:0 100%}
.nm{margin-top:clamp(1rem,2vw,1.75rem);font-size:var(--fsm);font-weight:400;line-height:.86;letter-spacing:-.035em;padding-bottom:.08em}
@media (min-width:56rem){.nm{font-size:clamp(4rem,calc(var(--fs) * (min(76rem,100vw - 4rem) * .44)),9.5rem)}}
.nw{display:block;width:max-content;max-width:100%}
.bio{margin-top:1.5rem;max-width:26rem;font-size:1.15rem;line-height:1.5;color:var(--muted)}
.soc{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem;margin-top:1.5rem}
.soc a{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:500;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 85%/0 1px no-repeat;transition:background-size .35s var(--ease)}
.soc a:hover{background-size:100% 1px}
.ls-col{display:grid;gap:clamp(2.5rem,2rem + 2vw,4rem);min-width:0}
.idx ol{border-top:1px solid var(--ink)}
.ln,.inq summary{position:relative;display:grid;grid-template-columns:2.25rem minmax(0,1fr) auto;gap:.15rem .75rem;align-items:baseline;padding:1.05rem 0;border-bottom:1px solid var(--line);text-decoration:none}
.ln-n{font-size:.8rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--muted)}
.ln-t{font-family:var(--font-display);font-size:clamp(1.45rem,1.25rem + .8vw,1.9rem);line-height:1.1;letter-spacing:-.015em}
.ln-w{grid-column:2;font-size:.85rem;color:var(--muted)}
.ln .i,.inq-x{grid-column:3;grid-row:1/3;align-self:center;transition:transform .35s var(--ease)}
.ln:hover .ln-t,.inq summary:hover .ln-t{text-decoration:underline;text-decoration-color:var(--pop);text-decoration-thickness:1px;text-underline-offset:.18em}
.ln:hover .i{transform:translate(3px,-3px)}
.ln-1::before{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--pop);transform-origin:0 50%}
html.m .ln-1::before{transform:scaleX(0);transition:transform 1.4s var(--ease) 1.4s}
html.ci-go .ln-1::before{transform:none}
.inq{margin-top:calc(-1 * clamp(2.5rem,2rem + 2vw,4rem))}
.inq summary{list-style:none}
.inq[open] .inq-x{transform:rotate(45deg)}
.inq-body{padding:1.5rem 0 1rem;border-bottom:1px solid var(--line)}
html.m .inq[open] .inq-body{animation:lsOpen .6s var(--ease)}
@keyframes lsOpen{from{opacity:0;transform:translateY(-10px)}}
.field input,.field select,.field textarea{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 45%,transparent);border-radius:0;background:transparent;padding-inline:0}
.field input:focus,.field textarea:focus{border-color:var(--ink);box-shadow:0 1px 0 var(--ink)}
.btn{font-weight:600}
.btn:hover{transform:none}
.btn-primary{background:var(--on-dark);color:var(--dark);box-shadow:none}
.btn-primary:hover{background:color-mix(in srgb,var(--on-dark) 85%,var(--dark))}
.bh{font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:400;line-height:1;letter-spacing:-.02em}
.blk{display:grid;gap:1rem;padding-top:1.25rem;border-top:1px solid var(--line)}
.ab{max-width:34rem;font-size:1.08rem;line-height:1.6;color:var(--muted)}
.ab:first-of-type{font-family:var(--font-display);font-size:clamp(1.35rem,1.2rem + .6vw,1.7rem);line-height:1.3;color:var(--ink)}
.one{font-family:var(--font-display);font-size:1.8rem}
.one span{color:var(--muted)}
.rm-sec.sec{padding-block:0}
.ls-road{--rm-accent:var(--pop);--rm-dot-bg:var(--dark);padding-top:1.25rem;border-top:1px solid var(--line)}
.ls-road .wrap{width:auto}
.ls-road .rm-head{margin-bottom:2rem}
.ls-road .h2{font-family:var(--font-display);font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:400;line-height:1;letter-spacing:-.02em}
.ls-road .rm-dot{border-width:1px;font-weight:500}
.ls-road .rm-txt h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.5rem,1.3rem + .8vw,2rem);letter-spacing:-.015em}
.ls-road .rm-meta{font-variant-numeric:tabular-nums;color:var(--ink)}
@media (min-width:48rem){.ls-road .rm-wave{display:none}.ls-road .rm-nodes{grid-template-columns:none;gap:2rem;padding-left:3.5rem}.ls-road .rm-nodes::before,.ls-road .rm-nodes::after{display:block}.ls-road .rm-node{justify-items:start;text-align:left;padding-top:0}.ls-road .rm-dot{left:-3.5rem;margin-left:0}.ls-road .rm-txt{justify-items:start}}
.ls-road .rm-nodes::before,.ls-road .rm-nodes::after{width:1px;left:1.4rem}
.rq{display:grid;gap:.5rem;padding-block:1rem;border-bottom:1px solid var(--line)}
.rq blockquote{margin:0;font-family:var(--font-display);font-size:1.5rem;line-height:1.25}
.rq figcaption{font-size:.9rem;color:var(--muted)}
.faq{gap:0;border-top:1px solid var(--line)}
.faq details,.faq details[open]{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
.faq summary{padding:1.05rem 0;font-weight:500}
.faq summary .i{color:var(--ink)}
.faq .ans{padding:0 0 1.15rem}
.ls-ftr{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem;padding-top:1.25rem;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
.ls-ftr a{color:var(--ink)}
.mpause{margin:1rem 0 0}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Linkstack',
  bestFor: 'Creators who need one link in bio: every link, socials and a brand inquiry form on one phone-sized page, with motion',
  why: 'A link in bio page that reads like your own index: your name set large comes into focus, every link is a numbered line that says where it goes, and your rates draw in down a line to an inquiry form that opens in place.',
  fonts: { q: 'family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@400;500;600', display: ['DM Serif Display', 'serif'], body: ['Work Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): the name comes into focus, it leans toward you, the rates draw in.
  choreo: { intro: 'develop', alive: ['pointer', 'tap'], scroll: 'roadmap', pace: 'calm', look: 'quiet, at night, a personal index' },
  tokens,
  slots,
  nav,
  render,
};
