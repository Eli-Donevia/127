// Life · Budget (lib/life): envelope budgeting for one month at a time, kept in the member's own browser.
// Income gives every dollar a job across envelopes; spends come out of an envelope; each envelope shows what's left.
// Pop lights the one envelope to look at (the most over, else the closest to empty); Signal marks money still to
// give a job. Data: { months: { 'YYYY-MM': { income, cats: [{ id, name, plan }], spends: [{ id, day, cat, amount, note }] } } }.
(function () {
  'use strict';
  var L = window.Life, el = L.el;
  var DEFAULTS = [['Home', 0], ['Groceries', 0], ['Eating out', 0], ['Getting around', 0], ['Bills and utilities', 0], ['Subscriptions', 0], ['Fun', 0], ['Giving', 0], ['Savings', 0]];
  var EXAMPLE = { income: 5200, cats: [['Home', 1650], ['Groceries', 600], ['Eating out', 250], ['Getting around', 300], ['Bills and utilities', 280], ['Subscriptions', 90], ['Fun', 200], ['Giving', 520], ['Savings', 900]],
    spends: [[1, 'Home', 1650, 'Rent'], [2, 'Groceries', 142.6, 'Weekly shop'], [4, 'Eating out', 38, 'Tacos'], [5, 'Getting around', 54.2, 'Gas'], [7, 'Subscriptions', 15.99, 'Music'], [8, 'Groceries', 118.3, 'Weekly shop'], [9, 'Eating out', 86, 'Dinner out'], [11, 'Fun', 64, 'Concert'], [12, 'Eating out', 112, 'Birthday dinner'], [14, 'Giving', 520, 'Church']] };

  var d = null, m = L.month(L.today());

  function clean(x) {
    var out = { months: {} };
    var ms = x && x.months && typeof x.months === 'object' ? x.months : {};
    Object.keys(ms).slice(0, 120).forEach(function (k) {
      if (!/^\d{4}-\d{2}$/.test(k)) return;
      var v = ms[k] || {};
      var cats = (Array.isArray(v.cats) ? v.cats : []).slice(0, 40).map(function (c) { return { id: String(c.id || L.uid()).slice(0, 20), name: String(c.name || '').slice(0, 40), plan: Math.max(0, L.num(c.plan)) }; });
      var ids = {}; cats.forEach(function (c) { ids[c.id] = 1; });
      var spends = (Array.isArray(v.spends) ? v.spends : []).slice(0, 1500).filter(function (s) { return s && ids[s.cat] && /^\d{4}-\d{2}-\d{2}$/.test(s.day); })
        .map(function (s) { return { id: String(s.id || L.uid()).slice(0, 20), day: s.day, cat: s.cat, amount: Math.max(0, L.num(s.amount)), note: String(s.note || '').slice(0, 60) }; });
      out.months[k] = { income: Math.max(0, L.num(v.income)), cats: cats, spends: spends };
    });
    return out;
  }
  function example() {
    var cats = EXAMPLE.cats.map(function (c) { return { id: L.uid(), name: c[0], plan: c[1] }; });
    var by = {}; cats.forEach(function (c) { by[c.name] = c.id; });
    var spends = EXAMPLE.spends.map(function (s) { return { id: L.uid(), day: m + '-' + String(s[0]).padStart(2, '0'), cat: by[s[1]], amount: s[2], note: s[3] }; });
    var o = { months: {} }; o.months[m] = { income: EXAMPLE.income, cats: cats, spends: spends };
    return o;
  }
  function cur() { return d.months[m]; }
  // A new month starts from the latest earlier month's envelopes and income, with no spends.
  function ensure() {
    if (d.months[m]) return;
    var prev = Object.keys(d.months).filter(function (k) { return k < m; }).sort().pop();
    var p = prev ? d.months[prev] : null;
    d.months[m] = p ? { income: p.income, cats: p.cats.map(function (c) { return { id: c.id, name: c.name, plan: c.plan }; }), spends: [] } : null;
    if (!d.months[m]) delete d.months[m];
  }
  function commit() { L.save(d); draw(); }

  function spentBy(mo) { var s = {}; mo.spends.forEach(function (x) { s[x.cat] = (s[x.cat] || 0) + x.amount; }); return s; }

  function start() {
    var income = '';
    var f = L.field({ label: 'What comes in this month, after tax', pre: '$', big: true, id: 'bg-start', onInput: function (v) { income = v; } });
    return el('div', { class: 'lf-start' }, [
      el('p', { class: 'lf-start-q', text: 'Give every dollar a job.' }),
      el('p', { class: 'lf-start-s', text: 'Start with what you take home in ' + L.monthName(m) + '. You\'ll split it into envelopes next.' }),
      f,
      el('button', { type: 'button', class: 'lf-go', text: 'Set up my envelopes', onclick: function () {
        d.months[m] = { income: L.num(income), cats: DEFAULTS.map(function (c) { return { id: L.uid(), name: c[0], plan: c[1] }; }), spends: [] };
        commit();
      } }),
    ]);
  }

  function draw() {
    var root = L.root;
    var focusId = document.activeElement && document.activeElement.id;
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'lf-month' }, [
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Previous month', text: '‹', onclick: function () { m = L.addMonths(m, -1); ensure(); draw(); } }),
      el('span', { class: 'lf-month-n', text: L.monthName(m) }),
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Next month', text: '›', onclick: function () { m = L.addMonths(m, 1); ensure(); draw(); } }),
    ]));
    var mo = cur();
    if (!mo) { root.appendChild(start()); return; }

    var spent = spentBy(mo), planned = 0, used = 0;
    mo.cats.forEach(function (c) { planned += c.plan; used += spent[c.id] || 0; });
    var unassigned = mo.income - planned;
    // The envelope to look at: the most over plan, else the lowest share left among those with money left and
    // something spent. One spent exactly as planned (rent paid) needs no attention.
    var lit = null, worst = Infinity;
    mo.cats.forEach(function (c) {
      var s = spent[c.id] || 0, left = c.plan - s;
      if (!s || Math.abs(left) < 0.005) return;
      var score = left < 0 ? -1 - (-left / Math.max(c.plan, 1)) : left / c.plan;
      if (score < worst) { worst = score; lit = c.id; }
    });

    var hero = el('b', { class: 'lf-hero-v' });
    L.tween(hero, planned - used, function (v) { return L.money(v, 0); });
    root.appendChild(el('div', { class: 'lf-sum' }, [
      el('div', null, [el('span', { class: 'lf-k', text: 'Left to spend in ' + L.monthName(m).split(' ')[0] }), hero,
        el('span', { class: 'lf-d' + (unassigned > 0.5 ? ' up' : unassigned < -0.5 ? ' warn' : ''), text: unassigned > 0.5 ? L.money(unassigned) + ' still needs a job' : unassigned < -0.5 ? 'Envelopes plan ' + L.money(-unassigned) + ' more than comes in' : 'Every dollar has a job' })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Spent' }), el('b', { text: L.money(used, 0) })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Coming in' }), L.field({ id: 'bg-income', value: mo.income || '', pre: '$', aria: 'Income this month', onInput: function (v) { mo.income = v; L.save(d); drawSoon(); } })]),
    ]));

    // Log a spend.
    var form = { amount: '', cat: (mo.cats[0] || {}).id, note: '', day: L.month(L.today()) === m ? L.today() : m + '-01' };
    var sel = el('select', { class: 'lf-sel', id: 'bg-cat', 'aria-label': 'Envelope', onchange: function (e) { form.cat = e.target.value; } },
      mo.cats.map(function (c) { return el('option', { value: c.id, text: c.name || 'Untitled' }); }));
    var dayIn = el('input', { class: 'lf-sel', type: 'date', id: 'bg-day', value: form.day, min: m + '-01', max: m + '-31', 'aria-label': 'Date', onchange: function (e) { form.day = e.target.value; } });
    var amt = L.field({ id: 'bg-amt', label: 'Spent', pre: '$', onInput: function (v) { form.amount = v; } });
    var note = L.text({ id: 'bg-note', placeholder: 'What for (optional)', onInput: function (v) { form.note = v; } });
    function add() {
      if (!(L.num(form.amount) > 0) || !form.cat || L.month(form.day) !== m) { amt.input.focus(); return; }
      mo.spends.unshift({ id: L.uid(), day: form.day, cat: form.cat, amount: L.num(form.amount), note: form.note.trim() });
      commit();
      var a = document.getElementById('bg-amt'); if (a) a.focus();
    }
    amt.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    note.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    root.appendChild(el('section', { class: 'lf-panel lf-log' }, [
      el('h2', { class: 'lf-h', text: 'Log a spend' }),
      el('div', { class: 'lf-log-row' }, [amt, el('div', { class: 'lf-log-side' }, [sel, dayIn])]),
      note,
      el('button', { type: 'button', class: 'lf-go', text: 'Add', onclick: add }),
    ]));

    // Envelopes.
    var list = el('div', { class: 'bg-env' });
    mo.cats.forEach(function (c, i) {
      var s = spent[c.id] || 0, left = c.plan - s, share = c.plan > 0 ? Math.min(1, s / c.plan) : (s > 0 ? 1 : 0);
      list.appendChild(el('div', { class: 'bg-row' + (c.id === lit ? ' is-lit' : '') + (left < 0 ? ' over' : '') }, [
        L.text({ id: 'bg-n-' + c.id, value: c.name, placeholder: 'Envelope name', max: 40, onInput: function (v) { c.name = v; L.save(d); } }),
        L.field({ id: 'bg-p-' + c.id, value: c.plan || '', pre: '$', aria: 'Plan for ' + c.name, cls: 'bg-plan', onInput: function (v) { c.plan = v; L.save(d); drawSoon(); } }),
        el('span', { class: 'bg-left' }, [el('b', { text: L.money(left, 0) }), el('span', { text: left < 0 ? 'over' : 'left' })]),
        el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Remove ' + (c.name || 'envelope'), text: '×', disabled: s > 0 ? true : null, title: s > 0 ? 'Delete its spends first' : null, onclick: function () { mo.cats.splice(i, 1); commit(); } }),
        el('span', { class: 'bg-bar', 'aria-hidden': 'true' }, [el('i', { style: '--w:' + Math.round(share * 100) + '%' })]),
      ]));
    });
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Envelopes' }), list,
      el('button', { type: 'button', class: 'lf-act', text: 'Add an envelope', disabled: mo.cats.length >= 40 ? true : null, onclick: function () { var id = L.uid(); mo.cats.push({ id: id, name: '', plan: 0 }); commit(); var n = document.getElementById('bg-n-' + id); if (n) n.focus(); } }),
    ]));

    // This month's spends.
    var names = {}; mo.cats.forEach(function (c) { names[c.id] = c.name || 'Untitled'; });
    var rows = mo.spends.slice().sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : 0; });
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Spends in ' + L.monthName(m).split(' ')[0] }),
      rows.length ? el('ul', { class: 'lf-rows' }, rows.slice(0, 200).map(function (s) {
        return el('li', null, [
          el('span', { class: 'lf-rows-d', text: L.day(s.day) }),
          el('span', { class: 'lf-rows-n' }, [el('b', { text: s.note || names[s.cat] }), s.note ? el('span', { text: names[s.cat] }) : null]),
          el('span', { class: 'lf-rows-v', text: L.money(s.amount) }),
          el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Delete this spend', text: '×', onclick: function () { mo.spends = mo.spends.filter(function (x) { return x.id !== s.id; }); commit(); } }),
        ]);
      })) : el('p', { class: 'lf-note-s', text: 'Nothing logged yet this month.' }),
      el('button', { type: 'button', class: 'lf-act', text: 'CSV for Actual Budget', disabled: rows.length ? null : true, onclick: function () { csv(mo, names); } }),
    ]));

    if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) { f.focus(); if (f.setSelectionRange && f.type === 'text') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  }
  var soon = null;
  function drawSoon() { clearTimeout(soon); soon = setTimeout(draw, 350); }

  // Date, Payee, Category, Amount (spends negative), Notes: the columns Actual Budget's CSV import maps.
  function csv(mo, names) {
    var q = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = ['Date,Payee,Category,Amount,Notes'].concat(mo.spends.map(function (s) { return [s.day, q(s.note || names[s.cat]), q(names[s.cat]), (-s.amount).toFixed(2), q(s.note)].join(','); }));
    var url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    var a = el('a', { href: url, download: '127-budget-' + m + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  var saved = L.load();
  d = L.state.keep ? clean(saved || {}) : example();
  ensure();
  L.current = function () { return d; };
  L.onData = function (x) { d = x ? clean(x) : { months: {} }; m = L.month(L.today()); ensure(); draw(); };
  draw();
})();
