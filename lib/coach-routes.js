// Coach accounts: a coach saves their launch kit (lib/coach-kit.js) and gets a challenge link; their clients join from
// it, use the coach-branded app (public/coach-app/) and check in; the coach's dashboard (public/coaches/dashboard.html)
// reads the real roster.
//
// Switch COACH_CLIENTS = off | admins | on (default off). Saving a kit works for any signed-in member; the public
// challenge pages, joining and check-ins answer only when the switch allows the viewer (admins: only admins, for a
// private run before Legal reads it). Client data kept: first name, email, join time and the dates they ticked. No
// workouts, weights, food or body data reach 127 (those stay on the client's phone, Legal L87).
//
// Collections: coachKits (doc id = coach's user id), coachClients (one per client; tokenHash only, never the token).

const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./db');
const security = require('./security');
const coachKit = require('./coach-kit');
const coachAi = require('./coach-ai');

const APP_FILE = path.join(__dirname, '..', 'public', 'coach-app', 'index.html');
const DASH_FILE = path.join(__dirname, '..', 'public', 'coaches', 'dashboard.html');
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function mode() {
  const v = String(process.env.COACH_CLIENTS || 'off').toLowerCase();
  return v === 'on' || v === 'admins' ? v : 'off';
}
function kitFor(userId) { return db.get('coachKits', userId); }
function kitBySlug(slug) { return db.find('coachKits', (k) => k.slug === slug); }
function clientsOf(kitId) { return db.filter('coachClients', (c) => c.kitId === kitId); }
function uniqueSlug(base, ownId) {
  let s = base; let n = 2;
  // One /c/ namespace with the coach platform (lib/coach, COACH_PLATFORM): skip slugs another coach's site uses.
  while (db.find('coachKits', (k) => k.slug === s && k.id !== ownId) || db.find('coaches', (c) => c.slug === s && c.id !== ownId)) s = `${base}-${n++}`;
  return s;
}
// The client app's config, put in the page so the app needs no extra request. JSON in a script tag: escape "<".
function appConfig(kit) {
  const f = coachKit.normalize(kit.input);
  return { coach: f.business, by: f.coach, color: f.color, days: f.days, start: f.start, ch: f.challenge, slug: kit.slug };
}
function inject(file, cfgName, cfg) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  return fs.readFileSync(file, 'utf8').replace('<script>', `<script>window.${cfgName} = ${json};</script>\n<script>`);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Day n of the challenge for an ISO date (1-based), and whether a check-in for that date counts.
function dayOf(start, date) { return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 864e5) + 1; }

function summary(kit, today) {
  const f = coachKit.normalize(kit.input);
  const n = Math.max(0, Math.min(f.days, dayOf(f.start, today)));
  const clients = clientsOf(kit.id).map((c) => {
    const ticks = []; let miss = 0;
    for (let d = 1; d <= n; d++) {
      const iso = new Date(Date.parse(`${f.start}T12:00:00Z`) + (d - 1) * 864e5).toISOString().slice(0, 10);
      ticks.push(c.checkins && c.checkins[iso] ? 1 : 0);
    }
    for (let i = ticks.length - 1; i >= 0 && !ticks[i]; i--) miss++;
    return { name: c.name, p: ticks.join(''), pts: ticks.reduce((a, b) => a + b, 0), miss, joined: c.joinedAt };
  });
  return { coach: f.business, by: f.coach, ch: f.challenge, color: f.color, days: f.days, day: n, start: f.start, clients };
}

module.exports = function mount(app, { requireAuth, isAdmin }) {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const json = express.json({ limit: '20kb' });
  const form = express.urlencoded({ extended: false, limit: '10kb' });
  const open = (req) => mode() === 'on' || (mode() === 'admins' && isAdmin(req.user));
  const gate = (req, res, next) => (open(req) ? next() : res.status(404).render('404', { title: 'Not found' }));

  // Save (or update) the signed-in coach's kit. Signed out: 401 and the page sends them to sign up, keeping the form.
  app.post('/coaches/kit', json, wrap(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'signin', next: '/start?next=/coaches' });
    if (!security.allow(`coachkit:${req.user.id}`, 30, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many saves. Try again in a bit.' });
    const kit = coachKit.build(req.body || {});
    if (kit.problems.length) return res.status(422).json({ error: 'claim', text: kit.problems[0].text });
    const prev = kitFor(req.user.id);
    const doc = { id: req.user.id, userId: req.user.id, slug: prev && prev.slug ? prev.slug : uniqueSlug(kit.facts.slug, req.user.id), input: kit.facts, createdAt: prev ? prev.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.save('coachKits', doc);
    res.json({ ok: true, slug: doc.slug, joinUrl: `/c/${doc.slug}`, dashboardUrl: '/coaches/dashboard', live: mode() !== 'off' });
  }));

  app.get('/coaches/kit', requireAuth, (req, res) => {
    const k = kitFor(req.user.id);
    res.json(k ? { slug: k.slug, input: k.input, joinUrl: `/c/${k.slug}` } : null);
  });

  // AI rewrite of the kit in the coach's voice (lib/coach-ai.js), behind COACH_AI = off | admins | on.
  const aiOpen = (req) => !!req.user && (coachAi.mode() === 'on' || (coachAi.mode() === 'admins' && isAdmin(req.user)));
  app.get('/coaches/kit/ai', (req, res) => res.json({ on: aiOpen(req) }));
  app.post('/coaches/kit/rewrite', json, wrap(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'signin', next: '/start?next=/coaches' });
    if (!aiOpen(req)) return res.status(404).json({ error: 'not found' });
    if (!security.allow(`coachai:${req.user.id}`, 10, 60 * 60 * 1000)) return res.status(429).json({ error: 'That is 10 rewrites this hour. Try again in a bit.' });
    let r;
    try { r = await coachAi.rewrite(req.body || {}); } catch (err) {
      console.error('[coach-ai] error', (err && err.status) || '', err && err.message);
      return res.status(503).json({ error: 'The rewrite is unavailable right now. Your template kit is still here.' });
    }
    if (r.error) return res.status(422).json({ error: 'claim', text: r.text });
    res.json({ ok: true, sections: r.sections, used: r.used, kept: Object.keys(r.kept) });
  }));

  // The coach's dashboard: real roster when they have a kit, sample clients otherwise.
  app.get('/coaches/dashboard', requireAuth, (req, res) => {
    const k = kitFor(req.user.id);
    if (!k) return res.redirect('/coaches#kit');
    res.type('html').send(inject(DASH_FILE, 'COACH_DASH', summary(k, new Date().toISOString().slice(0, 10))));
  });

  // Public challenge page with the join form.
  app.get('/c/:slug', gate, (req, res) => {
    const k = kitBySlug(req.params.slug);
    if (!k) return res.status(404).render('404', { title: 'Not found' });
    const kit = coachKit.build(k.input); const c = kit.challenge; const f = kit.facts;
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)}</title><meta name="robots" content="noindex">
<style>:root{--c:${f.color}}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#18131a;background:#fff;line-height:1.5}
.top{background:#111;color:#fff;padding:32px 20px}.w{max-width:560px;margin:0 auto}small{color:var(--c);font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:12px}
h1{font-size:34px;line-height:1.05;letter-spacing:-.03em;margin:10px 0}.sec{padding:22px 20px;border-top:1px solid #eee}h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--c);margin:0 0 10px}
form{display:grid;gap:10px}input{font:inherit;padding:13px;border:1px solid #ddd;border-radius:12px;width:100%}button{font:inherit;font-weight:700;background:var(--c);color:#fff;border:0;border-radius:999px;padding:14px}
label.ck{display:flex;gap:10px;font-size:14px;color:#555;align-items:flex-start}label.ck input{width:auto;margin-top:3px}</style></head><body>
<div class="top"><div class="w"><small>${esc(c.dates)}</small><h1>${esc(c.title)}</h1><p style="color:#ccc;margin:0">${esc(c.line)}</p></div></div>
<div class="sec"><div class="w"><h2>Every day</h2><ol>${c.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div></div>
<div class="sec"><div class="w"><h2>What you get</h2><ul>${c.get.map((r) => `<li>${esc(r)}</li>`).join('')}</ul><p><b>${esc(c.finish)}</b></p></div></div>
<div class="sec"><div class="w"><h2>Join ${esc(f.coach)}</h2>
<form method="post" action="/c/${esc(k.slug)}/join"><input name="name" placeholder="First name" required maxlength="40" autocomplete="given-name">
<input name="email" type="email" placeholder="Email" required maxlength="200" autocomplete="email">
<label class="ck"><input type="checkbox" name="ok" value="1" required><span>${esc(f.coach)} can see my name and which days I check in. My workouts stay on my phone.</span></label>
<button type="submit">Join the challenge${f.price ? ` (${esc(f.priceText)}, paid to ${esc(f.coach)})` : ''}</button></form>
<p style="font-size:13px;color:#555">Check with your doctor before starting a new exercise plan.</p></div></div></body></html>`);
  });

  // Join: one client per email per coach; the app link carries the client's token in the #hash (never sent to a server).
  app.post('/c/:slug/join', gate, form, wrap(async (req, res) => {
    const k = kitBySlug(req.params.slug);
    if (!k) return res.status(404).render('404', { title: 'Not found' });
    if (!security.allow(`coachjoin:${security.ip(req)}`, 10, 60 * 60 * 1000)) return res.status(429).send('Too many tries. Wait a few minutes and try again.');
    const name = String(req.body.name || '').trim().slice(0, 40);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
    if (!name || !EMAIL.test(email) || req.body.ok !== '1') return res.status(400).send('Add your first name, a real email and tick the box, then try again.');
    const t = security.token();
    let c = db.find('coachClients', (x) => x.kitId === k.id && x.email === email);
    if (c) c = { ...c, name, tokenHash: security.hash(t) };
    else c = { id: db.id(), kitId: k.id, name, email, joinedAt: new Date().toISOString(), consent: { text: 'name and check-in days visible to coach', at: new Date().toISOString() }, checkins: {}, tokenHash: security.hash(t) };
    await db.save('coachClients', c);
    res.redirect(303, `/c/${k.slug}/app#t=${t}`);
  }));

  app.get('/c/:slug/app', gate, (req, res) => {
    const k = kitBySlug(req.params.slug);
    if (!k) return res.status(404).render('404', { title: 'Not found' });
    res.set('Referrer-Policy', 'no-referrer').type('html').send(inject(APP_FILE, 'COACH_APP', appConfig(k)));
  });

  // A client's check-in for one date inside the challenge (toggle). Token in the body, compared by hash.
  app.post('/c/:slug/checkin', gate, json, wrap(async (req, res) => {
    const k = kitBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'not found' });
    if (!security.allow(`coachcheck:${security.ip(req)}`, 120, 60 * 60 * 1000)) return res.status(429).json({ error: 'slow down' });
    const { t, date, on } = req.body || {};
    const h = security.hash(String(t || ''));
    const c = db.find('coachClients', (x) => x.kitId === k.id && x.tokenHash && security.sameHash(x.tokenHash, h));
    if (!c) return res.status(403).json({ error: 'Open the app from your join link again.' });
    const f = coachKit.normalize(k.input);
    const n = DAY.test(String(date)) ? dayOf(f.start, date) : 0;
    if (n < 1 || n > f.days) return res.status(400).json({ error: 'That day is outside the challenge.' });
    const checkins = { ...(c.checkins || {}) };
    if (on === false) delete checkins[date]; else checkins[date] = new Date().toISOString();
    await db.save('coachClients', { ...c, checkins });
    res.json({ ok: true, count: Object.keys(checkins).length });
  }));
};

module.exports.summary = summary;
module.exports.mode = mode;
