// The member's Pipeline from the sales desk: quotes, invoices and proposals log the customer, and
// follow-ups read them back. The harness lists only this pack's own leads (ctx.leads.list filters by
// pack), so every sales tool logs the people it touches. Best effort: a Pipeline error never fails
// a run.

const { text } = require('../../_kit');

const STAGES = ['found', 'contacted', 'replied', 'call', 'won', 'lost'];

function keyFor(c = {}) {
  if (c.name) return `person:${text.slug(c.company ? `${c.name} ${c.company}` : c.name, 80)}`;
  if (c.email) return `email:${String(c.email).toLowerCase()}`;
  if (c.phone) return `phone:${String(c.phone).replace(/\D/g, '')}`;
  return '';
}

async function existing(ctx, key) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return null;
  try {
    const all = await ctx.leads.list({});
    return (all || []).find((l) => l && l.key === key) || null;
  } catch {
    return null;
  }
}

// Adds or updates one person. data is merged under data.sales so other fields survive.
async function log(ctx, c, { stage, source, note, data } = {}) {
  const key = keyFor(c);
  if (!key || !ctx || !ctx.leads || typeof ctx.leads.upsert !== 'function') return null;
  try {
    const prev = await existing(ctx, key);
    const prevData = (prev && prev.data && typeof prev.data === 'object' ? prev.data : {}) || {};
    const sales = { ...(prevData.sales || {}), ...(data || {}) };
    let merged = { ...prevData, sales };
    if (JSON.stringify(merged).length > 7500) merged = { sales: data || {} };
    const links = {};
    if (c.email) links.email = c.email;
    if (c.phone) links.phone = c.phone;
    if (c.website) links.website = c.website;
    return await ctx.leads.upsert({
      key,
      name: text.clip(c.name || c.email || c.phone, 120),
      company: c.company ? text.clip(c.company, 120) : undefined,
      stage: STAGES.includes(stage) ? stage : undefined,
      source: source ? text.clip(source, 60) : undefined,
      note: note ? text.clip(note, 1000) : undefined,
      links,
      data: merged,
    });
  } catch {
    return null;
  }
}

// The days since a lead last moved (from its history), or null.
function lastTouch(lead) {
  const h = Array.isArray(lead && lead.history) ? lead.history : [];
  const at = h.length ? h[h.length - 1].at : lead && (lead.updatedAt || lead.createdAt);
  const ms = Date.parse(at || '');
  return Number.isFinite(ms) ? ms : null;
}

module.exports = { STAGES, keyFor, log, existing, lastTouch };
