// Client intake checklist: one checklist per client, ticked off as you go, kept in this browser.
// Export every client's progress as a CSV.
/* eslint-disable no-var */
function progressOf(itemIds, checks) {
  var done = itemIds.filter(function (id) { return !!(checks || {})[id]; }).length;
  var total = itemIds.length;
  return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function intakeRows(clients, items) {
  return Object.keys(clients || {}).sort().map(function (name) {
    var c = clients[name] || {};
    var row = { client: name, started: c.started || '', progress: progressOf(items.map(function (i) { return i.id; }), c.checks).pct + '%' };
    items.forEach(function (i) { row[i.id] = c.checks && c.checks[i.id] ? 'yes' : ''; });
    row.notes = c.notes || '';
    return row;
  });
}

if (typeof document !== 'undefined') {
  (function () {
    var items = $$('.item').map(function (el) { return { id: el.value, label: el.getAttribute('data-label') }; });
    var ids = items.map(function (i) { return i.id; });
    var clients = store.get('clients', {});
    var current = store.get('current', '');
    var pick = $('#client');
    function save() { store.set('clients', clients); store.set('current', current); }
    function drawPicker() {
      var names = Object.keys(clients).sort();
      pick.innerHTML = '<option value="">Pick a client</option>' + names.map(function (n) { return '<option' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    }
    function draw() {
      var c = clients[current];
      $$('.item').forEach(function (el) { el.checked = !!(c && c.checks[el.value]); el.disabled = !c; });
      $('#notes').value = c ? c.notes || '' : '';
      $('#notes').disabled = !c;
      var p = progressOf(ids, c && c.checks);
      $('#bar').style.width = p.pct + '%';
      $('#count').textContent = c ? p.done + ' of ' + p.total + ' done for ' + current : 'Add a client to start a checklist.';
    }
    $('#add').addEventListener('click', function () {
      var name = $('#newname').value.trim();
      if (!name) return toast('Type the client name first');
      if (!clients[name]) clients[name] = { started: todayStr(), checks: {}, notes: '' };
      current = name;
      $('#newname').value = '';
      save();
      drawPicker();
      draw();
    });
    pick.addEventListener('change', function () { current = pick.value; save(); draw(); });
    $('#list').addEventListener('change', function (e) {
      if (!clients[current] || !e.target.classList.contains('item')) return;
      clients[current].checks[e.target.value] = e.target.checked;
      save();
      draw();
    });
    $('#notes').addEventListener('input', function () { if (clients[current]) { clients[current].notes = $('#notes').value; save(); } });
    $('#export').addEventListener('click', function () {
      var cols = [{ key: 'client', label: 'Client' }, { key: 'started', label: 'Started' }, { key: 'progress', label: 'Progress' }].concat(items.map(function (i) { return { key: i.id, label: i.label }; })).concat([{ key: 'notes', label: 'Notes' }]);
      download((C.key || 'intake') + '-' + todayStr() + '.csv', toCsv(intakeRows(clients, items), cols));
    });
    $('#remove').addEventListener('click', function () {
      if (!clients[current] || !window.confirm('Delete ' + current + ' from this checklist?')) return;
      delete clients[current];
      current = '';
      save();
      drawPicker();
      draw();
    });
    $('#print').addEventListener('click', function () { window.print(); });
    drawPicker();
    draw();
  })();
}
