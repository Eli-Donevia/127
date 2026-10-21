// Idea scorecard (lib/tools 'ideas'): up to eight ideas scored 0 to 10 on the Idea Test's five questions
// (lib/idea-test.js), ranked as the member scores. The leader is the one thing lit in Tide. Verdict bands match the
// Idea Test's 75 and 50 lines, worded as what the answers say, not what will happen (Legal L92 HT3).
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var Q = [
    ['pain', 'Will they pay', 'People already pay to solve this, or there are workarounds and competitors.'],
    ['economics', 'Numbers and channel', 'Price beats the cost to deliver and to win a customer, and you know where buyers are.'],
    ['edge', 'Edge', 'Faster, cheaper, better or a story a buyer would notice.'],
    ['future', 'Market direction', 'Growing, and AI makes it easier for you, not for everyone.'],
    ['inside', 'Inside knowledge', 'You lived this problem, worked in it, or know someone who does.'],
  ];
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var one = function (name, s) { var o = { id: uid(), name: name, note: '', scores: {} }; Q.forEach(function (q, i) { o.scores[q[0]] = s ? s[i] : 5; }); return o; };
  var EXAMPLE = { ideas: [one('Math tutoring for 8th graders', [8, 7, 6, 6, 8]), one('Sneaker cleaning pickup', [6, 5, 7, 6, 4]), one('AI resume rewrites', [5, 6, 3, 3, 5])] };
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; }

  var total = function (x) { return Q.reduce(function (n, q) { return n + (x.scores[q[0]] || 0); }, 0); };
  var band = function (p) { return p >= 75 ? 'Strong answers' : p >= 50 ? 'Mixed answers' : 'Weak answers'; };
  var weakest = function (x) { return Q.reduce(function (m, q) { return x.scores[q[0]] < x.scores[m[0]] ? q : m; }, Q[0]); };

  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Write down every idea you keep coming back to.' }),
      el('p', { class: 'tl-start-s', text: 'Score each one honestly on five questions. Most first ideas land between 35 and 70.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Add my first idea', onclick: function () { data = { ideas: [one('')] }; draw(); var f = root.querySelector('.id-name'); if (f) f.focus(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See it with example ideas first', onclick: function () { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example ideas. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    var ranked = data.ideas.slice().sort(function (a, b) { return total(b) - total(a); });
    var lead = ranked[0], lp = lead ? Math.round((total(lead) / 50) * 100) : 0;
    root.appendChild(el('section', { class: 'tl-sum' }, [
      el('div', { class: 'tl-hero' }, [el('span', { class: 'tl-k', text: lead && lead.name ? 'Your top score: ' + lead.name : 'Your top score' }), el('b', { class: 'tl-hero-v', text: lead ? lp + '%' : '–' }), el('span', { class: 'tl-d' + (lp >= 75 ? ' up' : ''), text: lead ? band(lp) + '. Its weakest answer is ' + weakest(lead)[1].toLowerCase() + ': check that first.' : '' })]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Ideas on the board' }), el('b', { text: String(data.ideas.length) }), el('span', { class: 'tl-d', text: 'up to eight' })]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Gap to the next one' }), el('b', { text: ranked[1] ? (total(lead) - total(ranked[1])) * 2 + ' pts' : '–' }), el('span', { class: 'tl-d', text: ranked[1] ? (total(lead) === total(ranked[1]) ? 'A tie. Talk to five buyers of each.' : 'ahead of ' + (ranked[1].name || 'the next idea')) : 'Add a second idea to compare' })]),
      el('p', { class: 'tl-note id-from', text: 'Scores come from your own answers. They don’t predict how an idea will do.' }),
    ]));
    var list = el('div', { class: 'id-list' });
    ranked.forEach(function (x, r) { list.appendChild(row(x, r, x === lead && data.ideas.length > 1)); });
    root.appendChild(list);
    if (data.ideas.length < 8) root.appendChild(el('button', { type: 'button', class: 'tl-act id-add', text: 'Add an idea', onclick: function () { data.ideas.push(one('')); changed(); draw(); var all = root.querySelectorAll('.id-name'); all[all.length - 1].focus(); } }));
    if (T.state.prompts) root.appendChild(el('p', { class: 'tl-note' }, ['Want a second opinion on the leader? ', el('a', { class: 'link', href: '/app/hq/prompts/start.idea_test', text: 'Run the Idea Test prompt' }), '.']));
  }

  function row(x, rank, lit) {
    var p = Math.round((total(x) / 50) * 100);
    var head = el('div', { class: 'id-head' }, [
      el('span', { class: 'id-i', text: String(rank + 1).padStart(2, '0') }),
      (function () { var t = T.text({ value: x.name, max: 80, placeholder: 'Name the idea', aria: 'Idea name', onInput: function (v) { x.name = v; changed(); } }); t.classList.add('id-name'); return t; })(),
      el('span', { class: 'id-p', text: p + '%' }),
      el('span', { class: 'id-b', text: band(p) }),
      el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove ' + (x.name || 'this idea'), text: '×', onclick: function () { data.ideas.splice(data.ideas.indexOf(x), 1); changed(); draw(); } }),
    ]);
    var qs = el('div', { class: 'id-qs' });
    Q.forEach(function (q) {
      var r = el('input', { type: 'range', min: 0, max: 10, step: 1, value: x.scores[q[0]], class: 'id-r', 'aria-label': q[1] + ' for ' + (x.name || 'this idea') });
      var v = el('b', { text: String(x.scores[q[0]]) });
      r.addEventListener('input', function () { x.scores[q[0]] = +r.value; v.textContent = r.value; changed(); });
      r.addEventListener('change', function () { draw(); });
      qs.appendChild(el('label', { class: 'id-q', title: q[2] }, [el('span', { class: 'tl-f-l', text: q[1] }), el('span', { class: 'id-qv' }, [r, v])]));
    });
    return el('article', { class: 'id-row' + (lit ? ' lead' : '') }, [head, el('div', { class: 'id-bar' }, [el('i', { style: 'width:' + p + '%' })]), qs]);
  }

  function changed() { if (!demo) T.save(data); }
  draw();
})();
