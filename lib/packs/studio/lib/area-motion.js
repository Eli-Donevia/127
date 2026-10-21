// The motion part of the studio pack: animated cards and kinetic captions rendered with HyperFrames
// (lib/motion.js) when the server has it, with ffmpeg versions otherwise. index.js joins the parts.

const M = require('./edit-media');
const { VIDEO_TRANSCRIBED } = require('./area-edit');

const tools = [require('../tools/motion-card'), require('../tools/motion-captions')];

const workflows = [
  {
    id: 'studio.animated_card',
    title: 'Make an animated end card',
    promise: 'A short animated card in your colors: your name rises in, a line draws, a light sweeps it, then your line and button settle.',
    proof: 'One MP4 card in the shape you pick',
    minutes: 1,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        kind: { type: 'string', title: 'Which card', enum: ['end', 'title'], default: 'end', description: 'end closes a video with your name, a line and a button. title opens one.' },
        name: { type: 'string', title: 'Business name or title (optional, we use your profile)', maxLength: 60 },
        line: { type: 'string', title: 'A short line (optional)', description: 'Like "Hand-poured in Tulsa" or "Book a free 20 minute call".', maxLength: 90 },
        cta: { type: 'string', title: 'Button text (optional)', description: 'Like "Book at yoursite.com". Leave it out to use your @handle.', maxLength: 48 },
        logo: { type: 'string', format: 'asset', accept: 'image/*', title: 'Your logo (optional)' },
        aspect: { type: 'string', title: 'Shape', enum: M.ASPECTS, default: '9:16', description: '9:16 for Reels, TikTok and Shorts; 1:1 or 4:5 for feeds; 16:9 for YouTube.' },
        color: { type: 'string', title: 'Brand color (optional hex, like #c2410c)', maxLength: 9 },
      },
    },
    steps: [{ id: 'card', tool: 'studio.motion_card', input: { kind: '$inputs.kind', name: '$inputs.name', line: '$inputs.line', cta: '$inputs.cta', logo: '$inputs.logo', aspect: '$inputs.aspect', color: '$inputs.color' } }],
    result: ['card'],
    next: [
      { id: 'studio.animated_captions', why: 'Animated captions for the video it closes.' },
      { id: 'studio.edit_video', why: 'Cut, caption and score a video in one run.' },
    ],
  },
  {
    id: 'studio.animated_captions',
    title: 'Animated captions on your video',
    promise: 'Your video with captions that move: a few words at a time, each rising in as you say it, the spoken word lit up in your color, clear of the app buttons.',
    proof: 'Your video as an MP4 with animated captions and your own sound',
    minutes: 3,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        video: VIDEO_TRANSCRIBED,
        color: { type: 'string', title: 'Brand color (optional hex, like #c2410c)', maxLength: 9 },
      },
    },
    steps: [
      { id: 'load', tool: 'video.load_video', title: 'Open the video for transcription', input: { file: '$inputs.video', maxMinutes: 3 } },
      { id: 'words', tool: 'video.transcribe', each: '$load.blocks', concurrency: 3, estimate: 3, input: { source: '$load.source', block: '$item' } },
      { id: 'captions', tool: 'studio.motion_captions', input: { video: '$inputs.video', words: '$words', color: '$inputs.color' } },
    ],
    result: ['captions'],
    next: [
      { id: 'studio.animated_card', why: 'End it on an animated card in your colors.' },
      { id: 'studio.reframe_all', why: 'Every shape of it for your other channels.' },
    ],
  },
];

module.exports = { tools, workflows };
