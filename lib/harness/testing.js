// For pack tests: a ctx with no database, no network unless you pass fetch, and no keys.
//   const { makeCtx } = require('<path to>/lib/harness/testing');
//   const ctx = makeCtx({ sample: true, ai: async ({ task, schema }) => ({ data: {...} }) });
//   const out = await tool.run(input, ctx);
//   ctx.logs, ctx.saved, ctx.leadsAdded, ctx.spent and ctx.remembered show what the tool did.
// Pass `ai: 'demo'` for the harness's demo answers (a valid example for any schema), `leads: [...]`
// for a Pipeline the tool can read, and `assets: { id: { name, type, data } }` for Library files
// (ctx.asset(id)); files the tool saved can be read back with ctx.asset too.

const os = require('os');
const fs = require('fs');
const path = require('path');
const schema = require('./schema');

function makeCtx(opts = {}) {
  const logs = [];
  const saved = [];
  const leadsAdded = [];
  const spent = [];
  const remembered = {};
  const pipeline = (opts.leads || []).map((l, i) => ({ id: `l${i + 1}`, stage: 'found', pack: opts.pack || 'test', ...l }));
  const cache = new Map();
  const dirs = [];
  let time = opts.now || Date.parse('2026-11-02T15:00:00Z');
  const ai =
    opts.ai === 'demo' || !opts.ai
      ? async ({ schema: s, prompt }) => (s ? { data: schema.example(s), sample: true } : { text: `Sample answer to: ${String(prompt || '').slice(0, 80)}`, sample: true })
      : opts.ai;
  const ctx = {
    member: { id: 'm1', firstName: 'Sam', tier: 'builder', timezone: 'America/Chicago', ...(opts.member || {}) },
    inputs: opts.inputs || {},
    brain: opts.brain || { business: { name: 'Sam Edits', what: 'Short-form video editing', city: 'Des Moines', region: 'IA', country: 'US' }, voice: {}, links: {}, goal: {}, numbers: [], packs: {} },
    sample: opts.sample !== undefined ? !!opts.sample : true,
    index: opts.index,
    ai: async (req) => {
      if (!req || !req.task) throw new Error('ctx.ai needs a task (classify, extract, score, write, vision, plan or deep).');
      const out = await ai(req);
      if (req.schema && out && out.data !== undefined) {
        const v = schema.validate(req.schema, out.data, { clip: true });
        if (!v.ok) throw new Error(`Your fake ai returned data that doesn't match the schema: ${v.text}`);
        return { ...out, data: v.value };
      }
      return out;
    },
    fetch:
      opts.fetch ||
      (async (url) => {
        throw new Error(`No network in tests (tried ${url}). Pass makeCtx({ fetch }) to fake it.`);
      }),
    secret: (name) => (opts.secrets && opts.secrets[name]) || null,
    spend: async (usd, what) => {
      spent.push({ usd, what });
    },
    save: async (name, data, o = {}) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
      const a = { id: `a${saved.length + 1}`, url: `/app/hq/files/a${saved.length + 1}`, name, type: o.type || 'application/octet-stream', bytes: buf.length };
      saved.push({ ...a, data: buf });
      return a;
    },
    tmpdir: () => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), '127-pack-test-'));
      dirs.push(d);
      return d;
    },
    leads: {
      upsert: async (lead) => {
        leadsAdded.push(lead);
        let l = pipeline.find((x) => x.key === lead.key);
        if (!l) {
          l = { id: `l${pipeline.length + 1}`, stage: 'found', pack: opts.pack || 'test' };
          pipeline.push(l);
        }
        Object.assign(l, lead, { id: l.id });
        return { ...l };
      },
      // Like the real one: this pack's leads, or { all: true } for the whole Pipeline.
      list: async ({ stage, limit, all } = {}) =>
        pipeline.filter((l) => (all || l.pack === (opts.pack || 'test')) && (!stage || l.stage === stage)).slice(0, Number(limit) || 500).map((l) => ({ ...l })),
      get: async (id) => {
        const l = pipeline.find((x) => x.id === String(id));
        return l ? { ...l } : null;
      },
      // Fills in messages, facts, notes and the like on any lead, like the real one.
      update: async (id, patch = {}) => {
        const l = pipeline.find((x) => x.id === String(id));
        if (!l) return null;
        const { msg, ...rest } = patch;
        Object.assign(l, rest);
        if (msg) l.msg = { ...(l.msg || {}), ...msg };
        return { ...l };
      },
    },
    asset: async (id) => {
      const a = (opts.assets || {})[id] || saved.find((x) => x.id === id);
      if (!a) throw new Error("That file isn't in your Library anymore.");
      const buf = Buffer.isBuffer(a.data) ? a.data : Buffer.from(String(a.data || ''));
      const file = path.join(ctx.tmpdir(), a.name);
      fs.writeFileSync(file, buf);
      return { id, name: a.name, type: a.type, bytes: buf.length, path: file };
    },
    remember: async (key, value) => {
      remembered[key] = value;
    },
    cache: {
      get: async (key) => (cache.has(key) ? cache.get(key) : null),
      set: async (key, value) => {
        cache.set(key, value);
      },
    },
    log: (text) => {
      logs.push(String(text));
      if (opts.verbose) console.log(`  ${text}`);
    },
    progress: () => {},
    signal: opts.signal || new AbortController().signal,
    now: () => time,
    // test helpers
    logs,
    saved,
    leadsAdded,
    spent,
    remembered,
    setNow: (ms) => {
      time = ms;
    },
    cleanup: () => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })),
  };
  return ctx;
}

// Checks a tool's input and output against its schemas, the way the engine will.
async function runTool(tool, input, ctx) {
  const v = schema.validate(tool.input, input, { coerce: true, clip: true });
  if (!v.ok) throw new Error(`${tool.name} input: ${v.text}`);
  const out = await tool.run(v.value, ctx);
  const json = JSON.parse(JSON.stringify(out === undefined ? null : out));
  const check = schema.validate(tool.output, json);
  if (!check.ok) throw new Error(`${tool.name} output: ${check.text}`);
  if (JSON.stringify(json).length > 256 * 1024) throw new Error(`${tool.name} output is over 256 KB`);
  return json;
}

module.exports = { makeCtx, runTool };
