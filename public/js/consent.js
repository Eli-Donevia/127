/*! 127 cookie consent (v1). Proposed by the Legal thread for the Website and Funnels threads.
 *
 * What it does
 * - Shows a small banner only when there's something to ask about (an ad pixel or Klaviyo onsite key
 *   is configured), the visitor hasn't chosen yet, and the browser sends no privacy signal.
 * - Loads the Meta Pixel, the TikTok Pixel and Klaviyo's onsite script ONLY after "Accept",
 *   never for signed-in members, and never on member-app paths.
 * - Treats Global Privacy Control (GPC) and Do Not Track (DNT) as "Reject" and never asks.
 * - Remembers the choice for 12 months in a first-party cookie the server can read:
 *     127_consent=v1.ads1.<unix seconds>   (ads0 = rejected, "sig" in place of ads0 = signal)
 * - Exposes window.c127Consent: ads() -> boolean, open() -> opens settings, onChange(fn).
 *   Any element with [data-cookie-settings] opens the settings panel (use it for the footer link).
 *
 * Configure BEFORE this script loads (the server renders it):
 *   <script>window.C127_CONSENT = {
 *     metaPixelId: "", tiktokPixelId: "", klaviyoPublicKey: "",
 *     loggedIn: false,                 // true for any signed-in member: no ad tools at all
 *     cookieDomain: "",                // e.g. ".127group.io" if 127group.io and app.127group.io share the choice
 *     noticeUrl: "/cookies"
 *   };</script>
 *   <script src="/js/consent.js" defer></script>
 */
(function () {
  'use strict';
  var CFG = window.C127_CONSENT || {};
  var COOKIE = '127_consent';
  var VERSION = 'v1';
  var MAX_AGE = 365 * 24 * 60 * 60; // 12 months, then we ask again
  // Member-app and account paths never get ad tools, even with consent.
  var BLOCKED_PATHS = /^\/(app|admin|login|logout|forgot|reset|verify|billing)(\/|$)/;
  var listeners = [];
  var loaded = false;

  function hasAdTools() {
    return !!(CFG.metaPixelId || CFG.tiktokPixelId || CFG.klaviyoPublicKey);
  }
  function privacySignal() {
    try {
      if (navigator.globalPrivacyControl === true) return 'gpc';
      var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes') return 'dnt';
    } catch (e) {}
    return null;
  }
  function readChoice() {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    var parts = decodeURIComponent(m[1]).split('.');
    if (parts[0] !== VERSION) return null; // a new version of the notice asks again
    if (parts[1] === 'ads1') return 'accepted';
    if (parts[1] === 'ads0') return 'rejected';
    return null;
  }
  function writeChoice(accepted) {
    var v = VERSION + '.' + (accepted ? 'ads1' : 'ads0') + '.' + Math.floor(Date.now() / 1000);
    var c = COOKIE + '=' + encodeURIComponent(v) + '; Max-Age=' + MAX_AGE + '; Path=/; SameSite=Lax';
    if (CFG.cookieDomain) c += '; Domain=' + CFG.cookieDomain;
    if (location.protocol === 'https:') c += '; Secure';
    document.cookie = c;
  }
  function adsAllowed() {
    if (privacySignal()) return false;
    return readChoice() === 'accepted';
  }
  function adsMayRunHere() {
    return !CFG.loggedIn && !BLOCKED_PATHS.test(location.pathname);
  }

  // ---------- loaders (run only after consent) ----------
  function loadMeta(id) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', String(id));
    window.fbq('track', 'PageView');
  }
  function loadTikTok(id) {
    /* eslint-disable */
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(String(id));ttq.page();}(window,document,'ttq');
    /* eslint-enable */
  }
  function loadKlaviyo(key) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=' + encodeURIComponent(String(key));
    document.head.appendChild(s);
  }
  function loadAdTools() {
    if (loaded || !adsAllowed() || !adsMayRunHere()) return;
    loaded = true;
    try { if (CFG.metaPixelId) loadMeta(CFG.metaPixelId); } catch (e) {}
    try { if (CFG.tiktokPixelId) loadTikTok(CFG.tiktokPixelId); } catch (e) {}
    try { if (CFG.klaviyoPublicKey) loadKlaviyo(CFG.klaviyoPublicKey); } catch (e) {}
  }
  // Best effort: remove first-party cookies the ad tools set on our domain after a "Reject".
  function clearAdCookies() {
    var names = ['_fbp', '_fbc', '_ttp', '_tt_enable_cookie', 'ttcsid', '__kla_id'];
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^ttcsid_/.test(n)) names.push(n);
    });
    var host = location.hostname.split('.');
    var domains = ['', location.hostname];
    for (var i = 1; i < host.length - 1; i++) domains.push('.' + host.slice(i).join('.'));
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : '');
      });
    });
  }

  // ---------- UI ----------
  var CSS = [
    '.c127-bar{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;',
    'background:#0d0e11;color:#e3e6f1;border:1px solid rgba(227,230,241,.16);border-radius:18px;padding:16px 18px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.45);font:14px/1.5 Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.c127-bar p{margin:0 0 12px}',
    '.c127-bar a,.c127-panel a{color:#e3e6f1;text-decoration:underline;text-underline-offset:2px}',
    '.c127-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.c127-btn{appearance:none;border:1px solid #e3e6f1;background:#e3e6f1;color:#060607;border-radius:999px;',
    'padding:9px 18px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;min-width:96px}',
    '.c127-link{appearance:none;border:0;background:none;color:#9ea3b3;font:14px/1 inherit;font-family:inherit;',
    'text-decoration:underline;text-underline-offset:2px;cursor:pointer;padding:9px 4px}',
    '.c127-btn:focus-visible,.c127-link:focus-visible,.c127-switch input:focus-visible+span{outline:2px solid #3ee6a0;outline-offset:2px}',
    '.c127-back{position:fixed;inset:0;z-index:2147483001;background:rgba(6,6,7,.72);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.c127-panel{background:#0d0e11;color:#e3e6f1;border:1px solid rgba(227,230,241,.16);border-radius:20px;max-width:560px;width:100%;',
    'max-height:calc(100vh - 32px);overflow:auto;padding:22px;font:14px/1.55 Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.c127-panel h2{font-size:20px;margin:0 0 6px;letter-spacing:-.02em}',
    '.c127-cat{border-top:1px solid rgba(227,230,241,.12);padding:14px 0;display:flex;gap:16px;justify-content:space-between;align-items:flex-start}',
    '.c127-cat h3{font-size:15px;margin:0 0 4px}.c127-cat p{margin:0;color:#b9bdc9}',
    '.c127-state{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ea3b3;white-space:nowrap;padding-top:2px}',
    '.c127-switch{position:relative;display:inline-block;width:46px;height:26px;flex:none}',
    '.c127-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}',
    '.c127-switch span{position:absolute;inset:0;border-radius:999px;background:#2a2c33;transition:background .15s;pointer-events:none}',
    '.c127-switch span:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#e3e6f1;transition:transform .15s}',
    '.c127-switch input:checked+span{background:#7c8296}.c127-switch input:checked+span:after{transform:translateX(20px)}',
    '.c127-switch input:disabled+span{opacity:.45}',
    '.c127-note{margin:10px 0 0;color:#3ee6a0}'
  ].join('');

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function injectCss() {
    if (document.getElementById('c127-css')) return;
    var s = el('style', { id: 'c127-css' });
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  var notice = function () { return CFG.noticeUrl || '/cookies'; };

  var bar = null;
  function showBar() {
    if (bar) return;
    injectCss();
    bar = el('div', { 'class': 'c127-bar', role: 'region', 'aria-label': 'Cookie choices' },
      '<p>We use essential cookies to run 127. With your OK, we\'ll also use Meta and TikTok ad cookies to see which ads work. ' +
      'You can change your mind anytime in Cookie settings. <a href="' + notice() + '">Cookie Notice</a></p>' +
      '<div class="c127-row">' +
      '<button type="button" class="c127-btn" data-c127="reject">Reject</button>' +
      '<button type="button" class="c127-btn" data-c127="accept">Accept</button>' +
      '<button type="button" class="c127-link" data-c127="settings">Settings</button>' +
      '</div>');
    bar.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-c127');
      if (a === 'accept') choose(true);
      else if (a === 'reject') choose(false);
      else if (a === 'settings') openPanel();
    });
    document.body.appendChild(bar);
  }
  function hideBar() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }

  var back = null, lastFocus = null;
  function openPanel() {
    if (back) return;
    injectCss();
    lastFocus = document.activeElement;
    var sig = privacySignal();
    var on = adsAllowed();
    back = el('div', { 'class': 'c127-back' });
    var panel = el('div', { 'class': 'c127-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'c127-title' },
      '<h2 id="c127-title">Cookie settings</h2>' +
      '<p style="margin:0 0 8px;color:#b9bdc9">Choose what 127 can use on this browser. Details are in our <a href="' + notice() + '">Cookie Notice</a> and <a href="/privacy">Privacy Policy</a>.</p>' +
      '<div class="c127-cat"><div><h3>Essential</h3><p>Keep you signed in, remember your choices and the referral link you used, and protect the site.</p></div><div class="c127-state">Always on</div></div>' +
      '<div class="c127-cat"><div><h3>Privacy-friendly analytics</h3><p>Plausible counts visits without cookies and without following you around the web.</p></div><div class="c127-state">Always on</div></div>' +
      '<div class="c127-cat"><div><h3>Advertising and marketing</h3><p>Meta Pixel, TikTok Pixel and Klaviyo site tracking help us measure our ads and emails. They collect device and browsing information that those companies can also use under their own policies, which some state laws call "sharing" or targeted advertising. Never used inside the member app.</p>' +
      (sig ? '<p class="c127-note">Your browser sent a ' + (sig === 'gpc' ? 'Global Privacy Control' : 'Do Not Track') + ' signal, so these stay off.</p>' : '') +
      '</div><label class="c127-switch"><input type="checkbox" id="c127-ads" aria-label="Advertising and marketing cookies"' + (on ? ' checked' : '') + (sig ? ' disabled' : '') + '><span></span></label></div>' +
      '<div class="c127-row" style="margin-top:14px">' +
      '<button type="button" class="c127-btn" data-c127="save">Save choices</button>' +
      (sig ? '' : '<button type="button" class="c127-btn" data-c127="reject">Reject all</button><button type="button" class="c127-btn" data-c127="accept">Accept all</button>') +
      '<button type="button" class="c127-link" data-c127="close">Close</button>' +
      '</div>');
    back.appendChild(panel);
    back.addEventListener('click', function (e) {
      if (e.target === back) return closePanel();
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-c127');
      if (a === 'save') { var box = document.getElementById('c127-ads'); choose(!!(box && box.checked && !privacySignal())); }
      else if (a === 'accept') choose(true);
      else if (a === 'reject') choose(false);
      else if (a === 'close') closePanel();
    });
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
      if (e.key === 'Tab') { // keep focus inside the dialog
        var f = panel.querySelectorAll('button, input:not([disabled]), a[href]');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.body.appendChild(back);
    var firstBtn = panel.querySelector('input:not([disabled])') || panel.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }
  function closePanel() {
    if (back && back.parentNode) back.parentNode.removeChild(back);
    back = null;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  function choose(accepted) {
    if (privacySignal()) accepted = false;
    var wasLoaded = loaded;
    writeChoice(accepted);
    hideBar();
    closePanel();
    listeners.forEach(function (fn) { try { fn(accepted); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent('c127:consent', { detail: { ads: accepted } })); } catch (e) {}
    if (accepted) loadAdTools();
    else {
      clearAdCookies();
      // Scripts that already ran can't be unloaded; a reload makes sure they're gone.
      if (wasLoaded) location.reload();
    }
  }

  window.c127Consent = {
    ads: adsAllowed,
    signal: privacySignal,
    open: openPanel,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  function init() {
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (t) { e.preventDefault(); openPanel(); }
    });
    var sig = privacySignal();
    if (sig && readChoice() === null) writeChoice(false); // remember the signal as a "no"
    if (adsAllowed()) loadAdTools();
    else if (!sig && readChoice() === null && hasAdTools() && adsMayRunHere()) showBar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
