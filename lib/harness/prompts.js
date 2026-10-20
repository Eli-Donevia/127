// The prompt library (content/prompts, from the Prompt library thread's manifest v1; the internal
// `origin` field is left out when it's copied in): 61 prompts in 10 groups, each a form built from
// its variables. HQ_PROMPTS shows them in HQ; Ask 127 uses harness.txt as its instructions, with the
// member's business brain in the slot at the end.

const fs = require('fs');
const path = require('path');
const ledger = require('./ledger');

const DIR = path.join(__dirname, '..', '..', 'content', 'prompts');
const VAR = /\{\{([a-z0-9_]+)\}\}/g;
let cache = null;

function load() {
  if (cache) return cache;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
    const harness = fs.readFileSync(path.join(DIR, 'harness.txt'), 'utf8');
    // Never show where a prompt came from, even if a later copy carries it.
    // A group's note on advice (the finance group's "not tax, legal or investment advice") shows on each of its forms (L76 H9).
    const notes = Object.fromEntries((m.groups || []).map((g) => [g.id, String(g.intro || '').split(/(?<=\.)\s+/).filter((x) => /\badvice\b/i.test(x)).join(' ')]));
    const prompts = (m.prompts || []).map(({ origin, ...p }) => ({ ...p, note: notes[p.group] || '' }));
    cache = { groups: m.groups || [], prompts, byId: new Map(prompts.map((p) => [p.id, p])), harness };
  } catch {
    cache = { groups: [], prompts: [], byId: new Map(), harness: '' };
  }
  return cache;
}

const RANK = { free: 0, builder: 1, circle: 2 };
function allowed(p, user) {
  return (RANK[ledger.tierOf(user)] || 0) >= (RANK[p.tier] || 0);
}

function get(id) {
  return load().byId.get(String(id || '')) || null;
}

function groups(user) {
  const L = load();
  return L.groups.map((g) => ({ ...g, prompts: g.prompts.map((id) => L.byId.get(id)).filter(Boolean).map((p) => ({ id: p.id, title: p.title, when: p.when, tier: p.tier, locked: !allowed(p, user) })) }));
}

// values: { key: text }. Missing optional ones are dropped with their line; missing required ones stay as [key].
function fill(p, values = {}) {
  const vars = new Map((p.variables || []).map((v) => [v.key, v]));
  return p.prompt
    .replace(VAR, (m, k) => {
      const v = String(values[k] == null ? '' : values[k]).trim();
      if (v) return v.slice(0, 4000);
      return vars.get(k) && vars.get(k).optional ? '' : `[${(vars.get(k) && vars.get(k).label) || k}]`;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// harness.txt with the member's business brain in its slot.
function system(brainText) {
  const h = load().harness;
  if (!h) return '';
  const slot = /\[Paste the founder's business brain here[^\]]*\]/;
  const body = brainText && brainText.trim() ? brainText.trim() : 'Not filled in yet. Ask for what you need, one question at a time.';
  return slot.test(h) ? h.replace(slot, body) : `${h}\n\n${body}`;
}

// The short command a prompt answers to in Ask 127: /offer.builder
const command = (p) => `/${p.id}`;

module.exports = { load, get, groups, fill, system, allowed, command, _reset: () => (cache = null) };
