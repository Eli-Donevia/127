// Idea Test page: submit an idea, show the score, verdict and the reasons free, then the email gate
// for the 7-day test plan (also emailed) and the launch-state block (results-kit.js).
(function () {
  var K = window.K127, esc = K.esc;
  var ON_SITE = K.onSite;

  var form = document.getElementById('ideaForm');
  var out = document.getElementById('result');
  var errEl = document.getElementById('err');
  var current = null, input = null, unlocked = false, sticky = null;
  // Which answer each of Eli's 5 questions was scored from, for "Because you said ..." (quiz-results.md §11).
  var FROM = { pain: ['idea', 'the idea'], economics: ['money', 'how it makes money'], edge: ['edge', 'your edge'], future: ['idea', 'the idea'], inside: ['edge', 'your inside view'] };
  function said(c) {
    var f = FROM[c.key] || ['idea', 'the idea'], v = (input && input[f[0]]) || '';
    if (c.key === 'economics' && !v && input && input.customer) v = input.customer;
    if (!v) return 'You left ' + f[1] + ' blank: ';
    return 'Because you said "' + (v.length > 70 ? v.slice(0, 68).replace(/\s+\S*$/, '') + '…' : v) + '": ';
  }

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
    out.innerHTML = '<div class="card" style="margin-top:14px"><div class="label">Running the 5 questions</div><div class="thinking" style="margin-top:16px"><div class="line"></div><div class="line" style="width:85%"></div><div class="line" style="width:70%"></div><div class="line" style="width:90%"></div></div></div>';
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function render(j) {
    var r = j.report;
    document.getElementById('formWrap').hidden = true;
    document.getElementById('top').hidden = true;
    var chipCls = r.verdict_label === 'Build it' ? 'signal' : r.verdict_label === 'Promising' ? 'lilac' : '';
    var low = r.criteria.reduce(function (w, c) { return c.score < w.score ? c : w; }, r.criteria[0]);
    var crit = r.criteria.map(function (c) {
      return '<div class="crit' + (c === low ? ' low' : '') + '"><div class="crit-head"><b>' + esc(c.name) + '</b><span class="mono slate small">' + c.score + '/10</span></div>' +
        '<div class="bar"><span data-w="' + c.score * 10 + '"></span></div><div class="why"><b>' + esc(said(c)) + esc(c.name) + ' ' + c.score + '/10.</b> ' + esc(c.why) + '</div></div>';
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
      '<div class="card" id="reasons" style="margin-top:14px"><div class="label" style="margin-bottom:6px">Why you got this score.</div>' + crit + '</div>' +
      '<div class="grid-2" style="margin-top:14px">' +
        '<div class="card"><div class="label">Biggest risk</div><p style="margin:8px 0 0">' + esc(r.biggest_risk) + '</p></div>' +
        '<div class="card accent prompt"><div class="label lilac">Sharper pitch</div><p style="margin:8px 0 0">' + esc(r.sharper_pitch) + '</p>' +
          '<button class="link tiny" id="copyPitch" style="margin-top:6px">Copy</button></div>' +
      '</div>' +
      '<div id="plan"></div>' +
      '<div id="stateBlock"></div>' +
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
      if (sticky) { sticky.remove(); sticky = null; }
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
        '<p class="small fog" style="margin:0 0 16px">Take the 90-second Founder Score and get a roadmap built for where you are, with the reason behind every part of your score.</p>' +
        '<a class="btn block ghost" href="' + K.href('/score') + '\">Get my Founder Score <span class="arrow"></span></a></div>';
      K.R.block(document.getElementById('stateBlock'), { magnet: 'idea', key: r.verdict_label, onStart: function () { location.href = K.href('/start') + '?stage=validating&from=idea-test'; } });
      document.getElementById('stateBlock').insertAdjacentHTML('afterend', '<div style="margin-top:14px">' + K.R.who() + '</div>');
      return;
    }
    el.innerHTML = '<div id="gateWrap" style="margin-top:14px"></div>';
    var wrap = document.getElementById('gateWrap');
    K.R.gate(wrap, {
      magnet: 'idea',
      data: function () { return { idea: input.idea.slice(0, 400), score: r.score, verdict: r.verdict_label, test_id: current.id || null, report: { verdict_line: r.verdict_line, biggest_risk: r.biggest_risk, sharper_pitch: r.sharper_pitch, seven_day_test: r.seven_day_test, questions_to_ask: r.questions_to_ask, insider: r.insider } }; },
      onDone: function () {
        K.track('Lead', { source: 'idea-test', verdict: r.verdict_label });
        if (sticky) { sticky.remove(); sticky = null; }
        unlocked = true; renderPlan();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
    if (sticky) sticky.remove();
    sticky = K.R.sticky(wrap, 'idea');
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
      ['pain', 'Will they pay', 5, 'No proof yet that people already pay to fix this. Find out what they use today.'],
      ['economics', 'Numbers and channel', has(i.money) && specific ? 6 : 4, has(i.money) ? (specific ? 'There is a price and a findable buyer. Check the cost to win one customer.' : 'There is a price, but the buyer is too broad to reach cheaply. Narrow it.') : 'No pricing yet. Decide who pays, how much and how often.'],
      ['edge', 'Edge', has(i.edge) ? 6 : 3, has(i.edge) ? 'You named an edge. Make sure a buyer would notice it.' : 'No clear edge yet. Why you, why this, why now?'],
      ['future', 'Market direction', 6, 'Check whether this market is growing and how AI changes it.'],
      ['inside', 'Inside knowledge', has(i.edge) ? 5 : 3, 'Nothing here shows you have lived this problem. Talk to someone on the inside before you build.'],
    ].map(function (c) { return { key: c[0], name: c[1], score: c[2], why: c[3] }; });
    var score = Math.round(crit.reduce(function (s, c) { return s + c.score; }, 0) / (crit.length * 10) * 100);
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
