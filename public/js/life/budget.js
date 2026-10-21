// Life · Budget (lib/life): envelope budgeting for one month at a time, kept in the member's own browser.
// Income gives every dollar a job across envelopes; spends come out of an envelope; each envelope shows what's left.
// Pop lights the one envelope to look at (the most over, else the closest to empty); Signal marks money still to
// give a job. Fields start empty, with no example amounts (Legal L87 LV6). Layout follows the financial overview Eli
// sent (idea only): stat tiles with the change against last month, a glowing spend line, where the money went, recent
// spends with their envelope, and status rows. Data: { months: { 'YYYY-MM': { income, cats: [{ id, name, plan }], spends: [{ id, day, cat, amount, note }] } } }.
(function () {
  'use strict';
  var L = window.LifeKit('budget'), el = L.el;
  var DEFAULTS = [['Home', 0], ['Groceries', 0], ['Eating out', 0], ['Getting around', 0], ['Bills and utilities', 0], ['Subscriptions', 0], ['Fun', 0], ['Giving', 0], ['Savings', 0]];

  var d = null, m = L.month(L.today()), view = 'month', allRows = false;

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

  // ---------- forecast ----------
  function daysIn(mm) { var p = mm.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  // How far through the month we are: 1 for past months, 0 for future ones.
  function elapsed(mm) { var t = L.today(), cur = L.month(t); return mm < cur ? daysIn(mm) : mm > cur ? 0 : +t.slice(8, 10); }
  // Month-end forecast per envelope: an envelope with three or more spends keeps its pace; one with fewer (rent, a
  // one-off) stays where it is. The total is the sum, so one big bill doesn't make every day look expensive.
  function forecast(mo, spent) {
    var n = daysIn(m), e = elapsed(m), per = {}, total = 0, counts = {};
    mo.spends.forEach(function (x) { counts[x.cat] = (counts[x.cat] || 0) + 1; });
    mo.cats.forEach(function (c) {
      var s = spent[c.id] || 0, f = s;
      if (e > 0 && e < n && counts[c.id] >= 3) f = s / e * n;
      per[c.id] = { spent: s, end: f, runsOut: c.plan > 0 && s > 0 && f > c.plan && e < n ? Math.min(n, Math.ceil(c.plan / (s / e))) : null };
      total += f;
    });
    return { per: per, total: total, days: n, elapsed: e, dayFrac: n ? e / n : 1 };
  }
  function notes(mo, spent, fc, unassigned) {
    var out = [], names = {};
    mo.cats.forEach(function (c) { names[c.id] = c.name || 'Untitled'; });
    var over = mo.cats.filter(function (c) { return c.plan > 0 && (spent[c.id] || 0) > c.plan; }).sort(function (a, b) { return ((spent[b.id] || 0) - b.plan) - ((spent[a.id] || 0) - a.plan); });
    if (over.length) out.push({ tone: 'caution', title: names[over[0].id] + ' is ' + L.money((spent[over[0].id] || 0) - over[0].plan, 0) + ' over', body: over.length > 1 ? 'And ' + (over.length - 1) + ' more envelope' + (over.length > 2 ? 's' : '') + '. Move money from one with room, or lower what\'s left to spend.' : 'Move money from an envelope with room so the month still adds up.' });
    var soon = mo.cats.filter(function (c) { var p = fc.per[c.id]; return p && p.runsOut && (spent[c.id] || 0) <= c.plan; }).sort(function (a, b) { return fc.per[a.id].runsOut - fc.per[b.id].runsOut; });
    if (soon.length) out.push({ tone: 'caution', title: names[soon[0].id] + ' runs out around ' + L.day(m + '-' + String(fc.per[soon[0].id].runsOut).padStart(2, '0')), body: 'At this pace it ends the month near ' + L.money(fc.per[soon[0].id].end, 0) + ' against ' + L.money(mo.cats.filter(function (c) { return c.id === soon[0].id; })[0].plan, 0) + ' planned.' });
    if (unassigned > 0.5) out.push({ tone: 'info', title: L.money(unassigned, 0) + ' still needs a job', body: 'Give it an envelope: savings, giving or next month.' });
    var planned = mo.cats.reduce(function (n, c) { return n + c.plan; }, 0);
    if (!over.length && !soon.length && fc.elapsed > 3 && planned > 0 && fc.total <= planned) out.push({ tone: 'good', title: 'On pace for the month', body: 'Forecast ' + L.money(fc.total, 0) + ' of ' + L.money(planned, 0) + ' planned.' });
    return out;
  }
  // Spent to date by day (area), an even line to the plan, and the forecast to month end.
  function chartPanel(mo, fc, planned) {
    var n = fc.days, byDay = [], cum = 0, pts = [];
    for (var i = 0; i < n; i++) byDay.push(0);
    mo.spends.forEach(function (x) { var dd = +x.day.slice(8, 10) - 1; if (dd >= 0 && dd < n) byDay[dd] += x.amount; });
    for (var k = 0; k < n; k++) {
      cum += byDay[k];
      var day = m + '-' + String(k + 1).padStart(2, '0');
      pts.push({ label: L.day(day), y: k < fc.elapsed ? Math.round(cum * 100) / 100 : null, note: k < fc.elapsed && byDay[k] ? 'Spent that day ' + L.money(byDay[k]) : null });
    }
    var proj = [];
    if (fc.elapsed > 0 && fc.elapsed < n) {
      var a = fc.elapsed - 1, base = pts[a].y, gap = fc.total - base, rest = n - 1 - a;
      for (var j = a; j < n; j++) { var t = rest ? (j - a) / rest : 1, yv = base + gap * t, band = Math.abs(gap) * 0.18 * t; proj.push({ i: j, y: yv, lo: Math.max(base, yv - band), hi: yv + band }); }
    }
    var trend = months6();
    if (view === 'trend' && trend.length >= 2) return trendPanel(trend, fc);
    var host = el('div', { class: 'bg-chart' });
    var panel = el('section', { class: 'lf-panel' }, [
      el('div', { class: 'lf-panel-h' }, [el('h2', { class: 'lf-h', text: 'Spending' }), trend.length >= 2 ? viewPick() : null]),
      el('p', { class: 'lf-d bg-sub', text: fc.elapsed > 0 && fc.elapsed < n ? 'Forecast ' + L.money(fc.total, 0) + ' by ' + L.day(m + '-' + n) : fc.elapsed >= n ? 'Month closed at ' + L.money(fc.total, 0) : 'Starts ' + L.day(m + '-01') }),
      host,
      el('p', { class: 'lc-cap' }, [el('span', null, [el('i'), 'Spent so far']), proj.length ? el('span', null, [el('i', { class: 'dash' }), 'Forecast']) : null, planned ? el('span', null, [el('i', { class: 'goal' }), 'Planned']) : null]),
    ]);
    setTimeout(function () {
      L.chart(host, { key: 'bg-' + m, kind: 'area', points: pts, forecast: proj, target: planned || null, targetLabel: 'Planned', height: 190, aria: 'Spending in ' + L.monthName(m), fmt: function (v) { return L.money(v, 0); } });
    }, 0);
    return panel;
  }


  function viewPick() {
    return L.choice({ label: 'Chart range', options: [['month', 'This month'], ['trend', '6 months']], value: view, onPick: function (v) { view = v; draw(); } });
  }
  // Up to six months ending with this one that have envelopes: what went out each month.
  function months6() {
    var out = [];
    for (var k = 5; k >= 0; k--) {
      var mm = L.addMonths(m, -k), mo = d.months[mm];
      if (mo) out.push({ m: mm, spent: mo.spends.reduce(function (n, x) { return n + x.amount; }, 0), planned: mo.cats.reduce(function (n, c) { return n + c.plan; }, 0) });
    }
    return out;
  }
  // Month by month: closed months as they ended, this month carried to its forecast, the six-month average.
  function trendPanel(rows, fc) {
    var host = el('div', { class: 'bg-chart' }), live = fc.elapsed > 0 && fc.elapsed < fc.days;
    var pts = rows.map(function (r, i) { var last = i === rows.length - 1; return { label: L.monthName(r.m).split(' ')[0].slice(0, 3), y: last && live ? null : Math.round(r.spent), note: r.planned ? 'Planned ' + L.money(r.planned, 0) : null }; });
    var proj = null;
    if (live && rows.length >= 2) {
      var a = rows.length - 2, y = fc.total, band = Math.abs(y - rows[a].spent) * 0.25 + y * 0.04;
      proj = [{ i: a, y: rows[a].spent, lo: rows[a].spent, hi: rows[a].spent }, { i: rows.length - 1, y: y, lo: Math.max(0, y - band), hi: y + band }];
    }
    var closed = rows.filter(function (r, i) { return !(live && i === rows.length - 1); });
    var avg = closed.length ? closed.reduce(function (n, r) { return n + r.spent; }, 0) / closed.length : 0;
    var first = rows[0].spent, lastV = live ? fc.total : rows[rows.length - 1].spent, ch = first ? (lastV - first) / first : 0;
    setTimeout(function () {
      L.chart(host, { key: 'bg-trend-' + m, kind: 'line', points: pts, forecast: proj || undefined, height: 190, aria: 'Spending by month', fmt: function (v) { return L.money(v, 0); }, target: avg || null, targetLabel: 'Average' });
    }, 0);
    return el('section', { class: 'lf-panel' }, [
      el('div', { class: 'lf-panel-h' }, [el('h2', { class: 'lf-h', text: 'Spending' }), viewPick()]),
      el('p', { class: 'lf-d bg-sub' }, [el('span', { class: 'bg-ch ' + (ch > 0.1 ? 'is-up' : ch < -0.02 ? 'is-down' : ''), text: (ch >= 0 ? '↗ ' : '↘ ') + Math.abs(Math.round(ch * 100)) + '%' }), ' since ' + L.monthName(rows[0].m).split(' ')[0] + (live ? ', with ' + L.monthName(m).split(' ')[0] + ' at its forecast' : '')]),
      host,
      el('p', { class: 'lc-cap' }, [el('span', null, [el('i'), 'Each month']), proj ? el('span', null, [el('i', { class: 'dash' }), 'This month, forecast']) : null, avg ? el('span', null, [el('i', { class: 'goal' }), 'Average']) : null]),
    ]);
  }

  // Spent through the same day last month, so the comparison is fair halfway through a month.
  function lastMonthTo(dayN) {
    var pm = d.months[L.addMonths(m, -1)];
    if (!pm || !pm.spends.length) return null;
    return pm.spends.reduce(function (n, x) { return +x.day.slice(8, 10) <= dayN ? n + x.amount : n; }, 0);
  }

  // Where the money went: envelopes by what's been spent, the bar against the biggest.
  function topPanel(mo, spent, lit, used) {
    var rows = mo.cats.filter(function (c) { return (spent[c.id] || 0) > 0; }).sort(function (a, b) { return spent[b.id] - spent[a.id]; }).slice(0, 5);
    if (!rows.length) return null;
    var top = spent[rows[0].id];
    return el('section', { class: 'lf-panel' }, [
      el('div', { class: 'lf-panel-h' }, [el('h2', { class: 'lf-h', text: 'Where it went' }), el('span', { class: 'lf-d', text: L.monthName(m).split(' ')[0] })]),
      el('ul', { class: 'bg-top' }, rows.map(function (c) {
        var s = spent[c.id];
        return el('li', { class: c.id === lit ? 'is-lit' : null }, [
          el('span', { class: 'bg-top-n', text: c.name || 'Untitled' }),
          el('span', { class: 'bg-top-v' }, [L.money(s, 0), el('small', { text: Math.round(s / Math.max(used, 1) * 100) + '%' })]),
          el('span', { class: 'bg-top-b', 'aria-hidden': 'true' }, [el('i', { style: '--w:' + Math.max(2, Math.round(s / top * 100)) + '%' })]),
        ]);
      })),
    ]);
  }

  // Status rows: one line each, the state on the right in mono.
  function statusPanel(mo, spent, fc, unassigned, planned) {
    var over = mo.cats.filter(function (c) { return c.plan > 0 && (spent[c.id] || 0) > c.plan; }).length;
    var byDay = {}; mo.spends.forEach(function (x) { byDay[x.day] = (byDay[x.day] || 0) + x.amount; });
    var big = Object.keys(byDay).sort(function (a, b) { return byDay[b] - byDay[a]; })[0];
    var pace = !planned || !fc.elapsed ? ['Not started', ''] : fc.total > planned * 1.02 ? [L.money(fc.total - planned, 0) + ' over', 'is-warn'] : ['On track', 'is-ok'];
    var rows = [
      ['Every dollar has a job', unassigned > 0.5 ? [L.money(unassigned, 0) + ' to assign', ''] : unassigned < -0.5 ? [L.money(-unassigned, 0) + ' short', 'is-warn'] : ['Yes', 'is-ok']],
      ['Envelopes over plan', over ? [String(over), 'is-warn'] : ['None', 'is-ok']],
      ['Month-end pace', pace],
      ['Biggest day', big ? [L.day(big) + ' · ' + L.money(byDay[big], 0), ''] : ['–', '']],
    ];
    return el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Status' }),
      el('ul', { class: 'bg-status' }, rows.map(function (r) { return el('li', null, [el('span', { text: r[0] }), el('b', { class: r[1][1] || null, text: r[1][0] })]); })),
    ]);
  }

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

    var fc = forecast(mo, spent);
    var hero = el('b', { class: 'lf-hero-v' });
    L.tween(hero, planned - used, function (v) { return L.money(v, 0); });
    var prev = fc.elapsed ? lastMonthTo(fc.elapsed) : null, vs = null;
    if (prev) {
      var ch = (used - prev) / prev;
      vs = el('span', { class: 'bg-ch ' + (ch > 0.1 ? 'is-up' : ch < -0.02 ? 'is-down' : '') }, [(ch >= 0 ? '↗ ' : '↘ ') + Math.abs(Math.round(ch * 100)) + '% vs last month']);
    }
    var spentV = el('b'); L.tween(spentV, used, function (v) { return L.money(v, 0); });
    root.appendChild(el('div', { class: 'lf-sum bg-tiles' }, [
      el('div', null, [el('span', { class: 'lf-k', text: 'Left to spend · ' + L.monthName(m).split(' ')[0] }), hero,
        el('span', { class: 'lf-d' + (unassigned > 0.5 ? ' up' : unassigned < -0.5 ? ' warn' : ''), text: !mo.income && !planned ? 'Add what comes in, then plan each envelope' : unassigned > 0.5 ? L.money(unassigned) + ' still needs a job' : unassigned < -0.5 ? 'Envelopes plan ' + L.money(-unassigned) + ' more than comes in' : 'Every dollar has a job' })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Spent' }), spentV, vs || el('span', { class: 'lf-d', text: mo.spends.length + ' spend' + (mo.spends.length === 1 ? '' : 's') })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Coming in' }), L.field({ id: 'bg-income', value: mo.income || '', pre: '$', aria: 'Income this month', onInput: function (v) { mo.income = v; L.save(d); drawSoon(); } })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Month-end forecast' }), el('b', { text: fc.elapsed ? L.money(fc.total, 0) : '–' }), el('span', { class: 'lf-d', text: planned ? 'of ' + L.money(planned, 0) + ' planned' : 'No plan yet' })]),
    ]));

    // What to look at: forecast, pace and warnings.
    L.notices(root, notes(mo, spent, fc, unassigned), 3);
    root.appendChild(chartPanel(mo, fc, planned));

    // Log a spend.
    var form = { amount: '', cat: (mo.cats[0] || {}).id, note: '', day: L.month(L.today()) === m ? L.today() : m + '-01' };
    var sel = el('select', { class: 'lf-sel', id: 'bg-cat', 'aria-label': 'Envelope', onchange: function (e) { form.cat = e.target.value; } },
      mo.cats.map(function (c) { return el('option', { value: c.id, text: c.name || 'Untitled' }); }));
    var dayIn = el('input', { class: 'lf-sel', type: 'date', id: 'bg-day', value: form.day, min: m + '-01', max: m + '-31', 'aria-label': 'Date', onchange: function (e) { form.day = e.target.value; } });
    var amt = L.field({ id: 'bg-amt', label: 'Spent', pre: '$', onInput: function (v) { form.amount = v; } });
    var note = L.text({ id: 'bg-note', placeholder: 'What for (optional)', onInput: function (v) { form.note = v; } });
    function add() {
      if (!(L.num(form.amount) > 0) || !form.cat || L.month(form.day) !== m) { amt.input.focus(); return; }
      var amtN = L.num(form.amount), cat = mo.cats.filter(function (c) { return c.id === form.cat; })[0];
      var before = mo.spends.filter(function (x) { return x.cat === form.cat; }).reduce(function (n, x) { return n + x.amount; }, 0);
      mo.spends.unshift({ id: L.uid(), day: form.day, cat: form.cat, amount: amtN, note: form.note.trim() });
      commit();
      var left = cat.plan - before - amtN;
      if (cat.plan > 0 && left < 0 && before <= cat.plan) L.toast(cat.name + ' just went over', { type: 'info', description: L.money(-left) + ' past the plan for ' + L.monthName(m).split(' ')[0] + '.' });
      else L.toast(L.money(amtN) + ' from ' + (cat.name || 'envelope'), { type: 'success', description: cat.plan > 0 ? L.money(left, 0) + ' left in it.' : null });
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

    var top = topPanel(mo, spent, lit, used);
    root.appendChild(el('div', { class: 'bg-duo' }, [top, statusPanel(mo, spent, fc, unassigned, planned)]));

    // Envelopes.
    var list = el('div', { class: 'bg-env' });
    mo.cats.forEach(function (c, i) {
      var s = spent[c.id] || 0, left = c.plan - s, share = c.plan > 0 ? Math.min(1, s / c.plan) : (s > 0 ? 1 : 0);
      list.appendChild(el('div', { class: 'bg-row' + (c.id === lit ? ' is-lit' : '') + (left < 0 ? ' over' : '') }, [
        L.text({ id: 'bg-n-' + c.id, value: c.name, placeholder: 'Envelope name', max: 40, onInput: function (v) { c.name = v; L.save(d); } }),
        L.field({ id: 'bg-p-' + c.id, value: c.plan || '', pre: '$', aria: 'Plan for ' + c.name, cls: 'bg-plan', onInput: function (v) { c.plan = v; L.save(d); drawSoon(); } }),
        el('span', { class: 'bg-left' }, [el('b', { text: L.money(left, 0) }), el('span', { text: left < 0 ? 'over' : 'left' })]),
        el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Remove ' + (c.name || 'envelope'), text: '×', disabled: s > 0 ? true : null, title: s > 0 ? 'Delete its spends first' : null, onclick: function () { mo.cats.splice(i, 1); commit(); } }),
        el('span', { class: 'bg-bar', 'aria-hidden': 'true' }, [el('i', { style: '--w:' + Math.round(share * 100) + '%' }), c.plan > 0 && fc.dayFrac < 1 ? el('b', { class: 'bg-tick', style: '--t:' + Math.round(fc.dayFrac * 100) + '%', title: 'Where you\'d be today at an even pace' }) : null]),
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
      el('div', { class: 'lf-panel-h' }, [el('h2', { class: 'lf-h', text: 'Recent spends' }), el('span', { class: 'lf-d', text: rows.length ? rows.length + ' in ' + L.monthName(m).split(' ')[0] : '' })]),
      rows.length ? el('ul', { class: 'lf-rows bg-rows' }, rows.slice(0, allRows ? 200 : 8).map(function (s) {
        return el('li', null, [
          el('span', { class: 'lf-rows-d', text: L.day(s.day) }),
          el('span', { class: 'lf-rows-n' }, [el('b', { text: s.note || names[s.cat] })]),
          el('span', { class: 'bg-chip', text: names[s.cat] }),
          el('span', { class: 'lf-rows-v', text: '−' + L.money(s.amount) }),
          el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Delete this spend', text: '×', onclick: function () { mo.spends = mo.spends.filter(function (x) { return x.id !== s.id; }); commit(); } }),
        ]);
      })) : el('p', { class: 'lf-note-s', text: 'Nothing logged yet this month.' }),
      rows.length > 8 ? el('button', { type: 'button', class: 'lf-act', text: allRows ? 'Show the latest 8' : 'Show all ' + rows.length, onclick: function () { allRows = !allRows; draw(); } }) : null,
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
  d = clean(L.state.keep ? saved || {} : {});
  ensure();
  L.current = function () { return d; };
  L.onData = function (x) { d = x ? clean(x) : { months: {} }; m = L.month(L.today()); ensure(); draw(); };
  L.ready(draw);
})();
