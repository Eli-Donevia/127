// The coach platform (prototype): small, dependency-free enhancements. Pages work without it except photo uploads.
(function () {
  'use strict';
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---- program builder: add / remove / duplicate, then renumber every name so the server gets clean arrays ----
  var builder = document.querySelector('[data-builder]');
  if (builder) {
    var renumber = function () {
      $$('[data-week]', builder).forEach(function (w, wi) {
        var t = w.querySelector('[data-week-title]');
        if (t) t.textContent = 'Week ' + (wi + 1);
        $$('[data-day]', w).forEach(function (d, di) {
          var pre = 'weeks[' + wi + '][days][' + di + ']';
          d.querySelector('[data-f="title"]').name = pre + '[title]';
          $$('[data-ex]', d).forEach(function (e, ei) {
            $$('[data-f]', e).forEach(function (inp) { inp.name = pre + '[exercises][' + ei + '][' + inp.getAttribute('data-f') + ']'; });
          });
        });
      });
    };
    var blank = function (node) { $$('input', node).forEach(function (i) { if (i.getAttribute('data-f') !== 'sets' && i.getAttribute('data-f') !== 'reps') i.value = ''; }); return node; };
    builder.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b || b.type === 'submit') return;
      if (b.hasAttribute('data-add-ex')) { var day = b.closest('[data-day]'); var ex = $$('[data-ex]', day); var n = blank(ex[ex.length - 1].cloneNode(true)); b.before(n); }
      if (b.hasAttribute('data-add-day')) { var week = b.closest('[data-week]'); var days = $$('[data-day]', week); var nd = days[days.length - 1].cloneNode(true); $$('[data-ex]', nd).slice(1).forEach(function (x) { x.remove(); }); blank(nd); nd.querySelector('[data-f="title"]').value = 'Day ' + (days.length + 1); week.querySelector('.pb-days').appendChild(nd); }
      if (b.hasAttribute('data-dup-week')) { var w = b.closest('[data-week]'); w.after(w.cloneNode(true)); }
      if (b.hasAttribute('data-add-week')) { var ws = $$('[data-week]', builder); ws[ws.length - 1].after(ws[ws.length - 1].cloneNode(true)); }
      var del = b.getAttribute('data-del');
      if (del) {
        var sel = { ex: '[data-ex]', day: '[data-day]', week: '[data-week]' }[del];
        var node = b.closest(sel);
        if (node && $$(sel, node.parentNode).length > 1) node.remove();
      }
      renumber();
    });
    builder.addEventListener('submit', renumber);
  }

  // ---- challenge rules editor ----
  var rules = document.querySelector('[data-rules]');
  if (rules) {
    var list = rules.querySelector('[data-rule-list]');
    var re = function () { $$('[data-rule]', list).forEach(function (r, i) { r.querySelector('.n').textContent = i + 1; $$('[data-f]', r).forEach(function (inp) { inp.name = 'rules[' + i + '][' + inp.getAttribute('data-f') + ']'; }); }); };
    rules.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-add-rule')) { var rows = $$('[data-rule]', list); var n = rows[rows.length - 1].cloneNode(true); $$('input', n).forEach(function (i) { i.value = ''; }); n.querySelector('select').value = 'none'; list.appendChild(n); re(); }
      if (b.getAttribute('data-del') === 'rule' && $$('[data-rule]', list).length > 1) { b.closest('[data-rule]').remove(); re(); }
    });
  }

  // ---- habits: tick saves straight away ----
  $$('[data-autosubmit]').forEach(function (f) {
    f.addEventListener('change', function (ev) { var l = ev.target.closest('.habit'); if (l) l.classList.toggle('on', ev.target.checked); f.submit(); });
  });
  // checklist: live state on the row
  $$('[data-checklist] .rule-main input').forEach(function (i) { i.addEventListener('change', function () { i.closest('.rule').classList.toggle('on', i.checked); }); });

  // ---- adherence slider label ----
  $$('[data-range]').forEach(function (r) { var o = r.closest('label').querySelector('[data-out]'); r.addEventListener('input', function () { o.textContent = r.value + '%'; }); });

  // ---- photos: upload the raw file, keep the returned id in a hidden field ----
  var upload = function (url, file) {
    return fetch(url, { method: 'POST', headers: { 'content-type': file.type }, body: file, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  };
  var checkin = document.querySelector('[data-checkin]');
  if (checkin) {
    var box = checkin.querySelector('[data-photos]');
    checkin.querySelector('[data-photo-input]').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      upload(box.getAttribute('data-url'), f).then(function (j) {
        if (j.error) return alert(j.error);
        var img = document.createElement('img'); img.src = j.url; box.appendChild(img);
        var h = document.createElement('input'); h.type = 'hidden'; h.name = 'photos'; h.value = j.id; checkin.appendChild(h);
      });
      ev.target.value = '';
    });
  }
  $$('[data-proof-photo]').forEach(function (p) {
    var input = p.querySelector('input[type=file]');
    input.addEventListener('change', function () {
      var f = input.files[0];
      if (!f) return;
      upload(p.getAttribute('data-url'), f).then(function (j) {
        if (j.error) return alert(j.error);
        p.querySelector('input[type=hidden]').value = j.id;
        var img = p.querySelector('img') || p.insertBefore(document.createElement('img'), p.querySelector('label'));
        img.src = j.url;
        var row = p.closest('.rule'); var cb = row && row.querySelector('.rule-main input'); if (cb) { cb.checked = true; row.classList.add('on'); }
      });
    });
  });

  // ---- copy invite link ----
  $$('[data-copy]').forEach(function (i) { i.addEventListener('focus', function () { i.select(); }); });
  $$('[data-copy-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = b.parentNode.querySelector('[data-copy]'); if (!i) return;
      var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(i.value).then(done, function () { i.select(); });
      else { i.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    });
  });

  // ---- workout: a tapped set lights up straight away ----
  $$('.set-done input').forEach(function (i) { i.addEventListener('change', function () { i.closest('.set').classList.toggle('on', i.checked); }); });

  // ---- brand: the coach's photo or logo, uploaded raw like check-in photos ----
  var bp = document.querySelector('[data-brand-photo]');
  if (bp) {
    bp.querySelector('input[type=file]').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var msg = bp.querySelector('[data-msg]'); msg.textContent = 'Uploading...';
      upload('/coach/brand/photo', f).then(function (j) {
        if (j.error) { msg.textContent = j.error; return; }
        msg.textContent = 'Saved. Your app and site use it now.';
        $$('[data-brand-img]').forEach(function (img) { img.src = j.url; img.hidden = false; });
        $$('[data-brand-ini]').forEach(function (s) { s.hidden = true; });
      }, function () { msg.textContent = 'That upload did not go through. Try again.'; });
      ev.target.value = '';
    });
  }

  // ---- brand: the phone preview follows the look, color and name ----
  var form = document.querySelector('[data-brand-form]'), phone = document.querySelector('[data-phone]');
  if (form && phone) {
    var sync = function () {
      var lk = form.querySelector('input[name=look]:checked'); if (lk) phone.setAttribute('data-look', lk.value);
      var ac = form.querySelector('input[name=accent]'); if (ac) { phone.style.setProperty('--accent', ac.value); phone.style.setProperty('--accent-soft', ac.value + '1f'); phone.style.setProperty('--accent-mid', ac.value + '55'); }
      var nm = form.querySelector('input[name=brandName]'); $$('[data-pv-name]', phone).forEach(function (n) { n.textContent = nm.value || 'Your brand'; });
    };
    form.addEventListener('input', sync); form.addEventListener('change', sync);
  }
  // ---- Today: the header sits on the coach's photo, then turns solid as you scroll ----
  if (document.body.classList.contains('has-hero')) {
    var onScroll = function () { document.body.classList.toggle('scrolled', window.scrollY > 120); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  // ---- import: read the chosen CSV into the form (the server parses it; nothing is saved before the preview) ----
  var im = document.querySelector('[data-import]');
  if (im) {
    im.querySelector('[data-import-file]').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var label = im.querySelector('[data-import-label]');
      if (f.size > 150 * 1024) { label.textContent = 'That file is over 150 KB. Split it into smaller files.'; return; }
      var r = new FileReader();
      r.onload = function () { im.querySelector('[data-import-text]').value = r.result; im.querySelector('[data-import-name]').value = f.name; label.textContent = f.name; };
      r.readAsText(f);
    });
    // the file input itself is never sent
    im.addEventListener('submit', function () { im.querySelector('[data-import-file]').disabled = true; });
  }
})();
