#!/usr/bin/env node
// Runs the copy check (lib/copy-check.js) over files or folders and prints what it finds.
//   node scripts/copy-check.js                      the site's own copy (pages and emails), the same scope as the test
//   node scripts/copy-check.js drafts/ email.md     any copy: drafts, scripts, captions (.md, .txt, .html, .ejs, .js, .json)
//   --date 2026-11-24                               the founding close day, when "Last chance" is allowed
//   --paid                                          every sentence counts as copy about a paid plan (Legal L62), for
//                                                   sweeping HQ's pages or a Builder email: node scripts/copy-check.js views/app/hq2 --paid
// Exit code 1 when anything blocks. Holds are listed, not failed.
const fs = require('fs');
const path = require('path');
const { check } = require('../lib/copy-check');

const ROOT = path.join(__dirname, '..');
// Legal pages must say "no guarantee", so they're out. So are the member library and the tools' prompts.
const LEGAL = /partials\/(terms-of-service|privacy-policy|membership-terms|circle-agreement|earnings-disclaimer|cookie-notice)\.ejs$/;
const EMAILS = ['lib/billing-emails.js', 'lib/circle-emails.js', 'lib/waitlist.js', 'lib/challenge.js', 'lib/funnels.js', 'lib/hq-harness.js', 'lib/member-ops.js', 'lib/age-check.js', 'lib/founding-five.js', 'lib/founding-five-routes.js', 'lib/doors.js', 'lib/market.js', 'lib/market-routes.js', 'lib/referrals.js'];
// Tool output: what First 25 writes for people (the message to each business, what each website is missing, the page's own lines),
// the front doors' pages and picker, and the results pages' lines, including what they say about Builder and 127 HQ (Legal L62).
const TOOL_OUTPUT = ['public/funnels/first25-data.js', 'public/funnels/first25-engine.js', 'public/funnels/first-25.js', 'public/funnels/doors-data.js', 'public/funnels/door.js', 'public/funnels/results-data.js'];
// Copy that is all about paid plans: the plan names and features, the plan cards, the Builder map and the pricing page.
// Every sentence counts as paid-plan copy here (Legal L62), so none of it says a plan gets members clients, leads or businesses.
const PAID_COPY = ['lib/plans.js', 'lib/hq-offer.js', 'views/partials/plans.ejs', 'views/partials/builder-map.ejs', 'views/partials/hq-stack.ejs', 'views/pricing.ejs'];
const isPaidCopy = (p) => PAID_COPY.includes(path.relative(ROOT, p).split(path.sep).join('/'));

function walk(dir, exts) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(f.name)) out.push(p);
  }
  return out;
}

// The site's own copy: every view but the legal ones, the static funnel pages, the challenge content, the email modules,
// First 25's output and the plans.
function siteFiles() {
  const views = walk(path.join(ROOT, 'views'), /\.ejs$/).filter((p) => !LEGAL.test(p.split(path.sep).join('/')));
  const pages = walk(path.join(ROOT, 'public', 'funnels'), /\.html$/);
  return [...views, ...pages, path.join(ROOT, 'content', 'challenge.json'), path.join(ROOT, 'content', 'onboarding.json'), ...[...EMAILS, ...TOOL_OUTPUT, 'lib/plans.js', 'lib/hq-offer.js'].map((f) => path.join(ROOT, f))].filter((p) => fs.existsSync(p));
}

// Views carry the earnings line through the site footer (partials/foot.ejs includes partials/earnings-note.ejs).
const footerHasEarnings = (p) => /\.ejs$/.test(p) && /include\(['"](?:\.\.\/)?partials\/foot['"]/.test(fs.readFileSync(p, 'utf8'));

function run(files, opts = {}) {
  const found = [];
  for (const p of files) {
    const text = fs.readFileSync(p, 'utf8');
    for (const f of check(text, { file: p, date: opts.date, paid: opts.paid || isPaidCopy(p), footerHasEarnings: footerHasEarnings(p) })) found.push({ file: path.relative(ROOT, p), ...f });
  }
  return found;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const di = args.indexOf('--date');
  const date = di >= 0 ? args.splice(di, 2)[1] : '';
  const paid = args.includes('--paid');
  if (paid) args.splice(args.indexOf('--paid'), 1);
  const files = args.length ? args.flatMap((a) => (fs.statSync(a).isDirectory() ? walk(a, /\.(md|txt|html?|ejs|js|json)$/) : [a])) : siteFiles();
  const found = run(files, { date, paid });
  for (const f of found) console.log(`${f.severity === 'block' ? 'BLOCK' : 'hold '} ${f.file}:${f.line}  ${f.rule}  "${f.match}"  ${f.why}`);
  const blocks = found.filter((f) => f.severity === 'block').length;
  console.log(`${files.length} files · ${blocks} blocking · ${found.length - blocks} held`);
  process.exit(blocks ? 1 : 0);
}

module.exports = { siteFiles, run };
