// The front doors' page (door.html, lib/doors.js): the form from window.DOOR, the streamed run
// (POST /api/door/:id/run), the result with its free part before the email and the rest after it,
// then Free next to Builder and the way into 127 HQ. A saved result (window.DOOR_RUN, the email's
// link) opens unlocked. Copy lives in doors-data.js.
(function () {
  var K = window.K127, R = K.R, RD = window.RESULTS, esc = K.esc, C = window.DOOR;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('doorForm'), err = $('err'), go = $('go');
  $('who').innerHTML = R.who();
  // A copy of the page with no server behind it has nothing to run on.
  if (!C) {
    $('h1').textContent = 'Free tools from 127';
    $('lede').textContent = 'This tool runs on 127group.io.';
    $('formWrap').hidden = true;
    return;
  }
  var M = C.id, LAST = '127-door-' + M;
  var st = { run: null, unlocked: false, sticky: null };
  // The email gate's copy for this door (results-kit.js reads it by magnet).
  RD.gate[M] = C.gate;

  var fill = function (s, v) { return String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? String(v[k]) : m; }); };
  var link = function (u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; };
  var dayOf = function (ymd) {
    var t = new Date(String(ymd || '').slice(0, 10) + 'T12:00:00Z');
    return isNaN(t) ? '' : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  };
  var size = function (b) { return b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var usd = function (n) { n = Number(n); return '$' + (n % 1 ? n.toFixed(2) : String(n)); };
  var label = function (t) { return '<div class="label">' + esc(t) + '</div>'; };

  // ---------- the form ----------
  $('chip').textContent = C.chip;
  $('h1').textContent = C.h1;
  $('lede').textContent = C.lede;
  $('note').textContent = C.note || '';
  var button = function () { go.innerHTML = esc(C.button) + ' <span class="arrow"></span>'; };
  button();
  $('stack').innerHTML = C.free.map(function (t) { return '<li><span class="ck" aria-hidden="true"></span><span>' + esc(t) + '</span></li>'; }).join('');
  $('fields').innerHTML = C.fields.map(field).join('');

  function field(f) {
    var id = 'd-' + f.name;
    var attrs = ' id="' + id + '" name="' + esc(f.name) + '"' + (f.required ? ' required' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (f.auto ? ' autocomplete="' + esc(f.auto) + '"' : '');
    var box;
    // A box the visitor ticks themselves (Legal G3's "I own or run this store"): never ticked from a link or last time.
    if (f.type === 'checkbox') return '<label class="check-row" for="' + id + '"><input type="checkbox"' + attrs + '> ' + esc(f.label) + '</label>';
    if (f.type === 'select') box = '<select class="input"' + attrs + '>' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'textarea') box = '<textarea class="input" rows="4" maxlength="' + (f.max || 1000) + '"' + attrs + '></textarea>';
    else if (f.type === 'number') box = '<input class="input" type="number" inputmode="decimal" step="any" min="' + (f.min || 0) + '" max="' + (f.max || 100000) + '"' + attrs + '>';
    else box = '<input class="input" type="' + (f.auto === 'email' ? 'email' : 'text') + '" maxlength="' + (f.max || 200) + '"' + (f.auto === 'url' ? ' inputmode="url" autocapitalize="off" spellcheck="false"' : '') + attrs + '>';
    return '<label class="field" for="' + id + '"><span>' + esc(f.label) + '</span>' + box + '</label>';
  }
  function values() {
    var v = {};
    C.fields.forEach(function (f) { var el = form.elements[f.name]; v[f.name] = !el ? '' : f.type === 'checkbox' ? !!el.checked : String(el.value || '').trim(); });
    return v;
  }
  function setValues(v) {
    C.fields.forEach(function (f) {
      var el = form.elements[f.name], val = v && v[f.name];
      if (!el || f.type === 'checkbox' || val == null || val === '') return;
      val = String(val).slice(0, f.type === 'number' ? 12 : f.max || 200);
      if (f.type === 'select' && !f.options.some(function (o) { return o[0] === val; })) return;
      el.value = val;
    });
  }
  var ready = function () { var v = values(); return C.fields.every(function (f) { return !f.required || v[f.name]; }); };
  var submit = function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); };

  // Ads and ManyChat can open a finished result: /store-audit?store=yourstore.com&go=1
  (function prefill() {
    var p = new URLSearchParams(location.search), last = {}, q = {};
    try { last = JSON.parse(localStorage.getItem(LAST) || '{}') || {}; } catch (e) {}
    C.fields.forEach(function (f) { if (p.get(f.name)) q[f.name] = p.get(f.name); });
    setValues(last);
    setValues(q);
    if (p.get('go') !== '1' || window.DOOR_RUN) return;
    if (ready()) return setTimeout(submit, 60);
    // Something only the visitor can give (like the owner box): take them to it.
    var v = values(), miss = C.fields.filter(function (f) { return f.required && !v[f.name]; })[0];
    if (miss && form.elements[miss.name]) form.elements[miss.name].focus();
  })();

  if (C.sample) {
    $('sample').textContent = C.sample.label;
    $('sample').hidden = false;
    // A sample runs on made-up details, so it skips the form's own checks (a sample store needs no owner box).
    $('sample').onclick = function () {
      if (go.disabled) return;
      form.reset();
      setValues(C.sample.values);
      K.track('Door Sample', { door: M });
      start(values());
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (go.disabled || form.website.value) return;
    var input = values(), box = C.fields.filter(function (f) { return f.type === 'checkbox' && f.required && !input[f.name]; })[0];
    if (box) { fail(C.ownerError || C.copy.failed); form.elements[box.name].focus(); return; }
    start(input);
  });
  function start(input) {
    err.hidden = true;
    var keep = {};
    C.fields.forEach(function (f) { if (f.type !== 'checkbox') keep[f.name] = input[f.name]; });
    try { localStorage.setItem(LAST, JSON.stringify(keep)); } catch (x) {}
    K.track(C.track, { door: M });
    runIt(input);
  }
  function fail(msg) { err.textContent = msg; err.hidden = false; }

  // ---------- the run ----------
  function runIt(input) {
    go.disabled = true;
    go.innerHTML = '<span class="spinner"></span>';
    serverRun(input).then(function (got) {
      finishScan();
      K.track('Door Result', { door: M, ok: got.run ? 'yes' : 'no', sample: got.run && got.run.sample ? 'yes' : 'no' });
      setTimeout(function () { if (got.run) show(got.run); else showFailed(got.failed); }, 500);
    }, function (ex) {
      $('scan').hidden = true; $('intro').hidden = false; $('formWrap').hidden = false; $('whoWrap').hidden = false;
      fail(ex.message || C.copy.failed);
    }).then(function () { go.disabled = false; button(); });
  }

  // The server checks the form before it starts, so a bad entry comes back as plain JSON and the
  // steps only show once the run has begun. Then each step ticks off as it happens (NDJSON).
  function serverRun(input) {
    var body = JSON.stringify(Object.assign({}, input, { utm: K.utm() }));
    return fetch('/api/door/' + encodeURIComponent(M) + '/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body }).then(function (r) {
      var type = r.headers.get('content-type') || '';
      if (!/ndjson/.test(type)) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || C.copy.failed); });
      startScan(input);
      var result = null, failed = null, failure = null, buf = '';
      var handle = function (line) {
        if (!line.trim()) return;
        var m; try { m = JSON.parse(line); } catch (e) { return; }
        if (m.type === 'progress') step(m.step);
        else if (m.type === 'result') result = m.run;
        else if (m.type === 'failed') failed = m.result;
        else if (m.type === 'error') failure = m.error;
      };
      var done = function () {
        handle(buf);
        if (failure) throw new Error(failure);
        if (failed) return { failed: failed };
        if (!result) throw new Error(C.copy.failed);
        return { run: result };
      };
      if (!r.body || !r.body.getReader || !window.TextDecoder) return r.text().then(function (t) { t.split('\n').forEach(handle); buf = ''; return done(); });
      var reader = r.body.getReader(), dec = new TextDecoder();
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return done();
          buf += dec.decode(x.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(handle);
          return pump();
        });
      })();
    });
  }

  function startScan(input) {
    $('intro').hidden = true; $('formWrap').hidden = true; $('result').hidden = true; $('whoWrap').hidden = true;
    $('scan').hidden = false;
    $('scanLabel').textContent = C.copy.running;
    $('scanTitle').textContent = fill(C.scan, input);
    $('log').innerHTML = C.progress.map(function (t, i) { return '<li data-s="' + i + '"><span class="ic"></span><span class="tx">' + esc(t) + '</span><span class="val"></span></li>'; }).join('');
    $('meter').style.width = '6%';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    step(0);
  }
  function step(i) {
    i = Math.max(0, Math.min(C.progress.length - 1, Number(i) || 0));
    Array.prototype.forEach.call($('log').children, function (li, j) {
      if (j < i) li.classList.add('on', 'done');
      if (j === i) li.classList.add('on');
    });
    $('meter').style.width = [12, 40, 68, 90][i] + '%';
  }
  function finishScan() {
    Array.prototype.forEach.call($('log').children, function (li) { li.classList.add('on', 'done'); });
    $('meter').style.width = '100%';
  }

  // ---------- the result ----------
  // Copy buttons point into this list, so long messages never sit in an attribute.
  var T = [];
  var cp = function (text, kind) { T.push(String(text || '')); return '<button type="button" class="dr-copy" data-copy="' + (T.length - 1) + '" data-kind="' + esc(kind || '') + '">Copy</button>'; };
  var msg = function (title, text, kind) { return '<div class="dr-msg-head"><span>' + esc(title) + '</span>' + cp(text, kind) + '</div><div class="dr-msg">' + esc(text) + '</div>'; };
  var fileOf = function (run, key) { return (run.files || []).filter(function (f) { return f.key === key; })[0] || null; };
  // A page we built, shown in a frame with scripts, forms and outside requests off (and the same on the server).
  var frame = function (src, title) { return '<div class="dr-frame"><iframe src="' + esc(src) + '" sandbox="" loading="lazy" referrerpolicy="no-referrer" title="' + esc(title) + '"></iframe></div>'; };

  function show(run) {
    st.run = run;
    $('scan').hidden = true; $('intro').hidden = true; $('formWrap').hidden = true; $('whoWrap').hidden = false;
    var el = $('result');
    el.hidden = false;
    el.innerHTML = '<div class="dr-head">' + head(run) + '</div><div id="free"></div><div id="gateWrap" style="margin-top:14px"></div><div id="full"></div><div id="after"></div>';
    draw();
    if (!st.unlocked) {
      var gate = $('gateWrap');
      R.gate(gate, {
        magnet: M,
        copy: DRAW[M].gate ? DRAW[M].gate(run) : null,
        before: DRAW[M].tease(run),
        data: function () { return { run_id: run.id, k: run.k, door: M }; },
        onDone: function () {
          st.unlocked = true;
          if (st.sticky) st.sticky.remove();
          gate.innerHTML = '';
          draw();
          drawAfter();
          K.track('Door Unlock', { door: M });
          // The address bar now holds the saved result, the same link as the email's.
          try { history.replaceState(null, '', '/door/r/' + encodeURIComponent(run.id) + '?k=' + encodeURIComponent(run.k)); } catch (x) {}
          $('full').scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      });
      var f = gate.querySelector('form');
      if (f && f.name && run.input && run.input.name && !f.name.value) f.name.value = run.input.name;
      st.sticky = R.sticky(gate, M);
    } else drawAfter();
    window.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' });
  }

  function draw() {
    T = [];
    $('free').innerHTML = DRAW[M].free(st.run);
    $('full').innerHTML = st.unlocked ? DRAW[M].full(st.run) + files(st.run) : '';
    var fix = $('result').querySelector('form.dr-fix');
    if (fix) fix.onsubmit = rebuild;
  }

  function head(run) {
    var x = run.result, h, sub;
    if (M === 'store') {
      h = fill(C.result.heading, { score: x.score });
      sub = [x.store.name, x.store.products != null ? x.store.products + ' products' : '', x.grade].filter(Boolean).join(' · ');
    } else if (M === 'creator') {
      h = fill(C.result.heading, { n: x.brands.length, category: String(x.label).toLowerCase().replace(/ products$/, '') });
      // Legal G4: public facts, with their sources.
      sub = fill(C.result.read, { date: dayOf(x.checked) }) + ' ' + C.result.sources;
    } else if (M === 'site') {
      h = C.result.heading;
      sub = fill(C.result.design, { design: x.designName, business: x.business }) + (x.why ? ' ' + x.why : '');
    } else {
      h = fill(C.result.heading, { score: x.score });
      // Legal part 5: the score isn't a prediction.
      sub = C.result.reads + (x.after != null ? ' ' + fill(C.result.after, { after: x.after }) : '');
    }
    return '<div class="label lilac">' + esc(C.title.replace(/ · 127$/, '')) + '</div>' +
      '<h2 class="h1 steel">' + esc(h) + '</h2>' +
      (sub ? '<p class="dr-sub">' + esc(sub) + '</p>' : '') +
      (run.sample || run.capped ? '<div class="f25-banner">' + esc(run.capped ? C.copy.capped : C.copy.sample) + '</div>' : '');
  }

  function files(run) {
    if (!run.files || !run.files.length) return '';
    return '<div class="dr-sec">' + label(C.copy.files) + '<div class="dr-files">' + run.files.map(function (f) {
      return '<div class="dr-file"><span>' + esc(f.label) + '<small>' + esc(f.name) + ' · ' + size(f.bytes) + '</small></span><span class="row">' +
        (f.open ? '<a class="btn ghost" href="' + esc(f.open) + '" target="_blank" rel="noopener" data-file="' + esc(f.key) + '">' + esc(C.copy.fileOpen) + '</a>' : '') +
        '<a class="btn" href="' + esc(f.url) + '" download="' + esc(f.name) + '" data-file="' + esc(f.key) + '">' + esc(C.copy.fileGet) + '</a></span></div>';
    }).join('') + '</div></div>';
  }

  // Each door: free (before the email), tease (above the gate), full (after it).
  var DRAW = {
    store: {
      free: function (run) {
        var x = run.result, n = x.numbers || {};
        var tiles = ['<div class="f25-stat lead"><b>' + x.score + '<small>/100</small></b><span>' + esc(x.grade || '') + '</span></div>'];
        if (n.photos != null) tiles.push('<div class="f25-stat"><b>' + n.photos + '</b><span>' + esc(C.result.photos) + '</span></div>');
        if (n.words != null) tiles.push('<div class="f25-stat"><b>' + n.words + '</b><span>' + esc(C.result.words) + '</span></div>');
        return '<div class="f25-stats">' + tiles.join('') + '</div>' +
          (x.store.note ? '<p class="dr-sub">' + esc(x.store.note) + '</p>' : '') +
          (x.reason ? '<p class="dr-sub">' + esc(x.reason) + '</p>' : '') +
          (x.fixes.length ? '<div class="dr-sec">' + label(C.result.fixes) + x.fixes.slice(0, 3).map(fix).join('') + '</div>' : '');
      },
      tease: function (run) {
        var more = run.result.fixes.length - 3;
        return more > 0 ? '<p class="dr-more">' + esc(fill(C.result.more, { n: more })) + '</p>' : '';
      },
      full: function (run) {
        var x = run.result, mock = fileOf(run, 'mock');
        return (x.fixes.length > 3 ? '<div class="dr-sec">' + x.fixes.slice(3).map(function (f, i) { return fix(f, i + 3); }).join('') + '</div>' : '') +
          (x.strengths.length ? '<div class="dr-sec">' + label(C.result.strengths) + '<ul class="f25-stack-list">' + x.strengths.map(function (s) { return '<li><span class="ck" aria-hidden="true"></span><span>' + esc(s) + '</span></li>'; }).join('') + '</ul></div>' : '') +
          (x.mock ? '<div class="dr-sec">' + label(C.result.mock) + '<span class="dr-tag hi">' + esc(C.result.mockTag) + '</span><p class="dr-sub">' + esc(fill(C.result.mockLine, { product: x.mock.product.title })) + '</p>' +
            (mock && mock.open ? frame(mock.open, C.result.mockTag + ': ' + C.result.mock) : '') +
            (x.mock.notes.length ? '<ol class="dr-steps">' + x.mock.notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') + '</div>' : '');
      },
    },

    creator: {
      free: function (run) {
        var x = run.result;
        return (x.widened && x.widened.length ? '<p class="dr-sub">' + esc(fill(C.result.widened, { kinds: x.widened.join(', ').toLowerCase() })) + '</p>' : '') +
          '<div class="dr-sec">' + label(C.result.top) + x.brands.slice(0, 5).map(brand).join('') + '</div>';
      },
      tease: function (run) {
        var more = run.result.brands.length - 5;
        return more > 0 ? '<p class="dr-more">' + esc(fill(C.result.more, { n: more })) + '</p>' : '';
      },
      full: function (run) {
        var x = run.result;
        return (x.brands.length > 5 ? '<div class="dr-sec">' + x.brands.slice(5).map(brand).join('') + '</div>' : '') + brief(x.brief);
      },
    },

    site: {
      free: function (run) {
        var p = fileOf(run, 'preview');
        return (p && p.open ? '<div class="dr-sec">' + label(C.result.preview) + frame(p.open, C.result.preview) + '</div>' : '') +
          // What the site still needs sits under the page until the email gate, then heads the steps.
          (!st.unlocked && run.result.ready === false ? '<div class="dr-sec">' + almost(run) + '</div>' : '');
      },
      tease: function () { return ''; },
      // Legal D49: while the build lists what's missing, the gate doesn't call the site ready.
      gate: function (run) { return run.result.ready === false ? C.gateAlmost : null; },
      full: function (run) {
        var x = run.result;
        return '<div class="dr-sec">' + (x.ready === false ? almost(run) + '<p class="dr-sub">' + esc(C.result.then) + '</p>' : label(C.result.deploy)) + '<ol class="dr-steps">' + C.result.deploySteps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol><p class="dr-sub">' + esc(C.result.yours) + '</p></div>' +
          (x.share.length ? '<div class="dr-sec">' + label(C.result.share) + x.share.map(function (s) { return msg(s.label, s.text, 'share'); }).join('') + '</div>' : '') +
          (x.photos.length ? '<div class="dr-sec">' + label(C.result.photos) + '<p class="dr-sub">' + esc(C.result.photosLine) + '</p><table class="dr-rows">' + x.photos.map(function (p) {
            return '<tr><td>' + esc(p.file) + '</td><td>' + esc(p.alt || '') + '</td><td class="num">' + esc(p.size || '') + '</td></tr>';
          }).join('') + '</table></div>' : '');
      },
    },

    offer: {
      free: function (run) {
        var x = run.result;
        return (x.rows.length ? '<div class="dr-sec">' + label(C.result.weigh) + '<table class="dr-rows">' + x.rows.map(function (r) {
          return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.why || '') + '</td><td class="num">' + esc(r.score) + '/10</td></tr>';
        }).join('') + '</table></div>' : '') +
          '<div class="dr-sec">' + label(C.result.fixes) + x.fixes.map(function (f, i) {
            return '<div class="dr-item"><h3><span class="dr-n">' + (i + 1) + '</span>' + esc(f.title) + '</h3>' +
              (f.why ? '<p>' + esc(f.why) + '</p>' : '') +
              (f.line ? '<p class="dr-try"><b>' + esc(C.result.try) + '</b> ' + esc(f.line) + '</p>' : '') +
              (f.points ? '<span class="dr-tag">' + esc(fill(C.result.points, { n: f.points })) + '</span>' : '') + '</div>';
          }).join('') + '</div>';
      },
      tease: function () { return ''; },
      full: function (run) {
        var x = run.result, m = x.magnet;
        return (x.rewrite ? '<div class="dr-sec">' + label(C.result.rewrite) + msg('', x.rewrite, 'rewrite') + '</div>' : '') +
          (m ? '<div class="dr-sec">' + label(fill(C.result.magnet, { title: m.title })) +
            (m.post ? msg(C.result.post, m.post, 'post') : '') +
            (m.keyword ? '<p class="dr-sub">' + esc(fill(C.result.keyword, { keyword: m.keyword })) + '</p>' : '') +
            (m.deliver ? msg(C.result.deliver, m.deliver, 'deliver') : '') + '</div>' : '');
      },
    },
  };

  function fix(f, i) {
    return '<div class="dr-item"><h3><span class="dr-n">' + (i + 1) + '</span>' + esc(f.title) + '</h3>' +
      (f.evidence ? '<p>' + esc(f.evidence) + '</p>' : '') +
      (f.how ? '<p class="dr-try">' + esc(f.how) + '</p>' : '') +
      (f.impact === 'high' ? '<span class="dr-tag hi">' + esc(C.result.high) + '</span>' : '') +
      (f.minutes ? '<span class="dr-tag">' + esc(fill(C.result.minutes, { n: f.minutes })) + '</span>' : '') + '</div>';
  }

  // Legal D49: a site built without what it needs says "Almost ready to put online" and lists it, like README.txt.
  // The email stays optional on the form, so it can be added here and the site built again.
  function almost(run) {
    var x = run.result, F = C.result.fix;
    return label(C.result.almost) + '<ol class="dr-steps">' + x.blockers.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
      '<p class="dr-sub">' + esc(C.result.almostAgain) + '</p>' +
      (run.input && run.input.email ? '' : '<form class="dr-fix" novalidate><input class="input" type="email" name="email" placeholder="' + esc(F.placeholder) + '" aria-label="' + esc(F.label) + '" autocomplete="email" maxlength="120">' +
        '<button class="btn" type="submit">' + esc(F.button) + ' <span class="arrow"></span></button><div class="form-err" hidden></div></form>');
  }
  function rebuild(e) {
    e.preventDefault();
    var f = e.target, v = f.email.value.trim(), er = f.querySelector('.form-err');
    if (!K.validEmail(v)) { er.textContent = C.result.fix.error; er.hidden = false; f.email.focus(); return; }
    if (form.elements.email) form.elements.email.value = v;
    // A new run, so it gets its own result and its own email gate.
    if (st.sticky) st.sticky.remove();
    st.sticky = null;
    st.unlocked = false;
    start(Object.assign({}, st.run.input, { email: v }));
  }

  function brand(b) {
    var R2 = C.result, url = link(b.url), pu = b.product && link(b.product.url), m = b.msg || {};
    var meta = [b.products ? b.products + ' products' : '', b.prices || '', b.country || ''].filter(Boolean).join(' · ');
    return '<div class="dr-item dr-brand"><h3><span class="dr-n">#' + b.rank + '</span>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener nofollow">' + esc(b.name) + ' ↗</a>' : esc(b.name)) + '</h3>' +
      (meta ? '<p>' + esc(meta) + '</p>' : '') +
      (b.product ? '<p class="dr-try"><b>' + esc(R2.film) + '</b> ' + (pu ? '<a href="' + esc(pu) + '" target="_blank" rel="noopener nofollow">' + esc(b.product.title) + '</a>' : esc(b.product.title)) + (b.product.price != null ? ', ' + esc(usd(b.product.price)) : '') + '</p>' : '') +
      ((b.gaps || []).length ? '<p>' + esc(b.gaps.slice(0, 2).join('. ').replace(/\.?$/, '.')) + '</p>' : '') +
      (b.other ? '<span class="dr-tag">' + esc(b.other) + '</span>' : '') +
      (m.dm ? msg(R2.msgs.dm, m.dm, 'dm') : '') +
      (st.unlocked && m.email ? '<details class="dr-details"><summary>' + esc(R2.more2) + '</summary>' +
        '<p class="dr-sub">' + esc(R2.emailNote) + '</p>' +
        msg(R2.msgs.email, 'Subject: ' + m.subject + '\n\n' + m.email, 'email') +
        (m.follow1Email ? msg(R2.msgs.follow1, m.follow1Email, 'follow1') : '') +
        (m.follow2Email ? msg(R2.msgs.follow2, m.follow2Email, 'follow2') : '') + '</details>' : '') +
    '</div>';
  }

  function brief(b) {
    if (!b) return '';
    var R2 = C.result;
    return '<div class="dr-sec">' + label(fill(R2.brief, { brand: b.brand })) +
      '<div class="dr-item"><h3>' + esc(b.title) + '</h3>' + (b.angle ? '<p>' + esc(cap(b.angle)) + '.</p>' : '') +
      (b.lines && b.lines.length ? '<div class="dr-msg-head"><span>' + esc(R2.shots) + '</span></div><ul class="dr-script">' + b.lines.map(function (l) {
        return '<li><b>' + esc(l.at) + '–' + esc(l.end) + 's</b><span>' + esc(l.say || l.caption || '') + '<em>' + esc(l.shot || '') + '</em></span></li>';
      }).join('') + '</ul>' : '') +
      (b.notes && b.notes.length ? '<div class="dr-msg-head"><span>' + esc(R2.notes) + '</span></div><ol class="dr-steps">' + b.notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') +
      // Legal G4: the brief ends with this line.
      '<p class="dr-try">' + esc(R2.disclose) + '</p>' +
    '</div></div>';
  }

  // ---------- after the email: Free next to Builder, then 127 HQ ----------
  function drawAfter() {
    var run = st.run, X = C.copy, H = X.hq, el = $('after');
    var join = '/start/door/' + encodeURIComponent(run.id) + '?k=' + encodeURIComponent(run.k);
    var bring = '/app/hq/import/door/' + encodeURIComponent(run.id) + '?k=' + encodeURIComponent(run.k), signin = '/login?next=' + encodeURIComponent(bring);
    // A signed-in member goes straight to the confirm screen, with no Start free or sign-in.
    var me = R.me();
    // Joining opens with the founding window (state B); before it, the founding list is the next step. After it
    // (state C), and for a member already on a paid plan, the state block's own card is the HQ card, so it isn't
    // shown twice (results-kit.js R.evergreen).
    var L = R.launch(M), hqNow = run.hq && (L.state === 'B' || L.state === 'C'), ever = R.evergreen(L);
    var free = C.free.concat(hqNow ? [H.freeLine] : []);
    var adds = (run.builder || []).map(function (w) { return w.title; });
    var col = function (title, items, cls) { return '<div class="f25-col ' + cls + '">' + label(title) + '<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; };
    el.innerHTML =
      '<div class="card f25-next" style="margin-top:14px">' +
        '<div class="label lilac">' + esc(X.nextLabel) + '</div>' +
        '<h3 class="h3" style="margin:10px 0 0">' + esc(X.nextHeading) + '</h3>' +
        '<div class="f25-compare">' + col(X.freeLabel, free, 'free') + (adds.length ? col(X.builderLabel, adds, 'adds') : '') + '</div>' +
        (adds.length ? '<p class="gate-small">' + esc(X.builderNote) + '</p>' : '') +
        (run.keepUntil ? '<p class="f25-keep">' + esc(fill(X.saved, { days: C.keepDays })) + '</p>' : '') +
      '</div>' +
      (hqNow && !ever ? '<div class="card f25-hq dr-hq" style="margin-top:14px"><div class="label lilac">' + esc(H.label) + '</div>' +
        '<h3 class="h3" style="margin:10px 0 8px">' + esc(H.heading) + '</h3><p class="fog" style="margin:0">' + esc(me ? H.bodyIn : H.body) + '</p>' +
        '<div class="row">' + (me
          ? '<a class="btn" href="' + esc(bring) + '" data-hq="bring">' + esc(H.bring) + ' <span class="arrow"></span></a>'
          : '<a class="btn" href="' + esc(join) + '" data-hq="start">' + esc(H.start) + ' <span class="arrow"></span></a>' +
            '<a class="btn ghost" href="' + esc(signin) + '" data-hq="signin">' + esc(H.signin) + '</a>') + '</div></div>' : '') +
      '<div id="stateBlock"></div>' +
      (hqNow && ever && !me ? '<p class="gate-small center" style="margin-top:12px"><a class="link" href="' + esc(signin) + '" data-hq="signin">' + esc(H.signin) + '</a></p>' : '') +
      '<div class="f25-again"><a class="link" href="' + esc(C.path) + '">' + esc(X.again) + '</a></div>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-hq]'), function (a) {
      a.addEventListener('click', function () { K.track('Door HQ', { door: M, via: a.getAttribute('data-hq') }); });
    });
    R.block($('stateBlock'), { magnet: M, key: null, lines: C.lines, bring: hqNow ? bring : null, onStart: function () { location.href = hqNow ? join : '/start?from=' + encodeURIComponent(C.source); } });
  }

  // A store the audit can't read: what happened, and the way back to the form.
  function showFailed(x) {
    $('scan').hidden = true; $('intro').hidden = true; $('formWrap').hidden = true; $('whoWrap').hidden = false;
    var F = C.fail || {}, el = $('result');
    el.hidden = false;
    el.innerHTML = '<div class="card dr-fail"><div class="label lilac">' + esc(C.title.replace(/ · 127$/, '')) + '</div>' +
      '<h2 class="h2" style="margin:12px 0 8px">' + esc(F[x && x.status] || F.other || C.copy.failed) + '</h2>' +
      (x && x.reason ? '<p class="fog">' + esc(x.reason) + '</p>' : '') +
      (x && x.status === 'not_shopify' && F.shopifyOnly ? '<p class="fog">' + esc(F.shopifyOnly) + '</p>' : '') +
      '<button type="button" class="btn block" data-again style="margin-top:14px">' + esc(F.again || C.copy.again) + '</button>' +
      (C.sample ? '<p class="center" style="margin:12px 0 0"><button type="button" class="dr-sample" data-sample>' + esc(C.sample.label) + '</button></p>' : '') +
    '</div>';
    el.querySelector('[data-again]').onclick = function () {
      el.hidden = true; $('intro').hidden = false; $('formWrap').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var first = form.querySelector('.input');
      if (first) first.focus();
    };
    var s = el.querySelector('[data-sample]');
    if (s) s.onclick = function () { el.hidden = true; $('intro').hidden = false; $('formWrap').hidden = false; $('sample').click(); };
  }

  $('result').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]');
    if (c) {
      K.copy(T[Number(c.getAttribute('data-copy'))] || '');
      K.track('Door Copy', { door: M, kind: c.getAttribute('data-kind') || '' });
      return;
    }
    var f = e.target.closest('[data-file]');
    if (f) K.track('Door File', { door: M, file: f.getAttribute('data-file') });
  });

  // The saved result from the email (/door/r/:id): open it unlocked, no form.
  if (window.DOOR_RUN) {
    st.unlocked = true;
    show(window.DOOR_RUN);
  }
})();
