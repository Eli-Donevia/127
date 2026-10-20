// Turns a spreadsheet the member saves as CSV into a search app: type a few letters, see the rows
// that match, tap one to copy it. The data goes inside the file, so it works with no connection.

const fs = require('fs');
const path = require('path');
const { text } = require('../../_kit');
const S = require('../lib/starters');
const { factsOf } = require('../lib/facts');
const { parseCsv } = require('../lib/csv');
const { deliver, appView, APP_OUTPUT } = require('../lib/deliver');

const SAMPLE = path.join(__dirname, '..', 'sample', 'parts.csv');
const MAX_IN = 3 * 1024 * 1024;
const MAX_APP = 1500 * 1024;
const MAX_ROWS = 5000;
const MAX_COLS = 12;

module.exports = {
  name: 'tools.csv_lookup',
  title: 'Spreadsheet search app',
  description: 'Turns a spreadsheet saved as CSV (a price list, parts list, client list or codes) into a one-file search app that works offline: type to filter, pick a column, tap a row to copy it.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', title: 'Your spreadsheet (CSV)' },
      title: { type: 'string', title: 'App title (optional)', maxLength: 60 },
      columns: { type: 'string', title: 'Columns to show (optional)', description: 'Column names separated by commas. Leave empty for the first 12.', maxLength: 600 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 80 },
      color: { type: 'string', title: 'Brand color (optional)', maxLength: 30 },
    },
  },
  output: APP_OUTPUT,
  async run(input, ctx) {
    let raw;
    let source;
    let sample = false;
    if (input.file) {
      const a = await ctx.asset(input.file);
      if (a.bytes > MAX_IN) throw new Error('That file is over 3 MB. Save just the columns and rows you need as a CSV and try again.');
      raw = fs.readFileSync(a.path, 'utf8');
      source = a.name || 'your spreadsheet';
      if (/^PK/.test(raw) || /\.xlsx?$/i.test(source)) throw new Error('That looks like an Excel file. In Excel or Google Sheets use File, then Download or Save as, then CSV, and upload that.');
    } else {
      raw = fs.readFileSync(SAMPLE, 'utf8');
      source = 'a sample parts list';
      sample = true;
    }
    const parsed = parseCsv(raw, { maxRows: MAX_ROWS });
    if (!parsed.rows.length) throw new Error("That file has no rows under the header. Check it opens in a spreadsheet, then save it as CSV again.");
    let idx = parsed.columns.map((c, i) => i);
    if (input.columns) {
      const want = String(input.columns).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const hit = parsed.columns.map((c, i) => [c.toLowerCase(), i]).filter(([c]) => want.some((w) => c === w || c.includes(w))).map(([, i]) => i);
      if (hit.length) idx = hit;
    }
    idx = idx.slice(0, MAX_COLS);
    const columns = idx.map((i) => text.clip(parsed.columns[i], 40));
    let rows = parsed.rows.map((r) => idx.map((i) => text.clip(r[i], 200)));
    // Keep the app under its size cap: fewer rows, never a broken file.
    while (rows.length > 50 && Buffer.byteLength(JSON.stringify(rows)) > MAX_APP - 40 * 1024) rows = rows.slice(0, Math.floor(rows.length * 0.8));
    const facts = factsOf(ctx, input);
    const name = text.clip(input.title || `${text.titleCase(String(source).replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' '))} lookup`, 60);
    const r = S.render('lookup', facts, { title: name, columns, rows, source: sample ? source : text.clip(source, 60) });
    const notes = [`${rows.length} rows and ${columns.length} columns from ${source}.`];
    if (rows.length < parsed.rows.length || parsed.truncated) notes.push(`The file had more rows than fit in one app, so it holds the first ${rows.length}. Split the sheet into smaller files for the rest.`);
    if (parsed.columns.length > columns.length) notes.push(`Showing ${columns.length} of ${parsed.columns.length} columns. Name the columns you want to change which.`);
    if (sample) notes.push('No file was added, so this uses a sample parts list. Add your own CSV to make yours.');
    ctx.log(notes[0]);
    return deliver(ctx, r.html, { business: facts.business, title: r.title, starter: 'lookup', notes, sample, maxBytes: MAX_APP });
  },
  view: (out) => appView(out, 'Your search app'),
};
