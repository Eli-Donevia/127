// Connections gallery: find an app by name, and show all, connected or ready-now ones.
(function () {
  var root = document.getElementById('apps');
  if (!root) return;
  var search = root.querySelector('[data-ap-search]');
  var mode = 'all';
  function apply() {
    var q = (search.value || '').trim().toLowerCase();
    root.querySelectorAll('[data-ap-cat]').forEach(function (cat) {
      var shown = 0;
      cat.querySelectorAll('.ap-tile').forEach(function (t) {
        var ok = (!q || t.getAttribute('data-name').indexOf(q) !== -1) && (mode === 'all' || t.getAttribute('data-status') === mode);
        t.hidden = !ok;
        if (ok) shown += 1;
      });
      cat.hidden = !shown;
    });
  }
  search.addEventListener('input', apply);
  root.querySelectorAll('[data-ap-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-ap-filter');
      root.querySelectorAll('[data-ap-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      apply();
    });
  });
})();
