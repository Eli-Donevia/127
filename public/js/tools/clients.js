// Clients and sessions (lib/tools 'clients', Legal L92): each client's first name, one optional way to reach them,
// the package and sessions bought, a short note and every session. Left = bought - done (a no-show isn't counted as
// used). The active client with the fewest left is the one thing lit in Pop. The way to reach them is only ever a
// mailto: or tel: link here; nothing sends to it. Saves { clients } as the member types.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var today = T.iso(new Date());
  var ses = function (d, state, len) { return { id: uid(), day: d, len: len || 60, state: state }; };
  var cl = function (name, pkg, bought, sessions, status) { return { id: uid(), name: name, reach: '', pkg: pkg, bought: bought, status: status || 'active', note: '', sessions: sessions }; };
  var ago = function (n) { return T.addDays(today, -n); };
  // Names and counts only: no money (Legal L82 spirit).
  var EXAMPLE = { clients: [
    cl('Maya', 'Ten sessions', 10, [ses(T.addDays(today, 2), 'planned'), ses(ago(5), 'done'), ses(ago(12), 'done'), ses(ago(19), 'done'), ses(ago(26), 'done'), ses(ago(33), 'done'), ses(ago(40), 'done'), ses(ago(47), 'done'), ses(ago(54), 'done'), ses(ago(61), 'done')]),
    cl('Jordan', 'Monthly, four sessions', 4, [ses(T.addDays(today, 1), 'planned'), ses(ago(6), 'done'), ses(ago(13), 'noshow')]),
    cl('Priya', 'Six sessions', 6, [ses(ago(2), 'done'), ses(ago(9), 'done')]),
  ] };
  var data = T.state.data, demo = false, filter = 'active', open = {};
  if (!T.state.canSave) { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; }

  function read(c) {
    var done = 0, noshow = 0, next = null;
    c.sessions.forEach(function (x) {
      if (x.state === 'done') done += 1;
      else if (x.state === 'noshow') noshow += 1;
      else if (x.day >= today && (!next || x.day < next)) next = x.day;
    });
    return { done: done, noshow: noshow, left: c.bought ? Math.max(0, c.bought - done) : null, next: next };
  }
  function reachLink(v) {
    v = String(v || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'mailto:' + v;
    if (/^\+?[\d\s().-]{7,}$/.test(v)) return 'tel:' + v.replace(/[^\d+]/g, '');
    return null;
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Know who’s running low before they do.' }),
      el('p', { class: 'tl-start-s', text: 'For each client: a first name, the package they bought and how many sessions it holds. Then tick off each session as it happens.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Add my first client', onclick: function () { data = { clients: [] }; add(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See it with example clients first', onclick: function () { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example clients. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.chips = el('div', { class: 'hk-chips', role: 'tablist', 'aria-label': 'Show' });
    nodes.list = el('div', { class: 'sk-list' });
    root.appendChild(nodes.sum);
    root.appendChild(nodes.chips);
    root.appendChild(nodes.list);
    root.appendChild(el('button', { type: 'button', class: 'tl-act id-add', text: 'Add a client', onclick: add }));
    chips();
    rows();
    update();
  }

  function add() {
    var c = cl('', '', 0, []);
    data.clients.unshift(c);
    open[c.id] = true;
    filter = 'active';
    changed();
    draw();
    var f = root.querySelector('.cl-name');
    if (f) f.focus();
  }

  function lowest() {
    return data.clients.filter(function (c) { return c.status === 'active' && c.bought; }).map(function (c) { return { c: c, r: read(c) }; })
      .sort(function (a, b) { return a.r.left - b.r.left; })[0] || null;
  }

  function update() {
    var mon = T.monday(), sun = T.addDays(mon, 6), wkDone = 0, wkPlan = 0, shows = 0;
    var low = data.clients.filter(function (c) { var r = read(c); return c.status === 'active' && r.left != null && r.left <= 1; });
    data.clients.forEach(function (c) {
      c.sessions.forEach(function (x) {
        if (x.day >= mon && x.day <= sun) { if (x.state === 'done') wkDone += 1; else if (x.state === 'planned') wkPlan += 1; }
        if (x.state === 'noshow' && x.day >= T.addDays(today, -30)) shows += 1;
      });
    });
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: 'Sessions this week' }),
      el('b', { class: 'tl-hero-v', text: String(wkDone + wkPlan) }),
      el('span', { class: 'tl-d', text: wkDone + wkPlan ? wkDone + ' done, ' + wkPlan + ' still to come' : 'Nothing on the books from ' + T.day(mon) + ' to ' + T.day(sun) + '.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Running low' }), el('b', { text: String(low.length) }), el('span', { class: 'tl-d', text: low.length ? low.map(function (c) { return c.name || 'Unnamed'; }).slice(0, 3).join(', ') + ': one session or none left' : 'Every active client has two or more left' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'No-shows, last 30 days' }), el('b', { text: String(shows) }), el('span', { class: 'tl-d', text: 'not counted as used' })]));
    var lit = lowest();
    Array.prototype.forEach.call(nodes.list.children, function (row) {
      var c = byId(row.getAttribute('data-id'));
      if (!c) return;
      var r = read(c);
      row.classList.toggle('lead', !!lit && lit.c.id === c.id && r.left != null && r.left <= 1);
      row.querySelector('.cl-left').textContent = r.left == null ? '–' : r.left + ' left';
      row.querySelector('.cl-sub').textContent = [c.pkg, r.left == null ? 'Add sessions bought' : r.done + ' of ' + c.bought + ' used', r.noshow ? r.noshow + ' no-show' + (r.noshow > 1 ? 's' : '') : null, r.next ? 'Next ' + T.day(r.next) : null].filter(Boolean).join(' · ');
      row.querySelector('.sk-bar .left').style.width = c.bought ? Math.min(100, (r.done / c.bought) * 100) + '%' : '0%';
    });
  }

  function chips() {
    nodes.chips.innerHTML = '';
    [['active', 'Active'], ['paused', 'Paused'], ['done', 'Finished'], ['all', 'All']].forEach(function (f) {
      var n = f[0] === 'all' ? data.clients.length : data.clients.filter(function (c) { return c.status === f[0]; }).length;
      nodes.chips.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(filter === f[0]), class: 'cv-pick-c' + (filter === f[0] ? ' on' : ''), text: f[1] + ' ' + n, onclick: function () { filter = f[0]; chips(); rows(); update(); } }));
    });
  }

  // The most sessions one document keeps (lib/tools cleanClients).
  var ROOM = 250;
  function total() { return data.clients.reduce(function (n, c) { return n + c.sessions.length; }, 0); }

  function byId(id) { return data.clients.filter(function (c) { return c.id === id; })[0]; }

  function rows() {
    nodes.list.innerHTML = '';
    var shown = data.clients.filter(function (c) { return filter === 'all' || c.status === filter; });
    if (!shown.length) nodes.list.appendChild(el('p', { class: 'tl-note', text: data.clients.length ? 'No clients here.' : 'No clients yet.' }));
    shown.forEach(function (c) {
      var link = reachLink(c.reach);
      var head = el('div', { class: 'cs-head' }, [
        el('button', { type: 'button', class: 'cl-open', 'aria-expanded': String(!!open[c.id]), onclick: function () { open[c.id] = !open[c.id]; rows(); update(); } }, [
          el('span', { class: 'cl-who', text: c.name || 'Unnamed client' }),
          el('span', { class: 'cl-sub' }),
        ]),
        el('span', { class: 'sk-wk cl-left' }),
      ]);
      var row = el('article', { class: 'sk-row cl-row', 'data-id': c.id }, [head, el('div', { class: 'sk-bar cl-bar', 'aria-hidden': 'true' }, [el('i', { class: 'left' })])]);
      if (link && !open[c.id]) row.appendChild(el('a', { class: 'cl-reach', href: link, text: c.reach }));
      if (open[c.id]) row.appendChild(editor(c));
      nodes.list.appendChild(row);
    });
  }

  function editor(c) {
    var t = function (label, k, o) {
      var input = T.text({ value: c[k], max: o.max, placeholder: o.ph || '', aria: label, onInput: function (v) { c[k] = v; changed(); var h = nodes.list.querySelector('[data-id="' + c.id + '"] .cl-who'); if (k === 'name' && h) h.textContent = v || 'Unnamed client'; } });
      if (o.cls) input.classList.add(o.cls);
      return el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: label }), input, o.hint ? el('span', { class: 'tl-f-h', text: o.hint }) : null]);
    };
    var note = el('textarea', { class: 'cl-note', maxlength: 280, rows: 3, 'aria-label': 'Note', placeholder: 'What you’re working on together' });
    note.value = c.note;
    note.addEventListener('input', function () { c.note = note.value; changed(); });
    var status = el('div', { class: 'hk-chips cl-status' }, [['active', 'Active'], ['paused', 'Paused'], ['done', 'Finished']].map(function (s) {
      return el('button', { type: 'button', class: 'cv-pick-c' + (c.status === s[0] ? ' on' : ''), 'aria-pressed': String(c.status === s[0]), text: s[1], onclick: function () { c.status = s[0]; changed(); chips(); rows(); update(); } });
    }));
    var list = el('div', { class: 'cl-ses' });
    c.sessions.forEach(function (x, i) {
      var date = el('input', { class: 'tl-sel cl-date', type: 'date', value: x.day, 'aria-label': 'Session day' });
      date.addEventListener('change', function () { if (date.value) { x.day = date.value; changed(); } });
      var len = el('select', { class: 'tl-sel', 'aria-label': 'Length' }, [30, 45, 60, 90, 120].map(function (m) { return el('option', { value: m, selected: x.len === m || null, text: m + ' min' }); }));
      if ([30, 45, 60, 90, 120].indexOf(x.len) < 0) len.appendChild(el('option', { value: x.len, selected: true, text: x.len + ' min' }));
      len.addEventListener('change', function () { x.len = +len.value; changed(); });
      var st = el('div', { class: 'cl-st' }, [['planned', 'Planned'], ['done', 'Done'], ['noshow', 'No-show']].map(function (s) {
        return el('button', { type: 'button', class: 'cl-st-b ' + s[0] + (x.state === s[0] ? ' on' : ''), 'aria-pressed': String(x.state === s[0]), text: s[1], onclick: function () { x.state = s[0]; changed(); rows(); update(); } });
      }));
      list.appendChild(el('div', { class: 'cl-s' + (x.state === 'done' ? ' done' : '') }, [date, len, st, el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove session', text: '×', onclick: function () { c.sessions.splice(i, 1); changed(); rows(); update(); } })]));
    });
    return el('div', { class: 'cl-edit' }, [
      el('div', { class: 'cl-grid' }, [
        t('First name or nickname', 'name', { max: 40, cls: 'cl-name' }),
        t('How you reach them, optional', 'reach', { max: 80, hint: 'Only for you to tap. 127 never contacts them.' }),
        t('Package', 'pkg', { max: 40, ph: 'Ten sessions' }),
        T.field({ label: 'Sessions bought', value: c.bought || '', int: true, onInput: function (v) { c.bought = Math.max(0, Math.round(v)); changed(); } }),
      ]),
      status,
      el('label', { class: 'tl-f cl-notef' }, [el('span', { class: 'tl-f-l', text: 'Note' }), note, el('span', { class: 'tl-f-h', text: 'Keep it to the work. Leave out health, money and other private details.' })]),
      el('h3', { class: 'tl-h cl-sh', text: 'Sessions' }),
      list,
      el('div', { class: 'cl-acts' }, [
        el('button', { type: 'button', class: 'tl-act', text: 'Add a session', disabled: total() >= ROOM || null, title: total() >= ROOM ? 'Up to 250 sessions in all. Remove old ones to make room.' : null, onclick: function () { c.sessions.unshift(ses(today, 'planned', c.sessions[0] ? c.sessions[0].len : 60)); changed(); rows(); update(); } }),
        el('button', { type: 'button', class: 'tl-act cl-del', text: 'Delete client', onclick: function () {
          if (!window.confirm('Delete ' + (c.name || 'this client') + ' and every session? This can’t be undone.')) return;
          data.clients.splice(data.clients.indexOf(c), 1); changed(); chips(); rows(); update();
        } }),
      ]),
    ]);
  }

  function changed() { if (!demo) T.save(data); }
  draw();
})();
