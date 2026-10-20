// Linkstack (animated, creator): a link in bio page, one column built for phones. A soft gradient drifts behind
// everything, the monogram sits in a turning halo, the name rises in letter by letter, and big link buttons stagger in
// (and lean toward the pointer on desktop). Socials, what the creator offers, a short about and a brand inquiry form
// that opens in place.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const { esc } = require('../shared');

const id = 'linkstack';

function tokens(p) {
  return { bg: color.mix(p.paper, '#f6f4f1', 0.6), dark: color.mix(p.ink, '#000000', 0.3) };
}

// No photos: the monogram is the avatar.
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
  let k = 0;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="nw">${Array.from(w).map((ch) => `<span class="lt" style="--i:${k++}">${esc(ch)}</span>`).join('')}</span>`)
    .join(' ');
  const long = name.length > 16;

  const links = c.links.slice();
  if (!links.length && c.email) links.push({ label: 'Email me', href: `mailto:${c.email}`, kind: 'link' });
  let si = 0;
  const socialsHtml = P.socials(c, { cls: 'ls-social', size: 22 }).replace(/<li>/g, () => `<li data-rv="scale" style="--d:${4 + si++}">`);
  const base = 4 + si;

  const profile = `<header class="pf">
<div class="av" data-rv="scale"><span class="av-in" aria-hidden="true">${esc(P.monogram(c.name))}</span></div>
<h1 class="nm${long ? ' long' : ''}" id="hero-title"><span class="sr-only">${esc(name)}</span><span aria-hidden="true">${letters}</span></h1>
${c.handle ? `<p class="hd" data-rv style="--d:3">${esc(c.handle)}</p>` : ''}
${c.heroSub ? `<p class="bio" data-rv style="--d:3">${esc(c.heroSub)}</p>` : ''}
${socialsHtml}
</header>`;

  const stack = links.length
    ? `<nav class="stack-wrap" aria-label="Links"><ul class="stack">
${links.map((l, i) => `<li data-rv style="--d:${base + i}"><a class="ln${i === 0 ? ' ln-1' : ''}" data-mag href="${esc(l.href)}"><span class="ln-ic">${P.linkIcon(l, 22)}</span><span class="ln-tx"><span class="ln-t">${esc(l.label)}</span><span class="ln-w">${esc(where(l))}</span></span><span class="ln-go" aria-hidden="true">${icon('arrowUpRight', { size: 20, stroke: 2 })}</span></a></li>`).join('\n')}
</ul></nav>`
    : '';

  const offer = c.services.length
    ? `<section class="card" data-rv aria-labelledby="offer-title"><h2 id="offer-title">Work with me</h2><ul class="offer">${c.services.map((s) => `<li><span>${esc(s.name)}${s.duration ? `<small>${esc(s.duration)}</small>` : ''}</span>${s.priceText ? `<strong>${esc(s.priceText)}</strong>` : ''}</li>`).join('')}</ul></section>`
    : '';

  const about = c.aboutParas.length
    ? `<section class="card" data-rv aria-labelledby="about-title"><h2 id="about-title">${esc(c.owner && c.owner !== c.name ? `Hi, I'm ${c.owner}` : 'About')}</h2>${c.aboutParas.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="card" data-rv aria-labelledby="reviews-title"><h2 id="reviews-title">Kind words</h2>${c.reviews.map((r) => `<figure class="rq"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`).join('')}</section>`
    : '';

  const faq = c.faq.length ? `<section class="card" data-rv aria-labelledby="faq-title"><h2 id="faq-title">Questions</h2>${P.faq(c.faq)}</section>` : '';

  const fields = [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Brand', half: false },
    { ...P.FIELD_PRESETS.message, label: 'Tell me about the campaign', required: true },
  ];
  const inquiry = `<details class="inq" id="contact" data-rv>
<summary><span class="ln-ic">${icon('mail', { size: 22 })}</span><span class="ln-tx"><span class="ln-t">Brand inquiries</span><span class="ln-w">Send a message</span></span><span class="inq-x" aria-hidden="true">${icon('plus', { size: 20, stroke: 2 })}</span></summary>
<div class="inq-body">${P.form(c, { id: 'contact', fields, submit: 'Send inquiry', subject: `Brand inquiry for ${c.name}` })}</div>
</details>`;

  const m = motion();
  const body = [
    '<div class="aura" aria-hidden="true"><span class="a1"></span><span class="a2"></span><span class="a3"></span></div>',
    '<main id="main" class="ls">',
    profile,
    stack,
    inquiry,
    offer,
    about,
    reviews,
    faq,
    '</main>',
    `<footer class="ls-ftr"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}${c.phone ? `<p><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></p>` : ''}</footer>`,
  ]
    .filter(Boolean)
    .join('\n');
  return { body, css: `${m.css}${CSS}`, script: m.script, base: { radius: '22px', radiusSm: '14px', btnRadius: '999px', max: '34rem' } };
}

const CSS = `
html{background:var(--bg)}
body{background:transparent;min-height:100vh}
.aura{position:fixed;inset:0;z-index:-1;overflow:hidden;background:var(--bg)}
.aura span{position:absolute;border-radius:50%;filter:blur(80px);opacity:.7;will-change:transform}
.a1{width:70vmax;height:70vmax;left:-25vmax;top:-30vmax;background:color-mix(in srgb,var(--primary) 62%,var(--bg));animation:lsA 22s ease-in-out infinite alternate}
.a2{width:60vmax;height:60vmax;right:-30vmax;top:10vh;background:color-mix(in srgb,var(--accent) 50%,var(--bg));animation:lsB 26s ease-in-out infinite alternate}
.a3{width:55vmax;height:55vmax;left:-10vmax;bottom:-35vmax;background:color-mix(in srgb,var(--primary) 40%,var(--accent));opacity:.45;animation:lsC 30s ease-in-out infinite alternate}
.aura::after{content:'';position:absolute;inset:0;opacity:.35;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .14 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes lsA{to{transform:translate(18vw,14vh) scale(1.15)}}
@keyframes lsB{to{transform:translate(-22vw,20vh) scale(.9)}}
@keyframes lsC{to{transform:translate(24vw,-18vh) scale(1.1)}}
.ls{width:min(100% - 2rem,var(--max));margin-inline:auto;padding-block:clamp(3rem,2rem + 4vw,5rem) 2.5rem;display:grid;gap:1rem}
.pf{display:grid;justify-items:center;text-align:center;margin-bottom:1.25rem}
.av{position:relative;display:grid;place-items:center;width:7rem;height:7rem;margin-bottom:1.4rem}
.av::before{content:'';position:absolute;inset:-9px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 12%,color-mix(in srgb,var(--accent) 60%,transparent) 45%,var(--primary) 88%,var(--ink) 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:lsSpin 4.5s linear infinite}
.av::after{content:'';position:absolute;inset:-18px;z-index:-1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--primary) 45%,transparent),transparent);animation:lsGlow 3.6s ease-in-out infinite}
.av-in{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:var(--primary);color:var(--on-primary);font-family:var(--font-display);font-size:2.3rem;font-weight:800;letter-spacing:-.04em;box-shadow:inset 0 0 0 4px color-mix(in srgb,var(--bg) 35%,transparent)}
@keyframes lsSpin{to{transform:rotate(360deg)}}
@keyframes lsGlow{50%{transform:scale(1.12);opacity:.6}}
.nm{font-size:clamp(2.6rem,1.9rem + 3.4vw,3.6rem);font-weight:800;line-height:1;letter-spacing:-.045em;font-variation-settings:"wdth" 90}
.nm.long{font-size:clamp(2rem,1.6rem + 2.4vw,3rem)}
.nw{display:inline-block;white-space:nowrap}
.lt{display:inline-block}
html.m .lt{animation:lsRise 1.1s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i) * 45ms + .25s)}
@keyframes lsRise{from{opacity:0;transform:translateY(.55em) rotate(8deg);filter:blur(8px)}}
@media (hover:hover){.nm:hover .lt{animation:lsWave .7s cubic-bezier(.3,1.5,.5,1);animation-delay:calc(var(--i) * 35ms)}}
@keyframes lsWave{40%{transform:translateY(-.14em)}}
.hd{margin-top:.6rem;font-weight:600;color:var(--primary-text)}
.bio{max-width:28rem;margin-top:.6rem;font-size:1.06rem;line-height:1.5;color:var(--muted)}
.ls-social{justify-content:center;gap:.6rem;margin-top:1.4rem}
.ls-social a{width:2.9rem;height:2.9rem;border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);background:color-mix(in srgb,var(--bg) 55%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .35s cubic-bezier(.2,1.4,.4,1),background-color .2s ease,color .2s ease}
.ls-social a:hover{transform:translateY(-3px);background:var(--ink);color:var(--bg)}
.stack{display:grid;gap:.8rem}
.ln,.inq>summary{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.9rem;min-height:4.4rem;padding:.7rem .8rem .7rem .7rem;border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--ink) 10%,transparent);background:color-mix(in srgb,var(--bg) 62%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);color:var(--ink);text-decoration:none;box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 30px -22px rgba(0,0,0,.4);overflow:hidden;isolation:isolate;transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,background-color .3s ease}
.ln::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--ink);transform:translateY(101%);transition:transform .5s cubic-bezier(.7,0,.2,1)}
.ln:hover{color:var(--bg);box-shadow:0 22px 40px -22px rgba(0,0,0,.5)}
.ln:hover::before{transform:none}
.ln-ic{display:grid;place-items:center;width:3rem;height:3rem;border-radius:16px;background:var(--primary-soft);color:var(--primary-text);transition:background-color .3s ease,color .3s ease}
.ln:hover .ln-ic{background:color-mix(in srgb,var(--bg) 16%,transparent);color:var(--bg)}
.ln-tx{display:grid;min-width:0;text-align:left}
.ln-t{font-family:var(--font-display);font-size:1.12rem;font-weight:700;line-height:1.2;letter-spacing:-.02em}
.ln-w{overflow:hidden;font-size:.84rem;color:var(--muted);white-space:nowrap;text-overflow:ellipsis;transition:color .3s ease}
.ln:hover .ln-w{color:color-mix(in srgb,var(--bg) 70%,transparent)}
.ln-go{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:50%;transition:transform .45s cubic-bezier(.2,1.4,.4,1)}
.ln:hover .ln-go{transform:rotate(45deg)}
.ln-1{min-height:5rem;background:var(--button);color:var(--on-button);border-color:transparent;box-shadow:0 18px 40px -20px var(--button)}
.ln-1 .ln-ic{background:color-mix(in srgb,var(--on-button) 18%,transparent);color:var(--on-button)}
.ln-1 .ln-w{color:color-mix(in srgb,var(--on-button) 75%,transparent)}
.ln-1 .ln-t{font-size:1.22rem}
.ln-1::after{content:'';position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:lsShine 5.5s ease-in-out 2s infinite}
@keyframes lsShine{0%,70%{left:-40%}100%{left:130%}}
html:not(.m) .ln-1::after{display:none}
.inq{border-radius:var(--radius)}
.inq>summary{list-style:none}
.inq>summary .ln-ic{background:var(--accent-soft);color:var(--ink)}
.inq-x{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:50%;transition:transform .4s cubic-bezier(.2,1.4,.4,1)}
.inq[open]>summary .inq-x{transform:rotate(45deg)}
.inq-body{margin-top:.6rem;padding:1.25rem;border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--ink) 10%,transparent);background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
html.m .inq[open] .inq-body{animation:lsOpen .6s cubic-bezier(.16,1,.3,1)}
@keyframes lsOpen{from{opacity:0;transform:translateY(-10px)}}
.field input,.field select,.field textarea{background:var(--bg)}
.card{margin-top:.6rem;padding:1.4rem 1.35rem;border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--ink) 10%,transparent);background:color-mix(in srgb,var(--bg) 55%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.card h2{margin-bottom:.8rem;font-size:.8rem;font-family:var(--font-body);font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--primary-text)}
.card p{line-height:1.6}
.card p+p{margin-top:.75rem}
.offer li{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding:.75rem 0;border-bottom:1px dashed color-mix(in srgb,var(--ink) 18%,transparent)}
.offer li:last-child{border-bottom:0;padding-bottom:0}
.offer li:first-child{padding-top:0}
.offer span{font-weight:600}
.offer small{display:block;font-weight:400;font-size:.85rem;color:var(--muted)}
.offer strong{font-family:var(--font-display);font-size:1.25rem;letter-spacing:-.02em;white-space:nowrap}
.rq blockquote{margin:0;font-size:1.08rem;line-height:1.5}
.rq figcaption{margin-top:.4rem;font-size:.9rem;color:var(--muted)}
.rq+.rq{margin-top:1.1rem}
.faq details{background:transparent}
.ls-ftr{display:grid;justify-items:center;gap:.3rem;padding:1rem 1rem 3rem;font-size:.88rem;color:var(--muted);text-align:center}
.ls-ftr a{color:var(--ink);font-weight:600;text-decoration:none}
.ls-ftr a:hover{text-decoration:underline}
@media (prefers-reduced-motion:reduce){.aura span,.av::before,.av::after{animation:none}}
`;

module.exports = {
  id,
  kind: 'creator',
  name: 'Linkstack',
  bestFor: 'Creators who need one link in bio: every link, socials and a brand inquiry form on one phone-sized page, with motion',
  why: 'A link in bio page built for phones: your monogram in a turning halo, your name rising in, big link buttons that slide in one by one over a soft moving gradient.',
  fonts: { q: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Figtree:wght@400;500;600', display: ['Bricolage Grotesque', 'grotesk'], body: ['Figtree', 'sans'] },
  tokens,
  slots,
  nav,
  render,
};
