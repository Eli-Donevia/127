// Ad pixels only after consent (Legal decision L7; legal/handoffs/website.md item 2; legal/08-cookie-notice.md Part C).
//
// Meta Pixel, TikTok Pixel and Klaviyo onsite never load from a page directly. Every page outputs configScript(req):
// the window.C127_CONSENT config plus public/js/consent.js (Legal's tested script, copied unchanged). The script shows
// the banner only when an ad tool is configured, loads the tools only after "Accept", treats Global Privacy Control and
// Do Not Track as "Reject", never loads them for signed-in members or on member-app paths, and opens the Cookie settings
// panel from any [data-cookie-settings] link. Plausible is cookieless and runs without it.
//
// EJS pages get the same config from partials/doc-start.ejs; the static funnel pages get configScript() from lib/funnels.js.
//
// Env: META_PIXEL_ID, TIKTOK_PIXEL_ID, KLAVIYO_PUBLIC_KEY (any of them turns the banner on), COOKIE_DOMAIN (.127group.io).
//
// Legal L43 switch-on order: no pixel IDs and no Meta server events until the real /privacy and /cookies are live
// (PRIVACY_LIVE=true and COOKIE_NOTICE_LIVE=true). Until then the IDs are ignored even if set.
//
// Legal L87 LV3: no ad pixels (Meta, TikTok, Klaviyo onsite) or Meta server events on any 127group.io page while
// Life in HQ is on, for everyone or for admins (HQ_LIFE not off). The IDs are ignored even if set.

const lifeOn = () => !['', 'off', 'false'].includes(String(process.env.HQ_LIFE || '').trim().toLowerCase());

function pixelsAllowed() {
  return process.env.PRIVACY_LIVE === 'true' && process.env.COOKIE_NOTICE_LIVE === 'true' && !lifeOn();
}
function metaPixelId() {
  return pixelsAllowed() ? process.env.META_PIXEL_ID || '' : '';
}
function tools() {
  if (!pixelsAllowed()) return { metaPixelId: '', tiktokPixelId: '', klaviyoPublicKey: '' };
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

module.exports = { pixelsAllowed, metaPixelId, tools, config, configScript, serverSideAllowed, inlineJson };
