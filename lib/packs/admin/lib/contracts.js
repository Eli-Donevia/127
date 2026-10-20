// Contract checklist: what to look for in a kind of contract, which of those things the text seems
// to cover, which seem missing, and wording worth a lawyer's look. Plain pattern checks, no AI, so
// the same text always gets the same list. Follows Legal row 9 (C3): it names facts (names, dates,
// prices, scope, payment) and topics, and for legal terms (liability, indemnity, ownership, law and
// disputes, ending it) it only says to ask a lawyer. It never writes, changes or recommends terms,
// and never says whether anything is legal or enforceable. Leases are left to a lawyer (C4).

const DATA = require('../data/contracts.json');

const TYPE_HINTS = [
  ['lease', /\b(lease|landlord|tenant|premises|rent)\b/gi],
  ['nda', /\b(non-?disclosure|confidential information|nda|disclosing party|receiving party)\b/gi],
  ['contractor', /\b(independent contractor|subcontract\w*|contractor shall|1099|freelancer)\b/gi],
  ['vendor', /\b(subscription|subscriber|license fee|software|platform|terms of service|vendor|supplier|purchase order)\b/gi],
  ['service', /\b(client|customer|services|statement of work|estimate|scope of work|deliverables?)\b/gi],
];

// The kind of contract, from what it says most.
function guessType(textIn) {
  const s = String(textIn || '');
  let best = 'other';
  let top = 2;
  for (const [type, re] of TYPE_HINTS) {
    const n = (s.match(re) || []).length * (type === 'service' ? 0.6 : 1);
    if (n > top) {
      best = type;
      top = n;
    }
  }
  return best;
}

function itemsFor(type) {
  const t = DATA.types[type] || DATA.types.other;
  return t.items.map((i) => (typeof i === 'string' ? { id: i, ...DATA.common[i] } : i));
}

// The paragraph around a match, clipped to about 280 characters on word boundaries.
function around(s, index, len) {
  const lineStart = s.lastIndexOf('\n', index) + 1;
  const nl = s.indexOf('\n', index + len);
  const lineEnd = nl < 0 ? s.length : nl;
  let from = lineStart;
  let to = lineEnd;
  if (to - from > 280) {
    from = Math.max(lineStart, index - 120);
    to = Math.min(lineEnd, index + len + 140);
    if (from > lineStart) from = s.indexOf(' ', from) + 1 || from;
    if (to < lineEnd) to = s.lastIndexOf(' ', to) > from ? s.lastIndexOf(' ', to) : to;
  }
  const body = s.slice(from, to).replace(/\s+/g, ' ').trim();
  return `${from > lineStart ? '...' : ''}${body}${to < lineEnd ? '...' : ''}`;
}

function check(textIn, { type } = {}) {
  const s = String(textIn || '').replace(/\r\n/g, '\n');
  const guessed = guessType(s);
  const lease = type === 'lease' || (!type && guessed === 'lease');
  const kind = type && DATA.types[type] ? type : DATA.types[guessed] ? guessed : 'other';
  const has = s.trim().length >= 80;
  const items = itemsFor(kind).map((i) => {
    const re = new RegExp(i.look, 'i');
    return { id: i.id, label: i.label, why: i.why, legal: !!i.legal, found: has ? re.test(s) : null };
  });
  const risks = [];
  if (has) {
    for (const r of DATA.risks) {
      const m = new RegExp(r.look, 'i').exec(s);
      if (m) risks.push({ id: r.id, label: r.label, why: r.why, quote: around(s, m.index, m[0].length) });
    }
  }
  const missing = items.filter((i) => i.found === false);
  return {
    type: kind,
    typeTitle: (DATA.types[kind] || DATA.types.other).title,
    read: has,
    words: (s.match(/\S+/g) || []).length,
    items,
    missing,
    risks,
    lease,
    questions: [
      ...(lease ? ['This looks like a lease. Leases need a lawyer\'s read: this checklist only covers the general items.'] : []),
      ...missing.slice(0, 8).map((i) => (i.legal ? `We didn't find wording about ${i.label.toLowerCase()}. ${DATA.lawyer}` : `We didn't find wording about ${i.label.toLowerCase()}. ${i.why}`)),
      ...risks.slice(0, 8).map((r) => `${r.label}: ${r.why}`),
    ],
    disclaimer: DATA.disclaimer,
    referral: DATA.referral,
  };
}

module.exports = { check, guessType, itemsFor, around, DATA };
