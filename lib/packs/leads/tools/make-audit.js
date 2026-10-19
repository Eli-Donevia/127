// The thing to show a business: a one-page website check in their colors (what we found, why it
// matters, the fix, and the member's free offer), a 1080x1350 image of the top 3 fixes for a DM,
// and the steps to make the free sample. Facts from their own website only.

const { views, save, media, time, text } = require('../../_kit');
const { serviceOf, senderOf, specFor } = require('../lib/services');
const pages = require('../lib/pages');

module.exports = {
  name: 'leads.make_audit',
  title: 'Make their website check',
  description: 'Makes a one-page website check for one business in its own colors (what is missing, why it matters, the fix, your free offer), a share image of the top 3 fixes, and the steps for your free sample.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      lead: { type: 'object', title: 'Business', description: 'One lead from leads.score_fit or leads.scan_business' },
      service: { type: 'string', title: 'What you sell' },
      your_name: { type: 'string' },
    },
    required: ['lead', 'service'],
  },
  output: { type: 'object', properties: { name: { type: 'string' }, page: { type: 'object' }, fixes: { type: 'array' }, spec: { type: 'object' } }, required: ['name', 'page', 'fixes', 'spec'] },
  async run(input, ctx) {
    const lead = input.lead;
    if (!lead || !lead.key) throw new Error('Pick a business to check first.');
    const service = serviceOf(input.service);
    const sender = senderOf(ctx, input);
    const biz = lead.siteName || (lead.source === 'google' ? '' : lead.name) || 'Business';
    const cat = lead.category || {};
    const vars = { biz, city: lead.city || sender.city || '', what: cat.what || 'work', thing: cat.thing || 'visit', film: cat.film || 'a day at work', many: cat.many || 'local businesses', categoryId: cat.id || '' };
    const offer = text.plain(text.fill(service.offer || '', vars));
    const date = time.longDate(time.today(ctx));
    const html = pages.auditHtml({ lead, service, sender, offer, date });
    const page = await save.saveFile(ctx, save.fileName(biz, 'website check', '.html'), html);
    const svgText = pages.shareSvg({ lead, service, sender });
    let image = null;
    if (media.canRender(ctx)) {
      try {
        image = await save.saveFile(ctx, save.fileName(biz, 'quick fixes', '.png'), await media.svgToPng(ctx, svgText));
      } catch {
        image = null;
      }
    }
    const svgAsset = await save.saveFile(ctx, save.fileName(biz, 'quick fixes', '.svg'), svgText);
    const fixes = pages.topFixes(lead, service, 5).map((f) => ({ check: f.check, saw: f.why, fix: f.fix }));
    const spec = specFor(service, vars);
    ctx.log(`Made the website check for ${biz}`);
    return { key: lead.key, name: biz, page, image, svg: svgAsset, fixes, spec, offer, sample: !!lead.sample };
  },
  view(out) {
    return views.blocks(
      views.text(`Your free sample for ${out.name}: ${out.spec.title}`),
      views.file(out.page, `Website check for ${out.name} (open, then print or send the link)`),
      out.image ? views.image(out.image, 'Attach this to your DM') : views.file(out.svg, 'Share image'),
      views.table([{ key: 'check', label: 'Fix' }, { key: 'saw', label: 'What we saw' }], out.fixes, 5),
      views.copy('Steps for your free sample', out.spec.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    );
  },
};
