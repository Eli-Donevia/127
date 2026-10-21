// An animated card on its own: an end card (name, rule, line, button, logo) or a title card for the
// start of a video, in your colors. Rendered with HyperFrames when the server has it (lib/motion.js);
// otherwise the ffmpeg card with a slow push in, and the result says so.

const fs = require('fs');
const { media, text, views } = require('../../_kit');
const E = require('../lib/edit');
const M = require('../lib/edit-media');
const T = require('../lib/edit-tools');
const motion = require('../lib/motion');

const OFF_LINE = 'Animation is switched off on this server, so this is the still card with a slow push in.';

module.exports = {
  name: 'studio.motion_card',
  title: 'Make an animated card',
  description: 'Makes a short animated card in your colors: an end card (business name, a line, a button like "Book at yoursite.com", your logo) or a title card for the start of a video. Letters rise in, a line draws, a light sweeps the name. MP4 in any shape.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  wants: ['motion'],
  lane: 'render',
  credits: 3,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Which card', enum: ['end', 'title'], default: 'end', description: 'end: name, line and a button to close a video. title: a big title to open one.' },
      name: { type: 'string', title: 'Business name or title (optional, we use your profile)', maxLength: 60 },
      line: { type: 'string', title: 'A short line (optional)', description: 'What you do, or the subtitle.', maxLength: 90 },
      cta: { type: 'string', title: 'Button text (optional)', description: 'Like "Book at emberandoak.com" or "@emberandoak".', maxLength: 48 },
      handle: { type: 'string', title: 'Your @handle (optional)', maxLength: 40 },
      logo: { type: ['string', 'object'], format: 'asset', accept: 'image/*', title: 'Your logo (optional)' },
      aspect: { type: 'string', title: 'Shape', enum: M.ASPECTS, default: '9:16' },
      seconds: { type: 'number', title: 'Seconds', minimum: 2, maximum: 8, default: 4 },
      color: T.COLOR,
    },
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, kind: { type: 'string' }, name: { type: 'string' }, motion: { type: 'boolean' } } },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const kind = input.kind === 'title' ? 'title' : 'end';
    const brand = T.brandOf(ctx, input);
    const sample = !brand.name && !input.name;
    const name = text.clip(text.oneLine(input.name || brand.name || 'Your business'), 60);
    const line = text.clip(text.oneLine(input.line || (kind === 'end' ? brand.line : '')), 90);
    const handle = brand.handle ? `@${brand.handle}` : '';
    const cta = kind === 'end' ? text.clip(text.oneLine(input.cta || handle || (brand.website ? String(brand.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '')), 48) : '';
    const [W, H] = M.sizeOf(input.aspect);
    const seconds = Math.max(2, Math.min(8, Number(input.seconds) || 4));
    const logoAsset = T.assetId(input.logo) ? await T.readAsset(ctx, input.logo, 'Your logo') : null;
    let logoPng = null;
    if (logoAsset) {
      try {
        logoPng = `${M.scratch(ctx, 'logo')}/logo.png`;
        fs.writeFileSync(logoPng, await media.frame(ctx, logoAsset.path, { width: 440, height: 440, format: 'png' }));
      } catch {
        logoPng = null;
      }
    }
    const m = motion.engine(ctx);
    let r;
    if (m) {
      r = await motion.render(ctx, m, 'card', { W, H, seconds, data: { kind, name, line, cta, logo: !!logoPng, sample, look: brand.look }, files: logoPng ? [{ from: logoPng, as: 'logo.png' }] : [], what: 'The card' });
    } else {
      const png = await media.svgToPng(ctx, E.outroSvg({ W, H, look: brand.look, name, line, handle: cta.replace(/^@/, ''), logoPng: logoPng ? fs.readFileSync(logoPng) : null }));
      const file = `${M.scratch(ctx, 'card')}/card.png`;
      fs.writeFileSync(file, png);
      r = await motion.stillCard(ctx, file, { W, H, seconds });
    }
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, `${kind}-card-${(input.aspect || '9:16').replace(':', 'x')}`, sample), sample, at: Math.min(seconds - 0.2, 2.6) });
    ctx.log(r.motion ? `Animated ${kind} card rendered with HyperFrames` : `Still ${kind} card (animation is off here)`);
    return { ...saved, kind, name, motion: !!r.motion, ...(r.motion ? {} : { note: OFF_LINE }) };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return T.videoView(out, { caption: `${out.kind === 'title' ? 'Title' : 'End'} card: ${out.name}`, sampleLine: 'Made with sample details. Fill in your profile, or type your name and line, for your own card.' });
  },
};
