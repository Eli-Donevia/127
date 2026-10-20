// What the studio's editing tools share: reading Library files (a file input's id, or the file object
// an earlier step saved), the chain of edits in one run (each step takes the newest video made so
// far), the member's brand for titles and end cards, saving the result with a cover, and the views.

const fs = require('fs');
const { media, views, text, save, brain } = require('../../_kit');
const M = require('./edit-media');
const P = require('./provenance');
const C = require('./edit-captions');

const ASSET_ID = /^[\w-]{1,80}$/;

// A Library file id from a string id or a saved file object ({ id, name, ... }). Never a local path.
function assetId(v) {
  if (typeof v === 'string' && ASSET_ID.test(v.trim())) return v.trim();
  if (v && typeof v === 'object' && !Array.isArray(v) && v.id != null && ASSET_ID.test(String(v.id))) return String(v.id);
  return null;
}

async function readAsset(ctx, v, what = 'That file') {
  const id = assetId(v);
  if (!id) return null;
  let a;
  try {
    a = await ctx.asset(id);
  } catch (e) {
    if (/Stopped/.test(String(e && e.message))) throw e;
    a = null;
  }
  if (!a || !a.path || !fs.existsSync(a.path)) throw new Error(`${what} isn't in your Library anymore. Add it again and rerun.`);
  return a;
}

// Schema pieces.
const VIDEO = { type: ['string', 'object'], format: 'asset', accept: 'video/*', title: 'Your video', description: 'An MP4 or MOV from your Library. Leave it out to try a short sample clip.' };
const CHAIN = { type: 'array', title: 'Edits made earlier in this run', description: 'The videos earlier steps made; the newest one is edited.', maxItems: 12 };
const WORDS = { type: ['array', 'null'], title: 'Words and their times', description: 'From video.transcribe (one item per minute) or a list of { w, s, e }.' };
const COLOR = { type: 'string', title: 'Brand color (optional hex, like #c2410c)', maxLength: 9 };
const VIDEO_OUT = {
  video: { type: 'object' },
  poster: { type: 'object' },
  seconds: { type: 'number' },
  width: { type: 'integer' },
  height: { type: 'integer' },
  mb: { type: 'number' },
  note: { type: 'string' },
  aiMade: { type: 'boolean' },
  sample: { type: 'boolean' },
  labels: { type: 'array', items: { type: 'string' } },
};

// The video to edit: the newest one an earlier step made (chain), else the member's own, else the
// sample clip. Returns { path, sample, words (the sample's), given, ai (the file is tagged as AI-made
// in whole or part) }.
async function sourceVideo(ctx, input) {
  const chain = Array.isArray(input.chain) ? input.chain.filter((x) => assetId(x)) : [];
  const own = assetId(input.video) || assetId(input.file);
  const pick = chain.length ? chain[chain.length - 1] : own;
  if (pick) {
    const a = await readAsset(ctx, pick, own && pick === (input.video || input.file) ? 'Your video' : 'The video from the step before');
    // An edit of the sample clip keeps its timing unless a cut ran (then the cut's words are passed).
    const words = own ? null : (await M.sampleClip(ctx)).words;
    return { path: a.path, name: a.name, sample: !own, words, given: !!own, ai: P.isAi(a.path) };
  }
  // The sample clip stands in for the member's own footage (its voice is a plain speech synthesizer).
  const s = await M.sampleClip(ctx);
  return { path: s.path, name: 'sample-clip.mp4', sample: true, words: s.words, given: false, ai: false };
}

// The member's brand: business name, handle, a short line and video colors.
function brandOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const handle = text.oneLine(input.handle || b.instagram || b.tiktok || '').replace(/^@/, '');
  const line = text.oneLine(input.line || '') || text.clip(text.oneLine(b.offer || b.what || ''), 70);
  return { name: text.oneLine(input.name || b.name || ''), handle, line, look: M.lookFor(ctx, input), website: b.website };
}

function baseName(ctx, input, what, sample) {
  const b = brain.brainOf(ctx, input);
  return save.fileName(sample ? 'sample' : b.name || 'video', what);
}

// Saves a finished MP4 and its cover JPG, both tagged with where they came from (lib/provenance):
// ai true when any part is AI-made (an AI clip, picture, voice or lipsync, or labels say so).
// Returns the output fields.
async function saveVideo(ctx, r, { base, sample, at, ai = false }) {
  const source = P.editSource(!!ai);
  const bytes = fs.statSync(r.path).size;
  if (bytes > 24.5 * 1024 * 1024) throw new Error('The finished video came out over 25 MB. Try a shorter video (under 3 minutes).');
  const video = await P.saveMedia(ctx, `${base}.mp4`, fs.readFileSync(r.path), { source });
  let poster = null;
  try {
    const jpg = await media.frame(ctx, r.path, { at: at != null ? at : Math.min(1.5, (r.seconds || 2) / 3), format: 'jpg' });
    poster = await P.saveMedia(ctx, `${base}-cover.jpg`, jpg, { source });
  } catch {
    poster = null;
  }
  return { video, ...(poster ? { poster } : {}), seconds: M.r2(r.seconds), width: r.width, height: r.height, mb: Math.round(bytes / 1e5) / 10, ...(ai ? { aiMade: true } : {}), sample: !!sample };
}

// AI labels burned on the video (Legal row 8, V3), and the lines the result shows with them.
const LABELS = {
  type: ['object', 'null'],
  title: 'AI labels on the video',
  description: 'Burns "AI-generated person", "AI-generated video" and "AI-generated voice" on screen while they are there.',
  properties: { person: { type: 'boolean', title: 'An AI-made person (AI actor) is on screen' }, video: { type: 'boolean', title: 'A real person is made to move or speak by AI' }, voice: { type: 'boolean', title: 'The voice is AI-made' } },
};
const PERSON_LINE = 'AI-made person. Label it "AI-generated" where people could take it for real, and turn on the platform\'s AI label when you post.';
// A real person made to move or speak (talking clips): Legal's line, word for word (L76 part 5).
const REAL_PERSON_LINE = 'AI-made video of a real person. Label it "AI-generated" where people could take it for real, turn on the platform\'s AI label when you post, and never use it as a customer\'s review.';
const UGC_LINE = "This ad uses an AI actor. Don't present it as a real customer's review.";

function labelsOf(input = {}) {
  const l = input.labels && typeof input.labels === 'object' ? input.labels : {};
  return { person: l.person === true, video: l.video === true, voice: l.voice === true };
}

const anyLabel = (l) => !!(l && (l.person || l.video || l.voice));

// The view lines: a real person made by AI (talking clips), an AI actor, and a UGC-style ad. "AI-made
// person" is only for AI actors (Legal L76). Anything else saved as AI-made (aiMade: a voice, AI
// pictures or clips, AI b-roll) gets the plain "Made with AI" line.
function aiLines(out = {}) {
  const l = out.labels || [];
  const real = l.includes(C.LABEL_TEXT.video);
  const actor = l.includes(C.LABEL_TEXT.person) || out.ugc;
  const plain = !real && !actor && (out.aiMade || l.length);
  return [real ? REAL_PERSON_LINE : null, actor && !real ? PERSON_LINE : null, plain ? P.AI_LINE : null, out.ugc ? UGC_LINE : null].filter(Boolean);
}

const OFF = 'Video tools are off on this server, so nothing was rendered.';
const SAMPLE_CLIP = 'This is the sample clip. Add your own video to edit yours.';
const SAMPLE_MADE = 'Made from sample clips. When the video models are switched on, the same steps make real ones.';

function offOutput(extra = {}) {
  return { note: OFF, sample: true, ...extra };
}

// The usual view: one line, the video, its files. sampleLine: what a sample result says (the edit
// tools' default asks for the member's own video).
function videoView(out, { metric, caption, files = [], lines = [], sampleLine = SAMPLE_CLIP } = {}) {
  lines = [...aiLines(out), ...lines];
  if (!out.video) return views.blocks(views.text(out.note || 'Nothing was rendered.'));
  return views.blocks(
    metric ? views.metric(metric[0], metric[1], metric[2]) : null,
    views.video(out.video, caption || `${Math.round(out.seconds)} s, ${out.width}x${out.height}`),
    views.file(out.video, `Download the MP4 (${out.mb} MB)`),
    out.poster ? views.file(out.poster, 'Cover image (JPG)') : null,
    files,
    lines.filter(Boolean).map((l) => views.text(l)),
    out.note ? views.text(out.note) : null,
    out.sample && sampleLine ? views.text(sampleLine) : null,
  );
}

// Words to caption with: words already retimed by an earlier cut, else the words given, else the
// sample's own words when the sample clip is the video.
function wordsFor(input, src) {
  const retimed = M.flatWords(input.retimed || []);
  if (retimed.length) return retimed;
  if (src.sample) return src.words || [];
  return M.flatWords(input.words || []);
}

module.exports = { assetId, readAsset, sourceVideo, brandOf, baseName, saveVideo, offOutput, videoView, wordsFor, labelsOf, anyLabel, aiLines, VIDEO, CHAIN, WORDS, COLOR, VIDEO_OUT, OFF, SAMPLE_CLIP, SAMPLE_MADE, LABELS, PERSON_LINE, REAL_PERSON_LINE, UGC_LINE, AI_LINE: P.AI_LINE, LABEL_TEXT: C.LABEL_TEXT };
