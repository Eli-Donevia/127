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
  // Fix my website (FIX_MY_SITE, lib/doors.js doorCopy 'fix'): the free website builder for someone who already has a
  // website. They paste it, and the site is rebuilt from what 127 read there.
  var M = C.id, FIX = !!C.fix, LAST = '127-door-' + M + (FIX ? '-fix' : '');
  var st = { run: null, unlocked: false, sticky: null };
  // The free website builder (FREE_SITE_BUILDER, lib/doors.js doorCopy) is a page of its own: door.css .fb, a made-up
  // business's site beside the form, the name forming from light while the site builds, the designs as a row of names.
  var FB = C.freeBuilder || null;
  var calm = !window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The page's head marked it .fb before the first paint; .fb-up shows it now that it's drawn (this runs before any paint).
  if (FB) document.documentElement.classList.add('fb', 'fb-up');
  if (FIX) document.documentElement.classList.add('fb-fix');
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
  // A website as people say it: no https://, www. or path.
  var hostOf = function (u) { return String(u || '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase(); };

  // ---------- the form ----------
  $('chip').textContent = C.chip;
  if (FB) $('chip').parentNode.hidden = true;
  $('h1').textContent = C.h1;
  $('lede').textContent = C.lede;
  $('note').textContent = C.note || '';
  // Legal G8: the Terms line right under the button, at full contrast like the line under the form (L103).
  if (C.terms) go.insertAdjacentHTML('afterend', '<p class="form-note fb-terms">' + esc(C.terms).replace('Terms', '<a href="/terms" target="_blank" rel="noopener">Terms</a>').replace('Privacy Policy', '<a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>') + '</p>');
  var button = function () { go.innerHTML = esc(C.button) + ' <span class="arrow"></span>'; };
  button();
  $('stack').innerHTML = C.free.map(function (t) { return '<li><span class="ck" aria-hidden="true"></span><span>' + esc(t) + '</span></li>'; }).join('');
  $('fields').innerHTML = FB ? fbFields() : C.fields.map(field).join('');

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
  // The free website builder asks for the two things it needs; the rest folds away.
  function fbFields() {
    var need = C.fields.filter(function (f) { return f.required; }), rest = C.fields.filter(function (f) { return !f.required; });
    return need.map(field).join('') + (rest.length ? '<details class="fb-more" id="fbMore"><summary>' + esc(FB.more) + '</summary><div class="stack-m">' + rest.map(field).join('') + '</div></details>' : '');
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
    if (FB && $('fbMore')) {
      var had = values();
      if (C.fields.some(function (f) { return !f.required && had[f.name]; })) $('fbMore').open = true;
    }
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

  if (FB) {
    // The example's own button runs the sample, and what you get moves under the example.
    $('sample').hidden = true;
    var stack = document.querySelector('#formWrap .f25-stack'), sec = document.createElement('section');
    if (stack) { sec.className = 'narrow'; sec.id = 'fbStack'; sec.appendChild(stack); $('example').parentNode.insertBefore(sec, $('example').nextSibling); }
    if (!window.DOOR_RUN) { exampleView(); intro(); }
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
  // The form and what's around it (the run and the result take their place).
  function landing(on) {
    ['intro', 'formWrap', 'example', 'fbStack'].forEach(function (id) {
      var el = $(id);
      if (el && (id !== 'example' || el.firstChild)) el.hidden = !on;
    });
  }

  // ---------- the run ----------
  function runIt(input) {
    go.disabled = true;
    go.innerHTML = '<span class="spinner"></span>';
    serverRun(input).then(function (got) {
      finishScan();
      K.track('Door Result', { door: M, ok: got.run ? 'yes' : 'no', sample: got.run && got.run.sample ? 'yes' : 'no' });
      var land = function () { if (got.run) show(got.run); else showFailed(got.failed); };
      setTimeout(function () { if (FB && got.run) release(land); else land(); }, FB ? formed() : 500);
    }, function (ex) {
      $('scan').hidden = true; landing(true); $('whoWrap').hidden = false;
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
    landing(false); $('result').hidden = true; $('whoWrap').hidden = true;
    $('scan').hidden = false;
    $('scanLabel').textContent = C.copy.running;
    $('scanTitle').textContent = fill(C.scan, FIX ? { site: hostOf(input.from) } : input);
    $('log').innerHTML = C.progress.map(function (t, i) { return '<li data-s="' + i + '"><span class="ic"></span><span class="tx">' + esc(t) + '</span><span class="val"></span></li>'; }).join('');
    $('meter').style.width = '6%';
    if (FB) building(input);
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
    if (FB && $('fbStep')) { $('fbStep').textContent = C.progress[i]; $('fbBar').style.transform = 'scaleX(' + [0.12, 0.4, 0.68, 0.9][i] + ')'; }
  }
  function finishScan() {
    Array.prototype.forEach.call($('log').children, function (li) { li.classList.add('on', 'done'); });
    $('meter').style.width = '100%';
    if (FB && $('fbBar')) { $('fbBar').style.transform = 'none'; $('fbBar').parentNode.classList.add('done'); }
  }

  // ---------- the result ----------
  // Copy buttons point into this list, so long messages never sit in an attribute.
  var T = [];
  var cp = function (text, kind) { T.push(String(text || '')); return '<button type="button" class="dr-copy" data-copy="' + (T.length - 1) + '" data-kind="' + esc(kind || '') + '">Copy</button>'; };
  var msg = function (title, text, kind) { return '<div class="dr-msg-head"><span>' + esc(title) + '</span>' + cp(text, kind) + '</div><div class="dr-msg">' + esc(text) + '</div>'; };
  var fileOf = function (run, key) { return (run.files || []).filter(function (f) { return f.key === key; })[0] || null; };
  // A page we built, shown in a frame with scripts, forms and outside requests off (and the same on the server). The free
  // website builder's site plays its motion: its own scripts run, still without same-origin, so they can't reach this page,
  // and its email links (the Report link, lib/doors.js) open the visitor's email app.
  var frame = function (src, title, moving) { return '<div class="dr-frame"><iframe src="' + esc(src) + '" sandbox="' + (moving ? 'allow-scripts allow-top-navigation-to-custom-protocols' : '') + '" loading="lazy" referrerpolicy="no-referrer" title="' + esc(title) + '"></iframe></div>'; };

  function show(run) {
    st.run = run;
    if (swarm) { swarm.destroy(); swarm = null; }
    $('scan').hidden = true; landing(false); $('whoWrap').hidden = false;
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
        // st.run: the free website builder swaps in a new result when the visitor tries another design.
        data: function () { return { run_id: st.run.id, k: st.run.k, door: M }; },
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
      st.sticky = FB && C.hq ? keepBar() : R.sticky(gate, M);
    } else drawAfter();
    window.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' });
  }

  function draw() {
    T = [];
    $('free').innerHTML = DRAW[M].free(st.run);
    $('full').innerHTML = st.unlocked ? DRAW[M].full(st.run) + files(st.run) : '';
    var fix = $('result').querySelector('form.dr-fix');
    if (fix) fix.onsubmit = rebuild;
    if (DRAW[M].bind) DRAW[M].bind(st.run);
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
      sub = fill(C.result.design, { design: x.designName, business: x.business }) + (x.why && !FB ? ' ' + x.why : '');
    } else {
      h = fill(C.result.heading, { score: x.score });
      // Legal part 5: the score isn't a prediction.
      sub = C.result.reads + (x.after != null ? ' ' + fill(C.result.after, { after: x.after }) : '');
    }
    return (FB ? '' : '<div class="label lilac">' + esc(C.title.replace(/ · 127$/, '')) + '</div>') +
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

  // ---------- the free website builder (FREE_SITE_BUILDER, lib/doors.js) ----------
  // The designs as a row of names, the one showing lit (door.css .fb-tab).
  function tabs(list, cur, more) {
    return '<div class="fb-tabs" role="group" aria-label="' + esc(FB.designs.label) + '">' + list.map(function (d) {
      return '<button type="button" class="fb-tab" data-design="' + esc(d.id) + '" aria-pressed="' + (d.id === cur) + '">' + esc(d.name) + '</button>';
    }).join('') + (more || '') + '</div>';
  }
  // Three designs picked for the business to try on the same words, the rest a tap away. Each try is a new result.
  function designs(run) {
    var x = run.result, cur = x.design, top = x.designs.map(function (d) { return d.id; });
    var rest = FB.all.filter(function (d) { return top.indexOf(d.id) < 0; });
    var open = st.more || rest.some(function (d) { return d.id === cur; });
    return '<div class="dr-designs"><h3 class="fb-h">' + esc(FB.designs.label) + '</h3>' +
      tabs(x.designs.concat(open ? rest : []), cur, rest.length ? '<button type="button" class="fb-tab fb-tog" data-more aria-expanded="' + open + '">' + esc(open ? FB.designs.less : FB.designs.more) + '</button>' : '') +
      '<p class="form-err" id="designErr" hidden></p></div>';
  }
  var keepUrl = function (run) { return '/start/door/' + encodeURIComponent(run.id) + '?k=' + encodeURIComponent(run.k); };
  // Keep it: a free account with the site in 127 HQ (the result's own signup), or the ZIP by email below.
  function keep(run) {
    if (!C.hq) return '';
    var me = R.me();
    return '<div class="dr-sec dr-keep"><a class="btn" href="' + esc(keepUrl(run)) + '" data-keep>' + esc(me ? FB.keep.in : FB.keep.start) + ' <span class="arrow"></span></a>' +
      (me ? '' : '<p class="dr-sub">' + esc(FB.keep.line) + '</p>') +
      (st.unlocked ? '' : '<p class="center" style="margin:10px 0 0"><button type="button" class="dr-sample" data-zip>' + esc(FB.keep.or) + '</button></p>') + '</div>';
  }
  // The bar along the bottom keeps the site in 127 HQ once the button has scrolled away; the email for the ZIP stays on
  // the page.
  function keepBar() {
    var bar = document.createElement('div');
    bar.className = 'sticky-ask';
    bar.innerHTML = '<span>' + esc(R.me() ? FB.keep.barIn : FB.keep.bar) + '</span><a class="btn" href="' + esc(keepUrl(st.run)) + '">' + esc(FB.keep.barButton) + '</a>';
    document.body.appendChild(bar);
    var a = bar.querySelector('a');
    a.onclick = function () { a.href = keepUrl(st.run); K.track('Door Keep', { door: M, design: st.run.result.design, via: 'bar' }); };
    var away = false, typing = false, set = function () { bar.classList.toggle('on', away && !typing); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { away = !es[0].isIntersecting; set(); }).observe($('free'));
    // A phone's keyboard pushes a bottom bar up over the form, so it steps aside while a field is in use.
    var typed = function () { var a = document.activeElement; typing = !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); set(); };
    var left = function () { setTimeout(typed, 0); };
    document.addEventListener('focusin', typed);
    document.addEventListener('focusout', left);
    return { remove: function () { bar.remove(); document.removeEventListener('focusin', typed); document.removeEventListener('focusout', left); } };
  }
  function redesign(id, name) {
    if (st.busy || !st.run || id === st.run.result.design) return;
    st.busy = true;
    var fr = $('free').querySelector('.dr-frame'), errEl = $('designErr');
    if (fr) { fr.classList.add('busy'); fr.setAttribute('data-busy', fill(FB.designs.building, { design: name })); light(fr, 'busy'); }
    Array.prototype.forEach.call($('free').querySelectorAll('[data-design]'), function (b) { b.disabled = true; b.setAttribute('aria-pressed', String(b.getAttribute('data-design') === id)); });
    fetch('/api/door/site/redesign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: st.run.id, k: st.run.k, design: id }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.run) throw new Error(j.error || FB.designs.failed); return j.run; }); })
      .then(function (run) {
        K.track('Door Design', { door: M, design: id });
        st.run = run;
        $('result').querySelector('.dr-head').innerHTML = head(run);
        draw();
        if (st.unlocked) try { history.replaceState(null, '', '/door/r/' + encodeURIComponent(run.id) + '?k=' + encodeURIComponent(run.k)); } catch (x) {}
      }, function (e) {
        if (fr) { fr.classList.remove('busy'); light(fr, 'rest'); }
        Array.prototype.forEach.call($('free').querySelectorAll('[data-design]'), function (b) { b.disabled = false; b.setAttribute('aria-pressed', String(b.getAttribute('data-design') === st.run.result.design)); });
        if (errEl) { errEl.textContent = e.message || FB.designs.failed; errEl.hidden = false; }
      })
      .then(function () { st.busy = false; });
  }

  // Fix my website: Legal G8's line under the rebuilt site (full contrast, L103), then what it fixed and what it kept.
  function fromLine(run) {
    var x = run.result;
    return x.from ? '<p class="fb-from">' + esc(fill(C.fix.from, { domain: x.from.domain, date: dayOf(run.keepUntil) })) + '</p>' : '';
  }
  function fixed(run) {
    var x = run.result;
    if (!x.fixed || !x.fixed.length) return x.kept ? '<p class="fb-kept">' + esc(fill(C.fix.kept, { kept: x.kept })) + '</p>' : '';
    return '<div class="dr-sec fb-fixed"><h3 class="fb-h">' + esc(C.fix.fixed) + '</h3><ol class="fx-list">' + x.fixed.map(function (f) {
      return '<li><b>' + esc(f.title) + '</b><span>' + esc(f.line) + '</span></li>';
    }).join('') + '</ol>' + (x.kept ? '<p class="fb-kept">' + esc(fill(C.fix.kept, { kept: x.kept })) + '</p>' : '') + '</div>';
  }

  // The example beside the form: a made-up business's site playing in the designs that fit it, so the builder shows
  // what it makes before anyone types. Built once on the server (GET /door/site/example/:design).
  function exampleView() {
    var X = FB.example, el = $('example');
    if (!X || !X.designs || !X.designs.length) return;
    var cur = X.designs[0], wide = !!window.matchMedia && matchMedia('(min-width: 1024px)').matches;
    var rows = Object.keys(X.labels).filter(function (k) { return X.values[k]; }).map(function (k) { return '<div><dt>' + esc(X.labels[k]) + '</dt><dd>' + esc(X.values[k]) + '</dd></div>'; }).join('');
    var titled = function (d) { return X.heading + ': ' + X.values.business + ', ' + d.name; };
    el.innerHTML = '<h2 class="fb-h">' + esc(X.heading) + '</h2>' +
      '<div class="dr-frame fb-phone" id="exFrame"><iframe src="' + esc(X.src + cur.id) + '" sandbox="allow-scripts" loading="lazy" referrerpolicy="no-referrer" title="' + esc(titled(cur)) + '"></iframe></div>' +
      tabs(X.designs, cur.id) +
      '<p class="fb-cap">' + esc(fill(X.caption, X.values)) + '</p><dl class="fb-said">' + rows + '</dl>' +
      '<p class="fb-acts"><button type="button" class="fb-link" data-try>' + esc(X.try) + '</button><a class="fb-link" id="exOpen" href="' + esc(X.src + cur.id) + '" target="_blank" rel="noopener">' + esc(X.open) + '</a></p>';
    el.hidden = false;
    var fr = $('exFrame');
    landed(fr);
    if (wide) { light(fr, 'draw'); lean(fr); } else scrub(fr);
    Array.prototype.forEach.call(el.querySelectorAll('[data-design]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-design'), d = X.designs.filter(function (x) { return x.id === id; })[0], ifr = fr.querySelector('iframe');
        if (!d || b.getAttribute('aria-pressed') === 'true') return;
        Array.prototype.forEach.call(el.querySelectorAll('[data-design]'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        fr.classList.add('busy');
        fr.setAttribute('data-busy', fill(FB.designs.loading, { design: d.name }));
        light(fr, 'busy');
        ifr.onload = function () { fr.classList.remove('busy'); light(fr, 'rest'); };
        ifr.src = X.src + id;
        ifr.title = titled(d);
        $('exOpen').href = X.src + id;
        K.track('Door Example', { door: M, design: id });
      };
    });
    // On a phone the frame is a picture of the site (scrolling stays with the page); a tap sends the light round it.
    fr.onclick = function () { if (!wide && !fr.classList.contains('busy')) light(fr, 'travel'); };
    el.querySelector('[data-try]').onclick = function () { $('sample').onclick(); };
  }

  // The headline sets word by word and the lede and form follow it in (door.css .fb-go, .fb-in): one move, about 1.2 s.
  function intro() {
    if (calm) return;
    $('h1').innerHTML = String(C.h1).split(' ').map(function (w, i) { return '<span class="w"><span style="--i:' + i + '">' + esc(w) + '</span></span>'; }).join(' ');
    var root = document.documentElement;
    root.classList.add('fb-go');
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('fb-in'); }); });
    setTimeout(function () { swarmLib().catch(function () {}); }, 2500);
  }

  // ---------- the light ----------
  // A frame's edge is a line of Tide running into Orchid (Design's accent and motion rules v2, D57: light from the
  // subject, a bloom no wider than twice the stroke). It draws in, a bright head runs round it when a site lands or while
  // one loads, and with reduced motion it simply rests, lit. The bloom shows only while the light moves, so a still
  // frame never glows, and no loop runs at rest. The hues are in door.css.
  var gid = 0;
  function edge(fr) {
    var svg = fr.querySelector('.fb-edge');
    if (svg) return svg;
    var id = 'fbg' + (++gid);
    fr.insertAdjacentHTML('beforeend', '<svg class="fb-edge" aria-hidden="true" focusable="false"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs><rect class="bs"/><rect class="ln" stroke="url(#' + id + ')"/><rect class="hd"/></svg>');
    svg = fr.querySelector('.fb-edge');
    var fit = function () {
      var w = fr.clientWidth, h = fr.clientHeight, iw = Math.max(0, w - 1.5), ih = Math.max(0, h - 1.5);
      var r = Math.max(0, Math.min((parseFloat(getComputedStyle(fr).borderTopLeftRadius) || 0) - 0.75, iw / 2, ih / 2));
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.len = Math.max(1, 2 * (iw + ih) - 8 * r + 2 * Math.PI * r);
      Array.prototype.forEach.call(svg.querySelectorAll('rect'), function (rc) {
        rc.setAttribute('x', 0.75); rc.setAttribute('y', 0.75); rc.setAttribute('width', iw); rc.setAttribute('height', ih); rc.setAttribute('rx', r);
      });
      svg.querySelector('.ln').style.strokeDasharray = svg.len + 'px ' + svg.len + 'px';
      svg.hl = Math.max(28, Math.min(72, svg.len * 0.05));
      svg.querySelector('.hd').style.strokeDasharray = svg.hl + 'px ' + (svg.len - svg.hl) + 'px';
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(fr);
    return svg;
  }
  // The site fades up in its frame once it has loaded (an iframe fires load even for an error page), so a white page
  // never flashes in the dark frame.
  function landed(fr) {
    var ifr = fr.querySelector('iframe'), on = function () { fr.classList.add('in'); };
    if (ifr) ifr.addEventListener('load', on); else on();
  }
  // mode: draw (the edge draws in behind a bright head), travel (the head runs one lap), busy (laps until the site is
  // in), rest (stops the head).
  function light(fr, mode) {
    var svg = edge(fr), ln = svg.querySelector('.ln'), hd = svg.querySelector('.hd'), L = svg.len, h = svg.hl;
    if (fr.fbRun) { fr.fbRun.cancel(); fr.fbRun = null; }
    if (calm || !hd.animate) { ln.style.strokeDashoffset = '0px'; return; }
    svg.classList.toggle('go', mode !== 'rest');
    if (mode === 'rest') return;
    if (mode === 'draw') {
      var o = { duration: 1500, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' };
      ln.animate([{ strokeDashoffset: L + 'px' }, { strokeDashoffset: '0px' }], o);
      fr.fbRun = hd.animate([{ strokeDashoffset: h + 'px' }, { strokeDashoffset: (h - L) + 'px' }], o);
      hd.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1500 });
    } else {
      fr.fbRun = hd.animate([{ strokeDashoffset: '0px', opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { strokeDashoffset: -L + 'px', opacity: 0 }], { duration: mode === 'busy' ? 1200 : 1400, easing: 'cubic-bezier(.4,0,.2,1)', iterations: mode === 'busy' ? Infinity : 1 });
    }
    fr.fbRun.onfinish = function () { svg.classList.remove('go'); };
  }
  // On a phone the example sits under the form: its edge draws as it scrolls into view, and undraws on the way back up.
  function scrub(fr) {
    var svg = edge(fr), ln = svg.querySelector('.ln'), hd = svg.querySelector('.hd'), pend = 0;
    if (calm) { ln.style.strokeDashoffset = '0px'; return; }
    var upd = function () {
      pend = 0;
      var r = fr.getBoundingClientRect(), vh = window.innerHeight || 1, p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.7)));
      var L = svg.len, d = L * (1 - p);
      ln.style.strokeDashoffset = d + 'px';
      hd.style.strokeDashoffset = (svg.hl - L + d) + 'px';
      hd.style.opacity = p > 0.02 && p < 0.98 ? 1 : 0;
      svg.classList.toggle('go', p > 0.02 && p < 0.98);
    };
    var ask = function () { if (!pend) pend = requestAnimationFrame(upd); };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask, { passive: true });
    upd();
  }
  // On a desktop the example leans toward the pointer on a spring, and settles.
  function lean(el) {
    if (calm || !matchMedia('(pointer: fine)').matches) return;
    var rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0;
    var tick = function () {
      vx = (vx + (tx - rx) * 0.06) * 0.82; vy = (vy + (ty - ry) * 0.06) * 0.82;
      rx += vx; ry += vy;
      el.style.transform = 'perspective(1400px) rotateX(' + rx.toFixed(3) + 'deg) rotateY(' + ry.toFixed(3) + 'deg)';
      raf = Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(vx) + Math.abs(vy) > 0.004 ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', function (e) {
      if ($('example').hidden) return;
      var r = el.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth || 1), dy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight || 1);
      ty = -Math.max(-1, Math.min(1, dx * 2)) * 4;
      tx = Math.max(-1, Math.min(1, dy * 2)) * 3;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  // ---------- while it builds, the name forms from light ----------
  // The vendored particle swarm (public/js/vendor/particle-swarm.js, MIT, Componentry) forms the business name inside
  // the frame while the server builds, and the result waits until it has formed. With reduced motion, or until the
  // swarm has loaded, the name is simply set in the frame.
  var swarm = null, swarmEnd = 0, swarmP = null;
  function swarmLib() {
    if (!swarmP) swarmP = new Promise(function (ok, no) {
      if (K.swarm) return ok(K.swarm);
      addEventListener('k127-swarm', function () { ok(K.swarm); }, { once: true });
      var s = document.createElement('script');
      s.type = 'module';
      s.src = '/funnels/door-swarm.js';
      s.onerror = no;
      document.head.appendChild(s);
    });
    return swarmP;
  }
  // The name in Geist Bold, set as big as the frame allows: the shape the swarm forms. Each way of breaking it into one to
  // four lines is tried and the one that sets it biggest wins, so a long name on a phone and a short one on a wide
  // frame both read.
  function nameArt(name, w, h) {
    var c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = w; c.height = h;
    var words = String(name).trim().split(/\s+/).slice(0, 6), font = function (px) { return '700 ' + px + 'px Geist, "Helvetica Neue", Arial, sans-serif'; };
    x.font = font(100);
    var best = null;
    for (var n = 1; n <= Math.min(4, words.length); n++) {
      var per = Math.ceil(words.length / n), lines = [];
      for (var i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
      var widest = Math.max.apply(null, lines.map(function (t) { return x.measureText(t).width; })) || 1;
      var px = Math.min((100 * w * 0.84) / widest, (h * 0.72) / (lines.length * 0.92), 220);
      if (!best || px > best.px) best = { px: px, lines: lines };
    }
    var lh = best.px * 0.92;
    x.font = font(best.px);
    x.fillStyle = '#fff';
    // On a phone the name sits where a site's headline would; on a wide frame the block is centred.
    var left = w > h * 1.2 ? (w - Math.max.apply(null, best.lines.map(function (t) { return x.measureText(t).width; }))) / 2 : w * 0.08;
    best.lines.forEach(function (t, i) { x.fillText(t, left, (h - lh * best.lines.length) / 2 + best.px * 0.74 + i * lh); });
    return c;
  }
  // The swarm runs Tide into Orchid across the name, the same two hues as the frame's edge (door.css).
  function hues(el) {
    var cs = getComputedStyle(el), hex = function (n, d) { var v = cs.getPropertyValue(n).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; };
    return [hex('--fb-tide', '#7cebf6'), hex('--fb-orchid', '#a98bff')];
  }
  function building(input) {
    var box = $('fbBuild'), name = FIX ? hostOf(input.from) : input.business;
    if (!box) { box = document.createElement('div'); box.id = 'fbBuild'; $('scan').appendChild(box); }
    box.classList.remove('fb-out');
    if (swarm) { swarm.destroy(); swarm = null; }
    box.innerHTML = '<div class="dr-frame fb-phone fb-forming"><canvas aria-hidden="true"></canvas><p class="fb-name" aria-hidden="true">' + esc(name) + '</p></div>' +
      '<div class="fb-prog"><span id="fbBar"></span></div><p class="fb-step" id="fbStep"></p>';
    var fr = box.querySelector('.dr-frame');
    light(fr, 'draw');
    swarmEnd = 0;
    if (calm) return;
    swarmLib().then(function (make) {
      var cv = fr.querySelector('canvas');
      if ($('scan').hidden || !box.contains(cv)) return;
      return make(cv, { source: { canvas: nameArt(name, Math.round(cv.clientWidth), Math.round(cv.clientHeight)) }, colors: hues(cv), fit: 1, density: 3, jitter: 0.5, size: 1.1, scatter: 1.3, progress: 0 }).then(function (s) {
        if ($('scan').hidden || !box.contains(cv)) { s.destroy(); return; }
        swarm = s;
        fr.classList.add('fb-swarm');
        s.formIn(1700);
        swarmEnd = Date.now() + 1700;
      });
    }).catch(function () {});
  }
  // How long the result waits: until the name has formed and held long enough to read, and never less than the half
  // second it always had.
  function formed() { return Math.min(3200, Math.max(500, swarmEnd + 900 - Date.now())); }
  // Then the name lets go into light (the swarm runs back out to its scatter) and the site lands in its place.
  function release(go) {
    var box = $('fbBuild');
    if (!swarm || calm || !box) return go();
    swarm.formIn(520, 0);
    box.classList.add('fb-out');
    setTimeout(go, 380);
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
        var p = fileOf(run, 'preview'), moving = !!(FB && run.result.designs);
        // Once the page is at the result's link, how long that link lasts (Legal L97 CH16).
        return (p && p.open ? (moving ? '<div class="dr-sec fb-show">' + frame(p.open, C.result.preview, moving) + (FIX ? fromLine(run) : st.unlocked ? '<p class="fb-cap">' + esc(fill(FB.lasts, { days: C.keepDays })) + '</p>' : '') + '</div>' + designs(run) : '<div class="dr-sec">' + label(C.result.preview) + frame(p.open, C.result.preview) + '</div>') : '') +
          (FIX ? fixed(run) : '') +
          (moving ? keep(run) : '') +
          // What the site still needs sits under the page until the email gate, then heads the steps.
          (!st.unlocked && run.result.ready === false ? '<div class="dr-sec">' + almost(run) + '</div>' : '');
      },
      bind: function () {
        if (!FB) return;
        var el = $('free'), fr = el.querySelector('.dr-frame');
        if (fr) { landed(fr); light(fr, 'draw'); }
        Array.prototype.forEach.call(el.querySelectorAll('[data-design]'), function (b) { b.onclick = function () { redesign(b.getAttribute('data-design'), b.textContent); }; });
        var more = el.querySelector('[data-more]');
        if (more) more.onclick = function () { st.more = !st.more; draw(); };
        var k = el.querySelector('[data-keep]');
        if (k) k.onclick = function () { K.track('Door Keep', { door: M, design: st.run.result.design }); };
        var z = el.querySelector('[data-zip]');
        if (z) z.onclick = function () { var g = $('gateWrap'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      },
      tease: function () { return ''; },
      // Legal D49: while the build lists what's missing, the gate doesn't call the site ready.
      gate: function (run) { return run.result.ready === false ? C.gateAlmost : null; },
      full: function (run) {
        var x = run.result;
        return '<div class="dr-sec">' + (x.ready === false ? almost(run) + '<p class="dr-sub">' + esc(C.result.then) + '</p>' : label(C.result.deploy)) + '<ol class="dr-steps">' + C.result.deploySteps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol><p class="dr-sub">' + esc(C.result.yours) + '</p><p class="dr-sub">' + esc(C.result.netlify) + '</p></div>' +
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
    if (swarm) { swarm.destroy(); swarm = null; }
    $('scan').hidden = true; landing(false); $('whoWrap').hidden = false;
    var F = C.fail || {}, el = $('result');
    el.hidden = false;
    el.innerHTML = '<div class="card dr-fail"><div class="label lilac">' + esc(C.title.replace(/ · 127$/, '')) + '</div>' +
      '<h2 class="h2" style="margin:12px 0 8px">' + esc(F[x && x.status] || F.other || C.copy.failed) + '</h2>' +
      (x && x.reason ? '<p class="fog">' + esc(x.reason) + '</p>' : '') +
      (x && x.status === 'not_shopify' && F.shopifyOnly ? '<p class="fog">' + esc(F.shopifyOnly) + '</p>' : '') +
      '<button type="button" class="btn block" data-again style="margin-top:14px">' + esc(F.again || C.copy.again) + '</button>' +
      (C.sample ? '<p class="center" style="margin:12px 0 0"><button type="button" class="dr-sample" data-sample>' + esc(C.sample.label) + '</button></p>' : '') +
      (FIX && C.fix.buildPath ? '<p class="center" style="margin:12px 0 0"><a class="fb-link" href="' + esc(C.fix.buildPath) + '">' + esc(C.fix.build) + '</a></p>' : '') +
    '</div>';
    el.querySelector('[data-again]').onclick = function () {
      el.hidden = true; landing(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var first = form.querySelector('.input');
      if (first) first.focus();
    };
    var s = el.querySelector('[data-sample]');
    if (s) s.onclick = function () { el.hidden = true; landing(true); $('sample').click(); };
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
