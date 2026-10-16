// Verify, reset and confirm links go by email only. On-screen copies need SHOW_DEV_LINKS=true on a
// non-production run, never just a missing NODE_ENV (a deploy that lost its Secrets must stay safe).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('on-screen email links are opt-in only', () => {
  assert.match(src, /const DEV_LINKS = !PROD && process\.env\.SHOW_DEV_LINKS === 'true';/);
  for (const name of ['devVerifyLink', 'devConfirm']) {
    for (const line of src.split('\n').filter((l) => l.includes(name) && /=|:/.test(l) && /session\.\w+ (=|\?)|locals/.test(l))) {
      if (/= null;$/.test(line.trim())) continue;
      assert.match(line, /DEV_LINKS/, `ungated ${name}: ${line.trim()}`);
    }
  }
  assert.doesNotMatch(src, /!PROD && !process\.env\.RESEND_API_KEY/);
});

test('no fixed fallback session secret in server.js', () => {
  assert.doesNotMatch(src, /'dev-only-not-for-production'/);
  assert.match(src, /process\.env\.SESSION_SECRET = require\('crypto'\)\.randomBytes\(32\)/);
});
