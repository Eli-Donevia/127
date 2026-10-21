// Foundry (animated, agency): business to business services, set like the studio's own brand guidelines.
//   Object:   the brand guide. The page opens on its cover: the studio's name set as a type specimen with its cap
//             height, x-height and baseline ruled across the sheet, the column ticks of the grid along the top, and
//             the guide itself (drawn: an open spread with the mark's construction and the colour chips) as the
//             subject. Every section after it is a numbered chapter.
//   Material: Swiss poster stock: off-white sheet, black ink, 1.5px rules, square corners, nothing rounded.
//   One move: the type comes up from behind its own baseline, word by word (choreo intro 'mask'); the spread is
//             uncovered from the bottom up and the buttons wipe up the same way.
//   Pop:      the member's colour is the current step of the process, the underline under the address and the grid
//             echo. The neon partner is the specimen's baseline, drawn across the sheet once the name has landed (the
//             one neon moment; data-pop 'line' left off, the baseline is the design's own gesture).
// Two modes: poster stock (its own) and the reversed pages (dark). At rest the spread lags with the scroll and drifts
// (parallax); a tap on the cover drops the twelve columns from their ticks (ECHO_JS, the showpiece). The one scroll moment is the process: the
// member's steps as columns under a rule that draws itself left to right. Buttons are ink, never the member's colour.
// No outline marquee, no asterisks, no italic accents, no plus accordion. JavaScript off and reduced motion: the
// complete, still page.

const { color } = require('../../../../_kit');
const P = require('../../parts');
const { icon } = require('../../icons');
const { motion } = require('../../motion');
const A = require('../../art');
const { REVIEWS_CSS, esc } = require('../shared');
const { roadmap, ROADMAP_CSS } = require('../roadmap');
const { lenisScript, LENIS_CSS } = require('../../../vendor/lenis/lenis');

const id = 'foundry';

// Two rooms: the guide on poster stock (its own), and the guide's reversed pages: bone type on a near black sheet.
function tokens(p, mode) {
  if (mode === 'dark') return { bg: '#111111', dark: '#060606' };
  return { bg: color.mix(p.paper, '#f2f0eb', 0.85), dark: color.mix(p.ink, '#000000', 0.55) };
}
// The brief, the company fields and "projects start at" are a studio's words; a cafe or a barber given this design
// gets a plain message form and plain headings.
const studio = (c) => !c.profile || !c.profile.template || ['agency', 'portfolio'].includes(c.profile.template);

// The grid echo (the page's showpiece): the cover is built on twelve columns, and its ticks run along the top. A tap
// or click on the cover drops the columns down from their ticks, rippling out from the column you touched, then
// lets them go; once on its own after the intro, left to right. Transform and opacity only, never a loop; only with
// the motion class, never under a paused or still brief.
const ECHO_JS = `(function(){var d=document,h=d.documentElement;if(!h.classList.contains('m'))return;var hero=d.querySelector('.fx-hero'),g=hero&&hero.querySelector('.fx-grid');if(!g)return;var cols=[].slice.call(g.children),t=0;function vis(){return cols.filter(function(i){return i.offsetWidth>0})}function run(x){if(h.classList.contains('mp'))return;var v=vis(),k=0,b=1e9;v.forEach(function(i,n){var r=i.getBoundingClientRect(),dx=Math.abs(r.left+r.width/2-x);if(dx<b){b=dx;k=n}});g.classList.remove('go');void g.offsetWidth;v.forEach(function(i,n){i.style.setProperty('--d',(Math.abs(n-k)*55)+'ms')});g.classList.add('go');clearTimeout(t);t=setTimeout(function(){g.classList.remove('go')},2400)}hero.addEventListener('pointerdown',function(e){if(e.target.closest('a,button,input,select,textarea'))return;run(e.clientX)});var once=function(){var v=vis();if(v[0]&&!h.classList.contains('mp')&&hero.getBoundingClientRect().bottom>0)run(v[0].getBoundingClientRect().left)};if(d.readyState==='complete')setTimeout(once,2300);else addEventListener('load',function(){setTimeout(once,2300)})})();`;

function slots(c) {
  const g = c.profile.gallery || [];
  return [{ slot: 'studio', file: 'studio.jpg', w: 1400, h: 1100, style: 'sweep', alt: c.profile.hero || g[0] || `${c.name} at work` }];
}

// The generated about restates the hero ("X is a Y in Z, run by W. You can reach W directly"); keep only what is new.
function aboutParas(c) {
  const lw = (t) => String(t || '').toLowerCase();
  const who = [c.name, c.owner].filter(Boolean).map(lw);
  const restates = (t) => (who.some((w) => lw(t).includes(w)) && c.whatShort && lw(t).includes(lw(c.whatShort))) || /reach .* directly/i.test(t);
  return c.aboutParas.map((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter((x) => !restates(x)).join(' ')).filter(Boolean);
}

function nav(c) {
  return [
    c.services.length && { label: 'Services', href: '#services' },
    c.steps.length && { label: 'Process', href: '#process' },
    (aboutParas(c).length || c.clients.length) && { label: 'About', href: '#about' },
    c.faq.length && { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ].filter(Boolean);
}

// The name split on the server into words (so nothing reflows when the intro starts).
function headParts(title) {
  return String(title || '').trim().split(/\s+/).filter(Boolean).map((w) => `<span class="ci-w" data-ci-part>${esc(w)}</span>`).join(' ');
}

const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

// The cover's one line under the specimen: what the studio does and for whom, from the facts ("Brand and website
// design for B2B software companies"), never a category label with "agency" tacked on.
function whatLine(c) {
  const what = String(c.whatShort || '').trim().replace(/\s+(agency|studio|firm|consultancy|company|collective|bureau)$/i, '');
  const aud = c.audience ? lowerFirst(String(c.audience).replace(/^for\s+/i, '').replace(/[.!]+$/, '')) : '';
  if (!what) return c.heroTitle || '';
  return `${what}${aud ? ` for ${aud}` : ''}.`;
}

// The cover's facts: where, and where prices start. Only what the member gave.
function leadLine(c, low) {
  const where = c.online ? 'Working remotely' : c.place || c.city || '';
  const bits = [];
  if (where) bits.push(c.online ? `${where}.` : `Working from ${where}.`);
  if (low) bits.push(`${studio(c) ? 'Projects' : 'Prices'} start at ${low.priceText.replace(/^From /, '')}.`);
  return bits.join(' ');
}

// Member Q&A as a two-column sheet: the question set in the display face, the answer beside it. No accordion.
function faqSheet(items) {
  return `<dl class="fx-qa">${items.map((q) => `<div class="fx-qa-row"><dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd></div>`).join('')}</dl>`;
}

function render(c) {
  const oneOff = c.services.filter((s) => typeof s.price === 'number' && !s.unit);
  const low = oneOff.length ? oneOff.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const primary = (cls = 'btn btn-primary btn-lg') => P.button(c.primary, cls).replace('<a ', '<a data-mag ').replace(/<\/a>$/, `${icon('arrowUpRight', { size: 18 })}</a>`);
  let n = 0;
  const chap = (label) => `<p class="fx-chap"><span class="fx-chap-n">${String((n += 1)).padStart(2, '0')}</span>${esc(label)}</p>`;
  const nameLen = [...c.name].length;
  const longest = Math.max(...c.name.split(/\s+/).map((w) => [...w].length));
  const lead = leadLine(c, low);

  const hero = `<section class="fx-hero" aria-labelledby="hero-title">
<div class="wrap">
<div class="fx-ticks" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
<div class="fx-grid" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
${chap('Cover')}
<h1 id="hero-title" class="fx-spec" data-ci="head" style="--fs:${Math.min(10, 150 / Math.max(nameLen, 8)).toFixed(2)}vw;--fsm:${Math.min(15, 170 / Math.max(longest, 6)).toFixed(2)}vw">${headParts(c.name)}<span class="fx-guides" aria-hidden="true"><i class="g-cap"></i><i class="g-x"></i><i class="g-base"></i><span class="gl l-cap"><b>Cap height</b></span><span class="gl l-x"><b>x-height</b></span><span class="gl l-base"><b>Baseline</b></span></span></h1>
<div class="fx-cover">
<div class="fx-cover-copy">
<p class="fx-what">${esc(whatLine(c))}</p>
${lead ? `<p class="fx-lead">${esc(lead)}</p>` : ''}
<div class="fx-ctas" data-ci="then" data-ci-from="mask">${primary()}${c.secondary ? P.button(c.secondary, 'btn btn-ghost btn-lg') : ''}</div>
</div>
<figure class="fx-plate" data-par="0.06"><div class="fx-plate-lean" data-alive="0.18"><div class="fx-plate-in" data-ci="subject">${P.img(c, 'studio', { cls: 'fx-plate-img', eager: true })}</div></div></figure>
</div>
</div>
</section>`;

  const services = c.services.length
    ? `<section class="fx-sec" id="services" aria-labelledby="services-title">
<div class="wrap">
<div class="fx-head">${chap('Services')}<h2 class="fx-h2" id="services-title">${esc(c.services.some((s) => s.priceText) ? 'What we do, and what it costs' : 'What we do')}</h2></div>
<ol class="fx-rows">
${c.services
  .map(
    (s, i) => `<li class="fx-row">
<div class="fx-row-top"><span class="fx-row-n" aria-hidden="true">${n}.${i + 1}</span><h3>${esc(s.name)}</h3>${s.priceText ? `<p class="fx-row-p">${esc(s.priceText)}</p>` : ''}</div>
${s.blurb || s.duration ? `<div class="fx-row-in">${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}${s.duration ? `<p class="fx-row-d">${esc(s.duration)}</p>` : ''}</div>` : ''}
</li>`
  )
  .join('\n')}
</ol>
${c.included.length ? `<div class="fx-incl"><h3>Every project includes</h3><ol>${c.included.map((x, i) => `<li><span aria-hidden="true">${String.fromCharCode(97 + i)}</span>${esc(x)}</li>`).join('')}</ol></div>` : ''}
</div>
</section>`
    : c.included.length
      ? `<section class="fx-sec" id="services" aria-labelledby="services-title"><div class="wrap"><div class="fx-head">${chap('Services')}<h2 class="fx-h2" id="services-title">What you get</h2></div><ul class="fx-incl-big">${c.included.map((x, i) => `<li><span>${n}.${i + 1}</span>${esc(x)}</li>`).join('')}</ul></div></section>`
      : '';

  // The process: the member's steps as columns under one rule that draws itself with the scroll (the roadmap's
  // markup, restyled as a Swiss schedule). No end node with the business name; the button follows the schedule.
  const procN = c.steps.length >= 2 ? n + 1 : 0;
  const process = c.steps.length >= 2
    ? roadmap({ id: 'process', cls: 'fx-process', title: studio(c) ? 'How a project runs' : 'How it works', nodes: c.steps.map((s) => ({ title: s.title, sub: s.body })) })
        .replace('<div class="rm-head">', `<div class="rm-head"><p class="fx-chap"><span class="fx-chap-n">${String(procN).padStart(2, '0')}</span>Process</p>`)
        .replace(/<\/ol>\n<\/div>\n<\/div>\n<\/section>$/, `</ol>\n</div>\n${c.primary.kind !== 'form' ? `<div class="fx-proc-go">${primary('btn btn-primary')}</div>` : ''}\n</div>\n</section>`)
    : '';
  if (procN) n = procN;

  // The first sentence as a statement, the rest at reading size (the member's paragraphs kept).
  const [p0 = '', ...more] = aboutParas(c);
  const sentences = p0.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const first = sentences.shift() || '';
  const rest = [sentences.join(' '), ...more].filter(Boolean);
  const about = first || rest.length || c.clients.length
    ? `<section class="fx-sec fx-about" id="about" aria-labelledby="about-title">
<div class="wrap fx-about-grid">
<div class="fx-about-side">${chap(studio(c) ? 'Studio' : 'About')}<h2 class="fx-about-h" id="about-title">${studio(c) ? 'The studio' : esc(`About ${c.name}`)}</h2></div>
${first ? `<p class="fx-state" data-rv>${esc(first)}</p>` : ''}
<div class="fx-about-rest">
${rest.map((p) => `<p class="fx-p" data-rv>${esc(p)}</p>`).join('\n')}
${P.socials(c, { cls: 'fx-social' })}
</div>
${c.clients.length ? `<div class="fx-clients"><h3 class="fx-cl-h">Clients</h3><ul class="fx-clients-list">${c.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
</div>
</section>`
    : '';

  const reviews = c.reviews.length
    ? `<section class="fx-sec" aria-labelledby="reviews-title"><div class="wrap"><div class="fx-head">${chap('Clients')}<h2 class="fx-h2" id="reviews-title">In their words</h2></div><div data-rv>${P.reviews(c)}</div></div></section>`
    : '';

  const faq = c.faq.length
    ? `<section class="fx-sec" id="faq" aria-labelledby="faq-title"><div class="wrap"><div class="fx-head">${chap('Questions')}<h2 class="fx-h2" id="faq-title">Before you write</h2></div>${faqSheet(c.faq)}</div></section>`
    : '';

  const fields = !studio(c) ? [{ ...P.FIELD_PRESETS.name, half: true }, { ...P.FIELD_PRESETS.email, half: true }, { ...P.FIELD_PRESETS.message, label: 'Your message', required: true }] : [
    'name',
    'email',
    { ...P.FIELD_PRESETS.company, label: 'Company' },
    { ...P.FIELD_PRESETS.website, label: 'Company website' },
    c.services.length > 1 ? { name: 'service', label: 'What do you need?', type: 'select', options: [...c.services.map((s) => s.name), 'Not sure yet'], half: true } : null,
    { name: 'timeline', label: 'When do you need it?', type: 'text', half: true },
    { ...P.FIELD_PRESETS.message, label: 'Tell us about the project' },
  ].filter(Boolean);
  const mail = c.email ? `<a class="fx-mail" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '';
  const contact = `<section class="fx-sec fx-contact" id="contact" aria-labelledby="contact-title">
<div class="wrap">
<div class="fx-head">${chap('Contact')}<h2 class="fx-h2" id="contact-title">${esc(c.owner && c.owner !== c.name ? `Write to ${c.owner}` : `Write to ${c.name}`)}</h2></div>
${mail ? `<p class="fx-mail-p">${mail}</p>` : ''}
<div class="fx-contact-grid">
<div class="fx-contact-copy">
${c.primary.kind !== 'form' ? `<div class="fx-ctas">${primary()}</div>` : ''}
${c.promise ? `<p class="fx-promise">${esc(c.promise)}</p>` : ''}
${P.contactList(mail ? { ...c, email: '' } : c, { cls: 'fx-contact-list' })}
</div>
<div class="fx-form">
<h3>${studio(c) ? 'Project brief' : 'Message'}</h3>
${P.form(c, { id: 'contact', fields, submit: studio(c) ? 'Send the brief' : 'Send', subject: studio(c) ? `Project inquiry for ${c.name}` : `Message for ${c.name}` })}
</div>
</div>
</div>
</section>`;

  // The colophon: the guide's last page, a numbered chapter of plain facts on hairlines (who, where, how to reach
  // them, the pages, the faces it is set in). Not the shared three-column footer.
  const reach = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`].filter(Boolean).join('<br>');
  const pages = (c.nav || []).map((x) => `<a href="${esc(x.href)}">${esc(x.label)}</a>`).join('');
  const colo = [
    [studio(c) ? 'Studio' : 'Business', `${esc(c.name)}${c.city && !c.online ? `, ${esc(c.city)}` : ''}`],
    reach && ['Write or call', reach],
    pages && ['Pages', `<span class="fx-colo-pages">${pages}</span>`],
    P.socials(c, { cls: 'fx-social', size: 18 }) && ['Elsewhere', P.socials(c, { cls: 'fx-social', size: 18 })],
    ['Set in', 'Schibsted Grotesk and Instrument Sans'],
  ].filter(Boolean);
  const footer = `<footer class="fx-ftr">
<div class="wrap">
${chap('Colophon')}
<dl class="fx-colo">${colo.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
<p class="fx-colo-c">&copy; ${esc(c.year)} ${esc(c.name)}</p>
</div>
</footer>`;

  const m = motion();
  const body = [P.header(c, { cls: 'fx-hdr', mark: false }).replace('<header class="hdr', '<header data-hdr class="hdr'), '<main id="main">', hero, services, process, about, reviews, faq, contact, '</main>', footer, P.mobileBar(c)].filter(Boolean).join('\n');
  return { body, css: `${m.css}${CSS}${LENIS_CSS}`, script: `${m.script}${ECHO_JS}${lenisScript({ lerp: 0.085 })}`, bodyClass: 'has-bar', base: { radius: '0px', radiusSm: '0px', btnRadius: '0px', max: '82rem' } };
}

// The placeholder for the studio photo, drawn: the studio's own guide, open on a plaster wall, its spread showing the
// kind of work the facts name (c.profile.id, else the words):
//   brand: the mark on its construction, colour chips, a layout grid     web: a sitemap and the page at three widths
//   social: a nine-post grid and the post up close                      automation: a flow, with its branch and loop
//   marketing: a poster proof with crop marks, and the same ad at three sizes
//   consulting, bookkeeping: a two-by-two with the client plotted, and the plan as four phases on a line
//   anything else: a plain Swiss poster for the business (colour fields and a circle), about the business, not a trade.
// Paper with a soft gutter shadow and a real shadow under the booklet; hairlines, no fake text, no <text>.
function kindOf(c) {
  const id = (c.profile && c.profile.id) || '';
  const s = `${c.what || ''} ${c.niche || ''} ${(c.services || []).map((x) => x.name).join(' ')}`.toLowerCase();
  if (/\b(brand\w*|identity|logo|graphic design)\b/.test(s)) return 'brand';
  const KIND = { webdesign: 'web', social: 'social', automation: 'flow', marketing: 'ads', consulting: 'plan', design: 'brand' };
  if (KIND[id]) return KIND[id];
  if (/\b(web ?design|websites?|webflow|wordpress|landing pages?)\b/.test(s)) return 'web';
  if (/\b(social media|instagram|content)\b/.test(s)) return 'social';
  if (/\b(automations?|ai agents?|chatbots?|zapier|crm)\b/.test(s)) return 'flow';
  if (/\b(marketing|seo|ads|ppc|campaigns?|copywrit\w*)\b/.test(s)) return 'ads';
  if (/\b(consult\w*|advis\w*|bookkeep\w*|accounting|tax|fractional|operations)\b/.test(s)) return 'plan';
  return '';
}
function art(slot, { p, c, seed, index, art: Art }) {
  if (slot.slot !== 'studio') return null;
  const kind = kindOf(c || {});
  // A rendered photo wins when the pack ships one: the guide open on the studio table, by the kind of work
  // (studio-brand, studio-web, studio-social, studio-flow, studio-ads, studio-plan), else studio-desk for any business.
  const real = Art.photo && Art.photo('foundry', `studio-${kind || 'desk'}`);
  if (real) return real;
  const w = slot.w, h = slot.h;
  const r = Art.rng(`${seed}:guide`);
  const W = Art.wall({ style: 'sweep', w, h, p, seed, index, quiet: true });
  const paper = color.mix(p.paper, '#ffffff', 0.7);
  const ink = color.mix(p.ink, '#000000', 0.3);
  const hair = color.mix(ink, paper, 0.72);
  const soft = color.mix(p.primary, paper, 0.25);
  const grey = color.mix(p.paper, p.ink, 0.12);
  const f = (v) => v.toFixed(1);
  const pw = w * 0.34, ph = pw * 1.36, x0 = w / 2 - pw, y0 = (h - ph) / 2 + h * 0.02, rx = x0 + pw;
  const L = `fill="none" stroke="${hair}" stroke-width="1.6"`;
  const box = (x, y, bw, bh, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="${f(bh)}" ${fill ? `fill="${fill}"` : L}${extra}/>`;
  // A photograph in the guide: a small crop of window light in the member's tones.
  const photo = (x, y, s2, k) => `<rect x="${f(x)}" y="${f(y)}" width="${f(s2)}" height="${f(s2)}" fill="${color.mix(p.primary, paper, 0.35 + k * 0.08)}"/><path d="M${f(x + s2 * (0.2 + k * 0.05))} ${f(y)}h${f(s2 * 0.3)}l${f(s2 * 0.25)} ${f(s2)}h${f(-s2 * 0.3)}Z" fill="#fff" opacity=".28"/>`;
  let left = '', right = '';
  if (kind === 'brand') {
    const cx = x0 + pw / 2, cy = y0 + ph * 0.42, s = pw * 0.26;
    const marks = [
      `M${f(cx - s)} ${f(cy + s)}L${f(cx)} ${f(cy - s)}L${f(cx + s)} ${f(cy + s)}L${f(cx)} ${f(cy + s * 0.45)}Z`,
      `M${f(cx - s)} ${f(cy + s)}V${f(cy)}A${f(s)} ${f(s)} 0 0 1 ${f(cx + s)} ${f(cy)}V${f(cy + s)}H${f(cx + s * 0.45)}V${f(cy)}A${f(s * 0.45)} ${f(s * 0.45)} 0 0 0 ${f(cx - s * 0.45)} ${f(cy)}V${f(cy + s)}Z`,
      `M${f(cx - s)} ${f(cy - s)}H${f(cx + s)}V${f(cy - s * 0.4)}H${f(cx - s * 0.2)}V${f(cy + s)}H${f(cx - s)}Z`,
    ];
    left = `<g ${L}><rect x="${f(cx - s * 1.5)}" y="${f(cy - s * 1.5)}" width="${f(s * 3)}" height="${f(s * 3)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 1.5)}"/><path d="M${f(cx - s * 1.5)} ${f(cy - s * 1.5)}L${f(cx + s * 1.5)} ${f(cy + s * 1.5)}M${f(cx + s * 1.5)} ${f(cy - s * 1.5)}L${f(cx - s * 1.5)} ${f(cy + s * 1.5)}M${f(cx)} ${f(cy - s * 1.8)}V${f(cy + s * 1.8)}M${f(cx - s * 1.8)} ${f(cy)}H${f(cx + s * 1.8)}"/></g><path d="${marks[Math.floor(r() * marks.length)]}" fill="${ink}"/>`;
    const chipW = pw * 0.22, chipH = ph * 0.2, chipY = y0 + ph * 0.12;
    right = [ink, p.primary, grey].map((col, i) => box(rx + pw * 0.12 + i * (chipW + pw * 0.04), chipY, chipW, chipH, col)).join('');
    const gx = rx + pw * 0.12, gy = y0 + ph * 0.48, gw = pw * 0.76, gh = ph * 0.38, col = gw / 6;
    right += box(gx, gy, gw, gh);
    for (let i = 1; i < 6; i++) right += `<path d="M${f(gx + i * col)} ${f(gy)}V${f(gy + gh)}" stroke="${hair}" stroke-width="1.2"/>`;
    right += `<path d="M${f(gx)} ${f(gy + gh * 0.34)}H${f(gx + gw)}" stroke="${hair}" stroke-width="1.2"/>` + box(gx + col * 2, gy + gh * 0.34, col * 3, gh * 0.66, soft) + box(gx, gy, col * 4, gh * 0.34, ink);
  } else if (kind === 'web') {
    // Sitemap: one home, three sections, a few pages under each, joined by hairline elbows.
    const tx = x0 + pw / 2, ty = y0 + ph * 0.18, bw = pw * 0.2, bh = ph * 0.07;
    left = box(tx - bw / 2, ty, bw, bh, ink);
    [-1, 0, 1].forEach((k) => {
      const sx = tx + k * pw * 0.28, sy = ty + ph * 0.22;
      left += `<path d="M${f(tx)} ${f(ty + bh)}V${f(sy - ph * 0.05)}H${f(sx)}V${f(sy)}" ${L}/>` + box(sx - bw / 2, sy, bw, bh, k === 0 ? p.primary : paper, ` stroke="${ink}" stroke-width="1.6"`);
      for (let j = 0; j < 2 + ((k + 2) % 2); j++) { const py = sy + ph * (0.14 + j * 0.11); left += `<path d="M${f(sx - bw * 0.35)} ${f(sy + bh)}V${f(py + bh * 0.4)}H${f(sx - bw * 0.15)}" ${L}/>` + box(sx - bw * 0.15, py, bw * 0.6, bh * 0.8); }
    });
    // The same page at three widths, standing on one baseline: each with its bar, its hero module and a column grid.
    let bx = rx + pw * 0.08;
    const base = y0 + ph * 0.6;
    [[0.42, 0.3, p.primary], [0.24, 0.38, soft], [0.13, 0.28, ink]].forEach(([k, hh, col]) => {
      const fw = pw * k, fh = ph * hh, fy = base - fh, n = k > 0.3 ? 6 : k > 0.2 ? 4 : 2;
      right += box(bx, fy, fw, fh, paper, ` stroke="${ink}" stroke-width="1.6"`) + `<path d="M${f(bx)} ${f(fy + fh * 0.1)}h${f(fw)}" stroke="${ink}" stroke-width="1.2"/>` + box(bx + fw * 0.08, fy + fh * 0.18, fw * 0.84, fh * 0.34, col);
      for (let i = 0; i < n; i++) right += box(bx + fw * 0.08 + (i * fw * 0.84) / n + fw * 0.015, fy + fh * 0.6, (fw * 0.84) / n - fw * 0.03, fh * 0.3, '', ` stroke-dasharray="4 3"`);
      bx += fw + pw * 0.05;
    });
    right += `<path d="M${f(rx + pw * 0.06)} ${f(base + ph * 0.02)}H${f(rx + pw * 0.94)}" stroke="${ink}" stroke-width="1.6"/>`;
  } else if (kind === 'social') {
    const s2 = pw * 0.24, g2 = pw * 0.03, gx = x0 + (pw - (s2 * 3 + g2 * 2)) / 2, gy = y0 + ph * 0.16;
    for (let i = 0; i < 9; i++) left += i === 4 ? box(gx + (i % 3) * (s2 + g2), gy + Math.floor(i / 3) * (s2 + g2), s2, s2, p.primary) : photo(gx + (i % 3) * (s2 + g2), gy + Math.floor(i / 3) * (s2 + g2), s2, i % 4);
    const big = pw * 0.62, bx = rx + (pw - big) / 2, by = y0 + ph * 0.2;
    right = `${photo(bx, by, big, 1)}<rect x="${f(bx)}" y="${f(by)}" width="${f(big)}" height="${f(big)}" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M${f(bx)} ${f(by + big + ph * 0.05)}h${f(big)}" stroke="${ink}" stroke-width="1.6"/><circle cx="${f(bx + big * 0.06)}" cy="${f(by + big + ph * 0.1)}" r="${f(pw * 0.03)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
  } else if (kind === 'flow') {
    // A trigger, two steps, a branch (the diamond), two outcomes, and the loop back, in hairline wire.
    const node = (x, y, fill) => `<rect x="${f(x - pw * 0.13)}" y="${f(y - ph * 0.035)}" width="${f(pw * 0.26)}" height="${f(ph * 0.07)}" rx="${f(ph * 0.035)}" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    const cx = x0 + pw / 2;
    const ys = [0.16, 0.32, 0.48].map((k) => y0 + ph * k);
    left = `<path d="M${f(cx)} ${f(ys[0])}V${f(y0 + ph * 0.62)}M${f(cx)} ${f(y0 + ph * 0.7)}C${f(cx)} ${f(y0 + ph * 0.76)} ${f(x0 + pw * 0.22)} ${f(y0 + ph * 0.74)} ${f(x0 + pw * 0.22)} ${f(y0 + ph * 0.82)}M${f(cx)} ${f(y0 + ph * 0.7)}C${f(cx)} ${f(y0 + ph * 0.76)} ${f(x0 + pw * 0.78)} ${f(y0 + ph * 0.74)} ${f(x0 + pw * 0.78)} ${f(y0 + ph * 0.82)}" ${L}/>`;
    left += node(cx, ys[0], ink) + node(cx, ys[1], paper) + node(cx, ys[2], paper);
    left += `<path d="M${f(cx)} ${f(y0 + ph * 0.58)}l${f(pw * 0.07)} ${f(ph * 0.06)}l${f(-pw * 0.07)} ${f(ph * 0.06)}l${f(-pw * 0.07)} ${f(-ph * 0.06)}Z" fill="${p.primary}"/>` + node(x0 + pw * 0.22, y0 + ph * 0.86, paper) + node(x0 + pw * 0.78, y0 + ph * 0.86, soft);
    right = `<path d="M${f(rx + pw * 0.2)} ${f(y0 + ph * 0.5)}C${f(rx + pw * 0.2)} ${f(y0 + ph * 0.2)} ${f(rx + pw * 0.8)} ${f(y0 + ph * 0.2)} ${f(rx + pw * 0.8)} ${f(y0 + ph * 0.5)}S${f(rx + pw * 0.2)} ${f(y0 + ph * 0.8)} ${f(rx + pw * 0.2)} ${f(y0 + ph * 0.5)}" fill="none" stroke="${ink}" stroke-width="1.6"/><circle cx="${f(rx + pw * 0.8)}" cy="${f(y0 + ph * 0.5)}" r="${f(pw * 0.035)}" fill="${p.primary}"/>` + [0.2, 0.5].map((k) => `<circle cx="${f(rx + pw * k * 1)}" cy="${f(y0 + ph * (k === 0.2 ? 0.5 : 0.275))}" r="${f(pw * 0.025)}" fill="${paper}" stroke="${ink}" stroke-width="1.6"/>`).join('');
  } else if (kind === 'ads') {
    // A poster proof with crop marks and a colour bar along its foot; the same ad at three sizes.
    const px = x0 + pw * 0.18, py = y0 + ph * 0.14, pW = pw * 0.64, pH = ph * 0.64, k = pw * 0.05;
    left = box(px, py, pW, pH, ink) + `<circle cx="${f(px + pW * 0.62)}" cy="${f(py + pH * 0.4)}" r="${f(pW * 0.26)}" fill="${p.primary}"/>` + box(px, py + pH * 0.78, pW, pH * 0.22, grey);
    left += `<path d="M${f(px - k * 1.6)} ${f(py)}h${f(k)}M${f(px)} ${f(py - k * 1.6)}v${f(k)}M${f(px + pW + k * 0.6)} ${f(py)}h${f(k)}M${f(px + pW)} ${f(py - k * 1.6)}v${f(k)}M${f(px - k * 1.6)} ${f(py + pH)}h${f(k)}M${f(px)} ${f(py + pH + k * 0.6)}v${f(k)}M${f(px + pW + k * 0.6)} ${f(py + pH)}h${f(k)}M${f(px + pW)} ${f(py + pH + k * 0.6)}v${f(k)}" stroke="${ink}" stroke-width="1.2"/>`;
    [ink, p.primary, soft, grey, paper].forEach((col, i) => { left += box(px + i * pW * 0.2, y0 + ph * 0.86, pW * 0.2, ph * 0.035, col, ` stroke="${hair}" stroke-width="1"`); });
    const ad = (x, y, aw, ah) => box(x, y, aw, ah, ink) + `<circle cx="${f(x + aw * 0.6)}" cy="${f(y + ah * 0.42)}" r="${f(Math.min(aw, ah) * 0.26)}" fill="${p.primary}"/>`;
    right = ad(rx + pw * 0.12, y0 + ph * 0.12, pw * 0.4, pw * 0.4) + ad(rx + pw * 0.6, y0 + ph * 0.12, pw * 0.26, pw * 0.46) + ad(rx + pw * 0.12, y0 + ph * 0.56, pw * 0.74, pw * 0.3);
  } else if (kind === 'plan') {
    // A two-by-two with a few positions plotted (the client's in the member's colour), and four phases on a line.
    const qx = x0 + pw * 0.14, qy = y0 + ph * 0.16, qs = pw * 0.72;
    left = `<path d="M${f(qx)} ${f(qy)}V${f(qy + qs)}H${f(qx + qs)}M${f(qx + qs / 2)} ${f(qy)}V${f(qy + qs)}M${f(qx)} ${f(qy + qs / 2)}H${f(qx + qs)}" fill="none" stroke="${ink}" stroke-width="1.6"/>` + box(qx + qs / 2, qy, qs / 2, qs / 2, color.mix(p.primary, paper, 0.75));
    [[0.2, 0.7], [0.35, 0.82], [0.62, 0.62], [0.28, 0.3]].forEach(([a, b]) => { left += `<circle cx="${f(qx + qs * a)}" cy="${f(qy + qs * b)}" r="${f(pw * 0.022)}" fill="${ink}"/>`; });
    left += `<path d="M${f(qx + qs * 0.28)} ${f(qy + qs * 0.7)}Q${f(qx + qs * 0.5)} ${f(qy + qs * 0.5)} ${f(qx + qs * 0.74)} ${f(qy + qs * 0.24)}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-dasharray="6 6"/><circle cx="${f(qx + qs * 0.78)}" cy="${f(qy + qs * 0.2)}" r="${f(pw * 0.034)}" fill="${p.primary}"/>`;
    const lx = rx + pw * 0.12, lw = pw * 0.76, ly = y0 + ph * 0.3;
    right = `<path d="M${f(lx)} ${f(ly)}H${f(lx + lw)}" stroke="${ink}" stroke-width="2"/>`;
    [0, 1, 2, 3].forEach((i) => { const x = lx + (lw * i) / 3; right += `<path d="M${f(x)} ${f(ly - ph * 0.03)}v${f(ph * 0.06)}" stroke="${ink}" stroke-width="2"/>` + box(x - (i === 3 ? lw * 0.25 : 0), ly + ph * (0.08 + i * 0.12), lw * 0.25, ph * 0.07, i === 3 ? p.primary : i ? grey : ink); });
  } else {
    // The business's own poster: a field of its colour, a circle, a rule. No trade, no words.
    left = box(x0 + pw * 0.12, y0 + ph * 0.1, pw * 0.76, ph * 0.8, p.primary) + `<circle cx="${f(x0 + pw * 0.5)}" cy="${f(y0 + ph * 0.42)}" r="${f(pw * 0.24)}" fill="${paper}"/><path d="M${f(x0 + pw * 0.12)} ${f(y0 + ph * 0.74)}h${f(pw * 0.76)}" stroke="${ink}" stroke-width="3"/>`;
    right = box(rx + pw * 0.12, y0 + ph * 0.1, pw * 0.36, ph * 0.8, ink) + box(rx + pw * 0.52, y0 + ph * 0.1, pw * 0.36, ph * 0.38, grey) + `<circle cx="${f(rx + pw * 0.7)}" cy="${f(y0 + ph * 0.7)}" r="${f(pw * 0.15)}" fill="${p.primary}"/>`;
  }
  const defs = `${W.defs}<linearGradient id="fxs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient><linearGradient id="fxr" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".07"/><stop offset=".12" stop-color="#000" stop-opacity="0"/></linearGradient><filter id="fxb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(w * 0.012)}"/></filter>`;
  const body = `${W.body}<g transform="rotate(${f(-2.5 + r() * 1.5)} ${f(w / 2)} ${f(h / 2)})">
<rect x="${f(x0 + w * 0.012)}" y="${f(y0 + h * 0.022)}" width="${f(pw * 2)}" height="${f(ph)}" fill="${W.shade}" opacity=".45" filter="url(#fxb)"/>
<rect x="${f(x0)}" y="${f(y0)}" width="${f(pw * 2)}" height="${f(ph)}" fill="${paper}"/>
${left}${right}
<rect x="${f(x0)}" y="${f(y0)}" width="${f(pw)}" height="${f(ph)}" fill="url(#fxs)"/><rect x="${f(rx)}" y="${f(y0)}" width="${f(pw)}" height="${f(ph)}" fill="url(#fxr)"/>
<path d="M${f(rx)} ${f(y0)}V${f(y0 + ph)}" stroke="${color.mix(paper, ink, 0.18)}" stroke-width="2"/><path d="M${f(x0)} ${f(y0 + ph)}H${f(x0 + pw * 2)}" stroke="${color.mix(paper, ink, 0.2)}" stroke-width="1"/>
</g>`;
  return Art.svgDoc(w, h, defs, body);
}

const CSS = `
${REVIEWS_CSS}${ROADMAP_CSS}
@font-face{font-family:'Foundry Display Fallback';font-weight:500 800;src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('LiberationSans-Bold'),local('Helvetica Bold');size-adjust:99.4%}
@font-face{font-family:'Foundry Body Fallback';font-weight:400 600;src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('LiberationSans-Regular'),local('Helvetica');size-adjust:101.1%}
html:root{--font-display:"Schibsted Grotesk","Foundry Display Fallback",sans-serif;--font-body:"Instrument Sans","Foundry Body Fallback",sans-serif}
body{font-size:1.05rem;--button:var(--ink);--on-button:var(--bg);--rule:1.5px solid var(--ink)}
h1,h2,h3{font-weight:600;letter-spacing:-.04em}
.btn{border-radius:0;font-weight:600;letter-spacing:-.01em}
.btn:hover{transform:none}
.btn .i{transition:transform .3s cubic-bezier(.16,1,.3,1)}
.btn:hover .i{transform:translate(2px,-2px)}
.btn-primary{box-shadow:none;background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:var(--bg);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--ink)}
.btn-ghost{border-width:1.5px;border-color:var(--ink)}
/* chapters: a number and a name, in the body face at body size, never caps */
.fx-chap{display:flex;gap:.9rem;align-items:baseline;margin-bottom:1.1rem;padding-top:.7rem;border-top:var(--rule);font-size:.95rem;font-weight:600;letter-spacing:0}
.fx-chap-n{min-width:2.2rem;font-variant-numeric:tabular-nums}
.fx-h2{font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-head{max-width:56rem;margin-bottom:clamp(2.5rem,2rem + 2vw,4.5rem)}
.fx-sec{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem)}
.fx-lead{font-size:clamp(1.05rem,1rem + .3vw,1.2rem);line-height:1.5;color:var(--muted);max-width:30rem}
/* header */
.hdr{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:var(--rule)}
.hdr-in{display:flex;align-items:center;gap:1.5rem;min-height:4.25rem}
.brand{margin-right:auto;font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-.04em;text-decoration:none}
.nav ul{display:flex;gap:1.6rem}
.nav a{position:relative;display:block;padding:.5rem 0;font-size:.95rem;font-weight:500;text-decoration:none}
.nav a::after{content:'';position:absolute;left:0;right:0;bottom:.3rem;height:1.5px;background:var(--ink);transform:scaleX(0);transform-origin:100% 50%;transition:transform .45s cubic-bezier(.16,1,.3,1)}
.nav a:hover::after{transform:scaleX(1);transform-origin:0 50%}
.hdr-actions{display:flex;align-items:center;gap:.6rem}
.hdr-cta{min-height:2.75rem;padding:.55rem 1.1rem;font-size:.95rem}
.menu>summary{border-radius:0;border:var(--rule)}
.menu-panel{border-radius:0;border-top:var(--rule);border-bottom:var(--rule);counter-reset:ch}
.menu-panel li a{display:flex;gap:1rem;align-items:baseline;font-size:2rem;font-weight:600;letter-spacing:-.05em;border-bottom:1px solid var(--line)}
.menu-panel li a::before{counter-increment:ch;content:counter(ch,decimal-leading-zero);font-family:var(--font-body);font-size:.9rem;font-weight:600;letter-spacing:0;color:var(--muted)}
.menu-panel .btn{border-radius:0}
.menu-panel{min-height:calc(100svh - 4.25rem);overflow-y:auto}
body.has-bar .menu-panel>.btn{display:none}
@media (max-width:59.99rem){.nav,.hdr-cta{display:none}}
@media (min-width:60rem){.menu{display:none}}
/* hero: the cover */
.fx-hero{padding-top:clamp(1.5rem,1rem + 2vw,3rem);padding-bottom:clamp(3rem,2rem + 4vw,6rem);overflow-x:clip}
.fx-ticks{display:grid;grid-template-columns:repeat(4,1fr);column-gap:1rem;height:.6rem;margin-bottom:1.25rem}
.fx-ticks i{border-left:1px solid var(--ink)}
.fx-ticks i:nth-child(n+5){display:none}
@media (min-width:48rem){.fx-ticks{grid-template-columns:repeat(12,1fr);column-gap:2rem}.fx-ticks i:nth-child(n+5){display:block}}
.fx-hero .fx-chap{border-top:0;padding-top:0}
.fx-hero>.wrap{position:relative}
/* the grid under the cover, dropped from the ticks by a tap (ECHO_JS); a hairline each side and a breath of the
   member's colour, nothing at rest */
.fx-grid{position:absolute;inset:0 0 auto;height:100%;display:grid;grid-template-columns:repeat(4,1fr);column-gap:1rem;pointer-events:none;z-index:0}
.fx-grid i{border-inline:1px solid color-mix(in srgb,var(--ink) 16%,transparent);background:color-mix(in srgb,var(--pop) 5%,transparent);transform:scaleY(0);transform-origin:50% 0;opacity:0}
.fx-grid i:nth-child(n+5){display:none}
@media (min-width:48rem){.fx-grid{grid-template-columns:repeat(12,1fr);column-gap:2rem}.fx-grid i:nth-child(n+5){display:block}}
html.m .fx-grid.go i{animation:fxCol 2s cubic-bezier(.16,1,.3,1) var(--d,0ms) both}
@keyframes fxCol{0%{transform:scaleY(0);opacity:1}40%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
.fx-hero .wrap>:not(.fx-grid){position:relative;z-index:1}
.fx-spec{position:relative;margin:clamp(1.5rem,1rem + 3vw,4.5rem) 0 clamp(2.5rem,2rem + 3vw,5rem);font-size:var(--fsm);line-height:.9;letter-spacing:-.065em;font-weight:600}
@media (min-width:60rem){.fx-spec{font-size:min(var(--fs),13rem);white-space:nowrap}}
/* the specimen's guides, measured for this face: cap height .71em, x-height .53em, on the last line's baseline */
.fx-guides{display:inline-block;position:relative;width:0;height:0;vertical-align:baseline}
.fx-guides i{position:absolute;left:-100vw;width:200vw;height:1px;background:color-mix(in srgb,var(--ink) 30%,transparent)}
.fx-guides .g-cap{bottom:.71em}.fx-guides .g-x{bottom:.53em}
.fx-guides .g-base{bottom:-1px;height:2px;background:var(--neon);transform-origin:0 50%}
.fx-guides .gl{display:none}
@media (min-width:60rem){.fx-guides .gl{display:block;position:absolute;left:1.25rem;width:0;height:0}
.fx-guides .gl b{position:absolute;left:0;bottom:.35rem;font-family:var(--font-body);font-size:.85rem;line-height:1;font-weight:600;letter-spacing:0;white-space:nowrap;color:var(--muted)}
.fx-guides .l-cap{bottom:.71em}.fx-guides .l-x{bottom:.53em}.fx-guides .l-base{bottom:0}.fx-guides .l-base b{color:var(--ink)}}
html.m .fx-guides .g-base{animation:fxBase 1.2s cubic-bezier(.16,1,.3,1) .9s both}
html.m .fx-guides .g-cap,html.m .fx-guides .g-x,html.m .fx-guides .gl{animation:fxFade .8s ease .5s both}
@keyframes fxBase{from{transform:scaleX(0)}}
@keyframes fxFade{from{opacity:0}}
.fx-cover{display:grid;gap:2.5rem;padding-top:1.5rem;border-top:var(--rule)}
@media (min-width:60rem){.fx-cover{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-cover-copy{grid-column:1 / span 5}.fx-plate{grid-column:6 / span 7}}
.fx-cover-copy{display:grid;gap:1.4rem;align-content:start;justify-items:start}
.fx-what{font-family:var(--font-display);font-size:clamp(1.6rem,1.2rem + 1.6vw,2.6rem);font-weight:600;line-height:1.05;letter-spacing:-.045em;max-width:16em}
.fx-plate{margin:0}
/* room for a full-bleed photograph: the plate runs to the right edge on a desktop, edge to edge on a phone */
@media (max-width:59.99rem){.fx-plate{margin-inline:-1rem}}
@media (min-width:60rem){.fx-plate{margin-right:calc(-1 * max(1rem,(100vw - var(--max)) / 2 + 1rem))}}
.fx-plate-in{overflow:hidden;aspect-ratio:14/11;background:var(--surface)}
.fx-plate-img{width:100%;height:100%;object-fit:cover}
.fx-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
@media (max-width:39.99rem){.fx-ctas .btn{flex:1 1 100%}}
/* service rows: numbered by chapter, like a guide's sections */
.fx-rows{border-top:var(--rule)}
.fx-row{display:grid;border-bottom:1px solid var(--line)}
.fx-row-top{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:.5rem 1.25rem;padding:clamp(1.3rem,1rem + 1vw,2rem) 0 .6rem}
.fx-row-n{font-size:.95rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted)}
.fx-row h3{font-size:clamp(1.8rem,1.1rem + 3vw,4.2rem);line-height:.98;letter-spacing:-.055em}
.fx-row-p{grid-column:2;font-family:var(--font-display);font-size:clamp(1.05rem,.95rem + .5vw,1.4rem);font-weight:600;letter-spacing:-.03em}
.fx-row-in{display:grid;gap:.5rem;padding:0 0 clamp(1.3rem,1rem + 1vw,2rem)}
.fx-row-in p{max-width:40rem;color:var(--muted);font-size:1.05rem}
.fx-row-d{font-variant-numeric:tabular-nums}
@media (min-width:48rem){.fx-row-top{grid-template-columns:5rem 1fr auto}.fx-row-p{grid-column:auto}.fx-row-in{padding-left:calc(5rem + 1.25rem)}}
.fx-incl{display:grid;gap:1.25rem;margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
@media (min-width:60rem){.fx-incl{grid-template-columns:16rem 1fr}}
.fx-incl h3{font-size:1.1rem;letter-spacing:-.02em}
.fx-incl ol{display:grid;gap:0;border-top:var(--rule)}
@media (min-width:48rem){.fx-incl ol{grid-template-columns:1fr 1fr;column-gap:2rem}}
.fx-incl li{display:flex;gap:1rem;align-items:baseline;padding:.75rem 0;border-bottom:1px solid var(--line);font-weight:500}
.fx-incl li span{font-size:.85rem;color:var(--muted)}
.fx-incl-big{border-top:var(--rule)}
.fx-incl-big li{display:flex;gap:1.5rem;align-items:baseline;padding:1.5rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.4rem,1rem + 1.6vw,2.4rem);font-weight:600;letter-spacing:-.04em;line-height:1.1}
.fx-incl-big span{font-size:.9rem;color:var(--muted);letter-spacing:0}
/* process: a schedule of columns under one rule that draws with the scroll */
.fx-process{padding-block:clamp(4.5rem,3rem + 5vw,8.5rem);--rm-accent:var(--pop);--rm-line:color-mix(in srgb,var(--ink) 22%,transparent)}
.fx-process .h2{font-size:clamp(2.4rem,1.4rem + 4vw,5.4rem);line-height:.95;letter-spacing:-.055em}
.fx-process .rm-head{max-width:none}
.fx-process .rm-wave,.fx-process .rm-comet{display:none!important}
.fx-process .rm-nodes{gap:0;padding-left:0;border-top:0}
.fx-process .rm-nodes::before,.fx-process .rm-nodes::after{display:block;left:0;top:0;bottom:auto;width:3px;height:100%}
.fx-process .rm-node{padding:1.25rem 0 1.5rem 1.5rem;justify-items:start;text-align:left;border-bottom:1px solid var(--line)}
.fx-process .rm-dot{position:static;width:auto;height:auto;margin:0 0 .6rem;border:0;border-radius:0;background:none;place-items:start;font-family:var(--font-display);font-size:clamp(2.6rem,2rem + 2vw,4.2rem);font-weight:600;letter-spacing:-.06em;line-height:1;color:var(--ink)}
.fx-process .rm-txt{justify-items:start}
.fx-process .rm-txt h3{font-size:clamp(1.3rem,1.1rem + .8vw,1.8rem);letter-spacing:-.04em}
.fx-process .rm-sub{max-width:20rem}
html.rm-go .fx-process .rm-node .rm-dot{transform:translateY(.5em);opacity:0;transition:transform .7s cubic-bezier(.16,1,.3,1),opacity .4s ease,color .3s ease}
html.rm-go .fx-process .rm-node.on .rm-dot{transform:none;opacity:1}
html.rm-go .fx-process .rm-node.cur .rm-dot{transform:none;background:none;color:var(--pop)}
html.rm-go .fx-process .rm-node.cur .rm-txt h3{color:var(--ink)}
@media (min-width:48rem){
.fx-process .rm-nodes{grid-template-columns:repeat(var(--n),minmax(0,1fr));column-gap:2rem}
.fx-process .rm-nodes::before,.fx-process .rm-nodes::after{width:100%;height:3px;left:0;right:0}
.fx-process .rm-nodes::after{transform-origin:0 50%}
html.rm-go .fx-process .rm-nodes::after{transform:scaleX(var(--p,0))}
.fx-process .rm-node{padding:1.75rem 0 0;border-bottom:0}
}
.fx-proc-go{margin-top:clamp(2.5rem,2rem + 2vw,4rem)}
/* about */
.fx-about{border-top:0}
.fx-about-grid{display:grid;gap:2rem}
@media (min-width:60rem){.fx-about-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem;row-gap:3rem}.fx-about-side{grid-column:1 / span 4}.fx-state{grid-column:5 / span 8}.fx-about-rest{grid-column:7 / span 6}.fx-clients{grid-column:1 / span 12}}
.fx-about-h{font-size:clamp(1.5rem,1.2rem + 1vw,2.2rem);line-height:1.05}
.fx-state{font-family:var(--font-display);font-size:clamp(2rem,1.2rem + 3.4vw,4.6rem);font-weight:600;line-height:1;letter-spacing:-.05em;text-wrap:balance}
.fx-about-rest{display:grid;gap:1rem;justify-items:start}
.fx-p{font-size:1.1rem;line-height:1.6;max-width:34rem;color:var(--muted)}
.fx-clients{display:grid;gap:1rem}
@media (min-width:60rem){.fx-clients{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-cl-h{grid-column:1 / span 4}.fx-clients-list{grid-column:5 / span 8}}
.fx-cl-h{font-size:1rem;font-weight:600;letter-spacing:0;padding-top:.7rem}
.fx-clients-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));border-top:var(--rule)}
.fx-clients-list li{padding:.9rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:clamp(1.3rem,1.1rem + .8vw,1.9rem);font-weight:600;letter-spacing:-.04em}
/* questions: set as a sheet, both columns open */
.fx-qa{border-top:var(--rule)}
.fx-qa-row{display:grid;gap:.5rem;padding:1.4rem 0;border-bottom:1px solid var(--line)}
@media (min-width:60rem){.fx-qa-row{grid-template-columns:5fr 7fr;gap:2rem}}
.fx-qa dt{font-family:var(--font-display);font-size:1.4rem;font-weight:600;letter-spacing:-.035em;line-height:1.15}
.fx-qa dd{color:var(--muted);max-width:36rem}
/* contact: the address set as the headline, the form as a brief with numbered rules */
.fx-contact .fx-head{margin-bottom:1rem}
.fx-mail-p{margin-bottom:clamp(2.5rem,2rem + 2vw,4rem);padding-bottom:1.25rem;border-bottom:var(--rule);overflow-wrap:anywhere}
.fx-mail{font-family:var(--font-display);font-size:clamp(1.8rem,1rem + 4.4vw,6rem);font-weight:600;letter-spacing:-.06em;line-height:1;text-decoration:none;background:linear-gradient(var(--pop),var(--pop)) 0 100%/0 2px no-repeat;transition:background-size .5s cubic-bezier(.16,1,.3,1)}
.fx-mail:hover{background-size:100% 2px}
.fx-contact-grid{display:grid;gap:3rem;align-items:start}
@media (min-width:60rem){.fx-contact-grid{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:2rem}.fx-contact-copy{grid-column:1 / span 4}.fx-form{grid-column:6 / span 7}}
.fx-contact-copy{display:grid;gap:1.25rem;justify-items:start}
.fx-promise{padding-top:1rem;border-top:1px solid var(--line);color:var(--muted)}
.fx-contact-list{font-size:1.05rem}
.fx-form h3{margin-bottom:1rem;font-size:1rem;font-weight:600;letter-spacing:0}
.fx-form form{counter-reset:f}
.fx-form .field{position:relative;padding-top:.6rem;border-top:var(--rule)}
.fx-form .field>label{counter-increment:f}
.fx-form .field>label::before{content:counter(f,decimal-leading-zero);display:inline-block;min-width:2.2rem;font-variant-numeric:tabular-nums;color:var(--muted)}
.field input,.field select,.field textarea{border-radius:0;border:0;border-bottom:1px solid var(--line);background:transparent;padding-inline:0}
.field input:focus,.field select:focus,.field textarea:focus{box-shadow:0 1.5px 0 var(--ink);outline-offset:2px}
.field textarea{border:1px solid var(--line);padding-inline:.8rem}
/* footer: the colophon */
.fx-ftr{padding-block:clamp(3rem,2rem + 3vw,5rem) 6.5rem}
@media (min-width:60rem){.fx-ftr{padding-bottom:3rem}}
.fx-colo{border-bottom:1px solid var(--line)}
.fx-colo div{display:grid;gap:.25rem 2rem;padding-block:.9rem;border-top:1px solid var(--line)}
@media (min-width:48rem){.fx-colo div{grid-template-columns:minmax(0,3fr) minmax(0,9fr)}}
.fx-colo dt{font-weight:600}
.fx-colo dd{color:var(--muted)}
.fx-colo a{color:var(--ink);text-decoration-color:var(--line);text-underline-offset:3px}
.fx-colo-pages{display:flex;flex-wrap:wrap;gap:.2rem 1.4rem;counter-reset:fl}
.fx-colo-pages a{display:inline-block;padding-block:.35rem;text-decoration:none}
.fx-colo-pages a::before{counter-increment:fl;content:counter(fl,decimal-leading-zero) ' ';font-variant-numeric:tabular-nums;color:var(--muted)}
.fx-colo-pages a:hover{text-decoration:underline}
.fx-colo-c{margin-top:1.2rem;font-size:.9rem;color:var(--muted)}
.fx-ftr>.legal-links{width:min(100% - 2rem,var(--max));margin-inline:auto;text-align:left}
.fx-ftr>.mpause{margin-left:max(1rem,calc((100% - var(--max)) / 2))}
.mbar{border-top:var(--rule);border-radius:0}
.mbar .btn{border-radius:0}
/* the reversed pages: bone ink on the near black sheet; the buttons stay ink on paper, now bone on black */
html[data-theme="dark"]{--ink:#efece5}
`;

module.exports = {
  id,
  kind: 'agency',
  name: 'Foundry',
  bestFor: 'Agencies, consultants and studios that sell to other businesses: branding, web, marketing, automation, bookkeeping',
  why: 'Built for business to business services and set like your own brand guide: your name as a type specimen on the cover, every section a numbered chapter, services and prices as big rows, your process as a schedule that draws itself as you scroll, and a project brief form.',
  fonts: { q: 'family=Schibsted+Grotesk:wght@500..800&family=Instrument+Sans:wght@400..600&family=Instrument+Serif:ital@1', display: ['Schibsted Grotesk', 'grotesk'], body: ['Instrument Sans', 'sans'] },
  // The motion, as data (lib/choreo.md): type set on the grid, a plate that leans in, a process you scroll through.
  choreo: { intro: 'mask', alive: ['scroll'], scroll: 'roadmap', pace: 'medium', look: 'Swiss poster stock, a brand guide cover, type rising from its baseline' },
  modes: ['light', 'dark'],
  tokens,
  slots,
  nav,
  render,
  art,
};
