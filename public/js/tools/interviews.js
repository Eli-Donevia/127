// Interview board (lib/tools 'interviews', Legal L92): every customer conversation on one board, grouped by how much
// the problem hurts them from what they said. Amounts they said they'd pay are shown exactly as typed: nothing adds
// them up or projects from them, and the read on the board says it comes from the member's notes, not a prediction.
// Saves { idea, people } as the member types.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var today = T.iso(new Date());
  var PAIN = ['Not a problem', 'A little', 'Hurts a lot', 'Looking for a fix now'];
  var QS = [
    ['last', 'The last time it came up, what happened'],
    ['tried', 'What they’ve tried, and what was wrong with it'],
    ['stop', 'What would stop them buying a fix'],
  ];
  var person = function (who, d, done, pain, last, tried, stop) { return { id: uid(), who: who, day: d, done: done, pain: pain, last: last || '', tried: tried || '', stop: stop || '', pay: '' }; };
  // Words only, no amounts (Legal L82 spirit).
  var EXAMPLE = { idea: 'Weekly meal plans for shift workers', people: [
    person('Night nurse, two kids', T.addDays(today, -6), true, 3, 'Ate from the vending machine three nights running.', 'Meal kits. Too much prep after a 12-hour shift.', 'Another subscription to cancel.'),
    person('Warehouse lead', T.addDays(today, -4), true, 2, 'Skipped lunch, then fast food on the way home.', 'Batch cooking on Sundays. Gave up after two weeks.', 'Doesn’t trust meal plans to fit his hours.'),
    person('Paramedic', T.addDays(today, -2), true, 1, 'Packs leftovers most days.', 'Nothing yet.', 'Doesn’t see it as a problem.'),
    person('ER tech', T.addDays(today, 2), false, 0),
  ] };
  var data = T.state.data, demo = false, sel = null;
  if (!T.state.canSave) { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Hear it in their words before you build.' }),
      el('p', { class: 'tl-start-s', text: 'Talk to people who have the problem. After each talk, write down what they said to three questions and how much it hurts them.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Add my first conversation', onclick: function () { data = { idea: '', people: [] }; add(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See an example board first', onclick: function () { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example conversations. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; sel = null; draw(); } })]));
    var idea = T.text({ value: data.idea, max: 80, placeholder: 'The problem or idea you’re testing', aria: 'What you’re testing', onInput: function (v) { data.idea = v; changed(); } });
    idea.classList.add('iv-idea');
    root.appendChild(el('label', { class: 'tl-f iv-ideaf' }, [el('span', { class: 'tl-f-l', text: 'What you’re testing' }), idea]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.board = el('div', { class: 'iv-board' });
    nodes.edit = el('div', { class: 'iv-editw' });
    root.appendChild(nodes.sum);
    root.appendChild(el('div', { class: 'iv-bar' }, [el('h2', { class: 'tl-h', text: 'The board' }), el('button', { type: 'button', class: 'tl-act', text: 'Add a conversation', onclick: add })]));
    root.appendChild(nodes.board);
    root.appendChild(nodes.edit);
    board();
    update();
    editor();
  }

  function add() {
    var p = person('', today, false, 0);
    data.people.unshift(p);
    sel = p.id;
    changed();
    draw();
    var f = root.querySelector('.iv-who');
    if (f) { f.focus(); f.scrollIntoView({ block: 'center', behavior: T.reduce ? 'auto' : 'smooth' }); }
  }

  function update() {
    var talked = data.people.filter(function (p) { return p.done; }), hurt = talked.filter(function (p) { return p.pain >= 2; });
    var priced = talked.filter(function (p) { return p.pay; }), toGo = data.people.length - talked.length;
    var read = !talked.length ? 'Nothing to read yet.' : talked.length < 5 ? 'Talk to at least five people before reading much into this.' : hurt.length / talked.length >= 0.6 ? 'Most of the people you talked to said it hurts a lot.' : hurt.length ? 'Fewer than six in ten said it hurts a lot.' : 'No one you talked to said it hurts a lot.';
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: 'Said it hurts a lot' }),
      el('b', { class: 'tl-hero-v', text: talked.length ? hurt.length + ' of ' + talked.length : '–' }),
      el('span', { class: 'tl-d', text: talked.length ? 'of the people you’ve talked to' : 'Mark a conversation as talked to see this.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Named a price' }), el('b', { text: String(priced.length) }), el('span', { class: 'tl-d', text: 'in their own words, on each card' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Still to talk to' }), el('b', { text: String(toGo) }), el('span', { class: 'tl-d', text: toGo ? 'on the board' : 'Add the next person' })]));
    nodes.sum.appendChild(el('p', { class: 'id-from', text: read + ' From your notes, not a prediction.' }));
  }

  function card(p) {
    var line = p.last || p.tried || p.stop;
    return el('button', { type: 'button', class: 'iv-card' + (sel === p.id ? ' on' : ''), 'aria-pressed': String(sel === p.id), onclick: function () { sel = sel === p.id ? null : p.id; board(); editor(); if (sel) nodes.edit.scrollIntoView({ block: 'nearest', behavior: T.reduce ? 'auto' : 'smooth' }); } }, [
      el('span', { class: 'iv-who-t', text: p.who || 'Unnamed' }),
      p.day ? el('span', { class: 'iv-day', text: T.day(p.day) }) : null,
      line ? el('span', { class: 'iv-q', text: '“' + line + '”' }) : null,
      p.pay ? el('span', { class: 'iv-pay', text: 'Said they’d pay: ' + p.pay }) : null,
    ]);
  }

  function board() {
    nodes.board.innerHTML = '';
    var cols = [{ t: 'To talk to', ps: data.people.filter(function (p) { return !p.done; }) }];
    for (var i = PAIN.length - 1; i >= 0; i--) (function (i) { cols.push({ t: PAIN[i], top: i === 3, ps: data.people.filter(function (p) { return p.done && p.pain === i; }) }); })(i);
    cols.forEach(function (c) {
      nodes.board.appendChild(el('section', { class: 'iv-col' + (c.top && c.ps.length ? ' top' : '') }, [
        el('h3', { class: 'iv-ch' }, [el('span', { text: c.t }), el('span', { class: 'iv-n', text: String(c.ps.length) })]),
        el('div', { class: 'iv-cards' }, c.ps.length ? c.ps.map(card) : [el('span', { class: 'iv-empty', text: 'No one yet' })]),
      ]));
    });
  }

  function editor() {
    nodes.edit.innerHTML = '';
    var p = data.people.filter(function (x) { return x.id === sel; })[0];
    if (!p) return;
    var redraw = function () { board(); update(); };
    var who = T.text({ value: p.who, max: 40, placeholder: 'Café owner, two years in', aria: 'Who they are', onInput: function (v) { p.who = v; changed(); redraw(); } });
    who.classList.add('iv-who');
    var date = el('input', { class: 'tl-sel', type: 'date', value: p.day || '', 'aria-label': 'Day' });
    date.addEventListener('change', function () { p.day = date.value || null; changed(); redraw(); });
    var chips = function (opts, cur, set) {
      return el('div', { class: 'hk-chips iv-chips' }, opts.map(function (o) {
        return el('button', { type: 'button', class: 'cv-pick-c' + (cur() === o[0] ? ' on' : ''), 'aria-pressed': String(cur() === o[0]), text: o[1], onclick: function () { set(o[0]); changed(); redraw(); editor(); } });
      }));
    };
    var area = function (k, label) {
      var t = el('textarea', { class: 'cl-note', maxlength: 240, rows: 2, 'aria-label': label });
      t.value = p[k];
      t.addEventListener('input', function () { p[k] = t.value; changed(); board(); });
      return el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: label }), t]);
    };
    var pay = T.text({ value: p.pay, max: 40, aria: 'What they said they’d pay', onInput: function (v) { p.pay = v; changed(); redraw(); } });
    nodes.edit.appendChild(el('section', { class: 'tl-panel iv-edit' }, [
      el('div', { class: 'cl-grid' }, [
        el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'Who they are' }), who, el('span', { class: 'tl-f-h', text: 'A few words, no full name needed.' })]),
        el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'Day' }), date]),
      ]),
      chips([[false, 'To talk to'], [true, 'Talked']], function () { return p.done; }, function (v) { p.done = v; }),
      p.done ? el('div', { class: 'iv-pain' }, [el('span', { class: 'tl-f-l', text: 'How much it hurts, from what they said' }), chips(PAIN.map(function (t, i) { return [i, t]; }), function () { return p.pain; }, function (v) { p.pain = v; })]) : null,
      el('div', { class: 'iv-qs' }, QS.map(function (q) { return area(q[0], q[1]); })),
      el('label', { class: 'tl-f iv-payf' }, [el('span', { class: 'tl-f-l', text: 'What they said they’d pay' }), pay, el('span', { class: 'tl-f-h', text: 'Their words, not a promise to buy' })]),
      el('div', { class: 'cl-acts' }, [
        el('button', { type: 'button', class: 'tl-act', text: 'Done', onclick: function () { sel = null; board(); editor(); } }),
        el('button', { type: 'button', class: 'tl-act cl-del', text: 'Delete conversation', onclick: function () {
          if (!window.confirm('Delete this conversation? This can’t be undone.')) return;
          data.people.splice(data.people.indexOf(p), 1); sel = null; changed(); board(); update(); editor();
        } }),
      ]),
    ]));
  }

  function changed() { if (!demo) T.save(data); }
  draw();
})();
