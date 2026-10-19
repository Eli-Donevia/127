// The five DM funnels: what triggers them, the path a person takes, the tags that mark each step,
// and the numbers worth writing down each week. Plain data plus small helpers, no I/O.

const { tagBase } = require('./keywords');

// Follow-ups go out this many hours after the button tap: inside Instagram's 24 hour window with
// room to spare (data/platform.json, meta.standardWindowHours).
const FOLLOW_UP_HOURS = 20;

const GOALS = {
  freebie: {
    label: 'Freebie by DM',
    trigger: 'comment',
    verb: 'Comment',
    thing: 'freebie',
    linkKind: 'freebie',
    summary: 'People comment a word, get your freebie in their DMs, and you get a list of people who raised their hand.',
  },
  booking: {
    label: 'DM to booked call',
    trigger: 'comment',
    verb: 'Comment',
    thing: 'call',
    linkKind: 'calendar',
    summary: 'People comment a word, get a friendly DM with your calendar, and book a time without a back and forth.',
  },
  product: {
    label: 'Product link by DM',
    trigger: 'comment',
    verb: 'Comment',
    thing: 'product',
    linkKind: 'product',
    summary: 'People comment a word and get the product, the price and a tracked link in their DMs.',
  },
  story: {
    label: 'Story reply funnel',
    trigger: 'story',
    verb: 'Reply',
    thing: 'story',
    linkKind: 'link',
    summary: 'People reply to your story with a word and get your link right away, because they messaged you first.',
  },
  waitlist: {
    label: 'Waitlist by DM',
    trigger: 'comment',
    verb: 'Comment',
    thing: 'launch',
    linkKind: 'waitlist',
    summary: 'People comment a word, join your waitlist from the DM, and hear from you by email on launch day.',
  },
};

function goalOf(id) {
  return GOALS[id] ? id : 'freebie';
}

// The steps a person goes through, for the diagram and the guide.
function pathFor(goal, { keyword, emailCapture }) {
  const K = keyword;
  const steps = [];
  if (goal === 'story') {
    steps.push({ id: 'trigger', who: 'them', title: `They reply ${K}`, detail: 'to your story' });
    steps.push({ id: 'linkMessage', who: 'you', title: 'DM with your link', detail: 'Sent right away: they messaged first, so the window is open' });
  } else {
    steps.push({ id: 'trigger', who: 'them', title: `They comment ${K}`, detail: 'on any post or reel you pick' });
    steps.push({ id: 'publicReply', who: 'you', title: 'Public reply', detail: 'Under their comment, so others see it works' });
    steps.push({ id: 'opening', who: 'you', title: 'Opening DM', detail: 'With one button. Instagram allows one message until they respond' });
    steps.push({ id: 'tap', who: 'them', title: 'They tap the button', detail: 'That tap opens a 24 hour window' });
    if (emailCapture) steps.push({ id: 'emailAsk', who: 'you', title: 'Ask for their email', detail: 'So you can reach them after Instagram closes the window' });
    steps.push({ id: 'linkMessage', who: 'you', title: goal === 'booking' ? 'Your calendar link' : goal === 'product' ? 'Your product link' : goal === 'waitlist' ? 'Waitlist link' : 'Your freebie link', detail: 'With a link button' });
  }
  steps.push({ id: 'followUp', who: 'you', title: 'Follow-up', detail: `${FOLLOW_UP_HOURS} hours later, only to people who didn't open the link` });
  return steps;
}

function tagsFor(goal, keyword, { emailCapture }) {
  const base = tagBase(keyword);
  const tags = [{ tag: `kw_${base}`, when: `They triggered ${keyword}` }];
  if (goal !== 'story') tags.push({ tag: `${base}_tapped`, when: 'They tapped the button in your opening DM' });
  tags.push({ tag: `${base}_clicked`, when: goal === 'booking' ? 'They opened your calendar' : goal === 'product' ? 'They opened the product page' : 'They opened your link' });
  if (emailCapture) tags.push({ tag: `${base}_email`, when: 'They gave you their email' });
  if (goal === 'waitlist') tags.push({ tag: `waitlist_${base}`, when: 'They joined the waitlist from a DM' });
  return tags;
}

// Numbers to write down every week. All of them come from the member's own ManyChat, calendar or
// store: we never fill in a number for them.
function numbersFor(goal) {
  const rows = [
    { key: 'comments', label: goal === 'story' ? 'Story replies with the keyword' : 'Comments with the keyword', where: goal === 'story' ? 'ManyChat automation stats' : 'ManyChat automation stats' },
    { key: 'dms', label: 'People who got the DM', where: 'ManyChat automation stats' },
  ];
  if (goal !== 'story') rows.push({ key: 'taps', label: 'Button taps in the opening DM', where: 'ManyChat, the tapped tag' });
  rows.push({ key: 'clicks', label: 'Link opens', where: 'ManyChat, the clicked tag' });
  if (goal === 'booking') rows.push({ key: 'booked', label: 'Calls booked', where: 'Your calendar' });
  else if (goal === 'product') rows.push({ key: 'orders', label: 'Orders from DM links', where: 'Your store, filtered by the utm_medium=dm link' });
  else if (goal === 'waitlist') rows.push({ key: 'joined', label: 'People on the waitlist', where: 'Your email tool' });
  else rows.push({ key: 'replies', label: 'People who replied to the DM', where: 'Your Instagram inbox' });
  return rows;
}

// Which ManyChat plan the funnel needs (data/platform.json, manychat.plans.featureNotes).
function planFor({ emailCapture, wantTags }) {
  if (emailCapture) return { plan: 'essential', why: 'Saving emails from DMs is an Essential plan feature. On Free, send people to a signup form link instead.' };
  if (wantTags) return { plan: 'essential', why: 'Tags come with Essential. Everything else works on Free.' };
  return { plan: 'free', why: 'Free covers this funnel: up to 25 people a month and 4 live automations. Upgrade when more people than that comment.' };
}

// Adds tracking so the member's analytics show which visits came from DMs. Leaves the link alone
// if it already has utm tags, or isn't a web address.
function trackedLink(link, keyword) {
  const s = String(link || '').trim();
  if (!s) return '';
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return s;
  }
  if (!/\./.test(u.hostname)) return s;
  if ([...u.searchParams.keys()].some((k) => /^utm_/i.test(k))) return u.toString();
  if (/(^|\.)ig\.me$|(^|\.)instagram\.com$/i.test(u.hostname)) return u.toString();
  u.searchParams.set('utm_source', 'instagram');
  u.searchParams.set('utm_medium', 'dm');
  u.searchParams.set('utm_campaign', tagBase(keyword));
  return u.toString();
}

module.exports = { GOALS, goalOf, pathFor, tagsFor, numbersFor, planFor, trackedLink, FOLLOW_UP_HOURS };
