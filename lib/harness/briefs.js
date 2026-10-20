// Briefs (HQ_BRIEFS): one guided form per kind of creative job (website, hero or animation, ad,
// a round of changes). Code, not AI, turns the answers into one build-ready brief: the job, the
// look, the motion, a Never list, the house rules and a check-your-work list the AI runs on its own
// screenshots before it shows anything. No credits, nothing kept. The point is fewer rounds: the
// lessons that took rounds of feedback (no staged glow, form don't fade, come alive, poster first)
// are chips and defaults here, so they're in the first ask. Content: content/briefs/briefs.json.

const fs = require('fs');
const path = require('path');
const ledger = require('./ledger');

const FILE = path.join(__dirname, '..', '..', 'content', 'briefs', 'briefs.json');
const MAX = 4000;
let cache = null;

function load() {
  if (cache) return cache;
  try {
    const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = { ...m, byId: new Map((m.kinds || []).map((k) => [k.id, k])) };
  } catch {
    cache = { shared: { opening: '', rules: [], review: [], revisions: '' }, chips: {}, kinds: [], byId: new Map() };
  }
  return cache;
}

const RANK = { free: 0, builder: 1, circle: 2 };
const allowed = (k, user) => (RANK[ledger.tierOf(user)] || 0) >= (RANK[k.tier] || 0);
const get = (id) => load().byId.get(String(id || '')) || null;
const fields = (k) => k.sections.flatMap((s) => s.fields);
const options = (f) => (f.chips && load().chips[f.chips]) || [];

function list(user) {
  return load().kinds.map((k) => ({ id: k.id, title: k.title, when: k.when, tier: k.tier, locked: !allowed(k, user) }));
}

// The chips a field starts with: its default, or (Never) the options marked on.
function preset(f) {
  if (!f.chips) return f.default || '';
  if (Array.isArray(f.default)) return f.default;
  return options(f).filter((o) => o.on).map((o) => o.id);
}

// Raw form or API values to clean answers: text trimmed and capped, chips only known ids (one for
// pick-one fields). A chip field left out entirely stays undefined, so compile uses its preset.
function clean(k, raw = {}) {
  const out = {};
  for (const f of fields(k)) {
    const v = raw[f.key];
    if (v === undefined) continue;
    if (f.chips) {
      const known = new Set(options(f).map((o) => o.id));
      const ids = [...new Set((Array.isArray(v) ? v : [v]).map(String).filter((id) => known.has(id)))];
      out[f.key] = f.one ? ids.slice(0, 1) : ids;
    } else {
      out[f.key] = String(v).replace(/\r\n?/g, '\n').trim().slice(0, MAX);
    }
  }
  return out;
}

const indent = (s) => s.split('\n').map((l) => `  ${l}`).join('\n');
const filled = (f, a) => (f.chips ? Array.isArray(a[f.key]) && a[f.key].length > 0 : !!a[f.key]);

// answers -> { text, checks, missing, helps, ready, score }
function compile(k, raw = {}) {
  const L = load();
  const a = clean(k, raw);
  const missing = [];
  const helps = [];
  const never = [];
  const lines = [k.heading || k.title.toUpperCase(), k.opening || L.shared.opening, ''];
  for (const s of k.sections) {
    const isNever = s.fields.some((f) => f.chips === 'avoid');
    const body = [];
    for (const f of s.fields) {
      const has = filled(f, a);
      if (!has && f.need) missing.push(f.label);
      if (!has && f.want) helps.push(f.label);
      if (f.chips) {
        // Empty pick-one or a field with a default falls back to it; Never can be cleared on purpose.
        let ids = a[f.key];
        if (ids === undefined || (!ids.length && f.chips !== 'avoid')) ids = preset(f);
        const says = options(f).filter((o) => ids.includes(o.id)).map((o) => o.says);
        (isNever ? never : body).push(...says.map((x) => `- ${x}`));
      } else if (has) {
        const v = a[f.key];
        if (isNever) never.push(...v.split('\n').filter(Boolean).map((x) => `- ${x.replace(/^[-*]\s*/, '')}`));
        else if (f.rows) body.push(...rows(v).map(row));
        else body.push(v.includes('\n') || v.length > 120 ? `- ${f.lead || f.label}:\n${indent(v)}` : `- ${f.lead || f.label}: ${v}`);
      } else if (f.need) {
        body.push(`- ${f.label}: [ASK]`);
      } else if (f.default) {
        body.push(`- ${f.label}: ${f.default} (default)`);
      }
    }
    if (isNever) continue;
    if (body.length) lines.push(s.title.toUpperCase(), ...body, '');
  }
  if (never.length) lines.push('NEVER', ...never, '');
  if (k.id !== 'changes') lines.push('ALWAYS', ...L.shared.rules.map((r) => `- ${r}`), '');

  const fill = (t) => t.replace(/\{([a-z_]+)\}/g, (m, key) => (typeof a[key] === 'string' && a[key] ? a[key].split('\n')[0] : `[${key}]`));
  // The five premium tests (v2/design/premium-pass.md) close every site and hero brief's checklist.
  const checks = [...(k.checks || []).map(fill), ...(k.premium ? L.shared.premium || [] : [])];
  if (k.id === 'changes' && a.changes) checks.push(...rows(a.changes).map((r) => (r.where ? `${r.where}: ${r.want || r.wrong}` : r.want)));
  if (never.length) checks.push('Nothing on the NEVER list shows in any screenshot or frame.');
  lines.push('CHECK YOUR WORK', ...L.shared.review, 'Checklist:', ...checks.map((c) => `[ ] ${c}`), '', L.shared.revisions);

  // The motion settings block a site design reads (intro, alive, scroll moment), for the site pack.
  const pick = (key) => {
    const f = fields(k).find((x) => x.key === key);
    if (!f) return undefined;
    if (!f.chips) return a[key] || undefined;
    return a[key] && a[key].length ? a[key] : preset(f);
  };
  const motion = { intro: pick('intro') || pick('forms'), alive: pick('alive'), scroll: pick('scroll') || pick('exit'), pace: (pick('pace') || [])[0], look: (pick('look') || [])[0] };

  const all = fields(k).filter((f) => f.need || f.want);
  const score = all.length ? Math.round((100 * all.filter((f) => filled(f, a)).length) / all.length) : 100;
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), checks, missing, helps, ready: !missing.length, score, answers: a, motion };
}

// "where | what's wrong | what you want" lines; a line with no bars is the whole ask.
function rows(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l) => {
    const [where, wrong, want] = l.split('|').map((x) => (x || '').trim());
    return want !== undefined || wrong ? { where: where || 'Anywhere', wrong: wrong || '', want: want || '' } : { where: '', wrong: '', want: where };
  });
}
const row = (r) => (r.where ? `- ${r.where}: ${[r.wrong && `${r.wrong.replace(/\.$/, '')}.`, r.want && `Instead: ${r.want}`].filter(Boolean).join(' ')}` : `- ${r.want.charAt(0).toUpperCase()}${r.want.slice(1)}`);

module.exports = { load, list, get, allowed, fields, options, preset, clean, compile, rows, _reset: () => (cache = null) };
