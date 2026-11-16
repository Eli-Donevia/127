// Coach Launch Kit: one coach form in, a full launch out (site, challenge page, VSL script, ads, emails, DM flow,
// 30 days of posts, consult script, client app link). Plain templates, no AI call, so it runs the same in the browser
// (public/js/coach-kit.js loads this file as-is) and on the server. The AI packs (site.write_copy, content.write_script,
// ads.write_ads, email.write_sequence) can rewrite any piece later; these templates are the floor they must beat.
//
// Copy rules (v2/design/copy-check.md, personal-trainers vertical legal line): no body, weight, health or money result
// claims; no "guarantee"; testimonials only in the coach's own words with the client's written OK; injuries and
// conditions go to a doctor. check() below enforces the words that would break them.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CoachKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    coach: 'Jordan Reyes',
    business: 'Reyes Strength',
    who: 'busy parents',
    what: 'strength training at home',
    place: 'at home with a pair of dumbbells',
    days: 21,
    start: '2027-01-04',
    price: 49,
    monthly: 149,
    handle: 'reyesstrength',
    keyword: 'START',
    color: '#C83A75',
    story: 'I started training in my garage with two dumbbells and twenty minutes a day. That is still how I coach.',
  };

  const BANNED = [
    /\blose\s+\d+/i, /\b\d+\s*(lb|lbs|pounds|kg|kilos?)\b/i, /\bguarantee/i, /\bburn\s+fat\b/i, /\bfat\s+loss\b/i,
    /\btoned?\b/i, /\bshred/i, /\bsix[- ]pack\b/i, /\bbefore\s*(and|&)\s*after\b/i, /\bcure\b/i, /\$\s?\d[\d,]*\s*(k|a month|\/mo)?\s+(income|revenue|profit)/i,
    /\bstudents?\b/i, /\bhormozi\b/i, /\$100m\b/i, /\bunlock\b/i, /\belevate\b/i, /\bjourney\b/i, /\bgame[- ]?changer\b/i,
  ];

  function clean(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 160); }
  function int(v, lo, hi, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
  function hex(v, d) { return /^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim() : d; }
  function slug(v) { return clean(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'coach'; }
  function first(name) { return clean(name, 40).split(' ')[0] || 'Coach'; }
  function title(s) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

  function normalize(input) {
    const i = input || {};
    const f = {};
    for (const k of Object.keys(DEFAULTS)) f[k] = i[k] == null || String(i[k]).trim() === '' ? DEFAULTS[k] : i[k];
    f.coach = clean(f.coach, 60);
    f.business = clean(f.business, 60);
    f.who = clean(f.who, 60).replace(/^for\s+/i, '');
    f.what = clean(f.what, 80);
    f.place = clean(f.place, 80);
    f.days = int(f.days, 7, 90, 21);
    f.price = int(f.price, 0, 5000, 49);
    f.monthly = int(f.monthly, 0, 10000, 149);
    f.handle = clean(f.handle, 30).replace(/^@/, '').replace(/[^a-z0-9._]/gi, '');
    f.keyword = clean(f.keyword, 16).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'START';
    f.color = hex(f.color, DEFAULTS.color);
    f.story = clean(f.story, 400);
    f.start = /^\d{4}-\d{2}-\d{2}$/.test(String(f.start)) ? String(f.start) : DEFAULTS.start;
    f.first = first(f.coach);
    f.slug = slug(f.business);
    f.challenge = `The ${f.days}-Day ${title(f.what.split(' ').slice(0, 2).join(' '))} Challenge`;
    f.priceText = f.price ? `$${f.price}` : 'Free';
    return f;
  }

  function dateText(iso, add) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + (add || 0));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function site(f) {
    return {
      name: f.business,
      nav: ['Program', 'Challenge', 'About', 'Apply'],
      heroTitle: `Coaching for ${f.who} who want to get strong ${f.place}.`,
      heroSub: `${f.coach} writes your training, checks in every week and adjusts the plan when life gets busy.`,
      cta: 'Apply for coaching',
      program: [
        { name: f.challenge, line: `${f.days} days, a workout and three daily habits, with a group that checks in every day.`, price: f.priceText },
        { name: '1:1 coaching', line: 'Your own program in the app, a weekly check-in and messages with me.', price: f.monthly ? `$${f.monthly} a month` : 'Ask me' },
      ],
      steps: [
        { title: 'Apply', body: 'Tell me your schedule, your equipment and anything that hurts.' },
        { title: 'Get your plan', body: 'Your workouts land in the app with how-to steps for every exercise.' },
        { title: 'Check in weekly', body: 'Log your sessions. I read every check-in and change what needs changing.' },
      ],
      about: f.story,
      faq: [
        { q: 'Do I need a gym?', a: `No. The plan is built for ${f.place}.` },
        { q: 'I have an injury. Can I join?', a: 'Check with your doctor first, then tell me about it in your application so I can plan around it.' },
        { q: 'What if I miss a day?', a: 'Pick up the next day. The plan expects real life.' },
      ],
    };
  }

  function challengePage(f) {
    const end = dateText(f.start, f.days - 1);
    return {
      title: f.challenge,
      line: `${f.days} days. One workout a day, three habits, one group. Starts ${dateText(f.start)}.`,
      dates: `${dateText(f.start)} to ${end}`,
      price: f.priceText,
      rules: [
        'Do the day\'s workout. 20 to 35 minutes, in the app.',
        'Walk 20 minutes outside.',
        'Drink water with every meal.',
        'Check in before bed: tick the day and post one line to the group.',
      ],
      get: [
        `${f.days} days of workouts in the app, with how-to steps for every move`,
        'A daily check-in and a group board you can see every morning',
        `A live call with ${f.first} at the start and at the end`,
        'Points for every day you check in, and a board that shows who showed up',
      ],
      finish: `Finish ${Math.ceil(f.days * 0.85)} of ${f.days} days to get the finisher spot on the board.`,
      faq: [
        { q: 'How long is each workout?', a: '20 to 35 minutes.' },
        { q: 'What equipment?', a: `Built for ${f.place}.` },
        { q: 'What if I fall behind?', a: 'Pick up the next day. The board counts the days you show up, not a perfect run.' },
      ],
    };
  }

  function vsl(f) {
    return [
      { beat: 'Hook', time: '0:00', say: `If you are one of the ${f.who} who keep starting over, give me the next ${f.days} days.` },
      { beat: 'The problem', time: '0:20', say: 'Most plans assume you have an hour, a gym and a quiet house. You have twenty minutes and a day that never goes to plan.' },
      { beat: 'My story', time: '0:50', say: f.story },
      { beat: 'The method', time: '1:40', say: `One workout a day, built for ${f.place}. Three habits. A check-in before bed. A group that sees whether you showed up.` },
      { beat: 'What you get', time: '2:30', say: `${f.challenge}: ${f.days} days in the app, a live kickoff call, a daily board and points for every day you check in.` },
      { beat: 'Proof', time: '3:20', say: 'Show one client, in their own words, with their written OK. No numbers you cannot stand behind.' },
      { beat: 'The ask', time: '3:50', say: `It starts ${dateText(f.start)} and costs ${f.priceText}. Tap the link, apply, and I will see you on day one.` },
    ];
  }

  function ads(f) {
    return [
      { angle: 'Twenty minutes', hook: `Twenty minutes, ${f.place}.`, body: `${f.days} days of workouts built for ${f.who}. A group checks in every night. Starts ${dateText(f.start)}.`, headline: f.challenge, cta: 'Apply' },
      { angle: 'Start over', hook: 'Stop starting over on Mondays.', body: `${f.days} days, one workout a day, and a coach who reads your check-in. ${f.priceText}.`, headline: `Join ${f.first}'s challenge`, cta: 'Apply' },
      { angle: 'The board', hook: 'Who showed up today?', body: `Every check-in earns a point on the group board. ${f.days} days. You against your own excuses.`, headline: `${f.challenge} starts ${dateText(f.start)}`, cta: 'See the plan' },
    ];
  }

  function emails(f) {
    const s = dateText(f.start);
    return [
      { when: '10 days before', subject: `${f.days} days, starting ${s}`, body: `I am running ${f.challenge} for ${f.who}. One workout a day, ${f.place}, and a group that checks in every night. Spots and details: [link].` },
      { when: '5 days before', subject: 'What a day looks like', body: 'Open the app, do 20 to 35 minutes, walk 20, check in before bed. That is the whole day. [link]' },
      { when: '2 days before', subject: 'The question I get most', body: `"What if I miss a day?" Pick up the next one. Finish ${Math.ceil(f.days * 0.85)} of ${f.days} days and you are on the finisher board. [link]` },
      { when: 'Day before', subject: 'Tomorrow', body: `We start ${s}. Kickoff call at 7pm. If you are in, apply tonight: [link]` },
      { when: 'Last day', subject: `Day ${f.days}`, body: `You showed up. If you want to keep going with a plan written for you, 1:1 coaching is ${f.monthly ? `$${f.monthly} a month` : 'open'}. Reply "next" and I will send the details.` },
    ];
  }

  function dms(f) {
    return [
      { step: 'Post caption', text: `Comment ${f.keyword} and I will send you the plan for ${f.challenge}.` },
      { step: 'First DM', text: `Hey, it's ${f.first}. Here's the ${f.days}-day plan: [link]. Quick question so I can point you right: how many days a week can you train right now?` },
      { step: 'If they answer', text: 'Perfect, the challenge fits that. The link has the dates and what is included. Any questions, ask me here.' },
      { step: 'Two days later', text: `Doors close ${dateText(f.start, -1)}. Want me to hold you a spot?` },
    ];
  }

  function posts(f) {
    const pillars = [
      (d) => `Day ${d}: the 20-minute ${f.what.split(' ')[0]} session I would do today`,
      () => `What ${f.who} get wrong about starting again`,
      () => 'One exercise, three ways (easy, normal, hard)',
      () => 'My real week: when I train when the day falls apart',
      () => `Question box: ask me anything about ${f.what}`,
      () => `Why ${f.challenge} has a group board`,
    ];
    const out = [];
    for (let d = 1; d <= 30; d++) out.push({ day: d, post: pillars[(d - 1) % pillars.length](d), cta: d % 3 === 0 ? `Comment ${f.keyword}` : 'Save this' });
    return out;
  }

  function consult(f) {
    return [
      { part: 'Open (2 min)', say: 'Thanks for applying. I read your answers. Can I ask a few questions so I only suggest something that fits?' },
      { part: 'Where you are (5 min)', say: 'How many days can you train right now? What equipment? Anything that hurts or that a doctor told you to avoid?' },
      { part: 'What you want (5 min)', say: 'If the next three months went well, what would be different in your week?' },
      { part: 'The plan (5 min)', say: `Here is what I would do: ${f.days} days in the challenge to build the habit, then a plan written for you in the app with a weekly check-in.` },
      { part: 'The price, once (1 min)', say: `The challenge is ${f.priceText}. Coaching after it is ${f.monthly ? `$${f.monthly} a month` : 'priced on the call'}. Do you want to start?` },
      { part: 'If they need to think', say: 'Of course. What would you need to know to decide? I will send the link and check in on Thursday.' },
    ];
  }

  function appLink(f) {
    return { name: `${f.business} app`, color: f.color, query: `?coach=${encodeURIComponent(f.business)}&by=${encodeURIComponent(f.coach)}&color=${encodeURIComponent(f.color)}&days=${f.days}&start=${f.start}&ch=${encodeURIComponent(f.challenge)}` };
  }

  // Every string in the kit, flattened, so the check and the tests see exactly what a coach would publish.
  function strings(kit) {
    const out = [];
    (function walk(v) {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { if (k !== 'facts' && k !== 'app') walk(v[k]); });
    })(kit);
    return out;
  }

  function check(kit) {
    const problems = [];
    for (const s of strings(kit)) for (const re of BANNED) if (re.test(s)) problems.push({ text: s, rule: String(re) });
    return problems;
  }

  function build(input) {
    const f = normalize(input);
    const kit = { facts: f, site: site(f), challenge: challengePage(f), vsl: vsl(f), ads: ads(f), emails: emails(f), dms: dms(f), posts: posts(f), consult: consult(f), app: appLink(f) };
    kit.problems = check(kit);
    return kit;
  }

  return { DEFAULTS, BANNED, build, check, normalize, strings };
});
