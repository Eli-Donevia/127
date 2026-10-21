// Money overview (lib/tools 'money'): the member's month totals (revenue, costs by their own categories, cash at the
// month end), typed in or added up here in the browser from a bank file, plus bills and invoices with due dates.
// No outside scripts load on this page (L92 MO3).
// Out: revenue, costs, profit and cash with the change on the month before, cash across twelve months, where the
// money went, and what's due. Only the totals and the category rules are saved; a bank file's rows never leave the
// page. Fields start empty and there are no example numbers (Legal L82). Accent: the cash line is the one neon (Ion,
// Pop at its head); the biggest cost is lit in Pop.
(function () {
  'use strict';
  var T = window.Tool, el = T.el, svg = T.svg;
  var root = T.root;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SUGGEST = ['Rent', 'Software', 'Ads', 'Supplies', 'Payroll', 'Contractors', 'Fees', 'Travel'];
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var ym = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  var shift = function (m, n) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 15); return ym(d); };
  var label = function (m, long) { var p = m.split('-'); return (long ? LONG : MON)[+p[1] - 1] + (long ? ' ' + p[0] : ''); };
  var thisMonth = ym(new Date()), today = T.iso(new Date());

  var data = T.state.data, readOnly = !T.state.canSave, sel = null, fileView = null;
  var blank = function () { return { cats: [], months: [], bills: [], invoices: [], rules: [] }; };
  if (readOnly && !data) data = blank();
  // The category rules (words from bank rows, which can name a person) stay in this browser under the member's id,
  // never on 127 (Legal L92 MO2). Start over empties the saved totals, and an empty tool forgets the rules too.
  if (!T.state.data) T.device.clear('money-rules');
  if (data) data.rules = (T.device.get('money-rules') || []).filter(function (r) { return r && r.match && r.cat < data.cats.length; });

  var monthOf = function (m) { return data.months.filter(function (x) { return x.month === m; })[0] || null; };
  function ensure(m) {
    var x = monthOf(m);
    if (!x) { x = { month: m, revenue: 0, costs: data.cats.map(function () { return 0; }), cash: null }; data.months.push(x); data.months.sort(function (a, b) { return a.month < b.month ? 1 : -1; }); }
    return x;
  }
  var costOf = function (x) { return x ? x.costs.reduce(function (s, c) { return s + (+c || 0); }, 0) : 0; };
  var prevOf = function (m) { return data.months.filter(function (x) { return x.month < m; })[0] || null; };

  // ---------- page ----------
  var nodes = {};
  function draw() {
    root.innerHTML = '';
    nodes = {};
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'What came in and went out last month?' }),
      el('p', { class: 'tl-start-s', text: 'Type the totals, or drop in the file your bank exports. It is added up here on your device and only the month totals are kept.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Type last month', onclick: function () { data = blank(); sel = shift(thisMonth, -1); ensure(sel); changed(); draw(); var f = root.querySelector('.mo-entry input'); if (f) f.focus(); } }),
        importButton('Import a bank file', 'tl-act'),
      ]),
    ]));
    if (!sel) sel = (data.months[0] && data.months[0].month) || shift(thisMonth, -1);
    root.appendChild(head());
    nodes.tiles = el('section', { class: 'mo-tiles', 'aria-label': 'This month' });
    nodes.chart = el('section', { class: 'tl-panel mo-chart' });
    nodes.top = el('section', { class: 'tl-panel mo-top' });
    nodes.status = el('section', { class: 'tl-panel mo-status' });
    T.reveal(nodes.chart, 'money-chart');
    root.appendChild(nodes.tiles);
    root.appendChild(el('div', { class: 'mo-grid' }, [nodes.chart, nodes.top]));
    root.appendChild(el('div', { class: 'mo-grid' }, [entry(), nodes.status]));
    if (fileView) root.appendChild(fileView);
    root.appendChild(el('div', { class: 'mo-grid' }, [dues('bills', 'Bills to pay', 'Insurance, quarterly tax'), dues('invoices', 'Invoices out', 'Invoice 104')]));
    root.appendChild(T.estimate());
    update();
  }

  function head() {
    var latest = data.months[0] && data.months[0].month, current = latest && latest >= shift(thisMonth, -1);
    return el('div', { class: 'mo-head' }, [
      el('div', { class: 'mo-sw', role: 'group', 'aria-label': 'Month' }, [
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Month before', text: '‹', onclick: function () { sel = shift(sel, -1); draw(); } }),
        el('b', { text: label(sel, true) }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Month after', text: '›', disabled: sel >= thisMonth ? true : null, onclick: function () { sel = shift(sel, 1); draw(); } }),
      ]),
      el('span', { class: 'mo-books' + (current ? ' ok' : '') , text: !latest ? 'Nothing entered yet' : current ? 'Up to date through ' + label(latest) : 'Last entered: ' + label(latest, true) }),
    ]);
  }

  // ---------- tiles ----------
  function delta(now, was, goodUp) {
    if (was == null || !isFinite(was) || was === 0 || now == null) return { t: was == null ? 'No month before to compare' : '', c: '' };
    var ch = ((now - was) / Math.abs(was)) * 100, up = ch >= 0;
    return { t: (up ? '↑ ' : '↓ ') + T.pct(Math.abs(ch)) + ' vs ' + label(prevOf(sel).month), c: Math.abs(ch) < 0.05 ? '' : up === goodUp ? 'up' : '' };
  }
  function tile(k, v, d, big) {
    return el('div', { class: 'mo-tile' + (big ? ' big' : '') }, [el('span', { class: 'tl-k', text: k }), el('b', { class: 'mo-v', text: v }), el('span', { class: 'tl-d ' + d.c, text: d.t })]);
  }
  function tiles() {
    var x = monthOf(sel), p = prevOf(sel), rev = x ? x.revenue : null, cost = x ? costOf(x) : null, prof = x ? rev - cost : null;
    var pr = p ? p.revenue : null, pc = p ? costOf(p) : null;
    nodes.tiles.innerHTML = '';
    nodes.tiles.appendChild(tile('Revenue, ' + label(sel), x ? T.money(rev, 0) : '–', delta(rev, pr, true)));
    nodes.tiles.appendChild(tile('Costs, ' + label(sel), x ? T.money(cost, 0) : '–', delta(cost, pc, false)));
    var pd = delta(prof, p ? pr - pc : null, true);
    if (x && prof < 0) pd = { t: 'Costs ran ahead of revenue', c: 'warn' };
    nodes.tiles.appendChild(tile('Profit, ' + label(sel), x ? T.money(prof, 0) : '–', pd));
    var cashAt = data.months.filter(function (m) { return m.month <= sel && m.cash != null; })[0];
    nodes.tiles.appendChild(tile('Cash on hand', cashAt ? T.money(cashAt.cash, 0) : '–', { t: cashAt ? 'at the end of ' + label(cashAt.month) : 'Add cash at the month end', c: '' }));
  }

  // ---------- cash, twelve months ----------
  function chart() {
    var box = nodes.chart, pts = [];
    box.innerHTML = '';
    for (var i = 11; i >= 0; i -= 1) { var m = shift(sel, -i), x = monthOf(m); pts.push({ m: m, v: x && x.cash != null ? x.cash : null }); }
    var have = pts.filter(function (p) { return p.v != null; });
    var first = have[0], last = have[have.length - 1];
    var ch = first && last && first !== last && first.v ? ((last.v - first.v) / Math.abs(first.v)) * 100 : null;
    box.appendChild(el('div', { class: 'mo-ph' }, [el('h2', { class: 'tl-h', text: 'Cash, last 12 months' }), ch != null ? el('span', { class: 'mo-ch', text: (ch >= 0 ? '+' : '−') + T.pct(Math.abs(ch), 0) }) : null]));
    if (have.length < 2) { box.appendChild(el('p', { class: 'tl-note mo-empty', text: 'Add the cash in the bank at the end of two months or more and the line draws here.' })); return; }
    var W = Math.max(280, box.clientWidth - 48 || 560), H = W < 420 ? 170 : 210, L = 4, R = 8, top = 14, bot = 26;
    var lo = Math.min(0, Math.min.apply(null, have.map(function (p) { return p.v; }))), hi = Math.max.apply(null, have.map(function (p) { return p.v; }));
    if (hi === lo) hi = lo + 1;
    var X = function (i) { return L + (i / 11) * (W - L - R); }, Y = function (v) { return top + (1 - (v - lo) / (hi - lo)) * (H - top - bot); };
    var s = svg('svg', { class: 'mo-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Cash at each month end: ' + have.map(function (p) { return label(p.m) + ' ' + T.money(p.v, 0); }).join(', ') });
    var gid = 'mo-g-' + uid(), fid = 'mo-f-' + uid();
    var defs = svg('defs');
    var g = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svg('stop', { offset: '0', 'stop-color': '#5be4ff', 'stop-opacity': '.2' }));
    g.appendChild(svg('stop', { offset: '1', 'stop-color': '#5be4ff', 'stop-opacity': '0' }));
    var f = svg('filter', { id: fid, x: '-10%', y: '-40%', width: '120%', height: '180%' });
    f.appendChild(svg('feGaussianBlur', { stdDeviation: 2.5 }));
    defs.appendChild(g); defs.appendChild(f); s.appendChild(defs);
    if (lo < 0) s.appendChild(svg('path', { d: 'M' + L + ' ' + Y(0) + 'H' + (W - R), class: 'mo-zero' }));
    // Smooth through the months that have a number; gaps are skipped, not invented.
    var idx = pts.map(function (p, i) { return p.v != null ? i : -1; }).filter(function (i) { return i >= 0; });
    var d = '';
    idx.forEach(function (i, k) {
      var x = X(i), y = Y(pts[i].v);
      if (!k) { d += 'M' + x + ' ' + y; return; }
      var j = idx[k - 1], px = X(j), py = Y(pts[j].v), mx = (px + x) / 2;
      d += ' C' + mx + ' ' + py + ' ' + mx + ' ' + y + ' ' + x + ' ' + y;
    });
    var a0 = X(idx[0]), a1 = X(idx[idx.length - 1]);
    s.appendChild(svg('path', { d: d + ' L' + a1 + ' ' + (H - bot) + ' L' + a0 + ' ' + (H - bot) + ' Z', fill: 'url(#' + gid + ')', class: 'mo-area' }));
    s.appendChild(svg('path', { d: d, class: 'mo-glow', filter: 'url(#' + fid + ')' }));
    var line = svg('path', { d: d, class: 'mo-line' });
    s.appendChild(line);
    var li = idx[idx.length - 1];
    s.appendChild(svg('circle', { cx: X(li), cy: Y(pts[li].v), r: 4.5, class: 'mo-head' }));
    var every = W < 420 ? 3 : 2;
    pts.forEach(function (p, i) {
      if (i % every && i !== 11) return;
      var t = svg('text', { x: X(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === 11 ? 'end' : 'middle', class: 'mo-ax' + (i === 11 ? ' on' : '') });
      t.textContent = label(p.m) + (p.m.slice(5) === '01' || i === 0 ? ' ’' + p.m.slice(2, 4) : '');
      s.appendChild(t);
    });
    box.appendChild(s);
    try { var len = line.getTotalLength(); line.style.strokeDasharray = len; line.style.setProperty('--len', len); } catch (e) { /* draws without the intro */ }
  }

  // ---------- where it went ----------
  function topCosts() {
    var box = nodes.top, x = monthOf(sel);
    box.innerHTML = '';
    box.appendChild(el('h2', { class: 'tl-h', text: 'Where it went, ' + label(sel) }));
    var rows = x ? data.cats.map(function (c, i) { return { c: c, v: +x.costs[i] || 0 }; }).filter(function (r) { return r.v > 0; }).sort(function (a, b) { return b.v - a.v; }) : [];
    if (!rows.length) { box.appendChild(el('p', { class: 'tl-note mo-empty', text: data.cats.length ? 'No costs in ' + label(sel, true) + ' yet.' : 'Add the kinds of costs you have, then what each came to.' })); return; }
    var max = rows[0].v, total = rows.reduce(function (s, r) { return s + r.v; }, 0);
    rows.slice(0, 6).forEach(function (r, i) {
      box.appendChild(el('div', { class: 'mo-bar' + (i === 0 ? ' lead' : '') }, [
        el('span', { class: 'mo-bn', text: r.c }),
        el('b', { text: T.money(r.v, 0) }),
        el('span', { class: 'mo-bp', text: T.pct((r.v / total) * 100, 0) }),
        el('i', { 'aria-hidden': 'true' }, [el('i', { style: 'width:' + Math.max(2, (r.v / max) * 100) + '%' })]),
      ]));
    });
    if (rows.length > 6) box.appendChild(el('p', { class: 'tl-note', text: 'And ' + (rows.length - 6) + ' smaller ' + (rows.length - 6 === 1 ? 'one' : 'ones') + '.' }));
  }

  // ---------- what's due ----------
  function status() {
    var box = nodes.status, in30 = T.addDays(today, 30);
    var bills = data.bills.filter(function (b) { return !b.paid; }), soon = bills.filter(function (b) { return b.due && b.due <= in30; });
    var owed = data.invoices.filter(function (b) { return !b.paid; }), late = owed.filter(function (b) { return b.due && b.due < today; });
    var sum = function (l) { return l.reduce(function (s, b) { return s + b.amount; }, 0); };
    var latest = data.months[0] && data.months[0].month, current = latest && latest >= shift(thisMonth, -1);
    var x = monthOf(sel), margin = x && x.revenue > 0 ? ((x.revenue - costOf(x)) / x.revenue) * 100 : null;
    box.innerHTML = '';
    box.appendChild(el('h2', { class: 'tl-h', text: 'Where things stand' }));
    var row = function (k, v, cls, sub) { return el('div', { class: 'mo-st' }, [el('span', { class: 'mo-stk' }, [k, sub ? el('small', { text: sub }) : null]), el('b', { class: cls || '', text: v })]); };
    box.appendChild(row('Books', !latest ? 'Not started' : current ? 'Up to date' : 'Behind', current ? 'ok' : '', latest ? 'Last month entered: ' + label(latest, true) : ''));
    box.appendChild(row('Bills due in 30 days', soon.length ? T.money(sum(soon), 0) : 'None', '', soon.length ? soon.length + (soon.length === 1 ? ' bill' : ' bills') + (soon[0] ? ', next ' + T.day(soon.slice().sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0].due) : '') : ''));
    box.appendChild(row('Unpaid invoices', owed.length ? T.money(sum(owed), 0) : 'None', late.length ? 'warn' : '', late.length ? late.length + ' past due: ' + T.money(sum(late), 0) : owed.length ? 'none past due' : ''));
    box.appendChild(row('Kept from each $1 of revenue', margin == null ? '–' : T.money(margin / 100, 2), '', x ? label(sel, true) : ''));
    box.appendChild(el('a', { class: 'link mo-run', href: '/app/hq/tools/cash', text: 'The next 13 weeks, week by week: Cash runway' }));
  }

  // ---------- typing a month ----------
  function entry() {
    var x = monthOf(sel);
    var box = el('section', { class: 'tl-panel mo-entry' }, [el('h2', { class: 'tl-h', text: label(sel, true) })]);
    if (readOnly) box.appendChild(el('p', { class: 'tl-note', text: 'Type to try it. Nothing is saved on your plan.' }));
    box.appendChild(T.field({ label: 'Revenue', pre: '$', big: true, value: x && x.revenue || '', hint: 'Everything customers paid you this month', onInput: function (v) { ensure(sel).revenue = v; changed(); } }));
    var list = el('div', { class: 'mo-cats' });
    data.cats.forEach(function (c, i) {
      list.appendChild(el('div', { class: 'mo-cat' }, [
        T.field({ label: c, pre: '$', value: x && x.costs[i] || '', onInput: function (v) { ensure(sel).costs[i] = v; changed(); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove ' + c + ' from every month', text: '×', onclick: function () {
          if (!window.confirm('Remove ' + c + ' from every month?')) return;
          data.cats.splice(i, 1); data.months.forEach(function (m) { m.costs.splice(i, 1); });
          data.rules = data.rules.filter(function (r) { return r.cat !== i; }).map(function (r) { return { match: r.match, cat: r.cat > i ? r.cat - 1 : r.cat }; });
          changed(); draw();
        } }),
      ]));
    });
    box.appendChild(el('span', { class: 'tl-f-l mo-cl', text: 'Costs' }));
    box.appendChild(list);
    var add = function (name) { name = String(name || '').trim().slice(0, 30); if (!name || data.cats.length >= 12 || data.cats.indexOf(name) >= 0) return; data.cats.push(name); data.months.forEach(function (m) { m.costs.push(0); }); changed(); draw(); };
    var nw = T.text({ value: '', max: 30, placeholder: 'Add a kind of cost', aria: 'New kind of cost' });
    nw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(nw.value); } });
    if (data.cats.length < 12) {
      box.appendChild(el('div', { class: 'mo-add' }, [nw, el('button', { type: 'button', class: 'tl-act', text: 'Add', onclick: function () { add(nw.value); } })]));
      var chips = el('div', { class: 'hk-chips mo-sug' });
      SUGGEST.filter(function (s) { return data.cats.indexOf(s) < 0; }).slice(0, 6).forEach(function (s) { chips.appendChild(el('button', { type: 'button', class: 'cv-pick-c', text: '+ ' + s, onclick: function () { add(s); } })); });
      box.appendChild(chips);
    }
    box.appendChild(T.field({ label: 'Cash in the bank at the end of ' + label(sel), pre: '$', neg: true, value: x && x.cash != null ? x.cash : '', hint: 'Every business account added together', onInput: function (v, raw) { ensure(sel).cash = String(raw == null ? v : raw).trim() === '' ? null : v; changed(); } }));
    box.appendChild(el('div', { class: 'mo-imp' }, [importButton('Fill months from a bank file', 'tl-act'), el('span', { class: 'tl-note', text: 'Added up on your device. The rows are never saved.' })]));
    return box;
  }

  // ---------- bills and invoices ----------
  function dues(k, title, eg) {
    var box = el('section', { class: 'tl-panel mo-dues' }, [el('h2', { class: 'tl-h', text: title })]);
    data[k].slice().sort(function (a, b) { return (a.paid - b.paid) || ((a.due || '9') < (b.due || '9') ? -1 : 1); }).forEach(function (b) {
      var paid = el('button', { type: 'button', role: 'switch', 'aria-checked': b.paid ? 'true' : 'false', class: 'hr-used' + (b.paid ? ' on' : ''), text: b.paid ? 'Paid' : 'Not paid', onclick: function () { b.paid = !b.paid; changed(); draw(); } });
      var date = el('input', { type: 'date', class: 'tl-in mo-date', value: b.due || '', 'aria-label': 'Due date for ' + (b.name || 'this one') });
      date.addEventListener('change', function () { b.due = date.value || null; changed(); });
      box.appendChild(el('div', { class: 'mo-due' + (b.paid ? ' paid' : !b.paid && b.due && b.due < today ? ' late' : '') }, [
        T.text({ value: b.name, max: 40, placeholder: eg, aria: title + ' name', onInput: function (v) { b.name = v; changed(); } }),
        T.field({ pre: '$', value: b.amount || '', aria: 'Amount', onInput: function (v) { b.amount = v; changed(); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove', text: '×', onclick: function () { data[k].splice(data[k].indexOf(b), 1); changed(); draw(); } }),
        date, paid,
      ]));
    });
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: k === 'bills' ? 'Add a bill' : 'Add an invoice', onclick: function () { data[k].push({ id: uid(), name: '', amount: 0, due: null, paid: false }); changed(); draw(); var all = box.parentNode && root.querySelectorAll('.mo-dues')[k === 'bills' ? 0 : 1].querySelectorAll('.tl-tx'); if (all && all.length) all[all.length - 1].focus(); } }));
    return box;
  }

  // ---------- a bank file, added up in the browser ----------
  function importButton(text, cls) {
    var input = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true, 'aria-hidden': 'true' });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { if (!data) data = blank(); review(parse(String(r.result || ''))); };
      r.readAsText(f);
    });
    return el('span', { class: 'mo-ib' }, [el('button', { type: 'button', class: cls, text: text, onclick: function () { input.click(); } }), input]);
  }
  function csvRows(text) {
    var out = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i += 1) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  function toDay(v) {
    v = String(v).trim();
    var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    var d = new Date(v); return isNaN(d) ? null : T.iso(d);
  }
  var amt = function (v) { v = String(v || '').trim(); if (!v) return null; var neg = /^\(.*\)$/.test(v) || /^-/.test(v.replace(/[$\s]/g, '')); var x = parseFloat(v.replace(/[^\d.]/g, '')); return isFinite(x) ? (neg ? -x : x) : null; };
  // Who a row is with, without the reference numbers banks add, so a rule matches next month's rows too.
  var payee = function (s) { return String(s).toLowerCase().replace(/[0-9#*]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ').slice(0, 30); };
  function parse(text) {
    var rows = csvRows(text), h = -1, col = {};
    for (var i = 0; i < Math.min(rows.length, 10) && h < 0; i += 1) {
      var r = rows[i].map(function (x) { return String(x).toLowerCase().trim(); });
      if (r.some(function (x) { return /date/.test(x); })) {
        h = i;
        r.forEach(function (x, j) {
          if (col.date == null && /date/.test(x)) col.date = j;
          else if (col.desc == null && /desc|memo|payee|name|details|merchant/.test(x)) col.desc = j;
          else if (col.amount == null && /^amount|amount$/.test(x)) col.amount = j;
          else if (col.out == null && /debit|withdraw|money out|paid out/.test(x)) col.out = j;
          else if (col.inn == null && /credit|deposit|money in|paid in/.test(x)) col.inn = j;
        });
      }
    }
    if (h < 0 || col.date == null || (col.amount == null && col.out == null && col.inn == null)) return { error: 'This file needs a date column and an amount column (or money in and money out). Most banks call them Date and Amount.' };
    var tx = [];
    rows.slice(h + 1).forEach(function (r) {
      var d = toDay(r[col.date]);
      var a = col.amount != null ? amt(r[col.amount]) : (amt(r[col.inn]) || 0) - Math.abs(amt(r[col.out]) || 0);
      if (!d || a == null || !a) return;
      tx.push({ day: d, desc: col.desc != null ? String(r[col.desc]).trim().slice(0, 60) : '', amount: a });
    });
    return tx.length ? { tx: tx } : { error: 'No rows with a date and an amount were found in this file.' };
  }
  function ruleFor(desc) { var s = String(desc).toLowerCase(); return data.rules.filter(function (r) { return s.indexOf(r.match) >= 0; })[0] || null; }
  function review(res) {
    if (res.error) { fileView = el('section', { class: 'tl-panel mo-file' }, [el('h2', { class: 'tl-h', text: 'That file didn’t read' }), el('p', { class: 'tl-note', text: res.error }), el('button', { type: 'button', class: 'tl-act', text: 'Close', onclick: function () { fileView = null; draw(); } })]); draw(); return; }
    var tx = res.tx, pays = {}, months = {};
    tx.forEach(function (t) {
      months[t.day.slice(0, 7)] = 1;
      if (t.amount < 0) { var k = payee(t.desc) || 'no description'; (pays[k] = pays[k] || { k: k, n: 0, v: 0 }); pays[k].n += 1; pays[k].v += -t.amount; }
    });
    // Months that already have totals are left alone unless the member ticks them: a file that starts mid-month
    // would otherwise replace a full month with part of one.
    var use = {};
    Object.keys(months).forEach(function (m) { use[m] = !monthOf(m); });
    var choice = {};
    Object.keys(pays).forEach(function (k) { var r = ruleFor(k); choice[k] = r ? r.cat : null; });
    function apply() {
      var totals = {};
      Object.keys(months).forEach(function (m) { totals[m] = { revenue: 0, costs: data.cats.map(function () { return 0; }) }; });
      tx.forEach(function (t) {
        var m = totals[t.day.slice(0, 7)];
        if (t.amount > 0) { var r = ruleFor(t.desc); if (!r || r.cat >= 0) m.revenue += t.amount; return; }
        var c = choice[payee(t.desc) || 'no description'];
        if (c != null && c >= 0) m.costs[c] += -t.amount;
      });
      Object.keys(totals).forEach(function (m) { if (!use[m]) return; var x = ensure(m); x.revenue = Math.round(totals[m].revenue * 100) / 100; x.costs = totals[m].costs.map(function (v) { return Math.round(v * 100) / 100; }); });
      Object.keys(choice).forEach(function (k) { if (choice[k] == null) return; data.rules = data.rules.filter(function (r) { return r.match !== k; }); data.rules.unshift({ match: k, cat: choice[k] }); });
      data.rules = data.rules.slice(0, 120);
      sel = Object.keys(months).filter(function (m) { return use[m]; }).sort().pop() || sel;
      fileView = null; changed(); draw();
    }
    function applyText() { var on = Object.keys(use).filter(function (m) { return use[m]; }).sort(); return !on.length ? 'Tick a month to fill' : 'Fill ' + (on.length === 1 ? label(on[0], true) : on.length + ' months'); }
    function paint() {
      var box = el('section', { class: 'tl-panel mo-file' });
      var ms = Object.keys(months).sort();
      box.appendChild(el('div', { class: 'mo-ph' }, [el('h2', { class: 'tl-h', text: tx.length + ' rows from your bank file' }), el('span', { class: 'mo-ch', text: ms.map(function (m) { return label(m); }).join(', ') })]));
      box.appendChild(el('p', { class: 'tl-note', text: 'Money in counts as revenue. Give each place money went a kind of cost once and HQ remembers it for next month. Only the ticked months take this file’s totals; nothing else from the file is saved.' }));
      var pickM = el('div', { class: 'hk-chips mo-ms', role: 'group', 'aria-label': 'Months to fill' });
      ms.forEach(function (m) {
        var b = el('button', { type: 'button', class: 'cv-pick-c' + (use[m] ? ' on' : ''), 'aria-pressed': use[m] ? 'true' : 'false', text: (use[m] ? '✓ ' : '') + label(m, true) + (monthOf(m) ? ' (has totals)' : ''), onclick: function () { use[m] = !use[m]; b.className = 'cv-pick-c' + (use[m] ? ' on' : ''); b.setAttribute('aria-pressed', use[m] ? 'true' : 'false'); b.textContent = (use[m] ? '✓ ' : '') + label(m, true) + (monthOf(m) ? ' (has totals)' : ''); go.textContent = applyText(); } });
        pickM.appendChild(b);
      });
      box.appendChild(pickM);
      if (!data.cats.length) box.appendChild(el('p', { class: 'tl-note warn', text: 'Add your kinds of cost first (under the month), then sort these.' }));
      var list = el('div', { class: 'mo-pays' });
      Object.keys(pays).map(function (k) { return pays[k]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 40).forEach(function (p) {
        var s = el('select', { class: 'tl-in mo-sel', 'aria-label': 'Kind of cost for ' + p.k });
        s.appendChild(el('option', { value: '', text: 'Pick a kind' }));
        data.cats.forEach(function (c, i) { s.appendChild(el('option', { value: String(i), text: c, selected: choice[p.k] === i ? true : null })); });
        s.appendChild(el('option', { value: '-1', text: 'Not a cost (a transfer)', selected: choice[p.k] === -1 ? true : null }));
        s.addEventListener('change', function () { choice[p.k] = s.value === '' ? null : +s.value; });
        list.appendChild(el('div', { class: 'mo-pay' }, [el('span', { class: 'mo-pn' }, [el('b', { text: p.k }), el('small', { text: p.n + (p.n === 1 ? ' payment' : ' payments') })]), el('b', { class: 'mo-pv', text: T.money(p.v, 0) }), s]));
      });
      box.appendChild(list);
      var go = el('button', { type: 'button', class: 'btn', text: applyText(), disabled: readOnly ? true : null, onclick: function () { if (ms.some(function (m) { return use[m]; })) apply(); } });
      box.appendChild(el('div', { class: 'tl-start-b' }, [go, el('button', { type: 'button', class: 'tl-act', text: 'Cancel', onclick: function () { fileView = null; draw(); } })]));
      return box;
    }
    fileView = paint();
    draw();
    fileView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function update() {
    tiles(); chart(); topCosts(); status();
  }
  // What goes to 127: category names, month totals, bills and invoices. Never rules, rows, amounts or descriptions
  // from a bank file (test/tools.test.js checks this page's saves).
  function saved(d) { return { cats: d.cats, months: d.months, bills: d.bills, invoices: d.invoices }; }
  function changed() {
    if (readOnly) { if (nodes.tiles) update(); return; }
    T.save(saved(data));
    T.device.set('money-rules', data.rules);
    if (nodes.tiles) update();
  }
  var w = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - w) > 40 && nodes.chart) { w = window.innerWidth; chart(); } });
  draw();
})();
