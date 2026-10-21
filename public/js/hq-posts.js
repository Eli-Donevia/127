// HQ Post (views/app/hq-posts.ejs, hq-post.ejs): times in the member's own zone, the "When" box, caption
// counts, and photos cropped here to each place's shape and sent as one JPEG per place.
(function () {
  'use strict';

  var fmt = function (d, short) {
    var o = short ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return d.toLocaleString(undefined, o);
  };
  document.querySelectorAll('time[data-when]').forEach(function (t) {
    var iso = t.getAttribute('data-when');
    if (!iso) return;
    var d = new Date(iso);
    if (isNaN(d)) return;
    t.textContent = t.hasAttribute('data-ok') && d.getTime() <= Date.now() ? 'now' : fmt(d, t.hasAttribute('data-short'));
  });

  // Day labels in the week strip follow the member's own calendar.
  document.querySelectorAll('[data-day]').forEach(function (s) {
    var d = new Date(s.getAttribute('data-day') + 'T12:00:00');
    s.textContent = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase() + ' ' + d.getDate();
  });

  var form = document.getElementById('pc-form');
  if (!form) return;
  var post = form.getAttribute('data-post');

  var local = document.getElementById('pc-when');
  var iso = form.querySelector('input[name="when_iso"]');
  if (local && iso) {
    var start = local.getAttribute('data-iso');
    if (start) {
      var d = new Date(start);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      if (!isNaN(d) && d.getTime() > Date.now()) local.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    form.addEventListener('submit', function () {
      var v = local.value ? new Date(local.value) : null;
      iso.value = v && !isNaN(v) ? v.toISOString() : '';
    });
  }

  document.querySelectorAll('textarea[data-count]').forEach(function (ta) {
    var n = document.querySelector('[data-n="' + ta.getAttribute('data-count') + '"]');
    if (n) ta.addEventListener('input', function () { n.textContent = ta.value.length; });
  });

  var MAXW = { instagram: 1440, facebook: 2048, x: 2048 };
  var save = function () {
    var b = form.querySelector('button[name="next"][value="save"]');
    if (form.requestSubmit && b) form.requestSubmit(b);
    else form.submit();
  };

  document.querySelectorAll('input[data-photo]').forEach(function (input) {
    var place = input.getAttribute('data-photo');
    var crop = document.querySelector('select[data-crop="' + place + '"]');
    var msg = document.querySelector('[data-msg="' + place + '"]');
    var say = function (t) { if (msg) msg.textContent = t; };
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!window.createImageBitmap) return say("This browser can't crop photos. Try another one.");
      say('Cropping…');
      createImageBitmap(file).then(function (img) {
        var r = Number(crop && crop.value) || img.width / img.height;
        var w = img.width, h = img.height, sx = 0, sy = 0;
        if (w / h > r) { sx = (w - h * r) / 2; w = h * r; } else { sy = (h - w / r) / 2; h = w / r; }
        var outW = Math.min(MAXW[place] || 1440, Math.round(w));
        var outH = Math.round(outW / (w / h));
        if (outW < 320) return say('That photo is too small. Use one at least 320 pixels wide.');
        var c = document.createElement('canvas');
        c.width = outW;
        c.height = outH;
        var g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, outW, outH);
        g.drawImage(img, sx, sy, w, h, 0, 0, outW, outH);
        c.toBlob(function (blob) {
          if (!blob) return say("That photo couldn't be read.");
          say('Uploading…');
          fetch('/app/hq/post/' + post + '/photo/' + place, { method: 'POST', body: blob, headers: { accept: 'application/json', 'content-type': 'image/jpeg' }, credentials: 'same-origin' })
            .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
            .then(function (x) {
              if (!x.ok) return say(x.j.error || "That photo didn't upload.");
              say('Added.');
              save();
            })
            .catch(function () { say("That photo didn't upload. Try again."); });
        }, 'image/jpeg', 0.9);
      }).catch(function () { say("That file isn't a photo 127 can read."); });
    });
  });
})();
