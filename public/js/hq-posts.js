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

  // Sends one JPEG for one place, then saves the form so what was written stays.
  var upload = function (place, blob, say) {
    say('Uploading…');
    fetch('/app/hq/post/' + post + '/photo/' + place, { method: 'POST', body: blob, headers: { accept: 'application/json', 'content-type': 'image/jpeg' }, credentials: 'same-origin' })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) return say(x.j.error || "That photo didn't upload.");
        say('Added.');
        save();
      })
      .catch(function () { say("That photo didn't upload. Try again."); });
  };
  // Legal L93 PO2: a file that carries AI labels (C2PA, or IPTC from Studio) goes up as it is, so the
  // platform can read them; cropping here would redraw it and lose them.
  var LABELS = ['c2pa', 'jumb', 'Photoshop 3.0', 'trainedAlgorithmicMedia'];
  var labelled = function (buf) {
    var t = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 512 * 1024)));
    return LABELS.some(function (l) { return t.indexOf(l) !== -1; });
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
      Promise.all([createImageBitmap(file), file.arrayBuffer()]).then(function (got) {
        var img = got[0], bytes = got[1];
        var r = Number(crop && crop.value) || img.width / img.height;
        var asIs = file.type === 'image/jpeg' && file.size <= 8 * 1024 * 1024 && img.width <= 4096 && img.height <= 4096 && Math.abs(img.width / img.height - r) < 0.01;
        if (asIs) return upload(place, new Blob([bytes], { type: 'image/jpeg' }), say);
        if (labelled(bytes)) return say('This file carries labels that show how it was made. Pick Original, or crop it in Studio first, so the labels stay.');
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
          upload(place, blob, say);
        }, 'image/jpeg', 0.9);
      }).catch(function () { say("That file isn't a photo 127 can read."); });
    });
  });
})();
