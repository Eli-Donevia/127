// Client portal page: mostly a static page (status, next visit, links, answers). The client's own
// to-do list ticks are kept in their browser only.
/* eslint-disable no-var */
function todoProgress(ids, checks) {
  var done = ids.filter(function (id) { return !!(checks || {})[id]; }).length;
  return { done: done, total: ids.length };
}

if (typeof document !== 'undefined') {
  (function () {
    var checks = store.get('todos', {});
    var boxes = $$('.todo');
    function draw() {
      boxes.forEach(function (b) { b.checked = !!checks[b.value]; });
      var p = todoProgress(boxes.map(function (b) { return b.value; }), checks);
      if ($('#todocount')) $('#todocount').textContent = p.total ? p.done + ' of ' + p.total + ' done' : '';
    }
    boxes.forEach(function (b) {
      b.addEventListener('change', function () { checks[b.value] = b.checked; store.set('todos', checks); draw(); });
    });
    if ($('#print')) $('#print').addEventListener('click', function () { window.print(); });
    draw();
  })();
}
