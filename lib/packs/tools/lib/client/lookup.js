// Searchable lookup from a spreadsheet: type to filter, pick a column to search in, tap a row to
// copy it. The data lives inside the file, so it works with no connection.
/* eslint-disable no-var */
function norm(s) {
  var t = String(s == null ? '' : s).toLowerCase();
  return t.normalize ? t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : t;
}

// Every word in the query must appear (in the chosen column, or anywhere in the row).
function searchRows(rows, q, col) {
  var words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return rows.map(function (r, i) { return i; });
  var out = [];
  rows.forEach(function (r, i) {
    var hay = norm(col >= 0 ? r[col] : r.join(' \u0001 '));
    if (words.every(function (w) { return hay.indexOf(w) >= 0; })) out.push(i);
  });
  return out;
}

if (typeof document !== 'undefined') {
  (function () {
    var cols = C.columns || [];
    var rows = C.rows || [];
    var shown = 50;
    var hits = [];
    var q = $('#q');
    var col = $('#col');
    function draw() {
      $('#count').textContent = hits.length + ' of ' + rows.length + (rows.length === 1 ? ' row' : ' rows');
      $('#body').innerHTML = hits.slice(0, shown).map(function (i) {
        return '<tr data-row="' + i + '">' + rows[i].map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('') || '<tr><td colspan="' + cols.length + '" class="muted">Nothing matches. Try fewer words.</td></tr>';
      $('#more').style.display = hits.length > shown ? '' : 'none';
    }
    function run() {
      hits = searchRows(rows, q.value, num(col.value, -1));
      shown = 50;
      store.set('last', { q: q.value, col: col.value });
      draw();
    }
    var last = store.get('last', null);
    if (last) { q.value = last.q || ''; col.value = last.col || '-1'; }
    q.addEventListener('input', run);
    col.addEventListener('change', run);
    $('#more').addEventListener('click', function () { shown += 100; draw(); });
    $('#body').addEventListener('click', function (e) {
      var tr = e.target.closest && e.target.closest('tr[data-row]');
      if (!tr) return;
      var r = rows[num(tr.getAttribute('data-row'))];
      copyText(cols.map(function (c, i) { return c + ': ' + (r[i] == null ? '' : r[i]); }).join('\n'));
    });
    $('#search').addEventListener('submit', function (e) { e.preventDefault(); });
    run();
  })();
}
