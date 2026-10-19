// What makes the shared B2B tools (_kit/b2b.js) speak photography for local businesses: the service
// words for messages, the usual worries with an answer to send, the call, the kickoff, the monthly
// session and the month-end numbers. Every price comes from the member's offer (lib/offer.js over
// data/prices.json).

const { money } = require('../../_kit');
const niche = require('../data/niche.json');
const offer = require('./offer');

const usd = money.usd;
const pkg = (o, id) => o.menu.packages.find((p) => p.id === id) || o.menu.packages[0];
const monthly = (o) => o.care[0];
const obj = (start) => (niche.objections.find((x) => x.says.startsWith(start)) || {}).answer || '';
// The fact to say out loud, only when it is about their photos (a shoot answer naming their Instagram
// link would be off topic), in second person ("your homepage").
const PHOTO_WORDS = /\b(photos?|images?|pictures?)\b/i;
const photoFactOf = (v) => [v.fact, ...(v.facts || [])].find((x) => PHOTO_WORDS.test(x || '')) || '';
const photoFact = (v) => {
  const f = photoFactOf(v);
  return f ? String(v.you ? v.you(f) : f).replace(/\.$/, '') : '';
};
const USE = 'You get written permission to use the photos on your website, Google profile, social posts, menus and ads; I keep the copyright and may show them in my portfolio.';

module.exports = {
  pack: 'photo',
  label: 'photography',
  sampleNoun: 'shot list',
  serviceName: 'photography',
  // The outreach service (same words as the leads pack's "photography", so messages match first_25).
  service: {
    id: 'photo',
    label: 'Photography',
    sell: 'photography',
    verb: 'take photos',
    why: 'Most local sites use 3 or 4 old photos. New ones show what a visit is like today.',
    offer: "I'd like to shoot 3 free photos of your {what} so you can see the style.",
    walkin: 'Could I take 10 photos of your {what} this week and send you the best 3 for free?',
    follow1: 'Here are your 3 photos: [paste your link]. They are yours to use. If you want a full set every month, let me know.',
    subject: 'Free photos for {biz}?',
    gaps: { few_images: 26, no_instagram: 14, no_site: 14, site_down: 6, few_reviews: 8, stale_footer: 8, no_video: 4, missing_alt: 4 },
    fit: { busy: 10, rated: 4, ads: 6, independent: 4 },
  },
  offer,
  checklist: niche.job_checklist,

  priceLine(o) {
    return `A business shoot is ${usd(pkg(o, 'business_shoot').price)}: up to 2 hours at your place and 25 edited photos in your gallery within 3 days, ready for your website, Google profile, posts and menus. After that, a monthly photo session is ${usd(monthly(o).price)} a month for 10 new photos, and you can stop any time.`;
  },
  priceFollow: "Either way, the shot list is yours, and I'm happy to take the first 3 photos free so you can see the style.",
  offerFacts(o) {
    const lines = o.menu.packages.map((p) => `${p.label}: ${usd(p.price)} ${offer.per(p.unit)} (${p.includes.slice(0, 3).join('; ')})`);
    lines.push(...o.care.map((c) => `${c.label}: ${usd(c.price)} a month (${c.includes.join('; ')})`));
    lines.push('Edited photos in an online gallery within 3 days of the shoot; listing photos within 24 hours.');
    lines.push('Written permission to use the photos on their website, Google profile, posts, menus and ads; the photographer keeps the copyright.');
    lines.push(`Promise: ${niche.promise}`);
    return lines.join('\n');
  },
  yesLine: () => "Great! I'll send the shot list by [day]. Is there anything you'd love the photos to show, or anything to keep out?",

  // Send-ready answers to the usual worries (niche.json objections), each ending on one next step.
  objections: [
    {
      id: 'phone',
      match: /\b(use (a |our |my )?(phones?|iphones?|cell ?phones?)|(take|shoot) (them|it|our own|photos) (ourselves|myself)|(my|our) (phone|iphone) (takes|is) (fine|good|great))\b/i,
      says: 'We can just use a phone.',
      means: 'They think the photos they take themselves are good enough.',
      ack: () => 'Phone photos are great for everyday posts, and you should keep them coming.',
      say: (v) => `Phone photos are great for everyday posts, and you should keep them coming. A shoot is for the photos people see first: your website, Google profile and menu, in good light and edited to match.${photoFact(v) ? ` One thing I noticed: ${photoFact(v)}.` : ''} Want me to take the first 3 free so you can compare?`,
      // The research tip is about portraits; for a business, the side by side on a phone does the work.
      tip: 'Show a side by side on your phone: one of their photos next to one of yours from a similar place, in good light and edited. Phones stay fine for daily posts.',
    },
    {
      id: 'cost',
      match: /\b(too (much|expensive|pricey)|can'?t afford|no budget|out of (our|my) budget|cheaper|expensive|tight right now|that much)\b/i,
      says: 'Why does a shoot cost that much?',
      means: 'The price feels big for photos.',
      say: (v) => `Understood. The price covers the planning, the shoot, editing every photo and the gallery. Two smaller ways to start: a one-hour shoot for ${usd(pkg(v.o, 'hour_shoot').price)} with 10 edited photos, or a monthly photo session at ${usd(monthly(v.o).price)} a month. Want the details on either?`,
      next: 'Offer the smaller start once. If it is still no, ask to check back before their next busy season.',
      tip: obj('Why does'),
    },
    {
      id: 'all_photos',
      match: /\b(all (the |of the )?(photos|pictures|images|files|raw)|raw (files|photos)|how many (photos|pictures|images))\b/i,
      says: 'Do we get all the photos?',
      means: 'They want to know how many photos they get.',
      ack: () => 'Good question.',
      say: (v) => `You get 25 finished photos from a business shoot, the best of the day, each one edited. If you want more, an extra hour on site is ${usd((v.o.menu.addons.find((a) => a.id === 'extra_hour') || {}).price || 0)} and adds more. Want me to send the shot list so you can pick what matters most?`,
      tip: obj('Do we get'),
    },
    {
      id: 'usage',
      match: /\b(can we use (them|the photos|these|it)|use (them|the photos|these photos) (for|on|in)|for (our )?ads|usage|copyright|licen[cs]e|who owns)\b/i,
      says: 'Can we use the photos for our business and ads?',
      means: 'They want to know where they can use the photos.',
      ack: () => 'Yes, you can use them where you sell.',
      say: () => `Yes. ${USE} Want me to send the terms with the shot list?`,
      tip: obj('Can we use'),
    },
    {
      id: 'weather',
      match: /\b(rain|weather|snow|storm|what if (it|we) (rains|close|closed))\b/i,
      says: 'What if it rains?',
      means: 'They worry the day goes wrong.',
      ack: () => 'Weather is easy here.',
      say: () => "Then we move the date, and the new date costs nothing. Most of the shoot is inside anyway. Want to pick a first date and a backup?",
      tip: obj('What if'),
    },
    {
      id: 'camera_shy',
      match: /\b(hate (being )?(photographed|in photos|on camera|having my (photo|picture) taken)|not photogenic|unphotogenic|camera.?shy|don'?t (like|want) (to be|being) (in|on) (photos|camera|pictures))\b/i,
      says: 'I hate being photographed.',
      means: 'They worry about being in the photos themselves.',
      ack: () => 'Most people feel that way.',
      say: () => "Most people feel that way, and you don't have to be in it at all: your work, your space and the outside come first. If you want one of you, it takes 10 minutes with simple directions, and you see the first frames on the back of the camera. Want me to leave you off the shot list?",
      tip: obj('I hate'),
    },
    {
      id: 'have_photos',
      match: /\b(already (have|got) (a |some |our )?(photos|pictures|photographer)|we have (a |some )?(photos|pictures|photographer)|(our|my) (photos|pictures) are fine)\b/i,
      says: 'We already have photos.',
      means: 'They have some photos and don\'t see what is missing.',
      ack: () => "Good that you have some, and I'm not saying start over.",
      say: (v) => `Good that you have some, and I'm not saying start over. ${photoFact(v) ? `One thing I noticed on your website: ${photoFact(v)}.` : 'The shot list I made shows what your website has today and what is missing.'} Want me to send it so you can see if anything is worth adding?`,
    },
    {
      id: 'info',
      match: /\b(send (me )?(some |more )?(info|information|details|prices|pricing)|email me|more info)\b/i,
      onCall: false,
      says: 'Send me some info.',
      means: 'They want something to read first.',
      say: (v) => `Sure. The short version: ${v.priceLine.replace(/^A business/, 'a business')} The shot list I made for you is here: [paste your link]. Would 10 minutes at your place this week be easier than email?`,
    },
    {
      id: 'when',
      match: /\b(how (soon|long)|when (could|can|would) (you|we|it) (start|begin|come|shoot)|turnaround)\b/i,
      onCall: false,
      says: 'When could you start?',
      means: 'They want to know how fast they get photos.',
      say: () => 'I can usually shoot within a week of your yes, before you open or in a quiet hour, and your edited photos are in your gallery within 3 days. Want me to hold a date?',
    },
  ],

  call: {
    checks: (v) => [
      'Open their website and Google profile on your phone: how many photos, and how old do they look?',
      'Have the shot list open on your phone.',
      photoFactOf(v) || v.fact ? `Know the one thing you will name: ${photoFactOf(v) || v.fact}` : 'Pick the one shot you would take first.',
      'Bring 3 to 5 of your best photos of a similar place, on your phone.',
    ],
    questions: () => [
      'Where will the photos go first: website, Google profile, menu, posts or ads?',
      'What do people come in for most? That goes first on the shot list.',
      'Is there anyone on the team who is happy to be in photos, and anyone who is not?',
      'When is the room quiet and the light good: before you open, or a slow afternoon?',
      'Who else decides on this with you?',
      'If we shot next week, what would you want to see first?',
    ],
    close: () => "Want to do it? I'll send the proposal tonight with the options. Once you pick one and pay half to hold the date, I come by at a quiet hour, and your edited photos are in your gallery within 3 days.",
    after: () => 'Send the proposal within 24 hours with the shot list link, and log the call in your Pipeline. If you hear nothing in 3 days, send one short follow-up.',
  },

  start: {
    packages: [
      { id: 'business_shoot', label: 'Business shoot' },
      { id: 'half_day', label: 'Half-day shoot' },
      { id: 'hour_shoot', label: 'One-hour shoot' },
      { id: 'monthly_session', label: 'Monthly photo session' },
      { id: 'headshots', label: 'Team headshots' },
      { id: 'listing', label: 'Listing photos' },
    ],
    // Read as "Thank you for choosing me for a business shoot for Mensah Bistro" on the invoice email.
    title: (v) => ({ business_shoot: `A business shoot for ${v.biz}`, half_day: `A half-day shoot for ${v.biz}`, hour_shoot: `A one-hour shoot for ${v.biz}`, monthly_session: `Monthly photo sessions for ${v.biz}`, headshots: `Team headshots for ${v.biz}`, listing: `Listing photos for ${v.biz}` })[v.pkg.id],
    // A shoot is half to hold the date; a month is paid in full at its start (no deposit line).
    deposit: (v) => (v.pkg.id === 'monthly_session' ? null : '50%'),
    jobWord: (v) => ({ monthly_session: 'monthly session', listing: 'listing shoot', headshots: 'headshot session' })[v.pkg.id] || 'shoot',
    showWhat: 'a few of the photos',
    terms: (v) =>
      v.pkg.id === 'monthly_session'
        ? `Each month is paid at its start, month to month: stop any time before the next month. ${USE}`
        : v.pkg.id === 'listing'
          ? 'Half to book the shoot, the rest when your gallery is delivered. You and your brokerage may use the photos to market this listing; I keep the copyright and may show them in my portfolio.'
          : `Half to hold the date, the rest when your gallery is ready. If weather or a closure moves the shoot, the new date is free. ${USE}`,
    prepIntro: 'to get ready for the shoot, could you send me:',
    needs: (v) =>
      v.pkg.id === 'listing'
        ? ['The address, and how I get in (lockbox code or who lets me in).', 'When the home will be ready: lights on, beds made, counters clear.', 'Anything not to show, like a room still being worked on.', 'When the listing goes live, so the photos are in first.']
        : v.pkg.id === 'headshots'
          ? ['The names of everyone getting a headshot, and a time slot for each.', 'A quiet room or a wall with space to step back.', 'What people should wear: solid colors photograph best.', 'Where the headshots go: website, profiles, badges or print.']
          : [
              'A good day and time when the room is quiet and the light is good, like before you open.',
              'What people come in for most, so it goes first on the shot list.',
              "Anyone on the team who is happy to be in photos (and anyone who isn't).",
              'Where the photos go first: website, Google profile, menu, posts or ads.',
              ...(v.pkg.id === 'monthly_session' ? ["Anything new this month: dishes, products, the season, new faces."] : ['Anything you never want shown.']),
            ],
    plan: (v) =>
      v.pkg.id === 'listing'
        ? [
            { day: 0, what: 'Address, access and the time the home is ready' },
            { day: 1, what: 'Shoot inside and out' },
            { day: 2, what: 'Edited photos in your gallery within 24 hours' },
          ]
        : v.pkg.id === 'headshots'
          ? [
              { day: 0, what: 'Names, time slots and what to wear' },
              { day: 3, what: 'Headshot session at your place' },
              { day: 4, what: 'Everyone picks their 2 favorites' },
              { day: 6, what: 'Edited headshots in your gallery' },
            ]
          : v.pkg.id === 'monthly_session'
            ? [
                { day: 0, what: "Kickoff: this month's short shot list" },
                { day: 3, what: 'First 1-hour session at your place' },
                { day: 6, what: '10 edited photos in your gallery' },
                { day: 28, what: 'Next month: new shot list and a date' },
              ]
            : [
                { day: 0, what: 'Shot list agreed from what your website and Google profile show today' },
                { day: 3, what: `${v.pkg.id === 'half_day' ? 'Half-day shoot' : v.pkg.id === 'hour_shoot' ? 'One-hour shoot' : 'Shoot'} at your place in a quiet hour` },
                { day: 6, what: 'Edited photos in your online gallery' },
                { day: 9, what: 'Help putting the best ones on your website and Google profile' },
              ],
    kickoff: (v, plan) =>
      [
        `Hi ${v.hi}, thank you for saying yes! Here's the plan for ${v.biz}:`,
        '',
        ...plan.map((x) => `${x.date}: ${x.what}`),
        '',
        `I'll send the invoice for ${v.pkg.id === 'monthly_session' ? 'the first month' : 'the first half'} today. Once it's paid, the date is yours: ${v.date(v.pkg.id === 'listing' ? 1 : 3)}. If weather or a closure moves it, the new date is free.`,
        '',
        v.me,
      ].join('\n'),
    after: (v) =>
      v.pkg.id === 'listing'
        ? `Hi ${v.hi}, your listing photos are in your gallery: [your link]. They're sized for the MLS and listing sites. If one needs another edit, tell me today.`
        : v.pkg.id === 'monthly_session'
          ? `Hi ${v.hi}, this month's 10 photos are in your gallery: [your link]. Use them on your posts, website and Google profile. If one needs another edit, tell me this week, and send me anything new for next month's list.`
          : `Hi ${v.hi}, your edited photos are in your gallery: [your link]. Use them on your website, Google profile, posts and menus. If one needs another edit, tell me this week. Want help picking the best 5 for your Google profile?`,
    rules: [
      'Only photograph staff and guests who agree, and get a signed release before you use a recognizable face in your own portfolio or ads.',
      'Agree the shot list and the usage in writing before the shoot.',
      'Fly a drone for pay only with your own FAA Part 107 certificate, where flying is allowed.',
      'Parks and venues may want a permit for a paid shoot: ask them first.',
      'Deliver the gallery by the promised date. Back up every card before you format it.',
    ],
  },

  keep: {
    planIds: ['monthly_session', 'refresh'],
    plans: (o) => {
      const shoot = pkg(o, 'business_shoot');
      return [
        ...o.care.map((c) => ({ id: c.id, label: c.label, price: c.price, unit: 'month', includes: c.includes, summary: c.summary })),
        { id: 'refresh', label: 'Seasonal refresh shoot', price: shoot.price, unit: 'shoot', includes: ['A business shoot each season: new dishes, products, decor and faces', ...shoot.includes.slice(1)], summary: 'a business shoot each season, so your photos stay current' },
      ];
    },
    introWhat: 'fresh photos of their own place and work',
    measure: 'At month end: the photos delivered, how many are now on your website, Google profile and menu, and the calls, website clicks and direction requests from your Google profile Performance page.',
    weeks: (v) =>
      v.plan.id === 'refresh'
        ? [`Plan the ${v.monthName} shoot: what's new this season`, v.notes ? `Shot list for: ${v.notes}` : 'Shot list agreed', 'Shoot at your place in a quiet hour', 'Edited photos in your gallery, then help putting them up']
        : [`Shot list for ${v.monthName}: what's new`, v.notes ? `Session for: ${v.notes}` : '1-hour session at your place', '10 edited photos in your gallery', 'Help putting the best ones up, then the month-end numbers'],
    checkin: (v) => `Hi ${v.hi}, quick check-in for ${v.monthName}: anything new coming up, like dishes, products, decor or new faces? Send it over and I'll put it on the shot list.`,
    offer: (v) => (v.plan.unit === 'month' ? `Hi ${v.hi}, for ${v.monthName} I'd keep ${v.biz} on the ${v.plan.label.toLowerCase()} at ${usd(v.plan.price)} a month: ${v.plan.summary}. Month to month, stop any time. Want me to keep it going?` : `Hi ${v.hi}, for ${v.monthName} I'd suggest a seasonal refresh shoot for ${v.biz} at ${usd(v.plan.price)}: ${v.plan.summary}. Want me to hold a date?`),
    upsell: (v) => `One idea for ${v.monthName}: team headshots at ${usd(pkg(v.o, 'headshots').price)} a person, so your website and Google profile show the people, not only the place. Want me to add them to the next session?`,
  },

  month: {
    metrics: [
      { key: 'calls', label: 'Calls from the Google profile', kind: 'result' },
      { key: 'clicks', label: 'Website clicks from the Google profile', kind: 'result' },
      { key: 'directions', label: 'Direction requests', kind: 'result' },
      { key: 'photos', label: 'Edited photos delivered', kind: 'work' },
      { key: 'used', label: 'New photos now on the website, Google profile or menu', kind: 'work' },
      { key: 'posts', label: 'Posts made with the photos', kind: 'work' },
    ],
    goalHint: 'Something the owner counted, like "orders of the new dish" or "bookings"',
    source: 'Calls, website clicks and direction requests from the Google profile Performance page; photos and posts as we both counted them. Only numbers we counted.',
    nextDefault: "Keep the monthly session going, shoot what's new first, and keep counting.",
    anonymous: 'A local business',
    storyLead: (who) => `${who} wanted photos that show what a visit is like today.`,
  },
};
