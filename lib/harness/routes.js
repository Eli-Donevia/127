// HQ v2 pages (lib/harness). Mounted in server.js before HQ v1's routes:
//
//   app.use(harnessRoutes({ requireAuth, flash, track, isAdmin }));
//
// While HQ v2 is off for the member (HARNESS_V2), every route here falls through, so HQ stays v1.
// With it on, /app/hq is Today; HQ v1's weekly numbers stay at /app/hq?v1=1 (and its ?w= week links).

const express = require('express');
const harness = require('./index');
const setup = require('./setup');
const imports = require('./imports');
const places = require('./places');
const schema = require('./schema');
const { scrubKeys } = require('./text');
const db = require('../db');
const security = require('../security');
const foundingFive = require('../founding-five');
const workspace = require('./routes-workspace');
const nav = require('./nav');

const { engine, packs, inbox, pipeline, library, brain, ledger, todayLib, activation, wins, access } = harness;
const CSS = ['/css/hq.css', '/css/hq2.css'];
// HQ v1's connections page (/app/hq/connect) follows HQ_LIVE; Set up only links to it when it's there.
const hqLive = (user) => {
  try {
    return require('../hq').liveFor(user);
  } catch {
    return false;
  }
};
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';
// What the queue's buttons cost, shown before every tap ("About 6 credits").
const queueCosts = () => ({
  write: (packs.tool('hq.write_message') || {}).credits || 0,
  reply: (packs.tool('hq.answer_reply') || {}).credits || 0,
  prep: (packs.tool('hq.call_prep') || {}).credits || 0,
});
const LIVE = new Set(['queued', 'running']);

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}

// The form a workflow asks for, from its input schema.
function formFields(inputs, values = {}) {
  const props = (inputs && inputs.properties) || {};
  const req = new Set((inputs && inputs.required) || []);
  return Object.entries(props).map(([key, p]) => {
    const type = Array.isArray(p.type) ? p.type[0] : p.type;
    const items = p.items || {};
    let control = 'text';
    if (p.enum) control = 'select';
    // options: 'pipeline' suggests the names in the member's Pipeline (they can still type one).
    else if (p.options === 'pipeline' && type === 'string') control = 'lead';
    else if (p.format === 'asset') control = 'asset';
    else if (type === 'array' && items.format === 'asset') control = 'assets';
    else if (type === 'boolean') control = 'check';
    else if (type === 'integer' || type === 'number') control = 'number';
    else if (type === 'array') control = 'list';
    else if (p.format === 'textarea' || (p.maxLength && p.maxLength > 400)) control = 'textarea';
    let value = values[key] !== undefined ? values[key] : p.default !== undefined ? p.default : '';
    if (Array.isArray(value)) value = value.join(', ');
    // accept: which Library files fit a file input, as in <input accept> ("video/*", "text/csv,.vcf").
    return { key, label: p.title || key, hint: p.description || '', required: req.has(key), control, options: p.enum || null, min: p.minimum, max: p.maximum, accept: String(p.accept || items.accept || ''), value: value === null ? '' : String(value) };
  });
}

// Does a Library file fit an input's accept list ("video/*", "image/png", ".vcf")?
function fits(file, accept) {
  const parts = String(accept || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return true;
  const name = String(file.name || '').toLowerCase();
  return parts.some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a));
}

// Form posts carry strings; empty optional fields are left out so defaults apply.
function inputsFrom(body, inputs) {
  const props = (inputs && inputs.properties) || {};
  const out = {};
  for (const [key, p] of Object.entries(props)) {
    const raw = body[`in_${key}`];
    const type = Array.isArray(p.type) ? p.type[0] : p.type;
    if (type === 'boolean') {
      out[key] = raw === 'on' || raw === 'true' || raw === 'yes';
      continue;
    }
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    out[key] = String(raw).trim();
  }
  return out;
}

function harnessRoutes({ requireAuth, flash, track = () => {}, isAdmin = () => false }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (harness.enabledFor(req.user) ? next() : next('router'));
  const A = [on, requireAuth];
  const allow = (req, res, key, max, windowMs) => {
    if (security.allow(`${key}:${req.user.id}`, max, windowMs)) return true;
    if (req.accepts(['html', 'json']) === 'json') res.status(429).json({ error: TOO_FAST });
    else {
      flash(req, 'info', TOO_FAST);
      res.redirect(req.get('referer') && /^\/app\//.test(new URL(req.get('referer'), 'http://x').pathname) ? new URL(req.get('referer'), 'http://x').pathname : '/app/hq');
    }
    return false;
  };
  const page = (res, view, title, locals) => {
    privatePage(res);
    const inboxCount = inbox.count(res.locals.user.id), flags = harness.flags.forUser(res.locals.user);
    // HQ as a workspace (lib/harness/nav.js): its rail and phone bar take the place of the app's side menu.
    const ws = nav.on() ? nav.workspace(res.locals.user, { tab: view, inboxCount, flags }) : null;
    res.render(`app/hq2/${view}`, { title, css: ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : [], flags.HQ_NUDGES ? ['/css/hq-nudges.css'] : []) : CSS, tab: view, inboxCount, usage: ledger.usage(res.locals.user), flags, ws, ...locals });
  };
  const fail = (req, res, err, back) => {
    if (!err || !err.status) throw err;
    flash(req, 'error', err.message);
    res.redirect(back);
  };

  // ---------- Today ----------
  r.get('/app/hq', on, (req, res, next) => (req.query.v1 || req.query.w ? next('router') : next()), requireAuth, wrap(async (req, res) => {
    const t = harness.today(req.user);
    // Google businesses' names are fetched for this page and not kept (Legal L53).
    t.queue.items = await places.show(t.queue.items, { limit: 3 });
    // The member's own First 25 list (found by their email), offered in one tap until it's in or they say not now.
    const mine = wins.offerSeen(req.user.id, 'first25-hide') ? null : await imports.first25Mine(req.user);
    const f25 = mine && mine.fresh ? { count: mine.count, fresh: mine.fresh, city: mine.city } : null;
    const b = brain.snapshot(req.user);
    const nd = nav.on() && harness.flags.on('HQ_NUDGES', req.user) ? await nudgesToday(req.user) : null;
    page(res, 'today', 'HQ', { t, f25, nd, ffCard: foundingFive.card(req.user), b, firstName: brain.firstName(req.user), kinds: todayLib.KINDS.map((k) => ({ kind: k, label: todayLib.LABELS[k] })), cost: queueCosts(), tour: dayOne(req.user, b) });
  }));

  // Day one (HQ_PREMIUM): three steps on Today for a new member, each ticked off from what's really there, until
  // all three are done or the member hides it.
  const dayOne = (user, b) => {
    if (!harness.flags.on('HQ_PREMIUM', user) || wins.offerSeen(user.id, 'dayone-hide')) return null;
    const c = require('../hq').connections(user, ''), ai = require('../hq-harness').on();
    const steps = [
      { title: 'Tell 127 about your business', detail: 'What you sell, who it\'s for and how you talk. Every workflow writes from it.', href: '/app/hq/brain', cta: 'Open your Brain', done: !!(b.business.what || b.business.offer) },
      { title: 'Pick your business', detail: 'Its workflows come first, starting with your first 25 and the message for each.', href: '/app/hq/start#types', cta: 'Pick one', done: !harness.moveDeps.needsBusiness(user, b) },
      { title: 'Turn these 2 on first', detail: ai ? 'Add 127 to Claude or ChatGPT, then make your 127 link so your numbers fill themselves.' : 'Make your 127 link so your numbers fill themselves.', href: ai && !c.ai ? '/app/hq/connect#ai' : '/app/hq/connect#link', cta: 'Turn them on', done: !!c.link && (!ai || !!c.ai), parts: [...(ai ? [{ label: '127 in Claude', done: !!c.ai }] : []), { label: 'Your 127 link', done: !!c.link }] },
    ];
    return steps.every((s) => s.done) ? null : { steps, next: steps.findIndex((s) => !s.done) };
  };

  r.post('/app/hq/dayone/hide', ...A, wrap(async (req, res) => {
    await wins.markOffer(req.user.id, 'dayone-hide');
    res.redirect('/app/hq');
  }));

  r.get('/app/hq/today.json', ...A, (req, res) => {
    privatePage(res);
    const t = harness.today(req.user);
    res.json({ move: t.move, hundred: t.hundred, queue: { left: t.queue.left, done: t.queue.done, counts: t.queue.counts }, inbox: t.inbox.length, running: t.running.map((v) => ({ id: v.id, title: v.title, status: v.status })), say: todayLib.say(req.user, harness.moveDeps) });
  });

  // Something the member did outside the queue: +n of a kind of action (n may be negative to undo).
  r.post('/app/hq/actions', ...A, express.json({ limit: '2kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-act', 240, 10 * 60 * 1000)) return;
    const kind = String(req.body.kind || '');
    const n = Math.max(-100, Math.min(500, parseInt(req.body.n, 10) || 0));
    if (!todayLib.KINDS.includes(kind) || !n) return res.status(400).json({ error: 'Pick what you did.' });
    await todayLib.log(req.user.id, kind, n);
    const h = todayLib.hundred(req.user);
    if (h.done && h.today - n < h.target) track(req, 'HQ Day Done', { target: h.target });
    if (req.accepts(['html', 'json']) === 'json') return res.json({ hundred: h });
    res.redirect('/app/hq#log');
  }));

  // Talk to 127: the Ask bar and the orb.
  r.post('/app/hq/talk', ...A, express.json({ limit: '4kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-talk', 30, 10 * 60 * 1000)) return;
    const text = String(req.body.text || req.body.q || '').trim();
    if (!text) return res.status(400).json({ error: 'Say or type what you want done.' });
    const out = await harness.talk(req.user, text);
    track(req, 'HQ Talk', { kind: out.kind });
    if (req.accepts(['html', 'json']) === 'json') return res.json(out);
    if (out.nav) return res.redirect(out.nav);
    if (out.pick) return res.redirect(`/app/hq/w/${out.pick.id}?${new URLSearchParams(Object.entries(out.pick.inputs || {}).map(([k, v]) => [`in_${k}`, v])).toString()}`);
    flash(req, 'info', out.say);
    res.redirect('/app/hq');
  }));

  // ---------- Do my day ----------
  // Each item in Today's queue: Sent (and Undo), Skip for today, They replied, Write it for me,
  // Prep the call, They said yes, Not interested. JSON for the page's script; plain forms work too.
  const wantsJson = (req) => req.accepts(['html', 'json']) === 'json';
  const done = (req, res, body, back = '/app/hq#day') => (wantsJson(req) ? res.json(body) : res.redirect(back));
  const leadOf = (req) => pipeline.get(req.user.id, String(req.params.id || ''));
  const counted = (lead) => (lead.warm ? 'warm' : 'cold');
  const markStep = async (req, step) => {
    if (await activation.mark(req.user.id, step)) track(req, 'HQ Activation', { step });
  };
  const startFor = async (req, res, wfId, inputs, back) => {
    try {
      const run = await engine.start(req.user, wfId, inputs, { source: 'queue' });
      track(req, 'HQ Run', { workflow: wfId });
      return run;
    } catch (err) {
      if (!err.status) throw err;
      const out = { error: err.message, upgrade: err.status === 402 && ledger.tierOf(req.user) === 'free' };
      if (wantsJson(req)) res.status(err.status).json(out);
      else {
        flash(req, 'error', err.message);
        res.redirect(back);
      }
      return null;
    }
  };

  // One Google business's name, for a card that asks for it: fetched now, never kept (Legal L53).
  r.get('/app/hq/leads/:id/name.json', ...A, wrap(async (req, res, next) => {
    privatePage(res);
    const l = leadOf(req);
    if (!l || !l.placeId) return next();
    if (!allow(req, res, 'hq2-gname', 300, 60 * 60 * 1000)) return;
    const got = (await places.names([l.placeId], { limit: 1 })).get(l.placeId);
    if (!got) return res.status(503).json({ error: "Google Maps didn't answer. Open the listing there to see the name." });
    res.json({ name: got.name, credits: got.credits });
  }));

  r.post('/app/hq/queue/:id/sent', ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
    if (!allow(req, res, 'hq2-q', 600, 10 * 60 * 1000)) return;
    const got = await pipeline.touch(req.user.id, String(req.params.id));
    if (!got) return next();
    // A first message counts through the stage change; a follow-up or an answer counts here.
    if (!got.moved) await todayLib.log(req.user.id, counted(got.lead), 1);
    await markStep(req, 'a3');
    req.session.hqUndo = { id: got.lead.id, prev: got.prev, kind: counted(got.lead), at: Date.now() };
    const h = todayLib.hundred(req.user);
    track(req, 'HQ Sent');
    if (h.done && h.today - 1 < h.target) track(req, 'HQ Day Done', { target: h.target });
    done(req, res, { lead: got.lead, hundred: h, undo: true });
  }));

  // Undo the last Sent, within 10 minutes.
  r.post('/app/hq/queue/:id/undo', ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
    const u = req.session.hqUndo;
    if (!u || u.id !== String(req.params.id) || Date.now() - u.at > 10 * 60 * 1000) {
      if (wantsJson(req)) return res.status(409).json({ error: 'Too late to undo that one.' });
      flash(req, 'info', 'Too late to undo that one.');
      return res.redirect('/app/hq#day');
    }
    const lead = await pipeline.untouch(req.user.id, u.id, u.prev);
    if (!lead) return next();
    await todayLib.log(req.user.id, u.kind, -1);
    req.session.hqUndo = null;
    done(req, res, { lead, hundred: todayLib.hundred(req.user) });
  }));

  r.post('/app/hq/queue/:id/skip', ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
    const lead = await pipeline.snooze(req.user.id, String(req.params.id), 1);
    if (!lead) return next();
    done(req, res, { lead });
  }));

  // They replied: the lead moves to Replied, and with what they said, 127 drafts the answer.
  r.post('/app/hq/queue/:id/replied', ...A, express.json({ limit: '8kb' }), wrap(async (req, res, next) => {
    if (!leadOf(req)) return next();
    const text = String(req.body.text || '').trim().slice(0, 3000);
    if (text) await pipeline.update(req.user.id, String(req.params.id), { reply: text });
    const lead = await pipeline.move(req.user.id, String(req.params.id), 'replied');
    let run = null;
    if (text) {
      run = await startFor(req, res, 'hq.reply', { lead: lead.id, reply: text }, '/app/hq#day');
      if (!run) return;
    }
    done(req, res, { lead, run: run && run.id }, run ? `/app/hq/runs/${run.id}` : '/app/hq#day');
  }));

  // Write it for me: the first message and follow-ups, the answer to a reply, or the call prep.
  r.post('/app/hq/queue/:id/write', ...A, express.json({ limit: '8kb' }), wrap(async (req, res, next) => {
    const l = leadOf(req);
    if (!l) return next();
    if (!allow(req, res, 'hq2-write', 60, 60 * 60 * 1000)) return;
    const wfId = l.stage === 'replied' ? 'hq.reply' : l.stage === 'call' ? 'hq.call_prep' : 'hq.message';
    const inputs = { lead: l.id };
    const said = String(req.body.text || '').trim().slice(0, 3000);
    if (wfId === 'hq.reply' && said) inputs.reply = said;
    const run = await startFor(req, res, wfId, inputs, '/app/hq#day');
    if (!run) return;
    done(req, res, { run: run.id, credits: run.credits && run.credits.estimate }, `/app/hq/runs/${run.id}`);
  }));

  for (const [verb, stage] of [['booked', 'call'], ['lost', 'lost']]) {
    r.post(`/app/hq/queue/:id/${verb}`, ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
      const lead = await pipeline.move(req.user.id, String(req.params.id), stage);
      if (!lead) return next();
      done(req, res, { lead, counts: pipeline.counts(req.user.id) });
    }));
  }

  // They said yes: the lead is won, and the member logs the win.
  r.post('/app/hq/queue/:id/won', ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
    const lead = await pipeline.move(req.user.id, String(req.params.id), 'won');
    if (!lead) return next();
    const win = `/app/hq/win?lead=${encodeURIComponent(lead.id)}`;
    done(req, res, { lead, win }, win);
  }));

  // ---------- bring in a First 25 list ----------
  // First 25's link into HQ: a confirm screen, then every business lands in the
  // Pipeline with its messages written.
  r.get('/app/hq/import/first25/:id', ...A, (req, res) => {
    const p = imports.first25Preview(req.user, req.params.id, req.query.k);
    if (!p) {
      flash(req, 'error', "That list has expired or the link isn't complete. Run First 25 again and use the new link.");
      return res.redirect('/app/hq');
    }
    page(res, 'import', 'Bring in your list', { p });
  });

  r.post('/app/hq/import/first25/:id', ...A, wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-import', 20, 60 * 60 * 1000)) return;
    const out = await imports.importFirst25(req.user, req.params.id, req.body.k);
    if (!out) {
      flash(req, 'error', "That list has expired or the link isn't complete. Run First 25 again and use the new link.");
      return res.redirect('/app/hq');
    }
    track(req, 'HQ Import', { source: 'first25', added: out.added });
    flash(req, 'win', out.added ? `${out.added} businesses are in your Pipeline with their first messages written. Start at the top.` : 'That list is already in your Pipeline. Nothing changed.');
    res.redirect('/app/hq#day');
  }));

  r.post('/app/hq/import/first25-mine', ...A, wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-import', 20, 60 * 60 * 1000)) return;
    const out = await imports.importFirst25Mine(req.user);
    if (!out) {
      flash(req, 'error', "We couldn't find your First 25 list. Lists are kept 30 days; run First 25 again for a new one.");
      return res.redirect('/app/hq');
    }
    track(req, 'HQ Import', { source: 'first25-mine', added: out.added });
    flash(req, 'win', out.added ? `${out.added} businesses are in your Pipeline with their first messages written. Start at the top.` : 'That list is already in your Pipeline. Nothing changed.');
    res.redirect('/app/hq#day');
  }));

  // ---------- bring in a front door's result (lib/doors.js) ----------
  // The free tool they ran before signing up (/start/door/:id lands here): a confirm screen, then its
  // files, any brands and the facts it learned come into HQ.
  const DOOR_GONE = "That result has expired or the link isn't complete. Run the free tool again and use the new link.";
  r.get('/app/hq/import/door/:id', ...A, (req, res) => {
    const p = imports.doorPreview(req.user, req.params.id, req.query.k);
    if (!p) {
      flash(req, 'error', DOOR_GONE);
      return res.redirect('/app/hq');
    }
    page(res, 'import-door', 'Bring in your result', { p });
  });

  r.post('/app/hq/import/door/:id', ...A, wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-import', 20, 60 * 60 * 1000)) return;
    const out = await imports.importDoor(req.user, req.params.id, req.body.k);
    if (!out) {
      flash(req, 'error', DOOR_GONE);
      return res.redirect('/app/hq');
    }
    track(req, 'HQ Import', { source: `door:${out.door}`, added: out.added, files: out.files });
    const what = [out.files ? `${out.files} file${out.files === 1 ? '' : 's'} in your Library` : '', out.added ? `${out.added} brands in your Pipeline with their first messages written` : ''].filter(Boolean).join(' and ');
    // Bringing a result in is the member's own OK, logged like any other change to their HQ.
    if (what) harness.activity.note(req.user, { who: 'you', kind: 'brain', action: 'brought in', what: `${out.title}: ${what}`, ref: '/app/hq/library' });
    flash(req, 'win', what ? `Your result is in: ${what}.${out.skipped ? " One or more files didn't fit in your Library." : ''}` : 'That result is already in your HQ. Nothing changed.');
    res.redirect('/app/hq#day');
  }));

  r.post('/app/hq/import/first25-mine/hide', ...A, wrap(async (req, res) => {
    await wins.markOffer(req.user.id, 'first25-hide');
    res.redirect('/app/hq');
  }));

  // ---------- wins ----------
  r.get('/app/hq/win', ...A, wrap(async (req, res) => {
    const l = req.query.lead ? pipeline.get(req.user.id, String(req.query.lead)) : null;
    const lead = l ? (await places.show([pipeline.view(l)], { limit: 1 }))[0] : null;
    if (lead && lead.google && !lead.google.live) lead.name = '';
    page(res, 'win', 'Log a win', { lead, kinds: wins.KINDS, consent: wins.CONSENT, mine: wins.list(req.user.id).slice(0, 20), ladder: todayLib.ladder(req.user) });
  }));

  r.post('/app/hq/win', ...A, wrap(async (req, res) => {
    if (!allow(req, res, 'hq2-win', 30, 60 * 60 * 1000)) return;
    try {
      const { win } = await wins.log(req.user, { lead: req.body.lead, kind: String(req.body.kind || ''), note: String(req.body.note || ''), consent: String(req.body.consent || '') });
      track(req, 'HQ Win', { kind: win.kind, consent: win.consent });
      res.redirect(`/app/hq/win/${win.id}`);
    } catch (err) {
      if (!err.status) throw err;
      flash(req, 'error', err.message);
      res.redirect(`/app/hq/win${req.body.lead ? `?lead=${encodeURIComponent(String(req.body.lead))}` : ''}`);
    }
  }));

  r.get('/app/hq/win/:id', ...A, wrap(async (req, res, next) => {
    const w = wins.get(req.user.id, req.params.id);
    if (!w) return next();
    // The Founder's Circle, shown once ever, at the member's first win (never as a banner).
    let circle = null;
    if (req.user.tier !== 'circle' && !wins.offerSeen(req.user.id, 'circle')) {
      await wins.markOffer(req.user.id, 'circle');
      circle = { open: !(typeof res.locals.circleSeatsLeft === 'number' && res.locals.circleSeatsLeft <= 0) };
      track(req, 'HQ Circle Shown', { open: circle.open });
    }
    page(res, 'win-card', 'Your win', { w, kinds: wins.KINDS, consent: wins.CONSENT, circle, ladder: todayLib.ladder(req.user), firstName: brain.firstName(req.user) });
  }));

  r.post('/app/hq/win/:id/consent', ...A, wrap(async (req, res, next) => {
    try {
      const w = await wins.setConsent(req.user, req.params.id, String(req.body.consent || ''));
      if (!w) return next();
      flash(req, 'info', 'Saved.');
      res.redirect(`/app/hq/win/${w.id}`);
    } catch (err) {
      if (!err.status) throw err;
      flash(req, 'error', err.message);
      res.redirect(`/app/hq/win/${encodeURIComponent(req.params.id)}`);
    }
  }));

  r.post('/app/hq/win/:id/delete', ...A, wrap(async (req, res, next) => {
    if (!(await wins.remove(req.user, req.params.id))) return next();
    flash(req, 'info', 'Deleted.');
    res.redirect('/app/hq/win');
  }));

  // ---------- Start and a workflow ----------
  // The workspace's jump-to box: every workflow the member can see, by name (lib/harness/nav.js).
  r.get('/app/hq/palette.json', ...A, (req, res, next) => {
    if (!nav.on()) return next();
    privatePage(res);
    res.json({ workflows: harness.catalog(req.user).map((w) => ({ id: w.id, title: w.title, pack: w.packTitle, locked: w.locked })) });
  });

  // Read my week (HQ_PREMIUM, Legal L79): the page is counted from what HQ keeps; the AI line is asked for only
  // when the page is open (its script fetches line.json), costs no credits, and may come back empty.
  const weekOn = (req, res, next) => (nav.on() && harness.flags.on('HQ_PREMIUM', req.user) ? next() : next('router'));
  r.get('/app/hq/week', ...A, weekOn, wrap(async (req, res) => {
    const nOn = nav.on() && harness.flags.on('HQ_NUDGES', req.user);
    page(res, 'week', 'Read my week', { wk: require('./week').report(req.user), nw: nOn ? require('./nudges').weekly(req.user) : null, drop: nOn ? await require('./drops').thisWeek() : null });
  }));
  r.get('/app/hq/week/line.json', ...A, weekOn, (req, res, next) => (allow(req, res, 'week-line', 20, 60 * 60 * 1000) ? next() : undefined), wrap(async (req, res) => {
    privatePage(res);
    res.json({ line: await require('./week').stoodOut(req.user) });
  }));

  // HQ that notices (HQ_NUDGES, lib/harness/nudges.js): Progress, and the few things a member tells it. Every form
  // works without the script; nothing here sends anything outside HQ.
  const nudges = require('./nudges');
  const drops = require('./drops');
  const nudgesToday = async (user) => {
    await nudges.sync(user);
    const nd = nudges.forToday(user);
    const drop = await drops.thisWeek();
    nd.drop = drop.items.length && !nudges.dropClosed(user, drop.week) ? drop : null;
    return nd;
  };
  const nudgeOn = (req, res, next) => (nav.on() && harness.flags.on('HQ_NUDGES', req.user) ? next() : next('router'));
  const NU = [...A, nudgeOn];
  const nudgeBack = (req, res, fallback = '/app/hq/you') => {
    const back = String(req.body.back || '');
    res.redirect(/^\/app\/hq(\/(you|week))?(#[a-z-]+)?$/.test(back) ? back : fallback);
  };
  r.get('/app/hq/you', ...NU, wrap(async (req, res) => {
    await nudges.sync(req.user);
    const pr = nudges.progress(req.user, String(req.query.m || ''));
    const w = String(process.env.WALL || '').trim().toLowerCase();
    const wallMine = w === 'on' || (w === 'admins' && harness.flags.admin(req.user)) ? { entries: require('../wall').mine(req.user.id), consent: require('../wall').CONSENT, kinds: require('../wall').KINDS, typicality: require('../wall').TYPICALITY } : null;
    page(res, 'you', 'Progress', { pr, wallMine, firstName: brain.firstName(req.user) });
    // A new mark glows once: it counts as seen after this page has shown it.
    if (pr.marks.some((m) => m.fresh)) await nudges.markSeen(req.user);
  }));
  r.post('/app/hq/you/prefs', ...NU, express.urlencoded({ extended: true, limit: '4kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'nudge-prefs', 60, 10 * 60 * 1000)) return;
    const mute = {};
    for (const k of Object.keys(nudges.KINDS)) if (!req.body[`show_${k}`]) mute[k] = true;
    await nudges.setPrefs(req.user, { tone: req.body.tone, mute, quietFrom: req.body.quietFrom, quietTo: req.body.quietTo, postGoal: req.body.postGoal === '' ? null : req.body.postGoal });
    flash(req, 'info', 'Saved. HQ talks to you this way from now on.');
    res.redirect('/app/hq/you#talk');
  }));
  r.post('/app/hq/you/rivals', ...NU, express.urlencoded({ extended: false, limit: '2kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'nudge-rivals', 30, 10 * 60 * 1000)) return;
    try {
      await nudges.addRival(req.user, { handle: req.body.handle, platform: req.body.platform });
    } catch (err) {
      return fail(req, res, err, '/app/hq/you#pace');
    }
    res.redirect('/app/hq/you#pace');
  }));
  r.post('/app/hq/you/rivals/remove', ...NU, express.urlencoded({ extended: false, limit: '2kb' }), wrap(async (req, res) => {
    await nudges.removeRival(req.user, String(req.body.id || ''));
    flash(req, 'info', 'Removed, with every count you gave for it.');
    res.redirect('/app/hq/you#pace');
  }));
  r.post('/app/hq/you/rivals/count', ...NU, express.urlencoded({ extended: false, limit: '2kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'nudge-count', 60, 10 * 60 * 1000)) return;
    try {
      await nudges.countRival(req.user, String(req.body.id || ''), { week: req.body.week, n: req.body.n });
    } catch (err) {
      return fail(req, res, err, '/app/hq/you#pace');
    }
    nudgeBack(req, res, '/app/hq/you#pace');
  }));
  r.post('/app/hq/you/challenge', ...NU, express.urlencoded({ extended: false, limit: '1kb' }), wrap(async (req, res) => {
    await nudges.takeChallenge(req.user, req.body.take !== '0');
    nudgeBack(req, res, '/app/hq');
  }));
  r.post('/app/hq/you/drop/close', ...NU, wrap(async (req, res) => {
    await nudges.closeDrop(req.user);
    res.redirect('/app/hq');
  }));
  // The wall (lib/wall.js, WALL): a member puts a site they shipped or a win on 127's public wall. It waits for an
  // admin, shows only with WALL=on, and Remove takes it down at once.
  const wall = require('../wall');
  r.post('/app/hq/you/wall', ...NU, express.urlencoded({ extended: false, limit: '4kb' }), wrap(async (req, res) => {
    if (!allow(req, res, 'wall-add', 12, 60 * 60 * 1000)) return;
    try {
      await wall.submit(req.user, { kind: req.body.kind, url: req.body.url, title: req.body.title, note: req.body.note, consent: req.body.consent });
    } catch (err) {
      return fail(req, res, err, '/app/hq/you#wall');
    }
    flash(req, 'info', '127 checks it before it shows. Remove it here anytime.');
    res.redirect('/app/hq/you#wall');
  }));
  r.post('/app/hq/you/wall/remove', ...NU, wrap(async (req, res) => {
    await wall.remove(req.user, String(req.body.id || ''));
    flash(req, 'info', 'Taken down.');
    res.redirect('/app/hq/you#wall');
  }));
  r.get('/admin/wall', requireAuth, (req, res, next) => (isAdmin(req.user) ? next() : next('router')), (req, res) => {
    privatePage(res);
    res.render('admin/wall', { title: 'Wall', entries: wall.review(), live: wall.on(), typicality: wall.TYPICALITY });
  });
  r.post('/admin/wall/:id', requireAuth, (req, res, next) => (isAdmin(req.user) ? next() : next('router')), express.urlencoded({ extended: false, limit: '1kb' }), wrap(async (req, res) => {
    try {
      await wall.setStatus(req.params.id, String(req.body.status || ''), req.user.email);
    } catch (err) {
      if (!err.status) throw err;
      flash(req, 'error', err.message);
    }
    res.redirect('/admin/wall');
  }));
  r.get('/wall', (req, res, next) => (wall.on() ? next() : next('router')), (req, res) => {
    res.render('wall', { title: 'Built with 127', description: 'Sites and wins 127 members chose to show.', entries: wall.publicList(), typicality: wall.TYPICALITY });
  });

  r.post('/app/hq/you/monday/close', ...NU, wrap(async (req, res) => {
    await nudges.closeMonday(req.user);
    res.redirect('/app/hq');
  }));

  // The Map of everything (HQ_PREMIUM): every workflow, prompt, template and app the member's rail shows.
  r.get('/app/hq/map.json', ...A, (req, res, next) => {
    const flags = harness.flags.forUser(req.user);
    if (!nav.on() || !flags.HQ_PREMIUM) return next();
    privatePage(res);
    res.json({ items: nav.mapItems(nav.workspace(req.user, { flags })) });
  });

  r.get('/app/hq/start', ...A, (req, res) => {
    page(res, 'start', 'Start', { ...harness.start(req.user), q: String(req.query.q || '').slice(0, 80) });
  });

  r.post('/app/hq/start/business', ...A, wrap(async (req, res) => {
    const snap = await harness.pickBusiness(req.user, String(req.body.pack || ''));
    if (!snap) return res.redirect('/app/hq/start');
    track(req, 'HQ Business Picked', { pack: String(req.body.pack) });
    flash(req, 'win', `${snap.business.niche} is your business now. Its workflows come first.`);
    res.redirect('/app/hq/start#mine');
  }));

  r.get('/app/hq/w/:id', ...A, (req, res, next) => {
    const wf = harness.workflowPage(req.user, req.params.id);
    if (!wf) return next();
    const prefill = {};
    for (const [k, v] of Object.entries(req.query)) if (k.startsWith('in_')) prefill[k.slice(3)] = String(v).slice(0, 2000);
    const fromBrain = harness._guessInputs(packs.workflow(wf.id), '', brain.snapshot(req.user));
    const fields = formFields(wf.inputs, { ...fromBrain, ...prefill });
    // File inputs pick from the member's Library (and can add to it right there).
    const mine = fields.some((f) => f.control === 'asset' || f.control === 'assets') ? library.list(req.user.id, { limit: 200 }) : [];
    for (const f of fields) if (f.control === 'asset' || f.control === 'assets') f.files = mine.filter((x) => fits(x, f.accept)).slice(0, 60);
    const names = fields.some((f) => f.control === 'lead') ? [...new Set(pipeline.list(req.user.id, { limit: 300 }).filter((l) => l.stage !== 'lost').map((l) => l.name).filter(Boolean))] : [];
    for (const f of fields) if (f.control === 'lead') f.names = names;
    page(res, 'workflow', wf.title, { wf, fields });
  });

  r.post('/app/hq/w/:id/run', ...A, wrap(async (req, res, next) => {
    const wf = packs.workflow(req.params.id);
    // Hidden workflows have no page and start only from their own place in HQ (the queue, Monday's card, the Store).
    if (!wf || wf.hidden) return next();
    if (!allow(req, res, 'hq2-run', 20, 60 * 60 * 1000)) return;
    try {
      const sample = !!req.body.sample && isAdmin(req.user);
      const run = await engine.start(req.user, wf.id, inputsFrom(req.body, wf.inputs), { sample, source: 'hq', agreed: [].concat(req.body.agree || []) });
      if (!sample) await harness.learnCity(req.user, wf, run.inputs);
      track(req, 'HQ Run', { workflow: wf.id });
      res.redirect(`/app/hq/runs/${run.id}`);
    } catch (err) {
      // The page was open when its search turned real: back to it with their answers and the line to read.
      const keep = err.status === 428 ? new URLSearchParams(Object.entries(req.body).filter(([k, v]) => k.startsWith('in_') && typeof v === 'string')).toString() : '';
      fail(req, res, err, `/app/hq/w/${wf.id}${keep ? `?${keep}` : ''}`);
    }
  }));

  // ---------- runs ----------
  r.get('/app/hq/runs', ...A, (req, res) => {
    const runs = engine.list(req.user, { limit: 100 }).map((x) => ({ id: x.id, title: x.title, status: x.status, createdAt: x.createdAt, endedAt: x.endedAt, credits: x.credits, freeRun: !!x.freeRun }));
    page(res, 'runs', 'Runs', { runs, repeats: harness.schedules.list(req.user.id) });
  });

  const runOf = (req) => engine.get(req.user, req.params.id);

  // Take it to your own Claude (Legal L79 PC1 to PC4): only with the AI link on, only for a finished run, and the
  // prompt names the run by its workflow's name and the date, never a person, contact detail, number or result.
  const ownClaude = (user, run, wf) => {
    if (run.status !== 'done' || run.sample || !wf || !require('../hq-harness').on() || !require('../hq').connections(user, '').ai) return null;
    const name = String(wf.title || '').replace(/["\n]/g, '').slice(0, 80);
    if (!name || /@|\d{3}|https?:/i.test(name)) return null;
    const date = new Date(run.endedAt || run.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
    return { prompt: `Use 127. Open my run "${name}" from ${date} and help me with the next step. Keep my tone from my Brain.` };
  };

  r.get('/app/hq/runs/:id', ...A, (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    const v = engine.view(run);
    const wf = packs.workflow(run.workflowId);
    // One next step at a time, with the reason it comes next (the rest stay out of the way).
    const after = (v.next || []).map((id) => packs.workflow(id)).filter((w) => w && !w.hidden).slice(0, 1).map((w) => ({ ...harness.card(w, req.user), why: (wf && wf.nextWhy && wf.nextWhy[w.id]) || '' }));
    // A workflow that suggests a schedule offers to repeat once a run is done (contract v1.4).
    const offer = harness.schedules.offer(req.user, run);
    const repeat = offer && { ...offer, credits: engine.estimate(wf, run.inputs || {}) };
    const repeating = !offer && harness.schedules.forWorkflow(req.user.id, run.workflowId);
    // HQ_PREMIUM (Legal L79): the repeat offer reads "Save this as a skill" (SK1 to SK3), and a finished run offers
    // a prompt for the member's own Claude when their AI link is on (PC1 to PC4).
    const premium = harness.flags.on('HQ_PREMIUM', req.user);
    const skillCard = premium && repeat && !wins.offerSeen(req.user.id, `skill-later:${run.workflowId}`) ? repeat : null;
    page(res, 'run', v.title, { v, wf, costs: isAdmin(req.user) ? { usd: run.usd || 0, steps: engine.costs(run) } : null, next: after, live: LIVE.has(v.status), repeat: premium ? null : repeat, repeating, skillCard, premium, ownClaude: premium ? ownClaude(req.user, run, wf) : null });
  });

  const lower = (label) => label.charAt(0).toLowerCase() + label.slice(1);

  r.post('/app/hq/runs/:id/repeat', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    try {
      const s = await harness.schedules.create(req.user, run);
      track(req, 'HQ Repeat On', { workflow: run.workflowId });
      flash(req, 'win', `${s.title} repeats ${lower(s.label)}. Stop it any time on Runs.`);
    } catch (err) {
      if (!err.status) throw err;
      flash(req, 'error', err.message);
    }
    res.redirect(`/app/hq/runs/${run.id}`);
  }));

  r.post('/app/hq/repeats/:id/stop', ...A, wrap(async (req, res, next) => {
    if (!(await harness.schedules.remove(req.user, req.params.id))) return next();
    flash(req, 'info', 'Stopped. Everything it already made stays.');
    res.redirect(req.body && req.body.back === 'skills' ? '/app/hq/skills#saved' : '/app/hq/runs');
  }));

  // Save as a skill (HQ_PREMIUM, Legal L79): the same repeat as "Repeat it", saved only on the member's tap and
  // listed on Skills, where Stop removes it like Stop on Runs (schedules.remove, its saved answers too).
  r.post('/app/hq/runs/:id/skill', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run || !harness.flags.on('HQ_PREMIUM', req.user)) return next();
    try {
      const s = await harness.schedules.create(req.user, run);
      s.savedAs = 'skill';
      await require('../db').save('schedules', s);
      track(req, 'HQ Repeat On', { workflow: run.workflowId, as: 'skill' });
      flash(req, 'win', `${s.title} is saved as a skill: ${lower(s.label)}. Stop it any time on Skills.`);
    } catch (err) {
      if (!err.status) throw err;
      flash(req, 'error', err.message);
    }
    res.redirect(`/app/hq/runs/${run.id}`);
  }));

  // "Not now" saves nothing and hides the card for that workflow (SK1).
  r.post('/app/hq/runs/:id/skill/later', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    await wins.markOffer(req.user.id, `skill-later:${run.workflowId}`);
    res.redirect(`/app/hq/runs/${run.id}`);
  }));

  r.get('/app/hq/runs/:id/view.json', ...A, (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    privatePage(res);
    const v = engine.view(run);
    res.json({ status: v.status, steps: v.steps.map((s) => ({ id: s.id, status: s.status, progress: s.progress })), waiting: !!v.waitingOn });
  });

  r.post('/app/hq/runs/:id/answer/:step', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    const b = req.body || {};
    const back = b.back === '/app/hq/inbox' || b.back === '/app/hq' ? b.back : `/app/hq/runs/${run.id}`;
    const items = {};
    for (const [k, v] of Object.entries(b)) if (k.startsWith('item_')) items[k.slice(5)] = String(v);
    try {
      await engine.answer(req.user, run.id, req.params.step, { approved: b.skip ? false : true, chosen: [].concat(b.chosen || []).map(String), items });
      res.redirect(back);
    } catch (err) {
      fail(req, res, err, back);
    }
  }));

  for (const [verb, fn, done] of [['stop', engine.cancel, 'Stopped.'], ['retry', engine.retry, 'Trying again.'], ['wake', engine.wake, 'Picked up early.']]) {
    r.post(`/app/hq/runs/:id/${verb}`, ...A, wrap(async (req, res, next) => {
      const run = runOf(req);
      if (!run) return next();
      try {
        await fn(req.user, run.id);
        flash(req, 'info', done);
        res.redirect(`/app/hq/runs/${run.id}`);
      } catch (err) {
        fail(req, res, err, `/app/hq/runs/${run.id}`);
      }
    }));
  }

  // "Delete this run" (Legal L73): HQ only, never the AI link.
  r.post('/app/hq/runs/:id/delete', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run) return next();
    await engine.remove(req.user, run.id);
    track(req, 'HQ Run Deleted', { workflow: run.workflowId });
    flash(req, 'info', 'Deleted. Its answers, results, files and Inbox cards are gone.');
    res.redirect('/app/hq/runs');
  }));

  // Admins: make a finished sample run the example on its workflow's page.
  r.post('/app/hq/runs/:id/showcase', ...A, wrap(async (req, res, next) => {
    const run = runOf(req);
    if (!run || !isAdmin(req.user)) return next();
    try {
      await harness.setShowcase(run.id);
      flash(req, 'win', 'This run is now the example on the workflow page.');
    } catch (err) {
      flash(req, 'error', err.message);
    }
    res.redirect(`/app/hq/runs/${run.id}`);
  }));

  // ---------- inbox ----------
  r.get('/app/hq/inbox', ...A, (req, res) => {
    const items = inbox
      .list(req.user.id, { status: 'open', limit: 50 })
      .map((i) => {
        const run = engine.get(req.user, i.runId);
        const v = run && engine.view(run);
        return v ? { ...i, step: v.steps.find((s) => s.id === i.stepId) || null } : null;
      })
      .filter((x) => x && x.step && x.step.ask);
    page(res, 'inbox', 'Inbox', { items });
  });

  // ---------- pipeline ----------
  r.get('/app/hq/pipeline', ...A, wrap(async (req, res) => {
    const stage = pipeline.STAGES.includes(req.query.stage) ? req.query.stage : null;
    const all = pipeline.list(req.user.id, { limit: 500 });
    // Google businesses' names are fetched for this page, live stages first, and not kept (Legal L53).
    const order = ['replied', 'call', 'contacted', 'found', 'won', 'lost'].filter((s) => !stage || s === stage);
    const leads = await places.show(order.flatMap((s) => all.filter((l) => l.stage === s)).concat(stage ? all.filter((l) => l.stage !== stage) : []));
    const board = pipeline.STAGES.map((s) => ({ stage: s, label: pipeline.LABELS[s], leads: leads.filter((l) => l.stage === s) }));
    // A business from OpenStreetMap on the board: the page shows its credit (Legal L53).
    page(res, 'pipeline', 'Pipeline', { board, stage, stages: pipeline.STAGES, labels: pipeline.LABELS, madeUp: pipeline.madeUp, osm: leads.some(pipeline.fromOsm), hundred: todayLib.hundred(req.user), score: todayLib.scoreboard(req.user), ladder: todayLib.ladder(req.user) });
  }));

  r.post('/app/hq/pipeline/:id/move', ...A, express.json({ limit: '2kb' }), wrap(async (req, res, next) => {
    const stage = String(req.body.stage || '');
    if (!pipeline.STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage.' });
    const lead = await pipeline.move(req.user.id, req.params.id, stage);
    if (!lead) return next();
    const win = stage === 'won' ? `/app/hq/win?lead=${encodeURIComponent(lead.id)}` : null;
    if (req.accepts(['html', 'json']) === 'json') return res.json({ lead, counts: pipeline.counts(req.user.id), hundred: todayLib.hundred(req.user), win });
    if (win) return res.redirect(win);
    res.redirect(`/app/hq/pipeline${req.body.from ? `?stage=${encodeURIComponent(req.body.from)}` : ''}#${lead.id}`);
  }));

  r.post('/app/hq/pipeline/:id/note', ...A, wrap(async (req, res, next) => {
    const lead = await pipeline.note(req.user.id, req.params.id, String(req.body.note || ''));
    if (!lead) return next();
    res.redirect(`/app/hq/pipeline#${lead.id}`);
  }));

  // "Delete this lead" (Legal L74): HQ only, never the AI link.
  r.post('/app/hq/pipeline/:id/delete', ...A, wrap(async (req, res, next) => {
    const gone = await harness.deleteLead(req.user, req.params.id);
    if (!gone) return next();
    track(req, 'HQ Lead Deleted', {});
    flash(req, 'info', 'Deleted. The lead, its drafts, notes and history are gone.');
    res.redirect('/app/hq/pipeline');
  }));

  // ---------- library ----------
  r.get('/app/hq/library', ...A, (req, res) => {
    const files = library.list(req.user.id, { limit: 200 });
    page(res, 'library', 'Library', { files, used: library.used(req.user.id), quota: library.quota(ledger.tierOf(req.user)), maxMb: Math.max(1, Number(process.env.HARNESS_MAX_FILE_MB || 25)) });
  });

  // A file: the member's own, or one from a workflow's example run. HTML and SVG never run scripts
  // here: they download (HTML can show as text), or (?preview=1, owner or example) render in a
  // sandbox with scripts, forms, pop-ups and outside requests off. Text, call and email links
  // (sms:, tel:, mailto:) still open the member's own apps: send sheets are built around them.
  r.get('/app/hq/files/:id', on, requireAuth, wrap(async (req, res, next) => {
    const a = db.get('assets', String(req.params.id));
    if (!a || (a.memberId !== req.user.id && !a.public)) return next();
    const got = await library.read(a.memberId, a.id);
    if (!got) return next();
    privatePage(res);
    const html = a.type === 'text/html';
    const preview = (html || a.type === 'image/svg+xml') && !!req.query.preview && !req.query.download;
    res.set('Content-Type', html ? (preview ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8') : a.type);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data: https:; media-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action 'none'; frame-ancestors 'self'; sandbox allow-top-navigation-to-custom-protocols");
    const mode = req.query.download ? 'attachment' : preview ? 'inline' : library.disposition(a.type);
    res.set('Content-Disposition', `${mode}; filename="${a.name.replace(/["\\\r\n]/g, '')}"`);
    res.send(got.buf);
  }));

  // Add a file to the Library (the page's script sends the file as the body: Content-Type is its
  // type, X-File-Name its name). For workflows that use the member's own clips, photos or exports.
  const MB = 1024 * 1024;
  const maxUpload = () => Math.max(1, Number(process.env.HARNESS_MAX_FILE_MB || 25)) * MB;
  const uploadBody = (req, res, next) => express.raw({ type: () => true, limit: maxUpload() })(req, res, next);
  r.post(
    '/app/hq/library/upload',
    ...A,
    (req, res, next) => (allow(req, res, 'hq2-upload', 60, 60 * 60 * 1000) ? next() : undefined),
    uploadBody,
    wrap(async (req, res) => {
      let name = 'file';
      try {
        name = decodeURIComponent(String(req.get('x-file-name') || 'file')).slice(0, 200);
      } catch {
        /* keep 'file' */
      }
      const type = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'That file is empty.' });
      if (!library.typeFor(name, type)) return res.status(415).json({ error: "127 can't keep that kind of file. Videos, photos, audio, PDFs, spreadsheets, contacts and text files work." });
      try {
        const file = await library.save({ id: req.user.id, tier: ledger.tierOf(req.user) }, name, req.body, { type: library.TYPES[type] ? type : undefined });
        track(req, 'HQ Upload', { type: file.type });
        res.json({ file });
      } catch (err) {
        // Too big, or the Library is full: the member can fix those.
        if (/limit is|Library is full/.test(err.message)) return res.status(413).json({ error: err.message });
        throw err;
      }
    }),
    // A body over the size limit, one that can't be read, or a failure saving it. Never logs the body.
    // eslint-disable-next-line no-unused-vars
    (err, req, res, next) => {
      if (err.status === 413 || err.type === 'entity.too.large') return res.status(413).json({ error: `That file is over ${Math.round(maxUpload() / MB)} MB.` });
      if (err.status && err.status < 500) return res.status(400).json({ error: "Couldn't read that upload. Try again." });
      console.error('[harness] upload failed:', scrubKeys(err && err.message));
      res.status(500).json({ error: 'Something went wrong saving that file. Try again.' });
    },
  );

  r.post('/app/hq/files/:id/delete', ...A, wrap(async (req, res) => {
    await library.remove(req.user.id, String(req.params.id));
    flash(req, 'info', 'Deleted.');
    res.redirect('/app/hq/library');
  }));

  // ---------- your business and setup ----------
  r.get('/app/hq/brain', ...A, (req, res) => {
    page(res, 'brain', 'Your business', { b: brain.snapshot(req.user), daily: todayLib.target(req.user), ...workspace.brainLocals(req.user, req.query.q) });
  });

  r.post('/app/hq/brain', ...A, wrap(async (req, res) => {
    const patch = {};
    for (const [group, keys] of Object.entries(brain.FIELDS)) {
      patch[group] = {};
      for (const k of keys) if (req.body[`${group}_${k}`] !== undefined) patch[group][k] = String(req.body[`${group}_${k}`]);
    }
    if (patch.goal.daily !== undefined && patch.goal.daily !== '') {
      const n = parseInt(patch.goal.daily, 10);
      patch.goal.daily = Number.isInteger(n) && n >= 1 && n <= todayLib.MAX_TARGET ? String(n) : '';
    }
    const snap = await brain.update(req.user, patch);
    if (await activation.business(req.user.id, snap)) track(req, 'HQ Activation', { step: 'a1' });
    flash(req, 'win', 'Saved. Every workflow uses this now.');
    res.redirect('/app/hq/brain');
  }));

  r.get('/app/hq/setup', ...A, (req, res) => {
    page(res, 'setup', 'Set up', { s: setup.list(req.user, brain.snapshot(req.user), { connect: hqLive(req.user) }) });
  });

  // ---------- admin ----------
  r.get('/admin/harness', (req, res, next) => (isAdmin(req.user) ? next() : next('router')), (req, res) => {
    privatePage(res);
    res.json(harness.adminStatus());
  });

  // Early access (access.js): an admin gives one member HQ v2, with a plan and credits inside HQ until
  // a date. These work whatever HARNESS_V2 says, so access can be ready before it's switched on.
  const admin = (req, res, next) => (isAdmin(req.user) ? next() : next('router'));
  r.post('/admin/hq2/access', admin, wrap(async (req, res) => {
    const out = await access.give(req.body.email, { by: req.user.email, until: req.body.until, plan: req.body.plan, credits: req.body.credits });
    if (out.error) flash(req, 'error', out.error);
    else {
      const who = out.user.name || out.user.email;
      const live = harness.mode() === 'off' ? ' It shows once HARNESS_V2 is admins or on.' : '';
      const g = out.user.hqV2;
      const credits = Math.max(ledger.allowances()[g.plan] || 0, g.credits || 0);
      const what = `${g.plan === 'circle' ? "the Founder's Circle" : 'Builder'} inside HQ and ${credits.toLocaleString('en-US')} credits a month until ${g.until}`;
      flash(req, 'win', out.user.emailVerified ? `${who} has HQ v2, with ${what}.${live}` : `Saved. ${who} gets HQ v2, with ${what}, once they confirm their email.${live}`);
    }
    res.redirect('/admin#hq2');
  }));
  r.post('/admin/hq2/access/:id/remove', admin, wrap(async (req, res) => {
    const u = await access.remove(req.params.id);
    if (u) flash(req, 'win', `${u.name || u.email} is back on HQ v1. Their runs, Pipeline and files are kept.`);
    res.redirect('/admin#hq2');
  }));

  workspace.mount(r, { A, wrap, flash, track, allow, page });
  require('./routes-site-chat').mount(r, { A, wrap, flash, page });

  // The proof library: wins members agreed to share, each with its consent record. Nothing here goes
  // into marketing until Legal's checklist passes.
  r.get('/admin/harness/proof', (req, res, next) => (isAdmin(req.user) ? next() : next('router')), (req, res) => {
    privatePage(res);
    res.json({ proof: wins.library() });
  });

  return r;
}

module.exports = harnessRoutes;
module.exports.formFields = formFields;
module.exports.inputsFrom = inputsFrom;
module.exports.fits = fits;
module.exports._schema = schema;
