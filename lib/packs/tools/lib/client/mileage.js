// Mileage log: one line per trip (miles, or odometer start and end), totals by month, and the
// standard mileage rate for each trip's date. Trips stay in this browser; download a CSV for your
// records or your tax preparer.
/* eslint-disable no-var */
function rateFor(date, rates) {
  var r = 0;
  (rates || []).slice().sort(function (a, b) { return a.from < b.from ? -1 : 1; }).forEach(function (x) { if (String(date) >= x.from) r = num(x.rate); });
  return r;
}

function tripMiles(t) {
  var m = num(t.miles);
  if (!m && num(t.end) > num(t.start)) m = num(t.end) - num(t.start);
  if (t.round) m = m * 2;
  return Math.round(m * 10) / 10;
}

function summarize(trips, rates, year) {
  var months = {};
  var miles = 0;
  var amount = 0;
  (trips || []).forEach(function (t) {
    if (year && String(t.date).slice(0, 4) !== String(year)) return;
    var m = tripMiles(t);
    var a = round2(m * rateFor(t.date, rates));
    var key = String(t.date).slice(0, 7);
    months[key] = months[key] || { month: key, trips: 0, miles: 0, amount: 0 };
    months[key].trips += 1;
    months[key].miles = Math.round((months[key].miles + m) * 10) / 10;
    months[key].amount = round2(months[key].amount + a);
    miles += m;
    amount += a;
  });
  return { months: Object.keys(months).sort().reverse().map(function (k) { return months[k]; }), miles: Math.round(miles * 10) / 10, amount: round2(amount) };
}

if (typeof document !== 'undefined') {
  (function () {
    var trips = store.get('trips', []);
    var f = $('#trip');
    f.elements.date.value = todayStr();
    function save() { store.set('trips', trips); }
    function draw() {
      var year = todayStr().slice(0, 4);
      var s = summarize(trips, C.rates, year);
      $('#ymiles').textContent = s.miles + ' mi';
      $('#yamount').textContent = money(s.amount);
      $('#months').innerHTML = s.months.map(function (m) { return '<tr><td>' + esc(m.month) + '</td><td>' + m.trips + '</td><td>' + m.miles + '</td><td>' + money(m.amount) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">No trips yet this year.</td></tr>';
      $('#trips').innerHTML = trips.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 60).map(function (t) {
        return '<tr><td>' + esc(t.date) + '</td><td>' + esc(t.from) + (t.to ? ' to ' + esc(t.to) : '') + (t.round ? ' and back' : '') + '<div class="muted small">' + esc(t.purpose) + '</div></td><td>' + tripMiles(t) + '</td><td><button class="btn small" type="button" data-del="' + esc(t.id) + '">Delete</button></td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted">Add your first trip above.</td></tr>';
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = { id: String(Date.now()), date: f.elements.date.value || todayStr(), from: f.elements.from.value.trim(), to: f.elements.to.value.trim(), purpose: f.elements.purpose.value.trim(), miles: f.elements.miles.value, start: f.elements.start.value, end: f.elements.end.value, round: f.elements.round.checked };
      if (!tripMiles(t)) return toast('Add the miles, or the odometer at the start and end');
      if (!t.purpose) return toast('Add the business reason for the trip');
      trips.push(t);
      save();
      ['to', 'miles', 'start', 'end', 'purpose'].forEach(function (k) { f.elements[k].value = ''; });
      f.elements.round.checked = false;
      draw();
      toast('Trip saved on this device');
    });
    $('#trips').addEventListener('click', function (e) {
      var id = e.target.getAttribute('data-del');
      if (id == null || !window.confirm('Delete this trip?')) return;
      trips = trips.filter(function (t) { return t.id !== id; });
      save();
      draw();
    });
    $('#export').addEventListener('click', function () {
      var rows = trips.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (t) { return { date: t.date, from: t.from, to: t.to, purpose: t.purpose, miles: tripMiles(t), start: t.start, end: t.end, rate: rateFor(t.date, C.rates), amount: round2(tripMiles(t) * rateFor(t.date, C.rates)) }; });
      download((C.key || 'mileage') + '-' + todayStr() + '.csv', toCsv(rows, [{ key: 'date', label: 'Date' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'purpose', label: 'Business reason' }, { key: 'miles', label: 'Miles' }, { key: 'start', label: 'Odometer start' }, { key: 'end', label: 'Odometer end' }, { key: 'rate', label: 'Rate per mile' }, { key: 'amount', label: 'At standard rate' }]));
    });
    draw();
  })();
}
