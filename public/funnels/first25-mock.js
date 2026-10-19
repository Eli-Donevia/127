// First 25 samples: the mockup made for one business (a reel, a post grid, a homepage, a chat,
// an email or a shot list). The words and colors come from F25.mock() (first25-engine.js);
// this file only draws them. No outside images or fonts, so the static preview looks the same.
// Every mockup carries "Sample by {me} · Not their real {website}" so a screenshot can't be mistaken.
(function (root) {
  var e = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var initials = function (name) {
    var w = String(name || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  // Text on the accent color: dark on light accents, white on the rest.
  var onAcc = function (hex) {
    var n = parseInt(String(hex).replace('#', ''), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
  };
  var vars = function (m) { return '--mk-bg:' + m.pal[0] + ';--mk-ink:' + m.pal[1] + ';--mk-acc:' + m.pal[2] + ';--mk-on:' + onAcc(m.pal[2]); };
  var wm = function (m) { return '<div class="mk-wm">' + e(m.by) + ' · ' + e(m.notReal) + '</div>'; };
  var box = function (m, cls, inner) { return '<div class="mk ' + cls + (m.serif ? ' mk-serif' : '') + '" style="' + vars(m) + '">' + inner + wm(m) + '</div>'; };

  var draw = {
    site: function (m) {
      var year = new Date().getFullYear();
      return box(m, 'mk-site',
        '<div class="mk-bar"><i></i><i></i><i></i><span>' + e(m.biz) + ' · new homepage</span></div>' +
        '<div class="mk-page">' +
          '<div class="mk-nav"><b>' + e(m.biz) + '</b><span class="mk-burger" aria-hidden="true"><i></i><i></i></span></div>' +
          '<div class="mk-hero"><h5>' + e(m.hero) + '</h5><p>' + e(m.sub) + '</p><span class="mk-btn">' + e(m.cta) + '</span>' +
            (m.rating ? '<div class="mk-rate"><b>★ ' + e(m.rating) + '</b>' + (m.reviews ? ' · ' + e(m.reviews) + ' Google reviews' : '') + '</div>' : '') +
          '</div>' +
          '<div class="mk-secs">' + m.secs.map(function (s) { return '<div><b>' + e(s[0]) + '</b><span>' + e(s[1]) + '</span></div>'; }).join('') + '</div>' +
          '<div class="mk-cta"><b>Ready when you are.</b><span class="mk-btn">' + e(m.cta) + '</span></div>' +
          '<div class="mk-foot"><b>' + e(m.biz) + '</b>' + (m.address ? '<span>' + e(m.address) + '</span>' : '') + (m.phone ? '<span>' + e(m.phone) + '</span>' : '') + '<span>© ' + year + ' ' + e(m.biz) + '</span></div>' +
        '</div>');
    },
    grid: function (m) {
      return box(m, 'mk-ig',
        '<div class="mk-ig-top"><span class="mk-av">' + e(initials(m.biz)) + '</span><div><b>' + e(m.instagram ? '@' + m.instagram : m.biz) + '</b><span>' + e(cap(m.one)) + ' in ' + e(m.city) + '</span></div></div>' +
        '<div class="mk-ig-bio"><b>' + e(m.biz) + '</b><span>' + e(m.sub) + '</span><span class="mk-link">' + e(m.cta) + ' ↓</span></div>' +
        '<div class="mk-grid">' + m.grid.slice(0, 9).map(function (t, i) { return '<div class="mk-tile t' + (i % 3) + '"><span>' + e(t) + '</span></div>'; }).join('') + '</div>');
    },
    shots: function (m) {
      return box(m, 'mk-shots',
        '<div class="mk-shots-top"><b>Shot list</b><span>' + e(m.biz) + '</span></div>' +
        '<div class="mk-grid">' + m.grid.slice(0, 9).map(function (t, i) {
          return '<div class="mk-tile t' + (i % 3) + '"><em>' + (i + 1) + '</em><i class="mk-cam" aria-hidden="true"></i><span>' + e(t) + '</span></div>';
        }).join('') + '</div>');
    },
    reel: function (m) {
      var scenes = [m.hook].concat(m.lines.slice(0, 3));
      return box(m, 'mk-reel',
        '<div class="mk-reel-frame" data-reel data-scene="0" role="img" aria-label="' + e('A 15-second reel for ' + m.biz + ': ' + scenes.join('. ') + '. ' + m.end) + '">' +
          '<div class="mk-prog"><i></i></div><div class="mk-flash"></div>' +
          scenes.map(function (t, i) { return '<div class="mk-sc" data-s="' + i + '"><b>' + e(t) + '</b></div>'; }).join('') +
          '<div class="mk-sc mk-end" data-s="4"><span class="mk-logo">' + e(m.biz) + '</span><b>' + e(m.end) + '</b></div>' +
          '<div class="mk-tag">' + e(m.by) + '</div>' +
        '</div>' +
        '<div class="mk-reel-hint">15 seconds, on a loop. Tap to pause.</div>');
    },
    chat: function (m) {
      var msgs = [['bot', m.chat.hi], ['me', m.q], ['bot', m.a], ['me', m.chat.yes], ['bot', m.chat.done]];
      return box(m, 'mk-chat',
        '<div class="mk-chat-top"><span class="mk-av">' + e(initials(m.biz)) + '</span><div><b>' + e(m.biz) + '</b><span><i class="mk-dot"></i>' + e(m.chat.online) + '</span></div></div>' +
        '<div class="mk-chat-body">' + msgs.map(function (x, i) { return '<div class="mk-msg ' + x[0] + '" style="animation-delay:' + (0.25 + i * 0.9).toFixed(2) + 's">' + e(x[1]) + '</div>'; }).join('') + '</div>' +
        '<div class="mk-chat-in"><span>' + e(m.chat.type) + '</span><i></i></div>');
    },
    email: function (m) {
      return box(m, 'mk-mail',
        '<div class="mk-mail-head"><span class="mk-av">' + e(initials(m.biz)) + '</span><div><b>' + e(m.biz) + '</b><span>' + e(m.email.subject) + '</span><em>' + e(m.email.pre) + '</em></div></div>' +
        '<div class="mk-mail-card">' +
          '<div class="mk-mail-band">' + e(m.biz) + '</div>' +
          '<div class="mk-mail-body"><h5>' + e(m.email.subject) + '</h5>' + m.email.body.map(function (p) { return '<p>' + e(p) + '</p>'; }).join('') +
            '<span class="mk-btn">' + e(m.cta) + '</span><p class="mk-sig">' + e(m.email.sign) + '</p></div>' +
          '<div class="mk-mail-foot">' + e(m.email.foot) + '</div>' +
        '</div>');
    },
  };

  // The reel plays as timed scenes (hook, 3 lines, their name), with a flash on each cut.
  var TIMES = [2500, 3000, 3000, 3500, 3000];
  function play(frame) {
    if (frame._mk) return;
    var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var st = frame._mk = { i: 0, t: null, paused: false };
    var show = function (i) {
      frame.setAttribute('data-scene', String(i));
      if (i === 0) { frame.classList.remove('mk-run'); void frame.offsetWidth; frame.classList.add('mk-run'); }
      frame.classList.remove('mk-cut'); void frame.offsetWidth; frame.classList.add('mk-cut');
    };
    var next = function () {
      if (!frame.isConnected) return;
      if (st.paused) { st.t = setTimeout(next, 250); return; }
      st.i = (st.i + 1) % TIMES.length;
      show(st.i);
      st.t = setTimeout(next, TIMES[st.i]);
    };
    show(0);
    if (reduced) { frame.setAttribute('data-scene', '4'); return; }
    st.t = setTimeout(next, TIMES[0]);
    frame.addEventListener('click', function () {
      st.paused = !st.paused;
      frame.classList.toggle('mk-paused', st.paused);
    });
  }

  root.F25MOCK = {
    render: function (m) { return m && draw[m.kind] ? draw[m.kind](m) : ''; },
    start: function (el) { Array.prototype.forEach.call((el || document).querySelectorAll('[data-reel]'), play); },
  };
})(window);
