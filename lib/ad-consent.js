// Ad pixels only after consent (Legal decision L7; legal/handoffs/website.md item 2; legal/08-cookie-notice.md Part C)
// and the footer legal links with the earnings line (website.md item 3).
//
// Meta Pixel, TikTok Pixel and Klaviyo onsite never load from a page directly. Every page outputs configScript(req):
// the window.C127_CONSENT config plus public/js/consent.js (Legal's tested script, copied unchanged). The script shows
// the banner only when an ad tool is configured, loads the tools only after "Accept", treats Global Privacy Control and
// Do Not Track as "Reject", never loads them for signed-in members or on member-app paths, and opens the Cookie settings
// panel from any [data-cookie-settings] link. Plausible is cookieless and runs without it.
//
// EJS pages get it from partials/doc-start.ejs (res.locals.adConsentScript); the static funnel pages from lib/funnels.js.
//
// Env: META_PIXEL_ID, TIKTOK_PIXEL_ID, KLAVIYO_PUBLIC_KEY (any of them turns the banner on), COOKIE_DOMAIN (.127group.io).

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function tools() {
  return { metaPixelId: process.env.META_PIXEL_ID || '', tiktokPixelId: process.env.TIKTOK_PIXEL_ID || '', klaviyoPublicKey: process.env.KLAVIYO_PUBLIC_KEY || '' };
}
const inlineJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function config(loggedIn) {
  return { ...tools(), loggedIn: !!loggedIn, cookieDomain: process.env.COOKIE_DOMAIN || '', noticeUrl: '/cookies' };
}

function configScript(req) {
  return `<script>window.C127_CONSENT=${inlineJson(config(req && req.user))};</script>\n<script src="/js/consent.js" defer></script>`;
}

// Server-side events (Meta Conversions API) need the same consent as the pixel: the page says the visitor accepted
// (body.ad_consent === true, from window.c127Consent.ads()) and the 127_consent cookie starts with v1.ads1.
// A Global Privacy Control header or a signed-in member also means no.
function serverSideAllowed(req) {
  const m = String((req && req.headers && req.headers.cookie) || '').match(/(?:^|;\s*)127_consent=([^;]*)/);
  let c = '';
  try { c = m ? decodeURIComponent(m[1]) : ''; } catch (e) { c = ''; }
  const gpc = !!(req && req.headers && req.headers['sec-gpc'] === '1');
  return !!(req && req.body && req.body.ad_consent === true) && c.startsWith('v1.ads1') && !gpc && !(req && req.user);
}

// views/partials/legal-footer.ejs as a string, for pages that aren't EJS (the static funnel pages).
const FOOTER = path.join(__dirname, '..', 'views', 'partials', 'legal-footer.ejs');
function legalFooter(locals = {}) {
  return ejs.render(fs.readFileSync(FOOTER, 'utf8'), { privacyTerms: false, ...locals }, { filename: FOOTER });
}

module.exports = { tools, config, configScript, serverSideAllowed, legalFooter, inlineJson };
