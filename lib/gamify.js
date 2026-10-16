// Levels use a building metaphor (Psalm 127: "Unless the Lord builds the house...").
// XP is earned for finishing real work (roadmap steps, resources, wins), not for clicks.

const LEVELS = [
  { name: 'Groundwork', min: 0 },
  { name: 'Foundation', min: 100 },
  { name: 'Framing', min: 250 },
  { name: 'Raised', min: 500 },
  { name: 'Built', min: 900 },
];

const BADGES = {
  roadmap: { label: 'Blueprint drawn', desc: 'Completed the founder assessment' },
  first_step: { label: 'First step', desc: 'Finished your first roadmap step' },
  week_one: { label: 'Week one', desc: 'Finished every step in week one' },
  first_win: { label: 'First win shared', desc: 'Posted a win to the board' },
  halfway: { label: 'Halfway', desc: 'Finished half your roadmap' },
  roadmap_done: { label: '30 days built', desc: 'Finished your whole roadmap' },
  // Awarded by lib/billing.js with the founding number; only shown once earned.
  founding: { label: 'Founding member', desc: 'Joined Builder at the founding price', earnedOnly: true },
};

function level(xp = 0) {
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  const pct = next ? Math.round(((xp - current.min) / (next.min - current.min)) * 100) : 100;
  return { ...current, next, pct, index: LEVELS.indexOf(current) + 1, total: LEVELS.length };
}

function award(user, badge) {
  user.badges = user.badges || [];
  if (!user.badges.includes(badge)) {
    user.badges.push(badge);
    return true;
  }
  return false;
}

// Recompute badges from roadmap progress.
function refreshBadges(user) {
  const tasks = (user.roadmap && user.roadmap.weeks.flatMap((w) => w.tasks)) || [];
  const done = tasks.filter((t) => user.completed && user.completed[t.id]);
  if (user.roadmap) award(user, 'roadmap');
  if (done.length >= 1) award(user, 'first_step');
  const w1 = user.roadmap && user.roadmap.weeks[0];
  if (w1 && w1.tasks.every((t) => user.completed && user.completed[t.id])) award(user, 'week_one');
  if (tasks.length && done.length >= tasks.length / 2) award(user, 'halfway');
  if (tasks.length && done.length === tasks.length) award(user, 'roadmap_done');
}

module.exports = { LEVELS, BADGES, level, award, refreshBadges };
