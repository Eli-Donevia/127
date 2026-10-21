// The marketplace and Invite pages (lib/market-routes.js): copy and share buttons, the phone buy bar, the live price
// split on the listing form, and file and cover uploads (each file is sent as the request body, its name in
// X-File-Name, the way the HQ Library takes files).
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  $$('[data-copy-text]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy-text');
      var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });
  $$('[data-share]').forEach(function (b) {
    if (!navigator.share) return;
    b.hidden = false;
    b.addEventListener('click', function () { navigator.share({ text: b.getAttribute('data-text'), url: b.getAttribute('data-url') }).catch(function () {}); });
  });

  // Phones: the buy bar slides up once the first buy button has scrolled away.
  var bar = $('[data-sticky]');
  var hero = $('[data-hero-buy]');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { bar.classList.toggle('on', !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }).observe(hero);
  }

  // The price line under the price box: what the buyer pays and the seller's share.
  var price = $('[data-price]');
  var split = $('[data-split]');
  if (price && split) {
    var pct = Number(split.getAttribute('data-pct')) || 20;
    var show = function () {
      var cents = Math.round((Number(price.value) || 0) * 100);
      var fee = Math.round(cents * pct / 100);
      $('[data-gross]', split).textContent = '$' + (cents / 100).toFixed(2);
      $('[data-net]', split).textContent = '$' + ((cents - fee) / 100).toFixed(2);
    };
    price.addEventListener('input', show);
  }

  var send = function (url, file, type) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': type || file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'That upload stopped. Try again.'); return j; }); });
  };

  var drop = $('[data-drop]');
  if (drop) {
    var input = $('[data-file]', drop);
    var say = $('[data-say]');
    var list = $('[data-list]');
    var tell = function (t, err) { say.textContent = t; say.classList.toggle('err', !!err); };
    var run = function (files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      var i = 0;
      var next = function () {
        if (i >= files.length) { tell(files.length === 1 ? 'Added.' : files.length + ' files added.'); setTimeout(function () { location.reload(); }, 500); return; }
        var f = files[i++];
        tell('Adding ' + f.name + '...');
        send(drop.getAttribute('data-url'), f, 'application/octet-stream').then(function (j) {
          var li = document.createElement('li');
          var s = document.createElement('span');
          s.textContent = j.file.name + ' · ' + j.file.size;
          li.appendChild(s);
          list.appendChild(li);
          next();
        }, function (e) { tell(f.name + ': ' + e.message, true); });
      };
      next();
    };
    input.addEventListener('change', function () { run(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { run(e.dataTransfer && e.dataTransfer.files); });
  }

  var cover = $('[data-cover]');
  if (cover) {
    var csay = $('[data-cover-say]');
    cover.addEventListener('change', function () {
      var f = cover.files && cover.files[0];
      if (!f) return;
      csay.textContent = 'Uploading...';
      csay.classList.remove('err');
      send(cover.getAttribute('data-url'), f).then(function () {
        var box = $('[data-cover-img]');
        box.innerHTML = '';
        var img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(f);
        box.appendChild(img);
        csay.textContent = 'Cover saved.';
        setTimeout(function () { location.reload(); }, 600);
      }, function (e) { csay.textContent = e.message; csay.classList.add('err'); });
    });
  }
})();
