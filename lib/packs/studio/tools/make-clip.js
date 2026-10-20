// Make one AI video clip from a shot (and a start photo when given): about 5 seconds on the
// first video model that is switched on and fits the price. A labeled sample until one is.
module.exports = require('../lib/clip-tool').makeTool({
  name: 'studio.make_clip',
  title: 'Make an AI clip',
  description: 'Makes a short AI video clip (about 5 seconds) from a shot description, starting from your photo when you add one. Uses the first video model that is switched on (fal, Higgsfield, Runway, Luma or Google Veo).',
  kind: 'video',
  credits: 90,
});
