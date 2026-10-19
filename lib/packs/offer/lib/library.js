// Every problem a buyer has before, during and after buying, in their words, with the fix and how it
// gets delivered. Used by the Offer builder when AI is off, and as the menu AI starts from.
// value: how much the fix matters to the buyer (1 to 5). cost: what it costs the member in time or
// money each sale (1 to 5). driver: which part of the offer score it lifts. part: the name of the
// fix as a piece of the offer. {tokens} are filled from the member's facts.

const { text } = require('../../_kit');

const U = [
  { id: 'proof', stage: 'before', driver: 'likelihood', problem: 'How do I know you\'re any good?', fix: '{proof}', vehicle: 'Real photos or a sample', part: 'See-It-First Proof', value: 5, cost: 1 },
  { id: 'promise', stage: 'before', driver: 'likelihood', problem: 'What if I pay and I\'m not happy?', fix: '{promise}', vehicle: 'A written promise', part: '{promiseName}', value: 5, cost: 2 },
  { id: 'price', stage: 'before', driver: 'ease', problem: 'I don\'t know what it costs, and I hate asking.', fix: 'Clear prices up front, so there are no surprises.', vehicle: 'A one-page price menu', part: 'Upfront Price Menu', value: 3, cost: 1 },
  { id: 'booking', archs: ['home_service', 'personal_service', 'teach', 'b2b_service', 'food'], stage: 'before', driver: 'ease', problem: 'Booking is a hassle of calls and back-and-forth.', fix: 'Book by text in one minute. I reply the same day.', vehicle: 'Text booking', part: 'One-Minute Booking', value: 3, cost: 1 },
  { id: 'updates', archs: ['home_service', 'personal_service', 'b2b_service'], stage: 'during', driver: 'likelihood', problem: 'I won\'t know what\'s going on.', fix: 'A quick text at each step, so you always know where things are.', vehicle: 'Text updates', part: 'Step-by-Step Texts', value: 3, cost: 1 },
  { id: 'keep', archs: ['home_service', 'personal_service'], stage: 'after', driver: 'dream', problem: 'It looks great for a week, then I\'m back where I started.', fix: 'A one-page guide to keep it that way, made for you.', vehicle: 'A printable guide', part: 'Keep-It-Up Guide', value: 3, cost: 1 },
  { id: 'remind', archs: ['home_service', 'personal_service'], stage: 'after', driver: 'ease', problem: 'I\'ll forget to book again until it\'s a mess.', fix: 'A reminder text when it\'s time, so you never have to think about it.', vehicle: 'Reminder texts', part: 'Never-Forget Reminders', value: 3, cost: 1 },
  { id: 'extra_rush', stage: 'before', driver: 'speed', problem: 'Can you fit me in this week?', fix: 'Same-week rush slots for a small extra fee.', vehicle: 'Priority booking', part: 'Rush Slot', value: 2, cost: 4 },
  { id: 'extra_call', stage: 'during', driver: 'likelihood', problem: 'I want to talk it through first.', fix: 'An hour-long planning call before we start.', vehicle: 'A long call', part: 'Planning Hour', value: 2, cost: 4 },
];

const ARCH = {
  home_service: [
    { id: 'home_trust', stage: 'before', driver: 'likelihood', problem: 'I\'m nervous about someone new at my place.', fix: 'I text a photo before I start and after I finish, and I put everything back where it was.', vehicle: 'Photo check-in and check-out', part: 'Photo Check-In', value: 4, cost: 1 },
    { id: 'home_supplies', stage: 'during', driver: 'ease', problem: 'I\'d have to buy supplies or gear.', fix: 'I bring everything. You don\'t buy a thing.', vehicle: 'Fully equipped visit', part: 'Bring-Everything Visit', value: 3, cost: 1 },
    { id: 'home_away', stage: 'during', driver: 'ease', problem: 'I can\'t take time off to be home.', fix: 'You don\'t need to be home. I text you when it\'s done.', vehicle: 'No-one-home service', part: 'No-Need-to-Be-Home Service', value: 4, cost: 1 },
  ],
  personal_service: [
    { id: 'pers_suit', stage: 'before', driver: 'likelihood', problem: 'I don\'t know what will suit me.', fix: 'A 5-minute planning chat first, with photos of options.', vehicle: 'Planning chat', part: 'Plan-It-First Chat', value: 4, cost: 1 },
    { id: 'pers_wait', stage: 'during', driver: 'ease', problem: 'I hate waiting rooms and people running late.', fix: 'Your time slot is yours. I run on time.', vehicle: 'On-time slots', part: 'Your-Time-Is-Yours Booking', value: 3, cost: 1 },
    { id: 'pers_care', stage: 'after', driver: 'dream', problem: 'It looks great today, then I can\'t keep it up.', fix: 'A care sheet with exactly what to do at home.', vehicle: 'Printable care sheet', part: 'At-Home Care Sheet', value: 4, cost: 1 },
  ],
  teach: [
    { id: 'teach_tried', stage: 'before', driver: 'likelihood', problem: 'I\'ve tried before and it didn\'t stick.', fix: 'A written plan in the first session, built around your goal.', vehicle: 'Written plan', part: 'First-Session Plan', value: 5, cost: 2 },
    { id: 'teach_falloff', stage: 'during', driver: 'likelihood', problem: 'I fall off after a few weeks.', fix: 'A short progress note after every session and a check-in text midweek.', vehicle: 'Progress notes', part: 'Weekly Progress Notes', value: 4, cost: 1 },
    { id: 'teach_practice', stage: 'during', driver: 'ease', problem: 'I don\'t know what to do between sessions.', fix: 'A 15-minute practice plan for the week.', vehicle: 'Practice plan', part: '15-Minute Practice Plan', value: 4, cost: 1 },
    { id: 'teach_time', stage: 'before', driver: 'ease', problem: 'My week is already full.', fix: 'Online or in person, at times that fit your week.', vehicle: 'Flexible times', part: 'Fits-Your-Week Schedule', value: 3, cost: 1 },
    { id: 'teach_after', stage: 'after', driver: 'dream', problem: 'What happens when we stop?', fix: 'A keep-going plan for when we finish, so progress doesn\'t stop.', vehicle: 'Next-steps plan', part: 'Keep-Going Plan', value: 3, cost: 1 },
  ],
  b2b_service: [
    { id: 'b2b_burned', stage: 'before', driver: 'likelihood', problem: 'I\'ve been burned by freelancers before.', fix: 'A free sample made for your business before you pay anything.', vehicle: 'Free sample', part: 'Free Sample First', value: 5, cost: 2 },
    { id: 'b2b_explain', stage: 'before', driver: 'ease', problem: 'I don\'t have time to explain everything.', fix: 'One 20-minute kickoff call. I take it from there.', vehicle: 'Kickoff call', part: '20-Minute Kickoff', value: 4, cost: 1 },
    { id: 'b2b_paying', stage: 'during', driver: 'likelihood', problem: 'I never know what I\'m paying for.', fix: 'A one-page summary every month of exactly what got done.', vehicle: 'Monthly report', part: 'One-Page Monthly Report', value: 4, cost: 1 },
    { id: 'b2b_approvals', stage: 'during', driver: 'ease', problem: 'Endless approvals and back-and-forth.', fix: 'Approve everything in one batch, once a month.', vehicle: 'Batch approval', part: 'One-Batch Approval', value: 3, cost: 1 },
    { id: 'b2b_contract', stage: 'before', driver: 'likelihood', problem: 'I don\'t want to be locked into a long contract.', fix: 'Month to month. Stop any time with a text.', vehicle: 'No contract', part: 'No-Contract Start', value: 4, cost: 1 },
  ],
  product: [
    { id: 'prod_real', stage: 'before', driver: 'likelihood', problem: 'Photos online never look like the real thing.', fix: 'Real photos and a short video of the actual product, never mockups.', vehicle: 'Real photos and video', part: 'Real-Photo Listings', value: 4, cost: 1 },
    { id: 'prod_ship', stage: 'before', driver: 'speed', problem: 'Shipping takes forever.', fix: 'Ships within 2 business days, with tracking.', vehicle: 'Fast shipping', part: '2-Day Ship', value: 4, cost: 2 },
    { id: 'prod_gift', stage: 'during', driver: 'dream', problem: 'I want it to feel special, maybe as a gift.', fix: 'Arrives gift-ready, with a handwritten note if you want one.', vehicle: 'Gift wrap and note', part: 'Gift-Ready Packing', value: 4, cost: 1 },
    { id: 'prod_refill', stage: 'after', driver: 'ease', problem: 'I\'ll run out and forget to reorder.', fix: 'A refill reminder, or subscribe and save and skip any time.', vehicle: 'Refill plan', part: 'Refill Reminder', value: 3, cost: 1 },
  ],
  digital: [
    { id: 'dig_inside', stage: 'before', driver: 'likelihood', problem: 'I don\'t know what\'s really inside.', fix: 'Screenshots of every page and a 2-minute walkthrough video.', vehicle: 'Preview video', part: 'See-Inside Preview', value: 4, cost: 1 },
    { id: 'dig_setup', stage: 'during', driver: 'ease', problem: 'Setting it up will confuse me.', fix: 'A 5-minute setup video, step by step.', vehicle: 'Setup video', part: '5-Minute Setup Video', value: 4, cost: 1 },
    { id: 'dig_stuck', stage: 'after', driver: 'likelihood', problem: 'What if I get stuck?', fix: 'Email me a question and I answer within a day.', vehicle: 'Question inbox', part: 'Ask-Me Inbox', value: 4, cost: 2 },
    { id: 'dig_updates', stage: 'after', driver: 'dream', problem: 'It will be out of date by next year.', fix: 'Free updates for a year.', vehicle: 'Updates', part: 'Free Updates for a Year', value: 3, cost: 1 },
  ],
  food: [
    { id: 'food_taste', stage: 'before', driver: 'likelihood', problem: 'Will it actually taste good?', fix: 'A free taster at your first pickup.', vehicle: 'Free taster', part: 'Taste-First Sample', value: 4, cost: 1 },
    { id: 'food_party', stage: 'during', driver: 'dream', problem: 'It has to look good on the table.', fix: 'Packed party-ready, with every item labeled for allergies.', vehicle: 'Party-ready packing', part: 'Party-Ready Packing', value: 4, cost: 1 },
    { id: 'food_weekend', stage: 'before', driver: 'speed', problem: 'I need it this weekend.', fix: 'Weekend slots held for orders placed by Wednesday.', vehicle: 'Weekend slots', part: 'Weekend Slot Hold', value: 3, cost: 1 },
    { id: 'food_again', stage: 'after', driver: 'ease', problem: 'I\'ll want it again and forget what I ordered.', fix: 'Your usual order saved, so next time you reorder with one text.', vehicle: 'Saved order', part: 'Usual-Order-on-File', value: 3, cost: 1 },
  ],
};

const NICHE = {
  detailing: [
    { id: 'det_pets', stage: 'during', driver: 'dream', problem: 'Dog hair and kid messes everywhere.', fix: 'Pet hair and car-seat crumbs out, every time, at no extra charge.', vehicle: 'Included in every detail', part: 'Pet-Hair-Gone Clean', value: 4, cost: 2 },
    { id: 'det_smell', stage: 'during', driver: 'dream', problem: 'The car smells and I can\'t fix it.', fix: 'Seats and mats shampooed and the smell treated, not covered up.', vehicle: 'Odor treatment', part: 'Fresh-Air Treatment', value: 4, cost: 2 },
    { id: 'det_shame', stage: 'before', driver: 'ease', problem: 'My car is too gross to let anyone see.', fix: 'No judgment, ever. I\'ve seen worse, and I\'ll say so.', vehicle: 'A no-judgment rule', part: 'No-Judgment Rule', value: 3, cost: 1 },
  ],
  cleaning: [
    { id: 'cl_supplies', stage: 'during', driver: 'ease', problem: 'I don\'t want to buy cleaning supplies.', fix: 'I bring every supply, pet-safe and kid-safe on request.', vehicle: 'Supplies included', part: 'Bring-Everything Clean', value: 3, cost: 1 },
    { id: 'cl_list', stage: 'during', driver: 'likelihood', problem: 'Cleaners always skip the same spots.', fix: 'A room-by-room checklist, ticked off and texted to you after every clean.', vehicle: 'Checklist report', part: 'Room-by-Room Checklist', value: 4, cost: 1 },
    { id: 'cl_shame', stage: 'before', driver: 'ease', problem: 'I\'m embarrassed by the mess.', fix: 'No judgment. Most first cleans look like yours.', vehicle: 'A no-judgment rule', part: 'No-Judgment First Clean', value: 3, cost: 1 },
  ],
  lawn: [
    { id: 'lawn_away', stage: 'during', driver: 'ease', problem: 'I travel and the yard gets out of hand.', fix: 'Same day every week, and a photo after each visit so you know it\'s done.', vehicle: 'Photo after every visit', part: 'Photo-Done Texts', value: 4, cost: 1 },
    { id: 'lawn_season', stage: 'after', driver: 'ease', problem: 'I have to remember the fall cleanup and spring start.', fix: 'Fall cleanup and spring start booked for you at this year\'s price.', vehicle: 'Season plan', part: 'Season Pass', value: 4, cost: 2 },
  ],
  washing: [
    { id: 'wash_damage', stage: 'before', driver: 'likelihood', problem: 'Pressure washing could damage my siding or plants.', fix: 'Soft wash on siding, plants rinsed before and after, and I walk the job with you first.', vehicle: 'Walk-through and soft wash', part: 'Walk-It-First Visit', value: 4, cost: 1 },
  ],
  petcare: [
    { id: 'pet_worry', stage: 'during', driver: 'likelihood', problem: 'I worry about my dog all day.', fix: 'A photo and a short note after every visit.', vehicle: 'Photo updates', part: 'Happy-Dog Photo Updates', value: 5, cost: 1 },
    { id: 'pet_meet', stage: 'before', driver: 'likelihood', problem: 'Will my dog even like you?', fix: 'A free meet-and-greet before the first visit.', vehicle: 'Free meet-and-greet', part: 'Free Meet-and-Greet', value: 4, cost: 1 },
  ],
  tutoring: [
    { id: 'tut_parent', stage: 'during', driver: 'likelihood', problem: 'I never know if it\'s working.', fix: 'A short progress text to you after every session.', vehicle: 'Parent progress texts', part: 'After-Session Parent Text', value: 5, cost: 1 },
    { id: 'tut_test', stage: 'before', driver: 'speed', problem: 'There\'s a test coming up.', fix: 'A test-prep plan built in the first session, around the real test date.', vehicle: 'Test-prep plan', part: 'Test-Date Plan', value: 4, cost: 1 },
    { id: 'tut_resist', stage: 'during', driver: 'ease', problem: 'My kid fights me on homework.', fix: 'Short, focused sessions your kid doesn\'t dread, and you stop being the homework police.', vehicle: 'Short focused sessions', part: 'No-More-Homework-Fights Sessions', value: 4, cost: 1 },
  ],
  fitness: [
    { id: 'fit_lost', stage: 'before', driver: 'ease', problem: 'I walk into a gym and don\'t know what to do.', fix: 'A plan for every session, written for you, so you never guess.', vehicle: 'Written plan', part: 'Never-Guess Plan', value: 4, cost: 1 },
    { id: 'fit_judged', stage: 'before', driver: 'likelihood', problem: 'I feel judged when I\'m out of shape.', fix: 'Private sessions at your pace. We start where you are.', vehicle: 'Private sessions', part: 'Start-Where-You-Are Sessions', value: 4, cost: 1 },
  ],
  web: [
    { id: 'web_words', stage: 'during', driver: 'ease', problem: 'I don\'t know what to write on my site.', fix: 'I write every word from one 20-minute call.', vehicle: 'Copy included', part: 'Every-Word-Written Build', value: 5, cost: 2 },
    { id: 'web_tech', stage: 'after', driver: 'ease', problem: 'I can\'t handle hosting and updates.', fix: 'Hosting, updates and small changes handled every month.', vehicle: 'Care plan', part: 'Hands-Off Care Plan', value: 4, cost: 2 },
  ],
  social: [
    { id: 'soc_what', stage: 'before', driver: 'ease', problem: 'I never know what to post.', fix: 'A month of posts planned, written and approved in one sitting.', vehicle: 'Monthly plan', part: 'One-Sitting Month', value: 5, cost: 2 },
    { id: 'soc_photos', stage: 'during', driver: 'ease', problem: 'I don\'t have good photos.', fix: 'A short photo visit each month, so the feed shows your real place.', vehicle: 'Monthly photo visit', part: 'Monthly Photo Visit', value: 4, cost: 3 },
  ],
  video: [
    { id: 'vid_shy', stage: 'during', driver: 'ease', problem: 'I hate being on camera.', fix: 'I direct every shot and write the lines, so you just read them once.', vehicle: 'Directed shoot', part: 'Camera-Shy Shoot', value: 4, cost: 1 },
  ],
  photography: [
    { id: 'pho_awkward', stage: 'during', driver: 'ease', problem: 'I look awkward in photos.', fix: 'I guide every pose, so you never wonder what to do with your hands.', vehicle: 'Posing guidance', part: 'No-Awkward Posing', value: 4, cost: 1 },
    { id: 'pho_wait', stage: 'after', driver: 'speed', problem: 'Photographers take weeks to send photos.', fix: 'A sneak peek within 48 hours.', vehicle: 'Sneak peek', part: '48-Hour Sneak Peek', value: 4, cost: 1 },
  ],
  candles: [
    { id: 'can_scent', stage: 'before', driver: 'likelihood', problem: 'I can\'t smell it online.', fix: 'Scent notes in plain words and a sample-size set to try first.', vehicle: 'Sampler set', part: 'Sniff-First Sampler', value: 4, cost: 2 },
  ],
  bakery: [
    { id: 'bak_allergy', stage: 'before', driver: 'likelihood', problem: 'Someone at the party has allergies.', fix: 'Every item labeled with what\'s in it.', vehicle: 'Labels', part: 'Every-Item Labels', value: 4, cost: 1 },
  ],
  beauty: [
    { id: 'beau_photo', stage: 'before', driver: 'likelihood', problem: 'Last time it didn\'t look like the photo.', fix: 'Bring a photo. We agree on the look before I start.', vehicle: 'Look check', part: 'Agree-on-the-Look Check', value: 4, cost: 1 },
  ],
};

// The same worries as a buyer would ask them, for FAQs.
const Q = {
  soon: 'How soon can you start?', effort: 'What do I have to do?', updates: 'Will I know what\'s going on?', keep: 'How do I keep it looking like this?', remind: 'Will you remind me when it\'s time again?',
  home_trust: 'Is it safe to have you at my place?', home_supplies: 'Do I need to buy anything?', home_away: 'Do I need to be home?',
  pers_suit: 'What if I don\'t know what I want?', pers_wait: 'Will I be stuck waiting?', pers_care: 'How do I keep it looking good at home?',
  teach_tried: 'What if I\'ve tried before and it didn\'t stick?', teach_falloff: 'What if I fall off after a few weeks?', teach_practice: 'What do I do between sessions?', teach_time: 'What if my week is already full?', teach_after: 'What happens when we finish?',
  b2b_burned: 'Why should I trust you?', b2b_explain: 'How much of my time does this take?', b2b_paying: 'How will I know what got done?', b2b_approvals: 'How do approvals work?', b2b_contract: 'Is there a contract?',
  prod_real: 'Does it look like the photos?', prod_ship: 'How fast does it ship?', prod_gift: 'Can I send it as a gift?', prod_refill: 'What happens when I run out?',
  dig_inside: 'What\'s inside?', dig_setup: 'Is it hard to set up?', dig_updates: 'Will it get updates?',
  food_party: 'Will it look good on the table?', food_weekend: 'Can I get it this weekend?', food_again: 'Can I reorder easily?',
  det_pets: 'Can you handle pet hair and kid messes?', det_smell: 'Can you get rid of the smell?', det_shame: 'My car is a real mess. Is that okay?',
  cl_supplies: 'Do I need to buy supplies?', cl_list: 'How do I know nothing was skipped?', cl_shame: 'My place is a mess. Is that okay?',
  lawn_away: 'Do I need to be home?', lawn_season: 'What about fall cleanup and spring?', wash_damage: 'Will it damage my siding or plants?',
  pet_worry: 'How will I know my dog is okay?', tut_parent: 'How will I know it\'s working?', tut_test: 'There\'s a test coming up. Can you help?', tut_resist: 'What if my kid fights it?',
  fit_lost: 'What if I don\'t know what to do?', fit_judged: 'What if I\'m out of shape?', web_words: 'What if I don\'t know what to write?', web_tech: 'Who handles hosting and updates?',
  soc_what: 'What if I don\'t know what to post?', soc_photos: 'What if I don\'t have good photos?', vid_shy: 'What if I hate being on camera?',
  pho_awkward: 'What if I\'m awkward in photos?', pho_wait: 'How soon do I get my photos?', can_scent: 'How do I know how it smells?', bak_allergy: 'What about allergies?', beau_photo: 'What if it doesn\'t look like my photo?',
  extra_rush: 'Can you fit me in this week?', extra_call: 'Can we talk it through first?',
};

const STAGES = { before: 'Before they buy', during: 'While you do it', after: 'After it\'s done' };

// Short names for the member's promise, from its type and the window in its wording.
function promiseName(promise) {
  const t = String((promise && promise.text) || '');
  const m = t.match(/within (\d+) (hour|day)s?/i);
  const win = m ? `${m[1]}-${m[2].charAt(0).toUpperCase()}${m[2].slice(1).toLowerCase()} ` : '';
  const type = (promise && promise.type) || 'redo';
  const names = {
    redo: `${win}Redo Promise`,
    refund: `${win}Refund Promise`,
    keep_working: 'Keep-Revising Promise',
    first_free: 'First-Session-Free Promise',
    on_time: 'On-Time Promise',
    remake: 'Remake-or-Refund Promise',
    conditional: 'Show-Up Promise',
  };
  return (names[type] || `${win}Promise`).trim();
}

// Short promise for a bio or one-liner, from the member's own promise wording.
function promiseShort(promise) {
  if (promise && promise.short) return promise.short;
  const t = String((promise && promise.text) || '');
  const type = (promise && promise.type) || 'redo';
  const not = t.match(/\bisn'?t (spotless|clean|right|perfect|happy)\b/i);
  if (type === 'on_time') return /by 7am/i.test(t) ? 'Clear by 7am or that visit is free.' : /late/i.test(t) ? 'Late? That visit is free.' : /month/i.test(t) ? 'Posts on time, or that month is free.' : 'On time, or that one is free.';
  if (type === 'refund') return /replace/i.test(t) ? 'Not right? I replace it free.' : /exchange/i.test(t) ? 'Free size exchanges for 30 days.' : 'Not right? Full refund.';
  if (type === 'keep_working') return /first draft/i.test(t) ? 'Don\'t love the first draft? You don\'t pay.' : 'Changes free until you\'re happy.';
  if (type === 'first_free') return /first lesson/i.test(t) ? 'Don\'t enjoy the first lesson? It\'s free.' : 'Not happy after the first session? It\'s free.';
  if (type === 'remake') return 'Anything wrong? I remake it or refund it.';
  if (type === 'conditional') return 'Show up for 30 days. Not happy? Next month free.';
  if (/\bmiss (anything|a spot)/i.test(t)) return 'Missed a spot? I come back free.';
  if (/reshoot/i.test(t)) return 'Don\'t love them? I reshoot free.';
  if (not) return `Not ${not[1].toLowerCase()}? I redo it free.`;
  return 'Not right? I redo it free.';
}

function fillTokens(s, f) {
  const p = f.profile;
  const vars = {
    proof: text.sentenceCase(p.proof),
    promise: p.promise.text,
    promiseName: promiseName(p.promise),
    firstLine: p.firstLine,
    effort: f.mobile ? p.mobileEffort : p.effort,
    interval: (p.interval && p.interval[0]) || 'Fast',
    unit: f.unit,
    units: f.units,
  };
  return text.plain(String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))).replace(/\.\.$/, '.');
}

// Every problem for this member's niche, filled in, niche first so specific fixes lead.
function problemsFor(f) {
  const p = f.profile;
  const list = [...(NICHE[p.nicheId] || []), ...(ARCH[f.arch] || []), ...U];
  // Mobile is decided by the member's words: drop "come to you" fixes that don't apply.
  const out = [];
  const seen = new Set();
  for (const x of list) {
    if (seen.has(x.id)) continue;
    if (x.id === 'home_away' && !f.mobile) continue;
    if (x.archs && !x.archs.includes(f.arch)) continue;
    seen.add(x.id);
    out.push({ ...x, fix: fillTokens(x.fix, f), part: fillTokens(x.part, f), problem: text.plain(x.problem), q: Q[x.id] || (/\?$/.test(x.problem) ? text.plain(x.problem) : ''), stageLabel: STAGES[x.stage] });
  }
  return out;
}

module.exports = { U, ARCH, NICHE, STAGES, Q, problemsFor, promiseName, promiseShort, fillTokens };
