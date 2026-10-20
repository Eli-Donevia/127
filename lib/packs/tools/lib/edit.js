// Changes to an app this pack made, without AI: the app carries what it was built from (its
// settings), so simple asks rebuild it exactly. Handles: new or changed prices ("Deep clean $260"),
// removing a line ("remove Windows"), the title ("call it Quick Quote"), the business name, the
// color, tax and deposit percentages, and a phone or email. Anything else needs AI.

const { text } = require('../../_kit');
const { parsePrices } = require('./prices');
const { accentOf } = require('./shell');
const { configOf } = require('./app-file');
const S = require('./starters');

const lower = (s) => String(s || '').toLowerCase().trim();

function planEdits(change) {
  const c = String(change || '');
  const e = { prices: [], remove: [], done: [] };
  const title = c.match(/\b(?:call it|rename (?:it |the app )?(?:to )?|change the (?:title|name of the app) to|title it)\s+["']?([^"'\n.;]{2,60})/i);
  if (title) e.title = text.oneLine(title[1]);
  const biz = c.match(/\bbusiness name (?:to|is|should be)\s+["']?([^"'\n.;]{2,80})/i);
  if (biz) e.business = text.oneLine(biz[1]);
  const hex = c.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i);
  const word = c.match(/\b(?:colou?r|accent|buttons?)\b[^.\n]{0,30}?\b(red|orange|yellow|green|forest green|teal|blue|navy|purple|pink|brown|gray|grey|white)\b/i);
  if (hex || word) e.color = hex ? hex[0] : word[1];
  const tax = c.match(/\btax\b[^.\n\d]{0,20}(\d+(?:\.\d+)?)\s*%/i);
  if (tax) e.tax = Number(tax[1]);
  const dep = c.match(/\bdeposit\b[^.\n\d]{0,20}(\d+(?:\.\d+)?)\s*%/i);
  if (dep) e.deposit = Number(dep[1]);
  const email = c.match(/[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/i);
  if (email) e.email = email[0];
  const phone = c.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  if (phone) e.phone = phone[0];
  for (const m of c.matchAll(/\b(?:remove|delete|drop|take out|get rid of)\s+(?:the\s+)?["']?([^"'\n.,;]{2,60})/gi)) e.remove.push(lower(m[1]).replace(/\s+(line|item|service|option)$/, ''));
  const priceText = c.split(/\r?\n|;|\.\s+(?=[A-Z])/).filter((l) => /\$\s?\d/.test(l) && !/\btax\b|\bdeposit\b/i.test(l)).map((l) => l.replace(/^\s*(?:add|change|set|make|update|raise|lower)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:line\s+|item\s+|service\s+)?(?:for\s+)?/i, '').replace(/\s+(?:to|at|for)\s+(?=\$)/i, ' '));
  e.prices = parsePrices(priceText.join('\n'));
  return e;
}

// Returns { html, changed: [what changed], starter } or null when the app isn't one of ours.
function applyEdits(html, change) {
  const cfg = configOf(html);
  if (!cfg || !cfg.source || !S.byId(cfg.starter)) return null;
  const src = cfg.source;
  const e = planEdits(change);
  const facts = {
    business: cfg.business || 'Your business',
    hasName: true,
    what: src.what || '',
    city: src.city || '',
    phone: src.phone || '',
    email: src.email || '',
    booking: src.booking || '',
    accent: accentOf(src.accent),
    items: (src.items || []).map((x) => ({ ...x })),
    sampleItems: !!src.sampleItems,
  };
  const opts = { ...(src.opts || {}) };
  if (cfg.starter === 'lookup') {
    opts.rows = cfg.rows;
    opts.columns = cfg.columns;
  }
  const changed = [];
  if (e.title) {
    opts.title = e.title;
    changed.push(`Title is now "${e.title}"`);
  }
  if (e.business) {
    facts.business = e.business;
    changed.push(`Business name is now ${e.business}`);
  }
  if (e.color) {
    facts.accent = accentOf(e.color);
    changed.push(`Accent color is now ${facts.accent.accent}`);
  }
  if (e.tax != null) {
    opts.tax = e.tax;
    changed.push(`Sales tax starts at ${e.tax}%`);
  }
  if (e.deposit != null) {
    opts.deposit = e.deposit;
    changed.push(`Deposit starts at ${e.deposit}%`);
  }
  if (e.email) {
    facts.email = e.email;
    changed.push(`Email is now ${e.email}`);
  }
  if (e.phone) {
    facts.phone = e.phone;
    changed.push(`Phone is now ${e.phone}`);
  }
  for (const r of e.remove) {
    const before = facts.items.length;
    facts.items = facts.items.filter((x) => !lower(x.name).includes(r) && !r.includes(lower(x.name)));
    if (facts.items.length < before) changed.push(`Removed ${r}`);
  }
  for (const p of e.prices) {
    const hit = facts.items.find((x) => lower(x.name) === lower(p.name));
    if (hit) {
      if (hit.price !== p.price) changed.push(`${hit.name} is now $${p.price}`);
      hit.price = p.price;
      if (p.unit) hit.unit = p.unit;
    } else {
      facts.items.push(p);
      changed.push(`Added ${p.name} at $${p.price}${p.unit ? ` per ${p.unit}` : ''}`);
    }
    facts.sampleItems = false;
  }
  if (!changed.length) return { html, changed, starter: cfg.starter };
  const r = S.render(cfg.starter, facts, opts);
  return { html: r.html, changed, starter: cfg.starter, title: r.title, business: facts.business };
}

module.exports = { planEdits, applyEdits };
