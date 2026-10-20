// What every numbers tool shares: the files input, the line about where the numbers came from, and
// the sample note.

const T = require('./table');

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';

const FILES = {
  type: 'array',
  items: { type: 'string', format: 'asset' },
  accept: ACCEPT,
  maxItems: 12,
  title: 'Your exports (CSV)',
  description: 'Any of: Stripe payments or balance, Shopify orders, Square transactions, PayPal activity, Meta Ads or Google Ads report, Instagram or TikTok post stats, or a sheet with date, metric, value. Leave it empty to try a sample business.',
};

const TYPES = ['Not sure', 'Online store or product seller', 'Local service (cleaning, detailing, lawn, repairs)', 'Creator or UGC', 'Coaching, courses or digital products', 'Maker, food or market seller', 'Something else'];
const TYPE = { type: 'string', title: 'Your kind of business', enum: TYPES, default: 'Not sure' };
const TARGETS = { type: 'string', format: 'textarea', maxLength: 2000, title: 'Your targets (optional)', description: 'One per line, your own numbers, like "Sales 400 a day", "Orders 50 a week", "Refund rate under 3%", "Cost per result 12".' };

const SAMPLE_NAME = 'Juniper Lane Candles';

function shortRange(a, b) {
  if (!a) return '';
  const f = (d) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  };
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
}

// [{ label, name, from, to, rows }] for outputs and the "Read from" line.
const sources = (d) => d.files.map((f) => ({ label: f.label, name: f.name, from: f.from, to: f.to, rows: f.rows }));
const sourcesLine = (d) => `Read from ${d.files.map((f) => `${f.label}${f.from ? ` (${shortRange(f.from, f.to)})` : ''}`).join(', ')}.`;
const sampleLine = `This is a made-up sample business, ${SAMPLE_NAME}, with its dates moved so its last day is yesterday. Add your own exports to see your numbers.`;
const privacyLine = 'Only the numbers, dates, product names and post captions in your files are used. Customer names, emails and addresses are skipped when the file is read and never kept.';

const OUT_COMMON = {
  sources: { type: 'array' },
  notes: { type: 'array' },
  sample: { type: 'boolean' },
};

function dayCount(a, b) {
  return a && b ? T.daysBetween(a, b) + 1 : 0;
}

module.exports = { FILES, TYPE, TYPES, TARGETS, ACCEPT, SAMPLE_NAME, sources, sourcesLine, sampleLine, privacyLine, shortRange, OUT_COMMON, dayCount };
