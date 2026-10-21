// Life · Workout planner (lib/life): a week of workouts from the bundled exercise list (public/life/exercises.json,
// Free Exercise DB, public domain). The member picks a goal, days, time, equipment and level; each day is a split
// (full body, upper/lower, push/pull/legs) whose slots are filled with matching exercises, compound moves first.
// Swap replaces one exercise; Shuffle redraws the week. Only the choices and swaps are kept, in the member's browser.
// Data: { goal, days, minutes, level, equip: [...], seed, swaps: { 'day:slot': n } }.
(function () {
  'use strict';
  var L = window.Life, el = L.el;
  var EQUIP = [['body only', 'Bodyweight'], ['dumbbell', 'Dumbbells'], ['barbell', 'Barbell'], ['kettlebells', 'Kettlebells'], ['bands', 'Bands'], ['cable', 'Cable'], ['machine', 'Machines']];
  var GOALS = [['strength', 'Get stronger'], ['muscle', 'Build muscle'], ['fit', 'Get fit']];
  var SPLITS = {
    fullA: ['Full body A', ['quadriceps', 'chest', 'middle back|lats', 'shoulders', 'hamstrings', 'abdominals']],
    fullB: ['Full body B', ['hamstrings|glutes', 'shoulders', 'lats', 'chest', 'quadriceps', 'abdominals']],
    fullC: ['Full body C', ['quadriceps', 'middle back', 'chest', 'glutes', 'triceps', 'biceps']],
    upper: ['Upper body', ['chest', 'lats', 'shoulders', 'middle back', 'triceps', 'biceps']],
    lower: ['Lower body', ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lower back']],
    push: ['Push', ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps']],
    pull: ['Pull', ['lats', 'middle back', 'lats', 'biceps', 'traps', 'forearms']],
    legs: ['Legs', ['quadriceps', 'hamstrings', 'glutes', 'quadriceps', 'calves', 'abdominals']],
  };
  var WEEK = { 2: ['fullA', 'fullB'], 3: ['fullA', 'fullB', 'fullC'], 4: ['upper', 'lower', 'upper', 'lower'], 5: ['push', 'pull', 'legs', 'upper', 'lower'] };
  var SLOTS = { 30: 4, 45: 5, 60: 6 };
  var DEFAULT = { goal: 'muscle', days: 3, minutes: 45, level: 'beginner', equip: ['body only', 'dumbbell'], seed: 1, swaps: {} };

  var d = null, all = null, pick = 0;

  function clean(x) {
    x = x || {};
    var eq = (Array.isArray(x.equip) ? x.equip : []).filter(function (e) { return EQUIP.some(function (q) { return q[0] === e; }); });
    var swaps = {};
    if (x.swaps && typeof x.swaps === 'object') Object.keys(x.swaps).slice(0, 60).forEach(function (k) { if (/^\d:\d$/.test(k)) swaps[k] = Math.max(0, Math.min(999, Math.floor(L.num(x.swaps[k])))); });
    return {
      goal: GOALS.some(function (g) { return g[0] === x.goal; }) ? x.goal : DEFAULT.goal,
      days: WEEK[x.days] ? +x.days : DEFAULT.days,
      minutes: SLOTS[x.minutes] ? +x.minutes : DEFAULT.minutes,
      level: x.level === 'intermediate' ? 'intermediate' : 'beginner',
      equip: eq.length ? eq : DEFAULT.equip.slice(),
      seed: Math.max(1, Math.floor(L.num(x.seed)) || 1),
      swaps: swaps,
    };
  }

  // A stable shuffle order: the same seed and name always sort the same way.
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function pool(muscles, cats) {
    var eq = d.equip.concat('body only'), lv = d.level === 'beginner' ? ['beginner'] : ['beginner', 'intermediate'];
    var want = muscles.split('|');
    return all.filter(function (x) {
      return cats.indexOf(x.category) >= 0 && eq.indexOf(x.equipment) >= 0 && lv.indexOf(x.level) >= 0 && x.primary.some(function (p) { return want.indexOf(p) >= 0; });
    });
  }

  function dose(i, n) {
    if (d.goal === 'strength') return i < 2 ? ['4 × 5', 'Rest 2 to 3 min'] : ['3 × 8', 'Rest 90 s'];
    if (d.goal === 'muscle') return i < 2 ? ['3 × 8 to 12', 'Rest 90 s'] : ['3 × 12 to 15', 'Rest 60 s'];
    return i === n - 1 ? ['4 rounds', '30 s on, 30 s off'] : ['3 × 12', 'Rest 45 s'];
  }

  function plan() {
    var keys = WEEK[d.days], n = SLOTS[d.minutes];
    var usedWeek = {};
    return keys.map(function (k, di) {
      var split = SPLITS[k], slots = split[1].slice(0, n), used = {};
      if (d.goal === 'fit') slots[n - 1] = 'quadriceps|hamstrings|glutes|abdominals|calves|shoulders';
      var moves = slots.map(function (mus, si) {
        var cats = d.goal === 'fit' && si === n - 1 ? ['plyometrics', 'cardio'] : ['strength', 'powerlifting'];
        var list = pool(mus, cats).sort(function (a, b) {
          // Compound lifts lead the day; after that, the seed decides.
          var ca = si < 2 && a.mechanic === 'compound' ? 0 : 1, cb = si < 2 && b.mechanic === 'compound' ? 0 : 1;
          return ca - cb || hash(d.seed + a.id) - hash(d.seed + b.id);
        });
        if (!list.length) return { mus: mus, ex: null, dose: dose(si, n), key: di + ':' + si };
        var start = (d.swaps[di + ':' + si] || 0) + di;
        for (var t = 0; t < list.length; t++) {
          var ex = list[(start + t) % list.length];
          if (!used[ex.id] && (!usedWeek[ex.id] || t === list.length - 1)) { used[ex.id] = 1; usedWeek[ex.id] = 1; return { mus: mus, ex: ex, dose: dose(si, n), key: di + ':' + si, count: list.length }; }
        }
        return { mus: mus, ex: list[start % list.length], dose: dose(si, n), key: di + ':' + si, count: list.length };
      });
      var warm = all.filter(function (x) { return x.category === 'stretching' && x.level === 'beginner' && moves[0].ex && x.primary.some(function (p) { return moves[0].ex.primary.indexOf(p) >= 0; }); })
        .sort(function (a, b) { return (/stretch/i.test(b.name) - /stretch/i.test(a.name)) || hash(d.seed + a.id) - hash(d.seed + b.id); })[0] || null;
      return { title: split[0], moves: moves, warm: warm };
    });
  }

  function commit(reset) { if (reset) d.swaps = {}; L.save(d); draw(); }

  function setup() {
    return el('section', { class: 'lf-panel tr-set' }, [
      el('h2', { class: 'lf-h', text: 'Your week' }),
      el('div', { class: 'tr-set-g' }, [
        el('div', null, [el('span', { class: 'lf-f-l', text: 'Goal' }), L.choice({ label: 'Goal', options: GOALS, value: d.goal, onPick: function (v) { d.goal = v; commit(true); } })]),
        el('div', null, [el('span', { class: 'lf-f-l', text: 'Days a week' }), L.choice({ label: 'Days a week', options: [2, 3, 4, 5], value: d.days, onPick: function (v) { d.days = v; pick = 0; commit(true); } })]),
        el('div', null, [el('span', { class: 'lf-f-l', text: 'Minutes a session' }), L.choice({ label: 'Minutes a session', options: [30, 45, 60], value: d.minutes, onPick: function (v) { d.minutes = v; commit(true); } })]),
        el('div', null, [el('span', { class: 'lf-f-l', text: 'Experience' }), L.choice({ label: 'Experience', options: [['beginner', 'New to it'], ['intermediate', 'Been training a while']], value: d.level, onPick: function (v) { d.level = v; commit(true); } })]),
      ]),
      el('div', null, [el('span', { class: 'lf-f-l', text: 'What you have' }), L.choice({ label: 'Equipment', multi: true, options: EQUIP, value: d.equip, onPick: function (v) {
        var i = d.equip.indexOf(v);
        if (i >= 0) { if (d.equip.length > 1) d.equip.splice(i, 1); } else d.equip.push(v);
        commit(true);
      } })]),
    ]);
  }

  function move(m, i) {
    if (!m.ex) return el('li', { class: 'tr-move is-empty' }, [el('span', { class: 'tr-i', text: String(i + 1) }), el('span', { class: 'tr-n', text: 'Nothing for ' + m.mus.split('|').join(' or ') + ' with this equipment. Add some above.' })]);
    var ex = m.ex;
    return el('li', { class: 'tr-move' }, [
      el('span', { class: 'tr-i', text: String(i + 1) }),
      el('div', { class: 'tr-body' }, [
        el('span', { class: 'tr-n', text: ex.name }),
        el('span', { class: 'tr-meta', text: ex.primary.join(', ') + ' · ' + (ex.equipment === 'body only' ? 'bodyweight' : ex.equipment) }),
        ex.steps.length ? el('details', { class: 'tr-how' }, [el('summary', { text: 'How to do it' }), el('ol', null, ex.steps.map(function (s) { return el('li', { text: s }); }))]) : null,
      ]),
      el('div', { class: 'tr-dose' }, [el('b', { text: m.dose[0] }), el('span', { text: m.dose[1] })]),
      el('button', { type: 'button', class: 'lf-act sm', text: 'Swap', disabled: m.count > 1 ? null : true, 'aria-label': 'Swap ' + ex.name, onclick: function () { d.swaps[m.key] = (d.swaps[m.key] || 0) + 1; commit(); } }),
    ]);
  }

  function draw() {
    var root = L.root;
    root.innerHTML = '';
    root.appendChild(setup());
    if (!all) { root.appendChild(el('p', { class: 'lf-note-s', text: 'Loading the exercise list…' })); return; }
    var week = plan();
    if (pick >= week.length) pick = 0;
    root.appendChild(el('div', { class: 'tr-days', role: 'tablist', 'aria-label': 'Days' }, week.map(function (w, i) {
      return el('button', { type: 'button', role: 'tab', class: i === pick ? 'on' : '', 'aria-selected': i === pick ? 'true' : 'false', onclick: function () { pick = i; draw(); } }, [el('span', { text: 'Day ' + (i + 1) }), el('b', { text: w.title })]);
    })));
    var w = week[pick];
    root.appendChild(el('section', { class: 'lf-panel tr-day', role: 'tabpanel' }, [
      w.warm ? el('p', { class: 'tr-warm' }, [el('span', { class: 'lf-k', text: 'Warm up' }), el('span', { text: w.warm.name + ', 2 easy rounds, then a light first set of exercise 1.' })]) : null,
      el('ol', { class: 'tr-list' }, w.moves.map(move)),
      el('div', { class: 'tr-foot' }, [
        el('span', { class: 'lf-note-s', text: d.goal === 'fit' ? 'Move steadily between exercises. Finish with the last one as rounds.' : 'Pick a weight that leaves one or two good reps in the tank. Add a little when every set feels easy.' }),
        el('button', { type: 'button', class: 'lf-act', text: 'Shuffle the week', onclick: function () { d.seed += 1; commit(true); } }),
      ]),
    ]));
  }

  d = clean(L.state.keep ? L.load() : null);
  L.current = function () { return d; };
  L.onData = function (x) { d = clean(x); pick = 0; draw(); };
  draw();
  fetch('/life/exercises.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { all = j.exercises || []; draw(); })
    .catch(function () { L.say('Couldn\'t load the exercise list. Check your connection and reload.', 'bad'); });
})();
