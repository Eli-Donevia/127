// HQ's light look (HQ_PREMIUM, public/css/hq-light.css): each member picks System, Light or Dark in Settings, or flips
// it from the rail or the phone's More sheet. System, the default, follows the phone or computer's own setting.
// Only HQ's workspace pages change; the rest of the app keeps its dark look.

const LOOKS = ['system', 'light', 'dark'];

const of = (user) => (user && LOOKS.includes(user.hqTheme) ? user.hqTheme : 'system');

// Settings offers the choice only to members who see the premium workspace.
function offered(user) {
  try {
    return require('./nav').on() && require('./flags').on('HQ_PREMIUM', user);
  } catch (e) {
    return false;
  }
}

module.exports = { LOOKS, of, offered };
