// The site's own privacy notice (privacy.html) and, for a store, its shipping and returns page (policies.html).
// Legal L76 W1 and W3: Legal's starter (legal/templates/member-site-privacy-notice.md), built from blocks, one per
// feature the site uses, with the Store's {{token|fallback}} values filled from the facts. The text is the business's
// own ("we" is the member). "Starter, not legal advice" shows to the member (README and the build result), never on
// the page. A site doesn't publish without a name and an email, and a store not without both of its policies.

const { files, time } = require('../../_kit');

const esc = files.esc;

// Service names for the notice, from the links the member gave. Anything else keeps the notice's fallback.
const SERVICES = [
  [/calendly\.com/i, 'Calendly'], [/cal\.com/i, 'Cal.com'], [/acuityscheduling|squarespacescheduling/i, 'Acuity Scheduling'],
  [/setmore/i, 'Setmore'], [/simplybook/i, 'SimplyBook.me'], [/tidycal/i, 'TidyCal'], [/vagaro/i, 'Vagaro'], [/booksy/i, 'Booksy'],
  [/fresha/i, 'Fresha'], [/glossgenius/i, 'GlossGenius'], [/styleseat/i, 'StyleSeat'], [/mindbody/i, 'Mindbody'], [/janeapp/i, 'Jane'],
  [/squareup|square\.site|square\.link/i, 'Square'], [/opentable/i, 'OpenTable'], [/resy\.com/i, 'Resy'], [/exploretock/i, 'Tock'],
  [/sevenrooms/i, 'SevenRooms'], [/stripe\.com/i, 'Stripe'], [/paypal/i, 'PayPal'], [/gumroad/i, 'Gumroad'],
  [/lemonsqueezy/i, 'Lemon Squeezy'], [/stan\.store/i, 'Stan'], [/payhip/i, 'Payhip'], [/ko-fi/i, 'Ko-fi'],
  [/myshopify\.com|shopify/i, 'Shopify'], [/etsy\.com/i, 'Etsy'], [/bigcartel/i, 'Big Cartel'],
];
const serviceOf = (url) => ((SERVICES.find(([re]) => re.test(String(url || ''))) || [])[1] || '');

// Legal's blocks, word for word. Each is [id, when(ctx) or true, markdown].
const BLOCKS = [
  ['intro', true, 'This notice explains what {{business.name}} collects through {{links.website|this website}}, how we use it, and the choices you have. Questions? Email us at {{contact.email}}.'],
  ['contact_us', true, '**When you contact us.** If you write to us through our contact form, by email or by phone, we get your name, your contact details and your message. We use them to reply and to help you.'],
  ['booking', (x) => x.booking, '**When you book with us.** If you book through {{tools.booking|our booking calendar}}, it collects your name, email, the time you pick and your answers to its questions, and shares them with us so we can prepare. Its own privacy policy also applies.'],
  ['email_list', (x) => x.signup, '**Our email list.** If you sign up, we use your email to send what you signed up for. Every email has an unsubscribe link, and you can leave anytime. We send our emails through {{tools.email|our email service}}.'],
  ['store', (x) => x.store, "**When you buy from us.** We collect your name, email, shipping and billing address, your phone number if you give it, and what you bought. We use them to fill your order, send receipts and updates, and handle returns. {{tools.payments|Our payment processor}} handles your payment, and we never see or keep your full card number."],
  ['technical', true, '**When you visit.** Like most websites, ours runs on a hosting service, {{site.host|our website host}}, that keeps basic technical logs, like your IP address, your browser and the pages you visit, to keep the site working and secure. Our site stores only what it needs in your browser to work.'],
  ['no_tracking', true, "**Cookies and tracking.** We don't use advertising or analytics cookies, and we don't track you across other websites. So our site works the same whether or not your browser sends a Do Not Track or Global Privacy Control signal."],
  ['embeds', (x) => x.embeds, "**Content from other services.** Some pages show content from other services, like a map, a video or a booking calendar. When you view it, that service may collect information about your visit, such as your IP address, under its own privacy policy."],
  ['sharing', true, null],
  ['keep', true, '**How long we keep it.** We keep your information only as long as we need it for the reason you gave it to us, like replying to you or serving you as a customer, or as long as the law requires, like tax records for a purchase. Then we delete it.'],
  ['choices', true, "**Your choices.** You can ask us what information we have about you, or ask us to correct it, delete it, or never sell it. Email {{contact.email}}, and we'll reply within 45 days. We may need to confirm it's you first. Some information we have to keep, like records of a purchase for taxes, and we'll tell you if so. We won't treat you differently for asking."],
  ['kids', true, "**Children.** Our site isn't meant for children under 13, and we don't knowingly collect their information. If you think a child has given us information, email us and we'll delete it."],
  ['security', true, "**Keeping it safe.** We use reasonable safeguards, and so do the services we use, but no website is perfectly secure. We never ask for health information or passwords, and we never ask for card numbers outside a secure checkout. Please don't send any of these through our forms, email or chat."],
  ['changes', true, "**Changes.** If we change this notice, we'll post the new version here with a new date. If we change how we use your information in a big way, we'll say so on our homepage, or email you if we have your address, before the change applies."],
  ['contact', true, null],
];

function sharing(x, v) {
  const lines = ['our website host, {{site.host|our website host}}'];
  if (x.signup) lines.push('our email service, {{tools.email|our email service}}');
  if (x.booking) lines.push('our booking service, {{tools.booking|our booking calendar}}');
  if (x.store) lines.push(v['tools.payments'] && v['tools.payments'] === v['tools.store'] ? '{{tools.payments}}, to take payments and fill orders' : '{{tools.payments|our payment processor}} and {{tools.store|our store platform}}, to take payments and fill orders');
  return `**Who we share it with.** We share your information only with companies that help us run our business, and only so they can do that work for us:\n\n${lines.map((l, i) => `- ${l}${i === lines.length - 1 ? '.' : ';'}`).join('\n')}\n\nWe may also share information when the law requires it, to protect our rights or someone's safety, or as part of selling our business. We don't sell your information or share it with other companies for their advertising.`;
}

// What the site uses, read from its facts and its own page.
function featuresOf(c, html = '') {
  return {
    booking: !!c.booking,
    signup: /id="f-signup"/.test(html),
    store: !!c.buy,
    embeds: /<iframe\b/i.test(html),
  };
}

function values(c) {
  const host = c.formMode === 'email' ? '' : 'Netlify';
  return {
    'business.name': c.name, 'business.address': c.address, 'contact.email': c.email, 'contact.phone': c.phone ? c.phone.display : '',
    'links.website': c.canonical ? c.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : '', today: time.longDate(c.today),
    'site.host': host, 'tools.booking': c.booking ? serviceOf(c.booking.href) : '', 'tools.payments': c.buy ? serviceOf(c.buy.href) : '',
    'tools.store': c.buy ? serviceOf(c.buy.href) : '', 'tools.email': '',
  };
}
const fill = (s, v) => s.replace(/\{\{([a-z.]+)(?:\|([^}]*))?\}\}/g, (_, k, fb) => (v[k] ? v[k] : fb || ''));

// The little markdown Legal's text uses: paragraphs, "- " lists, **bold** and [links](url). Escapes everything else.
function md(s) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return s.split(/\n{2,}/).map((p) => (/^- /.test(p) ? `<ul>${p.split('\n').map((l) => `<li>${inline(l.replace(/^- /, ''))}</li>`).join('')}</ul>` : `<p>${inline(p)}</p>`)).join('\n');
}

// Returns { blocks: [ids], html } for privacy.html's body.
function privacyNotice(c, html = '') {
  const x = featuresOf(c, html), v = values(c), out = [], ids = [];
  for (const [id, when, text] of BLOCKS) {
    if (when !== true && !when(x)) continue;
    ids.push(id);
    if (id === 'sharing') out.push(md(fill(sharing(x, v), v)));
    else if (id === 'contact') out.push(`<p><strong>Contact us.</strong> ${[c.name, c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '', c.address, c.phone ? c.phone.display : ''].filter(Boolean).map((p, i) => (i === 1 ? p : esc(p))).join(' · ')}</p>`);
    else out.push(md(fill(text, v)));
  }
  return { blocks: ids, features: x, html: `<p class="doc-date">Last updated ${esc(v.today)}</p>\n${out.join('\n')}` };
}

// A store's shipping and returns page, in the member's own words. Null when there's no store.
function policiesPage(c) {
  if (!c.buy) return null;
  const para = (t) => String(t || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('\n');
  return `<h2 id="shipping">Shipping</h2>\n${para(c.shipping)}\n<h2 id="returns">Refunds and returns</h2>\n${para(c.returns)}\n<p>Questions about an order? Email <a href="mailto:${esc(c.email || '')}">${esc(c.email || '')}</a>.</p>`;
}

// What has to be filled in before the site goes online (Legal L76 W1, W3). Empty means ready.
function blockers(c) {
  const out = [];
  if (!c.name) out.push('Add your business name.');
  if (!c.email) out.push('Add your email: your privacy notice has to tell visitors how to reach you.');
  if (c.buy && !c.shipping) out.push('Add your shipping policy (how and when orders ship): a store has to post it.');
  if (c.buy && !c.returns) out.push('Add your refund and return policy: a store has to post it, even if it is "all sales final".');
  return out;
}

const STARTER_LABEL = "Starter privacy notice, not legal advice. Make sure it says what your site and business really do. If your site asks about health, uses ad tags, or serves customers outside the US, it needs more than this starter.";

// The footer links every page gets: Privacy, and Shipping and returns for a store.
function legalLinks(c) {
  return `<p class="legal-links"><a href="privacy.html">Privacy</a>${c.buy ? ' · <a href="policies.html">Shipping and returns</a>' : ''}</p>`;
}
function withLegalLinks(body, c) {
  const links = legalLinks(c);
  const at = body.lastIndexOf('</footer>');
  return at >= 0 ? `${body.slice(0, at)}${links}\n${body.slice(at)}` : `${body}\n<footer class="legal-foot">${links}</footer>`;
}
const LEGAL_CSS = '.legal-links{margin:1rem 0 0;font-size:.85rem;text-align:center}.legal-links a{color:inherit;opacity:.8;text-decoration:underline;text-underline-offset:2px}.legal-links a:hover{opacity:1}.legal-foot{padding:1.5rem 1rem 2rem}';

module.exports = { privacyNotice, policiesPage, blockers, featuresOf, withLegalLinks, legalLinks, LEGAL_CSS, STARTER_LABEL, serviceOf, BLOCKS };
