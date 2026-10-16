// Result-screen copy for the three funnels, by launch state. Source: conversion/pages/quiz-results.md
// (Offer and conversion) sections 3 to 11. Edit copy here; results-kit.js draws it.
// {placeholders} are filled from window.K127_LAUNCH (lib/funnels.js launchInfo()), so no date or price
// is typed here. The server reads this file too, so the result emails say the same thing as the page.
window.RESULTS = {
  gate: {
    score: { label: 'Get your full result.', line: 'Your reasons, your #1 move and your roadmap preview, sent to your inbox.', button: 'Send my results' },
    stack: { label: 'Get the Day One Stack.', line: '10 tools, 30 copy-paste prompts and the $0 day-one stack.', button: 'Send me the guide' },
    idea: { label: 'Get your 7-day test plan.', line: 'Your 7-day test plan, 3 customer questions and who to talk to.', button: 'Send my results' },
    toast: 'Sent. Check your inbox.',
    sticky: 'Get your full result by email.',
  },

  // State A (waitlist open, before doors).
  founding: {
    heading: "You're on the founding list.",
    optedIn: "Doors open {doors} at {doorsTime}. We'll email you before they open and before the founding price ends.",
    notOptedIn: "Doors open {doors} at {doorsTime}. You asked for your {thing} only, so we won't send reminders.",
    ask: "Want launch news, Eli's founder emails and the weekly digest too?", // Legal L39
    askButton: 'Yes, send them',
    askDone: "Done. We'll email you before doors open.",
    calendar: 'Add doors open to my calendar',
  },
  offer: [
    'Builder is ${price} a month for founding members, locked for as long as you stay.',
    'It ends {closes} at {closesTime}, or when {cap} founding members join.',
    '14 days to change your mind. No Black Friday sale.',
  ],
  bring3: {
    heading: 'Bring {refN}, get a month.',
    body: "When {refN} friends confirm with your link, your first month of Builder is free. Your link keeps counting until {closesDate}, and if you've already paid, the month comes as credit.",
    copy: 'Copy link',
    share: 'Share',
    track: 'Track your referrals',
  },
  challenge: {
    label: 'Free · 5 days',
    heading: 'Join the Day One Challenge.',
    body: '5 days, {day1} to {day5}. One email a day with one task on your own business.',
    bodyLive: "It's running now, {day1} to {day5}. One email a day with one task on your own business.",
    lives: '2 lives with Eli: the Kickoff on {live1} and the Debrief on {live2}, both at {liveTime}.',
    finish: 'Finish it and you get your early-access link for {doorsShort}.',
    button: 'Join the challenge',
    small: "Free. We'll use the email you just gave. Sign-ups close {regCloses}.",
    done: "You're in. You'll get one email a day, {range}.",
    already: "You're in the challenge.",
  },
  doors: {
    heading: 'Doors open {doors} at {doorsTime}.',
    free: 'Weeks 1 and 2 of your roadmap are free. No card.',
  },

  // State B (founding window).
  open: {
    heading: 'Doors are open.',
    shared: "Builder also opens weeks 3 and 4, and about 300 Eli's Playbook messages a month that work from your assessment and your roadmap.",
    roadmap: 'Get my roadmap',
    zero: '$0 to start. No card.',
    lock: 'Lock ${price} a month',
    small: [
      'The 14 days cover your first paid Builder charge. One email refunds it in full. Cancel online anytime from Billing. No call or email needed.',
      "If checkout breaks on our side before the close, email hello@127group.io within 48 hours and we'll honor the founding price.",
    ],
    spots: '{spotsLeft} founding spots left.',
    lastDay: 'Founding price ends tonight at {closesTime}.',
  },

  // State C (after the founding window).
  evergreen: {
    heading: 'Your roadmap is ready.',
    start: 'Start free',
    zero: '$0 to start. No card.',
    builder: 'Become a Builder',
  },

  // One set of lines per Founder Score archetype (§5.4, §6.2, §7). Keys match score-data.js.
  // a2 for Validator: roadmap.js week 1 is "Choose on purpose", not testing with people, so it
  // uses the spec's fallback ("Week 1 of your Start track").
  score: {
    exploring: {
      a1: "Your score says pick one. That's Day 1, {day1}: Pick one.",
      a2: 'On {doorsShort}, your roadmap opens on the Start track. Week 1 is picking one idea, on purpose.',
      resource: 'Your gap is picking one. Builder\'s Business Model Worksheet turns the idea you pick into a model you can test.',
      start: 'Start free. Your roadmap opens on the Start track, and week 1 is picking one idea.',
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, the Business Model Worksheet and Eli's Playbook.",
    },
    validating: {
      a1: 'Your next proof is a yes. That\'s Day 5, {day5}: Ask for a yes.',
      a2: 'On {doorsShort}, your roadmap opens on Week 1 of your Start track.',
      resource: "You've got an idea and some answers. Builder's One-Page Offer turns what people told you into an offer they can say yes to.",
      start: 'Start free. Your roadmap opens on the Start track, built around testing your idea with real people.',
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, The One-Page Offer and Eli's Playbook.",
    },
    launched: {
      a1: "You're selling. Make the offer clear first: Day 4, {day4}: Write the offer.",
      a2: 'On {doorsShort}, your roadmap opens on the Build track. Week 1 starts with your offer.',
      resource: "You're selling. Builder's Founder KPI Dashboard shows which weeks sold and why, so you can repeat them.",
      start: 'Start free. Your roadmap opens on the Build track, starting with your offer.',
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, the Founder KPI Dashboard and Eli's Playbook.",
    },
    growing: {
      a1: 'Find out why it works. Day 3, {day3}: Have the conversation, with your best customers.',
      a2: "On {doorsShort}, your roadmap opens on the Grow track. Week 1 finds out what's working.",
      resource: "Something works. Builder's Outreach Scripts help you reach more people like your best customers.",
      start: "Start free. Your roadmap opens on the Grow track, starting with what's working.",
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, Outreach Scripts and Eli's Playbook.",
    },
    scaling: {
      a1: 'Your Week 1 is See the business clearly, and it opens {doorsShort}. The lives are open to you too.',
      a2: 'On {doorsShort}, your roadmap opens on Week 1: See the business clearly.',
      resource: "The business runs on you. Builder's Weekly CEO Review gives you one weekly check on the numbers and what to hand off next.",
      start: 'Start free. Your roadmap opens on Week 1: See the business clearly.',
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, the Weekly CEO Review and Eli's Playbook.",
    },
  },

  // Day One Stack (§10).
  stack: {
    a1: 'Put the $0 day-one stack to work on Day 1, {day1}: Pick one.',
    a2: 'On {doorsShort}, your roadmap tells you which tool each step needs.',
    resource: "Tools help when you know the next step. Your roadmap gives you the step, and Builder's 18 playbooks, worksheets and tools cover all 4 weeks.",
    start: 'Start free. Your roadmap tells you which tool each step needs.',
    builder: "Builder, ${builderPrice} a month: all 4 weeks, every playbook and Eli's Playbook, which knows your roadmap.",
  },

  // Idea Test, by verdict (§11). a2: roadmap.js Start week 1 opens with the Idea Test itself.
  idea: {
    'Rework it': {
      a1: 'Day 1, {day1}: Pick one. Test a sharper version.',
      resource: "Your idea needs a sharper version. Builder's Business Model Worksheet turns it into a model you can test.",
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, the Business Model Worksheet and Eli's Playbook.",
    },
    Promising: {
      a1: 'Day 3, {day3}: Have the conversation.',
      resource: "Next, people have to say yes. Builder's One-Page Offer turns what they tell you into an offer they can say yes to.",
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, The One-Page Offer and Eli's Playbook.",
    },
    'Build it': {
      a1: 'Day 5, {day5}: Ask for a yes.',
      resource: "Next is reach. Builder's Outreach Scripts help you put this in front of the people it's for.",
      builder: "Builder, ${builderPrice} a month: weeks 3 and 4, Outreach Scripts and Eli's Playbook.",
    },
    a2: 'On {doorsShort}, your roadmap opens on the Start track, and week 1 starts with the Idea Test.',
    start: 'Start free. Your roadmap opens on the Start track, built around testing your idea with real people.',
  },

  // §9, voice §7 proof points word for word, one per line, never merged.
  who: {
    heading: 'Who built this.',
    name: 'Eli Christiansen, founder of 127.',
    points: [
      '2x founder (e-commerce and technology)',
      'First business: sneaker reselling, $2,000 in, $3,000 out, before college',
      '25M+ views across social',
    ],
    note: "Eli's results aren't typical or a promise of what you'll earn.", // Legal L39, Part B
  },
};

// "{doors}" -> "Tue, Nov 17". Challenge days come in as day1..day5, live1, live2. A missing value
// leaves the line out (the page checks for "{" before showing a line).
window.RESULTS.fill = function (s, L) {
  L = L || {};
  var c = L.challenge || {}, days = c.days || [], lives = c.lives || [];
  var v = {
    price: L.price, builderPrice: L.builderPrice, cap: L.cap, refN: L.refN, spotsLeft: L.spotsLeft,
    doors: L.doors, doorsShort: L.doorsShort, doorsTime: L.doorsTime, closes: L.closes, closesDate: L.closesDate, closesTime: L.closesTime,
    day1: days[0], day2: days[1], day3: days[2], day4: days[3], day5: days[4], range: c.range, live1: lives[0], live2: lives[1], liveTime: c.liveTime, regCloses: c.regCloses,
    thing: L.thing,
  };
  return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); });
};
