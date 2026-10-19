// Renders one clip as a phone-ready MP4: cut, reframed to 9:16 (or kept as shot), word-by-word
// captions burned in, a hook title, the member's handle. Audio-only sources and the sample talk get
// an audiogram scene in the member's colors. H.264 + AAC, faststart, under 22 MB.

const fs = require('fs');
const path = require('path');
const { media, views, text, save } = require('../../_kit');
const { localPath } = require('../lib/source');
const { bizOf, talkAudio, TALK } = require('../lib/sample');
const { lookFor } = require('../lib/look');
const { flatten, stamp, r2 } = require('../lib/words');
const R = require('../lib/render');

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

module.exports = {
  name: 'video.render_clip',
  title: 'Render a captioned clip',
  description: 'Cuts one clip from the video, reframes it to vertical 9:16, burns in word-by-word captions in your colors with a hook title, and saves a phone-ready MP4 plus a cover image.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  credits: 6,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      source: { type: 'object', title: 'The video (from Load your video)' },
      clip: { type: 'object', title: 'The clip (from Find the best clips); leave out for the whole video' },
      words: { type: 'array', title: 'Transcript, when there is no clip' },
      title: { type: 'string', title: 'Hook title on top', maxLength: 80 },
      style: { type: 'string', title: 'Caption style', enum: ['bold', 'box', 'clean'], default: 'bold' },
      layout: { type: 'string', title: 'Frame', enum: ['auto', 'vertical', 'fit', 'keep'], default: 'auto' },
      handle: { type: 'string', title: 'Your @handle', maxLength: 40 },
      color: { type: 'string', title: 'Brand color (hex)', maxLength: 9 },
      focus: { type: 'number', title: 'Where to frame, 0 left to 1 right', minimum: 0, maximum: 1, default: 0.5 },
      maxSeconds: { type: 'integer', title: 'Longest video to caption', minimum: 5, maximum: 180, default: 180 },
    },
    required: ['source'],
  },
  output: {
    type: 'object',
    properties: { video: { type: 'object' }, poster: { type: 'object' }, title: { type: 'string' }, seconds: { type: 'number' }, n: { type: 'integer' }, range: { type: 'string' }, sample: { type: 'boolean' } },
    required: ['title'],
  },
  async run(input, ctx) {
    const src = input.source || {};
    const clip = input.clip && typeof input.clip === 'object' ? input.clip : null;
    const words = flatten(clip && clip.words ? clip.words : input.words || []);
    const b = bizOf(ctx, input);
    const look = lookFor(ctx, input, b);
    const total = Number(src.duration) || (words.length ? words[words.length - 1].e + 0.5 : 0);
    const start = clip ? Number(clip.start) || 0 : 0;
    // Sample renders stay short (the first 40 seconds of the sample talk).
  const end = clip ? Number(clip.end) || start + 30 : Math.min(total || 30, input.maxSeconds || 180, src.kind === 'sample' ? 40 : Infinity);
    const dur = Math.max(1, end - start);
    const n = clip && clip.n ? clip.n : 1;
    const title = text.clip(input.title || (clip && clip.title) || (src.kind === 'sample' ? TALK.title : ''), 80);
    const handle = (input.handle || b.instagram || b.tiktok || '').replace(/^@/, '');
    const isSample = src.kind === 'sample' || !!ctx.sample;
    if (!media.canRender(ctx)) {
      return { title, seconds: r2(dur), n, range: `${stamp(start)} to ${stamp(end)}`, note: 'Video tools are off on this server, so nothing was rendered.', sample: true };
    }
    const audiogram = src.kind === 'sample' || src.hasVideo === false;
    let W = R.W9;
    let H = R.H9;
    let layout = input.layout === 'fit' ? 'fit' : 'crop';
    if (!audiogram && input.layout === 'keep') {
      const scale = Math.min(1, 1920 / Math.max(src.width || 1920, src.height || 1080));
      W = even((src.width || 1920) * scale);
      H = even((src.height || 1080) * scale);
      layout = 'pad';
    } else if (!audiogram && input.layout === 'auto' && src.width && src.height && src.height > src.width) layout = 'crop';
    const assText = R.clipAss({ words, start, end, look, style: input.style || 'bold', W, H, title, handle, sample: isSample, layout: audiogram ? 'audiogram' : layout });
    const dir = media.scratch(ctx, 'clip');
    const out = path.join(dir, 'clip.mp4');
    if (audiogram) {
      const audio = src.kind === 'sample' ? await talkAudio(ctx) : await localPath(ctx, src);
      const env = audio ? await R.envelope(ctx, audio, { start, dur }) : [];
      const meter = R.meterEvents(env, { W, H, look });
      const withMeter = assText.replace('[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n', `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${meter.join('\n')}\n`);
      const name = src.kind === 'sample' ? TALK.speaker : b.firstName || b.name || 'You';
      const line = src.kind === 'sample' ? TALK.business : b.name && b.name !== name ? b.name : b.what;
      const badge = R.audiogramSvg({ W, H, look, name, line: text.clip(line || '', 40), initials: text.initials(name, 1) });
      const png = await media.svgToPng(ctx, badge.svg);
      await R.renderAudiogram(ctx, { audio, start, dur, W, H, look, assText: withMeter, png, at: { x: badge.x, y: badge.y }, out });
    } else {
      const file = await localPath(ctx, src);
      const assFile = path.join(dir, 'clip.ass');
      fs.writeFileSync(assFile, assText);
      const zoom = layout === 'crop' && (src.width || 0) > (src.height || 0) ? R.punchIns(words, start, end) : [];
      await media.burn(ctx, { input: file, ass: assFile, out, start, end, W, H, layout, focus: input.focus, zoom });
    }
    const info = await media.probe(out, { signal: ctx.signal });
    const poster = await media.frame(ctx, out, { at: Math.min(1.5, info.duration / 2), format: 'jpg' });
    const base = save.fileName(src.kind === 'sample' ? 'sample' : b.name || 'clip', `clip-${n}`, title.split(' ').slice(0, 5).join(' '));
    const video = await save.saveFile(ctx, `${base}.mp4`, fs.readFileSync(out));
    const cover = await save.saveFile(ctx, `${base}-cover.jpg`, poster);
    ctx.log(`Clip ${n}: ${title} (${Math.round(info.duration)} s, ${(info.bytes / 1e6).toFixed(1)} MB)`);
    return { video, poster: cover, title, seconds: r2(info.duration), width: info.width, height: info.height, mb: Math.round(info.bytes / 1e5) / 10, n, range: `${stamp(start)} to ${stamp(end)}`, style: input.style || 'bold', sample: isSample };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return views.blocks(views.video(out.video, `${out.title} (${Math.round(out.seconds)} s)`), out.sample ? views.text('Sample render: add your own video to cut yours.') : null);
  },
  viewMany(outs) {
    const ok = outs.filter((o) => o && o.video);
    return views.blocks(
      views.metric('Clips ready', ok.length, 'vertical MP4s with captions'),
      ok.slice(0, 10).map((o) => views.video(o.video, `Clip ${o.n}: ${o.title} (${Math.round(o.seconds)} s, from ${o.range})`)),
      ok.some((o) => o.sample) ? views.text('These are sample renders. Add your own video to cut yours.') : null,
    );
  },
};
