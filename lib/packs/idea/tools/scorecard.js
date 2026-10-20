// Results scorecard: reads the member's conversation log (the first-25 CSV filled in, any CSV with
// the same columns, or pasted lines) and counts who had the problem lately, who already spends time
// or money on it, who committed and who made an intro, against the bar they set. The read-out says
// what the numbers mean for the next step; it never says the idea will or won't work. Code only.

const { views, save, files, time, text, brain } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/idea');

const { plain } = text;

module.exports = {
  name: 'idea.scorecard',
  title: 'Score your conversations',
  description: 'Counts who had the problem lately, who already spends on it, who committed and who made an intro, from your conversation log, against the bar you set. Says what to do next.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', accept: '.csv,text/csv', title: 'Your conversation log (CSV, optional)', description: 'The log from Your first 25, filled in with yes or no' },
      rows: { type: 'string', format: 'textarea', maxLength: 6000, title: 'Or paste one line per person (optional)', description: 'name | had the problem | already spends | committed | intro | notes. Like "Dana | yes | yes | no | yes | redid her schedule twice last week"' },
      idea: { type: 'string', maxLength: 140, title: 'Your idea (optional)' },
      bar_problem: { type: 'integer', minimum: 1, maximum: 25, default: 8, title: 'Your bar: had the problem lately' },
      bar_commit: { type: 'integer', minimum: 1, maximum: 25, default: 3, title: 'Your bar: committed' },
    },
  },
  output: { type: 'object', required: ['talked', 'counts', 'read'], properties: { idea: { type: 'string' }, source: { type: 'string' }, talked: { type: 'integer' }, counts: { type: 'array' }, bar: { type: 'object' }, read: { type: 'string' }, next: { type: 'array' }, quotes: { type: 'array' }, file: { type: 'object' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    let rows = [];
    let source = '';
    if (input.file) {
      const up = await U.readUpload(ctx, input.file);
      rows = K.logRows(up.text);
      source = `From your file, ${up.name}.`;
    } else if (String(input.rows || '').trim()) {
      rows = K.pastedRows(input.rows);
      source = 'From the lines you pasted.';
    }
    const sample = !rows.length;
    if (sample) {
      rows = K.pastedRows('Dana (sample) | yes | yes | yes | yes | Cooks at 9pm after shifts, orders takeout 3 nights a week\nMarcus (sample) | yes | yes | no | yes | Buys frozen meals, hates them\nPriya (sample) | no | no | no | no | Her partner cooks\nTom (sample) | yes | no | no | no | Eats at the hospital cafeteria\nGrace (sample) | yes | yes | yes | no | Asked when she can start\nKwame (sample) | no | no | no | yes | Knows two nurses who might\nHannah (sample) | yes | yes | no | no | Tried a meal kit, too much cooking');
      source = 'From a made-up sample log, not yours. Paste your lines or add your log CSV.';
    }
    const bar = { problem: Math.max(1, Number(input.bar_problem) || 8), commit: Math.max(1, Number(input.bar_commit) || 3) };
    const n = rows.length;
    const had = rows.filter((r) => r.had).length;
    const spent = rows.filter((r) => r.spent).length;
    const committed = rows.filter((r) => r.committed).length;
    const intro = rows.filter((r) => r.intro).length;
    const scale = (x) => (n >= 25 ? x : Math.ceil((x * n) / 25));
    const barNow = { problem: scale(bar.problem), commit: scale(bar.commit) };
    const counts = [
      { what: 'Had the problem lately', count: had, of: n, bar: barNow.problem, met: had >= barNow.problem },
      { what: 'Already spend time or money on it', count: spent, of: n },
      { what: 'Committed (pre-order, deposit, booking or sign-up)', count: committed, of: n, bar: barNow.commit, met: committed >= barNow.commit },
      { what: 'Made an intro to someone else', count: intro, of: n },
    ];
    let read;
    let next;
    if (n < 10) {
      read = `${n} conversations so far: too few to read. Keep going to at least 15 before you decide anything.`;
      next = ['Send the rest of your first 25 notes.', 'Ask everyone you talk to who else has the problem.'];
    } else if (had >= barNow.problem && committed >= barNow.commit) {
      read = 'You met both parts of your bar: people have the problem now and some committed. That is a reason to run a small paid test, not proof of a business.';
      next = ['Deliver to the people who committed, at your price, and do it well.', 'Ask each one afterwards what to change.', 'Open the business pack that fits and run its Your first 25.'];
    } else if (had >= barNow.problem) {
      read = 'People have the problem, but fewer committed than your bar. The offer, the price or the who may be off.';
      next = ['Re-read their words and redraft the offer in them.', 'Ask the ones who spend money on it now what they pay and what they wish was different.', 'Try 10 more conversations with a narrower who.'];
    } else {
      read = 'Fewer people had the problem lately than your bar. Change the who or the problem before you build anything.';
      next = ['Look at the notes: which problem came up that you didn\'t expect?', 'Pick a narrower who, or test your next idea.', 'Run Find ideas that fit you if you want other options.'];
    }
    const quotes = rows.filter((r) => r.notes).slice(0, 8).map((r) => ({ name: r.name, words: r.notes }));
    const csv = await save.saveFile(ctx, save.fileName(m.idea, 'scorecard', time.today(ctx), '.csv'), files.csv([...counts.map((c) => ({ what: c.what, count: c.count, of: c.of, bar: c.bar == null ? '' : c.bar, met: c.met == null ? '' : c.met ? 'yes' : 'no' })), { what: read }], [
      { key: 'what', label: 'Signal' },
      { key: 'count', label: 'Count' },
      { key: 'of', label: 'Of' },
      { key: 'bar', label: 'Your bar' },
      { key: 'met', label: 'Met' },
    ]));
    if (!sample) await brain.remember(ctx, 'last_score', { idea: plain(m.idea).slice(0, 140), talked: n, had, spent, committed, intro, on: time.today(ctx) });
    return { idea: m.idea, source, talked: n, counts, bar: barNow, read, next, quotes, file: csv, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.metric('Scorecard', `${out.talked} conversations`, `${out.idea}. ${out.source}`),
      views.table([{ key: 'what', label: 'Signal' }, { key: 'count', label: 'Count' }, { key: 'bar', label: 'Your bar' }, { key: 'met', label: 'Met' }], out.counts.map((c) => ({ ...c, bar: c.bar == null ? '' : c.bar, met: c.met == null ? '' : c.met ? 'Yes' : 'Not yet' }))),
      views.text(out.read),
      views.text(`Next: ${out.next.join(' ')}`),
      out.quotes.length ? views.table([{ key: 'name', label: 'Who' }, { key: 'words', label: 'Their words' }], out.quotes) : null,
      views.text('Your bar is scaled to the number of conversations you had (it was set for 25).'),
      views.file(out.file, 'Scorecard (CSV)'),
    );
  },
};
