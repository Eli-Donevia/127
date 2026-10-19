// The copy check (lib/copy-check.js): the claims 127's own copy never makes, run over every page and email in the repo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { check } = require('../lib/copy-check');
const { siteFiles, run } = require('../scripts/copy-check');

const rules = (s, opts) => check(s, opts).map((f) => f.rule);

test('each rule catches what it is for', () => {
  const bad = [
    ['You could make $5,000 a month from home.', 'income'],
    ['Hit $10K/month by spring.', 'income'],
    ['Six figures by 21.', 'income'],
    ['Quit your job in 90 days.', 'income'],
    ['Guaranteed results or your money back.', 'guarantee'],
    ['A $2,997 value, yours free.', 'value-total'],
    ['Save $120 a year.', 'value-total'],
    ['Done-for-you outreach.', 'done-for-you'],
    ['Build it — then sell it.', 'em-dash'],
    ['Build it – then sell it.', 'em-dash'],
    ['Last chance to lock $19.', 'last-chance'],
    ["Built on Hormozi's $100M Offers.", 'hormozi'],
    ['Unlock your potential today.', 'hype'],
    ['Land 3 clients this week.', 'outcome-promise'],
    ['25 local businesses that need it.', 'outcome-promise'],
    ['Find your first 25 clients.', 'outcome-promise'],
    ['$1M+ fintech startup valuation', 'earnings-line'],
  ];
  for (const [s, rule] of bad) assert.ok(rules(s).includes(rule), `${rule}: ${s}`);
});

test('negations, ranges, our own prices and the earnings line pass', () => {
  const good = [
    'There is no guarantee of results.',
    '127 does not guarantee any outcome.',
    "It doesn't include done-for-you work.",
    'This is not a get-rich-quick program.',
    'Builder is $19 a month, locked for as long as you stay.',
    'The Founder\'s Circle is $299 a month, by application.',
    'Weeks 1 – 4',
    "$1M+ fintech startup valuation. Eli's results aren't typical or a promise of what you'll earn.",
    '14 days to change your mind. No Black Friday sale.',
  ];
  for (const s of good) assert.deepStrictEqual(rules(s), [], s);
  assert.deepStrictEqual(rules('<td>–</td><td>–</td>', { file: 'x.ejs' }), []);
});

test('"Last chance" is fine on the founding close day only', () => {
  assert.deepStrictEqual(rules('Last chance: the founding price ends tonight.', { date: '2026-11-24' }), []);
  assert.ok(rules('Last chance: the founding price ends tonight.', { date: '2026-11-23' }).includes('last-chance'));
});

test('First 25 time claims are held (Legal S23), not failed, and only near the tool', () => {
  const f = check('<h1><span>Your first 25.</span> <span>Found in a minute.</span></h1>', { file: 'x.ejs' });
  assert.deepStrictEqual(f.map((x) => [x.rule, x.severity]), [['first25-time', 'hold']]);
  assert.deepStrictEqual(rules('Your roadmap takes about 3 minutes to start.'), []);
});

test('a bare "Free" on First 25 is held (Legal S22) until it says what is free', () => {
  assert.deepStrictEqual(check('Get 25 local businesses and the message to send each one. Free.').map((x) => [x.rule, x.severity]), [['first25-free', 'hold']]);
  for (const s of ['First 25 · Free · No signup to search', '25 local businesses to message, free with your email', 'Top 3 free, all 25 with your email.', 'Start free. Your roadmap takes 3 minutes.', 'Start free and the Founder Score, side by side. One button: Find my first 25.']) assert.deepStrictEqual(rules(s), [], s);
});

test('what a reader never sees is not checked: comments, styles, scriptlet comments', () => {
  const ejs = "<%# Never say guarantee here %>\n<!-- six figures -->\n<style>.a{content:'—'}</style>\n<% // done-for-you is banned %>\n<p>Start free.</p>";
  assert.deepStrictEqual(rules(ejs, { file: 'x.ejs' }), []);
  assert.ok(rules('<meta property="og:title" content="Guaranteed clients.">', { file: 'x.html' }).includes('guarantee'));
});

test("the site's own copy has nothing that blocks (pages, funnel pages, challenge content, emails, First 25's messages)", (t) => {
  const files = siteFiles();
  assert.ok(files.length > 50, 'scans the site');
  const rel = files.map((f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'));
  for (const f of ['views/home.ejs', 'lib/waitlist.js', 'public/funnels/first25-data.js']) if (fs.existsSync(path.join(__dirname, '..', f))) assert.ok(rel.includes(f), `scans ${f}`);
  const found = run(files);
  for (const h of found.filter((f) => f.severity === 'hold')) t.diagnostic(`held: ${h.file}:${h.line} ${h.rule} "${h.match}"`);
  assert.deepStrictEqual(found.filter((f) => f.severity === 'block').map((f) => `${f.file}:${f.line} ${f.rule} "${f.match}"`), []);
});

test('every page with the site footer carries the earnings line', () => {
  const foot = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'foot.ejs'), 'utf8');
  assert.match(foot, /include\('earnings-note'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'earnings-note.ejs'), 'utf8'), /not a promise of income/);
});
