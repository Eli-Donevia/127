#!/usr/bin/env node
// Creates or resets the demo member Eli signs in to for the tour on the Debrief live (Mon Nov 16, 8pm ET;
// conversion/challenge/scripts.md: "A laptop logged in to a demo account", ready by noon ET that day).
//
//   npm run seed:demo                       uses DEMO_EMAIL (default demo@example.com) and DEMO_PASSWORD
//   DEMO_PASSWORD=... npm run seed:demo     set the password yourself (never commit it)
//
// Without DEMO_PASSWORD a random password is generated and printed once, here, and nowhere else.
// Run it against the live database (DATABASE_URL) to use it on 127group.io; without DATABASE_URL it writes
// the local data/db.json. Running it again resets the demo to the same starting point (and a new password,
// unless DEMO_PASSWORD is set).
//
// The member is obviously fake: "Maya Demo", an example tutoring business (the scripts' "Maya" example),
// week 1 of the Start track done, one week-2 step done, two early milestones. No money milestones, no wins
// posted, no AI history, no real person's data. It's on Builder (DEMO_TIER) so the tour shows all 4 weeks and
// the Library with no upgrade prompts or prices, flagged demoBilling (out of MRR) and demoAccount
// (out of the ad desk's builders count). It never sends email or calls Klaviyo, Stripe or webhooks.

require('../lib/env').load();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ANSWERS = {
  stage: 'validating',
  model: 'local',
  goal: 'validate',
  obstacles: ['where_to_start', 'time'],
  time: '3to7',
  channels: ['instagram'],
  outcome: 'Book my first 5 tutoring students this semester. (Example account.)',
  budget: 'lt100',
  ai_comfort: 'dabble',
  learning: ['templates', 'playbooks'],
  why: 'This is a demo account for showing 127 on a live. Example only.',
  circle_interest: 'not_now',
  source: 'instagram',
};

// Pure: the demo member's fields. existing keeps the id (and createdAt) so a reset doesn't make a second account.
function demoUser({ existing, email, passwordHash, tier = 'builder', now = Date.now() }) {
  const roadmap = require('../lib/roadmap');
  const gamify = require('../lib/gamify');
  const iso = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString();
  const rm = roadmap.generate(ANSWERS);
  const completed = {};
  const w1 = rm.weeks[0].tasks;
  w1.forEach((t, i) => { completed[t.id] = iso(9 - i); });
  const w2first = rm.weeks[1] && rm.weeks[1].tasks[0];
  if (w2first) completed[w2first.id] = iso(2);
  const milestones = { idea_test: iso(8), conversations: iso(3) };
  const { MILESTONES } = require('../lib/milestones');
  const xp = 50 + roadmap.allTasks(rm).filter((t) => completed[t.id]).reduce((s, t) => s + t.xp, 0) +
    MILESTONES.filter((m) => milestones[m.id]).reduce((s, m) => s + m.xp, 0);
  const user = {
    ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    email,
    name: 'Maya Demo',
    passwordHash,
    tier,
    demoAccount: true,
    demoBilling: true,
    emailVerified: true,
    marketingOptIn: false,
    signupSource: 'demo',
    utm: null,
    referredBy: null,
    answers: ANSWERS,
    answersHistory: [{ at: iso(10), answers: ANSWERS }],
    roadmap: rm,
    roadmapNote: null,
    completed,
    milestones,
    badges: [],
    xp,
    onboardedAt: iso(10),
    activatedAt: iso(9),
    worksheets: {},
    feedback: {},
    resourcesDone: {},
    aiHistory: [],
    chat: [],
    aiUsage: null,
  };
  gamify.refreshBadges(user);
  return user;
}

async function main() {
  const db = require('../lib/db');
  const email = String(process.env.DEMO_EMAIL || 'demo@example.com').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('DEMO_EMAIL is not a valid email.');
  const tier = ['free', 'builder', 'circle'].includes(process.env.DEMO_TIER) ? process.env.DEMO_TIER : 'builder';
  await db.init();
  const existing = db.find('users', (u) => u.email === email);
  // Never take over a real member's account.
  if (existing && !existing.demoAccount) throw new Error(`${email} belongs to a real account. Pick another DEMO_EMAIL.`);
  const given = process.env.DEMO_PASSWORD || '';
  if (given && given.length < 12) throw new Error('DEMO_PASSWORD needs at least 12 characters.');
  const password = given || crypto.randomBytes(12).toString('base64url');
  const user = demoUser({ existing, email, passwordHash: await bcrypt.hash(password, 10), tier });
  await db.save('users', user);
  await new Promise((r) => setTimeout(r, 300)); // let the local file store flush
  console.log(`Demo member ${existing ? 'reset' : 'created'}: ${email} (${tier}, ${Object.keys(user.completed).length} steps done, ${user.xp} XP)`);
  console.log(given ? 'Password: the DEMO_PASSWORD you set.' : `Password (shown once, not stored anywhere in plain text): ${password}`);
  console.log('Sign in at /login. Run this again to reset it before the live.');
}

if (require.main === module) {
  main().then(() => process.exit(0), (err) => { console.error(`[seed:demo] ${err.message}`); process.exit(1); });
}

module.exports = { demoUser, ANSWERS };
