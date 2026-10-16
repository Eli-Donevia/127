// Idea Test page: submit an idea, show the score and verdict free, unlock the
// 7-day test plan with an email (also emailed to them).
(function () {
  var K = window.K127, esc = K.esc;
  var ON_SITE = K.onSite;

  var form = document.getElementById('ideaForm');
  var out = document.getElementById('result');
  var errEl = document.getElementById('err');
  var current = null, input = null, unlocked = false;

  form.onsubmit = function (e) {
    e.preventDefault();
    input = { idea: form.idea.value.trim(), customer: form.customer.value.trim(), money: form.money.value.trim(), edge: form.edge.value.trim(), website: form.website.value };
    if (input.idea.length < 12) return showErr('Describe the idea in a sentence or two.');
    errEl.hidden = true;
    var btn = document.getElementById('run');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Scoring your idea';
    loading();
    K.track('Idea Test Run');
    input.utm = K.utm();
    fetch('/api/idea-test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
      .then(function (r) {
        if (!/json/.test(r.headers.get('content-type') || '')) return { ok: true, demo: true, preview: true, report: demoReport(input) };
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; });
      }, function () { return { ok: true, demo: true, preview: true, report: demoReport(input) }; })
      .then(function (j) { current = j; unlocked = false; render(j); }, function (ex) { out.hidden = true; showErr(ex.message); })
      .then(function () { btn.disabled = false; btn.innerHTML = 'Test my idea <span class="arrow"></span>'; });
  };
  function showErr(m) { errEl.textContent = m; errEl.hidden = false; }

  function loading() {
    out.hidden = false;
    out.innerHTML = '<div class="card" style="margin-top:14px"><div class="label">Running the six questions</div><div class="thinking" style="margin-top:16px"><div class="line"></div><div class="line" style="width:85%"></div><div class="line" style="width:70%"></div><div class="line" style="width:90%"></div></div></div>';
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function render(j) {
    var r = j.report;
    document.getElementById('formWrap').hidden = true;
    document.getElementById('top').hidden = true;
    var chipCls = r.verdict_label === 'Build it' ? 'signal' : r.verdict_label === 'Promising' ? 'lilac' : '';
    var crit = r.criteria.map(function (c) {
      return '<div class="crit"><div class="crit-head"><b>' + esc(c.name) + '</b><span class="mono slate small">' + c.score + '/10</span></div>' +
        '<div class="bar"><span data-w="' + c.score * 10 + '"></span></div><div class="why">' + esc(c.why) + '</div></div>';
    }).join('');
    var html =
      (j.demo ? '<div class="card" style="margin:14px 0 0;border-color:rgba(240,155,138,.35)"><div class="label" style="color:var(--c-ember)">Demo result</div><p class="small fog" style="margin:6px 0 0">' + (j.preview ? 'This is a preview without the live AI. On 127group.io every idea gets its own score.' : 'The AI key is not connected yet, so this is a sample report.') + '</p></div>' : '') +
      '<div style="padding:26px 0 8px"><div class="label">Your Idea Test</div>' +
      '<p class="fog small" style="margin:12px 0 0">"' + esc(input.idea.slice(0, 180)) + (input.idea.length > 180 ? '…' : '') + '"</p></div>' +
      '<div class="card halo">' +
        '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:12px">' +
          '<div class="score-big steel"><span id="count">0</span><small>/100</small></div>' +
          '<span class="chip ' + chipCls + '">' + esc(r.verdict_label) + '</span></div>' +
        '<p style="font-size:19px;line-height:1.4;letter-spacing:-.02em;margin:0">' + esc(r.verdict_line) + '</p>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' + crit + '</div>' +
      '<div class="grid-2" style="margin-top:14px">' +
        '<div class="card"><div class="label">Biggest risk</div><p style="margin:8px 0 0">' + esc(r.biggest_risk) + '</p></div>' +
        '<div class="card accent prompt"><div class="label lilac">Sharper pitch</div><p style="margin:8px 0 0">' + esc(r.sharper_pitch) + '</p>' +
          '<button class="link tiny" id="copyPitch" style="margin-top:6px">Copy</button></div>' +
      '</div>' +
      '<div id="plan"></div>' +
      '<div class="row" style="justify-content:center;gap:18px;margin:28px 0 8px">' +
        '<button class="link" id="again">Test another idea</button>' +
        '<a class="link" href="' + K.href('/stack') + '\">Get the Day One Stack</a>' +
      '</div>';
    out.innerHTML = '<div class="fade-in">' + html + '</div>';
    out.hidden = false;
    window.scrollTo({ top: 0 });
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(out.querySelectorAll('.bar span[data-w]'), function (s) { s.style.width = s.getAttribute('data-w') + '%'; });
      countUp(document.getElementById('count'), r.score);
    });
    document.getElementById('copyPitch').onclick = function () { K.copy(r.sharper_pitch); };
    document.getElementById('again').onclick = function () {
      out.hidden = true; document.getElementById('formWrap').hidden = false; document.getElementById('top').hidden = false;
      form.reset(); window.scrollTo({ top: 0 }); form.idea.focus();
    };
    renderPlan();
  }

  function planHtml(r) {
    return '<div class="card win" style="margin-top:14px"><div class="label signal">Your 7-day test</div>' +
      r.seven_day_test.map(function (s, i) { return '<div class="task"><span class="n">' + (i + 1) + '</span><div><div class="d" style="color:var(--c-fog);margin:0">' + esc(s) + '</div></div></div>'; }).join('') +
      '</div>' +
      '<div class="grid-2" style="margin-top:14px">' +
        '<div class="card"><div class="label">Ask real customers</div>' + r.questions_to_ask.map(function (q) { return '<p class="small fog" style="margin:10px 0 0">' + esc(q) + '</p>'; }).join('') + '</div>' +
        '<div class="card"><div class="label">Talk to an insider</div><p class="small fog" style="margin:10px 0 0">' + esc(r.insider) + '</p></div>' +
      '</div>';
  }

  function renderPlan() {
    var r = current.report, el = document.getElementById('plan');
    if (unlocked) {
      el.innerHTML = planHtml(r) +
        '<div class="card accent" style="margin-top:14px"><div class="label lilac">Next</div>' +
        '<h3 class="h3" style="margin:10px 0 8px">Turn this into a 30-day plan.</h3>' +
        '<p class="small fog" style="margin:0 0 16px">Take the 90-second Founder Score and get a roadmap built for where you are, with the templates for every step.</p>' +
        '<a class="btn block" href="' + K.href('/score') + '\">Get my Founder Score <span class="arrow"></span></a></div>';
      return;
    }
    el.innerHTML = '<div style="position:relative;margin-top:14px"><div class="locked"><div class="blur">' + planHtml(r) + '</div></div>' +
      '<div class="card halo" style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);margin:0 6px">' +
        '<div class="label">Unlock your 7-day test</div>' +
        '<h3 class="h3" style="margin:10px 0 6px">Prove it before you build it.</h3>' +
        '<p class="small fog" style="margin:0 0 14px">Get a day-by-day plan to test demand, the questions to ask real customers and who to talk to on the inside. We\'ll email the full report too.</p>' +
        '<form id="gateForm" class="stack-s" novalidate>' +
          '<input class="input" type="email" name="email" placeholder="you@email.com" autocomplete="email" required value="' + esc(K.savedEmail()) + '">' +
          K.consentHtml() +
          '<button class="btn block" type="submit">Unlock my plan <span class="arrow"></span></button>' +
          '<div class="form-err" id="gateErr" hidden></div>' +
        '</form></div></div>';
    document.getElementById('gateForm').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target, email = f.email.value.trim(), err = document.getElementById('gateErr'), btn = f.querySelector('button');
      if (!K.validEmail(email)) { err.textContent = 'Enter a valid email.'; err.hidden = false; return; }
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      K.lead({ email: email, source: 'idea-test', optin: !!(f.optin && f.optin.checked), data: { idea: input.idea.slice(0, 400), score: r.score, verdict: r.verdict_label, test_id: current.id || null, report: { verdict_line: r.verdict_line, biggest_risk: r.biggest_risk, sharper_pitch: r.sharper_pitch, seven_day_test: r.seven_day_test, questions_to_ask: r.questions_to_ask, insider: r.insider } } })
        .then(function () { K.track('Lead', { source: 'idea-test', verdict: r.verdict_label }); unlocked = true; renderPlan(); K.toast('Unlocked. Full report sent to your inbox.'); },
          function (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; btn.innerHTML = 'Unlock my plan <span class="arrow"></span>'; });
    };
  }

  function countUp(el, to) {
    if (!el) return;
    var t0 = performance.now();
    (function step(t) { var p = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  // Same placeholder as lib/idea-test.js demo(), for static previews with no server.
  function demoReport(i) {
    var has = function (s) { return (s || '').trim().length > 8; };
    var specific = has(i.customer) && i.customer.split(' ').length >= 3;
    var crit = [
      ['pain', 'Real pain', 5, 'No proof yet that people already pay to fix this. Find out what they use today.'],
      ['value', 'Clear value', 6, 'The value is plausible. Say it as one measurable result.'],
      ['economics', 'Economics', has(i.money) ? 6 : 4, has(i.money) ? 'There is a pricing idea. Check the cost to win one customer.' : 'No pricing yet. Decide who pays, how much and how often.'],
      ['reach', 'Reachable buyers', specific ? 6 : 4, specific ? 'The buyer is specific enough to find.' : 'The buyer is too broad to reach cheaply. Narrow it.'],
      ['edge', 'Edge', has(i.edge) ? 6 : 3, has(i.edge) ? 'You named an edge. Make sure a buyer would notice it.' : 'No clear edge yet. Why you, why this, why now?'],
      ['future', 'Market direction', 6, 'Check whether this market is growing and how AI changes it.'],
    ].map(function (c) { return { key: c[0], name: c[1], score: c[2], why: c[3] }; });
    var score = Math.round(crit.reduce(function (s, c) { return s + c.score; }, 0) / 60 * 100);
    return {
      score: score, verdict_label: score >= 75 ? 'Build it' : score >= 50 ? 'Promising' : 'Rework it',
      verdict_line: 'Sample result. The live tool scores your specific idea.',
      criteria: crit,
      biggest_risk: 'Building before proving that a specific group of people will pay.',
      sharper_pitch: 'For [specific buyer], [your idea] delivers [one measurable result] in [timeframe], without [the pain of the current option].',
      seven_day_test: ['Write the problem in one sentence, in words a customer would use.', 'List 10 named people who have this problem.', 'Message all 10 and ask for a 15-minute conversation.', 'Run your first conversations. Ask about the past, never pitch.', 'Write down the exact phrases that came up more than once.', 'Draft a one-page offer with a price, using their words.', 'Ask three of them to pre-order or pay a deposit.'],
      questions_to_ask: ['Tell me about the last time this problem came up. What did you do?', 'What have you already tried or paid for to fix it?', 'If this disappeared tomorrow, what would it cost you?'],
      insider: 'Find someone who has worked inside this industry for years and ask what everyone outside gets wrong about it.',
    };
  }
})();
