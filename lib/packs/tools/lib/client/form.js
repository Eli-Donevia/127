// Simple form: answers are saved in this browser only. Copy them for a spreadsheet or download a
// CSV. Nothing is sent anywhere.
/* eslint-disable no-var */
function checkAnswer(fields, v) {
  var out = [];
  (fields || []).forEach(function (f) {
    var x = v[f.id];
    var empty = f.type === 'checkbox' ? !x : !String(x == null ? '' : x).trim();
    if (f.required && empty) out.push(f.label + ' is needed.');
    if (!empty && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x).trim())) out.push(f.label + ' needs a full email address.');
    if (!empty && f.type === 'number' && !isFinite(parseFloat(x))) out.push(f.label + ' needs a number.');
  });
  return out;
}

function answerCols(fields) {
  return [{ key: '_at', label: 'Saved' }].concat((fields || []).map(function (f) { return { key: f.id, label: f.label }; }));
}

function cleanAnswer(fields, v, at) {
  var row = { _at: at };
  (fields || []).forEach(function (f) { row[f.id] = f.type === 'checkbox' ? (v[f.id] ? 'yes' : 'no') : String(v[f.id] == null ? '' : v[f.id]).trim(); });
  return row;
}

if (typeof document !== 'undefined') {
  (function () {
    var fields = C.fields || [];
    var f = $('#form');
    var answers = store.get('answers', []);
    function values() {
      var v = {};
      fields.forEach(function (x) { var el = f.elements[x.id]; v[x.id] = el ? (x.type === 'checkbox' ? el.checked : el.value) : ''; });
      return v;
    }
    function draw() {
      var cols = answerCols(fields);
      $('#n').textContent = answers.length ? answers.length + (answers.length === 1 ? ' answer saved' : ' answers saved') + ' on this device' : 'No answers saved yet';
      $('#head').innerHTML = '<tr>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '<th></th></tr>';
      $('#rows').innerHTML = answers.map(function (a, i) {
        return '<tr>' + cols.map(function (c) { return '<td>' + esc(a[c.key]) + '</td>'; }).join('') + '<td><button class="btn small" type="button" data-del="' + i + '">Delete</button></td></tr>';
      }).join('');
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = values();
      var problems = checkAnswer(fields, v);
      $('#problems').textContent = problems.join(' ');
      if (problems.length) return;
      var d = new Date();
      answers.push(cleanAnswer(fields, v, todayStr() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')));
      store.set('answers', answers);
      f.reset();
      draw();
      toast(C.thanks || 'Saved on this device');
    });
    $('#rows').addEventListener('click', function (e) {
      var i = e.target.getAttribute('data-del');
      if (i == null || !window.confirm('Delete this answer?')) return;
      answers.splice(num(i), 1);
      store.set('answers', answers);
      draw();
    });
    $('#copy').addEventListener('click', function () {
      if (!answers.length) return toast('No answers yet');
      copyText(toTsv(answers, answerCols(fields)));
    });
    $('#csv').addEventListener('click', function () {
      if (!answers.length) return toast('No answers yet');
      download((C.key || 'answers') + '-' + todayStr() + '.csv', toCsv(answers, answerCols(fields)));
    });
    $('#clear').addEventListener('click', function () {
      if (!answers.length || !window.confirm('Delete every saved answer on this device? Download the CSV first if you need them.')) return;
      answers = [];
      store.set('answers', answers);
      draw();
    });
    draw();
  })();
}
