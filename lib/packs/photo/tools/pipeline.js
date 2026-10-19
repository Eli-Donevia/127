// The Pipeline tools for photography: find the business, log what happened, answer replies, the call
// sheet, a new client's kickoff, next month, the month-end report and the next batch. Built from the
// shared _kit/b2b.js with lib/config.js.

const { makeTools } = require('../../_kit/b2b');

const t = makeTools(require('../lib/config'));

module.exports = [t.pick, t.log, t.logSample, t.answer, t.callSheet, t.start, t.keep, t.month, t.fresh, t.save];
