// Designed carousel slides (1080x1350) in the member's colors: PNGs, a ZIP, a contact sheet and a
// 9:16 video version. Without a renderer it hands over the SVGs and an HTML preview.

const { views, save, files, media, text } = require('../../_kit');
const { factsOf, signature } = require('../lib/facts');
const { planCarousel, TYPES } = require('../lib/carousel');
const { slidesSvg, contactSheet, reelFrame } = require('../lib/design');
const { page } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');

module.exports = {
  name: 'content.make_carousel',
  title: 'Make carousel slides',
  description: 'Writes and designs an Instagram carousel (cover, 3 to 6 slides, and a last slide with your comment keyword) at 1080x1350 in your colors. Saves each slide as a PNG, all of them in a ZIP, a contact sheet and a 9:16 video version for Reels and TikTok, plus the caption.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  lane: 'render',
  timeoutSec: 300,
  credits: 8,
  input: {
    type: 'object',
    properties: {
      type: { type: 'string', title: 'Kind of carousel', enum: TYPES, description: 'mistakes, myths, tips, signs, steps, questions, compare or checklist' },
      topic: { type: 'string', title: 'Title (optional)', maxLength: 90 },
      theme: { type: 'string', title: 'Look', enum: ['bold', 'dark', 'light'], default: 'bold' },
      color: { type: 'string', title: 'Brand color (optional)', description: 'A hex color like #0f766e', maxLength: 7 },
      ...FACT_INPUTS,
    },
  },
  output: { type: 'object', properties: { title: { type: 'string' }, slides: { type: 'array' }, caption: { type: 'string' }, files: { type: 'array' }, rendered: { type: 'boolean' } }, required: ['title', 'slides', 'files'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const theme = ['bold', 'dark', 'light'].includes(input.theme) ? input.theme : 'bold';
    const car = planCarousel(f, { type: input.type, topic: input.topic });
    const svgs = slidesSvg(car.slides, { palette: f.palette, theme, signature: signature(f) });
    const base = save.fileName(f.fileBase, text.clip(car.title, 40).replace(/\.\.\.$/, ''));
    const saved = { slides: [], other: [] };
    let rendered = false;
    if (media.canRender(ctx)) {
      try {
        const pngs = [];
        for (const s of svgs) pngs.push(await media.svgToPng(ctx, s));
        for (let i = 0; i < pngs.length; i++) saved.slides.push(await save.saveFile(ctx, `${base}-slide-${String(i + 1).padStart(2, '0')}.png`, pngs[i], 'image/png'));
        saved.other.push(await save.saveFile(ctx, `${base}-slides.zip`, files.zip(pngs.map((b, i) => ({ name: `slide-${String(i + 1).padStart(2, '0')}.png`, data: b }))), 'application/zip'));
        saved.sheet = await save.saveFile(ctx, `${base}-all-slides.png`, await media.svgToPng(ctx, contactSheet(svgs, { palette: f.palette, title: car.title })), 'image/png');
        const frames = [];
        for (let i = 0; i < svgs.length; i++) frames.push(await media.svgToPng(ctx, reelFrame(svgs[i], { palette: f.palette, theme, index: i, total: svgs.length })));
        saved.video = await save.saveFile(ctx, `${base}-video.mp4`, await media.slideshow(ctx, frames, { seconds: 2.5 }), 'video/mp4');
        rendered = true;
      } catch (e) {
        ctx.log(`Rendering stopped (${text.clip(String(e && e.message), 80)}), so the slides come as SVG files instead.`);
      }
    }
    if (!rendered) {
      saved.other.push(await save.saveFile(ctx, `${base}-slides-svg.zip`, files.zip(svgs.map((s, i) => ({ name: `slide-${String(i + 1).padStart(2, '0')}.svg`, data: s }))), 'application/zip'));
      const html = page(f, { title: car.title, kicker: 'Carousel preview', sub: 'Open each slide full screen to post it, or open the SVG files in Canva or Figma.', body: `<section>${svgs.map((s) => `<div class="card">${s.replace(/^<\?xml[^>]*>/, '').replace('<svg ', '<svg style="width:100%;height:auto" ')}</div>`).join('')}</section>` });
      saved.other.push(await save.saveFile(ctx, `${base}-preview.html`, html));
    }
    saved.other.push(await save.saveFile(ctx, `${base}-caption.txt`, car.caption));
    const all = [...saved.slides, ...(saved.sheet ? [saved.sheet] : []), ...(saved.video ? [saved.video] : []), ...saved.other];
    ctx.log(`${car.slides.length} slides${rendered ? ' rendered as PNG' : ' as SVG'}`);
    return {
      title: car.title,
      type: car.type,
      slides: car.slides.map((s) => ({ kind: s.kind, title: s.title || s.myth || '', body: s.body || s.truth || (s.items || []).join(' / ') || s.promise || '' })),
      caption: car.caption,
      files: all,
      sheet: saved.sheet || null,
      video: saved.video || null,
      rendered,
    };
  },
  view(out) {
    return views.blocks(
      out.sheet ? views.image(out.sheet, `${out.slides.length} slides at 1080x1350`) : views.text(`${out.slides.length} slides, saved as SVG files you can open in Canva or Figma.`),
      out.video ? views.video(out.video, 'The same slides as a 9:16 video for Reels and TikTok') : null,
      views.copy('Caption', out.caption),
      out.files.filter((a) => /\.(zip|html)$/.test(a.name)).map((a) => views.file(a, /svg/.test(a.name) ? 'Slides as SVG (ZIP)' : /\.html$/.test(a.name) ? 'Preview page' : 'All slides as PNG (ZIP)')),
    );
  },
};
