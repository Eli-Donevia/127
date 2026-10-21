// Hours and tools audit (lib/tools 'hours'): last week's tasks tagged only me, repeat (hand it to an SOP, a helper
// or an automation) or waste, and every tool paid for with its one job and whether it was used in 30 days. The
// biggest repeat task is the one thing lit in Tide: that's the first to hand off.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var TAGS = [['me', 'Only me'], ['repeat', 'Repeat'], ['waste', 'Waste']];
  // The example's tools carry no prices (Legal L82 spirit: no example money).
  var EXAMPLE = {
    tasks: [['Sessions with students', 9, 'me'], ['Answering parent texts', 4, 'repeat'], ['Writing invoices', 2, 'repeat'], ['Scrolling for content ideas', 3, 'waste'], ['Making worksheets', 5, 'repeat'], ['Sales calls', 2, 'me']].map(function (r) { return { id: uid(), name: r[0], hours: r[1], tag: r[2] }; }),
    tools: [['Design app', 0, 'Worksheets and posts', true], ['Booking app', 0, 'Booking calls', true], ['Notes app', 0, 'Notes', false], ['Video editor', 0, '', false]].map(function (r) { return { id: uid(), name: r[0], cost: r[1], job: r[2], used: r[3] }; }),
  };
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Where did last week actually go?' }),
      el('p', { class: 'tl-start-s', text: 'List every task with its hours, tag each one, then list what you pay for. Twenty minutes.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Start my audit', onclick: function () { data = { tasks: [{ id: uid(), name: '', hours: 0, tag: 'me' }], tools: [] }; draw(); var f = root.querySelector('.tl-tx'); if (f) f.focus(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See it with an example week first', onclick: function () { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example week. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.split = el('section', { class: 'tl-panel hr-split' });
    root.appendChild(nodes.sum);
    root.appendChild(nodes.split);
    root.appendChild(el('div', { class: 'ch-grid' }, [tasks(), tools()]));
    update();
  }

  function update() {
    var sum = { me: 0, repeat: 0, waste: 0 }, all = 0;
    data.tasks.forEach(function (t) { sum[t.tag] += t.hours; all += t.hours; });
    var top = data.tasks.filter(function (t) { return t.tag === 'repeat' && t.hours > 0; }).sort(function (a, b) { return b.hours - a.hours; })[0];
    var cut = data.tools.filter(function (t) { return !t.used || !t.job; });
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: 'Hours on repeat tasks and waste' }),
      el('b', { class: 'tl-hero-v', text: (sum.repeat + sum.waste).toFixed((sum.repeat + sum.waste) % 1 ? 1 : 0) }),
      el('span', { class: 'tl-d', text: top ? 'Start with ' + (top.name || 'your biggest repeat task').toLowerCase() + ': ' + top.hours + ' hours last week. Write the steps down once so it can be handed off.' : 'Tag the tasks you repeat every week.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Only you can do' }), el('b', { text: sum.me + ' hrs' }), el('span', { class: 'tl-d', text: all ? Math.round((sum.me / all) * 100) + '% of ' + all + ' hours' : 'of last week' })]));
    // Legal L92 HT6: no savings, headcount or replacement figures. What's unused is named, not priced as a saving.
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Tools to look at' }), el('b', { text: String(cut.length) }), el('span', { class: 'tl-d', text: !cut.length ? 'Every tool has a job and gets used' : cut.map(function (t) { return t.name || 'Unnamed tool'; }).slice(0, 3).join(', ') + (cut.length > 3 ? ' and ' + (cut.length - 3) + ' more' : '') + ': unused or with no job' })]));
    // The week as one bar, split by tag.
    nodes.split.innerHTML = '';
    nodes.split.appendChild(el('h2', { class: 'tl-h', text: 'Last week' }));
    var bar = el('div', { class: 'hr-bar', role: 'img', 'aria-label': sum.me + ' hours only you, ' + sum.repeat + ' repeat, ' + sum.waste + ' waste' });
    TAGS.forEach(function (t) { if (sum[t[0]]) bar.appendChild(el('i', { class: t[0], style: 'flex-grow:' + sum[t[0]] })); });
    nodes.split.appendChild(bar);
    nodes.split.appendChild(el('div', { class: 'pf-leg' }, TAGS.map(function (t) { return el('span', null, [el('i', { class: 'hr-' + t[0] }), t[1] + ' ', el('b', { text: sum[t[0]] + ' h' })]); })));
    Array.prototype.forEach.call(root.querySelectorAll('[data-task]'), function (row) { row.classList.toggle('lead', !!top && row.getAttribute('data-task') === top.id); });
  }

  function seg(t) {
    var g = el('div', { class: 'hr-seg', role: 'radiogroup', 'aria-label': 'Tag for ' + (t.name || 'this task') });
    TAGS.forEach(function (x) {
      g.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': t.tag === x[0] ? 'true' : 'false', class: t.tag === x[0] ? 'on ' + x[0] : '', text: x[1], onclick: function () { t.tag = x[0]; changed(); Array.prototype.forEach.call(g.children, function (b, i) { var on = TAGS[i][0] === t.tag; b.className = on ? 'on ' + t.tag : ''; b.setAttribute('aria-checked', on ? 'true' : 'false'); }); } }));
    });
    return g;
  }
  function tasks() {
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'Tasks' })]);
    data.tasks.forEach(function (t, i) {
      box.appendChild(el('div', { class: 'hr-task', 'data-task': t.id }, [
        T.text({ value: t.name, placeholder: 'Task', aria: 'Task ' + (i + 1), onInput: function (v) { t.name = v; changed(); } }),
        T.field({ value: t.hours || '', post: 'h', aria: 'Hours for task ' + (i + 1), onInput: function (v) { t.hours = v; changed(); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove task ' + (i + 1), text: '×', onclick: function () { data.tasks.splice(i, 1); changed(); draw(); } }),
        seg(t),
      ]));
    });
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Add a task', onclick: function () { data.tasks.push({ id: uid(), name: '', hours: 0, tag: 'me' }); changed(); draw(); } }));
    return box;
  }
  function tools() {
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'What you pay for' })]);
    data.tools.forEach(function (t, i) {
      var used = el('button', { type: 'button', role: 'switch', 'aria-checked': t.used ? 'true' : 'false', class: 'hr-used' + (t.used ? ' on' : ''), text: t.used ? 'Used this month' : 'Not used in 30 days', onclick: function () { t.used = !t.used; used.className = 'hr-used' + (t.used ? ' on' : ''); used.textContent = t.used ? 'Used this month' : 'Not used in 30 days'; used.setAttribute('aria-checked', t.used ? 'true' : 'false'); changed(); } });
      box.appendChild(el('div', { class: 'hr-tool' }, [
        T.text({ value: t.name, placeholder: 'Tool', aria: 'Tool ' + (i + 1), onInput: function (v) { t.name = v; changed(); } }),
        T.field({ value: t.cost || '', pre: '$', post: '/mo', aria: 'Monthly cost of tool ' + (i + 1), onInput: function (v) { t.cost = v; changed(); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove tool ' + (i + 1), text: '×', onclick: function () { data.tools.splice(i, 1); changed(); draw(); } }),
        T.text({ value: t.job, placeholder: 'Its one job', aria: 'Job of tool ' + (i + 1), onInput: function (v) { t.job = v; changed(); } }),
        used,
      ]));
    });
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Add a tool', onclick: function () { data.tools.push({ id: uid(), name: '', cost: 0, job: '', used: true }); changed(); draw(); } }));
    return box;
  }

  function changed() { if (!demo) T.save(data); update(); }
  draw();
})();
