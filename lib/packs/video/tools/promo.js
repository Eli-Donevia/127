// Renders a script (from Write the video script, after your edits) as a finished video in your
// colors: words rise into place, the offer pops, points check in, the call to action pulses, with a
// music bed made in code. A voiceover (made here, the file from Make the voiceover, or your own
// recording) sets the timing and scenes cut on its lines; with captions: 'words', spoken lines show
// as word-by-word captions. Behind the text: footage (Pexels clips from Find stock footage, or your
// own clips and photos), else a moving gradient. Works with no keys at all.

const fs = require('fs');
const path = require('path');
const { media, views, text, save } = require('../../_kit');
const { bizOf } = require('../lib/sample');
const { lookFor } = require('../lib/look');
const { parse, timeline, alignedTimeline, sceneEvents } = require('../lib/scenes');
const { musicBed } = require('../lib/music');
const { pexels } = require('../lib/providers');
const { linesToSay, makeVoice, spread } = require('../lib/voice');
const { assetFile, isAudio, isVideo } = require('../lib/assets');
const { gather, backgroundFrom } = require('../lib/footage');

const SIZES = { vertical: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };
const LEAD = 0.4; // seconds of music before the voice starts
const TAIL = 1.3; // seconds after the last word

const ff = (n) => Math.round(n * 10) / 10;
const wc = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

// Line times for a recording that came without them: shared out by how many words each line has.
function evenLines(lines, seconds) {
  const total = lines.reduce((n, l) => n + wc(l.say) + 1.5, 0) || 1;
  const usable = Math.max(1, seconds - 0.4);
  let t = 0.15;
  return lines.map((l) => {
    const d = (usable * (wc(l.say) + 1.5)) / total;
    const out = { ...l, start: t, end: t + d * 0.9 };
    t += d;
    return out;
  });
}

// The ASS doc with word-by-word captions on LINE scenes, kinetic scenes for the rest, and a small
// label (the topic) over the spoken lines.
function captionDoc(timed, words, { W, H, look, brand, watermark, label }) {
  const u = Math.min(W, H) / 1080;
  const tall = H > W;
  const spoken = timed.filter((s) => s.type === 'LINE');
  const capWords = words.filter((w) => spoken.some((s) => w.s >= s.start - 0.05 && w.s < s.end));
  const events = sceneEvents(timed.filter((s) => s.type !== 'LINE'), { W, H, look, brand, watermark });
  if (label && spoken.length) {
    const from = spoken[0].start;
    const to = spoken[spoken.length - 1].end;
    const size = 40 * u;
    const word = text.clip(label, 40).toUpperCase();
    const lw = media.textWidth(word, size, { weight: 800, mode: 'ass' }) + 4 * u * word.length + 72 * u;
    const y = tall ? 330 * u : 90 * u;
    events.push(media.assEvent({ layer: 3, start: from, end: to, style: 'K', text: `{\\an5\\pos(${ff(W / 2)},${ff(y)})\\bord0\\shad${ff(4 * u)}\\4a&HA0&\\c${media.assTagColor(look.box)}\\alpha&HFF&\\t(0,250,\\alpha&H10&)\\p1}${media.assRoundRect(lw, 78 * u, 39 * u)}{\\p0}` }));
    events.push(media.assEvent({ layer: 4, start: from, end: to, style: 'K', text: `{\\an5\\pos(${ff(W / 2)},${ff(y)})\\fnInter ExtraBold\\fs${ff(size)}\\fsp${ff(4 * u)}\\bord0\\shad0\\c${media.assTagColor(look.onBox)}\\alpha&HFF&\\t(0,250,\\alpha&H00&)}${media.assText(word)}` }));
  }
  return media.captionsAss(capWords, {
    style: 'bold',
    width: W,
    height: H,
    cy: tall ? H * 0.52 : H * 0.62,
    palette: { text: '#ffffff', pop: look.pop, outline: look.outline, box: look.box, onBox: look.onBox },
    title: 'Video',
    extra: { styles: [media.assStyle({ name: 'K', font: 'Inter', size: 60, align: 5 })], events },
  });
}

module.exports = {
  name: 'video.promo',
  title: 'Render the video',
  description: 'Turns a short script into a finished video in your colors with music: a voiceover when you want one, word-by-word captions on spoken lines, and stock footage or your own clips behind the text. Vertical, square or wide MP4 plus a cover image.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  wants: ['voice', 'pexels'],
  credits: 10,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      script: { type: 'object', title: 'Script (from Write the video script)' },
      format: { type: 'string', title: 'Shape', enum: ['vertical', 'square', 'wide'], default: 'vertical' },
      seconds: { type: 'integer', title: 'Length in seconds (without a voiceover)', minimum: 8, maximum: 60 },
      color: { type: 'string', title: 'Brand color (hex)', maxLength: 9 },
      voice: { type: 'string', title: 'Voiceover', enum: ['off', 'female', 'male'], default: 'off' },
      robot: { type: 'boolean', title: 'Use the computer voice when the natural voice is off', default: false },
      voiceover: { type: ['string', 'object', 'null'], title: 'A voiceover file', description: 'Your own recording (a Library file) or the file from Make the voiceover' },
      recording: { type: ['string', 'object', 'null'], title: 'Your own recording (optional)', description: 'A Library file of you reading the script. It takes the place of any other voice.' },
      voiceName: { type: 'string', title: 'Name of the voice (optional)', description: 'Shown with the video, like "Computer voice (male)" from Make the voiceover.', maxLength: 60 },
      lines: { type: 'array', title: 'Line times (from Make the voiceover)', items: { type: 'object' } },
      words: { type: 'array', title: 'Word times (from Make the voiceover)', items: { type: 'object' } },
      captions: { type: 'string', title: 'Spoken lines show as', enum: ['scenes', 'words'], default: 'scenes', description: 'scenes: each line big on its own. words: word-by-word captions that follow the voice.' },
      label: { type: 'string', title: 'Small label over the spoken lines (optional)', maxLength: 40 },
      footage: { type: 'array', title: 'Footage (Pexels clips, or your own clips and photos)', items: { type: ['object', 'string'] }, maxItems: 12 },
      stock: { type: 'string', title: 'Stock footage search (optional)', maxLength: 80 },
      watermark: { type: 'string', title: 'Small label on top (optional)', maxLength: 60 },
    },
    required: ['script'],
  },
  output: {
    type: 'object',
    properties: {
      video: { type: 'object' },
      poster: { type: 'object' },
      seconds: { type: 'number' },
      title: { type: 'string' },
      format: { type: 'string' },
      voice: { type: 'string' },
      engine: { type: 'string' },
      background: { type: 'string' },
      credits: { type: 'array' },
      notes: { type: 'array' },
      sample: { type: 'boolean' },
    },
    required: ['title'],
  },
  async run(input, ctx) {
    const sc = input.script || {};
    const scenes = parse(sc.text);
    if (scenes.length < 2) throw new Error('The script needs at least a HOOK line and one more line, like "LINE:", "OFFER:" or "CTA:".');
    const b = bizOf(ctx, input);
    const look = lookFor(ctx, input, b);
    const format = SIZES[input.format] ? input.format : 'vertical';
    const [W, H] = SIZES[format];
    const title = text.clip(sc.title || 'Promo', 60);
    if (!media.canRender(ctx)) return { title, seconds: 0, notes: ['Video tools are off on this server, so nothing was rendered.'], sample: true };
    const dir = media.scratch(ctx, 'promo');
    const notes = [];

    // 1. The voice: a file you gave, or one made here. Its line times set the scenes.
    let voiceFile = null;
    let voiceName = '';
    let engine = 'none';
    let lines = null;
    let words = [];
    const said = linesToSay({ script: sc });
    // Your own recording wins over a voiceover made earlier in the run (its line times don't fit it).
    const own = input.recording || null;
    const given = own || input.voiceover ? await assetFile(ctx, own || input.voiceover).catch(() => null) : null;
    if ((own || input.voiceover) && !given) notes.push(`The ${own ? 'recording' : 'voiceover file'} couldn't be opened, so this video has music only.`);
    if (given) {
      if (!(isAudio(given) || isVideo(given))) throw new Error('The voiceover should be an audio file (MP3, WAV or M4A).');
      voiceFile = path.join(dir, `voice${path.extname(given.name || '') || '.mp3'}`);
      fs.copyFileSync(given.path, voiceFile);
      const info = await media.probe(voiceFile, { signal: ctx.signal });
      if (!info.hasAudio) throw new Error('That voiceover file has no sound.');
      const fromTool = !own && Array.isArray(input.lines) && input.lines.length === said.length && input.lines.every((l) => l && Number.isFinite(Number(l.start)) && Number.isFinite(Number(l.end)));
      lines = fromTool ? input.lines.map((l) => ({ ...l, start: Number(l.start), end: Number(l.end) })) : evenLines(said, info.duration);
      words = fromTool && Array.isArray(input.words) ? input.words.filter((w) => w && w.w && Number.isFinite(Number(w.s)) && Number.isFinite(Number(w.e))) : [];
      engine = fromTool ? 'given' : 'recording';
      voiceName = fromTool ? text.oneLine(input.voiceName || '') || 'Voiceover' : 'Your recording';
      if (!fromTool) notes.push('Scenes are spread over your recording by how long each line is. Read the lines in the order of the script so they match.');
    } else if (input.voice && input.voice !== 'off') {
      const v = await makeVoice(ctx, said, { gender: input.voice, seed: b.name || title, robot: input.robot === true });
      if (v.file) {
        voiceFile = v.file;
        lines = v.lines;
        words = v.words;
        engine = v.engine;
        voiceName = v.voice;
        if (v.note) notes.push(v.note);
      } else {
        notes.push('The natural voice is off here, so this video has music only. Record yourself reading the script and add it in your editor.');
      }
    }
    if (voiceFile && !words.length && lines) words = lines.flatMap((l) => spread(l.say || l.text, Number(l.start), Number(l.end)));

    // 2. Scene times: on the voice's lines, else by how much there is to read.
    let timed = lines ? alignedTimeline(scenes, lines, { lead: LEAD, tail: TAIL }) : null;
    let seconds;
    if (timed) seconds = timed[timed.length - 1].end;
    else {
      seconds = lines ? lines[lines.length - 1].end + LEAD + TAIL : input.seconds || sc.seconds || 20;
      timed = timeline(scenes, seconds);
      seconds = timed[timed.length - 1].end;
    }
    if (seconds > 180) throw new Error('That script runs over 3 minutes. Cut it down to a short video (about 10 lines).');
    const shifted = words.map((w) => ({ w: w.w, s: Number(w.s) + LEAD, e: Number(w.e) + LEAD }));
    const brand = b.name || '';
    const watermark = input.watermark || (b.sampleBiz ? 'Sample' : '');
    const useWords = input.captions === 'words' && shifted.length > 0 && timed.some((s) => s.type === 'LINE');
    const assDoc = useWords
      ? captionDoc(timed, shifted, { W, H, look, brand, watermark, label: input.label })
      : media.assDoc({ width: W, height: H, styles: [media.assStyle({ name: 'K', font: 'Inter', size: 60, align: 5 })], events: sceneEvents(timed, { W, H, look, brand, watermark }), title: 'Promo' });
    fs.writeFileSync(path.join(dir, 'promo.ass'), assDoc);
    const music = musicBed(seconds, { seed: text.hash(brand || title), level: voiceFile ? 0.1 : 0.22 });
    fs.writeFileSync(path.join(dir, 'music.wav'), music.wav);

    // 3. Behind the text: footage given, else a stock search, else a moving gradient.
    let items = Array.isArray(input.footage) ? input.footage.filter(Boolean) : [];
    if (!items.length && input.stock) {
      let key = null;
      try {
        key = ctx.secret('pexels');
      } catch {
        key = null;
      }
      if (key) {
        try {
          items = await pexels(ctx, key, input.stock, { orientation: W > H ? 'landscape' : W === H ? 'square' : 'portrait', count: Math.min(4, timed.length), minSeconds: 4 });
        } catch (e) {
          ctx.log(`Stock footage skipped: ${String(e.message).slice(0, 100)}`);
        }
      } else notes.push('Stock footage is off here, so the background is a moving gradient in your colors.');
    }
    const sources = items.length ? await gather(ctx, items, dir) : [];
    if (items.length && !sources.length) notes.push("The footage couldn't be opened, so the background is a moving gradient in your colors.");
    // Inputs: music (0), the voice (1, when there is one), then the background.
    const args = ['-i', path.join(dir, 'music.wav')];
    if (voiceFile) args.push('-i', voiceFile);
    const first = voiceFile ? 2 : 1;
    const fromFootage = backgroundFrom(sources, timed, { W, H, fps: 30, first });
    let bgChain;
    if (fromFootage) {
      args.push(...fromFootage.args);
      bgChain = fromFootage.chain;
    } else {
      const hex = (c) => `0x${String(c).replace('#', '')}`;
      args.push('-f', 'lavfi', '-i', `gradients=s=${Math.round(W / 4)}x${Math.round(H / 4)}:r=30:d=${seconds.toFixed(2)}:c0=${hex(look.deep)}:c1=${hex(look.mid)}:c2=${hex(look.glow)}:c3=${hex(look.deep)}:n=4:speed=0.015:type=linear:seed=3`);
      bgChain = `[${first}:v]vignette=PI/4.6,scale=${W}:${H}:flags=bicubic,format=yuv420p[bg]`;
    }
    const delay = Math.round(LEAD * 1000);
    const amix = voiceFile
      ? `;[1:a]aresample=48000,adelay=${delay}|${delay}[vo];[0:a][vo]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      : ';[0:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[a]';
    const out = path.join(dir, 'promo.mp4');
    args.push('-filter_complex', `${bgChain};[bg]ass=${media.filterPath(path.join(dir, 'promo.ass'))},format=yuv420p[v]${amix}`, '-map', '[v]', '-map', '[a]', '-t', seconds.toFixed(2), ...media.encodeArgs({ crf: 22, fps: 30, maxrateK: media.bitrateFor(seconds) }), out);
    await media.ffmpeg(args, { timeoutSec: 600, signal: ctx.signal });
    const info = await media.probe(out, { signal: ctx.signal });
    // The cover: the hook, once its words have landed.
    const at = Math.min(seconds - 0.3, timed[0].start + Math.min(1.6, (timed[0].end - timed[0].start) * 0.8));
    const poster = await media.frame(ctx, out, { at, format: 'jpg' });
    const base = save.fileName(b.sampleBiz ? 'sample' : brand || 'video', sc.kind === 'faceless' ? text.clip(title, 40) : 'promo', format);
    const video = await save.saveFile(ctx, `${base}.mp4`, fs.readFileSync(out));
    const cover = await save.saveFile(ctx, `${base}-cover.jpg`, poster);
    const credits = fromFootage ? fromFootage.credits : [];
    const background = fromFootage ? (credits.length ? 'stock footage' : 'your footage') : 'gradient';
    ctx.log(`Rendered ${Math.round(info.duration)} s ${format} video (${(info.bytes / 1e6).toFixed(1)} MB), ${voiceFile ? voiceName.toLowerCase() : 'music only'}, ${background} behind the text`);
    return { video, poster: cover, seconds: Math.round(info.duration * 10) / 10, title, format, voice: voiceName, engine, background, credits, notes, sample: !!b.sampleBiz || !!ctx.sample };
  },
  view(out) {
    if (!out.video) return [views.text((out.notes && out.notes[0]) || 'Nothing was rendered.')];
    return views.blocks(
      views.video(out.video, `${out.title} (${Math.round(out.seconds)} s${out.voice ? `, ${out.voice.toLowerCase()}` : ''})`),
      views.image(out.poster, 'Cover image'),
      out.credits && out.credits.length ? views.text(`Stock footage: ${out.credits.map((c) => `video by ${c.by} on Pexels`).join(', ')}. Put these credits in your description.`) : null,
      (out.notes || []).map((n) => views.text(n)),
    );
  },
  viewMany(outs) {
    const ok = outs.filter((o) => o && o.video);
    return views.blocks(views.metric('Videos ready', ok.length), ok.map((o) => views.video(o.video, `${o.title} (${Math.round(o.seconds)} s)`)), ok[0] && ok[0].notes ? ok[0].notes.map((n) => views.text(n)) : null);
  },
};

module.exports.evenLines = evenLines;
