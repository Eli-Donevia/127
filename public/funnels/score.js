// Founder Score quiz: intro -> 7 tap questions -> score, archetype and the reasons, then an email gate
// for the #1 move, the roadmap preview and the launch-state block (results-kit.js), plus a share card.
(function () {
  var S = window.SCORE, K = window.K127, esc = K.esc;
  var app = document.getElementById('app');
  var bar = document.getElementById('bar');
  var QS = S.questions;
  var STORE = '127-score';
  var ON_SITE = K.onSite;
  var SHARE_BASE = (window.SCORE_SHARE_BASE || 'https://127group.io/score');

  var state = { step: -1, a: {}, unlocked: false };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.a) { state.a = saved.a; state.unlocked = !!saved.unlocked; }
  } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ a: state.a, unlocked: state.unlocked })); } catch (e) {} }

  // Shared link? ?r=validator&s=62
  var params = new URLSearchParams(location.search);
  var sharedArch = null;
  (function () {
    var r = (params.get('r') || '').toLowerCase(), s = parseInt(params.get('s'), 10);
    for (var k in S.archetypes) if (S.archetypes[k].name.toLowerCase() === r && s >= 0 && s <= 100) sharedArch = { name: S.archetypes[k].name, score: s };
  })();

  function render(html) { app.innerHTML = '<div class="fade-in">' + html + '</div>'; window.scrollTo(0, 0); }
  function progress() { bar.style.width = state.step < 0 ? '0%' : Math.min(100, Math.round((state.step / QS.length) * 100)) + '%'; }

  // ---------- scoring ----------
  function compute(a) {
    var dims = {};
    Object.keys(S.dims).forEach(function (d) { dims[d] = 0; });
    var total = 0;
    QS.forEach(function (q) {
      if (!q.dim) return;
      var o = q.options.find(function (x) { return x.v === a[q.id]; });
      if (o) { dims[q.dim] = o.pts; total += o.pts; }
    });
    var archKey = a.stage || 'exploring';
    var arch = S.archetypes[archKey];
    // An explorer can't be told to "ask for money" yet, so proof and reach aren't eligible.
    var eligible = archKey === 'exploring' ? ['focus', 'validation', 'execution'] : ['validation', 'proof', 'focus', 'reach', 'execution'];
    var weakest = eligible.reduce(function (w, d) { return dims[d] < dims[w] ? d : w; }, eligible[0]);
    var band = S.bands.find(function (b) { return total >= b.min; });
    var hoursOpt = QS[5].options.find(function (o) { return o.v === a.hours; }) || {};
    var trimmed = hoursOpt.time === 'lt3';
    var track = S.tracks[arch.track];
    var goal = arch.goal;
    if (archKey === 'launched' && a.paid === 'no') goal = 'launch';
    if (archKey === 'growing' && a.blocker === 'attention') goal = 'audience';
    return { total: total, dims: dims, archKey: archKey, arch: arch, weakest: weakest, band: band, track: track, trimmed: trimmed, goal: goal, time: hoursOpt.time || 'lt3' };
  }

  // ---------- intro ----------
  // The intro markup lives in score.html (paints before JS). Keep a copy to re-render it on "Retake".
  var INTRO = document.getElementById('intro') ? document.getElementById('intro').outerHTML : '';
  var introShown = !!INTRO;
  function intro() {
    state.step = -1; progress();
    if (!introShown || !document.getElementById('intro')) render(INTRO);
    introShown = false;
    var slot = document.getElementById('sharedSlot');
    if (slot && sharedArch) {
      slot.innerHTML = '<div class="card accent" style="margin-bottom:22px"><div class="label lilac">Shared with you</div><p style="margin:8px 0 0" class="fog">Someone you know is a <b style="color:var(--c-ink)">' + esc(sharedArch.name) + '</b> with a Founder Score of <span class="mono" style="color:var(--c-ink)">' + sharedArch.score + '/100</span>. What are you?</p></div>';
    }
    document.getElementById('go').onclick = function () { K.track('Quiz Start', { shared: !!sharedArch }); state.step = 0; question(); };
  }

  // ---------- questions ----------
  function question() {
    var q = QS[state.step]; progress();
    var html = '<div class="q-shell"><div class="q-count">' + String(state.step + 1).padStart(2, '0') + ' / ' + String(QS.length).padStart(2, '0') + '</div>' +
      '<h2 class="q-title">' + esc(q.title) + '</h2>' + (q.sub ? '<p class="q-sub">' + esc(q.sub) + '</p>' : '') +
      '<div class="opts" role="listbox" aria-label="' + esc(q.title) + '">';
    q.options.forEach(function (o, i) {
      var on = state.a[q.id] === o.v;
      html += '<button type="button" role="option" aria-selected="' + on + '" class="opt' + (on ? ' on' : '') + '" data-v="' + esc(o.v) + '">' +
        '<span class="key">' + (i + 1) + '</span><span><span class="lbl">' + esc(o.label) + '</span>' + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + '</span></button>';
    });
    html += '</div><div class="q-nav"><button class="q-back" id="back">← Back</button><span class="tiny slate">Tap to answer</span></div></div>';
    render(html);
    document.getElementById('foot').hidden = true;
    document.getElementById('back').onclick = back;
    Array.prototype.forEach.call(app.querySelectorAll('.opt'), function (b) {
      b.onclick = function () { pick(q, b.getAttribute('data-v'), b); };
    });
  }
  function pick(q, v, btn) {
    state.a[q.id] = v; save();
    Array.prototype.forEach.call(app.querySelectorAll('.opt'), function (x) { x.classList.toggle('on', x === btn); });
    setTimeout(next, 220);
  }
  function next() {
    if (state.step < QS.length - 1) { state.step++; question(); }
    else { state.step = QS.length; progress(); calculating(); }
  }
  function back() { if (state.step <= 0) { intro(); document.getElementById('foot').hidden = false; } else { state.step--; question(); } }

  document.addEventListener('keydown', function (e) {
    if (state.step < 0 || state.step >= QS.length) return;
    var q = QS[state.step];
    if (/^[1-9]$/.test(e.key)) {
      var i = parseInt(e.key, 10) - 1, btns = app.querySelectorAll('.opt');
      if (q.options[i] && btns[i]) pick(q, q.options[i].v, btns[i]);
    }
    if (e.key === 'Escape' || e.key === 'Backspace') back();
  });

  // ---------- calculating ----------
  function calculating() {
    render('<div class="q-shell center"><div class="label">Scoring your answers</div><h2 class="h2 steel" style="margin-top:14px">Building your roadmap…</h2><div class="thinking" style="max-width:320px;margin:28px auto 0"><div class="line"></div><div class="line" style="width:80%"></div><div class="line" style="width:60%"></div></div></div>');
    var r = compute(state.a);
    K.track('Quiz Complete', { archetype: r.arch.name, score: r.total, stage: r.archKey });
    setTimeout(function () { results(r); }, 1100);
  }

  // ---------- results ----------
  // Before the email: archetype, score, bars, band and the reasons, then the gate (quiz-results.md §1).
  // After it: the #1 move, the roadmap preview and the block for the launch state (A1, A2, B or C).
  var sticky = null;
  function results(r) {
    document.getElementById('foot').hidden = false;
    var bars = Object.keys(S.dims).map(function (d) {
      return '<div class="bar-row' + (d === r.weakest ? ' low' : '') + '"><span class="name">' + S.dims[d] + '</span><div class="bar"><span data-w="' + (r.dims[d] / 20 * 100) + '"></span></div><span class="val">' + r.dims[d] + '/20</span></div>';
    }).join('');

    var html =
      '<section class="narrow score-hero">' +
        '<div class="label">Your Founder Score</div>' +
        '<p class="fog" style="margin:18px 0 0;font-size:20px;letter-spacing:-.02em">You\'re ' + article(r.arch.name) + '</p>' +
        '<h1 class="h-display steel" style="margin:2px 0 14px">' + esc(r.arch.name) + '</h1>' +
        '<p class="lede" style="color:var(--c-ink)">' + esc(r.arch.tagline) + '</p>' +
      '</section>' +

      '<section class="narrow" style="padding-top:22px"><div class="card halo">' +
        '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:22px">' +
          '<div class="score-big steel"><span id="count">0</span><small>/100</small></div>' +
          '<span class="chip lilac">' + esc(r.band.label) + '</span>' +
        '</div>' +
        '<div class="bars">' + bars + '</div>' +
        '<p class="small fog" style="margin:20px 0 0">' + esc(r.band.note) + '</p>' +
      '</div></section>' +

      '<section class="narrow" id="reasons" style="padding-top:14px"><div class="card">' +
        '<div class="label">Why you got this score.</div>' +
        '<ul class="reasons">' + reasons(r) + '</ul>' +
      '</div></section>' +

      '<section class="narrow" id="gateWrap" style="padding-top:14px"></section>' +
      '<div id="after"></div>' +

      // Share
      '<section class="narrow section" style="padding-bottom:20px"><div class="card">' +
        '<div class="label">Share your result</div>' +
        '<p class="fog small" style="margin:8px 0 16px">Post your card to your story and see what your friends get.</p>' +
        '<img class="share-preview" id="sharePrev" alt="Your Founder Score card">' +
        '<div class="row" style="margin-top:16px"><button class="btn block" id="shareBtn">Share my card</button>' +
        '<button class="btn ghost block" id="copyLink">Copy link</button></div>' +
      '</div></section>' +

      '<section class="narrow section" style="padding-top:0">' + K.R.who() +
        '<div class="row" style="justify-content:center;margin-top:22px;gap:18px">' +
          '<a class="link" href="' + K.href('/idea-test') + '\">Test an idea free</a>' +
          '<a class="link" href="' + K.href('/stack') + '\">Get the Day One Stack</a>' +
          '<button class="link" id="retake">Retake</button>' +
        '</div>' +
      '</section>';
    render(html);

    // animate
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(app.querySelectorAll('.bar span[data-w]'), function (s) { s.style.width = s.getAttribute('data-w') + '%'; });
      countUp(document.getElementById('count'), r.total);
    });
    if ('IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        K.track('qr_reasons_view', { archetype: r.arch.name, band: r.band.label }); seen.disconnect();
      }, { threshold: 0.4 });
      seen.observe(document.getElementById('reasons'));
    }

    if (state.unlocked) after(r);
    else {
      var wrap = document.getElementById('gateWrap');
      K.R.gate(wrap, {
        magnet: 'score',
        data: function () { return { archetype: r.arch.name, score: r.total, stage: r.archKey, track: r.track.name, weakest: r.weakest, blocker: state.a.blocker || null, dims: r.dims, answers: state.a }; },
        onDone: function () {
          K.track('Lead', { source: 'founder-score', archetype: r.arch.name });
          state.unlocked = true; save(); writeOnboarding(r);
          if (sticky) { sticky.remove(); sticky = null; }
          wrap.innerHTML = '';
          after(r);
          document.getElementById('after').scrollIntoView({ behavior: 'smooth', block: 'start' });
          setupShare(r);
        },
      });
      sticky = K.R.sticky(wrap, 'score');
    }
    document.getElementById('retake').onclick = function () {
      if (sticky) { sticky.remove(); sticky = null; }
      state.a = {}; state.unlocked = false; save(); state.step = 0; question();
    };
    setupShare(r);
  }

  function article(w) { return /^[AEIOU]/i.test(w) ? 'an' : 'a'; }

  // §4: one line per answer, points from score-data.js, the weakest part in lilac.
  function reasons(r) {
    var stage = QS[0].options.find(function (o) { return o.v === state.a.stage; });
    var out = ['<li><b>Because you said "' + esc(stage.label) + '"</b>, you\'re ' + article(r.arch.name) + ' ' + esc(r.arch.name) + '.</li>'];
    QS.forEach(function (q) {
      if (!q.dim) return;
      var o = q.options.find(function (x) { return x.v === state.a[q.id]; });
      out.push('<li' + (q.dim === r.weakest ? ' class="low"' : '') + '><b>Because you said "' + esc(o.label) + '": ' + esc(S.dims[q.dim]) + ' ' + o.pts + '/20.</b> ' + esc(o.reason || '') + '</li>');
    });
    var bq = QS.find(function (q) { return q.id === 'blocker'; });
    var bo = bq && bq.options.find(function (x) { return x.v === state.a.blocker; });
    if (bo && S.blockerNotes[bo.v]) out.push('<li><b>Because you said "' + esc(bo.label) + '":</b> ' + esc(S.blockerNotes[bo.v]) + '</li>');
    return out.join('');
  }

  function after(r) {
    var move = S.moves[r.weakest];
    var w1 = r.track.weeks[0].tasks.slice(0, r.trimmed ? 2 : 3);
    var t = w1.map(function (x, i) {
      return '<div class="task"><span class="n">' + (i + 1) + '</span><div><div class="t">' + esc(x[0]) + '</div><div class="d">' + esc(x[1]) + '</div></div></div>';
    }).join('');
    var later = r.track.weeks.slice(1).map(function (w, i) {
      return '<div class="week-head" style="padding:12px 0 0;border-top:1px solid var(--c-line);margin-top:12px"><span class="label">Week ' + (i + 2) + '</span><span class="small fog">' + esc(w.theme) + '</span></div>';
    }).join('');
    document.getElementById('after').innerHTML =
      '<section class="narrow" style="padding-top:14px"><div class="card accent">' +
        '<div class="label lilac">Your #1 move this week</div>' +
        '<h3 class="h3" style="margin:10px 0 8px">' + esc(move.title) + '</h3>' +
        '<p class="fog" style="margin:0">' + esc(move.body) + '</p>' +
      '</div></section>' +

      '<section class="narrow" id="plan" style="padding-top:20px">' +
        '<div class="label">Your roadmap preview · ' + esc(r.track.name) + ' track</div>' +
        '<h2 class="h2 steel" style="margin:12px 0 8px">' + esc(r.track.focus) + '</h2>' +
        '<div class="card win" style="margin-top:14px">' +
          '<div class="week-head"><span class="label signal">Week 1</span><span class="small fog">' + esc(r.track.weeks[0].theme) + '</span></div>' + t +
          later +
          '<p class="gate-small" style="margin-top:16px">Weeks 1 and 2 are free in your 127 account. Weeks 3 and 4 come with Builder.</p>' +
        '</div>' +
        '<div id="stateBlock"></div>' +
      '</section>' +

      '<section class="narrow" style="padding-top:28px"><div class="grid-2">' +
        '<div class="card"><div class="label signal">Your edge</div><p style="margin:8px 0 0">' + esc(r.arch.strength) + '</p></div>' +
        '<div class="card"><div class="label">Your trap</div><p style="margin:8px 0 0">' + esc(r.arch.blind) + '</p></div>' +
      '</div>' +
      '<div class="card" style="margin-top:12px"><div class="quote">' + esc(r.arch.principle) + '</div><div class="tiny slate" style="margin-top:10px">Eli Christiansen</div></div>' +
      '</section>';
    K.R.block(document.getElementById('stateBlock'), { magnet: 'score', key: r.archKey, archetype: r.arch.name, onStart: function () { handoff(r); } });
  }

  // Prefill the site's 13-question assessment (public/js/onboarding.js reads this key),
  // then open /start on question 2 with the stage already answered.
  function writeOnboarding(r) {
    try {
      var KEY = '127-onboarding';
      var cur = JSON.parse(localStorage.getItem(KEY) || 'null') || { answers: {} };
      var a = cur.answers || {};
      a.stage = r.archKey; a.goal = r.goal; a.time = r.time;
      if (state.a.blocker) a.obstacles = [state.a.blocker];
      localStorage.setItem(KEY, JSON.stringify({ answers: a }));
    } catch (e) {}
  }
  function handoff(r) {
    writeOnboarding(r);
    K.track('Signup Click', { source: 'founder-score' });
    var q = '?stage=' + encodeURIComponent(r.archKey) + '&from=score';
    var u = K.utm(); if (u.utm_campaign) q += '&utm_campaign=' + encodeURIComponent(u.utm_campaign);
    location.href = K.href('/start') + q;
  }

  function countUp(el, to) {
    if (!el) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
    var t0 = performance.now(), d = 900;
    (function step(t) { var p = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  // ---------- share card (1080x1920, story format) ----------
  // After the email, the share link carries their code, so a friend who takes the score and joins counts toward Bring 3.
  function shareUrl(r) {
    var code = K.R.lead('score').referral_code;
    return SHARE_BASE + '?r=' + r.arch.name.toLowerCase() + '&s=' + r.total + (code ? '&ref=' + encodeURIComponent(code) : '');
  }

  function setupShare(r) {
    var img = document.getElementById('sharePrev');
    drawCard(r).then(function (canvas) {
      img.src = canvas.toDataURL('image/png');
      document.getElementById('shareBtn').onclick = function () {
        K.track('Share', { method: 'card', archetype: r.arch.name });
        canvas.toBlob(function (blob) {
          var file = new File([blob], '127-founder-score.png', { type: 'image/png' });
          var text = "I'm a " + r.arch.name + ' (' + r.total + '/100). What kind of founder are you?';
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], text: text + ' ' + shareUrl(r) }).catch(function () {});
          } else {
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '127-founder-score.png';
            document.body.appendChild(a); a.click(); a.remove(); K.toast('Card saved');
          }
        }, 'image/png');
      };
    });
    document.getElementById('copyLink').onclick = function () { K.track('Share', { method: 'link' }); K.copy(shareUrl(r)); };
  }

  function drawCard(r) {
    var W = 1080, H = 1920;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var fonts = ['700 200px Geist', '500 40px Geist', '400 40px Geist', '500 36px "Geist Mono"'];
    var ready = document.fonts && document.fonts.load ? Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).catch(function () {}) : Promise.resolve();
    return ready.then(function () {
      var SANS = 'Geist, "Helvetica Neue", Arial, sans-serif', MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
      x.fillStyle = '#060607'; x.fillRect(0, 0, W, H);
      // grid
      x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
      for (var gx = 0; gx <= W; gx += 72) { x.beginPath(); x.moveTo(gx + .5, 0); x.lineTo(gx + .5, H); x.stroke(); }
      for (var gy = 0; gy <= H; gy += 72) { x.beginPath(); x.moveTo(0, gy + .5); x.lineTo(W, gy + .5); x.stroke(); }
      var fade = x.createLinearGradient(0, 0, 0, H); fade.addColorStop(0, 'rgba(6,6,7,0)'); fade.addColorStop(.45, 'rgba(6,6,7,.85)'); fade.addColorStop(1, 'rgba(6,6,7,1)');
      x.fillStyle = fade; x.fillRect(0, 0, W, H);
      var glow = x.createRadialGradient(W / 2, 260, 0, W / 2, 260, 700); glow.addColorStop(0, 'rgba(184,191,255,0.18)'); glow.addColorStop(1, 'rgba(184,191,255,0)');
      x.fillStyle = glow; x.fillRect(0, 0, W, H);

      var L = 96;
      // mark
      x.textBaseline = 'alphabetic';
      steelText(x, '127', L, 190, '700 72px ' + SANS, 60, -4);
      // label
      spaced(x, 'FOUNDER SCORE', L, 420, '500 28px ' + SANS, '#7b7b86', 7);
      // "I'm a"
      x.font = '400 56px ' + SANS; x.fillStyle = '#b3b3bd'; x.fillText("I'm a", L, 540);
      // archetype (fit to width)
      var size = 210, name = r.arch.name;
      x.font = '700 ' + size + 'px ' + SANS;
      while (measureTight(x, name, -0.05 * size) > W - L * 2 && size > 90) { size -= 6; x.font = '700 ' + size + 'px ' + SANS; }
      steelText(x, name, L, 540 + size * 0.95, '700 ' + size + 'px ' + SANS, size, -0.05 * size);
      var y = 540 + size * 0.95 + 120;
      // score
      steelText(x, String(r.total), L, y + 150, '700 200px ' + SANS, 180, -10);
      var sw = measureTight(x, String(r.total), -10);
      x.font = '500 56px ' + MONO; x.fillStyle = '#7b7b86'; x.fillText('/100', L + sw + 18, y + 150);
      // band chip
      x.font = '500 26px ' + SANS;
      var chip = r.band.label.toUpperCase(), cw = spacedWidth(x, chip, 5) + 56;
      roundRect(x, W - L - cw, y + 92, cw, 64, 32); x.strokeStyle = 'rgba(184,191,255,0.45)'; x.lineWidth = 2; x.stroke();
      spaced(x, chip, W - L - cw + 28, y + 133, '500 26px ' + SANS, '#b8bfff', 5);
      // bars
      var by = y + 270, bw = W - L * 2 - 260 - 150;
      Object.keys(S.dims).forEach(function (d, i) {
        var yy = by + i * 84;
        x.font = '500 36px ' + SANS; x.fillStyle = d === r.weakest ? '#ededf2' : '#b3b3bd'; x.fillText(S.dims[d], L, yy);
        roundRect(x, L + 260, yy - 18, bw, 14, 7); x.fillStyle = '#1b1b20'; x.fill();
        var fw = Math.max(14, bw * r.dims[d] / 20);
        roundRect(x, L + 260, yy - 18, fw, 14, 7); x.fillStyle = d === r.weakest ? '#b8bfff' : '#e3e6f1'; x.fill();
        x.font = '500 30px ' + MONO; x.fillStyle = '#7b7b86'; x.textAlign = 'right'; x.fillText(r.dims[d] + '/20', W - L, yy); x.textAlign = 'left';
      });
      // tagline
      var ty = by + 5 * 84 + 40;
      x.font = '500 42px ' + SANS; x.fillStyle = '#ededf2';
      wrap(x, r.arch.tagline, L, ty, W - L * 2, 56);
      // footer
      x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 2; x.beginPath(); x.moveTo(L, H - 230); x.lineTo(W - L, H - 230); x.stroke();
      x.font = '600 46px ' + SANS; x.fillStyle = '#ededf2'; x.fillText('What kind of founder are you?', L, H - 150);
      x.font = '500 36px ' + MONO; x.fillStyle = '#b8bfff'; x.fillText('127group.io/score', L, H - 92);
      return c;
    });
  }
  function measureTight(x, t, ls) { return x.measureText(t).width + ls * (t.length - 1); }
  function steelText(x, t, px, py, font, h, ls) {
    x.font = font;
    var g = x.createLinearGradient(0, py - h, 0, py + h * 0.1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#c9cad3'); g.addColorStop(1, '#7f808c');
    x.fillStyle = g;
    var cx = px;
    for (var i = 0; i < t.length; i++) { x.fillText(t[i], cx, py); cx += x.measureText(t[i]).width + ls; }
  }
  function spaced(x, t, px, py, font, color, ls) { x.font = font; x.fillStyle = color; var cx = px; for (var i = 0; i < t.length; i++) { x.fillText(t[i], cx, py); cx += x.measureText(t[i]).width + ls; } }
  function spacedWidth(x, t, ls) { var w = 0; for (var i = 0; i < t.length; i++) w += x.measureText(t[i]).width + ls; return w - ls; }
  function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function wrap(x, t, px, py, max, lh) {
    var words = t.split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(test).width > max && line) { x.fillText(line, px, py); line = words[i]; py += lh; } else line = test;
    }
    if (line) x.fillText(line, px, py);
  }

  // ---------- boot ----------
  // Returning visitor who already finished: show their result again.
  var done = QS.every(function (q) { return state.a[q.id]; });
  if (done && params.get('retake') !== '1' && !sharedArch) results(compute(state.a));
  else intro();
})();
