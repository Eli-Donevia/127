#!/usr/bin/env node
// Runs the copy check (lib/copy-check.js) over files or folders and prints what it finds.
//   node scripts/copy-check.js                      the site's own copy (pages and emails), the same scope as the test
//   node scripts/copy-check.js drafts/ email.md     any copy: drafts, scripts, captions (.md, .txt, .html, .ejs, .js, .json)
//   --date 2026-11-24                               the founding close day, when "Last chance" is allowed
// Exit code 1 when anything blocks. Holds are listed, not failed.
const fs = require('fs');
const path = require('path');
const { check } = require('../lib/copy-check');

const ROOT = path.join(__dirname, '..');
// Legal pages must say "no guarantee", so they're out. So are the member library and the tools' prompts.
const LEGAL = /partials\/(terms-of-service|privacy-policy|membership-terms|circle-agreement|earnings-disclaimer|cookie-notice)\.ejs$/;
const EMAILS = ['lib/billing-emails.js', 'lib/circle-emails.js', 'lib/waitlist.js', 'lib/challenge.js', 'lib/funnels.js', 'lib/hq-harness.js', 'lib/member-ops.js', 'lib/age-check.js'];
// Tool output: what First 25 writes for people (the message to each business, what each website is missing, the page's own lines).
const TOOL_OUTPUT = ['public/funnels/first25-data.js', 'public/funnels/first25-engine.js', 'public/funnels/first-25.js'];

function walk(dir, exts) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(f.name)) out.push(p);
  }
  return out;
}

// The site's own copy: every view but the legal ones, the static funnel pages, the challenge content, the email modules
// and First 25's output.
function siteFiles() {
  const views = walk(path.join(ROOT, 'views'), /\.ejs$/).filter((p) => !LEGAL.test(p.split(path.sep).join('/')));
  const pages = walk(path.join(ROOT, 'public', 'funnels'), /\.html$/);
  return [...views, ...pages, path.join(ROOT, 'content', 'challenge.json'), ...[...EMAILS, ...TOOL_OUTPUT].map((f) => path.join(ROOT, f))].filter((p) => fs.existsSync(p));
}

// Views carry the earnings line through the site footer (partials/foot.ejs includes partials/earnings-note.ejs).
const footerHasEarnings = (p) => /\.ejs$/.test(p) && /include\(['"](?:\.\.\/)?partials\/foot['"]/.test(fs.readFileSync(p, 'utf8'));

function run(files, opts = {}) {
  const found = [];
  for (const p of files) {
    const text = fs.readFileSync(p, 'utf8');
    for (const f of check(text, { file: p, date: opts.date, footerHasEarnings: footerHasEarnings(p) })) found.push({ file: path.relative(ROOT, p), ...f });
  }
  return found;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const di = args.indexOf('--date');
  const date = di >= 0 ? args.splice(di, 2)[1] : '';
  const files = args.length ? args.flatMap((a) => (fs.statSync(a).isDirectory() ? walk(a, /\.(md|txt|html?|ejs|js|json)$/) : [a])) : siteFiles();
  const found = run(files, { date });
  for (const f of found) console.log(`${f.severity === 'block' ? 'BLOCK' : 'hold '} ${f.file}:${f.line}  ${f.rule}  "${f.match}"  ${f.why}`);
  const blocks = found.filter((f) => f.severity === 'block').length;
  console.log(`${files.length} files · ${blocks} blocking · ${found.length - blocks} held`);
  process.exit(blocks ? 1 : 0);
}

module.exports = { siteFiles, run };
