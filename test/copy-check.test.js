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
    ['Your AI team replaces your VA.', 'ai-employee-claims'],
    ['It does the work of three hires, for a fraction of a salary.', 'ai-employee-claims'],
    ['Cut your headcount in half.', 'ai-employee-claims'],
    ['Your business on autopilot.', 'ai-employee-autopilot'],
    ['It works 24/7, while you sleep.', 'ai-employee-autopilot'],
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
    "Your AI team doesn't replace your staff.",
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

test('a bare "Free" or "No signup" on First 25 is held (Legal S22) until "all 25 with your email" is beside it', () => {
  assert.deepStrictEqual(check('Get 25 local businesses and the message to send each one. Free.').map((x) => [x.rule, x.severity]), [['first25-free', 'hold']]);
  const alone = check('First 25 · Free · No signup to search');
  assert.ok(alone.length && alone.every((x) => x.rule === 'first25-free' && x.severity === 'hold'), 'No signup to search, alone next to 25');
  for (const s of ['Top 3 free · All 25 with your email', '25 local businesses to message, free with your email', 'Top 3 free, all 25 with your email.', 'First 25 · Free · No signup to search · All 25 with your email', 'Start free. Your roadmap takes 3 minutes.', 'Start free and the Founder Score, side by side. One button: Find my first 25.']) assert.deepStrictEqual(rules(s), [], s);
});

test('a paid plan never says it gets members clients, leads or businesses (Legal L62), and free First 25 still can', () => {
  const bad = [
    'Builder gets you clients.',
    '127 HQ finds leads for you every week.',
    'The Circle brings in clients.',
    'Builder turns your replies into a first client.',
    'HQ hands members 25 businesses to pitch.',
    'Members get fresh leads every Monday.',
    'Run a workflow that finds leads, or open a list in HQ.',
  ];
  for (const s of bad) assert.ok(rules(s).includes('paid-plan-customers'), s);
  const good = [
    'Builder has Outreach Scripts, the One-Page Offer and the Pricing Worksheet.',
    'Send it to your best customers. Builder has the scripts.',
    'First 25 finds 25 local businesses that could use what you sell.',
    'Find 10 potential customers today.',
    'No paid plan gets you clients.',
    "Builder doesn't find you clients. It has the scripts for the ones you find.",
    'Builder members track paying customers in HQ.',
  ];
  for (const s of good) assert.deepStrictEqual(rules(s), [], s);
  assert.deepStrictEqual(check('A fresh 25 every Monday in HQ.').map((x) => [x.rule, x.severity]), [['paid-plan-weekly-list', 'hold']]);
  // Copy that is all about paid plans (the plan cards, the pricing page, HQ's pages) counts every sentence.
  assert.deepStrictEqual(rules('Find leads'), []);
  assert.ok(rules('Find leads', { paid: true }).includes('paid-plan-customers'));
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
  for (const f of ['views/home.ejs', 'lib/waitlist.js', 'public/funnels/first25-data.js', 'lib/plans.js']) if (fs.existsSync(path.join(__dirname, '..', f))) assert.ok(rel.includes(f), `scans ${f}`);
  const found = run(files);
  for (const h of found.filter((f) => f.severity === 'hold')) t.diagnostic(`held: ${h.file}:${h.line} ${h.rule} "${h.match}"`);
  assert.deepStrictEqual(found.filter((f) => f.severity === 'block').map((f) => `${f.file}:${f.line} ${f.rule} "${f.match}"`), []);
});

test('every page with the site footer carries the earnings line', () => {
  const foot = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'foot.ejs'), 'utf8');
  assert.match(foot, /include\('earnings-note'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'earnings-note.ejs'), 'utf8'), /not a promise of income/);
});

test('a free 30-day roadmap says weeks 1 and 2 are the free part, in the same line (Legal L70)', () => {
  const rules = (s) => check(s).filter((f) => f.rule === 'free-roadmap').length;
  assert.equal(rules('Get your free 30-day roadmap.'), 1);
  assert.equal(rules('Answer a few questions and get the full 30-day plan.'), 1);
  assert.equal(rules('Comment ROADMAP for a 30-day plan that is free.'), 1);
  assert.equal(rules('Comment ROADMAP for a 30-day plan, weeks 1 and 2 free.'), 0);
  assert.equal(rules('Take the assessment and get weeks 1 and 2 of your 30-day roadmap free.'), 0);
  assert.equal(rules("I'll send you a 30-day plan. The first two weeks are free."), 0);
  assert.equal(rules('Start free. Your 30-day roadmap is built for you.'), 0);
});

test('a line a reader must see, set in faint gray fine print, is held (Legal L103)', () => {
  const { finePrint, faintClasses } = require('../lib/fine-print');
  const faint = faintClasses(['.note{font-size:12px;color:var(--muted)}', '.v5 .ticker-note{font-size:12px;color:#7a7c89}', '.lede{font-size:17px;color:var(--ink-2)}']);
  const held = (html) => finePrint(html, { file: 'x.ejs', faint }).map((f) => f.rule);
  assert.deepStrictEqual(held('<p class="note">Eli\'s results aren\'t typical or a promise of what you\'ll earn.</p>'), ['fine-print']);
  assert.deepStrictEqual(held('<p class="ticker-note <%= x %>">Renews monthly until you cancel.</p>'), ['fine-print']);
  assert.deepStrictEqual(held('<small style="font-size:11px;color:#8b8b96">Not financial advice.</small>'), ['fine-print']);
  assert.deepStrictEqual(held('<p class="tiny muted">By continuing you agree to the Terms.</p>'), ['fine-print']);
  // readable copy beside the claim passes, and so does faint text that qualifies nothing
  assert.deepStrictEqual(held('<p class="lede">Eli\'s results aren\'t typical or a promise of what you\'ll earn.</p>'), []);
  assert.deepStrictEqual(held('<p class="note">Updated Oct 21.</p>'), []);
  assert.ok(run(siteFiles()).filter((f) => f.rule === 'fine-print').every((f) => f.severity === 'hold'));
});
