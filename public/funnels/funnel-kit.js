// Shared helpers for the 127 funnels: analytics events, UTM capture, lead capture.
// Fires whichever trackers the page has loaded (Plausible, Meta Pixel, TikTok Pixel, Klaviyo)
// and never throws if none are present.
(function () {
  var K = {};
  var UTM_KEY = '127-utm';

  // Remember the first-touch campaign for 30 days so a lead is credited to the ad that brought them.
  (function captureUtm() {
    try {
      var p = new URLSearchParams(location.search);
      var u = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'].forEach(function (k) { if (p.get(k)) u[k] = p.get(k).slice(0, 120); });
      if (p.get('fbclid')) u.fbclid = '1';
      if (p.get('ttclid')) u.ttclid = '1';
      var saved = JSON.parse(localStorage.getItem(UTM_KEY) || 'null');
      if (Object.keys(u).length && (!saved || Date.now() - saved.at > 30 * 864e5)) {
        localStorage.setItem(UTM_KEY, JSON.stringify({ at: Date.now(), utm: u, landing: location.pathname }));
      }
    } catch (e) {}
  })();

  K.utm = function () {
    try { var s = JSON.parse(localStorage.getItem(UTM_KEY) || 'null'); return s ? Object.assign({ landing: s.landing }, s.utm) : {}; } catch (e) { return {}; }
  };

  // name: 'Quiz Start' | 'Quiz Complete' | 'Lead' | 'Share' | 'Idea Test Run' ...
  // Quiz starts are also counted on the server (the revenue dashboard can't read Plausible).
  var STARTS = { 'Quiz Start': 'founder-score', 'Idea Test Run': 'idea-test' };
  K.track = function (name, props) {
    props = props || {};
    if (STARTS[name]) {
      try {
        var u = (JSON.parse(localStorage.getItem(UTM_KEY) || 'null') || {}).utm || {};
        var body = JSON.stringify({ quiz: STARTS[name], utm_source: u.utm_source || null });
        if (navigator.sendBeacon) navigator.sendBeacon('/api/quiz-start', new Blob([body], { type: 'application/json' }));
        else fetch('/api/quiz-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
      } catch (e) {}
    }
    try { if (window.plausible) window.plausible(name, { props: props }); } catch (e) {}
    try {
      if (window.fbq) {
        if (name === 'Lead') window.fbq('track', 'Lead', props, K.lastEventId ? { eventID: K.lastEventId } : undefined);
        else window.fbq('trackCustom', name.replace(/\s+/g, ''), props);
      }
    } catch (e) {}
    try {
      if (window.ttq) {
        if (name === 'Lead') window.ttq.track('SubmitForm', props);
        else window.ttq.track('ViewContent', { content_name: name });
      }
    } catch (e) {}
    try { if (window.klaviyo && window.klaviyo.push) window.klaviyo.push(['track', '127 ' + name, props]); } catch (e) {}
  };

  K.validEmail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()); };

  // POST the lead to the site. In a static preview (no server) it resolves with {preview:true}
  // so the page still unlocks and the flow can be tested end to end.
  K.lead = function (payload) {
    payload.utm = K.utm();
    // Shared with the Meta Pixel so the server-side Conversions API event is deduplicated.
    payload.event_id = K.lastEventId = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    payload.page = location.pathname;
    try { localStorage.setItem('127-lead-email', payload.email); } catch (e) {}
    return fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      // No funnel API behind this page (static preview): treat as a preview success.
      if (!/json/.test(r.headers.get('content-type') || '')) return { ok: true, preview: true };
      return r.json().catch(function () { return { ok: r.ok }; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || 'Something went wrong. Try again.');
        return j;
      });
    }, function () { return { ok: true, preview: true }; });
  };

  K.savedEmail = function () { try { return localStorage.getItem('127-lead-email') || ''; } catch (e) { return ''; } };

  K.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  var toastEl;
  K.toast = function (msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  };

  K.copy = function (text) {
    var done = function () { K.toast('Copied'); };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, fallback);
    fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { K.toast('Press and hold to copy'); }
      document.body.removeChild(ta);
    }
  };

  // Links between funnel pages. On the live site they are clean URLs; in a static
  // preview (no server) they point at the sibling .html files.
  K.onSite = /127group\.io$|localhost|127\.0\.0\.1|replit/.test(location.hostname);
  var LOCAL = { '/score': 'score.html', '/stack': 'stack.html', '/stack/guide': 'stack-guide.html', '/idea-test': 'idea-test.html', '/funnels/day-one-stack.pdf': 'day-one-stack.pdf' };
  K.href = function (path) {
    if (K.onSite) return path;
    var bare = path.split('?')[0];
    if (LOCAL[bare]) return LOCAL[bare] + path.slice(bare.length);
    return 'https://127group.io' + path;
  };
  document.addEventListener('DOMContentLoaded', function () {
    if (K.onSite) return;
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="/"]'), function (a) { a.setAttribute('href', K.href(a.getAttribute('href'))); });
  });

  // Consent block for email gates, in Legal's order: box, small line, terms (then the button).
  // The server injects window.K127_CONSENT per page from lib/consent.js.
  K.consentHtml = function () {
    // Static preview fallback only; on the site the server's wording always wins.
    var c = window.K127_CONSENT || { box: "Also send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: "We'll email your results. Unsubscribe anytime.", terms: '' };
    var e = function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    return '<label class="check-row"><input type="checkbox" name="optin"> ' + e(c.box) + '</label>' +
      (c.line ? '<p class="consent-line">' + e(c.line) + '</p>' : '') +
      (c.terms ? '<p class="consent-line">' + c.terms + '</p>' : '');
  };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-consent]').forEach(function (el) { el.outerHTML = K.consentHtml(); });
  });

  window.K127 = K;
})();
