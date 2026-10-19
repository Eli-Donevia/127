// Words for people the member already knows: a catch-up text that asks for nothing, a referral ask,
// gentle nudges, and answers to what they write back. The member is the sender; texts stay short
// (2 SMS segments or fewer), use straight apostrophes and only what the member told us. Texts to
// people the member knows carry no address or opt-out line (D28), and never go to strangers.

const { text } = require('../../_kit');
const M = require('./messages');

const fin = (s) => M.straight(text.plain(String(s || '').replace(/\s+/g, ' ').trim()));
const firstOf = (p) => M.firstName(p);
const noteOf = (p) => String(p.note || (p.notes || []).join('. ') || '').toLowerCase();

// ---------- reconnect: no pitch in the first text ----------

// A hook from the member's note about them ("moved to Denver", "new baby", "college roommate").
function hookOf(p, seed) {
  const n = noteOf(p);
  const moved = /\b(?:moved|moving|relocated) to ([a-z][a-z .'-]{2,24}?)(?=[,.;]|$| for| with| last| in \d| a few| \d)/.exec(n);
  if (moved) return `How's ${text.titleCase(moved[1].trim())} treating you?`;
  if (/\b(new baby|had a baby|newborn|baby (boy|girl))\b/.test(n)) return "How's life with the little one?";
  if (/\b(got married|wedding|newlywed)\b/.test(n)) return 'Hope married life is treating you well!';
  if (/\b(new job|started at|new role|promoted|promotion)\b/.test(n)) return "How's the new job going?";
  if (/\b(new (house|home|place)|bought a (house|home)|just moved)\b/.test(n)) return 'How is the new place?';
  if (/\b(puppy|dog)\b/.test(n)) return "How's the pup?";
  if (/\b(retired|retirement)\b/.test(n)) return "How's retired life?";
  if (/\b(college|university|roommate|dorm)\b/.test(n)) return text.pickBy(`${seed}col`, ['I was just thinking about our college days.', 'Something reminded me of college today and I thought of you.']);
  if (/\b(high school|school friend|classmate)\b/.test(n)) return 'I was just thinking about our school days.';
  if (/\b(coworker|co-worker|worked together|old job|old boss|old team)\b/.test(n)) return 'I was just thinking about our old team.';
  if (/\b(team|league|club|gym|church|band|choir)\b/.test(n)) return 'I was just thinking about you and the old crew.';
  return '';
}

function reconnectText(p, o, seed = '') {
  const first = firstOf(p);
  const hi = text.pickBy(`${seed}hi`, ['Hey', 'Hi']);
  const gap = text.pickBy(`${seed}gap`, ["It's been way too long!", 'Been way too long!', "It's been ages!"]);
  const hook = hookOf(p, seed);
  // One question is plenty: the hook's own, or a plain one.
  const ask = /\?$/.test(hook) ? '' : text.pickBy(`${seed}ask`, ['How have you been?', "How's everything going?", 'What have you been up to?']);
  const meet = o.city && /\b(local|neighbou?r|church|gym|team|league|club|nearby|in town)\b/.test(noteOf(p)) ? ' Would love to grab a coffee sometime.' : ' Would love to catch up.';
  return fin(`${hi} ${first}! ${gap} ${hook} ${ask}${meet}`);
}

// What to say once they write back: answer them, then mention the new business once, lightly.
function bringUp(p, o, seed = '') {
  const where = o.city ? ` here in ${o.city}` : '';
  // Offer it to them only when the note says they might want it; otherwise ask who they know.
  const words = (o.words || []).filter((w) => w.length > 3);
  const n = noteOf(p);
  const offer = /\b(asked|asking|needs?|wants?|interested|looking for)\b/.test(n) || words.some((w) => n.includes(w))
    ? text.pickBy(`${seed}offer`, ["If you ever need it, I'd love to help.", "If you ever want one, I'd love to do it for you."])
    : text.pickBy(`${seed}offer`, ["If you know anyone who could use it, I'd love an intro.", 'If anyone you know ever needs it, send them my way!']);
  const open = text.pickBy(`${seed}open`, ['So good to hear from you!', 'Love hearing from you!', 'So good to catch up!']);
  return fin(`${open} Things are good here. I actually just started ${o.what}${where}, which has been fun. ${offer}`);
}

function reconnectNudge(p, o, seed = '', n = 1) {
  const first = firstOf(p);
  if (n === 2) return fin(text.pickBy(`${seed}n2`, [`No worries if life's busy, ${first}! Just wanted to say hi. Talk soon.`, `Hope all is well, ${first}! No need to reply, just thinking of you.`]));
  return fin(text.pickBy(`${seed}n1`, [`Hey ${first}, just bumping this in case it got buried. Hope you're doing well!`, `Hi ${first}! No rush at all, just wanted to say hi again.`]));
}

// ---------- referrals: for an intro, never for a review ----------

const CUSTOMER = /\b(customer|client|booked|bought|hired|paid|regular|did (her|his|their)|i (cleaned|washed|detailed|mowed|walked|tutored|photographed|did))\b/;
const isCustomer = (p) => CUSTOMER.test(noteOf(p));

// "loved the deep clean in May" -> "the deep clean in May"
const BASE = { detailed: 'detail', cleaned: 'clean', washed: 'wash', mowed: 'mow', walked: 'walk', tutored: 'tutor', photographed: 'photograph', painted: 'paint', fixed: 'fix', did: 'do', groomed: 'groom', sat: 'sit for' };
function jobOf(p) {
  const n = String(p.note || (p.notes || []).join('. ') || '');
  const m = /\b(?:loved|liked|happy with|thrilled with|raved about)\s+(?:the |my |her |his |their )?([^,.;]{3,40})/i.exec(n);
  if (m) return `do the ${m[1].trim().replace(/^the /i, '')}`;
  // "I detailed her SUV last week" -> "detail your SUV"
  const v = /\bi (detailed|cleaned|washed|mowed|walked|tutored|photographed|painted|fixed|did|groomed|sat) (?:her|his|their|the) ([a-z][a-z' -]{1,24}?)(?=[,.;]| last| this| in | on |$)/i.exec(n);
  if (v) return `${BASE[v[1].toLowerCase()]} your ${v[2].trim()}`;
  return '';
}

const CONNECTOR = /\b(barber|hairdresser|stylist|realtor|real estate|bartender|pastor|coach|teacher|pta|hoa|front desk|receptionist|knows (everyone|everybody|half the town|a lot of people)|runs the)\b/;

function referralText(p, o, seed = '') {
  const first = firstOf(p);
  const hi = text.pickBy(`${seed}hi`, ['Hey', 'Hi']);
  const thanks = o.thanks ? ` If they book, ${o.thanks} is yours as a thank-you.` : '';
  const whoFor = o.who ? ` I'm especially looking for ${o.who.replace(/^(i'?m )?(especially )?(looking for )?/i, '')}.` : '';
  const close = thanks ? '' : text.pickBy(`${seed}close`, [' No pressure at all.', ' Even one name helps.']);
  if (isCustomer(p)) {
    const job = jobOf(p);
    const open = job ? `Thanks again for having me ${job}!` : 'Thanks again for having me!';
    return fin(`${hi} ${first}! ${open} I'm growing by word of mouth: do you know one person who could use ${o.what}?${whoFor}${thanks}${close}`);
  }
  const why = CONNECTOR.test(noteOf(p)) ? 'You know so many people, so I thought of you.' : text.pickBy(`${seed}open`, ['Quick favor to ask.', 'Can I ask a quick favor?']);
  return fin(`${hi} ${first}! ${why} I started ${o.what}${o.city ? ` in ${o.city}` : ''} and I'm growing by word of mouth. Do you know anyone who could use it?${whoFor}${thanks}${close}`);
}

// A short note the person can forward to a friend, so referring takes them 10 seconds.
function forwardText(o) {
  const me = o.firstName || '[your name]';
  const where = o.city ? ` in ${o.city}` : '';
  const price = o.priceText ? ` Prices start at ${o.priceText}.` : '';
  const reach = o.phone ? `Text ${me} at ${o.phone}.` : `Text ${me} at [your number].`;
  return fin(`My friend ${me} does ${o.what}${where} and does great work.${price} ${reach}`);
}

function thankYouText(o) {
  const gift = o.thanks ? ` ${o.thanks.charAt(0).toUpperCase()}${o.thanks.slice(1)} is yours, just tell me when you'd like to use it.` : '';
  return fin(`Thank you so much for the intro! That means a lot.${gift}`);
}

function referralNudge(p, o, seed = '', n = 1) {
  const first = firstOf(p);
  if (n === 2) return fin(`Thanks again, ${first}! If anyone comes to mind later, I'm here.`);
  return fin(text.pickBy(`${seed}rn`, [`Hey ${first}, no pressure on the intro! If anyone comes to mind, I'd be grateful.`, `Hi ${first}! Just floating this back up. Even one name would help a lot.`]));
}

// ---------- nudges for anyone the member already messaged ----------

function nudgeText(lead, n = 1, seed = '') {
  const first = firstOf({ name: lead.name || '' });
  if (n >= 2) return fin(text.pickBy(`${seed}w2`, [`Last nudge from me, ${first}, promise! If now isn't the time, no worries at all.`, `No worries if now's not the time, ${first}! I'm here whenever you need me.`, `Hi ${first}, one last check-in from me. Totally fine either way!`]));
  return fin(text.pickBy(`${seed}w1`, [`Hey ${first}! Just bumping this up in case it got buried. No pressure at all.`, `Hi ${first}, just floating this back up. No rush at all!`, `Hey ${first}, did this get lost in your texts? No worries either way.`, `Hi ${first}! Following up on my last text. Totally fine if now isn't a good time.`]));
}

// ---------- answers to what they wrote back ----------

const INTENTS = [
  ['stop', /\b(stop|unsubscribe|remove me|take me off|do not (contact|email|message|text)|don'?t (contact|email|message|text)( me)?( again)?|leave me alone|lose my number)\b/i],
  ['no', /\b(no thanks|no thank you|not interested|i'?m (good|ok|okay|all set)|we'?re (good|ok|okay|all set)|not for me|i'?ll pass|gonna pass)\b/i],
  ['referral', /\b(i know (someone|somebody|a guy|a girl|a few)|(my|our) (sister|brother|mom|dad|mother|father|neighbou?r|friend|coworker|cousin|aunt|uncle|boss|daughter|son)\b[^.?!]{0,40}\b(might|could|would|needs?|wants?|was asking)|let me ask around|i'?ll ask around|i'?ll (pass|send) (it|your number|you) (along|on)|i'?ll tell)\b/i],
  ['price', /\b(how much|price|pricing|cost|rates?|charge|quote|\$\d)/i],
  ['covered', /\b(already (have|use|got|do)|i have (someone|a guy|a person)|we have (someone|a guy|a person)|do it myself|my (husband|wife|partner|kid) does)\b/i],
  ['later', /\b(not (right )?now|later|next (week|month|year|spring|summer|fall|winter)|busy (right now|this week|this month)|after the holidays|maybe in|check back|reach out (again )?in|in a few (weeks|months))\b/i],
  ['who', /\b(who (is|'s) (this|that)|who are you|new number|is this \w+\?|sorry,? who)\b/i],
  ['yes', /\b(yes|yeah|yep|sure|sounds good|let'?s do it|go ahead|i'?m in|count me in|i'?d love|please do|book me|sign me up|when can you|when are you free|what days?)\b/i],
];

const MEANS = {
  stop: 'They asked you to stop.',
  no: 'A polite no.',
  referral: 'They might send someone your way.',
  price: 'They want to know the price.',
  covered: 'They have it covered already.',
  later: 'Not now, maybe later.',
  who: "They don't know who's texting.",
  yes: 'They want it.',
  question: 'They asked a question.',
  catchup: 'They caught up with you.',
  other: 'Not sure what they meant.',
};

const NEXT = {
  stop: "Don't answer. Marked lost so they stay off your lists. Never text them again.",
  no: 'Thank them and leave it there. Marked lost for now; still a friend.',
  referral: 'Get the name and number, then text that person and say who sent you.',
  price: 'Say the price once, then ask for a day.',
  covered: 'Ask for an intro instead, then let it go.',
  later: 'Check back in a month. Nothing until then.',
  who: 'Say who you are, then ask how they are.',
  yes: 'Book a day and time while they are keen.',
  question: 'Answer in a line or two, then ask for a day.',
  catchup: 'Answer what they said first. Mention the business once, lightly.',
  other: 'Answer what they said in one line. End with one easy question.',
};

const CATCHUP = /\b(how (are|have) you( been)?|what('?s| is| have you been) (new|up to)|what about you|and you\?|so good to hear from you|great to hear from you|long time)\b/i;

function intentOf(reply, lead) {
  const t = String(reply || '').trim();
  if (!t) return 'other';
  for (const [id, re] of INTENTS) if (re.test(t)) return id;
  // "So good to hear from you! What have you been up to?": a catch-up, the natural moment to
  // mention the new business once.
  if (CATCHUP.test(t)) return 'catchup';
  // A reconnect text that gets a friendly reply: answer it and mention the business once.
  if (lead && lead.data && lead.data.kind === 'reconnect') return /\?\s*$/.test(t) && !/how (are|have) you|what about you|and you|you\?/i.test(t) ? 'question' : 'catchup';
  return /\?\s*$/.test(t) ? 'question' : 'other';
}

// The built-in answer: always complete, never invents a price or a time.
function answerText(intent, { person, o, lead, seed = '' }) {
  const first = firstOf(person || {});
  const me = o.firstName || '';
  const where = o.city ? ` in ${o.city}` : '';
  switch (intent) {
    case 'stop':
      return '';
    case 'no':
      return fin(`No worries at all, ${first}! Thanks for getting back to me. Hope all is well.`);
    case 'referral':
      return fin("That would mean a lot, thank you! Feel free to pass on my number, or send me theirs and I'll reach out and say you sent me.");
    case 'price':
      return o.priceText ? fin(`It's ${o.priceText} for ${o.what}. Want me to save you a spot this week?`) : fin(`For ${o.what} it's [your price]. Want me to save you a spot this week?`);
    case 'covered':
      return fin(`Totally get it, glad you're set! If anyone you know ever needs ${o.what}, I'd love an intro.`);
    case 'later':
      return fin('No rush at all! Mind if I check back in a month or so?');
    case 'who':
      // After a catch-up text, just say who it is; otherwise say why you wrote, once.
      return lead && lead.data && lead.data.kind === 'reconnect'
        ? fin(`Sorry, I should have said! It's ${me || '[your name]'}. How have you been?`)
        : fin(`Sorry, I should have said! It's ${me || '[your name]'}. I just started ${o.what}${where} and thought of you. How have you been?`);
    case 'yes':
      return fin(text.pickBy(`${seed}yes`, ['Amazing, thank you! What day works best for you this week? I will make it work.', "Yay, thank you! Which day this week is easiest for you? I'll fit around you."]));
    case 'catchup':
      return (lead && lead.msg && lead.msg.answer) || bringUp(person || {}, o, seed);
    case 'question':
      return fin('Good question! [Answer it in a line or two.] Happy to tell you more if it helps.');
    default:
      return fin('Thanks for getting back to me! [Answer what they said in one line.] Want to find a time this week?');
  }
}

module.exports = { hookOf, reconnectText, bringUp, reconnectNudge, isCustomer, jobOf, referralText, forwardText, thankYouText, referralNudge, nudgeText, intentOf, answerText, MEANS, NEXT, fin };
