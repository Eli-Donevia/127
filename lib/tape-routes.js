// Tape (lib/tape), behind HQ_TAPE. Mounted in server.js next to Life:
//
//   app.use(tapeRoutes({ requireAuth }));
//
//   GET  /app/hq/tape                 the page: tape strip, chart, heads up, the read, flags, watchlist
//   GET  /app/hq/tape/data?sym&tf     one symbol's bars, facts, read and notices (JSON). The member's own key, or the
//                                     invented sample tickers when there's no key
//   POST /app/hq/tape/save            the watchlist, price levels and which flags are on (JSON only)
//   POST /app/hq/tape/key             connect a data provider key (form). Builder and up, and only once HQ_SECRET is set
//   POST /app/hq/tape/key/remove      forget the key
//
// Off for the member (HQ_TAPE off for them, or HQ v2 off for them), every route falls through to the 404.
// Below Builder the page runs on the sample tickers only, and nothing can be saved or connected.

const express = require('express');
const tape = require('./tape');
const { canAccess } = require('./plans');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-tape.css'];
const TFS = new Set(['1D', '5D', '1M', '3M', 'list']);
const ERR = {
  key: 'Your provider turned the key down. Check it in your provider dashboard, then connect it again.',
  limit: "Your provider's plan allows only a few calls a minute. Prices fill in as it allows.",
  down: "Your provider didn't answer. Prices come back when it does.",
};

function tapeRoutes({ requireAuth }) {
  const r = express.Router();
  const harness = () => require('./harness');
  const enabledFor = (user) => !!user && harness().flags.on('HQ_TAPE', user) && harness().enabledFor(user);
  const on = (req, res, next) => {
    if (harness().flags.value('HQ_TAPE') === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return enabledFor(req.user) ? next() : next('router');
  };
  const plan = (user) => canAccess({ tier: require('./store').tierOf(user) }, 'builder');
  const json = express.json({ limit: '20kb' });
  const page = (req, res, locals) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'tape', inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    res.render('app/hq2/tape', { title: 'Tape', css, tab: 'tape', inboxCount, usage: h.ledger.usage(req.user), flags, ws, ...locals });
  };

  r.get('/app/hq/tape', on, (req, res) => {
    const can = plan(req.user);
    const rec = tape.record(req.user.id);
    const live = can && !!rec.key;
    const msg = String(req.query.m || '');
    page(req, res, {
      can, live,
      ready: require('./hq').secretReady(),
      providers: Object.values(tape.PROVIDERS).map((p) => ({ id: p.id, name: p.name, signup: p.signup, plan: p.plan, attribution: p.attribution })),
      keyInfo: rec.key ? { name: tape.PROVIDERS[rec.key.provider].name, tail: rec.key.tail, attribution: tape.PROVIDERS[rec.key.provider].attribution } : null,
      notice: tape.NOTICE, alertNote: tape.ALERT_NOTE, rules: tape.RULES,
      error: msg === 'bad' ? String(req.query.e || '').slice(0, 200) : '', saved: msg === 'on' ? 'Connected. Prices now come from your provider.' : msg === 'off' ? 'Key removed. 127 no longer holds it.' : '',
      state: {
        live, can,
        list: live ? rec.list : tape.SAMPLE.map((s) => s.sym),
        names: live ? {} : Object.fromEntries(tape.SAMPLE.map((s) => [s.sym, s.name])),
        levels: live ? rec.levels : { KSTR: [201], MRDN: [11.15] },
        rules: rec.rules,
        ruleList: tape.RULES,
      },
    });
  });

  r.get('/app/hq/tape/data', on, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const sym = String(req.query.sym || '').toUpperCase();
    const tf = TFS.has(String(req.query.tf)) ? String(req.query.tf) : '1D';
    if (!tape.SYMBOL.test(sym)) return res.status(400).json({ error: 'That isn\'t a ticker symbol.' });
    let rec = tape.record(req.user.id);
    const useLive = plan(req.user) && !!rec.key;
    // The sample keeps the member's flag changes on the page; they come along so the notices match what they set.
    if (!useLive) {
      const off = new Set(String(req.query.off || '').split(','));
      const lv = String(req.query.lv || '').split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 10);
      rec = { ...rec, levels: { [sym]: lv }, rules: Object.fromEntries(tape.RULES.map(([k]) => [k, !off.has(k)])) };
    }
    try {
      const data = useLive ? await tape.live(req.user.id, sym, tf) : tape.sample(sym, tf);
      if (!data) return res.status(404).json({ error: useLive ? 'No prices for that symbol.' : 'Sample data has only the six example tickers.' });
      if (!data.bars.length && tf !== 'list' && data.facts.last == null) return res.status(404).json({ error: `No prices came back for ${sym}.` });
      res.json(tape.finish(data, rec));
    } catch (e) {
      // Never echo the provider's message: it can carry the request URL, and the URL carries the key.
      res.status(e.code === 'key' ? 401 : e.code === 'limit' ? 429 : 502).json({ error: ERR[e.code] || ERR.down });
    }
  });

  r.post('/app/hq/tape/save', on, json, async (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON only.' });
    if (!plan(req.user)) return res.status(403).json({ error: 'Saving a watchlist comes with Builder.' });
    const out = await tape.save(req.user.id, req.body);
    if (!out) return res.status(400).json({ error: 'Nothing to save.' });
    res.json({ ok: true, list: out.list, levels: out.levels, rules: out.rules });
  });

  r.post('/app/hq/tape/key', on, async (req, res) => {
    if (!plan(req.user)) return res.redirect('/app/billing');
    if (!req.body || req.body.agree !== 'yes') return res.redirect('/app/hq/tape?m=bad&e=' + encodeURIComponent('Tick the box to confirm your plan allows use in other apps.'));
    const out = await tape.connect(req.user.id, String(req.body.provider || ''), String(req.body.key || ''));
    if (out.error) return res.redirect('/app/hq/tape?m=bad&e=' + encodeURIComponent(out.error));
    res.redirect('/app/hq/tape?m=on');
  });

  r.post('/app/hq/tape/key/remove', on, async (req, res) => {
    await tape.disconnect(req.user.id);
    res.redirect('/app/hq/tape?m=off');
  });

  return r;
}

module.exports = tapeRoutes;
