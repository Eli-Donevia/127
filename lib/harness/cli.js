#!/usr/bin/env node
// Run the harness from a terminal, with no server and no real database: for pack authors and for
// checking a change. Approvals are answered for you (the first options, every draft as written) and
// waits are skipped. Runs use sample data and sample AI answers (no keys, no cost) unless you pass
// --live, which calls the real services with the keys in your environment.
//
//   npm run harness -- list [--tier free|builder|circle]
//   npm run harness -- tools
//   npm run harness -- route [--tier builder]
//   npm run harness -- check <packs folder>
//   npm run harness -- run <workflow> [--input key=value ...] [--tier builder] [--packs <folder>]
//                         [--pick 0,2] [--live] [--out <folder>] [--json]
// A file input takes --input clip=@path/to/clip.mp4 (or @a.mp4,@b.mp4 for a list): the file goes
// into the test member's Library and the input gets its id, as when a member picks it in HQ.

const fs = require('fs');
const os = require('os');
const path = require('path');

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const opts = (name) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));

// Never the real database: a throwaway file store for this process.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '127-harness-cli-'));
process.env.DB_FILE = path.join(tmp, 'db.json');
process.env.BLOB_DIR = path.join(tmp, 'blobs');
delete process.env.DATABASE_URL;
if (!flag('live')) process.env.HARNESS_AI = 'off';
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const db = require('../db');
const harness = require('./index');
const { scrubKeys } = require('./text');
const { engine, packs, router, models, blocks, library } = harness;

const USAGE = `Usage:
  list [--tier free|builder|circle]     workflows and what they cost
  tools                                 every tool, its kind and credits
  route [--tier builder]                which model each kind of AI call uses
  check <folder>                        load the packs in a folder and list any problems (copy too)
  run <workflow> [--input k=v ...]      run a workflow end to end
      [--tier builder] [--packs <folder>] [--pick 0,2] [--live] [--out <folder>] [--json]`;

function loadPacks() {
  harness.init();
  for (const dir of opts('packs')) {
    const r = packs.loadDir(path.resolve(dir));
    if (r.refused.length) printRefused(r.refused);
  }
}

function printRefused(refused) {
  for (const r of refused) {
    console.log(`\nRefused ${r.id || r.source}:`);
    for (const p of r.problems) console.log(`  - ${p}`);
  }
}

function inputsFrom() {
  const out = {};
  for (const pair of opts('input')) {
    const i = pair.indexOf('=');
    if (i < 1) throw new Error(`--input wants key=value, got "${pair}"`);
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

async function run(id) {
  const wf = packs.workflow(id);
  if (!wf) throw new Error(`No workflow "${id}". Try: list`);
  const tier = opt('tier', wf.tier === 'free' ? 'free' : wf.tier);
  const user = await db.save('users', { id: 'cli-member', email: 'cli@127.test', name: 'Sam Rivera', tier, emailVerified: true, answers: { model: 'service' } });
  let now = Date.now();
  engine._setDeps({ now: () => now });
  const pick = opt('pick', '');
  const inputs = inputsFrom();
  for (const [k, v] of Object.entries(inputs)) {
    if (!String(v).startsWith('@')) continue;
    const ids = [];
    for (const one of String(v).split(',')) {
      const file = one.trim().replace(/^@/, '');
      const saved = await library.save({ id: user.id, tier }, path.basename(file), fs.readFileSync(file));
      ids.push(saved.id);
    }
    inputs[k] = ids.join(',');
  }
  let run = await engine.start(user, id, inputs, { source: 'cli', sample: !flag('live') });
  const started = Date.now();
  for (let guard = 0; guard < 200; guard++) {
    await engine.idle();
    run = engine.get(user, run.id);
    if (['done', 'failed', 'stopped'].includes(run.status)) break;
    const v = engine.view(run);
    if (run.status === 'waiting' && v.waitingOn) {
      const ask = v.waitingOn.ask;
      let chosen = [];
      if (ask.options) {
        chosen = pick ? pick.split(',').map((s) => s.trim()) : ask.options.slice(0, ask.max || 3).map((o) => o.key);
        console.log(`\n? ${ask.title}\n  ${ask.options.map((o) => `[${o.key}] ${o.label}`).join('\n  ')}\n  -> picked ${chosen.join(', ')}`);
      } else console.log(`\n? ${ask.title}: approved ${ask.items ? ask.items.length : ''} as written`);
      await engine.answer(user, run.id, v.waitingOn.id, { approved: true, chosen });
      continue;
    }
    if (run.status === 'sleeping') {
      console.log(`\n(skipping a wait until ${new Date(run.wakeAt).toISOString()})`);
      now = run.wakeAt + 1000;
      await engine.tick();
      continue;
    }
    await engine.tick();
  }
  const v = engine.view(run);
  if (flag('json')) {
    console.log(JSON.stringify(v, null, 2));
    return v;
  }
  console.log(`\n${v.title}: ${v.status}${v.error ? ` (${v.error})` : ''}${v.sample ? ', with sample data' : ''}`);
  for (const s of v.steps) {
    const extra = [s.progress && s.progress.total ? `${s.progress.done}/${s.progress.total}` : '', s.models ? Object.entries(s.models).map(([m, n]) => `${m} x${n}`).join(' ') : '', s.error || ''].filter(Boolean).join(', ');
    console.log(`  ${s.status === 'done' ? '✓' : s.status === 'failed' ? '✗' : '·'} ${s.title}${extra ? `  (${extra})` : ''}`);
  }
  const shown = v.result.length ? v.result : v.steps.flatMap((s) => s.blocks);
  if (shown.length) console.log(`\n${blocks.toText(shown, { base: '' })}`);
  const files = library.list(user.id, { runId: run.id });
  const out = opt('out', '');
  if (files.length) {
    console.log(`\nFiles (${files.length}):`);
    for (const f of files) {
      let where = '';
      if (out) {
        fs.mkdirSync(out, { recursive: true });
        const got = await library.read(user.id, f.id);
        where = path.join(out, f.name);
        fs.writeFileSync(where, got.buf);
      }
      console.log(`  ${f.name}  ${Math.round(f.bytes / 1024)} KB${where ? `  -> ${where}` : ''}`);
    }
    if (!out) console.log('  (add --out <folder> to keep them)');
  }
  console.log(`\nCredits: ${run.credits.used} (estimate ${run.credits.estimate}). Our cost: $${(run.usd || 0).toFixed(4)}. ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  return v;
}

async function main() {
  await db.init();
  if (!cmd || cmd === 'help' || flag('help')) return console.log(USAGE);
  if (cmd === 'check') {
    if (!argv[1]) throw new Error('check needs a folder');
    const dir = path.resolve(argv[1]);
    // Any folder loads on top of the site's own packs; the site's own folder is what init just loaded.
    const own = harness.init();
    const r = dir === path.resolve(__dirname, '..', 'packs') ? own : packs.loadDir(dir);
    console.log(`Loaded: ${r.loaded.join(', ') || 'none'}`);
    if (r.refused.length) printRefused(r.refused);
    // 127's own copy in each pack (titles, promises), against the site's copy check when it's there.
    let copy = 0;
    for (const id of r.loaded) {
      const found = packs.copyFindings(packs.pack(id));
      if (!found.length) continue;
      copy += found.length;
      console.log(`\nCopy to fix in ${id}:`);
      for (const f of found) console.log(`  - ${f}`);
    }
    if (!r.refused.length && !copy) console.log('No problems.');
    process.exitCode = r.refused.length || copy ? 1 : 0;
    return;
  }
  loadPacks();
  if (cmd === 'list') {
    const tier = opt('tier', 'circle');
    for (const wf of packs.workflows({ tier })) console.log(`${wf.locked ? '🔒' : '  '} ${wf.id.padEnd(36)} ${String(engine.estimate(wf, {})).padStart(4)} cr  ${wf.minutes} min  ${wf.title}`);
    return;
  }
  if (cmd === 'tools') {
    for (const t of packs.tools()) console.log(`${t.name.padEnd(40)} ${t.kind.padEnd(4)} ${t.risk.padEnd(5)} ${String(t.credits).padStart(3)} cr${(t.needs || []).length ? `  needs ${t.needs.join(', ')}` : ''}`);
    return;
  }
  if (cmd === 'route') {
    const tier = opt('tier', 'builder');
    for (const r of router.explain(tier)) console.log(`${r.task.padEnd(9)} ${models.label(r.model).padEnd(11)} ${r.effort.padEnd(7)} ${r.why}`);
    return;
  }
  if (cmd === 'run') {
    if (!argv[1] || argv[1].startsWith('--')) throw new Error('run needs a workflow id');
    const v = await run(argv[1]);
    process.exitCode = v.status === 'done' ? 0 : 1;
    return;
  }
  console.log(USAGE);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(scrubKeys(err.message || err));
  process.exitCode = 1;
});
