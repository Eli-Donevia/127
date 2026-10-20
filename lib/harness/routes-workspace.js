// HQ v2's workspace pages, each behind its own flag (lib/harness/flags.js): Brain docs and house
// rules (BRAIN_DOCS), the Activity log (HQ_ACTIVITY). Mounted by routes.js with its helpers.
// A page whose flag is off for the member falls through to a 404.

const express = require('express');
const harness = require('./index');
const { scrubKeys } = require('./text');

const { brain, docs, activity, flags } = harness;
const MB = 1024 * 1024;

function mount(r, { A, wrap, flash, track, allow, page }) {
  const flag = (name) => (req, res, next) => (flags.on(name, req.user) ? next() : next('router'));
  const BD = [...A, flag('BRAIN_DOCS')];
  const AC = [...A, flag('HQ_ACTIVITY')];
  const log = (req, entry) => activity.note(req.user, { who: 'you', ...entry });

  // ---------- Brain docs ----------
  r.post('/app/hq/brain/rules', ...BD, wrap(async (req, res) => {
    const b = req.body || {};
    try {
      await docs.setRules(req.user.id, { principles: b.principles, sops: b.sops, checks: b.checks });
    } catch (err) {
      flash(req, 'error', err.message);
      return res.redirect('/app/hq/brain#rules');
    }
    log(req, { kind: 'brain', action: 'changed house rules', what: 'Principles, ways of working and checks' });
    flash(req, 'win', 'Saved. Every workflow and Ask 127 follow these from now on.');
    res.redirect('/app/hq/brain#rules');
  }));

  r.post('/app/hq/brain/docs', ...BD, (req, res, next) => (allow(req, res, 'brain-doc', 120, 60 * 60 * 1000) ? next() : undefined), wrap(async (req, res) => {
    const b = req.body || {};
    try {
      const d = await docs.save(req.user.id, { title: b.title, body: b.body, tags: b.tags, public: b.public === 'on', source: 'paste' });
      log(req, { kind: 'brain', action: 'added a doc', what: d.title, ref: `/app/hq/brain/docs/${d.id}` });
      flash(req, 'win', `Added "${d.title}" to your Brain.`);
      res.redirect(`/app/hq/brain/docs/${d.id}`);
    } catch (err) {
      flash(req, 'error', err.message);
      res.redirect('/app/hq/brain#docs');
    }
  }));

  // A file (md, txt, csv, html, docx, pdf) becomes a doc; a .zip is an Obsidian vault or a Notion
  // export. Raw body with X-File-Name, like the Library's upload. The file itself is never kept.
  const body = (req, res, next) => express.raw({ type: () => true, limit: 40 * MB })(req, res, next);
  r.post(
    '/app/hq/brain/docs/upload',
    ...BD,
    (req, res, next) => (allow(req, res, 'brain-upload', 60, 60 * 60 * 1000) ? next() : undefined),
    body,
    wrap(async (req, res) => {
      let name = 'file';
      try {
        name = decodeURIComponent(String(req.get('x-file-name') || 'file')).slice(0, 200);
      } catch {
        /* keep 'file' */
      }
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'That file is empty.' });
      try {
        if (/\.zip$/i.test(name)) {
          const source = /notion/i.test(String(req.get('x-import') || '')) ? 'notion' : 'obsidian';
          const out = await docs.importZip(req.user.id, req.body, { source });
          log(req, { kind: 'brain', action: source === 'notion' ? 'imported Notion pages' : 'imported an Obsidian vault', what: `${out.added} added, ${out.updated} updated${out.skipped.length ? `, ${out.skipped.length} skipped` : ''}` });
          track(req, 'HQ Brain Import', { source, added: out.added });
          return res.json({ imported: out, message: `${out.added} added, ${out.updated} updated${out.skipped.length ? `. Skipped: ${out.skipped.slice(0, 5).join('; ')}` : ''}.` });
        }
        if (name.length > 5 && /\.(md|markdown|txt|text|csv|tsv|html?|docx|pdf)$/i.test(name) && req.body.length > 15 * MB) return res.status(413).json({ error: 'That file is over 15 MB. Split it, or paste the part that matters.' });
        const d = await docs.addFile(req.user.id, name, req.body);
        log(req, { kind: 'brain', action: 'added a doc', what: `${d.title} (from a file)`, ref: `/app/hq/brain/docs/${d.id}` });
        track(req, 'HQ Brain Doc', { kind: d.kind });
        res.json({ doc: docs.view(d), message: `Added "${d.title}".` });
      } catch (err) {
        if (err && err.status) throw err;
        res.status(400).json({ error: err.message });
      }
    }),
    // eslint-disable-next-line no-unused-vars
    (err, req, res, next) => {
      if (err.status === 413 || err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is over 40 MB.' });
      if (err.status && err.status < 500) return res.status(400).json({ error: "Couldn't read that upload. Try again." });
      console.error('[harness] brain upload failed:', scrubKeys(err && err.message));
      res.status(500).json({ error: 'Something went wrong adding that file. Try again.' });
    },
  );

  r.get('/app/hq/brain/docs/:id', ...BD, (req, res, next) => {
    const d = docs.get(req.user.id, req.params.id);
    if (!d) return next('router');
    const titles = new Map(docs.list(req.user.id).map((x) => [x.title.toLowerCase(), x.id]));
    page(res, 'brain-doc', d.title, { d, view: docs.view(d), linked: (d.links || []).map((t) => ({ title: t, id: titles.get(t.toLowerCase()) || null })), backlinks: docs.list(req.user.id).filter((x) => x.id !== d.id && (x.links || []).some((t) => t.toLowerCase() === d.title.toLowerCase())).map(docs.view) });
  });

  r.post('/app/hq/brain/docs/:id', ...BD, wrap(async (req, res) => {
    const b = req.body || {};
    try {
      const d = await docs.save(req.user.id, { id: req.params.id, title: b.title, body: b.body, tags: b.tags, public: b.public === 'on' });
      log(req, { kind: 'brain', action: 'edited a doc', what: d.title, ref: `/app/hq/brain/docs/${d.id}` });
      flash(req, 'win', 'Saved.');
    } catch (err) {
      flash(req, 'error', err.message);
    }
    res.redirect(`/app/hq/brain/docs/${encodeURIComponent(req.params.id)}`);
  }));

  r.post('/app/hq/brain/docs/:id/delete', ...BD, wrap(async (req, res) => {
    const d = docs.get(req.user.id, req.params.id);
    if (d && (await docs.remove(req.user.id, d.id))) {
      log(req, { kind: 'brain', action: 'deleted a doc', what: d.title });
      flash(req, 'info', `Deleted "${d.title}". It's gone from your Brain and from search.`);
    }
    res.redirect('/app/hq/brain#docs');
  }));

  r.post('/app/hq/brain/decisions', ...BD, wrap(async (req, res) => {
    try {
      const e = await docs.logDecision(req.user.id, { text: req.body.text, why: req.body.why, by: 'you' });
      log(req, { kind: 'brain', action: 'logged a decision', what: e.text });
      flash(req, 'win', 'Logged.');
    } catch (err) {
      flash(req, 'error', err.message);
    }
    res.redirect('/app/hq/brain#decisions');
  }));

  r.post('/app/hq/brain/numbers', ...BD, wrap(async (req, res) => {
    try {
      const e = await docs.logNumber(req.user.id, { name: req.body.name, value: req.body.value, note: req.body.note, by: 'you' });
      log(req, { kind: 'brain', action: 'logged a number', what: e.name });
      flash(req, 'win', 'Logged.');
    } catch (err) {
      flash(req, 'error', err.message);
    }
    res.redirect('/app/hq/brain#numbers');
  }));

  r.post('/app/hq/brain/log/:id/delete', ...BD, wrap(async (req, res) => {
    if (await docs.removeLog(req.user.id, req.params.id)) {
      log(req, { kind: 'brain', action: 'deleted a log entry', what: 'A decision or number' });
      flash(req, 'info', 'Deleted.');
    }
    res.redirect(`/app/hq/brain#${req.query.from === 'numbers' ? 'numbers' : 'decisions'}`);
  }));

  r.get('/app/hq/brain/export', ...BD, (req, res) => {
    const format = req.query.format === 'notion' ? 'notion' : 'obsidian';
    const zip = docs.exportZip(req.user.id, brain.snapshot(req.user), format);
    log(req, { kind: 'brain', action: 'exported the Brain', what: format === 'notion' ? 'Notion-ready Markdown' : 'Obsidian vault' });
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="127-brain-${format}-${new Date().toISOString().slice(0, 10)}.zip"`);
    res.send(zip);
  });

  r.post('/app/hq/brain/forget', ...BD, wrap(async (req, res) => {
    await docs.forget(req.user.id);
    log(req, { kind: 'brain', action: 'deleted everything in the Brain', what: 'Docs, house rules, decisions and numbers' });
    flash(req, 'info', 'Deleted. Your docs, house rules, decisions and logged numbers are gone. Your business profile above stays.');
    res.redirect('/app/hq/brain');
  }));

  // ---------- Activity log ----------
  r.get('/app/hq/activity', ...AC, (req, res) => {
    const kind = activity.KINDS[req.query.kind] ? req.query.kind : '';
    const rows = activity.list(req.user.id, { kind, limit: 300 }).map(activity.view);
    page(res, 'activity', 'Activity', { rows, kind, kinds: activity.KINDS, keepDays: activity.KEEP_DAYS });
  });

  r.get('/app/hq/activity.csv', ...AC, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="127-activity-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(activity.csv(req.user.id));
  });
}

// What the Brain page adds while BRAIN_DOCS is on.
function brainLocals(user, q) {
  if (!flags.on('BRAIN_DOCS', user)) return { bd: null };
  const query = String(q || '').slice(0, 200);
  return {
    bd: {
      docs: docs.list(user.id).map(docs.view),
      rules: docs.rules(user.id),
      decisions: docs.decisions(user.id).slice(0, 50),
      numbers: docs.numbers(user.id),
      counts: docs.counts(user.id),
      q: query,
      hits: query ? docs.search(user.id, query, { limit: 8 }) : null,
    },
  };
}

module.exports = { mount, brainLocals };
