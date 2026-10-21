// Life · Faith (lib/life, held until Legal clears `faith`): Bible reading plans and prayer or reading blocks, kept in
// the member's browser only, and off until the member turns it on. A plan splits each of its tracks (a run of books,
// content/life/bible.json) evenly over its days; today's reading opens on Bible Gateway in the member's translation.
// Blocks go to the member's own calendar as an .ics file, repeating weekly; nothing is sent anywhere.
// Data: { on, plan, start, translation, done: { dayIndex: 1 }, blocks: [{ id, name, time, minutes, days: ['MO', ...] }] }.
(function () {
  'use strict';
  var L = window.Life, el = L.el;
  var B = L.state.bible || { books: [], plans: [], translations: [] };
  var DAYS = [['MO', 'Mon'], ['TU', 'Tue'], ['WE', 'Wed'], ['TH', 'Thu'], ['FR', 'Fri'], ['SA', 'Sat'], ['SU', 'Sun']];
  var d = null;

  function clean(x) {
    x = x || {};
    var plan = B.plans.some(function (p) { return p.id === x.plan; }) ? x.plan : 'gospels';
    var done = {};
    if (x.done && typeof x.done === 'object') Object.keys(x.done).slice(0, 400).forEach(function (k) { if (/^\d{1,3}$/.test(k) && x.done[k]) done[k] = 1; });
    var blocks = (Array.isArray(x.blocks) ? x.blocks : []).slice(0, 12).map(function (b) {
      return { id: String(b.id || L.uid()).slice(0, 20), name: String(b.name || '').slice(0, 40), time: /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ? b.time : '06:30',
        minutes: Math.min(240, Math.max(5, Math.round(L.num(b.minutes)) || 20)), days: (Array.isArray(b.days) ? b.days : []).filter(function (k) { return DAYS.some(function (q) { return q[0] === k; }); }) };
    });
    return { on: !!x.on, plan: plan, start: /^\d{4}-\d{2}-\d{2}$/.test(x.start) ? x.start : L.today(), translation: B.translations.some(function (t) { return t[0] === x.translation; }) ? x.translation : 'KJV', done: done, blocks: blocks };
  }
  function example() {
    var o = clean({ on: true, plan: 'gospels', start: L.addDays(L.today(), -9), translation: 'KJV',
      blocks: [{ name: 'Prayer', time: '06:30', minutes: 20, days: ['MO', 'TU', 'WE', 'TH', 'FR'] }, { name: 'Reading', time: '21:00', minutes: 15, days: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] }] });
    [0, 1, 2, 3, 4, 5, 7, 8].forEach(function (i) { o.done[i] = 1; });
    return o;
  }
  function commit() { L.save(d); draw(); }

  // ---------- plans ----------
  function chapters(from, to) {
    var out = [], on = false;
    B.books.forEach(function (b) {
      if (b.name === from) on = true;
      if (on) for (var c = 1; c <= b.chapters; c++) out.push([b.name, c]);
      if (b.name === to) on = false;
    });
    return out;
  }
  // Each track's chapters split evenly over the plan's days: day i reads [i*T/N, (i+1)*T/N).
  function readings(p) {
    var tracks = p.tracks.map(function (t) { return chapters(t[0], t[1]); });
    var out = [];
    for (var i = 0; i < p.days; i++) {
      out.push(tracks.map(function (ch) { return ch.slice(Math.floor(i * ch.length / p.days), Math.floor((i + 1) * ch.length / p.days)); }).filter(function (r) { return r.length; }));
    }
    return out;
  }
  // [[Genesis,1],[Genesis,2],[Exodus,1]] -> "Genesis 1–2; Exodus 1"
  function label(run) {
    var parts = [], i = 0;
    while (i < run.length) {
      var j = i;
      while (j + 1 < run.length && run[j + 1][0] === run[i][0] && run[j + 1][1] === run[j][1] + 1) j++;
      parts.push(run[i][0] + ' ' + run[i][1] + (j > i ? '–' + run[j][1] : ''));
      i = j + 1;
    }
    return parts.join('; ');
  }
  function link(runs) {
    var q = runs.map(function (r) { return label(r).replace(/–/g, '-'); }).join('; ');
    return 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(q) + '&version=' + encodeURIComponent(d.translation);
  }
  function dayIndex() { return Math.round((Date.parse(L.today() + 'T12:00:00') - Date.parse(d.start + 'T12:00:00')) / 864e5); }

  // ---------- calendar ----------
  function ics() {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var now = new Date(), stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + '00Z';
    var esc = function (s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Life Faith//EN', 'CALSCALE:GREGORIAN'];
    d.blocks.filter(function (b) { return b.days.length; }).forEach(function (b) {
      // The first day on or after today that the block repeats on, at the block's time in the member's own time zone.
      var t = new Date(); t.setHours(12, 0, 0, 0);
      for (var k = 0; k < 7 && b.days.indexOf(DAYS[(t.getDay() + 6) % 7][0]) < 0; k++) t.setDate(t.getDate() + 1);
      var hm = b.time.split(':'), s = new Date(t.getFullYear(), t.getMonth(), t.getDate(), +hm[0], +hm[1]), e = new Date(s.getTime() + b.minutes * 60000);
      var f = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
      lines.push('BEGIN:VEVENT', 'UID:' + b.id + '@life.127group.io', 'DTSTAMP:' + stamp, 'DTSTART:' + f(s), 'DTEND:' + f(e), 'RRULE:FREQ=WEEKLY;BYDAY=' + b.days.join(','), 'SUMMARY:' + esc(b.name || 'Time with God'), 'TRANSP:OPAQUE', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' }));
    var a = el('a', { href: url, download: '127-faith-blocks.ics' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    L.say('Calendar file saved. Open it to add the blocks to your calendar.', 'ok');
  }
  function clock(t) { var p = t.split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' am' : ' pm'); }

  // ---------- drawing ----------
  function optIn() {
    return el('div', { class: 'lf-start fa-in' }, [
      el('p', { class: 'fa-verse' }, [el('span', { text: 'Except the LORD build the house, they labour in vain that build it.' }), el('cite', { text: 'Psalm 127:1, KJV' })]),
      el('p', { class: 'lf-start-q', text: 'A reading plan and time set apart.' }),
      el('p', { class: 'lf-start-s', text: 'Faith stays off until you turn it on. Your plan and blocks live on this device only, and you can delete them any time.' }),
      el('div', { class: 'lf-start-b' }, [el('button', { type: 'button', class: 'lf-go', text: 'Turn on Faith', onclick: function () { d.on = true; d.start = L.today(); commit(); } })]),
    ]);
  }

  function draw() {
    var root = L.root;
    var focusId = document.activeElement && document.activeElement.id;
    root.innerHTML = '';
    if (!d.on) { root.appendChild(optIn()); return; }
    var p = B.plans.filter(function (x) { return x.id === d.plan; })[0] || B.plans[0];
    var all = readings(p), today = Math.min(Math.max(dayIndex(), 0), p.days - 1), doneN = Object.keys(d.done).filter(function (k) { return +k < p.days; }).length;
    var missed = []; for (var i = 0; i < today; i++) if (!d.done[i]) missed.push(i);
    var finished = dayIndex() >= p.days;

    // Today.
    var t = all[today];
    root.appendChild(el('div', { class: 'fa-today' + (d.done[today] ? ' is-done' : '') }, [
      el('span', { class: 'lf-k', text: (finished ? 'Last day' : 'Day ' + (today + 1) + ' of ' + p.days) + ' · ' + p.title }),
      el('a', { class: 'fa-read', href: link(t), target: '_blank', rel: 'noopener noreferrer' }, [el('b', { text: t.map(label).join(' · ') }), el('span', { text: 'Read in ' + d.translation + ' ↗' })]),
      el('div', { class: 'fa-today-b' }, [
        el('button', { type: 'button', class: d.done[today] ? 'lf-act' : 'lf-go', text: d.done[today] ? 'Read ✓' : 'Mark as read', 'aria-pressed': d.done[today] ? 'true' : 'false', onclick: function () { if (d.done[today]) delete d.done[today]; else d.done[today] = 1; commit(); } }),
        el('span', { class: 'fa-prog' }, [el('i', { style: '--w:' + Math.round((doneN / p.days) * 100) + '%' })]),
        el('span', { class: 'lf-d', text: doneN + ' of ' + p.days + ' days read' }),
      ]),
    ]));

    // Catch up, without starting over.
    if (missed.length) {
      root.appendChild(el('section', { class: 'lf-panel' }, [
        el('h2', { class: 'lf-h', text: 'Catch up' }),
        el('p', { class: 'lf-sub', text: missed.length === 1 ? 'One day to catch up. No need to start over.' : missed.length + ' days to catch up. Read them in any order; no need to start over.' }),
        el('ul', { class: 'lf-rows fa-rows' }, missed.slice(-14).reverse().map(function (i) {
          return el('li', null, [
            el('span', { class: 'lf-rows-d', text: 'Day ' + (i + 1) }),
            el('a', { class: 'lf-rows-n', href: link(all[i]), target: '_blank', rel: 'noopener noreferrer' }, [el('b', { text: all[i].map(label).join(' · ') })]),
            el('button', { type: 'button', class: 'lf-act sm', text: 'Read', onclick: function () { d.done[i] = 1; commit(); } }),
          ]);
        })),
      ]));
    }

    // Blocks.
    var blocks = el('div', { class: 'fa-blocks' }, d.blocks.map(function (b, bi) {
      var time = el('input', { class: 'lf-sel', type: 'time', id: 'fa-t-' + b.id, value: b.time, 'aria-label': 'Start time for ' + (b.name || 'block'), onchange: function (e) { if (/^\d{2}:\d{2}$/.test(e.target.value)) { b.time = e.target.value; commit(); } } });
      return el('div', { class: 'fa-block' }, [
        el('div', { class: 'fa-block-top' }, [
          L.text({ id: 'fa-n-' + b.id, value: b.name, placeholder: 'Prayer, Reading, Sabbath…', max: 40, onInput: function (v) { b.name = v; L.save(d); } }),
          el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Remove ' + (b.name || 'block'), text: '×', onclick: function () { d.blocks.splice(bi, 1); commit(); } }),
        ]),
        el('div', { class: 'fa-block-row' }, [time, L.choice({ label: 'Length', options: [[15, '15 min'], [20, '20'], [30, '30'], [60, '60']], value: b.minutes, onPick: function (v) { b.minutes = v; commit(); } })]),
        L.choice({ label: 'Days', multi: true, options: DAYS, value: b.days, onPick: function (v) { var k = b.days.indexOf(v); if (k >= 0) b.days.splice(k, 1); else b.days.push(v); b.days.sort(function (a, c) { return DAYS.findIndex(function (q) { return q[0] === a; }) - DAYS.findIndex(function (q) { return q[0] === c; }); }); commit(); } }),
        el('span', { class: 'lf-note-s', text: b.days.length ? clock(b.time) + ', ' + b.minutes + ' minutes, ' + (b.days.length === 7 ? 'every day' : b.days.map(function (k) { return DAYS.filter(function (q) { return q[0] === k; })[0][1]; }).join(' ')) : 'Pick the days this repeats.' }),
      ]);
    }));
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Time set apart' }),
      el('p', { class: 'lf-sub', text: 'Block the time before the week fills it. Add these to your calendar and they repeat every week.' }),
      blocks,
      el('div', { class: 'lf-start-b' }, [
        el('button', { type: 'button', class: 'lf-act', text: 'Add a block', disabled: d.blocks.length >= 12 ? true : null, onclick: function () { var id = L.uid(); d.blocks.push({ id: id, name: '', time: '06:30', minutes: 20, days: ['MO', 'TU', 'WE', 'TH', 'FR'] }); commit(); var n = document.getElementById('fa-n-' + id); if (n) n.focus(); } }),
        el('button', { type: 'button', class: 'lf-go', text: 'Add to my calendar', disabled: d.blocks.some(function (b) { return b.days.length; }) ? null : true, onclick: ics }),
      ]),
    ]));

    // Plan and translation.
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Your plan' }),
      el('div', { class: 'fa-plans' }, B.plans.map(function (x) {
        var on = x.id === d.plan;
        return el('button', { type: 'button', class: 'fa-plan' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () {
          if (on) return;
          if (doneN && !window.confirm('Start ' + x.title + ' today? Your progress on ' + p.title + ' is cleared.')) return;
          d.plan = x.id; d.start = L.today(); d.done = {}; commit();
        } }, [el('b', { text: x.title }), el('span', { text: x.line })]);
      })),
      el('div', null, [el('span', { class: 'lf-f-l', text: 'Translation' }), L.choice({ label: 'Translation', options: B.translations.map(function (t) { return [t[0], t[0]]; }), value: d.translation, onPick: function (v) { d.translation = v; commit(); } })]),
      el('p', { class: 'lf-note-s', text: (B.translations.filter(function (t) { return t[0] === d.translation; })[0] || [, , ''])[1] + '. Readings open on Bible Gateway. Started ' + L.day(d.start) + '.' }),
      el('button', { type: 'button', class: 'lf-act', text: 'Turn off Faith', onclick: function () {
        if (!window.confirm('Turn off Faith and delete your plan and blocks from this device?')) return;
        d = clean({}); try { localStorage.removeItem('127life:' + L.state.scope + ':faith'); } catch (e) { /* nothing kept */ }
        draw(); L.say('Faith is off. Nothing is kept on this device.', 'ok');
      } }),
    ]));
    if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) { f.focus(); if (f.setSelectionRange && f.type === 'text') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  }

  d = L.state.keep ? clean(L.load()) : example();
  L.current = function () { return d; };
  L.onData = function (x) { d = clean(x); draw(); };
  draw();
})();
