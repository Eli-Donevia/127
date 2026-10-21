// The decision behind HQ's OK cards out of HQ (slack.js, teams.js): whether a waiting step can be OK'd on a card,
// and why not when it can't. Legal L93 (legal/handoffs/hub-apps.md section 1), the same for Slack and Teams:
//
// SL2 A card is void when the step changed since it was posted: hashOf() is what the card showed.
// SL3 A step that asks for a choice or edits, or doesn't fit (more than MAX_ITEMS items, or an item over MAX_TEXT
//     characters), says "Open in HQ to OK" with no OK button.
// SL4 HQ-only: an act step that needs a money platform (MONEY), or whose tool name says it charges, spends, deletes,
//     publishes or changes a budget (HQ_ONLY_NAME).
// SL6 A held act tool (not in ACT_CLEARED) never gets an OK button.

const crypto = require('crypto');

const MAX_ITEMS = 5;
const MAX_TEXT = 2800;
const MONEY = new Set(['stripe', 'square', 'paypal', 'quickbooks', 'xero', 'gumroad', 'etsy', 'shopify', 'meta_ads', 'google_ads', 'tiktok_ads', 'netlify', 'lemonsqueezy', 'polar', 'whop']);
const HQ_ONLY_NAME = /refund|charge|pay|invoice|price|budget|spend|delete|remove|publish|deploy/i;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

// What the step would do: the act tools it lets go ahead, and whether any is held or HQ-only.
function gate(wf, stepId, engine, packs) {
  const tools = wf.steps.filter((s) => s.approvedBy === stepId).map((s) => ({ name: s.tool, t: packs.tool(s.tool) })).filter((x) => x.t && x.t.risk === 'act');
  return {
    held: tools.some((x) => !engine.actCleared(x.name)),
    hqOnly: tools.some((x) => HQ_ONLY_NAME.test(x.name) || (x.t.needs || []).some((n) => MONEY.has(n))),
  };
}

const hashOf = (spec) => sha(JSON.stringify({ t: spec.title, n: spec.note, a: !!spec.act, o: (spec.options || []).map((o) => o.label), i: (spec.items || []).map((i) => [i.label, i.text]), e: spec.edit || null }));

// { okable, reason }: reason is the line a card without an OK button shows, null when it has one.
function decide(spec, g) {
  const items = spec.items || [];
  const fits = !spec.options && !(spec.edit && !spec.act) && items.length <= MAX_ITEMS && items.every((i) => String(i.text || i.label || '').length <= MAX_TEXT);
  const okable = !g.held && !g.hqOnly && fits;
  const reason = okable ? null : g.held ? 'This one is waiting on 127 before it can run.' : g.hqOnly ? 'Money, deletes, publishing and ad budgets are OK\'d in HQ only.' : 'This one needs a choice or an edit, so it\'s answered in HQ.';
  return { okable, reason };
}

// The OK button's words.
const okLabel = (spec) => (spec.act ? ((spec.items || []).length > 1 ? `OK all ${spec.items.length}` : 'OK') : 'Looks good');

// What an OK or a Not now hands the engine: an OK on an act card chooses every item the card showed.
const answerFor = (spec, ok) => (ok ? (spec.act && spec.items ? { chosen: spec.items.map((i) => i.key) } : {}) : { approved: false });

module.exports = { MAX_ITEMS, MAX_TEXT, MONEY, HQ_ONLY_NAME, sha, clip, gate, hashOf, decide, okLabel, answerFor };
