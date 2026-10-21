// Week builder (lib/tools 'week'): the member's three goals, the days and hours they work, and how many hours a week
// each kind of block gets; "Build my week" lays the blocks out (deep work first thing, admin last, faith before the
// day and health after it), then every block can be dragged, or moved and resized from its panel. The block on now or
// next is the one thing lit in Pop. The week downloads as a calendar file that repeats weekly. No AI: the layout is
// the rules below. Saves { goals, days, start, end, want, blocks } with times in minutes from midnight.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var KINDS = [
    ['deep', 'Deep work', 'The one hard thing that moves a goal. Phone in another room.'],
    ['sales', 'Sales', 'Calls, follow-ups and DMs to people who could buy.'],
    ['content', 'Content', 'Film, write and post.'],
    ['admin', 'Admin', 'Email, invoices, bookkeeping. Last thing in the day.'],
    ['faith', 'Faith', 'Before the day starts.'],
    ['health', 'Health', 'Training, a walk, cooking. After work.'],
    ['family', 'Family', 'Protected time after work.'],
    ['other', 'Block', ''],
  ];
  var NAME = {}; KINDS.forEach(function (k) { NAME[k[0]] = k[1]; });
  var WORK = ['deep', 'sales', 'content', 'admin'], LIFE = ['faith', 'health', 'family'];
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var mins = function (hm) { var p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  var q15 = function (m) { return Math.round(m / 15) * 15; };
  var clock = function (m) { var h = Math.floor(m / 60) % 24, mm = m % 60, ap = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12; return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + ap; };
  var hrs = function (m) { var h = m / 60; return (h % 1 ? h.toFixed(h < 10 ? 2 : 1).replace(/0$/, '') : String(h)) + ' h'; };

  function blank() { var w = {}; KINDS.forEach(function (k) { w[k[0]] = 0; }); return { goals: ['', '', ''], days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00', want: w, blocks: [] }; }
  function example() {
    var d = blank();
    d.goals = ['Land three new clients', 'Post four times a week', 'Train four mornings'];
    d.want = { deep: 10, sales: 6, content: 6, admin: 3, faith: 3.5, health: 4, family: 0, other: 0 };
    d.blocks = build(d).blocks;
    return d;
  }
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = example(); demo = true; }

  // ---------- the layout rules ----------
  // Work blocks share out each kind's weekly hours over the days worked; life blocks over all seven days. On a work
  // day: deep work from the start, in chunks of up to two hours; then sales and content in chunks of up to ninety
  // minutes, never under thirty; admin takes the end of the day; 12 to 12:30 stays free. Whatever doesn't fit is
  // reported, not squeezed.
  function build(d) {
    var S = mins(d.start), E = mins(d.end), out = [], missed = {}, work = d.days.slice();
    if (E <= S) E = S + 60;
    // A kind's weekly hours in half hours, shared out so the week adds up exactly: the first days take the spare ones.
    var per = function (k, n, i) { if (!n) return 0; var u = Math.round((d.want[k] * 60) / 30); return (Math.floor(u / n) + (i < u % n ? 1 : 0)) * 30; };
    for (var day = 0; day < 7; day += 1) {
      var isWork = work.indexOf(day) >= 0;
      // Life: faith ends where the day starts, health then family begin where it ends.
      var f = per('faith', 7, day), h = per('health', 7, day), fam = per('family', 7, day), wi = work.indexOf(day);
      if (f) out.push(blk('faith', day, Math.max(0, S - f), f));
      if (h) out.push(blk('health', day, E, h));
      if (fam) out.push(blk('family', day, E + h, fam));
      if (!isWork) continue;
      var free = S < 720 && E > 750 ? [[S, 720], [750, E]] : [[S, E]];
      var adm = per('admin', work.length, wi);
      if (adm) { var last = free[free.length - 1], take = Math.min(adm, last[1] - last[0]); if (take > 0) { out.push(blk('admin', day, last[1] - take, take)); last[1] -= take; } if (adm > take) missed.admin = (missed.admin || 0) + adm - take; }
      [['deep', 120], ['sales', 90], ['content', 90]].forEach(function (k) {
        var left = per(k[0], work.length, wi);
        free.forEach(function (gap) {
          while (left > 0 && gap[1] - gap[0] >= 30) {
            var len = Math.min(left, k[1], gap[1] - gap[0]);
            out.push(blk(k[0], day, gap[0], len)); gap[0] += len; left -= len;
          }
        });
        if (left > 0) missed[k[0]] = (missed[k[0]] || 0) + left;
      });
    }
    return { blocks: out, missed: missed };
  }
  function blk(kind, day, from, len) { return { id: uid(), kind: kind, day: day, from: from, len: len, label: '' }; }

  // ---------- page ----------
  var nodes = {}, sel = null, view = (new Date().getDay() + 6) % 7, missed = {};
  var phone = function () { return window.matchMedia('(max-width: 720px)').matches; };

  function draw() {
    root.innerHTML = '';
    nodes = {};
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'What are the three things this week has to move?' }),
      el('p', { class: 'tl-start-s', text: 'Then the hours you work and how many go to each kind of work. The week lays itself out, and you move anything you want.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Build my week', onclick: function () { data = blank(); draw(); var f = root.querySelector('.tl-tx'); if (f) f.focus(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See an example week first', onclick: function () { data = example(); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example week. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; sel = null; draw(); } })]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.board = el('section', { class: 'tl-panel wk-board', 'aria-label': 'Your week' });
    nodes.edit = el('section', { class: 'tl-panel wk-edit', hidden: true });
    root.appendChild(nodes.sum);
    root.appendChild(el('div', { class: 'wk-grid' + (data.blocks.length ? ' has' : '') }, [setup(), el('div', { class: 'wk-main' }, [nodes.board, nodes.edit, cal()])]));
    board();
    update();
  }

  function setup() {
    var box = el('section', { class: 'tl-panel wk-setup' }, [el('h2', { class: 'tl-h', text: 'This week has to move' })]);
    data.goals.forEach(function (g, i) {
      box.appendChild(el('div', { class: 'wk-goal' }, [el('span', { class: 'wk-gi', text: String(i + 1) }), T.text({ value: g, max: 80, placeholder: ['The goal that matters most', 'Second', 'Third'][i], aria: 'Goal ' + (i + 1), onInput: function (v) { data.goals[i] = v; changed(); } })]));
    });
    box.appendChild(el('h2', { class: 'tl-h wk-h2', text: 'When you work' }));
    var days = el('div', { class: 'ct-days', role: 'group', 'aria-label': 'Days you work' });
    DOW.forEach(function (d, i) {
      var on = data.days.indexOf(i) >= 0;
      days.appendChild(el('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: on ? 'on' : '', text: d, onclick: function () { if (on) data.days.splice(data.days.indexOf(i), 1); else data.days.push(i); data.days.sort(); changed(); draw(); } }));
    });
    box.appendChild(days);
    var time = function (label, k) {
      var i = el('input', { type: 'time', class: 'tl-in wk-time', step: 900, value: data[k], 'aria-label': label });
      i.addEventListener('change', function () { if (/^\d\d:\d\d$/.test(i.value)) { data[k] = i.value; changed(); update(); } });
      return el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: label }), el('span', { class: 'tl-f-v' }, [i])]);
    };
    box.appendChild(el('div', { class: 'pf-two' }, [time('Start', 'start'), time('Finish', 'end')]));
    box.appendChild(el('h2', { class: 'tl-h wk-h2', text: 'Hours a week' }));
    nodes.cap = el('p', { class: 'tl-note wk-cap' });
    KINDS.forEach(function (k) {
      if (k[0] === 'other') return;
      box.appendChild(el('div', { class: 'wk-want' }, [
        el('span', { class: 'wk-sw k-' + k[0], 'aria-hidden': 'true' }),
        el('span', { class: 'wk-wl' }, [el('b', { text: k[1] }), el('span', { text: k[2] })]),
        T.field({ value: data.want[k[0]] || '', post: 'h', aria: k[1] + ' hours a week', cls: 'wk-wf', onInput: function (v) { data.want[k[0]] = Math.min(80, v); changed(); capNote(); } }),
      ]));
    });
    box.appendChild(nodes.cap);
    box.appendChild(el('button', { type: 'button', class: 'btn wk-build', text: data.blocks.length ? 'Rebuild my week' : 'Build my week', onclick: function () {
      if (data.blocks.length && !window.confirm('Rebuild the week from these hours? Blocks you moved go back to where the rules put them.')) return;
      var b = build(data); data.blocks = b.blocks; missed = b.missed; sel = null; changed(); draw();
    } }));
    return box;
  }

  function capNote() {
    if (!nodes.cap) return;
    var S = mins(data.start), E = mins(data.end), lunch = S < 720 && E > 750 ? 30 : 0;
    var have = Math.max(0, E - S - lunch) * data.days.length, ask = WORK.reduce(function (n, k) { return n + data.want[k] * 60; }, 0);
    nodes.cap.textContent = ask > have ? 'You have ' + hrs(have) + ' of work time and asked for ' + hrs(ask) + '. Some won’t fit.' : hrs(have) + ' of work time a week, ' + hrs(have - ask) + ' left open for whatever comes up.';
    nodes.cap.classList.toggle('warn', ask > have);
  }

  // ---------- the board ----------
  function range() {
    var lo = mins(data.start), hi = mins(data.end);
    data.blocks.forEach(function (b) { lo = Math.min(lo, b.from); hi = Math.max(hi, b.from + b.len); });
    return [Math.floor(lo / 60) * 60, Math.min(1440, Math.ceil(hi / 60) * 60)];
  }
  var PX = function () { return phone() ? 1.3 : 1.05; };

  function board() {
    var b = nodes.board, r = range(), px = PX(), one = phone(), today = (new Date().getDay() + 6) % 7;
    b.innerHTML = '';
    b.appendChild(el('h2', { class: 'tl-h', text: 'Your week' }));
    if (one) {
      var tabs = el('div', { class: 'wk-tabs', role: 'tablist', 'aria-label': 'Day' });
      DOW.forEach(function (d, i) {
        var n = data.blocks.filter(function (x) { return x.day === i; }).length;
        tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': i === view ? 'true' : 'false', class: (i === view ? 'on' : '') + (i === today ? ' today' : ''), onclick: function () { view = i; board(); } }, [el('span', { text: d }), el('i', { text: n ? String(n) : '' })]));
      });
      b.appendChild(tabs);
    }
    var wrap = el('div', { class: 'wk-wrap' + (one ? ' one' : '') });
    var axis = el('div', { class: 'wk-axis', 'aria-hidden': 'true', style: 'height:' + (r[1] - r[0]) * px + 'px' });
    for (var m = r[0]; m <= r[1]; m += 60) axis.appendChild(el('span', { style: 'top:' + (m - r[0]) * px + 'px', text: m < 1440 ? clock(m) : '' }));
    wrap.appendChild(axis);
    var cols = el('div', { class: 'wk-cols' });
    (one ? [view] : [0, 1, 2, 3, 4, 5, 6]).forEach(function (d) {
      var col = el('div', { class: 'wk-col' + (d === today ? ' today' : '') + (data.days.indexOf(d) < 0 ? ' off' : ''), 'data-day': d, style: 'height:' + (r[1] - r[0]) * px + 'px' });
      if (!one) col.appendChild(el('span', { class: 'wk-dh', text: DOW[d] }));
      var S = mins(data.start), E = mins(data.end);
      if (data.days.indexOf(d) >= 0) col.appendChild(el('i', { class: 'wk-hours', style: 'top:' + (S - r[0]) * px + 'px;height:' + Math.max(0, E - S) * px + 'px', 'aria-hidden': 'true' }));
      for (var h = r[0] + 60; h < r[1]; h += 60) col.appendChild(el('i', { class: 'wk-line', style: 'top:' + (h - r[0]) * px + 'px', 'aria-hidden': 'true' }));
      col.addEventListener('click', function (e) {
        if (e.target !== col && !e.target.classList.contains('wk-hours') && !e.target.classList.contains('wk-line')) return;
        var y = e.clientY - col.getBoundingClientRect().top, from = Math.max(0, Math.min(1440 - 60, q15(r[0] + y / px - 30)));
        var nb = blk('other', d, from, 60); data.blocks.push(nb); sel = nb.id; changed(); board(); editor();
      });
      data.blocks.filter(function (x) { return x.day === d; }).sort(function (a, c) { return a.from - c.from; }).forEach(function (x) { col.appendChild(block(x, r, px)); });
      cols.appendChild(col);
    });
    wrap.appendChild(cols);
    b.appendChild(wrap);
    b.appendChild(el('p', { class: 'tl-note wk-tip', text: one ? 'Hold a block, then drag it. Tap one to change it, or tap an empty time to add one.' : 'Drag a block to move it. Click one to change it, or click an empty time to add one.' }));
    lit();
  }

  function block(x, r, px) {
    var node = el('button', { type: 'button', class: 'wk-b k-' + x.kind + (x.id === sel ? ' sel' : ''), 'data-id': x.id, style: 'top:' + (x.from - r[0]) * px + 'px;height:' + Math.max(18, x.len * px - 3) + 'px', 'aria-label': (x.label || NAME[x.kind]) + ', ' + DOW[x.day] + ' ' + clock(x.from) + ' to ' + clock(x.from + x.len) }, [
      el('b', { text: x.label || NAME[x.kind] }),
      x.len >= 45 ? el('span', { text: clock(x.from) + '–' + clock(x.from + x.len) }) : null,
    ]);
    drag(node, x, r, px);
    return node;
  }

  // Drag: mouse and pen right away; a finger after a short hold, so the page still scrolls under a quick swipe.
  var dragging = null;
  function drag(node, x, r, px) {
    node.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var st = { x: e.clientX, y: e.clientY, from: x.from, day: x.day, moved: false, live: e.pointerType !== 'touch', id: e.pointerId };
      var timer = st.live ? null : setTimeout(function () { st.live = true; node.classList.add('lift'); if (navigator.vibrate) navigator.vibrate(8); }, 260);
      var cols = Array.prototype.slice.call(nodes.board.querySelectorAll('.wk-col'));
      function move(ev) {
        var dx = ev.clientX - st.x, dy = ev.clientY - st.y;
        if (!st.live) { if (Math.abs(dx) + Math.abs(dy) > 8) { clearTimeout(timer); end(); } return; }
        if (!st.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!st.moved) { st.moved = true; dragging = st; node.classList.add('lift'); try { node.setPointerCapture(st.id); } catch (err) { /* fine */ } }
        x.from = Math.max(0, Math.min(1440 - x.len, q15(st.from + dy / px)));
        if (cols.length > 1) {
          var hit = cols.filter(function (c) { var b = c.getBoundingClientRect(); return ev.clientX >= b.left && ev.clientX < b.right; })[0];
          if (hit && +hit.getAttribute('data-day') !== x.day) { x.day = +hit.getAttribute('data-day'); hit.appendChild(node); }
        }
        node.style.top = (x.from - r[0]) * px + 'px';
        node.querySelector('b').textContent = x.label || NAME[x.kind];
        var t = node.querySelector('span'); if (t) t.textContent = clock(x.from) + '–' + clock(x.from + x.len);
      }
      function end() {
        clearTimeout(timer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', end);
        node.classList.remove('lift');
        dragging = null;
      }
      function up() {
        var was = st.moved; end();
        if (was) { sel = x.id; changed(); board(); editor(); node = null; }
        else { sel = sel === x.id ? null : x.id; board(); editor(); }
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', end);
    });
    node.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.detail === 0) { sel = sel === x.id ? null : x.id; board(); editor(); var again = nodes.board.querySelector('[data-id="' + x.id + '"]'); if (again) again.focus(); }
    });
    node.addEventListener('contextmenu', function (e) { if (dragging || e.pointerType === 'touch') e.preventDefault(); });
  }
  // Once a held finger is dragging, the page must not scroll under it.
  document.addEventListener('touchmove', function (e) { if (dragging) e.preventDefault(); }, { passive: false });

  // ---------- the selected block ----------
  function editor() {
    var e = nodes.edit, x = data.blocks.filter(function (b) { return b.id === sel; })[0];
    e.innerHTML = '';
    e.hidden = !x;
    if (!x) return;
    var redraw = function () { changed(); board(); editor(); };
    var kinds = el('div', { class: 'hk-chips wk-kinds', role: 'radiogroup', 'aria-label': 'Kind of block' });
    KINDS.forEach(function (k) { kinds.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': x.kind === k[0] ? 'true' : 'false', class: 'cv-pick-c' + (x.kind === k[0] ? ' on' : ''), text: k[1], onclick: function () { x.kind = k[0]; redraw(); } })); });
    var step = function (label, val, dn, upf) {
      return el('div', { class: 'wk-step' }, [el('span', { class: 'tl-f-l', text: label }), el('div', { class: 'wk-stepc' }, [
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': label + ': 15 minutes less', text: '−', onclick: dn }),
        el('b', { text: val }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': label + ': 15 minutes more', text: '+', onclick: upf }),
      ])]);
    };
    var dayRow = el('div', { class: 'ct-days', role: 'radiogroup', 'aria-label': 'Day' });
    DOW.forEach(function (d, i) { dayRow.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': x.day === i ? 'true' : 'false', class: x.day === i ? 'on' : '', text: d, onclick: function () { x.day = i; view = i; redraw(); } })); });
    e.appendChild(el('div', { class: 'wk-eh' }, [el('h2', { class: 'tl-h', text: (x.label || NAME[x.kind]) + ', ' + DOW[x.day] + ' ' + clock(x.from) }), el('button', { type: 'button', class: 'tl-act', text: 'Done', onclick: function () { sel = null; board(); editor(); } })]));
    e.appendChild(kinds);
    e.appendChild(el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'Name it (optional)' }), T.text({ value: x.label, max: 40, placeholder: NAME[x.kind], aria: 'Block name', onInput: function (v) { x.label = v; changed(); var n = nodes.board.querySelector('[data-id="' + x.id + '"] b'); if (n) n.textContent = v || NAME[x.kind]; } })]));
    e.appendChild(el('div', { class: 'wk-steps' }, [
      step('Starts', clock(x.from), function () { x.from = Math.max(0, x.from - 15); redraw(); }, function () { x.from = Math.min(1440 - x.len, x.from + 15); redraw(); }),
      step('Length', hrs(x.len).replace(' h', ' hrs').replace(/^0\.25 hrs$/, '15 min').replace(/^0\.5 hrs$/, '30 min').replace(/^0\.75 hrs$/, '45 min'), function () { x.len = Math.max(15, x.len - 15); redraw(); }, function () { x.len = Math.min(480, 1440 - x.from, x.len + 15); redraw(); }),
    ]));
    e.appendChild(dayRow);
    e.appendChild(el('button', { type: 'button', class: 'tl-act wk-del', text: 'Remove this block', onclick: function () { data.blocks.splice(data.blocks.indexOf(x), 1); sel = null; redraw(); } }));
  }

  function cal() {
    nodes.cal = el('section', { class: 'tl-panel wk-cal' });
    return nodes.cal;
  }

  // ---------- summary ----------
  function nowNext() {
    var d = (new Date().getDay() + 6) % 7, m = new Date().getHours() * 60 + new Date().getMinutes();
    var all = data.blocks.slice().sort(function (a, b) { return a.day - b.day || a.from - b.from; });
    var cur = all.filter(function (b) { return b.day === d && b.from <= m && b.from + b.len > m; })[0];
    if (cur) return { b: cur, now: true };
    var later = all.filter(function (b) { return b.day > d || (b.day === d && b.from > m); })[0] || all[0];
    return later ? { b: later, now: false } : null;
  }
  function lit() {
    var n = nowNext();
    Array.prototype.forEach.call(nodes.board.querySelectorAll('.wk-b'), function (b) { b.classList.toggle('lead', !!n && b.getAttribute('data-id') === n.b.id); });
  }
  function update() {
    var placed = {}, total = 0, n = nowNext();
    KINDS.forEach(function (k) { placed[k[0]] = 0; });
    data.blocks.forEach(function (b) { placed[b.kind] += b.len; if (WORK.indexOf(b.kind) >= 0) total += b.len; });
    var miss = Object.keys(missed).reduce(function (s, k) { return s + missed[k]; }, 0);
    var goal = data.goals.filter(Boolean)[0];
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: !n ? 'Your week' : n.now ? 'On now' : 'Next: ' + DOW[n.b.day] + ' ' + clock(n.b.from) }),
      el('b', { class: 'tl-hero-v wk-hv', text: n ? n.b.label || NAME[n.b.kind] : '–' }),
      el('span', { class: 'tl-d', text: !n ? 'Set your hours a week, then build it.' : n.b.kind === 'deep' && goal ? 'For: ' + goal : clock(n.b.from) + ' to ' + clock(n.b.from + n.b.len) }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Deep work this week' }), el('b', { text: hrs(placed.deep) }), el('span', { class: 'tl-d' + (data.want.deep && placed.deep >= data.want.deep * 60 ? ' up' : ''), text: data.want.deep ? 'of ' + hrs(data.want.deep * 60) + ' you wanted' : 'Set how many hours you want' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: miss ? 'Didn’t fit' : 'Work blocks' }), el('b', { text: miss ? hrs(miss) : hrs(total) }), el('span', { class: 'tl-d' + (miss ? ' warn' : ''), text: miss ? Object.keys(missed).map(function (k) { return NAME[k].toLowerCase() + ' ' + hrs(missed[k]); }).join(', ') + '. Start earlier, finish later or ask for less.' : 'sales, content, admin and deep work' })]));
    capNote();
    if (nodes.cal) {
      nodes.cal.innerHTML = '';
      nodes.cal.appendChild(el('h2', { class: 'tl-h', text: 'Put it in your calendar' }));
      var can = T.state.canSave && !demo && data.blocks.length;
      nodes.cal.appendChild(el('p', { class: 'tl-note', text: 'Downloads your week as a calendar file. Open it with Google Calendar, Apple Calendar or Outlook and every block repeats each week from next Monday. Rebuild later and download again.' }));
      nodes.cal.appendChild(can ? el('a', { class: 'btn', href: '/app/hq/tools/week/export.ics', text: 'Download my week' }) : el('span', { class: 'tl-note', text: demo ? 'Start your own week to download it.' : 'Build your week first.' }));
    }
    if (nodes.board) lit();
  }

  function changed() { if (!demo) T.save(data); update(); }
  var w = window.innerWidth;
  window.addEventListener('resize', function () { if ((w > 720) !== (window.innerWidth > 720)) { w = window.innerWidth; if (data && nodes.board) board(); } });
  draw();
  if (data && sel) editor();
})();
