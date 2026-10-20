// The animated designs (W6): First Light standard motion from lib/motion.js on top of the same facts and words as the
// plain designs. Each module is a plain design ({ id, name, bestFor, slots, nav, render }) plus:
//   kind   which of the 8 kinds of business it's for (its words, buttons and sections follow the kind)
//   why    one line on what it's built for (the design picker shows it)
//   fonts  its own Google Fonts pair ({ q, display: [name, stack], body: [name, stack] }), optional
// and render returns { body, css, script } (script: lib/motion.js MOTION_JS plus anything of its own).
const IDS = ['beacon', 'atelier', 'supper', 'northstar', 'gather', 'launch', 'market', 'orbit', 'soon', 'foundry', 'frame', 'spotlight', 'linkstack'];
module.exports = IDS.filter((n) => require('fs').existsSync(`${__dirname}/${n}.js`)).map((n) => require(`./${n}`));
