// Today's top 3 from a task list, by rules a person can check: what is late or due soon, what is
// marked important, what someone else is waiting on, what brings money in, and quick wins.
// Every pick says why. No AI.

const { daysBetween } = require('./dates');

function scoreTask(t, today) {
  let score = 0;
  const why = [];
  if (t.due) {
    const d = daysBetween(today, t.due);
    if (d < 0) {
      score += 60;
      why.push(`${-d === 1 ? 'a day' : `${-d} days`} late`);
    } else if (d === 0) {
      score += 45;
      why.push('due today');
    } else if (d === 1) {
      score += 28;
      why.push('due tomorrow');
    } else if (d <= 3) {
      score += 15;
      why.push(`due in ${d} days`);
    } else if (d <= 7) score += 6;
  }
  if (t.priority === 1) {
    score += 30;
    why.push('you marked it important');
  } else if (t.priority === 3) score -= 15;
  if (t.others) {
    score += 16;
    why.push('someone is waiting on you');
  }
  if (t.money) {
    score += 12;
    why.push('it is about money coming in or going out');
  }
  if (t.minutes <= 15) {
    score += 5;
    why.push('quick to finish');
  } else if (t.minutes >= 180) score -= 6;
  return { score, why };
}

function pickTop(tasks, today, { n = 3, minutes = 0 } = {}) {
  const scored = tasks.map((t, i) => ({ ...t, ...scoreTask(t, today), i })).sort((a, b) => b.score - a.score || a.i - b.i);
  const top = [];
  let used = 0;
  for (const t of scored) {
    if (top.length >= n) break;
    if (minutes && used + t.minutes > minutes && top.length) continue;
    top.push(t);
    used += t.minutes;
  }
  const rest = scored.filter((t) => !top.includes(t));
  const dueToday = scored.filter((t) => t.due && daysBetween(today, t.due) <= 0);
  const notes = [];
  if (dueToday.length > n) notes.push(`${dueToday.length} tasks are due today or late. Pick which of the rest to move, hand off or drop, and tell anyone waiting.`);
  const drop = rest.filter((t) => t.priority === 3 && !t.due && !t.others);
  if (drop.length) notes.push(`Could wait or be dropped: ${drop.slice(0, 4).map((t) => t.title).join('; ')}.`);
  if (used > 6 * 60) notes.push(`Your top 3 add up to about ${Math.round(used / 60)} hours. If the day has meetings, break the biggest one into a first step.`);
  return { top, rest, minutes: used, notes };
}

const reason = (t) => (t.why.length ? t.why.slice(0, 3).join(', ') : 'next on your list');

module.exports = { scoreTask, pickTop, reason };
