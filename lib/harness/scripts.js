// AI scripts (HQ_SCRIPTS): how to run a whole job with an AI in one or two rounds. Each script is
// the order of asks, with the words for each one: its own text, a prompt from the library
// (content/prompts) or one of the Briefs (lib/harness/briefs.js). The member fills the script's
// few blanks once and every step comes back filled. Code only, no credits, nothing kept.
// Content: content/briefs/scripts.json, built from v2/briefs/scripts/scripts.js.

const fs = require('fs');
const path = require('path');
const ledger = require('./ledger');
const prompts = require('./prompts');
const briefs = require('./briefs');

const FILE = path.join(__dirname, '..', '..', 'content', 'briefs', 'scripts.json');
const VAR = /\{\{([a-z0-9_]+)\}\}/g;
let cache = null;

function load() {
  if (cache) return cache;
  try {
    const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = { method: m.method || [], scripts: m.scripts || [], byId: new Map((m.scripts || []).map((s) => [s.id, s])) };
  } catch {
    cache = { method: [], scripts: [], byId: new Map() };
  }
  return cache;
}

const RANK = { free: 0, builder: 1, circle: 2 };
const allowed = (s, user) => (RANK[ledger.tierOf(user)] || 0) >= (RANK[s.tier] || 0);
const get = (id) => load().byId.get(String(id || '')) || null;
const list = (user) => load().scripts.map((s) => ({ id: s.id, title: s.title, when: s.when, tier: s.tier, steps: s.steps.length, locked: !allowed(s, user) }));

// The script's own blanks, then any library prompt blanks it shares a key with.
function fill(text, s, values) {
  const vars = new Map((s.variables || []).map((v) => [v.key, v]));
  return String(text || '')
    .replace(VAR, (m, k) => {
      const v = String(values[k] == null ? '' : values[k]).trim();
      if (v) return v.slice(0, 4000);
      return vars.get(k) && vars.get(k).optional ? '(none)' : `[${(vars.get(k) && vars.get(k).label) || k}]`;
    })
    .trim();
}

// values: { key: text } -> each step with what to show: text (own words or the library prompt,
// filled), or a brief to open. A library prompt's other blanks stay as [label] for the member.
function steps(s, values = {}) {
  return s.steps.map((st, i) => {
    const out = { n: i + 1, title: st.title, why: st.why };
    if (st.brief) {
      const k = briefs.get(st.brief);
      return { ...out, brief: st.brief, briefTitle: k ? k.title : st.brief };
    }
    if (st.uses) {
      const p = prompts.get(st.uses);
      const base = p ? prompts.fill(p, values) : '';
      return { ...out, uses: st.uses, promptTitle: p ? p.title : st.uses, text: [base, st.add ? fill(st.add, s, values) : ''].filter(Boolean).join('\n\n') };
    }
    return { ...out, text: fill(st.say, s, values) };
  });
}

module.exports = { load, list, get, allowed, steps, _reset: () => (cache = null) };
