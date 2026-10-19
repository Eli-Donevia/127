// Customers a pack booked on another pack's lead (warm found Sarah, cleaning books her). Contract
// v1.5 moves that lead to won on its own card, so the member keeps one row per person; the pack then
// has no won row of its own for her, so it keeps her lead id with ctx.remember and counts her on its
// first-clients ladder. Lead ids only, never a name (a Google business has none to keep, Legal L53).

const brain = require('./brain');

const KEY = 'booked';
const MAX = 150; // a remembered key holds 4 KB

function ids(ctx, packId) {
  const v = brain.packMemory(ctx, packId)[KEY];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [];
}

async function add(ctx, packId, leadId) {
  if (!leadId) return;
  const list = ids(ctx, packId).filter((x) => x !== leadId);
  list.push(String(leadId));
  await brain.remember(ctx, KEY, list.slice(-MAX));
}

// This pack's won leads: its own won rows, then the other packs' leads it booked that are still won
// (the member can move a card back from the Pipeline).
async function wonLeads(ctx, packId) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return [];
  const own = ((await ctx.leads.list({ stage: 'won', limit: 500 })) || []).filter((l) => l && l.stage === 'won');
  const have = new Set(own.map((l) => l.id));
  const more = [];
  if (typeof ctx.leads.get === 'function') {
    for (const id of ids(ctx, packId)) {
      if (have.has(id)) continue;
      const l = await ctx.leads.get(id).catch(() => null);
      if (l && l.stage === 'won') more.push(l);
    }
  }
  return [...own, ...more];
}

module.exports = { ids, add, wonLeads, KEY };
