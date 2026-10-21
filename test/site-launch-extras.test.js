// UTM capture and the ad desk's joins export, referral friends by first name, challenge replay links,
// ad consent for server-side events, the footer and the demo member.
const test = require('node:test');
const assert = require('node:assert');
const db = require('../lib/db');
const utm = require('../lib/utm');
const launch = require('../lib/launch');
const waitlist = require('../lib/waitlist');
const adConsent = require('../lib/ad-consent');

const withEnv = (env, fn) => {
  const old = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};

test('cleanUtm keeps the five utm keys, trims them, and stores click ids only as a flag', () => {
  const u = utm.cleanUtm({ utm_source: ' meta ', utm_medium: 'paid', utm_campaign: 'launch_test', utm_content: 'A07-permission', utm_term: 'x'.repeat(300), fbclid: 'IwAR-real-click-id', evil: '1' });
  assert.strictEqual(u.utm_source, 'meta');
  assert.strictEqual(u.utm_term.length, 100);
  assert.strictEqual(u.fbclid, '1');
  assert.strictEqual(u.ttclid, null);
  assert.ok(!('evil' in u));
});

test('firstTouch keeps the earliest values and only fills gaps from later sources', () => {
  const u = utm.firstTouch({ utm_source: 'meta', utm_content: 'A07' }, { utm_source: 'tiktok', utm_medium: 'paid', utm_content: 'B01' });
  assert.deepStrictEqual([u.utm_source, u.utm_medium, u.utm_content], ['meta', 'paid', 'A07']);
});

test('joins export: one row per Chicago date, ad and page, with joins, quiz starts and builders, no personal data', () => {
  const ad = { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'launch_test', utm_content: 'A07-permission' };
  const data = {
    waitlist: [
      // 01:30 UTC on Nov 6 is still Nov 5 in Chicago.
      { email: 'a@example.com', firstName: 'Ana', source: 'quiz', createdAt: '2026-11-06T01:30:00Z', utm: ad },
      { email: 'b@example.com', source: 'quiz', createdAt: '2026-11-05T15:00:00Z', utm: ad },
      { email: 'c@example.com', source: 'founding', createdAt: '2026-11-05T16:00:00Z', utm: ad },
      { email: 'd@example.com', source: 'founding', createdAt: '2026-11-05T16:00:00Z', utm: {} },
    ],
    quizStarts: [{ counts: { [JSON.stringify(['2026-11-05', 'meta', 'paid', 'launch_test', 'A07-permission', '/score'])]: 5 } }],
    users: [
      { id: 'u1', email: 'a@example.com', utm: null },
      { id: 'u2', email: 'demo@example.com', demoAccount: true, utm: ad },
    ],
    billingRecords: [
      { userId: 'u1', kind: 'start', plan: 'builder', at: '2026-11-17T16:00:00Z' },
      { userId: 'u1', kind: 'upgrade', plan: 'builder', at: '2026-11-18T16:00:00Z' },
      { userId: 'u2', kind: 'start', plan: 'builder', at: '2026-11-17T16:00:00Z' },
    ],
  };
  const rows = utm.rows(data);
  const score = rows.find((r) => r.date === '2026-11-05' && r.page === '/score' && r.utm_content === 'A07-permission');
  assert.deepStrictEqual(score, { date: '2026-11-05', utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'launch_test', utm_content: 'A07-permission', page: '/score', joins: 2, quiz_starts: 5, builders: 0 });
  assert.strictEqual(rows.find((r) => r.page === '/founding' && r.utm_source === 'meta').joins, 1);
  assert.strictEqual(rows.find((r) => r.page === '/founding' && r.utm_source === '').joins, 1);
  // The builder is credited once, on the first paid start, to the ad on their waitlist entry; the demo never counts.
  const b = rows.filter((r) => r.builders);
  assert.strictEqual(b.length, 1);
  assert.deepStrictEqual([b[0].date, b[0].page, b[0].utm_content, b[0].builders], ['2026-11-17', '/score', 'A07-permission', 1]);
  const csv = utm.csv(rows);
  assert.strictEqual(csv.split('\n')[0], 'date,utm_source,utm_medium,utm_campaign,utm_content,page,joins,quiz_starts,builders');
  assert.ok(!/@|Ana/.test(csv), 'no emails or names in the export');
  assert.strictEqual(utm.rows(data, { from: '2026-11-06' }).filter((r) => r.joins).length, 0);
});

test('joins export escapes cells that a spreadsheet would run as a formula', () => {
  const csv = utm.csv(utm.rows({ waitlist: [{ source: 'founding', createdAt: '2026-11-05T16:00:00Z', utm: { utm_source: '=HYPERLINK("x")' } }] }));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
});

test('quiz starts are counted per Chicago day, ad and page in a durable counter', async () => {
  const saved = [];
  const orig = { get: db.get, save: db.save };
  db.get = () => null;
  db.save = async (c, doc) => { saved.push([c, doc]); return doc; };
  try {
    await utm.countQuizStart('founder-score', { utm_source: 'meta', utm_content: 'A07' }, Date.parse('2026-11-06T02:00:00Z'));
  } finally { Object.assign(db, orig); }
  const [c, doc] = saved[0];
  assert.strictEqual(c, 'counters');
  assert.strictEqual(doc.id, 'quizstarts:2026-11-05');
  assert.deepStrictEqual(Object.entries(doc.counts), [[JSON.stringify(['2026-11-05', 'meta', '', '', 'A07', '/score']), 1]]);
});

test('referred friends show by first name only, "A friend" without one, never an email', () => {
  assert.strictEqual(waitlist.friendName('Maya Lopez'), 'Maya');
  assert.strictEqual(waitlist.friendName(''), 'A friend');
  assert.strictEqual(waitlist.friendName('maya@example.com'), 'A friend');
  const orig = db.filter;
  const rows = [
    { referredBy: 'ABC234', counted: true, confirmedAt: '2026-10-28T10:00:00Z', firstName: 'Jordan', email: 'j@example.com' },
    { referredBy: 'ABC234', counted: true, confirmedAt: '2026-10-27T10:00:00Z', firstName: '', email: 'x@example.com' },
    { referredBy: 'ABC234', counted: false, confirmedAt: null, firstName: 'Pending', email: 'p@example.com' },
    { referredBy: 'OTHER9', counted: true, confirmedAt: '2026-10-27T10:00:00Z', firstName: 'Elsewhere' },
  ];
  db.filter = (c, fn) => rows.filter(fn);
  try {
    assert.deepStrictEqual(waitlist.friends({ referralCode: 'ABC234' }), ['A friend', 'Jordan']);
  } finally { db.filter = orig; }
});

test('replay links come from env and only http(s) URLs count', () => {
  withEnv({ CHALLENGE_REPLAY_1_URL: 'https://www.instagram.com/reel/abc/', CHALLENGE_REPLAY_2_URL: 'javascript:alert(1)' }, () => {
    assert.strictEqual(launch.replayUrl(1), 'https://www.instagram.com/reel/abc/');
    assert.strictEqual(launch.replayUrl(2), null);
  });
  withEnv({ CHALLENGE_REPLAY_1_URL: undefined }, () => assert.strictEqual(launch.replayUrl(1), null));
});

test('server-side ad events need the page flag and the 127_consent=v1.ads1 cookie, and never run with GPC or for members', () => {
  const req = (cookie, body, extra = {}) => ({ headers: { cookie, ...(extra.headers || {}) }, body, user: extra.user || null });
  assert.strictEqual(adConsent.serverSideAllowed(req('127_consent=v1.ads1.1700000000', { ad_consent: true })), true);
  assert.strictEqual(adConsent.serverSideAllowed(req('127_consent=v1.ads0.1700000000', { ad_consent: true })), false);
  assert.strictEqual(adConsent.serverSideAllowed(req('127_consent=v1.ads1.1700000000', { ad_consent: 'true' })), false);
  assert.strictEqual(adConsent.serverSideAllowed(req('', { ad_consent: true })), false);
  assert.strictEqual(adConsent.serverSideAllowed(req('127_consent=v1.ads1.1', { ad_consent: true }, { headers: { 'sec-gpc': '1' } })), false);
  assert.strictEqual(adConsent.serverSideAllowed(req('127_consent=v1.ads1.1', { ad_consent: true }, { user: { id: 'u' } })), false);
});

test('the consent config never loads a pixel itself and the footer carries the earnings line', () => {
  // Legal L43: no pixel IDs until the real /privacy and /cookies are live.
  withEnv({ META_PIXEL_ID: '1234567890', PRIVACY_LIVE: undefined, COOKIE_NOTICE_LIVE: 'true' }, () => {
    assert.match(adConsent.configScript({ user: null }), /"metaPixelId":""/);
    assert.strictEqual(adConsent.metaPixelId(), '');
  });
  // Legal L87 LV3: no ad pixels anywhere on the site while Life in HQ is on, even for admins only.
  for (const life of ['on', 'admins']) {
    withEnv({ META_PIXEL_ID: '1234567890', TIKTOK_PIXEL_ID: '987', KLAVIYO_PUBLIC_KEY: 'pk', PRIVACY_LIVE: 'true', COOKIE_NOTICE_LIVE: 'true', HQ_LIFE: life }, () => {
      assert.deepStrictEqual(adConsent.tools(), { metaPixelId: '', tiktokPixelId: '', klaviyoPublicKey: '' }, life);
      assert.strictEqual(adConsent.metaPixelId(), '');
    });
  }
  withEnv({ META_PIXEL_ID: '1234567890', TIKTOK_PIXEL_ID: undefined, KLAVIYO_PUBLIC_KEY: undefined, COOKIE_DOMAIN: '.127group.io', PRIVACY_LIVE: 'true', COOKIE_NOTICE_LIVE: 'true', HQ_LIFE: 'off' }, () => {
    const s = adConsent.configScript({ user: null });
    assert.match(s, /window\.C127_CONSENT=\{"metaPixelId":"1234567890"/);
    assert.match(s, /"noticeUrl":"\/cookies"/);
    assert.match(s, /<script src="\/js\/consent\.js" defer><\/script>/);
    assert.ok(!/fbevents|fbq\(/.test(s));
    assert.match(adConsent.configScript({ user: { id: 'u' } }), /"loggedIn":true/);
  });
  const ejs = require('ejs');
  const file = require('path').join(__dirname, '..', 'views', 'partials', 'legal-footer.ejs');
  const f = ejs.render(require('fs').readFileSync(file, 'utf8'), {}, { filename: file });
  assert.match(f, /127 is education and tools, not a promise of income\. Results vary\. <a href="\/earnings-disclaimer">Earnings disclaimer<\/a>/);
  assert.match(f, /<a href="\/cookies" data-cookie-settings>Cookie settings<\/a>/);
  assert.ok(!/Privacy/.test(f));
  assert.match(ejs.render(require('fs').readFileSync(file, 'utf8'), { privacyTerms: true }, { filename: file }), /href="\/privacy">Privacy<\/a> · <a href="\/terms">Terms/);
});

test('demo member: obviously fake, week 1 done, no money milestones, flagged out of revenue and ad counts', () => {
  const { demoUser } = require('../scripts/seed-demo');
  const u = demoUser({ email: 'demo@example.com', passwordHash: 'hash', now: Date.parse('2026-11-16T12:00:00Z') });
  assert.strictEqual(u.name, 'Maya Demo');
  assert.strictEqual(u.tier, 'builder');
  assert.ok(u.demoAccount && u.demoBilling && u.emailVerified);
  assert.ok(u.badges.includes('week_one'));
  assert.ok(u.roadmap.weeks[0].tasks.every((t) => u.completed[t.id]));
  assert.ok(!u.milestones.first_sale && !u.milestones.revenue_1k);
  assert.deepStrictEqual(u.aiHistory, []);
  assert.ok(!('password' in u));
  // A reset keeps the same account.
  assert.strictEqual(demoUser({ existing: { id: 'keep', createdAt: 'x' }, email: 'demo@example.com', passwordHash: 'h' }).id, 'keep');
});

test('joins export token: only the exact Bearer token opens it, and a blank or short secret never does', () => {
  const tok = require('../lib/export-token');
  const good = 'a'.repeat(32);
  assert.strictEqual(tok.bearer({ headers: { authorization: `Bearer ${good}` } }), good);
  assert.strictEqual(tok.bearer({ headers: {} }), '');
  assert.strictEqual(tok.valid(good, good), true);
  assert.strictEqual(tok.valid(good + 'x', good), false);
  assert.strictEqual(tok.valid('', ''), false);
  assert.strictEqual(tok.valid('short', 'short'), false);
  assert.strictEqual(tok.valid(good, undefined), false);
  let passed = false; let fellBack = false;
  process.env.JOINS_EXPORT_TOKEN = good;
  tok.orAdmin((req, res, next) => { fellBack = true; })({ headers: { authorization: `Bearer ${good}` } }, {}, () => { passed = true; });
  assert.deepStrictEqual([passed, fellBack], [true, false]);
  passed = false;
  tok.orAdmin((req, res, next) => { fellBack = true; })({ headers: { authorization: 'Bearer nope' } }, {}, () => { passed = true; });
  assert.deepStrictEqual([passed, fellBack], [false, true]);
  delete process.env.JOINS_EXPORT_TOKEN;
});

test('no public page says "multiple six-figure" (Legal rule 2 / L37: off everything public until Eli documents it)', () => {
  const fs = require('fs'); const path = require('path');
  const hits = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.(ejs|html|json|md|js)$/.test(f.name) && /multiple six[- ]figure/i.test(fs.readFileSync(p, 'utf8'))) hits.push(p); } };
  for (const d of ['views', 'content', 'public']) walk(path.join(__dirname, '..', d));
  assert.deepStrictEqual(hits, []);
});
