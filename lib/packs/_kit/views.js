// View blocks for tool.view(output) (harness contract section 10). HQ draws them on the run page,
// the finished summary and the Library; Claude and ChatGPT get a text version. Helpers keep the
// shapes exact and the text plain.

const { plain } = require('./text');

const metric = (label, value, note) => ({ type: 'metric', label: plain(label), value: typeof value === 'number' ? value : plain(value), ...(note ? { note: plain(note) } : {}) });
const text = (t) => ({ type: 'text', text: plain(t) });
// columns: [{ key, label, format: 'number' | 'money' | 'percent' | 'link' }]
const table = (columns, rows, limit) => ({ type: 'table', columns, rows: rows || [], ...(limit ? { limit } : {}) });
// items: [{ title, subtitle, body, image, badge, href }]
const cards = (items) => ({ type: 'cards', items: (items || []).map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, typeof v === 'string' && k !== 'href' ? plain(v) : v]))) });
const copy = (label, t, email) => ({ type: 'copy', label: plain(label), text: String(t == null ? '' : t), ...(email ? { email } : {}) });
const file = (asset, label) => (asset ? { type: 'file', asset, label: plain(label || asset.name || 'File') } : null);
const image = (asset, caption) => (asset ? { type: 'image', asset, ...(caption ? { caption: plain(caption) } : {}) } : null);
const video = (asset, caption) => (asset ? { type: 'video', asset, ...(caption ? { caption: plain(caption) } : {}) } : null);
const link = (label, href) => (/^https:\/\//.test(String(href || '')) ? { type: 'link', label: plain(label), href } : null);

// Drops nulls so a view can list optional blocks inline.
const blocks = (...items) => items.flat().filter(Boolean);

// The "Sample data" note HQ also shows on the step; handy at the top of a view.
// Plural labels get a plural verb: "These businesses use sample data", "Your prices use ...".
// Pass { plural: true } or { plural: false } when the label can't tell (e.g. "This news").
const PLURAL_FIRST = new Set(['these', 'those', 'both', 'all', 'some', 'many', 'several']);
const SINGULAR_FIRST = new Set(['this', 'that', 'it', 'each', 'every', 'one', 'a', 'an']);
const isPlural = (what) => {
  const words = String(what || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (PLURAL_FIRST.has(words[0])) return true;
  if (SINGULAR_FIRST.has(words[0])) return false;
  const last = words[words.length - 1].replace(/[^a-z]/g, '');
  return /s$/.test(last) && !/(ss|us|is)$/.test(last);
};
const sampleNote = (out, what = 'This', opts = {}) => {
  if (!(out && out.sample)) return null;
  const plural = typeof opts.plural === 'boolean' ? opts.plural : isPlural(what);
  return text(`${what} ${plural ? 'use' : 'uses'} sample data until the data source is connected.`);
};

module.exports = { metric, text, table, cards, copy, file, image, video, link, blocks, sampleNote };
