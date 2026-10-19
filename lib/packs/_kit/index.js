// The shared kit for the 127 workflow library. Not a pack: the harness loader skips folders that
// start with "_". Packs require what they need: const { text, files, views } = require('../_kit');
// Modules that call outside services or need system tools (scan, places, media) are loaded lazily.

const kit = {
  text: require('./text'),
  money: require('./money'),
  time: require('./time'),
  brain: require('./brain'),
  ai: require('./ai'),
  schema: require('./schema'),
  files: require('./files'),
  views: require('./views'),
  save: require('./save'),
  web: require('./web'),
  color: require('./color'),
  quote: require('./quote'),
  crowd: require('./crowd'),
  first25: require('./first25'),
  booked: require('./booked'),
};

for (const lazy of ['scan', 'places', 'qr', 'svg', 'media', 'outreach', 'leads', 'talk']) {
  Object.defineProperty(kit, lazy, {
    enumerable: true,
    get() {
      return require(`./${lazy}`);
    },
  });
}

module.exports = kit;
