// The Founding Five (v2/proof/founding-five.md). Founding members apply in HQ from doors open (Tue Nov
// 17, 10am ET) to doors close (Tue Nov 24, 11:59pm ET); Eli scores each application 1 to 3 on four
// things and picks five and two alternates on Wed Nov 25. It's a trade, not a prize: four 20-minute
// group build sessions with Eli for documenting their build. Offer's words: conversion/offer.md §4.
// Legal's words: legal/handoffs/proof.md part 3 (L58 to L62). Members' site spec, for the picks, the
// sessions and the ops feed: ops/members/site-changes/founding-five.md.
//
// Rules this file keeps
// - Who can apply: founding members on Builder or the Circle now. No age band and no gender anywhere
//   (Legal): only "Are you 18 or older?", and a no ends the application and opens the site's age
//   review (lib/age-check.js). No age is stored.
// - Four boxes, unticked until the member ticks them; each tick is kept with its time and the
//   wording's version.
// - Hello videos are used only to pick the five (Legal L60): a not-picked applicant's video goes 7
//   days after the picks and the whole application 25 days after (Legal promises 30; Members want the
//   videos gone by Dec 25), an alternate's after January 6 unless they step in, a picked member's
//   video 30 days after the pick, and a withdrawn application at once.
// - A piece of the five's build is shared only after its member's yes in HQ, kept with the date, the
//   piece and the version of the words they agreed to (Legal 06 A2, L63).
// - Videos are stored in 4 MB parts, so a phone video never sits in memory whole.
// - The ops feed never carries emails, video files or video links.

const fs = require('fs');
const path = require('path');

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  ageFlag: (user, info) => require('./age-check').flag(user, info),
};
function _setDeps(over) {
  Object.assign(deps, over);
}

const DAY = 864e5;
const MB = 1024 * 1024;
const CHUNK = 4 * MB;
const ET = 'America/New_York';

// ---------- the words ----------

// Legal's part 3 wording (L60 and L63, Oct 19). Bump the version whenever the boxes or the note change.
const WORDS_VERSION = 'legal-L63-2026-10-19';

const CARD = {
  label: 'The Founding Five',
  title: 'Build alongside Eli for four weeks.',
  body: 'Building your first business? Five founding members get four 20-minute group build sessions with Eli, on Wednesdays at 8pm ET: December 2, 9 and 16, and January 6. In return, you document your build: a 60-second video each week, and your sends, replies, calls and yeses in HQ. It costs nothing extra. Applications close Tuesday, November 24 at 11:59pm ET, and Eli picks on November 25.',
  cta: 'Apply in 5 minutes',
  // Offer section 4: the card's image shows a mix of founders, different ages and genders. Graphics' photo goes in
  // public/img/founding-five/ as card.webp, card.jpg or card.png; until then the card has none.
  image: ['webp', 'jpg', 'png'].map((x) => `/img/founding-five/card.${x}`).find((f) => fs.existsSync(path.join(__dirname, '..', 'public', f))) || '',
};

const QUESTIONS = {
  what: { label: 'What are you starting, and who pays for it?', hint: 'One or two lines.', max: 280 },
  where: { label: 'Where are you based?', hint: 'City and state.', max: 80 },
  adult: { label: 'Are you 18 or older?' },
  hours: { label: 'How many hours a week can you give it for the next four weeks?' },
  done: { label: 'What have you done on it so far?', hint: '"Nothing yet" is a fine answer.', max: 280 },
  video: { label: "Film a 30-second hello on your phone: who you are and what you're starting." },
};

const BOXES = [
  { key: 'document', lead: "If I'm picked, I'll document my build for four weeks:", rest: 'a 60-second "where I\'m starting" video by Sunday, November 29, then a 60-second video each week, and my real numbers in HQ (sends, replies, calls, yeses). No money amounts.' },
  { key: 'share', lead: "If I'm picked, 127 may share my first name, my videos and my first wins", rest: "in its posts and emails, with a line saying I got four group sessions with Eli for sharing my build. I'll see each piece first and can say no to any of it. 127 won't put me in a paid ad unless I say yes to that ad, and won't use AI to change my face, voice or words." },
  { key: 'stayBuilder', lead: "If I'm picked, I'll stay a Builder member through January 6, 2027.", rest: 'I can still cancel, pause or ask for my refund any time, and if I do, my place goes to an alternate.' },
  { key: 'private', lead: "If I'm picked, I'll keep what the other four share in the sessions private", rest: "(their ideas, numbers, customers and anything personal), and I won't record, screenshot or run my own note-taker on the sessions." },
];

const NOTE = "Eli picks five members and two alternates on November 25 using four scores: how clear you are about who pays, the hours you can give it, being on camera, and what you've already done. It isn't a contest and there's no prize: it's a trade, four group sessions for documenting your build. We use your answers and your hello video only to pick the five. If you're not picked, we delete your application and video within 30 days. Alternates' are deleted after January 6 unless they step in.";

// Offer's Nov 25 words (offer.md §4), shown on the card once Eli confirms his picks.
const RESULTS = {
  picked: 'You\'re one of the Founding Five. Our first session is Wednesday, December 2 at 8pm ET, then December 9 and 16 and January 6. Before then, film your 60-second "where I\'m starting" video by Sunday, November 29. You\'ll see every piece before we share it, and you can say no to any of them.',
  alternate: "You're an alternate for the Founding Five. If one of the five can't do it, you're next, and I'll tell you by Tuesday, December 1. If you don't step in, we'll delete your hello video after January 6.",
  not_picked: "Thanks for applying to the Founding Five. I picked the five today, and you weren't one of them. We'll delete your hello video within 30 days. Nothing else changes: your founding price, number and badge stay, and I'll see you on the founding call, Tuesday, December 1 at 8pm ET.",
};

// The OK a member gives in HQ before 127 shares a piece of their build: Members' clip OK
// (templates/founding-five.md section 7) with Legal's L63 lines, where "reply to this email" reads
// "tap Stop using it here or email hello@127group.io". Legal confirmed the line as it stands (Oct 19):
// "To stop us using it, tap Stop using it here or email hello@127group.io anytime." Each yes keeps this
// version; change the version whenever the words change.
const PIECE_OK = {
  version: 'members-s7-legal-L63-hq-2026-10-19',
  text: (name, kind = 'clip') => {
    const it = ['clip', 'story', 'video'].includes(kind) ? kind : 'clip';
    return `Can 127 use this ${it} in its posts, emails and website, with your first name? No is completely fine and doesn't change anything. If you say yes, it goes out with this line: "${name || 'Your first name'} is one of the Founding Five: 127 gave them four group sessions with Eli for sharing their build." We won't put you in a paid ad unless you say yes to that ad, and we won't use AI to change your face, voice or words. Where the ${it} shows numbers, it also says: "One person's real numbers. Yours will differ. No results promised." To stop us using it, tap Stop using it here or email hello@127group.io anytime. We'll stop using it in anything new and take it down from 127's own accounts, website and emails within 7 days, but we can't recall copies other people already shared.`;
  },
};

// Members' Nov 25 messages (ops/members/templates/founding-five.md section 1, with Legal's L63 privacy
// paragraph, as of Oct 19 17:35 UTC). The app fills [[first name]] and [[join link]]; anything else in
// [[...]] holds Approve until Eli fills it in the draft.
const MESSAGES = {
  picked: {
    kind: 'ff_picked',
    subject: "You're one of the Founding Five",
    body: `Hi [[first name]],

${RESULTS.picked}

How the sessions work:
- Wednesdays at 8pm ET: December 2, 9 and 16, and January 6. The calendar file attached adds all four in your own time zone.
- Join on Zoom: [[join link]]. It's the same link every week. A laptop works best, and a phone works too.
- Before each session, put your week's sends, replies, calls and yeses in HQ. We start with them.
- 20 minutes: your numbers, then one blocker each and one next step from me, then how many sends you'll do next week.

Recording and notes: at the start of each session I'll ask whether we can record it and use an AI note-taker, Granola, for your recap. We only do each one if all of you say yes to it, out loud, and you can say no any week without it changing your place. A clip of you is used only if you OK that clip.

Recordings and notes stay with 127 and are deleted 90 days after each session. What the five of you share stays between us, so please don't record, screenshot or run your own note-taker.

Eli`,
  },
  alternate: {
    kind: 'ff_alternate',
    subject: "Founding Five: you're an alternate",
    body: `Hi [[first name]],

${RESULTS.alternate}

Eli`,
  },
  not_picked: {
    kind: 'ff_not_picked',
    subject: 'Your Founding Five application',
    body: `Hi [[first name]],

${RESULTS.not_picked}

Eli`,
  },
};

// ---------- dates ----------

function when(key) {
  const v = process.env[key];
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
// Doors: LAUNCH_AT and FOUNDING_CLOSES_AT, unless the Founding Five has its own.
function opensAt() {
  return when('FOUNDING_FIVE_OPENS_AT') ?? when('LAUNCH_AT') ?? Date.parse('2026-11-17T15:00:00Z');
}
function closesAt() {
  return when('FOUNDING_FIVE_CLOSES_AT') ?? when('FOUNDING_CLOSES_AT') ?? Date.parse('2026-11-25T04:59:00Z');
}
function isOpen(now = deps.now()) {
  return now >= opensAt() && now < closesAt();
}
// Alternates wait until the last session is over (Jan 6 ends at midnight ET).
const ALTERNATES_UNTIL = Date.parse('2027-01-07T05:00:00Z');

const SCHEDULE = JSON.parse(fs.readFileSync(path.join(__dirname, 'founding-five-sessions.json'), 'utf8'));
function sessions() {
  return SCHEDULE.sessions.map((s) => ({ n: s.n, of: s.of, date: s.date, start: Date.parse(s.start), end: Date.parse(s.end) }));
}

const etDay = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (ms) => etDay.format(new Date(ms));
function mondayOf(key) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function etLabel(ms, opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Date(ms).toLocaleDateString('en-US', { timeZone: ET, ...opts });
}

// The session week the five are working on: the next session, or one that started in the last day
// (so the numbers can still be fixed the morning after). weekOf is that week's Monday, as the feed has it.
function currentWeek(now = deps.now()) {
  const s = sessions().find((x) => x.start + DAY > now);
  return s ? { n: s.n, of: s.of, weekOf: mondayOf(dayKey(s.start)), from: s.start - 7 * DAY, to: s.start, sessionAt: s.start } : null;
}

// ---------- who ----------

const isFounding = (user) => !!(user && (user.foundingNumber || user.foundingPrice));
const onPlan = (user) => !!user && (user.tier === 'builder' || user.tier === 'circle') && !(user.pause && !user.pause.endedAt);
const firstName = (user) => String((user && user.name) || '').trim().split(/\s+/)[0] || '';

// Why someone can't apply right now, or null. admin: Eli's preview, saved as a test.
function blocked(user, { now = deps.now(), admin = false } = {}) {
  if (admin) return null;
  if (now < opensAt()) return 'early';
  if (now >= closesAt()) return 'closed';
  if (!isFounding(user)) return 'founding';
  if (!onPlan(user)) return 'plan';
  return null;
}

const all = () => deps.db.all('foundingFive');
function mine(userId) {
  return deps.db.find('foundingFive', (a) => a.userId === userId && !a.withdrawnAt) || null;
}
const submitted = (a) => !!(a && a.submittedAt && !a.withdrawnAt);
const decided = () => all().some((a) => a.decidedAt && !a.test);
const isFive = (a) => !!(a && a.mark === 'picked' && a.decidedAt && !a.leftAt && !a.test);
const isAlternate = (a) => !!(a && (a.mark === 'alt1' || a.mark === 'alt2'));
const byId = (id) => deps.db.get('foundingFive', String(id)) || null;

// ---------- the application ----------

const clip = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const httpsLink = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && s.length <= 500 ? u.toString() : null;
  } catch {
    return null;
  }
};

async function draftFor(user, { test = false } = {}) {
  const a = mine(user.id);
  if (a) return a;
  return deps.db.save('foundingFive', { userId: user.id, test, submittedAt: null, answers: {}, boxes: {}, scores: {}, kind: '', mark: '', weeks: {}, pieces: [] });
}

// body: the form. Returns { app }, { errors, values } or { under18: true }.
async function apply(user, body = {}, { admin = false } = {}) {
  const now = deps.now();
  const why = blocked(user, { now, admin });
  if (why) return { errors: { form: why === 'early' ? 'Applications open Tuesday, November 17 at 10am ET.' : why === 'closed' ? 'Applications closed on Tuesday, November 24 at 11:59pm ET.' : 'The Founding Five is for founding members.' } };
  const values = {
    what: clip(body.what, QUESTIONS.what.max),
    where: clip(body.where, QUESTIONS.where.max),
    adult: body.adult === 'yes' ? 'yes' : body.adult === 'no' ? 'no' : '',
    hours: String(body.hours == null ? '' : body.hours).trim(),
    done: clip(body.done, QUESTIONS.done.max),
    videoLink: String(body.videoLink || '').trim().slice(0, 500),
    boxes: Object.fromEntries(BOXES.map((b) => [b.key, body[`box_${b.key}`] === 'on'])),
  };
  if (values.adult === 'no') {
    // A no ends it, and the site's under-18 review takes over (Legal L42). Nothing else is kept.
    const a = mine(user.id);
    if (a) await forgetApplication(a);
    await deps.ageFlag(user, { source: 'founding_five', excerpt: [{ from: 'member', text: 'Founding Five application: answered "No" to "Are you 18 or older?"', at: new Date(now).toISOString() }] });
    return { under18: true };
  }
  const errors = {};
  if (values.what.length < 3) errors.what = 'Tell Eli what you are starting and who pays for it.';
  if (values.where.length < 2) errors.where = 'Your city and state.';
  if (values.adult !== 'yes') errors.adult = 'Pick yes or no.';
  const hours = Number(values.hours);
  if (!/^\d{1,2}(\.\d)?$/.test(values.hours) || hours > 80) errors.hours = 'A number of hours a week, like 5.';
  if (!values.done) errors.done = 'Anything counts. "Nothing yet" is a fine answer.';
  const link = httpsLink(values.videoLink);
  if (link === null) errors.videoLink = 'Paste a link that starts with https://.';
  const draft = mine(user.id);
  if (!(draft && draft.video) && !link) errors.video = 'Add your 30-second hello: upload it, or paste a link to it.';
  for (const b of BOXES) if (!values.boxes[b.key]) errors[`box_${b.key}`] = 'Tick this box to apply. It only applies if you are picked.';
  if (Object.keys(errors).length) return { errors, values };

  const a = await draftFor(user, { test: admin && !!blocked(user, { now }) });
  const at = new Date(now).toISOString();
  a.answers = { what: values.what, where: values.where, hours: Math.round(hours * 10) / 10, done: values.done };
  a.adult = true;
  a.videoLink = link || '';
  a.boxes = Object.fromEntries(BOXES.map((b) => [b.key, (a.boxes && a.boxes[b.key]) || at]));
  a.wordsVersion = WORDS_VERSION;
  a.submittedAt = a.submittedAt || at;
  a.changedAt = at;
  if (!a.scores || a.scores.hours == null) a.scores = { ...(a.scores || {}), hours: hoursScore(a.answers.hours) };
  await deps.db.save('foundingFive', a);
  return { app: a };
}

// The member takes their application back before the picks: everything goes, the video at once.
async function withdraw(user) {
  const a = mine(user.id);
  if (!a || a.decidedAt) return false;
  await forgetApplication(a);
  return true;
}

// ---------- videos (4 MB parts, so a phone video is never in memory whole) ----------

const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp' };
const maxVideo = () => Math.max(10, Number(process.env.FOUNDING_FIVE_VIDEO_MAX_MB || 150)) * MB;
function videoType(name, type) {
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  if (Object.values(VIDEO_TYPES).includes(t)) return t;
  const ext = String(name || '').toLowerCase().split('.').pop();
  return (!t || t === 'application/octet-stream' || t.startsWith('video/')) && VIDEO_TYPES[ext] ? VIDEO_TYPES[ext] : null;
}
const SLOT = /^(hello|start|w\d{4}-\d{2}-\d{2})$/;
const blobId = (id, i) => `ff_${id}_${i}`;

function videoAt(a, slot) {
  if (!a) return null;
  if (slot === 'hello') return a.video || null;
  if (slot === 'start') return a.startVideo || null;
  const w = a.weeks && a.weeks[slot.slice(1)];
  return (w && w.video) || null;
}
function setVideo(a, slot, v) {
  if (slot === 'hello') a.video = v;
  else if (slot === 'start') a.startVideo = v;
  else {
    const k = slot.slice(1);
    a.weeks = a.weeks || {};
    a.weeks[k] = { ...(a.weeks[k] || {}), video: v, videoAt: v ? v.at : null };
  }
}
async function dropBlobs(v) {
  if (!v) return;
  for (let i = 0; i < (v.parts || 0); i++) await deps.db.removeBlob(blobId(v.id, i));
}

// Who may upload to a slot: hello while applying (before the picks); start and this week's video
// for the five only.
function slotOpen(user, slot, { admin = false } = {}) {
  if (!SLOT.test(String(slot))) return 'That upload slot does not exist.';
  const a = mine(user.id);
  if (slot === 'hello') {
    if (a && a.decidedAt) return 'Applications are closed.';
    return blocked(user, { admin }) ? 'Applications are not open.' : null;
  }
  if (!isFive(a)) return 'Only the five add videos here.';
  if (slot === 'start') return null;
  const w = currentWeek();
  return w && slot === `w${w.weekOf}` ? null : "That week's video can't be changed now.";
}

// One part of an upload. q: { slot, part, parts, size, upload } (upload: the id part 0 returned).
// Returns { upload, done, video } or { error, status }.
async function putPart(user, q, buf, { name, type, admin = false } = {}) {
  const slot = String(q.slot || '');
  const closed = slotOpen(user, slot, { admin });
  if (closed) return { status: 403, error: closed };
  const part = Number(q.part);
  const parts = Number(q.parts);
  const size = Number(q.size);
  const kind = videoType(name, type);
  if (!kind) return { status: 415, error: 'That file is not a video. MP4, MOV and WebM work.' };
  if (!Number.isInteger(size) || size < 1 || size > maxVideo()) return { status: 413, error: `Videos up to ${Math.round(maxVideo() / MB)} MB work here. For a bigger one, paste a link instead.` };
  if (!Number.isInteger(parts) || parts !== Math.ceil(size / CHUNK) || !Number.isInteger(part) || part < 0 || part >= parts) return { status: 400, error: "That upload didn't add up. Try again." };
  const want = part < parts - 1 ? CHUNK : size - CHUNK * (parts - 1);
  if (!Buffer.isBuffer(buf) || buf.length !== want) return { status: 400, error: "Part of the video didn't arrive. Try again." };
  const a = slot === 'hello' ? await draftFor(user, { test: admin && !!blocked(user) }) : mine(user.id);
  a.uploads = a.uploads || {};
  let up = a.uploads[slot];
  if (part === 0) {
    if (up) await dropBlobs({ id: up.id, parts: up.parts });
    up = { id: deps.db.id(), parts, size, type: kind, name: clip(name, 120) || 'hello', got: [] };
    a.uploads[slot] = up;
  } else if (!up || up.id !== String(q.upload || '') || up.parts !== parts || up.size !== size) {
    return { status: 409, error: 'That upload was replaced by a newer one. Start again.' };
  }
  await deps.db.putBlob(blobId(up.id, part), buf);
  up.got = Array.from({ length: parts }, (_, i) => !!up.got[i] || i === part);
  let video = null;
  if (up.got.every(Boolean)) {
    await dropBlobs(videoAt(a, slot));
    video = { id: up.id, parts, size, type: up.type, name: up.name, at: new Date(deps.now()).toISOString() };
    setVideo(a, slot, video);
    delete a.uploads[slot];
  }
  await deps.db.save('foundingFive', a);
  return { upload: up.id, done: !!video, video };
}

// The bytes from..to (inclusive) of a stored video, part by part. Yields Buffers.
async function* readRange(v, from, to) {
  for (let i = Math.floor(from / CHUNK); i <= Math.floor(to / CHUNK); i++) {
    const buf = await deps.db.getBlob(blobId(v.id, i));
    if (!buf) return;
    const a = i === Math.floor(from / CHUNK) ? from - i * CHUNK : 0;
    const b = i === Math.floor(to / CHUNK) ? to - i * CHUNK + 1 : buf.length;
    yield buf.subarray(a, b);
  }
}

// A sent application keeps its hello: it can be replaced, or the application withdrawn.
async function removeVideo(user, slot, { admin = false } = {}) {
  const a = mine(user.id);
  if (!a || slotOpen(user, slot, { admin }) || (slot === 'hello' && submitted(a) && !a.videoLink)) return false;
  await dropBlobs(videoAt(a, slot));
  setVideo(a, slot, null);
  await deps.db.save('foundingFive', a);
  return true;
}

// ---------- what the member sees ----------

const HOURS_LABEL = (h) => (h === 1 ? '1 hour a week' : `${h} hours a week`);

// Offer's Nov 25 words; "today" names the day once it has passed.
function resultText(res, a, now = deps.now()) {
  const d = Date.parse(a.decidedAt);
  return dayKey(now) === dayKey(d) ? RESULTS[res] : RESULTS[res].replace(' today,', ` on ${etLabel(d)},`);
}

// The card on the dashboard and on HQ's Today, or null.
function card(user, now = deps.now()) {
  if (!user) return null;
  const a = mine(user.id);
  // The five, after picks day: this week's session and what's waiting on them. It stays while a piece
  // waits for their OK, even after the last session.
  if (isFive(a) && dayKey(now) !== dayKey(Date.parse(a.decidedAt))) {
    const w = currentWeek(now);
    const waiting = (a.pieces || []).filter((p) => p.status === 'waiting').length;
    if (!w && !waiting && now >= ALTERNATES_UNTIL) return null;
    const first = sessions()[0];
    const lines = [];
    if (!a.startVideo && first && now < first.start) lines.push('Film your 60-second "where I\'m starting" video by Sunday, November 29.');
    if (w) lines.push(a.weeks && a.weeks[w.weekOf] && a.weeks[w.weekOf].savedAt ? "This week's numbers are in. Eli starts the session with them." : "Put this week's sends, replies, calls and yeses in before the session.");
    if (waiting) lines.push(waiting === 1 ? 'A piece of your build waits for your OK.' : `${waiting} pieces of your build wait for your OK.`);
    return { state: 'five', label: 'The Founding Five', title: w ? `Session ${w.n} of ${w.of}: ${etLabel(w.sessionAt)} at 8pm ET` : 'The four sessions are done.', lines, five: true };
  }
  if (a && a.decidedAt && !a.test) {
    const res = a.mark === 'picked' ? (a.leftAt ? null : 'picked') : isAlternate(a) ? 'alternate' : 'not_picked';
    if (!res) return null;
    const until = res === 'not_picked' ? Date.parse(a.decidedAt) + 14 * DAY : ALTERNATES_UNTIL;
    return now < until ? { state: 'result', result: res, text: resultText(res, a, now), five: res === 'picked' } : null;
  }
  if (submitted(a) && !a.test) return now < closesAt() + 14 * DAY ? { state: 'applied', open: isOpen(now) } : null;
  if (blocked(user, { now })) return null;
  return { state: 'apply', ...CARD };
}

// Numbers HQ already has for a window: sends from Do my day, and the Pipeline's replies, calls and yeses.
function hqNumbers(userId, from, to) {
  const out = { sends: 0, replies: 0, calls: 0, yeses: 0 };
  for (let t = from; t < to; t += DAY) {
    const d = deps.db.get('actions', `${userId}:${dayKey(t)}`);
    if (d && d.counts) out.sends += (d.counts.warm || 0) + (d.counts.cold || 0);
  }
  const map = { replied: 'replies', call: 'calls', won: 'yeses' };
  for (const l of deps.db.filter('pipeline', (x) => x.memberId === userId)) {
    for (const h of l.history || []) {
      const at = Date.parse(h.at);
      if (map[h.stage] && at >= from && at < to) out[map[h.stage]] += 1;
    }
  }
  return out;
}

// The /app/founding-five page.
function page(user, { now = deps.now(), admin = false } = {}) {
  const a = mine(user.id);
  const why = blocked(user, { now, admin });
  const base = { a, why, now, opensLabel: etLabel(opensAt()), closesLabel: `${etLabel(closesAt() - 60000)} at 11:59pm ET`, preview: admin && !!blocked(user, { now }) };
  if (isFive(a)) {
    const w = currentWeek(now);
    const saved = w && a.weeks && a.weeks[w.weekOf];
    return {
      ...base,
      mode: 'five',
      week: w,
      numbers: saved && saved.savedAt ? saved : w ? hqNumbers(user.id, w.from, Math.min(w.to, now)) : null,
      fromHq: !(saved && saved.savedAt),
      weekVideo: w ? videoAt(a, `w${w.weekOf}`) : null,
      pieces: (a.pieces || []).filter((p) => p.status === 'waiting').concat((a.pieces || []).filter((p) => p.status !== 'waiting')),
      okFor: (kind) => PIECE_OK.text(firstName(user), kind),
      sessions: sessions(),
    };
  }
  if (a && a.decidedAt && !a.test) {
    const result = a.mark === 'picked' ? 'left' : isAlternate(a) ? 'alternate' : 'not_picked';
    return { ...base, mode: 'result', result, text: result === 'left' ? null : resultText(result, a, now) };
  }
  if (submitted(a) && (why || a.test)) return { ...base, mode: why && !admin ? 'applied-closed' : 'applied' };
  return { ...base, mode: why ? 'closed' : submitted(a) ? 'applied' : 'apply' };
}

// ---------- the five ----------

async function saveWeek(user, body = {}) {
  const a = mine(user.id);
  const w = currentWeek();
  if (!isFive(a) || !w) return { error: 'Numbers go in during the sessions.' };
  const n = {};
  for (const k of ['sends', 'replies', 'calls', 'yeses']) {
    const v = Number(String(body[k] == null ? '' : body[k]).trim());
    if (!Number.isInteger(v) || v < 0 || v > 10000) return { error: 'Whole numbers only, like 25.' };
    n[k] = v;
  }
  a.weeks = a.weeks || {};
  a.weeks[w.weekOf] = { ...(a.weeks[w.weekOf] || {}), ...n, savedAt: new Date(deps.now()).toISOString() };
  await deps.db.save('foundingFive', a);
  return { week: w };
}

const PIECE_KINDS = ['clip', 'story', 'video'];
// Eli adds a piece 127 would like to share; the member says yes or no in HQ before it's used.
async function addPiece(id, body = {}) {
  const a = deps.db.get('foundingFive', String(id));
  if (!isFive(a)) return { error: 'Pieces are for the five.' };
  const title = clip(body.title, 140);
  const link = httpsLink(body.link);
  if (!title) return { error: 'Give the piece a short title.' };
  if (link === null) return { error: 'The preview link has to start with https://.' };
  const piece = { id: deps.db.id(), kind: PIECE_KINDS.includes(body.kind) ? body.kind : 'clip', title, link: link || '', note: clip(body.note, 500), status: 'waiting', createdAt: new Date(deps.now()).toISOString(), answeredAt: null };
  a.pieces = [...(a.pieces || []), piece].slice(-50);
  await deps.db.save('foundingFive', a);
  return { piece };
}
// Each answer keeps the date, the piece as it was shown and the version of the words (Legal 06 A2).
// A yes can become a no later; a no is final for that piece.
// A no to a waiting piece is final for it; a no after a yes is "Stop using it" (status stopped, the 7-day
// takedown). Neither goes back to yes without a new piece and a new OK. Returns { piece, wasYes, firstName } or null.
async function answerPiece(user, pieceId, yes) {
  const a = mine(user.id);
  const p = a && (a.pieces || []).find((x) => x.id === String(pieceId));
  if (!isFive(a) || !p || p.status === 'no' || p.status === 'stopped' || (p.status === 'yes' && yes)) return null;
  const at = new Date(deps.now()).toISOString();
  const wasYes = p.status === 'yes';
  p.status = yes ? 'yes' : wasYes ? 'stopped' : 'no';
  p.answeredAt = at;
  if (wasYes) {
    p.stoppedAt = at;
    p.stoppedBy = 'member';
    p.stoppedVia = 'tap';
  }
  p.answers = [...(p.answers || []), { yes: !!yes, at, version: PIECE_OK.version, kind: p.kind, title: p.title, link: p.link, ...(wasYes ? { via: 'tap' } : {}) }].slice(-10);
  await deps.db.save('foundingFive', a);
  return { piece: p, wasYes, firstName: firstName(user) };
}

// Eli's Stopped mark: the member asked 127 to stop using a piece (usually by email). Nothing new may use it,
// and it comes down from 127's own accounts, website and emails within 7 days (Legal L63). An email works the
// same as a tap (Legal, Oct 19), so it's kept the same way: the stop's date in the answers, next to the yes.
async function stopPiece(id, pieceId, by) {
  const a = deps.db.get('foundingFive', String(id));
  const p = a && (a.pieces || []).find((x) => x.id === String(pieceId));
  if (!p || p.status === 'stopped') return null;
  const at = new Date(deps.now()).toISOString();
  p.status = 'stopped';
  p.stoppedAt = at;
  p.stoppedBy = by || 'eli';
  p.stoppedVia = 'email';
  p.answers = [...(p.answers || []), { yes: false, at, via: 'email' }].slice(-10);
  await deps.db.save('foundingFive', a);
  return p;
}

// ---------- Eli's pick sheet ----------

const SCORE_KEYS = [
  ['pays', 'Clear about who pays'],
  ['hours', 'Hours (5 or more a week is 3)'],
  ['camera', 'On camera'],
  ['done', 'Something already done'],
];
const MARKS = { '': 'Not marked', picked: 'Picked', alt1: 'Alternate 1', alt2: 'Alternate 2', not_picked: 'Not picked' };
const hoursScore = (h) => (h >= 5 ? 3 : h >= 3 ? 2 : 1);
const total = (a) => SCORE_KEYS.reduce((s, [k]) => s + (Number(a.scores && a.scores[k]) || 0), 0);
const scored = (a) => SCORE_KEYS.every(([k]) => [1, 2, 3].includes(Number(a.scores && a.scores[k])));

// The business mix Eli fills (Legal L60: about the business, never the person).
const MIX = { local: 2, online: 1 };

// A suggested five and two alternates for the sheet (Members' pick sheet, templates section 11): best
// totals first, then the business mix. Only founding members on Builder or the Circle now, with all four
// scores. Eli decides.
function suggest(list) {
  const pool = list.filter((x) => x.scored && !x.a.test && isFounding(x.u) && onPlan(x.u));
  const five = pool.slice(0, 5);
  for (const [kind, min] of Object.entries(MIX)) {
    while (five.filter((x) => x.a.kind === kind).length < min) {
      const add = pool.find((x) => !five.includes(x) && x.a.kind === kind);
      const spare = (x) => x.a.kind !== kind && (!MIX[x.a.kind] || five.filter((y) => y.a.kind === x.a.kind).length > MIX[x.a.kind]);
      const drop = [...five].reverse().find(spare);
      if (!add || !drop) break;
      five[five.indexOf(drop)] = add;
    }
  }
  five.sort((p, q) => pool.indexOf(p) - pool.indexOf(q));
  return { five: five.map((x) => x.a.id), alternates: pool.filter((x) => !five.includes(x)).slice(0, 2).map((x) => x.a.id) };
}

// Everyone who applied, best first: total score, then whoever has done more, then who applied first.
function board() {
  const users = Object.fromEntries(deps.db.all('users').map((u) => [u.id, u]));
  const list = all()
    .filter(submitted)
    .map((a) => ({ a, u: users[a.userId] || null, total: total(a), scored: scored(a) }))
    .sort((x, y) => Number(y.scored) - Number(x.scored) || y.total - x.total || (Number(y.a.scores.done) || 0) - (Number(x.a.scores.done) || 0) || String(x.a.submittedAt).localeCompare(String(y.a.submittedAt)));
  const real = list.filter((x) => !x.a.test);
  const picked = real.filter((x) => x.a.mark === 'picked');
  const mix = { local: picked.filter((x) => x.a.kind === 'local').length, online: picked.filter((x) => x.a.kind === 'online').length };
  // Videos live in the database (lib/db.js blobs), so the sheet shows what they take up.
  const videoBytes = all().reduce((n, a) => n + [a.video, a.startVideo, ...Object.values(a.weeks || {}).map((w) => w.video)].reduce((m, v) => m + ((v && v.size) || 0), 0), 0);
  return {
    list,
    count: real.length,
    videoBytes,
    picked: picked.length,
    alternates: ['alt1', 'alt2'].filter((m) => real.some((x) => x.a.mark === m)).length,
    mix,
    decided: decided(),
    need: needs(real.length),
    suggested: suggest(list),
  };
}
// How many picks and alternates a confirm needs, given how many applied.
const needs = (n) => ({ picked: Math.min(5, n), alternates: Math.max(0, Math.min(2, n - 5)) });

async function score(id, body = {}) {
  const a = deps.db.get('foundingFive', String(id));
  if (!submitted(a)) return { error: 'Application not found.' };
  const s = { ...(a.scores || {}) };
  for (const [k] of SCORE_KEYS) if (body[k] !== undefined) s[k] = [1, 2, 3].includes(Number(body[k])) ? Number(body[k]) : null;
  a.scores = s;
  if (body.kind !== undefined) a.kind = ['local', 'online'].includes(body.kind) ? body.kind : '';
  if (body.note !== undefined) a.note = clip(body.note, 500);
  await deps.db.save('foundingFive', a);
  return { app: a };
}

// mark: '', picked, alt1, alt2 (not_picked is what a confirm gives everyone left unmarked).
async function mark(id, value) {
  const a = deps.db.get('foundingFive', String(id));
  if (!submitted(a)) return { error: 'Application not found.' };
  const m = ['', 'picked', 'alt1', 'alt2', 'not_picked'].includes(value) ? value : '';
  if (a.decidedAt && !a.test) return { error: 'The picks are confirmed. If a place opens, pass it to an alternate under The five.' };
  const u = deps.db.get('users', a.userId);
  if (m && m !== 'not_picked' && !isFounding(u)) return { error: 'Only founding members can be picked.' };
  // Places are for Builder members through January 6 (Offer section 4, the third box): someone paused or
  // off Builder now can't take one.
  if (m && m !== 'not_picked' && !a.test && !onPlan(u)) return { error: "They're not on Builder or the Circle right now, so they can't take a place." };
  const others = all().filter((x) => submitted(x) && x.id !== a.id && !!x.test === !!a.test);
  if (m === 'picked' && others.filter((x) => x.mark === 'picked').length >= 5) return { error: 'Five are picked already. Unmark one first.' };
  let moved = null;
  if (m === 'alt1' || m === 'alt2') {
    const had = others.find((x) => x.mark === m);
    if (had) {
      had.mark = '';
      await deps.db.save('foundingFive', had);
      moved = had;
    }
  }
  a.mark = m;
  await deps.db.save('foundingFive', a);
  return { app: a, moved };
}

// Eli's "Confirm picks": everyone left unmarked is not picked, and every card shows its result.
async function confirm(by) {
  if (decided()) return { error: 'The picks are already confirmed.' };
  const real = all().filter((a) => submitted(a) && !a.test);
  const need = needs(real.length);
  const picked = real.filter((a) => a.mark === 'picked').length;
  const alts = ['alt1', 'alt2'].filter((m) => real.some((a) => a.mark === m)).length;
  if (!real.length) return { error: 'Nobody has applied yet.' };
  if (picked !== need.picked) return { error: `Mark ${need.picked} as Picked first (${picked} now).` };
  if (alts < need.alternates) return { error: `Mark ${need.alternates === 1 ? 'Alternate 1' : 'Alternate 1 and Alternate 2'} first.` };
  const at = new Date(deps.now()).toISOString();
  for (const a of real) {
    if (!a.mark) a.mark = 'not_picked';
    a.decidedAt = at;
    a.decidedBy = by || null;
    if (a.mark === 'picked') a.pickedAt = at;
    await deps.db.save('foundingFive', a);
  }
  return { count: real.length };
}

// After the picks: one of the five leaves (cancelled, paused, refunded or said no) and an alternate who
// said yes steps in: Alternate 1 unless Eli names the other (Alternate 1 said no or didn't answer), and
// never someone off Builder right now. Eli's call only.
async function stepIn(leavingId, by, { nextId = '' } = {}) {
  const out = deps.db.get('foundingFive', String(leavingId));
  if (!isFive(out)) return { error: 'That member is not one of the five.' };
  const waiting = ['alt1', 'alt2'].map((m) => all().find((a) => a.mark === m && a.decidedAt && !a.test && !a.leftAt)).filter(Boolean);
  const ready = waiting.filter((a) => onPlan(deps.db.get('users', a.userId)));
  const next = nextId ? waiting.find((a) => a.id === String(nextId)) : ready[0];
  if (nextId && !next) return { error: 'That alternate is not waiting.' };
  if (next && !ready.includes(next)) return { error: "That alternate isn't on Builder or the Circle right now, so they can't take the place." };
  const at = new Date(deps.now()).toISOString();
  out.leftAt = at;
  out.leftBy = by || null;
  await deps.db.save('foundingFive', out);
  if (!next) return { left: out, next: null };
  next.mark = 'picked';
  next.pickedAt = at;
  next.steppedInAt = at;
  await deps.db.save('foundingFive', next);
  return { left: out, next };
}

async function setFlag(id, key, value) {
  const a = deps.db.get('foundingFive', String(id));
  if (!a || !['circleFit'].includes(key)) return null;
  a[key] = !!value;
  await deps.db.save('foundingFive', a);
  return a;
}

// "Stage the picks": one draft per applicant in /admin/ops (lib/member-ops.js), picked first.
// stage: member-ops' stageDraft. The picked draft carries the calendar file.
async function stagePicks(stage) {
  if (!decided()) return { error: 'Confirm the picks first.' };
  const order = { picked: 0, alt1: 1, alt2: 1, not_picked: 2 };
  const real = all()
    .filter((a) => submitted(a) && !a.test && a.decidedAt && a.mark && !a.leftAt)
    .sort((x, y) => order[x.mark] - order[y.mark]);
  const out = { staged: 0, already: 0, byKind: {} };
  for (const a of real) {
    const m = a.mark === 'picked' ? MESSAGES.picked : a.mark === 'not_picked' ? MESSAGES.not_picked : MESSAGES.alternate;
    const r = await stage({
      kind: m.kind,
      key: `ff:${a.id}`,
      userId: a.userId,
      subject: m.subject,
      body: m.body,
      reason: `Founding Five: ${MARKS[a.mark].toLowerCase()} (Eli's picks, ${etLabel(Date.parse(a.decidedAt), { month: 'short', day: 'numeric' })}).`,
      job: 'founding-five',
      priority: 3 - order[a.mark],
      commercial: false,
      data: a.mark === 'picked' ? { attach: 'ff_sessions' } : null,
    });
    if (r.status === 201) {
      out.staged += 1;
      out.byKind[m.kind] = (out.byKind[m.kind] || 0) + 1;
    } else if (r.status === 409) out.already += 1;
    else return { error: r.error || 'Could not stage a draft.' };
  }
  return out;
}

// ---------- the session calendar (Members' reference: ops/members/engine/founding-five.js --ics) ----------

const icsTime = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  const out = [];
  let rest = line;
  let limit = 75;
  while (Buffer.byteLength(rest, 'utf8') > limit) {
    let cut = limit;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > limit) cut--;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
    limit = 74;
  }
  out.push(rest);
  return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
}
function ics({ url = joinUrl(), now = deps.now() } = {}) {
  const link = httpsLink(url) || '';
  const join = link ? `Join on Zoom: ${link}` : 'Join link: in the email this came with (the same link every week).';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Founding Five//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:127 Founding Five'];
  for (const s of sessions()) {
    const desc = `Founding Five, session ${s.n} of ${s.of}: 20 minutes with Eli and the five. Before we start, put this week's sends, replies, calls and yeses in HQ. ${join}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:founding-five-session-${s.n}@127group.io`,
      `SEQUENCE:${SCHEDULE.sequence || 0}`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(s.start)}`,
      `DTEND:${icsTime(s.end)}`,
      `SUMMARY:${icsText(`127 Founding Five: session ${s.n} of ${s.of}`)}`,
      `DESCRIPTION:${icsText(desc)}`,
      `LOCATION:${icsText(link || 'Zoom (link in your email)')}`
    );
    if (link) lines.push(`URL:${link}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText('Founding Five in 30 minutes')}`, 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// The sessions' Zoom link (Eli sets FOUNDING_FIVE_JOIN_URL), shown only to the five.
const joinUrl = () => httpsLink(process.env.FOUNDING_FIVE_JOIN_URL || '') || '';

// [[first name]] and [[join link]] in a Founding Five draft (Members' ff_ kinds), filled by the app
// because the members heartbeat never sees the link. Anything else in [[...]] stays and holds Approve.
function fill(text, user) {
  const link = joinUrl();
  let out = String(text || '');
  if (user && firstName(user)) out = out.replace(/\[\[first name\]\]/gi, firstName(user));
  if (link) out = out.replace(/\[\[join link\]\]/gi, link);
  return out;
}

// ---------- the ops feed (Members' site spec part 1; no emails, video files or links) ----------

function feed() {
  const users = Object.fromEntries(deps.db.all('users').map((u) => [u.id, u]));
  const real = all().filter((a) => submitted(a) && !a.test);
  const status = (a) => (a.mark === 'picked' ? 'picked' : isAlternate(a) ? 'alternate' : a.mark === 'not_picked' ? 'not_picked' : 'pending');
  const five = real.filter((a) => a.mark === 'picked' && a.decidedAt);
  return {
    applications: real.map((a) => ({
      id: a.id,
      userId: a.userId,
      firstName: firstName(users[a.userId]) || null,
      createdAt: a.submittedAt,
      foundingMember: isFounding(users[a.userId]),
      answers: { what: a.answers.what, where: a.answers.where, adult: true, hours: a.answers.hours, doneSoFar: a.answers.done },
      helloVideo: !!(a.video || a.videoLink),
      helloVideoDeletedAt: a.helloVideoDeletedAt || null,
      consents: Object.fromEntries(BOXES.map((b) => [b.key, !!(a.boxes && a.boxes[b.key])])),
      scores: SCORE_KEYS.reduce((o, [k]) => ({ ...o, [k]: a.scores && a.scores[k] != null ? a.scores[k] : null }), {}),
      kind: a.kind || null,
      status: status(a),
      altRank: a.mark === 'alt1' ? 1 : a.mark === 'alt2' ? 2 : null,
      decidedAt: a.decidedAt || null,
    })),
    members: five.map((a) => {
      return {
        userId: a.userId,
        firstName: firstName(users[a.userId]) || null,
        status: a.leftAt ? 'left' : 'picked',
        pickedAt: a.pickedAt || a.decidedAt,
        leftAt: a.leftAt || null,
        circleFit: !!a.circleFit,
        startVideoAt: (a.startVideo && a.startVideo.at) || null,
        weeks: Object.keys(a.weeks || {})
          .sort()
          .map((k) => {
            const w = a.weeks[k];
            return { weekOf: k, sends: w.savedAt ? w.sends : null, replies: w.savedAt ? w.replies : null, calls: w.savedAt ? w.calls : null, yeses: w.savedAt ? w.yeses : null, videoAt: w.videoAt || null };
          }),
        pieces: (a.pieces || []).map((p) => { const y = (p.answers || []).filter((x) => x.yes).pop() || {}; return { id: p.id, kind: p.kind, status: p.status, createdAt: p.createdAt, answeredAt: p.answeredAt, textVersion: y.version || null, yesAt: y.at || null, stoppedAt: p.stoppedAt || null, stoppedVia: p.stoppedAt ? p.stoppedVia || (p.stoppedBy === 'member' ? 'tap' : 'email') : null }; }),
      };
    }),
    alternates: real
      .filter((a) => isAlternate(a) && a.decidedAt && !a.leftAt)
      .map((a) => ({ userId: a.userId, firstName: firstName(users[a.userId]) || null, rank: a.mark === 'alt1' ? 1 : 2 })),
  };
}

// ---------- keeping only what's needed ----------

async function forgetApplication(a) {
  await dropBlobs(a.video);
  await dropBlobs(a.startVideo);
  for (const w of Object.values(a.weeks || {})) await dropBlobs(w.video);
  for (const up of Object.values(a.uploads || {})) await dropBlobs({ id: up.id, parts: up.parts });
  await deps.db.remove('foundingFive', a.id);
}

// Account deletion.
async function forget(userId) {
  for (const a of deps.db.filter('foundingFive', (x) => x.userId === userId)) await forgetApplication(a);
}

// Hourly (server.js), what Legal and Offer promised (L60): a not-picked applicant's hello video 7 days after the
// picks and the rest of the application 25 days after (both inside the 30 days, the videos well before
// Dec 25); alternates' after January 6 unless they stepped in; a picked member's hello video 30 days
// after the pick (it was only for picking). Also Eli's test applications after 30 days, applications
// never sent once the window has closed, and uploads left half done.
async function purge(now = deps.now()) {
  const out = { videos: 0, applications: 0 };
  const iso = new Date(now).toISOString();
  for (const a of all()) {
    const d = a.decidedAt ? Date.parse(a.decidedAt) : null;
    const gone =
      (!a.submittedAt && (now > closesAt() + DAY || Date.parse(a.createdAt) + 14 * DAY < now)) ||
      (a.test && Date.parse(a.createdAt) + 30 * DAY < now) ||
      (!a.test && a.mark === 'not_picked' && d && d + 25 * DAY < now) ||
      (!a.test && isAlternate(a) && d && ALTERNATES_UNTIL < now);
    if (gone) {
      await forgetApplication(a);
      out.applications += 1;
      continue;
    }
    let changed = false;
    for (const [slot, up] of Object.entries(a.uploads || {})) {
      if (Date.parse(a.updatedAt) + 2 * DAY < now) {
        await dropBlobs({ id: up.id, parts: up.parts });
        delete a.uploads[slot];
        changed = true;
      }
    }
    const videoDue =
      (a.video || a.videoLink) &&
      !a.test &&
      d &&
      ((a.mark === 'not_picked' && d + 7 * DAY < now) || (a.mark === 'picked' && Date.parse(a.pickedAt || a.decidedAt) + 30 * DAY < now));
    if (videoDue) {
      await dropBlobs(a.video);
      a.video = null;
      a.videoLink = '';
      a.helloVideoDeletedAt = iso;
      out.videos += 1;
      changed = true;
    }
    if (changed) await deps.db.save('foundingFive', a);
  }
  return out;
}

// Legal's line for a first win (05 rule 3a, S26): across every founding member whose first four
// weeks are over, how many in 10 got a reply (or further) and how many got a yes in those weeks, from
// HQ's Pipeline. Members who never used HQ count as no reply: these are 127's own numbers.
function acrossFounding(now = deps.now()) {
  const founders = deps.db.filter('users', isFounding);
  let counted = 0;
  let replied = 0;
  let yes = 0;
  for (const u of founders) {
    const start = Date.parse(u.firstPaidAt || u.createdAt);
    if (!Number.isFinite(start) || start + 28 * DAY > now) continue;
    counted += 1;
    let r = false;
    let y = false;
    for (const l of deps.db.filter('pipeline', (x) => x.memberId === u.id)) {
      for (const h of l.history || []) {
        const at = Date.parse(h.at);
        if (at < start || at >= start + 28 * DAY) continue;
        if (['replied', 'call', 'won'].includes(h.stage)) r = true;
        if (h.stage === 'won') y = true;
      }
    }
    replied += r ? 1 : 0;
    yes += y ? 1 : 0;
  }
  const tenths = (n) => (counted ? Math.round((n / counted) * 10) : 0);
  const month = new Date(now).toLocaleDateString('en-US', { timeZone: ET, month: 'long', year: 'numeric' });
  return {
    founders: founders.length,
    counted,
    waiting: founders.length - counted,
    reply: tenths(replied),
    yes: tenths(yes),
    line: counted ? `Across all founding members, ${tenths(replied)} in 10 got a reply and ${tenths(yes)} in 10 got a yes in their first four weeks (127's numbers, ${month}).` : null,
  };
}

module.exports = {
  WORDS_VERSION, CARD, QUESTIONS, BOXES, NOTE, RESULTS, PIECE_OK, MESSAGES, SCORE_KEYS, MARKS, PIECE_KINDS, CHUNK,
  opensAt, closesAt, isOpen, sessions, currentWeek, isFounding, onPlan, blocked, mine, byId, isFive, decided,
  apply, withdraw, putPart, readRange, videoAt, removeVideo, maxVideo,
  card, page, hqNumbers, saveWeek, addPiece, answerPiece, stopPiece,
  board, score, mark, confirm, stepIn, setFlag, stagePicks, ics, joinUrl, fill, feed, forget, purge, acrossFounding,
  _setDeps,
};
