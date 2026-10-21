// Content calendar (lib/tools 'content'): three pillars, the weekdays the member posts, and four weeks of dated days
// from a Monday. Each post day holds a pillar, a hook and where it stands (idea, ready, posted, then its views).
// The next post not yet out is the one thing lit in Pop. Saves { pillars, platform, days, start, posts }.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var STATES = [['idea', 'Idea'], ['ready', 'Ready'], ['posted', 'Posted']];
  var LEN = 28;

  function example() {
    var start = T.monday(), posts = {}, hooks = ['The mistake almost every parent makes with fractions', 'Here is what my week of tutoring really looks like', 'Three things I wish I knew before 8th grade math', 'How one student went from a C to a B in a month', 'Everyone says flashcards. Here is why I stopped.', 'Day 1 of filming a full week of tips'];
    [0, 2, 4, 7, 9, 11].forEach(function (d, i) { posts[T.addDays(start, d)] = { pillar: i % 3, hook: hooks[i], state: d < 4 ? 'posted' : d < 9 ? 'ready' : 'idea', views: d === 0 ? 1840 : d === 2 ? 620 : 0 }; });
    return { pillars: ['Quick math tips', 'Behind the scenes', 'Student wins'], platform: 'Instagram Reels', days: [0, 2, 4], start: start, posts: posts };
  }
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = example(); demo = true; }

  var today = T.iso(new Date());
  function planned() {
    var out = [];
    for (var i = 0; i < LEN; i += 1) { var d = T.addDays(data.start, i); if (data.days.indexOf(i % 7) >= 0 || data.posts[d]) out.push(d); }
    return out;
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Pick three things you will talk about, and the days you post.' }),
      el('p', { class: 'tl-start-s', text: 'Then four weeks lay out, one hook a post day. Film them in one batch day.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Plan my month', onclick: function () { data = { pillars: ['', '', ''], platform: '', days: [0, 2, 4], start: T.monday(), posts: {} }; draw(); var f = root.querySelector('.tl-tx'); if (f) f.focus(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See it with an example month first', onclick: function () { data = example(); demo = true; draw(); } }),
      ]),
    ]));
    if (!data.start) data.start = T.monday();
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example month. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    if (data.start < T.addDays(T.monday(), -21) && !demo) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'This month started ' + T.day(data.start) + '.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start a new month from this week', onclick: function () { data.start = T.monday(); changed(); draw(); } })]));
    nodes.sum = el('section', { class: 'tl-sum' });
    root.appendChild(nodes.sum);
    root.appendChild(el('div', { class: 'ct-grid' }, [setup(), board()]));
    update();
  }

  function setup() {
    var box = el('section', { class: 'tl-panel ct-setup' }, [el('h2', { class: 'tl-h', text: 'Your pillars' })]);
    data.pillars.forEach(function (p, i) {
      box.appendChild(el('div', { class: 'ct-pl' }, [el('i', { class: 'ct-dot p' + i, 'aria-hidden': 'true' }), T.text({ value: p, max: 40, placeholder: ['What you teach', 'Your story', 'Proof and results'][i], aria: 'Pillar ' + (i + 1), onInput: function (v) { data.pillars[i] = v; changed(); Array.prototype.forEach.call(root.querySelectorAll('[data-pill="' + i + '"]'), function (b) { b.textContent = v || 'Pillar ' + (i + 1); }); } })]));
    });
    box.appendChild(el('label', { class: 'tl-f ct-plat' }, [el('span', { class: 'tl-f-l', text: 'Where you post' }), T.text({ value: data.platform, max: 30, placeholder: 'Instagram Reels', onInput: function (v) { data.platform = v; changed(); } })]));
    var days = el('div', { class: 'ct-days', role: 'group', 'aria-label': 'Post days' });
    DOW.forEach(function (d, i) {
      var on = data.days.indexOf(i) >= 0;
      days.appendChild(el('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: on ? 'on' : '', text: d, onclick: function () { if (on) data.days.splice(data.days.indexOf(i), 1); else data.days.push(i); data.days.sort(); changed(); draw(); } }));
    });
    box.appendChild(el('span', { class: 'tl-f-l ct-dl', text: 'Days you post' }));
    box.appendChild(days);
    box.appendChild(el('p', { class: 'tl-note', text: data.days.length + ' a week is ' + data.days.length * 4 + ' posts this month. Pick a pace you can keep for a year.' }));
    box.appendChild(el('a', { class: 'link ct-batch', href: '/app/hq/tools/checklists#batch-day', text: 'Film a week at once: the Batch day checklist' }));
    return box;
  }

  function board() {
    var box = el('section', { class: 'ct-board', 'aria-label': 'Four weeks' });
    for (var w = 0; w < 4; w += 1) {
      var week = el('div', { class: 'ct-week' }, [el('span', { class: 'tl-h ct-wh', text: 'Week of ' + T.day(T.addDays(data.start, w * 7)) })]);
      var cells = el('div', { class: 'ct-cells' });
      for (var d = 0; d < 7; d += 1) {
        var date = T.addDays(data.start, w * 7 + d), isDay = data.days.indexOf(d) >= 0 || !!data.posts[date];
        cells.appendChild(isDay ? post(date) : el('div', { class: 'ct-off', 'aria-hidden': 'true' }, [el('span', { text: DOW[d] + ' ' + (+date.slice(8)) })]));
      }
      week.appendChild(cells);
      box.appendChild(week);
    }
    return box;
  }

  function post(date) {
    var p = data.posts[date] || { pillar: (planned().indexOf(date) + 3) % 3, hook: '', state: 'idea', views: 0 };
    var ensure = function () { if (!data.posts[date]) data.posts[date] = p; };
    var pill = el('button', { type: 'button', class: 'ct-pill p' + p.pillar, 'data-pill': p.pillar, text: data.pillars[p.pillar] || 'Pillar ' + (p.pillar + 1), 'aria-label': 'Pillar, tap to change', onclick: function () { ensure(); p.pillar = (p.pillar + 1) % 3; pill.className = 'ct-pill p' + p.pillar; pill.setAttribute('data-pill', p.pillar); pill.textContent = data.pillars[p.pillar] || 'Pillar ' + (p.pillar + 1); changed(); } });
    var hook = el('textarea', { class: 'ct-hook', rows: 2, maxlength: 200, placeholder: 'Hook', 'aria-label': 'Hook for ' + T.day(date) });
    hook.value = p.hook;
    hook.addEventListener('input', function () { ensure(); p.hook = hook.value; changed(); });
    var st = el('div', { class: 'ct-st', role: 'radiogroup', 'aria-label': 'Where it stands' });
    var views = T.field({ value: p.views || '', int: true, post: 'views', aria: 'Views for ' + T.day(date), onInput: function (v) { ensure(); p.views = v; changed(); } });
    views.hidden = p.state !== 'posted';
    STATES.forEach(function (s) {
      st.appendChild(el('button', { type: 'button', role: 'radio', 'aria-checked': p.state === s[0] ? 'true' : 'false', class: p.state === s[0] ? 'on ' + s[0] : '', text: s[1], onclick: function () {
        ensure(); p.state = s[0]; views.hidden = p.state !== 'posted';
        Array.prototype.forEach.call(st.children, function (b, i) { var on = STATES[i][0] === p.state; b.className = on ? 'on ' + p.state : ''; b.setAttribute('aria-checked', on ? 'true' : 'false'); });
        changed();
      } }));
    });
    var dd = new Date(date + 'T12:00:00');
    return el('article', { class: 'ct-post' + (date < today ? ' past' : ''), 'data-date': date }, [
      el('div', { class: 'ct-ph' }, [el('span', { class: 'ct-date', text: DOW[(dd.getDay() + 6) % 7] + ' ' + dd.getDate() }), pill]),
      hook, st, views,
    ]);
  }

  function update() {
    var list = planned(), posted = list.filter(function (d) { return data.posts[d] && data.posts[d].state === 'posted'; });
    var next = list.filter(function (d) { return d >= today && !(data.posts[d] && data.posts[d].state === 'posted'); })[0];
    var best = posted.slice().sort(function (a, b) { return (data.posts[b].views || 0) - (data.posts[a].views || 0); })[0];
    var np = next && data.posts[next];
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: next ? 'Next post: ' + T.day(next) + (data.platform ? ' on ' + data.platform : '') : 'Month planned' }),
      el('b', { class: 'tl-hero-v', text: posted.length + '/' + list.length }),
      el('span', { class: 'tl-d', text: next ? (np && np.hook ? np.hook : 'No hook yet. Pull one from your Hook bank.') : 'Every post day is out. Plan the next month.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Ready to post' }), el('b', { text: String(list.filter(function (d) { return data.posts[d] && data.posts[d].state === 'ready'; }).length) }), el('span', { class: 'tl-d', text: 'filmed and waiting' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Best post so far' }), el('b', { text: best && data.posts[best].views ? T.count(data.posts[best].views) : '–' }), el('span', { class: 'tl-d', text: best && data.posts[best].views ? data.pillars[data.posts[best].pillar] || 'views' : 'Log views on posted ones' })]));
    Array.prototype.forEach.call(root.querySelectorAll('.ct-post'), function (c) { c.classList.toggle('lead', c.getAttribute('data-date') === next); });
  }

  function changed() { if (!demo) T.save(data); update(); }
  draw();
})();
