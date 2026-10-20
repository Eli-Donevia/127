// HTML pieces the designs share: header with a CSS-only menu, the contact form (Netlify Forms, or
// plain email), FAQ accordions, hours, contact lines, socials, the phone action bar and the footer.
// All static HTML: nothing here needs JavaScript. Text is escaped here; callers pass plain text.

const { files, text } = require('../../_kit');
const { icon, iconForLink, SOCIAL_LABEL } = require('./icons');

const esc = files.esc;
const HONEYPOT = 'company-website';

function monogram(name) {
  return text.initials(String(name || '').replace(/['\u2019]/g, ''), String(name || '').trim().split(/\s+/).length > 1 ? 2 : 1) || 'S';
}

function linkAttrs(l) {
  return `href="${esc(l.href)}"`;
}

function navItems(nav) {
  return (nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
}

// The header: brand, desktop nav, a call to action and a details/summary menu for phones.
function header(c, { cls = '', cta = c.primary, ctaCls = 'btn btn-primary', mark = true, extra = '' } = {}) {
  const brand = `<a class="brand" href="#top">${mark ? `<span class="mark" aria-hidden="true">${esc(monogram(c.name))}</span>` : ''}<span class="brand-name">${esc(c.name)}</span></a>`;
  const ctaHtml = cta ? `<a class="${ctaCls} hdr-cta" ${linkAttrs(cta)}>${esc(cta.label)}</a>` : '';
  const menu = c.nav && c.nav.length
    ? `<details class="menu"><summary>${icon('menu', { cls: 'i i-open', size: 22 })}${icon('close', { cls: 'i i-close', size: 22 })}<span class="sr-only">Menu</span></summary>
<div class="menu-panel"><nav aria-label="Menu"><ul>${navItems(c.nav)}</ul></nav>${cta ? `<a class="btn btn-primary" ${linkAttrs(cta)}>${esc(cta.label)}</a>` : ''}</div></details>`
    : '';
  return `<header class="hdr ${cls}">
<div class="wrap hdr-in">
${brand}
${c.nav && c.nav.length ? `<nav class="nav" aria-label="Main"><ul>${navItems(c.nav)}</ul></nav>` : ''}
<div class="hdr-actions">${extra}${ctaHtml}
${menu}
</div>
</div>
</header>`;
}

// ---------- form ----------

const FIELD_PRESETS = {
  name: { name: 'name', label: 'Your name', type: 'text', auto: 'name', required: true, half: true },
  email: { name: 'email', label: 'Email', type: 'email', auto: 'email', required: true, half: true },
  phone: { name: 'phone', label: 'Phone', type: 'tel', auto: 'tel', half: true },
  address: { name: 'address', label: 'Address or neighborhood', type: 'text', auto: 'street-address', half: true },
  when: { name: 'when', label: 'Best day and time', type: 'text', half: true },
  date: { name: 'date', label: 'Date', type: 'date', half: true },
  guests: { name: 'guests', label: 'How many people', type: 'number', half: true },
  company: { name: 'company', label: 'Business name', type: 'text', auto: 'organization', half: true },
  website: { name: 'site', label: 'Your website', type: 'url', half: true },
  message: { name: 'message', label: 'Anything we should know', type: 'textarea' },
};

function field(f, formId) {
  const id = `${formId}-${f.name}`;
  const req = f.required ? ' required' : '';
  const label = `<label for="${id}">${esc(f.label)}${f.required ? '' : ' <span class="opt">(optional)</span>'}</label>`;
  if (f.type === 'textarea') return `<div class="field">${label}<textarea id="${id}" name="${esc(f.name)}" rows="5"${req}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}></textarea></div>`;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => `<option>${esc(o)}</option>`).join('');
    return `<div class="field">${label}<select id="${id}" name="${esc(f.name)}"${req}><option value="">Choose one</option>${opts}</select></div>`;
  }
  const mode = f.type === 'tel' ? ' inputmode="tel"' : f.type === 'number' ? ' inputmode="numeric" min="1"' : '';
  return `<div class="field">${label}<input id="${id}" name="${esc(f.name)}" type="${f.type || 'text'}"${f.auto ? ` autocomplete="${f.auto}"` : ''}${mode}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${req}></div>`;
}

function fieldsHtml(fields, formId) {
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const next = fields[i + 1];
    if (f.half && next && next.half) {
      out.push(`<div class="row">${field(f, formId)}${field(next, formId)}</div>`);
      i += 1;
    } else out.push(field(f, formId));
  }
  return out.join('\n');
}

// fields: preset names or field objects. Netlify Forms when the site is on Netlify (the default);
// a plain email form (opens the visitor's mail app) when the member picked email.
function form(c, { id = 'quote', fields = ['name', 'email', 'phone', 'message'], submit = 'Send', subject = 'New message from your website', cls = '', note = true } = {}) {
  const list = fields.map((f) => (typeof f === 'string' ? FIELD_PRESETS[f] : f)).filter(Boolean);
  const formId = `f-${id}`;
  const email = c.email;
  const netlify = c.formMode !== 'email' || !email;
  const open = netlify
    ? `<form class="form ${cls}" id="${formId}" name="${esc(id)}" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="${HONEYPOT}">
<input type="hidden" name="form-name" value="${esc(id)}">
<p class="hp" aria-hidden="true"><label>Leave this empty <input name="${HONEYPOT}" tabindex="-1" autocomplete="off"></label></p>`
    : `<form class="form ${cls}" id="${formId}" action="mailto:${esc(email)}?subject=${encodeURIComponent(subject)}" method="post" enctype="text/plain">`;
  // An email signup says what people will get, and that they can leave (Legal L76 W2).
  // Under every form: what the details are for, and the site's privacy notice (Legal L76 W1).
  const purpose = id === 'signup' ? 'send what you signed up for' : /book|reserv/.test(id) ? 'book your visit' : 'reply to you';
  const promise = `<p class="form-note">${id === 'signup' ? `You'll get an email from ${esc(c.name || 'us')} when it's ready, and the odd update. Unsubscribe anytime. ` : ''}We'll only use this to ${purpose}. <a href="privacy.html">Privacy</a></p>`;
  const alt = [];
  if (note && c.phone) alt.push(`Prefer to talk? Call <a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a>`);
  if (note && email) alt.push(`${alt.length ? 'or email' : 'Prefer email? Write to'} <a href="mailto:${esc(email)}?subject=${encodeURIComponent(subject)}">${esc(email)}</a>`);
  return `${open}
${fieldsHtml(list, formId)}
<button class="btn btn-primary btn-lg btn-block" type="submit">${esc(submit)}${icon('arrow', { size: 18 })}</button>
${promise}${alt.length ? `<p class="form-note">${alt.join(' ')}.</p>` : ''}
</form>`;
}

// ---------- small sections ----------

function faq(items) {
  if (!items || !items.length) return '';
  return `<div class="faq">
${items.map((q) => `<details><summary><span>${esc(q.q)}</span>${icon('plus', { size: 20 })}</summary><div class="ans"><p>${esc(q.a)}</p></div></details>`).join('\n')}
</div>`;
}

function hours(rows, cls = '') {
  if (!rows || !rows.length) return '';
  return `<dl class="hours ${cls}">${rows.map((r) => `<div><dt>${esc(r.days)}</dt><dd>${esc(r.time)}</dd></div>`).join('')}</dl>`;
}

function socials(c, { cls = '', size = 20 } = {}) {
  const entries = Object.entries(c.socials || {});
  if (!entries.length) return '';
  return `<ul class="socials ${cls}">${entries
    .map(([k, href]) => `<li><a href="${esc(href)}">${icon(k, { size })}<span class="sr-only">${esc(c.name)} on ${esc(SOCIAL_LABEL[k] || k)}</span></a></li>`)
    .join('')}</ul>`;
}

function contactList(c, { cls = '', showHours = true } = {}) {
  const li = [];
  if (c.phone) li.push(`<li>${icon('phone')}<div><a href="${esc(c.phone.href)}">${esc(c.phone.display)}</a></div></li>`);
  if (c.email) li.push(`<li>${icon('mail')}<div><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>`);
  if (c.address) li.push(`<li>${icon('pin')}<div>${c.mapsUrl ? `<a href="${esc(c.mapsUrl)}">${esc(c.address)}</a>` : esc(c.address)}</div></li>`);
  else if (c.area && !c.online) li.push(`<li>${icon('pin')}<div>${esc(c.areaLine)}</div></li>`);
  if (showHours && c.hoursLine) li.push(`<li>${icon('clock')}<div>${esc(c.hoursLine)}</div></li>`);
  if (!li.length) return '';
  return `<ul class="contact-list ${cls}">${li.join('')}</ul>`;
}

// Phone action bar (hidden on wide screens): Call plus the main action.
function mobileBar(c) {
  const acts = [];
  if (c.phone) acts.push(`<a class="btn btn-ghost" href="${esc(c.phone.href)}">${icon('phone', { size: 18 })}Call</a>`);
  if (c.primary && !/^tel:/.test(c.primary.href)) acts.push(`<a class="btn btn-primary" ${linkAttrs(c.primary)}>${esc(c.primary.short || c.primary.label)}</a>`);
  else if (c.email && !c.phone) acts.push(`<a class="btn btn-primary" href="mailto:${esc(c.email)}">${icon('mail', { size: 18 })}Email</a>`);
  if (!acts.length) return '';
  return `<nav class="mbar" aria-label="Quick actions">${acts.join('')}</nav>`;
}

function footer(c, { cls = '', note = '' } = {}) {
  const links = (c.nav || []).map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join('');
  return `<footer class="ftr ${cls}">
<div class="wrap ftr-in">
<div class="ftr-brand"><p class="ftr-name">${esc(c.name)}</p>${c.footerLine ? `<p class="ftr-line">${esc(c.footerLine)}</p>` : ''}${socials(c, { cls: 'ftr-social', size: 18 })}</div>
${links ? `<nav aria-label="Footer"><ul class="ftr-links">${links}</ul></nav>` : ''}
${contactList(c, { cls: 'ftr-contact' })}
</div>
<div class="wrap ftr-base"><p>&copy; ${esc(c.year)} ${esc(c.name)}</p>${note ? `<p>${esc(note)}</p>` : ''}</div>
</footer>`;
}

// Member-provided reviews only. With none, the section is left out.
function reviews(c, { cls = '' } = {}) {
  if (!c.reviews || !c.reviews.length) return '';
  return `<div class="reviews ${cls}">${c.reviews
    .map((r) => `<figure class="review"><blockquote><p>${esc(r.quote)}</p></blockquote>${r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ''}</figure>`)
    .join('\n')}</div>`;
}

function img(c, slot, { cls = '', eager = false, sizes } = {}) {
  const im = c.images[slot];
  if (!im) return '';
  return `<img class="${cls}" src="${esc(im.src)}" alt="${esc(im.alt)}" width="${im.w}" height="${im.h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`;
}

function button(l, cls = 'btn btn-primary', withIcon = '') {
  if (!l) return '';
  return `<a class="${cls}" ${linkAttrs(l)}>${withIcon ? icon(withIcon, { size: 18 }) : ''}${esc(l.label)}</a>`;
}

function linkIcon(l, size = 20) {
  return icon(iconForLink(l), { size });
}

module.exports = { esc, header, form, faq, hours, socials, contactList, mobileBar, footer, reviews, img, button, linkIcon, monogram, field, FIELD_PRESETS, HONEYPOT };
