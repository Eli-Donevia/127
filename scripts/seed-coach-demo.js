#!/usr/bin/env node
// Seeds the coach platform prototype (lib/coach) with a populated demo: one coach ("Demo Coach", brand Forge
// Hybrid), 8 clients, a 4-day program assigned to all of them with three weeks of logs, weekly check-ins (some
// waiting for review, with placeholder progress "photos": plain gradient images, no people), and a 50-day
// daily-rules challenge ("Demo Coach 50", miss-a-rule-restart mode) with an application-only cohort on its
// leaderboard, one pending application and one client on the open track.
//
//   npm run seed:coach                                   random password, printed once
//   COACH_DEMO_PASSWORD=... npm run seed:coach           set it yourself (never commit it)
//
// Local data/db.json unless DATABASE_URL is set; don't point this at production. Running it again removes the
// previous demo (every doc marked coachDemo) and writes it fresh, relative to today. No email, Stripe or webhooks.

require('../lib/env').load();
const crypto = require('crypto');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const coach = require('../lib/coach');
const chl = require('../lib/coach/challenge');

const DOMAIN = 'demo.127.test';
const PASSWORD = process.env.COACH_DEMO_PASSWORD || crypto.randomBytes(9).toString('base64url');
const today = coach.dateKey();
const D = (n) => coach.addDays(today, n);
// Deterministic "random" so every run looks the same.
let seed = 127;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// A plain vertical gradient PNG (placeholder progress photo; no people, nothing generated to look real).
function gradientPng(w, h, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const v = Math.abs(x - w / 2) < w * 0.18 && y > h * 0.15 && y < h * 0.92 ? 0.82 : 1; // a soft centre band
      raw[o] = Math.round((r1 + (r2 - r1) * t) * v); raw[o + 1] = Math.round((g1 + (g2 - g1) * t) * v); raw[o + 2] = Math.round((b1 + (b2 - b1) * t) * v);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const CLIENTS = [
  // name, adherence (0-1), start weight, weekly change, challenge: [track, status, completion p, restartOn (days ago) or null]
  ['Maya Rodriguez', 0.95, 168, -1.4, ['cohort', 'active', 1, null]],
  ['Jordan Kim', 0.9, 201, -1.8, ['cohort', 'active', 1, 11]],
  ['Priya Shah', 0.85, 152, -0.9, ['cohort', 'active', 1, null]],
  ['Marcus Bell', 0.7, 224, -1.1, ['cohort', 'active', 1, 6]],
  ['Elena Petrova', 0.8, 139, -0.4, ['cohort', 'active', 1, 15]],
  ['Tyler Brooks', 0.4, 189, 0.3, ['cohort', 'active', 1, 3]],
  ['Sam Okafor', 0.6, 176, -0.6, ['open', 'active', 1, 4]],
  ['Chloe Martin', 0.75, 147, -0.8, ['cohort', 'applied', 0, null]],
];

async function wipe() {
  for (const c of ['users', ...['coaches', 'coachPrograms', 'coachAssignments', 'coachWorkoutLogs', 'coachHabitLogs', 'coachCheckins', 'coachChallenges', 'coachChallengeEntries']]) {
    for (const d of db.filter(c, (x) => x.coachDemo)) {
      if (c === 'users' && d.coachPhotos) for (const p of Object.keys(d.coachPhotos)) await db.removeBlob(p);
      await db.remove(c, d.id);
    }
  }
}

const userDoc = async (email, name, extra) => db.save('users', {
  email, name, passwordHash: await bcrypt.hash(PASSWORD, 10), tier: 'free', xp: 0, completed: {}, badges: [], marketingOptIn: false,
  emailVerified: true, signupSource: 'coach-demo', coachDemo: true, demoAccount: true, ...extra,
});

async function main() {
  await db.init();
  await wipe();

  // ---- the coach ----
  const cu = await userDoc(`coach@${DOMAIN}`, 'Demo Coach', { role: 'coach' });
  const { coach: c } = await coach.saveCoach(cu, {
    brandName: 'Forge Hybrid', coachName: 'Demo Coach', slug: 'demo-coach', initials: 'FH', accent: '#ff5a36', niche: 'hybrid',
    headline: 'Lift, run and train hybrid. Coached from your phone.',
    bio: 'Demo Coach is a made-up example coach for the 127 coach platform prototype. Every client, number and check-in on this site is demo data.',
    offerTitle: '1:1 Hybrid Coaching', offerPrice: '199',
    offerBullets: 'A 4-day program built for your gym and schedule\nWeekly check-ins with written feedback\nDaily habit targets: protein, steps, water, sleep\nYour own app with every session and log\nEntry to the next Demo Coach 50 cohort',
    habits: 'Hit 140g protein\n8,000+ steps\n3 litres of water\n7+ hours of sleep',
  });
  c.coachDemo = true;
  c.inviteToken = 'demo-invite';
  await db.save('coaches', c);

  // ---- the program ----
  const ex = (name, sets, reps, rest, note) => ({ name, sets, reps, rest, note: note || '' });
  const week = (n) => ({ days: [
    { title: 'Lower: Strength', exercises: [ex('Barbell Squat', 4, n < 2 ? '6' : '5', '2-3m', `RPE ${7 + Math.min(n, 2) * 0.5}`), ex('Romanian Deadlift', 3, '8', '2m'), ex('Walking Lunge', 3, '10/leg', '90s'), ex('Plank', 3, '45s', '60s')] },
    { title: 'Upper: Push/Pull', exercises: [ex('Barbell Bench Press - Medium Grip', 4, '6', '2-3m', 'RPE 8'), ex('Bent Over Barbell Row', 4, '8', '2m'), ex('Standing Military Press', 3, '8', '90s'), ex('Pullups', 3, 'AMRAP', '90s')] },
    { title: 'Conditioning', exercises: [ex('Rowing, Stationary', 5, '500m', '2m', 'Hard but even'), ex('Kettlebell One-Legged Deadlift', 3, '10', '60s'), ex('Air Bike', 6, '20s on', '40s')] },
    { title: 'Full Body: Power', exercises: [ex('Power Clean', 5, '3', '2m'), ex('Front Barbell Squat', 3, '6', '2m'), ex('Dumbbell Bench Press', 3, '10', '90s'), ex('Farmers Walk', 4, '40m', '90s')] },
  ] });
  const { program: p } = await coach.saveProgram(c, null, { name: 'Hybrid Strength 4-Day', goal: 'Get stronger and fitter at the same time, 4 sessions a week', weeks: [week(0), week(1), week(2), week(3)] });
  p.coachDemo = true;
  await db.save('coachPrograms', p);
  const { program: p2 } = await coach.saveProgram(c, null, { name: 'Busy Pro 3-Day', goal: '45-minute full-body sessions', weeks: [{ days: [week(0).days[0], week(0).days[1], week(0).days[3]] }] });
  p2.coachDemo = true;
  await db.save('coachPrograms', p2);

  // ---- the challenge: 50 days, 7 rules, hard mode, a cohort that started 18 days ago ----
  const cohortStart = D(-17);
  const { challenge: ch } = await chl.save(c, null, {
    name: 'Demo Coach 50', tagline: '50 days. 7 rules. Every single day, or you start again.', days: '50', mode: 'restart', price: '0',
    rules: chl.TEMPLATE_RULES.map((r) => ({ ...r })), pointsPerRule: '10', fullDayBonus: '20',
    cohortOn: 'on', cohortName: 'Founding 50 Cohort', cohortStart, capacity: '12', cohortPrice: '149',
    questions: 'Why now? What has to change?\nWhat will you have done by day 50?\nWhat usually makes you quit?',
    perks: 'Weekly cohort call with Demo Coach\nA private group chat\nFinisher hoodie and a spot on the finisher wall',
  });
  ch.coachDemo = true;
  ch.slug = 'demo-coach-50'; // a stable link for the demo
  await db.save('coachChallenges', ch);
  const photoRule = ch.rules.find((r) => r.proof === 'photo');
  const noteRule = ch.rules.find((r) => r.proof === 'note');
  const BOOKS = ['Atomic Habits, ch. 3', 'Can’t Hurt Me, ch. 5', 'The Obstacle Is the Way', 'Deep Work, part 1', 'Born to Run, ch. 9', 'Meditations, book 2'];

  let ci = 0;
  for (const [name, adh, w0, dw, [track, status, , restartAgo]] of CLIENTS) {
    ci += 1;
    const first = name.split(' ')[0].toLowerCase();
    const joined = D(-22 + (ci % 3));
    const u = await userDoc(`${first}@${DOMAIN}`, name, { role: 'client', coachId: c.id, healthConsent: { at: new Date().toISOString(), version: 'prototype-placeholder', coachId: c.id } });
    u.createdAt = `${joined}T15:00:00.000Z`;
    await db.save('users', u);

    // two placeholder photos (front/side), in the coach's accent tones
    const photos = [];
    for (const [a, b] of [[[255, 120, 80], [40, 30, 40]], [[120, 130, 160], [30, 30, 40]]]) {
      const { id } = await coach.savePhoto(u, 'image/png', gradientPng(240, 320, a, b));
      photos.push(id);
    }

    // program + logs
    await coach.assign(c, u, ci === 8 ? p2.id : p.id, D(-20));
    for (let k = D(-20); k <= today; k = coach.addDays(k, 1)) {
      const s = coach.sessionOn(u, k);
      const isToday = k === today;
      if (s && s.day && !isToday && rnd() < adh) {
        const body = { complete: 'on', sets: s.day.exercises.map((e, i) => Array.from({ length: e.sets }, () => ({ weight: String(Math.round((60 + i * 15 + rnd() * 80) / 5) * 5), reps: String(5 + Math.floor(rnd() * 6)), done: 'on' }))) };
        const { log } = await coach.logWorkout(u, body, k);
        log.coachDemo = true;
        await db.save('coachWorkoutLogs', log);
      }
      if (!isToday || ci === 1) {
        const hb = {};
        c.habits.forEach((h, i) => { if (rnd() < adh + 0.05) hb[`h${i}`] = 'on'; });
        if (isToday) { delete hb.h2; delete hb.h3; }
        const { log } = await coach.logHabits(u, c, hb, k);
        log.coachDemo = true;
        await db.save('coachHabitLogs', log);
      }
    }

    // weekly check-ins: 3 weeks; the oldest two reviewed, this week's waiting (for 5 of them)
    for (let wk = 3; wk >= 1; wk--) {
      if (ci === 6 && wk === 1) continue; // Tyler is late
      const key = D(-7 * wk + 6 - (ci % 3));
      if (key > today) continue;
      const weight = Math.round((w0 + dw * (3 - wk)) * 10) / 10;
      const { checkin } = await coach.submitCheckin(u, {
        weight: String(weight), waist: String(Math.round((w0 / 5.2 - (3 - wk) * 0.3) * 10) / 10), energy: String(6 + (ci % 4)), sleep: String(5 + (ci % 5)), adherence: String(Math.round(adh * 100)),
        wins: ['Hit every session this week', 'Protein every day, first time ever', 'Squat felt smooth at 185', 'Walked 10k steps 6 of 7 days', 'Slept better after cutting late coffee'][(ci + wk) % 5],
        struggles: ['Work travel Thursday, missed conditioning', 'Weekend eating got away from me', 'Knee felt tight on lunges', 'Hard to get the water in', 'Low energy on Monday'][(ci + wk) % 5],
        photos: wk === 1 ? photos : [],
      }, key);
      if (wk > 1 || ci > 5) {
        checkin.reviewedAt = new Date(Date.parse(`${key}T23:00:00Z`)).toISOString();
        checkin.reply = ['Great week. Add 5 lb to squats on Monday and keep the steps where they are.', 'Solid. Travel weeks happen: swap conditioning for a 30-minute hotel circuit.', 'Down again, right on pace. Hold calories; we review in 2 weeks.'][(ci + wk) % 3];
      }
      checkin.coachDemo = true;
      await db.save('coachCheckins', checkin);
    }

    // challenge entry
    if (status === 'applied') {
      const { entry } = await chl.apply(ch, u, { q0: 'My 30th is in March and I keep starting over every Monday.', q1: 'Every rule, 50 days straight, and 10 pounds down.', q2: 'Weekends and late shifts.' });
      entry.coachDemo = true;
      await db.save('coachChallengeEntries', entry);
      continue;
    }
    const start = track === 'cohort' ? cohortStart : D(-9);
    const e = await db.save('coachChallengeEntries', {
      challengeId: ch.id, coachId: c.id, userId: u.id, name, track, status, startedOn: start, days: {}, coachDemo: true,
      answers: track === 'cohort' ? [{ q: ch.cohort.questions[0], a: 'Ready to stop negotiating with myself.' }] : undefined,
      payment: track === 'cohort' ? { demo: true, ...coach.split(ch.cohort.price), at: `${start}T12:00:00.000Z` } : null,
    });
    const restartOn = restartAgo != null ? D(-restartAgo) : null;
    const extraMiss = ci === 6 ? [D(-12), D(-8)] : ci === 4 ? [D(-14)] : [];
    for (let k = start; k <= today; k = coach.addDays(k, 1)) {
      const miss = k === restartOn || extraMiss.includes(k);
      const isToday = k === today;
      const d = { done: {}, proof: {}, journal: '', at: `${k}T21:00:00.000Z` };
      const count = isToday ? (ci === 1 ? 4 : ci % 2 ? 7 : 2 + (ci % 4)) : miss ? 4 + (ci % 3) : ch.rules.length;
      ch.rules.slice(0, count).forEach((r) => { d.done[r.id] = true; });
      if (d.done[photoRule.id]) d.proof[photoRule.id] = { note: null, photo: photos[0] };
      if (d.done[noteRule.id]) d.proof[noteRule.id] = { note: BOOKS[(ci + coach.daysBetween(start, k)) % BOOKS.length], photo: null };
      if (count === ch.rules.length || rnd() < 0.5) d.journal = ['Up at 6:10. Hard start, good day.', 'Long day at work but got it all in.', 'Ran before sunrise. Felt unstoppable.', 'Almost skipped reading. Didn’t.', 'Meal prepped Sunday, made today easy.'][(ci + coach.daysBetween(start, k)) % 5];
      e.days[k] = d;
    }
    await db.save('coachChallengeEntries', e);
  }

  // let the file store flush
  await new Promise((r) => setTimeout(r, 300));
  const board = chl.leaderboard(ch);
  console.log(`Seeded the coach demo (${today}).`);
  console.log(`  Coach:   coach@${DOMAIN}   → /coach/dashboard`);
  console.log(`  Clients: maya@, jordan@, priya@, marcus@, elena@, tyler@, sam@, chloe@${DOMAIN}   → /c/demo-coach/app`);
  console.log(`  Password (all demo accounts): ${PASSWORD}`);
  console.log(`  Site: /c/demo-coach · Challenge: /c/demo-coach/challenge/${ch.slug} · Invite: /c/demo-coach/join?i=demo-invite`);
  console.log(`  Leaderboard: ${board.map((b) => `${b.rank}. ${b.name} day ${b.dayNumber}`).join(' · ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
