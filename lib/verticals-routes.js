// Routes for the verticals (lib/verticals.js):
//   GET  /for                            every vertical that's live, by group
//   GET  /for/:slug                      the vertical's page (tags the visitor's vertical, counts the visit)
//   GET  /for/:slug/go                   the free start: counts it, then the front door (or the free plan) with the tag
//   GET  /for/:slug/sample               the made-up sample site, built by scripts/build-verticals.js (noindex)
//   GET  /admin/verticals                the board: visit -> free signup -> pack -> Builder, with verdicts
//   GET  /admin/verticals/week(.md)      the weekly readout: double down, kill, keep testing
//   GET  /admin/verticals/:slug          the launch kit: hooks, ad angles, keyword, tagged links, the pack's files
//   POST /admin/verticals/:slug/status   set the status (test, double, paused, killed...)
//   POST /admin/verticals/:slug/spend    add a week's ad spend

const express = require('express');
const V = require('./verticals');
const utm = require('./utm');

const KIND = { site: 'Site design', shopify: 'Shopify', notion: 'Notion', sheet: 'Sheet', doc: 'Doc', email: 'Email', social: 'Social', deck: 'Deck', checklist: 'Checklist', recipe: 'Automation', 'video-prompts': 'Video prompts', prompts: 'Prompts' };

module.exports = function verticalRoutes({ requireAuth, requireAdmin, doorsLive, builderPrice, track }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const shopOn = (user) => {
    try {
      return require('./shop').visibleTo(user);
    } catch (e) {
      return false;
    }
  };

  r.get('/for', (req, res, next) => {
    if (V.setting() === 'off') return next();
    // Admins see every vertical that's built (ready ones too), everyone else only the live ones.
    const list = require('./harness/flags').admin(req.user) ? V.all().list.filter((v) => !v.problems.length && v.status !== 'draft') : V.publicList();
    if (!list.length) return next();
    const groups = [];
    for (const v of list) {
      let g = groups.find((x) => x.name === v.group);
      if (!g) groups.push((g = { name: v.group, list: [] }));
      g.list.push(v);
    }
    res.render('verticals/index', { title: 'Who 127 is for', description: '127 for eyewear brands, coffee shops, truckers, breeders, editors, creators, gyms and local service businesses. Pick yours.', css: ['/css/verticals.css'], groups, count: list.length });
  });

  r.get('/for/:slug', wrap(async (req, res, next) => {
    const v = V.get(req.params.slug);
    if (!v || !V.visibleTo(req.user, v) || v.problems.length) return next();
    V.tag(req, v.slug);
    await V.count(req, v.slug, 'visit');
    const live = doorsLive(req.user);
    const pack = (() => {
      try {
        return require('./shop').get(v.packSlug);
      } catch (e) {
        return null;
      }
    })();
    // What's in the pack, in the order the page lists it: the niche prompts, then the Store items.
    const lib = require('./store').current();
    const contents = [
      ...v.pack.prompts.map((p) => ({ title: p.title, kind: 'Prompt' })),
      ...(v.pack.kitFrom ? v.pack.kitFrom.files.map((f) => ({ title: f.replace(/^\d\d-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), kind: 'Template' })) : []),
      ...v.pack.items.map((id) => lib.byId[id]).filter(Boolean).map((i) => ({ title: i.title, kind: KIND[i.kind] || 'File' })),
    ];
    res.render('verticals/page', {
      contents,
      today: new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Chicago' }),
      title: `127 for ${v.name.toLowerCase()}`,
      description: v.description,
      css: ['/css/packs.css', '/css/verticals.css'],
      v,
      pack,
      packOn: !!pack && shopOn(req.user),
      owned: pack ? require('./shop').owns(req.user, v.packSlug, { keys: req.session.packKeys || [] }) : false,
      poster: V.posterPath(v),
      sample: V.sampleFile(v) ? V.samplePath(v) : null,
      hq: V.hqFor(v),
      related: V.related(v),
      doorOn: live,
      builder: { price: builderPrice() },
      // Not public yet (an admin looking at a ready vertical): keep it out of search.
      noindex: !V.isPublic(v),
      cancelled: req.query.checkout === 'cancelled',
      unavailable: req.query.checkout === 'unavailable',
    });
  }));

  r.get('/for/:slug/go', wrap(async (req, res, next) => {
    const v = V.get(req.params.slug);
    if (!v || !V.visibleTo(req.user, v)) return next();
    V.tag(req, v.slug);
    await V.count(req, v.slug, 'go');
    if (track) track(req, 'Vertical Start', { vertical: v.slug, door: v.entry.door });
    const L = res.locals.launch || {};
    res.redirect(303, V.entryUrl(v, { doorsLive: doorsLive(req.user), prelaunch: !!L.prelaunch }));
  }));

  r.get('/for/:slug/sample', (req, res, next) => {
    const v = V.get(req.params.slug);
    const file = v && V.visibleTo(req.user, v) ? V.sampleFile(v) : null;
    if (!file) return next();
    // The sample is 127's own generated page (scripts/build-verticals.js): its own inline motion script and styles,
    // fonts inlined, nothing from anywhere else. Never indexed; framed only by 127 itself.
    res.set('X-Robots-Tag', 'noindex');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'");
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.sendFile(file);
  });

  // ---- admin ------------------------------------------------------------------------------------------------------

  const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);
  const RANGES = { '7': 7, '30': 30, all: null };

  r.get('/admin/verticals', requireAuth, requireAdmin, (req, res) => {
    const span = Object.prototype.hasOwnProperty.call(RANGES, req.query.range) ? req.query.range : 'all';
    const from = day(req.query.from) || (RANGES[span] ? utm.chicagoDay(Date.now() - (RANGES[span] - 1) * 86400000) : null);
    const rows = V.fromStore({ from, to: day(req.query.to) });
    const totals = rows.reduce((a, x) => ({ visits: a.visits + x.visits, starts: a.starts + x.starts, signups: a.signups + x.signups, packs: a.packs + x.packs, builders: a.builders + x.builders, spend: a.spend + x.spend }), { visits: 0, starts: 0, signups: 0, packs: 0, builders: 0, spend: 0 });
    res.render('admin/verticals', { title: 'Verticals', css: ['/css/verticals.css'], rows, totals, span, setting: V.setting(), problems: V.all().problems, rules: V.rules(), noindex: true });
  });

  r.get(['/admin/verticals/week', '/admin/verticals/week.md'], requireAuth, requireAdmin, (req, res) => {
    const w = V.weekly();
    if (req.path.endsWith('.md')) return res.type('text/markdown').set('content-disposition', `attachment; filename="verticals-${w.range.to}.md"`).send(w.markdown);
    res.render('admin/verticals-week', { title: 'Verticals this week', css: ['/css/verticals.css'], w, noindex: true });
  });

  r.get('/admin/verticals/:slug', requireAuth, requireAdmin, (req, res, next) => {
    const v = V.get(req.params.slug);
    if (!v) return next();
    const row = V.fromStore({}).find((x) => x.slug === v.slug);
    res.render('admin/vertical-kit', { title: `${v.name}: launch kit`, css: ['/css/verticals.css'], v, row, status: V.statusOf(v), statuses: V.STATUSES, links: V.links(v, res.locals.baseUrl), entry: V.entryUrl(v, { doorsLive: true }), monday: V.lastWeek(Date.now() + 7 * 86400000).from, saved: req.query.saved || null, noindex: true });
  });

  r.post('/admin/verticals/:slug/status', requireAuth, requireAdmin, wrap(async (req, res, next) => {
    const v = V.get(req.params.slug);
    if (!v) return next();
    await V.setStatus(v.slug, String(req.body.status || ''), req.user.email);
    res.redirect(303, `/admin/verticals/${v.slug}?saved=status`);
  }));

  r.post('/admin/verticals/:slug/spend', requireAuth, requireAdmin, wrap(async (req, res, next) => {
    const v = V.get(req.params.slug);
    if (!v) return next();
    const ok = await V.addSpend(v.slug, req.body.week, req.body.usd, req.body.note, req.user.email);
    res.redirect(303, `/admin/verticals/${v.slug}?saved=${ok ? 'spend' : 'spend-error'}`);
  }));

  return r;
};
