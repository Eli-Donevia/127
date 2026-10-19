// First 25 page: the form, the live search, the ranked list, the email gate and everything after it
// (send mode, the tracker, reply scripts). On the site the search runs on the server
// (POST /api/first-25/run, streamed). In a static preview (no server) it runs the same engine on
// sample businesses in the browser, labeled as a sample.
(function () {
  var K = window.K127, F = window.F25, D = window.FIRST25, R = K.R, RD = window.RESULTS, esc = K.esc;
  var $ = function (id) { return document.getElementById(id); };
  var st = { pack: 'video', run: null, unlocked: false, open: {}, status: {}, mock: {}, addr: '' };
  var M = window.F25MOCK;
  var SAVED = '127-first25-last', ADDR = '127-first25-addr';
  try { st.addr = localStorage.getItem(ADDR) || ''; } catch (e) {}

  // ---------- form ----------
  var form = $('f25Form'), err = $('err'), go = $('go');
  var PACK_ORDER = ['video', 'social', 'web', 'ai', 'email', 'photo', 'other'];
  function renderPacks() {
    $('packs').innerHTML = PACK_ORDER.map(function (id) {
      return '<button type="button" class="f25-pack" data-pack="' + id + '" aria-pressed="' + (id === st.pack) + '">' + esc(D.packs[id].label) + '</button>';
    }).join('');
    $('serviceField').hidden = st.pack !== 'other';
    renderBuyers();
  }
  function renderBuyers(keep) {
    var sel = $('buyer'), cur = keep || sel.value;
    var ids = D.packs[st.pack].buyers;
    sel.innerHTML = ids.map(function (id) { return '<option value="' + id + '">' + esc(D.buyers[id].label) + '</option>'; }).join('');
    if (ids.indexOf(cur) !== -1) sel.value = cur;
  }
  $('packs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pack]');
    if (!b) return;
    st.pack = b.getAttribute('data-pack');
    renderPacks();
  });
  // A live search names its source and the terms under the button (Legal L53 parts 1.6 and 2.5).
  (function () {
    var t = window.F25_SOURCE && D.copy.srcLine[window.F25_SOURCE];
    if (!t || !$('srcLine')) return;
    $('srcLine').innerHTML = esc(t).replace('{terms}', '<a href="/terms#13b-first-25">Terms</a>') + (window.F25_SOURCE === 'osm' ? searchBy(window.F25_SEARCH_BY) : '');
    $('srcLine').hidden = false;
  })();
  $('stack').innerHTML = D.stack.map(function (x) {
    return '<li><span class="ck" aria-hidden="true"></span><span><b>' + esc(x[0]) + '</b>' + esc(x[1]) + '</span></li>';
  }).join('');

  // "Not sure what to sell?": 3 questions, one pick, and it fills the form.
  var pk = { like: null, walk: null, hours: null };
  function drawPicker() {
    var q = function (title, key, opts) {
      return '<div class="f25-q"><div class="f25-q-t">' + esc(title) + '</div><div class="f25-packs">' + opts.map(function (o) {
        return '<button type="button" class="f25-pack sm" data-pk="' + key + '" data-v="' + o.id + '" aria-pressed="' + (pk[key] === o.id) + '">' + esc(o.label) + '</button>';
      }).join('') + '</div></div>';
    };
    var h = q('What do you like doing?', 'like', D.picker.likes) +
      q('Would you walk into a local business to say hi?', 'walk', [{ id: 'yes', label: 'Yes' }, { id: 'no', label: "I'd rather stay online" }]) +
      q('Hours a week you can give this?', 'hours', D.picker.hours);
    if (pk.like && pk.walk && pk.hours) {
      var r = F.pick(pk.like, pk.walk === 'yes', pk.hours);
      h += '<div class="f25-pick"><div class="label lilac">Start with</div>' +
        '<div class="h3" style="margin:8px 0 6px">' + esc(D.packs[r.pack].label) + ' for ' + esc(D.buyers[r.buyer].many) + '.</div>' +
        '<p class="fog" style="margin:0 0 4px">' + esc(r.why) + '</p><p class="slate" style="margin:0 0 14px;font-size:14px">' + esc(r.note) + '</p>' +
        '<button type="button" class="btn" data-use="' + r.pack + '|' + r.buyer + '">Use this <span class="arrow"></span></button></div>';
    }
    $('picker').innerHTML = h;
  }
  $('pickMe').addEventListener('click', function () {
    var open = $('picker').hidden;
    $('picker').hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    if (open) { drawPicker(); K.track('First25 Picker'); }
  });
  $('picker').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pk]');
    if (b) { pk[b.getAttribute('data-pk')] = b.getAttribute('data-v'); drawPicker(); return; }
    var u = e.target.closest('[data-use]');
    if (!u) return;
    var v = u.getAttribute('data-use').split('|');
    st.pack = v[0];
    renderPacks();
    renderBuyers(v[1]);
    $('picker').hidden = true;
    $('pickMe').setAttribute('aria-expanded', 'false');
    K.track('First25 Pick', { pack: v[0], buyer: v[1] });
    form.place.focus();
  });

  // Niche doors (/first-25/gyms): the page opens on that niche and says what the ad said.
  var niche = (function () {
    var id = window.F25_NICHE || (location.pathname.match(/^\/first-25\/([a-z-]+)\/?$/) || [])[1] || new URLSearchParams(location.search).get('niche');
    var n = id && F.niche(id);
    if (!n) return null;
    $('h1').textContent = n.h1;
    $('lede').textContent = n.lede;
    return n;
  })();

  // Ads and ManyChat can open a finished list: /first-25/gyms?place=Des+Moines,+IA&go=1
  // or /first-25?pack=video&buyer=gyms&place=Des+Moines,+IA&go=1
  (function prefill() {
    var p = new URLSearchParams(location.search), last = {};
    try { last = JSON.parse(localStorage.getItem(SAVED) || '{}') || {}; } catch (e) {}
    if (niche) last = { place: last.place, me: last.me, pack: niche.pack, buyer: niche.buyer };
    var pack = p.get('pack') || last.pack;
    if (D.packs[pack]) st.pack = pack;
    renderPacks();
    var buyer = p.get('buyer') || last.buyer;
    if (buyer) renderBuyers(buyer);
    form.place.value = (p.get('place') || last.place || '').slice(0, 80);
    form.me.value = (p.get('me') || last.me || '').slice(0, 40);
    form.service.value = (p.get('service') || last.service || '').slice(0, 60);
    if (p.get('go') === '1' && form.place.value.trim().length >= 2 && !window.F25_RUN) {
      setTimeout(function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }, 60);
    }
  })();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = { pack: st.pack, buyer: form.buyer.value, place: form.place.value.trim(), me: form.me.value.trim(), service: form.service.value.trim(), website: form.website.value };
    if (input.place.length < 2) return fail('Enter a city and state, or a ZIP code.');
    if (input.pack === 'other' && input.service.length < 3) return fail('Say what you sell in a few words.');
    if (input.website) return;
    err.hidden = true;
    try { localStorage.setItem(SAVED, JSON.stringify({ pack: input.pack, buyer: input.buyer, place: input.place, me: input.me, service: input.service })); } catch (x) {}
    K.track('First25 Search', { pack: input.pack, buyer: input.buyer });
    search(input);
  });
  function fail(msg) { err.textContent = msg; err.hidden = false; }

  // ---------- the live search ----------
  var STEPS = [
    { id: 'search', text: function (i) { return 'Searching ' + F.cityOf(i.place) + ' for ' + D.buyers[i.buyer].many; } },
    { id: 'filter', text: function () { return 'Dropping chains and closed businesses'; } },
    { id: 'audit', text: function () { return 'Checking every website'; } },
    { id: 'rank', text: function () { return 'Ranking them by the gaps you fix'; } },
    { id: 'write', text: function () { return 'Writing your messages'; } },
  ];
  function startScan(input) {
    $('intro').hidden = true; $('formWrap').hidden = true; $('result').hidden = true; $('whoWrap').hidden = true;
    $('scan').hidden = false;
    $('log').innerHTML = STEPS.map(function (s) { return '<li data-s="' + s.id + '"><span class="ic"></span><span class="tx">' + esc(s.text(input)) + '</span><span class="val"></span></li>'; }).join('');
    $('meter').style.width = '4%';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    step('search');
  }
  var ORDER = STEPS.map(function (s) { return s.id; });
  function step(id, val, pct) {
    var idx = ORDER.indexOf(id);
    Array.prototype.forEach.call($('log').children, function (li, i) {
      if (i < idx) li.classList.add('on', 'done');
      if (i === idx) li.classList.add('on');
    });
    var li = $('log').querySelector('[data-s="' + id + '"]');
    if (li && val != null) li.querySelector('.val').textContent = val;
    $('meter').style.width = (pct != null ? pct : [8, 30, 45, 85, 95][idx]) + '%';
  }
  function finishScan(run) {
    var s = run.stats || {};
    step('filter', (s.chains + s.closed + s.dupes) + ' out, ' + s.independent + ' left');
    var li = $('log').querySelector('[data-s="search"] .val');
    if (li) li.textContent = s.found + ' found';
    var au = $('log').querySelector('[data-s="audit"] .val');
    if (au) au.textContent = s.checked + ' read';
    Array.prototype.forEach.call($('log').children, function (x) { x.classList.add('on', 'done'); });
    $('meter').style.width = '100%';
  }
  function onProgress(p) {
    if (p.step === 'search') step('search');
    else if (p.step === 'found') { step('search', p.n + ' found'); step('filter'); }
    else if (p.step === 'audit') step('audit', p.checked + ' of ' + p.of, 45 + Math.round(40 * (p.of ? p.checked / p.of : 1)));
    else if (p.step === 'rank') step('rank');
    else if (p.step === 'write') step('write');
  }

  function search(input) {
    startScan(input);
    go.disabled = true;
    var job = K.onSite ? serverRun(input) : localRun(input);
    job.then(function (run) {
      finishScan(run);
      K.track('First25 Result', { pack: run.pack, buyer: run.buyer, source: run.source, kept: run.prospects.length });
      setTimeout(function () { show(run); }, 650);
    }, function (ex) {
      $('scan').hidden = true; $('intro').hidden = false; $('formWrap').hidden = false; $('whoWrap').hidden = false;
      fail(ex.message || 'Something went wrong. Try again.');
    }).then(function () { go.disabled = false; });
  }

  // Reads the NDJSON stream line by line, so each step shows as it happens.
  function serverRun(input) {
    var body = JSON.stringify(Object.assign({}, input, { utm: K.utm() }));
    return fetch('/api/first-25/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body }).then(function (r) {
      var type = r.headers.get('content-type') || '';
      if (!r.ok && /json/.test(type) && !/ndjson/.test(type)) return r.json().then(function (j) { throw new Error(j.error || 'Something went wrong.'); });
      if (!/ndjson/.test(type)) return localRun(input); // no API behind this page
      var result = null, failure = null, buf = '';
      var handle = function (line) {
        if (!line.trim()) return;
        var m; try { m = JSON.parse(line); } catch (e) { return; }
        if (m.type === 'progress') onProgress(m);
        else if (m.type === 'result') result = m.run;
        else if (m.type === 'error') failure = m.error;
      };
      var done = function () {
        handle(buf);
        if (failure) throw new Error(failure);
        if (!result) throw new Error('The search stopped early. Try again.');
        return result;
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

  // Static preview: the same engine on made-up businesses, with the same steps.
  function localRun(input) {
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var list = F.sample(input.buyer, input.place);
    var sites = list.filter(function (b) { return b.website; }).length;
    return wait(700).then(function () { onProgress({ step: 'found', n: list.length }); return wait(500); })
      .then(function () { onProgress({ step: 'audit', checked: Math.round(sites * 0.4), of: sites }); return wait(450); })
      .then(function () { onProgress({ step: 'audit', checked: sites, of: sites }); return wait(400); })
      .then(function () { onProgress({ step: 'rank' }); return wait(450); })
      .then(function () {
        onProgress({ step: 'write' });
        var b = F.build(list, { pack: input.pack, buyer: input.buyer, place: input.place, me: input.me, service: input.service });
        return wait(350).then(function () {
          return {
            id: 'preview', k: '', pack: input.pack, buyer: input.buyer, place: input.place, city: F.cityOf(input.place), source: 'sample', sample: true,
            service: input.service, me: input.me, checkedAt: new Date().toISOString(), stats: b.stats,
            headline: b.headline.map(function (h) { return Object.assign({ line: F.headlineLine(h) }, h); }),
            attribution: D.copy.attribution.sample, status: {}, prospects: b.prospects,
          };
        });
      });
  }

  // ---------- the result ----------
  function show(run) {
    st.run = run;
    st.status = loadStatus(run);
    $('scan').hidden = true; $('intro').hidden = true; $('formWrap').hidden = true; $('whoWrap').hidden = false;
    var el = $('result');
    el.hidden = false;
    // The credits sit under the list, so they show with the top 3 before the email too (Legal L53 parts 1.5 and 2.2).
    el.innerHTML = summary(run) + '<div id="tracker"></div><div class="f25-list" id="top"></div><div id="gateWrap" style="margin-top:14px"></div><div class="f25-list" id="rest"></div>' +
      '<p class="f25-attr">' + esc(F.fill(D.copy.checked, { date: new Date(run.checkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) })) + ' ' + credits(run) + '</p><div id="after"></div>';
    bindCards($('top'));
    bindCards($('rest'));
    drawList();
    if (!st.unlocked) {
      var gate = $('gateWrap');
      // The sample for #1 shows through the gate, blurred: the thing the email unlocks, with their name on it.
      var top1 = run.prospects[0], m1 = M && top1 ? F.mock(top1, run.pack, run.buyer, { me: run.me, city: run.city, service: run.service, source: run.source }) : null;
      var n = run.prospects.length;
      R.gate(gate, {
        magnet: 'first25',
        copy: m1 ? { label: F.fill(D.copy.gateSample, { n: n, short: D.mock.short[m1.kind], biz: top1.name }), line: F.fill(D.copy.gateLine, { n: n }) } : null,
        before: m1 ? '<div class="f25-peek" aria-hidden="true">' + M.render(m1).replace(/ data-reel /g, ' ') + '<span class="f25-peek-tag">' + esc(F.fill(D.copy.peek, { biz: top1.name })) + '</span></div>' : '',
        data: function () { return { run_id: run.id, k: run.k, pack: run.pack, buyer: run.buyer, place: run.place, city: run.city, count: run.prospects.length, list_source: run.source }; },
        onDone: function () {
          st.unlocked = true;
          if (st.sticky) st.sticky.remove();
          gate.innerHTML = '';
          drawList();
          drawAfter();
          $('tracker').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      var f = gate.querySelector('form');
      if (f && f.name && run.me && !f.name.value) f.name.value = run.me;
      st.sticky = R.sticky(gate, 'first25');
    } else drawAfter();
    window.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' });
  }

  function summary(run) {
    var B = D.buyers[run.buyer], s = run.stats, n = run.prospects.length;
    var tiles = ['<div class="f25-stat lead"><b>' + s.independent + '</b><span>independent ' + esc(B.many) + ' found</span></div>'];
    (run.headline || []).slice(0, 2).forEach(function (h) {
      tiles.push('<div class="f25-stat"><b>' + h.n + '<small>/' + h.of + '</small></b><span>' + esc(h.line.replace(/^\d+ of \d+ /, '')) + '</span></div>');
    });
    if (tiles.length < 3) tiles.push('<div class="f25-stat"><b>' + n + '</b><span>ranked, with messages ready</span></div>');
    var saved = F.saved(s.checked, run.sample);
    return '<div class="f25-sum">' +
      '<div class="label lilac">Your First 25</div>' +
      '<h2 class="h1 steel" style="margin-top:12px">' + esc(cap(B.many)) + ' in ' + esc(run.city) + '.</h2>' +
      (run.sample ? '<div class="f25-banner">' + esc(run.capped ? D.copy.capped : run.down ? D.copy.down : D.copy.sampleNote) + '</div>' : '') +
      (run.detailsFailed ? '<div class="f25-banner">' + esc(D.copy.details.fail) + '</div>' : '') +
      '<div class="f25-stats">' + tiles.slice(0, 3).join('') + '</div>' +
      (saved ? '<p class="f25-saved">' + esc(saved) + '</p>' : '') +
      '<div class="f25-problem"><h3 class="h3" style="margin:0 0 8px">' + esc(D.copy.problem) + '</h3><p class="fog" style="margin:0">' + esc(D.copy.problemSub) + '</p></div>' +
    '</div>';
  }

  function drawList() {
    var run = st.run;
    // The top 3 come with their messages before the email, all 25 after it ("Top 3 free, all 25 with your email", Legal S22).
    $('top').innerHTML = run.prospects.slice(0, 5).map(function (b, i) { return card(b, i < 3 || st.unlocked); }).join('');
    $('rest').innerHTML = run.prospects.slice(5).map(function (b) { return st.open[b.rank] ? card(b, true) : row(b); }).join('');
    drawTracker();
    if (M) M.start($('result'));
  }

  // Google's mark wherever its listings show without a Google map (Legal L53 part 1.5).
  function gm() { return '<span class="f25-gm">' + esc(D.copy.gmaps) + '</span>'; }
  // "Check it first" at each fact a message states, linked to where they can see it (Legal L53 part 3.4).
  function check(b, id) {
    var u = !st.run.sample && F.checkLink(b, id);
    return u ? ' <a class="f25-check" href="' + esc(u) + '" target="_blank" rel="noopener nofollow">' + esc(D.copy.check) + '</a>' : '';
  }

  function card(b, withMsg) {
    var meta = [b.rating ? Math.round(b.rating * 10) / 10 + '★' : '', b.reviews != null ? b.reviews + ' reviews' : '', b.address || ''].filter(Boolean).join(' · ');
    var facts = F.facts(b, 'email').map(function (g) { return g.id; });
    var why = (b.gaps || []).slice(0, 3).map(function (g) { return '<li class="gap">' + esc(g.why) + (facts.indexOf(g.id) !== -1 ? check(b, g.id) : '') + '</li>'; })
      .concat((b.fits || []).filter(function (f) { return f.id !== 'independent'; }).slice(0, 1).map(function (f) { return '<li>' + esc(f.why) + '</li>'; }));
    if (!why.length) why.push('<li>' + esc(b.unchecked ? "We couldn't read their website, so this score leans on their listing." : 'Independent, not a chain. The owner decides.') + '</li>');
    var links = [];
    if (b.website && !/\.example$/.test(host(b.website))) links.push('<a href="' + esc(b.website) + '" target="_blank" rel="noopener nofollow">Website ↗</a>');
    if (b.instagram) links.push('<a href="https://instagram.com/' + esc(b.instagram) + '" target="_blank" rel="noopener nofollow">Instagram ↗</a>');
    if (b.phone && !st.run.sample) links.push('<a href="tel:' + esc(String(b.phone).replace(/[^\d+]/g, '')) + '">Call</a>');
    if (b.mapsUrl) links.push('<a href="' + esc(b.mapsUrl) + '" target="_blank" rel="noopener nofollow">Map ↗</a>');
    return '<article class="f25-card' + (b.rank <= 3 ? ' top' : '') + '" data-rank="' + b.rank + '">' +
      '<div class="f25-head"><div><div class="f25-rank">#' + b.rank + (st.run.sample ? ' · Sample' : '') + '</div><h3 class="f25-name">' + esc(b.name) + '</h3>' +
        (meta ? '<div class="f25-sub">' + esc(meta) + '</div>' + (st.run.source === 'google' ? '<div class="f25-src">' + gm() + '</div>' : '') : '') + '</div>' +
        '<div class="f25-ring" style="--p:' + b.score + '"><b>' + b.score + '</b><span>score</span></div></div>' +
      ((b.gaps || []).length ? '<div class="f25-chips">' + b.gaps.slice(0, 4).map(function (g) { return '<span class="chip lilac">' + esc(g.chip) + '</span>'; }).join('') + '</div>' : '') +
      '<ul class="f25-why">' + why.join('') + '</ul>' +
      (links.length ? '<div class="f25-links">' + links.join('') + '</div>' : '') +
      (withMsg ? messages(b) : locked(b)) +
      (st.unlocked ? stageRow(b) : '') +
      (withMsg && st.unlocked ? spec(b) : '') +
    '</article>';
  }

  function row(b) {
    var gaps = (b.gaps || []).slice(0, 3).map(function (g) { return g.chip; }).join(' · ');
    var dis = !st.unlocked, s = stageOf(b.rank);
    return '<button type="button" class="f25-row" data-open="' + b.rank + '"' + (dis ? ' aria-disabled="true"' : '') + '>' +
      '<span class="r">#' + b.rank + '</span>' +
      '<span><span class="nm">' + esc(b.name) + '</span><span class="gp">' + esc(gaps || 'Independent, not a chain.') + '</span></span>' +
      (s !== 'found' ? '<span class="f25-badge" data-s="' + s + '">' + esc(stage(s).short) + '</span>' : '<span class="sc">' + b.score + '</span>') + '</button>';
  }

  var TABS = [['dm', 'DM'], ['email', 'Email'], ['walkin', 'Walk-in or call'], ['follow1', 'Day 3'], ['follow2', 'Day 7']];
  var FOLLOW = { follow1: 'follow1Email', follow2: 'follow2Email' };
  function messages(b) {
    return '<div class="f25-msg" data-msg="' + b.rank + '">' +
      '<div class="f25-tabs" role="tablist">' + TABS.map(function (t, i) { return '<button type="button" class="f25-tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div data-body>' + msgBody(b, 'dm') + '</div>' +
    '</div>';
  }
  // A follow-up to a business that said no isn't sent, so its tab says so instead (Legal L53 part 3.2).
  // Follow-ups sent by email get the sign-off, mailing address and opt-out (part 3.1).
  function msgBody(b, tab) {
    if (FOLLOW[tab] && stageOf(b.rank) === 'lost') return '<p class="f25-text f25-no">' + esc(D.copy.noFollow) + '</p>';
    return '<pre class="f25-text" data-text>' + marked(msgText(b, tab)) + '</pre>' +
      '<div class="row"><button type="button" class="btn ghost" data-copy>Copy</button>' +
      (FOLLOW[tab] ? '<button type="button" class="btn ghost" data-copy-email>' + esc(D.copy.asEmail) + '</button></div><p class="gate-small f25-fnote">' + esc(D.copy.followNote) + '</p>' : '</div>');
  }
  function locked(b) {
    return '<div class="f25-msg"><div class="f25-lock"><span class="tease">' + esc((b.msg ? b.msg.dm : '').slice(0, 64)) + '</span><span class="ink" style="flex:none">Message ready</span></div></div>';
  }
  function msgText(b, tab) {
    var m = b.msg || {};
    if (tab === 'email') return withAddr('Subject: ' + m.subject + '\n\n' + m.email);
    return withAddr(m[tab] || '');
  }
  // The mailing address saved in send mode fills the placeholder in every email on the page.
  function withAddr(t) { return st.addr ? String(t).split('[your mailing address]').join(st.addr) : t; }
  // [your name], [paste your link], [your price] and the rest stand out, so nobody sends one by mistake.
  function marked(t) { return esc(t).replace(/\[([a-z' ]{2,30})\]/g, '<span class="ph">[$1]</span>'); }

  // The mock-up made for this business (#1 right away, the rest on tap), then the steps to make the real one.
  function spec(b) {
    var run = st.run, ctx = { me: run.me, city: run.city, service: run.service, source: run.source };
    var sp = b.spec || F.spec(b, run.pack, run.buyer, ctx);
    var m = M ? F.mock(b, run.pack, run.buyer, ctx) : null;
    var made = m && (b.rank === 1 || st.mock[b.rank])
      ? '<div class="f25-mock"><div class="label signal">Made for ' + esc(b.name) + '</div><h4 class="h3">' + esc(m.title) + '</h4>' + M.render(m) + '<p class="f25-mock-note">' + esc(m.note) + '</p>' +
        (m.say ? '<div class="f25-say"><div class="label">' + esc(D.mock.sayLabel) + '</div><p>' + esc(m.say) + '</p><button type="button" class="btn ghost" data-copy-say="' + esc(m.say) + '">Copy</button></div>' : '') + '</div>'
      : m ? '<button type="button" class="btn ghost block f25-mockbtn" data-mock="' + b.rank + '">' + esc(D.mock.make) + '</button>' : '';
    return '<div class="card f25-spec" style="margin-top:14px;padding:16px">' + made +
      '<div class="label signal">' + (m ? 'Make it real' : 'Free sample · make it first') + '</div>' +
      '<h4 class="h3" style="font-size:18px;margin:8px 0 0">' + esc(sp.title) + '</h4>' +
      '<ol>' + sp.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (sp.board ? '<div class="label" style="margin-top:16px">Shot by shot</div><div class="f25-board">' + sp.board.map(function (r) { return '<div><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>'; }).join('') + '</div>' : '') +
    '</div>';
  }

  function bindCards(el) {
    el.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        var box = tab.closest('[data-msg]'), b = byRank(box.getAttribute('data-msg'));
        Array.prototype.forEach.call(box.querySelectorAll('[data-tab]'), function (t) { t.setAttribute('aria-selected', String(t === tab)); });
        box.querySelector('[data-body]').innerHTML = msgBody(b, tab.getAttribute('data-tab'));
        return;
      }
      var ce = e.target.closest('[data-copy-email]');
      if (ce) {
        var box3 = ce.closest('[data-msg]'), b3 = byRank(box3.getAttribute('data-msg'));
        var cur3 = box3.querySelector('[aria-selected="true"]').getAttribute('data-tab');
        K.copy(withAddr((b3.msg || {})[FOLLOW[cur3]] || ''));
        K.track('First25 Copy', { kind: cur3 + '_email', rank: b3.rank });
        return;
      }
      var cs = e.target.closest('[data-copy-say]');
      if (cs) {
        K.copy(cs.getAttribute('data-copy-say'));
        K.track('First25 Copy', { kind: 'mockup_line', rank: Number(cs.closest('[data-rank]').getAttribute('data-rank')) });
        return;
      }
      var cp = e.target.closest('[data-copy]');
      if (cp) {
        var box2 = cp.closest('[data-msg]'), b2 = byRank(box2.getAttribute('data-msg'));
        var cur = box2.querySelector('[aria-selected="true"]').getAttribute('data-tab');
        K.copy(msgText(b2, cur));
        K.track('First25 Copy', { kind: cur, rank: b2.rank });
        return;
      }
      var sb = e.target.closest('[data-st]');
      if (sb) {
        var holder = sb.closest('[data-stage-for]'), r = Number(holder.getAttribute('data-stage-for')), v = sb.getAttribute('data-st');
        setStage(r, stageOf(r) === v ? 'found' : v);
        Array.prototype.forEach.call(holder.querySelectorAll('[data-st]'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-st') === stageOf(r))); });
        // Not now ends the follow-ups, so an open Day 3 or Day 7 tab updates right away.
        var mb = holder.parentNode.querySelector('[data-msg]'), on = mb && mb.querySelector('[aria-selected="true"]');
        if (mb) mb.querySelector('[data-body]').innerHTML = msgBody(byRank(r), on ? on.getAttribute('data-tab') : 'dm');
        return;
      }
      var mk = e.target.closest('[data-mock]');
      if (mk) {
        st.mock[mk.getAttribute('data-mock')] = true;
        K.track('First25 Sample', { rank: Number(mk.getAttribute('data-mock')), kind: F.mockKind(st.run.pack) });
        drawList();
        return;
      }
      var open = e.target.closest('[data-open]');
      if (open && st.unlocked) {
        st.open[open.getAttribute('data-open')] = true;
        K.track('First25 Card Open', { rank: Number(open.getAttribute('data-open')) });
        drawList();
      }
    });
  }
  function byRank(r) { r = Number(r); return st.run.prospects.filter(function (b) { return b.rank === r; })[0]; }

  // ---------- the tracker (kept on this device, and with the saved list on the site) ----------
  function stage(id) { return D.stages.filter(function (s) { return s.id === id; })[0] || D.stages[0]; }
  function stageOf(rank) { return (st.status[rank] || {}).s || 'found'; }
  function loadStatus(run) {
    var local = {}, server = run.status || {}, out = {};
    try { local = JSON.parse(localStorage.getItem('127-first25-status-' + run.id) || '{}') || {}; } catch (e) {}
    Object.keys(server).concat(Object.keys(local)).forEach(function (r) {
      var a = server[r], b = local[r];
      out[r] = !a ? b : !b ? a : (a.at > b.at ? a : b);
    });
    return out;
  }
  function setStage(rank, s) {
    st.status[rank] = { s: s, at: new Date().toISOString() };
    try { localStorage.setItem('127-first25-status-' + st.run.id, JSON.stringify(st.status)); } catch (e) {}
    if (K.onSite && st.run.k && st.run.id !== 'preview') {
      fetch('/api/first-25/r/' + encodeURIComponent(st.run.id) + '/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: st.run.k, rank: rank, stage: s }) }).catch(function () {});
    }
    K.track('First25 Stage', { stage: s, rank: rank });
    drawTracker();
  }
  function stageRow(b) {
    var cur = stageOf(b.rank);
    return '<div class="f25-stage" data-stage-for="' + b.rank + '"><span class="label">Status</span>' + D.stages.slice(1).map(function (s) {
      return '<button type="button" class="f25-st" data-st="' + s.id + '" aria-pressed="' + (cur === s.id) + '">' + esc(s.short) + '</button>';
    }).join('') + '</div>';
  }
  function drawTracker() {
    var el = $('tracker');
    if (!el) return;
    if (!st.unlocked) { el.innerHTML = ''; return; }
    var all = st.run.prospects, n = all.length, c = {};
    all.forEach(function (b) { var s = stageOf(b.rank); c[s] = (c[s] || 0) + 1; });
    var sent = n - (c.found || 0), replied = (c.replied || 0) + (c.call || 0) + (c.won || 0);
    el.innerHTML = '<div class="card f25-track">' +
      '<div class="label">Your tracker</div>' +
      '<div class="f25-track-nums"><div><b>' + sent + '</b><span>sent</span></div><div><b>' + replied + '</b><span>replied</span></div><div><b>' + (c.won || 0) + '</b><span>won</span></div><div class="of">of ' + n + '</div></div>' +
      '<div class="f25-meter"><span style="width:' + Math.round((100 * sent) / n) + '%"></span></div>' +
      (c.found ? '<button type="button" class="btn block" data-send style="margin-top:16px">' + (sent ? 'Keep going: your next 5' : 'Start sending: your top 5') + ' <span class="arrow"></span></button>' +
        '<p class="gate-small center" style="margin-top:10px">One business at a time. Copy the message, open their inbox, mark it sent.</p>' : '') +
      (c.won ? '<p class="f25-won">' + esc(D.copy.won) + '</p>' : '') +
    '</div>';
    var btn = el.querySelector('[data-send]');
    if (btn) btn.onclick = sendMode;
  }

  // ---------- send mode: the next 5, one at a time ----------
  var OPEN = { ig: 'Instagram', email: 'your email', fb: 'Messenger', site: 'their website', call: 'your phone' };
  function sendMode() {
    var next5 = function () { return st.run.prospects.filter(function (b) { return stageOf(b.rank) === 'found'; }).slice(0, 5); };
    var q = next5();
    if (!q.length) return;
    var i = 0, sent = 0, ch = [], pick = 0;
    var box = document.createElement('div');
    box.className = 'f25-send';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Send mode');
    document.body.appendChild(box);
    document.body.classList.add('f25-noscroll');
    K.track('First25 Send Mode', { left: q.length });
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var close = function () { box.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('f25-noscroll'); drawList(); };
    document.addEventListener('keydown', onKey);
    var text = function (b, c) { return msgText(b, c.text); };
    var href = function (b, c) {
      if (c.id !== 'email') return c.href;
      var m = b.msg || {};
      return c.href + '?subject=' + encodeURIComponent(m.subject || '') + '&body=' + encodeURIComponent(withAddr(m.email || ''));
    };
    function draw() {
      if (i >= q.length) {
        var more = next5().length > 0;
        box.innerHTML = '<div class="f25-send-in"><div class="f25-send-top"><span class="label signal">Done</span><button type="button" class="f25-x" data-x aria-label="Close">×</button></div>' +
          '<h3 class="h3" style="margin:18px 0 0;font-size:26px">' + esc(sent ? F.fill(D.copy.sendDone, { n: sent }) : 'Nothing marked sent this round. Your list is right where you left it.') + '</h3>' +
          '<div class="f25-send-acts">' + (more ? '<button type="button" class="btn block" data-more>Next 5 <span class="arrow"></span></button>' : '') +
          '<button type="button" class="btn ghost block" data-x>Back to my list</button></div></div>';
        box.querySelector('.f25-send-acts button').focus();
        return;
      }
      var b = q[i], sample = st.run.sample;
      ch = F.channels(b, st.run.pack).slice(0, 3);
      var c = ch[pick] || ch[0];
      // The fact the message states, with a link to check it (the email states 2; a walk-in opens like the DM).
      var fs = F.facts(b, c.text === 'email' ? 'email' : 'dm');
      box.innerHTML = '<div class="f25-send-in">' +
        '<div class="f25-send-top"><span class="label lilac">Send mode · ' + (i + 1) + ' of ' + q.length + '</span><button type="button" class="f25-x" data-x aria-label="Close">×</button></div>' +
        '<div class="f25-meter"><span style="width:' + Math.round((100 * i) / q.length) + '%"></span></div>' +
        '<div class="f25-rank" style="margin-top:20px">#' + b.rank + (sample ? ' · Sample' : '') + '</div>' +
        '<h3 class="f25-name">' + esc(b.name) + '</h3>' + (st.run.source === 'google' ? '<div class="f25-src">' + gm() + '</div>' : '') +
        (fs.length ? '<ul class="f25-facts">' + fs.map(function (g) { return '<li>' + esc(g.why) + check(b, g.id) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="f25-chan"><div class="label">Send it by</div><div class="f25-tabs">' + ch.map(function (x, j) {
          return '<button type="button" class="f25-tab" data-ch="' + j + '" aria-selected="' + (x === c) + '">' + esc(x.label) + '</button>';
        }).join('') + '</div>' + (c.to ? '<div class="f25-to">' + esc(c.to) + '</div>' : '') + '</div>' +
        '<pre class="f25-text">' + marked(text(b, c)) + '</pre>' +
        (c.text === 'email' ? addrField() : '') +
        (c.text === 'walkin' ? '<p class="gate-small" style="margin:8px 0 0">' + esc(D.copy.walkNote) + '</p>' : '') +
        '<div class="f25-send-acts">' +
          (c.href && !sample ? '<a class="btn block" data-go href="' + esc(href(b, c)) + '" target="_blank" rel="noopener">Copy and open ' + esc(OPEN[c.id] || 'it') + '</a>' : '<button type="button" class="btn block" data-copyonly>Copy message</button>') +
          '<div class="f25-send-row"><button type="button" class="btn ghost" data-sent>Mark sent ✓</button><button type="button" class="link" data-skip>Skip</button></div>' +
          (sample ? '<p class="gate-small center" style="margin:4px 0 0">Sample business, so there is no real inbox to open.</p>' : '') +
        '</div></div>';
      var first = box.querySelector('[data-go], [data-copyonly]');
      if (first) first.focus({ preventScroll: true });
    }
    // The mailing address, saved on this device for next time, fills in as they type.
    box.addEventListener('input', function (e) {
      if (!e.target.matches('[data-addr]')) return;
      st.addr = e.target.value.trim().slice(0, 120);
      try { localStorage.setItem(ADDR, st.addr); } catch (x) {}
      var b = q[i], c = ch[pick] || ch[0];
      if (!b || !c) return;
      box.querySelector('.f25-text').innerHTML = marked(text(b, c));
      var go = box.querySelector('[data-go]');
      if (go) go.setAttribute('href', href(b, c));
    });
    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-x]')) return close();
      if (t.closest('[data-more]')) { q = next5(); i = 0; sent = 0; pick = 0; return draw(); }
      var c = t.closest('[data-ch]');
      if (c) { pick = Number(c.getAttribute('data-ch')); return draw(); }
      var b = q[i];
      if (!b) return;
      if (t.closest('[data-go]') || t.closest('[data-copyonly]')) {
        // Copy inside the tap; the link then opens their inbox in a new tab.
        K.copy(text(b, ch[pick] || ch[0]));
        K.track('First25 Send Open', { via: (ch[pick] || ch[0]).id, rank: b.rank });
        return;
      }
      if (t.closest('[data-sent]')) { setStage(b.rank, 'contacted'); sent++; i++; pick = 0; return draw(); }
      if (t.closest('[data-skip]')) { i++; pick = 0; return draw(); }
    });
    draw();
  }

  // Every cold email carries the sender's mailing address (Legal L53 part 3.1).
  function addrField() {
    return '<label class="field f25-addr"><span>' + esc(D.copy.addr.label) + '</span>' +
      '<input class="input" data-addr maxlength="120" autocomplete="street-address" placeholder="' + esc(D.copy.addr.placeholder) + '" value="' + esc(st.addr) + '"></label>' +
      '<p class="gate-small" style="margin:6px 0 0">' + esc(D.copy.addr.help) + '</p>';
  }

  // ---------- after the email ----------
  // Free next to Builder: what this tool leaves undone and what Builder adds. No totals.
  function compare(run, G) {
    var C = D.copy.compare, n = run.prospects.length;
    var free = (F.mockKind(run.pack) ? C.free : C.freeNoSample).map(function (t) { return F.fill(t, { n: n }); });
    var adds = C.builder.concat(G.hq && G.hq.on ? C.builderHq.map(function (t) { return F.fill(t, { n: n }); }) : []);
    var col = function (label, items, cls) { return '<div class="f25-col ' + cls + '"><div class="label">' + esc(label) + '</div><ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; };
    return '<div class="f25-compare">' + col(C.freeLabel, free, 'free') + col(C.builderLabel, adds, 'adds') + '</div>';
  }

  function drawAfter() {
    var run = st.run, G = RD.first25 || {}, el = $('after'), google = run.source === 'google';
    // A Google list's file keeps our findings and a map link for each, not Google's names (Legal L53 part 1.4).
    var csvLabel = google ? D.copy.csvGoogle : 'Download all ' + run.prospects.length + ' for Sheets or Notion';
    var csvBtn = K.onSite && run.id !== 'preview'
      ? '<a class="btn block" href="/first-25/r/' + encodeURIComponent(run.id) + '.csv?k=' + encodeURIComponent(run.k) + '" data-csv>' + esc(csvLabel) + '</a>'
      : '<button type="button" class="btn block" data-csv>' + esc(csvLabel) + '</button>';
    var hq = G.hq && G.hq.on ? '<div class="card f25-hq" style="margin-top:14px"><div class="label lilac">' + esc(G.hq.label) + '</div><h3 class="h3" style="margin:10px 0 8px">' + esc(G.hq.heading) + '</h3><p class="fog">' + esc(G.hq.body) + '</p></div>' : '';
    var kept = K.onSite && run.id !== 'preview';
    var until = run.keepUntil ? new Date(run.keepUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' }) : '';
    var keep = kept && until ? F.fill(D.copy.keep, { date: until }) : '';
    el.innerHTML =
      '<div class="card f25-next" style="margin-top:14px">' +
        '<div class="label lilac">' + esc(D.copy.nextLabel) + '</div>' +
        '<h3 class="h3" style="margin:10px 0 8px">' + esc(F.fill(D.copy.next, { n: run.prospects.length })) + '</h3>' +
        '<p class="fog" style="margin:0">' + esc(D.copy.nextSub) + '</p>' +
        compare(run, G) +
        (keep ? '<p class="f25-keep"><b>' + esc(F.fill(D.copy.savedHead, { n: run.prospects.length })) + '</b> ' + esc(keep) + '</p>' : '') +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<div class="label">Your first 7 days</div>' +
        '<ol class="f25-plan">' + D.plan.map(function (p, i) { return '<li><b>Day ' + (i + 1) + '</b><span>' + esc(p) + '</span></li>'; }).join('') + '</ol>' +
        '<div style="margin-top:14px">' + csvBtn + '</div>' + (google ? '<p class="gate-small center">' + esc(D.copy.csvGoogleNote) + '</p>' : '') +
        '<p class="gate-small center">Tap any business above to open its messages.</p>' +
      '</div>' +
      '<div class="card" style="margin-top:14px" id="replies"></div>' +
      '<div id="stateBlock"></div>' + hq +
      '<div class="f25-again"><a class="link" href="/first-25" data-again>Run another search</a></div>';
    drawReplies(run.prospects[0] && run.prospects[0].rank);
    var csv = el.querySelector('[data-csv]');
    csv.addEventListener('click', function (e) {
      K.track('First25 CSV', { pack: run.pack });
      if (!K.onSite) { e.preventDefault(); K.toast('On 127group.io this downloads the file.'); return; }
      if (csv.tagName === 'BUTTON') {
        e.preventDefault();
        var blob = new Blob(['﻿' + F.csv(Object.assign({}, run, { status: st.status }))], { type: 'text/csv' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'first-25.csv'; document.body.appendChild(a); a.click(); a.remove();
      }
    });
    el.querySelector('[data-again]').addEventListener('click', function (e) {
      if (K.onSite && location.pathname.indexOf('/first-25/r/') === 0) return; // the saved list goes back to the form page
      e.preventDefault();
      st.open = {};
      $('result').hidden = true; $('intro').hidden = false; $('formWrap').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    R.block($('stateBlock'), { magnet: 'first25', key: null, onStart: function () { location.href = K.href('/start?from=first-25'); } });
  }

  // Credits: Google's mark and any provider Google names (Legal L53 part 1.5), or OpenStreetMap's copyright as a link (part 2.2).
  function credits(run) {
    if (run.source === 'google') {
      return gm() + ' ' + esc(D.copy.checksBy) + (run.attributions || []).map(function (a) {
        return ' · ' + (a.uri ? '<a href="' + esc(a.uri) + '" target="_blank" rel="noopener nofollow">' + esc(a.provider) + '</a>' : esc(a.provider));
      }).join('');
    }
    var t = esc(run.attribution || '');
    return run.source === 'osm' ? t.replace('openstreetmap.org/copyright', '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a>') + searchBy(run.searchBy, ' · ') : t;
  }
  // The city lookup's own link, when its terms ask for one (LocationIQ's free plan, Legal L57): in the line, at its size.
  function searchBy(id, sep) {
    var c = id && D.copy.searchBy[id];
    return c ? (sep || ' ') + '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.text) + '</a>' : '';
  }

  // What to say when they answer, written for one business on the list.
  function drawReplies(rank) {
    var run = st.run, b = byRank(rank) || run.prospects[0], box = $('replies');
    if (!b || !box) return;
    var rs = F.replies(b, run.pack, run.buyer, { me: run.me, city: run.city, service: run.service });
    box.innerHTML = '<div class="label">When they reply</div>' +
      '<label class="field" style="margin-top:12px"><span>Replying to</span><select class="input" data-rto>' + run.prospects.map(function (p) {
        return '<option value="' + p.rank + '"' + (p.rank === b.rank ? ' selected' : '') + '>#' + p.rank + ' ' + esc(p.name) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="f25-replies">' + rs.map(function (r, i) {
        return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(r.label) + '</summary><pre class="f25-text">' + marked(r.text) + '</pre>' +
          '<div class="row"><button type="button" class="btn ghost" data-rcopy="' + i + '">Copy</button></div></details>';
      }).join('') + '</div>' +
      '<p class="f25-tip"><b>Price tip.</b> ' + esc(D.copy.priceTip) + '</p>';
    box.querySelector('[data-rto]').onchange = function () { drawReplies(Number(this.value)); };
    box.onclick = function (e) {
      var c = e.target.closest('[data-rcopy]');
      if (!c) return;
      var r = rs[Number(c.getAttribute('data-rcopy'))];
      K.copy(r.text);
      K.track('First25 Reply Copy', { kind: r.id });
    };
  }

  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function host(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

  $('who').innerHTML = R.who();

  // A saved Google list keeps place IDs only (Legal L53), so its names, websites and ratings load from Google Maps
  // each time it opens. The words that quote them and the messages are written here once they arrive.
  function hydrate(run) {
    $('intro').hidden = true; $('formWrap').hidden = true;
    var el = $('result');
    el.hidden = false;
    el.innerHTML = '<div class="f25-loading" role="status">' + esc(D.copy.details.loading) + '</div>';
    return fetch('/api/first-25/r/' + encodeURIComponent(run.id) + '/details', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: run.k }) })
      .then(function (r) { if (!r.ok) throw new Error('details'); return r.json(); })
      .then(function (j) {
        var by = {}, ctx = { me: run.me, city: run.city, service: run.service };
        (j.prospects || []).forEach(function (p) { by[p.rank] = p; });
        run.prospects.forEach(function (b) {
          var f = by[b.rank];
          if (!f) return;
          Object.assign(b, f, F.words(Object.assign({}, b, f, b.ids), run.buyer));
          delete b.ids;
          b.msg = F.messages(b, run.pack, run.buyer, ctx);
          if (b.spec) b.spec = F.spec(b, run.pack, run.buyer, ctx);
        });
        run.attributions = j.attributions || [];
        if ((j.prospects || []).length < run.prospects.length) run.detailsFailed = true;
        return run;
      })
      .catch(function () { run.detailsFailed = true; return run; });
  }

  // The saved list from the email (/first-25/r/:id): open it unlocked, no form.
  if (window.F25_RUN) {
    st.unlocked = true;
    if (window.F25_RUN.details && K.onSite) hydrate(window.F25_RUN).then(show);
    else show(window.F25_RUN);
  } else if (window.F25_RUN === null) {
    fail('That list has expired. Run a new one for free.');
  }
})();
