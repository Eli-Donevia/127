// Progress (/app/hq/you): two things that need a script, both optional.
// - Share my month: the card (an SVG from the server) drawn onto a canvas as a PNG and handed to the phone's own share
//   sheet, or saved where sharing files isn't offered. Nothing posts by itself.
// - Read a screenshot: a profile screenshot of an account the member watches is shrunk here (1568px JPEG) and posted
//   once; the server reads only the post count. The number lands in a form the member confirms. Nothing is kept here.
(function () {
  var card = document.querySelector('[data-card]');
  if (card) {
    card.addEventListener('click', function (e) {
      e.preventDefault();
      var name = '127-' + (card.getAttribute('data-card') || 'month').toLowerCase() + '.png';
      fetch(card.getAttribute('href'), { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('card'); return r.text(); })
        .then(function (svg) {
          return new Promise(function (ok, no) {
            var img = new Image();
            var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            img.onload = function () {
              var c = document.createElement('canvas');
              c.width = 1080;
              c.height = 1350;
              c.getContext('2d').drawImage(img, 0, 0, 1080, 1350);
              URL.revokeObjectURL(url);
              c.toBlob(function (b) { b ? ok(b) : no(new Error('png')); }, 'image/png');
            };
            img.onerror = function () { URL.revokeObjectURL(url); no(new Error('img')); };
            img.src = url;
          });
        })
        .then(function (blob) {
          var file = new File([blob], name, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function () {});
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        })
        .catch(function () { window.location.href = card.getAttribute('href'); });
    });
  }

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

  Array.prototype.forEach.call(document.querySelectorAll('[data-shot]'), function (box) {
    box.hidden = false;
    var input = box.querySelector('input[type=file]');
    var form = box.querySelector('.hqn-total');
    var n = form.querySelector('input[name=n]');
    var msg = form.querySelector('.hqn-shot-msg');
    var hint = box.querySelector('label + .hqn-dim');
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      hint.textContent = 'Reading the post count…';
      shrink(f)
        .then(function (data) {
          return fetch('/app/hq/you/rivals/shot', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ id: box.getAttribute('data-shot'), image: data }),
          });
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          input.value = '';
          if (!x.ok) { hint.textContent = (x.j && x.j.error) || "Couldn't read that. Try again."; return; }
          hint.textContent = '';
          n.value = x.j.read;
          msg.textContent = x.j.match ? 'Check the number, then save it.' : 'That screenshot looks like @' + x.j.seenHandle + ', not @' + x.j.handle + '. Check it before you save.';
          form.hidden = false;
          n.focus();
        })
        .catch(function () { input.value = ''; hint.textContent = "Couldn't read that. Try again."; });
    });
  });
})();
