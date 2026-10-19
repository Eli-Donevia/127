// The delivery kit, for after a gym says yes. Fulfillment set up so the gym barely lifts a finger:
// - near-zero effort for the gym: about 45 minutes of filming a month around a class it runs anyway,
//   and three things to send before the day;
// - a fast first win: the first 3 Reels within 7 days of the shoot (aim for 3 days), so posts start fast;
// - delivery the editor repeats without thinking: every shot feeds a named Reel, 3 posts a week,
//   one folder layout, one file-naming rule, one 48-hour approval rule;
// - proof from day one: a tracked link, a QR code and one question at sign-up, so the month-end
//   report counts trial sign-ups and new members, which is what the owner actually cares about.
// Plans and drafts only: nothing here sends or posts. Only facts from the input are used (gaps, the
// site's offer text, its colors, names on its site); no invented offers, no promised results.

const fs = require('fs');
const path = require('path');
const { plain, slug, shortSite, normalizeUrl } = require('./util');
const { IDEAS, OFFER_LABEL } = require('./gaps');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'release-form.md');
const FORM_NAME = 'Video release form.md';

// ---- Dates: 'YYYY-MM-DD' strings. Calendar math in UTC, so no timezone can shift a day.

const DAY = 864e5;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const utc = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d, n) => ymd(utc(d) + n * DAY);
const weekdayOf = (d) => new Date(utc(d)).getUTCDay();
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(utc(s)) === s;
// 'YYYY-MM-DD' strings sort like the dates they name.
const later = (a, b) => (a > b ? a : b);
const earlier = (a, b) => (a < b ? a : b);
// The next Monday strictly after a date (a Monday gives the one a week later), and on or after it.
const nextMonday = (d) => addDays(d, (8 - weekdayOf(d)) % 7 || 7);
const mondayFrom = (d) => addDays(d, (8 - weekdayOf(d)) % 7);

// 'Mon Oct 26'
function nice(d) {
  const t = new Date(utc(d));
  return `${WEEKDAYS[t.getUTCDay()].slice(0, 3)} ${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

// Today where the member is: a 9pm run in Chicago is still that day there.
function todayIn(ms, timezone) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return ymd(ms);
  }
}

// ---- Small text helpers.

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const firstWord = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const plural = (w) => (/(s|sh|ch|x|z)$/.test(w) ? `${w}es` : `${w}s`);
// "an instructor", "a coach"
const an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

function listOf(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

// "first class free!" -> "First class free": the site's own words, cleaned up to end a sentence.
function sentence(s) {
  return cap(plain(s).replace(/\s+/g, ' ').replace(/[\s.!?,;:]+$/, ''));
}

// On-screen text is read in a second or two, so a hook goes up one sentence at a time.
function screenLines(hook) {
  return String(hook || '')
    .split(/(?<=[.?!:])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function deepPlain(v) {
  if (typeof v === 'string') return plain(v);
  if (Array.isArray(v)) return v.map(deepPlain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepPlain(x)]));
  return v;
}

const clampInt = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : null;
};

// The offer is what the gym was sold, so its numbers win. A saved offer has them as numbers; an older
// one only in words: "12 edited Reels a month" -> 12, "One 45-minute shoot" -> 45.
const REELS_RE = /(\d+)\s+(?:edited\s+|short\s+|vertical\s+)*reels?\b/i;
const MINUTES_RE = /(\d+)[\s-]*min(?:ute)?s?\b[^.]*?\bshoot/i;
function fromOffer(offer, re) {
  const lines = [].concat((offer && offer.core) || [], (offer && offer.oneLiner) || []);
  for (const l of lines) {
    const m = String(l).match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

// ---- Words that change with the kind of gym.

const COACH_WORD = { yoga: 'teacher', pilates: 'instructor', martial_arts: 'instructor', cycling: 'instructor', dance: 'teacher' };
// Classes here often include kids, and every child on camera needs a parent's signed OK, every time.
const KIDS_LIKELY = new Set(['martial_arts', 'dance', 'climbing']);

function wordsFor(category) {
  const coach = COACH_WORD[category] || 'coach';
  const session = category === 'climbing';
  return {
    coach,
    teaches: coach === 'coach' ? 'coach' : 'teach',
    noun: session ? 'session' : 'class', // "your first class"
    the: session ? 'the session' : 'class', // "before class", "before the session"
  };
}

// ---- The visit, in order. Weights are minutes of filming in a 45-minute shoot; they scale with it.

const PHASES = [
  ['arrive', 3],
  ['space', 5],
  ['coach', 12],
  ['class', 10],
  ['end', 5],
  ['after', 10],
];
const PHASE_ORDER = PHASES.map(([id]) => id);

function phaseLabel(phase, w) {
  return {
    arrive: 'Arriving',
    space: `Before ${w.the}`,
    coach: `Before ${w.the}, talking shots`,
    class: `During ${w.the}`,
    end: `End of ${w.the}`,
    after: `After ${w.the}`,
  }[phase];
}

// Shots several Reels share: filmed once, cut into each. This is the batching.
function sharedShots(w) {
  return {
    door: ['arrive', 'walking in through the front door, phone at chest height (5 seconds)'],
    desk: ['arrive', 'a hello at the front desk from staff who said yes (5 seconds)'],
    room: ['space', 'the empty room, a slow pan: 10 seconds vertical, then 10 seconds landscape'],
    gear: ['space', 'close-ups of the gear people use, 4 clips of 3 seconds'],
    booking: ['space', "a screen recording of their booking page on your phone, scrolling to the book button (don't finish a booking)"],
    warmup: ['class', 'the warm-up from the back of the room (10 seconds)'],
    wide: ['class', 'the whole room from a back corner on the tripod: 20 seconds vertical, then 20 seconds landscape'],
    close: ['class', 'close-ups of the work: hands, feet and focused faces, 5 clips of 3 seconds'],
    coaching: ['class', `the ${w.coach} coaching one person up close, someone who said yes (5 seconds)`],
    finish: ['end', `the last minute of ${w.the} and how it ends, wide (15 seconds)`],
    fives: ['end', 'people who said yes smiling and chatting as it ends (5 seconds)'],
  };
}

// The category ideas from lib/gaps.js, as shots on one content day. A string is a shared shot, a pair
// is [phase, what to film]. `role` ideas fold into the class video, coach or member story Reel; `event`
// ideas need a day of their own, so they become extra shoots to offer later. `hook` replaces an idea's
// hook where it states something we can't know about a real gym ("Twenty years on the mat").
const IDEA_PLAN = {
  'gym/first-week': { pillar: 'invite', shots: ['desk', ['coach', 'the coach walking a first-timer around the room, played by a member or staff who said yes (15 seconds)'], ['class', 'a beginner set, close (5 seconds)'], 'fives'] },
  'gym/meet-coach': { role: 'coach' },
  'gym/member-spotlight': { role: 'member' },
  'gym/crowd': { event: 'It needs an early morning and an evening visit, filmed from the same spot.' },
  'gym/myth': { pillar: 'teach', shots: [['coach', 'the coach doing the move wrong, then the fix, then right, filmed side-on (3 takes of 5 seconds)']] },
  'crossfit/wod': { pillar: 'show', shots: [['space', "the whiteboard with today's workout (5 seconds)"], ['class', 'three movements from the workout, close (3 seconds each)'], ['end', 'people on the floor after the last rep (5 seconds)']] },
  'crossfit/scaling': { pillar: 'invite', shots: [['class', 'an experienced member and a beginner doing the same move side by side, both who said yes (10 seconds)'], ['coach', 'the coach to camera: how they scale it for a beginner (15 seconds, 2 takes)']] },
  'crossfit/pr-bell': { event: 'It needs someone to hit a personal record on camera: film it on a testing day, or ask the coach to tell you when one is coming.' },
  'crossfit/coach-cue': { pillar: 'teach', hook: 'One cue to remember this week.', shots: [['coach', 'the coach gives one cue to camera in one sentence (2 takes)'], ['class', 'a member who said yes doing the move before and after the cue, side-on (2 clips of 5 seconds)']] },
  'crossfit/first-class': { pillar: 'invite', shots: ['warmup', ['class', 'the skill part, close (5 seconds)'], ['class', 'the workout, wide (10 seconds)'], 'fives'] },
  'yoga/flow': { pillar: 'teach', shots: [['class', "three poses from today's class, slow and steady, by a window if there is one (5 seconds each)"]], notes: ['Slow cuts, quiet music.'] },
  'yoga/teacher': { role: 'coach', hook: 'Meet one of our teachers.', shots: [['class', 'one quiet moment in class: the room still, only people who said yes (5 seconds)']] },
  'yoga/bring': { pillar: 'invite', hook: "First class? Here's what to bring.", shots: [['space', 'what to bring, laid out as the teacher names it: mat, water, towel, or whatever they say (5 seconds)'], ['arrive', 'walking in through the front door with a mat (5 seconds)']], notes: ["The teacher says what to bring. Don't guess."] },
  'yoga/ambience': { pillar: 'show', shots: [['space', 'the empty room with the light coming in (10 seconds)'], ['arrive', 'the first person arriving, filmed from behind, with their OK (5 seconds)']], notes: ['Best with an early class. Later in the day, call it "The studio before class".'] },
  'yoga/pose': { pillar: 'teach', shots: [['coach', 'the teacher shows the pose, one common mistake and the fix (2 takes)'], ['class', 'someone who said yes holding the finished pose (5 seconds)']] },
  'pilates/reformer-101': { pillar: 'invite', shots: [['space', 'close-ups of the reformer: springs, carriage, footbar (3 seconds each)'], ['coach', 'the instructor shows one easy move and names each part (2 takes, 20 seconds)']] },
  'pilates/class-preview': { role: 'class', pillar: 'show', hook: 'A whole class in thirty seconds.', shots: ['warmup', ['class', 'the burn: shaking legs and focused faces, close (3 clips of 3 seconds)'], ['end', 'the stretch at the end (5 seconds)'], 'fives'] },
  'pilates/instructor': { role: 'coach', hook: 'Meet one of our instructors.' },
  'pilates/first-class': { pillar: 'invite', shots: [['arrive', 'check-in at the front desk, staff who said yes (5 seconds)'], ['space', 'grip socks going on, then setting up the reformer (2 clips of 5 seconds)'], ['class', 'the first move of class (5 seconds)']] },
  'pilates/slowmo': { pillar: 'show', shots: [['class', 'four close-ups of slow, controlled movement at 60 or 120 fps, for slow motion (3 seconds each)']], notes: ['Quiet music.'] },
  'boxing/combo': { pillar: 'teach', shots: [['coach', 'the coach shows the combo slow, then full speed (2 takes)'], ['class', 'the combo on the bag, close and wide (2 clips of 5 seconds)']] },
  'boxing/first-class': { pillar: 'invite', shots: [['space', 'hands being wrapped, close (5 seconds)'], ['class', 'a first jab on the pads or the bag (3 seconds)'], ['class', 'the coach encouraging a beginner who said yes (5 seconds)']] },
  'boxing/coach': { role: 'coach', shots: [['class', 'the coach on the pads with someone who said yes (5 seconds)']] },
  'boxing/finisher': { pillar: 'show', shots: [['class', 'the last round on the bags with the timer in frame (10 seconds)'], ['end', 'everyone on the floor after the last round (5 seconds)']] },
  'boxing/stress': { pillar: 'show', shots: [['arrive', 'someone who said yes walking in, shoulders tight (5 seconds)'], ['class', 'the same person hitting the bag (5 seconds)'], ['after', 'the same person walking out, lighter (5 seconds)']] },
  'martial_arts/promotion': { event: 'Film it on their next belt promotion day as an extra shoot. A parent signs for every child first.' },
  'martial_arts/technique': { pillar: 'teach', shots: [['coach', 'the instructor shows one technique slow, then full speed (2 takes)'], ['class', 'partners drilling it, only people who said yes (10 seconds)']] },
  'martial_arts/first-class': { pillar: 'invite', shots: [['class', 'bowing in at the start (5 seconds)'], 'warmup', ['class', 'a beginner drill (5 seconds)'], 'fives'] },
  'martial_arts/instructor': { role: 'coach', hook: 'Meet one of our instructors.' },
  'martial_arts/adults': { pillar: 'invite', shots: [['class', 'adult beginners training, wide and close (2 clips of 5 seconds)'], ['class', 'the instructor encouraging them (5 seconds)']], notes: ['Only if they run a class adults can join. Ask the owner first, and if not, film another member question instead.'] },
  'climbing/route-set': { event: 'Film it on their next route-setting day.' },
  'climbing/first-timer': { pillar: 'invite', shots: [['space', 'rental shoes going on (5 seconds)'], ['class', 'the belay check, close (5 seconds)'], ['class', 'a first-timer who said yes on an easy wall (10 seconds)'], ['end', 'topping out (3 seconds)']] },
  'climbing/problem': { pillar: 'teach', shots: [['class', 'a climber who said yes on one problem: a fall, the beta, then the send (3 clips)']] },
  'climbing/community': { event: 'Film it on their next community night.' },
  'climbing/parties': { event: "Birthday parties mean kids and their families: offer it as an extra shoot, with a parent's signed OK for every child." },
  'cycling/drop': { pillar: 'show', shots: [['class', 'lights down at the start of a song (5 seconds)'], ['class', 'the drop: the whole room standing up on the bikes, wide (10 seconds)']] },
  'cycling/instructor': { role: 'coach', hook: 'Meet one of our instructors.', shots: [['class', 'the instructor on the mic mid-ride (5 seconds)']] },
  'cycling/first-ride': { pillar: 'invite', hook: "First ride? Here's how to set up.", shots: [['space', 'bike setup: seat height and clipping in, close (2 clips of 5 seconds)'], ['class', 'the first climb, wide (5 seconds)']] },
  'cycling/playlist': { pillar: 'show', hook: 'One ride, in 15 seconds.', shots: [['class', 'the room on four different songs, wide (3 seconds each)']], notes: ["Only put song names on screen if they have the rights to that music. Business accounts can't use most popular songs."] },
  'cycling/after': { pillar: 'people', shots: [['end', 'sweaty smiles and towels after the ride (5 seconds)'], 'fives'] },
  'dance/combo': { pillar: 'teach', shots: [['coach', 'the teacher shows the combo slow, then full speed (2 takes)'], ['class', 'the class doing it, wide (10 seconds)']] },
  'dance/recital': { event: 'Film it at their next show. A parent signs for every child first.' },
  'dance/teacher': { role: 'coach', shots: [['class', 'the teacher dancing a short solo moment (5 seconds)']] },
  'dance/class-preview': { role: 'class', pillar: 'show', hook: 'What a class here looks like.', shots: ['warmup', ['class', 'learning the steps, close (5 seconds)'], ['end', 'the final run-through, wide (15 seconds)']] },
  'dance/bts': { event: 'Film it before their next show.' },
};

// For ideas added to lib/gaps.js later: a guess from the id, with its shots filmed as written.
function pillarOf(id) {
  if (/first|bring|scaling|adults|reformer|beginner/.test(id)) return 'invite';
  if (/cue|myth|pose|combo|technique|flow|problem|tip/.test(id)) return 'teach';
  if (/coach|teacher|instructor|spotlight|member|community|after/.test(id)) return 'people';
  return 'show';
}

// One line of value per caption: advice that's true anywhere, never a claim about this gym.
const VALUE = {
  show: ['Tip: get there 10 minutes early on your first day.', 'Turn the sound on for this one.', 'Tag someone you would bring with you.', 'Save this for your first visit.'],
  people: ["Tell your {coach} it's your first time. It helps them help you.", 'Everyone in that room had a first day too.', 'Say hi when you come in.', 'What would you add? Tell us in the comments.'],
  teach: ['Save this and try it next time.', 'Send this to someone you train with.', 'Got a question? Ask it in the comments.', 'Try it, then tell us how it went.'],
  invite: ['Wear something you can move in and bring water.', "Not sure it's for you? That's what a first visit is for.", 'Questions before you come? Send us a message.', 'Come a few minutes early and say hi at the desk.'],
};

const MUSIC_NOTE = "Fast cuts of about 2 seconds, on the beat. Use a sound from the app's commercial library: business accounts can't use most popular songs.";
const QA = ['What would you tell someone nervous about starting?', 'What was your first week like?', 'What keeps you coming back?', 'What surprised you when you started?'];
const FAQ = ['Do I need to be fit to start?', 'What should I bring the first time?', "What if I can't keep up?", 'How early should I get there?'];

// Reels that work in any gym, for when the gaps and ideas run out. Each is shootable on the day.
function genericList(pillar, w) {
  const qa = (q, i) => ({
    id: `member-qa-${i + 1}`,
    title: 'One question, a few members',
    hook: `We asked our members: ${q.charAt(0).toLowerCase()}${q.slice(1)}`,
    screen: ['We asked our members', q],
    shots: [['after', `members who said yes and signed, one at a time, same spot and height: "${q}" (10 seconds each)`]],
    notes: ['Same spot and height for every answer, so the cuts match. Three or four answers is plenty.'],
    value: 'What would you add? Tell us in the comments.',
  });
  const faq = (q, i) => ({
    id: `faq-${i + 1}`,
    title: 'A question people ask before they join',
    hook: q,
    shots: [['coach', `the ${w.coach} answers "${q}" to camera in their own words (20 seconds, 2 takes)`]],
    notes: [`Let the ${w.coach} answer. Don't script facts about the gym.`],
    value: 'Got another question? Ask it in the comments.',
  });
  const lists = {
    show: [
      { id: 'class-energy', title: `${cap(w.noun)} in 15 seconds`, hook: `One ${w.noun}. Fifteen seconds.`, shots: ['wide', 'close', 'finish'], notes: [MUSIC_NOTE] },
      {
        id: 'tour',
        title: 'A 15-second tour',
        hook: "First time here? Here's the place in 15 seconds.",
        shots: ['door', 'room', 'gear', ['space', 'the spots a first-timer asks about, like where bags go (3 seconds each)']],
        notes: ['Film it before people arrive, so nobody is in it by accident. Never film in or toward locker rooms, changing areas or restrooms.'],
      },
      {
        id: 'before',
        title: `Before ${w.the} starts`,
        hook: `What happens before ${w.the} starts.`,
        shots: [['space', `the ${w.coach} setting up: gear out, music on, the room ready (3 clips of 3 seconds)`], ['arrive', 'the first people walking in, filmed from behind, people who said yes (5 seconds)']],
      },
    ],
    people: [
      qa(QA[0], 0),
      {
        id: 'front-desk',
        title: 'Meet the front desk',
        hook: 'The first face you see when you walk in.',
        shots: [['arrive', 'whoever is on the front desk, if they said yes: a wave and their first name to camera (2 takes, 10 seconds)'], 'desk'],
        notes: ['Ask first. If nobody works the desk, film another member question instead.'],
        value: 'Say hi when you come in.',
      },
      {
        id: 'rapid',
        title: `Quick questions for ${an(w.coach)}`,
        hook: `Five quick questions for one of our ${plural(w.coach)}.`,
        shots: [['coach', `${an(w.coach)} answers five quick questions to camera: favorite move, least favorite move, a song to train to, one tip for a beginner, one word for this place (2 minutes)`]],
        value: 'What should we ask next? Tell us in the comments.',
      },
      ...QA.slice(1).map((q, i) => qa(q, i + 1)),
    ],
    teach: [
      faq(FAQ[0], 0),
      {
        id: 'tip',
        title: `${cap(an(w.coach))}'s tip`,
        hook: `One tip for your first week, from one of our ${plural(w.coach)}.`,
        shots: [['coach', `the ${w.coach} gives one tip to camera, then shows it slow and at normal speed (2 takes)`]],
        notes: [`Let the ${w.coach} pick the tip.`],
        value: 'Save this and try it next time.',
      },
      ...FAQ.slice(1).map((q, i) => faq(q, i + 1)),
    ],
    invite: [
      {
        id: 'beginner',
        title: 'The beginner version',
        hook: `Here's the beginner version of one move from today's ${w.noun}.`,
        shots: [['coach', `the ${w.coach} shows the beginner version of one move from today (2 takes)`], ['class', 'someone who said yes doing the beginner version (5 seconds)']],
        value: 'Start where you are.',
      },
      { id: 'how-to-book', title: `How to book your first ${w.noun}`, hook: `Here's how to book your first ${w.noun}.`, shots: ['booking', 'desk'], value: 'Questions before you come? Send us a message.' },
      {
        id: 'invite',
        title: `An invite from ${an(w.coach)}`,
        hook: `Never tried a ${w.noun} here? This one's for you.`,
        shots: [['coach', `the ${w.coach} invites someone who has never been to come try a ${w.noun}, in their own words, to camera (2 takes, 10 seconds)`], 'wide'],
      },
      { id: 'first-visit', title: 'Your first visit', hook: "Here's what your first visit looks like.", shots: ['door', 'desk', 'warmup', 'fives'], value: 'Wear something you can move in and bring water.' },
    ],
  };
  return lists[pillar];
}

// The first post of each week shows or teaches (alternating), the second is about people, the third
// invites them in. Week one opens on the class video, a coach and the offer: the fastest win.
const pillarFor = (i) => [Math.floor(i / 3) % 2 ? 'teach' : 'show', 'people', 'invite'][i % 3];
const OFFSETS = [0, 2, 4];

const reelRef = (reels) => (reels.length === 1 ? `Reel ${reels[0]}` : `Reels ${listOf(reels.map(String))}`);

// input: { row (one ranked gym from gym.find_gaps), offer?, reels?, shootMinutes?, startDate?, member?,
// business?, now?, timezone? }. Returns the whole kit except the saved release form.
function contentDay({ row, offer = null, reels, shootMinutes, startDate, member = {}, business = null, now = Date.now(), timezone } = {}) {
  if (!row || !row.gym || !row.gym.name) throw new Error('Pick a gym first.');
  const gym = row.gym;
  const name = plain(gym.name);
  const cat = IDEAS[gym.category] && gym.category !== 'other' ? gym.category : 'gym';
  const w = wordsFor(cat);
  const site = row.site || {};
  const contact = row.contact || {};
  const gapIds = new Set((row.gaps || []).map((g) => g && g.id));
  const me = (member && member.firstName) || (offer && offer.member && offer.member.firstName) || null;
  const biz = business || (offer && offer.member && offer.member.business) || null;

  // The call to action: the gym's own offer, word for word, or just how to book. Never a made-up one.
  const siteOffer = site.offer && site.offer.kind !== 'none' && site.offer.text ? site.offer : null;
  const offerText = siteOffer ? sentence(siteOffer.text) : null;
  const offerLabel = siteOffer ? OFFER_LABEL[siteOffer.kind] || 'intro offer' : null;
  const cta = offerText ? `${offerText}. Link in bio to book.` : `Link in bio to book ${cat === 'climbing' ? 'your first visit' : 'a class'}.`;

  const nReels = clampInt(reels, 1, 30) || clampInt(offer && offer.reels, 1, 30) || clampInt(fromOffer(offer, REELS_RE), 1, 30) || 12;
  const minutes = clampInt(shootMinutes, 20, 180) || clampInt(offer && offer.shootMinutes, 20, 180) || clampInt(fromOffer(offer, MINUTES_RE), 20, 180) || 45;

  // Dates. Posts start on the start date; the shoot is a week before it when there's time, and never
  // later than 3 days before it, so the first 3 can be edited and approved before the first post.
  const today = todayIn(now, timezone);
  if (startDate != null && startDate !== '' && !isDate(startDate)) throw new Error('Write the first post date like 2026-10-26.');
  let start = startDate || nextMonday(today);
  // Run on a Friday to Sunday, next Monday is too soon to shoot and get the first 3 approved, so a
  // start date the member didn't pick moves a week. One they picked is kept, with a warning below.
  const moved = !startDate && addDays(start, -3) < addDays(today, 1);
  if (moved) start = addDays(start, 7);
  const weeks = Math.ceil(nReels / 3);
  const shoot = later(addDays(start, -7), addDays(today, 1));
  const lastDay = addDays(start, -3);
  const tight = shoot > lastDay;
  const firstThree = tight ? addDays(shoot, 1) : earlier(addDays(shoot, 3), addDays(start, -2));
  // The latest shoot day the owner can pick without moving the dates we tell them: a day to edit
  // before the first 3 are due.
  const latest = tight ? shoot : earlier(lastDay, addDays(firstThree, -1));
  const approveBy = addDays(firstThree, 2);
  const rest = nReels > 3 ? later(earlier(addDays(shoot, 7), addDays(start, 3)), addDays(firstThree, 1)) : null;
  const report = addDays(start, weeks * 7);
  const nextShoot = addDays(shoot, weeks * 7);

  // People, from the input only: the owner and coaches named on the gym's site.
  const people = Array.isArray(site.people) ? site.people.filter((p) => p && p.name) : [];
  const owner = (contact.owner && contact.owner.name ? contact.owner : null) || people.find((p) => /owner|founder/i.test(p.role || '')) || null;
  const ownerFirst = owner ? firstWord(plain(owner.name)) : null;
  const ownerRef = ownerFirst || 'the owner';
  const coachNames = people.filter((p) => /coach|trainer|instructor|teacher/i.test(p.role || '')).map((p) => plain(p.name)).slice(0, 3);

  // What the member promised in the offer gets planned even when no gap asked for it.
  const bonuses = offer && Array.isArray(offer.bonuses) ? offer.bonuses.filter(Boolean) : [];
  const promised = (re) => bonuses.some((b) => re.test(`${b.id || ''} ${b.title || ''}`));
  const wantClassVideo = gapIds.has('site-video') || promised(/homepage|website/i);
  const wantIntros = gapIds.has('coaches') || promised(/coach/i);
  const wantAdCuts = gapIds.has('ads') || gapIds.has('offer') || promised(/\bads?\b|ad cut/i);
  const wantGoogle = promised(/google/i);

  // Ideas in queues by pillar: gap fixes first, then what the proposal pitched, then the category's.
  const S = sharedShots(w);
  const used = new Set();
  const queues = { show: [], people: [], teach: [], invite: [] };
  const add = (c) => {
    if (!c || used.has(c.id)) return;
    used.add(c.id);
    queues[c.pillar].push(c);
  };
  const plans = (IDEAS[cat] || IDEAS.gym).map((idea) => ({ idea, plan: IDEA_PLAN[`${cat}/${idea.id}`] || null }));
  const roleIdea = (role) => plans.find((p) => p.plan && p.plan.role === role) || null;

  if (wantClassVideo) {
    const absorbed = roleIdea('class');
    if (absorbed) used.add(`idea:${absorbed.idea.id}`);
    add({
      id: 'class-video',
      pillar: 'show',
      title: `What a ${w.noun} looks like`,
      hook: (absorbed && (absorbed.plan.hook || absorbed.idea.hook)) || `This is what a ${w.noun} here looks like.`,
      shots: ['room', 'warmup', 'wide', 'close', 'coaching', 'finish'],
      onScreen: ['Warm up', 'Work', 'Finish'],
      notes: ['Cut two versions: a vertical Reel of 15 to 30 seconds, and a 30-second landscape video for the top of their homepage (an MP4 under 10 MB, no sound needed). Send the landscape one to whoever updates their website.'],
      deliverable: `a 30-second homepage ${w.noun} video`,
    });
  }

  const coachIdea = roleIdea('coach');
  if (coachIdea) used.add(`idea:${coachIdea.idea.id}`);
  const who = coachNames.length ? listOf(coachNames.map(firstWord)) : wantIntros ? `each ${w.coach} who's in that day` : `the ${w.coach} on that day`;
  add({
    id: 'coach',
    pillar: 'people',
    title: coachIdea ? coachIdea.idea.title : `Meet the ${w.coach}`,
    hook: coachNames.length === 1 ? `Meet ${firstWord(coachNames[0])}, one of our ${plural(w.coach)}.` : (coachIdea && (coachIdea.plan.hook || coachIdea.idea.hook)) || `Meet one of our ${plural(w.coach)}.`,
    shots: [['coach', `${who}, to camera: first name, what they ${w.teaches} and one thing they'd tell a beginner (2 takes, 20 seconds)`], ...((coachIdea && coachIdea.plan.shots) || ['coaching'])],
    onScreen: coachNames.length === 1 ? [] : [`[${cap(w.coach)}'s first name]`, `[What they ${w.teaches}]`],
    notes: [
      wantIntros ? `Also cut a 20-second intro for each ${w.coach}, for their team page${site.links && site.links.team ? ` (${shortSite(site.links.team)})` : ''} and their Stories.` : '',
      coachNames.length ? '' : `Ask ${ownerRef} which ${plural(w.coach)} are in that day.`,
    ],
    deliverable: wantIntros ? `a 20-second intro for each ${w.coach}` : null,
  });

  const memberIdea = roleIdea('member');
  if (memberIdea || gapIds.has('stories') || promised(/member.?stor/i)) {
    if (memberIdea) used.add(`idea:${memberIdea.idea.id}`);
    add({
      id: 'member-story',
      pillar: 'people',
      title: memberIdea ? memberIdea.idea.title : 'Member story',
      hook: 'Why [first name] keeps coming back.',
      shots: [
        ['after', 'that member: about a minute of answers to three questions. Why did you start? What was your first week like? What would you tell someone nervous about starting?'],
        ['class', 'the member for the story training, 3 clips of 3 seconds (pick them with the owner, and get their signed release, before class)'],
        ['end', "that member's smile at the end (3 seconds)"],
      ],
      onScreen: ['"[Their best line, in their words]"'],
      notes: ['Pick the member with the owner. Release signed first, and they see the Reel before it goes up.', 'Their words, not yours: no weight, body or before-and-after numbers on screen or in the caption.'],
      value: 'Everyone in that room had a first day too.',
    });
  }

  const adLines = offerText
    ? [`${offerText}.`, `Never been to a ${w.noun} here? ${offerText}.`, `Nervous about your first ${w.noun}? ${offerText}.`]
    : [cta, `Never been to a ${w.noun} here? Link in bio to book.`, `Nervous about your first ${w.noun}? Link in bio to book.`];
  const offerReel = {
    id: offerText ? 'offer' : 'how-to-book',
    pillar: 'invite',
    title: offerText ? `The ${offerLabel}` : `How to book your first ${w.noun}`,
    hook: offerText ? `${offerText}. Here's how it works.` : `Thinking about trying a ${w.noun}? Here's how to book.`,
    shots: [
      wantAdCuts
        ? ['coach', `the ${w.coach} or owner says ${offerText ? 'the offer' : 'how to book'} to camera three ways, one for each ad cut: "${adLines[0]}", "${adLines[1]}" and "${adLines[2]}" (2 takes each)`]
        : ['coach', offerText ? `the ${w.coach} or owner explains "${offerText}" to camera: who it's for and how to book (2 takes, 20 seconds)` : `the ${w.coach} or owner says how to book a first ${w.noun}, to camera (2 takes, 15 seconds)`],
      'door',
      'desk',
      'booking',
      'fives',
    ],
    onScreen: ['Walk in', 'Say hi', `Try a ${w.noun}`],
    notes: [
      wantAdCuts ? 'Ad cuts: three 15-second versions with the same middle and a different first line. You deliver the files; whoever runs their ads decides when to use them.' : '',
      offerText ? '' : "We found no intro offer on their site, so this one just says how to book. If they have one, ask for the exact wording and use it.",
      'Put the tracked link in their bio before this one goes up.',
    ],
    value: "Not sure it's for you? That's what a first visit is for.",
    deliverable: wantAdCuts ? '3 ad cuts of 15 seconds' : null,
  };
  // An offer nobody sees on their site is the gap to fix first; otherwise the pitched ideas go first.
  if (gapIds.has('offer')) add(offerReel);

  const extras = [];
  const fromIdea = ({ idea, plan }, pitched) => {
    if (plan && plan.event) {
      if (!extras.some((e) => e.id === idea.id)) extras.push({ id: idea.id, title: idea.title, note: plan.event, pitched });
      return null;
    }
    if (plan && plan.role && (plan.role !== 'class' || used.has('class-video'))) return null;
    return {
      id: `idea:${idea.id}`,
      pillar: plan ? plan.pillar : pillarOf(idea.id),
      title: idea.title,
      hook: (plan && plan.hook) || idea.hook,
      shots: plan && plan.shots ? plan.shots : [['class', idea.shots]],
      notes: (plan && plan.notes) || [],
    };
  };
  const pitched = (row.ideas || []).filter((i) => i && i.id).map((i) => plans.find((p) => p.idea.id === i.id) || { idea: i, plan: null });
  for (const p of pitched) add(fromIdea(p, true));
  add(offerReel);
  for (const p of plans) if (!pitched.some((x) => x.idea.id === p.idea.id)) add(fromIdea(p, false));

  if (owner) {
    add({
      id: 'owner',
      pillar: 'people',
      title: `Meet ${ownerFirst}`,
      hook: `Meet ${plain(owner.name)}, the ${String(owner.role || 'owner').toLowerCase()}.`,
      shots: [['coach', `${ownerFirst} to camera: what they want someone nervous about a first visit to know (2 takes, 20 seconds)`], ['class', `${ownerFirst} with members during ${w.the}, if they're around (5 seconds)`]],
      notes: ['Ask first: some owners would rather stay off camera. If they say no, film another member question.'],
    });
  }

  const genericCount = { show: 0, people: 0, teach: 0, invite: 0 };
  const hasFirstTimer = () => [...used].some((id) => /^idea:.*(first|bring|reformer)/.test(id));
  function generic(pillar) {
    const list = genericList(pillar, w);
    for (;;) {
      const n = genericCount[pillar]++;
      const base = list[n % list.length];
      const round = Math.floor(n / list.length);
      const id = round ? `${base.id}-${round + 1}` : base.id;
      // The offer Reel already shows how to book, so skip the generic one when it's in.
      if (used.has(id) || (base.id === 'first-visit' && hasFirstTimer()) || (base.id === 'how-to-book' && used.has('offer'))) continue;
      used.add(id);
      return round ? { ...base, id, title: `${base.title}, part ${round + 1}` } : { ...base };
    }
  }

  const chosen = Array.from({ length: nReels }, (_, i) => {
    const pillar = pillarFor(i);
    return { pillar, ...(queues[pillar].shift() || generic(pillar)) };
  });

  // Shot list: one entry per Reel, in posting order, so Reel n is the nth post.
  const lastLine = offerText ? `${offerText}. Link in bio.` : cta;
  const resolve = (s, id, j) => (typeof s === 'string' ? { phase: S[s][0], text: S[s][1], key: s } : { phase: s[0], text: s[1], key: `${id}:${j}` });
  // Each Reel's shots in the order they happen on the day.
  for (const c of chosen) c.resolved = c.shots.map((s, j) => resolve(s, c.id, j)).sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
  const shotList = chosen.map((c, i) => ({
    reel: i + 1,
    title: c.title,
    hook: c.hook,
    shots: c.resolved.map((s) => `${phaseLabel(s.phase, w)}: ${s.text}`),
    onScreenText: [...(c.screen || screenLines(c.hook)), ...(c.onScreen || []), lastLine],
    notes: (c.notes || []).filter(Boolean).join(' '),
  }));

  // The shoot plan: the same shots, by when they happen, each named with the Reels it feeds.
  const total = PHASES.reduce((a, [, wt]) => a + wt, 0);
  let acc = 0;
  const bounds = PHASES.map(([id, wt]) => {
    const from = Math.round((acc / total) * minutes);
    acc += wt;
    return { id, from, to: Math.round((acc / total) * minutes) };
  });
  const span = (id) => bounds.find((b) => b.id === id);
  const before = span('class').from;
  const byKey = new Map();
  chosen.forEach((c, i) => {
    for (const s of c.resolved) {
      const e = byKey.get(s.key) || { ...s, reels: [] };
      if (!e.reels.includes(i + 1)) e.reels.push(i + 1);
      byKey.set(s.key, e);
    }
  });
  const firstN = Math.min(3, nReels);
  const WHAT = {
    arrive: `Arrive ${before} minutes before ${w.the} starts. Say hi, ask ${ownerRef} who would rather not be filmed, and tape the "Filming today" sign at the front desk. Phone on 4K at 30 fps, lens wiped, Do Not Disturb on. In every part, film the shots for Reel${firstN > 1 ? `s 1 to ${firstN}` : ' 1'} first: they're due first.`,
    space: 'Space B-roll while it is quiet, before the room fills. Hold each shot about 5 seconds. Nobody in frame who hasn\'t said yes.',
    coach: `Talking shots before ${w.the}, while people are free: mic on, waist up, eye level, 2 takes of each. Short on time? Film the ones for the first Reels now and the rest after ${w.the}.`,
    class: `During ${w.the}: the warm-up and the first part, from the edges of the room. Then put the phone down and let them train.`,
    end: `Back for the last minutes of ${w.the}, to catch how it ends.`,
    after: `After ${w.the}: member clips, only with people who said yes and signed the release. Then thank ${ownerRef} and book next month's content day before you leave.`,
  };
  const plan = bounds.map((b) => ({
    at: `min ${b.from} to ${b.to}`,
    what: WHAT[b.id],
    shots: [...byKey.values()]
      .filter((s) => s.phase === b.id)
      .sort((x, y) => x.reels[0] - y.reels[0])
      .map((s) => `${reelRef(s.reels)}: ${s.text}`),
  }));
  const after = minutes - span('end').to;
  // Filming time is what was sold; the visit runs longer because the middle of the class is theirs.
  const book = `Book it around their busiest weekday ${w.noun}. Arrive ${before} minutes before it starts. You film for ${minutes} minutes in all: ${before} before ${w.the}, the first ${span('class').to - span('class').from} and the last ${span('end').to - span('end').from} minutes of it, and ${after} after. In the middle, put the phone down and let them train. With a 45 to 60-minute ${w.noun}, you're there about ${before + after + 45} to ${before + after + 60} minutes in all.`;

  // Calendar: 3 posts a week, 2 days apart, from the start date.
  const tiktok = gapIds.has('tiktok') || contact.tiktok || gym.tiktok || (site.socials && site.socials.tiktok);
  const where = tiktok ? 'Instagram and TikTok' : 'Instagram';
  const valuesUsed = new Set();
  const valueFor = (c) => {
    const pool = [c.value, ...VALUE[c.pillar]].filter(Boolean).map((v) => v.replace('{coach}', w.coach));
    const v = pool.find((x) => !valuesUsed.has(x)) || pool[valuesUsed.size % pool.length];
    valuesUsed.add(v);
    return v;
  };
  const calendar = chosen.map((c, i) => {
    const date = addDays(start, Math.floor(i / 3) * 7 + OFFSETS[i % 3]);
    return { date, weekday: WEEKDAYS[weekdayOf(date)], reel: i + 1, title: c.title, caption: [c.hook, valueFor(c), cta].join('\n'), cta, where };
  });
  const lastPost = calendar[calendar.length - 1].date;

  // The member's promise, in the offer's words. A free first month has nothing to refund, so it waits.
  const guarantee = offer && offer.guarantee && offer.guarantee.text && !(offer.price && offer.price.firstMonthFree) ? sentence(offer.guarantee.text) : null;
  const promiseFirst3 = !!guarantee && /\bfirst 3\b/i.test(guarantee);

  // Tracking: the proof. A tagged link in the bio, a QR code for print, one question at sign-up.
  const base = normalizeUrl(gym.website) || normalizeUrl(site.url);
  const campaign = `reels-${start.slice(0, 7)}`;
  const tag = (source, medium) => (base ? `${base}${base.includes('?') ? '&' : '?'}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}` : null);
  const link = tag('instagram', 'social');
  const qrLink = tag('qr', 'print');
  const ttLink = tiktok ? tag('tiktok', 'social') : null;
  const bookingName = Array.isArray(site.booking) && site.booking[0] && site.booking[0].name;
  const ig = row.insta || null;
  const baseline = [];
  if (ig && Number.isFinite(ig.followers)) baseline.push(`${num(ig.followers)} followers`);
  if (ig && Number.isFinite(ig.postsLast30)) baseline.push(`${ig.postsLast30} posts in the last 30 days`);
  if (ig && Number.isFinite(ig.reelsShare) && ig.sampled) baseline.push(`${Math.round(ig.reelsShare * ig.sampled)} of the last ${ig.sampled} posts were Reels`);
  const baselineText = baseline.length ? `${listOf(baseline)}${ig.handle ? ` on @${ig.handle} when you checked` : ''} (check again the day before)` : 'their followers and how many posts they made in the last 30 days';
  const steps = [
    `Ask ${ownerRef} for the page people use to book ${offerLabel ? `the ${offerLabel}` : `a first ${w.noun}`}${bookingName ? ` (they use ${bookingName}, so ask for that link)` : ''}. No booking page? Use their website${base ? `, ${shortSite(base)}` : ''}.`,
    `Add this to the end of that address: ?utm_source=instagram&utm_medium=social&utm_campaign=${campaign} (if the address already has a ?, start with & instead).${link ? ` On their website, that's ${link}` : ''}`,
    'Put it in their Instagram bio: Edit profile, then Links, then Add external link. Every caption says "link in bio", so this is the link that gets counted.',
    ttLink ? `TikTok: the same link with utm_source=tiktok in their profile, if TikTok lets their account add a website: ${ttLink}` : null,
    `QR code: open ${qrLink || 'the same link with utm_source=qr&utm_medium=print'} in Chrome on a computer, right-click the page, choose "Create QR code for this page", then Download. Print it for the front window, or on cards members can hand to a friend: "${offerText ? `${offerText}. ` : ''}Scan to book."`,
    'Ask the front desk to ask every new person "How did you hear about us?" and tick "Instagram or TikTok video" on a tally sheet, or in their booking system if it has a referral field. That catches people who walk in without clicking.',
    `Before the first post, write down where they are now: ${baselineText}. Ask ${ownerRef} how many trial sign-ups and new members they had last month.`,
    `On ${nice(report)}, count: link clicks and profile visits (Instagram Insights)${site.tracking && site.tracking.analytics ? `, visits from the link (Google Analytics: Reports, then Acquisition, then Traffic acquisition, and search for ${campaign})` : ''}, trial sign-ups who said they saw a video, and how many of them joined. Then put the numbers in the Monthly client report.`,
  ].filter(Boolean);
  // What to count at month end, in the order the Monthly client report asks for it: the owner's
  // numbers (trial sign-ups, new members) first, reach after. Blanks are ___, not [brackets], so HQ
  // doesn't hold back the Copy button on a worksheet.
  const monthEnd = [
    `${name}: numbers for ${nice(start)} to ${nice(lastPost)}`,
    '',
    'Trial sign-ups from the videos: ___ (booked from the tracked link or QR code, or told the front desk they saw a video)',
    `New members from the videos: ___ (ask ${ownerRef})`,
    'Views on the videos: ___',
    `Reels posted: ___ of ${nReels}`,
    `Followers at the start: ___${ig && Number.isFinite(ig.followers) ? ` (${num(ig.followers)} when you checked)` : ''}. At the end: ___`,
    'Profile visits: ___',
    'Link clicks: ___',
    'Trial sign-ups the month before we started: ___',
    'Best Reel: ___, because ___',
    '',
    `Next content day: ${nice(nextShoot)}.`,
  ].join('\n');

  // What the gym gets this month, from the gaps and the offer's bonuses.
  const extraFiles = chosen.map((c) => c.deliverable).filter(Boolean);
  const deliverables = [`${nReels} Reels with captions`, ...extraFiles, wantGoogle ? '3 Reels for the Google Business Profile' : null].filter(Boolean);
  const colors = site.colors && site.colors.primary ? listOf([site.colors.primary, site.colors.accent].filter(Boolean)) : null;
  const fileName = `${slug(name)}_${calendar[0].date}_r01_${slug(chosen[0].title)}_v1.mp4`;

  const handoff = [
    `Today: send ${ownerRef} the kickoff message, and set up the tracked link before anything posts.`,
    `Make a shared folder called "${name} video" (Google Drive or Dropbox) with five folders inside: 1 Raw, 2 For review, 3 Approved, Releases, Brand. Share it with ${ownerRef}.`,
    `Name every file the same way, post date first, so the folder sorts itself: ${fileName} (v2 after changes).`,
    `Content day, ${nice(shoot)}: back up the raw clips to "1 Raw" that day, and put a photo of every signed release in "Releases".`,
    `First 3 Reels by ${nice(firstThree)}, within 7 days of the shoot (aim for 3 days). Put them in "2 For review" with their captions and post dates.${promiseFirst3 ? ` Your promise to them rides on these: "${guarantee}."` : ''}`,
    guarantee && !promiseFirst3 ? `Your promise to them: "${guarantee}."` : null,
    `48-hour approval window: ${ownerRef} replies "approved" or sends changes, one round per Reel. No reply after 48 hours? Send one friendly reminder. Nothing goes up without their OK.`,
    rest ? `The other ${nReels - 3} by ${nice(rest)}, the same way, so each one is approved before its post date.` : null,
    `A week after your 4th Reel goes up, screenshot their Reels tab and run "Before-and-after card": your first proof, made in 2 minutes. If the views didn't go up, it tells you what to say instead.`,
    extraFiles.length ? `Also this month: ${listOf(extraFiles)}. Each goes out with the batch its Reel is in.` : null,
    wantGoogle ? `Google Business Profile: once they're approved, add 3 of the Reels as videos on their profile (30 seconds or less each). Ask ${ownerRef} to add you as a manager, or send them the files.` : null,
    `Set up once, reuse all month: one caption style in your editing app (${colors ? `their colors, ${colors}` : 'colors from their logo'}, one font, their logo on the last frame).`,
    `Approved files go in "3 Approved". Whoever posts (their team, or you if they give you access) follows the calendar: same caption, location tagged, on ${where}. Meta Business Suite schedules Instagram and Facebook posts for free.`,
    'Anything in [brackets] gets filled in after the shoot.',
    `Month-end report on ${nice(report)}: count the numbers from the tracking steps, put them in the Monthly client report and send it with three ideas for next month.${offer && offer.price && offer.price.firstMonthFree ? " This is a free case-study month, so that's when you ask if you can share the results, only with their OK." : ''}`,
    `Before you leave the content day, book the next one: ${nice(nextShoot)}, same ${w.noun}. Same folders, same file names, same plan every month. Only the ideas change.`,
  ].filter(Boolean);

  const gear = [
    'Your phone with 20 GB free, set to 4K at 30 fps (60 fps for anything you will slow down).',
    `A small tripod or clamp, for the wide shots${wantClassVideo ? ' and the landscape homepage video' : ''}.`,
    `A clip-on wireless mic for the ${w.coach} and members: gym music drowns out a phone mic.`,
    'A small LED light, or turn faces toward the brightest window.',
    'A power bank, a cable and a lens cloth.',
    `Ten printed release forms and a pen ("${FORM_NAME}" in your Library), plus a "Filming today" sign for the front desk.`,
  ];

  const consent = [
    `Everyone clearly in a video signs the release first: "${FORM_NAME}" in your Library. Print ten, or show it on your phone.`,
    `Ask ${ownerRef} to tape a "Filming today" sign at the front desk and to tell the ${w.noun} at the start: anyone who would rather not be filmed stays out of shot, no questions asked.`,
    'Wide shots: film from behind, or keep anyone who said no out of frame. If in doubt, cut it.',
    "Kids: a parent or guardian signs for each child, every filming day, before you film. No child's name in captions or on screen.",
    KIDS_LIKELY.has(cat) ? `Their ${plural(w.noun)} may include kids, so film an adult ${w.noun} if you can.` : null,
    'Anyone featured in a Reel sees it before it goes up.',
    'Anyone can ask for a video to come down later. You delete it from the shared folder and your drafts, and the gym takes it off its pages.',
    'Never film in or toward locker rooms, changing areas or restrooms.',
    'Keep a photo of every signed form in the Releases folder.',
  ].filter(Boolean);

  // How the month answers each gap the member pitched, by Reel number.
  const reelOf = (id) => {
    const i = chosen.findIndex((c) => c.id === id);
    return i < 0 ? null : i + 1;
  };
  const FIX = {
    'site-video': () => reelOf('class-video') && `Reel ${reelOf('class-video')} shows a ${w.noun}, and you cut a 30-second landscape version for their homepage.`,
    quiet: () => `${nReels} posts on a calendar, 3 a week, so the page doesn't go quiet.`,
    reels: () => 'Every post this month is a Reel.',
    engagement: () => 'Every Reel opens on a hook in the first second and shows real people.',
    tiktok: () => 'Each Reel goes to TikTok too, with no extra filming.',
    ads: () => reelOf(offerReel.id) && `Three 15-second ad cuts from Reel ${reelOf(offerReel.id)}, each with a different first line.`,
    offer: () => reelOf(offerReel.id) && offerText && `Reel ${reelOf(offerReel.id)} sells "${offerText}", with the tracked link in their bio.`,
    stories: () => reelOf('member-story') && `Reel ${reelOf('member-story')} is a member story, with the member's OK.`,
    coaches: () => reelOf('coach') && `Reel ${reelOf('coach')} introduces ${an(w.coach)}${wantIntros ? `, and you cut a 20-second intro for each ${w.coach}` : ''}.`,
  };
  const fixes = (row.gaps || [])
    .filter((g) => g && FIX[g.id])
    .map((g) => ({ gap: g.title, plan: FIX[g.id]() }))
    .filter((f) => f.plan);

  const warnings = [];
  if (moved) warnings.push(`Next Monday is too soon to shoot and get the first 3 approved, so posts start ${nice(start)}.`);
  if (tight) warnings.push(`A first post on ${nice(start)} leaves no time to shoot, edit and get the first 3 approved. Pick a start date on or after ${nice(mondayFrom(addDays(today, 4)))}.`);
  else if (start < today) warnings.push(`The start date, ${nice(start)}, has already passed.`);
  if (!(contact.instagram || gym.instagram || (site.socials && site.socials.instagram) || (ig && ig.handle))) {
    warnings.push("We didn't find an Instagram account for them. Ask: if they don't have one, setting it up together comes first (name, logo, a bio with the tracked link).");
  }
  if (!base) warnings.push('No website on file, so there is no tracked link yet. Ask for their booking page and add the tags in the tracking steps.');
  if (!offerText) warnings.push(`We found no intro offer on their site, so every call to action says "${cta}" If they have one, ask for the exact wording.`);
  if (nReels > 16) warnings.push(`${nReels} Reels from one shoot is a lot. Film the class shots once and cut them several ways, or book a second shoot.`);
  if (minutes < 30 && nReels > 6) warnings.push(`${minutes} minutes is tight for ${nReels} Reels. Film the shots for the first 3 Reels first, and the talking shots after class if the ${w.coach} has time.`);

  const kickoff = [
    `${ownerFirst ? `Hi ${ownerFirst}` : `Hi ${name} team`}, thanks for saying yes. Here's the first month, so you know exactly what's coming.`,
    '',
    `Content day: ${nice(shoot)}${!tight && shoot < latest ? ` (or any day up to ${nice(latest)})` : ''}, around your busiest ${w.noun}. I'll arrive ${before} minutes before it starts. I need about ${span('coach').to - span('coach').from} minutes with ${coachNames.length ? listOf(coachNames.map(firstWord)) : an(w.coach)} before ${w.the}${owner ? ' (and with you, if you would like to be in one)' : ''}, and 2 minutes each with 2 or 3 members after. Nobody else has to do anything.`,
    '',
    'Before then, could you send me:',
    `1. The link people use to book ${offerLabel ? `your ${offerLabel}` : `a first ${w.noun}`}.`,
    `2. Which ${w.noun} and which ${w.coach} I should film.`,
    `3. ${colors ? 'Your logo file.' : 'Your logo file and brand colors.'}`,
    '',
    'I\'ll bring a "Filming today" sign and release forms. Anyone who would rather not be filmed stays out of shot, no questions asked.',
    '',
    `You'll get the first 3 Reels by ${nice(firstThree)}, with captions and post dates. Reply "approved" or send changes within 48 hours.${rest ? ` The other ${nReels - 3} follow by ${nice(rest)}.` : ''} Posts start ${nice(start)}, 3 a week.${guarantee ? ` And as promised: ${guarantee.charAt(0).toLowerCase()}${guarantee.slice(1)}.` : ''}`,
    '',
    `This month: ${listOf(deliverables)}. At the end of the month I'll send you a short report: trial sign-ups and new members who came from the videos, then views and link clicks.`,
    '',
    me || '[Your name]',
    biz || '',
  ]
    .join('\n')
    .trim();

  const summary = [
    `${name}: ${nReels} Reels from one ${minutes}-minute content day, posted 3 a week on ${where}, ${nice(start)} to ${nice(lastPost)}.`,
    `Content day ${nice(shoot)}${!tight && shoot < latest ? ` (any day up to ${nice(latest)} works)` : ''}. First 3 Reels to ${ownerRef} by ${nice(firstThree)}, approved by ${nice(approveBy)}.${rest ? ` The other ${nReels - 3} by ${nice(rest)}.` : ''}`,
    `Month-end report ${nice(report)}. Next content day ${nice(nextShoot)}.`,
    ...warnings,
  ].join('\n');

  return deepPlain({
    gym: name,
    key: row.key || gym.key || null,
    reels: nReels,
    owner: ownerFirst,
    summary,
    dates: { today, shoot, shootBy: latest, firstThree, approveBy, firstPost: start, rest, lastPost, report, nextShoot },
    kickoff,
    fixes,
    shoot: { minutes, date: shoot, latest, book, plan },
    shotList,
    gear,
    consent,
    calendar,
    tracking: {
      why: 'The owner cares about trial sign-ups and new members, not views. Set this up before the first post, so the month-end report can show what the videos brought in: a tracked link in the bio, a QR code for print, and one question at sign-up.',
      link,
      qrLink,
      campaign,
      steps,
      baseline,
      monthEnd,
    },
    handoff,
    deliverables,
    extras: extras.map(({ id, ...e }) => ({ ...e, note: e.pitched ? `You pitched this one. ${e.note}` : e.note })),
    warnings,
  });
}

// The release form, with the gym's name, the editor's business and the gym's contact filled in when
// we know them. Null if the template file is missing (the plan still works without it).
function releaseForm({ row = {}, business = null } = {}) {
  let text;
  try {
    text = fs.readFileSync(TEMPLATE, 'utf8');
  } catch {
    return null;
  }
  const g = row.gym || {};
  const c = row.contact || {};
  const fill = (re, value) => {
    if (value) text = text.replace(re, () => plain(value));
  };
  fill(/\[Gym name\]/g, g.name);
  fill(/\[Editor name or business\]/g, business);
  fill(/\[Gym email or phone\]/g, c.email || g.email || c.phone || g.phone);
  return text;
}

module.exports = { contentDay, releaseForm, FORM_NAME, IDEA_PLAN, nextMonday, addDays, weekdayOf };
