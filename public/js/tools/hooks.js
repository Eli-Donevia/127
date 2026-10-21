// Hook bank (lib/tools 'hooks'): 127's sixty hooks, captions and calls to action (state.content), and the member's
// stars, their own written version of a hook and the views a used hook got. The hook with the most views is the one
// thing lit in Pop. Copy works on the member's version when there is one, else on the template.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root, C = T.state.content || { hooks: [], captions: [], ctas: [] };

  var data = T.state.data || { stars: [], mine: {}, wins: {} }, demo = !T.state.canSave;
  if (demo) data = { stars: ['4', '12', '33'], mine: { 4: 'My first tutoring client came from a comment I left in a parents group.' }, wins: { 4: 2400, 12: 860 } };
  var filter = '', shelf = 'hooks';

  function best() {
    var top = null;
    Object.keys(data.wins).forEach(function (k) { if (data.wins[k] > 0 && (!top || data.wins[k] > data.wins[top])) top = k; });
    return top;
  }
  // [brackets] become slots, so the member sees what to fill.
  function slots(text) {
    var out = [], re = /\[([^\]]+)\]/g, at = 0, m;
    while ((m = re.exec(text))) { if (m.index > at) out.push(text.slice(at, m.index)); out.push(el('span', { class: 'hk-slot', text: m[1] })); at = re.lastIndex; }
    if (at < text.length) out.push(text.slice(at));
    return out;
  }
  function copy(text, btn) {
    var done = function () { var was = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = was; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }

  function draw() {
    root.innerHTML = '';
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example stars and views. Nothing is saved.' })]));
    var top = best(), written = Object.keys(data.mine).length;
    root.appendChild(el('section', { class: 'tl-sum' }, [
      el('div', { class: 'tl-hero' }, [el('span', { class: 'tl-k', text: top ? 'Your best hook so far' : 'Sixty hooks, ten ways in' }), el('b', { class: 'tl-hero-v hk-v', text: top ? T.count(data.wins[top]) + ' views' : '60' }), el('span', { class: 'tl-d', text: top ? C.hooks.filter(function (h) { return String(h.id) === top; }).map(function (h) { return data.mine[top] || h.text.replace(/\[|\]/g, ''); })[0] : 'Star the ones that fit, write them in your words, then log the views when you post one.' })]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Starred' }), el('b', { text: String(data.stars.length) }), el('span', { class: 'tl-d', text: 'to post next' })]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Written in your words' }), el('b', { text: String(written) }), el('span', { class: 'tl-d', text: written ? 'ready to copy' : 'Tap Write mine on any hook' })]),
    ]));
    var tabs = el('div', { class: 'cv-weeks', role: 'tablist', 'aria-label': 'Shelf' });
    [['hooks', 'Hooks'], ['captions', 'Captions'], ['ctas', 'Calls to action']].forEach(function (t) { tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': shelf === t[0] ? 'true' : 'false', class: 'cv-wk' + (shelf === t[0] ? ' on' : ''), text: t[1], onclick: function () { shelf = t[0]; draw(); } })); });
    root.appendChild(tabs);
    if (shelf === 'hooks') hooks(top); else other(shelf === 'captions' ? C.captions : C.ctas, shelf);
  }

  function hooks(top) {
    var types = [];
    C.hooks.forEach(function (h) { if (types.indexOf(h.type) < 0) types.push(h.type); });
    var chips = el('div', { class: 'hk-chips' });
    [['', 'All'], ['*', 'Starred'], ['mine', 'Written']].concat(types.map(function (t) { return [t, t]; })).forEach(function (c) {
      chips.appendChild(el('button', { type: 'button', class: 'cv-pick-c' + (filter === c[0] ? ' on' : ''), 'aria-pressed': filter === c[0] ? 'true' : 'false', text: c[1], onclick: function () { filter = c[0]; draw(); } }));
    });
    root.appendChild(chips);
    var grid = el('div', { class: 'hk-grid' });
    C.hooks.filter(function (h) {
      var k = String(h.id);
      return !filter || (filter === '*' ? data.stars.indexOf(k) >= 0 : filter === 'mine' ? !!data.mine[k] : h.type === filter);
    }).forEach(function (h) { grid.appendChild(card(h, String(h.id) === top)); });
    if (!grid.children.length) grid.appendChild(el('p', { class: 'tl-note', text: filter === '*' ? 'Nothing starred yet.' : 'Nothing written yet.' }));
    root.appendChild(grid);
  }

  function card(h, isTop) {
    var k = String(h.id), starred = data.stars.indexOf(k) >= 0, mine = data.mine[k];
    var c = el('article', { class: 'hk-card' + (isTop ? ' top' : '') });
    c.appendChild(el('div', { class: 'hk-top' }, [
      el('span', { class: 'hk-type', text: h.type + (h.pillar ? ' · ' + h.pillar : '') }),
      el('button', { type: 'button', class: 'hk-star' + (starred ? ' on' : ''), 'aria-pressed': starred ? 'true' : 'false', 'aria-label': starred ? 'Unstar' : 'Star', text: starred ? '★' : '☆', onclick: function () { if (starred) data.stars.splice(data.stars.indexOf(k), 1); else data.stars.push(k); changed(); draw(); } }),
    ]));
    c.appendChild(el('p', { class: 'hk-t' }, slots(h.text)));
    var mineP = el('p', { class: 'hk-mine', text: mine || '', hidden: !mine }), exP = el('p', { class: 'hk-ex', text: 'Like: ' + h.example, hidden: !!mine });
    c.appendChild(mineP);
    c.appendChild(exP);
    var box = el('textarea', { class: 'hk-write', rows: 3, maxlength: 300, 'aria-label': 'Your version of hook ' + k, hidden: true });
    box.value = mine || h.text;
    box.addEventListener('input', function () {
      if (box.value.trim() && box.value !== h.text) data.mine[k] = box.value; else delete data.mine[k];
      mineP.textContent = data.mine[k] || ''; mineP.hidden = !data.mine[k]; exP.hidden = !!data.mine[k];
      changed();
    });
    var cp = el('button', { type: 'button', class: 'tl-act', text: 'Copy', onclick: function () { copy(data.mine[k] || h.text, cp); } });
    var views = T.field({ label: 'Views when you posted it', int: true, value: data.wins[k] || '', aria: 'Views for hook ' + k, onInput: function (v) { if (v > 0) data.wins[k] = v; else delete data.wins[k]; changed(); } });
    views.classList.add('hk-views');
    c.appendChild(box);
    c.appendChild(el('div', { class: 'hk-acts' }, [el('button', { type: 'button', class: 'tl-act', text: mine ? 'Edit mine' : 'Write mine', onclick: function () { box.hidden = false; box.focus(); } }), cp]));
    if (starred || mine || data.wins[k]) c.appendChild(views);
    if (isTop) c.appendChild(el('span', { class: 'hk-best', text: 'Your best so far. Make three more like it.' }));
    return c;
  }

  function other(list, kind) {
    var grid = el('div', { class: 'hk-grid' });
    list.forEach(function (x) {
      var cp = el('button', { type: 'button', class: 'tl-act', text: 'Copy', onclick: function () { copy(x.text, cp); } });
      grid.appendChild(el('article', { class: 'hk-card' }, [el('span', { class: 'hk-type', text: kind === 'ctas' ? x.goal : x.type }), el('p', { class: 'hk-t pre' }, slots(x.text)), el('div', { class: 'hk-acts' }, [cp])]));
    });
    root.appendChild(grid);
  }

  function changed() { if (!demo) T.save(data); }
  draw();
})();
