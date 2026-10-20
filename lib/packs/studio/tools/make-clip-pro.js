// The higher-quality clip: up to 8 seconds, with sound where the model makes it (Veo class models).
module.exports = require('../lib/clip-tool').makeTool({
  name: 'studio.make_clip_pro',
  title: 'Make a premium AI clip',
  description: 'Makes a higher-quality AI video clip of up to 8 seconds, with sound where the model makes it, from a shot description and your photo when you add one.',
  kind: 'video',
  credits: 240,
  prefer: ['gemini', 'fal', 'runway'],
  audio: true,
});
