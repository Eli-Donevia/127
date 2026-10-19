// The Founding Five page (/app/founding-five, lib/founding-five-routes.js). Sends a phone video in 4 MB
// parts with a progress bar (so a big video never has to arrive in one request), checks its length
// against the length asked for, and asks before a "No" to 18 or older ends the application.
(function () {
  var CHUNK = 4 * 1024 * 1024;

  function lengthOf(file) {
    return new Promise(function (done) {
      var url = '';
      var finish = function (s) {
        if (url) URL.revokeObjectURL(url);
        url = '';
        done(s);
      };
      try {
        var v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = function () { finish(isFinite(v.duration) ? v.duration : 0); };
        v.onerror = function () { finish(0); };
        setTimeout(function () { finish(0); }, 4000);
        url = URL.createObjectURL(file);
        v.src = url;
      } catch (e) {
        finish(0);
      }
    });
  }

  document.querySelectorAll('[data-ff-upload]').forEach(function (box) {
    var slot = box.getAttribute('data-ff-upload');
    var maxMb = Number(box.getAttribute('data-max')) || 150;
    var seconds = Number(box.getAttribute('data-seconds')) || 0;
    var input = box.querySelector('[data-ff-file]');
    var pick = box.querySelector('[data-ff-pick-label]');
    var bar = box.querySelector('.ff-bar');
    var fill = bar.querySelector('span');
    var status = box.querySelector('.ff-status');
    var player = box.querySelector('.ff-player');
    var have = box.querySelector('.ff-have');
    var say = function (text, bad) {
      status.textContent = text;
      status.classList.toggle('ff-bad', !!bad);
    };

    function send(file) {
      var parts = Math.ceil(file.size / CHUNK);
      var upload = '';
      var i = 0;
      input.disabled = true;
      bar.hidden = false;
      fill.style.width = '0%';
      say('Uploading: 0%');
      (function next() {
        var q = '?part=' + i + '&parts=' + parts + '&size=' + file.size + (upload ? '&upload=' + encodeURIComponent(upload) : '');
        fetch('/app/founding-five/video/' + encodeURIComponent(slot) + q, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'video'), Accept: 'application/json' },
          body: file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK)),
        })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (!r.ok) throw new Error(j.error || 'The upload stopped. Try again.');
              return j;
            });
          })
          .then(function (j) {
            upload = j.upload;
            i += 1;
            var pct = Math.round((i / parts) * 100);
            fill.style.width = pct + '%';
            if (!j.done) {
              say('Uploading: ' + pct + '%');
              return next();
            }
            input.disabled = false;
            input.value = '';
            bar.hidden = true;
            player.hidden = false;
            player.src = '/app/founding-five/video/' + encodeURIComponent(slot) + '?v=' + encodeURIComponent(j.upload);
            have.hidden = false;
            have.textContent = 'Uploaded just now · ' + (j.video.size / 1048576).toFixed(1) + ' MB';
            if (pick) pick.textContent = 'Replace the video';
            say(slot === 'hello' ? 'Uploaded. Finish the rest and send your application.' : 'Saved. Eli sees it before the session.');
          })
          .catch(function (e) {
            input.disabled = false;
            bar.hidden = true;
            say((e && e.message) || 'The upload stopped. Try again.', true);
          });
      })();
    }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > maxMb * 1048576) {
        input.value = '';
        return say('That video is over ' + maxMb + ' MB. Trim it on your phone first' + (slot === 'hello' ? ', or paste a link instead.' : '.'), true);
      }
      lengthOf(file).then(function (s) {
        if (seconds && s > seconds * 2 && !window.confirm('That video is ' + Math.round(s) + ' seconds long, and this one asks for about ' + seconds + '. Upload it anyway?')) {
          input.value = '';
          return;
        }
        send(file);
      });
    });
  });

  // A "No" to 18 or older ends the application, so ask once before it's sent.
  var form = document.querySelector('[data-ff-apply]');
  if (form) {
    form.addEventListener('submit', function (e) {
      var no = form.querySelector('input[name="adult"][value="no"]');
      var deleting = e.submitter && e.submitter.hasAttribute('formaction');
      if (!deleting && no && no.checked && !window.confirm('Answering no ends your application. Send it?')) e.preventDefault();
    });
  }
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
  document.querySelectorAll('[data-confirm-click]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      if (!window.confirm(b.getAttribute('data-confirm-click'))) e.preventDefault();
    });
  });
})();
