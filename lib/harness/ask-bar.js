// HQ's ask bar (HQ_PREMIUM): the question it opens on and the grey examples it turns through, drawn from the member's
// own Brain so each member sees their own jobs. Words only; nothing here runs anything.

const brain = require('./brain');

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t;
};

function forUser(user) {
  const first = String((user && user.name) || '').trim().split(/\s+/)[0];
  let b = {};
  try { b = brain.snapshot(user).business || {}; } catch (e) { b = {}; }
  const city = clip(b.city, 24);
  const who = clip(b.audience, 28).replace(/^(a|an|the)\s+/i, '');
  const examples = [
    city ? `Find 25 ${who || 'businesses'} in ${city} to pitch` : `Find 25 ${who || 'local businesses'} to pitch`,
    'Write follow-ups for the ones who went quiet',
    b.offer || b.what ? `Help me price my ${clip(b.offer || b.what, 32).replace(/^(a|an|my|the)\s+/i, '')}` : 'Help me price my offer',
    "Draft this week's posts in my voice",
  ];
  return { prompt: first ? `What's next, ${clip(first, 20)}?` : "What's next?", examples };
}

module.exports = { forUser };
