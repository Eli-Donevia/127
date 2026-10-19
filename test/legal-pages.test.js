const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// L47: the legal pages (five public, plus the Circle draft) ship with no [PLACEHOLDER] and their date filled at render.
for (const f of ['membership-terms', 'terms-of-service', 'privacy-policy', 'earnings-disclaimer', 'cookie-notice', 'circle-agreement']) {
  test(`${f} has no bracket placeholders and a rendered date`, () => {
    const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', f + '.ejs'), 'utf8');
    assert.doesNotMatch(s, /\[[A-Z][A-Z ]+\]/);
    assert.match(s, /<%= legalEffectiveDate %>/);
    assert.doesNotMatch(s, /Appendix|Drafting notes/i);
  });
}

// Legal L71: HQ keeps the date the pages show with a member's Terms OK, so both read lib/legal-date.js.
test('the legal pages and HQ read the same Last updated date', () => {
  const was = process.env.LEGAL_EFFECTIVE_DATE;
  const { legalDate, legalDateText } = require('../lib/legal-date');
  try {
    process.env.LEGAL_EFFECTIVE_DATE = '2026-11-02';
    assert.equal(legalDate(), '2026-11-02');
    assert.equal(legalDateText(), 'November 2, 2026');
    for (const bad of ['', 'Nov 2', '2026-11-2']) {
      process.env.LEGAL_EFFECTIVE_DATE = bad;
      assert.equal(legalDate(), '2026-10-16');
      assert.equal(legalDateText(), 'October 16, 2026');
    }
  } finally {
    if (was === undefined) delete process.env.LEGAL_EFFECTIVE_DATE;
    else process.env.LEGAL_EFFECTIVE_DATE = was;
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /const legalEffectiveDate = legalDates\.legalDateText;/);
  assert.match(src, /res\.locals\.legalEffectiveDate = legalEffectiveDate\(\);/);
});
