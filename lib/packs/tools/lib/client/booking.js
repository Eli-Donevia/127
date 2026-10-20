// Booking request page: the visitor fills in what they need and when, and the page writes the
// request as a message they send from their own phone or email app. The page itself sends nothing.
/* eslint-disable no-var */
function bookingProblems(v, today) {
  var out = [];
  if (!String(v.name || '').trim()) out.push('Add your name.');
  if (!String(v.phone || '').trim() && !String(v.email || '').trim()) out.push('Add a phone number or an email so we can reply.');
  if (!v.service) out.push('Pick a service.');
  if (v.date && today && v.date < today) out.push('Pick a date from today on.');
  return out;
}

function bookingMessage(v, cfg) {
  var lines = ['Booking request for ' + (cfg.business || 'you')];
  lines.push('Name: ' + String(v.name || '').trim());
  if (v.phone) lines.push('Phone: ' + v.phone);
  if (v.email) lines.push('Email: ' + v.email);
  lines.push('Service: ' + v.service);
  if (v.date) lines.push('Preferred day: ' + v.date + (v.window ? ', ' + v.window : ''));
  else if (v.window) lines.push('Best time: ' + v.window);
  if (v.address) lines.push('Where: ' + v.address);
  if (v.notes) lines.push('Notes: ' + v.notes);
  return lines.join('\n');
}

function smsHref(phone, body) {
  return 'sms:' + String(phone || '').replace(/[^\d+]/g, '') + '?&body=' + encodeURIComponent(body);
}

function mailtoHref(email, subject, body) {
  return 'mailto:' + encodeURIComponent(String(email || '').trim()).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

if (typeof document !== 'undefined') {
  (function () {
    var f = $('#book');
    var keys = ['name', 'phone', 'email', 'service', 'date', 'window', 'address', 'notes'];
    var draft = store.get('draft', {});
    keys.forEach(function (k) { if (draft[k] && f.elements[k]) f.elements[k].value = draft[k]; });
    if (f.elements.date) f.elements.date.min = todayStr();
    function values() {
      var v = {};
      keys.forEach(function (k) { v[k] = f.elements[k] ? String(f.elements[k].value).trim() : ''; });
      return v;
    }
    function render() {
      var v = values();
      store.set('draft', v);
      var problems = bookingProblems(v, todayStr());
      var msg = bookingMessage(v, C);
      $('#preview').textContent = msg;
      $('#problems').textContent = problems.join(' ');
      var ok = !problems.length;
      $$('.send').forEach(function (a) { a.setAttribute('aria-disabled', ok ? 'false' : 'true'); a.style.opacity = ok ? '1' : '.45'; });
      if (C.phone && $('#sms')) $('#sms').href = smsHref(C.phone, msg);
      if (C.email && $('#mail')) $('#mail').href = mailtoHref(C.email, 'Booking request: ' + (v.service || ''), msg);
      return ok;
    }
    f.addEventListener('input', render);
    f.addEventListener('change', render);
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    $$('.send').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!render()) {
          e.preventDefault();
          toast('Fill in the missing parts first');
        }
      });
    });
    $('#copy').addEventListener('click', function () { if (render()) copyText($('#preview').textContent); else toast('Fill in the missing parts first'); });
    $('#clear').addEventListener('click', function () { store.set('draft', {}); f.reset(); render(); });
    render();
  })();
}
