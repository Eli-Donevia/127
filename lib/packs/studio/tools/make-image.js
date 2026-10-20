// Make one AI image: a product scene, an ad background or a thumbnail base, from words, or built on
// the member's own photo when the model can edit one.
module.exports = require('../lib/clip-tool').makeTool({
  name: 'studio.make_image',
  title: 'Make an AI image',
  description: 'Makes an AI image from a description, or builds a new scene around your own product photo, in the shape you pick (square, portrait, story or wide).',
  kind: 'image',
  credits: 10,
});
