// 127 HQ v2 (views/app/hq2): Do my day (copy and open, Sent with Undo, Skip, Write it for me), Talk to
// 127 (typed or said to the orb), today's count, live run pages, approvals that hold to their limit,
// copy buttons, adding files to the Library, Start search, Pipeline moves and the win card. Every
// form still works with this file off (adding a file needs it); this only makes it quicker.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var post = function (url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'That did not work. Try again.'); return j; }); });
  };
  var el = function (tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  };

  // ---------- what 127 says back ----------
  var sayBox = $('#say');
  var say = function (text, acts) {
    if (!sayBox) return;
    sayBox.textContent = '';
    sayBox.appendChild(el('div', {}, text));
    if (acts && acts.length) {
      var row = el('div', { class: 'acts' });
      acts.forEach(function (a) {
        var n = a.href ? el('a', { class: a.primary ? 'btn sm' : 'hq-pill', href: a.href }, a.label) : el('button', { type: 'button', class: 'hq-pill' }, a.label);
        if (a.onClick) n.addEventListener('click', a.onClick);
        row.appendChild(n);
      });
      sayBox.appendChild(row);
    }
    sayBox.classList.add('on');
  };

  // ---------- today's count ----------
  var paint = function (h) {
    if (!h) return;
    $$('[data-total]').forEach(function (n) { n.textContent = h.today; });
    $$('[data-left]').forEach(function (n) { n.textContent = h.left; });
    Object.keys(h.counts || {}).forEach(function (k) { $$('[data-count="' + k + '"]').forEach(function (n) { n.textContent = h.counts[k]; }); });
    var ring = $('[data-ring]');
    if (ring) {
      var fg = $('.fg', ring);
      var c = parseFloat(fg.getAttribute('data-c'));
      fg.setAttribute('stroke-dashoffset', (c * (1 - Math.min(1, h.today / h.target))).toFixed(1));
      ring.classList.toggle('done', !!h.done);
    }
  };
  var add = function (kind, n, label) {
    return post('/app/hq/actions', { kind: kind, n: n }).then(function (j) {
      paint(j.hundred);
      var h = j.hundred;
      if (n > 0) say((h.done && h.today - n < h.target ? 'That is ' + h.target + '. You did the work today.' : 'Added ' + n + ' ' + label + '. ' + h.today + ' of ' + h.target + ' today.'), [{ label: 'Undo', onClick: function () { add(kind, -n, label).then(function () { say('Undone.'); }); } }]);
      return j;
    }).catch(function (e) { say(e.message); });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    var k = b.getAttribute('data-add');
    var label = b.getAttribute('data-label') || k;
    b.disabled = true;
    add(k, parseInt(b.getAttribute('data-n'), 10) || 1, label).then(function () { b.disabled = false; });
  });

  // ---------- Talk to 127 ----------
  var form = $('#talk');
  var input = $('#talk-in');
  var orb = $('#orb');
  var orbSays = $('#orb-status');
  var mood = function (s, word) {
    if (orb) orb.setAttribute('data-state', s);
    if (orbSays) orbSays.textContent = word || 'Talk';
  };
  var speak = function (text) {
    if (!('speechSynthesis' in window) || !text) return mood('idle');
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.04;
      u.onend = u.onerror = function () { mood('idle'); };
      mood('speaking', 'Talking');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (err) { mood('idle'); }
  };
  var answer = function (j, voiced) {
    var acts = [];
    if (j.kind === 'nav' && j.nav) {
      say(j.say);
      setTimeout(function () { location.href = j.nav; }, voiced ? 900 : 250);
    } else if (j.kind === 'log') {
      paint(j.hundred);
      acts.push({ label: 'Undo', onClick: function () { add(j.logged.kind, -j.logged.n, '').then(function () { say('Undone.'); }); } });
      if (!$('[data-ring]')) acts.push({ label: 'See today', href: '/app/hq#score' });
      say(j.say, acts);
    } else if (j.kind === 'status') {
      if (j.move) acts.push({ label: j.move.cta, href: j.move.href, primary: true });
      say(j.say, acts);
    } else if (j.kind === 'workflow' && j.pick) {
      var q = new URLSearchParams();
      Object.keys(j.pick.inputs || {}).forEach(function (k) { q.set('in_' + k, j.pick.inputs[k]); });
      acts.push({ label: j.pick.locked && !j.pick.freeRun ? 'See it' : 'Set it up', href: '/app/hq/w/' + j.pick.id + (q.toString() ? '?' + q.toString() : ''), primary: true });
      (j.others || []).slice(0, 2).forEach(function (o) { acts.push({ label: o.title, href: '/app/hq/w/' + o.id }); });
      say(j.say + (j.pick.why ? ' ' + j.pick.why : ''), acts);
    } else {
      say(j.say || 'Try saying that another way.', [{ label: 'See every workflow', href: '/app/hq/start' }]);
    }
    if (voiced && j.kind !== 'nav') speak(j.say);
    else if (!voiced) mood('idle');
  };
  var send = function (text, voiced) {
    text = String(text || '').trim();
    if (!text) return;
    mood('thinking', 'Thinking');
    say('On it...');
    post('/app/hq/talk', { text: text }).then(function (j) { answer(j, voiced); }).catch(function (e) { mood('idle'); say(e.message); });
  };
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value, false);
    input.blur();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || !input || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
    e.preventDefault();
    input.focus();
  });

  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null;
  if (orb) orb.addEventListener('click', function () {
    if (!Rec) {
      input.focus();
      say('Voice needs Chrome or Safari. Type it here instead.');
      return;
    }
    if (rec) return rec.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    rec = new Rec();
    rec.lang = document.documentElement.lang || 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    var heard = '';
    rec.onresult = function (ev) {
      heard = Array.prototype.map.call(ev.results, function (r) { return r[0].transcript; }).join(' ');
      input.value = heard;
    };
    rec.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') say('Allow the microphone for this site, or type it here.');
    };
    rec.onend = function () {
      rec = null;
      if (heard.trim()) send(heard, true);
      else mood('idle');
    };
    mood('listening', 'Listening');
    try { rec.start(); } catch (err) { rec = null; mood('idle'); }
  });

  // ---------- copy buttons and confirms ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    var box = b && b.closest('.blk-copy');
    if (!box) return;
    var text = ($('pre', box) || {}).textContent || '';
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this', text); });
    else window.prompt('Copy this', text);
  });
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  }, true);

  // ---------- approvals: hold "pick up to N" ----------
  $$('form.h2-ask[data-max]').forEach(function (f) {
    var max = parseInt(f.getAttribute('data-max'), 10);
    if (!max) return;
    f.addEventListener('change', function (e) {
      if (e.target.name !== 'chosen' || !e.target.checked) return;
      if ($$('input[name=chosen]:checked', f).length > max) {
        e.target.checked = false;
        var tag = $('.h2-tag', f);
        if (tag) { tag.classList.add('lock'); setTimeout(function () { tag.classList.remove('lock'); }, 900); }
      }
    });
    f.addEventListener('submit', function (e) {
      var go = e.submitter && e.submitter.name === 'skip';
      if (!go && $$('input[name=chosen]', f).length && !$$('input[name=chosen]:checked', f).length) {
        e.preventDefault();
        window.alert('Pick at least one, or Skip.');
      }
    });
  });

  // ---------- a live run ----------
  var page = $('[data-run][data-live]');
  if (page) {
    var id = page.getAttribute('data-run');
    var started = Date.now();
    var timer = null;
    var every = function () { return page.getAttribute('data-status') === 'sleeping' ? 60000 : Date.now() - started > 120000 ? 6000 : 2500; };
    var check = function () {
      timer = null;
      if (document.hidden) return;
      fetch('/app/hq/runs/' + id + '/view.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
        if (!v) return;
        var changed = v.status !== page.getAttribute('data-status') || v.steps.some(function (s) {
          var li = $('[data-step="' + s.id + '"]', page);
          return li && li.getAttribute('data-step-status') !== s.status;
        });
        if (changed) return location.reload();
        v.steps.forEach(function (s) {
          var li = $('[data-step="' + s.id + '"]', page);
          if (!li || !s.progress || !s.progress.total) return;
          var d = $('[data-done]', li);
          if (d) d.textContent = s.progress.done;
          var bar = $('[data-bar]', li);
          if (bar) bar.style.width = Math.round(s.progress.done / s.progress.total * 100) + '%';
        });
        timer = setTimeout(check, every());
      }).catch(function () { timer = setTimeout(check, every() * 2); });
    };
    timer = setTimeout(check, every());
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !timer) check(); });
  }

  // ---------- Today: reload when a run moves or something new waits ----------
  var today = $('[data-today]');
  if (today && today.getAttribute('data-sig').indexOf(':') >= 0) {
    var tick = function () {
      if (document.hidden) return setTimeout(tick, 15000);
      fetch('/app/hq/today.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (t) {
        if (!t) return;
        var sig = t.running.map(function (x) { return x.id + ':' + x.status; }).join(',') + '|' + t.inbox;
        if (sig !== today.getAttribute('data-sig')) return location.reload();
        setTimeout(tick, 15000);
      }).catch(function () { setTimeout(tick, 30000); });
    };
    setTimeout(tick, 15000);
  }

  // ---------- Do my day ----------
  // A draft that still holds a [placeholder] can't be copied or opened until it's filled in.
  var HOLE = /\[[^\]\n]{2,60}\]/;
  var lock = function (card) {
    var ta = $('textarea[data-text]', card);
    var go = $('[data-go]', card);
    if (!ta || !go) return;
    var m = ta.value.match(HOLE);
    go.classList.toggle('off', !!m);
    if (m) go.setAttribute('aria-disabled', 'true');
    else go.removeAttribute('aria-disabled');
    var note = $('[data-hole]', card);
    if (note) {
      note.hidden = !m;
      var b = $('[data-hole-text]', note);
      if (b && m) b.textContent = m[0];
      // The address placeholder: one save in Your business fills every email.
      var help = $('[data-hole-help]', note);
      if (help) help.hidden = ta.value.indexOf(help.getAttribute('data-hole-help')) < 0;
    }
  };
  var mailto = function (href, subject, body) {
    var to = String(href).split('?')[0];
    return to + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(String(body || '').slice(0, 1800));
  };
  var copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () {});
    return Promise.resolve();
  };
  $$('.h2-q').forEach(function (card) {
    var ta = $('textarea[data-text]', card);
    if (!ta) return;
    var texts = {};
    var current = ($('[data-go]', card) || {}).getAttribute ? $('[data-go]', card).getAttribute('data-way-id') : '';
    ta.addEventListener('input', function () { lock(card); });
    $$('.h2-q-ways button', card).forEach(function (b) {
      texts[b.getAttribute('data-way')] = b.getAttribute('data-text') || '';
      b.addEventListener('click', function () {
        texts[current] = ta.value;
        current = b.getAttribute('data-way');
        $$('.h2-q-ways button', card).forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        ta.value = texts[current] || '';
        var sub = b.getAttribute('data-subject') || '';
        var subBox = $('.h2-q-subject', card);
        if (subBox) { subBox.hidden = !sub; $('[data-subject]', subBox).textContent = sub; }
        var go = $('[data-go]', card);
        go.setAttribute('href', b.getAttribute('data-href'));
        go.setAttribute('data-clip', b.getAttribute('data-clip') || '');
        go.setAttribute('data-way-id', current);
        go.textContent = b.getAttribute('data-go-label') || 'Open';
        lock(card);
      });
    });
    lock(card);
    card.fillName = function (name) {
      var fill = function (s) { return String(s || '').split('[business name]').join(name); };
      ta.value = fill(ta.value);
      Object.keys(texts).forEach(function (k) { texts[k] = fill(texts[k]); });
      $$('.h2-q-ways button', card).forEach(function (b) {
        b.setAttribute('data-text', fill(b.getAttribute('data-text')));
        b.setAttribute('data-subject', fill(b.getAttribute('data-subject')));
      });
      var sub = $('.h2-q-subject [data-subject]', card);
      if (sub) sub.textContent = fill(sub.textContent);
      lock(card);
    };
  });
  // A Google business's name is fetched when the member asks for it, and kept only on this page (Legal L53).
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gname]');
    if (!b || b.disabled) return;
    b.disabled = true;
    fetch('/app/hq/leads/' + encodeURIComponent(b.getAttribute('data-gname')) + '/name.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Try again in a moment.'); return j; }); })
      .then(function (j) {
        var box = b.closest('.h2-q') || b.closest('[data-lead]');
        var to = box && $('[data-gname-to]', box);
        if (to) to.textContent = j.name;
        if (box && box.fillName) box.fillName(j.name);
        b.remove();
      })
      .catch(function (err) { b.disabled = false; say(err.message); });
  });
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (!go) return;
    var card = go.closest('.h2-q');
    if (go.classList.contains('off')) { e.preventDefault(); return; }
    var ta = $('textarea[data-text]', card);
    var text = ta ? ta.value : '';
    var href = go.getAttribute('href');
    if (/^mailto:/i.test(href)) go.setAttribute('href', mailto(href, ($('[data-subject]', card) || {}).textContent, text));
    if (go.getAttribute('data-clip') === '1' && text) copyText(text).then(function () { say('Copied. Paste it in, send it, then tap Sent.'); });
    var sent = $('form[data-qact="sent"] button', card);
    if (sent) sent.classList.add('btn', 'sm');
  });

  var remove = function (card) {
    card.classList.add('gone');
    setTimeout(function () { card.remove(); }, 260);
  };
  var watch = function (runId, card) {
    var tries = 0;
    var note = el('p', { class: 'h2-q-why' }, 'Writing it now...');
    var acts = $('.h2-q-acts', card);
    if (acts) acts.replaceWith(note);
    else card.appendChild(note);
    var poll = function () {
      tries += 1;
      fetch('/app/hq/runs/' + runId + '/view.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
        if (v && (v.status === 'done' || v.status === 'failed' || v.status === 'stopped')) {
          if (v.status !== 'done') return (location.href = '/app/hq/runs/' + runId);
          location.hash = card.id;
          return location.reload();
        }
        if (tries > 90) return (location.href = '/app/hq/runs/' + runId);
        setTimeout(poll, tries < 20 ? 2000 : 5000);
      }).catch(function () { setTimeout(poll, 5000); });
    };
    setTimeout(poll, 1500);
  };
  document.addEventListener('submit', function (e) {
    var f = e.target;
    var act = f.getAttribute && f.getAttribute('data-qact');
    if (!act) return;
    e.preventDefault();
    var card = f.closest('.h2-q');
    var body = {};
    var t = $('textarea[name=text]', f);
    if (t) body.text = t.value;
    var buttons = $$('button', card);
    buttons.forEach(function (b) { b.disabled = true; });
    var name = ($('h3', card) || {}).textContent || '';
    post(f.getAttribute('action'), body).then(function (j) {
      if (act === 'sent') {
        paint(j.hundred);
        card.classList.add('sent');
        remove(card);
        var h = j.hundred || {};
        say(h.done && h.today === h.target ? 'That is ' + h.target + '. You did your day.' : 'Sent. ' + h.today + ' of ' + h.target + ' today.', [{ label: 'Undo', onClick: function () { post('/app/hq/queue/' + card.getAttribute('data-q') + '/undo', {}).then(function () { location.hash = card.id; location.reload(); }).catch(function (err) { say(err.message); }); } }]);
      } else if (act === 'skip' || act === 'lost') {
        remove(card);
        say(act === 'skip' ? name.split(' ·')[0] + ' is back tomorrow.' : 'Marked not interested.');
      } else if (act === 'won' && j.win) {
        location.href = j.win;
      } else if ((act === 'write' || act === 'replied') && j.run) {
        watch(j.run, card);
      } else {
        location.hash = card.id;
        location.reload();
      }
    }).catch(function (err) {
      buttons.forEach(function (b) { b.disabled = false; });
      say(err.message, /credits/i.test(err.message) ? [{ label: 'See Builder', href: '/app/billing', primary: true }] : []);
    });
  });

  // ---------- add your own files to the Library ----------
  // On the Library page, and beside a workflow's file input (which then picks the new file).
  var upload = function (file) {
    return fetch('/app/hq/library/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), Accept: 'application/json' },
      body: file,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Couldn't add that file. Try again.");
        return j.file;
      });
    });
  };
  var choose = function (box, f) {
    var sel = $('select', box);
    if (sel) return sel.add(new Option(f.name, f.id, true, true));
    var list = $('[data-pick-list]', box);
    if (!list) return;
    var cb = el('input', { type: 'checkbox', name: box.getAttribute('data-name'), value: f.id });
    cb.checked = true;
    var label = el('label', { class: 'h2-opt' });
    label.appendChild(cb);
    label.appendChild(el('span', {}, f.name));
    list.appendChild(label);
  };
  $$('[data-upload-input]').forEach(function (input) {
    input.addEventListener('change', function () {
      var box = input.closest('[data-pick]') || input.closest('[data-upload]');
      var msg = box && $('[data-upload-msg]', box);
      var tell = function (t) { if (msg) msg.textContent = t; };
      var files = Array.prototype.slice.call(input.files || []);
      input.value = '';
      var added = 0;
      var next = function () {
        var f = files.shift();
        if (!f) {
          tell(added === 1 ? 'Added.' : added + ' files added.');
          if (added && box && box.hasAttribute('data-upload')) location.reload();
          return;
        }
        tell('Adding ' + f.name + '...');
        upload(f).then(function (card) {
          added += 1;
          if (box && box.hasAttribute('data-pick')) choose(box, card);
          next();
        }).catch(function (err) { tell(err.message); });
      };
      next();
    });
  });

  // ---------- the win card ----------
  // Drawn here, so nothing about the member leaves their phone. No money on it, ever.
  var wc = $('[data-wincard]');
  if (wc && document.createElement('canvas').getContext) {
    var cv = document.createElement('canvas');
    cv.width = 1080;
    cv.height = 1350;
    var g = cv.getContext('2d');
    var sans = '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
    var bg = g.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#0d0d12');
    bg.addColorStop(1, '#050507');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1080, 1350);
    var glow = g.createRadialGradient(900, 180, 0, 900, 180, 620);
    glow.addColorStop(0, 'rgba(184,191,255,0.22)');
    glow.addColorStop(1, 'rgba(184,191,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 1080, 1350);
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 2;
    g.strokeRect(40, 40, 1000, 1270);
    g.fillStyle = '#e3e6f1';
    g.font = '700 64px ' + sans;
    g.fillText('127', 96, 160);
    g.fillStyle = 'rgba(227,230,241,0.55)';
    g.font = '500 26px ' + sans;
    g.fillText('W I N', 96, 520);
    var wrap = function (text, x, y, max, lh) {
      var words = String(text || '').split(/\s+/);
      var line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (g.measureText(test).width > max && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test;
      });
      if (line) g.fillText(line, x, y);
      return y + lh;
    };
    var steel = g.createLinearGradient(0, 560, 0, 860);
    steel.addColorStop(0, '#9a9fae');
    steel.addColorStop(1, '#ffffff');
    g.fillStyle = steel;
    g.font = '700 132px ' + sans;
    var y = wrap(wc.getAttribute('data-title'), 96, 690, 880, 140);
    var note = wc.getAttribute('data-note');
    if (note) {
      g.fillStyle = 'rgba(227,230,241,0.8)';
      g.font = '400 40px ' + sans;
      wrap('"' + note + '"', 96, y + 20, 880, 54);
    }
    var who = wc.getAttribute('data-name');
    g.fillStyle = '#86d6ad';
    g.font = '600 36px ' + sans;
    g.fillText((who ? who + ' · ' : '') + 'built with 127', 96, 1180);
    g.fillStyle = 'rgba(227,230,241,0.5)';
    g.font = '400 28px ' + sans;
    g.fillText('127group.io · Make today day one.', 96, 1240);
    var url = cv.toDataURL('image/png');
    var img = $('[data-wincard-img]', wc);
    img.src = url;
    img.hidden = false;
    var save = $('[data-save]');
    if (save) { save.href = url; save.hidden = false; }
    var share = $('[data-share]');
    if (share && navigator.canShare && cv.toBlob) {
      cv.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], '127-win.png', { type: 'image/png' });
        if (!navigator.canShare({ files: [file] })) return;
        share.hidden = false;
        share.addEventListener('click', function () {
          navigator.share({ files: [file], text: wc.getAttribute('data-title') + ' Built with 127.' }).catch(function () {});
        });
      }, 'image/png');
    }
  }

  // ---------- Start: search ----------
  var search = $('#wf-search');
  if (search) {
    var filter = function () {
      var words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      var any = false;
      $$('.h2-group').forEach(function (g) {
        var shown = 0;
        $$('.h2-card', g).forEach(function (c) {
          var hay = c.getAttribute('data-search') || '';
          var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
          c.hidden = !ok;
          if (ok) shown++;
        });
        g.hidden = !shown;
        if (shown) any = true;
      });
      var none = $('#wf-none');
      if (none) none.hidden = any;
    };
    search.addEventListener('input', filter);
    if (search.value) filter();
  }

  // ---------- Pipeline: move a lead without a reload ----------
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.closest || !f.closest('.h2-lead .moves')) return;
    e.preventDefault();
    var card = f.closest('.h2-lead');
    var stage = $('input[name=stage]', f).value;
    $$('button', card).forEach(function (b) { b.disabled = true; });
    post(f.getAttribute('action'), { stage: stage }).then(function (j) {
      Object.keys(j.counts || {}).forEach(function (s) { $$('[data-col-count="' + s + '"]').forEach(function (n) { n.textContent = j.counts[s]; }); });
      paint(j.hundred);
      card.classList.add('gone');
      setTimeout(function () { location.reload(); }, 220);
    }).catch(function (err) {
      $$('button', card).forEach(function (b) { b.disabled = false; });
      window.alert(err.message);
    });
  });
})();
