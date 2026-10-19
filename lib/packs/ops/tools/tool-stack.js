// Picks one tool per job for how the member sells (local service, online service, physical or
// digital products) and saves a one-page stack with the free plan, the first paid plan, the
// checked date and the source for every line. Code only: no AI, 1 credit.

const { views, save, text, brain } = require('../../_kit');
const S = require('../lib/stack');
const { page, esc, accentFor } = require('../lib/page');

function html(out, accent) {
  const rows = out.rows.map((r) => `<tr><td><b>${esc(r.job)}</b></td><td><a href="${esc(r.url)}">${esc(r.tool)}</a>${r.freeStart ? ' <span class="free">Free to start</span>' : ''}</td><td>${esc(r.start)}</td><td>${esc(r.upgrade)}</td><td>${esc(r.alt || '')}</td></tr>`).join('');
  const order = out.firstWeek.map((s) => `<li>${esc(s)}</li>`).join('');
  const body = `<div class="meta"><span>${esc(S.MODELS[out.model].label)}</span><span>${out.rows.length} tools</span><span>${out.freeCount} free to start</span><span>Prices checked ${esc(out.checked)}</span></div>
<h2>One tool per job</h2>
<table><tr><th>Job</th><th>Use</th><th>To start</th><th>When you outgrow it</th><th>Or try</th></tr>${rows}</table>
<h2>Set it up this week</h2><div class="card"><ul class="plain">${order}</ul></div>
<h2>Rules for your stack</h2><div class="card"><ul class="plain">
<li>Stay on free plans until a limit actually stops you, then upgrade that one tool.</li>
<li>Use one email login for every tool and save it in your password manager.</li>
<li>Card fees come out of each payment. Put them in your price, not on the customer's receipt.</li>
</ul></div>
<footer>Prices were read on each tool's own pricing page on ${esc(out.checked)} and change often. Open the link before you pay. Sources: ${out.rows.map((r) => esc(r.source.replace(/^https:\/\//, '').split('/')[0])).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.</footer>`;
  return page({ title: `${out.business || 'Your'} starter stack`, kicker: 'Ops desk', h1: out.business ? `${out.business} starter stack` : 'Your starter stack', lede: `For ${out.what || S.MODELS[out.model].label.toLowerCase()}: ${S.MODELS[out.model].about}. One tool for each job, free where it can be.`, body, accent, description: 'Starter tools with prices, checked dates and sources' });
}

module.exports = {
  name: 'ops.tool_stack',
  title: 'Starter tool stack',
  description: 'Picks one tool for each job (bookings, payments, domain, email, books, design, passwords) for how you sell, with the free plan, the first paid plan, the date we checked and the source.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What do you sell?', maxLength: 200 },
      model: { type: 'string', title: 'How you sell', enum: ['auto', 'local', 'service', 'products', 'digital'], default: 'auto' },
      budget: { type: 'string', title: 'Budget for tools', enum: ['free', 'some'], default: 'free' },
    },
  },
  output: { type: 'object', properties: { model: { type: 'string' }, rows: { type: 'array' }, page: { type: 'object' }, csv: { type: 'object' } }, required: ['model', 'rows'] },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const what = text.oneLine(input.what || b.what || b.niche || '');
    const model = input.model && input.model !== 'auto' ? input.model : S.modelFor(`${what} ${b.niche || ''}`);
    const rows = S.stackFor(model, { budget: input.budget || 'free' });
    const firstWeek = rows.slice(0, 5).map((r, i) => `Day ${i + 1}: ${r.job.replace(/ \(later\)$/, '')}. Set up ${r.tool}${r.freeStart ? ' on the free plan' : ''}.`);
    const out = { model, modelLabel: S.MODELS[model].label, what, business: b.name, rows, firstWeek, freeCount: rows.filter((r) => r.freeStart).length, checked: rows[0].checked };
    const name = b.name || 'my';
    out.page = await save.saveFile(ctx, save.fileName(name, 'starter-stack', '.html'), html(out, accentFor(ctx)));
    out.csv = await save.saveFile(ctx, save.fileName(name, 'starter-stack', '.csv'), require('../../_kit').files.csv(rows, [
      { key: 'job', label: 'Job' }, { key: 'tool', label: 'Tool' }, { key: 'start', label: 'To start' }, { key: 'upgrade', label: 'Upgrade' }, { key: 'alt', label: 'Or try' }, { key: 'url', label: 'Link' }, { key: 'source', label: 'Price source' }, { key: 'checked', label: 'Checked' },
    ], { bom: true }));
    ctx.log(`Picked ${rows.length} tools for a ${out.modelLabel.toLowerCase()} business, ${out.freeCount} free to start`);
    return out;
  },
  view(out) {
    return views.blocks(
      views.metric('Tools', out.rows.length, out.modelLabel),
      views.metric('Free to start', out.freeCount),
      views.table([{ key: 'job', label: 'Job' }, { key: 'tool', label: 'Use' }, { key: 'start', label: 'To start' }, { key: 'upgrade', label: 'When you outgrow it' }], out.rows),
      views.text(out.firstWeek.join(' ')),
      views.file(out.page, 'Starter stack (print or save as PDF)'),
      views.file(out.csv, 'Starter stack spreadsheet (.csv)'),
      views.text(`Prices checked ${out.checked} on each tool's pricing page. Open the link before you pay.`)
    );
  },
};
