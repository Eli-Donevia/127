// Stock counter: tap plus or minus as things come in and go out, see what's low, copy a reorder
// list and download the counts as a CSV. Counts stay in this browser.
/* eslint-disable no-var */
function applyDelta(items, i, d) {
  return items.map(function (it, j) { return j === i ? Object.assign({}, it, { count: Math.max(0, num(it.count) + num(d)) }) : it; });
}

function isLow(it) {
  return num(it.low) > 0 && num(it.count) <= num(it.low);
}

function reorderList(items) {
  return items.filter(isLow).map(function (it) {
    var want = Math.max(num(it.par) || num(it.low) * 2, num(it.low) + 1);
    return { name: it.name, count: num(it.count), order: Math.max(0, want - num(it.count)), unit: it.unit || '' };
  });
}

if (typeof document !== 'undefined') {
  (function () {
    var items = store.get('items', null) || (C.items || []).map(function (x) { return Object.assign({}, x); });
    function save() { store.set('items', items); store.set('counted', todayStr()); }
    function draw() {
      $('#rows').innerHTML = items.map(function (it, i) {
        return '<tr><td><b>' + esc(it.name) + '</b>' + (it.unit ? '<div class="muted small">' + esc(it.unit) + '</div>' : '') + (isLow(it) ? ' <span class="pill low">Low</span>' : '') + '</td>' +
          '<td><div class="row" style="flex-wrap:nowrap"><button class="btn icon" type="button" data-i="' + i + '" data-d="-1" aria-label="One less">-</button>' +
          '<input inputmode="numeric" style="width:72px;text-align:center" data-count="' + i + '" value="' + esc(it.count) + '" aria-label="Count of ' + esc(it.name) + '">' +
          '<button class="btn icon" type="button" data-i="' + i + '" data-d="1" aria-label="One more">+</button></div></td>' +
          '<td><input inputmode="numeric" style="width:64px" data-low="' + i + '" value="' + esc(it.low) + '" aria-label="Low level for ' + esc(it.name) + '"></td></tr>';
      }).join('');
      var low = reorderList(items);
      $('#lowcount').textContent = low.length ? low.length + ' low' : 'Nothing low';
      $('#counted').textContent = store.get('counted', '') ? 'Last change ' + store.get('counted', '') : '';
    }
    $('#rows').addEventListener('click', function (e) {
      var i = e.target.getAttribute('data-i');
      if (i == null) return;
      items = applyDelta(items, num(i), num(e.target.getAttribute('data-d')));
      save();
      draw();
    });
    $('#rows').addEventListener('change', function (e) {
      var c = e.target.getAttribute('data-count');
      var l = e.target.getAttribute('data-low');
      if (c != null) items[num(c)].count = Math.max(0, num(e.target.value));
      if (l != null) items[num(l)].low = Math.max(0, num(e.target.value));
      save();
      draw();
    });
    $('#addform').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#newitem').value.trim();
      if (!name) return toast('Type the item name');
      items.push({ name: name, count: num($('#newcount').value), low: num($('#newlow').value), unit: '' });
      $('#newitem').value = '';
      $('#newcount').value = '';
      save();
      draw();
    });
    $('#reorder').addEventListener('click', function () {
      var low = reorderList(items);
      if (!low.length) return toast('Nothing is low right now');
      copyText(['Reorder list ' + todayStr() + (C.business ? ' for ' + C.business : '')].concat(low.map(function (x) { return x.name + ': order ' + x.order + (x.unit ? ' ' + x.unit : '') + ' (have ' + x.count + ')'; })).join('\n'));
    });
    $('#export').addEventListener('click', function () {
      download((C.key || 'stock') + '-' + todayStr() + '.csv', toCsv(items.map(function (it) { return { name: it.name, count: it.count, low: it.low, unit: it.unit || '', status: isLow(it) ? 'low' : '' }; }), [{ key: 'name', label: 'Item' }, { key: 'count', label: 'Count' }, { key: 'low', label: 'Low at' }, { key: 'unit', label: 'Unit' }, { key: 'status', label: 'Status' }]));
    });
    $('#reset').addEventListener('click', function () {
      if (!window.confirm('Put every count back to the starting list?')) return;
      items = (C.items || []).map(function (x) { return Object.assign({}, x); });
      save();
      draw();
    });
    draw();
  })();
}
