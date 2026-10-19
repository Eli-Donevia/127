// First 25 engine: drops chains and closed businesses, scores how much each business needs what
// you sell (from the gaps on its website and listing), ranks them, and writes the messages, the
// free sample and the CSV. Pure functions only: the page and the server (lib/first25.js) run the
// same code, so the list on screen, the CSV and the email can't disagree.
// Copy lives in first25-data.js. Website checks happen on the server (lib/site-audit.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./first25-data.js'));
  else root.F25 = factory(root.FIRST25);
})(typeof self !== 'undefined' ? self : this, function (D) {
  var E = { D: D, TOP: 25 };

  E.fill = function (s, v) {
    return String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null && v[k] !== '' ? String(v[k]) : m; });
  };

  E.pack = function (id) { return D.packs[id] || D.packs.other; };
  E.buyer = function (id) { return D.buyers[id] || D.buyers.restaurants; };

  // "Des Moines, IA 50309" -> "Des Moines". A ZIP alone stays as typed ("in 50309" reads fine).
  E.cityOf = function (place) {
    var p = String(place || '').trim();
    var first = p.split(',')[0].trim();
    return first.replace(/\s+\d{5}(-\d{4})?$/, '') || p;
  };

  // ---------- chains ----------
  var norm = function (s) { return ' ' + String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; };
  E.isChain = function (name, buyerId) {
    var n = norm(name);
    return (E.buyer(buyerId).chains || []).some(function (c) { return n.indexOf(norm(c)) !== -1; });
  };

  // ---------- gaps and fit ----------
  // b: { name, website, rating, reviews, instagram, site: {checked, ok, https, ms, video, socials, booking, chat, pixel, gads, form, signup, viewport, description, footerYear, images} }
  E.gapTests = {
    site_down: function (b) { return !!b.website && !!b.site && b.site.checked && !b.site.ok; },
    broken_link: function (b) { return !!(b.site && b.site.ok && b.site.brokenLink); },
    no_site: function (b) { return !b.website; },
    no_video: function (b, s) { return s && !s.video; },
    no_tiktok: function (b, s) { return s && !(s.socials || {}).tiktok; },
    no_youtube: function (b, s) { return s && !(s.socials || {}).youtube; },
    no_instagram: function (b, s) { return s && !(s.socials || {}).instagram && !b.instagram; },
    no_facebook: function (b, s) { return s && !(s.socials || {}).facebook; },
    no_pixel: function (b, s) { return s && s.pixel === false; },
    no_booking: function (b, s) { return s && !s.booking; },
    no_chat: function (b, s) { return s && !s.chat; },
    no_form: function (b, s) { return s && !s.form; },
    no_signup: function (b, s) { return s && !s.signup; },
    stale_footer: function (b, s, now) { return s && s.footerYear > 1990 && s.footerYear <= now.getFullYear() - 2; },
    no_https: function (b, s) { return s && s.https === false; },
    no_mobile: function (b, s) { return s && s.viewport === false; },
    slow: function (b, s) { return s && s.ms > 3000; },
    no_description: function (b, s) { return s && s.description === false; },
    few_images: function (b, s) { return s && s.images != null && s.images < 6; },
    few_reviews: function (b) { return b.reviews != null && b.reviews < 40; },
  };
  E.fitTests = {
    ads: function (b, s) { return s && (s.pixel || s.gads); },
    booking: function (b, s) { return s && !!s.booking; },
    busy: function (b) { return b.reviews >= 50; },
    rated: function (b) { return b.rating >= 4.6 && b.reviews >= 20; },
    independent: function () { return true; },
  };

  function vars(b, buyerId, ctx) {
    var B = E.buyer(buyerId);
    return {
      biz: b.name, city: (ctx && ctx.city) || '', what: B.what, film: B.film, thing: B.thing, one: B.one, many: B.many,
      year: b.site && b.site.footerYear, reviews: b.reviews, rating: b.rating,
      end: B.end || 'Come try a ' + B.thing + '.',
    };
  }

  // Score 1-99: points for each gap this service fixes, plus signs they'd buy. Reasons in plain words.
  E.score = function (b, packId, buyerId, now) {
    now = now || new Date();
    var P = E.pack(packId), s = b.site && b.site.ok ? b.site : null, v = vars(b, buyerId);
    var gaps = [], fits = [], raw = 0;
    Object.keys(P.gaps).forEach(function (id) {
      if (E.gapTests[id] && E.gapTests[id](b, s, now)) {
        var G = D.gaps[id];
        gaps.push({ id: id, points: P.gaps[id], chip: E.fill(G.chip, v), why: E.fill(G.why, v) });
        raw += P.gaps[id];
      }
    });
    Object.keys(P.fit).forEach(function (id) {
      if (E.fitTests[id] && E.fitTests[id](b, s, now)) {
        fits.push({ id: id, points: P.fit[id], why: E.fill(D.fits[id].why, v) });
        raw += P.fit[id];
      }
    });
    gaps.sort(function (x, y) { return y.points - x.points; });
    fits.sort(function (x, y) { return y.points - x.points; });
    return { score: Math.max(1, Math.min(99, Math.round(raw))), gaps: gaps, fits: fits, unchecked: !!b.website && !(b.site && b.site.checked) };
  };

  // The words for each gap and fit, from the business as it is now. Saved lists keep only the ids and points,
  // so a line that quotes Google's numbers ("23 Google reviews") is filled from a fresh fetch, never stored
  // (Legal L53). A line that needs a number we don't have is left out.
  E.words = function (b, buyerId) {
    var v = vars(b, buyerId);
    var fill = function (list, T, chip) {
      return (list || []).map(function (g) {
        var t = T[g.id];
        if (!t) return null;
        var o = { id: g.id, points: g.points, why: E.fill(t.why, v) };
        if (chip) o.chip = E.fill(t.chip, v);
        return /\{\w+\}/.test(o.why + (o.chip || '')) ? null : o;
      }).filter(Boolean);
    };
    return { gaps: fill(b.gaps, D.gaps, true), fits: fill(b.fits, D.fits, false) };
  };

  // The facts a message states: the first gap in the DM, the first 2 in the email (E.messages), so the
  // page can put a "Check it first" link at each one (Legal L53 part 3.4).
  E.facts = function (b, tab) {
    var n = tab === 'dm' ? 1 : tab === 'email' ? 2 : 0;
    return (b.gaps || []).filter(function (g) { return D.gaps[g.id] && D.gaps[g.id].say; }).slice(0, n);
  };
  // Where to see a fact for yourself: their website for what we read there, the map listing for the rest.
  E.checkLink = function (b, gapId) {
    if (['no_site', 'few_reviews', 'broken_link'].indexOf(gapId) !== -1) return b.mapsUrl || null;
    return b.website && !/\.example(\/|$)/.test(b.website) ? b.website : null;
  };

  // ---------- rank ----------
  // "Grit Fitness LLC" and "Grit Fitness" are one business.
  var baseName = function (s) { return norm(s).replace(/ (llc|inc|co|company|corp|ltd|pllc|pc|the) /g, ' ').replace(/ (llc|inc|co|company|corp|ltd|pllc|pc|the) /g, ' ').trim(); };
  var domainOf = function (u) { return String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[\/?#:].*$/, ''); };
  // Listing links that many businesses share, so they never mark two businesses as one.
  var SHARED_HOSTS = /(^|\.)(facebook|instagram|linktr|yelp|google|goo|square|squareup|wixsite|business|mindbodyonline|vagaro|booksy|toasttab|clover|godaddysites|weebly|carrd)\./;
  // list: businesses from a source. Returns the top 25 plus honest counts for the summary.
  E.rank = function (list, o) {
    var now = o.now || new Date(), top = o.top || E.TOP;
    var seen = {}, counts = {}, stats = { found: list.length, chains: 0, closed: 0, dupes: 0 };
    (list || []).forEach(function (b) { var k = baseName(b.name); counts[k] = (counts[k] || 0) + 1; });
    var kept = [];
    (list || []).forEach(function (b) {
      var k = baseName(b.name);
      if (b.closed) { stats.closed++; return; }
      if (E.isChain(b.name, o.buyer) || counts[k] >= 3) { stats.chains++; return; }
      // The same business listed twice: same name, same website or same phone number.
      var keys = ['n:' + k], dom = domainOf(b.website), tel = String(b.phone || '').replace(/\D/g, '').slice(-10);
      if (dom && !SHARED_HOSTS.test(dom)) keys.push('w:' + dom);
      if (tel.length === 10) keys.push('p:' + tel);
      if (keys.some(function (x) { return seen[x]; })) { stats.dupes++; return; }
      keys.forEach(function (x) { seen[x] = 1; });
      kept.push(Object.assign({}, b, E.score(b, o.pack, o.buyer, now)));
    });
    kept.sort(function (x, y) { return y.score - x.score || (y.reviews || 0) - (x.reviews || 0) || String(x.name).localeCompare(String(y.name)); });
    stats.independent = kept.length;
    stats.checked = kept.filter(function (b) { return b.site && b.site.ok; }).length;
    stats.gaps = {};
    kept.forEach(function (b) { b.gaps.forEach(function (g) { stats.gaps[g.id] = (stats.gaps[g.id] || 0) + 1; }); });
    var prospects = kept.slice(0, top).map(function (b, i) { return Object.assign(b, { rank: i + 1 }); });
    return { prospects: prospects, stats: stats };
  };

  // The 3 numbers on the summary: the gaps this service fixes that showed up most.
  E.headline = function (stats, packId) {
    var P = E.pack(packId);
    return Object.keys(P.gaps)
      // Gaps worth at least 8 points to this service, so a minor one never leads the summary.
      .filter(function (id) { return stats.gaps[id] > 0 && id !== 'few_reviews' && P.gaps[id] >= 8; })
      .sort(function (a, b) { return P.gaps[b] * stats.gaps[b] - P.gaps[a] * stats.gaps[a]; })
      .slice(0, 3)
      .map(function (id) { return { id: id, n: stats.gaps[id], of: id === 'no_site' || id === 'site_down' ? stats.independent : stats.checked }; });
  };
  var LINES = {
    site_down: 'websites that didn\'t load', broken_link: 'have a broken website link on their map listing', no_site: 'have no website', no_video: 'show no video on their homepage', no_tiktok: 'don\'t link a TikTok',
    no_youtube: 'don\'t link a YouTube', no_instagram: 'don\'t link an Instagram', no_facebook: 'don\'t link a Facebook page', no_pixel: 'have no ad pixel',
    no_booking: 'have no online booking', no_chat: 'have no chat', no_form: 'have no contact form', no_signup: 'have no email signup',
    stale_footer: 'have a footer at least 2 years old', no_https: 'aren\'t secure (no https)', no_mobile: 'aren\'t set up for phones', slow: 'took over 3 seconds to load',
    no_description: 'have no description for search results', few_images: 'have under 6 photos on their homepage', few_reviews: 'have under 40 Google reviews',
  };
  E.headlineLine = function (h) { return h.n + ' of ' + h.of + ' ' + (LINES[h.id] || ''); };

  // ---------- messages ----------
  // ctx: { me (sender's first name), city, service (only for "Something else") }
  E.messages = function (b, packId, buyerId, ctx) {
    ctx = ctx || {};
    var P = E.pack(packId), B = E.buyer(buyerId);
    var v = vars(b, buyerId, ctx);
    var other = packId === 'other' || !D.packs[packId];
    v.me = ctx.me || '[your name]';
    v.sell = other && ctx.service ? ctx.service : P.sell;
    v.verb = other && ctx.service ? 'do ' + ctx.service : P.verb;
    var says = (b.gaps || []).map(function (g) { return D.gaps[g.id] && D.gaps[g.id].say; }).filter(Boolean);
    var say1 = says[0] ? E.fill(says[0], v) : E.fill("I've been looking at how {many} in {city} show up online, and I had an idea for {biz}.", v);
    // The second gap reads as an add-on: "Also, your website doesn't link to an Instagram."
    var say2 = says[1] ? 'Also, ' + E.fill(says[1], v).replace(/^(\w)(?!['’ ])/, function (c) { return c.toLowerCase(); }) : '';
    var offer = E.fill(P.offer, v);
    var intro = E.fill('I\'m {me}, and I {verb} for {many} in {city}.', v);
    // An email ends with the sender's name, mailing address and the opt-out (Legal L53 part 3.1). DMs, calls and walk-ins don't.
    var sign = '\n\n' + v.me + '\n' + (ctx.addr || '[your mailing address]') + '\n\n' + D.copy.emailOptOut;
    var follow1 = E.fill('Hi {biz} team, it\'s {me} again. ', v) + E.fill(P.follow1, v), follow2 = E.fill(D.copy.follow2, v);
    return {
      dm: E.fill('Hi {biz} team. ', v) + intro + ' ' + say1 + ' ' + offer + ' No cost, no catch. Want me to send it over?',
      subject: E.fill(P.subject, v),
      email: E.fill('Hi {biz} team,', v) + '\n\n' + [say1, say2].filter(Boolean).join(' ') + '\n\n' + intro + ' ' + offer + '\n\nIf you like it, we can talk. If not, it\'s yours to keep.\n\nWant me to send it?' + sign,
      walkin: E.fill('Hi, I\'m {me}. I {verb} for local {many}. ', v) + E.fill(P.walkin, v),
      follow1: follow1,
      follow2: follow2,
      follow1Email: follow1 + sign,
      follow2Email: follow2 + sign,
    };
  };

  E.spec = function (b, packId, buyerId, ctx) {
    var P = E.pack(packId), S = D.specs[P.sample] || D.specs.other;
    var v = vars(b, buyerId, ctx);
    v.hook = E.fill(D.hooks[buyerId] || 'Meet {biz}', v);
    var out = { title: E.fill(S.title, v), steps: S.steps.map(function (s) { return E.fill(s, v); }) };
    if (S.board) out.board = S.board.map(function (r) { return [r[0], E.fill(r[1], v)]; });
    return out;
  };

  // What to say when they answer. Same fields as the messages, for one business.
  E.replies = function (b, packId, buyerId, ctx) {
    ctx = ctx || {};
    var P = E.pack(packId), v = vars(b, buyerId, ctx);
    var other = packId === 'other' || !D.packs[packId];
    v.me = ctx.me || '[your name]';
    v.verb = other && ctx.service ? 'do ' + ctx.service : P.verb;
    return D.replies.map(function (r) { return { id: r.id, label: r.label, text: E.fill(r.text, v) }; });
  };

  // Where to send the message, best first: visual services lead with Instagram, the rest with email.
  // Each way says which message fits it (dm, email or walkin) and the link that opens it, if any.
  E.channels = function (b, packId) {
    var s = b.site || {}, so = s.socials || {}, out = [];
    var ig = b.instagram || so.instagram, fb = so.facebook && so.facebook !== 'page' ? so.facebook : null;
    var visual = ['video', 'social', 'photo'].indexOf(packId) !== -1;
    var site = b.website && !/\.example(\/|$)/.test(b.website) ? b.website : null;
    if (ig) out.push({ id: 'ig', label: 'Instagram DM', to: '@' + ig, href: 'https://ig.me/m/' + encodeURIComponent(ig), text: 'dm', rank: visual ? 0 : 2 });
    if (b.email) out.push({ id: 'email', label: 'Email', to: b.email, href: 'mailto:' + b.email, text: 'email', rank: visual ? 1 : 0 });
    if (fb) out.push({ id: 'fb', label: 'Facebook message', to: 'facebook.com/' + fb, href: 'https://m.me/' + encodeURIComponent(fb), text: 'dm', rank: visual ? 2 : 3 });
    if (site && !b.email) out.push({ id: 'site', label: 'The form on their website', to: site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: site, text: 'email', rank: visual ? 3 : 1 });
    if (b.phone) out.push({ id: 'call', label: 'Call or walk in', to: b.phone, href: 'tel:' + String(b.phone).replace(/[^\d+]/g, ''), text: 'walkin', rank: 4 });
    if (!out.length) out.push({ id: 'walk', label: 'Walk in', to: b.address || '', href: null, text: 'walkin', rank: 5 });
    return out.sort(function (x, y) { return x.rank - y.rank; });
  };

  // "We read 37 websites and checked each one for 18 things." A count, never a time-saved claim.
  // Website checks only (no_site and few_reviews come from the listing).
  E.SITE_CHECKS = Object.keys(E.gapTests).filter(function (id) { return id !== 'no_site' && id !== 'few_reviews'; }).length;
  E.saved = function (n, sample) {
    if (sample) return E.fill(D.copy.savedSample, { checks: E.SITE_CHECKS });
    return n ? E.fill(n === 1 ? D.copy.saved1 : D.copy.saved, { n: n, checks: E.SITE_CHECKS }) : '';
  };

  // ---------- the sample made for them ----------
  // Everything a mockup needs for one business, filled in: the kind (reel, grid, site, chat, email,
  // shots), its words and colors. Rendering is first25-mock.js; this stays pure so tests can read it.
  E.mockKind = function (packId) { return D.mock.kinds[packId] || null; };
  E.mock = function (b, packId, buyerId, ctx) {
    var kind = E.mockKind(packId);
    if (!kind) return null;
    ctx = ctx || {};
    var M = D.mock, base = M.base, own = M.buyers[buyerId] || {};
    var v = vars(b, buyerId, ctx);
    v.ask = own.ask || base.ask;
    v.hook = E.fill(D.hooks[buyerId] || 'Meet {biz}', v);
    var f = function (s) { return E.fill(s, v); };
    var pick = function (k) { return own[k] != null ? own[k] : base[k]; };
    var shots = own.shots || M.shots;
    return {
      kind: kind, biz: b.name, city: v.city, one: v.one, me: ctx.me || '', serif: !!own.serif,
      pal: pick('pal'), cta: f(pick('cta')), hero: f(pick('hero')), sub: f(pick('sub')),
      secs: pick('secs').map(function (x) { return [f(x[0]), f(x[1])]; }),
      grid: (kind === 'shots' ? shots : pick('grid')).map(f),
      lines: pick('lines').map(f), hook: v.hook, end: v.end,
      q: f(pick('q')), a: f(pick('a')),
      chat: { hi: f(M.chat.hi), yes: M.chat.yes, done: f(M.chat.done), online: M.chat.online, type: M.chat.type },
      email: { subject: f(M.email.subject), pre: f(M.email.pre), body: M.email.body.map(f), sign: f(M.email.sign), foot: f(M.email.foot) },
      title: M.titles[kind], note: f(M.notes[kind]),
      by: ctx.me ? E.fill(M.by, { me: ctx.me }) : M.byNone, notReal: E.fill(M.notReal, { surface: M.surface[kind] }),
      // Real listing facts only.
      rating: b.rating || null, reviews: b.reviews != null ? b.reviews : null, address: b.address || '', phone: b.phone || '',
      instagram: b.instagram || ((b.site || {}).socials || {}).instagram || '',
    };
  };

  // Niche doors: /first-25/gyms opens on video for gyms with its own headline.
  E.niche = function (id) { return Object.prototype.hasOwnProperty.call(D.niches, id) ? D.niches[id] : null; };

  // "Not sure what to sell?": a like, whether they'll walk into a business, and their hours.
  E.pick = function (like, walkIn, hours) {
    var m = D.picker.map[like] || D.picker.map.film;
    var buyer = walkIn ? m[1] : m[2];
    return { pack: m[0], buyer: buyer, why: D.picker.why[m[0] + '|' + buyer] || '', note: D.picker.hoursNote[hours] || '' };
  };

  // Everything the page, CSV and email need, from one ranked list.
  E.build = function (list, o) {
    var r = E.rank(list, o);
    var ctx = { me: o.me, city: o.city || E.cityOf(o.place), service: o.service };
    r.prospects.forEach(function (b, i) {
      b.msg = E.messages(b, o.pack, o.buyer, ctx);
      if (i < 3) b.spec = E.spec(b, o.pack, o.buyer, ctx);
    });
    r.headline = E.headline(r.stats, o.pack);
    return r;
  };

  E.stageLabel = function (id) {
    var s = D.stages.filter(function (x) { return x.id === id; })[0] || D.stages[0];
    return s.label;
  };

  // ---------- CSV (Sheets, Notion, Airtable) ----------
  // Google runs leave out every Google field, names and websites included (Legal L53 part 1.4): the file keeps
  // 127's own findings, the messages and a map link built from the place ID. OpenStreetMap and sample runs
  // include everything.
  var GOOGLE_COLS = ['Business', 'Website', 'Phone', 'Address'];
  E.csv = function (run) {
    var google = run.source === 'google';
    var head = ['Rank', 'Business', 'Score', 'Gaps', 'Why', 'Website', 'Instagram', 'Phone', 'Address', 'Map link', 'DM', 'Email subject', 'Email', 'Walk-in or call', 'Follow-up day 3', 'Follow-up day 7', 'Day 3 by email', 'Day 7 by email', 'Status'];
    var keep = head.map(function (h) { return !(google && GOOGLE_COLS.indexOf(h) !== -1); });
    var only = function (cells) { return cells.filter(function (x, i) { return keep[i]; }); };
    var esc = function (x) {
      var t = String(x == null ? '' : x);
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // never a spreadsheet formula
      return '"' + t.replace(/"/g, '""') + '"';
    };
    var rows = [only(head).map(esc).join(',')];
    (run.prospects || []).forEach(function (b) {
      var m = b.msg || {};
      rows.push(only([
        b.rank, b.name, b.score, (b.gaps || []).map(function (g) { return g.chip; }).join('; '),
        (b.gaps || []).concat(b.fits || []).map(function (g) { return g.why; }).join(' '),
        b.website || '', b.instagram || ((b.site && b.site.socials && b.site.socials.instagram) ? '@' + b.site.socials.instagram : ''),
        b.phone || '', b.address || '', b.mapsUrl || '',
        m.dm, m.subject, m.email, m.walkin, m.follow1, m.follow2, m.follow1Email, m.follow2Email, E.stageLabel(((run.status || {})[b.rank] || {}).s),
      ]).map(esc).join(','));
    });
    var attr = (D.copy.attribution || {})[run.source];
    if (google) rows.push('', esc(D.copy.csvGoogleFile));
    if (attr) rows.push('', esc(attr));
    return rows.join('\r\n');
  };

  // ---------- sample businesses (made up, labeled on the page) ----------
  // Deterministic for the same buyer and place, so a shared preview shows the same list.
  var NAMES = {
    gyms: [['Iron', 'Forge', 'Summit', 'Northside', 'Anvil', 'Kinetic', 'Rally', 'Grit', 'Foundry', 'Ember', 'Atlas', 'Tandem', 'Riverbend', 'Oakline', 'Harbor', 'Union', 'Midtown', 'Elevate', 'Lantern', 'Steadfast', 'Granite', 'Copperline', 'Westgate', 'Fieldhouse', 'Blackline', 'Keystone', 'Ironwood', 'Valor', 'Northstar', 'Southpaw', 'Redline', 'Cornerstone', 'Trailhead', 'Lakeshore', 'Prairie', 'Driftwood', 'Highline', 'Old Mill', 'Torch', 'Stockyard', 'Ridgeline', 'Pioneer', 'Bridgeway', 'Crosstown', 'Daybreak', 'Hammer & Oak', 'Basecamp', 'Brickhouse'], ['Strength', 'Fitness', 'Athletics', 'Barbell Club', 'Training', 'Performance', 'Boxing', 'Strength Co.', 'Fitness Studio', 'Gym']],
    yoga: [['Still Water', 'Lumen', 'Saltlight', 'Juniper', 'Open Door', 'Willow', 'Northstar', 'Tidal', 'Cedar', 'Sunday', 'Common Ground', 'Lotus Lane', 'Driftwood', 'Moonrise', 'Quiet Hour', 'Golden Hour', 'Wildflower', 'Bluebird', 'River Stone', 'Fernwood', 'Clearwater', 'Daybreak', 'Little Light', 'Haven', 'Soft Earth', 'Blue Heron', 'Slow Morning', 'Kindred', 'True North', 'Meadow', 'Sol', 'Sage', 'Bodhi', 'Prana', 'Evergreen', 'Lighthouse', 'Riverwalk', 'Two Hands', 'Breathwork', 'Stillpoint', 'Field & Flow', 'Saltwater', 'Lark', 'Gather'], ['Yoga', 'Pilates', 'Yoga Studio', 'Pilates Co.', 'Hot Yoga', 'Movement']],
    restaurants: [['Copper', 'Little', 'Brick', 'Oak', 'Fig', 'Saffron', 'Ember', 'Blue Door', 'Corner', 'Harvest', 'Juniper', 'Salt', 'Sunday', 'Paper Lantern', 'Rye', 'Marigold', 'Two Rivers', 'Basil', 'Iron Skillet', 'Golden', 'Lucky', 'Red Oak', 'Mama Rosa\'s', 'Nana\'s', 'Old Town', 'Riverfront', 'Southside', 'Lotus', 'Jade Garden', 'Casa Luna', 'El Sol', 'Little Saigon', 'Pepper', 'Maple', 'Big Sky', 'Green Chile', 'Night Owl', 'Bluebird', 'Honeycomb', 'Smoke & Oak', 'Hearth', 'Olive Branch', 'Sesame', 'Tin Roof', 'Cast Iron', 'Garden Gate'], ['Kitchen', 'Table', 'Cafe', 'Taqueria', 'Pho House', 'Bistro', 'Grill', 'Pizza Co.', 'Bakery', 'Noodle Bar', 'Diner', 'Smokehouse']],
    salons: [['Gold Leaf', 'Fade', 'Velvet', 'Crown', 'Mirror', 'Halo', 'Juniper', 'Shear', 'Sterling', 'Bloom', 'Ivory', 'Southside', 'Sharp', 'Kept', 'Clean Cut', 'Rose', 'Lux', 'Willow', 'Mane', 'Blade & Comb', 'Gentry', 'Honey', 'Ritual', 'Fringe', 'Twist', 'Polished', 'Lavender', 'Copper', 'Saint', 'Signature', 'Uptown', 'Sixth Street', 'Hollow', 'Gloss', 'Avenue', 'Parlor', 'Monarch', 'Cut & Color', 'Northside', 'Studio Nine', 'Lineup', 'Freshly', 'Golden Comb', 'Rosewood', 'Main Street'], ['Salon', 'Barbershop', 'Hair Studio', 'Barber Co.', 'Beauty Bar', 'Studio']],
    medspas: [['Glow', 'Luma', 'Clearwater', 'Radiance', 'Pure', 'Aurelia', 'Bloom', 'True', 'Halcyon', 'Linden', 'Solstice', 'Ever', 'Dewdrop', 'Opal', 'Serene', 'Vela', 'Refine', 'Nova', 'Silk', 'Bellamy', 'Amara', 'Revive', 'Haven', 'Iris', 'Fresh Face', 'Luxe', 'Rosé', 'Pearl', 'Skin Theory', 'Golden Hour', 'Lumiere', 'Sage', 'Velour', 'Willow', 'Clarity', 'Mirabel', 'Brio', 'Elan', 'Petal', 'Lotus', 'Ivy', 'Alder', 'Juno', 'Maren'], ['Med Spa', 'Skin Clinic', 'Aesthetics', 'Skin Studio']],
    dentists: [['Riverside', 'Bright', 'Maple', 'Northpoint', 'Gentle', 'Westside', 'Parkview', 'Lakeside', 'Hometown', 'Prairie', 'Elmwood', 'Oak Hill', 'Southridge', 'Willow Creek', 'Fairview', 'Brookside', 'Kind', 'Village', 'Heritage', 'Greenway', 'Sunrise', 'Cedar Ridge', 'Valley', 'Clear Creek', 'Pine Grove', 'Meadowbrook', 'Main Street', 'Crossroads', 'Pleasant Hill', 'Summit', 'Birchwood', 'Eastgate', 'Highland', 'Linden', 'Union Square', 'Waterside', 'Stonebridge', 'Forest Park', 'Harbor View', 'Hillcrest', 'Old Orchard', 'Pinecrest', 'Rivermont', 'Shady Oak'], ['Dental', 'Family Dentistry', 'Dental Care', 'Smiles']],
    chiro: [['Align', 'Motion', 'Keystone', 'Restore', 'Backbone', 'Peak', 'Core', 'Balance', 'Kinetic', 'True Spine', 'Upright', 'Evolve', 'Thrive', 'Momentum', 'Pinnacle', 'Revive', 'Synergy', 'Elevate', 'Foundation', 'Total Body', 'Active Life', 'Hometown', 'Northside', 'River City', 'Lakeside', 'Summit', 'Vital', 'Body Works', 'Straight Path', 'Stride', 'Anchor', 'Mainspring', 'Back in Motion', 'Forward', 'Heartland', 'Clearpath', 'Southside', 'Integrity', 'Bridge', 'Renew', 'Westend', 'Uptown', 'Flex', 'Prime'], ['Chiropractic', 'Physical Therapy', 'Spine & Sport', 'Wellness']],
    realtors: [['Front Porch', 'Brick & Key', 'Hearthstone', 'Open House', 'Northgate', 'Prairie', 'Cornerstone', 'Bluestem', 'Key & Crest', 'Homeward', 'Keystone', 'Main Street', 'Doorstep', 'Rooftop', 'Heartland', 'Oak & Ivy', 'Gateway', 'Home Base', 'River City', 'Lighthouse', 'Landmark', 'Village', 'Hometown', 'Next Door', 'True North', 'Porchlight', 'Elm & Main', 'Welcome Home', 'Red Door', 'Oakwood', 'Fieldstone', 'Northwind', 'Sunset', 'Harvest', 'Copper Key', 'Two Rivers', 'Meridian', 'Haven', 'Corner Lot', 'Bluebird', 'Stonegate', 'Wayfinder', 'Front Door', 'Sweet Home'], ['Realty', 'Home Team', 'Real Estate Group', 'Homes']],
    contractors: [['Summit', 'Patriot', 'Northside', 'Reliable', 'Blue Flame', 'True Level', 'Hometown', 'Prairie', 'Ironclad', 'Copper Pipe', 'Straight Line', 'Benchmark', 'All Season', 'Tri-County', 'Heartland', 'Precision', 'Liberty', 'Arrow', 'Cornerstone', 'Keystone', 'Trusted', 'Pro Flow', 'Brightside', 'Square One', 'Level Best', 'First Call', 'Good Neighbor', 'Red Door', 'Anchor', 'Clearwater', 'Riverside', 'Southside', 'Old School', 'Honest Hands', 'Bluestem', 'Crossroads', 'Westside', 'Signal', 'Northstar', 'Two Sons', 'Hammerhead', 'Plumb Line', 'Fair Deal', 'Steady'], ['Plumbing', 'Heating & Air', 'Roofing', 'HVAC', 'Plumbing & Drain', 'Electric']],
    auto: [['Hometown', 'Precision', 'Eastside', 'Gearhead', 'Torque', 'Shine', 'Northline', 'Midway', 'Two Brothers', 'Main Street', 'Honest', 'Pit Stop', 'Redline', 'Southside', 'Crossroads', 'Mile Marker', 'Lug Nut', 'Westside', 'Old Town', 'Downshift', 'Clean Slate', 'Highway', 'Heartland', 'Gold Star', 'Uptown', 'Riverside', 'Blue Collar', 'Wrench & Bolt', 'Second Gear', 'Northside', 'Overdrive', 'Spark', 'Straight Shot', 'Gas Light', 'Tailgate', 'Ironside', 'Corner', 'Pistons', 'Roadside', 'Gloss', 'Fender', 'Chrome', 'Axle', 'Junction'], ['Auto Repair', 'Automotive', 'Auto Spa', 'Detailing', 'Garage', 'Collision']],
    boutiques: [['Marigold', 'Thread', 'Juniper', 'Wren', 'Prairie Rose', 'Olive', 'Indigo', 'Sparrow', 'Linen', 'Fern', 'Magnolia', 'Poppy', 'Clover', 'Hazel', 'Saffron', 'Ivy', 'Daisy Lane', 'Bluebird', 'Cotton', 'Laurel', 'Plum', 'Rosemary', 'Honey & Oak', 'Mabel', 'June', 'Violet', 'Gingham', 'Sunday Best', 'Kindling', 'Field Day', 'Hemlock', 'Paper Moon', 'Wildrose', 'Birdie', 'Main & Vine', 'Petal', 'Lark', 'Copper Fox', 'Goldie', 'Little Wren', 'Dahlia', 'Tulip', 'Sage', 'Maven'], ['Boutique', 'Goods', 'Mercantile', 'Collective', 'Shop', 'Co.']],
    law: [['Hartley', 'Ellison', 'Bennett', 'Carver', 'Sato', 'Okafor', 'Reyes', 'Lindqvist', 'Abernathy', 'Nguyen', 'Patel', 'Moreno', 'Kowalski', 'Brennan', 'Whitaker', 'Delgado', 'Osei', 'Haddad', 'Fischer', 'Park', 'Murphy', 'Castillo', 'Johansson', 'Adeyemi', 'Garrison', 'Mendoza', 'Larsen', 'Achebe', 'Romero', 'Calloway', 'Sullivan', 'Tanaka', 'Novak', 'Ibarra', 'Whitfield', 'Ostrowski', 'Banerjee', 'Duarte', 'Holloway', 'Kim', 'Ferreira', 'Mbeki', 'Quinlan', 'Vasquez'], [' Law', ' & Associates', ' Law Group', ' Legal']],
  };
  var STREETS = ['Grand Ave', 'Ingersoll Ave', 'Main St', 'University Ave', 'Park Ave', 'Oak St', 'Elm St', '2nd Ave', 'Court Ave', 'Fleur Dr', 'Cedar St', 'Lincoln Way', 'Market St', 'River Rd'];
  var BOOKING = { gyms: 0.6, yoga: 0.8, salons: 0.65, medspas: 0.7, dentists: 0.4, chiro: 0.5, restaurants: 0.45, contractors: 0.25, auto: 0.2, boutiques: 0.3, law: 0.15, realtors: 0.1 };
  var VIDEO = { gyms: 0.35, yoga: 0.3, restaurants: 0.18, salons: 0.25, medspas: 0.35, realtors: 0.45, dentists: 0.2, chiro: 0.25, contractors: 0.15, auto: 0.12, boutiques: 0.2, law: 0.15 };

  function rng(seedStr) {
    var h = 1779033703 ^ seedStr.length;
    for (var i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    var a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var slug = function (s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };

  E.sample = function (buyerId, place, now) {
    now = now || new Date();
    var r = rng(buyerId + '|' + String(place || '').toLowerCase().trim());
    var pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    var chance = function (p) { return r() < p; };
    var N = NAMES[buyerId] || NAMES.restaurants, city = E.cityOf(place) || 'your city', year = now.getFullYear();
    // Every first word once before any repeats, so the list doesn't read as generated.
    var firsts = N[0].slice();
    for (var j = firsts.length - 1; j > 0; j--) { var x = Math.floor(r() * (j + 1)), t = firsts[j]; firsts[j] = firsts[x]; firsts[x] = t; }
    var n = Math.min(38 + Math.floor(r() * 10), firsts.length), out = [], used = {};
    for (var i = 0; out.length < n && i < n * 6; i++) {
      var name = (firsts[out.length % firsts.length] + (N[1][0].charAt(0) === ' ' ? '' : ' ') + pick(N[1])).trim();
      if (used[name]) continue;
      used[name] = 1;
      var hasSite = chance(0.86), loads = chance(0.94), reviews = Math.round(Math.exp(1 + r() * 6.2));
      var b = {
        id: 'sample-' + out.length, name: name, sample: true,
        address: (100 + Math.floor(r() * 4800)) + ' ' + pick(STREETS) + ', ' + city,
        phone: '(555) 555-01' + String(out.length).padStart(2, '0'),
        website: hasSite ? 'https://' + slug(name) + '.example' : null,
        rating: Math.round((3.9 + r() * 1.1) * 10) / 10, reviews: reviews,
        mapsUrl: null,
      };
      if (hasSite) {
        var fy = chance(0.45) ? (chance(0.55) ? year : chance(0.4) ? year - 1 : year - 2 - Math.floor(r() * 5)) : null;
        b.site = loads ? {
          checked: true, ok: true, https: chance(0.92), ms: chance(0.1) ? 3100 + Math.floor(r() * 2500) : 300 + Math.floor(r() * 1800),
          video: chance(VIDEO[buyerId] || 0.2),
          socials: { instagram: chance(0.62) ? slug(name).replace(/-/g, '') : null, tiktok: chance(0.24) ? slug(name).replace(/-/g, '') : null, youtube: chance(0.18) ? '@' + slug(name) : null, facebook: chance(0.7) ? slug(name) : null },
          booking: chance(BOOKING[buyerId] || 0.3) ? 'booking' : null, chat: chance(0.14) ? 'chat' : null,
          pixel: chance(0.3), gads: chance(0.18), form: chance(0.55), signup: chance(0.24), viewport: chance(0.9), description: chance(0.72),
          footerYear: fy, images: Math.floor(Math.pow(r(), 1.6) * 34),
        } : { checked: true, ok: false, error: 'timeout' };
        // Every third one lists an email on its site, so a sample shows the email way to reach them too.
        // Set without drawing from r(), so the same place still gives the same businesses.
        if (loads && out.length % 3 === 0) b.site.email = 'hello@' + slug(name) + '.example';
      }
      out.push(b);
    }
    // A few chain locations, so the sample shows the same chain filter a live search runs.
    var chains = (E.buyer(buyerId).chains || []).slice(0, 3);
    chains.forEach(function (c, i) {
      if (chance(0.7)) out.splice(Math.floor(r() * out.length), 0, { id: 'sample-chain-' + i, name: c.replace(/\b\w/g, function (x) { return x.toUpperCase(); }), sample: true, website: null, reviews: 400 });
    });
    return out;
  };

  return E;
});
