// The coach's website and challenge page markup: one file for the kit studio's preview (public/coaches/index.html loads
// it as /js/coach-site.js), the downloaded file, and the hosted site at 127group.io/c/<slug> (lib/coach-hosting.js).
// Three looks (brand.look: athletic, editorial, bold), the coach's color as the accent, their logo and photo (brand.logo,
// brand.photo: a data: URL on the phone, a 127 file URL once hosted). The styles are the <style id="siteCss"> block in
// public/coaches/index.html.
//
// opts.live   true: the kit studio's editable preview (text gets data-e paths and contenteditable).
// opts.base   the hosted site's own path ('/c/<slug>', or '' on a coach's own domain later). Set, the site's join
//             buttons go to the challenge page (base + '/challenge') and the logo links home. Unset: in-page anchors.
// opts.join   hosted challenge page only: the markup for the join block (a form, or a link), built per request.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CoachSite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOOKS = ['athletic', 'editorial', 'bold'];
  // The display and body font files each look uses (public/fonts/coach), for preloading on the hosted site.
  var FONTS = {
    athletic: ['big-shoulders-display-normal-500-900.woff2', 'hanken-grotesk-normal-400.woff2'],
    editorial: ['instrument-serif-normal-400.woff2', 'inter-normal-400.woff2'],
    bold: ['unbounded-normal-500-900.woff2', 'onest-normal-400-600.woff2'],
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function look(brand) { return brand && LOOKS.indexOf(brand.look) >= 0 ? brand.look : 'athletic'; }
  // An editable piece of text: path into the kit, so the edit survives a rebuild.
  function E(tag, path, text, live, cls) { return '<' + tag + (cls ? ' class="' + cls + '"' : '') + (live ? ' data-e="' + path + '" contenteditable="plaintext-only" spellcheck="true"' : '') + '>' + esc(text) + '</' + tag + '>'; }
  function initials(n) { return String(n || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  // Text on the coach's color: dark on light colors, white on dark ones.
  function onColor(hex) {
    var n = parseInt(String(hex).slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    var L = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return (0.2126 * L(r) + 0.7152 * L(g) + 0.0722 * L(b)) > 0.4 ? '#0b0b0d' : '#ffffff';
  }
  function cdown(start) { var ms = Math.max(0, Date.parse(start + 'T09:00:00') - Date.now()); return [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60]; }
  function dateShort(iso) { var d = new Date(iso + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  // Only the coach's own handle links out (the form's sample handle never does).
  function realHandle(f) { return f.handle && f.handle !== 'reyesstrength' ? f.handle : ''; }

  function csOpen(f, brand) { return '<div class="cs" data-look="' + look(brand) + '" style="--ac:' + esc(f.color) + ';--on:' + onColor(f.color) + '">'; }
  function navHTML(f, brand, o, links, cta, href) {
    var logo = brand.logo ? '<img src="' + esc(brand.logo) + '" alt="' + esc(f.business) + '">' : '<span class="mk">' + esc(initials(f.business)) + '</span>';
    var home = o.base != null ? '<a class="cs-logo" href="' + esc(o.base || '/') + '">' : '<div class="cs-logo">';
    return '<header class="cs-nav"><div class="in">' + home + logo + '<span>' + esc(f.business) + '</span>' + (o.base != null ? '</a>' : '</div>') + (links ? '<nav class="cs-links">' + links + '</nav>' : '') + '<a class="cs-btn sm" href="' + esc(href) + '">' + esc(cta) + '</a></div></header>';
  }
  // No photo yet: the challenge drawn as a ring of days, one tick a day, the first week filled in.
  function ringArt(f) {
    var n = f.days, t = '', R = 150;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 2 * Math.PI - Math.PI / 2, on = i < Math.min(7, n);
      t += '<line x1="' + (200 + Math.cos(a) * (R - 18)).toFixed(1) + '" y1="' + (200 + Math.sin(a) * (R - 18)).toFixed(1) + '" x2="' + (200 + Math.cos(a) * R).toFixed(1) + '" y2="' + (200 + Math.sin(a) * R).toFixed(1) + '" class="' + (on ? 'on' : '') + '"/>';
    }
    return '<svg class="ring" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="178" class="o"/><circle cx="200" cy="200" r="108" class="o"/>' + t + '<text x="200" y="214" text-anchor="middle" class="d">Day 1</text><text x="200" y="250" text-anchor="middle" class="s">of ' + n + '</text></svg>';
  }
  function media(f, brand, tag, o, lead) {
    // The hero photo is the page's largest paint on the hosted site: no lazy loading, high priority, real size hints.
    var img = brand.photo ? '<img src="' + esc(brand.photo) + '" alt="' + esc(f.coach) + '"' + (o && o.base != null ? (lead ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"') + ' width="1280" height="1600"' : '') + '>' : ringArt(f);
    return '<div class="cs-media rv d2' + (brand.photo ? '' : ' art') + '">' + img + tag + '</div>';
  }
  function countHTML(f, extra) { var c = cdown(f.start); return '<div class="cs-count' + (extra || '') + '" data-start="' + esc(f.start) + '">' + ['days', 'hours', 'min', 'sec'].map(function (u, i) { return '<div><b>' + String(c[i]).padStart(2, '0') + '</b><span>' + u + '</span></div>'; }).join('') + '</div>'; }
  function band(c) { return '<div class="cs-band" aria-hidden="true"><div>' + [0, 1].map(function () { return c.rules.map(function (r) { return '<span>' + esc(r.replace(/\.$/, '')) + '</span>'; }).join(''); }).join('') + '</div></div>'; }

  function site(kit, brand, opts) {
    brand = brand || {}; var o = opts || {}; var live = !!o.live;
    var f = kit.facts, s = kit.site, c = kit.challenge, h = realHandle(f);
    var hosted = o.base != null;
    var joinHref = hosted ? (o.base || '') + '/challenge#cs-join' : '#cs-apply';
    var applyHref = h ? 'https://instagram.com/' + h : (hosted ? joinHref : '#cs-apply');
    return csOpen(f, brand) + navHTML(f, brand, o, '<a href="#cs-coach">Coaching</a><a href="#cs-ch">Challenge</a><a href="#cs-about">About</a><a href="#cs-faq">Questions</a>', s.cta, '#cs-apply') +
      '<section class="cs-hero"><div class="in grid"><div><p class="cs-kick rv">Online coaching for ' + esc(f.who) + '</p>' +
        E(live ? 'h2' : 'h1', 'site.heroTitle', s.heroTitle, live, 'dsp rv d1' + (s.heroTitle.length > 44 ? ' long' : '')) + E('p', 'site.heroSub', s.heroSub, live, 'sub rv d2') +
        '<div class="cs-ctas rv d3"><a class="cs-btn" href="#cs-apply">' + esc(s.cta) + ' &rarr;</a><a class="cs-btn ghost" href="#cs-ch">The ' + f.days + '-day challenge</a></div></div>' +
        media(f, brand, '<div class="tag"><div><strong>' + esc(c.title) + '</strong><span>' + esc(c.dates) + '</span></div></div>', o, true) + '</div>' +
        '<div class="in"><div class="cs-facts rv"><div><b>' + f.days + '</b><span>days in the challenge</span></div><div><b>1</b><span>workout a day, in the app</span></div><div><b>' + esc(c.price) + '</b><span>to join</span></div></div></div></section>' +
      band(c) +
      '<section class="cs-sec" id="cs-coach"><div class="in"><div class="cs-head rv"><p class="cs-label">Coaching</p><h2 class="dsp">Two ways to train with ' + esc(f.first) + '.</h2></div><div class="cs-cards">' +
        s.program.map(function (p, i) { return '<div class="cs-card rv d' + (i + 1) + (i ? ' hl' : '') + '"><span class="no">0' + (i + 1) + '</span><h3 class="dsp">' + esc(p.name) + '</h3>' + E('p', 'site.program.' + i + '.line', p.line, live) + '<div class="pr"><b>' + esc(p.price) + '</b><a href="' + esc(i ? applyHref : joinHref) + '">' + (i ? 'Apply' : 'Join') + ' &rarr;</a></div></div>'; }).join('') + '</div></div></section>' +
      '<section class="cs-sec"><div class="in"><div class="cs-head rv"><p class="cs-label">How it works</p><h2 class="dsp">Three steps. Then you train.</h2></div><div class="cs-steps">' +
        s.steps.map(function (p, i) { return '<div class="cs-step rv d' + (i + 1) + '"><em>0' + (i + 1) + '</em><div>' + E('b', 'site.steps.' + i + '.title', p.title, live) + E('span', 'site.steps.' + i + '.body', p.body, live) + '</div></div>'; }).join('') + '</div></div></section>' +
      '<section class="cs-sec" id="cs-ch"><div class="in"><div class="cs-ch rv"><div><small>' + esc(c.dates) + '</small><h3 class="dsp">' + esc(c.title) + '</h3>' + E('p', 'challenge.line', c.line, live) + countHTML(f) +
        '<a class="cs-btn" href="' + esc(joinHref) + '">Join for ' + esc(c.price) + ' &rarr;</a></div><ol>' + c.rules.map(function (r, i) { return E('li', 'challenge.rules.' + i, r, live); }).join('') + '</ol></div></div></section>' +
      '<section class="cs-sec" id="cs-about"><div class="in cs-about">' + media(f, brand, '', o) + '<div class="rv d1"><p class="cs-label" style="margin-bottom:18px">About ' + esc(f.first) + '</p>' +
        E('blockquote', 'site.about', s.about, live) + '<cite>' + esc(f.coach) + ', ' + esc(f.business) + '</cite></div></div></section>' +
      '<section class="cs-sec" id="cs-faq"><div class="in cs-faq"><div class="cs-head rv" style="display:block"><p class="cs-label">Questions</p><h2 class="dsp" style="margin-top:12px">Before you apply.</h2></div><div class="rv d1">' +
        s.faq.map(function (q, i) { return '<details' + (live ? ' open' : '') + '><summary>' + E('span', 'site.faq.' + i + '.q', q.q, live) + '</summary>' + E('p', 'site.faq.' + i + '.a', q.a, live) + '</details>'; }).join('') + '</div></div></section>' +
      '<section class="cs-end" id="cs-apply"><div class="in"><h2 class="dsp rv">Start on ' + esc(dateShort(f.start)) + '.</h2><a class="cs-btn rv d1" href="' + esc(applyHref) + '">' + esc(s.cta) + ' &rarr;</a></div></section>' +
      '<footer class="cs-foot"><div class="in"><span>' + esc(f.business) + (h ? ' · @' + esc(h) : '') + '</span><span>Check with your doctor before starting a new exercise plan.</span>' + (o.foot || '') + '</div></footer></div>';
  }

  function challenge(kit, brand, opts) {
    brand = brand || {}; var o = opts || {}; var live = !!o.live;
    var f = kit.facts, c = kit.challenge;
    var joinBlock = o.join != null ? o.join : '<a class="cs-btn rv d1" href="#">Join for ' + esc(c.price) + ' &rarr;</a>';
    return csOpen(f, brand) + navHTML(f, brand, o, o.base != null ? '<a href="' + esc(o.base || '/') + '">' + esc(f.first) + '\'s coaching</a>' : '', 'Join', '#cs-join') +
      '<section class="cs-hero"><div class="in grid"><div><p class="cs-kick rv">' + esc(c.dates) + '</p>' + E(live ? 'h2' : 'h1', 'challenge.title', c.title, live, 'dsp rv d1' + (c.title.length > 44 ? ' long' : '')) + E('p', 'challenge.line', c.line, live, 'sub rv d2') +
        '<div class="rv d3">' + countHTML(f, ' cs-count-l') + '<a class="cs-btn" href="#cs-join">Join for ' + esc(c.price) + ' &rarr;</a></div></div>' +
        media(f, brand, '<div class="tag"><div><strong>' + esc(f.coach) + '</strong><span>' + esc(f.business) + '</span></div><i>' + f.days + '</i></div>', o, true) + '</div></section>' +
      band(c) +
      '<section class="cs-sec"><div class="in"><div class="cs-head rv"><p class="cs-label">Every day</p><h2 class="dsp">The rules.</h2></div><div class="cs-steps">' + c.rules.map(function (r, i) { return '<div class="cs-step rv d' + (i % 3 + 1) + '"><em>0' + (i + 1) + '</em>' + E('div', 'challenge.rules.' + i, r, live) + '</div>'; }).join('') + '</div></div></section>' +
      '<section class="cs-sec"><div class="in"><div class="cs-head rv"><p class="cs-label">What you get</p><h2 class="dsp">Everything is in the app.</h2></div><div class="cs-cards">' + c.get.map(function (r, i) { return '<div class="cs-card rv d' + (i % 2 + 1) + '" style="min-height:0"><span class="no">0' + (i + 1) + '</span>' + E('p', 'challenge.get.' + i, r, live) + '</div>'; }).join('') + '</div></div></section>' +
      '<section class="cs-end" id="cs-join"><div class="in"><h2 class="dsp rv">' + E('span', 'challenge.finish', c.finish, live) + '</h2>' + joinBlock + '</div></section>' +
      '<footer class="cs-foot"><div class="in"><span>' + esc(f.business) + '</span><span>Check with your doctor before starting a new exercise plan.</span>' + (o.foot || '') + '</div></footer></div>';
  }

  return { LOOKS: LOOKS, FONTS: FONTS, site: site, challenge: challenge, esc: esc, E: E, initials: initials, onColor: onColor, cdown: cdown, dateShort: dateShort, look: look };
});
