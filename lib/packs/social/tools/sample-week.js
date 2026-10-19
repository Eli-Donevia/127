// The spec asset for social media: a sample week of posts for one restaurant or cafe, from its own
// menu, prices, hours and colors as found on its website (dated). 3 designed posts (one PNG of the week),
// captions with up to 5 hashtags, a 15 second Reel shot list, and one page with all of it.
// Every post is tagged "Sample" and is never posted or presented as their account.

const { views, save, media, time, brain, text, leads, svg } = require('../../_kit');
const week = require('../lib/week');

// The whole week as one picture (the 3 posts side by side), so the sample is one image to send.
function weekSvg(svgs, p) {
  const W = 1080;
  const H = 1350;
  const gap = 60;
  const pad = 60;
  const inner = svgs.map((s, i) => s.replace(/^<svg\b[^>]*>/, `<svg x="${pad + i * (W + gap)}" y="${pad}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`)).join('');
  const width = pad * 2 + svgs.length * W + (svgs.length - 1) * gap;
  return svg.doc({ width, height: H + pad * 2, body: svg.rect({ x: 0, y: 0, w: width, h: H + pad * 2, fill: p.paper }) + inner, title: 'A sample week of posts' });
}

module.exports = {
  name: 'social.sample_week',
  title: 'Make a sample week',
  description: 'Reads one restaurant website and makes a sample week of posts from its own menu, prices, hours and colors: 3 designed posts, captions, a Reel shot list and one page to share.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 4,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      lead: { type: 'object', title: 'Restaurant', description: 'A ranked lead from leads.score_fit (or a chosen item from an approve step)' },
      website: { type: 'string', title: 'Their website', description: 'Used when no lead is given' },
      name: { type: 'string', title: 'Their name (optional)', maxLength: 80 },
      city: { type: 'string', title: 'Their city (optional)', maxLength: 80 },
    },
  },
  output: { type: 'object', properties: { name: { type: 'string' }, posts: { type: 'array' }, reel: { type: 'array' }, page: { type: 'object' }, facts: { type: 'array' }, line: { type: 'string' } }, required: ['name', 'posts', 'reel', 'page', 'facts', 'line'] },
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
    const f = week.factsFrom({ lead, scan, name: input.name, city: input.city || lead.city, today });
    const me = brain.brainOf(ctx, {});
    const p = week.paletteOf(f);
    const list = week.posts(f);
    const shots = week.reel(f);
    const svgs = list.map((post, i) => week.postSvg(post, f, p, i));
    const base = save.fileName(f.name || 'restaurant', 'sample-week');
    const page = await save.saveFile(ctx, `${base}.html`, week.weekHtml(f, list, shots, svgs, { by: [me.firstName, me.name].filter(Boolean).join(', ') }));
    const posts = list.map((post) => ({ day: post.day, kind: post.kind, caption: post.caption, tags: post.tags, text: post.text, shot: post.shot }));
    let png = null;
    if (media.canRender(ctx)) {
      try {
        png = await save.saveFile(ctx, `${base}.png`, await media.svgToPng(ctx, weekSvg(svgs, p), { width: 2160 }), 'image/png');
      } catch (e) {
        ctx.log('The week picture did not render here; the page has the posts as drawings.');
      }
    }
    const facts = f.found.length ? f.found : ["We couldn't read a menu or prices on their site, so the posts use plain lines they can fill in."];
    const line = text.plain(`I made a sample week of posts for ${f.name || 'you'} from your menu and site: 3 posts in your colors and a Reel plan. Here it is: [paste your link]. Use them either way. If you want a month like this, let me know.`);
    return { name: f.name || 'This restaurant', nameKnown: f.nameKnown, foundOn: f.foundOn, palette: { primary: p.primary, from: p.from }, posts, reel: shots, page, png, facts, line, sample: f.sample };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This sample week'),
      views.image(out.png, `The sample week for ${out.name}: ${out.posts.map((p) => p.day).join(', ')}`),
      views.file(out.page, `Sample week for ${out.name} (one page with the posts, captions and Reel plan)`),
      out.posts.map((p) => views.copy(`${p.day} caption`, p.text)),
      views.table([{ key: 'at', label: 'When' }, { key: 'shot', label: 'Reel shot' }, { key: 'how', label: 'How' }], out.reel),
      views.text(`Facts used, as found on ${out.foundOn}: ${out.facts.join(' ')}`),
      !out.nameKnown ? views.text("Their name isn't saved in files (Google Maps listing). Type it in before you send.") : null,
      views.copy('Line for your follow-up', out.line),
      views.text('This is a sample for them only. Never post it or present it as their account.')
    );
  },
};
