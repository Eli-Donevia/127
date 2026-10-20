// HQ v2's workspace pages, each behind its own flag (lib/harness/flags.js): Brain docs and house
// rules (BRAIN_DOCS), the Activity log (HQ_ACTIVITY). Mounted by routes.js with its helpers.
// A page whose flag is off for the member falls through to a 404.

const express = require('express');
const harness = require('./index');
const { scrubKeys } = require('./text');

const { brain, docs, activity, flags } = harness;
const skills = require('./skills');
const agent = require('./agent');
const prompts = require('./prompts');
const briefs = require('./briefs');
const scripts = require('./scripts');
const team = require('./team');
const { makeZip } = require('./zipfile');
const MB = 1024 * 1024;

function mount(r, { A, wrap, flash, track, allow, page }) {
  const flag = (name) => (req, res, next) => (flags.on(name, req.user) ? next() : next('router'));
  const BD = [...A, flag('BRAIN_DOCS')];
  const AC = [...A, flag('HQ_ACTIVITY')];
  const SK = [...A, flag('HQ_SKILLS')];
  const TM = [...A, flag('HQ_TEAM')];
  const MB_ = [...A, flag('HQ_MCP_BRAIN')];
  const AG = [...A, flag('HQ_AGENT')];
  const PR = [...A, flag('HQ_PROMPTS')];
  const BR = [...A, flag('HQ_SCRIPTS')];
  const base = () => String(process.env.BASE_URL || '').replace(/\/$/, '');
  const failTo = (req, res, err, back) => {
    if (!err || !err.status) throw err;
    flash(req, 'error', err.message);
    res.redirect(back);
  };
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


  // ---------- Skills ----------
  r.get('/app/hq/skills', ...SK, (req, res) => {
    const list = skills.list(req.user);
    page(res, 'skills', 'Skills', { list, teamNames: Object.fromEntries(team.list(req.user).map((t) => [t.id, t.name])), mcp: flags.on('HQ_MCP_BRAIN', req.user) });
  });

  r.post('/app/hq/skills/:id/on', ...SK, wrap(async (req, res) => {
    try {
      const sch = await skills.turnOn(req.user, req.params.id);
      log(req, { kind: 'run', action: 'turned on a skill', what: `${sch.title}, ${sch.label}` });
      flash(req, 'win', `${sch.title} is on: ${sch.label.toLowerCase()}. Each run uses its usual credits, and anything it drafts waits for your OK.`);
    } catch (err) {
      return failTo(req, res, err, '/app/hq/skills');
    }
    res.redirect('/app/hq/skills');
  }));

  r.post('/app/hq/skills/:id/off', ...SK, wrap(async (req, res) => {
    const s = skills.get(req.params.id);
    if (await skills.turnOff(req.user, req.params.id)) {
      log(req, { kind: 'run', action: 'turned off a skill', what: s ? s.name : req.params.id });
      flash(req, 'info', `${s ? s.name : 'That skill'} is off.`);
    }
    res.redirect('/app/hq/skills');
  }));

  r.post('/app/hq/skills/:id/run', ...SK, (req, res, next) => (allow(req, res, 'skill-run', 30, 60 * 60 * 1000) ? next() : undefined), wrap(async (req, res) => {
    try {
      const run = await skills.runNow(req.user, req.params.id, { source: 'hq' });
      res.redirect(`/app/hq/runs/${run.id}`);
    } catch (err) {
      failTo(req, res, err, '/app/hq/skills');
    }
  }));

  r.get('/app/hq/skills/:id/skill.zip', ...SK, (req, res, next) => {
    const s = skills.get(req.params.id);
    if (!s) return next('router');
    const b = skills.bundle(s, base());
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${b.name}"`);
    res.send(b.zip);
  });

  // ---------- AI team ----------
  r.get('/app/hq/team', ...TM, (req, res) => {
    const mine = team.list(req.user).map((t) => team.view(req.user, t));
    const hired = new Set(mine.map((t) => t.role));
    const gallery = team.roles().filter((x) => !hired.has(x.id)).map((x) => { const ok = team.ready(x, req.user); return { ...x, ready: ok.workflows.length + ok.skills.length > 0, can: ok.workflows.length, skills: ok.skills.map((s) => s.name), uses: team.uses(x) }; });
    page(res, 'team', 'AI team', { mine, gallery });
  });

  r.post('/app/hq/team/hire/:role', ...TM, wrap(async (req, res) => {
    try {
      const t = await team.hire(req.user, req.params.role, { budget: req.body.budget });
      activity.note(req.user, { who: 'you', kind: 'team', action: 'added', what: `${t.name}, ${t.budget} credits a month` });
      flash(req, 'win', `${t.name} is on your team. Its skills are on, it stays inside ${t.budget} credits a month, and anything it drafts waits for your OK.`);
      res.redirect(`/app/hq/team/${t.id}`);
    } catch (err) {
      failTo(req, res, err, '/app/hq/team');
    }
  }));

  r.get('/app/hq/team/:id', ...TM, (req, res, next) => {
    const t = team.get(req.user, req.params.id);
    if (!t) return next('router');
    page(res, 'team-role', t.name, { t: team.view(req.user, t), acts: activity.list(req.user.id, { who: t.name, limit: 30 }).map(activity.view) });
  });

  r.post('/app/hq/team/:id/pause', ...TM, wrap(async (req, res) => {
    try {
      const t = await team.setStatus(req.user, req.params.id, req.body.resume ? 'active' : 'paused');
      activity.note(req.user, { who: 'you', kind: 'team', action: t.status === 'paused' ? 'paused' : 'resumed', what: t.name });
      flash(req, 'info', t.status === 'paused' ? `${t.name} is paused. Its skills skip their turns until you resume it.` : `${t.name} is back to work.`);
    } catch (err) {
      return failTo(req, res, err, '/app/hq/team');
    }
    res.redirect(`/app/hq/team/${encodeURIComponent(req.params.id)}`);
  }));

  r.post('/app/hq/team/:id/budget', ...TM, wrap(async (req, res) => {
    try {
      const t = await team.setBudget(req.user, req.params.id, req.body.budget);
      activity.note(req.user, { who: 'you', kind: 'team', action: 'set a budget', what: `${t.name}, ${t.budget} credits a month` });
      flash(req, 'win', `Saved. ${t.name} stays inside ${t.budget} credits a month.`);
    } catch (err) {
      flash(req, 'error', err.message);
    }
    res.redirect(`/app/hq/team/${encodeURIComponent(req.params.id)}`);
  }));

  r.post('/app/hq/team/:id/start', ...TM, (req, res, next) => (allow(req, res, 'team-run', 30, 60 * 60 * 1000) ? next() : undefined), wrap(async (req, res) => {
    const t = team.get(req.user, req.params.id);
    if (!t) return res.redirect('/app/hq/team');
    const wf = harness.packs.workflow(String(req.body.workflow || ''));
    // One that needs answers opens its form; the role's run starts from there in a later version.
    if (wf && ((wf.inputs && wf.inputs.required) || []).length) return res.redirect(`/app/hq/w/${wf.id}`);
    try {
      const run = await team.start(req.user, t.id, String(req.body.workflow || ''), {});
      res.redirect(`/app/hq/runs/${run.id}`);
    } catch (err) {
      failTo(req, res, err, `/app/hq/team/${t.id}`);
    }
  }));

  r.post('/app/hq/team/:id/let-go', ...TM, wrap(async (req, res) => {
    const t = await team.letGo(req.user, req.params.id);
    if (t) {
      activity.note(req.user, { who: 'you', kind: 'team', action: 'removed', what: t.name });
      flash(req, 'info', `${t.name} is off your team and its skills are off. What it made stays on Runs.`);
    }
    res.redirect('/app/hq/team');
  }));

  // ---------- Make Claude your admin ----------
  r.get('/app/hq/admin-setup', ...MB_, (req, res) => {
    page(res, 'admin-setup', 'Make Claude your admin', { brainOn: flags.on('BRAIN_DOCS', req.user), skillsOn: flags.on('HQ_SKILLS', req.user) });
  });

  r.get('/app/hq/admin-setup/skill.zip', ...MB_, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="127-admin.zip"');
    res.send(makeZip([{ name: '127-admin/SKILL.md', data: adminSkill(base()) }]));
  });


  // ---------- Ask 127 ----------
  r.get('/app/hq/ask', ...AG, (req, res) => {
    page(res, 'ask', 'Ask 127', { msgs: agent.messages(req.user), cost: agent.cost(), help: agent.HELP, draft: String(req.query.q || '').slice(0, 4000) });
  });

  r.post('/app/hq/ask', ...AG, (req, res, next) => (allow(req, res, 'hq-ask', 60, 60 * 60 * 1000) ? next() : undefined), wrap(async (req, res) => {
    const json = req.accepts(['html', 'json']) === 'json';
    try {
      const out = await agent.send(req.user, req.body.text);
      if (json) return res.json({ ok: true, cleared: !!out.cleared });
    } catch (err) {
      if (!err || !err.status) throw err;
      if (json) return res.status(err.status).json({ error: err.message });
      flash(req, 'error', err.message);
    }
    res.redirect('/app/hq/ask#end');
  }));

  r.post('/app/hq/ask/act/:id', ...AG, wrap(async (req, res) => {
    try {
      const a = await agent.act(req.user, req.params.id, req.body.ok === '1');
      if (a.status === 'open' && a.link) return res.redirect(a.link);
      if (a.error) flash(req, 'error', a.error);
      else if (a.status === 'done' && a.runId) return res.redirect(a.link);
    } catch (err) {
      if (!err || !err.status) throw err;
      flash(req, 'error', err.message);
    }
    res.redirect('/app/hq/ask#end');
  }));

  r.post('/app/hq/ask/clear', ...AG, wrap(async (req, res) => {
    await agent.clear(req.user);
    res.redirect('/app/hq/ask');
  }));

  // ---------- Prompts ----------
  r.get('/app/hq/prompts', ...PR, (req, res) => {
    page(res, 'prompts', 'Prompts', { groups: prompts.groups(req.user), agentOn: flags.on('HQ_AGENT', req.user) });
  });

  const promptPage = (req, res, next, values, filled) => {
    const p = prompts.get(req.params.id);
    if (!p) return next('router');
    page(res, 'prompt', p.title, { p, locked: !prompts.allowed(p, req.user), values, filled, agentOn: flags.on('HQ_AGENT', req.user), command: prompts.command(p) });
  };
  r.get('/app/hq/prompts/:id', ...PR, (req, res, next) => promptPage(req, res, next, {}, null));
  r.post('/app/hq/prompts/:id', ...PR, wrap(async (req, res, next) => {
    const p = prompts.get(req.params.id);
    if (!p) return next('router');
    if (!prompts.allowed(p, req.user)) return res.redirect(`/app/hq/prompts/${p.id}`);
    const values = Object.fromEntries((p.variables || []).map((v) => [v.key, String(req.body[`v_${v.key}`] || '').slice(0, 4000)]));
    const filled = prompts.fill(p, values);
    // "Send to Ask 127" sends it as one message (its usual credits); the chat shows the prompt's title.
    if (req.body.ask && flags.on('HQ_AGENT', req.user)) {
      if (!allow(req, res, 'hq-ask', 60, 60 * 60 * 1000)) return undefined;
      try {
        await agent.send(req.user, filled, { shown: `Prompt: ${p.title}` });
      } catch (err) {
        if (!err || !err.status) throw err;
        flash(req, 'error', err.message);
      }
      return res.redirect('/app/hq/ask#end');
    }
    promptPage(req, res, next, values, filled);
  }));

  // ---------- AI scripts ----------
  // The order of asks for a whole job, each step's words filled from a few blanks. Nothing is kept.
  r.get('/app/hq/scripts', ...BR, (req, res) => {
    page(res, 'scripts', 'AI scripts', { list: scripts.list(req.user), method: scripts.load().method });
  });
  const scriptPage = (req, res, next, values, filled) => {
    const s = scripts.get(req.params.id);
    if (!s) return next('router');
    page(res, 'script', s.title, { s, locked: !scripts.allowed(s, req.user), values, filled, steps: scripts.steps(s, values, req.user), agentOn: flags.on('HQ_AGENT', req.user) });
  };
  r.get('/app/hq/scripts/:id', ...BR, (req, res, next) => scriptPage(req, res, next, {}, false));
  r.post('/app/hq/scripts/:id', ...BR, wrap(async (req, res, next) => {
    const s = scripts.get(req.params.id);
    if (!s) return next('router');
    if (!scripts.allowed(s, req.user)) return res.redirect(`/app/hq/scripts/${s.id}`);
    const values = Object.fromEntries((s.variables || []).map((v) => [v.key, String(req.body[`v_${v.key}`] || '').slice(0, 4000)]));
    // "Send to Ask 127" sends one step's words as one message (its usual credits).
    const st = req.body.ask && scripts.steps(s, values, req.user).find((x) => String(x.n) === String(req.body.ask) && x.text);
    if (st && flags.on('HQ_AGENT', req.user)) {
      if (!allow(req, res, 'hq-ask', 60, 60 * 60 * 1000)) return undefined;
      try {
        await agent.send(req.user, st.text, { shown: `${s.title}, step ${st.n}: ${st.title}` });
      } catch (err) {
        if (!err || !err.status) throw err;
        flash(req, 'error', err.message);
      }
      return res.redirect('/app/hq/ask#end');
    }
    scriptPage(req, res, next, values, true);
  }));

  // ---------- Briefs ----------
  // A form per kind of creative job; code turns it into one build-ready brief. Nothing is kept.
  r.get('/app/hq/briefs', ...BR, (req, res) => {
    page(res, 'briefs', 'Briefs', { kinds: briefs.list(req.user) });
  });
  const briefPage = (req, res, next, answers, out) => {
    const k = briefs.get(req.params.id);
    if (!k) return next('router');
    page(res, 'brief', k.title, { k, B: briefs, locked: !briefs.allowed(k, req.user), answers, out, agentOn: flags.on('HQ_AGENT', req.user) });
  };
  r.get('/app/hq/briefs/:id', ...BR, (req, res, next) => briefPage(req, res, next, {}, null));
  r.post('/app/hq/briefs/:id', ...BR, wrap(async (req, res, next) => {
    const k = briefs.get(req.params.id);
    if (!k) return next('router');
    if (!briefs.allowed(k, req.user)) return res.redirect(`/app/hq/briefs/${k.id}`);
    // Chip fields always come back as a list (none ticked = []), so a cleared Never list stays cleared.
    const raw = Object.fromEntries(briefs.fields(k).map((f) => [f.key, f.chips ? [].concat(req.body[`v_${f.key}`] || []) : req.body[`v_${f.key}`] || '']));
    const out = briefs.compile(k, raw);
    // "Send to Ask 127" sends the brief as one message (its usual credits); the chat shows the brief's title.
    if (req.body.ask && flags.on('HQ_AGENT', req.user)) {
      if (!allow(req, res, 'hq-ask', 60, 60 * 60 * 1000)) return undefined;
      try {
        await agent.send(req.user, out.text, { shown: `Brief: ${k.title}` });
      } catch (err) {
        if (!err || !err.status) throw err;
        flash(req, 'error', err.message);
      }
      return res.redirect('/app/hq/ask#end');
    }
    briefPage(req, res, next, out.answers, out);
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

// The skill a member adds to their own Claude so it works as their admin through 127's AI link,
// with their own Gmail and Calendar connected inside Claude (127 never sees their email).
function adminSkill(base) {
  return `---
name: 127-admin
description: The member's business admin, working through their 127 HQ. Use when they ask for their morning rundown, to deal with email or the calendar for the business, to follow up with people, or to remember something about the business.
---

127 content for your own business, under 127's Terms (Section 11). Don't share or sell it.

# 127 admin

You are the member's admin for their business. You work through 127 (the "127" connector, their AI link) and through their own Gmail and Calendar connectors in Claude. If the 127 tools aren't there, send them to ${base}/app/hq/admin-setup.

## Morning rundown (when they say "morning", "rundown" or "what's on today")

1. 127: \`run_skill\` daily_numbers, then \`get_run\` until done. Give the numbers in two lines.
2. 127: \`list_inbox\`. Say what's waiting on them in 127, one line each.
3. Calendar: today's meetings. For a meeting with a client or lead, \`brain_search\` their name and give one line of context.
4. Gmail: threads from clients and leads since yesterday that need an answer. Draft each reply in their voice, following their house rules (\`brain_search\` "house rules"). Leave every draft unsent.
5. End with the three things that matter most today.

## Rules

- Never send an email, accept an invite or approve anything in 127 without the member's yes in this chat, for that one item.
- Before you state a fact about their business (prices, policies, offers), \`brain_search\` it and cite the doc.
- When they decide something, offer \`log_decision\`. When they share a fact worth keeping, offer \`add_note\`. When they give you a number they track, offer \`log_number\`.
- Keep clients' private details out of notes unless the member asks to save them.
- Short, plain answers. No markdown headings in replies.
`;
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

module.exports = { mount, brainLocals, adminSkill };
