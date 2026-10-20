// Dashboards: drag a tile onto another to move it there, or use its arrows (keyboard and phones).
// The new order saves at once; the wide button cycles a tile through 1, 2 and 4 columns.
(function () {
  var grid = document.querySelector('[data-board]');
  if (!grid) return;
  var id = grid.getAttribute('data-board');
  var saved = document.querySelector('[data-saved]');
  var dragging = null;
  var tiles = function () { return Array.prototype.slice.call(grid.querySelectorAll('[data-tile]')); };
  function say(t) { if (saved) saved.textContent = t; }
  function post(path, body) {
    return fetch('/app/hq/boards/' + id + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); });
  }
  function saveOrder() {
    say('Saving…');
    post('/order', { order: tiles().map(function (t) { return t.getAttribute('data-tile'); }) })
      .then(function () { say('Saved.'); }, function () { say("Couldn't save the order. Reload and try again."); });
  }

  grid.addEventListener('dragstart', function (e) {
    var t = e.target.closest && e.target.closest('[data-tile]');
    if (!t) return;
    dragging = t;
    t.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', t.getAttribute('data-tile')); } catch (err) { /* old browsers */ }
  });
  grid.addEventListener('dragover', function (e) {
    var t = e.target.closest && e.target.closest('[data-tile]');
    if (!dragging || !t || t === dragging) return;
    e.preventDefault();
    tiles().forEach(function (x) { x.classList.toggle('over', x === t); });
  });
  grid.addEventListener('drop', function (e) {
    var t = e.target.closest && e.target.closest('[data-tile]');
    if (!dragging || !t || t === dragging) return;
    e.preventDefault();
    var list = tiles();
    if (list.indexOf(dragging) < list.indexOf(t)) t.after(dragging); else t.before(dragging);
    saveOrder();
  });
  grid.addEventListener('dragend', function () {
    if (dragging) dragging.classList.remove('dragging');
    tiles().forEach(function (x) { x.classList.remove('over'); });
    dragging = null;
  });

  grid.addEventListener('click', function (e) {
    var mv = e.target.closest('[data-move]');
    var sz = e.target.closest('[data-size]');
    var t = e.target.closest('[data-tile]');
    if (!t) return;
    if (mv) {
      var dir = Number(mv.getAttribute('data-move'));
      var list = tiles();
      var i = list.indexOf(t);
      var other = list[i + dir];
      if (!other) return;
      if (dir < 0) other.before(t); else other.after(t);
      mv.focus();
      saveOrder();
    } else if (sz) {
      var next = t.classList.contains('w4') ? 1 : t.classList.contains('w2') ? 4 : 2;
      t.classList.remove('w2', 'w4');
      if (next > 1) t.classList.add('w' + next);
      post('/tiles/' + t.getAttribute('data-tile') + '/size', { size: next }).then(function () { say('Saved.'); }, function () { say("Couldn't save that. Reload and try again."); });
    }
  });
})();
