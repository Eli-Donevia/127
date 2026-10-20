// The numbers skill: a ZIP with SKILL.md and its reference files that the member adds to their own
// Claude (Customize, Skills, Upload a skill), so their daily numbers report runs the same way every
// time, with their scorecard and targets written in. Pure code; nothing is sent anywhere.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const S = require('../lib/skill');
const EXPORTS = require('../data/exports.json');

module.exports = {
  name: 'kpi.numbers_skill',
  title: 'Make your numbers skill',
  description: "Writes a Claude skill (SKILL.md plus reference files, zipped) with the member's scorecard, targets, time zone and the exports they use, so their own Claude runs the daily numbers report the same way each time.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      files: { ...C.FILES, description: 'Optional: the exports you use, so the skill only explains those. Leave it empty to include every export it can read.' },
      type: C.TYPE,
      targets: C.TARGETS,
      time: { type: 'string', title: 'When you check your numbers (optional)', maxLength: 40, description: 'Like "7am"' },
    },
  },
  output: {
    type: 'object',
    properties: { name: { type: 'string' }, description: { type: 'string' }, skill: { type: 'string' }, zip: { type: 'object' }, md: { type: 'object' }, metrics: { type: 'array' }, steps: { type: 'array' }, ...C.OUT_COMMON },
    required: ['name', 'skill', 'zip', 'md', 'steps', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const sc = R.scorecard(ctx, d.led, input);
    const biz = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || '';
    const kinds = d.sample ? [] : d.files.map((f) => f.kind);
    const built = S.build({ business: biz, firstName: d.sample ? '' : (ctx.member && ctx.member.firstName) || '', timezone: (ctx.member && ctx.member.timezone) || 'America/Chicago', metrics: sc.metrics, targets: sc.targets, kinds, time: input.time || '' });
    const zipFile = await save.saveFile(ctx, `${built.name}.zip`, files.zip(built.files, { mtime: typeof ctx.now === 'function' ? ctx.now() : Date.now() }));
    const mdFile = await save.saveFile(ctx, `${built.name}-SKILL.md`, built.md);
    const steps = [`Download ${built.name}.zip.`, EXPORTS.skill.how, `Turn it on, then in a new chat add yesterday's exports and ask Claude for "my daily numbers".`, 'Changed your scorecard or targets in 127? Make the skill again and upload the new ZIP in place of the old one.'];
    ctx.log(`Wrote ${built.name} with ${sc.metrics.length} numbers.`);
    return { name: built.name, description: built.description, skill: built.md, zip: zipFile, md: mdFile, metrics: sc.metrics.map((m) => m.label), steps, sources: C.sources(d), notes: d.notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('Sample run: this skill is written for the made-up sample business. Run it with your exports, or after "Set up my scorecard", to get yours.') : null,
      views.text(`Your skill "${out.name}" runs your daily numbers report with these numbers: ${out.metrics.join(', ')}.`),
      views.cards(out.steps.map((s, i) => ({ title: `Step ${i + 1}`, body: s }))),
      views.file(out.zip, 'Your numbers skill (ZIP to upload to Claude)'),
      views.copy('SKILL.md', out.skill),
      views.file(out.md, 'SKILL.md on its own')
    );
  },
};
