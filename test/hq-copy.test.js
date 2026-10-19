// Legal L62: 127 HQ is a paid plan's own page, so every sentence on it counts as paid-plan copy (lib/copy-check.js with
// { paid: true }). Nothing HQ says may promise members clients, customers or leads; it says what the tools do.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check } = require('../lib/copy-check');
const { JOBS } = require('../lib/harness/jobs');
const mcp = require('../lib/harness/mcp');

const blocks = (text, file) => check(text, { file, paid: true }).filter((f) => f.severity === 'block');

test("HQ v2's pages, jobs and AI link never say a paid plan gets members clients, customers or leads (Legal L62)", () => {
  const views = path.join(__dirname, '..', 'views');
  const files = [
    ...fs.readdirSync(path.join(views, 'app', 'hq2')).map((f) => path.join(views, 'app', 'hq2', f)),
    ...fs.readdirSync(path.join(views, 'partials')).filter((f) => f.startsWith('hq2-')).map((f) => path.join(views, 'partials', f)),
  ].filter((f) => f.endsWith('.ejs'));
  assert.ok(files.length > 10);
  for (const f of files) assert.deepEqual(blocks(fs.readFileSync(f, 'utf8'), f), [], path.relative(views, f));
  assert.deepEqual(blocks(JOBS.map((j) => `${j.title}. ${j.blurb}`).join('\n'), 'jobs.txt'), []);
  assert.deepEqual(blocks([mcp.INSTRUCTIONS, ...mcp.TOOLS.map((t) => t.description)].join('\n'), 'mcp.txt'), []);
  // The check would have caught the old lines.
  assert.ok(blocks('Run a workflow that finds leads.', 'x.txt').length);
  assert.ok(blocks('Get leads. Find the people, write the messages, fill the pipeline.', 'x.txt').length);
});
