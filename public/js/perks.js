// Perks and grants (lib/perks, HQ_PERKS): the fit filter, the member's own list (saved, applying, sent, heard back)
// and the calendar file for its dates. Everything stays in this browser under one key per member
// (data-scope, lib/perks scope()). Nothing is sent anywhere. Without this script the page is complete: every row
// opens on its own and links to the official page.
(function () {
  var root = document.querySelector('.pk');
  if (!root) return;
  var KEY = 'perks:' + root.getAttribute('data-scope');
  var STATES = [['saved', 'Saved'], ['applying', 'Applying'], ['sent', 'Sent'], ['heard', 'Heard back']];

  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  function store(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private window: the list lasts this visit */ } }
  var mine = load();
  var fit = Array.isArray(mine._fit) ? mine._fit : [];

  var rows = Array.prototype.slice.call(root.querySelectorAll('.pk-row'));
  var byId = {};
  rows.forEach(function (r) { byId[r.getAttribute('data-id')] = r; });

  // ---------- the fit filter ----------
  var fitBox = root.querySelector('[data-fit]');
  var fitN = root.querySelector('[data-fit-n]');
  var empty = root.querySelector('[data-empty]');
  fitBox.hidden = false;
  var buttons = Array.prototype.slice.call(fitBox.querySelectorAll('button'));
  function applyFit() {
    var shown = 0;
    rows.forEach(function (r) {
      var f = (r.getAttribute('data-fits') || '').split(' ');
      var ok = !fit.length || f.indexOf('any') > -1 || fit.some(function (k) { return f.indexOf(k) > -1; });
      r.hidden = !ok;
      if (ok) shown += 1;
    });
    root.querySelectorAll('[data-shelf]').forEach(function (s) { s.hidden = !s.querySelector('.pk-row:not([hidden])'); });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', fit.indexOf(b.getAttribute('data-fit-k')) > -1 ? 'true' : 'false'); });
    fitN.textContent = fit.length ? shown + ' of ' + rows.length + ' fit' : '';
    empty.hidden = shown > 0;
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-fit-k'), i = fit.indexOf(k);
      if (i > -1) fit.splice(i, 1); else fit.push(k);
      mine._fit = fit; store(mine); applyFit();
    });
  });

  // ---------- your list ----------
  var box = root.querySelector('[data-mine]');
  var list = root.querySelector('[data-mine-l]');
  var fmt = function (d) { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
  function ids() { return Object.keys(mine).filter(function (k) { return k.charAt(0) !== '_' && byId[k]; }); }
  function draw() {
    var keep = ids();
    box.hidden = !keep.length;
    list.textContent = '';
    keep.forEach(function (id) {
      var r = byId[id], li = document.createElement('li'), a = document.createElement('a'), d = document.createElement('span'), sel = document.createElement('select');
      li.setAttribute('data-s', mine[id]);
      a.href = '#' + id; a.textContent = r.getAttribute('data-name'); a.setAttribute('data-open', id);
      d.className = 'd'; d.textContent = r.getAttribute('data-due') ? 'Closes ' + fmt(r.getAttribute('data-due')) : 'No set date';
      sel.setAttribute('aria-label', 'Where you are with ' + r.getAttribute('data-name'));
      STATES.forEach(function (s) { var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; if (mine[id] === s[0]) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { mine[id] = sel.value; li.setAttribute('data-s', sel.value); store(mine); });
      li.appendChild(a); li.appendChild(d); li.appendChild(sel);
      list.appendChild(li);
    });
    rows.forEach(function (r) {
      var id = r.getAttribute('data-id'), on = !!mine[id], b = r.querySelector('[data-save]');
      r.classList.toggle('is-saved', on);
      b.hidden = false;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Saved' : 'Save';
    });
  }
  rows.forEach(function (r) {
    r.querySelector('[data-save]').addEventListener('click', function () {
      var id = r.getAttribute('data-id');
      if (mine[id]) delete mine[id]; else mine[id] = 'saved';
      store(mine); draw();
    });
  });
  root.querySelector('[data-clear]').addEventListener('click', function () {
    ids().forEach(function (k) { delete mine[k]; });
    store(mine); draw();
  });

  // Open a row when a date or a list link points at it.
  root.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-open]');
    if (!a) return;
    var r = byId[a.getAttribute('data-open')];
    if (!r) return;
    r.hidden = false;
    var d = r.querySelector('details');
    if (d) d.open = true;
  });

  // ---------- the calendar file: one all-day event the day before each saved deadline ----------
  function ics() {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n'); };
    var day = function (d, plus) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + plus); return t.toISOString().slice(0, 10).replace(/-/g, ''); };
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Perks and grants//EN', 'CALSCALE:GREGORIAN'];
    var n = 0;
    ids().forEach(function (id) {
      var r = byId[id], due = r.getAttribute('data-due');
      if (!due) return;
      n += 1;
      out.push('BEGIN:VEVENT', 'UID:' + id + '-' + due + '@127group.io', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + day(due, -1), 'DTEND;VALUE=DATE:' + day(due, 0),
        'SUMMARY:' + esc(r.getAttribute('data-name') + ' closes tomorrow'),
        'DESCRIPTION:' + esc('Check the official page for the exact time and rules: ' + r.getAttribute('data-url')),
        'URL:' + r.getAttribute('data-url'), 'END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return n ? out.join('\r\n') + '\r\n' : null;
  }
  root.querySelector('[data-ics]').addEventListener('click', function (e) {
    var text = ics(), btn = e.currentTarget;
    if (!text) { btn.textContent = 'None of yours has a set date'; setTimeout(function () { btn.textContent = 'Add dates to your calendar'; }, 2400); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    a.download = '127-deadlines.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  // Open the row named in the address, then start the line once the page has painted.
  if (location.hash && byId[location.hash.slice(1)]) { var d0 = byId[location.hash.slice(1)].querySelector('details'); if (d0) d0.open = true; }
  applyFit();
  draw();
  requestAnimationFrame(function () { root.classList.add('is-live'); });
})();
