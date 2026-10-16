// Founder's Circle transactional emails, plain text. Copy is from the Founder's Circle
// experience team's applications.md ("Decisions and messages", 1-9) and recap.md
// (email version). No em dashes, no hype, no income claims.
//
// Every function returns { subject, text }; lib/circle.js sends them through
// integrations.sendEmail, so they go out whatever the member's marketing consent.

function first(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}
function seat(n) {
  return String(n || 0).padStart(2, '0');
}
function lines(...parts) {
  return parts.filter((p) => p !== null && p !== undefined).join('\n\n');
}

// 1. Received (automatic, when the application lands)
function received({ name }) {
  return {
    subject: 'Got your application',
    text: lines(
      `Thanks, ${first(name)}. Eli reads every Founder's Circle application himself, and you'll hear back within 2 weekdays. While you wait, keep going on your roadmap: it's the same work the Circle builds on.`
    ),
  };
}

// 2. Approved, seat open
function approvedSeatOpen({ name, seatNo, claimUrl, firstCall, handbookUrl, profileUrl }) {
  return {
    subject: "You're in: your seat is ready",
    text: lines(
      `${first(name)}, you're in. Seat ${seat(seatNo)} is yours to claim for the next 72 hours.`,
      `Claim it here: ${claimUrl}. $299 a month, cancel online any time.`,
      `Your first call is ${firstCall}. Before then: fill in your Founder Profile (10 minutes) and read the handbook. See you at the table.`,
      `Founder Profile: ${profileUrl}\nHandbook: ${handbookUrl}`,
      'Eli'
    ),
  };
}

// 3. Claim reminder (24 hours before the 72 hours end, only if not claimed)
function claimReminder({ seatNo, until, claimUrl }) {
  return {
    subject: `Your seat is held until ${until}`,
    text: lines(
      `Quick reminder: Seat ${seat(seatNo)} is held for you until ${until}. After that it goes to the next person in line.`,
      `Claim my seat: ${claimUrl}`
    ),
  };
}

// 4. Claim window ended (not claimed)
function claimEnded() {
  return {
    subject: 'Your seat went to the next founder',
    text: "No problem, timing matters. You're still approved for 6 months: reply when you're ready and you'll be first in line for the next open seat.",
  };
}

// 5. Approved, no seat yet
function approvedWaiting({ name, position }) {
  return {
    subject: "You're approved. The table is full right now.",
    text: lines(
      `${first(name)}, you're approved for the Founder's Circle. All four seats are taken today, and you're ${ordinal(position)} in line. When a seat opens, you'll get it first, with 72 hours to claim it. Your approval stands for 6 months.`,
      'Eli'
    ),
  };
}

// 6. A seat opened (to the first approved applicant in line)
function seatOpened({ seatNo, claimUrl }) {
  return {
    subject: 'A seat just opened',
    text: `Seat ${seat(seatNo)} is open, and it's yours first. You have 72 hours to claim it: ${claimUrl}.`,
  };
}

// 7. Fit call
function fitCall({ name, bookingUrl }) {
  return {
    subject: '10 minutes with Eli?',
    text: lines(
      `Thanks for applying, ${first(name)}. Before I decide, I'd like 10 minutes on video. Pick a time that works: ${bookingUrl}. It's a conversation, not a pitch.`,
      'Eli'
    ),
  };
}

// 8. Not yet (Eli writes the reason and what would change his answer)
function notYet({ name, reason, change, nextStep }) {
  return {
    subject: "Not yet, and here's why",
    text: lines(
      `Thanks for applying, ${first(name)}. Not yet. ${sentence(reason)}`,
      `What would change my answer: ${sentence(change)} When that's true, apply again. Your answer here carries over.`,
      `Until then, ${nextStep} is built for exactly this stage.`,
      'Eli'
    ),
  };
}

// 9. Decline (red flags only)
function decline({ name }) {
  return {
    subject: 'About your application',
    text: lines(
      `Thanks for applying, ${first(name)}. The Founder's Circle isn't the right fit for what you're looking for, so I'm not offering a seat. I wish you well with what you're building.`,
      'Eli'
    ),
  };
}

// The call recap, email version (recap.md): personal block, seat number, the group post unchanged,
// a link back to the Circle and the footer.
function recap({ callLabel, commitments, seatNo, post, circleUrl }) {
  const mine = (commitments || []).filter(Boolean);
  return {
    subject: `Circle recap: ${callLabel}`,
    text: lines(
      mine.length ? `Your commitments: ${mine.join('; ')}.` : 'Your commitments: none recorded for you this week.',
      `Seat ${seat(seatNo)}`,
      String(post || '').trim(),
      `Open the Circle: ${circleUrl}`,
      "You get this because you're in the Founder's Circle. What's said in the Circle stays in the Circle."
    ),
  };
}

// Scorecard open (48 hours before the call) and the one reminder, 9am ET the day before (scorecard.md).
function scorecardOpen({ day, label, url }) {
  return {
    subject: `Your Scorecard for ${label} is open`,
    text: lines(`Your Scorecard for ${day} is open. 3 minutes.`, url, "It's due at midnight ET the night before the call."),
  };
}
function scorecardReminder({ day, url }) {
  return {
    subject: 'Your Scorecard is due at midnight ET',
    text: lines(`Your Scorecard for ${day} isn't in yet. It's due at midnight ET tonight, and it takes 3 minutes.`, url),
  };
}

function sentence(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
function ordinal(n) {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  if (n >= 1 && n <= words.length) return words[n - 1];
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = { scorecardOpen, scorecardReminder, received, approvedSeatOpen, claimReminder, claimEnded, approvedWaiting, seatOpened, fitCall, notYet, decline, recap, seat, ordinal };
