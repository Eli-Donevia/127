// Checklists (lib/tools 'checklists'): the Store's four checklists (state.content, ids stable from the templates
// manifest) as tap-to-check lists with progress. The launch countdown dates each group from the member's launch
// day; the next group due is the one thing lit in Pop. Saves { done: { itemId: day }, launch }.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root, C = T.state.content || { lists: [] };
  var data = T.state.data || { done: {}, launch: null }, demo = !T.state.canSave;
  if (demo) {
    data = { done: {}, launch: T.addDays(T.iso(new Date()), 9) };
    C.lists[0].groups.slice(0, 2).forEach(function (g, gi) { g.items.forEach(function (i, k) { if (gi === 0 || k < 4) data.done[i.id] = T.iso(new Date()); }); });
  }
  var cur = (location.hash || '').slice(1);
  if (!C.lists.some(function (l) { return l.id === cur; })) cur = C.lists[0] && C.lists[0].id;

  var countOf = function (l) { var n = 0, d = 0; l.groups.forEach(function (g) { g.items.forEach(function (i) { n += 1; if (data.done[i.id]) d += 1; }); }); return { n: n, d: d }; };
  var dueOf = function (g) { return data.launch && g.due != null ? T.addDays(data.launch, g.due) : null; };

  function draw() {
    root.innerHTML = '';
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example progress. Nothing is saved.' })]));
    var tabs = el('div', { class: 'ck-tabs', role: 'tablist', 'aria-label': 'Checklists' });
    C.lists.forEach(function (l) {
      var c = countOf(l);
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': l.id === cur ? 'true' : 'false', class: 'ck-tab' + (l.id === cur ? ' on' : ''), onclick: function () { cur = l.id; try { history.replaceState(null, '', '#' + l.id); } catch (e) { /* ignore */ } draw(); } }, [
        el('span', { class: 'ck-tab-t', text: l.title }),
        el('span', { class: 'ck-tab-n', text: c.d + ' of ' + c.n }),
        el('span', { class: 'ck-tab-bar' }, [el('i', { style: 'width:' + (c.n ? (c.d / c.n) * 100 : 0) + '%' })]),
      ]));
    });
    root.appendChild(tabs);
    var l = C.lists.filter(function (x) { return x.id === cur; })[0];
    if (!l) return;
    var c = countOf(l), today = T.iso(new Date());
    var next = l.dated ? l.groups.filter(function (g) { return g.items.some(function (i) { return !data.done[i.id]; }); })[0] : null;
    var head = [el('span', { class: 'tl-k', text: l.summary }), el('b', { class: 'tl-hero-v', text: Math.round(c.n ? (c.d / c.n) * 100 : 0) + '%' }), el('span', { class: 'tl-d' + (c.d === c.n ? ' up' : ''), text: c.d === c.n ? 'All done.' : c.n - c.d + ' steps left' })];
    var side = [];
    if (l.dated) {
      var f = el('input', { type: 'date', class: 'tl-sel ck-date', value: data.launch || '', 'aria-label': 'Launch day' });
      f.addEventListener('change', function () { data.launch = f.value || null; changed(); draw(); });
      side.push(el('label', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Launch day' }), f, el('span', { class: 'tl-d', text: data.launch ? daysTo(data.launch) : 'Pick one about 14 days out' })]));
    }
    root.appendChild(el('section', { class: 'tl-sum ck-sum' + (side.length ? '' : ' one') }, [el('div', { class: 'tl-hero' }, head)].concat(side)));
    // Legal L92 HT7, word for word, on the list about taking money.
    if (l.id === 'money-setup-checklist') root.appendChild(el('p', { class: 'tl-est ck-legal', text: 'General steps, not legal or tax advice. Rules differ by state.' }));
    l.groups.forEach(function (g) {
      var due = dueOf(g), gc = g.items.filter(function (i) { return data.done[i.id]; }).length, isNext = next === g;
      var box = el('section', { class: 'ck-g' + (isNext ? ' next' : '') }, [el('div', { class: 'ck-gh' }, [
        el('h2', { class: 'ck-gt', text: g.title }),
        el('span', { class: 'ck-gn', text: (due ? (isNext ? 'Do by ' : 'By ') + T.day(due) + (due < today && gc < g.items.length ? ', late' : '') + ' · ' : '') + gc + '/' + g.items.length }),
      ])]);
      g.items.forEach(function (i) {
        var on = !!data.done[i.id];
        box.appendChild(el('button', { type: 'button', class: 'ck-i' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': on ? 'true' : 'false', onclick: function () { if (on) delete data.done[i.id]; else data.done[i.id] = T.iso(new Date()); changed(); draw(); } }, [
          el('span', { class: 'ck-box', 'aria-hidden': 'true' }),
          el('span', { class: 'ck-tx', text: i.text }),
        ]));
      });
      root.appendChild(box);
    });
  }
  function daysTo(d) {
    var n = Math.round((Date.parse(d + 'T12:00:00') - Date.parse(T.iso(new Date()) + 'T12:00:00')) / 864e5);
    return n > 1 ? n + ' days to go' : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Launched ' + -n + ' day' + (n === -1 ? '' : 's') + ' ago';
  }
  function changed() { if (!demo) T.save(data); }
  draw();
})();
