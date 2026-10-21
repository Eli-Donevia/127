// Quote builder (lib/tools 'quote', Legal L92): the member's business name and up to ten quotes, each with line
// items, their own tax rate, a valid-until date and their own terms (empty to start). Total = items + the member's
// tax rate; 127 doesn't work out sales tax. A quote's private link is made on the server (POST .../quote/share), a
// random token that stops at valid-until or after 90 days and can be turned off; 127 never sends it. The total is
// the one thing lit in Pop. No example prices anywhere (L82 T2). Saves { from, quotes } as the member types.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var today = T.iso(new Date());
  var MAX = 10, DAYS = 90;
  var data = T.state.data, sel = null;
  var readOnly = !T.state.canSave;
  var STATES = [['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined']];

  function next() {
    var n = data.quotes.reduce(function (m, q) { var x = parseInt(String(q.number).replace(/\D/g, ''), 10); return isFinite(x) && x > m ? x : m; }, 0) + 1;
    return 'Q-' + String(n).padStart(4, '0');
  }
  function blank() { return { id: uid(), number: next(), client: '', title: '', items: [{ name: '', qty: 1, price: 0 }], tax: data.quotes[0] ? data.quotes[0].tax : 0, made: today, until: T.addDays(today, 30), terms: '', state: 'draft' }; }
  function totals(q) {
    var sub = q.items.reduce(function (n, i) { return n + i.qty * i.price; }, 0), tax = Math.round(sub * q.tax) / 100;
    return { sub: sub, tax: tax, total: sub + tax };
  }
  function ends(q) {
    var made = Date.parse(q.share.at) + DAYS * 864e5, until = q.until ? Date.parse(q.until + 'T23:59:59') : Infinity;
    return new Date(Math.min(made, until));
  }
  function cur() { return data.quotes.filter(function (q) { return q.id === sel; })[0] || null; }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data || !data.quotes.length && !data.from) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'A quote that looks as good as the work.' }),
      el('p', { class: 'tl-start-s', text: 'Your line items, your tax rate and your terms, laid out clean. Send it as a private link that stops working when you say.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Make my first quote', onclick: function () { data = { from: (data && data.from) || '', quotes: [] }; var q = blank(); data.quotes.unshift(q); sel = q.id; changed(); draw(); var f = root.querySelector('.qt-from'); if (f) f.focus(); } }),
      ]),
    ]));
    if (!cur()) sel = data.quotes[0] ? data.quotes[0].id : null;
    var from = T.text({ value: data.from, max: 60, placeholder: 'Your business name', aria: 'Your business name', disabled: readOnly, onInput: function (v) { data.from = v; changed(); } });
    from.classList.add('qt-from');
    root.appendChild(el('label', { class: 'tl-f iv-ideaf' }, [el('span', { class: 'tl-f-l', text: 'Your business name, as it shows on the quote' }), from]));
    nodes.tabs = el('div', { class: 'hk-chips qt-tabs', role: 'tablist', 'aria-label': 'Quotes' });
    nodes.main = el('div', { class: 'qt-main' });
    root.appendChild(nodes.tabs);
    root.appendChild(nodes.main);
    tabs();
    quote();
  }

  function tabs() {
    nodes.tabs.innerHTML = '';
    data.quotes.forEach(function (q) {
      nodes.tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(q.id === sel), class: 'cv-pick-c' + (q.id === sel ? ' on' : ''), text: q.number + (q.client ? ' · ' + q.client : ''), onclick: function () { sel = q.id; tabs(); quote(); } }));
    });
    var full = data.quotes.length >= MAX;
    nodes.tabs.appendChild(el('button', { type: 'button', class: 'tl-act qt-new', disabled: full || readOnly || null, title: full ? 'Up to ten quotes. Delete an old one to make room.' : null, text: 'New quote', onclick: function () { var q = blank(); data.quotes.unshift(q); sel = q.id; changed(); tabs(); quote(); } }));
  }

  function quote() {
    nodes.main.innerHTML = '';
    var q = cur();
    if (!q) return nodes.main.appendChild(el('p', { class: 'tl-note', text: 'No quotes yet.' }));
    var txt = function (label, k, max, o) {
      o = o || {};
      var input = T.text({ value: q[k], max: max, placeholder: o.ph || '', aria: label, disabled: readOnly, onInput: function (v) { q[k] = v; changed(); if (k === 'client' || k === 'number') tabs(); } });
      return el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: label }), input, o.hint ? el('span', { class: 'tl-f-h', text: o.hint }) : null]);
    };
    var date = function (label, k) {
      var d = el('input', { class: 'tl-sel', type: 'date', value: q[k] || '', 'aria-label': label, disabled: readOnly || null });
      d.addEventListener('change', function () { q[k] = d.value || null; changed(); if (k === 'until') share(); });
      return el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: label }), d]);
    };
    nodes.lines = el('div', { class: 'qt-lines' });
    nodes.tot = el('div', { class: 'qt-tot' });
    nodes.share = el('section', { class: 'tl-panel qt-share' });
    var terms = el('textarea', { class: 'cl-note qt-terms', maxlength: 600, rows: 4, 'aria-label': 'Terms', disabled: readOnly || null });
    terms.value = q.terms;
    terms.addEventListener('input', function () { q.terms = terms.value; changed(); });
    var tax = T.field({ label: 'Tax rate', value: q.tax || '', post: '%', disabled: readOnly, hint: 'Your rate. 127 doesn’t work out sales tax for you.', onInput: function (v) { q.tax = Math.min(30, Math.max(0, v)); changed(); totalsDraw(); } });
    nodes.main.appendChild(el('section', { class: 'tl-panel qt-doc' }, [
      el('div', { class: 'cl-grid' }, [
        txt('Who it’s for', 'client', 60, { hint: 'A name only. The link page never shows an email.' }),
        txt('What it’s for', 'title', 80),
        txt('Quote number', 'number', 20),
        el('div', { class: 'qt-dates' }, [date('Date', 'made'), date('Valid until', 'until')]),
      ]),
      el('div', { class: 'hk-chips' }, STATES.map(function (s) {
        return el('button', { type: 'button', class: 'cv-pick-c' + (q.state === s[0] ? ' on' : ''), 'aria-pressed': String(q.state === s[0]), disabled: readOnly || null, text: s[1], onclick: function () { q.state = s[0]; changed(); quote(); } });
      })),
      el('h2', { class: 'tl-h qt-h', text: 'Line items' }),
      nodes.lines,
      readOnly ? null : el('button', { type: 'button', class: 'tl-act', text: 'Add a line', disabled: q.items.length >= 20 || null, onclick: function () { q.items.push({ name: '', qty: 1, price: 0 }); changed(); lines(); var all = nodes.lines.querySelectorAll('.qt-name'); all[all.length - 1].focus(); } }),
      el('div', { class: 'qt-foot' }, [tax, nodes.tot]),
      el('label', { class: 'tl-f qt-termsf' }, [el('span', { class: 'tl-f-l', text: 'Terms' }), terms, el('span', { class: 'tl-f-h', text: 'Template, not legal advice. Laws differ by state, so have a lawyer check anything you’ll sign.' })]),
    ]));
    nodes.main.appendChild(nodes.share);
    if (!readOnly) nodes.main.appendChild(el('div', { class: 'cl-acts' }, [el('button', { type: 'button', class: 'tl-act cl-del', text: 'Delete this quote', onclick: function () {
      if (!window.confirm('Delete ' + q.number + '? Its link stops working too. This can’t be undone.')) return;
      data.quotes.splice(data.quotes.indexOf(q), 1); sel = null; changed(); draw();
    } })]));
    lines();
    share();
  }

  function lines() {
    var q = cur();
    nodes.lines.innerHTML = '';
    q.items.forEach(function (it, i) {
      var name = T.text({ value: it.name, max: 80, placeholder: 'What you’ll do or deliver', aria: 'Item ' + (i + 1), disabled: readOnly, onInput: function (v) { it.name = v; changed(); } });
      name.classList.add('qt-name');
      var amt = el('span', { class: 'qt-amt' });
      var set = function () { amt.textContent = T.money(it.qty * it.price, 2); totalsDraw(); };
      nodes.lines.appendChild(el('div', { class: 'qt-line' }, [
        name,
        T.field({ label: 'Qty', value: it.qty, cls: 'qt-qty', disabled: readOnly, onInput: function (v) { it.qty = v; changed(); set(); } }),
        T.field({ label: 'Price', value: it.price || '', pre: '$', cls: 'qt-price', disabled: readOnly, onInput: function (v) { it.price = v; changed(); set(); } }),
        amt,
        readOnly ? null : el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove item ' + (i + 1), text: '×', disabled: q.items.length < 2 || null, onclick: function () { q.items.splice(i, 1); changed(); lines(); } }),
      ]));
      amt.textContent = T.money(it.qty * it.price, 2);
    });
    totalsDraw();
  }

  function totalsDraw() {
    var q = cur(), t = totals(q);
    nodes.tot.innerHTML = '';
    nodes.tot.appendChild(el('dl', {}, [
      el('div', {}, [el('dt', { text: 'Subtotal' }), el('dd', { text: T.money(t.sub, 2) })]),
      el('div', {}, [el('dt', { text: 'Tax' + (q.tax ? ' (' + q.tax + '%)' : '') }), el('dd', { text: T.money(t.tax, 2) })]),
      el('div', { class: 'all' }, [el('dt', { text: 'Total' }), el('dd', { class: 'qt-total' + (t.total > 0 ? ' lit' : ''), text: T.money(t.total, 2) })]),
    ]));
  }

  // The private link. 127 makes it and shows it; the member sends it themselves.
  function share() {
    var q = cur();
    nodes.share.innerHTML = '';
    nodes.share.appendChild(el('h2', { class: 'tl-h', text: 'Private link' }));
    if (readOnly) return nodes.share.appendChild(el('p', { class: 'tl-note', text: 'Comes with Builder.' }));
    if (!q.share) {
      nodes.share.appendChild(el('p', { class: 'tl-note', text: 'Anyone with the link can see this quote, without an account, until ' + T.day(T.iso(ends({ share: { at: new Date().toISOString() }, until: q.until }))) + '. You can turn it off any time.' }));
      nodes.share.appendChild(el('div', { class: 'cl-acts' }, [el('button', { type: 'button', class: 'btn', text: 'Make a private link', onclick: function (e) { toggle(q, true, e.currentTarget); } })]));
      return;
    }
    var url = location.origin + '/q/' + q.share.token;
    var box = el('input', { class: 'tl-tx qt-url', type: 'text', readonly: true, value: url, 'aria-label': 'Private link' });
    box.addEventListener('focus', function () { box.select(); });
    var copy = el('button', { type: 'button', class: 'btn', text: 'Copy link', onclick: function () {
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy link'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { box.select(); });
      else { box.select(); done(); }
    } });
    nodes.share.appendChild(box);
    nodes.share.appendChild(el('p', { class: 'tl-note', text: 'Works until ' + T.day(T.iso(ends(q))) + '. 127 doesn’t send it for you: paste it into your own email or messages.' }));
    nodes.share.appendChild(el('div', { class: 'cl-acts' }, [
      copy,
      el('a', { class: 'tl-act', href: url, target: '_blank', rel: 'noopener noreferrer', text: 'Open it' }),
      el('button', { type: 'button', class: 'tl-act', text: 'Turn the link off', onclick: function (e) { toggle(q, false, e.currentTarget); } }),
    ]));
  }

  // Waits for the quote's last edit to save, so the server has it, then asks for the link.
  function toggle(q, on, btn, tries) {
    tries = tries || 0;
    var saved = document.getElementById('tool-saved');
    btn.disabled = true;
    if (saved && /Editing|Saving/.test(saved.textContent) && tries < 8) return setTimeout(function () { toggle(q, on, btn, tries + 1); }, 500);
    fetch('/app/hq/tools/quote/share', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id: q.id, on: on }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 409 && tries < 8) { setTimeout(function () { toggle(q, on, btn, tries + 1); }, 700); return null; } if (!r.ok) throw new Error(j.error || 'Could not do that'); return j; }); })
      .then(function (j) { if (!j) return; q.share = j.token ? { token: j.token, at: j.at } : null; share(); })
      .catch(function (e) { btn.disabled = false; nodes.share.appendChild(el('p', { class: 'tl-note qt-err', text: e.message + '.' })); });
  }

  function changed() { if (!readOnly) T.save(data); }
  draw();
})();
