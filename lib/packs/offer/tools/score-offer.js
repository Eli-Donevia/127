// Offer score: reads the member's offer (typed, or from their website), scores it out of 100 on
// what buyers weigh, and gives the 3 fixes that raise it most plus a rewrite. Code scores; AI only
// polishes the rewrite, and the template rewrite is built from the member's own facts.

const { text, ai, views, save, scan } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const value = require('../lib/value');
const docs = require('../lib/docs');

module.exports = {
  name: 'offer.score_offer',
  title: 'Score my offer',
  description: 'Scores an offer out of 100 on how much buyers want it, how sure they are, how fast and how easy it is, then gives the 3 fixes that raise it most and a rewrite.',
  kind: 'ai',
  risk: 'read',
  needs: [],
  tasks: ['write'],
  credits: 4,
  input: {
    type: 'object',
    properties: {
      offer: { type: 'string', title: 'Your offer in your words', description: 'What you would say or post today. Leave empty to read your website.', maxLength: 2000 },
      website: { type: 'string', title: 'Website (optional)', maxLength: 300 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      who: { type: 'string', title: 'Who it is for (optional)', maxLength: 200 },
      price: { type: 'number', title: 'Price (optional)', minimum: 0 },
    },
  },
  output: {
    type: 'object',
    properties: { score: { type: 'number' }, after: { type: 'number' }, rows: { type: 'array' }, fixes: { type: 'array' }, rewrite: { type: 'string' }, source: { type: 'string' }, file: { type: 'object' }, ai: { type: 'boolean' } },
    required: ['score', 'fixes', 'rewrite'],
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    let offerText = text.plain(input.offer || '');
    let source = offerText ? 'Your words' : '';
    let site = {};
    if (!offerText && (input.website || f.website)) {
      site = await scan.scanSite(ctx, input.website || f.website, { extraPages: 1 });
      if (site.reachable) {
        offerText = [site.title, site.description, (site.headings || []).join('. '), text.clip(site.text || '', 1500)].filter(Boolean).join('. ');
        source = site.domain || 'Your website';
      }
    }
    if (!offerText) {
      offerText = [f.what, f.city, f.price ? `$${f.price}` : ''].filter(Boolean).join('. ');
      source = 'Your business details';
    }
    const ev = value.evaluate(offerText, f, site);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You rewrite small business offers in plain words. Keep every fact. Never add results the seller cannot control, reviews, stats or prices that were not given.',
      prompt: `Rewrite this offer in 2 to 4 short sentences for ${f.who}. Keep these facts and this order: ${ev.rewrite}`,
      schema: { type: 'object', properties: { rewrite: { type: 'string', maxLength: 500 } }, required: ['rewrite'] },
      fallback: () => ({ rewrite: ev.rewrite }),
      accept: ai.cleanCopy,
    });
    const rewrite = text.plain(data.rewrite || ev.rewrite);
    const html = docs.scoreCardHtml({ ...ev, rewrite }, f, { source });
    const file = await save.saveFile(ctx, save.fileName(f.business || f.whatShort, 'offer score', '.html'), html);
    ctx.log(`Scored ${ev.score} of 100 from ${source}`);
    return { score: ev.score, after: ev.after.score, rows: ev.rows, fixes: ev.fixes.map((x) => ({ title: x.title, line: x.line, why: x.why, points: x.points })), rewrite, source, file, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Offer score', `${out.score} of 100`, `From: ${out.source}`),
      views.metric('With the 3 fixes', `${out.after} of 100`),
      views.table([{ key: 'label', label: 'What buyers weigh' }, { key: 'score', label: 'Out of 10' }, { key: 'why', label: 'Why' }], out.rows),
      views.cards(out.fixes.map((x, i) => ({ title: `Fix ${i + 1}: ${x.title}`, body: `${x.why} Try: "${x.line}"` }))),
      views.copy('Your offer, rewritten', out.rewrite),
      views.file(out.file, 'Offer score report'),
    );
  },
};
