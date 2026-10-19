// The Pipeline tools for web design (shared code in _kit/b2b.js, web design words in lib/config.js):
// find a business, log what happened, note the free sample, answer a reply, the call sheet, start a
// client, keep them, the month-end report, skip known businesses and save the next batch.

const { makeTools } = require('../../_kit/b2b');

const t = makeTools(require('../lib/config'));

module.exports = [t.pick, t.log, t.logSample, t.answer, t.callSheet, t.start, t.keep, t.month, t.fresh, t.save];
