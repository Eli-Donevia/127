// A brand end card: your business name, a short line, your @handle and your logo, in your colors,
// joined to the end of the video with a soft cross fade.

const { media, text } = require('../../_kit');
const E = require('../lib/edit');
const T = require('../lib/edit-tools');

module.exports = {
  name: 'studio.edit_outro',
  title: 'Add a brand end card',
  description: 'Ends the video on a card in your colors with your business name, a short line, your @handle and your logo (from your profile, or what you type), joined with a soft cross fade.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 4,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      name: { type: 'string', title: 'Business name (optional, we use your profile)', maxLength: 60 },
      line: { type: 'string', title: 'A short line (optional)', description: 'What you do or what to do next, like "Book a free 20 minute call".', maxLength: 90 },
      handle: { type: 'string', title: 'Your @handle (optional)', maxLength: 40 },
      logo: { type: ['string', 'object'], format: 'asset', accept: 'image/*', title: 'Your logo (optional)' },
      color: T.COLOR,
      seconds: { type: 'number', title: 'Seconds on the card', minimum: 1.5, maximum: 6, default: 2.5 },
    },
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, name: { type: 'string' }, handle: { type: 'string' } } },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const src = await T.sourceVideo(ctx, input);
    const brand = T.brandOf(ctx, input);
    const logo = T.assetId(input.logo) ? await T.readAsset(ctx, input.logo, 'Your logo') : null;
    const name = brand.name || (src.sample ? 'Your business' : '');
    const r = await E.outro(ctx, src.path, { name, line: brand.line, handle: brand.handle, logo: logo ? logo.path : null, seconds: input.seconds || 2.5, look: brand.look });
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, 'with-end-card', src.sample), sample: src.sample, ai: src.ai, at: Math.max(0, r.seconds - 1) });
    const notes = [];
    if (!brand.name) notes.push('Add your business name to your profile (or type it here) and the card shows it.');
    if (logo && !r.logo) notes.push("The logo didn't open, so the card has no logo. Save it as a PNG or JPG and try again.");
    ctx.log(`End card added (${r.card} s)`);
    return { ...saved, name: text.clip(name, 60), handle: brand.handle, ...(notes.length ? { note: notes.join(' ') } : {}) };
  },
  view(out) {
    return T.videoView(out, { caption: `End card${out.name ? `: ${out.name}` : ''}${out.handle ? `, @${out.handle}` : ''}` });
  },
};
