// Onboarding stepper: one question per screen, auto-advance on single choice,
// keyboard shortcuts (1-9 / Enter / Esc), progress saved locally until submitted.
(function () {
  var OB = window.OB, qs = OB.questions;
  var KEY = '127-onboarding';
  var root = document.getElementById('ob');
  var bar = document.getElementById('bar');
  var state = { step: -1, answers: {} };
  var busy = false;

  // Steps: core questions, a week-1 preview, fine-tuning questions, then the account form.
  var steps = [];
  qs.forEach(function (q) {
    steps.push({ kind: 'q', q: q });
    if (OB.previewAfter && q.id === OB.previewAfter) steps.push({ kind: 'preview' });
  });
  if (window.OB_ACCOUNT) steps.push({ kind: 'account' });
  var qNum = {}; qs.forEach(function (q, i) { qNum[q.id] = i + 1; });

  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.answers) state.answers = saved.answers; } catch (e) {}
  if (window.OB_PREFILL) for (var k in window.OB_PREFILL) state.answers[k] = window.OB_PREFILL[k];
  if (window.OB_JUMP) state.step = window.OB_JUMP;
  var total = steps.length;
  if (window.OB_ERROR) state.step = steps.length - 1; // jump straight back to the account step

  // Email given on a funnel page (Founder Score, Day One Stack, Idea Test) carries over.
  function leadEmail() { try { return localStorage.getItem('127-lead-email') || ''; } catch (e) { return ''; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ answers: state.answers })); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { root.innerHTML = '<div class="fade-in">' + html + '</div>'; }
  function progress() { bar.style.width = state.step < 0 ? '0%' : Math.round(((state.step + 1) / (total + 1)) * 100) + '%'; }

  function render() {
    busy = false;
    progress();
    window.scrollTo(0, 0);
    if (state.step < 0) return intro();
    var s = steps[state.step];
    if (!s) return finish();
    if (s.kind === 'q') return question(s.q);
    if (s.kind === 'preview') return preview();
    return account();
  }

  function intro() {
    el(
      '<div class="ob-intro">' +
        '<div class="eyebrow">' + (window.OB_RETAKE ? 'Retake the assessment' : 'Free founder assessment') + '</div>' +
        '<h1>' + esc(OB.intro.title) + '</h1>' +
        '<p>' + esc(OB.intro.subtitle) + '</p>' +
        '<div class="ob-promise"><div><b>Your track</b>Start, Build or Grow</div><div><b>30-day plan</b>Weekly steps, in order</div><div><b>The right tools</b>Matched to each step</div></div>' +
        '<button class="btn" id="go">Begin <span class="arrow"></span></button>' +
        (OB.intro.byline && !window.OB_RETAKE ? '<p class="small muted" style="margin-top:16px">' + esc(OB.intro.byline) + '</p>' : '') +
        (window.OB_RETAKE ? '<p class="small muted" style="margin-top:16px">Retaking builds a fresh roadmap and resets roadmap progress. Your XP and badges stay.</p>' : '') +
      '</div>'
    );
    document.getElementById('go').onclick = next;
  }

  function question(q) {
    var val = state.answers[q.id];
    var html =
      '<div class="ob-section">' + esc(q.section) + ' <span class="ob-count">· ' + qNum[q.id] + ' of ' + qs.length + '</span></div>' +
      '<h2 class="ob-q">' + esc(q.question) + '</h2>' +
      '<p class="ob-hint">' + (q.type === 'multi' ? (q.max ? 'Choose up to ' + q.max + '.' : 'Choose any that apply.') : q.type === 'text' ? (q.optional ? 'Optional, but it makes your roadmap more personal.' : '') : 'Choose one.') + '</p>';

    if (q.type === 'text') {
      html += '<textarea class="input" id="txt" rows="4" maxlength="1000" placeholder="' + esc(q.placeholder || '') + '">' + esc(val || '') + '</textarea>';
    } else {
      html += '<div class="opts">';
      q.options.forEach(function (o, i) {
        var on = q.type === 'multi' ? (val || []).indexOf(o.value) > -1 : val === o.value;
        html += '<button type="button" class="opt' + (on ? ' on' : '') + '" data-v="' + esc(o.value) + '"><span class="key">' + (i + 1) + '</span><span><span class="lbl">' + esc(o.label) + '</span>' + (o.hint ? '<span class="sub">' + esc(o.hint) + '</span>' : '') + '</span></button>';
      });
      html += '</div>';
    }
    var canNext = q.type !== 'single' || q.optional;
    html += '<div class="ob-nav"><button class="ob-back" id="back">← Back</button>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
      (q.optional ? '<button class="ob-back" id="skip">Skip</button>' : '') +
      (canNext ? '<button class="btn" id="nx">Continue</button>' : '') +
      '</div></div>';
    el(html);

    document.getElementById('back').onclick = back;
    var skip = document.getElementById('skip'); if (skip) skip.onclick = function () { if (busy) return; delete state.answers[q.id]; save(); next(); };
    var nx = document.getElementById('nx');
    function refreshNext() {
      if (!nx) return;
      var v = state.answers[q.id];
      nx.disabled = !q.optional && (q.type === 'multi' ? !(v && v.length) : !v);
    }
    // busy = a tapped answer is already advancing; Continue must not advance a second time.
    if (nx) { nx.onclick = function () { if (!nx.disabled && !busy) next(); }; refreshNext(); }

    if (q.type === 'text') {
      var t = document.getElementById('txt'); t.focus();
      t.oninput = function () { state.answers[q.id] = t.value; save(); refreshNext(); };
      return;
    }
    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (b) {
      b.onclick = function () { pick(q, b.getAttribute('data-v')); refreshNext(); };
    });
  }

  function pick(q, v) {
    if (q.type === 'single') {
      if (busy) return; // a double tap must not skip the next question
      busy = true;
      state.answers[q.id] = v; save();
      Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
      setTimeout(next, 220);
      return;
    }
    var arr = (state.answers[q.id] || []).slice();
    var i = arr.indexOf(v);
    if (i > -1) arr.splice(i, 1);
    else {
      if (v === 'none') arr = [];
      else arr = arr.filter(function (x) { return x !== 'none'; });
      arr.push(v);
      if (q.max && arr.length > q.max) arr.shift();
    }
    state.answers[q.id] = arr; save();
    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (b) { b.classList.toggle('on', arr.indexOf(b.getAttribute('data-v')) > -1); });
  }

  // Week 1 of the real roadmap, before any account, so people see value first.
  function preview() {
    el('<div class="ob-section">Your roadmap</div><h2 class="ob-q">Building your plan…</h2>');
    var x = new XMLHttpRequest();
    x.open('POST', '/start/preview');
    x.setRequestHeader('content-type', 'application/json');
    x.onload = function () {
      var r; try { r = JSON.parse(x.responseText); } catch (e) { r = null; }
      if (!r || !r.week) { next(); return; }
      var left = steps.slice(state.step + 1).filter(function (s) { return s.kind === 'q'; }).length;
      var html =
        '<div class="ob-section">Your roadmap · ' + esc(r.trackName) + ' track</div>' +
        '<h2 class="ob-q">' + esc(r.headline) + '</h2>' +
        '<p class="ob-hint">' + esc(r.focus) + '</p>' +
        '<div class="ob-preview"><div class="eyebrow">Week 1 · ' + esc(r.week.theme) + '</div><ol>' +
        r.week.tasks.map(function (t) { return '<li><b>' + esc(t.title) + '</b>' + (t.detail ? '<span>' + esc(t.detail) + '</span>' : '') + '</li>'; }).join('') +
        '</ol><div class="ob-more">+ ' + (r.weeks - 1) + ' more weeks. Every step comes with the playbook or tool to do it.</div></div>' +
        '<p class="ob-step1">Step 1 takes about 10 minutes. You can do it today.</p>' +
        '<p class="ob-hint" style="margin:8px 0 0">' + (left ? left + ' quick taps to fine-tune it, then it\'s saved to your account.' : 'Save it to your account to start.') + '</p>' +
        '<div class="ob-nav"><button class="ob-back" id="back">← Back</button><div style="display:flex;gap:14px;align-items:center">' +
        (left && window.OB_ACCOUNT ? '<button class="ob-back" id="skipall">Skip, save it now</button>' : '') +
        '<button class="btn" id="nx">' + (left ? 'Fine-tune it' : 'Save my roadmap') + ' <span class="arrow"></span></button></div></div>';
      el(html);
      document.getElementById('back').onclick = back;
      document.getElementById('nx').onclick = next;
      var sk = document.getElementById('skipall'); if (sk) sk.onclick = function () { state.step = steps.length - 1; render(); };
      if (window.plausible) window.plausible('Roadmap Preview');
    };
    x.onerror = function () { next(); };
    x.send(JSON.stringify({ answers: state.answers }));
  }

  function account() {
    el(
      '<div class="ob-section">Last step</div>' +
      '<h2 class="ob-q">Your roadmap is ready. Where should we save it?</h2>' +
      '<p class="ob-hint">Create your free account to open weeks 1 and 2 and track your progress.</p>' +
      (window.OB_ERROR ? '<div class="alert error">' + esc(window.OB_ERROR) + '</div>' : '') +
      // Legal L101 RF3: whose invite link brought them here, and what that member will see.
      (window.OB_INVITED ? '<p class="small muted" style="margin:0 0 14px">' + esc(window.OB_INVITED) + '</p>' : '') +
      '<form id="acct">' +
        '<label class="field"><span>First name</span><input class="input" name="name" autocomplete="given-name" required></label>' +
        '<label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" required value="' + esc(leadEmail()) + '"></label>' +
        '<label class="field"><span>Password</span><input class="input" type="password" name="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters"></label>' +
        '<label class="check" style="margin:4px 0 18px"><input type="checkbox" name="optin"> Send me founder emails and the weekly digest. Unsubscribe anytime.</label>' +
        '<p class="consent-line" style="margin:0 0 18px">By creating an account, you confirm you\'re 18 or older and agree to the <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>' +
        '<div class="ob-nav" style="margin-top:0"><button type="button" class="ob-back" id="back">← Back</button><button class="btn">See my roadmap <span class="arrow"></span></button></div>' +
      '</form>'
    );
    document.getElementById('back').onclick = back;
    document.getElementById('acct').onsubmit = function (e) {
      e.preventDefault();
      var f = document.getElementById('submit');
      ['name', 'email', 'password'].forEach(function (k) {
        var i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = e.target[k].value; f.appendChild(i);
      });
      if (e.target.optin.checked) { var o = document.createElement('input'); o.type = 'hidden'; o.name = 'optin'; o.value = 'on'; f.appendChild(o); }
      submit();
    };
    root.querySelector('input[name=name]').focus();
  }

  function finish() {
    el('<div class="ob-intro"><div class="eyebrow">All set</div><h1>Building your roadmap…</h1></div>');
    submit();
  }

  function submit() {
    document.getElementById('answers').value = JSON.stringify(state.answers);
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.getElementById('submit').submit();
  }

  function next() { state.step = Math.min(state.step + 1, total); render(); }
  function back() { state.step = Math.max(state.step - 1, -1); render(); }

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    var s = steps[state.step], q = s && s.kind === 'q' ? s.q : null;
    if (q && q.options && /^[1-9]$/.test(e.key)) {
      var o = q.options[parseInt(e.key, 10) - 1];
      if (o) { pick(q, o.value); }
    }
    if (e.key === 'Enter') { var nx = document.getElementById('nx') || document.getElementById('go'); if (nx && !nx.disabled) nx.click(); }
    if (e.key === 'Escape') back();
  });

  render();
})();
