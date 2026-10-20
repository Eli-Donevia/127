// Tip splitter: split a tip pool by hours worked, by points, or evenly. Every cent is given out
// (largest remainders get the extra cent), or whole dollars with the rest shown as left over.
/* eslint-disable no-var */
function splitTips(total, people, mode, step) {
  var unit = num(step) >= 1 ? 100 : 1;
  var cents = Math.round(num(total) * 100);
  var units = Math.floor(cents / unit);
  var list = (people || []).filter(function (p) { return String(p.name || '').trim(); });
  var weights = list.map(function (p) { return mode === 'even' ? 1 : Math.max(0, num(p.weight)); });
  var sum = weights.reduce(function (s, w) { return s + w; }, 0);
  if (!list.length || !sum || units <= 0) return { shares: list.map(function (p) { return { name: p.name, weight: mode === 'even' ? 1 : num(p.weight), amount: 0 }; }), leftover: round2(cents / 100) };
  var raw = weights.map(function (w) { return (units * w) / sum; });
  var given = raw.map(Math.floor);
  var rest = units - given.reduce(function (s, g) { return s + g; }, 0);
  var order = raw.map(function (r, i) { return { i: i, f: r - Math.floor(r) }; }).sort(function (a, b) { return b.f - a.f || a.i - b.i; });
  for (var k = 0; k < rest; k++) given[order[k % order.length].i] += 1;
  var shares = list.map(function (p, i) { return { name: p.name, weight: weights[i], amount: round2((given[i] * unit) / 100) }; });
  return { shares: shares, leftover: round2((cents - units * unit) / 100) };
}

if (typeof document !== 'undefined') {
  (function () {
    var people = store.get('people', null) || (C.staff || []).map(function (n) { return { name: n, weight: '' }; });
    function save() { store.set('people', people); store.set('opts', { total: $('#total').value, mode: $('#mode').value, step: $('#step').value }); }
    var opts = store.get('opts', null);
    if (opts) { $('#total').value = opts.total; $('#mode').value = opts.mode; $('#step').value = opts.step; }
    function drawRows() {
      var label = $('#mode').value === 'points' ? 'Points' : 'Hours';
      $('#wlabel').textContent = $('#mode').value === 'even' ? '' : label;
      $('#people').innerHTML = people.map(function (p, i) {
        return '<div class="row" style="flex-wrap:nowrap;margin:8px 0"><input data-n="' + i + '" value="' + esc(p.name) + '" placeholder="Name" aria-label="Name">' +
          ($('#mode').value === 'even' ? '' : '<input data-w="' + i + '" inputmode="decimal" style="width:96px" value="' + esc(p.weight) + '" placeholder="' + label + '" aria-label="' + label + '">') +
          '<button class="btn icon" type="button" data-x="' + i + '" aria-label="Remove">x</button></div>';
      }).join('');
    }
    function result() {
      var r = splitTips($('#total').value, people, $('#mode').value, $('#step').value);
      $('#result').innerHTML = r.shares.map(function (s) { return '<div class="line"><span>' + esc(s.name) + ($('#mode').value === 'even' ? '' : ' (' + esc(s.weight) + ')') + '</span><b>' + money(s.amount) + '</b></div>'; }).join('') + (r.leftover ? '<div class="line"><span>Left over (round up next time)</span><span>' + money(r.leftover) + '</span></div>' : '');
      save();
      return r;
    }
    $('#people').addEventListener('input', function (e) {
      var n = e.target.getAttribute('data-n');
      var w = e.target.getAttribute('data-w');
      if (n != null) people[num(n)].name = e.target.value;
      if (w != null) people[num(w)].weight = e.target.value;
      result();
    });
    $('#people').addEventListener('click', function (e) {
      var x = e.target.getAttribute('data-x');
      if (x == null) return;
      people.splice(num(x), 1);
      drawRows();
      result();
    });
    $('#addp').addEventListener('click', function () { people.push({ name: '', weight: '' }); drawRows(); });
    $('#mode').addEventListener('change', function () { drawRows(); result(); });
    $('#total').addEventListener('input', result);
    $('#step').addEventListener('change', result);
    $('#copy').addEventListener('click', function () {
      var r = result();
      copyText(['Tips ' + todayStr() + ': ' + money($('#total').value)].concat(r.shares.map(function (s) { return s.name + ': ' + money(s.amount); })).concat(r.leftover ? ['Left over: ' + money(r.leftover)] : []).join('\n'));
    });
    $('#calc').addEventListener('submit', function (e) { e.preventDefault(); });
    drawRows();
    result();
  })();
}
