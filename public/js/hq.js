// 127 HQ: copy the 127 link, clear the week's call with a second tap, confirm before removing
// something, show that a slow request (Stripe, Read my week) is working, and the screenshot drop-in:
// each image is shrunk in the browser (1568px, JPEG) and posted once; nothing is kept on the device.
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy-value]');
    if (!b) return;
    var v = b.getAttribute('data-copy-value');
    var html = b.innerHTML;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.innerHTML = html; }, 1400); };
    var ask = function () { window.prompt('Copy your 127 link', v); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done, ask);
    else ask();
  });

  // Radios can't be unticked, so a second tap on the chosen call clears it (keyboard users pick another).
  document.querySelectorAll('.hq-calls input').forEach(function (r) {
    r.addEventListener('pointerdown', function () { r._was = r.checked; });
    r.addEventListener('click', function () {
      if (r._was) r.checked = false;
      r._was = undefined;
    });
  });

  var drop = document.querySelector('[data-snap]');
  if (drop && !drop.hasAttribute('data-off')) {
    var input = drop.querySelector('input[type=file]');
    var msg = drop.querySelector('.hq-drop-msg');
    var max = parseInt(drop.getAttribute('data-max'), 10) || 4;
    var say = function (t) { msg.textContent = t; };
    var shrink = function (file) {
      return new Promise(function (ok, no) {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
          var s = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * s));
          c.height = Math.max(1, Math.round(img.naturalHeight * s));
          var g = c.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          ok(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { URL.revokeObjectURL(url); no(new Error('read')); };
        img.src = url;
      });
    };
    var send = function (files) {
      files = Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type) || /\.(heic|jpe?g|png|webp|gif)$/i.test(f.name); });
      if (!files.length) return say('Use a screenshot or photo.');
      if (files.length > max) return say('Up to ' + max + ' screenshots at a time.');
      drop.setAttribute('aria-busy', 'true');
      say('Reading ' + (files.length === 1 ? 'your screenshot' : files.length + ' screenshots') + '…');
      Promise.all(files.map(shrink)).then(function (images) {
        return fetch('/app/hq/snap', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ w: drop.getAttribute('data-w'), images: images }),
        });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (j.go) {
            var to = new URL(j.go, window.location.href);
            var same = to.pathname + to.search === window.location.pathname + window.location.search;
            window.location.href = to.href;
            if (same) window.location.reload();
            return;
          }
          throw new Error(j.error || 'Something went wrong. Try again.');
        });
      }).catch(function (err) {
        drop.removeAttribute('aria-busy');
        input.value = '';
        say(err && err.message && err.message !== 'read' ? err.message : "Couldn't open that image. Try a screenshot.");
      });
    };
    input.addEventListener('change', function () { send(input.files); });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'dragend'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); send(e.dataTransfer && e.dataTransfer.files); });
    // Pasting a screenshot anywhere on HQ works too.
    document.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.files) || [];
      if (items.length && !/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) send(items);
    });
  }

  document.addEventListener('submit', function (e) {
    var f = e.target;
    var msg = f.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) { e.preventDefault(); return; }
    var b = f.querySelector('[data-busy]');
    if (b) { b.textContent = b.getAttribute('data-busy'); b.setAttribute('aria-busy', 'true'); b.style.opacity = '.6'; }
  });
})();
