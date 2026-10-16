// Day One Challenge promo block for the lead-magnet result pages: the Founder Score result,
// the Idea Test result and the Day One Stack guide (/stack/guide, after the /stack email gate).
// Each page has an empty slot right after its result: <div data-challenge-block="<source>"></div>,
// filled only while the result is on screen, so nothing above it moves. /challenge/status.json
// decides whether it shows and gives the consent wording. With a saved lead email it is a one-tap
// join form, otherwise a link to the landing page. Never shown to joiners, on ?from=challenge or
// in print. No dependencies; the CSS is injected once and scoped under .chfb.
(function () {
  'use strict';
  if (window.__chfb) return;
  window.__chfb = true;

  const slot = document.querySelector('[data-challenge-block]');
  if (!slot) return;
  const get = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const q = new URLSearchParams(location.search);
  if (q.get('from') === 'challenge' || q.get('print') === '1' || get('127-challenge-joined') === '1') return;

  const source = slot.getAttribute('data-challenge-block') ||
    (/stack/.test(location.pathname) ? 'day-one-stack' : /idea/.test(location.pathname) ? 'idea-test' : 'founder-score');
  // Where each page renders its result, and something that only exists once the result shows.
  const RESULT = {
    'founder-score': ['#app', '.score-hero'], // score.js re-renders #app for every screen
    'idea-test': ['#result', '.score-big'], // #result also holds the loading state
    'day-one-stack': ['#guide', '*'], // the guide renders on load
  }[source];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const OOPS = 'Something went wrong. Try again.';
  const AGE = 'By joining, you confirm you\'re 18 or older and agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.';
  // Reuses funnels.css (.card .label .h3 .input .btn .check-row .consent-line .form-err) and its tokens.
  const CSS = [
    'div.chfb{padding-top:20px;padding-bottom:8px}.chfb .chfb-card{border-color:var(--c-line-strong)}',
    '.chfb .chfb-eyebrow{display:flex;align-items:center;gap:14px}',
    '.chfb .chfb-dot{position:relative;flex:none;width:8px;height:8px;border-radius:50%;background:var(--c-signal);box-shadow:0 0 10px var(--c-signal)}',
    '@media (prefers-reduced-motion:no-preference){.chfb .chfb-dot::after{content:"";position:absolute;top:-5px;right:-5px;bottom:-5px;left:-5px;border-radius:50%;border:1px solid var(--c-signal);animation:chfbPing 1.8s cubic-bezier(0,0,.2,1) infinite}}',
    '@keyframes chfbPing{from{transform:scale(.5);opacity:.9}to{transform:scale(1.7);opacity:0}}',
    '.chfb .chfb-h{margin:14px 0 8px}.chfb .chfb-body{margin:0 0 20px;line-height:1.5;color:var(--c-fog)}.chfb .chfb-form{display:grid;gap:12px}',
    '.chfb .chfb-as{margin:0;font-size:14px;color:var(--c-fog);overflow-wrap:anywhere;word-break:break-word}.chfb .chfb-as b{color:var(--c-ink);font-weight:500}',
    '.chfb .chfb-nw{white-space:nowrap}.chfb .chfb-change{padding:4px 2px}.chfb .check-row,.chfb .consent-line{color:var(--c-fog)}.chfb .consent-line a{color:var(--c-ink)}',
    '.chfb .chfb-btn{border-radius:999px;margin-top:4px}.chfb .chfb-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}',
    '@media (prefers-reduced-motion:reduce){.chfb .btn{transition:none}.chfb .btn:hover{transform:none}}',
    '@media print{.chfb{display:none!important}}',
  ].join('\n');

  let st = null; // status.json
  let box = null; // the block, inside the slot
  let form = null; // the one-tap form, when there is one
  let shown = ''; // the email shown as text in the form
  let editing = false; // "change" turned that text into an input
  let busy = false;
  let btnHtml = '';
  let mo = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Server-sent URLs: same-site paths only (no //host, no schemes).
  const local = (u, d) => (typeof u === 'string' && /^\/(?![/\\])/.test(u) ? u : d);
  const canForm = (email) => !!(email && st.consent && st.consent.box && st.consent.line && st.consent.version);

  function ready() {
    if (!RESULT) return true;
    const root = document.querySelector(RESULT[0]);
    return !!(root && !root.hidden && root.querySelector(RESULT[1]));
  }

  // "Monday, November 9" and "Nov 9 to 13", in Eastern time, from status.starts_at.
  function dates(iso) {
    try {
      const t = Date.parse(iso);
      if (!isFinite(t)) throw new Error('no start date');
      const f = (ms, o) => new Date(ms).toLocaleDateString('en-US', Object.assign({ timeZone: 'America/New_York' }, o));
      const end = t + 4 * 864e5;
      const m1 = f(t, { month: 'short' });
      const m2 = f(end, { month: 'short' });
      return [f(t, { weekday: 'long', month: 'long', day: 'numeric' }), `${m1} ${f(t, { day: 'numeric' })} to ${m1 === m2 ? '' : m2 + ' '}${f(end, { day: 'numeric' })}`];
    } catch (e) {
      return ['Monday, November 9', 'Nov 9 to 13'];
    }
  }

  // The funnels don't store a name. Use 127-lead-name if something set it, else a first name
  // typed into this page's own gate (the Founder Score gate asks for one).
  function savedName() {
    const all = document.querySelectorAll('input[autocomplete="given-name"]');
    for (let i = 0; i < all.length; i++) if (!slot.contains(all[i]) && all[i].value.trim()) return all[i].value.trim();
    return '';
  }

  function render(email) {
    const live = st.phase === 'live';
    const n = Number(st.day_live);
    const c = st.consent || {};
    const d = dates(st.starts_at);
    const join = local(st.join_url, '/challenge');
    const head = live
      ? (n >= 1 && n <= 5 ? `Day ${n} of the Day One Challenge is live.` : 'The Day One Challenge is live.')
      : `Your next move starts ${d[0]}.`;
    const body = live
      ? 'Join now and catch up. Every day stays open until Sunday night.'
      : 'Join the free Day One Challenge: five days to put this into action, live with Eli.';
    btnHtml = esc(live ? 'Join and catch up' : 'Join the challenge') + ' <span class="arrow" aria-hidden="true"></span>';
    const name = (get('127-lead-name') || savedName()).slice(0, 60);
    const action = canForm(email)
      ? '<form class="chfb-form" novalidate>' +
          `<input class="input" type="text" name="first_name" placeholder="First name" aria-label="First name" autocomplete="given-name" maxlength="60" value="${esc(name)}">` +
          '<p class="chfb-as">Joining as <b></b> <span class="chfb-nw">· <button type="button" class="link chfb-change">change</button></span></p>' +
          '<input class="chfb-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          `<label class="check-row"><input type="checkbox" name="optin"> ${esc(c.box)}</label>` +
          `<p class="consent-line">${esc(c.line)}</p>` +
          `<p class="consent-line">${AGE}</p>` +
          `<button class="btn block chfb-btn" type="submit">${btnHtml}</button>` +
          '<div class="form-err" role="alert" hidden></div>' +
        '</form>'
      : `<a class="btn block chfb-btn" href="${esc(join + (join.indexOf('?') < 0 ? '?' : '&') + 'from=' + encodeURIComponent(source))}">${btnHtml}</a>`;
    if (!box) {
      box = document.createElement('div');
      box.className = 'narrow chfb';
      slot.appendChild(box);
      box.addEventListener('click', onClick);
      box.addEventListener('submit', onSubmit);
    }
    box.innerHTML =
      '<aside class="card chfb-card fade-in" aria-labelledby="chfb-h">' +
        `<div class="label chfb-eyebrow">${live ? '<span class="chfb-dot" aria-hidden="true"></span>' : ''}<span>Free · 5 days · ${esc(d[1])}</span></div>` +
        `<h2 class="h3 chfb-h" id="chfb-h">${esc(head)}</h2>` +
        `<p class="chfb-body">${esc(body)}</p>` +
        action +
      '</aside>';
    form = box.querySelector('form');
    editing = false;
    busy = false;
    if (form) setShown(email);
  }

  function setShown(email) {
    shown = email;
    const b = form.querySelector('.chfb-as b');
    if (b) b.textContent = email;
  }

  // "change": the email text becomes an input again.
  function edit() {
    const p = form && form.querySelector('.chfb-as');
    if (!p) return;
    editing = true;
    const i = document.createElement('input');
    Object.assign(i, { className: 'input', type: 'email', name: 'email', value: shown, maxLength: 200, placeholder: 'you@email.com' });
    i.setAttribute('autocomplete', 'email');
    i.setAttribute('aria-label', 'Email');
    p.parentNode.replaceChild(i, p);
    i.focus();
  }

  // Both no-op if the block was removed mid-request (joined in another tab).
  function fail(msg) {
    const el = form && form.querySelector('.form-err');
    if (el) { el.textContent = msg; el.hidden = !msg; }
  }

  function setBusy(on) {
    busy = on;
    const b = form && form.querySelector('.chfb-btn');
    if (!b) return;
    b.disabled = on;
    b.setAttribute('aria-busy', String(on));
    b.innerHTML = on ? 'Joining...' : btnHtml;
  }

  function onClick(e) {
    const t = e.target.closest && e.target.closest('.chfb-btn, .chfb-change');
    if (!t) return;
    if (t.classList.contains('chfb-change')) return edit();
    try {
      if (window.plausible) window.plausible('Challenge Promo Click', { props: { source } });
    } catch (x) { /* analytics never blocks the join */ }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy || !form) return;
    const f = form.elements;
    const email = (editing ? f.email.value : shown).trim();
    if (!EMAIL.test(email)) {
      if (!editing) edit();
      return fail('Please enter a valid email.');
    }
    fail('');
    setBusy(true);
    fetch(local(st.api, '/challenge/api/join'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ first_name: f.first_name.value.trim().slice(0, 60), email, optin: f.optin.checked, source, cv: st.consent.version, website: f.website.value }),
    })
      .then((r) => r.json().catch(() => null).then((j) => {
        j = j || {};
        // 200: joined, go to the thank-you page. 410: registration closed, go to the landing page.
        if (r.ok && j.ok) location.href = local(j.url, '/challenge/joined');
        else if (r.status === 410 || j.closed) location.href = local(j.url, local(st.join_url, '/challenge'));
        else {
          setBusy(false);
          if (r.status === 400 && !editing) edit(); // the only field the server checks is the email
          fail(typeof j.error === 'string' && j.error ? j.error : OOPS);
        }
      }))
      .catch(() => { setBusy(false); fail(OOPS); });
  }

  function sync() {
    if (get('127-challenge-joined') === '1') {
      if (mo) mo.disconnect();
      slot.textContent = '';
      box = form = null;
      return;
    }
    const show = ready();
    if (show) {
      const email = get('127-lead-email').trim();
      // First show, or a gate on this page just saved the email: swap the link for the one-tap form.
      if (!box || (!form && canForm(email))) render(email);
      else if (form && !editing && !busy && email && email !== shown) setShown(email);
    }
    if (box && box.hidden === show) box.hidden = !show;
  }

  function start(s) {
    st = s;
    if (!document.getElementById('chfb-css')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'chfb-css', textContent: CSS }));
    const root = RESULT && document.querySelector(RESULT[0]);
    if (root && window.MutationObserver) {
      mo = new MutationObserver(sync);
      mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
    // Back from the thank-you page (restored from cache): drop the block or re-enable the button.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      if (busy && form) setBusy(false);
      sync();
    });
    sync();
  }

  fetch('/challenge/status.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => { if (s && s.show === true) start(s); })
    .catch(() => { /* no status, no block */ });
})();
