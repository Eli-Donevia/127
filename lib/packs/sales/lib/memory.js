// What the sales desk remembers for the member (brain.packs.sales, through ctx.remember):
//   settings  their payment link and instructions, tax rate, deposit, terms, contact line, color
//   counters  the last quote, invoice and proposal number per year (Q-2026-001, INV-2026-001, P-2026-001)
//   docs      the last few quotes and proposals (with line items, so an invoice can start from a quote)
//   invoices  open invoices, so payment reminders know who owes what
// Each key stays under the harness's 4 KB per key. Re-running the same document keeps its number.

const { brain, text } = require('../../_kit');

const PACK = 'sales';
const MAX_BYTES = 3800;
const PREFIX = { quote: 'Q', invoice: 'INV', proposal: 'P' };

function mem(ctx) {
  return brain.packMemory(ctx, PACK);
}

function settings(ctx) {
  const s = mem(ctx).settings;
  return s && typeof s === 'object' ? s : {};
}

const SETTING_KEYS = ['payLink', 'payNote', 'taxRate', 'deposit', 'terms', 'email', 'phone', 'website', 'address', 'color', 'currency', 'promise', 'name'];

// Saves the settings this run was given, so the member types them once. Returns what changed.
async function saveSettings(ctx, patch = {}) {
  const cur = settings(ctx);
  const next = { ...cur };
  const changed = [];
  for (const k of SETTING_KEYS) {
    const v = patch[k];
    if (v === undefined || v === null || v === '') continue;
    const val = typeof v === 'string' ? text.clip(v, k === 'terms' || k === 'payNote' ? 600 : 200) : v;
    if (JSON.stringify(cur[k]) !== JSON.stringify(val)) {
      next[k] = val;
      changed.push(k);
    }
  }
  if (changed.length) await brain.remember(ctx, 'settings', fit(next));
  return changed;
}

// Drops the longest free-text settings first if the whole thing is too big for one key.
function fit(obj) {
  const o = { ...obj };
  for (const k of ['terms', 'payNote', 'address']) {
    if (JSON.stringify(o).length <= MAX_BYTES) break;
    if (typeof o[k] === 'string') o[k] = text.clip(o[k], 200);
  }
  return o;
}

// Keeps the newest entries of a list that fit in one key.
function fitList(list) {
  const out = [...list];
  while (out.length > 1 && JSON.stringify(out).length > MAX_BYTES) out.pop();
  return out;
}

// A stable fingerprint of a document: same customer and same lines means the same document.
function fingerprint(kind, customerName, items, extra = '') {
  const lines = (items || []).map((i) => `${String(i.label).toLowerCase()}|${i.qty}|${i.price}`).join(';');
  return `${kind}:${text.hash(`${String(customerName || '').toLowerCase()}#${lines}#${extra}`).toString(36)}`;
}

// The number for a new document, or the same number when this exact document was made before.
// Returns { number, reused, counters } and remembers the new counter.
async function numberFor(ctx, kind, fp, { year, override } = {}) {
  const prefix = PREFIX[kind] || 'D';
  const m = mem(ctx);
  const docs = Array.isArray(m.docs) ? m.docs : [];
  const invoices = Array.isArray(m.invoices) ? m.invoices : [];
  if (override) return { number: text.clip(override, 30), reused: false };
  const same = [...docs, ...invoices].find((d) => d && d.fp === fp && d.kind === kind);
  if (same && same.number) return { number: same.number, reused: true };
  const counters = m.counters && typeof m.counters === 'object' ? { ...m.counters } : {};
  const key = `${prefix}-${year}`;
  const n = (Number(counters[key]) || 0) + 1;
  counters[key] = n;
  await brain.remember(ctx, 'counters', counters);
  return { number: `${prefix}-${year}-${String(n).padStart(3, '0')}`, reused: false };
}

// Remembers a quote or proposal (newest first), with compact line items for "invoice my last quote".
async function recordDoc(ctx, doc) {
  const m = mem(ctx);
  const docs = (Array.isArray(m.docs) ? m.docs : []).filter((d) => d && d.number !== doc.number);
  const entry = {
    kind: doc.kind,
    number: doc.number,
    fp: doc.fp,
    date: doc.date,
    customer: text.clip(doc.customer || '', 60),
    email: text.clip(doc.email || '', 80),
    phone: text.clip(doc.phone || '', 30),
    title: text.clip(doc.title || '', 80),
    totalCents: doc.totalCents,
    items: (doc.items || []).slice(0, 12).map((i) => ({ label: text.clip(i.label, 60), qty: i.qty, unit: i.unit || undefined, price: i.price })),
  };
  await brain.remember(ctx, 'docs', fitList([entry, ...docs].slice(0, 8)));
}

// Remembers an invoice as open (or updates it), newest first.
async function recordInvoice(ctx, inv) {
  const m = mem(ctx);
  const list = (Array.isArray(m.invoices) ? m.invoices : []).filter((d) => d && d.number !== inv.number);
  const entry = {
    kind: 'invoice',
    number: inv.number,
    fp: inv.fp,
    date: inv.date,
    due: inv.due,
    customer: text.clip(inv.customer || '', 60),
    email: text.clip(inv.email || '', 80),
    phone: text.clip(inv.phone || '', 30),
    title: text.clip(inv.title || '', 80),
    totalCents: inv.totalCents,
    balanceCents: inv.balanceCents,
    dueNowCents: inv.dueNowCents,
    payLink: inv.payLink || undefined,
  };
  await brain.remember(ctx, 'invoices', fitList([entry, ...list].slice(0, 20)));
}

function recentDocs(ctx, kind) {
  const docs = Array.isArray(mem(ctx).docs) ? mem(ctx).docs : [];
  return docs.filter((d) => d && (!kind || d.kind === kind));
}

function openInvoices(ctx) {
  const list = Array.isArray(mem(ctx).invoices) ? mem(ctx).invoices : [];
  return list.filter((d) => d && (d.balanceCents == null || d.balanceCents > 0));
}

module.exports = { PACK, PREFIX, settings, saveSettings, fingerprint, numberFor, recordDoc, recordInvoice, recentDocs, openInvoices, fitList, SETTING_KEYS };
