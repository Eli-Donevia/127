// "Pick one" decision page: two to four ideas side by side on the member's own ratings (1 to 5) and
// counts from their conversations, weighted toward what people did (had the problem, committed) over
// what the member hopes. One printable page with the pick and what to park for 30 days. It scores what
// the member typed; it doesn't predict how any business does. Code only.

const { views, save, time, text, brain } = require('../../_kit');
const U = require('../lib/util');

const { plain } = text;
const { esc } = U;

// Weights: evidence from people counts most. `full`: the count that already earns full points (15 of
// 25 with the problem, 5 commitments), so a few real commitments outweigh a high rating.
const ROWS = [
  { key: 'problem', label: 'People had the problem lately (of 25)', weight: 3, max: 25, full: 15 },
  { key: 'committed', label: 'People committed (of 25)', weight: 4, max: 25, full: 5 },
  { key: 'cost', label: 'Cheap to start (1 to 5)', weight: 1, max: 5 },
  { key: 'time', label: 'Fits your hours (1 to 5)', weight: 1, max: 5 },
  { key: 'enjoy', label: 'You would enjoy doing it for a year (1 to 5)', weight: 2, max: 5 },
];

function ideasOf(v) {
  // "Meal prep for nurses | 9 | 3 | 4 | 3 | 4" (name | had problem | committed | cheap | hours | enjoy)
  return String(v || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 4).map((l) => {
    const [name, ...nums] = l.split(/\s*\|\s*/);
    const vals = Object.fromEntries(ROWS.map((r, i) => {
      const n = Number(String(nums[i] == null ? '' : nums[i]).replace(/[^\d.]/g, ''));
      return [r.key, Number.isFinite(n) && String(nums[i] || '').trim() !== '' ? Math.min(r.max, Math.max(0, n)) : null];
    }));
    return { name: plain(name).slice(0, 80), ...vals };
  }).filter((x) => x.name);
}

module.exports = {
  name: 'idea.pick_one',
  title: 'Pick one idea',
  description: 'Two to four ideas side by side on your own counts and ratings, weighted toward what people did. A printable decision page with the one to go with and the ones to park for 30 days.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['ideas'],
    properties: {
      ideas: { type: 'string', format: 'textarea', maxLength: 1200, title: 'Your ideas, one per line', description: 'idea | had the problem (of 25) | committed (of 25) | cheap to start 1-5 | fits your hours 1-5 | you would enjoy it 1-5. Leave a number empty if you don\'t know it yet.' },
      color: { type: 'string', maxLength: 7, title: 'Your color (optional)' },
    },
  },
  output: { type: 'object', required: ['ideas', 'pick'], properties: { ideas: { type: 'array' }, pick: { type: ['object', 'null'] }, park: { type: 'array' }, gaps: { type: 'array' }, note: { type: 'string' }, file: { type: 'object' } } },
  async run(input, ctx) {
    const ideas = ideasOf(input.ideas);
    if (ideas.length < 2) throw new Error('Add at least two ideas, one per line, like "Meal prep for nurses | 9 | 3 | 4 | 3 | 4".');
    const scored = ideas.map((x) => {
      const total = ROWS.reduce((s, r) => s + (x[r.key] == null ? 0 : (Math.min(x[r.key], r.full || r.max) / (r.full || r.max)) * r.weight * 10), 0);
      const known = ROWS.filter((r) => x[r.key] != null).length;
      return { ...x, score: Math.round(total), known };
    }).sort((a, b) => b.score - a.score || b.known - a.known);
    const gaps = scored.filter((x) => x.problem == null || x.committed == null).map((x) => `${x.name}: no conversation counts yet. Run Your first 25 conversations for it before you choose.`);
    const tie = scored.length > 1 && scored[0].score - scored[1].score <= 3;
    const pick = { name: scored[0].name, score: scored[0].score, why: tie ? 'Close call with the next one: pick the one you would still do on a bad week, and test it for 7 days.' : 'Highest on what people did and what you rated.' };
    const park = scored.slice(1).map((x) => x.name);
    const note = 'This adds up what you typed, weighted toward what people did. It does not predict how a business does. Go with one for 30 days, then look again.';
    const head = `<tr><th></th>${scored.map((x) => `<th>${esc(x.name)}</th>`).join('')}</tr>`;
    const rows = ROWS.map((r) => `<tr><td>${esc(r.label)}<br><span class="muted small">counts x${r.weight}</span></td>${scored.map((x) => `<td class="n">${x[r.key] == null ? '<span class="blank"></span>' : esc(String(x[r.key]))}</td>`).join('')}</tr>`).join('');
    const tot = `<tr><th>Total</th>${scored.map((x) => `<th class="n">${x.score}</th>`).join('')}</tr>`;
    const body = [
      `<div class="band"><h1>Going with: ${esc(pick.name)}</h1><p>${esc(pick.why)}</p></div>`,
      `<div class="wrap"><table>${head}${rows}${tot}</table></div>`,
      park.length ? `<h2>Parked for 30 days</h2><ul>${U.li(park)}</ul>` : '',
      gaps.length ? `<h2>Missing</h2><ul>${U.li(gaps)}</ul>` : '',
      `<h2>Next 7 days</h2><ul class="checks">${U.li([`Plan a 7-day test for ${pick.name}`, 'Send your first 25 notes', 'Score it at the end of the week'])}</ul>`,
      `<p class="muted small">${esc(note)} ${esc(time.longDate(time.today(ctx)))}</p>`,
    ].join('\n');
    const html = U.page({ title: `Pick one: ${pick.name}`, seed: input.color, body, description: 'Idea decision page' });
    const file = await save.saveFile(ctx, save.fileName(pick.name, 'pick one', time.today(ctx), '.html'), html);
    await brain.remember(ctx, 'idea', pick.name);
    return { ideas: scored, pick, park, gaps, note, file };
  },
  view(out) {
    return views.blocks(
      views.metric('Pick one', out.pick ? out.pick.name : 'Add ideas', out.pick ? out.pick.why : ''),
      views.table([{ key: 'name', label: 'Idea' }, { key: 'problem', label: 'Had problem' }, { key: 'committed', label: 'Committed' }, { key: 'cost', label: 'Cheap' }, { key: 'time', label: 'Hours' }, { key: 'enjoy', label: 'Enjoy' }, { key: 'score', label: 'Total' }], out.ideas.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v == null ? '' : v])))),
      out.gaps.length ? views.text(out.gaps.join(' ')) : null,
      views.text(out.note),
      views.file(out.file, 'Decision page (printable)'),
    );
  },
};
