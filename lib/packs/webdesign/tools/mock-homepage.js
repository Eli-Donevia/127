// The spec asset for web design: a mock homepage of a real business, built only from what its own
// website says (name, services, phone, hours, colors, as found and dated), as an HTML page they can
// open and a phone-size PNG, plus the 5 fixes for their current site.

const { views, save, media, time, brain, text, leads } = require('../../_kit');
const mock = require('../lib/mock');

module.exports = {
  name: 'webdesign.mock_homepage',
  title: 'Make a mock homepage',
  description: 'Reads one business website and makes a mock homepage from its own facts (name, services, phone, hours, colors), as an HTML page and a phone-size picture, with the 5 fixes for their current site.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 3,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      lead: { type: 'object', title: 'Business', description: 'A ranked lead from leads.score_fit (or a chosen item from an approve step)' },
      website: { type: 'string', title: 'Their website', description: 'Used when no lead is given' },
      name: { type: 'string', title: 'Their business name (optional)', maxLength: 80 },
      city: { type: 'string', title: 'Their city (optional)', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    properties: { name: { type: 'string' }, facts: { type: 'array' }, fixes: { type: 'array' }, html: { type: 'object' }, png: { type: 'object' }, svg: { type: 'object' }, line: { type: 'string' }, sample: { type: 'boolean' } },
    required: ['name', 'facts', 'fixes', 'html', 'line'],
  },
  async run(input, ctx) {
    const today = time.today(ctx);
    let lead = input.lead && typeof input.lead === 'object' && !Array.isArray(input.lead) ? input.lead : null;
    const website = (lead && ((lead.site && lead.site.url) || lead.website)) || input.website || '';
    let scan = null;
    if (website) {
      ctx.log(`Reading ${text.clip(website, 60)}`);
      scan = await leads.scanFor(ctx, website);
    }
    if (!lead) lead = leads.makeLead({ website, name: input.name || '', source: 'web' }, scan, { now: new Date(ctx.now()), city: input.city || '' });
    const f = mock.factsFrom({ lead, scan, name: input.name, city: input.city || lead.city, today });
    const me = brain.brainOf(ctx, {});
    const by = [me.firstName, me.name].filter(Boolean).join(', ');
    const p = mock.paletteOf(f);
    const base = save.fileName(f.name || 'business', 'mock-homepage');
    const html = await save.saveFile(ctx, `${base}.html`, mock.html(f, { by, p, year: Number(today.slice(0, 4)) }));
    const drawing = mock.phoneSvg(f, { p, by: me.firstName });
    let png = null;
    let svgAsset = null;
    if (media.canRender(ctx)) {
      try {
        png = await save.saveFile(ctx, `${base}-phone.png`, await media.svgToPng(ctx, drawing, { width: 780, height: 1688 }), 'image/png');
      } catch (e) {
        ctx.log('The phone picture did not render here; the HTML page is ready.');
      }
    }
    if (!png) svgAsset = await save.saveFile(ctx, `${base}-phone.svg`, drawing);
    const fixes = mock.fixList(lead);
    const facts = f.found.length ? f.found : [f.siteStatus === 'none' ? 'No website on their listing, so the mock uses their name and kind of business only.' : "We couldn't read facts from their site, so the mock uses placeholders marked as samples."];
    const line = text.plain(`I made a mock homepage for ${f.name || 'your business'} from what your site says today. Here it is: [paste your link]. If you like it, I can have it live on your own domain within two weeks.`);
    const out = { name: f.name || 'This business', nameKnown: f.nameKnown, website: f.website, foundOn: f.foundOn, palette: { primary: p.primary, accent: p.accent, from: p.from }, facts, fixes, html, line, sample: f.sample };
    if (png) out.png = png;
    if (svgAsset) out.svg = svgAsset;
    return out;
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This mock'),
      views.image(out.png, `Mock homepage for ${out.name} on a phone`),
      views.file(out.html, `Mock homepage for ${out.name} (open it, then share the file or a screenshot)`),
      views.file(out.svg, 'Phone picture (SVG, open in any browser)'),
      views.text(`Facts used, as found on ${out.foundOn}: ${out.facts.join(' ')}`),
      out.fixes.length ? views.table([{ key: 'fix', label: 'Fix on their current site' }, { key: 'why', label: 'What we saw' }], out.fixes) : null,
      !out.nameKnown ? views.text("Their name isn't saved in files (Google Maps listing). Type it into the mock before you send it.") : null,
      views.copy('Line for your follow-up', out.line),
      views.text('This mock is for them only. Never post it or present it as their real site.')
    );
  },
};
