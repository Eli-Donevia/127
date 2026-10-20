// The edit part of the studio pack: real edits on the server's ffmpeg (lib/edit.js), no keys needed.
// Tools: clean cut, reframe, hook title, music bed, b-roll, end card, captions, assemble (used by the
// generation workflows), hook variants and image ads in every size. Workflows: edit a video in one
// run, test hook variants, reframe to every shape, add a brand end card. index.js joins the parts.

const C = require('./edit-captions');
const M = require('./edit-media');

const VIDEO = { type: 'string', format: 'asset', accept: 'video/*', title: 'Your video', description: 'An MP4 or MOV from your phone or computer, up to 3 minutes. Leave it out to try a sample clip.' };
// A video this workflow transcribes carries Legal's recording-consent line (row 8, V7).
const CONSENT = "Only add recordings everyone in them agreed to. Some states require everyone's OK to record a call.";
const VIDEO_TRANSCRIBED = { ...VIDEO, description: CONSENT };
const ASPECT = { type: 'string', title: 'Shape', enum: M.ASPECTS, default: '9:16', description: '9:16 for Reels, TikTok and Shorts; 1:1 or 4:5 for feeds; 16:9 for YouTube.' };
const FILL = { type: 'string', title: 'Fill the new shape by', enum: ['crop', 'blur'], default: 'crop', description: 'crop fills the frame and trims the sides; blur shows the whole picture over a soft blurred copy.' };
const HANDLE = { type: 'string', title: 'Your @handle (optional, we use your profile)', maxLength: 40 };
const LINE = { type: 'string', title: 'End card line (optional)', description: 'Like "Book a free 20 minute call" or what you do.', maxLength: 90 };

const tools = [
  require('../tools/edit-clean'),
  require('../tools/edit-reframe'),
  require('../tools/edit-hook'),
  require('../tools/edit-music'),
  require('../tools/edit-broll'),
  require('../tools/edit-outro'),
  require('../tools/edit-captions'),
  require('../tools/assemble'),
  require('../tools/hook-write'),
  require('../tools/hook-variant'),
  require('../tools/ad-sizes'),
];

const workflows = [
  {
    id: 'studio.edit_video',
    title: 'Edit your video in one go',
    promise: 'Your talking video with the pauses cut, reframed for Reels, a hook title, captions, music and your end card, in one run.',
    proof: 'One finished MP4 ready to post, plus each stage on its own',
    minutes: 4,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        video: VIDEO_TRANSCRIBED,
        clean: { type: 'boolean', title: 'Cut the pauses', default: true },
        fillers: { type: 'boolean', title: 'Cut filler words (um, uh) too', default: true },
        jumpCuts: { type: 'boolean', title: 'Punch in on the cuts (jump cuts)', default: false },
        reframe: { type: 'boolean', title: 'Change the shape', default: true },
        aspect: ASPECT,
        fill: FILL,
        hook: { type: 'string', title: 'Hook title for the first seconds (optional)', maxLength: 90 },
        captions: { type: 'boolean', title: 'Captions', default: true },
        style: { type: 'string', title: 'Caption look', enum: C.STYLES, default: 'bold', description: 'bold, box, clean, karaoke (color sweeps through the line), pop (one big word at a time) or minimal.' },
        music: { type: 'boolean', title: 'Music bed under your voice', default: true },
        outro: { type: 'boolean', title: 'Brand end card', default: true },
        line: LINE,
        handle: HANDLE,
      },
    },
    steps: [
      { id: 'load', tool: 'video.load_video', when: '$inputs.captions', title: 'Open the video for transcription', input: { file: '$inputs.video', maxMinutes: 3 } },
      { id: 'words', tool: 'video.transcribe', when: '$inputs.captions', each: '$load.blocks', concurrency: 3, estimate: 3, input: { source: '$load.source', block: '$item' } },
      { id: 'clean', tool: 'studio.edit_clean', when: '$inputs.clean', input: { video: '$inputs.video', words: '$words', fillers: '$inputs.fillers', jumpCuts: '$inputs.jumpCuts' } },
      { id: 'frame', tool: 'studio.edit_reframe', when: '$inputs.reframe', input: { video: '$inputs.video', chain: ['$clean.video'], aspects: ['$inputs.aspect'], fill: '$inputs.fill' } },
      { id: 'hook', tool: 'studio.edit_hook', when: '$inputs.hook', input: { video: '$inputs.video', chain: ['$clean.video', '$frame.video'], text: '$inputs.hook' } },
      { id: 'captions', tool: 'studio.edit_captions', when: '$inputs.captions', input: { video: '$inputs.video', chain: ['$clean.video', '$frame.video', '$hook.video'], words: '$words', retimed: '$clean.words', style: '$inputs.style' } },
      { id: 'outro', tool: 'studio.edit_outro', when: '$inputs.outro', input: { video: '$inputs.video', chain: ['$clean.video', '$frame.video', '$hook.video', '$captions.video'], line: '$inputs.line', handle: '$inputs.handle' } },
      { id: 'music', tool: 'studio.edit_music', when: '$inputs.music', input: { video: '$inputs.video', chain: ['$clean.video', '$frame.video', '$hook.video', '$captions.video', '$outro.video'] } },
    ],
    result: ['music', 'outro', 'captions', 'hook', 'frame', 'clean'],
    next: [
      { id: 'studio.hook_variants', why: 'Test five openings on this video and keep the one people watch.' },
      { id: 'studio.reframe_all', why: 'Get the square, 4:5 and wide versions for your other channels.' },
    ],
  },
  {
    id: 'studio.hook_variants',
    title: 'Test hook variants',
    promise: 'Hook lines written for your video, then up to 5 versions of it, each opening with a different hook to test.',
    proof: 'Up to 5 MP4s of the same video with different openings, and the hook lines',
    minutes: 5,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        video: VIDEO,
        topic: { type: 'string', title: 'What the video is about (optional, we use your profile)', maxLength: 160 },
        audience: { type: 'string', title: 'Who it is for (optional)', maxLength: 120 },
        style: { type: 'string', title: 'Hook look', enum: C.HOOK_STYLES, default: 'box' },
      },
    },
    steps: [
      { id: 'hooks', tool: 'studio.write_hooks', input: { topic: '$inputs.topic', audience: '$inputs.audience', count: 8 } },
      { id: 'pick', approve: { title: 'Pick up to 5 hooks to test', choose: '$hooks.hooks', label: 'text', detail: 'line', max: 5, note: 'Each one becomes its own version of your video, with the hook on the first 3 seconds.' } },
      { id: 'variants', tool: 'studio.hook_variant', each: '$pick.chosen', concurrency: 1, estimate: 5, input: { video: '$inputs.video', hook: '$item', style: '$inputs.style' } },
    ],
    result: ['variants', 'hooks'],
    next: [
      { id: 'studio.edit_video', why: 'Cut, caption and score the version that wins.' },
      { id: 'studio.reframe_all', why: 'Every shape of the winner for your other channels.' },
    ],
  },
  {
    id: 'studio.reframe_all',
    title: 'One video in every shape',
    promise: 'Your video as 9:16, 1:1, 4:5 and 16:9 in one go, cropped where you want or fitted over a soft blur.',
    proof: 'Up to four MP4s, one per shape',
    minutes: 2,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        video: VIDEO,
        aspects: { type: 'array', title: 'Shapes', items: { type: 'string', enum: M.ASPECTS }, default: ['9:16', '1:1', '4:5', '16:9'] },
        fill: FILL,
        focus: { type: 'number', title: 'Where to frame, 0 left to 1 right', minimum: 0, maximum: 1, default: 0.5 },
      },
    },
    steps: [{ id: 'frames', tool: 'studio.edit_reframe', input: { video: '$inputs.video', aspects: '$inputs.aspects', fill: '$inputs.fill', focus: '$inputs.focus' } }],
    result: ['frames'],
    next: [
      { id: 'studio.brand_outro', why: 'End each one on your brand card.' },
      { id: 'studio.edit_video', why: 'Cut the pauses and add captions first.' },
    ],
  },
  {
    id: 'studio.brand_outro',
    title: 'Add your brand end card',
    promise: 'Your video ending on a card in your colors with your business name, a short line, your @handle and logo.',
    proof: 'Your video with the end card joined on',
    minutes: 2,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        video: VIDEO,
        line: LINE,
        handle: HANDLE,
        logo: { type: 'string', format: 'asset', accept: 'image/*', title: 'Your logo (optional)' },
        color: { type: 'string', title: 'Brand color (optional hex, like #c2410c)', maxLength: 9 },
      },
    },
    steps: [{ id: 'outro', tool: 'studio.edit_outro', input: { video: '$inputs.video', line: '$inputs.line', handle: '$inputs.handle', logo: '$inputs.logo', color: '$inputs.color' } }],
    result: ['outro'],
    next: [
      { id: 'studio.edit_video', why: 'Cut, caption and score your next video in one run.' },
      { id: 'studio.reframe_all', why: 'Every shape of this video for your other channels.' },
    ],
  },
];

module.exports = { tools, workflows };
