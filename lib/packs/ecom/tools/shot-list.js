// Product photo shot list: the photos one product needs, in upload order, with why each one matters,
// how to take it with a phone and the file name to save it as, plus a one-window setup and a printable
// checklist. Our own list (data/shots.json), no outside service.

const { views, save, files, text } = require('../../_kit');
const U = require('../lib/util');
const SH = require('../data/shots.json');

const { plain, slug } = text;

module.exports = {
  name: 'ecom.shot_list',
  title: 'Make a shot list',
  description: 'The photos one product needs, in upload order: why each one matters, how to take it with a phone, the file name to use, a one-window setup and a printable checklist.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['product'],
    properties: {
      product: { type: 'string', maxLength: 80, title: 'Product' },
      kind: { type: 'string', enum: Object.keys(SH.kinds), default: 'other', title: 'What kind of product', description: Object.entries(SH.kinds).map(([k, v]) => `${k}: ${v.label}`).join('. ') },
      variants: { type: 'string', maxLength: 300, title: 'Colors or sizes (optional)', description: 'Comma separated, like "sage, sand, charcoal"' },
      color: { type: 'string', maxLength: 7, title: 'Brand color (optional)' },
    },
  },
  output: { type: 'object', required: ['shots', 'setup'], properties: { product: { type: 'string' }, kind: { type: 'string' }, shots: { type: 'array' }, setup: { type: 'array' }, watch: { type: 'string' }, sizes: { type: 'string' }, page: { type: 'object' }, csv: { type: 'object' } } },
  async run(input, ctx) {
    const product = plain(input.product);
    const k = SH.kinds[input.kind] ? input.kind : 'other';
    const kind = SH.kinds[k];
    const variants = String(input.variants || '').split(',').map((x) => plain(x)).filter(Boolean).slice(0, 12);
    const list = [...SH.base.slice(0, 4), ...kind.extra, ...SH.base.slice(4)].filter((s) => s.id !== 'variants' || variants.length > 1);
    const base = slug(product, 40) || 'product';
    const shots = list.map((s, i) => ({
      n: i + 1,
      shot: s.shot,
      why: s.why,
      how: s.id === 'variants' ? `${s.how} Colors or sizes: ${variants.join(', ')}.` : s.how,
      file: `${base}-${String(i + 1).padStart(2, '0')}-${s.id}.jpg`,
    }));
    const e = U.esc;
    const body = `<div class="band"><h1>${e(product)}: shot list</h1><p>${e(kind.label)}. Shoot them in this order and upload them in this order.</p></div>
<h2>Setup</h2><ul class="checks">${U.li(SH.setup)}</ul>
<h2>Shots</h2>${shots.map((s) => `<div class="card"><h3>${s.n}. ${e(s.shot)}</h3><p>${e(s.why)}</p><p class="small"><b>How:</b> ${e(s.how)}</p><p class="small muted">Save as ${e(s.file)}</p></div>`).join('')}
<h2>Watch for</h2><p>${e(kind.watch)}</p><p class="small muted">${e(SH.sizes)}</p>`;
    const page = await save.saveFile(ctx, save.fileName(product, 'shot list', '.html'), U.page({ title: `${product} shot list`, seed: input.color, body }));
    const csv = await save.saveFile(ctx, save.fileName(product, 'shot list', '.csv'), files.csv(shots.map((s) => ({ ...s, done: '' })), [
      { key: 'n', label: '#' },
      { key: 'shot', label: 'Shot' },
      { key: 'why', label: 'Why' },
      { key: 'how', label: 'How' },
      { key: 'file', label: 'Save as' },
      { key: 'done', label: 'Done' },
    ]));
    return { product, kind: kind.label, shots, setup: SH.setup, watch: kind.watch, sizes: SH.sizes, page, csv };
  },
  view(out) {
    return views.blocks(
      views.metric('Shot list', `${out.shots.length} photos`, `${out.product}, ${out.kind.toLowerCase()}`),
      views.table([{ key: 'n', label: '#' }, { key: 'shot', label: 'Shot' }, { key: 'why', label: 'Why' }, { key: 'file', label: 'Save as' }], out.shots),
      views.text(`Setup: ${out.setup.join(' ')}`),
      views.text(`${out.watch} ${out.sizes}`),
      views.file(out.page, 'Printable shot list (HTML)'),
      views.file(out.csv, 'Checklist (CSV)'),
    );
  },
};
