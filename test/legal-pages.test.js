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
