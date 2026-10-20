// The daily ad check (Legal D9, D10): suggestions from the member's own results export, and the same
// check as a skill for their own Claude. Suggestions only; nothing is applied anywhere.

const fs = require('fs');
const path = require('path');
const { text, views, save, files, money, brain } = require('../../_kit');
const A = require('../lib/ads');
const O = require('../lib/optimize');
const S = require('../lib/skill');
const LINES = require('../data/screen-lines.json');
const { page, esc } = require('../lib/page');
const { NUM_INPUTS } = require('./desk');

const SAMPLE = path.join(__dirname, '..', 'sample', 'results-daily.csv');
const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';
const RESULT_IS = ['Leads (people who asked)', 'Sales (people who paid)'];

const INPUTS = {
  file: { type: 'string', format: 'asset', accept: ACCEPT, title: 'Your results export (CSV, optional)', description: 'From Meta Ads Manager, Google Ads or TikTok Ads Manager, broken down by day. Leave it empty to use the last one you added.' },
  csv: { type: 'string', format: 'textarea', title: 'Or paste it here (optional)', maxLength: 200000 },
  resultIs: { type: 'string', title: 'A "result" in your export is', enum: RESULT_IS, default: RESULT_IS[0] },
  price: NUM_INPUTS.price,
  cost: NUM_INPUTS.cost,
  jobs30: NUM_INPUTS.jobs30,
  closeRate: NUM_INPUTS.closeRate,
};

async function readInput(input, ctx) {
  if (input.file) {
    const a = await ctx.asset(input.file);
    if (!a || !a.path) throw new Error("That file didn't open. Export it again as CSV and add it.");
    return { text: fs.readFileSync(a.path, 'utf8'), from: a.name || 'your export' };
  }
  if (String(input.csv || '').trim()) return { text: String(input.csv), from: 'what you pasted' };
  return null;
}

const suggestChanges = {
  name: 'ads.suggest_changes',
  title: 'Suggest ad changes',
  description: "Reads your results export from Meta, Google or TikTok and suggests, ad by ad, what to turn off, keep, raise, move budget to or refresh with a new creative when people tire of it (frequency up, click rate down). Each suggestion shows the rule, the numbers and what it does to spend, against your own max cost per customer. Suggestions only: you make each change yourself.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  input: { type: 'object', properties: INPUTS },
  output: {
    type: 'object',
    properties: {
      network: { type: 'string' },
      from: { type: 'string' },
      suggestions: { type: 'array' },
      ads: { type: 'integer' },
      days: { type: 'integer' },
      numbers: { type: 'object' },
      files: { type: 'array' },
      sample: { type: 'boolean' },
    },
    required: ['suggestions', 'files', 'sample'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const n = A.numbers(f, { ...input, outreachCustomers: 3 });
    const resultIs = input.resultIs === RESULT_IS[1] ? 'sale' : 'lead';
    let rows = [];
    let network = 'Ads';
    let from = '';
    let sample = false;
    const given = await readInput(input, ctx);
    if (given) {
      const r = O.readExport(given.text);
      if (!r.rows.length) throw new Error("That file doesn't look like an ads export. It needs an ad or campaign name, spend and impressions: export it again from Ads Manager.");
      rows = r.rows;
      network = r.network;
      from = given.from;
      // D10: only the numbers the next check needs, per ad per day, in this pack's memory.
      await brain.remember(ctx, 'results', O.compact(rows));
    } else {
      const saved = O.expand(brain.packMemory(ctx, 'ads').results);
      if (saved.length) {
        rows = saved;
        network = saved[0].network;
        from = 'the last export you added';
      } else {
        rows = O.readExport(fs.readFileSync(SAMPLE, 'utf8')).rows;
        network = 'Meta';
        from = 'a made-up sample export';
        sample = true;
      }
    }
    const groups = O.group(rows);
    const list = O.suggest(groups, n.price ? n : undefined, { resultIs });
    const days = new Set(rows.map((r) => r.day).filter(Boolean)).size;
    const cols = [{ key: 'change', label: 'Suggestion' }, { key: 'ad', label: 'Ad' }, { key: 'effect', label: 'Spend' }, { key: 'why', label: 'The numbers' }, { key: 'rule', label: 'Rule' }];
    const html = page(ctx, {
      title: 'Your daily ad check',
      kicker: sample ? 'Sample results' : `${network} results`,
      sub: sample ? 'A made-up export so you can see how it works. Add your own from Ads Manager.' : `Read from ${from}: ${text.plural(groups.length, 'ad')} over ${text.plural(days, 'day')}. Suggestions only: you make each change yourself.`,
      stats: n.price ? [{ value: money.usd(n.target), label: 'target cost per customer' }, { value: money.usd(n.breakEven), label: 'break-even per customer' }, { value: money.usd(n.maxCpl), label: 'max cost per lead' }] : [],
      body: `<section><h2>Suggestions</h2>${list.map((s) => `<div class="card"><span class="tag${s.kind === 'scale' || s.kind === 'keep' ? ' ok' : ''}">${esc(s.kind)}</span><p>${esc(s.card)}</p><p class="muted">Rule: ${esc(s.rule)}</p></div>`).join('')}</section><section><h2>How this works</h2><div class="card"><p>${esc(LINES.optimizerFiles)} No automatic rules, nothing changed in bulk, and nothing about who sees your ads: every audience starts at 18, and housing, jobs and credit ads keep their limits.</p><p>Only your own numbers are used, never compared with anyone else's.</p></div></section>`,
    });
    const base = f.name || f.service || 'ads';
    const saved = [
      await save.saveFile(ctx, save.fileName(base, 'ad check', '.html'), html),
      await save.saveFile(ctx, save.fileName(base, 'ad check', '.csv'), files.csv(list.map((s) => ({ ...s, network: s.network, campaign: s.campaign })), [{ key: 'network', label: 'Network' }, { key: 'campaign', label: 'Campaign' }, ...cols]), 'text/csv'),
    ];
    ctx.log(`${text.plural(list.length, 'suggestion')} for ${text.plural(groups.length, 'ad')} from ${from}.`);
    return { network, from, suggestions: list.map((s) => ({ kind: s.kind, change: s.change, network: s.network, campaign: s.campaign, ad: s.ad, effect: s.effect, why: s.why, rule: s.rule, card: s.card })), ads: groups.length, days, numbers: n, files: saved, sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('This reads a made-up sample export. Add your own export from Ads Manager to check your ads.') : null,
      views.metric('Suggestions', out.suggestions.length, `${text.plural(out.ads, 'ad')} read from ${out.from}`),
      views.cards(out.suggestions.map((s) => ({ title: s.change, subtitle: `${s.network}: ${s.ad}`, body: s.card, badge: s.kind }))),
      views.text(LINES.optimizerFiles),
      out.files.map((a, i) => views.file(a, i ? 'Suggestions as a spreadsheet' : 'Your ad check (printable)')),
    );
  },
};

const optimizerSkill = {
  name: 'ads.optimizer_skill',
  title: 'Make your ad check skill',
  description: "Writes a Claude skill (SKILL.md plus reference files, zipped) with your price, target cost per customer, max cost per lead and the check's rules, so your own Claude runs the daily ad check the same way each day from the exports you add. Suggestions only; it never changes an ad.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { resultIs: INPUTS.resultIs, price: NUM_INPUTS.price, cost: NUM_INPUTS.cost, jobs30: NUM_INPUTS.jobs30, closeRate: NUM_INPUTS.closeRate } },
  output: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, skill: { type: 'string' }, zip: { type: 'object' }, md: { type: 'object' }, steps: { type: 'array' } }, required: ['name', 'skill', 'zip', 'md', 'steps'] },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const n = A.numbers(f, { ...input, outreachCustomers: 3 });
    const mine = n.price ? n : undefined;
    const built = S.build({ business: f.name, firstName: (ctx.member && ctx.member.firstName) || '', timezone: (ctx.member && ctx.member.timezone) || 'America/Chicago', numbers: mine, resultIs: input.resultIs === RESULT_IS[1] ? 'sale' : 'lead' });
    const zip = await save.saveFile(ctx, `${built.name}.zip`, files.zip(built.files, { mtime: typeof ctx.now === 'function' ? ctx.now() : Date.now() }), 'application/zip');
    const md = await save.saveFile(ctx, `${built.name}-SKILL.md`, built.md, 'text/markdown');
    const steps = [
      `Download ${built.name}.zip.`,
      'In Claude: Customize, Skills, the plus button, Create skill, Upload a skill, then pick the ZIP. Skills need code execution turned on in Claude\'s settings.',
      'Each morning, add yesterday\'s export (by day) in a new chat and ask for "my daily ad check".',
      'Changed your price or costs? Make the skill again and upload the new ZIP in place of the old one.',
    ];
    ctx.log(`Wrote ${built.name}.`);
    return { name: built.name, description: built.description, skill: built.md, zip, md, steps };
  },
  view(out) {
    return views.blocks(
      views.text(`Your skill "${out.name}" runs the daily ad check in your own Claude, with your numbers written in. It suggests; you make each change.`),
      views.cards(out.steps.map((s, i) => ({ title: `Step ${i + 1}`, body: s }))),
      views.file(out.zip, 'Your ad check skill (ZIP to upload to Claude)'),
      views.copy('SKILL.md', out.skill),
      views.file(out.md, 'SKILL.md on its own'),
    );
  },
};

module.exports = { suggestChanges, optimizerSkill, RESULT_IS };
