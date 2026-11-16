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
})();
