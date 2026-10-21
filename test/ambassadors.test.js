// Ambassador pay counts (lib/ambassadors.js, Legal L90): first tracked link, 30-day window, still paying at day 30.
const test = require('node:test');
const assert = require('node:assert');
const amb = require('../lib/ambassadors');

const DAY = 24 * 60 * 60 * 1000;
const iso = (t) => new Date(t).toISOString();
const T0 = Date.parse('2026-11-17T16:00:00Z');

function member(o = {}) {
  const joined = o.joined ?? T0;
  const paid = o.paid === null ? null : (o.paid ?? joined);
  return {
    createdAt: iso(joined),
    firstLink: o.firstLink === undefined ? { kind: 'ambassador', ambassador: o.amb || 'jess', at: iso(joined - (o.openedDaysBefore ?? 2) * DAY) } : o.firstLink,
    firstPaidAt: paid ? iso(paid) : null,
    planHistory: o.planHistory || (paid ? [{ at: iso(paid), tier: 'builder', from: 'free', to: 'builder' }] : []),
    refundedAt: o.refundedAt || null
  };
}

test('firstLinkFrom: ambassador link, other tagged link, referral link, untracked', () => {
  const a = amb.firstLinkFrom({ utm_source: 'ambassador', utm_content: ' Jess ' }, null, T0);
  assert.deepStrictEqual(a, { kind: 'ambassador', ambassador: 'jess', at: iso(T0) });
  assert.strictEqual(amb.firstLinkFrom({ utm_source: 'meta', utm_content: 'A07' }, null, T0).kind, 'utm');
  assert.strictEqual(amb.firstLinkFrom({ utm_source: 'ambassador' }, null, T0).kind, 'utm');
  assert.strictEqual(amb.firstLinkFrom({}, 'ANA42', T0).kind, 'ref');
  assert.strictEqual(amb.firstLinkFrom({}, null, T0), null);
});

test('creditedTo: only when the ambassador link came first and within 30 days before joining', () => {
  assert.strictEqual(amb.creditedTo(member()), 'jess');
  assert.strictEqual(amb.creditedTo(member({ openedDaysBefore: 31 })), null);
  assert.strictEqual(amb.creditedTo(member({ openedDaysBefore: -1 })), null);
  assert.strictEqual(amb.creditedTo(member({ firstLink: { kind: 'utm', ambassador: null, at: iso(T0 - DAY) } })), null);
  assert.strictEqual(amb.creditedTo(member({ firstLink: { kind: 'ref', ambassador: null, at: iso(T0 - DAY) } })), null);
  assert.strictEqual(amb.creditedTo(member({ firstLink: null })), null);
});

test('day30: still paying 30 days after the first charge, not refunded', () => {
  assert.strictEqual(amb.day30(member()), T0 + 30 * DAY);
  assert.strictEqual(amb.day30(member({ paid: null })), null);
  const cancelled = member({ planHistory: [{ at: iso(T0), to: 'builder' }, { at: iso(T0 + 20 * DAY), to: 'free' }] });
  assert.strictEqual(amb.day30(cancelled), null);
  const upgraded = member({ planHistory: [{ at: iso(T0), to: 'builder' }, { at: iso(T0 + 10 * DAY), to: 'circle' }] });
  assert.strictEqual(amb.day30(upgraded), T0 + 30 * DAY);
  assert.strictEqual(amb.day30(member({ refundedAt: iso(T0 + 5 * DAY) })), null);
  assert.strictEqual(amb.day30(member({ refundedAt: iso(T0 + 40 * DAY) })), T0 + 30 * DAY);
});

test('counts groups by the month day 30 lands in (Chicago) and ambassador, and skips the future', () => {
  const users = [
    member(), member(), member({ amb: 'leo' }),
    member({ joined: T0 + 20 * DAY }), // day 30 lands in January
    member({ openedDaysBefore: 45 }),
    member({ paid: null })
  ];
  const now = T0 + 90 * DAY;
  assert.deepStrictEqual(amb.counts(users, { now }), [
    { month: '2026-12', ambassador: 'jess', paid_joins: 2 },
    { month: '2026-12', ambassador: 'leo', paid_joins: 1 },
    { month: '2027-01', ambassador: 'jess', paid_joins: 1 }
  ]);
  assert.deepStrictEqual(amb.counts(users, { now, month: '2027-01' }), [{ month: '2027-01', ambassador: 'jess', paid_joins: 1 }]);
  assert.deepStrictEqual(amb.counts(users, { now: T0 + 10 * DAY }), []);
});

test('csv has counts only and neutralises spreadsheet formulas', () => {
  const out = amb.csv([{ month: '2026-12', ambassador: '=cmd', paid_joins: 3 }, { month: '2026-12', ambassador: 'a,b', paid_joins: 1 }]);
  assert.strictEqual(out, "month,ambassador,paid_joins\n2026-12,'=cmd,3\n2026-12,\"a,b\",1\n");
  assert.ok(!/@|email|name/i.test(out.split('\n')[0]));
});
