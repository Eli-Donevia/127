// Media studio (W4): make video, images and sound with AI models (fal, Higgsfield, Runway, Luma,
// ElevenLabs, Gemini), edit any video on the server's ffmpeg (captions, silence and filler cuts, jump
// cuts, reframes, hook titles, music with ducking, b-roll, a brand outro), and write video prompts
// that work for each model. Every model service is held for Legal (lib/harness/needs.js), so until
// one is cleared and its key is set, generation steps make labeled samples and cost nothing; the
// editing steps are real wherever ffmpeg is installed.
//
// Held (contract v1.10): the pack loads only when PACKS_ON names it (or PACKS_ON=all).
// Parts: lib/area-gen.js (generation), lib/area-edit.js (editing on the render lane),
// lib/area-motion.js (animated cards and captions with HyperFrames, when the server has it),
// lib/area-prompts.js (prompt packs). Each exports { tools, workflows }.

const parts = [require('./lib/area-gen'), require('./lib/area-edit'), require('./lib/area-motion'), require('./lib/area-prompts')];

module.exports = {
  id: 'studio',
  title: 'Media studio',
  version: '0.1.0',
  summary: 'Make product ads, UGC-style ads, faceless videos, image ads and b-roll with AI video and image models, edit any video (captions, cuts, reframes, music, outro), and get prompts written for each model.',
  niches: [],
  business: false,
  held: true,
  uses: ['video', 'ads'],
  system: ['ffmpeg'],
  tools: parts.flatMap((p) => p.tools),
  workflows: parts.flatMap((p) => p.workflows),
};
