// The spec asset for photography: a shot list for one local business from what its own homepage
// shows and lacks (photo count, subjects read from alt text and file names, dated), the 10 shots to
// take first, and a mood board in words drawn in their colors (PNG) on one page to share.

const { views, save, media, time, brain, text, leads, web } = require('../../_kit');
const shots = require('../lib/shots');

module.exports = {
  name: 'photo.shot_list',
  title: 'Make a shot list',
  description: 'Reads one business website, counts what its photos show and what is missing, and makes a 10-shot list with a mood board in words, as a page to share and a picture.',
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
      name: { type: 'string', title: 'Their name (optional)', maxLength: 80 },
      city: { type: 'string', title: 'Their city (optional)', maxLength: 80 },
    },
  },
  output: { type: 'object', properties: { name: { type: 'string' }, shows: { type: 'array' }, shots: { type: 'array' }, page: { type: 'object' }, line: { type: 'string' } }, required: ['name', 'shows', 'shots', 'page', 'line'] },
  async run(input, ctx) {
    const today = time.today(ctx);
    let lead = input.lead && typeof input.lead === 'object' && !Array.isArray(input.lead) ? input.lead : null;
    const website = (lead && ((lead.site && lead.site.url) || lead.website)) || input.website || '';
    let scan = null;
    let html = '';
    if (website) {
      ctx.log(`Reading ${text.clip(website, 60)}`);
      scan = await leads.scanFor(ctx, website);
      if (scan && scan.reachable) {
        try {
          html = leads.isSampleUrl(website) ? leads.sampleSiteHtml(scan.url || website, { year: Number(today.slice(0, 4)) }).html : ((await web.fetchPage(ctx, scan.url || website)) || {}).html || '';
        } catch (e) {
          html = '';
        }
      }
    }
    if (!lead) lead = leads.makeLead({ website, name: input.name || '', source: 'web' }, scan, { now: new Date(ctx.now()), city: input.city || '' });
    const a = shots.analyze({ lead, scan, html, name: input.name, city: input.city || lead.city, today });
    const me = brain.brainOf(ctx, {});
    const p = shots.paletteOf(a);
    const board = shots.boardSvg(a, p);
    const base = save.fileName(a.name || 'business', 'shot-list');
    const page = await save.saveFile(ctx, `${base}.html`, shots.pageHtml(a, board, { by: [me.firstName, me.name].filter(Boolean).join(', ') }));
    const out = { name: a.name || 'This business', nameKnown: a.nameKnown, foundOn: a.foundOn, shows: a.shows, lacks: a.lacks, shots: a.shots, page, sample: a.sample };
    if (media.canRender(ctx)) {
      try {
        out.png = await save.saveFile(ctx, `${base}-mood-board.png`, await media.svgToPng(ctx, board, { width: 1080, height: 1350 }), 'image/png');
      } catch (e) {
        ctx.log('The mood board picture did not render here; the page has it as a drawing.');
      }
    }
    out.line = text.plain(`I made a shot list for ${a.name || 'you'} from what your website shows today${a.lacks.length ? `, starting with what's missing (${a.lacks.slice(0, 2).join(' and ')})` : ''}. Here it is: [paste your link]. Want me to stop by for 20 minutes and take the first 3, so you can see the style before you decide anything?`);
    return out;
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This shot list'),
      views.image(out.png, `Mood board for ${out.name}`),
      views.file(out.page, `Shot list for ${out.name} (one page to share)`),
      views.text(`What their site shows, as found on ${out.foundOn}: ${out.shows.join(' ')}${out.lacks.length ? ` Missing: ${out.lacks.join(', ')}.` : ''}`),
      views.table([{ key: 'n', label: '#' }, { key: 'shot', label: 'Shot' }, { key: 'how', label: 'How' }, { key: 'use', label: 'Where they use it' }], out.shots),
      !out.nameKnown ? views.text("Their name isn't saved in files (Google Maps listing). Type it in before you send.") : null,
      views.copy('Line for your follow-up', out.line)
    );
  },
};
