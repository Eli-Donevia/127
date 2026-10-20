// Email gate and the after-email result blocks shared by the three funnels
// (conversion/pages/quiz-results.md §3 to §9). Copy lives in results-data.js.
//
// Which block shows comes from the server: window.K127_LAUNCH.state is A1, A2, B or C
// (lib/funnels.js launchInfo()). Never the visitor's clock.
(function () {
  var K = window.K127, D = window.RESULTS, esc = K.esc;
  var R = {};
  // The front doors (door.js, doors-data.js) are magnets too: store, creator, site, offer.
  var THING = { score: 'results', stack: 'guide', idea: 'results', first25: 'list', store: 'audit', creator: 'list', site: 'site', offer: 'results' };
  var SOURCE = { score: 'founder-score', stack: 'day-one-stack', idea: 'idea-test', first25: 'first-25', store: 'store-audit', creator: 'brand-list', site: 'site-tonight', offer: 'offer-score' };
  var FROM = { score: 'score', stack: 'stack', idea: 'idea-test', first25: 'first-25', store: 'store-audit', creator: 'brand-list', site: 'site-tonight', offer: 'offer-score' };

  // ---------- what the server said ----------
  var KEY = function (magnet) { return '127-result-' + magnet; };
  R.saveLead = function (magnet, j) {
    var keep = {};
    ['waitlist', 'launch_optin', 'optin_sig', 'referral_link', 'referral_code', 'status_url', 'first_name', 'challenge', 'launch'].forEach(function (k) { if (j && j[k] != null) keep[k] = j[k]; });
    keep.at = Date.now();
    try { localStorage.setItem(KEY(magnet), JSON.stringify(keep)); } catch (e) {}
    return keep;
  };
  R.lead = function (magnet) { try { return JSON.parse(localStorage.getItem(KEY(magnet)) || 'null') || {}; } catch (e) { return {}; } };
  R.launch = function (magnet) {
    var L = window.K127_LAUNCH || R.lead(magnet).launch || { state: 'C' };
    L.thing = THING[magnet];
    return L;
  };
  // A line with a placeholder the server couldn't fill is left out rather than shown half-built.
  function line(s, L) { var t = D.fill(s, L); return /\{\w+\}/.test(t) ? '' : t; }
  function p(s, L, cls) { var t = line(s, L); return t ? '<p class="' + (cls || 'fog') + '">' + esc(t) + '</p>' : ''; }

  // ---------- the gate (§3): name, email, box, small line, terms, button ----------
  // o.copy overrides the magnet's label and line for this result; o.before is trusted HTML shown above them.
  R.gate = function (el, o) {
    var g = Object.assign({}, D.gate[o.magnet], o.copy || {});
    el.innerHTML = '<form class="card halo gate stack-s" novalidate>' + (o.before || '') +
      '<h3 class="h3" style="margin:0">' + esc(g.label) + '</h3>' +
      '<p class="gate-line">' + esc(g.line) + '</p>' +
      (o.name === false ? '' : '<input class="input" type="text" name="name" placeholder="First name (optional)" autocomplete="given-name" maxlength="60">') +
      '<input class="input" type="email" name="email" placeholder="you@email.com" autocomplete="email" required value="' + esc(K.savedEmail()) + '">' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      K.consentHtml() +
      '<button class="btn block" type="submit">' + esc(g.button) + ' <span class="arrow"></span></button>' +
      '<div class="form-err" hidden></div>' +
    '</form>';
    var f = el.querySelector('form'), err = f.querySelector('.form-err'), btn = f.querySelector('button');
    f.onsubmit = function (e) {
      e.preventDefault();
      var email = f.email.value.trim(), box = !!(f.optin && f.optin.checked);
      if (!K.validEmail(email)) { err.textContent = 'Enter a valid email.'; err.hidden = false; return; }
      if (f.website.value) return;
      err.hidden = true; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      K.lead({ email: email, name: f.name ? f.name.value.trim() : '', source: SOURCE[o.magnet], optin: box, data: o.data ? o.data() : {} }).then(function (j) {
        var lead = R.saveLead(o.magnet, Object.assign({}, j, { first_name: f.name ? f.name.value.trim() : '' }));
        var L = R.launch(o.magnet);
        K.track('qr_gate_submit', { magnet: o.magnet, state: L.state, flag: L.flag || 'off', box: box ? 'on' : 'off' });
        // A static preview has no server behind it, so it never says anything was sent.
        K.toast(j && j.preview ? 'Preview only. Nothing was sent.' : D.gate.toast);
        o.onDone(lead);
      }, function (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; btn.innerHTML = esc(g.button) + ' <span class="arrow"></span>'; });
    };
    return f;
  };

  // R27: the ask is on the first result screen. A bar at the bottom until the gate itself is in view.
  R.sticky = function (target, magnet) {
    var bar = document.createElement('div');
    bar.className = 'sticky-ask';
    bar.innerHTML = '<span>' + esc(D.gate[magnet].sticky || D.gate.sticky) + '</span><button class="btn" type="button">' + esc(D.gate[magnet].button) + '</button>';
    document.body.appendChild(bar);
    bar.querySelector('button').onclick = function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = target.querySelector('input[type=email]');
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 450);
    };
    var seen = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; bar.classList.toggle('on', !seen && document.body.contains(target)); }, { threshold: 0.25 }).observe(target);
    }
    requestAnimationFrame(function () { bar.classList.toggle('on', !seen); });
    return { remove: function () { bar.remove(); } };
  };

  // ---------- after the email ----------
  // o: { magnet, key (archetype key or verdict), onStart(), lines (a page's own a1, a2, resource, start, builder) }
  R.block = function (el, o) {
    var L = R.launch(o.magnet), lead = R.lead(o.magnet);
    var lines = o.lines || (o.magnet === 'score' ? D.score[o.key] : o.magnet === 'stack' ? D.stack : o.magnet === 'first25' ? D.first25 : Object.assign({ a2: D.idea.a2, start: D.idea.start }, D.idea[o.key]));
    var A = L.state === 'A1' || L.state === 'A2';
    var h = '';
    if (A) {
      if (lead.waitlist) h += foundingCard(L, lead, o.magnet) + bring3Card(L, lead);
      var ch = L.challenge;
      if (L.state === 'A1' && ch && ch.open) h += challengeCard(L, lead, lines);
      else h += doorsCard(L, lines);
    } else if (L.state === 'B') {
      h += openCard(L, lines, o.magnet);
    } else {
      h += evergreenCard(L, lines);
    }
    el.innerHTML = h;
    bind(el, L, lead, o);
  };

  function offerLines(L) {
    var ls = D.offer.map(function (s) { return line(s, L); });
    if (ls.some(function (s) { return !s; })) return '';
    return '<div class="offer-lines">' + ls.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join('') + '</div>';
  }

  function foundingCard(L, lead, magnet) {
    var F = D.founding;
    var ask = !lead.launch_optin && lead.optin_sig;
    return '<div class="card accent result-block" style="margin-top:14px">' +
      '<div class="label lilac">Founding list</div>' +
      '<h3 class="h3" style="margin:10px 0 8px">' + esc(F.heading) + '</h3>' +
      p(lead.launch_optin ? F.optedIn : F.notOptedIn, L) +
      (ask ? '<div class="optin-ask" data-r="optin-wrap"><p class="fog">' + esc(F.ask) + '</p><button class="btn ghost" type="button" data-r="optin">' + esc(F.askButton) + '</button></div>' : '') +
      offerLines(L) +
      '<a class="btn ghost block" href="/founding/doors-open.ics" data-r="cal" style="margin-top:16px">' + esc(F.calendar) + '</a>' +
    '</div>';
  }

  function bring3Card(L, lead) {
    if (!lead.referral_link) return '';
    var B = D.bring3, short = String(lead.referral_link).replace(/^https?:\/\//, '');
    return '<div class="card result-block" style="margin-top:14px">' +
      '<h3 class="h3" style="margin:0 0 8px">' + esc(line(B.heading, L)) + '</h3>' +
      p(B.body, L) +
      '<div class="ref-link mono">' + esc(short) + '</div>' +
      '<div class="row" style="gap:10px"><button class="btn block" type="button" data-r="ref-copy">' + esc(B.copy) + '</button>' +
      '<button class="btn ghost block" type="button" data-r="ref-share">' + esc(B.share) + '</button></div>' +
      (lead.status_url ? '<p style="margin:14px 0 0"><a class="link" href="' + esc(lead.status_url) + '">' + esc(B.track) + '</a></p>' : '') +
    '</div>';
  }

  // One tap, with the email they just gave: the challenge site's JSON join (POST /challenge/api/join).
  function challengeCard(L, lead, lines) {
    var C = D.challenge, ch = L.challenge || {};
    var head = '<div class="card win result-block" data-r="challenge-card" style="margin-top:14px"><div class="label signal">' + esc(C.label) + '</div>';
    if (lead.challenge) return head + '<h3 class="h3" style="margin:10px 0 0">' + esc(lead.challenge === 'new' ? line(C.done, L) || C.already : C.already) + '</h3>' + p(lines.a1, L, 'fog') + '</div>';
    return head +
      '<h3 class="h3" style="margin:10px 0 8px">' + esc(C.heading) + '</h3>' +
      '<p class="fog">' + esc([line(ch.live ? C.bodyLive : C.body, L), line(C.lives, L), line(C.finish, L)].filter(Boolean).join(' ')) + '</p>' +
      p(lines.a1, L, 'ink') +
      '<div data-r="challenge-wrap"><button class="btn block" type="button" data-r="challenge" style="margin-top:6px">' + esc(C.button) + ' <span class="arrow"></span></button>' +
      p(C.small, L, 'gate-small') + '</div>' +
    '</div>';
  }

  function doorsCard(L, lines) {
    var Dd = D.doors;
    var head = line(Dd.heading, L);
    if (!head) return '';
    return '<div class="card result-block" style="margin-top:14px">' +
      '<h3 class="h3" style="margin:0 0 8px">' + esc(head) + '</h3>' +
      '<p class="fog">' + esc([line(lines.a2, L), Dd.free].filter(Boolean).join(' ')) + '</p>' +
      '<a class="btn ghost block" href="/founding/doors-open.ics" data-r="cal" style="margin-top:6px">' + esc(D.founding.calendar) + '</a>' +
    '</div>';
  }

  function openCard(L, lines, magnet) {
    var O = D.open;
    return '<div class="card accent result-block" style="margin-top:14px">' +
      (L.lastDay ? p(O.lastDay, L, 'lilac') : '') +
      '<h3 class="h3" style="margin:0 0 8px">' + esc(O.heading) + '</h3>' +
      p(lines.resource, L, 'ink') + p(O.shared, L) +
      offerLines(L) +
      (L.spotsLeft != null ? p(O.spots, L, 'ink spots') : '') +
      '<button class="btn block" type="button" data-r="roadmap" style="margin-top:16px">' + esc(O.roadmap) + ' <span class="arrow"></span></button>' +
      '<p class="gate-small center">' + esc(O.zero) + '</p>' +
      (line(O.lock, L) ? '<p class="center" style="margin:6px 0 0"><a class="link" href="/founding/lock?from=' + FROM[magnet] + '" data-r="lock">' + esc(line(O.lock, L)) + '</a></p>' : '') +
      O.small.map(function (s) { return '<p class="gate-small">' + esc(s) + '</p>'; }).join('') +
    '</div>';
  }

  function evergreenCard(L, lines) {
    var E = D.evergreen;
    return '<div class="card accent result-block" style="margin-top:14px">' +
      '<h3 class="h3" style="margin:0 0 8px">' + esc(lines.heading || E.heading) + '</h3>' +
      p(lines.start, L, 'ink') +
      '<button class="btn block" type="button" data-r="start" style="margin-top:10px">' + esc(E.start) + ' <span class="arrow"></span></button>' +
      '<p class="gate-small center">' + esc(E.zero) + '</p>' +
      '<p class="fog" style="margin-top:16px">' + esc(line(lines.builder, L)) + ' <a class="link" href="/pricing" data-r="builder">' + esc(E.builder) + '</a></p>' +
    '</div>';
  }

  function bind(el, L, lead, o) {
    var m = o.magnet, who = o.magnet === 'idea' ? { verdict: o.key } : o.magnet === 'score' ? { archetype: o.archetype || o.key } : {};
    var on = function (r, fn) { Array.prototype.forEach.call(el.querySelectorAll('[data-r="' + r + '"]'), function (b) { b.addEventListener('click', fn); }); };
    on('cal', function () { K.track('qr_calendar_add', { magnet: m, state: L.state }); });
    on('ref-copy', function () { K.track('qr_ref_copy', { magnet: m }); K.copy(lead.referral_link); });
    on('ref-share', function () {
      K.track('qr_ref_share', { magnet: m });
      // O20 / billing terms section 5: the prefilled share text says the sharer gets a reward (conversion/pages/founding.md).
      var text = "I'm on the 127 founding list. I get a free month if you join with my link: " + lead.referral_link;
      if (navigator.share) navigator.share({ title: '127', text: text, url: lead.referral_link }).catch(function () {});
      else K.copy(lead.referral_link);
    });
    on('challenge', function (e) {
      var b = e.currentTarget, wrap = el.querySelector('[data-r="challenge-wrap"]'), card = el.querySelector('[data-r="challenge-card"]');
      b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      fetch('/challenge/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: K.savedEmail(), first_name: lead.first_name || '', source: SOURCE[m], optin: false }) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (r.ok && j.ok) {
              K.track('qr_challenge_join', Object.assign({ magnet: m }, who));
              var cur = R.lead(m); cur.challenge = j.existing ? 'existing' : 'new';
              try { localStorage.setItem(KEY(m), JSON.stringify(cur)); } catch (x) {}
              wrap.innerHTML = '<p class="ink" style="font-weight:500">' + esc(j.existing ? D.challenge.already : (line(D.challenge.done, L) || D.challenge.already)) + '</p>';
            } else if ((r.status === 400 || r.status === 429) && j.error) {
              b.disabled = false; b.innerHTML = esc(D.challenge.button) + ' <span class="arrow"></span>';
              var old = wrap.querySelector('.form-err'); if (old) old.remove();
              wrap.insertAdjacentHTML('beforeend', '<p class="form-err">' + esc(j.error) + '</p>');
            } else card.remove(); // closed (410), challenge off (404) or anything else
          });
        }, function () { card.remove(); });
    });
    on('roadmap', function () { K.track('qr_roadmap_click', Object.assign({ magnet: m }, who)); o.onStart(); });
    on('lock', function () { K.track('qr_lock_click', Object.assign({ magnet: m }, who)); });
    on('start', function () { K.track('qr_start_free_click', Object.assign({ magnet: m }, who)); o.onStart(); });
    on('builder', function () { K.track('qr_builder_click', Object.assign({ magnet: m }, who)); });
    on('optin', function (e) {
      var b = e.currentTarget, wrap = el.querySelector('[data-r="optin-wrap"]');
      b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      fetch('/api/lead/optin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: K.savedEmail(), source: SOURCE[m], s: lead.optin_sig }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); })
        .then(function () {
          K.track('qr_optin_yes', { magnet: m });
          var cur = R.lead(m); cur.launch_optin = true; delete cur.optin_sig;
          try { localStorage.setItem(KEY(m), JSON.stringify(cur)); } catch (x) {}
          wrap.innerHTML = '<p class="ink">' + esc(D.founding.askDone) + '</p>';
        }, function (ex) { wrap.innerHTML = '<p class="form-err">' + esc(ex.message) + '</p>'; });
    });
  }

  // ---------- §9 Who built this ----------
  R.who = function () {
    var W = D.who;
    return '<div class="card who" style="display:flex;gap:16px;align-items:flex-start">' +
      '<img class="who-photo" src="/img/eli-founder.jpg" alt="Eli Christiansen speaking on stage" width="56" height="56" loading="lazy">' +
      '<div><div class="label">' + esc(W.heading) + '</div>' +
        '<p class="ink" style="margin:8px 0 6px">' + esc(W.name) + '</p>' +
        '<ul class="who-points">' + W.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<p class="gate-small" style="margin-top:10px">' + esc(W.note) + ' <a href="/earnings-disclaimer">Earnings disclaimer</a></p></div>' +
    '</div>';
  };

  K.R = R;
})();
