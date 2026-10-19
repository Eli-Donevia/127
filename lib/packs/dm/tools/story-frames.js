// Designs the three story frames (1080x1920) in the member's colors and saves them as PNGs ready to
// post, plus a 15 second story video when ffmpeg is on the server. The SVG sources go in one zip
// so a designer can tweak them.

const { views, save, files, media, text } = require('../../_kit');
const { storyFrames } = require('../lib/frames');
const { paletteFor } = require('../lib/palette');
const { clean } = require('../lib/keywords');

module.exports = {
  name: 'dm.story_frames',
  title: 'Design story frames',
  description: 'Designs 3 Instagram story frames (hook, what it is, reply with the keyword) in your colors, as PNG files and a short story video.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  // The story video is an MP4 encode: it waits its turn with the other renders instead of starving them.
  lane: 'render',
  credits: 3,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      plan: { type: 'object', title: 'Funnel plan' },
      keyword: { type: 'string', title: 'Keyword', maxLength: 20 },
      stories: { type: 'array', title: 'Story frames', items: { type: 'object' } },
      color: { type: 'string', title: 'Brand color (optional)', maxLength: 9 },
    },
    required: ['plan', 'stories'],
  },
  output: {
    type: 'object',
    properties: { frames: { type: 'array' }, zip: { type: 'object' }, rendered: { type: 'boolean' } },
    required: ['frames', 'rendered'],
  },
  async run(input, ctx) {
    const plan = input.plan || {};
    const f = plan.facts || {};
    const K = clean(input.keyword) || 'SEND';
    const p = paletteFor(ctx, { color: input.color });
    const svgs = storyFrames(input.stories, p, f, K);
    const base = save.fileName(f.business || 'my', K.toLowerCase(), 'story');
    const zip = await save.saveFile(ctx, `${base}-frames-svg.zip`, files.zip(svgs.map((s, i) => ({ name: `${base}-${i + 1}.svg`, data: s }))), 'application/zip');
    const frames = (input.stories || []).slice(0, 3).map((s, i) => ({ n: i + 1, title: text.oneLine(s.title || ''), sticker: s.sticker || '', png: null }));
    let rendered = false;
    let video = null;
    if (media.canRender(ctx)) {
      try {
        ctx.log('Rendering the story frames');
        const pngs = [];
        for (let i = 0; i < svgs.length; i++) {
          const png = await media.svgToPng(ctx, svgs[i], { width: 1080, height: 1920 });
          pngs.push(png);
          if (frames[i]) frames[i].png = await save.saveFile(ctx, `${base}-${i + 1}.png`, png, 'image/png');
        }
        rendered = true;
        try {
          const mp4 = await media.slideshow(ctx, pngs, { seconds: 5, width: 1080, height: 1920 });
          video = await save.saveFile(ctx, `${base}-video.mp4`, mp4, 'video/mp4');
        } catch (e) {
          ctx.log('The story video did not render; the PNG frames are ready.');
        }
      } catch (e) {
        ctx.log("Couldn't render PNGs here; the SVG frames are in the zip.");
      }
    }
    return { keyword: K, frames, zip, video, rendered, palette: { primary: p.primary, deep: p.deep, paper: p.paper, from: p.from } };
  },
  view(out) {
    return views.blocks(
      ...out.frames.map((fr) => views.image(fr.png, `Story ${fr.n}${fr.sticker ? `: ${fr.sticker}` : ''}`)),
      views.video(out.video, 'All three as one 15 second story'),
      !out.rendered && views.text('PNG rendering is off here, so the frames are in the zip as SVG files. Open them in any browser or Canva and export as PNG.'),
      views.file(out.zip, 'Story frames (SVG, for editing)'),
      views.text(`Colors from ${out.palette.from}.`)
    );
  },
};
