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
        var body = JSON.stringify({ quiz: STARTS[name], utm_source: u.utm_source || null, utm_medium: u.utm_medium || null, utm_campaign: u.utm_campaign || null, utm_content: u.utm_content || null });
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
    // Server-side Meta events need the visitor's ad consent too (Legal L7, public/js/consent.js).
    payload.ad_consent = !!(window.c127Consent && window.c127Consent.ads());
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
        if (j && j.referral_link) K.saveFounding(j);
        return j;
      });
    }, function () { return { ok: true, preview: true }; });
  };

  // ---------- founding list (pre-launch) ----------
  // /api/lead returns the invite link when the site is in pre-launch; the pages show it
  // in place of "Create my free account" (signup is closed until doors open).
  var FKEY = '127-founding';
  K.saveFounding = function (j) {
    try {
      localStorage.setItem(FKEY, JSON.stringify({
        link: j.referral_link, status: j.status_url, code: j.referral_code, existing: !!j.existing, confirmed: !!j.confirmed,
        n: j.referrals_for_reward || 3, launchDate: j.launch_date || null, launchAt: j.launch_at || null,
        confirmSent: !!j.confirm_sent,
      }));
    } catch (e) {}
  };
  K.founding = function () {
    try {
      var f = JSON.parse(localStorage.getItem(FKEY) || 'null');
      if (!f || !f.link) return null;
      if (f.launchAt && Date.now() >= f.launchAt) return null; // doors are open: signup works again
      return f;
    } catch (e) { return null; }
  };
  K.foundingCard = function (source) {
    var f = K.founding();
    if (!f) return '';
    var short = String(f.link).replace(/^https?:\/\//, '');
    return '<div class="card accent founding-card" style="margin-top:14px" data-source="' + K.esc(source || '') + '">' +
      '<div class="label lilac">Founding list</div>' +
      '<h3 class="h3" style="margin:10px 0 8px">' + (f.existing ? 'You\'re already on the founding list.' : 'You\'re on the founding list.') + '</h3>' +
      '<p class="fog small" style="margin:0 0 14px">' +
        (f.confirmed ? 'Your spot is confirmed.' : f.confirmSent ? 'Check your email and tap Confirm so your invite link counts.' : 'Your spot is saved.') +
        (f.launchDate ? ' Doors open ' + K.esc(f.launchDate) + '.' : '') +
        ' When ' + f.n + ' friends join with your link and confirm, your first month is free.</p>' +
      '<div class="label" style="margin-bottom:8px">Your invite link</div>' +
      '<div class="mono small" style="padding:12px 14px;border:1px solid var(--c-line);border-radius:12px;word-break:break-all;margin-bottom:12px">' + K.esc(short) + '</div>' +
      '<div class="row" style="gap:10px">' +
        '<button class="btn block" type="button" data-founding="share">Share my invite link</button>' +
        '<a class="btn ghost block" href="' + K.esc(f.status) + '" data-founding="status">See my spot</a>' +
      '</div></div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-founding]');
    if (!b) return;
    var f = K.founding(); if (!f) return;
    var card = b.closest('.founding-card'), source = card ? card.getAttribute('data-source') : '';
    if (b.getAttribute('data-founding') === 'status') { K.track('Founding Status Click', { source: source }); return; }
    var text = "I'm on the 127 founding list. I get a free month if you join with my link: " + f.link;
    K.track('Referral Share', { source: source, channel: navigator.share ? 'native' : 'copy' });
    if (navigator.share) { navigator.share({ title: '127', text: text, url: f.link }).catch(function () {}); return; }
    K.copy(f.link);
  });

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
    var c = window.K127_CONSENT || { box: 'Send me founder emails and the weekly digest. Unsubscribe anytime.', line: '', terms: '' };
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
