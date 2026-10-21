// Facts plus approved words, shaped for a design: which button is the main action, which sections
// exist, the menu links and the image slots. One object (c) that every template reads.

const { text } = require('../../_kit');
const { getTemplate } = require('./templates');
const copyLib = require('./copy');

function formLink(label, id) {
  return { label, short: label, href: `#${id}`, kind: 'form' };
}

function bookingAction(f) {
  return f.booking ? { label: f.booking.label, short: f.booking.kind === 'reserve' ? 'Reserve' : 'Book', href: f.booking.href, kind: f.booking.kind } : null;
}

// The main action and a second one, per design.
function actions(f, tpl) {
  const phone = f.phone ? { label: `Call ${f.phone.display}`, short: 'Call', href: f.phone.href, kind: 'phone' } : null;
  const book = bookingAction(f);
  let primary = null;
  let secondary = null;
  if (tpl === 'restaurant') {
    const order = f.orderLinks[0];
    if (order) primary = f.orderLinks.length > 1 ? { label: 'Order online', short: 'Order', href: '#order', kind: 'order' } : { label: order.label, short: 'Order', href: order.href, kind: 'order' };
    else if (book) primary = book;
    else if (phone) primary = { ...phone, label: 'Call to order' };
    else if (f.mapsUrl) primary = { label: 'Get directions', short: 'Directions', href: f.mapsUrl, kind: 'maps' };
    if (order && book) secondary = book;
    else if (f.menu.length) secondary = { label: 'See the menu', href: '#menu' };
    else if (f.mapsUrl && primary && primary.kind !== 'maps') secondary = { label: 'Get directions', href: f.mapsUrl };
  } else if (tpl === 'product') {
    primary = f.buy ? { label: f.buy.label, short: f.buy.label, href: f.buy.href, kind: 'buy' } : formLink('Join the waitlist', 'signup');
    secondary = f.included.length ? { label: "See what's inside", href: '#features' } : f.faqCount ? { label: 'Questions', href: '#faq' } : null;
  } else if (tpl === 'creator') {
    primary = f.links[0] ? { label: f.links[0].label, href: f.links[0].href, kind: f.links[0].kind } : null;
  } else if (tpl === 'local-service') {
    primary = book || formLink('Get a quote', 'quote');
    secondary = phone || (f.services.length ? { label: 'See prices', href: '#services' } : null);
  } else if (tpl === 'studio') {
    primary = book || (phone ? { ...phone, label: f.profile.id === 'florist' ? 'Call to order' : 'Call to book', short: 'Call' } : formLink(f.profile.id === 'florist' ? f.profile.book : 'Request a time', 'contact'));
    secondary = f.services.length ? { label: 'See prices', href: '#menu' } : phone && book ? phone : null;
  } else if (tpl === 'coach') {
    primary = book || formLink('Get in touch', 'contact');
    secondary = f.services.length || f.offer ? { label: 'See the offer', href: '#offer' } : null;
  } else if (tpl === 'agency') {
    primary = book || formLink('Start a project', 'contact');
    secondary = f.services.length ? { label: 'See services', href: '#services' } : null;
  } else if (tpl === 'portfolio') {
    primary = book || formLink(/^(work|start|book|hire)/i.test(f.profile.book || '') ? f.profile.book : 'Work with me', 'contact');
    secondary = { label: 'See the work', href: '#work' };
  }
  if (primary && !primary.short) primary.short = primary.label;
  return { primary, secondary, phoneAction: phone };
}

// c: everything a template renders from.
// An animated design names the kind of business it's for (T.kind, one of the 8 designs' ids): the words, buttons and
// sections follow the kind, and the look follows the design (c.design).
function buildContent(f, designId, copy) {
  const T = getTemplate(designId);
  const tplId = T.kind || designId;
  const words = copyLib.wordsKind(f, tplId);
  const draft = copyLib.draftCopy(f, words);
  const k = { ...draft, ...(copy || {}) };
  const blurbs = new Map((k.services || []).map((s) => [String(s.name || '').toLowerCase(), s.blurb]));
  const services = f.services.map((s) => ({ ...s, blurb: blurbs.has(s.name.toLowerCase()) ? blurbs.get(s.name.toLowerCase()) : s.description || '' }));
  const c = {
    ...f,
    template: tplId,
    design: designId,
    productName: f.productName || (tplId === 'product' ? text.sentenceCase(f.offer || f.name) : ''),
    whatShort: copyLib.whatOf(f),
    areaLine: f.area,
    heroTitle: k.heroTitle,
    heroSub: k.heroSub,
    about: k.about,
    aboutParas: String(k.about || '').split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean),
    services,
    steps: k.steps || [],
    faq: k.faq || [],
    ctaTitle: k.ctaTitle,
    ctaSub: k.ctaSub,
    seo: { title: k.seoTitle, description: k.seoDescription },
    footerLine: [text.sentenceCase(copyLib.whatOf(f)), f.online ? '' : f.area].filter(Boolean).join(' in '),
    images: {},
  };
  c.faqCount = c.faq.length;
  Object.assign(c, actions({ ...f, faqCount: c.faqCount }, words));
  // Image slots: abstract art in the member's colors until they add their photos (same file names).
  for (const s of T.slots(c)) c.images[s.slot] = { ...s, src: `images/${s.file}` };
  c.nav = T.nav(c);
  return c;
}

module.exports = { buildContent, actions };
